import {
  buildFrozenSyntheticWbm,
  buildSyntheticUnweightedFutures,
  WBM_SYNTHETIC_CASES,
} from './fiveFuturesV2SyntheticFixtures.js';
import { buildFiveFuturesV2, createTrajectoryGenerationAdapter } from '../../src/lib/fiveFuturesV2/index.js';
import { selectOneMoveCandidate } from '../../src/lib/oneMoveV2/index.js';

const MOVE_DEFINITIONS = Object.freeze({
  'new-agent-tiny-database': ['qualified-relationship-acquisition-lane', 'Install one weekly qualified-relationship acquisition lane', 'Build and execute one governed relationship-creation lane until qualified conversations become observable.', ['Define one relationship audience and permission-based conversation objective.', 'Run a fixed weekly live-conversation block.', 'Record qualified conversations and agreed next actions.']],
  'relationship-heavy-stable-solo': ['relationship-continuity-system', 'Install a governed relationship-continuity system', 'Convert founder-held goodwill into an explicit continuity rhythm with next-action ownership.', ['Segment relationships by current state.', 'Assign the next relevant human touch and owner.', 'Review renewed conversations and referrals on a fixed cadence.']],
  'large-dead-database': ['database-reactivation-system', 'Run a bounded database-reactivation operating system', 'Turn nominal contact records into observable relationship state through live requalification and next actions.', ['Select a bounded dormant relationship cohort.', 'Use permission-based reactivation conversations.', 'Record relationship state and one truthful next action.']],
  'paid-lead-weak-followup': ['lead-response-advancement-sla', 'Install a lead-response and advancement SLA', 'Repair the response, qualification, and next-action mechanism before buying more demand.', ['Define response ownership and a time-bounded service standard.', 'Run governed qualification and next-action follow-up.', 'Inspect response, contact, appointment, and stage-advancement evidence.']],
  'listing-heavy-producer': ['listing-coordination-decision-transfer', 'Transfer one listing-coordination workflow with decision rights', 'Move one repeatable coordination workflow out of the producer bottleneck without transferring strategic judgment.', ['Name the workflow, acceptance criteria, and exceptions.', 'Assign an authorized execution owner and decision rights.', 'Observe independent completion, queue time, and rescue load.']],
  'buyer-heavy-capacity': ['buyer-service-capacity-release', 'Release buyer-service capacity through one governed service handoff', 'Transfer a bounded repeatable buyer-service load so delivery no longer consumes all replacement-demand capacity.', ['Define the eligible service tasks and quality threshold.', 'Assign a capable owner or bounded support resource.', 'Measure released owner time, service quality, and prospecting restoration.']],
  'high-gci-weak-profit': ['transaction-contribution-review', 'Install transaction-level retained-contribution review', 'Expose source, split, and overhead absorption at the transaction level before changing volume strategy.', ['Create one consistent retained-contribution view.', 'Review recent transactions by source and cost structure.', 'Set a bounded stop, repair, or renegotiation rule for the weakest mechanism.']],
  'accidental-success': ['purposeful-weekly-operating-rhythm', 'Install one purposeful weekly operating rhythm', 'Replace intermittent urgency with a visible cadence for the governing demand and accountability mechanism.', ['Name one weekly governing activity and owner.', 'Set a visible completion and leading-signal review.', 'Run repeated cycles before treating isolated income as system proof.']],
  'leverage-ready-solo': ['repeatable-work-transfer', 'Transfer one repeatable coordination workflow', 'Move one proven repeatable workflow from the owner to governed support with acceptance criteria.', ['Choose one repeatable high-frequency workflow.', 'Document completion criteria, decision limits, and escalation.', 'Observe independent completion and owner capacity released.']],
  'premature-team': ['pause-headcount-prove-seat-economics', 'Pause headcount growth and prove opportunity per seat', 'Stop adding fixed capacity until qualified opportunity and retained contribution support the current seats.', ['Freeze net-new seat additions for the learning horizon.', 'Measure qualified opportunity, productive activity, and retained contribution by seat.', 'Reconsider capacity only after the support mechanism is visible.']],
  'leader-dependent-team': ['independent-opportunity-resolution', 'Transfer one opportunity-resolution loop from leader to team', 'Give an authorized seat a complete opportunity, decision, and accountability loop without leader rescue.', ['Define the opportunity class and decision boundary.', 'Assign ownership, evidence, and escalation criteria.', 'Observe independent advancement and leader rescue frequency.']],
  'recruiting-onboarding-failure': ['stage-gated-onboarding-activation', 'Install stage-gated onboarding activation', 'Turn starts into productive capacity through role-specific gates, practice, evidence, and feedback.', ['Define the first productive behaviors and acceptance gates.', 'Assign practice, observation, and feedback ownership.', 'Advance only when evidence shows the prior gate is operating.']],
  'strong-team-weak-owner-economics': ['owner-economics-reset-test', 'Run a bounded owner-economics reset test', 'Use retained-contribution evidence to test one compensation or overhead mechanism before structural lock-in.', ['Identify the largest controllable contribution leak.', 'Model and negotiate one reversible rule change or cost test.', 'Observe retained contribution and operational side effects before expansion.']],
  'geographic-farmer': ['farm-live-conversation-loop', 'Install a farm live-conversation-to-appointment loop', 'Convert repeated visibility into permission-based local conversations and explicit seller next actions.', ['Choose one bounded farm cohort and contact mechanism.', 'Run governed local conversations with truthful qualification.', 'Measure conversations, next actions, and seller appointments.']],
  'open-house-growth': ['open-house-qualification-continuity', 'Install open-house qualification and continuity', 'Make visitor qualification, permission, and contextual follow-up one governed event workflow.', ['Define visitor discovery and representation checks.', 'Assign same-context follow-up and next-action ownership.', 'Review qualified conversations and appointments after each event.']],
  'pipeline-aging': ['stage-aging-next-action-review', 'Install a stage-aging and next-action review', 'Force current opportunities to reveal decision state, owner, and next action before lagging closings obscure the decline.', ['Set stage-age exceptions and evidence requirements.', 'Review every exception for decision state and next action.', 'Observe advancement, closure, or disqualification within the horizon.']],
  'market-slowdown': ['resilient-demand-offset-test', 'Run one bounded resilient-demand offset test', 'Test one less-concentrated demand mechanism while preserving current-market uncertainty.', ['Select one evidence-supported adjacent demand lane.', 'Run it at bounded capacity under current compliance constraints.', 'Compare qualified conversations and advancement with the concentrated source.']],
  'time-freedom': ['decision-rights-transfer', 'Transfer one recurring decision class', 'Move one recurring operational decision from the owner to a governed seat with clear exceptions.', ['Define the decision class and desired outcome.', 'Assign decision rights, guardrails, and escalation.', 'Observe independent decisions, quality, and owner interruption load.']],
  'succession-transfer': ['governed-relationship-transfer-sequence', 'Run a governed relationship-transfer sequence', 'Create shared trust through founder-authorized introductions, successor value, and observed next actions.', ['Select a bounded relationship cohort.', 'Make explicit, permission-based founder-to-successor introductions.', 'Observe successor-led follow-up, continuity, and customer response.']],
  'contradictory-thin': ['reconcile-governing-evidence', 'Run one bounded governing-evidence reconciliation', 'Align source definitions and time windows before committing to a structural intervention.', ['Choose the two contradictory claims that change the decision.', 'Reconcile definitions, source, and observation horizon.', 'Select the mechanism only if the resulting evidence clears the stated falsifier.']],
});

const PRIMARY_SIGNALS = Object.freeze({
  constraint_leverage: 'DIRECT', causal_reach: 'MECHANISM_CHAIN', evidence_support: 'MODERATE', execution_feasibility: 'READY',
  time_to_signal: 'NEAR', reversibility_low_regret: 'BOUNDED_TEST', trajectory_leverage: 'DIRECT', dependency_burden: 'LOW',
});
const SYMPTOM_SIGNALS = Object.freeze({
  constraint_leverage: 'MATERIAL', causal_reach: 'LOCAL', evidence_support: 'MODERATE', execution_feasibility: 'READY',
  time_to_signal: 'NEAR', reversibility_low_regret: 'BOUNDED_TEST', trajectory_leverage: 'MATERIAL', dependency_burden: 'NONE',
});
const TRANSFORMATION_SIGNALS = Object.freeze({
  constraint_leverage: 'MATERIAL', causal_reach: 'SYSTEMIC', evidence_support: 'STRONG', execution_feasibility: 'DIFFICULT',
  time_to_signal: 'LONG', reversibility_low_regret: 'LOCK_IN', trajectory_leverage: 'DIRECT', dependency_burden: 'HIGH',
});

function futureRelationships(mechanism) {
  return [
    ['current_course', 'WEAKEN', `Interrupt the current mechanism: ${mechanism}`],
    ['emerging_future', 'ACCELERATE_IF_OBSERVED', 'Create leading evidence that a different mechanism is already emerging.'],
    ['better_future', 'CREATE_PREREQUISITE', 'Build a named prerequisite for the supported better trajectory.'],
    ['bold_future', 'IMPROVE_LATER_FEASIBILITY', 'Preserve or improve later feasibility without prematurely committing to transformation.'],
    ['downside_future', 'REDUCE_MECHANISM', `Reduce exposure to the downside mechanism: ${mechanism}`],
  ].map(([future_role, intent, mechanism_rationale]) => ({ future_role, intent, mechanism_rationale }));
}

function candidateBase(context, candidateId, title, intervention, steps, signal, variant) {
  const mechanism = context.causal_mechanisms[0];
  const person = context.whole_person_execution_context[0];
  const teamProfiles = context.team_execution_context.flatMap((item) => item.profile_refs || []);
  const certainty = context.governing_constraint.epistemic_class === 'INSUFFICIENT_EVIDENCE'
    ? 'BOUNDED_LOW_REGRET_HYPOTHESIS'
    : 'SUPPORTED_INTERVENTION_HYPOTHESIS';
  return {
    candidate_id: candidateId,
    title,
    intervention,
    why_now: `${context.governing_constraint.constraint_type} is the current governed constraint and the named mechanism is active in present evidence.`,
    mechanism_attacked_ids: [mechanism.mechanism_id],
    constraint_relationship: `The intervention is intended to weaken ${context.governing_constraint.constraint_id} by changing ${mechanism.underlying_mechanism}`,
    symptom_distinction: `This candidate responds to ${mechanism.observed_symptom} through its supported underlying mechanism, not the symptom label alone.`,
    causal_chain: [...mechanism.causal_chain, `The bounded intervention tests whether changing the named driver moves its leading indicators.`],
    supporting_evidence_refs: mechanism.evidence_refs,
    counterevidence_refs: mechanism.counterevidence_refs,
    assumptions: ['The frozen WBM remains materially representative during the observation horizon.', 'Execution fidelity is sufficient to test the mechanism.'],
    prerequisites: variant === 'transformational' ? ['Capital, authority, and multi-seat capacity are available.'] : ['The owner or authorized role can begin the bounded intervention now.'],
    execution_burden: variant === 'transformational' ? 'High coordination and structural burden.' : (variant === 'symptom' ? 'Low burden causal-discrimination work that preserves intervention optionality.' : 'Bounded operating burden tied to one intervention.'),
    execution_definition: `Execute only the ${candidateId} intervention with the listed steps; do not add unrelated channels, hires, or systems.`,
    bounded_execution_steps: steps,
    owner_role: variant === 'primary' ? 'Authorize the intervention, protect the learning horizon, and review governed evidence.' : 'Sponsor the candidate and review evidence.',
    team_roles: teamProfiles.map((profileRef) => `profile_ref:${profileRef}; execute only the governed structural role and preserve individual identity.`),
    whole_person_execution_considerations: person ? [{ relationship_ref: person.relationship_id, execution_adjustment: person.intervention_implications[0], business_truth_changed: false }] : [],
    leading_indicators: context.momentum.leading_indicators.map((item) => item.indicator),
    success_evidence: [`Named leading indicators move in the expected direction with adequate execution fidelity.`],
    failure_evidence: [`Named leading indicators do not move after adequate execution fidelity and the observation horizon.`],
    falsifiers: [mechanism.falsifier],
    stop_or_reconsider_conditions: ['A named falsifier appears.', 'A material confound or authority constraint makes the intervention interpretation invalid.'],
    observation_horizon: 'A bounded sequence of repeated operating cycles sufficient to observe a leading signal; no lagging-outcome promise.',
    reversibility_class: signal.reversibility_low_regret,
    dependency_burden: signal.dependency_burden,
    trajectory_effect_intent: futureRelationships(mechanism.underlying_mechanism),
    certainty_support_classification: certainty,
    script_intelligence_refs: variant === 'primary' ? context.selected_script_intelligence.slice(0, 2).map((item) => item.script_id) : [],
    dynamic_research_warrant: context.dynamic_context[0] ? { ...context.dynamic_context[0] } : null,
    selection_signals: signal,
  };
}

export function buildSyntheticOneMoveCandidates(context, caseId) {
  const [moveId, title, intervention, steps] = MOVE_DEFINITIONS[caseId];
  return [
    candidateBase(context, moveId, title, intervention, steps, PRIMARY_SIGNALS, 'primary'),
    candidateBase(context, `${caseId}-causal-discrimination-test`, `Run a bounded causal-discrimination test for ${context.governing_constraint.constraint_type}`, 'Test the named mechanism against its strongest alternative through one controlled operating observation before increasing commitment.', ['Name the competing mechanism and discriminating signal.', 'Run one controlled observation with explicit fidelity.', 'Retain, weaken, or replace the mechanism hypothesis from governed evidence.'], SYMPTOM_SIGNALS, 'symptom'),
    candidateBase(context, `${caseId}-structural-mechanism-replacement`, `Replace the operating mechanism beneath ${context.governing_constraint.constraint_type}`, `Commission one structural replacement of the current ${context.governing_constraint.constraint_type} mechanism after prerequisites and authority are proven.`, ['Define the replacement mechanism and acceptance conditions.', 'Secure its required authority and capability.', 'Transition the named mechanism under explicit stop conditions.'], TRANSFORMATION_SIGNALS, 'transformational'),
  ];
}

export async function buildSyntheticOneMoveInputs(caseDefinition, library) {
  const wbm = buildFrozenSyntheticWbm(caseDefinition, library);
  const trajectoryAdapter = createTrajectoryGenerationAdapter({ async generate() { return buildSyntheticUnweightedFutures(wbm); } });
  const fiveFutures = (await buildFiveFuturesV2(wbm, { trajectoryAdapter })).artifact;
  return { wbm, fiveFutures };
}

function scored(candidateId, signal) {
  return { candidate_id: candidateId, selection_signals: signal };
}

const MATCHED_PAIR_DEFINITIONS = Object.freeze([
  ['need-more-leads', 'demand shortage', 'build-acquisition-lane', 'adequate demand / weak follow-up', 'repair-followup-conversion'],
  ['need-to-hire', 'true delivery capacity ceiling', 'bounded-capacity-handoff', 'rework creates fake pressure', 'eliminate-handoff-rework'],
  ['team-not-productive-a', 'missing onboarding activation', 'stage-gated-onboarding', 'broken lead routing', 'repair-routing-ownership'],
  ['team-not-productive-b', 'wrong seat and role design', 'reset-role-seat', 'leader rescue dependence', 'transfer-decision-loop'],
  ['need-more-listings', 'seller demand shortage', 'seller-acquisition-lane', 'weak listing appointment conversion', 'repair-listing-consultation'],
  ['database-not-working-a', 'relationship base too small', 'relationship-creation-lane', 'relationship decay', 'database-reactivation'],
  ['database-not-working-b', 'weak referral conversations', 'referral-conversation-loop', 'unclean unqualified records', 'database-qualification-cleanup'],
  ['working-too-much-a', 'buyer service load', 'buyer-service-handoff', 'poor delegation design', 'decision-rights-transfer'],
  ['working-too-much-b', 'delivery rework', 'repair-quality-handoff', 'owner-held recurring role', 'transfer-recurring-owner-seat'],
  ['profit-is-weak', 'high acquisition cost', 'source-economics-stop-repair', 'team overhead and splits', 'team-economics-reset-test'],
]);

function selectForMechanism(primaryId) {
  return selectOneMoveCandidate([
    scored(primaryId, PRIMARY_SIGNALS),
    scored(`${primaryId}-symptom`, SYMPTOM_SIGNALS),
    scored(`${primaryId}-transformation`, TRANSFORMATION_SIGNALS),
  ]).selected_candidate_id;
}

export function runMatchedSymptomPairs() {
  return MATCHED_PAIR_DEFINITIONS.map(([visible_symptom, mechanism_a, move_a, mechanism_b, move_b], index) => ({
    pair_id: `same-symptom-pair-${String(index + 1).padStart(2, '0')}`,
    visible_symptom,
    mechanism_a,
    mechanism_b,
    selected_one_move_a: selectForMechanism(move_a),
    selected_one_move_b: selectForMechanism(move_b),
    differentiated: selectForMechanism(move_a) !== selectForMechanism(move_b),
  }));
}

export const CONSTRAINT_SHIFT_DEFINITIONS = Object.freeze([
  ['demand-to-conversion', 'build-acquisition-lane', 'repair-followup-conversion'],
  ['conversion-to-capacity', 'repair-stage-advancement', 'bounded-capacity-handoff'],
  ['capacity-to-role', 'release-service-capacity', 'transfer-decision-rights'],
  ['system-to-economics', 'install-repeatable-rhythm', 'retained-contribution-review'],
  ['pipeline-to-market', 'stage-aging-review', 'resilient-demand-offset-test'],
]);

export function runConstraintShiftTests() {
  return CONSTRAINT_SHIFT_DEFINITIONS.map(([shift_id, beforeMove, afterMove]) => ({
    shift_id,
    selected_before: selectForMechanism(beforeMove),
    selected_after: selectForMechanism(afterMove),
    migrated: selectForMechanism(beforeMove) !== selectForMechanism(afterMove),
  }));
}

const COMPARABLE_IRREVERSIBLE = Object.freeze({
  ...PRIMARY_SIGNALS,
  reversibility_low_regret: 'HIGH_REGRET',
  dependency_burden: 'HIGH',
});

export function runLowRegretTests() {
  const comparable = Array.from({ length: 5 }, (_, index) => {
    const bounded = `bounded-test-${index + 1}`;
    const irreversible = `irreversible-commitment-${index + 1}`;
    const selection = selectOneMoveCandidate([scored(bounded, PRIMARY_SIGNALS), scored(irreversible, COMPARABLE_IRREVERSIBLE)]);
    return { test_id: `comparable-${index + 1}`, test_type: 'COMPARABLE_LEVERAGE', selected: selection.selected_candidate_id, expected: bounded, pass: selection.selected_candidate_id === bounded };
  });
  const boldJustified = Object.freeze({
    constraint_leverage: 'DIRECT', causal_reach: 'SYSTEMIC', evidence_support: 'STRONG', execution_feasibility: 'FEASIBLE',
    time_to_signal: 'MEDIUM', reversibility_low_regret: 'LOCK_IN', trajectory_leverage: 'DIRECT', dependency_burden: 'MODERATE',
  });
  const timid = Object.freeze({ ...SYMPTOM_SIGNALS, constraint_leverage: 'WEAK', causal_reach: 'SYMPTOM_ONLY', trajectory_leverage: 'INDIRECT', reversibility_low_regret: 'BOUNDED_TEST' });
  const boldSelection = selectOneMoveCandidate([scored('bold-supported-structural-move', boldJustified), scored('timid-low-leverage-test', timid)]);
  return [...comparable, {
    test_id: 'bold-action-remains-valid', test_type: 'NON_RISK_AVERSION', selected: boldSelection.selected_candidate_id,
    expected: 'bold-supported-structural-move', pass: boldSelection.selected_candidate_id === 'bold-supported-structural-move',
  }];
}

export { MOVE_DEFINITIONS, WBM_SYNTHETIC_CASES };
