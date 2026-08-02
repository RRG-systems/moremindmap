import { INSUFFICIENT_EVIDENCE } from './contracts.js';

function translationById(bundle, surfaceId) {
  return bundle?.translations?.find((item) => item.surface_id === surfaceId) || null;
}

function translatedExplanation(bundle, surfaceId, fallback = INSUFFICIENT_EVIDENCE) {
  const value = translationById(bundle, surfaceId)?.customer_copy?.explanation;
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function insufficientFuture(title) {
  return {
    title,
    likelihood: INSUFFICIENT_EVIDENCE,
    summary: INSUFFICIENT_EVIDENCE,
  };
}

/**
 * Customer-only adapter for the deterministic Visual DNA component.
 * Numeric score topology is copied unchanged. Fields without a sufficient
 * Layer 2 claim fail closed instead of inheriting pair defaults.
 */
export function buildLayer3VisualDNAViewModel(sourceViewModel, bundle) {
  if (!sourceViewModel) return sourceViewModel;
  const primaryLabel = sourceViewModel.primaryDimension?.label
    || sourceViewModel.primaryEngine
    || 'Primary';
  const secondaryLabel = sourceViewModel.secondaryDimension?.label
    || sourceViewModel.secondaryEngine
    || 'Secondary';
  const visualExplanation = translatedExplanation(bundle, 'visual_dna.primary');
  const oneMoveExplanation = translatedExplanation(bundle, 'one_move.primary');

  return {
    ...sourceViewModel,
    type: `${primaryLabel} + ${secondaryLabel} measured score pattern`,
    systemType: 'Behavioral Operating System',
    topDimensions: Array.isArray(sourceViewModel.topDimensions)
      ? sourceViewModel.topDimensions.map((item) => ({ ...item }))
      : [],
    primaryDimension: sourceViewModel.primaryDimension
      ? { ...sourceViewModel.primaryDimension }
      : null,
    secondaryDimension: sourceViewModel.secondaryDimension
      ? { ...sourceViewModel.secondaryDimension }
      : null,
    tertiaryDimension: sourceViewModel.tertiaryDimension
      ? { ...sourceViewModel.tertiaryDimension }
      : null,
    lowestDimension: sourceViewModel.lowestDimension
      ? { ...sourceViewModel.lowestDimension }
      : null,
    futureBottleneck: INSUFFICIENT_EVIDENCE,
    oneMove: oneMoveExplanation,
    roleTruth: translationById(bundle, 'one_move.primary')?.customer_copy?.evidence_boundary
      || INSUFFICIENT_EVIDENCE,
    wrongSeatRisk: INSUFFICIENT_EVIDENCE,
    inputs: [INSUFFICIENT_EVIDENCE],
    operatingLoop: [INSUFFICIENT_EVIDENCE],
    outputs: [INSUFFICIENT_EVIDENCE],
    evolutionPath: INSUFFICIENT_EVIDENCE,
    confidence: 'Uncalibrated',
    tension: {
      left: primaryLabel,
      right: secondaryLabel,
      label: 'Evidence boundary',
      detail: INSUFFICIENT_EVIDENCE,
    },
    naturalAdvantage: INSUFFICIENT_EVIDENCE,
    naturalRisk: INSUFFICIENT_EVIDENCE,
    energySource: [INSUFFICIENT_EVIDENCE],
    fatigueSource: [INSUFFICIENT_EVIDENCE],
    bestEnvironment: [INSUFFICIENT_EVIDENCE],
    worstEnvironment: [INSUFFICIENT_EVIDENCE],
    roleFitSignals: [INSUFFICIENT_EVIDENCE],
    keySignals: [visualExplanation],
    futureCards: [
      insufficientFuture('Current Trajectory'),
      insufficientFuture('Optimized Trajectory'),
      insufficientFuture('Burnout Trajectory'),
      insufficientFuture('Leadership Trajectory'),
      insufficientFuture('Constraint Trajectory'),
    ],
    supportSystems: [INSUFFICIENT_EVIDENCE],
    scalingConstraint: INSUFFICIENT_EVIDENCE,
    customer_intelligence: {
      version: bundle.version,
      source_hash: bundle.source_hash,
      translation_only: true,
    },
  };
}

export default buildLayer3VisualDNAViewModel;
