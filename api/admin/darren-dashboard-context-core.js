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
    scenario_lens_boundary: '$250M scenario is an ambition/path model, not a proven company-value result.',
    path_comparison_present: asArray(snapshot?.path_comparison?.paths).length > 0,
    generated_strategy_path_context_present: Boolean(strategy?.strategy_id)
  };
}

function buildConfidenceBoundaryCompact() {
  return {
    future_movement_boundary: 'Future movement requires accepted decisions and recorded proof. External or displayed context alone does not justify changing future movement claims.',
    live_vs_not_live_boundary: 'Displayed roadmap and unavailable-field context separates live dashboard capability from planned or not-yet-indexed capability.',
    strategy_replacement_boundary: "Adaptive drafts are pending review and do not replace Darren's active strategy automatically.",
    valuation_certainty_boundary: '$250M is a scenario lens and ambition/path model, not a proven outcome.',
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

function panel(name, visibility, primaryPurpose, whatUserShouldDo, intelligenceRole, primaryReality) {
  return {
    panel_name: name,
    visibility_status: visibility,
    primary_purpose: primaryPurpose,
    what_user_should_do_with_it: whatUserShouldDo,
    intelligence_role: intelligenceRole,
    primary_reality: primaryReality
  };
}

function buildPanelMapCompact() {
  return [
    panel(
      'Strategy Chat',
      'top_visible',
      'Ask what changed, what to do next, what to say, and what not to overclaim.',
      'Use it first when you need a decision, talk track, proof target, or dashboard explanation.',
      'workflow_guide_and_strategy_reasoning',
      'System Interface'
    ),
    panel(
      'Current Operating State',
      'top_visible',
      'Show the current dominant path, One Move, proof target, constraint, and confidence state.',
      'Read this before scanning the rest of the dashboard.',
      'explains_current_intelligence_state',
      'Multi-Reality Output'
    ),
    panel(
      'Current Strategy / Five Futures / One Move',
      'default_open',
      'Show the current generated strategy output.',
      'Use it to understand the futures, the current One Move, and the strategy being tested.',
      'generated_intelligence_output',
      'Multi-Reality Output'
    ),
    panel(
      'Evidence & Proof / Outcome Loop',
      'default_open',
      'Capture proof, status, ledger events, and since-last movement.',
      'Update this after real conversations, actions, or evidence changes.',
      'captures_and_feeds_evidence',
      'Constraint Reality'
    ),
    panel(
      'Five Realities / System Status',
      'collapsed_support',
      'Explain which realities are thin, emerging, or strong.',
      'Open it when you need to know why the system is cautious or confident.',
      'explains_intelligence_health',
      'System Interface'
    ),
    panel(
      '9-Path Business Model Map',
      'collapsed_support',
      'Show the strategic path map behind the current recommendation.',
      'Use it when deciding between Channel Growth, subscription, partner, RRG, or other paths.',
      'feeds_business_model_reasoning',
      'Business Model Alignment'
    ),
    panel(
      'Adaptive Strategy Draft',
      'collapsed_support',
      'Create pending-review strategy drafts from evidence, summaries, and movement bands.',
      'Use it only after enough new evidence exists to justify a review.',
      'adaptive_generated_intelligence',
      'Multi-Reality Output'
    ),
    panel(
      'Confidence / Truth Boundaries',
      'collapsed_support',
      'Prevent overclaiming and separate live truth from ambition.',
      'Open it before pitching, raising, presenting, or making claims to partners.',
      'protects_confidence',
      'Confidence Reality'
    ),
    panel(
      'Financial/Admin Data',
      'collapsed_admin',
      'Show adoption counts, company grouping, and unavailable revenue/payment evidence.',
      'Use it as supporting proof, not the main thinking surface.',
      'feeds_financial_reality',
      'Financial Reality'
    ),
    panel(
      'Raw Profiles / Assessments / Adoption Records',
      'collapsed_admin',
      'Show admin evidence rows and source activity.',
      'Use it only when admin evidence or record-level follow-up is needed.',
      'admin_evidence_store',
      'Admin Evidence Store'
    ),
    panel(
      'Build Map / Roadmap',
      'collapsed_admin',
      'Separate live capabilities from planned roadmap ideas.',
      'Use it to avoid selling planned features as live product truth.',
      'protects_confidence',
      'Confidence Reality'
    )
  ];
}

function buildRecommendedDashboardWorkflow() {
  return [
    {
      step: 1,
      start_with: 'Current Operating State',
      purpose: 'Understand current path, One Move, proof target, constraint, and confidence state.'
    },
    {
      step: 2,
      start_with: 'Strategy Chat',
      purpose: 'Ask what changed, what to do next, what to say, or what not to overclaim.'
    },
    {
      step: 3,
      start_with: 'Current Strategy / Five Futures / One Move',
      purpose: 'Understand the current generated strategic output.'
    },
    {
      step: 4,
      start_with: 'Evidence & Proof / Outcome Loop',
      purpose: 'Record proof, status, outcome, or uncertainty.'
    },
    {
      step: 5,
      start_with: 'Five Realities / System Status',
      purpose: 'Know which reality is thin, emerging, or strong.'
    },
    {
      step: 6,
      start_with: '9-Path Business Model Map',
      purpose: 'Use when evaluating major strategic direction.'
    },
    {
      step: 7,
      start_with: 'Adaptive Strategy Draft',
      purpose: 'Use only when enough new evidence exists to consider an updated strategic draft.'
    },
    {
      step: 8,
      start_with: 'Confidence / Truth Boundaries',
      purpose: 'Use before making claims to partners, investors, mortgage companies, or leadership.'
    },
    {
      step: 9,
      start_with: 'Financial/Admin Data and Raw Records',
      purpose: 'Use as supporting evidence, not the primary thinking surface.'
    },
    {
      step: 10,
      start_with: 'Build Map / Roadmap',
      purpose: 'Separate what is live from what is planned.'
    }
  ];
}

function buildNextBestActionRules({ currentState, realities, financialSummary } = {}) {
  const rules = [];
  if (currentState?.evidence_strength === 'thin') {
    rules.push('Record proof before trying to move futures. Identify the active sales/channel conversation and classify it as customer revenue, partner capital, or channel distribution.');
  }
  if (['thin', 'emerging'].includes(realities?.financial_reality_status)) {
    rules.push('Verify paid/free/promo or revenue evidence before claiming subscription or revenue traction.');
  }
  if (realities?.business_model_alignment_status === 'strong' && ['thin', 'emerging'].includes(realities?.financial_reality_status)) {
    rules.push('The model is strategically coherent, but it needs proof. Convert one path into measurable revenue evidence or partner commitment.');
  }
  if (realities?.constraint_reality_status === 'emerging') {
    rules.push('Clarify the One Move proof target and record whether the action happened.');
  }
  if (['thin', 'emerging'].includes(realities?.confidence_reality_status)) {
    rules.push('Use Confidence / Truth Boundaries before pitching, raising, or presenting.');
  }
  if (currentState?.current_one_move && currentState.current_one_move !== NOT_ENOUGH_EVIDENCE) {
    rules.push('Execute or update the current One Move before generating a new strategy.');
  }
  if (currentState?.current_proof_target && currentState.current_proof_target !== NOT_ENOUGH_EVIDENCE) {
    rules.push('Record an outcome against the current proof target.');
  }
  if (financialSummary?.payment_subscription_evidence_status === NOT_INDEXED) {
    rules.push('Do not overstate payment or subscription evidence until it is indexed.');
  }
  return rules.slice(0, 8);
}

function buildHelpIntentExamples() {
  return [
    'what are these panels',
    'how do I use this dashboard',
    'walk me through this',
    'what should I look at first',
    'what should I do next',
    'how do I move the futures',
    'what proof should I record',
    'what should I update',
    'what does this panel mean',
    'this is confusing',
    'where do I start'
  ];
}

export function buildDarrenDashboardContextCompact({ snapshot, strategy } = {}) {
  const pathCoverage = evaluateDarrenBusinessModelPathCoverage({ snapshot, generatedStrategy: strategy });
  const currentState = buildCurrentOperatingStateCompact({ snapshot, strategy, pathCoverage });
  const realities = buildRealityCompletenessCompact({ snapshot, strategy, pathCoverage });
  const financialSummary = buildFinancialAdminSummaryCompact(snapshot);
  return {
    context_version: 'darren_dashboard_context_compact_v1',
    context_weight: 'low_to_medium',
    privacy_boundary: 'Compact summary only. No full admin rows, private profile text, assessment response detail, secrets, tokens, or storage keys are included.',
    current_operating_state_compact: currentState,
    reality_completeness_compact: realities,
    financial_admin_summary_compact: financialSummary,
    business_model_context_compact: buildBusinessModelContextCompact({ snapshot, strategy, pathCoverage }),
    confidence_boundary_compact: buildConfidenceBoundaryCompact(),
    roadmap_status_compact: buildRoadmapStatusCompact(snapshot),
    dashboard_workflow_context: {
      panel_map_compact: buildPanelMapCompact(),
      recommended_dashboard_workflow: buildRecommendedDashboardWorkflow(),
      next_best_action_rules: buildNextBestActionRules({ currentState, realities, financialSummary }),
      help_intent_examples: buildHelpIntentExamples(),
      response_style: 'Short, practical, action-oriented workflow guidance. Give 1 to 3 next actions when the user asks what to do next.'
    }
  };
}
