import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ONE_MOVE_RUNTIME_BOUNDARIES,
  ONE_MOVE_SELECTION_MODEL_VERSION,
  ONE_MOVE_V2_SCHEMA,
  OneMoveV2IntegrityError,
  SELECTION_DIMENSIONS,
  buildCandidateGenerationMission,
  buildOneMoveV2,
  createCandidateGenerationAdapter,
  loadFrozenScriptIntelligence,
  selectOneMoveCandidate,
  validateOneMoveV2,
  validateUnweightedCandidates,
} from '../src/lib/oneMoveV2/index.js';
import { canonicalHash, loadFrozenAuthorityLibrary } from '../src/lib/wholeBusinessModelV1/index.js';
import {
  WBM_SYNTHETIC_CASES,
  buildSyntheticOneMoveCandidates,
  buildSyntheticOneMoveInputs,
  runConstraintShiftTests,
  runLowRegretTests,
  runMatchedSymptomPairs,
} from './fixtures/oneMoveV2SyntheticFixtures.js';

const library = loadFrozenAuthorityLibrary();

function adapterFor(caseId) {
  return createCandidateGenerationAdapter({
    async generate({ mission, store }) {
      assert.equal(store, false);
      assert.equal(mission.context.binding.business_id, `synthetic-business-${caseId}`);
      return buildSyntheticOneMoveCandidates(mission.context, caseId);
    },
  });
}

async function buildCase(caseId) {
  const definition = WBM_SYNTHETIC_CASES.find((item) => item.case_id === caseId);
  assert.ok(definition);
  const { wbm, fiveFutures } = await buildSyntheticOneMoveInputs(definition, library);
  return { wbm, fiveFutures, ...(await buildOneMoveV2(wbm, fiveFutures, { candidateAdapter: adapterFor(caseId), library })) };
}

test('schema and selection model lock the complete One Move object and exact eight dimensions', () => {
  assert.equal(ONE_MOVE_V2_SCHEMA.type, 'object');
  assert.ok(ONE_MOVE_V2_SCHEMA.required.includes('trajectory_effect_intent'));
  assert.ok(ONE_MOVE_V2_SCHEMA.required.includes('observation_contract'));
  assert.deepEqual(SELECTION_DIMENSIONS.map((item) => item.dimension_id), [
    'constraint_leverage', 'causal_reach', 'evidence_support', 'execution_feasibility',
    'time_to_signal', 'reversibility_low_regret', 'trajectory_leverage', 'dependency_burden',
  ]);
  SELECTION_DIMENSIONS.forEach((dimension) => assert.deepEqual([...new Set(Object.values(dimension.levels))], [0, 1, 2, 3]));
  assert.equal(ONE_MOVE_SELECTION_MODEL_VERSION, 'one-move-v2-inspectable-rubric-v1');
});

test('generation mission allows three to five serious candidates but bars scores, ranks, winner choice, and customer prose', async () => {
  const { context } = await buildCase('paid-lead-weak-followup');
  const mission = buildCandidateGenerationMission(context);
  assert.deepEqual(mission.candidate_count, { minimum: 3, maximum: 5 });
  assert.ok(mission.prohibited_output_fields.includes('selection_score'));
  assert.ok(mission.prohibited_output_fields.includes('selected'));
  assert.ok(mission.prohibited_output_fields.includes('probability_movement'));
  assert.equal(JSON.stringify(mission).includes('customer prose or UI copy'), true);
  assert.equal(mission.context.customer_prose_input, false);
});

test('deterministic selector owns numerical scoring, fixed tie-breaking, and explainable rejection', () => {
  const high = Object.fromEntries(SELECTION_DIMENSIONS.map((item) => [item.dimension_id, Object.keys(item.levels)[3]]));
  const lower = { ...high, constraint_leverage: 'MATERIAL', causal_reach: 'MECHANISM_CHAIN' };
  const receipt = selectOneMoveCandidate([{ candidate_id: 'high', selection_signals: high }, { candidate_id: 'lower', selection_signals: lower }]);
  assert.equal(receipt.selected_candidate_id, 'high');
  assert.equal(receipt.ranked_candidates[0].selection_score, 24);
  assert.equal(receipt.ranked_candidates[1].rejection_reason.includes('constraint leverage'), true);
  assert.equal(receipt.probability_semantics, 'NONE_NOT_AN_INTERVENTION_PROBABILITY_MODEL');
});

test('frontier candidates cannot author selection numbers, ranks, winner fields, percentages, or probability movement', async () => {
  const { context, candidates } = await buildCase('large-dead-database');
  for (const [field, value] of [
    ['selection_score', 24], ['selection_components', []], ['rank', 1], ['selected', true], ['winner', true],
    ['probability', 0.8], ['probability_movement', 18], ['percentage', 80],
  ]) {
    const copy = structuredClone(candidates);
    copy[0][field] = value;
    assert.throws(() => validateUnweightedCandidates(copy, context), (error) => error instanceof OneMoveV2IntegrityError && error.code === 'MODEL_AUTHORED_SELECTION', field);
  }
});

test('all 20 frozen WBM/Five Futures fixtures produce distinct, singular, bounded, mechanism-bound One Moves', async () => {
  const titles = new Set();
  const interventions = new Set();
  const hashes = new Set();
  for (const definition of WBM_SYNTHETIC_CASES) {
    const result = await buildCase(definition.case_id);
    const move = result.one_move;
    assert.equal(result.candidates.length, 3);
    assert.equal(result.validation_receipt.status, 'PASS');
    assert.equal(move.governing_constraint_id, result.wbm.governing_constraint.constraint_id);
    assert.equal(move.primary_mechanism_ids.includes(result.wbm.causal_model.mechanisms[0].mechanism_id), true);
    assert.ok(move.bounded_execution_steps.length >= 1 && move.bounded_execution_steps.length <= 5);
    assert.equal(move.trajectory_effect_intent.length, 5);
    assert.equal(move.artifact_hash, canonicalHash({ ...move, artifact_hash: undefined }));
    titles.add(move.title);
    interventions.add(move.intervention);
    hashes.add(move.artifact_hash);
  }
  assert.equal(titles.size, 20);
  assert.equal(interventions.size, 20);
  assert.equal(hashes.size, 20);
});

test('Whole-Person modifies execution only when WBM says relevant and never changes business truth', async () => {
  const relevant = await buildCase('accidental-success');
  const irrelevant = await buildCase('large-dead-database');
  assert.ok(relevant.one_move.whole_person_execution_considerations.length > 0);
  assert.equal(relevant.one_move.whole_person_execution_considerations.every((item) => item.business_truth_changed === false), true);
  assert.equal(irrelevant.one_move.whole_person_execution_considerations.length, 0);
  assert.equal(relevant.one_move.governing_constraint_id, relevant.wbm.governing_constraint.constraint_id);
});

test('team context appears only for authorized relevant members and people are never averaged', async () => {
  const team = await buildCase('leader-dependent-team');
  const solo = await buildCase('leverage-ready-solo');
  assert.ok(team.one_move.team_roles.length > 0);
  assert.equal(team.wbm.team_organizational_synthesis.every((item) => item.people_averaged === false), true);
  assert.equal(solo.one_move.team_roles.length, 0);
  const copy = structuredClone(team.candidates);
  copy[0].team_roles = ['profile_ref:unselected-profile; unauthorized'];
  assert.throws(() => validateUnweightedCandidates(copy, team.context), /UNAUTHORIZED_TEAM_ACCESS/u);
});

test('dynamic research warrants and governed scripts are inherited selectively and remain bounded resources', async () => {
  const dynamic = await buildCase('market-slowdown');
  const stable = await buildCase('time-freedom');
  assert.equal(dynamic.one_move.dynamic_research_warrant.research_question, dynamic.wbm.dynamic_research[0].research_question);
  assert.equal(stable.one_move.dynamic_research_warrant, null);
  assert.ok(dynamic.context.selected_intervention_authorities.length > 0 && dynamic.context.selected_intervention_authorities.length < 12);
  assert.ok(dynamic.context.selected_script_intelligence.length <= 3);
  assert.equal(dynamic.context.selected_script_intelligence.every((script) => script.use === 'ADAPTABLE_RESOURCE_NOT_MANDATORY_WORDING'), true);
  const scripts = loadFrozenScriptIntelligence();
  assert.equal(scripts.scripts.length, 31);
});

test('observation contract captures future learning fields but implements no tracking, subscription, RSL, or outcome engine', async () => {
  const { one_move: move } = await buildCase('pipeline-aging');
  assert.deepEqual(Object.keys(move.observation_contract), [
    'contract_id', 'execution_started', 'execution_fidelity', 'leading_indicator_movement',
    'business_state_movement', 'observation_horizon', 'unexpected_effects', 'confounds',
    'outcome', 'recommendation_still_valid', 'wbm_update_trigger', 'five_futures_update_trigger',
    'tracking_or_subscription_implemented',
  ]);
  assert.equal(move.observation_contract.tracking_or_subscription_implemented, false);
  assert.equal(move.runtime_boundaries.rsl_implemented, false);
  assert.equal(move.runtime_boundaries.outcome_engine_implemented, false);
});

test('10/10 same-symptom pairs select different moves for different governing mechanisms', () => {
  const results = runMatchedSymptomPairs();
  assert.equal(results.length, 10);
  assert.equal(results.every((item) => item.differentiated), true);
  assert.equal(new Set(results.flatMap((item) => [item.selected_one_move_a, item.selected_one_move_b])).size, 20);
});

test('constraint-shift cases migrate the selected move when the governing constraint changes', () => {
  const results = runConstraintShiftTests();
  assert.equal(results.length, 5);
  assert.equal(results.every((item) => item.migrated), true);
});

test('low-regret wins at comparable leverage while supported bold action remains valid', () => {
  const results = runLowRegretTests();
  assert.equal(results.length, 6);
  assert.equal(results.every((item) => item.pass), true);
  assert.equal(results.at(-1).selected, 'bold-supported-structural-move');
});

test('validator fails closed for wrong identity, WBM/Five Futures/authority corruption, unbound mechanism, and production mutation', async () => {
  const { one_move: move, context, selection_receipt: receipt } = await buildCase('geographic-farmer');
  const cases = [
    ['wrong business', (copy) => { copy.business_id = 'other-business'; }, /WRONG_BUSINESS_PROFILE/u],
    ['WBM corruption', (copy) => { copy.whole_business_model_binding.hash = '0'.repeat(64); }, /WBM_HASH_VERSION_CORRUPTION/u],
    ['Five Futures corruption', (copy) => { copy.five_futures_binding.hash = '0'.repeat(64); }, /FIVE_FUTURES_HASH_CORRUPTION/u],
    ['authority corruption', (copy) => { copy.authority_versions.business_intelligence['UB-01'] = '0'.repeat(64); }, /AUTHORITY_CORRUPTION/u],
    ['unbound mechanism', (copy) => { copy.primary_mechanism_ids = ['unknown-mechanism']; }, /UNBOUND_INTERVENTION/u],
    ['production mutation', (copy) => { copy.runtime_boundaries.production_wired = true; }, /UNAUTHORIZED_PRODUCTION_MUTATION/u],
  ];
  for (const [name, mutate, matcher] of cases) {
    const copy = structuredClone(move);
    mutate(copy);
    assert.throws(() => validateOneMoveV2(copy, context, receipt), matcher, name);
  }
});

test('Five Futures relationship is directional intent only and never calibrated probability movement', async () => {
  const { one_move: move } = await buildCase('time-freedom');
  assert.deepEqual(move.trajectory_effect_intent.map((item) => item.future_role), ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future']);
  assert.equal(move.five_futures_binding.support_semantics, 'UNCALIBRATED_RELATIVE_SUPPORT');
  assert.equal(move.selection_trace.probability_semantics, 'NONE_NOT_AN_INTERVENTION_PROBABILITY_MODEL');
  assert.doesNotMatch(JSON.stringify(move), /"probability_movement":/u);
});

test('implementation is profile-agnostic, provider-neutral, non-wired, and contains no prohibited later-runtime system', () => {
  const files = fs.readdirSync('src/lib/oneMoveV2').filter((name) => name.endsWith('.js'));
  const source = files.map((name) => fs.readFileSync(`src/lib/oneMoveV2/${name}`, 'utf8')).join('\n');
  assert.doesNotMatch(source, /Amber|Wally|Patricia|Darren|OPENAI_API_KEY|responses\.create|Redis|Stripe|Vercel/u);
  assert.doesNotMatch(source, /BayesianNetwork|MarkovDecisionProcess|calibrationDataset|RSLRuntime|subscriptionTracker/u);
  assert.doesNotMatch(source, /PremiumCustomerBAShell|src\/Profile|ReactDOM|\.jsx/u);
  assert.deepEqual(ONE_MOVE_RUNTIME_BOUNDARIES, {
    customer_realization_implemented: false, customer_ui_implemented: false, production_wired: false, deployed_or_activated: false,
    one_three_five_implemented: false, rsl_implemented: false, outcome_engine_implemented: false,
    calibrated_intervention_probability_implemented: false, bayesian_model_implemented: false,
    mdp_or_pomdp_implemented: false, monte_carlo_implemented: false,
  });
});
