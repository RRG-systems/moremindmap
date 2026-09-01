import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createRedisNewBosBackgroundResponseStore } from '../api/engine/newBosProductionReadinessV1/backgroundResponseStore.js';
import { createRedisNewBaBackgroundResponseStore } from '../api/engine/newBaProductionReadinessV1/backgroundResponseStore.js';
import { createAuthorizedSyntheticTopSource } from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { createFrozenCanaryRealizationGenerator } from '../api/engine/newBaProductionReadinessV1/canaryRealizationFactory.js';
import { classifyNewBaCompatibility } from '../api/engine/newBaProductionReadinessV1/compatibility.js';
import { buildLaunchSafeNewBaEnvelope, createMemoryNewBaRealizationStore } from '../api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBaModernizationService } from '../api/engine/newBaProductionReadinessV1/modernizationService.js';
import { buildNewBaRealizationIdentityV3 } from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import { createNewBaRouteHandler } from '../api/engine/newBaProductionReadinessV1/routeHandler.js';
import { buildLaunchSafeRealizationEnvelope, createMemoryLaunchSafeRealizationStore } from '../api/engine/newBosProductionReadinessV1/launchSafeRealizationStore.js';
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
    generator: { advance: async () => ({ complete: true, artifact: envelope.artifact, provider_accounting: { calls: 0, store: false } }) },
  });
  const result = await service.retrieve({ profileId: source.profile_id });
  assert.equal(result.receipt.path, 'rebuilt_corrupt_derived');
  assert.equal(persistedOptions.corruptRecovery.serialized_sha256, 'e'.repeat(64));
  assert.ok(service.diagnostics.snapshot().some(({ event_type: type }) => type === 'corrupt_derived_recovered'));
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
    serviceFactory: async () => ({ service: { retrieve: async () => ({
      pending: true, status: 'GENERATION_ADVANCING', retry_after_ms: 1500,
      profile_id: PROFILE, assessment_id: 'ba-internal', accepted_stage: 'whole_business_model_v1', next_stage: 'five_futures_v2',
    }) } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, baResponse);
  assert.equal(baResponse.statusCode, 202);
  assert.deepEqual(Object.keys(baResponse.body).sort(), ['message', 'pending', 'retry_after_ms', 'status']);
});

test('resumable inspector is platform-protected only on the exact Vercel deployment host', async () => {
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
      deploymentHost: 'candidate.example.vercel.app',
    },
    serviceFactory: async () => ({
      inspectResumable: async (input) => { calls.push(input); return { status: 'ok' }; },
    }),
  });
  const candidate = response();
  await handler({
    method: 'GET',
    query: { id: PROFILE, diagnostic: 'resumable-state' },
    headers: { host: 'candidate.example.vercel.app' },
  }, candidate);
  assert.equal(candidate.statusCode, 200);
  assert.equal(calls[0].platformProtected, true);

  const publicDomain = response();
  await handler({
    method: 'GET',
    query: { id: PROFILE, diagnostic: 'resumable-state' },
    headers: { host: 'moremindmap.com' },
  }, publicDomain);
  assert.equal(publicDomain.statusCode, 200);
  assert.equal(calls[1].platformProtected, false);
});

test('stale surface-routing replacement is POST-only and exact-candidate protected', async () => {
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
      deploymentHost: 'candidate.example.vercel.app',
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
    headers: { host: 'candidate.example.vercel.app' },
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
  assert.equal(publicDomain.statusCode, 500);
  assert.equal(calls[1].platformProtected, false);

  const unsupported = response();
  await handler({ method: 'POST', query: { id: PROFILE }, headers: {} }, unsupported);
  assert.equal(unsupported.statusCode, 405);
});

test('invalid stage-3 repair route is hash-bound and exact-candidate protected', async () => {
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
      deploymentHost: 'candidate.example.vercel.app',
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
    headers: { host: 'candidate.example.vercel.app' },
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
  assert.equal(publicDomain.statusCode, 500);
  assert.equal(calls[1].platformProtected, false);
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
    serviceFactory: async () => ({ retrieve: async () => { throw new Error('new_bos_background_terminal_failure:provider_internal'); } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, machinery);
  assert.equal(machinery.body.safe_code, 'new_bos_temporarily_unavailable');
  assert.deepEqual(Object.keys(machinery.body).sort(), ['error', 'safe_code']);
  assert.doesNotMatch(JSON.stringify(machinery.body), /provider_internal|background_terminal_failure/u);

  const truth = makeResponse();
  await createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    serviceFactory: async () => ({ retrieve: async () => { throw new Error('new_bos_modernization_requires_evidence_or_review:A'); } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, truth);
  assert.equal(truth.body.safe_code, 'new_bos_modernization_requires_evidence_or_review');

  const baMachinery = makeResponse();
  await createNewBaRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    serviceFactory: async () => ({ service: { retrieve: async () => { throw new Error('provider_timeout:upstream_detail'); } } }),
  })({ method: 'GET', query: { id: PROFILE }, headers: {} }, baMachinery);
  assert.equal(baMachinery.body.safe_code, 'new_ba_temporarily_unavailable');
  assert.deepEqual(Object.keys(baMachinery.body).sort(), ['error', 'safe_code']);
  assert.doesNotMatch(JSON.stringify(baMachinery.body), /upstream_detail|TRANSIENT_INFRASTRUCTURE/u);
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
    serviceFactory: async () => ({ retrieve: async () => result }),
  });
  await handler({ method: 'GET', query: { id: PROFILE }, headers: {} }, response);
  assert.equal(response.statusCode, 202);
  assert.equal(response.body.pending, true);
});
