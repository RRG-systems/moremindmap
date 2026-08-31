import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

const PREFIX = 'more:leadership-demo:v1';
const ENTRY_CSRF_TTL_SECONDS = 5 * 60;
const LAUNCHER_CSRF_TTL_SECONDS = 5 * 60;
const LAUNCHER_TTL_SECONDS = 30 * 60;
const RECRUITING_DEMO_TTL_SECONDS = 8 * 60 * 60;
const RECRUITING_DEMO_CSRF_TTL_SECONDS = 5 * 60;
const LAUNCHER_COOKIE = '__Host-more_leadership_demo';
const RECRUITING_DEMO_COOKIE = '__Host-more_recruiting_demo';

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const opaqueToken = () => crypto.randomBytes(32).toString('base64url');

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}

function requestOrigin(req) {
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();
  const proto = String(req.headers?.['x-forwarded-proto'] || (host.startsWith('127.0.0.1') || host.startsWith('localhost') ? 'http' : 'https')).split(',')[0].trim().toLowerCase();
  return `${proto}://${host}`;
}

function clientKey(req) {
  const address = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const agent = String(req.headers?.['user-agent'] || '').slice(0, 240);
  return digest(`${address}\n${agent}`).slice(0, 32);
}

function secureCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function constantTimeEqual(expectedValue, suppliedValue) {
  const expected = Buffer.from(String(expectedValue || ''));
  const supplied = Buffer.from(String(suppliedValue || ''));
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

function isCurrent(value, now) {
  return Number.isFinite(Date.parse(value)) && Date.parse(value) > now.getTime();
}

export function leadershipDemoEnabled(env = globalThis.process?.env || {}) {
  return env.RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED === 'true'
    && env.SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED === 'true';
}

export function sameOriginLeadershipDemoRequest(req, { allowMissingForGet = false } = {}) {
  const method = String(req.method || 'GET').toUpperCase();
  const supplied = String(req.headers?.origin || req.headers?.referer || '').trim();
  if (!supplied && method === 'GET' && allowMissingForGet) return true;
  try {
    return new URL(supplied).origin === requestOrigin(req);
  } catch {
    return false;
  }
}

export function setLeadershipDemoNoStore(res) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
}

export function exactLeadershipDemoCode(value, env = globalThis.process?.env || {}) {
  return constantTimeEqual(env.LEADERSHIP_DEMO_ACCESS_CODE || 'darrendemo', value);
}

export function clearLeadershipDemoCookies() {
  return [
    `${LAUNCHER_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
    `${RECRUITING_DEMO_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  ];
}

export async function issueLeadershipEntryCsrf({ redis, req }) {
  const proof = opaqueToken();
  await redis.set(`${PREFIX}:entry-csrf:${digest(proof)}`, clientKey(req), 'EX', ENTRY_CSRF_TTL_SECONDS, 'NX');
  return proof;
}

export async function consumeLeadershipEntryCsrf({ redis, req, proof }) {
  if (typeof proof !== 'string' || proof.length < 32) return false;
  const bound = await redis.getdel(`${PREFIX}:entry-csrf:${digest(proof)}`);
  return bound === clientKey(req);
}

export async function enforceLeadershipEntryRateLimit({ redis, req }) {
  const key = `${PREFIX}:entry-rate:${clientKey(req)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 15 * 60);
  return { allowed: count <= 12, remaining: Math.max(0, 12 - count) };
}

export async function issueLeadershipLauncherCapability({ redis, req, now = new Date() }) {
  const launcherToken = opaqueToken();
  const launcherHash = digest(launcherToken);
  const capability = {
    contract: 'leadership_demo_launcher_capability_v1',
    launcher_scope_id: `leadership_demo_${launcherHash.slice(0, 24)}`,
    allowed_products: ['recruiting', 'subscription'],
    synthetic_only: true,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + LAUNCHER_TTL_SECONDS * 1000).toISOString(),
    browser_binding_hash: clientKey(req),
  };
  await redis.set(`${PREFIX}:launcher:${launcherHash}`, JSON.stringify(capability), 'EX', LAUNCHER_TTL_SECONDS, 'NX');
  return {
    capability,
    capability_hash: launcherHash,
    cookie: secureCookie(LAUNCHER_COOKIE, launcherToken, LAUNCHER_TTL_SECONDS),
  };
}

export async function authenticateLeadershipLauncher({ redis, req, now = new Date() }) {
  const launcherToken = parseCookies(req.headers?.cookie)[LAUNCHER_COOKIE];
  if (!launcherToken) return { ok: false, code: 'LEADERSHIP_DEMO_LAUNCHER_REQUIRED', status: 401 };
  const capabilityHash = digest(launcherToken);
  const raw = await redis.get(`${PREFIX}:launcher:${capabilityHash}`);
  let capability = null;
  try { capability = raw ? JSON.parse(raw) : null; } catch { capability = null; }
  if (!capability || capability.contract !== 'leadership_demo_launcher_capability_v1'
    || capability.synthetic_only !== true || capability.browser_binding_hash !== clientKey(req)
    || !isCurrent(capability.expires_at, now)) {
    return { ok: false, code: 'LEADERSHIP_DEMO_LAUNCHER_INVALID', status: 401 };
  }
  return { ok: true, capability, capability_hash: capabilityHash };
}

export async function issueLeadershipLauncherCsrf({ redis, capabilityHash }) {
  const proof = opaqueToken();
  await redis.set(`${PREFIX}:launcher-csrf:${capabilityHash}:${digest(proof)}`, 'active', 'EX', LAUNCHER_CSRF_TTL_SECONDS, 'NX');
  return proof;
}

export async function consumeLeadershipLauncherCsrf({ redis, capabilityHash, proof }) {
  if (typeof proof !== 'string' || proof.length < 32) return false;
  return await redis.getdel(`${PREFIX}:launcher-csrf:${capabilityHash}:${digest(proof)}`) === 'active';
}

export async function enforceLeadershipLaunchRateLimit({ redis, capabilityHash }) {
  const key = `${PREFIX}:launch-rate:${capabilityHash}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 15 * 60);
  return { allowed: count <= 24, remaining: Math.max(0, 24 - count) };
}

export async function issueRecruitingDemoCapability({ redis, req, launcher, now = new Date() }) {
  if (launcher?.synthetic_only !== true || !launcher.allowed_products?.includes('recruiting') || !launcher.launcher_scope_id) {
    throw new Error('LEADERSHIP_DEMO_RECRUITING_SCOPE_DENIED');
  }
  const capabilityToken = opaqueToken();
  const capabilityHash = digest(capabilityToken);
  const capability = {
    contract: 'recruiting_synthetic_demo_capability_v1',
    demo_scope_id: launcher.launcher_scope_id,
    subject_key: 'recruiting-darren-jordan-v1',
    allowed_product: 'recruiting',
    synthetic_only: true,
    issued_at: now.toISOString(),
    expires_at: new Date(now.getTime() + RECRUITING_DEMO_TTL_SECONDS * 1000).toISOString(),
    browser_binding_hash: clientKey(req),
  };
  await redis.set(`${PREFIX}:recruiting:${capabilityHash}`, JSON.stringify(capability), 'EX', RECRUITING_DEMO_TTL_SECONDS, 'NX');
  return {
    capability,
    capability_hash: capabilityHash,
    cookie: secureCookie(RECRUITING_DEMO_COOKIE, capabilityToken, RECRUITING_DEMO_TTL_SECONDS),
  };
}

export async function issueRecruitingDemoCapabilityForManager({
  redis,
  req,
  managerSubjectId,
  membershipId,
  masterControl,
  now = new Date(),
}) {
  if (masterControl !== true || !String(managerSubjectId || '').trim() || !String(membershipId || '').trim()) {
    throw new Error('RECRUITING_DEMO_MANAGER_AUTHORITY_DENIED');
  }
  return issueRecruitingDemoCapability({
    redis,
    req,
    now,
    launcher: {
      synthetic_only: true,
      allowed_products: ['recruiting'],
      launcher_scope_id: `recruiting_manager_${digest(`${membershipId}\n${managerSubjectId}`).slice(0, 24)}`,
    },
  });
}

export async function authenticateRecruitingDemoRequest({ redis, req, now = new Date() }) {
  const capabilityToken = parseCookies(req.headers?.cookie)[RECRUITING_DEMO_COOKIE];
  if (!capabilityToken) return { ok: false, code: 'RECRUITING_DEMO_CAPABILITY_REQUIRED', status: 401 };
  const capabilityHash = digest(capabilityToken);
  const raw = await redis.get(`${PREFIX}:recruiting:${capabilityHash}`);
  let capability = null;
  try { capability = raw ? JSON.parse(raw) : null; } catch { capability = null; }
  if (!capability || capability.contract !== 'recruiting_synthetic_demo_capability_v1'
    || capability.allowed_product !== 'recruiting' || capability.synthetic_only !== true
    || capability.subject_key !== 'recruiting-darren-jordan-v1' || !capability.demo_scope_id
    || capability.browser_binding_hash !== clientKey(req) || !isCurrent(capability.expires_at, now)) {
    return { ok: false, code: 'RECRUITING_DEMO_CAPABILITY_INVALID', status: 401 };
  }
  return { ok: true, capability, capability_hash: capabilityHash };
}

export async function issueRecruitingDemoCsrf({ redis, capabilityHash }) {
  const proof = opaqueToken();
  await redis.set(`${PREFIX}:recruiting-csrf:${capabilityHash}:${digest(proof)}`, 'active', 'EX', RECRUITING_DEMO_CSRF_TTL_SECONDS, 'NX');
  return proof;
}

export async function consumeRecruitingDemoCsrf({ redis, capabilityHash, proof }) {
  if (typeof proof !== 'string' || proof.length < 32) return false;
  return await redis.getdel(`${PREFIX}:recruiting-csrf:${capabilityHash}:${digest(proof)}`) === 'active';
}

export const LEADERSHIP_DEMO_AUTHORITY = Object.freeze({
  launcher_cookie: LAUNCHER_COOKIE,
  recruiting_demo_cookie: RECRUITING_DEMO_COOKIE,
  launcher_ttl_seconds: LAUNCHER_TTL_SECONDS,
  recruiting_demo_csrf_ttl_seconds: RECRUITING_DEMO_CSRF_TTL_SECONDS,
  recruiting_demo_ttl_seconds: RECRUITING_DEMO_TTL_SECONDS,
  launcher_authenticates_real_products: false,
  recruiting_demo_authenticates_real_recruiting: false,
});
