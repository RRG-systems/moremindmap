import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createRedisNewBosBackgroundResponseStore } from '../api/engine/newBosProductionReadinessV1/backgroundResponseStore.js';
import { createRedisNewBaBackgroundResponseStore } from '../api/engine/newBaProductionReadinessV1/backgroundResponseStore.js';
import { createAuthorizedSyntheticTopSource, createReadOnlyBaAuthorityReader } from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { createFrozenCanaryRealizationGenerator } from '../api/engine/newBaProductionReadinessV1/canaryRealizationFactory.js';
import { classifyNewBaCompatibility } from '../api/engine/newBaProductionReadinessV1/compatibility.js';
import { buildLaunchSafeNewBaEnvelope, createMemoryNewBaRealizationStore, createRedisNewBaRealizationStore } from '../api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBaModernizationService } from '../api/engine/newBaProductionReadinessV1/modernizationService.js';
import { buildNewBaRealizationIdentityV3 } from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import { createNewBaRouteHandler } from '../api/engine/newBaProductionReadinessV1/routeHandler.js';
import { createReadOnlyCanonicalReader } from '../api/engine/newBosProductionReadinessV1/canonicalReader.js';
import { buildLaunchSafeRealizationEnvelope, createMemoryLaunchSafeRealizationStore, createRedisLaunchSafeRealizationStore } from '../api/engine/newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBosModernizationService } from '../api/engine/newBosProductionReadinessV1/modernizationService.js';
import { buildNewBosRealizationIdentity } from '../api/engine/newBosProductionReadinessV1/realizationIdentity.js';
import { createNewBosProductionRouteHandler } from '../api/engine/newBosProductionReadinessV1/routeHandler.js';
import {
  REALIZATION_RECOVERY_STATES,
  classifyProviderCheckpoint,
  classifyRecoveryFailure,
  classifyRealizationInspection,
} from '../api/engine/realizationRecoveryV1/recoveryContract.js';
import {
  SYNTHETIC_FIXTURES,
  assembleRealizedSurfaceRendering,
  auditHumanRealization,
  buildPersonalityDnaRuntime,
  createHumanRealization,
} from '../src/lib/newBosPersonalityDnaV1/index.js';
import { attachCustomerTopProjection } from '../src/lib/newBosPersonalityDnaV1/topProjection.js';

const IDENTITY = 'a'.repeat(64);
const REQUEST = 'b'.repeat(64);
const PROFILE = 'MM-20990101-SELFHEAL';
const PLATFORM_AUTHORITY = 'synthetic-platform-authority-secret-1234567890';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function syntheticBosEnvelope(profileId = 'MM-20990101-SELFHEAL') {
  const fixture = SYNTHETIC_FIXTURES.find(({ fixture_id: id }) => id === 'mosaic');
  const runtime = buildPersonalityDnaRuntime(fixture);
  const seeded = {
    ...runtime,
    profile_id: profileId,
    raw_evidence: { ...runtime.raw_evidence, profile_id: profileId },
  };
  const surfacePackets = seeded.surface_packets.map((packet) => {
    const customerProse = `You will succeed if every supported condition for ${packet.label} holds. This intentionally ordinary future wording is not a structural rendering concern.\n\nThe second paragraph remains provider-owned communication.`;
    const humanRealization = createHumanRealization({
      surfaceId: packet.surface_id,
      customerProse,
      localSurfacePacket: packet,
    });
    return {
      ...packet,
      human_realization: humanRealization,
      human_realization_audit: auditHumanRealization({
        surfaceId: packet.surface_id,
        realization: humanRealization,
        localTruth: packet.resolved_local_truth,
      }),
      rendering: assembleRealizedSurfaceRendering({
        packet,
        humanRealization,
        profileId,
        subjectToken: seeded.subject_token,
      }),
    };
  });
  const artifact = attachCustomerTopProjection({ ...seeded, surface_packets: surfacePackets });
  const realizationIdentity = buildNewBosRealizationIdentity({
    profileId,
    canonicalSourceSha256: 'c'.repeat(64),
    rawEvidenceVersion: 'synthetic-self-heal-v1',
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: 'A',
  });
  return buildLaunchSafeRealizationEnvelope({
    profileId,
    realizationIdentity,
    artifact,
    compatibility: { class: 'A', label: 'FULLY_COMPATIBLE' },
    providerAccounting: { calls: 0, store: false },
  });
}

async function syntheticBaEnvelope() {
  const source = createAuthorizedSyntheticTopSource();
  const compatibility = classifyNewBaCompatibility(source);
  const realizationIdentity = buildNewBaRealizationIdentityV3({
    profileId: source.profile_id,
    assessmentId: source.assessment_id,
    evidenceSha256: source.business_evidence.evidence_sha256,
    bosAuthoritySha256: source.bos_authority.sha256,
    bosFusionContractSha256: source.bos_authority.fusion_contract_sha256,
    bosEvidenceBoundarySha256: source.bos_authority.evidence_boundary_sha256,
    compatibilityClass: compatibility.class,
    providerModel: 'gpt-5.6-sol',
    verticalBinding: source.business_evidence.vertical_binding,
  });
  const generated = await createFrozenCanaryRealizationGenerator().generate({ source });
  return buildLaunchSafeNewBaEnvelope({
    profileId: source.profile_id,
    realizationIdentity,
    artifact: generated.artifact,
    compatibility,
    providerAccounting: generated.provider_accounting,
  });
}

function canonicalEnvelope() {
  const dimensions = {
    vector: 0.7,
    velocity: 0.6,
    signal: 0.8,
    fidelity: 0.7,
    leverage: 0.5,
    flex: 0.7,
    framework: 0.6,
    horizon: 0.8,
  };
  return {
    canonical_dossier: {
      person_name: 'Synthetic Recovery Subject',
      canonical_profile_json: {
        profile_id: PROFILE,
        assessment_version: 'mini-v2',
        vector_scores: dimensions,
        intake_answers: [{ question_id: 'q01', question_text: 'Synthetic governed prompt', answer_text: 'Synthetic governed answer' }],
      },
    },
  };
}

function redisFixture() {
  const values = new Map();
  return {
    values,
    async get(key) { return values.get(key) || null; },
    async set(key, value, ...args) {
      if (args.includes('NX') && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    },
  };
}

test('canonical BOS reader guards an absent higher-priority key and the exact selected Vault source', async () => {
  const values = new Map();
  const lowerKey = 'vault:profile:mm-20990101-selfheal';
  const legacyKey = 'vault:profile:MM-20990101-selfheal';
  const raw = JSON.stringify(canonicalEnvelope());
  values.set(legacyKey, raw);
  const reader = createReadOnlyCanonicalReader({ redis: { get: async (key) => values.get(key) ?? null } });

  const guarded = await reader.readWithSourceGuards(PROFILE);
  assert.equal(guarded.source.profile_id, PROFILE);
  assert.equal(Object.hasOwn(guarded.source, 'sourceGuards'), false);
  assert.deepEqual(guarded.sourceGuards, [
    { key: lowerKey, expected: null },
    { key: legacyKey, expected: raw },
  ]);
});

test('canonical BA reader guards its exact assessment and BOS authority source records', async () => {
  const values = new Map();
  const assessmentId = 'ba-20990101-a1b2c3d4';
  const relationshipRef = 'invite-canonical-source-guard';
  const assessmentPointerKey = `business_assessment_by_profile:${PROFILE.toLowerCase()}`;
  const assessmentKey = `business_assessment:${assessmentId}`;
  const bosNamespace = 'nonprod:new-bos:canonical-source-guard';
  const bosEnvelope = syntheticBosEnvelope(PROFILE);
  const bosPointerKey = `${bosNamespace}:latest-compatible:${PROFILE}`;
  const bosArtifactKey = `${bosNamespace}:artifact:${PROFILE}:${bosEnvelope.realization_id}`;
  const assessmentRaw = JSON.stringify({
    owner_profile_id: PROFILE,
    assessment_id: assessmentId,
    status: 'intake_saved',
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_team',
    created_at: '2099-01-01T00:00:00.000Z',
    updated_at: '2099-01-01T00:00:00.000Z',
    inputs: {
      answers: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [
        `q${index + 1}`,
        `Synthetic governed business evidence answer ${index + 1}`,
      ])),
    },
    metadata: { recruiting_relationship_ref: relationshipRef },
  });
  const bosRaw = JSON.stringify(bosEnvelope);
  values.set(assessmentPointerKey, assessmentId);
  values.set(assessmentKey, assessmentRaw);
  values.set(bosPointerKey, bosEnvelope.realization_id);
  values.set(bosArtifactKey, bosRaw);
  const reader = createReadOnlyBaAuthorityReader({
    redis: { get: async (key) => values.get(key) ?? null },
    bosNamespace,
  });

  const guarded = await reader.readWithSourceGuards(PROFILE, {
    expectedAssessmentId: assessmentId,
    expectedRelationshipRef: relationshipRef,
  });
  assert.equal(guarded.source.assessment_id, assessmentId);
  assert.equal(Object.hasOwn(guarded.source, 'sourceGuards'), false);
  assert.deepEqual(guarded.sourceGuards, [
    { key: assessmentPointerKey, expected: assessmentId },
    { key: assessmentKey, expected: assessmentRaw },
    { key: bosPointerKey, expected: bosEnvelope.realization_id },
    { key: bosArtifactKey, expected: bosRaw },
  ]);
});

test('New BOS pointer publication atomically rejects selected-source replacement and higher-priority source creation', async () => {
  const envelope = syntheticBosEnvelope(PROFILE);
  const namespace = 'nonprod:new-bos:source-cas-test';
  const values = new Map();
  const selectedKey = 'vault:profile:MM-20990101-selfheal';
  const higherPriorityKey = 'vault:profile:mm-20990101-selfheal';
  values.set(selectedKey, 'source-v1');
  const store = createMemoryLaunchSafeRealizationStore({ namespace, values });
  await store.persistImmutable(envelope);
  const sourceGuards = [
    { key: higherPriorityKey, expected: null },
    { key: selectedKey, expected: 'source-v1' },
  ];

  values.set(higherPriorityKey, 'new-canonical-source');
  await assert.rejects(
    store.advancePointer({ profileId: PROFILE, expectedCurrentId: null, nextRealizationId: envelope.realization_id, sourceGuards }),
    /new_bos_launch_store_source_authority_changed/u,
  );
  assert.equal(values.has(`${namespace}:latest-compatible:${PROFILE}`), false);

  values.delete(higherPriorityKey);
  values.set(selectedKey, 'source-v2');
  await assert.rejects(
    store.advancePointer({ profileId: PROFILE, expectedCurrentId: null, nextRealizationId: envelope.realization_id, sourceGuards }),
    /new_bos_launch_store_source_authority_changed/u,
  );
  assert.equal(values.has(`${namespace}:latest-compatible:${PROFILE}`), false);

  values.set(selectedKey, 'source-v1');
  assert.equal((await store.advancePointer({
    profileId: PROFILE,
    expectedCurrentId: null,
    nextRealizationId: envelope.realization_id,
    sourceGuards,
  })).updated, true);
});

test('New BA pointer publication atomically rejects an assessment source change', async () => {
  const envelope = await syntheticBaEnvelope();
  const namespace = 'nonprod:new-ba:source-cas-test';
  const values = new Map([['business_assessment:synthetic', 'assessment-v1']]);
  const store = createMemoryNewBaRealizationStore({ namespace, values });
  await store.persistImmutable(envelope);
  values.set('business_assessment:synthetic', 'assessment-v2');

  await assert.rejects(
    store.advancePointer({
      profileId: envelope.profile_id,
      expectedCurrentId: null,
      nextRealizationId: envelope.realization_id,
      sourceGuards: [{ key: 'business_assessment:synthetic', expected: 'assessment-v1' }],
    }),
    /new_ba_store_source_authority_changed/u,
  );
  assert.equal(values.has(`${namespace}:latest-compatible:${envelope.profile_id}`), false);
});

test('New BOS modernization cannot publish across the final source-check-to-pointer race', async () => {
  const namespace = 'nonprod:new-bos:modernization-source-cas';
  const values = new Map();
  const canonicalKey = 'vault:profile:mm-20990101-selfheal';
  values.set(canonicalKey, JSON.stringify(canonicalEnvelope()));
  const canonicalReader = createReadOnlyCanonicalReader({ redis: { get: async (key) => values.get(key) ?? null } });
  const baseStore = createMemoryLaunchSafeRealizationStore({ namespace, values });
  const realizationStore = {
    inspect: (input) => baseStore.inspect(input),
    persistImmutable: (input, options) => baseStore.persistImmutable(input, options),
    async advancePointer(input) {
      values.set(canonicalKey, `${values.get(canonicalKey)} `);
      return baseStore.advancePointer(input);
    },
  };
  const service = createNewBosModernizationService({
    config: {
      staged: true, customerActive: true, canaryEnabled: false, providerEnabled: true, persistenceEnabled: true,
      baFusionValidated: true, allowedProfileIds: [], namespace, providerModel: 'gpt-5.6-sol',
    },
    canonicalReader,
    realizationStore,
    singleFlight: { run: async (_key, task) => task() },
    generator: async () => ({ artifact: syntheticBosEnvelope(PROFILE).artifact, provider_accounting: { calls: 0, store: false } }),
  });

  await assert.rejects(service.retrieve({ profileId: PROFILE }), /new_bos_launch_store_source_authority_changed/u);
  assert.equal(values.has(`${namespace}:latest-compatible:${PROFILE}`), false);
});

test('New BA modernization cannot publish across the final source-check-to-pointer race', async () => {
  const namespace = 'nonprod:new-ba:modernization-source-cas';
  const source = createAuthorizedSyntheticTopSource();
  const values = new Map([['canonical:ba:source', 'source-v1']]);
  const baseStore = createMemoryNewBaRealizationStore({ namespace, values });
  const frozen = createFrozenCanaryRealizationGenerator();
  const authorityReader = {
    async read() { return source; },
    async readWithSourceGuards() {
      return {
        source,
        sourceGuards: [{ key: 'canonical:ba:source', expected: 'source-v1' }],
      };
    },
  };
  const realizationStore = {
    inspect: (input) => baseStore.inspect(input),
    persistImmutable: (input, options) => baseStore.persistImmutable(input, options),
    async advancePointer(input) {
      values.set('canonical:ba:source', 'source-v2');
      return baseStore.advancePointer(input);
    },
  };
  const service = createNewBaModernizationService({
    config: {
      staged: true, customerActive: true, fusionValidated: true, canaryEnabled: false, providerEnabled: true,
      persistenceEnabled: true, allowedProfileIds: [], namespace, providerModel: 'gpt-5.6-sol',
    },
    authorityReader,
    realizationStore,
    singleFlight: { run: async (_key, task) => task() },
    generator: { generate: (input) => frozen.generate(input) },
  });

  await assert.rejects(service.retrieve({ profileId: source.profile_id }), /new_ba_store_source_authority_changed/u);
  assert.equal(values.has(`${namespace}:latest-compatible:${source.profile_id}`), false);
});

test('Redis realization pointer CAS carries exact present and absent source guards without persisting them', async () => {
  const envelope = syntheticBosEnvelope(PROFILE);
  const namespace = 'nonprod:new-bos:redis-source-cas-test';
  const artifactKey = `${namespace}:artifact:${PROFILE}:${envelope.realization_id}`;
  let evalCall = null;
  const redis = {
    async get(key) { return key === artifactKey ? JSON.stringify(envelope) : null; },
    async set() { return 'OK'; },
    async eval(...args) { evalCall = args; return [-1, '']; },
  };
  const store = createRedisLaunchSafeRealizationStore({ redis, namespace, persistenceEnabled: true });

  await assert.rejects(
    store.advancePointer({
      profileId: PROFILE,
      expectedCurrentId: null,
      nextRealizationId: envelope.realization_id,
      sourceGuards: [
        { key: 'source:present', expected: 'exact-private-source' },
        { key: 'source:absent', expected: null },
      ],
    }),
    /new_bos_launch_store_source_authority_changed/u,
  );
  assert.equal(evalCall[1], 3);
  assert.deepEqual(evalCall.slice(2, 5), [
    `${namespace}:latest-compatible:${PROFILE}`,
    'source:present',
    'source:absent',
  ]);
  assert.deepEqual(evalCall.slice(5), ['', envelope.realization_id, '1exact-private-source', '0']);
});

test('New BOS and New BA memory-store rollback remains a pointer-only CAS after guarded publication', async () => {
  const bosPrior = syntheticBosEnvelope(PROFILE);
  const bosNextIdentity = buildNewBosRealizationIdentity({
    profileId: PROFILE,
    canonicalSourceSha256: 'd'.repeat(64),
    rawEvidenceVersion: 'synthetic-self-heal-v1',
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: 'A',
  });
  const bosNext = buildLaunchSafeRealizationEnvelope({
    profileId: PROFILE,
    realizationIdentity: bosNextIdentity,
    artifact: bosPrior.artifact,
    compatibility: { class: 'A', label: 'FULLY_COMPATIBLE' },
    providerAccounting: { calls: 0, store: false },
  });
  const bosStore = createMemoryLaunchSafeRealizationStore({ namespace: 'nonprod:new-bos:rollback-regression' });
  await bosStore.persistImmutable(bosPrior);
  await bosStore.persistImmutable(bosNext);
  await bosStore.advancePointer({ profileId: PROFILE, nextRealizationId: bosPrior.realization_id });
  await bosStore.advancePointer({ profileId: PROFILE, expectedCurrentId: bosPrior.realization_id, nextRealizationId: bosNext.realization_id });
  assert.deepEqual(await bosStore.rollbackPointer({
    profileId: PROFILE,
    expectedCurrentId: bosNext.realization_id,
    priorRealizationId: bosPrior.realization_id,
  }), { rolled_back: true, from: bosNext.realization_id, to: bosPrior.realization_id });

  const baPrior = await syntheticBaEnvelope();
  const baSource = createAuthorizedSyntheticTopSource();
  const baCompatibility = classifyNewBaCompatibility(baSource);
  const baNextIdentity = buildNewBaRealizationIdentityV3({
    profileId: baSource.profile_id,
    assessmentId: baSource.assessment_id,
    evidenceSha256: 'e'.repeat(64),
    bosAuthoritySha256: baSource.bos_authority.sha256,
    bosFusionContractSha256: baSource.bos_authority.fusion_contract_sha256,
    bosEvidenceBoundarySha256: baSource.bos_authority.evidence_boundary_sha256,
    compatibilityClass: baCompatibility.class,
    providerModel: 'gpt-5.6-sol',
    verticalBinding: baSource.business_evidence.vertical_binding,
  });
  const baNext = buildLaunchSafeNewBaEnvelope({
    profileId: baSource.profile_id,
    realizationIdentity: baNextIdentity,
    artifact: baPrior.artifact,
    compatibility: baCompatibility,
    providerAccounting: { calls: 0, store: false },
  });
  const baStore = createMemoryNewBaRealizationStore({ namespace: 'nonprod:new-ba:rollback-regression' });
  await baStore.persistImmutable(baPrior);
  await baStore.persistImmutable(baNext);
  await baStore.advancePointer({ profileId: baSource.profile_id, nextRealizationId: baPrior.realization_id });
  await baStore.advancePointer({ profileId: baSource.profile_id, expectedCurrentId: baPrior.realization_id, nextRealizationId: baNext.realization_id });
  assert.deepEqual(await baStore.rollbackPointer({
    profileId: baSource.profile_id,
    expectedCurrentId: baNext.realization_id,
    priorRealizationId: baPrior.realization_id,
  }), { rolled_back: true, from: baNext.realization_id, to: baPrior.realization_id });
});

test('New BOS and New BA Redis-store rollback emits the legacy one-key pointer CAS', async () => {
  const bosEnvelope = syntheticBosEnvelope(PROFILE);
  const baEnvelope = await syntheticBaEnvelope();
  const cases = [
    {
      namespace: 'nonprod:new-bos:redis-rollback-regression',
      profileId: PROFILE,
      envelope: bosEnvelope,
      createStore: createRedisLaunchSafeRealizationStore,
    },
    {
      namespace: 'nonprod:new-ba:redis-rollback-regression',
      profileId: baEnvelope.profile_id,
      envelope: baEnvelope,
      createStore: createRedisNewBaRealizationStore,
    },
  ];
  for (const item of cases) {
    const artifactKey = `${item.namespace}:artifact:${item.profileId}:${item.envelope.realization_id}`;
    let evalCall = null;
    const redis = {
      async get(key) { return key === artifactKey ? JSON.stringify(item.envelope) : null; },
      async set() { return 'OK'; },
      async eval(...args) { evalCall = args; return [1, item.envelope.realization_id]; },
    };
    const store = item.createStore({ redis, namespace: item.namespace, persistenceEnabled: true });
    const result = await store.rollbackPointer({
      profileId: item.profileId,
      expectedCurrentId: 'current-realization',
      priorRealizationId: item.envelope.realization_id,
    });
    assert.equal(result.rolled_back, true);
    assert.equal(evalCall[1], 1);
    assert.deepEqual(evalCall.slice(2), [
      `${item.namespace}:latest-compatible:${item.profileId}`,
      'current-realization',
      item.envelope.realization_id,
    ]);
  }
});

test('recovery contract distinguishes truth-safe machinery recovery from human review', () => {
  assert.equal(classifyProviderCheckpoint(null).state, REALIZATION_RECOVERY_STATES.MISSING);
  assert.equal(classifyProviderCheckpoint({ provider_status: 'in_progress' }).state, REALIZATION_RECOVERY_STATES.RESUMABLE_BACKGROUND);
  assert.equal(classifyProviderCheckpoint({ provider_status: 'incomplete' }).state, REALIZATION_RECOVERY_STATES.TERMINAL_UNRESUMABLE_BACKGROUND);
  assert.equal(classifyProviderCheckpoint({ provider_status: 'unknown' }).state, REALIZATION_RECOVERY_STATES.HUMAN_REVIEW_REQUIRED);
  assert.equal(classifyRealizationInspection({ state: 'publishable_orphan' }), REALIZATION_RECOVERY_STATES.POINTER_REPAIRABLE);
  assert.equal(classifyRealizationInspection({ state: 'missing_derived' }), REALIZATION_RECOVERY_STATES.DERIVED_RECONSTRUCTABLE);
  assert.equal(classifyRealizationInspection({ state: 'corrupt_derived' }), REALIZATION_RECOVERY_STATES.DERIVED_RECONSTRUCTABLE);
  assert.equal(classifyRealizationInspection({ state: 'stale' }, { compatiblePrior: true }), REALIZATION_RECOVERY_STATES.COMPATIBLE_PRIOR);
  assert.equal(classifyRecoveryFailure(Object.assign(new Error('poll timeout'), { background_pending: true })), REALIZATION_RECOVERY_STATES.RESUMABLE_BACKGROUND);
  assert.equal(classifyRecoveryFailure(new Error('redis_connection_timeout')), REALIZATION_RECOVERY_STATES.TRANSIENT_INFRASTRUCTURE);
  assert.equal(classifyRecoveryFailure(new Error('canonical_evidence_hash_mismatch')), REALIZATION_RECOVERY_STATES.HUMAN_REVIEW_REQUIRED);
});

test('New BOS preserves corrupt derived bytes, replaces only the proven invalid artifact, and serves the repaired identity', async () => {
  const envelope = syntheticBosEnvelope();
  const namespace = 'preview:new-bos:corrupt-recovery-test';
  const values = new Map();
  const artifactKey = `${namespace}:artifact:${envelope.profile_id}:${envelope.realization_id}`;
  const pointerKey = `${namespace}:latest-compatible:${envelope.profile_id}`;
  const corruptSerialized = '{"truncated":';
  values.set(artifactKey, corruptSerialized);
  values.set(pointerKey, envelope.realization_id);
  const store = createMemoryLaunchSafeRealizationStore({ namespace, values });

  const inspection = await store.inspect({ profileId: envelope.profile_id, desiredIdentity: envelope.realization_identity });
  assert.equal(inspection.state, 'corrupt_derived');
  assert.deepEqual(inspection.corruption, { realization_id: envelope.realization_id, serialized_sha256: sha256(corruptSerialized) });
  await assert.rejects(store.persistImmutable(envelope), /corrupt_artifact_requires_recovery/u);

  const persisted = await store.persistImmutable(envelope, { corruptRecovery: inspection.corruption });
  assert.equal(persisted.recovered_corrupt, true);
  assert.equal(values.get(`${artifactKey}:corrupt-derived-archive:${sha256(corruptSerialized)}`), corruptSerialized);
  assert.equal((await store.inspect({ profileId: envelope.profile_id, desiredIdentity: envelope.realization_identity })).state, 'current');
});

test('New BOS modernization forwards only the exact corruption receipt and records the recovered path', async () => {
  const artifact = syntheticBosEnvelope(PROFILE).artifact;
  let persistedOptions = null;
  let published = 0;
  const realizationStore = {
    inspect: async ({ desiredIdentity }) => ({
      state: 'corrupt_derived',
      current: null,
      pointer: desiredIdentity.realization_id,
      corruption: { realization_id: desiredIdentity.realization_id, serialized_sha256: 'd'.repeat(64) },
    }),
    persistImmutable: async (_envelope, options) => {
      persistedOptions = options;
      return { written: true, recovered_corrupt: true, corrupt_archive_sha256: 'd'.repeat(64) };
    },
    advancePointer: async () => { published += 1; return { updated: true }; },
  };
  const service = createNewBosModernizationService({
    config: {
      staged: true, customerActive: true, canaryEnabled: false, providerEnabled: true, persistenceEnabled: true,
      baFusionValidated: true, allowedProfileIds: [], namespace: 'nonprod:new-bos:self-healing-test', providerModel: 'gpt-5.6-sol',
    },
    canonicalReader: { read: async () => canonicalEnvelope() },
    realizationStore,
    singleFlight: { run: async (_key, task) => task() },
    generator: async () => ({ artifact, provider_accounting: { calls: 0, store: false } }),
  });
  const result = await service.retrieve({ profileId: PROFILE });
  assert.equal(result.receipt.path, 'rebuilt_corrupt_derived');
  assert.equal(persistedOptions.corruptRecovery.serialized_sha256, 'd'.repeat(64));
  assert.equal(published, 1);
  assert.ok(service.diagnostics.snapshot().some(({ event_type: type }) => type === 'corrupt_derived_recovered'));
});

function authorityGuardedBosModernization({ failAuthorityCheckAt }) {
  const artifact = syntheticBosEnvelope(PROFILE).artifact;
  const calls = { authority: 0, generator: 0, persist: 0, pointer: 0 };
  const service = createNewBosModernizationService({
    config: {
      staged: true, customerActive: true, canaryEnabled: false, providerEnabled: true, persistenceEnabled: true,
      baFusionValidated: true, allowedProfileIds: [], namespace: 'nonprod:new-bos:manager-authority-test', providerModel: 'gpt-5.6-sol',
    },
    canonicalReader: { read: async () => canonicalEnvelope() },
    realizationStore: {
      inspect: async () => ({ state: 'missing', current: null, pointer: null }),
      persistImmutable: async () => { calls.persist += 1; return { written: true }; },
      advancePointer: async () => { calls.pointer += 1; return { updated: true }; },
    },
    singleFlight: { run: async (_key, task) => task() },
    generator: async ({ assertCurrentAuthority }) => {
      calls.generator += 1;
      assert.equal(typeof assertCurrentAuthority, 'function');
      return { artifact, provider_accounting: { calls: 0, store: false } };
    },
  });
  const assertCurrentAuthority = async () => {
    calls.authority += 1;
    if (calls.authority === failAuthorityCheckAt) throw new Error('RECRUITING_MANAGER_SESSION_REQUIRED');
  };
  return { service, calls, assertCurrentAuthority };
}

test('New BOS manager preparation rechecks live authority before entering provider generation', async () => {
  const setup = authorityGuardedBosModernization({ failAuthorityCheckAt: 1 });
  await assert.rejects(
    setup.service.retrieve({ profileId: PROFILE, assertCurrentAuthority: setup.assertCurrentAuthority }),
    /RECRUITING_MANAGER_SESSION_REQUIRED/u,
  );
  assert.deepEqual(setup.calls, { authority: 1, generator: 0, persist: 0, pointer: 0 });
});

test('New BOS manager preparation rechecks live authority immediately before immutable persistence', async () => {
  const setup = authorityGuardedBosModernization({ failAuthorityCheckAt: 3 });
  await assert.rejects(
    setup.service.retrieve({ profileId: PROFILE, assertCurrentAuthority: setup.assertCurrentAuthority }),
    /RECRUITING_MANAGER_SESSION_REQUIRED/u,
  );
  assert.deepEqual(setup.calls, { authority: 3, generator: 1, persist: 0, pointer: 0 });
});

test('New BOS manager preparation leaves only an immutable orphan when authority is lost before pointer advance', async () => {
  const setup = authorityGuardedBosModernization({ failAuthorityCheckAt: 4 });
  await assert.rejects(
    setup.service.retrieve({ profileId: PROFILE, assertCurrentAuthority: setup.assertCurrentAuthority }),
    /RECRUITING_MANAGER_SESSION_REQUIRED/u,
  );
  assert.deepEqual(setup.calls, { authority: 4, generator: 1, persist: 1, pointer: 0 });
});

test('New BOS refuses immutable persistence when canonical source identity changes during generation', async () => {
  const artifact = syntheticBosEnvelope(PROFILE).artifact;
  let canonicalChanged = false;
  let persisted = 0;
  let published = 0;
  const service = createNewBosModernizationService({
    config: {
      staged: true, customerActive: true, canaryEnabled: false, providerEnabled: true, persistenceEnabled: true,
      baFusionValidated: true, allowedProfileIds: [], namespace: 'nonprod:new-bos:canonical-race-test', providerModel: 'gpt-5.6-sol',
    },
    canonicalReader: {
      read: async () => {
        const envelope = canonicalEnvelope();
        if (canonicalChanged) {
          envelope.canonical_dossier.canonical_profile_json.intake_answers[0].answer_text += ' Canonical revision.';
        }
        return envelope;
      },
    },
    realizationStore: {
      inspect: async () => ({ state: 'missing', current: null, pointer: null }),
      persistImmutable: async () => { persisted += 1; return { written: true }; },
      advancePointer: async () => { published += 1; return { updated: true }; },
    },
    singleFlight: { run: async (_key, task) => task() },
    generator: async () => {
      canonicalChanged = true;
      return { artifact, provider_accounting: { calls: 0, store: false } };
    },
  });

  await assert.rejects(
    service.retrieve({ profileId: PROFILE }),
    /new_bos_canonical_source_authority_changed/u,
  );
  assert.equal(persisted, 0);
  assert.equal(published, 0);
});

test('New BOS refuses orphan pointer repair when canonical source identity changes after inspection', async () => {
  const current = syntheticBosEnvelope(PROFILE);
  let canonicalChanged = false;
  let published = 0;
  const service = createNewBosModernizationService({
    config: {
      staged: true, customerActive: true, canaryEnabled: false, providerEnabled: true, persistenceEnabled: true,
      baFusionValidated: true, allowedProfileIds: [], namespace: 'nonprod:new-bos:pointer-race-test', providerModel: 'gpt-5.6-sol',
    },
    canonicalReader: {
      read: async () => {
        const envelope = canonicalEnvelope();
        if (canonicalChanged) {
          envelope.canonical_dossier.canonical_profile_json.intake_answers[0].answer_text += ' Canonical revision.';
        }
        return envelope;
      },
    },
    realizationStore: {
      inspect: async () => {
        canonicalChanged = true;
        return { state: 'publishable_orphan', current, pointer: null };
      },
      persistImmutable: async () => ({ written: false }),
      advancePointer: async () => { published += 1; return { updated: true }; },
    },
    singleFlight: { run: async (_key, task) => task() },
    generator: async () => ({ artifact: current.artifact, provider_accounting: { calls: 0, store: false } }),
  });

  await assert.rejects(
    service.retrieve({ profileId: PROFILE }),
    /new_bos_canonical_source_authority_changed/u,
  );
  assert.equal(published, 0);
});

test('New BA applies the same exact-hash corrupt-derived recovery without changing governed identity', async () => {
  const envelope = await syntheticBaEnvelope();
  const namespace = 'preview:new-ba:corrupt-recovery-test';
  const values = new Map();
  const artifactKey = `${namespace}:artifact:${envelope.profile_id}:${envelope.realization_id}`;
  const pointerKey = `${namespace}:latest-compatible:${envelope.profile_id}`;
  const corruptSerialized = '{"partial_customer_view_model":true';
  values.set(artifactKey, corruptSerialized);
  values.set(pointerKey, envelope.realization_id);
  const store = createMemoryNewBaRealizationStore({ namespace, values });

  const inspection = await store.inspect({ profileId: envelope.profile_id, desiredIdentity: envelope.realization_identity });
  assert.equal(inspection.state, 'corrupt_derived');
  await assert.rejects(
    store.persistImmutable(envelope, { corruptRecovery: { ...inspection.corruption, serialized_sha256: '0'.repeat(64) } }),
    /corrupt_artifact_requires_recovery/u,
  );
  const persisted = await store.persistImmutable(envelope, { corruptRecovery: inspection.corruption });
  assert.equal(persisted.recovered_corrupt, true);
  assert.equal(values.get(`${artifactKey}:corrupt-derived-archive:${sha256(corruptSerialized)}`), corruptSerialized);
  assert.equal((await store.inspect({ profileId: envelope.profile_id, desiredIdentity: envelope.realization_identity })).state, 'current');
});

test('New BA modernization reconstructs a proven corrupt derived artifact without changing business authority', async () => {
  const source = createAuthorizedSyntheticTopSource();
  const envelope = await syntheticBaEnvelope();
  let persistedOptions = null;
  const service = createNewBaModernizationService({
    config: {
      staged: true, customerActive: true, fusionValidated: true, canaryEnabled: false, providerEnabled: true,
      persistenceEnabled: true, allowedProfileIds: [], namespace: 'nonprod:new-ba:self-healing-test', providerModel: 'gpt-5.6-sol',
    },
    authorityReader: { read: async () => source },
    realizationStore: {
      inspect: async ({ desiredIdentity }) => ({
        state: 'corrupt_derived', current: null, pointer: desiredIdentity.realization_id,
        corruption: { realization_id: desiredIdentity.realization_id, serialized_sha256: 'e'.repeat(64) },
      }),
      persistImmutable: async (_candidate, options) => {
        persistedOptions = options;
        return { written: true, recovered_corrupt: true, corrupt_archive_sha256: 'e'.repeat(64) };
      },
      advancePointer: async () => ({ updated: true }),
    },
    singleFlight: { run: async (_key, task) => task() },
    generator: {
      advance: async () => ({
        complete: true,
        artifact: envelope.artifact,
        provider_accounting: { calls: 0, store: false },
        source_realization_identity: {
          version: envelope.realization_identity.version,
          realization_id: envelope.realization_identity.realization_id,
          sha256: envelope.realization_identity.sha256,
        },
      }),
    },
  });
  const result = await service.retrieve({ profileId: source.profile_id });
  assert.equal(result.receipt.path, 'rebuilt_corrupt_derived');
  assert.equal(persistedOptions.corruptRecovery.serialized_sha256, 'e'.repeat(64));
  assert.ok(service.diagnostics.snapshot().some(({ event_type: type }) => type === 'corrupt_derived_recovered'));
});

test('profile-owner receipt reads cannot repair, generate, persist, or publish a missing current BOS artifact', async () => {
  const envelope = syntheticBosEnvelope(PROFILE);
  let singleFlightRuns = 0;
  let generatorCalls = 0;
  let persistenceCalls = 0;
  let pointerWrites = 0;
  const service = createNewBosModernizationService({
    config: {
      staged: true, customerActive: true, canaryEnabled: false, providerEnabled: true, persistenceEnabled: true,
      baFusionValidated: true, allowedProfileIds: [], namespace: 'nonprod:new-bos:owner-read-test', providerModel: 'gpt-5.6-sol',
    },
    canonicalReader: { read: async () => canonicalEnvelope() },
    realizationStore: {
      inspect: async () => ({ state: 'publishable_orphan', current: envelope, pointer: null }),
      persistImmutable: async () => { persistenceCalls += 1; return { written: true }; },
      advancePointer: async () => { pointerWrites += 1; return { updated: true }; },
    },
    singleFlight: { run: async (_key, task) => { singleFlightRuns += 1; return task(); } },
    generator: async () => { generatorCalls += 1; return { artifact: envelope.artifact }; },
  });

  await assert.rejects(
    service.retrieve({ profileId: PROFILE, readOnly: true }),
    /public_product_current_artifact_unavailable/u,
  );
  assert.deepEqual({ singleFlightRuns, generatorCalls, persistenceCalls, pointerWrites }, {
    singleFlightRuns: 0,
    generatorCalls: 0,
    persistenceCalls: 0,
    pointerWrites: 0,
  });

  let seenReadOnly = false;
  const response = {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => ({ mode: 'profile_owner_receipt' }),
    serviceFactory: async () => ({
      retrieve: async ({ readOnly: receiptReadOnly }) => {
        seenReadOnly = receiptReadOnly;
        return { artifact: { profile_id: PROFILE } };
      },
    }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(seenReadOnly, true);
});

test('profile-owner receipt reads cannot repair, generate, persist, publish, or project a missing current BA artifact', async () => {
  const source = createAuthorizedSyntheticTopSource();
  const envelope = await syntheticBaEnvelope();
  let singleFlightRuns = 0;
  let generatorCalls = 0;
  let persistenceCalls = 0;
  let pointerWrites = 0;
  const service = createNewBaModernizationService({
    config: {
      staged: true, customerActive: true, fusionValidated: true, canaryEnabled: false, providerEnabled: true,
      persistenceEnabled: true, allowedProfileIds: [], namespace: 'nonprod:new-ba:owner-read-test', providerModel: 'gpt-5.6-sol',
    },
    authorityReader: { read: async () => source },
    realizationStore: {
      inspect: async () => ({ state: 'publishable_orphan', current: envelope, pointer: null }),
      persistImmutable: async () => { persistenceCalls += 1; return { written: true }; },
      advancePointer: async () => { pointerWrites += 1; return { updated: true }; },
    },
    singleFlight: { run: async (_key, task) => { singleFlightRuns += 1; return task(); } },
    generator: { advance: async () => { generatorCalls += 1; return { complete: false }; } },
  });

  await assert.rejects(
    service.retrieve({ profileId: source.profile_id, readOnly: true }),
    /public_product_current_artifact_unavailable/u,
  );
  assert.deepEqual({ singleFlightRuns, generatorCalls, persistenceCalls, pointerWrites }, {
    singleFlightRuns: 0,
    generatorCalls: 0,
    persistenceCalls: 0,
    pointerWrites: 0,
  });

  let projectionCalls = 0;
  let seenReadOnly = false;
  const response = {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await createNewBaRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => ({ mode: 'profile_owner_receipt' }),
    serviceFactory: async () => ({
      service: {
        retrieve: async ({ readOnly }) => {
          seenReadOnly = readOnly;
          return { artifact: { profile_id: source.profile_id } };
        },
      },
    }),
    onCanonicalServed: async () => { projectionCalls += 1; },
  })({ method: 'GET', query: { id: source.profile_id }, headers: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(seenReadOnly, true);
  assert.equal(projectionCalls, 0);
});

test('customer recovery surfaces keep provider and internal failure details out of customer prose', async () => {
  const [bosSource, baSource] = await Promise.all([
    readFile(new URL('../src/components/newBosPersonalityDnaV1/NewBosProductionCanary.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/baProductionReadinessV1/NewBaProductionCanary.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(bosSource, /Your saved information is safe\. Please try again later\./u);
  assert.match(baSource, /Your governed Business Twin is being prepared\. This page will update automatically\./u);
  assert.match(baSource, /for \(let attempt = 0; attempt < 450;/u);
  assert.match(baSource, /Your saved information is safe\. Please try again later\./u);
});

test('BOS and BA 202 responses expose only customer-safe processing state', async () => {
  const response = () => ({
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const internalBosPending = {
    pending: true, status: 'REALIZATION_RECOVERY_IN_PROGRESS', retry_after_ms: 9000,
    profile_id: PROFILE, desired_realization_id: 'internal-realization', recovery_state: 'RESUMABLE_BACKGROUND', path: 'internal-path',
  };
  const bosResponse = response();
  await createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ retrieve: async () => internalBosPending }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, bosResponse);
  assert.equal(bosResponse.statusCode, 202);
  assert.deepEqual(Object.keys(bosResponse.body).sort(), ['message', 'pending', 'phase', 'resumable', 'retry_after_ms', 'status']);
  assert.equal(bosResponse.body.phase, 'UNDERSTANDING_PROFILE');
  assert.equal(bosResponse.body.resumable, true);
  assert.equal(bosResponse.body.retry_after_ms, 5000);

  const baResponse = response();
  await createNewBaRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ service: { retrieve: async () => ({
      pending: true, status: 'GENERATION_ADVANCING', retry_after_ms: 1500,
      profile_id: PROFILE, assessment_id: 'ba-internal', accepted_stage: 'whole_business_model_v1', next_stage: 'five_futures_v2',
    }) } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, baResponse);
  assert.equal(baResponse.statusCode, 202);
  assert.deepEqual(Object.keys(baResponse.body).sort(), ['message', 'pending', 'retry_after_ms', 'status']);
});

test('resumable inspector is platform-protected only by the server-bound authority secret', async () => {
  const response = () => ({
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const calls = [];
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: false,
      customerActive: true,
      platformAuthoritySecret: PLATFORM_AUTHORITY,
    },
    serviceFactory: async () => ({
      inspectResumable: async (input) => { calls.push(input); return { status: 'ok' }; },
    }),
  });
  const candidate = response();
  await handler({
    method: 'GET',
    query: { id: PROFILE, diagnostic: 'resumable-state' },
    headers: { host: 'candidate.example.vercel.app', 'x-more-platform-authority': PLATFORM_AUTHORITY },
  }, candidate);
  assert.equal(candidate.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);

  const publicDomain = response();
  await handler({
    method: 'GET',
    query: { id: PROFILE, diagnostic: 'resumable-state' },
    headers: { host: 'moremindmap.com' },
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('stale surface-routing replacement is POST-only and server-authority protected', async () => {
  const response = () => ({
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const calls = [];
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: false,
      customerActive: true,
      platformAuthoritySecret: PLATFORM_AUTHORITY,
    },
    serviceFactory: async () => ({
      replaceStaleSurfaceRouting: async (input) => {
        calls.push(input);
        if (!input.platformProtected) throw new Error('new_bos_stale_queue_replacement_requires_protected_candidate');
        return { status: 'ok' };
      },
    }),
  });
  const candidate = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'replace-stale-surface-routing' },
    headers: { host: 'candidate.example.vercel.app', 'x-more-platform-authority': PLATFORM_AUTHORITY },
    body: {
      expected_campaign_sha256: '1'.repeat(64),
      expected_unit_identity_sha256: '2'.repeat(64),
      expected_request_sha256: '3'.repeat(64),
      expected_provider_response_id_sha256: '4'.repeat(64),
    },
  }, candidate);
  assert.equal(candidate.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);
  assert.equal(calls[0].expectedCampaignSha256, '1'.repeat(64));

  const publicDomain = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'replace-stale-surface-routing' },
    headers: { host: 'moremindmap.com' },
    body: {},
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 403);
  assert.equal(calls.length, 1);

  const unsupported = response();
  await handler({ method: 'POST', query: { id: PROFILE }, headers: {} }, unsupported);
  assert.equal(unsupported.statusCode, 405);
});

test('invalid stage-3 repair route is hash-bound and server-authority protected', async () => {
  const response = () => ({
    statusCode: null, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const calls = [];
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: false,
      customerActive: true,
      platformAuthoritySecret: PLATFORM_AUTHORITY,
    },
    serviceFactory: async () => ({
      repairInvalidStage3VectorFree: async (input) => {
        calls.push(input);
        if (!input.platformProtected) throw new Error('new_bos_invalid_stage3_repair_requires_protected_candidate');
        return { status: 'ok' };
      },
    }),
  });
  const exact = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'repair-invalid-stage3-vector-free' },
    headers: { host: 'candidate.example.vercel.app', 'x-more-platform-authority': PLATFORM_AUTHORITY },
    body: {
      expected_campaign_sha256: '1'.repeat(64),
      expected_stage3: { accepted_value_sha256: '2'.repeat(64) },
      expected_stage4: { accepted_value_sha256: '3'.repeat(64) },
    },
  }, exact);
  assert.equal(exact.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);
  assert.equal(calls[0].expectedStage3.accepted_value_sha256, '2'.repeat(64));

  const publicDomain = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'repair-invalid-stage3-vector-free' },
    headers: { host: 'moremindmap.com' },
    body: {},
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('completed stage-3 diagnostic is server-authority protected, read-only, and hash-bound', async () => {
  const response = () => ({
    statusCode: null, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const calls = [];
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: false,
      customerActive: true,
      platformAuthoritySecret: PLATFORM_AUTHORITY,
    },
    serviceFactory: async () => ({
      inspectCompletedStage3Validation: async (input) => {
        calls.push(input);
        if (!input.platformProtected) throw new Error('new_bos_completed_stage3_diagnostic_requires_protected_candidate');
        return { category: 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION', checkpoint_writes: 0, provider_submissions: 0 };
      },
    }),
  });
  const exact = response();
  await handler({
    method: 'GET',
    query: {
      id: PROFILE,
      diagnostic: 'completed-stage3-validation',
      expected_campaign_sha256: '1'.repeat(64),
      expected_unit_identity_sha256: '2'.repeat(64),
      expected_request_sha256: '3'.repeat(64),
      expected_provider_response_id_sha256: '4'.repeat(64),
    },
    headers: { host: 'candidate.example.vercel.app', 'x-more-platform-authority': PLATFORM_AUTHORITY },
  }, exact);
  assert.equal(exact.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);
  assert.equal(calls[0].expectedProviderResponseIdSha256, '4'.repeat(64));
  assert.equal(exact.body.checkpoint_writes, 0);
  assert.equal(exact.body.provider_submissions, 0);

  const publicDomain = response();
  await handler({
    method: 'GET',
    query: { id: PROFILE, diagnostic: 'completed-stage3-validation' },
    headers: { host: 'moremindmap.com' },
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('completed stage-3 semantic-rejection classification is POST-only, hash-bound, and server-authority protected', async () => {
  const response = () => ({
    statusCode: null, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const calls = [];
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: false,
      customerActive: true,
      platformAuthoritySecret: PLATFORM_AUTHORITY,
    },
    serviceFactory: async () => ({
      classifyCompletedStage3SemanticRejection: async (input) => {
        calls.push(input);
        if (!input.platformProtected) throw new Error('new_bos_completed_stage3_classification_requires_protected_candidate');
        return {
          checkpoint_state: 'SEMANTIC_REJECTED',
          semantic_rejection_code: 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION',
          checkpoint_writes: 1,
          provider_retrievals: 1,
          provider_submissions: 0,
        };
      },
    }),
  });
  const exact = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'classify-completed-stage3-semantic-rejection' },
    headers: { host: 'candidate.example.vercel.app', 'x-more-platform-authority': PLATFORM_AUTHORITY },
    body: {
      expected_campaign_sha256: '1'.repeat(64),
      expected_unit_identity_sha256: '2'.repeat(64),
      expected_request_sha256: '3'.repeat(64),
      expected_provider_response_id_sha256: '4'.repeat(64),
    },
  }, exact);
  assert.equal(exact.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);
  assert.equal(calls[0].expectedCampaignSha256, '1'.repeat(64));
  assert.equal(calls[0].expectedProviderResponseIdSha256, '4'.repeat(64));
  assert.equal(exact.body.checkpoint_state, 'SEMANTIC_REJECTED');
  assert.equal(exact.body.checkpoint_writes, 1);
  assert.equal(exact.body.provider_retrievals, 1);
  assert.equal(exact.body.provider_submissions, 0);

  const publicDomain = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'classify-completed-stage3-semantic-rejection' },
    headers: { host: 'moremindmap.com' },
    body: {},
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('semantic-rejected Stage-3 replacement is one-operation, hash-bound, and server-authority protected', async () => {
  const response = () => ({
    statusCode: null, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const calls = [];
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: false,
      customerActive: true,
      platformAuthoritySecret: PLATFORM_AUTHORITY,
    },
    serviceFactory: async () => ({
      replaceSemanticRejectedStage3: async (input) => {
        calls.push(input);
        if (!input.platformProtected) throw new Error('new_bos_semantic_rejected_stage3_replacement_requires_protected_candidate');
        return { status: 'STAGE3_SEMANTIC_REJECTION_REPLACEMENT_IN_PROGRESS', provider_submissions: 1 };
      },
    }),
  });
  const exact = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'replace-semantic-rejected-stage3' },
    headers: { host: 'candidate.example.vercel.app', 'x-more-platform-authority': PLATFORM_AUTHORITY },
    body: {
      expected_campaign_sha256: '1'.repeat(64),
      expected_stage3: {
        unit_identity_sha256: '2'.repeat(64),
        request_sha256: '3'.repeat(64),
        provider_response_id_sha256: '4'.repeat(64),
        semantic_validation_code_sha256: '5'.repeat(64),
      },
    },
  }, exact);
  assert.equal(exact.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);
  assert.equal(calls[0].expectedCampaignSha256, '1'.repeat(64));
  assert.equal(calls[0].expectedStage3.semantic_validation_code_sha256, '5'.repeat(64));
  assert.equal(exact.body.provider_submissions, 1);

  const publicDomain = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'replace-semantic-rejected-stage3' },
    headers: { host: 'moremindmap.com' },
    body: {},
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('Stage-3 request-contract V2 replacement is POST-only, hash-bound, and server-authority protected', async () => {
  const response = () => ({
    statusCode: null, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const calls = [];
  const handler = createNewBosProductionRouteHandler({
    config: {
      staged: true,
      canaryEnabled: false,
      customerActive: true,
      platformAuthoritySecret: PLATFORM_AUTHORITY,
    },
    serviceFactory: async () => ({
      replaceStage3RequestContractV2: async (input) => {
        calls.push(input);
        if (!input.platformProtected) throw new Error('new_bos_stage3_request_contract_v2_requires_protected_candidate');
        return { status: 'STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2_IN_PROGRESS', provider_submissions: 1 };
      },
    }),
  });
  const exact = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'replace-stage3-request-contract-v2' },
    headers: { host: 'candidate.example.vercel.app', 'x-more-platform-authority': PLATFORM_AUTHORITY },
    body: {
      expected_campaign_sha256: '1'.repeat(64),
      expected_stage3: {
        unit_identity_sha256: '2'.repeat(64),
        request_sha256: '3'.repeat(64),
        provider_response_id_sha256: '4'.repeat(64),
        semantic_validation_code_sha256: '5'.repeat(64),
      },
    },
  }, exact);
  assert.equal(exact.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);
  assert.equal(calls[0].expectedStage3.provider_response_id_sha256, '4'.repeat(64));

  const publicDomain = response();
  await handler({
    method: 'POST',
    query: { id: PROFILE, action: 'replace-stage3-request-contract-v2' },
    headers: { host: 'moremindmap.com' },
    body: {},
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 403);
  assert.equal(calls.length, 1);
});

test('machinery failures return generic customer codes while governed truth failures stay explicit', async () => {
  const makeResponse = () => ({
    statusCode: null, body: null, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const machinery = makeResponse();
  await createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ retrieve: async () => { throw new Error('new_bos_background_terminal_failure:provider_internal'); } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, machinery);
  assert.equal(machinery.body.safe_code, 'new_bos_temporarily_unavailable');
  assert.deepEqual(Object.keys(machinery.body).sort(), ['error', 'safe_code']);
  assert.doesNotMatch(JSON.stringify(machinery.body), /provider_internal|background_terminal_failure/u);

  const truth = makeResponse();
  await createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ retrieve: async () => { throw new Error('new_bos_modernization_requires_evidence_or_review:A'); } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, truth);
  assert.equal(truth.body.safe_code, 'new_bos_modernization_requires_evidence_or_review');

  const bosReadOnlyUnavailable = makeResponse();
  await createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ retrieve: async () => { throw new Error('public_product_current_artifact_unavailable'); } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, bosReadOnlyUnavailable);
  assert.equal(bosReadOnlyUnavailable.statusCode, 404);
  assert.equal(bosReadOnlyUnavailable.body.safe_code, 'public_product_current_artifact_unavailable');

  const baMachinery = makeResponse();
  await createNewBaRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ service: { retrieve: async () => { throw new Error('provider_timeout:upstream_detail'); } } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, baMachinery);
  assert.equal(baMachinery.body.safe_code, 'new_ba_temporarily_unavailable');
  assert.deepEqual(Object.keys(baMachinery.body).sort(), ['error', 'safe_code']);
  assert.doesNotMatch(JSON.stringify(baMachinery.body), /upstream_detail|TRANSIENT_INFRASTRUCTURE/u);

  const baReadOnlyUnavailable = makeResponse();
  await createNewBaRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ service: { retrieve: async () => { throw new Error('public_product_current_artifact_unavailable'); } } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, baReadOnlyUnavailable);
  assert.equal(baReadOnlyUnavailable.statusCode, 404);
  assert.equal(baReadOnlyUnavailable.body.safe_code, 'public_product_current_artifact_unavailable');
});

test('New BOS archives one terminal checkpoint and permits exactly one replacement submission', async () => {
  const redis = redisFixture();
  const recoveryEvents = [];
  const store = createRedisNewBosBackgroundResponseStore({ redis, namespace: 'nonprod:new-bos:self-healing-test', onRecoveryEvent: async (event) => recoveryEvents.push(event) });
  await store.save({ realizationIdentitySha256: IDENTITY, event: { provider_response_id: 'resp_failed_1', scientific_request_sha256: REQUEST, status: 'incomplete' } });
  const prepared = await store.prepare({ realizationIdentitySha256: IDENTITY });
  assert.equal(prepared.disposition, 'start_replacement');
  assert.equal(prepared.archive.version, 'new_bos_terminal_checkpoint_archive_v1');
  assert.equal(prepared.archive.provider_response_id, 'resp_failed_1');
  assert.equal(prepared.archive.raw_provider_payload_persisted, false);
  assert.deepEqual(recoveryEvents, [{
    event_type: 'terminal_checkpoint_retired',
    provider_status: 'incomplete',
    incomplete_details_reason: null,
    usage: null,
    replacement_authorized: true,
    raw_provider_payload_persisted: false,
  }]);
  assert.equal(await store.load({ realizationIdentitySha256: IDENTITY }), null);
  await assert.rejects(store.prepare({ realizationIdentitySha256: IDENTITY }), /automatic_recovery_claim_incomplete/u);

  await store.save({ realizationIdentitySha256: IDENTITY, event: { provider_response_id: 'resp_failed_2', scientific_request_sha256: REQUEST, status: 'failed' } });
  await assert.rejects(store.prepare({ realizationIdentitySha256: IDENTITY }), /automatic_recovery_exhausted/u);
  const serialized = [...redis.values.values()].join('\n');
  assert.doesNotMatch(serialized, /answer|prompt|request_body|response_body|customer_payload/iu);
});

test('New BA applies the same one-replacement boundary independently per governed stage', async () => {
  const redis = redisFixture();
  const store = createRedisNewBaBackgroundResponseStore({ redis, namespace: 'nonprod:new-ba:self-healing-test' });
  const input = { profileId: PROFILE, generationIdentitySha256: IDENTITY, stage: 'whole_business_model_v1' };
  await store.save({ ...input, event: { provider_response_id: 'resp_ba_failed_1', scientific_request_sha256: REQUEST, status: 'failed' } });
  const prepared = await store.prepare(input);
  assert.equal(prepared.disposition, 'start_replacement');
  assert.equal(prepared.archive.version, 'new_ba_terminal_checkpoint_archive_v1');
  assert.equal(prepared.archive.profile_id, PROFILE);
  assert.equal(prepared.archive.stage, 'whole_business_model_v1');
  await store.save({ ...input, event: { provider_response_id: 'resp_ba_failed_2', scientific_request_sha256: REQUEST, status: 'cancelled' } });
  await assert.rejects(store.prepare(input), /automatic_recovery_exhausted/u);

  const nextStage = { ...input, stage: 'five_futures_v2' };
  assert.equal((await store.prepare(nextStage)).disposition, 'start_new');
});

test('New BOS returns a truthful resumable processing state instead of a terminal interactive timeout', async () => {
  const backgroundPending = Object.assign(new Error('new_bos_provider_background_in_progress'), { background_pending: true });
  const service = createNewBosModernizationService({
    config: {
      staged: true,
      customerActive: true,
      canaryEnabled: false,
      providerEnabled: true,
      persistenceEnabled: true,
      baFusionValidated: true,
      allowedProfileIds: [],
      namespace: 'nonprod:new-bos:self-healing-test',
      providerModel: 'gpt-5.6-sol',
    },
    canonicalReader: { read: async () => canonicalEnvelope() },
    realizationStore: { inspect: async () => ({ state: 'missing', current: null, pointer: null }) },
    singleFlight: { run: async (_key, task) => task() },
    generator: async () => { throw backgroundPending; },
  });
  const result = await service.retrieve({ profileId: PROFILE });
  assert.equal(result.pending, true);
  assert.equal(result.status, 'REALIZATION_RECOVERY_IN_PROGRESS');
  assert.equal(result.recovery_state, 'RESUMABLE_BACKGROUND');
  assert.equal(Object.hasOwn(result, 'provider_response_id'), false);

  const response = {
    statusCode: null,
    body: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  const handler = createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => true,
    serviceFactory: async () => ({ retrieve: async () => result }),
  });
  await handler({ method: 'GET', query: { id: PROFILE }, headers: {} }, response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.pending, true);
});
