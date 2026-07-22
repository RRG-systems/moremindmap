import { canonicalJson, hashCanonicalJson } from '../hashing.js';
import { validateIntelligenceEvent } from '../intelligenceEvent.js';
import { deepFreeze } from '../validation.js';

const cloneFreeze = (value) => deepFreeze(JSON.parse(JSON.stringify(value)));

export function defineProjection({ projection_id, projection_version, initial_state, apply, finalize = (x) => x, validate_state = () => ({ valid: true, errors: [] }) }) {
  if (!projection_id || !projection_version || typeof apply !== 'function') throw new TypeError('ProjectionDefinition requires identity, version, and apply');
  return deepFreeze({ projection_id, projection_version, initial_state: cloneFreeze(initial_state), apply, finalize, validate_state });
}

function effectivePlan(storedEvents) {
  const replaced = new Map(); const tombstoned = new Set();
  for (const stored of storedEvents) {
    const e = stored.event;
    // Corrections preserve and replay the original event; correction-aware projectors
    // resolve the chain while historical ledgers retain both records.
    if (e.supersedes_event_id) replaced.set(e.supersedes_event_id, { by: e.event_id, reason: e.event_type.endsWith('TOMBSTONED') ? 'TOMBSTONED' : 'SUPERSEDED' });
    if (e.event_type.endsWith('TOMBSTONED') && e.payload?.target_event_id) tombstoned.add(e.payload.target_event_id);
  }
  return storedEvents.map((stored) => ({ stored, skip_reason: tombstoned.has(stored.event.event_id) ? 'TOMBSTONED' : replaced.get(stored.event.event_id)?.reason || null }));
}

const SCOPE_FILTER_KEYS = Object.freeze(['tenant_id', 'profile_id', 'business_id']);

function matchesReplayScope(stored, tenantId, filter) {
  const event = stored?.event;
  if (event?.tenant_id !== tenantId) return false;
  return SCOPE_FILTER_KEYS.every((key) => filter[key] == null || event[key] === filter[key]);
}

function replacementTargets(event) {
  return [
    event?.correction_of_event_id,
    event?.supersedes_event_id,
    event?.replacement_of_event_id,
    event?.replaces_event_id,
    event?.payload?.target_event_id,
    event?.payload?.replacement_of_event_id,
    event?.payload?.replaces_event_id,
  ].filter(Boolean);
}

export function createProjectionCheckpoint({ definition, tenant_id, filter_fingerprint, last_store_sequence, input_prefix, state, context }) {
  const checkpoint = { checkpoint_version: '1.0.0', projection_id: definition.projection_id,
    projection_version: definition.projection_version, tenant_id, filter_fingerprint, last_store_sequence,
    input_prefix_hash: hashCanonicalJson(input_prefix.map((x) => x.envelope_hash)), state_hash: hashCanonicalJson(state),
    context_hash: hashCanonicalJson(context), applied_event_ids: input_prefix.filter((x) => !x.event.event_type.endsWith('TOMBSTONED')).map((x) => x.event.event_id),
    state: cloneFreeze(state) };
  return deepFreeze({ ...checkpoint, checkpoint_hash: hashCanonicalJson(checkpoint) });
}

function verifyCheckpoint(checkpoint, definition, tenant_id, filter_fingerprint, events, context) {
  if (!checkpoint) return { valid: true };
  const unsigned = { ...checkpoint }; delete unsigned.checkpoint_hash;
  const prefix = events.filter((x) => x.store_sequence <= checkpoint.last_store_sequence);
  const valid = checkpoint.projection_id === definition.projection_id && checkpoint.projection_version === definition.projection_version
    && checkpoint.tenant_id === tenant_id && checkpoint.filter_fingerprint === filter_fingerprint
    && checkpoint.checkpoint_hash === hashCanonicalJson(unsigned) && checkpoint.context_hash === hashCanonicalJson(context)
    && checkpoint.state_hash === hashCanonicalJson(checkpoint.state)
    && checkpoint.input_prefix_hash === hashCanonicalJson(prefix.map((x) => x.envelope_hash));
  return { valid, prefix };
}

export function replayProjection({ definition, stored_events, tenant_id, filter = {}, context = {}, checkpoint = null }) {
  const ordered = [...stored_events].filter((stored) => matchesReplayScope(stored, tenant_id, filter))
    .sort((a, b) => a.event.effective_at.localeCompare(b.event.effective_at) || a.store_sequence - b.store_sequence);
  const filterFingerprint = hashCanonicalJson(filter), verified = verifyCheckpoint(checkpoint, definition, tenant_id, filterFingerprint, ordered, context);
  if (!verified.valid) return deepFreeze({ ok: false, status: 'CHECKPOINT_INVALID', failure: { code: 'CHECKPOINT_INVALID', projection_id: definition.projection_id } });
  const checkpointEffectiveBoundary = checkpoint && verified.prefix.length
    ? verified.prefix.reduce((latest, stored) => stored.event.effective_at > latest ? stored.event.effective_at : latest, verified.prefix[0].event.effective_at)
    : null;
  const lateEffectiveEvent = checkpointEffectiveBoundary && ordered.some((stored) => stored.store_sequence > checkpoint.last_store_sequence
    && stored.event.effective_at < checkpointEffectiveBoundary);
  const checkpointEventIds = checkpoint ? new Set(verified.prefix.map((stored) => stored.event.event_id)) : new Set();
  const replacementCrossesCheckpoint = checkpoint && ordered.some((stored) => stored.store_sequence > checkpoint.last_store_sequence
    && replacementTargets(stored.event).some((target) => checkpointEventIds.has(target)));
  const activeCheckpoint = lateEffectiveEvent || replacementCrossesCheckpoint ? null : checkpoint;
  let state = activeCheckpoint ? cloneFreeze(activeCheckpoint.state) : cloneFreeze(definition.initial_state);
  const startSequence = activeCheckpoint?.last_store_sequence || 0, applied_event_ids = [...(activeCheckpoint?.applied_event_ids || [])], skipped_events = [];
  const plan = effectivePlan(ordered);
  for (const { stored, skip_reason } of plan) {
    if (stored.store_sequence <= startSequence) continue;
    const validation = validateIntelligenceEvent(stored.event);
    if (!validation.valid || stored.envelope_hash !== hashCanonicalJson({ event: stored.event, aggregate_key: stored.aggregate_key, aggregate_sequence: stored.aggregate_sequence, store_sequence: stored.store_sequence })) return deepFreeze({ ok: false, status: 'REPLAY_FAILED', failure: { code: 'INVALID_EVENT_OR_HASH', event_id: stored.event.event_id, store_sequence: stored.store_sequence, errors: validation.errors.map((x) => ({ code: x.code, path: x.path })) } });
    if (skip_reason || stored.event.event_type.endsWith('TOMBSTONED')) { skipped_events.push({ event_id: stored.event.event_id, reason: skip_reason || 'TOMBSTONE_CONTROL' }); continue; }
    try { state = definition.apply(cloneFreeze(state), cloneFreeze(stored.event), deepFreeze({ ...context, store_sequence: stored.store_sequence })); }
    catch (error) { return deepFreeze({ ok: false, status: 'REPLAY_FAILED', failure: { code: 'PROJECTOR_ERROR', event_id: stored.event.event_id, store_sequence: stored.store_sequence, message: String(error.message || 'projector failed').slice(0, 160) } }); }
    applied_event_ids.push(stored.event.event_id);
  }
  state = definition.finalize(cloneFreeze(state), context); const stateValidation = definition.validate_state(state);
  if (!stateValidation.valid) return deepFreeze({ ok: false, status: 'REPLAY_FAILED', failure: { code: 'INVALID_PROJECTED_STATE', errors: stateValidation.errors } });
  const eventHashes = ordered.map((x) => x.envelope_hash), cutoff = ordered.at(-1)?.store_sequence || 0;
  const receipt = { receipt_version: '1.0.0', projection_id: definition.projection_id, projection_version: definition.projection_version,
    tenant_id, filter_fingerprint: filterFingerprint, context_hash: hashCanonicalJson(context), cutoff_store_sequence: cutoff,
    applied_event_ids, skipped_events, checkpoint_id: activeCheckpoint?.checkpoint_hash || null, output_hash: hashCanonicalJson(state) };
  const replay_hash = hashCanonicalJson({ domain: 'more-replay-v1', projection: `${definition.projection_id}@${definition.projection_version}`,
    context: receipt.context_hash, filter: filterFingerprint, cutoff, event_hashes: eventHashes, output_hash: receipt.output_hash });
  return deepFreeze({ ok: true, status: 'REPLAYED', state: cloneFreeze(state), receipt: deepFreeze({ ...receipt, receipt_hash: hashCanonicalJson(receipt) }), replay_hash });
}

export function compareReplayResults(left, right) {
  const equivalent = Boolean(left?.ok && right?.ok && left.replay_hash === right.replay_hash && canonicalJson(left.state) === canonicalJson(right.state));
  return deepFreeze({ equivalent, left_hash: left?.replay_hash || null, right_hash: right?.replay_hash || null,
    reason: equivalent ? 'IDENTICAL_HISTORY_CONTEXT_AND_OUTPUT' : 'REPLAY_DIVERGENCE' });
}
