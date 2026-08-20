import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_VERSION = 'new_bos_derived_artifact_envelope_v1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function artifactSha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function validateNamespace(namespace) {
  if (!String(namespace).startsWith('preview:new-bos:') && !String(namespace).startsWith('nonprod:new-bos:')) {
    throw new Error('new_bos_store_namespace_must_be_nonproduction');
  }
}

function validateProfileId(profileId) {
  const normalized = String(profileId || '').trim().toUpperCase();
  if (!/^MM-[A-Z0-9-]+$/.test(normalized)) throw new Error('new_bos_store_profile_id_invalid');
  return normalized;
}

export function buildDerivedArtifactEnvelope({ profileId, canonicalSourceSha256, frozenAuthority, model, artifact, createdAt = new Date().toISOString() }) {
  const normalized = validateProfileId(profileId);
  const hash = artifactSha256(artifact);
  return Object.freeze({
    envelope_version: ARTIFACT_VERSION,
    namespace_class: 'isolated_nonproduction_preview',
    profile_id: normalized,
    canonical_source_sha256: canonicalSourceSha256,
    frozen_authority: frozenAuthority,
    provider_model: model,
    artifact_sha256: hash,
    created_at: createdAt,
    artifact,
  });
}

export function validateDerivedArtifactEnvelope(envelope, { profileId, canonicalSourceSha256, frozenAuthority }) {
  if (envelope?.envelope_version !== ARTIFACT_VERSION) throw new Error('new_bos_store_envelope_version_mismatch');
  if (envelope.profile_id !== validateProfileId(profileId)) throw new Error('new_bos_store_identity_mismatch');
  if (envelope.canonical_source_sha256 !== canonicalSourceSha256) throw new Error('new_bos_store_canonical_source_stale');
  if (envelope.frozen_authority?.manifest_sha256 !== frozenAuthority.manifest_sha256) throw new Error('new_bos_store_frozen_authority_stale');
  if (artifactSha256(envelope.artifact) !== envelope.artifact_sha256) throw new Error('new_bos_store_artifact_hash_mismatch');
  return envelope;
}

export function createFileDerivedArtifactStore({ rootDirectory, namespace }) {
  validateNamespace(namespace);
  if (!path.isAbsolute(rootDirectory)) throw new Error('new_bos_file_store_requires_absolute_root');
  const namespaceDirectory = path.join(rootDirectory, namespace.replaceAll(':', '_'));

  const fileFor = (profileId) => path.join(namespaceDirectory, `${validateProfileId(profileId)}.json`);
  return Object.freeze({
    mode: 'isolated_nonproduction_file',
    namespace,
    async get({ profileId, canonicalSourceSha256, frozenAuthority }) {
      const filePath = fileFor(profileId);
      if (!fs.existsSync(filePath)) return null;
      const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return validateDerivedArtifactEnvelope(envelope, { profileId, canonicalSourceSha256, frozenAuthority });
    },
    async put(envelope) {
      validateDerivedArtifactEnvelope(envelope, {
        profileId: envelope.profile_id,
        canonicalSourceSha256: envelope.canonical_source_sha256,
        frozenAuthority: envelope.frozen_authority,
      });
      fs.mkdirSync(namespaceDirectory, { recursive: true, mode: 0o700 });
      const filePath = fileFor(envelope.profile_id);
      if (fs.existsSync(filePath)) {
        const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (existing.artifact_sha256 !== envelope.artifact_sha256) throw new Error('new_bos_store_immutable_conflict');
        return Object.freeze({ written: false, idempotent: true, path: filePath, artifact_sha256: existing.artifact_sha256 });
      }
      const temporary = `${filePath}.${globalThis.process?.pid || 'runtime'}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, filePath);
      fs.chmodSync(filePath, 0o600);
      return Object.freeze({ written: true, idempotent: false, path: filePath, artifact_sha256: envelope.artifact_sha256 });
    },
  });
}

export function createRedisDerivedArtifactStore({ redis, namespace, persistenceEnabled = false }) {
  validateNamespace(namespace);
  if (typeof redis?.get !== 'function') throw new Error('new_bos_redis_store_get_required');
  const keyFor = (profileId) => `${namespace}:${validateProfileId(profileId)}`;
  return Object.freeze({
    mode: 'isolated_nonproduction_redis',
    namespace,
    async get({ profileId, canonicalSourceSha256, frozenAuthority }) {
      const serialized = await redis.get(keyFor(profileId));
      if (!serialized) return null;
      return validateDerivedArtifactEnvelope(JSON.parse(serialized), { profileId, canonicalSourceSha256, frozenAuthority });
    },
    async put(envelope) {
      if (!persistenceEnabled) throw new Error('new_bos_redis_persistence_default_off');
      if (typeof redis.set !== 'function') throw new Error('new_bos_redis_store_set_required');
      const key = keyFor(envelope.profile_id);
      const existing = await redis.get(key);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed.artifact_sha256 !== envelope.artifact_sha256) throw new Error('new_bos_store_immutable_conflict');
        return Object.freeze({ written: false, idempotent: true, key, artifact_sha256: parsed.artifact_sha256 });
      }
      await redis.set(key, JSON.stringify(envelope), 'NX');
      return Object.freeze({ written: true, idempotent: false, key, artifact_sha256: envelope.artifact_sha256 });
    },
  });
}

export { ARTIFACT_VERSION };
