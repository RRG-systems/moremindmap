import { buildBehavioralDNAInterpretation } from '../behavioralDNAInterpretation.js';

function unwrapCanonical(canonical) {
  return canonical?.canonical_profile_json || canonical || {};
}

function getRankedDimensions(data, rankedInput = []) {
  if (Array.isArray(rankedInput) && rankedInput.length > 0) return rankedInput;
  if (Array.isArray(data?.rescoring_gpt?.ranked_dimensions) && data.rescoring_gpt.ranked_dimensions.length > 0) {
    return data.rescoring_gpt.ranked_dimensions;
  }
  if (Array.isArray(data?.rescoring_v1?.ranked_dimensions) && data.rescoring_v1.ranked_dimensions.length > 0) {
    return data.rescoring_v1.ranked_dimensions;
  }
  return data?.ranked_dimensions || [];
}

function normalizeSection(section) {
  if (!section) return null;
  if (typeof section === 'string') return { body: section };

  return {
    headline: section.headline || section.title || null,
    summary: section.summary || null,
    body: section.body || section.primary_guidance || section.causal_interpretation || null,
    key_warning: section.key_warning || section.caution || null,
    notes: Array.isArray(section.notes) ? section.notes.slice(0, 5) : undefined,
    futures: Array.isArray(section.futures) ? section.futures.slice(0, 5) : undefined,
    render_source: section.render_source || section.renderSource || null,
  };
}

function compactRankedDimension(dimension, index) {
  return {
    rank: dimension.rank ?? index + 1,
    dimension: dimension.dimension,
    score: dimension.display_score ?? dimension.gpt_rescored_score ?? dimension.support_adjusted_score ?? dimension.score ?? null,
    support_adjusted_score: dimension.support_adjusted_score ?? null,
    evidence_count: dimension.evidence_count ?? dimension.contributing_answer_count ?? null,
    confidence: dimension.confidence ?? null,
    evidence_band: dimension.evidence_band ?? null,
    intensity_band: dimension.intensity_band ?? null,
    distance_from_neutral: dimension.distance_from_neutral ?? null,
    role: dimension.role || null,
    rationale: dimension.rationale || null,
  };
}

function getOneMove(narrative, behavioralIntelligence) {
  return normalizeSection(narrative?.recommendedNextStep)
    || normalizeSection(behavioralIntelligence?.domains?.theOneMove)
    || null;
}

function getScalingConstraint(narrative, behavioralIntelligence) {
  return normalizeSection(narrative?.strategicCeiling)
    || normalizeSection(behavioralIntelligence?.domains?.scalingConstraint)
    || null;
}

export function buildVisualDNAContextPacket({
  canonical,
  narrative = {},
  behavioralIntelligence = null,
  ranked = [],
  profileId = null,
  personName = null,
  company = null,
} = {}) {
  const data = unwrapCanonical(canonical);
  const rankedDimensions = getRankedDimensions(data, ranked);
  const behavioralDNA = buildBehavioralDNAInterpretation(data, rankedDimensions);
  const rescoring = data.rescoring_gpt || data.rescoring_v1 || {};
  const organization = data.metadata?.organization || {};

  return {
    packet_version: 'visual-dna-context-v1',
    profile: {
      profile_id: profileId || data.profile_id || canonical?.profile_id || null,
      person_name: personName || canonical?.person_name || data.metadata?.person_name || null,
      company: company || canonical?.company_name || data.metadata?.company_name || organization.company_name || organization.company || null,
      role_title: organization.role_title || null,
      profile_type: data.inferred_patterns?.profile_type || null,
    },
    scoring: {
      source: data.rescoring_gpt ? 'rescoring_gpt' : data.rescoring_v1 ? 'rescoring_v1' : 'baseline',
      ranked_dimensions: rankedDimensions.slice(0, 8).map(compactRankedDimension),
      dominance_profile: rescoring.dominance_profile || null,
      spread_profile: rescoring.spread_profile || null,
      tension_pairs: rescoring.tension_pairs || null,
      render_ready: rescoring.render_ready || null,
    },
    intelligence_stack: {
      behavioral_dna: behavioralDNA,
      executive_summary: normalizeSection(narrative?.executiveSummary),
      hidden_contradictions: normalizeSection(narrative?.hiddenContradictions),
      strategic_ceiling: normalizeSection(narrative?.strategicCeiling),
      team_experience: normalizeSection(narrative?.teamExperience),
      pressure_mechanics: normalizeSection(narrative?.systemUnderStrain || behavioralIntelligence?.domains?.pressureMechanics),
      scaling_constraint: getScalingConstraint(narrative, behavioralIntelligence),
      facilitator_notes: normalizeSection(narrative?.facilitatorNotes),
      five_futures: normalizeSection(narrative?.fiveFutures),
      one_move: getOneMove(narrative, behavioralIntelligence),
    },
  };
}

export default buildVisualDNAContextPacket;
