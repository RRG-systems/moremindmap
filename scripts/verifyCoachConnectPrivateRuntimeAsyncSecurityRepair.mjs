#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(
  root,
  'lab_outputs/coach_connect_private_runtime_async_security_repair_v1',
);
const expectedHead = '46308958085fb84cd3ff6f2f081b8f2944774ecd';
const expectedArchitectureSha = '8c117ab7e40fde69536d67d43558e69dfa3d078f10eaeb0ff88105cfa9117046';
const expectedAfwSha = '40174c1a9b628fcf5030f69c17aae2bbc997ad874eac01f080b7cc9030b8cbef';
const expectedProtectedSha = '46fc2b3f8346c7ec3c584c1c5ed46818dc97fa5c52d1ba89f10c0a0ed1ad2a12';

const implementationFiles = [
  'api/internal/developer-access.js',
  'api/internal/private-runtime-bootstrap.js',
  'api/internal/private-runtime-callback.js',
  'api/internal/private-runtime-login.js',
  'api/internal/private-runtime-logout.js',
  'api/internal/private-runtime-session.js',
  'api/internal/subscription-entitlement.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/developerAccessSecurityFacade.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/eligibility.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js',
  'src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSharedSecurityStatePort.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js',
  'src/lib/intelligenceFabric/coachConnect/productionSecurity/syntheticAsyncSecurityStateAdapter.js',
];

const testFiles = [
  'test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.adversarial.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.contracts.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.developerAccess.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.entitlement.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.handlers.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.integration.test.js',
  'test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.recovery.test.js',
];

const exactCampaignCodeFiles = new Set([
  ...implementationFiles,
  ...testFiles,
  'scripts/verifyCoachConnectPrivateRuntimeAsyncSecurityRepair.mjs',
]);

const protectedRoots = [
  'src/lib/businessEngine',
  'src/lib/businessAssessment',
  'api/engine',
  'api/business-assessment',
  'src/lib/intelligenceFabric/production',
  'src/lib/intelligenceFabric/coachConnect/activation.js',
  'src/lib/intelligenceFabric/coachConnect/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/service.js',
  'src/lib/intelligenceFabric/coachConnect/stateMachines.js',
  'src/lib/intelligenceFabric/coachConnect/projections.js',
  'src/lib/intelligenceFabric/coachConnect/liveSession',
  'src/lib/intelligenceFabric/coachConnect/internalDeployment',
  'src/lib/intelligenceFabric/coachConnect/deploymentReadiness',
  'api/stripe',
  'src/lib/stripe',
  'vercel.json',
  'package.json',
  'package-lock.json',
  'src/components/businessAssessment',
];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = (file) => sha256(fs.readFileSync(file));
const relative = (file) => path.relative(root, file).split(path.sep).join('/');

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function walk(target, files = []) {
  if (!fs.existsSync(target)) return files;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error(`symlink prohibited: ${relative(target)}`);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target).sort()) {
      walk(path.join(target, entry), files);
    }
  } else if (stat.isFile()) {
    files.push(target);
  }
  return files;
}

function protectedDigest() {
  const files = protectedRoots.flatMap((entry) => walk(path.join(root, entry))).sort();
  const material = files
    .map((file) => `${relative(file)}\0${fileSha(file)}`)
    .join('\n');
  return {
    file_count: files.length,
    sha256: sha256(material),
  };
}

function gitStatusPaths() {
  const result = run('git', ['status', '--porcelain=v1', '-z']);
  if (result.status !== 0) throw new Error('git status failed');
  return result.stdout.split('\0').filter(Boolean).map((entry) => {
    const candidate = entry.slice(3);
    return candidate.includes(' -> ') ? candidate.split(' -> ').at(-1) : candidate;
  });
}

function validateJsonEvidence() {
  const jsonFiles = walk(evidenceRoot)
    .filter((file) => file.endsWith('.json'))
    .sort();
  for (const file of jsonFiles) JSON.parse(fs.readFileSync(file, 'utf8'));
  return jsonFiles.map(relative);
}

function validateSprintReceipts() {
  const receipts = [];
  for (let sprint = 1; sprint <= 7; sprint += 1) {
    const file = path.join(evidenceRoot, `sprint_${sprint}/sprint_receipt.json`);
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (value.verdict !== `PRIVATE_RUNTIME_ASYNC_SECURITY_SPRINT_${sprint}_COMPLETE`) {
      throw new Error(`Sprint ${sprint} verdict invalid`);
    }
    if (value.provider_call_count !== 0 || value.git_index_empty !== true) {
      throw new Error(`Sprint ${sprint} boundary evidence invalid`);
    }
    receipts.push(value);
  }
  return receipts;
}

function validateCodeAllowlist(statusPaths) {
  const campaignCandidates = statusPaths.filter((entry) => (
    entry.includes('privateRuntime/async')
    || entry.includes('privateRuntime/canonicalAsync')
    || entry.includes('privateRuntime/developerAccess')
    || entry.includes('privateRuntime/eligibility')
    || entry.includes('privateRuntime/liveComposition')
    || entry.includes('privateRuntime/index.js')
    || entry.includes('productionSecurity/async')
    || entry.includes('productionSecurity/syntheticAsync')
    || entry.includes('productionSecurity/index.js')
    || entry.startsWith('api/internal/private-runtime-')
    || entry === 'api/internal/developer-access.js'
    || entry === 'api/internal/subscription-entitlement.js'
    || entry.startsWith('test/intelligenceFabric.coachConnect.privateRuntime.asyncSecurity.')
    || entry === 'scripts/verifyCoachConnectPrivateRuntimeAsyncSecurityRepair.mjs'
  ));
  const outside = campaignCandidates.filter((entry) => !exactCampaignCodeFiles.has(entry));
  if (outside.length) throw new Error(`campaign code outside allowlist: ${outside.join(',')}`);
  const missing = [...exactCampaignCodeFiles].filter((entry) => !fs.existsSync(path.join(root, entry)));
  if (missing.length) throw new Error(`campaign code missing: ${missing.join(',')}`);
  return {
    campaign_code_files: [...exactCampaignCodeFiles].sort(),
    outside_campaign_allowlist: outside,
    unrelated_preexisting_paths_excluded: statusPaths
      .filter((entry) => !campaignCandidates.includes(entry)
        && !entry.startsWith('lab_outputs/coach_connect_private_runtime_async_security_repair_v1/'))
      .sort(),
  };
}

function validateStaticBoundaries() {
  const implementationSource = implementationFiles
    .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
    .join('\n');
  const handlerFiles = implementationFiles.filter((file) => file.startsWith('api/internal/'));
  for (const file of handlerFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (/SyntheticAsyncSecurityStateAdapter|AsyncSecurityStatePortV2/.test(source)) {
      throw new Error(`handler-to-adapter edge: ${file}`);
    }
  }
  const forbiddenImports = [
    /from\s+['"]ioredis['"]/,
    /from\s+['"]@upstash\//,
    /from\s+['"]stripe['"]/,
    /from\s+['"]@auth0\//,
    /from\s+['"]@vercel\//,
  ];
  if (forbiddenImports.some((pattern) => pattern.test(implementationSource))) {
    throw new Error('provider or deployment import found');
  }
  if (/\bfetch\s*\(|\baxios\s*\(|\bredis\.(?:get|set|eval)\s*\(/i.test(implementationSource)) {
    throw new Error('network/provider call found');
  }
  const serviceSource = fs.readFileSync(
    path.join(root, 'src/lib/intelligenceFabric/coachConnect/privateRuntime/canonicalAsyncSecurityService.js'),
    'utf8',
  );
  const resolution = serviceSource.slice(
    serviceSource.indexOf('async resolveAuthenticatedContext'),
    serviceSource.indexOf('async evaluatePrivateTestEligibility'),
  );
  if (/BIND_APPROVED_CANONICAL_SUBJECT|executeAtomic/.test(resolution)) {
    throw new Error('runtime canonical enrollment found');
  }
  return {
    handler_to_adapter_edges: 0,
    provider_imports: 0,
    external_calls: 0,
    runtime_enrollment_commands: 0,
  };
}

function importGraph() {
  const nodes = [...exactCampaignCodeFiles]
    .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'));
  const graph = new Map(nodes.map((file) => [file, []]));
  for (const file of nodes) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const matches = source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g);
    for (const match of matches) {
      let resolved = relative(path.resolve(path.dirname(path.join(root, file)), match[1]));
      if (!path.extname(resolved)) resolved += '.js';
      if (graph.has(resolved)) graph.get(file).push(resolved);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node)) throw new Error(`dependency cycle at ${node}`);
    if (visited.has(node)) return;
    visiting.add(node);
    for (const child of graph.get(node) || []) visit(child);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of graph.keys()) visit(node);
  return { nodes: graph.size, cycles: 0 };
}

function archiveSafety(archivePath) {
  if (!archivePath) return null;
  const absolute = path.resolve(root, archivePath);
  const integrity = run('unzip', ['-t', absolute]);
  if (integrity.status !== 0) throw new Error('archive integrity failed');
  const listing = run('unzip', ['-Z1', absolute]);
  if (listing.status !== 0) throw new Error('archive listing failed');
  const entries = listing.stdout.split(/\r?\n/).filter(Boolean);
  const duplicates = entries.filter((entry, index) => entries.indexOf(entry) !== index);
  const lower = entries.map((entry) => entry.toLowerCase());
  const caseCollisions = entries.filter((entry, index) => lower.indexOf(entry.toLowerCase()) !== index);
  const unsafe = entries.filter((entry) => (
    entry.startsWith('/')
    || entry.split('/').includes('..')
    || /^[A-Za-z]:[\\/]/.test(entry)
  ));
  if (duplicates.length || caseCollisions.length || unsafe.length) {
    throw new Error('archive path safety failed');
  }
  return {
    path: relative(absolute),
    sha256: fileSha(absolute),
    entries: entries.length,
    duplicates: 0,
    case_collisions: 0,
    unsafe_paths: 0,
    integrity: 'PASS',
  };
}

async function main() {
  const architecturePath = path.join(
    root,
    'MORE_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_ARCHITECTURE_REPAIR_V1.md',
  );
  const afwPath = path.join(
    root,
    'PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_AFW_REVIEW_V1.zip',
  );
  if (fileSha(architecturePath) !== expectedArchitectureSha) {
    throw new Error('architecture hash mismatch');
  }
  if (!fs.readFileSync(architecturePath, 'utf8')
    .includes('PRIVATE_RUNTIME_ASYNC_SECURITY_ENTITLEMENT_ARCHITECTURE_REPAIRED')) {
    throw new Error('architecture verdict mismatch');
  }
  if (fileSha(afwPath) !== expectedAfwSha || run('unzip', ['-t', afwPath]).status !== 0) {
    throw new Error('AFW package mismatch');
  }
  const head = run('git', ['rev-parse', 'HEAD']).stdout.trim();
  if (head !== expectedHead) throw new Error('HEAD mismatch');
  const staged = run('git', ['diff', '--cached', '--name-only']).stdout.trim();
  if (staged) throw new Error('Git index is not empty');
  const protectedResult = protectedDigest();
  if (protectedResult.sha256 !== expectedProtectedSha) throw new Error('protected roots changed');
  const statusPaths = gitStatusPaths();
  const allowlist = validateCodeAllowlist(statusPaths);
  const staticBoundaries = validateStaticBoundaries();
  const jsonEvidence = validateJsonEvidence();
  const sprintReceipts = validateSprintReceipts();
  const graph = importGraph();
  const archiveArgIndex = process.argv.indexOf('--archive');
  const archive = archiveArgIndex >= 0
    ? archiveSafety(process.argv[archiveArgIndex + 1])
    : null;
  const result = {
    verifier_version: 'coach-connect-private-runtime-async-security-repair-verifier-v1',
    campaign_id: 'MORE_CAMPAIGN_PRIVATE_RUNTIME_ASYNC_SECURITY_AND_ENTITLEMENT_BOOTSTRAP_V1',
    result: 'PASS',
    architecture_sha256: expectedArchitectureSha,
    afw_sha256: expectedAfwSha,
    repository_head: head,
    git_index_empty: true,
    protected_roots: protectedResult,
    allowlist,
    static_boundaries: staticBoundaries,
    sprint_verdicts: sprintReceipts.map((receipt) => receipt.verdict),
    json_evidence_files: jsonEvidence.length,
    import_graph: graph,
    archive,
    provider_calls: 0,
    credential_reads: 0,
    environment_changes: 0,
    deployment_calls: 0,
    staging_actions: 0,
    commit_actions: 0,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    verifier_version: 'coach-connect-private-runtime-async-security-repair-verifier-v1',
    result: 'FAIL',
    error: error.message,
  }, null, 2)}\n`);
  process.exitCode = 1;
});
