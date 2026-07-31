import { QUESTION_MAP } from '../../api/engine/questionMap.js';

export const SYNTHETIC_PROFILE_ID = 'mm-synthetic-measurement-v1';
export const SYNTHETIC_ASSESSMENT_ID = 'ba-synthetic-measurement-v1';

const WRITTEN_ANSWERS = Object.freeze({
  2: 'I am building a stable, useful business that protects family time and creates long-term freedom.',
  14: 'A project missed its target. I reviewed the sequence, owned the decision, asked for feedback, and changed the next review point.',
  17: 'Under pressure I tighten structure, move faster, and ask for direct input before committing the team.',
  20: 'I made the best bounded decision available, documented the unknowns, and scheduled a review when more evidence arrived.',
  22: 'I would rate my leadership as seven because direction is clear, while delegation and inspection still need consistency.',
  24: 'When momentum stalls I inspect the process first. Repeated resistance frustrates me, and I sometimes delay a difficult delegation conversation.',
  25: 'I ask what they heard, restate the intent plainly, and correct the impact when my delivery created confusion.',
  26: 'I naturally organize priorities and decisions. Tension appears when ownership is unclear or follow-through is informal.',
  27: 'I am building a durable company guided by responsibility, usefulness, freedom, and measurable service.',
  28: 'A weekly plan, CRM, and review cadence keep work organized. Future strain will appear if delegation and follow-up remain informal.',
});

export function buildCompleteBosUiAnswers() {
  return Object.fromEntries(
    QUESTION_MAP.set_1.v1.map((question) => {
      if (question.type === 'written') return [question.id, WRITTEN_ANSWERS[question.id]];
      if (question.type === 'ranking') return [question.id, question.answers.map((answer) => answer.key)];
      if (question.type === 'choose_two') return [question.id, question.answers.slice(0, 2).map((answer) => answer.key)];
      return [question.id, question.answers[0].key];
    }),
  );
}
export function buildBusinessAssessmentRecord() {
  return {
    assessment_id: SYNTHETIC_ASSESSMENT_ID,
    owner_profile_id: SYNTHETIC_PROFILE_ID,
    assessment_type: 'real_estate_agent',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    profile_context: {
      owner_profile_id: SYNTHETIC_PROFILE_ID,
      owner_profile_name: 'Synthetic Operator',
      owner_profile_type: 'Command / Signal',
    },
    inputs: {
      team_profile_ids: [],
      answers: {
        q1: 'Lead flow is inconsistent and referrals are not inspected weekly.',
        q2: 'Build a predictable relationship business with stable family time.',
        q3: 'The database contains 480 contacts, but only 120 are categorized relationships.',
        q4: 'Most business comes from referrals and repeat relationships.',
        q5: 'Follow-up is inconsistent and depends too much on memory.',
        q6: 'Prospecting happens in bursts instead of a protected daily block.',
        q7: 'A weekly scorecard exists but no one consistently inspects it.',
        q8: 'The CRM is present, but process ownership and cadence are weak.',
        q9: 'Annual volume is tracked, while expenses and net profit need a monthly review.',
        q10: 'Client service is strong once a conversation begins.',
        q11: '',
        q12: 'Growth will strain follow-up, delegation, and capacity without a repeatable system.',
      },
    },
  };
}

const SECTION_KEYS = [
  'executive_readout',
  'current_business_reality',
  'behavioral_reality_applied_to_business',
  'relationship_database_reality',
  'lead_generation_reality',
  'lead_conversion_follow_up_reality',
  'systems_reality',
  'accountability_reality',
  'financial_reality',
  'team_leadership_reality',
  'contradictions_blind_spots',
  'primary_constraint',
  'current_trajectory_signal',
  'confidence_missing_data',
  'strategic_interpretation',
  'preliminary_one_move_direction',
];

export function buildExecutiveBriefing() {
  return {
    version: 'executive_diagnostic_briefing_v1',
    generated_at: '2026-01-01T00:00:00.000Z',
    assessment_id: SYNTHETIC_ASSESSMENT_ID,
    owner_profile_id: SYNTHETIC_PROFILE_ID,
    title: 'Executive Diagnostic Briefing',
    audience_type: 'real_estate_agent',
    briefing_markdown: 'The business has relationship strength, but inconsistent follow-up and inspection limit predictable conversion.',
    sections: SECTION_KEYS.map((key) => ({
      key,
      title: key.replace(/_/g, ' '),
      body: `${key.replace(/_/g, ' ')} is grounded in the submitted business evidence and the preserved behavioral profile.`,
      evidence: ['business_intelligence_draft', 'assessment_answers'],
      confidence: 'moderate',
    })),
    primary_constraint_snapshot: 'follow_up_constraint',
    current_trajectory_signal: 'conversion_leakage',
    confidence_snapshot: { score: 0.78, band: 'moderate' },
    missing_data: ['monthly net profit detail'],
    caveats: 'This diagnostic is an operating analysis, not legal, tax, or financial advice.',
  };
}

export function buildFiveFutures() {
  const definitions = [
    ['current_future', 30],
    ['most_likely_next_future', 25],
    ['constraint_future', 20],
    ['optimized_future', 15],
    ['transformational_future', 10],
  ];
  return {
    version: 'five_futures_v1',
    generated_at: '2026-01-01T00:00:00.000Z',
    assessment_id: SYNTHETIC_ASSESSMENT_ID,
    owner_profile_id: SYNTHETIC_PROFILE_ID,
    title: 'Five Futures',
    probability_total: 100,
    futures: definitions.map(([key, probability]) => ({
      key,
      label: key.replace(/_/g, ' '),
      title: `${key.replace(/_/g, ' ')} trajectory`,
      probability,
      status: key === 'current_future' ? 'active' : 'modeled',
      summary: `A ${key.replace(/_/g, ' ')} shaped by follow-up discipline and relationship evidence.`,
      trajectory_logic: 'Current behavior and operating-system evidence determine the modeled trajectory.',
      evidence: ['business_intelligence_draft.primary_constraint', 'assessment_answers.q5'],
      behavioral_drivers: ['Command supports decisive adoption when inspection is visible.'],
      business_drivers: ['Follow-up consistency changes relationship conversion.'],
      financial_drivers: ['Financial detail remains incomplete.'],
      confidence: 'moderate',
      signal_bullets: ['Follow-up cadence', 'Weekly inspection'],
      short_interpretation: 'Trajectory responds to consistent execution.',
      central_insight: 'The system must make follow-up visible.',
      visual_color_hint: '#5B8DEF',
      visual_position_hint: key,
      input_sources_used: ['business_intelligence_draft', 'executive_diagnostic_briefing_v1'],
      risk_if_unchanged: 'Relationship opportunity continues to leak through inconsistent follow-up.',
      required_shift: 'Install visible weekly follow-up ownership and inspection.',
      upside: 'More predictable conversion from existing relationships.',
    })),
  };
}

export function buildOneMove() {
  return {
    version: 'one_move_v1',
    generated_at: '2026-01-01T00:00:00.000Z',
    assessment_id: SYNTHETIC_ASSESSMENT_ID,
    owner_profile_id: SYNTHETIC_PROFILE_ID,
    title: 'Install a weekly relationship follow-up operating review',
    root_constraint: 'follow_up_constraint',
    intervention_category: 'follow_up_operating_system',
    recommendation: 'Create one owned weekly follow-up review using the existing CRM and relationship segments.',
    why_this_move: 'It converts an informal behavior into visible, inspectable execution.',
    why_now: 'Growth will increase leakage if follow-up remains dependent on memory.',
    evidence: ['assessment_answers.q5', 'business_intelligence_draft.primary_constraint'],
    behavior_fit: 'Clear ownership and inspection fit the operator’s command and signal strengths.',
    adoption_risks: ['Adding tools instead of using the existing CRM'],
    expected_probability_shift: {
      from: 'current_future',
      to: 'optimized_future',
      explanation: 'Consistent inspection shifts probability toward predictable conversion.',
    },
    probability_shift: { from: 'current_future', to: 'optimized_future' },
    first_30_days: ['Assign ownership', 'Run four weekly reviews'],
    first_90_days: ['Measure contact completion and conversion'],
    success_indicators: ['Weekly review completion', 'Overdue follow-up reduction'],
    proof_signals: ['Four consecutive reviews', 'Visible overdue count'],
    what_to_not_do: ['Do not replace the CRM before using the current workflow consistently.'],
    confidence: 'moderate',
    caveats: 'Financial effects require measured conversion data.',
  };
}
