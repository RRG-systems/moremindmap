import { Buffer } from 'node:buffer';

import { createSubscriptionV1RuntimeHandler } from '../../internal/subscription-v1-runtime.js';
import {
  createPaidConversationHistory,
  paidConversationForRuntime,
  paidHistoryRequestIdentity,
  recordPaidHistoryEvent,
} from './paidConversationHistory.js';

const PRIVATE_IDENTIFIER_KEYS = new Set([
  'assessment_id',
  'authority_hash',
  'authority_id',
  'authority_version',
  'authorization_id',
  'business_id',
  'capability_hash',
  'customer_id',
  'entitlement_id',
  'ledger_id',
  'membership_id',
  'owner_id',
  'profile_id',
  'relationship_id',
  'relationship_key',
  'root_relationship_key',
  'scope_hash',
  'stripe_customer_hash',
  'stripe_subscription_hash',
  'subject_id',
  'subject_key',
  'subscription_id',
  'tenant_id',
  'user_id',
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PRIVATE_RUNTIME_FAMILY_TEXT = /\b(?:openai|xai|anthropic|codex|claude(?:[\s._-]*[a-z0-9]+)*|deepseek(?:[\s._-]*[a-z0-9]+)*|gemini(?:[\s._-]*[a-z0-9]+)*|gpt(?:[\s._-]*[a-z0-9]+)*|grok(?:[\s._-]*[a-z0-9]+)*|llama(?:[\s._-]*[a-z0-9]+)*|mistral(?:[\s._-]*[a-z0-9]+)*|qwen(?:[\s._-]*[a-z0-9]+)*|o[1-9](?:[\s._-]*[a-z0-9]+)*)\b/iu;
const PRIVATE_RUNTIME_ASSIGNMENT_TEXT = /\b(?:(?:internal\s+)?assignment\s*:\s*(?:model|provider|engine|backend|deployment)|(?:assigned|routed)\s+(?:to|through|via)\b|(?:inference|runtime)\s+(?:backend|engine|provider|model|deployment)\b|(?:backend|engine|deployment)\s+(?:assignment|selection|arm|route|routing)\b|(?:provider|model)\s+(?:assignment|selection|arm|route|routing)\b|(?:provider|model)\s+[a-z0-9._-]+\s+(?:handled|served|generated|processed)\b)/iu;
const PRIVATE_RUNTIME_DIRECT_ASSIGNMENT_TEXT = /\b(?:(?:we\s+)?(?:used|selected|chose)\s+(?:the\s+)?(?:model|provider|engine|backend|deployment)\b|(?:model|provider|engine|backend|deployment)\s+(?:used|selected|chosen)\s*:?|(?:model|provider|engine|backend|deployment)\s*:\s*[a-z0-9]|(?:generated|served|processed|handled)\s+by\s+(?:the\s+)?(?:model|provider|engine|backend|deployment)\b|open\s+ai\s+deployment\b)/iu;
const PRIVATE_RUNTIME_DECLARATIVE_ASSIGNMENT_TEXT = /\b(?:(?:model|provider|backend|engine|deployment|runtime)\s+(?:is|was)\s+[a-z0-9]|(?:using|uses|chosen|assigned)\s+(?:the\s+)?(?:model|provider|backend|engine|deployment|runtime)\b|(?:running\s+on|powered\s+by)\s+(?:the\s+)?(?:model|provider|backend|engine|deployment|runtime)\b|runtime\s*:\s*[a-z0-9]|(?:generated|served|processed|handled)\s+by\s+[a-z0-9._-]+\s+(?:model|provider|backend|engine|deployment)\b|[a-z0-9._-]+\s+(?:model|provider|backend|engine|deployment)\s+(?:handled|served|generated|processed)\b)/iu;
const PRIVATE_RUNTIME_JOINED_ASSIGNMENT_TEXT = /\b(?:(?:model|provider|backend|engine|deployment|runtime)\s*(?:=|-|\/)\s*[a-z0-9][a-z0-9._-]*|(?:via|using|used|uses|run|runs|chose|chosen|current|our|selected|assigned|on|running\s+on|powered\s+by)\s+(?:the\s+)?(?:(?:model|provider|backend|engine|deployment|runtime)\s+[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*\s+(?:model|provider|backend|engine|deployment|runtime))\b)/iu;
const PRIVATE_RUNTIME_REPLACEMENT = 'Private runtime configuration is not exposed.';
const OPAQUE_PUBLIC_CONTROL_FIELDS = new Set(['csrf_token']);
const OPAQUE_PUBLIC_CONTROL_VALUE = /^[A-Za-z0-9_-]{32,512}$/u;
const SAFE_PUBLIC_BUSINESS_RUNTIME_KEYS = new Set([
  'business_model',
  'business_model_analysis',
  'business_engine',
  'business_growth_engine',
  'causal_model',
  'confidence_engine',
  'deployment_of_staff_capacity',
  'engine_of_business_growth',
  'growth_engine',
  'model_home',
  'model_home_sales',
  'model_date',
  'operating_model',
  'operating_model_design',
  'operating_engine',
  'primary_engine',
  'service_provider',
  'service_provider_relationships',
  'staff_deployment',
  'staff_deployment_capacity',
  'view_model',
]);
const PRIVATE_RUNTIME_CONFIG_KEY_TOKEN = /(?:^|_)(?:model|provider|backend|engine|deployment|runtime|inference)(?:$|_)/u;

function containsPrivateRuntimeAssignmentText(value) {
  const withoutSafeBusinessLanguage = value
    .replace(/\bbusiness\s+model\b/giu, 'business construct')
    .replace(/\boperating\s+model\s+design\b/giu, 'operating construct design')
    .replace(/\bmodel\s+home\s+sales\b/giu, 'residential home sales')
    .replace(/\bservice\s+provider\s+relationships\b/giu, 'service partner relationships')
    .replace(/\bdeployment\s+of\s+staff\s+capacity\b/giu, 'allocation of staff capacity')
    .replace(/\bengine\s+of\s+business\s+growth\b/giu, 'driver of business growth');
  return PRIVATE_RUNTIME_FAMILY_TEXT.test(withoutSafeBusinessLanguage)
    || PRIVATE_RUNTIME_ASSIGNMENT_TEXT.test(withoutSafeBusinessLanguage)
    || PRIVATE_RUNTIME_DIRECT_ASSIGNMENT_TEXT.test(withoutSafeBusinessLanguage)
    || PRIVATE_RUNTIME_DECLARATIVE_ASSIGNMENT_TEXT.test(withoutSafeBusinessLanguage)
    || PRIVATE_RUNTIME_JOINED_ASSIGNMENT_TEXT.test(withoutSafeBusinessLanguage);
}

function opaquePublicControlValue(value, path) {
  return typeof value === 'string'
    && path.length === 1
    && OPAQUE_PUBLIC_CONTROL_FIELDS.has(path[0])
    && OPAQUE_PUBLIC_CONTROL_VALUE.test(value);
}

function setPrivateHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
}

function normalizePrivateRuntimeKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

function sensitiveDetailKey(key) {
  const normalized = String(key).toLowerCase();
  const normalizedRuntimeKey = normalizePrivateRuntimeKey(key);
  if (SAFE_PUBLIC_BUSINESS_RUNTIME_KEYS.has(normalizedRuntimeKey)) return false;
  return normalized === 'authority'
    || normalized === 'auth_bindings'
    || normalized === 'membership_binding'
    || normalized === 'membership_context'
    || normalized.includes('diagnostic')
    || normalized.includes('receipt')
    || normalized.includes('assignment')
    || normalized.includes('credential')
    || normalized.includes('api_key')
    || normalized.includes('access_token')
    || normalized.includes('secret')
    || (normalized.startsWith('stripe_') && normalized !== 'stripe_mutation')
    || normalized === 'architecture'
    || normalized.endsWith('_architecture')
    || PRIVATE_RUNTIME_CONFIG_KEY_TOKEN.test(normalizedRuntimeKey)
    || normalized === 'context_selection'
    || ['internal_source_calls', 'internal_source_receipts', 'source_library',
      'transport_trace', 'governed_reference_material'].includes(normalized)
    || normalized === 'detail'
    || /^raw_.*payload/u.test(normalized);
}

function sensitiveCode(value) {
  return typeof value === 'string' && /(?:provider|model|architecture|diagnostic|receipt|assignment|credential|api.?key|access.?token|secret|stripe)/iu.test(value);
}

function copyPublicValue(value, seen, path = []) {
  if (opaquePublicControlValue(value, path)) return value;
  if (typeof value === 'string' && containsPrivateRuntimeAssignmentText(value)) {
    return PRIVATE_RUNTIME_REPLACEMENT;
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) throw new Error('SUBSCRIPTION_V1_PAID_RESPONSE_CYCLE_DENIED');
  seen.add(value);
  if (Array.isArray(value)) {
    const array = value.map((entry, index) => copyPublicValue(entry, seen, [...path, String(index)]));
    seen.delete(value);
    return array;
  }
  const entries = [];
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (sensitiveDetailKey(key) || PRIVATE_IDENTIFIER_KEYS.has(normalized)) continue;
    if (/^(?:auth|authority|internal|private)_.*(?:id|key|hash|ref)$/u.test(normalized)) continue;
    if (normalized === 'source_event_ids' || normalized === 'provider_subject' || normalized === 'provider_subject_hash') continue;
    if (normalized === 'code' && sensitiveCode(child)) {
      entries.push([key, 'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE']);
      continue;
    }
    if (normalized === 'error' && sensitiveCode(child)) {
      entries.push([key, 'runtime_unavailable']);
      continue;
    }
    entries.push([key, copyPublicValue(child, seen, [...path, key])]);
  }
  seen.delete(value);
  return Object.fromEntries(entries);
}

export function paidGetProjection(payload) {
  const projected = { ...payload };
  delete projected.demo_subject;
  delete projected.demo_subject_switching;
  delete projected.demo_reset_enabled;
  projected.subscriber = { kind: 'PAID_SUBSCRIBER' };
  projected.entitlement = {
    source: 'PAID_STRIPE',
    billing_evidence: true,
    stripe_mutation: false,
    same_downstream_session_contract: true,
  };
  return projected;
}

function paidFailureProjection(payload) {
  if (payload?.ok !== false) return payload;
  const code = String(payload.code || '');
  if (code === 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE') {
    return { ...payload, code: 'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE' };
  }
  return payload;
}

export function redactPaidRuntimePayload(payload, {
  successful_get = false,
  successful_get_projector = paidGetProjection,
  failure_projector = paidFailureProjection,
} = {}) {
  const projected = successful_get && payload?.ok === true
    ? successful_get_projector(payload)
    : failure_projector(payload);
  return copyPublicValue(projected, new Set());
}

function responseBoundary(res, {
  successfulGet,
  successfulGetProjector,
  failureProjector,
  transform,
}) {
  let statusCode = Number(res.statusCode || 200);
  let pending = '';
  let queue = Promise.resolve();
  let failure = null;
  let streaming = false;
  let boundary;

  function enqueue(callback) {
    queue = queue.then(async () => { if (!failure) await callback(); })
      .catch((error) => { failure ||= error; });
    return queue;
  }

  function accept(value, { json = false } = {}) {
    const originalStatus = statusCode;
    return enqueue(async () => {
      const clean = redactPaidRuntimePayload(value, {
        successful_get: successfulGet && originalStatus >= 200 && originalStatus < 300,
        successful_get_projector: successfulGetProjector,
        failure_projector: failureProjector,
      });
      const result = await transform(clean, originalStatus);
      const finalPayload = redactPaidRuntimePayload(result.payload, {
        failure_projector: failureProjector,
      });
      res.status(result.status);
      if (json && !streaming) res.json(finalPayload);
      else res.write(`${JSON.stringify(finalPayload)}\n`);
    });
  }

  function takeCompleteLines({ final = false } = {}) {
    const lines = pending.split('\n');
    pending = final ? '' : lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try { accept(JSON.parse(line)); }
      catch { enqueue(() => { throw new Error('SUBSCRIPTION_V1_PAID_RESPONSE_REDACTION_FAILED'); }); }
    }
  }

  const handlers = {
    status(value) {
      statusCode = Number(value);
      return boundary;
    },
    setHeader(name, value) {
      if (String(name).toLowerCase() === 'content-type' && String(value).includes('ndjson')) streaming = true;
      return res.setHeader(name, value);
    },
    // Useful coaching is durably checkpointed before its first public bytes.
    flushHeaders() {},
    flush() {},
    json(value) {
      const accepted = accept(value, { json: true });
      if (streaming) enqueue(() => res.end());
      return accepted;
    },
    write(value) {
      pending += Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? '');
      takeCompleteLines();
      return true;
    },
    end(value) {
      if (value != null) pending += Buffer.isBuffer(value) ? value.toString('utf8') : String(value);
      takeCompleteLines({ final: true });
      return enqueue(() => res.end());
    },
  };

  boundary = new Proxy(res, {
    get(target, property, receiver) {
      if (Object.hasOwn(handlers, property)) return handlers[property];
      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return { boundary, async settle() { await queue; if (failure) throw failure; }, isStreaming: () => streaming };
}

function paidMembershipContext(auth) {
  const supplied = auth?.membership_context || auth?.capability?.membership_context;
  const scope = supplied?.scope || auth?.capability?.scope || auth?.capability?.paid_membership_scope || auth?.scope;
  const authenticated = supplied?.authenticated
    ?? auth?.capability?.authenticated
    ?? auth?.authenticated;
  const membershipVerified = supplied?.membership_verified
    ?? auth?.capability?.membership_verified
    ?? auth?.membership_verified;
  const bindingSource = supplied?.binding_source || auth?.capability?.binding_source || auth?.binding_source;
  if (auth?.ok !== true
    || authenticated !== true
    || membershipVerified !== true
    || bindingSource !== 'AUTHENTICATED_SERVER_CONTEXT'
    || !scope
    || typeof scope !== 'object') {
    throw new Error('SUBSCRIPTION_V1_PAID_MEMBERSHIP_CONTEXT_REQUIRED');
  }
  return {
    ...supplied,
    authenticated,
    membership_verified: membershipVerified,
    binding_source: bindingSource,
    scope,
    ...(supplied?.assessment_id || auth?.capability?.assessment_id
      ? { assessment_id: supplied?.assessment_id || auth.capability.assessment_id }
      : {}),
    ...(supplied?.membership_binding || auth?.capability?.membership_binding
      ? { membership_binding: supplied?.membership_binding || auth.capability.membership_binding }
      : {}),
  };
}

function requireFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
  return value;
}

export function createPaidSubscriptionV1RuntimeHandler({
  redis,
  authenticate,
  loadSubscriber,
  resolveEntitlement,
  resolveKeys,
  generateGu,
  resolveAccessContext = paidMembershipContext,
  projectSuccessfulGet = paidGetProjection,
  projectFailure = paidFailureProjection,
  firstSessionSyntheticOnly = false,
  issueCsrf = null,
  consumeCsrf = null,
  env = {},
} = {}) {
  if (!redis || typeof redis !== 'object') throw new Error('SUBSCRIPTION_V1_PAID_REDIS_REQUIRED');
  requireFunction(authenticate, 'SUBSCRIPTION_V1_PAID_AUTHENTICATOR_REQUIRED');
  requireFunction(loadSubscriber, 'SUBSCRIPTION_V1_PAID_SUBSCRIBER_LOADER_REQUIRED');
  requireFunction(resolveEntitlement, 'SUBSCRIPTION_V1_PAID_ENTITLEMENT_RESOLVER_REQUIRED');
  requireFunction(resolveKeys, 'SUBSCRIPTION_V1_PAID_KEYS_RESOLVER_REQUIRED');
  requireFunction(resolveAccessContext, 'SUBSCRIPTION_V1_RUNTIME_ACCESS_CONTEXT_RESOLVER_REQUIRED');
  requireFunction(projectSuccessfulGet, 'SUBSCRIPTION_V1_RUNTIME_RESPONSE_PROJECTOR_REQUIRED');
  requireFunction(projectFailure, 'SUBSCRIPTION_V1_RUNTIME_FAILURE_PROJECTOR_REQUIRED');
  if (issueCsrf !== null || consumeCsrf !== null) {
    requireFunction(issueCsrf, 'SUBSCRIPTION_V1_RUNTIME_CSRF_ISSUER_REQUIRED');
    requireFunction(consumeCsrf, 'SUBSCRIPTION_V1_RUNTIME_CSRF_CONSUMER_REQUIRED');
  }
  if (generateGu != null) requireFunction(generateGu, 'SUBSCRIPTION_V1_PAID_GU_GENERATOR_INVALID');

  return async function paidSubscriptionRuntimeHandler(req, res) {
    if (req.method === 'GET' && req.query?.view === 'diagnostics') {
      setPrivateHeaders(res);
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    // All client close drafts and transcript fields are replaced after authenticated
    // entitlement and CSRF checks, inside the shared runtime's first loader call.
    const forwarded = { ...req, body: { ...(req.body || {}) }, headers: { ...(req.headers || {}) } };
    let authenticated = null;
    let runtimeKeys = null;
    let historyStore = null;
    let history = null;
    let requestIdentity = null;
    let duplicate = null;
    let historyFailure = null;
    let nextCsrf = null;
    let output;
    const paidAuthenticate = async (args) => {
      const result = await authenticate(args);
      if (result?.ok !== true) return result;
      if (!SHA256_PATTERN.test(result.capability_hash || '')) {
        throw new Error('SUBSCRIPTION_V1_PAID_CAPABILITY_HASH_REQUIRED');
      }
      const membership_context = resolveAccessContext(result);
      authenticated = {
        ...result,
        membership_context,
        capability: {
          ...(result.capability || {}),
          authenticated: true,
          membership_verified: membership_context.membership_verified === true,
          ...(membership_context.capability_verified === true ? { capability_verified: true } : {}),
          binding_source: membership_context.binding_source,
          scope: membership_context.scope,
          membership_context,
        },
      };
      return authenticated;
    };
    const membershipContext = () => resolveAccessContext(authenticated);
    const paidLoadSubscriber = async (args) => {
      if (!historyStore) {
        historyStore = createPaidConversationHistory({ redis, scope: membershipContext().scope, keys: runtimeKeys });
        try {
          history = await historyStore.open();
          if (forwarded.method === 'POST') {
            requestIdentity = paidHistoryRequestIdentity(forwarded.body, forwarded.headers['x-subscription-runtime-csrf']);
            const prior = history.operations[requestIdentity.key];
            if (prior) {
              const matches = prior.fingerprint === requestIdentity.fingerprint;
              duplicate = {
                status: 409,
                payload: { ok: false, code: matches ? 'SUBSCRIPTION_V1_PAID_REQUEST_ALREADY_RECORDED' : 'SUBSCRIPTION_V1_PAID_REQUEST_CONFLICT', reload_required: true },
              };
              if (matches && prior.completed && history.last_response?.request_key === requestIdentity.key) {
                duplicate = { status: 200, payload: { ...history.last_response.payload, replayed: true } };
              }
              throw new Error('PAID_HISTORY_REPLAY_BOUNDARY');
            }
            // A process interruption cannot silently buy the same request twice.
            delete history.last_response;
            history.operations[requestIdentity.key] = { fingerprint: requestIdentity.fingerprint, completed: false };
            history = await historyStore.save(history);
          }
        } catch (error) {
          if (!duplicate) historyFailure = String(error.message || 'PAID_HISTORY_UNAVAILABLE');
          throw error;
        }
      }
      const action = forwarded.body.action;
      forwarded.body.conversation = paidConversationForRuntime({ history, sessionId: forwarded.body.session_id,
        action, alignmentMessage: forwarded.body.alignment_message });
      forwarded.body.prior_session_learning = history.session_id === forwarded.body.session_id ? history.session_learning : null;
      const loaded = await loadSubscriber({
        ...args,
        initial_conversation: paidConversationForRuntime({ history, sessionId: args.session_id,
          action, alignmentMessage: forwarded.body.alignment_message }),
        membership_context: membershipContext(),
      });
      if (typeof loaded.controller?.send !== 'function') return loaded;
      const controller = new Proxy({}, {
        get(_target, property) {
          const target = loaded.controller;
          if (property === 'send') return (sendArgs) => target.send({ ...sendArgs,
            ...(sendArgs.on_coaching_ready ? { on_coaching_ready: async (coaching) => {
              await sendArgs.on_coaching_ready(coaching);
              await output.settle();
            } } : {}),
          });
          const value = Reflect.get(target, property);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      return { ...loaded, controller };
    };
    const paidResolveKeys = (args) => {
      runtimeKeys = resolveKeys({ ...args, scope: membershipContext().scope, membership_context: membershipContext() });
      return runtimeKeys;
    };
    const scopedResolveEntitlement = (args) => resolveEntitlement({
      ...args,
      auth: authenticated,
      membership_context: membershipContext(),
    });
    output = responseBoundary(res, {
      successfulGet: req.method === 'GET',
      successfulGetProjector: projectSuccessfulGet,
      failureProjector: projectFailure,
      transform: async (payload, status) => {
        if (payload.csrf_token) nextCsrf = payload.csrf_token;
        if (duplicate) return { ...duplicate, payload: { ...duplicate.payload, csrf_token: nextCsrf } };
        if (historyFailure) return {
          status: historyFailure === 'PAID_HISTORY_REQUEST_IN_PROGRESS' ? 409 : 503,
          payload: { ok: false, code: historyFailure === 'PAID_HISTORY_REQUEST_IN_PROGRESS'
            ? 'SUBSCRIPTION_V1_PAID_REQUEST_IN_PROGRESS' : 'SUBSCRIPTION_V1_PAID_HISTORY_UNAVAILABLE',
          csrf_token: nextCsrf, reload_required: true },
        };
        if (history && payload.ok === true && req.method === 'GET') {
          const sessionId = payload.session?.session_id;
          payload.conversation = history.messages.filter((message) => message.session_id === sessionId)
            .map((message) => message.role === 'gu' ? { role: 'gu', plan: message.plan } : { role: message.role, content: message.content });
          const sameSession = sessionId && history.session_id === sessionId;
          payload.session_learning = sameSession ? history.session_learning : null;
          if (sameSession && ['STARTED', 'ACTIVE', 'ENDING'].includes(history.coaching_episode_phase)) {
            payload.session.coaching_episode_phase = history.coaching_episode_phase;
          }
        }
        if (history && payload.ok === true && req.method === 'POST') {
          if (['START_MY_FIRST_SESSION', 'START_SESSION'].includes(forwarded.body.action)) {
            const first = history.messages.find((message) => message.session_id === payload.session?.session_id
              && message.role === 'gu' && ['FIRST_SESSION_WELCOME', 'SESSION_OPENING'].includes(message.plan?.event));
            if (first) payload.gu_plan = first.plan;
          }
          const next = recordPaidHistoryEvent({ history, body: forwarded.body, event: payload, identity: requestIdentity });
          if (payload.phase !== 'COACHING_READY') next.last_response = { request_key: requestIdentity.key, payload };
          history = await historyStore.save(next);
        }
        return { payload, status };
      },
    });
    const inner = createSubscriptionV1RuntimeHandler({
      getRedis: () => redis,
      authenticate: paidAuthenticate,
      loadSubscriber: paidLoadSubscriber,
      resolveEntitlement: scopedResolveEntitlement,
      resolveKeys: paidResolveKeys,
      resolvePreloadScope: () => membershipContext().scope,
      firstSessionSyntheticOnly,
      ...(issueCsrf ? { issueCsrf, consumeCsrf } : {}),
      ...(generateGu ? { generateGu } : {}),
      env,
    });
    try {
      await inner(forwarded, output.boundary);
      await output.settle();
    } catch {
      const failure = redactPaidRuntimePayload(
        { ok: false, code: 'SUBSCRIPTION_V1_PAID_HISTORY_UNAVAILABLE', csrf_token: nextCsrf, reload_required: true },
        { failure_projector: projectFailure },
      );
      if (output.isStreaming()) {
        if (!res.headersSent) res.status(503);
        res.end(`${JSON.stringify(failure)}\n`);
      } else if (!res.headersSent) res.status(503).json(failure);
    } finally {
      await historyStore?.release();
    }
  };
}
