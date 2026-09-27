// Proposed private release-review policy. This is not an activated grant.
import { digest, requireValue } from '../repository.js';

export const COACH_NOTES_POLICY_VERSION = 'athlete-observation-notes-private-review-v1';
export const COACH_NOTES_PURPOSE = 'observation-only';
export const COACH_NOTES_OPENING_CONTEXT = 'attributed-unverified-next-opening-only';
export const MAX_COACH_NOTE_GRANTS = 16;
export const MAX_COACH_NOTES = 256;
export const MAX_PENDING_COACH_NOTES = 32;
export const MAX_COACH_NOTE_TEXT = 10000;
export const MAX_NOTE_GRANT_MS = 30 * 86400000;
export const NOTE_UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const ID = /^[A-Za-z0-9_-]{1,120}$/u;
const MM = /^[A-Za-z0-9_-]{1,120}$/u;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export const noteClone = value => structuredClone(value);
export const noteSame = (a, b) => digest(a) === digest(b);
export function noteGate(config) {
  requireValue(config?.coachNotesEnabled === true
    && config.coachNotesPolicyVersion === COACH_NOTES_POLICY_VERSION, 'COACH_NOTES_NOT_ACTIVE', 404);
}
export function noteIdentity(value, code = 'COACH_NOTE_IDENTITY_INVALID') {
  requireValue(typeof value === 'string' && ID.test(value), code); return value;
}
export function noteMm(value) { requireValue(typeof value === 'string' && MM.test(value), 'COACH_NOTE_SCOPE_INVALID'); return value; }
export function noteIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function noteCommand(body, fields) {
  requireValue(object(body) && Object.keys(body).every(k => fields.includes(k)), 'COACH_NOTE_COMMAND_INVALID');
}
export function noteSession(account, saved) {
  requireValue(saved?.id === account?.id && saved.verified === true
    && Number.isSafeInteger(saved.sessionVersion) && saved.sessionVersion === account.sessionVersion,
  'SESSION_EXPIRED', 401);
}
export function noteTerms({ id, mm, owner_id, recipient_id, purpose, policy_version, next_opening_context, expires_at, created_at }) {
  requireValue(NOTE_UUID.test(id || '') && noteMm(mm) && noteIdentity(owner_id) && noteIdentity(recipient_id)
    && owner_id !== recipient_id && purpose === COACH_NOTES_PURPOSE
    && policy_version === COACH_NOTES_POLICY_VERSION && next_opening_context === COACH_NOTES_OPENING_CONTEXT
    && noteIso(created_at) && noteIso(expires_at)
    && Date.parse(expires_at) > Date.parse(created_at)
    && Date.parse(expires_at) - Date.parse(created_at) <= MAX_NOTE_GRANT_MS, 'COACH_NOTE_TERMS_INVALID');
  return { id, mm, owner_id, recipient_id, purpose, policy_version, next_opening_context, expires_at, created_at };
}
export function validateNoteGrant(grant) {
  requireValue(object(grant) && Object.keys(grant).length === 6 && object(grant.terms), 'COACH_NOTE_GRANT_INVALID');
  const terms = noteTerms(grant.terms);
  requireValue(noteSame(terms, grant.terms) && grant.terms_hash === digest(terms)
    && ['pending', 'active', 'revoked'].includes(grant.status)
    && (grant.status !== 'pending' || grant.version === 1 && grant.accepted === null && grant.revoked === null)
    && (grant.status !== 'active' || grant.version === 2 && grant.revoked === null && object(grant.accepted))
    && (grant.status !== 'revoked' || grant.version === (grant.accepted ? 3 : 2)
      && object(grant.revoked) && Object.keys(grant.revoked).length === 2
      && grant.revoked.owner_id === terms.owner_id && noteIso(grant.revoked.at)
      && Date.parse(grant.revoked.at) >= Date.parse(terms.created_at)), 'COACH_NOTE_GRANT_INVALID');
  if (grant.accepted) requireValue(Object.keys(grant.accepted).length === 3
    && grant.accepted.recipient_id === terms.recipient_id && grant.accepted.terms_hash === grant.terms_hash
    && noteIso(grant.accepted.at) && Date.parse(grant.accepted.at) >= Date.parse(terms.created_at)
    && Date.parse(grant.accepted.at) < Date.parse(terms.expires_at), 'COACH_NOTE_GRANT_INVALID');
  return grant;
}
export function activeNoteGrant(grant, { mm, owner_id, recipient_id, version, at }) {
  validateNoteGrant(grant);
  requireValue(grant.status === 'active' && grant.terms.mm === mm && grant.terms.owner_id === owner_id
    && grant.terms.recipient_id === recipient_id && grant.version === version
    && Date.parse(grant.terms.expires_at) > at, 'COACH_NOTE_GRANT_UNAVAILABLE', 403);
  return grant;
}
export function immutableObservation({ id, mm, grant, author, text, at, reviewed }) {
  validateNoteGrant(grant);
  requireValue(NOTE_UUID.test(id || '') && noteIso(at) && typeof text === 'string'
    && text.trim().length > 0 && text.length <= MAX_COACH_NOTE_TEXT
    && reviewed === true && author?.id === grant.terms.recipient_id && author.verified === true
    && typeof author.displayName === 'string' && author.displayName.trim().length > 0 && author.displayName.length <= 100,
  'COACH_NOTE_OBSERVATION_INVALID');
  const body = { contract: 'athlete_coach_observation_v1', id, mm: noteMm(mm), grant_id: grant.terms.id,
    grant_version: grant.version, terms_hash: grant.terms_hash, purpose: COACH_NOTES_PURPOSE,
    policy_version: COACH_NOTES_POLICY_VERSION, author_id: author.id, author_name: author.displayName.trim(),
    text: text.trim(), created_at: at, reviewed: true, reviewed_by: author.id, reviewed_at: at,
    interpretation: 'Attributed unverified observation; no BOS, APA, learning or plan authority.' };
  requireValue(body.mm === grant.terms.mm, 'COACH_NOTE_SCOPE_INVALID');
  return { ...body, content_sha256: digest(body) };
}
export function validateObservation(note) {
  requireValue(object(note), 'COACH_NOTE_OBSERVATION_INVALID');
  const { content_sha256, ...body } = note;
  requireValue(body.contract === 'athlete_coach_observation_v1' && NOTE_UUID.test(body.id || '')
    && noteMm(body.mm) && NOTE_UUID.test(body.grant_id || '') && noteIdentity(body.author_id)
    && Number.isSafeInteger(body.grant_version) && body.grant_version >= 1
    && /^[a-f0-9]{64}$/u.test(body.terms_hash || '') && body.purpose === COACH_NOTES_PURPOSE
    && body.policy_version === COACH_NOTES_POLICY_VERSION && noteIso(body.created_at)
    && typeof body.author_name === 'string' && body.author_name.trim() && body.author_name.length <= 100
    && typeof body.text === 'string' && body.text.trim() && body.text.length <= MAX_COACH_NOTE_TEXT
    && body.reviewed === true && body.reviewed_by === body.author_id && body.reviewed_at === body.created_at
    && body.interpretation === 'Attributed unverified observation; no BOS, APA, learning or plan authority.'
    && content_sha256 === digest(body), 'COACH_NOTE_OBSERVATION_INVALID');
  requireValue(Object.keys(body).length === 16, 'COACH_NOTE_OBSERVATION_INVALID');
  return note;
}
export function emptyNoteBox(mm, ownerId) {
  return { contract: 'athlete_coach_notes_mailbox_v1', mm: noteMm(mm), owner_id: noteIdentity(ownerId),
    revision: 0, grants: [], notes: [], reviews: [], attempts: [] };
}
export function validateNoteBox(box, mm, ownerId) {
  requireValue(object(box) && Object.keys(box).length === 8 && box.contract === 'athlete_coach_notes_mailbox_v1'
    && box.mm === mm && box.owner_id === ownerId && Number.isSafeInteger(box.revision) && box.revision >= 0
    && Array.isArray(box.grants) && box.grants.length <= MAX_COACH_NOTE_GRANTS
    && Array.isArray(box.notes) && box.notes.length <= MAX_COACH_NOTES && Array.isArray(box.reviews)
    && box.reviews.length <= MAX_COACH_NOTES && Array.isArray(box.attempts)
    && box.attempts.length <= MAX_COACH_NOTES, 'COACH_NOTE_MAILBOX_INVALID');
  const grants = new Map();
  for (const grant of box.grants) {
    validateNoteGrant(grant);
    requireValue(grant.terms.mm === mm && grant.terms.owner_id === ownerId && !grants.has(grant.terms.id), 'COACH_NOTE_MAILBOX_INVALID');
    grants.set(grant.terms.id, grant);
  }
  const notes = new Map(), reserved = new Set(), attempts = new Set(), releasedAt = new Map();
  for (const note of box.notes) {
    validateObservation(note);
    const grant = grants.get(note.grant_id);
    requireValue(grant && note.mm === mm && note.author_id === grant.terms.recipient_id
      && note.terms_hash === grant.terms_hash && note.grant_version <= grant.version && !notes.has(note.id), 'COACH_NOTE_MAILBOX_INVALID');
    notes.set(note.id, note);
  }
  const reviewed = new Set();
  for (const review of box.reviews) {
    const n = notes.get(review.note_id), { review_sha256, ...body } = review;
    requireValue(Object.keys(review).length === 7 && n && !reviewed.has(n.id)
      && review.owner_id === ownerId && review.content_sha256 === n.content_sha256
      && review.grant_version === n.grant_version && noteIso(review.reviewed_at)
      && Date.parse(review.reviewed_at) >= Date.parse(n.created_at) && review.reviewed === true
      && review_sha256 === digest(body), 'COACH_NOTE_REVIEW_INVALID');
    reviewed.add(n.id);
  }
  for (const attempt of box.attempts) {
    const r = attempt?.reservation;
    const abandoned = attempt?.status === 'abandoned_before_dispatch';
    requireValue(object(attempt) && Object.keys(attempt).length === (abandoned ? 7 : 6) && object(r) && Object.keys(r).length === 7
      && r.contract === 'athlete_coach_note_reservation_v1' && r.mm === mm && r.owner_id === ownerId
      && NOTE_UUID.test(r.attempt_id || '') && !attempts.has(r.attempt_id)
      && Array.isArray(r.note_ids) && r.note_ids.length > 0 && r.note_ids.length <= MAX_PENDING_COACH_NOTES
      && ['reserved', 'dispatched', 'delivered', 'abandoned_before_dispatch'].includes(attempt.status)
      && noteIso(attempt.reserved_at), 'COACH_NOTE_RESERVATION_INVALID');
    attempts.add(r.attempt_id);
    const selectedIds = new Set();
    for (const id of r.note_ids) {
      requireValue(notes.has(id) && !selectedIds.has(id) && !reserved.has(id)
        && (!releasedAt.has(id) || Date.parse(attempt.reserved_at) >= releasedAt.get(id)), 'COACH_NOTE_RESERVATION_INVALID');
      selectedIds.add(id); if (!abandoned) reserved.add(id);
    }
    const selected = r.note_ids.map(id => notes.get(id));
    const versions = [...new Map(selected.map(n => [n.grant_id, { grant_id: n.grant_id, version: n.grant_version }])).values()];
    requireValue(r.notes_sha256 === digest(selected) && noteSame(r.grant_versions, versions), 'COACH_NOTE_RESERVATION_INVALID');
    if (attempt.status === 'reserved' || abandoned) requireValue(attempt.evidence_id === null && attempt.dispatched_at === null && attempt.completed_at === null, 'COACH_NOTE_RESERVATION_INVALID');
    if (!['reserved', 'abandoned_before_dispatch'].includes(attempt.status)) requireValue(NOTE_UUID.test(attempt.evidence_id || '') && noteIso(attempt.dispatched_at), 'COACH_NOTE_RESERVATION_INVALID');
    if (attempt.status === 'dispatched') requireValue(attempt.completed_at === null, 'COACH_NOTE_RESERVATION_INVALID');
    if (attempt.status === 'delivered') requireValue(noteIso(attempt.completed_at), 'COACH_NOTE_RESERVATION_INVALID');
    if (abandoned) {
      const audit = attempt.abandoned, { abandonment_sha256, ...body } = audit || {};
      requireValue(object(audit) && Object.keys(audit).length === 6 && audit.owner_id === ownerId
        && noteIso(audit.at) && Date.parse(audit.at) >= Date.parse(attempt.reserved_at)
        && audit.reason === 'participant_abandoned_before_dispatch'
        && audit.reservation_sha256 === digest(r) && audit.no_provider_admission === true
        && abandonment_sha256 === digest(body), 'COACH_NOTE_ABANDONMENT_INVALID');
      for (const id of r.note_ids) releasedAt.set(id, Date.parse(audit.at));
    }
  }
  return box;
}
export function coachObservationInput(note) {
  validateObservation(note);
  return { id: note.id, author_id: note.author_id, author_name: note.author_name, text: note.text,
    created_at: note.created_at, interpretation: note.interpretation, coach_note_handoff: 'next_opening' };
}
export function claimedNoteIds(box) {
  // Only an exact, audited pre-dispatch abandonment releases a reservation.
  return new Set(box.attempts.filter(a => a.status !== 'abandoned_before_dispatch').flatMap(a => a.reservation.note_ids));
}
export function ownNoteReceipts(box, authorId) {
  return box.notes.filter(n => n.author_id === authorId).map(n => {
    const attempt = box.attempts.findLast(a => a.reservation.note_ids.includes(n.id));
    return { id: n.id, mm: n.mm, grant_id: n.grant_id, content_sha256: n.content_sha256,
      created_at: n.created_at, review_status: 'reviewed-send', reviewed_by: n.reviewed_by, reviewed_at: n.reviewed_at,
      owner_acknowledged: box.reviews.some(r => r.note_id === n.id), status: attempt?.status || 'queued',
      attempt_id: attempt?.reservation.attempt_id || null, dispatched_at: attempt?.dispatched_at || null,
      completed_at: attempt?.completed_at || null };
  });
}
