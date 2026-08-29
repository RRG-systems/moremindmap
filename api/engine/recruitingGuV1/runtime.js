import { FRONTIER_MODEL_CONFIG } from '../../../src/lib/recruitingV2/frontierContract.js';
import { createRecruitingV2FrontierRuntime } from '../recruitingV2/frontierRuntime.js';
import { createRecruitingV2OpenRouterTransport } from '../recruitingV2/openRouterTransport.js';
import {
  appendConversationTurn,
  changeRoom,
  createRecruitingGuSession,
  decidePlan,
  decideSecondOffer,
  frontierSessionContext,
  recordCoachMove,
  recordCompiledProjection,
  recordFrontierProjection,
  recordPlanProposal,
  recordScenarioChange,
} from '../../../src/lib/recruitingGuV1/session.js';
import {
  RECRUITING_GU_EXPERIMENT_2_CONDITIONS,
  isCoachFirstCondition,
  usesDjDemonstrations,
  usesPurposeRankedContext,
} from '../../../src/lib/recruitingGuV1/experiment2Contract.js';
import { rankRecruitingGuWorldForCompiler, scopeRecruitingGuWorldForRoom } from '../../../src/lib/recruitingGuV1/world.js';
import { DJ_COACHING_DEMONSTRATIONS } from './experiment2Prompt.js';
import { createRecruitingGuCoachRuntime } from './experiment2Runtime.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export const GU_V1_PLAN_PROPOSAL_SCHEMA = Object.freeze({
  type: 'object', additionalProperties: false,
  required: ['title', 'summary', 'commitments', 'unresolved'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 160 },
    summary: { type: 'string', minLength: 1, maxLength: 700 },
    commitments: {
      type: 'array', minItems: 1, maxItems: 5,
      items: {
        type: 'object', additionalProperties: false,
        required: ['owner', 'commitment', 'timing', 'intendedOutcome'],
        properties: {
          owner: { type: 'string', minLength: 1, maxLength: 120 },
          commitment: { type: 'string', minLength: 1, maxLength: 420 },
          timing: { type: 'string', minLength: 1, maxLength: 160 },
          intendedOutcome: { type: 'string', minLength: 1, maxLength: 300 },
        },
      },
    },
    unresolved: { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 260 } },
  },
});

function sessionFrom(state, sessionId, authority) {
  const session = state.shared_business_sessions?.[sessionId];
  if (!session) throw new Error('RECRUITING_GU_V1_SESSION_NOT_FOUND');
  if (session.manager_binding.subject_id !== authority.manager_subject_id
      || session.manager_binding.enterprise_id !== authority.enterprise_id
      || session.relationship_id !== authority.relationship_id) {
    throw new Error('RECRUITING_GU_V1_SESSION_SCOPE_DENIED');
  }
  return session;
}

function put(state, session) {
  state.shared_business_sessions ||= {};
  state.shared_business_sessions[session.session_id] = clone(session);
  return session;
}

async function draftPlan({ transport, session, humanPurpose }) {
  const response = await transport({
    schema: GU_V1_PLAN_PROPOSAL_SCHEMA,
    schemaName: 'more_recruiting_gu_v1_plan_proposal',
    messages: [
      {
        role: 'system',
        content: 'You are MORE inside a co-present recruiting consultation. Turn the humans rough proposed support and commitments into a short, concrete, mutual plan. Preserve their meaning; do not add promises, capabilities, money, dates, people, outcomes, or facts they did not supply. Make uncertainty explicit. Return only the strict schema.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          current_request: humanPurpose,
          prior_conversation: session.conversation.slice(-12),
          current_proposal: session.proposals.at(-1)?.proposal || null,
          people: { manager: session.manager_binding.name, invitee: session.subject_binding.name },
        }),
      },
    ],
  });
  return response;
}

export function createSyntheticEffectAdapter(now = () => new Date()) {
  return ({ session, idempotencyKey }) => Object.freeze({
    contract: 'recruiting_gu_v1_synthetic_sponsor_tail_receipt_v1',
    receipt_id: `synthetic-tail-${idempotencyKey.slice(0, 20)}`,
    session_id: session.session_id,
    idempotency_key: idempotencyKey,
    one_time_sponsor_payment: 'SIMULATED',
    three_month_entitlement: 'SIMULATED',
    activation_email: 'SIMULATED',
    follow_up_90_day: 'SCHEDULED_SYNTHETIC',
    reminders: 'SIMULATED',
    external_mutation: false,
    created_at: now().toISOString(),
  });
}

export function createRecruitingGuV1Runtime({
  store,
  worldResolver,
  apiKey,
  modelConfig = FRONTIER_MODEL_CONFIG,
  frontierTransport = null,
  contextResolver = null,
  experimentCondition = RECRUITING_GU_EXPERIMENT_2_CONDITIONS.DEMONSTRATIONS,
  effectAdapter = createSyntheticEffectAdapter(),
  now = () => new Date(),
} = {}) {
  if (typeof store?.read !== 'function' || typeof store?.transaction !== 'function') throw new Error('RECRUITING_GU_V1_STORE_REQUIRED');
  if (typeof worldResolver !== 'function') throw new Error('RECRUITING_GU_V1_WORLD_RESOLVER_REQUIRED');
  const transport = frontierTransport || createRecruitingV2OpenRouterTransport({ apiKey, modelConfig });
  if (!Object.values(RECRUITING_GU_EXPERIMENT_2_CONDITIONS).includes(experimentCondition)) throw new Error('RECRUITING_GU_V1_EXPERIMENT_CONDITION_INVALID');
  const coachRuntime = createRecruitingGuCoachRuntime({ transport, modelConfig });

  async function open({ authority, binding }) {
    const world = await worldResolver({ authority, binding });
    const session = await store.transaction((state) => {
      state.shared_business_sessions ||= {};
      const existing = Object.values(state.shared_business_sessions).find((item) => item.relationship_id === authority.relationship_id && item.status !== 'COMPLETED');
      if (existing) return existing;
      return put(state, createRecruitingGuSession({
        relationshipId: authority.relationship_id,
        manager: {
          subject_id: authority.manager_subject_id,
          membership_id: authority.membership_id,
          enterprise_id: authority.enterprise_id,
          name: binding.manager.name,
          entitlement_mode: binding.manager.entitlement_mode,
        },
        invitee: binding.invitee,
        subjectProfileId: binding.invitee.profile_id,
        syntheticOnly: binding.synthetic_only,
        worldVersion: world.version,
        now: now(),
      }));
    });
    return { session, world, authored_surfaces: binding.authored_surfaces, manager: binding.manager, invitee: binding.invitee };
  }

  async function read({ authority, sessionId }) {
    const state = await store.read();
    return clone(sessionFrom(state, sessionId, authority));
  }

  async function mutateSimple({ authority, sessionId, action, payload }) {
    return store.transaction((state) => {
      const current = sessionFrom(state, sessionId, authority);
      let next;
      if (action === 'CHANGE_ROOM') next = changeRoom(current, { room: payload.room, expectedRevision: payload.expected_revision, actor: 'MANAGER' }, now());
      else if (action === 'SCENARIO_CHANGE') next = recordScenarioChange(current, { values: payload.values, expectedRevision: payload.expected_revision, actor: 'MANAGER' }, now());
      else if (action === 'PLAN_DECISION') next = decidePlan(current, { decision: payload.decision, expectedRevision: payload.expected_revision, actor: 'MANAGER' }, now());
      else if (action === 'SECOND_OFFER_DECISION') next = decideSecondOffer(current, { decision: payload.decision, expectedRevision: payload.expected_revision, actor: 'MANAGER', effectAdapter }, now());
      else throw new Error('RECRUITING_GU_V1_ACTION_INVALID');
      return put(state, next);
    });
  }

  async function chat({ authority, sessionId, payload }) {
    const afterHuman = await store.transaction((state) => {
      const current = sessionFrom(state, sessionId, authority);
      const next = appendConversationTurn(current, {
        actor: payload.actor || 'MANAGER', message: payload.message, room: current.current_room,
        expectedRevision: payload.expected_revision,
      }, now());
      return put(state, next);
    });
    const startedAt = performance.now();
    if (afterHuman.current_room === 'PLAN') {
      const response = await draftPlan({ transport, session: afterHuman, humanPurpose: payload.message });
      const session = await store.transaction((state) => {
        const current = sessionFrom(state, sessionId, authority);
        const next = recordPlanProposal(current, { proposal: response.parsed, basedOnRevision: afterHuman.revision }, now());
        return put(state, next);
      });
      return { session, latency: { total_ms: Math.round(performance.now() - startedAt), provider_ms: response.receipt.latencyMs, progressive_state: true }, provider_receipt: response.receipt };
    }
    const world = await worldResolver({ authority, session: afterHuman });
    if (world.version !== afterHuman.world_version) throw new Error('RECRUITING_GU_V1_GOVERNED_WORLD_STALE');
    if (isCoachFirstCondition(experimentCondition)) {
      const ranked = usesPurposeRankedContext(experimentCondition);
      const governedWorld = ranked ? scopeRecruitingGuWorldForRoom(world, afterHuman.current_room) : world;
      const contextResult = ranked
        ? await contextResolver?.({ authority, session: afterHuman, purpose: payload.message, room: afterHuman.current_room, world: governedWorld })
        : null;
      if (ranked && !contextResult?.context) throw new Error('RECRUITING_GU_V1_PURPOSE_CONTEXT_REQUIRED');
      const result = await coachRuntime.coach({
        world: governedWorld,
        sessionContext: frontierSessionContext(afterHuman, { roomScoped: ranked }),
        purpose: payload.message,
        purposeContext: contextResult?.context || null,
        demonstrations: usesDjDemonstrations(experimentCondition) ? DJ_COACHING_DEMONSTRATIONS : [],
      });
      const session = await store.transaction((state) => {
        const current = sessionFrom(state, sessionId, authority);
        const next = recordCoachMove(current, {
          move: result.move,
          receipt: result.receipt,
          basedOnRevision: afterHuman.revision,
          condition: experimentCondition,
        }, now());
        return put(state, next);
      });
      return {
        session,
        world: governedWorld,
        visual_requested: result.move.visual.materiallyHelps === true,
        coach_move_id: session.current_coach_move.coach_move_id,
        context_receipt: contextResult?.receipt || null,
        experiment_condition: experimentCondition,
        latency: {
          total_ms: Math.round(performance.now() - startedAt),
          coach_ms: result.receipt.totalLatencyMs,
          provider_ms: result.receipt.provider?.latencyMs || null,
          visual_ms: null,
          progressive_state: true,
        },
        provider_receipt: result.receipt,
      };
    }
    const planner = createRecruitingV2FrontierRuntime({ transport, modelConfig, governedWorld: world });
    const result = await planner.planSurface({ purpose: payload.message, sessionContext: frontierSessionContext(afterHuman) });
    const session = await store.transaction((state) => {
      const current = sessionFrom(state, sessionId, authority);
      const next = recordFrontierProjection(current, { plan: result.plan, receipt: result.receipt, basedOnRevision: afterHuman.revision }, now());
      return put(state, next);
    });
    return { session, world, latency: { total_ms: Math.round(performance.now() - startedAt), provider_ms: result.receipt.provider?.latencyMs || null, progressive_state: true }, provider_receipt: result.receipt };
  }

  async function compileGu({ authority, sessionId, payload }) {
    if (!isCoachFirstCondition(experimentCondition)) throw new Error('RECRUITING_GU_V1_OPTIONAL_COMPILER_NOT_ACTIVE');
    const state = await store.read();
    const current = sessionFrom(state, sessionId, authority);
    if (current.revision !== payload.expected_revision) {
      const error = new Error('RECRUITING_GU_V1_STALE_SESSION_REFUSED');
      error.current_revision = current.revision;
      throw error;
    }
    const coachRecord = current.current_coach_move;
    if (!coachRecord || coachRecord.coach_move_id !== payload.coach_move_id) throw new Error('RECRUITING_GU_V1_COACH_MOVE_STALE');
    if (coachRecord.move.visual.materiallyHelps !== true) throw new Error('RECRUITING_GU_V1_VISUAL_NOT_REQUESTED');
    const startedAt = performance.now();
    const fullWorld = await worldResolver({ authority, session: current });
    if (fullWorld.version !== current.world_version) throw new Error('RECRUITING_GU_V1_GOVERNED_WORLD_STALE');
    const ranked = usesPurposeRankedContext(experimentCondition);
    const roomWorld = ranked ? scopeRecruitingGuWorldForRoom(fullWorld, current.current_room) : fullWorld;
    const compilerWorld = rankRecruitingGuWorldForCompiler(
      roomWorld,
      `${coachRecord.move.insight} ${coachRecord.move.explanation} ${coachRecord.move.visual.semanticIdea}`,
    );
    const planner = createRecruitingV2FrontierRuntime({ transport, modelConfig, governedWorld: compilerWorld });
    const result = await planner.planSurface({
      purpose: coachRecord.move.visual.semanticIdea,
      sessionContext: frontierSessionContext(current, { roomScoped: ranked }),
      coachingMove: coachRecord.move,
    });
    const session = await store.transaction((nextState) => {
      const latest = sessionFrom(nextState, sessionId, authority);
      const next = recordCompiledProjection(latest, {
        plan: result.plan,
        receipt: result.receipt,
        basedOnRevision: current.revision,
        coachMoveId: coachRecord.coach_move_id,
      }, now());
      return put(nextState, next);
    });
    return {
      session,
      world: compilerWorld,
      experiment_condition: experimentCondition,
      latency: {
        total_ms: Math.round(performance.now() - startedAt),
        coach_ms: coachRecord.receipt?.totalLatencyMs || null,
        visual_ms: result.receipt.totalLatencyMs,
        provider_ms: result.receipt.provider?.latencyMs || null,
        progressive_state: true,
      },
      provider_receipt: result.receipt,
    };
  }

  return Object.freeze({ open, read, chat, compileGu, mutateSimple, modelConfig, experimentCondition });
}
