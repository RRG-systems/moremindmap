import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeveloperAccessHandler } from '../api/internal/developer-access.js';
import {
  createDeveloperBindingFromCanonicalContext,
} from '../api/internal/developer-access-security.js';
import {
  InMemorySecurityStateStore,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';

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
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ENVIRONMENTS: 'test',
  COACH_CONNECT_DEVELOPER_ACCESS_ALLOWED_ORIGINS: origin,
  COACH_CONNECT_DEVELOPER_ACCESS_ISSUER: 'api-test-issuer',
  COACH_CONNECT_DEVELOPER_ACCESS_AUDIENCE: 'api-test-audience',
  COACH_CONNECT_DEVELOPER_ACCESS_ENVIRONMENT_ID: 'api-test-environment',
  COACH_CONNECT_DEVELOPER_ACCESS_KEY_ID: 'api-test-key-v1',
};
const canonicalContext = {
  subject: {
    schema_version: '1.0.0',
    subscriber_subject_id: 'subscriber-subject-api',
    issuer: 'https://subscriber.synthetic.example/',
    audience: 'coach-connect-subscriber',
    tenant_id: 'tenant-api',
    profile_id: 'profile-api',
    business_id: 'business-api',
    subscriber_id: 'subscriber-api',
    mapping_version: 1,
    security_version: 1,
    status: 'ACTIVE',
    source_assertion_reference: 'assertion-reference-api',
    bound_at: '2026-07-24T16:00:00.000Z',
    effective_at: '2026-07-24T16:00:00.000Z',
    revoked_at: null,
    reassignment_prohibited: true,
  },
  authenticated_session: {
    subscriber_subject_id: 'subscriber-subject-api',
    subject_security_version: 1,
    browser_binding_hash: 'browser-binding-api',
    status: 'ACTIVE',
  },
};

function installEnv() {
  const runtime = globalThis.process.env;
  const previous = { ...runtime };
  Object.assign(runtime, env);
  return () => {
    for (const key of Object.keys(runtime)) if (!(key in previous)) delete runtime[key];
    Object.assign(runtime, previous);
  };
}

const response = () => ({
  headers: {},
  statusCode: 0,
  payload: null,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.payload = value; return this; },
});

test('canonical subscriber context creates the existing developer binding without operator authority', () => {
  const binding = createDeveloperBindingFromCanonicalContext(canonicalContext, env);
  assert.equal(Boolean(binding?.subject_binding_hash), true);
  assert.equal(binding.security_version, 1);
  assert.deepEqual(binding.scope, {
    tenant_id: 'tenant-api',
    profile_id: 'profile-api',
    business_id: 'business-api',
    subscriber_id: 'subscriber-api',
  });
  assert.equal('operator_authority' in binding, false);
});

test('canonical resolver takes precedence and prevents downgrade to legacy client-shaped binding', () => {
  const restore = installEnv();
  try {
    const store = new InMemorySecurityStateStore();
    let tokenCounter = 0;
    const handler = createDeveloperAccessHandler({
      store,
      resolveCanonicalSubjectContext: () => null,
      resolveSubjectBinding: () => ({
        subject_id: 'legacy-client-identity',
        scope: canonicalContext.subject,
        browser_id: 'legacy-browser',
      }),
      randomToken: () => `canonical-api-token-${String(tokenCounter += 1).padStart(32, '0')}`,
      clock: () => 1_000,
    });
    const denied = response();
    handler({ method: 'GET', headers: { origin } }, denied);
    assert.equal(denied.statusCode, 401);
    assert.deepEqual(denied.payload, { ok: false, error: 'authentication_required' });
  } finally {
    restore();
  }
});

test('valid canonical resolver preserves the default-off developer flow without exposing capability material', () => {
  const restore = installEnv();
  try {
    const store = new InMemorySecurityStateStore();
    let tokenCounter = 0;
    const handler = createDeveloperAccessHandler({
      store,
      resolveCanonicalSubjectContext: () => canonicalContext,
      randomToken: () => `canonical-api-token-${String(tokenCounter += 1).padStart(32, '0')}`,
      clock: () => 1_000,
    });
    const bootstrap = response();
    handler({ method: 'GET', headers: { origin } }, bootstrap);
    assert.equal(bootstrap.statusCode, 403);
    const granted = response();
    handler({
      method: 'POST',
      headers: {
        origin,
        'x-coach-connect-csrf': bootstrap.payload.csrf_token,
      },
      body: { access_code: accessCode },
    }, granted);
    assert.equal(granted.statusCode, 200);
    assert.equal(granted.payload.capability_issued, true);
    assert.equal('capability' in granted.payload, false);
    assert.equal(store.snapshot().capabilities[0][1].operator_authority, false);
  } finally {
    restore();
  }
});

test('stale or cross-subject authenticated session fails canonical binding closed', () => {
  const stale = {
    ...canonicalContext,
    authenticated_session: {
      ...canonicalContext.authenticated_session,
      subject_security_version: 2,
    },
  };
  const crossSubject = {
    ...canonicalContext,
    authenticated_session: {
      ...canonicalContext.authenticated_session,
      subscriber_subject_id: 'subscriber-subject-other',
    },
  };
  assert.equal(createDeveloperBindingFromCanonicalContext(stale, env), null);
  assert.equal(createDeveloperBindingFromCanonicalContext(crossSubject, env), null);
});
