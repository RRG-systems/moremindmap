function translationById(bundle, surfaceId) {
  return bundle?.translations?.find((item) => item.surface_id === surfaceId) || null;
}

function isTranslated(translation) {
  return translation?.status === 'translated';
}

function blockText(translation, kinds) {
  const allowed = new Set(kinds);
  return (translation?.customer_copy?.blocks || [])
    .filter(({ kind, text }) => allowed.has(kind) && text)
    .map(({ text }) => text)
    .join(' ');
}

/**
 * Customer-only adapter for the deterministic Visual DNA component.
 * Numeric score topology is copied unchanged. Fields without a sufficient
 * Layer 2 claim fail closed instead of inheriting pair defaults.
 */
export function buildLayer3VisualDNAViewModel(sourceViewModel, bundle) {
  if (!sourceViewModel) return sourceViewModel;
  const visual = translationById(bundle, 'visual_dna.primary');
  const oneMove = translationById(bundle, 'one_move.primary');
  const strategic = translationById(bundle, 'overview.main-scaling-risk')
    || translationById(bundle, 'overview.main-constraint');
  const futures = translationById(bundle, 'five_futures.summary');
  const team = translationById(bundle, 'team.primary');
  const visualSummary = blockText(visual, ['summary', 'recognition']);
  const oneMoveAction = blockText(oneMove, ['action']);
  const oneMoveLimitation = blockText(oneMove, ['limitation']);
  const strategicSummary = blockText(strategic, ['summary', 'recognition']);

  return {
    ...sourceViewModel,
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
    futureBottleneck: isTranslated(strategic) && strategicSummary
      ? strategicSummary
      : sourceViewModel.futureBottleneck,
    oneMove: isTranslated(oneMove) && oneMoveAction
      ? oneMoveAction
      : sourceViewModel.oneMove,
    roleTruth: isTranslated(oneMove) && oneMoveLimitation
      ? oneMoveLimitation
      : sourceViewModel.roleTruth,
    keySignals: isTranslated(visual) && visualSummary
      ? [visualSummary]
      : sourceViewModel.keySignals,
    customerPresentation: {
      globalLimitation:
        'This visual shows your supported score pattern. It does not infer team reactions, future outcomes, ideal environments, or role fit unless the assessment contains enough evidence to support them.',
      visibility: {
        dimensionEvidence: false,
        evidenceAmplitude: false,
        energySource: false,
        fatigueSource: false,
        inputs: false,
        outputs: false,
        operatingLoop: false,
        coreTension: false,
        futureBottleneck: isTranslated(strategic),
        wrongSeatRisk: false,
        environments: false,
        oneMove: isTranslated(oneMove),
        futureCards: isTranslated(futures),
        keySignals: isTranslated(visual),
        footer: false,
        roleFit: isTranslated(team),
      },
    },
    customer_intelligence: {
      version: bundle.version,
      source_hash: bundle.source_hash,
      translation_only: true,
    },
  };
}

export default buildLayer3VisualDNAViewModel;
