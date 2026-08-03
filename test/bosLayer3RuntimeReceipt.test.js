import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSafeLayer3RuntimeReceipt } from '../api/moremindmap/customer-intelligence.js';
import { buildDeterministicLayer3Translation } from '../src/lib/bosCustomerIntelligence/deterministicFallback.js';
import { hashSemanticValue } from '../src/lib/bosCustomerIntelligence/semanticPacket.js';

const packetWithoutHash = {
  version: 'bos_customer_intelligence_v3',
  output_variant: 'premium-web-v3',
  translation_variant: 'recognition-first-rich',
  layer2_version: 'bos_truthfulness_v1',
  source_authority: 'deterministic_layer_2',
  translation_only: true,
  protected_contract: {
    layer_1_scores_modified: false,
    layer_2_claims_modified: false,
    canonical_bos_modified: false,
    downstream_contracts_modified: false,
    confidence_calibration_claimed: false,
  },
  surfaces: [{
    surface_id: 'overview.synthetic',
    role: 'overview',
    label: 'A supported synthetic pattern',
    claims: [{
      claim_id: 'claim_synthetic',
      claim: 'Deliberate decisions are the supported operating tendency.',
      classification: 'Measured',
      confidence: {
        score: 0.8,
        band: 'high',
        calibrated: false,
        basis: 'synthetic_test',
      },
      evidence_sufficiency: { status: 'sufficient' },
      abstention: { abstained: false, reason: null },
    }],
    protected_values: {},
    translation_guidance: {
      output_format: 'overview_pattern',
      customer_goal: 'Explain the supported pattern.',
      recognition_cues: ['deliberate decisions'],
      allowed_block_kinds: ['recognition', 'self_check'],
      required_block_kinds: ['recognition', 'self_check'],
      minimum_blocks: 2,
    },
  }],
};
packetWithoutHash.surface_manifest_hash = hashSemanticValue([{
  surface_id: 'overview.synthetic',
  role: 'overview',
  claim_ids: ['claim_synthetic'],
}]);
const packet = {
  ...packetWithoutHash,
  semantic_hash: hashSemanticValue(packetWithoutHash),
};

test('safe runtime receipt exposes bounded failure telemetry without customer content', () => {
  const safe = buildSafeLayer3RuntimeReceipt({
    req: {
      headers: {
        'x-vercel-id': 'iad1::synthetic-request',
        authorization: 'Bearer must-not-appear',
      },
      body: {
        profile_id: 'mm-private-profile',
        packet: { answers: ['must-not-appear'] },
      },
    },
    packet,
    result: {
      bundle: null,
      receipt: {
        source: 'layer2_fallback',
        reason: 'layer3_model_translation_rejected',
        latency_ms: 71234,
        validation_failures: [
          'translations.overview.primary:unsupported_number',
          'translations.team.primary:semantic_contract_changed',
        ],
      },
    },
  });

  assert.deepEqual(safe, {
    request_id: 'iad1::synthetic-request',
    semantic_hash: packet.semantic_hash,
    receipt: {
      source: 'layer2_fallback',
      reason: 'layer3_model_translation_rejected',
    },
    validation_failure_codes: ['unsupported_number', 'semantic_contract_changed'],
    validation_failure_count: 2,
    provider_latency_ms: 71234,
    durable_cache_hit_outcome: 'miss',
    durable_cache_write_outcome: 'not_attempted',
    valid_bundle_present: false,
  });

  const serialized = JSON.stringify(safe);
  for (const forbidden of [
    'mm-private-profile',
    'must-not-appear',
    'authorization',
    'Bearer',
    'profile_id',
    'answers',
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('safe runtime receipt reports cache and provider outcomes deterministically', () => {
  const cache = buildSafeLayer3RuntimeReceipt({
    req: { headers: { 'x-request-id': 'cache-request' } },
    packet,
    result: {
      bundle: { invalid: true },
      receipt: { source: 'cache', reason: null, latency_ms: 3 },
    },
  });
  assert.equal(cache.durable_cache_hit_outcome, 'hit');
  assert.equal(cache.durable_cache_write_outcome, 'not_attempted');
  assert.equal(cache.provider_latency_ms, null);
  assert.equal(cache.valid_bundle_present, false);

  const generated = buildSafeLayer3RuntimeReceipt({
    req: { headers: {} },
    packet,
    result: {
      bundle: buildDeterministicLayer3Translation(packet),
      receipt: { source: 'gpt_translation', reason: null, latency_ms: 4567 },
    },
  });
  assert.equal(generated.request_id, 'unavailable');
  assert.equal(generated.durable_cache_hit_outcome, 'miss');
  assert.equal(generated.durable_cache_write_outcome, 'written');
  assert.equal(generated.provider_latency_ms, 4567);
  assert.equal(generated.valid_bundle_present, true);
});
