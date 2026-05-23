/**
 * canonical-to-report-mapper.js
 * 
 * Maps canonical dossier JSON → report content structure
 * 
 * Generic mapper: works with ANY canonical dossier, not tied to specific profiles
 * Input: canonical dossier object
 * Output: reportContent object with all template variables
 * 
 * IMPORTANT: This mapper is reusable. Use MM-20260523-mqlev9c9 for testing only.
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

    // ===== SECTION NARRATIVES (directly from canonical.narrative_profile) =====
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

/**
 * Helper: Generate profile signature (e.g., "High Command + Perspective")
 */
function generateProfileSignature(canonical) {
  const top = canonical.ranked_dimensions
    ?.slice(0, 3)
    .map((d) => `${d.dimension}${d.score > 0 ? '+' : d.score < 0 ? '-' : ''}`)
    .join(' / ') || 'Profile Signature';
  return top;
}

/**
 * Helper: Interpret profile signature
 */
function interpretProfileSignature(canonical) {
  const profile_type = canonical.inferred_patterns?.profile_type || 'Behavioral Profile';
  const operating_signature =
    canonical.inferred_patterns?.operating_signature || 'Strategic operator';
  return `${profile_type}: ${operating_signature}`;
}

/**
 * Helper: Format dimension label with score
 */
function formatDimensionLabel(label, score) {
  if (score === undefined || score === null) return label;
  if (score > 1) return `${label} (High)`;
  if (score > 0) return `${label} (Moderate)`;
  if (score < -1) return `${label} (Low)`;
  if (score < 0) return `${label} (Moderate Low)`;
  return label;
}

/**
 * Helper: Extract dimension explanation from narrative
 */
function extractDimensionExplanation(canonical, dimension) {
  // Try to find in top_systems first
  if (canonical.top_systems) {
    const primary = canonical.top_systems.primary_driver;
    if (primary?.dimension === dimension) {
      return primary.operating_manifestation || '';
    }

    const secondary = canonical.top_systems.secondary_stabilizer;
    if (secondary?.dimension === dimension) {
      return secondary.operating_manifestation || '';
    }

    const opposing = canonical.top_systems.opposing_pattern_1;
    if (opposing?.dimension === dimension) {
      return opposing.operating_manifestation || '';
    }

    const opposing2 = canonical.top_systems.opposing_pattern_2;
    if (opposing2?.dimension === dimension) {
      return opposing2.operating_manifestation || '';
    }
  }

  // Fallback to generic dimension explanation
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

/**
 * Helper: Extract core edge narrative
 */
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

/**
 * Helper: Extract confidence level
 */
function extractConfidenceLevel(canonical) {
  const confidence = canonical.evidence_map?.aggregate_confidence;
  if (!confidence) return 'Moderate';

  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.7) return 'Moderate-High';
  if (confidence >= 0.5) return 'Moderate';
  if (confidence >= 0.3) return 'Low-Moderate';
  return 'Low';
}

/**
 * Helper: Extract primary driver details
 */
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

/**
 * Helper: Extract secondary stabilizer details
 */
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

/**
 * Helper: Extract opposing patterns
 */
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
