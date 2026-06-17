const BRIEFING_VERSION = 'executive_diagnostic_briefing_v1';

const REQUIRED_SECTION_TITLES = [
  'Executive Readout',
  'Current Business Reality',
  'Behavioral Reality Applied to the Business',
  'Relationship / Database Reality',
  'Lead Generation Reality',
  'Lead Conversion / Follow-Up Reality',
  'Systems Reality',
  'Accountability Reality',
  'Financial Reality',
  'Team / Leadership Reality',
  'Contradictions and Blind Spots',
  'Primary Constraint',
  'Current Trajectory Signal',
  'Confidence / Missing Data',
  'Strategic Interpretation',
  'Preliminary One Move Direction'
];

const MINIMUM_BRIEFING_CHARACTERS = 12000;
const MINIMUM_BRIEFING_WORDS = 1800;
const MINIMUM_SECTION_BODY_WORDS = 100;
const PROMPT_PACKET_CHARACTER_LIMIT = 45000;

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

function compactJson(value, maxLength = 16000) {
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
    wrong_seat_risk: canonical?.wrong_seat_risk || null,
    metadata: canonical?.metadata || canonical?.profile_metadata || null
  };
}

function answersSnapshot(assessmentRecord) {
  const answers = safeObject(assessmentRecord?.inputs?.answers);
  return Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => {
      const key = `q${index + 1}`;
      return [key, truncate(answers[key], key === 'q9' ? 5000 : 3000)];
    })
  );
}

function answerRichness(answers) {
  const bodies = Object.values(answers).map(text);
  const totalWords = bodies.join(' ').split(/\s+/).filter(Boolean).length;
  const financialLength = text(answers.q9).length;
  const specificNumbers = bodies.join(' ').match(/\$?\d[\d,]*(?:\.\d+)?/g)?.length || 0;
  return { total_words: totalWords, financial_character_count: financialLength, numeric_reference_count: specificNumbers };
}

function wordCountTarget(assessmentRecord, draft) {
  const answers = answersSnapshot(assessmentRecord);
  const richness = answerRichness(answers);
  const isTeam = assessmentRecord?.assessment_type === 'real_estate_team' || draft?.team_reality?.team_exists;
  const highDetail = richness.total_words >= 900 || richness.financial_character_count >= 2500 || richness.numeric_reference_count >= 12;
  if (isTeam && highDetail) return '2,600-3,200 words';
  if (highDetail) return '2,100-2,600 words';
  return '1,950-2,300 words';
}

function modelSnapshot(realEstateBusinessModel) {
  const model = safeObject(realEstateBusinessModel);
  return {
    metadata: model.metadata,
    core_doctrine: model.core_doctrine,
    e_to_p_framework: model.e_to_p_framework,
    database_relationship_model: model.database_relationship_model,
    systems_model: model.systems_model,
    accountability_model: model.accountability_model,
    constraint_detection_framework: model.constraint_detection_framework,
    confidence_engine_rules: model.confidence_engine_rules,
    five_futures_input_model: model.five_futures_input_model,
    one_move_selection_model: model.one_move_selection_model
  };
}

export function buildExecutiveDiagnosticBriefingPrompt({
  assessmentRecord,
  businessIntelligenceDraft,
  canonicalProfile,
  realEstateBusinessModel
}) {
  const draft = safeObject(businessIntelligenceDraft);
  const answers = answersSnapshot(assessmentRecord);
  const target = wordCountTarget(assessmentRecord, draft);
  const audienceType =
    assessmentRecord?.assessment_type === 'real_estate_team' || draft?.team_reality?.team_exists
      ? 'real_estate_team'
      : 'real_estate_agent';

  const system = [
    'You are writing the MORE MindMap Business Assessment V1 Executive Diagnostic Briefing.',
    'This is a premium real estate business operating diagnostic for agents and teams, including high-producing teams.',
    'This is not a short summary. It is a substantial Executive Diagnostic Briefing.',
    'Write in direct, senior, plain-English diagnostic language.',
    'Be evidence-based. Tie claims back to the assessment answers, business intelligence draft, behavioral profile, or real estate business model.',
    'Use the Business Intelligence Draft fields as the reasoning spine.',
    'Use the Real Estate Business Model V1 as the business model lens.',
    'Use the Behavior Profile as the behavioral interpretation layer.',
    'Use confidence and missing data honestly.',
    'Do not invent numbers, team details, financials, or facts not present in the inputs.',
    'Do not summarize briefly. Do not compress sections.',
    'Each section must contain diagnostic reasoning, evidence, implication, and what it means.',
    'The client should receive substantial value from the written briefing alone.',
    'Do not generate Five Futures. Do not generate the final One Move.',
    'Use the label "Preliminary One Move Direction" only as a preview of the likely intervention category.',
    'Avoid generic coaching fluff, motivational speech, vague MBA language, unsupported certainty, and cheap AI-sounding phrases.',
    'Return valid JSON only. No markdown fences.'
  ].join('\n');

  const userPayload = {
    task: 'Generate an Executive Diagnostic Briefing.',
    output_contract: {
      version: BRIEFING_VERSION,
      title: 'Executive Diagnostic Briefing',
      audience_type: audienceType,
      word_count_target: target,
      minimum_acceptance_gate: {
        briefing_markdown_minimum_characters: MINIMUM_BRIEFING_CHARACTERS,
        briefing_markdown_minimum_estimated_words: MINIMUM_BRIEFING_WORDS,
        sections_minimum_count: REQUIRED_SECTION_TITLES.length,
        each_section_body_minimum_words: MINIMUM_SECTION_BODY_WORDS,
        rule: 'Meet this gate, but do not exceed the target length. Keep the briefing complete and efficient.'
      },
      required_top_level_keys: [
        'version',
        'generated_at',
        'assessment_id',
        'owner_profile_id',
        'title',
        'audience_type',
        'word_count_target',
        'briefing_markdown',
        'sections',
        'primary_constraint_snapshot',
        'current_trajectory_signal',
        'confidence_snapshot',
        'missing_data',
        'caveats'
      ],
      section_shape: {
        key: 'stable snake_case section key',
        title: 'section title',
        body: 'substantial prose of at least 90 words; target 115-160 words for normal cases',
        evidence: ['specific evidence references from answers/draft/profile/model'],
        confidence: 'high | moderate | low'
      },
      required_sections: REQUIRED_SECTION_TITLES,
      caveat:
        'Include exactly once at the bottom: This diagnostic is an operating analysis, not legal, tax, or financial advice.'
    },
    writing_requirements: {
      target_length: target,
      substantial:
        'This should read like an executive diagnostic briefing, not a short summary. Minimum acceptable output is 1,800 words and 12,000 characters. For solo assessments, aim for 1,950-2,300 words and 12,750-13,500 characters. For high-detail solo assessments, aim for 2,100-2,600 words and 13,000-14,000 characters. Meet every section minimum without excessive length.',
      section_depth:
        'Write every required section as a real diagnostic section. Every required section must be at least 90 words. Target 115-160 words per section for normal cases. Do not over-expand sections far beyond the requested range. Prefer concise diagnostic density over filler. Include diagnostic reasoning, evidence, implication, and what it means.',
      no_compression:
        'Do not compress the briefing to fit a short response. Do not provide brief bullet summaries in place of analysis.',
      standalone_value:
        'The briefing must be valuable as a standalone written deliverable even before Five Futures, One Move, or visuals exist.',
      reasoning_spine: [
        'Business Intelligence Draft fields are the reasoning spine.',
        'Real Estate Business Model V1 is the business model lens.',
        'Behavior Profile is the behavioral interpretation layer.',
        'Confidence and missing data must be stated honestly.'
      ],
      evidence_based: true,
      direct: true,
      plain_english: true,
      no_final_one_move: true,
      no_five_futures: true,
      financial_rule: 'Do not invent financial numbers. If financials are thin, say financial clarity is thin.',
      team_rule:
        'If team profile IDs or notes exist but team dossiers are not analyzed, say team intelligence is limited.',
      required_section_guidance: {
        executive_readout: 'Direct high-level diagnostic of what the system sees.',
        current_business_reality: 'Stage, maturity, goals, production reality, and mismatches.',
        behavioral_reality_applied_to_business:
          'How the owner profile likely affects business adoption, resistance, distortion, or sustainability.',
        relationship_database_reality:
          'Database, true relationships, segmentation, vendor database, lake health, and relationship asset quality.',
        lead_generation_reality:
          'Lead shortage, willingness, consistency, source diversity, and lead generation constraint probability.',
        lead_conversion_follow_up_reality:
          'Conversion leakage, response/follow-up weakness, and conversion discipline.',
        systems_reality:
          'Maturity of database, listing, buyer, lead conversion, transaction, financial tracking, recruiting if team, and accountability rhythm.',
        accountability_reality:
          'Absent, informal, cadence-based, inspection-based, or operating-system-level accountability.',
        financial_reality:
          'Known and missing units, volume, ASP, GCI, expenses, profit, marketing spend, P&L detail, team overhead, and net income.',
        team_leadership_reality:
          'For teams, role clarity, dependency risk, leverage clues, and missing team intelligence. For solo agents, explain limits.',
        contradictions_blind_spots: 'Make this one of the most valuable sections.',
        primary_constraint:
          'Explain the primary constraint, why it matters, supporting evidence, behavior intensifiers, and likely unchanged effect.',
        current_trajectory_signal: 'Explain what future pattern appears to be forming. This is not Five Futures.',
        confidence_missing_data:
          'Include known, observed, inferred, assumed, missing, confidence score, and confidence band.',
        strategic_interpretation: 'Synthesize what the whole diagnostic means.',
        preliminary_one_move_direction:
          'Describe likely intervention category only and state that final One Move comes after Five Futures trajectory modeling.'
      }
    },
    assessment_record_context: {
      assessment_id: assessmentRecord?.assessment_id,
      owner_profile_id: assessmentRecord?.owner_profile_id,
      assessment_type: assessmentRecord?.assessment_type,
      created_at: assessmentRecord?.created_at,
      profile_context: assessmentRecord?.profile_context || null,
      team_profile_ids: assessmentRecord?.inputs?.team_profile_ids || []
    },
    assessment_answers: answers,
    business_intelligence_draft: draft,
    canonical_profile_snapshot: compactCanonicalProfile(canonicalProfile),
    real_estate_business_model_snapshot: modelSnapshot(realEstateBusinessModel)
  };

  return {
    version: BRIEFING_VERSION,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: compactJson(userPayload, PROMPT_PACKET_CHARACTER_LIMIT) }
    ],
    prompt_text: `${system}\n\n${compactJson(userPayload, PROMPT_PACKET_CHARACTER_LIMIT)}`,
    word_count_target: target,
    audience_type: audienceType,
    required_sections: REQUIRED_SECTION_TITLES
  };
}

export default buildExecutiveDiagnosticBriefingPrompt;
