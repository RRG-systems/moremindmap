import {
  normalizeOrdinaryCustomerProfileId,
  resolveOrdinaryBaEntry,
} from '../customerEntry/ordinaryCustomerEntryRouting.js';

export async function enterCanonicalNewBaAfterIntake({
  profileId,
  resolveEntry = resolveOrdinaryBaEntry,
  navigate = (destination) => window.location.assign(destination),
} = {}) {
  const normalized = normalizeOrdinaryCustomerProfileId(profileId);
  if (!normalized) throw new Error('canonical_new_ba_submission_profile_id_invalid');

  const result = await resolveEntry(normalized);
  if (result?.status !== 'current' || !result.destination) {
    const error = new Error('canonical_new_ba_submission_unavailable');
    error.safeCode = result?.safeCode || 'canonical_new_ba_submission_unavailable';
    error.result = result;
    throw error;
  }

  navigate(result.destination);
  return Object.freeze({ ...result, profileId: normalized });
}
