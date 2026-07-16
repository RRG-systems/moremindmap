const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const DEFAULT_TIMEOUT_MS = 5000;

export const GHL_EVENT_TYPE = Object.freeze({
  BOS_COMPLETED: 'bos_completed',
  BA_COMPLETED: 'ba_completed',
  SUBSCRIPTION_ACTIVE: 'subscription_active'
});

export const GHL_TAG_CONFIG = Object.freeze({
  BASE: 'MMM',
  BOS_COMPLETED: 'BOS Completed',
  BA_COMPLETED: 'BA Completed',
  SUBSCRIPTION_ACTIVE: 'Subscription Active'
});

const FIELD_DEFINITIONS = Object.freeze([
  { name: 'MORE Profile ID', property: 'profileId', envName: 'GHL_FIELD_MORE_PROFILE_ID', required: true },
  { name: 'MORE Assessment Type', property: 'assessmentType', envName: 'GHL_FIELD_MORE_ASSESSMENT_TYPE', required: true },
  { name: 'MORE Assessment Status', property: 'completionStatus', envName: 'GHL_FIELD_MORE_ASSESSMENT_STATUS', required: true },
  { name: 'MORE Assessment Completed At', property: 'completedAt', envName: 'GHL_FIELD_MORE_ASSESSMENT_COMPLETED_AT', required: true },
  { name: 'MORE Subscription Status', property: 'subscriptionStatus', envName: 'GHL_FIELD_MORE_SUBSCRIPTION_STATUS', required: false },
  { name: 'MORE Source', property: 'source', envName: 'GHL_FIELD_MORE_SOURCE', required: true }
]);

const TAG_BY_EVENT = Object.freeze({
  [GHL_EVENT_TYPE.BOS_COMPLETED]: GHL_TAG_CONFIG.BOS_COMPLETED,
  [GHL_EVENT_TYPE.BA_COMPLETED]: GHL_TAG_CONFIG.BA_COMPLETED,
  [GHL_EVENT_TYPE.SUBSCRIPTION_ACTIVE]: GHL_TAG_CONFIG.SUBSCRIPTION_ACTIVE
});

function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeEmail(value) {
  const email = clean(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function normalizePhone(value) {
  const phone = clean(value);
  if (!phone || /[^\d+().\-\s]/.test(phone)) return '';
  const plus = phone.startsWith('+') ? '+' : '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? `${plus}${digits}` : '';
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

function configFrom(env) {
  const enabled = clean(env.GHL_CONTACT_SYNC_ENABLED).toLowerCase() === 'true';
  const token = clean(env.GHL_PRIVATE_INTEGRATION_TOKEN);
  const locationId = clean(env.GHL_LOCATION_ID);
  const fieldReferences = new Map(FIELD_DEFINITIONS.map((definition) => [definition.name, clean(env[definition.envName])]));
  const missingRequiredFields = FIELD_DEFINITIONS
    .filter((definition) => definition.required && !fieldReferences.get(definition.name))
    .map((definition) => definition.envName);
  if (!enabled) return { enabled: false, token, locationId, reason: 'feature_disabled' };
  if (!token) return { enabled: false, token, locationId, reason: 'missing_private_integration_token' };
  if (!locationId) return { enabled: false, token, locationId, reason: 'missing_location_id' };
  if (missingRequiredFields.length > 0) {
    return { enabled: false, token, locationId, fieldReferences, missingRequiredFields, reason: 'configuration_missing' };
  }
  return { enabled: true, token, locationId, fieldReferences, missingRequiredFields: [], reason: null };
}

function result(overrides = {}) {
  return {
    attempted: false,
    success: false,
    skipped: false,
    reason: null,
    failureCategory: null,
    contactId: null,
    assessmentType: null,
    tagsApplied: [],
    retryable: false,
    httpStatus: null,
    partialSuccess: false,
    contactUpsert: 'not_attempted',
    contactUpsertHttpStatus: null,
    tagApplication: 'not_attempted',
    tagApplicationHttpStatus: null,
    missingConfiguration: [],
    ...overrides
  };
}

function classifyStatus(status) {
  if (status === 401 || status === 403) return { reason: 'authorization_failed', retryable: false };
  if (status === 429) return { reason: 'rate_limited', retryable: true };
  if (status >= 500) return { reason: 'ghl_server_error', retryable: true };
  return { reason: 'ghl_request_rejected', retryable: false };
}

class GhlRequestError extends Error {
  constructor(status) {
    super(`GoHighLevel request failed with HTTP ${status}`);
    this.name = 'GhlRequestError';
    this.status = status;
  }
}

async function request(path, { fetchImpl, token, signal, method = 'GET', body }) {
  const response = await fetchImpl(`${GHL_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      Version: GHL_API_VERSION,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal
  });
  if (!response.ok) throw new GhlRequestError(response.status);
  if (response.status === 204) return {};
  try {
    const data = await response.json();
    if (data && typeof data === 'object') {
      Object.defineProperty(data, '__httpStatus', { value: response.status, enumerable: false });
    }
    return data;
  } catch {
    return {};
  }
}

function configuredField(reference, value) {
  const fieldReference = clean(reference);
  const fieldValue = clean(value);
  if (!fieldReference || !fieldValue) return null;
  return { id: fieldReference, fieldValue };
}

function buildTags(eventType) {
  return [...new Set([GHL_TAG_CONFIG.BASE, TAG_BY_EVENT[eventType]].filter(Boolean))];
}

function safeLog(logger, payload) {
  try {
    logger.info?.('ghl_contact_sync', payload);
  } catch {
    // Observability must not affect assessment completion.
  }
}

function skippedResult(logger, logContext, overrides) {
  const skipped = result({ skipped: true, ...overrides });
  safeLog(logger, {
    ...logContext,
    attempted: Boolean(skipped.attempted),
    success: false,
    skippedReason: skipped.reason,
    httpStatus: skipped.httpStatus,
    retryable: Boolean(skipped.retryable)
  });
  return skipped;
}

export async function syncContactToGoHighLevel(input = {}, options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const configuration = configFrom(env);
  const assessmentType = clean(input.assessmentType) || null;
  const eventType = clean(input.eventType);
  const profileId = clean(input.profileId);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const desiredTags = buildTags(eventType);
  const logContext = { eventType, profileId: profileId || null, assessmentType };

  if (!configuration.enabled) {
    return skippedResult(logger, logContext, {
      reason: configuration.reason,
      assessmentType,
      tagsApplied: desiredTags,
      missingConfiguration: configuration.missingRequiredFields || []
    });
  }
  if (!profileId) return skippedResult(logger, logContext, { reason: 'missing_profile_id', assessmentType, tagsApplied: desiredTags });
  if (!email && !phone) return skippedResult(logger, logContext, { reason: 'missing_valid_email_or_phone', assessmentType, tagsApplied: desiredTags });
  if (!desiredTags.includes(GHL_TAG_CONFIG.BASE) || desiredTags.length < 2) return skippedResult(logger, logContext, { reason: 'invalid_event_type', assessmentType, tagsApplied: desiredTags });
  if (typeof fetchImpl !== 'function') return skippedResult(logger, logContext, { reason: 'fetch_unavailable', assessmentType, tagsApplied: desiredTags });

  const timeoutMs = Math.max(100, Math.min(Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS, 10000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const context = { fetchImpl, token: configuration.token, locationId: configuration.locationId, signal: controller.signal };

  const customFields = FIELD_DEFINITIONS.flatMap((definition) => {
    const field = configuredField(configuration.fieldReferences.get(definition.name), input[definition.property]);
    return field ? [field] : [];
  });
  const payload = compact({
    locationId: configuration.locationId,
    firstName: clean(input.firstName),
    lastName: clean(input.lastName),
    email,
    phone,
    customFields
  });

  let response;
  let contactId;
  try {
    response = await request('/contacts/upsert', { ...context, method: 'POST', body: payload });
    contactId = clean(response?.contact?.id || response?.contactId || response?.id) || null;
    const upsertStatus = Number(response?.__httpStatus) || 200;
    if (!contactId) {
      const partial = result({
        attempted: true,
        success: true,
        partialSuccess: true,
        reason: 'tag_application_failure',
        assessmentType,
        contactUpsert: 'contact_upsert_success',
        contactUpsertHttpStatus: upsertStatus,
        tagApplication: 'tag_application_failure',
        httpStatus: upsertStatus
      });
      safeLog(logger, { eventType, profileId, assessmentType, attempted: true, success: true, partialSuccess: true, contactUpsert: partial.contactUpsert, tagApplication: partial.tagApplication, reason: partial.reason, httpStatus: upsertStatus, tagHttpStatus: null, retryable: false });
      clearTimeout(timeout);
      return partial;
    }
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    const status = Number(error?.status) || null;
    const classification = timedOut
      ? { reason: 'request_timeout', retryable: true }
      : status ? classifyStatus(status) : { reason: 'network_error', retryable: true };
    const failed = result({ attempted: true, reason: 'contact_upsert_failure', failureCategory: classification.reason, assessmentType, retryable: classification.retryable, httpStatus: status, contactUpsert: 'contact_upsert_failure', contactUpsertHttpStatus: status });
    safeLog(logger, { eventType, profileId, assessmentType, attempted: true, success: false, partialSuccess: false, contactUpsert: failed.contactUpsert, tagApplication: failed.tagApplication, reason: failed.reason, failureCategory: classification.reason, httpStatus: status, tagHttpStatus: null, retryable: failed.retryable });
    clearTimeout(timeout);
    return failed;
  }

  const upsertStatus = Number(response?.__httpStatus) || 200;
  try {
    const tagResponse = await request(`/contacts/${encodeURIComponent(contactId)}/tags`, {
      ...context,
      method: 'POST',
      body: { tags: desiredTags }
    });
    const tagStatus = Number(tagResponse?.__httpStatus) || 200;
    const succeeded = result({ attempted: true, success: true, assessmentType, contactId, tagsApplied: desiredTags, httpStatus: upsertStatus, contactUpsert: 'contact_upsert_success', contactUpsertHttpStatus: upsertStatus, tagApplication: 'tag_application_success', tagApplicationHttpStatus: tagStatus });
    safeLog(logger, { eventType, profileId, assessmentType, attempted: true, success: true, partialSuccess: false, contactUpsert: succeeded.contactUpsert, tagApplication: succeeded.tagApplication, reason: null, httpStatus: upsertStatus, tagHttpStatus: tagStatus, retryable: false });
    return succeeded;
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    const tagStatus = Number(error?.status) || null;
    const classification = timedOut
      ? { reason: 'request_timeout', retryable: true }
      : tagStatus ? classifyStatus(tagStatus) : { reason: 'network_error', retryable: true };
    const partial = result({ attempted: true, success: true, partialSuccess: true, reason: 'tag_application_failure', failureCategory: classification.reason, assessmentType, contactId, httpStatus: upsertStatus, contactUpsert: 'contact_upsert_success', contactUpsertHttpStatus: upsertStatus, tagApplication: 'tag_application_failure', tagApplicationHttpStatus: tagStatus, retryable: classification.retryable });
    safeLog(logger, { eventType, profileId, assessmentType, attempted: true, success: true, partialSuccess: true, contactUpsert: partial.contactUpsert, tagApplication: partial.tagApplication, reason: partial.reason, failureCategory: classification.reason, httpStatus: upsertStatus, tagHttpStatus: tagStatus, retryable: partial.retryable });
    return partial;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildSubscriptionActiveContactEvent(contact = {}) {
  return {
    ...contact,
    eventType: GHL_EVENT_TYPE.SUBSCRIPTION_ACTIVE,
    subscriptionStatus: clean(contact.subscriptionStatus) || 'active'
  };
}

export function resetGoHighLevelResolverCachesForTests() {
  // Kept as a stable test API; the sync no longer performs cached schema or tag lookup.
}

export const GOHIGHLEVEL_CONTACT_SYNC_CONTRACT = Object.freeze({
  apiBase: GHL_API_BASE,
  upsertEndpoint: '/contacts/upsert',
  tagApplicationEndpoint: '/contacts/:contactId/tags',
  fieldDefinitions: FIELD_DEFINITIONS,
  allowedPayloadKeys: ['locationId', 'firstName', 'lastName', 'email', 'phone', 'customFields']
});
