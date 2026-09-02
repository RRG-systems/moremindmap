import http from 'node:http';

import { createSubscriptionV1RuntimeHandler } from '../api/internal/subscription-v1-runtime.js';
import { loadProductionIntendedSyntheticSubscriber } from '../api/engine/subscriptionV1/internalDevSubscriberLoader.js';
import {
  PATRICIA_DEMO_RELATIONSHIP_KEY,
  PATRICIA_DEMO_SUBJECT_KEY,
  loadPatriciaDerivedDemoSubscriber,
} from '../api/engine/subscriptionS2/patriciaDemoSubscriberLoader.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const HOST = '127.0.0.1';
const PORT = Number(process.env.SUBSCRIPTION_S2_LOCAL_API_PORT || 5199);
const ROUTE = '/api/internal/subscription-v1-runtime';
const LOCAL_QA_REPLAY = String(process.env.SUBSCRIPTION_S2_LOCAL_QA_REPLAY || '').toLowerCase() === 'true';
const SUBJECTS = Object.freeze({
  synthetic: Object.freeze({
    subject_key: 're-mid',
    relationship_key: 'rel_11111111111111111111',
    label: 'SYNTHETIC',
  }),
  'patricia-demo': Object.freeze({
    subject_key: PATRICIA_DEMO_SUBJECT_KEY,
    relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY,
    label: 'PATRICIA_DERIVED',
  }),
});

export class LocalDemoRedis {
  constructor() {
    this.values = new Map();
    this.lists = new Map();
  }

  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) {
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return value;
  }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async incr(key) {
    const value = Number(this.values.get(key) || 0) + 1;
    this.values.set(key, String(value));
    return value;
  }
  async expire() { return 1; }
  async lpush(key, value) {
    const values = this.lists.get(key) || [];
    values.unshift(value);
    this.lists.set(key, values);
    return values.length;
  }
  async ltrim(key, start, end) {
    this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1));
    return 'OK';
  }
  async lrange(key, start, end) { return (this.lists.get(key) || []).slice(start, end + 1); }
  async eval(_script, keyCount, ...parts) {
    const keys = parts.slice(0, keyCount);
    const args = parts.slice(keyCount);
    if (keyCount === 1) {
      if (this.values.get(keys[0]) !== args[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    if (keyCount === 3) {
      if (this.values.get(keys[0]) !== args[0]) return 0;
      const prior = this.values.get(keys[1]);
      if (prior) this.values.set(keys[2], prior);
      this.values.set(keys[1], args[1]);
      return 1;
    }
    throw new Error('SUBSCRIPTION_S2_LOCAL_REDIS_SCRIPT_DENIED');
  }
}

function subjectFor(req) {
  const value = String(req.query?.subject || req.body?.subject || 'synthetic').toLowerCase();
  return SUBJECTS[value] ? value : null;
}

function expressResponse(response) {
  return {
    setHeader(name, value) { response.setHeader(name, value); return this; },
    status(code) { response.statusCode = code; return this; },
    json(body) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify(body));
      return this;
    },
    write(value) { return response.write(value); },
    end(value) { return response.end(value); },
    flush() {},
    flushHeaders() { response.flushHeaders(); },
  };
}

function localQaTransport(_request, { stage } = {}) {
  if (stage === 'CONVERSATION') return Promise.resolve({
    output: { customer_message: 'Jordan, one useful point is enough to start. What matters most today?' },
    usage: { input_tokens: 1, output_tokens: 1 }, latency_ms: 1, web_search_calls: 0, external_evidence: [],
  });
  if (stage === 'CANDIDATE_EXTRACTION') return Promise.resolve({ output: { candidate: null }, usage: {}, latency_ms: 1 });
  if (stage === 'NATURAL_AUTHORIZATION') return Promise.resolve({ output: { decision: 'NONE', proposal_hash: '0'.repeat(64), effective_items: [], unambiguous: false, reason: 'No pending proposal.' }, usage: {}, latency_ms: 1 });
  if (stage === 'SESSION_CLOSE') return Promise.resolve({
    output: {
      customer_message: 'Jordan, we have a clear place to pick this up next time.',
      session_learning: {
        what_mattered: 'The customer identified what matters today.',
        what_changed: 'No governed map change was established.',
        what_was_learned: 'The session has one clear point to continue from.',
        what_was_decided: 'No new decision was authorized.',
        what_remains_open: 'The current question remains open.',
        durable_governed_meaning: 'No new durable meaning was authorized.',
        pick_up_next_time: 'Continue from the current Business Twin and open question.',
      },
    },
    usage: {}, latency_ms: 1,
  });
  throw new Error('SUBSCRIPTION_S2_LOCAL_QA_STAGE_DENIED');
}

async function localQaGu({ event, loaded, keys }) {
  const current = loaded.controller.current();
  const heading = {
    FIRST_SESSION_WELCOME: ['WELCOME TO MORE', 'WELCOME TO MORE'],
    SESSION_OPENING: ['HERE’S WHERE WE ARE', 'Here’s where we left off'],
    COACHING_MOMENT: ['A CLEARER VIEW', 'Here’s one way to see it'],
    MAP_CHANGE: ['YOUR LIVING MAP', 'Here’s how your map changed'],
    SESSION_CLOSING: ['UNTIL NEXT TIME', 'Here’s what we’re carrying forward'],
  }[event];
  if (!heading) throw new Error('SUBSCRIPTION_S2_LOCAL_QA_GU_EVENT_DENIED');
  const render = event !== 'COACHING_MOMENT';
  return {
    ok: true,
    plan: {
      planVersion: 'more-subscription-s2-gu-plan-v1',
      event,
      stateBinding: { relationshipScopeHash: keys.scope_hash },
      renderDecision: { render, reason: 'Deterministic local render-wiring proof.' },
      guidance: { eyebrow: heading[0], headline: heading[1], summary: 'Start with one important idea.', nextCue: 'What would make this useful today?' },
      blocks: render ? [{
        blockId: `s2-block-local-${event.toLowerCase().replaceAll('_', '-')}`,
        type: 'PLAIN_LANGUAGE',
        title: event === 'SESSION_CLOSING' ? 'What we will carry forward' : 'One clear place to begin',
        subtitle: 'The full Business Twin remains available underneath.',
        objects: [{ id: 's2-local-qa-object', kind: 'PLAIN_LANGUAGE', statement: event === 'SESSION_CLOSING' ? 'We will continue from what mattered today.' : 'Choose the one thing that would make this session useful.', items: [] }],
        evidence: [],
        emphasis: 'PRIMARY',
      }] : [],
      interactions: [],
    },
    receipt: { runtime: 'subscription-s2-local-qa-replay', provider: { stage: 'S2_GU', model: 'LOCAL_QA_REPLAY', store: false, latency_ms: 1 }, mutation_authority: false },
    current,
    world: { stateBinding: { relationshipScopeHash: keys.scope_hash } },
  };
}

async function bodyFor(request) {
  if (request.method !== 'POST') return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error('SUBSCRIPTION_S2_LOCAL_BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function createSubscriptionS2LocalServer({ redis = new LocalDemoRedis(), env = process.env } = {}) {
  const loadSubscriber = async (args) => args.subject_key === PATRICIA_DEMO_SUBJECT_KEY
    ? loadPatriciaDerivedDemoSubscriber({ ...args, ...(LOCAL_QA_REPLAY ? { transport: localQaTransport } : {}) })
    : loadProductionIntendedSyntheticSubscriber({ ...args, ...(LOCAL_QA_REPLAY ? { transport: localQaTransport } : {}) });
  const authenticate = async ({ req }) => {
    const selected = subjectFor(req);
    if (!selected) return { ok: false, code: 'SUBSCRIPTION_S2_LOCAL_SUBJECT_DENIED', status: 403 };
    const capability = {
      ...SUBJECTS[selected],
      synthetic_only: true,
      local_demo_only: true,
      billing_evidence: false,
      stripe_subscription_created: false,
    };
    return { ok: true, capability, capability_hash: hashCanonicalJson({ selected, capability }) };
  };
  const handler = createSubscriptionV1RuntimeHandler({ getRedis: () => redis, authenticate, loadSubscriber, ...(LOCAL_QA_REPLAY ? { generateGu: localQaGu } : {}), env });
  return http.createServer(async (request, response) => {
    const url = new URL(String(request.url || ''), `http://${HOST}:${PORT}`);
    if (url.pathname !== ROUTE) {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)) {
      response.statusCode = 403;
      response.end(JSON.stringify({ ok: false, code: 'LOOPBACK_ONLY' }));
      return;
    }
    try {
      request.query = Object.fromEntries(url.searchParams.entries());
      request.body = await bodyFor(request);
      request.headers.host = request.headers.host || `${HOST}:${PORT}`;
      const suppliedPage = String(request.headers.origin || request.headers.referer || '').trim();
      let suppliedOrigin = null;
      try { suppliedOrigin = suppliedPage ? new URL(suppliedPage) : null; } catch { suppliedOrigin = null; }
      if (suppliedOrigin && ['127.0.0.1', 'localhost'].includes(suppliedOrigin.hostname)) {
        request.headers['x-forwarded-host'] = suppliedOrigin.host;
        request.headers['x-forwarded-proto'] = suppliedOrigin.protocol.replace(':', '');
      } else {
        request.headers['x-forwarded-proto'] = 'http';
      }
      await handler(request, expressResponse(response));
    } catch (error) {
      if (response.writableEnded) return;
      response.statusCode = 422;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ ok: false, code: error?.code || error?.message || 'SUBSCRIPTION_S2_LOCAL_REQUEST_FAILED' }));
    }
  });
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const server = createSubscriptionS2LocalServer();
  server.listen(PORT, HOST, () => {
    process.stdout.write(`${JSON.stringify({ event: 'SUBSCRIPTION_S2_LOCAL_API_READY', host: HOST, port: PORT, route: ROUTE, subjects: Object.keys(SUBJECTS), isolated_process_memory: true, local_qa_replay: LOCAL_QA_REPLAY, production_effects: false })}\n`);
  });
}
