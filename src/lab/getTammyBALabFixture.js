/**
 * Lab-only preview support for Tammy Metcalf Business Assessment visual routes.
 * Gated to import.meta.env.DEV — inert in production builds.
 * Do not use for production retrieval; fixture is a frozen bridge lab artifact.
 */
import tammyBaRetrieveFull from './fixtures/tammyBaRetrieveFull.json';

export const TAMMY_LAB_PROFILE_ID = 'mm-20260610-qes82pi1';
export const TAMMY_LAB_ASSESSMENT_ID = 'ba-20260610-3a517fd8';

export function isTammyLabProfileId(profileId) {
  return String(profileId || '').trim() === TAMMY_LAB_PROFILE_ID;
}

/**
 * Returns a retrieve-shaped payload for local visual route preview when live API/Redis is unavailable.
 * Only active in Vite dev (import.meta.env.DEV).
 */
export function getTammyBALabRetrieveFixture(profileId) {
  if (!import.meta.env.DEV) return null;
  if (!isTammyLabProfileId(profileId)) return null;

  if (import.meta.env.DEV) {
    console.info(
      '[BA Lab] Using Tammy lab retrieve fixture for visual route preview.',
      { profileId: TAMMY_LAB_PROFILE_ID, assessmentId: TAMMY_LAB_ASSESSMENT_ID }
    );
  }

  return tammyBaRetrieveFull;
}