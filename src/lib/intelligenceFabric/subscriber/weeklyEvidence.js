import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const WEEKLY_EVIDENCE_POLICY_VERSION = 'weekly-evidence-reference-v1';
export const WEEKLY_COMPLETION_STATES = Object.freeze(['COMPLETE', 'COMPLETE_WITH_KNOWN_GAPS', 'BLOCKED', 'DEFERRED', 'NOT_DUE', 'PARTIAL', 'CONTRADICTORY', 'AWAITING_CONFIRMATION']);

export function prioritizeWeeklyEvidence(input) {
  if (!input?.tenant_id || !input.business_id || !input.profile_id || !input.cycle_window?.start || !input.cycle_window?.end) return deepFreeze({ ok: false, code: 'MALFORMED_WEEKLY_CYCLE' });
  if ((input.gaps || []).some((gap) => gap.tenant_id !== input.tenant_id || gap.business_id !== input.business_id || gap.profile_id !== input.profile_id)) return deepFreeze({ ok: false, code: 'CROSS_SCOPE_EVIDENCE_GAP_DENIED' });
  const ranked = (input.gaps || []).map((gap) => {
    const components = { one_move_relevance: gap.one_move_relevance || 0, constraint_relevance: gap.constraint_relevance || 0,
      confidence_impact: gap.confidence_impact || 0, trajectory_impact: gap.trajectory_impact || 0, staleness: gap.status === 'STALE' ? 1 : 0,
      contradiction_resolution: gap.status === 'CONTRADICTORY' ? 1 : 0, urgency: gap.urgency || 0, decision_relevance: gap.decision_relevance || 0,
      outcome_window_relevance: gap.outcome_window_relevance || 0, business_model_significance: gap.business_model_significance || 0,
      subscriber_burden: gap.subscriber_burden ?? .5 };
    const information_value = Object.entries(components).reduce((sum, [key, value]) => sum + (key === 'subscriber_burden' ? -value : value), 0);
    return { ...gap, components, expected_information_value: information_value, missing_is_negative_evidence: false };
  }).sort((a, b) => b.expected_information_value - a.expected_information_value || a.gap_id.localeCompare(b.gap_id));
  let completion_status = ranked.length ? 'PARTIAL' : 'COMPLETE';
  if (ranked.some((x) => x.status === 'CONTRADICTORY')) completion_status = 'CONTRADICTORY';
  else if (ranked.some((x) => x.confirmation_pending)) completion_status = 'AWAITING_CONFIRMATION';
  else if (ranked.length && ranked.every((x) => x.defer_reason)) completion_status = 'DEFERRED';
  else if (ranked.length && ranked.every((x) => x.unavailable_reason || x.not_applicable_reason)) completion_status = 'COMPLETE_WITH_KNOWN_GAPS';
  const result = { cycle_id: input.cycle_id || `cycle_${hashCanonicalJson({ scope: [input.tenant_id, input.business_id, input.profile_id], window: input.cycle_window }).slice(0, 20)}`,
    cycle_window: input.cycle_window, policy_version: WEEKLY_EVIDENCE_POLICY_VERSION, calibration_status: 'DETERMINISTIC_REFERENCE_NOT_CALIBRATED',
    completion_status, ranked_requests: ranked, next_minimal_request: ranked.find((x) => !x.defer_reason && !x.unavailable_reason && !x.not_applicable_reason) || null };
  return deepFreeze({ ok: true, ...result, priority_hash: hashCanonicalJson(result) });
}
