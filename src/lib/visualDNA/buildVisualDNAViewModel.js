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
    tensionLabel: 'Translation Debt',
    tensionDetail: 'Speed creates rework when decision logic stays implicit.',
    naturalAdvantage: 'Momentum turns uncertainty into action.',
    naturalRisk: 'Speed can outrun shared interpretation.',
    energySource: ['Clear direction', 'Fast decisions', 'Visible momentum', 'High-stakes movement'],
    fatigueSource: ['Slow loops', 'Consensus drag', 'Repeated handoffs', 'Unclear ownership'],
    bestEnvironment: ['Urgency is real', 'Ownership is clear', 'Fast feedback exists', 'Decisions can move'],
    worstEnvironment: ['Every decision needs consensus', 'Ambiguity is unmanaged', 'Speed is punished', 'Handoffs are vague'],
    roleFitSignals: ['Founder', 'CEO', 'Growth leader', 'Change driver'],
    keySignals: ['Direction creates confidence', 'Speed creates momentum', 'Judgment must transfer', 'Rework reveals hidden gaps'],
    futureCards: [
      { title: 'Current Trajectory', likelihood: 'Likely', summary: 'Momentum rises while coordination cost grows.' },
      { title: 'Optimized Trajectory', likelihood: 'Possible', summary: 'Decision rules make speed scalable.' },
      { title: 'Burnout Trajectory', likelihood: 'Risk', summary: 'Urgency becomes cleanup and rework.' },
      { title: 'Leadership Trajectory', likelihood: 'Possible', summary: 'Judgment becomes transferable.' },
      { title: 'Constraint Trajectory', likelihood: 'Likely', summary: 'Growth routes back through the leader.' },
    ],
  },
  'vector+flex': {
    systemType: 'Adaptive Navigation System',
    inputs: ['Vision', 'Context', 'Feedback', 'Ambiguity'],
    operatingLoop: ['Observe', 'Interpret', 'Adjust', 'Codify', 'Transfer'],
    outputs: ['Decisions', 'Clarifications', 'Routing', 'Adjustment'],
    evolutionPath: 'Adaptive judgment becomes infrastructure.',
    futureBottleneck: 'The organization learns the leader instead of learning a system.',
    oneMove: 'Turn Adaptability Into Infrastructure',
    tensionLabel: 'Translation Debt',
    tensionDetail: 'Adaptive judgment stays with the leader until recurring rules are captured.',
    naturalAdvantage: 'Adaptation keeps options open.',
    naturalRisk: 'Systems may not keep pace.',
    energySource: ['Clear direction', 'Adaptive thinking', 'Novel problems', 'Flexible context'],
    fatigueSource: ['Rigid processes', 'Slow decision loops', 'Static environments', 'Repetitive execution'],
    bestEnvironment: ['Change is expected', 'Flexibility is an asset', 'Decisions are clear', 'Experimentation is safe'],
    worstEnvironment: ['Rigid processes', 'Unclear decision rights', 'Slow or heavy culture', 'Repeat without learning'],
    roleFitSignals: ['Founder', 'CEO', 'Growth leader', 'Change driver'],
    keySignals: ['Adaptation creates options', 'Decisions move forward', 'Clarity builds confidence', 'Systems multiply impact'],
    futureCards: [
      { title: 'Current Trajectory', likelihood: 'Likely', summary: 'Adaptive leader drives short-term momentum.' },
      { title: 'Optimized Trajectory', likelihood: 'Possible', summary: 'Systems amplify adaptability at scale.' },
      { title: 'Burnout Trajectory', likelihood: 'Risk', summary: 'Leader bandwidth becomes the ceiling.' },
      { title: 'Leadership Trajectory', likelihood: 'Possible', summary: 'Adaptive infrastructure multiplies impact.' },
      { title: 'Constraint Trajectory', likelihood: 'Likely', summary: 'Complexity outgrows personal capacity.' },
    ],
  },
  'fidelity+framework': {
    systemType: 'Precision Trust Lattice',
    inputs: ['Standards', 'Data', 'Exceptions', 'Process Signals'],
    operatingLoop: ['Inspect', 'Standardize', 'Execute', 'Audit', 'Improve'],
    outputs: ['Accuracy', 'Repeatability', 'Clean Handoffs', 'Trust'],
    evolutionPath: 'Quality judgment becomes repeatable standards.',
    futureBottleneck: 'Standards stay too dependent on personal inspection.',
    oneMove: 'Systematize Quality Judgment',
    tensionLabel: 'Verification Drag',
    tensionDetail: 'Quality creates trust, but release speed slows when every exception routes through verification.',
    naturalAdvantage: 'Trust compounds through accuracy.',
    naturalRisk: 'Verification can become the bottleneck.',
    energySource: ['Clean data', 'Clear standards', 'Closed loops', 'Repeatable systems'],
    fatigueSource: ['Ambiguity', 'Preventable errors', 'Moving targets', 'Rushed handoffs'],
    bestEnvironment: ['Quality is respected', 'Roles are clear', 'Standards are explicit', 'Repeatability matters'],
    worstEnvironment: ['Speed beats accuracy', 'Rules are fluid', 'Errors are normalized', 'Every case is unique'],
    roleFitSignals: ['Finance', 'Compliance', 'Operations', 'Quality systems'],
    keySignals: ['Accuracy builds trust', 'Standards scale quality', 'Verification protects handoffs', 'Process reduces risk'],
    futureCards: [
      { title: 'Current Trajectory', likelihood: 'Likely', summary: 'Quality holds while speed is constrained.' },
      { title: 'Optimized Trajectory', likelihood: 'Possible', summary: 'Standards make accuracy scalable.' },
      { title: 'Burnout Trajectory', likelihood: 'Risk', summary: 'Verification load centralizes.' },
      { title: 'Leadership Trajectory', likelihood: 'Possible', summary: 'Process becomes trust infrastructure.' },
      { title: 'Constraint Trajectory', likelihood: 'Likely', summary: 'Release pace depends on review capacity.' },
    ],
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
  const confidence = Number(dimension?.confidence);

  return {
    label,
    key: dimension?.code || label.slice(0, 3).toUpperCase(),
    value: getDimensionValue(dimension),
    evidence: Number(dimension?.evidence_count ?? dimension?.contributing_answer_count ?? dimension?.contributing_answers ?? 0),
    confidence: Number.isFinite(confidence) ? confidence : null,
    evidenceBand: dimension?.evidence_band || '',
    intensityBand: dimension?.intensity_band || '',
    role: dimension?.role || '',
    rationale: dimension?.rationale || '',
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
  const ranked = Array.isArray(data?.rescoring_gpt?.ranked_dimensions)
    ? data.rescoring_gpt.ranked_dimensions
    : Array.isArray(data?.rescoring_v1?.ranked_dimensions)
      ? data.rescoring_v1.ranked_dimensions
      : Array.isArray(data?.ranked_dimensions)
        ? data.ranked_dimensions
        : [];

  const evidenceSource = Array.isArray(data?.baseline_ranked_dimensions)
    ? data.baseline_ranked_dimensions
    : Array.isArray(data?.ranked_dimensions)
      ? data.ranked_dimensions
      : [];

  if (!ranked.length || !evidenceSource.length) return ranked;

  const evidenceByDimension = new Map(
    evidenceSource.map((dimension) => [normalizeDimension(dimension.dimension), dimension])
  );

  return ranked.map((dimension) => {
    const evidence = evidenceByDimension.get(normalizeDimension(dimension.dimension));
    if (!evidence) return dimension;

    return {
      ...evidence,
      ...dimension,
      evidence_count: dimension.evidence_count ?? evidence.evidence_count,
      contributing_answer_count: dimension.contributing_answer_count ?? evidence.contributing_answer_count,
      evidence_band: dimension.evidence_band ?? evidence.evidence_band,
      intensity_band: dimension.intensity_band ?? evidence.intensity_band,
      distance_from_neutral: dimension.distance_from_neutral ?? evidence.distance_from_neutral,
      support_adjusted_score: dimension.support_adjusted_score ?? evidence.support_adjusted_score,
      raw_score: dimension.raw_score ?? evidence.raw_score,
      contributing_answers: dimension.contributing_answers ?? evidence.contributing_answers,
    };
  });
}

function getRankedFromPrebuilt(profile) {
  if (Array.isArray(profile?.topDimensions)) {
    return profile.topDimensions.map((dimension, index) => ({
      dimension: dimension.label || dimension.dimension || dimension.key,
      code: dimension.key,
      display_score: dimension.value,
      score: dimension.value,
      evidence_count: dimension.evidence ?? 0,
      evidence_band: dimension.evidenceBand || '',
      intensity_band: dimension.intensityBand || '',
      confidence: dimension.confidence,
      rank: index + 1,
    }));
  }

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
      tensionLabel: 'Transfer Gap',
      tensionDetail: 'The strongest judgment pattern needs clearer handoff rules.',
      naturalAdvantage: 'Judgment creates movement.',
      naturalRisk: 'The pattern stays too person-dependent.',
      energySource: ['Clear context', 'Useful signals', 'Decision authority', 'Fast feedback'],
      fatigueSource: ['Unclear ownership', 'Slow loops', 'Repeated ambiguity', 'Low signal quality'],
      bestEnvironment: ['Decision rights are clear', 'Feedback is timely', 'Ownership is visible', 'Learning loops exist'],
      worstEnvironment: ['Ambiguity repeats', 'Handoffs are vague', 'Signals arrive late', 'Every issue routes upward'],
      roleFitSignals: ['Operator', 'Builder', 'Team lead', 'Systems owner'],
      keySignals: ['Judgment creates movement', 'Signals need translation', 'Handoffs reveal bottlenecks', 'Systems multiply impact'],
      futureCards: [
        { title: 'Current Trajectory', likelihood: 'Likely', summary: 'Value remains strong but person-dependent.' },
        { title: 'Optimized Trajectory', likelihood: 'Possible', summary: 'Judgment becomes transferable.' },
        { title: 'Burnout Trajectory', likelihood: 'Risk', summary: 'Recurring ambiguity consumes bandwidth.' },
        { title: 'Leadership Trajectory', likelihood: 'Possible', summary: 'The system carries more decisions.' },
        { title: 'Constraint Trajectory', likelihood: 'Likely', summary: 'Scale exposes the transfer gap.' },
      ],
    };
}

function toShortText(value, fallback = '') {
  if (typeof value === 'string' && value.trim()) {
    return value
      .replace(/\s+/g, ' ')
      .replace(/\s+-\s+/g, ': ')
      .trim();
  }
  return fallback;
}

function takeTexts(values, fallback = [], limit = 4) {
  const items = Array.isArray(values) ? values : [];
  const clean = items
    .map((item) => {
      if (typeof item === 'string') return toShortText(item);
      if (item?.title && item?.summary) return `${item.title}: ${item.summary}`;
      if (item?.label) return toShortText(item.label);
      return '';
    })
    .filter(Boolean);

  return (clean.length ? clean : fallback).slice(0, limit);
}

function summarizeFuture(future, fallback) {
  if (!future) return fallback;
  return {
    title: toShortText(future.title, fallback.title),
    likelihood: toShortText(future.likelihood, fallback.likelihood),
    summary: toShortText(future.trajectory || future.summary || future.organization_experiences, fallback.summary),
  };
}

function getFiveFutures(narrative, defaults) {
  const futures = Array.isArray(narrative?.fiveFutures?.futures) ? narrative.fiveFutures.futures : [];
  return defaults.futureCards.map((fallback, index) => summarizeFuture(futures[index], fallback));
}

function getAmplitude(topDimensions, dominance, spread) {
  const scored = topDimensions
    .slice(0, 3)
    .map((item) => Math.abs(Number(item.value) || 0));
  const average = scored.length
    ? scored.reduce((sum, value) => sum + value, 0) / scored.length
    : Number(dominance?.dominance_amplitude) || 0;
  const score = Math.max(0, Math.min(1, average || Number(spread?.polarization_score) || 0));

  return {
    score,
    label: score >= 0.78 ? 'High' : score >= 0.5 ? 'Moderate' : 'Low',
  };
}

function getEvidenceSummary(ranked) {
  const bands = { strong: 0, moderate: 0, thin: 0, none: 0 };

  ranked.forEach((dimension) => {
    const evidence = Number(dimension.evidence);
    const band = String(dimension.evidenceBand || '').toLowerCase();
    if (band.includes('strong') || evidence >= 3) bands.strong += 1;
    else if (band.includes('moderate') || evidence === 2) bands.moderate += 1;
    else if (band.includes('thin') || evidence === 1) bands.thin += 1;
    else bands.none += 1;
  });

  return bands;
}

function getDimensionByIndex(ranked, index, fallback) {
  return ranked[index] || fallback || {};
}

export function buildVisualDNAViewModel(profile = {}, narrative = {}) {
  if (profile?.profileId && profile?.engineLabel) return profile;

  const data = getNestedData(profile);
  const mergedRanked = getRanked(data);
  const ranked = mergedRanked.length ? mergedRanked : getRankedFromPrebuilt(profile);
  const topDimensions = buildDimensionSet(ranked).map(toDimensionItem);
  const dominance = getDominance(data);
  const spread = data?.rescoring_gpt?.spread_profile
    || data?.rescoring_v1?.spread_profile
    || data?.spread_profile
    || {};
  const primaryKey = normalizeDimension(dominance.primary_dimension || ranked[0]?.dimension);
  const secondaryKey = normalizeDimension(dominance.secondary_dimension || ranked[1]?.dimension);
  const primaryEngine = ENGINE_LABELS[primaryKey] || 'Direction';
  const secondaryEngine = ENGINE_LABELS[secondaryKey] || 'Adaptation';
  const defaults = getPairDefaults(primaryKey, secondaryKey);
  const oneMove = narrative?.recommendedNextStep || narrative?.theOneMove || narrative?.oneMove || narrative?.one_move || {};
  const behavioralDNA = profile?.behavioralDNA || data?.behavioral_dna || {};
  const dimensions = topDimensions.length ? topDimensions : WALLY_VISUAL_DNA_SAMPLE.topDimensions;
  const tertiary = getDimensionByIndex(dimensions, 2);
  const lowest = dimensions[dimensions.length - 1] || WALLY_VISUAL_DNA_SAMPLE.lowestDimension;
  const amplitude = getAmplitude(dimensions, dominance, spread);
  const evidenceSummary = getEvidenceSummary(dimensions);
  const roleFit = data?.role_fit_analysis || {};
  const environment = data?.environment_fit || {};
  const renderReady = data?.rescoring_gpt?.render_ready || data?.rescoring_v1?.render_ready || {};

  return {
    profileId: profile?.profileId || profile?.profile_id || data?.profile_id || 'mm-xxxxxxxx-xxxxxxxx',
    name: profile?.person_name || profile?.name || data?.metadata?.person_name || 'Profile Subject',
    company: profile?.company_name || profile?.company || data?.metadata?.company_name || 'Company',
    type: getProfileType(profile, data, primaryKey, secondaryKey),
    primaryEngine,
    secondaryEngine,
    engineLabel: `${primaryEngine} + ${secondaryEngine}`,
    systemType: defaults.systemType,
    topDimensions: dimensions,
    primaryDimension: dimensions[0],
    secondaryDimension: dimensions[1],
    tertiaryDimension: tertiary,
    lowestDimension: lowest,
    futureBottleneck: firstText(oneMove.futureBottleneck, oneMove.coreConstraint, narrative?.strategicCeiling?.key_warning, narrative?.strategicCeiling?.summary, defaults.futureBottleneck),
    oneMove: firstText(oneMove.headline, oneMove.intervention, oneMove.body, defaults.oneMove),
    roleTruth: firstText(oneMove.roleTruth, oneMove.role_truth, oneMove.lowestValueDrag, 'Make the strongest judgment pattern transferable.'),
    wrongSeatRisk: firstText(behavioralDNA.wrong_seat_risk, data?.behavioral_dna?.wrong_seat_risk, narrative?.wrongSeatRisk, 'Moderate'),
    inputs: defaults.inputs,
    operatingLoop: defaults.operatingLoop,
    outputs: defaults.outputs,
    evolutionPath: firstText(oneMove.evolutionPath, defaults.evolutionPath),
    confidence: firstText(dominance.profile_intensity, dominance.confidence ? String(dominance.confidence) : '', 'Moderate'),
    amplitude,
    evidenceSummary,
    tension: {
      left: dimensions[0]?.label || DIMENSION_LABELS[primaryKey] || 'Primary',
      right: dimensions[1]?.label || DIMENSION_LABELS[secondaryKey] || 'Secondary',
      label: defaults.tensionLabel,
      detail: defaults.tensionDetail,
    },
    naturalAdvantage: firstText(behavioralDNA.natural_advantage, narrative?.executiveSummary?.value_created, renderReady.command_clarity, defaults.naturalAdvantage),
    naturalRisk: firstText(behavioralDNA.natural_risk, narrative?.executiveSummary?.limiting_pattern, renderReady.speed_vs_fidelity, defaults.naturalRisk),
    energySource: takeTexts(behavioralDNA.energy_source, defaults.energySource, 4),
    fatigueSource: takeTexts(behavioralDNA.fatigue_source, defaults.fatigueSource, 4),
    bestEnvironment: takeTexts(environment.thrives_in, defaults.bestEnvironment, 4),
    worstEnvironment: takeTexts(environment.struggles_in, defaults.worstEnvironment, 4),
    roleFitSignals: takeTexts(roleFit.natural_roles, defaults.roleFitSignals, 4),
    keySignals: takeTexts(narrative?.teamExperience?.key_signals, defaults.keySignals, 4),
    futureCards: getFiveFutures(narrative, defaults),
    supportSystems: takeTexts(data?.future_growth_constraints?.at_2x_scale, ['Decision rights', 'Feedback loops'], 2),
    scalingConstraint: firstText(narrative?.strategicCeiling?.summary, data?.future_growth_constraints?.scaling_resistance_pattern, defaults.futureBottleneck),
  };
}

export default buildVisualDNAViewModel;
