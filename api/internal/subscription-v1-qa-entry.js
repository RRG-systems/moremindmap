import crypto from 'node:crypto';
import {
  clearFullPersonQaCapabilityCookie,
  fullPersonQaClientNetworkMaterial,
  fullPersonQaCapabilityLookup,
  issueFullPersonQaCapability,
} from '../engine/subscriptionV1/fullPersonQaAccess.js';
import {
  clearInternalDevCookies,
  getSubscriptionRedis,
  sameOriginRequest,
  setNoStore,
} from '../engine/subscriptionV1/internalDevInfrastructure.js';
import {
  SYNTHETIC_QA_CAPABILITY_STATE_PREFIX,
  SYNTHETIC_QA_RUNTIME_NAMESPACE,
  syntheticQaCapabilityStateKey,
} from '../engine/subscriptionV1/syntheticQaRuntimeInfrastructure.js';

export const FULL_PERSON_QA_ENTRY_NAMESPACE = `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:entry`;
export const FULL_PERSON_QA_ENTRY_CSRF_NAMESPACE = `${FULL_PERSON_QA_ENTRY_NAMESPACE}:csrf`;
export const FULL_PERSON_QA_ENTRY_RATE_NAMESPACE = `${FULL_PERSON_QA_ENTRY_NAMESPACE}:rate`;
export const FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE = SYNTHETIC_QA_CAPABILITY_STATE_PREFIX;
export const FULL_PERSON_QA_CAPABILITY_AUTHORITY_NAMESPACE = `${SYNTHETIC_QA_RUNTIME_NAMESPACE}:authority-capability`;
export const FULL_PERSON_QA_ENTRY_CSRF_TTL_SECONDS = 5 * 60;
export const FULL_PERSON_QA_ENTRY_RATE_TTL_SECONDS = 15 * 60;
export const FULL_PERSON_QA_ENTRY_RATE_LIMIT = 12;
export const FULL_PERSON_QA_ENTRY_GET_RATE_LIMIT = 36;
export const FULL_PERSON_QA_MAX_ACTIVE_CAPABILITIES_PER_AUTHORITY = 3;

const INVALID_PROFILE_CODES = new Set([
  'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_ID_INVALID',
  'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_NOT_ALLOWLISTED',
  'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_REVOKED',
  'SUBSCRIPTION_V1_FULL_PERSON_QA_PROFILE_EXPIRED',
]);
const RATE_INCREMENT = "local current=redis.call('INCR',KEYS[1]); if current == 1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return current";
const CAPABILITY_ATTACH = "if redis.call('EXISTS',KEYS[2]) == 1 then return 0 end; local members=redis.call('SMEMBERS',KEYS[1]); for _,current in ipairs(members) do if string.len(current) ~= 64 or not string.match(current,'^[0-9a-f]+$') or redis.call('EXISTS',ARGV[4]..current) == 0 then redis.call('SREM',KEYS[1],current); end; end; if redis.call('SCARD',KEYS[1]) >= tonumber(ARGV[5]) then return -1 end; local stored=redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2],'NX'); if not stored then return 0 end; redis.call('SADD',KEYS[1],ARGV[3]); redis.call('EXPIRE',KEYS[1],ARGV[2]); return 1";
const CAPABILITY_REPLACE = "if redis.call('EXISTS',KEYS[4]) == 0 then return -2 end; if redis.call('EXISTS',KEYS[2]) == 1 then return 0 end; local members=redis.call('SMEMBERS',KEYS[1]); for _,current in ipairs(members) do if string.len(current) ~= 64 or not string.match(current,'^[0-9a-f]+$') or redis.call('EXISTS',ARGV[4]..current) == 0 then redis.call('SREM',KEYS[1],current); end; end; local active=redis.call('SCARD',KEYS[1]); if KEYS[1] == KEYS[3] and redis.call('SISMEMBER',KEYS[1],ARGV[6]) == 1 then active=active-1 end; if active >= tonumber(ARGV[5]) then return -1 end; local stored=redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[2],'NX'); if not stored then return 0 end; redis.call('SADD',KEYS[1],ARGV[3]); redis.call('SREM',KEYS[3],ARGV[6]); redis.call('DEL',KEYS[4]); if redis.call('SCARD',KEYS[3]) == 0 then redis.call('DEL',KEYS[3]); end; redis.call('EXPIRE',KEYS[1],ARGV[2]); return 1";
const CAPABILITY_REVOKE = "redis.call('SREM',KEYS[1],ARGV[1]); redis.call('DEL',KEYS[2]); if redis.call('SCARD',KEYS[1]) == 0 then redis.call('DEL',KEYS[1]); end; return 1";

function digest(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function opaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function requestClientBinding(req = {}) {
  const address = fullPersonQaClientNetworkMaterial(req);
  const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 240);
  return digest(`${address}\n${userAgent}`);
}

function requestNetworkBinding(req = {}) {
  return digest(fullPersonQaClientNetworkMaterial(req));
}

function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}

function clearQaAndInternalCookies() {
  return [
    ...clearInternalDevCookies(),
    clearFullPersonQaCapabilityCookie(),
  ];
}

function enabled(env) {
  return env?.PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED === 'true';
}

function entryCsrfKey(proof) {
  return `${FULL_PERSON_QA_ENTRY_CSRF_NAMESPACE}:${digest(proof)}`;
}

function entryRateKey(req, action) {
  return `${FULL_PERSON_QA_ENTRY_RATE_NAMESPACE}:${action}:${requestNetworkBinding(req)}`;
}

async function issueQaEntryCsrf({ redis, req, tokenFactory }) {
  const proof = tokenFactory();
  if (typeof proof !== 'string' || proof.length < 32 || proof.length > 256) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CSRF_TOKEN_INVALID');
  }
  const stored = await redis.set(
    entryCsrfKey(proof),
    requestClientBinding(req),
    'EX',
    FULL_PERSON_QA_ENTRY_CSRF_TTL_SECONDS,
    'NX',
  );
  if (stored !== 'OK') throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CSRF_ISSUE_FAILED');
  return proof;
}

async function consumeQaEntryCsrf({ redis, req, proof }) {
  if (typeof proof !== 'string' || proof.length < 32 || proof.length > 256) return false;
  const bound = await redis.getdel(entryCsrfKey(proof));
  return bound === requestClientBinding(req);
}

async function enforceQaEntryRateLimit({ redis, req, action, limit }) {
  if (typeof redis?.eval !== 'function') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ATOMIC_RATE_LIMIT_REQUIRED');
  }
  const key = entryRateKey(req, action);
  const count = Number(await redis.eval(
    RATE_INCREMENT,
    1,
    key,
    String(FULL_PERSON_QA_ENTRY_RATE_TTL_SECONDS),
  ));
  return Number.isInteger(count) && count > 0 && count <= limit;
}

export function fullPersonQaCapabilityReceiptKey(capabilityHash) {
  return syntheticQaCapabilityStateKey(capabilityHash);
}

export function fullPersonQaAuthorityCapabilityKey(authorityId) {
  const authority = String(authorityId || '').trim();
  if (!/^[a-z0-9][a-z0-9:_-]{7,159}$/u.test(authority)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_AUTHORITY_INVALID');
  }
  return `${FULL_PERSON_QA_CAPABILITY_AUTHORITY_NAMESPACE}:${digest(authority)}`;
}

async function currentQaCapabilityForReplacement({ redis, req, capabilityLookup, signingKey }) {
  const lookup = capabilityLookup({ req, signing_key: signingKey });
  if (!lookup?.ok) return null;
  const receiptKey = fullPersonQaCapabilityReceiptKey(lookup.capability_hash);
  const raw = await redis.get(receiptKey);
  if (!raw) return { stale: true };
  let receipt;
  try { receipt = JSON.parse(raw); } catch {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CURRENT_CAPABILITY_INVALID');
  }
  return {
    capability_hash: lookup.capability_hash,
    receipt_key: receiptKey,
    authority_key: fullPersonQaAuthorityCapabilityKey(receipt?.authority_id),
  };
}

async function attachQaCapability({ redis, issued, replacing = null }) {
  if (typeof redis?.eval !== 'function') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ATOMIC_CAPABILITY_REQUIRED');
  }
  if (replacing) {
    const result = Number(await redis.eval(
      CAPABILITY_REPLACE,
      4,
      fullPersonQaAuthorityCapabilityKey(issued.receipt.authority_id),
      fullPersonQaCapabilityReceiptKey(issued.capability_hash),
      replacing.authority_key,
      replacing.receipt_key,
      JSON.stringify(issued.receipt),
      String(issued.max_age_seconds),
      issued.capability_hash,
      `${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`,
      String(FULL_PERSON_QA_MAX_ACTIVE_CAPABILITIES_PER_AUTHORITY),
      replacing.capability_hash,
    ));
    if (result === -2) return 'stale';
    if (result === -1) return 'limit';
    return result === 1 ? 'stored' : 'failed';
  }
  const result = Number(await redis.eval(
    CAPABILITY_ATTACH,
    2,
    fullPersonQaAuthorityCapabilityKey(issued.receipt.authority_id),
    fullPersonQaCapabilityReceiptKey(issued.capability_hash),
    JSON.stringify(issued.receipt),
    String(issued.max_age_seconds),
    issued.capability_hash,
    `${FULL_PERSON_QA_CAPABILITY_RECEIPT_NAMESPACE}:`,
    String(FULL_PERSON_QA_MAX_ACTIVE_CAPABILITIES_PER_AUTHORITY),
  ));
  if (result === -1) return 'limit';
  return result === 1 ? 'stored' : 'failed';
}

async function revokeQaCapability({ redis, capabilityHash }) {
  const receiptKey = fullPersonQaCapabilityReceiptKey(capabilityHash);
  const raw = await redis.get(receiptKey);
  if (!raw) return;
  let receipt;
  try { receipt = JSON.parse(raw); } catch { receipt = null; }
  if (!receipt?.authority_id) {
    await redis.del(receiptKey);
    return;
  }
  if (typeof redis?.eval !== 'function') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ATOMIC_CAPABILITY_REQUIRED');
  }
  await redis.eval(
    CAPABILITY_REVOKE,
    2,
    fullPersonQaAuthorityCapabilityKey(receipt.authority_id),
    receiptKey,
    capabilityHash,
  );
}

export function createSubscriptionV1QaEntryHandler({
  env = globalThis.process?.env || {},
  getRedis = getSubscriptionRedis,
  originCheck = sameOriginRequest,
  issueCapability = issueFullPersonQaCapability,
  capabilityLookup = fullPersonQaCapabilityLookup,
  csrfTokenFactory = opaqueToken,
  capabilityTokenFactory,
  clock = () => new Date(),
} = {}) {
  return async function subscriptionV1QaEntryHandler(req, res) {
    if (!enabled(env)) {
      return send(res, 404, {
        ok: false,
        code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_DEFAULT_OFF',
      });
    }

    const method = String(req?.method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'DELETE'].includes(method)) {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return send(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    }
    if (!originCheck(req)) {
      return send(res, 403, {
        ok: false,
        code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ORIGIN_DENIED',
      });
    }

    if (method === 'DELETE') {
      res.setHeader('Set-Cookie', clearQaAndInternalCookies());
      try {
        const lookup = capabilityLookup({
          req,
          signing_key: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY,
        });
        if (lookup?.ok) {
          const redis = getRedis(env);
          await revokeQaCapability({ redis, capabilityHash: lookup.capability_hash });
        }
      } catch {
        return send(res, 503, {
          ok: false,
          code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_REVOCATION_UNAVAILABLE',
        });
      }
      return send(res, 200, {
        ok: true,
        code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_SESSION_CLEARED',
        synthetic_only: true,
        billing_evidence: false,
      });
    }

    let redis;
    try {
      redis = getRedis(env);
      if (method === 'GET') {
        if (!await enforceQaEntryRateLimit({
          redis,
          req,
          action: 'get',
          limit: FULL_PERSON_QA_ENTRY_GET_RATE_LIMIT,
        })) {
          return send(res, 429, {
            ok: false,
            code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_RATE_LIMITED',
          });
        }
        const csrfToken = await issueQaEntryCsrf({
          redis,
          req,
          tokenFactory: csrfTokenFactory,
        });
        return send(res, 200, {
          ok: true,
          code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_READY',
          csrf_token: csrfToken,
          synthetic_only: true,
          billing_evidence: false,
        });
      }

      const csrfAccepted = await consumeQaEntryCsrf({
        redis,
        req,
        proof: req?.headers?.['x-subscription-qa-entry-csrf'],
      });
      if (!csrfAccepted) {
        return send(res, 403, {
          ok: false,
          code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_CSRF_DENIED',
        });
      }
      if (!await enforceQaEntryRateLimit({
        redis,
        req,
        action: 'post',
        limit: FULL_PERSON_QA_ENTRY_RATE_LIMIT,
      })) {
        return send(res, 429, {
          ok: false,
          code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_RATE_LIMITED',
        });
      }

      let issued;
      const replacing = await currentQaCapabilityForReplacement({
        redis,
        req,
        capabilityLookup,
        signingKey: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY,
      });
      if (replacing?.stale) {
        res.setHeader('Set-Cookie', clearFullPersonQaCapabilityCookie());
        return send(res, 409, {
          ok: false,
          code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CURRENT_CAPABILITY_CHANGED',
          reentry_required: true,
        });
      }
      try {
        issued = issueCapability({
          profile_id: req?.body?.profile_id,
          manifest: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST,
          digest_key: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY,
          signing_key: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY,
          req,
          now: clock(),
          ...(capabilityTokenFactory ? { token_factory: capabilityTokenFactory } : {}),
        });
      } catch (error) {
        if (INVALID_PROFILE_CODES.has(error?.code)) {
          return send(res, 401, {
            ok: false,
            code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_INVALID',
          });
        }
        throw error;
      }

      const capabilityPersistence = await attachQaCapability({ redis, issued, replacing });
      if (capabilityPersistence === 'stale') {
        res.setHeader('Set-Cookie', clearFullPersonQaCapabilityCookie());
        return send(res, 409, {
          ok: false,
          code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CURRENT_CAPABILITY_CHANGED',
          reentry_required: true,
        });
      }
      if (capabilityPersistence === 'limit') {
        return send(res, 429, {
          ok: false,
          code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_LIMIT_REACHED',
        });
      }
      if (capabilityPersistence !== 'stored') {
        throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_PERSIST_FAILED');
      }
      res.setHeader('Set-Cookie', [
        ...clearInternalDevCookies(),
        issued.cookie,
      ]);
      return send(res, 200, {
        ok: true,
        code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTITLEMENT_ISSUED',
        redirect_to: '/subscription',
        synthetic_only: true,
        billing_evidence: false,
      });
    } catch {
      return send(res, 503, {
        ok: false,
        code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_ENTRY_UNAVAILABLE',
      });
    }
  };
}

export default createSubscriptionV1QaEntryHandler();
