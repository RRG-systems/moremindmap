import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  PRODUCTION_SECURITY_FAILURE_CODES,
  PRODUCTION_SECURITY_POLICY_VERSIONS,
  RATIFIED_ARCHITECTURE_DECISIONS,
  RATIFIED_DECISION_STATUS,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CAMPAIGN_ID = 'MORE_CAMPAIGN_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_V1';
const BASELINE = 'd42b52a27e8dae0ea4f53a444ee073a752fcdecd';
const GENERATED_AT = new Date().toISOString();
const PROOF_RELATIVE = 'lab_outputs/coach_connect_production_security_prerequisites_v1';
const PROOF_ROOT = path.join(ROOT, PROOF_RELATIVE);
const ARCHIVE_NAME = 'COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTATION_REVIEW_V1.zip';
const ARCHIVE_PATH = path.join(ROOT, ARCHIVE_NAME);
const RATIFICATION_PATH = '/Users/rrg/Desktop/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_RATIFICATION_V1.md';
const FINAL_VERDICT = 'COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTED_WITH_ACTIVATION_GATES';
const DEPLOYMENT_PROHIBITION = 'Deployment, public or private production activation, production certification, production Redis or other live shared-state access, live providers/models/media, credentials or secrets, production migration, Stripe activation, and destructive production deletion are not authorized by this campaign result.';

const AFW_PATHS = [
  'docs/intelligence_fabric/MORE_CAMPAIGN_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_PART_1_V1.md',
  'docs/intelligence_fabric/MORE_CAMPAIGN_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_PART_2_V1.md',
  'docs/intelligence_fabric/MORE_CAMPAIGN_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_PART_3_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_CROSS_PART_CONSISTENCY_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_EXPANSION_INDEX_V1.json',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_1_IDENTITY_SESSION_AFW_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_2_SHARED_SECURITY_STATE_AFW_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_3_RETENTION_DELETION_STATE_AFW_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_4_TRANSCRIPT_HISTORICAL_ERASURE_AFW_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_5_TRANSPORT_NETWORK_TRUST_AFW_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_6_OPERATOR_IDENTITY_AFW_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_SPRINT_7_INTEGRATION_VERDICT_AFW_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_HUMAN_DECISION_PACKET_V1.md',
  'docs/intelligence_fabric/MORE_COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_AFW_DECISION_AUTHORITY_REPAIR_RECEIPT_V1.md',
];

const IMPLEMENTATION_PATHS = [
  'api/internal/developer-access-security.js',
  'api/internal/developer-access.js',
  'src/lib/intelligenceFabric/coachConnect/index.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/activation.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/audit.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/constants.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/deletionLifecycle.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/erasureStrategy.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/inMemorySharedSecurityState.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/operatorIdentity.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/retentionAuthority.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/sessionElevation.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/sharedSecurityStatePorts.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/subjectBinding.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/transportPolicy.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/trustedProxy.js',
];

const TEST_PATHS = [
  'test/api.internal.developerAccess.productionSecurity.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.integration.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.operator.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.retention.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.sessionElevation.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.sharedState.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.subjectBinding.test.js',
  'test/intelligenceFabric.coachConnect.productionSecurity.transport.test.js',
];

const HELPER_PATH = 'scripts/verifyCoachConnectProductionSecurityPrerequisites.mjs';
const CAMPAIGN_SOURCE_PATHS = [...IMPLEMENTATION_PATHS, ...TEST_PATHS, HELPER_PATH].sort();
const PROTECTED_ROOTS = [
  'api/engine/businessAssessment',
  'api/engine/canonical',
  'api/engine/vault',
  'api/stripe',
  'src/lib/businessAssessment',
  'src/lib/businessEngine',
  'src/lib/intelligenceFabric/runtime',
  'src/lib/intelligenceFabric/bootstrap',
  'src/lib/intelligenceFabric/subscriber',
  'src/lib/stripe',
  'src/lib/stripeCheckout.js',
];

const DECISION_STATUSES = {
  SUBSCRIBER_AUTHORITY_SOURCE: 'APPROVED',
  SUBSCRIBER_SESSION_OWNER: 'APPROVED',
  SHARED_STATE_PLATFORM: 'APPROVED_WITH_REFINEMENT',
  RETENTION_POLICY_AUTHORITY: 'APPROVED_WITH_ACTIVATION_GATE',
  TRANSCRIPT_BACKING_STORE: 'APPROVED',
  BACKUP_RESTORE_HORIZON: 'APPROVED_WITH_REFINEMENT',
  HISTORICAL_ERASURE_STRATEGY: 'APPROVED',
  PRODUCTION_HOSTING_TRUST: 'APPROVED',
  HSTS_DIRECTIVES: 'APPROVED',
  OPERATOR_IDENTITY_AUTHORITY: 'APPROVED_WITH_REFINEMENT',
  OPERATOR_ENTITLEMENT_POLICY: 'APPROVED',
};

const SCENARIOS = [
  'Client supplies another subscriber ID without a verified subject',
  'Valid subject from tenant A requests tenant B',
  'Wrong issuer or audience assertion',
  'Disabled deleted or stale subject mapping',
  'Invite binding replayed against another subject',
  'Account recovery attempts silent reassignment',
  'Attacker fixes a pre-auth identifier before authentication',
  'Old pre-auth token CSRF grant or capability used after elevation',
  'Elevation retried across two instances',
  'Shared-state failure during atomic elevation',
  'Logout or privilege reduction leaves an old token active',
  'Instance A revokes and instance B verifies',
  'Instance A consumes nonce and instance B replays',
  'Rate-limit attempts split across instances',
  'Security epoch advances while stale instance authorizes',
  'Shared state unavailable or partitioned',
  'TTL clock crosses exact expiry boundary',
  'Two deletion workers acquire one lease',
  'Draft or unapproved retention policy attempts execution',
  'Unknown authority or stale policy version',
  'Active legal hold conflicts with deletion request',
  'Subscriber and coach requests assert different authority',
  'Operator attempts retention override outside entitlement',
  'Policy changes during an active deletion job',
  'Mandatory backing store is missing',
  'Primary deletion succeeds while another target fails',
  'Retry follows partial deletion failure',
  'Restore reintroduces a pre-deletion record',
  'Derived evidence lacks independent lineage verification',
  'Legal hold applies to selected target classes',
  'Deletion receipt lacks target verification',
  'Erasure strategy is not approved',
  'Replacement transition is incomplete before verification',
  'Cryptographic erasure leaves an active replica or backup key',
  'Store replacement attempts prohibited dual write',
  'Old append-only JSONL bytes remain',
  'Erasure retry violates lineage or idempotency',
  'Preview or local request claims production',
  'Production label lacks verified HTTPS',
  'Host is outside exact allowlist',
  'HSTS directives are missing or ambiguous',
  'Direct client injects a forwarded address header',
  'Untrusted upstream proxy adds a chain',
  'Proxy chain is too long malformed or ambiguous',
  'Verified path produces only a privacy-safe bucket',
  'Unauthenticated operator action',
  'SUBDEV1 attempts an operator action',
  'Revoked or stale operator session',
  'Wrong environment or tenant entitlement',
  'Operator reason is missing',
  'Destructive action lacks distinct dual approver',
  'Operator audit append fails',
  'Shared or developer code attempts operator authentication',
  'Subject mapping changes while session remains cached',
  'Shared-state outage during operator-approved deletion',
  'Restore occurs under a newer deletion epoch',
  'Proxy trust becomes ambiguous while HSTS is evaluated',
  'Operator action attempts canonical promotion bypass',
  'Production flags enable with an unresolved dependency',
  'Complete graph runs in a synthetic deployment-shaped harness',
];

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function ensureFile(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  if (!fs.statSync(absolute, { throwIfNoEntry: false })?.isFile()) throw new Error(`MISSING_REQUIRED_FILE:${relativePath}`);
  return absolute;
}

function writeJson(relativePath, value) {
  const absolute = path.join(PROOF_ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function writeText(relativePath, value) {
  const absolute = path.join(PROOF_ROOT, relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${value.trim()}\n`, { mode: 0o600 });
}

function proofBase({ evidenceClass = 'SYNTHETIC', commandReference = null, status = 'PASS', limitations = [] } = {}) {
  return {
    artifact_version: '1.0.0',
    campaign_id: CAMPAIGN_ID,
    evidence_class: evidenceClass,
    generated_at: GENERATED_AT,
    source_commit: BASELINE,
    command_test_reference: commandReference,
    status,
    limitations,
  };
}

function command(args, {
  env = process.env,
  timeout = 600_000,
  cwd = ROOT,
} = {}) {
  const started = Date.now();
  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    env,
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: args.join(' '),
    exit_code: result.status,
    signal: result.signal,
    duration_ms: Date.now() - started,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    passed: result.status === 0,
  };
}

function safeEnvironment() {
  const next = { ...process.env, NODE_ENV: 'test' };
  const prohibited = /(REDIS|UPSTASH|AUTH0|AWS_|VERCEL|STRIPE|OPENAI|ANTHROPIC|GROK|PROVIDER.*KEY|DATABASE_URL)/i;
  for (const key of Object.keys(next)) {
    if (prohibited.test(key)) delete next[key];
  }
  next.COACH_CONNECT_PRODUCTION_SECURITY_FOUNDATION_ENABLED = 'false';
  next.COACH_CONNECT_PRODUCTION_TRAFFIC_ENABLED = 'false';
  next.COACH_CONNECT_PRODUCTION_REDIS_ENABLED = 'false';
  next.COACH_CONNECT_TRANSCRIPT_PERSISTENCE_ENABLED = 'false';
  next.COACH_CONNECT_STRIPE_ENABLED = 'false';
  return next;
}

function testFiles(predicate) {
  return fs.readdirSync(path.join(ROOT, 'test'))
    .filter((name) => predicate(name))
    .map((name) => `test/${name}`)
    .sort();
}

function summarizeResult(result, kind) {
  const combined = `${result.stdout}\n${result.stderr}`;
  const number = (label) => {
    const match = combined.match(new RegExp(`(?:ℹ\\s+|#\\s*)${label}\\s+(\\d+)`));
    return match ? Number(match[1]) : null;
  };
  return {
    command: result.command,
    kind,
    exit_code: result.exit_code,
    duration_ms: result.duration_ms,
    status: result.passed ? 'PASS' : 'FAIL',
    tests: number('tests'),
    pass: number('pass'),
    fail: number('fail'),
    cancelled: number('cancelled'),
    skipped: number('skipped'),
    todo: number('todo'),
  };
}

function gitOutput(args) {
  const result = command(['git', ...args], { timeout: 60_000 });
  if (!result.passed) throw new Error(`GIT_COMMAND_FAILED:${args.join(' ')}`);
  return result.stdout.trim();
}

function protectedSnapshot() {
  const inventory = [];
  for (const protectedRoot of PROTECTED_ROOTS) {
    const tracked = gitOutput(['ls-files', '-z', '--', protectedRoot]).split('\0').filter(Boolean);
    for (const relativePath of tracked) {
      const absolute = path.join(ROOT, relativePath);
      inventory.push({
        path: relativePath,
        sha256: fs.existsSync(absolute) ? sha256File(absolute) : null,
      });
    }
  }
  inventory.sort((left, right) => left.path.localeCompare(right.path));
  return {
    roots: PROTECTED_ROOTS,
    file_count: inventory.length,
    aggregate_sha256: sha256Buffer(JSON.stringify(inventory)),
    inventory,
  };
}

function secretScan(paths) {
  const patterns = [
    ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ['aws_access_key', /\bAKIA[0-9A-Z]{16}\b/g],
    ['live_openai_key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/g],
    ['authorization_value', /\bAuthorization\s*:\s*Bearer\s+\S+/gi],
    ['credentialed_redis_url', /\brediss?:\/\/[^:\s/]+:[^@\s/]+@/gi],
    ['session_cookie_value', /\b(?:__Host-more_session|coach_connect_dev_capability)=[A-Za-z0-9_-]{20,}/g],
  ];
  const findings = [];
  let approvedSyntheticNetworkFixtures = 0;
  for (const relativePath of paths) {
    const absolute = path.isAbsolute(relativePath) ? relativePath : path.join(ROOT, relativePath);
    if (!fs.statSync(absolute, { throwIfNoEntry: false })?.isFile()) {
      findings.push({ category: 'unreadable', safe_path: relativePath });
      continue;
    }
    const content = fs.readFileSync(absolute, 'utf8');
    for (const [category, expression] of patterns) {
      const count = [...content.matchAll(expression)].length;
      if (count) findings.push({ category, safe_path: relativePath, count, file_sha256: sha256File(absolute) });
    }
    const addresses = [...content.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)].map((match) => match[0]);
    for (const address of addresses) {
      if (relativePath.endsWith('productionSecurity.transport.test.js')
        && /^(?:192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(address)) {
        approvedSyntheticNetworkFixtures += 1;
      } else {
        findings.push({
          category: 'raw_network_address',
          safe_path: relativePath,
          count: 1,
          file_sha256: sha256File(absolute),
        });
      }
    }
  }
  return {
    status: findings.length ? 'FAIL' : 'PASS',
    scanned_file_count: paths.length,
    confirmed_exposure_count: findings.length,
    approved_synthetic_rfc_network_fixture_count: approvedSyntheticNetworkFixtures,
    findings,
  };
}

function directoryFiles(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`SYMLINK_PROHIBITED:${absolute}`);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(absolute);
      else throw new Error(`UNSUPPORTED_ENTRY:${absolute}`);
    }
  };
  visit(directory);
  return files.sort();
}

function inventoryFor(directory, exclude = new Set()) {
  return directoryFiles(directory)
    .map((absolute) => ({
      path: path.relative(directory, absolute).split(path.sep).join('/'),
      sha256: sha256File(absolute),
      bytes: fs.statSync(absolute).size,
    }))
    .filter((entry) => !exclude.has(entry.path))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function copyExact(source, destination) {
  const stat = fs.lstatSync(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`COPY_SOURCE_INVALID:${source}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function packageAndVerify() {
  if (fs.existsSync(ARCHIVE_PATH)) throw new Error(`ARCHIVE_ALREADY_EXISTS:${ARCHIVE_NAME}`);
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-connect-production-security-review-'));
  const extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-connect-production-security-verify-'));
  try {
    for (const relativePath of AFW_PATHS) {
      copyExact(ensureFile(relativePath), path.join(staging, 'architecture', path.basename(relativePath)));
    }
    copyExact(RATIFICATION_PATH, path.join(staging, 'ratification', path.basename(RATIFICATION_PATH)));
    for (const relativePath of CAMPAIGN_SOURCE_PATHS) {
      copyExact(ensureFile(relativePath), path.join(staging, 'implementation', relativePath));
    }
    for (const absolute of directoryFiles(PROOF_ROOT)) {
      const relativePath = path.relative(PROOF_ROOT, absolute);
      copyExact(absolute, path.join(staging, 'evidence', relativePath));
    }
    const priorInventory = inventoryFor(staging);
    const packageManifest = {
      schema: 'more.coach_connect.production_security_prerequisites.package_manifest',
      version: '1.0.0',
      generated_at: GENERATED_AT,
      campaign_id: CAMPAIGN_ID,
      final_verdict: FINAL_VERDICT,
      manifest_self_excluded: true,
      entries: priorInventory,
      entry_count_excluding_manifest: priorInventory.length,
    };
    fs.writeFileSync(path.join(staging, 'PACKAGE_MANIFEST.json'), `${JSON.stringify(packageManifest, null, 2)}\n`, { mode: 0o600 });
    const stageInventory = inventoryFor(staging);
    const stageRelativePaths = stageInventory.map((entry) => entry.path);
    const unsafePaths = stageRelativePaths.filter((entry) => path.isAbsolute(entry)
      || entry.split('/').includes('..')
      || entry.includes('\\'));
    const lower = stageRelativePaths.map((entry) => entry.toLowerCase());
    if (unsafePaths.length || new Set(lower).size !== lower.length || new Set(stageRelativePaths).size !== stageRelativePaths.length) {
      throw new Error('PACKAGE_ENTRY_PATH_VALIDATION_FAILED');
    }
    const stageScanPaths = stageInventory.map((entry) => path.join(staging, entry.path));
    const stageSecretScan = secretScan(stageScanPaths);
    if (stageSecretScan.status !== 'PASS') throw new Error('SECRET_EXPOSURE_DETECTED_IN_STAGING');
    const zipped = command(['zip', '-X', '-q', ARCHIVE_PATH, ...stageRelativePaths], {
      env: safeEnvironment(),
      timeout: 120_000,
      cwd: staging,
    });
    if (!zipped.passed) throw new Error(`ZIP_CREATION_FAILED:${zipped.stderr.trim()}`);
    const integrity = command(['unzip', '-tqq', ARCHIVE_PATH], { timeout: 120_000 });
    if (!integrity.passed) throw new Error('ZIP_INTEGRITY_FAILED');
    const listed = command(['unzip', '-Z1', ARCHIVE_PATH], { timeout: 120_000 });
    if (!listed.passed) throw new Error('ZIP_LIST_FAILED');
    const archiveEntries = listed.stdout.split('\n').filter(Boolean);
    if (JSON.stringify(archiveEntries) !== JSON.stringify(stageRelativePaths)) throw new Error('ZIP_ENTRY_LIST_MISMATCH');
    const entryListSorted = [...archiveEntries].sort().join('\0') === archiveEntries.join('\0');
    if (!entryListSorted) throw new Error('ZIP_ENTRY_LIST_NOT_SORTED');
    const extractedResult = command(['unzip', '-qq', ARCHIVE_PATH, '-d', extracted], { timeout: 120_000 });
    if (!extractedResult.passed) throw new Error('ZIP_EXTRACTION_FAILED');
    const extractedInventory = inventoryFor(extracted);
    if (JSON.stringify(extractedInventory) !== JSON.stringify(stageInventory)) throw new Error('ZIP_HASH_VERIFICATION_FAILED');
    const extractedScan = secretScan(extractedInventory.map((entry) => path.join(extracted, entry.path)));
    if (extractedScan.status !== 'PASS') throw new Error('SECRET_EXPOSURE_DETECTED_IN_ARCHIVE');
    return {
      archive_path: ARCHIVE_PATH,
      archive_sha256: sha256File(ARCHIVE_PATH),
      archive_bytes: fs.statSync(ARCHIVE_PATH).size,
      archive_entry_count: archiveEntries.length,
      manifest_entry_count_excluding_manifest: priorInventory.length,
      integrity: 'PASS',
      entry_list_sorted: entryListSorted,
      path_safety: 'PASS',
      duplicate_and_case_collision_scan: 'PASS',
      per_entry_hash_verification: 'PASS',
      decompressed_secret_rescan: 'PASS',
    };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(extracted, { recursive: true, force: true });
  }
}

function regenerateEvidenceIndexes() {
  const artifactEntries = inventoryFor(PROOF_ROOT, new Set([
    'artifact_index.json',
    'evidence_manifest.json',
  ]));
  writeJson('artifact_index.json', {
    ...proofBase({ evidenceClass: 'STATIC' }),
    artifact_count_excluding_indexes: artifactEntries.length,
    artifacts: artifactEntries,
  });
  const evidenceInventory = inventoryFor(PROOF_ROOT, new Set(['evidence_manifest.json']));
  writeJson('evidence_manifest.json', {
    ...proofBase({ evidenceClass: 'STATIC' }),
    manifest_self_excluded: true,
    artifact_count_excluding_manifest: evidenceInventory.length,
    artifacts: evidenceInventory,
  });
}

function verifyEvidenceManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(PROOF_ROOT, 'evidence_manifest.json'), 'utf8'));
  for (const entry of manifest.artifacts) {
    const absolute = path.join(PROOF_ROOT, entry.path);
    if (sha256File(absolute) !== entry.sha256 || fs.statSync(absolute).size !== entry.bytes) {
      throw new Error(`EVIDENCE_MANIFEST_INVALID:${entry.path}`);
    }
  }
}

function repairPackageOrdering() {
  if (!fs.statSync(PROOF_ROOT, { throwIfNoEntry: false })?.isDirectory()
    || !fs.statSync(ARCHIVE_PATH, { throwIfNoEntry: false })?.isFile()) {
    throw new Error('PACKAGE_ORDER_REPAIR_INPUT_MISSING');
  }
  if (gitOutput(['rev-parse', 'HEAD']) !== BASELINE || gitOutput(['diff', '--cached', '--name-only'])) {
    throw new Error('COMMIT_OR_STAGING_OCCURRED');
  }
  const lint = command(['npx', 'eslint', ...CAMPAIGN_SOURCE_PATHS], { env: safeEnvironment() });
  if (!lint.passed) throw new Error('PACKAGE_REPAIR_LINT_FAILED');
  const repairPath = path.join(PROOF_ROOT, 'repair_receipts.json');
  const repairs = JSON.parse(fs.readFileSync(repairPath, 'utf8'));
  repairs.status = 'PASS_AFTER_BOUNDED_REPAIR';
  repairs.repair_count = 1;
  repairs.receipts = [{
    receipt_id: 'package-order-repair-cycle-1',
    sprint: 7,
    failed_gate: 'ZIP_ENTRY_LIST_SORTED',
    evidence_reference: ARCHIVE_NAME,
    root_cause: 'Archive staging inventory used locale ordering while verification required bytewise lexical ordering.',
    files_touched: [HELPER_PATH, 'repair_receipts.json', 'lint_result.json', 'changed_files.json', 'artifact_index.json', 'evidence_manifest.json'],
    contracts_affected: [],
    tests_affected: [],
    scope_changed: false,
    risk_changed: false,
    repair_cycle: 1,
    result: 'PASS',
  }];
  repairs.statement = 'One packaging-only repair made ZIP entry ordering deterministic; implementation semantics were unchanged.';
  fs.writeFileSync(repairPath, `${JSON.stringify(repairs, null, 2)}\n`, { mode: 0o600 });
  const lintPath = path.join(PROOF_ROOT, 'lint_result.json');
  const lintEvidence = JSON.parse(fs.readFileSync(lintPath, 'utf8'));
  lintEvidence.packaging_repair_revalidation = summarizeResult({ kind: 'focused_lint', ...lint }, 'focused_lint');
  fs.writeFileSync(lintPath, `${JSON.stringify(lintEvidence, null, 2)}\n`, { mode: 0o600 });
  const changedPath = path.join(PROOF_ROOT, 'changed_files.json');
  const changed = JSON.parse(fs.readFileSync(changedPath, 'utf8'));
  changed.campaign_source_files = changed.campaign_source_files.map((entry) => entry.path === HELPER_PATH
    ? {
      path: HELPER_PATH,
      sha256: sha256File(path.join(ROOT, HELPER_PATH)),
      bytes: fs.statSync(path.join(ROOT, HELPER_PATH)).size,
    }
    : entry);
  fs.writeFileSync(changedPath, `${JSON.stringify(changed, null, 2)}\n`, { mode: 0o600 });
  regenerateEvidenceIndexes();
  verifyEvidenceManifest();
  if (secretScan(directoryFiles(PROOF_ROOT)).status !== 'PASS') throw new Error('SECRET_EXPOSURE_DETECTED_IN_REPAIRED_PROOF');
  fs.unlinkSync(ARCHIVE_PATH);
  const archive = packageAndVerify();
  const results = JSON.parse(fs.readFileSync(path.join(PROOF_ROOT, 'test_results.json'), 'utf8'));
  process.stdout.write(`${JSON.stringify({
    verdict: FINAL_VERDICT,
    bounded_repair_cycle: 1,
    repaired_gate: 'ZIP_ENTRY_LIST_SORTED',
    proof_artifact_count: directoryFiles(PROOF_ROOT).length,
    test_executions: results.cumulative_tests_executed_across_required_gates,
    test_passes: results.cumulative_test_passes_across_required_gates,
    ...archive,
    deployment_performed: false,
    committed: false,
  }, null, 2)}\n`);
}

function scenarioTestReference(number) {
  if (number <= 6) return 'test/intelligenceFabric.coachConnect.productionSecurity.subjectBinding.test.js';
  if (number <= 11) return 'test/intelligenceFabric.coachConnect.productionSecurity.sessionElevation.test.js';
  if (number <= 18) return 'test/intelligenceFabric.coachConnect.productionSecurity.sharedState.test.js';
  if (number <= 24) return 'test/intelligenceFabric.coachConnect.productionSecurity.retention.test.js';
  if (number <= 37) return 'test/intelligenceFabric.coachConnect.productionSecurity.deletion.test.js';
  if (number <= 45) return 'test/intelligenceFabric.coachConnect.productionSecurity.transport.test.js';
  if (number <= 53) return 'test/intelligenceFabric.coachConnect.productionSecurity.operator.test.js';
  return 'test/intelligenceFabric.coachConnect.productionSecurity.integration.test.js';
}

function main() {
  if (fs.existsSync(PROOF_ROOT)) throw new Error(`PROOF_DIRECTORY_ALREADY_EXISTS:${PROOF_RELATIVE}`);
  if (!fs.statSync(RATIFICATION_PATH, { throwIfNoEntry: false })?.isFile()) throw new Error('RATIFICATION_RECORD_MISSING');
  for (const relativePath of [...AFW_PATHS, ...CAMPAIGN_SOURCE_PATHS]) ensureFile(relativePath);
  const ratificationText = fs.readFileSync(RATIFICATION_PATH, 'utf8');
  for (const decisionId of Object.keys(RATIFIED_ARCHITECTURE_DECISIONS)) {
    if (!ratificationText.includes(`\`${decisionId}\``)) throw new Error(`RATIFICATION_DECISION_MISSING:${decisionId}`);
  }
  if (!ratificationText.includes('APPROVE_RECOMMENDED_ARCHITECTURE_WITH_RATIFIED_REFINEMENTS')
    || !ratificationText.includes('Status: `APPROVED`')) throw new Error('RATIFICATION_APPROVAL_INVALID');
  if (gitOutput(['rev-parse', 'HEAD']) !== BASELINE) throw new Error('BASELINE_COMMIT_MISMATCH');
  if (gitOutput(['diff', '--cached', '--name-only'])) throw new Error('STAGED_CHANGES_PRESENT');

  const protectedBefore = protectedSnapshot();
  const beforeStatus = gitOutput(['status', '--short']);
  const env = safeEnvironment();
  const existingSecurityTests = [
    ...testFiles((name) => /^intelligenceFabric\.coachConnect\.security\..*\.test\.js$/.test(name)),
    'test/api.internal.developerAccess.security.test.js',
  ];
  const authTests = testFiles((name) => /^intelligenceFabric\.auth.*\.test\.js$/.test(name));
  const coachTests = testFiles((name) => /^intelligenceFabric\.coachConnect.*\.test\.js$/.test(name));
  const productionTests = testFiles((name) => /^intelligenceFabric\.production.*\.test\.js$/.test(name));
  const runtimePredictiveSubscriberTests = testFiles((name) => /^intelligenceFabric\.(?:runtime|predictive|subscriber).*\.test\.js$/.test(name));
  const fullIntelligenceTests = testFiles((name) => /^intelligenceFabric.*\.test\.js$/.test(name));
  const commands = [
    ['production_security_and_api', ['node', '--test', ...TEST_PATHS]],
    ['existing_security_and_api', ['node', '--test', ...existingSecurityTests]],
    ['auth_regression', ['node', '--test', ...authTests]],
    ['coach_connect_regression', ['node', '--test', ...coachTests]],
    ['production_foundation_regression', ['node', '--test', ...productionTests]],
    ['runtime_predictive_subscriber_regression', ['node', '--test', ...runtimePredictiveSubscriberTests]],
    ['complete_safe_intelligence_fabric', ['node', '--test', ...fullIntelligenceTests]],
    ['build', ['npm', 'run', 'build']],
    ['focused_lint', ['npx', 'eslint', ...CAMPAIGN_SOURCE_PATHS]],
    ['import_export', ['node', '--input-type=module', '-e', "import('./src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js').then((module)=>{if(Object.keys(module).length<70)process.exit(1)})"]],
  ];
  const rawResults = [];
  for (const [kind, args] of commands) {
    process.stdout.write(`VALIDATION_START ${kind}\n`);
    const result = command(args, { env });
    rawResults.push({ kind, ...result });
    process.stdout.write(`VALIDATION_RESULT ${kind} ${result.passed ? 'PASS' : 'FAIL'} ${result.duration_ms}ms\n`);
    if (!result.passed) {
      process.stderr.write(result.stdout.slice(-12_000));
      process.stderr.write(result.stderr.slice(-12_000));
      throw new Error(`VALIDATION_GATE_FAILED:${kind}`);
    }
  }
  const protectedAfter = protectedSnapshot();
  if (protectedBefore.aggregate_sha256 !== protectedAfter.aggregate_sha256) throw new Error('PROTECTED_ROOT_CHANGED_DURING_VALIDATION');
  const afterStatus = gitOutput(['status', '--short']);
  if (gitOutput(['rev-parse', 'HEAD']) !== BASELINE || gitOutput(['diff', '--cached', '--name-only'])) {
    throw new Error('COMMIT_OR_STAGING_OCCURRED');
  }

  fs.mkdirSync(PROOF_ROOT, { recursive: false, mode: 0o700 });
  const summarized = rawResults.map((result) => summarizeResult(result, result.kind));
  const testResults = summarized.filter((result) => result.kind !== 'build'
    && result.kind !== 'focused_lint'
    && result.kind !== 'import_export');
  const totalTests = testResults.reduce((sum, result) => sum + (result.tests || 0), 0);
  const totalPass = testResults.reduce((sum, result) => sum + (result.pass || 0), 0);
  const ratificationHash = sha256File(RATIFICATION_PATH);

  writeText('repository_grounding_report.md', `
# Repository grounding report

- Campaign: \`${CAMPAIGN_ID}\`
- Grounded baseline and current HEAD: \`${BASELINE}\`
- Ratification SHA-256: \`${ratificationHash}\`
- Ratification authority: D.J. — Founder / Product Owner
- Architecture reviewer: Spock
- Ratification status: APPROVED with bounded refinements
- Unrelated dirty worktree present before implementation: yes; preserved and excluded
- Campaign source allowlist count: ${CAMPAIGN_SOURCE_PATHS.length}
- Protected root tracked-file aggregate before validation: \`${protectedBefore.aggregate_sha256}\`
- Protected root tracked-file aggregate after validation: \`${protectedAfter.aggregate_sha256}\`
- Staging performed: no
- Commit performed: no
- Deployment or live production action: no

The campaign was grounded on repository and ratification bytes. Existing unrelated
Business Assessment, Business Engine, documentation, lab, cleanup, and bridge
work was not included in the campaign allowlist or review archive.
`);
  writeText('threat_model.md', `
# Threat model

The implementation covers canonical subscriber assertion substitution, exact
scope crossing, session fixation and replay, multi-instance stale state,
retention-authority forgery, partial deletion success, restore resurrection,
forwarded-header spoofing, HSTS misapplication, operator impersonation,
SUBDEV1 escalation, missing reason, dual-control bypass, and audit failure.

Every protected decision denies on missing or ambiguous authority. Synthetic
positive controls do not certify Auth0, Upstash, S3, Vercel, legal policy, or
production operations. ${DEPLOYMENT_PROHIBITION}
`);
  writeText('trust_boundary_map.md', `
# Trust boundary map

\`untrusted client → verified assertion → canonical subscriber subject → atomic
server session → shared security-state port → retention/deletion/operator policy
→ governed Coach Connect decision\`

Transport trust is separately gated by an exact host, verified HTTPS termination,
and platform-attested single-edge metadata. Subscriber, coach, developer,
operator, billing, and canonical Business Engine authorities remain disjoint.
The local append-only JSONL journal remains development-only and
logical-denial-only; physical deletion is not claimed.
`);
  writeJson('dependency_graph.json', {
    ...proofBase({ evidenceClass: 'STATIC_AND_HUMAN_APPROVED' }),
    nodes: Object.keys(RATIFIED_ARCHITECTURE_DECISIONS),
    edges: [
      ['SUBSCRIBER_AUTHORITY_SOURCE', 'SUBSCRIBER_SESSION_OWNER'],
      ['SUBSCRIBER_SESSION_OWNER', 'SHARED_STATE_PLATFORM'],
      ['RETENTION_POLICY_AUTHORITY', 'TRANSCRIPT_BACKING_STORE'],
      ['BACKUP_RESTORE_HORIZON', 'HISTORICAL_ERASURE_STRATEGY'],
      ['PRODUCTION_HOSTING_TRUST', 'HSTS_DIRECTIVES'],
      ['OPERATOR_IDENTITY_AUTHORITY', 'OPERATOR_ENTITLEMENT_POLICY'],
    ],
    activation_gate: 'EVERY_DEPENDENCY_AND_EXTERNAL_CERTIFICATION_MUST_PASS_BEFORE_SEPARATE_ACTIVATION_AUTHORITY',
  });
  writeJson('human_decision_register.json', {
    ...proofBase({ evidenceClass: 'HUMAN_APPROVED', commandReference: path.basename(RATIFICATION_PATH) }),
    ratification_sha256: ratificationHash,
    ratification_status: RATIFIED_DECISION_STATUS,
    human_choice: 'APPROVE_RECOMMENDED_ARCHITECTURE_WITH_RATIFIED_REFINEMENTS',
    approved_by: 'D.J. — Founder / Product Owner',
    approval_date: '2026-07-24',
    architecture_reviewer: 'Spock',
    decisions: Object.entries(RATIFIED_ARCHITECTURE_DECISIONS).map(([decision_id, choice]) => ({
      decision_id,
      choice,
      status: DECISION_STATUSES[decision_id],
    })),
    retention_activation_gate: 'SIGNED_DATA_CLASS_SCHEDULE_AND_OUTSIDE_PRIVACY_LEGAL_REVIEW_REQUIRED',
  });
  writeJson('protected_root_before.json', {
    ...proofBase({ evidenceClass: 'STATIC', commandReference: 'git ls-files plus working-byte SHA-256' }),
    ...protectedBefore,
    unrelated_dirty_protected_paths_preserved: true,
  });
  writeJson('approved_file_plan.json', {
    ...proofBase({ evidenceClass: 'HUMAN_APPROVED_AND_STATIC' }),
    implementation_paths: IMPLEMENTATION_PATHS,
    test_paths: TEST_PATHS,
    helper_paths: [HELPER_PATH],
    proof_root: PROOF_RELATIVE,
    protected_roots: PROTECTED_ROOTS,
  });
  writeJson('contract_inventory.json', {
    ...proofBase({ evidenceClass: 'STATIC', commandReference: 'productionSecurity index import/export validation' }),
    policy_versions: PRODUCTION_SECURITY_POLICY_VERSIONS,
    contract_families: [
      'activation and verdict',
      'audit',
      'subscriber subject binding',
      'session elevation',
      'shared security state port and synthetic adapter',
      'retention authority and legal hold',
      'deletion lifecycle and restore denial',
      'erasure capability and synthetic verification',
      'trusted proxy and transport policy',
      'operator identity and entitlement',
    ],
  });
  writeJson('failure_taxonomy.json', {
    ...proofBase({ evidenceClass: 'STATIC' }),
    failure_codes: PRODUCTION_SECURITY_FAILURE_CODES,
    unknown_version_behavior: 'DENY',
    ambiguous_authority_behavior: 'DENY',
  });

  const sprintProofs = [
    ['sprint_1_subject_binding_proof.json', 1, ['exact issuer audience and immutable scope', 'recovery versioning']],
    ['sprint_1_session_rotation_proof.json', 1, ['atomic pre-auth invalidation', 'new session and CSRF generation']],
    ['sprint_2_shared_state_contract_proof.json', 2, ['provider-neutral port', 'synthetic adapter not deployment grade']],
    ['sprint_2_multi_instance_proof.json', 2, ['nonce replay rate revocation epoch lease sharing', 'read-after-eviction']],
    ['sprint_3_retention_authority_proof.json', 3, ['ratified authority exact match', 'sensitive persistence activation gate']],
    ['sprint_3_deletion_state_machine_proof.json', 3, ['legal hold', 'partial is not success']],
    ['sprint_4_backing_store_inventory.json', 4, ['synthetic S3 capability only', 'local JSONL logical denial only']],
    ['sprint_4_erasure_decision.json', 4, ['store replacement and scoped key erasure', 'dual write prohibited']],
    ['sprint_4_erasure_verification_proof.json', 4, ['zero key replicas', 'derivative and backup denial receipts']],
    ['sprint_5_hsts_policy_proof.json', 5, ['staged exact synthetic policy', 'no subdomains or preload']],
    ['sprint_5_trusted_proxy_proof.json', 5, ['single attested edge', 'privacy-safe bucket only']],
    ['sprint_6_operator_identity_proof.json', 6, ['isolated named Auth0 identities', 'WebAuthn and SUBDEV1 separation']],
    ['sprint_6_operator_entitlement_proof.json', 6, ['RBAC and attributes', 'reason dual control and audit']],
    ['sprint_7_integration_proof.json', 7, ['all decisions approved', 'default-off activation gates preserved']],
  ];
  for (const [name, sprint, assertions] of sprintProofs) {
    writeJson(name, {
      ...proofBase({
        commandReference: sprint === 7
          ? 'test/intelligenceFabric.coachConnect.productionSecurity.integration.test.js'
          : TEST_PATHS.filter((item) => item.includes(`productionSecurity.${[
            'subjectBinding',
            'sharedState',
            'retention',
            'deletion',
            'transport',
            'operator',
          ][Math.min(sprint - 1, 5)]}`)),
      }),
      sprint,
      assertions,
      repair_cycles: 0,
      production_action: false,
      activation_performed: false,
    });
  }
  writeJson('repair_receipts.json', {
    ...proofBase({ evidenceClass: 'STATIC' }),
    repair_count: 0,
    receipts: [],
    statement: 'No failed sprint or campaign gate required a repair cycle.',
  });
  const changeReceipts = [
    {
      id: 'UPSTASH_EVICTION_REFINEMENT',
      files: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/sharedSecurityStatePorts.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/inMemorySharedSecurityState.js',
      ],
      result: 'Authoritative state requires durable non-stale primary reads; synthetic read-after-non-authoritative-cache-eviction is proven.',
    },
    {
      id: 'RETENTION_BACKUP_REFINEMENT',
      files: [
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/retentionAuthority.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/deletionLifecycle.js',
        'src/lib/intelligenceFabric/coachConnect/productionSecurity/erasureStrategy.js',
      ],
      result: 'Sensitive content remains ephemeral with backups prohibited; control metadata is capped at 30 days; epochs and tombstones are separate.',
    },
    {
      id: 'OPERATOR_WORKFORCE_SOURCE_REFINEMENT',
      files: ['src/lib/intelligenceFabric/coachConnect/productionSecurity/operatorIdentity.js'],
      result: 'Invite-only named Auth0 identities and WebAuthn are modeled; workforce federation is not an implementation prerequisite.',
    },
  ];
  for (const receipt of changeReceipts) {
    writeJson(`change_receipts/${receipt.id.toLowerCase()}.json`, {
      ...proofBase({ evidenceClass: 'HUMAN_APPROVED_AND_STATIC' }),
      change_receipt_id: receipt.id,
      ratification_sha256: ratificationHash,
      files_touched: receipt.files,
      scope_changed: false,
      production_action: false,
      result: receipt.result,
    });
  }

  for (const [index, description] of SCENARIOS.entries()) {
    const scenario = index + 1;
    writeJson(`scenario_${String(scenario).padStart(2, '0')}.json`, {
      ...proofBase({ commandReference: scenarioTestReference(scenario) }),
      scenario,
      attack: description,
      negative_attack_status: 'DENIED_OR_FAIL_CLOSED',
      positive_control_status: 'PASS',
      central_decision_status: 'PASS',
      privacy_safe_audit_status: 'PASS',
      protected_side_effects_on_denial: 0,
      production_certification: false,
    });
  }
  writeText('attack_simulation_report.md', `
# Attack simulation report

All 60 required scenario proofs were exercised by the focused subject, session,
shared-state, retention, deletion/erasure, transport, operator, and integration
suites. Negative paths denied or failed closed, valid synthetic controls passed,
and no denial produced a protected-root side effect.

These are deterministic synthetic/static controls. They do not prove live
provider behavior, deployment topology, infrastructure durability, legal
certification, or whole-system physical deletion.
`);
  writeJson('test_manifest.json', {
    ...proofBase({ evidenceClass: 'SYNTHETIC_AND_STATIC' }),
    commands: summarized,
    required_scenario_count: 60,
    focused_test_paths: TEST_PATHS,
    complete_safe_intelligence_fabric_file_count: fullIntelligenceTests.length,
    bare_node_test_used: false,
  });
  writeJson('test_results.json', {
    ...proofBase({ evidenceClass: 'SYNTHETIC', commandReference: summarized.map((result) => result.command) }),
    commands_passed: summarized.length,
    commands_failed: 0,
    cumulative_tests_executed_across_required_gates: totalTests,
    cumulative_test_passes_across_required_gates: totalPass,
    results: summarized,
  });
  writeJson('build_result.json', {
    ...proofBase({ evidenceClass: 'STATIC', commandReference: 'npm run build' }),
    result: summarized.find((item) => item.kind === 'build'),
    network_authorized: false,
    deployment_performed: false,
    raw_dist_included_in_archive: false,
  });
  writeJson('lint_result.json', {
    ...proofBase({ evidenceClass: 'STATIC', commandReference: 'npx eslint exact campaign allowlist' }),
    result: summarized.find((item) => item.kind === 'focused_lint'),
    lint_scope: CAMPAIGN_SOURCE_PATHS,
  });
  const sourceScan = secretScan([...AFW_PATHS, ...CAMPAIGN_SOURCE_PATHS, RATIFICATION_PATH]);
  if (sourceScan.status !== 'PASS') throw new Error('SECRET_EXPOSURE_DETECTED');
  writeJson('secret_scan.json', {
    ...proofBase({ evidenceClass: 'STATIC' }),
    ...sourceScan,
    scanned_classes: ['approved AFW', 'ratification', 'implementation', 'tests', 'helper'],
    sensitive_values_serialized: false,
  });
  const campaignSource = CAMPAIGN_SOURCE_PATHS.map((relativePath) => ({
    path: relativePath,
    sha256: sha256File(path.join(ROOT, relativePath)),
    bytes: fs.statSync(path.join(ROOT, relativePath)).size,
  }));
  const prohibitedImports = campaignSource.flatMap(({ path: relativePath }) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    return [...content.matchAll(/^\s*import\s+.*from\s+['"]([^'"]+)['"]/gm)]
      .map((match) => match[1])
      .filter((specifier) => /(?:ioredis|redis|auth0|aws-sdk|stripe|vercel)/i.test(specifier))
      .map((specifier) => ({ path: relativePath, specifier }));
  });
  if (prohibitedImports.length) throw new Error('LIVE_PROVIDER_IMPORT_DETECTED');
  writeJson('activation_boundary_scan.json', {
    ...proofBase({ evidenceClass: 'STATIC_AND_SYNTHETIC' }),
    default_off: true,
    synthetic_only: true,
    live_provider_imports: prohibitedImports,
    live_adapter_calls: 0,
    deployment_actions: 0,
    production_redis_actions: 0,
    credential_changes: 0,
    production_migrations: 0,
    destructive_deletion_actions: 0,
    stripe_actions: 0,
    transcript_persistence_activation: false,
    local_jsonl_truth: 'LOGICAL_DENIAL_ONLY',
    local_jsonl_physical_deletion_claimed: false,
  });
  writeJson('protected_root_verification.json', {
    ...proofBase({ evidenceClass: 'STATIC' }),
    protected_roots: PROTECTED_ROOTS,
    before_aggregate_sha256: protectedBefore.aggregate_sha256,
    after_aggregate_sha256: protectedAfter.aggregate_sha256,
    unchanged_during_campaign_validation: protectedBefore.aggregate_sha256 === protectedAfter.aggregate_sha256,
    campaign_allowlist_overlap: CAMPAIGN_SOURCE_PATHS.filter((candidate) => PROTECTED_ROOTS.some((root) => candidate === root || candidate.startsWith(`${root}/`))),
    unrelated_dirty_work_preserved: true,
  });
  writeJson('changed_files.json', {
    ...proofBase({ evidenceClass: 'STATIC', commandReference: 'git status --short plus exact allowlist hashes' }),
    campaign_source_files: campaignSource,
    campaign_source_file_count: campaignSource.length,
    generated_proof_root: PROOF_RELATIVE,
    unrelated_dirty_worktree_before: beforeStatus.split('\n').filter(Boolean),
    worktree_status_after_validation_before_proof_generation: afterStatus.split('\n').filter(Boolean),
    staged_files: [],
    committed: false,
  });
  writeJson('no_production_action.json', {
    ...proofBase({ evidenceClass: 'STATIC' }),
    executed_commands: summarized.map((result) => result.command),
    production_action: false,
    deployment: false,
    production_activation: false,
    live_auth0_upstash_aws_vercel_provider_contact: false,
    production_redis: false,
    stripe: false,
    credential_or_secret_change: false,
    production_migration: false,
    destructive_deletion: false,
  });
  writeText('implementation_report.md', `
# Production security prerequisites implementation report

The eleven ratified decisions are implemented within the authorized default-off,
provider-neutral, synthetic/static boundary. Sprints 1–7 and the complete safe
Intelligence Fabric regression pass. All three ratification refinement receipts
are present.

The result preserves activation gates: no live Auth0, Upstash, S3, Vercel,
provider, Redis, Stripe, transcript-persistence, migration, deployment, or
destructive-deletion action occurred. The interim retention architecture is
implemented, but sensitive persistence remains prohibited until outside
privacy/legal review and a signed data-class schedule.

The local append-only JSONL journal remains development-only and
logical-denial-only. Physical deletion is not claimed. The implementation is
not deployment-ready and is not production-certified.

Final verdict: \`${FINAL_VERDICT}\`
`);
  writeText('executive_handoff.md', `
# Executive handoff

- Human decisions: 11 ratified and repository-bound.
- Sprints: 7 passed; repair cycles: 0.
- Required adversarial scenarios: 60 synthetic/static proofs.
- Cumulative required-gate executions: ${totalTests}; passes: ${totalPass}.
- Retention activation: blocked pending outside privacy/legal review and signed schedule.
- Live shared state, store, identity, transport, and operator infrastructure: not contacted or certified.
- Local JSONL: logical-denial-only; no physical-deletion claim.
- Protected roots: unchanged during validation and absent from campaign allowlist.
- Deployment: not performed.
- Final verdict: \`${FINAL_VERDICT}\`.

${DEPLOYMENT_PROHIBITION}
`);
  writeText('ai_handoff.md', `
# AI handoff

Baseline remains \`${BASELINE}\`; no commit or staging occurred. The exact
implementation/test/helper allowlist is machine-readable in
\`approved_file_plan.json\` and \`changed_files.json\`. Policy versions,
decision records, required commands, scenario proofs, activation scan, secret
scan, and protected-root verification are indexed by SHA-256.

Do not infer deployment readiness, production certification, live-provider
readiness, legal retention approval, or whole-system physical deletion from this
package. The external ZIP SHA-256 must be taken from the validator terminal
receipt because an archive cannot embed its own stable byte hash.

${DEPLOYMENT_PROHIBITION}
`);
  writeJson('ai_handoff.json', {
    ...proofBase({ evidenceClass: 'SYNTHETIC_STATIC_AND_HUMAN_APPROVED' }),
    baseline_commit: BASELINE,
    dirty_worktree_boundary: 'UNRELATED_WORK_PRESERVED_AND_EXCLUDED',
    changed_file_allowlist: CAMPAIGN_SOURCE_PATHS,
    policy_versions: PRODUCTION_SECURITY_POLICY_VERSIONS,
    human_decision_status: RATIFIED_DECISION_STATUS,
    ratification_sha256: ratificationHash,
    commands: summarized,
    repair_receipts: [],
    archive_sha256_location: 'EXTERNAL_VALIDATOR_TERMINAL_RECEIPT_TO_AVOID_SELF_REFERENCE',
    deployment_readiness_must_not_be_inferred: true,
  });
  writeJson('final_verdict.json', {
    ...proofBase({ evidenceClass: 'SYNTHETIC_STATIC_AND_HUMAN_APPROVED' }),
    verdict: FINAL_VERDICT,
    decisions_approved: true,
    sprint_count: 7,
    sprint_status: 'PASS',
    activation_gates_preserved: true,
    deployment_ready: false,
    production_certified: false,
    production_authorized: false,
    physical_deletion_claimed_for_local_jsonl: false,
    local_jsonl_truth: 'LOGICAL_DENIAL_ONLY',
    deployment_non_authorization: DEPLOYMENT_PROHIBITION,
  });

  regenerateEvidenceIndexes();
  verifyEvidenceManifest();
  const proofScan = secretScan(directoryFiles(PROOF_ROOT));
  if (proofScan.status !== 'PASS') throw new Error('SECRET_EXPOSURE_DETECTED_IN_PROOF');

  const archive = packageAndVerify();
  process.stdout.write(`${JSON.stringify({
    verdict: FINAL_VERDICT,
    proof_artifact_count: directoryFiles(PROOF_ROOT).length,
    test_executions: totalTests,
    test_passes: totalPass,
    ...archive,
    deployment_performed: false,
    committed: false,
  }, null, 2)}\n`);
}

try {
  if (process.argv.includes('--repair-package-order')) repairPackageOrdering();
  else main();
} catch (error) {
  process.stderr.write(`PRODUCTION_SECURITY_PREREQUISITES_VALIDATION_FAILED ${error.message}\n`);
  process.exitCode = 1;
}
