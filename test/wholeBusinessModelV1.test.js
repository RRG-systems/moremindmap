import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WholeBusinessModelIntegrityError,
  assembleWholeBusinessContext,
  buildBeliefStateTransition,
  buildWholeBusinessModel,
  canonicalHash,
  createFrontierSynthesisAdapter,
  loadFrozenAuthorityLibrary,
  WHOLE_BUSINESS_MODEL_V1_SCHEMA,
  validateWholeBusinessInputs,
  validateWholeBusinessModel,
} from '../src/lib/wholeBusinessModelV1/index.js';
import {
  WBM_SYNTHETIC_CASES,
  buildSyntheticWholeBusinessCandidate,
  buildSyntheticWholeBusinessInput,
} from './fixtures/wholeBusinessModelV1SyntheticFixtures.js';

const library = loadFrozenAuthorityLibrary();

function buildCase(caseId) {
  const definition = WBM_SYNTHETIC_CASES.find((item) => item.case_id === caseId);
  assert.ok(definition, `unknown synthetic case ${caseId}`);
  const input = buildSyntheticWholeBusinessInput(definition);
  const context = assembleWholeBusinessContext(input, { library });
  const candidate = buildSyntheticWholeBusinessCandidate(definition, context);
  return { definition, input, context, candidate };
}

test('frozen BA authority library loads 12 Universal and 16 Real Estate Bibles with verified hashes', () => {
  assert.equal(library.universal_bibles.length, 12);
  assert.equal(library.real_estate_bibles.length, 16);
  assert.equal(library.library_registry.total_bible_count, 28);
  assert.equal(library.freeze_manifest.verdict, 'BA_INTELLIGENCE_AUTHORITY_LIBRARY_V1_FROZEN_READY_FOR_RUNTIME_INTEGRATION');
  assert.equal(library.five_futures_metadata.status, 'FROZEN_METADATA_ONLY_V2_RUNTIME_NOT_IMPLEMENTED');
});

test('machine-readable WBM schema defines the complete structured belief-state envelope', () => {
  assert.equal(WHOLE_BUSINESS_MODEL_V1_SCHEMA.type, 'object');
  assert.ok(WHOLE_BUSINESS_MODEL_V1_SCHEMA.required.includes('causal_model'));
  assert.ok(WHOLE_BUSINESS_MODEL_V1_SCHEMA.required.includes('state_lineage'));
  assert.ok(WHOLE_BUSINESS_MODEL_V1_SCHEMA.required.includes('downstream_contributions'));
  assert.deepEqual(WHOLE_BUSINESS_MODEL_V1_SCHEMA.properties.governing_constraint.properties.constraint_type.enum.includes('insufficient_evidence'), true);
});

test('all 20 required synthetic businesses construct and validate materially different WBM belief states', () => {
  assert.equal(WBM_SYNTHETIC_CASES.length, 20);
  const mechanisms = new Set();
  const hashes = new Set();
  const constraints = new Set();
  for (const definition of WBM_SYNTHETIC_CASES) {
    const input = buildSyntheticWholeBusinessInput(definition);
    const context = assembleWholeBusinessContext(input, { library });
    const candidate = buildSyntheticWholeBusinessCandidate(definition, context);
    const receipt = validateWholeBusinessModel(candidate, context);
    assert.equal(receipt.status, 'PASS', definition.case_id);
    assert.equal(receipt.business_id, input.assessment_identity.business_id);
    mechanisms.add(candidate.causal_model.mechanisms[0].underlying_mechanism);
    constraints.add(candidate.governing_constraint.constraint_type);
    hashes.add(canonicalHash(candidate));
  }
  assert.equal(mechanisms.size, 20, 'causal mechanisms must not converge to generic template output');
  assert.equal(hashes.size, 20, 'materially different businesses must produce materially different WBMs');
  assert.ok(constraints.size >= 8, 'generalization must exercise materially different governing constraints');
});

test('router selects only relevant authority slices and never dumps the frozen library or script corpus', () => {
  const paidLead = buildCase('paid-lead-weak-followup').context;
  const team = buildCase('leader-dependent-team').context;
  const paidIds = paidLead.selection_receipt.selected_authority_ids;
  const teamIds = team.selection_receipt.selected_authority_ids;
  assert.ok(paidIds.length < 28);
  assert.ok(teamIds.length < 28);
  assert.ok(paidIds.includes('UB-06'));
  assert.ok(paidIds.includes('RE-06'));
  assert.ok(teamIds.includes('UB-10'));
  assert.ok(teamIds.includes('RE-14'));
  assert.notDeepEqual(paidIds, teamIds);
  assert.equal(JSON.stringify(paidLead).includes('REAL_ESTATE_SCRIPT_AND_CONVERSATION_LIBRARY'), false);
  assert.ok(paidLead.selection_receipt.selected_section_ids.length > paidIds.length);
  assert.ok(paidLead.selection_receipt.exclusions.length > 0);
});

test('Whole-Person context modifies only supported interaction or feasibility and never business facts', () => {
  const relevant = buildCase('accidental-success');
  const irrelevant = buildCase('large-dead-database');
  assert.equal(relevant.context.frozen_whole_person_authority.selected_claims.length, 1);
  assert.equal(relevant.candidate.person_business_synthesis.length, 1);
  assert.equal(relevant.candidate.person_business_synthesis[0].relationship_type, 'FEASIBILITY_MODIFIER');
  assert.equal(relevant.candidate.person_business_synthesis[0].business_cause_established_by_personality, false);
  assert.equal(irrelevant.context.frozen_whole_person_authority.selected_claims.length, 0);
  assert.equal(irrelevant.candidate.person_business_synthesis.length, 0);
  assert.deepEqual(relevant.context.business_evidence, relevant.input.governed_business_evidence);
});

test('Team context is permission-bound, relevant-only, distinct, and never averaged', () => {
  const solo = buildCase('leverage-ready-solo');
  const team = buildCase('leader-dependent-team');
  assert.equal(solo.context.team_context.selected_members.length, 0);
  assert.equal(solo.candidate.team_organizational_synthesis.length, 0);
  assert.equal(team.context.team_context.selected_members.length, 1);
  assert.equal(team.context.team_context.aggregation_prohibited, true);
  assert.equal(team.candidate.team_organizational_synthesis[0].people_averaged, false);
  assert.deepEqual(team.candidate.team_organizational_synthesis[0].structural_explanations_tested, [
    'role design', 'decision rights', 'workload', 'capacity', 'incentives', 'missing systems',
  ]);
});

test('contradictions, missing evidence, uncertainty and abstention survive without false reconciliation', () => {
  const { context, candidate } = buildCase('contradictory-thin');
  const receipt = validateWholeBusinessModel(candidate, context);
  assert.equal(receipt.status, 'PASS');
  assert.equal(candidate.governing_constraint.constraint_type, 'insufficient_evidence');
  assert.equal(candidate.governing_constraint.epistemic_class, 'INSUFFICIENT_EVIDENCE');
  assert.equal(candidate.epistemic_state.contradictions.length, 1);
  assert.equal(candidate.epistemic_state.missing_evidence.length, 1);
  assert.equal(candidate.projection_eligibility.one_move_v2.status, 'BLOCKED_MISSING_EVIDENCE');
});

test('momentum may omit evidence only when explicitly uncertain and evidence-insufficient', () => {
  const { context, candidate } = buildCase('contradictory-thin');
  const abstained = structuredClone(candidate);
  abstained.momentum.direction = 'UNCERTAIN';
  abstained.momentum.epistemic_class = 'INSUFFICIENT_EVIDENCE';
  abstained.momentum.evidence_refs = [];
  assert.equal(validateWholeBusinessModel(abstained, context).status, 'PASS');
  const unsupportedAssertion = structuredClone(abstained);
  unsupportedAssertion.momentum.direction = 'STABLE';
  assert.throws(() => validateWholeBusinessModel(unsupportedAssertion, context), /momentum\.evidence_refs requires governed evidence references/u);
  const unsupportedConfidence = structuredClone(abstained);
  unsupportedConfidence.momentum.epistemic_class = 'TENTATIVE';
  assert.throws(() => validateWholeBusinessModel(unsupportedConfidence, context), /momentum\.evidence_refs requires governed evidence references/u);
});

test('Dynamic Research is a non-canonical governed trigger and does not force abstention', () => {
  const dynamic = buildCase('market-slowdown');
  const stable = buildCase('relationship-heavy-stable-solo');
  assert.equal(dynamic.context.dynamic_intelligence.length, 1);
  assert.equal(dynamic.context.dynamic_intelligence[0].canon_status, 'DYNAMIC_NOT_CANON');
  assert.equal(dynamic.candidate.dynamic_research.length, 1);
  assert.equal(dynamic.candidate.dynamic_research[0].dynamic_research_warranted, true);
  assert.equal(dynamic.candidate.projection_eligibility.five_futures_v2.status, 'ELIGIBLE');
  assert.equal(stable.context.dynamic_intelligence.length, 0);
  assert.equal(stable.candidate.dynamic_research.length, 0);
});

test('WBM exposes contribution-only state for Five Futures and One Move with no runtime implementation', () => {
  for (const definition of WBM_SYNTHETIC_CASES) {
    const { candidate } = buildCase(definition.case_id);
    assert.equal(candidate.downstream_contributions.five_futures_v2.roles.length, 5);
    assert.equal(candidate.downstream_contributions.five_futures_v2.trajectories_generated, false);
    assert.equal(candidate.downstream_contributions.five_futures_v2.weights_computed, false);
    assert.equal(candidate.downstream_contributions.one_move_v2.candidates_ranked, false);
    assert.equal(candidate.downstream_contributions.one_move_v2.move_selected, false);
    assert.equal(candidate.runtime_boundaries.bayesian_project_authorized, false);
    assert.equal(candidate.runtime_boundaries.calibration_project_authorized, false);
    assert.equal(candidate.runtime_boundaries.rsl_active, false);
  }
});

test('downstream truth validation rejects customer prose, trajectories, weights, One Move, and identity drift', () => {
  const { context, candidate } = buildCase('paid-lead-weak-followup');
  for (const [field, value] of [
    ['customer_prose', 'You should do this.'],
    ['five_futures', []],
    ['trajectory_weights', [20, 20, 20, 20, 20]],
    ['one_move', { action: 'Call leads' }],
  ]) {
    const mutated = structuredClone(candidate);
    mutated[field] = value;
    assert.throws(
      () => validateWholeBusinessModel(mutated, context),
      (error) => error instanceof WholeBusinessModelIntegrityError && error.code === 'MALFORMED_STATE',
      field,
    );
  }
  const wrongBusiness = structuredClone(candidate);
  wrongBusiness.assessment_identity.business_id = 'synthetic-business-other';
  assert.throws(() => validateWholeBusinessModel(wrongBusiness, context), /WRONG_SUBJECT/u);
});

test('input integrity fails closed for cross-profile evidence and unauthorized team retrieval', () => {
  const evidenceLeak = buildSyntheticWholeBusinessInput(WBM_SYNTHETIC_CASES[0]);
  evidenceLeak.governed_business_evidence[0].profile_id = 'synthetic-profile-other';
  assert.throws(() => validateWholeBusinessInputs(evidenceLeak), /CROSS_PROFILE_CONTAMINATION/u);

  const teamLeak = buildSyntheticWholeBusinessInput(WBM_SYNTHETIC_CASES.find((item) => item.case_id === 'leader-dependent-team'));
  teamLeak.authorization.permitted_profile_ids = [teamLeak.assessment_identity.owner_profile_id];
  assert.throws(() => validateWholeBusinessInputs(teamLeak), /UNAUTHORIZED_TEAM_ACCESS/u);
});

test('belief-state transition preserves identity, prior hash, version movement, and change classifications', () => {
  const { candidate } = buildCase('large-dead-database');
  const previous = structuredClone(candidate);
  previous.state_hash = canonicalHash(previous);
  const next = structuredClone(candidate);
  next.state_lineage.state_version = 2;
  next.state_lineage.prior_state = { state_version: 1, state_hash: previous.state_hash };
  next.causal_model.mechanisms[0].epistemic_class = 'STRONGLY_SUPPORTED';
  next.epistemic_state.claim_support[0].epistemic_class = 'STRONGLY_SUPPORTED';
  const transition = buildBeliefStateTransition(previous, next);
  assert.equal(transition.from_state_version, 1);
  assert.equal(transition.to_state_version, 2);
  assert.equal(transition.mechanism_changes[0].status, 'CHANGED');
  assert.equal(transition.support_movement[0].status, 'CHANGED');
});

test('frontier synthesis adapter receives structured mission with store:false and validates downstream', async () => {
  const definition = WBM_SYNTHETIC_CASES.find((item) => item.case_id === 'geographic-farmer');
  const input = buildSyntheticWholeBusinessInput(definition);
  let captured = null;
  const adapter = createFrontierSynthesisAdapter({
    async synthesize({ mission, store }) {
      captured = { mission, store };
      return buildSyntheticWholeBusinessCandidate(definition, mission.context_packet);
    },
  });
  const result = await buildWholeBusinessModel(input, { synthesisAdapter: adapter, library });
  assert.equal(captured.store, false);
  assert.equal(captured.mission.required_output.customer_prose, undefined);
  assert.ok(captured.mission.prohibited_output_fields.includes('trajectory_weights'));
  assert.equal(result.validation_receipt.status, 'PASS');
  assert.equal(result.model.validation_receipt.status, 'PASS');
  assert.match(result.model.state_hash, /^[a-f0-9]{64}$/u);
});

test('implementation remains profile-agnostic, non-wired, and provider-neutral', async () => {
  const fs = await import('node:fs');
  const files = fs.readdirSync('src/lib/wholeBusinessModelV1').filter((name) => name.endsWith('.js'));
  const source = files.map((name) => fs.readFileSync(`src/lib/wholeBusinessModelV1/${name}`, 'utf8')).join('\n');
  assert.doesNotMatch(source, /Amber|Wally|Patricia|Darren|Redis|Stripe|Vercel|OPENAI_API_KEY|responses\.create/u);
  assert.doesNotMatch(source, /src\/Profile|PremiumCustomerBAShell|customer UI/u);
});
