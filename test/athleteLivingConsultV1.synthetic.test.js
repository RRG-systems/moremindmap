import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'

import {
  ATHLETE_LIVING_CONSULT_FRONTIER_POLICY,
  buildAthleteLivingConsultFrontierRequest,
} from '../api/engine/athleteLivingConsultV1/frontier.js'

import {
  ACTION_TYPES,
  ATHLETE_MAP_CONFIRMATION,
  ATHLETE_PLAN_CONFIRMATION,
  AUDIENCES,
  EVIDENCE_CONFIRMATION,
  LIVING_CONSULT_NAMESPACE,
  OPEN_LOOP_STATES,
  ROOM_IDS,
  SESSION_PHASES,
} from '../src/lib/athleteLivingConsultV1/contracts.js'
import {
  buildLivingConsultProjection,
  createInitialLivingConsultState,
  reduceLivingConsultState,
  verifyLivingConsultState,
} from '../src/lib/athleteLivingConsultV1/runtime.js'
import { SYNTHETIC_MARA_PRIVATE_BOS_READING } from '../src/lib/athleteLivingConsultV1/fixtures.js'

const AT = '2026-09-04T18:00:00.000Z'
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

function act(state, type, payload = {}, options = {}) {
  return reduceLivingConsultState(state, {
    type,
    actor: options.actor || 'system',
    at: options.at || AT,
    expectedStateHash: options.expectedStateHash || state.stateHash,
    idempotencyKey: options.idempotencyKey || `test-${type.toLowerCase()}-${state.revision + 1}`,
    payload,
  })
}

function succeed(state, type, payload = {}, options = {}) {
  const result = act(state, type, payload, options)
  assert.equal(result.ok, true, `${type}: ${result.code || 'unknown failure'}`)
  assert.ok(result.state)
  return result
}

function startSession(state, options = {}) {
  return succeed(state, ACTION_TYPES.START_SESSION, {
    purpose: 'Understand what changed and choose one useful next step together.',
  }, { actor: 'athlete', ...options })
}

function captureCandidate(state, overrides = {}) {
  return succeed(state, ACTION_TYPES.CAPTURE_NEW_EVIDENCE, {
    statement: 'Mara and Coach Rowan both noticed that the next practice felt easier to enter after the first drill was named clearly.',
    sourceClass: 'SHARED_AGREEMENT',
    sourceActor: 'athlete',
    audience: AUDIENCES.JOINT,
    observedAt: '2026-09-04T17:20:00.000Z',
    provenance: {
      kind: 'joint-session-report',
      sessionId: state.session?.sessionId,
    },
    ...overrides,
  }, { actor: overrides.actor || 'athlete' })
}

function decideCandidate(state, candidateId, decision = 'ACCEPT', options = {}) {
  return act(state, ACTION_TYPES.DECIDE_EVIDENCE_CANDIDATE, {
    candidateId,
    decision,
    confirmation: decision === 'ACCEPT' ? EVIDENCE_CONFIRMATION : null,
    note: options.note || null,
  }, { actor: options.actor || 'athlete', idempotencyKey: options.idempotencyKey })
}

function proposeClarityMapChange(state, evidenceId) {
  return succeed(state, ACTION_TYPES.PROPOSE_MAP_CHANGE, {
    title: 'What changed after another clear-cue practice',
    summary: 'Add the new joint observation while keeping the cause unresolved.',
    reason: 'A new comparable observation belongs in the living map once both people confirm it.',
    evidenceRefs: [evidenceId],
    uncertainty: 'The additional observation does not prove that clearer instructions caused the difference.',
    falsifier: 'If repeated practices with a clearly received cue do not show the same pattern, the clarity hypothesis is weakened.',
    delta: {
      currentRealityAdditions: [{
        id: `living-claim-${evidenceId}`,
        statement: 'A later comparable practice was reported jointly as easier to enter after the first assignment was clear.',
        sourceClass: 'SHARED_AGREEMENT',
        epistemicStatus: 'AGREED_OBSERVATION',
        evidenceRefs: [evidenceId],
        causeEstablished: false,
      }],
      evidenceAdditions: [{
        id: evidenceId,
        meaning: 'One more comparable observation is available; it is not causal proof.',
        causalConfidence: 'NOT_ASSESSED',
      }],
    },
  }, { actor: 'more' })
}

function decideMapChange(state, proposalId, actor, decision = 'ACCEPT', options = {}) {
  return act(state, ACTION_TYPES.DECIDE_MAP_CHANGE, {
    proposalId,
    decision,
    confirmation: decision === 'ACCEPT' ? ATHLETE_MAP_CONFIRMATION : null,
    note: options.note || null,
  }, { actor, idempotencyKey: options.idempotencyKey })
}

function proposePlan(state, overrides = {}) {
  return succeed(state, ACTION_TYPES.PROPOSE_PLAN, {
    title: 'A clear first-drill experiment',
    athleteFocus: 'Ask for the first drill and meeting place before the next three practices.',
    instructorFocus: 'Name the first drill and meeting place before warm-up ends.',
    oneMove: 'Run a three-practice clarity check.',
    actions: [
      { owner: 'athlete', action: 'Ask if the first assignment is not clear.', dueAt: '2026-09-25' },
      { owner: 'instructor', action: 'State the first drill and meeting place.', dueAt: '2026-09-25' },
    ],
    evidence: ['Whether the cue was heard', 'How quickly Mara entered the drill', 'What else was happening that day'],
    reviewDate: '2026-09-25',
    support: ['Coach Rowan will make room for a private clarification if asking in the group feels hard.'],
    changeCourseTrigger: 'Pause or change the experiment if the cue is clear and the same entry difficulty continues.',
    unresolvedItems: ['The current evidence does not establish why the earlier hesitation happened.'],
    ...overrides,
  }, { actor: 'more' })
}

function decidePlan(state, agreementId, actor, decision = 'ACCEPT', options = {}) {
  return act(state, ACTION_TYPES.DECIDE_PLAN, {
    agreementId,
    decision,
    confirmation: decision === 'ACCEPT' ? ATHLETE_PLAN_CONFIRMATION : null,
    note: options.note || null,
  }, { actor, idempotencyKey: options.idempotencyKey })
}

function buildAcceptedPlan(state) {
  let result = proposePlan(state)
  state = result.state
  const agreementId = state.planProposals.at(-1).agreementId
  result = decidePlan(state, agreementId, 'athlete')
  assert.equal(result.ok, true, result.code)
  state = result.state
  assert.equal(state.acceptedPlan, null)
  result = decidePlan(state, agreementId, 'instructor')
  assert.equal(result.ok, true, result.code)
  return result.state
}

test('opening the route creates an IDLE, synthetic-only relationship without starting a substantive session', () => {
  const state = createInitialLivingConsultState()
  assert.equal(state.phase, SESSION_PHASES.IDLE)
  assert.equal(state.session, null)
  assert.equal(state.revision, 0)
  assert.equal(state.currentMap.version, 1)
  assert.equal(state.mapHistory.length, 1)
  assert.equal(state.sourceBindings.bos.mutationAuthority, 'NONE_READ_ONLY')
  assert.equal(state.sourceBindings.apa.sourceSnapshotWritable, false)
  assert.match(state.namespace, new RegExp(`^${LIVING_CONSULT_NAMESPACE}:`, 'u'))
  assert.equal(state.relationshipEvents.length, 0)
  assert.equal(state.rslEvents.length, 0)
  assert.deepEqual(Object.values(ROOM_IDS), ['bos', 'map', 'where', 'futures', 'move', 'evidence', 'plan'])
})

test('the production OneShot route is default-off behind its server-only gate', () => {
  const mainEntry = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
  const routeGate = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8')
  const serverHandler = readFileSync(new URL('../api/internal/athlete-living-consult-one-shot-v1.js', import.meta.url), 'utf8')
  assert.match(mainEntry, /path="\/athlete-consulting-tool\/demo" element=\{<AthleteLivingConsultOneShotV1App \/>\}/u)
  assert.match(routeGate, /ATHLETE_CONSULTING_DARREN_DEMO_ENABLED === 'true'/u)
  assert.match(routeGate, /matcher: '\/athlete-consulting-tool\/demo\/:path\*'/u)
  assert.match(serverHandler, /ATHLETE_CONSULTING_DEMO_DEFAULT_OFF/u)
  assert.doesNotMatch(mainEntry, /VITE_ATHLETE_LIVING_CONSULT_V1_SYNTHETIC|visual-lab\/athlete-living-consult-v1/u)
})

test('BOS remains byte-for-byte read-only while the isolated relationship evolves', () => {
  let state = createInitialLivingConsultState()
  const sourceBosBytes = Buffer.from(JSON.stringify(SYNTHETIC_MARA_PRIVATE_BOS_READING))
  const sourceBosHash = sha256(sourceBosBytes)
  assert.equal(SYNTHETIC_MARA_PRIVATE_BOS_READING.sealedSource.artifactSha256, state.sourceBindings.bos.sealedArtifactSha256)
  assert.equal(Object.isFrozen(SYNTHETIC_MARA_PRIVATE_BOS_READING), true)
  const sourceBinding = structuredClone(state.sourceBindings.bos)
  const sharedBosContext = structuredClone(state.currentMap.sharedBosContext)
  state = startSession(state).state
  state = succeed(state, ACTION_TYPES.APPEND_CHAT, {
    text: 'I want to understand why the start of practice still feels uncertain.',
    room: ROOM_IDS.MAP,
  }, { actor: 'athlete' }).state
  assert.deepEqual(state.sourceBindings.bos, sourceBinding)
  assert.deepEqual(state.currentMap.sharedBosContext, sharedBosContext)
  assert.equal(state.sourceBindings.bos.mutationAuthority, 'NONE_READ_ONLY')
  assert.equal(sha256(Buffer.from(JSON.stringify(SYNTHETIC_MARA_PRIVATE_BOS_READING))), sourceBosHash)
})

test('a captured candidate is not truth until the named human confirms it', () => {
  let state = startSession(createInitialLivingConsultState()).state
  const mapIdentity = state.currentMap.mapIdentity
  const captured = captureCandidate(state)
  state = captured.state
  assert.equal(state.evidenceCandidates.length, 1)
  assert.equal(state.evidenceCandidates[0].status, 'CANDIDATE_NOT_TRUTH')
  assert.equal(state.authorizedEvidence.length, 0)
  assert.equal(state.currentMap.mapIdentity, mapIdentity)
  assert.equal(state.rslEvents.some((event) => event.type === 'EVIDENCE_AUTHORIZED'), false)
})

test('human evidence confirmation preserves speaker, source, timing and provenance', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = captureCandidate(state).state
  const candidate = state.evidenceCandidates[0]
  let confirmed = decideCandidate(state, candidate.candidateId, 'ACCEPT', { actor: 'athlete' })
  assert.equal(confirmed.ok, true, confirmed.code)
  assert.equal(confirmed.state.authorizedEvidence.length, 0)
  confirmed = decideCandidate(confirmed.state, candidate.candidateId, 'ACCEPT', { actor: 'instructor' })
  assert.equal(confirmed.ok, true, confirmed.code)
  state = confirmed.state
  assert.equal(state.authorizedEvidence.length, 1)
  const evidence = state.authorizedEvidence[0]
  assert.equal(evidence.sourceClass, 'SHARED_AGREEMENT')
  assert.equal(evidence.sourceActor, 'athlete')
  assert.equal(evidence.observedAt, '2026-09-04T17:20:00.000Z')
  assert.equal(evidence.provenance.kind, 'joint-session-report')
  assert.equal(evidence.causalClaim, false)
})

test('stale writes fail closed without changing state', () => {
  const initial = createInitialLivingConsultState()
  const started = startSession(initial)
  const stale = act(started.state, ACTION_TYPES.APPEND_CHAT, {
    text: 'This command was bound to the state before the session started.',
    room: ROOM_IDS.MAP,
  }, { actor: 'athlete', expectedStateHash: initial.stateHash, idempotencyKey: 'stale-proof' })
  assert.equal(stale.ok, false)
  assert.match(stale.code, /STALE/u)
  assert.deepEqual(stale.state, started.state)
})

test('exact human confirmation text is required before evidence, map or plan authority is exercised', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = captureCandidate(state, { sourceClass: 'ATHLETE_REPORT', requiredConfirmers: ['athlete'] }).state
  let denied = act(state, ACTION_TYPES.DECIDE_EVIDENCE_CANDIDATE, {
    candidateId: state.evidenceCandidates[0].candidateId,
    decision: 'ACCEPT',
    confirmation: 'yes',
  }, { actor: 'athlete', idempotencyKey: 'wrong-evidence-confirmation' })
  assert.equal(denied.ok, false)
  assert.match(denied.code, /EXACT_CONFIRMATION_REQUIRED/u)
  assert.equal(denied.state.authorizedEvidence.length, 0)

  state = proposePlan(state).state
  denied = act(state, ACTION_TYPES.DECIDE_PLAN, {
    agreementId: state.planProposals[0].agreementId,
    decision: 'ACCEPT',
    confirmation: 'looks good',
  }, { actor: 'athlete', idempotencyKey: 'wrong-plan-confirmation' })
  assert.equal(denied.ok, false)
  assert.match(denied.code, /EXACT_CONFIRMATION_REQUIRED/u)
  assert.equal(denied.state.acceptedPlan, null)
})

test('an exact idempotency replay returns the prior result and appends nothing twice', () => {
  const initial = createInitialLivingConsultState()
  const envelope = {
    type: ACTION_TYPES.START_SESSION,
    actor: 'athlete',
    at: AT,
    expectedStateHash: initial.stateHash,
    idempotencyKey: 'same-session-start',
    payload: { purpose: 'Begin the next synthetic coaching session.' },
  }
  const first = reduceLivingConsultState(initial, envelope)
  assert.equal(first.ok, true, first.code)
  const second = reduceLivingConsultState(first.state, envelope)
  assert.equal(second.ok, true, second.code)
  assert.equal(second.replayed, true)
  assert.equal(second.state.revision, first.state.revision)
  assert.deepEqual(second.state.relationshipEvents, first.state.relationshipEvents)
})

test('declining a candidate or map proposal records the decision but never mutates the map', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = captureCandidate(state).state
  const mapBeforeCandidateDecision = structuredClone(state.currentMap)
  const declinedCandidate = decideCandidate(state, state.evidenceCandidates[0].candidateId, 'REJECT', { note: 'That is not how I would describe it.' })
  assert.equal(declinedCandidate.ok, true, declinedCandidate.code)
  state = declinedCandidate.state
  assert.deepEqual(state.currentMap, mapBeforeCandidateDecision)
  assert.equal(state.authorizedEvidence.length, 0)
  assert.equal(state.evidenceCandidates[0].status, 'REJECTED_NO_MUTATION')

  const baselineEvidenceRef = state.currentMap.boxes.currentReality.claims[0].id
  const proposed = proposeClarityMapChange(state, baselineEvidenceRef)
  state = proposed.state
  const mapBeforeProposalDecision = structuredClone(state.currentMap)
  const proposalId = state.mapChangeProposals.at(-1).proposalId
  const declinedChange = decideMapChange(state, proposalId, 'athlete', 'REJECT', { note: 'Do not add this to our shared map.' })
  assert.equal(declinedChange.ok, true, declinedChange.code)
  assert.deepEqual(declinedChange.state.currentMap, mapBeforeProposalDecision)
  assert.equal(declinedChange.state.mapChangeProposals.at(-1).status, 'REJECTED_NO_MUTATION')
})

test('disagreement remains visible and unresolved instead of being collapsed into model truth', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = captureCandidate(state, {
    statement: 'Mara says the cue was not heard; Coach Rowan says it was given clearly.',
    sourceClass: 'ATHLETE_REPORT',
    sourceActor: 'athlete',
    audience: AUDIENCES.JOINT,
    epistemicStatus: 'CONTESTED',
    contradictionWith: 'instructor-report-cue-was-clear',
  }).state
  const deferred = decideCandidate(state, state.evidenceCandidates[0].candidateId, 'DEFER', {
    note: 'We do not agree yet; keep the difference open.',
  })
  assert.equal(deferred.ok, true, deferred.code)
  assert.equal(deferred.state.authorizedEvidence.length, 0)
  assert.equal(deferred.state.evidenceCandidates[0].status, 'DEFERRED_NO_MUTATION')
  assert.match(JSON.stringify(deferred.state), /unresolved|CONTESTED|do not agree/iu)
})

test('one human confirmation cannot mutate the APA map; both exact confirmations regenerate the whole map and keep history', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = captureCandidate(state).state
  const candidateId = state.evidenceCandidates[0].candidateId
  state = decideCandidate(state, candidateId, 'ACCEPT', { actor: 'athlete' }).state
  state = decideCandidate(state, candidateId, 'ACCEPT', { actor: 'instructor' }).state
  const evidenceId = state.authorizedEvidence[0].id
  state = proposeClarityMapChange(state, evidenceId).state
  const proposalId = state.mapChangeProposals.at(-1).proposalId
  const baseline = structuredClone(state.currentMap)
  const athleteOnly = decideMapChange(state, proposalId, 'athlete')
  assert.equal(athleteOnly.ok, true, athleteOnly.code)
  state = athleteOnly.state
  assert.deepEqual(state.currentMap, baseline)
  assert.equal(state.mapChangeProposals.at(-1).status, 'AWAITING_CONFIRMATION')

  const committed = decideMapChange(state, proposalId, 'instructor')
  assert.equal(committed.ok, true, committed.code)
  state = committed.state
  assert.equal(state.currentMap.version, 2)
  assert.notEqual(state.currentMap.mapIdentity, baseline.mapIdentity)
  assert.equal(state.mapHistory.length, 2)
  assert.deepEqual(state.mapHistory[0], baseline)
  assert.equal(state.currentMap.authorizedChanges[0].causalClaimEstablished, false)
  assert.match(state.currentMap.authorizedChanges[0].uncertainty, /does not prove|uncertainty/iu)
  assert.equal(state.guPlans.some((plan) => plan.kind === 'MAP_CHANGE' && plan.trigger === 'AUTHORIZED_MAP_CHANGE_MANDATORY'), true)
})

test('the Athlete Development Agreement is separate from a map change and requires both people', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = proposePlan(state).state
  const proposalId = state.planProposals.at(-1).agreementId
  const mapIdentity = state.currentMap.mapIdentity
  state = decidePlan(state, proposalId, 'athlete').state
  assert.equal(state.acceptedPlan, null)
  assert.equal(state.currentMap.mapIdentity, mapIdentity)
  const accepted = decidePlan(state, proposalId, 'instructor')
  assert.equal(accepted.ok, true, accepted.code)
  state = accepted.state
  assert.equal(state.acceptedPlan.title, 'A clear first-drill experiment')
  assert.deepEqual(Object.keys(state.acceptedPlan.agreedBy).sort(), ['athlete', 'instructor'])
  assert.equal(state.currentMap.mapIdentity, mapIdentity)
  assert.equal(state.interventions.length, 1)
  assert.equal(state.interventions[0].status, 'open')
})

test('attempt and outcome observations stay attached to the accepted intervention and never establish causation by default', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const interventionId = state.interventions[0].interventionId
  const premature = act(state, ACTION_TYPES.RECORD_OUTCOME, {
    interventionId,
    statement: 'An outcome was claimed before any attempt was recorded.',
    classification: 'POSITIVE',
    confounders: [],
  }, { actor: 'athlete', idempotencyKey: 'premature-outcome' })
  assert.equal(premature.ok, false)
  assert.match(premature.code, /ATTEMPT|EXECUTION/u)

  let result = succeed(state, ACTION_TYPES.RECORD_ATTEMPT, {
    interventionId,
    executionState: 'attempted',
    observation: 'Two of the three planned practice checks happened.',
    attemptedAt: '2026-09-20T18:00:00.000Z',
  }, { actor: 'athlete', at: '2026-09-20T18:05:00.000Z' })
  state = result.state
  const attemptId = state.attempts[0].attemptId
  result = succeed(state, ACTION_TYPES.RECORD_OUTCOME, {
    interventionId,
    attemptId,
    statement: 'Mara entered the first drill sooner in the two observed practices.',
    classification: 'MIXED',
    observedAt: '2026-09-20T18:10:00.000Z',
    confounders: ['Different drill difficulty', 'Smaller group size'],
    externalShocks: ['One practice ended early because of weather.'],
  }, { actor: 'instructor', at: '2026-09-20T18:12:00.000Z' })
  state = result.state
  assert.equal(state.outcomes[0].interventionId, interventionId)
  assert.equal(state.outcomes[0].attemptId, attemptId)
  assert.equal(state.outcomes[0].causalTruth, false)
  assert.equal(state.interventions[0].status, 'attempted')
})

test('confounded outcomes refuse causal overclaim and preserve a bounded causal review', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const interventionId = state.interventions[0].interventionId
  state = succeed(state, ACTION_TYPES.RECORD_ATTEMPT, {
    interventionId,
    executionState: 'attempted',
    observation: 'Two comparable checks were attempted.',
  }, { actor: 'athlete' }).state
  state = succeed(state, ACTION_TYPES.RECORD_OUTCOME, {
    attemptId: state.attempts[0].attemptId,
    classification: 'MIXED',
    statement: 'One start looked easier and one did not.',
    confounders: ['Group size changed.'],
    externalShocks: ['The practice ended early.'],
  }, { actor: 'instructor' }).state
  const outcomeId = state.outcomes[0].outcomeId
  const overclaim = act(state, ACTION_TYPES.ASSESS_CAUSAL_CONFIDENCE, {
    outcomeId,
    confidence: 'BOUNDED_MODERATE',
    rationale: 'This would claim too much from a confounded pair of observations.',
  }, { actor: 'more', idempotencyKey: 'causal-overclaim-refusal' })
  assert.equal(overclaim.ok, false)
  assert.match(overclaim.code, /CONFOUNDED_OUTCOME_OVERCLAIM/u)
  const bounded = succeed(state, ACTION_TYPES.ASSESS_CAUSAL_CONFIDENCE, {
    outcomeId,
    confidence: 'INCONCLUSIVE',
    rationale: 'The result stays inconclusive because group size and practice length changed.',
  }, { actor: 'more', idempotencyKey: 'bounded-causal-review' })
  assert.equal(bounded.state.causalReviews[0].causalProof, false)
  assert.deepEqual(bounded.state.causalReviews[0].confoundersPreserved, ['Group size changed.'])
  assert.deepEqual(bounded.state.causalReviews[0].externalShocksPreserved, ['The practice ended early.'])
})

test('open loops support unresolved and intelligently abandoned without treating either as failure', () => {
  assert.ok(OPEN_LOOP_STATES.includes('unresolved'))
  assert.ok(OPEN_LOOP_STATES.includes('intelligently_abandoned'))
  let state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const loopId = state.openLoops[0].loopId
  const unresolved = succeed(state, ACTION_TYPES.UPDATE_OPEN_LOOP, {
    loopId,
    status: 'unresolved',
    authority: 'JOINT_EXPLICIT',
    reason: 'The two practice accounts still differ, so no conclusion is ready.',
  }, { actor: 'athlete' })
  state = unresolved.state
  assert.equal(state.interventions[0].status, 'unresolved')

  state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const interventionId = state.interventions[0].interventionId
  const abandoned = succeed(state, ACTION_TYPES.RECORD_ATTEMPT, {
    interventionId,
    executionState: 'intelligently_abandoned',
    observation: 'The schedule changed, so this exact experiment no longer fits safely.',
    attemptedAt: '2026-09-25T18:00:00.000Z',
  }, { actor: 'athlete', at: '2026-09-25T18:00:00.000Z' })
  assert.equal(abandoned.state.interventions[0].status, 'intelligently_abandoned')
  assert.equal(abandoned.state.attempts[0].executionState, 'intelligently_abandoned')
})

test('agentic notices correspond to real runtime events and acknowledgement is one-time', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = captureCandidate(state).state
  const notice = state.agenticNotices.find((item) => item.kind === 'EVIDENCE_CANDIDATE')
  assert.ok(notice)
  assert.equal(notice.acknowledgedAt, null)
  const envelope = {
    type: ACTION_TYPES.ACK_NOTICE,
    actor: 'athlete',
    at: AT,
    expectedStateHash: state.stateHash,
    idempotencyKey: 'ack-real-event-once',
    payload: { noticeId: notice.noticeId },
  }
  const acknowledged = reduceLivingConsultState(state, envelope)
  assert.equal(acknowledged.ok, true, acknowledged.code)
  state = acknowledged.state
  assert.ok(state.agenticNotices.find((item) => item.noticeId === notice.noticeId).acknowledgedAt)
  const replay = reduceLivingConsultState(state, envelope)
  assert.equal(replay.ok, true, replay.code)
  assert.equal(replay.replayed, true)
  assert.equal(replay.state.agenticNotices.filter((item) => item.noticeId === notice.noticeId).length, 1)
})

test('middle GU is restrained, read-only and requires a material usefulness decision', () => {
  let state = startSession(createInitialLivingConsultState()).state
  const mapIdentity = state.currentMap.mapIdentity
  const denied = act(state, ACTION_TYPES.ADD_MIDDLE_GU, {
    materiallyUseful: false,
    title: 'A decorative surface',
    body: 'This should not render.',
  }, { actor: 'more', idempotencyKey: 'decorative-gu-denied' })
  assert.equal(denied.ok, false)
  assert.match(denied.code, /MUST_BE_RESTRAINED/u)
  const created = succeed(state, ACTION_TYPES.ADD_MIDDLE_GU, {
    materiallyUseful: true,
    title: 'Compare what each person saw',
    body: 'Keep delivery, receipt and behavior separate before drawing a conclusion.',
  }, { actor: 'more', idempotencyKey: 'useful-middle-gu' })
  state = created.state
  const plan = state.guPlans.at(-1)
  assert.equal(plan.kind, 'MIDDLE')
  assert.equal(plan.readOnly, true)
  assert.equal(plan.mutationAuthority, 'NONE')
  assert.equal(state.currentMap.mapIdentity, mapIdentity)
})

test('joint and shareable projections reveal neither private-object existence nor private-state-derived identity', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const jointBefore = buildLivingConsultProjection(state, AUDIENCES.JOINT)
  const shareBefore = buildLivingConsultProjection(state, AUDIENCES.SHAREABLE_PLAN)

  state = captureCandidate(state, {
    statement: 'A private synthetic reflection that must not change any joint or shareable byte.',
    sourceClass: 'ATHLETE_REPORT',
    sourceActor: 'athlete',
    audience: AUDIENCES.PRIVATE,
    provenance: { kind: 'athlete-private-session-reflection' },
  }).state
  state = decideCandidate(state, state.evidenceCandidates.at(-1).candidateId).state

  const jointAfter = buildLivingConsultProjection(state, AUDIENCES.JOINT)
  const shareAfter = buildLivingConsultProjection(state, AUDIENCES.SHAREABLE_PLAN)
  assert.deepEqual(jointAfter, jointBefore)
  assert.deepEqual(shareAfter, shareBefore)
  for (const projection of [jointAfter, shareAfter]) {
    assert.doesNotMatch(JSON.stringify(projection), /excludedPrivateObjectCount|privateObjectCount|privateBosContext|private_source|private evidence|sourceArtifactSha256|sourceStateHash|bosArtifactIdentity|placeholder|E0[1-4]|called passive|home responsibility/iu)
  }
  const athletePrivate = buildLivingConsultProjection(state, AUDIENCES.PRIVATE)
  assert.match(JSON.stringify(athletePrivate), /private synthetic reflection/iu)
})

test('share PLAN builds a filtered preview and records zero sends or external effects', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const result = succeed(state, ACTION_TYPES.SHARE_PLAN_PREVIEW, {
    requestedAudience: 'athlete-support-circle-preview',
  }, { actor: 'athlete' })
  assert.equal(result.externalEffects.sends, 0)
  assert.equal(result.externalEffects.customerWrites, 0)
  assert.match(result.code, /PREVIEW_READY_NO_SEND/u)
  assert.deepEqual(result.preview, buildLivingConsultProjection(result.state, AUDIENCES.SHAREABLE_PLAN))
  assert.doesNotMatch(JSON.stringify(result.preview), /excludedPrivateObjectCount|privateObjectCount|privateBosContext|private_source|private evidence|sourceArtifactSha256|sourceStateHash|bosArtifactIdentity|placeholder/iu)
})

test('alternate cassette stays behind the same Living Consult contract and does not import Lisa or Beyond Today', () => {
  const baseline = createInitialLivingConsultState({ cassetteId: 'more-athlete-default-v1' })
  const alternate = createInitialLivingConsultState({ cassetteId: 'fictional-northstar-v1' })
  assert.equal(baseline.contract, alternate.contract)
  assert.equal(baseline.currentMap.contract, alternate.currentMap.contract)
  assert.notEqual(baseline.currentMap.mapIdentity, alternate.currentMap.mapIdentity)
  assert.equal(alternate.currentMap.cassette.id, 'fictional-northstar-v1')
  assert.doesNotMatch(JSON.stringify(alternate), /Lisa|Beyond Today/iu)
})

test('the real frontier request accepts the governed joint projection and preserves the locked provider/tool boundary', () => {
  const state = startSession(createInitialLivingConsultState()).state
  const request = buildAthleteLivingConsultFrontierRequest({
    jointContext: buildLivingConsultProjection(state, AUDIENCES.JOINT),
    message: 'What is one useful thing for us to understand together?',
    allowWebResearch: false,
  })
  assert.equal(request.model, 'gpt-5.6-sol')
  assert.deepEqual(request.reasoning, { effort: 'xhigh' })
  assert.equal(request.store, false)
  assert.equal(request.background, false)
  assert.deepEqual(request.tools, [])
  const researchRequest = buildAthleteLivingConsultFrontierRequest({
    jointContext: buildLivingConsultProjection(state, AUDIENCES.JOINT),
    message: 'Would current public evidence materially change how we understand this?',
    allowWebResearch: true,
  })
  assert.deepEqual(researchRequest.tools, [{ type: 'web_search' }])
  assert.equal(researchRequest.tool_choice, 'auto')
  assert.equal(ATHLETE_LIVING_CONSULT_FRONTIER_POLICY.mutationAuthority, false)
  assert.equal(ATHLETE_LIVING_CONSULT_FRONTIER_POLICY.realCustomerData, false)
  assert.equal(ATHLETE_LIVING_CONSULT_FRONTIER_POLICY.cassette, null)
})

test('ending and reopening preserves durable meaning, plan, attempt and outcome continuity without transcript reconstruction', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const interventionId = state.interventions[0].interventionId
  state = succeed(state, ACTION_TYPES.RECORD_ATTEMPT, {
    interventionId,
    executionState: 'attempted',
    observation: 'Two of three clarity checks happened.',
    attemptedAt: '2026-09-20T18:00:00.000Z',
  }, { actor: 'athlete', at: '2026-09-20T18:02:00.000Z' }).state
  state = succeed(state, ACTION_TYPES.RECORD_OUTCOME, {
    interventionId,
    attemptId: state.attempts[0].attemptId,
    statement: 'The two observed starts felt easier, but other conditions changed too.',
    classification: 'MIXED',
    observedAt: '2026-09-20T18:10:00.000Z',
    confounders: ['Smaller group', 'Different drill'],
  }, { actor: 'instructor', at: '2026-09-20T18:12:00.000Z' }).state
  state = succeed(state, ACTION_TYPES.END_SESSION, {
    whatMattered: 'Clarity may help, but the cause remains unsettled.',
    whatChanged: 'A jointly accepted three-practice experiment now has two observations.',
    whatLearned: 'Two observed starts were easier under different practice conditions.',
    whatDecided: 'Keep the third check open before changing course.',
    remainsOpen: 'Whether the same pattern holds in a comparable practice.',
    pickupNext: 'Review the third check and decide whether the map should change.',
  }, { actor: 'instructor', at: '2026-09-20T18:20:00.000Z' }).state
  assert.equal(state.phase, SESSION_PHASES.IDLE)
  assert.equal(state.guPlans.some((plan) => plan.kind === 'CLOSING' && plan.trigger === 'SESSION_END_MANDATORY'), true)
  const durableBefore = {
    interventionId: state.interventions[0].interventionId,
    attemptId: state.attempts[0].attemptId,
    outcomeId: state.outcomes[0].outcomeId,
    rslCount: state.rslEvents.length,
  }
  const reopened = startSession(state, { at: '2026-10-04T18:00:00.000Z', idempotencyKey: 'second-session' })
  assert.equal(reopened.ok, true, reopened.code)
  state = reopened.state
  assert.equal(state.session.number, 2)
  assert.equal(state.interventions[0].interventionId, durableBefore.interventionId)
  assert.equal(state.attempts[0].attemptId, durableBefore.attemptId)
  assert.equal(state.outcomes[0].outcomeId, durableBefore.outcomeId)
  assert.ok(state.rslEvents.length >= durableBefore.rslCount)
  const opening = state.guPlans.at(-1)
  assert.equal(opening.kind, 'OPENING')
  assert.equal(opening.trigger, 'SESSION_START_MANDATORY')
  assert.match(JSON.stringify(opening), /third check|open|two observations|clarity/iu)
})

test('state, projections and receipts contain no Subscription business keys, Recruiting roles or external mutations', () => {
  let state = startSession(createInitialLivingConsultState()).state
  state = buildAcceptedPlan(state)
  const snapshot = JSON.stringify({
    state,
    privateProjection: buildLivingConsultProjection(state, AUDIENCES.PRIVATE),
    jointProjection: buildLivingConsultProjection(state, AUDIENCES.JOINT),
    shareablePlan: buildLivingConsultProjection(state, AUDIENCES.SHAREABLE_PLAN),
  })
  assert.doesNotMatch(snapshot, /candidate_id|invitee_id|manager_id|enterprise_id|subscription:business|business_engine:|real-customer|production-write/iu)
  assert.deepEqual(state.externalEffects, { sends: 0, payments: 0, customerWrites: 0, canonicalBosWrites: 0, sourceApaWrites: 0, productionWrites: 0 })
  assert.doesNotMatch(snapshot, /stripe|billing|sendgrid|twilio|redis-write/iu)
  assert.deepEqual(verifyLivingConsultState(state), {
    ok: true,
    errors: [],
    stateHash: state.stateHash,
    relationshipEventHead: state.relationshipEvents.at(-1).eventHash,
    rslEventHead: state.rslEvents.at(-1).rslHash,
  })
})
