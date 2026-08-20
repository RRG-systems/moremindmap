import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import Redis from 'ioredis';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { contractHeader, validateSubscriptionV1Contract } from '../../../src/lib/subscriptionV1/contracts.js';
import { InMemoryAllowanceSessionLedger } from '../../../src/lib/subscriptionV1/sessionLedger.js';
import { InMemoryLivingRelationshipStore } from '../../../src/lib/subscriptionV1/afw05/store.js';

const PREFIX = 'more:subscription-v1:internal-dev:v1';
const CAPABILITY_TTL_SECONDS = 8 * 60 * 60;
const RELATIONSHIP_TTL_SECONDS = 30 * 24 * 60 * 60;
const CSRF_TTL_SECONDS = 5 * 60;
const SNAPSHOT_BACKUP_TTL_SECONDS = 30 * 24 * 60 * 60;
const LOCK_TTL_MS = 20_000;
const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const COOKIE_CAPABILITY = '__Host-more_subscription_internal';
const COOKIE_RELATIONSHIP = '__Host-more_subscription_relationship';

const clone = (value) => JSON.parse(JSON.stringify(value));
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let sharedRedis = null;

export function internalDevEnabled(env = globalThis.process?.env || {}) {
  return env.SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED === 'true';
}

export function getSubscriptionRedis(env = globalThis.process?.env || {}) {
  if (!env.REDIS_URL) throw new Error('SUBSCRIPTION_V1_REDIS_BINDING_REQUIRED');
  if (!sharedRedis) {
    sharedRedis = new Redis(env.REDIS_URL, {
      connectTimeout: 10_000,
      commandTimeout: 15_000,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      tls: env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    });
  }
  return sharedRedis;
}

function cookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function requestOrigin(req) {
  const forwardedHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim().toLowerCase();
  return `${forwardedProto}://${forwardedHost}`;
}

export function sameOriginRequest(req, { allowMissingForGet = false } = {}) {
  const method = String(req.method || 'GET').toUpperCase();
  const supplied = String(req.headers?.origin || req.headers?.referer || '').trim();
  if (!supplied && method === 'GET' && allowMissingForGet) return true;
  try {
    return new URL(supplied).origin === requestOrigin(req);
  } catch {
    return false;
  }
}

export function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
}

export function clearInternalDevCookies() {
  return [
    `${COOKIE_CAPABILITY}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${COOKIE_RELATIONSHIP}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ];
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clientKey(req) {
  const address = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const agent = String(req.headers?.['user-agent'] || '').slice(0, 240);
  return digest(`${address}\n${agent}`).slice(0, 32);
}

export async function issueEntryCsrf({ redis, req }) {
  const proof = token();
  await redis.set(`${PREFIX}:entry-csrf:${digest(proof)}`, clientKey(req), 'EX', CSRF_TTL_SECONDS, 'NX');
  return proof;
}

export async function consumeEntryCsrf({ redis, req, proof }) {
  if (typeof proof !== 'string' || proof.length < 32) return false;
  const key = `${PREFIX}:entry-csrf:${digest(proof)}`;
  const bound = await redis.getdel(key);
  return bound === clientKey(req);
}

export async function enforceEntryRateLimit({ redis, req }) {
  const key = `${PREFIX}:entry-rate:${clientKey(req)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 15 * 60);
  return { allowed: count <= 12, remaining: Math.max(0, 12 - count) };
}

export function exactJordanCode(value) {
  const expected = Buffer.from('jordanTEST');
  const supplied = Buffer.from(String(value || ''));
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

export async function issueInternalDevCapability({ redis, req, now = new Date() }) {
  const parsed = cookies(req.headers?.cookie);
  const suppliedRelationship = parsed[COOKIE_RELATIONSHIP];
  let relationshipKey = suppliedRelationship ? `${PREFIX}:relationship:${digest(suppliedRelationship)}` : null;
  let relationship = relationshipKey ? JSON.parse(await redis.get(relationshipKey) || 'null') : null;
  let relationshipToken = suppliedRelationship;
  if (!relationship?.relationship_key) {
    relationshipToken = token();
    relationshipKey = `${PREFIX}:relationship:${digest(relationshipToken)}`;
    relationship = {
      relationship_key: `rel_${digest(relationshipToken).slice(0, 20)}`,
      subject_key: 're-mid',
      synthetic_only: true,
      created_at: now.toISOString(),
      last_authenticated_at: now.toISOString(),
    };
  } else {
    relationship = { ...relationship, last_authenticated_at: now.toISOString() };
  }
  await redis.set(relationshipKey, JSON.stringify(relationship), 'EX', RELATIONSHIP_TTL_SECONDS);
  const capabilityToken = token();
  const capabilityKey = `${PREFIX}:capability:${digest(capabilityToken)}`;
  const capability = {
    relationship_key: relationship.relationship_key,
    subject_key: 're-mid',
    synthetic_only: true,
    billing_evidence: false,
    stripe_subscription_created: false,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CAPABILITY_TTL_SECONDS * 1000).toISOString(),
    browser_binding_hash: clientKey(req),
  };
  await redis.set(capabilityKey, JSON.stringify(capability), 'EX', CAPABILITY_TTL_SECONDS);
  return {
    capability,
    cookies: [
      cookie(COOKIE_CAPABILITY, capabilityToken, CAPABILITY_TTL_SECONDS),
      cookie(COOKIE_RELATIONSHIP, relationshipToken, RELATIONSHIP_TTL_SECONDS),
    ],
  };
}

export async function authenticateInternalDevRequest({ redis, req }) {
  if (!internalDevEnabled()) return { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_DEV_DEFAULT_OFF', status: 404 };
  const capabilityToken = cookies(req.headers?.cookie)[COOKIE_CAPABILITY];
  if (!capabilityToken) return { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_REQUIRED', status: 401 };
  const capabilityHash = digest(capabilityToken);
  const raw = await redis.get(`${PREFIX}:capability:${capabilityHash}`);
  const capability = raw ? JSON.parse(raw) : null;
  if (!capability || capability.synthetic_only !== true || capability.subject_key !== 're-mid'
    || capability.browser_binding_hash !== clientKey(req) || Date.parse(capability.expires_at) <= Date.now()) {
    return { ok: false, code: 'SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_INVALID', status: 401 };
  }
  return { ok: true, capability, capability_hash: capabilityHash };
}

export async function issueRuntimeCsrf({ redis, capabilityHash }) {
  const proof = token();
  await redis.set(`${PREFIX}:runtime-csrf:${capabilityHash}:${digest(proof)}`, 'active', 'EX', CSRF_TTL_SECONDS, 'NX');
  return proof;
}

export async function consumeRuntimeCsrf({ redis, capabilityHash, proof }) {
  if (typeof proof !== 'string' || proof.length < 32) return false;
  return await redis.getdel(`${PREFIX}:runtime-csrf:${capabilityHash}:${digest(proof)}`) === 'active';
}

async function acquireLock(redis, key) {
  const owner = token();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await redis.set(key, owner, 'PX', LOCK_TTL_MS, 'NX')) return owner;
    await wait(25 * (attempt + 1));
  }
  throw new Error('SUBSCRIPTION_V1_DURABLE_LOCK_BUSY');
}

async function releaseLock(redis, key, owner) {
  await redis.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", 1, key, owner);
}

async function persistWithLock(redis, lockKey, owner, stateKey, backupKey, serialized) {
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SNAPSHOT_BYTES) throw new Error('SUBSCRIPTION_V1_DURABLE_SNAPSHOT_TOO_LARGE');
  const result = await redis.eval(
    "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end local prior=redis.call('GET',KEYS[2]); if prior then redis.call('SET',KEYS[3],prior,'EX',ARGV[3]) end redis.call('SET',KEYS[2],ARGV[2]); return 1",
    3, lockKey, stateKey, backupKey, owner, serialized, String(SNAPSHOT_BACKUP_TTL_SECONDS),
  );
  if (result !== 1) throw new Error('SUBSCRIPTION_V1_DURABLE_LOCK_LOST');
}

export function internalDevKeys({ relationship_key, subject_key = 're-mid' }) {
  const scopeHash = digest(`${relationship_key}:${subject_key}`);
  return {
    scope_hash: scopeHash,
    living_state: `${PREFIX}:living:${scopeHash}`,
    living_backup: `${PREFIX}:living-backup:${scopeHash}`,
    living_lock: `${PREFIX}:living-lock:${scopeHash}`,
    allowance: `${PREFIX}:allowance:${scopeHash}:${new Date().toISOString().slice(0, 7)}`,
    allowance_backup: `${PREFIX}:allowance-backup:${scopeHash}`,
    allowance_lock: `${PREFIX}:allowance-lock:${scopeHash}`,
    research: `${PREFIX}:research:${scopeHash}`,
    diagnostics: `${PREFIX}:diagnostics:${scopeHash}`,
  };
}

export class RedisLivingRelationshipStore extends InMemoryLivingRelationshipStore {
  constructor({ redis, keys, snapshot = null }) {
    super(snapshot);
    this.redis = redis;
    this.keys = keys;
    this.lockOwner = null;
  }

  static async open({ redis, keys }) {
    const raw = await redis.get(keys.living_state);
    let snapshot = null;
    try { snapshot = raw ? JSON.parse(raw) : null; } catch { throw new Error('SUBSCRIPTION_V1_DURABLE_SNAPSHOT_CORRUPT'); }
    return new RedisLivingRelationshipStore({ redis, keys, snapshot });
  }

  async _refreshBeforeTransaction() {
    this.lockOwner = await acquireLock(this.redis, this.keys.living_lock);
    const raw = await this.redis.get(this.keys.living_state);
    if (raw) {
      try { this.state = JSON.parse(raw); } catch { throw new Error('SUBSCRIPTION_V1_DURABLE_SNAPSHOT_CORRUPT'); }
    }
  }

  async _persistSnapshot(next) {
    await persistWithLock(this.redis, this.keys.living_lock, this.lockOwner, this.keys.living_state, this.keys.living_backup, JSON.stringify(next));
    return { ok: true, status: 'REDIS_ATOMIC_SNAPSHOT_COMMITTED' };
  }

  async _releaseTransactionLock() {
    if (this.lockOwner) await releaseLock(this.redis, this.keys.living_lock, this.lockOwner);
    this.lockOwner = null;
  }
}

function hydrateLedger(snapshot) {
  const ledger = new InMemoryAllowanceSessionLedger({ timing_policy: snapshot?.timing_policy });
  for (const value of snapshot?.ledgers || []) ledger.ledgers.set(value.ledger_id, clone(value));
  for (const value of snapshot?.sessions || []) {
    ledger.sessions.set(value.session_id, clone(value));
    if (value.idempotency_key_hash) ledger.idempotency.set(value.idempotency_key_hash, value.session_id);
  }
  return ledger;
}

export async function withDurableAllowanceLedger({ redis, keys, operation }) {
  const owner = await acquireLock(redis, keys.allowance_lock);
  try {
    const raw = await redis.get(keys.allowance);
    let snapshot = null;
    try { snapshot = raw ? JSON.parse(raw) : null; } catch { throw new Error('SUBSCRIPTION_V1_ALLOWANCE_SNAPSHOT_CORRUPT'); }
    const ledger = hydrateLedger(snapshot);
    const result = await operation(ledger);
    await persistWithLock(redis, keys.allowance_lock, owner, keys.allowance, keys.allowance_backup, JSON.stringify(ledger.snapshot()));
    return result;
  } finally {
    await releaseLock(redis, keys.allowance_lock, owner);
  }
}

export function createInternalSyntheticEntitlement({ scope, asOf = new Date() }) {
  const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const end = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1));
  const body = {
    ...contractHeader('paid_entitlement'),
    entitlement_id: `entitlement_internal_${hashCanonicalJson({ scope, month: start.toISOString() }).slice(0, 20)}`,
    scope: clone(scope),
    stripe_customer_hash: hashCanonicalJson({ source: 'INTERNAL_SYNTHETIC_NOT_STRIPE', subject: scope.subject_id }),
    stripe_subscription_hash: hashCanonicalJson({ source: 'INTERNAL_SYNTHETIC_NOT_STRIPE', membership: scope.membership_id }),
    state: 'ACTIVE',
    billing_cycle_start: start.toISOString(),
    billing_cycle_end: end.toISOString(),
    access_ends_at: null,
    source_event_ids: ['internal_synthetic_jordan_entitlement_v1'],
    projected_at: asOf.toISOString(),
    policy_version: 'subscription_v1_internal_synthetic_entitlement_v1',
  };
  const validation = validateSubscriptionV1Contract(body);
  if (!validation.valid) throw new Error('SUBSCRIPTION_V1_INTERNAL_ENTITLEMENT_CONTRACT_INVALID');
  return body;
}

export async function appendDiagnostics({ redis, key, receipts = [], event }) {
  const safeReceipts = receipts.map((receipt) => ({
    stage: receipt.stage,
    model: receipt.model,
    store: receipt.store,
    input_tokens: receipt.input_tokens,
    cached_input_tokens: receipt.cached_input_tokens,
    output_tokens: receipt.output_tokens,
    web_search_calls: receipt.web_search_calls,
    latency_ms: receipt.latency_ms,
    attempt_count: receipt.attempt_count,
    estimated_token_cost_microusd: receipt.estimated_token_cost_microusd,
    created_at: receipt.created_at,
    raw_payload_persisted: false,
  }));
  const entry = { event, receipts: safeReceipts, recorded_at: new Date().toISOString(), raw_provider_payload_persisted: false };
  await redis.lpush(key, JSON.stringify(entry));
  await redis.ltrim(key, 0, 99);
  await redis.expire(key, RELATIONSHIP_TTL_SECONDS);
  return entry;
}

export async function readDiagnostics({ redis, key }) {
  return (await redis.lrange(key, 0, 24)).map((entry) => JSON.parse(entry));
}

export async function mergeExternalEvidence({ redis, key, additions = [] }) {
  let current = [];
  try { current = JSON.parse(await redis.get(key) || '[]'); } catch { current = []; }
  const byId = new Map(current.map((item) => [item.external_evidence_id, item]));
  for (const item of additions) if (item?.external_evidence_id && String(item.source_url || '').startsWith('https://')) byId.set(item.external_evidence_id, item);
  const merged = [...byId.values()].slice(-30);
  await redis.set(key, JSON.stringify(merged), 'EX', 24 * 60 * 60);
  return merged;
}

export async function readExternalEvidence({ redis, key }) {
  try { return JSON.parse(await redis.get(key) || '[]'); } catch { return []; }
}

export const INTERNAL_DEV_RUNTIME = Object.freeze({
  prefix: PREFIX,
  capability_cookie: COOKIE_CAPABILITY,
  relationship_cookie: COOKIE_RELATIONSHIP,
  synthetic_subject_key: 're-mid',
  public_profile_selector: false,
  real_customer_access: false,
});
