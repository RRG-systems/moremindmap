import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDurableRecord, validateDurableRecord } from '../src/lib/intelligenceFabric/coachConnect/liveSession/durable/contracts.js';
import { capabilityCookie, evaluateDeveloperAccess, resetDeveloperAccessThrottleForTests, verifyDeveloperCapability } from '../api/internal/developer-access-security.js';
import developerAccessHandler from '../api/internal/developer-access.js';
import { resolveSubscriptionEntitlement } from '../api/internal/subscription-entitlement.js';

const scope = { tenant_id: 'tenant_synthetic', profile_id: 'profile_synthetic', business_id: 'business_synthetic', subscriber_id: 'subscriber_synthetic', session_id: 'session_synthetic' };

test('durable records require exact scope and detect corruption', () => {
  const record = buildDurableRecord({ kind: 'checkpoint', object_id: 'cp1', scope, value: { sequence: 1 }, correlation_id: scope.session_id, recorded_at: '2026-07-22T00:00:00.000Z' });
  assert.equal(validateDurableRecord(record).valid, true);
  assert.equal(buildDurableRecord({ kind: 'checkpoint', object_id: 'cp1', scope: { tenant_id: 'x' }, value: {}, correlation_id: 'x', recorded_at: '2026-07-22T00:00:00.000Z' }), null);
  assert.equal(validateDurableRecord({ ...record, value: { sequence: 2 } }).code, 'CORRUPTED_RECORD');
});

test('developer access is default-off, production-denied, timing-safe, signed, short-lived, and throttled', () => {
  resetDeveloperAccessThrottleForTests();
  const code = ['SUB', 'DEV', '1'].join('');
  const base = { COACH_CONNECT_DEVELOPER_ACCESS_CODE: code, COACH_CONNECT_DEVELOPER_ACCESS_SIGNING_SECRET: 'synthetic-signing-secret-at-least-32-bytes', COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS: 'test' };
  const req = { headers: {}, socket: { remoteAddress: 'synthetic-test' } };
  assert.equal(evaluateDeveloperAccess({ req, submittedCode: code, env: base }).code, 'developer_access_disabled');
  assert.equal(evaluateDeveloperAccess({ req, submittedCode: code, env: { ...base, COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'true', NODE_ENV: 'production' } }).code, 'environment_not_allowed');
  const env = { ...base, COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'true', NODE_ENV: 'test' };
  const granted = evaluateDeveloperAccess({ req, submittedCode: code, env, now: 1000 });
  assert.equal(granted.ok, true); assert.equal(granted.maxAge, 900);
  assert.equal(verifyDeveloperCapability({ token: granted.capability, env, now: 2000 }).valid, true);
  assert.equal(verifyDeveloperCapability({ token: granted.capability, env, now: 902_000 }).valid, false);
  resetDeveloperAccessThrottleForTests();
  for (let index = 0; index < 5; index += 1) assert.equal(evaluateDeveloperAccess({ req, submittedCode: 'wrong', env, now: 5000 }).status, 401);
  assert.equal(evaluateDeveloperAccess({ req, submittedCode: 'wrong', env, now: 5000 }).status, 429);
});

test('developer endpoint issues only an HttpOnly capability and supports revocation', () => {
  const runtimeEnv = globalThis.process.env, previous = { ...runtimeEnv };
  Object.assign(runtimeEnv, { COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'true', COACH_CONNECT_DEVELOPER_ACCESS_CODE: ['SUB', 'DEV', '1'].join(''), COACH_CONNECT_DEVELOPER_ACCESS_SIGNING_SECRET: 'synthetic-signing-secret-at-least-32-bytes', COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS: 'test', NODE_ENV: 'test' });
  resetDeveloperAccessThrottleForTests();
  const response = () => ({ headers: {}, statusCode: 0, payload: null, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; } });
  const granted = response(); developerAccessHandler({ method: 'POST', body: { access_code: ['SUB', 'DEV', '1'].join('') }, headers: {}, socket: { remoteAddress: 'endpoint-test' } }, granted);
  assert.equal(granted.statusCode, 200); assert.match(granted.headers['Set-Cookie'], /HttpOnly/); assert.doesNotMatch(granted.headers['Set-Cookie'], /Secure/); assert.equal('capability' in granted.payload, false);
  const token = granted.headers['Set-Cookie'].split(';')[0].split('=').slice(1).join('=');
  const cookie = `coach_connect_dev_capability=${token}`;
  const refreshed = response(); developerAccessHandler({ method: 'GET', headers: { cookie } }, refreshed);
  assert.equal(refreshed.statusCode, 200); assert.equal(refreshed.payload.entitlement.access_type, 'more_monthly_intelligence'); assert.equal(refreshed.payload.entitlement.billing_evidence, false); assert.equal(refreshed.payload.entitlement.stripe_subscription_created, false);
  const revoked = response(); developerAccessHandler({ method: 'DELETE', headers: { cookie: `coach_connect_dev_capability=${token}` } }, revoked);
  assert.equal(revoked.statusCode, 200); assert.match(revoked.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal(verifyDeveloperCapability({ token, env: runtimeEnv }).valid, false);
  const denied = response(); developerAccessHandler({ method: 'GET', headers: { cookie } }, denied); assert.equal(denied.statusCode, 403);
  for (const key of Object.keys(runtimeEnv)) if (!(key in previous)) delete runtimeEnv[key];
  Object.assign(runtimeEnv, previous);
});

test('subscription entitlement boundary denies expired disabled and wrong-environment capabilities and preview cookies stay secure', () => {
  resetDeveloperAccessThrottleForTests();
  const code = ['SUB', 'DEV', '1'].join(''), secret = 'synthetic-signing-secret-at-least-32-bytes';
  const req = { headers: {}, socket: { remoteAddress: 'entitlement-test' } }, env = { COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'true', COACH_CONNECT_DEVELOPER_ACCESS_CODE: code, COACH_CONNECT_DEVELOPER_ACCESS_SIGNING_SECRET: secret, COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS: 'test,preview', NODE_ENV: 'test' };
  const issued = evaluateDeveloperAccess({ req, submittedCode: code, env, now: 1000 });
  const cookieReq = { headers: { cookie: `coach_connect_dev_capability=${issued.capability}` } };
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env, now: 2000 }).allowed, true);
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env, now: 902_000 }).allowed, false);
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env: { ...env, COACH_CONNECT_DEVELOPER_ACCESS_ENABLED: 'false' }, now: 2000 }).code, 'developer_access_disabled');
  assert.equal(resolveSubscriptionEntitlement({ req: cookieReq, env: { ...env, NODE_ENV: 'staging' }, now: 2000 }).code, 'environment_not_allowed');
  assert.match(capabilityCookie('opaque', 900, { req, env: { ...env, VERCEL_ENV: 'preview' } }), /; Secure/);
  assert.doesNotMatch(capabilityCookie('opaque', 900, { req, env }), /; Secure/);
});
