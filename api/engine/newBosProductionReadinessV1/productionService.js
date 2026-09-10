/* global process */

import { createReadOnlyCanonicalReader } from './canonicalReader.js';
import { readNewBosProductionConfig } from './config.js';
import { createRedisLaunchSafeRealizationStore } from './launchSafeRealizationStore.js';
import { createNewBosModernizationService } from './modernizationService.js';
import { createProductionNewBosGenerator } from './productionGenerator.js';
import { createRedisNewBosResumableGenerationStore } from './resumableGenerationStore.js';
import { createRedisSingleFlightCoordinator } from './singleFlight.js';

export function createNewBosProductionService({
  redis,
  config = null,
  env = process.env,
  repositoryRoot = process.cwd(),
} = {}) {
  if (typeof redis?.get !== 'function') throw new Error('new_bos_route_redis_binding_missing');
  const resolvedConfig = config || readNewBosProductionConfig(env);
  const canonicalReader = createReadOnlyCanonicalReader({ redis });
  const realizationStore = createRedisLaunchSafeRealizationStore({
    redis,
    namespace: resolvedConfig.namespace,
    persistenceEnabled: resolvedConfig.persistenceEnabled,
  });
  const singleFlight = createRedisSingleFlightCoordinator({ redis, namespace: resolvedConfig.namespace });
  const resumableGenerationStore = createRedisNewBosResumableGenerationStore({
    redis,
    namespace: resolvedConfig.namespace,
  });
  const generator = resolvedConfig.providerEnabled
    ? createProductionNewBosGenerator({
      apiKey: env.OPENAI_API_KEY,
      repositoryRoot,
      model: resolvedConfig.providerModel,
      resumableGenerationStore,
    })
    : null;
  return createNewBosModernizationService({
    config: resolvedConfig,
    canonicalReader,
    realizationStore,
    singleFlight,
    generator,
    resumableGenerationStore,
    redisUrl: env.REDIS_URL,
  });
}
