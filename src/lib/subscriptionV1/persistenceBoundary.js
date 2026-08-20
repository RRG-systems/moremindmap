import { deepFreeze } from '../intelligenceFabric/validation.js';
import { scopeFingerprint } from './contracts.js';

const REQUIRED_ADAPTER_METHODS = Object.freeze([
  'atomicAppendPersonalRsl',
  'readPersonalRsl',
  'atomicTransitionAllowanceSession',
  'putUniversalCandidatePrivate',
  'inspectUniversalCandidatePrivate',
]);

export function subscriptionV1OpaqueKeys(scope) {
  const fingerprint = scopeFingerprint(scope);
  return deepFreeze({
    scope_root: `subscription:v1:scope:${fingerprint}`,
    personal_rsl_stream: `subscription:v1:rsl:${fingerprint}`,
    allowance_session_state: `subscription:v1:session:${fingerprint}`,
    universal_candidate_private: `subscription:v1:universal-candidate-private:${fingerprint}`,
  });
}

export function validateSubscriptionV1PersistenceAdapter(adapter) {
  const missing = REQUIRED_ADAPTER_METHODS.filter((method) => typeof adapter?.[method] !== 'function');
  return deepFreeze({ valid: missing.length === 0, missing });
}

export function createSubscriptionV1PersistenceBoundary({ adapter = null, enabled = false } = {}) {
  const validation = validateSubscriptionV1PersistenceAdapter(adapter);
  const invoke = async (method, input) => {
    if (!enabled) return deepFreeze({ ok: false, code: 'SUBSCRIPTION_V1_DURABLE_PERSISTENCE_DEFAULT_OFF' });
    if (!validation.valid) return deepFreeze({ ok: false, code: 'SUBSCRIPTION_V1_PERSISTENCE_ADAPTER_INVALID', missing: validation.missing });
    return adapter[method](input);
  };
  return Object.freeze({
    inspect: () => deepFreeze({
      enabled,
      adapter_valid: validation.valid,
      required_methods: [...REQUIRED_ADAPTER_METHODS],
      raw_identity_in_keys: false,
      universal_runtime_read_enabled: false,
    }),
    appendPersonalRsl: (input) => invoke('atomicAppendPersonalRsl', input),
    readPersonalRsl: (input) => invoke('readPersonalRsl', input),
    transitionAllowanceSession: (input) => invoke('atomicTransitionAllowanceSession', input),
    captureUniversalCandidatePrivate: (input) => invoke('putUniversalCandidatePrivate', input),
    inspectUniversalCandidatePrivate: (input) => invoke('inspectUniversalCandidatePrivate', input),
    retrieveUniversalForCustomerRuntime: async () => deepFreeze({ ok: false, code: 'UNIVERSAL_RSL_RUNTIME_READ_DISABLED', patterns: [] }),
  });
}
