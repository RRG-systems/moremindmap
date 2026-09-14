import { readNewBaProductionConfig } from '../newBaProductionReadinessV1/config.js';
import { createRedisNewBaRealizationStore } from '../newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { createRedisLaunchSafeRealizationStore as createRedisNewBosRealizationStore } from '../newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { sameScope } from '../../../src/lib/subscriptionV1/contracts.js';
import { createPaidSubscriptionV1RuntimeHandler } from './paidRuntimeHandler.js';
import {
  createCurrentRealProfileRealizationReader,
  createPaidSubscriberLoader,
  createRecordedBosRealizationReader,
} from './paidSubscriberLoader.js';
import {
  authenticateSyntheticQaRuntimeRequest,
  syntheticQaAccessContext,
} from './syntheticQaRuntimeAuth.js';
import {
  assertSyntheticQaBusinessScope,
  consumeSyntheticQaRuntimeCsrf,
  createSyntheticQaEntitlement,
  issueSyntheticQaRuntimeCsrf,
  syntheticQaRuntimeKeys,
  syntheticQaRuntimeRelationshipKey,
} from './syntheticQaRuntimeInfrastructure.js';
import { requirePinnedPaidWinnerAcceptance } from './winnerIntake.js';

const SYNTHETIC_QA_PROVIDER_HOLD = 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROVIDER_BUDGET_NOT_AUTHORIZED';

export function syntheticQaProviderEnabled() {
  return false;
}

export function createSyntheticQaProviderBoundary() {
  const deny = () => {
    const error = new Error(SYNTHETIC_QA_PROVIDER_HOLD);
    error.code = SYNTHETIC_QA_PROVIDER_HOLD;
    throw error;
  };
  return Object.freeze({
    createTransport: deny,
    generateGu: async () => deny(),
  });
}

export function syntheticQaGetProjection(payload) {
  const projected = { ...payload };
  delete projected.demo_subject;
  delete projected.demo_subject_switching;
  delete projected.demo_reset_enabled;
  projected.subscriber = {
    kind: 'SYNTHETIC_QA_SUBSCRIBER',
    label: 'Synthetic QA',
    synthetic_only: true,
  };
  projected.entitlement = {
    source: 'EXACT_FOUR_SYNTHETIC_QA_MANIFEST',
    billing_evidence: false,
    stripe_mutation: false,
    same_downstream_session_contract: true,
  };
  return projected;
}

export function syntheticQaFailureProjection(payload) {
  if (payload?.ok !== false) return payload;
  const replacements = new Map([
    ['SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE', 'SUBSCRIPTION_V1_SYNTHETIC_QA_RUNTIME_UNAVAILABLE'],
    ['SUBSCRIPTION_V1_PAID_HISTORY_UNAVAILABLE', 'SUBSCRIPTION_V1_SYNTHETIC_QA_HISTORY_UNAVAILABLE'],
    ['SUBSCRIPTION_V1_PAID_REQUEST_IN_PROGRESS', 'SUBSCRIPTION_V1_SYNTHETIC_QA_REQUEST_IN_PROGRESS'],
    ['SUBSCRIPTION_V1_PAID_REQUEST_ALREADY_RECORDED', 'SUBSCRIPTION_V1_SYNTHETIC_QA_REQUEST_ALREADY_RECORDED'],
    ['SUBSCRIPTION_V1_PAID_REQUEST_CONFLICT', 'SUBSCRIPTION_V1_SYNTHETIC_QA_REQUEST_CONFLICT'],
  ]);
  return replacements.has(payload.code)
    ? { ...payload, code: replacements.get(payload.code) }
    : payload;
}

function exactSyntheticQaSubscriberAuthority(context) {
  const resolved = syntheticQaAccessContext({ ok: true, membership_context: context });
  return { scope: resolved.scope, scope_hash: resolved.scope_hash };
}

export async function resolveSyntheticQaEntitlement({ scope, membership_context, now = new Date() } = {}) {
  const authority = syntheticQaAccessContext({ ok: true, membership_context });
  if (!sameScope(scope, authority.scope)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ENTITLEMENT_SCOPE_MISMATCH');
  }
  return createSyntheticQaEntitlement({
    scope,
    authority_id: authority.authority_id,
    manifest_version: authority.manifest_version,
    manifest_sha256: authority.manifest_sha256,
    expires_at: authority.access_ends_at,
    as_of: now,
  });
}

/**
 * Assemble an exact-person synthetic QA runtime over the same governed
 * Profile/BOS/BA readers as paid Subscription while preserving separate
 * nonbilling state and history keys.
 */
export function createSyntheticQaSubscriptionV1RuntimeComposition({
  redis,
  env = {},
  winnerAcceptance,
} = {}) {
  requirePinnedPaidWinnerAcceptance(winnerAcceptance);
  if (!redis || typeof redis !== 'object') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_REDIS_REQUIRED');
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
  const readCompletedBosRealization = createRecordedBosRealizationReader({
    realizationStore: bosRealizationStore,
  });
  const providerBoundary = createSyntheticQaProviderBoundary();
  const loadSubscriber = createPaidSubscriberLoader({
    readCompletedRealization,
    readCompletedBosRealization,
    resolveSubscriberAuthority: exactSyntheticQaSubscriberAuthority,
    resolveRuntimeKeys: syntheticQaRuntimeKeys,
    resolveRuntimeRelationshipKey: syntheticQaRuntimeRelationshipKey,
    assertBusinessScope: assertSyntheticQaBusinessScope,
    createTransport: providerBoundary.createTransport,
    syntheticOnly: true,
    loaderId: 'subscription_v1_exact_full_person_synthetic_qa_runtime_loader_v1',
  });

  return createPaidSubscriptionV1RuntimeHandler({
    redis,
    env,
    authenticate: (args) => authenticateSyntheticQaRuntimeRequest({ ...args, env }),
    loadSubscriber,
    resolveEntitlement: resolveSyntheticQaEntitlement,
    resolveKeys: ({ scope }) => syntheticQaRuntimeKeys({ scope }),
    resolveAccessContext: syntheticQaAccessContext,
    projectSuccessfulGet: syntheticQaGetProjection,
    projectFailure: syntheticQaFailureProjection,
    firstSessionSyntheticOnly: true,
    issueCsrf: issueSyntheticQaRuntimeCsrf,
    consumeCsrf: consumeSyntheticQaRuntimeCsrf,
    generateGu: providerBoundary.generateGu,
  });
}
