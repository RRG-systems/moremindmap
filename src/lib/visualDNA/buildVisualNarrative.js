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

const PAIR_NARRATIVES = {
  'vector+velocity': {
    tension: 'translation debt',
    futureBottleneck: 'judgment remains trapped in the leader while speed keeps increasing',
    oneMove: 'transfer judgment into decision rules the team can execute at speed',
    visualMetaphor: 'a high-output engine feeding a decision-transfer network',
    environmentMetaphor: 'acceleration lanes, handoff gates, transfer nodes, and speed governors',
    energyMetaphor: 'momentum arcs, directional thrust, and synchronized flow lines',
    riskMetaphor: 'overloaded handoff gates, rework loops, and translation bottlenecks',
  },
  'vector+flex': {
    tension: 'adaptive judgment trapped in the leader',
    futureBottleneck: 'the organization learns the person instead of learning a system',
    oneMove: 'turn adaptability into infrastructure',
    visualMetaphor: 'a navigator converting changing terrain into reusable infrastructure',
    environmentMetaphor: 'branching roads, modular decision paths, live route maps, and infrastructure nodes',
    energyMetaphor: 'adaptive routing lines, recalibration pulses, and directional pivots',
    riskMetaphor: 'unmarked intersections where people wait for the navigator to clarify the route',
  },
  'vector+fidelity': {
    tension: 'direction must pass through verification before trust scales',
    futureBottleneck: 'decisions depend on personal certainty instead of visible release standards',
    oneMove: 'make the release threshold explicit before momentum reaches handoff',
    visualMetaphor: 'a command engine connected to trust gates and verification checkpoints',
    environmentMetaphor: 'directional corridors, quality gates, evidence panels, and approval pathways',
    energyMetaphor: 'focused thrust moderated by bright checkpoint pulses',
    riskMetaphor: 'precision gates becoming traffic stops when criteria stay implicit',
  },
  'fidelity+framework': {
    tension: 'precision must become repeatable without becoming rigid',
    futureBottleneck: 'standards remain too dependent on personal inspection',
    oneMove: 'convert quality judgment into repeatable operating standards',
    visualMetaphor: 'a precision lattice that turns accuracy into scalable trust',
    environmentMetaphor: 'standards grids, process rails, audit nodes, and clean handoff channels',
    energyMetaphor: 'stable luminous grids, verification pulses, and ordered signal flows',
    riskMetaphor: 'procedural drag and blocked throughput when every exception requires inspection',
  },
  'signal+fidelity': {
    tension: 'reading the signal must eventually become a decision threshold',
    futureBottleneck: 'confidence waits too long for perfect calibration',
    oneMove: 'define the evidence threshold that permits movement',
    visualMetaphor: 'a sensor array feeding trust gates and decision thresholds',
    environmentMetaphor: 'signal scanners, evidence bands, calibration panels, and quality gates',
    energyMetaphor: 'green signal waves converging into precise amber checkpoints',
    riskMetaphor: 'confidence delays and over-checking loops before the next handoff',
  },
  'signal+flex': {
    tension: 'human calibration can blur boundaries',
    futureBottleneck: 'adaptation stays personal instead of becoming clear operating guidance',
    oneMove: 'separate what can flex from what must stay fixed',
    visualMetaphor: 'a live sensing network shaping adaptive pathways with boundary markers',
    environmentMetaphor: 'feedback channels, flexible routes, boundary beacons, and relational signal nodes',
    energyMetaphor: 'responsive waves, adaptive arcs, and live recalibration fields',
    riskMetaphor: 'boundary drift and consensus fog when flexibility lacks visible limits',
  },
  'vector+horizon': {
    tension: 'future direction must be sequenced into near-term execution',
    futureBottleneck: 'vision compresses timing before the organization can absorb it',
    oneMove: 'sequence the future into the next executable decision layer',
    visualMetaphor: 'a directional command tower projecting future paths into execution lanes',
    environmentMetaphor: 'horizon grids, timing bands, sequencing rails, and decision waypoints',
    energyMetaphor: 'forward beams, long-range arcs, and staged activation pulses',
    riskMetaphor: 'overextension and timing gaps when the future arrives faster than capacity',
  },
};

function normalizeDimension(dimension) {
  return String(dimension || '').trim().toLowerCase();
}

function getEngineLabel(dimension) {
  return ENGINE_LABELS[normalizeDimension(dimension)] || String(dimension || 'Operating Force');
}

function getScore(dimension) {
  const value = Number(
    dimension?.display_score
    ?? dimension?.support_adjusted_score
    ?? dimension?.gpt_rescored_score
    ?? dimension?.score
    ?? dimension?.raw_score
  );

  return Number.isFinite(value) ? value : 0;
}

function getRankedDimensions(packet) {
  const ranked = packet?.scoring?.ranked_dimensions;
  return Array.isArray(ranked) ? ranked : [];
}

function getPrimarySecondary(packet) {
  const ranked = getRankedDimensions(packet);
  const dominance = packet?.scoring?.dominance_profile || {};
  const primary = normalizeDimension(dominance.primary_dimension || ranked[0]?.dimension);
  const secondary = normalizeDimension(dominance.secondary_dimension || ranked[1]?.dimension);

  return { primary, secondary, ranked };
}

function getPairNarrative(primary, secondary) {
  const exact = PAIR_NARRATIVES[`${primary}+${secondary}`];
  if (exact) return exact;

  const reverse = PAIR_NARRATIVES[`${secondary}+${primary}`];
  if (reverse) return reverse;

  return {
    tension: `${getEngineLabel(primary)} must become transferable through ${getEngineLabel(secondary)}`,
    futureBottleneck: 'the strongest operating pattern stays too personal to scale cleanly',
    oneMove: "make the leader's judgment visible enough for others to execute without waiting",
    visualMetaphor: 'a behavioral operating system converting personal judgment into shared execution',
    environmentMetaphor: 'decision pathways, transfer nodes, operating layers, and feedback channels',
    energyMetaphor: 'luminous signal flows moving from the central engine into the broader system',
    riskMetaphor: 'blocked transfer points where growth routes back through one person',
  };
}

function getLowestSignal(ranked) {
  if (!ranked.length) return '';
  return normalizeDimension(ranked[ranked.length - 1]?.dimension);
}

function getOneMove(packet, fallback) {
  const oneMove = packet?.one_move;
  if (oneMove?.headline) return oneMove.headline;
  if (oneMove?.intervention) return oneMove.intervention;
  if (oneMove?.body) return String(oneMove.body).split('\n')[0];
  return fallback;
}

function getFutureBottleneck(packet, fallback) {
  const oneMove = packet?.one_move || {};
  const strategic = packet?.strategic_ceiling || packet?.scaling_constraint || {};

  return oneMove.futureBottleneck
    || oneMove.coreConstraint
    || strategic.futureBottleneck
    || strategic.coreConstraint
    || strategic.summary
    || fallback;
}

export function buildVisualNarrative(packet = {}) {
  const { primary, secondary, ranked } = getPrimarySecondary(packet);
  const pairNarrative = getPairNarrative(primary, secondary);
  const primaryRank = ranked.find((item) => normalizeDimension(item.dimension) === primary) || ranked[0];
  const secondaryRank = ranked.find((item) => normalizeDimension(item.dimension) === secondary) || ranked[1];
  const lowest = getLowestSignal(ranked);

  const primaryEngine = {
    dimension: primary || '',
    meaning: getEngineLabel(primary),
    score: getScore(primaryRank),
  };
  const secondaryEngine = {
    dimension: secondary || '',
    meaning: getEngineLabel(secondary),
    score: getScore(secondaryRank),
  };

  return {
    primaryEngine,
    secondaryEngine,
    tension: pairNarrative.tension,
    futureBottleneck: getFutureBottleneck(packet, pairNarrative.futureBottleneck),
    oneMove: getOneMove(packet, pairNarrative.oneMove),
    visualMetaphor: pairNarrative.visualMetaphor,
    environmentMetaphor: lowest
      ? `${pairNarrative.environmentMetaphor}; lowest signal is ${getEngineLabel(lowest)}, so show where the system lacks that stabilizer`
      : pairNarrative.environmentMetaphor,
    energyMetaphor: pairNarrative.energyMetaphor,
    riskMetaphor: pairNarrative.riskMetaphor,
  };
}

export default buildVisualNarrative;
