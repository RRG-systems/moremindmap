import { normalizeEmail, normalizeProfileId } from './contracts.js';

function parse(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function createCanonicalProfileOwnerReader(store) {
  if (!store?.get) throw new Error('profile_owner_store_required');
  return async function readCanonicalProfileOwner(value) {
    const profileId = normalizeProfileId(value);
    if (!profileId) return null;
    const [, date, suffix] = profileId.match(/^mm-(\d{8})-([a-z0-9]{8})$/u) || [];
    const lower = await store.get(`vault:profile:${profileId}`);
    const raw = lower || await store.get(`vault:profile:MM-${date}-${suffix}`);
    const dossier = parse(raw);
    const recipientEmail = normalizeEmail(dossier?.email);
    if (!dossier || !recipientEmail) return null;
    return Object.freeze({ profile_id: profileId, recipient_email: recipientEmail });
  };
}
