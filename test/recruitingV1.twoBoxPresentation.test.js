import assert from 'node:assert/strict';
import test from 'node:test';
import { MANAGER_DESTINATIONS, allowanceLabel, allowanceResetLabel, consultingCandidatePath, consultingCandidates, consultingPreparationCandidates, invitationAllowance, invitationErrorMessage, mayResendInvitation, presentRecruitingNotification, reconcileConsultingPreparationReceipts, recruitProgressLabel, uniqueCandidateNotifications } from '../src/lib/recruitingV1/workspacePresentation.js';
import { resolveRecruitingWorkspaceRoute } from '../src/lib/recruitingV1/landing.js';
import { acceptedPlanPointerKey, acceptedPlanReceiptMatches, acceptedPlanStorageKey, preferredDemoRecoverySubject } from '../src/lib/recruitingGuV1/acceptedPlanStorage.js';

test('the manager has only Invite a Recruit and Consulting Tool', () => {
  assert.deepEqual(MANAGER_DESTINATIONS.map(({ id, title }) => [id, title]), [['invite', 'Invite a Recruit'], ['consulting', 'Consulting Tool']]);
});

test('legacy manager routes and old workspace query cannot expose a third destination', () => {
  const manager = { capabilities: { master_control: false } };
  const admin = { capabilities: { master_control: true } };
  for (const name of ['candidate', 'opportunity', 'evidence', 'intelligence', 'meeting', 'export', 'master-control', 'unknown']) {
    assert.equal(resolveRecruitingWorkspaceRoute(`/recruiting/${name}`, manager), '/recruiting/home');
  }
  for (const name of ['home', 'consulting', 'candidate', 'opportunity', 'meeting']) {
    assert.equal(resolveRecruitingWorkspaceRoute(`/recruiting/${name}`, admin), '/recruiting/master-control');
  }
  assert.equal(resolveRecruitingWorkspaceRoute('/recruiting/consulting', manager), null);
  assert.equal(resolveRecruitingWorkspaceRoute('/recruiting/invite', manager), null);
  assert.equal(resolveRecruitingWorkspaceRoute('/recruiting/invite', admin), null);
});

test('only server-confirmed accepted and both-ready people can open Consulting', () => {
  const accepted_at = '2026-09-10T00:00:00.000Z';
  const ready = { candidate_id: 'ready', state: 'ACCEPTED', accepted_at, consulting_ready: true, ba_readiness: 'BA_INTELLIGENCE_READY' };
  const people = [
    ready,
    { candidate_id: 'bos', state: 'ACCEPTED', accepted_at, bos_profile_id: 'mm-1', ba_readiness: 'BA_NOT_STARTED', consulting_preparation_eligible: true },
    { candidate_id: 'running', state: 'ACCEPTED', accepted_at, ba_readiness: 'BA_IN_PROGRESS', consulting_preparation_eligible: true },
    { candidate_id: 'mismatch', state: 'ACCEPTED', accepted_at, ba_readiness: 'BA_INTELLIGENCE_READY', consulting_ready: false, progress_label: 'Ready', consulting_preparation_eligible: true },
    { ...ready, candidate_id: 'revoked', state: 'REVOKED' },
  ];
  assert.deepEqual(consultingCandidates(people), [ready]);
  assert.deepEqual(consultingPreparationCandidates(people), people.slice(1, 4));
  assert.deepEqual(consultingPreparationCandidates([{ candidate_id: 'unaccepted', state: 'ACCEPTED', consulting_ready: false }]), []);
  assert.deepEqual(consultingPreparationCandidates([{ candidate_id: 'legacy', state: 'ACCEPTED', accepted_at, consulting_ready: false, consulting_preparation_eligible: false }]), []);
  assert.equal(recruitProgressLabel(people[1]), 'Taking BA');
  assert.equal(recruitProgressLabel(people[2]), 'Taking BA');
  assert.equal(recruitProgressLabel(people[3]), 'Results need verification');
  assert.equal(recruitProgressLabel(people[4]), 'Revoked');
  assert.equal(people.length, 5, 'presentation never removes completed or blocked people from the invitation list');
});

test('readiness refresh clears only stale intake blockers so saved work can resume', () => {
  const receipts = {
    bos: { state: 'BOS_INTAKE_REQUIRED' },
    ba: { state: 'BA_INTAKE_REQUIRED' },
    pending: { state: 'NEW_BA_PREPARING' },
  };
  assert.deepEqual(reconcileConsultingPreparationReceipts(receipts, [
    { candidate_id: 'bos', consulting_ready: false, progress_state: 'BOS_IN_PROGRESS', readiness_state: 'BOS_IN_PROGRESS' },
    { candidate_id: 'ba', consulting_ready: false, progress_state: 'BA_IN_PROGRESS', ba_readiness: 'BA_INTAKE_SAVED', ba_assessment_id: 'ba-saved' },
    { candidate_id: 'pending', consulting_ready: false, progress_state: 'BA_IN_PROGRESS', ba_readiness: 'BA_IN_PROGRESS' },
  ]), { pending: receipts.pending });
  assert.deepEqual(reconcileConsultingPreparationReceipts(receipts, [
    { candidate_id: 'bos', consulting_ready: false, progress_state: 'INVITED', readiness_state: 'CONSENTED' },
    { candidate_id: 'ba', consulting_ready: false, progress_state: 'BOS_COMPLETE', ba_readiness: 'BA_NOT_STARTED' },
    { candidate_id: 'pending', consulting_ready: true, progress_state: 'BOTH_COMPLETE', ba_readiness: 'BA_INTELLIGENCE_READY' },
  ]), { bos: receipts.bos, ba: receipts.ba });
});

test('combined allowance uses server truth and renders its actual UTC reset', () => {
  const allowance = { mode: '5_per_month', limit: 5, remaining: 2, used: 3, period_end: '2026-10-01T00:00:00.000Z' };
  assert.equal(invitationAllowance({ invitation_allowance: allowance, entitlements: { bos: { remaining: 5 }, ba: { remaining: 1 } } }), allowance);
  assert.equal(invitationAllowance({ entitlement: { remaining: 5 } }), null);
  assert.equal(allowanceLabel(allowance), '2 of 5 remaining');
  assert.equal(allowanceLabel({ mode: 'unlimited' }), 'Unlimited');
  assert.equal(allowanceResetLabel(allowance), 'Resets October 1, 2026 (UTC)');
  assert.equal(allowanceResetLabel(null), 'Reset date is being verified');
});

test('candidate handoff selects the real Consulting renderer using only the scoped candidate identity', () => {
  assert.equal(consultingCandidatePath('candidate one'), '/recruiting-gu-v1?candidate_id=candidate%20one');
  assert.doesNotMatch(consultingCandidatePath('candidate one'), /demo|profile_id|mm=/u);
});

test('historical BOS-only notifications use current verified progress without reopening retired intelligence', () => {
  const oldNotice = { candidate_id: 'c1', kind: 'BOS_READY', body: 'Recruiting Intelligence can now begin with explicit business missingness.' };
  const person = { candidate_id: 'c1', recruit_name: 'Taylor', state: 'ACCEPTED', bos_profile_id: 'p1', consulting_ready: false };
  const pending = presentRecruitingNotification(oldNotice, [person]);
  assert.equal(pending.title, 'Taylor: Taking BA.');
  assert.match(pending.body, /BA still needs to be completed and ready/u);
  assert.doesNotMatch(JSON.stringify(pending), /Recruiting Intelligence|missingness/u);
  const ready = presentRecruitingNotification(oldNotice, [{ ...person, consulting_ready: true }]);
  assert.match(ready.body, /Both BOS and BA results are ready/u);
  assert.doesNotMatch(presentRecruitingNotification(oldNotice, []).body, /can open/u);
});

test('resend is offered only for a failed or expired unaccepted invitation', () => {
  const invitation = { invitation_id: 'invite-one', state: 'DELIVERY_FAILED' };
  assert.equal(mayResendInvitation(invitation), true);
  assert.equal(mayResendInvitation({ ...invitation, state: 'EXPIRED' }), true);
  assert.equal(mayResendInvitation({ ...invitation, accepted_at: '2026-09-09T00:00:00Z' }), false);
  for (const state of ['ACCEPTED', 'REVOKED', 'DELIVERED', 'ISSUED', 'PENDING']) assert.equal(mayResendInvitation({ ...invitation, state }), false);
  assert.equal(mayResendInvitation({ state: 'DELIVERY_FAILED' }), false);
});

test('invitation quota, delivery and retry failures use human text without raw runtime codes', () => {
  const allowance = { period_end: '2026-10-01T00:00:00.000Z' };
  const quota = invitationErrorMessage(new Error('RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED'), allowance);
  assert.match(quota, /No free invitations remain/u);
  assert.match(quota, /October 1, 2026 \(UTC\)/u);
  assert.match(quota, /check existing invitations/u);
  assert.match(invitationErrorMessage('RECRUITING_NOTIFICATION_DELIVERY_FAILED'), /could not be delivered/u);
  assert.match(invitationErrorMessage('RECRUITING_INVITATION_RESEND_DENIED'), /can no longer be resent/u);
  assert.match(invitationErrorMessage('RECRUITING_INVITATION_RESEND_REVISION_REQUIRED'), /Refresh its status/u);
  assert.match(invitationErrorMessage('RECRUITING_CSRF_INVALID'), /Reload this page/u);
  for (const code of ['RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED', 'RECRUITING_NOTIFICATION_DELIVERY_FAILED', 'RECRUITING_INVITATION_RESEND_DENIED', 'RECRUITING_INVITATION_RESEND_REVISION_INVALID', 'RECRUITING_NEW_INTERNAL_FAILURE']) assert.doesNotMatch(invitationErrorMessage(code, allowance), /RECRUITING_/u);
  assert.equal(invitationErrorMessage('No free invitations remain in this period.'), 'No free invitations remain in this period.');
});

test('Current Progress displays each person once without changing historical notifications', () => {
  const records = Object.freeze([
    Object.freeze({ notification_id: 'new-avery', candidate_id: 'avery', kind: 'BA_INTELLIGENCE_READY' }),
    Object.freeze({ notification_id: 'old-avery', candidate_id: 'avery', kind: 'BOS_READY' }),
    Object.freeze({ notification_id: 'new-jordan', candidate_id: 'jordan', kind: 'BA_INTELLIGENCE_READY' }),
    Object.freeze({ notification_id: 'old-jordan', candidate_id: 'jordan', kind: 'BOS_READY' }),
    Object.freeze({ notification_id: 'casey', candidate_id: 'casey', kind: 'BOS_READY' }),
    Object.freeze({ notification_id: 'taylor', candidate_id: 'taylor', kind: 'BOS_READY' }),
  ]);
  const before = JSON.stringify(records);
  const visible = uniqueCandidateNotifications(records).slice(0, 4);
  assert.deepEqual(visible.map((item) => item.candidate_id), ['avery', 'jordan', 'casey', 'taylor']);
  assert.equal(visible[0], records[0], 'Most recent source record remains linked.');
  assert.equal(JSON.stringify(records), before);
  assert.equal(records.length, 6);
});

test('accepted-plan cache separates mode, manager and selected subject and validates recovery binding', () => {
  const context = { mode: 'demo', managerId: 'manager-one', subjectId: 'SYNTHETIC' };
  const keys = [acceptedPlanStorageKey(context), acceptedPlanStorageKey({ ...context, mode: 'real' }), acceptedPlanStorageKey({ ...context, managerId: 'manager-two' }), acceptedPlanStorageKey({ ...context, subjectId: 'PATRICIA' }), acceptedPlanPointerKey('demo', 'manager-one')];
  assert.equal(new Set(keys).size, 5);
  assert.equal(acceptedPlanStorageKey({ ...context, subjectId: null }), null);
  const session = { status: 'COMPLETED', accepted_plan_snapshot: { plan: 'recorded' }, session_id: 's1', manager_binding: { subject_id: 'm1' }, subject_binding: { profile_id: 'p1', candidate_id: 'c1' } };
  const receipt = { mode: 'demo', subjectId: 'SYNTHETIC', sessionId: 's1', managerId: 'm1', profileId: 'p1', candidateId: 'c1' };
  const scope = { mode: 'demo', managerId: 'm1', subjectId: 'SYNTHETIC' };
  assert.equal(acceptedPlanReceiptMatches(session, receipt, scope), true);
  for (const field of ['mode', 'subjectId', 'sessionId', 'managerId', 'profileId', 'candidateId']) assert.equal(acceptedPlanReceiptMatches(session, { ...receipt, [field]: 'other' }, scope), false);
  assert.equal(acceptedPlanReceiptMatches({ ...session, status: 'OPEN' }, receipt, scope), false);
  assert.equal(acceptedPlanReceiptMatches(session, receipt, { ...scope, mode: 'real' }), false);
});

test('a remembered accepted demo subject wins over another unfinished demo session', () => {
  const allowedSubjects = ['SYNTHETIC', 'PATRICIA'];
  for (const [rememberedSubject, activeSubject] of [['PATRICIA', 'SYNTHETIC'], ['SYNTHETIC', 'PATRICIA']]) {
    assert.equal(preferredDemoRecoverySubject({ rememberedSubject, activeSubject, allowedSubjects }), rememberedSubject);
  }
  assert.equal(preferredDemoRecoverySubject({ rememberedSubject: 'UNKNOWN', activeSubject: 'SYNTHETIC', allowedSubjects }), 'SYNTHETIC');
  assert.equal(preferredDemoRecoverySubject({ rememberedSubject: null, activeSubject: 'PATRICIA', allowedSubjects: [] }), null);
});
