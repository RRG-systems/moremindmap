import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const ONE_MOVE_STATUSES = Object.freeze(['DRAFT', 'PROPOSED', 'UNDER_DISCUSSION', 'CHALLENGED', 'ALTERNATIVES_REQUESTED', 'ACCEPTED', 'REJECTED', 'DEFERRED', 'AUTHORIZED', 'IN_EXECUTION', 'PARTIALLY_EXECUTED', 'COMPLETED', 'ABANDONED', 'INVALIDATED', 'OUTCOME_WINDOW_OPEN', 'OUTCOME_WINDOW_CLOSED', 'VALIDATED_SUCCESS', 'VALIDATED_FAILURE', 'INCONCLUSIVE', 'SUPERSEDED', 'ARCHIVED']);
export const ONE_MOVE_TRANSITIONS = Object.freeze({
  DRAFT: ['PROPOSED'], PROPOSED: ['UNDER_DISCUSSION', 'CHALLENGED', 'ACCEPTED', 'REJECTED', 'DEFERRED'], UNDER_DISCUSSION: ['CHALLENGED', 'ALTERNATIVES_REQUESTED', 'ACCEPTED', 'REJECTED', 'DEFERRED'],
  CHALLENGED: ['UNDER_DISCUSSION', 'ALTERNATIVES_REQUESTED', 'REJECTED', 'DEFERRED'], ALTERNATIVES_REQUESTED: ['UNDER_DISCUSSION', 'ACCEPTED', 'REJECTED'],
  ACCEPTED: ['AUTHORIZED', 'REJECTED', 'DEFERRED'], AUTHORIZED: ['IN_EXECUTION', 'INVALIDATED', 'DEFERRED'], IN_EXECUTION: ['PARTIALLY_EXECUTED', 'COMPLETED', 'ABANDONED'],
  PARTIALLY_EXECUTED: ['IN_EXECUTION', 'COMPLETED', 'ABANDONED'], COMPLETED: ['OUTCOME_WINDOW_OPEN'], OUTCOME_WINDOW_OPEN: ['OUTCOME_WINDOW_CLOSED'],
  OUTCOME_WINDOW_CLOSED: ['VALIDATED_SUCCESS', 'VALIDATED_FAILURE', 'INCONCLUSIVE'], VALIDATED_SUCCESS: ['SUPERSEDED', 'ARCHIVED'], VALIDATED_FAILURE: ['SUPERSEDED', 'ARCHIVED'],
  INCONCLUSIVE: ['SUPERSEDED', 'ARCHIVED'], REJECTED: ['ARCHIVED'], DEFERRED: ['UNDER_DISCUSSION', 'SUPERSEDED', 'ARCHIVED'], ABANDONED: ['ARCHIVED'], INVALIDATED: ['ARCHIVED'], SUPERSEDED: ['ARCHIVED'], ARCHIVED: [],
});

export function createOneMove({ candidate, tenant_id, business_id, profile_id, as_of_at, explanation_trace_ref }) {
  if (!candidate || candidate.tenant_id !== tenant_id) return deepFreeze({ ok: false, code: 'CANDIDATE_SCOPE_DENIED' });
  const one_move_id = `one_move_${hashCanonicalJson({ tenant_id, business_id, profile_id, candidate: candidate.stable_identity || candidate.intervention_id }).slice(0, 20)}`;
  const value = { one_move_id, candidate_id: candidate.intervention_id, version: 1, status: 'DRAFT', tenant_id, business_id, profile_id,
    target_constraint: candidate.target_constraint, target_future_transition: candidate.target_future_or_transition,
    expected_probability_shift: candidate.expected_probability_shift, expected_business_effect: candidate.expected_downstream_effects,
    expected_signal_window: candidate.time_to_signal, expected_outcome_window: candidate.time_to_outcome,
    acceptance_record: null, challenge_record: null, alternative_review: null, authorization_record: null, execution_plan: null,
    execution_evidence_refs: [], outcome_evidence_refs: [], validation_status: 'NOT_EVALUATED', confidence_dimensions: candidate.dimensions, explanation_trace_ref,
    created_at: as_of_at, updated_at: as_of_at, previous_version_id: null };
  return deepFreeze({ ok: true, one_move: value, history: [value] });
}

export function transitionOneMove(current, { to_status, as_of_at, actor, record = null }) {
  if (!(ONE_MOVE_TRANSITIONS[current?.status] || []).includes(to_status)) return deepFreeze({ ok: false, code: 'INVALID_ONE_MOVE_TRANSITION', from_status: current?.status, to_status });
  if (to_status === 'AUTHORIZED' && (actor?.type !== 'HUMAN' || actor.tenant_id !== current.tenant_id || !record?.authorized_scope || record.revoked === true || (record.expires_at && record.expires_at < as_of_at))) return deepFreeze({ ok: false, code: 'HUMAN_AUTHORIZATION_REQUIRED' });
  if (to_status === 'IN_EXECUTION' && (!current.authorization_record || current.authorization_record.revoked === true || (current.authorization_record.expires_at && current.authorization_record.expires_at < as_of_at))) return deepFreeze({ ok: false, code: 'VALID_AUTHORIZATION_REQUIRED' });
  const version = current.version + 1;
  const event = { event_id: `one_move_event_${hashCanonicalJson({ id: current.one_move_id, version, to_status, as_of_at, actor: actor?.actor_ref || null }).slice(0, 20)}`,
    one_move_id: current.one_move_id, from_status: current.status, to_status, actor_type: actor?.type, actor_ref: actor?.actor_ref, occurred_at: as_of_at, record };
  const next = { ...current, version, status: to_status, previous_version_id: `${current.one_move_id}_v${current.version}`, updated_at: as_of_at,
    ...(to_status === 'AUTHORIZED' ? { authorization_record: { ...record, actor_ref: actor.actor_ref, authorized_at: as_of_at } } : {}),
    ...(to_status === 'ACCEPTED' ? { acceptance_record: record } : {}), ...(to_status === 'CHALLENGED' ? { challenge_record: record } : {}),
    ...(to_status === 'ALTERNATIVES_REQUESTED' ? { alternative_review: record } : {}) };
  return deepFreeze({ ok: true, one_move: next, event });
}
