import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

const root = process.cwd();
const base = '5be9a3ae517a5ca245693b1bebbb73b107faf045';
const docs = resolve(root, 'docs/recruiting-two-box-consulting-v1');
const packageRoot = resolve(root, 'docs/recruiting-two-box-consulting-v1-sealed-package');
const zip = resolve(root, 'docs/RECRUITING_TWO_BOX_CONSULTING_V1_EVIDENCE.zip');
const git = (...args) => execFileSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = (value) => createHash('sha256').update(value).digest('hex');
if (git('rev-parse', 'HEAD') !== base || git('branch', '--show-current') !== 'codex/recruiting-two-box-consulting-v1') throw new Error('SEAL_CUSTODY_DRIFT');
const statusBeforeSeal = git('status', '--porcelain=v1', '--untracked-files=all');
const validation = JSON.parse(await readFile(resolve(docs, 'validation/summary.json'), 'utf8'));
if (!validation.results.length || validation.results.some((item) => item.exit_code !== 0)) throw new Error('SEAL_VALIDATION_NOT_GREEN');
// The seal is intentionally one-shot. Never overwrite a previously sealed package.
await mkdir(packageRoot);
const changed = git('diff', '--name-only', base).split('\n').filter(Boolean);
const added = git('ls-files', '--others', '--exclude-standard').split('\n').filter((p) => /^(src\/|api\/|test\/|scripts\/recruiting-two-box-review\/)/.test(p));
const sourceFiles = [...new Set([...changed, ...added])].sort();
if (sourceFiles.some((p) => /(^|\/)\.env|\.pem$|\.key$/.test(p))) throw new Error('SEAL_SECRET_PATH_REFUSED');
const inventory = [];
for (const path of sourceFiles) {
  const bytes = await readFile(resolve(root, path));
  inventory.push({ path, kind: changed.includes(path) ? 'modified' : 'added', sha256: hash(bytes), bytes: bytes.length });
  await mkdir(dirname(resolve(packageRoot, 'source', path)), { recursive: true });
  await cp(resolve(root, path), resolve(packageRoot, 'source', path));
}
await cp(docs, resolve(packageRoot, 'evidence'), { recursive: true });
await writeFile(resolve(packageRoot, 'tracked-source.patch'), execFileSync('/usr/bin/git', ['diff', '--binary', base], { cwd: root }));
const custody = { sealed_at: new Date().toISOString(), worktree: root, branch: git('branch', '--show-current'), head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), initial_state: 'clean', final_source_state: 'authorized uncommitted candidate; no commits or staging', tracked_source_changes: changed, added_source_files: added, source_inventory: inventory, exact_status_before_seal: statusBeforeSeal };
await writeFile(resolve(packageRoot, 'CUSTODY_AND_SOURCE_INVENTORY.json'), JSON.stringify(custody, null, 2));
async function walk(dir) {
  const entries = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) entries.push(...await walk(path));
    else if (entry.isFile()) entries.push(path);
    else throw new Error('SEAL_NONREGULAR_FILE');
  }
  return entries;
}
const manifest = [];
for (const file of (await walk(packageRoot)).sort()) { const bytes = await readFile(file); manifest.push({ path: relative(packageRoot, file), bytes: bytes.length, sha256: hash(bytes) }); }
await writeFile(resolve(packageRoot, 'MANIFEST.json'), JSON.stringify({ algorithm: 'SHA-256', excludes_self: true, files: manifest }, null, 2));
execFileSync('/usr/bin/zip', ['-qr', zip, '.'], { cwd: packageRoot });
execFileSync('/usr/bin/unzip', ['-t', zip], { encoding: 'utf8' });
for (const entry of manifest) {
  const bytes = execFileSync('/usr/bin/unzip', ['-p', zip, entry.path], { maxBuffer: 32 * 1024 * 1024 });
  if (hash(bytes) !== entry.sha256) throw new Error(`PACKAGE_HASH_MISMATCH:${entry.path}`);
}
const manifestBytes = await readFile(resolve(packageRoot, 'MANIFEST.json'));
if (!execFileSync('/usr/bin/unzip', ['-p', zip, 'MANIFEST.json'], { maxBuffer: 32 * 1024 * 1024 }).equals(manifestBytes)) throw new Error('PACKAGE_MANIFEST_MISMATCH');
const zipFiles = execFileSync('/usr/bin/unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n').filter((path) => !path.endsWith('/')).sort();
const expectedFiles = [...manifest.map((entry) => entry.path), 'MANIFEST.json'].sort();
if (JSON.stringify(zipFiles) !== JSON.stringify(expectedFiles)) throw new Error('PACKAGE_ENTRY_SET_MISMATCH');
for (const entry of inventory) {
  if (hash(await readFile(resolve(root, entry.path))) !== entry.sha256) throw new Error(`SOURCE_DRIFT_DURING_SEAL:${entry.path}`);
}
const zipHash = hash(await readFile(zip));
await writeFile(`${zip}.sha256`, `${zipHash}  ${zip.split('/').at(-1)}\n`);
await writeFile(`${zip}.verification.json`, JSON.stringify({ verified_at: new Date().toISOString(), zip, sha256: zipHash, manifest_file_count: manifest.length, source_file_count: sourceFiles.length, all_packaged_bytes_rehashed: true, zip_integrity: 'PASS', head_unchanged: git('rev-parse', 'HEAD') === base }, null, 2));
console.log(JSON.stringify({ zip, sha256: zipHash, source_files: sourceFiles.length, manifest_files: manifest.length, integrity: 'PASS' }));
