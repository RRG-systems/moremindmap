const DIMENSION_LABELS = {
  vector: 'Vector',
  velocity: 'Velocity',
  flex: 'Flex',
  fidelity: 'Fidelity',
  framework: 'Framework',
  signal: 'Signal',
  horizon: 'Horizon',
  leverage: 'Leverage',
};

const ENGINE_LABELS = {
  vector: 'Direction',
  velocity: 'Speed',
  flex: 'Adaptation',
  fidelity: 'Verification',
  framework: 'Structure',
  signal: 'Signal Reading',
  horizon: 'Foresight',
  leverage: 'Leverage',
};

const PAIR_DEFAULTS = {
  'vector+velocity': {
    systemType: 'Momentum Machine',
    inputs: ['Vision', 'Market Signals', 'Feedback', 'Urgency'],
    operatingLoop: ['Sense', 'Decide', 'Move', 'Measure', 'Adapt'],
    outputs: ['Decisions', 'Priorities', 'Alignment', 'Momentum'],
    evolutionPath: 'Judgment becomes transferable.',
    futureBottleneck: 'Decision translation still routes through the leader.',
    oneMove: 'Turn Speed Into Transferable Judgment',
  },
  'vector+flex': {
    systemType: 'Adaptive Navigation System',
    inputs: ['Vision', 'Context', 'Feedback', 'Ambiguity'],
    operatingLoop: ['Observe', 'Interpret', 'Adjust', 'Codify', 'Transfer'],
    outputs: ['Decisions', 'Clarifications', 'Routing', 'Adjustment'],
    evolutionPath: 'Adaptive judgment becomes infrastructure.',
    futureBottleneck: 'The organization learns the leader instead of learning a system.',
    oneMove: 'Turn Adaptability Into Infrastructure',
  },
  'fidelity+framework': {
    systemType: 'Precision Trust Lattice',
    inputs: ['Standards', 'Data', 'Exceptions', 'Process Signals'],
    operatingLoop: ['Inspect', 'Standardize', 'Execute', 'Audit', 'Improve'],
    outputs: ['Accuracy', 'Repeatability', 'Clean Handoffs', 'Trust'],
    evolutionPath: 'Quality judgment becomes repeatable standards.',
    futureBottleneck: 'Standards stay too dependent on personal inspection.',
    oneMove: 'Systematize Quality Judgment',
  },
};

export const WALLY_VISUAL_DNA_SAMPLE = {
  profileId: 'mm-20260531-asovnjz4',
  name: 'Wally Malesh',
  company: 'Forty Nine Fifty Two',
  type: 'Command/Adaptability',
  primaryEngine: 'Direction',
  secondaryEngine: 'Adaptation',
  engineLabel: 'Direction + Adaptation',
  systemType: 'Adaptive Navigation System',
  topDimensions: [
    { label: 'Vector', key: 'VEC', value: 0.88 },
    { label: 'Flex', key: 'FLE', value: 0.75 },
    { label: 'Signal', key: 'SIG', value: 0.69 },
    { label: 'Fidelity', key: 'FID', value: 0.64 },
    { label: 'Velocity', key: 'VEL', value: 0.60 },
    { label: 'Framework', key: 'FRA', value: 0.10 },
  ],
  lowestDimension: { label: 'Framework', key: 'FRA', value: 0.10 },
  futureBottleneck: 'The organization learns the leader instead of learning a system.',
  oneMove: 'Turn Adaptability Into Infrastructure',
  roleTruth: 'Stop being the person who resolves every recurring ambiguity.',
  wrongSeatRisk: 'High',
  inputs: ['Vision', 'Context', 'Feedback', 'Ambiguity'],
  operatingLoop: ['Observe', 'Interpret', 'Adjust', 'Codify', 'Transfer'],
  outputs: ['Decisions', 'Clarifications', 'Routing', 'Adjustment'],
  evolutionPath: 'Adaptive judgment becomes infrastructure.',
  confidence: 'Moderate',
};

export const MARCUS_VISUAL_DNA_SAMPLE = {
  profileId: 'mm-20260529-ceo8x7q2',
  name: 'Marcus Vale',
  company: 'ValeGrid Systems',
  type: 'Command/Tempo',
  primaryEngine: 'Direction',
  secondaryEngine: 'Speed',
  engineLabel: 'Direction + Speed',
  systemType: 'Momentum Machine',
  topDimensions: [
    { label: 'Vector', key: 'VEC', value: 0.92 },
    { label: 'Velocity', key: 'VEL', value: 0.84 },
    { label: 'Fidelity', key: 'FID', value: 0.67 },
    { label: 'Signal', key: 'SIG', value: 0.48 },
    { label: 'Framework', key: 'FRA', value: 0.34 },
    { label: 'Flex', key: 'FLE', value: 0.18 },
  ],
  lowestDimension: { label: 'Flex', key: 'FLE', value: 0.18 },
  futureBottleneck: 'Decision translation still routes through Marcus.',
  oneMove: 'Turn Speed Into Transferable Judgment',
  roleTruth: 'Do not slow the leader down; make the decision logic transferable.',
  wrongSeatRisk: 'Moderate',
  inputs: ['Vision', 'Market Signals', 'Feedback', 'Urgency'],
  operatingLoop: ['Sense', 'Decide', 'Move', 'Measure', 'Adapt'],
  outputs: ['Decisions', 'Priorities', 'Alignment', 'Momentum'],
  evolutionPath: 'Judgment becomes transferable.',
  confidence: 'High',
};

function normalizeDimension(dimension) {
  return String(dimension || '').trim().toLowerCase();
}

function formatValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric;
}

function getDimensionValue(dimension) {
  return formatValue(
    dimension?.display_score
    ?? dimension?.support_adjusted_score
    ?? dimension?.gpt_rescored_score
    ?? dimension?.score
    ?? dimension?.raw_score
  );
}

function toDimensionItem(dimension) {
  const key = normalizeDimension(dimension?.dimension || dimension?.key || dimension?.label);
  const label = DIMENSION_LABELS[key] || String(dimension?.label || key || 'Signal');

  return {
    label,
    key: label.slice(0, 3).toUpperCase(),
    value: getDimensionValue(dimension),
  };
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getNestedData(profile) {
  return profile?.canonical_profile_json || profile?.canonical_dossier?.canonical_profile_json || profile || {};
}

function getRanked(data) {
  if (Array.isArray(data?.rescoring_gpt?.ranked_dimensions)) return data.rescoring_gpt.ranked_dimensions;
  if (Array.isArray(data?.rescoring_v1?.ranked_dimensions)) return data.rescoring_v1.ranked_dimensions;
  if (Array.isArray(data?.ranked_dimensions)) return data.ranked_dimensions;
  return [];
}

function buildDimensionSet(ranked) {
  if (!ranked.length) return [];

  const top = ranked.slice(0, 5);
  const lowest = ranked[ranked.length - 1];
  const shouldAppendLowest = lowest?.dimension
    && !top.some((item) => normalizeDimension(item.dimension) === normalizeDimension(lowest.dimension));

  return shouldAppendLowest ? [...top, lowest] : ranked.slice(0, 6);
}

function getDominance(data) {
  return data?.rescoring_gpt?.dominance_profile
    || data?.rescoring_v1?.dominance_profile
    || data?.dominance_profile
    || {};
}

function getProfileType(profile, data, primaryKey, secondaryKey) {
  return firstText(
    profile?.profile_type,
    data?.profile_type,
    data?.inferred_patterns?.profile_type,
    data?.rescoring_gpt?.dominance_profile?.profile_type,
    `${ENGINE_LABELS[primaryKey] || 'Behavioral'} / ${ENGINE_LABELS[secondaryKey] || 'Operating'}`
  );
}

function getPairDefaults(primaryKey, secondaryKey) {
  return PAIR_DEFAULTS[`${primaryKey}+${secondaryKey}`]
    || PAIR_DEFAULTS[`${secondaryKey}+${primaryKey}`]
    || {
      systemType: 'Behavioral Operating System',
      inputs: ['Context', 'Signals', 'Pressure', 'Feedback'],
      operatingLoop: ['Sense', 'Interpret', 'Decide', 'Transfer', 'Improve'],
      outputs: ['Decisions', 'Coordination', 'Execution', 'Learning'],
      evolutionPath: 'Judgment becomes visible and repeatable.',
      futureBottleneck: 'The strongest operating pattern stays too dependent on one person.',
      oneMove: 'Transfer Judgment',
    };
}

export function buildVisualDNAViewModel(profile = {}, narrative = {}) {
  if (profile?.profileId && profile?.engineLabel) return profile;

  const data = getNestedData(profile);
  const ranked = getRanked(data);
  const topDimensions = buildDimensionSet(ranked).map(toDimensionItem);
  const dominance = getDominance(data);
  const primaryKey = normalizeDimension(dominance.primary_dimension || ranked[0]?.dimension);
  const secondaryKey = normalizeDimension(dominance.secondary_dimension || ranked[1]?.dimension);
  const primaryEngine = ENGINE_LABELS[primaryKey] || 'Direction';
  const secondaryEngine = ENGINE_LABELS[secondaryKey] || 'Adaptation';
  const defaults = getPairDefaults(primaryKey, secondaryKey);
  const oneMove = narrative?.recommendedNextStep || narrative?.theOneMove || narrative?.oneMove || narrative?.one_move || {};
  const behavioralDNA = profile?.behavioralDNA || data?.behavioral_dna || {};

  return {
    profileId: profile?.profileId || profile?.profile_id || data?.profile_id || 'mm-xxxxxxxx-xxxxxxxx',
    name: profile?.person_name || profile?.name || data?.metadata?.person_name || 'Profile Subject',
    company: profile?.company_name || profile?.company || data?.metadata?.company_name || 'Company',
    type: getProfileType(profile, data, primaryKey, secondaryKey),
    primaryEngine,
    secondaryEngine,
    engineLabel: `${primaryEngine} + ${secondaryEngine}`,
    systemType: defaults.systemType,
    topDimensions: topDimensions.length ? topDimensions : WALLY_VISUAL_DNA_SAMPLE.topDimensions,
    lowestDimension: topDimensions[topDimensions.length - 1] || WALLY_VISUAL_DNA_SAMPLE.lowestDimension,
    futureBottleneck: firstText(oneMove.futureBottleneck, oneMove.coreConstraint, narrative?.strategicCeiling?.key_warning, narrative?.strategicCeiling?.summary, defaults.futureBottleneck),
    oneMove: firstText(oneMove.headline, oneMove.intervention, oneMove.body, defaults.oneMove),
    roleTruth: firstText(oneMove.roleTruth, oneMove.role_truth, oneMove.lowestValueDrag, 'Make the strongest judgment pattern transferable.'),
    wrongSeatRisk: firstText(behavioralDNA.wrong_seat_risk, data?.behavioral_dna?.wrong_seat_risk, narrative?.wrongSeatRisk, 'Moderate'),
    inputs: defaults.inputs,
    operatingLoop: defaults.operatingLoop,
    outputs: defaults.outputs,
    evolutionPath: firstText(oneMove.evolutionPath, defaults.evolutionPath),
    confidence: firstText(dominance.profile_intensity, dominance.confidence ? String(dominance.confidence) : '', 'Moderate'),
  };
}

export default buildVisualDNAViewModel;
