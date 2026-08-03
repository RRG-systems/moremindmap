const CUSTOMER_DIMENSION_LABELS = Object.freeze({
  Vector: 'Command',
  Flex: 'Adaptability',
  Signal: 'Relational Awareness',
  Fidelity: 'Precision',
  Velocity: 'Tempo',
  Framework: 'Structure',
  Horizon: 'Perspective',
});

const DIMENSION_LABEL_PATTERN = /\b(Vector|Flex|Signal|Fidelity|Velocity|Framework|Horizon)\b/g;

export const VISUAL_DNA_PANEL_CLASSIFICATIONS = Object.freeze({
  dimensionScorecard: Object.freeze({ kind: 'measured', label: 'Measured' }),
  evidenceAmplitude: Object.freeze({ kind: 'measured', label: 'Measured' }),
  centerEngine: Object.freeze({ kind: 'assessment_derived_pattern', label: 'Assessment-derived pattern' }),
  inputs: Object.freeze({ kind: 'assessment_derived_pattern', label: 'Pattern to test' }),
  outputs: Object.freeze({ kind: 'assessment_derived_pattern', label: 'Pattern to test' }),
  operatingLoop: Object.freeze({ kind: 'bounded_hypothesis', label: 'Hypothesis' }),
  coreTension: Object.freeze({ kind: 'bounded_hypothesis', label: 'Hypothesis' }),
  energySource: Object.freeze({ kind: 'bounded_hypothesis', label: 'Hypothesis' }),
  fatigueSource: Object.freeze({ kind: 'bounded_hypothesis', label: 'Hypothesis' }),
  naturalAdvantage: Object.freeze({ kind: 'assessment_derived_pattern', label: 'Pattern to test' }),
  naturalRisk: Object.freeze({ kind: 'bounded_hypothesis', label: 'Risk to watch' }),
  environments: Object.freeze({ kind: 'question_to_observe', label: 'Question to observe' }),
  roleFit: Object.freeze({ kind: 'question_to_observe', label: 'Question to observe' }),
  wrongSeatRisk: Object.freeze({ kind: 'unsupported_hidden', label: 'Hidden without role evidence' }),
  futureBottleneck: Object.freeze({ kind: 'unsupported_hidden', label: 'Hidden without outcome evidence' }),
  oneMove: Object.freeze({ kind: 'bounded_hypothesis', label: 'A test to try' }),
  futureCards: Object.freeze({ kind: 'question_to_observe', label: 'Question to observe' }),
  keySignals: Object.freeze({ kind: 'assessment_derived_pattern', label: 'Patterns to notice' }),
});

const TRAJECTORY_TITLES = [
  'Current Trajectory',
  'Optimized Trajectory',
  'Overload Trajectory',
  'Leadership Trajectory',
  'Constraint Trajectory',
];

function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function mapText(value) {
  return typeof value === 'string'
    ? value.replace(DIMENSION_LABEL_PATTERN, (label) => CUSTOMER_DIMENSION_LABELS[label])
    : value;
}

function mapDimension(item) {
  return item && typeof item === 'object'
    ? { ...item, label: mapText(item.label) }
    : item;
}

function mapList(items) {
  return Array.isArray(items) ? items.map((item) => mapText(item)) : [];
}

function lowerLead(value) {
  const text = cleanText(value).replace(/[.?!]+$/, '');
  return text ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : '';
}

function boundedList(items, lead) {
  return mapList(items)
    .map(lowerLead)
    .filter(Boolean)
    .map((item) => `${lead} ${item}.`);
}

function observationQuestion(value, fallback) {
  const text = lowerLead(mapText(value));
  return `Watch whether ${text || fallback}. Treat this as a question to observe, not a prediction.`;
}

function mapFutureCards(cards) {
  const source = Array.isArray(cards) ? cards.slice(0, 5) : [];
  return TRAJECTORY_TITLES.map((title, index) => ({
    ...(source[index] || {}),
    title,
    likelihood: 'Question to observe',
    summary: observationQuestion(
      source[index]?.summary,
      'this part of the operating pattern repeats across meaningful situations',
    ),
    classification: VISUAL_DNA_PANEL_CLASSIFICATIONS.futureCards.kind,
  }));
}

function mapTension(tension, primary, secondary) {
  const source = tension && typeof tension === 'object' ? tension : {};
  const detail = lowerLead(mapText(source.detail));
  return {
    ...source,
    left: mapText(source.left || primary?.label || 'Primary'),
    right: mapText(source.right || secondary?.label || 'Secondary'),
    label: `Possible tension: ${mapText(source.label || 'competing operating needs')}`,
    detail: `This assessment suggests ${detail || 'these tendencies may compete for attention in some situations'}. Treat that as a pattern to test in lived experience.`,
  };
}

function mapTensionLabels(tension, primary, secondary) {
  const source = tension && typeof tension === 'object' ? tension : {};
  return {
    ...source,
    left: mapText(source.left || primary?.label || 'Primary'),
    right: mapText(source.right || secondary?.label || 'Secondary'),
    label: mapText(source.label),
    detail: mapText(source.detail),
  };
}

function hasContent(value) {
  return Array.isArray(value)
    ? value.some((item) => cleanText(item))
    : Boolean(cleanText(value));
}

export function customerFacingDimensionLabel(value) {
  return mapText(value);
}

/**
 * Builds a render-only Visual DNA projection. It never mutates the deterministic
 * source or changes score values, ordering, evidence, or canonical identifiers.
 */
export function buildCustomerVisualDNAProjection(sourceViewModel) {
  if (!sourceViewModel || typeof sourceViewModel !== 'object') return sourceViewModel;

  const primaryDimension = mapDimension(sourceViewModel.primaryDimension);
  const secondaryDimension = mapDimension(sourceViewModel.secondaryDimension);
  const tertiaryDimension = mapDimension(sourceViewModel.tertiaryDimension);
  const lowestDimension = mapDimension(sourceViewModel.lowestDimension);
  const topDimensions = Array.isArray(sourceViewModel.topDimensions)
    ? sourceViewModel.topDimensions.map(mapDimension)
    : [];
  const hasMeasuredPattern = topDimensions.length > 0;
  const presentation = sourceViewModel.customerPresentation;

  const mapped = {
    ...sourceViewModel,
    type: mapText(sourceViewModel.type),
    primaryEngine: mapText(sourceViewModel.primaryEngine),
    secondaryEngine: mapText(sourceViewModel.secondaryEngine),
    engineLabel: mapText(sourceViewModel.engineLabel),
    systemType: mapText(sourceViewModel.systemType),
    topDimensions,
    primaryDimension,
    secondaryDimension,
    tertiaryDimension,
    lowestDimension,
    futureBottleneck: mapText(sourceViewModel.futureBottleneck),
    oneMove: mapText(sourceViewModel.oneMove),
    roleTruth: mapText(sourceViewModel.roleTruth),
    evolutionPath: mapText(sourceViewModel.evolutionPath),
    naturalAdvantage: mapText(sourceViewModel.naturalAdvantage),
    naturalRisk: mapText(sourceViewModel.naturalRisk),
    inputs: mapList(sourceViewModel.inputs),
    operatingLoop: mapList(sourceViewModel.operatingLoop),
    outputs: mapList(sourceViewModel.outputs),
    energySource: mapList(sourceViewModel.energySource),
    fatigueSource: mapList(sourceViewModel.fatigueSource),
    bestEnvironment: mapList(sourceViewModel.bestEnvironment),
    worstEnvironment: mapList(sourceViewModel.worstEnvironment),
    roleFitSignals: mapList(sourceViewModel.roleFitSignals),
    keySignals: mapList(sourceViewModel.keySignals),
    futureCards: Array.isArray(sourceViewModel.futureCards)
      ? sourceViewModel.futureCards.map((card) => ({
          ...card,
          title: mapText(card?.title),
          summary: mapText(card?.summary),
        }))
      : [],
    tension: mapTensionLabels(sourceViewModel.tension, primaryDimension, secondaryDimension),
  };

  // Layer 2 fallback keeps its existing deterministic content and behavior;
  // customer terminology is the only render-time translation applied.
  if (!presentation) return mapped;

  const visibility = presentation.visibility || {};
  const primaryLabel = primaryDimension?.label || mapped.primaryEngine || 'your primary tendency';
  const secondaryLabel = secondaryDimension?.label || mapped.secondaryEngine || 'your supporting tendency';

  return {
    ...mapped,
    centerInterpretation: `This assessment suggests a pattern led by ${primaryLabel}, supported by ${secondaryLabel}. Use the surrounding map to test how that combination shows up in real decisions.`,
    inputs: mapped.inputs,
    outputs: mapped.outputs,
    operatingLoop: mapped.operatingLoop,
    energySource: mapped.energySource,
    fatigueSource: mapped.fatigueSource,
    bestEnvironment: mapped.bestEnvironment,
    worstEnvironment: mapped.worstEnvironment,
    roleFitSignals: mapped.roleFitSignals,
    futureCards: mapFutureCards(mapped.futureCards),
    keySignals: boundedList(mapped.keySignals, 'Watch for whether'),
    tension: mapTension(mapped.tension, primaryDimension, secondaryDimension),
    customerPresentation: {
      ...presentation,
      version: 'visual-dna-restoration-v1',
      previewLimitation: 'Assessment-derived map · hypotheses and questions are labeled',
      globalLimitation:
        'Assessment-derived patterns are framed as hypotheses or questions to test. This map does not establish future outcomes, team reactions, role performance, or guaranteed results.',
      panelClassifications: VISUAL_DNA_PANEL_CLASSIFICATIONS,
      visibility: {
        ...visibility,
        dimensionEvidence: hasMeasuredPattern,
        evidenceAmplitude: hasMeasuredPattern,
        energySource: hasMeasuredPattern && hasContent(mapped.energySource),
        fatigueSource: hasMeasuredPattern && hasContent(mapped.fatigueSource),
        inputs: hasMeasuredPattern && hasContent(mapped.inputs),
        outputs: hasMeasuredPattern && hasContent(mapped.outputs),
        operatingLoop: hasMeasuredPattern && hasContent(mapped.operatingLoop),
        coreTension: hasMeasuredPattern && Boolean(mapped.tension),
        wrongSeatRisk: false,
        environments: hasMeasuredPattern
          && (hasContent(mapped.bestEnvironment) || hasContent(mapped.worstEnvironment)),
        oneMove: visibility.oneMove === true && hasContent(mapped.oneMove),
        futureCards: hasMeasuredPattern && hasContent(mapped.futureCards.map(({ summary }) => summary)),
        keySignals: hasMeasuredPattern && hasContent(mapped.keySignals),
        footer: hasMeasuredPattern,
        roleFit: hasMeasuredPattern && hasContent(mapped.roleFitSignals),
        futureBottleneck: visibility.futureBottleneck === true,
      },
    },
  };
}

export default buildCustomerVisualDNAProjection;
