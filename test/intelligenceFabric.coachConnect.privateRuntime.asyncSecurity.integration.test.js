import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  SyntheticAsyncSecurityStateAdapter,
  createSyntheticAsyncSecurityBackend,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import {
  attachCanonicalBusinessEngine,
  attachExistingCoachConnectRuntime,
  attachExistingSubscriptionRuntime,
  createCanonicalAsyncSecurityServiceV2,
  createCoachConnectPrivateRuntimeBridge,
  createPrivateRuntimeLiveCompositionV2,
  getPrivateRuntimeLiveCompositionV2,
  invokeExistingCoachConnect,
  invokeExistingSubscriptionRuntime,
  validateCompleteAttachmentSet,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  DEFAULT_PRODUCTION_FOUNDATION_FLAGS,
} from '../src/lib/intelligenceFabric/production/activation.js';
import {
  createSubscriberRuntimeService,
} from '../src/lib/intelligenceFabric/production/subscriberService.js';
import {
  DEFAULT_COACH_CONNECT_FLAGS,
} from '../src/lib/intelligenceFabric/coachConnect/activation.js';
import { InMemoryCoachConnectStore } from '../src/lib/intelligenceFabric/coachConnect/inMemoryStore.js';
import { createCoachConnectService } from '../src/lib/intelligenceFabric/coachConnect/service.js';

const now = Date.parse('2026-07-27T21:00:00.000Z');
const environmentId = 'synthetic_async_integration';
const externalSubjectRef = 'verified_external_subject_integration';
const subscriberSubjectRef = 'canonical_subscriber_integration';
const browserHash = 'c'.repeat(64);
const accessCode = 'SUBDEV1';
const scope = {
  tenant_id: 'tenant_synthetic_integration',
  profile_id: 'profile_synthetic_integration',
  business_id: 'business_synthetic_integration',
  subscriber_id: 'subscriber_synthetic_integration',
};
const scopeHash = hashPrivateRuntimeScope(scope);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function initialSnapshot() {
  const mapping = {
    record_version: 'canonical-subject-mapping-v1',
    external_subject_ref: externalSubjectRef,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    mapping_version: 1,
    security_version: 1,
    status: 'ACTIVE',
    subscriber_confirmed: true,
    auto_enrolled: false,
    bound_at: '2026-07-27T20:00:00.000Z',
  };
  return {
    canonical_by_external: [[externalSubjectRef, mapping]],
    canonical_by_scope: [[scopeHash, {
      subscriber_subject_ref: subscriberSubjectRef,
      external_subject_ref: externalSubjectRef,
      exact_scope_hash: scopeHash,
      mapping_version: 1,
      status: 'ACTIVE',
    }]],
    approvals: [[`${subscriberSubjectRef}|${scopeHash}`, {
      record_version: 'private-test-approval-v1',
      approval_ref: 'private_test_approval_integration',
      environment_id: environmentId,
      subscriber_subject_ref: subscriberSubjectRef,
      exact_scope_hash: scopeHash,
      purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
      status: 'ACTIVE',
      issued_at: '2026-07-27T20:00:00.000Z',
      expires_at: '2026-07-27T22:00:00.000Z',
      security_epoch: 1,
    }]],
    security_epochs: [[scopeHash, 1]],
  };
}

function serviceHarness() {
  const backend = createSyntheticAsyncSecurityBackend(initialSnapshot(), { clock: () => now });
  const counters = new Map();
  const makeService = () => createCanonicalAsyncSecurityServiceV2({
    statePort: new SyntheticAsyncSecurityStateAdapter({
      backend,
      environment_id: environmentId,
    }),
    environmentId,
    expectedPrivateAccessCode: accessCode,
    tokenFactory: async (kind) => {
      const count = (counters.get(kind) || 0) + 1;
      counters.set(kind, count);
      return `${kind}_integration_material_${count}`;
    },
    tokenHasher: async (value) => hash(value),
    configuration: {
      enabled: true,
      emergency_disabled: false,
      environment_allowlist: [environmentId],
      subject_allowlist: [subscriberSubjectRef],
      scope_allowlist: [scopeHash],
      pre_auth_ttl_ms: 60_000,
      session_ttl_ms: 30 * 60_000,
      csrf_ttl_ms: 60_000,
      entitlement_ttl_ms: 15 * 60_000,
    },
  });
  return { backend, makeService, service: makeService() };
}

const edgeAttestation = {
  named_identity_verified: true,
  mfa_verified: true,
  public_access: false,
};

async function authenticatedPath(service) {
  const preAuth = await service.beginPreAuth({
    environment_id: environmentId,
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_integration_login',
    edge_attestation: edgeAttestation,
  });
  const authenticated = await service.completeAuthentication({
    environment_id: environmentId,
    pre_auth_token_hash: hash(preAuth.pre_auth_cookie_value),
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_integration_login',
    edge_attestation: edgeAttestation,
    verified_assertion: {
      verification_status: 'VERIFIED',
      named_identity_verified: true,
      mfa_verified: true,
      external_subject_ref: externalSubjectRef,
      exact_scope_hash: scopeHash,
    },
  });
  const context = {
    environment_id: environmentId,
    external_subject_ref: externalSubjectRef,
    session_token_hash: hash(authenticated.session_cookie_value),
    exact_scope_hash: scopeHash,
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_integration_runtime',
    route: '/api/internal/developer-access',
    method: 'POST',
    idempotency_ref: 'integration_entitlement_attempt',
    edge_attestation: edgeAttestation,
  };
  const resolved = await service.resolveAuthenticatedContext(context);
  const eligibility = await service.evaluatePrivateTestEligibility(
    resolved.authenticated_context,
  );
  const csrf = await service.issueCsrfGrant(resolved.authenticated_context, {
    route: context.route,
    method: context.method,
    browser_binding_hash: context.browser_binding_hash,
  });
  const issued = await service.issueTemporaryEntitlement({
    request_context: { ...context, csrf_proof: csrf.csrf_proof },
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  return {
    preAuth,
    authenticated,
    resolved,
    eligibility,
    issued,
    context: {
      ...context,
      entitlement_token_hash: hash(issued.entitlement_cookie_value),
    },
  };
}

function existingRuntimes() {
  const counters = {
    businessEngineLookups: 0,
    stripe: 0,
    provider: 0,
    voice: 0,
    transcript: 0,
    productionPersistence: 0,
  };
  const subscriptionRuntime = createSubscriberRuntimeService({
    adapter: { namespace: 'isolated_synthetic_async_integration' },
    flags: {
      ...DEFAULT_PRODUCTION_FOUNDATION_FLAGS,
      subscriber_runtime_enabled: true,
      tenant_allowlist: [scope.tenant_id],
      profile_allowlist: [scope.profile_id],
      read_only: false,
      synthetic_only: true,
      writes_enabled: true,
      emergency_disabled: false,
    },
    authorizer: () => ({ authorized: true, code: null }),
    clock: () => '2026-07-27T21:05:00.000Z',
    handlers: {
      READ_CURRENT_STATE: () => ({
        canonical_business_engine_ref: 'canonical_business_engine_integration',
        source: 'EXISTING_SUBSCRIBER_RUNTIME',
      }),
    },
  });
  const coachConnectRuntime = createCoachConnectService({
    store: new InMemoryCoachConnectStore(),
    authService: {
      futureCoachAuthDecision: () => ({
        ok: false,
        code: 'NO_COACH_SESSION_IN_SUBSCRIBER_PROJECTION',
        decision: { allowed: false },
      }),
    },
    flags: {
      ...DEFAULT_COACH_CONNECT_FLAGS,
      coach_connect_enabled: true,
      subscriber_projection_enabled: true,
      synthetic_only: true,
      emergency_disabled: false,
    },
    clock: () => '2026-07-27T21:05:00.000Z',
    tokenFactory: () => 'unused_synthetic_integration_material',
    canonicalRuntimeAppend: null,
  });
  const businessEnginePort = {
    async lookupCanonicalBusinessEngine() {
      counters.businessEngineLookups += 1;
      return {
        ok: true,
        engines: [{
          source: 'CANONICAL_BUSINESS_ENGINE',
          exact_scope: scope,
          business_engine_ref: 'canonical_business_engine_integration',
          business_engine_version: 'business_engine_contract_v1',
          business_engine_contract_hash: 'b'.repeat(64),
          write_authorized: false,
        }],
      };
    },
    describeCapability() {
      return {
        canonical_source_only: true,
        read_only: true,
        can_build_engine: false,
        can_persist_engine: false,
        production_connection: false,
      };
    },
  };
  const subscriptionDescriptor = {
    existing_runtime: true,
    subscription_ref: 'subscription_runtime_integration',
    runtime_contract_version: 'subscriber-runtime-service-v1',
    exact_scope: scope,
    production_namespace: false,
    customer_data: false,
    migration: false,
  };
  const coachState = {
    existing_runtime: true,
    runtime_ref: 'coach_connect_runtime_integration',
    exact_scope: scope,
    production_persistence: false,
    transcript_persistence: false,
    live_model_provider: false,
    live_media_provider: false,
    stripe: false,
    relationship_active: false,
    consent_granted: false,
    coach_authenticated: false,
    coach_entitlement_active: false,
    projection_input: {
      confirmation_requests: [],
      governed_updates: [],
    },
    structured_session_input: null,
  };
  return {
    counters,
    subscriptionRuntime,
    coachConnectRuntime,
    businessEnginePort,
    subscriptionDescriptor,
    coachState,
  };
}

function attachmentInput(path, authority) {
  const entitlement = {
    ...path.issued.entitlement,
    status: 'active',
  };
  const request = {
    request_version: 'private-runtime-attachment-request-v1',
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    authenticated_session_ref: path.authenticated.authenticated_session_ref,
    capability_ref: path.issued.entitlement.entitlement_ref,
    exact_scope: scope,
    requested_attachments: ['BUSINESS_ENGINE', 'SUBSCRIPTION_RUNTIME', 'COACH_CONNECT'],
    correlation_id: 'correlation_integration_attachment',
    requested_at: '2026-07-27T21:05:00.000Z',
  };
  const capability = {
    envelope_version: 'private-runtime-capability-v1',
    capability_id: request.capability_ref,
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    authenticated_session_ref: request.authenticated_session_ref,
    subject_security_version: 1,
    session_epoch: 1,
    browser_binding_hash: browserHash,
    exact_scope_hash: scopeHash,
    entitlement_source: 'temporary_internal_subscription_entitlement',
    allowed_runtime_actions: [
      'BUSINESS_ENGINE_READ',
      'READ_CURRENT_STATE',
      'SUBSCRIBER_PROJECTION',
    ],
    issued_at: path.issued.entitlement.issued_at,
    expires_at: path.issued.entitlement.expires_at,
    status: 'ACTIVE',
    stripe_authority: false,
    billing_authority: false,
    operator_authority: false,
    deployment_authority: false,
    coach_authority: false,
    canonical_mutation_authority: false,
  };
  return {
    request,
    edgeAttestation,
    authority,
    subjectReceipt: {
      subject_receipt_version: 'private-runtime-subject-receipt-v1',
      subscriber_subject_ref: subscriberSubjectRef,
      exact_scope_hash: scopeHash,
    },
    sessionReceipt: {
      session_receipt_version: 'private-runtime-session-receipt-v1',
      subscriber_subject_ref: subscriberSubjectRef,
      authenticated_session_ref: request.authenticated_session_ref,
    },
    capability,
    entitlement,
  };
}

function createOfflineAttachmentBridge(runtimes) {
  return {
    async attach(input) {
      const attachedAt = '2026-07-27T21:05:01.000Z';
      const businessEngine = await attachCanonicalBusinessEngine({
        port: runtimes.businessEnginePort,
        request: input.request,
        authority: input.authority,
        subjectReceipt: input.subjectReceipt,
        attachedAt,
      });
      if (!businessEngine.ok) return businessEngine;
      const subscription = attachExistingSubscriptionRuntime({
        request: input.request,
        authority: input.authority,
        businessEngineReceipt: businessEngine.receipt,
        entitlement: input.entitlement,
        runtime: runtimes.subscriptionRuntime,
        subscription: runtimes.subscriptionDescriptor,
        attachedAt,
      });
      if (!subscription.ok) return subscription;
      const coach = attachExistingCoachConnectRuntime({
        request: input.request,
        authority: input.authority,
        businessEngineReceipt: businessEngine.receipt,
        subscriptionAttachment: subscription,
        runtime: runtimes.coachConnectRuntime,
        coachState: runtimes.coachState,
        attachedAt,
      });
      if (!coach.ok) return coach;
      const attachmentSet = validateCompleteAttachmentSet({
        environmentId,
        subjectReceipt: input.subjectReceipt,
        sessionReceipt: input.sessionReceipt,
        capability: input.capability,
        businessEngineReceipt: businessEngine.receipt,
        subscriptionReceipt: subscription.receipt,
        coachConnectReceipt: coach.receipt,
        createdAt: attachedAt,
        expiresAt: input.capability.expires_at,
      });
      if (!attachmentSet.ok) return attachmentSet;
      return {
        ok: true,
        allowed: true,
        runtime_ready: true,
        attachment_set: attachmentSet.receipt,
        business_engine_attachment: businessEngine.receipt,
        subscription_runtime_attachment: subscription.receipt,
        coach_connect_attachment: coach.receipt,
        runtime_handles: {
          subscription,
          coach_connect: coach,
        },
        duplicate_runtime_created: false,
      };
    },
  };
}

test('ordered V2 path resolves one subject and issues authority only after entitlement', async () => {
  const { service, backend } = serviceHarness();
  const path = await authenticatedPath(service);
  assert.equal(path.preAuth.authority_granted, false);
  assert.equal(path.resolved.canonical_subject.subscriber_subject_ref, subscriberSubjectRef);
  assert.equal(path.resolved.canonical_subject.auto_enrolled, false);
  assert.equal(path.eligibility.runtime_access, false);
  assert.equal(path.issued.allowed, true);
  const authority = await service.evaluatePrivateRuntimeAuthority({
    request_context: path.context,
    requested_runtime: 'BUSINESS_ENGINE',
    requested_action: 'attach_existing_private_runtime',
  });
  assert.equal(authority.allowed, true);
  assert.equal(authority.deployment_grade_security_state, false);
  assert.equal(backend.canonical_by_external.size, 1);
  assert.equal(backend.canonical_by_scope.size, 1);
  assert.equal(backend.entitlements_by_ref.size, 1);
});

test('offline synthetic composition attaches one engine and both existing runtimes once', async () => {
  const { service } = serviceHarness();
  const path = await authenticatedPath(service);
  const runtimes = existingRuntimes();
  const bridge = createOfflineAttachmentBridge(runtimes);
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService: service,
    activationDecision: async () => ({ ok: true, allowed: true }),
    resolveRequestContext: async () => ({ ok: true, value: path.context }),
    resolveBridgeInput: async ({ authority }) => ({
      ok: true,
      value: attachmentInput(path, authority),
    }),
    privateRuntimeBridge: bridge,
  });
  const attached = await composition.operations.bootstrap({ method: 'POST' });
  assert.equal(attached.ok, true);
  assert.equal(attached.runtime_ready, true);
  assert.equal(attached.attachment_set.business_engine_count, 1);
  assert.equal(attached.duplicate_runtime_created, false);
  assert.equal(runtimes.counters.businessEngineLookups, 1);
  assert.equal(attached.subscription_runtime_attachment.paid_entitlement, false);
  assert.equal(attached.coach_connect_attachment.live_voice_video, false);
  assert.equal(attached.coach_connect_attachment.transcript_persistence, false);
});

test('existing Subscription Runtime and text Coach Connect interactions remain noncanonical', async () => {
  const { service } = serviceHarness();
  const path = await authenticatedPath(service);
  const authority = await service.evaluatePrivateRuntimeAuthority({
    request_context: path.context,
    requested_runtime: 'BUSINESS_ENGINE',
    requested_action: 'attach_existing_private_runtime',
  });
  const runtimes = existingRuntimes();
  const attached = await createOfflineAttachmentBridge(runtimes)
    .attach(attachmentInput(path, authority));
  const subscription = await invokeExistingSubscriptionRuntime({
    attachment: attached.runtime_handles.subscription,
    request: attachmentInput(path, authority).request,
    action: 'READ_CURRENT_STATE',
  });
  const coach = await invokeExistingCoachConnect({
    attachment: attached.runtime_handles.coach_connect,
    action: 'SUBSCRIBER_PROJECTION',
  });
  assert.equal(subscription.ok, true);
  assert.equal(subscription.result.value.source, 'EXISTING_SUBSCRIBER_RUNTIME');
  assert.equal(subscription.interaction.canonical_mutation_performed, false);
  assert.equal(coach.ok, true);
  assert.equal(coach.interaction.canonical_mutation_performed, false);
});

test('the existing live bridge refuses synthetic authority without remote adapter relabeling', async () => {
  const { service } = serviceHarness();
  const path = await authenticatedPath(service);
  const authority = await service.evaluatePrivateRuntimeAuthority({
    request_context: path.context,
    requested_runtime: 'BUSINESS_ENGINE',
    requested_action: 'attach_existing_private_runtime',
  });
  const runtimes = existingRuntimes();
  const directBridge = createCoachConnectPrivateRuntimeBridge({
    businessEnginePort: runtimes.businessEnginePort,
    subscriptionRuntime: runtimes.subscriptionRuntime,
    subscriptionDescriptor: runtimes.subscriptionDescriptor,
    coachConnectRuntime: runtimes.coachConnectRuntime,
    resolveEntitlement: async () => ({
      allowed: true,
      entitlement: attachmentInput(path, authority).entitlement,
    }),
    resolveCoachState: async () => runtimes.coachState,
    clock: () => '2026-07-27T21:05:01.000Z',
  });
  const denied = await directBridge.attach(attachmentInput(path, authority));
  assert.equal(authority.deployment_grade_security_state, false);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'SESSION_ELEVATION_REQUIRED');
});

test('restart preserves authority while cross-subscriber, logout, outage, and emergency deny', async () => {
  const harness = serviceHarness();
  const path = await authenticatedPath(harness.service);
  const restarted = harness.makeService();
  assert.equal((await restarted.inspectRecovery({
    request_context: path.context,
    requested_runtime: 'SUBSCRIPTION_RUNTIME',
    requested_action: 'continue_session',
  })).allowed, true);
  assert.equal((await restarted.evaluatePrivateRuntimeAuthority({
    request_context: {
      ...path.context,
      external_subject_ref: 'different_external_subject',
    },
    requested_runtime: 'COACH_CONNECT',
    requested_action: 'send_text',
  })).allowed, false);
  await restarted.logout({ request_context: path.context });
  assert.equal((await restarted.evaluatePrivateRuntimeAuthority({
    request_context: path.context,
    requested_runtime: 'COACH_CONNECT',
    requested_action: 'send_text',
  })).allowed, false);
  harness.backend.availability = 'UNAVAILABLE';
  assert.equal((await restarted.health()).allowed, false);
  const emergency = createCanonicalAsyncSecurityServiceV2({
    statePort: new SyntheticAsyncSecurityStateAdapter({
      backend: harness.backend,
      environment_id: environmentId,
    }),
    environmentId,
    configuration: {
      enabled: true,
      emergency_disabled: true,
      environment_allowlist: [environmentId],
      subject_allowlist: [subscriberSubjectRef],
      scope_allowlist: [scopeHash],
    },
  });
  assert.equal((await emergency.resolveAuthenticatedContext(path.context)).code, 'EMERGENCY_DISABLED');
});

test('source default stays off and all prohibited external/runtime counters remain zero', async () => {
  const defaultComposition = getPrivateRuntimeLiveCompositionV2();
  assert.equal((await defaultComposition.operations.bootstrap({ method: 'POST' })).allowed, false);
  const runtimes = existingRuntimes();
  assert.deepEqual(runtimes.counters, {
    businessEngineLookups: 0,
    stripe: 0,
    provider: 0,
    voice: 0,
    transcript: 0,
    productionPersistence: 0,
  });
});

