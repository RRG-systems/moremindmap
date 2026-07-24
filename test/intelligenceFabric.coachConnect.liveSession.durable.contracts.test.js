import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDurableRecord, validateDurableRecord } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/contracts.js';
import { capabilityCookie, createDeveloperBinding, evaluateDeveloperAccess, verifyDeveloperCapability } from '../api/internal/developer-access-security.js';
import { createDeveloperAccessHandler } from '../api/internal/developer-access.js';
import { resolveSubscriptionEntitlement } from '../api/internal/subscription-entitlement.js';
import { InMemorySecurityStateStore } from '../src/lib/intelligenceFabric/coachConnect/security/index.js';

const scope = { tenant_id: 'tenant_synthetic', profile_id: 'profile_synthetic', business_id: 'business_synthetic', subscriber_id: 'subscriber_synthetic', session_id: 'session_synthetic' };
const rawBinding = { subject_id: 'subject_synthetic', scope, browser_id: 'browser_synthetic', security_version: 1 };
const code = ['SUB', 'DEV', '1'].join('');
const baseEnv = {
  NODE_ENV: 'test',
  COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'true',
  COACH_CONNECT_SECURITY_HARDENING_ENABLED: 'true',
  COACH_CONNECT_SECURITY_SYNTHETIC_ONLY: 'true',
  COACH_CONNECT_SECURITY_EMERGENCY_DISABLED: 'false',
  COACH_CONNECT_SECURITY_PRODUCTION_TRAFFIC_ENABLED: 'false',
  COACH_CONNECT_DEVELOPER_ACCESS_CODE: code,
  COACH_CONNECT_DEVELOPER_ACCESS_TOKEN_PEPPER: 'synthetic-signing-secret-at-least-32-bytes',
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS: 'test,preview',
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ORIGINS: 'http://localhost:5173',
  COACH_CONNECT_DEVELOPER_ACCESS_ISSUER: 'coach-connect-test',
  COACH_CONNECT_DEVELOPER_ACCESS_AUDIENCE: 'monthly-intelligence-test',
  COACH_CONNECT_DEVELOPER_ACCESS_ENVIRONMENT_ID: 'test-environment',
  COACH_CONNECT_DEVELOPER_ACCESS_KEY_ID: 'test-key-v1',
};
const trustedRequest = { headers: { origin: 'http://localhost:5173' }, trustedClientAddress: 'synthetic-network' };

test('durable records require exact scope and detect corruption', () => {
  const record = buildDurableRecord({ kind: 'checkpoint', object_id: 'cp1', scope, value: { sequence: 1 }, correlation_id: scope.session_id, recorded_at: '2026-07-22T00:00:00.000Z' });
  assert.equal(validateDurableRecord(record).valid, true);
  assert.equal(buildDurableRecord({ kind: 'checkpoint', object_id: 'cp1', scope: { tenant_id: 'x' }, value: {}, correlation_id: 'x', recorded_at: '2026-07-22T00:00:00.000Z' }), null);
  assert.equal(validateDurableRecord({ ...record, value: { sequence: 2 } }).code, 'CORRUPTED_RECORD');
});

test('developer access is default-off, production-denied, bound, opaque, short-lived, and throttled', () => {
  const inactiveStore = new InMemorySecurityStateStore();
  assert.equal(evaluateDeveloperAccess({ req: trustedRequest, submittedCode: code, env: {}, store: inactiveStore }).code, 'CAPABILITY_INVALID');
  assert.equal(evaluateDeveloperAccess({ req: trustedRequest, submittedCode: code, env: { ...baseEnv, NODE_ENV: 'production' }, store: inactiveStore }).code, 'CAPABILITY_ENVIRONMENT_DENIED');
  const store = new InMemorySecurityStateStore();
  const binding = createDeveloperBinding(rawBinding, baseEnv);
  const granted = evaluateDeveloperAccess({ req: trustedRequest, submittedCode: code, env: baseEnv, now: 1000, store, subject_binding: binding, origin_decision: { allowed: true }, csrf_decision: { allowed: true }, random_token: () => 'opaque-capability-token-at-least-thirty-two-characters' });
  assert.equal(granted.ok, true); assert.equal(granted.maxAge, 900);
  assert.equal('raw_token' in granted.record, false);
  assert.equal(verifyDeveloperCapability({ token: granted.capability, env: baseEnv, now: 2000, store, subject_binding: binding }).valid, true);
  assert.equal(verifyDeveloperCapability({ token: granted.capability, env: baseEnv, now: 902_000, store, subject_binding: binding }).code, 'CAPABILITY_EXPIRED');
  const throttleStore = new InMemorySecurityStateStore();
  for (let index = 0; index < 5; index += 1) assert.equal(evaluateDeveloperAccess({ req: trustedRequest, submittedCode: 'wrong', env: baseEnv, now: 5000, store: throttleStore, subject_binding: binding, origin_decision: { allowed: true }, csrf_decision: { allowed: true } }).status, 401);
  assert.equal(evaluateDeveloperAccess({ req: trustedRequest, submittedCode: 'wrong', env: baseEnv, now: 5000, store: throttleStore, subject_binding: binding, origin_decision: { allowed: true }, csrf_decision: { allowed: true } }).status, 429);
});

test('developer endpoint issues only an HttpOnly capability and supports revocation', () => {
  const runtimeEnv = globalThis.process.env, previous = { ...runtimeEnv };
  Object.assign(runtimeEnv, baseEnv);
  const store = new InMemorySecurityStateStore();
  let tokenCounter = 0;
  const developerAccessHandler = createDeveloperAccessHandler({ store, resolveSubjectBinding: () => rawBinding, randomToken: () => `opaque-synthetic-token-${String(tokenCounter += 1).padStart(32, '0')}`, clock: () => 2000 });
  const response = () => ({ headers: {}, statusCode: 0, payload: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } });
  const bootstrap = response(); developerAccessHandler({ method: 'GET', headers: { origin: 'http://localhost:5173' } }, bootstrap);
  assert.equal(bootstrap.statusCode, 403); assert.equal(typeof bootstrap.payload.csrf_token, 'string');
  const granted = response(); developerAccessHandler({ method: 'POST', body: { access_code: code }, headers: { origin: 'http://localhost:5173', 'x-coach-connect-csrf': bootstrap.payload.csrf_token }, trustedClientAddress: 'endpoint-test' }, granted);
  assert.equal(granted.statusCode, 200); assert.match(granted.headers['Set-Cookie'], /HttpOnly/); assert.doesNotMatch(granted.headers['Set-Cookie'], /Secure/); assert.equal('capability' in granted.payload, false);
  const token = granted.headers['Set-Cookie'].split(';')[0].split('=').slice(1).join('=');
  const cookie = `coach_connect_dev_capability=${token}`;
  const refreshed = response(); developerAccessHandler({ method: 'GET', headers: { cookie, origin: 'http://localhost:5173', 'x-coach-connect-csrf-intent': 'DELETE' } }, refreshed);
  assert.equal(refreshed.statusCode, 200); assert.equal(refreshed.payload.entitlement.access_type, 'more_monthly_intelligence'); assert.equal(refreshed.payload.entitlement.billing_evidence, false); assert.equal(refreshed.payload.entitlement.stripe_subscription_created, false);
  const revoked = response(); developerAccessHandler({ method: 'DELETE', headers: { cookie, origin: 'http://localhost:5173', 'x-coach-connect-csrf': refreshed.payload.csrf_token } }, revoked);
  assert.equal(revoked.statusCode, 200); assert.match(revoked.headers['Set-Cookie'], /Max-Age=0/);
  const binding = createDeveloperBinding(rawBinding, runtimeEnv);
  assert.equal(verifyDeveloperCapability({ token, env: runtimeEnv, store, subject_binding: binding }).code, 'CAPABILITY_REVOKED');
  const denied = response(); developerAccessHandler({ method: 'GET', headers: { cookie, origin: 'http://localhost:5173' } }, denied); assert.equal(denied.statusCode, 403);
  for (const key of Object.keys(runtimeEnv)) if (!(key in previous)) delete runtimeEnv[key];
  Object.assign(runtimeEnv, previous);
});

test('subscription entitlement boundary denies expired disabled and wrong-environment capabilities and preview cookies stay secure', () => {
  const store = new InMemorySecurityStateStore();
  const binding = createDeveloperBinding(rawBinding, baseEnv);
  const issued = evaluateDeveloperAccess({ req: trustedRequest, submittedCode: code, env: baseEnv, now: 1000, store, subject_binding: binding, origin_decision: { allowed: true }, csrf_decision: { allowed: true }, random_token: () => 'opaque-entitlement-token-at-least-thirty-two-characters' });
  const cookieReq = { headers: { cookie: `coach_connect_dev_capability=${issued.capability}` } };
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env: baseEnv, now: 2000, store, subject_binding: binding }).allowed, true);
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env: baseEnv, now: 902_000, store, subject_binding: binding }).allowed, false);
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env: { ...baseEnv, COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'false' }, now: 2000, store, subject_binding: binding }).code, 'CAPABILITY_INVALID');
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env: { ...baseEnv, NODE_ENV: 'staging' }, now: 2000, store, subject_binding: binding }).code, 'CAPABILITY_ENVIRONMENT_DENIED');
  assert.match(capabilityCookie('opaque', 900, { req: trustedRequest, env: { ...baseEnv, VERCEL_ENV: 'preview' } }), /; Secure/);
  assert.doesNotMatch(capabilityCookie('opaque', 900, { req: trustedRequest, env: baseEnv }), /; Secure/);
});
