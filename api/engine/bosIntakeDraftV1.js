import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const BOS_INTAKE_DRAFT_CONTRACT_VERSION = 'bos_intake_draft_v1';
export const BOS_INTAKE_DRAFT_TTL_SECONDS = 30 * 24 * 60 * 60;

const VALID_PHASES = new Set([
  'CONTEXTUAL_SIGNALS',
  'ASSESSMENT',
  'READY_TO_SUBMIT'
]);

const UPDATE_DRAFT_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({code='NOT_FOUND'}) end
local record = cjson.decode(raw)
if record.submission ~= nil and record.submission ~= cjson.null and record.submission.job_id then
  return cjson.encode({code='ALREADY_SUBMITTED', record=record})
end
if tonumber(record.revision) ~= tonumber(ARGV[1]) then
  if record.last_mutation_id == ARGV[2] and record.last_payload_sha256 == ARGV[3] then
    return cjson.encode({code='IDEMPOTENT_REPLAY', record=record})
  end
  return cjson.encode({code='STALE_REVISION', revision=record.revision, updated_at=record.updated_at})
end
record.snapshot = cjson.decode(ARGV[4])
record.snapshot_sha256 = ARGV[3]
record.revision = tonumber(record.revision) + 1
record.updated_at = ARGV[5]
record.last_mutation_id = ARGV[2]
record.last_payload_sha256 = ARGV[3]
redis.call('SETEX', KEYS[1], tonumber(ARGV[6]), cjson.encode(record))
return cjson.encode({code='UPDATED', record=record})
`;

const CLAIM_SUBMISSION_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return cjson.encode({code='NOT_FOUND'}) end
local record = cjson.decode(raw)
if record.submission ~= nil and record.submission ~= cjson.null and record.submission.job_id then
  if record.submission.submission_sha256 ~= ARGV[3] then
    return cjson.encode({code='SUBMISSION_CONFLICT'})
  end
  return cjson.encode({code='IDEMPOTENT_REPLAY', record=record})
end
if tonumber(record.revision) ~= tonumber(ARGV[1]) then
  return cjson.encode({code='STALE_REVISION', revision=record.revision, updated_at=record.updated_at})
end
if record.snapshot_sha256 ~= ARGV[2] then
  return cjson.encode({code='SNAPSHOT_MISMATCH'})
end
record.submission = {
  status='CLAIMED',
  job_id=ARGV[4],
  submission_sha256=ARGV[3],
  claimed_at=ARGV[5]
}
record.updated_at = ARGV[5]
redis.call('SETEX', KEYS[1], tonumber(ARGV[6]), cjson.encode(record))
return cjson.encode({code='CLAIMED', record=record})
`;

function text(value, max = 12000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function sortedObject(value, valueNormalizer = (entry) => entry) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((key) => [key, valueNormalizer(value[key])])
  );
}

function normalizeAnswer(value) {
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === 'string').map((entry) => entry.slice(0, 32));
  }
  if (typeof value === 'string') return value.slice(0, 20000);
  return null;
}

function normalizeMetadata(metadata = {}) {
  const identity = metadata.identity || {};
  const organization = metadata.organization || {};
  return {
    person_name: text(metadata.person_name || identity.full_name, 240),
    email: text(metadata.email || identity.email, 320).toLowerCase(),
    identity: sortedObject(identity, (value) => Array.isArray(value)
      ? value.filter((entry) => typeof entry === 'string').map((entry) => entry.slice(0, 500))
      : text(value, 2000)),
    organization: sortedObject(organization, (value) => Array.isArray(value)
      ? value.filter((entry) => typeof entry === 'string').map((entry) => entry.slice(0, 500))
      : text(value, 2000)),
    contextual_signals: sortedObject(metadata.contextual_signals, (value) => text(value, 12000)),
    access_path: text(metadata.access_path, 80) || 'CURRENT_BOS_ENTRY'
  };
}

export function normalizeBosIntakeDraftSnapshot(snapshot = {}) {
  const phase = VALID_PHASES.has(snapshot.phase) ? snapshot.phase : 'CONTEXTUAL_SIGNALS';
  const step = Number.isInteger(snapshot.step)
    ? Math.max(0, Math.min(27, snapshot.step))
    : 0;
  const responses = sortedObject(snapshot.responses, normalizeAnswer);
  for (const key of Object.keys(responses)) {
    const numericId = Number(key);
    if (!Number.isInteger(numericId) || numericId < 1 || numericId > 28 || responses[key] === null) {
      delete responses[key];
    }
  }
  const normalized = {
    contract_version: BOS_INTAKE_DRAFT_CONTRACT_VERSION,
    phase,
    step,
    metadata: normalizeMetadata(snapshot.metadata),
    responses
  };
  if (!normalized.metadata.person_name || !normalized.metadata.email) {
    const error = new Error('BOS_DRAFT_IDENTITY_REQUIRED');
    error.code = 'BOS_DRAFT_IDENTITY_REQUIRED';
    throw error;
  }
  return normalized;
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

export function buildBosSubmissionFromSnapshot(snapshot) {
  const normalized = normalizeBosIntakeDraftSnapshot(snapshot);
  return {
    answers: normalized.responses,
    metadata: normalized.metadata
  };
}

function draftKey(draftId, resumeToken) {
  return `bos:intake:draft:v1:${draftId}:${sha256(resumeToken)}`;
}

function deterministicJobId(draftId, resumeToken) {
  const digest = sha256(`bos-intake-job-v1:${draftId}:${sha256(resumeToken)}`);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function publicRecord(record) {
  return {
    draft_id: record.draft_id,
    contract_version: record.contract_version,
    revision: record.revision,
    created_at: record.created_at,
    updated_at: record.updated_at,
    snapshot: record.snapshot,
    snapshot_sha256: record.snapshot_sha256,
    submission: record.submission || null
  };
}

function parseAtomicResult(raw) {
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
}

export function createBosIntakeDraftStore({
  redis,
  now = () => new Date().toISOString(),
  newDraftId = () => randomUUID(),
  newResumeToken = () => randomBytes(32).toString('base64url'),
  ttlSeconds = BOS_INTAKE_DRAFT_TTL_SECONDS
}) {
  if (!redis) throw new Error('BOS_DRAFT_REDIS_REQUIRED');

  return Object.freeze({
    async create(snapshot) {
      const normalized = normalizeBosIntakeDraftSnapshot(snapshot);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const draftId = newDraftId();
        const resumeToken = newResumeToken();
        const timestamp = now();
        const record = {
          draft_id: draftId,
          contract_version: BOS_INTAKE_DRAFT_CONTRACT_VERSION,
          revision: 1,
          created_at: timestamp,
          updated_at: timestamp,
          snapshot: normalized,
          snapshot_sha256: sha256(normalized),
          last_mutation_id: null,
          last_payload_sha256: null,
          submission: null
        };
        const created = await redis.set(
          draftKey(draftId, resumeToken),
          JSON.stringify(record),
          'EX', ttlSeconds,
          'NX'
        );
        if (created === 'OK') return { ...publicRecord(record), resume_token: resumeToken };
      }
      throw new Error('BOS_DRAFT_CREATE_COLLISION');
    },

    async resume({ draftId, resumeToken }) {
      const raw = await redis.get(draftKey(draftId, resumeToken));
      if (!raw) return { code: 'NOT_FOUND' };
      const record = JSON.parse(raw);
      await redis.expire(draftKey(draftId, resumeToken), ttlSeconds);
      return { code: 'FOUND', record: publicRecord(record) };
    },

    async discard({ draftId, resumeToken }) {
      const deleted = await redis.del(draftKey(draftId, resumeToken));
      return { code: deleted > 0 ? 'DISCARDED' : 'NOT_FOUND' };
    },

    async update({ draftId, resumeToken, baseRevision, mutationId, snapshot }) {
      const normalized = normalizeBosIntakeDraftSnapshot(snapshot);
      const payloadSha256 = sha256(normalized);
      const raw = await redis.eval(
        UPDATE_DRAFT_LUA,
        1,
        draftKey(draftId, resumeToken),
        String(baseRevision),
        text(mutationId, 120),
        payloadSha256,
        JSON.stringify(normalized),
        now(),
        String(ttlSeconds)
      );
      const result = parseAtomicResult(raw);
      return result.record ? { code: result.code, record: publicRecord(result.record) } : result;
    },

    async claimSubmission({ draftId, resumeToken, revision, snapshot, submission }) {
      const normalizedSnapshot = normalizeBosIntakeDraftSnapshot(snapshot);
      if (normalizedSnapshot.phase !== 'READY_TO_SUBMIT') {
        return { code: 'NOT_READY_TO_SUBMIT' };
      }
      const normalizedSubmission = buildBosSubmissionFromSnapshot(normalizedSnapshot);
      if (sha256(normalizedSubmission) !== sha256(submission)) {
        return { code: 'SUBMISSION_MISMATCH' };
      }
      const jobId = deterministicJobId(draftId, resumeToken);
      const raw = await redis.eval(
        CLAIM_SUBMISSION_LUA,
        1,
        draftKey(draftId, resumeToken),
        String(revision),
        sha256(normalizedSnapshot),
        sha256(normalizedSubmission),
        jobId,
        now(),
        String(ttlSeconds)
      );
      const result = parseAtomicResult(raw);
      return result.record ? { code: result.code, record: publicRecord(result.record), job_id: jobId } : result;
    }
  });
}
