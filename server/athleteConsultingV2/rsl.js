import { canonicalJson, hashCanonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze, isCanonicalTimestamp } from '../../src/lib/intelligenceFabric/validation.js';

// A private, read-only projection contract for the synthetic Athlete V2 demo.
// This module does not persist events or confer authority on a client claim.
// A future caller must append explicit events only at its authenticated human
// confirmation boundary; chat, model output, and coach notes are never sources.
const SCOPE_CONTRACT = 'athlete_consulting_v2_rsl_scope_v1';
const EVENT_CONTRACT = 'athlete_consulting_v2_rsl_event_v1';
const MAX_EVENTS = 512;
const MAX_TEXT = 1200;
const MAX_CONTEXT_ITEMS = 16;
const MAX_CONTEXT_CHARS = 6000;
const MAX_TARGET_ITEMS = 64;
const MAX_TARGET_CHARS = 16000;
const MAX_QUERY_CHARS = 10000;
const HASH = /^[a-f0-9]{64}$/u;
const TYPES = deepFreeze({
  APPROVED_LEARNING: { authority: 'ATHLETE_LEARNING_CONFIRMATION', epistemic: 'ATHLETE_APPROVED_PREFERENCE' },
  ATHLETE_STATEMENT: { authority: 'EXPLICIT_ATHLETE_SELF_REPORT', epistemic: 'ATHLETE_REPORTED_UNVERIFIED' },
  ACCEPTED_PLAN: { authority: 'PROTECTED_PLAN_APPROVAL', epistemic: 'HUMAN_ACCEPTED_PLAN' },
  CORRECTION: { authority: 'EXPLICIT_ATHLETE_CORRECTION', epistemic: 'ATHLETE_CORRECTED_REPORT' },
  RETRACTION: { authority: 'EXPLICIT_ATHLETE_RETRACTION', epistemic: 'ATHLETE_RETRACTED_REPORT' },
});

function requireThat(condition, code) {
  if (!condition) throw new Error(code);
}

function string(value, max = MAX_TEXT) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function clone(value) { return structuredClone(value); }

function athleteSourceMessage(message, text, recordedAt) {
  requireThat(message?.role === 'user' && message.speaker === 'athlete'
    && !message.capture && string(message.id, 160)
    && string(message.text) && message.text === text
    && isCanonicalTimestamp(message.at) && message.at <= recordedAt,
  'ATHLETE_RSL_SOURCE_MESSAGE_INVALID');
  return { id: message.id, role: message.role, speaker: message.speaker,
    text: message.text, at: message.at };
}

function validScope(scope) {
  return scope?.contract === SCOPE_CONTRACT && ['nia', 'sofia'].includes(scope.slug)
    && string(scope.mm, 120) && HASH.test(scope.scope_hash || '')
    && HASH.test(scope.bos_hash || '') && HASH.test(scope.apa_hash || '')
    && Object.keys(scope).sort().join('|') === 'apa_hash|bos_hash|contract|mm|scope_hash|slug';
}

function planSnapshot(plan) {
  requireThat(plan && string(plan.id, 160) && HASH.test(plan.hash || '')
    && isCanonicalTimestamp(plan.accepted_at) && string(plan.title)
    && string(plan.why) && string(plan.review)
    && Array.isArray(plan.steps) && plan.steps.length > 0 && plan.steps.length <= 8
    && plan.steps.every((step) => string(step.action) && string(step.when)
      && string(step.notice) && ['athlete', 'coach'].includes(step.owner))
    && Array.isArray(plan.approvals) && plan.approvals.length <= 2
    && plan.approvals.every((actor) => ['athlete', 'coach'].includes(actor))
    && plan.approvals.includes('athlete')
    && (!plan.steps.some((step) => step.owner === 'coach') || plan.approvals.includes('coach')),
  'ATHLETE_RSL_PLAN_NOT_ACCEPTED');
  return { id: plan.id, hash: plan.hash, accepted_at: plan.accepted_at,
    approvals: [...new Set(plan.approvals)].sort(),
    title: plan.title, why: plan.why, review: plan.review,
    steps: plan.steps.map(({ action, when, notice, owner }) => ({ action, when, notice, owner })) };
}

export function createAthleteRslScope({ scopeId, bundle }) {
  const person = bundle?.person;
  requireThat(string(scopeId, 4096) && person?.synthetic === true
    && ['nia', 'sofia'].includes(person.slug) && string(person.mm, 120)
    && bundle.bos?.synthetic === true && bundle.apa?.synthetic === true
    && bundle.bos.mm === person.mm && bundle.apa.mm === person.mm
    && HASH.test(bundle.bos.artifact_sha256 || '') && HASH.test(bundle.apa.artifact_sha256 || ''),
  'ATHLETE_RSL_SCOPE_DENIED');
  const identity = { slug: person.slug, mm: person.mm,
    bos_hash: bundle.bos.artifact_sha256, apa_hash: bundle.apa.artifact_sha256 };
  return deepFreeze({ contract: SCOPE_CONTRACT, ...identity,
    scope_hash: hashCanonicalJson({ scopeId, ...identity }) });
}

// sourceId is the immutable approval/request identifier, not a transcript ID
// inferred by this module. Explicit statement/correction/retraction source IDs
// must be minted only by a future authenticated Athlete action.
export function createAthleteRslEvent({ scope, type, sourceId, recordedAt,
  text = null, plan = null, targetEventId = null, sourceMessage = null, authority } = {}) {
  requireThat(validScope(scope), 'ATHLETE_RSL_SCOPE_DENIED');
  const contract = TYPES[type];
  requireThat(contract && authority === contract.authority
    && string(sourceId, 160) && isCanonicalTimestamp(recordedAt),
  'ATHLETE_RSL_EVENT_AUTHORITY_INVALID');
  let payload;
  if (type === 'ACCEPTED_PLAN') {
    requireThat(text === null && targetEventId === null && sourceMessage === null,
      'ATHLETE_RSL_EVENT_SHAPE_INVALID');
    payload = { plan: planSnapshot(plan) };
    requireThat(payload.plan.id === sourceId && payload.plan.accepted_at === recordedAt,
      'ATHLETE_RSL_PLAN_NOT_ACCEPTED');
  } else if (type === 'RETRACTION') {
    requireThat(text === null && plan === null && sourceMessage === null && string(targetEventId, 120),
      'ATHLETE_RSL_EVENT_SHAPE_INVALID');
    payload = { target_event_id: targetEventId };
  } else {
    requireThat(string(text) && plan === null
      && (type === 'CORRECTION' ? string(targetEventId, 120) : targetEventId === null),
    'ATHLETE_RSL_EVENT_SHAPE_INVALID');
    payload = type === 'CORRECTION'
      ? { text: text.trim(), target_event_id: targetEventId }
      : { text: text.trim() };
  }
  const source = type === 'ATHLETE_STATEMENT' || type === 'CORRECTION'
    ? athleteSourceMessage(sourceMessage, payload.text, recordedAt) : null;
  requireThat(source !== null || sourceMessage === null, 'ATHLETE_RSL_EVENT_SHAPE_INVALID');
  const body = { contract: EVENT_CONTRACT,
    event_id: `athlete_rsl_${hashCanonicalJson({ scope_hash: scope.scope_hash, type, sourceId }).slice(0, 24)}`,
    scope_hash: scope.scope_hash, athlete_slug: scope.slug, athlete_mm: scope.mm,
    bos_hash: scope.bos_hash, apa_hash: scope.apa_hash,
    event_type: type, epistemic_status: contract.epistemic, authority,
    source_id: sourceId, recorded_at: recordedAt,
    ...(source === null ? {} : { source_message_id: source.id, source_message_at: source.at,
      source_message_hash: hashCanonicalJson(source) }), payload };
  return deepFreeze({ ...body, event_hash: hashCanonicalJson(body) });
}

function validateEvent(event, scope) {
  requireThat(event?.contract === EVENT_CONTRACT && event.scope_hash === scope.scope_hash
    && event.athlete_slug === scope.slug && event.athlete_mm === scope.mm
    && event.bos_hash === scope.bos_hash && event.apa_hash === scope.apa_hash,
  'ATHLETE_RSL_EVENT_SCOPE_DENIED');
  let reconstructed;
  try {
    reconstructed = createAthleteRslEvent({ scope, type: event.event_type,
      sourceId: event.source_id, recordedAt: event.recorded_at,
      text: event.payload?.text ?? null, plan: event.payload?.plan ?? null,
      targetEventId: event.payload?.target_event_id ?? null,
      sourceMessage: ['ATHLETE_STATEMENT', 'CORRECTION'].includes(event.event_type)
        ? { id: event.source_message_id, role: 'user', speaker: 'athlete',
          text: event.payload?.text, at: event.source_message_at } : null,
      authority: event.authority });
  } catch { throw new Error('ATHLETE_RSL_EVENT_INTEGRITY_INVALID'); }
  requireThat(canonicalJson(event) === canonicalJson(reconstructed),
    'ATHLETE_RSL_EVENT_INTEGRITY_INVALID');
}

// Replay proves event integrity and scope; this second check proves that an
// explicit report still resolves to the same immutable saved athlete message.
// The caller supplies its trusted selected-athlete state, never a client body.
export function validateAthleteRslSourceMessages({ scope, events, state }) {
  requireThat(validScope(scope) && state?.mm === scope.mm && Array.isArray(state.messages),
    'ATHLETE_RSL_SOURCE_MESSAGE_INVALID');
  replayAthleteRsl({ scope, events });
  for (const event of events) {
    if (!['ATHLETE_STATEMENT', 'CORRECTION'].includes(event.event_type)) continue;
    const matches = state.messages.filter((message) => message?.id === event.source_message_id);
    requireThat(matches.length === 1, 'ATHLETE_RSL_SOURCE_MESSAGE_INVALID');
    const source = athleteSourceMessage(matches[0], event.payload.text, event.recorded_at);
    requireThat(source.at === event.source_message_at
      && hashCanonicalJson(source) === event.source_message_hash,
    'ATHLETE_RSL_SOURCE_MESSAGE_INVALID');
  }
  return true;
}

// Existing state is a CURRENT snapshot, not a fabricated historical audit log.
// In particular, messages, coach captures, proposed learning, drafts, and
// incomplete learning_removed/plan_replaced records are not canonical sources.
export function deriveAthleteRslEvents({ scope, bundle, state }) {
  requireThat(validScope(scope) && bundle?.person?.synthetic === true
    && bundle.person.slug === scope.slug && bundle.person.mm === scope.mm
    && bundle.bos?.artifact_sha256 === scope.bos_hash
    && bundle.apa?.artifact_sha256 === scope.apa_hash
    && bundle.bos?.synthetic === true && bundle.apa?.synthetic === true
    && state?.mm === scope.mm && Array.isArray(state.learning),
  'ATHLETE_RSL_SCOPE_DENIED');
  const events = [];
  for (const item of state.learning) {
    if (item?.speaker !== 'athlete' || !string(item.id, 160)
      || !string(item.text) || !isCanonicalTimestamp(item.approved_at)) continue;
    events.push(createAthleteRslEvent({ scope, type: 'APPROVED_LEARNING',
      sourceId: item.id, recordedAt: item.approved_at, text: item.text,
      authority: TYPES.APPROVED_LEARNING.authority }));
  }
  if (state.plan !== null && state.plan !== undefined) {
    const plan = planSnapshot(state.plan);
    events.push(createAthleteRslEvent({ scope, type: 'ACCEPTED_PLAN',
      sourceId: plan.id, recordedAt: plan.accepted_at, plan,
      authority: TYPES.ACCEPTED_PLAN.authority }));
  }
  requireThat(events.length <= MAX_EVENTS, 'ATHLETE_RSL_TOO_MANY_EVENTS');
  return deepFreeze(events.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)
    || a.event_id.localeCompare(b.event_id)));
}

export function replayAthleteRsl({ scope, events }) {
  requireThat(validScope(scope) && Array.isArray(events) && events.length <= MAX_EVENTS,
    'ATHLETE_RSL_INPUT_INVALID');
  const active = new Map(), seen = new Map(), lineage = [];
  let head = null, lastRecordedAt = null;
  for (const event of events) {
    validateEvent(event, scope);
    const prior = seen.get(event.event_id);
    if (prior) {
      requireThat(prior === event.event_hash, 'ATHLETE_RSL_EVENT_ID_CONFLICT');
      continue;
    }
    requireThat(lastRecordedAt === null || event.recorded_at >= lastRecordedAt,
      'ATHLETE_RSL_EVENT_ORDER_INVALID');
    lastRecordedAt = event.recorded_at;
    seen.set(event.event_id, event.event_hash);
    const targetId = event.payload.target_event_id;
    let root = event.event_id;
    if (targetId) {
      const target = active.get(targetId);
      requireThat(target && target.event_type !== 'ACCEPTED_PLAN',
        'ATHLETE_RSL_TARGET_NOT_ACTIVE');
      requireThat(event.recorded_at >= target.recorded_at,
        'ATHLETE_RSL_EVENT_ORDER_INVALID');
      root = target.lineage_root_id;
      active.delete(targetId);
      lineage.push({ event_id: event.event_id, event_type: event.event_type,
        target_event_id: targetId, lineage_root_id: root });
    }
    if (event.event_type === 'ACCEPTED_PLAN') {
      for (const [id, item] of active) {
        if (item.event_type !== 'ACCEPTED_PLAN') continue;
        active.delete(id);
        lineage.push({ event_id: event.event_id, event_type: 'PLAN_SUPERSESSION',
          target_event_id: id, lineage_root_id: item.lineage_root_id });
      }
    }
    if (event.event_type !== 'RETRACTION') active.set(event.event_id, { ...clone(event), lineage_root_id: root });
    head = hashCanonicalJson({ previous_hash: head, event_hash: event.event_hash,
      sequence: seen.size });
  }
  return deepFreeze({ contract: 'athlete_consulting_v2_rsl_replay_v1',
    scope_hash: scope.scope_hash, event_count: seen.size, head_hash: head,
    active_events: [...active.values()], lineage });
}

const QUERY_STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'been', 'could',
  'from', 'have', 'into', 'more', 'that', 'their', 'them', 'there', 'these', 'this',
  'what', 'when', 'where', 'which', 'with', 'would', 'your']);

function terms(value) {
  return new Set((String(value || '').toLowerCase().match(/\p{L}[\p{L}\p{N}_-]{2,}/gu) || [])
    .filter((term) => !QUERY_STOP_WORDS.has(term)).slice(-128));
}

function relevance(event, queryTerms) {
  if (!queryTerms.size) return 0;
  const payload = event.payload;
  const value = event.event_type === 'ACCEPTED_PLAN'
    ? [payload.plan.title, payload.plan.why, payload.plan.review,
      ...payload.plan.steps.flatMap((step) => [step.action, step.when, step.notice])].join(' ')
    : payload.text;
  const eventTerms = terms(value);
  let score = 0;
  for (const term of queryTerms) if (eventTerms.has(term)) score++;
  return score;
}

function packWholeItems(candidates, maxItems, maxChars, project) {
  const items = [];
  let chars = 0;
  for (const event of candidates) {
    const item = project(event);
    const size = canonicalJson(item).length;
    if (items.length < maxItems && chars + size <= maxChars) { items.push(item); chars += size; }
  }
  return { items, omitted_count: candidates.length - items.length };
}

// A correction is reserved before preferences can fill the finite context.
// Query overlap is only a deterministic ranking hint: it grants no authority
// and cannot resurrect a superseded event removed by replay.
// Whole items are omitted rather than truncating meaning or stripping status.
// This output is a private model-context candidate, never a client/public feed.
export function athleteRslRetrievalContext({ scope, events, maxItems = 12,
  maxChars = MAX_CONTEXT_CHARS, queryText = '' }) {
  requireThat(Number.isInteger(maxItems) && maxItems >= 1 && maxItems <= MAX_CONTEXT_ITEMS
    && Number.isInteger(maxChars) && maxChars >= 200 && maxChars <= MAX_CONTEXT_CHARS
    && typeof queryText === 'string' && queryText.length <= MAX_QUERY_CHARS,
  'ATHLETE_RSL_CONTEXT_LIMIT_INVALID');
  const replay = replayAthleteRsl({ scope, events });
  const priority = { ACCEPTED_PLAN: 0, CORRECTION: 1,
    APPROVED_LEARNING: 2, ATHLETE_STATEMENT: 3 };
  const queryTerms = terms(queryText);
  const scores = new Map(replay.active_events.map((event) =>
    [event.event_id, relevance(event, queryTerms)]));
  const order = (a, b) => (scores.get(b.event_id) - scores.get(a.event_id))
    || priority[a.event_type] - priority[b.event_type]
    || b.recorded_at.localeCompare(a.recorded_at) || a.event_id.localeCompare(b.event_id);
  const correction = replay.active_events.filter((event) => event.event_type === 'CORRECTION')
    .sort(order)[0];
  const candidates = [correction, ...replay.active_events.filter((event) => event !== correction)
    .sort(order)].filter(Boolean);
  const { items, omitted_count } = packWholeItems(candidates, maxItems, maxChars, (event) =>
    ({ event_id: event.event_id, lineage_root_id: event.lineage_root_id,
      event_type: event.event_type, epistemic_status: event.epistemic_status,
      recorded_at: event.recorded_at, payload: clone(event.payload) }));
  return deepFreeze({ contract: 'athlete_consulting_v2_rsl_context_v1',
    scope_hash: scope.scope_hash, source_watermark: replay.head_hash,
    items, omitted_count,
    raw_transcript_included: false, coach_observation_promoted: false });
}

// The authenticated correction picker must not depend on model-context
// truncation. It contains only active, scope-validated athlete reports; the
// caller must also verify their saved source messages before showing them.
export function athleteRslActiveCorrectionTargets({ scope, events, maxItems = 32,
  maxChars = MAX_TARGET_CHARS }) {
  requireThat(Number.isInteger(maxItems) && maxItems >= 1 && maxItems <= MAX_TARGET_ITEMS
    && Number.isInteger(maxChars) && maxChars >= 200 && maxChars <= MAX_TARGET_CHARS,
  'ATHLETE_RSL_TARGET_LIMIT_INVALID');
  const replay = replayAthleteRsl({ scope, events });
  const candidates = replay.active_events.filter((event) =>
    ['ATHLETE_STATEMENT', 'CORRECTION'].includes(event.event_type))
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)
      || Number(b.event_type === 'CORRECTION') - Number(a.event_type === 'CORRECTION')
      || a.event_id.localeCompare(b.event_id));
  const { items, omitted_count } = packWholeItems(candidates, maxItems, maxChars,
    (event) => ({ event_id: event.event_id, event_type: event.event_type,
      recorded_at: event.recorded_at, text: event.payload.text }));
  return deepFreeze({ contract: 'athlete_consulting_v2_rsl_correction_targets_v1',
    scope_hash: scope.scope_hash, source_watermark: replay.head_hash,
    items, omitted_count, raw_transcript_included: false,
    coach_observation_promoted: false });
}
