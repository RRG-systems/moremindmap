import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { forkSyntheticRun } from '../scripts/athlete-consulting-v2-review/fork-synthetic-run.mjs';

const prefix = '/private/tmp/moremindmap-athlete-flagship-qa-';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const custody = { schema: 'more.athlete.flagship.loopback-run/v1',
  head: '28a1e5f6a57782f829f80c9c2498d2bf63cca081',
  tree: '1fe444cf6c39ee52823d7b28d64d1cd090172740', build_sha256: 'a'.repeat(64),
  model_call_limit: 16, synthetic_only: true, local_redis_only: true };
const base = 'appendonly.aof.1.base.rdb';
const incr = 'appendonly.aof.1.incr.aof';
const manifest = 'appendonly.aof.manifest';
const privateWrite = (path, data) => writeFileSync(path, data, { flag: 'wx', mode: 0o600 });

function fixture(t) {
  const sourceDir = mkdtempSync(prefix), targetDir = mkdtempSync(prefix);
  chmodSync(sourceDir, 0o700); chmodSync(targetDir, 0o700);
  t.after(() => { rmSync(sourceDir, { recursive: true }); rmSync(targetDir, { recursive: true }); });
  const aof = join(sourceDir, 'appendonlydir');
  mkdirSync(aof, { mode: 0o700 });
  privateWrite(join(sourceDir, 'run.json'), JSON.stringify(custody));
  privateWrite(join(sourceDir, 'receipts.jsonl'), Array.from({ length: 15 }, (_, index) =>
    JSON.stringify({ kind: 'model_invocation', ordinal: index + 1, status: 'attempted' })).join('\n') + '\n');
  privateWrite(join(aof, base), Buffer.from('fictional-synthetic-state-do-not-output'));
  privateWrite(join(aof, incr), Buffer.from('fictional-synthetic-increment-do-not-output'));
  privateWrite(join(aof, manifest), `file ${base} seq 1 type b\nfile ${incr} seq 1 type i\n`);
  return { sourceDir, targetDir, aof };
}

function snapshot(path) {
  return Object.fromEntries(readdirSync(path).sort().map(name => {
    if (name === 'appendonlydir') return [name, snapshot(join(path, name))];
    return [name, sha(readFileSync(join(path, name)))];
  }));
}

test('copy is create-only, content-free, exact-hash and leaves all source custody unchanged', t => {
  const f = fixture(t), before = snapshot(f.sourceDir);
  const receipt = forkSyntheticRun(f);
  assert.deepEqual(snapshot(f.sourceDir), before);
  assert.deepEqual(readdirSync(f.targetDir), ['appendonlydir']);
  assert.deepEqual(snapshot(join(f.targetDir, 'appendonlydir')), before.appendonlydir);
  assert.deepEqual(receipt.source_aof_sha256, before.appendonlydir);
  assert.equal(receipt.ancestor.run_json_sha256, before['run.json']);
  assert.equal(receipt.ancestor.receipts_sha256, before['receipts.jsonl']);
  assert.equal(receipt.ancestor.head, custody.head);
  assert.equal(receipt.ancestor.tree, custody.tree);
  assert.equal(receipt.ancestor.build_sha256, custody.build_sha256);
  assert.equal(receipt.prior_model_call_count, 15);
  assert.equal(receipt.model_call_limit, 8);
  assert.equal(receipt.cumulative_model_call_limit, 23);
  assert.equal(receipt.source_unchanged, true);
  assert.ok(!JSON.stringify(receipt).includes('do-not-output'));
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_TARGET_NOT_FRESH/u);
});

for (const [field, value] of [['synthetic_only', false], ['local_redis_only', false],
  ['head', 'b'.repeat(40)], ['tree', 'b'.repeat(40)], ['model_call_limit', 17],
  ['build_sha256', 'not-a-hash'], ['schema', 'unknown']]) {
  test(`rejects unapproved source custody ${field} before target writes`, t => {
    const f = fixture(t);
    writeFileSync(join(f.sourceDir, 'run.json'), JSON.stringify({ ...custody, [field]: value }));
    assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_SOURCE_CUSTODY_DENIED/u);
    assert.deepEqual(readdirSync(f.targetDir), []);
  });
}

test('rejects wrong path, alias, same source/target and nonempty target', t => {
  const f = fixture(t);
  assert.throws(() => forkSyntheticRun({ ...f, sourceDir: f.sourceDir.replace('/private/tmp', '/tmp') }),
    /ATHLETE_QA_FORK_SOURCE_DIR_DENIED/u);
  assert.throws(() => forkSyntheticRun({ ...f, sourceDir: `${f.sourceDir}/../${f.sourceDir.split('/').at(-1)}` }),
    /ATHLETE_QA_FORK_SOURCE_DIR_DENIED/u);
  assert.throws(() => forkSyntheticRun({ ...f, targetDir: f.sourceDir }), /ATHLETE_QA_FORK_TARGET_NOT_FRESH/u);
  privateWrite(join(f.targetDir, 'evidence.txt'), 'preserve');
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_TARGET_NOT_FRESH/u);
  assert.equal(readFileSync(join(f.targetDir, 'evidence.txt'), 'utf8'), 'preserve');
});

test('rejects nonprivate directory or file modes', t => {
  const f = fixture(t);
  chmodSync(f.sourceDir, 0o755);
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_SOURCE_DIR_DENIED/u);
  chmodSync(f.sourceDir, 0o700); chmodSync(f.targetDir, 0o755);
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_TARGET_DIR_DENIED/u);
  chmodSync(f.targetDir, 0o700); chmodSync(join(f.aof, incr), 0o644);
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_FILE_DENIED/u);
});

test('rejects symlink source, AOF file or target', t => {
  const f = fixture(t);
  const alias = `${f.sourceDir}-alias`;
  symlinkSync(f.sourceDir, alias);
  t.after(() => rmSync(alias));
  assert.throws(() => forkSyntheticRun({ ...f, sourceDir: alias }), /ATHLETE_QA_FORK_SOURCE_DIR_DENIED/u);
  const targetAlias = `${f.targetDir}-alias`;
  symlinkSync(f.targetDir, targetAlias); t.after(() => rmSync(targetAlias));
  assert.throws(() => forkSyntheticRun({ ...f, targetDir: targetAlias }), /ATHLETE_QA_FORK_TARGET_DIR_DENIED/u);
  rmSync(join(f.aof, incr)); symlinkSync(join(f.aof, base), join(f.aof, incr));
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_FILE_DENIED/u);
});

test('rejects symlink metadata or AOF directory before copying', t => {
  const f = fixture(t);
  rmSync(join(f.sourceDir, 'run.json'));
  symlinkSync(join(f.sourceDir, 'receipts.jsonl'), join(f.sourceDir, 'run.json'));
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_FILE_DENIED/u);
  rmSync(join(f.sourceDir, 'run.json'));
  privateWrite(join(f.sourceDir, 'run.json'), JSON.stringify(custody));
  rmSync(f.aof, { recursive: true });
  symlinkSync(f.targetDir, f.aof);
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_AOF_DIR_DENIED/u);
  assert.deepEqual(readdirSync(f.targetDir), []);
});

test('missing paths fail with a content-free code rather than filesystem details', () => {
  assert.throws(() => forkSyntheticRun({ sourceDir: `${prefix}missing-source`,
    targetDir: `${prefix}missing-target` }), /^Error: ATHLETE_QA_FORK_IO_DENIED$/u);
});

test('rejects hardlinked state and unexpected run or AOF content', t => {
  const f = fixture(t);
  const hardlink = join(f.targetDir, 'linked');
  linkSync(join(f.aof, incr), hardlink);
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_FILE_DENIED/u);
  rmSync(hardlink);
  privateWrite(join(f.sourceDir, 'unknown'), 'do-not-copy');
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_SOURCE_CONTENTS_DENIED/u);
  rmSync(join(f.sourceDir, 'unknown'));
  mkdirSync(join(f.aof, 'nested'), { mode: 0o700 });
  assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_AOF_CONTENTS_DENIED/u);
});

for (const malformed of [
  `file ../${base} seq 1 type b\nfile ${incr} seq 1 type i\n`,
  `file ${base} seq 2 type b\nfile ${incr} seq 1 type i\n`,
  `file ${base} seq 1 type i\nfile ${incr} seq 1 type i\n`,
  `file ${base} seq 1 type b\n`,
  `file ${base} seq 1 type b\nfile ${incr} seq 1 type i\nfile ${incr} seq 1 type i\n`,
]) {
  test('rejects unsafe, mismatched, incomplete or duplicate AOF manifests', t => {
    const f = fixture(t); writeFileSync(join(f.aof, manifest), malformed);
    assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_AOF_MANIFEST_DENIED/u);
    assert.deepEqual(readdirSync(f.targetDir), []);
  });
}

test('rejects missing, duplicate, renewed or malformed prior attempt ledger', t => {
  const f = fixture(t);
  for (const ledger of ['', '{broken', Array.from({ length: 15 }, () =>
    JSON.stringify({ kind: 'model_invocation', ordinal: 1, status: 'attempted' })).join('\n')]) {
    writeFileSync(join(f.sourceDir, 'receipts.jsonl'), ledger);
    assert.throws(() => forkSyntheticRun(f), /ATHLETE_QA_FORK_SOURCE_BUDGET_DENIED/u);
    assert.deepEqual(readdirSync(f.targetDir), []);
  }
});
