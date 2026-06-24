import Redis from 'ioredis';

export const STRIPE_INTERNAL_VERSION = 'stripe_v1';
export const DEFAULT_SITE_URL = 'https://moremindmap.com';

export const PRODUCT_ACCESS_TYPES = new Set([
  'behavior_operating_system',
  'business_assessment',
  'more_monthly_intelligence'
]);

export function setJsonHeaders(res, methods = 'GET,POST,OPTIONS') {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Stripe-Signature');
}

export function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('redis_configuration_unavailable');
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
    enableReadyCheck: false
  });
}

export function boundedText(value, max = 180) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

export function sanitizeEmail(value) {
  const email = boundedText(value, 254).toLowerCase();
  if (!email || !email.includes('@')) return '';
  return email;
}

export function monthKeyFromTimestamp(timestamp) {
  const date = timestamp ? new Date(Number(timestamp) * 1000) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 7);
  return date.toISOString().slice(0, 7);
}

export function accessGrantKey(grantId) {
  return `access_grant:${grantId}`;
}

export function accessGrantByEmailKey(email) {
  return `access_grant_by_email:${email}`;
}

export function accessGrantByProfileKey(profileId) {
  return `access_grant_by_profile:${profileId}`;
}

export function accessGrantByAssessmentKey(assessmentId) {
  return `access_grant_by_assessment:${assessmentId}`;
}

export function accessGrantBySessionKey(sessionId) {
  return `access_grant_by_session:${sessionId}`;
}

export function paymentEventKey(eventId) {
  return `payment_event:${eventId}`;
}

export function subscriptionStateKey(subscriptionId) {
  return `subscription_state:${subscriptionId}`;
}

export function revenueIndexKey(month) {
  return `payment_revenue_index:${month}`;
}

export function compactGrant(grant = {}) {
  return {
    access_type: boundedText(grant.access_type, 80),
    product_key: boundedText(grant.product_key, 80),
    status: boundedText(grant.status, 40),
    source: boundedText(grant.source, 40),
    created_at: boundedText(grant.created_at, 40)
  };
}

export function compactSubscriptionState(state = {}) {
  if (!state?.subscription_id) return null;
  return {
    status: boundedText(state.status, 40),
    current_period_end: state.current_period_end || null,
    cancel_at_period_end: Boolean(state.cancel_at_period_end)
  };
}

export async function readJson(redis, key) {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
