import { boundedText, stableHash } from './contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const FORBIDDEN = /compatibility score|exploit|hot[- ]?button|personality script|guaranteed fit|close them|overcome objection/iu;

function cleanStrings(value) {
  if (Array.isArray(value)) return value.map(cleanStrings);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cleanStrings(child)]));
  return typeof value === 'string' ? boundedText(value, 2400) : value;
}

export function assembleRecruitingContext({ membership, invitation, managerBos, recruitBos, recruitBa = null, opportunity, managerEvidence = [] }) {
  if (!membership?.membership_id || !invitation?.candidate_id) throw new Error('RECRUITING_CONTEXT_SCOPE_REQUIRED');
  if (!invitation.bos_profile_id || !recruitBos) throw new Error('RECRUITING_CONTEXT_RECRUIT_BOS_REQUIRED');
  const context = {
    contract: 'recruiting_frontier_context_v1',
    scope: {
      membership_id_hash: stableHash(membership.membership_id),
      enterprise_id_hash: stableHash(membership.enterprise_id),
      candidate_id_hash: stableHash(invitation.candidate_id),
      purpose: 'RECRUITING_INTELLIGENCE',
    },
    truth_classes: {
      recruiter_reality: clone(managerBos || { status: 'MISSING', missing: ['Manager BOS unavailable.'] }),
      recruit_reality: { bos: clone(recruitBos), ba: recruitBa ? clone(recruitBa) : null, business_missing: !recruitBa },
      manager_supplied_evidence: managerEvidence.map((item) => ({ evidence_id: item.evidence_id, type: item.type, claim: item.claim, source: item.source, source_date: item.source_date, truth_class: 'MANAGER_SUPPLIED_EVIDENCE' })),
      local_opportunity_authority: (opportunity?.items || []).map((item) => ({
        opportunity_evidence_id: item.opportunity_evidence_id,
        category: item.category,
        scope: item.scope,
        statement: item.statement,
        status: item.status,
        source: item.source,
        source_date: item.source_date,
        freshness: item.freshness || 'CURRENT_AS_RECORDED',
        constraints: item.constraints || [],
        counterevidence: item.counterevidence || [],
      })),
    },
    role_environment_doctrine: {
      vertical: 'REAL_ESTATE_AGENT',
      rule: 'Multiple materially different behavioral patterns can succeed. Reason about environment, support, work demands, friction, and growth potential without scoring personality fit.',
      success_patterns: ['relationship-led advisor', 'fast-moving opportunity creator', 'deliberate systems builder', 'specialist market expert'],
    },
    prohibitions: ['no score', 'no script', 'no manipulation', 'no forced angle count', 'no unsupported local promise'],
  };
  return Object.freeze(cleanStrings(context));
}

function string(value, field) {
  if (!boundedText(value, 2400)) throw new Error(`RECRUITING_INTELLIGENCE_${field.toUpperCase()}_REQUIRED`);
}

function strings(values, field, max = 8) {
  if (!Array.isArray(values) || values.length > max) throw new Error(`RECRUITING_INTELLIGENCE_${field.toUpperCase()}_INVALID`);
  values.forEach((value) => string(value, field));
}

export function validateRecruitingIntelligence(output, context) {
  if (!output || typeof output !== 'object') throw new Error('RECRUITING_INTELLIGENCE_OUTPUT_INVALID');
  if (FORBIDDEN.test(JSON.stringify(output))) throw new Error('RECRUITING_INTELLIGENCE_MANIPULATION_LANGUAGE_DENIED');
  string(output.understand_this_recruit?.summary, 'understanding');
  strings(output.understand_this_recruit?.important_realities, 'important_realities');
  string(output.bilateral_communication?.advantage, 'communication_advantage');
  string(output.bilateral_communication?.recruiter_watchout, 'recruiter_watchout');
  string(output.bilateral_communication?.adaptation, 'adaptation');
  const angles = output.authentic_angles;
  if (!Array.isArray(angles) || angles.length > 3) throw new Error('RECRUITING_INTELLIGENCE_ANGLE_COUNT_INVALID');
  const allowedRecruitEvidence = new Set([
    ...(context.truth_classes.manager_supplied_evidence || []).map((item) => item.evidence_id),
    ...Object.keys(context.truth_classes.recruit_reality.bos?.evidence || {}),
    ...Object.keys(context.truth_classes.recruit_reality.ba?.evidence || {}),
  ]);
  const allowedOpportunity = new Set((context.truth_classes.local_opportunity_authority || []).filter((item) => ['SUPPORTED', 'CONDITIONAL'].includes(item.status)).map((item) => item.opportunity_evidence_id));
  const titles = new Set();
  for (const angle of angles) {
    for (const field of ['title', 'recruit_need', 'current_reality', 'locally_supported_help', 'rationale', 'validating_question', 'uncertainty']) string(angle[field], `angle_${field}`);
    if (titles.has(angle.title.toLowerCase())) throw new Error('RECRUITING_INTELLIGENCE_ANGLE_DUPLICATE');
    titles.add(angle.title.toLowerCase());
    if (!Array.isArray(angle.recruit_evidence_ids) || angle.recruit_evidence_ids.length < 1) throw new Error('RECRUITING_INTELLIGENCE_ANGLE_RECRUIT_EVIDENCE_REQUIRED');
    if (!Array.isArray(angle.opportunity_evidence_ids) || angle.opportunity_evidence_ids.length < 1) throw new Error('RECRUITING_INTELLIGENCE_ANGLE_OPPORTUNITY_EVIDENCE_REQUIRED');
    if (allowedRecruitEvidence.size && angle.recruit_evidence_ids.some((id) => !allowedRecruitEvidence.has(id))) throw new Error('RECRUITING_INTELLIGENCE_RECRUIT_EVIDENCE_SCOPE_DENIED');
    if (angle.opportunity_evidence_ids.some((id) => !allowedOpportunity.has(id))) throw new Error('RECRUITING_INTELLIGENCE_OPPORTUNITY_EVIDENCE_SCOPE_DENIED');
  }
  strings(output.withheld_angles || [], 'withheld_angles', 5);
  strings(output.success_environment?.natural_success_patterns, 'success_patterns');
  strings(output.success_environment?.supportive_conditions, 'supportive_conditions');
  strings(output.success_environment?.likely_frictions, 'likely_frictions');
  strings(output.missing_evidence || [], 'missing_evidence', 12);
  for (const field of ['start_here', 'your_watchout', 'do_not_assume', 'next_step_if_fit_is_real']) string(output.meeting_plan?.[field], `meeting_${field}`);
  strings(output.meeting_plan?.learn || [], 'meeting_learn');
  strings(output.meeting_plan?.listen_for || [], 'meeting_listen_for');
  strings(output.meeting_plan?.supported_paths_if_confirmed || [], 'meeting_supported_paths');
  return true;
}

export function buildRecruitingProviderRequest(context, { model = 'gpt-5.6-sol' } = {}) {
  return {
    model,
    store: false,
    background: false,
    reasoning: { effort: 'high' },
    max_output_tokens: 12000,
    instructions: [
      'Create bilateral Recruiting Intelligence for a real-estate manager preparing to help a specific agent think about their business.',
      'Use only the supplied four truth classes. Local help must be supported by Local Opportunity Authority evidence.',
      'Return zero to three authentic angles; fewer is correct when support is weak.',
      'Never create a score, personality script, persuasion exploit, brokerage pitch, or guaranteed claim.',
      'Every angle must cite allowed recruit evidence IDs and local opportunity evidence IDs.',
      'Keep the Meeting Plan useful five to ten minutes before a real conversation and guidance rather than a script.',
    ].join('\n'),
    input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify(context) }] }],
    text: { verbosity: 'low', format: RECRUITING_OUTPUT_SCHEMA },
  };
}

const text = { type: 'string', minLength: 1, maxLength: 2400 };
const textArray = (maxItems = 8) => ({ type: 'array', maxItems, items: text });

export const RECRUITING_OUTPUT_SCHEMA = Object.freeze({
  type: 'json_schema', name: 'recruiting_intelligence_v1', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    required: ['understand_this_recruit', 'bilateral_communication', 'authentic_angles', 'withheld_angles', 'success_environment', 'missing_evidence', 'meeting_plan'],
    properties: {
      understand_this_recruit: { type: 'object', additionalProperties: false, required: ['summary', 'important_realities'], properties: { summary: text, important_realities: textArray() } },
      bilateral_communication: { type: 'object', additionalProperties: false, required: ['advantage', 'recruiter_watchout', 'adaptation'], properties: { advantage: text, recruiter_watchout: text, adaptation: text } },
      authentic_angles: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['title', 'recruit_need', 'current_reality', 'locally_supported_help', 'rationale', 'validating_question', 'uncertainty', 'recruit_evidence_ids', 'opportunity_evidence_ids'], properties: { title: text, recruit_need: text, current_reality: text, locally_supported_help: text, rationale: text, validating_question: text, uncertainty: text, recruit_evidence_ids: textArray(8), opportunity_evidence_ids: textArray(8) } } },
      withheld_angles: textArray(5),
      success_environment: { type: 'object', additionalProperties: false, required: ['natural_success_patterns', 'supportive_conditions', 'likely_frictions'], properties: { natural_success_patterns: textArray(), supportive_conditions: textArray(), likely_frictions: textArray() } },
      missing_evidence: textArray(12),
      meeting_plan: { type: 'object', additionalProperties: false, required: ['start_here', 'learn', 'listen_for', 'your_watchout', 'supported_paths_if_confirmed', 'do_not_assume', 'next_step_if_fit_is_real'], properties: { start_here: text, learn: textArray(), listen_for: textArray(), your_watchout: text, supported_paths_if_confirmed: textArray(), do_not_assume: text, next_step_if_fit_is_real: text } },
    },
  },
});

export async function generateRecruitingIntelligence({ context, provider }) {
  if (typeof provider !== 'function') throw new Error('RECRUITING_FRONTIER_PROVIDER_REQUIRED');
  const request = buildRecruitingProviderRequest(context);
  const result = await provider(request);
  const output = cleanStrings(result?.output || result);
  validateRecruitingIntelligence(output, context);
  return {
    contract: 'recruiting_intelligence_projection_v1',
    output,
    source_context_hash: stableHash(context),
    projection_hash: stableHash(output),
    provider_receipt: {
      model: result?.receipt?.model || request.model,
      store: false,
      request_hash: stableHash(request),
      raw_request_persisted: false,
      raw_response_persisted: false,
      usage: result?.receipt?.usage || null,
    },
  };
}
