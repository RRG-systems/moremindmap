const DIMENSION_LABELS = {
  vector: 'Direction',
  velocity: 'Speed',
  fidelity: 'Precision',
  framework: 'Repeatability',
  signal: 'Human Calibration',
  horizon: 'Future Orientation',
  flex: 'Adaptation',
  leverage: 'Scaling Judgment',
};

const DIMENSION_ENERGY = {
  vector: 'clear direction and decisive movement',
  velocity: 'visible progress and fast feedback',
  fidelity: 'accuracy, verification, and clean closure',
  framework: 'repeatable systems and explicit operating rules',
  signal: 'human signal, trust cues, and interpersonal calibration',
  horizon: 'strategic possibility and future positioning',
  flex: 'variety, ambiguity, and situational adjustment',
  leverage: 'patterns that turn effort into multiplied impact',
};

const DIMENSION_FATIGUE = {
  vector: 'directionless consensus loops',
  velocity: 'slow cycles with no visible movement',
  fidelity: 'messy ambiguity with loose standards',
  framework: 'constant exception handling without a stable process',
  signal: 'transactional environments that ignore human context',
  horizon: 'repetitive execution with no strategic line of sight',
  flex: 'rigid scripts that leave no room for adjustment',
  leverage: 'manual work that never becomes a scalable system',
};

const DIMENSION_ENVIRONMENTS = {
  vector: {
    best: 'decision rights are clear and movement is expected',
    worst: 'authority is diffuse and every step requires renewed consensus',
  },
  velocity: {
    best: 'fast cycles, short feedback loops, and visible progress markers',
    worst: 'slow approvals, unclear next steps, and procedural drag',
  },
  fidelity: {
    best: 'quality standards are explicit and accuracy is respected',
    worst: 'speed is rewarded while preventable error is normalized',
  },
  framework: {
    best: 'roles, handoffs, and operating rhythms are repeatable',
    worst: 'every problem becomes a one-off improvisation',
  },
  signal: {
    best: 'human context, trust signals, and audience reception matter',
    worst: 'people dynamics are treated as noise instead of operating data',
  },
  horizon: {
    best: 'near-term action connects to a visible strategic arc',
    worst: 'work is trapped in short-cycle execution with no future context',
  },
  flex: {
    best: 'adaptation is useful and boundaries are still named',
    worst: 'ambiguity expands until ownership and decisions blur',
  },
  leverage: {
    best: 'patterns can be converted into systems, delegation, or scale',
    worst: 'high-value judgment is consumed by manual repetition',
  },
};

const PAIR_MECHANICS = {
  'vector:velocity': {
    engine: 'Direction + Speed',
    advantage: 'Creates momentum before the room loses nerve.',
    risk: 'Can create translation debt when movement outruns shared interpretation.',
  },
  'fidelity:framework': {
    engine: 'Precision + Repeatability',
    advantage: 'Builds trust through accuracy, standards, and dependable execution.',
    risk: 'Can become a verification bottleneck when uncertainty requires faster release.',
  },
  'signal:horizon': {
    engine: 'Pattern Recognition + Future Orientation',
    advantage: 'Detects early opportunity by reading human signal and future consequence together.',
    risk: 'Can drift strategically when discovery keeps expanding beyond the current decision.',
  },
  'signal:flex': {
    engine: 'Human Calibration + Adaptation',
    advantage: 'Forms trust quickly by adjusting to the person, room, or moment.',
    risk: 'Can create boundary ambiguity when adaptation substitutes for explicit agreement.',
  },
  'vector:fidelity': {
    engine: 'Direction + Verification',
    advantage: 'Moves with authority while checking the work that matters.',
    risk: 'Can oscillate between decisive push and late-stage correction.',
  },
  'vector:horizon': {
    engine: 'Direction + Strategic Range',
    advantage: 'Converts future possibility into a clear direction of travel.',
    risk: 'Can overextend the organization before sequencing catches up.',
  },
  'vector:flex': {
    engine: 'Direction + Adaptation',
    advantage: 'Keeps forward motion alive while adjusting to changing terrain.',
    risk: 'Can make decisions feel settled before boundaries are fully clarified.',
  },
  'velocity:fidelity': {
    engine: 'Speed + Precision',
    advantage: 'Moves quickly without fully abandoning quality control.',
    risk: 'Can create internal friction between release pressure and verification standards.',
  },
  'leverage:framework': {
    engine: 'Scale Pattern + Operating System',
    advantage: 'Turns repeated work into repeatable infrastructure.',
    risk: 'Can over-systematize before the pattern has been proven.',
  },
  'framework:fidelity': {
    engine: 'Repeatability + Precision',
    advantage: 'Creates reliability through process discipline and quality control.',
    risk: 'Can slow adaptation when the process becomes more protected than the outcome.',
  },
};

export function getDimensionLabel(dimension) {
  return DIMENSION_LABELS[dimension] || titleCase(dimension || 'Unknown');
}

function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getDimensionScore(dimension) {
  return Number(
    dimension?.display_score
    ?? dimension?.gpt_rescored_score
    ?? dimension?.support_adjusted_score
    ?? dimension?.rescored_score
    ?? dimension?.score
    ?? 0
  );
}

function getEvidenceCount(dimension) {
  return Number(dimension?.evidence_count ?? dimension?.contributing_answer_count ?? 0);
}

function getBestRescoringLayer(canonicalProfile) {
  return canonicalProfile?.rescoring_gpt || canonicalProfile?.rescoring_v1 || {};
}

function getDimensionMap(ranked) {
  return (ranked || []).reduce((map, dimension) => {
    if (dimension?.dimension) map[dimension.dimension] = dimension;
    return map;
  }, {});
}

function getPairMechanic(primary, secondary) {
  const direct = PAIR_MECHANICS[`${primary}:${secondary}`];
  const reverse = PAIR_MECHANICS[`${secondary}:${primary}`];
  if (direct) return direct;
  if (reverse) return reverse;

  return {
    engine: `${getDimensionLabel(primary)} + ${getDimensionLabel(secondary)}`,
    advantage: `Combines ${getDimensionLabel(primary).toLowerCase()} with ${getDimensionLabel(secondary).toLowerCase()} to create the core operating pattern.`,
    risk: `Can overuse ${getDimensionLabel(primary).toLowerCase()} when ${getDimensionLabel(secondary).toLowerCase()} is not supported by the environment.`,
  };
}

function getTensionCount(tensionPairs) {
  if (!tensionPairs) return 0;
  if (Array.isArray(tensionPairs.active_tensions)) return tensionPairs.active_tensions.length;
  if (typeof tensionPairs.tension_count === 'number') return tensionPairs.tension_count;

  return Object.values(tensionPairs).filter(value => {
    if (typeof value === 'number') return Math.abs(value) >= 0.75;
    if (value && typeof value === 'object') return ['moderate', 'high'].includes(value.severity);
    return false;
  }).length;
}

function getDominantTension(tensionPairs) {
  if (!tensionPairs || typeof tensionPairs !== 'object') return null;
  if (Array.isArray(tensionPairs.active_tensions) && tensionPairs.active_tensions.length > 0) {
    return titleCase(tensionPairs.active_tensions[0]);
  }

  const numericTensions = Object.entries(tensionPairs)
    .filter(([, value]) => typeof value === 'number')
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

  return numericTensions[0] && Math.abs(numericTensions[0][1]) >= 0.75
    ? titleCase(numericTensions[0][0])
    : null;
}

function getWrongSeatRisk({ ranked, dominance, spread, tensionPairs }) {
  const primary = ranked[0];
  const primaryEvidence = getEvidenceCount(primary);
  const primaryConfidence = Number(primary?.confidence ?? dominance?.confidence ?? 0.7);
  const primaryScore = Math.abs(getDimensionScore(primary));
  const tensionCount = getTensionCount(tensionPairs);
  const totalSpread = Number(spread?.total_spread ?? dominance?.total_spread ?? 0);
  const dominanceGap = Number(spread?.dominance_gap ?? dominance?.dominance_gap ?? 0);
  const isExtreme = dominance?.profile_intensity === 'extreme' || dominance?.spread_type === 'extreme' || primary?.intensity_band === 'extreme';

  if (
    tensionCount >= 3
    || totalSpread >= 1.4
    || (isExtreme && dominanceGap >= 0.35)
    || primaryEvidence < 2
    || primaryConfidence < 0.45
  ) {
    return 'High';
  }

  if (tensionCount >= 1 || totalSpread >= 0.9 || primaryScore >= 0.8 || primaryConfidence < 0.6) {
    return 'Moderate';
  }

  return 'Low';
}

function getRoleFitSignals(ranked) {
  const dimensionMap = getDimensionMap(ranked);
  const score = (dimension) => getDimensionScore(dimensionMap[dimension]);
  const roleWeights = {
    Founder: { vector: 0.5, velocity: 0.3, horizon: 0.25, leverage: 0.2 },
    'Sales Leadership': { vector: 0.35, velocity: 0.25, signal: 0.25, leverage: 0.15 },
    Operations: { framework: 0.35, leverage: 0.3, fidelity: 0.2, vector: 0.1 },
    Accounting: { fidelity: 0.5, framework: 0.4, leverage: 0.1 },
    Engineering: { fidelity: 0.35, framework: 0.25, horizon: 0.25, flex: 0.25 },
    Recruiting: { signal: 0.5, flex: 0.25, horizon: 0.15, velocity: 0.1 },
    Compliance: { fidelity: 0.4, framework: 0.35, signal: 0.12 },
    Finance: { fidelity: 0.45, framework: 0.35, leverage: 0.1 },
    'Customer Success': { signal: 0.35, flex: 0.3, fidelity: 0.15, velocity: 0.1 },
    'Marketing Creative': { signal: 0.35, horizon: 0.25, flex: 0.25, velocity: 0.1 },
    'Project Management': { framework: 0.3, vector: 0.2, fidelity: 0.2, leverage: 0.15, signal: 0.1 },
  };

  const roles = Object.entries(roleWeights).map(([role, weights]) => ({
    role,
    score: Object.entries(weights).reduce((total, [dimension, weight]) => {
      return total + Math.max(0, score(dimension)) * weight;
    }, 0),
  }))
    .filter(role => role.score >= 0.25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(role => role.role);

  return roles.length > 0 ? roles : ['Role fit depends on environment design'];
}

export function buildBehavioralDNAInterpretation(canonicalProfile, rankedInput = []) {
  const data = canonicalProfile?.canonical_profile_json || canonicalProfile;
  const rescoringLayer = getBestRescoringLayer(data);
  const ranked = Array.isArray(rankedInput) && rankedInput.length > 0
    ? rankedInput
    : rescoringLayer.ranked_dimensions || data?.ranked_dimensions || [];

  const primary = ranked[0] || {};
  const secondary = ranked[1] || {};
  const primaryName = primary.dimension || rescoringLayer.dominance_profile?.primary_dimension || 'unknown';
  const secondaryName = secondary.dimension || rescoringLayer.dominance_profile?.secondary_dimension || 'unknown';
  const mechanic = getPairMechanic(primaryName, secondaryName);
  const dominance = rescoringLayer.dominance_profile || {};
  const spread = rescoringLayer.spread_profile || {};
  const tensionPairs = rescoringLayer.tension_pairs || {};
  const dominantTension = getDominantTension(tensionPairs);
  const primaryLabel = getDimensionLabel(primaryName);
  const secondaryLabel = getDimensionLabel(secondaryName);
  const tertiaryLabel = getDimensionLabel(ranked[2]?.dimension);
  const primaryEvidence = getEvidenceCount(primary);
  const secondaryEvidence = getEvidenceCount(secondary);
  const supportPhrase = primaryEvidence || secondaryEvidence
    ? `Evidence support: ${primaryEvidence || 0}/${secondaryEvidence || 0} contributing signals.`
    : 'Evidence support: baseline scoring fallback.';
  const tensionPhrase = dominantTension ? ` Main tension: ${dominantTension}.` : '';

  return {
    primary_engine: mechanic.engine,
    natural_advantage: mechanic.advantage,
    natural_risk: `${mechanic.risk}${tensionPhrase}`,
    energy_source: `${primaryLabel} draws energy from ${DIMENSION_ENERGY[primaryName] || 'conditions that match the primary operating pattern'}; ${secondaryLabel} adds ${DIMENSION_ENERGY[secondaryName] || 'secondary support'}.`,
    fatigue_source: `${DIMENSION_FATIGUE[primaryName] || 'misaligned work'}; fatigue rises faster when ${DIMENSION_FATIGUE[secondaryName] || 'the secondary system is unsupported'}.`,
    best_environment: `${DIMENSION_ENVIRONMENTS[primaryName]?.best || 'the primary pattern is useful'} and ${DIMENSION_ENVIRONMENTS[secondaryName]?.best || 'the secondary pattern is supported'}.`,
    worst_environment: `${DIMENSION_ENVIRONMENTS[primaryName]?.worst || 'the primary pattern is blocked'} while ${DIMENSION_ENVIRONMENTS[secondaryName]?.worst || 'the secondary pattern is also strained'}.`,
    role_fit_signals: getRoleFitSignals(ranked),
    wrong_seat_risk: getWrongSeatRisk({ ranked, dominance, spread, tensionPairs }),
    evidence_note: `${primaryLabel} + ${secondaryLabel}${ranked[2] ? `, stabilized by ${tertiaryLabel}` : ''}. ${supportPhrase}`,
  };
}

function getLowestSupportedDimension(ranked) {
  return [...(ranked || [])]
    .filter(dimension => getEvidenceCount(dimension) > 0)
    .sort((a, b) => getDimensionScore(a) - getDimensionScore(b))[0];
}

function getPressureShift(primaryLabel, secondaryLabel, lowestLabel) {
  const constraint = lowestLabel && lowestLabel !== 'Unknown'
    ? `the ${lowestLabel.toLowerCase()} constraint`
    : 'the least-supported operating demand';

  return `${primaryLabel} intensifies first; ${secondaryLabel} determines whether that pressure becomes useful throughput or gets pulled into ${constraint}.`;
}

function getNaturalRoleFit(roleContext, roleSignals) {
  const roleTitle = roleContext?.role_title || roleContext?.intended_role || '';
  const signals = (roleSignals || []).slice(0, 3).filter(Boolean);

  if (roleTitle && signals.length > 0) {
    return `${roleTitle}; adjacent fit signals: ${signals.join(', ')}`;
  }

  return roleTitle || signals.join(', ') || 'roles that match the primary operating engine';
}

export function buildExecutiveIntelligencePacket(canonicalProfile, cognitionContext = null, previousSections = {}) {
  const data = canonicalProfile?.canonical_profile_json || canonicalProfile;
  const ranked = cognitionContext?.ranked_dimensions || data?.rescoring_gpt?.ranked_dimensions || data?.rescoring_v1?.ranked_dimensions || data?.ranked_dimensions || [];
  const dna = buildBehavioralDNAInterpretation(data, ranked);
  const primary = ranked[0] || {};
  const secondary = ranked[1] || {};
  const lowest = getLowestSupportedDimension(ranked);
  const primaryLabel = getDimensionLabel(primary.dimension);
  const secondaryLabel = getDimensionLabel(secondary.dimension);
  const lowestLabel = getDimensionLabel(lowest?.dimension);
  const roleContext = data?.metadata?.organization || canonicalProfile?.metadata?.organization || {};

  return {
    behavioral_dna: dna,
    value_created: dna.natural_advantage,
    limiting_pattern: dna.natural_risk,
    pressure_shift: getPressureShift(primaryLabel, secondaryLabel, lowestLabel),
    natural_role_fit: getNaturalRoleFit(roleContext, dna.role_fit_signals),
    exhausting_role_fit: dna.worst_environment,
    highest_leverage_insight: `${primaryLabel} is the main value engine, but ${lowest?.dimension ? lowestLabel : secondaryLabel} is the likely constraint when the role demands behavior outside the supported pattern.`,
    evidence_used: {
      primary_dimension: primary.dimension,
      primary_score: getDimensionScore(primary),
      primary_evidence_count: getEvidenceCount(primary),
      secondary_dimension: secondary.dimension,
      secondary_score: getDimensionScore(secondary),
      secondary_evidence_count: getEvidenceCount(secondary),
      lowest_supported_dimension: lowest?.dimension || null,
      role_title: roleContext.role_title || null,
      company_name: roleContext.company_name || canonicalProfile?.company_name || null,
      downstream_context_available: Object.keys(previousSections || {}).filter(section => previousSections[section]),
    },
  };
}
