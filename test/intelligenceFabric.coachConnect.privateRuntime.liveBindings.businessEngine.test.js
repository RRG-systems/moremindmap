import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanonicalBusinessEngineLiveAttachmentAdapterV1,
  privateRuntimeProductBindingDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const scope = {
  tenant_id: 'tenant_private_live',
  profile_id: 'profile_private_live',
  business_id: 'business_private_live',
  subscriber_id: 'subscriber_private_live',
};

function productBinding(overrides = {}) {
  const value = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: 'PRIVATE_PRODUCTION_CLASSIFIED',
    subscriber_subject_ref: 'subscriber_subject_private_live',
    exact_scope: scope,
    exact_scope_hash: hashPrivateRuntimeScope(scope),
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_private_live',
      business_engine_version: 'business_engine_contract_v1',
      business_engine_contract_hash: 'a'.repeat(64),
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_runtime_private_live',
      runtime_contract_version: 'subscriber-runtime-service-v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coach_connect_runtime: {
      existing_runtime: true,
      runtime_ref: 'coach_connect_private_live',
      exact_scope: scope,
      relationship_ref: 'relationship_private_live',
      consent_ref: 'consent_private_live',
      coach_identity_ref: 'coach_identity_private_live',
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
    ...overrides,
  };
  return { ...value, binding_sha256: privateRuntimeProductBindingDigest(value) };
}

test('Business Engine adapter returns exactly one attested canonical reference', async () => {
  const adapter = createCanonicalBusinessEngineLiveAttachmentAdapterV1({
    productBindingAttestation: productBinding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.lookupCanonicalBusinessEngine(scope);
  assert.equal(result.ok, true);
  assert.equal(result.engines.length, 1);
  assert.equal(result.engines[0].source, 'CANONICAL_BUSINESS_ENGINE');
  assert.equal(result.engines[0].write_authorized, false);
  assert.equal(result.duplicate_engine_created, false);
});

test('Business Engine adapter rejects request-supplied substitute scope', async () => {
  const adapter = createCanonicalBusinessEngineLiveAttachmentAdapterV1({
    productBindingAttestation: productBinding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.lookupCanonicalBusinessEngine({
    ...scope,
    profile_id: 'profile_substitution_attempt',
  });
  assert.equal(result.ok, false);
  assert.equal(result.engines.length, 0);
});

test('Business Engine adapter cannot build, persist, or own an engine', () => {
  const adapter = createCanonicalBusinessEngineLiveAttachmentAdapterV1({
    productBindingAttestation: productBinding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  assert.deepEqual(adapter.describeCapability(), {
    adapter_version: 'canonical-business-engine-live-attachment-adapter-v1',
    configured: true,
    canonical_source_only: true,
    read_only: true,
    can_build_engine: false,
    can_persist_engine: false,
    production_connection: false,
    owns_product_state: false,
    profile_id_request_authority: false,
  });
});

test('expired or digest-mismatched product binding fails closed', async () => {
  const expired = createCanonicalBusinessEngineLiveAttachmentAdapterV1({
    productBindingAttestation: productBinding({
      review_due_at: '2026-07-28T11:00:00.000Z',
    }),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  assert.equal((await expired.lookupCanonicalBusinessEngine(scope)).ok, false);
  const mismatched = productBinding();
  mismatched.business_engine.business_engine_contract_hash = 'b'.repeat(64);
  const invalid = createCanonicalBusinessEngineLiveAttachmentAdapterV1({
    productBindingAttestation: mismatched,
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  assert.equal((await invalid.lookupCanonicalBusinessEngine(scope)).ok, false);
});
