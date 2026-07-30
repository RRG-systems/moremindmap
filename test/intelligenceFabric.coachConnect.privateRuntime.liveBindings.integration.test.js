import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanonicalBusinessEngineLiveAttachmentAdapterV1,
  createExistingCoachConnectLiveAttachmentAdapterV1,
  createExistingSubscriptionRuntimeLiveAttachmentAdapterV1,
  createPrivateRuntimeLiveAttachmentCoordinatorV1,
  privateRuntimeProductBindingDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import {
  createPrivateRuntimeLiveCompositionV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const environmentId = 'PRIVATE_PREVIEW';
const subjectRef = 'subscriber_subject_integration_live';
const sessionRef = 'authenticated_session_integration_live';
const entitlementRef = 'temporary_entitlement_integration_live';
const scope = {
  tenant_id: 'tenant_integration_live',
  profile_id: 'profile_integration_live',
  business_id: 'business_integration_live',
  subscriber_id: 'subscriber_integration_live',
};
const scopeHash = hashPrivateRuntimeScope(scope);
const evaluatedAt = '2026-07-28T12:00:00.000Z';
const expiresAt = '2026-07-28T13:00:00.000Z';
const edgeAttestation = {
  named_identity_verified: true,
  mfa_verified: true,
  public_access: false,
};

function productBinding({ includeCoach = true } = {}) {
  const value = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: environmentId,
    subscriber_subject_ref: subjectRef,
    exact_scope: scope,
    exact_scope_hash: scopeHash,
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_integration_live',
      business_engine_version: 'business_engine_v1',
      business_engine_contract_hash: '8'.repeat(64),
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_integration_live',
      runtime_contract_version: 'subscriber-runtime-service-v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coach_connect_runtime: includeCoach ? {
      existing_runtime: true,
      runtime_ref: 'coach_connect_integration_live',
      exact_scope: scope,
      relationship_ref: 'relationship_integration_live',
      consent_ref: 'consent_integration_live',
      coach_identity_ref: 'coach_identity_integration_live',
      text_only: true,
      production_persistence: false,
      transcript_persistence: false,
      live_model_provider: false,
      live_media_provider: false,
      stripe: false,
      canonical_mutation_authority: false,
    } : null,
    issued_at: '2026-07-28T10:00:00.000Z',
    review_due_at: '2026-08-28T10:00:00.000Z',
    binding_sha256: '0'.repeat(64),
  };
  return { ...value, binding_sha256: privateRuntimeProductBindingDigest(value) };
}

function authority() {
  return {
    ok: true,
    allowed: true,
    environment_id: environmentId,
    subscriber_subject_ref: subjectRef,
    authenticated_session_ref: sessionRef,
    entitlement_ref: entitlementRef,
    exact_scope_hash: scopeHash,
    security_epoch: 1,
    requested_runtime: 'BUSINESS_ENGINE',
    requested_action: 'attach_existing_private_runtime',
    evaluated_at: evaluatedAt,
    expires_at: expiresAt,
    deployment_grade_security_state: true,
    no_local_fallback: true,
    shared_state_evidence_class: 'FUTURE_PRIVATE_LIVE',
    admin_authority: false,
    operator_authority: false,
    deployment_authority: false,
    billing_authority: false,
    coach_authority: false,
    canonical_mutation_authority: false,
    authority_fingerprint: '9'.repeat(64),
  };
}

function service({ currentAuthority = authority() } = {}) {
  return {
    async describe() {
      return {
        ok: true,
        allowed: false,
        capability: {
          deployment_grade: true,
          live_connection_verified: true,
          no_local_fallback: true,
        },
      };
    },
    async health() { return { ok: true, allowed: true }; },
    async beginPreAuth() { return { ok: false, allowed: false }; },
    async completeAuthentication() { return { ok: false, allowed: false }; },
    async resolveAuthenticatedContext() {
      return {
        ok: true,
        allowed: true,
        canonical_subject: {
          subscriber_subject_ref: subjectRef,
          exact_scope_hash: scopeHash,
          auto_enrolled: false,
          receipt_ref: 'subject_receipt_integration_live',
        },
        authenticated_context: {
          subject_security_version: 1,
          session_epoch: 1,
          browser_binding_hash: '7'.repeat(64),
        },
      };
    },
    async evaluatePrivateTestEligibility() { return { ok: true, allowed: true }; },
    async issueCsrfGrant() { return { ok: true, allowed: true }; },
    async issueTemporaryEntitlement() { return { ok: true, allowed: true }; },
    async inspectTemporaryEntitlement() {
      return {
        ok: true,
        allowed: true,
        entitlement: {
          record_version: 'temporary-private-entitlement-v2',
          entitlement_ref: entitlementRef,
          status: 'ACTIVE',
          temporary: true,
          paid_entitlement: false,
          billing_evidence: false,
          stripe_subscription_created: false,
          canonical_mutation_authority: false,
          issued_at: evaluatedAt,
          expires_at: expiresAt,
        },
      };
    },
    async evaluatePrivateRuntimeAuthority() { return currentAuthority; },
    async revokeTemporaryEntitlement() { return { ok: true, allowed: false }; },
    async logout() { return { ok: true, allowed: false }; },
    async inspectRecovery() { return { ok: true, allowed: true }; },
  };
}

function bridgeInput(authorityDecision, { includeCoach = true } = {}) {
  return {
    request: {
      request_version: 'private-runtime-attachment-request-v1',
      environment_id: environmentId,
      subscriber_subject_ref: subjectRef,
      authenticated_session_ref: sessionRef,
      capability_ref: entitlementRef,
      exact_scope: scope,
      requested_attachments: [
        'BUSINESS_ENGINE',
        'SUBSCRIPTION_RUNTIME',
        ...(includeCoach ? ['COACH_CONNECT'] : []),
      ],
      correlation_id: 'correlation_integration_live',
      requested_at: evaluatedAt,
    },
    edgeAttestation,
    authority: authorityDecision,
    subjectReceipt: {
      subject_receipt_version: 'private-runtime-subject-receipt-v1',
      subscriber_subject_ref: subjectRef,
      exact_scope_hash: scopeHash,
    },
    sessionReceipt: {
      session_receipt_version: 'private-runtime-session-receipt-v1',
      subscriber_subject_ref: subjectRef,
      authenticated_session_ref: sessionRef,
    },
    capability: {
      envelope_version: 'private-runtime-capability-v1',
      capability_id: entitlementRef,
      environment_id: environmentId,
      subscriber_subject_ref: subjectRef,
      authenticated_session_ref: sessionRef,
      subject_security_version: 1,
      session_epoch: 1,
      browser_binding_hash: '7'.repeat(64),
      exact_scope_hash: scopeHash,
      entitlement_source: 'temporary_internal_subscription_entitlement',
      allowed_runtime_actions: [
        'BUSINESS_ENGINE_READ',
        'SUBSCRIPTION_INTERACTION',
        'COACH_CONNECT_SUBSCRIBER',
      ],
      issued_at: evaluatedAt,
      expires_at: expiresAt,
      status: 'ACTIVE',
      stripe_authority: false,
      billing_authority: false,
      operator_authority: false,
      deployment_authority: false,
      coach_authority: false,
      canonical_mutation_authority: false,
    },
    entitlement: {
      access_type: 'more_monthly_intelligence',
      status: 'active',
      source: 'temporary_internal_subscription_entitlement',
      temporary: true,
      expires_at: expiresAt,
      billing_evidence: false,
      paid_entitlement: false,
      stripe_subscription_created: false,
      canonical_mutation_authority: false,
    },
  };
}

function coordinator(binding = productBinding()) {
  return createPrivateRuntimeLiveAttachmentCoordinatorV1({
    businessEngineAdapter: createCanonicalBusinessEngineLiveAttachmentAdapterV1({
      productBindingAttestation: binding,
      nowMs: Date.parse(evaluatedAt),
    }),
    subscriptionRuntimeAdapter:
      createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
        productBindingAttestation: binding,
        nowMs: Date.parse(evaluatedAt),
      }),
    coachConnectAdapter: binding.coach_connect_runtime
      ? createExistingCoachConnectLiveAttachmentAdapterV1({
        productBindingAttestation: binding,
        nowMs: Date.parse(evaluatedAt),
      })
      : null,
    clock: () => '2026-07-28T12:00:01.000Z',
  });
}

test('one authorized bootstrap attaches one engine and both existing runtimes', async () => {
  let bridgeInputs = 0;
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: service(),
    privateRuntimeBridge: coordinator(),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: {
        correlation_ref: 'correlation_integration_live',
        edge_attestation: edgeAttestation,
      },
    }),
    resolveBridgeInput: async ({ authority: decision }) => {
      bridgeInputs += 1;
      return { ok: true, allowed: false, value: bridgeInput(decision) };
    },
  });
  const result = await composition.operations.bootstrap({ method: 'POST' });
  assert.equal(result.ok, true);
  assert.equal(result.runtime_ready, true);
  assert.equal(result.attachment_set.business_engine_count, 1);
  assert.equal(result.duplicate_runtime_created, false);
  assert.equal(result.subscription_runtime_attachment.paid_entitlement, false);
  assert.equal(result.coach_connect_attachment.live_voice_video, false);
  assert.equal(result.coach_connect_attachment.transcript_persistence, false);
  assert.equal(bridgeInputs, 1);
});

test('subscriber runtime attaches and becomes ready without Coach Connect', async () => {
  const binding = productBinding({ includeCoach: false });
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: service(),
    privateRuntimeBridge: coordinator(binding),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: {
        correlation_ref: 'correlation_subscriber_only',
        edge_attestation: edgeAttestation,
      },
    }),
    resolveBridgeInput: async ({ authority: decision }) => ({
      ok: true,
      allowed: false,
      value: bridgeInput(decision, { includeCoach: false }),
    }),
  });
  const result = await composition.operations.bootstrap({ method: 'POST' });
  assert.equal(result.ok, true);
  assert.equal(result.runtime_ready, true);
  assert.equal(result.business_engine_attachment.duplicate_engine_created, false);
  assert.equal(result.subscription_runtime_attachment.paid_entitlement, false);
  assert.equal(result.coach_connect_attachment, null);
  assert.equal(result.coach_connect_attached, false);
  assert.equal(result.attachment_set.coach_connect_attachment_ref, null);
  assert.equal(result.attachment_set.coach_connect_attached, false);
});

test('requesting Coach Connect without a configured Coach adapter fails closed', async () => {
  const binding = productBinding({ includeCoach: false });
  const result = await coordinator(binding).attach(bridgeInput(authority()));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'COACH_CONNECT_STATE_MISSING');
  assert.equal(result.runtime_ready, false);
  assert.equal(result.partial_handles_discarded, true);
});

test('concurrent exact-authority bootstraps publish one attachment result', async () => {
  let bridgeInputs = 0;
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: service(),
    privateRuntimeBridge: coordinator(),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: { edge_attestation: edgeAttestation },
    }),
    resolveBridgeInput: async ({ authority: decision }) => {
      bridgeInputs += 1;
      return { ok: true, allowed: false, value: bridgeInput(decision) };
    },
  });
  const [first, second] = await Promise.all([
    composition.operations.bootstrap({ method: 'POST' }),
    composition.operations.bootstrap({ method: 'POST' }),
  ]);
  assert.equal(first.attachment_set.attachment_set_id, second.attachment_set.attachment_set_id);
  assert.equal(bridgeInputs, 1);
});

test('authority fingerprint change during attachment discards publication', async () => {
  let evaluations = 0;
  const canonical = service();
  canonical.evaluatePrivateRuntimeAuthority = async () => {
    evaluations += 1;
    return {
      ...authority(),
      authority_fingerprint: evaluations === 1 ? '9'.repeat(64) : '8'.repeat(64),
    };
  };
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: canonical,
    privateRuntimeBridge: coordinator(),
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({
      ok: true,
      allowed: false,
      value: { edge_attestation: edgeAttestation },
    }),
    resolveBridgeInput: async ({ authority: decision }) => ({
      ok: true,
      allowed: false,
      value: bridgeInput(decision),
    }),
  });
  const result = await composition.operations.bootstrap({ method: 'POST' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'RUNTIME_AUTHORITY_DENIED');
});

test('coordinator rejects missing protected-edge proof and leaves no partial handles', async () => {
  const input = bridgeInput(authority());
  input.edgeAttestation = { ...edgeAttestation, mfa_verified: false };
  const result = await coordinator().attach(input);
  assert.equal(result.ok, false);
  assert.equal(result.partial_handles_discarded, true);
  assert.equal(result.runtime_ready, false);
});

test('attachment path creates no Stripe, voice, transcript, or product persistence authority', async () => {
  const result = await coordinator().attach(bridgeInput(authority()));
  assert.equal(result.ok, true);
  assert.equal(result.subscription_runtime_attachment.stripe_authority, false);
  assert.equal(result.coach_connect_attachment.live_billing, false);
  assert.equal(result.coach_connect_attachment.live_voice_video, false);
  assert.equal(result.coach_connect_attachment.transcript_persistence, false);
  assert.equal(result.product_state_owned, false);
});
