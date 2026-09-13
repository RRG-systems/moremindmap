import { readNewBaProductionConfig } from '../newBaProductionReadinessV1/config.js';
import { createRedisNewBaRealizationStore } from '../newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { createRedisLaunchSafeRealizationStore as createRedisNewBosRealizationStore } from '../newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { authenticatePaidRuntimeRequest } from './paidRuntimeAuth.js';
import { createPaidSubscriptionV1RuntimeHandler } from './paidRuntimeHandler.js';
import {
  paidRuntimeKeys,
  resolvePaidEntitlementFromStore,
} from './paidRuntimeInfrastructure.js';
import {
  createCurrentRealProfileRealizationReader,
  createPaidSubscriberLoader,
  createRecordedBosRealizationReader,
} from './paidSubscriberLoader.js';
import { requirePinnedPaidWinnerAcceptance } from './winnerIntake.js';

/**
 * Assemble the paid subscriber route from governed server-side custody only.
 *
 * The completed BOS/BA realization store is deliberately read-only here. A
 * Subscription entrance may consume a completed canonical realization, but it
 * cannot create, repair, or replace one as a side effect of entry.
 */
export function createPaidSubscriptionV1RuntimeComposition({
  redis,
  env = {},
  winnerAcceptance,
} = {}) {
  requirePinnedPaidWinnerAcceptance(winnerAcceptance);
  if (!redis || typeof redis !== 'object') {
    throw new Error('SUBSCRIPTION_V1_PAID_REDIS_REQUIRED');
  }
  const realizationConfig = readNewBaProductionConfig(env);
  const realizationStore = createRedisNewBaRealizationStore({
    redis,
    namespace: realizationConfig.namespace,
    persistenceEnabled: false,
  });
  const bosRealizationStore = createRedisNewBosRealizationStore({
    redis,
    namespace: realizationConfig.bosNamespace,
    persistenceEnabled: false,
  });
  const readCompletedRealization = createCurrentRealProfileRealizationReader({ realizationStore });
  const readCompletedBosRealization = createRecordedBosRealizationReader({ realizationStore: bosRealizationStore });
  const loadSubscriber = createPaidSubscriberLoader({ readCompletedRealization, readCompletedBosRealization });

  return createPaidSubscriptionV1RuntimeHandler({
    redis,
    env,
    authenticate: (args) => authenticatePaidRuntimeRequest({ ...args, env }),
    loadSubscriber,
    resolveEntitlement: resolvePaidEntitlementFromStore,
    resolveKeys: ({ scope }) => paidRuntimeKeys({ scope }),
  });
}
