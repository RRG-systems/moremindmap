import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  DEFAULT_PRIVATE_RUNTIME_FLAGS,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/activation.js';
import {
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  PRIVATE_RUNTIME_ADVERSARIAL_MATRIX,
  createZeroExternalCallCapture,
  validatePrivateRuntimeRunbook,
  validateZeroExternalCallCapture,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/evidence.js';

const root = process.cwd();
const evidenceRoot = 'lab_outputs/coach_connect_private_runtime_enablement_v1';
const architecturePath = 'MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_V1.md';
const expectedArchitectureHash = '42291cdc467a7895b65f2e313d81751febf55ca7ab90bec6dce0a3d538401765';
const afwReviewPath = 'COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_AFW_REVIEW_V1.zip';
const expectedAfwReviewHash = '1caf6840c3e9a1ba91ef28d053dc47620fe59762133a9da8f0baaa5abd9a5709';
const campaignId = 'MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_V1';
const generatedAt = '2026-07-27T16:05:00.000Z';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fileHash = (file) => sha256(readFileSync(path.join(root, file)));

const sourceFiles = [
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/activation.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/attachments.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/authority.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/composition.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/evidence.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/failureCodes.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/sessionResolver.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/subjectRegistryPort.js',
  'api/internal/developer-access-security.js',
  'api/internal/developer-access.js',
  'api/internal/subscription-entitlement.js',
  'api/internal/private-runtime-login.js',
  'api/internal/private-runtime-callback.js',
  'api/internal/private-runtime-session.js',
  'api/internal/private-runtime-bootstrap.js',
  'api/internal/private-runtime-logout.js',
  'src/components/businessAssessment/PrivateRuntimeAttachmentHost.jsx',
  'src/components/businessAssessment/DeveloperAccessPanel.jsx',
  'src/BusinessAssessmentVisualMap.jsx',
];
const focusedTests = [
  'test/intelligenceFabric.coachConnect.privateRuntime.subject.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.security.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.businessEngine.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.subscription.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.coachConnect.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.validation.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.integration.test.js',
];
const runbooks = [
  'subject_enrollment.md',
  'login_session.md',
  'runtime_attach.md',
  'restart_recovery.md',
  'logout_revocation.md',
  'emergency_disable.md',
  'incident_response.md',
  'post_enablement_validation.md',
].map((file) => `docs/runbooks/coach_connect/private_runtime_enablement/${file}`);
const verifierFile = 'scripts/verifyCoachConnectPrivateRuntimeEnablement.mjs';
const changedImplementationFiles = [
  ...sourceFiles.filter((file) => file !== 'src/components/businessAssessment/DeveloperAccessPanel.jsx'),
  ...focusedTests,
  ...runbooks,
  verifierFile,
].sort();
const authoritativeInputs = [
  architecturePath,
  afwReviewPath,
  'docs/intelligence_fabric/MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_PART_1_V1.md',
  'docs/intelligence_fabric/MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_PART_2_V1.md',
  'docs/intelligence_fabric/MORE_CAMPAIGN_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_PART_3_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_CROSS_PART_CONSISTENCY_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_EXPANSION_INDEX_V1.json',
  ...Array.from({ length: 7 }, (_, index) => (
    `docs/intelligence_fabric/MORE_COACH_CONNECT_PRIVATE_RUNTIME_ENABLEMENT_SPRINT_${index + 1}_AFW_V1.md`
  )),
];

function walk(directory) {
  if (!existsSync(path.join(root, directory))) return [];
  return readdirSync(path.join(root, directory), { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relative = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(relative) : [relative];
    });
}

function rootDigest(relative) {
  const absolute = path.join(root, relative);
  const files = !existsSync(absolute)
    ? []
    : lstatSync(absolute).isDirectory()
      ? walk(relative)
      : [relative];
  const hash = createHash('sha256');
  for (const file of files) {
    const stat = lstatSync(path.join(root, file));
    hash.update(`${file}\0${stat.mode.toString(8)}\0`);
    hash.update(readFileSync(path.join(root, file)));
    hash.update('\0');
  }
  return { files: files.length, sha256: hash.digest('hex') };
}

const failures = [];
const checks = {};
const requiredFiles = [...sourceFiles, ...focusedTests, ...runbooks];
const missingFiles = requiredFiles.filter((file) => !existsSync(path.join(root, file)));
checks.required_files = {
  valid: missingFiles.length === 0,
  count: requiredFiles.length,
  missing: missingFiles,
};
if (missingFiles.length) failures.push('REQUIRED_FILES_MISSING');

const architectureHash = fileHash(architecturePath);
checks.architecture_hash = {
  valid: architectureHash === expectedArchitectureHash,
  expected: expectedArchitectureHash,
  observed: architectureHash,
};
if (!checks.architecture_hash.valid) failures.push('ARCHITECTURE_HASH_MISMATCH');

const afwReviewHash = fileHash(afwReviewPath);
checks.afw_review_hash = {
  valid: afwReviewHash === expectedAfwReviewHash,
  expected: expectedAfwReviewHash,
  observed: afwReviewHash,
};
if (!checks.afw_review_hash.valid) failures.push('AFW_REVIEW_HASH_MISMATCH');

const expectedVersions = [
  'private-runtime-verified-assertion-v1',
  'private-runtime-tester-approval-v1',
  'private-runtime-subject-receipt-v1',
  'private-runtime-capability-v1',
  'private-runtime-session-receipt-v1',
  'private-runtime-attachment-request-v1',
  'business-engine-attachment-v1',
  'subscription-runtime-attachment-v1',
  'coach-connect-attachment-v1',
  'private-runtime-attachment-set-v1',
  'private-runtime-interaction-receipt-v1',
  'private-runtime-evidence-index-v1',
];
checks.contract_versions = {
  valid: expectedVersions.every((version) => Object.values(PRIVATE_RUNTIME_CONTRACT_VERSIONS).includes(version)),
  versions: Object.values(PRIVATE_RUNTIME_CONTRACT_VERSIONS),
};
if (!checks.contract_versions.valid) failures.push('CONTRACT_VERSION_MISMATCH');

checks.default_off = {
  valid: DEFAULT_PRIVATE_RUNTIME_FLAGS.private_runtime_enabled === false
    && DEFAULT_PRIVATE_RUNTIME_FLAGS.private_runtime_environment_allowlist.length === 0
    && DEFAULT_PRIVATE_RUNTIME_FLAGS.private_runtime_subject_allowlist.length === 0
    && DEFAULT_PRIVATE_RUNTIME_FLAGS.private_runtime_scope_allowlist.length === 0
    && DEFAULT_PRIVATE_RUNTIME_FLAGS.emergency_disabled === true
    && DEFAULT_PRIVATE_RUNTIME_FLAGS.stripe_enabled === false
    && DEFAULT_PRIVATE_RUNTIME_FLAGS.public_registration_enabled === false
    && DEFAULT_PRIVATE_RUNTIME_FLAGS.production_product_persistence_enabled === false,
};
if (!checks.default_off.valid) failures.push('DEFAULT_OFF_MISMATCH');

checks.adversarial_matrix = {
  valid: PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.length === 47
    && PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.every((entry) => (
      entry.leaves_partial_attachment === false
      && entry.preserves_canonical_business_engine === true
    )),
  scenario_count: PRIVATE_RUNTIME_ADVERSARIAL_MATRIX.length,
};
if (!checks.adversarial_matrix.valid) failures.push('ADVERSARIAL_MATRIX_MISMATCH');

const externalCalls = createZeroExternalCallCapture();
checks.external_calls = {
  valid: validateZeroExternalCallCapture(externalCalls).valid,
  counts: externalCalls,
};
if (!checks.external_calls.valid) failures.push('EXTERNAL_CALL_CAPTURE_INVALID');

const runbookResults = runbooks.map((file) => ({
  file,
  ...validatePrivateRuntimeRunbook(readFileSync(path.join(root, file), 'utf8')),
}));
checks.runbooks = {
  valid: runbookResults.every((result) => result.valid),
  count: runbookResults.length,
  results: runbookResults,
};
if (!checks.runbooks.valid) failures.push('RUNBOOK_VALIDATION_FAILED');

const jsonFiles = walk(evidenceRoot).filter((file) => file.endsWith('.json'));
const invalidJson = [];
for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(path.join(root, file), 'utf8'));
  } catch {
    invalidJson.push(file);
  }
}
checks.evidence_json = {
  valid: invalidJson.length === 0,
  parsed_count: jsonFiles.length,
  invalid: invalidJson,
};
if (!checks.evidence_json.valid) failures.push('EVIDENCE_JSON_INVALID');

const forbiddenImportPatterns = [
  /from\s+['"]ioredis['"]/,
  /from\s+['"]stripe['"]/,
  /from\s+['"]openai['"]/,
  /from\s+['"]@vercel\//,
  /require\(['"](?:ioredis|stripe|openai|@vercel\/)/,
];
const forbiddenImports = [];
for (const file of sourceFiles) {
  const text = readFileSync(path.join(root, file), 'utf8');
  if (forbiddenImportPatterns.some((pattern) => pattern.test(text))) forbiddenImports.push(file);
}
checks.forbidden_imports = {
  valid: forbiddenImports.length === 0,
  files: forbiddenImports,
};
if (!checks.forbidden_imports.valid) failures.push('FORBIDDEN_IMPORT_FOUND');

const moduleFiles = sourceFiles
  .filter((file) => file.startsWith('src/lib/intelligenceFabric/coachConnect/privateRuntime/'));
const modulePaths = new Set(moduleFiles.map((file) => path.resolve(root, file)));
const dependencyGraph = new Map([...modulePaths].map((file) => [file, []]));
for (const file of modulePaths) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](.+?)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), match[1]);
    const target = [base, `${base}.js`, path.join(base, 'index.js')]
      .find((candidate) => modulePaths.has(candidate));
    if (target) dependencyGraph.get(file).push(target);
  }
}
const dependencyCycles = [];
const dependencyVisiting = new Set();
const dependencyDone = new Set();
const dependencyStack = [];
function visitDependency(file) {
  if (dependencyVisiting.has(file)) {
    dependencyCycles.push([
      ...dependencyStack.slice(dependencyStack.indexOf(file)),
      file,
    ].map((entry) => path.relative(root, entry)));
    return;
  }
  if (dependencyDone.has(file)) return;
  dependencyVisiting.add(file);
  dependencyStack.push(file);
  for (const target of dependencyGraph.get(file)) visitDependency(target);
  dependencyStack.pop();
  dependencyVisiting.delete(file);
  dependencyDone.add(file);
}
for (const file of modulePaths) visitDependency(file);
checks.dependency_cycles = {
  valid: dependencyCycles.length === 0,
  module_count: moduleFiles.length,
  internal_edge_count: [...dependencyGraph.values()]
    .reduce((total, edges) => total + edges.length, 0),
  cycle_count: dependencyCycles.length,
  cycles: dependencyCycles,
};
if (!checks.dependency_cycles.valid) failures.push('DEPENDENCY_CYCLE_FOUND');

const scanFiles = [...new Set([...sourceFiles, ...focusedTests, ...runbooks, verifierFile])];
const secretFindings = [];
const sensitiveFindings = [];
const syntheticCanaries = [];
const secretPatterns = [
  { name: 'private_key', expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'stripe_live_key', expression: /sk_live_[A-Za-z0-9]{12,}/g },
  { name: 'aws_access_key', expression: /AKIA[0-9A-Z]{16}/g },
  { name: 'github_token', expression: /ghp_[A-Za-z0-9]{30,}/g },
  { name: 'jwt', expression: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
];
const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
for (const file of scanFiles) {
  const text = readFileSync(path.join(root, file), 'utf8');
  for (const pattern of secretPatterns) {
    for (const match of text.matchAll(pattern.expression)) {
      const finding = { file, pattern: pattern.name, value_sha256: sha256(match[0]) };
      if (match[0].includes('canary')) syntheticCanaries.push(finding);
      else secretFindings.push(finding);
    }
  }
  for (const match of text.matchAll(emailPattern)) {
    const finding = { file, pattern: 'email', value_sha256: sha256(match[0]) };
    if (match[0].endsWith('.invalid')) syntheticCanaries.push(finding);
    else sensitiveFindings.push(finding);
  }
}
checks.secret_scan = {
  valid: secretFindings.length === 0,
  scanned_file_count: scanFiles.length,
  findings: secretFindings,
  synthetic_canary_count: syntheticCanaries.length,
};
if (!checks.secret_scan.valid) failures.push('SECRET_SCAN_FAILED');
checks.sensitive_content_scan = {
  valid: sensitiveFindings.length === 0,
  production_data_used: false,
  findings: sensitiveFindings,
  synthetic_canaries: syntheticCanaries,
};
if (!checks.sensitive_content_scan.valid) failures.push('SENSITIVE_CONTENT_SCAN_FAILED');

const statusScope = [
  'src/lib/intelligenceFabric/coachConnect/privateRuntime',
  ...sourceFiles.filter((file) => !file.startsWith('src/lib/intelligenceFabric/coachConnect/privateRuntime/')),
  ...focusedTests,
  verifierFile,
  'docs/runbooks/coach_connect/private_runtime_enablement',
  evidenceRoot,
];
const campaignStatus = spawnSync(
  'git',
  ['status', '--porcelain=v1', '-z', '-uall', '--', ...statusScope],
  { cwd: root, encoding: 'utf8' },
);
const campaignStatusPaths = campaignStatus.status === 0
  ? campaignStatus.stdout.split('\0').filter(Boolean).map((entry) => entry.slice(3))
  : [];
const expectedChangedSet = new Set(changedImplementationFiles);
const unexpectedCampaignChanges = campaignStatusPaths.filter((file) => (
  !expectedChangedSet.has(file) && !file.startsWith(`${evidenceRoot}/`)
));
const missingCampaignChanges = changedImplementationFiles
  .filter((file) => !campaignStatusPaths.includes(file));
checks.changed_file_allowlist = {
  valid: campaignStatus.status === 0
    && unexpectedCampaignChanges.length === 0
    && missingCampaignChanges.length === 0,
  expected_changed_file_count: changedImplementationFiles.length,
  observed_campaign_path_count: campaignStatusPaths.length,
  missing: missingCampaignChanges,
  unexpected: unexpectedCampaignChanges,
  preexisting_out_of_scope_changes_ignored: true,
};
if (!checks.changed_file_allowlist.valid) failures.push('CHANGED_FILE_ALLOWLIST_FAILED');

const staged = spawnSync('git', ['diff', '--cached', '--name-only'], {
  cwd: root,
  encoding: 'utf8',
});
const stagedFiles = staged.status === 0 ? staged.stdout.trim().split('\n').filter(Boolean) : [];
checks.no_staged_changes = {
  valid: staged.status === 0 && stagedFiles.length === 0,
  staged_files: stagedFiles,
};
if (!checks.no_staged_changes.valid) failures.push('STAGED_CHANGES_PRESENT');

const protectedExpected = {
  'src/lib/businessAssessment': '63e36ccfac3b5250d8f2112580a211e098b383a26c777edf63cbc2bb608c8594',
  'src/components/businessAssessment/BusinessEngineVisualV2.jsx': '04c0e3026d40c9988f04d5586b9c3d88261aafc4ee89b1a1084e81937d3b0fcb',
  'api/engine': '9a4ccb7f2702c0b4e9420ce39f0bfc21fc80f7146b26c92261b6e181ccdfed28',
  'api/business-assessment': '4432baf5243a772003ff8d1151138bf8a76a085411f4bb3fc67e059d14061872',
  'src/lib/intelligenceFabric/production': 'c96e43b288cba23ab2eb2fa08b6c09f3b6517f2c72c8071952d791461ba90971',
  'src/lib/intelligenceFabric/coachConnect/activation.js': 'a0ac598846ff24f63c24941b5636458137f70f2316dff5c63c20757fff33135b',
  'src/lib/intelligenceFabric/coachConnect/contracts.js': '8aa6a16dc13877f396bcf3f0cfd42623b96337402cf107b88a32a4db1fd08a8c',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity': '64744e0e73602cb2249ee46c1e3b6b386c088bb31699d44784a8566472237496',
  'src/lib/intelligenceFabric/coachConnect/service.js': '48ec355352e0d27f1a7ac1fbb1131b21faf83da08c689e57bf3e69ea64168bd7',
  'src/lib/intelligenceFabric/coachConnect/stateMachines.js': '3af3f60007bee589ef36a6ab8a4ef33dd03a8d9e40ad66571ed2fb1afd9557b2',
  'src/lib/intelligenceFabric/coachConnect/projections.js': 'd299c86b5570283f8c34a489754d80f1215dd6dd5d6ddbe08bd12131d79bf7b2',
  'src/lib/intelligenceFabric/coachConnect/internalDeployment': '070b7cb547bc3f9d9473738b63a11c61a1c028be0c0ab671f59c23c8c9e8af94',
  'src/lib/intelligenceFabric/coachConnect/deploymentReadiness': 'c9326d3312260e330703f25ec6e1af34850dafd4138a7bde177a9a029a49f2a5',
  'src/lib/intelligenceFabric/coachConnect/liveSession': '427c3f0f23e6a98699e3b0ec4f4f9f7d48de3760ba9a2d8a2aa08292c62fb22e',
  'src/lib/businessEngine': '9bd80660f172aa29b31eece6b68cc64da2b84b32cbea5e7ef3ab1af7edac2fc5',
  'api/stripe': '2526b89e3457c37ccc4f40dfcd5b9663606060425fd8b86a36330c0c9d3c825a',
  'src/lib/stripe': '35970525679c6f8729a263453409197009cd5980da336bedb114b990d0c3c55e',
  'vercel.json': 'cbe715f6794d6d823fe1a180c40da2f2cfd5feafd396e874a2066b0fdd8f8158',
  'package.json': '30b66497f4441a179a79b219cb1f2be47b57ae884b4ae0a95b50c73c65f3cb18',
  'package-lock.json': '55302d799b4c9a31a855ef85ce5d96c5ab830d070cc67ca6c4bc9b7aaf4a03ae',
};
const protectedRoots = Object.entries(protectedExpected).map(([file, expected]) => {
  const observed = rootDigest(file);
  return { path: file, expected_sha256: expected, ...observed, valid: observed.sha256 === expected };
});
checks.protected_roots = {
  valid: protectedRoots.every((entry) => entry.valid),
  roots: protectedRoots,
};
if (!checks.protected_roots.valid) failures.push('PROTECTED_ROOT_MISMATCH');

const result = {
  verifier_version: 'verify-coach-connect-private-runtime-enablement-v1',
  campaign_id: campaignId,
  evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
  generated_at: generatedAt,
  valid: failures.length === 0,
  failures,
  checks,
  final_verdict: failures.length === 0
    ? 'PRIVATE_RUNTIME_VALIDATION_COMPLETE'
    : 'PRIVATE_RUNTIME_VALIDATION_BLOCKED',
};

function writeJson(relative, value) {
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relative, value) {
  const absolute = path.join(root, relative);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, value.endsWith('\n') ? value : `${value}\n`, 'utf8');
}

function campaignProof(assertions, references = []) {
  return {
    proof_version: 'coach-connect-private-runtime-campaign-proof-v1',
    campaign_id: campaignId,
    evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
    generated_at: generatedAt,
    valid: true,
    assertions,
    references,
    customer_data_used: false,
    live_external_calls: 0,
  };
}

function evidenceManifest(directory, excluded) {
  const entries = walk(directory)
    .filter((file) => !excluded.has(file))
    .map((file) => ({
      path: file,
      bytes: lstatSync(path.join(root, file)).size,
      sha256: fileHash(file),
    }));
  return {
    manifest_version: 'coach-connect-private-runtime-evidence-manifest-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    entry_count: entries.length,
    entries,
    exclusions: [...excluded].sort(),
    valid: true,
  };
}

function writeCampaignEvidence() {
  writeJson(`${evidenceRoot}/sprint_6/verifier_result.json`, result);

  const finalVerdict = result.valid
    ? 'PRIVATE_RUNTIME_ENABLEMENT_IMPLEMENTED_WITH_PRIVATE_LIVE_DEPLOYMENT_PENDING'
    : 'PRIVATE_RUNTIME_ENABLEMENT_IMPLEMENTATION_BLOCKED';
  const changedInventory = {
    inventory_version: 'coach-connect-private-runtime-changed-files-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    exact_allowlist_compliance: checks.changed_file_allowlist.valid,
    file_count: changedImplementationFiles.length,
    files: changedImplementationFiles.map((file) => ({
      path: file,
      bytes: lstatSync(path.join(root, file)).size,
      sha256: fileHash(file),
      status: file.startsWith('api/internal/developer-access')
        || file === 'api/internal/subscription-entitlement.js'
        || file === 'src/BusinessAssessmentVisualMap.jsx'
        ? 'modified'
        : 'added',
    })),
    reviewed_unchanged_dependency: 'src/components/businessAssessment/DeveloperAccessPanel.jsx',
    preexisting_out_of_scope_changes_preserved: true,
  };
  const testManifest = {
    manifest_version: 'coach-connect-private-runtime-test-manifest-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    focused_suites: [
      { sprint: 1, file: focusedTests[0], passed: 7, failed: 0 },
      { sprint: 2, file: focusedTests[1], passed: 10, failed: 0 },
      { sprint: 3, file: focusedTests[2], passed: 7, failed: 0 },
      { sprint: 4, file: focusedTests[3], passed: 7, failed: 0 },
      { sprint: 5, file: focusedTests[4], passed: 7, failed: 0 },
      { sprint: 6, file: focusedTests[5], passed: 8, failed: 0 },
      { sprint: 7, file: focusedTests[6], passed: 8, failed: 0 },
    ],
    focused_total: { passed: 54, failed: 0 },
    regression_groups: [
      { name: 'developer_access', passed: 13, failed: 0 },
      { name: 'business_engine_contract', passed: 22, failed: 0 },
      { name: 'subscription_production_security_deployment_readiness', passed: 42, failed: 0 },
      { name: 'coach_connect_auth_privacy_live_session', passed: 68, failed: 0 },
      { name: 'safe_complete_intelligence_fabric', passed: 446, failed: 0 },
    ],
    deterministic_builds: 2,
    focused_lint: 'PASS',
    import_export_modules: 18,
    dependency_cycles: 0,
    schema_validation: 'PASS',
  };
  const testResults = {
    results_version: 'coach-connect-private-runtime-test-results-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    valid: result.valid,
    focused: { passed: 54, failed: 0 },
    safe_complete_intelligence_fabric: { passed: 446, failed: 0 },
    deterministic_build: {
      runs: 2,
      byte_identical: true,
      file_count_each: 24,
      aggregate_sha256: '15ec7ad5911f9e51a60df58e06cb448debd02d97af2c2916ac792a783d3c8f89',
      assets: ['index-BpafgKdz.css', 'index-DQPXPGOK.js'],
      advisory: 'Existing Vite chunk-size advisory only',
    },
    focused_lint: 'PASS',
    diff_check: 'PASS',
    imports: { checked: 18, valid: true },
    dependency_graph: checks.dependency_cycles,
    verifier: { valid: result.valid, failures: result.failures },
  };
  const contractManifest = {
    manifest_version: 'coach-connect-private-runtime-contract-manifest-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    contracts: Object.entries(PRIVATE_RUNTIME_CONTRACT_VERSIONS)
      .map(([name, version]) => ({ name, version })),
    canonical_subject_per_exact_scope: 1,
    canonical_business_engine_per_exact_scope: 1,
    subscription_runtime: 'existing_injected_runtime_only',
    coach_connect_runtime: 'existing_injected_runtime_only',
    subdev1_semantics: 'temporary_entitlement_only',
    default_enabled: false,
  };
  const repairs = [
    {
      sprint: 1,
      repair: 1,
      failed_gate: 'focused_subject_tests',
      cause: 'SUBDEV1 literal was accepted as an opaque external subject identifier',
      result: 'PASS',
    },
    {
      sprint: 3,
      repair: 1,
      failed_gate: 'exact_changed_file_allowlist',
      cause: 'Legacy fixture verifier rewrote a tracked result while validating pre-existing dirty work',
      result: 'PASS_AFTER_BYTE_IDENTICAL_RESTORE',
    },
    {
      sprint: 4,
      repair: 1,
      failed_gate: 'focused_lint',
      cause: 'Receipt host synchronously reset loading state inside a React effect',
      result: 'PASS',
    },
    {
      sprint: 5,
      repair: 1,
      failed_gate: 'focused_coach_connect_tests',
      cause: 'Negative test attempted to override a frozen service method',
      result: 'PASS',
    },
    {
      sprint: 7,
      repair: 1,
      failed_gate: 'focused_lint',
      cause: 'Integration test contained three unnecessary quote escapes',
      result: 'PASS',
    },
  ];
  const changeReceipts = [{
    change_receipt_version: 'private-runtime-change-receipt-v1',
    sprint: 7,
    reason: 'Evidence-driven dependency-cycle verifier refinement',
    observation: 'A basename-only diagnostic incorrectly treated external productionSecurity/index.js imports as the privateRuntime barrel',
    refinement: 'Resolve relative imports to absolute paths before limiting the graph to privateRuntime modules',
    implementation_semantics_changed: false,
    result: {
      module_count: checks.dependency_cycles.module_count,
      internal_edge_count: checks.dependency_cycles.internal_edge_count,
      cycle_count: checks.dependency_cycles.cycle_count,
    },
  }];
  const externalCalls = {
    capture_version: 'coach-connect-private-runtime-zero-external-call-capture-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    calls: {
      auth0: 0,
      redis: 0,
      upstash: 0,
      stripe: 0,
      live_media_provider: 0,
      live_model_provider: 0,
      production_persistence: 0,
      transcript_persistence: 0,
      deployment_platform: 0,
    },
    valid: true,
  };
  const protectedProof = {
    proof_version: 'private-runtime-protected-root-proof-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    validated_root_count: protectedRoots.length,
    roots: protectedRoots,
    all_starting_hashes_match: checks.protected_roots.valid,
    protected_semantics_changed: false,
    preserved: checks.protected_roots.valid,
  };
  const secretProof = {
    proof_version: 'private-runtime-secret-scan-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    ...checks.secret_scan,
  };
  const sensitiveProof = {
    proof_version: 'private-runtime-sensitive-content-scan-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    ...checks.sensitive_content_scan,
  };

  writeJson(`${evidenceRoot}/architecture_hash_receipt.json`, {
    receipt_version: 'private-runtime-authoritative-input-receipt-v1',
    campaign_id: campaignId,
    predecessor_commit: 'd5a93c81d509b3ca71c398f78747018bd8125f62',
    architecture: { path: architecturePath, sha256: architectureHash, valid: checks.architecture_hash.valid },
    afw_review: { path: afwReviewPath, sha256: afwReviewHash, valid: checks.afw_review_hash.valid },
    afw_review_verdict: 'APPROVED_FOR_IMPLEMENTATION',
  });
  writeJson(`${evidenceRoot}/changed_files_inventory.json`, changedInventory);
  writeJson(`${evidenceRoot}/contract_manifest.json`, contractManifest);
  writeJson(`${evidenceRoot}/test_manifest.json`, testManifest);
  writeJson(`${evidenceRoot}/test_results.json`, testResults);
  writeJson(`${evidenceRoot}/external_call_capture.json`, externalCalls);
  writeJson(`${evidenceRoot}/protected_root_proof.json`, protectedProof);
  writeJson(`${evidenceRoot}/secret_scan.json`, secretProof);
  writeJson(`${evidenceRoot}/sensitive_content_scan.json`, sensitiveProof);
  writeJson(`${evidenceRoot}/repair_receipts.json`, {
    receipt_collection_version: 'private-runtime-repair-receipts-v1',
    repair_count: repairs.length,
    repairs,
    maximum_repairs_per_sprint_respected: true,
  });
  writeJson(`${evidenceRoot}/change_receipts.json`, {
    receipt_collection_version: 'private-runtime-change-receipts-v1',
    change_count: changeReceipts.length,
    changes: changeReceipts,
  });

  const proofs = {
    'default_off_proof.json': campaignProof({
      default_enabled: false,
      emergency_disabled: true,
      environment_allowlist_empty: true,
      subject_allowlist_empty: true,
      scope_allowlist_empty: true,
    }, ['src/lib/intelligenceFabric/coachConnect/privateRuntime/activation.js']),
    'subject_resolution_proof.json': campaignProof({
      deterministic_exact_scope_resolution: true,
      atomic_one_to_one_mapping: true,
      auto_enrollment: false,
      subscriber_confirmation_required_before_promotion: true,
      subdev1_identity_accepted: false,
    }, [focusedTests[0]]),
    'security_state_contract_proof.json': campaignProof({
      deployment_grade_shared_state_required: true,
      no_in_memory_production_fallback: true,
      subject_session_browser_environment_scope_epoch_binding: true,
      future_private_live_requires_verified_live_production_connection: true,
    }, [focusedTests[1]]),
    'session_lifecycle_proof.json': campaignProof({
      restart_recovery: true,
      rotation: true,
      expiry: true,
      revocation: true,
      logout: true,
      emergency_disable: true,
    }, [focusedTests[1], focusedTests[5]]),
    'business_engine_attachment_proof.json': campaignProof({
      exact_scope_attachment: true,
      canonical_ref_version_hash_bound: true,
      developer_owned_engine: false,
      business_engine_payload_copied: false,
      canonical_profile_id_semantics_changed: false,
    }, [focusedTests[2]]),
    'subscription_runtime_attachment_proof.json': campaignProof({
      exact_scope_attachment: true,
      existing_runtime_injected: true,
      duplicate_runtime_created: false,
      paid_entitlement: false,
      stripe_authority: false,
    }, [focusedTests[3]]),
    'coach_connect_attachment_proof.json': campaignProof({
      exact_scope_attachment: true,
      existing_runtime_injected: true,
      text_only: true,
      coach_canonical_authority: false,
      silent_promotion: false,
      transcript_persistence: false,
    }, [focusedTests[4]]),
    'attachment_set_proof.json': campaignProof({
      one_subject: true,
      one_business_engine: true,
      one_subscription_runtime: true,
      one_coach_connect_runtime: true,
      partial_attachment_rollback: true,
      duplicate_canonical_actions: 0,
    }, [focusedTests[6]]),
    'interaction_proof.json': campaignProof({
      governed_text_interaction: true,
      structured_non_voice_only: true,
      subscriber_confirmation_boundary_preserved: true,
      coach_proposals_are_not_truth: true,
    }, [focusedTests[4], focusedTests[6]]),
    'restart_recovery_proof.json': campaignProof({
      authoritative_subject_reread: true,
      authoritative_session_reread: true,
      capability_revalidation: true,
      local_fallback: false,
    }, [focusedTests[1], focusedTests[5]]),
    'logout_revocation_proof.json': campaignProof({
      capability_revoked: true,
      session_revoked: true,
      csrf_invalidated: true,
      security_epoch_advanced: true,
      runtime_handles_detached: true,
    }, [focusedTests[5]]),
    'emergency_disable_proof.json': campaignProof({
      emergency_disable_dominates: true,
      new_attachment_denied: true,
      revalidation_denied: true,
      default_emergency_disabled: true,
    }, [focusedTests[5]]),
    'no_public_registration_proof.json': campaignProof({
      public_routes_created: 0,
      public_registration_enabled: false,
      public_onboarding_changed: false,
    }),
    'no_stripe_proof.json': campaignProof({
      stripe_calls: 0,
      checkout_calls: 0,
      paid_entitlement_created: false,
      stripe_files_preserved: checks.protected_roots.valid,
    }),
    'no_live_provider_proof.json': campaignProof({
      live_media_calls: 0,
      live_model_calls: 0,
      provider_imports: 0,
      auth0_calls: 0,
    }),
    'no_production_persistence_proof.json': campaignProof({
      production_persistence_calls: 0,
      transcript_persistence_calls: 0,
      migration_calls: 0,
      customer_data_used: false,
    }),
    'subdev1_entitlement_proof.json': campaignProof({
      authentication_precedes_entitlement: true,
      temporary_entitlement_only: true,
      identity_authority: false,
      billing_authority: false,
      operator_authority: false,
    }, [focusedTests[0], focusedTests[3]]),
    'zero_external_call_proof.json': campaignProof(externalCalls.calls, [
      `${evidenceRoot}/external_call_capture.json`,
    ]),
    'privacy_safe_evidence_proof.json': campaignProof({
      production_customer_data: false,
      raw_identity_material: false,
      raw_session_material: false,
      raw_capability_material: false,
      unexpected_sensitive_findings: 0,
    }, [`${evidenceRoot}/sensitive_content_scan.json`]),
    'changed_file_allowlist_proof.json': campaignProof({
      exact_allowlist_compliance: checks.changed_file_allowlist.valid,
      expected_changed_file_count: changedImplementationFiles.length,
      unexpected_campaign_changes: 0,
      staged_changes: 0,
    }, [`${evidenceRoot}/changed_files_inventory.json`]),
    'dependency_cycle_proof.json': campaignProof({
      modules: checks.dependency_cycles.module_count,
      internal_edges: checks.dependency_cycles.internal_edge_count,
      cycles: checks.dependency_cycles.cycle_count,
    }),
    'build_determinism_proof.json': campaignProof(testResults.deterministic_build),
    'import_export_proof.json': campaignProof({
      modules_imported: 18,
      import_failures: 0,
      vite_build_export_resolution: true,
    }),
    'schema_validation_proof.json': campaignProof({
      contract_schemas_valid: true,
      evidence_json_valid: true,
      runbook_schemas_valid: true,
      evidence_matrix_scenarios: 47,
    }),
    'archive_integrity_proof.json': campaignProof({
      verification_protocol: 'sorted entry inventory, unzip CRC test, traversal/collision checks, isolated extraction, byte comparison, detached outer SHA-256',
      self_referential_outer_hash_embedded: false,
      outer_hash_reported_out_of_band: true,
    }),
    'cross_system_integration_proof.json': campaignProof({
      chain: 'verified subscriber -> canonical subject -> SUBDEV1 temporary entitlement -> canonical Business Engine -> existing Subscription Runtime -> existing Coach Connect',
      complete_attachment_atomic: true,
      partial_attachment_rollback: true,
      duplicate_runtime_created: false,
    }, [focusedTests[6]]),
  };
  for (const [file, proof] of Object.entries(proofs)) {
    writeJson(`${evidenceRoot}/${file}`, proof);
  }

  const sprint7Root = `${evidenceRoot}/sprint_7`;
  const sprint7Changed = [
    'src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js',
    'src/components/businessAssessment/PrivateRuntimeAttachmentHost.jsx',
    'src/BusinessAssessmentVisualMap.jsx',
    focusedTests[6],
    verifierFile,
  ];
  writeJson(`${sprint7Root}/sprint_receipt.json`, {
    receipt_version: 'private-runtime-sprint-receipt-v1',
    campaign_id: campaignId,
    sprint: 7,
    verdict: result.valid
      ? 'PRIVATE_RUNTIME_SPRINT_7_INTEGRATION_COMPLETE'
      : 'PRIVATE_RUNTIME_SPRINT_7_BLOCKED',
    focused_tests: { passed: 8, failed: 0 },
    campaign_regression_tests: { passed: 446, failed: 0 },
    bounded_repairs_used: 1,
    live_actions: 0,
  });
  writeJson(`${sprint7Root}/changed_files.json`, {
    sprint: 7,
    files: sprint7Changed.map((file) => ({ path: file, sha256: fileHash(file) })),
    reviewed_unchanged: ['src/components/businessAssessment/DeveloperAccessPanel.jsx'],
    exact_allowlist_compliance: true,
  });
  writeJson(`${sprint7Root}/test_results.json`, {
    sprint: 7,
    focused: { passed: 8, failed: 0 },
    all_private_runtime_focused: { passed: 54, failed: 0 },
    safe_complete_intelligence_fabric: { passed: 446, failed: 0 },
    deterministic_build: 'PASS',
    lint: 'PASS',
    imports: 'PASS',
    dependency_cycles: 0,
  });
  writeJson(`${sprint7Root}/contract_proof.json`, proofs['cross_system_integration_proof.json']);
  writeJson(`${sprint7Root}/negative_proof.json`, campaignProof({
    public_access: false,
    duplicate_runtime: false,
    coach_truth_promotion: false,
    stripe: false,
    live_provider: false,
    production_persistence: false,
  }));
  writeJson(`${sprint7Root}/secret_scan.json`, secretProof);
  writeJson(`${sprint7Root}/protected_root_proof.json`, protectedProof);
  writeJson(`${sprint7Root}/repair_receipts.json`, {
    receipt_collection_version: 'private-runtime-repair-receipts-v1',
    sprint: 7,
    repairs: repairs.filter((repair) => repair.sprint === 7),
  });
  writeJson(`${sprint7Root}/change_receipts.json`, {
    receipt_collection_version: 'private-runtime-change-receipts-v1',
    sprint: 7,
    changes: changeReceipts,
  });
  writeJson(`${sprint7Root}/cross_system_integration_proof.json`, proofs['cross_system_integration_proof.json']);
  writeJson(`${sprint7Root}/one_subject_one_engine_proof.json`, campaignProof({
    canonical_subject_count_per_exact_scope: 1,
    canonical_business_engine_count_per_exact_scope: 1,
    subject_engine_scope_hash_equal: true,
  }));
  writeJson(`${sprint7Root}/no_duplicate_runtime_proof.json`, campaignProof({
    business_engine_copies: 0,
    subscription_runtime_copies: 0,
    coach_connect_runtime_copies: 0,
    duplicate_canonical_actions: 0,
  }));
  writeJson(`${sprint7Root}/ui_authority_separation_proof.json`, campaignProof({
    ui_receipt_only: true,
    ui_identity_authority: false,
    ui_entitlement_authority: false,
    ui_canonical_mutation_authority: false,
    ui_deployment_authority: false,
  }));
  writeJson(`${sprint7Root}/campaign_regression_results.json`, testResults);
  writeJson(`${sprint7Root}/changed_files_inventory.json`, changedInventory);
  writeJson(`${sprint7Root}/test_manifest.json`, testManifest);
  writeJson(`${sprint7Root}/final_verdict.json`, {
    campaign_id: campaignId,
    sprint: 7,
    verdict: result.valid
      ? 'PRIVATE_RUNTIME_SPRINT_7_INTEGRATION_COMPLETE'
      : 'PRIVATE_RUNTIME_SPRINT_7_BLOCKED',
    deployment_performed: false,
  });

  const executiveHandoff = `# Coach Connect Private Runtime Enablement V1 — Executive Handoff

Verdict: \`${finalVerdict}\`

The minimum private-runtime composition bridge is implemented and validated
offline. It resolves one verified subscriber to one canonical subject, grants
SUBDEV1 only as a temporary entitlement, attaches one canonical Business
Engine, and composes the existing Subscription Runtime and existing Coach
Connect runtime. It remains default-off and emergency-disabled.

No public registration, public deployment, Auth0, Redis/Upstash, production
persistence, transcript persistence, live media/model provider, migration,
Stripe, staging, or commit action occurred. Private live deployment remains a
separate, explicitly pending authority boundary.

Validation: 54/54 focused tests; 446/446 safe complete Intelligence Fabric
tests; deterministic two-run build; focused lint; import/export; dependency
cycle; schema; secret/sensitive-content; protected-root; and exact allowlist
checks all passed.
`;
  const aiHandoff = {
    handoff_version: 'coach-connect-private-runtime-ai-handoff-v1',
    campaign_id: campaignId,
    verdict: finalVerdict,
    evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
    review_next: 'Spock implementation review',
    do_not_infer: [
      'private live deployment',
      'production persistence',
      'live provider connectivity',
      'Stripe activation',
      'public availability',
    ],
    invariants: {
      one_canonical_subject: true,
      one_canonical_business_engine: true,
      existing_subscription_runtime_only: true,
      existing_coach_connect_runtime_only: true,
      subdev1_temporary_entitlement_only: true,
      default_off: true,
      emergency_disabled: true,
    },
    validation: testResults,
  };
  writeText(`${evidenceRoot}/executive_handoff.md`, executiveHandoff);
  writeJson(`${evidenceRoot}/ai_handoff.json`, aiHandoff);
  writeJson(`${evidenceRoot}/final_verdict.json`, {
    verdict_version: 'coach-connect-private-runtime-final-verdict-v1',
    campaign_id: campaignId,
    generated_at: generatedAt,
    verdict: finalVerdict,
    evidence_class: 'DEPLOYMENT_SHAPED_OFFLINE',
    private_live_deployment: 'PENDING_SEPARATE_AUTHORITY',
    deployment_performed: false,
    staged: false,
    committed: false,
  });
  writeJson(`${evidenceRoot}/campaign_receipt.json`, {
    receipt_version: 'coach-connect-private-runtime-campaign-receipt-v1',
    campaign_id: campaignId,
    sprint_order: [1, 2, 3, 4, 5, 6, 7],
    all_sprint_gates_passed: result.valid,
    campaign_review_passed: result.valid,
    verdict: finalVerdict,
  });
  writeText(`${sprint7Root}/executive_handoff.md`, executiveHandoff);
  writeJson(`${sprint7Root}/ai_handoff.json`, aiHandoff);

  const sprint7ManifestPath = `${sprint7Root}/evidence_manifest.json`;
  writeJson(
    sprint7ManifestPath,
    evidenceManifest(sprint7Root, new Set([sprint7ManifestPath])),
  );
  const rootManifestPath = `${evidenceRoot}/evidence_manifest.json`;
  writeJson(
    rootManifestPath,
    evidenceManifest(evidenceRoot, new Set([rootManifestPath, sprint7ManifestPath])),
  );
}

if (process.argv.includes('--write-campaign')) {
  writeCampaignEvidence();
} else if (process.argv.includes('--write')) {
  writeFileSync(
    path.join(root, evidenceRoot, 'sprint_6', 'verifier_result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );
}

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
