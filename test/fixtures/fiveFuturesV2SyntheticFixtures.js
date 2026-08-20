import {
  buildSyntheticWholeBusinessCandidate,
  buildSyntheticWholeBusinessInput,
  WBM_SYNTHETIC_CASES,
} from './wholeBusinessModelV1SyntheticFixtures.js';
import {
  assembleWholeBusinessContext,
  canonicalHash,
  finalizeWholeBusinessState,
  validateWholeBusinessModel,
} from '../../src/lib/wholeBusinessModelV1/index.js';

const EVIDENCE_LEVEL = { KNOWN: 'STRONG', STRONGLY_SUPPORTED: 'STRONG', SUPPORTED_HYPOTHESIS: 'MODERATE', TENTATIVE: 'WEAK', CONFLICTED: 'WEAK', INSUFFICIENT_EVIDENCE: 'WEAK', ABSTAINED: 'NONE' };
const CAUSAL_LEVEL = { KNOWN: 'STRONGLY_SUPPORTED', STRONGLY_SUPPORTED: 'STRONGLY_SUPPORTED', SUPPORTED_HYPOTHESIS: 'SUPPORTED', TENTATIVE: 'PLAUSIBLE', CONFLICTED: 'PLAUSIBLE', INSUFFICIENT_EVIDENCE: 'PLAUSIBLE', ABSTAINED: 'UNSUPPORTED' };

function evidenceRefs(model) {
  return [...new Set(model.source_integrity.evidence_refs)];
}

function primaryMechanism(model) {
  return model.causal_model.mechanisms[0];
}

function futureBase(model, role, suffix) {
  const mechanism = primaryMechanism(model);
  const refs = evidenceRefs(model);
  return {
    future_role: role,
    future_id: `${model.assessment_identity.business_id}-${suffix}`,
    title: `${suffix.replaceAll('_', ' ')} — ${model.assessment_identity.business_model_identity}`,
    governing_mechanisms: [mechanism.mechanism_id],
    supporting_evidence_refs: refs,
    counterevidence_refs: mechanism.counterevidence_refs || [],
    assumptions: ['The governed WBM remains materially representative over the trajectory horizon.'],
    leading_indicators: model.momentum.leading_indicators.map((item) => item.indicator),
    falsifiers: [mechanism.falsifier],
    operator_business_interactions: model.person_business_synthesis.map((item) => item.relationship_id),
    team_dependencies: model.team_organizational_synthesis.map((item) => item.relationship_id),
    dynamic_context_dependencies: model.dynamic_research.map((item) => item.research_question),
    certainty_support_classification: model.governing_constraint.epistemic_class === 'INSUFFICIENT_EVIDENCE'
      ? 'INSUFFICIENT_EVIDENCE_BOUNDED'
      : 'MODERATE_RELATIVE_SUPPORT',
  };
}

function momentumSignals(model) {
  const direction = model.momentum.direction;
  const emergingEvidence = model.momentum.emerging_changes.length > 0 && ['IMPROVING', 'DETERIORATING', 'MIXED'].includes(direction);
  const changeStatus = model.momentum.change_status || 'UNESTABLISHED';
  return { direction, emergingEvidence, changeStatus };
}

export function buildSyntheticUnweightedFutures(model) {
  const mechanism = primaryMechanism(model);
  const epistemic = model.governing_constraint.epistemic_class;
  const { direction, emergingEvidence, changeStatus } = momentumSignals(model);
  const sustainedEmergence = emergingEvidence && changeStatus === 'SUSTAINED_EMERGENCE';
  const mechanismChanged = emergingEvidence && changeStatus === 'MECHANISM_CHANGED';
  const downsideActivation = emergingEvidence && changeStatus === 'DOWNSIDE_ACTIVATED';
  const vulnerabilityStrong = ['DETERIORATING', 'MIXED'].includes(direction) || model.vulnerabilities.length > 0;
  const current = {
    ...futureBase(model, 'current_course', 'current_course'),
    state_summary: `Current mechanisms continue: ${mechanism.underlying_mechanism}`,
    business_state_if_realized: `The business continues along its ${direction.toLowerCase()} direction with the current constraint materially intact.`,
    required_changes: [],
    risks: model.vulnerabilities.map((item) => item.meaning),
    conditionality: 'If current operating mechanisms, execution, and context continue substantially unchanged.',
    support_signals: {
      current_evidence_support: EVIDENCE_LEVEL[epistemic],
      momentum_support: 'STRONGLY_ALIGNED',
      causal_feasibility: CAUSAL_LEVEL[mechanism.epistemic_class],
      change_distance: 'LOW_OR_NONE',
      counterevidence: mechanism.counterevidence_refs.length ? 'MATERIAL' : 'NONE',
      constraint_compatibility: 'DIRECTLY_ALIGNED',
      vulnerability_activation: vulnerabilityStrong ? 'MODERATE' : 'WEAK',
    },
  };
  const emerging = {
    ...futureBase(model, 'emerging_future', 'emerging_future'),
    state_summary: emergingEvidence
      ? `A material ${direction.toLowerCase()} shift is already forming in ${model.momentum.emerging_changes[0]}`
      : `Evidence of a distinct emerging path is thin; this role remains bounded to the first observable shift away from ${mechanism.underlying_mechanism}`,
    business_state_if_realized: emergingEvidence
      ? 'Leading changes persist long enough to alter the current mechanism and later outcomes.'
      : 'A different business state begins only after named leading indicators actually change.',
    required_changes: emergingEvidence ? ['Sustain the already-observed leading change.'] : ['Produce and sustain governed evidence of a meaningful leading change.'],
    risks: ['Early movement may be noise, temporary, or offset by the current constraint.'],
    conditionality: emergingEvidence
      ? 'If the observed leading change persists and is not explained by a material confound.'
      : 'This role remains low-support and bounded until governed evidence shows emergence.',
    emergence_evidence: true,
    support_signals: {
      current_evidence_support: sustainedEmergence ? 'STRONG' : (emergingEvidence ? 'MODERATE' : 'WEAK'),
      momentum_support: sustainedEmergence ? 'STRONGLY_ALIGNED' : (emergingEvidence ? 'ALIGNED' : 'NEUTRAL'),
      causal_feasibility: sustainedEmergence ? 'STRONGLY_SUPPORTED' : (emergingEvidence ? 'SUPPORTED' : 'PLAUSIBLE'),
      change_distance: sustainedEmergence ? 'LOW_OR_NONE' : (emergingEvidence ? 'LOW_OR_NONE' : 'MODERATE'),
      counterevidence: sustainedEmergence ? 'NONE' : (mechanism.counterevidence_refs.length ? 'MATERIAL' : 'LIMITED'),
      constraint_compatibility: sustainedEmergence ? 'DIRECTLY_ALIGNED' : (emergingEvidence ? 'COMPATIBLE' : 'UNCERTAIN'),
      vulnerability_activation: direction === 'DETERIORATING' ? 'MODERATE' : 'WEAK',
    },
  };
  const better = {
    ...futureBase(model, 'better_future', 'better_future'),
    state_summary: `A deliberate change weakens ${mechanism.underlying_mechanism} and improves the affected business domains.`,
    business_state_if_realized: 'The governing constraint weakens, leading indicators improve, and current assets convert into more stable throughput and economics.',
    required_changes: ['Execute a bounded mechanism-specific change.', 'Sustain it through the named leading-indicator window.', 'Stop or adapt if the falsifier appears.'],
    risks: ['The change may be poorly executed or may expose a coupled constraint.'],
    conditionality: 'If the owner changes the named mechanism with adequate fidelity and the expected leading indicators respond.',
    support_signals: {
      current_evidence_support: mechanismChanged ? 'STRONG' : 'MODERATE',
      momentum_support: mechanismChanged ? 'STRONGLY_ALIGNED' : (direction === 'IMPROVING' ? 'ALIGNED' : 'NEUTRAL'),
      causal_feasibility: mechanismChanged ? 'STRONGLY_SUPPORTED' : CAUSAL_LEVEL[mechanism.epistemic_class],
      change_distance: mechanismChanged ? 'LOW_OR_NONE' : 'MODERATE',
      counterevidence: mechanismChanged ? 'NONE' : (mechanism.counterevidence_refs.length ? 'MATERIAL' : 'LIMITED'),
      constraint_compatibility: 'DIRECTLY_ALIGNED',
      vulnerability_activation: 'WEAK',
    },
  };
  const bold = {
    ...futureBase(model, 'bold_future', 'bold_future'),
    state_summary: `Consequential model, leverage, role, or demand changes make the business materially less dependent on ${mechanism.underlying_mechanism}`,
    business_state_if_realized: 'The business operates through a structurally different mix of demand, capacity, leverage, ownership, or value capture.',
    required_changes: ['Make a consequential structural change.', 'Build the missing capability and evidence base.', 'Prove the new model before treating it as established.'],
    risks: ['High change burden', 'execution and capital risk', 'a distant mechanism may not be supported by current capacity'],
    conditionality: 'If consequential structural changes occur and create governed evidence that the new mechanism works.',
    support_signals: {
      current_evidence_support: 'WEAK',
      momentum_support: 'NEUTRAL',
      causal_feasibility: epistemic === 'INSUFFICIENT_EVIDENCE' ? 'PLAUSIBLE' : 'SUPPORTED',
      change_distance: 'TRANSFORMATIONAL',
      counterevidence: 'LIMITED',
      constraint_compatibility: 'COMPATIBLE',
      vulnerability_activation: 'NONE',
    },
  };
  const downside = {
    ...futureBase(model, 'downside_future', 'downside_future'),
    state_summary: `The current vulnerability deepens and ${mechanism.underlying_mechanism} becomes more controlling.`,
    business_state_if_realized: 'Pipeline, capacity, economics, relationship equity, or team independence deteriorates according to the affected domains.',
    required_changes: ['No corrective change occurs, or a material vulnerability/constraint intensifies.'],
    risks: model.vulnerabilities.map((item) => item.meaning),
    conditionality: 'If the current vulnerability activates or intensifies and corrective evidence does not appear.',
    support_signals: {
      current_evidence_support: downsideActivation ? 'STRONG' : (vulnerabilityStrong ? 'MODERATE' : 'WEAK'),
      momentum_support: direction === 'DETERIORATING' ? 'STRONGLY_ALIGNED' : (direction === 'MIXED' ? 'ALIGNED' : 'NEUTRAL'),
      causal_feasibility: downsideActivation ? 'STRONGLY_SUPPORTED' : CAUSAL_LEVEL[mechanism.epistemic_class],
      change_distance: 'LOW_OR_NONE',
      counterevidence: downsideActivation ? 'NONE' : (direction === 'IMPROVING' ? 'MATERIAL' : 'LIMITED'),
      constraint_compatibility: 'DIRECTLY_ALIGNED',
      vulnerability_activation: vulnerabilityStrong ? 'STRONG' : 'MODERATE',
    },
  };
  return [current, emerging, better, bold, downside];
}

export function buildFrozenSyntheticWbm(definition, library) {
  const input = buildSyntheticWholeBusinessInput(definition);
  const context = assembleWholeBusinessContext(input, { library });
  const candidate = buildSyntheticWholeBusinessCandidate(definition, context);
  const receipt = validateWholeBusinessModel(candidate, context);
  return finalizeWholeBusinessState(candidate, receipt);
}

export const MOVEMENT_CASES = Object.freeze([
  ['no-acquisition-to-sustained', 'new-agent-tiny-database', 'demand', 'Sustained acquisition system now produces qualified conversations.', 'IMPROVING', 'emerging_future', 'up'],
  ['weak-to-improving-conversion', 'paid-lead-weak-followup', 'conversion', 'Response and stage advancement have improved across repeated cohorts.', 'IMPROVING', 'emerging_future', 'up'],
  ['dead-to-active-relationships', 'large-dead-database', 'relationship', 'A governed continuity system is producing renewed conversations and referrals.', 'IMPROVING', 'emerging_future', 'up'],
  ['leader-to-delegated-capacity', 'leader-dependent-team', 'team', 'Delegated seats now resolve work without leader rescue and sustain productivity.', 'IMPROVING', 'better_future', 'up'],
  ['healthy-to-aging-pipeline', 'relationship-heavy-stable-solo', 'pipeline', 'Opportunity age and stalled-stage share have increased materially.', 'DETERIORATING', 'downside_future', 'up'],
  ['profit-to-margin-deterioration', 'strong-team-weak-owner-economics', 'financial', 'Retained contribution has deteriorated despite stable volume.', 'DETERIORATING', 'downside_future', 'up'],
  ['weak-to-strong-seller-pipeline', 'listing-heavy-producer', 'listing', 'Qualified seller appointments and signed listings have strengthened.', 'IMPROVING', 'emerging_future', 'up'],
  ['strong-to-adverse-market', 'market-slowdown', 'market', 'External transaction velocity and financing conditions have deteriorated.', 'DETERIORATING', 'downside_future', 'up'],
  ['capacity-to-successful-leverage', 'buyer-heavy-capacity', 'capacity', 'New leverage is absorbing service load while response and quality remain stable.', 'IMPROVING', 'better_future', 'up'],
  ['inconsistent-to-purposeful-rhythm', 'accidental-success', 'accountability', 'Purposeful execution has been sustained across multiple operating cycles.', 'IMPROVING', 'emerging_future', 'up'],
].map(([movement_id, base_case_id, domain, change, after_momentum, target_role, expected_direction]) => Object.freeze({
  movement_id, base_case_id, domain, change, after_momentum, target_role, expected_direction,
})));

export function buildMatchedAfterState(beforeModel, movement) {
  const after = structuredClone(beforeModel);
  after.state_lineage.state_version += 1;
  after.state_lineage.prior_state = { state_version: beforeModel.state_lineage.state_version, state_hash: beforeModel.state_hash };
  after.state_lineage.created_at = '2026-08-13T12:00:00.000Z';
  after.state_hash = undefined;
  after.validation_receipt = undefined;
  const nextEvidenceId = `${movement.movement_id}-after-evidence`;
  after.source_integrity.evidence_refs = [...new Set([...after.source_integrity.evidence_refs, nextEvidenceId])];
  after.governed_business_evidence.push({ evidence_ref: nextEvidenceId });
  after.business_model.evidence_refs = [...new Set([...after.business_model.evidence_refs, nextEvidenceId])];
  after.momentum.evidence_refs = [...new Set([...after.momentum.evidence_refs, nextEvidenceId])];
  after.momentum.direction = movement.after_momentum;
  after.momentum.emerging_changes = [movement.change];
  after.momentum.change_status = movement.target_role === 'better_future'
    ? 'MECHANISM_CHANGED'
    : (movement.target_role === 'downside_future' ? 'DOWNSIDE_ACTIVATED' : 'SUSTAINED_EMERGENCE');
  after.momentum.leading_indicators = [{ indicator: movement.change, evidence_refs: [nextEvidenceId] }];
  after.current_business_reality[movement.domain] = { evidence_refs: [nextEvidenceId], state: movement.change };
  after.domain_states.push({
    domain_id: `${movement.domain}_after_evidence`, authority_refs: after.authority_receipts[0].selected_authority_ids,
    epistemic_class: 'STRONGLY_SUPPORTED',
    claims: [{ claim_id: `${movement.movement_id}-claim`, meaning: movement.change, epistemic_class: 'STRONGLY_SUPPORTED', evidence_refs: [nextEvidenceId], counterevidence_refs: [], confounds: [], falsifier: 'Movement weakens if the leading change does not persist.' }],
    mechanisms: [after.causal_model.mechanisms[0].mechanism_id], strengths: [], failure_modes: [], interactions: [], missing_evidence: [], abstentions: [],
  });
  after.causal_model.mechanisms[0].evidence_refs = [...new Set([...after.causal_model.mechanisms[0].evidence_refs, nextEvidenceId])];
  after.causal_model.mechanisms[0].epistemic_class = 'STRONGLY_SUPPORTED';
  after.governing_constraint.evidence_refs = [...new Set([...after.governing_constraint.evidence_refs, nextEvidenceId])];
  after.governing_constraint.epistemic_class = 'STRONGLY_SUPPORTED';
  after.assets[0].evidence_refs = [...new Set([...after.assets[0].evidence_refs, nextEvidenceId])];
  after.vulnerabilities[0].evidence_refs = [...new Set([...after.vulnerabilities[0].evidence_refs, nextEvidenceId])];
  after.epistemic_state.claim_support[0].epistemic_class = 'STRONGLY_SUPPORTED';
  const contextHash = after.source_integrity.context_hash;
  after.validation_receipt = {
    validator_version: 'synthetic-matched-state-validation-v1', status: 'PASS', business_id: after.assessment_identity.business_id,
    context_hash: contextHash, selected_authority_count: Object.keys(after.source_integrity.authority_hashes).length,
    business_evidence_count: after.source_integrity.evidence_refs.length, domain_state_count: after.domain_states.length,
    causal_mechanism_count: after.causal_model.mechanisms.length, person_business_link_count: after.person_business_synthesis.length,
    team_link_count: after.team_organizational_synthesis.length, contradiction_count: after.epistemic_state.contradictions.length,
    missing_evidence_count: after.epistemic_state.missing_evidence.length, five_futures_v2_implemented: false, one_move_v2_implemented: false,
  };
  after.validation_receipt.receipt_hash = 'synthetic-matched-state-receipt';
  // Binding validates the final state hash; this matched fixture does not replay upstream input validation.
  after.state_hash = canonicalHash({ ...after, state_hash: undefined });
  return after;
}

export { WBM_SYNTHETIC_CASES };
