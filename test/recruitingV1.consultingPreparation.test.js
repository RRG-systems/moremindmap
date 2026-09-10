import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createConsultingPreparationCoordinator } from '../api/engine/recruitingV1/consultingPreparation.js';
import { createRecruitingHttpHandler } from '../api/engine/recruitingV1/http.js';

test('Recruiting runtime packages the frozen BA authority and keeps the provider-sized function window', () => {
  const deployment = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.deepEqual(deployment.functions['api/recruiting/runtime.js'], {
    maxDuration: 800,
    includeFiles: 'docs/ba-intelligence-authority-library-v1/**',
  });
});
import { createNewBosProductionService } from '../api/engine/newBosProductionReadinessV1/productionService.js';
import { createNewBaProductionService } from '../api/engine/newBaProductionReadinessV1/productionService.js';
import { RecruitingV1Service } from '../src/lib/recruitingV1/service.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';

const PROFILE = 'mm-20990101-recru001';
const ASSESSMENT = 'ba-20990101-a1b2c3d4';
const RELATIONSHIP = 'invitation-preparation-1';
const CANDIDATE = 'candidate-preparation-1';
const RECEIPT = Object.freeze({
  contract: 'recruiting_canonical_new_ba_ready_receipt_v1',
  profile_id: PROFILE,
  assessment_id: ASSESSMENT,
  realization_id: 'new-ba-realization-1',
  realization_sha256: 'a'.repeat(64),
  artifact_sha256: 'b'.repeat(64),
  completeness: 'PASS',
  customer_projection_completeness: 'COMPLETE',
});

function readyBaIntake(assertCurrent = async () => {}) {
  return {
    state: 'READY',
    assessment_id: ASSESSMENT,
    canonical_source_guard: {
      guards: [
        { key: 'synthetic:pointer', expected: ASSESSMENT },
        { key: 'synthetic:assessment', expected: '{"synthetic":true}' },
      ],
      assertCurrent,
    },
  };
}

function authority(overrides = {}) {
  const value = {
    mode: 'recruiting_manager_candidate_preparation',
    actor_role: 'OWNING_MANAGER',
    relationship_ref: RELATIONSHIP,
    candidate_id: CANDIDATE,
    purpose: 'RECRUITING_INTELLIGENCE',
    bos_job_id: null,
    profile_id: null,
    assessment_id: null,
    ba_readiness: 'BA_NOT_STARTED',
    ba_realization_receipt: null,
    progress_state: 'INVITED',
    candidate: {
      invitation_id: RELATIONSHIP,
      candidate_id: CANDIDATE,
      state: 'ACCEPTED',
      readiness_state: 'CONSENTED',
      bos_profile_id: null,
      ba_assessment_id: null,
      ba_readiness: 'BA_NOT_STARTED',
      progress_state: 'INVITED',
      progress_label: 'Taking BOS',
      consulting_ready: false,
      consulting_blocker: 'RECRUITING_CONSULTING_BOS_NOT_READY',
    },
    ...overrides,
  };
  value.candidate = { ...value.candidate, ...(overrides.candidate || {}) };
  return value;
}

function authored({ ba = true } = {}) {
  return {
    bos: { profile_id: PROFILE.toUpperCase() },
    ba: ba ? { presentation: true } : null,
    receipts: {
      bos: { profile_id: PROFILE.toUpperCase(), complete_surface_count: 15 },
      ba: ba ? {
        profile_id: PROFILE.toUpperCase(),
        assessment_id: ASSESSMENT,
        realization_id: RECEIPT.realization_id,
        realization_sha256: RECEIPT.realization_sha256,
        artifact_sha256: RECEIPT.artifact_sha256,
        complete: true,
      } : { complete: false, missing: true },
    },
  };
}

function coordinator({ current = authority(), ...overrides } = {}) {
  const state = { current };
  const calls = { authored: 0, bosFactory: 0, baFactory: 0, advance: 0, baProject: 0, baProjectInputs: [], baRetrieve: [] };
  const service = {
    async inspectCandidatePreparationAuthority() { return structuredClone(state.current); },
    async assertCandidatePreparationAuthority() { return { valid: true }; },
    async projectBaState(_relationship, input) {
      calls.baProject += 1;
      calls.baProjectInputs.push(input);
      if (input.canonical_source_guard) await input.canonical_source_guard.assertCurrent();
      state.current = authority({
        ...state.current,
        assessment_id: input.assessment_id,
        ba_readiness: input.state,
        candidate: { ...state.current.candidate, ba_readiness: input.state },
      });
      return state.current.candidate;
    },
  };
  const prepare = createConsultingPreparationCoordinator({
    service,
    readAuthoredSurfaces: async () => { calls.authored += 1; return authored({ ba: false }); },
    reconcileBosStart: async () => ({ reconciled: false }),
    advanceBosJob: async () => { calls.advance += 1; return { job: null }; },
    reconcileBosReady: async () => ({ projected: false }),
    inspectBaIntake: async () => ({ state: 'MISSING' }),
    createNewBosService: async () => { calls.bosFactory += 1; return { retrieve: async () => ({ pending: true }) }; },
    createNewBaService: async () => {
      calls.baFactory += 1;
      return { retrieve: async (input) => { calls.baRetrieve.push(input); return { pending: true }; } };
    },
    reconcileBaReady: async () => ({ projected: false, deferred: true }),
    executionStore: { get: async () => null, expire: async () => 1 },
    ...overrides,
  });
  return { prepare, service, state, calls };
}

test('completed exact BOS/BA pair returns READY before constructing or calling any generator or job advancer', async () => {
  const ready = authority({
    profile_id: PROFILE,
    assessment_id: ASSESSMENT,
    ba_readiness: 'BA_INTELLIGENCE_READY',
    ba_realization_receipt: RECEIPT,
    progress_state: 'BOTH_COMPLETE',
    candidate: { consulting_ready: true, progress_state: 'BOTH_COMPLETE', progress_label: 'Ready' },
  });
  const { prepare, calls } = coordinator({
    current: ready,
    readAuthoredSurfaces: async () => { calls.authored += 1; return authored(); },
    createNewBosService: async () => { throw new Error('must not construct New BOS'); },
    createNewBaService: async () => { throw new Error('must not construct New BA'); },
    advanceBosJob: async () => { throw new Error('must not advance a job'); },
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'READY');
  assert.equal(result.candidate.consulting_ready, true);
  assert.equal(Object.hasOwn(result.candidate, 'bos_profile_id'), false);
  assert.equal(Object.hasOwn(result.candidate, 'ba_assessment_id'), false);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(`${PROFILE}|${ASSESSMENT}|provider`, 'iu'));
});

test('rollback quarantine pauses the whole preparation pipeline before any product read, reconcile, or generator', async () => {
  const { prepare, calls } = coordinator({
    readAuthoredSurfaces: async () => { throw new Error('authored read must not run'); },
    reconcileBosStart: async () => { throw new Error('BOS reconcile must not run'); },
    createNewBosService: async () => { throw new Error('New BOS must not run'); },
    createNewBaService: async () => { throw new Error('New BA must not run'); },
    reconcileBaReady: async () => { throw new Error('BA projection must not run'); },
  });
  const result = await prepare({
    sessionToken: 'manager-session',
    candidateId: CANDIDATE,
    preparationExecutionAllowed: false,
  });
  assert.equal(result.preparation.state, 'EXECUTION_PAUSED');
  assert.equal(result.preparation.retry_after_ms, null);
  assert.deepEqual(calls, {
    authored: 0,
    bosFactory: 0,
    baFactory: 0,
    advance: 0,
    baProject: 0,
    baProjectInputs: [],
    baRetrieve: [],
  });
});

test('production New BOS and New BA service constructors accept the shared injected Redis runtime without opening a provider', () => {
  const redis = { async get() { return null; }, async set() { return 'OK'; }, async eval() { return 1; } };
  const bos = createNewBosProductionService({
    redis,
    env: {},
    config: {
      namespace: 'nonprod:new-bos:preparation-test', providerEnabled: false, persistenceEnabled: false,
      staged: true, customerActive: true, baFusionValidated: true, canaryEnabled: false,
      providerModel: 'gpt-5.6-sol', allowedProfileIds: [], accessToken: '',
    },
  });
  const ba = createNewBaProductionService({
    redis,
    env: {},
    config: {
      namespace: 'nonprod:new-ba:preparation-test', bosNamespace: 'nonprod:new-bos:preparation-test',
      providerEnabled: false, persistenceEnabled: false, staged: true, customerActive: true,
      fusionValidated: true, canaryEnabled: false, providerModel: 'gpt-5.6-sol', allowedProfileIds: [], accessToken: '',
    },
    onRecoveryEvent: async () => {},
  });
  assert.equal(typeof bos.retrieve, 'function');
  assert.equal(typeof ba.retrieve, 'function');
});

test('missing BOS without a committed same-job receipt asks for BOS and does not touch modernization or BA', async () => {
  const current = authority();
  const { prepare, calls } = coordinator({
    current,
    reconcileBosStart: async ({ inspected }) => {
      assert.deepEqual(inspected.preparation_authority, current);
      return { reconciled: false };
    },
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'BOS_INTAKE_REQUIRED');
  assert.equal(result.preparation.missing_assessment, 'BOS');
  assert.equal(calls.advance, 0);
  assert.equal(calls.bosFactory, 0);
  assert.equal(calls.baFactory, 0);
});

test('an authorization loss caught at the BOS write boundary fails through instead of returning a 200 retry receipt', async () => {
  const { prepare } = coordinator({
    reconcileBosStart: async () => {
      throw new Error('RECRUITING_CONSULTING_ACCEPTED_CONSENT_REQUIRED');
    },
  });
  await assert.rejects(
    prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE }),
    /RECRUITING_CONSULTING_ACCEPTED_CONSENT_REQUIRED/u,
  );
});

test('an existing BOS job advances once under its same locator before any BA work', async () => {
  const current = authority({ bos_job_id: 'job-existing-bos', progress_state: 'BOS_IN_PROGRESS' });
  let recheckedInsideLease = false;
  let reconcileCalls = 0;
  const { prepare, calls } = coordinator({
    current,
    reconcileBosStart: async ({ validateExistingJob }) => {
      reconcileCalls += 1;
      assert.equal(validateExistingJob, true);
      return { reconciled: false, validated: true, job_id: 'job-existing-bos' };
    },
    advanceBosJob: async ({ jobId, beforeExecute, executionAllowed }) => {
      calls.advance += 1;
      assert.equal(jobId, 'job-existing-bos');
      assert.equal(executionAllowed, true);
      await beforeExecute();
      recheckedInsideLease = true;
      return { job: { job_id: jobId, status: 'processing' }, advanced: true };
    },
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'BOS_JOB_RESUMING');
  assert.equal(
    result.preparation.message,
    "Preparing this person's BOS results for Consulting. Please keep this page open. This can take around 20 minutes, and sometimes longer. Completed results will be saved automatically.",
  );
  assert.equal(recheckedInsideLease, true);
  assert.equal(reconcileCalls, 2);
  assert.equal(calls.advance, 1);
  assert.equal(calls.baFactory, 0);
});

test('unaliased Production can disable BOS execution and a null drain retry does not auto-poll', async () => {
  const current = authority({ bos_job_id: 'job-existing-bos', progress_state: 'BOS_IN_PROGRESS' });
  const { prepare } = coordinator({
    current,
    reconcileBosStart: async () => ({ reconciled: false, validated: true, job_id: 'job-existing-bos' }),
    advanceBosJob: async ({ beforeExecute, executionAllowed }) => {
      assert.equal(executionAllowed, false);
      await beforeExecute();
      return { job: { job_id: 'job-existing-bos', status: 'processing' }, legacy_drain: true, retry_after_ms: null };
    },
  });
  const result = await prepare({
    sessionToken: 'manager-session',
    candidateId: CANDIDATE,
    allowBosExecution: false,
  });
  assert.equal(result.preparation.state, 'BOS_JOB_RESUMING');
  assert.equal(result.preparation.retry_after_ms, null);
});

test('the exact BOS job is revalidated inside the execution lease before provider work', async () => {
  const current = authority({ bos_job_id: 'job-existing-bos', progress_state: 'BOS_IN_PROGRESS' });
  let reconcileCalls = 0;
  let providerExecuted = false;
  const { prepare } = coordinator({
    current,
    reconcileBosStart: async () => {
      reconcileCalls += 1;
      return reconcileCalls === 1
        ? { reconciled: false, validated: true, job_id: 'job-existing-bos' }
        : { reconciled: false, validated: true, job_id: 'job-replaced' };
    },
    advanceBosJob: async ({ beforeExecute }) => {
      await beforeExecute();
      providerExecuted = true;
      return { job: { job_id: 'job-existing-bos', status: 'processing' } };
    },
  });
  await assert.rejects(
    prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE }),
    /RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED/u,
  );
  assert.equal(reconcileCalls, 2);
  assert.equal(providerExecuted, false);
});

test('completed BOS with no saved BA truthfully requests BA without invoking New BA', async () => {
  const current = authority({
    profile_id: PROFILE,
    progress_state: 'BOS_COMPLETE',
    candidate: { progress_state: 'BOS_COMPLETE', progress_label: 'Taking BA' },
  });
  const { prepare, calls } = coordinator({
    current,
    readAuthoredSurfaces: async () => authored({ ba: false }),
    inspectBaIntake: async () => ({ state: 'MISSING' }),
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'BA_INTAKE_REQUIRED');
  assert.equal(result.preparation.missing_assessment, 'BA');
  assert.equal(calls.baFactory, 0);
});

test('saved BA is projected, New BA advances, and a pending realization stays bounded', async () => {
  const current = authority({ profile_id: PROFILE, progress_state: 'BOS_COMPLETE' });
  const { prepare, calls } = coordinator({
    current,
    readAuthoredSurfaces: async () => authored({ ba: false }),
    inspectBaIntake: async () => readyBaIntake(),
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'NEW_BA_PREPARING');
  assert.equal(
    result.preparation.message,
    "Preparing this person's Business Assessment results for Consulting. Please keep this page open. This can take around 20 minutes, and sometimes longer. Completed results will be saved automatically.",
  );
  assert.equal(result.preparation.retry_after_ms, 2000);
  assert.equal(calls.baProject, 1);
  assert.equal(calls.baProjectInputs[0].canonical_source_guard.guards.length, 2);
  assert.equal(calls.baFactory, 1);
  assert.equal(calls.baRetrieve.length, 1);
  assert.equal(calls.baRetrieve[0].profileId, PROFILE);
  assert.deepEqual(
    {
      expectedAssessmentId: calls.baRetrieve[0].expectedAuthority.expectedAssessmentId,
      expectedRelationshipRef: calls.baRetrieve[0].expectedAuthority.expectedRelationshipRef,
    },
    { expectedAssessmentId: ASSESSMENT, expectedRelationshipRef: RELATIONSHIP },
  );
  assert.equal(typeof calls.baRetrieve[0].expectedAuthority.assertCurrent, 'function');
  await calls.baRetrieve[0].expectedAuthority.assertCurrent();
});

test('initial BA intake binding cannot commit after its exact canonical source changes', async () => {
  const initial = createEmptyRecruitingState();
  initial.invitations[RELATIONSHIP] = {
    invitation_id: RELATIONSHIP,
    candidate_id: CANDIDATE,
    state: 'ACCEPTED',
    accepted_at: '2099-01-01T00:00:00.000Z',
    revoked_at: null,
    consent: { version: 'recruiting_v1_consent_2026_08', accepted_at: '2099-01-01T00:00:00.000Z' },
    bos_profile_id: PROFILE,
    ba_assessment_id: null,
    ba_readiness: 'BA_NOT_STARTED',
    readiness_state: 'BOS_READY',
  };
  const store = new InMemoryRecruitingStore(initial);
  const service = new RecruitingV1Service({ store });
  await assert.rejects(
    service.projectBaState(RELATIONSHIP, {
      assessment_id: ASSESSMENT,
      state: 'BA_INTAKE_SAVED',
      canonical_source_guard: readyBaIntake(async () => {
        throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED');
      }).canonical_source_guard,
    }),
    /RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED/u,
  );
  const after = await store.read();
  assert.equal(after.invitations[RELATIONSHIP].ba_assessment_id, null);
  assert.equal(after.invitations[RELATIONSHIP].ba_readiness, 'BA_NOT_STARTED');
});

test('coordinator returns a resumable receipt and never starts New BA when intake source changes before binding', async () => {
  const current = authority({ profile_id: PROFILE, progress_state: 'BOS_COMPLETE' });
  const { prepare, state, calls } = coordinator({
    current,
    readAuthoredSurfaces: async () => authored({ ba: false }),
    inspectBaIntake: async () => readyBaIntake(async () => {
      throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED');
    }),
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'RETRYABLE_FAILURE');
  assert.equal(result.preparation.retryable, true);
  assert.equal(state.current.assessment_id, null);
  assert.equal(calls.baFactory, 0);
});

test('complete New BA result reconciles through the safe projection seam and is re-read before READY', async () => {
  const current = authority({
    profile_id: PROFILE,
    assessment_id: ASSESSMENT,
    ba_readiness: 'BA_INTAKE_SAVED',
    progress_state: 'BA_IN_PROGRESS',
  });
  let projected = false;
  let reconcileCalls = 0;
  const setup = coordinator({
    current,
    readAuthoredSurfaces: async () => authored({ ba: projected }),
    inspectBaIntake: async () => readyBaIntake(),
    createNewBaService: async () => ({ retrieve: async () => ({
      artifact: { profile_id: PROFILE.toUpperCase(), assessment_id: ASSESSMENT, realization_id: RECEIPT.realization_id, state: { completeness: 'COMPLETE' } },
      receipt: { path: 'current_fast_path', realization_sha256: RECEIPT.realization_sha256, artifact_sha256: RECEIPT.artifact_sha256, completeness: 'PASS' },
    }) }),
    reconcileBaReady: async () => {
      reconcileCalls += 1;
      projected = true;
      setup.state.current = authority({
        ...setup.state.current,
        profile_id: PROFILE,
        assessment_id: ASSESSMENT,
        ba_readiness: 'BA_INTELLIGENCE_READY',
        ba_realization_receipt: RECEIPT,
        progress_state: 'BOTH_COMPLETE',
        candidate: { ...setup.state.current.candidate, consulting_ready: true, progress_state: 'BOTH_COMPLETE', progress_label: 'Ready' },
      });
      return { projected: true };
    },
  });
  const result = await setup.prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(reconcileCalls, 1);
  assert.equal(result.preparation.state, 'READY');
  assert.equal(result.candidate.consulting_ready, true);
});

test('deferred canonical BA projection stops auto-polling and offers a manual saved-progress retry', async () => {
  const current = authority({
    profile_id: PROFILE,
    assessment_id: ASSESSMENT,
    ba_readiness: 'BA_INTAKE_SAVED',
    progress_state: 'BA_IN_PROGRESS',
  });
  const { prepare } = coordinator({
    current,
    readAuthoredSurfaces: async () => authored({ ba: false }),
    inspectBaIntake: async () => readyBaIntake(),
    createNewBaService: async () => ({ retrieve: async () => ({
      artifact: { profile_id: PROFILE.toUpperCase(), assessment_id: ASSESSMENT, realization_id: RECEIPT.realization_id, state: { completeness: 'COMPLETE' } },
      receipt: { path: 'current_fast_path', realization_sha256: RECEIPT.realization_sha256, artifact_sha256: RECEIPT.artifact_sha256, completeness: 'PASS' },
    }) }),
    reconcileBaReady: async () => ({ projected: false, deferred: true, reason: 'private-receipt' }),
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'RETRYABLE_FAILURE');
  assert.equal(result.preparation.retryable, true);
  assert.equal(result.preparation.retry_after_ms, null);
  assert.doesNotMatch(JSON.stringify(result), /private-receipt|realization_sha256|artifact_sha256/u);
});

test('lower-case New BOS and New BA review/default-off failures are never presented as retryable', async () => {
  const bosSetup = coordinator({
    current: authority({ profile_id: PROFILE, progress_state: 'BOS_COMPLETE' }),
    readAuthoredSurfaces: async () => ({ bos: null, ba: null, receipts: {} }),
    createNewBosService: async () => ({
      async retrieve() { throw new Error('new_bos_modernization_rebuild_default_off'); },
    }),
  });
  const bosResult = await bosSetup.prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(bosResult.preparation.state, 'REVIEW_REQUIRED');
  assert.equal(bosResult.preparation.retryable, false);

  const baSetup = coordinator({
    current: authority({
      profile_id: PROFILE,
      assessment_id: ASSESSMENT,
      ba_readiness: 'BA_INTAKE_SAVED',
      progress_state: 'BA_IN_PROGRESS',
    }),
    readAuthoredSurfaces: async () => authored({ ba: false }),
    inspectBaIntake: async () => readyBaIntake(),
    createNewBaService: async () => ({
      async retrieve() { throw new Error('new_ba_modernization_rebuild_default_off'); },
    }),
  });
  const baResult = await baSetup.prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(baResult.preparation.state, 'REVIEW_REQUIRED');
  assert.equal(baResult.preparation.retryable, false);
});

test('canonical BA projection failures are classified while authorization losses still fail through', async () => {
  function completedSetup(reconcileBaReady) {
    return coordinator({
      current: authority({
        profile_id: PROFILE,
        assessment_id: ASSESSMENT,
        ba_readiness: 'BA_INTAKE_SAVED',
        progress_state: 'BA_IN_PROGRESS',
      }),
      readAuthoredSurfaces: async () => authored({ ba: false }),
      inspectBaIntake: async () => readyBaIntake(),
      createNewBaService: async () => ({ retrieve: async () => ({
        artifact: { profile_id: PROFILE.toUpperCase(), assessment_id: ASSESSMENT, realization_id: RECEIPT.realization_id, state: { completeness: 'COMPLETE' } },
        receipt: { path: 'current_fast_path', realization_sha256: RECEIPT.realization_sha256, artifact_sha256: RECEIPT.artifact_sha256, completeness: 'PASS' },
      }) }),
      reconcileBaReady,
    });
  }

  const reviewed = completedSetup(async () => { throw new Error('new_ba_manager_preparation_relationship_authority_mismatch'); });
  const reviewResult = await reviewed.prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(reviewResult.preparation.state, 'REVIEW_REQUIRED');
  assert.equal(reviewResult.preparation.retryable, false);

  const revoked = completedSetup(async () => { throw new Error('RECRUITING_MANAGER_MEMBERSHIP_INACTIVE'); });
  await assert.rejects(
    revoked.prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE }),
    /RECRUITING_MANAGER_MEMBERSHIP_INACTIVE/u,
  );
});

test('an arbitrary authored-reader error is never misclassified as a missing assessment', async () => {
  const current = authority({ profile_id: PROFILE, progress_state: 'BOS_COMPLETE' });
  const { prepare, calls } = coordinator({
    current,
    readAuthoredSurfaces: async () => { throw new Error('temporary authored store outage'); },
  });
  const result = await prepare({ sessionToken: 'manager-session', candidateId: CANDIDATE });
  assert.equal(result.preparation.state, 'RETRYABLE_FAILURE');
  assert.equal(result.preparation.missing_assessment, null);
  assert.equal(calls.bosFactory, 0);
  assert.equal(calls.baFactory, 0);
});

test('HTTP preparation consumes and replaces CSRF without rotating away the recoverable manager session', async () => {
  const calls = [];
  const service = {
    async consumeManagerCsrf(token, csrf) { calls.push(['csrf', token, csrf]); },
    async issueManagerCsrf(token) { return `csrf-${token}`; },
  };
  const handler = createRecruitingHttpHandler({
    service,
    env: { RECRUITING_V1_ENABLED: 'true', NODE_ENV: 'development' },
    prepareConsultingResults: async (input) => {
      calls.push(['prepare', input]);
      return {
        preparation: { state: 'BA_INTAKE_REQUIRED', candidate_id: CANDIDATE, missing_assessment: 'BA', message: 'BA required.', retryable: false, retry_after_ms: null },
        candidate: { candidate_id: CANDIDATE, state: 'ACCEPTED', progress_state: 'BOS_COMPLETE' },
      };
    },
  });
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  await handler({
    method: 'POST',
    headers: { host: 'localhost:4173', origin: 'http://localhost:4173', cookie: '__Host-more_recruiting_manager=manager-session', 'x-recruiting-csrf': 'csrf-proof' },
    body: { action: 'PREPARE_CONSULTING_RESULTS', candidate_id: CANDIDATE },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.preparation.state, 'BA_INTAKE_REQUIRED');
  assert.equal(response.body.candidate.candidate_id, CANDIDATE);
  assert.equal(response.body.csrf_token, 'csrf-manager-session');
  assert.equal(response.headers['Set-Cookie'], undefined);
  assert.deepEqual(calls[0], ['csrf', 'manager-session', 'csrf-proof']);
  assert.deepEqual(calls[1], ['prepare', {
    sessionToken: 'manager-session',
    candidateId: CANDIDATE,
    allowLegacyDrainStart: false,
    allowBosExecution: true,
    preparationExecutionAllowed: true,
  }]);
});

test('a stale preparation CSRF returns a fresh proof on the same valid session and the next retry succeeds once', async () => {
  let currentCsrf = 'csrf-first';
  let prepareCalls = 0;
  const service = {
    async consumeManagerCsrf(token, csrf) {
      assert.equal(token, 'manager-session');
      if (csrf !== currentCsrf) throw new Error('RECRUITING_CSRF_INVALID');
      currentCsrf = null;
    },
    async issueManagerCsrf(token) {
      assert.equal(token, 'manager-session');
      currentCsrf = `csrf-recovery-${prepareCalls}`;
      return currentCsrf;
    },
  };
  const handler = createRecruitingHttpHandler({
    service,
    env: { RECRUITING_V1_ENABLED: 'true', NODE_ENV: 'development' },
    prepareConsultingResults: async () => {
      prepareCalls += 1;
      return {
        preparation: { state: 'READY', candidate_id: CANDIDATE },
        candidate: { candidate_id: CANDIDATE, consulting_ready: true },
      };
    },
  });
  function response() {
    return { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  }
  const stale = response();
  await handler({
    method: 'POST',
    headers: { host: 'localhost:4173', origin: 'http://localhost:4173', cookie: '__Host-more_recruiting_manager=manager-session', 'x-recruiting-csrf': 'csrf-consumed-by-lost-response' },
    body: { action: 'PREPARE_CONSULTING_RESULTS', candidate_id: CANDIDATE },
  }, stale);
  assert.equal(stale.statusCode, 403);
  assert.equal(stale.body.code, 'RECRUITING_CSRF_INVALID');
  assert.equal(stale.body.csrf_token, currentCsrf);
  assert.equal(prepareCalls, 0);

  const retried = response();
  await handler({
    method: 'POST',
    headers: { host: 'localhost:4173', origin: 'http://localhost:4173', cookie: '__Host-more_recruiting_manager=manager-session', 'x-recruiting-csrf': currentCsrf },
    body: { action: 'PREPARE_CONSULTING_RESULTS', candidate_id: CANDIDATE },
  }, retried);
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.body.preparation.state, 'READY');
  assert.equal(prepareCalls, 1);
});

test('HTTP preserves existing authorization status mapping for preparation authority failures', async () => {
  for (const [code, status] of [
    ['RECRUITING_MANAGER_SESSION_REQUIRED', 401],
    ['RECRUITING_MANAGER_SESSION_SCOPE_INVALID', 403],
    ['RECRUITING_MANAGER_MEMBERSHIP_INACTIVE', 403],
    ['RECRUITING_MANAGER_SETUP_INCOMPLETE', 403],
    ['RECRUITING_CONSULTING_ACCEPTED_CONSENT_REQUIRED', 401],
    ['RECRUITING_CANDIDATE_SCOPE_DENIED', 403],
  ]) {
    const service = {
      async consumeManagerCsrf() {},
      async issueManagerCsrf() { return 'recovery-csrf'; },
    };
    const handler = createRecruitingHttpHandler({
      service,
      env: { RECRUITING_V1_ENABLED: 'true', NODE_ENV: 'development' },
      prepareConsultingResults: async () => { throw new Error(code); },
    });
    const response = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    await handler({
      method: 'POST',
      headers: { host: 'localhost:4173', origin: 'http://localhost:4173', cookie: '__Host-more_recruiting_manager=manager-session', 'x-recruiting-csrf': 'csrf-proof' },
      body: { action: 'PREPARE_CONSULTING_RESULTS', candidate_id: CANDIDATE },
    }, response);
    assert.equal(response.statusCode, status);
    assert.equal(response.body.code, code);
  }
});
