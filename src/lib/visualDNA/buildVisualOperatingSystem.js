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

const ARCHITECTURES = {
  'vector+velocity': {
    inputs: ['Vision', 'Market Signals', 'Feedback', 'Urgency'],
    engine: 'Direction + Speed',
    outputs: ['Decisions', 'Priorities', 'Alignment', 'Momentum'],
    operatingLoop: ['Sense', 'Decide', 'Move', 'Measure', 'Adapt'],
    bottleneck: 'Translation debt',
    tension: 'speed can outrun shared understanding',
    evolutionPath: 'transfer judgment into repeatable decision rules',
    oneMove: 'Transfer Judgment',
    systemType: 'Momentum Machine',
  },
  'vector+flex': {
    inputs: ['Vision', 'Context', 'Feedback', 'Ambiguity'],
    engine: 'Direction + Adaptation',
    outputs: ['Decisions', 'Clarifications', 'Routing', 'Adjustment'],
    operatingLoop: ['Observe', 'Interpret', 'Adjust', 'Codify', 'Transfer'],
    bottleneck: 'Adaptive judgment trapped in the leader',
    tension: 'people learn the leader instead of learning the system',
    evolutionPath: 'turn recurring judgment into operating infrastructure',
    oneMove: 'Turn Adaptability Into Infrastructure',
    systemType: 'Adaptive Navigation System',
  },
  'vector+fidelity': {
    inputs: ['Direction', 'Evidence', 'Quality Signals', 'Risk'],
    engine: 'Direction + Verification',
    outputs: ['Trusted Decisions', 'Release Gates', 'Clear Standards', 'Confidence'],
    operatingLoop: ['Set Direction', 'Check Evidence', 'Release', 'Review', 'Tighten'],
    bottleneck: 'Verification threshold stays implicit',
    tension: 'movement waits for personal certainty',
    evolutionPath: 'make release standards visible before handoff',
    oneMove: 'Make The Release Threshold Explicit',
    systemType: 'Trust-Gated Command System',
  },
  'fidelity+framework': {
    inputs: ['Standards', 'Data', 'Exceptions', 'Process Signals'],
    engine: 'Verification + Structure',
    outputs: ['Accuracy', 'Repeatability', 'Clean Handoffs', 'Trust'],
    operatingLoop: ['Inspect', 'Standardize', 'Execute', 'Audit', 'Improve'],
    bottleneck: 'Quality depends on personal inspection',
    tension: 'precision can slow throughput if standards are not transferable',
    evolutionPath: 'convert quality judgment into repeatable standards',
    oneMove: 'Systematize Quality Judgment',
    systemType: 'Precision Trust Lattice',
  },
  'signal+fidelity': {
    inputs: ['Signals', 'Feedback', 'Evidence', 'Anomalies'],
    engine: 'Signal Reading + Verification',
    outputs: ['Calibration', 'Confidence', 'Risk Detection', 'Quality Decisions'],
    operatingLoop: ['Detect', 'Calibrate', 'Verify', 'Decide', 'Learn'],
    bottleneck: 'Confidence waits for too much proof',
    tension: 'reading keeps improving while movement waits',
    evolutionPath: 'define the evidence threshold that permits movement',
    oneMove: 'Set The Decision Threshold',
    systemType: 'Sensor-Calibration System',
  },
  'signal+flex': {
    inputs: ['People Signals', 'Context', 'Feedback', 'Change'],
    engine: 'Signal Reading + Adaptation',
    outputs: ['Relationship Fit', 'Adjustment', 'Timing', 'Context-Aware Decisions'],
    operatingLoop: ['Read', 'Adjust', 'Test', 'Clarify', 'Anchor'],
    bottleneck: 'Boundaries stay too fluid',
    tension: 'adaptation can blur what is fixed versus flexible',
    evolutionPath: 'separate flexible areas from non-negotiable anchors',
    oneMove: 'Name What Can Flex',
    systemType: 'Adaptive Signal Network',
  },
  'vector+horizon': {
    inputs: ['Vision', 'Timing Signals', 'Future Risk', 'Opportunity'],
    engine: 'Direction + Foresight',
    outputs: ['Strategy', 'Sequencing', 'Timing', 'Future Position'],
    operatingLoop: ['Project', 'Sequence', 'Commit', 'Stage', 'Recalibrate'],
    bottleneck: 'Future direction arrives faster than capacity',
    tension: 'vision compresses timing before execution can absorb it',
    evolutionPath: 'translate future direction into staged execution lanes',
    oneMove: 'Sequence The Future',
    systemType: 'Future Command Tower',
  },
};

function normalizeDimension(dimension) {
  return String(dimension || '').trim().toLowerCase();
}

function getEngineLabel(dimension) {
  return ENGINE_LABELS[normalizeDimension(dimension)] || String(dimension || 'Operating Force');
}

function getRankedDimensions(packet) {
  const ranked = packet?.scoring?.ranked_dimensions;
  return Array.isArray(ranked) ? ranked : [];
}

function getPrimarySecondary(packet, visualNarrative = {}) {
  const ranked = getRankedDimensions(packet);
  const dominance = packet?.scoring?.dominance_profile || {};
  const primary = normalizeDimension(
    visualNarrative.primaryEngine?.dimension
    || dominance.primary_dimension
    || ranked[0]?.dimension
  );
  const secondary = normalizeDimension(
    visualNarrative.secondaryEngine?.dimension
    || dominance.secondary_dimension
    || ranked[1]?.dimension
  );

  return { primary, secondary };
}

function getArchitecture(primary, secondary) {
  const exact = ARCHITECTURES[`${primary}+${secondary}`];
  if (exact) return exact;

  const reverse = ARCHITECTURES[`${secondary}+${primary}`];
  if (reverse) return reverse;

  return {
    inputs: ['Context', 'Signals', 'Pressure', 'Feedback'],
    engine: `${getEngineLabel(primary)} + ${getEngineLabel(secondary)}`,
    outputs: ['Decisions', 'Coordination', 'Execution', 'Learning'],
    operatingLoop: ['Sense', 'Interpret', 'Decide', 'Transfer', 'Improve'],
    bottleneck: 'Personal judgment does not transfer cleanly into the organization',
    tension: 'the strongest pattern remains too dependent on the operator',
    evolutionPath: 'make the judgment layer visible and repeatable',
    oneMove: 'Transfer Judgment',
    systemType: 'Behavioral Operating System',
  };
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function buildVisualOperatingSystem(packet = {}, visualNarrative = {}) {
  const { primary, secondary } = getPrimarySecondary(packet, visualNarrative);
  const base = getArchitecture(primary, secondary);
  const oneMove = packet?.one_move || {};
  const strategic = packet?.strategic_ceiling || packet?.scaling_constraint || {};

  return {
    inputs: base.inputs,
    engine: base.engine,
    outputs: base.outputs,
    operatingLoop: base.operatingLoop,
    bottleneck: firstText(
      base.bottleneck,
      visualNarrative.tension,
      oneMove.futureBottleneck,
      oneMove.coreConstraint,
      strategic.key_warning,
      strategic.summary
    ),
    tension: firstText(visualNarrative.tension, base.tension),
    evolutionPath: firstText(
      visualNarrative.oneMove,
      oneMove.headline,
      oneMove.intervention,
      base.evolutionPath
    ),
    oneMove: firstText(oneMove.headline, visualNarrative.oneMove, base.oneMove),
    systemType: base.systemType,
  };
}

export default buildVisualOperatingSystem;
