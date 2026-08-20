import {
  CERTAINTY_SUPPORT_CLASSES,
  DEPENDENCY_BURDENS,
  FUTURE_ROLES,
  PROHIBITED_MODEL_SELECTION_FIELDS,
  REVERSIBILITY_CLASSES,
  SELECTION_DIMENSIONS,
} from './constants.js';
import { REQUIRED_CANDIDATE_FIELDS } from './candidateContract.js';
import { integrity } from './errors.js';

function walk(value, callback, trail = []) {
  if (Array.isArray(value)) return value.forEach((item, index) => walk(item, callback, [...trail, index]));
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    callback(key, child, [...trail, key]);
    walk(child, callback, [...trail, key]);
  });
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireStringArray(value, field, { allowEmpty = false } = {}) {
  integrity(Array.isArray(value), 'MALFORMED_CANDIDATE', `${field} must be an array`);
  integrity(allowEmpty || value.length > 0, 'MALFORMED_CANDIDATE', `${field} may not be empty`);
  value.forEach((item) => integrity(nonEmptyString(item), 'MALFORMED_CANDIDATE', `${field} must contain strings`));
}

function validateCandidate(candidate, context, index) {
  const field = `candidates[${index}]`;
  REQUIRED_CANDIDATE_FIELDS.forEach((key) => integrity(candidate[key] !== undefined, 'MALFORMED_CANDIDATE', `${field}.${key} is required`));
  for (const key of ['candidate_id', 'title', 'intervention', 'why_now', 'constraint_relationship', 'symptom_distinction', 'execution_burden', 'execution_definition', 'owner_role', 'observation_horizon']) {
    integrity(nonEmptyString(candidate[key]), 'MALFORMED_CANDIDATE', `${field}.${key} must be a non-empty string`);
  }
  const mechanismIds = new Set(context.causal_mechanisms.map((item) => item.mechanism_id));
  requireStringArray(candidate.mechanism_attacked_ids, `${field}.mechanism_attacked_ids`);
  candidate.mechanism_attacked_ids.forEach((id) => integrity(mechanismIds.has(id), 'UNBOUND_INTERVENTION', `${field} references unknown mechanism ${id}`));
  const evidenceIds = new Set(context.evidence_refs);
  requireStringArray(candidate.supporting_evidence_refs, `${field}.supporting_evidence_refs`);
  requireStringArray(candidate.counterevidence_refs, `${field}.counterevidence_refs`, { allowEmpty: true });
  [...candidate.supporting_evidence_refs, ...candidate.counterevidence_refs].forEach((ref) => integrity(evidenceIds.has(ref), 'CORRUPTED_EVIDENCE', `${field} references unknown evidence ${ref}`));
  for (const key of ['causal_chain', 'assumptions', 'prerequisites', 'bounded_execution_steps', 'team_roles', 'leading_indicators', 'success_evidence', 'failure_evidence', 'falsifiers', 'stop_or_reconsider_conditions', 'script_intelligence_refs']) {
    requireStringArray(candidate[key], `${field}.${key}`, { allowEmpty: ['team_roles', 'script_intelligence_refs'].includes(key) });
  }
  integrity(candidate.bounded_execution_steps.length <= 5, 'NOT_SINGULAR', `${field} has too many execution steps for one intervention`);
  integrity(REVERSIBILITY_CLASSES.includes(candidate.reversibility_class), 'MALFORMED_CANDIDATE', `${field}.reversibility_class is invalid`);
  integrity(DEPENDENCY_BURDENS.includes(candidate.dependency_burden), 'MALFORMED_CANDIDATE', `${field}.dependency_burden is invalid`);
  integrity(CERTAINTY_SUPPORT_CLASSES.includes(candidate.certainty_support_classification), 'MALFORMED_CANDIDATE', `${field}.certainty_support_classification is invalid`);
  integrity(Array.isArray(candidate.trajectory_effect_intent) && candidate.trajectory_effect_intent.length === 5, 'MALFORMED_CANDIDATE', `${field} requires five trajectory relationships`);
  integrity(candidate.trajectory_effect_intent.map((item) => item.future_role).join('|') === FUTURE_ROLES.join('|'), 'MALFORMED_CANDIDATE', `${field} trajectory roles/order drifted`);
  candidate.trajectory_effect_intent.forEach((item) => {
    integrity(nonEmptyString(item.intent) && nonEmptyString(item.mechanism_rationale), 'MALFORMED_CANDIDATE', `${field} trajectory intent requires meaning`);
    integrity(!('probability_movement' in item), 'FAKE_PROBABILITY_MOVEMENT', `${field} may not claim probability movement`);
  });
  integrity(Array.isArray(candidate.whole_person_execution_considerations), 'MALFORMED_CANDIDATE', `${field}.whole_person_execution_considerations must be an array`);
  const personRefs = new Set(context.whole_person_execution_context.map((item) => item.relationship_id));
  candidate.whole_person_execution_considerations.forEach((item) => {
    integrity(personRefs.has(item.relationship_ref), 'CROSS_PROFILE_CONTAMINATION', `${field} uses unselected Whole-Person context`);
    integrity(nonEmptyString(item.execution_adjustment), 'MALFORMED_CANDIDATE', `${field} Whole-Person adjustment is empty`);
    integrity(item.business_truth_changed === false, 'WHOLE_PERSON_OVERRIDE', `${field} Whole-Person context may not change business truth`);
  });
  if (personRefs.size === 0) integrity(candidate.whole_person_execution_considerations.length === 0, 'CROSS_PROFILE_CONTAMINATION', `${field} invented Whole-Person context`);
  const teamRefs = new Set(context.team_execution_context.flatMap((item) => item.profile_refs || []));
  candidate.team_roles.forEach((role) => {
    const profileMatch = /profile_ref:([^;]+)/u.exec(role);
    if (profileMatch) integrity(teamRefs.has(profileMatch[1]), 'UNAUTHORIZED_TEAM_ACCESS', `${field} uses unauthorized team profile`);
  });
  if (teamRefs.size === 0) integrity(candidate.team_roles.length === 0, 'UNAUTHORIZED_TEAM_ACCESS', `${field} invented team roles`);
  const scriptIds = new Set(context.selected_script_intelligence.map((item) => item.script_id));
  candidate.script_intelligence_refs.forEach((id) => integrity(scriptIds.has(id), 'AUTHORITY_CORRUPTION', `${field} references unselected script ${id}`));
  if (candidate.dynamic_research_warrant !== null) {
    const matched = context.dynamic_context.some((item) => item.research_question === candidate.dynamic_research_warrant.research_question && item.authority === candidate.dynamic_research_warrant.authority);
    integrity(matched, 'DYNAMIC_RESEARCH_SCOPE_DRIFT', `${field} invented a research warrant outside WBM context`);
  }
  integrity(candidate.selection_signals && typeof candidate.selection_signals === 'object', 'MALFORMED_CANDIDATE', `${field}.selection_signals is required`);
  SELECTION_DIMENSIONS.forEach((dimension) => {
    integrity(dimension.levels[candidate.selection_signals[dimension.dimension_id]] !== undefined, 'MALFORMED_CANDIDATE', `${field}.${dimension.dimension_id} has an invalid categorical level`);
  });
}

export function validateUnweightedCandidates(candidates, context) {
  integrity(Array.isArray(candidates), 'MALFORMED_CANDIDATE_SET', 'Candidate output must be an array');
  integrity(candidates.length >= 3 && candidates.length <= 5, 'MALFORMED_CANDIDATE_SET', 'Candidate count must be three to five');
  walk(candidates, (key, _value, trail) => {
    integrity(!PROHIBITED_MODEL_SELECTION_FIELDS.includes(key), 'MODEL_AUTHORED_SELECTION', `Generation output contains prohibited selection field at ${trail.join('.')}`);
  });
  candidates.forEach((candidate, index) => validateCandidate(candidate, context, index));
  integrity(new Set(candidates.map((candidate) => candidate.candidate_id)).size === candidates.length, 'MALFORMED_CANDIDATE_SET', 'Candidate IDs must be unique');
  return true;
}

