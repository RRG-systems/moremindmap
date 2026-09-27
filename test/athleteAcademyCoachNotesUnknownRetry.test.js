// Fictional CAS/handler/journal integration only. No sockets, external accounts or providers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRedisRepository, CAS_LUA, digest } from '../server/athleteAcademyV1/repository.js';
import { createAcademyService } from '../server/athleteAcademyV1/service.js';
import { createAcademyHandler } from '../server/athleteAcademyV1/handler.js';
import { createCoachNotesService } from '../server/athleteAcademyV1/coaching/coachNotes.js';
import { COACH_NOTES_POLICY_VERSION, COACH_NOTES_PURPOSE } from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
import { coachNoteOperation, coachNoteFailureMayClearJournal,
  coachNoteOperationAcknowledged, coachNoteOutcomeAcknowledged } from '../src/athleteAcademyV1/coach/coachNotesActions.js';
import { readPending, savePending, clearPending } from '../src/athleteAcademyV1/coach/coachNotesJournal.js';

const clone = value => structuredClone(value);
const uuid = value => `${value.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`;
const AT = Date.parse('2026-09-27T18:00:00.000Z');
const ORIGIN = 'https://fictional-note-review.test.invalid';
const NOTE_TEXT = 'Private fictional reviewed observation: one calmer passing cue, not an APA or plan change.';
class MemoryStorage {
  values = new Map(); locks = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
  async withLock(name, run) {
    const before = this.locks.get(name) || Promise.resolve(); let release;
    const barrier = new Promise(resolve => { release = resolve; }); this.locks.set(name, barrier);
    await before; try { return run(); } finally { release(); }
  }
}
function bodyFor(operation) {
  const { action, requestId, ...command } = operation;
  // Exactly the normal transport/handler serialization, including insertion order.
  return { action, requestId, ...command };
}
function failure(result) {
  return Object.assign(new Error(result.body.error.code), { code: result.body.error.code, status: result.status });
}
async function fixture() {
  const values = new Map(), transactions = [];
  let sequence = 0, ackLoss = null, beforeCommitLoss = null, revokeOnRequest = false;
  const redis = {
    async get(key) { return values.get(key) ?? null; },
    async eval(script, count, ...args) {
      assert.equal(script, CAS_LUA);
      const keys = args.slice(0, count), prior = args.slice(count, count * 2), next = args.slice(count * 2);
      assert.equal(next.length, count);
      if (keys.some((key, index) => (values.get(key) ?? '') !== prior[index])) return 0;
      const relevant = id => id && keys.some((key, index) => key.endsWith(`:${id}`)
        && next[index] && JSON.parse(next[index]).result?.operation_receipt?.kind === 'coach_notes_append');
      if (relevant(beforeCommitLoss)) { beforeCommitLoss = null; throw new Error('OFFLINE_BEFORE_COMMIT_ACK_UNKNOWN'); }
      keys.forEach((key, index) => { if (next[index] !== '') values.set(key, next[index]); });
      transactions.push({ keys: [...keys], writes: keys.filter((_key, index) => next[index] !== '') });
      if (relevant(ackLoss)) { ackLoss = null; throw new Error('OFFLINE_COMMITTED_APPEND_ACK_LOST'); }
      return 1;
    },
  };
  const repo = createRedisRepository({ redis, prefix: 'more:athlete-academy:{test-note-unknown-retry}' });
  const config = { enabled: true, origin: ORIGIN, allowedOrigins: new Set([ORIGIN]), allowInsecureLocalhost: false,
    coachNotesEnabled: true, coachNotesPolicyVersion: COACH_NOTES_POLICY_VERSION,
    syntheticPreview: true, reviewedPolicyVersion: 'offline-note-unknown-review-v1', realYouthEnabled: false,
    providerEnabled: false, mailEnabled: false, cohort: { minimumAge: 18 } };
  const owner = { id: 'fictional-retry-owner', mm: 'MM-FICTIONAL-RETRY-OWNER', email: 'owner@test.invalid',
    displayName: 'Fictional Athlete', verified: true, sessionVersion: 1, role: 'participant' };
  const recipient = { id: 'fictional-retry-observer', mm: 'MM-FICTIONAL-RETRY-OBSERVER', email: 'observer@test.invalid',
    displayName: 'Fictional Observer', verified: true, sessionVersion: 1, role: 'participant' };
  const other = { id: 'fictional-retry-other', mm: 'MM-FICTIONAL-RETRY-OTHER', email: 'other@test.invalid',
    displayName: 'Other Fictional', verified: true, sessionVersion: 1, role: 'participant' };
  const dossier = { mm: owner.mm, ownerId: owner.id, archived: false, revision: 0, synthetic: true,
    person: { name: owner.displayName, dateOfBirth: '2000-01-01' }, entitlements: { coach: true },
    participation: { athleteAccepted: true, status: 'self_authorized', policyVersion: config.reviewedPolicyVersion },
    reports: { bos: { immutable: true }, apa: { immutable: true } }, jobs: [], events: [] };
  const coach = { mm: owner.mm, currentApa: { original: true }, plan: { separatelyAccepted: true },
    learning: [{ athleteApproved: true }], messages: [] };
  const docs = { [`account:${owner.id}`]: owner, [`account:${recipient.id}`]: recipient,
    [`account:${other.id}`]: other, [`email:${digest(recipient.email)}`]: { id: recipient.id },
    [`dossier:${owner.mm}`]: dossier, [`coach:${owner.mm}`]: coach };
  await repo.transact(Object.keys(docs), () => ({ writes: docs, result: true }));
  const sessions = new Map();
  const putSession = (token, account, version = account.sessionVersion) => {
    sessions.set(token, { accountId: account.id, version, csrf: `fictional-form-${token}` }); return token;
  };
  const ownerSession = putSession('fictional-owner-session', owner);
  let recipientSession = putSession('fictional-recipient-session-1', recipient);
  const otherSession = putSession('fictional-other-session', other);
  const auth = {
    async session(token) {
      const descriptor = sessions.get(token); if (!descriptor) return null;
      const account = await repo.read(`account:${descriptor.accountId}`);
      if (!account || account.sessionVersion !== descriptor.version) return null;
      return { csrf: descriptor.csrf, account };
    },
    async limited(key) {
      if (!revokeOnRequest || !key.startsWith('request:')) return;
      revokeOnRequest = false;
      await repo.transact([`account:${recipient.id}`], snapshot => {
        const next = clone(snapshot[`account:${recipient.id}`]); next.sessionVersion++;
        return { writes: { [`account:${recipient.id}`]: next }, result: true };
      });
    },
    event: (type, actor) => ({ type, actor, at: new Date(AT).toISOString() }),
  };
  const academy = createAcademyService({ repo, config, auth, now: () => AT,
    transport: async () => { throw new Error('OFFLINE_UNEXPECTED_PROVIDER'); } });
  const notes = createCoachNotesService({ repo, config, academy, now: () => AT,
    makeId: () => uuid(++sequence) });
  const requests = [];
  const forbidden = async () => { throw new Error('OFFLINE_UNEXPECTED_COACH_ACCESS'); };
  const handler = createAcademyHandler({ config, auth, academy, notes,
    coaching: { bundle: forbidden, state: forbidden, action: forbidden },
    deliver: async () => { throw new Error('OFFLINE_UNEXPECTED_MAIL'); } });
  async function request(operation, { session = recipientSession, headers = {} } = {}) {
    const body = bodyFor(operation), out = { status: 200, headers: {} };
    requests.push({ body: clone(body), session, headers: clone(headers) });
    const res = { setHeader(key, value) { out.headers[key] = value; },
      status(code) { out.status = code; return this; }, json(value) { out.body = clone(value); return out; } };
    await handler({ method: 'POST', body, headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin',
      'content-type': 'application/json', cookie: `more_athlete_academy=${session}`,
      'x-csrf-token': sessions.get(session)?.csrf, ...headers }, socket: { remoteAddress: 'fictional-offline' } }, res);
    return out;
  }
  const invitation = await request({ action: 'coach_notes_invite', requestId: uuid(100), mm: owner.mm,
    recipient_email: recipient.email, purpose: COACH_NOTES_PURPOSE, policy_version: COACH_NOTES_POLICY_VERSION,
    next_opening_context: true, expires_at: new Date(AT + 86400000).toISOString() }, { session: ownerSession });
  assert.equal(invitation.status, 200);
  const grant = invitation.body.invitation;
  const accepted = await request({ action: 'coach_notes_accept', requestId: uuid(101), mm: owner.mm,
    grant_id: grant.terms.id, grant_version: grant.version, terms_hash: grant.terms_hash,
    policy_version: COACH_NOTES_POLICY_VERSION, accepted: true });
  assert.equal(accepted.status, 200);
  const appendBody = { action: 'coach_notes_append', mm: owner.mm, grant_id: grant.terms.id,
    grant_version: accepted.body.grant.version, text: NOTE_TEXT, reviewed: true };
  const scope = { actorId: recipient.id, mode: 'recipient', mm: null };
  const box = () => repo.read(`coach-notes:${owner.mm}`);
  const ledger = id => repo.read(`operation:${recipient.id}:${id}`);
  const protectedUnchanged = async () => {
    assert.deepEqual(await repo.read(`dossier:${owner.mm}`), dossier);
    assert.deepEqual(await repo.read(`coach:${owner.mm}`), coach);
  };
  return { repo, values, transactions, owner, recipient, other, otherSession, scope, request, requests,
    appendBody, box, ledger, protectedUnchanged,
    loseCommittedAck: id => { ackLoss = id; }, loseBeforeCommitAck: id => { beforeCommitLoss = id; },
    revokeAfterAuthentication: () => { revokeOnRequest = true; },
    async refreshRecipientSession() {
      const account = await repo.read(`account:${recipient.id}`);
      recipientSession = putSession(`fictional-recipient-session-${account.sessionVersion}`, account);
    } };
}

// Uses the actual journal and UI helpers, with the Panel's explicit/manual
// control sequence. Reload never reconstructs an operation from metadata.
function client(f, storage = new MemoryStorage()) {
  let pending = null, unknown = false, sequence = 200;
  const restored = readPending(storage, f.scope);
  if (restored) { pending = { metadata: restored }; unknown = true; }
  async function perform(body, requestOptions = {}) {
    if (pending && !pending.operation) throw new Error('Check the saved action acknowledgment before making another change.');
    const priorUncertainty = Boolean(pending);
    const selected = coachNoteOperation(body, pending, uuid(++sequence));
    try {
      const metadata = await savePending(storage, f.scope, selected.operation);
      pending = { ...selected, metadata }; unknown = true;
      const result = await f.request(selected.operation, requestOptions);
      if (result.status !== 200 || !result.body.ok) throw failure(result);
      coachNoteOperationAcknowledged(result.body.operation_receipt, metadata, f.recipient.id);
      await clearPending(storage, f.scope, metadata.request_id); pending = null; unknown = false;
      return result;
    } catch (error) {
      if (coachNoteFailureMayClearJournal(error, priorUncertainty) && pending?.metadata) {
        await clearPending(storage, f.scope, pending.metadata.request_id); pending = null; unknown = false;
      } else {
        const metadata = readPending(storage, f.scope);
        if (metadata && !pending?.operation) pending = { metadata };
        unknown = Boolean(metadata);
      }
      throw error;
    }
  }
  async function checkOutcome(requestOptions = {}, changes = {}) {
    const metadata = pending?.metadata; assert.ok(metadata);
    const result = await f.request({ action: 'coach_notes_outcome', requestId: uuid(++sequence),
      mm: metadata.target_mm, request_id: metadata.request_id, signature_sha256: metadata.signature_sha256,
      kind: metadata.kind, ...changes }, requestOptions);
    if (result.status !== 200 || !result.body.ok) throw failure(result);
    if (coachNoteOutcomeAcknowledged(result.body.noteOutcome, metadata, f.recipient.id)) {
      await clearPending(storage, f.scope, metadata.request_id); pending = null; unknown = false;
    }
    return result;
  }
  return { storage, perform, checkOutcome, pending: () => clone(pending), unknown: () => unknown };
}

test('committed append with lost ACK stays held across same-request CSRF/session/origin rejection, reload and exact outcome', async t => {
  for (const gate of ['CSRF', 'session race', 'origin']) await t.test(gate, async () => {
    const f = await fixture(), ui = client(f), requestId = uuid(201);
    f.loseCommittedAck(requestId);
    await assert.rejects(ui.perform(f.appendBody), /STORAGE_OUTCOME_UNKNOWN/u);
    const pending = ui.pending(), journal = clone([...ui.storage.values]), committed = await f.box(), operation = await f.ledger(requestId);
    assert.equal(committed.notes.length, 1); assert.equal(committed.notes[0].text, NOTE_TEXT);
    assert.equal(committed.notes[0].reviewed_by, f.recipient.id);
    assert.equal(operation.result.operation_receipt.request_id, requestId);
    assert.equal(operation.signature, pending.metadata.signature_sha256);
    assert.equal(ui.unknown(), true); assert.equal(pending.operation.requestId, requestId);
    const options = gate === 'CSRF' ? { headers: { 'x-csrf-token': 'fictional-expired-form' } }
      : gate === 'origin' ? { headers: { origin: 'https://fictional-other-origin.test.invalid' } } : {};
    if (gate === 'session race') f.revokeAfterAuthentication();
    const expected = gate === 'CSRF' ? 'SESSION_OR_FORM_EXPIRED' : gate === 'origin' ? 'SAME_ORIGIN_REQUIRED' : 'SESSION_EXPIRED';
    await assert.rejects(ui.perform(f.appendBody, options), error => error.code === expected);
    assert.deepEqual(ui.pending(), pending); assert.equal(ui.unknown(), true);
    assert.deepEqual([...ui.storage.values], journal); assert.deepEqual(await f.box(), committed);
    assert.deepEqual(await f.ledger(requestId), operation);
    assert.equal(f.requests.at(-1).body.requestId, requestId);
    assert.equal(f.transactions.filter(tx => tx.writes.some(key => key.endsWith(`:operation:${f.recipient.id}:${requestId}`))).length, 1);
    if (gate === 'session race') await f.refreshRecipientSession();
    const reloaded = client(f, ui.storage), metadata = reloaded.pending().metadata;
    assert.equal(reloaded.unknown(), true); assert.deepEqual(metadata, pending.metadata);
    assert.equal(reloaded.pending().operation, undefined); assert.equal(reloaded.pending().signature, undefined);
    for (const raw of reloaded.storage.values.values()) {
      assert.equal(raw.includes(NOTE_TEXT), false); assert.equal(raw.includes(f.appendBody.grant_id), false);
      assert.equal(raw.includes('observer@test.invalid'), false); assert.equal(raw.includes('operation'), false);
    }
    const view = await f.request({ action: 'coach_notes_view', requestId: uuid(300), mode: 'recipient' });
    assert.equal(view.status, 200); assert.equal(view.body.coachNotes.receipts.length, 1);
    assert.equal(JSON.stringify(view.body).includes(NOTE_TEXT), false);
    assert.deepEqual([...ui.storage.values], journal); assert.equal(reloaded.unknown(), true);
    const requestCount = f.requests.length;
    await assert.rejects(reloaded.perform({ ...f.appendBody, text: 'Replacement must remain blocked.' }), /Check the saved action acknowledgment/u);
    await assert.rejects(savePending(ui.storage, f.scope, { ...f.appendBody, requestId: uuid(301) }), /COACH_NOTE_PENDING_EXISTS/u);
    assert.equal(f.requests.length, requestCount); assert.deepEqual(await f.box(), committed);
    await assert.rejects(reloaded.checkOutcome({}, { signature_sha256: 'a'.repeat(64) }), /COACH_NOTE_OUTCOME_MISMATCH/u);
    await assert.rejects(reloaded.checkOutcome({ session: f.otherSession }), /could not be verified/u);
    await assert.rejects(clearPending(ui.storage, f.scope, uuid(302)), /COACH_NOTE_JOURNAL_REQUEST_MISMATCH/u);
    assert.equal(reloaded.unknown(), true); assert.deepEqual([...ui.storage.values], journal);
    const beforeOutcome = clone([...f.values]), checked = await reloaded.checkOutcome();
    assert.equal(checked.status, 200); assert.equal(checked.body.noteOutcome.status, 'acknowledged');
    assert.equal(checked.body.noteOutcome.actor_id, f.recipient.id);
    assert.equal(checked.body.noteOutcome.request_id, requestId);
    assert.equal(checked.body.noteOutcome.signature_sha256, metadata.signature_sha256);
    assert.equal(checked.body.noteOutcome.kind, 'coach_notes_append');
    assert.equal(JSON.stringify(checked.body).includes(NOTE_TEXT), false);
    assert.deepEqual([...f.values], beforeOutcome); assert.equal(reloaded.unknown(), false);
    assert.equal(reloaded.pending(), null); assert.equal(readPending(ui.storage, f.scope), null);
    const replay = await f.request(pending.operation);
    assert.equal(replay.status, 200); assert.deepEqual(replay.body.operation_receipt, operation.result.operation_receipt);
    assert.deepEqual(await f.box(), committed); assert.deepEqual(await f.ledger(requestId), operation);
    assert.equal((await f.box()).notes.length, 1); await f.protectedUnchanged();
  });
});

test('initial nonambiguous handler gate rejection can clear its journal only with explicit false prior uncertainty', async () => {
  const f = await fixture(), ui = client(f);
  await assert.rejects(ui.perform(f.appendBody, { headers: { 'x-csrf-token': 'fictional-expired-first-form' } }), /SESSION_OR_FORM_EXPIRED/u);
  assert.equal(ui.pending(), null); assert.equal(ui.unknown(), false); assert.equal(readPending(ui.storage, f.scope), null);
  assert.equal((await f.box()).notes.length, 0); assert.equal(await f.ledger(uuid(201)), null);
  const saved = await ui.perform(f.appendBody);
  assert.equal(saved.status, 200); assert.equal(saved.body.operation_receipt.request_id, uuid(202));
  assert.equal((await f.box()).notes.length, 1); assert.equal(readPending(ui.storage, f.scope), null);
  await f.protectedUnchanged();
});

test('unresolved authenticated outcome cannot clear an ambiguous uncommitted append or allow a replacement', async () => {
  const f = await fixture(), ui = client(f); f.loseBeforeCommitAck(uuid(201));
  await assert.rejects(ui.perform(f.appendBody), /STORAGE_OUTCOME_UNKNOWN/u);
  assert.equal(await f.ledger(uuid(201)), null); assert.equal((await f.box()).notes.length, 0);
  const journal = clone([...ui.storage.values]), reloaded = client(f, ui.storage), before = clone([...f.values]);
  const result = await reloaded.checkOutcome();
  assert.equal(result.body.noteOutcome.status, 'unresolved'); assert.equal(reloaded.unknown(), true);
  assert.ok(reloaded.pending().metadata); assert.deepEqual([...ui.storage.values], journal);
  assert.deepEqual([...f.values], before);
  const count = f.requests.length;
  await assert.rejects(reloaded.perform(f.appendBody), /Check the saved action acknowledgment/u);
  await assert.rejects(savePending(ui.storage, f.scope, { ...f.appendBody, requestId: uuid(303) }), /COACH_NOTE_PENDING_EXISTS/u);
  assert.equal(f.requests.length, count); assert.equal((await f.box()).notes.length, 0);
  await f.protectedUnchanged();
});

test('journal-clear helper fails closed for omitted or nonboolean prior flags and unknown failures', () => {
  for (const code of ['SESSION_OR_FORM_EXPIRED', 'SESSION_EXPIRED', 'SIGN_IN_REQUIRED', 'SAME_ORIGIN_REQUIRED',
    'COACH_NOTE_COMMAND_INVALID', 'COACH_NOTES_NOT_ACTIVE', 'COACH_NOTE_REVIEWED_SEND_REQUIRED']) {
    assert.equal(coachNoteFailureMayClearJournal({ code }, false), true);
    assert.equal(coachNoteFailureMayClearJournal({ code }), false);
    for (const prior of [true, undefined, null, 0, '', 'false', {}, []])
      assert.equal(coachNoteFailureMayClearJournal({ code }, prior), false);
  }
  for (const error of [undefined, null, new Error('Lost response'), { code: 'STORAGE_OUTCOME_UNKNOWN' },
    { code: 'SERVICE_UNAVAILABLE' }, { code: 'COACH_NOTE_OUTCOME_MISMATCH' }, { status: 503 }])
    assert.equal(coachNoteFailureMayClearJournal(error, false), false);
});

test('Panel captures uncertainty before installing the new pending request and passes it to the actual helper', () => {
  const source = readFileSync(new URL('../src/athleteAcademyV1/coach/CoachNotesPanel.jsx', import.meta.url), 'utf8');
  const perform = source.slice(source.indexOf('async function perform'), source.indexOf('async function checkOutcome'));
  const capture = perform.indexOf('const priorUncertainty=Boolean(pending.current);');
  assert.ok(capture >= 0 && capture < perform.indexOf('coachNoteOperation(body,pending.current,'));
  assert.ok(capture < perform.indexOf('await savePending('));
  assert.match(perform, /coachNoteFailureMayClearJournal\(e,priorUncertainty\)&&pending\.current\?\.metadata/u);
  assert.doesNotMatch(perform, /coachNoteFailureKnownNoWrite\(e\)/u);
});
