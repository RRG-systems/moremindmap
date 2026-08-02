import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAuthoritativeLayer3Packet,
  verifyExistingProfilePacket,
} from '../api/engine/bosCustomerIntelligence/profilePacketVerifier.js';
import {
  checkLayer3RateLimit,
  durableCacheInvariants,
  readDurableLayer3Translation,
  writeDurableLayer3Translation,
} from '../api/engine/bosCustomerIntelligence/redisTranslationStore.js';
import { getOrGenerateLayer3Translation } from '../api/engine/bosCustomerIntelligence/translationService.js';
import { resolveLayer3CustomerViewModel } from '../src/lib/bosCustomerIntelligence/customerViewModelOverlay.js';
import { buildDeterministicLayer3Translation } from '../src/lib/bosCustomerIntelligence/deterministicFallback.js';
import { buildLayer3SemanticPacket } from '../src/lib/bosCustomerIntelligence/semanticPacket.js';
import {
  buildLayer3CacheIdentity,
  layer3CacheKey,
} from '../src/lib/bosCustomerIntelligence/translationCache.js';
import { validateLayer3TranslationBundle } from '../src/lib/bosCustomerIntelligence/translationValidator.js';
import { verifyHistoricalProfiles } from '../scripts/verifyBosUniversalHistoricalCompatibility.js';

const PROFILE_ID = 'mm-20990101-upgrade1';

class FakeRedis {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.readKeys = [];
    this.writeKeys = [];
  }

  async get(key) {
    this.readKeys.push(key);
    return this.values.get(key) ?? null;
  }

  async set(key, value, ...options) {
    const nx = options.includes('NX');
    if (nx && this.values.has(key)) return null;
    this.values.set(key, String(value));
    this.writeKeys.push(key);
    return 'OK';
  }

  async del(key) {
    this.writeKeys.push(key);
    return this.values.delete(key) ? 1 : 0;
  }

  async eval(_script, _numberOfKeys, key, token) {
    if (this.values.get(key) !== token) return 0;
    this.values.delete(key);
    this.writeKeys.push(key);
    return 1;
  }

  async incr(key) {
    const next = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, String(next));
    this.writeKeys.push(key);
    return next;
  }

  async expire() {
    return 1;
  }
}

function supportedClaim(id = 'claim.synthetic') {
  return {
    claim_id: id,
    claim: 'The measured pattern is deliberate and evidence bounded.',
    classification: 'Measured',
    confidence: {
      score: 0.6,
      band: 'moderate',
      calibrated: false,
      basis: 'Synthetic regression evidence.',
    },
    evidence_sufficiency: {
      status: 'sufficient',
      evidence_count: 1,
      minimum_required: 1,
    },
    abstention: { abstained: false, reason: null },
    alternative_explanations: [],
    evidence: [{ source_type: 'assessment_response', question_id: 1 }],
    provenance: [{ source: 'synthetic', method: 'deterministic', version: 'v1' }],
  };
}

function buildLayer2ViewModel() {
  return {
    meta: { profileId: PROFILE_ID },
    truthfulness: {
      version: 'bos_truthfulness_v1',
      authority: 'deterministic_layer_2',
    },
    tabs: Array.from({ length: 8 }, (_, index) => ({ id: `tab-${index + 1}` })),
    overviewSections: [{
      id: 'core-operating-pattern',
      title: 'Core operating pattern',
      content: 'Exact Layer 2 content.',
      claimContracts: [supportedClaim()],
    }],
    operatingScores: [],
    oneMove: { claimContracts: [] },
    fiveFuturesSections: [],
    teamFit: { claimContracts: [] },
    visualDNA: {},
    technicalSource: { canonical: 'unchanged' },
    advancedSource: { canonical: 'unchanged' },
  };
}

function buildPacketAndBundle() {
  const viewModel = buildLayer2ViewModel();
  const packet = buildLayer3SemanticPacket(viewModel);
  const bundle = buildDeterministicLayer3Translation(packet);
  assert.equal(validateLayer3TranslationBundle(packet, bundle).valid, true);
  return { viewModel, packet, bundle };
}

function syntheticVaultRecord() {
  return {
    profile_id: PROFILE_ID,
    person_name: 'Synthetic Person',
    company_name: 'Synthetic Company',
    intake_answers: {},
    canonical_profile_json: {
      profile_id: PROFILE_ID,
      intake_answers: {},
      vector_scores: {},
      ranked_dimensions: [],
    },
  };
}

test('durable cache uses isolated namespace and validates every cached bundle', async () => {
  const { packet, bundle } = buildPacketAndBundle();
  const redis = new FakeRedis();
  assert.equal(durableCacheInvariants.vault_namespace_used, false);
  assert.equal(layer3CacheKey(packet).startsWith('bos:l3:'), true);
  assert.equal(layer3CacheKey(packet).startsWith('vault:profile:'), false);
  assert.equal(await writeDurableLayer3Translation(redis, packet, bundle), true);
  assert.deepEqual(await readDurableLayer3Translation(redis, packet), bundle);
  assert.equal(redis.writeKeys.some((key) => key.startsWith('vault:profile:')), false);

  const corrupted = JSON.parse(redis.values.get(layer3CacheKey(packet)));
  corrupted.bundle.translations[0].semantic_contracts[0].claim = 'Changed claim';
  redis.values.set(layer3CacheKey(packet), JSON.stringify(corrupted));
  assert.equal(await readDurableLayer3Translation(redis, packet), null);
});

test('cache key invalidates on every required semantic or policy dimension', () => {
  const { packet } = buildPacketAndBundle();
  const baseline = layer3CacheKey(packet);
  const packetFields = [
    'layer2_version',
    'semantic_hash',
    'surface_manifest_hash',
    'output_variant',
    'version',
    'translation_variant',
  ];
  for (const field of packetFields) {
    assert.notEqual(layer3CacheKey({ ...packet, [field]: `${packet[field]}-changed` }), baseline);
  }
  for (const options of [
    { modelVersion: 'changed-model' },
    { promptVersion: 'changed-prompt' },
    { validatorVersion: 'changed-validator' },
  ]) {
    assert.notEqual(layer3CacheKey(packet, options), baseline);
  }
  assert.deepEqual(Object.keys(buildLayer3CacheIdentity(packet)), [
    'cache_version',
    'layer2_version',
    'semantic_hash',
    'surface_manifest_hash',
    'model_version',
    'prompt_version',
    'validator_version',
    'output_variant',
    'layer3_translation_version',
    'translation_variant',
  ]);
});

test('single-flight collapses simultaneous identical requests to one model call', async () => {
  const { packet, bundle } = buildPacketAndBundle();
  const redis = new FakeRedis();
  let modelCalls = 0;
  const transport = async () => {
    modelCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return {
      output_text: JSON.stringify(bundle),
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    };
  };
  const options = {
    redis,
    packet,
    transport,
    pollIntervalMs: 2,
    singleFlightWaitMs: 200,
  };
  const [first, second] = await Promise.all([
    getOrGenerateLayer3Translation(options),
    getOrGenerateLayer3Translation(options),
  ]);
  assert.equal(modelCalls, 1);
  assert.deepEqual(new Set([first.receipt.source, second.receipt.source]), new Set([
    'gpt_translation',
    'cache',
  ]));
  assert.equal(first.receipt.usage?.total_tokens, 30);
});

test('cache, concurrency, validation, and model failures preserve exact Layer 2', async () => {
  const { viewModel, packet } = buildPacketAndBundle();
  const cacheFailureRedis = new FakeRedis();
  cacheFailureRedis.get = async () => { throw new Error('cache unavailable'); };
  let modelCalls = 0;
  const unavailable = await getOrGenerateLayer3Translation({
    redis: cacheFailureRedis,
    packet,
    transport: async () => { modelCalls += 1; },
  });
  assert.equal(unavailable.receipt.source, 'layer2_fallback');
  assert.equal(unavailable.receipt.reason, 'durable_cache_unavailable');
  assert.equal(modelCalls, 0);
  assert.equal(resolveLayer3CustomerViewModel(viewModel, packet, unavailable), viewModel);

  const limited = await getOrGenerateLayer3Translation({
    redis: new FakeRedis(),
    packet,
    transport: async () => { modelCalls += 1; },
    maxConcurrentCalls: 0,
  });
  assert.equal(limited.receipt.reason, 'model_concurrency_limit');
  assert.equal(resolveLayer3CustomerViewModel(viewModel, packet, limited), viewModel);
});

test('profile access is limited to an existing ID whose authoritative packet matches', async () => {
  const record = syntheticVaultRecord();
  const key = `vault:profile:${PROFILE_ID}`;
  const redis = new FakeRedis({ [key]: JSON.stringify(record) });
  const canonicalBefore = redis.values.get(key);
  const authoritative = await buildAuthoritativeLayer3Packet({ redis, profileId: PROFILE_ID });
  assert.equal(authoritative.profile_id, PROFILE_ID);
  assert.deepEqual(authoritative.view_model_shape, { tabs: 8, overview_sections: 5 });

  const verified = await verifyExistingProfilePacket({
    redis,
    profileId: PROFILE_ID,
    suppliedPacket: authoritative.packet,
  });
  assert.equal(verified.packet.semantic_hash, authoritative.packet.semantic_hash);
  assert.equal(redis.values.get(key), canonicalBefore);
  assert.equal(redis.writeKeys.some((writtenKey) => writtenKey.startsWith('vault:profile:')), false);

  await assert.rejects(
    verifyExistingProfilePacket({
      redis,
      profileId: PROFILE_ID,
      suppliedPacket: { ...authoritative.packet, semantic_hash: 'fnv1a64:changed' },
    }),
    /semantic_packet_does_not_match_profile/,
  );
  await assert.rejects(
    buildAuthoritativeLayer3Packet({ redis, profileId: 'mm-20990101-other001' }),
    /Profile not found/,
  );
});

test('rate limiter is bounded and stores no profile identity in its key', async () => {
  const redis = new FakeRedis();
  assert.equal((await checkLayer3RateLimit(redis, {
    profileId: PROFILE_ID,
    clientAddress: '192.0.2.10',
    limit: 2,
  })).allowed, true);
  assert.equal((await checkLayer3RateLimit(redis, {
    profileId: PROFILE_ID,
    clientAddress: '192.0.2.10',
    limit: 2,
  })).allowed, true);
  assert.equal((await checkLayer3RateLimit(redis, {
    profileId: PROFILE_ID,
    clientAddress: '192.0.2.10',
    limit: 2,
  })).allowed, false);
  assert.equal(redis.writeKeys.every((key) => !key.includes(PROFILE_ID)), true);
});

test('historical verifier is read-only, identity-safe, and proves the universal premium shape', async () => {
  const key = `vault:profile:${PROFILE_ID}`;
  const redis = new FakeRedis({ [key]: JSON.stringify(syntheticVaultRecord()) });
  redis.keys = async (pattern) => {
    assert.equal(pattern, 'vault:profile:*');
    return [key];
  };
  const receipt = await verifyHistoricalProfiles({ redis });
  assert.equal(receipt.read_only, true);
  assert.equal(receipt.profile_identity_logged, false);
  assert.equal(receipt.total_vault_records, 1);
  assert.equal(receipt.scanned_records, 1);
  assert.equal(receipt.eligible_count, 1);
  assert.equal(receipt.excluded_count, 0);
  assert.equal(receipt.eligible[0].profile_ref.includes(PROFILE_ID), false);
  assert.equal(receipt.eligible[0].exact_layer2_fallback, true);
  assert.equal(receipt.eligible[0].tabs, 8);
  assert.equal(receipt.eligible[0].overview_sections, 5);
  assert.deepEqual(redis.writeKeys, []);
});
