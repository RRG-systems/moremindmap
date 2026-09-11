#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import {
  atomicWriteJson,
  canonicalJson,
  readJson,
  sha256,
  validateReleasePlan,
} from './contract.mjs';

const TEAM = 'rrg-systems-projects';
const TEAM_ID = 'team_j7Jl4geBPY3NC87BcgGlIYam';
const PROJECT_ID = 'prj_1cKulnhesboehHHZXgZaDqOnCdmn';
const ENVIRONMENT = Object.freeze({
  id: 'env_M70a2uAYcMBZ9m6afKtSvBFaHGwv',
  name: 'subscription-canary',
  stableHost: 'moremindmap-env-subscription-canary-rrg-systems-projects.vercel.app',
});
const PUBLIC_ALIASES = Object.freeze([
  'moremindmap.com',
  'www.moremindmap.com',
  'moremindmap.vercel.app',
  'moremindmap-rrg-systems-projects.vercel.app',
]);
const DEPLOYMENT = /^dpl_[A-Za-z0-9]+$/u;
const SHA = /^[0-9a-f]{40}$/u;
const BRANCH = /^codex\/[A-Za-z0-9._/-]+$/u;
const HOST = /^[a-z0-9.-]+\.vercel\.app$/u;
const OUTPUT_LIMIT = 64 * 1024 * 1024;
const STATE_ROOT = '/private/tmp/moremindmap-release-foundation-actual-v1';
const STATE_SCHEMA = 'more.home-base.actual-private-cycle-state/v1';
const RECEIPT_SCHEMA = 'more.home-base.actual-private-cycle-receipt/v1';
const SAFE_RUNTIME_CHECKS = Object.freeze([
  { id: 'public-root', path: '/', expected: 200 },
  { id: 'public-step-1', path: '/step-1', expected: 200 },
  { id: 'leadership-entry-render-route', path: '/leadership', expected: 200 },
  {
    id: 'catalog-allowed-origin',
    path: '/api/public-v1/catalog',
    expected: 200,
    origin: `https://${ENVIRONMENT.stableHost}`,
  },
  {
    id: 'catalog-hostile-origin-denied',
    path: '/api/public-v1/catalog',
    expected: 403,
    origin: 'https://hostile.invalid',
  },
  { id: 'p0-diagnostic-quarantined', path: '/api/diagnostic/list-all-profiles', expected: 404 },
]);

export class PrivateCycleBoundaryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PrivateCycleBoundaryError';
  }
}

function stop(code) {
  throw new PrivateCycleBoundaryError(code);
}

function assert(value, code) {
  if (!value) stop(code);
}

function parseArgs(argv) {
  const values = {};
  const booleans = new Set(['--resume', '--restore-only', '--intentional-failure', '--metadata-digest-only']);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--')) stop('ARGUMENT_REFUSED');
    if (booleans.has(key)) values[key.slice(2)] = true;
    else {
      const value = argv[++index];
      if (value == null || value.startsWith('--')) stop('ARGUMENT_VALUE_MISSING');
      values[key.slice(2)] = value;
    }
  }
  return values;
}

function childEnvironment() {
  return {
    ...process.env,
    DEBUG: '',
    NODE_DEBUG: '',
    NO_COLOR: '1',
    VERCEL_TELEMETRY_DISABLED: '1',
  };
}

function runCaptured(command, args, { cwd, label, timeoutMs = 120_000 } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: childEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let bytes = 0;
    let exceeded = false;
    const collect = (sink) => (chunk) => {
      bytes += chunk.length;
      if (bytes > OUTPUT_LIMIT) {
        exceeded = true;
        child.kill('SIGTERM');
        return;
      }
      sink.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('error', () => {
      clearTimeout(timer);
      rejectPromise(new PrivateCycleBoundaryError(`${label}_START_FAILED`));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (exceeded) return rejectPromise(new PrivateCycleBoundaryError(`${label}_OUTPUT_LIMIT`));
      if (signal) return rejectPromise(new PrivateCycleBoundaryError(`${label}_INTERRUPTED`));
      if (code !== 0) return rejectPromise(new PrivateCycleBoundaryError(`${label}_FAILED`));
      return resolvePromise({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function parseJson(text, code) {
  try { return JSON.parse(text); } catch { /* bounded fallback below */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* refuse below */ }
  }
  stop(code);
}

async function gitRead(cwd, args, label) {
  const result = await runCaptured('git', args, { cwd, label: `GIT_${label}`, timeoutMs: 30_000 });
  return result.stdout.trim();
}

function exactSpec(args, prefix) {
  const rawWorktree = args[`${prefix}-worktree`];
  assert(typeof rawWorktree === 'string' && rawWorktree.length > 0, `${prefix.toUpperCase()}_WORKTREE_MISSING`);
  const spec = {
    role: prefix,
    worktree: resolve(rawWorktree),
    branch: String(args[`${prefix}-branch`] || ''),
    commit: String(args[`${prefix}-commit`] || ''),
    tree: String(args[`${prefix}-tree`] || ''),
  };
  assert(BRANCH.test(spec.branch), `${prefix.toUpperCase()}_BRANCH_INVALID`);
  assert(SHA.test(spec.commit), `${prefix.toUpperCase()}_COMMIT_INVALID`);
  assert(SHA.test(spec.tree), `${prefix.toUpperCase()}_TREE_INVALID`);
  return spec;
}

async function verifyWorktree(spec) {
  assert(await gitRead(spec.worktree, ['rev-parse', 'HEAD'], `${spec.role}_HEAD`) === spec.commit,
    `${spec.role.toUpperCase()}_HEAD_CHANGED`);
  assert(await gitRead(spec.worktree, ['rev-parse', 'HEAD^{tree}'], `${spec.role}_TREE`) === spec.tree,
    `${spec.role.toUpperCase()}_TREE_CHANGED`);
  assert(await gitRead(spec.worktree, ['status', '--porcelain=v1'], `${spec.role}_STATUS`) === '',
    `${spec.role.toUpperCase()}_WORKTREE_NOT_CLEAN`);
  assert(await gitRead(spec.worktree, ['symbolic-ref', '--short', 'HEAD'], `${spec.role}_BRANCH`) === spec.branch,
    `${spec.role.toUpperCase()}_CHECKED_OUT_BRANCH_CHANGED`);
  assert(
    await gitRead(spec.worktree, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], `${spec.role}_UPSTREAM`)
      === `origin/${spec.branch}`,
    `${spec.role.toUpperCase()}_UPSTREAM_CHANGED`,
  );
  assert(await gitRead(spec.worktree, ['rev-parse', `origin/${spec.branch}`], `${spec.role}_REMOTE`) === spec.commit,
    `${spec.role.toUpperCase()}_REMOTE_BRANCH_CHANGED`);
  const linked = await readJson(resolve(spec.worktree, '.vercel/repo.json'));
  const project = linked?.projects?.find((item) => item.directory === '.');
  assert(project?.id === PROJECT_ID && project?.orgId === TEAM_ID, `${spec.role.toUpperCase()}_VERCEL_LINK_CHANGED`);
}

async function vercelApi(path, cwd, label) {
  assert(/^\/v\d+\//u.test(path) && !path.includes('decrypt=true'), 'VERCEL_API_PATH_REFUSED');
  const result = await runCaptured('vercel', [
    'api', path, '--scope', TEAM, '--raw', '--no-color', '--non-interactive',
  ], { cwd, label: `VERCEL_${label}`, timeoutMs: 120_000 });
  return parseJson(result.stdout, `${label}_JSON_INVALID`);
}

async function readAliases(cwd) {
  const result = await runCaptured('vercel', [
    'alias', 'ls', '--format=json', '--limit', '100', '--scope', TEAM, '--no-color', '--non-interactive',
  ], { cwd, label: 'VERCEL_ALIAS_LIST', timeoutMs: 120_000 });
  const payload = parseJson(result.stdout, 'ALIAS_LIST_JSON_INVALID');
  const entries = Array.isArray(payload?.aliases) ? payload.aliases : [];
  const map = new Map(entries.map((entry) => [String(entry.alias), String(entry.deploymentId)]));
  return map;
}

export function assertAliasCustody(aliasMap, { expectedProduction, expectedStable = null }) {
  assert(DEPLOYMENT.test(expectedProduction || ''), 'EXPECTED_PRODUCTION_INVALID');
  for (const alias of PUBLIC_ALIASES) {
    assert(aliasMap.get(alias) === expectedProduction, 'PUBLIC_ALIAS_CUSTODY_CHANGED');
  }
  if (expectedStable) {
    assert(DEPLOYMENT.test(expectedStable), 'EXPECTED_STABLE_DEPLOYMENT_INVALID');
    assert(aliasMap.get(ENVIRONMENT.stableHost) === expectedStable, 'PRIVATE_STABLE_ALIAS_CHANGED');
  }
  return {
    public_alias_count: PUBLIC_ALIASES.length,
    public_deployment: expectedProduction,
    stable_deployment: aliasMap.get(ENVIRONMENT.stableHost) || null,
  };
}

function normalizedArray(value) {
  return Array.isArray(value) ? value.map(String).sort() : [];
}

function collectEnvironmentRows(payload) {
  const rows = Array.isArray(payload?.envs) ? payload.envs : [];
  for (const row of rows) assert(row?.decrypted !== true, 'DECRYPTED_ENVIRONMENT_RECORD_REFUSED');
  return rows.filter((row) => normalizedArray(row.customEnvironmentIds).includes(ENVIRONMENT.id));
}

export function projectEnvironmentMetadata(payload) {
  const rows = collectEnvironmentRows(payload).map((row) => ({
    id: String(row.id || ''),
    key: String(row.key || ''),
    type: String(row.type || ''),
    target: normalizedArray(row.target),
    gitBranch: row.gitBranch == null ? null : String(row.gitBranch),
    customEnvironmentIds: normalizedArray(row.customEnvironmentIds),
  })).sort((left, right) => left.id.localeCompare(right.id));
  const typeCounts = rows.reduce((counts, row) => ({
    ...counts,
    [row.type]: (counts[row.type] || 0) + 1,
  }), {});
  return {
    record_count: rows.length,
    sensitive_count: typeCounts.sensitive || 0,
    encrypted_count: typeCounts.encrypted || 0,
    branch_scoped_count: rows.filter((row) => row.gitBranch != null).length,
    unbranched_count: rows.filter((row) => row.gitBranch == null).length,
    projection_sha256: sha256(canonicalJson(rows)),
  };
}

async function verifyEvidenceBundle(planPath, environmentPath, manifestPath, candidate) {
  const [plan, environment, manifestBytes] = await Promise.all([
    readJson(planPath),
    readJson(environmentPath),
    readFile(manifestPath),
  ]);
  const validation = validateReleasePlan(plan, environment);
  assert(validation.ok, 'SEALED_RELEASE_PLAN_INVALID');
  assert(plan.candidate.commit === candidate.commit, 'SEALED_PLAN_CANDIDATE_COMMIT_CHANGED');
  assert(plan.candidate.tree === candidate.tree, 'SEALED_PLAN_CANDIDATE_TREE_CHANGED');
  const manifest = parseJson(manifestBytes.toString('utf8'), 'EVIDENCE_MANIFEST_JSON_INVALID');
  assert(manifest?.schema === 'more.home-base.release-evidence-manifest/v1', 'EVIDENCE_MANIFEST_SCHEMA_CHANGED');
  assert(manifest?.algorithm === 'SHA-256' && manifest?.excludes_self === true, 'EVIDENCE_MANIFEST_CONTRACT_CHANGED');
  assert(Array.isArray(manifest?.files) && manifest.file_count === manifest.files.length, 'EVIDENCE_MANIFEST_COUNT_CHANGED');
  for (const entry of manifest.files) {
    assert(/^[A-Za-z0-9._-]+$/u.test(String(entry?.path || '')), 'EVIDENCE_MANIFEST_PATH_REFUSED');
    assert(/^[0-9a-f]{64}$/u.test(String(entry?.sha256 || '')), 'EVIDENCE_MANIFEST_HASH_INVALID');
    assert(Number.isSafeInteger(entry?.bytes) && entry.bytes >= 0, 'EVIDENCE_MANIFEST_SIZE_INVALID');
    const bytes = await readFile(resolve(dirname(manifestPath), entry.path));
    assert(bytes.length === entry.bytes, 'EVIDENCE_FILE_SIZE_CHANGED');
    assert(sha256(bytes) === entry.sha256, 'EVIDENCE_FILE_HASH_CHANGED');
  }
  return {
    plan_sha256: validation.plan_sha256,
    manifest_sha256: sha256(manifestBytes),
    manifest_file_count: manifest.file_count,
    evidence_mode: 'sealed-product-evidence-plus-actual-private-release-cycle',
  };
}

async function verifyEnvironment(cwd, expectedDigest = null) {
  const [environment, rows] = await Promise.all([
    vercelApi(
      `/v9/projects/${PROJECT_ID}/custom-environments/${ENVIRONMENT.id}?teamId=${TEAM_ID}`,
      cwd,
      'CUSTOM_ENVIRONMENT',
    ),
    vercelApi(`/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&decrypt=false`, cwd, 'ENVIRONMENT_METADATA'),
  ]);
  assert(environment?.id === ENVIRONMENT.id, 'CUSTOM_ENVIRONMENT_ID_CHANGED');
  assert(environment?.slug === ENVIRONMENT.name, 'CUSTOM_ENVIRONMENT_NAME_CHANGED');
  assert(environment?.type === 'preview', 'CUSTOM_ENVIRONMENT_NOT_PREVIEW');
  assert(environment?.branchMatcher?.type === 'equals', 'CUSTOM_ENVIRONMENT_BRANCH_MATCHER_TYPE_CHANGED');
  assert(
    environment?.branchMatcher?.pattern === 'codex/home-base-v2-recruiting-two-box-release-v1',
    'CUSTOM_ENVIRONMENT_BRANCH_MATCHER_CHANGED',
  );
  assert(Array.isArray(environment?.domains), 'CUSTOM_ENVIRONMENT_DOMAINS_MISSING');
  assert(environment.domains.length === 0, 'CUSTOM_ENVIRONMENT_DOMAIN_ATTACHED');
  const projection = projectEnvironmentMetadata(rows);
  assert(projection.record_count === 48, 'ENVIRONMENT_RECORD_COUNT_CHANGED');
  assert(projection.sensitive_count === 47, 'ENVIRONMENT_SENSITIVE_COUNT_CHANGED');
  assert(projection.encrypted_count === 1, 'ENVIRONMENT_ENCRYPTED_COUNT_CHANGED');
  assert(projection.branch_scoped_count === 41, 'ENVIRONMENT_BRANCH_SCOPE_COUNT_CHANGED');
  assert(projection.unbranched_count === 7, 'ENVIRONMENT_UNBRANCHED_COUNT_CHANGED');
  if (expectedDigest) assert(projection.projection_sha256 === expectedDigest, 'ENVIRONMENT_METADATA_DRIFT');
  return projection;
}

async function deployment(id, cwd, label) {
  assert(DEPLOYMENT.test(id), `${label}_DEPLOYMENT_ID_INVALID`);
  return vercelApi(`/v13/deployments/${id}?teamId=${TEAM_ID}`, cwd, label);
}

function aliasesOf(value) {
  return normalizedArray(value?.alias || value?.aliases);
}

function assertExactDeployment(value, spec, { requireStableAlias = false } = {}) {
  assert(DEPLOYMENT.test(String(value?.id || value?.uid || '')), 'DEPLOYMENT_ID_INVALID');
  assert((value?.readyState || value?.state) === 'READY', 'DEPLOYMENT_NOT_READY');
  assert(value?.customEnvironment?.id === ENVIRONMENT.id, 'DEPLOYMENT_ENVIRONMENT_ID_CHANGED');
  assert(value?.customEnvironment?.slug === ENVIRONMENT.name, 'DEPLOYMENT_ENVIRONMENT_NAME_CHANGED');
  assert(String(value?.meta?.githubCommitRef || '') === spec.branch, 'DEPLOYMENT_BRANCH_CHANGED');
  assert(String(value?.meta?.githubCommitSha || '') === spec.commit, 'DEPLOYMENT_COMMIT_CHANGED');
  assert(String(value?.meta?.candidateTree || '') === spec.tree, 'DEPLOYMENT_TREE_CHANGED');
  const aliases = aliasesOf(value);
  assert(aliases.every((alias) => alias === ENVIRONMENT.stableHost), 'UNEXPECTED_ALIAS_ATTACHED_TO_PRIVATE_DEPLOYMENT');
  assert(!aliases.some((alias) => PUBLIC_ALIASES.includes(alias)), 'PUBLIC_ALIAS_ATTACHED_TO_PRIVATE_DEPLOYMENT');
  if (requireStableAlias) assert(aliases.includes(ENVIRONMENT.stableHost), 'PRIVATE_STABLE_ALIAS_NOT_ATTACHED');
  return {
    id: String(value.id || value.uid),
    host: String(value.url || ''),
    ready_state: String(value.readyState || value.state),
  };
}

async function waitReady(id, spec, cwd) {
  for (let attempt = 1; attempt <= 180; attempt += 1) {
    const value = await deployment(id, cwd, 'DEPLOYMENT_READY');
    const state = value?.readyState || value?.state;
    if (state === 'READY') {
      assertExactDeployment(value, spec);
      return value;
    }
    if (['ERROR', 'CANCELED'].includes(state)) stop('DEPLOYMENT_BUILD_FAILED');
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  stop('DEPLOYMENT_READY_TIMEOUT');
}

async function findDeploymentForRun(runId, spec, cwd) {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const payload = await vercelApi(
      `/v6/deployments?projectId=${PROJECT_ID}&teamId=${TEAM_ID}&limit=50`,
      cwd,
      'RUN_DEPLOYMENT_LIST',
    );
    const matches = (Array.isArray(payload?.deployments) ? payload.deployments : [])
      .filter((item) => String(item?.meta?.releaseFoundationRun || '') === runId);
    assert(matches.length <= 1, 'RUN_DEPLOYMENT_COUNT_INVALID');
    if (matches.length === 1) {
      const exact = await deployment(String(matches[0].uid || matches[0].id || ''), cwd, 'RUN_DEPLOYMENT');
      assert(String(exact?.meta?.githubCommitRef || '') === spec.branch, 'RUN_DEPLOYMENT_BRANCH_CHANGED');
      assert(String(exact?.meta?.githubCommitSha || '') === spec.commit, 'RUN_DEPLOYMENT_COMMIT_CHANGED');
      assert(String(exact?.meta?.candidateTree || '') === spec.tree, 'RUN_DEPLOYMENT_TREE_CHANGED');
      return exact;
    }
    if (attempt < 30) await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  return null;
}

async function waitStable(expectedId, cwd) {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const aliases = await readAliases(cwd);
    if (aliases.get(ENVIRONMENT.stableHost) === expectedId) return aliases;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500));
  }
  stop('PRIVATE_STABLE_ALIAS_PROPAGATION_TIMEOUT');
}

async function deployExact(
  spec,
  cwd,
  runId,
  role,
  { expectedProduction, expectedBaseline, onCreated = null },
) {
  const result = await runCaptured('vercel', [
    'deploy', `--target=${ENVIRONMENT.name}`, '--force', '--yes', '--no-wait', '--format=json',
    '--meta', 'githubDeployment=1',
    '--meta', `githubCommitRef=${spec.branch}`,
    '--meta', 'githubCommitOrg=RRG-systems',
    '--meta', 'githubCommitRepo=moremindmap',
    '--meta', `githubCommitSha=${spec.commit}`,
    '--meta', `candidateTree=${spec.tree}`,
    '--meta', `releaseFoundationRun=${runId}`,
    '--meta', `releaseFoundationRole=${role}`,
    '--meta', 'actor=codex',
    '--scope', TEAM, '--no-color', '--non-interactive',
  ], { cwd, label: 'CUSTOM_ENVIRONMENT_DEPLOY', timeoutMs: 20 * 60 * 1000 });
  const envelope = parseJson(result.stdout, 'DEPLOY_JSON_INVALID');
  const selected = envelope?.deployment || envelope;
  const id = String(selected?.id || selected?.deploymentId || '');
  const host = String(selected?.url || selected?.deploymentUrl || '').replace(/^https?:\/\//u, '');
  assert(DEPLOYMENT.test(id), 'DEPLOYMENT_ID_INVALID');
  assert(HOST.test(host), 'DEPLOYMENT_HOST_INVALID');
  if (onCreated) await onCreated({ id, host, ready_state: 'BUILDING' });
  const exact = await waitReady(id, spec, cwd);
  const projected = assertExactDeployment(exact, spec);
  assert(String(exact?.meta?.releaseFoundationRun || '') === runId, 'DEPLOYMENT_RUN_CHANGED');
  assert(String(exact?.meta?.releaseFoundationRole || '') === role, 'DEPLOYMENT_ROLE_CHANGED');
  await verifySsoProtection(projected.host, cwd, 'PRIVATE_CANDIDATE_DIRECT');
  const selectionMethod = await ensurePrivateStableSelection(projected, cwd, {
    expectedProduction,
    expectedBaseline,
  });
  return { ...projected, selection_method: selectionMethod };
}

async function verifySsoProtection(host, cwd, label) {
  assert(HOST.test(host), `${label}_HOST_INVALID`);
  const result = await runCaptured('curl', [
    '--silent', '--show-error', '--output', '/dev/null', '--write-out', '%{http_code} %{redirect_url}',
    `https://${host}/`,
  ], { cwd, label: `${label}_SSO`, timeoutMs: 120_000 });
  const match = result.stdout.trim().match(/^(\d{3})\s+(\S+)$/u);
  assert(match, `${label}_SSO_STATUS_PARSE_FAILED`);
  assert(Number(match[1]) === 302, `${label}_SSO_STATUS_CHANGED`);
  let location;
  try { location = new URL(match[2]); } catch { stop(`${label}_SSO_LOCATION_INVALID`); }
  assert(location.protocol === 'https:' && location.hostname === 'vercel.com' && location.pathname === '/sso-api',
    `${label}_SSO_LOCATION_CHANGED`);
  return { host, status: 302, redirect_host: location.hostname, redirect_path: location.pathname };
}

async function setPrivateStableAlias(deploymentValue, cwd) {
  assert(DEPLOYMENT.test(deploymentValue?.id || ''), 'PRIVATE_ALIAS_TARGET_INVALID');
  await runCaptured('vercel', [
    'alias', 'set', deploymentValue.id, ENVIRONMENT.stableHost,
    '--scope', TEAM, '--no-color', '--non-interactive',
  ], { cwd, label: 'PRIVATE_ALIAS_SET', timeoutMs: 120_000 });
  await waitStable(deploymentValue.id, cwd);
}

async function ensurePrivateStableSelection(
  deploymentValue,
  cwd,
  { expectedProduction, expectedBaseline },
) {
  assert(DEPLOYMENT.test(expectedBaseline || ''), 'EXPECTED_PRIVATE_BASELINE_INVALID');
  const aliases = await readAliases(cwd);
  assertAliasCustody(aliases, { expectedProduction });
  const currentStable = aliases.get(ENVIRONMENT.stableHost);
  assert(
    currentStable === deploymentValue.id || currentStable === expectedBaseline,
    'PRIVATE_STABLE_ALIAS_UNEXPECTED',
  );
  if (currentStable === deploymentValue.id) return 'automatic-custom-environment-alias';
  await setPrivateStableAlias(deploymentValue, cwd);
  return 'explicit-allowlisted-private-alias';
}

async function statusOnlyRequest(check, deploymentId, cwd) {
  const curlArgs = [
    'curl', check.path, '--deployment', deploymentId, '--',
    '--silent', '--show-error', '--output', '/dev/null', '--write-out', '%{http_code}',
  ];
  if (check.origin) curlArgs.push('--header', `Origin: ${check.origin}`);
  const result = await runCaptured('vercel', curlArgs, {
    cwd,
    label: `RUNTIME_${check.id.toUpperCase().replaceAll('-', '_')}`,
    timeoutMs: 120_000,
  });
  const statuses = result.stdout.match(/(?:^|\s)(\d{3})(?:\s|$)/gu)?.map((item) => Number(item.trim())) || [];
  assert(statuses.length === 1, 'RUNTIME_STATUS_PARSE_FAILED');
  assert(statuses[0] === check.expected, `RUNTIME_${check.id.toUpperCase().replaceAll('-', '_')}_FAILED`);
  return { id: check.id, path: check.path, expected_status: check.expected, actual_status: statuses[0] };
}

async function verifyRuntime(deploymentId, cwd) {
  const receipts = [];
  for (const check of SAFE_RUNTIME_CHECKS) receipts.push(await statusOnlyRequest(check, deploymentId, cwd));
  return receipts;
}

function exactOutputPath(path, label) {
  assert(typeof path === 'string' && path.length > 0, `${label}_PATH_MISSING`);
  const exact = resolve(path);
  assert(exact.startsWith(`${STATE_ROOT}/`), `${label}_PATH_OUTSIDE_PRIVATE_STATE_ROOT`);
  return exact;
}

function invocationDigest(args, candidate, rollback, expectedEnvironmentDigest, evidenceBundle) {
  return sha256({
    cycle_id: args['cycle-id'],
    candidate: { branch: candidate.branch, commit: candidate.commit, tree: candidate.tree },
    rollback: { branch: rollback.branch, commit: rollback.commit, tree: rollback.tree },
    expected_production: args['expected-production'],
    expected_production_source: args['expected-production-source'],
    expected_production_tree: args['expected-production-tree'],
    expected_environment_digest: expectedEnvironmentDigest,
    evidence_bundle: evidenceBundle,
  });
}

function addHistory(state, phase, details = {}) {
  state.phase = phase;
  state.history.push({ sequence: state.history.length + 1, phase, at: new Date().toISOString(), ...details });
}

export function isFailedRunLatched(state) {
  const recoveredFailurePhases = new Set([
    'failure-private-baseline-restored',
    'failure-private-baseline-restore-failed',
    'manual-private-baseline-recovery-complete',
  ]);
  return typeof state?.failure_code === 'string'
    || recoveredFailurePhases.has(state?.phase)
    || state?.history?.some((entry) => recoveredFailurePhases.has(String(entry?.phase || ''))) === true;
}

async function verifyProductionDeployment(args, cwd) {
  const value = await deployment(args['expected-production'], cwd, 'PRODUCTION_CUSTODY');
  assert((value?.readyState || value?.state) === 'READY', 'PRODUCTION_NOT_READY');
  assert(String(value?.meta?.githubCommitSha || '') === args['expected-production-source'], 'PRODUCTION_SOURCE_CHANGED');
  assert(String(value?.meta?.candidateTree || '') === args['expected-production-tree'], 'PRODUCTION_TREE_CHANGED');
  return {
    id: String(value.id || value.uid),
    source: String(value.meta.githubCommitSha),
    tree: String(value.meta.candidateTree),
  };
}

function baselineProjection(value) {
  return {
    id: String(value.id || value.uid),
    host: String(value.url || ''),
    source: String(value.meta?.githubCommitSha || ''),
    tree: String(value.meta?.candidateTree || ''),
    branch: String(value.meta?.githubCommitRef || ''),
    ready_state: String(value.readyState || value.state),
  };
}

async function preflight(args, candidate, rollback, environmentDigest) {
  const cwd = candidate.worktree;
  await Promise.all([verifyWorktree(candidate), verifyWorktree(rollback)]);
  const [aliasMap, production] = await Promise.all([
    readAliases(cwd),
    verifyProductionDeployment(args, cwd),
  ]);
  const aliasCustody = assertAliasCustody(aliasMap, { expectedProduction: args['expected-production'] });
  const stableId = aliasCustody.stable_deployment;
  assert(DEPLOYMENT.test(stableId || ''), 'PRIVATE_STABLE_DEPLOYMENT_MISSING');
  const baselineValue = await deployment(stableId, cwd, 'PRIVATE_BASELINE');
  assert((baselineValue?.readyState || baselineValue?.state) === 'READY', 'PRIVATE_BASELINE_NOT_READY');
  assert(baselineValue?.customEnvironment?.id === ENVIRONMENT.id, 'PRIVATE_BASELINE_ENVIRONMENT_CHANGED');
  assert(baselineValue?.customEnvironment?.slug === ENVIRONMENT.name, 'PRIVATE_BASELINE_ENVIRONMENT_NAME_CHANGED');
  assert(String(baselineValue?.meta?.githubCommitSha || '') === rollback.commit, 'PRIVATE_BASELINE_SOURCE_CHANGED');
  assert(String(baselineValue?.meta?.candidateTree || '') === rollback.tree, 'PRIVATE_BASELINE_TREE_CHANGED');
  assert(String(baselineValue?.meta?.githubCommitRef || '') === rollback.branch, 'PRIVATE_BASELINE_BRANCH_CHANGED');
  const metadata = await verifyEnvironment(cwd, environmentDigest);
  const protection = {
    stable: await verifySsoProtection(ENVIRONMENT.stableHost, cwd, 'PRIVATE_STABLE'),
    direct: await verifySsoProtection(String(baselineValue.url || ''), cwd, 'PRIVATE_BASELINE_DIRECT'),
  };
  return {
    production,
    baseline: baselineProjection(baselineValue),
    aliases: aliasCustody,
    environment: metadata,
    protection,
  };
}

async function verifyGlobalGuards(args, cwd, expectedStable, environmentDigest, directHost = null) {
  const [aliasMap, metadata] = await Promise.all([
    readAliases(cwd),
    verifyEnvironment(cwd, environmentDigest),
  ]);
  const aliases = assertAliasCustody(aliasMap, {
    expectedProduction: args['expected-production'],
    expectedStable,
  });
  await verifyProductionDeployment(args, cwd);
  const protection = {
    stable: await verifySsoProtection(ENVIRONMENT.stableHost, cwd, 'PRIVATE_STABLE'),
    ...(directHost ? { direct: await verifySsoProtection(directHost, cwd, 'PRIVATE_DIRECT') } : {}),
  };
  return { aliases, metadata, protection };
}

async function exactRollbackBaseline(state, rollback, cwd) {
  const prior = await deployment(state.pre_cycle.baseline.id, cwd, 'ROLLBACK_BASELINE');
  assert((prior?.readyState || prior?.state) === 'READY', 'ROLLBACK_BASELINE_NOT_READY');
  assert(prior?.customEnvironment?.id === ENVIRONMENT.id, 'ROLLBACK_BASELINE_ENVIRONMENT_CHANGED');
  assert(prior?.customEnvironment?.slug === ENVIRONMENT.name, 'ROLLBACK_BASELINE_ENVIRONMENT_NAME_CHANGED');
  assert(String(prior?.meta?.githubCommitSha || '') === rollback.commit, 'ROLLBACK_BASELINE_SOURCE_CHANGED');
  assert(String(prior?.meta?.candidateTree || '') === rollback.tree, 'ROLLBACK_BASELINE_TREE_CHANGED');
  assert(String(prior?.meta?.githubCommitRef || '') === rollback.branch, 'ROLLBACK_BASELINE_BRANCH_CHANGED');
  return prior;
}

async function restoreAndVerifyBaseline(args, state, rollback, environmentDigest, { runtime = true } = {}) {
  const prior = await exactRollbackBaseline(state, rollback, rollback.worktree);
  const aliases = await readAliases(rollback.worktree);
  assertAliasCustody(aliases, { expectedProduction: args['expected-production'] });
  const currentStable = aliases.get(ENVIRONMENT.stableHost);
  if (currentStable !== state.pre_cycle.baseline.id) {
    assert(
      DEPLOYMENT.test(state.candidate_deployment?.id || '')
        && currentStable === state.candidate_deployment.id,
      'PRIVATE_STABLE_ALIAS_OWNERSHIP_CHANGED',
    );
    await setPrivateStableAlias(state.pre_cycle.baseline, rollback.worktree);
  }
  const guards = await verifyGlobalGuards(
    args,
    rollback.worktree,
    state.pre_cycle.baseline.id,
    environmentDigest,
    state.pre_cycle.baseline.host,
  );
  const runtimeChecks = runtime ? {
    direct: await verifyRuntime(state.pre_cycle.baseline.id, rollback.worktree),
    stable: await verifyRuntime(ENVIRONMENT.stableHost, rollback.worktree),
  } : null;
  return { prior: baselineProjection(prior), guards, runtime: runtimeChecks };
}

function publicFailureCode(error) {
  return error instanceof PrivateCycleBoundaryError
    ? error.message
    : 'ACTUAL_PRIVATE_CYCLE_UNEXPECTED_FAILURE';
}

async function preserveFailureAndRestore({
  args,
  state,
  rollback,
  environmentDigest,
  statePath,
  receiptPath,
  error,
}) {
  const failureCode = publicFailureCode(error);
  let restored = false;
  let restoreFailure = null;
  try {
    await restoreAndVerifyBaseline(args, state, rollback, environmentDigest, { runtime: false });
    restored = true;
    addHistory(state, 'failure-private-baseline-restored', { failure_code: failureCode });
  } catch (restoreError) {
    restoreFailure = publicFailureCode(restoreError);
    addHistory(state, 'failure-private-baseline-restore-failed', {
      failure_code: failureCode,
      restore_failure_code: restoreFailure,
    });
  }
  state.failed_at = new Date().toISOString();
  state.failure_code = failureCode;
  await atomicWriteJson(statePath, state);
  await atomicWriteJson(receiptPath, {
    schema: RECEIPT_SCHEMA,
    verdict: restored ? 'PROMOTION_BLOCKED_PRIVATE_BASELINE_RESTORED' : 'PROMOTION_BLOCKED_RECOVERY_REQUIRED',
    run_id: state.run_id,
    cycle_id: state.cycle_id,
    blocker: failureCode,
    restore_failure_code: restoreFailure,
    private_baseline_restored: restored,
    public_production_mutations: 0,
    customer_mutations: 0,
    stateful_runtime_requests: 0,
    provider_operations: 0,
    customer_emails: 0,
    real_charges: 0,
    secret_values_read: false,
    provider_assignments_disclosed: false,
  });
}

async function writeBlockedReceipt(
  args,
  candidate,
  rollback,
  preflightValue,
  toolSha256,
  environmentDigest,
  evidenceBundle,
) {
  const now = new Date().toISOString();
  const state = {
    schema: STATE_SCHEMA,
    run_id: randomUUID(),
    cycle_id: args['cycle-id'],
    phase: 'promotion-blocked',
    started_at: now,
    completed_at: now,
    tool_sha256: toolSha256,
    environment_metadata_sha256: environmentDigest,
    candidate: { branch: candidate.branch, commit: candidate.commit, tree: candidate.tree },
    rollback: { branch: rollback.branch, commit: rollback.commit, tree: rollback.tree },
    pre_cycle: preflightValue,
    evidence_bundle: evidenceBundle,
    history: [{ sequence: 1, phase: 'promotion-blocked', at: now, code: 'INTENTIONAL_REQUIRED_GATE_FAILURE' }],
  };
  const receipt = {
    schema: RECEIPT_SCHEMA,
    verdict: 'PROMOTION_BLOCKED',
    run_id: state.run_id,
    cycle_id: state.cycle_id,
    blocker: 'INTENTIONAL_REQUIRED_GATE_FAILURE',
    activation_attempted: false,
    deployment_command_spawned: false,
    private_alias_mutations: 0,
    public_production_mutations: 0,
    customer_mutations: 0,
    stateful_runtime_requests: 0,
    provider_operations: 0,
    customer_emails: 0,
    real_charges: 0,
    secret_values_read: false,
    provider_assignments_disclosed: false,
    exact_candidate: state.candidate,
    private_baseline: preflightValue.baseline,
    public_production: preflightValue.production,
    public_aliases_unchanged: true,
    private_stable_alias_unchanged: true,
    environment_metadata_unchanged: true,
    environment_metadata_sha256: environmentDigest,
    tool_sha256: toolSha256,
    historical_product_evidence_reused: evidenceBundle,
  };
  await atomicWriteJson(resolve(args.state), state);
  await atomicWriteJson(resolve(args.receipt), receipt);
  process.stdout.write(`${JSON.stringify({ verdict: receipt.verdict, cycle_id: receipt.cycle_id, activation_attempted: false })}\n`);
}

async function recordCreatedDeployment(state, created, statePath) {
  state.candidate_deployment = created;
  addHistory(state, 'private-target-created', { deployment: created.id });
  await atomicWriteJson(statePath, state);
}

async function selectCandidate({ args, state, candidate, environmentDigest, statePath }) {
  addHistory(state, 'candidate-deploying', { custom_environment: ENVIRONMENT.name });
  await atomicWriteJson(statePath, state);
  state.candidate_deployment = await deployExact(
    candidate,
    candidate.worktree,
    state.run_id,
    'candidate',
    {
      expectedProduction: args['expected-production'],
      expectedBaseline: state.pre_cycle.baseline.id,
      onCreated: (created) => recordCreatedDeployment(state, created, statePath),
    },
  );
  assert(state.candidate_deployment.id !== state.pre_cycle.baseline.id, 'NEW_PRIVATE_DEPLOYMENT_NOT_DISTINCT');
  addHistory(state, 'private-target-selected', { deployment: state.candidate_deployment.id });
  await verifyGlobalGuards(
    args,
    candidate.worktree,
    state.candidate_deployment.id,
    environmentDigest,
    state.candidate_deployment.host,
  );
  await atomicWriteJson(statePath, state);
}

async function reconcileSelectedCandidate({ args, state, candidate, rollback, environmentDigest, statePath }) {
  await Promise.all([verifyWorktree(candidate), verifyWorktree(rollback)]);
  const aliases = await readAliases(candidate.worktree);
  assertAliasCustody(aliases, { expectedProduction: args['expected-production'] });
  const stableId = aliases.get(ENVIRONMENT.stableHost);
  if (stableId === state.pre_cycle.baseline.id) {
    if (state.candidate_deployment?.id) {
      const exact = await waitReady(state.candidate_deployment.id, candidate, candidate.worktree);
      assert(String(exact?.meta?.releaseFoundationRun || '') === state.run_id,
        'RESUME_PRIVATE_TARGET_RUN_CHANGED');
      const projected = assertExactDeployment(exact, candidate);
      await verifySsoProtection(projected.host, candidate.worktree, 'PRIVATE_CANDIDATE_DIRECT');
      state.candidate_deployment = {
        ...projected,
        selection_method: await ensurePrivateStableSelection(projected, candidate.worktree, {
          expectedProduction: args['expected-production'],
          expectedBaseline: state.pre_cycle.baseline.id,
        }),
      };
      assert(state.candidate_deployment.id !== state.pre_cycle.baseline.id, 'NEW_PRIVATE_DEPLOYMENT_NOT_DISTINCT');
    } else {
      const found = await findDeploymentForRun(state.run_id, candidate, candidate.worktree);
      if (found) {
        const id = String(found.id || found.uid);
        const exact = await waitReady(id, candidate, candidate.worktree);
        assert(String(exact?.meta?.releaseFoundationRun || '') === state.run_id,
          'RESUME_PRIVATE_TARGET_RUN_CHANGED');
        const projected = assertExactDeployment(exact, candidate);
        await verifySsoProtection(projected.host, candidate.worktree, 'PRIVATE_CANDIDATE_DIRECT');
        state.candidate_deployment = {
          ...projected,
          selection_method: await ensurePrivateStableSelection(projected, candidate.worktree, {
            expectedProduction: args['expected-production'],
            expectedBaseline: state.pre_cycle.baseline.id,
          }),
        };
        assert(state.candidate_deployment.id !== state.pre_cycle.baseline.id, 'NEW_PRIVATE_DEPLOYMENT_NOT_DISTINCT');
      } else {
        stop('RESUME_DEPLOYMENT_NOT_FOUND_START_NEW_CYCLE');
      }
    }
  } else {
    assert(DEPLOYMENT.test(stableId || ''), 'RESUME_PRIVATE_STABLE_DEPLOYMENT_INVALID');
    const exact = await deployment(stableId, candidate.worktree, 'RESUME_STABLE_CANDIDATE');
    assertExactDeployment(exact, candidate);
    assert(String(exact?.meta?.releaseFoundationRun || '') === state.run_id, 'RESUME_PRIVATE_TARGET_RUN_CHANGED');
    state.candidate_deployment = assertExactDeployment(exact, candidate);
  }
  await verifyGlobalGuards(
    args,
    candidate.worktree,
    state.candidate_deployment.id,
    environmentDigest,
    state.candidate_deployment.host,
  );
  addHistory(state, 'private-target-selected', { recovered_from_saved_state: true });
  await atomicWriteJson(statePath, state);
}

async function sealCompletedCycle({
  args,
  state,
  candidate,
  rollback,
  environmentDigest,
  toolSha256,
  statePath,
  receiptPath,
  rollbackAlreadySelected = false,
}) {
  if (!rollbackAlreadySelected) {
    state.candidate_runtime = {
      direct: await verifyRuntime(state.candidate_deployment.id, candidate.worktree),
      stable: await verifyRuntime(ENVIRONMENT.stableHost, candidate.worktree),
    };
    addHistory(state, 'private-runtime-verified', {
      direct_check_count: state.candidate_runtime.direct.length,
      stable_check_count: state.candidate_runtime.stable.length,
    });
    await atomicWriteJson(statePath, state);
    await exactRollbackBaseline(state, rollback, candidate.worktree);
    addHistory(state, 'private-rollback-selecting', { deployment: state.pre_cycle.baseline.id });
    await atomicWriteJson(statePath, state);
  }
  const restored = await restoreAndVerifyBaseline(args, state, rollback, environmentDigest, { runtime: true });
  state.rollback_runtime = restored.runtime;
  addHistory(state, 'private-rollback-verified', {
    deployment: state.pre_cycle.baseline.id,
    compatibility: 'stateless-read-only-cycle-to-ready-prior-custom-environment-deployment',
    drain_required: false,
  });
  addHistory(state, 'complete');
  state.completed_at = new Date().toISOString();
  await atomicWriteJson(statePath, state);
  const receipt = completedReceipt(state, environmentDigest, toolSha256);
  await atomicWriteJson(receiptPath, receipt);
  process.stdout.write(`${JSON.stringify({ verdict: receipt.verdict, cycle_id: receipt.cycle_id, duration_ms: receipt.duration_ms, restart_recovery_proven: receipt.restart_recovery_proven })}\n`);
}

function completedReceipt(state, environmentDigest, toolSha256, { idempotentResume = false } = {}) {
  return {
    schema: RECEIPT_SCHEMA,
    verdict: 'ACTUAL_PRIVATE_RELEASE_REHEARSAL_GREEN',
    run_id: state.run_id,
    cycle_id: state.cycle_id,
    started_at: state.started_at,
    completed_at: state.completed_at,
    duration_ms: Date.parse(state.completed_at) - Date.parse(state.started_at),
    exact_candidate: state.candidate,
    candidate_deployment: state.candidate_deployment,
    private_baseline_restored: state.pre_cycle.baseline,
    public_production: state.pre_cycle.production,
    candidate_runtime_checks: state.candidate_runtime,
    rollback_runtime_checks: state.rollback_runtime,
    actual_private_target_selections: 2,
    rollback_exercised: true,
    rollback_compatibility: 'stateless-read-only-cycle-to-ready-prior-custom-environment-deployment',
    rollback_drain_required: false,
    restart_recovery_proven: state.resume_count > 0,
    resume_count: state.resume_count,
    public_aliases_unchanged: true,
    private_stable_alias_restored: true,
    private_sso_protection_verified: true,
    direct_and_stable_runtime_verified: true,
    environment_metadata_unchanged: true,
    environment_metadata_sha256: environmentDigest,
    historical_product_evidence_reused: state.evidence_bundle,
    prior_controller_push_rejection_preserved: true,
    provider_operations_repeated: false,
    rendered_product_campaign_repeated: false,
    stateful_runtime_requests: 0,
    public_production_mutations: 0,
    customer_mutations: 0,
    provider_operations: 0,
    customer_emails: 0,
    real_charges: 0,
    secret_values_read: false,
    provider_assignments_disclosed: false,
    tool_sha256: toolSha256,
    ...(idempotentResume ? { idempotent_resume: true } : {}),
  };
}

async function runCycle(args) {
  const candidate = exactSpec(args, 'candidate');
  const rollback = exactSpec(args, 'rollback');
  assert(typeof args['cycle-id'] === 'string' && /^[a-z0-9][a-z0-9-]+$/u.test(args['cycle-id']), 'CYCLE_ID_INVALID');
  assert(DEPLOYMENT.test(args['expected-production'] || ''), 'EXPECTED_PRODUCTION_INVALID');
  assert(SHA.test(args['expected-production-source'] || ''), 'EXPECTED_PRODUCTION_SOURCE_INVALID');
  assert(SHA.test(args['expected-production-tree'] || ''), 'EXPECTED_PRODUCTION_TREE_INVALID');
  assert(!args['restore-only'] || args.resume, 'RESTORE_ONLY_REQUIRES_RESUME');
  assert(args['stop-after'] == null || args['stop-after'] === 'private-target-selected', 'STOP_PHASE_REFUSED');
  const statePath = exactOutputPath(args.state, 'STATE');
  const receiptPath = exactOutputPath(args.receipt, 'RECEIPT');
  assert(statePath !== receiptPath, 'STATE_AND_RECEIPT_PATHS_MUST_DIFFER');
  assert(typeof args.plan === 'string' && args.plan.length > 0, 'SEALED_PLAN_PATH_MISSING');
  assert(typeof args['evidence-manifest'] === 'string' && args['evidence-manifest'].length > 0, 'EVIDENCE_MANIFEST_PATH_MISSING');
  const environmentPath = resolve(args.environment || 'docs/runbooks/release-foundation/PRIVATE_ENVIRONMENT.json');
  const environmentDefinition = await readJson(environmentPath);
  const environmentDigest = String(environmentDefinition.binding_metadata_projection_sha256 || '');
  assert(/^[0-9a-f]{64}$/u.test(environmentDigest), 'EXPECTED_ENVIRONMENT_METADATA_DIGEST_MISSING');
  const evidenceBundle = await verifyEvidenceBundle(
    resolve(args.plan),
    environmentPath,
    resolve(args['evidence-manifest']),
    candidate,
  );
  const toolSha256 = sha256(await readFile(new URL(import.meta.url)));
  const digest = invocationDigest(args, candidate, rollback, environmentDigest, evidenceBundle);
  let state;

  if (args.resume) {
    state = await readJson(statePath);
    assert(state?.schema === STATE_SCHEMA, 'RESUME_STATE_SCHEMA_CHANGED');
    assert(state?.invocation_sha256 === digest, 'RESUME_CUSTODY_DRIFT');
    assert(state?.tool_sha256 === toolSha256, 'RESUME_TOOL_DRIFT');
    assert(state?.phase !== 'promotion-blocked', 'RESUME_PHASE_REFUSED');
    assert(!isFailedRunLatched(state) || args['restore-only'],
      'FAILED_RUN_NORMAL_RESUME_REFUSED');
    if (state?.phase === 'complete') {
      assert(!args['restore-only'], 'RESTORE_ONLY_COMPLETED_RUN_REFUSED');
      await Promise.all([verifyWorktree(candidate), verifyWorktree(rollback)]);
      await restoreAndVerifyBaseline(args, state, rollback, environmentDigest, { runtime: false });
      const receipt = completedReceipt(state, environmentDigest, toolSha256, { idempotentResume: true });
      await atomicWriteJson(receiptPath, receipt);
      process.stdout.write(`${JSON.stringify({ verdict: receipt.verdict, cycle_id: receipt.cycle_id, idempotent_resume: true })}\n`);
      return;
    }
    state.resume_count += 1;
    addHistory(state, 'resumed', { from_durable_state: true, prior_phase: state.phase });
    await atomicWriteJson(statePath, state);
    await Promise.all([verifyWorktree(candidate), verifyWorktree(rollback)]);
    if (args['restore-only']) {
      const restored = await restoreAndVerifyBaseline(args, state, rollback, environmentDigest, { runtime: true });
      state.rollback_runtime = restored.runtime;
      addHistory(state, 'manual-private-baseline-recovery-complete');
      state.recovered_at = new Date().toISOString();
      await atomicWriteJson(statePath, state);
      await atomicWriteJson(receiptPath, {
        schema: RECEIPT_SCHEMA,
        verdict: 'PRIVATE_BASELINE_RECOVERY_GREEN',
        run_id: state.run_id,
        cycle_id: state.cycle_id,
        private_baseline_restored: state.pre_cycle.baseline,
        public_production_mutations: 0,
        customer_mutations: 0,
        stateful_runtime_requests: 0,
        secret_values_read: false,
        provider_assignments_disclosed: false,
      });
      process.stdout.write(`${JSON.stringify({ verdict: 'PRIVATE_BASELINE_RECOVERY_GREEN', cycle_id: state.cycle_id })}\n`);
      return;
    }
  } else {
    try {
      await readFile(statePath);
      stop('STATE_EXISTS_USE_RESUME');
    } catch (error) {
      if (error instanceof PrivateCycleBoundaryError) throw error;
      if (error?.code !== 'ENOENT') throw error;
    }
    const preflightValue = await preflight(args, candidate, rollback, environmentDigest);
    if (args['intentional-failure']) {
      await verifyGlobalGuards(
        args,
        candidate.worktree,
        preflightValue.baseline.id,
        environmentDigest,
        preflightValue.baseline.host,
      );
      await writeBlockedReceipt(
        args,
        candidate,
        rollback,
        preflightValue,
        toolSha256,
        environmentDigest,
        evidenceBundle,
      );
      process.exitCode = 2;
      return;
    }
    state = {
      schema: STATE_SCHEMA,
      run_id: randomUUID(),
      cycle_id: args['cycle-id'],
      started_at: new Date().toISOString(),
      tool_sha256: toolSha256,
      invocation_sha256: digest,
      environment_metadata_sha256: environmentDigest,
      candidate: { branch: candidate.branch, commit: candidate.commit, tree: candidate.tree },
      rollback: { branch: rollback.branch, commit: rollback.commit, tree: rollback.tree },
      pre_cycle: preflightValue,
      evidence_bundle: evidenceBundle,
      phase: 'prepared',
      resume_count: 0,
      history: [{ sequence: 1, phase: 'prepared', at: new Date().toISOString() }],
    };
    await atomicWriteJson(statePath, state);
  }

  try {
    const aliasMap = await readAliases(candidate.worktree);
    assertAliasCustody(aliasMap, { expectedProduction: args['expected-production'] });
    const stableId = aliasMap.get(ENVIRONMENT.stableHost);
    const rollbackAlreadySelected = args.resume
      && stableId === state.pre_cycle.baseline.id
      && state.candidate_runtime
      && state.history.some((entry) => entry.phase === 'private-rollback-selecting');
    if (!rollbackAlreadySelected) {
      if (args.resume) {
        await reconcileSelectedCandidate({ args, state, candidate, rollback, environmentDigest, statePath });
      } else {
        await selectCandidate({ args, state, candidate, environmentDigest, statePath });
      }
      if (!args.resume && args['stop-after'] === 'private-target-selected') {
        const paused = {
          schema: RECEIPT_SCHEMA,
          verdict: 'PAUSED_AFTER_PRIVATE_TARGET_SELECTION',
          run_id: state.run_id,
          cycle_id: state.cycle_id,
          exact_candidate: state.candidate,
          candidate_deployment: state.candidate_deployment,
          restart_recovery_required: true,
          public_aliases_unchanged: true,
          private_sso_protection_verified: true,
          customer_mutations: 0,
          stateful_runtime_requests: 0,
          provider_operations: 0,
          customer_emails: 0,
          real_charges: 0,
          secret_values_read: false,
          provider_assignments_disclosed: false,
        };
        await atomicWriteJson(receiptPath, paused);
        process.stdout.write(`${JSON.stringify({ verdict: paused.verdict, cycle_id: paused.cycle_id })}\n`);
        return;
      }
    }
    await sealCompletedCycle({
      args,
      state,
      candidate,
      rollback,
      environmentDigest,
      toolSha256,
      statePath,
      receiptPath,
      rollbackAlreadySelected,
    });
  } catch (error) {
    await preserveFailureAndRestore({
      args,
      state,
      rollback,
      environmentDigest,
      statePath,
      receiptPath,
      error,
    });
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args['metadata-digest-only']) {
    const cwd = resolve(args['candidate-worktree'] || process.cwd());
    const projection = await verifyEnvironment(cwd);
    process.stdout.write(`${JSON.stringify({ verdict: 'ENVIRONMENT_METADATA_DIGEST_GREEN', ...projection })}\n`);
    return;
  }
  await runCycle(args);
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) {
  main().catch((error) => {
    const code = error instanceof PrivateCycleBoundaryError
      ? error.message
      : 'ACTUAL_PRIVATE_CYCLE_UNEXPECTED_FAILURE';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
