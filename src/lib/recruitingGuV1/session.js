import { createOpaqueId, stableHash } from '../recruitingV1/contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const ROOMS = Object.freeze(['HOME', 'YOU', 'YOUR_BUSINESS', 'PLAN']);
const ACTORS = Object.freeze(['MANAGER', 'INVITEE', 'MORE', 'SYSTEM']);
const STATUS = Object.freeze(['OPEN', 'PLAN_PROPOSED', 'SECOND_OFFER', 'COMPLETED']);

function iso(now = new Date()) {
  return (now instanceof Date ? now : new Date(now)).toISOString();
}

function text(value, max = 4000) {
  return String(value || '').trim().replace(/\s+/gu, ' ').slice(0, max);
}

function assertRevision(session, expectedRevision) {
  if (!Number.isInteger(expectedRevision) || session.revision !== expectedRevision) {
    const error = new Error('RECRUITING_GU_V1_STALE_SESSION_REFUSED');
    error.current_revision = session.revision;
    throw error;
  }
}

function append(session, input, now = new Date()) {
  if (!ACTORS.includes(input.actor)) throw new Error('RECRUITING_GU_V1_EVENT_ACTOR_INVALID');
  const next = clone(session);
  const occurredAt = iso(now);
  const sequence = next.sequence + 1;
  next.events.push({
    event_id: `event-${String(sequence).padStart(4, '0')}`,
    sequence,
    revision: next.revision + 1,
    type: input.type,
    actor: input.actor,
    room: input.room || next.current_room,
    text: text(input.text),
    evidence_refs: Array.isArray(input.evidence_refs) ? input.evidence_refs.slice(0, 24) : [],
    lineage: input.lineage || null,
    metadata: input.metadata || null,
    occurred_at: occurredAt,
  });
  next.sequence = sequence;
  next.revision += 1;
  next.updated_at = occurredAt;
  return next;
}

export function createRecruitingGuSession({
  sessionId = createOpaqueId('gu_session'),
  relationshipId,
  manager,
  invitee,
  subjectProfileId,
  syntheticOnly = false,
  worldVersion = '003a-world-1.0.0',
  now = new Date(),
} = {}) {
  if (!relationshipId || !manager?.subject_id || !invitee?.name || !subjectProfileId) {
    throw new Error('RECRUITING_GU_V1_SESSION_BINDING_REQUIRED');
  }
  const createdAt = iso(now);
  let session = {
    contract: 'more_recruiting_gu_v1_shared_business_session_v1',
    session_id: sessionId,
    relationship_id: relationshipId,
    manager_binding: {
      subject_id: manager.subject_id,
      membership_id: manager.membership_id || null,
      enterprise_id: manager.enterprise_id || null,
      name: text(manager.name, 140),
      entitlement_mode: manager.entitlement_mode || null,
    },
    subject_binding: {
      profile_id: String(subjectProfileId).toLowerCase(),
      candidate_id: invitee.candidate_id || null,
      consultation_request_id: invitee.consultation_request_id || null,
      name: text(invitee.name, 140),
    },
    status: 'OPEN',
    current_room: 'HOME',
    revision: 0,
    sequence: 0,
    created_at: createdAt,
    updated_at: createdAt,
    completed_at: null,
    synthetic_only: syntheticOnly === true,
    world_version: worldVersion,
    events: [],
    conversation: [],
    coach_moves: [],
    current_coach_move: null,
    projections: [],
    current_projection: null,
    scenario_assumptions: {},
    proposals: [],
    current_proposal_id: null,
    decisions: [],
    effect_receipts: [],
    invariants: {
      external_mutation: false,
      canonical_mutation: false,
      recruiting_v1_mutation: false,
      model_output_is_canonical: false,
    },
  };
  session = append(session, {
    type: 'SESSION_OPENED', actor: 'SYSTEM', room: 'HOME',
    text: `Shared business session opened for ${session.manager_binding.name} and ${session.subject_binding.name}.`,
    metadata: { synthetic_only: session.synthetic_only },
  }, now);
  return Object.freeze(session);
}

export function changeRoom(current, { room, expectedRevision, actor = 'MANAGER' }, now = new Date()) {
  if (!ROOMS.includes(room)) throw new Error('RECRUITING_GU_V1_ROOM_INVALID');
  assertRevision(current, expectedRevision);
  if (current.status === 'COMPLETED') throw new Error('RECRUITING_GU_V1_SESSION_COMPLETED');
  const next = append(current, { type: 'ROOM_CHANGED', actor, room, text: `Moved to ${room}.` }, now);
  next.current_room = room;
  return Object.freeze(next);
}

export function appendConversationTurn(current, { actor, message, room, expectedRevision }, now = new Date()) {
  assertRevision(current, expectedRevision);
  if (!['MANAGER', 'INVITEE'].includes(actor)) throw new Error('RECRUITING_GU_V1_HUMAN_ACTOR_INVALID');
  if (current.status === 'COMPLETED') throw new Error('RECRUITING_GU_V1_SESSION_COMPLETED');
  const clean = text(message);
  if (!clean) throw new Error('RECRUITING_GU_V1_MESSAGE_REQUIRED');
  let next = append(current, { type: 'HUMAN_TURN', actor, room, text: clean }, now);
  next.conversation.push({
    turn_id: `turn-${String(next.conversation.length + 1).padStart(4, '0')}`,
    actor,
    room,
    text: clean,
    revision: next.revision,
    occurred_at: next.updated_at,
  });
  return Object.freeze(next);
}

export function recordFrontierProjection(current, { plan, receipt, basedOnRevision }, now = new Date()) {
  assertRevision(current, basedOnRevision);
  if (plan?.stateBinding?.sessionRevision !== basedOnRevision) throw new Error('RECRUITING_GU_V1_STALE_MODEL_PLAN_REFUSED');
  let next = append(current, {
    type: 'FRONTIER_PROJECTION_PUBLISHED', actor: 'MORE', room: current.current_room,
    text: plan?.guidance?.headline || 'MORE recomposed the current thinking environment.',
    evidence_refs: plan?.evidence?.map((item) => item.id) || [],
    metadata: { plan_version: plan?.planVersion || null, provider: receipt?.provider?.modelReturned || receipt?.modelConfig?.model || null },
  }, now);
  const projection = {
    projection_id: `projection-${String(next.projections.length + 1).padStart(4, '0')}`,
    room: current.current_room,
    based_on_revision: basedOnRevision,
    published_at_revision: next.revision,
    supersedes_projection_id: next.current_projection?.projection_id || null,
    plan,
    receipt,
    created_at: next.updated_at,
  };
  next.projections.push(projection);
  next.current_projection = projection;
  next.conversation.push({
    turn_id: `turn-${String(next.conversation.length + 1).padStart(4, '0')}`,
    actor: 'MORE', room: current.current_room,
    text: plan?.guidance?.summary || plan?.guidance?.headline || 'The environment has been recomposed.',
    revision: next.revision, occurred_at: next.updated_at,
  });
  return Object.freeze(next);
}

export function recordCoachMove(current, { move, receipt, basedOnRevision, condition }, now = new Date()) {
  assertRevision(current, basedOnRevision);
  if (!move?.insight || !move?.explanation || !move?.selfDiscoveryQuestion) throw new Error('RECRUITING_GU_V1_COACH_MOVE_INVALID');
  let next = append(current, {
    type: 'FRONTIER_COACH_MOVE_PUBLISHED',
    actor: 'MORE',
    room: current.current_room,
    text: move.insight,
    metadata: {
      condition,
      visual_materially_helps: move.visual?.materiallyHelps === true,
      provider: receipt?.provider?.modelReturned || receipt?.modelConfig?.model || null,
    },
  }, now);
  const record = {
    coach_move_id: `coach-move-${String(next.coach_moves.length + 1).padStart(4, '0')}`,
    room: current.current_room,
    based_on_revision: basedOnRevision,
    published_at_revision: next.revision,
    condition,
    move: clone(move),
    receipt,
    created_at: next.updated_at,
  };
  next.coach_moves.push(record);
  next.current_coach_move = record;
  next.conversation.push({
    turn_id: `turn-${String(next.conversation.length + 1).padStart(4, '0')}`,
    actor: 'MORE',
    room: current.current_room,
    text: `${move.insight} ${move.explanation} ${move.selfDiscoveryQuestion}`,
    insight: move.insight,
    explanation: move.explanation,
    question: move.selfDiscoveryQuestion,
    revision: next.revision,
    occurred_at: next.updated_at,
  });
  return Object.freeze(next);
}

export function recordCompiledProjection(current, { plan, receipt, basedOnRevision, coachMoveId }, now = new Date()) {
  assertRevision(current, basedOnRevision);
  if (current.current_coach_move?.coach_move_id !== coachMoveId) throw new Error('RECRUITING_GU_V1_COACH_MOVE_STALE');
  if (current.current_coach_move?.move?.visual?.materiallyHelps !== true) throw new Error('RECRUITING_GU_V1_VISUAL_NOT_REQUESTED');
  if (plan?.stateBinding?.sessionRevision !== basedOnRevision) throw new Error('RECRUITING_GU_V1_STALE_MODEL_PLAN_REFUSED');
  let next = append(current, {
    type: 'OPTIONAL_GU_PROJECTION_PUBLISHED',
    actor: 'MORE',
    room: current.current_room,
    text: 'The optional visual expression is ready.',
    evidence_refs: plan?.evidence?.map((item) => item.id) || [],
    lineage: { coach_move_id: coachMoveId },
    metadata: { plan_version: plan?.planVersion || null, provider: receipt?.provider?.modelReturned || receipt?.modelConfig?.model || null },
  }, now);
  const projection = {
    projection_id: `projection-${String(next.projections.length + 1).padStart(4, '0')}`,
    room: current.current_room,
    based_on_revision: basedOnRevision,
    published_at_revision: next.revision,
    supersedes_projection_id: next.current_projection?.projection_id || null,
    coach_move_id: coachMoveId,
    plan,
    receipt,
    created_at: next.updated_at,
  };
  next.projections.push(projection);
  next.current_projection = projection;
  return Object.freeze(next);
}

export function recordScenarioChange(current, { values, expectedRevision, actor = 'MANAGER' }, now = new Date()) {
  assertRevision(current, expectedRevision);
  const bounded = Object.fromEntries(Object.entries(values || {}).slice(0, 12).map(([key, value]) => [text(key, 80), Number(value)]));
  if (Object.values(bounded).some((value) => !Number.isFinite(value))) throw new Error('RECRUITING_GU_V1_SCENARIO_INVALID');
  let next = append(current, {
    type: 'SCENARIO_ASSUMPTIONS_CHANGED', actor, text: 'Scenario assumptions changed.', metadata: bounded,
  }, now);
  next.scenario_assumptions = { ...next.scenario_assumptions, ...bounded };
  return Object.freeze(next);
}

export function recordPlanProposal(current, { proposal, basedOnRevision }, now = new Date()) {
  assertRevision(current, basedOnRevision);
  if (!proposal?.summary || !Array.isArray(proposal.commitments) || proposal.commitments.length < 1) {
    throw new Error('RECRUITING_GU_V1_PLAN_PROPOSAL_INVALID');
  }
  let next = append(current, {
    type: 'PLAN_PROPOSED', actor: 'MORE', room: 'PLAN', text: proposal.summary,
    metadata: { commitment_count: proposal.commitments.length },
  }, now);
  const prior = next.proposals.find((item) => item.proposal_id === next.current_proposal_id);
  if (prior && prior.status === 'CURRENT') prior.status = 'SUPERSEDED';
  const record = {
    proposal_id: `proposal-${String(next.proposals.length + 1).padStart(4, '0')}`,
    version: next.proposals.length + 1,
    status: 'CURRENT',
    based_on_revision: basedOnRevision,
    supersedes_proposal_id: prior?.proposal_id || null,
    proposal: clone(proposal),
    created_at: next.updated_at,
  };
  next.proposals.push(record);
  next.current_proposal_id = record.proposal_id;
  next.status = 'PLAN_PROPOSED';
  next.current_room = 'PLAN';
  next.conversation.push({
    turn_id: `turn-${String(next.conversation.length + 1).padStart(4, '0')}`,
    actor: 'MORE', room: 'PLAN', text: proposal.summary, revision: next.revision, occurred_at: next.updated_at,
  });
  return Object.freeze(next);
}

export function decidePlan(current, { decision, expectedRevision, actor = 'MANAGER' }, now = new Date()) {
  assertRevision(current, expectedRevision);
  if (!['YES', 'ADJUST', 'NOT_NOW'].includes(decision)) throw new Error('RECRUITING_GU_V1_PLAN_DECISION_INVALID');
  const proposal = current.proposals.find((item) => item.proposal_id === current.current_proposal_id);
  if (!proposal || proposal.status !== 'CURRENT') throw new Error('RECRUITING_GU_V1_CURRENT_PLAN_REQUIRED');
  let next = append(current, {
    type: `PLAN_${decision}`, actor, room: 'PLAN',
    text: decision === 'YES' ? 'The two humans accepted the plan.' : decision === 'ADJUST' ? 'The plan needs adjustment.' : 'The plan was not accepted now.',
    lineage: { proposal_id: proposal.proposal_id },
  }, now);
  next.decisions.push({ decision_id: `decision-${String(next.decisions.length + 1).padStart(4, '0')}`, decision, proposal_id: proposal.proposal_id, actor, at_revision: next.revision, decided_at: next.updated_at });
  if (decision === 'YES') {
    next.status = 'COMPLETED';
    next.completed_at = next.updated_at;
    proposal.status = 'ACCEPTED';
  } else if (decision === 'ADJUST') {
    next.status = 'OPEN';
    proposal.status = 'ADJUSTMENT_REQUESTED';
  } else {
    next.status = 'SECOND_OFFER';
    proposal.status = 'NOT_ACCEPTED_NOW';
  }
  return Object.freeze(next);
}

export function decideSecondOffer(current, { decision, expectedRevision, actor = 'MANAGER', effectAdapter }, now = new Date()) {
  assertRevision(current, expectedRevision);
  if (current.status !== 'SECOND_OFFER') throw new Error('RECRUITING_GU_V1_SECOND_OFFER_NOT_ACTIVE');
  if (!['STAY_CONNECTED', 'CLOSE_GRACEFULLY'].includes(decision)) throw new Error('RECRUITING_GU_V1_SECOND_OFFER_DECISION_INVALID');
  let next = append(current, {
    type: decision === 'STAY_CONNECTED' ? 'SECOND_OFFER_ACCEPTED' : 'SECOND_OFFER_DECLINED',
    actor, room: 'PLAN',
    text: decision === 'STAY_CONNECTED' ? 'Three months of MORE accepted.' : 'The meeting closed gracefully.',
  }, now);
  next.decisions.push({ decision_id: `decision-${String(next.decisions.length + 1).padStart(4, '0')}`, decision, actor, at_revision: next.revision, decided_at: next.updated_at });
  if (decision === 'STAY_CONNECTED') {
    if (typeof effectAdapter !== 'function') throw new Error('RECRUITING_GU_V1_EFFECT_ADAPTER_REQUIRED');
    const receipt = effectAdapter({ session: clone(next), idempotencyKey: stableHash({ session_id: next.session_id, decision, revision: next.revision }) });
    if (!receipt || receipt.external_mutation !== false) throw new Error('RECRUITING_GU_V1_UNSAFE_EFFECT_RECEIPT_REFUSED');
    next.effect_receipts.push(receipt);
  }
  next.status = 'COMPLETED';
  next.completed_at = next.updated_at;
  return Object.freeze(next);
}

export function frontierSessionContext(session, { roomScoped = false } = {}) {
  const compatibleRooms = session.current_room === 'YOU'
    ? new Set(['HOME', 'YOU'])
    : session.current_room === 'YOUR_BUSINESS'
      ? new Set(['HOME', 'YOU', 'YOUR_BUSINESS'])
      : new Set(ROOMS);
  const compatible = (item) => !roomScoped || compatibleRooms.has(item.room);
  const compatibleProjections = session.projections.filter(compatible);
  return Object.freeze({
    contract: 'recruiting_v2_shared_business_session_003a_v1',
    sessionId: session.session_id,
    relationshipId: session.relationship_id,
    worldVersion: session.world_version,
    status: session.status === 'COMPLETED' ? 'COMPLETED' : 'OPEN',
    revision: session.revision,
    currentPurpose: session.conversation.at(-1)?.text || null,
    recentEvents: session.events.filter(compatible).slice(-16).map((item) => ({
      eventId: item.event_id, type: item.type, actor: item.actor === 'MANAGER' ? 'DARREN' : item.actor === 'INVITEE' ? 'JORDAN' : item.actor,
      assertedBy: item.actor, subject: session.relationship_id, text: item.text,
      evidenceRefs: item.evidence_refs, perspectiveState: item.actor === 'MORE' ? 'MORE_HYPOTHESIS' : item.actor === 'SYSTEM' ? 'SYSTEM_RECORD' : item.actor === 'MANAGER' ? 'RECRUITER_ASSERTION' : 'CANDIDATE_ASSERTION',
      occurredAt: item.occurred_at, lineage: item.lineage, metadata: item.metadata,
    })),
    activeHypotheses: compatible(session.current_projection || {}) ? session.current_projection?.plan?.hypotheses || [] : [],
    hypothesisHistory: compatibleProjections.flatMap((item) => item.plan?.hypotheses || []).slice(-16),
    decisions: session.decisions,
    commitments: session.proposals.at(-1)?.proposal?.commitments || [],
    scenarioAssumptions: session.scenario_assumptions,
    projectionEligibility: 'SESSION_ONLY',
  });
}

export const RECRUITING_GU_V1_SESSION_CONTRACT = Object.freeze({ rooms: ROOMS, actors: ACTORS, statuses: STATUS, stale_write_policy: 'REFUSE' });
