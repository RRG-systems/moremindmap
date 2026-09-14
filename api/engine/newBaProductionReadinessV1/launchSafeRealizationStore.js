import crypto from 'node:crypto';

import { NEW_BA_COMPLETENESS_STATUS, validateCompleteNewBaRealization } from './completeness.js';
import { isSupportedNewBaRealizationIdentityVersion, sameNewBaRealizationIdentity } from './realizationIdentity.js';
import { normalizeProfileId, sha256Stable } from './stable.js';

export const NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION = 'new_ba_launch_safe_realization_envelope_v1';

function validateNamespace(namespace) {
  const value = String(namespace || '');
  if (!value.startsWith('preview:new-ba:') && !value.startsWith('nonprod:new-ba:')) throw new Error('new_ba_store_namespace_must_be_nonproduction');
  return value;
}

function serializedSha256(serialized) {
  return crypto.createHash('sha256').update(String(serialized)).digest('hex');
}

function normalizeSourceGuards(sourceGuards = []) {
  if (!Array.isArray(sourceGuards) || sourceGuards.length > 8) {
    throw new Error('new_ba_store_source_guards_invalid');
  }
  const keys = new Set();
  return Object.freeze(sourceGuards.map((guard) => {
    const key = typeof guard?.key === 'string' ? guard.key.trim() : '';
    const expected = guard?.expected;
    if (!key || keys.has(key) || (expected !== null && typeof expected !== 'string')) {
      throw new Error('new_ba_store_source_guards_invalid');
    }
    keys.add(key);
    return Object.freeze({ key, expected });
  }));
}

export function buildLaunchSafeNewBaEnvelope({ profileId, realizationIdentity, artifact, compatibility, providerAccounting, createdAt = new Date().toISOString() } = {}) {
  const profile = normalizeProfileId(profileId);
  if (!isSupportedNewBaRealizationIdentityVersion(realizationIdentity?.version)) throw new Error('new_ba_store_identity_version_invalid');
  if (realizationIdentity.components?.profile_id !== profile) throw new Error('new_ba_store_identity_profile_mismatch');
  if (!['A', 'B'].includes(compatibility?.class)) throw new Error('new_ba_store_incompatible_artifact');
  const validation = validateCompleteNewBaRealization(artifact, { profileId: profile, assessmentId: realizationIdentity.components.assessment_id });
  const artifactSha256 = sha256Stable(artifact);
  return Object.freeze({
    envelope_version: NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION,
    profile_id: profile,
    assessment_id: realizationIdentity.components.assessment_id,
    realization_identity: realizationIdentity,
    realization_id: realizationIdentity.realization_id,
    compatibility: Object.freeze({ class: compatibility.class, label: compatibility.label }),
    completeness: validation,
    provider_accounting: Object.freeze({ ...(providerAccounting || {}), store: false }),
    artifact_sha256: artifactSha256,
    created_at: createdAt,
    artifact,
  });
}

export function validateLaunchSafeNewBaEnvelope(envelope, { profileId = envelope?.profile_id } = {}) {
  if (envelope?.envelope_version !== NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION) throw new Error('new_ba_store_envelope_version_invalid');
  const profile = normalizeProfileId(profileId);
  if (envelope.profile_id !== profile || envelope.realization_identity?.components?.profile_id !== profile || envelope.artifact?.profile_id !== profile) throw new Error('new_ba_store_profile_isolation_failure');
  if (envelope.realization_id !== envelope.realization_identity.realization_id) throw new Error('new_ba_store_realization_id_mismatch');
  if (sha256Stable(envelope.artifact) !== envelope.artifact_sha256) throw new Error('new_ba_store_artifact_hash_mismatch');
  const validation = validateCompleteNewBaRealization(envelope.artifact, { profileId: profile, assessmentId: envelope.assessment_id, allowLegacyContract: true });
  if (envelope.completeness?.status !== validation.status
    || envelope.completeness?.artifact_sha256 !== validation.artifact_sha256) {
    throw new Error('new_ba_store_completeness_receipt_mismatch');
  }
  if (validation.status === NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN
    && (envelope.completeness?.plan_state !== 'LO_OPEN_DRAFT'
      || envelope.completeness?.plan_customer_commitment !== false
      || envelope.completeness?.customer_plan_status !== 'OPEN_NOT_CUSTOMER_AGREED'
      || envelope.completeness?.customer_plan_complete !== false
      || envelope.completeness?.storage_eligible !== true)) {
    throw new Error('new_ba_store_open_plan_receipt_invalid');
  }
  return envelope;
}

function createStoreCore({ namespace, getValue, setImmutable, replaceCorrupt, compareAndSetPointer }) {
  const bounded = validateNamespace(namespace);
  const artifactKey = (profileId, realizationId) => `${bounded}:artifact:${normalizeProfileId(profileId)}:${realizationId}`;
  const pointerKey = (profileId) => `${bounded}:latest-compatible:${normalizeProfileId(profileId)}`;

  async function readArtifact(profileId, realizationId) {
    const serialized = await getValue(artifactKey(profileId, realizationId));
    if (!serialized) return null;
    return validateLaunchSafeNewBaEnvelope(JSON.parse(serialized), { profileId });
  }

  async function inspectArtifact(profileId, realizationId) {
    if (!realizationId) return Object.freeze({ state: 'missing', envelope: null, serialized_sha256: null });
    const serialized = await getValue(artifactKey(profileId, realizationId));
    if (!serialized) return Object.freeze({ state: 'missing', envelope: null, serialized_sha256: null });
    const hash = serializedSha256(serialized);
    try {
      return Object.freeze({
        state: 'valid',
        envelope: validateLaunchSafeNewBaEnvelope(JSON.parse(serialized), { profileId }),
        serialized_sha256: hash,
      });
    } catch {
      return Object.freeze({ state: 'corrupt', envelope: null, serialized_sha256: hash });
    }
  }

  return Object.freeze({
    namespace: bounded,
    async getRealization({ profileId, realizationId }) { return readArtifact(profileId, realizationId); },
    async getCurrent({ profileId }) {
      const profile = normalizeProfileId(profileId);
      const pointer = await getValue(pointerKey(profile));
      if (!pointer) return null;
      return readArtifact(profile, pointer);
    },
    async inspect({ profileId, desiredIdentity }) {
      const profile = normalizeProfileId(profileId);
      const pointer = await getValue(pointerKey(profile));
      const desiredId = desiredIdentity?.realization_id || null;
      const desiredInspection = await inspectArtifact(profile, desiredId);
      const desired = desiredInspection.envelope;
      if (!pointer) {
        if (desired && sameNewBaRealizationIdentity(desired.realization_identity, desiredIdentity)) {
          return Object.freeze({ state: 'publishable_orphan', current: desired, pointer: null, pointer_repair_required: true });
        }
        if (desiredInspection.state === 'corrupt') {
          return Object.freeze({
            state: 'corrupt_derived', current: null, pointer: null,
            corruption: Object.freeze({ realization_id: desiredId, serialized_sha256: desiredInspection.serialized_sha256 }),
          });
        }
        return Object.freeze({ state: 'missing', current: null, pointer: null });
      }
      const currentInspection = pointer === desiredId
        ? desiredInspection
        : await inspectArtifact(profile, pointer);
      const current = currentInspection.envelope;
      if (!current) {
        if (desired && sameNewBaRealizationIdentity(desired.realization_identity, desiredIdentity)) {
          return Object.freeze({ state: 'publishable_orphan', current: desired, pointer, pointer_repair_required: true });
        }
        if (desiredInspection.state === 'corrupt' || currentInspection.state === 'corrupt') {
          const corrupt = desiredInspection.state === 'corrupt'
            ? { realization_id: desiredId, serialized_sha256: desiredInspection.serialized_sha256 }
            : { realization_id: pointer, serialized_sha256: currentInspection.serialized_sha256 };
          return Object.freeze({ state: 'corrupt_derived', current: null, pointer, corruption: Object.freeze(corrupt) });
        }
        return Object.freeze({ state: 'missing_derived', current: null, pointer, pointer_target_missing: true });
      }
      return Object.freeze({ state: sameNewBaRealizationIdentity(current.realization_identity, desiredIdentity) ? 'current' : 'stale', current, pointer });
    },
    async persistImmutable(envelope, { corruptRecovery = null } = {}) {
      validateLaunchSafeNewBaEnvelope(envelope);
      const key = artifactKey(envelope.profile_id, envelope.realization_id);
      const serialized = JSON.stringify(envelope);
      const written = await setImmutable(key, serialized);
      if (!written) {
        const existingRaw = await getValue(key);
        if (!existingRaw) throw new Error('new_ba_store_immutable_write_unconfirmed');
        let existing;
        try {
          existing = validateLaunchSafeNewBaEnvelope(JSON.parse(existingRaw), { profileId: envelope.profile_id });
        } catch {
          const existingSha256 = serializedSha256(existingRaw);
          const recoveryAuthorized = corruptRecovery?.realization_id === envelope.realization_id
            && corruptRecovery?.serialized_sha256 === existingSha256;
          if (!recoveryAuthorized || typeof replaceCorrupt !== 'function') {
            throw new Error('new_ba_store_corrupt_artifact_requires_recovery');
          }
          const replacement = await replaceCorrupt({
            key,
            archiveKey: `${key}:corrupt-derived-archive:${existingSha256}`,
            expectedSerialized: existingRaw,
            replacementSerialized: serialized,
          });
          if (!replacement.updated) throw new Error('new_ba_store_corrupt_recovery_stale_writer');
          return Object.freeze({
            written: true,
            idempotent: false,
            recovered_corrupt: true,
            corrupt_archive_sha256: existingSha256,
            realization_id: envelope.realization_id,
          });
        }
        if (existing.artifact_sha256 !== envelope.artifact_sha256) throw new Error('new_ba_store_immutable_conflict');
        return Object.freeze({ written: false, idempotent: true, realization_id: envelope.realization_id });
      }
      return Object.freeze({ written: true, idempotent: false, realization_id: envelope.realization_id });
    },
    async advancePointer({ profileId, expectedCurrentId = null, nextRealizationId, sourceGuards = [] }) {
      const profile = normalizeProfileId(profileId);
      const next = await readArtifact(profile, nextRealizationId);
      if (!next) throw new Error('new_ba_store_publish_target_missing');
      const guards = normalizeSourceGuards(sourceGuards);
      const result = await compareAndSetPointer(pointerKey(profile), expectedCurrentId, nextRealizationId, guards);
      if (!result.updated) {
        if (result.sourceChanged) throw new Error('new_ba_store_source_authority_changed');
        const error = new Error('new_ba_store_stale_writer_rejected');
        error.current_realization_id = result.current || null;
        throw error;
      }
      return Object.freeze({ updated: true, prior_realization_id: expectedCurrentId, current_realization_id: nextRealizationId });
    },
    async rollbackPointer({ profileId, expectedCurrentId, priorRealizationId }) {
      const profile = normalizeProfileId(profileId);
      const prior = await readArtifact(profile, priorRealizationId);
      if (!prior) throw new Error('new_ba_store_rollback_target_missing');
      const result = await compareAndSetPointer(pointerKey(profile), expectedCurrentId, priorRealizationId);
      if (!result.updated) throw new Error('new_ba_store_rollback_stale_pointer');
      return Object.freeze({ rolled_back: true, from: expectedCurrentId, to: priorRealizationId });
    },
  });
}

export function createMemoryNewBaRealizationStore({ namespace = 'preview:new-ba:test', values = new Map() } = {}) {
  if (!(values instanceof Map)) throw new Error('new_ba_memory_store_values_invalid');
  return createStoreCore({
    namespace,
    getValue: async (key) => values.get(key) || null,
    setImmutable: async (key, value) => { if (values.has(key)) return false; values.set(key, value); return true; },
    replaceCorrupt: async ({ key, archiveKey, expectedSerialized, replacementSerialized }) => {
      if (values.get(key) !== expectedSerialized) return { updated: false };
      if (!values.has(archiveKey)) values.set(archiveKey, expectedSerialized);
      values.set(key, replacementSerialized);
      return { updated: true };
    },
    compareAndSetPointer: async (key, expected, next, sourceGuards = []) => {
      const current = values.has(key) ? values.get(key) : null;
      if (current !== expected) return { updated: false, current };
      if (sourceGuards.some((guard) => (values.has(guard.key) ? values.get(guard.key) : null) !== guard.expected)) {
        return { updated: false, current, sourceChanged: true };
      }
      values.set(key, next);
      return { updated: true, current: next };
    },
  });
}

const POINTER_CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local expected = ARGV[1]
if expected == '' then
  if current then return {0, current} end
elseif current ~= expected then
  return {0, current or ''}
end
for i=2,#KEYS do
  local expected_source = ARGV[i + 1]
  local actual_source = redis.call('GET', KEYS[i])
  if string.sub(expected_source, 1, 1) == '0' then
    if actual_source then return {-1, current or ''} end
  elseif not actual_source or actual_source ~= string.sub(expected_source, 2) then
    return {-1, current or ''}
  end
end
redis.call('SET', KEYS[1], ARGV[2])
return {1, ARGV[2]}
`;

const CORRUPT_REPAIR_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current ~= ARGV[1] then return {0} end
redis.call('SET', KEYS[2], current, 'NX')
redis.call('SET', KEYS[1], ARGV[2])
return {1}
`;

export function createRedisNewBaRealizationStore({ redis, namespace, persistenceEnabled = false } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function' || typeof redis?.eval !== 'function') throw new Error('new_ba_store_redis_contract_invalid');
  return createStoreCore({
    namespace,
    getValue: (key) => redis.get(key),
    setImmutable: async (key, value) => {
      if (!persistenceEnabled) throw new Error('new_ba_store_persistence_default_off');
      return (await redis.set(key, value, 'NX')) === 'OK';
    },
    replaceCorrupt: async ({ key, archiveKey, expectedSerialized, replacementSerialized }) => {
      if (!persistenceEnabled) throw new Error('new_ba_store_persistence_default_off');
      const result = await redis.eval(CORRUPT_REPAIR_SCRIPT, 2, key, archiveKey, expectedSerialized, replacementSerialized);
      return { updated: Number(result?.[0]) === 1 };
    },
    compareAndSetPointer: async (key, expected, next, sourceGuards = []) => {
      if (!persistenceEnabled) throw new Error('new_ba_store_persistence_default_off');
      const keys = [key, ...sourceGuards.map((guard) => guard.key)];
      const expectedSources = sourceGuards.map((guard) => guard.expected === null ? '0' : `1${guard.expected}`);
      const result = await redis.eval(POINTER_CAS_SCRIPT, keys.length, ...keys, expected || '', next, ...expectedSources);
      return {
        updated: Number(result?.[0]) === 1,
        current: result?.[1] || null,
        sourceChanged: Number(result?.[0]) === -1,
      };
    },
  });
}
