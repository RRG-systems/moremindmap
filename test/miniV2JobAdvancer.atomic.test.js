import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { advanceMiniV2JobOnce } from '../api/engine/miniV2JobAdvancer.js';
import {
  acquireJobExecutionLease,
  claimLegacyJobExecutionLock,
  ensureLegacyJobExecutionDrain,
  isStaleLock,
  JOB_EXECUTION_PROTOCOL_VERSION,
  miniV2ExecutionActivationSha256,
  miniV2ExecutionAllowed,
  releaseLegacyJobExecutionLock,
  releaseJobExecutionLease,
  resolveMiniV2ExecutionActivationId,
} from '../api/engine/miniV2JobManager.js';

const ACTIVATION_ID = 'release-5-test-activation';
const ACTIVATION_SHA256 = miniV2ExecutionActivationSha256(ACTIVATION_ID);

test('the Release 5 runbook requires a fresh deployment activation after every rollback', () => {
  const runbook = fs.readFileSync(new URL('../docs/recruiting-v1/RELEASE_5_EXECUTION_ACTIVATION_RUNBOOK.md', import.meta.url), 'utf8');
  assert.match(runbook, /Never re-alias a previously used Release 5 deployment after any rollback/u);
  assert.match(runbook, /new Production-target[\s\S]*fresh activation ID/u);
  assert.match(runbook, /does not rewrite, delete, or\s+restore customer\/job state/u);
  assert.match(runbook, /advancement is denied on an unaliased\s+Production-target deployment/u);
  assert.match(runbook, /Direct Release 5 v2.*legacy v1 alias rollback is prohibited/u);
  assert.match(runbook, /wait at least 800 seconds/u);
});

test('Production execution fails closed without a fresh deployment activation ID', () => {
  assert.throws(
    () => resolveMiniV2ExecutionActivationId({ VERCEL_ENV: 'production', VERCEL_URL: 'candidate.example.vercel.app' }),
    /BOS_JOB_EXECUTION_ACTIVATION_ID_REQUIRED/u,
  );
  assert.equal(resolveMiniV2ExecutionActivationId({
    VERCEL_ENV: 'production',
    MINI_V2_EXECUTION_ACTIVATION_ID: 'production-activation-1',
  }), 'production-activation-1');
});

test('rollback quarantine overrides canonical Production execution authority', () => {
  assert.equal(miniV2ExecutionAllowed({
    env: { MINI_V2_EXECUTION_DISABLED: 'true' },
    productionTarget: true,
    canonicalProduction: true,
  }), false);
  assert.equal(miniV2ExecutionAllowed({
    env: { MINI_V2_EXECUTION_DISABLED: 'false' },
    productionTarget: true,
    canonicalProduction: true,
  }), true);
  assert.equal(miniV2ExecutionAllowed({
    env: {},
    productionTarget: true,
    canonicalProduction: false,
  }), false);
});

function fakeRedis() {
  const values = new Map();
  return {
    values,
    async set(key, value, px, ttl, nx) {
      assert.equal(px, 'PX');
      assert.equal(nx, 'NX');
      assert.ok(ttl >= 1000);
      if (values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    },
    serverNowMs: 0,
    async eval(_script, count, ...args) {
      if (count === 1 && String(args[0]).startsWith('job-execution-lease:')) {
        const [key, owner] = args;
        if (values.get(key) !== owner) return 0;
        values.delete(key);
        return 1;
      }
      if (count === 1) {
        const [key] = args;
        const now = this.serverNowMs;
        if (!values.has(key)) values.set(key, String(now));
        return [values.get(key), String(now)];
      }
      assert.equal(count, 2);
      const [jobKey, leaseKey, owner, ...operation] = args;
      if (values.get(leaseKey) !== owner) return 0;
      const raw = values.get(jobKey);
      if (!raw) return operation.length === 5 ? -1 : 0;
      const job = JSON.parse(raw);
      if (operation.length === 5) {
        const [expectedLockedAt, legacyVisibleUntil, acquiredAt, protocolVersion, activationSha256] = operation;
        if (job.locked === true) {
          if (!expectedLockedAt || String(job.locked_at || '') !== expectedLockedAt) return 0;
        } else if (expectedLockedAt) return 0;
        job.locked = true;
        job.locked_at = legacyVisibleUntil;
        job.execution_lock_acquired_at = acquiredAt;
        job.execution_lock_owner = owner;
        job.execution_lock_protocol_version = Number(protocolVersion);
        job.execution_lock_activation_sha256 = activationSha256;
        job.updated_at = acquiredAt;
      } else {
        const [nowIso] = operation;
        if (job.execution_lock_owner !== owner) return 0;
        job.locked = false;
        job.locked_at = null;
        job.execution_lock_acquired_at = null;
        job.execution_lock_owner = null;
        job.updated_at = nowIso;
      }
      values.set(jobKey, JSON.stringify(job));
      return 1;
    },
  };
}

test('Mini V2 execution lease is atomic and only its owner can release it', async () => {
  const redis = fakeRedis();
  assert.equal(await acquireJobExecutionLease('job-atomic', { redis, owner: 'owner-a', ttlMs: 5000 }), 'owner-a');
  assert.equal(await acquireJobExecutionLease('job-atomic', { redis, owner: 'owner-b', ttlMs: 5000 }), null);
  assert.equal(await releaseJobExecutionLease('job-atomic', 'owner-b', { redis }), false);
  assert.equal(await releaseJobExecutionLease('job-atomic', 'owner-a', { redis }), true);
  assert.equal(await acquireJobExecutionLease('job-atomic', { redis, owner: 'owner-b', ttlMs: 5000 }), 'owner-b');
});

test('legacy-job drain uses one Redis-server-timed barrier and waits the full outgoing function window', async () => {
  const redis = fakeRedis();
  const key = 'test:mini-v2:legacy-drain';
  redis.serverNowMs = 1_000;
  const first = await ensureLegacyJobExecutionDrain({ redis, key, drainMs: 800_000 });
  assert.deepEqual(first, { ready: false, age_ms: 0, retry_after_ms: 800_000 });
  redis.serverNowMs = 800_999;
  const beforeWindow = await ensureLegacyJobExecutionDrain({ redis, key, drainMs: 800_000 });
  assert.deepEqual(beforeWindow, { ready: false, age_ms: 799_999, retry_after_ms: 1 });
  redis.serverNowMs = 801_000;
  const afterWindow = await ensureLegacyJobExecutionDrain({ redis, key, drainMs: 800_000 });
  assert.deepEqual(afterWindow, { ready: true, age_ms: 800_000, retry_after_ms: 0 });
  assert.equal(redis.values.get(key), '1000');
});

test('legacy drain keys are isolated by activation epoch', async () => {
  const redis = fakeRedis();
  redis.serverNowMs = 5_000;
  await ensureLegacyJobExecutionDrain({ redis, activationId: 'activation-a', drainMs: 800_000 });
  redis.serverNowMs = 105_000;
  const second = await ensureLegacyJobExecutionDrain({ redis, activationId: 'activation-b', drainMs: 800_000 });
  assert.deepEqual(second, { ready: false, age_ms: 0, retry_after_ms: 800_000 });
  const keys = [...redis.values.keys()].filter((key) => key.startsWith('mini-v2:execution-protocol:v2:legacy-drain-started-at-ms:'));
  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
});

test('legacy bridge is compare-and-set claimed and cleared only by the current lease owner', async () => {
  const redis = fakeRedis();
  redis.values.set('job-execution-lease:job-bridge', 'owner-a');
  redis.values.set('job:job-bridge', JSON.stringify({ job_id: 'job-bridge', locked: false, locked_at: null }));
  assert.equal(await claimLegacyJobExecutionLock('job-bridge', 'owner-b', { redis, activationId: ACTIVATION_ID }), false);
  assert.equal(await claimLegacyJobExecutionLock('job-bridge', 'owner-a', { redis, activationId: ACTIVATION_ID }), true);
  const claimed = JSON.parse(redis.values.get('job:job-bridge'));
  assert.equal(claimed.locked, true);
  assert.equal(claimed.execution_lock_owner, 'owner-a');
  assert.equal(claimed.execution_lock_protocol_version, JOB_EXECUTION_PROTOCOL_VERSION);
  assert.equal(claimed.execution_lock_activation_sha256, ACTIVATION_SHA256);
  assert.ok(Date.parse(claimed.locked_at) - Date.parse(claimed.execution_lock_acquired_at) > 800_000);
  assert.equal(await releaseLegacyJobExecutionLock('job-bridge', 'owner-b', { redis }), false);
  assert.equal(await releaseLegacyJobExecutionLock('job-bridge', 'owner-a', { redis }), true);
  const released = JSON.parse(redis.values.get('job:job-bridge'));
  assert.equal(released.locked, false);
  assert.equal(released.execution_lock_owner, null);
});

test('the bridge lock remains non-stale to rolled-back v1 code beyond its five-minute threshold', async () => {
  const redis = fakeRedis();
  const sixMinutesAgo = new Date(Date.now() - (6 * 60 * 1000));
  redis.values.set('job-execution-lease:job-rollback', 'owner-a');
  redis.values.set('job:job-rollback', JSON.stringify({ job_id: 'job-rollback', locked: false, locked_at: null }));
  assert.equal(await claimLegacyJobExecutionLock('job-rollback', 'owner-a', {
    redis,
    activationId: ACTIVATION_ID,
    now: sixMinutesAgo,
  }), true);
  const claimed = JSON.parse(redis.values.get('job:job-rollback'));
  assert.equal(isStaleLock(claimed), false);
  assert.ok(Date.parse(claimed.locked_at) > Date.now() + 800_000);
});

test('an active outgoing legacy document lock prevents the new advancer from claiming a stage', async () => {
  let leaseCalls = 0;
  let executions = 0;
  const job = {
    job_id: 'job-old-lock',
    status: 'processing',
    stage: 'first_pass_generation',
    locked: true,
    locked_at: new Date().toISOString(),
    execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION,
    execution_lock_activation_sha256: ACTIVATION_SHA256,
  };
  const result = await advanceMiniV2JobOnce({
    jobId: job.job_id,
    readJob: async () => ({ ...job }),
    acquireLease: async () => { leaseCalls += 1; return 'owner'; },
    executeStage: async () => { executions += 1; },
    activationId: ACTIVATION_ID,
  });
  assert.equal(result.in_flight, true);
  assert.equal(leaseCalls, 0);
  assert.equal(executions, 0);
});

test('an unmarked legacy job executes zero stages before the drain and exactly one after it', async () => {
  let drainReady = false;
  let job = { job_id: 'job-legacy-drain', status: 'queued', stage: 'received', locked: false, locked_at: null };
  let executions = 0;
  let ownerSequence = 0;
  const dependencies = {
    jobId: job.job_id,
    readJob: async () => ({ ...job }),
    ensureLegacyDrain: async () => ({ ready: drainReady, retry_after_ms: drainReady ? 0 : 800_000 }),
    acquireLease: async () => `owner-${ownerSequence += 1}`,
    releaseLease: async () => true,
    claimLegacyLock: async (_jobId, owner, { expectedLockedAt, activationId }) => {
      assert.equal(expectedLockedAt, null);
      assert.equal(activationId, ACTIVATION_ID);
      job = { ...job, locked: true, locked_at: new Date().toISOString(), execution_lock_owner: owner, execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION, execution_lock_activation_sha256: ACTIVATION_SHA256 };
      return true;
    },
    releaseLegacyLock: async (_jobId, owner) => {
      assert.equal(job.execution_lock_owner, owner);
      job = { ...job, locked: false, locked_at: null, execution_lock_owner: null };
      return true;
    },
    executeStage: async () => {
      executions += 1;
      job = { ...job, status: 'processing', stage: 'first_pass_generation' };
    },
    allowLegacyDrainStart: true,
    activationId: ACTIVATION_ID,
  };
  const first = await advanceMiniV2JobOnce(dependencies);
  const beforeWindow = await advanceMiniV2JobOnce(dependencies);
  assert.equal(first.legacy_drain, true);
  assert.equal(beforeWindow.legacy_drain, true);
  assert.equal(executions, 0);
  drainReady = true;
  const afterWindow = await advanceMiniV2JobOnce(dependencies);
  assert.equal(afterWindow.advanced, true);
  assert.equal(executions, 1);
});

test('a pre-promotion candidate request cannot start or age the canonical legacy drain', async () => {
  const job = { job_id: 'job-pre-promotion', status: 'queued', stage: 'received', locked: false, locked_at: null };
  let drainCalls = 0;
  let leaseCalls = 0;
  const result = await advanceMiniV2JobOnce({
    jobId: job.job_id,
    readJob: async () => ({ ...job }),
    ensureLegacyDrain: async () => { drainCalls += 1; return { ready: true, retry_after_ms: 0 }; },
    acquireLease: async () => { leaseCalls += 1; return 'owner'; },
    allowLegacyDrainStart: false,
  });
  assert.equal(result.legacy_drain, true);
  assert.equal(result.retry_after_ms, null);
  assert.equal(drainCalls, 0);
  assert.equal(leaseCalls, 0);
});

test('an unaliased Production-target candidate cannot advance even a current-activation job', async () => {
  const job = {
    job_id: 'job-unaliased-production',
    status: 'queued',
    stage: 'received',
    locked: false,
    locked_at: null,
    execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION,
    execution_lock_activation_sha256: ACTIVATION_SHA256,
  };
  let leaseCalls = 0;
  let executions = 0;
  const result = await advanceMiniV2JobOnce({
    jobId: job.job_id,
    activationId: ACTIVATION_ID,
    executionAllowed: false,
    readJob: async () => ({ ...job }),
    acquireLease: async () => { leaseCalls += 1; return 'owner'; },
    executeStage: async () => { executions += 1; },
  });
  assert.equal(result.execution_disabled, true);
  assert.equal(result.retry_after_ms, null);
  assert.equal(leaseCalls, 0);
  assert.equal(executions, 0);
});

test('rollback quarantine executes zero stages for a current canonical activation', async () => {
  const job = {
    job_id: 'job-rollback-quarantine',
    status: 'processing',
    stage: 'first_pass_generation',
    locked: false,
    locked_at: null,
    execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION,
    execution_lock_activation_sha256: ACTIVATION_SHA256,
  };
  let leases = 0;
  let executions = 0;
  const result = await advanceMiniV2JobOnce({
    jobId: job.job_id,
    activationId: ACTIVATION_ID,
    executionAllowed: miniV2ExecutionAllowed({
      env: { MINI_V2_EXECUTION_DISABLED: 'true' },
      productionTarget: true,
      canonicalProduction: true,
    }),
    readJob: async () => ({ ...job }),
    acquireLease: async () => { leases += 1; return 'owner'; },
    executeStage: async () => { executions += 1; },
  });
  assert.equal(result.execution_disabled, true);
  assert.equal(result.retry_after_ms, null);
  assert.equal(leases, 0);
  assert.equal(executions, 0);
});

test('the first canonical-host legacy request starts at age zero and executes no stage', async () => {
  const job = { job_id: 'job-canonical-first', status: 'queued', stage: 'received', locked: false, locked_at: null };
  let executions = 0;
  const result = await advanceMiniV2JobOnce({
    jobId: job.job_id,
    readJob: async () => ({ ...job }),
    ensureLegacyDrain: async () => ({ ready: false, age_ms: 0, retry_after_ms: 800_000 }),
    executeStage: async () => { executions += 1; },
    allowLegacyDrainStart: true,
  });
  assert.equal(result.legacy_drain, true);
  assert.equal(result.retry_after_ms, 800_000);
  assert.equal(executions, 0);
});

test('the first canonical-host request drains even a job already stamped with the current activation', async () => {
  const job = {
    job_id: 'job-current-at-promotion',
    status: 'queued',
    stage: 'received',
    locked: false,
    locked_at: null,
    execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION,
    execution_lock_activation_sha256: ACTIVATION_SHA256,
  };
  let executions = 0;
  const result = await advanceMiniV2JobOnce({
    jobId: job.job_id,
    activationId: ACTIVATION_ID,
    readJob: async () => ({ ...job }),
    ensureLegacyDrain: async ({ activationId }) => {
      assert.equal(activationId, ACTIVATION_ID);
      return { ready: false, age_ms: 0, retry_after_ms: 800_000 };
    },
    executeStage: async () => { executions += 1; },
    allowLegacyDrainStart: true,
  });
  assert.equal(result.legacy_drain, true);
  assert.equal(result.retry_after_ms, 800_000);
  assert.equal(executions, 0);
});

test('a re-promotion activation starts a fresh drain and stamps the job only after that epoch becomes ready', async () => {
  const redis = fakeRedis();
  const activationA = 'release-5-activation-a';
  const activationB = 'release-5-activation-b';
  const shaA = miniV2ExecutionActivationSha256(activationA);
  const shaB = miniV2ExecutionActivationSha256(activationB);
  let job = {
    job_id: 'job-repromotion',
    status: 'queued',
    stage: 'received',
    locked: false,
    locked_at: null,
    execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION,
    execution_lock_activation_sha256: shaA,
  };
  let executions = 0;
  let ownerSequence = 0;
  const dependencies = {
    jobId: job.job_id,
    activationId: activationB,
    allowLegacyDrainStart: true,
    readJob: async () => ({ ...job }),
    ensureLegacyDrain: ({ activationId }) => ensureLegacyJobExecutionDrain({ redis, activationId, drainMs: 800_000 }),
    acquireLease: async () => `owner-${ownerSequence += 1}`,
    releaseLease: async () => true,
    claimLegacyLock: async (_jobId, owner, { activationId }) => {
      job = {
        ...job,
        locked: true,
        locked_at: new Date(Date.now() + 1_800_000).toISOString(),
        execution_lock_owner: owner,
        execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION,
        execution_lock_activation_sha256: miniV2ExecutionActivationSha256(activationId),
      };
      return true;
    },
    releaseLegacyLock: async (_jobId, owner) => {
      assert.equal(job.execution_lock_owner, owner);
      job = { ...job, locked: false, locked_at: null, execution_lock_owner: null };
      return true;
    },
    executeStage: async () => {
      executions += 1;
      job = { ...job, status: 'processing', stage: 'first_pass_generation' };
    },
  };

  redis.serverNowMs = 1_000;
  const first = await advanceMiniV2JobOnce(dependencies);
  assert.deepEqual({ legacy_drain: first.legacy_drain, retry_after_ms: first.retry_after_ms }, { legacy_drain: true, retry_after_ms: 800_000 });
  assert.equal(job.execution_lock_activation_sha256, shaA);
  assert.equal(executions, 0);

  redis.serverNowMs = 801_000;
  const afterDrain = await advanceMiniV2JobOnce(dependencies);
  assert.equal(afterDrain.advanced, true);
  assert.equal(job.execution_lock_activation_sha256, shaB);
  assert.equal(executions, 1);
  assert.equal([...redis.values.keys()].filter((key) => key.startsWith('mini-v2:execution-protocol:v2:legacy-drain-started-at-ms:')).length, 1);
});

test('concurrent advancers execute one bounded stage and recheck authority inside the lease', async () => {
  const redis = fakeRedis();
  let job = { job_id: 'job-concurrent', status: 'queued', stage: 'received', locked: false, locked_at: null, execution_lock_protocol_version: JOB_EXECUTION_PROTOCOL_VERSION, execution_lock_activation_sha256: ACTIVATION_SHA256 };
  let ownerSequence = 0;
  let executions = 0;
  let authorityChecks = 0;
  const dependencies = {
    jobId: job.job_id,
    readJob: async () => ({ ...job }),
    acquireLease: (jobId) => acquireJobExecutionLease(jobId, { redis, owner: `owner-${ownerSequence += 1}`, ttlMs: 5000 }),
    releaseLease: (jobId, owner) => releaseJobExecutionLease(jobId, owner, { redis }),
    claimLegacyLock: async (_jobId, owner, { expectedLockedAt, activationId }) => {
      assert.equal(expectedLockedAt, null);
      assert.equal(activationId, ACTIVATION_ID);
      job = { ...job, locked: true, locked_at: new Date().toISOString(), execution_lock_owner: owner, execution_lock_activation_sha256: ACTIVATION_SHA256 };
      return true;
    },
    releaseLegacyLock: async (_jobId, owner) => {
      if (job.execution_lock_owner !== owner) return false;
      job = { ...job, locked: false, locked_at: null, execution_lock_owner: null };
      return true;
    },
    beforeExecute: async (current) => {
      authorityChecks += 1;
      assert.equal(current.stage, 'received');
    },
    executeStage: async () => {
      executions += 1;
      await Promise.resolve();
      job = { ...job, status: 'processing', stage: 'first_pass_generation' };
    },
    activationId: ACTIVATION_ID,
  };
  const results = await Promise.all([
    advanceMiniV2JobOnce(dependencies),
    advanceMiniV2JobOnce(dependencies),
  ]);
  assert.equal(executions, 1);
  assert.equal(authorityChecks, 1);
  assert.equal(results.filter((result) => result.advanced).length, 1);
  assert.equal(results.filter((result) => result.in_flight).length, 1);
});
