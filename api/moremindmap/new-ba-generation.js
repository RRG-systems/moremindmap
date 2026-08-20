import Redis from 'ioredis';
import process from 'node:process';

import { createReadOnlyBaAuthorityReader } from '../engine/newBaProductionReadinessV1/canonicalReader.js';
import { authorizeNewBaRead, readNewBaProductionConfig } from '../engine/newBaProductionReadinessV1/config.js';
import { createRedisNewBaRealizationStore } from '../engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import {
  REAL_PROFILE_NEW_BA_STAGES,
  createRealProfileNewBaGenerationCampaign,
} from '../engine/newBaProductionReadinessV1/realProfileGenerationCampaign.js';
import { createRedisNewBaBackgroundResponseStore } from '../engine/newBaProductionReadinessV1/backgroundResponseStore.js';

const config = readNewBaProductionConfig(process.env);
const OPERATIONS = new Set(['status', 'preflight', 'relationship-diagnostic', ...REAL_PROFILE_NEW_BA_STAGES, 'publish']);

function tokenFromRequest(request) {
  const explicit = request.headers?.['x-new-ba-canary-token'];
  if (typeof explicit === 'string') return explicit;
  const authorization = String(request.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function safeStatus(error) {
  const code = String(error?.code || error?.message || '');
  if (/not_authorized|profile_not_authorized|profile_not_allowlisted/u.test(code)) return 404;
  if (/access_denied/u.test(code)) return 403;
  if (/identity|hash_drift|cross_profile|immutable_conflict|stale_writer/u.test(code)) return 409;
  if (/runtime_not_enabled|binding_missing|default_off/u.test(code)) return 503;
  return 500;
}

function validateCampaignRuntime() {
  if (!config.fusionValidated) throw new Error('new_ba_real_profile_generation_requires_validated_fusion');
  if (!config.staged || (!config.customerActive && !config.canaryEnabled) || !config.providerEnabled || !config.persistenceEnabled) throw new Error('new_ba_real_profile_generation_runtime_not_enabled');
}

export default async function newBaRealProfileGenerationRoute(request, response) {
  response.setHeader('cache-control', 'private, no-store, max-age=0');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
  let redis;
  try {
    validateCampaignRuntime();
    const profileId = authorizeNewBaRead({ config, profileId: request.query?.id, suppliedToken: tokenFromRequest(request) });
    const operation = String(request.query?.operation || 'status');
    if (!OPERATIONS.has(operation)) throw new Error('new_ba_real_profile_generation_operation_invalid');
    if (!process.env.REDIS_URL) throw new Error('new_ba_real_profile_generation_redis_binding_missing');
    if (!process.env.OPENAI_API_KEY) throw new Error('new_ba_real_profile_generation_openai_binding_missing');
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: true, lazyConnect: true });
    const authorityReader = createReadOnlyBaAuthorityReader({ redis, bosNamespace: config.bosNamespace });
    const realizationStore = createRedisNewBaRealizationStore({ redis, namespace: config.namespace, persistenceEnabled: config.persistenceEnabled });
    const backgroundResponseStore = createRedisNewBaBackgroundResponseStore({ redis, namespace: config.namespace });
    const campaign = createRealProfileNewBaGenerationCampaign({
      config,
      redis,
      authorityReader,
      realizationStore,
      backgroundResponseStore,
      apiKey: process.env.OPENAI_API_KEY,
    });
    let result;
    if (operation === 'status') result = await campaign.status(profileId);
    else if (operation === 'preflight') result = await campaign.preflight(profileId);
    else if (operation === 'publish') result = await campaign.publish(profileId);
    else if (operation === 'relationship-diagnostic') result = await campaign.relationshipDiagnostic(profileId);
    else result = await campaign.generateStage(profileId, operation);
    return response.status(result?.status === 'ADVANCING' ? 202 : 200).json(result);
  } catch (error) {
    return response.status(safeStatus(error)).json({
      error: 'New BA real-profile generation unavailable',
      safe_code: String(error?.code || error?.message || 'new_ba_real_profile_generation_unknown_failure').split(':')[0],
    });
  } finally {
    if (redis) await redis.quit().catch(() => {});
  }
}
