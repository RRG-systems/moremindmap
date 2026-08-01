import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  createPrivateLiveOperationalRunnerHandler,
} from '../api/internal/private-live-operational-runner.js';
import {
  PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION,
  PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS,
  PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/privateLiveOperationalRunner.js';

const deployment = 'd'.repeat(64);
const authorization = 'synthetic-operational-authorization-material-v1';
const now = Date.parse('2026-07-30T20:00:00.000Z');

function env(overrides = {}) {
  return {
    VERCEL: '1',
    VERCEL_ENV: 'production',
    NODE_ENV: 'production',
    MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'false',
    MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED: 'false',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'false',
    MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256: deployment,
    MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY: JSON.stringify({
      authority_version: PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION,
      enabled: true,
      deployment_sha256: deployment,
      expires_at: '2026-07-30T22:00:00.000Z',
      allowed_operations: PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS,
      authorization_sha256:
        crypto.createHash('sha256').update(authorization).digest('hex'),
    }),
    ...overrides,
  };
}

function req(overrides = {}) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-more-private-live-runner-authorization': authorization,
    },
    body: {
      operation: 'READ_SYNTHETIC_EPOCH',
      request_id: 'request_api_read_epoch',
      scope: { ...PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE },
    },
    ...overrides,
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
}

test('protected route remains generically locked before runner construction', async () => {
  let builds = 0;
  const buildRunner = async () => {
    builds += 1;
    return null;
  };
  for (const input of [
    { request: req(), environment: env({ MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY: undefined }) },
    { request: req({ method: 'GET' }), environment: env() },
    { request: req({ headers: { ...req().headers, origin: 'https://moremindmap.com' } }), environment: env() },
    { request: req({ headers: { ...req().headers, 'content-type': 'application/jsonp' } }), environment: env() },
    { request: req({ headers: { ...req().headers, 'x-more-private-live-runner-authorization': 'wrong-operational-authorization-value' } }), environment: env() },
    { request: req(), environment: env({ MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'true' }) },
    { request: req(), environment: env({ MORE_SUBDEV1_OPERATOR_ENABLED: 'true' }) },
  ]) {
    const res = response();
    await createPrivateLiveOperationalRunnerHandler({
      env: input.environment,
      clock: () => now,
      buildRunner,
    })(input.request, res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.payload, { ok: false, error: 'feature_unavailable' });
  }
  assert.equal(builds, 0);
});

test('protected route denies invalid scope before runner construction', async () => {
  let builds = 0;
  const input = req();
  input.body.scope.profile_id = 'mm-other';
  const res = response();
  await createPrivateLiveOperationalRunnerHandler({
    env: env(),
    clock: () => now,
    buildRunner: async () => {
      builds += 1;
      return null;
    },
  })(input, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, { ok: false, error: 'request_denied' });
  assert.equal(builds, 0);
});

test('protected route returns only the runner privacy-safe projection', async () => {
  const safeResult = {
    ok: true,
    operation: 'READ_SYNTHETIC_EPOCH',
    status: 'ACTIVE',
    code: null,
    provider_states: null,
    provider_timestamps: ['2026-07-30T20:00:00.000Z'],
    receipt_hashes: ['e'.repeat(64)],
    scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    namespace_hash: 'b'.repeat(64),
    approval_status: null,
    expires_at: null,
    epoch: 1,
    deployment_hash: deployment,
    rollback_status: 'RUNNER_DEFAULT_OFF_REVOKE_APPROVAL_ADVANCE_EPOCH_DISABLE',
  };
  const res = response();
  await createPrivateLiveOperationalRunnerHandler({
    env: env(),
    clock: () => now,
    buildRunner: async () => ({
      ok: true,
      execute: async () => safeResult,
    }),
  })(req(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, safeResult);
  assert.equal(res.headers['Cache-Control'], 'no-store, max-age=0');
  const serialized = JSON.stringify(res.payload);
  assert.equal(/credential|endpoint|cookie|token|profile_id|subscriber_subject/.test(serialized), false);
});

test('protected route permits the reviewed fixed-fixture operation without exposing its fixed identity', async () => {
  const fixtureRequest = req();
  fixtureRequest.body = {
    operation: 'CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE',
    request_id: 'request_api_create_fixed_fixture',
    scope: { ...PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE },
  };
  const safeResult = {
    ok: true,
    operation: 'CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE',
    status: 'CREATED',
    code: null,
    provider_states: null,
    provider_timestamps: [],
    receipt_hashes: ['e'.repeat(64)],
    scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    namespace_hash: 'b'.repeat(64),
    approval_status: null,
    expires_at: null,
    epoch: null,
    deployment_hash: deployment,
    rollback_status: 'RUNNER_DEFAULT_OFF_DISABLE_FIXTURE_OPERATION',
    records_created: 2,
    keys_created: 3,
    idempotent: false,
    customer_data: false,
    arbitrary_profile_input: false,
  };
  const res = response();
  await createPrivateLiveOperationalRunnerHandler({
    env: env(),
    clock: () => now,
    buildRunner: async () => ({
      ok: true,
      execute: async () => safeResult,
    }),
  })(fixtureRequest, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, safeResult);
  assert.equal(JSON.stringify(res.payload).includes('mm-'), false);
  assert.equal(/credential|endpoint|cookie|token|profile_id/.test(
    JSON.stringify(res.payload),
  ), false);
});

test('runner construction and execution failures do not expose details', async () => {
  for (const buildRunner of [
    async () => {
      throw new Error('synthetic provider credential must not escape');
    },
    async () => ({
      ok: true,
      execute: async () => ({
        ok: false,
        code: 'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE',
      }),
    }),
    async () => ({
      ok: true,
      execute: async () => {
        throw new Error('synthetic provider response must not escape');
      },
    }),
  ]) {
    const res = response();
    await createPrivateLiveOperationalRunnerHandler({
      env: env(),
      clock: () => now,
      buildRunner,
    })(req(), res);
    assert.equal([404, 403].includes(res.statusCode), true);
    assert.equal(JSON.stringify(res.payload).includes('credential'), false);
    assert.equal(JSON.stringify(res.payload).includes('provider'), false);
  }
});
