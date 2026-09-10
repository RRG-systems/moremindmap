import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsultingRuntimeFixture, deterministicConsultingTransport } from '../scripts/recruiting-two-box-review/runtimeFixture.mjs';
import { stableHash, digestToken } from '../src/lib/recruitingV1/contracts.js';

async function openedFixture(options = {}) {
  const fixture = await createConsultingRuntimeFixture(options);
  const person = await fixture.addPerson();
  const token = fixture.tokens[person.membershipId];
  const opened = await fixture.runtime.openCandidate(token, person.candidateId);
  return { ...fixture, person, token, opened, sessionId: opened.session.session_id };
}

async function proposedFixture(options = {}) {
  const fixture = await openedFixture(options);
  let result = await fixture.runtime.mutate(fixture.token, fixture.sessionId, 'CHANGE_ROOM', { room: 'PLAN', expected_revision: fixture.opened.session.revision });
  result = await fixture.runtime.mutate(fixture.token, fixture.sessionId, 'CHAT', {
    message: 'Hold one review each week for four weeks and bring what we learned.', expected_revision: result.session.revision,
  });
  return { ...fixture, proposed: result.session };
}

test('real Consulting uses authorized name and canonical BOS+BA in the existing four-room session', async () => {
  const fixture = await openedFixture();
  const { runtime, person, token, opened, sessionId } = fixture;
  assert.equal(opened.session.synthetic_only, false);
  assert.equal(opened.invitee.name, person.name);
  assert.equal(opened.session.subject_binding.profile_id, person.profileId);
  assert.equal(opened.session.subject_binding.candidate_id, person.candidateId);
  assert.equal(opened.authored_surfaces.bos.profile_id, person.profileId.toUpperCase());
  assert.equal(opened.authored_surfaces.receipts.ba.profile_id, person.profileId.toUpperCase());
  assert.equal(opened.manager.capabilities.sponsored_follow_up, false);
  assert.equal(opened.session.current_room, 'HOME');
  const canonicalBefore = stableHash([...fixture.authoredValues]);
  let result = opened;
  for (const room of ['YOU', 'YOUR_BUSINESS']) {
    result = await runtime.mutate(token, sessionId, 'CHANGE_ROOM', { room, expected_revision: result.session.revision });
    result = await runtime.mutate(token, sessionId, 'CHAT', { message: 'What can we learn from this?', expected_revision: result.session.revision });
    assert.match(result.session.current_coach_move.move.insight, /Jordan Lee/u);
    result = await runtime.mutate(token, sessionId, 'COMPILE_GU', { coach_move_id: result.coach_move_id, expected_revision: result.session.revision });
    assert.equal(result.session.current_projection.room, room);
    assert.equal(result.session.session_id, sessionId);
  }
  const reopened = await runtime.openCandidate(token, person.candidateId);
  assert.equal(reopened.session.session_id, sessionId);
  assert.deepEqual(reopened.session.conversation, result.session.conversation);
  assert.equal(stableHash([...fixture.authoredValues]), canonicalBefore);
  assert.equal(reopened.session.invariants.canonical_mutation, false);
});

test('both-ready gate denies BOS only, BA running, unaccepted, incomplete, and mismatched canonical results without creating a session', async () => {
  for (const readiness of ['INVITED', 'BOS_IN_PROGRESS', 'BOS_READY', 'BA_IN_PROGRESS']) {
    const fixture = await createConsultingRuntimeFixture();
    const person = await fixture.addPerson({ readiness });
    await assert.rejects(() => fixture.runtime.openCandidate(fixture.tokens[person.membershipId], person.candidateId), /BOTH_ASSESSMENTS_NOT_READY/u);
    assert.equal(Object.keys((await fixture.store.read()).shared_business_sessions).length, 0);
    assert.equal(Object.keys((await fixture.store.read()).consultation_relationships).length, 0);
  }
  for (const mutate of [
    (authored) => { authored.ba = null; },
    (authored) => { authored.receipts.bos.complete_surface_count = 14; },
    (authored) => { authored.bos.profile_id = 'MM-20990101-WRONG001'; },
    (authored) => { authored.receipts.ba.profile_id = 'MM-20990101-WRONG001'; },
    (authored) => { authored.receipts.ba.assessment_id = 'wrong-assessment'; },
    (authored) => { authored.receipts.ba.realization_id = 'wrong-realization'; },
    (authored) => { authored.receipts.ba.artifact_sha256 = 'f'.repeat(64); },
  ]) {
    const fixture = await createConsultingRuntimeFixture();
    const person = await fixture.addPerson();
    mutate(fixture.authoredValues.get(person.profileId));
    await assert.rejects(() => fixture.runtime.openCandidate(fixture.tokens[person.membershipId], person.candidateId), /NOT_READY|SCOPE_DENIED|READINESS_STALE/u);
    assert.equal(Object.keys((await fixture.store.read()).shared_business_sessions).length, 0);
  }
});

test('manager isolation and selected name bind to server-resolved subject; no client profile can substitute another person', async () => {
  const fixture = await openedFixture();
  const other = await fixture.addPerson({ membershipId: fixture.memberships[1].membership_id, name: 'Riley Quinn', email: 'riley@example.test', profileId: 'mm-20990101-riley001' });
  const otherToken = fixture.tokens[other.membershipId];
  const otherOpened = await fixture.runtime.openCandidate(otherToken, other.candidateId);
  assert.equal(otherOpened.invitee.name, 'Riley Quinn');
  assert.equal(otherOpened.session.subject_binding.profile_id, other.profileId);
  assert.equal((await fixture.runtime.home(fixture.token)).candidates.some((row) => row.candidate_id === other.candidateId), false);
  await assert.rejects(() => fixture.runtime.openCandidate(fixture.token, other.candidateId), /SCOPE_DENIED/u);
  await assert.rejects(() => fixture.runtime.openRelationship(fixture.token, otherOpened.session.relationship_id), /SCOPE_DENIED/u);
  await assert.rejects(() => fixture.runtime.read(fixture.token, otherOpened.session.session_id), /SCOPE_DENIED/u);
  await assert.rejects(() => fixture.runtime.mutate(fixture.token, otherOpened.session.session_id, 'CHANGE_ROOM', { room: 'PLAN', expected_revision: otherOpened.session.revision }), /SCOPE_DENIED/u);
  const changed = await fixture.runtime.mutate(fixture.token, fixture.sessionId, 'CHANGE_ROOM', { room: 'YOU', expected_revision: fixture.opened.session.revision, profile_id: other.profileId, candidate_id: other.candidateId });
  assert.equal(changed.session.subject_binding.profile_id, fixture.person.profileId);
  await fixture.store.transaction((state) => { state.shared_business_sessions[fixture.sessionId].subject_binding.profile_id = other.profileId; return true; });
  await assert.rejects(() => fixture.runtime.read(fixture.token, fixture.sessionId), /SESSION_SUBJECT_SCOPE_DENIED/u);
});

test('read, room changes and PLAN decisions recheck revoked/suspended and current canonical authority', async () => {
  const corruptions = [
    async (f) => f.store.transaction((state) => { state.consultation_relationships[f.proposed.relationship_id].status = 'REVOKED'; return true; }),
    async (f) => f.store.transaction((state) => { state.invitations[f.person.invitationId].state = 'REVOKED'; return true; }),
    async (f) => f.store.transaction((state) => { state.memberships[f.person.membershipId].status = 'SUSPENDED'; return true; }),
    async (f) => f.store.transaction((state) => { state.invitations[f.person.invitationId].manager_subject_id = 'other-manager'; return true; }),
    async (f) => f.store.transaction((state) => { state.consultation_relationships[f.proposed.relationship_id].profile_id = 'mm-20990101-wrong001'; return true; }),
    async (f) => { f.authoredValues.get(f.person.profileId).receipts.ba.realization_id = 'canonical-changed'; },
    async (f) => { f.authoredValues.get(f.person.profileId).receipts.ba.complete = false; },
    async (f) => { f.authoredValues.get(f.person.profileId).bos.profile_id = 'mm-20990101-wrong001'; },
    async (f) => f.store.transaction((state) => { delete state.manager_sessions[digestToken(f.token)]; return true; }),
  ];
  for (const corrupt of corruptions) {
    const f = await proposedFixture();
    await corrupt(f);
    const before = stableHash((await f.store.read()).shared_business_sessions);
    await assert.rejects(() => f.runtime.read(f.token, f.sessionId));
    await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, 'CHANGE_ROOM', { room: 'HOME', expected_revision: f.proposed.revision }));
    await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, 'PLAN_DECISION', { decision: 'YES', expected_revision: f.proposed.revision }));
    assert.equal(stableHash((await f.store.read()).shared_business_sessions), before);
    assert.equal((await f.store.read()).shared_business_sessions[f.sessionId].accepted_plan_snapshot, null);
  }
});

test('ADJUST preserves draft, YES preserves exact accepted snapshot and resume, duplicate accept does not debit or redeliver', async () => {
  const f = await proposedFixture();
  const draft = structuredClone(f.proposed.proposals.at(-1).proposal);
  let result = await f.runtime.mutate(f.token, f.sessionId, 'PLAN_DECISION', { decision: 'ADJUST', expected_revision: f.proposed.revision });
  assert.deepEqual(result.session.proposals.at(-1).proposal, draft);
  assert.equal(result.session.current_room, 'PLAN');
  result = await f.runtime.mutate(f.token, f.sessionId, 'CHAT', { message: 'Make it thirty minutes starting next Tuesday.', expected_revision: result.session.revision });
  assert.match(result.session.proposals.at(-1).proposal.commitments[0].commitment, /thirty-minute/u);
  const expected = structuredClone(result.session.proposals.at(-1).proposal);
  const revision = result.session.revision;
  const accepted = await f.runtime.mutate(f.token, f.sessionId, 'PLAN_DECISION', { decision: 'YES', expected_revision: revision });
  assert.deepEqual(accepted.session.accepted_plan_snapshot.plan, expected);
  assert.equal(accepted.session.accepted_plan_snapshot.snapshot_hash, stableHash(expected));
  assert.equal(accepted.session.agreement_delivery.status, 'DELIVERED');
  assert.equal(accepted.session.invariants.external_mutation, false);
  const before = await f.store.read();
  const emails = Object.values(before.outbox).filter((item) => item.kind === 'CONSULTING_AGREED_PLAN');
  assert.equal(emails.length, 2);
  assert.equal(new Set(emails.map((item) => item.payload.accepted_plan_snapshot.snapshot_hash)).size, 1);
  await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, 'PLAN_DECISION', { decision: 'YES', expected_revision: revision }), /STALE_SESSION_REFUSED/u);
  const reopened = await f.runtime.openCandidate(f.token, f.person.candidateId);
  assert.equal(reopened.session.session_id, f.sessionId);
  assert.equal(reopened.session.status, 'COMPLETED');
  assert.deepEqual(reopened.session.accepted_plan_snapshot, accepted.session.accepted_plan_snapshot);
  assert.equal(Object.keys((await f.store.read()).shared_business_sessions).length, 1);
  assert.equal(Object.values((await f.store.read()).outbox).filter((item) => item.kind === 'CONSULTING_AGREED_PLAN').length, 2);
  assert.equal((await f.service.home(f.token)).entitlement.used, 1);
});

test('real NOT NOW preserves graceful fallback but never manufactures sponsor activation', async () => {
  const f = await proposedFixture();
  const declined = await f.runtime.mutate(f.token, f.sessionId, 'PLAN_DECISION', { decision: 'NOT_NOW', expected_revision: f.proposed.revision });
  const before = stableHash((await f.store.read()).shared_business_sessions);
  await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, 'SECOND_OFFER_DECISION', { decision: 'STAY_CONNECTED', expected_revision: declined.session.revision }), /SPONSORED_FOLLOW_UP_UNAVAILABLE/u);
  assert.equal(stableHash((await f.store.read()).shared_business_sessions), before);
  const closed = await f.runtime.mutate(f.token, f.sessionId, 'SECOND_OFFER_DECISION', { decision: 'CLOSE_GRACEFULLY', expected_revision: declined.session.revision });
  assert.equal(closed.session.status, 'COMPLETED');
  assert.deepEqual(closed.session.effect_receipts, []);
});

test('real agreement delivery failure preserves acceptance; revoked response authority never returns cached accepted payload', async () => {
  const failure = await proposedFixture({ notificationTransport: {
    synthetic: true,
    async deliver(item) { return { success: item.kind !== 'CONSULTING_AGREED_PLAN', receipt: 'synthetic-delivery-failure-test' }; },
  } });
  const accepted = await failure.runtime.mutate(failure.token, failure.sessionId, 'PLAN_DECISION', { decision: 'YES', expected_revision: failure.proposed.revision });
  assert.equal(accepted.session.status, 'COMPLETED');
  assert.equal(accepted.session.agreement_delivery.status, 'FAILED');
  assert.deepEqual(accepted.session.accepted_plan_snapshot.plan, failure.proposed.proposals.at(-1).proposal);
  assert.deepEqual((await failure.runtime.read(failure.token, failure.sessionId)).accepted_plan_snapshot, accepted.session.accepted_plan_snapshot);

  let revokedFixture;
  const transport = {
    synthetic: true,
    async deliver(item) {
      if (item.kind === 'CONSULTING_AGREED_PLAN') {
        await revokedFixture.store.transaction((state) => { state.consultation_relationships[revokedFixture.proposed.relationship_id].status = 'REVOKED'; return true; });
      }
      return { success: true, receipt: 'synthetic-only' };
    },
  };
  revokedFixture = await proposedFixture({ notificationTransport: transport });
  await assert.rejects(() => revokedFixture.runtime.mutate(revokedFixture.token, revokedFixture.sessionId, 'PLAN_DECISION', { decision: 'YES', expected_revision: revokedFixture.proposed.revision }), /SCOPE_DENIED/u);
  const preserved = (await revokedFixture.store.read()).shared_business_sessions[revokedFixture.sessionId];
  assert.equal(preserved.status, 'COMPLETED');
  assert.deepEqual(preserved.accepted_plan_snapshot.plan, revokedFixture.proposed.proposals.at(-1).proposal);
  await assert.rejects(() => revokedFixture.runtime.read(revokedFixture.token, revokedFixture.sessionId), /SCOPE_DENIED/u);
});

test('revocation or canonical drift while PLAN is generating prevents late publication', async () => {
  for (const corruption of ['REVOKE', 'CANONICAL_DRIFT']) {
    let signalStarted;
    let release;
    const started = new Promise((resolve) => { signalStarted = resolve; });
    const hold = new Promise((resolve) => { release = resolve; });
    const f = await openedFixture({ frontierTransport: async (request) => { signalStarted(); await hold; return deterministicConsultingTransport(request); } });
    const room = await f.runtime.mutate(f.token, f.sessionId, 'CHANGE_ROOM', { room: 'PLAN', expected_revision: f.opened.session.revision });
    const pending = f.runtime.mutate(f.token, f.sessionId, 'CHAT', { message: 'Hold a review for four weeks.', expected_revision: room.session.revision });
    await started;
    if (corruption === 'REVOKE') await f.store.transaction((state) => { state.consultation_relationships[f.opened.session.relationship_id].status = 'REVOKED'; return true; });
    else f.authoredValues.get(f.person.profileId).receipts.ba.realization_id = 'changed-during-generation';
    release();
    await assert.rejects(() => pending, /SCOPE_DENIED|NOT_READY|STALE/u);
    const session = (await f.store.read()).shared_business_sessions[f.sessionId];
    assert.equal(session.proposals.length, 0);
    assert.equal(session.conversation.length, 1);
    assert.equal(session.conversation[0].actor, 'MANAGER');
  }
});
