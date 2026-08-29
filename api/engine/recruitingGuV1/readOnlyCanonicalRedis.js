function normalizeProfileId(value) {
  const match = String(value || '').trim().match(/^MM-(\d{8})-([A-Z0-9]{8})$/iu);
  if (!match) throw new Error('RECRUITING_GU_V1_READ_ONLY_PROFILE_ID_INVALID');
  return Object.freeze({
    upper: `MM-${match[1]}-${match[2].toUpperCase()}`,
    lower: `mm-${match[1]}-${match[2].toLowerCase()}`,
  });
}

function normalizeNamespace(value, kind) {
  const namespace = String(value || '').trim();
  const pattern = kind === 'bos'
    ? /^(?:preview|nonprod):new-bos:[a-z0-9][a-z0-9_-]{1,80}:v\d+$/u
    : /^(?:preview|nonprod):new-ba:[a-z0-9][a-z0-9_-]{0,80}(?::v\d+)?$/u;
  if (!pattern.test(namespace)) throw new Error(`RECRUITING_GU_V1_READ_ONLY_${kind.toUpperCase()}_NAMESPACE_INVALID`);
  return namespace;
}

export function createPatriciaReadOnlyRedis({ redis, profileId, bosNamespace, baNamespace } = {}) {
  if (typeof redis?.get !== 'function') throw new Error('RECRUITING_GU_V1_READ_ONLY_REDIS_GET_REQUIRED');
  const profile = normalizeProfileId(profileId);
  const bos = normalizeNamespace(bosNamespace, 'bos');
  const ba = normalizeNamespace(baNamespace, 'ba');
  const allowedExact = new Map([
    [`vault:profile:${profile.lower}`, 'CANONICAL_DOSSIER'],
    [`vault:profile:${profile.upper.slice(0, 12)}${profile.lower.slice(12)}`, 'CANONICAL_DOSSIER_LEGACY'],
    [`${bos}:latest-compatible:${profile.upper}`, 'BOS_POINTER'],
    [`${ba}:latest-compatible:${profile.upper}`, 'BA_POINTER'],
    [`business_assessment_by_profile:${profile.lower}`, 'BA_ANSWERS_POINTER'],
  ]);
  const bosArtifactPrefix = `${bos}:artifact:${profile.upper}:`;
  const baArtifactPrefix = `${ba}:artifact:${profile.upper}:`;
  let assessmentId = null;
  const audit = {
    mode: 'PROFILE_SCOPED_GET_ONLY',
    profile_id: profile.lower,
    get_count: 0,
    denied_read_count: 0,
    denied_write_count: 0,
    read_classes: {},
  };

  function denyRead() {
    audit.denied_read_count += 1;
    throw new Error('RECRUITING_GU_V1_READ_ONLY_REDIS_KEY_SCOPE_DENIED');
  }

  function denyWrite() {
    audit.denied_write_count += 1;
    throw new Error('RECRUITING_GU_V1_READ_ONLY_REDIS_WRITE_DENIED');
  }

  function classify(key) {
    if (allowedExact.has(key)) return allowedExact.get(key);
    if (key.startsWith(bosArtifactPrefix) && key.length > bosArtifactPrefix.length) return 'BOS_ARTIFACT';
    if (key.startsWith(baArtifactPrefix) && key.length > baArtifactPrefix.length) return 'BA_ARTIFACT';
    if (assessmentId && key === `business_assessment:${assessmentId}`) return 'BA_ANSWERS';
    return null;
  }

  return Object.freeze({
    async get(value) {
      const key = String(value || '');
      const keyClass = classify(key);
      if (!keyClass) return denyRead();
      const result = await redis.get(key);
      audit.get_count += 1;
      audit.read_classes[keyClass] = (audit.read_classes[keyClass] || 0) + 1;
      if (keyClass === 'BA_ANSWERS_POINTER' && result) {
        const normalized = String(result).trim().toLowerCase();
        if (!/^ba-\d{8}-[a-f0-9]{8}$/u.test(normalized)) throw new Error('RECRUITING_GU_V1_READ_ONLY_BA_POINTER_INVALID');
        assessmentId = normalized;
      }
      return result;
    },
    set: denyWrite,
    eval: denyWrite,
    audit() {
      return Object.freeze({
        ...audit,
        read_classes: Object.freeze({ ...audit.read_classes }),
        write_commands_forwarded: 0,
        canonical_mutation: false,
      });
    },
  });
}
