import { VALIDATION_ERROR_CODES } from './constants.js';
import { INTERVENTION_TRANSITIONS, LEARNING_TRANSITIONS } from './durableCoreConstants.js';
import { canonicalJson } from './hashing.js';
import { issue, validationResult } from './validation.js';

export function validateVersionTransition(previous, next) {
  const errors = [];
  if (!previous || !next || next.object_type !== previous.object_type) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'object_type', 'version transition requires the same object type'));
  if (next?.version !== previous?.version + 1) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'version', 'version must advance by exactly one'));
  const priorId = previous?.state_version_id || previous?.object_id || previous?.intent_state_id || previous?.belief_state_id || previous?.business_engine_state_id || previous?.ledger_id;
  if (!priorId || next?.previous_version_id !== priorId) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'previous_version_id', 'next version must reference the prior immutable version'));
  if (canonicalJson(previous) === canonicalJson(next)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, '$', 'new version must represent an explicit change or correction'));
  return validationResult('VersionTransition', errors, [], errors.length ? null : { previous_id: priorId, next_version: next.version });
}

export function validateInterventionTransition(from, to) {
  const valid = (INTERVENTION_TRANSITIONS[from] || []).includes(to);
  return validationResult('InterventionTransition', valid ? [] : [issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'to_status', `invalid intervention transition ${from} -> ${to}`)], [], valid ? { from, to } : null);
}

export function validateLearningTransition(from, to) {
  const valid = (LEARNING_TRANSITIONS[from] || []).includes(to);
  return validationResult('LearningTransition', valid ? [] : [issue(VALIDATION_ERROR_CODES.INVALID_ENUM, 'to_state', `invalid learning transition ${from} -> ${to}`)], [], valid ? { from, to } : null);
}

export function validateFutureSet(futures, { tolerance = 1e-9 } = {}) {
  const errors = [];
  if (!Array.isArray(futures) || futures.length === 0) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, '$', 'active future set is required'));
  const ids = new Set(); let sum = 0;
  for (const [i, future] of (futures || []).entries()) {
    if (!future.stable_future_identity || ids.has(future.stable_future_identity)) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, `${i}.stable_future_identity`, 'stable future identities must be unique'));
    ids.add(future.stable_future_identity); sum += future.probability;
    if (future.probability < 0 || future.probability > 1) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, `${i}.probability`, 'probability must be bounded'));
  }
  if (Math.abs(sum - 1) > tolerance) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, 'probability', 'active future probabilities must normalize to 1.0'));
  return validationResult('ActiveFutureSet', errors, [], errors.length ? null : { probability_sum: sum, stable_ids: [...ids] });
}

export function validateConflictResolution(conflict, resolution) {
  const errors = [];
  if (!conflict || !resolution || resolution.resolution_id !== conflict.resolution_id) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ID, 'resolution_id', 'resolution must link to conflict'));
  if (!Array.isArray(resolution?.preserved_dissent) || resolution.preserved_dissent.length === 0) errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, 'preserved_dissent', 'resolution must preserve dissenting authority positions'));
  return validationResult('ConflictResolution', errors, [], errors.length ? null : { conflict_id: conflict?.conflict_id, resolution_id: resolution?.resolution_id });
}

export function validateBusinessStateSeparation(state) {
  const errors = [];
  for (const forbidden of ['future_states', 'future_probability', 'recommended_intervention', 'renderer_labels']) if (state?.[forbidden] != null) errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TYPE, forbidden, 'current business state cannot embed futures, recommendations, or renderer labels'));
  if (!(state?.evidence_ids || []).length || !(state?.belief_ids || []).length) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, '$', 'BusinessEngineState must reference evidence and beliefs'));
  return validationResult('BusinessStateSeparation', errors, [], errors.length ? null : state);
}

export function validateCrossObjectInvariants(objects) {
  const errors = [];
  const list = Array.isArray(objects) ? objects : Object.values(objects || {});
  const tenants = new Set(list.map((o) => o?.tenant_id).filter(Boolean));
  if (tenants.size > 1) errors.push(issue(VALIDATION_ERROR_CODES.CROSS_TENANT_DENIED, 'tenant_id', 'cross-object set spans tenants without an authorization layer'));
  const knownEvents = new Set(list.flatMap((o) => o?.source_event_ids || []));
  for (const [i, object] of list.entries()) {
    if (object?.source_event_ids?.some((id) => typeof id !== 'string' || !id)) errors.push(issue(VALIDATION_ERROR_CODES.PROVENANCE_REQUIRED, `${i}.source_event_ids`, 'source event IDs must be stable references'));
    if (object?.object_type === 'BusinessEngineState') errors.push(...validateBusinessStateSeparation(object).errors);
  }
  return validationResult('CrossObjectInvariants', errors, [], errors.length ? null : { tenant_id: [...tenants][0] || null, source_event_count: knownEvents.size });
}

export function safeDurableSummary(value) {
  const blocked = new Set(['payload', 'raw_payload', 'transcript', 'notes', 'statement', 'description', 'rationale', 'chain_of_thought']);
  return Object.freeze(Object.fromEntries(Object.entries(value || {}).filter(([key]) => !blocked.has(key)).map(([key, child]) => [key,
    Array.isArray(child) ? `[${child.length} items]` : (child && typeof child === 'object' ? '[object]' : child)])));
}
