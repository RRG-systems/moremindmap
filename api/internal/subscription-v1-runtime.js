import { hashCanonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';
import {
  appendDiagnostics,
  authenticateInternalDevRequest,
  consumeRuntimeCsrf,
  createInternalSyntheticEntitlement,
  getSubscriptionRedis,
  internalDevKeys,
  issueRuntimeCsrf,
  mergeExternalEvidence,
  readDiagnostics,
  sameOriginRequest,
  setNoStore,
  withDurableAllowanceLedger,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';
import { loadProductionIntendedSyntheticSubscriber } from '../engine/subscriptionV1/internalDevSubscriberLoader.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
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

function publicSession(session, allowance) {
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
  };
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
    return { ok: true, session, allowance: inspected.ledger, entitlement };
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
    return { ok: true, session, allowance: inspected.ledger };
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

export default async function handler(req, res) {
  const redis = getSubscriptionRedis();
  let auth = null;
  try {
    if (!sameOriginRequest(req, { allowMissingForGet: true })) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_ORIGIN_DENIED' });
    auth = await authenticateInternalDevRequest({ redis, req });
    if (!auth.ok) return send(res, auth.status, { ok: false, code: auth.code });
    const keys = internalDevKeys({ relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key });
    const now = new Date();

    if (req.method === 'GET' && req.query?.view === 'diagnostics') {
      const csrf_token = await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash });
      const diagnostics = await readDiagnostics({ redis, key: keys.diagnostics });
      return send(res, 200, { ok: true, code: 'SUBSCRIPTION_V1_DIAGNOSTICS_READY', csrf_token, diagnostics, raw_provider_payloads: false });
    }

    if (req.method === 'GET') {
      const provisional = await loadProductionIntendedSyntheticSubscriber({
        redis,
        relationship_key: auth.capability.relationship_key,
        subject_key: auth.capability.subject_key,
        session_id: 'session_000000000000000000000000',
        session_kind: 'FIRST_EVER',
        initial_conversation: [],
      });
      const active = await ensureActiveSession({ redis, keys, scope: provisional.scope, capabilityHash: auth.capability_hash, now });
      if (!active.ok) {
        if (active.code !== 'STANDARD_ALLOWANCE_EXHAUSTED' || !active.allowance) {
          return send(res, 409, { ok: false, code: active.code });
        }
        return send(res, 200, {
          ok: true,
          code: 'SUBSCRIPTION_V1_RELATIONSHIP_READY_ALLOWANCE_EXHAUSTED',
          csrf_token: null,
          identity: { first_name: 'Jordan', vertical: 'Real Estate', synthetic_only: true },
          view_model: provisional.current.view_model,
          publication: provisional.current.publication,
          session: publicAllowanceBoundary(active.allowance),
          architecture: provisional.architecture,
          entitlement: { source: 'INTERNAL_SYNTHETIC', billing_evidence: false, stripe_mutation: false, same_downstream_session_contract: true },
          provider: { model: 'gpt-5.6-sol', store: false, server_side: true, browser_secret: false },
          coaching_available: false,
        });
      }
      const sessionKind = active.session.session_class === 'ONBOARDING_INCLUDED' ? 'FIRST_EVER' : 'WEEKLY';
      const loaded = await loadProductionIntendedSyntheticSubscriber({
        redis,
        relationship_key: auth.capability.relationship_key,
        subject_key: auth.capability.subject_key,
        session_id: active.session.session_id,
        session_kind: sessionKind,
        initial_conversation: [],
      });
      const csrf_token = await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash });
      return send(res, 200, {
        ok: true,
        code: 'SUBSCRIPTION_V1_PRODUCTION_INTENDED_SUBSCRIBER_READY',
        csrf_token,
        identity: { first_name: 'Jordan', vertical: 'Real Estate', synthetic_only: true },
        view_model: loaded.current.view_model,
        publication: loaded.current.publication,
        session: publicSession(active.session, active.allowance),
        architecture: loaded.architecture,
        entitlement: { source: 'INTERNAL_SYNTHETIC', billing_evidence: false, stripe_mutation: false, same_downstream_session_contract: true },
        provider: { model: 'gpt-5.6-sol', store: false, server_side: true, browser_secret: false },
        coaching_available: true,
      });
    }

    if (req.method !== 'POST') return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    const csrfOk = await consumeRuntimeCsrf({ redis, capabilityHash: auth.capability_hash, proof: req.headers?.['x-subscription-runtime-csrf'] });
    if (!csrfOk) return send(res, 403, { ok: false, code: 'SUBSCRIPTION_V1_RUNTIME_CSRF_DENIED' });
    const nextCsrf = await issueRuntimeCsrf({ redis, capabilityHash: auth.capability_hash });
    const action = String(req.body?.action || '');

    if (action === 'END_SESSION') {
      const provisional = await loadProductionIntendedSyntheticSubscriber({
        redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
        session_id: req.body?.session_id, session_kind: 'WEEKLY', initial_conversation: [],
      });
      const completed = await completeSession({ redis, keys, scope: provisional.scope, sessionId: req.body?.session_id, cumulativeSeconds: Math.max(0, Math.min(7200, Number(req.body?.cumulative_active_seconds) || 0)), now });
      if (!completed.ok) return send(res, 409, { ok: false, code: completed.code, csrf_token: nextCsrf });
      await appendDiagnostics({ redis, key: keys.diagnostics, event: 'SESSION_COMPLETED', receipts: [] });
      return send(res, 200, { ok: true, code: 'SUBSCRIPTION_V1_SESSION_COMPLETED', csrf_token: nextCsrf, session: publicSession(completed.session, completed.allowance) });
    }

    if (!['TURN', 'DECISION'].includes(action)) return send(res, 400, { ok: false, code: 'SUBSCRIPTION_V1_RUNTIME_ACTION_INVALID', csrf_token: nextCsrf });
    const provisional = await loadProductionIntendedSyntheticSubscriber({
      redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
      session_id: req.body?.session_id, session_kind: 'WEEKLY', initial_conversation: [],
    });
    const bound = await inspectBoundSession({ redis, keys, scope: provisional.scope, sessionId: req.body?.session_id, now });
    if (!bound.ok) return send(res, 409, { ok: false, code: bound.code, csrf_token: nextCsrf });
    const sessionKind = bound.session.session_class === 'ONBOARDING_INCLUDED' ? 'FIRST_EVER' : 'WEEKLY';
    const conversation = safeConversation(req.body?.conversation);
    const loaded = await loadProductionIntendedSyntheticSubscriber({
      redis, relationship_key: auth.capability.relationship_key, subject_key: auth.capability.subject_key,
      session_id: bound.session.session_id, session_kind: sessionKind, initial_conversation: conversation,
    });
    let result;
    if (action === 'TURN') {
      const message = String(req.body?.message || '').trim();
      if (!message || message.length > 5000) return send(res, 400, { ok: false, code: 'SUBSCRIPTION_V1_CUSTOMER_MESSAGE_INVALID', csrf_token: nextCsrf });
      result = await loaded.controller.send({ message, visible_customer_context: req.body?.visible_customer_context || null });
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
      return send(res, 422, { ok: false, code: result.code, csrf_token: nextCsrf, mutation_performed: false });
    }
    const receipts = result.provider_receipts || [];
    if (action === 'TURN') {
      const charged = await recordValidResponse({ redis, keys, scope: loaded.scope, sessionId: bound.session.session_id, responseHash: hashCanonicalJson({ customer_message: result.customer_message }), now });
      if (!charged.ok) return send(res, 409, { ok: false, code: charged.code, csrf_token: nextCsrf, mutation_performed: false });
      bound.session = charged.session;
      bound.allowance = charged.allowance;
      await mergeExternalEvidence({ redis, key: keys.research, additions: result.external_evidence || [] });
    }
    await appendDiagnostics({ redis, key: keys.diagnostics, event: `RUNTIME_${action}_ACCEPTED`, receipts });
    const current = loaded.controller.current();
    return send(res, 200, {
      ok: true,
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
      session: publicSession(bound.session, bound.allowance),
      raw_provider_payload_persisted: false,
    });
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
}
