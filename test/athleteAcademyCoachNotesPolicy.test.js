// Pure proposed-policy fixtures only. No accounts, runtime, Redis or providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { digest } from '../server/athleteAcademyV1/repository.js';
import { COACH_NOTES_POLICY_VERSION, COACH_NOTES_PURPOSE, COACH_NOTES_OPENING_CONTEXT, MAX_NOTE_GRANT_MS, noteGate,
  noteTerms, validateNoteGrant, activeNoteGrant, immutableObservation, validateObservation,
  emptyNoteBox, validateNoteBox, claimedNoteIds, coachObservationInput, ownNoteReceipts, noteCommand,
  noteSession } from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
const at = Date.parse('2026-09-27T18:00:00.000Z');
const id = '11111111-1111-4111-8111-111111111111';
const noteId = '22222222-2222-4222-8222-222222222222';
function grant() {
  const terms = noteTerms({ id, mm: 'MM-FICTIONAL', owner_id: 'fictional-owner', recipient_id: 'fictional-observer',
    purpose: COACH_NOTES_PURPOSE, policy_version: COACH_NOTES_POLICY_VERSION, next_opening_context: COACH_NOTES_OPENING_CONTEXT,
    created_at: new Date(at).toISOString(), expires_at: new Date(at + 86400000).toISOString() });
  return { terms, terms_hash: digest(terms), version: 2, status: 'active',
    accepted: { recipient_id: terms.recipient_id, terms_hash: digest(terms), at: terms.created_at }, revoked: null };
}
function observation(g = grant()) {
  return immutableObservation({ id: noteId, mm: g.terms.mm, grant: g,
    author: { id: g.terms.recipient_id, verified: true, displayName: 'Fictional Observer' }, text: 'An unverified observation.', at: g.terms.created_at, reviewed: true });
}
test('proposed policy cannot activate by omission, generic policy or truthy flag', () => {
  for (const config of [{}, { coachNotesEnabled: 'true', coachNotesPolicyVersion: COACH_NOTES_POLICY_VERSION },
    { coachNotesEnabled: true }, { coachNotesEnabled: true, coachNotesPolicyVersion: 'approved-anything' }])
    assert.throws(() => noteGate(config), /COACH_NOTES_NOT_ACTIVE/u);
  assert.doesNotThrow(() => noteGate({ coachNotesEnabled: true, coachNotesPolicyVersion: COACH_NOTES_POLICY_VERSION }));
});
test('exact terms bind MM, both account IDs, observation-only purpose, version and finite expiry', () => {
  const g = grant(); assert.equal(g.terms.purpose, 'observation-only');
  for (const [key, value] of [['owner_id', g.terms.recipient_id], ['purpose', 'reports-read'], ['policy_version', 'other'],
    ['expires_at', g.terms.created_at], ['expires_at', new Date(at + MAX_NOTE_GRANT_MS + 1).toISOString()],
    ['mm', '../customer'], ['id', 'not-a-uuid'], ['expires_at', '2026-09-28'], ['next_opening_context', 'standing-instructions']])
    assert.throws(() => noteTerms({ ...g.terms, [key]: value }), /COACH_NOTE_/u);
});
test('active grant requires exact recipient/MM/owner/current version and unexpired authority', () => {
  const g = grant(), binding = { mm: g.terms.mm, owner_id: g.terms.owner_id, recipient_id: g.terms.recipient_id, version: 2, at };
  assert.equal(activeNoteGrant(g, binding), g);
  for (const changed of [{ mm: 'MM-OTHER' }, { owner_id: 'other' }, { recipient_id: 'other' }, { version: 1 }, { at: at + 86400000 }])
    assert.throws(() => activeNoteGrant(g, { ...binding, ...changed }), /COACH_NOTE_GRANT_UNAVAILABLE/u);
});
test('grant tamper cannot invent acceptance, rewrite terms or broaden authority', () => {
  for (const change of [g => { g.accepted.recipient_id = 'other'; }, g => { g.version = 3; },
    g => { g.terms.mm = 'MM-OTHER'; }, g => { g.reportsRead = true; }, g => { g.accepted.authority = true; }]) {
    const g = grant(); change(g); assert.throws(() => validateNoteGrant(g), /COACH_NOTE_/u);
  }
});
test('observation derives author from verified record and fixes unverified interpretation', () => {
  const n = observation(); assert.equal(n.author_id, 'fictional-observer'); assert.match(n.interpretation, /no BOS, APA, learning or plan/u);
  assert.equal(validateObservation(n), n);
  for (const change of [x => { x.text = 'Altered'; }, x => { x.author_id = 'other'; }, x => { x.apaApproved = true; },
    x => { x.interpretation = 'Fact'; }]) {
    const x = structuredClone(n); change(x); assert.throws(() => validateObservation(x), /COACH_NOTE_OBSERVATION_INVALID/u);
  }
  assert.throws(() => immutableObservation({ id: noteId, mm: 'MM-FICTIONAL', grant: grant(),
    author: { id: 'other', verified: true, displayName: 'Other' }, text: 'Text', at: new Date(at).toISOString(), reviewed: true }), /COACH_NOTE_OBSERVATION_INVALID/u);
});
test('observation text is bounded and no empty/whitespace-only payload is stored', () => {
  for (const text of ['', '   ', 'x'.repeat(10001), null]) assert.throws(() => immutableObservation({ id: noteId,
    mm: 'MM-FICTIONAL', grant: grant(), author: { id: 'fictional-observer', verified: true, displayName: 'Observer' },
    text, at: new Date(at).toISOString(), reviewed: true }), /COACH_NOTE_OBSERVATION_INVALID/u);
});
test('author-reviewed send and server-derived review metadata cannot be omitted or forged', () => {
  const g = grant(), input = { id: noteId, mm: g.terms.mm, grant: g,
    author: { id: g.terms.recipient_id, verified: true, displayName: 'Observer' }, text: 'Exact reviewed text', at: g.terms.created_at };
  for (const reviewed of [undefined, false, 'true']) assert.throws(() => immutableObservation({ ...input, reviewed }), /COACH_NOTE_OBSERVATION_INVALID/u);
  const n = immutableObservation({ ...input, reviewed: true });
  for (const change of [x => { x.reviewed_by = 'other'; }, x => { x.reviewed_at = '2026-09-28T18:00:00.000Z'; }, x => { x.reviewed = false; }]) {
    const x = structuredClone(n); change(x); const { content_sha256: _hash, ...body } = x; x.content_sha256 = digest(body);
    assert.throws(() => validateObservation(x), /COACH_NOTE_OBSERVATION_INVALID/u);
  }
});
test('strict command and session reject spoof fields and stale/unverified identities', () => {
  for (const field of ['actorId', 'author', 'authority', 'grant', 'speaker']) assert.throws(() => noteCommand({ text: 'x', [field]: true }, ['text']), /COACH_NOTE_COMMAND_INVALID/u);
  const a = { id: 'owner', verified: true, sessionVersion: 1 };
  for (const saved of [null, { ...a, verified: false }, { ...a, sessionVersion: 2 }, { ...a, id: 'other' }]) assert.throws(() => noteSession(a, saved), /SESSION_EXPIRED/u);
});
test('mailbox validates immutable note scope, hashes, distinct IDs and optional exact owner acknowledgment', () => {
  const g = grant(), n = observation(g), box = emptyNoteBox('MM-FICTIONAL', 'fictional-owner'); box.grants.push(g); box.notes.push(n);
  const body = { note_id: n.id, owner_id: box.owner_id, content_sha256: n.content_sha256, grant_version: 2,
    reviewed_at: n.created_at, reviewed: true }; box.reviews.push({ ...body, review_sha256: digest(body) });
  assert.equal(validateNoteBox(box, box.mm, box.owner_id), box);
  for (const change of [b => b.notes.push(n), b => { b.notes[0].text = 'Changed'; }, b => { b.owner_id = 'other'; },
    b => { b.reviews[0].owner_id = 'observer'; }, b => b.reviews.push(b.reviews[0])]) {
    const b = structuredClone(box); change(b); assert.throws(() => validateNoteBox(b, box.mm, box.owner_id), /COACH_NOTE_/u);
  }
});
test('provider projection and own receipts do not expose grant terms, account email or source authority', () => {
  const n = observation(), box = emptyNoteBox(n.mm, 'fictional-owner'); box.grants.push(grant()); box.notes.push(n);
  const input = coachObservationInput(n); assert.equal(input.coach_note_handoff, 'next_opening');
  assert.equal(input.grant, undefined); assert.equal(input.email, undefined);
  const receipt = ownNoteReceipts(box, n.author_id)[0]; assert.equal(receipt.text, undefined);
  assert.equal(receipt.author_name, undefined); assert.equal(receipt.review_status, 'reviewed-send');
  assert.equal(receipt.reviewed_by, n.author_id); assert.equal(receipt.owner_acknowledged, false);
  assert.deepEqual(ownNoteReceipts(box, 'other'), []);
});
function abandonmentBox() {
  const n = observation(), box = emptyNoteBox(n.mm, 'fictional-owner'); box.grants.push(grant()); box.notes.push(n);
  const reservation = { contract: 'athlete_coach_note_reservation_v1', mm: box.mm, owner_id: box.owner_id,
    attempt_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', note_ids: [n.id], notes_sha256: digest([n]),
    grant_versions: [{ grant_id: n.grant_id, version: n.grant_version }] };
  const body = { owner_id: box.owner_id, at: new Date(at + 1000).toISOString(),
    reason: 'participant_abandoned_before_dispatch', reservation_sha256: digest(reservation), no_provider_admission: true };
  box.attempts.push({ reservation, status: 'abandoned_before_dispatch', reserved_at: n.created_at,
    evidence_id: null, dispatched_at: null, completed_at: null,
    abandoned: { ...body, abandonment_sha256: digest(body) } });
  return box;
}
test('only audited pre-dispatch abandonment releases note claim; latest attempt drives metadata receipt', () => {
  const box = abandonmentBox(); assert.equal(validateNoteBox(box, box.mm, box.owner_id), box);
  assert.deepEqual([...claimedNoteIds(box)], []);
  assert.equal(ownNoteReceipts(box, box.notes[0].author_id)[0].status, 'abandoned_before_dispatch');
  const next = structuredClone(box.attempts[0]); next.reservation.attempt_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  next.status = 'reserved'; next.reserved_at = new Date(at + 2000).toISOString(); delete next.abandoned; box.attempts.push(next);
  assert.equal(validateNoteBox(box, box.mm, box.owner_id), box); assert.deepEqual([...claimedNoteIds(box)], [noteId]);
  const receipt = ownNoteReceipts(box, box.notes[0].author_id)[0]; assert.equal(receipt.status, 'reserved');
  assert.equal(receipt.attempt_id, next.reservation.attempt_id); assert.equal(receipt.text, undefined);
});
test('abandonment refuses unknown statuses, evidence, missing/forged audit and duplicate note IDs', () => {
  for (const change of [b => { b.attempts[0].status = 'uncertain'; }, b => { delete b.attempts[0].abandoned; },
    b => { b.attempts[0].evidence_id = id; }, b => { b.attempts[0].dispatched_at = new Date(at).toISOString(); },
    b => { b.attempts[0].abandoned.owner_id = 'other'; }, b => { b.attempts[0].abandoned.no_provider_admission = false; },
    b => { b.attempts[0].abandoned.reservation_sha256 = '0'.repeat(64); }, b => { b.attempts[0].reservation.note_ids.push(noteId); }]) {
    const box = abandonmentBox(); change(box); assert.throws(() => validateNoteBox(box, box.mm, box.owner_id), /COACH_NOTE_/u);
  }
});
test('abandoned audit rejects rehashed broadened authority, wrong time and resurrection before release', () => {
  for (const change of [audit => { audit.at = new Date(at - 1).toISOString(); }, audit => { audit.owner_id = 'other'; },
    audit => { audit.no_provider_admission = false; }, audit => { audit.reason = 'retry'; }, audit => { audit.authority = true; }]) {
    const box = abandonmentBox(), audit = box.attempts[0].abandoned; change(audit);
    const { abandonment_sha256: _hash, ...body } = audit; audit.abandonment_sha256 = digest(body);
    assert.throws(() => validateNoteBox(box, box.mm, box.owner_id), /COACH_NOTE_ABANDONMENT_INVALID/u);
  }
  const box = abandonmentBox(), next = structuredClone(box.attempts[0]); next.status = 'reserved'; delete next.abandoned;
  next.reservation.attempt_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; box.attempts.push(next);
  assert.throws(() => validateNoteBox(box, box.mm, box.owner_id), /COACH_NOTE_RESERVATION_INVALID/u);
});
