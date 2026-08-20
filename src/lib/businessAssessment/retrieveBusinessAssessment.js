import { getSyntheticBALabRetrieveFixture } from '../../lab/getTammyBALabFixture.js';

export const BA_RETRIEVE_NOT_FOUND_MESSAGE =
  'We could not find a completed Business Assessment for that Profile ID. Please check the ID and try again.';

export const BA_RETRIEVE_INVALID_ID_MESSAGE =
  'Please enter a valid Profile ID or Assessment ID.';

export const BA_RETRIEVE_UNAVAILABLE_MESSAGE =
  'We could not load your Business Assessment right now. Please try again shortly.';

const PROFILE_ID_PATTERN = /^mm-\d{8}-[a-z0-9]{8}$/i;
const ASSESSMENT_ID_PATTERN = /^ba-\d{8}-[a-f0-9]{8}$/i;

export function normalizeRetrieveIdentifier(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return { type: 'empty', normalized: '', param: 'id' };
  }

  const lower = raw.toLowerCase();

  if (PROFILE_ID_PATTERN.test(lower)) {
    return { type: 'profile_id', normalized: lower, param: 'id' };
  }

  if (ASSESSMENT_ID_PATTERN.test(lower)) {
    return { type: 'assessment_id', normalized: lower, param: 'id' };
  }

  if (lower.startsWith('mm-')) {
    return { type: 'profile_id', normalized: lower, param: 'id' };
  }

  if (lower.startsWith('ba-')) {
    return { type: 'assessment_id', normalized: lower, param: 'id' };
  }

  return { type: 'unknown', normalized: raw, param: 'id' };
}

export function normalizeRetrieveResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.success !== undefined) {
    if (payload.assessment) {
      return payload;
    }

    if (payload.found === false) {
      return payload;
    }
  }

  if (payload.ok === true) {
    if (payload.assessment) {
      return {
        success: true,
        found: true,
        status: payload.status || payload.assessment.status,
        owner_profile_id: payload.owner_profile_id || payload.assessment.owner_profile_id || null,
        assessment_id: payload.assessment_id || payload.assessment.assessment_id || null,
        assessment: payload.assessment
      };
    }

    const record = payload.record || payload.data || payload.result;
    if (record) {
      const assessment = record.assessment || record;
      if (assessment?.assessment_id || assessment?.output) {
        return {
          success: true,
          found: true,
          status: payload.status || assessment.status,
          owner_profile_id: payload.owner_profile_id || assessment.owner_profile_id || null,
          assessment_id: payload.assessment_id || assessment.assessment_id || null,
          assessment
        };
      }
    }
  }

  if (payload.assessment_id && payload.output) {
    return {
      success: true,
      found: true,
      status: payload.status,
      owner_profile_id: payload.owner_profile_id || null,
      assessment_id: payload.assessment_id,
      assessment: payload
    };
  }

  return null;
}

function mapRetrieveCustomerError({ httpStatus, payload, identifierType }) {
  if (import.meta.env.DEV) {
    console.info('[BA Retrieve] customer error mapping', {
      httpStatus,
      identifierType,
      payloadStatus: payload?.status,
      found: payload?.found,
      error: payload?.error
    });
  }

  if (
    payload?.found === false ||
    payload?.status === 'not_found' ||
    httpStatus === 404
  ) {
    return BA_RETRIEVE_NOT_FOUND_MESSAGE;
  }

  if (
    payload?.status === 'invalid_id' ||
    payload?.status === 'invalid_profile_id' ||
    payload?.status === 'invalid_assessment_id' ||
    httpStatus === 400
  ) {
    return BA_RETRIEVE_INVALID_ID_MESSAGE;
  }

  return BA_RETRIEVE_UNAVAILABLE_MESSAGE;
}

function buildRetrieveUrl(buildApiUrl, identifier) {
  const param = identifier.param || 'id';
  return buildApiUrl(
    `/api/business-assessment/retrieve?${param}=${encodeURIComponent(identifier.normalized)}`
  );
}

/**
 * Retrieve a stored Business Assessment by Profile ID or Assessment ID.
 * Returns a normalized retrieve payload or throws with a customer-safe message.
 */
export async function retrieveBusinessAssessment(rawId, buildApiUrl) {
  const identifier = normalizeRetrieveIdentifier(rawId);

  if (identifier.type === 'empty') {
    const error = new Error(BA_RETRIEVE_INVALID_ID_MESSAGE);
    error.code = 'empty_id';
    throw error;
  }

  if (identifier.type === 'unknown') {
    const error = new Error(BA_RETRIEVE_INVALID_ID_MESSAGE);
    error.code = 'invalid_id';
    throw error;
  }

  let httpStatus = 0;
  let rawPayload = null;

  try {
    const response = await fetch(buildRetrieveUrl(buildApiUrl, identifier));
    httpStatus = response.status;
    rawPayload = await response.json().catch(() => null);

    const normalized = normalizeRetrieveResponse(rawPayload);

    if (normalized?.success && normalized.found && normalized.assessment) {
      return {
        payload: normalized,
        source: 'api',
        identifier
      };
    }

    if (normalized?.success && normalized.found === false) {
      const error = new Error(mapRetrieveCustomerError({ httpStatus, payload: normalized, identifierType: identifier.type }));
      error.code = 'not_found';
      throw error;
    }

    if (!response.ok || rawPayload?.success === false) {
      const error = new Error(mapRetrieveCustomerError({ httpStatus, payload: rawPayload, identifierType: identifier.type }));
      error.code = 'retrieve_failed';
      throw error;
    }

    if (import.meta.env.DEV) {
      console.warn('[BA Retrieve] Unrecognized response shape', rawPayload);
    }

    const error = new Error(BA_RETRIEVE_UNAVAILABLE_MESSAGE);
    error.code = 'malformed_response';
    throw error;
  } catch (error) {
    if (error.code) {
      throw error;
    }

    if (import.meta.env.DEV) {
      console.info('[BA Retrieve] network or parse failure', error);
    }
  }

  const labFixture = getSyntheticBALabRetrieveFixture(identifier.normalized);
  const labNormalized = normalizeRetrieveResponse(labFixture);

  if (import.meta.env.DEV && labNormalized?.success && labNormalized.found && labNormalized.assessment) {
    return {
      payload: labNormalized,
      source: 'lab_fixture',
      identifier
    };
  }

  const error = new Error(
    mapRetrieveCustomerError({
      httpStatus,
      payload: rawPayload,
      identifierType: identifier.type
    })
  );
  error.code = 'retrieve_failed';
  throw error;
}
