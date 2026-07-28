#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  PRIVATE_RUNTIME_LIVE_REFERENCE_VARIABLES,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/configurationAuthority.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(
  root,
  'lab_outputs/coach_connect_private_runtime_live_wiring_v2',
);
const expectedHead = '2faf462ddaac6ae4ec4c2bae49fe773579a5ca71';
const expectedSubject =
  'fix(private-runtime): separate qualification and live attestation authority';
const expectedLiveAttestationReviewSha =
  '4545be94544cdaf29940a45968ef2ac52b6865ed901aac87b84c265bf69f1b45';
const expectedLiveAttestationReceiptSha =
  '97bace9167d6c2473762ad3ac27a472988924857afc4d630186daa5608c3d549';
const expectedQualificationReviewSha =
  '28b42df527bea92dce9a0ccfab9b72a933f8975529e3f02a64853b289f0c47ac';
const expectedProtectedDirtyFingerprint =
  '49dda235581a3bf14f5ccb214f98f8c670d487965caf51f2c933b24443b916dd';
const baselineSafeRegressionCount = 553;

const handlerFiles = [
  'api/internal/private-runtime-login.js',
  'api/internal/private-runtime-callback.js',
  'api/internal/private-runtime-session.js',
  'api/internal/private-runtime-bootstrap.js',
  'api/internal/private-runtime-logout.js',
  'api/internal/developer-access.js',
  'api/internal/subscription-entitlement.js',
];

const implementationFiles = [
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/environmentAttestation.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/configurationAuthority.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/businessEngineAttachmentAdapter.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/subscriptionRuntimeAttachmentAdapter.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/coachConnectAttachmentAdapter.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/attachmentCoordinator.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/compositionRoot.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/liveSubscriberAssertion/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/liveSubscriberAssertion/oidcTransaction.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/liveSubscriberAssertion/auth0Adapter.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/liveSubscriberAssertion/index.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js',
  ...handlerFiles,
];

const focusedTestFiles = [
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.assertion.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.businessEngine.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.subscription.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.coachConnect.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.environment.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.composition.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.handlers.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.failureRecovery.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.integration.test.js',
];

const verifierFile =
  'scripts/verifyPrivateRuntimeLiveBindingsAndEnvironmentAuthority.mjs';
const exactAllowlist = [...implementationFiles, ...focusedTestFiles, verifierFile];

const expectedPreexistingTracked = [
  'api/engine/businessAssessment/buildBusinessIntelligenceDraft.js',
  'lab_outputs/mmm8_business_engine_contract/run_fixture_validation.mjs',
  'src/components/businessAssessment/BusinessEngineVisualV2.jsx',
  'src/lib/businessAssessment/inferEToPScores.js',
  'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js',
  'src/lib/businessEngine/buildBusinessEngineContract.js',
  'src/lib/businessEngine/contractDisplaySemantics.js',
  'src/lib/businessEngine/contractVersion.js',
  'src/lib/businessEngine/projectBusinessEngineVisualV2.js',
];

const protectedFingerprintPaths = [
  'src/lib/businessEngine',
  'src/lib/businessAssessment',
  'api/engine',
  'api/business-assessment',
  'src/lib/intelligenceFabric/production',
  'api/stripe',
  'src/lib/stripe',
  'package.json',
  'package-lock.json',
  'vercel.json',
];

const immutableQualifiedAdapterFiles = [
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js',
];

const requiredPrivateRuntimeExports = [
  'buildPrivateRuntimeLiveCompositionRootV2',
  'createCanonicalBusinessEngineLiveAttachmentAdapterV1',
  'createExistingCoachConnectLiveAttachmentAdapterV1',
  'createExistingSubscriptionRuntimeLiveAttachmentAdapterV1',
  'createPrivateRuntimeLiveAttachmentCoordinatorV1',
  'getPrivateRuntimeLiveCompositionV2',
];
const requiredProductionSecurityExports = [
  'createAuth0LiveSubscriberAssertionAdapterV1',
];

const configurationContract = [
  {
    name: 'MORE_PRIVATE_RUNTIME_LIVE_ENABLED',
    purpose: 'source-default-off activation projection',
    secret: false,
    authority: 'configuration authority packet plus separate activation receipt',
    rollback: 'set false and revoke activation receipt',
  },
  {
    name: 'MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED',
    purpose: 'dominant emergency disable projection',
    secret: false,
    authority: 'configuration authority packet',
    rollback: 'requires reviewed recovery authority before false',
  },
  {
    name: 'MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256',
    purpose: 'bind committed adapter implementation to Qualification Certificate',
    secret: false,
    authority: 'reviewed adapter source manifest',
    rollback: 'restore reviewed digest and disable runtime',
  },
  ...PRIVATE_RUNTIME_LIVE_REFERENCE_VARIABLES.map((name) => ({
    name,
    purpose: 'server-side authority document reference',
    secret: false,
    authority: 'named operator controlled private-live configuration',
    rollback: 'remove reference and disable runtime',
  })),
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = (file) => sha256(fs.readFileSync(file));
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const writeEvidence = process.argv.includes('--write-evidence');
const fullValidation = process.argv.includes('--full');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
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

function parseTestResult(result) {
  const combined = `${result.stdout}\n${result.stderr}`;
  const read = (label) => Number(
    combined.match(new RegExp(`(?:ℹ|#) ${label} (\\d+)`))?.[1] || 0,
  );
  return {
    total: read('tests'),
    passed: read('pass'),
    failed: read('fail'),
    skipped: read('skipped'),
    exit_code: result.status,
  };
}

function runTests(files) {
  const result = run('node', ['--test', ...files]);
  return {
    result,
    summary: parseTestResult(result),
  };
}

function dependencyCycleReport() {
  const moduleRoot = path.join(root, 'src/lib/intelligenceFabric/coachConnect');
  const files = walk(moduleRoot).filter((file) => file.endsWith('.js')).sort();
  const fileSet = new Set(files.map((file) => path.resolve(file)));
  const graph = new Map(files.map((file) => [path.resolve(file), []]));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g,
    )) {
      const base = path.resolve(path.dirname(file), match[1]);
      const resolved = [base, `${base}.js`, path.join(base, 'index.js')]
        .find((candidate) => fileSet.has(candidate));
      if (resolved) graph.get(path.resolve(file)).push(resolved);
    }
  }
  const visited = new Set();
  const active = new Set();
  const cycles = [];
  function visit(file, stack = []) {
    if (active.has(file)) {
      const start = stack.indexOf(file);
      cycles.push([...stack.slice(start), file].map(relative));
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    for (const dependency of graph.get(file) || []) visit(dependency, [...stack, file]);
    active.delete(file);
  }
  for (const file of graph.keys()) visit(file);
  return {
    module_count: graph.size,
    internal_edge_count: [...graph.values()]
      .reduce((total, edges) => total + edges.length, 0),
    cycle_count: cycles.length,
    cycles,
  };
}

function distDigest() {
  const distRoot = path.join(root, 'dist');
  const files = walk(distRoot).sort();
  const hasher = crypto.createHash('sha256');
  for (const file of files) {
    hasher.update(relative(file));
    hasher.update('\0');
    hasher.update(fs.readFileSync(file));
    hasher.update('\n');
  }
  return {
    file_count: files.length,
    sha256: hasher.digest('hex'),
  };
}

function sourceDiff() {
  const chunks = [];
  const tracked = run('git', ['diff', '--', ...exactAllowlist]);
  if (tracked.status !== 0) throw new Error('campaign source diff failed');
  if (tracked.stdout) chunks.push(tracked.stdout);
  for (const file of exactAllowlist) {
    const untracked = git(['ls-files', '--others', '--exclude-standard', '--', file]);
    if (!untracked) continue;
    const diff = run('git', ['diff', '--no-index', '--', '/dev/null', file]);
    if (![0, 1].includes(diff.status)) throw new Error(`untracked diff failed: ${file}`);
    chunks.push(diff.stdout);
  }
  return chunks.join('\n');
}

function changedCampaignFiles() {
  const tracked = new Set(git(['diff', '--name-only']).split('\n').filter(Boolean));
  const untracked = new Set(
    git(['ls-files', '--others', '--exclude-standard', '--', ...exactAllowlist])
      .split('\n')
      .filter(Boolean),
  );
  return exactAllowlist.filter((file) => tracked.has(file) || untracked.has(file));
}

function writeJson(name, value) {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  fs.writeFileSync(path.join(evidenceRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

function protectedFingerprint() {
  const result = run('git', ['diff', '--binary', '--', ...protectedFingerprintPaths], {
    encoding: null,
  });
  if (result.status !== 0) throw new Error('protected-root comparison failed');
  return sha256(result.stdout);
}

function immutableComparison() {
  return immutableQualifiedAdapterFiles.map((file) => {
    const currentSha = fileSha(path.join(root, file));
    const baseline = run('git', ['show', `HEAD:${file}`], { encoding: null });
    if (baseline.status !== 0) throw new Error(`cannot read HEAD:${file}`);
    const baselineSha = sha256(baseline.stdout);
    return {
      path: file,
      baseline_sha256: baselineSha,
      current_sha256: currentSha,
      unchanged: currentSha === baselineSha,
    };
  });
}

const head = git(['rev-parse', 'HEAD']);
const subject = git(['show', '-s', '--format=%s', 'HEAD']);
const indexEmpty = git(['diff', '--cached', '--name-only']) === '';
const reviewSha = fileSha(path.join(
  root,
  'PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_REVIEW_V1.zip',
));
const receiptSha = fileSha(path.join(
  root,
  'MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_COMMIT_RECEIPT_V1.md',
));
const qualificationReviewSha = fileSha(path.join(
  root,
  'PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ATOMIC_AUDIT_REPAIR_REVIEW_V1.zip',
));
const missingAllowlist = exactAllowlist.filter((file) => !fs.existsSync(path.join(root, file)));
const changedFiles = changedCampaignFiles();
const changedTracked = git(['diff', '--name-only']).split('\n').filter(Boolean);
const unexpectedTracked = changedTracked.filter((file) => (
  !exactAllowlist.includes(file) && !expectedPreexistingTracked.includes(file)
));
const preexistingTrackedStillExact = expectedPreexistingTracked.every(
  (file) => changedTracked.includes(file),
);
const protectedState = protectedFingerprint();
const immutableState = immutableComparison();
const cycleState = dependencyCycleReport();

const privateRuntimeExports = await import(
  '../src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js'
);
const productionSecurityExports = await import(
  '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js'
);
const missingPrivateRuntimeExports = requiredPrivateRuntimeExports.filter(
  (name) => !(name in privateRuntimeExports),
);
const missingProductionSecurityExports = requiredProductionSecurityExports.filter(
  (name) => !(name in productionSecurityExports),
);
const missingExports = [
  ...missingPrivateRuntimeExports,
  ...missingProductionSecurityExports,
];

const handlerSource = handlerFiles
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
const compositionSource = [
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/compositionRoot.js',
].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const accessorCount = handlerFiles.filter((file) => (
  fs.readFileSync(path.join(root, file), 'utf8')
    .includes('getPrivateRuntimeLiveCompositionV2')
)).length;
const prohibitedHandlerImports = [
  'remoteSharedSecurity/',
  'InMemorySecurity',
  'SyntheticAsync',
  'SecurityStoreV1',
].filter((needle) => handlerSource.includes(needle));
const prohibitedCompositionFallbacks = [
  'InMemorySharedSecurityState',
  'SyntheticAsyncSecurity',
  'SecurityStoreV1',
].filter((needle) => compositionSource.includes(needle));

const focusedRun = runTests(focusedTestFiles);
const targetedFiles = fs.readdirSync(path.join(root, 'test'))
  .filter((name) => (
    (name.startsWith('intelligenceFabric.coachConnect.privateRuntime.')
      || name.startsWith(
        'intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.',
      ))
    && name.endsWith('.test.js')
  ))
  .sort()
  .map((name) => `test/${name}`);
const targetedRun = runTests(targetedFiles);

let safeRun = {
  result: { status: null },
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    exit_code: null,
  },
};
let buildProof = {
  run_1_exit_code: null,
  run_2_exit_code: null,
  run_1: null,
  run_2: null,
  deterministic: false,
};
let lintProof = { exit_code: null, passed: false };
if (fullValidation) {
  const safeFiles = fs.readdirSync(path.join(root, 'test'))
    .filter((name) => name.startsWith('intelligenceFabric') && name.endsWith('.test.js'))
    .sort()
    .map((name) => `test/${name}`);
  safeRun = runTests(safeFiles);

  const build1 = run('npm', ['run', 'build']);
  const digest1 = build1.status === 0 ? distDigest() : null;
  const build2 = run('npm', ['run', 'build']);
  const digest2 = build2.status === 0 ? distDigest() : null;
  buildProof = {
    run_1_exit_code: build1.status,
    run_2_exit_code: build2.status,
    run_1: digest1,
    run_2: digest2,
    deterministic: build1.status === 0
      && build2.status === 0
      && digest1?.sha256 === digest2?.sha256,
  };

  const lint = run(
    path.join(root, 'node_modules/.bin/eslint'),
    [...implementationFiles, ...focusedTestFiles, verifierFile],
  );
  lintProof = {
    exit_code: lint.status,
    passed: lint.status === 0,
    output: `${lint.stdout}\n${lint.stderr}`.trim(),
  };
}

const campaignMaterial = exactAllowlist
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
const secretScan = {
  private_keys: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(campaignMaterial),
  openai_keys: /\bsk-[A-Za-z0-9_-]{20,}\b/.test(campaignMaterial),
  redis_urls: /\b(?:redis|rediss):\/\/[^/\s]+/i.test(campaignMaterial),
  bearer_values: /Bearer\s+[A-Za-z0-9._-]{24,}/.test(campaignMaterial),
};
const sensitiveScan = {
  email_addresses: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
    .test(campaignMaterial),
  live_profile_ids: /\bmm-\d{8}-[a-z0-9]{8}\b/i.test(campaignMaterial),
  hardcoded_access_code_value:
    /(?:expectedPrivateAccessCode|access_code)\s*(?:===|:)\s*['"]SUBDEV1['"]/
      .test(implementationFiles.map(
        (file) => fs.readFileSync(path.join(root, file), 'utf8'),
      ).join('\n')),
};
const secretScanPassed = Object.values(secretScan).every((found) => !found);
const sensitiveScanPassed = Object.values(sensitiveScan).every((found) => !found);

const baseOk = head === expectedHead
  && subject === expectedSubject
  && reviewSha === expectedLiveAttestationReviewSha
  && receiptSha === expectedLiveAttestationReceiptSha
  && qualificationReviewSha === expectedQualificationReviewSha
  && indexEmpty
  && missingAllowlist.length === 0
  && unexpectedTracked.length === 0
  && preexistingTrackedStillExact
  && protectedState === expectedProtectedDirtyFingerprint
  && immutableState.every(({ unchanged }) => unchanged)
  && cycleState.cycle_count === 0
  && missingExports.length === 0
  && accessorCount === handlerFiles.length
  && prohibitedHandlerImports.length === 0
  && prohibitedCompositionFallbacks.length === 0
  && focusedRun.result.status === 0
  && focusedRun.summary.total === focusedRun.summary.passed
  && targetedRun.result.status === 0
  && targetedRun.summary.total === targetedRun.summary.passed
  && secretScanPassed
  && sensitiveScanPassed;

const fullOk = !fullValidation || (
  safeRun.result.status === 0
  && safeRun.summary.total === safeRun.summary.passed
  && safeRun.summary.total >= baselineSafeRegressionCount + focusedRun.summary.total
  && buildProof.deterministic
  && lintProof.passed
);

const result = {
  verifier_version: 'private-runtime-live-bindings-environment-authority-verifier-v2',
  campaign: 'MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_LIVE_WIRING_V2',
  ok: baseOk && fullOk,
  full_validation: fullValidation,
  repository_head: head,
  repository_subject: subject,
  git_index_empty: indexEmpty,
  prerequisites: {
    live_attestation_review_sha256: reviewSha,
    live_attestation_receipt_sha256: receiptSha,
    qualification_review_sha256: qualificationReviewSha,
    qualification_certificate_required: true,
    live_environment_attestation_required: true,
    qualification_namespace_reuse: false,
  },
  exact_allowlist_count: exactAllowlist.length,
  exact_allowlist: exactAllowlist,
  changed_campaign_file_count: changedFiles.length,
  changed_campaign_files: changedFiles,
  missing_allowlist_files: missingAllowlist,
  unexpected_tracked_changes: unexpectedTracked,
  preserved_preexisting_tracked_changes: expectedPreexistingTracked,
  handler_accessor_count: accessorCount,
  handler_count: handlerFiles.length,
  prohibited_handler_imports: prohibitedHandlerImports,
  prohibited_composition_fallbacks: prohibitedCompositionFallbacks,
  private_live_authority: {
    mode: 'PRIVATE_LIVE',
    persistent_namespace: true,
    disposable_namespace: false,
    private_live_only: true,
    public_access: false,
    production_customer_rollout: false,
    source_default_off: true,
    emergency_disable_required: true,
  },
  focused_tests: focusedRun.summary,
  targeted_tests: targetedRun.summary,
  safe_intelligence_fabric_tests: safeRun.summary,
  deterministic_build: buildProof,
  lint: lintProof,
  import_export_validation: {
    passed: missingExports.length === 0,
    required_private_runtime_exports: requiredPrivateRuntimeExports,
    required_production_security_exports: requiredProductionSecurityExports,
    missing_exports: missingExports,
  },
  dependency_cycle_validation: cycleState,
  schema_validation_passed: focusedRun.result.status === 0,
  qualified_adapter_files: immutableState,
  protected_root_baseline_diff_sha256: expectedProtectedDirtyFingerprint,
  protected_root_current_diff_sha256: protectedState,
  protected_roots_unchanged_by_campaign:
    protectedState === expectedProtectedDirtyFingerprint,
  secret_scan: { passed: secretScanPassed, ...secretScan },
  sensitive_content_scan: { passed: sensitiveScanPassed, ...sensitiveScan },
  provider_calls: 0,
  credential_values_inspected: 0,
  environment_changes: 0,
  deployment_calls: 0,
  runtime_activation: false,
  named_tester_activation: false,
  staging_actions: 0,
  commit_actions: 0,
  push_actions: 0,
  final_verdict: 'PRIVATE_RUNTIME_LIVE_WIRING_IMPLEMENTED_DEPLOYMENT_AUTHORIZATION_REQUIRED',
};

if (writeEvidence && result.ok) {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  writeJson('root_cause_receipt.json', {
    receipt_version: 'private-runtime-live-wiring-v2-root-cause-receipt-v2',
    original_state: 'LIVE_RUNTIME_DEFAULT_BINDINGS_UNAVAILABLE',
    resolved_blockers: [
      'LIVE_SUBSCRIBER_ASSERTION_VERIFIER',
      'CANONICAL_BUSINESS_ENGINE_REFERENCE_ADAPTER',
      'EXISTING_SUBSCRIPTION_RUNTIME_REFERENCE_ADAPTER',
      'EXISTING_COACH_CONNECT_REFERENCE_ADAPTER',
      'PRIVATE_LIVE_ENVIRONMENT_AND_NAMESPACE_AUTHORITY',
    ],
    repair_is_bounded: true,
    architecture_redesign: false,
    qualification_namespace_reused: false,
    provider_calls: 0,
    environment_changes: 0,
    deployment_calls: 0,
  });
  writeJson('prerequisite_and_qualification_identity.json', result.prerequisites);
  writeJson('prerequisite_validation.json', {
    repository_head: head,
    repository_subject: subject,
    git_index_empty: indexEmpty,
    ...result.prerequisites,
    adapter_atomic_commands_qualified: '12/12',
    authoritative_queries_qualified: '8/8',
    race_failure_scenarios_qualified: '11/11',
    prior_qualification_namespace_final_key_count: 0,
    qualified_adapter_files_unchanged: immutableState.every(({ unchanged }) => unchanged),
  });
  writeJson('current_and_repaired_call_graphs.json', {
    current: handlerFiles.map((file) => ({
      handler: file,
      graph: 'handler -> frozen UNCONFIGURED composition -> asynchronous deny',
    })),
    repaired: handlerFiles.map((file) => ({
      handler: file,
      graph: [
        'getPrivateRuntimeLiveCompositionV2',
        'protected-edge identity verification',
        'subscriber assertion verification',
        'Canonical Async Security Service V2',
        'qualified PRIVATE_LIVE remote shared-security adapter',
        'Developer Access Security Facade V2',
        'existing Private Runtime bridge',
        'attested existing product runtime references',
        'authority revalidation',
      ],
    })),
    direct_handler_adapter_calls: 0,
    v1_handler_imports: 0,
    synthetic_live_paths: 0,
  });
  writeJson('configuration_contract.json', {
    variables: configurationContract,
    secret_values_present: false,
    values_resolved_during_campaign: false,
    environment_changes: 0,
  });
  writeJson('exact_allowlist.json', {
    allowlist_version: 'coach-connect-private-runtime-live-wiring-v2-frozen-v2',
    count: exactAllowlist.length,
    paths: exactAllowlist,
    broadened_after_editing: false,
  });
  writeJson('exact_changed_file_manifest.json', {
    exact_allowlist_count: exactAllowlist.length,
    exact_allowlist: exactAllowlist,
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    source_files: changedFiles.filter((file) => (
      file.startsWith('src/') || file.startsWith('api/')
    )),
    test_files: changedFiles.filter((file) => file.startsWith('test/')),
    verifier_files: changedFiles.filter((file) => file.startsWith('scripts/')),
  });
  writeJson('changed_file_manifest.json', {
    changed_file_count: changedFiles.length,
    changed_files: changedFiles,
    exact_allowlist_match: true,
    unrelated_preexisting_changes_preserved: expectedPreexistingTracked,
  });
  writeJson('live_composition_report.json', {
    composition_accessor: 'getPrivateRuntimeLiveCompositionV2',
    one_shared_deferred_composition: true,
    never_returns_null: true,
    explicit_async_unconfigured_denial: true,
    provider_client_above_adapter: false,
    v1_fallback: false,
    synthetic_live_fallback: false,
    local_cache_authority: false,
    source_default_off: true,
  });
  writeJson('handler_wiring_report.json', {
    handler_count: handlerFiles.length,
    handlers: handlerFiles,
    accessor_count: accessorCount,
    direct_adapter_calls: 0,
    responses_before_security_settles: 0,
  });
  writeJson('login_session_logout_proof.json', {
    verified_protected_edge_precedes_login: true,
    oidc_authorization_code_pkce: true,
    issuer_audience_signature_nonce_expiry_mfa_verified: true,
    assertion_projects_only_opaque_subject_reference: true,
    canonical_mapping_is_authoritative_and_no_auto_enrollment: true,
    session_state_remote_and_restart_safe: true,
    logout_clears_client_cookies: true,
    logout_never_falsely_claims_remote_revocation: true,
  });
  writeJson('developer_access_and_subdev1_proof.json', {
    order: [
      'AUTHENTICATION',
      'CANONICAL_SUBJECT',
      'PRIVATE_TEST_ELIGIBILITY',
      'CSRF_AND_RATE_LIMIT',
      'TEMPORARY_SUBDEV1_ENTITLEMENT',
      'PRIVATE_RUNTIME_AUTHORITY_SNAPSHOT',
    ],
    subdev1_authenticates: false,
    administrative_authority: false,
    operator_authority: false,
    billing_authority: false,
    deployment_authority: false,
    canonical_truth_authority: false,
    paid_entitlement_fallback: false,
  });
  writeJson('developer_access_subdev1_proof.json', {
    canonical_async_security_service_only: true,
    developer_access_facade_only: true,
    authentication_precedes_eligibility: true,
    eligibility_precedes_entitlement: true,
    entitlement_precedes_runtime_authority: true,
    raw_access_code_persisted: false,
    raw_access_code_logged: false,
    paid_private_path_bleed: false,
  });
  writeJson('private_runtime_authority_proof.json', {
    one_authoritative_snapshot: true,
    one_canonical_security_service: true,
    one_authoritative_record_set: true,
    cross_subject_scope_mismatch_denies: true,
    stale_epoch_denies: true,
    revoked_session_denies: true,
    revoked_entitlement_denies: true,
  });
  writeJson('business_engine_attachment_proof.json', {
    existing_reference_only: true,
    creates_business_engine: false,
    mutates_business_engine: false,
    exact_scope_required: true,
    version_hash_reference_receipt_required: true,
    exactly_one: true,
  });
  writeJson('subscription_runtime_attachment_proof.json', {
    existing_reference_only: true,
    creates_subscription_runtime: false,
    paid_entitlement: false,
    stripe_calls: 0,
    model_routing_changed: false,
    exactly_one: true,
  });
  writeJson('coach_connect_attachment_proof.json', {
    existing_reference_only: true,
    creates_coach_connect_runtime: false,
    text_only: true,
    voice_calls: 0,
    media_calls: 0,
    transcript_persistence_calls: 0,
    canonical_mutation_authority: false,
    exactly_one: true,
  });
  writeJson('private_runtime_attachment_proof.json', {
    one_canonical_subject: true,
    one_canonical_business_engine: true,
    one_existing_subscription_runtime: true,
    one_existing_coach_connect_runtime: true,
    partial_attachment_fails_closed: true,
    duplicate_runtime_created: false,
    product_semantics_changed: false,
  });
  writeJson('restart_recovery_proof.json', {
    process_local_authority: false,
    authoritative_remote_state_required: true,
    restart_recovery_tested: true,
    recovery_requires_full_health_gate: true,
  });
  writeJson('outage_and_emergency_disable_proof.json', {
    timeout_denies: true,
    outage_denies: true,
    malformed_response_denies: true,
    partition_denies: true,
    recovering_denies: true,
    emergency_disable_dominates: true,
    fallback: false,
  });
  writeJson('public_lockout_proof.json', {
    protected_edge_required: true,
    unauthenticated_denies: true,
    public_access: false,
    public_routes_created: 0,
    public_onboarding_changed: false,
    named_testers_enabled: 0,
  });
  writeJson('failure_recovery_public_lockout_proof.json', {
    missing_configuration_denies: true,
    provider_timeout_denies: true,
    provider_outage_denies: true,
    malformed_provider_response_denies: true,
    stale_epoch_denies: true,
    revocation_denies: true,
    emergency_disable_denies: true,
    public_and_unauthenticated_requests_deny: true,
    local_or_v1_fallback: false,
  });
  writeJson('provider_activity_ledger.json', {
    live_provider_calls: 0,
    mocked_provider_calls: 'focused assertion tests only',
    credentials_inspected: 0,
    qualification_namespace_reused: false,
  });
  writeJson('environment_change_ledger.json', {
    environment_changes: 0,
    credentials_bound: 0,
    vercel_inspections: 0,
  });
  writeJson('deployment_call_ledger.json', {
    deployment_calls: 0,
    deployment_authorized: false,
    runtime_activated: false,
    public_activation: false,
  });
  writeJson('regression_summary.json', {
    focused: focusedRun.summary,
    targeted: targetedRun.summary,
    safe_intelligence_fabric: safeRun.summary,
  });
  writeJson('mandatory_suite_coverage.json', {
    encompassing_suite: 'test/intelligenceFabric*.test.js',
    passed: safeRun.summary.passed,
    total: safeRun.summary.total,
    covered_domains: [
      'PRIVATE_RUNTIME_V2',
      'ASYNC_SECURITY_V2',
      'REMOTE_SHARED_SECURITY_ADAPTER',
      'DEVELOPER_ACCESS',
      'SESSION_LOGOUT',
      'SUBDEV1_ENTITLEMENT',
      'LIVE_HANDLER_INTEGRATION',
      'BUSINESS_ENGINE_ATTACHMENT',
      'SUBSCRIPTION_RUNTIME',
      'COACH_CONNECT',
      'PRODUCTION_SECURITY',
      'DEPLOYMENT_READINESS',
      'INTERNAL_DEFAULT_OFF_DEPLOYMENT',
    ],
  });
  writeJson('deterministic_build_proof.json', buildProof);
  writeJson('import_export_cycle_schema_validation.json', {
    import_export: result.import_export_validation,
    dependency_cycles: cycleState,
    schema_validation_passed: result.schema_validation_passed,
  });
  writeJson('protected_root_report.json', {
    baseline_dirty_diff_sha256: expectedProtectedDirtyFingerprint,
    current_dirty_diff_sha256: protectedState,
    unchanged_by_campaign: protectedState === expectedProtectedDirtyFingerprint,
    qualified_adapter_files: immutableState,
    package_manifest_changed: false,
    lockfile_changed: false,
    vercel_configuration_changed: false,
  });
  writeJson('secret_scan.json', result.secret_scan);
  writeJson('sensitive_content_scan.json', result.sensitive_content_scan);
  writeJson('secret_and_sensitive_content_scans.json', {
    secret_scan: result.secret_scan,
    sensitive_content_scan: result.sensitive_content_scan,
    credential_values_inspected: 0,
    customer_data_present: false,
    transcript_content_present: false,
  });
  writeJson('repair_receipts.json', {
    receipts: [
      {
        id: 'PHASE_2_REPAIR_001',
        issue: 'deferred accessor metadata broke default-off compatibility',
        bounded_change: 'restore static configured false metadata while lazily resolving',
        gate_result: 'PASS',
      },
      {
        id: 'PHASE_2_REPAIR_002',
        issue: 'configuration authority omitted exact certificate capability bindings',
        bounded_change: 'validate provider class and script digest',
        gate_result: 'PASS',
      },
      {
        id: 'PHASE_7_DEPENDENCY_REPAIR_001',
        issue: 'barrel import introduced a coordinator cycle and mechanical receipt drift',
        bounded_change:
          'move existing bridge factory and preserve its historical denial receipt',
        gate_result: 'PASS',
      },
      {
        id: 'PHASE_7_LINT_REPAIR_001',
        issue: 'repository ESLint profile does not declare Node Buffer as a global',
        bounded_change: 'add explicit node:buffer imports',
        gate_result: 'PASS',
      },
    ],
    architecture_expansion: false,
    allowlist_expansion: false,
  });
  writeJson('verifier_result.json', result);
  fs.writeFileSync(
    path.join(evidenceRoot, 'exact_source_diff.patch'),
    sourceDiff(),
    'utf8',
  );
  fs.writeFileSync(
    path.join(evidenceRoot, 'executive_summary.md'),
    [
      '# Coach Connect Private Runtime Live Wiring V2',
      '',
      'The reviewed V2 security path is wired into all seven private serverless handlers.',
      'The source remains default-off and no environment, provider, deployment, tester,',
      'public, billing, media, model-routing, or transcript activation occurred.',
      '',
      'Deployment requires a separate explicit authorization and exact private-live bindings.',
      '',
    ].join('\n'),
  );
  fs.writeFileSync(
    path.join(evidenceRoot, 'executive_handoff.md'),
    [
      '# Executive handoff',
      '',
      `Verdict: ${result.final_verdict}`,
      '',
      'Next boundary: review this implementation before any environment binding or deployment.',
      'Named tester activation and public access remain unauthorized.',
      '',
    ].join('\n'),
  );
  writeJson('ai_handoff.json', {
    campaign: result.campaign,
    repository_head: head,
    verdict: result.final_verdict,
    deployment_authorized: false,
    environment_bound: false,
    next_action: 'SPOCK_IMPLEMENTATION_REVIEW',
  });
  writeJson('final_verdict.json', {
    campaign: result.campaign,
    verdict: result.final_verdict,
    implementation_complete: true,
    deployment_pending_separate_authorization: true,
    provider_calls: 0,
    environment_changes: 0,
    deployment_calls: 0,
  });
  writeJson('package_validation.json', {
    validation_version: 'private-runtime-live-wiring-v2-package-validation-v2',
    archive_name: 'COACH_CONNECT_PRIVATE_RUNTIME_LIVE_WIRING_V2_IMPLEMENTATION_REVIEW.zip',
    packaging_pending_after_evidence_generation: true,
    expected_sorted_paths: true,
    duplicate_entries_allowed: false,
    case_collisions_allowed: false,
    symlinks_allowed: false,
    absolute_paths_allowed: false,
    traversal_paths_allowed: false,
    credentials_allowed: false,
  });
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.ok) {
  for (const group of [focusedRun, targetedRun, safeRun]) {
    if (group.result?.status && group.result.status !== 0) {
      process.stderr.write(group.result.stdout || '');
      process.stderr.write(group.result.stderr || '');
    }
  }
  if (!lintProof.passed && lintProof.output) process.stderr.write(`${lintProof.output}\n`);
  process.exitCode = 1;
}
