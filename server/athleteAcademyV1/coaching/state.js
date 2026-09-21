import { randomUUID } from 'node:crypto';
import { initial, validatePlan, validateOutput, applyLocalAction, applyOutput, draft as legacyDraft } from '../../athleteConsultingV2/state.js';
import { assertOwner, assertPrincipal, hash, requireThat, validateCanonicalCoachBundle } from './bundle.js';

const now = () => new Date().toISOString();
const own = (bundle, principal) => principal.role === 'athlete' && principal.actorId === bundle.binding.actorId;
const ownerActions = new Set(['feedback', 'remember', 'forget', 'finish', 'continue']);
const sameBinding = (state, bundle) => {
  validateCanonicalCoachBundle(bundle);
  requireThat(state.mm === bundle.person.mm && hash(state.sourceBinding) === hash(bundle.binding), 'COACH_STATE_SOURCE_MISMATCH');
};
const planBody = (plan) => ({ title: plan.title, why: plan.why, steps: plan.steps, review: plan.review });
const event = (state, type, data, actorId) => state.events.push({ type, ...structuredClone(data), actorId, at: now() });

export function initialCoachState(bundle) {
  validateCanonicalCoachBundle(bundle);
  return { ...initial(bundle), academyVersion: 1, sourceBinding: structuredClone(bundle.binding),
    sessionId: randomUUID(), sessionArchive: [], sharedPlan: null, sharedDraft: null, sharing: null };
}

function sharedAuthority(state, bundle, principal) {
  assertPrincipal(bundle, principal);
  const coachId = principal.sharedCoachActorId;
  requireThat(principal.grants?.sharedPlan === true && typeof coachId === 'string' && coachId.trim()
    && coachId !== bundle.binding.actorId && state.sharing?.active === true
    && state.sharing.coachActorId === coachId && state.sharing.athleteActorId === bundle.binding.actorId
    && (own(bundle, principal) || (principal.role === 'coach' && principal.actorId === coachId)), 'COACH_SHARED_ACCESS_DENIED');
}

function draftPlan(state, plan, visibility, principal, source = 'manual') {
  validatePlan(plan);
  const field = visibility === 'shared' ? 'sharedDraft' : 'draft';
  if (state[field]) event(state, 'draft_superseded', { visibility, draft: state[field] }, principal.actorId);
  const body = structuredClone(planBody(plan));
  state[field] = { ...body, id: randomUUID(), hash: hash(body), approvals: [], source,
    visibility, proposedBy: principal.actorId, proposedAt: now(),
    ...(visibility === 'shared' ? { athleteActorId: state.sharing.athleteActorId, coachActorId: state.sharing.coachActorId } : {}) };
}

function approvePlan(state, command, bundle, principal) {
  const shared = command.visibility === 'shared';
  if (shared) sharedAuthority(state, bundle, principal); else assertOwner(bundle, principal);
  const field = shared ? 'sharedDraft' : 'draft';
  const proposal = state[field];
  requireThat(proposal && command.id === proposal.id && command.hash === proposal.hash
    && hash(planBody(proposal)) === proposal.hash, 'PLAN_CHANGED_REVIEW_LATEST');
  const needs = shared
    ? [proposal.athleteActorId, ...(proposal.steps.some((step) => step.owner === 'coach') ? [proposal.coachActorId] : [])]
    : [bundle.binding.actorId];
  requireThat(shared || !proposal.steps.some((step) => step.owner === 'coach'), 'SHARED_PLAN_REVIEW_REQUIRED');
  requireThat(needs.includes(principal.actorId), 'ATHLETE_APPROVAL_REQUIRED');
  const approvals = proposal.approvals.filter((entry) => entry.hash === proposal.hash);
  if (!approvals.some((entry) => entry.actorId === principal.actorId)) approvals.push({ actorId: principal.actorId, hash: proposal.hash, at: now() });
  proposal.approvals = approvals;
  if (needs.every((id) => approvals.some((entry) => entry.actorId === id))) {
    const target = shared ? 'sharedPlan' : 'plan';
    event(state, 'plan_replaced', { visibility: shared ? 'shared' : 'private', previous: state[target] }, principal.actorId);
    state[target] = { ...proposal, accepted_at: now() };
    state[field] = null;
  }
}

// Input state is never mutated. The durable caller owns revision/CAS/idempotency.
// Actor, speaker and relationship authority come only from the authenticated principal.
export function applyActorAction(state, command, bundle, principal) {
  sameBinding(state, bundle);
  assertPrincipal(bundle, principal);
  requireThat(command && typeof command === 'object' && !Array.isArray(command), 'COACH_COMMAND_INVALID');
  requireThat(!['actor', 'actorId', 'speaker', 'subjectActorId', 'mm', 'coachActorId'].some((key) => Object.hasOwn(command, key)), 'COACH_ACTOR_SPOOF_DENIED');
  if (command.revision !== undefined) requireThat(command.revision === state.revision, 'STATE_CHANGED_RELOAD');
  requireThat(state.status !== 'working', 'COACH_OPERATION_PENDING');
  const next = structuredClone(state);
  if (['start', 'message', 'close'].includes(command.action)) {
    assertOwner(bundle, principal);
    const task = command.action === 'start' ? 'OPENING' : command.action === 'close' ? 'CLOSE' : 'CHAT';
    requireThat(task === 'OPENING' ? ['ready', 'closed'].includes(next.status) : ['active', 'review'].includes(next.status), 'SESSION_STATE_CHANGED');
    if (task === 'CHAT') {
      requireThat(typeof command.text === 'string' && command.text.trim() && command.text.length <= 10000, 'MESSAGE_REQUIRED');
      next.messages.push({ id: randomUUID(), role: 'user', speaker: 'athlete', actorId: principal.actorId,
        text: command.text.trim(), at: now(), sessionId: next.sessionId });
      if (next.status === 'review') { next.status = 'active'; next.closing = null; }
    }
    next.speaker = 'athlete';
    next.view = ['home', 'you', 'sport', 'plan'].includes(command.view) ? command.view : next.view;
    next.beforeWorking = next.status;
    next.status = 'working';
    next.pendingTask = task;
  } else if (command.action === 'approve') approvePlan(next, command, bundle, principal);
  else if (command.action === 'draft') {
    if (command.visibility === 'shared') sharedAuthority(next, bundle, principal); else assertOwner(bundle, principal);
    draftPlan(next, command.plan, command.visibility, principal);
  } else if (command.action === 'share_draft') {
    assertOwner(bundle, principal);
    requireThat(principal.grants?.sharedPlan === true && typeof principal.sharedCoachActorId === 'string'
      && principal.sharedCoachActorId.trim() && principal.sharedCoachActorId !== principal.actorId, 'COACH_SHARED_ACCESS_DENIED');
    requireThat(next.draft && command.id === next.draft.id && command.hash === next.draft.hash, 'PLAN_CHANGED_REVIEW_LATEST');
    next.sharing = { active: true, athleteActorId: principal.actorId, coachActorId: principal.sharedCoachActorId, confirmedAt: now() };
    draftPlan(next, next.draft, 'shared', principal, 'explicit_athlete_share');
    event(next, 'private_draft_shared', { draft: next.draft, sharedDraftId: next.sharedDraft.id }, principal.actorId);
    next.draft = null;
  } else if (command.action === 'revoke_share') {
    assertOwner(bundle, principal);
    event(next, 'shared_access_revoked', { sharing: next.sharing, sharedPlan: next.sharedPlan, sharedDraft: next.sharedDraft }, principal.actorId);
    if (next.sharing) next.sharing.active = false;
    // Preserve history and accepted commitments; re-sharing requires a new proposal.
    next.sharedDraft = null;
  } else if (command.action === 'discard') {
    const shared = command.visibility === 'shared';
    if (shared) sharedAuthority(next, bundle, principal); else assertOwner(bundle, principal);
    const field = shared ? 'sharedDraft' : 'draft';
    requireThat(next[field]?.id === command.id && next[field]?.hash === command.hash, 'PLAN_CHANGED_REVIEW_LATEST');
    event(next, 'draft_declined', { visibility: shared ? 'shared' : 'private', draft: next[field] }, principal.actorId);
    next[field] = null;
  } else if (command.action === 'reset') {
    assertOwner(bundle, principal);
    // A new session is not deletion. Full prior messages/plans/learning remain in state
    // and the root durable store additionally archives the pre-transition envelope.
    next.sessionArchive.push({ sessionId: next.sessionId, at: now(), status: next.status,
      fromMessage: next.sessionStart ?? 0, throughMessage: next.messages.length,
      closing: next.closing, draft: next.draft });
    event(next, 'new_session', { previousSessionId: next.sessionId }, principal.actorId);
    next.sessionId = randomUUID();
    next.sessionStart = next.messages.length;
    next.status = 'ready'; next.opening = null; next.closing = null; next.lastError = null;
    next.draft = null; next.suggestedLearning = [];
  } else if (ownerActions.has(command.action)) {
    assertOwner(bundle, principal);
    const learningBefore = new Set(next.learning.map((item) => item.id));
    applyLocalAction(next, command, bundle);
    for (const item of next.learning) if (!learningBefore.has(item.id)) item.actorId = principal.actorId;
    if (command.action === 'feedback') next.feedback.at(-1).actorId = principal.actorId;
  } else throw new Error('UNKNOWN_ACTION');
  return next;
}

export function applyCoachOutput(state, output, task, bundle, principal) {
  sameBinding(state, bundle); assertOwner(bundle, principal); validateOutput(output);
  requireThat(['OPENING', 'CHAT', 'CLOSE'].includes(task) && state.status === 'working'
    && state.pendingTask === task, 'COACH_OPERATION_MISMATCH');
  const next = structuredClone(state);
  next.status = next.beforeWorking;
  delete next.beforeWorking; delete next.pendingTask;
  applyOutput(next, output, task);
  if (output.plan && task === 'CHAT') {
    // A model proposal is private. Coach-owned actions need explicit share + actual
    // separate confirmation; the model cannot turn conversation into authority.
    const proposed = next.draft;
    next.draft = { ...proposed, visibility: 'private', proposedBy: principal.actorId, approvals: [] };
  }
  next.messages.at(-1).sessionId = next.sessionId;
  return next;
}

export function coachStateForPrincipal(state, bundle, principal) {
  sameBinding(state, bundle); assertPrincipal(bundle, principal);
  if (own(bundle, principal)) { assertOwner(bundle, principal); return structuredClone(state); }
  sharedAuthority(state, bundle, principal);
  return structuredClone({ mm: state.mm, revision: state.revision, visibility: 'shared',
    sharedPlan: state.sharedPlan?.coachActorId === principal.actorId ? state.sharedPlan : null,
    sharedDraft: state.sharedDraft?.coachActorId === principal.actorId ? state.sharedDraft : null });
}

export function failCoachTask(state, bundle, principal, code = 'COACH_OUTCOME_UNKNOWN') {
  sameBinding(state, bundle); assertOwner(bundle, principal);
  requireThat(state.status === 'working', 'COACH_OPERATION_MISMATCH');
  const next = structuredClone(state);
  next.status = next.beforeWorking;
  event(next, 'coach_failed', { task: next.pendingTask, code: /^[A-Z_]+$/u.test(code) ? code : 'COACH_REQUEST_FAILED' }, principal.actorId);
  next.lastError = 'MORE could not finish this response. Your message, conversation and saved plan are safe.';
  delete next.beforeWorking; delete next.pendingTask;
  return next;
}

// Named export makes the preserved source semantics explicit without a mutation API.
export const SOURCE_PLAN_RULES = Object.freeze({ validatePlan, draft: legacyDraft });
