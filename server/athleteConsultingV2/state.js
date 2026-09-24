import { randomUUID, createHash } from 'node:crypto';

// The Founder-locked state rules, with complete boundary validation before mutation.
export const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const requireThat = (value, message) => { if (!value) throw new Error(message); };
export const initial = (bundle) => ({ version: 2, mm: bundle.person.mm, revision: 0, status: 'ready', speaker: 'athlete', view: 'home', messages: [], opening: null, plan: null, draft: null, learning: [], feedback: [], suggestedLearning: [], sessions: [], events: [], closing: null, lastError: null, processed: [] });
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string';

// This projection is limited to reviewed Coach Alex captures for the selected
// synthetic DarrenDemo athlete. Existing v2 states need no migration.
export function pendingCoachNoteIds(state, bundle) {
  const person = bundle?.person;
  if (person?.synthetic !== true || !['nia', 'sofia'].includes(person.slug)
    || bundle.bos?.synthetic !== true || bundle.apa?.synthetic !== true
    || state.mm !== person.mm || bundle.bos.mm !== person.mm
    || bundle.apa.mm !== person.mm) return [];
  const delivered = new Set((state.events || [])
    .filter((event) => event.type === 'coach_note_opened')
    .flatMap((event) => event.note_ids || []));
  return (state.messages || [])
    .filter((message) => message.capture?.contract === 'athlete_capture_demo_v1'
      && message.capture?.bridge === 'darren_demo_same_scope_v1'
      && message.capture?.channel === 'coach_connect_box04_v1'
      && message.capture?.reviewed === true
      && message.capture?.kind === 'text'
      && Array.isArray(message.capture?.attachments)
      && message.capture.attachments.length === 0
      && message.capture?.subject === person.slug
      && message.capture?.role === 'coach'
      && message.capture?.source === 'Coach Alex (synthetic)'
      && !delivered.has(message.id))
    .map((message) => message.id);
}

// Authenticated UI receives delivery metadata only. Note text remains in its
// already-protected source message and is not copied into this projection.
export function coachNoteHandoffStatus(state, bundle) {
  const ids = pendingCoachNoteIds(state, bundle);
  const last = (state.events || []).filter((event) => event.type === 'coach_note_opened').at(-1);
  return { pending_count: ids.length, pending_ids: ids,
    last_opening: last ? { at: last.at, note_ids: last.note_ids, request_id: last.request_id } : null };
}

export function validatePlan(plan) {
  requireThat(object(plan) && text(plan.title) && plan.title.trim()
    && text(plan.why) && text(plan.review) && Array.isArray(plan.steps)
    && plan.steps.length > 0 && plan.steps.length <= 8, 'INVALID_PLAN');
  requireThat(plan.steps.every((step) => object(step) && text(step.action) && step.action.trim()
    && text(step.when) && text(step.notice) && ['athlete', 'coach'].includes(step.owner)), 'INVALID_PLAN');
  return plan;
}

export function validateOutput(output) {
  requireThat(object(output) && text(output.reply) && output.reply.trim() && output.reply.length <= 20000
    && ['none', 'replace', 'add'].includes(output.plan_change) && typeof output.retire_draft === 'boolean'
    && Array.isArray(output.learning) && output.learning.every(text) && text(output.recap)
    && (output.plan === null || object(output.plan)), 'COACH_RESPONSE_INVALID');
  if (output.plan) validatePlan(output.plan);
  return output;
}

export function note(state, message) {
  state.messages.push({ id: randomUUID(), role: 'system', text: message, at: new Date().toISOString() });
}

export function draft(state, plan, source = 'conversation') {
  validatePlan(plan);
  if (state.draft) state.events.push({ type: 'draft_superseded', draft: state.draft, at: new Date().toISOString() });
  const proposed = structuredClone(plan);
  state.draft = { ...proposed, id: randomUUID(), hash: hash(proposed), approvals: [], source };
}

export function applyOutput(state, output, task) {
  validateOutput(output);
  const next = structuredClone(state);
  if (output.retire_draft && next.draft) { next.events.push({ type: 'draft_declined', draft: next.draft }); next.draft = null; }
  if (output.plan && task === 'CHAT') draft(next, output.plan);
  if (output.learning.length) next.suggestedLearning = [...new Set(output.learning)].slice(0, 4);
  next.messages.push({ id: randomUUID(), role: 'assistant', text: output.reply, at: new Date().toISOString() });
  if (task === 'OPENING') { next.opening = output.reply; next.status = 'active'; next.sessionStart = next.messages.length - 1; }
  if (task === 'CLOSE') { next.closing = { id: randomUUID(), summary: output.reply, continuity: output.recap }; next.status = 'review'; }
  next.lastError = null;
  Object.assign(state, next);
}

export function approve(state, body) {
  requireThat(state.draft && body.id === state.draft.id && body.hash === state.draft.hash, 'PLAN_CHANGED_REVIEW_LATEST');
  requireThat(['athlete', 'coach'].includes(body.actor), 'CHOOSE_SPEAKER');
  const needs = ['athlete', ...(state.draft.steps.some((step) => step.owner === 'coach') ? ['coach'] : [])];
  requireThat(needs.includes(body.actor), 'ATHLETE_APPROVAL_REQUIRED');
  state.draft.approvals = [...new Set([...state.draft.approvals, body.actor])];
  if (needs.every((actor) => state.draft.approvals.includes(actor))) {
    state.events.push({ type: 'plan_replaced', previous: state.plan });
    state.plan = { ...state.draft, accepted_at: new Date().toISOString() };
    state.draft = null;
    note(state, 'The people responsible confirmed the exact displayed plan. It is now saved as the current plan: ' + JSON.stringify(state.plan));
  }
}

export function applyLocalAction(state, body, bundle) {
  if (body.action === 'approve') approve(state, body);
  else if (body.action === 'draft') { draft(state, body.plan, 'manual'); note(state, 'A proposed plan was prepared for review; it is not approved: ' + JSON.stringify(state.draft)); }
  else if (body.action === 'discard') {
    requireThat(state.draft?.id === body.id, 'PLAN_CHANGED_REVIEW_LATEST');
    state.events.push({ type: 'draft_declined', draft: state.draft }); state.draft = null;
    note(state, 'The pending draft was declined. The accepted plan is unchanged.');
  } else if (body.action === 'feedback') {
    requireThat(body.report_hash === bundle.bos.artifact_sha256
      && ['portrait', ...bundle.bos.reading.chapters.map((chapter) => chapter.id)].includes(body.section)
      && ['fits', 'partly', 'misses'].includes(body.choice) && text(body.comment) && body.comment.length <= 2000, 'INVALID_FEEDBACK');
    state.feedback.push({ id: randomUUID(), section: body.section, choice: body.choice, comment: body.comment, report_hash: body.report_hash, at: new Date().toISOString() });
  } else if (body.action === 'remember') {
    requireThat(Array.isArray(body.items) && body.items.every((item) => state.suggestedLearning.includes(item)), 'LEARNING_CHANGED');
    state.learning.push(...body.items.map((item) => ({ id: randomUUID(), text: item, approved_at: new Date().toISOString(), speaker: 'athlete' })));
    state.suggestedLearning = state.suggestedLearning.filter((item) => !body.items.includes(item));
    note(state, 'The athlete approved this coaching preference or correction: ' + body.items.join(' '));
  } else if (body.action === 'forget') {
    requireThat(state.learning.some((item) => item.id === body.id), 'LEARNING_CHANGED');
    state.events.push({ type: 'learning_removed', item: state.learning.find((item) => item.id === body.id) });
    state.learning = state.learning.filter((item) => item.id !== body.id);
    note(state, 'A previously saved preference was removed. Use the current approved-learning list.');
  } else if (body.action === 'finish') {
    requireThat(['active', 'review', 'closed'].includes(state.status), 'NO_ACTIVE_SESSION');
    if (state.status !== 'closed') {
      if (body.remember !== undefined) requireThat(Array.isArray(body.remember), 'LEARNING_CHANGED');
      if (body.remember?.length) {
        requireThat(body.remember.every((item) => state.suggestedLearning.includes(item)), 'LEARNING_CHANGED');
        state.learning.push(...body.remember.map((item) => ({ id: randomUUID(), text: item, approved_at: new Date().toISOString(), speaker: 'athlete' })));
        state.suggestedLearning = state.suggestedLearning.filter((item) => !body.remember.includes(item));
      }
      state.sessions.push({ at: new Date().toISOString(), summary: state.closing?.summary || 'Session ended without a closing recap.', plan: state.plan, unapproved_draft: state.draft?.title || null });
      state.status = 'closed';
      note(state, 'Session finished. Ending did not approve any draft or suggested learning.');
      state.closing = null;
    }
  } else if (body.action === 'continue') {
    requireThat(state.status === 'review', 'NO_CLOSING_REVIEW'); state.closing = null; state.status = 'active';
  } else throw new Error('UNKNOWN_ACTION');
}
