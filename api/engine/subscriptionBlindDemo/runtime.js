import { createHash, randomUUID } from 'node:crypto';
import { BLIND_EXPERIMENT_VERSION, assertBlindRoot, issueBlindScope, scopedBlindAuth } from './authority.js';
import { createBlindProvider } from './provider.js';
import { createSubscriptionV1RuntimeHandler } from '../../internal/subscription-v1-runtime.js';
import { loadProductionIntendedSyntheticSubscriber } from '../subscriptionV1/internalDevSubscriberLoader.js';
import { createSubscriptionS2GuRuntime } from '../subscriptionS2/guRuntime.js';
import { consumeDemoSubjectSwitchCsrf, issueDemoSubjectSwitchCsrf, sameOriginRequest, setNoStore } from '../subscriptionV1/internalDevInfrastructure.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const PREFIX = 'more:subscription-blind:v1';
const sensitiveKeys = new Set(['provider', 'model', 'architecture', 'diagnostics', 'provider_receipts', 'gu_receipt', 'receipt', 'receipts', 'context_selection', 'timing', 'latency_ms', 'estimated_cost_microusd', 'expression_receipt']);
const privateBranding = /openai|chatgpt|gpt[-_ .]|grok|\bxai\b|\bsol\b|api\.x\.ai/iu;

// Strip engineering provenance, not coaching language. Unexpected model-name
// disclosure fails closed rather than rewriting model speech to favor an arm.
export function blindPublicProjection(value) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    return Object.fromEntries(Object.entries(node).filter(([key]) => !sensitiveKeys.has(key)).map(([key, v]) => [key,
      key === 'code' && typeof v === 'string' && privateBranding.test(v) ? 'BLIND_DEMO_RUNTIME_RESULT' : walk(v)]));
  };
  const result = walk(value);
  if (privateBranding.test(JSON.stringify(result))) throw new Error('BLIND_DEMO_DISCLOSURE_BLOCKED');
  return result;
}

export function blindStorageKeys(auth) {
  const cap = assertBlindRoot(auth);
  const root = hash(`${BLIND_EXPERIMENT_VERSION}:${cap.synthetic_relationship_key}`);
  return { root, selection: `${PREFIX}:selection:${root}`, lock: `${PREFIX}:lock:${root}` };
}

export async function handleBlindDemo({ req, res, redis, auth, env,
  providerFactory = createBlindProvider, runtimeFactory = createSubscriptionV1RuntimeHandler,
  subscriberLoader = loadProductionIntendedSyntheticSubscriber }) {
  setNoStore(res);
  const send = (status, body) => res.status(status).json(body);
  if (!sameOriginRequest(req, { allowMissingForGet: true })) return send(403, { ok: false, code: 'BLIND_DEMO_ORIGIN_DENIED' });
  let owner, keys;
  try {
    keys = blindStorageKeys(auth);
    owner = randomUUID();
    if (await redis.set(keys.lock, owner, 'PX', 900000, 'NX') !== 'OK') {
      owner = null;
      return send(409, { ok: false, code: 'BLIND_DEMO_REQUEST_IN_PROGRESS' });
    }
    let selection = JSON.parse(await redis.get(keys.selection) || 'null');
    if (selection && (selection.contract !== BLIND_EXPERIMENT_VERSION || selection.root !== keys.root || !['1', '2'].includes(selection.selection))) {
      throw new Error('BLIND_DEMO_SELECTION_STATE_INVALID');
    }
    if (auth.capability.blind_demo_launch_selection !== undefined && !['1', '2'].includes(auth.capability.blind_demo_launch_selection)) {
      throw new Error('BLIND_DEMO_LAUNCH_SELECTION_INVALID');
    }
    const launchSelection = ['1', '2'].includes(auth.capability.blind_demo_launch_selection)
      ? auth.capability.blind_demo_launch_selection : null;
    if (!selection || (launchSelection && selection.launch_capability_hash !== auth.capability_hash)) {
      selection = { contract: BLIND_EXPERIMENT_VERSION, root: keys.root, selection: launchSelection || '1',
        revision: randomUUID(), launch_capability_hash: auth.capability_hash };
      await redis.set(keys.selection, JSON.stringify(selection));
    }
    if (req.method === 'POST' && req.body?.action === 'SELECT_MODEL') {
      if (!await consumeDemoSubjectSwitchCsrf({ redis, capabilityHash: auth.capability_hash, proof: req.headers?.['x-subscription-demo-subject-csrf'] })) {
        return send(403, { ok: false, code: 'BLIND_DEMO_SELECTION_CSRF_DENIED' });
      }
      if (req.body?.view_token !== selection.revision) return send(409, { ok: false, code: 'BLIND_DEMO_VIEW_STALE' });
      if (!['1', '2'].includes(req.body?.selection)) return send(400, { ok: false, code: 'BLIND_DEMO_SELECTION_DENIED' });
      selection = { ...selection, selection: req.body.selection, revision: randomUUID() };
      await redis.set(keys.selection, JSON.stringify(selection));
      return send(200, { ok: true, code: 'BLIND_DEMO_SELECTION_UPDATED' });
    }
    if (!['GET', 'POST'].includes(req.method)) return send(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    if (req.method === 'POST' && req.body?.view_token !== selection.revision) return send(409, { ok: false, code: 'BLIND_DEMO_VIEW_STALE' });
    if (req.query?.view === 'diagnostics') return send(404, { ok: false, code: 'BLIND_DEMO_PRIVATE_DIAGNOSTICS' });
    const scope = issueBlindScope(auth, selection.selection);
    const scopedAuth = scopedBlindAuth(auth, scope);
    const historyKey = `${PREFIX}:history:${scope.relationship_key}`;
    const rawHistory = JSON.parse(await redis.get(historyKey) || 'null');
    const history = rawHistory || { relationship_key: scope.relationship_key, messages: [], session_id: null, session_learning: null };
    if (history.relationship_key !== scope.relationship_key || !Array.isArray(history.messages)) throw new Error('BLIND_DEMO_HISTORY_SCOPE_DENIED');
    let providers;
    const provider = () => providers || (providers = providerFactory({ scope, env }));
    const messages = history.messages.filter((m) => m.session_id === req.body?.session_id && ['customer', 'coach'].includes(m.role)).slice(-24).map(({ role, content }) => ({ role, content }));
    // Browser history and close-draft fields are never authoritative in either arm.
    const body = { ...req.body, conversation: messages, prior_session_learning: history.session_id === req.body?.session_id ? history.session_learning : null };
    if (body.action === 'END_SESSION' && body.alignment_message) body.conversation = [...messages, { role: 'customer', content: String(body.alignment_message).slice(0, 5000) }].slice(-24);
    const forwarded = { ...req, body, query: {}, headers: { ...req.headers } };
    const inner = runtimeFactory({ getRedis: () => redis, authenticate: async () => scopedAuth, env: {},
      loadSubscriber: (args) => subscriberLoader({ ...args, env: {}, transport: (request, options) => provider().coaching(request, options) }),
      generateGu: async ({ event, loaded, keys: runtimeKeys, sessionLearning = null, mapDelta = null }) => {
        const current = loaded.controller.current();
        if (!current.ok) throw new Error('BLIND_DEMO_CURRENT_STATE_REQUIRED');
        const generated = await createSubscriptionS2GuRuntime({ transport: (request) => provider().visual(request) }).generate({
          event, packet: loaded.controller.wholeUnderstandingPacket(), publication: current.publication,
          viewModel: current.view_model, sessionLearning, mapDelta, relationshipScopeHash: runtimeKeys.scope_hash,
        });
        return { ...generated, current };
      },
    });
    let status = 200, final, stream = false;
    const events = [];
    const transform = (value) => {
      const clean = blindPublicProjection(value);
      if (clean.ok && req.method === 'GET') {
        clean.blind_demo = { label: `MODEL ${selection.selection}`, selection: selection.selection, view_token: selection.revision };
        clean.conversation = history.messages.filter((m) => m.session_id === clean.session?.session_id).map((message) => message.role === 'gu' ? { role: 'gu', plan: message.plan } : { role: message.role, content: message.content });
        const sameSession = history.session_id === clean.session?.session_id;
        clean.session_learning = sameSession ? history.session_learning : null;
        if (sameSession && history.coaching_episode_phase === 'ENDING' && history.session_learning?.status === 'DRAFT_AWAITING_ALIGNMENT') {
          clean.session.coaching_episode_phase = 'ENDING';
        }
        // Reset is not retained for this blind experiment. No shared reset can
        // erase another arm's evolution; the existing direct demo is unchanged.
        clean.demo_reset_enabled = false;
      }
      events.push(clean);
      return clean;
    };
    const proxy = {
      status(value) { status = value; return this; },
      setHeader(name, value) { if (name.toLowerCase() === 'content-type' && String(value).includes('ndjson')) stream = true; res.setHeader(name, value); },
      flushHeaders() {}, flush() { res.flush?.(); },
      json(value) { final = value; },
      write(line) {
        const value = JSON.parse(line);
        const clean = transform(value);
        res.status(status); res.write(`${JSON.stringify(clean)}\n`);
        final = value;
      },
      end(value) { if (value) this.write(value); },
    };
    await inner(forwarded, proxy);
    if (final && !stream) transform(final);
    const useful = events.find((e) => e.phase === 'COACHING_READY') || events.find((e) => e.ok && e.customer_message);
    if (req.method === 'POST' && (final?.ok || useful)) {
      const sessionId = final?.session?.session_id || body.session_id;
      if (body.action === 'START_SESSION' || body.action === 'START_MY_FIRST_SESSION') {
        history.session_id = sessionId;
        history.session_learning = null;
      }
      const customer = body.action === 'TURN' ? body.message : body.alignment_message;
      const requestId = typeof body.close_request_id === 'string' && /^[a-zA-Z0-9-]{1,80}$/u.test(body.close_request_id) ? body.close_request_id : null;
      const alreadyRecorded = requestId && history.messages.some((message) => message.request_id === requestId && message.session_id === sessionId);
      if (customer && !alreadyRecorded) history.messages.push({ role: 'customer', content: String(customer).slice(0, 5000), session_id: sessionId, ...(requestId ? { request_id: requestId } : {}) });
      if (useful?.customer_message) history.messages.push({ role: 'coach', content: useful.customer_message, session_id: sessionId });
      if (final?.gu_plan) history.messages.push({ role: 'gu', plan: blindPublicProjection(final.gu_plan), session_id: sessionId });
      history.coaching_episode_phase = final?.session?.coaching_episode_phase || history.coaching_episode_phase;
      if (Object.hasOwn(final || {}, 'session_learning')) history.session_learning = final.session_learning;
      if (final?.next_pre_session || history.coaching_episode_phase === 'ACTIVE') history.session_learning = null;
      await redis.set(historyKey, JSON.stringify(history));
    }
    if (stream) return res.end();
    const publicResult = events.at(-1) || { ok: false, code: 'BLIND_DEMO_RUNTIME_UNAVAILABLE' };
    if (req.method === 'GET' && publicResult.ok) publicResult.blind_demo.selection_csrf = await issueDemoSubjectSwitchCsrf({ redis, capabilityHash: auth.capability_hash });
    return send(status, publicResult);
  } catch {
    // Never return/log SDK bodies, credential values or the private assignment.
    if (res.headersSent) return res.end(`${JSON.stringify({ ok: false, code: 'BLIND_DEMO_FAILED_CLOSED' })}\n`);
    return send(503, { ok: false, code: 'BLIND_DEMO_FAILED_CLOSED' });
  } finally {
    if (owner && keys) await redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, keys.lock, owner);
  }
}
