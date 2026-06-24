import {
  accessGrantByAssessmentKey,
  accessGrantByEmailKey,
  accessGrantByProfileKey,
  accessGrantBySessionKey,
  accessGrantKey,
  boundedText,
  compactGrant,
  compactSubscriptionState,
  createRedisClient,
  readJson,
  sanitizeEmail,
  setJsonHeaders,
  subscriptionStateKey
} from './shared.js';

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

export default async function handler(req, res) {
  setJsonHeaders(res, 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const email = sanitizeEmail(req.query?.email);
  const profileId = boundedText(req.query?.profile_id, 120);
  const assessmentId = boundedText(req.query?.assessment_id, 120);
  const sessionId = boundedText(req.query?.session_id, 120);
  const productKey = boundedText(req.query?.product_key, 80);

  if (!email && !profileId && !assessmentId && !sessionId) {
    return res.status(400).json({ ok: false, error: 'stripe_access_identifier_required' });
  }

  let redis;
  try {
    redis = createRedisClient();
    const idSet = new Set();

    if (email) {
      for (const id of await grantIdsFromIndex(redis, accessGrantByEmailKey(email))) idSet.add(id);
    }
    if (profileId) {
      for (const id of await grantIdsFromIndex(redis, accessGrantByProfileKey(profileId))) idSet.add(id);
    }
    if (assessmentId) {
      for (const id of await grantIdsFromIndex(redis, accessGrantByAssessmentKey(assessmentId))) idSet.add(id);
    }
    if (sessionId) {
      for (const id of await grantIdsFromIndex(redis, accessGrantBySessionKey(sessionId))) idSet.add(id);
    }

    const grants = await loadGrants(redis, Array.from(idSet), productKey);
    const activeGrant = grants.find((grant) => grant.status === 'active');
    const subscriptionState = await loadSubscriptionState(redis, grants);

    return res.status(200).json({
      ok: true,
      access_found: grants.length > 0,
      grants: grants.map(compactGrant),
      subscription_state: compactSubscriptionState(subscriptionState),
      payment_truth: activeGrant ? 'webhook_confirmed' : 'not_found'
    });
  } catch {
    return res.status(500).json({ ok: false, error: 'stripe_access_status_unavailable' });
  } finally {
    if (redis) await redis.quit();
  }
}
