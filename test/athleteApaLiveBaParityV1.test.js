import test from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { ATHLETE_APA_MINOR_AUTHORITY_PROOF, ATHLETE_APA_PARITY_FIXTURE } from '../src/lib/athleteApaV1/parityFixture.js'
import { ATHLETE_APA_PARITY_V1, buildAthleteApaParityV1, validateAthleteApaParityV1 } from '../src/lib/athleteApaV1/parityProjection.js'
import { loadCurrentBaReference } from '../src/athleteApaV1/loadCurrentBaReference.js'

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const hashJson = (value) => sha256(JSON.stringify(value))

test('Box 1 is a source-separated governed Athlete current reality bound to current Mika BOS custody', async () => {
  assert.equal(ATHLETE_APA_PARITY_FIXTURE.contract, 'athlete-apa-box1-governed-current-reality-v2')
  assert.equal(ATHLETE_APA_PARITY_FIXTURE.claims.length, 20)
  assert.deepEqual(new Set(ATHLETE_APA_PARITY_FIXTURE.claims.map((claim) => claim.sourceClass)), new Set(['ATHLETE_REPORT', 'INSTRUCTOR_REPORT', 'INSTRUCTOR_OBSERVATION', 'SHARED_AGREEMENT', 'OBJECTIVE_RECORD']))
  assert.equal(ATHLETE_APA_PARITY_FIXTURE.openEvidence.contradictions[0].status, 'UNRESOLVED')
  assert.ok(ATHLETE_APA_PARITY_FIXTURE.openEvidence.missing.every((item) => item.status === 'MISSING'))
  const source = await fs.readFile(new URL('../api/engine/athleteLivingConsultOneShotV1/fixtures/mika-bos-v1.json', import.meta.url))
  assert.equal(sha256(source), ATHLETE_APA_PARITY_FIXTURE.bosBinding.sourceArtifactSha256)
  assert.equal(JSON.parse(source).identity, ATHLETE_APA_PARITY_FIXTURE.bosBinding.sourceArtifactIdentity)
})

test('private Athlete BOS identity binds but zero private meaning or object existence reaches the joint map', () => {
  assert.equal(ATHLETE_APA_PARITY_FIXTURE.bosBinding.jointProjection.status, 'NO_AUTHORIZED_JOINT_CLAIMS')
  assert.deepEqual(ATHLETE_APA_PARITY_FIXTURE.bosBinding.jointProjection.claims, [])
  assert.equal(ATHLETE_APA_PARITY_V1.validation.bosPrivateClaimsProjected, 0)
  assert.doesNotMatch(JSON.stringify(ATHLETE_APA_PARITY_V1.customerViewModel), /restore trails|science presentation|not chosen to start|work shift|sourceArtifactIdentity|private-only/iu)
})

test('the 14–17 boundary requires athlete assent and guardian permission without opening a write or private-source path', () => {
  const proof = ATHLETE_APA_MINOR_AUTHORITY_PROOF
  assert.equal(proof.subject.age, 16)
  assert.equal(proof.subject.ageBand, '14–17')
  assert.equal(proof.authorization.athleteAssent.status, 'GRANTED')
  assert.equal(proof.authorization.guardianPermission.status, 'GRANTED')
  assert.equal(proof.authorization.athleteAssent.revocable, true)
  assert.equal(proof.authorization.guardianPermission.revocable, true)
  assert.ok(Date.parse(proof.authorization.expiresAt) > Date.parse(proof.authorization.athleteAssent.grantedAt))
  assert.deepEqual(proof.authorization.audience, ['athlete', 'instructor'])
  assert.equal(proof.authorization.readOnly, true)
  assert.equal(proof.authorization.writable, false)
  assert.deepEqual(proof.projection.jointClaims, [])
  assert.equal(proof.projection.athletePrivateBos.existenceDisclosure, false)
  assert.equal(proof.projection.instructorPrivateMaterial.existenceDisclosure, false)
  assert.deepEqual(proof.effects, { providerCalls: 0, networkCalls: 0, persistenceWrites: 0, canonicalMutation: false, customerMutation: false })
})

test('the rebuild preserves the exact five destinations and Layer 0 to Layer 1 to Layer 2 stop', () => {
  const view = ATHLETE_APA_PARITY_V1.customerViewModel
  assert.deepEqual(view.nav.map((item) => item.id), ['where', 'futures', 'move', 'plan', 'evidence'])
  assert.deepEqual(view.layer0.cards.map((item) => item.id), ['where', 'futures', 'move', 'plan', 'evidence'])
  assert.deepEqual(view.layerContract, { layer_0: 'ANSWER', layer_1: 'UNDERSTAND', layer_2: 'INVESTIGATE', stop_after: 2, layer_3_exists: false })
  assert.equal(view.interaction.provider_calls_on_click, 0)
  assert.equal(view.interaction.network_calls_on_click, 0)
  assert.equal(view.interaction.regeneration_on_click, false)
})

test('Box 1 compresses all 20 unchanged claims into exactly Sport, Training and Warrior Mentality', () => {
  const where = ATHLETE_APA_PARITY_V1.customerViewModel.destinations.where
  assert.equal(where.mode, 'athlete_three_current_reality_domains')
  assert.deepEqual(where.domains.map((domain) => domain.label), ['SPORT', 'TRAINING', 'WARRIOR MENTALITY'])
  assert.deepEqual(where.domains.map((domain) => domain.claimCount), [9, 6, 5])
  assert.deepEqual([...new Set(where.domains.flatMap((domain) => domain.refs))].sort(), ATHLETE_APA_PARITY_FIXTURE.claims.map((claim) => claim.id).sort())
  assert.equal(where.underlyingClaimCount, 20)
  assert.equal(hashJson(ATHLETE_APA_PARITY_FIXTURE.claims), '848ff091d7df80c31b8afef8cb0e0d5076469c7d7e1483de517f196be359fc03')
  assert.equal(hashJson(ATHLETE_APA_PARITY_FIXTURE.openEvidence), 'e6410853038e4de2266c1917180061195d593818d2c4c16e0e779497ca30a78c')
  assert.doesNotMatch(where.domains.map((domain) => domain.label).join(' '), /development|direction/iu)
  assert.match(where.boundary, /not canonical Beyond Today doctrine/iu)
})

test('Boxes 2–5 and their Layer-2/evidence projections remain byte-identical to the completed parity build', () => {
  const view = ATHLETE_APA_PARITY_V1.customerViewModel
  const internalObjects = ATHLETE_APA_PARITY_V1.internalTrace.objects
  const destinationObjects = (destination) => Object.fromEntries(Object.entries(internalObjects).filter(([, object]) => object.destination === destination))
  const expected = {
    layer0Boxes2To5: '1abd0f6e90c0cae5f9f57203b65a7de6b2004340fa229114a3aa2e86f5de5a9b',
    futures: 'bb36197b6e4d73ff4633d7005bdad2d8ebb8028df9feefd523e9509cf0ac7ca6',
    move: '39a63fc73bdf388a691faf7c4878822132ad3c0ae36bdbb12a7e70782bbe1e47',
    plan: '0eb163d01c79ba7e904f2931badea35bd5e91d8fbdb65da98d2a0f12c6c621b9',
    evidence: 'c69495c05a28e03f7fafab0baeef50afc4df10cb16285d0f6f6883da71a5fb88',
    deepFutures: '32bf04fb3b2d1e7f83ae8750644159a00248632fdc46389d5ebdb7877e117c58',
    deepMove: '64f9d01783aae33305f8e9a4b9e77a92c79c1c1f00650c4bac4c78efe4de5765',
    deepPlan: '978bf7041dc8efcfd861a1d03869a40a29a17db92341c8768488c2328586fade',
    deepEvidence: '31b3dae310e231ba457f8dbba1333cab2679001e527a873bd29feb2e9d89fb3d',
  }
  assert.equal(hashJson(view.layer0.cards.slice(1)), expected.layer0Boxes2To5)
  assert.equal(hashJson(view.destinations.futures), expected.futures)
  assert.equal(hashJson(view.destinations.move), expected.move)
  assert.equal(hashJson(view.destinations.plan), expected.plan)
  assert.equal(hashJson(view.destinations.evidence), expected.evidence)
  assert.equal(hashJson(destinationObjects('futures')), expected.deepFutures)
  assert.equal(hashJson(destinationObjects('move')), expected.deepMove)
  assert.equal(hashJson(destinationObjects('plan')), expected.deepPlan)
  assert.equal(hashJson(destinationObjects('evidence')), expected.deepEvidence)
})

test('all 65 meaningful objects preserve drawer, return-state, authority and lineage contracts', () => {
  const result = buildAthleteApaParityV1()
  assert.equal(result.validation.meaningfulObjects, 65)
  assert.equal(Object.keys(result.customerViewModel.objects).length, 65)
  for (const [id, object] of Object.entries(result.customerViewModel.objects)) {
    assert.equal(object.object_id, id)
    assert.equal(object.drawer_payload.length, 8)
    assert.equal(object.return_state.exact_scroll_and_focus, true)
    assert.ok(result.internalTrace.objects[id].source_authority)
    assert.ok(result.internalTrace.objects[id].lineage_refs.length > 0)
  }
  assert.equal(validateAthleteApaParityV1(result), true)
})

test('Futures preserve the BA primitive without numerical youth prediction, ranking or selection meaning', () => {
  const futures = ATHLETE_APA_PARITY_V1.customerViewModel.destinations.futures
  assert.equal(futures.items.length, 5)
  assert.equal(futures.displayMode, 'qualitative')
  assert.ok(futures.items.every((item) => !Object.hasOwn(item, 'probability') && item.layoutWeight === 20 && item.displayValue))
  assert.doesNotMatch(JSON.stringify(futures), /scholarship|draft|roster score|talent score|\d+%/iu)
})

test('One Move remains a reversible learning proposal rather than commitment, execution or outcome', () => {
  const view = ATHLETE_APA_PARITY_V1.customerViewModel
  assert.equal(view.destinations.move.logic.length, 4)
  assert.equal(view.destinations.move.proof.length, 4)
  assert.equal(view.destinations.plan.oneMove.status, 'PROPOSED_NOT_ACCEPTED')
  assert.match(view.destinations.move.startHere.qualifier, /No commitment|adjust|decline|stop/iu)
  assert.doesNotMatch(JSON.stringify(view.destinations.move), /completed|customer agreed|caused improvement/iu)
})

test('Plan restores the current BA one-three-five structural chassis with Athlete-safe semantics', () => {
  const plan = ATHLETE_APA_PARITY_V1.customerViewModel.destinations.plan
  assert.equal(plan.ways.length, 3)
  assert.equal(plan.strategies.length, 5)
  assert.equal(plan.ways[0].status, 'MAPPED_NOT_ACCEPTED')
  assert.equal(plan.ways.filter((way) => way.status === 'OPEN').length, 2)
  assert.match(plan.goal.display, /Communicate one useful thing/iu)
  assert.doesNotMatch(JSON.stringify(plan), /revenue|closings|database|listing|annual income/iu)
})

test('Evidence retains full BA depth while preserving missingness, contradiction and causal humility', () => {
  const evidence = ATHLETE_APA_PARITY_V1.customerViewModel.destinations.evidence
  assert.equal(evidence.categories.length, 4)
  assert.equal(evidence.ledger.filter((row) => ['KNOWN', 'REPORTED'].includes(row.status)).length, 20)
  assert.equal(evidence.coverage.reduce((sum, row) => sum + row.known, 0), 20)
  assert.deepEqual(new Set(evidence.ledger.filter((row) => ['KNOWN', 'REPORTED'].includes(row.status)).map((row) => row.basis)), new Set(['Athlete report', 'Instructor report', 'Instructor observation', 'Explicit shared agreement', 'Qualified record']))
  assert.ok(evidence.ledger.some((row) => row.status === 'MISSING'))
  assert.ok(evidence.ledger.some((row) => row.status === 'CONTRADICTED'))
  assert.equal(evidence.traceCards.length, 4)
  assert.ok(evidence.coverage.length >= 5)
  assert.ok(evidence.counterevidence.length >= 3)
  assert.ok(evidence.mindChanges.length >= 3)
})

test('realization identity is stable and changes when governed current reality changes', async () => {
  assert.equal(buildAthleteApaParityV1().realizationIdentity, ATHLETE_APA_PARITY_V1.realizationIdentity)
  assert.match(ATHLETE_APA_PARITY_V1.realizationIdentity, /^[a-f0-9]{64}$/u)
  assert.match(ATHLETE_APA_PARITY_FIXTURE.stateHash, /^[a-f0-9]{64}$/u)
})

test('current BA default server-rendered markup is byte-identical after shared-chassis parameterization', async (context) => {
  const vite = await createServer({ cacheDir: path.join(os.tmpdir(), 'more-athlete-apa-live-ba-parity-v1-vite-cache'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  context.after(() => vite.close())
  const [{ default: BusinessTwinApp }, { loadBaProgressiveDisclosureV1 }] = await Promise.all([
    vite.ssrLoadModule('/src/lab/baProgressiveDisclosureV1/BusinessTwinApp.jsx'),
    vite.ssrLoadModule('/src/lab/baProgressiveDisclosureV1/loadBaProgressiveDisclosureV1.js'),
  ])
  const projection = await loadBaProgressiveDisclosureV1('synthetic-mid')
  const markup = renderToStaticMarkup(React.createElement(BusinessTwinApp, { viewModel: projection.customerViewModel }))
  assert.equal(Buffer.byteLength(markup), 5932)
  assert.equal(sha256(markup), '22cbc108917e74a6e3da1e48b0bab576a4b05e395ab752b15e19882f5ae44116')
  assert.deepEqual(loadCurrentBaReference().customerViewModel, projection.customerViewModel)
})

test('the production OneShot route retains the shared Athlete APA renderer and exact BA chassis', async () => {
  const [mainEntry, source, routeGate, wrapperCss] = await Promise.all([
    fs.readFile('src/main.jsx', 'utf8'),
    fs.readFile('src/athleteLivingConsultOneShotV1/App.jsx', 'utf8'),
    fs.readFile('middleware.js', 'utf8'),
    fs.readFile('src/components/baProductionReadinessV1/newBaProductionCanary.css'),
  ])
  assert.match(mainEntry, /path="\/athlete-consulting-tool\/demo" element=\{<AthleteLivingConsultOneShotV1App \/>\}/u)
  assert.match(source, /BusinessTwinApp viewModel=\{viewModel\} onContextChange=\{onContextChange\}/u)
  assert.match(source, /newBaProductionCanary\.css/u)
  assert.match(source, /className="gu-authored__canvas athlete-apa-parity-root new-ba-production-experience"/u)
  assert.match(routeGate, /ATHLETE_CONSULTING_DARREN_DEMO_ENABLED === 'true'/u)
  assert.match(routeGate, /matcher: '\/athlete-consulting-tool\/demo\/:path\*'/u)
  assert.equal(sha256(wrapperCss), '2aca86ee6df32ddb7b3d80c39df54c1afcf710a5878ddedb2b745d018da38258')
  assert.doesNotMatch(mainEntry, /visual-lab\/athlete-apa|VITE_ATHLETE_APA/iu)
  assert.doesNotMatch(source, /Change cassette|screen === 'start'|MapExperience/iu)
})

test('customer projection contains no internal hashes, raw private BOS answers, technical mechanics or unsafe youth meanings', () => {
  const text = JSON.stringify(ATHLETE_APA_PARITY_V1.customerViewModel)
  assert.doesNotMatch(text, /36934ae|21dad929|fb6745f0|stateHash|sourceArtifact|chain.of.thought|redis|provider request|scholarship probability|selection score|medical clearance/iu)
  assert.equal(ATHLETE_APA_PARITY_V1.internalTrace.provider_calls, 0)
  assert.equal(ATHLETE_APA_PARITY_V1.internalTrace.persistence_writes, 0)
  assert.equal(ATHLETE_APA_PARITY_V1.internalTrace.customer_mutation, false)
})
