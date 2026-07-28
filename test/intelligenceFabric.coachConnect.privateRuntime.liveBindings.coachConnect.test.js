import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExistingCoachConnectLiveAttachmentAdapterV1,
  privateRuntimeProductBindingDigest,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import { hashPrivateRuntimeScope } from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const scope = {
  tenant_id: 'tenant_coach_live',
  profile_id: 'profile_coach_live',
  business_id: 'business_coach_live',
  subscriber_id: 'subscriber_coach_live',
};

function binding(overrides = {}) {
  const value = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: 'PRIVATE_PREVIEW',
    subscriber_subject_ref: 'subscriber_subject_coach',
    exact_scope: scope,
    exact_scope_hash: hashPrivateRuntimeScope(scope),
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_coach',
      business_engine_version: 'business_engine_v1',
      business_engine_contract_hash: '2'.repeat(64),
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_runtime_coach',
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
      ...overrides,
    },
    issued_at: '2026-07-28T10:00:00.000Z',
    review_due_at: '2026-08-28T10:00:00.000Z',
    binding_sha256: '0'.repeat(64),
  };
  return { ...value, binding_sha256: privateRuntimeProductBindingDigest(value) };
}

test('Coach Connect adapter resolves one existing text runtime reference', async () => {
  const adapter = createExistingCoachConnectLiveAttachmentAdapterV1({
    productBindingAttestation: binding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.resolveExistingCoachConnectRuntime({ exact_scope: scope });
  assert.equal(result.ok, true);
  assert.equal(result.runtime.reference_only, true);
  assert.equal(result.duplicate_runtime_created, false);
  assert.equal(result.state.existing_runtime, true);
  assert.equal(result.state.text_only, true);
});

test('Coach Connect runtime reference exposes no public, provider, billing, or write route', async () => {
  const adapter = createExistingCoachConnectLiveAttachmentAdapterV1({
    productBindingAttestation: binding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.resolveExistingCoachConnectRuntime({ exact_scope: scope });
  const inspection = result.runtime.inspect();
  assert.deepEqual(inspection.public_routes, []);
  assert.equal(inspection.live_provider, false);
  assert.equal(inspection.live_billing, false);
  assert.equal(inspection.transcript_persistence, false);
  assert.equal(inspection.second_business_engine, false);
});

test('Coach Connect adapter rejects voice, media, transcript, Stripe, or canonical authority', async () => {
  for (const overrides of [
    { text_only: false },
    { live_media_provider: true },
    { transcript_persistence: true },
    { stripe: true },
    { canonical_mutation_authority: true },
  ]) {
    const adapter = createExistingCoachConnectLiveAttachmentAdapterV1({
      productBindingAttestation: binding(overrides),
      nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
    });
    const result = await adapter.resolveExistingCoachConnectRuntime({ exact_scope: scope });
    assert.equal(result.ok, false);
  }
});

test('Coach Connect adapter denies cross-subscriber scope', async () => {
  const adapter = createExistingCoachConnectLiveAttachmentAdapterV1({
    productBindingAttestation: binding(),
    nowMs: Date.parse('2026-07-28T12:00:00.000Z'),
  });
  const result = await adapter.resolveExistingCoachConnectRuntime({
    exact_scope: { ...scope, subscriber_id: 'subscriber_other' },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'COACH_CONNECT_STATE_MISSING');
});
