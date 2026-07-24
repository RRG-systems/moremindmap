import { deepFreeze } from '../../validation.js';

export const SECURITY_STATE_METHODS = deepFreeze([
  'describe',
  'rateLimit',
  'saveCapability',
  'getCapabilityByTokenHash',
  'revokeCapability',
  'issueCsrfGrant',
  'consumeCsrfGrant',
  'claimReplay',
  'completeReplay',
  'getDeletionEpoch',
  'advanceDeletionEpoch',
  'appendAudit',
  'auditSnapshot',
  'snapshot',
]);

export function validateSecurityStateStore(store) {
  const missing = SECURITY_STATE_METHODS.filter((method) => typeof store?.[method] !== 'function');
  const description = missing.length ? null : store.describe();
  const validDescription = description
    && typeof description.store_class === 'string'
    && typeof description.deployment_grade === 'boolean'
    && typeof description.available === 'boolean';
  return deepFreeze({
    valid: missing.length === 0 && validDescription,
    missing,
    description: validDescription ? description : null,
  });
}

export function requireSecurityStateStore(store) {
  const validation = validateSecurityStateStore(store);
  if (!validation.valid) throw new TypeError(`security state store is invalid: ${validation.missing.join(',')}`);
  return store;
}
