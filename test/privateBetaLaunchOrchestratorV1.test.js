import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createDeterministicDryRunDriverV1,
  createProductionPrivateBetaLaunchDriverV1,
  createPrivateBetaLaunchCheckpointV1,
  PRIVATE_BETA_PROTECTED_ATTESTATION_VERSION,
  PRIVATE_BETA_SUBDEV1_BINDINGS_VERSION,
  PRIVATE_BETA_LAUNCH_STAGES,
  privateBetaProtectedAttestationDigestV1,
  privateBetaSubdev1BindingSetDigestV1,
  readPrivateBetaLaunchCheckpointV1,
  readPrivateBetaLaunchCustodyV1,
  readPrivateBetaProtectedAttestationV1,
  readPrivateBetaSubdev1BindingsV1,
  resetPrivateBetaLaunchCheckpointFromStageV1,
  runPrivateBetaLaunchOrchestratorV1,
  validatePrivateBetaProtectedAttestationV1,
  validatePrivateBetaSubdev1BindingsV1,
  validatePrivacySafeLaunchReceiptV1,
  writePrivateBetaLaunchCustodyV1,
} from '../scripts/privateBetaLaunchOrchestratorV1.mjs';

const sourceCommit = '8'.repeat(40);
const fixedClock = () => '2000-01-01T00:00:00.000Z';
const productionNow = Date.parse('2026-08-02T12:00:00.000Z');
const expectedTree = '9'.repeat(40);
const protectedMetadataNames = Object.freeze([
  'MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY',
  'MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256',
  'MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256',
  'MORE_PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_PACKET_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_CONFIG_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_QUALIFICATION_CERTIFICATE_REF',
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_ATTESTATION_REF',
  'MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_ATTESTATION_REF',
  'MORE_PRIVATE_RUNTIME_ASSERTION_CONFIGURATION_REF',
  'MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_CONFIGURATION_REF',
  'MORE_PRIVATE_RUNTIME_PRODUCT_EXECUTION_BINDING_REF',
  'REDIS_URL',
  'MORE_PRIVATE_RUNTIME_LIVE_ENABLED',
  'MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED',
  'MORE_SUBDEV1_OPERATOR_ENABLED',
]);
const subdev1Names = Object.freeze([
  'MORE_SUBDEV1_OPERATOR_CODE',
  'MORE_SUBDEV1_OPERATOR_SIGNING_SECRET',
  'MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS',
  'MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID',
]);
const protectedDigestNames = Object.freeze([
  'configuration_authority_packet',
  'remote_security_configuration',
  'qualification_certificate',
  'live_environment_attestation',
  'product_binding_attestation',
  'assertion_configuration',
  'protected_edge_configuration',
  'product_execution_binding',
  'qualified_adapter_source',
]);

function expectedProject(repositoryRoot = path.resolve('.')) {
  const repo = JSON.parse(fs.readFileSync(path.join(repositoryRoot, '.vercel', 'repo.json'), 'utf8'));
  const project = repo.projects.find((entry) => entry.directory === '.');
  return {
    project_id: project.id,
    project_name: project.name,
    team_id: project.orgId,
  };
}

function subdev1Bindings(overrides = {}) {
  return {
    binding_version: PRIVATE_BETA_SUBDEV1_BINDINGS_VERSION,
    operator_code: 'qualification-code-not-a-production-secret',
    signing_secret: 'qualification-signing-material-at-least-thirty-two-chars',
    allowed_origins: 'https://moremindmap.com',
    environment_id: 'PRIVATE_BETA_QUALIFICATION',
    ...overrides,
  };
}

function protectedAttestation({
  expectedCommit,
  tree = expectedTree,
  project = expectedProject(),
  bindings = subdev1Bindings(),
  ttl = null,
  issuedAt = '2026-08-02T11:59:00.000Z',
  expiresAt = '2026-08-02T12:30:00.000Z',
  flags = null,
} = {}) {
  const value = {
    attestation_version: PRIVATE_BETA_PROTECTED_ATTESTATION_VERSION,
    expected_commit: expectedCommit,
    expected_tree: tree,
    expected_project: project,
    expected_default_off_flags: flags || {
      private_runtime_live_enabled: false,
      private_runtime_emergency_disabled: false,
      subdev1_operator_enabled: false,
    },
    expected_immutable_deployment_identity: 'b'.repeat(64),
    expected_protected_document_digests: Object.fromEntries(
      protectedDigestNames.map((name, index) => [name, String(index + 1).repeat(64).slice(0, 64)]),
    ),
    expected_namespace: 'moremindmap:private-beta:v1',
    expected_product_store_reference: 'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_REDIS_URL',
    expected_provider_endpoint_reference: 'MORE_PRIVATE_RUNTIME_PROVIDER_ENDPOINT_VALUE',
    expected_provider_credential_reference: 'MORE_PRIVATE_RUNTIME_PROVIDER_CREDENTIAL_VALUE',
    subdev1_binding_set_sha256: privateBetaSubdev1BindingSetDigestV1(bindings),
    expected_optional_ttl_seconds: ttl,
    issued_at: issuedAt,
    expires_at: expiresAt,
    attestation_sha256: '',
  };
  value.attestation_sha256 = privateBetaProtectedAttestationDigestV1(value);
  return value;
}

function protectedInput(t, name, value) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-stage2-protected-'));
  const target = path.join(directory, name);
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  fs.chmodSync(target, 0o600);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return target;
}

function metadataPayload({ subdev1Present = true, ttlPresent = false, omit = [] } = {}) {
  const names = [
    ...protectedMetadataNames,
    ...(subdev1Present ? subdev1Names : []),
    ...(ttlPresent ? ['MORE_SUBDEV1_OPERATOR_TTL_SECONDS'] : []),
  ].filter((name) => !omit.includes(name));
  return {
    envs: names.map((key) => ({ key, type: 'sensitive', target: ['production'] })),
  };
}

function temporaryCheckpoint(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-launch-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, 'checkpoint.json');
}

function passingDriver(calls = []) {
  return {
    async runStage(stage) {
      calls.push(stage.id);
      return {
        ok: true,
        receipt: {
          stage_id: stage.id,
          invocation_count: calls.filter((value) => value === stage.id).length,
        },
      };
    },
  };
}

function curlResponse(payload, status = 200) {
  return { stdout: `${JSON.stringify(payload)}\n${status}`, stderr: '' };
}

function dotenv(values) {
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function productionCommandFixture({
  expectedCommit,
  custodyPath,
  subdev1Present = true,
  ttlPresent = false,
  omittedMetadata = [],
  metadataOverrides = {},
  failSubdev1WriteAt = null,
  providerCanaryPayload = null,
} = {}) {
  const calls = [];
  const metadataNames = new Set(
    metadataPayload({ subdev1Present, ttlPresent, omit: omittedMetadata })
      .envs.map((entry) => entry.key),
  );
  let runnerCall = 0;
  const deploymentUrl = 'https://moremindmap-launch-test.vercel.app';
  const fixtureHash = 'c'.repeat(64);
  const vaultHash = 'd'.repeat(64);
  const assessmentHash = 'e'.repeat(64);
  const pointerHash = 'f'.repeat(64);
  const proofHash = '1'.repeat(64);
  const scopeHash = '2'.repeat(64);
  const commandRunner = async (binary, args, options = {}) => {
    calls.push({ binary, args: [...args], input: options.input });
    if (binary === 'git' && args[0] === 'rev-parse' && args[1] === 'HEAD^{tree}') {
      return { stdout: `${expectedTree}\n`, stderr: '' };
    }
    if (binary === 'git' && args[0] === 'rev-parse') return { stdout: `${expectedCommit}\n`, stderr: '' };
    if (binary === 'git') return { stdout: '', stderr: '' };
    if (binary === 'vercel' && args[0] === 'env' && args[1] === 'ls') {
      return {
        stdout: JSON.stringify({
          envs: [...metadataNames].map((key) => ({
            key,
            type: metadataOverrides[key]?.type || 'sensitive',
            target: metadataOverrides[key]?.target || ['production'],
          })),
        }),
        stderr: '',
      };
    }
    if (binary === 'vercel' && args[0] === 'env' && args[1] === 'pull') {
      fs.writeFileSync(args[2], dotenv({
        MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY: JSON.stringify({ enabled: false }),
      }), { mode: 0o600 });
      return { stdout: '', stderr: '' };
    }
    if (binary === 'vercel' && args[0] === 'env' && args[1] === 'add') {
      const variableName = args[2];
      if (variableName === 'MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY') {
        assert.equal(fs.existsSync(custodyPath), true, 'custody must precede authority write');
        assert.equal(args.includes(JSON.parse(options.input).authorization_sha256), false);
      }
      const subdev1WriteNumber = calls.filter((entry) => (
        entry.binary === 'vercel'
          && entry.args[0] === 'env'
          && entry.args[1] === 'add'
          && subdev1Names.includes(entry.args[2])
      )).length;
      if (failSubdev1WriteAt === subdev1WriteNumber) throw new Error('SIMULATED_WRITE_FAILURE');
      assert.equal(args.includes(String(options.input).trim()), false);
      metadataNames.add(variableName);
      return { stdout: '', stderr: '' };
    }
    if (binary === 'vercel' && args[0] === '--prod') {
      return { stdout: `${deploymentUrl}\n`, stderr: '' };
    }
    if (binary === 'vercel' && args[0] === 'ls') {
      return {
        stdout: JSON.stringify({
          deployments: [{
            uid: 'dpl_test',
            state: 'READY',
            target: 'production',
            url: deploymentUrl.replace('https://', ''),
            meta: { gitCommitSha: expectedCommit },
          }],
        }),
        stderr: '',
      };
    }
    if (binary !== 'curl') throw new Error('UNEXPECTED_COMMAND');
    runnerCall += 1;
    if (runnerCall === 1) return curlResponse({ ok: false, error: 'feature_unavailable' }, 404);
    if (runnerCall === 2) {
      return curlResponse({
        ok: true,
        status: 'CREATED',
        fixture_digest: fixtureHash,
        vault_record_hash: vaultHash,
        assessment_record_hash: assessmentHash,
        assessment_pointer_hash: pointerHash,
        idempotent: true,
        customer_data: false,
      });
    }
    if (runnerCall === 3) {
      if (providerCanaryPayload) return curlResponse(providerCanaryPayload, 403);
      return curlResponse({
        ok: true,
        provider_states: ['RECOVERING', 'RECOVERING', 'HEALTHY'],
        receipt_hashes: ['3'.repeat(64), '4'.repeat(64), '5'.repeat(64)],
        proof_storage_succeeded: true,
        proof_storage_receipt_hash: proofHash,
      });
    }
    const readiness = [
      { ok: true, epoch: 0, scope_hash: scopeHash },
      { ok: true, epoch: 1, scope_hash: scopeHash },
      { ok: true, epoch: 1, scope_hash: scopeHash },
      { ok: true, approval_status: 'ABSENT', scope_hash: scopeHash },
      { ok: true, approval_status: 'ACTIVE', scope_hash: scopeHash },
      { ok: true, approval_status: 'ACTIVE', scope_hash: scopeHash },
    ];
    return curlResponse(readiness[runnerCall - 4]);
  };
  return { calls, commandRunner, deploymentUrl };
}

test('production driver checkpoints only the approved provider response-shape diagnostic', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const custodyPath = `${checkpointPath}.custody`;
  const expectedCommit = '4'.repeat(40);
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
  const stageReceipt = {
    receipt_version: 'private-beta-launch-stage-receipt-v1',
    stage: 'PROOF_STORAGE',
    status: 'FAILED',
    stop_code: 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED',
    provider_health_call_count: 3,
    expected_provider_state: 'HEALTHY',
    observed_provider_state: 'HEALTHY',
    provider_failure_code: 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED',
    proof_storage_attempted: true,
    proof_storage_succeeded: false,
  };
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath,
    providerCanaryPayload: {
      ok: false,
      error: 'request_denied',
      stage_receipt: stageReceipt,
      provider_proof_diagnostic: diagnostic,
    },
  });
  const protectedAttestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit }),
  );
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath,
    protectedAttestationPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await runPrivateBetaLaunchOrchestratorV1({
    driver,
    checkpointPath,
    sourceCommit: expectedCommit,
    runId: 'provider_shape_diagnostic_v1',
    mode: 'execute',
    clock: () => '2026-08-02T12:00:00.000Z',
  });
  assert.equal(result.final_stop_code, 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED');
  const canary = result.stages.find((stage) => stage.stage_id === 'PROVIDER_CANARY');
  assert.deepEqual(canary.receipt, {
    ...stageReceipt,
    provider_proof_diagnostic: diagnostic,
  });
  assert.equal(JSON.stringify(result).includes('provider response body'), false);
});

test('production driver drops a diagnostic wider than the privacy-safe checkpoint bound', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const custodyPath = `${checkpointPath}.custody`;
  const expectedCommit = '3'.repeat(40);
  const stageReceipt = {
    receipt_version: 'private-beta-launch-stage-receipt-v1',
    stage: 'PROOF_STORAGE',
    status: 'FAILED',
    stop_code: 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED',
    provider_health_call_count: 3,
    expected_provider_state: 'HEALTHY',
    observed_provider_state: 'HEALTHY',
    provider_failure_code: 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED',
    proof_storage_attempted: true,
    proof_storage_succeeded: false,
  };
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath,
    providerCanaryPayload: {
      ok: false,
      error: 'request_denied',
      stage_receipt: stageReceipt,
      provider_proof_diagnostic: {
        field_count: 33,
        field_name_digest: 'a'.repeat(64),
        field_type_classes: Array.from({ length: 33 }, () => 'string'),
        failed_predicate_id: 'EXACT_FIELD_SET_MISMATCH',
      },
    },
  });
  const protectedAttestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit }),
  );
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath,
    protectedAttestationPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await runPrivateBetaLaunchOrchestratorV1({
    driver,
    checkpointPath,
    sourceCommit: expectedCommit,
    runId: 'provider_shape_bound_v1',
    mode: 'execute',
    clock: () => '2026-08-02T12:00:00.000Z',
  });
  assert.equal(result.final_stop_code, 'CANARY_PROOF_RECEIPT_VALIDATION_FAILED');
  const canary = result.stages.find((stage) => stage.stage_id === 'PROVIDER_CANARY');
  assert.deepEqual(canary.receipt, stageReceipt);
});

test('deterministic dry run and replay produce byte-identical checkpoints', async (t) => {
  const firstPath = temporaryCheckpoint(t);
  const secondPath = temporaryCheckpoint(t);
  const options = {
    driver: createDeterministicDryRunDriverV1(),
    sourceCommit,
    mode: 'dry-run',
    runId: 'deterministic_dry_run_v1',
    clock: fixedClock,
  };
  const first = await runPrivateBetaLaunchOrchestratorV1({
    ...options,
    checkpointPath: firstPath,
  });
  const second = await runPrivateBetaLaunchOrchestratorV1({
    ...options,
    checkpointPath: secondPath,
  });
  assert.equal(first.final_status, 'DRY_RUN_COMPLETE');
  assert.deepEqual(first, second);
  assert.equal(fs.readFileSync(firstPath, 'utf8'), fs.readFileSync(secondPath, 'utf8'));
  assert.equal(first.stages.every((stage) => (
    stage.status === 'SKIPPED' && stage.stop_code === 'DRY_RUN_NO_SIDE_EFFECT'
  )), true);
  assert.equal(first.stages.every((stage) => (
    stage.status_history.includes('STARTED') && stage.status_history.includes('SKIPPED')
  )), true);
});

test('checkpoint resume skips prior passes and continues at the first failed stage', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const checkpoint = createPrivateBetaLaunchCheckpointV1({
    runId: 'resume_launch_v1',
    sourceCommit,
    now: fixedClock(),
  });
  checkpoint.stages[0] = {
    ...checkpoint.stages[0],
    status: 'PASSED',
    attempt_count: 1,
    started_at: fixedClock(),
    completed_at: fixedClock(),
    receipt: { verified: true },
    status_history: ['PENDING', 'STARTED', 'PASSED'],
  };
  const calls = [];
  const result = await runPrivateBetaLaunchOrchestratorV1({
    driver: passingDriver(calls),
    checkpointPath,
    checkpoint,
    sourceCommit,
    mode: 'execute',
    resume: true,
    clock: fixedClock,
  });
  assert.equal(result.final_status, 'PASSED');
  assert.equal(result.stages[0].status, 'SKIPPED');
  assert.equal(result.stages[0].stop_code, 'RESUME_PRIOR_PASS');
  assert.equal(calls.includes(PRIVATE_BETA_LAUNCH_STAGES[0].id), false);
  assert.equal(calls.length, PRIVATE_BETA_LAUNCH_STAGES.length - 1);
});

test('failure injection runs once, checkpoints exact stop, and skips downstream stages', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const calls = [];
  const failedStage = 'PROVIDER_CANARY';
  const result = await runPrivateBetaLaunchOrchestratorV1({
    driver: passingDriver(calls),
    checkpointPath,
    sourceCommit,
    runId: 'failure_injection_v1',
    mode: 'execute',
    failureStage: failedStage,
    clock: fixedClock,
  });
  assert.equal(result.final_status, 'FAILED');
  assert.equal(result.final_stop_code, 'INJECTED_STAGE_FAILURE');
  const failed = result.stages.find((stage) => stage.stage_id === failedStage);
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.attempt_count, 1);
  assert.equal(calls.includes(failedStage), false);
  assert.equal(result.stages.slice(failed.stage_number).every((stage) => (
    stage.status === 'SKIPPED' && stage.stop_code === 'UPSTREAM_STAGE_FAILED'
  )), true);
  assert.deepEqual(readPrivateBetaLaunchCheckpointV1(checkpointPath), result);
});

test('checkpoint and receipt contracts reject secrets and never store driver custody values', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  assert.equal(validatePrivacySafeLaunchReceiptV1({ provider_state: 'HEALTHY' }), true);
  assert.equal(validatePrivacySafeLaunchReceiptV1({ access_token: 'not-allowed' }), false);
  assert.equal(validatePrivacySafeLaunchReceiptV1({ value: 'redis://not-allowed' }), false);
  const result = await runPrivateBetaLaunchOrchestratorV1({
    driver: passingDriver([]),
    checkpointPath,
    sourceCommit,
    runId: 'custody_boundary_v1',
    mode: 'execute',
    clock: fixedClock,
  });
  assert.equal(result.final_status, 'PASSED');
  const serialized = fs.readFileSync(checkpointPath, 'utf8');
  assert.equal(/authorization|credential|password|secret|token|cookie/i.test(serialized), false);
  assert.equal((fs.statSync(checkpointPath).mode & 0o777), 0o600);
});

test('runner authorization custody is separate, mode-600, resumable, and expiry-bound', (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const custodyPath = `${checkpointPath}.custody`;
  const runnerAuthorization = 'qualification-runner-material-1234567890';
  writePrivateBetaLaunchCustodyV1(custodyPath, {
    runnerAuthorization,
    immutableDeployment: 'd'.repeat(64),
    sourceCommit,
    expiresAtMs: 2_000,
  });
  assert.equal((fs.statSync(custodyPath).mode & 0o777), 0o600);
  assert.equal(readPrivateBetaLaunchCustodyV1(custodyPath, {
    nowMs: 1_000,
    expectedCommit: sourceCommit,
  }).runner_authorization, runnerAuthorization);
  assert.throws(() => readPrivateBetaLaunchCustodyV1(custodyPath, {
    nowMs: 2_000,
  }), /RUNNER_CUSTODY_EXPIRED/);
  assert.equal(fs.existsSync(checkpointPath), false);
});

test('expired custody resume explicitly invalidates runner refresh and every dependent stage', () => {
  const checkpoint = createPrivateBetaLaunchCheckpointV1({
    runId: 'expired_custody_resume_v1',
    sourceCommit,
    now: fixedClock(),
  });
  for (const record of checkpoint.stages) {
    record.status = 'PASSED';
    record.status_history.push('STARTED', 'PASSED');
    record.attempt_count = 1;
    record.started_at = fixedClock();
    record.completed_at = fixedClock();
    record.receipt = { verified: true };
  }
  checkpoint.final_status = 'PASSED';
  const reset = resetPrivateBetaLaunchCheckpointFromStageV1(
    checkpoint,
    'RUNNER_AUTHORITY_REFRESH',
    { stopCode: 'RUNNER_CUSTODY_EXPIRED' },
  );
  assert.equal(reset.stages.slice(0, 2).every((record) => record.status === 'PASSED'), true);
  assert.equal(reset.stages.slice(2).every((record) => (
    record.status === 'PENDING'
      && record.stop_code === 'RUNNER_CUSTODY_EXPIRED'
      && record.status_history.at(-1) === 'PENDING'
  )), true);
  assert.equal(reset.final_status, 'IN_PROGRESS');
  assert.equal(checkpoint.final_status, 'PASSED');
});

test('resume can deterministically reissue Stage 2 attestation after the pre-custody crash window', () => {
  const checkpoint = createPrivateBetaLaunchCheckpointV1({
    runId: 'stage2_reissue_resume_v1',
    sourceCommit,
    now: fixedClock(),
  });
  for (let index = 0; index < 2; index += 1) {
    checkpoint.stages[index].status = 'PASSED';
    checkpoint.stages[index].status_history.push('STARTED', 'PASSED');
    checkpoint.stages[index].attempt_count = 1;
    checkpoint.stages[index].started_at = fixedClock();
    checkpoint.stages[index].completed_at = fixedClock();
    checkpoint.stages[index].receipt = { verified: true };
  }
  const reset = resetPrivateBetaLaunchCheckpointFromStageV1(
    checkpoint,
    'PROTECTED_CONFIGURATION_VERIFICATION',
    { stopCode: 'PROTECTED_ATTESTATION_REISSUE_REQUIRED' },
  );
  assert.equal(reset.stages[0].status, 'PASSED');
  assert.equal(reset.stages.slice(1).every((record) => (
    record.status === 'PENDING'
      && record.stop_code === 'PROTECTED_ATTESTATION_REISSUE_REQUIRED'
  )), true);
});

test('Stage 2 accepts fifteen unreadable sensitive metadata records and optional TTL absence', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const fixture = productionCommandFixture({ expectedCommit, custodyPath: `${checkpointPath}.custody` });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit }),
  );
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  assert.equal(result.ok, true);
  assert.equal(
    result.receipt.protected_configuration_metadata_result,
    'PROTECTED_CONFIGURATION_METADATA_PRESENT',
  );
  assert.equal(
    result.receipt.protected_configuration_attestation_result,
    'PROTECTED_CONFIGURATION_ATTESTATION_VALID',
  );
  assert.equal(result.receipt.subdev1_required_binding_result, 'SUBDEV1_REQUIRED_BINDINGS_PRESENT');
  assert.equal(result.receipt.optional_ttl_result, 'OPTIONAL_TTL_ABSENT_ACCEPTED');
  assert.equal(result.receipt.required_reference_count, 15);
  assert.equal(result.receipt.environment_change_count, 0);
  assert.equal(fs.existsSync(attestationPath), false);
  assert.equal(fixture.calls.some((entry) => entry.args.includes('pull')), false);
});

test('Stage 2 fails when one required sensitive metadata record is absent', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    omittedMetadata: ['MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256'],
  });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit }),
  );
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  assert.equal(result.ok, false);
  assert.equal(result.stop_code, 'PROTECTED_CONFIGURATION_METADATA_MISSING');
  assert.equal(result.receipt.missing_reference_count, 1);
  assert.equal(fs.existsSync(attestationPath), false);
});

test('Stage 2 rejects a required record with the wrong classification or target', async (t) => {
  const expectedCommit = '4'.repeat(40);
  for (const metadataOverrides of [
    { REDIS_URL: { type: 'encrypted', target: ['production'] } },
    { REDIS_URL: { type: 'sensitive', target: ['preview'] } },
  ]) {
    const checkpointPath = temporaryCheckpoint(t);
    const fixture = productionCommandFixture({
      expectedCommit,
      custodyPath: `${checkpointPath}.custody`,
      metadataOverrides,
    });
    const attestationPath = protectedInput(
      t,
      'attestation.json',
      protectedAttestation({ expectedCommit }),
    );
    const driver = createProductionPrivateBetaLaunchDriverV1({
      repositoryRoot: path.resolve('.'),
      expectedCommit,
      custodyPath: `${checkpointPath}.custody`,
      protectedAttestationPath: attestationPath,
      now: () => productionNow,
      commandRunner: fixture.commandRunner,
    });
    const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
    assert.equal(result.ok, false);
    assert.equal(result.stop_code, 'PROTECTED_CONFIGURATION_METADATA_MISSING');
    assert.equal(result.receipt.missing_reference_count, 1);
  }
});

test('Stage 2 rejects missing, malformed, expired, and commit-mismatched attestations', async (t) => {
  const expectedCommit = '4'.repeat(40);
  const cases = [
    { name: 'missing', value: null, stop: 'PROTECTED_ATTESTATION_MISSING' },
    { name: 'malformed', value: '{', stop: 'PROTECTED_ATTESTATION_INVALID' },
    {
      name: 'expired',
      value: protectedAttestation({
        expectedCommit,
        issuedAt: '2026-08-02T10:00:00.000Z',
        expiresAt: '2026-08-02T11:00:00.000Z',
      }),
      stop: 'PROTECTED_ATTESTATION_EXPIRED',
    },
    {
      name: 'future-issued',
      value: protectedAttestation({
        expectedCommit,
        issuedAt: '2099-01-01T00:00:00.000Z',
        expiresAt: '2099-01-01T01:00:00.000Z',
      }),
      stop: 'PROTECTED_ATTESTATION_INVALID',
    },
    {
      name: 'mismatch',
      value: protectedAttestation({ expectedCommit: '3'.repeat(40) }),
      stop: 'PROTECTED_ATTESTATION_BINDING_MISMATCH',
    },
    {
      name: 'project-mismatch',
      value: protectedAttestation({
        expectedCommit,
        project: { ...expectedProject(), team_id: 'team_wrong' },
      }),
      stop: 'PROTECTED_ATTESTATION_BINDING_MISMATCH',
    },
  ];
  for (const scenario of cases) {
    const checkpointPath = temporaryCheckpoint(t);
    const fixture = productionCommandFixture({
      expectedCommit,
      custodyPath: `${checkpointPath}.custody`,
    });
    let attestationPath = null;
    if (scenario.value !== null) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-stage2-attestation-case-'));
      t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
      attestationPath = path.join(directory, `${scenario.name}.json`);
      fs.writeFileSync(
        attestationPath,
        typeof scenario.value === 'string' ? scenario.value : JSON.stringify(scenario.value),
        { mode: 0o600 },
      );
    }
    const driver = createProductionPrivateBetaLaunchDriverV1({
      repositoryRoot: path.resolve('.'),
      expectedCommit,
      custodyPath: `${checkpointPath}.custody`,
      protectedAttestationPath: attestationPath,
      now: () => productionNow,
      commandRunner: fixture.commandRunner,
    });
    const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
    assert.equal(result.ok, false, scenario.name);
    assert.equal(result.stop_code, scenario.stop, scenario.name);
    if (attestationPath) assert.equal(fs.existsSync(attestationPath), false, scenario.name);
  }
});

test('Stage 2 reports the exact four absent SUBDEV1 names without writing', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    subdev1Present: false,
  });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit }),
  );
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  assert.equal(result.ok, false);
  assert.equal(result.stop_code, 'SUBDEV1_REQUIRED_BINDINGS_MISSING');
  assert.deepEqual(result.receipt.missing_binding_names, [...subdev1Names]);
  assert.equal(result.receipt.environment_change_count, 0);
  assert.equal(fixture.calls.some((entry) => entry.args[1] === 'add'), false);
});

test('Stage 2 securely binds exactly four absent SUBDEV1 values through stdin', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const bindings = subdev1Bindings();
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    subdev1Present: false,
  });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit, bindings }),
  );
  const bindingsPath = protectedInput(t, 'bindings.json', bindings);
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    subdev1BindingsPath: bindingsPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  const writes = fixture.calls.filter((entry) => entry.args[1] === 'add');
  assert.equal(result.ok, true);
  assert.equal(result.receipt.environment_change_count, 4);
  assert.deepEqual(writes.map((entry) => entry.args[2]), [...subdev1Names]);
  assert.equal(writes.every((entry) => entry.args[3] === 'production'), true);
  for (const value of [
    bindings.operator_code,
    bindings.signing_secret,
    bindings.allowed_origins,
    bindings.environment_id,
  ]) {
    assert.equal(writes.some((entry) => entry.args.includes(value)), false);
    assert.equal(JSON.stringify(result).includes(value), false);
  }
  assert.equal(fs.existsSync(attestationPath), false);
  assert.equal(fs.existsSync(bindingsPath), false);
});

test('Stage 2 reports exact partial-write failure and completed-write count', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const bindings = subdev1Bindings();
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    subdev1Present: false,
    failSubdev1WriteAt: 2,
  });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit, bindings }),
  );
  const bindingsPath = protectedInput(t, 'bindings.json', bindings);
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    subdev1BindingsPath: bindingsPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  assert.equal(result.ok, false);
  assert.equal(result.stop_code, 'SUBDEV1_REQUIRED_BINDINGS_WRITE_FAILED');
  assert.equal(result.receipt.environment_change_count, 1);
  assert.equal(fs.existsSync(attestationPath), false);
  assert.equal(fs.existsSync(bindingsPath), false);
});

test('Stage 2 accepts present optional TTL only with a valid attested TTL', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    ttlPresent: true,
  });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit, ttl: 900 }),
  );
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  assert.equal(result.ok, true);
  assert.equal(result.receipt.optional_ttl_result, 'OPTIONAL_TTL_PRESENT_VALID');
});

test('Stage 2 rejects an invalid optional TTL attestation', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const bindings = subdev1Bindings();
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    ttlPresent: true,
    subdev1Present: false,
  });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit, ttl: 30 }),
  );
  const bindingsPath = protectedInput(t, 'bindings.json', bindings);
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    subdev1BindingsPath: bindingsPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  assert.equal(result.ok, false);
  assert.equal(result.stop_code, 'PROTECTED_ATTESTATION_INVALID');
  assert.equal(fixture.calls.some((entry) => entry.args[1] === 'add'), false);
});

test('Stage 2 rejects optional TTL metadata with the wrong sensitive classification', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const expectedCommit = '4'.repeat(40);
  const bindings = subdev1Bindings();
  const fixture = productionCommandFixture({
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    ttlPresent: true,
    subdev1Present: false,
    metadataOverrides: {
      MORE_SUBDEV1_OPERATOR_TTL_SECONDS: { type: 'encrypted', target: ['production'] },
    },
  });
  const attestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit, ttl: 900 }),
  );
  const bindingsPath = protectedInput(t, 'bindings.json', bindings);
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath: `${checkpointPath}.custody`,
    protectedAttestationPath: attestationPath,
    subdev1BindingsPath: bindingsPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
  assert.equal(result.ok, false);
  assert.equal(result.stop_code, 'OPTIONAL_TTL_METADATA_INVALID');
  assert.equal(fixture.calls.some((entry) => entry.args[1] === 'add'), false);
});

test('Stage 2 rejects an unexpected fifth protected binding field and active flags', async (t) => {
  const expectedCommit = '4'.repeat(40);
  const fifthFieldBindings = { ...subdev1Bindings(), unexpected_binding: 'not-authorized' };
  assert.equal(validatePrivateBetaSubdev1BindingsV1(fifthFieldBindings), false);
  for (const scenario of [
    {
      bindings: fifthFieldBindings,
      attestation: protectedAttestation({ expectedCommit, bindings: fifthFieldBindings }),
      stop: 'SUBDEV1_PROTECTED_BINDINGS_INVALID',
    },
    {
      bindings: subdev1Bindings(),
      attestation: protectedAttestation({
        expectedCommit,
        flags: {
          private_runtime_live_enabled: true,
          private_runtime_emergency_disabled: false,
          subdev1_operator_enabled: false,
        },
      }),
      stop: 'PROTECTED_ATTESTATION_INVALID',
    },
  ]) {
    const checkpointPath = temporaryCheckpoint(t);
    const fixture = productionCommandFixture({
      expectedCommit,
      custodyPath: `${checkpointPath}.custody`,
      subdev1Present: false,
    });
    const attestationPath = protectedInput(t, 'attestation.json', scenario.attestation);
    const bindingsPath = protectedInput(t, 'bindings.json', scenario.bindings);
    const driver = createProductionPrivateBetaLaunchDriverV1({
      repositoryRoot: path.resolve('.'),
      expectedCommit,
      custodyPath: `${checkpointPath}.custody`,
      protectedAttestationPath: attestationPath,
      subdev1BindingsPath: bindingsPath,
      now: () => productionNow,
      commandRunner: fixture.commandRunner,
    });
    const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[1]);
    assert.equal(result.ok, false);
    assert.equal(result.stop_code, scenario.stop);
    assert.equal(fixture.calls.some((entry) => entry.args[1] === 'add'), false);
  }
});

test('protected Stage 2 input contracts require exact schemas and secure external files', (t) => {
  const expectedCommit = '4'.repeat(40);
  const bindings = subdev1Bindings();
  const attestation = protectedAttestation({ expectedCommit, bindings });
  assert.equal(validatePrivateBetaSubdev1BindingsV1(bindings), true);
  assert.equal(validatePrivateBetaProtectedAttestationV1(attestation, {
    expectedCommit,
    expectedTree,
    expectedProject: expectedProject(),
    nowMs: productionNow,
  }), true);
  const attestationPath = protectedInput(t, 'attestation.json', attestation);
  const bindingsPath = protectedInput(t, 'bindings.json', bindings);
  assert.equal(readPrivateBetaProtectedAttestationV1(attestationPath, {
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    expectedTree,
    expectedProject: expectedProject(),
    nowMs: productionNow,
  }).attestation_sha256, attestation.attestation_sha256);
  assert.deepEqual(
    readPrivateBetaSubdev1BindingsV1(bindingsPath, { repositoryRoot: path.resolve('.') }),
    bindings,
  );
  fs.chmodSync(bindingsPath, 0o644);
  assert.throws(() => readPrivateBetaSubdev1BindingsV1(
    bindingsPath,
    { repositoryRoot: path.resolve('.') },
  ), /SUBDEV1_PROTECTED_BINDINGS_INVALID/);
  fs.chmodSync(bindingsPath, 0o600);
  const symbolicPath = path.join(path.dirname(bindingsPath), 'bindings-link.json');
  fs.symlinkSync(bindingsPath, symbolicPath);
  assert.throws(() => readPrivateBetaSubdev1BindingsV1(
    symbolicPath,
    { repositoryRoot: path.resolve('.') },
  ), /SUBDEV1_PROTECTED_BINDINGS_INVALID/);
  const fakeRepositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-stage2-fake-repo-'));
  const protectedRepositoryFile = path.join(fakeRepositoryRoot, 'protected-input.json');
  fs.writeFileSync(protectedRepositoryFile, `${JSON.stringify(bindings)}\n`, { mode: 0o600 });
  fs.chmodSync(protectedRepositoryFile, 0o600);
  const repositoryAliasRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mmm-stage2-repo-alias-'));
  const repositoryAlias = path.join(repositoryAliasRoot, 'repository');
  fs.symlinkSync(fakeRepositoryRoot, repositoryAlias, 'dir');
  t.after(() => fs.rmSync(fakeRepositoryRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(repositoryAliasRoot, { recursive: true, force: true }));
  assert.throws(() => readPrivateBetaSubdev1BindingsV1(
    path.join(repositoryAlias, 'protected-input.json'),
    { repositoryRoot: fakeRepositoryRoot },
  ), /SUBDEV1_PROTECTED_BINDINGS_INVALID/);
});

test('production driver executes all thirteen stages with one curl transport and recoverable deployment reference', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const custodyPath = `${checkpointPath}.custody`;
  const expectedCommit = '7'.repeat(40);
  const fixture = productionCommandFixture({ expectedCommit, custodyPath });
  const protectedAttestationPath = protectedInput(
    t,
    'attestation.json',
    protectedAttestation({ expectedCommit }),
  );
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath,
    protectedAttestationPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
    controlledEnablement: async () => ({
      ok: true,
      receipt: {
        runtime_ready: true,
        public_access: false,
        source_default_off: true,
      },
    }),
  });
  const result = await runPrivateBetaLaunchOrchestratorV1({
    driver,
    checkpointPath,
    sourceCommit: expectedCommit,
    runId: 'production_driver_test_v1',
    mode: 'execute',
    clock: () => '2026-08-02T12:00:00.000Z',
  });
  assert.equal(result.final_status, 'PASSED');
  assert.equal(fs.existsSync(protectedAttestationPath), false);
  assert.equal(result.stages.every((stage) => stage.status === 'PASSED'), true);
  assert.equal(
    result.stages.find((stage) => stage.stage_id === 'DEPLOYMENT')
      .receipt.deployment_reference,
    fixture.deploymentUrl,
  );
  assert.equal(fixture.calls.filter((entry) => entry.binary === 'curl').length, 9);
  assert.equal(fixture.calls.filter((entry) => (
    entry.binary === 'vercel' && entry.args[0] === 'env' && entry.args[1] === 'add'
  )).length, 1);
  assert.equal(fixture.calls.filter((entry) => (
    entry.binary === 'vercel' && entry.args[0] === '--prod'
  )).length, 1);
  const custody = readPrivateBetaLaunchCustodyV1(custodyPath, {
    nowMs: productionNow,
    expectedCommit,
  });
  assert.equal(fixture.calls.some((entry) => (
    entry.args.includes(custody.runner_authorization)
  )), false);
  driver.clearSecrets({ destroy: true });
  assert.equal(fs.existsSync(custodyPath), false);
});

test('production driver resume verifies the exact prior deployment instead of selecting a stale commit match', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const custodyPath = `${checkpointPath}.custody`;
  const expectedCommit = '6'.repeat(40);
  const fixture = productionCommandFixture({ expectedCommit, custodyPath });
  writePrivateBetaLaunchCustodyV1(custodyPath, {
    runnerAuthorization: 'resumable-authorization-material-123456789',
    immutableDeployment: 'b'.repeat(64),
    sourceCommit: expectedCommit,
    expiresAtMs: productionNow + 60_000,
  });
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const checkpoint = createPrivateBetaLaunchCheckpointV1({
    runId: 'deployment_resume_v1',
    sourceCommit: expectedCommit,
    now: '2026-08-02T12:00:00.000Z',
  });
  checkpoint.stages[3] = {
    ...checkpoint.stages[3],
    status: 'PASSED',
    attempt_count: 1,
    started_at: '2026-08-02T12:00:00.000Z',
    completed_at: '2026-08-02T12:00:00.000Z',
    receipt: {
      deployment_reference_hash: '8'.repeat(64),
      deployment_reference: fixture.deploymentUrl,
      deployment_requested: true,
      source_commit: expectedCommit,
    },
    status_history: ['PENDING', 'STARTED', 'PASSED'],
  };
  const verified = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[4], { state: checkpoint });
  assert.equal(verified.ok, true);
  assert.equal(verified.receipt.source_commit, expectedCommit);
});

test('custody mismatch fails closed without a second runner-authority environment write', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const custodyPath = `${checkpointPath}.custody`;
  const expectedCommit = '5'.repeat(40);
  writePrivateBetaLaunchCustodyV1(custodyPath, {
    runnerAuthorization: 'resumable-authorization-material-123456789',
    immutableDeployment: 'b'.repeat(64),
    sourceCommit: expectedCommit,
    expiresAtMs: productionNow + 60_000,
  });
  const fixture = productionCommandFixture({ expectedCommit, custodyPath });
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath,
    now: () => productionNow,
    commandRunner: fixture.commandRunner,
  });
  const result = await driver.runStage(PRIVATE_BETA_LAUNCH_STAGES[2], {
    state: createPrivateBetaLaunchCheckpointV1({
      runId: 'custody_mismatch_v1',
      sourceCommit: expectedCommit,
      now: '2026-08-02T12:00:00.000Z',
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.stop_code, 'RUNNER_CUSTODY_BINDING_MISMATCH');
  assert.equal(fixture.calls.some((entry) => (
    entry.binary === 'vercel' && entry.args[0] === 'env' && entry.args[1] === 'add'
  )), false);
});
