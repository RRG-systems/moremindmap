import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATHLETE_BOS_DESTINATIONS,
  ATHLETE_BOS_MAP_VERSION,
  ATHLETE_BOS_OPERATING_DOMAINS,
  ATHLETE_BOS_PERSONALITY_DNA_ARCHITECTURE_VERSION,
  ATHLETE_BOS_SEMANTIC_STAGE_VERSION,
  ATHLETE_BOS_SEMANTIC_STAGES,
  ATHLETE_BOS_SURFACES,
  ATHLETE_BOS_WHOLE_PERSON_VERSION,
  athleteSurfaceWriterInstruction,
} from '../src/lib/athleteBosV1/personalityDnaArchitecture.js';
import { SURFACES as NEW_BOS_SURFACES } from '../src/lib/newBosPersonalityDnaV1/constants.js';
import { filterAudience, getFixture } from '../api/engine/athleteBosV1/fixtures.js';
import {
  CONTRACT,
  MODEL,
  assertAthleteSurfaceEditorialHeadlines,
  athleteSurfacePacketHasPublicationSupport,
  assembleInterpretationFromStages,
  assertProspectiveFalsifier,
  buildAthleteSurfacePackets,
  resolveFutureReadiness,
  semanticStageSchema,
  stateHash,
  validateInterpretation,
  validateSemanticStage,
} from '../api/engine/athleteBosV1/contract.js';
import {
  ATHLETE_BOS_PROVIDER_RUNTIME,
  ATHLETE_PROVIDER_TIMEOUT_MS,
  ATHLETE_PROVIDER_ATTEMPT_SLOTS,
  ATHLETE_SEMANTIC_MAX_OUTPUT_TOKENS,
  ATHLETE_SEMANTIC_TEXT_VERBOSITY,
  ATHLETE_SURFACE_MAX_OUTPUT_TOKENS,
  DOCTRINE,
  buildAthleteSurfaceProviderInput,
  canonicalAthleteEmptySurfaceProse,
  generationIdentity,
  validateAthleteAudienceSource,
  validateAthleteArtifact,
  validateSchema,
  writerEvidenceRefs,
} from '../api/engine/athleteBosV1/generation.js';
import { assembleAthleteSurfaceRendering } from '../api/engine/athleteBosV1/renderingAssembly.js';

const subject = getFixture('synthetic-athlete-nia');
const evidence = Object.fromEntries(subject.evidence.map((item) => [item.id, item]));
const exact = (id) => evidence[id].text;

const TEST_EDITORIAL_HEADLINES = new Map([
  ['this_is_you', 'Ready Without Owning Every Condition'],
  ['personality_dna', 'The Pattern Beneath Readiness'],
  ['how_you_operate', 'Preparation and Timing Are Different'],
  ['how_people_experience_you', 'A Label Can Miss the Story'],
  ['communication_dna', 'Questions Before Assumptions'],
  ['strengths_vulnerabilities', 'Preparation Helps Within Its Reach'],
  ['pressure_conflict', 'Pressure Does Not Tell One Story'],
  ['work_dna', 'Your Week Has Moving Parts'],
  ['role_seat', 'Growth Needs Fair Conditions'],
  ['cognitive_operating_style', 'Learning One Step at a Time'],
  ['personal_operating_energy', 'Capacity Belongs to This Season'],
  ['five_futures', 'Several Directions Can Stay Open'],
  ['one_move', 'Notice What You Can Choose'],
  ['evidence_certainty', 'Some Parts Are Still Unclear'],
  ['operating_identity', 'Readiness With a Fair Boundary'],
]);

const claim = (id, evidenceId, statement) => ({
  id,
  statement,
  layer: 'current_state',
  confidence: 'direct_account',
  support: [{ evidenceId, exactSpan: exact(evidenceId) }],
  counterEvidenceIds: [],
  alternatives: ['A different comparable event could change this view.'],
  whatWouldChangeIt: 'If the athlete corrects this account or a comparable event differs, this claim should change.',
});

function future(index) {
  const pathNumber = index + 1;
  return {
    title: `Conditional direction ${pathNumber}`,
    athleteGoalId: 'G1',
    baselineClaimIds: ['K1'],
    condition: `This path ${pathNumber} may become useful if arriving settled still matters to the athlete.`,
    controllableActions: [`Notice one comparable arrival through path ${pathNumber}.`],
    externalDependencies: [`Path ${pathNumber} still depends on a condition outside the athlete’s control.`],
    mechanismHypothesis: `Testing path ${pathNumber} may make one different part of the next choice clearer.`,
    alternatives: [`Keeping the current approach instead of path ${pathNumber} may be wiser.`],
    possibility: `A distinct path ${pathNumber} toward a calmer arrival may become more repeatable.`,
    horizon: `${pathNumber} comparable practice${pathNumber === 1 ? '' : 's'}.`,
    evidenceIds: ['E01'],
    counterEvidenceIds: [],
    uncertainty: 'One reported goal does not establish a pattern.',
    indicators: [`The athlete says path ${pathNumber} made the arrival feel more settled.`],
    falsifier: `If the athlete says path ${pathNumber} does not address what ready means, this path should change.`,
    reviewTrigger: `After trying path ${pathNumber}.`,
  };
}

function move(kind = 'explore') {
  return {
    kind,
    suggestion: kind === 'abstain' ? '' : 'Notice which part of one arrival was actually yours to choose.',
    purpose: kind === 'abstain' ? '' : 'Separate a choice from a condition outside your control.',
    evidenceIds: kind === 'abstain' ? [] : ['E01', 'E02'],
    alternativesConsidered: ['Keep the current approach.'],
    whyThis: kind === 'abstain' ? '' : 'It is small, reversible, and tied to the athlete’s stated aim.',
    proposedActor: 'athlete',
    willingness: 'not_established',
    prerequisites: [],
    burden: 'One brief check.',
    risk: 'Low, but stop if it adds pressure.',
    reversibility: 'It can be stopped immediately.',
    observation: 'Whether the athlete can separate preparation from transport.',
    observationWindow: 'One comparable practice.',
    reviewEvent: 'The next private review.',
    falsifier: 'If it does not make the situation clearer, the move should change.',
    confounders: ['The next arrival may happen under different conditions.'],
    inconclusiveIf: 'The situations are not comparable.',
    stopOrAdjust: 'Pause if it adds burden or misses what matters.',
    uncertainty: 'This is a suggestion, not a commitment or proven intervention.',
  };
}

function fragments({ futureCount = 1, crossSurfaceContradiction = false } = {}) {
  const foundation = {
    lifeHopes: { status: 'not_asked', meaning: 'Longer-term life hopes were not asked in this historical synthetic case.', evidenceIds: [] },
    goals: [{ id: 'G1', meaning: 'Arrive feeling ready instead of behind.', authorship: 'athlete_chosen', evidenceIds: ['E01'] }],
    claims: [
      claim('K1', 'E01', 'Nia currently wants to arrive feeling ready.'),
      claim('K2', 'E02', 'Two reported arrival moments had different preparation and transport conditions.'),
    ],
    causal_dynamics: [{
      id: 'D1',
      triggerOrContext: 'When an arrival matters and part of it may be outside her control.',
      meaningOrPrivateCalculation: 'Feeling behind may make readiness feel especially important.',
      responseOrAction: 'She may prepare the part she can choose before the day begins.',
      immediateUse: 'This can reduce one avoidable source of uncertainty.',
      possibleDelayedCost: 'It cannot solve transport, so treating it as the whole answer could become unfair.',
      evidenceIds: ['E01', 'E02'],
      counterEvidenceIds: [],
      confounders: ['The two reported moments may not be comparable.'],
      confidence: 'bounded_inference',
      falsifier: 'If Nia says readiness means something different or a comparable event unfolds differently, this account should change.',
    }],
    sequences: [{
      id: 'S1',
      context: 'One reported Thursday before practice.',
      steps: ['Packed the equipment the night before.', 'The ride was late.'],
      consequence: 'Preparation and arrival timing remained separate facts.',
      evidenceIds: ['E02'],
      counterEvidenceIds: [],
      confounders: ['The account does not establish the full timeline.'],
      confidence: 'direct_account',
      falsifier: 'If Nia corrects the sequence, this account should change.',
    }],
    strengths_and_overuse: [{
      id: 'O1',
      strength: 'Preparing a controllable part ahead of time.',
      usefulWhen: 'Equipment preparation is the part creating uncertainty.',
      lessUsefulWhen: 'An outside transport condition is what changes the arrival.',
      mechanism: 'Preparation can remove one uncertainty without controlling every condition.',
      evidenceIds: ['E02'],
      counterEvidenceIds: [],
      confidence: 'bounded_inference',
      falsifier: 'If comparable moments show that preparing ahead does not help Nia feel ready, this account should change.',
    }],
    compensations: [],
    contradictions: crossSurfaceContradiction
      ? [{ description: 'A seriousness label is not an established explanation for either arrival.', evidenceIds: ['E01', 'E04'], resolved: false }]
      : [],
    unknowns: ['What ready means to Nia is still open.'],
  };
  const domains = ATHLETE_BOS_OPERATING_DOMAINS.map(({ id }, index) => ({
    domainId: id,
    meaning: index === 0
      ? 'Her stated aim is to feel ready without turning one arrival into a fixed identity.'
      : index === 1
        ? 'The reported moments separate what she prepared from how transport unfolded.'
        : '',
    claimIds: index === 0 ? ['K1'] : index === 1 ? ['K2'] : [],
    causalIds: index === 0 ? ['D1'] : index === 1 ? ['S1', 'O1'] : [],
    evidenceIds: index === 0 ? ['E01'] : index === 1 ? ['E02'] : [],
    counterEvidenceIds: [],
    unknowns: index < 2 ? [] : ['This area remains open.'],
    abstention: index < 2 ? '' : 'There is not enough separate evidence to describe this area yet.',
  }));
  const synthesis = {
    title: 'Nia — readiness without a fixed label',
    recognition: 'You care about arriving ready, and the moments you described do not all have the same cause.',
    whole_person_model: {
      version: ATHLETE_BOS_WHOLE_PERSON_VERSION,
      core_explanation: 'Readiness matters to Nia, while preparation and transport remain separate parts of the story.',
      central_tension: 'She can choose some preparation, but she does not control every arrival condition.',
      mechanisms: ['Separating a choice from an outside condition may protect a fairer view of the athlete.'],
      causal_mechanisms: [{
        id: 'M1',
        meaning: 'Preparation can help with a controllable uncertainty without explaining every arrival condition.',
        causalIds: ['D1', 'S1', 'O1'],
        evidence_refs: ['E01', 'E02'],
        uncertainty: 'The available moments are too sparse to establish a durable pattern.',
      }],
      identity_tensions: ['One late arrival does not define seriousness.'],
      goal_conflicts: [],
      private_calculations: [],
      pressure_and_recovery: 'There is not enough evidence yet to describe a pressure pattern.',
      work_and_relationships: 'An outside label may not match the causes of a specific moment.',
      identity_distillation: 'A young person trying to arrive ready while learning what is and is not hers to control.',
      evidence_refs: ['E01', 'E02'],
      uncertainty: ['The events are sparse and their dates are not fully linked.'],
    },
    athlete_map: {
      version: ATHLETE_BOS_MAP_VERSION,
      recognition: 'Readiness matters to you.',
      preparation_and_action: 'Preparation and transport were different parts of the moments you described.',
      people_and_communication: 'There is not enough to describe a broader pattern.',
      strengths_and_pressure: 'There is not enough to describe a broader pattern.',
      sport_school_and_responsibilities: 'Transport is one condition outside the athlete’s direct choice.',
      growth_conditions: 'A fair account keeps chosen preparation separate from transport.',
      learning_and_problem_solving: 'There is not enough to describe a broader pattern.',
      energy_capacity_and_recovery: 'There is not enough to describe a broader pattern.',
      evidence_refs: ['E01', 'E02'],
      unknowns: ['Comparable later events could change this map.'],
    },
    life_direction_futures_disposition: {
      status: 'not_available',
      explanation: 'Longer-term life direction was not available in this historical synthetic case.',
      evidenceIds: [],
    },
    futures: Array.from({ length: futureCount }, (_, index) => future(index)),
    move: move(),
    unknowns: ['Whether a different arrival approach would actually help remains unknown.'],
  };
  const routes = ATHLETE_BOS_SURFACES.map(({ id }) => {
    const editorialHeadline = TEST_EDITORIAL_HEADLINES.get(id);
    const portfolio = {
      primaryRealization: `${editorialHeadline} reveals a distinct part of this governed reading.`,
      primaryEventRootIds: ['E01'],
      visualIntent: 'Make this surface’s main relationship visible without scores.',
      reusePurpose: '',
    };
    if (['this_is_you', 'personality_dna', 'operating_identity'].includes(id)) return { surfaceId: id, editorialHeadline, ...portfolio, claimIds: ['K1'], causalIds: ['D1'], evidenceIds: ['E01'], abstention: '' };
    if (id === 'how_you_operate') return { surfaceId: id, editorialHeadline, ...portfolio, primaryEventRootIds: ['E02'], claimIds: ['K2'], causalIds: ['S1', 'O1'], evidenceIds: ['E02'], abstention: '' };
    if (id === 'five_futures') return futureCount
      ? { surfaceId: id, editorialHeadline, ...portfolio, claimIds: ['K1'], causalIds: ['D1'], evidenceIds: ['E01'], abstention: '' }
      : { surfaceId: id, editorialHeadline, ...portfolio, primaryEventRootIds: [], claimIds: [], causalIds: [], evidenceIds: [], abstention: 'There is not enough athlete-chosen direction for a useful future yet.' };
    if (id === 'one_move') return { surfaceId: id, editorialHeadline, ...portfolio, claimIds: ['K1'], causalIds: ['D1'], evidenceIds: ['E01', 'E02'], abstention: '' };
    if (id === 'evidence_certainty') return { surfaceId: id, editorialHeadline, ...portfolio, claimIds: ['K1', 'K2'], causalIds: ['D1', 'S1', 'O1'], evidenceIds: ['E01', 'E02', ...(crossSurfaceContradiction ? ['E04'] : [])], abstention: '' };
    return { surfaceId: id, editorialHeadline, ...portfolio, primaryEventRootIds: [], claimIds: [], causalIds: [], evidenceIds: [], abstention: 'There is not enough separate evidence to describe this area yet.' };
  });
  return {
    causal_foundation: foundation,
    operating_domains: { domains },
    whole_person_decision_synthesis: synthesis,
    surface_routing: { surface_routes: routes },
  };
}

function validateAllStages(parts) {
  const prior = {};
  for (const stage of ATHLETE_BOS_SEMANTIC_STAGES) {
    const acceptedDependencies = Object.fromEntries(stage.dependencies.map((stageId) => [stageId, prior[stageId]]));
    const schema = semanticStageSchema(stage.id, subject, acceptedDependencies);
    validateSchema(parts[stage.id], schema);
    validateSemanticStage(stage.id, parts[stage.id], subject, acceptedDependencies);
    prior[stage.id] = parts[stage.id];
  }
  return prior;
}

test('Athlete uses the exact New BOS 15-surface topology and the exact Founder-frozen nine destinations', () => {
  assert.deepEqual(ATHLETE_BOS_SURFACES.map(({ id }) => id), NEW_BOS_SURFACES.map(({ id }) => id));
  assert.deepEqual(ATHLETE_BOS_SURFACES.map(({ number }) => number), Array.from({ length: 15 }, (_, index) => index + 1));
  assert.deepEqual(ATHLETE_BOS_DESTINATIONS.map(({ id }) => id), [
    'recognition', 'visual_bos', 'operating', 'people', 'pressure', 'work_life', 'dna', 'futures', 'evidence',
  ]);
  assert.equal(ATHLETE_BOS_DESTINATIONS.length, 9);
  assert.deepEqual(ATHLETE_BOS_DESTINATIONS.find(({ id }) => id === 'visual_bos').surfaceIds, []);
  const routed = ATHLETE_BOS_DESTINATIONS.flatMap(({ surfaceIds }) => surfaceIds);
  assert.equal(routed.length, 15);
  assert.deepEqual([...routed].sort(), ATHLETE_BOS_SURFACES.map(({ id }) => id).sort());
  const destinationBySurface = new Map(ATHLETE_BOS_DESTINATIONS.flatMap(({ id, surfaceIds }) => surfaceIds.map((surfaceId) => [surfaceId, id])));
  for (const surface of ATHLETE_BOS_SURFACES) assert.equal(surface.destination, destinationBySurface.get(surface.id), `${surface.id} registry destination drift`);
});

test('the semantic runtime is exactly four ordered dependency-bound stages', () => {
  assert.equal(ATHLETE_BOS_PERSONALITY_DNA_ARCHITECTURE_VERSION, 'athlete_bos_personality_dna_architecture_v1');
  assert.equal(ATHLETE_BOS_SEMANTIC_STAGE_VERSION, 'athlete_bos_four_stage_semantic_runtime_v6');
  assert.deepEqual(ATHLETE_BOS_SEMANTIC_STAGES.map(({ id, order }) => [id, order]), [
    ['causal_foundation', 1],
    ['operating_domains', 2],
    ['whole_person_decision_synthesis', 3],
    ['surface_routing', 4],
  ]);
  assert.deepEqual(ATHLETE_BOS_SEMANTIC_STAGES.map(({ id, dependencies }) => [id, dependencies]), [
    ['causal_foundation', []],
    ['operating_domains', ['causal_foundation']],
    ['whole_person_decision_synthesis', ['causal_foundation', 'operating_domains']],
    ['surface_routing', ['causal_foundation', 'operating_domains', 'whole_person_decision_synthesis']],
  ]);
});

test('the provider identity is the frozen New BOS model/config and contains no fallback path', () => {
  assert.equal(CONTRACT, 'athlete-bos-synthetic-v1-contract-new-bos-parity-v12');
  assert.equal(MODEL, 'gpt-5.6-sol');
  assert.equal(ATHLETE_SEMANTIC_MAX_OUTPUT_TOKENS, 64_000);
  assert.equal(ATHLETE_SURFACE_MAX_OUTPUT_TOKENS, 16_000);
  assert.equal(ATHLETE_SEMANTIC_TEXT_VERBOSITY, 'low');
  assert.equal(ATHLETE_PROVIDER_TIMEOUT_MS, 900_000);
  assert.equal(ATHLETE_PROVIDER_ATTEMPT_SLOTS, 5);
  assert.deepEqual(ATHLETE_BOS_PROVIDER_RUNTIME, {
    api: 'OpenAI Responses API',
    model: 'gpt-5.6-sol',
    reasoning: 'xhigh',
    store: false,
    background: false,
    semantic_calls: 4,
    surface_calls: 15,
    surface_concurrency: 4,
    semantic_max_output_tokens: 64_000,
    surface_max_output_tokens: 16_000,
    semantic_text_verbosity: 'low',
    provider_timeout_ms: 900_000,
    fallback: 'none',
  });
  const same = generationIdentity(subject, 'athlete');
  assert.equal(same, '9a39ce266e355436adfbf596e4f0f6aa04716191f5fc66fd4e00fabe77eb793e');
  assert.equal(same, generationIdentity(structuredClone(subject), 'athlete'));
  const changed = structuredClone(subject);
  changed.evidence[0].text += ' Corrected.';
  assert.notEqual(same, generationIdentity(changed, 'athlete'));
});

test('prospective falsifiers accept natural future evidence language but reject invented completed corrections', () => {
  for (const value of [
    'A later account that current priorities changed.',
    'A future correction to the reported timing.',
    'More close situations would narrow this reading.',
    'Repeated shared tasks where this does not help would weaken the pattern.',
    'Further accounts could change this view.',
    'Several comparable moments might show something different.',
    'Revise this if your priorities change.',
    'Revise this when your available room changes.',
  ]) assert.doesNotThrow(() => assertProspectiveFalsifier(value));
  assert.throws(() => assertProspectiveFalsifier('You clarify that these questions serve another purpose.'), /FALSIFIER_CANNOT_ASSERT_UNOBSERVED_CORRECTION/);
  assert.throws(() => assertProspectiveFalsifier('This happened differently.'), /FALSIFIER_MUST_BE_CONDITIONAL_TEST/);
});

test('the generator refuses a private source at the coach boundary and accepts only the exact scoped projection', () => {
  const fullPrivateMara = getFixture('synthetic-athlete-mara');
  assert.throws(() => validateAthleteAudienceSource(fullPrivateMara, 'coach'), /COACH_PROJECTION_NOT_SERVER_ISSUED/);
  const coachProjection = filterAudience(fullPrivateMara, 'coach', '2026-09-04T00:00:00Z');
  assert.equal(validateAthleteAudienceSource(coachProjection, 'coach'), coachProjection);
  assert.throws(() => validateAthleteAudienceSource(structuredClone(coachProjection), 'coach'), /COACH_PROJECTION_NOT_SERVER_ISSUED/);
  const extraEvidence = structuredClone(coachProjection);
  extraEvidence.evidence.push(structuredClone(fullPrivateMara.evidence[0]));
  assert.throws(() => validateAthleteAudienceSource(extraEvidence, 'coach'), /COACH_PROJECTION_NOT_SERVER_ISSUED/);
  const forgedProjection = {
    ...structuredClone(coachProjection),
    evidence: fullPrivateMara.evidence.map((item) => ({ ...item, audience: 'coach' })),
    projectionScope: { ...coachProjection.projectionScope, evidenceIds: fullPrivateMara.evidence.map(({ id }) => id) },
  };
  assert.throws(() => validateAthleteAudienceSource(forgedProjection, 'coach'), /COACH_PROJECTION_NOT_SERVER_ISSUED/);
  assert.equal(validateAthleteAudienceSource(fullPrivateMara, 'athlete'), fullPrivateMara);
  assert.throws(() => validateAthleteAudienceSource(coachProjection, 'athlete'), /ATHLETE_PRIVATE_SOURCE_REQUIRED/);
});

test('semantic and surface instructions keep an unanswered question open instead of backfilling later events as input', () => {
  assert.match(DOCTRINE, /question establishes only that it was asked/i);
  assert.match(DOCTRINE, /later observation, hearing, action, or outcome cannot be backfilled/i);
  assert.match(DOCTRINE, /same-event answers do not establish their relative order/i);
  assert.match(DOCTRINE, /could not find an item, do not say the item was missing/i);
  assert.match(DOCTRINE, /wish to preserve flexibility does not establish current dependence/i);
  assert.match(DOCTRINE, /Falsifiers are prospective conditional tests/i);
  for (const surfaceId of ['communication_dna', 'cognitive_operating_style', 'pressure_conflict']) {
    const instruction = athleteSurfaceWriterInstruction(surfaceId).join(' ');
    assert.match(instruction, /question establishes only that it was asked/i);
    assert.match(instruction, /later observation, hearing, action, or outcome cannot be backfilled/i);
    assert.match(instruction, /same event do not establish their relative order/i);
    assert.match(instruction, /could not find an item, do not say the item was missing/i);
    assert.match(instruction, /wish to preserve flexibility does not establish current dependence/i);
  }
});

test('each stage schema validates and deterministic assembly produces complete 15-surface truth', () => {
  const parts = fragments();
  validateAllStages(parts);
  const plan = assembleInterpretationFromStages(parts, subject);
  assert.equal(plan.chapters.length, 15);
  assert.equal(plan.surface_routes.length, 15);
  assert.equal(plan.domains.length, 10);
  assert.equal(plan.whole_person_model.version, ATHLETE_BOS_WHOLE_PERSON_VERSION);
  assert.equal(plan.athlete_map.version, ATHLETE_BOS_MAP_VERSION);
  assert.doesNotThrow(() => validateInterpretation(plan, subject));
});

test('surface routing coordinates one short customer-safe unique editorial headline for every independent writer', () => {
  const parts = fragments();
  assert.doesNotThrow(() => assertAthleteSurfaceEditorialHeadlines(parts.surface_routing.surface_routes));

  const duplicate = structuredClone(parts);
  duplicate.surface_routing.surface_routes[1].editorialHeadline = duplicate.surface_routing.surface_routes[0].editorialHeadline.toUpperCase().replace('WITHOUT', "WITHOUT'");
  assert.throws(
    () => validateSemanticStage('surface_routing', duplicate.surface_routing, subject, duplicate),
    /ATHLETE_SURFACE_HEADLINES_NOT_UNIQUE/,
  );

  const labelOnly = structuredClone(parts);
  labelOnly.surface_routing.surface_routes[0].editorialHeadline = ATHLETE_BOS_SURFACES[0].label;
  assert.throws(
    () => validateSemanticStage('surface_routing', labelOnly.surface_routing, subject, labelOnly),
    /ATHLETE_SURFACE_HEADLINE_MUST_BE_EDITORIAL/,
  );

  const unsafe = structuredClone(parts);
  unsafe.surface_routing.surface_routes[0].editorialHeadline = 'Your Adult Business Role and Seat';
  assert.throws(
    () => validateSemanticStage('surface_routing', unsafe.surface_routing, subject, unsafe),
    /PROHIBITED_CUSTOMER_ASSERTION/,
  );

  const internal = structuredClone(parts);
  internal.surface_routing.surface_routes[13].editorialHeadline = 'Most Moments Stay Context-Bound';
  assert.throws(
    () => validateSemanticStage('surface_routing', internal.surface_routing, subject, internal),
    /PROHIBITED_CUSTOMER_ASSERTION/,
  );

  const generic = structuredClone(parts);
  generic.surface_routing.surface_routes[0].editorialHeadline = 'You Can Prepare and Ask for Help';
  assert.throws(
    () => validateSemanticStage('surface_routing', generic.surface_routing, subject, generic),
    /ATHLETE_SURFACE_HEADLINE_TOO_GENERIC/,
  );

  const tooLong = structuredClone(parts);
  tooLong.surface_routing.surface_routes[0].editorialHeadline = 'One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen';
  assert.throws(
    () => validateSemanticStage('surface_routing', tooLong.surface_routing, subject, tooLong),
    /ATHLETE_SURFACE_HEADLINE_INVALID/,
  );
});

test('the routing portfolio rejects repeated primary realizations and one event dominating unrelated domain surfaces', () => {
  const repeatedRealization = fragments();
  repeatedRealization.surface_routing.surface_routes[1].primaryRealization = repeatedRealization.surface_routing.surface_routes[0].primaryRealization;
  assert.throws(
    () => validateSemanticStage('surface_routing', repeatedRealization.surface_routing, subject, repeatedRealization),
    /ATHLETE_SURFACE_PRIMARY_REALIZATIONS_NOT_UNIQUE/,
  );

  const dominated = fragments();
  for (const [index, surfaceId] of ['how_people_experience_you', 'communication_dna', 'strengths_vulnerabilities', 'pressure_conflict'].entries()) {
    const route = dominated.surface_routing.surface_routes.find((candidate) => candidate.surfaceId === surfaceId);
    route.primaryEventRootIds = ['E01'];
    route.reusePurpose = `A distinct supported use ${index + 1}.`;
    route.claimIds = ['K1'];
    route.evidenceIds = ['E01'];
    route.abstention = '';
  }
  assert.throws(
    () => validateSemanticStage('surface_routing', dominated.surface_routing, subject, dominated),
    /ATHLETE_ONE_EVENT_CANNOT_DOMINATE_UNRELATED_DOMAIN_SURFACES/,
  );
});

test('causal sophistication is typed, evidence-bound, counterfactual, and routed beyond flat claims', () => {
  const parts = fragments();
  validateAllStages(parts);
  const foundation = parts.causal_foundation;
  assert.equal(foundation.causal_dynamics.length, 1);
  const dynamic = foundation.causal_dynamics[0];
  for (const key of ['triggerOrContext', 'meaningOrPrivateCalculation', 'responseOrAction', 'immediateUse', 'possibleDelayedCost', 'falsifier']) assert.ok(dynamic[key]);
  assert.deepEqual(dynamic.evidenceIds, ['E01', 'E02']);
  assert.ok(dynamic.confounders.length);
  assert.equal(foundation.sequences[0].steps.length, 2);
  assert.ok(foundation.strengths_and_overuse[0].lessUsefulWhen);
  const plan = assembleInterpretationFromStages(parts, subject);
  assert.deepEqual(plan.whole_person_model.causal_mechanisms[0].causalIds, ['D1', 'S1', 'O1']);
  assert.ok(plan.chapters.some(({ causalIds }) => causalIds.includes('D1')));
  const tampered = structuredClone(parts);
  tampered.causal_foundation.causal_dynamics[0].evidenceIds = ['PRIVATE_OTHER_CUSTOMER'];
  assert.throws(() => validateSemanticStage('causal_foundation', tampered.causal_foundation, subject), /INVENTED_EVIDENCE_REFERENCE/);
  const emptyMechanism = structuredClone(parts);
  emptyMechanism.causal_foundation.causal_dynamics[0].immediateUse = '';
  assert.throws(() => validateSemanticStage('causal_foundation', emptyMechanism.causal_foundation, subject), /CAUSAL_DYNAMIC_SEMANTICS_REQUIRED/);
  const oneStep = structuredClone(parts);
  oneStep.causal_foundation.sequences[0].steps = ['Only one step'];
  assert.throws(() => validateSemanticStage('causal_foundation', oneStep.causal_foundation, subject), /CAUSAL_SEQUENCE_SEMANTICS_REQUIRED/);
  const emptyOveruse = structuredClone(parts);
  emptyOveruse.causal_foundation.strengths_and_overuse[0].lessUsefulWhen = '';
  assert.throws(() => validateSemanticStage('causal_foundation', emptyOveruse.causal_foundation, subject), /STRENGTH_OVERUSE_SEMANTICS_REQUIRED/);
  const emptyWholePersonMechanism = fragments();
  emptyWholePersonMechanism.whole_person_decision_synthesis.whole_person_model.causal_mechanisms[0] = {
    id: '', meaning: '', causalIds: [], evidence_refs: [], uncertainty: '',
  };
  assert.throws(() => assembleInterpretationFromStages(emptyWholePersonMechanism, subject), /WHOLE_PERSON_CAUSAL_ID_REQUIRED|WHOLE_PERSON_CAUSAL_MEANING_REQUIRED/);

  const alreadyCorrected = fragments();
  alreadyCorrected.causal_foundation.causal_dynamics[0].falsifier = 'The athlete clarified that this account was wrong.';
  assert.throws(
    () => validateSemanticStage('causal_foundation', alreadyCorrected.causal_foundation, subject),
    /FALSIFIER_CANNOT_ASSERT_UNOBSERVED_CORRECTION/,
  );
  const notConditional = fragments();
  notConditional.causal_foundation.causal_dynamics[0].falsifier = 'More information is needed.';
  assert.throws(
    () => validateSemanticStage('causal_foundation', notConditional.causal_foundation, subject),
    /FALSIFIER_MUST_BE_CONDITIONAL_TEST/,
  );

  const unsupportedPastBenefit = fragments();
  unsupportedPastBenefit.causal_foundation.compensations.push({
    id: 'C1',
    pattern: 'Packing the night before.',
    whatItProtectsOrSolves: 'It protected an on-time arrival.',
    possibleCost: 'It may not address transport.',
    conditions: ['One reported Thursday.'],
    evidenceIds: ['E02'],
    counterEvidenceIds: [],
    confounders: ['The ride was late.'],
    confidence: 'bounded_inference',
    falsifier: 'If another comparable arrival differs, this account should change.',
  });
  assert.throws(
    () => validateSemanticStage('causal_foundation', unsupportedPastBenefit.causal_foundation, subject),
    /PAST_CAUSAL_BENEFIT_REQUIRES_EXPLICIT_SOURCE_ATTRIBUTION/,
  );

  const unsupportedPreservedTime = fragments();
  unsupportedPreservedTime.causal_foundation.strengths_and_overuse[0].mechanism = 'Packing ahead preserved time for sleep.';
  assert.throws(
    () => validateSemanticStage('causal_foundation', unsupportedPreservedTime.causal_foundation, subject),
    /PAST_CAUSAL_BENEFIT_REQUIRES_EXPLICIT_SOURCE_ATTRIBUTION/,
  );

  const boundedNegative = fragments();
  boundedNegative.causal_foundation.strengths_and_overuse[0].strength = 'Starting reversible action while preserving a final shared decision.';
  boundedNegative.causal_foundation.strengths_and_overuse[0].mechanism = 'The report does not establish that preparation caused the arrival outcome.';
  assert.doesNotThrow(() => validateSemanticStage('causal_foundation', boundedNegative.causal_foundation, subject));
});

test('a non-abstaining One Move must remain meaningful, evidence-bound, reversible, observable, and falsifiable', () => {
  const emptyMove = fragments();
  emptyMove.whole_person_decision_synthesis.move = {
    ...move('explore'),
    suggestion: '',
    purpose: '',
    evidenceIds: [],
    whyThis: '',
    reversibility: '',
    observation: '',
    falsifier: '',
  };
  assert.throws(() => assembleInterpretationFromStages(emptyMove, subject), /MOVE_SEMANTICS_REQUIRED|MOVE_REQUIRES_EVIDENCE/);
});

test('assembly and routing fail closed on a missing stage, missing surface, or reordered surface', () => {
  const parts = fragments();
  const missingStage = structuredClone(parts);
  delete missingStage.operating_domains;
  assert.throws(() => assembleInterpretationFromStages(missingStage, subject), /FOUR_STAGE_ASSEMBLY_INCOMPLETE/);
  const missingSurface = structuredClone(parts);
  missingSurface.surface_routing.surface_routes.pop();
  assert.throws(() => validateSemanticStage('surface_routing', missingSurface.surface_routing, subject, parts), /SURFACE_ROUTING_COVERAGE/);
  const reordered = structuredClone(parts);
  [reordered.surface_routing.surface_routes[0], reordered.surface_routing.surface_routes[1]] = [reordered.surface_routing.surface_routes[1], reordered.surface_routing.surface_routes[0]];
  assert.throws(() => validateSemanticStage('surface_routing', reordered.surface_routing, subject, parts), /SURFACE_ROUTING_COVERAGE/);
});

test('the final artifact is all-or-fail across all 15 ordered realized surfaces', () => {
  const plan = assembleInterpretationFromStages(fragments(), subject);
  const identity = 'c'.repeat(64);
  const sourceHash = stateHash(subject);
  const surfacePackets = buildAthleteSurfacePackets(plan, subject, identity).map((packet) => {
    const customerProse = athleteSurfacePacketHasPublicationSupport(packet)
      ? `## ${packet.editorial_headline}\n\nA governed reading for ${packet.label}.`
      : canonicalAthleteEmptySurfaceProse(packet);
    return {
      ...packet,
      human_realization: {
        surface_id: packet.surface_id,
        customer_prose: customerProse,
        governed_evidence_refs: writerEvidenceRefs(packet),
        generation: {
          requested_model: MODEL,
          returned_model: MODEL,
          reasoning_effort: 'xhigh',
          store: false,
          background: false,
          request_sha256: '1'.repeat(64),
          response_sha256: '2'.repeat(64),
        },
      },
      rendering: assembleAthleteSurfaceRendering({
        packet,
        humanRealization: {
          surface_id: packet.surface_id,
          customer_prose: customerProse,
          governed_evidence_refs: writerEvidenceRefs(packet),
        },
      }),
    };
  });
  assert.equal(new Set(surfacePackets.map(({ rendering }) => rendering.visual.kind)).size, 15);
  assert.equal(new Set(surfacePackets.map(({ rendering }) => rendering.headline)).size, 15);
  assert.ok(surfacePackets.every(({ label, editorial_headline: editorialHeadline, rendering, human_realization: realization }) => (
    rendering.headline !== label
    && rendering.headline === editorialHeadline
    && realization.customer_prose.includes(rendering.headline)
    && realization.customer_prose.includes(rendering.summary)
  )));
  const artifact = {
    contract: CONTRACT,
    architecture: ATHLETE_BOS_PERSONALITY_DNA_ARCHITECTURE_VERSION,
    identity,
    sourceHash,
    audience: 'athlete',
    createdAt: '2026-09-05T12:00:00.000Z',
    status: 'GENERATED_STRUCTURALLY_VALID_REQUIRES_SYNTHETIC_REVIEW',
    identity_context: { fictional: true, audience: 'athlete', subject_token: subject.id, display_name: subject.name },
    subject: { id: subject.id, name: subject.name },
    provider: ATHLETE_BOS_PROVIDER_RUNTIME,
    plan,
    whole_person_model: plan.whole_person_model,
    athlete_map: plan.athlete_map,
    evidence: subject.evidence,
    stage_receipts: ATHLETE_BOS_SEMANTIC_STAGES.map(({ id, order, dependencies }) => ({
      stage_id: id,
      order,
      dependencies,
      request_sha256: '3'.repeat(64),
      fragment_sha256: '4'.repeat(64),
      provider: {
        requestedModel: MODEL,
        returnedModel: MODEL,
        reasoningEffort: 'xhigh',
        providerPersistenceRequested: false,
        providerBackgroundRequested: false,
      },
    })),
    surface_packets: surfacePackets,
    chapters: surfacePackets.map((packet) => ({
      id: packet.surface_id,
      surface_id: packet.surface_id,
      surface_number: packet.surface_number,
      title: packet.label,
      label: packet.label,
      destination: packet.destination,
      mission: packet.local_mission,
      claimIds: packet.claim_refs,
      causalIds: packet.causal_refs,
      evidenceIds: packet.resolved_local_truth.evidence.map(({ evidence_id: evidenceId }) => evidenceId),
      unknowns: packet.resolved_local_truth.abstentions,
      human_realization: packet.human_realization,
      rendering: packet.rendering,
    })),
  };
  assert.equal(validateAthleteArtifact(artifact), artifact);
  const onlyFourteen = { ...artifact, surface_packets: artifact.surface_packets.slice(0, -1) };
  assert.throws(() => validateAthleteArtifact(onlyFourteen), /ATHLETE_SURFACE_COUNT/);
  const missingRealization = structuredClone(artifact);
  missingRealization.whole_person_model = missingRealization.plan.whole_person_model;
  missingRealization.athlete_map = missingRealization.plan.athlete_map;
  missingRealization.surface_packets[7].human_realization = null;
  assert.throws(() => validateAthleteArtifact(missingRealization), /CUSTOMER_TEXT_INVALID|ATHLETE_SURFACE_REALIZATION_INCOMPLETE/);
  const reordered = { ...artifact, surface_packets: [...artifact.surface_packets] };
  [reordered.surface_packets[0], reordered.surface_packets[1]] = [reordered.surface_packets[1], reordered.surface_packets[0]];
  assert.throws(() => validateAthleteArtifact(reordered), /ATHLETE_SURFACE_PACKET_DERIVATION_MISMATCH|ATHLETE_SURFACE_REALIZATION_INCOMPLETE/);
  const reorderedChapters = { ...artifact, chapters: [...artifact.chapters] };
  [reorderedChapters.chapters[0], reorderedChapters.chapters[1]] = [reorderedChapters.chapters[1], reorderedChapters.chapters[0]];
  assert.throws(() => validateAthleteArtifact(reorderedChapters), /ATHLETE_CHAPTER_DERIVATION_MISMATCH|ATHLETE_CHAPTER_COVERAGE/);
  const reorderedReceipts = { ...artifact, stage_receipts: [...artifact.stage_receipts] };
  [reorderedReceipts.stage_receipts[0], reorderedReceipts.stage_receipts[1]] = [reorderedReceipts.stage_receipts[1], reorderedReceipts.stage_receipts[0]];
  assert.throws(() => validateAthleteArtifact(reorderedReceipts), /ATHLETE_STAGE_RECEIPT_COVERAGE/);
  const wrongProvider = { ...artifact, provider: { ...artifact.provider, reasoning: 'low' } };
  assert.throws(() => validateAthleteArtifact(wrongProvider), /ATHLETE_ARTIFACT_PROVIDER/);
  const wrongLineage = structuredClone(artifact);
  wrongLineage.surface_packets[0].resolved_local_truth.lineage.source_hash = 'f'.repeat(64);
  assert.throws(() => validateAthleteArtifact(wrongLineage), /ATHLETE_SURFACE_PACKET_DERIVATION_MISMATCH/);
  const swappedPacketTruth = structuredClone(artifact);
  swappedPacketTruth.surface_packets[0].resolved_local_truth = structuredClone(artifact.surface_packets[1].resolved_local_truth);
  assert.throws(() => validateAthleteArtifact(swappedPacketTruth), /ATHLETE_SURFACE_PACKET_DERIVATION_MISMATCH/);
  const fabricatedPacketTruth = structuredClone(artifact);
  fabricatedPacketTruth.surface_packets[0].resolved_local_truth.evidence[0].exact_content += ' Fabricated extension.';
  assert.throws(() => validateAthleteArtifact(fabricatedPacketTruth), /ATHLETE_SURFACE_PACKET_DERIVATION_MISMATCH/);
  const tamperedChapter = structuredClone(artifact);
  tamperedChapter.chapters[0].mission += ' Changed after realization.';
  assert.throws(() => validateAthleteArtifact(tamperedChapter), /ATHLETE_CHAPTER_DERIVATION_MISMATCH/);
  const tamperedRendering = structuredClone(artifact);
  tamperedRendering.surface_packets[0].rendering.headline = 'A headline that was never in the athlete-facing prose.';
  tamperedRendering.chapters[0].rendering = tamperedRendering.surface_packets[0].rendering;
  assert.throws(() => validateAthleteArtifact(tamperedRendering), /ATHLETE_RENDERING_DERIVATION_MISMATCH/);
  const inventedEmptySurface = structuredClone(artifact);
  const emptyIndex = inventedEmptySurface.surface_packets.findIndex(packet => !athleteSurfacePacketHasPublicationSupport(packet));
  assert.notEqual(emptyIndex, -1);
  inventedEmptySurface.surface_packets[emptyIndex].human_realization.customer_prose = 'A plausible but unsupported personality story.';
  assert.throws(() => validateAthleteArtifact(inventedEmptySurface), /ATHLETE_SURFACE_EDITORIAL_HEADLINE_MISMATCH|EMPTY_SURFACE_PUBLICATION_MUST_BE_CANONICAL_ABSTENTION/);

  const duplicateHeadline = structuredClone(artifact);
  duplicateHeadline.surface_packets[1].human_realization.customer_prose = '## A GOVERNED reading—for This Is You\n\nA second surface cannot reuse the same normalized headline.';
  duplicateHeadline.surface_packets[1].rendering = assembleAthleteSurfaceRendering({
    packet: { ...duplicateHeadline.surface_packets[1], human_realization: null, rendering: null },
    humanRealization: duplicateHeadline.surface_packets[1].human_realization,
  });
  duplicateHeadline.chapters[1].human_realization = duplicateHeadline.surface_packets[1].human_realization;
  duplicateHeadline.chapters[1].rendering = duplicateHeadline.surface_packets[1].rendering;
  assert.throws(() => validateAthleteArtifact(duplicateHeadline), /ATHLETE_SURFACE_EDITORIAL_HEADLINE_MISMATCH/);
});

test('an empty surface requires explicit abstention and remains present instead of being fabricated or dropped', () => {
  const parts = fragments();
  const empty = parts.surface_routing.surface_routes.find(({ surfaceId }) => surfaceId === 'communication_dna');
  empty.abstention = '';
  assert.throws(() => validateSemanticStage('surface_routing', parts.surface_routing, subject, parts), /EMPTY_SURFACE_REQUIRES_ABSTENTION/);
  empty.abstention = 'There is not enough separate evidence to describe communication yet.';
  const plan = assembleInterpretationFromStages(parts, subject);
  const packet = buildAthleteSurfacePackets(plan, subject, 'a'.repeat(64)).find(({ surface_id }) => surface_id === 'communication_dna');
  assert.deepEqual(packet.resolved_local_truth.evidence, []);
  assert.deepEqual(packet.resolved_local_truth.resolved_claims, []);
  assert.deepEqual(packet.resolved_local_truth.abstentions, [empty.abstention]);
  const providerInput = buildAthleteSurfaceProviderInput(subject, plan, packet, 'athlete');
  assert.equal(providerInput.editorial_headline, packet.editorial_headline);
  assert.deepEqual(providerInput.local_truth.evidence, []);
  assert.deepEqual(providerInput.local_truth.domain_understanding, [empty.abstention]);
  assert.ok(!JSON.stringify(providerInput).includes(plan.whole_person_model.core_explanation));
  const customerProse = canonicalAthleteEmptySurfaceProse(packet);
  const rendering = assembleAthleteSurfaceRendering({
    packet,
    humanRealization: { surface_id: packet.surface_id, customer_prose: customerProse },
  });
  assert.equal(rendering.evidence_count, 0);
  assert.equal(rendering.abstention_visible, true);
  assert.deepEqual(rendering.visual.sequences, []);
  assert.deepEqual(rendering.visual.dynamics, []);
  assert.ok(JSON.stringify(rendering.visual).includes(empty.abstention));
  assert.ok(!JSON.stringify(rendering.visual).includes(plan.whole_person_model.core_explanation));
  assert.ok(!JSON.stringify(rendering.visual).includes(plan.recognition));
});

test('a supported Athlete domain cannot be routed as an empty adult-role-style surface', () => {
  const parts = fragments();
  const route = parts.surface_routing.surface_routes.find(({ surfaceId }) => surfaceId === 'how_you_operate');
  route.claimIds = [];
  route.causalIds = [];
  route.evidenceIds = [];
  route.abstention = 'No adult role or seat can be named.';
  assert.throws(
    () => validateSemanticStage('surface_routing', parts.surface_routing, subject, parts),
    /SUPPORTED_DOMAIN_CANNOT_HAVE_EMPTY_SURFACE_ROUTE/,
  );

  const assembled = assembleInterpretationFromStages(fragments(), subject);
  const finalRoute = assembled.surface_routes.find(({ surfaceId }) => surfaceId === 'how_you_operate');
  finalRoute.claimIds = [];
  finalRoute.causalIds = [];
  finalRoute.evidenceIds = [];
  finalRoute.abstention = 'There is not enough separate evidence to describe this area yet.';
  assert.throws(
    () => validateInterpretation(assembled, subject),
    /SUPPORTED_DOMAIN_CANNOT_HAVE_EMPTY_SURFACE_ROUTE/,
  );
});

test('surface-local truth is filtered, referentially closed, and cannot leak unrelated evidence', () => {
  const plan = assembleInterpretationFromStages(fragments({ crossSurfaceContradiction: true }), subject);
  const packets = buildAthleteSurfacePackets(plan, subject, 'b'.repeat(64));
  assert.equal(packets.length, 15);
  const operating = packets.find(({ surface_id }) => surface_id === 'how_you_operate');
  assert.deepEqual(operating.resolved_local_truth.evidence.map(({ evidence_id }) => evidence_id), ['E02']);
  assert.ok(!JSON.stringify(operating).includes(exact('E04')));
  const providerInput = buildAthleteSurfaceProviderInput(subject, plan, operating, 'athlete');
  assert.equal(providerInput.editorial_headline, operating.editorial_headline);
  assert.equal(providerInput.whole_human_understanding.core_understanding, plan.whole_person_model.core_explanation);
  assert.ok(JSON.stringify(providerInput.local_truth).includes(exact('E02')));
  assert.equal(providerInput.athlete_map, undefined);
  assert.equal(providerInput.whole_person_model, undefined);
  assert.equal(providerInput.governed_local_truth, undefined);
  assert.ok(!JSON.stringify(providerInput).includes(exact('E01')));
  assert.ok(!JSON.stringify(providerInput).includes(exact('E04')));
  for (const internalId of ['E01', 'E02', 'E04', 'K1', 'K2', 'D1', 'S1', 'O1']) {
    assert.ok(!JSON.stringify(providerInput).includes(`"${internalId}"`), `provider input leaked internal ID ${internalId}`);
  }
  for (const packet of packets) {
    const localIds = new Set(packet.resolved_local_truth.evidence.map(({ evidence_id }) => evidence_id));
    for (const contradiction of packet.resolved_local_truth.contradictions) {
      contradiction.evidence_refs.forEach((id) => assert.ok(localIds.has(id), `${packet.surface_id} dangling contradiction ${id}`));
    }
    for (const item of packet.resolved_local_truth.counterevidence) assert.ok(localIds.has(item.evidence_id));
  }
});

test('surface evidence preserves the exact intake question around structured answers without restoring the full report payload', () => {
  const subjectWithQuestion = structuredClone(subject);
  subjectWithQuestion.responses = { E02: { wording: 'What was different about this arrival?' } };
  const plan = assembleInterpretationFromStages(fragments(), subjectWithQuestion);
  const packet = buildAthleteSurfacePackets(plan, subjectWithQuestion, '9'.repeat(64))
    .find(({ surface_id }) => surface_id === 'how_you_operate');
  assert.equal(packet.resolved_local_truth.evidence[0].question_context, 'What was different about this arrival?');
  const providerInput = buildAthleteSurfaceProviderInput(subjectWithQuestion, plan, packet, 'athlete');
  assert.deepEqual(providerInput.local_truth.evidence[0], {
    question: 'What was different about this arrival?',
    answer: exact('E02'),
    source_kind: 'self report',
    event_time: packet.resolved_local_truth.evidence[0].event_time,
    event_connection: 'This answer begins its own described event unless its words explicitly say otherwise.',
  });
  const formerOversizedShape = {
    athlete_map: plan.athlete_map,
    whole_person_model: plan.whole_person_model,
    governed_local_truth: packet.resolved_local_truth,
  };
  assert.ok(JSON.stringify(providerInput).length < JSON.stringify(formerOversizedShape).length);
  assert.equal(providerInput.athlete_map, undefined);
  assert.equal(providerInput.governed_local_truth, undefined);
});

test('zero through five conditional Futures are valid; six, invented goals, and undecided goals fail or abstain safely', () => {
  for (let count = 0; count <= 5; count += 1) {
    const plan = assembleInterpretationFromStages(fragments({ futureCount: count }), subject);
    assert.equal(plan.futures.length, count);
    assert.doesNotThrow(() => validateInterpretation(plan, subject));
    if (count === 0) {
      const route = plan.surface_routes.find(({ surfaceId }) => surfaceId === 'five_futures');
      assert.deepEqual({ claimIds: route.claimIds, causalIds: route.causalIds, evidenceIds: route.evidenceIds }, { claimIds: [], causalIds: [], evidenceIds: [] });
      assert.ok(route.abstention);
      assert.ok(plan.chapters.find(({ id }) => id === 'five_futures').unknowns.includes(route.abstention));
    }
  }
  const tooMany = assembleInterpretationFromStages(fragments({ futureCount: 5 }), subject);
  tooMany.futures.push(future(6));
  assert.throws(() => validateInterpretation(tooMany, subject), /ATHLETE_PLAN_SHAPE/);
  const duplicate = assembleInterpretationFromStages(fragments({ futureCount: 2 }), subject);
  duplicate.futures[1] = { ...structuredClone(duplicate.futures[0]), title: 'A different title cannot disguise the same path.', condition: `${duplicate.futures[0].condition}   ` };
  assert.throws(() => validateInterpretation(duplicate, subject), /DUPLICATE_FUTURE_PATH/);
  const invented = assembleInterpretationFromStages(fragments(), subject);
  invented.futures[0].athleteGoalId = 'someone-else';
  assert.throws(() => resolveFutureReadiness(invented, subject), /FUTURE_GOAL_REFERENCE_MISSING/);
  const undecidedParts = fragments();
  undecidedParts.causal_foundation.goals[0].authorship = 'athlete_undecided';
  const undecided = assembleInterpretationFromStages(undecidedParts, subject);
  const before = structuredClone(undecided);
  const resolved = resolveFutureReadiness(undecided, subject);
  assert.equal(resolved.plan.futures.length, 0);
  assert.equal(resolved.receipt.status, 'PARTIAL_PROJECTION_WITH_EXPLICIT_ABSTENTION');
  assert.equal(resolved.receipt.deferred.length, 1);
  const futureRoute = resolved.plan.surface_routes.find(({ surfaceId }) => surfaceId === 'five_futures');
  const futureChapter = resolved.plan.chapters.find(({ id }) => id === 'five_futures');
  assert.match(futureRoute.abstention, /not become your chosen goal/i);
  assert.ok(futureChapter.unknowns.includes(futureRoute.abstention));
  const futurePacket = buildAthleteSurfacePackets(resolved.plan, subject, 'e'.repeat(64)).find(({ surface_id }) => surface_id === 'five_futures');
  assert.deepEqual(futurePacket.resolved_local_truth.abstentions, [futureRoute.abstention]);
  assert.deepEqual(undecided, before);
});

test('direct athlete life direction is either used in a grounded Future or explicitly held open', () => {
  const lifeSubject = structuredClone(subject);
  lifeSubject.lifeHopes = { status: 'ANSWERED', evidenceIds: ['E01'] };

  const heldOpenParts = fragments();
  heldOpenParts.causal_foundation.lifeHopes = {
    status: 'athlete_expressed',
    meaning: 'Nia directly described a hoped-for life direction.',
    evidenceIds: ['E01'],
  };
  heldOpenParts.whole_person_decision_synthesis.life_direction_futures_disposition = {
    status: 'held_open_insufficient_evidence',
    explanation: 'The direction matters, but the current Future stays tied to the nearer athlete-chosen goal.',
    evidenceIds: ['E01'],
  };
  assert.doesNotThrow(() => validateInterpretation(assembleInterpretationFromStages(heldOpenParts, lifeSubject), lifeSubject));

  const usedParts = structuredClone(heldOpenParts);
  usedParts.whole_person_decision_synthesis.life_direction_futures_disposition.status = 'used_in_future';
  assert.doesNotThrow(() => validateInterpretation(assembleInterpretationFromStages(usedParts, lifeSubject), lifeSubject));

  const ungrounded = assembleInterpretationFromStages(usedParts, lifeSubject);
  ungrounded.goals[0].evidenceIds = ['E02'];
  assert.throws(() => validateInterpretation(ungrounded, lifeSubject), /ATHLETE_FUTURES_MUST_INCLUDE_DIRECT_LIFE_DIRECTION/);
});

test('same-event derivatives cannot be counted as two roots for a durable tendency', () => {
  const sameEventSubject = structuredClone(subject);
  sameEventSubject.evidence = [
    { ...subject.evidence[0], id: 'C04', rootId: 'C04', text: 'I packed the night before.' },
    { ...subject.evidence[1], id: 'C05', rootId: 'C04', text: 'I finished the same packing plan.' },
  ];
  sameEventSubject.lifeHopes = { status: 'NOT_ASKED', evidenceIds: [] };
  const plan = {
    title: '', recognition: '',
    lifeHopes: { status: 'not_asked', meaning: '', evidenceIds: [] },
    goals: [],
    claims: [{
      id: 'K1', statement: 'This is a durable preparation tendency.', layer: 'relatively_durable_tendency', confidence: 'bounded_inference',
      support: [
        { evidenceId: 'C04', exactSpan: 'I packed the night before.' },
        { evidenceId: 'C05', exactSpan: 'I finished the same packing plan.' },
      ],
      counterEvidenceIds: [], alternatives: [], whatWouldChangeIt: 'If a comparable separate event differs, this claim should change.',
    }],
    causal_dynamics: [], sequences: [], strengths_and_overuse: [], compensations: [],
    contradictions: [], domains: [], whole_person_model: null, athlete_map: null, chapters: [], futures: [], move: move('abstain'), unknowns: [], surface_routes: [],
  };
  assert.throws(() => validateInterpretation(plan, sameEventSubject, { allowIncompleteArchitecture: true }), /DURABLE_TENDENCY_REQUIRES_FOUR_SEPARATE_EVENTS/);
});
