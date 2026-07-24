import fs from 'node:fs';
import path from 'node:path';
import { InMemoryDurableLiveSessionDriver } from '../../../testing/inMemoryDurableLiveSessionDriver.js';

const FILE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,80}\.jsonl$/;

function readLastSnapshot(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  if (!lines.length) return null;
  const record = JSON.parse(lines.at(-1));
  if (record.journal_version !== '1.0.0' || record.operation !== 'SNAPSHOT' || !record.snapshot) throw new Error('INVALID_LOCAL_DURABILITY_JOURNAL');
  return record.snapshot;
}

export class LocalJsonlDurableLiveSessionDriver extends InMemoryDurableLiveSessionDriver {
  constructor({ dataRoot, filename = 'live-session-internal.jsonl' }) {
    const root = path.resolve(dataRoot || '');
    if (!dataRoot || !FILE_PATTERN.test(filename)) throw new TypeError('safe dataRoot and filename are required');
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const filePath = path.resolve(root, filename);
    if (path.dirname(filePath) !== root) throw new Error('LOCAL_DURABILITY_PATH_ESCAPE');
    super(readLastSnapshot(filePath));
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.deletionCapability = Object.freeze({
      logical_tombstone_supported: true,
      deletion_epoch_supported: true,
      physical_deletion_supported: false,
      physical_deletion_claim: 'NOT_PROVEN_APPEND_ONLY_FULL_SNAPSHOTS',
    });
  }
  persist() {
    const line = `${JSON.stringify({ journal_version: '1.0.0', operation: 'SNAPSHOT', snapshot: this.completeSnapshot() })}\n`;
    const descriptor = fs.openSync(this.filePath, fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_WRONLY, 0o600);
    try { fs.fchmodSync(descriptor, 0o600); fs.writeSync(descriptor, line, null, 'utf8'); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  }
  async withJournalLock(operation, shouldPersist) {
    let lock;
    try { lock = fs.openSync(this.lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600); } catch { return { ok: false, status: 'LOCAL_DURABILITY_BUSY' }; }
    try {
      const latest = readLastSnapshot(this.filePath); if (latest) this.restoreCompleteSnapshot(latest);
      const result = await operation(); if (shouldPersist(result)) this.persist(); return result;
    } finally { fs.closeSync(lock); fs.unlinkSync(this.lockPath); }
  }
  async atomicAppend(input) { return this.withJournalLock(() => super.atomicAppend(input), (result) => result.ok && result.status === 'APPENDED'); }
  async writeDerived(input) { return this.withJournalLock(() => super.writeDerived(input), (result) => result.ok); }
  async quarantine(input) { return this.withJournalLock(() => super.quarantine(input), (result) => result.ok); }
  async writeDurable(input) { return this.withJournalLock(() => super.writeDurable(input), (result) => result.ok); }
  inspectDeletionCapability() { return this.deletionCapability; }
}
