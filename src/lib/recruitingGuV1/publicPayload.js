const MAX_DEPTH = 64;
const MAX_NODES = 50_000;

function internalAssignmentKey(key, path = []) {
  const compact = String(key || '').toLowerCase().replace(/[^a-z0-9]/gu, '');
  const compactPath = path.map((part) => String(part).toLowerCase().replace(/[^a-z0-9]/gu, ''));
  const internalModelContainer = compactPath.some((part) => [
    'provider', 'providerreceipt', 'modelconfig', 'generation', 'provideraccounting',
  ].includes(part));
  const internalCoachContainer = compactPath.some((part) => [
    'coachmoves', 'currentcoachmove', 'events',
  ].includes(part));
  return compact === 'gateway'
    || compact === 'experimentcondition'
    || compact === 'experimentalcondition'
    || compact === 'blindarm'
    || compact === 'experimentarm'
    || compact === 'requestedprovider'
    || compact === 'modelconfig'
    || compact === 'modelrequested'
    || compact === 'modelreturned'
    || compact === 'requestedmodel'
    || compact === 'returnedmodel'
    || compact === 'modeloutputiscanonical'
    || (compact === 'model' && internalModelContainer)
    || (compact === 'condition' && internalCoachContainer)
    || compact.startsWith('provider')
    || compact.endsWith('providerms');
}

/**
 * Preserve the governed session and authored-product payload while removing
 * server-only generation assignments and receipts from the browser boundary.
 */
export function publicRecruitingGuPayload(value) {
  let visited = 0;
  const project = (current, depth, path = []) => {
    visited += 1;
    if (visited > MAX_NODES || depth > MAX_DEPTH) {
      throw new Error('RECRUITING_GU_V1_PUBLIC_PAYLOAD_BOUND_EXCEEDED');
    }
    if (Array.isArray(current)) return current.map((item, index) => project(item, depth + 1, [...path, index]));
    if (!current || typeof current !== 'object') return current;
    const result = {};
    for (const [key, child] of Object.entries(current)) {
      if (internalAssignmentKey(key, path)) continue;
      result[key] = project(child, depth + 1, [...path, key]);
    }
    return result;
  };
  const result = project(value, 0);
  if (result && typeof result === 'object' && !Array.isArray(result)
      && value && typeof value === 'object' && !Array.isArray(value)
      && Object.hasOwn(value, 'experiment_condition') && value.coach_move_id) {
    result.projection_deferred = Boolean(value.experiment_condition);
  }
  return result;
}

export function containsInternalRecruitingGuAssignment(value) {
  let found = false;
  const inspect = (current, depth = 0, path = []) => {
    if (found || depth > MAX_DEPTH || !current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach((item, index) => inspect(item, depth + 1, [...path, index]));
      return;
    }
    for (const [key, child] of Object.entries(current)) {
      if (internalAssignmentKey(key, path)) {
        found = true;
        return;
      }
      inspect(child, depth + 1, [...path, key]);
    }
  };
  inspect(value);
  return found;
}
