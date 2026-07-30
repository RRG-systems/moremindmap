/**
 * Lab-only preview support for the synthetic Business Assessment visual fixture.
 * Gated to import.meta.env.DEV — inert in production builds.
 * Do not use for production retrieval; fixture is a frozen bridge lab artifact.
 */
import syntheticBaRetrieveFull from './fixtures/tammyBaRetrieveFull.json';

export const SYNTHETIC_LAB_PROFILE_ID = 'mm-20990101-labsyn01';
export const SYNTHETIC_LAB_ASSESSMENT_ID = 'ba-20990101-deadbeef';

export function isSyntheticLabProfileId(profileId) {
  return String(profileId || '').trim() === SYNTHETIC_LAB_PROFILE_ID;
}

/**
 * Returns a retrieve-shaped payload for local visual route preview when live API/Redis is unavailable.
 * Only active in Vite dev (import.meta.env.DEV).
 */
export function getSyntheticBALabRetrieveFixture(profileId) {
  if (!import.meta.env.DEV) return null;
  if (!isSyntheticLabProfileId(profileId)) return null;

  if (import.meta.env.DEV) {
    console.info(
      '[BA Lab] Using synthetic retrieve fixture for visual route preview.',
      { profileId: SYNTHETIC_LAB_PROFILE_ID, assessmentId: SYNTHETIC_LAB_ASSESSMENT_ID }
    );
  }

  return syntheticBaRetrieveFull;
}
