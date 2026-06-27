import { leadershipBuildMap } from '../../src/data/leadershipBuildMap.js';
import { darrenBusinessModelBackbone, evaluateDarrenBusinessModelPathCoverage } from '../../src/data/darrenBusinessModelBackbone.js';

const NOT_ENOUGH_EVIDENCE = 'not enough saved evidence yet';
const NOT_INDEXED = 'not currently indexed';
const PEOPLE_REALITY_BOUNDARY = "Darren build uses Darren's behavioral operating style only. Employee/team/org personality layers are future organizational intelligence, not part of this current Darren dashboard.";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return String(value).trim().length > 0;
}

function safeText(value, fallback = NOT_ENOUGH_EVIDENCE, maxLength = 260) {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, maxLength);
}

function normalizeRealityStatus(value) {
  const normalized = String(value || '').toLowerCase();
  if (['thin', 'emerging', 'strong'].includes(normalized)) return normalized;
  return 'unknown';
}

function evidenceStrength(value) {
  const normalized = String(value || '').toLowerCase();
  if (['strong', 'validated'].includes(normalized)) return 'strong';
  if (['weak', 'early', 'moderate', 'invalidated'].includes(normalized)) return 'emerging';
  return 'thin';
}

function unavailableIncludes(snapshot, pattern) {
  return asArray(snapshot?.unavailable_fields).some((item) => pattern.test(String(item || '')));
}

function buildCurrentOperatingStateCompact({ snapshot, strategy, pathCoverage } = {}) {
  const oneMove = strategy?.one_move || {};
  const generatedProofTargets = asArray(strategy?.next_proof_targets);
  const snapshotProofTargets = asArray(snapshot?.next_proof_targets);
  const generatedGaps = asArray(strategy?.evidence_gaps);
  const snapshotGaps = asArray(snapshot?.evidence_gaps);
  const activePath = pathCoverage?.current_favored_path;
  const signalStrength = evidenceStrength(strategy?.result_signal_strength);

  return {
    dominant_path: safeText(activePath?.title, NOT_ENOUGH_EVIDENCE, 160),
    current_one_move: safeText(oneMove.title || oneMove.summary || oneMove.exact_action, NOT_ENOUGH_EVIDENCE, 220),
    current_proof_target: safeText(oneMove.proof_target || generatedProofTargets[0] || snapshotProofTargets[0], NOT_ENOUGH_EVIDENCE, 260),
    evidence_strength: signalStrength,
    biggest_constraint: safeText(generatedGaps[0] || snapshotGaps[0], NOT_ENOUGH_EVIDENCE, 260),
    confidence_state: strategy?.strategy_id ? signalStrength : 'thin'
  };
}

function buildRealityCompletenessCompact({ snapshot, strategy, pathCoverage } = {}) {
  const dashboard = snapshot?.current_dashboard_context || {};
  const hasRevenueGap = unavailableIncludes(snapshot, /revenue|paid|stripe|subscription/i);
  const hasFinancialCounts = hasValue(dashboard.total_profiles) || hasValue(dashboard.total_business_assessments) || hasValue(dashboard.companies_represented);
  const hasOperatingStyle = hasValue(snapshot?.darren?.operating_mode);
  const hasStrategy = hasValue(strategy?.strategy_id);
  const hasLedgerSignal = hasValue(strategy?.result_signal_strength) && strategy.result_signal_strength !== 'none';
  const hasPaths = asArray(pathCoverage?.paths).length >= 9;
  const hasProofTargets = asArray(strategy?.next_proof_targets).length > 0 || asArray(snapshot?.next_proof_targets).length > 0;
  const hasEvidenceGaps = asArray(strategy?.evidence_gaps).length > 0 || asArray(snapshot?.evidence_gaps).length > 0;
  const hasBoundaries = asArray(strategy?.truth_boundaries).length > 0 || asArray(snapshot?.what_not_to_overclaim).length > 0;

  return {
    financial_reality_status: normalizeRealityStatus(!hasFinancialCounts ? 'thin' : hasRevenueGap ? 'emerging' : 'strong'),
    behavioral_reality_status: normalizeRealityStatus(hasOperatingStyle && hasStrategy ? 'strong' : hasOperatingStyle ? 'emerging' : 'thin'),
    business_model_alignment_status: normalizeRealityStatus(hasPaths ? 'strong' : 'thin'),
    constraint_reality_status: normalizeRealityStatus(hasProofTargets && hasEvidenceGaps && hasLedgerSignal ? 'strong' : hasProofTargets || hasEvidenceGaps ? 'emerging' : 'thin'),
    confidence_reality_status: normalizeRealityStatus(hasBoundaries && hasStrategy && hasLedgerSignal ? 'strong' : hasBoundaries ? 'emerging' : 'thin')
  };
}

function buildFinancialAdminSummaryCompact(snapshot) {
  const dashboard = snapshot?.current_dashboard_context || {};
  const paidIndexed = !unavailableIncludes(snapshot, /paid|free|promo/i);
  const revenueIndexed = !unavailableIncludes(snapshot, /revenue/i);
  const paymentIndexed = !unavailableIncludes(snapshot, /stripe|payment/i);
  const subscriptionIndexed = !unavailableIncludes(snapshot, /subscription/i);

  return {
    profile_count: Number.isFinite(Number(dashboard.total_profiles)) ? Number(dashboard.total_profiles) : null,
    business_assessment_count: Number.isFinite(Number(dashboard.total_business_assessments)) ? Number(dashboard.total_business_assessments) : null,
    company_adoption_summary: hasValue(dashboard.companies_represented)
      ? `${dashboard.companies_represented} normalized company group(s) represented in the admin sales view.`
      : NOT_ENOUGH_EVIDENCE,
    paid_free_promo_indexing_status: paidIndexed ? 'indexed_or_not_listed_as_missing' : NOT_INDEXED,
    revenue_indexing_status: revenueIndexed ? 'indexed_or_not_listed_as_missing' : NOT_INDEXED,
    payment_subscription_evidence_status: paymentIndexed && subscriptionIndexed ? 'indexed_or_not_listed_as_missing' : NOT_INDEXED
  };
}

function buildBusinessModelContextCompact({ snapshot, strategy, pathCoverage } = {}) {
  const channelPath = asArray(pathCoverage?.paths).find((path) => path.id === 'channel_growth');
  return {
    active_9_path_focus: safeText(pathCoverage?.current_favored_path?.title, NOT_ENOUGH_EVIDENCE, 160),
    known_paths: darrenBusinessModelBackbone.map((path) => path.short_label || path.title).filter(Boolean),
    current_channel_growth_emphasis: channelPath
      ? `${channelPath.status_band || 'unknown'}; Channel Growth is valid, but adoption proof still matters.`
      : 'unknown',
    scenario_lens_boundary: '$250M scenario is an ambition/path model, not a certain valuation outcome.',
    path_comparison_present: asArray(snapshot?.path_comparison?.paths).length > 0,
    generated_strategy_path_context_present: Boolean(strategy?.strategy_id)
  };
}

function buildConfidenceBoundaryCompact() {
  return {
    future_movement_boundary: 'Future movement requires accepted decisions and recorded proof. External or displayed context alone does not justify automatic future percentage movement.',
    live_vs_not_live_boundary: 'Displayed roadmap and unavailable-field context separates live dashboard capability from planned or not-yet-indexed capability.',
    strategy_replacement_boundary: "Adaptive drafts are pending review and do not replace Darren's active strategy automatically.",
    valuation_certainty_boundary: '$250M is a scenario lens and ambition/path model, not a proven or guaranteed outcome.',
    people_reality_boundary: PEOPLE_REALITY_BOUNDARY
  };
}

function buildRoadmapStatusCompact(snapshot) {
  const context = snapshot?.build_map_context || {};
  const live = asArray(context.live_now).map((item) => item.label || item.title).filter(Boolean);
  const planned = asArray(context.planned_next).map((item) => item.label || item.title).filter(Boolean);
  const future = asArray(context.future_phases).map((item) => item.label || item.title).filter(Boolean);

  return {
    live_capabilities_summary: live.length
      ? `Live: ${live.slice(0, 4).join(', ')}.`
      : `Live capabilities count: ${leadershipBuildMap.filter((phase) => phase.status === 'live').length}.`,
    not_yet_live_summary: planned.length || future.length
      ? `Not yet live or planned: ${[...planned, ...future].slice(0, 5).join(', ')}.`
      : 'No planned roadmap context available.',
    roadmap_context_summary: 'Use roadmap status only to prevent overclaiming. Do not treat planned phases as live capability.'
  };
}

export function buildDarrenDashboardContextCompact({ snapshot, strategy } = {}) {
  const pathCoverage = evaluateDarrenBusinessModelPathCoverage({ snapshot, generatedStrategy: strategy });
  return {
    context_version: 'darren_dashboard_context_compact_v1',
    context_weight: 'low_to_medium',
    privacy_boundary: 'Compact summary only. No full admin rows, private profile text, assessment response detail, secrets, tokens, or storage keys are included.',
    current_operating_state_compact: buildCurrentOperatingStateCompact({ snapshot, strategy, pathCoverage }),
    reality_completeness_compact: buildRealityCompletenessCompact({ snapshot, strategy, pathCoverage }),
    financial_admin_summary_compact: buildFinancialAdminSummaryCompact(snapshot),
    business_model_context_compact: buildBusinessModelContextCompact({ snapshot, strategy, pathCoverage }),
    confidence_boundary_compact: buildConfidenceBoundaryCompact(),
    roadmap_status_compact: buildRoadmapStatusCompact(snapshot)
  };
}
