import { canonicalHash } from '../wholeBusinessModelV1/canonical.js';
import { ONE_MOVE_SELECTION_MODEL_VERSION, SELECTION_DIMENSIONS } from './constants.js';

function scoreCandidate(candidate) {
  const components = SELECTION_DIMENSIONS.map((dimension) => ({
    dimension_id: dimension.dimension_id,
    categorical_level: candidate.selection_signals[dimension.dimension_id],
    contribution: dimension.levels[candidate.selection_signals[dimension.dimension_id]],
    meaning: dimension.meaning,
  }));
  return {
    candidate_id: candidate.candidate_id,
    selection_components: components,
    selection_score: components.reduce((sum, item) => sum + item.contribution, 0),
  };
}

const TIE_BREAK_ORDER = Object.freeze([
  'constraint_leverage',
  'causal_reach',
  'evidence_support',
  'reversibility_low_regret',
  'dependency_burden',
  'time_to_signal',
  'execution_feasibility',
  'trajectory_leverage',
]);

function component(record, id) {
  return record.selection_components.find((item) => item.dimension_id === id).contribution;
}

function compare(left, right) {
  if (left.selection_score !== right.selection_score) return right.selection_score - left.selection_score;
  for (const id of TIE_BREAK_ORDER) {
    const delta = component(right, id) - component(left, id);
    if (delta !== 0) return delta;
  }
  return left.candidate_id.localeCompare(right.candidate_id);
}

function rejectionReason(selected, rejected) {
  const weaker = rejected.selection_components
    .filter((entry) => entry.contribution < component(selected, entry.dimension_id))
    .map((entry) => entry.dimension_id.replaceAll('_', ' '));
  return weaker.length
    ? `Lower deterministic standing on ${weaker.slice(0, 3).join(', ')}.`
    : 'Lost the fixed transparent tie-break after an equal aggregate rubric result.';
}

export function selectOneMoveCandidate(candidates) {
  const ranked = candidates.map(scoreCandidate).sort(compare).map((record, index) => ({ ...record, rank: index + 1 }));
  const selected = ranked[0];
  const receipt = {
    selection_model_version: ONE_MOVE_SELECTION_MODEL_VERSION,
    dimensions: SELECTION_DIMENSIONS.map((item) => item.dimension_id),
    arithmetic: 'EQUAL_CATEGORICAL_CONTRIBUTIONS_0_TO_3_SUMMED',
    maximum_score: SELECTION_DIMENSIONS.length * 3,
    tie_break_order: TIE_BREAK_ORDER,
    selected_candidate_id: selected.candidate_id,
    ranked_candidates: ranked.map((record) => ({
      ...record,
      selected: record.candidate_id === selected.candidate_id,
      rejection_reason: record.candidate_id === selected.candidate_id ? null : rejectionReason(selected, record),
    })),
    explainability: 'The selected candidate has the strongest inspectable causal, evidence, execution, learning, reversibility, trajectory, and dependency profile under the fixed rubric.',
    probability_semantics: 'NONE_NOT_AN_INTERVENTION_PROBABILITY_MODEL',
  };
  receipt.receipt_hash = canonicalHash(receipt);
  return Object.freeze(receipt);
}

