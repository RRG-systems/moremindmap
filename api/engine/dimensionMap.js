export const DIMENSIONS = [
  "vector",
  "signal",
  "fidelity",
  "velocity",
  "leverage",
  "flex",
  "framework",
  "horizon"
];

export const DIMENSION_LABELS = {
  vector: "Vector (Command)",
  signal: "Signal (Relational Awareness)",
  fidelity: "Fidelity (Precision)",
  velocity: "Velocity (Tempo)",
  leverage: "Leverage (Influence)",
  flex: "Flex (Adaptability)",
  framework: "Framework (Structure)",
  horizon: "Horizon (Perspective)"
};

/*
  Scoring notes:
  - primary = 3 points
  - secondary = 2 points
  - light = 1 point
  - choose-two answers will later be downweighted in engine
  - written questions are not directly mapped here; they are handled in AI interpretation / refinement
*/

export const QUESTION_MAP = {
  set_1: {
    1: {
      C: { fidelity: 2, horizon: 3 },
      A: { vector: 3, velocity: 2 },
      E: { signal: 3, horizon: 1 },
      B: { framework: 3, fidelity: 2 },
      D: { flex: 2, horizon: 2 }
    },
    2: {
      D: { leverage: 3, horizon: 2 },
      B: { fidelity: 3, framework: 2 },
      E: { flex: 3, signal: 1 },
      A: { vector: 3, velocity: 2 },
      C: { signal: 3, horizon: 1 }
    },
    3: {
      B: { signal: 3, flex: 1 },
      D: { horizon: 3, fidelity: 1 },
      A: { vector: 3, velocity: 2 },
      C: { framework: 3, fidelity: 2 },
      E: { flex: 3, velocity: 1 }
    },
    4: {
      E: { flex: 3, signal: 1 },
      A: { vector: 3, leverage: 2 },
      C: { fidelity: 3, framework: 2 },
      D: { horizon: 2, flex: 2 },
      B: { signal: 3, flex: 1 }
    },
    5: {
      B: { signal: 2, leverage: 2 },
      A: { vector: 3, velocity: 2 },
      D: { horizon: 3, fidelity: 1 },
      C: { fidelity: 3, framework: 2 }
    },
    6: {
      C: { signal: 2, leverage: 2 },
      A: { vector: 3, velocity: 2 },
      D: { horizon: 3, leverage: 2 },
      B: { flex: 3 }
    },
    7: {
      D: { horizon: 2, fidelity: 2 },
      A: { vector: 3 },
      C: { flex: 2 },
      B: { signal: 2, horizon: 2 }
    },
    8: {
      B: { fidelity: 3, horizon: 2 },
      D: { flex: 2, horizon: 2 },
      A: { velocity: 3 },
      C: { signal: 2, horizon: 1 }
    },
    9: {
      A: { vector: 3, framework: 2 },
      D: { flex: 3, velocity: 2 },
      B: { velocity: 3 },
      C: { framework: 3, fidelity: 2 }
    },
    10: {
      C: { vector: 2, leverage: 2 },
      A: { fidelity: 2, horizon: 2 },
      D: { horizon: 3 },
      B: { signal: 2, leverage: 2 }
    }
  },

  set_2: {
    1: {
      D: { flex: 2, horizon: 1 },
      A: { vector: 3, leverage: 2 },
      C: { horizon: 3, signal: 1 },
      E: { signal: 3, leverage: 1 },
      B: { leverage: 2, horizon: 2 }
    },
    2: {
      C: { signal: 3, horizon: 1 },
      A: { vector: 3, velocity: 2 },
      E: { flex: 3 },
      B: { fidelity: 3, framework: 1 },
      D: { leverage: 3, horizon: 2 }
    },
    3: {
      B: { signal: 3, leverage: 1 },
      A: { vector: 3, velocity: 2 },
      E: { flex: 3 },
      D: { horizon: 3 },
      C: { framework: 3, fidelity: 2 }
    },
    4: {
      E: { flex: 3, velocity: 2 },
      C: { framework: 3, fidelity: 2 },
      A: { vector: 3, velocity: 2 },
      D: { horizon: 3 },
      B: { signal: 3 }
    },
    5: {
      B: { signal: 2, leverage: 2 },
      D: { flex: 2 },
      A: { vector: 3 },
      C: { framework: 3, fidelity: 2 },
      E: { flex: 2, horizon: 1 }
    },
    6: {
      A: { vector: 3 },
      E: { flex: 3 },
      B: { signal: 2, horizon: 1 },
      D: { horizon: 3, fidelity: 1 },
      C: { framework: 3, fidelity: 2 }
    },
    7: {
      D: { fidelity: 3, horizon: 1 },
      B: { signal: 2, leverage: 1 },
      A: { vector: 3, velocity: 1 },
      C: { framework: 3, fidelity: 2 },
      E: { flex: 3 }
    },
    8: {
      E: { flex: 3, velocity: 2 },
      C: { framework: 3, fidelity: 1 },
      D: { horizon: 2, fidelity: 1 },
      A: { vector: 3, velocity: 2 },
      B: { fidelity: 2, signal: 1 }
    },
    9: {
      B: { signal: 3, leverage: 1 },
      D: { horizon: 2 },
      A: { vector: 3 },
      E: { flex: 2 },
      C: { framework: 3, leverage: 1 }
    },
    10: {
      A: { vector: 3, velocity: 1 },
      D: { flex: 3 },
      C: { framework: 3, fidelity: 1 },
      B: { signal: 3, leverage: 1 },
      E: { flex: 2, horizon: 1 }
    }
  },

  set_3: {
    1: {
      B: { fidelity: 2, signal: 1 },
      E: { signal: 3 },
      A: { vector: 3, leverage: 2 },
      D: { horizon: 3, signal: 1 },
      C: { leverage: 2, horizon: 2 }
    },
    2: {
      C: { leverage: 2, horizon: 2 },
      A: { vector: 3, fidelity: 1 },
      E: { flex: 2 },
      D: { flex: 2, signal: 1 },
      B: { signal: 3, horizon: 1 }
    },
    3: {
      D: { flex: 2 },
      B: { signal: 3 },
      E: { flex: 2, signal: 1 },
      A: { vector: 3, velocity: 1 },
      C: { horizon: 3, signal: 1 }
    },
    4: {
      A: { vector: 3, velocity: 2 },
      C: { framework: 3, fidelity: 1 },
      D: { horizon: 3, fidelity: 1 },
      E: { flex: 3, velocity: 1 },
      B: { signal: 3 }
    },
    5: {
      B: { signal: 3, flex: 1 },
      E: { flex: 2 },
      A: { vector: 3 },
      C: { framework: 3, fidelity: 2 },
      D: { horizon: 2, flex: 1 }
    },
    6: {
      A: { vector: 3, flex: 2 },
      D: { fidelity: 3, horizon: 1 },
      C: { fidelity: 3, framework: 1 },
      E: { flex: 3 },
      B: { signal: 2, leverage: 1 }
    },
    7: {
      A: { vector: 3, leverage: 1 },
      C: { framework: 3, leverage: 1 },
      E: { flex: 2 },
      B: { signal: 2, leverage: 2 },
      D: { horizon: 2 }
    },
    8: {
      D: { horizon: 3, fidelity: 1 },
      B: { signal: 2, horizon: 1 },
      A: { velocity: 3 },
      C: { fidelity: 3, horizon: 2 },
      E: { flex: 3 }
    },
    9: {
      C: { framework: 3, fidelity: 1 },
      A: { vector: 3, velocity: 2 },
      D: { flex: 2 },
      B: { signal: 3, leverage: 1 },
      E: { flex: 3 }
    },
    10: {
      E: { flex: 3 },
      C: { framework: 3, fidelity: 1 },
      A: { vector: 3, velocity: 1 },
      D: { horizon: 3 },
      B: { signal: 3 }
    }
  },

  set_4: {
    1: {
      B: { signal: 3, leverage: 1 },
      D: { flex: 3 },
      A: { vector: 3, velocity: 2 },
      C: { framework: 3, horizon: 1 },
      E: { flex: 3, signal: 1 }
    },
    2: {
      D: { flex: 2 },
      B: { signal: 3, horizon: 1 },
      A: { vector: 3 },
      E: { flex: 2, signal: 1 },
      C: { horizon: 3, fidelity: 1 }
    },
    3: {
      C: { framework: 3, fidelity: 1 },
      A: { vector: 3, velocity: 1 },
      B: { signal: 3, leverage: 1 },
      D: { horizon: 3 },
      E: { flex: 3 }
    },
    4: {
      E: { flex: 3, velocity: 1 },
      C: { framework: 3, fidelity: 1 },
      D: { horizon: 3 },
      A: { vector: 3, velocity: 2 },
      B: { signal: 3 }
    },
    5: {
      B: { signal: 3, horizon: 1 },
      A: { vector: 3, fidelity: 1 },
      D: { horizon: 3, fidelity: 1 },
      E: { flex: 3, signal: 1 },
      C: { fidelity: 3, framework: 1 }
    },
    6: {
      A: { vector: 3, velocity: 1 },
      C: { fidelity: 3, framework: 1 },
      B: { signal: 3 },
      D: { horizon: 3 },
      E: { flex: 3 }
    },
    7: {
      A: { vector: 3, velocity: 1 },
      D: { horizon: 3 },
      C: { framework: 3, fidelity: 1 },
      E: { flex: 3 },
      B: { signal: 3, leverage: 1 }
    },
    8: {
      B: { signal: 3 },
      D: { horizon: 2, signal: 1 },
      E: { flex: 3 },
      A: { vector: 3, leverage: 1 },
      C: { framework: 3, signal: 1 }
    },
    9: {
      D: { horizon: 3, fidelity: 1 },
      C: { fidelity: 3, horizon: 2 },
      A: { velocity: 3, vector: 1 },
      B: { signal: 3, horizon: 1 },
      E: { flex: 3, horizon: 1 }
    },
    10: {
      A: { vector: 2, velocity: 2 },
      D: { flex: 3 },
      C: { framework: 3, horizon: 1 },
      B: { signal: 3, horizon: 1 },
      E: { flex: 2, horizon: 1 }
    }
  }
};
