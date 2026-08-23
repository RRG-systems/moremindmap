import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildBosSubmissionFromSnapshot,
  createBosIntakeDraftStore,
  normalizeBosIntakeDraftSnapshot,
  sha256
} from '../api/engine/bosIntakeDraftV1.js';
import {
  BOS_DRAFT_STORAGE_KEY,
  createBosDraftCoordinator,
  createBosDraftSnapshot
} from '../src/lib/bosIntakeDurability.js';

class MemoryRedis {
  constructor() {
    this.values = new Map();
  }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, value);
    return 'OK';
  }
  async get(key) {
    return this.values.get(key) || null;
  }
  async expire(key) {
    return this.values.has(key) ? 1 : 0;
  }
  async del(key) {
    return this.values.delete(key) ? 1 : 0;
  }
  async eval(script, _keyCount, key, ...args) {
    const raw = this.values.get(key);
    if (!raw) return JSON.stringify({ code: 'NOT_FOUND' });
    const record = JSON.parse(raw);
    if (script.includes('last_mutation_id')) {
      const [baseRevision, mutationId, payloadSha, snapshotJson, updatedAt] = args;
      if (record.submission?.job_id) return JSON.stringify({ code: 'ALREADY_SUBMITTED', record });
      if (Number(record.revision) !== Number(baseRevision)) {
        if (record.last_mutation_id === mutationId && record.last_payload_sha256 === payloadSha) {
          return JSON.stringify({ code: 'IDEMPOTENT_REPLAY', record });
        }
        return JSON.stringify({ code: 'STALE_REVISION', revision: record.revision, updated_at: record.updated_at });
      }
      record.snapshot = JSON.parse(snapshotJson);
      record.snapshot_sha256 = payloadSha;
      record.revision += 1;
      record.updated_at = updatedAt;
      record.last_mutation_id = mutationId;
      record.last_payload_sha256 = payloadSha;
      this.values.set(key, JSON.stringify(record));
      return JSON.stringify({ code: 'UPDATED', record });
    }
    const [revision, snapshotSha, submissionSha, jobId, claimedAt] = args;
    if (record.submission?.job_id) {
      return JSON.stringify({
        code: record.submission.submission_sha256 === submissionSha ? 'IDEMPOTENT_REPLAY' : 'SUBMISSION_CONFLICT',
        record
      });
    }
    if (Number(record.revision) !== Number(revision)) {
      return JSON.stringify({ code: 'STALE_REVISION', revision: record.revision });
    }
    if (record.snapshot_sha256 !== snapshotSha) return JSON.stringify({ code: 'SNAPSHOT_MISMATCH' });
    record.submission = { status: 'CLAIMED', job_id: jobId, submission_sha256: submissionSha, claimed_at: claimedAt };
    record.updated_at = claimedAt;
    this.values.set(key, JSON.stringify(record));
    return JSON.stringify({ code: 'CLAIMED', record });
  }
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

function snapshot(patch = {}) {
  return normalizeBosIntakeDraftSnapshot({
    phase: 'ASSESSMENT',
    step: 4,
    metadata: {
      person_name: 'Synthetic Long Session',
      email: 'synthetic@example.test',
      identity: { full_name: 'Synthetic Long Session', email: 'synthetic@example.test' },
      organization: { company: 'Synthetic Company', role_title: 'Founder' },
      contextual_signals: { current_energy_drain: 'Synthetic evidence' },
      access_path: 'CURRENT_BOS_ENTRY'
    },
    responses: { 1: 'A', 2: 'Synthetic written response' },
    ...patch
  });
}

test('draft survives a deterministic two-hour session boundary and resumes exact state', async () => {
  const redis = new MemoryRedis();
  let clock = Date.parse('2026-08-21T10:00:00.000Z');
  const store = createBosIntakeDraftStore({
    redis,
    now: () => new Date(clock).toISOString(),
    newDraftId: () => 'draft-synthetic',
    newResumeToken: () => 'token-synthetic'
  });
  const created = await store.create(snapshot());
  clock += 2 * 60 * 60 * 1000;
  const resumed = await store.resume({ draftId: created.draft_id, resumeToken: created.resume_token });
  assert.equal(resumed.code, 'FOUND');
  assert.equal(resumed.record.revision, 1);
  assert.deepEqual(resumed.record.snapshot.responses, { 1: 'A', 2: 'Synthetic written response' });
});

test('revision contract rejects stale overwrite and replays the same mutation idempotently', async () => {
  const redis = new MemoryRedis();
  const store = createBosIntakeDraftStore({
    redis,
    newDraftId: () => 'draft-revision',
    newResumeToken: () => 'token-revision'
  });
  const created = await store.create(snapshot());
  const next = snapshot({ step: 5, responses: { 1: 'A', 2: 'Synthetic written response', 3: 'B' } });
  const updated = await store.update({ draftId: created.draft_id, resumeToken: created.resume_token, baseRevision: 1, mutationId: 'mutation-one', snapshot: next });
  assert.equal(updated.code, 'UPDATED');
  assert.equal(updated.record.revision, 2);
  const replay = await store.update({ draftId: created.draft_id, resumeToken: created.resume_token, baseRevision: 1, mutationId: 'mutation-one', snapshot: next });
  assert.equal(replay.code, 'IDEMPOTENT_REPLAY');
  const stale = await store.update({ draftId: created.draft_id, resumeToken: created.resume_token, baseRevision: 1, mutationId: 'mutation-two', snapshot: snapshot({ step: 2 }) });
  assert.equal(stale.code, 'STALE_REVISION');
  assert.equal(stale.revision, 2);
});

test('wrong-token resume fails closed and cannot expose another draft', async () => {
  const redis = new MemoryRedis();
  const store = createBosIntakeDraftStore({ redis, newDraftId: () => 'draft-isolated', newResumeToken: () => 'correct-token' });
  const created = await store.create(snapshot());
  assert.equal((await store.resume({ draftId: created.draft_id, resumeToken: 'wrong-token' })).code, 'NOT_FOUND');
  assert.equal((await store.resume({ draftId: created.draft_id, resumeToken: created.resume_token })).code, 'FOUND');
});

test('authenticated discard removes the exact draft and no other draft', async () => {
  const redis = new MemoryRedis();
  const store = createBosIntakeDraftStore({ redis, newDraftId: () => 'draft-discard', newResumeToken: () => 'discard-token' });
  const created = await store.create(snapshot());
  assert.equal((await store.discard({ draftId: created.draft_id, resumeToken: 'wrong-token' })).code, 'NOT_FOUND');
  assert.equal((await store.resume({ draftId: created.draft_id, resumeToken: created.resume_token })).code, 'FOUND');
  assert.equal((await store.discard({ draftId: created.draft_id, resumeToken: created.resume_token })).code, 'DISCARDED');
  assert.equal((await store.resume({ draftId: created.draft_id, resumeToken: created.resume_token })).code, 'NOT_FOUND');
});

test('final submission claim is exact-state and duplicate-safe', async () => {
  const redis = new MemoryRedis();
  const store = createBosIntakeDraftStore({ redis, newDraftId: () => 'draft-submit', newResumeToken: () => 'submit-token' });
  const ready = snapshot({ phase: 'READY_TO_SUBMIT', step: 27 });
  const created = await store.create(ready);
  const submission = buildBosSubmissionFromSnapshot(ready);
  const first = await store.claimSubmission({ draftId: created.draft_id, resumeToken: created.resume_token, revision: created.revision, snapshot: ready, submission });
  const replay = await store.claimSubmission({ draftId: created.draft_id, resumeToken: created.resume_token, revision: created.revision, snapshot: ready, submission });
  assert.equal(first.code, 'CLAIMED');
  assert.equal(replay.code, 'IDEMPOTENT_REPLAY');
  assert.equal(replay.job_id, first.job_id);
  const conflict = await store.claimSubmission({
    draftId: created.draft_id,
    resumeToken: created.resume_token,
    revision: created.revision,
    snapshot: ready,
    submission: { ...submission, answers: { ...submission.answers, 1: 'E' } }
  });
  assert.equal(conflict.code, 'SUBMISSION_MISMATCH');
});

test('browser coordinator restores server state and keeps only the scoped opaque resume token locally', async () => {
  const redis = new MemoryRedis();
  const store = createBosIntakeDraftStore({ redis, newDraftId: () => 'draft-browser', newResumeToken: () => 'browser-token' });
  const storage = new MemoryStorage();
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    const resumeToken = options.headers['X-BOS-Draft-Token'];
    if (body.action === 'create') {
      const created = await store.create(body.snapshot);
      return new Response(JSON.stringify({ success: true, ...created }), { status: 201 });
    }
    if (body.action === 'update') {
      const result = await store.update({ draftId: body.draft_id, resumeToken, baseRevision: body.base_revision, mutationId: body.mutation_id, snapshot: body.snapshot });
      return new Response(JSON.stringify({ success: true, ...result.record }), { status: 200 });
    }
    const result = await store.resume({ draftId: body.draft_id, resumeToken });
    return new Response(JSON.stringify(result.code === 'FOUND' ? { success: true, ...result.record } : { success: false, code: 'BOS_DRAFT_NOT_FOUND' }), { status: result.code === 'FOUND' ? 200 : 404 });
  };
  const coordinator = createBosDraftCoordinator({ fetchImpl, storage, newMutationId: () => 'mutation-browser' });
  const created = await coordinator.save(createBosDraftSnapshot(snapshot()));
  assert.equal(created.draft_id, 'draft-browser');
  assert.match(storage.getItem(BOS_DRAFT_STORAGE_KEY), /browser-token/);
  const afterRefresh = createBosDraftCoordinator({ fetchImpl, storage });
  const restored = await afterRefresh.restore();
  assert.equal(restored.ok, true);
  assert.equal(restored.envelope.snapshot.metadata.person_name, 'Synthetic Long Session');
});

test('browser coordinator fails closed when it cannot retain the opaque resume key', async () => {
  const redis = new MemoryRedis();
  const store = createBosIntakeDraftStore({ redis, newDraftId: () => 'draft-no-storage', newResumeToken: () => 'no-storage-token' });
  const storage = {
    getItem() { return null; },
    setItem() { throw new Error('storage blocked'); },
    removeItem() {}
  };
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    const created = await store.create(body.snapshot);
    return new Response(JSON.stringify({ success: true, ...created }), { status: 201 });
  };
  const coordinator = createBosDraftCoordinator({ fetchImpl, storage });
  await assert.rejects(
    coordinator.save(createBosDraftSnapshot(snapshot())),
    (error) => error.code === 'BOS_DRAFT_LOCAL_PERSISTENCE_UNAVAILABLE'
  );
});

test('live Profile source uses same-origin BOS APIs and no longer logs answer payloads', () => {
  const source = fs.readFileSync(new URL('../src/Profile.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /moremindmap-backend\.vercel\.app/);
  assert.doesNotMatch(source, /LIVE ANSWERS OBJECT|\[SUBMIT\] Full payload/);
  assert.doesNotMatch(source, /CURRENT ANSWER|START ASSESSMENT CLICKED|Response received:/);
  assert.match(source, /X-BOS-Draft-Token/);
  assert.match(source, /bos_intake_draft_v1/);
});

test('snapshot hash is stable across object key order', () => {
  const a = snapshot({ responses: { 2: 'Written', 1: 'A' } });
  const b = snapshot({ responses: { 1: 'A', 2: 'Written' } });
  assert.equal(sha256(a), sha256(b));
});

test('atomic Redis scripts treat the initial JSON-null submission as unclaimed', () => {
  const source = fs.readFileSync(new URL('../api/engine/bosIntakeDraftV1.js', import.meta.url), 'utf8');
  assert.equal(
    source.match(/record\.submission ~= nil and record\.submission ~= cjson\.null/g)?.length,
    2
  );
});
