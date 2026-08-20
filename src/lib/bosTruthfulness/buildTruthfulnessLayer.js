import { DIMENSION_LABELS } from '../../../api/engine/dimensionMap.js';
import {
  BOS_TRUTHFULNESS_VERSION,
  CLAIM_CLASSIFICATIONS,
  createEvidenceContract,
  isSufficientClaim,
} from './evidenceContract.js';
import { validateClaim } from './claimValidator.js';
import { analyzeWrittenEvidence, toPublicWrittenEvidence } from './writtenEvidence.js';

const DOMAIN_DEFINITIONS = Object.freeze([
  ['decision_style', 'decision-style', ['q20'], 1],
  ['motivation', 'motivation', ['q2', 'q27'], 2],
  ['conflict_style', 'conflict-style', ['q24', 'q25'], 2],
  ['learning_style', 'learning-style', ['q14'], 1],
  ['stress_response', 'pressure-response', ['q17', 'q24'], 2],
  ['leadership_style', 'leadership', ['q22', 'q26'], 2],
  ['execution_style', 'execution', ['q26', 'q28'], 2],
  ['communication_style', 'communication', ['q25'], 1],
  ['adaptability', 'adaptability', ['q14', 'q20'], 2],
]);

const SECTION_CLAIM_MAP = Object.freeze({
  profileDNA: ['core_operating_pattern'],
  communicationStyle: ['communication_style'],
  hiddenContradictions: ['contradictions'],
  strategicCeiling: ['strategic_ceiling'],
  coachingLeverage: ['coaching_focus'],
  teamExperience: ['team_experience'],
  facilitatorNotes: ['coaching_focus'],
  fiveFutures: ['future_trajectory'],
  recommendedNextStep: ['recommended_next_step'],
  executiveSummary: ['core_operating_pattern', 'stress_response'],
});

function unwrapCanonical(canonical) {
  return canonical?.canonical_profile_json
    || canonical?.canonical_dossier?.canonical_profile_json
    || canonical
    || {};
}

function scoreValue(item) {
  const value = item?.support_adjusted_score
    ?? item?.display_score
    ?? item?.gpt_rescored_score
    ?? item?.rescored_score
    ?? item?.score
    ?? item?.raw_score;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function evidenceForWrittenEntry(entry) {
  if (!entry?.answer_present || !entry.source_path || entry.signals.length === 0) return null;
  return {
    source_type: 'assessment_answer',
    source_path: entry.source_path,
    question_id: entry.question_id,
    evidence_role: entry.evidence_role,
    direct: true,
    excerpt: entry.excerpt,
    signal_ids: entry.signals.map(({ signal_id }) => signal_id),
  };
}

function provenanceForWrittenEntry(entry) {
  if (!entry?.source_path) return null;
  return {
    source: 'BOS retained written answer',
    path: entry.source_path,
    method: `question-aware extraction:${entry.evidence_role}`,
  };
}

function signalSummary(entries) {
  return [...new Set(entries.flatMap((entry) => entry.signals.map(({ label }) => label)))];
}

function buildWrittenDomainClaim(analysis, claimId, domainLabel, questionKeys, minimumEvidence) {
  const entries = questionKeys
    .map((key) => analysis.questions[key])
    .filter(Boolean);
  const evidencedEntries = entries.filter((entry) => entry.answer_present && entry.signals.length > 0);
  const labels = signalSummary(evidencedEntries);
  const questionLabels = evidencedEntries.map(({ question_id }) => `Q${question_id}`);
  const claim = labels.length > 0
    ? `Written responses to ${questionLabels.join(' and ')} explicitly contain these observable signals: ${labels.join(', ')}. This supports an inferred ${domainLabel} pattern for this assessment, not an observed performance conclusion.`
    : `The submitted written responses support an inferred ${domainLabel} pattern.`;
  const evidence = evidencedEntries.map(evidenceForWrittenEntry).filter(Boolean);
  const provenance = evidencedEntries.map(provenanceForWrittenEntry).filter(Boolean);
  const sourceTexts = evidencedEntries.map(({ source_text }) => source_text);
  const confidence = Math.min(0.79, 0.42 + evidence.length * 0.1 + labels.length * 0.03);
  const validation = validateClaim({
    claim,
    classification: CLAIM_CLASSIFICATIONS.INFERRED,
    evidence,
    provenance,
    sourceTexts,
  });

  return createEvidenceContract({
    claimId,
    claim,
    classification: CLAIM_CLASSIFICATIONS.INFERRED,
    evidence,
    provenance,
    confidence,
    minimumEvidence,
    validation,
    abstentionReason: evidencedEntries.length < minimumEvidence
      ? `insufficient_question_coverage:${questionKeys.join(',')}`
      : null,
    alternativeExplanations: [
      'The response may describe a temporary context rather than a stable operating pattern.',
      'Self-report language may reflect aspiration, recall, or impression management.',
    ],
  });
}

function buildDimensionClaims(data) {
  const ranked = Array.isArray(data.ranked_dimensions) ? data.ranked_dimensions : [];
  const scoreByDimension = data.dimension_scores || {};
  const claims = [];

  for (const [dimension, label] of Object.entries(DIMENSION_LABELS)) {
    const rankedItem = ranked.find((item) => item.dimension === dimension) || {};
    const scoreItem = scoreByDimension[dimension] || {};
    const evidenceCount = Number(
      rankedItem.evidence_count
      ?? rankedItem.contributing_answer_count
      ?? scoreItem.evidence_count
      ?? scoreItem.contributing_answer_count
      ?? 0,
    );
    const contributing = rankedItem.contributing_answers
      || scoreItem.contributing_answers
      || [];
    const score = scoreValue({ ...scoreItem, ...rankedItem });
    const evidence = contributing.slice(0, Math.max(0, evidenceCount)).map((questionId) => ({
      source_type: 'layer_1_measurement',
      source_path: `canonical_profile_json.intake_answers.q${questionId}`,
      question_id: questionId,
      direct: true,
      signal_ids: [`dimension:${dimension}`],
    }));
    if (evidence.length === 0 && evidenceCount > 0) {
      evidence.push({
        source_type: 'layer_1_aggregate_measurement',
        source_path: `canonical_profile_json.ranked_dimensions.${dimension}`,
        direct: true,
        signal_ids: [`dimension:${dimension}`],
        aggregate_count: evidenceCount,
      });
    }
    const provenance = [{
      source: 'BOS Layer 1 measurement foundation',
      path: `ranked_dimensions.${dimension}`,
      method: 'preserved deterministic Layer 1 score',
    }];
    const claim = `${label} has a measured Layer 1 topology score of ${score.toFixed(2)} with ${evidenceCount} contributing answer signals.`;
    const validation = validateClaim({
      claim,
      classification: CLAIM_CLASSIFICATIONS.MEASURED,
      evidence,
      provenance,
    });

    claims.push(createEvidenceContract({
      claimId: `dimension_${dimension}`,
      claim,
      classification: CLAIM_CLASSIFICATIONS.MEASURED,
      evidence,
      provenance,
      confidence: rankedItem.confidence ?? scoreItem.confidence ?? 0,
      minimumEvidence: 3,
      reportedEvidenceCount: evidenceCount,
      validation,
      abstentionReason: evidenceCount < 3 ? `sparse_dimension_evidence:${dimension}` : null,
    }));
  }

  return claims;
}

function buildCoreOperatingClaim(data, dimensionClaims) {
  const ranked = (Array.isArray(data.ranked_dimensions) ? data.ranked_dimensions : [])
    .filter((item) => Number(item.evidence_count ?? item.contributing_answer_count ?? 0) > 0)
    .slice(0, 2);
  const evidence = ranked.map((item) => ({
    source_type: 'layer_1_measurement',
    source_path: `canonical_profile_json.ranked_dimensions.${item.dimension}`,
    direct: false,
    signal_ids: [`dimension:${item.dimension}`],
  }));
  const provenance = ranked.map((item) => ({
    source: 'BOS Layer 1 measurement foundation',
    path: `ranked_dimensions.${item.dimension}`,
    method: 'rank-order interpretation without score modification',
  }));
  const labels = ranked.map((item) => DIMENSION_LABELS[item.dimension] || item.dimension);
  const claim = labels.length === 2
    ? `Layer 1 measurement places ${labels[0]} and ${labels[1]} as the two highest supported dimensions in this assessment. This is an inferred operating emphasis, not a fixed personality type.`
    : 'The Layer 1 score pattern supports an inferred operating emphasis.';
  const confidence = Math.min(...ranked.map((item) => Number(item.confidence ?? 0.5)), 0.79);
  const validation = validateClaim({
    claim,
    classification: CLAIM_CLASSIFICATIONS.INFERRED,
    evidence,
    provenance,
  });
  const supportedDimensionIds = new Set(
    dimensionClaims.filter(isSufficientClaim).map(({ claim_id }) => claim_id),
  );
  const topDimensionsSupported = ranked.length === 2
    && ranked.every((item) => supportedDimensionIds.has(`dimension_${item.dimension}`));

  return createEvidenceContract({
    claimId: 'core_operating_pattern',
    claim,
    classification: CLAIM_CLASSIFICATIONS.INFERRED,
    evidence: topDimensionsSupported ? evidence : [],
    provenance,
    confidence,
    minimumEvidence: 2,
    validation,
    abstentionReason: topDimensionsSupported ? null : 'top_dimensions_do_not_meet_evidence_threshold',
    alternativeExplanations: [
      'The measured ordering may reflect current role demands or recent context.',
      'Close scores may indicate distributed operating preferences rather than clear dominance.',
    ],
  });
}

function buildExplicitAbstention(claimId, proposedClaim, classification, reason) {
  return createEvidenceContract({
    claimId,
    claim: proposedClaim,
    classification,
    evidence: [],
    provenance: [{
      source: 'BOS truthfulness abstention policy',
      path: `truthfulness_v1.claims.${claimId}`,
      method: 'fail-closed evidence sufficiency rule',
    }],
    confidence: 0,
    minimumEvidence: 1,
    validation: { valid: false, failures: [reason] },
    abstentionReason: reason,
  });
}

function buildRecommendationClaim(coreClaim, systemsClaim) {
  const sources = [coreClaim, systemsClaim].filter(isSufficientClaim);
  const evidence = sources.flatMap((claim) => claim.evidence).slice(0, 8);
  const provenance = sources.flatMap((claim) => claim.provenance).slice(0, 8);
  const claim = 'Hypothesis to test: make decision criteria, ownership, and review points explicit, then observe whether follow-through becomes more consistent.';
  const validation = validateClaim({
    claim,
    classification: CLAIM_CLASSIFICATIONS.HYPOTHESIS,
    evidence,
    provenance,
  });

  return createEvidenceContract({
    claimId: 'recommended_next_step',
    claim,
    classification: CLAIM_CLASSIFICATIONS.HYPOTHESIS,
    evidence,
    provenance,
    confidence: sources.length >= 2 ? 0.65 : 0.45,
    minimumEvidence: 2,
    validation,
    abstentionReason: sources.length === 0 ? 'no_supported_operating_evidence' : null,
    alternativeExplanations: [
      'A different intervention may fit the operating environment better.',
      'The hypothesis requires observed follow-through data before it can be treated as effective.',
    ],
  });
}

export function buildBosTruthfulnessLayer(canonical) {
  const data = unwrapCanonical(canonical);
  const writtenAnalysis = analyzeWrittenEvidence(canonical);
  const dimensionClaims = buildDimensionClaims(data);
  const coreClaim = buildCoreOperatingClaim(data, dimensionClaims);
  const domainClaims = DOMAIN_DEFINITIONS.map(([claimId, label, questionKeys, minimum]) =>
    buildWrittenDomainClaim(writtenAnalysis, claimId, label, questionKeys, minimum)
  );
  const domainById = Object.fromEntries(domainClaims.map((claim) => [claim.claim_id, claim]));
  const recommendation = buildRecommendationClaim(coreClaim, domainById.execution_style);
  const coachingFocus = Object.freeze({
    ...recommendation,
    claim_id: 'coaching_focus',
  });
  const abstentions = [
    buildExplicitAbstention(
      'contradictions',
      'A stable contradiction exists between the submitted self-model and observed behavior.',
      CLAIM_CLASSIFICATIONS.INFERRED,
      'no_independent_behavioral_observation',
    ),
    buildExplicitAbstention(
      'team_experience',
      'Other people consistently experience this person in a specific way.',
      CLAIM_CLASSIFICATIONS.ESTIMATED,
      'no_external_observer_evidence',
    ),
    buildExplicitAbstention(
      'strategic_ceiling',
      'The assessment predicts a specific organizational ceiling.',
      CLAIM_CLASSIFICATIONS.ESTIMATED,
      'no_longitudinal_outcome_evidence',
    ),
    buildExplicitAbstention(
      'future_trajectory',
      'The assessment predicts a specific future trajectory or timeline.',
      CLAIM_CLASSIFICATIONS.ESTIMATED,
      'no_longitudinal_outcome_evidence',
    ),
  ];
  const claims = [
    ...dimensionClaims,
    coreClaim,
    ...domainClaims,
    coachingFocus,
    recommendation,
    ...abstentions,
  ];
  const sufficient = claims.filter(isSufficientClaim);
  const classifications = Object.values(CLAIM_CLASSIFICATIONS);

  return Object.freeze({
    version: BOS_TRUTHFULNESS_VERSION,
    authority: 'deterministic_layer_2',
    measurement_boundary: Object.freeze({
      layer_1_scores_modified: false,
      gpt_used_for_measurement: false,
      downstream_contracts_modified: false,
      doctrine: 'truthfulness_over_presentation',
    }),
    written_evidence: Object.freeze(toPublicWrittenEvidence(writtenAnalysis)),
    claims: Object.freeze(claims),
    claims_by_id: Object.freeze(Object.fromEntries(claims.map((claim) => [claim.claim_id, claim]))),
    section_claim_map: SECTION_CLAIM_MAP,
    summary: Object.freeze({
      total_claims: claims.length,
      sufficient_claims: sufficient.length,
      insufficient_claims: claims.length - sufficient.length,
      classification_counts: Object.freeze(Object.fromEntries(
        classifications.map((classification) => [
          classification,
          claims.filter((claim) => claim.classification === classification).length,
        ]),
      )),
      written_questions_expected: writtenAnalysis.question_count,
      written_questions_answered: writtenAnalysis.answered_count,
      written_signals_found: writtenAnalysis.signal_count,
    }),
  });
}

export function getOrBuildBosTruthfulnessLayer(canonical) {
  return buildBosTruthfulnessLayer(canonical);
}

export { DOMAIN_DEFINITIONS, SECTION_CLAIM_MAP };

export default buildBosTruthfulnessLayer;
