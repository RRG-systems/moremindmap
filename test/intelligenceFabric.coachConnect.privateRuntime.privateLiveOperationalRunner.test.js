import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  authorizePrivateLiveOperationalRunnerRequestV1,
  buildPrivateLiveOperationalRunnerV1,
  PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION,
  PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS,
  PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE,
  validatePrivateLiveOperationalRunnerRequestV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/privateLiveOperationalRunner.js';
import {
  validatePrivateTestApprovalV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js';
import {
  validateRemoteSecurityRecord,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js';
import {
  FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
  FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID,
  FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS,
  FIXED_SYNTHETIC_VAULT_RECORD,
  FIXED_SYNTHETIC_BUSINESS_ASSESSMENT,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/fixedSyntheticProductFixture.js';

const deployment = 'd'.repeat(64);
const authorization = 'synthetic-operational-authorization-material-v1';
const authorizationSha256 =
  crypto.createHash('sha256').update(authorization).digest('hex');
const now = Date.parse('2026-07-30T20:00:00.000Z');

function environment(overrides = {}) {
  return {
    VERCEL: '1',
    VERCEL_ENV: 'production',
    NODE_ENV: 'production',
    MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'false',
    MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED: 'false',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'false',
    MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256: deployment,
    MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256: 'a'.repeat(64),
    MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY: JSON.stringify({
      authority_version: PRIVATE_LIVE_OPERATIONAL_RUNNER_AUTHORITY_VERSION,
      enabled: true,
      deployment_sha256: deployment,
      expires_at: '2026-07-30T22:00:00.000Z',
      allowed_operations: PRIVATE_LIVE_OPERATIONAL_RUNNER_OPERATIONS,
      authorization_sha256: authorizationSha256,
    }),
    ...overrides,
  };
}

function request(operation, extra = {}) {
  return {
    operation,
    request_id: `request_${operation.toLowerCase()}`,
    scope: { ...PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE },
    ...extra,
  };
}

function authorityFixture(env) {
  const exactScope = {
    tenant_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.tenant_id,
    profile_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.profile_id,
    business_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.business_id,
    subscriber_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.subscriber_id,
  };
  return {
    ok: true,
    authority_packet: {
      environment_id: 'PRIVATE_LIVE',
      live_enabled: false,
      emergency_disabled: false,
      packet_sha256: 'f'.repeat(64),
    },
    activation_receipt: null,
    immutable_deployment_identity: env.MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256,
    remote_configuration: {
      provider: 'UPSTASH_REDIS',
      provider_endpoint_ref: 'MORE_PRIVATE_RUNTIME_PROVIDER_ENDPOINT_VALUE',
      provider_credential_ref: 'MORE_PRIVATE_RUNTIME_PROVIDER_CREDENTIAL_VALUE',
      scope_hash_key_ref: 'MORE_PRIVATE_RUNTIME_SCOPE_HASH_KEY_VALUE',
      namespace_digest: 'b'.repeat(64),
    },
    qualification_certificate: {},
    live_environment_attestation: {},
    product_binding_attestation: {
      subscriber_subject_ref:
        PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.subscriber_subject_ref,
      exact_scope: exactScope,
      exact_scope_hash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    },
    resolve_secret_reference: async (reference) => (
      reference === 'MORE_PRIVATE_RUNTIME_SCOPE_HASH_KEY_VALUE'
        ? 'synthetic-scope-hash-key-material-at-least-32-bytes'
        : reference === 'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_REDIS_URL'
          ? 'rediss://synthetic.invalid:6380'
          : null
    ),
  };
}

function productExecutionBinding(overrides = {}) {
  return {
    ok: true,
    binding: {
      business_engine_execution_contract_sha256:
        FIXED_SYNTHETIC_BUSINESS_ENGINE_CONTRACT_SHA256,
      exact_scope: {
        tenant_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.tenant_id,
        profile_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.profile_id,
        business_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.business_id,
        subscriber_id: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.subscriber_id,
      },
      approved_profile_ids: [PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.profile_id],
      execution_enabled: true,
      source_default_off: true,
      private_beta_only: true,
      public_access: false,
      append_only: true,
      immutable_history: true,
      destructive_updates: false,
      product_store_connection_ref:
        'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_REDIS_URL',
      persistence_namespace_prefix:
        'more:private-live:product:fixed-synthetic',
      ...overrides,
    },
  };
}

function fixedFixtureProductClient(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  let connections = 0;
  let disconnects = 0;
  return {
    values,
    calls,
    connections: () => connections,
    disconnects: () => disconnects,
    async connect() {
      connections += 1;
    },
    async eval(script, numberOfKeys, ...parameters) {
      assert.match(script, /fixed-synthetic-profile-and-ba-fixture-v1/);
      const keys = parameters.slice(0, numberOfKeys);
      const args = parameters.slice(numberOfKeys);
      calls.push(keys);
      const existing = keys.map((key) => values.get(key));
      const present = existing.filter((value) => value !== undefined).length;
      if (present === 0) {
        keys.forEach((key, index) => values.set(key, args[index]));
        return ['CREATED', '', '3'];
      }
      if (present === 3
        && existing.every((value, index) => value === args[index])) {
        return ['ALREADY_EXISTS_VALID', '', '0'];
      }
      return ['CONFLICT', 'FIXED_SYNTHETIC_FIXTURE_CONFLICT', '0'];
    },
    disconnect() {
      disconnects += 1;
    },
  };
}

function simulatedProvider() {
  const state = {
    canary_proof: false,
    scope_epoch: 0,
    environment_epoch: 0,
    approval: null,
    approval_record: null,
    scope_epoch_record: null,
    environment_epoch_record: null,
    idempotency: new Map(),
    calls: [],
    scripts: [],
  };
  return {
    state,
    execute: async (command) => {
      const input = JSON.parse(command.at(-1));
      state.calls.push(input.operation);
      state.scripts.push(command[1]);
      const result = {
        ok: true,
        status: 'ACTIVE',
        code: '',
        provider_time_ms: now,
        receipt_hash: input.receipt_hash,
        epoch: null,
        approval_status: null,
        expires_at_ms: null,
        idempotent_replay: false,
      };
      const idempotencyKey = command[8];
      const priorFingerprint = state.idempotency.get(idempotencyKey);
      if (priorFingerprint != null) {
        return JSON.stringify({
          ...result,
          ok: false,
          status: 'DENIED',
          code: priorFingerprint === input.fingerprint
            ? 'REQUEST_REPLAY_DETECTED'
            : 'IDEMPOTENCY_FINGERPRINT_CONFLICT',
        });
      }
      state.idempotency.set(idempotencyKey, input.fingerprint);
      if (input.operation === 'STORE_CANARY_PROOF') {
        state.canary_proof = true;
        return JSON.stringify({
          ...result,
          status: 'HEALTHY',
          expires_at_ms: now + input.canary_proof_ttl_ms,
        });
      }
      if (!state.canary_proof) {
        return JSON.stringify({
          ...result,
          ok: false,
          status: 'DENIED',
          code: 'OPERATIONAL_RUNNER_CANARY_PROOF_REQUIRED',
        });
      }
      if (input.operation === 'CREATE_SYNTHETIC_EPOCH_1') {
        if (![0, 1].includes(state.scope_epoch)
          || ![0, 1].includes(state.environment_epoch)) {
          return JSON.stringify({
            ...result,
            ok: false,
            status: 'DENIED',
            code: 'OPERATIONAL_RUNNER_EPOCH_CONFLICT',
            epoch: Math.max(state.scope_epoch, state.environment_epoch),
          });
        }
        state.scope_epoch = 1;
        state.environment_epoch = 1;
        state.scope_epoch_record = {
          record_type: 'security-epoch-v1',
          record_version: 1,
          environment_digest: input.environment_digest,
          exact_scope_hash: input.exact_scope_hash,
          security_epoch: 1,
          epoch: 1,
          status: 'ACTIVE',
          reason_code: 'SYNTHETIC_PRIVATE_LIVE_QUALIFICATION',
          created_at_ms: now,
          updated_at_ms: now,
          record_etag: input.record_etag,
        };
        state.environment_epoch_record = {
          record_type: 'security-epoch-v1',
          record_version: 1,
          environment_digest: input.environment_digest,
          security_epoch: 1,
          epoch: 1,
          status: 'ACTIVE',
          reason_code: 'SYNTHETIC_PRIVATE_LIVE_QUALIFICATION',
          created_at_ms: now,
          updated_at_ms: now,
          record_etag: input.environment_record_etag,
        };
        return JSON.stringify({ ...result, epoch: 1 });
      }
      if (input.operation === 'READ_SYNTHETIC_EPOCH') {
        const epoch = Math.max(state.scope_epoch, state.environment_epoch);
        return JSON.stringify({
          ...result,
          status: epoch ? 'ACTIVE' : 'ABSENT',
          epoch,
        });
      }
      if (input.operation === 'ADVANCE_SYNTHETIC_EPOCH_1_TO_2') {
        if (state.scope_epoch !== 1 || state.environment_epoch !== 1) {
          return JSON.stringify({
            ...result,
            ok: false,
            status: 'DENIED',
            code: 'OPERATIONAL_RUNNER_EPOCH_CONFLICT',
            epoch: Math.max(state.scope_epoch, state.environment_epoch),
          });
        }
        state.scope_epoch = 2;
        state.scope_epoch_record = {
          ...state.scope_epoch_record,
          security_epoch: 2,
          epoch: 2,
          reason_code: 'SYNTHETIC_PRIVATE_LIVE_ROLLBACK',
          updated_at_ms: now,
          record_etag: input.record_etag,
        };
        return JSON.stringify({ ...result, epoch: 2 });
      }
      if (input.operation === 'CREATE_SYNTHETIC_APPROVAL') {
        if (state.scope_epoch !== 1
          || state.environment_epoch !== 1
          || state.approval != null) {
          return JSON.stringify({
            ...result,
            ok: false,
            status: 'DENIED',
            code: 'OPERATIONAL_RUNNER_APPROVAL_CONFLICT',
          });
        }
        state.approval = {
          status: 'ACTIVE',
          security_epoch: 1,
          expires_at_ms: now + input.duration_ms,
        };
        state.approval_record = {
          record_type: 'private-test-approval-v1',
          record_version: 1,
          environment_digest: input.environment_digest,
          approval_ref: input.approval_ref,
          environment_id: input.environment_id,
          subscriber_subject_ref: input.subscriber_subject_ref,
          exact_scope_hash: input.exact_scope_hash,
          purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
          provenance_ref: input.provenance_ref,
          status: 'ACTIVE',
          approval_epoch: 1,
          security_epoch: 1,
          issued_at: input.issued_at,
          expires_at: input.expires_at,
          issued_at_ms: input.issued_at_ms,
          expires_at_ms: now + input.duration_ms,
          created_at_ms: now,
          updated_at_ms: now,
          record_etag: input.record_etag,
        };
        return JSON.stringify({
          ...result,
          epoch: 1,
          approval_status: 'ACTIVE',
          expires_at_ms: state.approval.expires_at_ms,
        });
      }
      if (input.operation === 'READ_SYNTHETIC_APPROVAL') {
        const status = state.approval == null
          ? 'ABSENT'
          : state.approval.status === 'REVOKED'
            ? 'REVOKED'
            : state.approval.security_epoch !== Math.max(
              state.scope_epoch,
              state.environment_epoch,
            )
              ? 'STALE'
              : state.approval.status;
        return JSON.stringify({
          ...result,
          status,
          epoch: Math.max(state.scope_epoch, state.environment_epoch),
          approval_status: status,
          expires_at_ms: state.approval?.expires_at_ms || null,
        });
      }
      if (input.operation === 'REVOKE_SYNTHETIC_APPROVAL' && state.approval) {
        state.approval.status = 'REVOKED';
        state.approval_record = {
          ...state.approval_record,
          status: 'REVOKED',
          updated_at_ms: now,
          revoked_at_ms: now,
          record_etag: input.record_etag,
        };
        return JSON.stringify({
          ...result,
          status: 'REVOKED',
          epoch: Math.max(state.scope_epoch, state.environment_epoch),
          approval_status: 'REVOKED',
          expires_at_ms: state.approval.expires_at_ms,
        });
      }
      return JSON.stringify({
        ...result,
        ok: false,
        status: 'DENIED',
        code: 'OPERATIONAL_RUNNER_REQUEST_DENIED',
      });
    },
  };
}

function adapterSequence(sequence, calls) {
  return {
    health: async () => {
      const index = calls.count;
      calls.count += 1;
      const state = sequence[index] || 'UNAVAILABLE';
      return {
        decision_version: 'async-security-health-decision-v2',
        state,
        allowed_for_security: state === 'HEALTHY',
        environment_id: 'PRIVATE_LIVE',
        adapter_id: 'upstash-redis-remote-shared-security-adapter-v1',
        deployment_grade: state === 'HEALTHY',
        live_connection_verified: state === 'HEALTHY',
        no_local_fallback: true,
        server_time: new Date(now + index * 1000).toISOString(),
        failure_code: state === 'HEALTHY'
          ? null
          : 'SHARED_SECURITY_STATE_RECOVERING',
        receipt_ref: `synthetic_health_receipt_${index + 1}`,
      };
    },
  };
}

async function runnerFixture({
  env = environment(),
  sequence = ['RECOVERING', 'RECOVERING', 'HEALTHY'],
  productBinding = productExecutionBinding(),
  productClient = fixedFixtureProductClient(),
} = {}) {
  const provider = simulatedProvider();
  const healthCalls = { count: 0 };
  let adapterConstructions = 0;
  const runner = await buildPrivateLiveOperationalRunnerV1({
    env,
    clock: () => now,
    authorityReader: async () => authorityFixture(env),
    adapterFactory: () => {
      adapterConstructions += 1;
      return adapterSequence(sequence, healthCalls);
    },
    providerCommandExecutor: provider.execute,
    productExecutionBindingReader: async () => productBinding,
    createProductStoreClient: () => productClient,
  });
  return {
    runner,
    provider,
    healthCalls,
    adapterConstructions,
    productClient,
  };
}

test('authority gate is production-only, default-off, deployment-bound, non-browser, and constant-time validated', () => {
  const env = environment();
  const baseRequest = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-more-private-live-runner-authorization': authorization,
    },
  };
  assert.equal(authorizePrivateLiveOperationalRunnerRequestV1({
    req: baseRequest,
    env,
    nowMs: now,
  }).ok, true);
  for (const deniedCase of [
    { req: { ...baseRequest, method: 'GET' }, env },
    { req: { ...baseRequest, headers: { ...baseRequest.headers, origin: 'https://moremindmap.com' } }, env },
    { req: { ...baseRequest, headers: { ...baseRequest.headers, referer: 'https://moremindmap.com/' } }, env },
    { req: { ...baseRequest, headers: { ...baseRequest.headers, 'sec-fetch-site': 'same-origin' } }, env },
    { req: { ...baseRequest, headers: { ...baseRequest.headers, 'content-type': 'application/jsonp' } }, env },
    { req: { ...baseRequest, headers: { ...baseRequest.headers, 'x-more-private-live-runner-authorization': 'incorrect-authorization-material-value' } }, env },
    { req: baseRequest, env: environment({ MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'true' }) },
    { req: baseRequest, env: environment({ MORE_SUBDEV1_OPERATOR_ENABLED: 'true' }) },
    { req: baseRequest, env: environment({ VERCEL_ENV: 'preview' }) },
    { req: baseRequest, env: environment({ MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY: undefined }) },
  ]) {
    assert.equal(authorizePrivateLiveOperationalRunnerRequestV1({
      ...deniedCase,
      nowMs: now,
    }).code, 'OPERATIONAL_RUNNER_LOCKED');
  }
});

test('request contract is exact, fixed-scope, bounded, and rejects client authority', () => {
  assert.equal(validatePrivateLiveOperationalRunnerRequestV1(
    request('READ_SYNTHETIC_EPOCH'),
  ).ok, true);
  assert.equal(validatePrivateLiveOperationalRunnerRequestV1(request(
    'CREATE_SYNTHETIC_APPROVAL',
    {
      duration_minutes: 90,
    },
  )).ok, true);
  assert.equal(validatePrivateLiveOperationalRunnerRequestV1(
    request('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE'),
  ).ok, true);
  for (const input of [
    request('UNKNOWN'),
    request('READ_SYNTHETIC_EPOCH', { profile_id: 'other' }),
    {
      ...request('READ_SYNTHETIC_EPOCH'),
      scope: { ...PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE, profile_id: 'mm-other' },
    },
    {
      ...request('READ_SYNTHETIC_EPOCH'),
      scope: { ...PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE, exact_scope_hash: '0'.repeat(64) },
    },
    request('CREATE_SYNTHETIC_APPROVAL', {
      duration_minutes: 91,
    }),
    request('CREATE_SYNTHETIC_APPROVAL'),
    request('CREATE_SYNTHETIC_APPROVAL', {
      duration_minutes: 30,
      provenance_ref: 'mm-20260730-customer-shaped',
    }),
    request('READ_SYNTHETIC_EPOCH', { canonical_authority: true }),
    request('ADVANCE_SYNTHETIC_EPOCH_1_TO_2', { target_epoch: 5 }),
    request('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE', {
      profile_id: 'mm-20990101-aaaaaaaa',
    }),
    request('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE', {
      customer_input: { name: 'not accepted' },
    }),
  ]) {
    assert.equal(validatePrivateLiveOperationalRunnerRequestV1(input).ok, false);
  }
});

test('fixed product fixture uses only the exact product store keys and never calls the security provider', async () => {
  const fixture = await runnerFixture();
  const created = await fixture.runner.execute(
    request('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE'),
  );
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal(created.status, 'CREATED');
  assert.equal(created.records_created, 2);
  assert.equal(created.keys_created, 3);
  assert.equal(created.customer_data, false);
  assert.equal(created.arbitrary_profile_input, false);
  assert.equal(fixture.healthCalls.count, 0);
  assert.deepEqual(fixture.provider.state.calls, []);
  assert.deepEqual(fixture.productClient.calls[0], [
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.vault_profile,
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment_by_profile,
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment,
  ]);
  assert.equal(
    fixture.productClient.values.get(
      FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.vault_profile,
    ),
    JSON.stringify(FIXED_SYNTHETIC_VAULT_RECORD),
  );
  assert.equal(
    fixture.productClient.values.get(
      FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment_by_profile,
    ),
    FIXED_SYNTHETIC_PRODUCT_FIXTURE_ASSESSMENT_ID,
  );
  assert.equal(
    fixture.productClient.values.get(
      FIXED_SYNTHETIC_PRODUCT_FIXTURE_KEYS.business_assessment,
    ),
    JSON.stringify(FIXED_SYNTHETIC_BUSINESS_ASSESSMENT),
  );
  assert.equal(fixture.productClient.connections(), 1);
  assert.equal(fixture.productClient.disconnects(), 1);
  assert.equal(JSON.stringify(created).includes('mm-'), false);

  const replay = await fixture.runner.execute({
    ...request('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE'),
    request_id: 'request_fixed_fixture_replay',
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.status, 'ALREADY_EXISTS_VALID');
  assert.equal(replay.idempotent, true);
  assert.equal(replay.keys_created, 0);
  assert.equal(fixture.productClient.values.size, 3);
  assert.equal(fixture.productClient.connections(), 2);
  assert.equal(fixture.productClient.disconnects(), 2);
});

test('fixed product fixture fails closed before EVAL when the product store cannot connect', async () => {
  let evalCalls = 0;
  let disconnects = 0;
  const fixture = await runnerFixture({
    productClient: {
      async connect() {
        throw new Error('synthetic connection failure');
      },
      async eval() {
        evalCalls += 1;
      },
      disconnect() {
        disconnects += 1;
      },
    },
  });
  const result = await fixture.runner.execute(
    request('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE'),
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, 'FIXED_SYNTHETIC_FIXTURE_STORE_UNAVAILABLE');
  assert.equal(evalCalls, 0);
  assert.equal(disconnects, 1);
});

test('fixed product fixture fails before product-store construction on binding drift', async () => {
  for (const binding of [
    productExecutionBinding({
      business_engine_execution_contract_sha256: '0'.repeat(64),
    }),
    productExecutionBinding({ approved_profile_ids: [] }),
    productExecutionBinding({ public_access: true }),
    productExecutionBinding({ append_only: false }),
  ]) {
    let productClients = 0;
    const provider = simulatedProvider();
    const healthCalls = { count: 0 };
    const runner = await buildPrivateLiveOperationalRunnerV1({
      env: environment(),
      clock: () => now,
      authorityReader: async () => authorityFixture(environment()),
      adapterFactory: () => adapterSequence([], healthCalls),
      providerCommandExecutor: provider.execute,
      productExecutionBindingReader: async () => binding,
      createProductStoreClient: () => {
        productClients += 1;
        return fixedFixtureProductClient();
      },
    });
    const result = await runner.execute(
      request('CREATE_FIXED_SYNTHETIC_PRODUCT_FIXTURE'),
    );
    assert.equal(result.ok, false);
    assert.equal(result.code, 'FIXED_SYNTHETIC_FIXTURE_BINDING_MISMATCH');
    assert.equal(productClients, 0);
    assert.deepEqual(provider.state.calls, []);
  }
});

test('runner constructs the committed adapter once and performs exactly the required canary sequence', async () => {
  const fixture = await runnerFixture();
  assert.equal(fixture.runner.ok, true);
  assert.equal(fixture.adapterConstructions, 1);
  const result = await fixture.runner.execute(request('PROVIDER_HEALTH_CANARY'));
  assert.equal(result.ok, true);
  assert.deepEqual(result.provider_states, ['RECOVERING', 'RECOVERING', 'HEALTHY']);
  assert.equal(fixture.healthCalls.count, 3);
  assert.deepEqual(fixture.provider.state.calls, ['STORE_CANARY_PROOF']);
  assert.equal(result.scope_hash, PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash);
  assert.equal(JSON.stringify(result).includes('credential'), false);
  assert.equal(JSON.stringify(result).includes('provider_endpoint'), false);
  assert.equal(JSON.stringify(result).includes('subscriber_subject'), false);
});

test('unexpected canary state stops immediately and never performs a fourth call or provider mutation', async () => {
  const fixture = await runnerFixture({
    sequence: ['RECOVERING', 'UNAVAILABLE', 'HEALTHY'],
  });
  const result = await fixture.runner.execute(request('PROVIDER_HEALTH_CANARY'));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'OPERATIONAL_RUNNER_CANARY_SEQUENCE_INVALID');
  assert.equal(fixture.healthCalls.count, 2);
  assert.equal(fixture.provider.state.calls.length, 0);
});

test('fixed synthetic product attestation is required before secrets, adapter, or provider work', async () => {
  const valid = authorityFixture(environment()).product_binding_attestation;
  const mismatches = [
    null,
    { ...valid, subscriber_subject_ref: 'other_subject' },
    { ...valid, exact_scope: { ...valid.exact_scope, profile_id: 'mm-other' } },
    { ...valid, exact_scope: { ...valid.exact_scope, tenant_id: 'other_tenant' } },
    { ...valid, exact_scope: { ...valid.exact_scope, business_id: 'other_business' } },
    { ...valid, exact_scope: { ...valid.exact_scope, subscriber_id: 'other_subscriber' } },
    { ...valid, exact_scope_hash: '0'.repeat(64) },
  ];
  for (const productBinding of mismatches) {
    let secretReads = 0;
    let adapterConstructions = 0;
    let providerCalls = 0;
    const fixture = authorityFixture(environment());
    fixture.product_binding_attestation = productBinding;
    fixture.resolve_secret_reference = async () => {
      secretReads += 1;
      return 'must-not-be-read';
    };
    const result = await buildPrivateLiveOperationalRunnerV1({
      env: environment(),
      clock: () => now,
      authorityReader: async () => fixture,
      adapterFactory: () => {
        adapterConstructions += 1;
        return adapterSequence([], { count: 0 });
      },
      providerCommandExecutor: async () => {
        providerCalls += 1;
        return null;
      },
    });
    assert.equal(result.code, 'OPERATIONAL_RUNNER_AUTHORITY_INVALID');
    assert.equal(secretReads, 0);
    assert.equal(adapterConstructions, 0);
    assert.equal(providerCalls, 0);
  }
});

test('provider-controlled strings, fields, and result combinations fail without reflection', async () => {
  const sentinel = 'synthetic_secret_sentinel_must_not_escape';
  const base = {
    ok: true,
    status: 'HEALTHY',
    code: '',
    provider_time_ms: now,
    receipt_hash: 'e'.repeat(64),
    epoch: null,
    approval_status: null,
    expires_at_ms: now + 60_000,
    idempotent_replay: false,
  };
  const malformedResults = [
    { ...base, status: sentinel },
    { ...base, code: sentinel },
    { ...base, approval_status: sentinel },
    { ...base, epoch: sentinel },
    { ...base, unexpected: sentinel },
    { ...base, status: 'ACTIVE' },
  ];
  for (const malformed of malformedResults) {
    const healthCalls = { count: 0 };
    const runner = await buildPrivateLiveOperationalRunnerV1({
      env: environment(),
      clock: () => now,
      authorityReader: async () => authorityFixture(environment()),
      adapterFactory: () => adapterSequence(
        ['RECOVERING', 'RECOVERING', 'HEALTHY'],
        healthCalls,
      ),
      providerCommandExecutor: async () => JSON.stringify(malformed),
    });
    const result = await runner.execute(request('PROVIDER_HEALTH_CANARY'));
    assert.equal(result.ok, false);
    assert.equal(result.code, 'OPERATIONAL_RUNNER_PROVIDER_UNAVAILABLE');
    assert.equal(JSON.stringify(result).includes(sentinel), false);
  }
});

test('fixed synthetic approval and epoch lifecycle is bounded, stale after advance, and replay-safe', async () => {
  const fixture = await runnerFixture();
  assert.equal((await fixture.runner.execute(
    request('CREATE_SYNTHETIC_EPOCH_1'),
  )).code, 'OPERATIONAL_RUNNER_CANARY_PROOF_REQUIRED');
  assert.equal((await fixture.runner.execute(
    request('PROVIDER_HEALTH_CANARY'),
  )).ok, true);
  assert.match(fixture.provider.state.scripts[0], /record_version = 1/);
  assert.doesNotMatch(
    fixture.provider.state.scripts[0],
    /record_version = '(?:security-epoch|private-test-approval)-v1'/,
  );
  assert.match(fixture.provider.state.scripts[0], /preserve_prior_command/);
  const epochCreate = await fixture.runner.execute({
    ...request('CREATE_SYNTHETIC_EPOCH_1'),
    request_id: 'request_create_synthetic_epoch_after_canary',
  });
  assert.equal(epochCreate.ok, true);
  assert.equal(epochCreate.epoch, 1);
  const epochRead = await fixture.runner.execute(
    request('READ_SYNTHETIC_EPOCH'),
  );
  assert.equal(epochRead.epoch, 1);
  const divergentReplay = await fixture.runner.execute({
    ...request('ADVANCE_SYNTHETIC_EPOCH_1_TO_2'),
    request_id: request('READ_SYNTHETIC_EPOCH').request_id,
  });
  assert.equal(divergentReplay.ok, false);
  assert.equal(divergentReplay.code, 'IDEMPOTENCY_FINGERPRINT_CONFLICT');
  assert.equal(fixture.provider.state.scope_epoch, 1);
  const originalAfterConflict = await fixture.runner.execute(
    request('READ_SYNTHETIC_EPOCH'),
  );
  assert.equal(originalAfterConflict.code, 'REQUEST_REPLAY_DETECTED');
  const approvalCreate = await fixture.runner.execute(request(
    'CREATE_SYNTHETIC_APPROVAL',
    {
      duration_minutes: 90,
    },
  ));
  assert.equal(approvalCreate.approval_status, 'ACTIVE');
  assert.equal(validateRemoteSecurityRecord(fixture.provider.state.approval_record, {
    environment_digest: 'b'.repeat(64),
    provider_time_ms: now,
    require_active_ttl: true,
  }).valid, true);
  assert.equal(validatePrivateTestApprovalV1(fixture.provider.state.approval_record, {
    environmentId: 'PRIVATE_LIVE',
    subscriberSubjectRef:
      PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.subscriber_subject_ref,
    exactScopeHash: PRIVATE_LIVE_OPERATIONAL_RUNNER_SCOPE.exact_scope_hash,
    securityEpoch: 1,
    now,
  }).valid, true);
  assert.equal(validateRemoteSecurityRecord(fixture.provider.state.scope_epoch_record, {
    environment_digest: 'b'.repeat(64),
  }).valid, true);
  assert.equal(validateRemoteSecurityRecord(fixture.provider.state.environment_epoch_record, {
    environment_digest: 'b'.repeat(64),
  }).valid, true);
  assert.match(fixture.provider.state.approval_record.provenance_ref, /^[a-f0-9]{64}$/);
  assert.equal(
    fixture.provider.state.approval_record.provenance_ref.includes('mm-'),
    false,
  );
  const approvalRead = await fixture.runner.execute(
    request('READ_SYNTHETIC_APPROVAL'),
  );
  assert.equal(approvalRead.approval_status, 'ACTIVE');
  const replay = await fixture.runner.execute(
    request('READ_SYNTHETIC_APPROVAL'),
  );
  assert.equal(replay.ok, false);
  assert.equal(replay.code, 'REQUEST_REPLAY_DETECTED');
  const advance = await fixture.runner.execute(
    request('ADVANCE_SYNTHETIC_EPOCH_1_TO_2'),
  );
  assert.equal(advance.epoch, 2);
  const stale = await fixture.runner.execute({
    ...request('READ_SYNTHETIC_APPROVAL'),
    request_id: 'request_read_synthetic_approval_after_advance',
  });
  assert.equal(stale.approval_status, 'STALE');
  const jump = await fixture.runner.execute({
    ...request('ADVANCE_SYNTHETIC_EPOCH_1_TO_2'),
    request_id: 'request_illegal_second_advance',
  });
  assert.equal(jump.ok, false);
  assert.equal(jump.code, 'OPERATIONAL_RUNNER_EPOCH_CONFLICT');
  const revoke = await fixture.runner.execute(
    request('REVOKE_SYNTHETIC_APPROVAL'),
  );
  assert.equal(revoke.approval_status, 'REVOKED');
  const revokedRead = await fixture.runner.execute({
    ...request('READ_SYNTHETIC_APPROVAL'),
    request_id: 'request_read_revoked_approval',
  });
  assert.equal(revokedRead.approval_status, 'REVOKED');
});

test('runtime expiry and flag changes revoke an already constructed runner without provider activity', async () => {
  const env = environment();
  const fixture = await runnerFixture({ env });
  env.MORE_SUBDEV1_OPERATOR_ENABLED = 'true';
  const result = await fixture.runner.execute(request('PROVIDER_HEALTH_CANARY'));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'OPERATIONAL_RUNNER_LOCKED');
  assert.equal(fixture.healthCalls.count, 0);
  assert.equal(fixture.provider.state.calls.length, 0);
});

test('disabled or incomplete configuration stops before adapter construction', async () => {
  let constructions = 0;
  const result = await buildPrivateLiveOperationalRunnerV1({
    env: environment({ MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY: undefined }),
    clock: () => now,
    authorityReader: async () => {
      throw new Error('must not resolve authority');
    },
    adapterFactory: () => {
      constructions += 1;
      return adapterSequence([], { count: 0 });
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'OPERATIONAL_RUNNER_CONFIGURATION_INVALID');
  assert.equal(constructions, 0);
});
