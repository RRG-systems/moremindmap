import {
  accessGrantBySessionKey,
  accessGrantKey,
  boundedText,
  compactGrant,
  compactSubscriptionState,
  createRedisClient,
  readJson,
  setJsonHeaders,
  subscriptionStateKey
} from './shared.js';
import { applyExactOriginCors } from '../../src/lib/publicSiteAirlockV1/security.js';
import { entitlementAllowsCoaching } from '../../src/lib/subscriptionV1/entitlement.js';
import { resolvePaidEntitlementFromStore } from '../engine/subscriptionV1/paidRuntimeInfrastructure.js';

async function grantIdsFromIndex(redis, key) {
  const ids = await redis.smembers(key);
  return Array.isArray(ids) ? ids : [];
}

async function loadGrants(redis, ids, productKey) {
  const grants = [];
  for (const id of ids.slice(0, 20)) {
    const grant = await readJson(redis, accessGrantKey(id));
    if (!grant) continue;
    if (productKey && grant.product_key !== productKey) continue;
    grants.push(grant);
  }
  return grants;
}

async function loadSubscriptionState(redis, grants) {
  const subscriptionGrant = grants.find((grant) => grant.subscription_id);
  if (!subscriptionGrant?.subscription_id) return null;
  return readJson(redis, subscriptionStateKey(subscriptionGrant.subscription_id));
}

export async function resolveAccessPaymentTruth({
  redis,
  grants,
  now = new Date(),
  resolveMonthlyEntitlement = resolvePaidEntitlementFromStore,
} = {}) {
  const activeGrant = (grants || []).find((grant) => grant.status === 'active');
  if (!activeGrant) return 'not_found';
  if (activeGrant.product_key !== 'more_monthly_intelligence') return 'webhook_confirmed';
  if (!activeGrant.scope || typeof resolveMonthlyEntitlement !== 'function') return 'lifecycle_pending';
  try {
    const entitlement = await resolveMonthlyEntitlement({ redis, scope: activeGrant.scope, now });
    return entitlementAllowsCoaching(entitlement, now.toISOString()).allowed
      ? 'webhook_confirmed'
      : 'lifecycle_pending';
  } catch {
    return 'lifecycle_pending';
  }
}

export default async function handler(req, res) {
  setJsonHeaders(res, 'GET,OPTIONS');
  if (!applyExactOriginCors(req, res, { methods: 'GET,OPTIONS' })) {
    return res.status(403).json({ ok: false, error: 'origin_not_allowed' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const sessionId = boundedText(req.query?.session_id, 120);
  const productKey = boundedText(req.query?.product_key, 80);

  if (!sessionId) {
    return res.status(400).json({ ok: false, error: 'checkout_session_required' });
  }

  let redis;
  try {
    redis = createRedisClient();
    const idSet = new Set();

    for (const id of await grantIdsFromIndex(redis, accessGrantBySessionKey(sessionId))) idSet.add(id);

    const grants = await loadGrants(redis, Array.from(idSet), productKey);
    const subscriptionState = await loadSubscriptionState(redis, grants);
    const paymentTruth = await resolveAccessPaymentTruth({ redis, grants });

    return res.status(200).json({
      ok: true,
      access_found: grants.length > 0,
      grants: grants.map(compactGrant),
      subscription_state: compactSubscriptionState(subscriptionState),
      payment_truth: paymentTruth
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'stripe_access_status_unavailable' });
  } finally {
    if (redis) await redis.quit();
  }
}
