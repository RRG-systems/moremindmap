import {
  ALLOWED_CLASSIFICATIONS,
  BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT,
  BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  BOS_LAYER2_VERSION,
  INSUFFICIENT_EVIDENCE,
  LAYER3_SURFACE_ROLES,
  TRANSLATION_FORMATS,
} from './contracts.js';

const DIMENSION_RECOGNITION_CUES = Object.freeze({
  dimension_vector: 'orienting toward clear direction',
  dimension_velocity: 'maintaining pace and forward movement',
  dimension_signal: 'noticing relational signals and shifts between people',
  dimension_fidelity: 'checking detail and precision',
  dimension_leverage: 'shaping attention, positioning, or influence',
  dimension_flex: 'adjusting as conditions change',
  dimension_framework: 'creating structure, sequence, and repeatable process',
  dimension_horizon: 'holding the longer-term view while deciding',
});

const FORMAT_BLOCK_KINDS = Object.freeze({
  [TRANSLATION_FORMATS.EXECUTIVE]: ['summary', 'recognition', 'self_check'],
  [TRANSLATION_FORMATS.OVERVIEW]: ['summary', 'recognition', 'self_check'],
  [TRANSLATION_FORMATS.SCORE]: ['recognition', 'self_check'],
  [TRANSLATION_FORMATS.ONE_MOVE]: ['action', 'observation', 'limitation'],
  [TRANSLATION_FORMATS.ABSTENTION]: ['limitation'],
  [TRANSLATION_FORMATS.VISUAL_DNA]: ['summary', 'limitation'],
  [TRANSLATION_FORMATS.FIVE_FUTURES]: ['summary', 'recognition', 'limitation'],
  [TRANSLATION_FORMATS.TEAM]: ['summary', 'recognition', 'limitation'],
});

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function hashSemanticValue(value) {
  const text = stableStringify(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function cleanString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function projectEvidenceReference(item = {}) {
  return {
    source_type: cleanString(item.source_type, 'unknown'),
    question_id: item.question_id ?? null,
    evidence_role: item.evidence_role ?? null,
    direct: item.direct !== false,
    signal_ids: Array.isArray(item.signal_ids) ? item.signal_ids.map(String) : [],
    aggregate_count: item.aggregate_count !== null
      && item.aggregate_count !== undefined
      && Number.isFinite(Number(item.aggregate_count))
      ? Number(item.aggregate_count)
      : null,
  };
}

function projectProvenanceReference(item = {}) {
  return {
    source: item.source ?? null,
    method: item.method ?? null,
    version: item.version ?? null,
  };
}

export function projectClaimContract(claim = {}) {
  const classification = ALLOWED_CLASSIFICATIONS.includes(claim.classification)
    ? claim.classification
    : INSUFFICIENT_EVIDENCE;
  const sufficiencyStatus = claim.evidence_sufficiency?.status === 'sufficient'
    ? 'sufficient'
    : 'insufficient';
  const abstained = sufficiencyStatus !== 'sufficient'
    || claim.abstention?.abstained !== false;

  return {
    claim_id: cleanString(claim.claim_id),
    claim: abstained ? INSUFFICIENT_EVIDENCE : cleanString(claim.claim),
    classification: abstained ? INSUFFICIENT_EVIDENCE : classification,
    confidence: {
      score: Number.isFinite(Number(claim.confidence?.score))
        ? Number(claim.confidence.score)
        : 0,
      band: cleanString(claim.confidence?.band, 'very_low'),
      calibrated: claim.confidence?.calibrated === true,
      basis: cleanString(claim.confidence?.basis),
    },
    evidence_sufficiency: {
      status: abstained ? 'insufficient' : 'sufficient',
      evidence_count: Number.isFinite(Number(claim.evidence_sufficiency?.evidence_count))
        ? Number(claim.evidence_sufficiency.evidence_count)
        : 0,
      minimum_required: Number.isFinite(Number(claim.evidence_sufficiency?.minimum_required))
        ? Number(claim.evidence_sufficiency.minimum_required)
        : 1,
    },
    abstention: {
      abstained,
      reason: abstained ? cleanString(claim.abstention?.reason, 'insufficient_evidence') : null,
    },
    alternative_explanations: Array.isArray(claim.alternative_explanations)
      ? claim.alternative_explanations.filter(Boolean).map(String)
      : [],
    evidence_refs: Array.isArray(claim.evidence)
      ? claim.evidence.map(projectEvidenceReference)
      : [],
    provenance_refs: Array.isArray(claim.provenance)
      ? claim.provenance.map(projectProvenanceReference)
      : [],
  };
}

function uniqueClaims(claims) {
  const seen = new Set();
  return (Array.isArray(claims) ? claims : [])
    .map(projectClaimContract)
    .filter((claim) => {
      if (!claim.claim_id || seen.has(claim.claim_id)) return false;
      seen.add(claim.claim_id);
      return true;
    });
}

function protectedScoreValues(score, rank) {
  if (!score) return {};
  const numeric = Number(score.score);
  return {
    dimension: cleanString(score.dimensionTechnical || score.dimension),
    display_name: cleanString(score.displayName || score.dimension),
    score: Number.isFinite(numeric) ? numeric : null,
    classification: cleanString(score.classification),
    rank,
  };
}

function hasSufficientClaim(claims) {
  return (claims || []).some(isSufficientProjectedClaim);
}

function outputFormat(id, role, claims) {
  if (!hasSufficientClaim(claims)) return TRANSLATION_FORMATS.ABSTENTION;
  if (id === 'overview.executive-summary') return TRANSLATION_FORMATS.EXECUTIVE;
  if (role === LAYER3_SURFACE_ROLES.SCORE) return TRANSLATION_FORMATS.SCORE;
  if (role === LAYER3_SURFACE_ROLES.ONE_MOVE) return TRANSLATION_FORMATS.ONE_MOVE;
  if (role === LAYER3_SURFACE_ROLES.FIVE_FUTURES) return TRANSLATION_FORMATS.FIVE_FUTURES;
  if (role === LAYER3_SURFACE_ROLES.TEAM) return TRANSLATION_FORMATS.TEAM;
  if (role === LAYER3_SURFACE_ROLES.VISUAL_DNA) return TRANSLATION_FORMATS.VISUAL_DNA;
  return TRANSLATION_FORMATS.OVERVIEW;
}

function customerGoal(id, format) {
  if (format === TRANSLATION_FORMATS.ABSTENTION) {
    return 'Explain once, in ordinary language, what this assessment cannot establish and why it remains open.';
  }
  if (format === TRANSLATION_FORMATS.SCORE) {
    return 'Help the customer recognize how this measured tendency may show up without narrating measurement mechanics.';
  }
  if (format === TRANSLATION_FORMATS.ONE_MOVE) {
    return 'Turn the supported hypothesis into one concrete test and one thing to observe.';
  }
  if (format === TRANSLATION_FORMATS.VISUAL_DNA) {
    return 'Summarize the relative score pattern in clear language without inferring unsupported risks or outcomes.';
  }
  if (id === 'overview.executive-summary') {
    return 'Give the customer a concise, recognizable account of the strongest supported pattern and pressure response.';
  }
  return 'Explain the supported pattern in recognizable, non-technical language and invite honest self-checking.';
}

function recognitionCuesForClaims(claims, additionalCues = []) {
  const claimCues = (claims || [])
    .map(({ claim_id: claimId }) => DIMENSION_RECOGNITION_CUES[claimId])
    .filter(Boolean);
  return [...new Set([...additionalCues, ...claimCues])];
}

function surface({
  id,
  role,
  label,
  claims,
  protectedValues = {},
  recognitionCues = [],
}) {
  const projectedClaims = uniqueClaims(claims);
  const format = outputFormat(id, role, projectedClaims);
  return {
    surface_id: id,
    role,
    label,
    claims: projectedClaims,
    protected_values: stableValue(protectedValues),
    translation_guidance: {
      output_format: format,
      allowed_block_kinds: FORMAT_BLOCK_KINDS[format],
      customer_goal: customerGoal(id, format),
      recognition_cues: recognitionCuesForClaims(projectedClaims, recognitionCues),
    },
  };
}

function scoreClaimId(score) {
  return score?.claimContract?.claim_id
    || `dimension_${cleanString(score?.dimensionTechnical || score?.dimension).toLowerCase()}`;
}

function cueForScore(score) {
  return DIMENSION_RECOGNITION_CUES[scoreClaimId(score)] || '';
}

function strongestScoreCues(viewModel, count = 2) {
  return (viewModel?.operatingScores || [])
    .filter((score) => score?.claimContract && Number.isFinite(Number(score.score)))
    .slice()
    .sort((left, right) => Number(right.score) - Number(left.score))
    .slice(0, count)
    .map(cueForScore)
    .filter(Boolean);
}

function buildOverviewSurfaces(viewModel) {
  const strongestCues = strongestScoreCues(viewModel);
  return (viewModel?.overviewSections || []).map((section) => surface({
    id: `overview.${section.id}`,
    role: LAYER3_SURFACE_ROLES.OVERVIEW,
    label: section.title || section.id,
    claims: section.claimContracts,
    recognitionCues: strongestCues,
  }));
}

function buildScoreSurfaces(viewModel) {
  return (viewModel?.operatingScores || []).map((score, index) => surface({
    id: `score.${scoreClaimId(score)}`,
    role: LAYER3_SURFACE_ROLES.SCORE,
    label: score.displayName || score.dimension || `Score ${index + 1}`,
    claims: score.claimContract ? [score.claimContract] : [],
    protectedValues: protectedScoreValues(score, index + 1),
    recognitionCues: [cueForScore(score)].filter(Boolean),
  }));
}

function buildFixedSurfaces(viewModel) {
  const scoreClaims = (viewModel?.operatingScores || [])
    .map((score) => score.claimContract)
    .filter(Boolean);
  return [
    surface({
      id: 'one_move.primary',
      role: LAYER3_SURFACE_ROLES.ONE_MOVE,
      label: 'One Move',
      claims: viewModel?.oneMove?.claimContracts,
    }),
    surface({
      id: 'five_futures.summary',
      role: LAYER3_SURFACE_ROLES.FIVE_FUTURES,
      label: 'Five Futures',
      claims: viewModel?.fiveFuturesSections?.[0]?.claimContracts,
    }),
    surface({
      id: 'team.primary',
      role: LAYER3_SURFACE_ROLES.TEAM,
      label: 'Team / Leadership Fit',
      claims: viewModel?.teamFit?.claimContracts,
    }),
    surface({
      id: 'visual_dna.primary',
      role: LAYER3_SURFACE_ROLES.VISUAL_DNA,
      label: 'Visual DNA',
      claims: scoreClaims,
      protectedValues: {
        dimensions: (viewModel?.operatingScores || []).map((score, index) => (
          protectedScoreValues(score, index + 1)
        )),
      },
      recognitionCues: strongestScoreCues(viewModel),
    }),
  ];
}

function omitDuplicateInsufficientSurfaces(surfaces) {
  const seen = new Set();
  return surfaces.filter((item) => {
    if (hasSufficientClaim(item.claims)) return true;
    const signature = item.claims.map(({ claim_id: claimId }) => claimId).sort().join('|');
    if (!signature || !seen.has(signature)) {
      if (signature) seen.add(signature);
      return true;
    }
    return false;
  });
}

export function buildLayer3SemanticPacket(viewModel, {
  outputVariant = BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT,
  translationVariant = BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT,
} = {}) {
  if (viewModel?.truthfulness?.version !== BOS_LAYER2_VERSION
      || viewModel?.truthfulness?.authority !== 'deterministic_layer_2') {
    throw new Error('layer3_requires_active_layer2_truthfulness');
  }

  const surfaces = omitDuplicateInsufficientSurfaces([
    ...buildOverviewSurfaces(viewModel),
    ...buildScoreSurfaces(viewModel),
    ...buildFixedSurfaces(viewModel),
  ].filter((item) => item.claims.length > 0));

  const surfaceManifest = surfaces.map((item) => ({
    surface_id: item.surface_id,
    role: item.role,
    claim_ids: item.claims.map(({ claim_id }) => claim_id),
  }));
  const packetWithoutHash = {
    version: BOS_CUSTOMER_INTELLIGENCE_VERSION,
    layer2_version: BOS_LAYER2_VERSION,
    output_variant: cleanString(outputVariant, BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT),
    translation_variant: cleanString(
      translationVariant,
      BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT,
    ),
    source_authority: 'deterministic_layer_2',
    translation_only: true,
    protected_contract: {
      layer_1_scores_modified: false,
      layer_2_claims_modified: false,
      canonical_bos_modified: false,
      downstream_contracts_modified: false,
      confidence_calibration_claimed: false,
    },
    surface_manifest_hash: hashSemanticValue(surfaceManifest),
    surfaces,
  };
  const packet = {
    ...packetWithoutHash,
    semantic_hash: hashSemanticValue(packetWithoutHash),
  };

  return deepFreeze(packet);
}

export function packetWithoutSemanticHash(packet) {
  return Object.fromEntries(
    Object.entries(packet || {}).filter(([key]) => key !== 'semantic_hash'),
  );
}

export function isSufficientProjectedClaim(claim) {
  return claim?.evidence_sufficiency?.status === 'sufficient'
    && claim?.abstention?.abstained === false
    && claim?.classification !== INSUFFICIENT_EVIDENCE;
}

export { deepFreeze };
