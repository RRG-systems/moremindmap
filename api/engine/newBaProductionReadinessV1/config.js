import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';

import { normalizeProfileId } from './stable.js';

function enabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function profileIds(value) {
  return Object.freeze(String(value || '').split(',').map((item) => item.trim()).filter(Boolean).map(normalizeProfileId));
}

export function readNewBaProductionConfig(env = process.env) {
  const staged = enabled(env.NEW_BA_PRODUCTION_STAGED);
  const customerActive = enabled(env.NEW_BA_CUSTOMER_ACTIVE);
  const fusionValidated = enabled(env.NEW_BA_BOS_FUSION_VALIDATED);
  const canaryEnabled = enabled(env.NEW_BA_CANARY_ENABLED);
  const providerEnabled = enabled(env.NEW_BA_PROVIDER_ENABLED);
  const persistenceEnabled = enabled(env.NEW_BA_DERIVED_PERSISTENCE_ENABLED);
  const allowedProfileIds = profileIds(env.NEW_BA_CANARY_PROFILE_IDS);
  const namespace = String(env.NEW_BA_DERIVED_NAMESPACE || 'nonprod:new-ba:v1').trim();
  const bosNamespace = String(env.NEW_BA_BOS_NAMESPACE || 'nonprod:new-bos:production-canary:v1').trim();
  const providerModel = String(env.NEW_BA_PROVIDER_MODEL || 'gpt-5.6-sol').trim();

  if (customerActive && !staged) throw new Error('new_ba_customer_activation_requires_staged_runtime');
  if (customerActive && !fusionValidated) throw new Error('new_ba_customer_activation_requires_bos_fusion_validation');
  if (canaryEnabled && !staged) throw new Error('new_ba_canary_requires_staged_runtime');
  if (providerEnabled && !canaryEnabled && !customerActive) throw new Error('new_ba_provider_requires_authorized_runtime');
  if (persistenceEnabled && !canaryEnabled && !customerActive) throw new Error('new_ba_persistence_requires_authorized_runtime');
  if (!namespace.startsWith('preview:new-ba:') && !namespace.startsWith('nonprod:new-ba:')) throw new Error('new_ba_namespace_must_be_nonproduction');
  if (!bosNamespace.startsWith('preview:new-bos:') && !bosNamespace.startsWith('nonprod:new-bos:')) throw new Error('new_ba_bos_namespace_must_be_nonproduction');
  if (providerModel !== 'gpt-5.6-sol') throw new Error('new_ba_provider_model_mismatch');

  return Object.freeze({
    staged,
    customerActive,
    fusionValidated,
    canaryEnabled,
    providerEnabled,
    persistenceEnabled,
    allowedProfileIds,
    namespace,
    bosNamespace,
    providerModel,
    accessToken: String(env.NEW_BA_CANARY_ACCESS_TOKEN || ''),
    platformAuthoritySecret: String(env.NEW_BA_PLATFORM_AUTHORITY_SECRET || ''),
  });
}

export function authorizeNewBaRead({ config, profileId, suppliedToken = '' }) {
  const normalized = normalizeProfileId(profileId);
  if (!config?.staged) throw new Error('new_ba_runtime_default_off');
  if (!config.customerActive && !config.canaryEnabled) throw new Error('new_ba_runtime_not_authorized');
  if (!config.customerActive) {
    if (!config.allowedProfileIds.includes(normalized)) throw new Error('new_ba_canary_profile_not_allowlisted');
    const expected = Buffer.from(config.accessToken || '');
    const supplied = Buffer.from(String(suppliedToken || ''));
    if (!expected.length || expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) throw new Error('new_ba_canary_access_denied');
  }
  return normalized;
}

export const NEW_BA_PRODUCTION_ENVIRONMENT_CONTRACT = Object.freeze([
  'NEW_BA_PRODUCTION_STAGED',
  'NEW_BA_CUSTOMER_ACTIVE',
  'NEW_BA_BOS_FUSION_VALIDATED',
  'NEW_BA_CANARY_ENABLED',
  'NEW_BA_CANARY_PROFILE_IDS',
  'NEW_BA_CANARY_ACCESS_TOKEN',
  'NEW_BA_PLATFORM_AUTHORITY_SECRET',
  'NEW_BA_PROVIDER_ENABLED',
  'NEW_BA_PROVIDER_MODEL',
  'NEW_BA_DERIVED_PERSISTENCE_ENABLED',
  'NEW_BA_DERIVED_NAMESPACE',
  'NEW_BA_BOS_NAMESPACE',
  'VITE_NEW_BA_PRODUCTION_RENDER_ENABLED',
]);
