import { assert, assertSafeCustomerArtifact, portableStateHash, validateCurrentReality } from './contract.js'
import { getAthleteApaCassette } from './cassettes.js'
import { SYNTHETIC_FIXTURES } from './fixtures.js'
import { SYNTHETIC_MARA_SHARED_BOS_PROJECTION } from './bosProjection.js'
import { fuseAthleteBosAndApa } from './fusion.js'

const first = (apa, topic, actor = null) => apa.claims.find((claim) => claim.topic === topic && (!actor || claim.actor === actor))

function makeFutures(fused) {
  const apa = fused.currentReality
  const ids = (...claims) => claims.filter(Boolean).map((claim) => claim.id)
  const athleteGap = first(apa, 'current_gap', 'athlete')
  const instructorGap = first(apa, 'current_gap', 'instructor')
  const attempt = first(apa, 'current_attempt')
  const athleteChange = first(apa, 'recent_change', 'athlete')
  const instructorChange = first(apa, 'recent_change', 'instructor')
  const objective = first(apa, 'objective_evidence')
  const persistentGap = first(apa, 'persistent_gap')
  return [
    {
      id: 'future-current-course', role: 'current_course', label: 'Current Course', support: 'Supported now',
      meaning: 'The start of practice remains inconsistent while serve-receive development is still being established.',
      condition: 'The current cue is used unevenly and no comparable live-play baseline is added.',
      supporting: ids(athleteGap, instructorGap, persistentGap), counterevidence: ids(athleteChange),
      falsifier: 'Consistent cue delivery plus repeated comparable observations show the early pause no longer occurs.',
      uncertainty: 'The cause of the pause and the direction of live-play performance remain unresolved.',
    },
    {
      id: 'future-emerging', role: 'emerging_future', label: 'Emerging Future', support: 'Emerging',
      meaning: 'Clear first-rep information makes the opening of practice easier to enter.',
      condition: 'The first assignment is clearly delivered and received across comparable practices.',
      supporting: ids(attempt, athleteChange, instructorChange), counterevidence: ids(instructorGap),
      falsifier: 'Clear information is delivered and received repeatedly, but the same early pause remains.',
      uncertainty: 'Two cued practices are not enough to establish a stable change or its cause.',
    },
    {
      id: 'future-better', role: 'better_future', label: 'Better Future', support: 'Possible',
      meaning: 'Serve reception becomes more repeatable in controlled drills.',
      condition: 'Practice stays comparable, the athlete receives useful reps, and the observed pattern repeats.',
      supporting: ids(objective, first(apa, 'athlete_focus'), first(apa, 'instructor_focus')), counterevidence: ids(persistentGap),
      falsifier: 'Comparable controlled-drill records do not improve or vary without a stable pattern.',
      uncertainty: 'The current 17-of-24 record has no comparable baseline.',
    },
    {
      id: 'future-bold', role: 'bold_future', label: 'Bold Future', support: 'Open',
      meaning: 'Useful practice learning begins to transfer into live play.',
      condition: 'A repeatable controlled-drill pattern is followed by comparable live-play evidence.',
      supporting: ids(first(apa, 'current_asset', 'athlete'), first(apa, 'current_asset', 'instructor')), counterevidence: ids(persistentGap),
      falsifier: 'Controlled-drill improvement appears but does not transfer across comparable live-play situations.',
      uncertainty: 'No comparable live-play evidence exists yet. This is a conditional possibility, not a prediction.',
    },
    {
      id: 'future-downside', role: 'downside_future', label: 'Downside Future', support: 'Watch',
      meaning: 'A label gets attached to an unresolved moment before the conditions are understood.',
      condition: 'The sources stay unresolved and conclusions are drawn without testing receipt, timing, or changing drills.',
      supporting: ids(athleteGap, instructorGap), counterevidence: ids(attempt),
      falsifier: 'The athlete and instructor reconstruct the event, test the relevant conditions, and revise the interpretation from shared evidence.',
      uncertainty: 'The present sources support caution, not a conclusion about anyone’s intent or character.',
    },
  ].map((future) => ({ ...future, outcomePrediction: false, selectionMeaning: false }))
}

function makeOneMove(fused) {
  const apa = fused.currentReality
  const evidenceIds = [first(apa, 'current_attempt'), first(apa, 'execution_state'), first(apa, 'current_gap', 'athlete'), first(apa, 'current_gap', 'instructor')].filter(Boolean).map((claim) => claim.id)
  return {
    id: 'move-three-practice-clarity-check',
    kind: 'REVERSIBLE_OBSERVATION_PROPOSAL',
    title: 'Run a three-practice first-rep clarity check.',
    purpose: 'Learn whether clear first-assignment information changes the start of comparable practices.',
    suggestion: 'Before three comparable practices, name the first assignment clearly. Record whether it was delivered, received, and understood; then separately note what happened at the first rep.',
    why: 'This tests a narrow, shared question without turning the current pause into a trait or promising performance improvement.',
    evidenceIds,
    acceptanceState: 'NOT_ACCEPTED',
    executionState: 'NOT_RECORDED',
    outcomeState: 'NOT_RECORDED',
    burden: 'Three short setup and review moments.',
    reversibility: 'The athlete can pause, decline, or change the check at any time.',
    observationWindow: 'Three comparable practices.',
    confounders: ['A late drill change', 'A message not received', 'A different role or group', 'An active instruction to wait', 'No comparable first rep'],
    falsifier: 'If the first assignment is clearly delivered and received and the same pause remains, the clarity hypothesis is weakened.',
    stopOrAdjust: 'Stop if the athlete declines, the check becomes evaluative, a health question appears, or the practices are not comparable.',
    causalConfidence: 'NOT_ASSESSED',
  }
}

function makeObservationPlan(apa, move) {
  return {
    title: 'A small plan to learn, not a promise to perform.',
    goal: first(apa, 'athlete_goal')?.statement,
    status: 'PROPOSED_NOT_ACCEPTED',
    steps: [
      { id: 'plan-01', title: 'Before practice', text: 'Name the first assignment early enough for Mara to receive it.' },
      { id: 'plan-02', title: 'Check receipt', text: 'Ask privately whether the assignment is clear; do not require a public challenge.' },
      { id: 'plan-03', title: 'Observe separately', text: 'Record delivery, receipt, active instructions, and first-rep behavior as different facts.' },
      { id: 'plan-04', title: 'Review together', text: 'After three comparable practices, decide together whether to continue, change, or stop.' },
    ],
    moveId: move.id,
    guardrail: 'Nothing on this page is an accepted commitment, selection decision, health direction, or prediction.',
  }
}

function makeEvidence(apa, fused) {
  const sourceCounts = Object.fromEntries(apa.claims.reduce((counts, claim) => counts.set(claim.sourceClass, (counts.get(claim.sourceClass) || 0) + 1), new Map()))
  return {
    sourceCounts,
    ledger: apa.claims.map((claim) => ({
      id: claim.id,
      topic: claim.topic,
      statement: claim.statement,
      sourceClass: claim.sourceClass,
      actor: claim.actor,
      status: claim.epistemicStatus,
      confidence: claim.confidence,
      provenance: claim.provenance,
    })),
    contradictions: apa.contradictions,
    missing: apa.missingEvidence,
    bosClaims: fused.bosContext,
    fusionHypotheses: fused.contextualHypotheses,
  }
}

export function buildSyntheticAthleteApa(cassetteId = 'more-athlete-default-v1') {
  const cassette = getAthleteApaCassette(cassetteId)
  const fixture = SYNTHETIC_FIXTURES[cassetteId]
  assert(fixture, 'ATHLETE_APA_FIXTURE_NOT_FOUND')
  const currentReality = cassette.normalize(fixture)
  validateCurrentReality(currentReality)
  const fused = fuseAthleteBosAndApa({ bosProjection: SYNTHETIC_MARA_SHARED_BOS_PROJECTION, apa: currentReality })
  const futures = makeFutures(fused)
  assert(futures.length >= 0 && futures.length <= 5, 'ATHLETE_APA_FUTURES_CARDINALITY_INVALID')
  const oneMove = makeOneMove(fused)
  const plan = makeObservationPlan(currentReality, oneMove)
  const evidence = makeEvidence(currentReality, fused)
  const artifact = {
    contract: 'athlete-apa-synthetic-artifact-v1',
    version: '1.0.0-synthetic',
    subject: structuredClone(currentReality.subject),
    relationship: structuredClone(currentReality.relationship),
    asOf: currentReality.asOf,
    cassette: {
      ...currentReality.cassetteBinding,
      box1Vocabulary: structuredClone(cassette.box1Vocabulary),
      questionCount: cassette.questions.length,
    },
    source: {
      currentRealityHash: currentReality.stateHash,
      bosArtifactIdentity: SYNTHETIC_MARA_SHARED_BOS_PROJECTION.sourceArtifactIdentity,
      bosSourceStateHash: SYNTHETIC_MARA_SHARED_BOS_PROJECTION.sourceStateHash,
      fusionHash: fused.stateHash,
    },
    boxes: {
      currentReality,
      futures,
      oneMove,
      plan,
      evidence,
    },
    fusion: fused,
    guarantees: {
      syntheticOnly: true,
      noPersistence: true,
      noProviderCall: true,
      noCustomerMutation: true,
      bosAndApaAuthoritiesDistinct: true,
      noPersonalityPerformanceCausation: true,
      futuresAreConditionalNotPredictions: true,
      oneMoveIsSuggestionNotCommitment: true,
      downstreamConsultNotBuilt: true,
    },
  }
  artifact.artifactHash = portableStateHash(artifact)
  return assertSafeCustomerArtifact(artifact)
}

export function compareCassettePortability() {
  const defaultArtifact = buildSyntheticAthleteApa('more-athlete-default-v1')
  const alternateArtifact = buildSyntheticAthleteApa('fictional-northstar-v1')
  const normalized = (artifact) => ({
    semanticClaims: artifact.boxes.currentReality.claims.map(({ topic, statement, sourceClass, actor, epistemicStatus }) => ({ topic, statement, sourceClass, actor, epistemicStatus })).sort((a, b) => a.statement.localeCompare(b.statement)),
    contradictions: artifact.boxes.currentReality.contradictions.map(({ topic, statement, status }) => ({ topic, statement, status })),
    missing: artifact.boxes.currentReality.missingEvidence.map(({ topic, statement, status }) => ({ topic, statement, status })).sort((a, b) => a.statement.localeCompare(b.statement)),
    futureMeanings: artifact.boxes.futures.map((future) => future.meaning),
    move: artifact.boxes.oneMove.title,
  })
  return {
    contract: 'athlete-apa-cassette-portability-proof-v1',
    defaultCassette: defaultArtifact.cassette,
    alternateCassette: alternateArtifact.cassette,
    normalizedSemanticsEqual: JSON.stringify(normalized(defaultArtifact)) === JSON.stringify(normalized(alternateArtifact)),
    defaultArtifactHash: defaultArtifact.artifactHash,
    alternateArtifactHash: alternateArtifact.artifactHash,
    unchangedDownstreamContracts: ['athlete-current-reality-v1', 'athlete-bos-apa-fusion-v1', 'athlete-apa-synthetic-artifact-v1'],
  }
}
