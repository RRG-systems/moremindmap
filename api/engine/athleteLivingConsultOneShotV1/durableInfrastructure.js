import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import {
  createAthleteDomainAdapterV1,
  createAthleteLivingRelationshipScopeV1,
} from '../../../src/lib/athleteLivingConsultOneShotV1/athleteDomainAdapter.js';
import { createPresentationSafeAthleteBosProjectionV1 } from './demoRuntime.js';

const PREFIX = 'more:athlete-consulting-demo:v1';
const ENVELOPE_CONTRACT = 'athlete_living_consult_session_envelope_v1';
const RUNTIME_SNAPSHOT_CONTRACT = 'athlete_living_consult_runtime_snapshot_v1';
const MAX_ENVELOPE_BYTES = 4 * 1024 * 1024;
const BACKUP_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_LEASE_MS = 30_000;
const DEFAULT_RENEW_EVERY_MS = 10_000;
const HASH = /^[a-f0-9]{64}$/u;
const clone = (value) => JSON.parse(JSON.stringify(value));
const ownerToken = () => crypto.randomBytes(32).toString('base64url');

function fixedFixtureScope(fixtureId) {
  const fixed = fixtureId === 'mika'
    ? {
        subject_id: 'synthetic-athlete-parity',
        relationship_id: 'synthetic-athlete-mika-coach-ellis-consulting-tool-v1',
        membership_id: 'synthetic-athlete-mika-membership-consulting-tool-v1',
        athlete_profile_id: 'synthetic-athlete-mika-profile-consulting-tool-v1',
      }
    : fixtureId === 'avery'
      ? {
          subject_id: 'synthetic-athlete-avery',
          relationship_id: 'synthetic-athlete-avery-coach-navarro-consulting-tool-v1',
          membership_id: 'synthetic-athlete-avery-membership-consulting-tool-v1',
          athlete_profile_id: 'synthetic-athlete-avery-profile-consulting-tool-v1',
        }
      : null;
  if (!fixed) throw new TypeError('ATHLETE_CONSULT_DEMO_FIXTURE_NOT_ALLOWED');
  const domainScope = createAthleteLivingRelationshipScopeV1({
    ...fixed,
    tenant_id: 'synthetic-athlete-lab',
  });
  const adapter = createAthleteDomainAdapterV1({ scope: domainScope });
  return Object.freeze({
    fixture_id: fixtureId,
    ...fixed,
    domain_scope_hash: adapter.domain_scope_hash,
    rsl_scope_hash: adapter.rsl_scope_hash,
  });
}

const FIXTURES = Object.freeze({
  mika: fixedFixtureScope('mika'),
  avery: fixedFixtureScope('avery'),
});

function unsignedHash(value, hashField) {
  const body = clone(value);
  delete body[hashField];
  return hashCanonicalJson(body);
}

function validIso(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function exactFixtureBinding(fixtureBinding) {
  const fixed = FIXTURES[fixtureBinding?.fixture_id];
  if (!fixed) return false;
  const unsigned = clone(fixtureBinding);
  delete unsigned.fixture_binding_hash;
  return fixed.subject_id === fixtureBinding.subject_id
    && fixed.relationship_id === fixtureBinding.relationship_id
    && fixed.membership_id === fixtureBinding.membership_id
    && fixed.athlete_profile_id === fixtureBinding.athlete_profile_id
    && fixed.domain_scope_hash === fixtureBinding.domain_scope_hash
    && fixed.rsl_scope_hash === fixtureBinding.rsl_scope_hash
    && fixtureBinding.bos_base_chassis_artifact_sha256 === '21dad9299058dbdaa935bc89e66a0d3126d9c845c18b599bfa6afda3cd1ce6d0'
    && HASH.test(fixtureBinding.bos_presentation_projection_hash || '')
    && HASH.test(fixtureBinding.apa_view_model_hash || '')
    && fixtureBinding.fixture_binding_hash === hashCanonicalJson(unsigned);
}

export function athleteConsultingFixtureBindingV1(fixtureId, demoFixture) {
  const fixed = FIXTURES[String(fixtureId || '').trim().toLowerCase()];
  const actualFixtureId = demoFixture?.fixture_id || demoFixture?.id;
  const projectedBos = demoFixture?.rawBos
    ? createPresentationSafeAthleteBosProjectionV1(demoFixture.rawBos, { subject_id: fixed?.subject_id })
    : null;
  const bosProjectionHash = demoFixture?.bos_presentation_projection_hash
    || (projectedBos ? hashCanonicalJson(projectedBos) : null);
  const apaViewModelHash = demoFixture?.apa_view_model_hash
    || (demoFixture?.apaViewModel ? hashCanonicalJson(demoFixture.apaViewModel) : null);
  if (!fixed || actualFixtureId !== fixed.fixture_id
    || (demoFixture?.subject && demoFixture.subject.id !== fixed.subject_id)
    || (demoFixture?.relationshipId && demoFixture.relationshipId !== fixed.relationship_id)
    || (demoFixture?.membershipId && demoFixture.membershipId !== fixed.membership_id)
    || (demoFixture?.athleteProfileId && demoFixture.athleteProfileId !== fixed.athlete_profile_id)
    || (demoFixture?.bos_base_chassis_artifact_sha256
      && demoFixture.bos_base_chassis_artifact_sha256 !== '21dad9299058dbdaa935bc89e66a0d3126d9c845c18b599bfa6afda3cd1ce6d0')
    || !HASH.test(bosProjectionHash || '')
    || !HASH.test(apaViewModelHash || '')) {
    throw new TypeError('ATHLETE_CONSULT_DEMO_FIXTURE_BINDING_INVALID');
  }
  const body = {
    ...fixed,
    bos_base_chassis_artifact_sha256: '21dad9299058dbdaa935bc89e66a0d3126d9c845c18b599bfa6afda3cd1ce6d0',
    bos_presentation_projection_hash: bosProjectionHash,
    apa_view_model_hash: apaViewModelHash,
  };
  return Object.freeze({ ...body, fixture_binding_hash: hashCanonicalJson(body) });
}

export function athleteConsultingSessionKeys({ fixtureBinding }) {
  const fixed = FIXTURES[fixtureBinding?.fixture_id];
  if (!fixed || !exactFixtureBinding(fixtureBinding)) {
    throw new TypeError('ATHLETE_CONSULT_DEMO_FIXTURE_BINDING_INVALID');
  }
  const fixtureScopeHash = hashCanonicalJson({
    fixture_id: fixed.fixture_id,
    rsl_scope_hash: fixed.rsl_scope_hash,
  });
  return Object.freeze({
    fixture_scope_hash: fixtureScopeHash,
    state: `${PREFIX}:${fixtureScopeHash}:state`,
    backup: `${PREFIX}:${fixtureScopeHash}:backup`,
    lock: `${PREFIX}:${fixtureScopeHash}:lock`,
  });
}

function validateRuntimeSnapshot(snapshot, fixtureBinding) {
  if (!snapshot || snapshot.contract_id !== RUNTIME_SNAPSHOT_CONTRACT
    || snapshot.schema_version !== '1.0.0'
    || snapshot.relationship_scope_hash !== fixtureBinding.rsl_scope_hash
    || snapshot.runtime_state_hash == null || !HASH.test(snapshot.runtime_state_hash)
    || snapshot.snapshot_hash !== unsignedHash(snapshot, 'snapshot_hash')
    || !snapshot.living_store_snapshot || typeof snapshot.living_store_snapshot !== 'object') return false;
  return true;
}

function validOperationReceipt(receipt) {
  if (receipt == null) return true;
  const baseValid = receipt && HASH.test(receipt.operation_id_hash || '') && HASH.test(receipt.semantic_hash || '')
    && typeof receipt.action === 'string'
    && ['IN_PROGRESS', 'COMPLETED', 'REFUSED', 'OUTCOME_UNKNOWN'].includes(receipt.status)
    && validIso(receipt.started_at)
    && (receipt.completed_at == null || validIso(receipt.completed_at))
    && (receipt.result_state_hash == null || HASH.test(receipt.result_state_hash));
  if (!baseValid) return false;
  if (['COMPLETED', 'REFUSED'].includes(receipt.status)) {
    return validIso(receipt.completed_at)
      && typeof receipt.result_code === 'string'
      && Number.isInteger(receipt.result_revision) && receipt.result_revision >= 0
      && HASH.test(receipt.result_state_hash || '')
      && typeof receipt.mutation_performed === 'boolean';
  }
  return receipt.completed_at == null
    && receipt.result_code == null
    && receipt.result_revision == null
    && receipt.result_state_hash == null
    && receipt.mutation_performed === false;
}

export function createAthleteConsultingSessionEnvelopeV1({
  fixtureBinding,
  runtimeSnapshot,
  priorEnvelope = null,
  resetEpoch = null,
  operationReceipt = null,
  idempotencyReceipts = null,
  now = new Date(),
}) {
  if (!validateRuntimeSnapshot(runtimeSnapshot, fixtureBinding)) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_RUNTIME_SNAPSHOT_INVALID');
  }
  if (priorEnvelope && !validateAthleteConsultingSessionEnvelopeV1(priorEnvelope, { fixtureBinding }).valid) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_PRIOR_ENVELOPE_INVALID');
  }
  if (!validOperationReceipt(operationReceipt)) throw new TypeError('ATHLETE_LIVING_CONSULT_OPERATION_RECEIPT_INVALID');
  const receipts = idempotencyReceipts ?? priorEnvelope?.idempotency_receipts ?? [];
  if (!Array.isArray(receipts) || receipts.length > 32
    || new Set(receipts.map((receipt) => receipt?.operation_id_hash)).size !== receipts.length
    || receipts.some((receipt) => !validOperationReceipt(receipt)
      || !['COMPLETED', 'REFUSED'].includes(receipt.status))) {
    throw new TypeError('ATHLETE_LIVING_CONSULT_IDEMPOTENCY_LEDGER_INVALID');
  }
  const timestamp = new Date(now).toISOString();
  const body = {
    contract_id: ENVELOPE_CONTRACT,
    schema_version: '1.0.0',
    synthetic_only: true,
    fixture_binding: clone(fixtureBinding),
    envelope_revision: (priorEnvelope?.envelope_revision || 0) + 1,
    reset_epoch: resetEpoch ?? priorEnvelope?.reset_epoch ?? 0,
    previous_envelope_hash: priorEnvelope?.envelope_hash || null,
    runtime_state_hash: runtimeSnapshot.runtime_state_hash,
    runtime_snapshot_hash: runtimeSnapshot.snapshot_hash,
    runtime_snapshot: clone(runtimeSnapshot),
    operation_receipt: operationReceipt ? clone(operationReceipt) : null,
    idempotency_receipts: clone(receipts),
    created_at: priorEnvelope?.created_at || timestamp,
    updated_at: timestamp,
  };
  return Object.freeze({ ...body, envelope_hash: hashCanonicalJson(body) });
}

export function validateAthleteConsultingSessionEnvelopeV1(envelope, { fixtureBinding }) {
  const errors = [];
  if (!envelope || typeof envelope !== 'object') return Object.freeze({ valid: false, errors: ['ATHLETE_LIVING_CONSULT_ENVELOPE_REQUIRED'] });
  if (envelope.contract_id !== ENVELOPE_CONTRACT || envelope.schema_version !== '1.0.0') errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_CONTRACT_INVALID');
  if (envelope.synthetic_only !== true) errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_SYNTHETIC_ONLY');
  if (!exactFixtureBinding(envelope.fixture_binding)
    || envelope.fixture_binding?.fixture_binding_hash !== fixtureBinding?.fixture_binding_hash) {
    errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_FIXTURE_BINDING_INVALID');
  }
  if (!Number.isInteger(envelope.envelope_revision) || envelope.envelope_revision < 1
    || !Number.isInteger(envelope.reset_epoch) || envelope.reset_epoch < 0) errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_REVISION_INVALID');
  if (envelope.previous_envelope_hash != null && !HASH.test(envelope.previous_envelope_hash)) errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_LINEAGE_INVALID');
  if (!validateRuntimeSnapshot(envelope.runtime_snapshot, fixtureBinding)
    || envelope.runtime_snapshot_hash !== envelope.runtime_snapshot?.snapshot_hash
    || envelope.runtime_state_hash !== envelope.runtime_snapshot?.runtime_state_hash) errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_RUNTIME_INVALID');
  if (!validOperationReceipt(envelope.operation_receipt)) errors.push('ATHLETE_LIVING_CONSULT_OPERATION_RECEIPT_INVALID');
  if (!Array.isArray(envelope.idempotency_receipts) || envelope.idempotency_receipts.length > 32
    || new Set(envelope.idempotency_receipts.map((receipt) => receipt?.operation_id_hash)).size !== envelope.idempotency_receipts.length
    || envelope.idempotency_receipts.some((receipt) => !validOperationReceipt(receipt)
      || !['COMPLETED', 'REFUSED'].includes(receipt.status))) {
    errors.push('ATHLETE_LIVING_CONSULT_IDEMPOTENCY_LEDGER_INVALID');
  }
  if (!validIso(envelope.created_at) || !validIso(envelope.updated_at)) errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_TIMESTAMP_INVALID');
  if (!HASH.test(envelope.envelope_hash || '') || envelope.envelope_hash !== unsignedHash(envelope, 'envelope_hash')) errors.push('ATHLETE_LIVING_CONSULT_ENVELOPE_HASH_INVALID');
  return Object.freeze({ valid: errors.length === 0, errors });
}

export async function readAthleteConsultingSessionEnvelopeV1({ redis, keys, fixtureBinding }) {
  const raw = await redis.get(keys.state);
  if (!raw) return Object.freeze({ ok: true, code: 'ATHLETE_LIVING_CONSULT_SESSION_NOT_ESTABLISHED', envelope: null });
  if (Buffer.byteLength(raw, 'utf8') > MAX_ENVELOPE_BYTES) {
    throw new Error('ATHLETE_LIVING_CONSULT_ENVELOPE_TOO_LARGE');
  }
  let envelope;
  try { envelope = JSON.parse(raw); } catch { throw new Error('ATHLETE_LIVING_CONSULT_ENVELOPE_CORRUPT'); }
  const validation = validateAthleteConsultingSessionEnvelopeV1(envelope, { fixtureBinding });
  if (!validation.valid) throw new Error(validation.errors[0]);
  return Object.freeze({ ok: true, code: 'ATHLETE_LIVING_CONSULT_SESSION_HYDRATED', envelope });
}

async function assertLeaseOwner(redis, lease) {
  if (lease.lost || await redis.get(lease.key) !== lease.owner) {
    lease.lost = true;
    throw new Error('ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST');
  }
}

export async function persistAthleteConsultingSessionEnvelopeV1({
  redis,
  keys,
  fixtureBinding,
  lease,
  envelope,
  rotateBackup = false,
}) {
  const validation = validateAthleteConsultingSessionEnvelopeV1(envelope, { fixtureBinding });
  if (!validation.valid) throw new Error(validation.errors[0]);
  const serialized = JSON.stringify(envelope);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_ENVELOPE_BYTES) throw new Error('ATHLETE_LIVING_CONSULT_ENVELOPE_TOO_LARGE');
  if (lease.lost) throw new Error('ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST');
  const result = await redis.eval(
    "if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end local prior=redis.call('GET',KEYS[2]); if ARGV[3] == '1' and prior then redis.call('SET',KEYS[3],prior,'EX',ARGV[4]) end redis.call('SET',KEYS[2],ARGV[2]); redis.call('PEXPIRE',KEYS[1],ARGV[5]); return 1",
    3,
    keys.lock,
    keys.state,
    keys.backup,
    lease.owner,
    serialized,
    rotateBackup ? '1' : '0',
    String(BACKUP_TTL_SECONDS),
    String(lease.lease_ms),
  );
  if (Number(result) !== 1) {
    lease.lost = true;
    throw new Error('ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST');
  }
  return Object.freeze({ ok: true, code: 'ATHLETE_LIVING_CONSULT_ENVELOPE_COMMITTED', envelope_hash: envelope.envelope_hash });
}

export async function withAthleteConsultingSessionLeaseV1({
  redis,
  keys,
  operation,
  leaseMs = DEFAULT_LEASE_MS,
  renewEveryMs = DEFAULT_RENEW_EVERY_MS,
}) {
  const owner = ownerToken();
  const acquired = await redis.set(keys.lock, owner, 'PX', leaseMs, 'NX');
  if (acquired !== 'OK') throw new Error('ATHLETE_LIVING_CONSULT_REQUEST_IN_FLIGHT');
  const lease = {
    owner,
    key: keys.lock,
    lease_ms: leaseMs,
    lost: false,
    assertOwned: () => assertLeaseOwner(redis, lease),
  };
  let renewing = false;
  const timer = setInterval(async () => {
    if (renewing || lease.lost) return;
    renewing = true;
    try {
      const renewed = await redis.eval(
        "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end",
        1,
        keys.lock,
        owner,
        String(leaseMs),
      );
      if (Number(renewed) !== 1) lease.lost = true;
    } catch {
      lease.lost = true;
    } finally {
      renewing = false;
    }
  }, renewEveryMs);
  timer.unref?.();
  try {
    return await operation(lease);
  } finally {
    clearInterval(timer);
    try {
      await redis.eval(
        "if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end",
        1,
        keys.lock,
        owner,
      );
    } catch {
      lease.lost = true;
    }
  }
}

export async function resetAthleteConsultingSessionEnvelopeV1({
  redis,
  keys,
  fixtureBinding,
  lease,
  baselineEnvelope,
}) {
  await assertLeaseOwner(redis, lease);
  return persistAthleteConsultingSessionEnvelopeV1({
    redis,
    keys,
    fixtureBinding,
    lease,
    envelope: baselineEnvelope,
    rotateBackup: true,
  });
}

export const ATHLETE_CONSULTING_DURABILITY_V1 = Object.freeze({
  prefix: PREFIX,
  fixtures: Object.freeze(Object.keys(FIXTURES)),
  max_envelope_bytes: MAX_ENVELOPE_BYTES,
  backup_ttl_seconds: BACKUP_TTL_SECONDS,
  default_lease_ms: DEFAULT_LEASE_MS,
  default_renew_every_ms: DEFAULT_RENEW_EVERY_MS,
  customer_key_access: false,
  subscription_key_access: false,
});
