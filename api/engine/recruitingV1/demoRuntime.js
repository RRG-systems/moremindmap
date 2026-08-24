/* global Buffer, process */

import { getCanonicalProfile } from '../../business-assessment/shared.js';
import {
  addDarrenSyntheticDemoEvidence,
  assembleDarrenSyntheticDemoInputs,
  createDarrenSyntheticDemoBaseline,
  publicDarrenSyntheticDemoState,
  saveDarrenSyntheticDemoIntelligence,
  saveDarrenSyntheticDemoOpportunity,
} from '../../../src/lib/recruitingV1/darrenSyntheticDemo.js';
import { createOpaqueToken, digestToken, normalizeProfileId, stableHash } from '../../../src/lib/recruitingV1/contracts.js';
import { assembleRecruitingContext, generateRecruitingIntelligence } from '../../../src/lib/recruitingV1/intelligence.js';
import {
  canonicalSignalView,
  createRecruitingOpenAiProvider,
  getRecruitingService,
  syntheticReviewEnabled,
} from './runtime.js';
import { getRecruitingRedis, normalizeRecruitingNamespace } from './redisStore.js';

const DEMO_CSRF_TTL_SECONDS = 15 * 60;
const DEMO_GENERATION_LOCK_SECONDS = 4 * 60;
const clone = (value) => JSON.parse(JSON.stringify(value));

function exactDemoProfile(env) {
  return normalizeProfileId(env.RECRUITING_DEMO_MANAGER_PROFILE_ID);
}

export function recruitingDarrenDemoEnabled(env = process.env) {
  return env.RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED === 'true' && Boolean(exactDemoProfile(env));
}

function assertDarrenAuthority(inspected, env) {
  const membership = inspected?.membership;
  const exactProfile = exactDemoProfile(env);
  if (!recruitingDarrenDemoEnabled(env)) throw new Error('RECRUITING_DEMO_NOT_FOUND');
  if (!membership || normalizeProfileId(membership.manager_profile_id) !== exactProfile) throw new Error('RECRUITING_DEMO_SCOPE_DENIED');
  if (!Array.isArray(membership.admin_roles) || !membership.admin_roles.includes('RECRUITING_ADMIN')) throw new Error('RECRUITING_DEMO_ADMIN_REQUIRED');
  if (membership.entitlement_mode !== 'unlimited' || membership.recruiting_governance?.all_enterprises !== true) throw new Error('RECRUITING_DEMO_AUTHORITY_INCOMPLETE');
  return membership;
}

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

async function managerBosFor(membership, { env, canonicalProfileLoader }) {
  if (syntheticReviewEnabled(env)) return syntheticManagerBos(membership);
  const profile = await canonicalProfileLoader(membership.manager_profile_id);
  if (!profile?.found) throw new Error('RECRUITING_DEMO_MANAGER_BOS_UNAVAILABLE');
  return canonicalSignalView(profile.dossier, 'recruiter');
}

export function createDarrenSyntheticDemoRuntime({
  env = process.env,
  recruitingService = getRecruitingService(env),
  demoStore = new RedisRecruitingDemoStore(getRecruitingRedis(env), { namespace: env.RECRUITING_V1_NAMESPACE }),
  canonicalProfileLoader = async (profileId) => getCanonicalProfile(getRecruitingRedis(env), profileId),
  providerFactory = createRecruitingOpenAiProvider,
  now = () => new Date(),
} = {}) {
  async function authority(sessionToken) {
    const inspected = await recruitingService.inspectManagerReadOnly(sessionToken);
    return { inspected, membership: assertDarrenAuthority(inspected, env) };
  }

  function baseline(membership) {
    return createDarrenSyntheticDemoBaseline({ managerName: membership.manager_name, enterpriseName: membership.enterprise_name });
  }

  async function buildPublic(membership, inspected) {
    const state = await demoStore.read(membership, baseline(membership));
    const managerBos = await managerBosFor(membership, { env, canonicalProfileLoader });
    const managerBosReferenceSha256 = stableHash(managerBos);
    if (state.intelligence?.manager_bos_reference_sha256 && state.intelligence.manager_bos_reference_sha256 !== managerBosReferenceSha256) {
      state.intelligence.stale = true;
    }
    const projected = publicDarrenSyntheticDemoState(state, { entitlement: inspected.entitlement });
    return { state: projected, managerBos, managerBosReferenceSha256 };
  }

  async function read(sessionToken) {
    const { membership, inspected } = await authority(sessionToken);
    const result = await buildPublic(membership, inspected);
    return { demo: result.state, csrf_token: await demoStore.issueCsrf(membership) };
  }

  async function availability(sessionToken) {
    const { membership } = await authority(sessionToken);
    return {
      demo: {
        available: true,
        demo_only: true,
        synthetic_only: true,
        label: 'DEMO CANDIDATE — SYNTHETIC DATA',
        manager_profile_bound_server_side: Boolean(membership.manager_profile_id),
      },
    };
  }

  async function mutate(sessionToken, csrfToken, action, payload = {}) {
    const { membership, inspected } = await authority(sessionToken);
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
        const managerBos = await managerBosFor(membership, { env, canonicalProfileLoader });
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

    const projected = publicDarrenSyntheticDemoState(state, { entitlement: inspected.entitlement });
    return { ...result, demo: projected, csrf_token: await demoStore.issueCsrf(membership) };
  }

  return Object.freeze({ availability, read, mutate });
}
