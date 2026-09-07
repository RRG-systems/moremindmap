import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import {
  assertBosExecutionAuthority,
  bindBosJobToGrant,
  claimProductExecution,
  commitProductExecution,
  deterministicAssessmentId,
  deterministicExecutionUuid,
  productExecutionFingerprint,
  releaseProductExecution,
} from '../src/lib/publicSiteAirlockV1/productBoundary.js';
import { createBosStartJob } from '../api/moremindmap/start.js';
import { projectRecruitingBaStateIdempotently } from '../api/business-assessment/start.js';

const NOW = Date.parse('2099-02-03T04:05:06.000Z');
const BOS_GRANT = Object.freeze({
  grant_id: 'grant_single_execution_bos',
  product_key: 'behavior_operating_system',
  status: 'active',
});
const BOS_AUTHORITY = Object.freeze({ mode: 'server_grant', grant: BOS_GRANT });

function bosFixture(patch = {}) {
  const payload = {
    answers: { q1: { choice: 'A' }, q2: { text: 'Synthetic exact response' } },
    metadata: { person_name: 'Synthetic Person', ...patch },
  };
  const requestSha256 = productExecutionFingerprint('behavior_operating_system', payload);
  const jobId = deterministicExecutionUuid({
    authorityRef: BOS_GRANT.grant_id,
    productKey: 'behavior_operating_system',
    requestSha256,
    kind: 'job',
  });
  return { payload, requestSha256, jobId };
}

test('one public grant atomically claims one BOS execution and exact retries replay the same job', async () => {
  const store = new MemoryPublicStore();
  const fixture = bosFixture();
  const claims = await Promise.all(Array.from({ length: 24 }, (_, index) => claimProductExecution({
    store,
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW,
    leaseToken: `lease-${index}`,
  })));

  assert.equal(claims.filter((claim) => claim.code === 'ACQUIRED').length, 1);
  assert.equal(claims.filter((claim) => claim.code === 'IN_PROGRESS').length, 23);
  assert.deepEqual(new Set(claims.map((claim) => claim.record.identifiers.job_id)), new Set([fixture.jobId]));

  const owner = claims.find((claim) => claim.code === 'ACQUIRED');
  await commitProductExecution({
    store,
    claim: owner,
    result: { success: true, job_id: fixture.jobId },
    setValues: [{ key: `job:${fixture.jobId}`, value: JSON.stringify({ job_id: fixture.jobId }) }],
    now: NOW + 1,
  });
  const retry = await claimProductExecution({
    store,
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW + 2,
    leaseToken: 'retry-lease',
  });
  assert.equal(retry.code, 'REPLAY');
  assert.equal(retry.record.identifiers.job_id, fixture.jobId);
  assert.deepEqual(retry.record.result, { success: true, job_id: fixture.jobId });
  assert.equal(store.effects.filter(([effect]) => effect === 'commitProductExecution').length, 1);
});

test('altered payload and a corrupt occupied execution key fail closed before mutation', async () => {
  const store = new MemoryPublicStore();
  const fixture = bosFixture();
  await claimProductExecution({
    store,
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW,
    leaseToken: 'owner',
  });
  const beforeConflict = store.snapshot();
  await assert.rejects(
    () => claimProductExecution({
      store,
      authority: BOS_AUTHORITY,
      productKey: 'behavior_operating_system',
      requestSha256: bosFixture({ person_name: 'Altered Person' }).requestSha256,
      identifiers: { job_id: 'attacker-job' },
      now: NOW,
      leaseToken: 'attacker',
    }),
    /public_product_execution_replay_conflict/u,
  );
  assert.deepEqual(store.snapshot(), beforeConflict);

  const corruptStore = new MemoryPublicStore();
  await corruptStore.set(`public_product_v1:grant_execution:${BOS_GRANT.grant_id}`, '{not-json');
  const corruptBefore = corruptStore.snapshot();
  await assert.rejects(
    () => claimProductExecution({
      store: corruptStore,
      authority: BOS_AUTHORITY,
      productKey: 'behavior_operating_system',
      requestSha256: fixture.requestSha256,
      identifiers: { job_id: fixture.jobId },
      now: NOW,
      leaseToken: 'corrupt',
    }),
    /public_product_execution_replay_conflict/u,
  );
  assert.deepEqual(corruptStore.snapshot(), corruptBefore);

  const identityStore = new MemoryPublicStore();
  const identityClaim = await claimProductExecution({
    store: identityStore,
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW,
    leaseToken: 'identity-owner',
  });
  const tampered = { ...identityClaim.record, identifiers: { job_id: 'tampered-job' } };
  identityStore.values.set(identityClaim.key, JSON.stringify(tampered));
  await assert.rejects(
    () => claimProductExecution({
      store: identityStore,
      authority: BOS_AUTHORITY,
      productKey: 'behavior_operating_system',
      requestSha256: fixture.requestSha256,
      identifiers: { job_id: fixture.jobId },
      now: NOW,
      leaseToken: 'identity-retry',
    }),
    /public_product_execution_replay_conflict/u,
  );
});

test('released or expired partial execution is recovered with its original immutable IDs', async () => {
  const store = new MemoryPublicStore();
  const fixture = bosFixture();
  const first = await claimProductExecution({
    store,
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW,
    leaseToken: 'first',
    leaseMs: 10,
  });
  await store.set(`job:${fixture.jobId}`, JSON.stringify({ job_id: fixture.jobId, partial: true }));
  assert.equal(await releaseProductExecution({ store, claim: first, now: NOW + 1 }), 1);

  const recovered = await claimProductExecution({
    store,
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW + 2,
    leaseToken: 'recovered',
  });
  assert.equal(recovered.code, 'ACQUIRED');
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.record.identifiers.job_id, fixture.jobId);

  const stale = await claimProductExecution({
    store: new MemoryPublicStore(),
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW,
    leaseToken: 'stale-first',
    leaseMs: 1,
  });
  const staleRecovered = await claimProductExecution({
    store: stale.key ? storeForRecord(stale.key, stale.record) : new MemoryPublicStore(),
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW + 2,
    leaseToken: 'stale-recovered',
  });
  assert.equal(staleRecovered.code, 'ACQUIRED');
});

function storeForRecord(key, record) {
  const store = new MemoryPublicStore();
  store.values.set(key, JSON.stringify(record));
  return store;
}

test('one Recruiting relationship gets one execution per product without requiring a public grant', async () => {
  const store = new MemoryPublicStore();
  const authority = Object.freeze({
    mode: 'recruiting_invite_session',
    relationship_ref: 'relationship_synthetic_single_execution',
  });
  const bosSha = productExecutionFingerprint('behavior_operating_system', { answers: { q1: 'A' } });
  const baSha = productExecutionFingerprint('business_assessment', { owner_profile_id: 'mm-20990203-recruit1' });
  const bos = await claimProductExecution({
    store,
    authority,
    productKey: 'behavior_operating_system',
    requestSha256: bosSha,
    identifiers: { job_id: 'recruiting-bos-job' },
    now: NOW,
    leaseToken: 'bos-owner',
  });
  const ba = await claimProductExecution({
    store,
    authority,
    productKey: 'business_assessment',
    requestSha256: baSha,
    identifiers: { assessment_id: 'ba-20990203-aabbccdd', job_id: 'recruiting-ba-job' },
    now: NOW,
    leaseToken: 'ba-owner',
  });
  assert.equal(bos.code, 'ACQUIRED');
  assert.equal(ba.code, 'ACQUIRED');
  assert.notEqual(bos.key, ba.key);
  await commitProductExecution({
    store,
    claim: bos,
    result: { success: true, job_id: 'recruiting-bos-job' },
    now: NOW + 1,
  });
  assert.equal(await assertBosExecutionAuthority({ store, authority, jobId: 'recruiting-bos-job' }), true);
  await assert.rejects(
    () => claimProductExecution({
      store,
      authority,
      productKey: 'behavior_operating_system',
      requestSha256: productExecutionFingerprint('behavior_operating_system', { answers: { q1: 'B' } }),
      identifiers: { job_id: 'second-recruiting-bos-job' },
      now: NOW,
      leaseToken: 'altered',
    }),
    /public_product_execution_replay_conflict/u,
  );
});

test('a historically bound Recruiting resource cannot mint a new unclaimed execution', async () => {
  const store = new MemoryPublicStore();
  await assert.rejects(
    () => claimProductExecution({
      store,
      authority: {
        mode: 'recruiting_invite_session',
        relationship_ref: 'relationship_synthetic_prior_bos',
        profile_id: 'mm-20990203-priorbos',
      },
      productKey: 'behavior_operating_system',
      requestSha256: productExecutionFingerprint('behavior_operating_system', { answers: { q1: 'A' } }),
      identifiers: { job_id: 'must-not-be-created' },
      now: NOW,
      leaseToken: 'prior-bos',
    }),
    /public_product_execution_already_consumed/u,
  );
  await assert.rejects(
    () => claimProductExecution({
      store,
      authority: {
        mode: 'recruiting_invite_session',
        relationship_ref: 'relationship_synthetic_prior_ba',
        profile_id: 'mm-20990203-priorbos',
        assessment_id: 'ba-20990203-aabbccdd',
      },
      productKey: 'business_assessment',
      requestSha256: productExecutionFingerprint('business_assessment', { answers: { q1: 'A' } }),
      identifiers: { assessment_id: 'ba-20990203-bbbbbbbb', job_id: 'must-not-be-created' },
      now: NOW,
      leaseToken: 'prior-ba',
    }),
    /public_product_execution_already_consumed/u,
  );
  assert.deepEqual(store.snapshot().values, {});
});

test('BOS job access and Profile binding require the authority claimed execution, not only a job map', async () => {
  const store = new MemoryPublicStore();
  const fixture = bosFixture();
  await store.set(`access_grant:${BOS_GRANT.grant_id}`, JSON.stringify(BOS_GRANT));
  await store.set(`public_product_v1:bos_job:${fixture.jobId}`, BOS_GRANT.grant_id);
  await assert.rejects(
    () => assertBosExecutionAuthority({ store, authority: BOS_AUTHORITY, jobId: fixture.jobId }),
    /public_product_execution_binding_mismatch/u,
  );

  const claim = await claimProductExecution({
    store,
    authority: BOS_AUTHORITY,
    productKey: 'behavior_operating_system',
    requestSha256: fixture.requestSha256,
    identifiers: { job_id: fixture.jobId },
    now: NOW,
    leaseToken: 'owner',
  });
  await bindBosJobToGrant({ store, grant: BOS_GRANT, jobId: fixture.jobId });
  await assert.rejects(
    () => assertBosExecutionAuthority({ store, authority: BOS_AUTHORITY, jobId: fixture.jobId }),
    /public_product_execution_binding_mismatch/u,
  );
  await commitProductExecution({
    store,
    claim,
    result: { success: true, job_id: fixture.jobId },
    now: NOW + 1,
  });
  assert.equal(await assertBosExecutionAuthority({ store, authority: BOS_AUTHORITY, jobId: fixture.jobId }), true);
  await assert.rejects(
    () => assertBosExecutionAuthority({ store, authority: BOS_AUTHORITY, jobId: 'different-job' }),
    /public_product_execution_binding_mismatch/u,
  );
});

test('legacy BOS starts without a draft or bounded authority preserve fresh job identity', async () => {
  let sequence = 0;
  const calls = [];
  const create = async (payload, options) => {
    calls.push({ payload, options });
    sequence += 1;
    return `fresh-job-${sequence}`;
  };
  const payload = { answers: { q1: { choice: 'A' } }, metadata: {} };
  const first = await createBosStartJob(payload, { create });
  const second = await createBosStartJob(payload, { create });
  assert.notEqual(first, second);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options, undefined);
  assert.equal(calls[1].options, undefined);
});

test('Recruiting BA projection failure is retryable after commit while public BA remains a no-op', async () => {
  let attempts = 0;
  const project = async ({ relationshipRef, assessmentId, state }) => {
    attempts += 1;
    assert.equal(relationshipRef, 'relationship_projection_retry');
    assert.equal(assessmentId, 'ba-20990203-aabbccdd');
    assert.equal(state, 'BA_INTAKE_SAVED');
    if (attempts === 1) throw new Error('provider detail must not escape');
    return { projected: true };
  };
  await assert.rejects(
    projectRecruitingBaStateIdempotently({
      relationshipRef: 'relationship_projection_retry',
      assessmentId: 'ba-20990203-aabbccdd',
      project,
    }),
    { message: 'RECRUITING_BA_INTAKE_PROJECTION_PENDING' },
  );
  assert.deepEqual(await projectRecruitingBaStateIdempotently({
    relationshipRef: 'relationship_projection_retry',
    assessmentId: 'ba-20990203-aabbccdd',
    project,
  }), { projected: true });
  assert.equal(attempts, 2);
  assert.equal(await projectRecruitingBaStateIdempotently({
    relationshipRef: '',
    assessmentId: 'ba-20990203-aabbccdd',
    project,
  }), undefined);
  assert.equal(attempts, 2);
});

test('BA execution identity is deterministic and route binds exact governed inputs before atomic persistence', () => {
  const requestSha256 = productExecutionFingerprint('business_assessment', {
    owner_profile_id: 'mm-20990203-baexact1',
    vertical_binding_authority: { binding_sha256: 'a'.repeat(64) },
    answers: { q1: 'Synthetic' },
    question_states: { q1: { state: 'ANSWERED' } },
  });
  const firstAssessmentId = deterministicAssessmentId({
    authorityRef: 'grant_ba_exact',
    productKey: 'business_assessment',
    requestSha256,
    now: NOW,
  });
  const secondAssessmentId = deterministicAssessmentId({
    authorityRef: 'grant_ba_exact',
    productKey: 'business_assessment',
    requestSha256,
    now: NOW,
  });
  assert.equal(firstAssessmentId, secondAssessmentId);
  assert.match(firstAssessmentId, /^ba-20990203-[a-f0-9]{8}$/u);

  const baSource = fs.readFileSync('api/business-assessment/start.js', 'utf8');
  assert.match(baSource, /owner_profile_id: parsedProfile\.normalized[\s\S]*vertical_binding_authority:[\s\S]*answers: normalizedAnswers[\s\S]*question_states: semanticQuestionStates/u);
  assert.ok(baSource.indexOf('executionClaim = await claimProductExecution') < baSource.indexOf('await commitProductExecution'));
  assert.match(baSource, /verifyCommittedAssessmentExecution/u);
  assert.match(baSource, /context: \{ vertical_binding: verticalBinding \}/u);
  assert.ok(baSource.indexOf('await authorizePublicOrRecruitingProductRequest') < baSource.indexOf('await getCanonicalProfile'));
  assert.match(baSource, /if \(executionClaim\.code === 'REPLAY'\)[\s\S]*projectRecruitingBaStateIdempotently/u);
  assert.ok(baSource.indexOf('await commitProductExecution') < baSource.lastIndexOf('await projectRecruitingBaStateIdempotently'));
  assert.match(baSource, /RECRUITING_BA_INTAKE_PROJECTION_PENDING/u);
  assert.doesNotMatch(baSource, /error: error\.message/u);

  const bosSource = fs.readFileSync('api/moremindmap/start.js', 'utf8');
  assert.ok(bosSource.indexOf('executionClaim = await claimProductExecution') < bosSource.indexOf('await createBosStartJob(jobPayload, { jobId })'));
  assert.match(bosSource, /claimedDraft\?\.job_id \|\| \(authorityRef[\s\S]*deterministicExecutionUuid/u);
  assert.match(bosSource, /createBosStartJob\(jobPayload, \{ jobId \}\)/u);
  assert.doesNotMatch(bosSource, /error: error\.message/u);
});
