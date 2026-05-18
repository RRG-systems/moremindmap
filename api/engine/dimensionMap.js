// dimensionMap.js - MoreMindMap Dimensions
// Locked May 9, 2026

export const DIMENSIONS = [
  'vector',    // Command
  'signal',    // Relational Awareness
  'fidelity',  // Precision
  'velocity',  // Tempo
  'leverage',  // Influence
  'flex',      // Adaptability
  'framework', // Structure
  'horizon'    // Perspective
];

export const DIMENSION_LABELS = {
  vector: 'Command (Vector)',
  signal: 'Relational Awareness (Signal)',
  fidelity: 'Precision (Fidelity)',
  velocity: 'Tempo (Velocity)',
  leverage: 'Influence (Leverage)',
  flex: 'Adaptability (Flex)',
  framework: 'Structure (Framework)',
  horizon: 'Perspective (Horizon)'
};

export const DIMENSION_TRADEOFFS = {
  vector: ['signal', 'flex'],    // Command suppresses relational/flex
  signal: ['vector'],            // Relational suppresses command
  fidelity: ['velocity', 'flex'], // Precision suppresses speed/adapt
  velocity: ['fidelity'],        // Speed suppresses precision
  leverage: ['signal'],          // Influence suppresses pure relational
  flex: ['framework', 'fidelity'], // Adapt suppresses structure/precision
  framework: ['flex', 'velocity'], // Structure suppresses adapt/speed
  horizon: []                    // Perspective neutral
};
