import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRecruitingInviteContinuation,
  isRecruitingInviteContinuation,
} from '../src/lib/recruitingV1/continuation.js';
import { normalizeProfileOwnershipReturnPath } from '../src/lib/publicSiteAirlockV1/profileOwnership.js';
import { createResendOwnershipTransport } from '../src/lib/publicSiteAirlockV1/resendOwnershipTransport.js';

const PROFILE_ID = 'mm-20990101-recru001';

function inspected({ profileId = null, baReadiness = 'BA_NOT_STARTED', assessmentId = null, progressState = null } = {}) {
  const projectedProgress = progressState || (!profileId
    ? 'INVITED'
    : baReadiness === 'BA_INTELLIGENCE_READY'
      ? 'BOTH_COMPLETE'
      : ['BA_INTAKE_SAVED', 'BA_IN_PROGRESS'].includes(baReadiness)
        ? 'BA_IN_PROGRESS'
        : 'BOS_COMPLETE');
  return {
    invite_session: {
      invite_session_id: 'invite_session_synthetic_001',
      invitation_id: 'invite_synthetic_001',
      candidate_id: 'candidate_synthetic_001',
    },
    relationship: {
      relationship_ref: 'invite_synthetic_001',
      candidate_id: 'candidate_synthetic_001',
      bos_profile_id: profileId,
      ba_assessment_id: assessmentId,
      ba_readiness: baReadiness,
      progress_state: projectedProgress,
      readiness_state: projectedProgress === 'INVITED' ? 'CONSENTED' : projectedProgress,
      purpose: 'RECRUITING_INTELLIGENCE',
    },
  };
}

test('accepted invite session preserves invited readiness before BOS starts', () => {
  const continuation = buildRecruitingInviteContinuation(inspected());
  assert.equal(isRecruitingInviteContinuation(continuation), true);
  assert.equal(continuation.authority, 'accepted_invite_session');
  assert.equal(continuation.progress_state, 'INVITED');
  assert.deepEqual(continuation.progress.map((step) => step.state), ['COMPLETE', 'AVAILABLE', 'LOCKED']);
  assert.equal(continuation.next_step.action, 'CONTINUE_BOS');
  assert.equal(continuation.next_step.destination, '/profile?recruiting=1');
  assert.equal(continuation.requires_manual_profile_id, false);
  assert.equal(continuation.requires_new_manager_invitation, false);

  const started = buildRecruitingInviteContinuation(inspected({ progressState: 'BOS_IN_PROGRESS' }));
  assert.equal(started.progress_state, 'BOS_IN_PROGRESS');
  assert.deepEqual(started.progress.map((step) => step.state), ['COMPLETE', 'CURRENT', 'LOCKED']);
});

test('one invitation moves from bound BOS into BA without client-selected Profile identity', () => {
  const continuation = buildRecruitingInviteContinuation(inspected({ profileId: PROFILE_ID }));
  assert.equal(continuation.progress_state, 'BOS_COMPLETE');
  assert.deepEqual(continuation.profile_binding, {
    state: 'BOUND',
    profile_id: PROFILE_ID,
    same_profile_required: true,
  });
  assert.equal(continuation.next_step.action, 'BEGIN_BA');
  assert.equal(continuation.next_step.destination, '/business-assessment?recruiting=1');
  assert.match(continuation.notifications[0].body, /without another invitation or Profile ID entry/u);
});

test('in-progress and complete BA destinations remain bound to the server Profile', () => {
  const inProgress = buildRecruitingInviteContinuation(inspected({
    profileId: PROFILE_ID,
    baReadiness: 'BA_IN_PROGRESS',
    assessmentId: 'ba-20990101-a1b2c3d4',
  }));
  assert.equal(inProgress.progress_state, 'BA_IN_PROGRESS');
  assert.equal(inProgress.next_step.action, 'RETURN_TO_BA');
  assert.equal(inProgress.next_step.destination, '/business-assessment?recruiting=1');
  assert.doesNotMatch(inProgress.next_step.destination, /(?:\?|&)id=/u);

  const complete = buildRecruitingInviteContinuation(inspected({
    profileId: PROFILE_ID,
    baReadiness: 'BA_INTELLIGENCE_READY',
    assessmentId: 'ba-20990101-a1b2c3d4',
  }));
  assert.equal(complete.progress_state, 'BOTH_COMPLETE');
  assert.deepEqual(complete.progress.map((step) => step.state), ['COMPLETE', 'COMPLETE', 'COMPLETE']);
  assert.equal(complete.next_step.action, 'OPEN_COMPLETED_BA');
});

test('continuation fails closed on cross-session identity or impossible BA state', () => {
  const crossSession = inspected();
  crossSession.invite_session.candidate_id = 'candidate_other';
  assert.throws(
    () => buildRecruitingInviteContinuation(crossSession),
    /RECRUITING_INVITE_CONTINUATION_SCOPE_INVALID/u,
  );

  assert.throws(
    () => buildRecruitingInviteContinuation(inspected({ baReadiness: 'BA_IN_PROGRESS' })),
    /RECRUITING_INVITE_CONTINUATION_BINDING_INVALID/u,
  );

  assert.throws(
    () => buildRecruitingInviteContinuation(inspected({ profileId: PROFILE_ID, progressState: 'INVITED' })),
    /RECRUITING_INVITE_CONTINUATION_BINDING_INVALID/u,
  );
});

test('Profile ownership verification preserves only explicit safe continuation routes', () => {
  assert.equal(normalizeProfileOwnershipReturnPath('/recruiting/continue'), '/recruiting/continue');
  assert.equal(
    normalizeProfileOwnershipReturnPath('/step-2?continue=complimentary'),
    '/step-2?continue=complimentary',
  );
  assert.equal(normalizeProfileOwnershipReturnPath('//attacker.example.test'), '/step-1');
  assert.equal(normalizeProfileOwnershipReturnPath('/recruiting/continue?next=https://attacker.example.test'), '/step-1');
});

test('Profile ownership email transport preserves the approved continuation route exactly', async () => {
  const calls = [];
  const transport = createResendOwnershipTransport({
    env: {
      MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY: 're_synthetic_profile_owner_key_123456',
      PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM: 'MORE MindMap <hello@moremindmap.example>',
      PUBLIC_SITE_URL: 'https://candidate.example.test',
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, async json() { return { id: 'email_synthetic_continuation' }; } };
    },
  });
  const result = await transport.send({
    challenge_id: 'owner_ch_synthetic_continuation',
    recipient: 'owner@example.test',
    token: 'synthetic-owner-token-abcdefghijklmnopqrstuvwxyz',
    return_path: '/step-2?continue=complimentary',
  });

  assert.deepEqual(result, { success: true, id: 'resend:email_synthetic_continuation' });
  assert.equal(calls.length, 1);
  const payload = JSON.parse(calls[0].options.body);
  assert.match(payload.text, /https:\/\/candidate\.example\.test\/step-2\?continue=complimentary#more-profile-owner=/u);

  await transport.send({
    challenge_id: 'owner_ch_synthetic_recruiting_continuation',
    recipient: 'owner@example.test',
    token: 'synthetic-owner-token-recruiting-abcdefghijklmnopqrstuvwxyz',
    return_path: '/recruiting/continue',
  });
  assert.equal(calls.length, 2);
  const recruitingPayload = JSON.parse(calls[1].options.body);
  assert.match(recruitingPayload.text, /https:\/\/candidate\.example\.test\/recruiting\/continue#more-profile-owner=/u);
});
