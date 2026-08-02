import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createDeterministicDryRunDriverV1,
  createProductionPrivateBetaLaunchDriverV1,
  createPrivateBetaLaunchCheckpointV1,
  PRIVATE_BETA_LAUNCH_STAGES,
  readPrivateBetaLaunchCheckpointV1,
  readPrivateBetaLaunchCustodyV1,
  resetPrivateBetaLaunchCheckpointFromStageV1,
  runPrivateBetaLaunchOrchestratorV1,
  validatePrivacySafeLaunchReceiptV1,
  writePrivateBetaLaunchCustodyV1,
} from '../scripts/privateBetaLaunchOrchestratorV1.mjs';

const sourceCommit = '8'.repeat(40);
const fixedClock = () => '2000-01-01T00:00:00.000Z';
const productionNow = Date.parse('2026-08-02T12:00:00.000Z');

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

function protectedEnvironment(expectedCommit) {
  return {
    MORE_PRIVATE_RUNTIME_OPERATIONAL_RUNNER_AUTHORITY: JSON.stringify({ enabled: false }),
    MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256: 'a'.repeat(64),
    MORE_PRIVATE_RUNTIME_IMMUTABLE_DEPLOYMENT_SHA256: 'b'.repeat(64),
    MORE_PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_PACKET_REF: 'MORE_PRIVATE_RUNTIME_PACKET_VALUE',
    MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_CONFIG_REF: 'MORE_PRIVATE_RUNTIME_REMOTE_CONFIG_VALUE',
    MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_QUALIFICATION_CERTIFICATE_REF: 'MORE_PRIVATE_RUNTIME_CERTIFICATE_VALUE',
    MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_ATTESTATION_REF: 'MORE_PRIVATE_RUNTIME_ATTESTATION_VALUE',
    MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_ATTESTATION_REF: 'MORE_PRIVATE_RUNTIME_PRODUCT_VALUE',
    MORE_PRIVATE_RUNTIME_ASSERTION_CONFIGURATION_REF: 'MORE_PRIVATE_RUNTIME_ASSERTION_VALUE',
    MORE_PRIVATE_RUNTIME_PROTECTED_EDGE_CONFIGURATION_REF: 'MORE_PRIVATE_RUNTIME_EDGE_VALUE',
    MORE_PRIVATE_RUNTIME_PRODUCT_EXECUTION_BINDING_REF: 'MORE_PRIVATE_RUNTIME_EXECUTION_VALUE',
    REDIS_URL: 'redacted-present-reference',
    MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'false',
    MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED: 'false',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'false',
    MORE_SUBDEV1_OPERATOR_CODE: 'redacted-present-reference',
    MORE_SUBDEV1_OPERATOR_SIGNING_SECRET: 'redacted-present-reference',
    MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: 'https://moremindmap.com',
    MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: 'PRIVATE_PRODUCTION_CLASSIFIED',
    MORE_SUBDEV1_OPERATOR_TTL_SECONDS: '900',
    TEST_EXPECTED_COMMIT: expectedCommit,
  };
}

function dotenv(values) {
  return `${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`;
}

function curlResponse(payload, status = 200) {
  return { stdout: `${JSON.stringify(payload)}\n${status}`, stderr: '' };
}

function productionCommandFixture({ expectedCommit, custodyPath }) {
  const calls = [];
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
    if (binary === 'git' && args[0] === 'rev-parse') return { stdout: `${expectedCommit}\n`, stderr: '' };
    if (binary === 'git') return { stdout: '', stderr: '' };
    if (binary === 'vercel' && args[0] === 'env' && args[1] === 'pull') {
      fs.writeFileSync(args[2], dotenv(protectedEnvironment(expectedCommit)), { mode: 0o600 });
      return { stdout: '', stderr: '' };
    }
    if (binary === 'vercel' && args[0] === 'env' && args[1] === 'add') {
      assert.equal(fs.existsSync(custodyPath), true, 'custody must precede environment write');
      assert.equal(args.includes(JSON.parse(options.input).authorization_sha256), false);
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

test('production driver executes all thirteen stages with one curl transport and recoverable deployment reference', async (t) => {
  const checkpointPath = temporaryCheckpoint(t);
  const custodyPath = `${checkpointPath}.custody`;
  const expectedCommit = '7'.repeat(40);
  const fixture = productionCommandFixture({ expectedCommit, custodyPath });
  const driver = createProductionPrivateBetaLaunchDriverV1({
    repositoryRoot: path.resolve('.'),
    expectedCommit,
    custodyPath,
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
