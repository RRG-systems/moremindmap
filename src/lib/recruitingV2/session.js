const clone = (value) => JSON.parse(JSON.stringify(value));
const ACTORS = Object.freeze(['DARREN', 'JORDAN', 'MORE', 'SYSTEM']);
const PERSPECTIVES = Object.freeze(['RECRUITER_ASSERTION', 'CANDIDATE_ASSERTION', 'MORE_HYPOTHESIS', 'JOINTLY_ACCEPTED', 'CONTESTED', 'UNRESOLVED', 'SYSTEM_RECORD']);

function nowIso(now) {
  return (now instanceof Date ? now : new Date(now)).toISOString();
}

function cleanText(value, max = 4000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function nextId(session, prefix) {
  return `${prefix}-${String(session.sequence + 1).padStart(4, '0')}`;
}

function event(session, input, now = new Date()) {
  if (!ACTORS.includes(input.actor) || !ACTORS.includes(input.enteredBy)) throw new Error('RECRUITING_V2_EVENT_ACTOR_INVALID');
  if (!PERSPECTIVES.includes(input.perspectiveState)) throw new Error('RECRUITING_V2_EVENT_PERSPECTIVE_INVALID');
  return {
    eventId: nextId(session, 'event'), sequence: session.sequence + 1, sessionRevision: session.revision + 1,
    type: input.type, actor: input.actor, enteredBy: input.enteredBy, assertedBy: input.assertedBy || input.actor,
    subject: input.subject || 'shared recruiting decision', about: input.about || null,
    text: cleanText(input.text), evidenceRefs: Array.isArray(input.evidenceRefs) ? input.evidenceRefs.slice(0, 20) : [],
    perspectiveState: input.perspectiveState, projectionEligibility: input.projectionEligibility || 'SESSION_ONLY',
    occurredAt: nowIso(now), lineage: input.lineage || null, metadata: input.metadata || null,
  };
}

export function createSharedBusinessSession(now = new Date()) {
  const session = {
    contract: 'recruiting_v2_shared_business_session_003a_v1',
    sessionId: 'session-synthetic-darren-jordan-003a', relationshipId: 'rel-synthetic-darren-jordan-v2',
    worldVersion: '003a-world-1.0.0', status: 'OPEN', revision: 0, sequence: 0,
    createdAt: nowIso(now), updatedAt: nowIso(now), completedAt: null,
    participants: [
      { actor: 'DARREN', name: 'Darren', role: 'Recruiter', present: true },
      { actor: 'JORDAN', name: 'Jordan', role: 'Candidate', present: true },
      { actor: 'MORE', name: 'MORE', role: 'Intelligent third participant', present: true },
    ],
    currentPurpose: null, events: [], hypotheses: [], decisions: [], commitments: [],
    currentProjection: null, projectionHistory: [], scenarioAssumptions: {},
    baselineInvariants: { syntheticOnly: true, externalWrites: 0, invitations: 0, messages: 0, canonicalWrites: 0, entitlementEffects: 0 },
  };
  const opened = appendEvent(session, {
    type: 'SESSION_OPENED', actor: 'SYSTEM', enteredBy: 'SYSTEM', assertedBy: 'SYSTEM', subject: session.relationshipId,
    text: 'Synthetic co-present Recruiting V2 session opened for Darren and Jordan.', perspectiveState: 'SYSTEM_RECORD', projectionEligibility: 'SESSION_ONLY',
  }, now);
  return Object.freeze(opened);
}

export function appendEvent(current, input, now = new Date()) {
  const session = clone(current);
  if (session.status === 'COMPLETED' && input.type !== 'SESSION_AMENDED') throw new Error('RECRUITING_V2_SESSION_COMPLETED');
  const next = event(session, input, now);
  session.events.push(next);
  session.sequence = next.sequence;
  session.revision = next.sessionRevision;
  session.updatedAt = next.occurredAt;
  return Object.freeze(session);
}

export function appendHumanTurn(current, { speaker, text }, now = new Date()) {
  if (!['DARREN', 'JORDAN'].includes(speaker)) throw new Error('RECRUITING_V2_HUMAN_SPEAKER_INVALID');
  const clean = cleanText(text);
  if (!clean) throw new Error('RECRUITING_V2_HUMAN_TEXT_REQUIRED');
  return appendEvent(current, {
    type: 'HUMAN_TURN', actor: speaker, enteredBy: speaker, assertedBy: speaker, subject: 'shared recruiting decision', text: clean,
    perspectiveState: speaker === 'DARREN' ? 'RECRUITER_ASSERTION' : 'CANDIDATE_ASSERTION', projectionEligibility: 'SESSION_ONLY',
  }, now);
}

export function recordFrontierProjection(current, plan, receipt, now = new Date()) {
  const session = clone(current);
  if (plan?.stateBinding?.sessionRevision !== session.revision || plan?.stateBinding?.worldVersion !== session.worldVersion) throw new Error('RECRUITING_V2_STALE_PROJECTION_REFUSED');
  const prior = session.currentProjection;
  const projection = {
    projectionId: `projection-${String(session.projectionHistory.length + 1).padStart(3, '0')}`,
    plan, receipt: receipt || null, basedOnSessionRevision: session.revision, createdAt: nowIso(now),
    supersedesProjectionId: prior?.projectionId || null,
  };
  session.currentPurpose = plan.purpose.humanWords;
  session.currentProjection = projection;
  session.projectionHistory.push({ projectionId: projection.projectionId, basedOnSessionRevision: projection.basedOnSessionRevision, createdAt: projection.createdAt, supersedesProjectionId: projection.supersedesProjectionId });
  for (const candidate of plan.hypotheses || []) {
    const previous = candidate.supersedesHypothesisId ? session.hypotheses.find((item) => item.hypothesisId === candidate.supersedesHypothesisId) : null;
    if (previous && !['WITHDRAWN', 'SUPERSEDED'].includes(previous.status)) previous.status = 'SUPERSEDED';
    if (!session.hypotheses.some((item) => item.hypothesisId === candidate.hypothesisId)) {
      session.hypotheses.push({ ...candidate, status: 'ACTIVE', introducedAtRevision: session.revision, introducedByProjectionId: projection.projectionId });
    }
  }
  return Object.freeze(session);
}

export function reviseHypothesis(current, { hypothesisId, actor, disposition, reason }, now = new Date()) {
  const session = clone(current);
  const hypothesis = session.hypotheses.find((item) => item.hypothesisId === hypothesisId);
  if (!hypothesis) throw new Error('RECRUITING_V2_HYPOTHESIS_NOT_FOUND');
  const states = { ACCEPT: 'JOINTLY_ACCEPTED', REJECT: 'WITHDRAWN', CONTEST: 'CONTESTED' };
  if (!states[disposition]) throw new Error('RECRUITING_V2_HYPOTHESIS_DISPOSITION_INVALID');
  hypothesis.status = states[disposition];
  hypothesis.changedAtRevision = session.revision + 1;
  hypothesis.changedBy = actor;
  hypothesis.changeReason = cleanText(reason || `${disposition} during the shared session.`);
  return appendEvent(session, {
    type: `HYPOTHESIS_${disposition}`, actor, enteredBy: actor, assertedBy: actor, subject: hypothesisId, about: hypothesis.statement,
    text: hypothesis.changeReason, evidenceRefs: hypothesis.evidenceIds || [],
    perspectiveState: disposition === 'ACCEPT' ? 'JOINTLY_ACCEPTED' : disposition === 'CONTEST' ? 'CONTESTED' : actor === 'JORDAN' ? 'CANDIDATE_ASSERTION' : 'RECRUITER_ASSERTION',
    projectionEligibility: 'SESSION_ONLY', lineage: { hypothesisId, priorStatus: 'ACTIVE', newStatus: states[disposition] },
  }, now);
}

export function recordScenarioAssumptions(current, assumptions, actor, now = new Date()) {
  const session = clone(current);
  session.scenarioAssumptions = { ...session.scenarioAssumptions, ...clone(assumptions) };
  return appendEvent(session, {
    type: 'SCENARIO_ASSUMPTIONS_CHANGED', actor, enteredBy: actor, assertedBy: actor, subject: 'obj-economic-scenario',
    text: `Scenario assumptions changed: ${Object.entries(assumptions).map(([key, value]) => `${key}=${value}`).join(', ')}.`,
    perspectiveState: actor === 'JORDAN' ? 'CANDIDATE_ASSERTION' : 'RECRUITER_ASSERTION', projectionEligibility: 'SESSION_ONLY', metadata: clone(assumptions),
  }, now);
}

export function completeSession(current, { actor, decision, nextStep }, now = new Date()) {
  let session = appendEvent(current, {
    type: 'SESSION_DECISION', actor, enteredBy: actor, assertedBy: 'DARREN_AND_JORDAN', subject: 'shared recruiting decision',
    text: cleanText(decision), perspectiveState: 'JOINTLY_ACCEPTED', projectionEligibility: 'SESSION_ONLY',
    lineage: { fromHypotheses: current.hypotheses.filter((item) => item.status === 'JOINTLY_ACCEPTED').map((item) => item.hypothesisId), futureOutcomeLink: null },
  }, now);
  session = clone(session);
  const decisionRecord = { decisionId: nextId(session, 'decision'), text: cleanText(decision), nextStep: cleanText(nextStep), acceptedBy: ['DARREN', 'JORDAN'], atRevision: session.revision };
  session.decisions.push(decisionRecord);
  if (decisionRecord.nextStep) session.commitments.push({ commitmentId: nextId(session, 'commitment'), text: decisionRecord.nextStep, owner: 'UNRESOLVED', status: 'PROPOSED', decisionId: decisionRecord.decisionId });
  session.status = 'COMPLETED';
  session.completedAt = nowIso(now);
  session.updatedAt = session.completedAt;
  return Object.freeze(session);
}

export function sessionContextForFrontier(session) {
  return Object.freeze({
    contract: session.contract, sessionId: session.sessionId, relationshipId: session.relationshipId,
    worldVersion: session.worldVersion, status: session.status, revision: session.revision,
    currentPurpose: session.currentPurpose,
    recentEvents: session.events.slice(-16).map(({ eventId, type, actor, assertedBy, subject, text, evidenceRefs, perspectiveState, occurredAt, lineage, metadata }) => ({ eventId, type, actor, assertedBy, subject, text, evidenceRefs, perspectiveState, occurredAt, lineage, metadata })),
    activeHypotheses: session.hypotheses.filter((item) => !['WITHDRAWN', 'SUPERSEDED'].includes(item.status)),
    hypothesisHistory: session.hypotheses,
    decisions: session.decisions, commitments: session.commitments,
    scenarioAssumptions: session.scenarioAssumptions,
    projectionEligibility: 'SESSION_ONLY',
  });
}

export function completedArtifact(session) {
  if (session.status !== 'COMPLETED') return null;
  return Object.freeze({
    contract: 'recruiting_v2_completed_shared_artifact_003a_v1', sessionId: session.sessionId,
    established: session.events.filter((item) => item.perspectiveState === 'JOINTLY_ACCEPTED').map((item) => ({ eventId: item.eventId, text: item.text, evidenceRefs: item.evidenceRefs })),
    contested: session.hypotheses.filter((item) => item.status === 'CONTESTED').map((item) => ({ hypothesisId: item.hypothesisId, statement: item.statement })),
    withdrawn: session.hypotheses.filter((item) => item.status === 'WITHDRAWN').map((item) => ({ hypothesisId: item.hypothesisId, statement: item.statement, reason: item.changeReason })),
    decisions: clone(session.decisions), commitments: clone(session.commitments), completedAt: session.completedAt,
    projectionEligibility: 'SESSION_ONLY',
  });
}

export const RECRUITING_V2_SESSION_STORAGE_KEY = 'more.recruiting-v2.003a.synthetic-session.v1';
