import { sameScope } from '../../../src/lib/subscriptionV1/contracts.js';
import { createPaidSubscriptionV1RuntimeHandler } from './paidRuntimeHandler.js';
import { createPaidSubscriberLoader } from './paidSubscriberLoader.js';
import {
  pinnedLoanOriginatorSubscriptionSources,
  pinnedSubscriptionSources,
} from './pinnedSources.js';
import {
  authenticateSyntheticQaRuntimeRequest,
  syntheticQaAccessContext,
  syntheticQaRuntimeCustodySnapshot,
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

import { createSyntheticQaProviderBoundary } from './syntheticQaProviderBoundary.js';
export { createSyntheticQaProviderBoundary, syntheticQaProviderEnabled } from './syntheticQaProviderBoundary.js';

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

export function resolveSyntheticQaSourceLibrary({ projection } = {}) {
  if (projection?.synthetic_only !== true) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_SOURCE_SCOPE_REQUIRED');
  }
  if (projection.doctrine_vertical_id === 'REAL_ESTATE') {
    return pinnedSubscriptionSources();
  }
  if (projection.doctrine_vertical_id === 'LOAN_ORIGINATOR') {
    return pinnedLoanOriginatorSubscriptionSources();
  }
  throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_SOURCE_VERTICAL_UNSUPPORTED');
}

function exactSyntheticQaCustodySnapshot(membershipContext) {
  const snapshot = syntheticQaRuntimeCustodySnapshot(membershipContext);
  if (!snapshot
    || snapshot.byte_stable_across_reads !== true
    || snapshot.read_only !== true
    || snapshot.mutation_performed !== false) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_SNAPSHOT_REQUIRED');
  }
  return snapshot;
}

async function readSyntheticQaCanonicalProfile({ membership_context } = {}) {
  return exactSyntheticQaCustodySnapshot(membership_context).profile_lookup;
}

async function readSyntheticQaCompletedRealization({ profile_id, membership_context } = {}) {
  const snapshot = exactSyntheticQaCustodySnapshot(membership_context);
  if (snapshot.profile_id.toUpperCase() !== String(profile_id || '').toUpperCase()) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_PROFILE_MISMATCH');
  }
  return snapshot.realization_record;
}

async function readSyntheticQaRecordedBosRealization({
  profile_id,
  realization_id,
  membership_context,
} = {}) {
  const snapshot = exactSyntheticQaCustodySnapshot(membership_context);
  if (snapshot.profile_id.toUpperCase() !== String(profile_id || '').toUpperCase()
    || snapshot.bos_realization_record?.realization_id !== realization_id) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_BOS_MISMATCH');
  }
  return snapshot.bos_realization_record;
}

export function createSyntheticQaCustodyReaders() {
  return Object.freeze({
    readCanonicalProfile: readSyntheticQaCanonicalProfile,
    readCompletedRealization: readSyntheticQaCompletedRealization,
    readCompletedBosRealization: readSyntheticQaRecordedBosRealization,
  });
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
  const providerBoundary = createSyntheticQaProviderBoundary({ redis, env, winnerAcceptance });
  const custodyReaders = createSyntheticQaCustodyReaders();
  const loadSubscriber = createPaidSubscriberLoader({
    ...custodyReaders,
    resolveSubscriberAuthority: exactSyntheticQaSubscriberAuthority,
    resolveRuntimeKeys: syntheticQaRuntimeKeys,
    resolveRuntimeRelationshipKey: syntheticQaRuntimeRelationshipKey,
    assertBusinessScope: assertSyntheticQaBusinessScope,
    createTransport: providerBoundary.createTransport,
    resolveSourceLibrary: resolveSyntheticQaSourceLibrary,
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
