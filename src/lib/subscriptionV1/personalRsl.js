import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { contractHeader, sameScope, scopeFingerprint, validateSubscriptionV1Contract } from './contracts.js';
import { TRANSCRIPT_RETENTION_BOUNDARY } from './constants.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const FORBIDDEN_TRANSCRIPT_KEYS = new Set([
  'raw_transcript',
  'transcript',
  'conversation_transcript',
  'raw_messages',
  'messages',
  'provider_request',
  'provider_response',
  'prompt',
]);

function containsForbiddenTranscript(value, depth = 0) {
  if (depth > 12 || value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => containsForbiddenTranscript(entry, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => FORBIDDEN_TRANSCRIPT_KEYS.has(key.toLowerCase())
    || containsForbiddenTranscript(entry, depth + 1));
}

function eventContentHash(event) {
  const unsigned = { ...event };
  delete unsigned.content_hash;
  return hashCanonicalJson(unsigned);
}

function envelopeHash(envelope) {
  const unsigned = { ...envelope };
  delete unsigned.envelope_hash;
  return hashCanonicalJson(unsigned);
}

export function createPersonalRslEvent(input) {
  const body = {
    ...contractHeader('personal_rsl_event'),
    event_id: input.event_id,
    scope: clone(input.scope),
    session_id: input.session_id || null,
    event_type: input.event_type,
    effective_at: new Date(input.effective_at).toISOString(),
    recorded_at: new Date(input.recorded_at).toISOString(),
    source_class: input.source_class,
    actor: clone(input.actor),
    establishing_authority: clone(input.establishing_authority),
    semantic_payload: clone(input.semantic_payload || {}),
    evidence_refs: clone(input.evidence_refs || []),
    supersedes_event_ids: [...new Set(input.supersedes_event_ids || [])].sort(),
    retracts_event_ids: [...new Set(input.retracts_event_ids || [])].sort(),
    confirmation_event_id: input.confirmation_event_id || null,
  };
  const event = deepFreeze({ ...body, content_hash: eventContentHash(body) });
  const validation = validateSubscriptionV1Contract(event);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_EVENT_CONTRACT_INVALID', errors: validation.errors });
  if (containsForbiddenTranscript(event.semantic_payload)) return deepFreeze({ ok: false, code: 'RAW_TRANSCRIPT_NOT_CANONICAL' });
  if (['SUBSCRIPTION_COACH_PROPOSAL', 'HUMAN_COACH_PROPOSAL'].includes(event.source_class) && event.event_type !== 'QUESTION') {
    return deepFreeze({ ok: false, code: 'COACH_PROPOSAL_CANNOT_ESTABLISH_CANONICAL_TRUTH' });
  }
  if (['CUSTOMER_SELF_REPORT', 'ATHLETE_SELF_REPORT', 'INSTRUCTOR_OBSERVATION', 'JOINT_HUMAN_AGREEMENT'].includes(event.source_class)
    && event.event_type !== 'QUESTION' && !event.confirmation_event_id) {
    return deepFreeze({ ok: false, code: 'CUSTOMER_CONFIRMATION_REQUIRED' });
  }
  return deepFreeze({ ok: true, code: 'PERSONAL_RSL_EVENT_CREATED', event });
}

export class InMemoryPersonalRslStore {
  constructor({ store_version = 'subscription_v1_personal_rsl_in_memory_v1' } = {}) {
    this.storeVersion = store_version;
    this.partitions = new Map();
    this.eventIndex = new Map();
  }

  #partition(scope) {
    const key = scopeFingerprint(scope);
    if (!this.partitions.has(key)) this.partitions.set(key, { scope: clone(scope), records: [] });
    return this.partitions.get(key);
  }

  append({ scope, event, appended_at }) {
    if (!sameScope(scope, event?.scope)) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_SCOPE_DENIED' });
    const validation = validateSubscriptionV1Contract(event);
    if (!validation.valid || event.content_hash !== eventContentHash(event)) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_EVENT_INTEGRITY_INVALID' });
    if (containsForbiddenTranscript(event.semantic_payload)) return deepFreeze({ ok: false, code: 'RAW_TRANSCRIPT_NOT_CANONICAL' });
    const existing = this.eventIndex.get(event.event_id);
    if (existing) return deepFreeze(existing.event.content_hash === event.content_hash
      ? { ok: true, code: 'IDEMPOTENT_REPLAY', envelope: clone(existing.envelope) }
      : { ok: false, code: 'PERSONAL_RSL_EVENT_ID_CONFLICT' });
    const partition = this.#partition(scope);
    const referencedIds = [...event.supersedes_event_ids, ...event.retracts_event_ids];
    for (const targetId of referencedIds) {
      const target = this.eventIndex.get(targetId);
      if (!target || !sameScope(target.event.scope, scope)) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_REFERENCE_SCOPE_OR_ID_INVALID', target_event_id: targetId });
    }
    if (event.event_type === 'RETRACTION' && event.retracts_event_ids.length === 0) return deepFreeze({ ok: false, code: 'RETRACTION_TARGET_REQUIRED' });
    if (['CORRECTION', 'EVIDENCE_CORRECTED'].includes(event.event_type) && event.supersedes_event_ids.length === 0) return deepFreeze({ ok: false, code: 'CORRECTION_TARGET_REQUIRED' });
    const previous = partition.records.at(-1)?.envelope?.envelope_hash || null;
    const sequence = partition.records.length + 1;
    const envelopeBody = {
      ...contractHeader('personal_rsl_envelope'),
      envelope_id: `rsl_envelope_${hashCanonicalJson({ scope: scopeFingerprint(scope), sequence, event: event.event_id }).slice(0, 24)}`,
      scope_hash: scopeFingerprint(scope),
      sequence,
      event_id: event.event_id,
      event_hash: event.content_hash,
      previous_envelope_hash: previous,
      appended_at: new Date(appended_at).toISOString(),
      store_version: this.storeVersion,
    };
    const envelope = deepFreeze({ ...envelopeBody, envelope_hash: envelopeHash(envelopeBody) });
    const envelopeValidation = validateSubscriptionV1Contract(envelope);
    if (!envelopeValidation.valid) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_ENVELOPE_CONTRACT_INVALID', errors: envelopeValidation.errors });
    const record = { envelope: clone(envelope), event: clone(event) };
    partition.records.push(record);
    this.eventIndex.set(event.event_id, record);
    return deepFreeze({ ok: true, code: 'PERSONAL_RSL_APPENDED', envelope });
  }

  read({ scope }) {
    const partition = this.partitions.get(scopeFingerprint(scope));
    if (!partition || !sameScope(partition.scope, scope)) return deepFreeze({ ok: true, code: 'PERSONAL_RSL_EMPTY', records: [] });
    return deepFreeze({ ok: true, code: 'PERSONAL_RSL_READ', records: clone(partition.records) });
  }

  verify({ scope }) {
    const records = this.read({ scope }).records;
    let previous = null;
    for (let index = 0; index < records.length; index += 1) {
      const { envelope, event } = records[index];
      if (!sameScope(scope, event.scope) || envelope.sequence !== index + 1 || envelope.previous_envelope_hash !== previous
        || envelope.event_hash !== event.content_hash || event.content_hash !== eventContentHash(event)
        || envelope.envelope_hash !== envelopeHash(envelope)) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_HASH_CHAIN_INVALID', sequence: index + 1 });
      previous = envelope.envelope_hash;
    }
    return deepFreeze({ ok: true, code: 'PERSONAL_RSL_HASH_CHAIN_VALID', event_count: records.length, head_hash: previous });
  }

  replay({ scope, effective_as_of = null, recorded_as_of = null }) {
    const integrity = this.verify({ scope });
    if (!integrity.ok) return integrity;
    const effectiveCutoff = effective_as_of ? Date.parse(effective_as_of) : Number.POSITIVE_INFINITY;
    const recordedCutoff = recorded_as_of ? Date.parse(recorded_as_of) : Number.POSITIVE_INFINITY;
    const records = this.read({ scope }).records.filter(({ event }) => Date.parse(event.effective_at) <= effectiveCutoff && Date.parse(event.recorded_at) <= recordedCutoff);
    const superseded = new Set();
    const retracted = new Set();
    for (const { event } of records) {
      for (const id of event.supersedes_event_ids) superseded.add(id);
      for (const id of event.retracts_event_ids) retracted.add(id);
    }
    const active = records
      .filter(({ event }) => !superseded.has(event.event_id) && !retracted.has(event.event_id) && event.event_type !== 'RETRACTION')
      .sort((left, right) => left.event.effective_at.localeCompare(right.event.effective_at)
        || left.event.recorded_at.localeCompare(right.event.recorded_at)
        || left.envelope.sequence - right.envelope.sequence);
    const state = {
      scope: clone(scope),
      effective_as_of,
      recorded_as_of,
      active_events: active.map(({ event }) => clone(event)),
      superseded_event_ids: [...superseded].sort(),
      retracted_event_ids: [...retracted].sort(),
      source_watermark: integrity.head_hash,
    };
    return deepFreeze({
      ok: true,
      code: 'PERSONAL_RSL_REPLAYED',
      state,
      replay_hash: hashCanonicalJson(state),
    });
  }

  planExport({ scope, actor_ref, requested_at }) {
    return deepFreeze({
      ok: true,
      code: 'EXPORT_PLAN_ONLY',
      scope_hash: scopeFingerprint(scope),
      actor_ref,
      requested_at,
      retention_policy_status: TRANSCRIPT_RETENTION_BOUNDARY.durable_raw_transcript_retention,
      raw_transcript_included: false,
      destructive_action_performed: false,
    });
  }

  planDeletion({ scope, actor_ref, requested_at }) {
    return deepFreeze({
      ok: true,
      code: 'DELETION_POLICY_UNRESOLVED_NO_ACTION',
      scope_hash: scopeFingerprint(scope),
      actor_ref,
      requested_at,
      legal_policy_status: 'FOUNDER_POLICY_UNRESOLVED',
      destructive_action_authorized: false,
      destructive_action_performed: false,
    });
  }
}

// This buffer is intentionally process-local and cannot emit canonical RSL records.
export class EphemeralTranscriptBuffer {
  constructor({ max_turns = 24 } = {}) {
    this.maxTurns = max_turns;
    this.turns = [];
  }

  push(turn) {
    this.turns.push(clone(turn));
    if (this.turns.length > this.maxTurns) this.turns.shift();
    return deepFreeze({ ok: true, buffered_turns: this.turns.length, canonical: false });
  }

  snapshot() {
    return deepFreeze({ turns: clone(this.turns), canonical: false, durable: false, policy_status: TRANSCRIPT_RETENTION_BOUNDARY.durable_raw_transcript_retention });
  }

  clear() {
    this.turns = [];
    return deepFreeze({ ok: true, cleared: true });
  }
}
