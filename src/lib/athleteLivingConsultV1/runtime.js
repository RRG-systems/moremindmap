import { hashCanonicalJson } from '../intelligenceFabric/hashing.js'
import {
  ACTION_TYPES,
  ACTORS,
  ATHLETE_MAP_CONFIRMATION,
  ATHLETE_PLAN_CONFIRMATION,
  AUDIENCES,
  EVIDENCE_CONFIRMATION,
  LIVING_CONSULT_CONTRACT,
  LIVING_CONSULT_NAMESPACE,
  LIVING_CONSULT_VERSION,
  OPEN_LOOP_STATES,
  ROOM_IDS,
  SESSION_PHASES,
  assertActor,
  assertAudience,
  assertLivingConsult,
  assertNoCustomerOrExternalEffects,
  assertNoPrivateExistenceLeak,
  assertSyntheticIdentity,
  cleanText,
  clone,
  deepFreeze,
  eventHash,
  publicProjectionIdentity,
  stableId,
  stateIdentity,
} from './contracts.js'
import {
  createLivingConsultBaselineMap,
  createClarityMapChangeCandidate,
  regenerateLivingConsultMap,
  safeJointBosClaims,
  validateMapDelta,
} from './map.js'
import { SYNTHETIC_MARA_PRIVATE_BOS_READING } from './fixtures.js'

export { ACTION_TYPES, ACTORS, ATHLETE_MAP_CONFIRMATION, ATHLETE_PLAN_CONFIRMATION, AUDIENCES, EVIDENCE_CONFIRMATION, ROOM_IDS, SESSION_PHASES, createClarityMapChangeCandidate }

const MAP_CONFIRMERS = Object.freeze([ACTORS.ATHLETE, ACTORS.INSTRUCTOR])
const PLAN_CONFIRMERS = MAP_CONFIRMERS
const CAUSAL_CONFIDENCE = new Set(['NOT_ASSESSED', 'INCONCLUSIVE', 'BOUNDED_LOW', 'BOUNDED_MODERATE'])
const OUTCOME_CLASSIFICATIONS = new Set(['POSITIVE', 'MIXED', 'NO_CHANGE', 'NEGATIVE', 'INCONCLUSIVE'])
const ATTEMPT_STATES = new Set(['attempted', 'completed', 'missed', 'intelligently_abandoned'])

const now = (action) => action.at || action.payload?.at || new Date().toISOString()
const payloadOf = (action) => ({ ...action, ...(action.payload || {}) })
const activeSession = (state) => [SESSION_PHASES.STARTED, SESSION_PHASES.ACTIVE].includes(state.phase) && state.session

function withStateHash(state) {
  const next = clone(state)
  next.stateHash = stateIdentity(next)
  return deepFreeze(next)
}

function unsignedAction(action) {
  return {
    type: action.type,
    actor: action.actor || null,
    payload: clone(action.payload || Object.fromEntries(Object.entries(action).filter(([key]) => !['type', 'actor', 'at', 'idempotencyKey', 'expectedStateHash'].includes(key)))),
    expectedStateHash: action.expectedStateHash || null,
    at: action.at || null,
  }
}

function appendRelationshipEvent(state, { type, actor, at, payload = {}, audience = AUDIENCES.JOINT }) {
  const previousEventHash = state.relationshipEvents.at(-1)?.eventHash || null
  const sequence = state.relationshipEvents.length + 1
  const unsigned = {
    contract: 'athlete-living-consult-relationship-event-v1',
    eventId: stableId('alc_evt', { namespace: state.namespace, sequence, type, actor, at, payload, previousEventHash }),
    sequence,
    relationshipId: state.identities.relationshipId,
    sessionId: state.session?.sessionId || null,
    type,
    actor,
    at,
    audience,
    payload: clone(payload),
    payloadHash: hashCanonicalJson(payload),
    previousEventHash,
  }
  state.relationshipEvents.push({ ...unsigned, eventHash: eventHash(unsigned) })
  return state.relationshipEvents.at(-1)
}

function appendRslEvent(state, { type, actor, at, meaning, audience = AUDIENCES.PRIVATE, refs = {}, temporal = {} }) {
  const previousRslHash = state.rslEvents.at(-1)?.rslHash || null
  const sequence = state.rslEvents.length + 1
  const unsigned = {
    contract: 'athlete-personal-rsl-event-v1',
    rslEventId: stableId('alc_rsl', { namespace: state.namespace, sequence, type, actor, at, meaning, refs, previousRslHash }),
    sequence,
    relationshipId: state.identities.relationshipId,
    sessionId: state.session?.sessionId || null,
    type,
    actor,
    at,
    audience,
    meaning: cleanText(meaning, { max: 1200 }),
    refs: clone(refs),
    temporal: clone(temporal),
    canonicalCustomerTruth: type === 'EVIDENCE_AUTHORIZED' || type === 'PLAN_AGREED' || type === 'ATTEMPT_RECORDED' || type === 'OUTCOME_OBSERVED',
    previousRslHash,
  }
  state.rslEvents.push({ ...unsigned, rslHash: eventHash(unsigned) })
  return state.rslEvents.at(-1)
}

function addNotice(state, { kind, title, detail, at, sourceEventId, audience = AUDIENCES.JOINT }) {
  const notice = {
    noticeId: stableId('alc_notice', { kind, sourceEventId, title }),
    kind,
    title,
    detail,
    sourceEventId,
    createdAt: at,
    audience,
    acknowledgedAt: null,
    actualEventOnly: true,
  }
  if (!state.agenticNotices.some((item) => item.noticeId === notice.noticeId)) state.agenticNotices.push(notice)
  return notice
}

function guBlocksFor(kind, state, detail = {}) {
  const openLoops = state.openLoops.filter((loop) => !['completed', 'intelligently_abandoned', 'superseded'].includes(loop.status))
  const athleteName = state.identities?.athleteDisplayName || 'Mara'
  const instructorName = state.identities?.instructorDisplayName || 'Coach Rowan'
  if (kind === 'OPENING') {
    const last = state.lastSession
    return [
      { type: 'orientation', eyebrow: last ? 'Welcome back' : 'Start here', title: last ? 'Pick up what matters now.' : 'Build a shared view before choosing a move.', body: last?.summary?.pickupNext || last?.pickupNext || `${athleteName} and ${instructorName} can compare what each sees without forcing one explanation.` },
      ...(openLoops[0] ? [{ type: 'open-loop', eyebrow: 'Still open', title: openLoops[0].title, body: openLoops[0].nextReviewAt ? `Review around ${openLoops[0].nextReviewAt}.` : 'Review when enough comparable evidence exists.' }] : []),
    ]
  }
  if (kind === 'MAP_CHANGE') return [{ type: 'map-change', eyebrow: 'What changed', title: detail.title || 'The Athlete Performance Map changed.', body: detail.summary || 'A jointly confirmed change is now part of the living map.', mapVersion: state.currentMap.version }]
  if (kind === 'CLOSING') return [{ type: 'session-close', eyebrow: 'What you reached together', title: detail.whatMattered || 'A clearer shared next step.', body: detail.pickupNext || detail.remainsOpen || 'The next session can begin from this point.' }]
  return [{ type: 'thinking-aid', eyebrow: detail.eyebrow || 'Look at this together', title: detail.title || 'One useful view', body: detail.body || 'This view is temporary and does not change the Athlete Performance Map.' }]
}

function addGuPlan(state, { kind, trigger, at, detail = {}, audience = AUDIENCES.JOINT }) {
  const blocks = guBlocksFor(kind, state, detail).slice(0, 3)
  const binding = {
    mapVersionId: state.currentMap.versionId,
    mapIdentity: state.currentMap.mapIdentity,
    relationshipEventHead: state.relationshipEvents.at(-1)?.eventHash || null,
  }
  const plan = {
    contract: 'athlete-living-consult-gu-plan-v1',
    planId: stableId('alc_gu', { kind, trigger, at, binding, blocks }),
    kind,
    trigger,
    createdAt: at,
    audience,
    binding,
    blocks,
    readOnly: true,
    mutationAuthority: 'NONE',
    interactions: [],
  }
  state.guPlans.push(plan)
  return plan
}

function completeMutation(prior, draft, action, code, extras = {}) {
  draft.revision = prior.revision + 1
  const semanticHash = hashCanonicalJson(unsignedAction(action))
  draft.idempotencyLedger[action.idempotencyKey] = {
    semanticHash,
    code,
    firstAppliedRevision: draft.revision,
  }
  const sealed = withStateHash(draft)
  return { ok: true, code, state: sealed, receipt: { actionType: action.type, revision: sealed.revision, beforeStateHash: prior.stateHash, afterStateHash: sealed.stateHash, semanticHash }, ...extras }
}

function failure(state, code, details = null) {
  return { ok: false, code, state, ...(details == null ? {} : { details }) }
}

function normalizeDecision(value) {
  const input = String(value || '').toUpperCase()
  const decision = input === 'APPROVE' ? 'ACCEPT' : input
  assertLivingConsult(['ACCEPT', 'REJECT', 'DEFER'].includes(decision), 'ATHLETE_LIVING_CONSULT_DECISION_INVALID')
  return decision
}

function relativeDateFrom(at, days) {
  const parsed = new Date(at)
  assertLivingConsult(!Number.isNaN(parsed.getTime()), 'ATHLETE_DEVELOPMENT_AGREEMENT_REVIEW_ANCHOR_INVALID')
  assertLivingConsult(Number.isInteger(days) && days >= 1 && days <= 365, 'ATHLETE_DEVELOPMENT_AGREEMENT_REVIEW_WINDOW_INVALID')
  parsed.setUTCDate(parsed.getUTCDate() + days)
  return parsed.toISOString().slice(0, 10)
}

function reviewDateForPlan(plan, at) {
  const timing = plan?.reviewTiming
  if (!timing) return cleanText(plan?.reviewDate, { max: 80 })
  assertLivingConsult(timing.mode === 'RELATIVE_TO_PROPOSAL', 'ATHLETE_DEVELOPMENT_AGREEMENT_REVIEW_TIMING_INVALID')
  return relativeDateFrom(at, Number(timing.days))
}

function consumedMapEvidenceRefs(state) {
  return new Set(state.committedMapChanges.flatMap((change) => change.evidenceRefs || []))
}

function validateEvidenceRef(state, ref) {
  const baselineRefs = new Set([
    ...state.currentMap.boxes.currentReality.claims.map((claim) => claim.id),
    ...state.currentMap.sharedBosContext.map((claim) => claim.id),
    ...state.authorizedEvidence.map((item) => item.id),
  ])
  const authorized = state.authorizedEvidence.find((item) => item.id === ref)
  if (authorized) return authorized.audience === AUDIENCES.JOINT
  return baselineRefs.has(ref)
}

function createPlanFromPayload(state, p, at) {
  const supplied = p.plan || p.agreement
  const hasInlinePlan = ['title', 'athleteFocus', 'instructorFocus', 'oneMove'].some((key) => p[key] != null)
  const plan = supplied || (hasInlinePlan ? p : state.defaultAgreement || createDefaultAthleteDevelopmentAgreement('2026-09-25', {
    athleteName: state.identities?.athleteDisplayName,
    instructorName: state.identities?.instructorDisplayName,
  }))
  const reviewDate = reviewDateForPlan(plan, at)
  const required = ['title', 'athleteFocus', 'instructorFocus', 'oneMove', 'actions', 'evidence', 'support', 'changeCourseTrigger']
  assertLivingConsult(required.every((key) => plan[key] != null), 'ATHLETE_DEVELOPMENT_AGREEMENT_INCOMPLETE')
  assertLivingConsult(Array.isArray(plan.actions) && plan.actions.length > 0, 'ATHLETE_DEVELOPMENT_AGREEMENT_ACTIONS_REQUIRED')
  return {
    contract: 'athlete-development-agreement-v1',
    agreementId: p.planId || stableId('alc_plan', { title: plan.title, oneMove: plan.oneMove, reviewDate, at }),
    title: cleanText(plan.title, { max: 180 }),
    athleteFocus: cleanText(plan.athleteFocus, { max: 500 }),
    instructorFocus: cleanText(plan.instructorFocus, { max: 500 }),
    oneMove: cleanText(plan.oneMove, { max: 700 }),
    actions: plan.actions.map((item, index) => ({
      actionId: item.actionId || `action-${index + 1}`,
      owner: assertActor(item.owner, MAP_CONFIRMERS),
      action: cleanText(item.action, { max: 500 }),
      dueAt: plan.reviewTiming ? reviewDate : item.dueAt || reviewDate,
    })),
    evidence: Array.isArray(plan.evidence) ? plan.evidence.map((item) => cleanText(item, { max: 500 })) : [cleanText(plan.evidence, { max: 500 })],
    reviewDate,
    reviewTiming: plan.reviewTiming
      ? { mode: 'RELATIVE_TO_PROPOSAL', days: Number(plan.reviewTiming.days), anchoredAt: at }
      : { mode: 'EXPLICIT_DATE', anchoredAt: at },
    support: Array.isArray(plan.support) ? plan.support.map((item) => cleanText(item, { max: 500 })) : [cleanText(plan.support, { max: 500 })],
    changeCourseTrigger: cleanText(plan.changeCourseTrigger, { max: 700 }),
    unresolvedItems: (plan.unresolvedItems || []).map((item) => cleanText(item, { max: 500 })),
    proposedAt: at,
    proposedBy: p.proposedBy || ACTORS.MORE,
    stateBinding: { mapVersionId: state.currentMap.versionId, mapIdentity: state.currentMap.mapIdentity },
    decisions: {},
    status: 'PROPOSED',
  }
}

export function createDefaultAthleteDevelopmentAgreement(reviewDate = '2026-09-25', context = {}) {
  const athleteName = context.athleteName || 'Mara'
  const instructorName = context.instructorName || 'Coach Rowan'
  return {
    title: 'Three-practice clarity check',
    athleteFocus: `Tell ${instructorName} whether the first assignment is clear before the first rep.`,
    instructorFocus: 'Name the first assignment early and privately check that it was received.',
    oneMove: 'Run a three-practice first-rep clarity check.',
    actions: [
      { owner: ACTORS.INSTRUCTOR, action: 'Name the first assignment before three comparable practices.', dueAt: reviewDate },
      { owner: ACTORS.ATHLETE, action: 'Say whether the first assignment is clear before the first rep.', dueAt: reviewDate },
    ],
    evidence: ['Keep delivery, receipt, active instructions, and first-rep behavior as separate observations.'],
    reviewDate,
    support: ['Use a private check-in; do not require a public challenge.'],
    changeCourseTrigger: `Pause or change the check if ${athleteName} declines, the practices are not comparable, or it begins to feel evaluative.`,
    unresolvedItems: ['The cause of the early pause remains unresolved.'],
  }
}

export function createInitialLivingConsultState(options = {}) {
  const identities = assertSyntheticIdentity(options)
  const cassetteId = options.cassetteId || 'more-athlete-default-v1'
  const baseline = options.baselineBundle || createLivingConsultBaselineMap(cassetteId)
  assertLivingConsult(baseline.apaArtifact.guarantees.noPersistence === true, 'ATHLETE_LIVING_CONSULT_APA_SOURCE_MUST_BE_IMMUTABLE')
  const state = {
    contract: LIVING_CONSULT_CONTRACT,
    version: LIVING_CONSULT_VERSION,
    namespace: options.namespace || `${LIVING_CONSULT_NAMESPACE}:${cassetteId}`,
    syntheticOnly: true,
    identities,
    sourceBindings: baseline.sourceBindings,
    sourceSnapshots: {
      apa: baseline.apaArtifact,
      bosJoint: clone(options.jointBosContext || baseline.map?.sharedBosContext || safeJointBosClaims()),
      bosPrivateContext: clone(options.privateBosContext || SYNTHETIC_MARA_PRIVATE_BOS_READING),
    },
    ...(options.seedBinding ? { seedBinding: clone(options.seedBinding) } : {}),
    ...(options.defaultAgreement ? { defaultAgreement: clone(options.defaultAgreement) } : {}),
    ...(options.demoScenario ? { demoScenario: clone(options.demoScenario) } : {}),
    baselineMap: baseline.map,
    currentMap: baseline.map,
    mapHistory: [baseline.map],
    committedMapChanges: [],
    phase: SESSION_PHASES.IDLE,
    lifecycleTrace: [{ phase: SESSION_PHASES.IDLE, at: options.asOf || baseline.map.asOf, reason: 'ROUTE_READY_NO_SESSION_STARTED' }],
    sessionCounter: 0,
    session: null,
    sessions: [],
    lastSession: null,
    transcript: [],
    conversationHistory: [],
    evidenceCandidates: [],
    authorizedEvidence: [],
    mapChangeProposals: [],
    planProposals: [],
    acceptedPlan: null,
    interventions: [],
    attempts: [],
    outcomes: [],
    causalReviews: [],
    openLoops: [],
    relationshipEvents: [],
    rslEvents: [],
    guPlans: [],
    agenticNotices: [],
    idempotencyLedger: {},
    externalEffects: { sends: 0, payments: 0, customerWrites: 0, canonicalBosWrites: 0, sourceApaWrites: 0, productionWrites: 0 },
    revision: 0,
    stateHash: null,
  }
  assertNoCustomerOrExternalEffects(state.externalEffects)
  return withStateHash(state)
}

function startSession(state, action, p, at) {
  assertLivingConsult(state.phase === SESSION_PHASES.IDLE && !state.session, 'ATHLETE_LIVING_CONSULT_SESSION_ALREADY_OPEN')
  const draft = clone(state)
  draft.sessionCounter += 1
  const sessionId = p.sessionId || stableId('alc_session', { relationshipId: state.identities.relationshipId, number: draft.sessionCounter, at })
  draft.phase = SESSION_PHASES.STARTED
  draft.session = { sessionId, number: draft.sessionCounter, startedAt: at, purpose: cleanText(p.purpose || 'Understand what matters now and choose the next useful step.', { max: 500 }), mapVersionAtStart: state.currentMap.versionId, startStateHash: state.stateHash }
  draft.transcript = []
  draft.lifecycleTrace.push({ phase: SESSION_PHASES.STARTED, at, sessionId })
  const event = appendRelationshipEvent(draft, { type: 'SESSION_STARTED', actor: action.actor || ACTORS.ATHLETE, at, payload: { sessionNumber: draft.sessionCounter, purpose: draft.session.purpose, mapVersionAtStart: state.currentMap.versionId } })
  const guPlan = addGuPlan(draft, { kind: 'OPENING', trigger: 'SESSION_START_MANDATORY', at, detail: { sessionNumber: draft.sessionCounter } })
  return completeMutation(state, draft, action, 'SESSION_STARTED', { event, guPlan })
}

function appendChat(state, action, p, at) {
  assertLivingConsult(activeSession(state), 'ATHLETE_LIVING_CONSULT_NO_ACTIVE_SESSION')
  const actor = assertActor(action.actor || p.actor, [ACTORS.ATHLETE, ACTORS.INSTRUCTOR, ACTORS.MORE])
  const message = cleanText(p.message || p.text, { max: 6000 })
  const draft = clone(state)
  draft.phase = SESSION_PHASES.ACTIVE
  const turn = { turnId: stableId('alc_turn', { sessionId: draft.session.sessionId, actor, message, at, index: draft.conversationHistory.length }), sessionId: draft.session.sessionId, actor, message, at, canonicalTruth: false }
  draft.transcript.push(turn)
  draft.conversationHistory.push(turn)
  draft.lifecycleTrace.push({ phase: SESSION_PHASES.ACTIVE, at, sessionId: draft.session.sessionId, reason: 'SUBSTANTIVE_ENGAGEMENT' })
  const event = appendRelationshipEvent(draft, { type: 'CONVERSATION_TURN_OBSERVED', actor, at, payload: { turnId: turn.turnId, messageHash: hashCanonicalJson(message), canonicalTruth: false } })
  return completeMutation(state, draft, action, 'CHAT_APPENDED', { turn, event })
}

function captureEvidence(state, action, p, at) {
  assertLivingConsult(activeSession(state), 'ATHLETE_LIVING_CONSULT_NO_ACTIVE_SESSION')
  const sourceActor = assertActor(p.sourceActor || action.actor, MAP_CONFIRMERS)
  const audience = assertAudience(p.audience || AUDIENCES.JOINT)
  const statement = cleanText(p.statement || p.text, { max: 1600 })
  const requiredConfirmers = [...new Set(p.requiredConfirmers || (p.sourceClass === 'SHARED_AGREEMENT' ? MAP_CONFIRMERS : [sourceActor]))]
  requiredConfirmers.forEach((actor) => assertActor(actor, MAP_CONFIRMERS))
  const candidate = {
    candidateId: p.candidateId || stableId('alc_evidence_candidate', { statement, sourceActor, at }),
    statement,
    sourceClass: p.sourceClass || (sourceActor === ACTORS.ATHLETE ? 'ATHLETE_REPORT' : 'INSTRUCTOR_OBSERVATION'),
    sourceActor,
    audience,
    observedAt: p.observedAt || at,
    provenance: clone(p.provenance || { mode: 'SYNTHETIC_SESSION_REPORT', sessionId: state.session.sessionId }),
    requiredConfirmers,
    decisions: {},
    status: 'CANDIDATE_NOT_TRUTH',
    canonicalTruth: false,
    causeEstablished: false,
    createdAt: at,
  }
  assertLivingConsult(!state.evidenceCandidates.some((item) => item.candidateId === candidate.candidateId), 'ATHLETE_LIVING_CONSULT_EVIDENCE_CANDIDATE_EXISTS')
  const draft = clone(state)
  draft.evidenceCandidates.push(candidate)
  const event = appendRelationshipEvent(draft, { type: 'EVIDENCE_CANDIDATE_CREATED', actor: sourceActor, at, audience, payload: { candidateId: candidate.candidateId, statementHash: hashCanonicalJson(statement), sourceClass: candidate.sourceClass, canonicalTruth: false } })
  const notice = addNotice(draft, { kind: 'EVIDENCE_CANDIDATE', title: 'A new account is ready to check.', detail: 'It is a candidate, not part of the Athlete Performance Map yet.', at, sourceEventId: event.eventId, audience })
  return completeMutation(state, draft, action, 'EVIDENCE_CANDIDATE_CAPTURED', { candidate, event, notice })
}

function decideEvidence(state, action, p, at) {
  const actor = assertActor(action.actor || p.actor, MAP_CONFIRMERS)
  const decision = normalizeDecision(p.decision)
  const draft = clone(state)
  const candidate = draft.evidenceCandidates.find((item) => item.candidateId === p.candidateId)
  assertLivingConsult(candidate, 'ATHLETE_LIVING_CONSULT_EVIDENCE_CANDIDATE_NOT_FOUND')
  assertLivingConsult(['CANDIDATE_NOT_TRUTH', 'AWAITING_CONFIRMATION'].includes(candidate.status), 'ATHLETE_LIVING_CONSULT_EVIDENCE_CANDIDATE_ALREADY_DECIDED')
  assertLivingConsult(candidate.requiredConfirmers.includes(actor), 'ATHLETE_LIVING_CONSULT_EVIDENCE_CONFIRMATION_SCOPE_INVALID')
  if (decision === 'ACCEPT') assertLivingConsult(p.confirmation === EVIDENCE_CONFIRMATION, 'ATHLETE_LIVING_CONSULT_EVIDENCE_EXACT_CONFIRMATION_REQUIRED')
  candidate.decisions[actor] = { decision, at, confirmation: decision === 'ACCEPT' ? p.confirmation : null }
  if (decision === 'REJECT') candidate.status = 'REJECTED_NO_MUTATION'
  else if (decision === 'DEFER') candidate.status = 'DEFERRED_NO_MUTATION'
  else if (candidate.requiredConfirmers.every((role) => candidate.decisions[role]?.decision === 'ACCEPT')) {
    candidate.status = 'AUTHORIZED'
    const authorized = {
      id: stableId('alc_evidence', { candidateId: candidate.candidateId, decisions: candidate.decisions }),
      candidateId: candidate.candidateId,
      statement: candidate.statement,
      sourceClass: candidate.sourceClass,
      sourceActor: candidate.sourceActor,
      audience: candidate.audience,
      observedAt: candidate.observedAt,
      provenance: candidate.provenance,
      epistemicStatus: candidate.sourceClass === 'SHARED_AGREEMENT' ? 'AGREED' : 'CONFIRMED_SOURCE_REPORT',
      confirmedBy: clone(candidate.decisions),
      authorizedAt: at,
      causalClaim: false,
    }
    draft.authorizedEvidence.push(authorized)
    const rsl = appendRslEvent(draft, { type: 'EVIDENCE_AUTHORIZED', actor, at, audience: candidate.audience, meaning: candidate.statement, refs: { evidenceId: authorized.id, candidateId: candidate.candidateId } })
    candidate.authorizedEvidenceId = authorized.id
    candidate.rslEventId = rsl.rslEventId
  } else candidate.status = 'AWAITING_CONFIRMATION'
  const event = appendRelationshipEvent(draft, { type: 'EVIDENCE_CANDIDATE_DECIDED', actor, at, audience: candidate.audience, payload: { candidateId: candidate.candidateId, decision, resultingStatus: candidate.status, canonicalTruthMutation: candidate.status === 'AUTHORIZED' } })
  if (candidate.status === 'AUTHORIZED') addNotice(draft, { kind: 'EVIDENCE_AUTHORIZED', title: 'The new account is confirmed.', detail: 'It can now support a proposed map change. It does not establish a cause by itself.', at, sourceEventId: event.eventId, audience: candidate.audience })
  return completeMutation(state, draft, action, `EVIDENCE_${candidate.status}`, { candidate: clone(candidate), event })
}

function proposeMapChange(state, action, p, at) {
  assertLivingConsult(activeSession(state), 'ATHLETE_LIVING_CONSULT_NO_ACTIVE_SESSION')
  const consumedEvidenceRefs = consumedMapEvidenceRefs(state)
  const candidateIds = p.candidateIds || []
  const resolvedCandidateEvidence = candidateIds.map((candidateId) => state.evidenceCandidates.find((item) => item.candidateId === candidateId)?.authorizedEvidenceId).filter(Boolean)
  const fallbackEvidenceId = state.authorizedEvidence
    .filter((item) => item.audience === AUDIENCES.JOINT && !consumedEvidenceRefs.has(item.id))
    .at(-1)?.id || null
  const evidenceInput = Array.isArray(p.evidenceRefs) && p.evidenceRefs.length
    ? p.evidenceRefs
    : resolvedCandidateEvidence.length
      ? resolvedCandidateEvidence
      : fallbackEvidenceId
        ? [fallbackEvidenceId]
        : []
  const evidenceRefs = [...new Set(evidenceInput)]
  const fallback = evidenceRefs[0] ? createClarityMapChangeCandidate(evidenceRefs[0]) : null
  const delta = validateMapDelta(p.delta || p.mapDelta || fallback?.delta || {})
  assertLivingConsult(evidenceRefs.length > 0 && evidenceRefs.every((ref) => validateEvidenceRef(state, ref)), 'ATHLETE_LIVING_CONSULT_MAP_CHANGE_EVIDENCE_INVALID')
  assertLivingConsult(evidenceRefs.every((ref) => !consumedEvidenceRefs.has(ref)), 'ATHLETE_LIVING_CONSULT_MAP_CHANGE_EVIDENCE_ALREADY_CONSUMED')
  const candidate = {
    proposalId: p.proposalId || stableId('alc_map_proposal', { title: p.title || fallback?.title, summary: p.summary || fallback?.summary, evidenceRefs, delta, at }),
    title: cleanText(p.title || fallback?.title, { max: 180 }),
    summary: cleanText(p.summary || fallback?.summary, { max: 700 }),
    reason: cleanText(p.reason || fallback?.reason, { max: 1000 }),
    evidenceRefs,
    delta: clone(delta),
    uncertainty: cleanText(p.uncertainty || fallback?.uncertainty || 'The available evidence does not establish a cause.', { max: 700 }),
    falsifier: cleanText(p.falsifier || fallback?.falsifier || 'Comparable future evidence could weaken or change this interpretation.', { max: 700 }),
    stateBinding: { mapVersionId: state.currentMap.versionId, mapIdentity: state.currentMap.mapIdentity, proposedStateHash: state.stateHash },
    requiredConfirmers: clone(MAP_CONFIRMERS),
    decisions: {},
    status: 'PROPOSED',
    proposedAt: at,
    proposedBy: action.actor || ACTORS.MORE,
    causeEstablished: false,
  }
  assertLivingConsult(!state.mapChangeProposals.some((item) => item.proposalId === candidate.proposalId), 'ATHLETE_LIVING_CONSULT_MAP_PROPOSAL_EXISTS')
  const draft = clone(state)
  draft.mapChangeProposals.push(candidate)
  const event = appendRelationshipEvent(draft, { type: 'MAP_CHANGE_PROPOSED', actor: action.actor || ACTORS.MORE, at, payload: { proposalId: candidate.proposalId, evidenceRefs, boundMapVersionId: candidate.stateBinding.mapVersionId, causeEstablished: false } })
  const notice = addNotice(draft, { kind: 'MAP_CHANGE_PROPOSED', title: 'A possible map change is ready.', detail: `${state.identities.athleteDisplayName} and ${state.identities.instructorDisplayName} each decide. Nothing changed yet.`, at, sourceEventId: event.eventId })
  return completeMutation(state, draft, action, 'MAP_CHANGE_PROPOSED', { proposal: candidate, event, notice })
}

function decideMapChange(state, action, p, at) {
  const actor = assertActor(action.actor || p.actor, MAP_CONFIRMERS)
  const decision = normalizeDecision(p.decision)
  const draft = clone(state)
  const proposal = draft.mapChangeProposals.find((item) => item.proposalId === p.proposalId)
  assertLivingConsult(proposal, 'ATHLETE_LIVING_CONSULT_MAP_PROPOSAL_NOT_FOUND')
  assertLivingConsult(['PROPOSED', 'AWAITING_CONFIRMATION'].includes(proposal.status), 'ATHLETE_LIVING_CONSULT_MAP_PROPOSAL_ALREADY_DECIDED')
  assertLivingConsult(proposal.stateBinding.mapIdentity === state.currentMap.mapIdentity, 'ATHLETE_LIVING_CONSULT_MAP_PROPOSAL_STALE')
  if (decision === 'ACCEPT') assertLivingConsult(p.confirmation === ATHLETE_MAP_CONFIRMATION, 'ATHLETE_LIVING_CONSULT_MAP_EXACT_CONFIRMATION_REQUIRED')
  proposal.decisions[actor] = { decision, at, confirmation: decision === 'ACCEPT' ? p.confirmation : null }
  let mapChanged = false
  let guPlan = null
  if (decision === 'REJECT') proposal.status = 'REJECTED_NO_MUTATION'
  else if (decision === 'DEFER') proposal.status = 'DEFERRED_NO_MUTATION'
  else if (MAP_CONFIRMERS.every((role) => proposal.decisions[role]?.decision === 'ACCEPT')) {
    proposal.status = 'COMMITTED'
    proposal.committedAt = at
    const committed = {
      proposalId: proposal.proposalId,
      title: proposal.title,
      summary: proposal.summary,
      reason: proposal.reason,
      evidenceRefs: proposal.evidenceRefs,
      delta: proposal.delta,
      uncertainty: proposal.uncertainty,
      falsifier: proposal.falsifier,
      committedAt: at,
      confirmedBy: clone(proposal.decisions),
      sourceMapVersionId: state.currentMap.versionId,
      evidenceConsumptionId: stableId('alc_map_evidence_consumption', { proposalId: proposal.proposalId, evidenceRefs: proposal.evidenceRefs, sourceMapVersionId: state.currentMap.versionId }),
    }
    draft.committedMapChanges.push(committed)
    const regenerated = regenerateLivingConsultMap({ baselineMap: draft.baselineMap, authorizedEvidence: draft.authorizedEvidence, committedChanges: draft.committedMapChanges, asOf: at })
    assertLivingConsult(regenerated.mapIdentity !== state.currentMap.mapIdentity, 'ATHLETE_LIVING_CONSULT_MAP_REGENERATION_NO_CHANGE')
    draft.currentMap = regenerated
    draft.mapHistory.push(regenerated)
    committed.resultMapVersionId = regenerated.versionId
    committed.evidenceConsumption = committed.evidenceRefs.map((evidenceId) => ({
      evidenceId,
      consumptionId: stableId('alc_map_evidence_ref', { evidenceId, proposalId: committed.proposalId }),
      consumedByProposalId: committed.proposalId,
      sourceMapVersionId: committed.sourceMapVersionId,
      resultMapVersionId: regenerated.versionId,
      consumedAt: at,
    }))
    mapChanged = true
    appendRslEvent(draft, { type: 'APA_MAP_CHANGE_AUTHORIZED', actor, at, audience: AUDIENCES.JOINT, meaning: proposal.summary, refs: { proposalId: proposal.proposalId, mapVersionId: regenerated.versionId, evidenceConsumptionId: committed.evidenceConsumptionId }, temporal: { effectiveAt: at } })
  } else proposal.status = 'AWAITING_CONFIRMATION'
  const committed = mapChanged ? draft.committedMapChanges.at(-1) : null
  const event = appendRelationshipEvent(draft, { type: 'MAP_CHANGE_DECIDED', actor, at, payload: { proposalId: proposal.proposalId, decision, resultingStatus: proposal.status, mapChanged, evidenceConsumptionId: committed?.evidenceConsumptionId || null, resultMapVersionId: committed?.resultMapVersionId || null } })
  if (mapChanged) {
    guPlan = addGuPlan(draft, { kind: 'MAP_CHANGE', trigger: 'AUTHORIZED_MAP_CHANGE_MANDATORY', at, detail: { title: proposal.title, summary: proposal.summary } })
    addNotice(draft, { kind: 'MAP_REGENERATED', title: 'The whole Athlete Performance Map was rebuilt.', detail: `Version ${draft.currentMap.version} now includes the jointly confirmed change. Earlier versions remain available.`, at, sourceEventId: event.eventId })
  }
  return completeMutation(state, draft, action, mapChanged ? 'MAP_CHANGE_COMMITTED_AND_REGENERATED' : `MAP_CHANGE_${proposal.status}`, { proposal: clone(proposal), event, guPlan, mapChanged })
}

function proposePlan(state, action, p, at) {
  assertLivingConsult(activeSession(state), 'ATHLETE_LIVING_CONSULT_NO_ACTIVE_SESSION')
  const agreement = createPlanFromPayload(state, p, at)
  assertLivingConsult(!state.planProposals.some((item) => item.agreementId === agreement.agreementId), 'ATHLETE_DEVELOPMENT_AGREEMENT_EXISTS')
  const draft = clone(state)
  draft.planProposals.push(agreement)
  const event = appendRelationshipEvent(draft, { type: 'ATHLETE_DEVELOPMENT_AGREEMENT_PROPOSED', actor: action.actor || ACTORS.MORE, at, payload: { agreementId: agreement.agreementId, boundMapVersionId: agreement.stateBinding.mapVersionId, accepted: false } })
  const notice = addNotice(draft, { kind: 'PLAN_PROPOSED', title: 'A development agreement is ready to review.', detail: `It remains a proposal until both ${state.identities.athleteDisplayName} and ${state.identities.instructorDisplayName} agree.`, at, sourceEventId: event.eventId })
  return completeMutation(state, draft, action, 'ATHLETE_DEVELOPMENT_AGREEMENT_PROPOSED', { agreement, event, notice })
}

function decidePlan(state, action, p, at) {
  const actor = assertActor(action.actor || p.actor, PLAN_CONFIRMERS)
  const decision = normalizeDecision(p.decision)
  const draft = clone(state)
  const agreement = draft.planProposals.find((item) => item.agreementId === (p.agreementId || p.planId))
  assertLivingConsult(agreement, 'ATHLETE_DEVELOPMENT_AGREEMENT_NOT_FOUND')
  assertLivingConsult(['PROPOSED', 'AWAITING_CONFIRMATION'].includes(agreement.status), 'ATHLETE_DEVELOPMENT_AGREEMENT_ALREADY_DECIDED')
  assertLivingConsult(agreement.stateBinding.mapIdentity === state.currentMap.mapIdentity, 'ATHLETE_DEVELOPMENT_AGREEMENT_STALE')
  if (decision === 'ACCEPT') assertLivingConsult(p.confirmation === ATHLETE_PLAN_CONFIRMATION, 'ATHLETE_DEVELOPMENT_AGREEMENT_EXACT_CONFIRMATION_REQUIRED')
  agreement.decisions[actor] = { decision, at, confirmation: decision === 'ACCEPT' ? p.confirmation : null }
  let intervention = null
  if (decision === 'REJECT') agreement.status = 'REJECTED_NO_MUTATION'
  else if (decision === 'DEFER') agreement.status = 'DEFERRED_NO_MUTATION'
  else if (PLAN_CONFIRMERS.every((role) => agreement.decisions[role]?.decision === 'ACCEPT')) {
    agreement.status = 'ACCEPTED'
    agreement.acceptedAt = at
    agreement.agreedBy = clone(agreement.decisions)
    draft.acceptedPlan = clone(agreement)
    intervention = {
      interventionId: stableId('alc_intervention', { agreementId: agreement.agreementId, acceptedAt: at }),
      agreementId: agreement.agreementId,
      sessionId: state.session?.sessionId || null,
      cycleNumber: draft.interventions.length + 1,
      kind: 'ATHLETE_DEVELOPMENT_EXPERIMENT',
      title: agreement.title,
      oneMove: agreement.oneMove,
      acceptedAt: at,
      agreedBy: clone(agreement.decisions),
      observationWindow: `Through ${agreement.reviewDate}`,
      falsifier: agreement.changeCourseTrigger,
      status: 'open',
      causalConfidence: 'NOT_ASSESSED',
      attemptIds: [],
      outcomeIds: [],
      causalReviewIds: [],
    }
    draft.interventions.push(intervention)
    draft.openLoops.push({ loopId: stableId('alc_loop', intervention.interventionId), interventionId: intervention.interventionId, title: agreement.title, status: 'open', openedAt: at, dueAt: agreement.reviewDate, nextReviewAt: agreement.reviewDate })
    appendRslEvent(draft, { type: 'PLAN_AGREED', actor, at, audience: AUDIENCES.JOINT, meaning: `${agreement.title}: ${agreement.oneMove}`, refs: { agreementId: agreement.agreementId, interventionId: intervention.interventionId }, temporal: { dueAt: agreement.reviewDate } })
  } else agreement.status = 'AWAITING_CONFIRMATION'
  const event = appendRelationshipEvent(draft, { type: 'ATHLETE_DEVELOPMENT_AGREEMENT_DECIDED', actor, at, payload: { agreementId: agreement.agreementId, decision, resultingStatus: agreement.status, interventionId: intervention?.interventionId || null } })
  if (intervention) addNotice(draft, { kind: 'PLAN_AGREED', title: 'The Athlete Development Agreement is agreed.', detail: `Review is set for ${agreement.reviewDate}.`, at, sourceEventId: event.eventId })
  return completeMutation(state, draft, action, intervention ? 'ATHLETE_DEVELOPMENT_AGREEMENT_ACCEPTED' : `ATHLETE_DEVELOPMENT_AGREEMENT_${agreement.status}`, { agreement: clone(agreement), intervention, event })
}

function recordAttempt(state, action, p, at) {
  const intervention = state.interventions.find((item) => item.interventionId === p.interventionId)
  assertLivingConsult(intervention && ['open', 'due', 'attempted', 'missed'].includes(intervention.status), 'ATHLETE_LIVING_CONSULT_ACTIVE_INTERVENTION_REQUIRED')
  const executionInput = String(p.executionState || p.execution || p.status || 'attempted').toLowerCase()
  const partialExecution = ['partial', 'partially_attempted', 'attempted_partially'].includes(executionInput)
  const executionState = partialExecution ? 'attempted' : executionInput
  assertLivingConsult(ATTEMPT_STATES.has(executionState), 'ATHLETE_LIVING_CONSULT_ATTEMPT_STATE_INVALID')
  const observation = cleanText(p.observation || p.statement, { max: 1400 })
  const actor = assertActor(action.actor || p.actor, MAP_CONFIRMERS)
  const draft = clone(state)
  const attempt = {
    attemptId: p.attemptId || stableId('alc_attempt', { interventionId: intervention.interventionId, observation, executionState, at }),
    interventionId: intervention.interventionId,
    agreementId: intervention.agreementId,
    sessionId: state.session?.sessionId || null,
    executionState,
    observation,
    observedBy: actor,
    evidenceRefs: clone(p.evidenceRefs || []),
    attemptedAt: p.attemptedAt || at,
    partialExecution,
    partialExecutionIsCompletion: false,
    outcomeIds: [],
  }
  assertLivingConsult(!state.attempts.some((item) => item.attemptId === attempt.attemptId), 'ATHLETE_LIVING_CONSULT_ATTEMPT_EXISTS')
  draft.attempts.push(attempt)
  const draftIntervention = draft.interventions.find((item) => item.interventionId === intervention.interventionId)
  if (!Array.isArray(draftIntervention.attemptIds)) draftIntervention.attemptIds = []
  draftIntervention.attemptIds.push(attempt.attemptId)
  draftIntervention.status = executionState === 'intelligently_abandoned' ? 'intelligently_abandoned' : executionState === 'completed' ? 'completed' : executionState
  const loop = draft.openLoops.find((item) => item.interventionId === intervention.interventionId)
  if (loop) loop.status = executionState
  appendRslEvent(draft, { type: 'ATTEMPT_RECORDED', actor, at, audience: AUDIENCES.JOINT, meaning: observation, refs: { interventionId: intervention.interventionId, attemptId: attempt.attemptId }, temporal: { attemptedAt: attempt.attemptedAt } })
  const event = appendRelationshipEvent(draft, { type: 'INTERVENTION_ATTEMPT_RECORDED', actor, at, payload: { interventionId: intervention.interventionId, attemptId: attempt.attemptId, executionState, completionClaimed: executionState === 'completed' } })
  const notice = addNotice(draft, { kind: 'ATTEMPT_RECORDED', title: 'What was tried is now recorded.', detail: executionState === 'completed' ? 'The agreed actions were reported complete; an outcome still must be observed separately.' : 'This is not being treated as full completion.', at, sourceEventId: event.eventId })
  return completeMutation(state, draft, action, 'INTERVENTION_ATTEMPT_RECORDED', { attempt, event, notice })
}

function recordOutcome(state, action, p, at) {
  const attempt = state.attempts.find((item) => item.attemptId === p.attemptId)
  assertLivingConsult(attempt, 'ATHLETE_LIVING_CONSULT_ATTEMPT_REQUIRED_FOR_OUTCOME')
  assertLivingConsult(!p.interventionId || p.interventionId === attempt.interventionId, 'ATHLETE_LIVING_CONSULT_OUTCOME_INTERVENTION_MISMATCH')
  assertLivingConsult(['attempted', 'completed'].includes(attempt.executionState), 'ATHLETE_LIVING_CONSULT_EXECUTION_REQUIRED_FOR_OUTCOME')
  const classificationInput = String(p.classification || 'INCONCLUSIVE').toUpperCase()
  const classification = classificationInput === 'MIXED_INCONCLUSIVE' ? 'MIXED' : classificationInput
  assertLivingConsult(OUTCOME_CLASSIFICATIONS.has(classification), 'ATHLETE_LIVING_CONSULT_OUTCOME_CLASSIFICATION_INVALID')
  const statement = cleanText(p.statement || p.observation, { max: 1600 })
  const actor = assertActor(action.actor || p.actor, MAP_CONFIRMERS)
  const confounders = (p.confounders || []).map((item) => cleanText(item, { max: 400 }))
  const externalShocks = (p.externalShocks || []).map((item) => cleanText(item, { max: 400 }))
  const draft = clone(state)
  const outcome = {
    outcomeId: p.outcomeId || stableId('alc_outcome', { attemptId: attempt.attemptId, statement, classification, at }),
    interventionId: attempt.interventionId,
    attemptId: attempt.attemptId,
    sessionId: state.session?.sessionId || null,
    classification,
    statement,
    observedBy: actor,
    observedAt: p.observedAt || at,
    evidenceRefs: clone(p.evidenceRefs || []),
    confounders,
    externalShocks,
    causalConfidence: 'NOT_ASSESSED',
    causalTruth: false,
    causalReviewIds: [],
  }
  assertLivingConsult(!state.outcomes.some((item) => item.outcomeId === outcome.outcomeId), 'ATHLETE_LIVING_CONSULT_OUTCOME_EXISTS')
  draft.outcomes.push(outcome)
  const draftAttempt = draft.attempts.find((item) => item.attemptId === attempt.attemptId)
  if (!Array.isArray(draftAttempt.outcomeIds)) draftAttempt.outcomeIds = []
  draftAttempt.outcomeIds.push(outcome.outcomeId)
  const draftIntervention = draft.interventions.find((item) => item.interventionId === attempt.interventionId)
  if (!Array.isArray(draftIntervention.outcomeIds)) draftIntervention.outcomeIds = []
  draftIntervention.outcomeIds.push(outcome.outcomeId)
  appendRslEvent(draft, { type: 'OUTCOME_OBSERVED', actor, at, audience: AUDIENCES.JOINT, meaning: statement, refs: { interventionId: attempt.interventionId, attemptId: attempt.attemptId, outcomeId: outcome.outcomeId }, temporal: { observedAt: outcome.observedAt } })
  const event = appendRelationshipEvent(draft, { type: 'INTERVENTION_OUTCOME_OBSERVED', actor, at, payload: { interventionId: attempt.interventionId, attemptId: attempt.attemptId, outcomeId: outcome.outcomeId, classification, confounderCount: confounders.length, causalTruth: false } })
  const notice = addNotice(draft, { kind: 'OUTCOME_OBSERVED', title: 'A result is ready to understand together.', detail: confounders.length ? 'The result has confounders. It is not being treated as proof of cause.' : 'The result is linked to the exact attempt; cause is still not assumed.', at, sourceEventId: event.eventId })
  return completeMutation(state, draft, action, 'INTERVENTION_OUTCOME_OBSERVED', { outcome, event, notice })
}

function assessCausalConfidence(state, action, p, at) {
  const outcome = state.outcomes.find((item) => item.outcomeId === p.outcomeId)
  assertLivingConsult(outcome, 'ATHLETE_LIVING_CONSULT_OUTCOME_REQUIRED_FOR_CAUSAL_REVIEW')
  const confidence = String(p.confidence || 'INCONCLUSIVE').toUpperCase()
  assertLivingConsult(CAUSAL_CONFIDENCE.has(confidence), 'ATHLETE_LIVING_CONSULT_CAUSAL_CONFIDENCE_INVALID')
  assertLivingConsult(!(outcome.confounders.length || outcome.externalShocks.length) || confidence !== 'BOUNDED_MODERATE', 'ATHLETE_LIVING_CONSULT_CONFOUNDED_OUTCOME_OVERCLAIM')
  const rationale = cleanText(p.rationale, { max: 1400 })
  const draft = clone(state)
  const review = {
    causalReviewId: p.causalReviewId || stableId('alc_causal_review', { outcomeId: outcome.outcomeId, confidence, rationale, at }),
    interventionId: outcome.interventionId,
    attemptId: outcome.attemptId,
    outcomeId: outcome.outcomeId,
    sessionId: state.session?.sessionId || null,
    confidence,
    rationale,
    confoundersPreserved: clone(outcome.confounders),
    externalShocksPreserved: clone(outcome.externalShocks),
    causalProof: false,
    assessedAt: at,
  }
  assertLivingConsult(!state.causalReviews.some((item) => item.causalReviewId === review.causalReviewId), 'ATHLETE_LIVING_CONSULT_CAUSAL_REVIEW_EXISTS')
  draft.causalReviews.push(review)
  const draftOutcome = draft.outcomes.find((item) => item.outcomeId === outcome.outcomeId)
  draftOutcome.causalConfidence = confidence
  if (!Array.isArray(draftOutcome.causalReviewIds)) draftOutcome.causalReviewIds = []
  draftOutcome.causalReviewIds.push(review.causalReviewId)
  const draftIntervention = draft.interventions.find((item) => item.interventionId === outcome.interventionId)
  if (draftIntervention) {
    draftIntervention.causalConfidence = confidence
    if (!Array.isArray(draftIntervention.causalReviewIds)) draftIntervention.causalReviewIds = []
    draftIntervention.causalReviewIds.push(review.causalReviewId)
  }
  appendRslEvent(draft, { type: 'CAUSAL_REVIEW_RECORDED', actor: action.actor || ACTORS.MORE, at, audience: AUDIENCES.JOINT, meaning: rationale, refs: { interventionId: outcome.interventionId, attemptId: outcome.attemptId, outcomeId: outcome.outcomeId, causalReviewId: review.causalReviewId } })
  const event = appendRelationshipEvent(draft, { type: 'CAUSAL_CONFIDENCE_ASSESSED', actor: action.actor || ACTORS.MORE, at, payload: { ...review } })
  return completeMutation(state, draft, action, 'CAUSAL_CONFIDENCE_ASSESSED', { causalReview: review, event })
}

function updateOpenLoop(state, action, p, at) {
  const status = String(p.status || '').toLowerCase()
  assertLivingConsult(OPEN_LOOP_STATES.includes(status), 'ATHLETE_LIVING_CONSULT_OPEN_LOOP_STATUS_INVALID')
  const draft = clone(state)
  const loop = draft.openLoops.find((item) => item.loopId === p.loopId)
  assertLivingConsult(loop, 'ATHLETE_LIVING_CONSULT_OPEN_LOOP_NOT_FOUND')
  // Execution states are established through RECORD_ATTEMPT, not by relabeling a loop.
  assertLivingConsult(!['attempted', 'completed', 'missed', 'intelligently_abandoned'].includes(status), 'ATHLETE_LIVING_CONSULT_OPEN_LOOP_EXECUTION_REQUIRES_ATTEMPT')
  const actor = assertActor(action.actor || p.actor, [ACTORS.ATHLETE, ACTORS.INSTRUCTOR, ACTORS.SYSTEM])
  if (status === 'due') assertLivingConsult(actor === ACTORS.SYSTEM && p.authority === 'DETERMINISTIC_TIME', 'ATHLETE_LIVING_CONSULT_DUE_STATUS_AUTHORITY_INVALID')
  if (['superseded', 'unresolved'].includes(status)) assertLivingConsult(p.authority === 'JOINT_EXPLICIT', 'ATHLETE_LIVING_CONSULT_OPEN_LOOP_JOINT_AUTHORITY_REQUIRED')
  const reason = cleanText(p.reason, { max: 900 })
  const priorStatus = loop.status
  loop.status = status
  loop.statusChangedAt = at
  loop.statusReason = reason
  const intervention = draft.interventions.find((item) => item.interventionId === loop.interventionId)
  if (intervention) intervention.status = status
  const event = appendRelationshipEvent(draft, { type: 'OPEN_LOOP_STATUS_CHANGED', actor, at, payload: { loopId: loop.loopId, interventionId: loop.interventionId, priorStatus, status, reason, authority: p.authority } })
  appendRslEvent(draft, { type: 'OPEN_LOOP_STATUS_CHANGED', actor, at, audience: AUDIENCES.JOINT, meaning: `${loop.title}: ${reason}`, refs: { loopId: loop.loopId, interventionId: loop.interventionId }, temporal: { statusChangedAt: at, status } })
  return completeMutation(state, draft, action, 'OPEN_LOOP_STATUS_CHANGED', { openLoop: clone(loop), event })
}

function acknowledgeNotice(state, action, p, at) {
  const draft = clone(state)
  const notice = draft.agenticNotices.find((item) => item.noticeId === p.noticeId)
  assertLivingConsult(notice, 'ATHLETE_LIVING_CONSULT_NOTICE_NOT_FOUND')
  if (notice.acknowledgedAt) return { ok: true, code: 'NOTICE_ALREADY_ACKNOWLEDGED', state, replayed: true, notice: clone(notice) }
  notice.acknowledgedAt = at
  notice.acknowledgedBy = action.actor || ACTORS.ATHLETE
  const event = appendRelationshipEvent(draft, { type: 'AGENTIC_NOTICE_ACKNOWLEDGED', actor: action.actor || ACTORS.ATHLETE, at, audience: notice.audience, payload: { noticeId: notice.noticeId, sourceEventId: notice.sourceEventId } })
  return completeMutation(state, draft, action, 'AGENTIC_NOTICE_ACKNOWLEDGED', { notice: clone(notice), event })
}

function addMiddleGu(state, action, p, at) {
  assertLivingConsult(activeSession(state), 'ATHLETE_LIVING_CONSULT_NO_ACTIVE_SESSION')
  assertLivingConsult(p.materiallyUseful === true, 'ATHLETE_LIVING_CONSULT_MIDDLE_GU_MUST_BE_RESTRAINED')
  const draft = clone(state)
  const guPlan = addGuPlan(draft, { kind: 'MIDDLE', trigger: p.trigger || 'MODEL_SELECTED_USEFUL_REPRESENTATION', at, detail: { eyebrow: p.eyebrow, title: cleanText(p.title, { max: 180 }), body: cleanText(p.body, { max: 1000 }) } })
  const event = appendRelationshipEvent(draft, { type: 'READ_ONLY_GU_CREATED', actor: action.actor || ACTORS.MORE, at, payload: { planId: guPlan.planId, kind: guPlan.kind, mutationAuthority: 'NONE' } })
  return completeMutation(state, draft, action, 'READ_ONLY_MIDDLE_GU_CREATED', { guPlan, event })
}

function endSession(state, action, p, at) {
  assertLivingConsult(activeSession(state), 'ATHLETE_LIVING_CONSULT_NO_ACTIVE_SESSION')
  const closingActor = assertActor(action.actor || ACTORS.ATHLETE, MAP_CONFIRMERS)
  const draft = clone(state)
  const session = clone(draft.session)
  const summaryFields = ['whatMattered', 'whatChanged', 'whatLearned', 'whatDecided', 'remainsOpen', 'pickupNext']
  const suppliedMeaning = summaryFields
    .map((field) => typeof p[field] === 'string' ? p[field].trim() : '')
    .filter(Boolean)
  const hasHumanTurn = draft.transcript.some((turn) => turn.sessionId === session.sessionId && MAP_CONFIRMERS.includes(turn.actor))
  const hasHumanGovernedAction = draft.relationshipEvents.some((item) => item.sessionId === session.sessionId
    && MAP_CONFIRMERS.includes(item.actor)
    && !['SESSION_STARTED', 'CONVERSATION_TURN_OBSERVED', 'AGENTIC_NOTICE_ACKNOWLEDGED'].includes(item.type))
  const substantive = hasHumanTurn || hasHumanGovernedAction || suppliedMeaning.length > 0
  const summary = {
    whatMattered: cleanText(p.whatMattered || (substantive ? 'The session included a real exchange, but no shared summary was written down.' : 'No coaching conversation took place in this session.'), { max: 800 }),
    whatChanged: cleanText(p.whatChanged || 'Nothing was changed in the shared map when this session closed.', { max: 800 }),
    whatLearned: cleanText(p.whatLearned || 'No lasting learning was written down.', { max: 800 }),
    whatDecided: cleanText(p.whatDecided || 'No new decision was recorded.', { max: 800 }),
    remainsOpen: cleanText(p.remainsOpen || 'No new open question was written down.', { max: 800 }),
    pickupNext: cleanText(p.pickupNext || 'Begin with what matters when the next session starts.', { max: 800 }),
  }
  draft.phase = SESSION_PHASES.ENDING
  draft.lifecycleTrace.push({ phase: SESSION_PHASES.ENDING, at, sessionId: session.sessionId })
  appendRelationshipEvent(draft, { type: 'SESSION_ENDING', actor: closingActor, at, payload: { sessionNumber: session.number } })
  const guPlan = addGuPlan(draft, { kind: 'CLOSING', trigger: 'SESSION_END_MANDATORY', at, detail: summary })
  draft.phase = SESSION_PHASES.NOTES_READY
  draft.lifecycleTrace.push({ phase: SESSION_PHASES.NOTES_READY, at, sessionId: session.sessionId })
  const durableMeaning = [p.whatMattered, p.pickupNext]
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean)
    .join(' ')
    .slice(0, 1200)
    || suppliedMeaning[0]
  const rsl = substantive && suppliedMeaning.length
    ? appendRslEvent(draft, { type: 'SESSION_LEARNING_RECORDED', actor: closingActor, at, audience: AUDIENCES.PRIVATE, meaning: durableMeaning, refs: { sessionId: session.sessionId, closingGuPlanId: guPlan.planId }, temporal: { endedAt: at } })
    : null
  const closed = { ...session, endedAt: at, endMapVersionId: draft.currentMap.versionId, summary, substantive, durableMeaningRecorded: Boolean(rsl), rslEventId: rsl?.rslEventId || null, transcriptTurnIds: draft.transcript.map((turn) => turn.turnId) }
  draft.sessions.push(closed)
  draft.lastSession = closed
  const event = appendRelationshipEvent(draft, { type: 'SESSION_CLOSED', actor: closingActor, at, payload: { sessionNumber: session.number, sessionId: session.sessionId, closingGuPlanId: guPlan.planId, pickupNext: summary.pickupNext, substantive, durableMeaningRecorded: Boolean(rsl) } })
  draft.session = null
  draft.phase = SESSION_PHASES.IDLE
  draft.lifecycleTrace.push({ phase: SESSION_PHASES.IDLE, at, sessionId: session.sessionId, reason: 'SESSION_CLOSED' })
  draft.transcript = []
  return completeMutation(state, draft, action, 'SESSION_ENDED_NOTES_READY_AND_CLOSED', { session: closed, summary, guPlan, event })
}

function visibleMap(state) {
  const map = clone(state.currentMap)
  map.authorizedLivingEvidence = map.authorizedLivingEvidence.filter((item) => item.audience === AUDIENCES.JOINT)
  const visibleEvidenceIds = new Set(map.authorizedLivingEvidence.map((item) => item.id))
  if (map.boxes.currentReality.livingClaims) map.boxes.currentReality.livingClaims = map.boxes.currentReality.livingClaims.filter((item) => (item.evidenceRefs || []).every((id) => visibleEvidenceIds.has(id)))
  if (map.boxes.evidence.livingLedger) map.boxes.evidence.livingLedger = map.boxes.evidence.livingLedger.filter((item) => visibleEvidenceIds.has(item.id))
  map.authorizedChanges = map.authorizedChanges.filter((item) => item.evidenceRefs.every((id) => visibleEvidenceIds.has(id) || !state.authorizedEvidence.some((evidence) => evidence.id === id && evidence.audience !== AUDIENCES.JOINT)))
  delete map.mapIdentity
  return map
}

function shareableAgreement(state) {
  if (!state.acceptedPlan) return null
  const plan = state.acceptedPlan
  return {
    title: plan.title,
    athleteFocus: plan.athleteFocus,
    instructorFocus: plan.instructorFocus,
    oneMove: plan.oneMove,
    actions: clone(plan.actions),
    evidence: clone(plan.evidence),
    reviewDate: plan.reviewDate,
    support: clone(plan.support),
    changeCourseTrigger: plan.changeCourseTrigger,
    unresolvedItems: clone(plan.unresolvedItems),
    agreedBy: {
      athlete: { displayName: state.identities.athleteDisplayName, agreedAt: plan.decisions.athlete?.at || null },
      instructor: { displayName: state.identities.instructorDisplayName, agreedAt: plan.decisions.instructor?.at || null },
    },
    status: 'AGREED',
  }
}

function jointGuPlan(plan) {
  return {
    contract: plan.contract,
    planId: plan.planId,
    kind: plan.kind,
    trigger: plan.trigger,
    createdAt: plan.createdAt,
    audience: plan.audience,
    binding: { mapVersionId: plan.binding.mapVersionId },
    blocks: clone(plan.blocks),
    readOnly: true,
    mutationAuthority: 'NONE',
    interactions: [],
  }
}

function jointMapProposal(proposal) {
  return {
    proposalId: proposal.proposalId,
    title: proposal.title,
    summary: proposal.summary,
    reason: proposal.reason,
    evidenceRefs: clone(proposal.evidenceRefs),
    uncertainty: proposal.uncertainty,
    falsifier: proposal.falsifier,
    stateBinding: { mapVersionId: proposal.stateBinding.mapVersionId },
    requiredConfirmers: clone(proposal.requiredConfirmers),
    decisions: clone(proposal.decisions),
    status: proposal.status,
    proposedAt: proposal.proposedAt,
    proposedBy: proposal.proposedBy,
    causeEstablished: false,
  }
}

function jointPlanProposal(plan, state) {
  const visible = shareableAgreement({ ...state, acceptedPlan: plan })
  return {
    ...visible,
    agreementId: plan.agreementId,
    status: plan.status,
    proposedAt: plan.proposedAt,
    proposedBy: plan.proposedBy,
    decisions: clone(plan.decisions),
    stateBinding: { mapVersionId: plan.stateBinding.mapVersionId },
  }
}

export function buildLivingConsultProjection(state, audience = AUDIENCES.JOINT) {
  assertAudience(audience)
  assertLivingConsult(state?.contract === LIVING_CONSULT_CONTRACT, 'ATHLETE_LIVING_CONSULT_STATE_INVALID')
  if (audience === AUDIENCES.PRIVATE) {
    const body = {
      contract: 'athlete-consult-private-projection-v1',
      audience,
      subject: clone(state.identities),
      phase: state.phase,
      sourceBindings: clone(state.sourceBindings),
      privateBosContext: clone(state.sourceSnapshots.bosPrivateContext),
      currentMap: clone(state.currentMap),
      mapHistory: clone(state.mapHistory),
      transcript: clone(state.transcript),
      conversationHistory: clone(state.conversationHistory),
      evidenceCandidates: clone(state.evidenceCandidates),
      authorizedEvidence: clone(state.authorizedEvidence),
      mapChangeProposals: clone(state.mapChangeProposals),
      planProposals: clone(state.planProposals),
      acceptedPlan: clone(state.acceptedPlan),
      interventions: clone(state.interventions),
      attempts: clone(state.attempts),
      outcomes: clone(state.outcomes),
      causalReviews: clone(state.causalReviews),
      openLoops: clone(state.openLoops),
      rslEvents: clone(state.rslEvents),
      guPlans: clone(state.guPlans),
      agenticNotices: clone(state.agenticNotices),
      stateBinding: { stateHash: state.stateHash, revision: state.revision, mapIdentity: state.currentMap.mapIdentity },
    }
    return deepFreeze({ ...body, projectionIdentity: publicProjectionIdentity(body) })
  }
  if (audience === AUDIENCES.SHAREABLE_PLAN) {
    const body = {
      contract: 'athlete-consult-shareable-plan-projection-v1',
      audience,
      purpose: 'preview_agreed_athlete_development_plan',
      subject: { displayName: state.identities.athleteDisplayName, sport: state.currentMap.subject.sport },
      instructor: { displayName: state.identities.instructorDisplayName },
      agreement: shareableAgreement(state),
      externalEffects: { sends: 0, recipients: [] },
      boundary: 'Preview only. No email, message, entitlement, customer, or Production effect.',
    }
    assertNoPrivateExistenceLeak(body)
    return deepFreeze({ ...body, projectionIdentity: publicProjectionIdentity(body) })
  }
  const jointEvidence = state.authorizedEvidence.filter((item) => item.audience === AUDIENCES.JOINT)
  const jointCandidateIds = new Set(state.evidenceCandidates.filter((item) => item.audience === AUDIENCES.JOINT).map((item) => item.candidateId))
  const body = {
    contract: 'athlete-consult-joint-projection-v1',
    audience,
    syntheticOnly: true,
    writable: false,
    subject: { displayName: state.identities.athleteDisplayName, ageBand: state.currentMap.subject.ageBand, sport: state.currentMap.subject.sport },
    instructor: { displayName: state.identities.instructorDisplayName },
    phase: state.phase,
    roomIds: Object.values(ROOM_IDS),
    map: visibleMap(state),
    bosContext: clone(state.sourceSnapshots?.bosJoint || safeJointBosClaims()),
    visibleTranscript: clone(state.transcript),
    evidenceCandidates: clone(state.evidenceCandidates.filter((item) => jointCandidateIds.has(item.candidateId))),
    authorizedEvidence: clone(jointEvidence),
    mapChangeProposals: state.mapChangeProposals.map(jointMapProposal),
    planProposals: state.planProposals.map((plan) => jointPlanProposal(plan, state)),
    acceptedPlan: shareableAgreement(state),
    interventions: clone(state.interventions),
    attempts: clone(state.attempts),
    outcomes: clone(state.outcomes),
    causalReviews: clone(state.causalReviews),
    openLoops: clone(state.openLoops),
    guPlans: state.guPlans.filter((plan) => plan.audience === AUDIENCES.JOINT).map(jointGuPlan),
    agenticNotices: clone(state.agenticNotices.filter((notice) => notice.audience === AUDIENCES.JOINT)),
    boundary: { sourceBosWritable: false, sourceApaWritable: false, modelSpeechIsTruth: false, sends: 0 },
  }
  assertNoPrivateExistenceLeak(body)
  return deepFreeze({ ...body, projectionIdentity: publicProjectionIdentity(body) })
}

function sharePlanPreview(state, p = {}) {
  const preview = buildLivingConsultProjection(state, AUDIENCES.SHAREABLE_PLAN)
  assertLivingConsult(preview.agreement, 'ATHLETE_DEVELOPMENT_AGREEMENT_NOT_ACCEPTED')
  return {
    ok: true,
    code: 'SHAREABLE_PLAN_PREVIEW_READY_NO_SEND',
    state,
    preview,
    requestedAudience: p.requestedAudience || 'UNSPECIFIED_PREVIEW_ONLY',
    externalEffects: { sends: 0, payments: 0, customerWrites: 0 },
  }
}

export function reduceLivingConsultState(state, action) {
  try {
    assertLivingConsult(state?.contract === LIVING_CONSULT_CONTRACT, 'ATHLETE_LIVING_CONSULT_STATE_INVALID')
    assertLivingConsult(action?.type && Object.values(ACTION_TYPES).includes(action.type), 'ATHLETE_LIVING_CONSULT_ACTION_INVALID')
    const p = payloadOf(action)
    if (action.type === ACTION_TYPES.SHARE_PLAN_PREVIEW) {
      assertLivingConsult(!action.expectedStateHash || action.expectedStateHash === state.stateHash, 'ATHLETE_LIVING_CONSULT_STALE_STATE')
      return sharePlanPreview(state, p)
    }
    assertLivingConsult(action.idempotencyKey, 'ATHLETE_LIVING_CONSULT_IDEMPOTENCY_KEY_REQUIRED')
    const semanticHash = hashCanonicalJson(unsignedAction(action))
    const prior = state.idempotencyLedger[action.idempotencyKey]
    if (prior) {
      if (prior.semanticHash !== semanticHash) return failure(state, 'ATHLETE_LIVING_CONSULT_IDEMPOTENCY_CONFLICT')
      return { ok: true, code: 'IDEMPOTENT_REPLAY', state, replayed: true, originalCode: prior.code, firstAppliedRevision: prior.firstAppliedRevision }
    }
    assertLivingConsult(action.expectedStateHash === state.stateHash, 'ATHLETE_LIVING_CONSULT_STALE_STATE')
    const at = now(action)
    switch (action.type) {
      case ACTION_TYPES.START_SESSION: return startSession(state, action, p, at)
      case ACTION_TYPES.APPEND_CHAT: return appendChat(state, action, p, at)
      case ACTION_TYPES.CAPTURE_NEW_EVIDENCE: return captureEvidence(state, action, p, at)
      case ACTION_TYPES.DECIDE_EVIDENCE_CANDIDATE: return decideEvidence(state, action, p, at)
      case ACTION_TYPES.PROPOSE_MAP_CHANGE: return proposeMapChange(state, action, p, at)
      case ACTION_TYPES.DECIDE_MAP_CHANGE: return decideMapChange(state, action, p, at)
      case ACTION_TYPES.PROPOSE_PLAN: return proposePlan(state, action, p, at)
      case ACTION_TYPES.DECIDE_PLAN: return decidePlan(state, action, p, at)
      case ACTION_TYPES.RECORD_ATTEMPT: return recordAttempt(state, action, p, at)
      case ACTION_TYPES.RECORD_OUTCOME: return recordOutcome(state, action, p, at)
      case ACTION_TYPES.ASSESS_CAUSAL_CONFIDENCE: return assessCausalConfidence(state, action, p, at)
      case ACTION_TYPES.UPDATE_OPEN_LOOP: return updateOpenLoop(state, action, p, at)
      case ACTION_TYPES.ACK_NOTICE: return acknowledgeNotice(state, action, p, at)
      case ACTION_TYPES.ADD_MIDDLE_GU: return addMiddleGu(state, action, p, at)
      case ACTION_TYPES.END_SESSION: return endSession(state, action, p, at)
      default: return failure(state, 'ATHLETE_LIVING_CONSULT_ACTION_NOT_IMPLEMENTED')
    }
  } catch (error) {
    return failure(state, error.code || error.message || 'ATHLETE_LIVING_CONSULT_RUNTIME_FAILURE', error.details || null)
  }
}

export function verifyLivingConsultState(state) {
  const errors = []
  if (stateIdentity(state) !== state.stateHash) errors.push('STATE_HASH_INVALID')
  if (state.sourceBindings?.bos?.mutationAuthority !== 'NONE_READ_ONLY') errors.push('BOS_NOT_READ_ONLY')
  if (state.sourceBindings?.apa?.sourceSnapshotWritable !== false) errors.push('SOURCE_APA_NOT_READ_ONLY')
  if (Object.values(state.externalEffects || {}).some((value) => value !== 0)) errors.push('EXTERNAL_EFFECT_RECORDED')
  let priorEvent = null
  for (const event of state.relationshipEvents || []) {
    const { eventHash: recorded, ...unsigned } = event
    if (event.previousEventHash !== priorEvent || eventHash(unsigned) !== recorded) errors.push(`RELATIONSHIP_EVENT_CHAIN_INVALID:${event.eventId}`)
    priorEvent = recorded
  }
  let priorRsl = null
  for (const event of state.rslEvents || []) {
    const { rslHash: recorded, ...unsigned } = event
    if (event.previousRslHash !== priorRsl || eventHash(unsigned) !== recorded) errors.push(`RSL_EVENT_CHAIN_INVALID:${event.rslEventId}`)
    priorRsl = recorded
  }
  if (!OPEN_LOOP_STATES.every((status) => typeof status === 'string')) errors.push('OPEN_LOOP_CONTRACT_INVALID')
  try { assertNoPrivateExistenceLeak(buildLivingConsultProjection(state, AUDIENCES.JOINT)) } catch (error) { errors.push(error.code || error.message) }
  try { assertNoPrivateExistenceLeak(buildLivingConsultProjection(state, AUDIENCES.SHAREABLE_PLAN)) } catch (error) { errors.push(error.code || error.message) }
  return deepFreeze({ ok: errors.length === 0, errors, stateHash: state.stateHash, relationshipEventHead: state.relationshipEvents.at(-1)?.eventHash || null, rslEventHead: state.rslEvents.at(-1)?.rslHash || null })
}
