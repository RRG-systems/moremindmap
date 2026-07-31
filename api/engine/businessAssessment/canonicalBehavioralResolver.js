const RANKED_SOURCE_PRECEDENCE = Object.freeze([
  ['rescoring_gpt.ranked_dimensions', (canonical) => canonical?.rescoring_gpt?.ranked_dimensions],
  ['rescoring_v1.ranked_dimensions', (canonical) => canonical?.rescoring_v1?.ranked_dimensions],
  ['ranked_dimensions', (canonical) => canonical?.ranked_dimensions],
  ['dimension_scores', (canonical) => canonical?.dimension_scores],
]);

const SCORE_FIELD_PRECEDENCE = Object.freeze([
  'display_score',
  'gpt_rescored_score',
  'rescored_score',
  'support_adjusted_score',
  'raw_score',
  'score',
]);

export function unwrapCanonicalBehavioralProfile(canonicalProfile) {
  return (
    canonicalProfile?.canonical_profile_json
    || canonicalProfile?.canonical_dossier?.canonical_profile_json
    || canonicalProfile?.canonical_dossier
    || canonicalProfile
    || {}
  );
}

function asRankedArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([dimension, item]) => ({
      ...(item && typeof item === 'object' ? item : { score: item }),
      dimension,
    }));
  }
  return [];
}

function selectRankedSource(canonical) {
  for (const [sourcePath, read] of RANKED_SOURCE_PRECEDENCE) {
    const ranked = asRankedArray(read(canonical));
    if (ranked.length > 0) return { sourcePath, ranked };
  }
  return { sourcePath: null, ranked: [] };
}

function resolveScore(item) {
  for (const field of SCORE_FIELD_PRECEDENCE) {
    const value = item?.[field];
    if (value === null || value === undefined || value === '') continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return { value: numeric, field };
  }
  return { value: null, field: null };
}

function resolveConfidence(item) {
  const candidates = [
    ['confidence', item?.confidence],
    ['confidence_score', item?.confidence_score],
  ];
  for (const [field, value] of candidates) {
    const numeric = Number(value);
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(numeric)) {
      return { value: numeric, field };
    }
  }
  return { value: null, field: null };
}

export function resolveCanonicalBehavioralData(canonicalProfile) {
  const canonical = unwrapCanonicalBehavioralProfile(canonicalProfile);
  const selected = selectRankedSource(canonical);
  const rankedDimensions = selected.ranked.map((item, index) => {
    const score = resolveScore(item);
    const confidence = resolveConfidence(item);
    return {
      dimension: item?.dimension || item?.name || item?.key || item?.label || null,
      score: score.value,
      rank: Number.isFinite(Number(item?.rank)) ? Number(item.rank) : index + 1,
      evidence_count: item?.evidence_count ?? item?.contributing_answer_count ?? null,
      confidence: confidence.value,
      evidence_band: item?.evidence_band ?? null,
      intensity_band: item?.intensity_band ?? null,
      provenance: {
        ranked_source: selected.sourcePath,
        score_source: score.field,
        confidence_source: confidence.field,
      },
    };
  });

  return {
    canonical,
    ranked_dimensions: rankedDimensions,
    provenance: {
      canonical_shape:
        canonicalProfile?.canonical_profile_json
          ? 'canonical_profile_json'
          : canonicalProfile?.canonical_dossier?.canonical_profile_json
            ? 'canonical_dossier.canonical_profile_json'
            : canonicalProfile?.canonical_dossier
              ? 'canonical_dossier'
              : 'canonical',
      ranked_source: selected.sourcePath,
      score_precedence: [...SCORE_FIELD_PRECEDENCE],
      ranked_dimension_count: rankedDimensions.length,
    },
  };
}

export { RANKED_SOURCE_PRECEDENCE, SCORE_FIELD_PRECEDENCE };
