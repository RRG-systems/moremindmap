// Private, default-off note-only mechanism. No provider, email, runtime or auth role.
import { randomUUID } from 'node:crypto';
import { normalizeEmail, emailKey } from '../auth.js';
import { digest, requireValue } from '../repository.js';
import { COACH_NOTES_POLICY_VERSION, COACH_NOTES_OPENING_CONTEXT, MAX_COACH_NOTE_GRANTS, MAX_COACH_NOTES,
  MAX_PENDING_COACH_NOTES, NOTE_UUID, noteClone, noteSame, noteGate, noteIdentity, noteMm,
  noteCommand, noteSession, noteTerms, validateNoteGrant, activeNoteGrant, immutableObservation,
  emptyNoteBox, validateNoteBox, claimedNoteIds, coachObservationInput, ownNoteReceipts } from './coachNotesPolicy.js';

export function createCoachNotesService({ repo, academy, config, now = Date.now, makeId = randomUUID }) {
  requireValue(repo?.read && repo?.transact && academy?.mutate && academy?.participant, 'COACH_NOTES_STORAGE_REQUIRED');
  const boxKey = mm => `coach-notes:${noteMm(mm)}`;
  const indexKey = id => `coach-note-index:${noteIdentity(id)}`;
  const stamp = () => new Date(now()).toISOString();
  const operationKinds = ['invite', 'accept', 'revoke', 'append', 'review'].map(kind => `coach_notes_${kind}`);
  const operationReceipt = (a, b, kind) => ({ contract: 'athlete_coach_note_operation_v1', actor_id: a.id,
    mm: b.mm, request_id: b.requestId, signature_sha256: digest(b), kind: `coach_notes_${kind}` });
  const operationResult = (a, b, kind, result) => ({ ...result, operation_receipt: operationReceipt(a, b, kind) });
  function owner(snapshot, mm, a, participation = true) {
    requireValue(a?.id, 'SESSION_EXPIRED', 401);
    noteSession(a, snapshot[`account:${a.id}`]);
    const d = snapshot[`dossier:${mm}`];
    requireValue(d?.mm === mm && d.ownerId === a.id, 'NOT_FOUND', 404);
    if (participation) academy.participant(d, snapshot[`account:${a.id}`], 'coach');
    return d;
  }
  function mailbox(snapshot, mm, ownerId) {
    return noteClone(validateNoteBox(snapshot[boxKey(mm)] || emptyNoteBox(mm, ownerId), mm, ownerId));
  }
  function index(value) {
    const result = value || { contract: 'athlete_coach_note_index_v1', grants: [] };
    requireValue(result.contract === 'athlete_coach_note_index_v1' && Object.keys(result).length === 2
      && Array.isArray(result.grants) && result.grants.length <= 128
      && result.grants.every(g => Object.keys(g).length === 2 && NOTE_UUID.test(g.id || '') && noteMm(g.mm))
      && new Set(result.grants.map(g => g.id)).size === result.grants.length, 'COACH_NOTE_INDEX_INVALID');
    return result;
  }
  async function invite(a, b) {
    noteGate(config); noteCommand(b, ['requestId', 'mm', 'recipient_email', 'purpose', 'policy_version', 'next_opening_context', 'expires_at']);
    requireValue(b.next_opening_context === true, 'COACH_NOTE_INVITATION_REVIEW_REQUIRED');
    const mm = noteMm(b.mm), email = normalizeEmail(b.recipient_email), ek = emailKey(email), ref = await repo.read(ek);
    requireValue(ref?.id && ref.id !== a.id, 'COACH_NOTE_RECIPIENT_UNAVAILABLE', 404);
    const recipientId = noteIdentity(ref.id), id = makeId(), bk = boxKey(mm), ik = indexKey(recipientId);
    return academy.mutate(a, [bk, ik, ek, `dossier:${mm}`, `account:${recipientId}`], b, snapshot => {
      owner(snapshot, mm, a);
      const recipient = snapshot[`account:${recipientId}`];
      requireValue(snapshot[ek]?.id === recipientId && recipient?.id === recipientId && recipient.verified === true
        && recipient.email === email, 'COACH_NOTE_RECIPIENT_UNAVAILABLE', 404);
      const box = mailbox(snapshot, mm, a.id), ix = index(snapshot[ik]);
      requireValue(box.grants.length < MAX_COACH_NOTE_GRANTS && ix.grants.length < 128, 'COACH_NOTE_CAPACITY_REACHED', 409);
      requireValue(!box.grants.some(g => g.terms.recipient_id === recipientId && g.status !== 'revoked'
        && Date.parse(g.terms.expires_at) > now()), 'COACH_NOTE_INVITATION_EXISTS', 409);
      const terms = noteTerms({ id, mm, owner_id: a.id, recipient_id: recipientId, purpose: b.purpose,
        policy_version: b.policy_version, next_opening_context: COACH_NOTES_OPENING_CONTEXT,
        expires_at: b.expires_at, created_at: stamp() });
      const grant = { terms, terms_hash: digest(terms), version: 1, status: 'pending', accepted: null, revoked: null };
      box.grants.push(grant); box.revision++; ix.grants.push({ id, mm });
      return { writes: { [bk]: box, [ik]: ix }, result: operationResult(a, b, 'invite', { invitation: noteClone(grant) }) };
    });
  }
  async function accept(a, b) {
    noteGate(config); noteCommand(b, ['requestId', 'mm', 'grant_id', 'grant_version', 'terms_hash', 'policy_version', 'accepted']);
    const mm = noteMm(b.mm), bk = boxKey(mm), first = await repo.read(bk);
    requireValue(first?.owner_id, 'NOT_FOUND', 404);
    return academy.mutate(a, [bk, `dossier:${mm}`, `account:${first.owner_id}`], b, snapshot => {
      const ownerAccount = snapshot[`account:${first.owner_id}`];
      owner(snapshot, mm, ownerAccount);
      const box = mailbox(snapshot, mm, first.owner_id), grant = box.grants.find(g => g.terms.id === b.grant_id);
      requireValue(grant && grant.terms.recipient_id === a.id, 'NOT_FOUND', 404); validateNoteGrant(grant);
      requireValue(b.accepted === true && grant.status === 'pending' && grant.version === b.grant_version
        && grant.terms_hash === b.terms_hash && b.policy_version === COACH_NOTES_POLICY_VERSION
        && Date.parse(grant.terms.expires_at) > now(), 'COACH_NOTE_ACCEPTANCE_REQUIRED', 409);
      grant.status = 'active'; grant.version++;
      grant.accepted = { recipient_id: a.id, terms_hash: grant.terms_hash, at: stamp() }; box.revision++;
      return { writes: { [bk]: box }, result: operationResult(a, b, 'accept', { grant: noteClone(grant) }) };
    });
  }
  async function revoke(a, b) {
    noteGate(config); noteCommand(b, ['requestId', 'mm', 'grant_id', 'grant_version']);
    const mm = noteMm(b.mm), bk = boxKey(mm);
    return academy.mutate(a, [bk, `dossier:${mm}`], b, snapshot => {
      // Withdrawing participation or losing entitlement must not block revocation.
      owner(snapshot, mm, a, false); const box = mailbox(snapshot, mm, a.id), g = box.grants.find(x => x.terms.id === b.grant_id);
      requireValue(g && g.version === b.grant_version && g.status !== 'revoked', 'COACH_NOTE_GRANT_CHANGED', 409);
      g.status = 'revoked'; g.version++; g.revoked = { owner_id: a.id, at: stamp() }; box.revision++;
      return { writes: { [bk]: box }, result: operationResult(a, b, 'revoke', { revoked: true, grant_id: g.terms.id, grant_version: g.version }) };
    });
  }
  async function append(a, b) {
    noteGate(config); noteCommand(b, ['requestId', 'mm', 'grant_id', 'grant_version', 'text', 'reviewed']);
    requireValue(b.reviewed === true, 'COACH_NOTE_REVIEWED_SEND_REQUIRED');
    const mm = noteMm(b.mm), bk = boxKey(mm), first = await repo.read(bk), id = makeId();
    requireValue(first?.owner_id, 'NOT_FOUND', 404);
    return academy.mutate(a, [bk, `dossier:${mm}`, `account:${first.owner_id}`], b, snapshot => {
      const ownerAccount = snapshot[`account:${first.owner_id}`]; owner(snapshot, mm, ownerAccount);
      const box = mailbox(snapshot, mm, first.owner_id), grant = box.grants.find(g => g.terms.id === b.grant_id);
      activeNoteGrant(grant, { mm, owner_id: first.owner_id, recipient_id: a.id, version: b.grant_version, at: now() });
      const claimed = claimedNoteIds(box);
      requireValue(box.notes.length < MAX_COACH_NOTES && box.notes.filter(n => !claimed.has(n.id)).length < MAX_PENDING_COACH_NOTES, 'COACH_NOTE_CAPACITY_REACHED', 409);
      const observation = immutableObservation({ id, mm, grant, author: snapshot[`account:${a.id}`], text: b.text, at: stamp(), reviewed: b.reviewed });
      requireValue(!box.notes.some(n => n.id === id), 'COACH_NOTE_ID_CONFLICT', 409);
      box.notes.push(observation); box.revision++;
      return { writes: { [bk]: box }, result: operationResult(a, b, 'append', { receipt: ownNoteReceipts(box, a.id).find(n => n.id === id) }) };
    });
  }
  async function review(a, b) {
    noteGate(config); noteCommand(b, ['requestId', 'mm', 'note_id', 'content_sha256', 'grant_version']);
    const mm = noteMm(b.mm), bk = boxKey(mm), first = await repo.read(bk);
    const priorNote = first?.notes?.find(n => n.id === b.note_id);
    requireValue(priorNote, 'NOT_FOUND', 404);
    return academy.mutate(a, [bk, `dossier:${mm}`, `account:${priorNote.author_id}`], b, snapshot => {
      owner(snapshot, mm, a); const box = mailbox(snapshot, mm, a.id), note = box.notes.find(n => n.id === b.note_id);
      requireValue(note && note.content_sha256 === b.content_sha256 && note.grant_version === b.grant_version, 'COACH_NOTE_REVIEW_CHANGED', 409);
      eligible(box, note, snapshot);
      const prior = box.reviews.find(r => r.note_id === note.id);
      if (prior) return { writes: {}, result: operationResult(a, b, 'review', { review: noteClone(prior) }) };
      const body = { note_id: note.id, owner_id: a.id, content_sha256: note.content_sha256,
        grant_version: note.grant_version, reviewed_at: stamp(), reviewed: true };
      const receipt = { ...body, review_sha256: digest(body) };
      box.reviews.push(receipt); box.revision++;
      return { writes: { [bk]: box }, result: operationResult(a, b, 'review', { review: noteClone(receipt) }) };
    });
  }
  async function assigned(a, { invitations = false } = {}) {
    noteGate(config); const ik = indexKey(a.id), ix = index(await repo.read(ik));
    const mms = [...new Set(ix.grants.map(g => g.mm))];
    requireValue(mms.length <= 32, 'COACH_NOTE_CAPACITY_REACHED', 409);
    // Index membership is never authority; every row is rechecked atomically.
    const firstBoxes = await Promise.all(mms.map(mm => repo.read(boxKey(mm))));
    const owners = [...new Set(firstBoxes.filter(Boolean).map(b => b.owner_id))];
    const keys = [...new Set([ik, `account:${a.id}`, ...mms.flatMap(mm => [boxKey(mm), `dossier:${mm}`]), ...owners.map(id => `account:${id}`)])];
    requireValue(keys.length <= 100, 'COACH_NOTE_CAPACITY_REACHED', 409);
    return repo.transact(keys, snapshot => {
      noteSession(a, snapshot[`account:${a.id}`]); requireValue(noteSame(index(snapshot[ik]), ix), 'COACH_NOTE_INDEX_CHANGED', 409);
      const rows = [], receipts = [];
      for (const mm of mms) {
        const raw = snapshot[boxKey(mm)]; if (!raw) continue;
        const box = mailbox(snapshot, mm, raw.owner_id);
        requireValue(Object.hasOwn(snapshot, `account:${box.owner_id}`), 'COACH_NOTE_SNAPSHOT_INCOMPLETE', 409);
        // Own metadata remains readable after revocation; it never reveals source text.
        receipts.push(...ownNoteReceipts(box, a.id));
        const oa = snapshot[`account:${box.owner_id}`];
        try { owner(snapshot, mm, oa); } catch { continue; }
        for (const g of box.grants) if (g.terms.recipient_id === a.id && ix.grants.some(r => r.id === g.terms.id && r.mm === mm)
          && g.status === (invitations ? 'pending' : 'active') && Date.parse(g.terms.expires_at) > now()) {
          rows.push({ mm, athlete_name: snapshot[`dossier:${mm}`].person.name, grant_id: g.terms.id,
            grant_version: g.version, purpose: g.terms.purpose, policy_version: g.terms.policy_version,
            next_opening_context: g.terms.next_opening_context, expires_at: g.terms.expires_at, terms_hash: g.terms_hash });
        }
      }
      return { writes: {}, result: { rows, receipts } };
    });
  }
  const roster = async (a, b = {}) => { noteCommand(b, []); return { assigned: (await assigned(a)).rows }; };
  const invitations = async (a, b = {}) => { noteCommand(b, []); return { invitations: (await assigned(a, { invitations: true })).rows }; };
  const receipts = async (a, b = {}) => { noteCommand(b, []); return { receipts: (await assigned(a)).receipts }; };
  async function ownerNotes(a, b) {
    noteGate(config); noteCommand(b, ['mm']); const mm = noteMm(b.mm), bk = boxKey(mm);
    return repo.transact([bk, `dossier:${mm}`, `account:${a.id}`], snapshot => {
      owner(snapshot, mm, a); const box = mailbox(snapshot, mm, a.id);
      return { writes: {}, result: { notes: noteClone(box.notes), grants: noteClone(box.grants), reviews: noteClone(box.reviews),
        delivery: box.notes.flatMap(n => ownNoteReceipts(box, n.author_id).filter(r => r.id === n.id)) } };
    });
  }
  async function outcome(a, b) {
    noteGate(config); noteCommand(b, ['mm', 'request_id', 'signature_sha256', 'kind']);
    const mm = noteMm(b.mm);
    requireValue(typeof b.request_id === 'string' && NOTE_UUID.test(b.request_id)
      && typeof b.signature_sha256 === 'string' && /^[a-f0-9]{64}$/u.test(b.signature_sha256)
      && operationKinds.includes(b.kind), 'COACH_NOTE_COMMAND_INVALID');
    const ak = `account:${noteIdentity(a?.id)}`, ok = `operation:${a.id}:${b.request_id}`;
    return repo.transact([ak, ok], snapshot => {
      noteSession(a, snapshot[ak]);
      const expected = { contract: 'athlete_coach_note_operation_v1', actor_id: a.id, mm,
        request_id: b.request_id, signature_sha256: b.signature_sha256, kind: b.kind };
      const saved = snapshot[ok];
      if (saved) requireValue(saved.signature === b.signature_sha256
        && saved.result?.operation_receipt && noteSame(saved.result.operation_receipt, expected),
      'COACH_NOTE_OUTCOME_MISMATCH', 409);
      return { writes: {}, result: { noteOutcome: { ...expected, contract: 'athlete_coach_note_outcome_v1',
        status: saved ? 'acknowledged' : 'unresolved' } } };
    });
  }
  async function replayKeys({ mm, ownerId }) {
    noteGate(config); const box = validateNoteBox(await repo.read(boxKey(mm)) || emptyNoteBox(mm, ownerId), mm, ownerId);
    return [...new Set([boxKey(mm), `coach:${mm}`, `dossier:${mm}`, `account:${ownerId}`,
      ...box.grants.map(g => `account:${g.terms.recipient_id}`)])];
  }
  function replayBox(input) {
    noteGate(config); const { snapshot, mm, ownerAccount } = input; owner(snapshot, mm, ownerAccount);
    requireValue(Object.hasOwn(snapshot, boxKey(mm)), 'COACH_NOTE_SNAPSHOT_INCOMPLETE', 409);
    const box = mailbox(snapshot, mm, ownerAccount.id);
    for (const g of box.grants) requireValue(Object.hasOwn(snapshot, `account:${g.terms.recipient_id}`), 'COACH_NOTE_SNAPSHOT_INCOMPLETE', 409);
    return box;
  }
  function eligible(box, note, snapshot) {
    const grant = box.grants.find(g => g.terms.id === note.grant_id), recipient = snapshot[`account:${note.author_id}`];
    requireValue(recipient?.id === note.author_id && recipient.verified === true, 'COACH_NOTE_RECIPIENT_UNAVAILABLE', 403);
    activeNoteGrant(grant, { mm: box.mm, owner_id: box.owner_id, recipient_id: note.author_id, version: note.grant_version, at: now() });
    return note;
  }
  function reserveOpening(input) {
    const box = replayBox(input); requireValue(NOTE_UUID.test(input.attemptId || ''), 'COACH_NOTE_ATTEMPT_INVALID');
    requireValue(!box.attempts.some(a => a.reservation.attempt_id === input.attemptId), 'COACH_NOTE_ATTEMPT_ALREADY_RESERVED', 409);
    const claimed = claimedNoteIds(box);
    const selected = box.notes.filter(n => !claimed.has(n.id)).filter(n => {
      try { eligible(box, n, input.snapshot); return true; } catch (error) {
        if (['COACH_NOTE_GRANT_UNAVAILABLE', 'COACH_NOTE_RECIPIENT_UNAVAILABLE'].includes(error.code)) return false;
        throw error;
      }
    });
    if (!selected.length) return { writes: {}, reservation: null };
    requireValue(selected.length <= MAX_PENDING_COACH_NOTES && box.attempts.length < MAX_COACH_NOTES, 'COACH_NOTE_CAPACITY_REACHED', 409);
    const reservation = { contract: 'athlete_coach_note_reservation_v1', mm: box.mm, owner_id: box.owner_id,
      attempt_id: input.attemptId, note_ids: selected.map(n => n.id), notes_sha256: digest(selected),
      grant_versions: [...new Map(selected.map(n => [n.grant_id, { grant_id: n.grant_id, version: n.grant_version }])).values()] };
    box.attempts.push({ reservation, status: 'reserved', reserved_at: stamp(), evidence_id: null, dispatched_at: null, completed_at: null }); box.revision++;
    return { writes: { [boxKey(box.mm)]: box }, reservation: noteClone(reservation) };
  }
  function reserved(input, statuses) {
    const box = replayBox(input), r = input.reservation;
    requireValue(r && r.mm === input.mm && r.owner_id === input.ownerAccount.id, 'COACH_NOTE_RESERVATION_INVALID');
    const attempt = box.attempts.find(a => a.reservation.attempt_id === r.attempt_id);
    requireValue(attempt && noteSame(attempt.reservation, r) && statuses.includes(attempt.status), 'COACH_NOTE_ATTEMPT_CHANGED', 409);
    const selected = r.note_ids.map(id => box.notes.find(n => n.id === id));
    selected.forEach(n => eligible(box, n, input.snapshot));
    requireValue(digest(selected) === r.notes_sha256, 'COACH_NOTE_RESERVATION_INVALID');
    return { box, attempt, selected };
  }
  function preflightOpening(input) {
    const { selected } = reserved(input, ['reserved']); return { writes: {}, observations: selected.map(coachObservationInput) };
  }
  function openingObservations(input) {
    // Pure exact projection for a saved-request comparison during recovery.
    // This is not dispatch admission and cannot renew note eligibility.
    const { selected } = reserved(input, ['reserved', 'dispatched', 'delivered']);
    return { writes: {}, observations: selected.map(coachObservationInput) };
  }
  function dispatchedOpening(input) {
    const { box, attempt } = reserved(input, ['reserved']); requireValue(NOTE_UUID.test(input.evidenceId || ''), 'COACH_NOTE_EVIDENCE_INVALID');
    attempt.status = 'dispatched'; attempt.evidence_id = input.evidenceId; attempt.dispatched_at = stamp(); box.revision++;
    return { writes: { [boxKey(box.mm)]: box }, receipt: { attempt_id: attempt.reservation.attempt_id, note_ids: [...attempt.reservation.note_ids], status: attempt.status, evidence_id: input.evidenceId } };
  }
  function abandonOpening(input) {
    const { box, attempt } = reserved(input, ['reserved']);
    requireValue(input.evidenceId === null && attempt.evidence_id === null
      && attempt.dispatched_at === null && attempt.completed_at === null,
    'COACH_NOTE_ATTEMPT_CHANGED', 409);
    const body = { owner_id: input.ownerAccount.id, at: stamp(),
      reason: 'participant_abandoned_before_dispatch',
      reservation_sha256: digest(attempt.reservation), no_provider_admission: true };
    attempt.status = 'abandoned_before_dispatch';
    attempt.abandoned = { ...body, abandonment_sha256: digest(body) }; box.revision++;
    return { writes: { [boxKey(box.mm)]: box }, receipt: { attempt_id: attempt.reservation.attempt_id,
      note_ids: [...attempt.reservation.note_ids], status: attempt.status, evidence_id: null } };
  }
  function completeOpening(input) {
    const { box, attempt } = reserved(input, ['dispatched', 'delivered']);
    requireValue(input.evidenceId === attempt.evidence_id, 'COACH_NOTE_EVIDENCE_INVALID');
    const receipt = { attempt_id: attempt.reservation.attempt_id, note_ids: [...attempt.reservation.note_ids], status: 'delivered', evidence_id: input.evidenceId };
    if (attempt.status === 'delivered') return { writes: {}, receipt };
    attempt.status = 'delivered'; attempt.completed_at = stamp(); box.revision++;
    return { writes: { [boxKey(box.mm)]: box }, receipt };
  }
  return Object.freeze({ invite, accept, revoke, append, review, roster, invitations, receipts, ownerNotes, outcome,
    replayKeys, reserveOpening, preflightOpening, openingObservations, dispatchedOpening, abandonOpening, completeOpening,
    recoverOpening: completeOpening });
}
