import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';

const PROFILE_ID_PATTERN = /^MM-[A-Z0-9-]+$/;

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function parseProfileIds(value) {
  return Object.freeze(String(value || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean));
}

export function readNewBosProductionConfig(env = globalThis.process?.env || {}) {
  const staged = enabled(env.NEW_BOS_PRODUCTION_STAGED);
  const customerActive = enabled(env.NEW_BOS_CUSTOMER_ACTIVE);
  const baFusionValidated = enabled(env.NEW_BOS_BA_FUSION_VALIDATED);
  const canaryEnabled = enabled(env.NEW_BOS_CANARY_ENABLED);
  const providerEnabled = enabled(env.NEW_BOS_PROVIDER_ENABLED);
  const persistenceEnabled = enabled(env.NEW_BOS_DERIVED_PERSISTENCE_ENABLED);
  const allowedProfileIds = parseProfileIds(env.NEW_BOS_CANARY_PROFILE_IDS);
  const namespace = String(env.NEW_BOS_DERIVED_NAMESPACE || 'preview:new-bos:v1').trim();

  if (customerActive && !staged) throw new Error('new_bos_customer_activation_requires_staged_runtime');
  if (customerActive && !baFusionValidated) throw new Error('new_bos_customer_activation_requires_ba_fusion_validation');
  if (canaryEnabled && !staged) throw new Error('new_bos_canary_requires_staged_runtime');
  if (providerEnabled && !canaryEnabled) throw new Error('new_bos_provider_requires_canary_gate');
  if (persistenceEnabled && !canaryEnabled && !customerActive) {
    throw new Error('new_bos_persistence_requires_authorized_runtime');
  }
  if (!namespace.startsWith('preview:new-bos:') && !namespace.startsWith('nonprod:new-bos:')) {
    throw new Error('new_bos_derived_namespace_must_be_nonproduction');
  }
  allowedProfileIds.forEach((profileId) => {
    if (!PROFILE_ID_PATTERN.test(profileId)) throw new Error('new_bos_canary_profile_id_invalid');
  });

  return Object.freeze({
    staged,
    customerActive,
    baFusionValidated,
    canaryEnabled,
    providerEnabled,
    persistenceEnabled,
    allowedProfileIds,
    namespace,
    providerModel: String(env.NEW_BOS_PROVIDER_MODEL || 'gpt-5.6-sol').trim(),
    accessToken: String(env.NEW_BOS_CANARY_ACCESS_TOKEN || ''),
  });
}

export function authorizeNewBosRead({ config, profileId, suppliedToken = '' }) {
  const normalized = String(profileId || '').trim().toUpperCase();
  if (!PROFILE_ID_PATTERN.test(normalized)) throw new Error('new_bos_profile_id_invalid');
  if (!config?.staged) throw new Error('new_bos_runtime_default_off');
  if (!config.customerActive && !config.canaryEnabled) throw new Error('new_bos_runtime_not_authorized');
  if (config.canaryEnabled && !config.customerActive) {
    if (!config.allowedProfileIds.includes(normalized)) throw new Error('new_bos_canary_profile_not_allowlisted');
    const expected = Buffer.from(config.accessToken || '');
    const supplied = Buffer.from(String(suppliedToken || ''));
    if (!expected.length || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      throw new Error('new_bos_canary_access_denied');
    }
  }
  return normalized;
}

export const NEW_BOS_PRODUCTION_ENVIRONMENT_CONTRACT = Object.freeze([
  'NEW_BOS_PRODUCTION_STAGED',
  'NEW_BOS_CUSTOMER_ACTIVE',
  'NEW_BOS_BA_FUSION_VALIDATED',
  'NEW_BOS_CANARY_ENABLED',
  'NEW_BOS_CANARY_PROFILE_IDS',
  'NEW_BOS_CANARY_ACCESS_TOKEN',
  'NEW_BOS_PROVIDER_ENABLED',
  'NEW_BOS_PROVIDER_MODEL',
  'NEW_BOS_DERIVED_PERSISTENCE_ENABLED',
  'NEW_BOS_DERIVED_NAMESPACE',
  'VITE_NEW_BOS_PRODUCTION_RENDER_ENABLED',
]);
