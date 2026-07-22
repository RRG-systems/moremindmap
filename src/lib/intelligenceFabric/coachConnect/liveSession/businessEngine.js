import { deepFreeze } from '../../validation.js';
import { liveSessionSemanticHash, validateBusinessEngineProposal, validateSubscriberConfirmationRequest } from './contracts.js';

export function buildConfidenceRealityUpdate({ artifact, now }) {
  return deepFreeze({ update_id: `confidence_${liveSessionSemanticHash(artifact.artifact_id).slice(0, 24)}`, session_id: artifact.session_id, source_artifact_id: artifact.artifact_id, destination_class: 'COACHING_NOTES', claim_reference: artifact.content_reference, confidence: Math.min(artifact.confidence, 0.25), conflicts: artifact.conflicts, missing_evidence: artifact.artifact_type === 'MISSING_EVIDENCE', privacy_class: artifact.privacy_class, subscriber_scope: artifact.subscriber_scope, canonical_authority: false, universal_learning_eligible: false, created_at: now });
}

export function buildBusinessEngineProposal({ artifact, business_engine, reason_for_change, now }) {
  if (!business_engine?.business_engine_id || !Number.isInteger(business_engine.version)) return deepFreeze({ ok: false, code: 'BUSINESS_ENGINE_REQUIRED' });
  const proposal = { proposal_id: `proposal_${liveSessionSemanticHash({ artifact: artifact.artifact_id, version: business_engine.version }).slice(0, 24)}`, session_id: artifact.session_id, business_engine_id: business_engine.business_engine_id, source_artifact_id: artifact.artifact_id, base_business_engine_version: business_engine.version, proposed_changes: [{ path: 'confidence_reality.coaching_notes', operation: 'APPEND_REFERENCE', value_reference: artifact.content_reference }], unchanged_fields: ['five_futures.probabilities', 'one_move.canonical_selection'], conflict_analysis: artifact.conflicts, confidence_delta: Math.min(artifact.confidence, 0.25), reason_for_change, required_confirmations: ['SUBSCRIBER'], decision_status: 'PENDING', status: 'DRAFT', subscriber_scope: artifact.subscriber_scope, privacy_class: 'BUSINESS_ENGINE_ELIGIBLE', schema_version: '1.0.0', policy_version: artifact.policy_version, canonical_authority: false, created_at: now };
  const validation = validateBusinessEngineProposal(proposal); return deepFreeze(validation.valid ? { ok: true, proposal } : { ok: false, code: 'INVALID_BUSINESS_ENGINE_PROPOSAL', errors: validation.errors });
}

export function evaluateBusinessEngineProposal({ proposal, current_business_engine, now }) {
  if (proposal.base_business_engine_version !== current_business_engine.version) return deepFreeze({ ok: false, code: 'STALE_PROPOSAL_REEVALUATION_REQUIRED', proposal: { ...proposal, status: 'DEFERRED', decision_status: 'STALE', evaluated_at: now } });
  return deepFreeze({ ok: true, proposal: { ...proposal, status: 'CONFIRMATION_REQUIRED', decision_status: 'CONFIRMATION_REQUIRED', evaluation: { conflict_count: proposal.conflict_analysis.length, behavioral_fit: 'REQUIRES_SUBSCRIBER_JUDGMENT', primary_constraint_effect: 'PROPOSAL_ONLY', five_futures_effect: 'RECOMPUTE_AFTER_CANONICAL_APPEND', one_move_effect: 'REEVALUATE_AFTER_CANONICAL_APPEND' }, evaluated_at: now } });
}

export function createSubscriberConfirmation({ proposal, now }) {
  const confirmation = { confirmation_id: `confirmation_${liveSessionSemanticHash(proposal.proposal_id).slice(0, 24)}`, proposal_id: proposal.proposal_id, exact_change_reference: proposal.proposed_changes[0].value_reference, plain_language_explanation: 'A reviewed coach observation is proposed as a coaching note for Business Engine evaluation.', source_attribution: proposal.source_artifact_id, accept_consequence: 'The governed proposal may advance after evidence and outcome validation.', reject_consequence: 'No canonical Business Engine change occurs.', expiration_policy: 'EXPLICIT_NO_RESPONSE_IS_NON_ACCEPTANCE', response_state: 'PENDING', response_actor_id: null, responded_at: null, subscriber_scope: proposal.subscriber_scope, privacy_class: 'SUBSCRIBER_PRIVATE', schema_version: '1.0.0', policy_version: proposal.policy_version, created_at: now };
  const validation = validateSubscriberConfirmationRequest(confirmation); return deepFreeze(validation.valid ? { ok: true, confirmation } : { ok: false, code: 'INVALID_CONFIRMATION_REQUEST', errors: validation.errors });
}

export function respondToConfirmation({ confirmation, response, subscriber_id, now }) {
  const states = { ACCEPT: 'ACCEPTED', REJECT: 'REJECTED', CLARIFY: 'CLARIFIED', DEFER: 'DEFERRED' }; if (confirmation.response_state !== 'PENDING' || !states[response]) return deepFreeze({ ok: false, code: 'INVALID_CONFIRMATION_RESPONSE' });
  if (subscriber_id !== confirmation.subscriber_scope.subscriber_id) return deepFreeze({ ok: false, code: 'SUBSCRIBER_CONFIRMATION_ACTOR_REQUIRED' });
  return deepFreeze({ ok: true, confirmation: { ...confirmation, response_state: states[response], response_actor_id: subscriber_id, responded_at: now } });
}

export function promoteConfirmedProposal({ proposal, confirmation, evidence_references, outcome_references, current_business_engine, canonicalAppend, idempotency_key, now }) {
  if (confirmation?.response_state !== 'ACCEPTED' || confirmation.proposal_id !== proposal.proposal_id) return deepFreeze({ ok: false, code: 'SUBSCRIBER_CONFIRMATION_REQUIRED' });
  if (!evidence_references?.length || !outcome_references?.length) return deepFreeze({ ok: false, code: 'EVIDENCE_AND_OUTCOME_REQUIRED' });
  if (proposal.base_business_engine_version !== current_business_engine.version) return deepFreeze({ ok: false, code: 'STALE_PROPOSAL_REEVALUATION_REQUIRED' });
  if (typeof canonicalAppend !== 'function') return deepFreeze({ ok: false, code: 'CANONICAL_APPEND_BOUNDARY_REQUIRED' });
  const event = { event_id: `live_promotion_${liveSessionSemanticHash({ proposal: proposal.proposal_id, idempotency_key }).slice(0, 24)}`, business_engine_id: current_business_engine.business_engine_id, expected_version: current_business_engine.version, source_proposal_id: proposal.proposal_id, confirmation_id: confirmation.confirmation_id, evidence_references, outcome_references, confirmation_status: 'CONFIRMED_AS_PROPOSED', idempotency_key, occurred_at: now, canonical_authority: 'INJECTED_BUSINESS_ENGINE_RUNTIME' };
  const appended = canonicalAppend(event); if (!appended?.ok) return deepFreeze({ ok: false, code: appended?.code || 'CANONICAL_APPEND_FAILED' });
  return deepFreeze({ ok: true, promotion: { promotion_record_id: `promotion_${proposal.proposal_id}`, source_state: 'SUBSCRIBER_CONFIRMED', destination_state: 'CANONICAL_BUSINESS_STATE', authority_basis: confirmation.confirmation_id, evidence_basis: evidence_references, outcome_basis: outcome_references, policy_version: proposal.policy_version, actor: confirmation.response_actor_id, timestamp: now, canonical_event_reference: appended.event_id, previous_business_engine_version: current_business_engine.version, new_business_engine_version: appended.new_version, universal_learning_eligible: false } });
}
