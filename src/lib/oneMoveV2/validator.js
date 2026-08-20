import { canonicalHash, isSha256 } from '../wholeBusinessModelV1/canonical.js';
import {
  FUTURE_ROLES,
  ONE_MOVE_RUNTIME_BOUNDARIES,
  ONE_MOVE_SELECTION_MODEL_VERSION,
  ONE_MOVE_V2_CONTRACT_ID,
  ONE_MOVE_V2_CONTRACT_VERSION,
  ONE_MOVE_V2_SCHEMA_VERSION,
} from './constants.js';
import { integrity } from './errors.js';

function walk(value, callback, trail = []) {
  if (Array.isArray(value)) return value.forEach((entry, index) => walk(entry, callback, [...trail, index]));
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    callback(key, child, [...trail, key]);
    walk(child, callback, [...trail, key]);
  });
}

export function validateOneMoveV2(oneMove, context, selectionReceipt) {
  integrity(oneMove?.contract_id === ONE_MOVE_V2_CONTRACT_ID, 'MALFORMED_ONE_MOVE', 'Wrong One Move contract_id');
  integrity(oneMove.contract_version === ONE_MOVE_V2_CONTRACT_VERSION && oneMove.schema_version === ONE_MOVE_V2_SCHEMA_VERSION, 'MALFORMED_ONE_MOVE', 'One Move version drifted');
  integrity(oneMove.business_id === context.binding.business_id && oneMove.owner_profile_id === context.binding.owner_profile_id, 'WRONG_BUSINESS_PROFILE', 'One Move identity binding drifted');
  integrity(oneMove.whole_business_model_binding.hash === context.binding.whole_business_model_hash, 'WBM_HASH_VERSION_CORRUPTION', 'One Move WBM hash drifted');
  integrity(oneMove.five_futures_binding.hash === context.binding.five_futures_hash, 'FIVE_FUTURES_HASH_CORRUPTION', 'One Move Five Futures hash drifted');
  integrity(isSha256(oneMove.whole_business_model_binding.hash) && isSha256(oneMove.five_futures_binding.hash), 'HASH_CORRUPTION', 'One Move upstream hashes must be SHA-256');
  integrity(canonicalHash(oneMove.authority_versions.business_intelligence) === canonicalHash(context.binding.authority_hashes), 'AUTHORITY_CORRUPTION', 'One Move authority hashes drifted');
  integrity(oneMove.authority_versions.script_registry === context.binding.script_registry_hash && oneMove.authority_versions.script_library === context.binding.script_library_hash, 'AUTHORITY_CORRUPTION', 'One Move script hashes drifted');
  integrity(oneMove.governing_constraint_id === context.governing_constraint.constraint_id, 'UNBOUND_INTERVENTION', 'One Move governing constraint drifted');
  const mechanisms = new Set(context.causal_mechanisms.map((item) => item.mechanism_id));
  integrity(oneMove.primary_mechanism_ids.length > 0 && oneMove.primary_mechanism_ids.every((id) => mechanisms.has(id)), 'UNBOUND_INTERVENTION', 'One Move is not bound to a governed mechanism');
  integrity(oneMove.trajectory_effect_intent.map((item) => item.future_role).join('|') === FUTURE_ROLES.join('|'), 'MALFORMED_ONE_MOVE', 'One Move must relate to all five futures');
  integrity(oneMove.selection_model_version === ONE_MOVE_SELECTION_MODEL_VERSION, 'MALFORMED_ONE_MOVE', 'Selection model version drifted');
  integrity(selectionReceipt.selected_candidate_id === oneMove.provenance.selected_candidate_id, 'MALFORMED_ONE_MOVE', 'Selected candidate provenance drifted');
  integrity(selectionReceipt.receipt_hash === oneMove.selection_trace.selection_receipt_hash, 'MALFORMED_ONE_MOVE', 'Selection receipt hash drifted');
  integrity(oneMove.bounded_execution_steps.length >= 1 && oneMove.bounded_execution_steps.length <= 5, 'NOT_SINGULAR', 'One Move steps are not bounded');
  integrity(canonicalHash(oneMove.runtime_boundaries) === canonicalHash(ONE_MOVE_RUNTIME_BOUNDARIES), 'UNAUTHORIZED_PRODUCTION_MUTATION', 'One Move runtime boundary drifted');
  integrity(oneMove.observation_contract.tracking_or_subscription_implemented === false, 'UNAUTHORIZED_PRODUCTION_MUTATION', 'Observation contract may not implement tracking');
  integrity(oneMove.observation_contract.wbm_update_trigger && oneMove.observation_contract.five_futures_update_trigger, 'MALFORMED_ONE_MOVE', 'Observation contract requires downstream update triggers');
  walk(oneMove, (key, value, trail) => {
    if (/probability_movement|intervention_probability|calibrated_probability|bayesian|monte_carlo|pomdp|mdp/iu.test(key)) {
      integrity(value === false || value === null, 'FAKE_PROBABILITY_MOVEMENT', `Unsupported probability/model field at ${trail.join('.')}`);
    }
    integrity(!['customer_prose', 'customer_card', 'ui_copy', 'one_three_five', 'rsl_output'].includes(key), 'UNAUTHORIZED_PRODUCTION_MUTATION', `Prohibited downstream field at ${trail.join('.')}`);
  });
  const receipt = {
    validator_version: 'one-move-v2-validator-v1',
    status: 'PASS',
    business_id: oneMove.business_id,
    one_move_id: oneMove.one_move_id,
    whole_business_model_hash: oneMove.whole_business_model_binding.hash,
    five_futures_hash: oneMove.five_futures_binding.hash,
    governing_constraint_id: oneMove.governing_constraint_id,
    mechanism_count: oneMove.primary_mechanism_ids.length,
    trajectory_relationship_count: oneMove.trajectory_effect_intent.length,
    bounded_step_count: oneMove.bounded_execution_steps.length,
    probability_movement_claims: false,
    customer_realization_implemented: false,
    production_wired: false,
  };
  receipt.receipt_hash = canonicalHash(receipt);
  return Object.freeze(receipt);
}

