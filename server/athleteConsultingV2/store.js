import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { captureContextMessage } from './capture.js';
import { withAthleteConsultingSessionLeaseV1 } from '../athleteLivingConsultOneShotV1/durableInfrastructure.js';
import { hash, initial, requireThat, validatePlan, applyOutput, applyLocalAction,
  pendingCoachNoteMessages, reviewedCoachNoteMessages, coachNoteHandoffStatus } from './state.js';
import { assertCurrentApaConfirmedSource, currentApaView, publishCurrentApa } from './currentApa.js';
import { createAthleteRslScope, createAthleteRslEvent, deriveAthleteRslEvents,
  replayAthleteRsl, athleteRslRetrievalContext, validateAthleteRslSourceMessages } from './rsl.js';
import { buildAthleteVisualWorld, materializeAthleteVisualPlan,
  validateAthleteVisualPlan } from './visual.js';
import { captureSessionStartMap } from './mapChange.js';

export const ATHLETE_V2_PREFIX = 'more:athlete-consulting-demo:v2';
export const MAX_STATE_BYTES = 4 * 1024 * 1024;
const ARRAY_FIELDS = ['messages', 'learning', 'feedback', 'suggestedLearning', 'sessions', 'events', 'processed'];
const TERMINAL = ['completed', 'failed', 'unknown'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => structuredClone(value);
const safeCode = (error) => /^[A-Z_]+$/u.test(error?.message) ? error.message : 'COACH_REQUEST_FAILED';
const FAILURE = 'MORE could not complete this response. Your message and saved plan are safe. You can try again when ready.';
const APA_FAILURE = 'MORE could not update your APA. Your current saved reading is unchanged. Please try again when ready.';
const INTERRUPTED = 'The connection was interrupted. Your saved conversation and plan are intact.';
const CLOSING_SOURCE_ACTIONS = new Set(['approve', 'draft', 'discard', 'update_apa',
  'publish_apa', 'discard_apa', 'confirm_fact', 'remember', 'forget']);
const VIEW_SECTIONS = Object.freeze({ home: ['home'], you: ['you', 'map', 'portrait', 'why', 'answers',
  'identity', 'mind', 'communication', 'connection', 'effort', 'pressure', 'strengths', 'thriving'],
  sport: ['sport', 'where', 'futures', 'move', 'plan', 'evidence'],
  plan: ['plan', 'current', 'proposed'] });
const SPORT_READINGS = new Set(['current', 'original', 'preview', 'historical', 'unverified']);
const SPORT_OBJECT_IDS = new Set(['domain-sport', 'domain-training', 'domain-mindset',
  'domain-school', 'future-current_course', 'future-emerging_future', 'future-better_future',
  'future-bold_future', 'future-downside_future', 'move', 'connection', 'sources',
  'agreement', 'version']);
function validViewContext(view, context) {
  if (!object(context) || !VIEW_SECTIONS[view]?.includes(context.section)) return false;
  const keys = Object.keys(context);
  if (view !== 'sport') return keys.length === 1;
  return keys.every(key => ['section', 'reading', 'objectId'].includes(key))
    && (context.reading === undefined || SPORT_READINGS.has(context.reading))
    && (context.objectId === undefined || SPORT_OBJECT_IDS.has(context.objectId));
}

// The owner check, expected-state check, archive and replacement are one Redis operation.
export const PERSIST_LUA = `-- ATHLETE_CONSULTING_V2_FENCED_PERSIST
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
local prior=redis.call('GET',KEYS[2])
if (prior or '') ~= ARGV[3] then return -1 end
if ARGV[4] == '1' and prior then
  local backup=redis.call('GET',KEYS[3])
  if backup and backup ~= prior then return -2 end
  redis.call('SET',KEYS[3],prior,'NX')
end
redis.call('SET',KEYS[2],ARGV[2])
redis.call('PEXPIRE',KEYS[1],ARGV[5])
return 1`;

function bindingFor(scopeId, slug, bundle) {
  requireThat(typeof scopeId === 'string' && scopeId.trim() && scopeId.length <= 4096, 'ATHLETE_V2_SCOPE_REQUIRED');
  requireThat(['nia', 'sofia'].includes(slug) && bundle?.person?.slug === slug, 'UNKNOWN_ATHLETE');
  requireThat(bundle.person.synthetic === true && bundle.bos?.synthetic === true && bundle.apa?.synthetic === true
    && bundle.person.mm === bundle.bos.mm && bundle.person.mm === bundle.apa.mm
    && /^[a-f0-9]{64}$/u.test(bundle.bos.artifact_sha256 || '') && /^[a-f0-9]{64}$/u.test(bundle.apa.artifact_sha256 || ''), 'REPORT_IDENTITY_MISMATCH');
  return { scope_hash: hash(scopeId), slug, mm: bundle.person.mm, bos_hash: bundle.bos.artifact_sha256, apa_hash: bundle.apa.artifact_sha256 };
}

export function athleteConsultingV2Keys({ scopeId, slug, bundle }) {
  const binding = bindingFor(scopeId, slug, bundle);
  const prefix = `${ATHLETE_V2_PREFIX}:${hash(binding)}`;
  return { state: `${prefix}:state`, lock: `${prefix}:lock`, backup: `${prefix}:backup`, binding };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function semanticRequestHash(body) {
  return hash(canonical(Object.fromEntries(Object.entries(body).filter(([key]) => !['requestId', 'revision'].includes(key)))));
}

function effectiveRslEvents(ctx, state) {
  const events = Array.isArray(state.rslEvents) && state.rslEvents.length
    ? clone(state.rslEvents)
    : clone(deriveAthleteRslEvents({ scope: ctx.rslScope, bundle: ctx.bundle, state }));
  validateAthleteRslSourceMessages({ scope: ctx.rslScope, events, state });
  return events;
}

function apaDraftSourceHash(ctx, state, sourceMessageId) {
  const message = state.messages.find((item) => item.id === sourceMessageId);
  return hash({ source: message ? { id: message.id, text: message.text, speaker: message.speaker,
    at: message.at } : null, rslEvents: effectiveRslEvents(ctx, state),
  reviewRequirements: state.apaReviewRequirements || [],
  acceptedPlan: state.plan, approvedLearning: state.learning });
}

function applicableApaReviewRequirements(state, sourceMessageId, kind, supersedes) {
  const requirements = state.apaReviewRequirements || [];
  if (!requirements.length) return [];
  requireThat(kind === 'correction' && supersedes.length > 0,
    'CURRENT_APA_REVIEW_SOURCE_REQUIRED');
  const sourceIndex = state.messages.findIndex(message => message.id === sourceMessageId);
  const covered = requirements.filter(item => item.event_type === 'CORRECTION'
    ? item.source_message_id === sourceMessageId
    : sourceIndex > item.minimum_message_index);
  requireThat(covered.length > 0, 'CURRENT_APA_REVIEW_SOURCE_REQUIRED');
  return covered.map(item => item.event_id);
}

function appendRslAction(ctx, before, after, body) {
  const tracked = ['approve', 'remember', 'forget', 'finish', 'confirm_fact'];
  if (!tracked.includes(body.action)) return;
  const events = effectiveRslEvents(ctx, before);
  const add = (event) => { events.push(event); replayAthleteRsl({ scope: ctx.rslScope, events }); return event; };
  if (body.action === 'forget') {
    const target = replayAthleteRsl({ scope: ctx.rslScope, events }).active_events
      .find((event) => event.event_type === 'APPROVED_LEARNING' && event.source_id === body.id);
    requireThat(target, 'ATHLETE_RSL_TARGET_NOT_ACTIVE');
    const retraction = add(createAthleteRslEvent({ scope: ctx.rslScope, type: 'RETRACTION', sourceId: body.requestId,
      recordedAt: new Date().toISOString(), targetEventId: target.event_id,
      authority: 'EXPLICIT_ATHLETE_RETRACTION' }));
    after.apaNeedsReview = true;
    after.apaReviewRequirements = [...(before.apaReviewRequirements || []), {
      event_id: retraction.event_id, event_type: 'RETRACTION', source_message_id: null,
      recorded_at: retraction.recorded_at, minimum_message_index: before.messages.length - 1 }];
  }
  for (const item of after.learning.filter((entry) => !before.learning.some((old) => old.id === entry.id))) {
    add(createAthleteRslEvent({ scope: ctx.rslScope, type: 'APPROVED_LEARNING', sourceId: item.id,
      recordedAt: item.approved_at, text: item.text, authority: 'ATHLETE_LEARNING_CONFIRMATION' }));
  }
  if (after.plan && after.plan.id !== before.plan?.id) {
    add(createAthleteRslEvent({ scope: ctx.rslScope, type: 'ACCEPTED_PLAN', sourceId: after.plan.id,
      recordedAt: after.plan.accepted_at, plan: after.plan, authority: 'PROTECTED_PLAN_APPROVAL' }));
  }
  if (body.action === 'confirm_fact') {
    const message = after.messages.find((entry) => entry.id === body.sourceMessageId);
    requireThat(message?.role === 'user' && message.speaker === 'athlete' && !message.capture
      && typeof message.text === 'string' && message.text.trim(), 'ATHLETE_FACT_SOURCE_REQUIRED');
    const correction = body.targetEventId !== undefined && body.targetEventId !== null;
    if (correction) {
      const target = replayAthleteRsl({ scope: ctx.rslScope, events }).active_events
        .find((event) => event.event_id === body.targetEventId);
      // Approved learning uses the existing forget-then-reapprove gate; it may
      // not be superseded while state.learning still says it is approved.
      requireThat(['ATHLETE_STATEMENT', 'CORRECTION'].includes(target?.event_type),
        'ATHLETE_RSL_TARGET_NOT_ACTIVE');
    }
    const fact = add(createAthleteRslEvent({ scope: ctx.rslScope, type: correction ? 'CORRECTION' : 'ATHLETE_STATEMENT',
      sourceId: body.requestId, recordedAt: new Date().toISOString(), text: message.text.trim(),
      sourceMessage: message,
      targetEventId: correction ? body.targetEventId : null,
      authority: correction ? 'EXPLICIT_ATHLETE_CORRECTION' : 'EXPLICIT_ATHLETE_SELF_REPORT' }));
    if (correction) {
      after.apaNeedsReview = true;
      after.apaReviewRequirements = [...(before.apaReviewRequirements || []), {
        event_id: fact.event_id, event_type: 'CORRECTION', source_message_id: message.id,
        recorded_at: fact.recorded_at, minimum_message_index: null }];
    }
  }
  after.rslEvents = events;
}

function validateEnvelope(envelope, binding, bundle, rslScope) {
  requireThat(object(envelope) && envelope.version === 2 && hash(envelope.binding) === hash(binding)
    && object(envelope.state) && object(envelope.operations), 'ATHLETE_V2_STATE_CORRUPT');
  const { envelope_hash: digest, ...unsigned } = envelope;
  requireThat(digest === hash(unsigned), 'ATHLETE_V2_STATE_CORRUPT');
  const state = envelope.state;
  requireThat(state.version === 2 && state.mm === binding.mm && Number.isSafeInteger(state.revision) && state.revision >= 0
    && ['ready', 'active', 'working', 'review', 'closed'].includes(state.status)
    && ARRAY_FIELDS.every((field) => Array.isArray(state[field]))
    && (state.apaNeedsReview === undefined || typeof state.apaNeedsReview === 'boolean')
    && (state.apaReviewRequirements === undefined || (Array.isArray(state.apaReviewRequirements)
      && state.apaReviewRequirements.length <= 512)),
  'ATHLETE_V2_STATE_CORRUPT');
  try {
    if (state.plan) validatePlan(state.plan);
    if (state.draft) { validatePlan(state.draft); requireThat(Array.isArray(state.draft.approvals), 'INVALID_PLAN'); }
    if (state.currentApa) currentApaView(bundle, state.currentApa);
    if (state.apaDraft) {
      const draft = state.apaDraft;
      requireThat(typeof draft.id === 'string' && /^[a-f0-9-]{36}$/u.test(draft.id)
        && /^[a-f0-9]{64}$/u.test(draft.hash || '')
        && /^[a-f0-9]{64}$/u.test(draft.source_hash || '')
        && Number.isSafeInteger(draft.expectedVersion)
        && draft.expectedVersion === currentApaView(bundle, state.currentApa || null).version
        && Array.isArray(draft.reviewRequirementIds)
        && draft.reviewRequirementIds.every(id => typeof id === 'string')
        && draft.hash === hash({ candidate: draft.candidate, confirmedChange: draft.confirmedChange,
          expectedVersion: draft.expectedVersion, reviewRequirementIds: draft.reviewRequirementIds,
          preview_content_hash: draft.previewRecord?.artifact?.artifact_sha256 }),
      'ATHLETE_V2_STATE_CORRUPT');
      currentApaView(bundle, draft.previewRecord);
    }
    if (state.rslEvents !== undefined) validateAthleteRslSourceMessages({ scope: rslScope,
      events: state.rslEvents, state });
    requireThat((state.apaReviewRequirements || []).every((item) => object(item)
      && ['CORRECTION', 'RETRACTION'].includes(item.event_type)
      && typeof item.event_id === 'string' && typeof item.recorded_at === 'string'
      && (item.event_type === 'CORRECTION' ? typeof item.source_message_id === 'string'
        : item.source_message_id === null)
      && (item.event_type === 'CORRECTION' ? item.minimum_message_index === null
        : Number.isSafeInteger(item.minimum_message_index) && item.minimum_message_index >= -1)
      && state.rslEvents?.some(event => event.event_id === item.event_id
        && event.event_type === item.event_type && event.recorded_at === item.recorded_at
        && (item.event_type !== 'CORRECTION' || event.source_message_id === item.source_message_id))),
    'ATHLETE_V2_STATE_CORRUPT');
    requireThat(!(state.apaReviewRequirements || []).length || state.apaNeedsReview === true,
      'ATHLETE_V2_STATE_CORRUPT');
    requireThat(state.visuals === undefined || (Array.isArray(state.visuals) && state.visuals.length <= 256),
      'ATHLETE_V2_STATE_CORRUPT');
  } catch { throw new Error('ATHLETE_V2_STATE_CORRUPT'); }
  for (const entry of Object.values(envelope.operations)) {
    requireThat(object(entry) && /^[a-f0-9]{64}$/u.test(entry.hash || '')
      && [...TERMINAL, 'pending'].includes(entry.status), 'ATHLETE_V2_STATE_CORRUPT');
  }
  if (state.status === 'working') {
    const operation = envelope.operations[state.pending?.requestId];
    requireThat(operation?.status === 'pending' && ['OPENING', 'CHAT', 'CLOSE', 'APA_UPDATE'].includes(state.pending?.task)
      && ['ready', 'active', 'review', 'closed'].includes(state.beforeWorking), 'ATHLETE_V2_STATE_CORRUPT');
  }
}

function seal(envelope) {
  const { envelope_hash: _prior, ...unsigned } = envelope;
  return { ...unsigned, envelope_hash: hash(unsigned) };
}

export function createStore({ redis, bundles, coach, scopeId, localAction = applyLocalAction,
  visualComposer = null, apaComposer = null }) {
  requireThat(redis && typeof redis.get === 'function' && typeof redis.set === 'function' && typeof redis.eval === 'function', 'ATHLETE_V2_STORAGE_REQUIRED');
  requireThat(typeof coach === 'function', 'ATHLETE_V2_COACH_REQUIRED');
  requireThat(visualComposer === null || typeof visualComposer === 'function', 'ATHLETE_V2_VISUAL_REQUIRED');
  requireThat(apaComposer === null || typeof apaComposer === 'function', 'ATHLETE_V2_APA_COMPOSER_REQUIRED');
  const context = (slug) => {
    requireThat(['nia', 'sofia'].includes(slug) && Object.hasOwn(bundles, slug), 'UNKNOWN_ATHLETE');
    return { bundle: bundles[slug], keys: athleteConsultingV2Keys({ scopeId, slug, bundle: bundles[slug] }),
      rslScope: createAthleteRslScope({ scopeId, bundle: bundles[slug] }) };
  };
  async function load({ bundle, keys }) {
    const raw = await redis.get(keys.state);
    if (raw === null || raw === undefined) return { raw: '', envelope: seal({ version: 2, binding: keys.binding, state: initial(bundle), operations: {} }) };
    requireThat(typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') <= MAX_STATE_BYTES, 'ATHLETE_V2_STATE_TOO_LARGE');
    let envelope;
    try { envelope = JSON.parse(raw); } catch { throw new Error('ATHLETE_V2_STATE_CORRUPT'); }
    validateEnvelope(envelope, keys.binding, bundle, createAthleteRslScope({ scopeId, bundle }));
    return { raw, envelope };
  }
  async function persist(ctx, lease, previous, envelope, backupId = null) {
    const next = seal(envelope);
    validateEnvelope(next, ctx.keys.binding, ctx.bundle, ctx.rslScope);
    const serialized = JSON.stringify(next);
    requireThat(Buffer.byteLength(serialized, 'utf8') <= MAX_STATE_BYTES, 'ATHLETE_V2_STATE_TOO_LARGE');
    requireThat(!lease.lost, 'ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST');
    const result = Number(await redis.eval(PERSIST_LUA, 3, ctx.keys.lock, ctx.keys.state,
      backupId ? `${ctx.keys.backup}:${hash(backupId)}` : ctx.keys.backup,
      lease.owner, serialized, previous, backupId ? '1' : '0', String(lease.lease_ms)));
    if (result === 0) { lease.lost = true; throw new Error('ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST'); }
    requireThat(result !== -1, 'STATE_CHANGED_RELOAD');
    requireThat(result === 1, 'ATHLETE_V2_BACKUP_CONFLICT');
    return { raw: serialized, envelope: next };
  }
  async function leaseOperation(ctx, operation) {
    try { return await withAthleteConsultingSessionLeaseV1({ redis, keys: ctx.keys, operation }); }
    catch (error) {
      if (error.message === 'ATHLETE_LIVING_CONSULT_REQUEST_IN_FLIGHT') throw new Error('PLEASE_WAIT');
      throw error;
    }
  }
  async function recover(ctx, lease, saved) {
    if (saved.envelope.state.status !== 'working') return saved;
    // Acquiring the shared lease proves the original worker no longer owns it.
    const envelope = clone(saved.envelope), state = envelope.state;
    const { requestId, task } = state.pending;
    state.status = state.beforeWorking;
    state.lastError = INTERRUPTED;
    state.events.push({ type: task === 'APA_UPDATE' ? 'apa_update_unknown' : 'coach_failed',
      code: 'COACH_OUTCOME_UNKNOWN', task, at: new Date().toISOString() });
    delete state.pending;
    state.revision++;
    state.processed = [...state.processed, requestId].slice(-200);
    envelope.operations[requestId] = { ...envelope.operations[requestId], status: 'unknown', completed_at: new Date().toISOString(), revision: state.revision };
    return persist(ctx, lease, saved.raw, envelope);
  }
  const visibleState = (state, bundle) => {
    const scope = createAthleteRslScope({ scopeId, bundle });
    const view = clone(state);
    delete view.rslEvents;
    delete view.apaReviewRequirements;
    if (view.apaDraft) view.apaDraft = { id: view.apaDraft.id, hash: view.apaDraft.hash,
      expectedVersion: view.apaDraft.expectedVersion,
      previewRecord: view.apaDraft.previewRecord };
    view.visuals = (view.visuals || []).map((visual) => {
      const { receipt: _privateReceipt, plan: sourcePlan, ...surface } = visual;
      const { providerReceipt: _providerReceipt, ...plan } = sourcePlan;
      return { ...surface, plan };
    });
    const modelMemory = athleteRslRetrievalContext({ scope,
      events: effectiveRslEvents({ rslScope: scope, bundle }, state) });
    // The UI can offer exact correction targets without receiving the private
    // model retrieval packet, lineage hashes, or duplicate plan snapshots.
    view.personalMemory = { contract: 'athlete_consulting_v2_memory_ui_v1',
      items: modelMemory.items.filter((item) => ['ATHLETE_STATEMENT', 'CORRECTION'].includes(item.event_type))
        .map((item) => ({ event_id: item.event_id, event_type: item.event_type,
          recorded_at: item.recorded_at, text: item.payload.text })) };
    view.coachNoteHandoff = coachNoteHandoffStatus(state, bundle);
    view.flagship_enabled = Boolean(visualComposer && apaComposer);
    return view;
  };
  function middleVisualEligible(state, body) {
    if (typeof body.text !== 'string'
      || !/\b(compare|comparison|versus|vs\.?|options?|difference|show me visually)\b/iu.test(body.text)) return false;
    const considered = state.events.filter((event) => event.type === 'visual_considered'
      && event.event === 'COACHING_MOMENT' && event.session_id === state.sessionId);
    return considered.length < 2 && state.messages.slice(state.sessionStart || 0)
      .filter((message) => message.role === 'user').length >= 1;
  }
  async function composeVisual(ctx, state, task, body) {
    if (!visualComposer) return;
    const event = task === 'OPENING' ? 'SESSION_OPENING'
      : task === 'CLOSE' ? 'SESSION_FINALIZATION'
        : middleVisualEligible(state, body) ? 'COACHING_MOMENT' : null;
    if (!event) return;
    const world = buildAthleteVisualWorld({ event, bundle: ctx.bundle, state, scopeId,
      sessionId: state.sessionId, triggerRequestId: body.requestId,
      currentApa: currentApaView(ctx.bundle, state.currentApa || null),
      ...(event === 'COACHING_MOMENT' ? { currentExchange: {
        athleteMessage: body.text, coachMessage: state.messages.at(-1)?.text } } : {}) });
    const composed = await visualComposer(world);
    requireThat(composed?.plan && Array.isArray(composed.plan.blocks), 'ATHLETE_VISUAL_PLAN_FAILED_CLOSED');
    const { providerReceipt: _providerReceipt, ...unmaterialized } = composed.plan;
    const candidate = { ...unmaterialized, blocks: unmaterialized.blocks.map((block) => {
      const { objects: _objects, evidence: _evidence, ...raw } = block;
      return raw;
    }) };
    requireThat(validateAthleteVisualPlan({ candidate, world }).ok, 'ATHLETE_VISUAL_PLAN_FAILED_CLOSED');
    const materialized = materializeAthleteVisualPlan({ candidate, world, receipt: composed.receipt || null });
    const { providerReceipt: _verifiedReceipt, ...verified } = materialized;
    requireThat(hash(unmaterialized) === hash(verified), 'ATHLETE_VISUAL_PLAN_FAILED_CLOSED');
    requireThat(event === 'COACHING_MOMENT' || composed.plan.renderDecision.render,
      'ATHLETE_VISUAL_PLAN_FAILED_CLOSED');
    state.events.push({ type: 'visual_considered', event, session_id: state.sessionId,
      request_id: body.requestId, rendered: materialized.renderDecision.render,
      at: new Date().toISOString() });
    if (!materialized.renderDecision.render) return;
    const id = randomUUID();
    if (!Array.isArray(state.visuals)) state.visuals = [];
    state.visuals.push({ id, event, session_id: state.sessionId, after_message_id: state.messages.at(-1)?.id,
      trigger_request_id: body.requestId, source_hash: world.stateBinding.triggerHash,
      plan: materialized, receipt: composed.receipt || null, at: new Date().toISOString() });
    if (task === 'CLOSE') state.closing.visual_id = id;
  }
  async function read(slug) {
    const ctx = context(slug), saved = await load(ctx);
    if (saved.envelope.state.status !== 'working') return visibleState(saved.envelope.state, ctx.bundle);
    try {
      return await leaseOperation(ctx, async (lease) => visibleState((await recover(ctx, lease, await load(ctx))).envelope.state, ctx.bundle));
    } catch (error) {
      if (error.message === 'PLEASE_WAIT') return visibleState((await load(ctx)).envelope.state, ctx.bundle);
      throw error;
    }
  }
  async function act(slug, body) {
    requireThat(object(body) && typeof body.requestId === 'string' && /^[A-Za-z0-9._:-]{1,160}$/u.test(body.requestId)
      && !['__proto__', 'constructor', 'prototype'].includes(body.requestId)
      && Number.isSafeInteger(body.revision) && body.revision >= 0, 'STATE_CHANGED_RELOAD');
    const ctx = context(slug), requestHash = semanticRequestHash(body);
    return leaseOperation(ctx, async (lease) => {
      let saved = await recover(ctx, lease, await load(ctx));
      const existing = Object.hasOwn(saved.envelope.operations, body.requestId) ? saved.envelope.operations[body.requestId] : null;
      if (existing) {
        requireThat(existing.hash === requestHash, 'REQUEST_ID_REUSED');
        requireThat(TERMINAL.includes(existing.status), 'PLEASE_WAIT');
        return visibleState(saved.envelope.state, ctx.bundle);
      }
      requireThat(body.revision === saved.envelope.state.revision, 'STATE_CHANGED_RELOAD');
      let envelope = clone(saved.envelope), state = envelope.state;
      const started = new Date().toISOString();
      let status = 'completed';
      if (body.action === 'reset') {
        // The previous envelope is archived atomically; request history survives restart.
        state = { ...initial(ctx.bundle), revision: state.revision, processed: state.processed };
        envelope.state = state;
        envelope.reset = { requestId: body.requestId, at: started };
      } else if (['start', 'message', 'close'].includes(body.action)) {
        const task = body.action === 'start' ? 'OPENING' : body.action === 'close' ? 'CLOSE' : 'CHAT';
        requireThat(task === 'OPENING' ? ['ready', 'closed'].includes(state.status) : ['active', 'review'].includes(state.status), 'SESSION_STATE_CHANGED');
        state.speaker = body.speaker === 'coach' ? 'coach' : 'athlete';
        state.view = ['home', 'you', 'sport', 'plan'].includes(body.view) ? body.view : 'home';
        requireThat(body.viewContext === undefined || validViewContext(state.view, body.viewContext),
          'VIEW_CONTEXT_INVALID');
        state.viewContext = body.viewContext || { section: state.view };
        if (task === 'CHAT') {
          requireThat(typeof body.text === 'string' && body.text.trim().length > 0 && body.text.length <= 10000, 'MESSAGE_REQUIRED');
          state.messages.push({ id: randomUUID(), role: 'user', speaker: state.speaker, text: body.text.trim(), at: started });
          if (state.status === 'review') { state.status = 'active'; state.closing = null; }
        }
        state.beforeWorking = state.status;
        state.status = 'working';
        state.pending = { task, at: started, requestId: body.requestId };
        envelope.operations[body.requestId] = { hash: requestHash, status: 'pending', task, started_at: started };
        saved = await persist(ctx, lease, saved.raw, envelope);
        await lease.assertOwned();
        let output, failure;
        const pendingMessages = pendingCoachNoteMessages(state, ctx.bundle);
        const pendingIds = pendingMessages.map((message) => message.id);
        try {
          const inputState = clone(state);
          // Only exact reviewed Coach Alex messages can enter the handoff.
          // Neither pending nor delivered notes re-enter ordinary model history.
          // Their original source messages remain saved for the authenticated UI.
          const reviewedMessages = new Set(reviewedCoachNoteMessages(inputState, ctx.bundle));
          inputState.messages = inputState.messages.filter((message) => !reviewedMessages.has(message)).map(captureContextMessage);
          if (task === 'OPENING') inputState.messages.push(...pendingMessages.map((message) => ({
            ...captureContextMessage(message), coach_note_handoff: 'next_opening',
          })));
          inputState.governedMemory = athleteRslRetrievalContext({ scope: ctx.rslScope,
            events: effectiveRslEvents(ctx, state) });
          output = await coach(clone(ctx.bundle), inputState, task);
        }
        catch (error) { failure = error; }
        // No response can publish after lease ownership has changed.
        await lease.assertOwned();
        envelope = clone(saved.envelope); state = envelope.state;
        state.status = state.beforeWorking;
        if (!failure) {
          try {
            const staged = clone(state);
            const nextSessionId = task === 'OPENING' ? randomUUID() : null;
            const sessionStartMap = task === 'OPENING' && visualComposer
              ? captureSessionStartMap({ bundle: ctx.bundle,
                state: { ...staged, sessionId: nextSessionId } }) : null;
            applyOutput(staged, output, task);
            if (task === 'OPENING') {
              staged.sessionId = nextSessionId;
              staged.sessionStartMap = sessionStartMap;
            }
            await composeVisual(ctx, staged, task, body);
            await lease.assertOwned();
            if (task === 'OPENING' && pendingIds.length) staged.events.push({ type: 'coach_note_opened',
              note_ids: pendingIds, request_id: body.requestId, at: new Date().toISOString() });
            envelope.state = staged;
            state = staged;
          } catch (error) { failure = error; }
        }
        if (failure) {
          status = 'failed';
          state.lastError = FAILURE;
          state.events.push({ type: 'coach_failed', code: safeCode(failure), task, at: new Date().toISOString() });
        }
        delete state.pending;
      } else if (body.action === 'update_apa') {
        requireThat(apaComposer, 'ATHLETE_V2_APA_COMPOSER_REQUIRED');
        requireThat(typeof body.sourceMessageId === 'string' && typeof body.reason === 'string'
          && body.reason.trim().length > 0 && body.reason.length <= 1000
          && ['reality', 'correction'].includes(body.kind) && Array.isArray(body.supersedes)
          && body.supersedes.length <= 8 && body.supersedes.every((id) => typeof id === 'string')
          && Number.isSafeInteger(body.expectedApaVersion) && body.expectedApaVersion >= 0,
        'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED');
        const confirmedChange = { id: randomUUID(), source_message_id: body.sourceMessageId,
          mm: ctx.bundle.person.mm, athlete_slug: slug, kind: body.kind,
          supersedes: body.supersedes, confirmed: true, confirmed_by: 'athlete',
          confirmed_at: started, reason: body.reason.trim() };
        requireThat(body.expectedApaVersion === currentApaView(ctx.bundle, state.currentApa || null).version,
          'CURRENT_APA_STALE_VERSION');
        assertCurrentApaConfirmedSource({ bundle: ctx.bundle, record: state.currentApa,
          state, confirmedChange, expectedVersion: body.expectedApaVersion });
        const reviewRequirementIds = applicableApaReviewRequirements(state,
          body.sourceMessageId, body.kind, body.supersedes);
        if (body.kind === 'correction') {
          state.apaNeedsReview = true;
          if (state.apaDraft) {
            state.events.push({ type: 'current_apa_draft_invalidated', draft_id: state.apaDraft.id,
              reason: 'ATHLETE_CORRECTION', at: started });
            state.apaDraft = null;
          }
        }
        // An unresolved APA update must not leave the earlier closing visual
        // visible as though it were the final map. Re-closing is automatic in
        // the authenticated UI after a successful update.
        if (state.status === 'review' && state.closing) {
          state.events.push({ type: 'closing_preview_invalidated', visual_id: state.closing.visual_id || null,
            action: 'update_apa', request_id: body.requestId, at: started });
          state.closing = null;
          state.beforeWorking = 'active';
        } else state.beforeWorking = state.status;
        state.status = 'working';
        state.pending = { task: 'APA_UPDATE', at: started, requestId: body.requestId };
        envelope.operations[body.requestId] = { hash: requestHash, status: 'pending', task: 'APA_UPDATE', started_at: started };
        saved = await persist(ctx, lease, saved.raw, envelope);
        await lease.assertOwned();
        let composed, failure;
        try { composed = await apaComposer({ bundle: clone(ctx.bundle), record: clone(state.currentApa),
          state: clone(state), confirmedChange, expectedVersion: body.expectedApaVersion }); }
        catch (error) { failure = error; }
        await lease.assertOwned();
        envelope = clone(saved.envelope); state = envelope.state;
        state.status = state.beforeWorking;
        if (!failure) {
          try {
            const staged = clone(state);
            const published = publishCurrentApa({ bundle: ctx.bundle, record: staged.currentApa,
              state: staged, confirmedChange, candidate: composed.candidate,
              expectedVersion: body.expectedApaVersion });
            requireThat(published.changed === composed.changed, 'CURRENT_APA_COMPOSER_MISMATCH');
            if (published.changed) {
              if (staged.apaDraft) staged.events.push({ type: 'current_apa_draft_superseded',
                draft_id: staged.apaDraft.id, at: new Date().toISOString() });
              const draftId = randomUUID();
              const draftHash = hash({ candidate: composed.candidate, confirmedChange,
                expectedVersion: body.expectedApaVersion,
                reviewRequirementIds,
                preview_content_hash: published.record.artifact.artifact_sha256 });
              staged.apaDraft = { id: draftId, hash: draftHash, candidate: composed.candidate,
                confirmedChange, expectedVersion: body.expectedApaVersion,
                reviewRequirementIds,
                source_hash: apaDraftSourceHash(ctx, staged, body.sourceMessageId),
                previewRecord: published.record,
                ...(composed.receipt === undefined ? {} : { receipt: composed.receipt }) };
            }
            staged.events.push({ type: published.changed ? 'current_apa_draft_prepared' : 'current_apa_no_change',
              version: published.record?.version || 0,
              content_hash: published.record?.artifact?.artifact_sha256 || ctx.bundle.apa.artifact_sha256,
              source_message_id: body.sourceMessageId, request_id: body.requestId,
              at: new Date().toISOString() });
            staged.lastError = null;
            envelope.state = staged;
            state = staged;
          } catch (error) { failure = error; }
        }
        if (failure) {
          status = 'failed';
          state.lastError = APA_FAILURE;
          state.events.push({ type: 'apa_update_failed', code: safeCode(failure), at: new Date().toISOString() });
        }
        delete state.pending;
      } else if (body.action === 'publish_apa') {
        const draft = state.apaDraft;
        requireThat(draft && body.id === draft.id && body.hash === draft.hash,
          'CURRENT_APA_DRAFT_CHANGED');
        requireThat(draft.source_hash === apaDraftSourceHash(ctx, state,
          draft.confirmedChange.source_message_id), 'CURRENT_APA_DRAFT_CHANGED');
        const published = publishCurrentApa({ bundle: ctx.bundle, record: state.currentApa,
          state, confirmedChange: draft.confirmedChange, candidate: draft.candidate,
          expectedVersion: draft.expectedVersion });
        requireThat(published.changed && published.record.artifact.artifact_sha256
          === draft.previewRecord.artifact.artifact_sha256, 'CURRENT_APA_DRAFT_CHANGED');
        state.currentApa = published.record;
        state.apaDraft = null;
        const covered = new Set(draft.reviewRequirementIds);
        state.apaReviewRequirements = (state.apaReviewRequirements || [])
          .filter(item => !covered.has(item.event_id));
        state.apaNeedsReview = state.apaReviewRequirements.length > 0;
        state.lastError = null;
        state.events.push({ type: 'current_apa_published', version: published.record.version,
          content_hash: published.record.artifact.artifact_sha256, draft_id: draft.id,
          request_id: body.requestId, at: started });
      } else if (body.action === 'discard_apa') {
        const draft = state.apaDraft;
        requireThat(draft && body.id === draft.id && body.hash === draft.hash,
          'CURRENT_APA_DRAFT_CHANGED');
        state.apaDraft = null;
        state.events.push({ type: 'current_apa_draft_declined', draft_id: draft.id, at: started });
      } else if (body.action === 'confirm_fact') {
        const before = clone(state);
        appendRslAction(ctx, before, state, body);
      } else {
        const before = clone(state);
        localAction(state, body, ctx.bundle);
        appendRslAction(ctx, before, state, body);
      }
      if (state.apaDraft && state.apaDraft.source_hash !== apaDraftSourceHash(ctx, state,
        state.apaDraft.confirmedChange.source_message_id)) {
        state.events.push({ type: 'current_apa_draft_invalidated', draft_id: state.apaDraft.id,
          reason: 'SOURCE_LINEAGE_CHANGED', at: new Date().toISOString() });
        state.apaDraft = null;
      }
      if (status === 'completed' && CLOSING_SOURCE_ACTIONS.has(body.action)) state.lastError = null;
      // A review is a preview of an exact saved-source set. Once any of those
      // sources changes, the old recap and its model-composed visual cannot be
      // displayed as the final result. The authenticated UI automatically
      // requests a fresh close after this committed action.
      if (CLOSING_SOURCE_ACTIONS.has(body.action) && state.status === 'review' && state.closing) {
        state.events.push({ type: 'closing_preview_invalidated', visual_id: state.closing.visual_id || null,
          action: body.action, request_id: body.requestId, at: new Date().toISOString() });
        state.closing = null;
        state.status = 'active';
      }
      state.revision++;
      state.processed = [...state.processed, body.requestId].slice(-200);
      envelope.operations[body.requestId] = { ...envelope.operations[body.requestId], hash: requestHash, status, started_at: started, completed_at: new Date().toISOString(), revision: state.revision };
      return visibleState((await persist(ctx, lease, saved.raw, envelope, body.action === 'reset' ? body.requestId : null)).envelope.state, ctx.bundle);
    });
  }
  return { read, act };
}
