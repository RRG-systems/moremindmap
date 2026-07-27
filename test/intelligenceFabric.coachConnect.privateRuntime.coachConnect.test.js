import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachExistingCoachConnectRuntime,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js';
import {
  invokeExistingCoachConnect,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/composition.js';
import { hashPrivateRuntimeScope } from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import { DEFAULT_COACH_CONNECT_FLAGS } from '../src/lib/intelligenceFabric/coachConnect/activation.js';
import { InMemoryCoachConnectStore } from '../src/lib/intelligenceFabric/coachConnect/inMemoryStore.js';
import { createCoachConnectService } from '../src/lib/intelligenceFabric/coachConnect/service.js';

const scope = {
  tenant_id: 'tenant_synthetic_alpha',
  profile_id: 'profile_synthetic_alpha',
  business_id: 'business_synthetic_alpha',
  subscriber_id: 'subscriber_synthetic_alpha',
};
const request = {
  request_version: 'private-runtime-attachment-request-v1',
  environment_id: 'environment_synthetic_alpha',
  subscriber_subject_ref: 'canonical_subject_synthetic_alpha',
  authenticated_session_ref: 'authenticated_session_synthetic_alpha',
  capability_ref: 'capability_synthetic_alpha',
  exact_scope: scope,
  requested_attachments: ['BUSINESS_ENGINE', 'SUBSCRIPTION_RUNTIME', 'COACH_CONNECT'],
  correlation_id: 'correlation_coach_connect_synthetic_alpha',
  requested_at: '2026-07-27T16:03:00.000Z',
};
const businessEngineReceipt = {
  receipt_version: 'business-engine-attachment-v1',
  attachment_id: 'business_engine_attachment_synthetic_alpha',
  subscriber_subject_ref: request.subscriber_subject_ref,
  exact_scope_hash: hashPrivateRuntimeScope(scope),
  business_engine_ref: 'canonical_business_engine_synthetic_alpha',
  business_engine_version: 'business_engine_contract_v1',
  business_engine_contract_hash: 'a'.repeat(64),
  source: 'CANONICAL_BUSINESS_ENGINE',
  read_authorized: true,
  write_authorized: false,
  duplicate_engine_created: false,
  attached_at: '2026-07-27T16:01:00.000Z',
};
const subscriptionReceipt = {
  receipt_version: 'subscription-runtime-attachment-v1',
  attachment_id: 'subscription_runtime_attachment_synthetic_alpha',
  subscriber_subject_ref: request.subscriber_subject_ref,
  authenticated_session_ref: request.authenticated_session_ref,
  exact_scope_hash: hashPrivateRuntimeScope(scope),
  business_engine_attachment_ref: businessEngineReceipt.attachment_id,
  subscription_ref: 'subscription_runtime_synthetic_alpha',
  runtime_contract_version: 'subscriber-runtime-service-v1',
  entitlement_source: 'temporary_internal_subscription_entitlement',
  allowed_interactions: [],
  paid_entitlement: false,
  stripe_authority: false,
  canonical_write_authority: false,
  attached_at: '2026-07-27T16:02:00.000Z',
};
const subscriptionAttachment = { ok: true, receipt: subscriptionReceipt };
const authority = { allowed: true };
const coachActorRef = 'coach_actor_synthetic_alpha';
const relationshipRef = 'relationship_synthetic_alpha';
const entitlementRef = 'coach_entitlement_synthetic_alpha';
const authSessionRef = 'coach_auth_session_synthetic_alpha';
const authSessionToken = 'coach-auth-session-token-synthetic-alpha-00000001';

function serviceFixture() {
  const store = new InMemoryCoachConnectStore();
  store.save('relationships', relationshipRef, {
    relationship_id: relationshipRef,
    subscriber_scope: scope,
    coach_actor_id: coachActorRef,
    relationship_status: 'ACTIVE',
    subscriber_consent_state: 'GRANTED',
  });
  store.save('entitlements', entitlementRef, {
    entitlement_id: entitlementRef,
    relationship_id: relationshipRef,
    subscriber_scope: scope,
    coach_actor_id: coachActorRef,
    entitlement_status: 'ACTIVE',
  });
  const authService = {
    futureCoachAuthDecision({ session_id, session_token }) {
      return session_id === authSessionRef && session_token === authSessionToken
        ? { ok: true, decision: { allowed: true, coach_actor_id: coachActorRef } }
        : { ok: false, code: 'INVALID_SESSION', decision: { allowed: false } };
    },
  };
  const flags = {
    ...DEFAULT_COACH_CONNECT_FLAGS,
    coach_connect_enabled: true,
    session_capture_enabled: true,
    subscriber_projection_enabled: true,
    synthetic_only: true,
    emergency_disabled: false,
  };
  const service = createCoachConnectService({
    store,
    authService,
    flags,
    clock: () => '2026-07-27T16:03:01.000Z',
    tokenFactory: () => 'unused-token-synthetic-alpha-000000000001',
    canonicalRuntimeAppend: null,
  });
  return { service, store };
}

function coachState(overrides = {}) {
  return {
    existing_runtime: true,
    runtime_ref: 'coach_connect_runtime_synthetic_alpha',
    exact_scope: scope,
    production_persistence: false,
    transcript_persistence: false,
    live_model_provider: false,
    live_media_provider: false,
    stripe: false,
    relationship_active: true,
    consent_granted: true,
    coach_authenticated: true,
    coach_entitlement_active: true,
    projection_input: {
      confirmation_requests: [{ id: 'confirmation_synthetic_alpha', private_note: 'must_not_escape' }],
      governed_updates: [{ summary: 'governed_update_synthetic_alpha' }],
    },
    structured_session_input: {
      relationship_id: relationshipRef,
      entitlement_id: entitlementRef,
      subscriber_scope: scope,
      auth_session_id: authSessionRef,
      auth_session_token: authSessionToken,
    },
    ...overrides,
  };
}

const attach = (overrides = {}) => {
  const { service } = serviceFixture();
  return attachExistingCoachConnectRuntime({
    request,
    authority,
    businessEngineReceipt,
    subscriptionAttachment,
    runtime: service,
    coachState: coachState(),
    attachedAt: '2026-07-27T16:03:01.000Z',
    ...overrides,
  });
};

test('existing Coach Connect attaches to the same subject, scope, engine, and subscription', () => {
  const result = attach();
  assert.equal(result.ok, true);
  assert.equal(result.receipt.receipt_version, 'coach-connect-attachment-v1');
  assert.equal(result.receipt.business_engine_attachment_ref, businessEngineReceipt.attachment_id);
  assert.equal(result.receipt.subscription_runtime_attachment_ref, subscriptionReceipt.attachment_id);
  assert.equal(result.inspection.business_engine_count, 1);
  assert.equal(result.receipt.second_business_engine, false);
  assert.equal(result.inspection.existing_runtime, true);
});

test('cross-scope, mismatched receipt, second engine, or live dependency denies', () => {
  assert.equal(attach({
    coachState: coachState({ exact_scope: { ...scope, business_id: 'business_synthetic_other' } }),
  }).code, 'COACH_CONNECT_STATE_MISSING');
  assert.equal(attach({
    subscriptionAttachment: {
      ok: true,
      receipt: { ...subscriptionReceipt, business_engine_attachment_ref: 'business_engine_attachment_other' },
    },
  }).code, 'COACH_CONNECT_ATTACHMENT_MISMATCH');
  const { service } = serviceFixture();
  const secondEngineRuntime = {
    inspect: () => ({ ...service.inspect(), second_business_engine: true }),
  };
  assert.equal(attach({ runtime: secondEngineRuntime }).code, 'COACH_CONNECT_STATE_MISSING');
  assert.equal(attach({ coachState: coachState({ live_media_provider: true }) }).code, 'COACH_CONNECT_STATE_MISSING');
});

test('SUBDEV1 grants no coach, operator, billing, Stripe, or canonical authority', () => {
  const result = attach();
  assert.equal(result.receipt.live_billing, false);
  assert.equal(result.receipt.canonical_mutation_authority, false);
  assert.equal(result.receipt.allowed_capabilities.includes('COACH_AUTHORITY'), false);
  assert.equal(result.receipt.allowed_capabilities.includes('BILLING'), false);
  assert.equal(result.receipt.allowed_capabilities.includes('STRIPE'), false);
  assert.equal(JSON.stringify(result.receipt).includes('SUBDEV1'), false);
});

test('subscriber projection uses the existing service and excludes coach-private content', async () => {
  const result = await invokeExistingCoachConnect({
    attachment: attach(),
    action: 'SUBSCRIBER_PROJECTION',
  });
  assert.equal(result.ok, true);
  assert.equal(result.interaction.used_existing_runtime, true);
  assert.equal(result.interaction.business_engine_attachment_ref, businessEngineReceipt.attachment_id);
  assert.equal(result.projection.living_map_refresh_source, 'AUTHORITATIVE_BUSINESS_ENGINE');
  assert.equal(JSON.stringify(result).includes('must_not_escape'), false);
  assert.deepEqual(result.projection.coach_private_notes, []);
});

test('structured non-voice session requires existing relationship, consent, coach auth, and entitlement', async () => {
  for (const field of [
    'relationship_active',
    'consent_granted',
    'coach_authenticated',
    'coach_entitlement_active',
  ]) {
    const blocked = await invokeExistingCoachConnect({
      attachment: attach({ coachState: coachState({ [field]: false }) }),
      action: 'STRUCTURED_NON_VOICE_SESSION_WHEN_ALREADY_AUTHORIZED',
      idempotencyKey: `idempotency_blocked_${field}`,
    });
    assert.equal(blocked.code, 'COACH_CONNECT_STATE_MISSING');
  }
  const allowed = await invokeExistingCoachConnect({
    attachment: attach(),
    action: 'STRUCTURED_NON_VOICE_SESSION_WHEN_ALREADY_AUTHORIZED',
    idempotencyKey: 'idempotency_coach_session_synthetic_alpha',
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.result.session_mode, 'STRUCTURED_NON_VOICE');
  assert.equal(allowed.result.raw_transcript, null);
  assert.equal(allowed.result.canonical_mutation, false);
});

test('invitation, cockpit, billing, promotion, media, transcript, and provider actions deny', async () => {
  for (const action of [
    'INVITATION',
    'COACH_COCKPIT',
    'BILLING_EVENT',
    'PROMOTION',
    'LIVE_MODEL',
    'VOICE_VIDEO',
    'TRANSCRIPT_PERSISTENCE',
  ]) {
    const result = await invokeExistingCoachConnect({
      attachment: attach(),
      action,
      idempotencyKey: 'idempotency_denied_action',
    });
    assert.equal(result.code, 'ACTION_NOT_ALLOWLISTED');
  }
});

test('attachment and interactions keep all external, persistence, transcript, promotion, and Stripe calls zero', async () => {
  const attachment = attach();
  const projection = await invokeExistingCoachConnect({
    attachment,
    action: 'SUBSCRIBER_PROJECTION',
  });
  assert.equal(attachment.inspection.production_persistence, false);
  assert.equal(attachment.inspection.stripe, false);
  assert.equal(projection.interaction.stripe_call_count, 0);
  assert.equal(projection.interaction.live_provider_call_count, 0);
  assert.equal(projection.interaction.transcript_persistence_call_count, 0);
  assert.equal(projection.interaction.canonical_mutation_performed, false);
  assert.equal(attachment.runtime_handle.inspect().canonical_write_entry, null);
});
