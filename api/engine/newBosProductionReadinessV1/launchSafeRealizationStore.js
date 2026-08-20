import {
  artifactSha256,
} from './derivedArtifactStore.js';
import { validateCompleteNewBosCandidate } from './completeness.js';
import {
  NEW_BOS_REALIZATION_IDENTITY_VERSION,
  sameNewBosRealizationIdentity,
} from './realizationIdentity.js';

export const NEW_BOS_LAUNCH_SAFE_ENVELOPE_VERSION = 'new_bos_launch_safe_realization_envelope_v1';

function normalizeProfileId(profileId) {
  const normalized = String(profileId || '').trim().toUpperCase();
  if (!/^MM-[A-Z0-9-]+$/u.test(normalized)) throw new Error('new_bos_launch_store_profile_invalid');
  return normalized;
}

function validateNamespace(namespace) {
  const value = String(namespace || '');
  if (!value.startsWith('preview:new-bos:') && !value.startsWith('nonprod:new-bos:')) {
    throw new Error('new_bos_launch_store_namespace_must_be_nonproduction');
  }
  return value;
}

export function buildLaunchSafeRealizationEnvelope({
  profileId,
  realizationIdentity,
  artifact,
  compatibility,
  providerAccounting,
  createdAt = new Date().toISOString(),
} = {}) {
  const normalized = normalizeProfileId(profileId);
  if (realizationIdentity?.version !== NEW_BOS_REALIZATION_IDENTITY_VERSION) throw new Error('new_bos_launch_store_identity_version_invalid');
  if (realizationIdentity.components?.profile_id !== normalized) throw new Error('new_bos_launch_store_identity_profile_mismatch');
  if (!['A', 'B'].includes(compatibility?.class)) throw new Error('new_bos_launch_store_incompatible_artifact');
  const validation = validateCompleteNewBosCandidate(artifact);
  if (artifact.profile_id !== normalized) throw new Error('new_bos_launch_store_artifact_profile_mismatch');
  const artifactHash = artifactSha256(artifact);
  return Object.freeze({
    envelope_version: NEW_BOS_LAUNCH_SAFE_ENVELOPE_VERSION,
    profile_id: normalized,
    realization_identity: realizationIdentity,
    realization_id: realizationIdentity.realization_id,
    canonical_source_sha256: realizationIdentity.components.canonical_evidence_sha256,
    compatibility: Object.freeze({ class: compatibility.class, label: compatibility.label }),
    complete_surface_count: validation.surface_count,
    provider_accounting: Object.freeze({ ...(providerAccounting || {}) }),
    artifact_sha256: artifactHash,
    created_at: createdAt,
    artifact,
  });
}

export function validateLaunchSafeRealizationEnvelope(envelope, { profileId = envelope?.profile_id } = {}) {
  if (envelope?.envelope_version !== NEW_BOS_LAUNCH_SAFE_ENVELOPE_VERSION) throw new Error('new_bos_launch_store_envelope_version_invalid');
  const normalized = normalizeProfileId(profileId);
  if (envelope.profile_id !== normalized) throw new Error('new_bos_launch_store_profile_isolation_failure');
  if (envelope.realization_identity?.components?.profile_id !== normalized) throw new Error('new_bos_launch_store_identity_isolation_failure');
  if (envelope.realization_id !== envelope.realization_identity.realization_id) throw new Error('new_bos_launch_store_realization_id_mismatch');
  if (envelope.artifact?.profile_id !== normalized) throw new Error('new_bos_launch_store_artifact_isolation_failure');
  if (artifactSha256(envelope.artifact) !== envelope.artifact_sha256) throw new Error('new_bos_launch_store_artifact_hash_mismatch');
  if (envelope.complete_surface_count !== 15) throw new Error('new_bos_launch_store_incomplete_surface_count');
  validateCompleteNewBosCandidate(envelope.artifact);
  return envelope;
}

function createStoreCore({ namespace, getValue, setImmutable, compareAndSetPointer }) {
  const boundedNamespace = validateNamespace(namespace);
  const artifactKey = (profileId, realizationId) => `${boundedNamespace}:artifact:${normalizeProfileId(profileId)}:${realizationId}`;
  const pointerKey = (profileId) => `${boundedNamespace}:latest-compatible:${normalizeProfileId(profileId)}`;

  async function readArtifact(profileId, realizationId) {
    const serialized = await getValue(artifactKey(profileId, realizationId));
    if (!serialized) return null;
    return validateLaunchSafeRealizationEnvelope(JSON.parse(serialized), { profileId });
  }

  return Object.freeze({
    namespace: boundedNamespace,
    async getRealization({ profileId, realizationId }) {
      return readArtifact(profileId, realizationId);
    },
    async inspect({ profileId, desiredIdentity }) {
      const normalized = normalizeProfileId(profileId);
      const currentId = await getValue(pointerKey(normalized));
      if (!currentId) return Object.freeze({ state: 'missing', current: null, pointer: null });
      const current = await readArtifact(normalized, currentId);
      if (!current) throw new Error('new_bos_launch_store_pointer_target_missing');
      const state = sameNewBosRealizationIdentity(current.realization_identity, desiredIdentity) ? 'current' : 'stale';
      return Object.freeze({ state, current, pointer: currentId });
    },
    async persistImmutable(envelope) {
      validateLaunchSafeRealizationEnvelope(envelope);
      const key = artifactKey(envelope.profile_id, envelope.realization_id);
      const serialized = JSON.stringify(envelope);
      const written = await setImmutable(key, serialized);
      if (!written) {
        const existing = await getValue(key);
        if (!existing) throw new Error('new_bos_launch_store_immutable_write_unconfirmed');
        const parsed = validateLaunchSafeRealizationEnvelope(JSON.parse(existing), { profileId: envelope.profile_id });
        if (parsed.artifact_sha256 !== envelope.artifact_sha256) throw new Error('new_bos_launch_store_immutable_conflict');
        return Object.freeze({ written: false, idempotent: true, realization_id: envelope.realization_id });
      }
      return Object.freeze({ written: true, idempotent: false, realization_id: envelope.realization_id });
    },
    async advancePointer({ profileId, expectedCurrentId = null, nextRealizationId }) {
      const normalized = normalizeProfileId(profileId);
      const next = await readArtifact(normalized, nextRealizationId);
      if (!next) throw new Error('new_bos_launch_store_publish_target_missing');
      validateLaunchSafeRealizationEnvelope(next, { profileId: normalized });
      const result = await compareAndSetPointer(pointerKey(normalized), expectedCurrentId, nextRealizationId);
      if (!result.updated) {
        const error = new Error('new_bos_launch_store_stale_writer_rejected');
        error.current_realization_id = result.current || null;
        throw error;
      }
      return Object.freeze({ updated: true, prior_realization_id: expectedCurrentId, current_realization_id: nextRealizationId });
    },
    async rollbackPointer({ profileId, expectedCurrentId, priorRealizationId }) {
      const normalized = normalizeProfileId(profileId);
      const prior = await readArtifact(normalized, priorRealizationId);
      if (!prior) throw new Error('new_bos_launch_store_rollback_target_missing');
      const result = await compareAndSetPointer(pointerKey(normalized), expectedCurrentId, priorRealizationId);
      if (!result.updated) throw new Error('new_bos_launch_store_rollback_stale_pointer');
      return Object.freeze({ rolled_back: true, from: expectedCurrentId, to: priorRealizationId });
    },
  });
}

export function createMemoryLaunchSafeRealizationStore({ namespace = 'preview:new-bos:test' } = {}) {
  const values = new Map();
  return createStoreCore({
    namespace,
    getValue: async (key) => values.get(key) || null,
    setImmutable: async (key, value) => {
      if (values.has(key)) return false;
      values.set(key, value);
      return true;
    },
    compareAndSetPointer: async (key, expected, next) => {
      const current = values.get(key) || null;
      if (current !== expected) return { updated: false, current };
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
redis.call('SET', KEYS[1], ARGV[2])
return {1, ARGV[2]}
`;

export function createRedisLaunchSafeRealizationStore({ redis, namespace, persistenceEnabled = false } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function' || typeof redis?.eval !== 'function') {
    throw new Error('new_bos_launch_store_redis_contract_invalid');
  }
  return createStoreCore({
    namespace,
    getValue: (key) => redis.get(key),
    setImmutable: async (key, value) => {
      if (!persistenceEnabled) throw new Error('new_bos_launch_store_persistence_default_off');
      const result = await redis.set(key, value, 'NX');
      return result === 'OK';
    },
    compareAndSetPointer: async (key, expected, next) => {
      if (!persistenceEnabled) throw new Error('new_bos_launch_store_persistence_default_off');
      const result = await redis.eval(POINTER_CAS_SCRIPT, 1, key, expected || '', next);
      return { updated: Number(result?.[0]) === 1, current: result?.[1] || null };
    },
  });
}
