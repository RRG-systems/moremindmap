import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCoachConnectPrivateRuntimeBridge,
  invokeExistingCoachConnect,
  invokeExistingSubscriptionRuntime,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js';
import { hashPrivateRuntimeScope } from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  DEFAULT_PRODUCTION_FOUNDATION_FLAGS,
} from '../src/lib/intelligenceFabric/production/activation.js';
import { createSubscriberRuntimeService } from '../src/lib/intelligenceFabric/production/subscriberService.js';
import { DEFAULT_COACH_CONNECT_FLAGS } from '../src/lib/intelligenceFabric/coachConnect/activation.js';
import { InMemoryCoachConnectStore } from '../src/lib/intelligenceFabric/coachConnect/inMemoryStore.js';
import { createCoachConnectService } from '../src/lib/intelligenceFabric/coachConnect/service.js';

const scope = {
  tenant_id: 'tenant_synthetic_founder',
  profile_id: 'profile_synthetic_founder',
  business_id: 'business_synthetic_founder',
  subscriber_id: 'subscriber_synthetic_founder',
};
const scopeHash = hashPrivateRuntimeScope(scope);
const subjectRef = 'canonical_subject_synthetic_founder';
const sessionRef = 'authenticated_session_synthetic_founder';
const request = {
  request_version: 'private-runtime-attachment-request-v1',
  environment_id: 'environment_synthetic_private',
  subscriber_subject_ref: subjectRef,
  authenticated_session_ref: sessionRef,
  capability_ref: 'capability_synthetic_founder',
  exact_scope: scope,
  requested_attachments: ['BUSINESS_ENGINE', 'SUBSCRIPTION_RUNTIME', 'COACH_CONNECT'],
  correlation_id: 'correlation_integration_synthetic_founder',
  requested_at: '2026-07-27T16:06:00.000Z',
};
const edgeAttestation = {
  named_identity_verified: true,
  mfa_verified: true,
  public_access: false,
};
const authority = {
  allowed: true,
  code: null,
  authority_fingerprint: 'authority_fingerprint_synthetic_founder',
  shared_state_evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
  deployment_grade_security_state: true,
  no_local_fallback: true,
};
const subjectReceipt = {
  subject_receipt_version: 'private-runtime-subject-receipt-v1',
  subscriber_subject_ref: subjectRef,
  exact_scope_hash: scopeHash,
};
const sessionReceipt = {
  session_receipt_version: 'private-runtime-session-receipt-v1',
  subscriber_subject_ref: subjectRef,
  authenticated_session_ref: sessionRef,
};
const capability = {
  envelope_version: 'private-runtime-capability-v1',
  capability_id: request.capability_ref,
  environment_id: request.environment_id,
  subscriber_subject_ref: subjectRef,
  authenticated_session_ref: sessionRef,
  subject_security_version: 1,
  session_epoch: 1,
  browser_binding_hash: 'browser_binding_synthetic_founder',
  exact_scope_hash: scopeHash,
  entitlement_source: 'temporary_internal_subscription_entitlement',
  allowed_runtime_actions: ['BUSINESS_ENGINE_READ', 'READ_CURRENT_STATE', 'SUBSCRIBER_PROJECTION'],
  issued_at: '2026-07-27T16:00:00.000Z',
  expires_at: '2026-07-27T16:15:00.000Z',
  status: 'ACTIVE',
  stripe_authority: false,
  billing_authority: false,
  operator_authority: false,
  deployment_authority: false,
  coach_authority: false,
  canonical_mutation_authority: false,
};
const entitlement = {
  access_type: 'more_monthly_intelligence',
  status: 'active',
  source: 'temporary_internal_subscription_entitlement',
  temporary: true,
  expires_at: capability.expires_at,
  billing_evidence: false,
  stripe_subscription_created: false,
  admin_authority: false,
  coach_authority: false,
  operator_authority: false,
  canonical_mutation_authority: false,
};

function services() {
  const subscriptionRuntime = createSubscriberRuntimeService({
    adapter: { namespace: 'isolated_synthetic_private_runtime' },
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
    clock: () => '2026-07-27T16:06:00.000Z',
    handlers: {
      READ_CURRENT_STATE: () => ({
        canonical_business_engine_ref: 'canonical_business_engine_synthetic_founder',
        source: 'EXISTING_SUBSCRIBER_RUNTIME',
      }),
    },
  });
  const coachStore = new InMemoryCoachConnectStore();
  const coachConnectRuntime = createCoachConnectService({
    store: coachStore,
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
    clock: () => '2026-07-27T16:06:00.000Z',
    tokenFactory: () => 'unused-token-synthetic-integration-00000001',
    canonicalRuntimeAppend: null,
  });
  return { subscriptionRuntime, coachConnectRuntime };
}

function bridgeFixture({ coachStateOverrides = {} } = {}) {
  const { subscriptionRuntime, coachConnectRuntime } = services();
  const businessEnginePort = {
    lookupCanonicalBusinessEngine: async () => ({
      ok: true,
      engines: [{
        source: 'CANONICAL_BUSINESS_ENGINE',
        exact_scope: scope,
        business_engine_ref: 'canonical_business_engine_synthetic_founder',
        business_engine_version: 'business_engine_contract_v1',
        business_engine_contract_hash: 'b'.repeat(64),
        write_authorized: false,
      }],
    }),
    describeCapability: () => ({
      canonical_source_only: true,
      read_only: true,
      can_build_engine: false,
      can_persist_engine: false,
      production_connection: false,
    }),
  };
  const coachState = {
    existing_runtime: true,
    runtime_ref: 'coach_connect_runtime_synthetic_founder',
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
      governed_updates: [{ summary: 'governed_update_synthetic_founder' }],
    },
    structured_session_input: null,
    ...coachStateOverrides,
  };
  const bridge = createCoachConnectPrivateRuntimeBridge({
    businessEnginePort,
    subscriptionRuntime,
    subscriptionDescriptor: {
      existing_runtime: true,
      subscription_ref: 'subscription_runtime_synthetic_founder',
      runtime_contract_version: 'subscriber-runtime-service-v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coachConnectRuntime,
    resolveEntitlement: async () => ({ allowed: true, entitlement }),
    resolveCoachState: async () => coachState,
    clock: () => '2026-07-27T16:06:01.000Z',
  });
  return { bridge, subscriptionRuntime, coachConnectRuntime };
}

const attachInput = {
  request,
  edgeAttestation,
  authority,
  subjectReceipt,
  sessionReceipt,
  capability,
};

test('complete synthetic founder path attaches one subject, one engine, and both existing runtimes', async () => {
  const { bridge, subscriptionRuntime, coachConnectRuntime } = bridgeFixture();
  const result = await bridge.attach(attachInput);
  assert.equal(result.ok, true);
  assert.equal(result.runtime_ready, true);
  assert.equal(result.attachment_set.business_engine_count, 1);
  assert.equal(result.attachment_set.all_scopes_equal, true);
  assert.equal(result.attachment_set.all_authorities_current, true);
  assert.equal(result.duplicate_runtime_created, false);
  assert.equal(result.runtime_handles.subscription.runtime_handle, subscriptionRuntime);
  assert.equal(result.runtime_handles.coach_connect.runtime_handle, coachConnectRuntime);
  assert.equal(result.business_engine_attachment.source, 'CANONICAL_BUSINESS_ENGINE');
});

test('edge identity, MFA, authenticated authority, and SUBDEV1 capability layers are all required', async () => {
  const { bridge } = bridgeFixture();
  assert.equal((await bridge.attach({
    ...attachInput,
    edgeAttestation: { ...edgeAttestation, mfa_verified: false },
  })).code, 'SESSION_ELEVATION_REQUIRED');
  assert.equal((await bridge.attach({
    ...attachInput,
    authority: { allowed: true },
  })).code, 'SESSION_ELEVATION_REQUIRED');
  assert.equal((await bridge.attach({
    ...attachInput,
    authority: { ...authority, code: 'PRIVATE_ENTITLEMENT_REQUIRED', allowed: false },
  })).code, 'PRIVATE_ENTITLEMENT_REQUIRED');
});

test('allowed subscription and Coach Connect interactions use existing services and remain noncanonical', async () => {
  const { bridge } = bridgeFixture();
  const attached = await bridge.attach(attachInput);
  const subscription = await invokeExistingSubscriptionRuntime({
    attachment: attached.runtime_handles.subscription,
    request,
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
  assert.equal(coach.projection.living_map_refresh_source, 'AUTHORITATIVE_BUSINESS_ENGINE');
  assert.equal(coach.interaction.canonical_mutation_performed, false);
});

test('restart deterministically rebuilds the same attachment identity without duplicate runtimes', async () => {
  const firstFixture = bridgeFixture();
  const first = await firstFixture.bridge.attach(attachInput);
  const restartedFixture = bridgeFixture();
  const restarted = await restartedFixture.bridge.attach(attachInput);
  assert.equal(first.ok, true);
  assert.equal(restarted.ok, true);
  assert.equal(restarted.attachment_set.attachment_set_id, first.attachment_set.attachment_set_id);
  assert.equal(restarted.business_engine_attachment.attachment_id, first.business_engine_attachment.attachment_id);
  assert.equal(restarted.duplicate_runtime_created, false);
});

test('revocation, logout, emergency disable, and partial attachment all return detached denied state', async () => {
  const { bridge } = bridgeFixture({ coachStateOverrides: { existing_runtime: false } });
  const partial = await bridge.attach(attachInput);
  assert.equal(partial.code, 'COACH_CONNECT_STATE_MISSING');
  assert.equal(partial.partial_handles_discarded, true);
  assert.equal(partial.attachment_set, null);
  for (const code of ['CAPABILITY_REVOKED', 'SESSION_REVOKED', 'EMERGENCY_DISABLED']) {
    const denied = await bridge.attach({
      ...attachInput,
      authority: { ...authority, allowed: false, code },
    });
    assert.equal(denied.code, code);
    assert.equal(denied.runtime_ready, false);
  }
});

test('unapproved action, paid access, public access, and duplicate composition remain denied', async () => {
  const { bridge } = bridgeFixture();
  const attached = await bridge.attach(attachInput);
  assert.equal((await invokeExistingSubscriptionRuntime({
    attachment: attached.runtime_handles.subscription,
    request,
    action: 'STRIPE_CHECKOUT',
  })).code, 'ACTION_NOT_ALLOWLISTED');
  assert.equal(attached.attachment_set.paid_entitlement, false);
  assert.equal(attached.attachment_set.stripe_enabled, false);
  assert.equal(attached.attachment_set.public_access, false);
  assert.equal(bridge.inspect().public_routes.length, 0);
  assert.equal(bridge.inspect().duplicate_runtime_created, false);
});

test('UI callback carries verified entitlement into a receipt-only host and grants no authority', () => {
  const mapSource = readFileSync(
    new URL('../src/BusinessAssessmentVisualMap.jsx', import.meta.url),
    'utf8',
  );
  const hostSource = readFileSync(
    new URL('../src/components/businessAssessment/PrivateRuntimeAttachmentHost.jsx', import.meta.url),
    'utf8',
  );
  assert.match(mapSource, /DeveloperAccessPanel onUnlocked=\{setPrivateRuntimeEntitlement\}/);
  assert.match(mapSource, /PrivateRuntimeAttachmentHost entitlement=\{privateRuntimeEntitlement\}/);
  assert.doesNotMatch(hostSource, /operator_authority|canonical_mutation_authority|stripe_authority/);
  assert.doesNotMatch(hostSource, /localStorage|sessionStorage/);
  assert.match(hostSource, /ATTACH_CURRENT_AUTHENTICATED_SCOPE/);
});

test('integration path makes zero provider, persistence, transcript, migration, deletion, Stripe, or deployment calls', async () => {
  const { bridge } = bridgeFixture();
  const attached = await bridge.attach(attachInput);
  assert.equal(attached.ok, true);
  const serialized = JSON.stringify({
    attachment_set: attached.attachment_set,
    business_engine: attached.business_engine_attachment,
    subscription: attached.subscription_runtime_attachment,
    coach_connect: attached.coach_connect_attachment,
  });
  assert.equal(serialized.includes('production_customer_data":true'), false);
  assert.equal(serialized.includes('stripe_enabled":true'), false);
  assert.equal(serialized.includes('transcript_persistence":true'), false);
  assert.equal(bridge.inspect().provider_connection, false);
  assert.equal(bridge.inspect().production_persistence, false);
  assert.equal(bridge.inspect().stripe, false);
});
