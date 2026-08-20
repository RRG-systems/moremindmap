import Redis from 'ioredis';
import process from 'node:process';

import { createReadOnlyCanonicalReader } from '../engine/newBosProductionReadinessV1/canonicalReader.js';
import { createRedisNewBosBackgroundResponseStore } from '../engine/newBosProductionReadinessV1/backgroundResponseStore.js';
import { readNewBosProductionConfig } from '../engine/newBosProductionReadinessV1/config.js';
import { createRedisLaunchSafeRealizationStore } from '../engine/newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBosModernizationService } from '../engine/newBosProductionReadinessV1/modernizationService.js';
import { createProductionNewBosGenerator } from '../engine/newBosProductionReadinessV1/productionGenerator.js';
import { createNewBosProductionRouteHandler } from '../engine/newBosProductionReadinessV1/routeHandler.js';
import { createRedisSingleFlightCoordinator } from '../engine/newBosProductionReadinessV1/singleFlight.js';

const config = readNewBosProductionConfig(process.env);

const handler = createNewBosProductionRouteHandler({
  config,
  serviceFactory: async () => {
    if (!process.env.REDIS_URL) throw new Error('new_bos_route_redis_binding_missing');
    const redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    const canonicalReader = createReadOnlyCanonicalReader({ redis });
    const realizationStore = createRedisLaunchSafeRealizationStore({
      redis,
      namespace: config.namespace,
      persistenceEnabled: config.persistenceEnabled,
    });
    const singleFlight = createRedisSingleFlightCoordinator({ redis, namespace: config.namespace });
    const backgroundResponseStore = createRedisNewBosBackgroundResponseStore({ redis, namespace: config.namespace });
    const generator = config.providerEnabled
      ? createProductionNewBosGenerator({
        apiKey: process.env.OPENAI_API_KEY,
        repositoryRoot: process.cwd(),
        model: config.providerModel,
        backgroundResponseStore,
      })
      : null;
    return createNewBosModernizationService({
      config,
      canonicalReader,
      realizationStore,
      singleFlight,
      generator,
    });
  },
});

export default handler;
