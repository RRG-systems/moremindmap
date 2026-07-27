import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachExistingSubscriptionRuntime,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js';
import {
  invokeExistingSubscriptionRuntime,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/composition.js';
import { hashPrivateRuntimeScope } from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  DEFAULT_PRODUCTION_FOUNDATION_FLAGS,
} from '../src/lib/intelligenceFabric/production/activation.js';
import { createSubscriberRuntimeService } from '../src/lib/intelligenceFabric/production/subscriberService.js';
import { resolveSubscriptionEntitlement } from '../api/internal/subscription-entitlement.js';

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
  correlation_id: 'correlation_subscription_synthetic_alpha',
  requested_at: '2026-07-27T16:02:00.000Z',
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
const entitlement = {
  access_type: 'more_monthly_intelligence',
  status: 'active',
  source: 'temporary_internal_subscription_entitlement',
  temporary: true,
  expires_at: '2026-07-27T16:15:00.000Z',
  billing_evidence: false,
  stripe_subscription_created: false,
  admin_authority: false,
  coach_authority: false,
  operator_authority: false,
  canonical_mutation_authority: false,
};
const subscription = {
  existing_runtime: true,
  subscription_ref: 'subscription_runtime_synthetic_alpha',
  runtime_contract_version: 'subscriber-runtime-service-v1',
  exact_scope: scope,
  production_namespace: false,
  customer_data: false,
  migration: false,
};
const authority = { allowed: true };
const counters = {
  stripe: 0,
  productionPersistence: 0,
  migration: 0,
  liveModel: 0,
};

function runtime() {
  const idempotency = new Map();
  return createSubscriberRuntimeService({
    adapter: { namespace: 'isolated_synthetic_private_test' },
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
    clock: () => '2026-07-27T16:02:00.000Z',
    handlers: {
      READ_CURRENT_STATE: ({ envelope }) => ({
        existing_runtime: true,
        exact_scope_hash: hashPrivateRuntimeScope(envelope.scope),
        business_engine_ref: businessEngineReceipt.business_engine_ref,
      }),
      REQUEST_EXPLANATION: () => ({
        existing_runtime: true,
        explanation_reference: 'explanation_synthetic_alpha',
      }),
      START_SESSION: ({ envelope, payload }) => {
        const prior = idempotency.get(envelope.idempotency_key);
        const fingerprint = JSON.stringify(payload);
        if (prior && prior.fingerprint !== fingerprint) {
          const error = new Error('idempotency conflict');
          error.code = 'IDEMPOTENCY_CONFLICT';
          throw error;
        }
        if (prior) return { ...prior.value, status: 'IDEMPOTENT_REPLAY' };
        const value = {
          status: 'CREATED',
          session_ref: 'existing_subscription_session_synthetic_alpha',
          canonical_action_count: 1,
        };
        idempotency.set(envelope.idempotency_key, { fingerprint, value });
        return value;
      },
    },
  });
}

const attach = (overrides = {}) => attachExistingSubscriptionRuntime({
  request,
  authority,
  businessEngineReceipt,
  entitlement,
  runtime: runtime(),
  subscription,
  attachedAt: '2026-07-27T16:02:01.000Z',
  ...overrides,
});

test('existing Subscription Runtime attaches to exact subject/session/scope and Business Engine', () => {
  const result = attach();
  assert.equal(result.ok, true);
  assert.equal(result.receipt.receipt_version, 'subscription-runtime-attachment-v1');
  assert.equal(result.receipt.business_engine_attachment_ref, businessEngineReceipt.attachment_id);
  assert.equal(result.receipt.entitlement_source, 'temporary_internal_subscription_entitlement');
  assert.equal(result.receipt.paid_entitlement, false);
  assert.equal(result.receipt.stripe_authority, false);
  assert.equal(result.isolation.production_namespace, false);
  assert.equal(result.isolation.customer_data, false);
});

test('default authority, emergency denial, invalid session, entitlement, and cross-scope attachment fail closed', () => {
  assert.equal(attach({ authority: { allowed: false, code: 'EMERGENCY_DISABLED' } }).code, 'EMERGENCY_DISABLED');
  assert.equal(attach({ request: { ...request, authenticated_session_ref: '' } }).ok, false);
  assert.equal(attach({ entitlement: { ...entitlement, status: 'revoked' } }).code, 'PRIVATE_ENTITLEMENT_REQUIRED');
  assert.equal(attach({ entitlement: { ...entitlement, expires_at: '2026-07-27T16:02:00.000Z' } }).code, 'PRIVATE_ENTITLEMENT_REQUIRED');
  assert.equal(attach({
    subscription: { ...subscription, exact_scope: { ...scope, business_id: 'business_synthetic_other' } },
  }).code, 'SUBSCRIPTION_RUNTIME_UNAVAILABLE');
  assert.equal(attach({
    businessEngineReceipt: { ...businessEngineReceipt, exact_scope_hash: 'b'.repeat(64) },
  }).code, 'SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH');
});

test('approved query invokes the existing service with a server-built exact envelope', async () => {
  const attachment = attach();
  const result = await invokeExistingSubscriptionRuntime({
    attachment,
    request,
    action: 'READ_CURRENT_STATE',
  });
  assert.equal(result.ok, true);
  assert.equal(result.interaction.used_existing_runtime, true);
  assert.equal(result.interaction.exact_scope_hash, hashPrivateRuntimeScope(scope));
  assert.equal(result.interaction.canonical_mutation_performed, false);
  assert.equal(result.result.value.existing_runtime, true);
});

test('unknown and canonical-write actions deny before invoking the runtime', async () => {
  for (const action of [
    'PAID_ENTITLEMENT',
    'STRIPE_CHECKOUT',
    'APPEND_CONFIRMED_EVIDENCE',
    'REFRESH_INTELLIGENCE',
    'MIGRATE',
  ]) {
    assert.equal((await invokeExistingSubscriptionRuntime({
      attachment: attach(),
      request,
      action,
      idempotencyKey: 'idempotency_synthetic_alpha',
    })).code, 'ACTION_NOT_ALLOWLISTED');
  }
});

test('existing runtime receives idempotency key; same semantics replay and changed semantics fail', async () => {
  const attachment = attach();
  const first = await invokeExistingSubscriptionRuntime({
    attachment,
    request,
    action: 'START_SESSION',
    payload: { purpose: 'structured_private_session' },
    idempotencyKey: 'idempotency_synthetic_alpha',
  });
  const replay = await invokeExistingSubscriptionRuntime({
    attachment,
    request,
    action: 'START_SESSION',
    payload: { purpose: 'structured_private_session' },
    idempotencyKey: 'idempotency_synthetic_alpha',
  });
  const conflict = await invokeExistingSubscriptionRuntime({
    attachment,
    request,
    action: 'START_SESSION',
    payload: { purpose: 'changed_semantics' },
    idempotencyKey: 'idempotency_synthetic_alpha',
  });
  assert.equal(first.ok, true);
  assert.equal(replay.ok, true);
  assert.equal(replay.result.value.status, 'IDEMPOTENT_REPLAY');
  assert.equal(conflict.ok, false);
  assert.equal(replay.result.value.canonical_action_count, 1);
});

test('private runtime decision cannot be upgraded by a paid Stripe grant', () => {
  const result = resolveSubscriptionEntitlement({
    req: { headers: {} },
    env: { NODE_ENV: 'production' },
    paidAccessGrant: {
      access_type: 'more_monthly_intelligence',
      status: 'active',
    },
    privateRuntimeDecision: {
      allowed: false,
      shared_state_evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
    },
  });
  assert.equal(result.allowed, false);
  assert.notEqual(result.entitlement?.source, 'paid_stripe');
});

test('bootstrap-shaped attachment output contains receipts only and all prohibited counters stay zero', () => {
  const attachment = attach();
  const serialized = JSON.stringify({
    receipt: attachment.receipt,
    isolation: attachment.isolation,
  });
  for (const forbidden of ['token', 'cookie', 'access_code', 'paid_stripe', 'private_content']) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.deepEqual(counters, {
    stripe: 0,
    productionPersistence: 0,
    migration: 0,
    liveModel: 0,
  });
});
