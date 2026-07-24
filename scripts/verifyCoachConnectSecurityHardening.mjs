import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repository = path.resolve(new URL('..', import.meta.url).pathname);
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const scope = valueAfter('--scope') || 'all';
const proofRoot = valueAfter('--proof-root');
const zipPath = valueAfter('--zip');

const sourcePaths = [
  'api/internal/developer-access-security.js',
  'api/internal/developer-access.js',
  'api/internal/subscription-entitlement.js',
  'src/components/businessAssessment/DeveloperAccessPanel.jsx',
  'src/lib/intelligenceFabric/coachConnect/security',
  'src/lib/intelligenceFabric/coachConnect/liveSession/service.js',
  'src/lib/intelligenceFabric/coachConnect/liveSession/durable/contracts.js',
  'src/lib/intelligenceFabric/coachConnect/liveSession/durable/adapter.js',
  'src/lib/intelligenceFabric/coachConnect/liveSession/durable/checkpointReplay.js',
  'src/lib/intelligenceFabric/coachConnect/liveSession/durable/localJsonlDriver.js',
  'src/lib/intelligenceFabric/coachConnect/liveSession/durable/service.js',
  'test/intelligenceFabric.coachConnect.security.contracts.test.js',
  'test/intelligenceFabric.coachConnect.security.policy.test.js',
  'test/intelligenceFabric.coachConnect.security.requestIntegrity.test.js',
  'test/intelligenceFabric.coachConnect.security.abuse.test.js',
  'test/intelligenceFabric.coachConnect.security.privacy.test.js',
  'test/intelligenceFabric.coachConnect.security.retention.test.js',
  'test/intelligenceFabric.coachConnect.security.adversarial.test.js',
  'test/api.internal.developerAccess.security.test.js',
  'scripts/verifyCoachConnectSecurityHardening.mjs',
];

const clientPaths = [
  'src/components/businessAssessment/DeveloperAccessPanel.jsx',
  'dist',
];

const forbiddenPatterns = [
  { category: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g },
  { category: 'OPENAI_STYLE_SECRET', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { category: 'BEARER_CREDENTIAL', regex: /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/-]{12,}/gi },
  { category: 'REDIS_CREDENTIAL_URL', regex: /\brediss?:\/\/[^/\s:@]+:[^@\s/]+@/gi },
  { category: 'RAW_COOKIE_VALUE', regex: /\b(?:__Host-)?coach_connect_dev_capability=[A-Za-z0-9_-]{24,}/g },
];

const sensitiveValues = [
  process.env.COACH_CONNECT_DEVELOPER_ACCESS_CODE,
  process.env.COACH_CONNECT_DEVELOPER_ACCESS_TOKEN_PEPPER,
  process.env.COACH_CONNECT_DEVELOPER_ACCESS_SIGNING_SECRET,
  process.env.COACH_CONNECT_SECURITY_SCAN_TRANSCRIPT_CANARY,
].filter((value) => typeof value === 'string' && value.length >= 8);

const digest = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const findings = [];
let scannedFiles = 0;
let scannedBytes = 0;

function recordFinding(category, safePath, buffer) {
  findings.push({ category, path: safePath, file_sha256: digest(buffer) });
}

function scanBuffer(buffer, safePath) {
  scannedFiles += 1;
  scannedBytes += buffer.length;
  const text = buffer.toString('utf8');
  for (const pattern of forbiddenPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) recordFinding(pattern.category, safePath, buffer);
  }
  for (const value of sensitiveValues) {
    if (buffer.includes(Buffer.from(value))) recordFinding('CONFIGURED_SECRET_VALUE', safePath, buffer);
  }
}

function walk(target, safeBase = repository) {
  if (!fs.existsSync(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) {
    findings.push({ category: 'SYMLINK_NOT_SCANNED', path: path.relative(safeBase, target), file_sha256: null });
    return;
  }
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target).sort()) walk(path.join(target, entry), safeBase);
    return;
  }
  if (stat.isFile()) scanBuffer(fs.readFileSync(target), path.relative(safeBase, target));
}

function scanZip(archive) {
  if (!archive || !fs.existsSync(archive)) {
    findings.push({ category: 'ZIP_UNAVAILABLE', path: archive || '[missing]', file_sha256: null });
    return { entry_count: 0, entries: [] };
  }
  const listed = spawnSync('unzip', ['-Z', '-1', archive], { encoding: 'utf8' });
  if (listed.status !== 0) {
    findings.push({ category: 'ZIP_UNREADABLE', path: path.basename(archive), file_sha256: digest(fs.readFileSync(archive)) });
    return { entry_count: 0, entries: [] };
  }
  const entries = listed.stdout.split('\n').filter(Boolean);
  const seen = new Set();
  for (const entry of entries) {
    const normalized = path.posix.normalize(entry);
    const lower = normalized.toLowerCase();
    if (normalized.startsWith('../') || normalized.startsWith('/') || normalized !== entry || seen.has(lower)) {
      findings.push({ category: 'ZIP_PATH_UNSAFE', path: entry, file_sha256: null });
      continue;
    }
    seen.add(lower);
    if (entry.endsWith('/')) continue;
    const extracted = spawnSync('unzip', ['-p', archive, entry]);
    if (extracted.status !== 0) {
      findings.push({ category: 'ZIP_ENTRY_UNREADABLE', path: entry, file_sha256: null });
      continue;
    }
    scanBuffer(extracted.stdout, `zip:${entry}`);
  }
  return { entry_count: entries.filter((entry) => !entry.endsWith('/')).length, entries };
}

if (scope === 'source' || scope === 'all') {
  for (const relative of sourcePaths) walk(path.join(repository, relative));
}
if (scope === 'client' || scope === 'all') {
  for (const relative of clientPaths) walk(path.join(repository, relative));
}
if ((scope === 'proof' || scope === 'all') && proofRoot) walk(path.resolve(proofRoot), path.resolve(proofRoot));
const zip = (scope === 'zip' || scope === 'all') && zipPath ? scanZip(path.resolve(zipPath)) : null;

const uniqueFindings = [...new Map(findings.map((finding) => [`${finding.category}:${finding.path}`, finding])).values()];
const report = {
  report_version: '1.0.0',
  campaign: 'COACH_CONNECT_SECURITY_AND_PRIVACY_HARDENING_V1',
  evidence_class: 'STATIC',
  scope,
  status: uniqueFindings.length ? 'FAIL' : 'PASS',
  scanned_files: scannedFiles,
  scanned_bytes: scannedBytes,
  configured_secret_value_count: sensitiveValues.length,
  findings: uniqueFindings,
  zip,
  limitations: [
    'Pattern and configured-value scan is not external penetration testing',
    'Environment files are not printed or packaged',
    'Passing does not establish deployment readiness or production certification',
  ],
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (uniqueFindings.length) process.exitCode = 1;
