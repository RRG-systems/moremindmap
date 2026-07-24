import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeveloperAccessHandler } from '../api/internal/developer-access.js';
import { createDeveloperBinding, verifyDeveloperCapability } from '../api/internal/developer-access-security.js';
import {
  containsForbiddenSecurityMaterial,
  InMemorySecurityStateStore,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';

const scope = { tenant_id: 'tenant_api', profile_id: 'profile_api', business_id: 'business_api', subscriber_id: 'subscriber_api' };
const bindingInput = { subject_id: 'subject_api', scope, browser_id: 'browser_api', security_version: 1 };
const origin = 'http://localhost:5173';
const accessCode = ['SYN', 'THET', 'IC'].join('');
const env = {
  NODE_ENV: 'test',
  COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'true',
  COACH_CONNECT_SECURITY_HARDENING_ENABLED: 'true',
  COACH_CONNECT_SECURITY_SYNTHETIC_ONLY: 'true',
  COACH_CONNECT_SECURITY_EMERGENCY_DISABLED: 'false',
  COACH_CONNECT_SECURITY_PRODUCTION_TRAFFIC_ENABLED: 'false',
  COACH_CONNECT_DEVELOPER_ACCESS_CODE: accessCode,
  COACH_CONNECT_DEVELOPER_ACCESS_TOKEN_PEPPER: 'synthetic-api-pepper-at-least-thirty-two-bytes',
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS: 'test,preview',
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ORIGINS: origin,
  COACH_CONNECT_DEVELOPER_ACCESS_ISSUER: 'api-test-issuer',
  COACH_CONNECT_DEVELOPER_ACCESS_AUDIENCE: 'api-test-audience',
  COACH_CONNECT_DEVELOPER_ACCESS_ENVIRONMENT_ID: 'api-test-environment',
  COACH_CONNECT_DEVELOPER_ACCESS_KEY_ID: 'api-test-key-v1',
};

const response = () => ({
  headers: {},
  statusCode: 0,
  payload: null,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.payload = value; return this; },
});

function installEnv() {
  const runtime = globalThis.process.env;
  const previous = { ...runtime };
  Object.assign(runtime, env);
  return () => {
    for (const key of Object.keys(runtime)) if (!(key in previous)) delete runtime[key];
    Object.assign(runtime, previous);
  };
}

test('default handler fails closed because subscriber subject binding is unresolved', () => {
  const restore = installEnv();
  try {
    const handler = createDeveloperAccessHandler({ store: new InMemorySecurityStateStore() });
    const res = response();
    handler({ method: 'GET', headers: { origin } }, res);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { ok: false, error: 'authentication_required' });
  } finally { restore(); }
});

test('handler applies no-store security headers on denial and success', () => {
  const restore = installEnv();
  try {
    const store = new InMemorySecurityStateStore();
    let counter = 0;
    const handler = createDeveloperAccessHandler({ store, resolveSubjectBinding: () => bindingInput, randomToken: () => `api-opaque-token-${String(counter += 1).padStart(32, '0')}`, clock: () => 1000 });
    const denied = response();
    handler({ method: 'GET', headers: { origin: 'http://attacker.test' } }, denied);
    assert.equal(denied.statusCode, 403);
    const ok = response();
    handler({ method: 'GET', headers: { origin } }, ok);
    for (const res of [denied, ok]) {
      assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0');
      assert.equal(res.headers['Pragma'], 'no-cache');
      assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
      assert.equal(res.headers['Referrer-Policy'], 'no-referrer');
      assert.equal(res.headers['X-Frame-Options'], 'DENY');
      assert.match(res.headers['Permissions-Policy'], /camera=\(\)/);
      assert.doesNotMatch(JSON.stringify(res.payload), new RegExp(accessCode));
    }
    const audit = store.auditSnapshot();
    assert.ok(audit.some((event) => event.event_type === 'ORIGIN_DENIED' && event.failure_code === 'ORIGIN_VALIDATION_FAILED'));
    assert.equal(audit.some(containsForbiddenSecurityMaterial), false);
    assert.doesNotMatch(JSON.stringify(audit), new RegExp(accessCode));
    assert.doesNotMatch(JSON.stringify(audit), /subject_api|browser_api/);
  } finally { restore(); }
});

test('unlock requires same-origin one-time CSRF and returns no capability body', () => {
  const restore = installEnv();
  try {
    const store = new InMemorySecurityStateStore();
    let counter = 0;
    const handler = createDeveloperAccessHandler({ store, resolveSubjectBinding: () => bindingInput, randomToken: () => `api-opaque-token-${String(counter += 1).padStart(32, '0')}`, clock: () => 1000 });
    const bootstrap = response();
    handler({ method: 'GET', headers: { origin } }, bootstrap);
    assert.equal(bootstrap.statusCode, 403);
    const missing = response();
    handler({ method: 'POST', headers: { origin }, body: { access_code: accessCode } }, missing);
    assert.equal(missing.statusCode, 403);
    const granted = response();
    handler({ method: 'POST', headers: { origin, 'x-coach-connect-csrf': bootstrap.payload.csrf_token }, body: { access_code: accessCode }, trustedClientAddress: 'trusted-test' }, granted);
    assert.equal(granted.statusCode, 200);
    assert.equal('capability' in granted.payload, false);
    assert.match(granted.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
    const replay = response();
    handler({ method: 'POST', headers: { origin, 'x-coach-connect-csrf': bootstrap.payload.csrf_token }, body: { access_code: accessCode }, trustedClientAddress: 'trusted-test' }, replay);
    assert.equal(replay.statusCode, 403);
    const audit = store.auditSnapshot();
    assert.ok(audit.some((event) => event.event_type === 'CSRF_DENIED' && event.failure_code === 'CSRF_VALIDATION_FAILED'));
    assert.ok(audit.some((event) => event.event_type === 'CAPABILITY_ISSUED' && event.failure_code === null));
    assert.equal(audit.some(containsForbiddenSecurityMaterial), false);
    assert.doesNotMatch(JSON.stringify(audit), new RegExp(accessCode));
    assert.doesNotMatch(JSON.stringify(audit), /api-opaque-token/);
  } finally { restore(); }
});

test('copied capability fails under a different browser binding and revocation survives snapshot restart', () => {
  const restore = installEnv();
  try {
    const store = new InMemorySecurityStateStore();
    let counter = 0;
    const handler = createDeveloperAccessHandler({ store, resolveSubjectBinding: () => bindingInput, randomToken: () => `api-opaque-token-${String(counter += 1).padStart(32, '0')}`, clock: () => 1000 });
    const bootstrap = response(); handler({ method: 'GET', headers: { origin } }, bootstrap);
    const granted = response(); handler({ method: 'POST', headers: { origin, 'x-coach-connect-csrf': bootstrap.payload.csrf_token }, body: { access_code: accessCode } }, granted);
    const token = granted.headers['Set-Cookie'].split(';')[0].split('=').slice(1).join('=');
    const binding = createDeveloperBinding(bindingInput, globalThis.process.env);
    const copied = createDeveloperBinding({ ...bindingInput, browser_id: 'other_browser' }, globalThis.process.env);
    assert.equal(verifyDeveloperCapability({ token, env: globalThis.process.env, now: 2000, store, subject_binding: copied }).code, 'CAPABILITY_INVALID');
    const refresh = response(); handler({ method: 'GET', headers: { origin, cookie: `coach_connect_dev_capability=${token}`, 'x-coach-connect-csrf-intent': 'DELETE' } }, refresh);
    const revoked = response(); handler({ method: 'DELETE', headers: { origin, cookie: `coach_connect_dev_capability=${token}`, 'x-coach-connect-csrf': refresh.payload.csrf_token } }, revoked);
    assert.equal(revoked.statusCode, 200);
    const restarted = new InMemorySecurityStateStore(store.snapshot());
    assert.equal(verifyDeveloperCapability({ token, env: globalThis.process.env, now: 2000, store: restarted, subject_binding: binding }).code, 'CAPABILITY_REVOKED');
  } finally { restore(); }
});

test('preview denies the synthetic in-memory store and never claims deployment readiness', () => {
  const restore = installEnv();
  try {
    Object.assign(globalThis.process.env, { VERCEL_ENV: 'preview' });
    const handler = createDeveloperAccessHandler({ store: new InMemorySecurityStateStore(), resolveSubjectBinding: () => bindingInput });
    const res = response();
    handler({ method: 'GET', headers: { origin } }, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.error, 'request_denied');
  } finally { restore(); }
});
