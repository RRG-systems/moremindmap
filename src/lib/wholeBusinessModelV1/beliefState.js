import { canonicalHash, clone, unique } from './canonical.js';
import { integrity } from './errors.js';

function mapById(values, idField) {
  return new Map(values.map((value) => [value[idField], value]));
}

function classifyChanges(previousValues, nextValues, idField) {
  const previous = mapById(previousValues || [], idField);
  const next = mapById(nextValues || [], idField);
  const ids = unique([...previous.keys(), ...next.keys()]);
  return ids.map((id) => {
    if (!previous.has(id)) return { id, status: 'NEW' };
    if (!next.has(id)) return { id, status: 'RESOLVED_OR_REMOVED' };
    return {
      id,
      status: canonicalHash(previous.get(id)) === canonicalHash(next.get(id)) ? 'UNCHANGED' : 'CHANGED',
    };
  });
}

export function finalizeWholeBusinessState(model, validationReceipt) {
  const finalized = clone(model);
  finalized.validation_receipt = validationReceipt;
  finalized.state_hash = canonicalHash({ ...finalized, state_hash: undefined });
  return Object.freeze(finalized);
}

export function buildBeliefStateTransition(previousState, nextStateDraft) {
  integrity(previousState?.state_hash, 'LINEAGE_CORRUPTION', 'Previous WBM state requires state_hash');
  integrity(previousState.assessment_identity.business_id === nextStateDraft.assessment_identity.business_id, 'WRONG_SUBJECT', 'Belief-state transition cannot change business');
  integrity(previousState.assessment_identity.owner_profile_id === nextStateDraft.assessment_identity.owner_profile_id, 'WRONG_SUBJECT', 'Belief-state transition cannot change owner');
  const expectedVersion = previousState.state_lineage.state_version + 1;
  integrity(nextStateDraft.state_lineage.state_version === expectedVersion, 'LINEAGE_CORRUPTION', `Next state_version must be ${expectedVersion}`);
  integrity(nextStateDraft.state_lineage.prior_state?.state_hash === previousState.state_hash, 'LINEAGE_CORRUPTION', 'Next state must bind prior state hash');
  return Object.freeze({
    transition_contract: 'whole-business-belief-state-transition-v1',
    business_id: previousState.assessment_identity.business_id,
    from_state_version: previousState.state_lineage.state_version,
    to_state_version: nextStateDraft.state_lineage.state_version,
    prior_state_hash: previousState.state_hash,
    domain_changes: classifyChanges(previousState.domain_states, nextStateDraft.domain_states, 'domain_id'),
    mechanism_changes: classifyChanges(previousState.causal_model.mechanisms, nextStateDraft.causal_model.mechanisms, 'mechanism_id'),
    contradiction_changes: classifyChanges(previousState.epistemic_state.contradictions, nextStateDraft.epistemic_state.contradictions, 'contradiction_id'),
    support_movement: classifyChanges(previousState.epistemic_state.claim_support, nextStateDraft.epistemic_state.claim_support, 'claim_id'),
  });
}
