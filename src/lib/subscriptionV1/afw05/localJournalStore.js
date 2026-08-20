import fs from 'node:fs';
import path from 'node:path';
import { InMemoryLivingRelationshipStore } from './store.js';

const SAFE_FILE = /^[a-z0-9][a-z0-9._-]{0,90}\.jsonl$/u;

function readSnapshot(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  if (!lines.length) return null;
  const entry = JSON.parse(lines.at(-1));
  if (entry.journal_version !== '1.0.0' || entry.operation !== 'ATOMIC_SNAPSHOT' || !entry.snapshot) throw new Error('AFW05_LOCAL_JOURNAL_INVALID');
  return entry.snapshot;
}

export class LocalJsonlLivingRelationshipStore extends InMemoryLivingRelationshipStore {
  constructor({ data_root, filename = 'subscription-v1-afw05-living-relationship.jsonl' }) {
    const root = path.resolve(data_root || '');
    if (!data_root || !SAFE_FILE.test(filename)) throw new TypeError('AFW05_SAFE_DATA_ROOT_AND_FILENAME_REQUIRED');
    fs.mkdirSync(root, { recursive: true, mode: 0o700 });
    const filePath = path.resolve(root, filename);
    if (path.dirname(filePath) !== root) throw new Error('AFW05_LOCAL_JOURNAL_PATH_ESCAPE');
    super(readSnapshot(filePath));
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.lockHandle = null;
  }

  async _refreshBeforeTransaction() {
    try { this.lockHandle = fs.openSync(this.lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600); } catch { throw new Error('AFW05_LOCAL_JOURNAL_BUSY'); }
    const latest = readSnapshot(this.filePath);
    if (latest) this.state = latest;
  }

  async _persistSnapshot(next) {
    const line = `${JSON.stringify({ journal_version: '1.0.0', operation: 'ATOMIC_SNAPSHOT', snapshot: next })}\n`;
    const descriptor = fs.openSync(this.filePath, fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_WRONLY, 0o600);
    try {
      fs.fchmodSync(descriptor, 0o600);
      fs.writeSync(descriptor, line, null, 'utf8');
      fs.fsyncSync(descriptor);
    } finally { fs.closeSync(descriptor); }
    return { ok: true, status: 'LOCAL_JSONL_DURABLE_COMMITTED' };
  }

  async _releaseTransactionLock() {
    if (this.lockHandle != null) fs.closeSync(this.lockHandle);
    this.lockHandle = null;
    if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath);
  }

  inspectLocalDurability() {
    const stat = fs.existsSync(this.filePath) ? fs.statSync(this.filePath) : null;
    return Object.freeze({
      append_only_snapshot_journal: true,
      mode_0600: Boolean(stat && (stat.mode & 0o777) === 0o600),
      fsync_per_commit: true,
      atomic_semantic_unit: 'DECISION_PLUS_RSL_EVENT_PLUS_COMPLETE_PUBLICATION_POINTER',
      journal_exists: Boolean(stat),
    });
  }
}
