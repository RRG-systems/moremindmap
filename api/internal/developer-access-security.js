import crypto from 'node:crypto';

const runtimeEnvironment = globalThis.process?.env || {};
const RuntimeBuffer = globalThis.Buffer;

const COOKIE_NAME = 'coach_connect_dev_capability';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const TTL_SECONDS = 15 * 60;
const attempts = new Map();
const revokedNonces = new Set();

function text(value, max = 512) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function enabledEnvironment(env) {
  const runtime = text(env.VERCEL_ENV || env.NODE_ENV || 'local', 32).toLowerCase();
  if (runtime === 'production') return false;
  const allowed = text(env.COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS || 'local,development,preview,test', 160).split(',').map((item) => item.trim().toLowerCase());
  return allowed.includes(runtime);
}
export function developerAccessEnabled(env = runtimeEnvironment) { return env.COACH_CONNECT_DEVELOPER_ACCESS_ENABLED === 'true' && enabledEnvironment(env); }
function timingSafeEqualText(left, right) {
  const a = RuntimeBuffer.from(left), b = RuntimeBuffer.from(right);
  if (a.length !== b.length) { crypto.timingSafeEqual(a, a); return false; }
  return crypto.timingSafeEqual(a, b);
}
function signature(payload, secret) { return crypto.createHmac('sha256', secret).update(payload).digest('base64url'); }
function clientKey(req) { return text(req.headers?.['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown', 96); }
function throttled(key, now) {
  const prior = attempts.get(key), entry = !prior || now - prior.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : prior;
  entry.count += 1; attempts.set(key, entry); return entry.count > MAX_ATTEMPTS;
}

export function evaluateDeveloperAccess({ req, submittedCode, env = runtimeEnvironment, now = Date.now() }) {
  if (env.COACH_CONNECT_DEVELOPER_ACCESS_ENABLED !== 'true') return { ok: false, status: 404, code: 'developer_access_disabled' };
  if (!enabledEnvironment(env)) return { ok: false, status: 403, code: 'environment_not_allowed' };
  const expected = text(env.COACH_CONNECT_DEVELOPER_ACCESS_CODE);
  const signingSecret = text(env.COACH_CONNECT_DEVELOPER_ACCESS_SIGNING_SECRET, 2048);
  if (!expected || signingSecret.length < 32) return { ok: false, status: 503, code: 'developer_access_configuration_unavailable' };
  if (throttled(clientKey(req), now)) return { ok: false, status: 429, code: 'too_many_attempts' };
  if (!timingSafeEqualText(text(submittedCode), expected)) return { ok: false, status: 401, code: 'invalid_developer_access' };
  const payload = RuntimeBuffer.from(JSON.stringify({ purpose: 'temporary_internal_subscription_entitlement', issued_at: now, expires_at: now + TTL_SECONDS * 1000, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
  return { ok: true, status: 200, capability: `${payload}.${signature(payload, signingSecret)}`, maxAge: TTL_SECONDS };
}

export function verifyDeveloperCapability({ token, env = runtimeEnvironment, now = Date.now() }) {
  const signingSecret = text(env.COACH_CONNECT_DEVELOPER_ACCESS_SIGNING_SECRET, 2048), [payload, supplied] = text(token, 4096).split('.');
  if (!payload || !supplied || signingSecret.length < 32 || !timingSafeEqualText(supplied, signature(payload, signingSecret))) return { valid: false };
  try { const claims = JSON.parse(RuntimeBuffer.from(payload, 'base64url').toString('utf8')); return { valid: claims.purpose === 'temporary_internal_subscription_entitlement' && claims.expires_at > now && !revokedNonces.has(claims.nonce), claims }; } catch { return { valid: false }; }
}

export function revokeDeveloperCapability(token, env = runtimeEnvironment) { const result = verifyDeveloperCapability({ token, env }); if (!result.claims?.nonce) return false; revokedNonces.add(result.claims.nonce); return true; }
export function developerCapabilityFromCookie(cookieHeader = '') { const part = String(cookieHeader).split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`)); return part ? part.slice(COOKIE_NAME.length + 1) : ''; }

export function secureCookieRequired({ req, env = runtimeEnvironment }) {
  const runtime = text(env.VERCEL_ENV || env.NODE_ENV || 'local', 32).toLowerCase();
  if (runtime === 'preview' || text(req?.headers?.['x-forwarded-proto'], 16).toLowerCase() === 'https') return true;
  return !['local', 'development', 'test'].includes(runtime);
}
export function capabilityCookie(token, maxAge, context = {}) { return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookieRequired(context) ? '; Secure' : ''}`; }
export function revokeCapabilityCookie(context = {}) { return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureCookieRequired(context) ? '; Secure' : ''}`; }
export function resetDeveloperAccessThrottleForTests() { attempts.clear(); revokedNonces.clear(); }
