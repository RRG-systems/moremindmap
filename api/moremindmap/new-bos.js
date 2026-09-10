import Redis from 'ioredis';
import process from 'node:process';

import { readNewBosProductionConfig } from '../engine/newBosProductionReadinessV1/config.js';
import { createNewBosProductionService } from '../engine/newBosProductionReadinessV1/productionService.js';
import { createNewBosProductionRouteHandler } from '../engine/newBosProductionReadinessV1/routeHandler.js';
import { authorizePublicOrRecruitingProductRequest } from '../engine/recruitingV1/canonicalAdapters.js';
import { RedisPublicStore } from '../../src/lib/publicSiteAirlockV1/redisStore.js';

const config = readNewBosProductionConfig(process.env);

const handler = createNewBosProductionRouteHandler({
  config,
  authorizeCustomerRead: async ({ request, profileId }) => {
    if (!process.env.REDIS_URL) throw new Error('new_bos_route_redis_binding_missing');
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: false });
    try {
      return await authorizePublicOrRecruitingProductRequest({
        req: request,
        store: new RedisPublicStore(redis),
        productKey: 'behavior_operating_system',
        profileId,
        read: true,
        force: true,
        allowProfileBoundBosRead: true,
      });
    } finally {
      await redis.quit().catch(() => {});
    }
  },
  serviceFactory: async () => {
    if (!process.env.REDIS_URL) throw new Error('new_bos_route_redis_binding_missing');
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    return createNewBosProductionService({
      redis,
      config,
      env: process.env,
      repositoryRoot: process.cwd(),
    });
  },
});

export default handler;
