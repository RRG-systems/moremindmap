import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  createPrivateLiveOperationalRunnerHandler,
} from '../api/internal/private-live-operational-runner.js';
import {
  createPrivateBetaLaunchStageReceiptV1,
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
  assert.equal(res.payload.ok, false);
  assert.equal(res.payload.error, 'request_denied');
  assert.equal(res.payload.stage_receipt.stage, 'RUNNER_AUTHORIZATION');
  assert.equal(res.payload.stage_receipt.stop_code, 'REQUEST_VALIDATION_FAILED');
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

test('authorized runner failures expose only bounded stage receipts', async () => {
  const cases = [
    {
      buildRunner: async () => {
        throw new Error('synthetic provider credential must not escape');
      },
      stage: 'PROVIDER_CONFIGURATION',
      stopCode: 'RUNNER_CONSTRUCTION_FAILED',
    },
    {
      buildRunner: async () => ({
        ok: true,
        execute: async () => ({
          ok: false,
          code: 'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE',
        }),
      }),
      stage: 'PROVIDER_EXECUTION',
      stopCode: 'RUNNER_REQUEST_DENIED',
    },
    {
      buildRunner: async () => ({
        ok: true,
        execute: async () => {
          throw new Error('synthetic provider response must not escape');
        },
      }),
      stage: 'PROVIDER_EXECUTION',
      stopCode: 'RUNNER_EXECUTION_FAILED',
    },
  ];
  for (const entry of cases) {
    const res = response();
    await createPrivateLiveOperationalRunnerHandler({
      env: env(),
      clock: () => now,
      buildRunner: entry.buildRunner,
    })(req(), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.stage_receipt.stage, entry.stage);
    assert.equal(res.payload.stage_receipt.stop_code, entry.stopCode);
    const serialized = JSON.stringify(res.payload);
    assert.equal(/credential|endpoint|cookie|token|profile_id|subscriber_subject/.test(serialized), false);
  }
});

test('protected route preserves a bounded STORE_CANARY_PROOF failure classification', async () => {
  const stageReceipt = createPrivateBetaLaunchStageReceiptV1({
    stage: 'PROOF_STORAGE',
    stop_code: 'CANARY_PROOF_PROVIDER_HTTP_5XX',
    provider_health_call_count: 3,
    expected_provider_state: 'HEALTHY',
    observed_provider_state: 'HEALTHY',
    provider_failure_code: 'CANARY_PROOF_PROVIDER_HTTP_5XX',
    proof_storage_attempted: true,
    proof_storage_succeeded: false,
  });
  const res = response();
  await createPrivateLiveOperationalRunnerHandler({
    env: env(),
    clock: () => now,
    buildRunner: async () => ({
      ok: true,
      execute: async () => ({
        ok: false,
        code: 'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE',
        stage_receipt: stageReceipt,
      }),
    }),
  })(req(), res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.payload, {
    ok: false,
    error: 'request_denied',
    stage_receipt: stageReceipt,
  });
  assert.equal(
    /credential|endpoint|cookie|token|profile_id|subscriber_subject/.test(
      JSON.stringify(res.payload),
    ),
    false,
  );
});

test('protected route exposes only a validated four-field response-shape diagnostic', async () => {
  const diagnostic = {
    field_count: 9,
    field_name_digest: 'a'.repeat(64),
    field_type_classes: [
      'null',
      'string',
      'null',
      'number',
      'boolean',
      'boolean',
      'number',
      'string',
      'string',
    ],
    failed_predicate_id: 'FIELD_TYPE_MISMATCH',
  };
  const stageReceipt = createPrivateBetaLaunchStageReceiptV1({
    stage: 'PROOF_STORAGE',
    stop_code: 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED',
    provider_health_call_count: 3,
    expected_provider_state: 'HEALTHY',
    observed_provider_state: 'HEALTHY',
    provider_failure_code: 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED',
    proof_storage_attempted: true,
    proof_storage_succeeded: false,
  });
  const run = async (providerProofDiagnostic) => {
    const res = response();
    await createPrivateLiveOperationalRunnerHandler({
      env: env(),
      clock: () => now,
      buildRunner: async () => ({
        ok: true,
        execute: async () => ({
          ok: false,
          code: 'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE',
          stage_receipt: stageReceipt,
          provider_proof_diagnostic: providerProofDiagnostic,
        }),
      }),
    })(req(), res);
    return res;
  };
  const accepted = await run(diagnostic);
  assert.equal(accepted.statusCode, 403);
  assert.deepEqual(accepted.payload.provider_proof_diagnostic, diagnostic);
  assert.equal(JSON.stringify(accepted.payload).includes('provider response body'), false);

  const rejected = await run({ ...diagnostic, raw_payload: 'must-not-escape' });
  assert.equal(rejected.statusCode, 403);
  assert.equal(Object.hasOwn(rejected.payload, 'provider_proof_diagnostic'), false);
  assert.equal(JSON.stringify(rejected.payload).includes('must-not-escape'), false);

  const tooWide = await run({
    ...diagnostic,
    field_count: 33,
    field_type_classes: Array.from({ length: 33 }, () => 'string'),
  });
  assert.equal(tooWide.statusCode, 403);
  assert.equal(Object.hasOwn(tooWide.payload, 'provider_proof_diagnostic'), false);
});
