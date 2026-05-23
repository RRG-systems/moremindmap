/**
 * canonical-to-report-mapper.js
 * 
 * Maps canonical dossier JSON → report content structure
 * 
 * CRITICAL: This mapper provides ALL template variables.
 * Missing variables → raw {{ }} placeholders in output
 * 
 * Generic mapper: works with ANY canonical dossier, not tied to specific profiles
 * Input: canonical dossier object
 * Output: reportContent object with 150+ template variables
 */

const canonicalToReportMapper = (canonicalDossier) => {
  // Get canonical inside dossier
  const canonical = canonicalDossier.canonical_profile_json || canonicalDossier;

  // Safely extract values with fallbacks
  const safe = (obj, path, defaultValue = 'N/A') => {
    try {
      const keys = path.split('.');
      let value = obj;
      for (const key of keys) {
        value = value?.[key];
        if (value === undefined || value === null) return defaultValue;
      }
      return value || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  // IDENTITY & METADATA
  const reportContent = {
    // ===== PROFILE IDENTITY =====
    profile_id: canonicalDossier.profile_id || 'UNKNOWN',
    person_name: canonicalDossier.person_name || 'Assessment Subject',
    email: canonicalDossier.email || '',
    company_name: canonicalDossier.company_name || '',
    company_slug: canonicalDossier.company_slug || '',
    assessment_date: (() => {
      const date = canonicalDossier.created_at || new Date().toISOString();
      return date.split('T')[0].split('-').reverse().join('/');
    })(),
    assessment_version: canonicalDossier.assessment_version || 'mini-v2',
    model: canonicalDossier.model || 'canonical-v1',

    // ===== PROFILE SIGNATURE & DNA =====
    profile_code_string: generateProfileSignature(canonical),
    profile_signature_interpretation: interpretProfileSignature(canonical),

    // ===== VECTOR SCORES (8 dimensions) =====
    vector_code: 'VECTOR',
    vector_label: formatDimensionLabel('Command', canonical.vector_scores?.vector),
    vector_explanation: extractDimensionExplanation(canonical, 'vector'),

    signal_code: 'SIGNAL',
    signal_label: formatDimensionLabel('Relational Awareness', canonical.vector_scores?.signal),
    signal_explanation: extractDimensionExplanation(canonical, 'signal'),

    fidelity_code: 'FIDELITY',
    fidelity_label: formatDimensionLabel('Precision', canonical.vector_scores?.fidelity),
    fidelity_explanation: extractDimensionExplanation(canonical, 'fidelity'),

    velocity_code: 'VELOCITY',
    velocity_label: formatDimensionLabel('Speed', canonical.vector_scores?.velocity),
    velocity_explanation: extractDimensionExplanation(canonical, 'velocity'),

    leverage_code: 'LEVERAGE',
    leverage_label: formatDimensionLabel('Systems Thinking', canonical.vector_scores?.leverage),
    leverage_explanation: extractDimensionExplanation(canonical, 'leverage'),

    flex_code: 'FLEX',
    flex_label: formatDimensionLabel('Adaptability', canonical.vector_scores?.flex),
    flex_explanation: extractDimensionExplanation(canonical, 'flex'),

    framework_code: 'FRAMEWORK',
    framework_label: formatDimensionLabel('Structure', canonical.vector_scores?.framework),
    framework_explanation: extractDimensionExplanation(canonical, 'framework'),

    horizon_code: 'HORIZON',
    horizon_label: formatDimensionLabel('Perspective', canonical.vector_scores?.horizon),
    horizon_explanation: extractDimensionExplanation(canonical, 'horizon'),

    // ===== CORE EDGE =====
    core_edge_icon: '🎯',
    core_edge_narrative: extractCoreEdge(canonical),

    // ===== CONFIDENCE & PROFILE TYPE =====
    confidence_level: extractConfidenceLevel(canonical),
    profile_type: canonical.inferred_patterns?.profile_type || 'Behavioral Profile',

    // ===== SECTION NARRATIVES =====
    executive_summary: canonical.narrative_profile?.executive_summary || '',
    leadership_narrative: canonical.narrative_profile?.leadership_narrative || '',
    decision_narrative: canonical.narrative_profile?.decision_narrative || '',
    communication_narrative: canonical.narrative_profile?.communication_narrative || '',
    development_narrative: canonical.narrative_profile?.development_narrative || '',
    contradiction_analysis: canonical.narrative_profile?.contradiction_analysis || '',
    hidden_risks_narrative: canonical.narrative_profile?.hidden_risks_narrative || '',
    strategic_ceiling_narrative: canonical.narrative_profile?.strategic_ceiling_narrative || '',
    coaching_leverage_narrative: canonical.narrative_profile?.coaching_leverage_narrative || '',
    business_manifestation: canonical.narrative_profile?.business_manifestation || '',

    // ===== EXECUTIVE SUMMARY SECTION =====
    summary_text: canonical.narrative_profile?.executive_summary || 'Executive summary analyzing behavioral patterns and strategic implications.',
    leadership_heading: 'Leadership Approach',
    leadership_body: canonical.leadership_architecture?.primary_mode || 'Leadership emerges from core operating patterns.',
    development_heading: 'Development Priority',
    development_body: canonical.development_targets?.[0]?.approach || 'Growth through deliberate capability expansion.',
    priority_heading: 'Strategic Priority',
    priority_body: canonical.strategic_ceiling_analysis?.breakthrough_requirement || 'Breakthrough requires addressing current ceiling.',

    // ===== OPERATING PATTERN SECTION =====
    operating_pattern_body_1: canonical.narrative_profile?.leadership_narrative?.split('\n')?.[0] || 'Operating pattern reflects core behavioral drivers.',
    operating_pattern_body_2: canonical.narrative_profile?.decision_narrative?.split('\n')?.[0] || 'Decision architecture shapes approach and outcomes.',
    operating_pattern_body_3: canonical.inferred_patterns?.decision_architecture?.formation_pattern || 'Pattern formation driven by core operating system.',
    operating_pattern_body_4: canonical.stress_patterns?.primary_stress_response || 'Under stress, behavioral patterns accelerate.',
    strongest_default_heading: 'Strongest Default',
    strongest_default_body: canonical.top_systems?.primary_driver?.operating_manifestation || 'Primary driver creates natural advantage.',
    likely_blind_spot_heading: 'Likely Blind Spot',
    likely_blind_spot_body: canonical.top_systems?.opposing_pattern_1?.operating_manifestation || 'Blind spots emerge from opposing patterns.',
    highest_value_adjustment_heading: 'Highest Value Adjustment',
    highest_value_adjustment_body: canonical.coaching_leverage_points?.highest_roi_adjustment || 'Strategic adjustment creates sustainable impact.',
    development_priority_heading: 'Development Priority',
    development_priority_body: canonical.development_targets?.[0]?.rationale || 'Growth opportunity identified for focus.',

    // ===== DECISION ARCHITECTURE SECTION =====
    decision_architecture_narrative_1: canonical.narrative_profile?.decision_narrative || 'Decision architecture synthesized from behavioral patterns and operating model.',
    decision_architecture_narrative_2: canonical.inferred_patterns?.decision_architecture?.speed_driver ? `Decision speed: ${canonical.inferred_patterns.decision_architecture.speed_driver}` : 'Moderate decision velocity.',
    decision_trait_1_heading: 'Speed',
    decision_trait_1_value: canonical.vector_scores?.velocity ? Math.round(Math.max(0, Math.min(100, (canonical.vector_scores.velocity + 2) * 20))) : 50,
    decision_trait_2_heading: 'Precision',
    decision_trait_2_value: canonical.vector_scores?.fidelity ? Math.round(Math.max(0, Math.min(100, (canonical.vector_scores.fidelity + 2) * 20))) : 50,
    advantage_heading: 'Advantage',
    advantage_body: canonical.top_systems?.primary_driver?.description || 'Primary operating advantage.',
    failure_heading: 'Failure Mode',
    failure_body: canonical.stress_patterns?.blind_spot_emergence || 'Blind spot emergence under stress.',
    upgrade_heading: 'Upgrade Path',
    upgrade_body: canonical.coaching_leverage_points?.long_term_work?.[0] || 'Long-term development creates sustainable advantage.',

    // ===== COMMUNICATION STYLE SECTION =====
    signal_matrix_explanation: canonical.narrative_profile?.communication_narrative || 'Communication style analysis from behavioral patterns.',
    others_experience_1_heading: 'Clarity',
    others_experience_1_body: canonical.inferred_patterns?.communication_style?.message_structure || 'Message structure shapes reception.',
    others_experience_2_heading: 'Impact',
    others_experience_2_body: canonical.inferred_patterns?.communication_style?.effectiveness_peak || 'Peak effectiveness in aligned contexts.',
    others_experience_3_heading: 'Friction',
    others_experience_3_body: canonical.inferred_patterns?.communication_style?.friction_point || 'Potential friction point exists.',
    communication_advantage_heading: 'Advantage',
    communication_advantage_body: canonical.inferred_patterns?.communication_style?.message_structure || 'Direct communication creates clarity.',
    communication_friction_heading: 'Friction Point',
    communication_friction_body: canonical.inferred_patterns?.communication_style?.friction_point || 'Specific communication friction identified.',
    communication_upgrade_heading: 'Upgrade',
    communication_upgrade_body: 'Calibrate communication for context and reception.',

    // ===== SYSTEM UNDER STRAIN SECTION =====
    system_tension_warning: canonical.contradictions?.[0]?.tension || 'Multiple system tensions exist.',
    system_tension_summary: canonical.contradictions?.[0]?.manifestation || 'System tensions manifest under pressure.',
    primary_driver_name: canonical.top_systems?.primary_driver?.dimension || 'Primary Driver',
    primary_driver_icon: '🎯',
    primary_driver_bullet_1: truncate(canonical.top_systems?.primary_driver?.operating_manifestation, 50) || 'Primary driver',
    primary_driver_bullet_2: 'Sets direction',
    primary_driver_bullet_3: 'Accelerates decisions',
    primary_driver_bullet_4: 'Focuses energy',
    secondary_stabilizer_name: canonical.top_systems?.secondary_stabilizer?.dimension || 'Secondary Stabilizer',
    secondary_stabilizer_icon: '🛡',
    secondary_stabilizer_bullet_1: truncate(canonical.top_systems?.secondary_stabilizer?.operating_manifestation, 50) || 'Provides stability',
    secondary_stabilizer_bullet_2: 'Balances driver',
    secondary_stabilizer_bullet_3: 'Enables sustainability',
    secondary_stabilizer_bullet_4: 'Reduces blind spots',
    opposing_pattern_1_name: canonical.top_systems?.opposing_pattern_1?.dimension || 'Opposing Pattern 1',
    opposing_pattern_1_icon: '⚡',
    opposing_pattern_1_bullet_1: truncate(canonical.top_systems?.opposing_pattern_1?.operating_manifestation, 50) || 'Alternative perspective',
    opposing_pattern_1_bullet_2: 'Challenges defaults',
    opposing_pattern_1_bullet_3: 'Surfaces blind spots',
    opposing_pattern_1_bullet_4: 'Creates tension',
    opposing_pattern_2_name: canonical.top_systems?.opposing_pattern_2?.dimension || 'Opposing Pattern 2',
    opposing_pattern_2_icon: '🔄',
    opposing_pattern_2_bullet_1: truncate(canonical.top_systems?.opposing_pattern_2?.operating_manifestation, 50) || 'Counter-balance',
    opposing_pattern_2_bullet_2: 'Adds nuance',
    opposing_pattern_2_bullet_3: 'Complicates efficiency',
    opposing_pattern_2_bullet_4: 'Enables wisdom',
    core_engine_heading: canonical.inferred_patterns?.profile_type || 'Core Operating Engine',
    core_engine_summary: canonical.inferred_patterns?.operating_signature || 'Your behavioral system synthesized.',
    legend_primary_driver_text: 'Primary Driver',
    legend_secondary_stabilizer_text: 'Secondary Stabilizer',
    legend_opposing_patterns_text: 'Opposing Patterns',
    pressure_response_explanation: canonical.stress_patterns?.primary_stress_response || 'Under pressure, patterns intensify and blind spots emerge.',
    escalation_chain_explanation: canonical.stress_patterns?.escalation_chain?.join(' → ') || 'Stress escalation follows predictable path.',
    blind_spot_field_explanation: canonical.stress_patterns?.blind_spot_emergence || 'Blind spots emerge under stress.',
    friction_patterns_explanation: canonical.stress_patterns?.recovery_paths?.join(' / ') || 'Friction patterns activate under strain.',
    recalibration_priorities_explanation: 'Conscious recalibration enables better decisions under stress.',

    // ===== ENVIRONMENT FIT SECTION =====
    high_traction_environments_body: 'You thrive in environments aligned with your operating patterns.',
    high_traction_card_heading: 'Examples',
    high_traction_card_body: canonical.environment_fit?.thrives_in?.join(', ') || 'Environments aligned with patterns.',
    conditional_fit_environments_body: 'These environments work IF specific conditions are met.',
    conditional_fit_card_heading: 'Conditions',
    conditional_fit_card_body: canonical.environment_fit?.requires?.join(', ') || 'Specific conditions enable effectiveness.',
    high_friction_environments_body: 'These environments create friction.',
    high_friction_card_heading: 'Friction',
    high_friction_card_body: canonical.environment_fit?.struggles_in?.join(', ') || 'Specific environment friction points.',
    horizon_shift_heading: 'Perspective Shift',
    horizon_shift_body: 'Expand time horizon and strategic perspective.',
    adapt_shift_heading: 'Adaptability',
    adapt_shift_body: 'Build flexibility into operating defaults.',
    input_shift_heading: 'Input Shift',
    input_shift_body: 'Actively seek diverse perspectives.',

    // ===== FACILITATOR NOTES SECTION =====
    facilitator_interpretation_body: 'This profile reveals strategic operator with clear strengths and specific growth edges.',
    coaching_intervention_body: 'Focus on expanding awareness of automatic defaults and building deliberate flexibility.',
    development_edges_body: canonical.development_targets?.map(t => t.approach).join(' / ') || 'Multiple development edges available.',
    coaching_questions_body: 'What patterns repeat under pressure? When do strengths become liabilities? What would change if you shifted?',

    // ===== FULL PROFILE UNLOCKS SECTION =====
    operating_dna_subtitle: 'Advanced systems, strategic expansion, and long-term optimization',
    unlock_area_1_heading: 'Strategic Expansion',
    unlock_area_1_body: canonical.future_growth_constraints?.at_2x_scale?.[0] || 'Growth opportunity identified.',
    unlock_area_2_heading: 'Scaling Edge',
    unlock_area_2_body: canonical.future_growth_constraints?.at_5x_scale?.[0] || 'Scaling challenge identified.',
    advanced_system_1_heading: 'Advanced Leadership',
    advanced_system_1_body: 'Leadership patterns evolve with complexity.',
    advanced_system_2_heading: 'Organizational Architecture',
    advanced_system_2_body: 'System design impacts effectiveness at scale.',
    core_force_heading: 'Core Operating Force',
    core_force_body: canonical.top_systems?.primary_driver?.description || 'Your primary behavioral force.',
    hidden_cost_heading: 'Hidden Cost',
    hidden_cost_body: canonical.hidden_risk_patterns?.relational_erosion_risk ? 'Relational awareness erosion under stress.' : 'Strength-related costs identified.',
    next_evolution_heading: 'Next Evolution',
    next_evolution_body: 'Conscious evolution beyond current defaults creates advantage.',
    why_this_matters_body: 'Understanding your operating DNA enables deliberate evolution. Your behavioral patterns are learnable leverage points.',

    // ===== OPERATING PATTERNS =====
    primary_driver: extractPrimaryDriver(canonical),
    secondary_stabilizer: extractSecondaryStabilizer(canonical),
    opposing_patterns: extractOpposingPatterns(canonical),

    // ===== PRESSURE RESPONSE =====
    stress_patterns: canonical.stress_patterns?.primary_stress_response || '',
    escalation_chain: canonical.stress_patterns?.escalation_chain || [],
    recovery_paths: canonical.stress_patterns?.recovery_paths || [],

    // ===== LEADERSHIP ARCHITECTURE =====
    leadership_primary_mode: canonical.leadership_architecture?.primary_mode || '',
    leadership_challenge_surface: canonical.leadership_architecture?.challenge_surface || '',
    team_experience: canonical.leadership_architecture?.team_experience || '',

    // ===== ENVIRONMENT FIT =====
    thrives_in: canonical.environment_fit?.thrives_in || [],
    struggles_in: canonical.environment_fit?.struggles_in || [],
    requires: canonical.environment_fit?.requires || [],

    // ===== SCALING CONSTRAINTS =====
    constraints_2x: canonical.future_growth_constraints?.at_2x_scale || [],
    constraints_5x: canonical.future_growth_constraints?.at_5x_scale || [],
    scaling_readiness_score: canonical.scaling_readiness?.readiness_score || 0,

    // ===== COACHING LEVERAGE =====
    highest_roi_adjustment: canonical.coaching_leverage_points?.highest_roi_adjustment || '',
    quick_wins: canonical.coaching_leverage_points?.quick_wins || [],
    long_term_work: canonical.coaching_leverage_points?.long_term_work || [],

    // ===== DEVELOPMENT PRIORITIES =====
    development_targets: canonical.development_targets || [],

    // ===== CONTRADICTIONS =====
    contradictions: canonical.contradictions || [],

    // ===== HIDDEN COSTS =====
    hidden_costs: canonical.hidden_costs || [],

    // ===== ORGANIZATIONAL CONTEXT =====
    org_company: safe(canonicalDossier.metadata || {}, 'organization.company', ''),
    org_role: safe(canonicalDossier.metadata || {}, 'organization.role_title', ''),
    org_department: safe(canonicalDossier.metadata || {}, 'organization.department', ''),
    org_reports_to: safe(canonicalDossier.metadata || {}, 'organization.reports_to', ''),
    org_years_in_role: safe(canonicalDossier.metadata || {}, 'organization.years_in_current_role', ''),
    org_industry: safe(canonicalDossier.metadata || {}, 'organization.industry', ''),
    org_context: safe(canonicalDossier.metadata || {}, 'organization.org_context', []),

    // ===== CONTEXTUAL SIGNALS =====
    best_role_ever: safe(canonicalDossier.metadata || {}, 'contextual_signals.best_role_ever', ''),
    worst_role_ever: safe(canonicalDossier.metadata || {}, 'contextual_signals.worst_role_ever', ''),
    current_role_misalignment: safe(canonicalDossier.metadata || {}, 'contextual_signals.current_role_misalignment', ''),
    unrealized_capacity: safe(canonicalDossier.metadata || {}, 'contextual_signals.unrealized_capacity', ''),

    // ===== QUALITY & METADATA =====
    quality_score: canonicalDossier.quality_score || 0,
    job_id: canonicalDossier.job_id || '',
    generation_time_ms: safe(canonicalDossier.metadata || {}, 'generation_time_ms', 0),

    // ===== LIFE DIRECTION =====
    stated_priorities: canonical.life_direction?.stated_priorities || [],
    future_orientation: canonical.life_direction?.future_orientation || '',
    meaning_clarity: canonical.life_direction?.meaning_clarity || '',

    // ===== BUSINESS OPERATING REALITY =====
    numerical_grounding: canonical.business_operating_reality?.numerical_grounding || 'unknown',
    has_specific_metrics: canonical.business_operating_reality?.has_specific_metrics || false,
    gap_awareness: canonical.business_operating_reality?.gap_awareness || false,

    // ===== STRATEGIC CEILING =====
    strategic_ceiling_current: canonical.strategic_ceiling_analysis?.current_ceiling || '',
    strategic_ceiling_cause: canonical.strategic_ceiling_analysis?.ceiling_cause || '',
    strategic_ceiling_requirement: canonical.strategic_ceiling_analysis?.breakthrough_requirement || '',
    strategic_ceiling_proximity: canonical.strategic_ceiling_analysis?.ceiling_proximity || 0,

    // ===== FUTURE TRAJECTORY =====
    unchanged_trajectory_year2: canonical.future_trajectory?.unchanged_trajectory?.year_2 || [],
    unchanged_trajectory_year5: canonical.future_trajectory?.unchanged_trajectory?.year_5 || [],
    developed_trajectory_year2: canonical.future_trajectory?.developed_trajectory?.year_2 || [],
    developed_trajectory_year5: canonical.future_trajectory?.developed_trajectory?.year_5 || [],

    // ===== ROLE FIT ANALYSIS =====
    natural_roles: canonical.role_fit_analysis?.natural_roles || [],
    friction_roles: canonical.role_fit_analysis?.friction_roles || [],

    // ===== EVIDENCE MAP =====
    evidence_entries: canonical.evidence_map?.evidence_entries || {},
    aggregate_confidence: canonical.evidence_map?.aggregate_confidence || 0,
  };

  return reportContent;
};

function truncate(text, length = 50) {
  if (!text) return '';
  return String(text).split('\n')[0]?.substring(0, length) || '';
}

function generateProfileSignature(canonical) {
  const top = canonical.ranked_dimensions
    ?.slice(0, 3)
    .map((d) => `${d.dimension}${d.score > 0 ? '+' : d.score < 0 ? '-' : ''}`)
    .join(' / ') || 'Profile Signature';
  return top;
}

function interpretProfileSignature(canonical) {
  const profile_type = canonical.inferred_patterns?.profile_type || 'Behavioral Profile';
  const operating_signature =
    canonical.inferred_patterns?.operating_signature || 'Strategic operator';
  return `${profile_type}: ${operating_signature}`;
}

function formatDimensionLabel(label, score) {
  if (score === undefined || score === null) return label;
  if (score > 1) return `${label} (High)`;
  if (score > 0) return `${label} (Moderate)`;
  if (score < -1) return `${label} (Low)`;
  if (score < 0) return `${label} (Moderate Low)`;
  return label;
}

function extractDimensionExplanation(canonical, dimension) {
  if (canonical.top_systems) {
    const primary = canonical.top_systems.primary_driver;
    if (primary?.dimension === dimension) return primary.operating_manifestation || '';

    const secondary = canonical.top_systems.secondary_stabilizer;
    if (secondary?.dimension === dimension) return secondary.operating_manifestation || '';

    const opposing = canonical.top_systems.opposing_pattern_1;
    if (opposing?.dimension === dimension) return opposing.operating_manifestation || '';

    const opposing2 = canonical.top_systems.opposing_pattern_2;
    if (opposing2?.dimension === dimension) return opposing2.operating_manifestation || '';
  }

  const dimensionDescriptions = {
    vector: 'Ability to set direction and command',
    signal: 'Relational awareness and team attunement',
    fidelity: 'Precision and attention to detail',
    velocity: 'Decision speed and execution pace',
    leverage: 'Systems thinking and architectural vision',
    flex: 'Adaptability and willingness to pivot',
    framework: 'Process orientation and structure preference',
    horizon: 'Long-term perspective and strategic thinking',
  };

  return dimensionDescriptions[dimension] || 'Behavioral dimension';
}

function extractCoreEdge(canonical) {
  const primary = canonical.top_systems?.primary_driver?.description || '';
  const secondary = canonical.top_systems?.secondary_stabilizer?.description || '';

  if (primary && secondary) {
    return `${primary} combined with ${secondary}`;
  }
  if (primary) {
    return primary;
  }

  return canonical.inferred_patterns?.operating_signature || 'Core operating pattern';
}

function extractConfidenceLevel(canonical) {
  const confidence = canonical.evidence_map?.aggregate_confidence;
  if (!confidence) return 'Moderate';

  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.7) return 'Moderate-High';
  if (confidence >= 0.5) return 'Moderate';
  if (confidence >= 0.3) return 'Low-Moderate';
  return 'Low';
}

function extractPrimaryDriver(canonical) {
  return (
    canonical.top_systems?.primary_driver || {
      dimension: 'Unknown',
      description: 'Primary operating pattern',
      operating_manifestation: '',
      pressure_manifestation: '',
    }
  );
}

function extractSecondaryStabilizer(canonical) {
  return (
    canonical.top_systems?.secondary_stabilizer || {
      dimension: 'Unknown',
      description: 'Secondary stabilizing pattern',
      operating_manifestation: '',
      pressure_manifestation: '',
    }
  );
}

function extractOpposingPatterns(canonical) {
  const patterns = [];

  if (canonical.top_systems?.opposing_pattern_1) {
    patterns.push(canonical.top_systems.opposing_pattern_1);
  }

  if (canonical.top_systems?.opposing_pattern_2) {
    patterns.push(canonical.top_systems.opposing_pattern_2);
  }

  return patterns;
}

export default canonicalToReportMapper;
