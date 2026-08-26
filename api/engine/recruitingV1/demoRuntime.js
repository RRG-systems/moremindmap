/* global Buffer, process */

import {
  addDarrenSyntheticDemoEvidence,
  assembleDarrenSyntheticDemoInputs,
  createDarrenSyntheticDemoBaseline,
  publicDarrenSyntheticDemoState,
  saveDarrenSyntheticDemoIntelligence,
  saveDarrenSyntheticDemoOpportunity,
} from '../../../src/lib/recruitingV1/darrenSyntheticDemo.js';
import { createOpaqueToken, digestToken, stableHash } from '../../../src/lib/recruitingV1/contracts.js';
import { assembleRecruitingContext, generateRecruitingIntelligence } from '../../../src/lib/recruitingV1/intelligence.js';
import { createRecruitingOpenAiProvider } from './runtime.js';
import { getRecruitingRedis, normalizeRecruitingNamespace } from './redisStore.js';

const DEMO_CSRF_TTL_SECONDS = 15 * 60;
const DEMO_GENERATION_LOCK_SECONDS = 4 * 60;
const clone = (value) => JSON.parse(JSON.stringify(value));

export function recruitingDarrenDemoEnabled(env = process.env) {
  return env.RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED === 'true';
}

function assertSyntheticDemoCapability(capability, env) {
  if (!recruitingDarrenDemoEnabled(env)) throw new Error('RECRUITING_DEMO_NOT_FOUND');
  if (capability?.contract !== 'recruiting_synthetic_demo_capability_v1'
    || capability.synthetic_only !== true || capability.allowed_product !== 'recruiting'
    || capability.subject_key !== 'recruiting-darren-jordan-v1' || !capability.demo_scope_id) {
    throw new Error('RECRUITING_DEMO_SCOPE_DENIED');
  }
  return Object.freeze({
    membership_id: capability.demo_scope_id,
    manager_subject_id: `synthetic:${capability.demo_scope_id}`,
    enterprise_id: 'demo_synthetic_enterprise_v1',
    manager_profile_id: null,
    manager_name: 'Darren Synthetic',
    enterprise_name: 'MORE MindMap',
    synthetic_only: true,
    demo_only: true,
  });
}

const SYNTHETIC_DEMO_ENTITLEMENT = Object.freeze({
  mode: 'unlimited', used: 0, reserved: 0, consumed: 0, remaining: null,
  synthetic_only: true, ledger_written: false,
});

function demoKeys(namespace, membershipId) {
  const base = `more:${normalizeRecruitingNamespace(namespace)}:darren-synthetic-demo:v1:${stableHash(membershipId).slice(0, 32)}`;
  return Object.freeze({ state: `${base}:state`, csrf: `${base}:csrf`, generationLock: `${base}:generation-lock` });
}

export class RedisRecruitingDemoStore {
  constructor(redis, { namespace, now = () => new Date() } = {}) {
    this.redis = redis;
    this.namespace = namespace;
    this.now = now;
  }

  async read(membership, baseline) {
    const raw = await this.redis.get(demoKeys(this.namespace, membership.membership_id).state);
    if (!raw) return clone(baseline);
    try {
      const state = JSON.parse(raw);
      if (state?.contract !== baseline.contract || state?.baseline_version !== baseline.baseline_version || state?.demo_only !== true) {
        throw new Error('RECRUITING_DEMO_DURABLE_STATE_INVALID');
      }
      return state;
    } catch (error) {
      if (error?.message === 'RECRUITING_DEMO_DURABLE_STATE_INVALID') throw error;
      throw new Error('RECRUITING_DEMO_DURABLE_STATE_CORRUPT');
    }
  }

  async write(membership, state) {
    const serialized = JSON.stringify(state);
    if (Buffer.byteLength(serialized) > 512 * 1024) throw new Error('RECRUITING_DEMO_DURABLE_STATE_TOO_LARGE');
    await this.redis.set(demoKeys(this.namespace, membership.membership_id).state, serialized);
    return clone(state);
  }

  async reset(membership) {
    await this.redis.del(demoKeys(this.namespace, membership.membership_id).state);
  }

  async issueCsrf(membership) {
    const token = createOpaqueToken();
    const keys = demoKeys(this.namespace, membership.membership_id);
    await this.redis.set(`${keys.csrf}:${digestToken(token)}`, '1', 'EX', DEMO_CSRF_TTL_SECONDS);
    return token;
  }

  async consumeCsrf(membership, token) {
    const keys = demoKeys(this.namespace, membership.membership_id);
    const consumed = await this.redis.del(`${keys.csrf}:${digestToken(token)}`);
    if (consumed !== 1) throw new Error('RECRUITING_DEMO_CSRF_INVALID');
  }

  async withGenerationLock(membership, operation) {
    const key = demoKeys(this.namespace, membership.membership_id).generationLock;
    const owner = createOpaqueToken();
    const acquired = await this.redis.set(key, owner, 'EX', DEMO_GENERATION_LOCK_SECONDS, 'NX');
    if (acquired !== 'OK') throw new Error('RECRUITING_DEMO_GENERATION_IN_PROGRESS');
    try {
      return await operation();
    } finally {
      await this.redis.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, key, owner);
    }
  }
}

export class InMemoryRecruitingDemoStore {
  constructor() {
    this.states = new Map();
    this.csrf = new Set();
    this.locked = new Set();
  }

  key(membership) { return membership.membership_id; }
  async read(membership, baseline) { return clone(this.states.get(this.key(membership)) || baseline); }
  async write(membership, state) { this.states.set(this.key(membership), clone(state)); return clone(state); }
  async reset(membership) { this.states.delete(this.key(membership)); }
  async issueCsrf(membership) { const token = createOpaqueToken(); this.csrf.add(`${this.key(membership)}:${digestToken(token)}`); return token; }
  async consumeCsrf(membership, token) {
    const key = `${this.key(membership)}:${digestToken(token)}`;
    if (!this.csrf.delete(key)) throw new Error('RECRUITING_DEMO_CSRF_INVALID');
  }
  async withGenerationLock(membership, operation) {
    const key = this.key(membership);
    if (this.locked.has(key)) throw new Error('RECRUITING_DEMO_GENERATION_IN_PROGRESS');
    this.locked.add(key);
    try { return await operation(); } finally { this.locked.delete(key); }
  }
}

function syntheticManagerBos(membership) {
  return Object.freeze({
    role: 'recruiter',
    authority_class: 'SYNTHETIC_BOS',
    evidence: {
      demo_manager_communication: { dimension: 'communication', narrative_hint: 'Direct, specific, candid, and attentive to useful operating proof.' },
      demo_manager_coaching: { dimension: 'coaching', narrative_hint: 'Creates clarity quickly while learning to leave room for the other person to test the reasoning.' },
    },
    summary: `${membership.manager_name} is a fully synthetic manager authority in this non-production review context.`,
    missing: [],
  });
}

export function createDarrenSyntheticDemoRuntime({
  env = process.env,
  demoStore = new RedisRecruitingDemoStore(getRecruitingRedis(env), { namespace: env.RECRUITING_V1_NAMESPACE }),
  providerFactory = createRecruitingOpenAiProvider,
  now = () => new Date(),
} = {}) {
  async function authority(capability) {
    return { membership: assertSyntheticDemoCapability(capability, env) };
  }

  function baseline(membership) {
    return createDarrenSyntheticDemoBaseline({ managerName: membership.manager_name, enterpriseName: membership.enterprise_name });
  }

  async function buildPublic(membership) {
    const state = await demoStore.read(membership, baseline(membership));
    const managerBos = syntheticManagerBos(membership);
    const managerBosReferenceSha256 = stableHash(managerBos);
    if (state.intelligence?.manager_bos_reference_sha256 && state.intelligence.manager_bos_reference_sha256 !== managerBosReferenceSha256) {
      state.intelligence.stale = true;
    }
    const projected = publicDarrenSyntheticDemoState(state, { entitlement: SYNTHETIC_DEMO_ENTITLEMENT });
    return { state: projected, managerBos, managerBosReferenceSha256 };
  }

  async function read(capability) {
    const { membership } = await authority(capability);
    const result = await buildPublic(membership);
    return { demo: result.state, csrf_token: await demoStore.issueCsrf(membership) };
  }

  async function availability(capability) {
    await authority(capability);
    return {
      demo: {
        available: true,
        demo_only: true,
        synthetic_only: true,
        label: 'DEMO CANDIDATE — SYNTHETIC DATA',
        manager_profile_bound_server_side: false,
        manager_session_required: false,
      },
    };
  }

  async function mutate(capability, csrfToken, action, payload = {}) {
    const { membership } = await authority(capability);
    await demoStore.consumeCsrf(membership, csrfToken);
    let state = await demoStore.read(membership, baseline(membership));
    let result = null;

    if (action === 'RESET_DEMO') {
      await demoStore.reset(membership);
      state = baseline(membership);
      result = { reset: true };
    } else if (action === 'ADD_DEMO_EVIDENCE') {
      const added = addDarrenSyntheticDemoEvidence(state, payload.evidence, now());
      state = await demoStore.write(membership, added.state);
      result = { evidence: added.evidence };
    } else if (action === 'SAVE_DEMO_OPPORTUNITY') {
      state = await demoStore.write(membership, saveDarrenSyntheticDemoOpportunity(state, payload.items, now()));
      result = { opportunity: state.opportunity };
    } else if (action === 'GENERATE_DEMO_INTELLIGENCE') {
      state = await demoStore.withGenerationLock(membership, async () => {
        const managerBos = syntheticManagerBos(membership);
        const context = assembleRecruitingContext(assembleDarrenSyntheticDemoInputs({ state, membership, managerBos }));
        const provider = providerFactory(env);
        const intelligence = await generateRecruitingIntelligence({ context, provider });
        return demoStore.write(membership, saveDarrenSyntheticDemoIntelligence(state, intelligence, {
          managerBosReferenceSha256: stableHash(managerBos), now: now(),
        }));
      });
      result = { intelligence: state.intelligence };
    } else if (action === 'RECORD_DEMO_EXPORT') {
      result = { export: { demo_only: true, persisted: false, audit_written: false } };
    } else {
      throw new Error('RECRUITING_DEMO_ACTION_INVALID');
    }

    const projected = publicDarrenSyntheticDemoState(state, { entitlement: SYNTHETIC_DEMO_ENTITLEMENT });
    return { ...result, demo: projected, csrf_token: await demoStore.issueCsrf(membership) };
  }

  return Object.freeze({ availability, read, mutate });
}
