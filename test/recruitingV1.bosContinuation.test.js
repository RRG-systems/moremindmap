import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import {
  buildRecruitingInviteContinuation,
  resolveRecruitingBosLanding,
  resumeRecruitingBoundBos,
} from '../src/lib/recruitingV1/continuation.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import {
  PRODUCT_EXECUTION_CONTRACT_VERSION,
  productExecutionFingerprint,
} from '../src/lib/publicSiteAirlockV1/productBoundary.js';
import {
  BOS_JOB_TTL_SECONDS,
  RECRUITING_BOS_JOB_TTL_SECONDS,
  resolveBosJobTtlSeconds,
} from '../api/engine/miniV2JobManager.js';
import {
  reconcileRecruitingBosStartFromCommittedExecution,
  resolveRecruitingBosStartMetadata,
} from '../api/engine/recruitingV1/canonicalAdapters.js';
import { inviteContinuation } from '../api/engine/recruitingV1/http.js';

const BOS_JOB_ID = '33333333-3333-5333-a333-333333333333';
const MEMBERSHIP = {
  membership_id: 'membership_bos_continuation',
  manager_subject_id: 'manager_bos_continuation',
  enterprise_id: 'enterprise_bos_continuation',
  manager_profile_id: 'mm-20990101-bosmgr01',
  manager_name: 'Synthetic BOS Continuation Manager',
  manager_email: 'bos.continuation.manager@example.test',
  enterprise_name: 'Synthetic BOS Continuation Enterprise',
  status: 'ACTIVE',
  synthetic_only: true,
};

async function acceptedRelationship() {
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState([MEMBERSHIP]));
  const service = new RecruitingV1Service({
    store,
    now: () => new Date('2026-08-05T12:00:00.000Z'),
    transport: createSyntheticNotificationTransport(),
  });
  const challenge = await service.requestManagerVerification(MEMBERSHIP.manager_profile_id);
  const manager = await service.verifyManager(challenge.verification_token);
  const created = await service.createInvitation(manager.session_token, {
    recruit_name: 'Synthetic Returning Recruit',
    recruit_email: 'returning.recruit@example.test',
    purpose: 'Prove one durable BOS continuation without a second execution.',
  }, 'bos-continuation-invitation');
  const accepted = await service.acceptInvitation(created.invitation_token, {
    accepted: true,
    version: 'recruiting_v1_consent_2026_08',
  });
  return { store, service, created, accepted };
}

function committedBosExecution(relationshipRef, jobId, payload, overrides = {}) {
  return {
    contract_version: PRODUCT_EXECUTION_CONTRACT_VERSION,
    authority_type: 'RECRUITING_RELATIONSHIP',
    authority_ref: relationshipRef,
    product_key: 'behavior_operating_system',
    request_sha256: productExecutionFingerprint('behavior_operating_system', payload),
    identifiers: { job_id: jobId },
    state: 'COMMITTED',
    result: { success: true, job_id: jobId, status: 'queued' },
    ...overrides,
  };
}

function durableBosJob(relationshipRef, jobId, overrides = {}) {
  const payload = overrides.payload || {
    answers: { q1: { choice: 'A' } },
    metadata: {
      recruiting_relationship_ref: relationshipRef,
      recruiting_purpose: 'RECRUITING_INTELLIGENCE',
    },
  };
  return {
    job_id: jobId,
    status: 'queued',
    payload,
    intake_payload_sha256: createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    ...overrides,
  };
}

async function storeCommittedBos(publicStore, relationshipRef, jobId, {
  execution: suppliedExecution = null,
  job: suppliedJob = null,
} = {}) {
  const job = suppliedJob || durableBosJob(relationshipRef, jobId);
  const execution = suppliedExecution || committedBosExecution(relationshipRef, jobId, job.payload);
  await publicStore.set(
    `recruiting_v1:product_execution:${relationshipRef}:behavior_operating_system`,
    JSON.stringify(execution),
  );
  await publicStore.set(`job:${jobId}`, JSON.stringify(job));
}

function expirationTrackingStore(expireResult = 1) {
  const store = new MemoryPublicStore();
  store.expirations = [];
  store.expire = async (key, seconds) => {
    store.expirations.push([key, seconds]);
    return expireResult;
  };
  return store;
}

test('a returning accepted recruit polls the exact server-bound BOS job and never starts a second execution', async () => {
  const { service, created, accepted } = await acceptedRelationship();
  const beforeStart = buildRecruitingInviteContinuation(
    await service.inspectInviteSession(accepted.invite_session_token),
  );
  let pollCount = 0;
  assert.deepEqual(resolveRecruitingBosLanding(beforeStart), {
    mode: 'BEGIN_NEW_BOS',
    progress_state: 'INVITED',
    job_id: null,
  });
  assert.equal((await resumeRecruitingBoundBos({
    continuation: beforeStart,
    pollBoundJob: async () => { pollCount += 1; },
  })).status, 'READY_TO_BEGIN');
  assert.equal(pollCount, 0);

  await service.projectBosInProgress(created.invitation.invitation_id, { job_id: BOS_JOB_ID });
  await service.projectBosInProgress(created.invitation.invitation_id, { job_id: BOS_JOB_ID });
  await assert.rejects(
    service.projectBosInProgress(created.invitation.invitation_id, { job_id: '44444444-4444-5444-a444-444444444444' }),
    /RECRUITING_BOS_JOB_REBIND_DENIED/u,
  );

  const inspected = await service.inspectInviteSession(accepted.invite_session_token);
  assert.equal(inspected.relationship.bos_job_id, BOS_JOB_ID);
  const continuation = buildRecruitingInviteContinuation(inspected);
  assert.deepEqual(continuation.bos_resume, { state: 'BOUND', job_id: BOS_JOB_ID });
  assert.deepEqual(resolveRecruitingBosLanding(continuation), {
    mode: 'RESUME_BOUND_BOS',
    progress_state: 'BOS_IN_PROGRESS',
    job_id: BOS_JOB_ID,
  });

  const polledJobs = [];
  const resumed = await resumeRecruitingBoundBos({
    continuation,
    pollBoundJob: async (jobId) => {
      polledJobs.push(jobId);
      return { state: 'pending', job_id: jobId };
    },
  });
  assert.equal(resumed.status, 'RESUMED_BOUND_BOS');
  assert.deepEqual(polledJobs, [BOS_JOB_ID]);
  assert.deepEqual(resumed.result, { state: 'pending', job_id: BOS_JOB_ID });
});

test('BOS continuation fails closed without an immutable committed-job binding', async () => {
  const { service, created } = await acceptedRelationship();
  await assert.rejects(
    service.projectBosInProgress(created.invitation.invitation_id),
    /RECRUITING_BOS_JOB_BINDING_REQUIRED/u,
  );
  await assert.rejects(
    service.projectBosInProgress(created.invitation.invitation_id, { job_id: '../other-job' }),
    /RECRUITING_BOS_JOB_BINDING_REQUIRED/u,
  );
});

test('a strict committed execution receipt lazily repairs both missed and legacy BOS projections', async () => {
  for (const legacyInProgress of [false, true]) {
    const { store, service, created, accepted } = await acceptedRelationship();
    const relationshipRef = created.invitation.invitation_id;
    if (legacyInProgress) {
      await store.transaction((state) => {
        state.invitations[relationshipRef].readiness_state = 'BOS_IN_PROGRESS';
        delete state.invitations[relationshipRef].bos_job_id;
        return true;
      });
    }
    const publicStore = expirationTrackingStore();
    await storeCommittedBos(publicStore, relationshipRef, BOS_JOB_ID);

    const inspected = await service.inspectInviteSession(accepted.invite_session_token);
    assert.equal(inspected.relationship.bos_job_id, null);
    if (legacyInProgress) {
      const httpProjection = await inviteContinuation(service, accepted.invite_session_token, {
        executionStore: publicStore,
      });
      assert.deepEqual(httpProjection.continuation.bos_resume, {
        state: 'BOUND',
        job_id: BOS_JOB_ID,
      });
    } else {
      assert.equal((await reconcileRecruitingBosStartFromCommittedExecution({
        inspected,
        store: publicStore,
        service,
      })).job_id, BOS_JOB_ID);
    }

    const repaired = await service.inspectInviteSession(accepted.invite_session_token);
    assert.equal(repaired.relationship.progress_state, 'BOS_IN_PROGRESS');
    assert.equal(repaired.relationship.bos_job_id, BOS_JOB_ID);
    assert.deepEqual(publicStore.expirations, [[
      `job:${BOS_JOB_ID}`,
      RECRUITING_BOS_JOB_TTL_SECONDS,
    ]]);
    assert.equal((await reconcileRecruitingBosStartFromCommittedExecution({
      inspected: repaired,
      store: publicStore,
      service,
    })).reconciled, false);
  }
});

test('missing jobs and failed retention extension cannot mutate the Recruiting relationship', async () => {
  for (const failure of ['missing_job', 'expire_failed']) {
    const { service, created, accepted } = await acceptedRelationship();
    const relationshipRef = created.invitation.invitation_id;
    const job = durableBosJob(relationshipRef, BOS_JOB_ID);
    const execution = committedBosExecution(relationshipRef, BOS_JOB_ID, job.payload);
    const publicStore = expirationTrackingStore(failure === 'expire_failed' ? 0 : 1);
    await publicStore.set(
      `recruiting_v1:product_execution:${relationshipRef}:behavior_operating_system`,
      JSON.stringify(execution),
    );
    if (failure === 'expire_failed') {
      await publicStore.set(`job:${BOS_JOB_ID}`, JSON.stringify(job));
    }

    await assert.rejects(
      reconcileRecruitingBosStartFromCommittedExecution({
        inspected: await service.inspectInviteSession(accepted.invite_session_token),
        store: publicStore,
        service,
      }),
      failure === 'missing_job'
        ? /RECRUITING_BOS_JOB_BINDING_INVALID/u
        : /RECRUITING_BOS_JOB_RETENTION_FAILED/u,
    );
    assert.equal((await service.inspectInviteSession(
      accepted.invite_session_token,
    )).relationship.bos_job_id, null);
  }
});

test('lazy BOS repair derives scope from the invite session and rejects corrupt or cross-session evidence', async () => {
  const first = await acceptedRelationship();
  const second = await acceptedRelationship();
  const firstRef = first.created.invitation.invitation_id;
  const secondRef = second.created.invitation.invitation_id;
  const publicStore = new MemoryPublicStore();
  await storeCommittedBos(publicStore, firstRef, BOS_JOB_ID);

  const secondInspected = await second.service.inspectInviteSession(second.accepted.invite_session_token);
  const untouched = await inviteContinuation(second.service, second.accepted.invite_session_token, {
    executionStore: publicStore,
  });
  assert.equal(untouched.relationship.progress_state, 'INVITED');
  assert.deepEqual(untouched.continuation.bos_resume, { state: 'NOT_STARTED', job_id: null });
  assert.equal(resolveRecruitingBosLanding(untouched.continuation).mode, 'BEGIN_NEW_BOS');
  assert.equal((await second.service.inspectInviteSession(
    second.accepted.invite_session_token,
  )).relationship.bos_job_id, null);

  await storeCommittedBos(publicStore, secondRef, BOS_JOB_ID, {
    execution: committedBosExecution(
      firstRef,
      BOS_JOB_ID,
      durableBosJob(secondRef, BOS_JOB_ID).payload,
    ),
    job: durableBosJob(secondRef, BOS_JOB_ID),
  });
  await assert.rejects(
    reconcileRecruitingBosStartFromCommittedExecution({
      inspected: secondInspected,
      store: publicStore,
      service: second.service,
    }),
    /RECRUITING_BOS_EXECUTION_RECEIPT_INVALID/u,
  );

  await storeCommittedBos(publicStore, secondRef, BOS_JOB_ID, {
    job: durableBosJob(firstRef, BOS_JOB_ID),
  });
  await assert.rejects(
    reconcileRecruitingBosStartFromCommittedExecution({
      inspected: secondInspected,
      store: publicStore,
      service: second.service,
    }),
    /RECRUITING_BOS_JOB_BINDING_INVALID/u,
  );

  const digestMismatchJob = durableBosJob(secondRef, BOS_JOB_ID, {
    intake_payload_sha256: 'c'.repeat(64),
  });
  await storeCommittedBos(publicStore, secondRef, BOS_JOB_ID, { job: digestMismatchJob });
  await assert.rejects(
    reconcileRecruitingBosStartFromCommittedExecution({
      inspected: secondInspected,
      store: publicStore,
      service: second.service,
    }),
    /RECRUITING_BOS_EXECUTION_PAYLOAD_MISMATCH/u,
  );

  const exactJob = durableBosJob(secondRef, BOS_JOB_ID);
  await storeCommittedBos(publicStore, secondRef, BOS_JOB_ID, {
    job: exactJob,
    execution: committedBosExecution(secondRef, BOS_JOB_ID, exactJob.payload, {
      request_sha256: 'd'.repeat(64),
    }),
  });
  await assert.rejects(
    reconcileRecruitingBosStartFromCommittedExecution({
      inspected: secondInspected,
      store: publicStore,
      service: second.service,
    }),
    /RECRUITING_BOS_EXECUTION_PAYLOAD_MISMATCH/u,
  );

  const invalidReceipts = [
    { authority_type: 'PUBLIC_GRANT' },
    { product_key: 'business_assessment' },
    { state: 'CLAIMED' },
    { contract_version: 'legacy-execution' },
    { identifiers: { job_id: '../invalid' }, result: { success: true, job_id: '../invalid' } },
    { identifiers: { job_id: ` ${BOS_JOB_ID}` } },
    { result: { success: true, job_id: `${BOS_JOB_ID} ` } },
    { result: { success: true, job_id: '55555555-5555-5555-a555-555555555555' } },
  ];
  for (const overrides of invalidReceipts) {
    const job = durableBosJob(secondRef, BOS_JOB_ID);
    await storeCommittedBos(publicStore, secondRef, BOS_JOB_ID, {
      job,
      execution: committedBosExecution(secondRef, BOS_JOB_ID, job.payload, overrides),
    });
    await assert.rejects(
      reconcileRecruitingBosStartFromCommittedExecution({
        inspected: secondInspected,
        store: publicStore,
        service: second.service,
      }),
      /RECRUITING_BOS_EXECUTION_RECEIPT_INVALID/u,
    );
  }
  const whitespaceJob = durableBosJob(secondRef, BOS_JOB_ID, { job_id: ` ${BOS_JOB_ID}` });
  await storeCommittedBos(publicStore, secondRef, BOS_JOB_ID, { job: whitespaceJob });
  await assert.rejects(
    reconcileRecruitingBosStartFromCommittedExecution({
      inspected: secondInspected,
      store: publicStore,
      service: second.service,
    }),
    /RECRUITING_BOS_JOB_BINDING_INVALID/u,
  );
  assert.equal((await second.service.inspectInviteSession(
    second.accepted.invite_session_token,
  )).relationship.bos_job_id, null);
});

test('only server-governed Recruiting BOS jobs receive the aligned 30-day retention', async () => {
  const ordinary = { payload: { metadata: {} } };
  const relationshipOnly = {
    payload: { metadata: { recruiting_relationship_ref: 'relationship_spoofed' } },
  };
  const purposeOnly = {
    payload: { metadata: { recruiting_purpose: 'RECRUITING_INTELLIGENCE' } },
  };
  const governedRecruiting = {
    payload: {
      metadata: {
        recruiting_relationship_ref: 'relationship_server_bound',
        recruiting_purpose: 'RECRUITING_INTELLIGENCE',
      },
    },
  };

  assert.equal(BOS_JOB_TTL_SECONDS, 86_400);
  assert.equal(RECRUITING_BOS_JOB_TTL_SECONDS, 2_592_000);
  assert.equal(resolveBosJobTtlSeconds(ordinary), BOS_JOB_TTL_SECONDS);
  assert.equal(resolveBosJobTtlSeconds(relationshipOnly), BOS_JOB_TTL_SECONDS);
  assert.equal(resolveBosJobTtlSeconds(purposeOnly), BOS_JOB_TTL_SECONDS);
  assert.equal(resolveBosJobTtlSeconds(governedRecruiting), RECRUITING_BOS_JOB_TTL_SECONDS);

  const sanitizedPublicMetadata = await resolveRecruitingBosStartMetadata(
    { headers: {} },
    {
      person_name: 'Synthetic Ordinary Customer',
      recruiting_relationship_ref: 'forged_relationship',
      recruiting_purpose: 'RECRUITING_INTELLIGENCE',
    },
    {},
    { authority: { mode: 'public_product_grant' } },
  );
  assert.equal(sanitizedPublicMetadata.recruiting_relationship_ref, undefined);
  assert.equal(sanitizedPublicMetadata.recruiting_purpose, undefined);
  assert.equal(
    resolveBosJobTtlSeconds({ payload: { metadata: sanitizedPublicMetadata } }),
    BOS_JOB_TTL_SECONDS,
  );

  const jobManagerSource = readFileSync(new URL('../api/engine/miniV2JobManager.js', import.meta.url), 'utf8');
  assert.match(jobManagerSource, /rc\.set\(`job:\$\{jobId\}`,[\s\S]*?'EX', ttlSeconds, 'NX'\)/u);
  assert.match(jobManagerSource, /redisSet\(`job:\$\{jobId\}`, job, \{ ex: ttlSeconds \}\)/u);
  const updateStart = jobManagerSource.indexOf('export async function updateJob');
  const updateEnd = jobManagerSource.indexOf('export async function completeJob', updateStart);
  const updateSource = jobManagerSource.slice(updateStart, updateEnd);
  assert.ok(updateSource.indexOf('resolveBosJobTtlSeconds(job)') < updateSource.indexOf('const updated'));
  assert.match(updateSource, /\.\.\.patch,[\s\S]*?payload: job\.payload/u);
  assert.match(updateSource, /redisSet\(`job:\$\{jobId\}`, updated, \{ ex: ttlSeconds \}\)/u);
  assert.doesNotMatch(updateSource, /resolveBosJobTtlSeconds\(updated\)/u);
});

test('Profile consumes BOS_IN_PROGRESS as a status-only resume path, never a start path', () => {
  const profileSource = readFileSync(new URL('../src/Profile.jsx', import.meta.url), 'utf8');
  const effectStart = profileSource.indexOf("if (!recruitingRequested) return");
  const effectEnd = profileSource.indexOf('setSavedDraftAvailable', effectStart);
  const resumeStart = profileSource.indexOf('async function resumeExistingGeneration');
  const resumeEnd = profileSource.indexOf('function retryBosGenerationStart', resumeStart);
  const recruitingEntrySource = profileSource.slice(effectStart, effectEnd);
  const resumeSource = profileSource.slice(resumeStart, resumeEnd);

  assert.match(recruitingEntrySource, /resolveRecruitingBosLanding\(payload\.continuation\)/u);
  assert.match(recruitingEntrySource, /resumeRecruitingBoundBos\(\{/u);
  assert.match(recruitingEntrySource, /let cancelled = false/u);
  assert.match(recruitingEntrySource, /pollBoundJob: \(jobId\) => cancelled/u);
  assert.match(recruitingEntrySource, /isCancelled: \(\) => cancelled/u);
  assert.match(recruitingEntrySource, /return \(\) => \{\s*cancelled = true/u);
  assert.match(resumeSource, /pollExistingBosJob\(jobId, API, \{ recruiting, isCancelled \}\)/u);
  assert.doesNotMatch(resumeSource, /submitAssessment|\/api\/moremindmap\/start/u);

  const httpSource = readFileSync(new URL('../api/engine/recruitingV1/http.js', import.meta.url), 'utf8');
  const continuationStart = httpSource.indexOf('async function inviteContinuation');
  const continuationEnd = httpSource.indexOf('export function setRecruitingHeaders', continuationStart);
  const continuationSource = httpSource.slice(continuationStart, continuationEnd);
  assert.ok(continuationSource.indexOf('inspectInviteSession') < continuationSource.indexOf('reconcileRecruitingBosStartFromCommittedExecution'));
  assert.ok(continuationSource.lastIndexOf('inspectInviteSession') < continuationSource.indexOf('buildRecruitingInviteContinuation'));
  assert.doesNotMatch(continuationSource, /\/api\/moremindmap\/start|createJob|claimProductExecution/u);
});
