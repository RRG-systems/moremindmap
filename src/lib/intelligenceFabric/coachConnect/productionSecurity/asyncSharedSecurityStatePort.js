import { deepFreeze } from '../../validation.js';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  validateAsyncSecurityCapability,
  validateAsyncSecurityHealth,
  validateAsyncSecurityTime,
} from './asyncSecurityContracts.js';

export const ASYNC_SHARED_SECURITY_STATE_METHODS = deepFreeze([
  'describeCapability',
  'health',
  'serverTime',
  'queryAuthoritative',
  'executeAtomic',
]);

const frozen = (value) => deepFreeze(structuredClone(value));

export function isThenable(value) {
  return Boolean(value && (typeof value === 'object' || typeof value === 'function')
    && typeof value.then === 'function');
}

export function assertAsyncSecurityStatePortShape(port) {
  const missing = ASYNC_SHARED_SECURITY_STATE_METHODS
    .filter((method) => typeof port?.[method] !== 'function');
  if (missing.length) {
    throw new TypeError(`async shared security state port is invalid: ${missing.join(',')}`);
  }
  return port;
}

export function invokeAsyncSecurityMethod(port, method, args = []) {
  assertAsyncSecurityStatePortShape(port);
  let returned;
  try {
    returned = port[method](...args);
  } catch (cause) {
    throw new TypeError(`async security method ${method} threw before returning a Promise`, { cause });
  }
  if (!isThenable(returned)) {
    throw new TypeError(`async security method ${method} returned synchronously`);
  }
  return returned;
}

export async function validateAsyncSecurityStatePort(port) {
  const missing = ASYNC_SHARED_SECURITY_STATE_METHODS
    .filter((method) => typeof port?.[method] !== 'function');
  if (missing.length) return frozen({ valid: false, missing, errors: ['ASYNC_SECURITY_CONTRACT_VIOLATION'], description: null });

  const errors = [];
  let description = null;
  const probes = [
    ['describeCapability', [], validateAsyncSecurityCapability],
    ['health', [], validateAsyncSecurityHealth],
    ['serverTime', [], validateAsyncSecurityTime],
  ];

  for (const [method, args, validator] of probes) {
    try {
      const returned = port[method](...args);
      if (!isThenable(returned)) {
        errors.push(`${method}:SYNC_RETURN`);
        continue;
      }
      const value = await returned;
      const result = validator(value);
      if (!result.valid) errors.push(`${method}:INVALID_RESULT`);
      if (method === 'describeCapability' && result.valid) description = result.value;
    } catch {
      errors.push(`${method}:REJECTED`);
    }
  }

  for (const method of ['queryAuthoritative', 'executeAtomic']) {
    let returned;
    try {
      returned = port[method](null);
    } catch {
      errors.push(`${method}:SYNC_THROW`);
      continue;
    }
    if (!isThenable(returned)) {
      errors.push(`${method}:SYNC_RETURN`);
      continue;
    }
    try {
      await returned;
      errors.push(`${method}:INVALID_INPUT_RESOLVED`);
    } catch {
      // Rejection after returning a Promise is the required behavior for an invalid probe.
    }
  }

  if (description?.contract_version !== ASYNC_SECURITY_STATE_CONTRACT_VERSION) {
    errors.push('describeCapability:CONTRACT_VERSION');
  }

  return frozen({
    valid: errors.length === 0,
    missing,
    errors,
    description: errors.length ? null : description,
  });
}

export async function requireAsyncSecurityStatePort(port) {
  const validation = await validateAsyncSecurityStatePort(port);
  if (!validation.valid) {
    throw new TypeError(`async shared security state port is invalid: ${validation.errors.join(',')}`);
  }
  return port;
}

export function deploymentAsyncSecurityCapabilityDecision(description, environmentId) {
  const checked = validateAsyncSecurityCapability(description);
  const failures = [];
  if (!checked.valid) failures.push('CAPABILITY_DESCRIPTION_INVALID');
  if (description?.environment_id !== environmentId) failures.push('ENVIRONMENT_MISMATCH');
  if (description?.deployment_grade !== true) failures.push('DEPLOYMENT_GRADE_REQUIRED');
  if (description?.durable_security_records !== true) failures.push('DURABILITY_REQUIRED');
  if (description?.durable_privacy_safe_audit !== true) failures.push('DURABLE_AUDIT_REQUIRED');
  if (description?.restart_safe !== true) failures.push('RESTART_SAFETY_REQUIRED');
  if (description?.live_connection_verified !== true) failures.push('LIVE_CONNECTION_REQUIRED');
  if (description?.no_local_fallback !== true) failures.push('NO_LOCAL_FALLBACK_REQUIRED');
  if (description?.authoritative_reads !== 'PRIMARY_OR_LINEARIZABLE') failures.push('AUTHORITATIVE_READS_REQUIRED');
  return frozen({
    allowed: failures.length === 0,
    code: failures.length ? 'SHARED_SECURITY_STATE_REQUIRED' : null,
    failures,
  });
}
