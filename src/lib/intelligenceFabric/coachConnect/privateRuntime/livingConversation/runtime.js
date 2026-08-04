import { hashCanonicalJson } from '../../../hashing.js';
import { runGovernedModelMembrane } from '../../../production/modelMembrane.js';
import { deepFreeze } from '../../../validation.js';
import { assembleLivingConversationContextV1 } from './contextAssembler.js';
import {
  createLivingConversationRequestV1,
  createLivingConversationResponseV1,
  livingConversationResponseMatchesScope,
} from './contracts.js';
import {
  livingConversationProviderRetentionReceipt,
} from './providerBinding.js';

export const LIVING_CONVERSATION_RUNTIME_VERSION =
  'living-conversation-runtime-v1';

const frozen = (value) => deepFreeze(structuredClone(value));

export function createLivingConversationRuntimeV1({
  provider,
  providerBinding,
  expectedExactScopeHash = null,
  approvedProfileCohortSha256 = null,
  clock = () => Date.now(),
} = {}) {
  const exactProviderScope = providerBinding?.scope_mode === 'EXACT_PROFILE'
    && providerBinding.exact_scope_hash === expectedExactScopeHash
    && providerBinding.approved_profile_cohort_sha256 == null;
  const cohortProviderScope = providerBinding?.scope_mode === 'APPROVED_PROFILE_COHORT'
    && providerBinding.exact_scope_hash == null
    && providerBinding.approved_profile_cohort_sha256 === approvedProfileCohortSha256;
  const providerRetentionReceipt = livingConversationProviderRetentionReceipt(
    providerBinding?.provider_data_retention_mode,
  );
  const configured = provider != null
    && typeof provider.propose === 'function'
    && providerBinding?.enabled === true
    && providerBinding.allowed_purposes?.includes('CONVERSATION_PLAN_PROPOSAL')
    && providerRetentionReceipt != null
    && (exactProviderScope || cohortProviderScope);

  async function converse({
    input,
    exactScope,
    subscriberSubjectRef,
    dossier,
    businessEngineContract,
    snapshot,
    traceId,
    exactScopeHash,
  } = {}) {
    if (!configured || !Number.isFinite(Date.parse(providerBinding?.review_due_at))
      || Date.parse(providerBinding.review_due_at) <= clock()) {
      return frozen({
        ok: false,
        code: 'LIVING_CONVERSATION_PROVIDER_DISABLED',
        provider_calls: 0,
      });
    }
    const requestResult = createLivingConversationRequestV1({
      input,
      exactScope,
      subscriberSubjectRef,
    });
    if (!requestResult.valid) {
      return frozen({
        ok: false,
        code: requestResult.errors[0]?.code || 'LIVING_CONVERSATION_REQUEST_INVALID',
        provider_calls: 0,
      });
    }
    const contextResult = assembleLivingConversationContextV1({
      dossier,
      businessEngineContract,
      snapshot,
      exactScope,
      expectedScopeHash: exactScopeHash,
    });
    if (!contextResult.ok) return contextResult;
    const request = requestResult.value;
    const membraneResult = await runGovernedModelMembrane({
      provider,
      feature_flags: { model_provider_enabled: true },
      request: {
        request_id: request.request_id,
        trace_id: traceId,
        tenant_id: exactScope.tenant_id,
        profile_id: exactScope.profile_id,
        business_id: exactScope.business_id,
        purpose: 'CONVERSATION_PLAN_PROPOSAL',
        prompt_id: 'more-living-business-conversation',
        prompt_version: '1.0.0',
        user_input: request.statement,
      },
      context: contextResult.context,
      retry_policy: { max_attempts: 1 },
    });
    if (!membraneResult.ok) {
      return frozen({
        ok: false,
        code: 'LIVING_CONVERSATION_PROVIDER_FAILURE',
        failure_class: membraneResult.code || 'PROVIDER_ERROR',
        decision: membraneResult.decision,
        provider_calls: membraneResult.provider_calls,
      });
    }
    const responseResult = createLivingConversationResponseV1({
      request,
      providerPayload: membraneResult.proposal?.payload,
      modelReceipt: membraneResult.receipt,
      contextReceipt: contextResult.receipt,
      referenceRegistry: contextResult.reference_registry,
      providerRetentionMode: providerRetentionReceipt,
    });
    if (!responseResult.valid
      || !livingConversationResponseMatchesScope(responseResult.value, exactScope)) {
      return frozen({
        ok: false,
        code: responseResult.errors[0]?.code || 'LIVING_CONVERSATION_RESPONSE_INVALID',
        provider_calls: provider.calls ?? null,
      });
    }
    return frozen({
      ok: true,
      allowed: true,
      status: 200,
      runtime_ready: true,
      conversation: responseResult.value,
      receipt: {
        runtime_version: LIVING_CONVERSATION_RUNTIME_VERSION,
        request_hash: hashCanonicalJson({
          request_id: request.request_id,
          session_id: request.session_id,
          turn_id: request.turn_id,
          exact_scope_hash: responseResult.value.exact_scope_hash,
        }),
        proposal_only: true,
        canonical_mutation_performed: false,
        event_appended: false,
        projection_appended: false,
        internal_transcript_persisted: false,
        internal_conversation_content_persisted: false,
        provider_retention_mode: providerRetentionReceipt,
        provider_attempts: 1,
      },
    });
  }

  return Object.freeze({
    runtime_version: LIVING_CONVERSATION_RUNTIME_VERSION,
    configured,
    source_default_off: true,
    private_beta_only: true,
    public_access: false,
    transcript_persistence: false,
    canonical_mutation: false,
    converse,
  });
}
