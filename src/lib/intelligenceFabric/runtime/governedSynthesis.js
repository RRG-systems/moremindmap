import { AUTHORITY_TYPES, PRIVACY_CLASSIFICATIONS } from '../constants.js';
import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

const ROUTES = Object.freeze({
  DIRECTION: ['USER_DIRECTION', 'PRIVATE_HUMAN_JUDGMENT', 'USER_EVIDENCE', 'DOMAIN_KNOWLEDGE'],
  PREFERENCE: ['USER_DIRECTION', 'PRIVATE_HUMAN_JUDGMENT', 'DOMAIN_KNOWLEDGE'],
  CONSENT_BOUNDARY: ['USER_DIRECTION', 'GOVERNANCE_CONFLICT'],
  OBSERVATION: ['USER_EVIDENCE', 'PRIVATE_HUMAN_JUDGMENT', 'DOMAIN_KNOWLEDGE', 'MARKET_CONTEXT'],
  MEASUREMENT: ['USER_EVIDENCE', 'DOMAIN_KNOWLEDGE', 'MARKET_CONTEXT'],
  CORRECTION: ['USER_EVIDENCE', 'GOVERNANCE_CONFLICT'], COMPLETION: ['USER_EVIDENCE', 'INTERVENTION_OUTCOME'],
  BENCHMARK: ['DOMAIN_KNOWLEDGE', 'MARKET_CONTEXT'], MECHANIC: ['DOMAIN_KNOWLEDGE'],
  DETERMINISTIC_RULE: ['DOMAIN_KNOWLEDGE', 'GOVERNANCE_CONFLICT'], MARKET_FACT: ['MARKET_CONTEXT', 'DOMAIN_KNOWLEDGE'],
  BEHAVIORAL_INTERPRETATION: ['USER_EVIDENCE', 'PRIVATE_HUMAN_JUDGMENT', 'DOMAIN_KNOWLEDGE', 'GOVERNANCE_CONFLICT'],
  CONSTRAINT_HYPOTHESIS: ['USER_EVIDENCE', 'PRIVATE_HUMAN_JUDGMENT', 'DOMAIN_KNOWLEDGE', 'MARKET_CONTEXT', 'GOVERNANCE_CONFLICT'],
  CAUSAL_HYPOTHESIS: ['INTERVENTION_OUTCOME', 'USER_EVIDENCE', 'MARKET_CONTEXT', 'GOVERNANCE_CONFLICT'],
  OUTCOME_ATTRIBUTION: ['INTERVENTION_OUTCOME', 'USER_EVIDENCE', 'MARKET_CONTEXT', 'GOVERNANCE_CONFLICT'],
  INTERVENTION_RECOMMENDATION: ['INTERVENTION_OUTCOME', 'UNIVERSAL_COACHING', 'DOMAIN_KNOWLEDGE', 'MARKET_CONTEXT', 'USER_DIRECTION'],
  HUMAN_RECOMMENDATION: ['PRIVATE_HUMAN_JUDGMENT', 'USER_DIRECTION'],
  REUSABLE_LEARNING: ['GOVERNANCE_CONFLICT', 'INTERVENTION_OUTCOME', 'UNIVERSAL_COACHING', 'DOMAIN_KNOWLEDGE'],
  POLICY_DECISION: ['GOVERNANCE_CONFLICT', 'DOMAIN_KNOWLEDGE'],
});
const DOMINANT = Object.freeze({ DIRECTION: 'USER_DIRECTION', PREFERENCE: 'USER_DIRECTION', CONSENT_BOUNDARY: 'USER_DIRECTION',
  OBSERVATION: 'USER_EVIDENCE', MEASUREMENT: 'USER_EVIDENCE', CORRECTION: 'USER_EVIDENCE', COMPLETION: 'USER_EVIDENCE',
  BENCHMARK: 'DOMAIN_KNOWLEDGE', MECHANIC: 'DOMAIN_KNOWLEDGE', DETERMINISTIC_RULE: 'DOMAIN_KNOWLEDGE', MARKET_FACT: 'MARKET_CONTEXT',
  BEHAVIORAL_INTERPRETATION: 'GOVERNANCE_CONFLICT', CONSTRAINT_HYPOTHESIS: 'GOVERNANCE_CONFLICT',
  CAUSAL_HYPOTHESIS: 'INTERVENTION_OUTCOME', OUTCOME_ATTRIBUTION: 'INTERVENTION_OUTCOME',
  INTERVENTION_RECOMMENDATION: 'INTERVENTION_OUTCOME', HUMAN_RECOMMENDATION: 'PRIVATE_HUMAN_JUDGMENT',
  REUSABLE_LEARNING: 'GOVERNANCE_CONFLICT', POLICY_DECISION: 'GOVERNANCE_CONFLICT' });
const OUT_OF_SCOPE = new Set(['FUTURE_HYPOTHESIS', 'PROBABILITY_ESTIMATE', 'COUNTERFACTUAL']);
const PRIVATE = new Set(['USER_PRIVATE', 'COACH_SESSION_PRIVATE', 'RESTRICTED_PERSONAL', 'RESTRICTED_FINANCIAL', 'RESTRICTED_BEHAVIORAL', 'RESTRICTED_OUTCOME']);

function consentEligible(candidate, request) {
  const c = candidate.consent_record;
  if (!c) return 'CONSENT_MISSING';
  if (c.status !== 'ACTIVE') return 'CONSENT_INACTIVE';
  if (c.tenant_id !== request.tenant_id) return 'TENANT_MISMATCH';
  if (c.purpose !== request.purpose) return 'CONSENT_PURPOSE_MISMATCH';
  if (!Array.isArray(c.scope) || !c.scope.includes(request.scope)) return 'CONSENT_SCOPE_MISMATCH';
  const at = Date.parse(request.as_of_at);
  if (c.effective_at && Date.parse(c.effective_at) > at) return 'CONSENT_INACTIVE';
  if (c.expires_at && Date.parse(c.expires_at) <= at) return 'CONSENT_INACTIVE';
  if (c.revoked_at && Date.parse(c.revoked_at) <= at) return 'CONSENT_INACTIVE';
  return null;
}

function materialConflict(candidates) {
  const values = candidates.filter((x) => x.asserted_value != null).map((x) => JSON.stringify(x.asserted_value));
  return new Set(values).size > 1;
}

export function routeSynthesis(request) {
  const claimType = request?.claim_type;
  if (!request?.tenant_id || !claimType || !ROUTES[claimType] || OUT_OF_SCOPE.has(claimType)) return deepFreeze({ ok: false, decision: 'DENY', bundle: null,
    receipt: { claim_type: claimType || 'UNKNOWN', decision: 'DENY', reason_codes: [OUT_OF_SCOPE.has(claimType) ? 'CLAIM_OUT_OF_SCOPE' : 'UNKNOWN_OR_AMBIGUOUS_CLAIM'], included_ids: [], excluded: [] } });
  const eligibleAuthorities = ROUTES[claimType], included = [], excluded = [];
  for (const candidate of [...(request.candidates || [])].sort((a, b) => String(a.candidate_id).localeCompare(String(b.candidate_id)))) {
    let reason = null;
    if (candidate.tenant_id !== request.tenant_id) reason = 'TENANT_MISMATCH';
    else if (!AUTHORITY_TYPES.includes(candidate.authority_type) || !eligibleAuthorities.includes(candidate.authority_type)) reason = 'AUTHORITY_INELIGIBLE';
    else if (!PRIVACY_CLASSIFICATIONS.includes(candidate.privacy_classification)) reason = 'PRIVACY_INELIGIBLE';
    else if (candidate.provenance_valid !== true) reason = 'INVALID_PROVENANCE';
    else if (candidate.applicable === false) reason = 'JURISDICTION_MISMATCH';
    else if (candidate.expires_at && Date.parse(candidate.expires_at) <= Date.parse(request.as_of_at)) reason = 'STALE';
    else if (PRIVATE.has(candidate.privacy_classification)) {
      reason = consentEligible(candidate, request);
      if (!reason && candidate.authority_type === 'PRIVATE_HUMAN_JUDGMENT' && candidate.relationship_authorized !== true) reason = 'RELATIONSHIP_INACTIVE';
      if (!reason && request.universal_use === true) reason = 'PRIVACY_INELIGIBLE';
    }
    if (reason) excluded.push({ authority_type: candidate.authority_type || 'UNKNOWN', reason });
    else included.push(deepFreeze({ candidate_id: candidate.candidate_id, authority_type: candidate.authority_type,
      position_id: candidate.position_id, asserted_value: candidate.asserted_value, source_ids: candidate.source_ids || [],
      privacy_classification: candidate.privacy_classification }));
  }
  const conflict = materialConflict(included), reviewCodes = [];
  if (conflict) reviewCodes.push('HIGH_IMPACT_CONFLICT');
  if (['CAUSAL_HYPOTHESIS', 'OUTCOME_ATTRIBUTION', 'REUSABLE_LEARNING', 'POLICY_DECISION'].includes(claimType)) reviewCodes.push(claimType === 'REUSABLE_LEARNING' ? 'PROMOTION_REQUEST' : claimType === 'POLICY_DECISION' ? 'POLICY_EXCEPTION' : 'CAUSAL_CLAIM');
  const decision = included.length === 0 ? 'DENY' : reviewCodes.length ? 'ALLOW_WITH_REVIEW' : 'ALLOW';
  const conflictRecord = conflict ? { conflict_id: `conflict_${hashCanonicalJson(included.map((x) => [x.position_id, x.asserted_value])).slice(0, 16)}`,
    conflict_type: 'MATERIAL_AUTHORITY_DISAGREEMENT', authority_positions: included.map((x) => ({ position_id: x.position_id, authority_type: x.authority_type })), status: 'OPEN', human_review_required: true } : null;
  const bundle = decision === 'DENY' ? null : { claim_type: claimType, dominant_authority: DOMINANT[claimType],
    positions: included, conflict: conflictRecord, human_review_required: reviewCodes.length > 0 };
  const receipt = { receipt_version: '1.0.0', request_id: request.request_id, claim_type: claimType,
    decision, route_version: 'governed-synthesis-v1', dominant_authority: DOMINANT[claimType],
    included_ids: included.map((x) => x.candidate_id), excluded, review_codes: reviewCodes,
    no_fixed_weights: true, model_used: 'NO_MODEL_USED' };
  return deepFreeze({ ok: decision !== 'DENY', decision, bundle: bundle ? deepFreeze(bundle) : null,
    receipt: deepFreeze({ ...receipt, receipt_hash: hashCanonicalJson(receipt) }) });
}

export const GOVERNED_SYNTHESIS_ROUTES = ROUTES;
