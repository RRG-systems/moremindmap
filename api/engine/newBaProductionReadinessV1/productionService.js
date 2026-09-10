/* global process */

import { createRedisNewBaBackgroundResponseStore } from './backgroundResponseStore.js';
import { createFrozenCanaryRealizationGenerator } from './canaryRealizationFactory.js';
import { createAuthorizedSyntheticTopSource, createReadOnlyBaAuthorityReader, SYNTHETIC_TOP_PROFILE_ID } from './canonicalReader.js';
import { readNewBaProductionConfig } from './config.js';
import { createRedisNewBaRealizationStore } from './launchSafeRealizationStore.js';
import { createNewBaModernizationService } from './modernizationService.js';
import { createRealProfileNewBaGenerationCampaign } from './realProfileGenerationCampaign.js';
import { createRedisSingleFlight } from './singleFlight.js';

export function createPinnedRealProfileCampaignGenerator(campaign) {
  if (typeof campaign?.advance !== 'function') throw new Error('new_ba_real_profile_campaign_advancer_required');
  return Object.freeze({
    advance: ({ source, realizationIdentity, expectedAuthority }) => campaign.advance(
      source.profile_id,
      expectedAuthority,
      realizationIdentity,
    ),
  });
}

export function createNewBaProductionService({
  redis,
  config = null,
  env = process.env,
  onRecoveryEvent = async (event) => console.info('[NEW-BA-RECOVERY]', event),
} = {}) {
  if (typeof redis?.get !== 'function') throw new Error('new_ba_route_redis_binding_missing');
  const resolvedConfig = config || readNewBaProductionConfig(env);
  const synthetic = createAuthorizedSyntheticTopSource();
  const authorityReader = createReadOnlyBaAuthorityReader({
    redis,
    bosNamespace: resolvedConfig.bosNamespace,
    fixtureReader: async (profileId) => profileId === SYNTHETIC_TOP_PROFILE_ID ? synthetic : null,
  });
  const realizationStore = createRedisNewBaRealizationStore({
    redis,
    namespace: resolvedConfig.namespace,
    persistenceEnabled: resolvedConfig.persistenceEnabled,
  });
  const backgroundResponseStore = createRedisNewBaBackgroundResponseStore({
    redis,
    namespace: resolvedConfig.namespace,
    onRecoveryEvent,
  });
  const singleFlight = createRedisSingleFlight({ redis, namespace: resolvedConfig.namespace });
  const campaign = resolvedConfig.providerEnabled
    ? createRealProfileNewBaGenerationCampaign({
      config: resolvedConfig,
      redis,
      authorityReader,
      realizationStore,
      backgroundResponseStore,
      apiKey: env.OPENAI_API_KEY,
    })
    : null;
  const generator = campaign
    ? createPinnedRealProfileCampaignGenerator(campaign)
    : resolvedConfig.canaryEnabled ? createFrozenCanaryRealizationGenerator() : null;
  return createNewBaModernizationService({
    config: resolvedConfig,
    authorityReader,
    realizationStore,
    singleFlight,
    generator,
  });
}
