import crypto from 'node:crypto';
import { canonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';
import {
  appendSecurityAudit,
  evaluateAbuseControls,
  exactSecurityScope,
  InMemorySecurityStateStore,
  safeSecurityClientError,
  validateCapabilityRecord,
} from '../../src/lib/intelligenceFabric/coachConnect/security/index.js';
import {
  canonicalSubjectToDeveloperBindingInput,
} from '../../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const runtimeEnvironment = globalThis.process?.env || {};
const RuntimeBuffer = globalThis.Buffer;

export const LOCAL_CAPABILITY_COOKIE_NAME = 'coach_connect_dev_capability';
export const SECURE_CAPABILITY_COOKIE_NAME = '__Host-coach_connect_dev_capability';
export const DEVELOPER_ACCESS_TTL_SECONDS = 15 * 60;

let defaultSecurityStore = new InMemorySecurityStateStore();

const text = (value, max = 512) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const runtimeName = (env) => text(env.VERCEL_ENV || env.NODE_ENV || 'local', 32).toLowerCase();
const nowIso = (now) => new Date(now).toISOString();
const deny = (code, status = safeSecurityClientError(code).status, extra = {}) => ({ ok: false, status, code, ...extra });

function timingSafeEqualText(left, right) {
  const a = RuntimeBuffer.from(left);
  const b = RuntimeBuffer.from(right);
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function keyedHash(value, secret, domain) {
  return crypto.createHmac('sha256', secret).update(canonicalJson({ domain, value })).digest('hex');
}

function securitySecret(env) {
  return text(env.COACH_CONNECT_DEVELOPER_ACCESS_TOKEN_PEPPER || env.COACH_CONNECT_DEVELOPER_ACCESS_SIGNING_SECRET, 4096);
}

function currentKeyId(env) {
  return text(env.COACH_CONNECT_DEVELOPER_ACCESS_KEY_ID || 'local-synthetic-key-v1', 160);
}

function allowedVerifyKeyIds(env) {
  return new Set([
    currentKeyId(env),
    ...text(env.COACH_CONNECT_DEVELOPER_ACCESS_PREVIOUS_VERIFY_KEY_IDS, 1024).split(',').map((value) => value.trim()).filter(Boolean),
  ]);
}

export function enabledEnvironment(env) {
  const runtime = runtimeName(env);
  if (runtime === 'production') return false;
  const allowed = text(env.COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS, 160)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(runtime);
}

export function developerAccessEnvironmentDecision(
  env = runtimeEnvironment,
  store = defaultSecurityStore,
  privateRuntimeDecision = null,
) {
  const runtime = runtimeName(env);
  if (runtime === 'production') {
    if (privateRuntimeDecision?.allowed !== true
      || privateRuntimeDecision.shared_state_evidence_class !== 'FUTURE_PRIVATE_LIVE'
      || privateRuntimeDecision.deployment_grade_security_state !== true
      || privateRuntimeDecision.no_local_fallback !== true) {
      return deny('CAPABILITY_ENVIRONMENT_DENIED', 403, { reason: 'PRIVATE_RUNTIME_AUTHORITY_REQUIRED' });
    }
    return {
      ok: true,
      runtime,
      description: {
        available: true,
        deployment_grade: true,
        no_local_fallback: true,
        authority_source: 'PRIVATE_RUNTIME_BRIDGE',
      },
    };
  }
  if (env.COACH_CONNECT_DEVELOPER_ACCESS_ENABLED !== 'true') return deny('CAPABILITY_INVALID', 404, { reason: 'DEVELOPER_ACCESS_DISABLED' });
  if (env.COACH_CONNECT_SECURITY_HARDENING_ENABLED !== 'true'
    || env.COACH_CONNECT_SECURITY_SYNTHETIC_ONLY !== 'true'
    || env.COACH_CONNECT_SECURITY_EMERGENCY_DISABLED !== 'false'
    || env.COACH_CONNECT_SECURITY_PRODUCTION_TRAFFIC_ENABLED === 'true') {
    return deny('CAPABILITY_INVALID', 404, { reason: 'SECURITY_HARDENING_INACTIVE' });
  }
  if (!enabledEnvironment(env)) return deny('CAPABILITY_ENVIRONMENT_DENIED', 403);
  const description = store?.describe?.();
  if (!description?.available) return deny('CAPABILITY_INVALID', 503, { reason: 'SECURITY_STATE_UNAVAILABLE' });
  if (['preview', 'staging'].includes(runtimeName(env)) && description.deployment_grade !== true) {
    return deny('CAPABILITY_ENVIRONMENT_DENIED', 403, { reason: 'SHARED_SECURITY_STATE_UNRESOLVED' });
  }
  return { ok: true, runtime: runtimeName(env), description };
}

export function developerAccessEnabled(env = runtimeEnvironment, store = defaultSecurityStore, privateRuntimeDecision = null) {
  return developerAccessEnvironmentDecision(env, store, privateRuntimeDecision).ok === true;
}

export function allowedDeveloperAccessOrigins(env = runtimeEnvironment) {
  return text(env.COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ORIGINS, 2048)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function createDeveloperBinding({ subject_id, scope, browser_id, security_version = 1 }, env = runtimeEnvironment) {
  const secret = securitySecret(env);
  if (!text(subject_id, 256) || !exactSecurityScope(scope) || !text(browser_id, 256) || secret.length < 32 || !Number.isInteger(security_version) || security_version < 1) return null;
  return {
    subject_binding_hash: keyedHash(subject_id, secret, 'developer_subject'),
    scope_binding_hash: keyedHash(scope, secret, 'developer_scope'),
    browser_binding_hash: keyedHash(browser_id, secret, 'developer_browser'),
    scope: structuredClone(scope),
    security_version,
  };
}

export function createDeveloperBindingFromCanonicalContext({
  subject,
  authenticated_session,
}, env = runtimeEnvironment) {
  const input = canonicalSubjectToDeveloperBindingInput({
    subject,
    session: authenticated_session,
  });
  return input ? createDeveloperBinding(input, env) : null;
}

function tokenHash(token, env) {
  const secret = securitySecret(env);
  return secret.length >= 32 && text(token, 4096) ? keyedHash(token, secret, 'developer_capability_token') : '';
}

function capabilityIssuer(env) {
  return text(env.COACH_CONNECT_DEVELOPER_ACCESS_ISSUER, 160);
}

function capabilityAudience(env) {
  return text(env.COACH_CONNECT_DEVELOPER_ACCESS_AUDIENCE, 160);
}

function environmentId(env) {
  return text(env.COACH_CONNECT_DEVELOPER_ACCESS_ENVIRONMENT_ID, 160);
}

function auditCapabilityResult({
  result,
  store,
  now,
  subject_binding = null,
  event_type = null,
  capability_id = null,
  correlation_id = 'developer-access-capability',
}) {
  const failure_code = result.ok === true || result.valid === true ? null : result.code || 'CAPABILITY_INVALID';
  appendSecurityAudit(store, {
    event_type: event_type || (failure_code ? 'CAPABILITY_DENIED' : 'CAPABILITY_ISSUED'),
    decision: failure_code ? 'DENIED' : 'ALLOWED',
    failure_code,
    occurred_at: nowIso(now),
    correlation_id,
    scope: subject_binding?.scope || null,
    resource: capability_id ? { resource_type: 'developer_capability', resource_id: capability_id } : null,
    details: {
      purpose: 'temporary_internal_subscription_entitlement',
      reason_codes: failure_code ? [failure_code] : [],
    },
  });
  return result;
}

export function evaluateDeveloperAccess({
  req,
  submittedCode,
  env = runtimeEnvironment,
  now = Date.now(),
  store = defaultSecurityStore,
  subject_binding,
  origin_decision,
  csrf_decision,
  private_runtime_decision = null,
  random_token = () => crypto.randomBytes(32).toString('base64url'),
}) {
  const environment = developerAccessEnvironmentDecision(env, store, private_runtime_decision);
  if (!environment.ok) return auditCapabilityResult({ result: environment, store, now, subject_binding });
  if (origin_decision?.allowed !== true) return auditCapabilityResult({ result: deny('ORIGIN_VALIDATION_FAILED', 403), store, now, subject_binding, event_type: 'ORIGIN_DENIED' });
  if (csrf_decision?.allowed !== true) return auditCapabilityResult({ result: deny('CSRF_VALIDATION_FAILED', 403), store, now, subject_binding, event_type: 'CSRF_DENIED' });
  if (!subject_binding?.subject_binding_hash
    || !subject_binding?.scope_binding_hash
    || !subject_binding?.browser_binding_hash
    || !exactSecurityScope(subject_binding.scope)) return auditCapabilityResult({ result: deny('AUTHENTICATION_FAILED', 401), store, now, subject_binding });
  const expected = text(env.COACH_CONNECT_DEVELOPER_ACCESS_CODE);
  const secret = securitySecret(env);
  const issuer = capabilityIssuer(env);
  const audience = capabilityAudience(env);
  const envId = environmentId(env);
  if (!expected || secret.length < 32 || !issuer || !audience || !envId || !currentKeyId(env)) {
    return auditCapabilityResult({ result: deny('CAPABILITY_INVALID', 503, { reason: 'CONFIGURATION_UNAVAILABLE' }), store, now, subject_binding });
  }
  const abuse = evaluateAbuseControls({
    store,
    policy: 'developer_unlock',
    now,
    key_id: currentKeyId(env),
    dimensions: {
      subject: subject_binding.subject_binding_hash,
      browser: subject_binding.browser_binding_hash,
      trusted_network: req?.trustedClientAddress || null,
    },
  });
  if (!abuse.allowed) return auditCapabilityResult({ result: deny('RATE_LIMITED', 429, { retry_after_ms: abuse.retry_after_ms }), store, now, subject_binding, event_type: 'RATE_LIMITED' });
  if (!timingSafeEqualText(text(submittedCode), expected)) return auditCapabilityResult({ result: deny('CAPABILITY_INVALID', 401), store, now, subject_binding });
  const capability = random_token();
  if (typeof capability !== 'string' || capability.length < 32) return auditCapabilityResult({ result: deny('CAPABILITY_INVALID', 503), store, now, subject_binding });
  const token_hash = tokenHash(capability, env);
  const issued_at = nowIso(now);
  const expires_at = nowIso(now + DEVELOPER_ACCESS_TTL_SECONDS * 1000);
  const record = {
    schema_version: '1.0.0',
    capability_id: `developer_capability_${token_hash.slice(0, 32)}`,
    token_hash,
    purpose: 'temporary_internal_subscription_entitlement',
    subject_binding_hash: subject_binding.subject_binding_hash,
    scope_binding_hash: subject_binding.scope_binding_hash,
    browser_binding_hash: subject_binding.browser_binding_hash,
    environment_id: envId,
    issuer,
    audience,
    issued_at,
    not_before: issued_at,
    expires_at,
    last_used_at: null,
    security_version: subject_binding.security_version,
    key_id: currentKeyId(env),
    status: 'ACTIVE',
    revoked_at: null,
    revocation_reason: null,
    rotation_parent_id: null,
    billing_evidence: false,
    stripe_subscription_created: false,
    admin_authority: false,
    coach_authority: false,
    operator_authority: false,
    canonical_mutation_authority: false,
  };
  const validation = validateCapabilityRecord(record);
  if (!validation.valid) return auditCapabilityResult({ result: deny('CAPABILITY_INVALID', 503), store, now, subject_binding });
  const saved = store.saveCapability(record);
  const result = saved.ok
    ? { ok: true, status: 200, capability, maxAge: DEVELOPER_ACCESS_TTL_SECONDS, record }
    : deny(saved.code || 'CAPABILITY_INVALID', 503);
  return auditCapabilityResult({ result, store, now, subject_binding, capability_id: record.capability_id });
}

export function verifyDeveloperCapability({
  token,
  env = runtimeEnvironment,
  now = Date.now(),
  store = defaultSecurityStore,
  subject_binding,
  private_runtime_decision = null,
}) {
  const environment = developerAccessEnvironmentDecision(env, store, private_runtime_decision);
  if (!environment.ok) return auditCapabilityResult({ result: { valid: false, code: environment.code }, store, now, subject_binding });
  if (!subject_binding?.subject_binding_hash || !subject_binding?.scope_binding_hash || !subject_binding?.browser_binding_hash) {
    return auditCapabilityResult({ result: { valid: false, code: 'AUTHENTICATION_FAILED' }, store, now, subject_binding });
  }
  const token_hash = tokenHash(token, env);
  if (!token_hash) return auditCapabilityResult({ result: { valid: false, code: 'CAPABILITY_INVALID' }, store, now, subject_binding });
  const found = store.getCapabilityByTokenHash(token_hash);
  if (!found.ok || found.status !== 'FOUND') return auditCapabilityResult({ result: { valid: false, code: 'CAPABILITY_INVALID' }, store, now, subject_binding });
  const record = found.record;
  const validation = validateCapabilityRecord(record);
  if (!validation.valid) return auditCapabilityResult({ result: { valid: false, code: 'CAPABILITY_INVALID' }, store, now, subject_binding, capability_id: record.capability_id });
  let code = null;
  if (record.status === 'REVOKED' || record.status === 'ROTATED') code = 'CAPABILITY_REVOKED';
  else if (Date.parse(record.not_before) > now || Date.parse(record.expires_at) <= now) code = 'CAPABILITY_EXPIRED';
  else if (record.subject_binding_hash !== subject_binding.subject_binding_hash
    || record.scope_binding_hash !== subject_binding.scope_binding_hash
    || record.browser_binding_hash !== subject_binding.browser_binding_hash
    || record.security_version !== subject_binding.security_version) code = 'CAPABILITY_INVALID';
  else if (record.environment_id !== environmentId(env)
    || record.issuer !== capabilityIssuer(env)
    || record.audience !== capabilityAudience(env)
    || !allowedVerifyKeyIds(env).has(record.key_id)) code = 'CAPABILITY_ENVIRONMENT_DENIED';
  return code
    ? auditCapabilityResult({ result: { valid: false, code }, store, now, subject_binding, capability_id: record.capability_id })
    : {
      valid: true,
      code: null,
      record,
      claims: {
        purpose: record.purpose,
        expires_at: Date.parse(record.expires_at),
        subject_binding_hash: record.subject_binding_hash,
        scope_binding_hash: record.scope_binding_hash,
        browser_binding_hash: record.browser_binding_hash,
        security_version: record.security_version,
      },
    };
}

export function revokeDeveloperCapability({
  token,
  env = runtimeEnvironment,
  now = Date.now(),
  store = defaultSecurityStore,
  subject_binding,
  reason_code = 'USER_REVOKED',
  private_runtime_decision = null,
}) {
  const verified = verifyDeveloperCapability({
    token,
    env,
    now,
    store,
    subject_binding,
    private_runtime_decision,
  });
  if (!verified.valid) return { ok: false, code: verified.code };
  const revoked = store.revokeCapability({ token_hash: verified.record.token_hash, revoked_at: nowIso(now), reason_code });
  const result = revoked.ok ? { ok: true, capability_id: verified.record.capability_id } : { ok: false, code: revoked.code || 'CAPABILITY_INVALID' };
  return auditCapabilityResult({
    result,
    store,
    now,
    subject_binding,
    event_type: revoked.ok ? 'CAPABILITY_REVOKED' : 'CAPABILITY_DENIED',
    capability_id: verified.record.capability_id,
  });
}

export function readDeveloperCapabilityCookie(cookieHeader = '') {
  const entries = String(cookieHeader).split(';').map((item) => item.trim()).filter(Boolean);
  const local = entries.filter((item) => item.startsWith(`${LOCAL_CAPABILITY_COOKIE_NAME}=`));
  const secure = entries.filter((item) => item.startsWith(`${SECURE_CAPABILITY_COOKIE_NAME}=`));
  if (local.length + secure.length !== 1) return { ok: false, code: 'CAPABILITY_INVALID', token: '' };
  const selected = (secure[0] || local[0]);
  const expectedName = secure[0] ? SECURE_CAPABILITY_COOKIE_NAME : LOCAL_CAPABILITY_COOKIE_NAME;
  return { ok: true, name: expectedName, token: selected.slice(expectedName.length + 1) };
}

export function developerCapabilityFromCookie(cookieHeader = '') {
  const result = readDeveloperCapabilityCookie(cookieHeader);
  return result.ok ? result.token : '';
}

export function secureCookieRequired({ req, env = runtimeEnvironment }) {
  const runtime = runtimeName(env);
  if (runtime === 'preview' || text(req?.headers?.['x-forwarded-proto'], 16).toLowerCase() === 'https') return true;
  return !['local', 'development', 'test'].includes(runtime);
}

export function capabilityCookie(token, maxAge, context = {}) {
  const secure = secureCookieRequired(context);
  const name = secure ? SECURE_CAPABILITY_COOKIE_NAME : LOCAL_CAPABILITY_COOKIE_NAME;
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function revokeCapabilityCookie(context = {}) {
  const secure = secureCookieRequired(context);
  const name = secure ? SECURE_CAPABILITY_COOKIE_NAME : LOCAL_CAPABILITY_COOKIE_NAME;
  return `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function getDefaultDeveloperSecurityStore() {
  return defaultSecurityStore;
}

export function resetDeveloperAccessThrottleForTests() {
  defaultSecurityStore = new InMemorySecurityStateStore();
  return defaultSecurityStore;
}
