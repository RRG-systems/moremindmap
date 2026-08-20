import { canonicalHash, isSha256 } from '../wholeBusinessModelV1/canonical.js';
import {
  FIVE_FUTURES_V2_CONTRACT_ID,
  FIVE_FUTURES_V2_CONTRACT_VERSION,
  FIVE_FUTURES_V2_SCHEMA_VERSION,
  FUTURE_ROLES,
  FUTURE_RUNTIME_BOUNDARIES,
  LEGACY_COEXISTENCE,
  NORMALIZATION_VERSION,
  SUPPORT_COMPONENTS,
  SUPPORT_SEMANTICS,
  WEIGHTING_MODEL_VERSION,
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

export function validateFiveFuturesV2(artifact, wbmBinding) {
  integrity(artifact?.contract_id === FIVE_FUTURES_V2_CONTRACT_ID, 'MALFORMED_FUTURE_OBJECT', 'Wrong Five Futures contract_id');
  integrity(artifact.contract_version === FIVE_FUTURES_V2_CONTRACT_VERSION, 'MALFORMED_FUTURE_OBJECT', 'Wrong Five Futures contract_version');
  integrity(artifact.schema_version === FIVE_FUTURES_V2_SCHEMA_VERSION, 'MALFORMED_FUTURE_OBJECT', 'Wrong Five Futures schema_version');
  integrity(artifact.business_id === wbmBinding.business_id && artifact.owner_profile_id === wbmBinding.owner_profile_id, 'WRONG_BUSINESS_PROFILE', 'Five Futures identity binding drifted');
  integrity(canonicalHash(artifact.whole_business_model_binding) === canonicalHash(wbmBinding), 'WBM_HASH_VERSION_CORRUPTION', 'Five Futures WBM binding drifted');
  integrity(isSha256(artifact.whole_business_model_binding.whole_business_model_hash), 'WBM_HASH_VERSION_CORRUPTION', 'Five Futures requires WBM SHA-256');
  integrity(artifact.support_semantics === SUPPORT_SEMANTICS, 'MALFORMED_FUTURE_OBJECT', 'Support semantics must remain uncalibrated relative support');
  integrity(Array.isArray(artifact.futures) && artifact.futures.length === 5, 'MALFORMED_FUTURE_OBJECT', 'Exactly five finalized futures are required');
  const weights = [];
  artifact.futures.forEach((future, index) => {
    integrity(future.future_role === FUTURE_ROLES[index], 'MALFORMED_FUTURE_OBJECT', `Final role/order mismatch at ${index}`);
    integrity(Number.isInteger(future.raw_relative_support_score) && future.raw_relative_support_score >= 0, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} raw score is invalid`);
    integrity(Number.isInteger(future.normalized_relative_support_weight) && future.normalized_relative_support_weight >= 0, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} normalized weight is invalid`);
    integrity(future.weighting_model_version === WEIGHTING_MODEL_VERSION, 'MISSING_WEIGHTING_MODEL_VERSION', `${future.future_role} weighting version drifted`);
    integrity(future.support_semantics === SUPPORT_SEMANTICS, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} support semantics drifted`);
    integrity(future.whole_business_model_version === wbmBinding.whole_business_model_state_version, 'WBM_HASH_VERSION_CORRUPTION', `${future.future_role} WBM state version drifted`);
    integrity(future.whole_business_model_hash === wbmBinding.whole_business_model_hash, 'WBM_HASH_VERSION_CORRUPTION', `${future.future_role} WBM hash drifted`);
    integrity(canonicalHash(future.authority_versions) === canonicalHash(wbmBinding.authority_hashes), 'AUTHORITY_CORRUPTION', `${future.future_role} authority hashes drifted`);
    integrity(Array.isArray(future.support_components) && future.support_components.length === SUPPORT_COMPONENTS.length, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} support components incomplete`);
    const raw = future.support_components.reduce((sum, component, componentIndex) => {
      const spec = SUPPORT_COMPONENTS[componentIndex];
      integrity(component.component_id === spec.component_id, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} component order drifted`);
      integrity(spec.levels[component.level] === component.contribution, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} component contribution drifted`);
      return sum + component.contribution;
    }, 0);
    integrity(raw === future.raw_relative_support_score, 'MALFORMED_FUTURE_OBJECT', `${future.future_role} raw support total drifted`);
    weights.push(future.normalized_relative_support_weight);
  });
  integrity(weights.reduce((sum, value) => sum + value, 0) === 100, 'NORMALIZED_TOTAL_NOT_100', 'Five normalized weights must total exactly 100');
  integrity(artifact.normalization?.normalization_version === NORMALIZATION_VERSION, 'MALFORMED_FUTURE_OBJECT', 'Normalization version drifted');
  integrity(artifact.normalization?.tie_break === 'FIXED_FUTURE_ROLE_ORDER', 'MALFORMED_FUTURE_OBJECT', 'Tie behavior drifted');
  integrity(canonicalHash(artifact.authority_versions) === canonicalHash(wbmBinding.authority_hashes), 'AUTHORITY_CORRUPTION', 'Envelope authority hashes drifted');
  integrity(canonicalHash(artifact.legacy_coexistence) === canonicalHash(LEGACY_COEXISTENCE), 'MALFORMED_FUTURE_OBJECT', 'Legacy coexistence contract drifted');
  integrity(canonicalHash(artifact.runtime_boundaries) === canonicalHash(FUTURE_RUNTIME_BOUNDARIES), 'UNAUTHORIZED_PRODUCTION_MUTATION', 'Five Futures runtime boundaries drifted');
  walk(artifact, (key, value, trail) => {
    if (/calibrated_probability|actuarial_probability|bayesian|monte_carlo|pomdp|mdp/iu.test(key)) {
      integrity(value === false || value === null, 'MALFORMED_FUTURE_OBJECT', `Scientific-honesty violation at ${trail.join('.')}`);
    }
    integrity(!['customer_prose', 'customer_cards', 'one_move', 'executive_diagnostic'].includes(key), 'MALFORMED_FUTURE_OBJECT', `Prohibited projection field at ${trail.join('.')}`);
  });
  const receipt = {
    validator_version: 'five-futures-v2-validator-v1',
    status: 'PASS',
    business_id: artifact.business_id,
    whole_business_model_hash: wbmBinding.whole_business_model_hash,
    future_count: artifact.futures.length,
    normalized_total: 100,
    support_semantics: SUPPORT_SEMANTICS,
    weighting_model_version: WEIGHTING_MODEL_VERSION,
    one_move_v2_implemented: false,
    customer_ui_implemented: false,
  };
  receipt.receipt_hash = canonicalHash(receipt);
  return Object.freeze(receipt);
}
