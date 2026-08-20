import {
  CONFIDENCE_STATES,
  NEW_BOS_DEPTH_CONTRACT_VERSION,
  ROLE_FIT_STATES,
} from './constants.js';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export const SPECIALIST_DOMAIN_BY_SURFACE = Object.freeze({
  this_is_you: Object.freeze(['recognition']),
  personality_dna: Object.freeze(['personality_dna']),
  how_you_operate: Object.freeze(['operating_engine']),
  how_people_experience_you: Object.freeze(['people_experience']),
  communication_dna: Object.freeze(['communication']),
  strengths_vulnerabilities: Object.freeze(['strengths_vulnerabilities']),
  pressure_conflict: Object.freeze(['pressure_conflict']),
  work_dna: Object.freeze(['work_environment']),
  role_seat: Object.freeze(['role_seat', 'leadership', 'work_environment']),
  cognitive_operating_style: Object.freeze(['cognition']),
  personal_operating_energy: Object.freeze(['energy']),
  five_futures: Object.freeze(['five_futures']),
  one_move: Object.freeze(['one_move']),
  evidence_certainty: Object.freeze(['validation']),
  operating_identity: Object.freeze(['operating_identity']),
});

export const SUPPORTING_SPECIALIST_KEYS_BY_SURFACE = Object.freeze({
  cognitive_operating_style: Object.freeze(['cognitive_process_support']),
  personal_operating_energy: Object.freeze(['energy_context']),
});

const REQUIRED_DOMAINS = Object.freeze([
  'recognition',
  'personality_dna',
  'operating_engine',
  'people_experience',
  'communication',
  'strengths_vulnerabilities',
  'pressure_conflict',
  'work_environment',
  'role_seat',
  'leadership',
  'cognition',
  'energy',
  'five_futures',
  'one_move',
  'validation',
  'operating_identity',
  'visual_bos',
]);

function requiredText(value, label) {
  invariant(typeof value === 'string' && value.trim(), `${label} requires text`);
}

function requiredArray(value, label, minimum = 1) {
  invariant(Array.isArray(value) && value.length >= minimum, `${label} requires at least ${minimum} item${minimum === 1 ? '' : 's'}`);
}

function validateEvidenceRefs(item, evidenceIds, label) {
  invariant(CONFIDENCE_STATES.includes(item.confidence), `${label} requires governed confidence`);
  requiredArray(item.evidence_refs, `${label}.evidence_refs`);
  item.evidence_refs.forEach((ref) => invariant(evidenceIds.has(ref), `${label} references missing evidence ${ref}`));
  (item.counterevidence_refs || []).forEach((ref) => invariant(evidenceIds.has(ref), `${label} references missing counterevidence ${ref}`));
  requiredText(item.falsifier || item.what_would_change_it, `${label}.falsifier`);
}

function validateEvidenceBoundList(items, evidenceIds, label, requiredFields = []) {
  requiredArray(items, label);
  items.forEach((item, index) => {
    const itemLabel = `${label}[${index}]`;
    invariant(item && typeof item === 'object', `${itemLabel} must be an object`);
    requiredFields.forEach((field) => requiredText(item[field], `${itemLabel}.${field}`));
    validateEvidenceRefs(item, evidenceIds, itemLabel);
  });
}

function validateOneMove(move, evidenceIds) {
  const fields = [
    'target_mechanism',
    'intervention',
    'rationale',
    'strength_preserved',
    'expected_outcome',
    'burden',
    'risk',
    'reversibility',
    'observable_result',
    'horizon',
    'falsifier',
    'stop_adjust_condition',
  ];
  fields.forEach((field) => requiredText(move?.[field], `one_move.${field}`));
  validateEvidenceRefs(move, evidenceIds, 'one_move');
  invariant(Array.isArray(move.alternatives_considered), 'one_move.alternatives_considered must be an array');
}

function validateFutures(futures, evidenceIds) {
  requiredArray(futures, 'five_futures', 5);
  invariant(futures.length === 5, 'five_futures must contain exactly five conditional trajectories');
  futures.forEach((future, index) => {
    ['future_identity', 'condition', 'mechanism', 'trajectory', 'triggers', 'indicators', 'movers', 'horizon', 'falsifier', 'review_trigger']
      .forEach((field) => requiredText(future[field], `five_futures[${index}].${field}`));
    validateEvidenceRefs(future, evidenceIds, `five_futures[${index}]`);
  });
}

/**
 * Validates the deliberately meaning-shaped V1 depth contract. Legacy synthetic
 * fixtures remain accepted, but any draft that opts into this version must be
 * complete and evidence-bound across every specialist domain.
 */
export function validateRichSpecializedIntelligence(specialized, evidenceIds) {
  invariant(specialized?.version === NEW_BOS_DEPTH_CONTRACT_VERSION, 'Rich specialist intelligence version mismatch');
  REQUIRED_DOMAINS.forEach((domain) => invariant(specialized[domain] && typeof specialized[domain] === 'object', `Missing rich specialist domain: ${domain}`));

  validateEvidenceBoundList(specialized.recognition.mechanisms, evidenceIds, 'recognition.mechanisms', ['label', 'explanation']);
  requiredArray(specialized.recognition.private_calculations, 'recognition.private_calculations');
  requiredArray(specialized.recognition.recognizable_moments, 'recognition.recognizable_moments');
  requiredArray(specialized.personality_dna.coordinate_explanations, 'personality_dna.coordinate_explanations', 8);
  invariant(specialized.personality_dna.coordinate_explanations.length === 8, 'Personality DNA requires exactly eight coordinate explanations');
  validateEvidenceBoundList(specialized.operating_engine.mechanisms, evidenceIds, 'operating_engine.mechanisms', ['label', 'explanation']);
  validateEvidenceBoundList(specialized.people_experience.states, evidenceIds, 'people_experience.states', ['label', 'hypothesis']);
  validateEvidenceBoundList(specialized.communication.dimensions, evidenceIds, 'communication.dimensions', ['label', 'continuum', 'interpretation']);
  validateEvidenceBoundList(specialized.strengths_vulnerabilities.mechanisms, evidenceIds, 'strengths_vulnerabilities.mechanisms', ['strength', 'immediate_payoff', 'reinforcement', 'delayed_cost']);
  validateEvidenceBoundList(specialized.pressure_conflict.transformations, evidenceIds, 'pressure_conflict.transformations', ['label', 'baseline', 'pressure_expression', 'recovery']);
  validateEvidenceBoundList(specialized.work_environment.demands, evidenceIds, 'work_environment.demands', ['demand', 'natural_fit', 'adaptation_cost', 'sustainability']);
  invariant(ROLE_FIT_STATES.includes(specialized.role_seat.selected_fit), 'role_seat.selected_fit must use the governed five-state contract');
  validateEvidenceBoundList(specialized.role_seat.fit_states, evidenceIds, 'role_seat.fit_states', ['fit_class', 'role_configuration', 'reasoning']);
  validateEvidenceBoundList(specialized.cognition.indicators, evidenceIds, 'cognition.indicators', ['indicator', 'task_demand', 'observed_process', 'outcome']);
  ['trait', 'state', 'context', 'trajectory'].forEach((layer) => invariant(specialized.energy[layer] && typeof specialized.energy[layer] === 'object', `energy.${layer} is required`));
  validateFutures(specialized.five_futures.items, evidenceIds);
  validateOneMove(specialized.one_move, evidenceIds);
  validateEvidenceBoundList(specialized.validation.claims, evidenceIds, 'validation.claims', ['human_label', 'claim', 'inference_boundary']);
  requiredText(specialized.operating_identity.governing_logic, 'operating_identity.governing_logic');
  requiredText(specialized.operating_identity.not_a_type, 'operating_identity.not_a_type');
  requiredArray(specialized.visual_bos.inputs, 'visual_bos.inputs');
  requiredArray(specialized.visual_bos.outputs, 'visual_bos.outputs');
  requiredArray(specialized.visual_bos.operating_loop, 'visual_bos.operating_loop', 3);
  requiredText(specialized.visual_bos.operating_core, 'visual_bos.operating_core');
  requiredText(specialized.visual_bos.primary_pattern, 'visual_bos.primary_pattern');
  requiredText(specialized.visual_bos.secondary_pattern, 'visual_bos.secondary_pattern');
  requiredText(specialized.visual_bos.tertiary_pattern, 'visual_bos.tertiary_pattern');
  return specialized;
}

export function selectSpecialistTruth(specialized, surfaceId) {
  const keys = SPECIALIST_DOMAIN_BY_SURFACE[surfaceId] || [];
  const selected = Object.fromEntries(keys
    .filter((key) => specialized?.[key] != null)
    .map((key) => [key, specialized[key]]));

  if (surfaceId === 'personal_operating_energy' && specialized?.energy) {
    selected.energy_context = Object.freeze({
      work_demands: Object.freeze([...(specialized.work_environment?.demands || [])]),
      work_fit_summary: specialized.work_environment?.fit_summary || null,
      work_friction_summary: specialized.work_environment?.friction_summary || null,
      pressure_state: specialized.pressure_conflict?.pressure_state || null,
      pressure_recovery: specialized.pressure_conflict?.recovery || null,
      pressure_transformations: Object.freeze([...(specialized.pressure_conflict?.transformations || [])]),
    });
  }

  if (surfaceId === 'cognitive_operating_style' && specialized?.cognition) {
    const processCoordinates = (specialized.personality_dna?.coordinate_explanations || [])
      .filter(({ coordinate_id: id }) => ['tempo', 'precision', 'adaptability', 'structure', 'perspective'].includes(id))
      .map((coordinate) => Object.freeze({
        process_availability: coordinate.availability,
        interaction: coordinate.interaction,
        inference_boundary: coordinate.not_meaning,
        confidence: coordinate.confidence,
        evidence_refs: coordinate.evidence_refs,
        counterevidence_refs: coordinate.counterevidence_refs,
        falsifier: coordinate.falsifier,
      }));
    selected.cognitive_process_support = Object.freeze({
      operating_loop: Object.freeze([...(specialized.operating_engine?.loop || [])]),
      process_coordinates: Object.freeze(processCoordinates),
    });
  }

  return Object.freeze(selected);
}

export { REQUIRED_DOMAINS as RICH_SPECIALIST_DOMAINS };
