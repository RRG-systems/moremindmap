export const BOS_TRUTHFULNESS_VERSION = 'bos_truthfulness_v1';

export const CLAIM_CLASSIFICATIONS = Object.freeze({
  MEASURED: 'Measured',
  INFERRED: 'Inferred',
  ESTIMATED: 'Estimated',
  HYPOTHESIS: 'Hypothesis',
  INSUFFICIENT: 'Insufficient Evidence',
});

export const EVIDENCE_SUFFICIENCY = Object.freeze({
  SUFFICIENT: 'sufficient',
  INSUFFICIENT: 'insufficient',
});

export function confidenceBand(score) {
  const numeric = Number(score);
  if (!Number.isFinite(numeric) || numeric < 0.4) return 'very_low';
  if (numeric < 0.6) return 'low';
  if (numeric < 0.8) return 'moderate';
  return 'high';
}

function normalizeEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .filter(Boolean)
    .map((item) => ({
      source_type: item.source_type || 'assessment_answer',
      source_path: item.source_path || null,
      question_id: item.question_id ?? null,
      evidence_role: item.evidence_role || null,
      direct: item.direct !== false,
      excerpt: item.excerpt || null,
      signal_ids: Array.isArray(item.signal_ids) ? [...item.signal_ids] : [],
      aggregate_count: Number.isFinite(Number(item.aggregate_count))
        ? Math.max(0, Number(item.aggregate_count))
        : null,
    }));
}

function normalizeProvenance(provenance) {
  return (Array.isArray(provenance) ? provenance : [])
    .filter(Boolean)
    .map((item) => ({
      source: item.source || null,
      path: item.path || null,
      method: item.method || null,
      version: item.version || BOS_TRUTHFULNESS_VERSION,
    }));
}

export function createEvidenceContract({
  claimId,
  claim,
  classification = CLAIM_CLASSIFICATIONS.INFERRED,
  evidence = [],
  provenance = [],
  confidence = 0,
  minimumEvidence = 1,
  reportedEvidenceCount = null,
  validation = { valid: true, failures: [] },
  abstentionReason = null,
  alternativeExplanations = [],
}) {
  const normalizedEvidence = normalizeEvidence(evidence);
  const suppliedProvenance = normalizeProvenance(provenance);
  const score = Number.isFinite(Number(confidence))
    ? Math.min(1, Math.max(0, Number(confidence)))
    : 0;
  const hasReportedEvidenceCount = reportedEvidenceCount !== null
    && reportedEvidenceCount !== undefined
    && Number.isFinite(Number(reportedEvidenceCount));
  const evidenceCount = hasReportedEvidenceCount
    ? Math.max(0, Number(reportedEvidenceCount))
    : normalizedEvidence.length;
  const enoughEvidence = evidenceCount >= minimumEvidence;
  const valid = validation?.valid !== false;
  const sufficient = enoughEvidence && valid && Boolean(String(claim || '').trim());
  const finalClassification = sufficient
    ? classification
    : CLAIM_CLASSIFICATIONS.INSUFFICIENT;
  const reason = sufficient
    ? null
    : abstentionReason
      || validation?.failures?.[0]
      || (enoughEvidence ? 'claim_validation_failed' : 'minimum_evidence_not_met');
  const normalizedProvenance = suppliedProvenance.length > 0
    ? suppliedProvenance
    : normalizeProvenance([{
        source: 'BOS truthfulness abstention policy',
        path: `truthfulness_v1.claims.${claimId}`,
        method: 'fail-closed when claim provenance is unavailable',
      }]);

  return Object.freeze({
    claim_id: claimId,
    claim: sufficient ? String(claim).trim() : CLAIM_CLASSIFICATIONS.INSUFFICIENT,
    proposed_claim: String(claim || '').trim() || null,
    classification: finalClassification,
    proposed_classification: classification,
    evidence: Object.freeze(normalizedEvidence),
    provenance: Object.freeze(normalizedProvenance),
    confidence: Object.freeze({
      score: sufficient ? score : Math.min(score, 0.39),
      band: confidenceBand(sufficient ? score : Math.min(score, 0.39)),
      calibrated: false,
      basis: sufficient
        ? 'deterministic evidence sufficiency rule'
        : 'abstention rule',
    }),
    evidence_sufficiency: Object.freeze({
      status: sufficient
        ? EVIDENCE_SUFFICIENCY.SUFFICIENT
        : EVIDENCE_SUFFICIENCY.INSUFFICIENT,
      evidence_count: evidenceCount,
      minimum_required: minimumEvidence,
    }),
    validation: Object.freeze({
      valid: sufficient,
      failures: Object.freeze([...(validation?.failures || [])]),
    }),
    abstention: Object.freeze({
      abstained: !sufficient,
      reason,
    }),
    alternative_explanations: Object.freeze(
      (Array.isArray(alternativeExplanations) ? alternativeExplanations : [])
        .filter(Boolean)
        .map(String),
    ),
  });
}

export function isSufficientClaim(claim) {
  return claim?.evidence_sufficiency?.status === EVIDENCE_SUFFICIENCY.SUFFICIENT
    && claim?.abstention?.abstained === false;
}
