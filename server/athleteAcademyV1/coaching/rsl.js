import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { deepFreeze, isCanonicalTimestamp } from '../../../src/lib/intelligenceFabric/validation.js';
import { createAthleteRslCore } from '../../athleteApa/rslCore.js';
import { assertOwner, hash, requireThat, validateCanonicalCoachBundle } from './bundle.js';

export const MAIN_RSL_CONTRACTS = Object.freeze({ scope: 'athlete_academy_rsl_scope_v1',
  event: 'athlete_academy_rsl_event_v1', replay: 'athlete_academy_rsl_replay_v1',
  context: 'athlete_academy_rsl_context_v1', targets: 'athlete_academy_rsl_correction_targets_v1' });
const HASH = /^[a-f0-9]{64}$/u;
const text = (value, limit = 1200) => typeof value === 'string' && value.trim() && value.length <= limit;
const same = (a, b) => hashCanonicalJson(a) === hashCanonicalJson(b);
function acceptedPlan(plan, scope) {
  requireThat(plan && text(plan.id, 160) && HASH.test(plan.hash || '')
    && isCanonicalTimestamp(plan.accepted_at) && text(plan.title) && text(plan.why) && text(plan.review)
    && [undefined, 'private'].includes(plan.visibility)
    && Array.isArray(plan.steps) && plan.steps.length > 0 && plan.steps.length <= 8
    && plan.steps.every(step => text(step.action) && text(step.when) && text(step.notice) && step.owner === 'athlete'
      && Object.keys(step).sort().join('|') === 'action|notice|owner|when')
    && Array.isArray(plan.approvals) && plan.approvals.length === 1
    && plan.approvals.every(approval => approval?.actorId === scope.actor_id
      && approval.hash === plan.hash && isCanonicalTimestamp(approval.at) && approval.at <= plan.accepted_at),
  'ATHLETE_RSL_PLAN_NOT_ACCEPTED');
  const body = { title: plan.title, why: plan.why, steps: plan.steps, review: plan.review };
  requireThat(hash(body) === plan.hash, 'ATHLETE_RSL_PLAN_NOT_ACCEPTED');
  return { id: plan.id, hash: plan.hash, accepted_at: plan.accepted_at,
    approvals: plan.approvals.map(({ actorId, hash: approvalHash, at }) => ({ actorId, hash: approvalHash, at })),
    title: plan.title, why: plan.why, review: plan.review,
    steps: structuredClone(plan.steps) };
}
const core = createAthleteRslCore(Object.freeze({ contracts: MAIN_RSL_CONTRACTS,
  validScope: scope => text(scope.actor_id, 160) && text(scope.mm, 120)
    && HASH.test(scope.scope_hash || '') && HASH.test(scope.bos_hash || '') && HASH.test(scope.apa_hash || '')
    && Object.keys(scope).sort().join('|') === 'actor_id|apa_hash|bos_hash|contract|mm|scope_hash',
  eventIdentity: scope => ({ athlete_actor_id: scope.actor_id, athlete_mm: scope.mm }),
  eventMatches: (event, scope) => event.athlete_actor_id === scope.actor_id && event.athlete_mm === scope.mm,
  sourceMatches: (message, scope) => message.actorId === scope.actor_id
    && (!Object.hasOwn(message, 'mm') || message.mm === scope.mm),
  sourceIdentity: (message, scope) => ({ actorId: message.actorId, mm: scope.mm }),
  restoreSourceIdentity: (event, scope) => ({ actorId: event.athlete_actor_id, mm: scope.mm }),
  planSnapshot: acceptedPlan,
}));

// No request-selected authority flag. The owning service supplies an exact,
// synchronous account/dossier/coaching snapshot fence for human event creation.
export function createMainAthleteRslAdapter({ assertFencedAuthority } = {}) {
  requireThat(typeof assertFencedAuthority === 'function', 'MAIN_RSL_FENCE_REQUIRED');
  function owner(input) {
    validateCanonicalCoachBundle(input?.bundle);
    assertOwner(input.bundle, input.principal);
    requireThat(input.principal.grants?.reportsRead === true
      && !Object.hasOwn(input.bundle.person, 'slug')
      && Object.keys(input.bundle.binding).sort().join('|') === 'actorId|apa|bos|mm', 'MAIN_RSL_CANONICAL_AUTHORITY_REQUIRED');
    if (input.state) requireThat(input.state.mm === input.bundle.person.mm
      && same(input.state.sourceBinding, input.bundle.binding) && Array.isArray(input.state.messages),
    'MAIN_RSL_STATE_SOURCE_MISMATCH');
  }
  function createRslScope(input) {
    owner(input);
    const identity = { actor_id: input.bundle.binding.actorId, mm: input.bundle.person.mm,
      bos_hash: input.bundle.binding.bos, apa_hash: input.bundle.binding.apa };
    return deepFreeze({ contract: MAIN_RSL_CONTRACTS.scope, ...identity,
      scope_hash: hashCanonicalJson({ scopeId: 'athlete-academy-private', ...identity }) });
  }
  function context(input) {
    owner(input);
    requireThat(input.state, 'MAIN_RSL_STATE_SOURCE_MISMATCH');
    const scope = createRslScope(input);
    requireThat(input.scope === undefined || same(input.scope, scope), 'ATHLETE_RSL_SCOPE_DENIED');
    const events = input.events ?? input.state.rslEvents ?? [];
    return { scope, events, state: input.state };
  }
  function fence(input, operation) {
    owner(input);
    requireThat(input.authority && typeof input.authority === 'object'
      && !Array.isArray(input.authority) && assertFencedAuthority({ ...input, operation }) === true,
    'MAIN_RSL_FENCE_REQUIRED');
  }
  function createRslEvent(input) {
    fence(input, 'event');
    const ctx = context(input), { scope } = ctx;
    core.validateRslSources(ctx);
    if (input.type === 'CORRECTION') requireThat(core.replayRsl(ctx).active_events.some(event =>
      event.event_id === input.targetEventId && ['ATHLETE_STATEMENT', 'CORRECTION'].includes(event.event_type)),
    'ATHLETE_RSL_TARGET_NOT_ACTIVE');
    if (['ATHLETE_STATEMENT', 'CORRECTION'].includes(input.type)) {
      const matches = input.state.messages.filter(message => message.id === input.sourceMessage?.id);
      requireThat(matches.length === 1 && same(matches[0], input.sourceMessage), 'ATHLETE_RSL_SOURCE_MESSAGE_INVALID');
    } else if (input.type === 'APPROVED_LEARNING') {
      const item = input.state.learning?.find(item => item.id === input.sourceId);
      requireThat(item?.actorId === scope.actor_id && item.speaker === 'athlete'
        && item.text === input.text && item.approved_at === input.recordedAt, 'MAIN_RSL_LEARNING_APPROVAL_REQUIRED');
    } else if (input.type === 'ACCEPTED_PLAN') {
      requireThat(input.state.plan && same(acceptedPlan(input.state.plan, scope), acceptedPlan(input.plan, scope)),
        'ATHLETE_RSL_PLAN_NOT_ACCEPTED');
    }
    return core.createRslEvent({ ...input, scope, authority: input.authorityName });
  }
  function validateRslSources(input) { return core.validateRslSources(context(input)); }
  function replayRsl(input) { const ctx = context(input); core.validateRslSources(ctx); return core.replayRsl(ctx); }
  function retrieveRslContext(input) {
    const ctx = context(input); core.validateRslSources(ctx);
    const result = core.retrieveRslContext({ ...ctx, ...(input.maxItems === undefined ? {} : { maxItems: input.maxItems }),
      ...(input.maxChars === undefined ? {} : { maxChars: input.maxChars }), queryText: input.queryText || '' });
    const targets = core.retrieveRslCorrectionTargets(ctx);
    return deepFreeze({ ...result, correction_targets_receipt: {
      contract: 'athlete_academy_rsl_correction_targets_receipt_v1', scope_hash: targets.scope_hash,
      source_watermark: targets.source_watermark, target_count: targets.items.length,
      omitted_count: targets.omitted_count } });
  }
  function retrieveRslCorrectionTargets(input) {
    const ctx = context(input); core.validateRslSources(ctx);
    return core.retrieveRslCorrectionTargets({ ...ctx, ...(input.maxItems === undefined ? {} : { maxItems: input.maxItems }),
      ...(input.maxChars === undefined ? {} : { maxChars: input.maxChars }) });
  }
  function currentApprovalSnapshot(input) {
    owner(input);
    requireThat(input.state, 'MAIN_RSL_STATE_SOURCE_MISMATCH');
    const scope = createRslScope(input), learning = input.state.learning ?? [];
    requireThat(Array.isArray(learning) && learning.length <= 512, 'ATHLETE_RSL_INPUT_INVALID');
    return deepFreeze({
      approved_learning: learning.filter(item => item?.actorId === scope.actor_id
        && item.speaker === 'athlete' && !item.capture && text(item.id, 160)
        && text(item.text) && isCanonicalTimestamp(item.approved_at))
        .map(({ id, text: approvedText, approved_at, actorId }) => ({ id, text: approvedText,
          approved_at, actorId, authority: 'ATHLETE_LEARNING_CONFIRMATION' })),
      accepted_plan: input.state.plan == null ? null : acceptedPlan(input.state.plan, scope),
    });
  }
  // Current approved snapshot only, not fabricated historic chat/coach events.
  // Unknown actor-less legacy learning is left preserved, never promoted here.
  function deriveRslEvents(input) {
    fence(input, 'derive');
    const { scope } = context(input), events = [];
    for (const item of input.state.learning || []) {
      if (item?.actorId !== scope.actor_id || item.speaker !== 'athlete'
        || !text(item.id, 160) || !text(item.text) || !isCanonicalTimestamp(item.approved_at)) continue;
      events.push(createRslEvent({ ...input, scope, type: 'APPROVED_LEARNING', sourceId: item.id,
        recordedAt: item.approved_at, text: item.text, authorityName: 'ATHLETE_LEARNING_CONFIRMATION' }));
    }
    if (input.state.plan) events.push(createRslEvent({ ...input, scope, type: 'ACCEPTED_PLAN',
      sourceId: input.state.plan.id, recordedAt: input.state.plan.accepted_at, plan: input.state.plan,
      authorityName: 'PROTECTED_PLAN_APPROVAL' }));
    requireThat(events.length <= 512, 'ATHLETE_RSL_TOO_MANY_EVENTS');
    return deepFreeze(events.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at) || a.event_id.localeCompare(b.event_id)));
  }
  return Object.freeze({ createRslScope, createRslEvent, deriveRslEvents, replayRsl,
    validateRslSources, retrieveRslContext, retrieveRslCorrectionTargets, currentApprovalSnapshot });
}
