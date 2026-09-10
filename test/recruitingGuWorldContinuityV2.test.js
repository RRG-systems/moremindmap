import test from 'node:test';
import assert from 'node:assert/strict';
import { createConsultingRuntimeFixture } from '../scripts/recruiting-two-box-review/runtimeFixture.mjs';
import { createRecruitingGuWorld, RECRUITING_GU_WORLD_IDENTITY_VERSION } from '../src/lib/recruitingGuV1/world.js';
import { stableHash } from '../src/lib/recruitingV1/contracts.js';

async function openFixture(options = {}) {
  const f = await createConsultingRuntimeFixture(options);
  const person = await f.addPerson();
  const token = f.tokens[person.membershipId];
  const opened = await f.runtime.openCandidate(token, person.candidateId);
  return { ...f, person, token, opened, sessionId: opened.session.session_id };
}

async function acceptPlan(f) {
  let result = await f.runtime.mutate(f.token, f.sessionId, 'CHANGE_ROOM', { room: 'PLAN', expected_revision: f.opened.session.revision });
  result = await f.runtime.mutate(f.token, f.sessionId, 'CHAT', { message: 'Meet weekly for four weeks.', expected_revision: result.session.revision });
  return f.runtime.mutate(f.token, f.sessionId, 'PLAN_DECISION', { decision: 'YES', expected_revision: result.session.revision });
}

test('same canonical source resumes across UTC midnight for read, rooms and CHAT without invented source dates', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-09T23:58:00.000Z') });
  const f = await createConsultingRuntimeFixture({ now: () => new Date() });
  const person = await f.addPerson();
  const authored = f.authoredValues.get(person.profileId);
  authored.receipts.bos.created_at = '2026-08-14T10:12:00.000Z';
  authored.receipts.ba.created_at = '2026-08-17T08:15:00.000Z';
  const token = f.tokens[person.membershipId];
  const first = await f.runtime.openCandidate(token, person.candidateId);
  assert.equal(first.world.identityVersion, RECRUITING_GU_WORLD_IDENTITY_VERSION);
  assert.equal(first.world.evidence.find((item) => item.id === 'ev-subject-bos').sourceDate, '2026-08-14');
  assert.equal(first.world.evidence.find((item) => item.id === 'ev-subject-ba').sourceDate, '2026-08-17');
  assert.equal(first.world.evidence.find((item) => item.id === 'ev-manager-opportunity').sourceDate, 'UNKNOWN');
  t.mock.timers.setTime(Date.parse('2026-09-10T00:02:00.000Z'));
  const second = await f.runtime.openCandidate(token, person.candidateId);
  assert.equal(second.world.version, first.world.version);
  assert.equal(second.world.worldId, first.world.worldId);
  assert.notEqual(second.world.asOf, first.world.asOf);
  assert.equal(second.session.session_id, first.session.session_id);
  const restored = await f.runtime.read(token, second.session.session_id);
  let result = await f.runtime.mutate(token, restored.session_id, 'CHANGE_ROOM', { room: 'YOU', expected_revision: restored.revision });
  result = await f.runtime.mutate(token, restored.session_id, 'CHAT', { message: 'What should we consider together?', expected_revision: result.session.revision });
  assert.equal(result.session.current_room, 'YOU');
  assert.equal(result.session.current_coach_move.room, 'YOU');
  assert.equal(result.session.world_version, first.world.version);
});

test('world dates preserve explicit source dates and missingness; full deep artifacts and receipt changes change identity', () => {
  const input = {
    relationship: { relationship_id: 'relationship-one', consent_state: 'ACCEPTED', status: 'ACTIVE' },
    candidate: { profile_id: 'mm-20990101-person01', name: 'Synthetic Person' },
    manager: { subject_id: 'manager-one', name: 'Synthetic Manager' },
    bosArtifact: { profile_id: 'MM-20990101-PERSON01', summary: 'Same summary', deep: { evidence: 'one' } },
    baViewModel: { version: 'unchanged-version', summary: 'Same business summary', deep: { evidence: 'one' } },
    canonicalReceipts: { bos: { artifact_sha256: 'a'.repeat(64) }, ba: { artifact_sha256: 'b'.repeat(64) } },
    opportunity: { items: [{ statement: 'First supported claim', source_date: '2026-08-01' }, { statement: 'Second claim', source_date: '2026-08-03' }] },
    managerEvidence: [{ claim: 'An observation', source_date: '2026-08-04' }, { claim: 'An undated observation' }],
  };
  const first = createRecruitingGuWorld(input);
  assert.equal(first.evidence[0].sourceDate, 'UNKNOWN');
  assert.equal(first.evidence[1].sourceDate, 'UNKNOWN');
  assert.deepEqual(first.evidence[2].sourceDates, ['2026-08-01', '2026-08-03']);
  assert.equal(first.evidence[2].sourceDate, 'MULTIPLE_SOURCE_DATES');
  assert.deepEqual(first.evidence[3].sourceDates, ['2026-08-04', 'UNKNOWN']);
  for (const edit of [
    (value) => { value.bosArtifact.deep.evidence = 'different'; },
    (value) => { value.baViewModel.deep.evidence = 'different'; },
    (value) => { value.canonicalReceipts.bos.artifact_sha256 = 'c'.repeat(64); },
    (value) => { value.managerEvidence[0].source_date = '2026-08-05'; },
  ]) {
    const changed = structuredClone(input);
    edit(changed);
    assert.notEqual(createRecruitingGuWorld(changed).version, first.version);
  }
});

test('actual canonical content or receipt drift denies continuing read, room, CHAT and PLAN; archive never mixes old session with new evidence', async () => {
  for (const edit of [
    (value) => { value.bos.unchanged_summary_deeper_evidence = 'new governed evidence'; },
    (value) => { value.ba.unchanged_version_deeper_evidence = 'new governed evidence'; },
    (value) => { value.receipts.bos.artifact_sha256 = 'c'.repeat(64); },
  ]) {
    const f = await openFixture();
    const original = stableHash((await f.store.read()).shared_business_sessions[f.sessionId]);
    edit(f.authoredValues.get(f.person.profileId));
    await assert.rejects(() => f.runtime.read(f.token, f.sessionId), /GOVERNED_WORLD_STALE/u);
    for (const [action, payload] of [
      ['CHANGE_ROOM', { room: 'PLAN' }], ['CHAT', { message: 'Continue from this.' }], ['PLAN_DECISION', { decision: 'YES' }],
    ]) await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, action, { ...payload, expected_revision: f.opened.session.revision }), /GOVERNED_WORLD_STALE/u);
    const archive = await f.runtime.openCandidate(f.token, f.person.candidateId);
    assert.equal(archive.requires_new_consultation, true);
    assert.equal(archive.archive.read_only, true);
    assert.equal(archive.authored_surfaces, null);
    assert.equal(archive.world, null);
    assert.equal(stableHash(archive.session), original);
    assert.equal(f.providerRequests.length, 0);
  }
});

test('explicit subsequent consultation is one-per-completed-predecessor, fresh and authorized, with immutable prior agreed plan', async () => {
  const f = await openFixture();
  await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, 'START_ANOTHER_CONSULTATION', { expected_revision: f.opened.session.revision }), /COMPLETED_PREDECESSOR_REQUIRED/u);
  const accepted = await acceptPlan(f);
  const original = structuredClone((await f.store.read()).shared_business_sessions[f.sessionId]);
  const requests = await Promise.all(Array.from({ length: 8 }, () => f.runtime.mutate(f.token, f.sessionId, 'START_ANOTHER_CONSULTATION', { expected_revision: accepted.session.revision })));
  assert.equal(new Set(requests.map((item) => item.session.session_id)).size, 1);
  assert.equal(requests.filter((item) => !item.idempotent).length, 1);
  const next = requests[0];
  assert.notEqual(next.session.session_id, f.sessionId);
  assert.equal(next.session.predecessor_session_id, f.sessionId);
  assert.equal(next.session.current_room, 'HOME');
  assert.equal(next.session.status, 'OPEN');
  assert.equal(next.session.accepted_plan_snapshot, null);
  assert.deepEqual(next.previous_accepted_plans[0].accepted_plan_snapshot, accepted.session.accepted_plan_snapshot);
  assert.equal(next.previous_accepted_plans[0].evidence_state, 'EARLIER_SESSION_PLAN_NOT_CURRENT_EVIDENCE');
  assert.deepEqual((await f.store.read()).shared_business_sessions[f.sessionId], original);
  assert.equal((await f.runtime.openCandidate(f.token, f.person.candidateId)).session.session_id, next.session.session_id);
  assert.equal(Object.keys((await f.store.read()).shared_business_sessions).length, 2);
  await assert.rejects(() => f.runtime.mutate(f.tokens[f.memberships[1].membership_id], f.sessionId, 'START_ANOTHER_CONSULTATION', { expected_revision: accepted.session.revision }), /SCOPE_DENIED/u);
});

test('legacy identity stays read-only and supports explicit fresh current session without rewriting prior accepted history', async () => {
  for (const completed of [false, true]) {
    const f = await openFixture();
    if (completed) await acceptPlan(f);
    await f.store.transaction((state) => { state.shared_business_sessions[f.sessionId].world_version = 'gu-world-legacy-source-date-hash'; return true; });
    const original = structuredClone((await f.store.read()).shared_business_sessions[f.sessionId]);
    const archive = await f.runtime.openCandidate(f.token, f.person.candidateId);
    assert.equal(archive.requires_new_consultation, true);
    assert.match(archive.archive.message, /earlier record/u);
    assert.doesNotMatch(archive.archive.message, /answers.*changed|changed.*answers/u);
    assert.deepEqual(archive.session, original);
    await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, 'CHANGE_ROOM', { room: 'HOME', expected_revision: original.revision }), /GOVERNED_WORLD_STALE/u);
    const started = await f.runtime.mutate(f.token, f.sessionId, 'START_ANOTHER_CONSULTATION', { expected_revision: original.revision });
    assert.equal(started.requires_new_consultation, false);
    assert.match(started.session.world_version, /^gu-world-v2-/u);
    assert.equal(started.session.current_room, 'HOME');
    assert.deepEqual((await f.store.read()).shared_business_sessions[f.sessionId], original);
    assert.equal((await f.runtime.openCandidate(f.token, f.person.candidateId)).session.session_id, started.session.session_id);
    if (completed) assert.deepEqual(started.previous_accepted_plans[0].accepted_plan_snapshot, original.accepted_plan_snapshot);
  }
});

test('superseded predecessor remains read-only after canonical rollback and START retries keep the same successor', async () => {
  for (const withProposedPlan of [false, true]) {
    const f = await openFixture();
    if (withProposedPlan) {
      const room = await f.runtime.mutate(f.token, f.sessionId, 'CHANGE_ROOM', { room: 'PLAN', expected_revision: f.opened.session.revision });
      await f.runtime.mutate(f.token, f.sessionId, 'CHAT', { message: 'Meet weekly for four weeks.', expected_revision: room.session.revision });
    }
    const predecessor = structuredClone((await f.store.read()).shared_business_sessions[f.sessionId]);
    const originalAuthored = structuredClone(f.authoredValues.get(f.person.profileId));
    f.authoredValues.get(f.person.profileId).bos.updated_evidence = 'Different governed evidence for the next consultation.';
    const successor = await f.runtime.mutate(f.token, f.sessionId, 'START_ANOTHER_CONSULTATION', { expected_revision: predecessor.revision });
    assert.notEqual(successor.session.session_id, predecessor.session_id);
    f.authoredValues.set(f.person.profileId, originalAuthored);
    // The original world is valid again, but explicit supersession is durable.
    assert.deepEqual(await f.runtime.read(f.token, f.sessionId), predecessor);
    const providerCount = f.providerRequests.length;
    for (const [action, payload] of [
      ['CHANGE_ROOM', { room: 'PLAN' }], ['CHAT', { message: 'Try accepting the earlier plan.' }],
      ['PLAN_DECISION', { decision: 'YES' }], ['SCENARIO_CHANGE', { values: { hours: 1 } }],
    ]) await assert.rejects(() => f.runtime.mutate(f.token, f.sessionId, action, { ...payload, expected_revision: predecessor.revision }), /SESSION_SUPERSEDED_READ_ONLY/u);
    assert.equal(f.providerRequests.length, providerCount);
    assert.deepEqual((await f.store.read()).shared_business_sessions[f.sessionId], predecessor);
    const retry = await f.runtime.mutate(f.token, f.sessionId, 'START_ANOTHER_CONSULTATION', { expected_revision: predecessor.revision });
    assert.equal(retry.idempotent, true);
    assert.equal(retry.session.session_id, successor.session.session_id);
    assert.equal(Object.keys((await f.store.read()).shared_business_sessions).length, 2);
  }
});
