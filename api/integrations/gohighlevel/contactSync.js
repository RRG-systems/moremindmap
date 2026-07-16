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
  { name: 'MORE Profile ID', property: 'profileId', required: true },
  { name: 'MORE Assessment Type', property: 'assessmentType' },
  { name: 'MORE Assessment Status', property: 'completionStatus' },
  { name: 'MORE Assessment Completed At', property: 'completedAt' },
  { name: 'MORE Subscription Status', property: 'subscriptionStatus' },
  { name: 'MORE Source', property: 'source' }
]);

const TAG_BY_EVENT = Object.freeze({
  [GHL_EVENT_TYPE.BOS_COMPLETED]: GHL_TAG_CONFIG.BOS_COMPLETED,
  [GHL_EVENT_TYPE.BA_COMPLETED]: GHL_TAG_CONFIG.BA_COMPLETED,
  [GHL_EVENT_TYPE.SUBSCRIPTION_ACTIVE]: GHL_TAG_CONFIG.SUBSCRIPTION_ACTIVE
});

let fieldCache = new Map();
let tagCache = new Map();

function clean(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeKey(value) {
  return clean(value).replace(/\s+/g, ' ').toLowerCase();
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
  if (!enabled) return { enabled: false, token, locationId, reason: 'feature_disabled' };
  if (!token) return { enabled: false, token, locationId, reason: 'missing_private_integration_token' };
  if (!locationId) return { enabled: false, token, locationId, reason: 'missing_location_id' };
  return { enabled: true, token, locationId, reason: null };
}

function result(overrides = {}) {
  return {
    attempted: false,
    success: false,
    skipped: false,
    reason: null,
    contactId: null,
    assessmentType: null,
    tagsApplied: [],
    retryable: false,
    httpStatus: null,
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

function customFieldsFrom(response) {
  return response?.customFields || response?.fields || [];
}

function tagsFrom(response) {
  return response?.tags || [];
}

function idFrom(value) {
  return clean(value?.id || value?._id);
}

async function resolveCustomFields(context) {
  const cacheKey = context.locationId;
  if (!fieldCache.has(cacheKey)) {
    fieldCache.set(cacheKey, (async () => {
      const found = await request(`/locations/${encodeURIComponent(context.locationId)}/customFields`, context);
      const byName = new Map(customFieldsFrom(found)
        .filter((field) => normalizeKey(field?.model || 'contact') === 'contact')
        .map((field) => [normalizeKey(field.name), idFrom(field)]));

      for (const definition of FIELD_DEFINITIONS) {
        const key = normalizeKey(definition.name);
        if (byName.get(key)) continue;
        try {
          const created = await request(`/locations/${encodeURIComponent(context.locationId)}/customFields`, {
            ...context,
            method: 'POST',
            body: { name: definition.name, dataType: 'TEXT', model: 'contact' }
          });
          const field = created?.customField || created?.field || created;
          const id = idFrom(field);
          if (id) byName.set(key, id);
        } catch (error) {
          if (definition.required) throw error;
          // Optional CRM metadata degrades gracefully; Profile ID never does.
        }
      }
      return byName;
    })());
  }
  try {
    return await fieldCache.get(cacheKey);
  } catch (error) {
    fieldCache.delete(cacheKey);
    throw error;
  }
}

async function resolveTags(requiredTags, context) {
  const cacheKey = context.locationId;
  if (!tagCache.has(cacheKey)) {
    tagCache.set(cacheKey, (async () => {
      const found = await request(`/locations/${encodeURIComponent(context.locationId)}/tags`, context);
      return new Map(tagsFrom(found).map((tag) => [normalizeKey(tag.name), clean(tag.name)]));
    })());
  }
  let byName;
  try {
    byName = await tagCache.get(cacheKey);
  } catch (error) {
    tagCache.delete(cacheKey);
    throw error;
  }

  for (const tagName of requiredTags) {
    const key = normalizeKey(tagName);
    if (byName.has(key)) continue;
    const created = await request(`/locations/${encodeURIComponent(context.locationId)}/tags`, {
      ...context,
      method: 'POST',
      body: { name: tagName }
    });
    const tag = created?.tag || created;
    byName.set(key, clean(tag?.name) || tagName);
  }
  return requiredTags.map((name) => byName.get(normalizeKey(name)) || name);
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
    return skippedResult(logger, logContext, { reason: configuration.reason, assessmentType, tagsApplied: desiredTags });
  }
  if (!profileId) return skippedResult(logger, logContext, { reason: 'missing_profile_id', assessmentType, tagsApplied: desiredTags });
  if (!email && !phone) return skippedResult(logger, logContext, { reason: 'missing_valid_email_or_phone', assessmentType, tagsApplied: desiredTags });
  if (!desiredTags.includes(GHL_TAG_CONFIG.BASE) || desiredTags.length < 2) return skippedResult(logger, logContext, { reason: 'invalid_event_type', assessmentType, tagsApplied: desiredTags });
  if (typeof fetchImpl !== 'function') return skippedResult(logger, logContext, { reason: 'fetch_unavailable', assessmentType, tagsApplied: desiredTags });

  const timeoutMs = Math.max(100, Math.min(Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS, 10000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const context = { fetchImpl, token: configuration.token, locationId: configuration.locationId, signal: controller.signal };

  try {
    const fields = await resolveCustomFields(context);
    const profileFieldId = fields.get(normalizeKey('MORE Profile ID'));
    if (!profileFieldId) {
      const skipped = result({ attempted: true, skipped: true, reason: 'profile_id_custom_field_unavailable', assessmentType, tagsApplied: desiredTags });
      safeLog(logger, { eventType, profileId, assessmentType, attempted: true, success: false, skippedReason: skipped.reason, httpStatus: null, retryable: false });
      return skipped;
    }

    const tags = await resolveTags(desiredTags, context);
    const customFields = FIELD_DEFINITIONS.flatMap((definition) => {
      const id = fields.get(normalizeKey(definition.name));
      const value = clean(input[definition.property]);
      return id && value ? [{ id, field_value: value }] : [];
    });
    const payload = compact({
      locationId: configuration.locationId,
      firstName: clean(input.firstName),
      lastName: clean(input.lastName),
      email,
      phone,
      tags,
      customFields
    });
    const response = await request('/contacts/upsert', { ...context, method: 'POST', body: payload });
    const contactId = clean(response?.contact?.id || response?.contactId || response?.id) || null;
    const succeeded = result({ attempted: true, success: true, assessmentType, contactId, tagsApplied: tags });
    succeeded.httpStatus = Number(response?.__httpStatus) || 200;
    safeLog(logger, { eventType, profileId, assessmentType, attempted: true, success: true, skippedReason: null, httpStatus: succeeded.httpStatus, retryable: false });
    return succeeded;
  } catch (error) {
    const timedOut = error?.name === 'AbortError';
    const status = Number(error?.status) || null;
    const classification = timedOut
      ? { reason: 'request_timeout', retryable: true }
      : status ? classifyStatus(status) : { reason: 'network_error', retryable: true };
    const failed = result({ attempted: true, reason: classification.reason, assessmentType, tagsApplied: desiredTags, retryable: classification.retryable, httpStatus: status });
    safeLog(logger, { eventType, profileId, assessmentType, attempted: true, success: false, skippedReason: failed.reason, httpStatus: status, retryable: failed.retryable });
    return failed;
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
  fieldCache = new Map();
  tagCache = new Map();
}

export const GOHIGHLEVEL_CONTACT_SYNC_CONTRACT = Object.freeze({
  apiBase: GHL_API_BASE,
  upsertEndpoint: '/contacts/upsert',
  fieldDefinitions: FIELD_DEFINITIONS,
  allowedPayloadKeys: ['locationId', 'firstName', 'lastName', 'email', 'phone', 'tags', 'customFields']
});
