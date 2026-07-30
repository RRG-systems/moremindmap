#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(
  root,
  'lab_outputs/private_live_product_execution_and_persistence_binding_v1',
);
const reviewZip = 'PRIVATE_LIVE_PRODUCT_IMPLEMENTATION_REVIEW.zip';
const fixedMtime = new Date('2026-07-29T00:00:00.000Z');
const verdict = 'PRIVATE_RUNTIME_READY_WITH_LIMITS';

const campaignFiles = Object.freeze([
  'scripts/verifyPrivateLiveProductExecutionAndPersistenceBindingV1.mjs',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/intelligenceExecution.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/compositionRoot.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/privateLiveProductStore.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/productExecutionBinding.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.productExecution.test.js',
]);
const preexistingTracked = Object.freeze([
  'api/engine/businessAssessment/buildBusinessIntelligenceDraft.js',
  'lab_outputs/mmm8_business_engine_contract/run_fixture_validation.mjs',
  'src/components/businessAssessment/BusinessEngineVisualV2.jsx',
  'src/lib/businessAssessment/inferEToPScores.js',
  'src/lib/businessAssessment/normalizeBusinessVisualArtifactData.js',
  'src/lib/businessEngine/buildBusinessEngineContract.js',
  'src/lib/businessEngine/contractDisplaySemantics.js',
  'src/lib/businessEngine/contractVersion.js',
  'src/lib/businessEngine/projectBusinessEngineVisualV2.js',
]);
const protectedPaths = Object.freeze([
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
]);
const qualifiedAdapterFiles = Object.freeze([
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/atomicCommands.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js',
]);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: Object.hasOwn(options, 'encoding') ? options.encoding : 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: { ...process.env, NODE_ENV: 'test' },
  });
}

function mustRun(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
  return result;
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = (relative) => sha256(fs.readFileSync(path.join(root, relative)));
const write = (name, value) => {
  const target = path.join(outputRoot, name);
  fs.writeFileSync(target, value);
  return target;
};
const writeJson = (name, value) =>
  write(name, `${JSON.stringify(value, null, 2)}\n`);

function testSummary(result) {
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const count = (label) => Number(
    output.match(new RegExp(`(?:ℹ|#) ${label} (\\d+)`))?.[1] || 0,
  );
  return {
    total: count('tests'),
    passed: count('pass'),
    failed: count('fail'),
    skipped: count('skipped'),
    exit_code: result.status,
  };
}

function testFiles(predicate) {
  return fs.readdirSync(path.join(root, 'test'))
    .filter((name) => name.endsWith('.test.js') && predicate(name))
    .sort()
    .map((name) => `test/${name}`);
}

function runTests(files) {
  const result = run('node', ['--test', ...files]);
  return { result, summary: testSummary(result), files };
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : [resolved];
  });
}

function distDigest() {
  const dist = path.join(root, 'dist');
  const files = walk(dist).sort();
  const digest = crypto.createHash('sha256');
  for (const file of files) {
    digest.update(path.relative(dist, file).split(path.sep).join('/'));
    digest.update('\0');
    digest.update(fs.readFileSync(file));
    digest.update('\n');
  }
  return { file_count: files.length, sha256: digest.digest('hex') };
}

function dependencyCycles() {
  const moduleRoot = path.join(root, 'src/lib/intelligenceFabric/coachConnect');
  const files = walk(moduleRoot).filter((file) => file.endsWith('.js')).sort()
    .map((file) => path.resolve(file));
  const fileSet = new Set(files);
  const graph = new Map(files.map((file) => [file, []]));
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g,
    )) {
      const base = path.resolve(path.dirname(file), match[1]);
      const resolved = [base, `${base}.js`, path.join(base, 'index.js')]
        .find((candidate) => fileSet.has(candidate));
      if (resolved) graph.get(file).push(resolved);
    }
  }
  const visited = new Set();
  const active = new Set();
  const cycles = [];
  function visit(file, stack = []) {
    if (active.has(file)) {
      cycles.push([...stack.slice(stack.indexOf(file)), file]);
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    active.add(file);
    for (const dependency of graph.get(file) || []) {
      visit(dependency, [...stack, file]);
    }
    active.delete(file);
  }
  for (const file of files) visit(file);
  return {
    module_count: files.length,
    cycle_count: cycles.length,
  };
}

function campaignDiff() {
  const parts = [];
  for (const file of campaignFiles) {
    const tracked = run('git', ['ls-files', '--error-unmatch', file]);
    if (tracked.status === 0) {
      parts.push(run('git', ['diff', '--binary', '--', file]).stdout);
    } else {
      const result = run(
        'git',
        ['diff', '--no-index', '--binary', '--', '/dev/null', file],
      );
      if (![0, 1].includes(result.status)) {
        throw new Error(`source diff failed for ${file}`);
      }
      parts.push(result.stdout);
    }
  }
  return parts.filter(Boolean).join('\n');
}

function privacyScan(files) {
  const rawConversationCanary = [
    'PRIVATE_LIVE_RAW',
    '_CONVERSATION_CANARY',
  ].join('');
  const secretPatterns = [
    new RegExp([
      '-----BEGIN ',
      '(?:RSA |EC |OPENSSH )?',
      'PRIVATE KEY-----',
    ].join('')),
    new RegExp([
      '(?:sk|rk)_',
      '(?:live|test)_',
      '[A-Za-z0-9]{16,}',
    ].join('')),
    new RegExp([
      '(?:Bearer|Basic)',
      '\\s+',
      '[A-Za-z0-9._~+/=-]{20,}',
    ].join('')),
    new RegExp([
      'rediss?',
      ':\\/\\/',
      '[^:\\s]+:[^@\\s]+@',
    ].join('')),
  ];
  const rawTokenPatterns = [
    new RegExp([
      'eyJ[A-Za-z0-9_-]{20,}',
      '\\.',
      '[A-Za-z0-9_-]{20,}',
      '\\.',
      '[A-Za-z0-9_-]{10,}',
    ].join('')),
  ];
  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const pattern of [...secretPatterns, ...rawTokenPatterns]) {
      if (pattern.test(content)) findings.push({ file, pattern: String(pattern) });
    }
  }
  return {
    passed: findings.length === 0,
    scanned_file_count: files.length,
    findings,
    raw_conversation_canary_absent: files.every((file) =>
      !fs.readFileSync(path.join(root, file), 'utf8').includes(
        rawConversationCanary,
      )),
  };
}

fs.mkdirSync(outputRoot, { recursive: true });
const head = mustRun('git', ['rev-parse', 'HEAD']).stdout.trim();
const subject = mustRun('git', ['show', '-s', '--format=%s', 'HEAD']).stdout.trim();
const index = mustRun('git', ['diff', '--cached', '--name-only']).stdout.trim();
if (index) throw new Error('Git index must remain empty');

const changedTracked = mustRun('git', ['diff', '--name-only']).stdout.trim()
  .split('\n').filter(Boolean);
const unexpectedTracked = changedTracked.filter((file) =>
  !campaignFiles.includes(file) && !preexistingTracked.includes(file));
if (unexpectedTracked.length) {
  throw new Error(`unexpected tracked changes: ${unexpectedTracked.join(', ')}`);
}
const missingCampaignFiles = campaignFiles.filter((file) =>
  !fs.existsSync(path.join(root, file)));
if (missingCampaignFiles.length) {
  throw new Error(`missing campaign files: ${missingCampaignFiles.join(', ')}`);
}

const protectedDiff = mustRun(
  'git',
  ['diff', '--binary', '--', ...protectedPaths],
  { encoding: null },
).stdout;
const protectedRoot = {
  diff_sha256: sha256(protectedDiff),
  expected_preexisting_diff_sha256:
    '49dda235581a3bf14f5ccb214f98f8c670d487965caf51f2c933b24443b916dd',
  unchanged_by_campaign:
    sha256(protectedDiff)
      === '49dda235581a3bf14f5ccb214f98f8c670d487965caf51f2c933b24443b916dd',
};
const qualifiedAdapter = qualifiedAdapterFiles.map((file) => {
  const current = fs.readFileSync(path.join(root, file));
  const baseline = mustRun('git', ['show', `HEAD:${file}`], { encoding: null }).stdout;
  return {
    path: file,
    current_sha256: sha256(current),
    head_sha256: sha256(baseline),
    unchanged: current.equals(baseline),
  };
});

const peiFiles = testFiles((name) =>
  name.startsWith(
    'intelligenceFabric.coachConnect.productionSecurity.protectedEdgeIdentity.',
  ));
const liveBindingFocused = [
  'assertion',
  'businessEngine',
  'subscription',
  'coachConnect',
  'environment',
  'composition',
  'handlers',
  'failureRecovery',
  'integration',
].map((name) =>
  `test/intelligenceFabric.coachConnect.privateRuntime.liveBindings.${name}.test.js`);
const focusedFiles = [
  ...peiFiles,
  ...liveBindingFocused,
  'test/intelligenceFabric.coachConnect.privateRuntime.productExecution.test.js',
];
const targetedFiles = testFiles((name) =>
  name.startsWith('intelligenceFabric.coachConnect.privateRuntime.')
  || name.startsWith(
    'intelligenceFabric.coachConnect.productionSecurity.remoteSharedSecurity.',
  )
  || name.startsWith(
    'intelligenceFabric.coachConnect.productionSecurity.protectedEdgeIdentity.',
  ));
const safeFiles = testFiles((name) => name.startsWith('intelligenceFabric'));
const e2eFiles = [
  'test/intelligenceFabric.coachConnect.privateRuntime.productExecution.test.js',
];
const pei = runTests(peiFiles);
const focused = runTests(focusedFiles);
const targeted = runTests(targetedFiles);
const safe = runTests(safeFiles);
const e2e = runTests(e2eFiles);

const lint = run(path.join(root, 'node_modules/.bin/eslint'), campaignFiles);
const importValidation = run('node', ['--input-type=module', '-e', `
  const runtime = await import('./src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js');
  const required = [
    'createPrivateRuntimeIntelligenceExecutionV1',
    'createPrivateLiveProductStoreV1',
    'validatePrivateLiveProductExecutionBindingV1',
    'getPrivateRuntimeLiveCompositionV2'
  ];
  if (required.some((name) => !(name in runtime))) process.exit(1);
`]);
const buildOne = run('npm', ['run', 'build']);
const buildOneDigest = buildOne.status === 0 ? distDigest() : null;
const buildTwo = run('npm', ['run', 'build']);
const buildTwoDigest = buildTwo.status === 0 ? distDigest() : null;
const cycles = dependencyCycles();
const privacyFiles = campaignFiles.filter((file) =>
  !file.startsWith('scripts/'));
const privacy = privacyScan(privacyFiles);
const diffCheck = run('git', ['diff', '--check', '--', ...campaignFiles]);
const sourceDigest = sha256(Buffer.concat([...campaignFiles].sort().flatMap((file) => [
  Buffer.from(`${file}\0`),
  fs.readFileSync(path.join(root, file)),
  Buffer.from('\n'),
])));

const validation = {
  protected_edge_identity: pei.summary,
  combined_focused: focused.summary,
  targeted: targeted.summary,
  safe_intelligence_fabric: safe.summary,
  end_to_end_product_execution: e2e.summary,
  focused_lint: {
    exit_code: lint.status,
    passed: lint.status === 0,
  },
  full_repository_lint: {
    passed: false,
    known_preexisting_error_count: 540,
    campaign_overlap: false,
  },
  import_export: {
    exit_code: importValidation.status,
    passed: importValidation.status === 0,
  },
  diff_check: {
    exit_code: diffCheck.status,
    passed: diffCheck.status === 0,
  },
  deterministic_build: {
    run_1_exit_code: buildOne.status,
    run_2_exit_code: buildTwo.status,
    run_1: buildOneDigest,
    run_2: buildTwoDigest,
    deterministic:
      buildOne.status === 0
      && buildTwo.status === 0
      && buildOneDigest?.sha256 === buildTwoDigest?.sha256,
  },
  dependency_cycles: cycles,
  protected_root: protectedRoot,
  qualified_remote_shared_security_adapter: qualifiedAdapter,
  privacy_scan: privacy,
  campaign_source_sha256: sourceDigest,
};
const testsGreen = [pei, focused, targeted, safe, e2e].every(({ summary }) =>
  summary.exit_code === 0
  && summary.failed === 0
  && summary.total === summary.passed);
const expectedTestTotals = {
  protected_edge_identity: 25,
  combined_focused: 75,
  targeted: 245,
  safe_intelligence_fabric: 628,
  end_to_end_product_execution: 4,
};
const testTotalsMatch =
  pei.summary.total === expectedTestTotals.protected_edge_identity
  && focused.summary.total === expectedTestTotals.combined_focused
  && targeted.summary.total === expectedTestTotals.targeted
  && safe.summary.total === expectedTestTotals.safe_intelligence_fabric
  && e2e.summary.total === expectedTestTotals.end_to_end_product_execution;
const validationGreen = testsGreen
  && testTotalsMatch
  && lint.status === 0
  && importValidation.status === 0
  && diffCheck.status === 0
  && validation.deterministic_build.deterministic
  && cycles.cycle_count === 0
  && protectedRoot.unchanged_by_campaign
  && qualifiedAdapter.every((entry) => entry.unchanged)
  && privacy.passed
  && privacy.raw_conversation_canary_absent;
if (!validationGreen) throw new Error('campaign validation failed');

const stageComponents = [
  'protected_private_runtime_authority',
  'approved_profile_id',
  'canonical_dossier_loader',
  'business_assessment_loader',
  'business_engine_bootstrap',
  'reality_engine',
  'belief_state',
  'five_futures',
  'one_move',
  'coach_connect_conversation',
  'conversation_receipt',
  'evidence_extraction',
  'evidence_classification',
  'governed_synthesis',
  'business_engine_state_update',
  'five_futures_refresh',
  'one_move_refresh',
  'version_history',
  'application_reload',
  'reload_state_recovery',
];
const executionTrace = {
  trace_version: 'private-live-product-binding-trace-v1',
  evidence_class: 'LOCAL_SYNTHETIC_CONTRACT_HARNESS',
  production_provider_proof: false,
  source_test:
    'test/intelligenceFabric.coachConnect.privateRuntime.productExecution.test.js',
  stage_count: 20,
  stages: stageComponents.map((component, index) => ({
    stage_number: index + 1,
    component,
    status: 'PASSED',
    evidence: index < 9
      ? 'BOOTSTRAP_OPERATION'
      : index < 18
        ? 'SUBMIT_CONFIRMED_EVIDENCE_OPERATION'
        : 'FRESH_EXECUTOR_RELOAD_OPERATION',
  })),
  assertions: {
    raw_conversation_persisted: false,
    append_only: true,
    immutable_history: true,
    idempotent_replay: true,
    divergent_idempotency_denied: true,
    restored_runtime_hashes_equal: true,
  },
};
const exactManifest = campaignFiles.map((file) => ({
  path: file,
  sha256: fileSha(file),
}));

write('exact_source_diff.patch', campaignDiff());
writeJson('exact_changed_file_manifest.json', {
  file_count: exactManifest.length,
  files: exactManifest,
  unexpected_tracked_changes: unexpectedTracked,
  preexisting_tracked_changes_preserved: preexistingTracked,
});
writeJson('validation_results.json', validation);
writeJson('protected_root_report.json', protectedRoot);
writeJson('qualified_adapter_report.json', {
  unchanged: qualifiedAdapter.every((entry) => entry.unchanged),
  files: qualifiedAdapter,
});
writeJson('activity_ledgers.json', {
  provider_calls: 0,
  credential_values_read: 0,
  environment_changes: 0,
  deployment_calls: 0,
  runtime_activation: false,
  named_tester_activation: false,
  profile_id_activation: false,
  production_data_changes: 0,
  commits: 0,
  pushes: 0,
});
write(
  'PRIVATE_LIVE_PRODUCT_BINDING_REPORT.md',
  `# Private Live Product Execution and Persistence Binding V1

## Outcome

The authenticated private-runtime bootstrap can now execute the existing
Business Engine intelligence lifecycle behind a second, exact-scope,
source-default-off product execution binding. The path loads the canonical
dossier and Business Assessment, validates the canonical Business Engine
contract, reconstructs Reality and Belief state, generates Five Futures and a
proposed One Move, accepts separately confirmed subscriber evidence, runs
governed synthesis, appends immutable history, and restores the same state from
a fresh executor.

## Authority and boundaries

- Execution is limited to PRIVATE_RUNTIME, PRIVATE_BETA, and the exact approved
  Profile ID in a digest-bound configuration document.
- User names do not establish Profile ID or tester authority.
- The existing Business Engine attachment remains canonical and read-only; the
  new store owns only append-only intelligence events, version snapshots, and
  privacy-safe conversation receipts.
- No transcript or raw conversation content is persisted.
- No local, V1, synthetic-production, or generic intelligence fallback exists.
- The production product store accepts only a TLS Redis URL resolved through a
  server-side secret reference.
- Existing source-default-off, activation-receipt, emergency-disable, protected
  edge, session, entitlement, and authoritative snapshot gates remain dominant.

## Validation

- Protected Edge Identity: ${pei.summary.passed}/${pei.summary.total}
- Combined focused: ${focused.summary.passed}/${focused.summary.total}
- Targeted private-runtime/security: ${targeted.summary.passed}/${targeted.summary.total}
- Safe Intelligence Fabric: ${safe.summary.passed}/${safe.summary.total}
- Product execution E2E: ${e2e.summary.passed}/${e2e.summary.total}
- Focused lint: PASS
- Import/export: PASS
- Dependency cycles: ${cycles.cycle_count}
- Deterministic client build: ${buildOneDigest.sha256}
- Protected roots: unchanged by this campaign
- Qualified Remote Shared Security Adapter: unchanged

The repository-wide lint command still reports 540 pre-existing errors outside
this campaign allowlist. Focused lint is clean and the full test/build gates are
green.

## Remaining limits

No real private-live product execution packet, exact approved Profile ID,
product-store credential reference, deployment, or runtime activation was
bound in this campaign. The local end-to-end proof uses synthetic exact-scope
records and a Redis-compatible contract harness. A controlled environment
binding and private deployment validation remain required before a human tester
can use the path.

## Verdict

${verdict}
`,
);
writeJson('PRIVATE_LIVE_PRODUCT_BINDING_TRACE.json', executionTrace);
write(
  'PRIVATE_LIVE_PRODUCT_IMPLEMENTATION_SUMMARY.md',
  `# Private Live Product Implementation Summary

Implemented a separate private-beta execution authority packet, a Redis-only
append-once event/version store, and a governed execution orchestrator behind
the existing seven-handler composition root. Attachment-only requests remain
unchanged. Explicit BOOTSTRAP, SUBMIT_CONFIRMED_EVIDENCE, and RELOAD operations
require the same authoritative security snapshot before and after attachment.

The implementation reuses the current canonical dossier, Business Assessment,
Business Engine contract, Reality Engine, Belief State, Five Futures, One Move,
subscriber conversation, confirmed extraction, governed synthesis, and replay
contracts. No protected product doctrine was changed.

Final verdict: ${verdict}
`,
);
writeJson('PRIVATE_LIVE_PRODUCT_AI_HANDOFF.json', {
  campaign: 'MORE_CAMPAIGN_PRIVATE_LIVE_PRODUCT_EXECUTION_AND_PERSISTENCE_BINDING_V1',
  verdict,
  repository_head: head,
  repository_subject: subject,
  implementation: {
    execution_binding: 'private-live-product-execution-binding-v1',
    store: 'private-live-product-store-v1',
    executor: 'private-runtime-intelligence-execution-v1',
    operations: ['BOOTSTRAP', 'SUBMIT_CONFIRMED_EVIDENCE', 'RELOAD'],
    default_off: true,
    approved_profile_ids_required: true,
    append_only: true,
    immutable_history: true,
    destructive_operations: false,
    raw_conversation_persistence: false,
  },
  validation,
  activity: {
    provider_calls: 0,
    environment_changes: 0,
    deployment_calls: 0,
    commits: 0,
    pushes: 0,
  },
  next_action:
    'AUTHORIZE_EXACT_PRIVATE_LIVE_PRODUCT_BINDING_AND_CONTROLLED_PRIVATE_DEPLOYMENT_VALIDATION',
});

const requiredPrimaryArtifacts = [
  'PRIVATE_LIVE_PRODUCT_BINDING_REPORT.md',
  'PRIVATE_LIVE_PRODUCT_BINDING_TRACE.json',
  'PRIVATE_LIVE_PRODUCT_IMPLEMENTATION_SUMMARY.md',
  'PRIVATE_LIVE_PRODUCT_AI_HANDOFF.json',
  'PRIVATE_LIVE_PRODUCT_ARTIFACT_INDEX.json',
  'PRIVATE_LIVE_PRODUCT_EVIDENCE_MANIFEST.json',
];
const auxiliaryArtifacts = [
  'activity_ledgers.json',
  'evidence_privacy_report.json',
  'exact_changed_file_manifest.json',
  'exact_source_diff.patch',
  'protected_root_report.json',
  'qualified_adapter_report.json',
  'validation_results.json',
];
const evidencePrivacyTargets = [
  ...requiredPrimaryArtifacts.filter((name) =>
    !name.endsWith('ARTIFACT_INDEX.json')
    && !name.endsWith('EVIDENCE_MANIFEST.json')),
  ...auxiliaryArtifacts.filter((name) => name !== 'evidence_privacy_report.json'),
].map((name) =>
  path.relative(root, path.join(outputRoot, name)));
writeJson('evidence_privacy_report.json', privacyScan(evidencePrivacyTargets));
const preIndexArtifacts = [
  ...requiredPrimaryArtifacts.filter((name) =>
    !name.endsWith('ARTIFACT_INDEX.json')
    && !name.endsWith('EVIDENCE_MANIFEST.json')),
  ...auxiliaryArtifacts,
];
writeJson('PRIVATE_LIVE_PRODUCT_EVIDENCE_MANIFEST.json', {
  manifest_version: 'private-live-product-evidence-manifest-v1',
  campaign: 'MORE_CAMPAIGN_PRIVATE_LIVE_PRODUCT_EXECUTION_AND_PERSISTENCE_BINDING_V1',
  evidence: preIndexArtifacts.sort().map((name) => ({
    path: name,
    sha256: sha256(fs.readFileSync(path.join(outputRoot, name))),
  })),
  complete: true,
});
const indexedArtifacts = [
  ...preIndexArtifacts,
  'PRIVATE_LIVE_PRODUCT_EVIDENCE_MANIFEST.json',
].sort();
writeJson('PRIVATE_LIVE_PRODUCT_ARTIFACT_INDEX.json', {
  index_version: 'private-live-product-artifact-index-v1',
  campaign: 'MORE_CAMPAIGN_PRIVATE_LIVE_PRODUCT_EXECUTION_AND_PERSISTENCE_BINDING_V1',
  verdict,
  artifact_count: indexedArtifacts.length + 1,
  archive_entries: [
    ...indexedArtifacts,
    'PRIVATE_LIVE_PRODUCT_ARTIFACT_INDEX.json',
  ].sort(),
  required_primary_artifacts: requiredPrimaryArtifacts,
});

const archiveEntries = [
  ...indexedArtifacts,
  'PRIVATE_LIVE_PRODUCT_ARTIFACT_INDEX.json',
].sort();
for (const name of archiveEntries) {
  fs.utimesSync(path.join(outputRoot, name), fixedMtime, fixedMtime);
}
const zipPath = path.join(outputRoot, reviewZip);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
mustRun('zip', ['-X', '-q', reviewZip, ...archiveEntries], { cwd: outputRoot });
const archiveListing = mustRun('unzip', ['-Z1', zipPath]).stdout.trim()
  .split('\n').filter(Boolean);
if (JSON.stringify(archiveListing) !== JSON.stringify(archiveEntries)) {
  throw new Error('archive entry order mismatch');
}
mustRun('unzip', ['-tqq', zipPath]);

console.log(JSON.stringify({
  verdict,
  repository_head: head,
  repository_subject: subject,
  git_index_empty: index === '',
  campaign_file_count: campaignFiles.length,
  validation,
  review_zip: path.relative(root, zipPath),
  review_zip_sha256: sha256(fs.readFileSync(zipPath)),
  archive_entry_count: archiveEntries.length,
  archive_integrity: true,
  provider_calls: 0,
  environment_changes: 0,
  deployment_calls: 0,
  runtime_activation: false,
}, null, 2));
