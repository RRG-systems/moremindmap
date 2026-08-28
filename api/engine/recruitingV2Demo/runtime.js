/* global Buffer, process */

import {
  createRecruitingV2DemoBaseline,
  publicRecruitingV2DemoState,
  RECRUITING_V2_DEMO_CONTRACT,
  transitionRecruitingV2Demo,
  validateRecruitingV2DemoState,
} from '../../../src/lib/recruitingV2Demo/session.js';
import { createOpaqueToken, digestToken, stableHash } from '../../../src/lib/recruitingV1/contracts.js';
import { createRecruitingOpenAiProvider } from '../recruitingV1/runtime.js';
import { getRecruitingRedis, normalizeRecruitingNamespace } from '../recruitingV1/redisStore.js';

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const CSRF_TTL_SECONDS = 15 * 60;
const MUTATION_LOCK_SECONDS = 4 * 60;
const clone = (value) => JSON.parse(JSON.stringify(value));

export function recruitingV2SyntheticDemoEnabled(env = process.env) {
  return env.RECRUITING_V2_SYNTHETIC_DEMO_ENABLED === 'true'
    || env.RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED === 'true';
}

function assertCapability(capability, env) {
  if (!recruitingV2SyntheticDemoEnabled(env)) throw new Error('RECRUITING_V2_DEMO_NOT_FOUND');
  if (capability?.contract !== 'recruiting_synthetic_demo_capability_v1'
    || capability.synthetic_only !== true
    || capability.allowed_product !== 'recruiting'
    || capability.subject_key !== 'recruiting-darren-jordan-v1'
    || !capability.demo_scope_id) {
    throw new Error('RECRUITING_V2_DEMO_SCOPE_DENIED');
  }
  return Object.freeze({
    demo_scope_id: capability.demo_scope_id,
    relationship_session_id: `synthetic-v2:${capability.demo_scope_id}`,
    synthetic_only: true,
    manager_session_required: false,
  });
}

function keys(namespace, scopeId) {
  const base = `more:${normalizeRecruitingNamespace(namespace)}:synthetic-recruiting-v2:campaign-2g:${stableHash(scopeId).slice(0, 32)}`;
  return Object.freeze({ state: `${base}:state`, csrf: `${base}:csrf`, lock: `${base}:lock` });
}

export class RedisRecruitingV2DemoStore {
  constructor(redis, { namespace } = {}) {
    this.redis = redis;
    this.namespace = namespace;
  }

  async read(scope, baseline) {
    const raw = await this.redis.get(keys(this.namespace, scope.demo_scope_id).state);
    if (!raw) return clone(baseline);
    let state;
    try { state = JSON.parse(raw); } catch { throw new Error('RECRUITING_V2_DEMO_STATE_CORRUPT'); }
    validateRecruitingV2DemoState(state);
    if (state.contract !== RECRUITING_V2_DEMO_CONTRACT || state.baseline_version !== baseline.baseline_version) throw new Error('RECRUITING_V2_DEMO_STATE_VERSION_INVALID');
    return state;
  }

  async write(scope, state) {
    validateRecruitingV2DemoState(state);
    const serialized = JSON.stringify(state);
    if (Buffer.byteLength(serialized) > 512 * 1024) throw new Error('RECRUITING_V2_DEMO_STATE_TOO_LARGE');
    await this.redis.set(keys(this.namespace, scope.demo_scope_id).state, serialized, 'EX', SESSION_TTL_SECONDS);
    return clone(state);
  }

  async reset(scope) {
    await this.redis.del(keys(this.namespace, scope.demo_scope_id).state);
  }

  async issueCsrf(scope) {
    const token = createOpaqueToken();
    await this.redis.set(`${keys(this.namespace, scope.demo_scope_id).csrf}:${digestToken(token)}`, '1', 'EX', CSRF_TTL_SECONDS, 'NX');
    return token;
  }

  async consumeCsrf(scope, token) {
    if (!token) throw new Error('RECRUITING_V2_DEMO_CSRF_REQUIRED');
    const consumed = await this.redis.del(`${keys(this.namespace, scope.demo_scope_id).csrf}:${digestToken(token)}`);
    if (consumed !== 1) throw new Error('RECRUITING_V2_DEMO_CSRF_INVALID');
  }

  async withLock(scope, operation) {
    const key = keys(this.namespace, scope.demo_scope_id).lock;
    const owner = createOpaqueToken();
    const acquired = await this.redis.set(key, owner, 'EX', MUTATION_LOCK_SECONDS, 'NX');
    if (acquired !== 'OK') throw new Error('RECRUITING_V2_DEMO_MUTATION_IN_PROGRESS');
    try { return await operation(); }
    finally {
      await this.redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, key, owner);
    }
  }
}

export class InMemoryRecruitingV2DemoStore {
  constructor() {
    this.states = new Map();
    this.csrf = new Set();
    this.locked = new Set();
  }
  key(scope) { return scope.demo_scope_id; }
  async read(scope, baseline) { return clone(this.states.get(this.key(scope)) || baseline); }
  async write(scope, state) { this.states.set(this.key(scope), clone(state)); return clone(state); }
  async reset(scope) { this.states.delete(this.key(scope)); }
  async issueCsrf(scope) { const token = createOpaqueToken(); this.csrf.add(`${this.key(scope)}:${digestToken(token)}`); return token; }
  async consumeCsrf(scope, token) { const key = `${this.key(scope)}:${digestToken(token)}`; if (!this.csrf.delete(key)) throw new Error('RECRUITING_V2_DEMO_CSRF_INVALID'); }
  async withLock(scope, operation) {
    const key = this.key(scope);
    if (this.locked.has(key)) throw new Error('RECRUITING_V2_DEMO_MUTATION_IN_PROGRESS');
    this.locked.add(key);
    try { return await operation(); } finally { this.locked.delete(key); }
  }
}

export function createRecruitingV2DemoRuntime({
  env = process.env,
  store = new RedisRecruitingV2DemoStore(getRecruitingRedis(env), { namespace: env.RECRUITING_V1_NAMESPACE }),
  providerFactory = createRecruitingOpenAiProvider,
  now = () => new Date(),
} = {}) {
  async function read(capability) {
    const scope = assertCapability(capability, env);
    const state = await store.read(scope, createRecruitingV2DemoBaseline());
    return { session: publicRecruitingV2DemoState(state), csrf_token: await store.issueCsrf(scope) };
  }

  async function availability(capability) {
    const scope = assertCapability(capability, env);
    return {
      demo: {
        available: true,
        contract: RECRUITING_V2_DEMO_CONTRACT,
        demo_scope_id_hash: stableHash(scope.demo_scope_id),
        synthetic_only: true,
        manager_session_required: false,
        membership_required: false,
        entitlement_consumed: false,
      },
    };
  }

  async function mutate(capability, csrfToken, action, payload = {}) {
    const scope = assertCapability(capability, env);
    await store.consumeCsrf(scope, csrfToken);
    let result;
    if (action === 'RESET_SESSION') {
      await store.reset(scope);
      result = createRecruitingV2DemoBaseline();
    } else {
      result = await store.withLock(scope, async () => {
        const current = await store.read(scope, createRecruitingV2DemoBaseline());
        const provider = action === 'SUBMIT_MEANING' ? providerFactory(env) : null;
        const next = await transitionRecruitingV2Demo(current, action, payload, { provider, now });
        return store.write(scope, next);
      });
    }
    return { session: publicRecruitingV2DemoState(result), csrf_token: await store.issueCsrf(scope) };
  }

  return Object.freeze({ availability, read, mutate });
}
