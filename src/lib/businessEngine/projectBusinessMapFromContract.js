/**
 * Surface projection: Business Engine Contract → existing BA Visual businessMap shape.
 *
 * Preserves layout slots (caption/line, streams string[], chain cards, footer).
 * Does not reinterpret intelligence — only formats contract fields for the current renderer.
 */

import { clipText, hasMeaningfulValue, textFrom } from './intelligenceField.js';

function clip(value, max) {
  return clipText(value, max) || 'Not available';
}

function streamNames(streamsNode) {
  const items = Array.isArray(streamsNode?.current) ? streamsNode.current : [];
  return items
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter(Boolean);
}

function outflowNames(outflowNode) {
  const items = Array.isArray(outflowNode?.current) ? outflowNode.current : [];
  return items
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter(Boolean);
}

function compactMetricDisplay(metric) {
  if (metric === null || metric === undefined) return 'Not provided';
  if (typeof metric === 'string') return metric;
  if (typeof metric === 'number' && Number.isFinite(metric)) {
    return new Intl.NumberFormat('en-US').format(Math.round(metric));
  }
  if (typeof metric === 'object') {
    if (metric.display) return metric.display;
    if (metric.range && Number.isFinite(metric.low) && Number.isFinite(metric.high)) {
      const prefix = metric.estimated ? 'Approx. ' : '';
      return `${prefix}${new Intl.NumberFormat('en-US').format(Math.round(metric.low))}–${new Intl.NumberFormat('en-US').format(Math.round(metric.high))}`;
    }
    if (Number.isFinite(metric.value)) {
      const prefix = metric.estimated ? '~' : '';
      return `${prefix}${new Intl.NumberFormat('en-US').format(Math.round(metric.value))}`;
    }
  }
  return 'Not provided';
}

function trajectoryCaptionLine(trajectoryNode, { fallbackCaption, fallbackLine }) {
  const current = trajectoryNode?.current;
  if (!hasMeaningfulValue(current)) {
    return {
      caption: fallbackCaption,
      line: fallbackLine,
      summary: null,
      from_contract: false,
      fallback_used: true,
    };
  }

  // Contract may store a structured trajectory object or a plain intelligence string.
  const label =
    typeof current === 'string'
      ? null
      : textFrom(current.label || current.title);
  const summary =
    typeof current === 'string'
      ? textFrom(current)
      : textFrom(current.summary || current.explanation || current);
  const direction = typeof current === 'string' ? null : textFrom(current.direction);
  const risk =
    typeof current === 'string'
      ? null
      : textFrom(current.persistence_risk || current.required_structural_change);

  // Prefer intelligence text over decorative fixed captions.
  const caption = clip(label || firstSentence(summary) || fallbackCaption, 72);
  const line = clip(summary || risk || direction || fallbackLine, 160);

  return {
    caption,
    line,
    summary: summary ? clip(summary, 200) : null,
    from_contract: true,
    fallback_used: Boolean(trajectoryNode?.fallback_used),
    intelligence_status: trajectoryNode?.intelligence_status || null,
    provenance: trajectoryNode?.provenance || null,
  };
}

function firstSentence(text) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) return null;
  const match = source.match(/^(.+?[.!?])(?:\s|$)/);
  return match ? match[1] : source;
}

/**
 * Build businessMap projection from contract + optional metric panels already computed.
 *
 * @param {object} contract
 * @param {object} options
 * @param {array} options.currentMetrics
 * @param {array} options.targetMetrics
 * @param {object} options.metricDisplays - { current, target, gap, label, subtext }
 */
export function projectBusinessMapFromContract(contract, options = {}) {
  const lake = contract?.relationship_lake || {};
  const metricDisplays = options.metricDisplays || {};

  const currentTrajectory = trajectoryCaptionLine(contract?.current_trajectory, {
    fallbackCaption: 'Current trajectory unavailable',
    fallbackLine: 'Trajectory intelligence was not available for this assessment.',
  });

  const potentialTrajectory = trajectoryCaptionLine(contract?.potential_trajectory, {
    fallbackCaption: 'Potential trajectory unavailable',
    fallbackLine: 'Modeled future trajectory was not available for this assessment.',
  });

  // If potential is truly absent, do NOT hardcode "Growing. Predictable. Scalable."
  if (!hasMeaningfulValue(contract?.potential_trajectory?.current)) {
    potentialTrajectory.caption = 'Potential trajectory unavailable';
    potentialTrajectory.line = 'Modeled future trajectory was not available for this assessment.';
    potentialTrajectory.fallback_used = true;
  }

  const constraint = contract?.primary_constraint?.current || {};
  const causal = textFrom(contract?.causal_explanation?.current);
  const impact = textFrom(contract?.no_change_consequence?.current);
  const futureChange =
    textFrom(contract?.future_change_logic?.current) ||
    textFrom(contract?.one_move?.current?.why_selected) ||
    textFrom(contract?.one_move?.current?.recommendation);
  const bottomLine =
    textFrom(contract?.one_move?.current?.recommendation) ||
    textFrom(contract?.primary_constraint?.current?.downstream_effects);

  const footer = contract?.footer_intelligence?.current || {};
  const closingInsight = hasMeaningfulValue(footer)
    ? {
        headline: textFrom(footer.headline) || 'BUSINESS ENGINE SNAPSHOT',
        subline:
          textFrom(footer.subline) ||
          textFrom(contract?.one_move?.current?.title) ||
          'One Move intelligence unavailable for closing insight.',
        from_contract: true,
        personalized: Boolean(footer.personalized),
        fallback_used: Boolean(contract?.footer_intelligence?.fallback_used),
      }
    : {
        headline: 'INTELLIGENCE FOOTER UNAVAILABLE',
        subline: 'Closing insight will appear when governing pattern or One Move intelligence is present.',
        from_contract: true,
        personalized: false,
        fallback_used: true,
      };

  const streams = streamNames(lake.streams);
  const outflow = outflowNames(lake.outflow);

  return {
    currentMetrics: options.currentMetrics || [],
    targetMetrics: options.targetMetrics || [],
    lake: {
      current: metricDisplays.current || compactMetricDisplay(lake.current_size) || 'Not provided',
      target: metricDisplays.target || compactMetricDisplay(lake.target_size) || 'Not provided',
      gap: metricDisplays.gap || compactMetricDisplay(lake.gap) || 'Not provided',
      label: lake.label || metricDisplays.label || 'TRUE RELATIONSHIPS',
      subtext: lake.subtext || metricDisplays.subtext || 'People who know, trust, and think of you.',
      streams: streams.length ? streams : [],
      outflow: outflow.length ? outflow : [],
      streams_meta: {
        fallback_used: Boolean(lake.streams?.fallback_used),
        fallback_reason: lake.streams?.fallback_reason || null,
        intelligence_status: lake.streams?.intelligence_status || null,
        source_type: lake.streams?.source_type || null,
      },
      outflow_meta: {
        fallback_used: Boolean(lake.outflow?.fallback_used),
        fallback_reason: lake.outflow?.fallback_reason || null,
        intelligence_status: lake.outflow?.intelligence_status || null,
        source_type: lake.outflow?.source_type || null,
      },
    },
    currentTrajectory,
    potentialTrajectory,
    closingInsight,
    chain: [
      {
        title: 'Primary Constraint',
        body: clip(
          textFrom(constraint.name) || textFrom(constraint.explanation) || 'Primary constraint unavailable',
          96
        ),
        detail: textFrom(constraint.explanation) || null,
        from_contract: true,
        fallback_used: Boolean(contract?.primary_constraint?.fallback_used),
      },
      {
        title: 'Diagnosis',
        body: clip(causal || 'Diagnosis unavailable', 130),
        from_contract: true,
        fallback_used: Boolean(contract?.causal_explanation?.fallback_used),
      },
      {
        title: 'Impact',
        body: clip(impact || 'Impact not modeled yet.', 120),
        from_contract: true,
        fallback_used: Boolean(contract?.no_change_consequence?.fallback_used),
      },
      {
        title: 'Opportunity',
        // One Move / future change logic wins — never lake-arithmetic override here.
        body: clip(futureChange || 'Opportunity becomes clearer after One Move generation.', 130),
        from_contract: true,
        source: contract?.future_change_logic?.provenance?.source_path || 'future_change_logic|one_move',
        fallback_used: Boolean(contract?.future_change_logic?.fallback_used),
      },
      {
        title: 'Bottom Line',
        body: clip(bottomLine || 'Complete the intelligence pipeline to generate the bottom line.', 130),
        from_contract: true,
        fallback_used: Boolean(contract?.one_move?.fallback_used),
      },
    ],
    // Extra non-layout fields for future surfaces / debugging (renderer may ignore)
    contract_projection: {
      contract_version: contract?.contract_metadata?.contract_version || null,
      governing_business_pattern: contract?.governing_business_pattern?.current || null,
      behavioral_modifier: contract?.behavioral_modifier?.current || null,
      confidence_reality: contract?.confidence_reality?.current || null,
      truth_boundaries: contract?.truth_boundaries?.current || null,
      one_move: contract?.one_move?.current || null,
      modeled_opportunity: contract?.modeled_opportunity?.current || null,
    },
  };
}

export default projectBusinessMapFromContract;
