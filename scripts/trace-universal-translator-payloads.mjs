import { writeFileSync } from 'node:fs';
import { moreMeaningDictionary } from '../src/data/moreMeaningDictionary.js';

const OUTPUT_PATH = 'runtime_traces/moremindmap_universal_translator_payload_trace_ba_vs_bos_1c2.json';

const payloads = [
  {
    id: 'bos_retrieved_profile',
    family: 'BOS',
    source_type: 'bos_profile',
    source_title: 'Behavior Operating System Profile',
    translation_mode: 'plain_english',
    profile_context: 'Retrieved Profile ID: available',
    source_excerpt: [
      'BOS section-aware excerpt: true',
      '',
      'Profile context:',
      'Retrieved Profile ID: available',
      '',
      'Behavior Operating System summary:',
      'Source heading: Behavioral Intelligence Profile',
      'Visible profile output describes the person through a broad behavioral profile frame.',
      '',
      'Behavioral Risks:',
      'Source heading: limiting pattern',
      'Visible profile output includes a limiting pattern but the extracted section is short and does not carry many named behavioral subsections.',
      '',
      'Visible source excerpt fallback:',
      'Profile report visible text continues as a broad flattened profile excerpt rather than clean section-by-section source material.'
    ].join('\n')
  },
  {
    id: 'ba_executive_diagnostic',
    family: 'BA',
    source_type: 'business_assessment',
    source_title: 'Executive Diagnostic Briefing',
    translation_mode: 'plain_english',
    business_context: 'Business Assessment result',
    source_excerpt: [
      'Executive Diagnostic Briefing',
      '',
      'Primary constraint: lead conversion reality',
      'Current trajectory signal: early channel distribution pressure',
      'Confidence: moderate',
      '',
      'Constraint Detection: The business has enough relationship surface area to test a narrower channel, but follow-up discipline is the bottleneck.',
      'Evidence labels: Q3 database and relationship count, Q5 CRM and follow-up system'
    ].join('\n')
  },
  {
    id: 'ba_five_futures',
    family: 'BA',
    source_type: 'five_futures',
    source_title: 'Five Futures',
    translation_mode: 'plain_english',
    business_context: 'Business Assessment Five Futures',
    source_excerpt: [
      'Five Futures + One Move',
      '',
      'Future 1: Referral compounding improves if database follow-up becomes consistent.',
      'Future 2: Paid conversion remains fragile if the agent adds lead spend before fixing response discipline.',
      'Future 3: Partner channel becomes a testable path if a lender or mortgage company commits to a concrete pilot.',
      '',
      'One Move: Ask one lender for a specific pilot commitment and record the result as evidence.'
    ].join('\n')
  },
  {
    id: 'ba_one_move',
    family: 'BA',
    source_type: 'one_move',
    source_title: 'One Move',
    translation_mode: 'plain_english',
    business_context: 'Business Assessment One Move',
    source_excerpt: [
      'One Move',
      '',
      'Ask one lender for a specific pilot commitment this week. The move is designed to test whether channel distribution is real or only conversational interest.'
    ].join('\n')
  },
  {
    id: 'ba_truth_boundary',
    family: 'BA',
    source_type: 'truth_boundary',
    source_title: 'Truth Boundaries / What Not To Overclaim',
    translation_mode: 'plain_english',
    business_context: 'Business Assessment truth boundary',
    source_excerpt: [
      'Truth Boundaries / What Not To Overclaim',
      '',
      'Do not claim partner adoption from a positive conversation alone.',
      'Missing data: named partner, specific pilot terms, timeline, budget, and follow-through evidence.'
    ].join('\n')
  }
];

function dictionaryTermsMatched(text) {
  const normalized = String(text || '').toLowerCase();
  return moreMeaningDictionary
    .filter((entry) => {
      const label = entry.label.toLowerCase();
      return normalized.includes(label) || label.split(/\s+/).some((part) => part.length > 5 && normalized.includes(part));
    })
    .map((entry) => entry.label)
    .slice(0, 12);
}

function detectedSectionLabels(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[A-Z][A-Za-z0-9 /+-]{2,80}:$/.test(line))
    .map((line) => line.replace(/:$/, ''));
}

function contextFieldsPresent(payload) {
  return {
    profile_context: Boolean(payload.profile_context),
    business_context: Boolean(payload.business_context)
  };
}

function promptInstructionFamily(payload) {
  if (payload.source_type === 'bos_profile' || payload.source_type === 'bos_section') {
    return 'bos_behavior_translation_section_if_available';
  }
  if (['business_assessment', 'five_futures', 'one_move', 'truth_boundary'].includes(payload.source_type)) {
    return 'business_consequence_evidence_limit_next_action';
  }
  return 'general_meaning_translation';
}

function likelyQualityRisk(payload, labels) {
  if (payload.family === 'BOS') {
    if (labels.length < 4) {
      return 'BOS payload is still profile-level and sparse; it has fewer clean, content-rich behavioral sections than BA payloads.';
    }
    return 'BOS has section markers, but quality depends on whether rendered profile HTML exposes complete visible section bodies.';
  }
  return 'BA payload is narrow, named, and action/evidence-specific, which gives the model clearer translation anchors.';
}

const payloadSummaries = payloads.map((payload) => {
  const labels = detectedSectionLabels(payload.source_excerpt);
  return {
    id: payload.id,
    source_type: payload.source_type,
    source_title: payload.source_title,
    translation_mode: payload.translation_mode,
    source_excerpt_length: payload.source_excerpt.length,
    source_excerpt_first_500_chars: payload.source_excerpt.slice(0, 500),
    section_label_count: labels.length,
    detected_section_labels: labels,
    dictionary_terms_matched: dictionaryTermsMatched(`${payload.source_title} ${payload.source_excerpt}`),
    context_fields_present: contextFieldsPresent(payload),
    prompt_instruction_family: promptInstructionFamily(payload),
    likely_quality_risk: likelyQualityRisk(payload, labels),
    notes: payload.family === 'BOS'
      ? 'Representative of current retrieved BOS drawer shape reported by user: section-aware marker exists, but extracted sections are shallow.'
      : 'Representative of BA component behavior: payload is already scoped to a specific artifact or section.'
  };
});

const bos = payloadSummaries.filter((payload) => payload.id.startsWith('bos_'));
const ba = payloadSummaries.filter((payload) => payload.id.startsWith('ba_'));

const trace = {
  phase_id: 'MM-UX-1C.2',
  verdict: 'MOREMINDMAP_UNIVERSAL_TRANSLATOR_PAYLOAD_TRACE_COMPLETE_WITH_LIMITS',
  classification: 'BA_VS_BOS_TRANSLATOR_PAYLOAD_QUALITY_GAP_DIAGNOSED_NO_RUNTIME_CHANGE',
  highest_allowed_readiness: 'READY_FOR_BOS_TRANSLATOR_SOURCE_PAYLOAD_REPAIR_PLAN',
  runtime_code_changed: false,
  model_called: false,
  records_mutated: false,
  payloads: payloadSummaries,
  comparison_findings: {
    ba_payload_pattern: 'BA uses multiple narrow source types and source titles: business_assessment, five_futures, one_move, and truth_boundary.',
    bos_payload_pattern: 'Retrieved BOS uses one bos_profile payload from rendered HTML extraction.',
    ba_section_specificity: 'high',
    bos_section_specificity: bos[0]?.section_label_count >= 4 ? 'moderate' : 'low_to_moderate',
    likely_primary_gap: 'BOS source material remains too broad or shallow compared with BA section-specific artifacts.',
    api_prompt_difference: 'API has separate BOS and BA instruction families, but BA also supplies cleaner domain-specific payloads.',
    prompt_only_fix_sufficient: false
  },
  recommended_next_sprint: [
    'Add section-level BOS translator launchers where the rendered profile exposes reliable sections, or route retrieved BOS through the same structured profile summary used by WebProfileReport.',
    'Use bos_section payloads with source_title equal to the actual BOS section heading.',
    'Pass one clean visible section at a time instead of one broad bos_profile excerpt.',
    'Keep original BOS output as source of truth and do not pass raw canonical profile JSON or hidden scoring objects.'
  ],
  validation_results: {
    node_check_script: 'pending',
    json_trace_parse: 'pending',
    git_diff_check: 'pending',
    npm_run_build: 'pending',
    privacy_scan: 'pending'
  },
  limits: [
    'No production UI debug was added.',
    'No model call was made by this diagnostic script.',
    'No full private BOS, BA, prompt, or model output is stored.',
    'Representative payload excerpts are sanitized and bounded.'
  ]
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(trace, null, 2)}\n`);
console.log(JSON.stringify({
  output_path: OUTPUT_PATH,
  payload_count: payloadSummaries.length,
  bos_section_label_count: bos[0]?.section_label_count || 0,
  ba_payload_count: ba.length,
  model_called: false,
  records_mutated: false
}, null, 2));
