import { validateCompleteNewBaRealization } from './completeness.js';
import { NEW_BA_REALIZATION_IDENTITY_VERSION, sameNewBaRealizationIdentity } from './realizationIdentity.js';
import { normalizeProfileId, sha256Stable } from './stable.js';

export const NEW_BA_LAUNCH_SAFE_ENVELOPE_VERSION = 'new_ba_launch_safe_realization_envelope_v1';

function validateNamespace(namespace) {
  const value = String(namespace || '');
  if (!value.startsWith('preview:new-ba:') && !value.startsWith('nonprod:new-ba:')) throw new Error('new_ba_store_namespace_must_be_nonproduction');
  return value;
}

export function buildLaunchSafeNewBaEnvelope({ profileId, realizationIdentity, artifact, compatibility, providerAccounting, createdAt = new Date().toISOString() } = {}) {
  const profile = normalizeProfileId(profileId);
  if (realizationIdentity?.version !== NEW_BA_REALIZATION_IDENTITY_VERSION) throw new Error('new_ba_store_identity_version_invalid');
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
  validateCompleteNewBaRealization(envelope.artifact, { profileId: profile, assessmentId: envelope.assessment_id, allowLegacyContract: true });
  return envelope;
}

function createStoreCore({ namespace, getValue, setImmutable, compareAndSetPointer }) {
  const bounded = validateNamespace(namespace);
  const artifactKey = (profileId, realizationId) => `${bounded}:artifact:${normalizeProfileId(profileId)}:${realizationId}`;
  const pointerKey = (profileId) => `${bounded}:latest-compatible:${normalizeProfileId(profileId)}`;

  async function readArtifact(profileId, realizationId) {
    const serialized = await getValue(artifactKey(profileId, realizationId));
    if (!serialized) return null;
    return validateLaunchSafeNewBaEnvelope(JSON.parse(serialized), { profileId });
  }

  return Object.freeze({
    namespace: bounded,
    async getRealization({ profileId, realizationId }) { return readArtifact(profileId, realizationId); },
    async inspect({ profileId, desiredIdentity }) {
      const profile = normalizeProfileId(profileId);
      const pointer = await getValue(pointerKey(profile));
      if (!pointer) return Object.freeze({ state: 'missing', current: null, pointer: null });
      const current = await readArtifact(profile, pointer);
      if (!current) throw new Error('new_ba_store_pointer_target_missing');
      return Object.freeze({ state: sameNewBaRealizationIdentity(current.realization_identity, desiredIdentity) ? 'current' : 'stale', current, pointer });
    },
    async persistImmutable(envelope) {
      validateLaunchSafeNewBaEnvelope(envelope);
      const key = artifactKey(envelope.profile_id, envelope.realization_id);
      const serialized = JSON.stringify(envelope);
      const written = await setImmutable(key, serialized);
      if (!written) {
        const existingRaw = await getValue(key);
        if (!existingRaw) throw new Error('new_ba_store_immutable_write_unconfirmed');
        const existing = validateLaunchSafeNewBaEnvelope(JSON.parse(existingRaw), { profileId: envelope.profile_id });
        if (existing.artifact_sha256 !== envelope.artifact_sha256) throw new Error('new_ba_store_immutable_conflict');
        return Object.freeze({ written: false, idempotent: true, realization_id: envelope.realization_id });
      }
      return Object.freeze({ written: true, idempotent: false, realization_id: envelope.realization_id });
    },
    async advancePointer({ profileId, expectedCurrentId = null, nextRealizationId }) {
      const profile = normalizeProfileId(profileId);
      const next = await readArtifact(profile, nextRealizationId);
      if (!next) throw new Error('new_ba_store_publish_target_missing');
      const result = await compareAndSetPointer(pointerKey(profile), expectedCurrentId, nextRealizationId);
      if (!result.updated) {
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

export function createMemoryNewBaRealizationStore({ namespace = 'preview:new-ba:test' } = {}) {
  const values = new Map();
  return createStoreCore({
    namespace,
    getValue: async (key) => values.get(key) || null,
    setImmutable: async (key, value) => { if (values.has(key)) return false; values.set(key, value); return true; },
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

export function createRedisNewBaRealizationStore({ redis, namespace, persistenceEnabled = false } = {}) {
  if (typeof redis?.get !== 'function' || typeof redis?.set !== 'function' || typeof redis?.eval !== 'function') throw new Error('new_ba_store_redis_contract_invalid');
  return createStoreCore({
    namespace,
    getValue: (key) => redis.get(key),
    setImmutable: async (key, value) => {
      if (!persistenceEnabled) throw new Error('new_ba_store_persistence_default_off');
      return (await redis.set(key, value, 'NX')) === 'OK';
    },
    compareAndSetPointer: async (key, expected, next) => {
      if (!persistenceEnabled) throw new Error('new_ba_store_persistence_default_off');
      const result = await redis.eval(POINTER_CAS_SCRIPT, 1, key, expected || '', next);
      return { updated: Number(result?.[0]) === 1, current: result?.[1] || null };
    },
  });
}
