/**
 * Fathom District Director Role Model v1
 *
 * Source baseline: Fathom District Director Agreement 2025 (contract interpretation).
 * PDF may not be stored in-repo; this module encodes the locked interpretation only.
 * Do not invent extra contract terms beyond the locked summary.
 *
 * Locked interpretation:
 * - Recruiting / growth is a primary performance lever and strong economic incentive.
 * - Do NOT say "recruiting is the only job."
 *
 * V1B (growth-weighted overall doctrine):
 * Overall DD Role Fit is intentionally weighted toward recruiting/growth because
 * agent growth is the DD role’s primary economic performance lever. Compliance,
 * operations, support, training, and partner advocacy remain critical risk and
 * coaching dimensions and should be reviewed before making role decisions.
 *
 * Role archetype: growth leader, field operator, compliance/risk guardian,
 * agent culture/support leader, partner ecosystem promoter.
 */

export const FATHOM_DD_ROLE_MODEL_ID = 'fathom_district_director_v1';

/**
 * V1B growth-weighted overall weights (sum = 1.0).
 * Not a pure average of dimensions — business-lever-weighted role fit estimate.
 */
export const FATHOM_DD_OVERALL_WEIGHTS_V1B = {
  recruiting_growth_drive: 0.4,
  accountability_follow_through: 0.15,
  agent_support_service: 0.12,
  compliance_discipline: 0.1,
  training_communication: 0.1,
  operational_responsiveness: 0.1,
  partner_ecosystem_advocacy: 0.03,
};

export const OVERALL_SCORE_WEIGHTING_NOTE =
  'This overall score is intentionally weighted toward recruiting/growth because agent growth is the DD role’s primary economic performance lever. Compliance, operations, support, training, and partner advocacy remain critical risk and coaching dimensions and should be reviewed before making role decisions.';

export const BOARD_SAFE_DISCLAIMER =
  'This is a hybrid behavioral + evidence-informed role alignment analysis. It surfaces natural strengths, risks, and targeted development opportunities to inform decisions. It is not a standalone hiring or placement tool and should be used alongside proven performance history, interviews, and reference checks.';

export const FATHOM_DISTRICT_DIRECTOR_V1 = {
  role_model_id: FATHOM_DD_ROLE_MODEL_ID,
  version: '1.1.0-v1b',
  label: 'Fathom District Director v1',
  short_label: 'District Director Fit',
  organization: 'Fathom Holdings / Fathom Realty',
  source: {
    document: 'DD Agreement 2025',
    document_key: 'fathom_dd_agreement_2025',
    dependency_note:
      'Structured from locked contract interpretation. Upload PDF is source baseline; if PDF is not in-repo, do not invent extra terms.',
  },
  growth_target: {
    label: 'Market Center growth',
    value: '4%+ monthly',
    best_practice_recruiting: 'Directly recruit ~2 agents per month (best practice)',
  },
  role_archetype: [
    {
      id: 'growth_leader',
      label: 'Growth leader',
      note: 'Drives recruiting and Market Center expansion.',
    },
    {
      id: 'field_operator',
      label: 'Field operator',
      note: 'Hands-on operating rhythm with agents and transactions.',
    },
    {
      id: 'compliance_risk_guardian',
      label: 'Compliance / risk guardian',
      note: 'Document review, risk mitigation, compliance discipline.',
    },
    {
      id: 'agent_culture_support',
      label: 'Agent culture / support leader',
      note: 'Mentoring, support, training, and culture for agents.',
    },
    {
      id: 'partner_ecosystem_promoter',
      label: 'Partner ecosystem promoter',
      note: 'Advocates approved partner ecosystem without displacing primary duties.',
    },
  ],
  contract_evidence_statements: [
    'DD supports recruiting efforts.',
    'DD contributes to monthly Market Center growth of 4% or more.',
    'Best practice is directly recruiting two agents per month.',
    'Monthly base is tied to active agent count.',
    'Stock grants reward new agents added more heavily than sales transactions.',
    'Revenue share applies to directly recruited new agents.',
    'DD also carries support, training, compliance, document review, transaction issue resolution, partner advocacy, mentoring, and risk mitigation duties.',
  ],
  locked_interpretation_notes: [
    'Recruiting / growth is a primary performance lever and one of the strongest economic incentives in the DD role.',
    'Do not say recruiting is the only job.',
    'Role fit is multi-dimensional: growth + accountability + support + compliance + training + operations + partner advocacy.',
    'Overall score is growth-weighted (business-lever-weighted), not a pure average of dimensions.',
  ],
  overall_score_weighting_note: OVERALL_SCORE_WEIGHTING_NOTE,
  board_safe_disclaimer: BOARD_SAFE_DISCLAIMER,
  /**
   * V1B growth-weighted overall weights (normalized fraction of overall).
   * Display labels remain human-readable.
   */
  weight_labels: {
    dominant: 0.4,
    high: 0.15,
    material: 0.12,
    standard: 0.1,
    supporting: 0.03,
  },
  dimensions: [
    {
      id: 'recruiting_growth_drive',
      label: 'Recruiting / Growth Drive',
      weight_label: '40% (dominant)',
      weight: FATHOM_DD_OVERALL_WEIGHTS_V1B.recruiting_growth_drive,
      accent: 'blue',
      bos_signals: ['velocity', 'vector', 'leverage', 'horizon'],
      role_demand:
        'Sustained drive to attract, convert, and onboard agents; contributes to 4%+ Market Center growth; treats recruiting as a primary economic lever without becoming a pure recruiter-only identity.',
      scoring_guidance:
        'Favor higher Velocity (action), Vector (direction), Leverage (multiply through others), and Horizon (pipeline thinking). Penalize low action + low people-leverage combinations. Strong external recruiting evidence can elevate Growth Fit without erasing secondary risks.',
    },
    {
      id: 'accountability_follow_through',
      label: 'Accountability / Follow-through',
      weight_label: '15%',
      weight: FATHOM_DD_OVERALL_WEIGHTS_V1B.accountability_follow_through,
      accent: 'green',
      bos_signals: ['fidelity', 'framework', 'velocity'],
      role_demand:
        'Closes loops on commitments to agents, company, and compliance obligations; reliable monthly operating rhythm.',
      scoring_guidance:
        'Favor Fidelity + Framework + enough Velocity to finish. High talk / low finish patterns reduce score.',
    },
    {
      id: 'agent_support_service',
      label: 'Agent Support / Service Orientation',
      weight_label: '12%',
      weight: FATHOM_DD_OVERALL_WEIGHTS_V1B.agent_support_service,
      accent: 'purple',
      bos_signals: ['signal', 'flex', 'leverage'],
      role_demand:
        'Supports agent success through mentoring, issue resolution, and culture leadership — not only production metrics.',
      scoring_guidance:
        'Favor Signal (people reading), Flex (adapt to agent needs), and Leverage (help others produce).',
    },
    {
      id: 'compliance_discipline',
      label: 'Compliance Discipline',
      weight_label: '10%',
      weight: FATHOM_DD_OVERALL_WEIGHTS_V1B.compliance_discipline,
      accent: 'orange',
      bos_signals: ['framework', 'fidelity'],
      role_demand:
        'Document review, risk mitigation, and process discipline that protects agents and the Market Center.',
      scoring_guidance:
        'Favor Framework + Fidelity. Very low structure/precision is a material risk seat pattern for DD — remains visible even when growth evidence is elite.',
    },
    {
      id: 'training_communication',
      label: 'Training / Communication',
      weight_label: '10%',
      weight: FATHOM_DD_OVERALL_WEIGHTS_V1B.training_communication,
      accent: 'cyan',
      bos_signals: ['signal', 'vector', 'framework'],
      role_demand:
        'Teaches, clarifies expectations, and communicates standards so agents know how to operate.',
      scoring_guidance:
        'Favor Signal + Vector clarity + enough Framework to make training stick.',
    },
    {
      id: 'operational_responsiveness',
      label: 'Operational Responsiveness',
      weight_label: '10%',
      weight: FATHOM_DD_OVERALL_WEIGHTS_V1B.operational_responsiveness,
      accent: 'emerald',
      bos_signals: ['velocity', 'flex', 'fidelity'],
      role_demand:
        'Responds to transaction issues, field friction, and time-sensitive agent needs without losing accuracy.',
      scoring_guidance:
        'Favor Velocity + Flex with enough Fidelity to avoid reckless response.',
    },
    {
      id: 'partner_ecosystem_advocacy',
      label: 'Partner / Ecosystem Advocacy',
      weight_label: '3%',
      weight: FATHOM_DD_OVERALL_WEIGHTS_V1B.partner_ecosystem_advocacy,
      accent: 'violet',
      bos_signals: ['signal', 'leverage', 'horizon'],
      role_demand:
        'Promotes partner ecosystem thoughtfully as a supporting lever — secondary to growth, support, and compliance duties.',
      scoring_guidance:
        'Favor Signal + Leverage + Horizon. Keep weight supporting so it does not dominate the seat.',
    },
  ],
  /**
   * Business-consequence score bands (V1B).
   * Used for Overall, Behavioral, and Evidence-Adjusted headline verdicts.
   */
  verdict_bands: [
    { id: 'elite_ready_now', label: 'Elite / Ready-Now Fit', min: 90, max: 100 },
    { id: 'strong_fit', label: 'Strong Fit', min: 80, max: 89.999 },
    { id: 'viable_fit', label: 'Viable Fit', min: 70, max: 79.999 },
    { id: 'moderate_developmental', label: 'Moderate / Developmental Fit', min: 60, max: 69.999 },
    { id: 'high_risk_poor', label: 'High-Risk / Poor Fit', min: 0, max: 59.999 },
  ],
  analysis_engine: {
    v1_label: 'Deterministic Role Fit Engine v1B',
    prepared_for: 'Intelligence Layer Role Fit Engine',
    display_label:
      'Role Fit Engine — growth-weighted + evidence-informed (intelligence layer + deterministic guardrail)',
    model_calls_in_v1: false,
    scoring_mode: 'deterministic_v1b_growth_weighted_evidence',
  },
};

export default FATHOM_DISTRICT_DIRECTOR_V1;
