// Fictional, in-memory CAS and injected clock only. No network/runtime/providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisRepository, CAS_LUA, digest } from '../server/athleteAcademyV1/repository.js';
import { createAcademyService } from '../server/athleteAcademyV1/service.js';
import { createCoachNotesService } from '../server/athleteAcademyV1/coaching/coachNotes.js';
import { COACH_NOTES_POLICY_VERSION, COACH_NOTES_PURPOSE, MAX_PENDING_COACH_NOTES,
  MAX_COACH_NOTES } from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
const clone = value => structuredClone(value);
const AT = Date.parse('2026-09-27T18:00:00.000Z');
const ATTEMPT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', EVIDENCE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SECOND = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function fixture(overrides = {}) {
  let clock = AT, sequence = 0, request = 0;
  const values = new Map(), redis = { beforeEval: null, afterEval: null,
    async get(key) { return values.get(key) ?? null; },
    async eval(script, count, ...args) {
      assert.equal(script, CAS_LUA); const keys = args.slice(0, count), prior = args.slice(count, count * 2), next = args.slice(count * 2);
      if (redis.beforeEval) await redis.beforeEval({ keys, prior, next, values });
      if (keys.some((key, i) => (values.get(key) ?? '') !== prior[i])) return 0;
      keys.forEach((key, i) => { if (next[i] !== '') values.set(key, next[i]); });
      if (redis.afterEval) await redis.afterEval({ keys, prior, next, values }); return 1;
    } };
  const repo = createRedisRepository({ redis, prefix: 'more:athlete-academy:{test-coach-notes}' });
  const config = { coachNotesEnabled: true, coachNotesPolicyVersion: COACH_NOTES_POLICY_VERSION,
    syntheticPreview: true, reviewedPolicyVersion: 'offline-participation-v1', realYouthEnabled: false, ...overrides };
  const owner = { id: 'fictional-owner', email: 'owner@test.invalid', mm: 'MM-FICTIONAL-NOTE-A', displayName: 'Fictional Athlete', verified: true, sessionVersion: 1 };
  const observer = { id: 'fictional-observer', email: 'observer@test.invalid', mm: 'MM-FICTIONAL-NOTE-B', displayName: 'Fictional Observer', verified: true, sessionVersion: 1 };
  const other = { id: 'fictional-other', email: 'other@test.invalid', mm: 'MM-FICTIONAL-NOTE-C', displayName: 'Other Fictional', verified: true, sessionVersion: 1 };
  const dossier = { mm: owner.mm, ownerId: owner.id, archived: false, person: { name: owner.displayName, dateOfBirth: '2000-01-01' },
    entitlements: { coach: true }, participation: { athleteAccepted: true, status: 'self_authorized', policyVersion: config.reviewedPolicyVersion },
    reports: { bos: { immutable: true }, apa: { immutable: true } }, events: [], revision: 0 };
  const originalCoach = { mm: owner.mm, currentApa: { preserved: true }, plan: { accepted: true }, learning: [{ text: 'Only athlete-approved learning' }], messages: [] };
  const docs = { [`account:${owner.id}`]: owner, [`account:${observer.id}`]: observer, [`account:${other.id}`]: other,
    [`email:${digest(observer.email)}`]: { id: observer.id }, [`email:${digest(other.email)}`]: { id: other.id },
    [`dossier:${owner.mm}`]: dossier, [`coach:${owner.mm}`]: originalCoach };
  await repo.transact(Object.keys(docs), () => ({ writes: docs, result: true }));
  const now = () => clock, makeId = () => `${(++sequence).toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
  const academy = createAcademyService({ repo, config, auth: {}, now });
  const service = createCoachNotesService({ repo, academy, config, now, makeId });
  const body = fields => ({ requestId: `fictional-note-request-${++request}`, ...fields });
  const invite = () => service.invite(owner, body({ mm: owner.mm, recipient_email: observer.email, purpose: COACH_NOTES_PURPOSE,
    policy_version: COACH_NOTES_POLICY_VERSION, next_opening_context: true, expires_at: new Date(clock + 86400000).toISOString() }));
  const accept = g => service.accept(observer, body({ mm: owner.mm, grant_id: g.terms.id, grant_version: g.version,
    terms_hash: g.terms_hash, policy_version: COACH_NOTES_POLICY_VERSION, accepted: true }));
  const activate = async () => (await accept((await invite()).invitation)).grant;
  const append = g => service.append(observer, body({ mm: owner.mm, grant_id: g.terms.id, grant_version: g.version, text: 'I observed steadier passing during fictional practice.', reviewed: true }));
  const review = n => service.review(owner, body({ mm: owner.mm, note_id: n.id, content_sha256: n.content_sha256, grant_version: 2 }));
  const box = () => repo.read(`coach-notes:${owner.mm}`);
  const patch = (key, change) => repo.transact([key], s => { const next = clone(s[key]); change(next); return { writes: { [key]: next }, result: true }; });
  const snapshot = async () => { const keys = await service.replayKeys({ mm: owner.mm, ownerId: owner.id }); return Object.fromEntries(await Promise.all(keys.map(async k => [k, await repo.read(k)]))); };
  const hook = async (method, extra = {}) => repo.transact(await service.replayKeys({ mm: owner.mm, ownerId: owner.id }), s => {
    const result = service[method]({ snapshot: s, mm: owner.mm, ownerAccount: owner, ...extra }); return { writes: result.writes, result };
  });
  const ready = async () => { const g = await activate(), n = (await append(g)).receipt; return { g, n }; };
  const unchanged = async () => { assert.deepEqual(await repo.read(`dossier:${owner.mm}`), dossier); assert.deepEqual(await repo.read(`coach:${owner.mm}`), originalCoach); };
  return { repo, redis, values, config, service, owner, observer, other, dossier, body, invite, accept, activate, append, review, box,
    patch, snapshot, hook, ready, unchanged, advance: ms => { clock += ms; } };
}
test('default-off mechanism refuses all mutations and reads', async () => {
  const f = await fixture({ coachNotesEnabled: false }); await assert.rejects(f.invite(), /COACH_NOTES_NOT_ACTIVE/u);
  await assert.rejects(f.service.roster(f.observer), /COACH_NOTES_NOT_ACTIVE/u); assert.equal(await f.box(), null); await f.unchanged();
});
test('exact verified existing account invitation remains pending until recipient accepts its precise terms', async () => {
  const f = await fixture(), g = (await f.invite()).invitation;
  assert.equal(g.status, 'pending'); assert.deepEqual((await f.service.roster(f.observer)).assigned, []);
  assert.equal((await f.service.invitations(f.observer)).invitations[0].terms_hash, g.terms_hash);
  assert.equal((await f.accept(g)).grant.status, 'active'); assert.equal((await f.service.roster(f.observer)).assigned[0].grant_version, 2);
  await f.unchanged();
});
test('invitation must explicitly authorize attributed next-opening context; omission does not grant it', async () => {
  const f = await fixture(), valid = { mm: f.owner.mm, recipient_email: f.observer.email,
    purpose: COACH_NOTES_PURPOSE, policy_version: COACH_NOTES_POLICY_VERSION, expires_at: new Date(AT + 86400000).toISOString() };
  for (const value of [undefined, false, 'true']) await assert.rejects(f.service.invite(f.owner, f.body({ ...valid, next_opening_context: value })), /COACH_NOTE_INVITATION_REVIEW_REQUIRED/u);
  assert.equal(await f.box(), null); assert.equal((await f.invite()).invitation.terms.next_opening_context, 'attributed-unverified-next-opening-only');
});
test('append requires explicit coach exact-text reviewed-send and stores server-derived author review', async () => {
  const f = await fixture(), g = await f.activate(), valid = { mm: f.owner.mm, grant_id: g.terms.id, grant_version: 2, text: 'Exact note reviewed before send.' };
  for (const value of [undefined, false, 'true']) await assert.rejects(f.service.append(f.observer, f.body({ ...valid, reviewed: value })), /COACH_NOTE_REVIEWED_SEND_REQUIRED/u);
  assert.equal((await f.box()).notes.length, 0); const result = await f.service.append(f.observer, f.body({ ...valid, reviewed: true }));
  assert.equal(result.receipt.reviewed_by, f.observer.id); assert.equal(result.receipt.reviewed_at, new Date(AT).toISOString());
  assert.equal((await f.box()).notes[0].text, valid.text); assert.equal((await f.box()).reviews.length, 0);
});
test('unknown/self/unverified recipient is not provisioned or invited', async t => {
  for (const [name, email, change] of [['absent', 'absent@test.invalid', null], ['self', 'owner@test.invalid', null],
    ['unverified', 'observer@test.invalid', a => { a.verified = false; }]]) await t.test(name, async () => {
    const f = await fixture(); if (change) await f.patch(`account:${f.observer.id}`, change);
    await assert.rejects(f.service.invite(f.owner, f.body({ mm: f.owner.mm, recipient_email: email, purpose: COACH_NOTES_PURPOSE,
      policy_version: COACH_NOTES_POLICY_VERSION, next_opening_context: true, expires_at: new Date(AT + 86400000).toISOString() })), /COACH_NOTE_RECIPIENT_UNAVAILABLE/u);
    assert.equal(await f.box(), null);
  });
});
test('recipient acceptance rejects wrong recipient, stale version/hash, absent consent and wrong policy', async t => {
  const f = await fixture(), g = (await f.invite()).invitation;
  const valid = { mm: f.owner.mm, grant_id: g.terms.id, grant_version: 1, terms_hash: g.terms_hash, policy_version: COACH_NOTES_POLICY_VERSION, accepted: true };
  await assert.rejects(f.service.accept(f.other, f.body(valid)), /NOT_FOUND/u);
  for (const [field, value] of [['grant_version', 2], ['terms_hash', '0'.repeat(64)], ['accepted', false], ['policy_version', 'other']])
    await t.test(field, async () => assert.rejects(f.service.accept(f.observer, f.body({ ...valid, [field]: value })), /COACH_NOTE_ACCEPTANCE_REQUIRED/u));
  assert.equal((await f.box()).grants[0].status, 'pending');
});
test('coach reviewed-send is attributed immutable context eligible without per-note athlete approval', async () => {
  const f = await fixture(), g = await f.activate(), n = (await f.append(g)).receipt;
  assert.equal(n.review_status, 'reviewed-send'); assert.equal(n.text, undefined); assert.equal(n.owner_acknowledged, false);
  assert.equal((await f.box()).notes[0].author_id, f.observer.id);
  assert.equal((await f.box()).notes[0].reviewed_by, f.observer.id); assert.equal((await f.box()).reviews.length, 0);
  assert.deepEqual((await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation.note_ids, [n.id]);
  assert.equal((await f.box()).attempts.length, 1); await f.unchanged();
});
test('optional owner acknowledgment is exact and recipient/cross-MM/forged hash cannot acknowledge', async () => {
  const f = await fixture(), g = await f.activate(), n = (await f.append(g)).receipt;
  const b = { mm: f.owner.mm, note_id: n.id, content_sha256: n.content_sha256, grant_version: 2 };
  await assert.rejects(f.service.review(f.observer, f.body(b)), /NOT_FOUND/u);
  await assert.rejects(f.service.review(f.owner, f.body({ ...b, content_sha256: '0'.repeat(64) })), /COACH_NOTE_REVIEW_CHANGED/u);
  await assert.rejects(f.service.review(f.owner, f.body({ ...b, mm: 'MM-OTHER' })), /NOT_FOUND/u);
  await f.review(n); assert.equal((await f.box()).reviews.length, 1); await f.review(n); assert.equal((await f.box()).reviews.length, 1);
});
test('all mutation commands refuse claimed actor/author/authority and broad report purpose', async () => {
  const f = await fixture(), g = await f.activate();
  for (const field of ['actorId', 'author_id', 'authority', 'role', 'speaker', 'coachActorId']) await assert.rejects(
    f.service.append(f.observer, f.body({ mm: f.owner.mm, grant_id: g.terms.id, grant_version: 2, text: 'x', reviewed: true, [field]: f.owner.id })), /COACH_NOTE_COMMAND_INVALID/u);
  await f.unchanged();
});
test('assigned roster and own receipts never disclose reports, chat, note text, email or other authored notes', async () => {
  const f = await fixture(); await f.ready(); const rows = (await f.service.roster(f.observer)).assigned;
  assert.equal(rows.length, 1); assert.deepEqual((await f.service.roster(f.other)).assigned, []);
  const serialized = JSON.stringify({ rows, receipts: await f.service.receipts(f.observer) });
  for (const forbidden of ['@test.invalid', 'steadier passing', 'currentApa', 'learning', 'reports', 'messages']) assert.equal(serialized.includes(forbidden), false);
  await assert.rejects(f.service.ownerNotes(f.observer, { mm: f.owner.mm }), /NOT_FOUND/u);
  assert.equal((await f.service.ownerNotes(f.owner, { mm: f.owner.mm })).notes.length, 1);
});
test('revoke and expiry deny append/review/replay while preserving originals and own metadata', async t => {
  for (const kind of ['revoke', 'expiry']) await t.test(kind, async () => {
    const f = await fixture(), { g } = await f.ready();
    if (kind === 'revoke') await f.service.revoke(f.owner, f.body({ mm: f.owner.mm, grant_id: g.terms.id, grant_version: 2 })); else f.advance(86400000);
    await assert.rejects(f.append(g), /COACH_NOTE_GRANT_UNAVAILABLE/u);
    assert.equal((await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation, null);
    assert.deepEqual((await f.service.roster(f.observer)).assigned, []); assert.equal((await f.service.receipts(f.observer)).receipts.length, 1);
    assert.equal((await f.box()).notes.length, 1); await f.unchanged();
  });
});
test('withdrawal, missing guardian, unavailable entitlement and stale session deny note processing', async t => {
  for (const [kind, key, change, code] of [
    ['withdrawn', 'dossier', d => { d.participation.status = 'withdrawn'; }, /PARTICIPATION_WITHDRAWN/u],
    ['entitlement', 'dossier', d => { d.entitlements.coach = false; }, /ACADEMY_ACCESS_REQUIRED/u],
    ['session', 'account', a => { a.sessionVersion++; }, /SESSION_EXPIRED/u],
    ['unverified', 'account', a => { a.verified = false; }, /SESSION_EXPIRED/u],
  ]) await t.test(kind, async () => {
    const f = await fixture(), g = await f.activate(); await f.patch(key === 'dossier' ? `dossier:${f.owner.mm}` : `account:${f.observer.id}`, change);
    await assert.rejects(f.append(g), code);
  });
  const f = await fixture({ realYouthEnabled: true }), g = await f.activate();
  await f.patch(`dossier:${f.owner.mm}`, d => { d.person.dateOfBirth = '2009-01-01'; d.participation.status = 'guardian_required'; });
  await assert.rejects(f.append(g), /GUARDIAN_REQUIRED/u);
});
test('root hooks are pure and return exact reviewed reservation/projection/metadata without changing application state', async () => {
  const f = await fixture(); await f.ready(); const snapshot = await f.snapshot(), before = clone(snapshot);
  const result = f.service.reserveOpening({ snapshot, mm: f.owner.mm, ownerAccount: f.owner, attemptId: ATTEMPT });
  // The repository supplies cloned snapshots; hook callers must merge returned writes only.
  assert.deepEqual(snapshot, before);
  assert.equal(result.reservation.note_ids.length, 1); assert.equal(Object.keys(result.writes).length, 1);
  await f.unchanged();
});
test('OPENING dispatch admitted once; success receipt/recovery is idempotent and no note is replayed', async () => {
  const f = await fixture(); await f.ready(); const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  const p = await f.hook('preflightOpening', { reservation: r }); assert.equal(p.observations[0].coach_note_handoff, 'next_opening');
  await f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE });
  await assert.rejects(f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE }), /COACH_NOTE_ATTEMPT_CHANGED/u);
  await f.hook('completeOpening', { reservation: r, evidenceId: EVIDENCE }); const before = await f.box();
  await f.hook('recoverOpening', { reservation: r, evidenceId: EVIDENCE }); assert.deepEqual(await f.box(), before);
  assert.equal((await f.hook('reserveOpening', { attemptId: SECOND })).reservation, null);
  assert.equal((await f.service.receipts(f.observer)).receipts[0].status, 'delivered'); await f.unchanged();
});
test('unknown dispatch and reserved-but-not-dispatched notes are quarantined, never silently requeued', async () => {
  const f = await fixture(); await f.ready(); const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  assert.equal((await f.hook('reserveOpening', { attemptId: SECOND })).reservation, null);
  await f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE });
  assert.equal((await f.hook('reserveOpening', { attemptId: SECOND })).reservation, null);
  await assert.rejects(f.hook('recoverOpening', { reservation: r, evidenceId: SECOND }), /COACH_NOTE_EVIDENCE_INVALID/u);
  assert.equal((await f.box()).attempts[0].status, 'dispatched');
});
test('saved-request recovery gets the exact reviewed-send projection without admission or owner acknowledgment', async () => {
  const f = await fixture(); await f.ready(); const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  const original = (await f.hook('preflightOpening', { reservation: r })).observations;
  await f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE }); const before = await f.box();
  const recovered = await f.hook('openingObservations', { reservation: r });
  assert.deepEqual(recovered.observations, original); assert.deepEqual(recovered.writes, {}); assert.deepEqual(await f.box(), before);
  assert.equal((await f.box()).reviews.length, 0);
  assert.notEqual(digest([{ ...original[0], text: 'Forged observation' }]), digest(recovered.observations));
  await assert.rejects(f.hook('preflightOpening', { reservation: r }), /COACH_NOTE_ATTEMPT_CHANGED/u);
});
test('preflight/commit recheck current grant and recipient; post-dispatch revocation cannot release response', async t => {
  for (const kind of ['revoke', 'recipient']) await t.test(kind, async () => {
    const f = await fixture(), { g } = await f.ready(), r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
    await f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE });
    if (kind === 'revoke') await f.service.revoke(f.owner, f.body({ mm: f.owner.mm, grant_id: g.terms.id, grant_version: 2 }));
    else await f.patch(`account:${f.observer.id}`, a => { a.verified = false; });
    await assert.rejects(f.hook('completeOpening', { reservation: r, evidenceId: EVIDENCE }), /COACH_NOTE_GRANT_UNAVAILABLE|COACH_NOTE_RECIPIENT_UNAVAILABLE/u);
    assert.equal((await f.box()).attempts[0].status, 'dispatched');
  });
});
test('snapshot account omissions and forged reservations fail closed without nested storage', async () => {
  const f = await fixture(); await f.ready(); const s = await f.snapshot(); delete s[`account:${f.observer.id}`];
  assert.throws(() => f.service.reserveOpening({ snapshot: s, mm: f.owner.mm, ownerAccount: f.owner, attemptId: ATTEMPT }), /COACH_NOTE_SNAPSHOT_INCOMPLETE/u);
  const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  await assert.rejects(f.hook('preflightOpening', { reservation: { ...r, notes_sha256: '0'.repeat(64) } }), /COACH_NOTE_ATTEMPT_CHANGED/u);
  assert.ok((await f.service.replayKeys({ mm: f.owner.mm, ownerId: f.owner.id })).includes(`coach:${f.owner.mm}`));
});
test('command idempotency and unknown storage acknowledgement preserve one immutable append', async () => {
  const f = await fixture(), g = await f.activate(), b = f.body({ mm: f.owner.mm, grant_id: g.terms.id, grant_version: 2, text: 'One exact note.', reviewed: true });
  let lost = false; f.redis.afterEval = ({ keys }) => { if (!lost && keys.some(k => k.includes(':coach-notes:'))) { lost = true; throw Error('FICTIONAL_ACK_LOST'); } };
  await assert.rejects(f.service.append(f.observer, b), /STORAGE_OUTCOME_UNKNOWN/u); f.redis.afterEval = null;
  const before = await f.box(), receipt = await f.service.append(f.observer, b); assert.equal(before.notes.length, 1);
  assert.equal(receipt.receipt.content_sha256, before.notes[0].content_sha256); assert.deepEqual(await f.box(), before);
  await assert.rejects(f.service.append(f.observer, { ...b, text: 'Different' }), /REQUEST_ID_CONFLICT/u);
});
test('concurrent appends are atomic and retain distinct immutable notes', async () => {
  const f = await fixture(), g = await f.activate(); await Promise.all([f.append(g), f.append(g)]);
  assert.equal((await f.box()).notes.length, 2); assert.equal(new Set((await f.box()).notes.map(n => n.id)).size, 2); await f.unchanged();
});
test('owner can revoke after withdrawal or entitlement loss without restoring participation', async () => {
  const f = await fixture(), g = await f.activate();
  await f.patch(`dossier:${f.owner.mm}`, d => { d.participation.status = 'withdrawn'; d.entitlements.coach = false; });
  await f.service.revoke(f.owner, f.body({ mm: f.owner.mm, grant_id: g.terms.id, grant_version: 2 }));
  assert.equal((await f.box()).grants[0].status, 'revoked');
  assert.equal((await f.repo.read(`dossier:${f.owner.mm}`)).participation.status, 'withdrawn');
});
test('email-account mapping changed before CAS cannot redirect an invitation', async () => {
  const f = await fixture(); let changed = false;
  f.redis.beforeEval = ({ values }) => {
    if (changed) return; changed = true;
    values.set(`${f.repo.prefix}:email:${digest(f.observer.email)}`, JSON.stringify({ id: f.other.id }));
  };
  await assert.rejects(f.invite(), /COACH_NOTE_RECIPIENT_UNAVAILABLE/u); assert.equal(await f.box(), null);
});
test('unknown dispatch-admission acknowledgement cannot renew note eligibility or admit a second call', async () => {
  const f = await fixture(); await f.ready(); const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  let lost = false; f.redis.afterEval = () => { if (!lost) { lost = true; throw Error('FICTIONAL_DISPATCH_ACK_LOST'); } };
  await assert.rejects(f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE }), /STORAGE_OUTCOME_UNKNOWN/u);
  f.redis.afterEval = null; assert.equal((await f.box()).attempts[0].status, 'dispatched');
  await assert.rejects(f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE }), /COACH_NOTE_ATTEMPT_CHANGED/u);
  assert.equal((await f.hook('reserveOpening', { attemptId: SECOND })).reservation, null);
});
test('explicit never-admitted abandonment preserves audit and permits only a later explicit Start reservation', async () => {
  const f = await fixture(); await f.ready(); const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  const before = await f.box(), snapshot = await f.snapshot(), untouched = clone(snapshot);
  const result = f.service.abandonOpening({ snapshot, mm: f.owner.mm, ownerAccount: f.owner, reservation: r, evidenceId: null });
  assert.deepEqual(snapshot, untouched); assert.equal(result.receipt.status, 'abandoned_before_dispatch');
  await f.hook('abandonOpening', { reservation: r, evidenceId: null }); const abandoned = await f.box();
  assert.deepEqual(abandoned.notes, before.notes); assert.deepEqual(abandoned.grants, before.grants);
  assert.deepEqual(abandoned.attempts[0].reservation, r); assert.equal(abandoned.attempts[0].evidence_id, null);
  assert.equal(abandoned.attempts[0].abandoned.owner_id, f.owner.id);
  assert.equal(abandoned.attempts[0].abandoned.no_provider_admission, true);
  assert.equal((await f.service.receipts(f.observer)).receipts[0].status, 'abandoned_before_dispatch');
  for (const method of ['preflightOpening', 'openingObservations', 'abandonOpening']) await assert.rejects(
    f.hook(method, { reservation: r, evidenceId: null }), /COACH_NOTE_ATTEMPT_CHANGED/u);
  const next = (await f.hook('reserveOpening', { attemptId: SECOND })).reservation;
  assert.deepEqual(next.note_ids, r.note_ids); assert.equal(next.notes_sha256, r.notes_sha256);
  assert.equal((await f.box()).attempts.length, 2); assert.equal((await f.box()).attempts[0].status, 'abandoned_before_dispatch');
  assert.equal((await f.service.receipts(f.observer)).receipts[0].attempt_id, SECOND);
  await f.hook('dispatchedOpening', { reservation: next, evidenceId: EVIDENCE });
  await f.hook('completeOpening', { reservation: next, evidenceId: EVIDENCE });
  assert.equal((await f.service.receipts(f.observer)).receipts[0].status, 'delivered'); await f.unchanged();
});
test('dispatched, delivered and unknown admission acknowledgement can never be abandoned or requeued', async t => {
  for (const kind of ['dispatched', 'delivered', 'unknown_ack']) await t.test(kind, async () => {
    const f = await fixture(); await f.ready(); const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
    if (kind === 'unknown_ack') {
      let lost = false; f.redis.afterEval = () => { if (!lost) { lost = true; throw Error('FICTIONAL_ACK_LOST'); } };
      await assert.rejects(f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE }), /STORAGE_OUTCOME_UNKNOWN/u);
      f.redis.afterEval = null;
    } else await f.hook('dispatchedOpening', { reservation: r, evidenceId: EVIDENCE });
    if (kind === 'delivered') await f.hook('completeOpening', { reservation: r, evidenceId: EVIDENCE });
    const before = await f.box(); await assert.rejects(f.hook('abandonOpening', { reservation: r, evidenceId: null }), /COACH_NOTE_ATTEMPT_CHANGED/u);
    assert.deepEqual(await f.box(), before); assert.equal((await f.hook('reserveOpening', { attemptId: SECOND })).reservation, null);
    await f.unchanged();
  });
});
test('pre-dispatch abandonment requires exact null admission evidence and current grant, recipient, session and participant', async t => {
  const cases = [
    ['evidence', async () => {}, { evidenceId: EVIDENCE }, /COACH_NOTE_ATTEMPT_CHANGED/u],
    ['missing_evidence', async () => {}, {}, /COACH_NOTE_ATTEMPT_CHANGED/u],
    ['grant', async (f, g) => f.service.revoke(f.owner, f.body({ mm: f.owner.mm, grant_id: g.terms.id, grant_version: 2 })), { evidenceId: null }, /COACH_NOTE_GRANT_UNAVAILABLE/u],
    ['recipient', async f => f.patch(`account:${f.observer.id}`, a => { a.verified = false; }), { evidenceId: null }, /COACH_NOTE_RECIPIENT_UNAVAILABLE/u],
    ['session', async f => f.patch(`account:${f.owner.id}`, a => { a.sessionVersion++; }), { evidenceId: null }, /SESSION_EXPIRED/u],
    ['withdrawn', async f => f.patch(`dossier:${f.owner.mm}`, d => { d.participation.status = 'withdrawn'; }), { evidenceId: null }, /PARTICIPATION_WITHDRAWN/u],
  ];
  for (const [kind, change, extra, code] of cases) await t.test(kind, async () => {
    const f = await fixture(), { g } = await f.ready(), r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
    await change(f, g); const before = await f.box();
    await assert.rejects(f.hook('abandonOpening', { reservation: r, ...extra }), code); assert.deepEqual(await f.box(), before);
  });
});
test('abandoned reservations count as genuinely pending for append capacity and later Start stays bounded', async () => {
  const f = await fixture(), { g } = await f.ready();
  for (let i = 1; i < MAX_PENDING_COACH_NOTES; i++) await f.append(g);
  const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  assert.equal(r.note_ids.length, MAX_PENDING_COACH_NOTES);
  assert.equal(Object.keys((await f.box()).attempts[0]).length, 6);
  await f.hook('abandonOpening', { reservation: r, evidenceId: null }); const before = await f.box();
  await assert.rejects(f.append(g), /COACH_NOTE_CAPACITY_REACHED/u); assert.deepEqual(await f.box(), before);
  assert.equal((await f.hook('reserveOpening', { attemptId: SECOND })).reservation.note_ids.length, MAX_PENDING_COACH_NOTES);
  await f.unchanged();
});
test('preserved abandoned history cannot exceed the immutable 256-attempt capacity', async () => {
  const f = await fixture(); await f.ready(); const r = (await f.hook('reserveOpening', { attemptId: ATTEMPT })).reservation;
  await f.hook('abandonOpening', { reservation: r, evidenceId: null });
  await f.patch(`coach-notes:${f.owner.mm}`, box => {
    const template = clone(box.attempts[0]);
    box.attempts = Array.from({ length: MAX_COACH_NOTES }, (_, i) => {
      const attempt = clone(template); attempt.reservation.attempt_id = `${(i + 1).toString(16).padStart(8, '0')}-3333-4333-8333-333333333333`;
      const { abandonment_sha256: _hash, ...body } = attempt.abandoned;
      body.reservation_sha256 = digest(attempt.reservation); attempt.abandoned = { ...body, abandonment_sha256: digest(body) };
      return attempt;
    });
  });
  const before = await f.box(); await assert.rejects(f.hook('reserveOpening', { attemptId: SECOND }), /COACH_NOTE_CAPACITY_REACHED/u);
  assert.deepEqual(await f.box(), before); assert.equal(before.attempts.length, MAX_COACH_NOTES); await f.unchanged();
});
test('each note mutation stores exact server-derived operation receipt including optional repeated acknowledgment', async () => {
  const f = await fixture(); let sequence = 1;
  const invoke = async (kind, actor, fields) => {
    const b = { requestId: `${(sequence++).toString(16).padStart(8, '0')}-2222-4222-8222-222222222222`, ...fields };
    const result = await f.service[kind](actor, b), expected = { contract: 'athlete_coach_note_operation_v1',
      actor_id: actor.id, mm: f.owner.mm, request_id: b.requestId, signature_sha256: digest(b), kind: `coach_notes_${kind}` };
    assert.deepEqual(result.operation_receipt, expected);
    assert.deepEqual((await f.repo.read(`operation:${actor.id}:${b.requestId}`)).result.operation_receipt, expected);
    return result;
  };
  const invitation = (await invoke('invite', f.owner, { mm: f.owner.mm, recipient_email: f.observer.email,
    purpose: COACH_NOTES_PURPOSE, policy_version: COACH_NOTES_POLICY_VERSION, next_opening_context: true,
    expires_at: new Date(AT + 86400000).toISOString() })).invitation;
  const grant = (await invoke('accept', f.observer, { mm: f.owner.mm, grant_id: invitation.terms.id,
    grant_version: 1, terms_hash: invitation.terms_hash, policy_version: COACH_NOTES_POLICY_VERSION, accepted: true })).grant;
  const note = (await invoke('append', f.observer, { mm: f.owner.mm, grant_id: grant.terms.id, grant_version: 2,
    text: 'Exact journaled observation.', reviewed: true })).receipt;
  const review = { mm: f.owner.mm, note_id: note.id, content_sha256: note.content_sha256, grant_version: 2 };
  await invoke('review', f.owner, review); await invoke('review', f.owner, review);
  await invoke('revoke', f.owner, { mm: f.owner.mm, grant_id: grant.terms.id, grant_version: 2 });
  await f.unchanged();
});
test('read-only outcome acknowledges exact immutable own journal without returning result, note text or email', async () => {
  const f = await fixture(), g = await f.activate(), b = { requestId: SECOND, mm: f.owner.mm, grant_id: g.terms.id,
    grant_version: 2, text: 'Private outcome observation.', reviewed: true };
  let lost = false; f.redis.afterEval = () => { if (!lost) { lost = true; throw Error('FICTIONAL_ACK_LOST'); } };
  await assert.rejects(f.service.append(f.observer, b), /STORAGE_OUTCOME_UNKNOWN/u); f.redis.afterEval = null;
  const query = { mm: f.owner.mm, request_id: b.requestId, signature_sha256: digest(b), kind: 'coach_notes_append' };
  const before = clone([...f.values]), result = await f.service.outcome(f.observer, query);
  assert.deepEqual(result, { noteOutcome: { contract: 'athlete_coach_note_outcome_v1', actor_id: f.observer.id,
    ...query, status: 'acknowledged' } }); assert.deepEqual([...f.values], before);
  assert.equal((await f.box()).notes.length, 1);
  for (const forbidden of ['Private outcome observation', '@test.invalid', 'receipt', 'grant_version']) assert.equal(JSON.stringify(result).includes(forbidden), false);
  const missing = await f.service.outcome(f.observer, { ...query, request_id: ATTEMPT }); assert.equal(missing.noteOutcome.status, 'unresolved');
  const other = await f.service.outcome(f.other, query); assert.equal(other.noteOutcome.status, 'unresolved');
  assert.equal(other.noteOutcome.actor_id, f.other.id); assert.deepEqual([...f.values], before); await f.unchanged();
});
test('outcome denies MM/hash/kind/account tamper, legacy unjournaled operation, malformed command and default-off', async () => {
  const f = await fixture(), g = await f.activate(), b = { requestId: SECOND, mm: f.owner.mm, grant_id: g.terms.id,
    grant_version: 2, text: 'Exact observation.', reviewed: true }; await f.service.append(f.observer, b);
  const query = { mm: f.owner.mm, request_id: SECOND, signature_sha256: digest(b), kind: 'coach_notes_append' };
  for (const change of [{ mm: f.other.mm }, { signature_sha256: '0'.repeat(64) }, { kind: 'coach_notes_review' }])
    await assert.rejects(f.service.outcome(f.observer, { ...query, ...change }), /COACH_NOTE_OUTCOME_MISMATCH/u);
  for (const change of [{ request_id: 'not-a-uuid' }, { request_id: [SECOND] }, { kind: 'coach_action' },
    { signature_sha256: 'x' }, { signature_sha256: [digest(b)] }, { actor_id: f.owner.id }])
    await assert.rejects(f.service.outcome(f.observer, { ...query, ...change }), /COACH_NOTE_COMMAND_INVALID/u);
  await f.patch(`operation:${f.observer.id}:${SECOND}`, saved => { delete saved.result.operation_receipt; });
  await assert.rejects(f.service.outcome(f.observer, query), /COACH_NOTE_OUTCOME_MISMATCH/u);
  await f.patch(`account:${f.observer.id}`, a => { a.sessionVersion++; });
  await assert.rejects(f.service.outcome(f.observer, query), /SESSION_EXPIRED/u);
  const off = await fixture({ coachNotesEnabled: false }); await assert.rejects(off.service.outcome(off.observer, query), /COACH_NOTES_NOT_ACTIVE/u);
});
