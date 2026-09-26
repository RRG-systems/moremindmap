// PRIVATE, offline QA custody helper. Root must stop the source runtime first.
// Copies only the local synthetic AOF, never its run receipt or provider logs.
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync,
  readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RUN_PREFIX = '/private/tmp/moremindmap-athlete-flagship-qa-';
const SOURCE_HEAD = '28a1e5f6a57782f829f80c9c2498d2bf63cca081';
const SOURCE_TREE = '1fe444cf6c39ee52823d7b28d64d1cd090172740';
const SOURCE_ATTEMPTS = 15;
const NEW_ATTEMPTS = 8;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 128 * 1024 * 1024;
const AOF_NAME = /^appendonly\.aof\.([1-9]\d{0,8})\.(?:base\.(?:rdb|aof)|incr\.aof)$/u;
const HASH = /^[a-f0-9]{64}$/u;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const deny = code => { throw new Error(`ATHLETE_QA_FORK_${code}`); };
const fingerprint = stat => [stat.dev, stat.ino, stat.uid, stat.mode, stat.nlink,
  stat.size, stat.mtimeMs, stat.ctimeMs].join(':');

function privateDirectory(path, code) {
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid()
    || (stat.mode & 0o777) !== 0o700 || realpathSync(path) !== path) deny(code);
  return stat;
}

function runDirectory(path, code) {
  if (typeof path !== 'string' || !path.startsWith(RUN_PREFIX)
    || resolve(path) !== path
    || !/^[A-Za-z0-9_-]{6,80}$/u.test(path.slice(RUN_PREFIX.length))) deny(code);
  return privateDirectory(path, code);
}

function privateFile(path, limit = MAX_FILE_BYTES) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid()
    || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1
    || stat.size > limit) deny('FILE_DENIED');
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (fingerprint(fstatSync(fd)) !== fingerprint(stat)) deny('SOURCE_CHANGED');
    const bytes = readFileSync(fd);
    if (fingerprint(fstatSync(fd)) !== fingerprint(stat)
      || fingerprint(lstatSync(path)) !== fingerprint(stat)) deny('SOURCE_CHANGED');
    return { bytes, stat, hash: sha(bytes) };
  } finally { closeSync(fd); }
}

function parseJson(bytes, code) {
  try { return JSON.parse(bytes.toString('utf8')); } catch { deny(code); }
}

function inspectSource(sourceDir) {
  const directoryStat = runDirectory(sourceDir, 'SOURCE_DIR_DENIED');
  const names = readdirSync(sourceDir).sort();
  if (JSON.stringify(names) !== JSON.stringify(['appendonlydir', 'receipts.jsonl', 'run.json']))
    deny('SOURCE_CONTENTS_DENIED');
  const run = privateFile(join(sourceDir, 'run.json'), 16384);
  const metadata = parseJson(run.bytes, 'SOURCE_CUSTODY_DENIED');
  if (metadata?.schema !== 'more.athlete.flagship.loopback-run/v1'
    || metadata.synthetic_only !== true || metadata.local_redis_only !== true
    || metadata.head !== SOURCE_HEAD || metadata.tree !== SOURCE_TREE
    || !HASH.test(metadata.build_sha256 || '') || metadata.model_call_limit !== 16)
    deny('SOURCE_CUSTODY_DENIED');
  const receipts = privateFile(join(sourceDir, 'receipts.jsonl'), 4 * 1024 * 1024);
  const attempts = [];
  for (const line of receipts.bytes.toString('utf8').split('\n').filter(Boolean)) {
    const record = parseJson(Buffer.from(line), 'SOURCE_BUDGET_DENIED');
    if (record.kind === 'model_invocation' && record.status === 'attempted') {
      if (!Number.isSafeInteger(record.ordinal)) deny('SOURCE_BUDGET_DENIED');
      attempts.push(record.ordinal);
    }
  }
  if (attempts.length !== SOURCE_ATTEMPTS
    || attempts.some((ordinal, index) => ordinal !== index + 1)) deny('SOURCE_BUDGET_DENIED');
  const aofDir = join(sourceDir, 'appendonlydir');
  const aofStat = privateDirectory(aofDir, 'AOF_DIR_DENIED');
  const aofNames = readdirSync(aofDir).sort();
  if (aofNames.length < 3 || aofNames.length > 64
    || !aofNames.includes('appendonly.aof.manifest')
    || aofNames.some(name => name !== 'appendonly.aof.manifest' && !AOF_NAME.test(name)))
    deny('AOF_CONTENTS_DENIED');
  const files = new Map(aofNames.map(name => [name, privateFile(join(aofDir, name),
    name === 'appendonly.aof.manifest' ? 16384 : MAX_FILE_BYTES)]));
  if ([...files.values()].reduce((total, file) => total + file.bytes.length, 0) > MAX_TOTAL_BYTES)
    deny('AOF_TOO_LARGE');
  const manifestNames = [];
  let bases = 0, increments = 0;
  for (const line of files.get('appendonly.aof.manifest').bytes.toString('utf8').split('\n').filter(Boolean)) {
    const match = /^file (appendonly\.aof\.([1-9]\d{0,8})\.(base\.(?:rdb|aof)|incr\.aof)) seq ([1-9]\d{0,8}) type ([bi])$/u.exec(line);
    if (!match || match[2] !== match[4]
      || (match[3].startsWith('base.') ? match[5] !== 'b' : match[5] !== 'i'))
      deny('AOF_MANIFEST_DENIED');
    manifestNames.push(match[1]);
    if (match[5] === 'b') bases++; else increments++;
  }
  if (bases !== 1 || increments < 1 || new Set(manifestNames).size !== manifestNames.length
    || JSON.stringify(manifestNames.sort())
      !== JSON.stringify(aofNames.filter(name => name !== 'appendonly.aof.manifest')))
    deny('AOF_MANIFEST_DENIED');
  return { directoryStat, aofStat, files, run, receipts, metadata };
}

function sourceUnchanged(sourceDir, original) {
  const current = inspectSource(sourceDir);
  if (fingerprint(current.directoryStat) !== fingerprint(original.directoryStat)
    || fingerprint(current.aofStat) !== fingerprint(original.aofStat)
    || current.run.hash !== original.run.hash || current.receipts.hash !== original.receipts.hash
    || [...original.files].some(([name, file]) => current.files.get(name)?.hash !== file.hash
      || fingerprint(current.files.get(name)?.stat) !== fingerprint(file.stat)))
    deny('SOURCE_CHANGED');
}

export function forkSyntheticRun({ sourceDir, targetDir } = {}) {
  try {
    const source = inspectSource(sourceDir);
    const targetStat = runDirectory(targetDir, 'TARGET_DIR_DENIED');
    if (sourceDir === targetDir || readdirSync(targetDir).length) deny('TARGET_NOT_FRESH');
    // Recheck the target immediately before the first write. All writes are
    // create-only; a failed copy is preserved for root inspection, never erased.
    if (fingerprint(lstatSync(targetDir)) !== fingerprint(targetStat)
      || readdirSync(targetDir).length) deny('TARGET_NOT_FRESH');
    const targetAof = join(targetDir, 'appendonlydir');
    mkdirSync(targetAof, { mode: 0o700 });
    for (const [name, file] of source.files)
      writeFileSync(join(targetAof, name), file.bytes, { flag: 'wx', mode: 0o600 });
    sourceUnchanged(sourceDir, source);
    for (const [name, file] of source.files)
      if (privateFile(join(targetAof, name)).hash !== file.hash) deny('COPY_HASH_MISMATCH');
    return Object.freeze({ schema: 'more.athlete.flagship.synthetic-fork/v1',
      source_dir: sourceDir, target_dir: targetDir,
      ancestor: Object.freeze({ head: source.metadata.head, tree: source.metadata.tree,
        build_sha256: source.metadata.build_sha256, run_json_sha256: source.run.hash,
        receipts_sha256: source.receipts.hash, model_call_limit: 16 }),
      source_aof_sha256: Object.freeze(Object.fromEntries([...source.files]
        .map(([name, file]) => [name, file.hash]))),
      source_unchanged: true, copied_bytes: [...source.files.values()]
        .reduce((total, file) => total + file.bytes.length, 0),
      prior_model_call_count: SOURCE_ATTEMPTS, model_call_limit: NEW_ATTEMPTS,
      cumulative_model_call_limit: SOURCE_ATTEMPTS + NEW_ATTEMPTS,
      synthetic_only: true, local_redis_only: true });
  } catch (error) {
    if (/^ATHLETE_QA_FORK_[A-Z_]+$/u.test(error?.message || '')) throw error;
    deny('IO_DENIED');
  }
}
