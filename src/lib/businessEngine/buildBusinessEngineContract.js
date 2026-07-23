/**
 * Canonical Business Engine Contract builder.
 *
 * Routes strongest existing BA intelligence into business-engine-contract-v1.
 * Deterministic systems may normalize and fall back honestly — never invent
 * financial values or re-interpret Intelligence Layer meaning.
 */

import {
  CONTRACT_NAME,
  CONTRACT_VERSION,
  COMPATIBILITY_MODE_BA_SNAPSHOT,
  BA_VISUAL_PROJECTION_VERSION,
  SOURCE_TYPES,
  INTELLIGENCE_STATUS,
  SNAPSHOT_TREND,
  SNAPSHOT_REASON_FOR_CHANGE,
} from './contractVersion.js';
import {
  asArray,
  clipText,
  findFuture,
  firstSectionBody,
  hasMeaningfulValue,
  makeIntelligenceNode,
  makeProvenance,
  selectByPriority,
  textFrom,
} from './intelligenceField.js';
import {
  buildVerticalContext,
  deriveRealEstateOutflow,
  deriveRealEstateStreams,
  hasPersonalizedStreams,
  isDeterministicStreamOrOutflowDerivation,
  isRealEstateAssessment,
  legacyOutflowFallback,
  legacyStreamFallback,
} from './realEstateVerticalAdapter.js';
import {
  buildCurrentRealityDisplayRows,
  buildPotentialFutureDisplayRows,
  buildTrajectoryVisualization,
  extractAssessmentMetricSources,
  resolvePotentialTrajectoryDirection,
} from './contractDisplaySemantics.js';
import { buildGoalIntelligence } from './goalIntelligence.js';
import {
  buildRealEstateTargetModel,
  computeRelationshipGap,
} from './realEstateTargetModel.js';
import { deriveRelationshipStructureEvidence } from './relationshipEvidence.js';

function resolveTimestamp(assessment, draft, briefing, fiveFutures, oneMove) {
  return (
    assessment?.generated_at ||
    assessment?.updated_at ||
    assessment?.created_at ||
    draft?.generated_at ||
    briefing?.generated_at ||
    fiveFutures?.generated_at ||
    oneMove?.generated_at ||
    null
  );
}

function extractAssessmentBundle(record) {
  const assessment = record?.assessment || record?.business_assessment || record || {};
  const output = assessment.output || record?.output || {};
  return {
    assessment,
    output,
    draft: output.business_intelligence_draft || {},
    briefing: output.executive_diagnostic_briefing_v1 || {},
    fiveFutures: output.five_futures_v1 || {},
    oneMove: output.one_move_v1 || {},
    answers: assessment.inputs?.answers || record?.inputs?.answers || {},
  };
}

function confidenceValue(value) {
  if (!hasMeaningfulValue(value)) return null;
  if (typeof value === 'object') {
    return (
      value.confidence_band ||
      value.band ||
      value.confidence ||
      (Number.isFinite(value.confidence_score) ? value.confidence_score : null) ||
      (Number.isFinite(value.score) ? value.score : null)
    );
  }
  return value;
}

/** Dynamic constraint lifecycle states. Snapshot defaults to ACTIVE when unknown. */
export const CONSTRAINT_STATES = Object.freeze([
  'ACTIVE',
  'IMPROVING',
  'STABILIZED',
  'EMERGING',
  'RESOLVED',
]);

function normalizeConstraintState(raw) {
  if (!hasMeaningfulValue(raw)) return 'ACTIVE';
  const normalized = String(raw)
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .trim();
  if (CONSTRAINT_STATES.includes(normalized)) return normalized;
  // Accept plain words without underscore.
  const compact = normalized.replace(/_/g, '');
  const match = CONSTRAINT_STATES.find((state) => state.replace(/_/g, '') === compact);
  return match || 'ACTIVE';
}

function humanizeKeyLabel(value) {
  if (!hasMeaningfulValue(value)) return null;
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Category is metadata only. Never surface a repeated subtype heading when it
 * restates the constraint name (e.g. name "Systems Constraint" + key systems_constraint).
 */
function constraintCategoryDisplay(category, name) {
  const human = humanizeKeyLabel(category);
  if (!human) return null;
  const nameKey = compactKey(name);
  const catKey = compactKey(human);
  if (!catKey) return null;
  if (nameKey && (nameKey === catKey || nameKey.includes(catKey) || catKey.includes(nameKey))) {
    return null;
  }
  return human;
}

/**
 * Trajectory labels must explain movement, not restate the primary constraint name.
 */
function trajectoryMovementLabel({ preferred, sourceConstraint, fallback = 'Current trajectory' }) {
  const label = textFrom(preferred);
  const constraint = textFrom(sourceConstraint);
  if (!label) return fallback;
  if (constraint && compactKey(label) === compactKey(constraint)) {
    return fallback;
  }
  // Reject labels that are pure constraint-key restatements.
  if (/constraint$/i.test(label) && !/\b(ris|declin|stable|momentum|trend|trajectory|path)\b/i.test(label)) {
    return fallback;
  }
  return label;
}

/**
 * Only surface RE doctrine tokens (6x6, 35+ touch) when the assessment language
 * actually supports them. Never universalize.
 */
function extractSupportedDoctrineTokens(text) {
  const source = String(text || '');
  const tokens = [];
  if (/\b6\s*[x×]\s*6\b/i.test(source) || /\bsix\s*by\s*six\b/i.test(source)) {
    tokens.push('6x6');
  }
  if (/\b35\s*\+?\s*(touch|touches|contact)/i.test(source) || /\b35\+\b/i.test(source)) {
    tokens.push('35+ Touch');
  }
  return tokens;
}

function pickTextMatching(items, pattern) {
  for (const item of asArray(items)) {
    const text = textFrom(item);
    if (text && pattern.test(text)) return text;
  }
  return null;
}

function uniqueText(items, limit = 6) {
  const seen = new Set();
  const values = [];
  for (const item of asArray(items).flat()) {
    const value = textFrom(item);
    const key = value?.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
    if (values.length >= limit) break;
  }
  return values;
}

function buildGoverningBusinessPattern({ draft, briefing, fiveFutures, lastUpdated }) {
  const fusion = draft?.behavior_business_fusion || {};
  const primary = draft?.constraint_analysis?.primary_constraint || briefing?.primary_constraint_snapshot || {};
  const trajectory = draft?.current_trajectory_signal || briefing?.current_trajectory_signal || {};
  const strategic = firstSectionBody(briefing, ['strategic_interpretation']);
  const constraintBody = firstSectionBody(briefing, ['primary_constraint']);
  const trajBody = firstSectionBody(briefing, ['current_trajectory_signal']);
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const currentFuture = findFuture(futures, 'current_future');
  const constraintFuture = findFuture(futures, 'constraint_future');
  const optimizedFuture = findFuture(futures, 'optimized_future');

  const title =
    textFrom(primary.label || primary.constraint_key) ||
    textFrom(trajectory.label) ||
    textFrom(trajectory.signal) ||
    null;

  const summaryParts = [
    textFrom(currentFuture?.summary || currentFuture?.trajectory_logic),
    strategic ? clipText(strategic, 280) : null,
    textFrom(fusion.fusion_summary),
    textFrom(primary.diagnostic_summary || primary.likely_effect_if_unchanged || primary.summary),
    trajBody ? clipText(trajBody, 200) : textFrom(trajectory.diagnostic_summary),
  ].filter(Boolean);

  const momentum = uniqueText([
    asArray(optimizedFuture?.behavioral_drivers),
    asArray(optimizedFuture?.business_drivers),
    textFrom(optimizedFuture?.upside),
    asArray(fusion.strengths),
  ]);
  const drag = uniqueText([
    asArray(constraintFuture?.behavioral_drivers),
    asArray(constraintFuture?.business_drivers),
    textFrom(constraintFuture?.risk_if_unchanged),
    asArray(currentFuture?.behavioral_drivers),
    asArray(fusion.risks),
    asArray(fusion.likely_business_effects),
    textFrom(primary.likely_effect_if_unchanged),
  ]);

  if (!title && summaryParts.length === 0) {
    return selectByPriority([], { last_updated: lastUpdated });
  }

  const current = {
    title: title || 'Governing pattern under assembly',
    summary: summaryParts[0] || constraintBody || 'Governing pattern evidence is partial.',
    momentum_sources: momentum.slice(0, 6),
    drag_sources: drag.slice(0, 6),
    reinforcing_loops: asArray(fusion.reinforcing_loops).slice(0, 4),
    conflicting_loops: asArray(fusion.conflicting_loops).slice(0, 4),
  };

  const sourceRank = hasMeaningfulValue(fusion.fusion_summary)
    ? strategic
      ? 1
      : 2
    : strategic
      ? 1
      : hasMeaningfulValue(primary)
        ? 3
        : 4;

  return makeIntelligenceNode({
    current,
    last_updated: lastUpdated,
    confidence: confidenceValue(primary.confidence || trajectory.confidence),
    provenance: makeProvenance({
      source_artifact: strategic
        ? 'executive_diagnostic_briefing_v1|five_futures_v1|business_intelligence_draft'
        : hasMeaningfulValue(currentFuture)
          ? 'five_futures_v1|business_intelligence_draft'
          : 'business_intelligence_draft',
      source_path: strategic
        ? 'sections.strategic_interpretation+futures[optimized|constraint]+constraint_analysis'
        : hasMeaningfulValue(currentFuture)
          ? 'futures[current|optimized|constraint]+constraint_analysis'
          : 'behavior_business_fusion+constraint_analysis+current_trajectory_signal',
      source_rank: sourceRank,
      notes: strategic || hasMeaningfulValue(currentFuture)
        ? 'Read-time individualized projection prefers persisted generated intelligence over shared deterministic fusion copy'
        : 'Legacy deterministic fusion used because generated individualized artifacts are unavailable',
    }),
    source_type: strategic || hasMeaningfulValue(currentFuture)
      ? SOURCE_TYPES.CANONICAL_FUSED
      : SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
    fallback_used: !strategic && !hasMeaningfulValue(currentFuture),
    fallback_reason:
      !strategic && !hasMeaningfulValue(currentFuture)
        ? 'generated_individualized_governing_pattern_sources_unavailable'
        : null,
    intelligence_status: summaryParts.length > 1 ? INTELLIGENCE_STATUS.AVAILABLE : INTELLIGENCE_STATUS.PARTIAL,
    evidence_sources: [
      { artifact: 'business_intelligence_draft', path: 'behavior_business_fusion' },
      { artifact: 'business_intelligence_draft', path: 'constraint_analysis.primary_constraint' },
      { artifact: 'business_intelligence_draft', path: 'current_trajectory_signal' },
      strategic ? { artifact: 'executive_diagnostic_briefing_v1', path: 'sections.strategic_interpretation' } : null,
    ].filter(Boolean),
  });
}

function buildBehavioralModifier({ draft, fiveFutures, oneMove, lastUpdated }) {
  const fusion = draft?.behavior_business_fusion || {};
  const behavioral = draft?.behavioral_reality || {};
  const primary = draft?.constraint_analysis?.primary_constraint || {};
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const currentFuture = findFuture(futures, 'current_future');
  const constraintFuture = findFuture(futures, 'constraint_future');
  const optimizedFuture = findFuture(futures, 'optimized_future');
  const optimizedDrivers = uniqueText(asArray(optimizedFuture?.behavioral_drivers), 8);
  const riskDrivers = uniqueText([
    asArray(constraintFuture?.behavioral_drivers),
    asArray(currentFuture?.behavioral_drivers),
  ], 10);

  const asset =
    pickTextMatching(
      optimizedDrivers,
      /\b(?:strength|supports?|fit|well-suited|advantage|helps?|can|natural|effective)\b/i
    ) ||
    optimizedDrivers[0] ||
    asArray(fusion.strengths)[0] ||
    textFrom(behavioral.profile_type) ||
    null;
  const distortion =
    pickTextMatching(
      riskDrivers,
      /\b(?:risk|may|can lead|low|weak|avoid|depend|pressure|over|under|delay|inconsisten)\b/i
    ) ||
    riskDrivers[0] ||
    asArray(fusion.risks)[0] ||
    asArray(fusion.likely_business_effects)[0] ||
    asArray(primary.behavior_modifiers)[0] ||
    null;
  const implication =
    textFrom(oneMove?.behavior_fit) ||
    textFrom(fusion.fusion_summary) ||
    null;

  if (!hasMeaningfulValue(fusion) && !hasMeaningfulValue(implication) && !hasMeaningfulValue(behavioral)) {
    return selectByPriority([], { last_updated: lastUpdated });
  }

  const explanation =
    textFrom(oneMove?.behavior_fit) ||
    textFrom(optimizedFuture?.trajectory_logic) ||
    textFrom(fusion.fusion_summary) ||
    [textFrom(asset), textFrom(distortion), textFrom(implication)].filter(Boolean).join(' ');
  const individualizedGeneratedSource = Boolean(
    hasMeaningfulValue(oneMove?.behavior_fit) ||
    optimizedDrivers.length ||
    riskDrivers.length
  );

  return makeIntelligenceNode({
    current: {
      behavioral_asset: textFrom(asset),
      business_distortion_or_risk: textFrom(distortion),
      implementation_implication: textFrom(implication),
      concise_customer_facing_explanation: clipText(explanation, 280),
      profile_type: textFrom(behavioral.profile_type),
    },
    last_updated: lastUpdated,
    confidence: confidenceValue(behavioral.ranked_dimensions?.[0]?.confidence) || 'moderate',
    provenance: makeProvenance({
      source_artifact: individualizedGeneratedSource
        ? 'five_futures_v1|one_move_v1|business_intelligence_draft'
        : 'business_intelligence_draft',
      source_path: individualizedGeneratedSource
        ? 'futures[optimized|constraint].behavioral_drivers+behavior_fit+behavioral_reality'
        : 'behavior_business_fusion+behavioral_reality',
      source_rank: individualizedGeneratedSource ? 1 : 2,
      notes: individualizedGeneratedSource
        ? 'Read-time BOS plus BA compatibility projection from persisted fused generation'
        : 'Legacy deterministic behavioral fusion because generated individualized artifacts are unavailable',
    }),
    source_type: individualizedGeneratedSource
      ? SOURCE_TYPES.CANONICAL_FUSED
      : SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
    fallback_used: !individualizedGeneratedSource,
    fallback_reason: individualizedGeneratedSource
      ? null
      : 'generated_individualized_behavioral_modifier_sources_unavailable',
    intelligence_status: individualizedGeneratedSource || hasMeaningfulValue(fusion.fusion_summary)
      ? INTELLIGENCE_STATUS.AVAILABLE
      : INTELLIGENCE_STATUS.PARTIAL,
    evidence_sources: asArray(fusion.evidence).slice(0, 4).map((item) => ({
      artifact: 'business_intelligence_draft',
      path: 'behavior_business_fusion.evidence',
      value: textFrom(item),
    })),
  });
}

function attachCurrentTrajectoryVisualization(node) {
  if (!node || typeof node !== 'object') return node;
  const visualization = buildTrajectoryVisualization({
    current: node.current && typeof node.current === 'object' ? node.current : node.current,
    role: 'current',
    nodeAvailable: hasMeaningfulValue(node.current),
    accessibilityLabel:
      (node.current && typeof node.current === 'object'
        ? textFrom(node.current.label || node.current.summary)
        : textFrom(node.current)) || 'Current trajectory',
  });
  // Ensure visualization is always present on the intelligence node for projection.
  node.visualization = visualization;
  if (node.current && typeof node.current === 'object') {
    node.current.visualization = visualization;
  }
  return node;
}

function attachPotentialTrajectoryVisualization(node) {
  if (!node || typeof node !== 'object') return node;
  const visualization = buildTrajectoryVisualization({
    current: node.current && typeof node.current === 'object' ? node.current : node.current,
    role: 'potential',
    nodeAvailable: hasMeaningfulValue(node.current),
    accessibilityLabel:
      (node.current && typeof node.current === 'object'
        ? textFrom(node.current.label || node.current.summary)
        : textFrom(node.current)) || 'Potential trajectory',
  });
  node.visualization = visualization;
  if (node.current && typeof node.current === 'object') {
    node.current.visualization = visualization;
  }
  return node;
}

function buildCurrentTrajectory({ draft, briefing, fiveFutures, lastUpdated }) {
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const currentFuture = findFuture(futures, 'current_future');
  const signal = draft?.current_trajectory_signal || {};
  const briefingSignal = briefing?.current_trajectory_signal || {};
  const sectionBody = firstSectionBody(briefing, ['current_trajectory_signal']);

  const node = selectByPriority(
    [
      {
        value: textFrom(signal.diagnostic_summary),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'business_intelligence_draft',
          source_path: 'current_trajectory_signal.diagnostic_summary',
        }),
        confidence: confidenceValue(signal.confidence),
        mapCurrent: (summary) => ({
          label: trajectoryMovementLabel({
            preferred: signal.label || signal.signal,
            sourceConstraint: signal.source_constraint,
            fallback: 'Current trajectory',
          }),
          summary,
          direction: textFrom(signal.signal) || textFrom(signal.direction) || null,
          // Trajectory owns movement risk only — constraint wording lives on Primary Constraint.
          persistence_risk: textFrom(signal.persistence_risk) || textFrom(currentFuture?.risk_if_unchanged) || null,
          supporting_evidence: asArray(signal.evidence || signal.supporting_evidence).slice(0, 5),
        }),
      },
      {
        value: sectionBody,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1',
          source_path: 'sections.current_trajectory_signal.body',
        }),
        confidence: confidenceValue(briefing?.confidence_snapshot),
        mapCurrent: (summary) => ({
          label: trajectoryMovementLabel({
            preferred: briefingSignal.label || signal.label || signal.signal,
            sourceConstraint: signal.source_constraint || briefingSignal.source_constraint,
            fallback: 'Current trajectory',
          }),
          summary: clipText(summary, 320),
          direction: textFrom(briefingSignal.signal || signal.signal) || null,
          persistence_risk: textFrom(currentFuture?.risk_if_unchanged) || null,
          supporting_evidence: [],
        }),
      },
      {
        value: textFrom(briefingSignal.diagnostic_summary),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1',
          source_path: 'current_trajectory_signal.diagnostic_summary',
        }),
        mapCurrent: (summary) => ({
          label: trajectoryMovementLabel({
            preferred: briefingSignal.label,
            sourceConstraint: briefingSignal.source_constraint || signal.source_constraint,
            fallback: 'Current trajectory',
          }),
          summary,
          direction: textFrom(briefingSignal.signal) || null,
          persistence_risk: null,
          supporting_evidence: [],
        }),
      },
      {
        value: textFrom(currentFuture?.summary),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[current_future].summary',
        }),
        confidence: confidenceValue(currentFuture?.confidence),
        mapCurrent: (summary) => ({
          label: trajectoryMovementLabel({
            preferred: currentFuture?.title || currentFuture?.label,
            sourceConstraint: signal.source_constraint,
            fallback: 'Current trajectory',
          }),
          summary,
          direction: textFrom(currentFuture?.trajectory_logic) || 'current_future',
          persistence_risk: textFrom(currentFuture?.risk_if_unchanged) || null,
          supporting_evidence: asArray(currentFuture?.evidence || currentFuture?.signal_bullets).slice(0, 5),
        }),
      },
      {
        value: hasMeaningfulValue(signal)
          ? {
              label: trajectoryMovementLabel({
                preferred: signal.label || signal.signal,
                sourceConstraint: signal.source_constraint,
                fallback: 'Current trajectory',
              }),
              // Movement-only summary — do not inject "source constraint" wording.
              summary:
                textFrom(signal.diagnostic_summary) ||
                textFrom(signal.summary) ||
                (textFrom(signal.signal)
                  ? `Trajectory signal: ${textFrom(signal.signal)}.`
                  : 'Trajectory signal present.'),
              direction: textFrom(signal.signal) || null,
              persistence_risk: textFrom(currentFuture?.risk_if_unchanged) || null,
              supporting_evidence: asArray(signal.evidence).slice(0, 5),
            }
          : null,
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        fallback_used: true,
        fallback_reason: 'trajectory_signal_object_without_diagnostic_summary',
        provenance: makeProvenance({
          source_artifact: 'business_intelligence_draft',
          source_path: 'current_trajectory_signal',
        }),
      },
    ],
    { last_updated: lastUpdated }
  );

  return attachCurrentTrajectoryVisualization(node);
}

/**
 * Potential trajectory direction must preserve strongest actual source direction.
 * Future category (optimized/transformational/preferred/target) is metadata only —
 * never a direction and never an implied rising path.
 */
function mapPotentialTrajectoryCurrent({
  future = null,
  futureCategory = null,
  summary,
  requiredStructuralChange = null,
  assumptions = [],
  labelFallback = 'Potential trajectory',
  directionSource = null,
} = {}) {
  const resolved = resolvePotentialTrajectoryDirection(directionSource || future || {});
  return {
    label: textFrom(future?.title || future?.label) || labelFallback,
    summary: textFrom(future?.summary) || summary,
    required_structural_change: requiredStructuralChange,
    // Category describes which future; direction describes motion. Keep separate.
    future_category: futureCategory,
    expected_direction: resolved.direction,
    direction: resolved.direction,
    direction_source: resolved.source_path,
    direction_basis: resolved.basis,
    assumptions: asArray(assumptions),
  };
}

function buildPotentialTrajectory({ fiveFutures, oneMove, lastUpdated }) {
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const optimized = findFuture(futures, 'optimized_future');
  const transformational = findFuture(futures, 'transformational_future');
  const shift = oneMove?.expected_probability_shift;

  const node = selectByPriority(
    [
      {
        value: textFrom(optimized?.summary) || textFrom(optimized?.required_shift),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[optimized_future]',
        }),
        confidence: confidenceValue(optimized?.confidence),
        mapCurrent: (summary) =>
          mapPotentialTrajectoryCurrent({
            future: optimized,
            futureCategory: 'optimized_future',
            summary,
            requiredStructuralChange:
              textFrom(optimized?.required_shift) || textFrom(oneMove?.recommendation) || null,
            assumptions: optimized?.assumptions,
            labelFallback: 'Potential trajectory',
            directionSource: optimized,
          }),
      },
      {
        value: textFrom(transformational?.summary),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[transformational_future].summary',
        }),
        confidence: confidenceValue(transformational?.confidence),
        mapCurrent: (summary) =>
          mapPotentialTrajectoryCurrent({
            future: transformational,
            futureCategory: 'transformational_future',
            summary,
            requiredStructuralChange: textFrom(transformational?.required_shift) || null,
            assumptions: transformational?.assumptions,
            labelFallback: 'Potential trajectory',
            directionSource: transformational,
          }),
      },
      {
        value: textFrom(shift?.explanation || shift),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'one_move_v1',
          source_path: 'expected_probability_shift.explanation',
        }),
        confidence: confidenceValue(oneMove?.confidence),
        mapCurrent: (summary) => {
          // shift.to names probability mass categories — not trajectory direction.
          const shiftDirectionSource = {
            visualization: shift?.visualization,
            visualization_direction: shift?.visualization_direction,
            canonical_visualization_direction: shift?.canonical_visualization_direction,
            direction: shift?.direction,
            expected_direction: shift?.expected_direction,
            trajectory_direction: shift?.trajectory_direction,
            trajectory_logic: shift?.trajectory_logic,
            signal: shift?.signal || shift?.direction_signal,
          };
          return mapPotentialTrajectoryCurrent({
            future: null,
            futureCategory: null,
            summary,
            requiredStructuralChange: textFrom(oneMove?.recommendation) || null,
            assumptions: oneMove?.caveats,
            labelFallback: 'Modeled shift trajectory',
            directionSource: shiftDirectionSource,
          });
        },
      },
    ],
    { last_updated: lastUpdated }
  );

  return attachPotentialTrajectoryVisualization(node);
}

function collectStreamEvidence(streams) {
  const sources = [];
  for (const item of asArray(streams)) {
    for (const ev of asArray(item?.evidence)) {
      if (ev && typeof ev === 'object') {
        sources.push({
          artifact: 'deterministic_vertical_adapter',
          path: ev.path || 'stream_derivation',
          value: ev.snippet || ev.value || item?.name || null,
          derivation: ev.derivation || item?.derivation || null,
        });
      }
    }
    if (!asArray(item?.evidence).length && item?.name) {
      sources.push({
        artifact: 'deterministic_vertical_adapter',
        path: 'stream_name',
        value: item.name,
        derivation: item.derivation || 'deterministic_inference',
      });
    }
  }
  return sources.slice(0, 12);
}

function buildRelationshipLake({
  draft,
  briefing,
  oneMove,
  answers,
  assessmentType,
  lastUpdated,
  metrics,
  goal = null,
  targetModel = null,
}) {
  const realEstate = isRealEstateAssessment(assessmentType, answers);
  const personalizedStreams = realEstate ? deriveRealEstateStreams({ draft, briefing, answers }) : [];
  const personalizedOutflow = realEstate ? deriveRealEstateOutflow({ draft, oneMove, briefing }) : [];

  let streamsNode;
  if (hasPersonalizedStreams(personalizedStreams)) {
    // These values are individualized from this record's evidence. They remain
    // deterministic inference, but are not a shared fallback packet.
    const deterministic = isDeterministicStreamOrOutflowDerivation(personalizedStreams);
    streamsNode = makeIntelligenceNode({
      current: personalizedStreams,
      last_updated: lastUpdated,
      source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
      intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      fallback_used: false,
      provenance: makeProvenance({
        source_artifact: 'real_estate_vertical_adapter',
        source_path: 'deriveRealEstateStreams(lead_generation_reality|briefing|answers)',
        source_rank: 2,
        notes: deterministic
          ? 'Deterministic individualized inference from this assessment; not persisted domain stream intelligence'
          : 'Individualized vertical mapping from this assessment',
      }),
      evidence_sources: collectStreamEvidence(personalizedStreams),
      confidence: 'inferred',
    });
  } else if (realEstate) {
    streamsNode = makeIntelligenceNode({
      current: legacyStreamFallback(),
      last_updated: lastUpdated,
      source_type: SOURCE_TYPES.LEGACY_FALLBACK,
      intelligence_status: INTELLIGENCE_STATUS.FALLBACK,
      fallback_used: true,
      fallback_reason: 'personalized_stream_intelligence_unavailable_using_real_estate_legacy_defaults',
      provenance: makeProvenance({
        source_artifact: 'real_estate_vertical_adapter',
        source_path: 'REAL_ESTATE_LEGACY_STREAMS',
        source_rank: 4,
        notes: 'Explicit legacy fallback — not personalized intelligence',
      }),
      evidence_sources: [],
      confidence: null,
    });
  } else {
    streamsNode = makeIntelligenceNode({
      current: [],
      last_updated: lastUpdated,
      source_type: SOURCE_TYPES.HONEST_ABSENCE,
      intelligence_status: INTELLIGENCE_STATUS.ABSENT,
      provenance: makeProvenance({
        notes: 'Non-RE vertical without stream model',
      }),
    });
  }

  let outflowNode;
  if (hasPersonalizedStreams(personalizedOutflow)) {
    // Alias-matched outcomes are profile-scoped deterministic inference, not
    // a shared real-estate fallback list.
    outflowNode = makeIntelligenceNode({
      current: personalizedOutflow,
      last_updated: lastUpdated,
      source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
      intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      fallback_used: false,
      provenance: makeProvenance({
        source_artifact: 'real_estate_vertical_adapter',
        source_path: 'deriveRealEstateOutflow(conversion|one_move_aliases|briefing)',
        source_rank: 2,
        notes:
          'Deterministic individualized outcome extraction; clipped success-indicator prose and issue labels excluded',
      }),
      evidence_sources: collectStreamEvidence(personalizedOutflow),
      confidence: 'inferred',
    });
  } else if (realEstate) {
    outflowNode = makeIntelligenceNode({
      current: legacyOutflowFallback(),
      last_updated: lastUpdated,
      source_type: SOURCE_TYPES.LEGACY_FALLBACK,
      intelligence_status: INTELLIGENCE_STATUS.FALLBACK,
      fallback_used: true,
      fallback_reason: 'personalized_outflow_intelligence_unavailable_using_real_estate_legacy_defaults',
      provenance: makeProvenance({
        source_artifact: 'real_estate_vertical_adapter',
        source_path: 'REAL_ESTATE_LEGACY_OUTFLOW',
        source_rank: 4,
        notes: 'Explicit legacy fallback — not personalized intelligence',
      }),
      evidence_sources: [],
      confidence: null,
    });
  } else {
    outflowNode = makeIntelligenceNode({
      current: [],
      last_updated: lastUpdated,
      source_type: SOURCE_TYPES.HONEST_ABSENCE,
      intelligence_status: INTELLIGENCE_STATUS.ABSENT,
    });
  }

  const relationship = draft?.relationship_reality || {};
  const relationshipStructure = deriveRelationshipStructureEvidence({
    q3: answers?.q3,
    q5: answers?.q5,
  });
  const currentTrue =
    metrics?.currentTrueRelationships ??
    null;
  const targetTrue =
    metrics?.relationshipTarget ??
    targetModel?.target_true_relationships ??
    null;
  const gap =
    metrics?.relationshipGap ??
    computeRelationshipGap(currentTrue, targetTrue);
  const totalContacts = metrics?.totalContacts ?? null;
  const lakeFallback = !currentTrue && !targetTrue;
  const lakeFallbackReason = !currentTrue && !targetTrue
    ? 'relationship_lake_metrics_unavailable'
    : null;
  const derivedLakeHealth =
    relationshipStructure.lake_health !== 'unclear'
      ? relationshipStructure.lake_health
      : textFrom(relationship.lake_health) ||
        textFrom(relationship.relationship_asset_strength) ||
        null;

  return {
    label: realEstate ? 'Relationship Lake' : 'Relationship System',
    subtext: realEstate
      ? 'People who know, trust, and think of you.'
      : 'Relationship and demand system for this business.',
    // Legacy size fields — always True Relationships only (never total contacts).
    current_size: currentTrue,
    target_size: targetTrue,
    gap,
    // Render-ready doctrine fields
    current_true_relationships: currentTrue,
    target_true_relationships: targetTrue,
    total_contacts: totalContacts,
    goal_summary: goal?.goal_summary || goal?.display_label || null,
    goal_source: goal?.goal_source || 'unavailable',
    goal_confidence: goal?.goal_confidence || null,
    target_basis: targetModel?.calculation_basis || null,
    current_quality: derivedLakeHealth,
    lake_health: derivedLakeHealth,
    segmentation_status:
      relationshipStructure.segmentation_status !== 'unknown'
        ? relationshipStructure.segmentation_status
        : relationship.segmentation_status || null,
    streams: streamsNode,
    outflow: outflowNode,
    vertical_specific: realEstate,
    confidence:
      goal?.goal_confidence ||
      (currentTrue || targetTrue ? 'medium' : null),
    provenance: makeProvenance({
      source_artifact: 'relationship_lake|goal_intelligence|real_estate_target_model',
      source_path: 'buildRelationshipLake',
      source_rank: 2,
      notes: realEstate
        ? 'Lake center is True Relationships only; total contacts are supporting context; structure is re-evaluated from intake with negation-aware rules'
        : 'Non-RE relationship system',
    }),
    fallback_used: lakeFallback,
    fallback_reason: lakeFallback ? lakeFallbackReason : null,
    last_updated: lastUpdated,
    modeled_not_guaranteed: targetModel?.modeled_not_guaranteed !== false,
  };
}

/**
 * Shared Five Futures / One Move alignment snapshot.
 * BA, trajectory, and One Move consumers must use these identities — not regenerate.
 */
function buildFutureAlignment({ fiveFutures, oneMove, lastUpdated }) {
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const catalog = futures.map((f) => ({
    key: f?.key || null,
    title: textFrom(f?.title || f?.label),
    probability: Number.isFinite(Number(f?.probability)) ? Number(f.probability) : null,
    risk_if_unchanged: textFrom(f?.risk_if_unchanged),
    required_shift: textFrom(f?.required_shift),
  }));
  const byKey = (key) => futures.find((f) => f?.key === key) || null;
  const current = byKey('current_future');
  const dominant = catalog.reduce((best, row) => {
    if (!row.key) return best;
    if (!best) return row;
    if (row.probability == null) return best;
    if (best.probability == null || row.probability > best.probability) return row;
    return best;
  }, null);

  return {
    futures: catalog,
    active_future_key: current?.key || 'current_future',
    active_future_title: textFrom(current?.title || current?.label),
    dominant_future_key: dominant?.key || current?.key || null,
    dominant_future_title: dominant?.title || textFrom(current?.title),
    dominant_future_probability: dominant?.probability ?? null,
    current_trajectory_future_key: 'current_future',
    potential_future_key: byKey('optimized_future')
      ? 'optimized_future'
      : byKey('transformational_future')
        ? 'transformational_future'
        : null,
    no_change_source_path: current?.risk_if_unchanged
      ? 'five_futures_v1.futures[current_future].risk_if_unchanged'
      : null,
    required_structural_change_source_path: byKey('optimized_future')?.required_shift
      ? 'five_futures_v1.futures[optimized_future].required_shift'
      : 'one_move_v1.recommendation',
    one_move: {
      title: textFrom(oneMove?.title),
      recommendation: textFrom(oneMove?.recommendation),
      root_constraint: textFrom(oneMove?.root_constraint),
      why_selected: textFrom(oneMove?.why_this_move),
      linked_future_key: byKey('optimized_future') ? 'optimized_future' : null,
      proof_target: asArray(oneMove?.success_indicators)
        .map((item) => textFrom(item))
        .filter(Boolean)
        .slice(0, 6),
      review_period: textFrom(oneMove?.first_30_days?.[0]) || null,
      modeled_shift: textFrom(
        oneMove?.expected_probability_shift?.explanation || oneMove?.expected_probability_shift
      ),
      confidence: confidenceValue(oneMove?.confidence),
      provenance: makeProvenance({
        source_artifact: 'one_move_v1',
        source_path: 'one_move_v1',
        source_rank: 1,
      }),
    },
    source_artifact: 'five_futures_v1|one_move_v1',
    last_updated: lastUpdated || fiveFutures?.generated_at || oneMove?.generated_at || null,
    confidence: confidenceValue(fiveFutures?.confidence_snapshot),
    available: futures.length > 0 || hasMeaningfulValue(oneMove?.title),
  };
}

function buildPrimaryConstraint({ draft, briefing, oneMove, lastUpdated }) {
  const primary = draft?.constraint_analysis?.primary_constraint || {};
  const snapshot = briefing?.primary_constraint_snapshot || {};
  const sectionBody = firstSectionBody(briefing, ['primary_constraint']);

  const mapConstraintPayload = ({
    name,
    rawCategory,
    explanation,
    supporting_evidence,
    contradicting_evidence,
    downstream_effects,
    rawState,
  }) => {
    const resolvedName = textFrom(name) || 'Primary constraint';
    return {
      name: resolvedName,
      // Internal key retained for architecture; display_category strips repeats.
      category: textFrom(rawCategory) || null,
      display_category: constraintCategoryDisplay(rawCategory, resolvedName),
      // Dynamic lifecycle — snapshot assessments default to ACTIVE when unset.
      state: normalizeConstraintState(
        rawState || primary.state || primary.constraint_state || snapshot.state || snapshot.constraint_state
      ),
      explanation: textFrom(explanation),
      supporting_evidence: asArray(supporting_evidence).slice(0, 6),
      contradicting_evidence: asArray(contradicting_evidence).slice(0, 4),
      downstream_effects: textFrom(downstream_effects),
    };
  };

  return selectByPriority(
    [
      {
        value: hasMeaningfulValue(primary)
          ? mapConstraintPayload({
              name: primary.label || primary.constraint_key,
              rawCategory: primary.constraint_key || primary.category,
              explanation:
                textFrom(primary.diagnostic_summary) ||
                sectionBody ||
                textFrom(primary.likely_effect_if_unchanged) ||
                textFrom(primary.summary) ||
                textFrom(primary.description),
              supporting_evidence: primary.supporting_evidence || primary.evidence,
              contradicting_evidence: primary.contradicting_evidence,
              downstream_effects: primary.likely_effect_if_unchanged,
              rawState: primary.state || primary.constraint_state,
            })
          : null,
        source_type: SOURCE_TYPES.CANONICAL_FUSED,
        provenance: makeProvenance({
          source_artifact: 'business_intelligence_draft',
          source_path: 'constraint_analysis.primary_constraint',
        }),
        confidence: confidenceValue(primary.confidence),
        evidence_sources: asArray(primary.source_questions).map((q) => ({
          artifact: 'business_assessment_intake',
          path: q,
        })),
      },
      {
        value: hasMeaningfulValue(snapshot)
          ? mapConstraintPayload({
              name: snapshot.label || snapshot.constraint_key,
              rawCategory: snapshot.constraint_key || snapshot.category,
              explanation: snapshot.diagnostic_summary || snapshot.summary || sectionBody,
              supporting_evidence: snapshot.evidence,
              contradicting_evidence: [],
              downstream_effects: snapshot.likely_effect_if_unchanged,
              rawState: snapshot.state || snapshot.constraint_state,
            })
          : null,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1',
          source_path: 'primary_constraint_snapshot',
        }),
        confidence: confidenceValue(snapshot.confidence),
      },
      {
        value: sectionBody
          ? mapConstraintPayload({
              name: 'Primary constraint',
              rawCategory: null,
              explanation: clipText(sectionBody, 360),
              supporting_evidence: [],
              contradicting_evidence: [],
              downstream_effects: null,
              rawState: 'ACTIVE',
            })
          : null,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1',
          source_path: 'sections.primary_constraint.body',
        }),
      },
      {
        value: textFrom(oneMove?.root_constraint)
          ? mapConstraintPayload({
              name: clipText(oneMove.root_constraint, 96),
              rawCategory: null,
              explanation: oneMove.root_constraint,
              supporting_evidence: oneMove.evidence,
              contradicting_evidence: [],
              downstream_effects: oneMove.expected_probability_shift?.explanation,
              rawState: 'ACTIVE',
            })
          : null,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'one_move_v1',
          source_path: 'root_constraint',
        }),
        confidence: confidenceValue(oneMove?.confidence),
      },
    ],
    { last_updated: lastUpdated }
  );
}

function buildCausalExplanation({ draft, briefing, lastUpdated }) {
  const fusion = textFrom(draft?.behavior_business_fusion?.fusion_summary);
  const primary = draft?.constraint_analysis?.primary_constraint || {};
  const businessSummary = textFrom(
    draft?.business_reality?.summary || draft?.business_reality?.diagnostic_summary
  );

  return selectByPriority(
    [
      {
        value: firstSectionBody(briefing, ['strategic_interpretation']),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1',
          source_path: 'sections.strategic_interpretation.body',
        }),
      },
      {
        value: firstSectionBody(briefing, ['primary_constraint']),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1',
          source_path: 'sections.primary_constraint.body',
        }),
      },
      {
        value:
          fusion && textFrom(primary.likely_effect_if_unchanged)
            ? `${fusion} ${textFrom(primary.likely_effect_if_unchanged)}`
            : fusion,
        source_type: SOURCE_TYPES.CANONICAL_FUSED,
        provenance: makeProvenance({
          source_artifact: 'business_intelligence_draft',
          source_path: 'behavior_business_fusion.fusion_summary',
        }),
      },
      {
        value: businessSummary,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'business_intelligence_draft',
          source_path: 'business_reality',
        }),
      },
    ],
    { last_updated: lastUpdated }
  );
}

function buildNoChangeConsequence({
  oneMove,
  fiveFutures,
  primaryConstraintNode,
  currentTrajectoryNode,
  draft,
  briefing,
  lastUpdated,
}) {
  // Priority (doctrine-aligned):
  // 1. Current active Future risk_if_unchanged
  // 2. Current trajectory persistence risk
  // 3. Canonical constraint downstream consequence
  // 4. Existing executive diagnostic no-change consequence
  // 5. Explicit deterministic fallback
  // 6. Honest absence
  // One Move expected_probability_shift.explanation is adoption logic — NOT primary no-change.
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const currentFuture = findFuture(futures, 'current_future');
  const constraintFuture = findFuture(futures, 'constraint_future');
  const primary = draft?.constraint_analysis?.primary_constraint || {};
  const trajectoryPersistence =
    textFrom(currentTrajectoryNode?.current?.persistence_risk) ||
    textFrom(draft?.current_trajectory_signal?.persistence_risk) ||
    null;
  const diagnosticNoChange =
    firstSectionBody(briefing, ['strategic_interpretation']) &&
    textFrom(primary.likely_effect_if_unchanged)
      ? textFrom(primary.likely_effect_if_unchanged)
      : textFrom(primary.likely_effect_if_unchanged) ||
        textFrom(briefing?.primary_constraint_snapshot?.likely_effect_if_unchanged) ||
        null;

  return selectByPriority(
    [
      {
        value: textFrom(currentFuture?.risk_if_unchanged),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[current_future].risk_if_unchanged',
        }),
        confidence: confidenceValue(currentFuture?.confidence),
      },
      {
        value: trajectoryPersistence,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'business_engine_contract|business_intelligence_draft',
          source_path: 'current_trajectory.current.persistence_risk',
        }),
      },
      {
        value:
          textFrom(primaryConstraintNode?.current?.downstream_effects) ||
          textFrom(primary.likely_effect_if_unchanged),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'business_intelligence_draft|business_engine_contract',
          source_path: 'primary_constraint.likely_effect_if_unchanged|downstream_effects',
        }),
        confidence: confidenceValue(primary.confidence || primaryConstraintNode?.confidence),
      },
      {
        value: diagnosticNoChange,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1|business_intelligence_draft',
          source_path: 'constraint_or_strategic_no_change_effect',
        }),
      },
      {
        value: textFrom(constraintFuture?.risk_if_unchanged) || textFrom(constraintFuture?.summary),
        source_type: SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
        fallback_used: true,
        fallback_reason: 'constraint_future_used_as_deterministic_no_change_fallback',
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[constraint_future].risk_if_unchanged|summary',
        }),
      },
      // Explicitly exclude one_move.expected_probability_shift.explanation from this chain.
      // That field explains adoption effects, not no-change consequence.
    ],
    { last_updated: lastUpdated }
  );
}

function buildOneMove({ oneMove, briefing, lastUpdated }) {
  if (hasMeaningfulValue(oneMove?.title) || hasMeaningfulValue(oneMove?.recommendation)) {
    const first30 = asArray(oneMove.first_30_days)
      .map((item) => textFrom(item))
      .filter(Boolean);
    // Implementation is the execution path (first 30 days / steps), not a re-clip of recommendation.
    const implementation =
      textFrom(oneMove.implementation) ||
      textFrom(oneMove.implementation_path) ||
      (first30.length ? first30.join(' → ') : null);

    return makeIntelligenceNode({
      current: {
        title: textFrom(oneMove.title),
        recommendation: textFrom(oneMove.recommendation),
        why_selected: textFrom(oneMove.why_this_move),
        why_now: textFrom(oneMove.why_now),
        behavioral_fit: textFrom(oneMove.behavior_fit),
        structural_fit: textFrom(oneMove.structural_fit || oneMove.root_constraint),
        proof_target: asArray(oneMove.success_indicators).map((item) => textFrom(item)).filter(Boolean),
        // Review period is a time box — prefer explicit review window over first step text.
        review_period:
          textFrom(oneMove.review_period) ||
          textFrom(oneMove.review_window) ||
          (first30.length ? '30 days' : null) ||
          '30 days',
        expected_downstream_effects: textFrom(
          oneMove.expected_probability_shift?.explanation || oneMove.expected_probability_shift
        ),
        implementation,
        first_30_days: first30,
        intervention_category: textFrom(oneMove.intervention_category),
        root_constraint: textFrom(oneMove.root_constraint),
      },
      last_updated: lastUpdated || oneMove.generated_at || null,
      confidence: confidenceValue(oneMove.confidence),
      provenance: makeProvenance({
        source_artifact: 'one_move_v1',
        source_path: 'one_move_v1',
        source_rank: 1,
      }),
      source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
      intelligence_status: INTELLIGENCE_STATUS.AVAILABLE,
      fallback_used: false,
      evidence_sources: asArray(oneMove.evidence).slice(0, 6).map((item) => ({
        artifact: 'one_move_v1',
        path: 'evidence',
        value: textFrom(item),
      })),
    });
  }

  const preliminary = firstSectionBody(briefing, ['preliminary_one_move_direction']);
  if (preliminary) {
    return makeIntelligenceNode({
      current: {
        title: 'Preliminary intervention direction',
        recommendation: clipText(preliminary, 360),
        why_selected: null,
        behavioral_fit: null,
        structural_fit: null,
        proof_target: [],
        review_period: null,
        expected_downstream_effects: null,
        implementation: null,
      },
      last_updated: lastUpdated,
      source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
      intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      fallback_used: false,
      provenance: makeProvenance({
        source_artifact: 'executive_diagnostic_briefing_v1',
        source_path: 'sections.preliminary_one_move_direction',
        source_rank: 2,
      }),
    });
  }

  return selectByPriority([], { last_updated: lastUpdated });
}

function buildModeledOpportunity({ oneMove, fiveFutures, lastUpdated }) {
  const shift = oneMove?.expected_probability_shift;
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const optimized = findFuture(futures, 'optimized_future');

  if (hasMeaningfulValue(shift)) {
    return makeIntelligenceNode({
      current: {
        value_or_range: textFrom(shift.from) && textFrom(shift.to)
          ? `${textFrom(shift.from)} → ${textFrom(shift.to)}`
          : null,
        narrative: textFrom(shift.explanation || shift),
        assumptions: asArray(oneMove?.caveats),
        time_horizon: '90 days (One Move window)' ,
        modeled_not_guaranteed: true,
      },
      last_updated: lastUpdated,
      confidence: confidenceValue(oneMove?.confidence),
      provenance: makeProvenance({
        source_artifact: 'one_move_v1',
        source_path: 'expected_probability_shift',
        source_rank: 1,
      }),
      source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
      intelligence_status: INTELLIGENCE_STATUS.AVAILABLE,
      fallback_used: false,
      evidence_sources: [{ artifact: 'one_move_v1', path: 'expected_probability_shift' }],
      extra: {
        modeled_not_guaranteed: true,
      },
    });
  }

  if (hasMeaningfulValue(optimized?.upside) || hasMeaningfulValue(optimized?.summary)) {
    return makeIntelligenceNode({
      current: {
        value_or_range: null,
        narrative: textFrom(optimized.upside || optimized.summary),
        assumptions: asArray(optimized.assumptions),
        time_horizon: null,
        modeled_not_guaranteed: true,
      },
      last_updated: lastUpdated,
      confidence: confidenceValue(optimized?.confidence),
      provenance: makeProvenance({
        source_artifact: 'five_futures_v1',
        source_path: 'futures[optimized_future]',
        source_rank: 2,
      }),
      source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
      intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      fallback_used: false,
      extra: { modeled_not_guaranteed: true },
    });
  }

  // Honest absence — never invent financial values in the contract layer.
  return makeIntelligenceNode({
    current: null,
    last_updated: lastUpdated,
    source_type: SOURCE_TYPES.HONEST_ABSENCE,
    intelligence_status: INTELLIGENCE_STATUS.ABSENT,
    fallback_used: false,
    provenance: makeProvenance({
      notes: 'No modeled opportunity intelligence; financial invention forbidden',
    }),
    extra: { modeled_not_guaranteed: true },
  });
}

function buildConfidenceReality({ draft, briefing, fiveFutures, lastUpdated }) {
  const engine = draft?.confidence_engine || {};
  if (hasMeaningfulValue(engine)) {
    return makeIntelligenceNode({
      current: {
        known: asArray(engine.known),
        observed: asArray(engine.observed),
        inferred: asArray(engine.inferred),
        assumed: asArray(engine.assumed),
        missing: asArray(engine.missing).length
          ? asArray(engine.missing)
          : asArray(draft?.missing_data),
        contradictions: asArray(draft?.contradiction_analysis?.contradictions || draft?.contradiction_analysis),
        confidence_score: engine.confidence_score ?? null,
        confidence_band: engine.confidence_band || null,
        evidence_quality: engine.evidence_quality || engine.confidence_band || null,
      },
      last_updated: lastUpdated,
      confidence: engine.confidence_band || engine.confidence_score || null,
      provenance: makeProvenance({
        source_artifact: 'business_intelligence_draft',
        source_path: 'confidence_engine',
        source_rank: 1,
      }),
      source_type: SOURCE_TYPES.CANONICAL_FUSED,
      intelligence_status: INTELLIGENCE_STATUS.AVAILABLE,
      fallback_used: false,
      evidence_sources: [{ artifact: 'business_intelligence_draft', path: 'confidence_engine' }],
    });
  }

  const snapshot = briefing?.confidence_snapshot || fiveFutures?.confidence_snapshot;
  if (hasMeaningfulValue(snapshot)) {
    return makeIntelligenceNode({
      current: {
        known: [],
        observed: [],
        inferred: [],
        assumed: [],
        missing: asArray(briefing?.missing_data || draft?.missing_data),
        contradictions: [],
        confidence_score: typeof snapshot === 'object' ? snapshot.score ?? null : null,
        confidence_band:
          typeof snapshot === 'object' ? snapshot.band || textFrom(snapshot) : textFrom(snapshot),
        evidence_quality: null,
      },
      last_updated: lastUpdated,
      confidence: typeof snapshot === 'object' ? snapshot.band || snapshot.score : snapshot,
      provenance: makeProvenance({
        source_artifact: 'executive_diagnostic_briefing_v1|five_futures_v1',
        source_path: 'confidence_snapshot',
        source_rank: 2,
      }),
      source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
      intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      fallback_used: false,
    });
  }

  return selectByPriority([], { last_updated: lastUpdated });
}

function buildTruthBoundaries({ draft, briefing, oneMove, confidenceNode, lastUpdated }) {
  const missing = [
    ...asArray(draft?.missing_data),
    ...asArray(briefing?.missing_data),
    ...asArray(confidenceNode?.current?.missing),
  ];
  const caveats = [
    ...asArray(briefing?.caveats),
    ...asArray(oneMove?.caveats),
    ...asArray(draft?.assumptions),
  ].map((item) => textFrom(item)).filter(Boolean);

  const uniqueMissing = [...new Set(missing.map((item) => textFrom(item)).filter(Boolean))];
  const uniqueCaveats = [...new Set(caveats)];

  if (!uniqueMissing.length && !uniqueCaveats.length && !confidenceNode?.current) {
    return selectByPriority([], { last_updated: lastUpdated });
  }

  return makeIntelligenceNode({
    current: {
      missing_data: uniqueMissing,
      caveats: uniqueCaveats,
      confidence_band: confidenceNode?.current?.confidence_band || null,
      confidence_score: confidenceNode?.current?.confidence_score ?? null,
      do_not_overclaim: uniqueMissing.length
        ? `Missing evidence includes: ${uniqueMissing.slice(0, 6).join(', ')}`
        : 'No explicit missing-data list; still treat modeled outcomes as non-guaranteed.',
      known_vs_inferred: {
        known: asArray(confidenceNode?.current?.known),
        observed: asArray(confidenceNode?.current?.observed),
        inferred: asArray(confidenceNode?.current?.inferred),
        assumed: asArray(confidenceNode?.current?.assumed),
      },
    },
    last_updated: lastUpdated,
    confidence: confidenceNode?.confidence || null,
    provenance: makeProvenance({
      source_artifact: 'business_intelligence_draft|executive_diagnostic_briefing_v1|one_move_v1',
      source_path: 'confidence_engine+missing_data+caveats',
      source_rank: 1,
    }),
    source_type: SOURCE_TYPES.CANONICAL_FUSED,
    intelligence_status: uniqueMissing.length || uniqueCaveats.length
      ? INTELLIGENCE_STATUS.AVAILABLE
      : INTELLIGENCE_STATUS.PARTIAL,
    fallback_used: false,
    evidence_sources: [
      { artifact: 'business_intelligence_draft', path: 'missing_data' },
      { artifact: 'executive_diagnostic_briefing_v1', path: 'caveats' },
    ],
  });
}

/**
 * Final render-ready Truth Rail entries.
 * All semantic classification happens here (or earlier). Renderer must only bind fields.
 */
function bandToRenderStatus(bandOrScore) {
  if (bandOrScore === null || bandOrScore === undefined || bandOrScore === '') return 'missing';
  if (typeof bandOrScore === 'number') {
    if (bandOrScore >= 80) return 'strong';
    if (bandOrScore >= 50) return 'partial';
    return 'missing';
  }
  const source = String(bandOrScore).toLowerCase();
  if (/high|strong|complete/.test(source)) return 'strong';
  if (/low|missing|weak/.test(source)) return 'missing';
  return 'partial';
}

function itemMatchesAny(list, pattern) {
  return asArray(list).some((item) => pattern.test(String(item || '')));
}

function filterMatching(list, pattern) {
  return asArray(list)
    .map((item) => textFrom(item))
    .filter((item) => item && pattern.test(item));
}

function buildTruthRail({
  confidenceNode,
  truthNode,
  primaryConstraintNode,
  behavioralModifierNode,
  businessModelAlignmentNode,
  verticalContext,
  identity,
  assessmentType,
  lastUpdated,
}) {
  const confidence = confidenceNode?.current || {};
  const truth = truthNode?.current || {};
  const known = asArray(confidence.known);
  const observed = asArray(confidence.observed);
  const inferred = asArray(confidence.inferred);
  const assumed = asArray(confidence.assumed);
  const missing = asArray(confidence.missing).length
    ? asArray(confidence.missing)
    : asArray(truth.missing_data);

  const band = confidence.confidence_band || truth.confidence_band || null;
  const score = confidence.confidence_score ?? truth.confidence_score ?? null;
  const confidenceStatus = bandToRenderStatus(band ?? score);

  const financialMissing = filterMatching(missing, /financial|gci|profit|expense|p_and_l|net|complete_financial/i);
  const hasFinancialKnown = itemMatchesAny([...known, ...observed], /financial|q9|gci|profit|expense/i);
  const hasRelationshipKnown = itemMatchesAny(
    [...known, ...observed],
    /relationship|database|contact|q3|q5/i
  );
  const hasRelationshipMissing = itemMatchesAny(missing, /relationship|database/i);
  const hasBehavioral = itemMatchesAny(
    [...known, ...observed],
    /behavioral|profile|dimension/
  ) || hasMeaningfulValue(behavioralModifierNode?.current) || hasMeaningfulValue(identity?.owner_profile_type);

  const hasConstraint = hasMeaningfulValue(primaryConstraintNode?.current?.name);
  const constraintConfidence = bandToRenderStatus(primaryConstraintNode?.confidence);
  const isRealEstate =
    verticalContext?.vertical_id === 'real_estate' ||
    /real[_\s-]?estate/i.test(String(assessmentType || ''));
  const hasModelAlignment = hasMeaningfulValue(businessModelAlignmentNode?.current) || isRealEstate || Boolean(assessmentType);

  const entries = [
    {
      label: 'Financial Reality',
      status: financialMissing.length ? 'missing' : hasFinancialKnown ? 'partial' : 'partial',
      note: financialMissing.length
        ? `Financial evidence gaps: ${financialMissing.slice(0, 4).join(', ')}`
        : hasFinancialKnown
          ? 'Financial completeness taken from confidence/truth contract fields.'
          : 'Financial evidence partial or incomplete in confidence contract.',
    },
    {
      label: 'Behavioral Profile',
      status: hasBehavioral
        ? itemMatchesAny(known, /behavioral|profile|dimension/)
          ? 'strong'
          : 'partial'
        : 'missing',
      note: hasBehavioral
        ? 'Behavioral evidence present in confidence_reality / behavioral_modifier contract fields.'
        : 'Behavioral profile context is partial or missing in confidence contract.',
    },
    {
      label: 'Business Model',
      status: isRealEstate ? 'strong' : hasModelAlignment ? 'partial' : 'missing',
      note:
        verticalContext?.notes ||
        (assessmentType
          ? 'Business model fit taken from vertical_context / assessment type contract fields.'
          : 'Business model evidence is missing.'),
    },
    {
      label: 'Constraint',
      status: hasConstraint && constraintConfidence !== 'missing' ? 'strong' : hasConstraint ? 'partial' : 'missing',
      note: hasConstraint
        ? 'Primary constraint routed from Business Engine Contract / assessment intelligence.'
        : 'Primary constraint is missing.',
    },
    {
      label: 'Confidence',
      status: confidenceStatus,
      note:
        band !== null || score !== null
          ? `Confidence contract: band=${band || 'n/a'}; score=${score ?? 'n/a'}; known=${known.length}; missing=${missing.length}.`
          : 'Overall confidence structure unavailable.',
    },
    {
      label: 'Relationships',
      status: hasRelationshipKnown ? 'strong' : hasRelationshipMissing ? 'missing' : 'partial',
      note: hasRelationshipKnown
        ? 'Relationship/database evidence present in confidence contract.'
        : 'Relationship evidence incomplete per confidence/truth contract.',
    },
    {
      label: 'Inferred vs Assumed',
      status: assumed.length ? 'partial' : inferred.length ? 'partial' : 'strong',
      note: `Inferred=${inferred.length}; assumed=${assumed.length}. ${
        asArray(truth.caveats).length
          ? `Caveats: ${asArray(truth.caveats).slice(0, 2).map((c) => textFrom(c)).filter(Boolean).join(' ')}`
          : 'No extra caveats.'
      }`,
    },
    {
      label: 'Truth Boundaries',
      status: missing.length ? 'partial' : 'strong',
      note:
        textFrom(truth.do_not_overclaim) ||
        (missing.length
          ? `Missing evidence includes: ${asArray(missing).slice(0, 5).map((m) => textFrom(m)).filter(Boolean).join(', ')}`
          : 'No explicit missing-data list on contract.'),
    },
  ];

  const hasAny =
    confidenceNode?.current ||
    truthNode?.current ||
    hasConstraint ||
    hasBehavioral ||
    isRealEstate;

  if (!hasAny) {
    return selectByPriority([], { last_updated: lastUpdated });
  }

  return makeIntelligenceNode({
    current: entries,
    last_updated: lastUpdated,
    confidence: band || score,
    provenance: makeProvenance({
      source_artifact: 'business_engine_contract',
      source_path: 'confidence_reality+truth_boundaries+primary_constraint+vertical_context',
      source_rank: 1,
      notes: 'Final render-ready Truth Rail entries; renderer must not reclassify',
    }),
    source_type: SOURCE_TYPES.CANONICAL_FUSED,
    intelligence_status: INTELLIGENCE_STATUS.AVAILABLE,
    fallback_used: false,
    evidence_sources: [
      { artifact: 'business_engine_contract', path: 'confidence_reality' },
      { artifact: 'business_engine_contract', path: 'truth_boundaries' },
      { artifact: 'business_engine_contract', path: 'primary_constraint' },
    ],
  });
}

function buildFooterIntelligence({
  governingPattern,
  oneMoveNode,
  primaryConstraintNode,
  lastUpdated,
}) {
  const patternTitle = governingPattern?.current?.title;
  const patternSummary = governingPattern?.current?.summary;
  const moveTitle = oneMoveNode?.current?.title;
  const moveRec = oneMoveNode?.current?.recommendation;
  const constraintName = primaryConstraintNode?.current?.name;

  if (moveTitle && (patternSummary || moveRec)) {
    return makeIntelligenceNode({
      current: {
        headline: clipText(String(moveTitle).toUpperCase(), 96),
        subline: clipText(patternSummary || moveRec, 180),
        personalized: true,
      },
      last_updated: lastUpdated,
      provenance: makeProvenance({
        source_artifact: 'one_move_v1|governing_business_pattern',
        source_path: 'title+summary',
        source_rank: 1,
      }),
      source_type: SOURCE_TYPES.CANONICAL_FUSED,
      intelligence_status: INTELLIGENCE_STATUS.AVAILABLE,
      fallback_used: false,
      evidence_sources: [
        { artifact: 'one_move_v1', path: 'title' },
        { artifact: 'business_engine_contract', path: 'governing_business_pattern' },
      ],
    });
  }

  if (constraintName && patternSummary) {
    return makeIntelligenceNode({
      current: {
        headline: clipText(String(constraintName).toUpperCase(), 96),
        subline: clipText(patternSummary, 180),
        personalized: true,
      },
      last_updated: lastUpdated,
      provenance: makeProvenance({
        source_artifact: 'primary_constraint|governing_business_pattern',
        source_path: 'name+summary',
        source_rank: 2,
      }),
      source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
      intelligence_status: INTELLIGENCE_STATUS.PARTIAL,
      fallback_used: false,
    });
  }

  return makeIntelligenceNode({
    current: null,
    last_updated: lastUpdated,
    source_type: SOURCE_TYPES.HONEST_ABSENCE,
    intelligence_status: INTELLIGENCE_STATUS.ABSENT,
    fallback_used: false,
    provenance: makeProvenance({
      notes: 'Footer intelligence absent — renderer may hide or show minimal honesty state',
    }),
  });
}

function buildCurrentBusinessReality({
  draft,
  briefing,
  fiveFutures,
  lastUpdated,
  answers,
  oneMove,
  metricsOption = null,
}) {
  const reality = draft?.business_reality || {};
  const section = firstSectionBody(briefing, ['current_business_reality']);
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const currentFuture = findFuture(futures, 'current_future');
  const draftSummary = textFrom(reality.summary || reality.diagnostic_summary);
  const generatedSummary = textFrom(currentFuture?.summary || currentFuture?.trajectory_logic);
  const briefingSummary = section ? clipText(section, 280) : null;
  const summary =
    draftSummary ||
    generatedSummary ||
    briefingSummary ||
    textFrom(reality.current_stage?.description);
  const individualizedSummary = Boolean(draftSummary || generatedSummary || briefingSummary);

  const display = buildCurrentRealityDisplayRows({
    answers,
    draft,
    briefing,
    oneMove,
    lastUpdated,
    metricsOption,
  });

  if (!summary && !hasMeaningfulValue(reality) && display.rows.length === 0) {
    return selectByPriority([], { last_updated: lastUpdated });
  }

  const hasRows = display.rows.length > 0;
  const intelligence_status = summary
    ? hasRows
      ? INTELLIGENCE_STATUS.AVAILABLE
      : INTELLIGENCE_STATUS.PARTIAL
    : hasRows
      ? INTELLIGENCE_STATUS.PARTIAL
      : INTELLIGENCE_STATUS.ABSENT;

  return makeIntelligenceNode({
    current: {
      summary,
      stage: textFrom(reality.current_stage?.label || reality.current_stage?.description),
      production: reality.current_production_reality || null,
      raw_section: reality,
      summary_source: draftSummary
        ? 'business_intelligence_draft.business_reality'
        : generatedSummary
          ? 'five_futures_v1.futures[current_future]'
          : briefingSummary
            ? 'executive_diagnostic_briefing_v1.sections[current_business_reality]'
            : 'business_intelligence_draft.business_reality.current_stage.description',
      availability: summary || hasRows ? (hasRows && summary ? 'available' : 'partial') : 'absent',
      rows: display.rows,
    },
    last_updated: lastUpdated,
    confidence: confidenceValue(reality.confidence),
    provenance: makeProvenance({
      source_artifact: individualizedSummary
        ? 'business_intelligence_draft|five_futures_v1|executive_diagnostic_briefing_v1'
        : 'business_intelligence_draft',
      source_path: individualizedSummary
        ? 'business_reality|futures[current_future]|sections[current_business_reality]'
        : 'business_reality.current_stage.description',
      source_rank: individualizedSummary ? 1 : 3,
      notes: individualizedSummary
        ? 'Individualized condition summary; shared stage taxonomy remains classification only'
        : 'Legacy stage description used because individualized condition narrative is unavailable',
    }),
    source_type: individualizedSummary
      ? SOURCE_TYPES.DOMAIN_INTELLIGENCE
      : SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
    intelligence_status,
    fallback_used: Boolean(summary && !individualizedSummary),
    fallback_reason:
      summary && !individualizedSummary
        ? 'individualized_business_condition_summary_unavailable_using_stage_taxonomy'
        : null,
    evidence_sources: asArray(reality.evidence).slice(0, 4).map((item) => ({
      artifact: 'business_intelligence_draft',
      path: 'business_reality.evidence',
      value: textFrom(item),
    })),
  });
}

/**
 * Future operating-model fields from doctrine-backed sources only.
 * Never fabricates 6x6 / 35+ / CRM / systems claims without source support.
 */
function buildFutureOperatingModel({
  future = null,
  oneMove = null,
  metricsOption = null,
  draft = null,
  answers = null,
  realEstate = false,
} = {}) {
  const assumptions = asArray(future?.assumptions);
  const systemsSummary = textFrom(
    draft?.systems_reality?.summary || draft?.systems_reality?.diagnostic_summary
  );
  const targetLakeMetric = metricsOption?.relationshipTarget || null;
  const targetLake =
    targetLakeMetric == null
      ? null
      : typeof targetLakeMetric === 'object'
        ? targetLakeMetric
        : { value: targetLakeMetric };

  const requiredSystems =
    textFrom(future?.required_shift) ||
    textFrom(future?.required_systems) ||
    textFrom(oneMove?.structural_fit) ||
    systemsSummary ||
    null;

  const expectedStabilization =
    textFrom(future?.expected_stabilization) ||
    pickTextMatching(assumptions, /stabil|predictab|reliab|consist/i) ||
    textFrom(future?.stabilization) ||
    null;

  const first30 = asArray(oneMove?.first_30_days)
    .map((item) => textFrom(item))
    .filter(Boolean);
  const cadenceInstruction =
    pickTextMatching(
      first30,
      /\b(?:daily|weekly|monthly|every\s+(?:day|week|month)|cadence|rhythm)\b/i
    ) ||
    pickTextMatching(
      first30,
      /\b(?:review|inspection)\b/i
    ) ||
    (/(\bdaily\b|\bweekly\b|\bmonthly\b|\bcadence\b|\brhythm\b|\binspect)/i.test(
      textFrom(oneMove?.recommendation) || ''
    )
      ? textFrom(oneMove?.recommendation)
      : null);
  const expectedBusinessRhythm =
    textFrom(future?.expected_business_rhythm) ||
    textFrom(future?.business_rhythm) ||
    textFrom(oneMove?.review_period) ||
    cadenceInstruction ||
    null;

  const expectedProductionEffect =
    textFrom(future?.upside) ||
    textFrom(future?.expected_production_effect) ||
    textFrom(oneMove?.expected_probability_shift?.explanation || oneMove?.expected_probability_shift) ||
    null;

  const timeToEffect =
    textFrom(future?.time_to_effect) ||
    textFrom(oneMove?.review_period) ||
    textFrom(oneMove?.expected_probability_shift?.time_horizon) ||
    null;

  // Doctrine tokens only when RE + source language actually supports them.
  const doctrineCorpus = [
    textFrom(future?.summary),
    textFrom(future?.required_shift),
    textFrom(oneMove?.recommendation),
    textFrom(oneMove?.title),
    JSON.stringify(answers || {}),
  ]
    .filter(Boolean)
    .join('\n');
  const supported_doctrine_tokens = realEstate ? extractSupportedDoctrineTokens(doctrineCorpus) : [];

  const model = {
    target_lake: targetLake,
    required_systems: requiredSystems,
    expected_stabilization: expectedStabilization,
    expected_business_rhythm: expectedBusinessRhythm,
    expected_production_effect: expectedProductionEffect,
    time_to_effect: timeToEffect,
    supported_doctrine_tokens,
  };

  const hasAny =
    targetLake != null ||
    Boolean(requiredSystems) ||
    Boolean(expectedStabilization) ||
    Boolean(expectedBusinessRhythm) ||
    Boolean(expectedProductionEffect) ||
    Boolean(timeToEffect) ||
    supported_doctrine_tokens.length > 0;

  return hasAny ? model : null;
}

function buildPotentialBusinessFuture({
  fiveFutures,
  oneMove,
  lastUpdated,
  answers,
  draft,
  briefing,
  metricsOption = null,
  assessmentType = null,
}) {
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const optimized = findFuture(futures, 'optimized_future');
  const transformational = findFuture(futures, 'transformational_future');
  const realEstate = isRealEstateAssessment(assessmentType, answers);
  const display = buildPotentialFutureDisplayRows({
    answers,
    draft,
    briefing,
    oneMove,
    lastUpdated,
    metricsOption,
  });

  const mapFuturePayload = (future, summary, provenanceNotes) => {
    const operating_model = buildFutureOperatingModel({
      future,
      oneMove,
      metricsOption,
      draft,
      answers,
      realEstate,
    });
    return {
      summary,
      explanation: summary,
      availability: 'available',
      // Structural change remains on contract for architecture; V2 UI avoids duplicating
      // it when already represented in One Move / What Changes The Future.
      required_structural_change:
        textFrom(future?.required_shift) || textFrom(oneMove?.recommendation) || null,
      assumptions: asArray(future?.assumptions),
      confidence: confidenceValue(future?.confidence),
      rows: display.rows,
      provenance_notes: provenanceNotes,
      operating_model,
      target_lake: operating_model?.target_lake || null,
      required_systems: operating_model?.required_systems || null,
      expected_stabilization: operating_model?.expected_stabilization || null,
      expected_business_rhythm: operating_model?.expected_business_rhythm || null,
      expected_production_effect: operating_model?.expected_production_effect || null,
      time_to_effect: operating_model?.time_to_effect || null,
      supported_doctrine_tokens: operating_model?.supported_doctrine_tokens || [],
    };
  };

  return selectByPriority(
    [
      {
        value: textFrom(optimized?.summary),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[optimized_future].summary',
        }),
        confidence: confidenceValue(optimized?.confidence),
        mapCurrent: (summary) => mapFuturePayload(optimized, summary, 'optimized_future'),
      },
      {
        value: textFrom(transformational?.summary),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[transformational_future].summary',
        }),
        mapCurrent: (summary) => mapFuturePayload(transformational, summary, 'transformational_future'),
      },
      // Rows alone never invent a future narrative — only attach when future intelligence exists above.
    ],
    { last_updated: lastUpdated }
  );
}

function buildBusinessModelAlignment({ draft, record, lastUpdated }) {
  const shellSummary =
    record?.business_model_alignment_summary ||
    record?.customer_language_v2?.business_model_alignment_summary ||
    null;
  const systems = textFrom(draft?.systems_reality?.summary || draft?.systems_reality?.diagnostic_summary);

  return selectByPriority(
    [
      {
        value: textFrom(shellSummary),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'customer_language_or_shell',
          source_path: 'business_model_alignment_summary',
        }),
      },
      {
        value: systems,
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'business_intelligence_draft',
          source_path: 'systems_reality',
        }),
      },
    ],
    { last_updated: lastUpdated }
  );
}

function buildBusinessEngineDimensions({ draft, eToP, lastUpdated }) {
  // Legacy BA records do not persist a separate pillar model. inferEToPScores
  // is still profile-scoped when it has evidence from this record, so classify
  // it as deterministic individualized inference rather than a shared fallback.
  const systemsSummary = textFrom(draft?.systems_reality?.summary || draft?.systems_reality?.diagnostic_summary);
  const accountabilitySummary = textFrom(
    draft?.accountability_reality?.summary || draft?.accountability_reality?.diagnostic_summary
  );

  const dimensions = eToP && typeof eToP === 'object' ? eToP : null;
  const usedDeterministic = Boolean(dimensions);
  const usedIntelligence = Boolean(systemsSummary || accountabilitySummary);
  const pillarKeys = ['models', 'systems', 'tools', 'accountability', 'education'];
  const hasIndividualizedEvidence = Boolean(
    dimensions &&
      pillarKeys.some((key) => {
        const pillar = dimensions[key];
        return asArray(pillar?.evidence).length > 0;
      })
  );

  if (!dimensions && !usedIntelligence) {
    return selectByPriority([], { last_updated: lastUpdated });
  }

  return makeIntelligenceNode({
    current: {
      pillars: dimensions,
      systems_reality_summary: systemsSummary,
      accountability_reality_summary: accountabilitySummary,
      interpretation_note: hasIndividualizedEvidence
        ? 'Pillar scores are deterministic individualized inference from this assessment evidence; not a persisted Intelligence Layer pillar model.'
        : 'Pillar scores are generic deterministic fallback because individualized pillar evidence is unavailable.',
    },
    last_updated: lastUpdated,
    source_type: usedIntelligence && !usedDeterministic
      ? SOURCE_TYPES.DOMAIN_INTELLIGENCE
      : SOURCE_TYPES.DETERMINISTIC_NORMALIZED,
    intelligence_status:
      usedIntelligence || hasIndividualizedEvidence
        ? INTELLIGENCE_STATUS.PARTIAL
        : INTELLIGENCE_STATUS.FALLBACK,
    fallback_used: usedDeterministic && !hasIndividualizedEvidence,
    fallback_reason: usedDeterministic && !hasIndividualizedEvidence
      ? 'individualized_pillar_evidence_unavailable_using_generic_deterministic_baseline'
      : null,
    provenance: makeProvenance({
      source_artifact: usedDeterministic ? 'inferEToPScores' : 'business_intelligence_draft',
      source_path: usedDeterministic ? 'eToP' : 'systems_reality|accountability_reality',
      source_rank: hasIndividualizedEvidence || usedIntelligence ? 1 : 2,
      notes: hasIndividualizedEvidence
        ? 'Read-time individualized legacy projection; scores remain deterministic and evidence-bound'
        : null,
    }),
  });
}

function collectLegacyFallbacks(contract) {
  const used = [];
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (node.fallback_used) {
      used.push({
        path,
        fallback_reason: node.fallback_reason,
        source_type: node.source_type,
        source_path: node.provenance?.source_path || null,
      });
    }
    if (node.current && typeof node.current === 'object' && !Array.isArray(node.current)) {
      // do not deep-walk current payloads for fallback flags
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'current' || key === 'previous') continue;
      if (value && typeof value === 'object' && (value.fallback_used !== undefined || value.intelligence_status)) {
        walk(value, path ? `${path}.${key}` : key);
      } else if (value && typeof value === 'object' && !Array.isArray(value) && key !== 'contract_metadata') {
        // nested domains like relationship_lake.streams
        for (const [subKey, subVal] of Object.entries(value)) {
          if (subVal && typeof subVal === 'object' && subVal.fallback_used !== undefined) {
            walk(subVal, `${path ? `${path}.` : ''}${key}.${subKey}`);
          }
        }
      }
    }
  };

  for (const [key, value] of Object.entries(contract)) {
    if (key === 'contract_metadata' || key === 'identity' || key === 'vertical_context') continue;
    walk(value, key);
  }
  return used;
}

/**
 * @param {object} record - BA retrieve payload / assessment record
 * @param {object} [options]
 * @param {object} [options.eToP] - optional precomputed pillar scores
 * @param {object} [options.metrics] - optional extracted metrics (current/target/gap)
 */
export function buildBusinessEngineContract(record, options = {}) {
  const { assessment, draft, briefing, fiveFutures, oneMove, answers } = extractAssessmentBundle(record);
  const lastUpdated = resolveTimestamp(assessment, draft, briefing, fiveFutures, oneMove);
  const assessmentType = assessment.assessment_type || briefing.audience_type || 'business_assessment';
  const verticalContext = buildVerticalContext({
    assessmentType,
    answers,
    lastUpdated,
  });

  const governing_business_pattern = buildGoverningBusinessPattern({
    draft,
    briefing,
    fiveFutures,
    lastUpdated,
  });
  const behavioral_modifier = buildBehavioralModifier({
    draft,
    fiveFutures,
    oneMove,
    lastUpdated,
  });
  const current_trajectory = buildCurrentTrajectory({ draft, briefing, fiveFutures, lastUpdated });
  const potential_trajectory = buildPotentialTrajectory({ fiveFutures, oneMove, lastUpdated });
  const primary_constraint = buildPrimaryConstraint({ draft, briefing, oneMove, lastUpdated });
  const causal_explanation = buildCausalExplanation({ draft, briefing, lastUpdated });
  const no_change_consequence = buildNoChangeConsequence({
    oneMove,
    fiveFutures,
    primaryConstraintNode: primary_constraint,
    currentTrajectoryNode: current_trajectory,
    draft,
    briefing,
    lastUpdated,
  });
  // future change prefers one move; fix empty candidate
  const futures = Array.isArray(fiveFutures?.futures) ? fiveFutures.futures : [];
  const optimized = findFuture(futures, 'optimized_future');
  const future_change_logic = selectByPriority(
    [
      {
        value: textFrom(oneMove?.why_this_move),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'one_move_v1',
          source_path: 'why_this_move',
        }),
        confidence: confidenceValue(oneMove?.confidence),
      },
      {
        value: textFrom(oneMove?.recommendation),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'one_move_v1',
          source_path: 'recommendation',
        }),
      },
      {
        value: textFrom(optimized?.required_shift),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'five_futures_v1',
          source_path: 'futures[optimized_future].required_shift',
        }),
      },
      {
        value: firstSectionBody(briefing, ['preliminary_one_move_direction']),
        source_type: SOURCE_TYPES.DOMAIN_INTELLIGENCE,
        provenance: makeProvenance({
          source_artifact: 'executive_diagnostic_briefing_v1',
          source_path: 'sections.preliminary_one_move_direction',
        }),
      },
    ],
    { last_updated: lastUpdated }
  );

  const one_move = buildOneMove({ oneMove, briefing, lastUpdated });
  const modeled_opportunity = buildModeledOpportunity({ oneMove, fiveFutures, lastUpdated });
  const confidence_reality = buildConfidenceReality({ draft, briefing, fiveFutures, lastUpdated });
  const truth_boundaries = buildTruthBoundaries({
    draft,
    briefing,
    oneMove,
    confidenceNode: confidence_reality,
    lastUpdated,
  });
  const business_model_alignment = buildBusinessModelAlignment({ draft, record, lastUpdated });
  const truth_rail = buildTruthRail({
    confidenceNode: confidence_reality,
    truthNode: truth_boundaries,
    primaryConstraintNode: primary_constraint,
    behavioralModifierNode: behavioral_modifier,
    businessModelAlignmentNode: business_model_alignment,
    verticalContext,
    identity: {
      owner_profile_type: assessment.profile_context?.owner_profile_type || null,
    },
    assessmentType,
    lastUpdated,
  });
  const footer_intelligence = buildFooterIntelligence({
    governingPattern: governing_business_pattern,
    oneMoveNode: one_move,
    primaryConstraintNode: primary_constraint,
    lastUpdated,
  });

  // Contract-owned metric assembly (display rows + lake sizes). Parallel normalized
  // panels are not accepted as semantic sources for V2.
  const extractedMetrics = extractAssessmentMetricSources({ answers, draft, briefing, oneMove });

  // Canonical goal intelligence (declared > inferred > honest absence).
  const goal_intelligence = buildGoalIntelligence({
    answers,
    draft,
    briefing,
    lastUpdated,
  });

  // Explicit relationship target from intake language may still win for target model;
  // income goals supply doctrine-based true-relationship targets when no explicit TR target.
  const baseMetrics = {
    currentTrueRelationships:
      options.metrics?.currentTrueRelationships || extractedMetrics.currentTrueRelationships || null,
    relationshipTarget:
      options.metrics?.relationshipTarget || extractedMetrics.relationshipTarget || null,
    totalContacts: options.metrics?.totalContacts || extractedMetrics.totalContacts || null,
    relationshipGap: options.metrics?.relationshipGap || null,
  };

  const real_estate_target_model = isRealEstateAssessment(assessmentType, answers)
    ? buildRealEstateTargetModel({
        goal: goal_intelligence,
        metrics: baseMetrics,
        answers,
        lastUpdated,
      })
    : null;

  // Prefer doctrine/goal target when explicit relationship target missing.
  const resolvedTarget =
    baseMetrics.relationshipTarget ||
    real_estate_target_model?.target_true_relationships ||
    null;

  const lakeMetrics = {
    ...baseMetrics,
    relationshipTarget: resolvedTarget,
    relationshipGap: baseMetrics.relationshipGap || null,
  };
  if (!lakeMetrics.relationshipGap) {
    lakeMetrics.relationshipGap = computeRelationshipGap(
      lakeMetrics.currentTrueRelationships,
      lakeMetrics.relationshipTarget
    );
  }

  const future_alignment = buildFutureAlignment({ fiveFutures, oneMove, lastUpdated });

  const relationship_lake = buildRelationshipLake({
    draft,
    briefing,
    oneMove,
    answers,
    assessmentType,
    lastUpdated,
    metrics: lakeMetrics,
    goal: goal_intelligence,
    targetModel: real_estate_target_model,
  });

  const potential_business_future = buildPotentialBusinessFuture({
    fiveFutures,
    oneMove,
    lastUpdated,
    answers,
    draft,
    briefing,
    metricsOption: lakeMetrics,
    assessmentType,
  });

  const contract = {
    contract_metadata: {
      contract_name: CONTRACT_NAME,
      contract_version: CONTRACT_VERSION,
      vertical_adapter_version: verticalContext.vertical_adapter_version,
      assessment_version:
        assessment.assessment_version ||
        assessment.version ||
        draft?.version ||
        briefing?.version ||
        null,
      generated_at: lastUpdated,
      assembled_at: new Date().toISOString(),
      source_profile_id:
        assessment.owner_profile_id ||
        assessment.profile_context?.owner_profile_id ||
        briefing.owner_profile_id ||
        fiveFutures.owner_profile_id ||
        null,
      source_assessment_id:
        assessment.assessment_id || briefing.assessment_id || fiveFutures.assessment_id || oneMove.assessment_id || null,
      compatibility_mode: COMPATIBILITY_MODE_BA_SNAPSHOT,
      compatibility_projection_version: BA_VISUAL_PROJECTION_VERSION,
      compatibility_projection_strategy: 'deterministic_read_time_from_preserved_ba_artifacts',
      legacy_fallbacks_used: [],
      snapshot_mode: true,
      customer_facing_model_names_exposed: false,
      // Backward-compatible extension marker (still business-engine-contract-v1).
      visualization_semantics: 'contract_owned_v1',
    },
    identity: {
      owner_name: assessment.profile_context?.owner_profile_name || null,
      owner_profile_type: assessment.profile_context?.owner_profile_type || null,
      profile_id:
        assessment.owner_profile_id ||
        assessment.profile_context?.owner_profile_id ||
        briefing.owner_profile_id ||
        null,
      assessment_id: assessment.assessment_id || briefing.assessment_id || null,
      assessment_type: assessmentType,
    },
    vertical_context: verticalContext,
    current_business_reality: buildCurrentBusinessReality({
      draft,
      briefing,
      fiveFutures,
      lastUpdated,
      answers,
      oneMove,
      metricsOption: lakeMetrics,
    }),
    governing_business_pattern,
    behavioral_modifier,
    business_model_alignment,
    business_engine_dimensions: buildBusinessEngineDimensions({
      draft,
      eToP: options.eToP,
      lastUpdated,
    }),
    relationship_lake,
    goal_intelligence,
    real_estate_target_model,
    future_alignment,
    current_trajectory,
    potential_business_future,
    potential_trajectory,
    primary_constraint,
    causal_explanation,
    no_change_consequence,
    future_change_logic,
    one_move,
    modeled_opportunity,
    confidence_reality,
    truth_boundaries,
    truth_rail,
    footer_intelligence,
  };

  contract.contract_metadata.legacy_fallbacks_used = collectLegacyFallbacks(contract);
  // Ensure temporal baseline fields on snapshot
  contract.contract_metadata.trend = SNAPSHOT_TREND;
  contract.contract_metadata.reason_for_change = SNAPSHOT_REASON_FOR_CHANGE;

  return contract;
}

export default buildBusinessEngineContract;
