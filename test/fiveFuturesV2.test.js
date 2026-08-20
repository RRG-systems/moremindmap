import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIVE_FUTURES_V2_SCHEMA,
  FUTURE_ROLES,
  FiveFuturesV2IntegrityError,
  SUPPORT_COMPONENTS,
  SUPPORT_SEMANTICS,
  WEIGHTING_MODEL_VERSION,
  applyDeterministicRelativeSupport,
  bindFrozenWholeBusinessModel,
  buildFiveFuturesV2,
  buildTrajectoryGenerationMission,
  createTrajectoryGenerationAdapter,
  normalizeRelativeSupport,
  validateFiveFuturesV2,
  validateUnweightedFutures,
} from '../src/lib/fiveFuturesV2/index.js';
import { canonicalHash, loadFrozenAuthorityLibrary } from '../src/lib/wholeBusinessModelV1/index.js';
import {
  MOVEMENT_CASES,
  WBM_SYNTHETIC_CASES,
  buildFrozenSyntheticWbm,
  buildMatchedAfterState,
  buildSyntheticUnweightedFutures,
} from './fixtures/fiveFuturesV2SyntheticFixtures.js';

const library = loadFrozenAuthorityLibrary();

function definition(caseId) {
  const value = WBM_SYNTHETIC_CASES.find((item) => item.case_id === caseId);
  assert.ok(value, `unknown case ${caseId}`);
  return value;
}

function adapterFor(model) {
  return createTrajectoryGenerationAdapter({
    async generate({ mission, store }) {
      assert.equal(store, false);
      assert.equal(mission.context.binding.whole_business_model_hash, model.state_hash);
      return buildSyntheticUnweightedFutures(model);
    },
  });
}

async function buildCase(caseId) {
  const model = buildFrozenSyntheticWbm(definition(caseId), library);
  const result = await buildFiveFuturesV2(model, { trajectoryAdapter: adapterFor(model) });
  return { model, ...result };
}

test('schema locks the five purposeful role order and uncalibrated support semantics', () => {
  assert.equal(FIVE_FUTURES_V2_SCHEMA.type, 'object');
  assert.equal(FIVE_FUTURES_V2_SCHEMA.properties.support_semantics.const, SUPPORT_SEMANTICS);
  assert.deepEqual(
    FIVE_FUTURES_V2_SCHEMA.properties.futures.prefixItems.map((item) => item.properties.future_role.const),
    FUTURE_ROLES,
  );
  assert.equal(FIVE_FUTURES_V2_SCHEMA.properties.futures.minItems, 5);
  assert.equal(FIVE_FUTURES_V2_SCHEMA.properties.futures.maxItems, 5);
});

test('weighting uses exactly seven transparent categorical components with no giant coefficient model', () => {
  assert.deepEqual(SUPPORT_COMPONENTS.map((item) => item.component_id), [
    'current_evidence_support',
    'momentum_support',
    'causal_feasibility',
    'change_distance',
    'counterevidence',
    'constraint_compatibility',
    'vulnerability_activation',
  ]);
  SUPPORT_COMPONENTS.forEach((component) => {
    assert.deepEqual([...new Set(Object.values(component.levels))], [0, 1, 2, 3]);
  });
  assert.equal(WEIGHTING_MODEL_VERSION, 'five-futures-relative-support-v1');
});

test('largest-remainder normalization is deterministic, exact 100, and role-order tie-broken', () => {
  assert.deepEqual(normalizeRelativeSupport([1, 1, 1, 1, 1]).normalized_relative_support_weights, [20, 20, 20, 20, 20]);
  assert.deepEqual(normalizeRelativeSupport([0, 0, 0, 0, 0]).normalized_relative_support_weights, [20, 20, 20, 20, 20]);
  assert.deepEqual(normalizeRelativeSupport([1, 1, 1, 0, 0]).normalized_relative_support_weights, [34, 33, 33, 0, 0]);
  const first = normalizeRelativeSupport([13, 8, 6, 3, 5]);
  const second = normalizeRelativeSupport([13, 8, 6, 3, 5]);
  assert.deepEqual(first, second);
  assert.equal(first.normalized_relative_support_weights.reduce((sum, value) => sum + value, 0), 100);
  assert.equal(first.support_semantics, SUPPORT_SEMANTICS);
});

test('frontier trajectory output cannot author numerical weights, percentages, or probabilities', async () => {
  const model = buildFrozenSyntheticWbm(definition('paid-lead-weak-followup'), library);
  const context = (await buildCase('paid-lead-weak-followup')).context;
  const valid = buildSyntheticUnweightedFutures(model);
  for (const [field, value] of [
    ['raw_relative_support_score', 12],
    ['normalized_relative_support_weight', 45],
    ['probability', 0.45],
    ['percent', 45],
    ['support_components', []],
    ['weighting_model_version', 'model-authored'],
  ]) {
    const mutated = structuredClone(valid);
    mutated[0][field] = value;
    assert.throws(
      () => validateUnweightedFutures(mutated, context),
      (error) => error instanceof FiveFuturesV2IntegrityError && error.code === 'GPT_AUTHORED_NUMERICAL_WEIGHTS',
      field,
    );
  }
  const weighted = applyDeterministicRelativeSupport(valid);
  assert.equal(weighted.futures.every((future) => future.weighting_model_version === WEIGHTING_MODEL_VERSION), true);
});

test('all 20 frozen WBM fixtures produce five valid business-specific futures and differentiated distributions', async () => {
  const trajectoryHashes = new Set();
  const distributions = new Set();
  const stateSummaries = new Set();
  for (const caseDefinition of WBM_SYNTHETIC_CASES) {
    const { model, artifact, validation_receipt: receipt } = await buildCase(caseDefinition.case_id);
    assert.equal(receipt.status, 'PASS');
    assert.deepEqual(artifact.futures.map((future) => future.future_role), FUTURE_ROLES);
    assert.equal(artifact.futures.reduce((sum, future) => sum + future.normalized_relative_support_weight, 0), 100);
    assert.equal(artifact.whole_business_model_binding.whole_business_model_hash, model.state_hash);
    assert.equal(artifact.futures.every((future) => future.state_summary.includes(model.causal_model.mechanisms[0].underlying_mechanism) || future.future_role === 'emerging_future'), true);
    assert.equal(artifact.futures[1].emergence_evidence, true);
    assert.ok(artifact.futures[2].required_changes.length > 0);
    assert.ok(artifact.futures[3].required_changes.length > 0);
    assert.ok(artifact.futures[4].risks.length > 0);
    trajectoryHashes.add(canonicalHash(artifact.futures.map((future) => ({
      ...future,
      normalized_relative_support_weight: undefined,
    }))));
    distributions.add(artifact.futures.map((future) => future.normalized_relative_support_weight).join('-'));
    artifact.futures.forEach((future) => stateSummaries.add(future.state_summary));
  }
  assert.equal(trajectoryHashes.size, 20);
  assert.ok(distributions.size >= 5, `expected differentiated distributions, received ${distributions.size}`);
  assert.ok(stateSummaries.size >= 80, 'trajectories must not collapse to generic templates');
});

test('matched before/after states move target relative support in the causally expected direction', async () => {
  assert.equal(MOVEMENT_CASES.length, 10);
  for (const movement of MOVEMENT_CASES) {
    const before = buildFrozenSyntheticWbm(definition(movement.base_case_id), library);
    const after = buildMatchedAfterState(before, movement);
    const beforeResult = await buildFiveFuturesV2(before, { trajectoryAdapter: adapterFor(before) });
    const afterResult = await buildFiveFuturesV2(after, { trajectoryAdapter: adapterFor(after) });
    const beforeFuture = beforeResult.artifact.futures.find((future) => future.future_role === movement.target_role);
    const afterFuture = afterResult.artifact.futures.find((future) => future.future_role === movement.target_role);
    assert.ok(afterFuture.raw_relative_support_score > beforeFuture.raw_relative_support_score, `${movement.movement_id}: raw target support did not rise`);
    assert.ok(afterFuture.normalized_relative_support_weight > beforeFuture.normalized_relative_support_weight, `${movement.movement_id}: normalized target support did not rise`);
    assert.equal(afterResult.artifact.futures.reduce((sum, future) => sum + future.normalized_relative_support_weight, 0), 100);
  }
});

test('WBM business, owner, version, state hash, authority hashes, and BOS hash bind every artifact', async () => {
  const { model, artifact, context } = await buildCase('leader-dependent-team');
  assert.deepEqual(artifact.whole_business_model_binding, bindFrozenWholeBusinessModel(model));
  assert.equal(artifact.business_id, model.assessment_identity.business_id);
  assert.equal(artifact.owner_profile_id, model.assessment_identity.owner_profile_id);
  assert.equal(artifact.futures.every((future) => future.whole_business_model_hash === model.state_hash), true);
  assert.equal(artifact.futures.every((future) => canonicalHash(future.authority_versions) === canonicalHash(model.source_integrity.authority_hashes)), true);
  assert.equal(context.executive_diagnostic_input, false);
});

test('Whole-Person, Team, and Dynamic dependencies are inherited only from the WBM', async () => {
  const person = await buildCase('accidental-success');
  const noPerson = await buildCase('large-dead-database');
  const team = await buildCase('leader-dependent-team');
  const solo = await buildCase('leverage-ready-solo');
  const dynamic = await buildCase('market-slowdown');
  const stable = await buildCase('relationship-heavy-stable-solo');
  assert.ok(person.artifact.futures.some((future) => future.operator_business_interactions.length > 0));
  assert.equal(noPerson.artifact.futures.every((future) => future.operator_business_interactions.length === 0), true);
  assert.ok(team.artifact.futures.some((future) => future.team_dependencies.length > 0));
  assert.equal(solo.artifact.futures.every((future) => future.team_dependencies.length === 0), true);
  assert.ok(dynamic.artifact.futures.some((future) => future.dynamic_context_dependencies.length > 0));
  assert.equal(stable.artifact.futures.every((future) => future.dynamic_context_dependencies.length === 0), true);
});

test('legacy V1 remains distinct and One Move, UI, calibration, Bayesian, RSL, and production remain absent', async () => {
  const { artifact } = await buildCase('time-freedom');
  assert.equal(artifact.legacy_coexistence.five_futures_v1, 'LEGACY_MODEL_GENERATED_PERCENTAGES_UNCHANGED');
  assert.equal(artifact.legacy_coexistence.five_futures_v2, SUPPORT_SEMANTICS);
  assert.equal(artifact.one_move_interface.status, 'STRUCTURED_FUTURES_AVAILABLE_ONE_MOVE_V2_NOT_IMPLEMENTED');
  assert.deepEqual(artifact.runtime_boundaries, {
    one_move_v2_implemented: false,
    customer_realization_implemented: false,
    customer_ui_implemented: false,
    bayesian_model_implemented: false,
    calibration_project_implemented: false,
    rsl_implemented: false,
    production_wired: false,
  });
});

test('validator fails closed for wrong WBM binding, authority drift, total drift, and missing model version', async () => {
  const { artifact, context } = await buildCase('geographic-farmer');
  const cases = [
    ['wrong business', (copy) => { copy.business_id = 'synthetic-business-other'; }, /WRONG_BUSINESS_PROFILE/u],
    ['WBM hash drift', (copy) => { copy.whole_business_model_binding.whole_business_model_hash = '0'.repeat(64); }, /WBM_HASH_VERSION_CORRUPTION/u],
    ['authority drift', (copy) => { copy.authority_versions['UB-01'] = '0'.repeat(64); }, /(?:AUTHORITY_CORRUPTION|WBM_HASH_VERSION_CORRUPTION)/u],
    ['weight total drift', (copy) => { copy.futures[0].normalized_relative_support_weight += 1; }, /NORMALIZED_TOTAL_NOT_100/u],
    ['missing version', (copy) => { delete copy.futures[0].weighting_model_version; }, /MISSING_WEIGHTING_MODEL_VERSION/u],
  ];
  for (const [name, mutate, matcher] of cases) {
    const copy = structuredClone(artifact);
    mutate(copy);
    assert.throws(() => validateFiveFuturesV2(copy, context.binding), matcher, name);
  }
});

test('trajectory mission contains no number-authoring permission or customer realization', async () => {
  const { context } = await buildCase('contradictory-thin');
  const mission = buildTrajectoryGenerationMission(context);
  assert.ok(mission.prohibited_output_fields.includes('normalized_relative_support_weight'));
  assert.ok(mission.prohibited_output_fields.includes('probability'));
  assert.ok(mission.doctrine.some((line) => line.includes('Do not author numerical weights')));
  assert.equal(JSON.stringify(mission).includes('Executive Diagnostic prose'), false);
  assert.equal(mission.context.executive_diagnostic_input, false);
});

test('implementation is profile-agnostic, provider-neutral, non-wired, and contains no Bayesian/calibration/RSL algorithm', async () => {
  const fs = await import('node:fs');
  const files = fs.readdirSync('src/lib/fiveFuturesV2').filter((name) => name.endsWith('.js'));
  const source = files.map((name) => fs.readFileSync(`src/lib/fiveFuturesV2/${name}`, 'utf8')).join('\n');
  assert.doesNotMatch(source, /Amber|Wally|Patricia|Darren|OPENAI_API_KEY|responses\.create|Redis|Stripe|Vercel/u);
  assert.doesNotMatch(source, /BayesianNetwork|MonteCarlo|POMDP|MarkovDecisionProcess|calibrationDataset|RSLRuntime/u);
  assert.doesNotMatch(source, /PremiumCustomerBAShell|src\/Profile|ReactDOM/u);
});
