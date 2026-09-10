export function canonicalRedisKeys(profileId) {
  const match = String(profileId || '').match(/^MM-(\d{8})-([A-Z0-9]{8})$/i);
  if (!match) throw new Error('new_bos_canonical_reader_profile_id_invalid');
  const [, date, suffix] = match;
  return Object.freeze([
    `vault:profile:mm-${date}-${suffix.toLowerCase()}`,
    `vault:profile:MM-${date}-${suffix.toLowerCase()}`,
  ]);
}

export function createReadOnlyCanonicalReader({ redis }) {
  if (typeof redis?.get !== 'function') throw new Error('new_bos_canonical_reader_get_required');
  async function readWithSourceGuards(profileId) {
    const sourceGuards = [];
    for (const key of canonicalRedisKeys(profileId)) {
      const serialized = await redis.get(key);
      sourceGuards.push(Object.freeze({ key, expected: serialized ?? null }));
      if (!serialized) continue;
      return Object.freeze({
        source: Object.freeze({
          success: true,
          profile_id: profileId,
          canonical_dossier: JSON.parse(serialized),
          retrieval_receipt: Object.freeze({ strategy: 'redis_get_only', key_class: key.startsWith('vault:profile:mm-') ? 'canonical_lowercase' : 'legacy_uppercase' }),
        }),
        sourceGuards: Object.freeze(sourceGuards),
      });
    }
    throw new Error('new_bos_canonical_profile_not_found');
  }
  return Object.freeze({
    mode: 'redis_get_only',
    async read(profileId) {
      return (await readWithSourceGuards(profileId)).source;
    },
    readWithSourceGuards,
  });
}
