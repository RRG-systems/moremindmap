const FIVE_FUTURES_VERSION = 'five_futures_v1';
const ONE_MOVE_VERSION = 'one_move_v1';

export const REQUIRED_FUTURE_KEYS = [
  'current_future',
  'most_likely_next_future',
  'constraint_future',
  'optimized_future',
  'transformational_future'
];

const REQUIRED_FUTURE_LABELS = {
  current_future: 'Current Future',
  most_likely_next_future: 'Most Likely Next Future',
  constraint_future: 'Constraint Future',
  optimized_future: 'Optimized Future',
  transformational_future: 'Transformational Future'
};

function safeObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function text(value) {
  return String(value || '').trim();
}

function truncate(value, maxLength = 12000) {
  const body = text(value);
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength)}\n[TRUNCATED ${body.length - maxLength} CHARACTERS]`;
}

function compactJson(value, maxLength = 70000) {
  return truncate(JSON.stringify(value ?? null, null, 2), maxLength);
}

function unwrapCanonical(canonicalProfile) {
  return (
    canonicalProfile?.canonical_profile_json ||
    canonicalProfile?.canonical_dossier?.canonical_profile_json ||
    canonicalProfile?.canonical_dossier ||
    canonicalProfile ||
    {}
  );
}

function rankedDimensions(canonical) {
  const ranked =
    canonical?.rescoring_gpt?.ranked_dimensions ||
    canonical?.rescoring_v1?.ranked_dimensions ||
    canonical?.ranked_dimensions ||
    canonical?.dimension_scores ||
    [];

  if (!Array.isArray(ranked)) return [];
  return ranked.slice(0, 8).map((item) => ({
    dimension: item.dimension || item.name || item.key || item.label || null,
    score:
      item.display_score ??
      item.support_adjusted_score ??
      item.gpt_rescored_score ??
      item.raw_score ??
      item.score ??
      null,
    evidence_count: item.evidence_count ?? item.contributing_answer_count ?? null,
    confidence: item.confidence ?? null,
    evidence_band: item.evidence_band ?? null,
    intensity_band: item.intensity_band ?? null
  }));
}

function compactCanonicalProfile(canonicalProfile) {
  const canonical = unwrapCanonical(canonicalProfile);
  return {
    person_name:
      canonicalProfile?.person_name ||
      canonical?.person_name ||
      canonical?.full_name ||
      canonical?.name ||
      canonical?.metadata?.person_name ||
      canonical?.metadata?.full_name ||
      null,
    profile_type:
      canonical?.profile_type ||
      canonical?.inferred_patterns?.profile_type ||
      canonical?.behavioral_profile?.profile_type ||
      canonical?.render_ready?.profile_dna ||
      null,
    ranked_dimensions: rankedDimensions(canonical),
    behavioral_dna_interpretation:
      canonical?.behavioral_dna_interpretation ||
      canonical?.behavioral_dna ||
      canonical?.profile_dna ||
      null,
    dominance_profile: canonical?.dominance_profile || canonical?.rescoring_gpt?.dominance_profile || null,
    spread_profile: canonical?.spread_profile || canonical?.rescoring_gpt?.spread_profile || null,
    tension_pairs: canonical?.tension_pairs || canonical?.rescoring_gpt?.tension_pairs || null,
    pressure_mechanics: canonical?.pressure_mechanics || canonical?.stress_patterns || null,
    role_fit_analysis: canonical?.role_fit_analysis || canonical?.role_fit || null,
    wrong_seat_risk: canonical?.wrong_seat_risk || null
  };
}

function answersSnapshot(assessmentRecord) {
  const answers = safeObject(assessmentRecord?.inputs?.answers);
  return Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => {
      const key = `q${index + 1}`;
      return [key, truncate(answers[key], key === 'q9' ? 10000 : 5000)];
    })
  );
}

function modelSnapshot(realEstateBusinessModel) {
  const model = safeObject(realEstateBusinessModel);
  return {
    metadata: model.metadata,
    core_doctrine: model.core_doctrine,
    e_to_p_framework: model.e_to_p_framework,
    database_relationship_model: model.database_relationship_model,
    lead_generation_model: model.lead_generation_model,
    systems_model: model.systems_model,
    accountability_model: model.accountability_model,
    constraint_detection_framework: model.constraint_detection_framework,
    behavior_fusion_rules: model.behavior_fusion_rules,
    confidence_engine_rules: model.confidence_engine_rules,
    five_futures_input_model: model.five_futures_input_model,
    one_move_selection_model: model.one_move_selection_model
  };
}

function briefingSnapshot(executiveDiagnosticBriefing) {
  const briefing = safeObject(executiveDiagnosticBriefing);
  return {
    title: briefing.title,
    generated_at: briefing.generated_at,
    primary_constraint_snapshot: briefing.primary_constraint_snapshot,
    current_trajectory_signal: briefing.current_trajectory_signal,
    confidence_snapshot: briefing.confidence_snapshot,
    missing_data: briefing.missing_data,
    sections: Array.isArray(briefing.sections)
      ? briefing.sections.map((section) => ({
          key: section.key,
          title: section.title,
          body: truncate(section.body, 1100),
          evidence: section.evidence,
          confidence: section.confidence
        }))
      : [],
    caveats: briefing.caveats
  };
}

export function buildFiveFuturesPrompt({
  assessmentRecord,
  businessIntelligenceDraft,
  executiveDiagnosticBriefing,
  canonicalProfile,
  realEstateBusinessModel
}) {
  const assessmentId = assessmentRecord?.assessment_id;
  const ownerProfileId = assessmentRecord?.owner_profile_id;
  const system = [
    'You are generating the MORE MindMap Business Assessment V1 Five Futures and One Move.',
    'This is not a motivational planning exercise. It is probability-weighted trajectory modeling.',
    'The output must describe probability-weighted trajectories, not generic scenarios.',
    'The Five Futures are modeled from current operating reality, business constraints, behavioral profile, assessment answers, and the Executive Diagnostic Briefing.',
    'The One Move is generated after the Five Futures logic and identifies the intervention most likely to shift probability mass from the current / constraint trajectory toward the optimized trajectory.',
    'Use plain-English strategic diagnostic language.',
    'Produce concise schema-complete JSON, not prose-heavy narrative.',
    'Target roughly 4,500-6,500 completion tokens.',
    'Do not invent financial numbers, team facts, production history, or market facts not present in the inputs.',
    'Do not generate a frontend report, visual artifact, or modal copy.',
    'Do not include extra top-level sections, long essays, markdown, or padding.',
    'Return valid JSON only. No markdown fences.'
  ].join('\n');

  const userPayload = {
    task: 'Generate Five Futures and One Move for a saved Business Assessment.',
    output_contract: {
      top_level_required_keys: ['five_futures_v1', 'one_move_v1'],
      five_futures_v1: {
        version: FIVE_FUTURES_VERSION,
        generated_at: 'ISO timestamp',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId,
        title: 'Five Futures',
        subtitle: 'The future is not predicted. It is modeled.',
        methodology_note: 'short explanation of probability-weighted trajectory modeling',
        probability_total: 100,
        confidence_snapshot: 'object or string',
        missing_data: 'array or object',
        futures: REQUIRED_FUTURE_KEYS.map((key) => ({
          key,
          label: REQUIRED_FUTURE_LABELS[key],
          title: 'short boardroom-readable title',
          probability: 'integer probability',
          status:
            key === 'current_future'
              ? 'active'
              : key === 'most_likely_next_future'
                ? 'most_likely_next'
                : key === 'optimized_future'
                  ? 'requires_change'
                  : key === 'transformational_future'
                    ? 'requires_new_model'
                    : 'active',
          summary: 'concise trajectory summary',
          short_interpretation: 'short visual-ready interpretation',
          signal_bullets: ['3-5 short visual-ready bullets'],
          central_insight: 'short central insight suitable for the middle of a future artifact',
          what_the_system_sees: 'diagnostic observation',
          trajectory_logic: 'why this future forms',
          evidence: ['specific evidence from answers, draft, briefing, profile, model'],
          behavioral_drivers: ['behavioral factors'],
          business_drivers: ['business factors'],
          financial_drivers: ['financial factors or missing financial data'],
          risk_if_unchanged: 'risk for current/next/constraint futures when relevant',
          upside: 'upside for optimized/transformational futures when relevant',
          required_shift: 'specific shift needed',
          confidence: 'high | moderate | low',
          visual_color_hint: 'orange | purple | blue | red | emerald | cyan',
          visual_position_hint: 'left | center-left | center | center-right | right',
          input_sources_used: [
            'leadership',
            'recruiting',
            'financial',
            'historical',
            'accountability',
            'productivity',
            'behavioral'
          ]
        })),
        distribution_notes: 'explain why probability is distributed this way',
        caveats: 'honest limitations'
      },
      one_move_v1: {
        version: ONE_MOVE_VERSION,
        generated_at: 'ISO timestamp',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId,
        title: 'specific singular move title',
        root_constraint: 'primary root constraint',
        intervention_category: 'one category from the doctrine/model where possible',
        recommendation: 'one primary move, not a list of recommendations',
        why_this_move: 'why this move changes the trajectory',
        why_now: 'why now matters',
        evidence: ['specific evidence'],
        behavior_fit: 'why this fits or challenges the operator profile',
        adoption_risks: ['specific risks that could prevent adoption'],
        expected_probability_shift: {
          from: 'current/constraint future probability mass',
          to: 'optimized/transformational probability mass',
          explanation: 'how the move shifts probability'
        },
        first_30_days: ['concrete steps measurable in 30 days'],
        first_90_days: ['concrete steps measurable in 90 days'],
        success_indicators: ['measurable signs this is working'],
        what_to_not_do: ['tempting distractions or wrong moves'],
        confidence: 'high | moderate | low',
        caveats: 'honest limitations'
      }
    },
    five_futures_definitions: {
      current_future:
        'The future already active based on current behavior, business reality, and constraint evidence.',
      most_likely_next_future: 'The most likely next state if nothing material changes.',
      constraint_future:
        'The future that forms if the primary constraint intensifies or remains unresolved.',
      optimized_future:
        'The better future that becomes plausible if the primary constraint is addressed with discipline.',
      transformational_future:
        'The highest-upside future available, usually requiring a deeper operating-model change.'
    },
    probability_rules: [
      'Probabilities must be numeric integers and sum to 100.',
      'Do not make all five futures equally likely.',
      'current_future and most_likely_next_future should normally carry meaningful probability.',
      'transformational_future should usually be lower probability unless evidence supports readiness.',
      'optimized_future requires intervention.',
      'constraint_future shows what happens if the bottleneck persists.'
    ],
    output_length_rules: [
      'Be concise but specific.',
      'Use short paragraphs and compact arrays.',
      'Each future should be evidence-linked without becoming a long essay.',
      'summary, trajectory_logic, what_the_system_sees, risk_if_unchanged, upside, and required_shift should usually be 1-3 sentences each.',
      'signal_bullets should be 3-5 short bullets.',
      'evidence arrays should use the strongest 3-5 grounded evidence items.',
      'One Move should be practical and complete, but not padded.',
      'Do not add fields outside the requested JSON contract.'
    ],
    one_move_rules: [
      'Generate One Move after the Five Futures logic.',
      'The One Move must shift probability mass from current/constraint trajectory toward optimized trajectory.',
      'The One Move must be singular, specific, high leverage, behavior-aware, and measurable in 30-90 days.',
      'Do not produce ten recommendations or a generic coaching checklist.'
    ],
    style_rules: [
      'premium',
      'direct',
      'strategic',
      'plain English',
      'diagnostic',
      'probability-aware',
      'honest about missing data',
      'avoid generic consulting language and motivational fluff'
    ],
    assessment_record_context: {
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      assessment_type: assessmentRecord?.assessment_type,
      created_at: assessmentRecord?.created_at,
      profile_context: assessmentRecord?.profile_context || null,
      team_profile_ids: assessmentRecord?.inputs?.team_profile_ids || []
    },
    assessment_answers: answersSnapshot(assessmentRecord),
    business_intelligence_draft: businessIntelligenceDraft,
    executive_diagnostic_briefing: briefingSnapshot(executiveDiagnosticBriefing),
    canonical_profile_snapshot: compactCanonicalProfile(canonicalProfile),
    real_estate_business_model_snapshot: modelSnapshot(realEstateBusinessModel)
  };

  return {
    version: FIVE_FUTURES_VERSION,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: compactJson(userPayload, 60000) }
    ],
    prompt_text: `${system}\n\n${compactJson(userPayload, 60000)}`,
    required_future_keys: REQUIRED_FUTURE_KEYS,
    required_future_labels: REQUIRED_FUTURE_LABELS
  };
}

export default buildFiveFuturesPrompt;
