import { retrieveBusinessAssessment } from '../lib/businessAssessment/retrieveBusinessAssessment.js';

/**
 * Load Business Assessment retrieve payload for visual artifact routes.
 * Uses shared retrieve helper (live API first; DEV-only synthetic fixture fallback when retrieval fails).
 */
export async function loadBusinessAssessmentVisualRecord(profileId, buildApiUrl) {
  try {
    const { payload, source } = await retrieveBusinessAssessment(profileId, buildApiUrl);
    return { record: payload, source, error: '' };
  } catch (error) {
    return {
      record: null,
      source: null,
      error: error.message || 'Business Assessment not found.'
    };
  }
}
