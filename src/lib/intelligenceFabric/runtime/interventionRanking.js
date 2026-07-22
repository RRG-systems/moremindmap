import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const INTERVENTION_RANKING_POLICY_VERSION = 'intervention-ranking-transparent-v1';
export const RANKING_DIMENSIONS = Object.freeze(['expected_leverage', 'probability_shift', 'constraint_centrality', 'user_goal_alignment', 'behavioral_fit', 'execution_feasibility', 'financial_feasibility', 'evidence_quality', 'outcome_support', 'time_to_signal', 'reversibility', 'downside_risk', 'privacy_compliance_burden', 'confidence']);
const WEIGHTS = Object.freeze({ expected_leverage: .13, probability_shift: .12, constraint_centrality: .12, user_goal_alignment: .1, behavioral_fit: .1,
  execution_feasibility: .11, financial_feasibility: .08, evidence_quality: .08, outcome_support: .05, time_to_signal: .04, reversibility: .03,
  downside_risk: -.02, privacy_compliance_burden: -.01, confidence: .07 });

function validDimensions(dimensions) { return RANKING_DIMENSIONS.every((key) => Number.isFinite(dimensions?.[key]) && dimensions[key] >= 0 && dimensions[key] <= 1); }
function score(dimensions, weights = WEIGHTS) { return RANKING_DIMENSIONS.reduce((sum, key) => sum + dimensions[key] * weights[key], 0); }

export function rankInterventionCandidates({ candidates, tenant_id, policy_version = INTERVENTION_RANKING_POLICY_VERSION, near_tie_threshold = .025, authority_conflict = false }) {
  if (!Array.isArray(candidates) || candidates.length < 2) return deepFreeze({ ok: false, code: 'MULTIPLE_CANDIDATES_REQUIRED' });
  const prepared = candidates.map((candidate) => {
    const stable_identity = candidate.stable_identity || `intervention_${hashCanonicalJson({ policy_version, template: candidate.template_id, target: candidate.target_constraint, transition: candidate.target_future_or_transition }).slice(0, 20)}`;
    const exclusions = [...(candidate.exclusions || [])];
    if (candidate.tenant_id !== tenant_id) exclusions.push('CROSS_TENANT_DENIED');
    if (!validDimensions(candidate.dimensions)) exclusions.push('INVALID_DIMENSION_VECTOR');
    if (candidate.financially_eligible === false) exclusions.push('FINANCIALLY_INFEASIBLE');
    if (candidate.operationally_eligible === false) exclusions.push('OPERATIONALLY_INFEASIBLE');
    if (candidate.user_rejected === true) exclusions.push('USER_REJECTED');
    return { ...candidate, stable_identity, dimensions: candidate.dimensions, exclusions: [...new Set(exclusions)].sort(),
      disposition: exclusions.length ? (candidate.user_rejected ? 'USER_REJECTED' : 'REJECTED') : 'ELIGIBLE', component_score: validDimensions(candidate.dimensions) ? score(candidate.dimensions) : null };
  });
  const eligible = prepared.filter((x) => x.disposition === 'ELIGIBLE').sort((a, b) => b.component_score - a.component_score || a.stable_identity.localeCompare(b.stable_identity));
  const nearTie = eligible.length > 1 && eligible[0].component_score - eligible[1].component_score <= near_tie_threshold;
  const human_review_required = authority_conflict || nearTie;
  const ranked = prepared.map((item) => ({ ...item, rank: item.disposition === 'ELIGIBLE' ? eligible.findIndex((x) => x.stable_identity === item.stable_identity) + 1 : null,
    selection_reason: item === eligible[0] && !human_review_required ? 'HIGHEST_ELIGIBLE_POLICY_VECTOR' : item.exclusions.length ? item.exclusions : ['LOWER_POLICY_VECTOR_OR_REVIEW'] }))
    .sort((a, b) => (a.rank || 999) - (b.rank || 999) || a.stable_identity.localeCompare(b.stable_identity));
  const sensitivity = Object.keys(WEIGHTS).map((removed) => {
    const reranked = eligible.map((item) => ({ id: item.stable_identity, score: score(item.dimensions, { ...WEIGHTS, [removed]: 0 }) })).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return { removed_dimension: removed, winner: reranked[0]?.id || null };
  });
  const receipt = { receipt_id: `ranking_${hashCanonicalJson({ ranked, policy_version, near_tie_threshold }).slice(0, 20)}`, policy_version, weights: WEIGHTS,
    dimension_order: RANKING_DIMENSIONS, tie_break: ['component_score_desc', 'stable_identity_asc'], near_tie_threshold, near_tie: nearTie,
    human_review_required, selected_candidate_id: human_review_required ? null : eligible[0]?.intervention_id || null, sensitivity };
  return deepFreeze({ ok: eligible.length > 0, candidates: ranked, selected: human_review_required ? null : eligible[0] || null, receipt });
}
