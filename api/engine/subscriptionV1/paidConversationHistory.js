import { randomUUID } from 'node:crypto';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { scopeFingerprint } from '../../../src/lib/subscriptionV1/contracts.js';
import { paidRuntimeKeys } from './paidRuntimeInfrastructure.js';

export const PAID_HISTORY_CONTRACT = 'PAID_SUBSCRIPTION_SERVER_CONVERSATION_V1';
const clone = (value) => JSON.parse(JSON.stringify(value));
const SCOPE_FIELDS = ['subject_id', 'membership_id', 'tenant_id', 'profile_id', 'business_id'];
const OPENINGS = new Set(['FIRST_SESSION_WELCOME', 'SESSION_OPENING']);
const RELEASE = "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end";
const SAVE = "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end local previous = redis.call('GET',KEYS[2]); if previous then redis.call('SET',KEYS[3],previous) end redis.call('SET',KEYS[2],ARGV[2]); return 1";

function exactPaidScope(scope) {
  if (!scope || Object.keys(scope).length !== 5 || !SCOPE_FIELDS.every((key) => Object.hasOwn(scope, key))) {
    throw new Error('PAID_HISTORY_AUTHENTICATED_SCOPE_REQUIRED');
  }
  return scopeFingerprint(scope);
}

export function firstPaidTurnDisplayedOpeningContext({ history, sessionId, action }) {
  if (action !== 'TURN' || !sessionId) return null;
  const messages = history.messages.filter((message) => message.session_id === sessionId);
  if (messages.some((message) => ['customer', 'coach'].includes(message.role))) return null;
  // The first opening actually accepted for display is immutable for the session.
  const opening = messages.find((message) => message.role === 'gu' && OPENINGS.has(message.plan?.event));
  const guidance = opening?.plan?.guidance;
  const displayed = ['eyebrow', 'headline', 'summary', 'nextCue']
    .map((key) => typeof guidance?.[key] === 'string' ? guidance[key] : '').filter(Boolean);
  if (!displayed.length) return null;
  return {
    role: 'coach',
    content: [
      'SERVER-OWNED DISPLAY CONTEXT — NONCANONICAL; NOT CUSTOMER-CONFIRMED TRUTH.',
      'MORE already displayed this opening before the first ordinary coaching turn:',
      ...displayed,
    ].join('\n'),
  };
}

export function paidConversationForRuntime({ history, sessionId, action, alignmentMessage = null }) {
  const opening = firstPaidTurnDisplayedOpeningContext({ history, sessionId, action });
  const ordinary = history.messages.filter((message) => message.session_id === sessionId
    && ['customer', 'coach'].includes(message.role)).map(({ role, content }) => ({ role, content }));
  const messages = [...(opening ? [opening] : []), ...ordinary];
  if (action === 'END_SESSION' && typeof alignmentMessage === 'string' && alignmentMessage.trim()) {
    messages.push({ role: 'customer', content: alignmentMessage.trim().slice(0, 5000) });
  }
  // Match the shared runtime's budget, retaining the most recent whole messages.
  const selected = [];
  let length = 0;
  for (const message of messages.slice(-24).reverse()) {
    const content = message.content.trim().slice(0, 5000);
    if (length + content.length > 40_000) break;
    selected.unshift({ role: message.role, content });
    length += content.length;
  }
  return selected;
}

export function paidHistoryRequestIdentity(body, csrf) {
  const supplied = body?.action === 'END_SESSION' ? body.close_request_id : body?.request_id;
  if (supplied != null && (typeof supplied !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/u.test(supplied))) {
    throw new Error('PAID_HISTORY_REQUEST_ID_INVALID');
  }
  const semantic = {
    action: body?.action || null,
    session_id: body?.session_id || null,
    message: body?.message || null,
    alignment_message: body?.alignment_message || null,
    close_decision: body?.close_decision || null,
    proposal_id: body?.proposal_id || null,
    decision: body?.decision || null,
    edited_items: body?.edited_items || [],
  };
  return {
    key: hashCanonicalJson({ identity: supplied || csrf || randomUUID(), action: semantic.action }),
    fingerprint: hashCanonicalJson(semantic),
  };
}

export function createPaidConversationHistory({ redis, scope, keys = {} }) {
  const scopeHash = exactPaidScope(scope);
  const canonicalKeys = paidRuntimeKeys({ scope });
  const storage = Object.fromEntries(['conversation_history', 'conversation_backup', 'conversation_lock']
    .map((key) => [key, keys[key] || canonicalKeys[key]]));
  if (new Set(Object.values(storage)).size !== 3 || Object.values(storage).some((key) => typeof key !== 'string' || !key)) {
    throw new Error('PAID_HISTORY_STORAGE_KEYS_INVALID');
  }
  let owner = null;
  let history = null;
  return {
    async open() {
      if (history) return history;
      owner = randomUUID();
      if (await redis.set(storage.conversation_lock, owner, 'PX', 900_000, 'NX') !== 'OK') {
        owner = null;
        throw new Error('PAID_HISTORY_REQUEST_IN_PROGRESS');
      }
      const raw = await redis.get(storage.conversation_history);
      history = raw == null ? {
        contract: PAID_HISTORY_CONTRACT, scope_hash: scopeHash, scope: clone(scope),
        messages: [], session_id: null, session_learning: null, coaching_episode_phase: null,
        operations: {}, revision: 0,
      } : JSON.parse(raw);
      if (history.contract !== PAID_HISTORY_CONTRACT || history.scope_hash !== scopeHash
        || exactPaidScope(history.scope) !== scopeHash || !Array.isArray(history.messages)
        || !history.operations || typeof history.operations !== 'object' || Array.isArray(history.operations)
        || !Number.isInteger(history.revision) || history.revision < 0
        || history.messages.some((message) => !message.session_id
          || !['customer', 'coach', 'gu'].includes(message.role)
          || (message.role === 'gu' ? !message.plan || typeof message.plan !== 'object' : typeof message.content !== 'string'))) {
        throw new Error('PAID_HISTORY_SCOPE_OR_STATE_DENIED');
      }
      return history;
    },
    snapshot() { return clone(history); },
    async save(next) {
      if (!owner || !history) throw new Error('PAID_HISTORY_LOCK_REQUIRED');
      const saved = { ...clone(next), revision: history.revision + 1 };
      if (await redis.eval(SAVE, 3, storage.conversation_lock, storage.conversation_history,
        storage.conversation_backup, owner, JSON.stringify(saved)) !== 1) {
        throw new Error('PAID_HISTORY_LOCK_LOST');
      }
      history = saved;
      return history;
    },
    async release() {
      if (owner) await redis.eval(RELEASE, 1, storage.conversation_lock, owner);
      owner = null;
    },
  };
}

export function recordPaidHistoryEvent({ history, body, event, identity }) {
  if (event?.ok !== true) return history;
  const sessionId = event.session?.session_id || body.session_id;
  if (!sessionId) return history;
  const next = clone(history);
  const prior = next.operations[identity.key];
  if (prior && prior.fingerprint !== identity.fingerprint) throw new Error('PAID_HISTORY_REQUEST_CONFLICT');
  const operation = prior || { fingerprint: identity.fingerprint, session_id: sessionId, customer_recorded: false, coach_recorded: false };
  if (event.mutual_close?.recovered_saved_close === true) {
    operation.completed = true;
    next.operations[identity.key] = operation;
    return next;
  }
  if (['START_MY_FIRST_SESSION', 'START_SESSION'].includes(body.action)) {
    next.session_id = sessionId;
    next.session_learning = null;
  }
  const customer = body.action === 'TURN' ? body.message : body.action === 'END_SESSION' ? body.alignment_message : null;
  if (customer && !operation.customer_recorded) {
    next.messages.push({ role: 'customer', content: String(customer).trim().slice(0, 5000), session_id: sessionId });
    operation.customer_recorded = true;
  }
  if (typeof event.customer_message === 'string' && event.customer_message && !operation.coach_recorded) {
    next.messages.push({ role: 'coach', content: event.customer_message, session_id: sessionId });
    operation.coach_recorded = true;
  }
  if (event.gu_plan) {
    const planHash = hashCanonicalJson(event.gu_plan);
    const isOpening = OPENINGS.has(event.gu_plan.event);
    const alreadyShown = next.messages.some((message) => message.session_id === sessionId && message.role === 'gu'
      && (isOpening ? OPENINGS.has(message.plan?.event) : message.plan_hash === planHash));
    if (!alreadyShown) next.messages.push({ role: 'gu', plan: clone(event.gu_plan), plan_hash: planHash, session_id: sessionId });
  }
  next.session_id = sessionId;
  next.coaching_episode_phase = event.session?.coaching_episode_phase || next.coaching_episode_phase;
  if (Object.hasOwn(event, 'session_learning')) next.session_learning = clone(event.session_learning);
  if (event.next_pre_session || next.coaching_episode_phase === 'ACTIVE') next.session_learning = null;
  // One progressive response may be saved twice: useful coaching, then final extraction/GU.
  operation.completed = event.phase !== 'COACHING_READY';
  next.operations[identity.key] = operation;
  return next;
}
