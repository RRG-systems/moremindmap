import { retrieveBusinessAssessment } from '../lib/businessAssessment/retrieveBusinessAssessment.js';

/**
 * Load Business Assessment retrieve payload for visual artifact routes.
 * Uses shared retrieve helper (live API first; DEV-only synthetic fixture fallback when retrieval fails).
 */
export async function loadBusinessAssessmentVisualRecord(profileId, buildApiUrl) {
  try {
    const startToken = typeof window === 'undefined'
      ? ''
      : window.sessionStorage.getItem('more.public.start_token.v1') || '';
    const requestOptions = startToken ? { headers: { 'X-MORE-Start-Token': startToken } } : {};
    const { payload, source } = await retrieveBusinessAssessment(profileId, buildApiUrl, requestOptions);
    return { record: payload, source, error: '' };
  } catch (error) {
    return {
      record: null,
      source: null,
      error: error.message || 'Business Assessment not found.'
    };
  }
}
