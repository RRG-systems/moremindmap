import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExistingSubscriptionRuntimeLiveAttachmentAdapterV1,
  privateRuntimeProductBindingDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import { hashPrivateRuntimeScope } from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const scope = {
  tenant_id: 'tenant_subscription_live',
  profile_id: 'profile_subscription_live',
  business_id: 'business_subscription_live',
  subscriber_id: 'subscriber_subscription_live',
};

function binding() {
  const value = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: 'PRIVATE_PREVIEW',
    subscriber_subject_ref: 'subscriber_subject_subscription',
    exact_scope: scope,
    exact_scope_hash: hashPrivateRuntimeScope(scope),
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_subscription',
      business_engine_version: 'business_engine_v1',
      business_engine_contract_hash: '1'.repeat(64),
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_runtime_existing',
      runtime_contract_version: 'subscriber-runtime-service-v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coach_connect_runtime: {
      existing_runtime: true,
      runtime_ref: 'coach_connect_existing',
      exact_scope: scope,
      relationship_ref: 'relationship_existing',
      consent_ref: 'consent_existing',
      coach_identity_ref: 'coach_existing',
      text_only: true,
      production_persistence: false,
      transcript_persistence: false,
      live_model_provider: false,
      live_media_provider: false,
      stripe: false,
      canonical_mutation_authority: false,
    },
    issued_at: '2026-07-28T10:00:00.000Z',
    review_due_at: '2026-08-28T10:00:00.000Z',
    binding_sha256: '0'.repeat(64),
  };
  return { ...value, binding_sha256: privateRuntimeProductBindingDigest(value) };
}

test('subscription adapter attaches one existing runtime reference', async () => {
  const adapter = createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
    productBindingAttestation: binding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.resolveExistingSubscriptionRuntime({ exact_scope: scope });
  assert.equal(result.ok, true);
  assert.equal(result.descriptor.existing_runtime, true);
  assert.equal(result.duplicate_runtime_created, false);
  assert.equal(result.runtime.reference_only, true);
  assert.equal(result.runtime.owns_product_state, false);
});

test('subscription runtime contract preserves default-off and no public routes', async () => {
  const adapter = createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
    productBindingAttestation: binding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.resolveExistingSubscriptionRuntime({ exact_scope: scope });
  const contract = result.runtime.inspect_contract();
  assert.equal(contract.feature_flags_default_off, true);
  assert.deepEqual(contract.public_routes, []);
  assert.equal(contract.existing_runtime, true);
});

test('subscription adapter preserves paid, Stripe, migration, and persistence boundaries', () => {
  const adapter = createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
    productBindingAttestation: binding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const capability = adapter.describeCapability();
  assert.equal(capability.existing_runtime_only, true);
  assert.equal(capability.creates_runtime, false);
  assert.equal(capability.paid_entitlement, false);
  assert.equal(capability.stripe, false);
  assert.equal(capability.model_routing_changed, false);
});

test('subscription adapter denies a cross-scope attachment', async () => {
  const adapter = createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
    productBindingAttestation: binding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.resolveExistingSubscriptionRuntime({
    exact_scope: { ...scope, subscriber_id: 'subscriber_other' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SUBSCRIPTION_RUNTIME_UNAVAILABLE');
});
