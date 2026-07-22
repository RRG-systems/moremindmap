import { buildDurableObject } from '../durableCore.js';
import { OBJECT_AUTHORITY, OBJECT_TRUTH_CLASS } from '../durableCoreConstants.js';
import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

const band = (score) => score >= .75 ? 'HIGH' : score >= .45 ? 'MODERATE' : score > 0 ? 'LOW' : 'INSUFFICIENT';
const clamp = (n) => Math.max(0, Math.min(1, n));

export function rankEvidenceGaps(gaps) {
  const tier = { BLOCKING: 4, HIGH: 3, MEDIUM: 2, LOW: 1, POLICY_REQUIRED: 3, CONTEXT_STALE: 2, CURRENT: 3, STALE: 2 };
  const burden = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  return deepFreeze([...gaps].filter((x) => !['DECLINED', 'UNAVAILABLE'].includes(x.status)).sort((a, b) =>
    (tier[b.priority] || 0) - (tier[a.priority] || 0) || (tier[b.current_state_impact] || 0) - (tier[a.current_state_impact] || 0)
    || (b.expected_confidence_gain || 0) - (a.expected_confidence_gain || 0) || (tier[b.staleness_urgency] || 0) - (tier[a.staleness_urgency] || 0)
    || (burden[a.privacy_burden] || 0) - (burden[b.privacy_burden] || 0) || (burden[a.collection_cost] || 0) - (burden[b.collection_cost] || 0)
    || a.evidence_gap_id.localeCompare(b.evidence_gap_id)));
}

export function updateBeliefState(input) {
  if (!input?.tenant_id || !input?.business_engine_state || !input?.as_of_at || !input?.provenance) return deepFreeze({ ok: false, status: 'INVALID_INPUT' });
  const previous = input.prior_belief_state?.beliefs || [], observations = input.observations || [];
  const ids = new Set([...previous.map((x) => x.belief_id), ...observations.map((x) => x.belief_id)]);
  const beliefs = [...ids].sort().map((id) => {
    const prior = previous.find((x) => x.belief_id === id), obs = observations.filter((x) => x.belief_id === id);
    const support = [...new Set([...(prior?.supporting_evidence_ids || []), ...obs.filter((x) => x.direction === 'SUPPORT').map((x) => x.evidence_id)])];
    const contradiction = [...new Set([...(prior?.contradicting_evidence_ids || []), ...obs.filter((x) => x.direction === 'CONTRADICT').map((x) => x.evidence_id)])];
    const delta = obs.reduce((sum, x) => sum + (x.direction === 'SUPPORT' ? (x.weight || .05) : x.direction === 'CONTRADICT' ? -(x.weight || .05) : 0), 0);
    const probability = clamp((prior?.probability ?? .5) + delta), changed = Math.abs(delta) > 1e-12;
    const suspended = input.conflict_ids?.length > 0 && input.suspend_on_conflict === true;
    const confidenceScore = clamp((support.length + contradiction.length ? support.length / (support.length + contradiction.length) : 0) * (suspended ? .5 : 1));
    return { belief_id: id, claim: prior?.claim || obs[0]?.claim || 'Synthetic uncertain business interpretation.', claim_type: prior?.claim_type || obs[0]?.claim_type || 'CONSTRAINT_HYPOTHESIS',
      scope: { business_id: input.business_engine_state.business_id }, probability, confidence_band: band(confidenceScore), confidence_score: confidenceScore,
      supporting_evidence_ids: support, contradicting_evidence_ids: contradiction, authority_positions: input.authority_positions || [], knowledge_claim_ids: input.knowledge_claim_ids || [],
      market_context_ids: input.market_context_ids || [], human_judgment_ids: input.human_judgment_ids || [], outcome_ids: input.outcome_ids || [], conflict_ids: input.conflict_ids || [],
      causal_hypothesis: null, alternative_hypotheses: input.alternative_hypotheses || [], validation_level: suspended ? 'SUSPENDED' : 'HYPOTHESIS',
      last_changed_at: changed ? input.as_of_at : prior?.last_changed_at || input.as_of_at, change_reason: changed ? (delta > 0 ? 'SUPPORTING_EVIDENCE' : 'CONTRADICTING_EVIDENCE') : null,
      non_change_reason: changed ? null : 'NO_QUALIFYING_EVIDENCE', next_best_evidence: input.ranked_gaps?.[0]?.missing_data?.[0] || 'NO_GAP_IDENTIFIED',
      evidence_gap_ids: (input.ranked_gaps || []).map((x) => x.evidence_gap_id), status: suspended ? 'SUSPENDED' : 'ACTIVE', provenance: input.provenance,
      explicit_uncertainty: support.length === 0 };
  });
  const seed = hashCanonicalJson({ tenant: input.tenant_id, state: input.business_engine_state.business_engine_state_id, beliefs }).slice(0, 16), version = (input.prior_belief_state?.version || 0) + 1;
  const object = { object_type: 'BeliefState', contract_version: '1.0.0', schema_version: '1.0.0', object_id: `belief_state_${seed}`,
    belief_state_id: `belief_state_${seed}`, tenant_id: input.tenant_id, profile_id: input.profile_id, business_id: input.business_engine_state.business_id,
    organization_id: null, subscription_id: input.subscription_id ?? null, authority_type: OBJECT_AUTHORITY.BeliefState, truth_class: OBJECT_TRUTH_CLASS.BeliefState,
    status: 'ACTIVE', created_at: input.as_of_at, updated_at: input.as_of_at, effective_at: input.as_of_at, expires_at: null,
    source_event_ids: input.source_event_ids || [], provenance: input.provenance, privacy_classification: 'TENANT_PRIVATE', consent_record_ids: input.consent_record_ids || [],
    version, previous_version_id: input.prior_belief_state?.belief_state_id || null, supersedes_id: null, validation_state: 'VALIDATED', beliefs };
  const built = buildDurableObject('BeliefState', object); if (!built.validation.valid) return deepFreeze({ ok: false, status: 'BELIEF_VALIDATION_FAILED', errors: built.validation.errors });
  return deepFreeze({ ok: true, status: 'UPDATED', belief_state: built.value, output_hash: hashCanonicalJson(built.value) });
}
