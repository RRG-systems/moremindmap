import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const SUBSCRIBER_INTENTS = Object.freeze(['ORIENT_ME', 'WHAT_CHANGED', 'WHY_DID_IT_CHANGE', 'UPDATE_MY_BUSINESS', 'COMPLETE_WEEKLY_EVIDENCE', 'REVIEW_FIVE_FUTURES', 'REVIEW_ONE_MOVE', 'REPORT_EXECUTION', 'REPORT_OUTCOME', 'ASK_COACH_CONTEXT', 'CORRECT_PRIOR_INFORMATION', 'UNKNOWN_REQUIRES_CLARIFICATION']);
export const EXPLANATION_DEPTHS = Object.freeze(['CONCISE', 'STANDARD', 'ADVANCED', 'AUDIT']);

function scopeKey(value) { return `${value?.tenant_id}:${value?.business_id}:${value?.profile_id}`; }

export function validateConversationRequest(request) {
  const errors = [];
  for (const key of ['request_id', 'session_id', 'turn_id', 'tenant_id', 'business_id', 'profile_id', 'statement']) if (typeof request?.[key] !== 'string' || !request[key]) errors.push({ code: 'REQUIRED', field: key });
  if (request?.referenced_contexts?.some((item) => scopeKey(item) !== scopeKey(request))) errors.push({ code: 'CROSS_SCOPE_REFERENCE_DENIED' });
  if (request?.privacy_class === 'COACH_PRIVATE') errors.push({ code: 'COACH_PRIVATE_SUBSCRIBER_REQUEST_DENIED' });
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function resolveSubscriberIntent(request) {
  const text = String(request?.statement || '').toLowerCase();
  const rules = [
    ['CORRECT_PRIOR_INFORMATION', /correct|that was wrong|change my prior/], ['REPORT_OUTCOME', /outcome|result|worked|failed/],
    ['REPORT_EXECUTION', /executed|completed|did the move|started/], ['REVIEW_ONE_MOVE', /one move|recommendation/],
    ['REVIEW_FIVE_FUTURES', /five futures|future|trajectory/], ['COMPLETE_WEEKLY_EVIDENCE', /weekly|kpi|evidence|update numbers/],
    ['WHY_DID_IT_CHANGE', /why.*change/], ['WHAT_CHANGED', /what changed/], ['UPDATE_MY_BUSINESS', /update my business|new revenue|new contacts/],
    ['ASK_COACH_CONTEXT', /coach/], ['ORIENT_ME', /orient|where.*start|what matters/],
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || 'UNKNOWN_REQUIRES_CLARIFICATION';
}

export function planSubscriberResponse(request) {
  const validation = validateConversationRequest(request);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'INVALID_CONVERSATION_REQUEST', errors: validation.errors });
  const intent = SUBSCRIBER_INTENTS.includes(request.intent) ? request.intent : resolveSubscriberIntent(request);
  const mutationIntents = new Set(['UPDATE_MY_BUSINESS', 'REPORT_EXECUTION', 'REPORT_OUTCOME', 'CORRECT_PRIOR_INFORMATION']);
  const authorityAttempt = /authorize|approve and execute|do it for me/i.test(request.statement);
  const privateAttempt = intent === 'ASK_COACH_CONTEXT' || /private coach|coach notes/i.test(request.statement);
  const unsupportedCertainty = /guarantee|certain|prove|100%/i.test(request.statement);
  const plan = { response_plan_id: `response_${hashCanonicalJson({ request, intent }).slice(0, 20)}`, request_id: request.request_id, session_id: request.session_id,
    tenant_id: request.tenant_id, business_id: request.business_id, profile_id: request.profile_id, intent,
    direct_answer: intent === 'UNKNOWN_REQUIRES_CLARIFICATION' ? null : 'REFERENCE_SUMMARY_REQUIRED',
    evidence_request: ['COMPLETE_WEEKLY_EVIDENCE', 'UPDATE_MY_BUSINESS'].includes(intent), proposed_extraction: mutationIntents.has(intent),
    confirmation_need: mutationIntents.has(intent) ? 'SUBSCRIBER_CONFIRMATION_REQUIRED' : 'NONE', state_update_eligibility: false,
    ui_references: [...(request.ui_context_refs || [])].sort(), uncertainty_disclosure: unsupportedCertainty || intent.includes('FUTURE') ? 'UNCALIBRATED_OR_UNCERTAIN' : 'STANDARD',
    next_best_prompt: intent === 'UNKNOWN_REQUIRES_CLARIFICATION' ? 'Please clarify whether you want to review state, provide evidence, inspect futures, or review One Move.' : 'Confirm the requested next step.',
    authority_warning: authorityAttempt ? 'HUMAN_AUTHORIZATION_REQUIRED_NO_AUTONOMOUS_ACTION' : null,
    private_content_exclusion: privateAttempt ? 'COACH_PRIVATE_CONTENT_EXCLUDED' : 'PRIVATE_BY_DEFAULT', escalation_requirement: authorityAttempt || privateAttempt,
    explanation_depth: EXPLANATION_DEPTHS.includes(request.explanation_depth) ? request.explanation_depth : 'STANDARD' };
  return deepFreeze({ ok: true, plan, rendered: renderSubscriberResponsePlan(plan) });
}

export function renderSubscriberResponsePlan(plan) {
  return deepFreeze({ heading: plan.intent === 'UNKNOWN_REQUIRES_CLARIFICATION' ? 'Clarification needed' : 'Subscriber intelligence response',
    message_codes: [plan.direct_answer, plan.confirmation_need, plan.uncertainty_disclosure, plan.authority_warning, plan.private_content_exclusion].filter(Boolean),
    next_prompt: plan.next_best_prompt });
}
