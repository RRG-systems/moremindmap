import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import process from 'node:process';
import test from 'node:test';
import {
  CORE_CHECK_IDS,
  readJson,
  sha256,
  validateEnvironmentDefinition,
  validateReleasePlan,
} from '../scripts/release-foundation/contract.mjs';
import {
  assertAliasCustody,
  PrivateCycleBoundaryError,
  projectEnvironmentMetadata,
} from '../scripts/release-foundation/private-cycle.mjs';

const root = resolve(import.meta.dirname, '..');
const environmentPath = resolve(root, 'docs/runbooks/release-foundation/PRIVATE_ENVIRONMENT.json');
const release4Path = resolve(root, 'docs/runbooks/release-foundation/rehearsals/subscription-release-4.json');
const release5Path = resolve(root, 'docs/runbooks/release-foundation/rehearsals/recruiting-release-5.json');
const runner = resolve(root, 'scripts/release-foundation/rehearse.mjs');

const fixture = async (path) => structuredClone(await readJson(path));

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [runner, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, expectedStatus, `${result.stdout}\n${result.stderr}`);
  return result;
}

test('private environment is Preview-only, customer-isolated and value-free', async () => {
  const environment = await fixture(environmentPath);
  assert.deepEqual(validateEnvironmentDefinition(environment), { ok: true, issues: [] });
  assert.equal(environment.allowed_origin, `https://${environment.stable_host}`);
});

test('both saved private rehearsals satisfy the same fixed contract', async () => {
  const environment = await fixture(environmentPath);
  for (const path of [release4Path, release5Path]) {
    const result = validateReleasePlan(await fixture(path), environment);
    assert.equal(result.ok, true, JSON.stringify(result.issues));
    assert.equal(result.summary.core_checks, CORE_CHECK_IDS.length);
  }
});

test('a Production target is refused before any action', async () => {
  const environment = await fixture(environmentPath);
  const plan = await fixture(release5Path);
  plan.environment.target = 'production';
  const result = validateReleasePlan(plan, environment);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'PRODUCTION_TARGET_REFUSED'));
});

test('secret-shaped fields and values are refused without echoing their content', async () => {
  const environment = await fixture(environmentPath);
  const plan = await fixture(release5Path);
  plan.secret = 'opaque';
  const result = validateReleasePlan(plan, environment);
  assert.equal(result.ok, false);
  const issue = result.issues.find((item) => item.code === 'SECRET_FIELD_REFUSED');
  assert.equal(issue.path, '$.secret');
  assert.equal(JSON.stringify(issue).includes('opaque'), false);
});

test('private routing and allowed Origin cannot drift', async () => {
  const environment = await fixture(environmentPath);
  const plan = await fixture(release5Path);
  plan.environment.allowed_origin = 'https://wrong.example.test';
  const result = validateReleasePlan(plan, environment);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'ROUTING_ORIGIN_MISMATCH'));
});

test('canonical and authored progress must stay separate', async () => {
  const environment = await fixture(environmentPath);
  const plan = await fixture(release5Path);
  plan.progress.authored_completion.phase = plan.progress.canonical_completion.phase;
  const result = validateReleasePlan(plan, environment);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((item) => item.code === 'PROGRESS_PHASES_CONFLATED'));
});

test('a failed required check blocks promotion with zero activation', async () => {
  const directory = mkdtempSync(`${tmpdir()}/release-foundation-blocked-`);
  const plan = await fixture(release5Path);
  plan.checks.change_specific[0].status = 'fail';
  const planPath = resolve(directory, 'plan.json');
  const statePath = resolve(directory, 'state.json');
  const receiptPath = resolve(directory, 'receipt.json');
  writeFileSync(planPath, JSON.stringify(plan));
  run(['--plan', planPath, '--environment', environmentPath, '--state', statePath, '--receipt', receiptPath], 2);
  const receipt = JSON.parse(readFileSync(receiptPath));
  assert.equal(receipt.verdict, 'PROMOTION_BLOCKED');
  assert.equal(receipt.activation_attempted, false);
  assert.equal(receipt.production_mutations, 0);
  assert.equal(receipt.customer_mutations, 0);
});

test('a stopped rehearsal resumes from the same durable state without a terminal', async () => {
  const directory = mkdtempSync(`${tmpdir()}/release-foundation-resume-`);
  const statePath = resolve(directory, 'state.json');
  const pausedPath = resolve(directory, 'paused.json');
  const completePath = resolve(directory, 'complete.json');
  run(['--plan', release4Path, '--environment', environmentPath, '--state', statePath, '--receipt', pausedPath, '--stop-after', 'validated']);
  assert.equal(JSON.parse(readFileSync(pausedPath)).verdict, 'PAUSED_AFTER_VALIDATION');
  run(['--plan', release4Path, '--environment', environmentPath, '--state', statePath, '--receipt', completePath, '--resume', '--exercise-rollback']);
  const receipt = JSON.parse(readFileSync(completePath));
  assert.equal(receipt.verdict, 'PRIVATE_REHEARSAL_GREEN');
  assert.equal(receipt.restart_recovery_proven, true);
  assert.equal(receipt.rollback_exercised, true);
  assert.equal(receipt.production_mutations, 0);
  const idempotentPath = resolve(directory, 'idempotent.json');
  run(['--plan', release4Path, '--environment', environmentPath, '--state', statePath, '--receipt', idempotentPath, '--resume', '--exercise-rollback']);
  assert.equal(JSON.parse(readFileSync(idempotentPath)).idempotent_resume, true);
});

test('resume refuses plan drift rather than reconstructing or guessing state', async () => {
  const directory = mkdtempSync(`${tmpdir()}/release-foundation-drift-`);
  const statePath = resolve(directory, 'state.json');
  run(['--plan', release5Path, '--environment', environmentPath, '--state', statePath, '--receipt', resolve(directory, 'paused.json'), '--stop-after', 'validated']);
  const plan = await fixture(release5Path);
  plan.manual_steps.push('drift');
  const driftPath = resolve(directory, 'drift.json');
  writeFileSync(driftPath, JSON.stringify(plan));
  const result = spawnSync(process.execPath, [runner, '--plan', driftPath, '--environment', environmentPath, '--state', statePath, '--receipt', resolve(directory, 'complete.json'), '--resume'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RESUME_CUSTODY_DRIFT/u);
});

test('incompatible rollback requires quarantine, drain, switch and verify', async () => {
  const environment = await fixture(environmentPath);
  const plan = await fixture(release5Path);
  const result = validateReleasePlan(plan, environment);
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(plan.rollback.direct_switch_allowed, false);
  assert.deepEqual(plan.rollback.steps.map((step) => step.type), ['quarantine', 'drain', 'switch', 'verify']);
  assert.ok(plan.rollback.steps[1].seconds >= plan.rollback.maximum_inflight_seconds);
});

test('maintained release files pass syntax checks', () => {
  for (const file of [
    'scripts/release-foundation/contract.mjs',
    'scripts/release-foundation/validate.mjs',
    'scripts/release-foundation/rehearse.mjs',
    'scripts/release-foundation/browser-preflight.mjs',
    'scripts/release-foundation/evidence-manifest.mjs',
    'scripts/release-foundation/private-cycle.mjs',
  ]) execFileSync(process.execPath, ['--check', resolve(root, file)]);
});

test('actual private-cycle alias guard refuses any public alias drift', () => {
  const aliases = new Map([
    ['moremindmap.com', 'dpl_Production'],
    ['www.moremindmap.com', 'dpl_Production'],
    ['moremindmap.vercel.app', 'dpl_Production'],
    ['moremindmap-rrg-systems-projects.vercel.app', 'dpl_Production'],
    ['moremindmap-env-subscription-canary-rrg-systems-projects.vercel.app', 'dpl_Private'],
  ]);
  assert.equal(assertAliasCustody(aliases, {
    expectedProduction: 'dpl_Production',
    expectedStable: 'dpl_Private',
  }).public_alias_count, 4);
  aliases.set('moremindmap.com', 'dpl_Wrong');
  assert.throws(
    () => assertAliasCustody(aliases, { expectedProduction: 'dpl_Production' }),
    (error) => error instanceof PrivateCycleBoundaryError && error.message === 'PUBLIC_ALIAS_CUSTODY_CHANGED',
  );
});

test('actual private-cycle environment fingerprint excludes values and detects metadata drift', () => {
  const fixture = {
    envs: [
      {
        id: 'row_b', key: 'SECOND', type: 'sensitive', target: ['preview'], gitBranch: 'codex/example',
        customEnvironmentIds: ['env_M70a2uAYcMBZ9m6afKtSvBFaHGwv'], value: 'must-not-project',
      },
      {
        id: 'row_a', key: 'FIRST', type: 'encrypted', target: ['preview'], gitBranch: null,
        customEnvironmentIds: ['env_M70a2uAYcMBZ9m6afKtSvBFaHGwv'], value: 'must-not-project-either',
      },
      {
        id: 'row_other', key: 'OTHER', type: 'sensitive', target: ['production'], gitBranch: null,
        customEnvironmentIds: [], value: 'outside-scope',
      },
    ],
  };
  const projection = projectEnvironmentMetadata(fixture);
  assert.equal(projection.record_count, 2);
  assert.equal(projection.sensitive_count, 1);
  assert.equal(projection.encrypted_count, 1);
  assert.equal(projection.branch_scoped_count, 1);
  assert.equal(projection.unbranched_count, 1);
  assert.doesNotMatch(JSON.stringify(projection), /must-not-project/u);
  const changed = structuredClone(fixture);
  changed.envs[0].gitBranch = 'codex/changed';
  assert.notEqual(projectEnvironmentMetadata(changed).projection_sha256, projection.projection_sha256);
});

test('sealed receipts prove two distinct rehearsals, blocking, restart and rollback', () => {
  const evidence = resolve(root, 'docs/runbooks/release-foundation/evidence');
  const first = JSON.parse(readFileSync(resolve(evidence, 'rehearsal-1-complete.json')));
  const second = JSON.parse(readFileSync(resolve(evidence, 'rehearsal-2-complete.json')));
  const blocked = JSON.parse(readFileSync(resolve(evidence, 'intentional-failure-receipt.json')));
  const browser = JSON.parse(readFileSync(resolve(evidence, 'browser-preflight.json')));
  const currentToolSha = sha256(Buffer.concat([
    readFileSync(resolve(root, 'scripts/release-foundation/contract.mjs')),
    readFileSync(resolve(root, 'scripts/release-foundation/rehearse.mjs')),
  ]));
  assert.notEqual(first.run_id, second.run_id);
  assert.equal(first.tool_sha256, currentToolSha);
  assert.equal(second.tool_sha256, currentToolSha);
  assert.equal(first.environment_sha256, second.environment_sha256);
  assert.equal(first.restart_recovery_proven, true);
  assert.equal(first.rollback_exercised, true);
  assert.equal(second.rollback_exercised, true);
  assert.equal(second.rollback_requires_quarantine, true);
  assert.equal(blocked.verdict, 'PROMOTION_BLOCKED');
  assert.equal(blocked.activation_attempted, false);
  assert.equal(browser.verdict, 'BROWSER_LAUNCH_AND_CLOSE_GREEN');
});

test('evidence manifest rehashes every committed receipt byte-for-byte', () => {
  const evidence = resolve(root, 'docs/runbooks/release-foundation/evidence');
  const manifest = JSON.parse(readFileSync(resolve(evidence, 'MANIFEST.json')));
  assert.equal(manifest.file_count, manifest.files.length);
  for (const entry of manifest.files) {
    const bytes = readFileSync(resolve(evidence, entry.path));
    assert.equal(bytes.length, entry.bytes, entry.path);
    assert.equal(sha256(bytes), entry.sha256, entry.path);
  }
});
