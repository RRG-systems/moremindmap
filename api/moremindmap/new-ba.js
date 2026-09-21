import Redis from 'ioredis';
import process from 'node:process';

import { readNewBaProductionConfig } from '../engine/newBaProductionReadinessV1/config.js';
import { createNewBaProductionService } from '../engine/newBaProductionReadinessV1/productionService.js';
import { createNewBaRouteHandler } from '../engine/newBaProductionReadinessV1/routeHandler.js';
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
        allowTemporaryProfileIdOnlyRead: true,
      });
    } finally {
      await redis.quit().catch(() => {});
    }
  },
  onCanonicalServed: ({ redis, result }) => reconcileRecruitingCanonicalBaReadySafely({ redis, result }),
  serviceFactory: async () => {
    if (!process.env.REDIS_URL) throw new Error('new_ba_route_redis_binding_missing');
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: true, lazyConnect: true });
    return {
      redis,
      service: createNewBaProductionService({
        redis,
        config,
        env: process.env,
      }),
    };
  },
});

export default handler;
