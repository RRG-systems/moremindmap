import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildRecruitingInviteContinuation,
  openRecruitingBoundBa,
  resolveRecruitingBaLanding,
} from '../src/lib/recruitingV1/continuation.js';

const PROFILE_ID = 'mm-20990101-recru001';
const ASSESSMENT_ID = 'ba-20990101-a1b2c3d4';

function continuationFor({
  readiness = 'BA_IN_PROGRESS',
  assessmentId = ASSESSMENT_ID,
  profileId = PROFILE_ID,
} = {}) {
  const progressState = readiness === 'BA_INTELLIGENCE_READY'
    ? 'BOTH_COMPLETE'
    : ['BA_INTAKE_SAVED', 'BA_IN_PROGRESS'].includes(readiness)
      ? 'BA_IN_PROGRESS'
      : 'BOS_COMPLETE';
  return buildRecruitingInviteContinuation({
    invite_session: {
      invite_session_id: 'invite_session_ba_resume',
      invitation_id: 'invite_ba_resume',
      candidate_id: 'candidate_ba_resume',
    },
    relationship: {
      relationship_ref: 'invite_ba_resume',
      candidate_id: 'candidate_ba_resume',
      bos_profile_id: profileId,
      ba_assessment_id: assessmentId,
      ba_readiness: readiness,
      progress_state: progressState,
      purpose: 'RECRUITING_INTELLIGENCE',
    },
  });
}

function retrievedAssessment({ profileId = PROFILE_ID, assessmentId = ASSESSMENT_ID } = {}) {
  return {
    success: true,
    found: true,
    owner_profile_id: profileId,
    assessment_id: assessmentId,
    assessment: {
      assessment_id: assessmentId,
      owner_profile_id: profileId,
      status: 'intake_saved',
      inputs: { answers: { q1: 'Synthetic answer' } },
      output: null,
    },
  };
}

test('BA_IN_PROGRESS reopens the current Business Twin only after exact bound Assessment retrieval', async () => {
  const continuation = continuationFor();
  const calls = [];

  const opened = await openRecruitingBoundBa({
    continuation,
    retrieveBoundAssessment: async (assessmentId) => {
      calls.push(['retrieve', assessmentId]);
      return retrievedAssessment();
    },
    resolveCurrentBa: async (profileId) => {
      calls.push(['resolve', profileId]);
      return {
        status: 'current',
        destination: '/business-twin?id=MM-20990101-RECRU001',
      };
    },
    navigate: (destination) => calls.push(['navigate', destination]),
  });

  assert.equal(opened.status, 'OPENING_CURRENT_BA');
  assert.deepEqual(calls, [
    ['retrieve', ASSESSMENT_ID],
    ['resolve', PROFILE_ID],
    ['navigate', '/business-twin?id=MM-20990101-RECRU001'],
  ]);
});

test('BOTH_COMPLETE opens the same server-bound BA and governed fallback recovers that exact record', async () => {
  const continuation = continuationFor({ readiness: 'BA_INTELLIGENCE_READY' });
  assert.deepEqual(resolveRecruitingBaLanding(continuation), {
    mode: 'OPEN_COMPLETED_BA',
    progress_state: 'BOTH_COMPLETE',
    profile_id: PROFILE_ID,
    assessment_id: ASSESSMENT_ID,
  });

  let navigated = false;
  const opened = await openRecruitingBoundBa({
    continuation,
    retrieveBoundAssessment: async () => retrievedAssessment(),
    resolveCurrentBa: async () => ({ status: 'governed_fallback' }),
    navigate: () => { navigated = true; },
  });

  assert.equal(opened.status, 'RECOVERED_BOUND_BA');
  assert.equal(opened.payload.assessment.assessment_id, ASSESSMENT_ID);
  assert.equal(opened.payload.assessment.owner_profile_id, PROFILE_ID);
  assert.equal(navigated, false);
});

test('bound BA continuation fails closed on missing or mismatched Assessment and Profile identity', async () => {
  assert.throws(
    () => continuationFor({ readiness: 'BA_IN_PROGRESS', assessmentId: null }),
    /RECRUITING_INVITE_CONTINUATION_BINDING_INVALID/u,
  );

  for (const payload of [
    retrievedAssessment({ assessmentId: 'ba-20990101-ffffffff' }),
    retrievedAssessment({ profileId: 'mm-20990101-other001' }),
    { success: true, found: false },
  ]) {
    await assert.rejects(
      openRecruitingBoundBa({
        continuation: continuationFor(),
        retrieveBoundAssessment: async () => payload,
        resolveCurrentBa: async () => ({
          status: 'current',
          destination: '/business-twin?id=MM-20990101-RECRU001',
        }),
        navigate: () => assert.fail('identity mismatch must not navigate'),
      }),
      /RECRUITING_BA_RETRIEVAL_BINDING_INVALID/u,
    );
  }
});

test('BusinessAssessment consumes the server continuation and never shows a new intake gate for a bound BA', () => {
  const source = readFileSync(new URL('../src/BusinessAssessment.jsx', import.meta.url), 'utf8');

  assert.match(source, /resolveRecruitingBaLanding\(payload\.continuation\)/u);
  assert.match(source, /openRecruitingBoundBa\(\{/u);
  assert.match(source, /retrieveBusinessAssessment\(\s*assessmentId,/u);
  assert.match(source, /credentials:\s*'same-origin'/u);
  assert.match(source, /recruitingLandingState\.status === 'ready_to_begin' && recruitingProfileGate\.profile/u);
  assert.match(source, /data-testid="recruiting-resume-bound-business-assessment"/u);
  assert.match(source, /A new intake was not started\./u);
});
