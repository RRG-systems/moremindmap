import Redis from 'ioredis';
import process from 'node:process';

import { createFrozenCanaryRealizationGenerator } from '../engine/newBaProductionReadinessV1/canaryRealizationFactory.js';
import { createAuthorizedSyntheticTopSource, createReadOnlyBaAuthorityReader, SYNTHETIC_TOP_PROFILE_ID } from '../engine/newBaProductionReadinessV1/canonicalReader.js';
import { readNewBaProductionConfig } from '../engine/newBaProductionReadinessV1/config.js';
import { createRedisNewBaRealizationStore } from '../engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBaModernizationService } from '../engine/newBaProductionReadinessV1/modernizationService.js';
import { createNewBaRouteHandler } from '../engine/newBaProductionReadinessV1/routeHandler.js';
import { createRedisSingleFlight } from '../engine/newBaProductionReadinessV1/singleFlight.js';
import { createRealProfileNewBaGenerationCampaign } from '../engine/newBaProductionReadinessV1/realProfileGenerationCampaign.js';
import { createRedisNewBaBackgroundResponseStore } from '../engine/newBaProductionReadinessV1/backgroundResponseStore.js';
import {
  authorizePublicOrRecruitingProductRequest,
  reconcileRecruitingCanonicalBaReadySafely,
} from '../engine/recruitingV1/canonicalAdapters.js';
import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  parseProfileId,
} from '../business-assessment/shared.js';
import { RedisPublicStore } from '../../src/lib/publicSiteAirlockV1/redisStore.js';

const config = readNewBaProductionConfig(process.env);

const handler = createNewBaRouteHandler({
  config,
  authorizeCustomerRead: async ({ request, profileId }) => {
    if (!process.env.REDIS_URL) throw new Error('new_ba_route_redis_binding_missing');
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: false });
    try {
      const normalizedProfileId = parseProfileId(profileId)?.normalized || '';
      const assessmentId = normalizedProfileId
        ? await redis.get(businessAssessmentByProfileKey(normalizedProfileId))
        : null;
      const assessmentRaw = assessmentId ? await redis.get(businessAssessmentKey(assessmentId)) : null;
      let assessment = null;
      try { assessment = assessmentRaw ? JSON.parse(assessmentRaw) : null; } catch { assessment = null; }
      const assessmentOwner = parseProfileId(assessment?.owner_profile_id)?.normalized || '';
      const relationshipRef = assessmentOwner === normalizedProfileId
        ? assessment?.metadata?.recruiting_relationship_ref || ''
        : '';
      return await authorizePublicOrRecruitingProductRequest({
        req: request,
        store: new RedisPublicStore(redis),
        productKey: 'business_assessment',
        profileId,
        relationshipRef,
        assessmentId: relationshipRef ? assessmentId : '',
        read: true,
        force: true,
      });
    } finally {
      await redis.quit().catch(() => {});
    }
  },
  onCanonicalServed: ({ redis, result }) => reconcileRecruitingCanonicalBaReadySafely({ redis, result }),
  serviceFactory: async () => {
    if (!process.env.REDIS_URL) throw new Error('new_ba_route_redis_binding_missing');
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: true, lazyConnect: true });
    const synthetic = createAuthorizedSyntheticTopSource();
    const authorityReader = createReadOnlyBaAuthorityReader({
      redis,
      bosNamespace: config.bosNamespace,
      fixtureReader: async (profileId) => profileId === SYNTHETIC_TOP_PROFILE_ID ? synthetic : null,
    });
    const realizationStore = createRedisNewBaRealizationStore({ redis, namespace: config.namespace, persistenceEnabled: config.persistenceEnabled });
    const backgroundResponseStore = createRedisNewBaBackgroundResponseStore({
      redis,
      namespace: config.namespace,
      onRecoveryEvent: async (event) => console.info('[NEW-BA-RECOVERY]', event),
    });
    const singleFlight = createRedisSingleFlight({ redis, namespace: config.namespace });
    const campaign = config.providerEnabled
      ? createRealProfileNewBaGenerationCampaign({
        config,
        redis,
        authorityReader,
        realizationStore,
        backgroundResponseStore,
        apiKey: process.env.OPENAI_API_KEY,
      })
      : null;
    const generator = campaign
      ? { advance: ({ source }) => campaign.advance(source.profile_id) }
      : config.canaryEnabled ? createFrozenCanaryRealizationGenerator() : null;
    return {
      redis,
      service: createNewBaModernizationService({
        config,
        authorityReader,
        realizationStore,
        singleFlight,
        generator,
      }),
    };
  },
});

export default handler;
