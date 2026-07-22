import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';
import { createFutureIdentitySet, versionFutureSet, validateCanonicalFutureSet } from './futureIdentity.js';
import { describeProbabilityChange, normalizeFutureSupport, probabilityConfidence } from './futureProbability.js';

export const FUTURE_ENGINE_VERSION = 'future-engine-reference-v1';
const SLOTS = Object.freeze([
  { slot: 'CURRENT', status: 'CURRENTLY_ACTIVE', name: 'Current Future' },
  { slot: 'MOST_LIKELY_NEXT', status: 'MOST_LIKELY_NEXT_STATE', name: 'Most Likely Next Future' },
  { slot: 'ALTERNATIVE_1', status: 'ALTERNATIVE_TRAJECTORY', name: 'Adaptive Growth Future' },
  { slot: 'ALTERNATIVE_2', status: 'REQUIRES_STRUCTURAL_CHANGE', name: 'Structural Change Future' },
  { slot: 'ALTERNATIVE_3', status: 'DECLINING', name: 'At-Risk Future' },
]);
const sorted = (items = []) => [...items].sort((a, b) => String(a.id || a.claim_id || a).localeCompare(String(b.id || b.claim_id || b)));

function scopeValid(input) {
  const scope = `${input.tenant_id}:${input.business_id}:${input.profile_id}`;
  return (input.scoped_inputs || []).every((item) => `${item.tenant_id}:${item.business_id}:${item.profile_id}` === scope);
}

function supportFor(slot, input) {
  const supplied = input.support_by_slot?.[slot.slot] || {};
  const components = {
    business_reality: supplied.business_reality ?? (slot.slot === 'CURRENT' ? 2 : 1),
    belief: supplied.belief ?? (slot.slot === 'MOST_LIKELY_NEXT' ? 1.5 : .5),
    behavior: supplied.behavior ?? 0,
    business_model: supplied.business_model ?? 0,
    constraint: supplied.constraint ?? (slot.slot === 'MOST_LIKELY_NEXT' ? 1 : 0),
    market: input.stale_market_context ? 0 : (supplied.market ?? 0),
    intent: supplied.intent ?? 0,
    outcome_history: supplied.outcome_history ?? 0,
  };
  const raw = Math.max(0, Object.values(components).reduce((sum, value) => sum + value, 0));
  return { components, raw_support: raw, support_ids: sorted(supplied.support_ids), contradiction_ids: sorted(supplied.contradiction_ids) };
}

export function runFutureEngine(input) {
  if (!input?.tenant_id || !input.business_id || !input.profile_id || !input.as_of_at) return deepFreeze({ ok: false, phase: 'INPUT', code: 'SCOPE_AND_AS_OF_REQUIRED' });
  if (!input.business_engine_state_version || !input.belief_state || !scopeValid(input)) return deepFreeze({ ok: false, phase: 'INPUT', code: scopeValid(input) ? 'STATE_AND_BELIEF_REQUIRED' : 'CROSS_TENANT_INPUT_DENIED' });
  const identities = input.current_future_set?.identities || createFutureIdentitySet(input).identities;
  const supports = SLOTS.map((slot) => ({ ...supportFor(slot, input), stable_future_identity: identities.find((x) => x.slot === slot.slot)?.stable_future_identity,
    suspended: (input.suspended_slots || []).includes(slot.slot) }));
  const probability = normalizeFutureSupport(supports);
  if (!probability.ok) return deepFreeze({ ok: false, phase: 'PROBABILITY', code: probability.code });
  const previousMap = new Map((input.current_future_set?.versions || []).map((item) => [item.stable_future_identity, item]));
  const definitions = SLOTS.map((slot, index) => {
    const support = supports[index], normalized = probability.vector[index];
    const confidence = probabilityConfidence({ support_count: support.support_ids.length, contradiction_count: support.contradiction_ids.length,
      missing_count: (input.missing_evidence || []).length, stale_context: input.stale_market_context === true });
    const bandWidth = Math.min(.35, .05 + (1 - confidence.score) * .25);
    return { ...slot, description: `Modeled ${slot.name.toLowerCase()} trajectory; this is not a prophecy.`, probability: normalized.probability,
      probability_confidence: confidence, uncertainty_band: [Math.max(0, normalized.probability - bandWidth), Math.min(1, normalized.probability + bandWidth)],
      current_support: support.support_ids, contradictory_evidence: support.contradiction_ids, raw_support_components: support.components,
      behavioral_modifier: support.components.behavior, business_model_modifier: support.components.business_model,
      constraint_relationship: input.primary_constraint || 'UNRESOLVED', market_context_modifier: support.components.market,
      structural_change_required: ['ALTERNATIVE_2'].includes(slot.slot), expected_consequence: input.expected_consequences?.[slot.slot] || 'Requires observation and validation.',
      what_increases_probability: input.increase_conditions?.[slot.slot] || [], what_decreases_probability: input.decrease_conditions?.[slot.slot] || [],
      missing_evidence: sorted(input.missing_evidence), trajectory_type: slot.slot, supporting_belief_ids: sorted(input.belief_state.beliefs?.map((x) => x.belief_id).filter(Boolean)),
      time_horizon: input.time_horizon || '90_DAYS', suspended: normalized.suspended === true };
  });
  const versioned = versionFutureSet({ identities, definitions, prior_versions: input.current_future_set?.versions || [], as_of_at: input.as_of_at });
  if (!versioned.ok || !validateCanonicalFutureSet(versioned.versions).valid) return deepFreeze({ ok: false, phase: 'VERSION', code: versioned.code || 'INVALID_FUTURE_SET' });
  const changes = versioned.versions.map((future) => describeProbabilityChange(previousMap.get(future.stable_future_identity)?.probability ?? future.probability, future.probability,
    { reasons: input.change_reasons?.[future.slot] || [], contradictions: future.contradictory_evidence, stale_context: input.stale_market_context === true }));
  const authorityConflict = (input.authority_conflict_graph?.conflicts || []).length > 0;
  const transitions = versioned.versions.slice(0, -1).map((future, i) => ({ from_future_identity: future.stable_future_identity, to_future_identity: versioned.versions[i + 1].stable_future_identity, relationship: 'MODELED_TRANSITION_HYPOTHESIS' }));
  const explanation_trace = { explanation_trace_id: `trace_${hashCanonicalJson({ probability: probability.receipt, changes }).slice(0, 20)}`,
    operation: 'FUTURE_ENGINE', operation_version: FUTURE_ENGINE_VERSION, input_ids: sorted([input.business_engine_state_version.state_version_id, input.belief_state.belief_state_id]),
    changed_outputs: changes.filter((x) => x.changed).length, unchanged_outputs: changes.filter((x) => !x.changed).length,
    authority_routes: ['BUSINESS_REALITY', 'BELIEF', 'USER_DIRECTION', 'DOMAIN_KNOWLEDGE', 'MARKET_CONTEXT'],
    human_review_required: authorityConflict, safe_summary: 'Trajectories are modeled from current evidence. Probability is separate from evidence confidence; causal proof is not claimed.' };
  const output = { engine_version: FUTURE_ENGINE_VERSION, identities, future_set_version: (input.current_future_set?.future_set_version || 0) + 1,
    versions: versioned.versions, history: versioned.history, probability_receipt: probability.receipt, probability_changes: changes,
    transition_links: transitions, explanation_trace, human_review_required: authorityConflict };
  return deepFreeze({ ok: true, ...output, output_hash: hashCanonicalJson(output) });
}
