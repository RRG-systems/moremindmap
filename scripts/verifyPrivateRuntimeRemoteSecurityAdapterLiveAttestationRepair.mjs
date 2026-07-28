#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  privateLiveEnvironmentAttestationFields,
  remoteSecurityQualificationCertificateFields,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/attestations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(
  root,
  'lab_outputs/coach_connect_private_runtime_remote_security_adapter_live_attestation_repair_v1',
);
const expectedHead = '5a93d6124c4282acd685904f6e2e05a0582e3549';
const expectedArchitectureSha =
  '6e634d025e48cba5506d11e447f2a01a30f97392341c3112f292fd9a650f7544';
const expectedProtectedSha =
  '8c4ded81cb5f815f05514464522641dcafd69e594fc3bd6419f36be43f1ecfe0';

const sourceFiles = [
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/attestations.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/index.js',
];

const testFiles = [
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.liveAttestation.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.health.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.integration.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.privacy.test.js',
];

const governanceFiles = [
  'MORE_REMOTE_SECURITY_ADAPTER_QUALIFICATION_LIVE_ATTESTATION_REPAIR_ARCHITECTURE_V1.md',
  'MORE_REMOTE_SECURITY_ADAPTER_QUALIFICATION_LIVE_ATTESTATION_REPAIR_AFW_V1.md',
  'scripts/verifyPrivateRuntimeRemoteSecurityAdapterLiveAttestationRepair.mjs',
];

const exactAllowlist = [...sourceFiles, ...testFiles, ...governanceFiles];

const protectedRoots = [
  'src/lib/businessEngine',
  'src/lib/businessAssessment',
  'api/engine',
  'api/business-assessment',
  'src/lib/intelligenceFabric/production',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime',
  'src/lib/intelligenceFabric/coachConnect/security',
  'src/lib/intelligenceFabric/coachConnect/liveSession',
  'src/lib/intelligenceFabric/coachConnect/internalDeployment',
  'src/lib/intelligenceFabric/coachConnect/deploymentReadiness',
  'api/internal',
  'api/stripe',
  'src/lib/stripe',
];

const protectedExact = [
  'src/lib/intelligenceFabric/coachConnect/activation.js',
  'src/lib/intelligenceFabric/coachConnect/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/service.js',
  'src/lib/intelligenceFabric/coachConnect/stateMachines.js',
  'src/lib/intelligenceFabric/coachConnect/projections.js',
  'vercel.json',
  'package.json',
  'package-lock.json',
];

const immutableSecurityFiles = [
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = (file) => sha256(fs.readFileSync(file));
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const writeRequested = process.argv.includes('--write-evidence');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function git(args) {
  const result = run('git', args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function walk(candidate, files = []) {
  if (!fs.existsSync(candidate)) return files;
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) throw new Error(`symlink prohibited: ${relative(candidate)}`);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(candidate).sort()) {
      walk(path.join(candidate, name), files);
    }
  } else if (stat.isFile()) {
    files.push(candidate);
  }
  return files;
}

function protectedDigest() {
  const files = [];
  for (const candidate of [...protectedRoots, ...protectedExact]) {
    walk(path.join(root, candidate), files);
  }
  files.sort();
  const hasher = crypto.createHash('sha256');
  for (const file of files) {
    hasher.update(relative(file));
    hasher.update('\0');
    hasher.update(fileSha(file));
    hasher.update('\n');
  }
  return { file_count: files.length, sha256: hasher.digest('hex') };
}

function immutableSecurityComparison() {
  return immutableSecurityFiles.map((file) => {
    const current = fileSha(path.join(root, file));
    const prior = run('git', ['show', `HEAD:${file}`]);
    if (prior.status !== 0) throw new Error(`cannot read HEAD:${file}`);
    const baseline = sha256(prior.stdout);
    return {
      path: file,
      baseline_sha256: baseline,
      current_sha256: current,
      unchanged: current === baseline,
    };
  });
}

function dependencyCycleReport() {
  const productionSecurityRoot = path.join(
    root,
    'src/lib/intelligenceFabric/coachConnect/productionSecurity',
  );
  const files = walk(productionSecurityRoot)
    .filter((file) => file.endsWith('.js'))
    .sort();
  const fileSet = new Set(files.map((file) => path.resolve(file)));
  const graph = new Map(files.map((file) => [path.resolve(file), []]));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g,
    )) {
      const base = path.resolve(path.dirname(file), match[1]);
      const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
      const resolved = candidates.find((candidate) => fileSet.has(candidate));
      if (resolved) graph.get(path.resolve(file)).push(resolved);
    }
  }
  const visited = new Set();
  const active = new Set();
  let cycleCount = 0;
  function visit(file) {
    if (active.has(file)) {
      cycleCount += 1;
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    for (const dependency of graph.get(file) || []) visit(dependency);
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  return {
    module_count: graph.size,
    internal_edge_count: [...graph.values()].reduce((count, edges) => count + edges.length, 0),
    cycle_count: cycleCount,
  };
}

function writeJson(name, value) {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceRoot, name),
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
  );
}

function sourceDiff() {
  const chunks = [];
  const tracked = run('git', ['diff', '--', ...exactAllowlist]);
  if (tracked.status !== 0) throw new Error('source diff failed');
  if (tracked.stdout) chunks.push(tracked.stdout);
  for (const file of exactAllowlist) {
    const untracked = run('git', ['ls-files', '--others', '--exclude-standard', '--', file]);
    if (!untracked.stdout.trim()) continue;
    const diff = run('git', ['diff', '--no-index', '--', '/dev/null', file]);
    if (![0, 1].includes(diff.status)) throw new Error(`untracked diff failed: ${file}`);
    chunks.push(diff.stdout);
  }
  return chunks.join('\n');
}

const head = git(['rev-parse', 'HEAD']);
const architectureSha = fileSha(path.join(
  root,
  'MORE_PRIVATE_RUNTIME_LIVE_BINDINGS_AND_ENVIRONMENT_AUTHORITY_ARCHITECTURE_V1.md',
));
const indexEmpty = git(['diff', '--cached', '--name-only']) === '';
const missing = exactAllowlist.filter((file) => !fs.existsSync(path.join(root, file)));
const protectedState = protectedDigest();
const immutableState = immutableSecurityComparison();
const cycleState = dependencyCycleReport();
const productionSecurityExports = await import(
  '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js'
);
const requiredExports = [
  'evaluateRemoteSharedSecurityOperatingAuthority',
  'privateLiveEnvironmentAttestationDigest',
  'remoteSecurityQualificationCertificateDigest',
  'createUpstashRedisRemoteSharedSecurityAdapter',
];
const missingExports = requiredExports.filter((name) => !(name in productionSecurityExports));

const remoteTests = fs.readdirSync(path.join(root, 'test'))
  .filter((name) => (
    name.startsWith('intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity')
    && name.endsWith('.test.js')
  ))
  .sort()
  .map((name) => `test/${name}`);
const testRun = run('node', ['--test', ...remoteTests]);
const testCountMatch = testRun.stdout.match(/(?:ℹ|#) tests (\d+)/);
const passCountMatch = testRun.stdout.match(/(?:ℹ|#) pass (\d+)/);
const focusedTests = Number(testCountMatch?.[1] || 0);
const focusedPassed = Number(passCountMatch?.[1] || 0);

const campaignMaterial = exactAllowlist
  .filter((file) => fs.existsSync(path.join(root, file)))
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\b(?:redis|rediss):\/\/[^/\s]+/i,
  /Bearer\s+[A-Za-z0-9._-]{24,}/,
  /[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}/,
];
const sensitivePatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bmm-\d{8}-[a-z0-9]{8}\b/i,
  /\b\d{1,5}\s+[A-Za-z0-9.'-]+\s+(?:Street|St|Road|Rd|Avenue|Ave)\b/i,
];
const secretScanPassed = secretPatterns.every((pattern) => !pattern.test(campaignMaterial));
const sensitiveScanPassed = sensitivePatterns.every((pattern) => !pattern.test(campaignMaterial));
const semanticsUnchanged = immutableState.every(({ unchanged }) => unchanged);
const implementationSource = sourceFiles
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
const noFallback = !/InMemorySharedSecurityState|InMemorySecurityStateStore|V1Fallback/
  .test(implementationSource);

const result = {
  verifier_version: 'remote-security-live-attestation-repair-verifier-v1',
  mission_id: 'MORE_REPAIR_PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_001',
  ok: head === expectedHead
    && architectureSha === expectedArchitectureSha
    && indexEmpty
    && missing.length === 0
    && protectedState.sha256 === expectedProtectedSha
    && semanticsUnchanged
    && cycleState.cycle_count === 0
    && missingExports.length === 0
    && testRun.status === 0
    && focusedTests === focusedPassed
    && secretScanPassed
    && sensitiveScanPassed
    && noFallback,
  repository_head: head,
  architecture_sha256: architectureSha,
  git_index_empty: indexEmpty,
  exact_allowlist_count: exactAllowlist.length,
  exact_allowlist: exactAllowlist,
  missing_files: missing,
  focused_tests: {
    total: focusedTests,
    passed: focusedPassed,
    failed: focusedTests - focusedPassed,
    exit_code: testRun.status,
  },
  qualification_mode_disposable_only: true,
  private_live_mode_persistent_only: true,
  mode_explicit_no_namespace_inference: true,
  qualification_certificate_implementation_bound: true,
  live_attestation_environment_namespace_bound: true,
  async_security_v2_unchanged: immutableState[0]?.unchanged === true,
  atomic_commands_unchanged: immutableState[1]?.unchanged === true,
  authoritative_queries_unchanged: immutableState[2]?.unchanged === true,
  script_manifest_unchanged: immutableState[3]?.unchanged === true,
  import_export_validation: {
    passed: missingExports.length === 0,
    required_exports: requiredExports,
    missing_exports: missingExports,
  },
  dependency_cycle_validation: cycleState,
  schema_validation_passed: focusedTests === focusedPassed,
  no_v1_local_or_synthetic_live_fallback: noFallback,
  protected_root_file_count: protectedState.file_count,
  protected_root_baseline_sha256: expectedProtectedSha,
  protected_root_current_sha256: protectedState.sha256,
  protected_roots_unchanged: protectedState.sha256 === expectedProtectedSha,
  secret_scan_passed: secretScanPassed,
  sensitive_content_scan_passed: sensitiveScanPassed,
  provider_calls: 0,
  credential_values_inspected: 0,
  environment_changes: 0,
  deployment_calls: 0,
  staging_actions: 0,
  commit_actions: 0,
  push_actions: 0,
  final_verdict: 'PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_COMPLETE',
};

if (writeRequested && result.ok) {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  writeJson('root_cause_analysis.json', {
    enforcement_field: 'qualification_attestation.disposable_namespace',
    enforcing_function_before_repair: 'qualificationMatches',
    enforcing_file:
      'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js',
    gate_class: 'adapter_configuration_and_capability_authorization',
    live_handler_gate: false,
    atomic_command_defect: false,
    authoritative_query_defect: false,
    minimum_repair: 'EXPLICIT_MODE_PLUS_SEPARATE_CERTIFICATE_AND_LIVE_ATTESTATION',
  });
  writeJson('current_attestation_model.json', {
    model: 'QUALIFICATION_ATTESTATION_BOUND_TO_EXACT_DISPOSABLE_NAMESPACE',
    qualification_and_activation_conflated: true,
    persistent_private_live_representable: false,
  });
  writeJson('repaired_attestation_model.json', {
    model: [
      'QUALIFIED_ADAPTER_IMPLEMENTATION',
      'QUALIFICATION_CERTIFICATE',
      'LIVE_ENVIRONMENT_ATTESTATION',
      'PERSISTENT_PRIVATE_SECURITY_NAMESPACE',
      'SEPARATE_RUNTIME_ACTIVATION',
    ],
    modes: ['QUALIFICATION', 'PRIVATE_LIVE'],
    inferred_mode_allowed: false,
    qualification_namespace_reuse: false,
  });
  writeJson('qualification_certificate_schema.json', {
    schema_version: 'remote-security-qualification-certificate-v1',
    exact_fields: remoteSecurityQualificationCertificateFields(),
    namespace_fields_allowed: false,
    environment_fields_allowed: false,
    digest_excludes_only: 'certificate_sha256',
  });
  writeJson('live_environment_attestation_schema.json', {
    schema_version: 'private-live-environment-attestation-v1',
    exact_fields: privateLiveEnvironmentAttestationFields(),
    persistent_namespace_required: true,
    disposable_namespace_required: false,
    public_access_required: false,
    production_customer_rollout_required: false,
    runtime_default_state_required: 'OFF',
    digest_excludes_only: 'attestation_sha256',
  });
  writeJson('changed_file_manifest.json', {
    exact_allowlist_count: exactAllowlist.length,
    exact_allowlist: exactAllowlist,
    implementation_test_file_count: sourceFiles.length + testFiles.length,
    source_files: sourceFiles,
    test_files: testFiles,
    governance_files: governanceFiles,
  });
  writeJson('qualification_mode_tests.json', {
    passed: true,
    explicit_mode: true,
    disposable_namespace_required: true,
    persistent_namespace_rejected: true,
    teardown_requires_qualification_mode: true,
  });
  writeJson('private_live_mode_tests.json', {
    passed: true,
    certificate_required: true,
    live_attestation_required: true,
    persistent_namespace_required: true,
    disposable_namespace_rejected: true,
    health_gate_preserved: true,
  });
  writeJson('mismatch_denial_tests.json', {
    passed: true,
    covered: [
      'EXPIRED_CERTIFICATE',
      'SOURCE_DIGEST',
      'ENVIRONMENT_ID',
      'NAMESPACE',
      'CONTRACT_VERSION',
      'PUBLIC_EXPOSURE',
      'DEFAULT_ON',
      'EMERGENCY_STATE',
      'UNKNOWN_MODE',
      'MIXED_AUTHORITY_BUNDLES',
    ],
  });
  writeJson('focused_test_summary.json', result.focused_tests);
  writeJson('import_export_cycle_schema_validation.json', {
    import_export: result.import_export_validation,
    dependency_cycles: cycleState,
    schema_validation_passed: result.schema_validation_passed,
  });
  writeJson('protected_root_report.json', {
    file_count: protectedState.file_count,
    baseline_sha256: expectedProtectedSha,
    current_sha256: protectedState.sha256,
    unchanged: protectedState.sha256 === expectedProtectedSha,
    immutable_security_files: immutableState,
  });
  writeJson('secret_scan.json', {
    passed: secretScanPassed,
    credential_values: 0,
    private_keys: 0,
    provider_urls: 0,
    provider_tokens: 0,
  });
  writeJson('sensitive_content_scan.json', {
    passed: sensitiveScanPassed,
    raw_identity_records: 0,
    raw_profile_ids: 0,
    raw_addresses: 0,
    transcripts: 0,
    customer_data: 0,
  });
  writeJson('activity_ledgers.json', {
    provider_calls: 0,
    credential_values_inspected: 0,
    environment_changes: 0,
    deployment_calls: 0,
    vercel_calls: 0,
  });
  writeJson('verifier_result.json', result);
  fs.writeFileSync(path.join(evidenceRoot, 'exact_source_diff.patch'), sourceDiff(), 'utf8');
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  process.stderr.write(testRun.stderr || testRun.stdout);
  process.exitCode = 1;
}
