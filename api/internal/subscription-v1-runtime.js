import { hashCanonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';
import { coachingEpisodeProjection, createRelationshipEpisodeEvent, validateSessionCloseOutputV1 } from '../../src/lib/subscriptionV1/index.js';
import {
  appendDiagnostics,
  authenticateInternalDevRequest,
  consumeRuntimeCsrf,
  createInternalSyntheticEntitlement,
  establishS2FirstSessionRelationshipEvent,
  getSubscriptionRedis,
  internalDevKeys,
  issueRuntimeCsrf,
  mergeExternalEvidence,
  readDiagnostics,
  readS2FirstSessionRelationshipEvent,
  sameOriginRequest,
  setNoStore,
  withDurableAllowanceLedger,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';
import { createSubscriptionS2GuRuntime } from '../engine/subscriptionS2/guRuntime.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

async function defaultLoadSubscriber(args) {
  const { loadAuthorizedSubscriptionDemoSubscriber } = await import('../engine/subscriptionS2/demoSubscriberLoader.js');
  return loadAuthorizedSubscriptionDemoSubscriber(args);
}

function publicIdentity(loaded) {
  return loaded?.identity || { first_name: 'Jordan', vertical: 'Real Estate', synthetic_only: true, demo_subject: 'SYNTHETIC' };
}

function publicDemoSubject(auth) {
  return auth?.demo_subject || auth?.capability?.demo_subject_id || 'synthetic';
}

function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}

function wantsProgressiveTurn(req) {
  return String(req.headers?.accept || '').split(',').some((value) => value.trim().startsWith('application/x-ndjson'));
}

function startProgressiveResponse(res) {
  setNoStore(res);
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

function writeProgressiveEvent(res, event) {
  res.write(`${JSON.stringify(event)}\n`);
  res.flush?.();
}

function safeConversation(value) {
  if (!Array.isArray(value) || value.length > 24) return [];
  const turns = [];
  let total = 0;
  for (const turn of value) {
    if (!['customer', 'coach'].includes(turn?.role) || typeof turn?.content !== 'string') return [];
    const content = turn.content.trim().slice(0, 5000);
    if (!content) continue;
    total += content.length;
    if (total > 40_000) break;
    turns.push({ role: turn.role, content });
  }
  return turns;
}

function safeSessionLearningDraft(value) {
  if (!value || typeof value !== 'object') return null;
  const fields = ['what_mattered', 'what_changed', 'what_was_learned', 'what_was_decided', 'what_remains_open', 'durable_governed_meaning', 'pick_up_next_time'];
  const draft = Object.fromEntries(fields.map((field) => [field, value[field]]));
  const validation = validateSessionCloseOutputV1({ customer_message: 'Ephemeral mutual-close draft.', session_learning: draft });
  return validation.valid ? clone(draft) : null;
}

const LENS_BY_SURFACE = Object.freeze({
  overview: 'OVERVIEW',
  where: 'WHERE_YOU_ARE',
  futures: 'FIVE_FUTURES',
  move: 'ONE_MOVE',
  plan: 'PLAN',
  evidence: 'EVIDENCE',
});

function safeVisibleContext(value) {
  const surface = String(value?.surface || 'overview').toLowerCase();
  const active_lens = LENS_BY_SURFACE[surface] || 'OVERVIEW';
  const visible_objects = Array.isArray(value?.visible_objects)
    ? value.visible_objects.filter((item) => typeof item === 'string' && item.trim()).slice(0, 20).map((item) => item.trim().slice(0, 120))
    : [];
  const purpose = active_lens === 'EVIDENCE'
    ? 'EVIDENCE_REVIEW'
    : active_lens === 'FIVE_FUTURES'
      ? 'REVIEW_FUTURES'
      : active_lens === 'ONE_MOVE'
        ? 'REVIEW_ONE_MOVE'
        : null;
  return { visible_customer_context: { surface, visible_objects }, active_lens, purpose, topics: visible_objects };
}

function publicPendingProposal(proposal) {
  return proposal ? {
    proposal_id: proposal.proposal_id,
    summary: proposal.summary,
    reason: proposal.reason,
    proposed_items: clone(proposal.proposed_items || []),
  } : null;
}

function publicSession(session, allowance, episodePhase = session.charge_point_reached ? 'ACTIVE' : 'IDLE') {
  return {
    session_id: session.session_id,
    session_class: session.session_class,
    state: session.state,
    activated_at: session.activated_at,
    hard_expires_at: session.hard_expires_at,
    charge_point_reached: session.charge_point_reached,
    approximate_minutes: 30,
    standard_sessions_per_cycle: allowance.standard_slots_total,
    standard_sessions_used: allowance.standard_slots_consumed,
    standard_sessions_available: allowance.standard_slots_available,
    onboarding_included: true,
    onboarding_consumed: allowance.onboarding_consumed,
    conversational_time_controller: false,
    coaching_episode_phase: episodePhase,
    relationship_continuous: true,
    pre_session_state: null,
    start_action: null,
  };
}

function publicAllowanceBoundary(allowance) {
  return {
    session_id: null,
    session_class: null,
    state: 'ALLOWANCE_EXHAUSTED',
    activated_at: null,
    hard_expires_at: null,
    charge_point_reached: false,
    approximate_minutes: 30,
    standard_sessions_per_cycle: allowance.standard_slots_total,
    standard_sessions_used: allowance.standard_slots_consumed,
    standard_sessions_available: allowance.standard_slots_available,
    onboarding_included: true,
    onboarding_consumed: allowance.onboarding_consumed,
    conversational_time_controller: false,
    coaching_episode_phase: 'IDLE',
    relationship_continuous: true,
    pre_session_state: 'ALLOWANCE_EXHAUSTED',
    start_action: null,
  };
}

function publicPreSession(allowance, firstSessionEstablished) {
  const first = !firstSessionEstablished;
  return {
    session_id: null,
    session_class: allowance.onboarding_consumed ? 'STANDARD' : 'ONBOARDING_INCLUDED',
    state: 'READY_TO_START',
    activated_at: null,
    hard_expires_at: null,
    charge_point_reached: false,
    approximate_minutes: 30,
    standard_sessions_per_cycle: allowance.standard_slots_total,
    standard_sessions_used: allowance.standard_slots_consumed,
    standard_sessions_available: allowance.standard_slots_available,
    onboarding_included: true,
    onboarding_consumed: allowance.onboarding_consumed,
    conversational_time_controller: false,
    coaching_episode_phase: 'IDLE',
    relationship_continuous: true,
    pre_session_state: first ? 'PRE_FIRST_SESSION' : 'READY_TO_START',
    start_action: first ? 'START_MY_FIRST_SESSION' : 'START_SESSION',
  };
}

export async function inspectSessionAvailability({ redis, keys, scope, now }) {
  return withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const entitlement = createInternalSyntheticEntitlement({ scope, asOf: now });
    const cycle = ledger.createCycle(entitlement);
    if (!cycle.ok) return cycle;
    const inspected = ledger.inspect({ ledger_id: cycle.ledger.ledger_id, scope, now: now.toISOString() });
    const active = inspected.sessions.find((item) => ['ACTIVE', 'GRACE', 'RESERVED'].includes(item.state));
    if (active?.state === 'GRACE') {
      const resumed = ledger.resume({ session_id: active.session_id, scope, now: now.toISOString() });
      if (!resumed.ok) return resumed;
      return { ok: true, code: 'SUBSCRIPTION_S2_ACTIVE_SESSION_RECOVERED', session: resumed.session, allowance: inspected.ledger, entitlement, session_history: inspected.sessions };
    }
    if (active?.state === 'RESERVED') {
      return { ok: true, code: 'SUBSCRIPTION_S2_SESSION_RESERVED_NOT_STARTED', session: active, allowance: inspected.ledger, entitlement, session_history: inspected.sessions };
    }
    return { ok: true, code: active ? 'SUBSCRIPTION_S2_ACTIVE_SESSION_READY' : 'SUBSCRIPTION_S2_PRE_SESSION_READY', session: active || null, allowance: inspected.ledger, entitlement, session_history: inspected.sessions };
  }});
}

export async function beginExplicitSession({ redis, keys, scope, now }) {
  return withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const entitlement = createInternalSyntheticEntitlement({ scope, asOf: now });
    const cycle = ledger.createCycle(entitlement);
    if (!cycle.ok) return cycle;
    let inspected = ledger.inspect({ ledger_id: cycle.ledger.ledger_id, scope, now: now.toISOString() });
    let active = inspected.sessions.find((item) => ['ACTIVE', 'GRACE', 'RESERVED'].includes(item.state));
    if (active?.state === 'GRACE') {
      const resumed = ledger.resume({ session_id: active.session_id, scope, now: now.toISOString() });
      if (!resumed.ok) return resumed;
      active = resumed.session;
    }
    if (active?.state === 'RESERVED') {
      const activated = ledger.activate({ session_id: active.session_id, scope, now: now.toISOString() });
      if (!activated.ok) return activated;
      active = activated.session;
    }
    if (active?.state === 'ACTIVE') {
      return { ok: true, code: 'IDEMPOTENT_REPLAY', session: active, allowance: inspected.ledger, entitlement, session_history: inspected.sessions };
    }
    const sessionClass = cycle.ledger.onboarding_consumed ? 'STANDARD' : 'ONBOARDING_INCLUDED';
    const ordinal = inspected.sessions.length + 1;
    const reserved = ledger.reserve({
      ledger_id: cycle.ledger.ledger_id,
      scope,
      session_class: sessionClass,
      idempotency_key: `s2-explicit-start:${keys.scope_hash}:${cycle.ledger.ledger_id}:${ordinal}`,
      now: now.toISOString(),
    });
    if (!reserved.ok) return { ...reserved, allowance: inspected.ledger, entitlement };
    const activated = ledger.activate({ session_id: reserved.session.session_id, scope, now: now.toISOString() });
    if (!activated.ok) return activated;
    inspected = ledger.inspect({ ledger_id: cycle.ledger.ledger_id, scope, now: now.toISOString() });
    return { ok: true, code: 'SUBSCRIPTION_S2_SESSION_EXPLICITLY_STARTED', session: activated.session, allowance: inspected.ledger, entitlement, session_history: inspected.sessions };
  }});
}

async function releaseUnchargedSession({ redis, keys, scope, sessionId, now }) {
  return withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => ledger.release({ session_id: sessionId, scope, now: now.toISOString() }) });
}

function materialMapDelta(beforePublication, afterPublication) {
  if (!beforePublication || !afterPublication || beforePublication.publication_hash === afterPublication.publication_hash) return null;
  const fiveBoxesChanged = hashCanonicalJson(beforePublication.five_boxes || {}) !== hashCanonicalJson(afterPublication.five_boxes || {});
  const engagementChanged = hashCanonicalJson(beforePublication.engagement || {}) !== hashCanonicalJson(afterPublication.engagement || {});
  const changedObjects = [...new Set(afterPublication.changed_governed_objects || [])];
  const material = fiveBoxesChanged || engagementChanged || changedObjects.length > 0;
  return {
    material,
    beforeVersion: beforePublication.publication_version,
    afterVersion: afterPublication.publication_version,
    beforeHash: beforePublication.publication_hash,
    afterHash: afterPublication.publication_hash,
    changedObjects,
    fiveBoxesChanged,
    engagementChanged,
  };
}

function currentSessionMapDelta(loaded, sessionId) {
  const current = loaded.controller.current();
  if (!current.ok) return null;
  const records = loaded.store.readPersonalRsl({ scope: loaded.scope }).records || [];
  const sessionHasAuthorizedMutation = records.some((record) => record?.event?.session_id === sessionId);
  const changedObjects = [...new Set(current.publication.changed_governed_objects || [])];
  if (!sessionHasAuthorizedMutation || !changedObjects.length || !current.publication.previous_publication_hash) return null;
  return {
    material: true,
    beforeVersion: Math.max(1, current.publication.publication_version - 1),
    afterVersion: current.publication.publication_version,
    beforeHash: current.publication.previous_publication_hash,
    afterHash: current.publication.publication_hash,
    changedObjects,
    fiveBoxesChanged: true,
    engagementChanged: changedObjects.some((item) => ['PLAN_135', 'EVIDENCE', 'LIVING_BUSINESS_STATE'].includes(item)),
  };
}

function deterministicMapChangeReceipt({ loaded, keys, mapDelta, providerError }) {
  const current = loaded.controller.current();
  const packet = loaded.controller.wholeUnderstandingPacket();
  const object = {
    id: 's2-map-delta',
    kind: 'MAP_DELTA',
    title: 'Your Business Twin changed',
    statement: 'The exact change you approved is now part of your Business Twin.',
    items: (mapDelta.changedObjects || []).map((label) => ({ label: String(label).replaceAll('_', ' ').toLowerCase(), value: 'Updated', note: 'You approved this change' })),
  };
  const stateBinding = {
    sessionId: packet.session_id,
    relationshipScopeHash: keys.scope_hash,
    publicationVersion: current.publication.publication_version,
    publicationHash: current.publication.publication_hash,
    understandingHash: packet.packet_hash,
    triggerHash: hashCanonicalJson({ event: 'MAP_CHANGE', mapDelta, publication: current.publication.publication_hash }),
  };
  return {
    ok: true,
    plan: {
      planVersion: 'more-subscription-s2-gu-plan-v1',
      event: 'MAP_CHANGE',
      stateBinding,
      renderDecision: { render: true, reason: 'A real approved change always needs a clear visual receipt.' },
      guidance: { eyebrow: 'YOUR LIVING MAP', headline: 'Here’s how your map changed', summary: 'This is the exact change you approved.', nextCue: 'We will continue from this updated Business Twin.' },
      blocks: [{ blockId: 's2-block-map-change-receipt', type: 'COMPARISON', title: 'What changed', subtitle: 'Nothing else was changed.', objectIds: ['s2-map-delta'], evidenceIds: [], emphasis: 'PRIMARY', reason: 'Show the approved change clearly.', objects: [object], evidence: [] }],
      interactions: [],
      providerReceipt: { provider: 'DETERMINISTIC_GOVERNED_FALLBACK', model: null, store: false, mutation_authority: false },
    },
    receipt: {
      runtime: 'subscription-flagship-s2-map-change-fallback-v1',
      event: 'MAP_CHANGE',
      provider: { stage: 'S2_GU_FALLBACK', model: null, store: false, latency_ms: 0, raw_payload_persisted: false },
      provider_error: String(providerError || 'SUBSCRIPTION_S2_MAP_CHANGE_GU_FAILED').slice(0, 160),
      deterministic_from_real_delta: true,
      mutation_authority: false,
    },
    current,
  };
}

async function generateS2Gu({ event, loaded, keys, sessionLearning = null, mapDelta = null, env = globalThis.process?.env || {} }) {
  const current = loaded.controller.current();
  if (!current.ok) throw new Error(current.code || 'SUBSCRIPTION_S2_CURRENT_STATE_REQUIRED');
  const packet = loaded.controller.wholeUnderstandingPacket();
  const gu = await createSubscriptionS2GuRuntime({ apiKey: env.OPENAI_API_KEY }).generate({
    event,
    packet,
    publication: current.publication,
    viewModel: current.view_model,
    sessionLearning,
    mapDelta,
    relationshipScopeHash: keys.scope_hash,
  });
  return { ...gu, current };
}

export async function ensureActiveSession({ redis, keys, scope, capabilityHash, now }) {
  return withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const entitlement = createInternalSyntheticEntitlement({ scope, asOf: now });
    const cycle = ledger.createCycle(entitlement);
    if (!cycle.ok) return cycle;
    let inspected = ledger.inspect({ ledger_id: cycle.ledger.ledger_id, scope, now: now.toISOString() });
    let session = inspected.sessions.find((item) => ['ACTIVE', 'RESERVED', 'GRACE'].includes(item.state));
    if (session?.state === 'GRACE') {
      const resumed = ledger.resume({ session_id: session.session_id, scope, now: now.toISOString() });
      if (resumed.ok) session = resumed.session;
    }
    if (session?.state === 'RESERVED') {
      const activated = ledger.activate({ session_id: session.session_id, scope, now: now.toISOString() });
      if (!activated.ok) return activated;
      session = activated.session;
    }
    if (!session || session.state !== 'ACTIVE') {
      const sessionClass = cycle.ledger.onboarding_consumed ? 'STANDARD' : 'ONBOARDING_INCLUDED';
      const reserved = ledger.reserve({
        ledger_id: cycle.ledger.ledger_id,
        scope,
        session_class: sessionClass,
        idempotency_key: `internal-entry:${capabilityHash}:${now.toISOString()}`,
        now: now.toISOString(),
      });
      if (!reserved.ok) {
        inspected = ledger.inspect({ ledger_id: cycle.ledger.ledger_id, scope, now: now.toISOString() });
        return { ...reserved, allowance: inspected.ledger, entitlement };
      }
      const activated = ledger.activate({ session_id: reserved.session.session_id, scope, now: now.toISOString() });
      if (!activated.ok) return activated;
      session = activated.session;
    }
    inspected = ledger.inspect({ ledger_id: cycle.ledger.ledger_id, scope, now: now.toISOString() });
    return { ok: true, session, allowance: inspected.ledger, entitlement, session_history: inspected.sessions };
  }});
}

async function inspectBoundSession({ redis, keys, scope, sessionId, now }) {
  return withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const entitlement = createInternalSyntheticEntitlement({ scope, asOf: now });
    const cycle = ledger.createCycle(entitlement);
    if (!cycle.ok) return cycle;
    const inspected = ledger.inspect({ ledger_id: cycle.ledger.ledger_id, scope, now: now.toISOString() });
    const session = inspected.sessions.find((item) => item.session_id === sessionId);
    if (!session || session.state !== 'ACTIVE') return { ok: false, code: 'SUBSCRIPTION_V1_ACTIVE_SESSION_REQUIRED' };
    return { ok: true, session, allowance: inspected.ledger, session_history: inspected.sessions };
  }});
}

async function recordValidResponse({ redis, keys, scope, sessionId, responseHash, now }) {
  return withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const entitlement = createInternalSyntheticEntitlement({ scope, asOf: now });
    const cycle = ledger.createCycle(entitlement);
    if (!cycle.ok) return cycle;
    const charged = ledger.recordFirstValidResponse({ session_id: sessionId, scope, response_hash: responseHash, now: now.toISOString() });
    if (!charged.ok) return charged;
    return { ok: true, session: charged.session, allowance: charged.ledger };
  }});
}

async function completeSession({ redis, keys, scope, sessionId, cumulativeSeconds, now }) {
  return withDurableAllowanceLedger({ redis, keys, operation: async (ledger) => {
    const entitlement = createInternalSyntheticEntitlement({ scope, asOf: now });
    const cycle = ledger.createCycle(entitlement);
    if (!cycle.ok) return cycle;
    const completed = ledger.complete({ session_id: sessionId, scope, now: now.toISOString(), cumulative_active_seconds: cumulativeSeconds });
    if (!completed.ok) return completed;
    return { ok: true, session: completed.session, allowance: completed.ledger };
  }});
}

function usageSummary(receipts = []) {
  return receipts.reduce((summary, receipt) => ({
    provider_calls: summary.provider_calls + 1,
    input_tokens: summary.input_tokens + (receipt.input_tokens || 0),
    cached_input_tokens: summary.cached_input_tokens + (receipt.cached_input_tokens || 0),
    output_tokens: summary.output_tokens + (receipt.output_tokens || 0),
    web_search_calls: summary.web_search_calls + (receipt.web_search_calls || 0),
    estimated_token_cost_microusd: summary.estimated_token_cost_microusd + (receipt.estimated_token_cost_microusd || 0),
  }), { provider_calls: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, web_search_calls: 0, estimated_token_cost_microusd: 0 });
}

export function createSubscriptionV1RuntimeHandler({
  getRedis = getSubscriptionRedis,
  authenticate = authenticateInternalDevRequest,
  loadSubscriber = defaultLoadSubscriber,
  generateGu = generateS2Gu,
  env = globalThis.process?.env || {},
} = {}) {
  return async function handler(req, res) {
  const redis = getRedis(env);
  let auth = null;
  try {
    if (!sameOriginRequest(req, { allowMissingForGet: true })) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ORIGIN_DENIED' });
    auth = await authenticate({ redis, req });
    if (!auth.ok) {
      console.warn(JSON.stringify({
        event: 'SUBSCRIPTION_V1_RUNTIME_AUTH_REJECTED',
        code: String(auth.code || 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_INVALID').slice(0, 120),
        failure_class: String(auth.failure_class || 'AUTHENTICATION_REJECTED_UNCLASSIFIED').slice(0, 120),
        request_correlation_hash: req.headers?.['x-vercel-id'] ? hashCanonicalJson(String(req.headers['x-vercel-id'])).slice(0, 20) : null,
        capability_material_logged: false,
        customer_data_logged: false,
      }));
      return send(res, auth.status, { ok: false, code: auth.code, reentry_required: auth.status === 401 });
    }
    const keys = internalDevKeys({ relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key });
    const now = new Date();

    if (req.method === 'GET' && req.query?.view === 'diagnostics') {
      const csrf_token = await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash });
      const diagnostics = await readDiagnostics({ redis, key: keys.diagnostics });
      return send(res, 200, { ok: true, code: 'SUBSCRIPTION_V1_DIAGNOSTICS_READY', csrf_token, diagnostics, raw_provider_payloads: false });
    }

    if (req.method === 'GET') {
      const provisional = await loadSubscriber({
        redis,
        relationship_key: auth.capability.relationship_key,
        subject_key: auth.capability.subject_key,
        session_id: 'session_000000000000000000000000',
        session_kind: 'FIRST_EVER',
        coaching_episode_phase: 'IDLE',
        initial_conversation: [],
        env,
      });
      const firstRelationshipEvent = await readS2FirstSessionRelationshipEvent({ redis, key: keys.s2_relationship, relationshipScopeHash: keys.scope_hash });
      if (!firstRelationshipEvent.ok) return send(res, 409, { ok: false, code: firstRelationshipEvent.code });
      const availability = await inspectSessionAvailability({ redis, keys, scope: provisional.scope, now });
      if (!availability.ok) return send(res, 409, { ok: false, code: availability.code });
      if (!availability.session || availability.session.state === 'RESERVED') {
        const firstSessionEstablished = Boolean(firstRelationshipEvent.event);
        const allowanceExhausted = firstSessionEstablished && availability.allowance.standard_slots_available < 1;
        const csrf_token = allowanceExhausted ? null : await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash });
        return send(res, 200, {
          ok: true,
          code: allowanceExhausted ? 'SUBSCRIPTION_V1_RELATIONSHIP_READY_ALLOWANCE_EXHAUSTED' : 'SUBSCRIPTION_S2_PRE_SESSION_READY',
          csrf_token,
          demo_subject: publicDemoSubject(auth),
          demo_subject_switching: auth.capability.demo_subject_switching === true,
          demo_reset_enabled: auth.capability.demo_reset_enabled === true,
          identity: publicIdentity(provisional),
          view_model: provisional.current.view_model,
          publication: provisional.current.publication,
          session: allowanceExhausted ? publicAllowanceBoundary(availability.allowance) : publicPreSession(availability.allowance, firstSessionEstablished),
          architecture: { ...provisional.architecture, s2_structure_sandwich: true, free_frontier_middle_unchanged: true },
          entitlement: { source: 'INTERNAL_SYNTHETIC', billing_evidence: false, stripe_mutation: false, same_downstream_session_contract: true },
          provider: { model: 'gpt-5.6-sol', store: false, server_side: true, browser_secret: false },
          coaching_available: !allowanceExhausted,
          first_session_relationship_established: firstSessionEstablished,
        });
      }
      const active = availability;
      const sessionKind = active.session.session_class === 'ONBOARDING_INCLUDED' ? 'FIRST_EVER' : 'WEEKLY';
      const loaded = await loadSubscriber({
        redis,
        relationship_key: auth.capability.relationship_key,
        subject_key: auth.capability.subject_key,
        session_id: active.session.session_id,
        session_kind: sessionKind,
        coaching_episode_phase: 'IDLE',
        session_temporal_context: { session_history: active.session_history },
        initial_conversation: [],
        env,
      });
      const csrf_token = await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash });
      return send(res, 200, {
        ok: true,
        code: 'SUBSCRIPTION_V1_PRODUCTION_INTENDED_SUBSCRIBER_READY',
        csrf_token,
        demo_subject: publicDemoSubject(auth),
        demo_subject_switching: auth.capability.demo_subject_switching === true,
        demo_reset_enabled: auth.capability.demo_reset_enabled === true,
        identity: publicIdentity(loaded),
        view_model: loaded.current.view_model,
        publication: loaded.current.publication,
        pending_proposal: publicPendingProposal(loaded.controller.pendingProposal()),
        session: publicSession(active.session, active.allowance),
        architecture: { ...loaded.architecture, s2_structure_sandwich: true, free_frontier_middle_unchanged: true },
        entitlement: { source: 'INTERNAL_SYNTHETIC', billing_evidence: false, stripe_mutation: false, same_downstream_session_contract: true },
        provider: { model: 'gpt-5.6-sol', store: false, server_side: true, browser_secret: false },
        coaching_available: true,
        first_session_relationship_established: Boolean(firstRelationshipEvent.event),
      });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    const csrfOk = await consumeRuntimeCsrf({ redis, capabilityHash: auth.capability_hash, proof: req.headers?.['x-subscription-runtime-csrf'] });
    if (!csrfOk) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_RUNTIME_CSRF_DENIED' });
    const nextCsrf = await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash });
    const action = String(req.body?.action || '');

    if (['START_MY_FIRST_SESSION', 'START_SESSION'].includes(action)) {
      const provisional = await loadSubscriber({
        redis,
        relationship_key: auth.capability.relationship_key,
        subject_key: auth.capability.subject_key,
        session_id: 'session_000000000000000000000000',
        session_kind: 'FIRST_EVER',
        coaching_episode_phase: 'IDLE',
        initial_conversation: [],
        env,
      });
      const existingFirstEvent = await readS2FirstSessionRelationshipEvent({ redis, key: keys.s2_relationship, relationshipScopeHash: keys.scope_hash });
      if (!existingFirstEvent.ok) return send(res, 409, { ok: false, code: existingFirstEvent.code, csrf_token: nextCsrf });
      const firstSessionEstablished = Boolean(existingFirstEvent.event);
      if (action === 'START_MY_FIRST_SESSION' && firstSessionEstablished) return send(res, 409, { ok: false, code: 'SUBSCRIPTION_S2_FIRST_SESSION_ALREADY_ESTABLISHED', csrf_token: nextCsrf });
      if (action === 'START_SESSION' && !firstSessionEstablished) return send(res, 409, { ok: false, code: 'SUBSCRIPTION_S2_FIRST_SESSION_START_REQUIRED', csrf_token: nextCsrf });
      const started = await beginExplicitSession({ redis, keys, scope: provisional.scope, now });
      if (!started.ok) return send(res, 409, { ok: false, code: started.code, csrf_token: nextCsrf });
      const sessionKind = started.session.session_class === 'ONBOARDING_INCLUDED' ? 'FIRST_EVER' : 'WEEKLY';
      const loaded = await loadSubscriber({
        redis,
        relationship_key: auth.capability.relationship_key,
        subject_key: auth.capability.subject_key,
        session_id: started.session.session_id,
        session_kind: sessionKind,
        coaching_episode_phase: 'STARTED',
        session_temporal_context: { session_history: started.session_history },
        initial_conversation: [],
        env,
      });
      let gu;
      try {
        gu = await generateGu({
          event: firstSessionEstablished ? 'SESSION_OPENING' : 'FIRST_SESSION_WELCOME',
          loaded,
          keys,
          env,
        });
      } catch (error) {
        if (started.code === 'SUBSCRIPTION_S2_SESSION_EXPLICITLY_STARTED') {
          await releaseUnchargedSession({ redis, keys, scope: provisional.scope, sessionId: started.session.session_id, now });
        }
        return send(res, 422, { ok: false, code: error.code || 'SUBSCRIPTION_S2_OPENING_GU_FAILED_CLOSED', csrf_token: nextCsrf, mutation_performed: false });
      }
      let firstEvent = existingFirstEvent;
      if (!firstSessionEstablished) {
        firstEvent = await establishS2FirstSessionRelationshipEvent({
          redis,
          key: keys.s2_relationship,
          relationshipScopeHash: keys.scope_hash,
          sessionId: started.session.session_id,
          establishedAt: now,
        });
        if (!firstEvent.ok) {
          if (started.code === 'SUBSCRIPTION_S2_SESSION_EXPLICITLY_STARTED') {
            await releaseUnchargedSession({ redis, keys, scope: provisional.scope, sessionId: started.session.session_id, now });
          }
          return send(res, 409, { ok: false, code: firstEvent.code, csrf_token: nextCsrf, mutation_performed: false });
        }
      }
      await appendDiagnostics({ redis, key: keys.diagnostics, event: `S2_${gu.plan.event}_GU_RENDERED`, receipts: [gu.receipt.provider] });
      return send(res, 200, {
        ok: true,
        code: firstSessionEstablished ? 'SUBSCRIPTION_S2_RETURNING_SESSION_STARTED' : 'SUBSCRIPTION_S2_FIRST_SESSION_STARTED',
        csrf_token: nextCsrf,
        identity: publicIdentity(loaded),
        view_model: gu.current.view_model,
        publication: gu.current.publication,
        session: publicSession(started.session, started.allowance, 'STARTED'),
        coaching_episode: coachingEpisodeProjection({ phase: 'STARTED', transitions: ['IDLE', 'STARTED'] }),
        gu_plan: gu.plan,
        gu_receipt: gu.receipt,
        first_session_relationship_event: firstEvent.event ? {
          event_type: firstEvent.event.event_type,
          event_hash: firstEvent.event.event_hash,
          established_at: firstEvent.event.established_at,
          canonical_mutation_performed: false,
          personal_rsl_mutation_performed: false,
        } : null,
        mutation_performed: false,
        allowance_consumed: false,
      });
    }

    if (action === 'END_SESSION') {
      const provisional = await loadSubscriber({
        redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
        session_id: req.body?.session_id, session_kind: 'WEEKLY', initial_conversation: [], coaching_episode_phase: 'IDLE',
        env,
      });
      const bound = await inspectBoundSession({ redis, keys, scope: provisional.scope, sessionId: req.body?.session_id, now });
      if (!bound.ok) return send(res, 409, { ok: false, code: bound.code, csrf_token: nextCsrf });
      const conversation = safeConversation(req.body?.conversation);
      const alignmentMessage = String(req.body?.alignment_message || '').trim().slice(0, 5000);
      const closeMode = alignmentMessage ? 'FINALIZE' : 'REQUEST_ALIGNMENT';
      const priorSessionLearning = safeSessionLearningDraft(req.body?.prior_session_learning);
      let closeResult = null;
      let closingLoaded = null;
      if (bound.session.charge_point_reached) {
        const sessionKind = bound.session.session_class === 'ONBOARDING_INCLUDED' ? 'FIRST_EVER' : 'WEEKLY';
        closingLoaded = await loadSubscriber({
          redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
          session_id: bound.session.session_id, session_kind: sessionKind, initial_conversation: conversation, coaching_episode_phase: 'ENDING', session_temporal_context: { session_history: bound.session_history }, env,
        });
        const visible = safeVisibleContext(req.body?.visible_customer_context);
        closeResult = await closingLoaded.controller.endSession({
          active_lens: visible.active_lens,
          visible_customer_context: visible.visible_customer_context,
          mode: closeMode,
          alignment_message: alignmentMessage || null,
          prior_session_learning: priorSessionLearning,
        });
        if (!closeResult.ok) return send(res, 422, { ok: false, code: closeResult.code, csrf_token: nextCsrf, mutation_performed: false });
      }
      const closeReceipts = closeResult?.receipt ? [closeResult.receipt] : [];
      if (closeResult?.mutual_close?.human_alignment_required) {
        await appendDiagnostics({ redis, key: keys.diagnostics, event: 'SESSION_MUTUAL_CLOSE_ALIGNMENT_REQUESTED', receipts: closeReceipts });
        return send(res, 200, {
          ok: true,
          code: 'SUBSCRIPTION_V1_SESSION_MUTUAL_CLOSE_ALIGNMENT_REQUESTED',
          csrf_token: nextCsrf,
          customer_message: closeResult.customer_message,
          session_learning: closeResult.session_learning,
          mutual_close: closeResult.mutual_close,
          confirmation_required: Boolean(closeResult.confirmation_required),
          pending_proposal: publicPendingProposal(closeResult.proposal),
          mutation_performed: false,
          usage: usageSummary(closeReceipts),
          session: publicSession(bound.session, bound.allowance, 'ENDING'),
          coaching_episode: coachingEpisodeProjection({ phase: 'ENDING', transitions: ['ENDING'] }),
          raw_provider_payload_persisted: false,
        });
      }
      if (!closingLoaded) {
        const sessionKind = bound.session.session_class === 'ONBOARDING_INCLUDED' ? 'FIRST_EVER' : 'WEEKLY';
        closingLoaded = await loadSubscriber({
          redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
          session_id: bound.session.session_id, session_kind: sessionKind, initial_conversation: conversation,
          coaching_episode_phase: 'ENDING', session_temporal_context: { session_history: bound.session_history }, env,
        });
      }
      const closingLearning = closeResult?.session_learning || {
        status: 'NOTES_READY',
        what_mattered: 'The customer chose to end before a substantive coaching exchange was completed.',
        what_changed: 'The governed Business Twin did not change.',
        what_was_learned: 'No new shared learning was established.',
        what_was_decided: 'The customer decided to end this bounded session.',
        what_remains_open: 'The prior governed state and open loops remain available next time.',
        durable_governed_meaning: 'No new durable meaning was authorized.',
        pick_up_next_time: 'Begin again from the current governed Business Twin and relationship state.',
      };
      const closingMapDelta = currentSessionMapDelta(closingLoaded, bound.session.session_id);
      let closingGu;
      try {
        closingGu = await generateGu({
          event: 'SESSION_CLOSING',
          loaded: closingLoaded,
          keys,
          sessionLearning: closingLearning,
          mapDelta: closingMapDelta,
          env,
        });
      } catch (error) {
        return send(res, 422, { ok: false, code: error.code || 'SUBSCRIPTION_S2_CLOSING_GU_FAILED_CLOSED', csrf_token: nextCsrf, mutation_performed: false });
      }
      const sessionLearningEpisode = createRelationshipEpisodeEvent({
        scope: closingLoaded.scope,
        session_id: bound.session.session_id,
        event_type: 'SESSION_LEARNING',
        summary: [
          closingLearning.what_mattered,
          closingLearning.what_changed,
          closingLearning.what_was_learned,
          closingLearning.what_was_decided,
          closingLearning.what_remains_open,
          closingLearning.pick_up_next_time,
        ].filter(Boolean).join(' ').slice(0, 1200),
        occurred_at: now.toISOString(),
        source_content_hash: hashCanonicalJson(closingLearning),
      });
      if (!sessionLearningEpisode.ok) return send(res, 422, { ok: false, code: sessionLearningEpisode.code, csrf_token: nextCsrf, mutation_performed: false });
      const sessionLearningAppend = await closingLoaded.store.appendRelationshipEpisodeEvents({
        scope: closingLoaded.scope,
        events: [sessionLearningEpisode.event],
        appended_at: now.toISOString(),
      });
      if (!sessionLearningAppend.ok) return send(res, 409, { ok: false, code: sessionLearningAppend.code, csrf_token: nextCsrf, mutation_performed: false });
      const completed = await completeSession({ redis, keys, scope: provisional.scope, sessionId: req.body?.session_id, cumulativeSeconds: Math.max(0, Math.min(7200, Number(req.body?.cumulative_active_seconds) || 0)), now });
      if (!completed.ok) return send(res, 409, { ok: false, code: completed.code, csrf_token: nextCsrf });
      await appendDiagnostics({ redis, key: keys.diagnostics, event: 'SESSION_COMPLETED', receipts: [...closeReceipts, closingGu.receipt.provider] });
      return send(res, 200, {
        ok: true,
        code: 'SUBSCRIPTION_V1_SESSION_COMPLETED',
        csrf_token: nextCsrf,
        customer_message: closeResult?.customer_message || null,
        session_learning: closingLearning,
        mutual_close: closeResult?.mutual_close || null,
        confirmation_required: Boolean(closeResult?.confirmation_required),
        pending_proposal: publicPendingProposal(closeResult?.proposal),
        mutation_performed: false,
        usage: usageSummary(closeReceipts),
        session: publicSession(completed.session, completed.allowance, 'IDLE'),
        next_pre_session: publicPreSession(completed.allowance, true),
        gu_plan: closingGu.plan,
        gu_receipt: closingGu.receipt,
        session_map_delta: closingMapDelta,
        coaching_episode: coachingEpisodeProjection({
          phase: 'IDLE',
          transitions: closeResult ? ['ENDING', 'SESSION_LEARNING_NOTES_READY', 'IDLE'] : ['IDLE'],
        }),
        raw_provider_payload_persisted: false,
        session_learning_episode: {
          event_hash: sessionLearningEpisode.event.event_hash,
          canonical_customer_truth_mutated: false,
          personal_rsl_mutated: false,
          raw_transcript_persisted: false,
        },
      });
    }

    if (!['TURN', 'DECISION'].includes(action)) return send(res, 400, { ok: false, code: 'SUBSCRIPTION_V1_RUNTIME_ACTION_INVALID', csrf_token: nextCsrf });
    const provisional = await loadSubscriber({
      redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
      session_id: req.body?.session_id, session_kind: 'WEEKLY', initial_conversation: [], env,
    });
    const bound = await inspectBoundSession({ redis, keys, scope: provisional.scope, sessionId: req.body?.session_id, now });
    if (!bound.ok) return send(res, 409, { ok: false, code: bound.code, csrf_token: nextCsrf });
    const sessionKind = bound.session.session_class === 'ONBOARDING_INCLUDED' ? 'FIRST_EVER' : 'WEEKLY';
    const coachingEpisodePhase = bound.session.charge_point_reached ? 'ACTIVE' : 'STARTED';
    const conversation = safeConversation(req.body?.conversation);
    const loaded = await loadSubscriber({
      redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
      session_id: bound.session.session_id, session_kind: sessionKind, initial_conversation: conversation, coaching_episode_phase: coachingEpisodePhase, session_temporal_context: { session_history: bound.session_history }, env,
    });
    const beforeCurrent = loaded.controller.current();
    let result;
    const progressive = action === 'TURN' && wantsProgressiveTurn(req);
    const turnStartedAt = Date.now();
    let coachingDelivered = false;
    if (action === 'TURN') {
      const message = String(req.body?.message || '').trim();
      if (!message || message.length > 5000) return send(res, 400, { ok: false, code: 'SUBSCRIPTION_V1_CUSTOMER_MESSAGE_INVALID', csrf_token: nextCsrf });
      result = await loaded.controller.send({
        message,
        ...safeVisibleContext(req.body?.visible_customer_context),
        on_coaching_ready: progressive ? async (coaching) => {
          const displayedCustomerMessage = coaching.customer_message;
          const charged = await recordValidResponse({
            redis,
            keys,
            scope: loaded.scope,
            sessionId: bound.session.session_id,
            responseHash: hashCanonicalJson({ customer_message: displayedCustomerMessage }),
            now,
          });
          if (!charged.ok) throw new Error(charged.code);
          bound.session = charged.session;
          bound.allowance = charged.allowance;
          startProgressiveResponse(res);
          writeProgressiveEvent(res, {
            ok: true,
            phase: 'COACHING_READY',
            code: coaching.code,
            csrf_token: nextCsrf,
            customer_message: displayedCustomerMessage,
            mutation_performed: Boolean(coaching.mutation_performed),
            external_evidence: clone(coaching.external_evidence || []),
            research: coaching.research || { used: false, web_search_calls: 0, source_count: 0 },
            usage: usageSummary(coaching.provider_receipts || []),
            expression_receipt: null,
            customer_expression_architecture: 'FREE_FRONTIER_DIRECT_NO_S2_2',
            session: publicSession(bound.session, bound.allowance),
            coaching_episode: coachingEpisodeProjection({
              phase: 'ACTIVE',
              transitions: coachingEpisodePhase === 'STARTED' ? ['IDLE', 'STARTED', 'ACTIVE'] : ['ACTIVE'],
            }),
            timing: {
              ...coaching.timing,
              server_time_to_first_useful_ms: Math.max(0, Date.now() - turnStartedAt),
            },
            context_selection: coaching.context_selection_receipt || null,
            extraction: { status: 'RUNNING', mutation_performed: false },
            raw_provider_payload_persisted: false,
          });
          coachingDelivered = true;
          await mergeExternalEvidence({ redis, key: keys.research, additions: coaching.external_evidence || [] });
        } : null,
      });
    } else {
      result = await loaded.controller.decide({
        proposal_id: String(req.body?.proposal_id || ''),
        decision: String(req.body?.decision || ''),
        edited_items: Array.isArray(req.body?.edited_items) ? req.body.edited_items : [],
        idempotency_key: `internal-ui:${req.body?.proposal_id}:${req.body?.decision}:${hashCanonicalJson(req.body?.edited_items || [])}`,
      });
    }
    if (!result.ok) {
      await appendDiagnostics({ redis, key: keys.diagnostics, event: `RUNTIME_${action}_REJECTED:${result.code}`, receipts: result.provider_receipts || [] });
      console.warn(JSON.stringify({
        event: `SUBSCRIPTION_V1_RUNTIME_${action}_REJECTED`,
        code: String(result.code || 'SUBSCRIPTION_V1_RESULT_REJECTED').slice(0, 160),
        raw_provider_payload_logged: false,
        customer_message_logged: false,
        customer_evidence_logged: false,
      }));
      if (coachingDelivered) {
        writeProgressiveEvent(res, {
          ok: false,
          phase: 'EXTRACTION_FAILED_CLOSED',
          code: result.code,
          csrf_token: nextCsrf,
          mutation_performed: false,
          extraction: { status: 'FAILED_CLOSED', mutation_performed: false },
        });
        return res.end();
      }
      return send(res, 422, { ok: false, code: result.code, csrf_token: nextCsrf, mutation_performed: false });
    }
    const receipts = result.provider_receipts || [];
    if (action === 'TURN' && !coachingDelivered) {
      const charged = await recordValidResponse({ redis, keys, scope: loaded.scope, sessionId: bound.session.session_id, responseHash: hashCanonicalJson({ customer_message: result.customer_message }), now });
      if (!charged.ok) return send(res, 409, { ok: false, code: charged.code, csrf_token: nextCsrf, mutation_performed: false });
      bound.session = charged.session;
      bound.allowance = charged.allowance;
      await mergeExternalEvidence({ redis, key: keys.research, additions: result.external_evidence || [] });
    }
    await appendDiagnostics({ redis, key: keys.diagnostics, event: `RUNTIME_${action}_ACCEPTED`, receipts });
    const current = loaded.controller.current();
    const mapDelta = result.mutation_performed ? materialMapDelta(beforeCurrent.publication, current.publication) : null;
    let mapGu = null;
    let mapGuError = null;
    if (mapDelta?.material) {
      try {
        mapGu = await generateGu({ event: 'MAP_CHANGE', loaded, keys, mapDelta, env });
        await appendDiagnostics({ redis, key: keys.diagnostics, event: 'S2_MAP_CHANGE_GU_RENDERED', receipts: [mapGu.receipt.provider] });
      } catch (error) {
        mapGuError = String(error.code || 'SUBSCRIPTION_S2_MAP_CHANGE_GU_FAILED_AFTER_REAL_MUTATION');
        mapGu = deterministicMapChangeReceipt({ loaded, keys, mapDelta, providerError: mapGuError });
        await appendDiagnostics({ redis, key: keys.diagnostics, event: `S2_MAP_CHANGE_GU_PROVIDER_FAILED_FALLBACK_RENDERED:${mapGuError}`, receipts: [mapGu.receipt.provider] });
        mapGuError = null;
      }
    }
    if (action === 'TURN' && !mapDelta?.material) {
      try {
        const optionalGu = await generateGu({ event: 'COACHING_MOMENT', loaded, keys, env });
        if (optionalGu.plan?.renderDecision?.render === true) {
          mapGu = optionalGu;
          await appendDiagnostics({ redis, key: keys.diagnostics, event: 'S2_RESTRAINED_COACHING_GU_RENDERED', receipts: [optionalGu.receipt.provider] });
        } else {
          await appendDiagnostics({ redis, key: keys.diagnostics, event: 'S2_RESTRAINED_COACHING_GU_NOT_WARRANTED', receipts: [optionalGu.receipt.provider] });
        }
      } catch (error) {
        await appendDiagnostics({ redis, key: keys.diagnostics, event: `S2_RESTRAINED_COACHING_GU_FAILED_CLOSED:${String(error.code || error.message || 'UNKNOWN').slice(0, 100)}`, receipts: [] });
      }
    }
    const responseBody = {
      ok: true,
      phase: coachingDelivered ? 'EXTRACTION_COMPLETE' : 'COMPLETE',
      code: result.code,
      csrf_token: nextCsrf,
      customer_message: result.customer_message || null,
      proposal: result.proposal || null,
      confirmation_required: Boolean(result.confirmation_required),
      mutation_performed: Boolean(result.mutation_performed),
      publication: current.publication,
      view_model: current.view_model,
      external_evidence: clone(result.external_evidence || []),
      research: result.research || { used: false, web_search_calls: 0, source_count: 0 },
      usage: usageSummary(receipts),
      extraction: result.extraction || null,
      context_selection: result.context_selection_receipt || null,
      timing: result.timing ? { ...result.timing, server_total_ms: Math.max(0, Date.now() - turnStartedAt) } : null,
      session: publicSession(bound.session, bound.allowance),
      coaching_episode: coachingEpisodeProjection({
        phase: bound.session.charge_point_reached ? 'ACTIVE' : coachingEpisodePhase,
        transitions: coachingEpisodePhase === 'STARTED' ? ['IDLE', 'STARTED', 'ACTIVE'] : ['ACTIVE'],
      }),
      raw_provider_payload_persisted: false,
      expression_receipt: null,
      customer_expression_architecture: 'FREE_FRONTIER_DIRECT_NO_S2_2',
      gu_plan: mapGu?.plan || null,
      gu_receipt: mapGu?.receipt || null,
      gu_error: mapGuError,
      session_map_delta: mapDelta,
    };
    if (coachingDelivered) {
      writeProgressiveEvent(res, responseBody);
      return res.end();
    }
    return send(res, 200, responseBody);
  } catch (error) {
    const code = String(error?.code || error?.message || 'SUBSCRIPTION_V1_RUNTIME_FAILURE').slice(0, 160);
    console.error(JSON.stringify({
      event: 'SUBSCRIPTION_V1_INTERNAL_RUNTIME_FAILURE',
      code,
      stage: error?.sanitized_stage || null,
      provider_status: error?.sanitized_provider_status || null,
      incomplete_reason: error?.sanitized_incomplete_reason || null,
      output_tokens: Number(error?.sanitized_output_tokens || 0),
      configured_max_output_tokens: Number(error?.sanitized_max_output_tokens || 0),
      raw_provider_payload_logged: false,
      customer_message_logged: false,
      customer_evidence_logged: false,
    }));
    let csrf_token = null;
    try { if (auth?.ok) csrf_token = await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash }); } catch { csrf_token = null; }
    return send(res, 503, { ok: false, code: 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE', detail: code, csrf_token, mutation_performed: false });
  }
  };
}

export default createSubscriptionV1RuntimeHandler();
