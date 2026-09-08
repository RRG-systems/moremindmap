import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { DEFAULT_ATHLETE_APA_QUESTIONS, FICTIONAL_NORTHSTAR_QUESTIONS, validateQuestionSet } from '../src/lib/athleteApaV1/questions.js'
import { DEFAULT_MORE_ATHLETE_CASSETTE, FICTIONAL_NORTHSTAR_CASSETTE, getAthleteApaCassette } from '../src/lib/athleteApaV1/cassettes.js'
import { SYNTHETIC_FIXTURES } from '../src/lib/athleteApaV1/fixtures.js'
import { SYNTHETIC_MARA_SHARED_BOS_PROJECTION } from '../src/lib/athleteApaV1/bosProjection.js'
import { ATHLETE_APA_CASSETTE_INTERFACE, ATHLETE_CURRENT_REALITY_CONTRACT, assertSafeCustomerArtifact, portableStateHash, semanticCurrentReality } from '../src/lib/athleteApaV1/contract.js'
import { fuseAthleteBosAndApa } from '../src/lib/athleteApaV1/fusion.js'
import { buildSyntheticAthleteApa, compareCassettePortability } from '../src/lib/athleteApaV1/build.js'
import { filterAudience, getFixture } from '../api/engine/athleteBosV1/fixtures.js'

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex')

test('default intake freezes exactly 14 high-yield joint questions with 10 narrative questions', () => {
  validateQuestionSet(DEFAULT_ATHLETE_APA_QUESTIONS)
  assert.equal(DEFAULT_ATHLETE_APA_QUESTIONS.length, 14)
  assert.equal(DEFAULT_ATHLETE_APA_QUESTIONS.filter((question) => question.responseShape === 'narrative').length, 10)
  assert.ok(DEFAULT_ATHLETE_APA_QUESTIONS.every((question) => ['athlete', 'instructor', 'joint', 'separate-both'].includes(question.mode)))
})

test('intake preserves separate athlete, instructor, joint, objective and missing evidence targets', () => {
  const targets = new Set(DEFAULT_ATHLETE_APA_QUESTIONS.flatMap((question) => question.evidenceTargets))
  for (const required of ['athlete_goal', 'instructor_priority', 'shared_goal', 'source_difference', 'objective_evidence', 'missing_evidence']) assert.ok(targets.has(required), required)
  const all = JSON.stringify(DEFAULT_ATHLETE_APA_QUESTIONS)
  assert.doesNotMatch(all, /personality score|talent|scholarship probability|medical clearance|real estate|listing/iu)
})

test('fictional alternate cassette uses 12 distinct prompts behind the same interface', () => {
  validateQuestionSet(FICTIONAL_NORTHSTAR_QUESTIONS)
  assert.equal(FICTIONAL_NORTHSTAR_QUESTIONS.length, 12)
  assert.equal(DEFAULT_MORE_ATHLETE_CASSETTE.interface, ATHLETE_APA_CASSETTE_INTERFACE)
  assert.equal(FICTIONAL_NORTHSTAR_CASSETTE.interface, ATHLETE_APA_CASSETTE_INTERFACE)
  assert.notDeepEqual(DEFAULT_ATHLETE_APA_QUESTIONS.map((question) => question.prompt), FICTIONAL_NORTHSTAR_QUESTIONS.map((question) => question.prompt))
  assert.doesNotMatch(JSON.stringify(FICTIONAL_NORTHSTAR_CASSETTE), /Lisa|Beyond Today/iu)
})

test('both cassettes normalize into the same governed semantic current reality', () => {
  const a = DEFAULT_MORE_ATHLETE_CASSETTE.normalize(SYNTHETIC_FIXTURES[DEFAULT_MORE_ATHLETE_CASSETTE.id])
  const b = FICTIONAL_NORTHSTAR_CASSETTE.normalize(SYNTHETIC_FIXTURES[FICTIONAL_NORTHSTAR_CASSETTE.id])
  assert.equal(a.contract, ATHLETE_CURRENT_REALITY_CONTRACT)
  assert.equal(b.contract, ATHLETE_CURRENT_REALITY_CONTRACT)
  assert.deepEqual(semanticCurrentReality(a), semanticCurrentReality(b))
  assert.equal(compareCassettePortability().normalizedSemanticsEqual, true)
})

test('agreement cannot be inferred or manufactured', () => {
  const fixture = structuredClone(SYNTHETIC_FIXTURES['more-athlete-default-v1'])
  fixture.responses.find((response) => response.questionId === 'APA04').atoms[0].explicitAgreement = false
  assert.throws(() => DEFAULT_MORE_ATHLETE_CASSETTE.normalize(fixture), /AGREEMENT_MUST_BE_EXPLICIT/)
})

test('speaker and evidence provenance survive normalization', () => {
  const apa = DEFAULT_MORE_ATHLETE_CASSETTE.normalize(SYNTHETIC_FIXTURES['more-athlete-default-v1'])
  const athlete = apa.claims.find((claim) => claim.topic === 'athlete_goal')
  const observed = apa.claims.find((claim) => claim.sourceClass === 'INSTRUCTOR_OBSERVATION')
  const record = apa.claims.find((claim) => claim.sourceClass === 'OBJECTIVE_RECORD')
  assert.equal(athlete.actor, 'athlete')
  assert.equal(observed.actor, 'instructor')
  assert.equal(record.actor, 'qualified-record')
  assert.equal(record.recordRef, 'fictional-chart-vb-20260831')
  assert.ok(record.provenance.questionId)
})

test('unresolved disagreement and missing evidence are different states', () => {
  const apa = DEFAULT_MORE_ATHLETE_CASSETTE.normalize(SYNTHETIC_FIXTURES['more-athlete-default-v1'])
  assert.equal(apa.contradictions.length, 1)
  assert.equal(apa.contradictions[0].status, 'UNRESOLVED')
  assert.equal(apa.missingEvidence.length, 2)
  assert.ok(apa.missingEvidence.every((item) => item.status === 'MISSING'))
})

test('BOS shared projection is exact, narrow and carries no raw or private evidence', async () => {
  const source = filterAudience(getFixture('synthetic-athlete-mara'), 'coach', '2026-09-04T12:00:00-07:00')
  const expectedClaims = new Map([
    ['C05', { statement: 'Mara directly requested clear identification of the first drill.', evidenceIds: ['E05'] }],
    ['C06', { statement: 'Mara directly requested a clear meeting place.', evidenceIds: ['E05'] }],
  ])
  assert.equal(SYNTHETIC_MARA_SHARED_BOS_PROJECTION.sourceArtifactSha256, '87b36514847eaa143402e394ce413ab36c062b8d46db9047e0c6974af5ca58a5')
  assert.equal(SYNTHETIC_MARA_SHARED_BOS_PROJECTION.sourceArtifactIdentity, 'cb0eed649d6e28f01a9b106e5ceaad7674dc9817c4aac3d934bf6d7d36600f6b')
  assert.equal(source.id, SYNTHETIC_MARA_SHARED_BOS_PROJECTION.subjectId)
  for (const projected of SYNTHETIC_MARA_SHARED_BOS_PROJECTION.claims) {
    const exact = expectedClaims.get(projected.sourceClaimId)
    assert.equal(projected.statement, exact.statement)
    assert.deepEqual(projected.evidenceIds, exact.evidenceIds)
    assert.ok(projected.evidenceIds.every((id) => source.evidence.some((evidence) => evidence.id === id)))
  }
  assert.equal(SYNTHETIC_MARA_SHARED_BOS_PROJECTION.rawEvidenceIncluded, false)
  assert.doesNotMatch(JSON.stringify(SYNTHETIC_MARA_SHARED_BOS_PROJECTION), /called passive|home responsibility|feel able to question|E01|E03|E04/iu)
})

test('BOS and APA fuse without collapsing authority or claiming personality causation', () => {
  const apa = DEFAULT_MORE_ATHLETE_CASSETTE.normalize(SYNTHETIC_FIXTURES['more-athlete-default-v1'])
  const fused = fuseAthleteBosAndApa({ bosProjection: SYNTHETIC_MARA_SHARED_BOS_PROJECTION, apa })
  assert.equal(fused.boundaries.bosRemainsDistinct, true)
  assert.equal(fused.boundaries.apaRemainsDistinct, true)
  assert.equal(fused.boundaries.personalityCausedPerformance, false)
  assert.equal(fused.contextualHypotheses[0].causeEstablished, false)
  assert.ok(fused.contextualHypotheses[0].alternatives.length >= 2)
})

test('fusion refuses cross-subject, wrong-purpose, writable or expired-at-snapshot projection', () => {
  const apa = DEFAULT_MORE_ATHLETE_CASSETTE.normalize(SYNTHETIC_FIXTURES['more-athlete-default-v1'])
  for (const mutate of [
    (bos) => { bos.apaSubjectId = 'synthetic-someone-else' },
    (bos) => { bos.purpose = 'selection' },
    (bos) => { bos.authorization.writable = true },
    (bos) => { bos.asOf = '2026-10-01T00:00:00-07:00' },
  ]) {
    const bos = structuredClone(SYNTHETIC_MARA_SHARED_BOS_PROJECTION)
    mutate(bos)
    assert.throws(() => fuseAthleteBosAndApa({ bosProjection: bos, apa }))
  }
})

test('artifact has five native destinations but Futures are conditional and carry no youth score', () => {
  const artifact = buildSyntheticAthleteApa()
  assert.deepEqual(Object.keys(artifact.boxes), ['currentReality', 'futures', 'oneMove', 'plan', 'evidence'])
  assert.ok(artifact.boxes.futures.length <= 5)
  assert.ok(artifact.boxes.futures.every((future) => future.outcomePrediction === false && future.selectionMeaning === false && future.falsifier && future.uncertainty))
  assert.doesNotMatch(JSON.stringify(artifact.boxes.futures), /probability|percentile|talent score|rank/iu)
})

test('One Move remains a reversible suggestion, not a commitment or outcome', () => {
  const move = buildSyntheticAthleteApa().boxes.oneMove
  assert.equal(move.acceptanceState, 'NOT_ACCEPTED')
  assert.equal(move.executionState, 'NOT_RECORDED')
  assert.equal(move.outcomeState, 'NOT_RECORDED')
  assert.equal(move.causalConfidence, 'NOT_ASSESSED')
  assert.match(move.reversibility, /pause|decline|change/iu)
  assert.ok(move.confounders.length >= 4)
})

test('plan is an observation plan and not the adult 1-3-5 completeness contract', () => {
  const plan = buildSyntheticAthleteApa().boxes.plan
  assert.equal(plan.status, 'PROPOSED_NOT_ACCEPTED')
  assert.equal(plan.steps.length, 4)
  assert.doesNotMatch(JSON.stringify(plan), /1.?3.?5|three ways|five strategies|annual revenue/iu)
})

test('generated customer artifact contains no private BOS detail or unsafe selection language', () => {
  const artifact = buildSyntheticAthleteApa()
  assert.doesNotThrow(() => assertSafeCustomerArtifact(artifact))
  assert.doesNotMatch(JSON.stringify(artifact), /called passive|home responsibility|feel able to question|scholarship|professional future/iu)
})

test('synthetic build is pure, provider-free, persistence-free and does not build Consult', () => {
  const artifact = buildSyntheticAthleteApa()
  assert.deepEqual(artifact.guarantees, {
    syntheticOnly: true,
    noPersistence: true,
    noProviderCall: true,
    noCustomerMutation: true,
    bosAndApaAuthoritiesDistinct: true,
    noPersonalityPerformanceCausation: true,
    futuresAreConditionalNotPredictions: true,
    oneMoveIsSuggestionNotCommitment: true,
    downstreamConsultNotBuilt: true,
  })
})

test('state identity binds cassette, response evidence and source state', () => {
  const baseline = buildSyntheticAthleteApa()
  const otherCassette = buildSyntheticAthleteApa('fictional-northstar-v1')
  assert.notEqual(baseline.artifactHash, otherCassette.artifactHash)
  const fixture = structuredClone(SYNTHETIC_FIXTURES['more-athlete-default-v1'])
  fixture.responses[0].voices[0].text += ' Changed.'
  const changed = getAthleteApaCassette('more-athlete-default-v1').normalize(fixture)
  assert.notEqual(changed.stateHash, baseline.boxes.currentReality.stateHash)
  assert.equal(portableStateHash({ stable: true }), portableStateHash({ stable: true }))
})

test('current canonical Business Twin stylesheet remains byte-identical and the production OneShot route mounts the shared renderer', async () => {
  assert.equal(sha256(await fs.readFile('src/lab/baProgressiveDisclosureV1/styles.css')), 'd8f3c151c450a6ff054e78da6a17ec3f9d38dfedd72fe5c1ddc3eb361cfb890b')
  const [mainEntry, oneShot, routeGate] = await Promise.all([
    fs.readFile('src/main.jsx', 'utf8'),
    fs.readFile('src/athleteLivingConsultOneShotV1/App.jsx', 'utf8'),
    fs.readFile('middleware.js', 'utf8'),
  ])
  assert.match(mainEntry, /path="\/athlete-consulting-tool\/demo" element=\{<AthleteLivingConsultOneShotV1App \/>\}/u)
  assert.match(oneShot, /BusinessTwinApp viewModel=\{viewModel\} onContextChange=\{onContextChange\}/u)
  assert.match(routeGate, /ATHLETE_CONSULTING_DARREN_DEMO_ENABLED === 'true'/u)
  assert.doesNotMatch(mainEntry, /visual-lab\/athlete-apa|VITE_ATHLETE_APA/iu)
})
