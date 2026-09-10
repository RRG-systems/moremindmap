/* global Buffer, process */

import crypto from 'node:crypto';
import { getCanonicalProfile } from '../business-assessment/shared.js';
import { provisionRecruitingAdmin } from '../engine/recruitingV1/provisioning.js';
import { getRecruitingRedis, RedisRecruitingStore } from '../engine/recruitingV1/redisStore.js';
import { getRecruitingService } from '../engine/recruitingV1/runtime.js';
import { createRecruitingHttpHandler } from '../engine/recruitingV1/http.js';
import { createTokenWrapper, digestToken, normalizeEmail, stableHash } from '../../src/lib/recruitingV1/contracts.js';

const CUSTOM_ENVIRONMENT = 'subscription-canary';
const CONTROLLER_BRANCH = 'codex/home-base-v2-release5-canary-controller-v1';
const RECRUITING_NAMESPACE = 'preview:recruiting-v1:release5_20260909_v1';
const ADMIN_PROFILE_ID = 'mm-20990909-r5adm001';
const STANDARD_PROFILE_ID = 'mm-20990909-r5mgr001';
const ADMIN_ENTERPRISE_ID = 'release5-canary-admin';
const STANDARD_ENTERPRISE_ID = 'release5-canary-standard';
const SYNTHETIC_MARKER = 'RELEASE5_RECRUITING_TWO_BOX_CANARY_SYNTHETIC_ONLY';
const STABLE_HOST = 'moremindmap-env-subscription-canary-rrg-systems-projects.vercel.app';
const HISTORICAL_KEY_PATTERNS = Object.freeze([
  ['historical_release4_leadership_demo', /^more:leadership-demo:v1:(?:entry-csrf:[a-f0-9]{64}|entry-rate:[a-f0-9]{32}|launcher:[a-f0-9]{64}|launcher-csrf:[a-f0-9]{64}:[a-f0-9]{64}|launch-rate:[a-f0-9]{64})$/u],
  ['historical_release4_subscription_runtime', /^more:subscription-v1:internal-dev:v1:(?:relationship:[a-f0-9]{64}|capability:[a-f0-9]{64}|subject-switch-csrf:[a-f0-9]{64}:[a-f0-9]{64}|runtime-csrf:[a-f0-9]{64}:[a-f0-9]{64}|(?:living|living-backup|living-lock|allowance-backup|allowance-lock|research|diagnostics|s2-relationship):[a-f0-9]{64}|allowance:[a-f0-9]{64}:\d{4}-\d{2})$/u],
  ['historical_release4_subscription_blind', /^more:subscription-blind:v1:(?:selection:[a-f0-9]{64}|lock:[a-f0-9]{64}|history:rel_[a-f0-9]{20})$/u],
]);

function json(res, status, body) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function secureCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length >= 32 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function authorized(req) {
  const supplied = String(req.headers?.authorization || '').replace(/^Bearer\s+/u, '');
  return safeEqual(supplied, process.env.RELEASE5_CANARY_CONTROLLER_SECRET);
}

function boundaryValid() {
  const expiresAt = Date.parse(process.env.RELEASE5_CANARY_CONTROLLER_EXPIRES_AT || '');
  return process.env.RELEASE5_CANARY_CONTROLLER_ENABLED === 'true'
    && process.env.RELEASE5_CANARY_ENVIRONMENT === CUSTOM_ENVIRONMENT
    && process.env.VERCEL_ENV === 'preview'
    && process.env.VERCEL_TARGET_ENV === CUSTOM_ENVIRONMENT
    && process.env.VERCEL_GIT_COMMIT_REF === CONTROLLER_BRANCH
    && Number.isFinite(expiresAt) && expiresAt > Date.now()
    && process.env.RECRUITING_V1_NAMESPACE === RECRUITING_NAMESPACE
    && process.env.RECRUITING_V1_SYNTHETIC_REVIEW === 'false'
    && process.env.RECRUITING_PUBLIC_BASE_URL === `https://${STABLE_HOST}`
    && process.env.NEW_BOS_DERIVED_NAMESPACE === 'preview:new-bos:release5-two-box-20260909'
    && process.env.NEW_BA_DERIVED_NAMESPACE === 'preview:new-ba:release5-two-box-20260909'
    && process.env.NEW_BA_BOS_NAMESPACE === 'preview:new-bos:release5-two-box-20260909'
    && Boolean(process.env.REDIS_URL)
    && Boolean(process.env.RECRUITING_TOKEN_WRAP_KEY)
    && Boolean(process.env.RECRUITING_RESEND_API_KEY)
    && Boolean(process.env.RECRUITING_EMAIL_FROM)
    && Boolean(process.env.PUBLIC_INQUIRY_EMAIL_TO);
}

function requestHost(req) {
  return String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();
}

function approvedRecipients() {
  const configuredSender = String(process.env.RECRUITING_EMAIL_FROM || '').trim();
  const senderMatch = configuredSender.match(/<([^<>]+)>\s*$/u);
  const admin = normalizeEmail(senderMatch?.[1] || configuredSender);
  const standard = normalizeEmail(process.env.PUBLIC_INQUIRY_EMAIL_TO);
  if (!admin || !standard || admin === standard) throw new Error('RELEASE5_DISTINCT_APPROVED_TEST_RECIPIENTS_REQUIRED');
  return Object.freeze({ admin, standard, recruit: standard });
}

function profileEnvelope(profileId, personName, primary, secondary) {
  const canonicalDimension = Object.freeze({
    Command: 'vector', Tempo: 'velocity', Signal: 'signal', Fidelity: 'fidelity',
    Leverage: 'leverage', Adaptability: 'flex', Structure: 'framework', Perspective: 'horizon',
  });
  const ordered = [...new Set([primary, secondary, ...Object.keys(canonicalDimension)])];
  const scores = [8.2, 7.4, 6.7, 6.3, 5.9, 5.6, 5.2, 4.8];
  const hints = [
    'Clear direction with bounded evidence.',
    'Adapts while preserving explicit commitments.',
    'Notices relationship and operating context.',
    'Checks details before making durable claims.',
    'Moves deliberately through governed decisions.',
    'Uses explicit systems without overclaiming certainty.',
    'Adjusts within agreed authority boundaries.',
    'Builds repeatable capacity from verified inputs.',
  ];
  const dimensions = ordered.map((dimension, index) => [
    dimension, scores[index], index < 2 ? 'high' : index < 7 ? 'balanced' : 'developing', hints[index],
  ]);
  return {
    profile_id: profileId,
    person_name: personName,
    created_at: '2099-09-09T00:00:00.000Z',
    synthetic_only: true,
    real_customer_data: false,
    provider_generated: false,
    canary_id: 'release5-recruiting-two-box-20260909',
    synthetic_marker: SYNTHETIC_MARKER,
    canonical_profile_json: {
      profile_id: profileId,
      person_name: personName,
      profile_type: `${primary} / ${secondary}`,
      synthetic_only: true,
      synthetic_marker: SYNTHETIC_MARKER,
      assessment_version: 'release5_canary_synthetic_v1',
      intake_answers: [
        {
          question_id: 'release5_scope',
          question_type: 'written',
          question_text: 'What is the scope of this profile?',
          answer_text: 'Isolated synthetic Recruiting canary verification only; it is not a customer profile.',
        },
        {
          question_id: 'release5_authority',
          question_type: 'written',
          question_text: 'What authority does this evidence provide?',
          answer_text: 'Only bounded Preview QA authority for the named Release 5 canary.',
        },
      ],
      vector_scores: Object.fromEntries(dimensions.map(([dimension, score]) => [canonicalDimension[dimension], score])),
      rescoring_gpt: {
        ranked_dimensions: dimensions.map(([dimension, display_score, band, narrative_hint]) => ({
          dimension, display_score, band, narrative_hint,
        })),
      },
      narrative_profile: {
        executive_summary: `${personName} is a synthetic Release 5 canary identity used only for isolated Recruiting verification.`,
      },
      metadata: {
        synthetic_only: true,
        real_customer_data: false,
        provider_generated: false,
        canary_id: 'release5-recruiting-two-box-20260909',
        synthetic_marker: SYNTHETIC_MARKER,
      },
    },
  };
}

const SYNTHETIC_PROFILE_IDS = new Set([ADMIN_PROFILE_ID, STANDARD_PROFILE_ID]);

function expectedProfiles() {
  return Object.freeze({
    [ADMIN_PROFILE_ID]: profileEnvelope(
      ADMIN_PROFILE_ID,
      'Darren Release 5 Canary',
      'Command',
      'Perspective',
    ),
    [STANDARD_PROFILE_ID]: profileEnvelope(
      STANDARD_PROFILE_ID,
      'Release 5 Standard Manager',
      'Signal',
      'Structure',
    ),
  });
}

function keyClass(key) {
  const historical = HISTORICAL_KEY_PATTERNS.find(([, pattern]) => pattern.test(key));
  if (historical) {
    if (/:(?:lock|living-lock|allowance-lock):/u.test(key)) return 'inactive_lock_forbidden';
    return historical[0];
  }
  if (key === `more:${RECRUITING_NAMESPACE}:state:v1`) return 'release5_recruiting_state';
  if (key === `more:${RECRUITING_NAMESPACE}:lock:v1`) return 'live_lock_forbidden';
  if (key.startsWith('vault:profile:') && SYNTHETIC_PROFILE_IDS.has(key.slice('vault:profile:'.length))) {
    return 'release5_synthetic_manager_profile';
  }
  return 'unclassified_preserved';
}

function parseObject(raw) {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

function containsPrivateIdentityShape(value) {
  const raw = JSON.stringify(value);
  return /"(?:[^"]*_)?(?:email|phone|customer_id|person_id|stripe_customer_id|stripe_subscription_id)"\s*:/iu.test(raw)
    || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(raw);
}

async function historicalValueValid(redis, key, keyClassName) {
  const type = await redis.type(key);
  if (keyClassName === 'historical_release4_leadership_demo') {
    if (type !== 'string') return false;
    const raw = await redis.get(key);
    if (key.includes(':entry-csrf:')) return /^[a-f0-9]{32}$/u.test(raw || '');
    if (key.includes(':entry-rate:') || key.includes(':launch-rate:')) return /^\d{1,6}$/u.test(raw || '');
    if (key.includes(':launcher-csrf:')) return raw === 'active';
    const value = parseObject(raw);
    const allowedProducts = [
      ['recruiting', 'subscription'],
      ['recruiting', 'subscription', 'athlete-consulting-tool'],
    ];
    return value?.contract === 'leadership_demo_launcher_capability_v1'
      && value.synthetic_only === true
      && allowedProducts.some((allowed) => JSON.stringify(value.allowed_products) === JSON.stringify(allowed))
      && /^leadership_demo_[a-f0-9]{24}$/u.test(value.launcher_scope_id || '')
      && /^[a-f0-9]{32}$/u.test(value.browser_binding_hash || '')
      && Number.isFinite(Date.parse(value.issued_at))
      && Number.isFinite(Date.parse(value.expires_at))
      && !containsPrivateIdentityShape(value);
  }
  if (keyClassName === 'historical_release4_subscription_runtime') {
    if (key.includes(':diagnostics:')) {
      if (type !== 'list') return false;
      if (await redis.llen(key) > 100) return false;
      const entries = await redis.lrange(key, 0, 100);
      return entries.every((raw) => {
        const value = parseObject(raw);
        return value?.raw_provider_payload_persisted === false
          && !containsPrivateIdentityShape(value)
          && (value.receipts || []).every((receipt) => receipt?.raw_payload_persisted === false);
      });
    }
    if (type !== 'string') return false;
    const raw = await redis.get(key);
    if (key.includes(':subject-switch-csrf:') || key.includes(':runtime-csrf:')) return raw === 'active';
    const value = parseObject(raw);
    if (!value) return false;
    if (key.includes(':relationship:')) {
      return value.synthetic_only === true && value.subject_key === 're-mid'
        && /^rel_[a-f0-9]{20}$/u.test(value.relationship_key || '') && !containsPrivateIdentityShape(value);
    }
    if (key.includes(':capability:')) {
      return value.contract === 'subscription_v1_internal_capability_v2'
        && value.synthetic_only === true && value.billing_evidence === false
        && value.stripe_subscription_created === false && value.subject_key === 're-mid'
        && value.demo_subject_id === 'synthetic' && /^rel_[a-f0-9]{20}$/u.test(value.relationship_key || '')
        && !containsPrivateIdentityShape(value);
    }
    if (key.includes(':s2-relationship:')) {
      return value.contract === 'SUBSCRIPTION_FLAGSHIP_S2_FIRST_SESSION_RELATIONSHIP_EVENT_V1'
        && value.synthetic_only === true && value.canonical_mutation_performed === false
        && value.personal_rsl_mutation_performed === false && !containsPrivateIdentityShape(value);
    }
    if (key.includes(':research:')) {
      return Array.isArray(value) && value.every((item) => String(item?.external_evidence_id || '')
        && String(item?.source_url || '').startsWith('https://')) && !containsPrivateIdentityShape(value);
    }
    const scoped = raw.includes('tenant_synthetic_subscription_founder_demo')
      && raw.includes('SYNTHETIC-SUBSCRIPTION-RE-MID')
      && raw.includes('subject_synthetic_subscription_re_mid')
      && raw.includes('membership_synthetic_subscription_re_mid')
      && raw.includes('business_synthetic_subscription_re_mid');
    return scoped && !containsPrivateIdentityShape(value);
  }
  if (keyClassName === 'historical_release4_subscription_blind') {
    if (type !== 'string') return false;
    const value = parseObject(await redis.get(key));
    if (!value || containsPrivateIdentityShape(value)) return false;
    if (key.includes(':selection:')) {
      return value.contract === 'subscription-frontier-blind-v1'
        && ['1', '2'].includes(value.selection)
        && key.endsWith(`:${value.root}`);
    }
    if (key.includes(':history:')) {
      return key.endsWith(`:${value.relationship_key}`)
        && /^rel_[a-f0-9]{20}$/u.test(value.relationship_key || '')
        && Array.isArray(value.messages)
        && value.messages.every((message) => ['customer', 'coach', 'gu'].includes(message?.role));
    }
  }
  return false;
}

async function inspectKeys(redis) {
  const before = await redis.dbsize();
  let cursor = '0';
  const keys = new Set();
  let iterations = 0;
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', '*', 'COUNT', 250);
    cursor = next;
    for (const key of batch) keys.add(key);
    iterations += 1;
    if (keys.size > 5000 || iterations > 200) throw new Error('RELEASE5_REDIS_SCAN_BOUND_EXCEEDED');
  } while (cursor !== '0');
  const after = await redis.dbsize();
  const classes = {};
  let invalidScoped = 0;
  for (const key of keys) {
    const classified = keyClass(key);
    classes[classified] = (classes[classified] || 0) + 1;
    if (classified.startsWith('historical_release4_') && !await historicalValueValid(redis, key, classified)) {
      invalidScoped += 1;
    }
    if (classified === 'release5_recruiting_state') {
      const type = await redis.type(key);
      const state = type === 'string' ? parseObject(await redis.get(key)) : null;
      try { assertBootstrapStateSafe(state); } catch { invalidScoped += 1; }
    }
    if (classified === 'release5_synthetic_manager_profile') {
      const profileId = key.slice('vault:profile:'.length);
      const expected = expectedProfiles()[profileId];
      if (!expected || await redis.type(key) !== 'string'
          || await redis.get(key) !== JSON.stringify(expected)) invalidScoped += 1;
    }
  }
  if (invalidScoped) classes.scoped_value_invalid = invalidScoped;
  return {
    stable: before === after && after === keys.size,
    total: after,
    classes,
    unexpected: (classes.unclassified_preserved || 0)
      + (classes.live_lock_forbidden || 0)
      + (classes.inactive_lock_forbidden || 0)
      + invalidScoped,
  };
}

function assertBootstrapStateSafe(state) {
  if (!state || state.version !== 4) throw new Error('RELEASE5_RECRUITING_STATE_VERSION_INVALID');
  const expectedTopLevel = new Set([
    'version', 'memberships', 'manager_challenges', 'manager_sessions', 'manager_csrf_proofs',
    'manager_setup_challenges', 'manager_setup_sessions', 'manager_setup_csrf_proofs', 'invite_sessions',
    'profile_connection_challenges', 'invitations', 'opportunity_by_enterprise', 'evidence_by_candidate',
    'intelligence_by_candidate', 'consultation_requests', 'consultation_relationships',
    'shared_business_sessions', 'gu_effect_outbox', 'outbox', 'inbox_by_membership', 'audit',
  ]);
  if (Object.keys(state).length !== expectedTopLevel.size
      || [...expectedTopLevel].some((key) => !Object.hasOwn(state, key))) {
    throw new Error('RELEASE5_RECRUITING_STATE_UNKNOWN_BUCKET');
  }
  const mapBuckets = [...expectedTopLevel].filter((key) => !['version', 'audit'].includes(key));
  if (mapBuckets.some((key) => !state[key] || typeof state[key] !== 'object' || Array.isArray(state[key]))
      || !Array.isArray(state.audit)) throw new Error('RELEASE5_RECRUITING_STATE_BUCKET_INVALID');
  const memberships = Object.values(state.memberships || {});
  const expectedAdmin = memberships.find((item) => item.manager_profile_id === ADMIN_PROFILE_ID);
  const unexpectedMemberships = memberships.filter((item) => item.manager_profile_id !== ADMIN_PROFILE_ID);
  const adminIdentity = stableHash({ profile_id: ADMIN_PROFILE_ID, enterprise_id: ADMIN_ENTERPRISE_ID });
  const expectedMembershipId = `membership_admin_${adminIdentity.slice(0, 24)}`;
  const expectedSubjectId = `manager_admin_${adminIdentity.slice(24, 48)}`;
  const expectedAdminKeys = new Set([
    'membership_id', 'manager_subject_id', 'manager_profile_id', 'manager_name', 'manager_email',
    'enterprise_id', 'enterprise_name', 'status', 'setup_state', 'entitlement_mode', 'admin_roles',
    'recruiting_governance', 'created_at', 'updated_at', 'profile_bound_at', 'setup_completed_at',
    'authority_source',
  ]);
  const exactAdmin = !expectedAdmin || (
    Object.keys(expectedAdmin).length === expectedAdminKeys.size
      && Object.keys(expectedAdmin).every((key) => expectedAdminKeys.has(key))
      && expectedAdmin.membership_id === expectedMembershipId
      && expectedAdmin.manager_subject_id === expectedSubjectId
      && expectedAdmin.manager_profile_id === ADMIN_PROFILE_ID
      && expectedAdmin.manager_name === 'Darren Release 5 Canary'
      && expectedAdmin.manager_email === approvedRecipients().admin
      && expectedAdmin.enterprise_id === ADMIN_ENTERPRISE_ID
      && expectedAdmin.enterprise_name === 'MORE MindMap Release 5 Canary'
      && expectedAdmin.status === 'ACTIVE'
      && expectedAdmin.setup_state === 'COMPLETE'
      && expectedAdmin.entitlement_mode === 'unlimited'
      && JSON.stringify(expectedAdmin.admin_roles) === JSON.stringify(['RECRUITING_ADMIN'])
      && expectedAdmin.recruiting_governance?.all_enterprises === true
      && JSON.stringify(expectedAdmin.recruiting_governance?.enterprise_ids) === '[]'
      && JSON.stringify(Object.keys(expectedAdmin.recruiting_governance).sort()) === JSON.stringify(['all_enterprises', 'enterprise_ids'])
      && expectedAdmin.authority_source === 'SERVER_HELD_REVIEWED_PROVISIONING_INPUT'
      && Number.isFinite(Date.parse(expectedAdmin.created_at))
      && expectedAdmin.created_at === expectedAdmin.updated_at
      && expectedAdmin.created_at === expectedAdmin.profile_bound_at
      && expectedAdmin.created_at === expectedAdmin.setup_completed_at
  );
  if (unexpectedMemberships.length
      || memberships.length > 1
      || (expectedAdmin && JSON.stringify(Object.keys(state.memberships)) !== JSON.stringify([expectedMembershipId]))
      || !exactAdmin
      || Object.keys(state.invitations || {}).length
      || Object.keys(state.manager_challenges || {}).length
      || Object.keys(state.manager_sessions || {}).length
      || Object.keys(state.manager_csrf_proofs || {}).length
      || Object.keys(state.manager_setup_challenges || {}).length
      || Object.keys(state.manager_setup_sessions || {}).length
      || Object.keys(state.manager_setup_csrf_proofs || {}).length
      || Object.keys(state.invite_sessions || {}).length
      || Object.keys(state.profile_connection_challenges || {}).length
      || Object.keys(state.outbox || {}).length
      || Object.keys(state.opportunity_by_enterprise || {}).length
      || Object.keys(state.evidence_by_candidate || {}).length
      || Object.keys(state.intelligence_by_candidate || {}).length
      || Object.keys(state.consultation_requests || {}).length
      || Object.keys(state.consultation_relationships || {}).length
      || Object.keys(state.shared_business_sessions || {}).length
      || Object.keys(state.gu_effect_outbox || {}).length
      || Object.keys(state.inbox_by_membership || {}).length
      || (expectedAdmin
        ? state.audit?.length !== 1
          || Object.keys(state.audit[0] || {}).length !== 6
          || state.audit[0]?.event_id !== `audit_${stableHash({ membership_id: expectedMembershipId, timestamp: expectedAdmin.created_at }).slice(0, 24)}`
          || state.audit[0]?.event_type !== 'RECRUITING_ADMIN_MEMBERSHIP_PROVISIONED'
          || state.audit[0]?.occurred_at !== expectedAdmin.created_at
          || state.audit[0]?.membership_id !== expectedMembershipId
          || state.audit[0]?.target_membership_id !== expectedMembershipId
          || state.audit[0]?.authority_source !== 'SERVER_HELD_REVIEWED_PROVISIONING_INPUT'
        : (state.audit || []).length !== 0)) {
    throw new Error('RELEASE5_RECRUITING_BOOTSTRAP_STATE_NOT_PRISTINE');
  }
}

async function seedProfilesAtomically(redis) {
  const profiles = expectedProfiles();
  const lowerKeys = [ADMIN_PROFILE_ID, STANDARD_PROFILE_ID].map((profileId) => `vault:profile:${profileId}`);
  const upperKeys = [ADMIN_PROFILE_ID, STANDARD_PROFILE_ID]
    .map((profileId) => `vault:profile:MM-${profileId.slice(3, 12)}${profileId.slice(12)}`);
  const expectedBytes = [JSON.stringify(profiles[ADMIN_PROFILE_ID]), JSON.stringify(profiles[STANDARD_PROFILE_ID])];
  const before = await redis.mget(lowerKeys[0], upperKeys[0], lowerKeys[1], upperKeys[1]);
  const initiallyEmpty = before.every((value) => value == null);
  if (initiallyEmpty) {
    const created = await redis.msetnx(lowerKeys[0], expectedBytes[0], lowerKeys[1], expectedBytes[1]);
    if (created !== 1) throw new Error('RELEASE5_SYNTHETIC_PROFILE_ATOMIC_CREATE_LOST');
  }
  const after = await redis.mget(lowerKeys[0], upperKeys[0], lowerKeys[1], upperKeys[1]);
  if (after[0] !== expectedBytes[0] || after[1] != null || after[2] !== expectedBytes[1] || after[3] != null) {
    throw new Error('RELEASE5_SYNTHETIC_PROFILE_COLLISION');
  }
  return { created: initiallyEmpty };
}

async function bootstrap(redis) {
  const inventory = await inspectKeys(redis);
  if (!inventory.stable || inventory.unexpected !== 0) throw new Error('RELEASE5_REDIS_PREFLIGHT_STOP');
  const store = new RedisRecruitingStore(redis, { namespace: RECRUITING_NAMESPACE });
  assertBootstrapStateSafe(await store.read());
  const profiles = await seedProfilesAtomically(redis);
  const admin = await provisionRecruitingAdmin({
    store,
    profileValidator: async (profileId) => {
      const profile = await getCanonicalProfile(redis, profileId);
      return { found: profile.found === true, profile_id: profile.profile_id || profileId };
    },
    input: {
      contract: 'recruiting_admin_provisioning_v1',
      confirm_server_held_authority: true,
      confirm_role: 'RECRUITING_ADMIN',
      confirm_entitlement: 'unlimited',
      all_enterprises: true,
      manager_profile_id: ADMIN_PROFILE_ID,
      manager_email: approvedRecipients().admin,
      manager_name: 'Darren Release 5 Canary',
      enterprise_id: ADMIN_ENTERPRISE_ID,
      enterprise_name: 'MORE MindMap Release 5 Canary',
    },
  });
  const after = await inspectKeys(redis);
  if (!after.stable || after.unexpected !== 0
      || after.classes.release5_synthetic_manager_profile !== 2
      || after.classes.release5_recruiting_state !== 1) {
    throw new Error('RELEASE5_REDIS_POST_BOOTSTRAP_STOP');
  }
  return {
    managerProfilesCreated: profiles.created,
    adminCreated: admin.created,
    adminIdempotent: admin.idempotent,
  };
}

function managerCookiePair(header) {
  const values = Array.isArray(header) ? header : [header];
  for (const value of values.filter(Boolean)) {
    const match = String(value).match(/(?:^|[,;]\s*)(__Host-more_recruiting_manager=[^;,]+)/u);
    if (match) return match[1];
  }
  return null;
}

function managerCookieFromRequest(req) {
  return String(req.headers?.cookie || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('__Host-more_recruiting_manager=')) || null;
}

function managerTokenFromCookie(cookie) {
  const index = String(cookie || '').indexOf('=');
  if (index < 1) throw new Error('RELEASE5_MANAGER_COOKIE_INVALID');
  const token = decodeURIComponent(String(cookie).slice(index + 1));
  if (!token) throw new Error('RELEASE5_MANAGER_COOKIE_INVALID');
  return token;
}

function internalResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

async function invokeRecruiting(handler, { method, query = {}, headers = {}, body = {} }) {
  const response = internalResponse();
  await handler({
    method,
    query,
    body,
    headers: {
      host: STABLE_HOST,
      'x-forwarded-host': STABLE_HOST,
      'x-forwarded-proto': 'https',
      origin: `https://${STABLE_HOST}`,
      ...headers,
    },
  }, response);
  if (response.statusCode !== 200 || response.body?.ok !== true) {
    throw new Error(String(response.body?.code || `RELEASE5_RECRUITING_HTTP_${response.statusCode || 500}`).split(':')[0]);
  }
  return response;
}

async function rotateAuthenticated(handler, req, view) {
  const incoming = managerCookieFromRequest(req);
  if (!incoming) throw new Error('RELEASE5_MANAGER_COOKIE_REQUIRED');
  const read = await invokeRecruiting(handler, {
    method: 'GET', query: { view }, headers: { cookie: incoming },
  });
  const cookie = managerCookiePair(read.headers['set-cookie']);
  if (!cookie || !read.body?.csrf_token) throw new Error('RELEASE5_MANAGER_ROTATION_FAILED');
  return { cookie, csrf: read.body.csrf_token, body: read.body };
}

function safeWorkflowResult(response, extra = {}) {
  const receipt = response?.body?.delivery?.provider_receipt;
  return {
    ok: true,
    ...extra,
    deliveryState: response?.body?.delivery?.state || null,
    providerReceiptPresent: typeof receipt === 'string' && receipt.startsWith('resend:'),
    valuesExposed: false,
  };
}

function currentDeliveredOutbox(state, { kind, membershipId, invitationId = null, generation = null }) {
  return Object.values(state.outbox || {}).filter((item) => item.kind === kind
      && item.membership_id === membershipId
      && (invitationId === null || item.invitation_id === invitationId)
      && (generation === null || item.payload?.setup_generation === generation)
      && item.state === 'DELIVERED'
      && String(item.provider_receipt || '').startsWith('resend:'))
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0] || null;
}

function assertStandardMembershipExact(membership) {
  const recipients = approvedRecipients();
  if (membership.manager_profile_id !== STANDARD_PROFILE_ID
      || membership.manager_email !== recipients.standard
      || membership.manager_name !== 'Release 5 Standard Manager'
      || membership.enterprise_id !== STANDARD_ENTERPRISE_ID
      || membership.enterprise_name !== 'Release 5 Canary Standard'
      || membership.entitlement_mode !== '5_per_month'
      || (membership.admin_roles || []).length !== 0
      || membership.recruiting_governance?.all_enterprises !== false
      || JSON.stringify(membership.recruiting_governance?.enterprise_ids || []) !== JSON.stringify([STANDARD_ENTERPRISE_ID])
      || ['SUSPENDED', 'REVOKED'].includes(membership.status)) {
    throw new Error('RELEASE5_STANDARD_MANAGER_STATE_MISMATCH');
  }
}

function assertAdminMembershipExact(membership) {
  const identity = stableHash({ profile_id: ADMIN_PROFILE_ID, enterprise_id: ADMIN_ENTERPRISE_ID });
  if (membership.membership_id !== `membership_admin_${identity.slice(0, 24)}`
      || membership.manager_subject_id !== `manager_admin_${identity.slice(24, 48)}`
      || membership.manager_profile_id !== ADMIN_PROFILE_ID
      || membership.manager_email !== approvedRecipients().admin
      || membership.manager_name !== 'Darren Release 5 Canary'
      || membership.enterprise_id !== ADMIN_ENTERPRISE_ID
      || membership.enterprise_name !== 'MORE MindMap Release 5 Canary'
      || membership.status !== 'ACTIVE'
      || membership.setup_state !== 'COMPLETE'
      || membership.entitlement_mode !== 'unlimited'
      || JSON.stringify(membership.admin_roles) !== JSON.stringify(['RECRUITING_ADMIN'])
      || membership.recruiting_governance?.all_enterprises !== true
      || JSON.stringify(membership.recruiting_governance?.enterprise_ids) !== '[]'
      || membership.authority_source !== 'SERVER_HELD_REVIEWED_PROVISIONING_INPUT') {
    throw new Error('RELEASE5_ADMIN_MEMBERSHIP_STATE_MISMATCH');
  }
}

async function createStandardManagerViaHttp(redis, req, res) {
  const service = getRecruitingService(process.env);
  const http = createRecruitingHttpHandler({ service, env: process.env, executionStore: null });
  const auth = await rotateAuthenticated(http, req, 'master_control');
  if (!auth.body?.capabilities?.master_control && auth.body?.default_view !== 'ALL_AUTHORIZED_MEMBERSHIPS') {
    throw new Error('RELEASE5_ADMIN_SESSION_REQUIRED');
  }
  const inspectedAdmin = await service.inspectManagerReadOnly(managerTokenFromCookie(auth.cookie));
  assertAdminMembershipExact(inspectedAdmin.membership);
  const state = await readState(redis);
  const existing = Object.values(state.memberships || {}).find((item) =>
    item.manager_profile_id === STANDARD_PROFILE_ID || item.manager_email === approvedRecipients().standard);
  if (existing) {
    assertStandardMembershipExact(existing);
    res.setHeader('Set-Cookie', `${auth.cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${8 * 60 * 60}`);
    if (existing.status === 'ACTIVE' && existing.setup_state === 'COMPLETE') {
      return json(res, 200, safeWorkflowResult(null, {
        idempotent: true, membershipId: existing.membership_id, membershipStatus: existing.status, setupState: existing.setup_state,
      }));
    }
    if (existing.status !== 'PENDING_SETUP') throw new Error('RELEASE5_STANDARD_MANAGER_NOT_RESUMABLE');
    const current = currentDeliveredOutbox(state, {
      kind: 'MANAGER_SETUP', membershipId: existing.membership_id, generation: existing.setup_generation,
    });
    if (current) {
      return json(res, 200, safeWorkflowResult({ body: { delivery: { state: current.state, provider_receipt: current.provider_receipt } } }, {
        idempotent: true, membershipId: existing.membership_id, membershipStatus: existing.status,
        setupState: existing.setup_state, outboxId: current.outbox_id,
      }));
    }
  }
  const action = existing ? 'ADMIN_RESEND_MANAGER_SETUP' : 'ADMIN_CREATE_MANAGER';
  const mutation = await invokeRecruiting(http, {
    method: 'POST',
    headers: {
      cookie: auth.cookie,
      'x-recruiting-csrf': auth.csrf,
      'idempotency-key': 'release5-canary-standard-manager-20260909-v1',
    },
    body: existing ? {
      action, membership_id: existing.membership_id,
    } : {
      action,
      manager_name: 'Release 5 Standard Manager',
      manager_email: approvedRecipients().standard,
      manager_profile_id: STANDARD_PROFILE_ID,
      enterprise_id: STANDARD_ENTERPRISE_ID,
      enterprise_name: 'Release 5 Canary Standard',
    },
  });
  const nextCookie = managerCookiePair(mutation.headers['set-cookie']);
  if (!nextCookie || mutation.body?.delivery?.state !== 'DELIVERED'
      || !String(mutation.body?.delivery?.provider_receipt || '').startsWith('resend:')) {
    throw new Error('RELEASE5_STANDARD_MANAGER_WORKFLOW_INCOMPLETE');
  }
  res.setHeader('Set-Cookie', `${nextCookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${8 * 60 * 60}`);
  return json(res, 200, safeWorkflowResult(mutation, {
    idempotent: Boolean(existing), membershipId: mutation.body?.membership?.membership_id,
    membershipStatus: mutation.body?.membership?.status, setupState: mutation.body?.membership?.setup_state,
    outboxId: mutation.body?.outbox_id,
  }));
}

function assertInvitationExact(invitation, membership) {
  if (invitation.membership_id !== membership.membership_id
      || invitation.manager_subject_id !== membership.manager_subject_id
      || invitation.enterprise_id !== STANDARD_ENTERPRISE_ID
      || invitation.recruit_name !== 'Release 5 Synthetic Recruit'
      || invitation.recruit_email !== approvedRecipients().recruit
      || invitation.purpose !== 'Synthetic Release 5 Recruiting two-box canary proof only.'
      || invitation.idempotency_key !== 'release5-canary-recruit-20260909-v1'
      || ['REVOKED', 'EXPIRED'].includes(invitation.state)) {
    throw new Error('RELEASE5_RECRUIT_INVITATION_STATE_MISMATCH');
  }
}

async function createRecruitInviteViaHttp(redis, req, res) {
  const service = getRecruitingService(process.env);
  const http = createRecruitingHttpHandler({ service, env: process.env, executionStore: null });
  const auth = await rotateAuthenticated(http, req, 'home');
  const inspectedManager = await service.inspectManagerReadOnly(managerTokenFromCookie(auth.cookie));
  const state = await readState(redis);
  const membership = Object.values(state.memberships || {}).find((item) => item.manager_profile_id === STANDARD_PROFILE_ID);
  if (!membership) throw new Error('RELEASE5_STANDARD_MANAGER_NOT_FOUND');
  assertStandardMembershipExact(membership);
  if (inspectedManager.membership?.membership_id !== membership.membership_id
      || inspectedManager.membership?.manager_subject_id !== membership.manager_subject_id
      || inspectedManager.membership?.manager_profile_id !== STANDARD_PROFILE_ID
      || inspectedManager.membership?.enterprise_id !== STANDARD_ENTERPRISE_ID
      || inspectedManager.capabilities?.master_control !== false) {
    throw new Error('RELEASE5_STANDARD_MANAGER_SESSION_SCOPE_MISMATCH');
  }
  if (membership.status !== 'ACTIVE' || membership.setup_state !== 'COMPLETE') {
    throw new Error('RELEASE5_STANDARD_MANAGER_NOT_ACTIVE');
  }
  const existing = Object.values(state.invitations || {}).find((item) =>
    item.idempotency_key === 'release5-canary-recruit-20260909-v1' || item.recruit_email === approvedRecipients().recruit);
  if (existing) {
    assertInvitationExact(existing, membership);
    const current = currentDeliveredOutbox(state, {
      kind: 'RECRUIT_INVITATION', membershipId: membership.membership_id,
      invitationId: existing.invitation_id,
    });
    res.setHeader('Set-Cookie', `${auth.cookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${8 * 60 * 60}`);
    if (existing.accepted_at) {
      return json(res, 200, safeWorkflowResult(null, {
        idempotent: true, invitationId: existing.invitation_id, invitationState: existing.state,
      }));
    }
    if (current) {
      return json(res, 200, safeWorkflowResult({ body: { delivery: { state: current.state, provider_receipt: current.provider_receipt } } }, {
        idempotent: true, invitationId: existing.invitation_id, invitationState: existing.state, outboxId: current.outbox_id,
      }));
    }
    throw new Error('RELEASE5_RECRUIT_INVITATION_NOT_RESUMABLE');
  }
  const mutation = await invokeRecruiting(http, {
    method: 'POST',
    headers: {
      cookie: auth.cookie,
      'x-recruiting-csrf': auth.csrf,
      'idempotency-key': 'release5-canary-recruit-20260909-v1',
    },
    body: {
      action: 'CREATE_INVITATION',
      recruit_name: 'Release 5 Synthetic Recruit',
      recruit_email: approvedRecipients().recruit,
      purpose: 'Synthetic Release 5 Recruiting two-box canary proof only.',
    },
  });
  const nextCookie = managerCookiePair(mutation.headers['set-cookie']);
  if (!nextCookie || mutation.body?.delivery?.state !== 'DELIVERED'
      || !String(mutation.body?.delivery?.provider_receipt || '').startsWith('resend:')) {
    throw new Error('RELEASE5_RECRUIT_INVITATION_WORKFLOW_INCOMPLETE');
  }
  res.setHeader('Set-Cookie', `${nextCookie}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${8 * 60 * 60}`);
  return json(res, 200, safeWorkflowResult(mutation, {
    idempotent: false, invitationId: mutation.body?.invitation?.invitation_id,
    invitationState: mutation.body?.invitation?.state, outboxId: mutation.body?.outbox_id,
  }));
}

async function readState(redis) {
  return new RedisRecruitingStore(redis, { namespace: RECRUITING_NAMESPACE }).read();
}

async function consumeDeliveredAuth(redis, req, res) {
  const handoff = String(req.body?.handoff || '');
  const kindByHandoff = {
    ADMIN_VERIFY: 'MANAGER_VERIFICATION',
    STANDARD_VERIFY: 'MANAGER_VERIFICATION',
    MANAGER_SETUP: 'MANAGER_SETUP',
    RECRUIT_ACCEPT: 'RECRUIT_INVITATION',
  };
  const kind = kindByHandoff[handoff];
  if (!kind) return json(res, 422, { ok: false, code: 'RELEASE5_REDIRECT_TYPE_INVALID' });
  const outboxId = String(req.body?.outbox_id || '');
  if (!/^outbox_[A-Za-z0-9_-]{12,80}$/u.test(outboxId)) {
    return json(res, 422, { ok: false, code: 'RELEASE5_OUTBOX_ID_INVALID' });
  }
  const state = await readState(redis);
  const item = state.outbox?.[outboxId];
  if (!item || item.kind !== kind || item.state !== 'DELIVERED' || !item.token_capsule
      || !String(item.provider_receipt || '').startsWith('resend:')) {
    return json(res, 409, { ok: false, code: 'RELEASE5_DELIVERED_TOKEN_NOT_FOUND' });
  }
  let membership = null;
  let invitation = null;
  if (handoff === 'ADMIN_VERIFY' || handoff === 'STANDARD_VERIFY') {
    const profileId = handoff === 'ADMIN_VERIFY' ? ADMIN_PROFILE_ID : STANDARD_PROFILE_ID;
    membership = Object.values(state.memberships || {}).find((candidate) => candidate.manager_profile_id === profileId);
    if (!membership || item.membership_id !== membership.membership_id
        || item.enterprise_id !== membership.enterprise_id
        || item.recipient !== approvedRecipients()[handoff === 'ADMIN_VERIFY' ? 'admin' : 'standard']) {
      return json(res, 409, { ok: false, code: 'RELEASE5_MANAGER_HANDOFF_SCOPE_MISMATCH' });
    }
    try {
      if (handoff === 'ADMIN_VERIFY') assertAdminMembershipExact(membership);
      else assertStandardMembershipExact(membership);
    } catch {
      return json(res, 409, { ok: false, code: 'RELEASE5_MANAGER_HANDOFF_SCOPE_MISMATCH' });
    }
    if (membership.status !== 'ACTIVE' || membership.setup_state !== 'COMPLETE') {
      return json(res, 409, { ok: false, code: 'RELEASE5_MANAGER_HANDOFF_STATE_INVALID' });
    }
  } else if (handoff === 'MANAGER_SETUP') {
    membership = Object.values(state.memberships || {}).find((candidate) => candidate.manager_profile_id === STANDARD_PROFILE_ID);
    if (!membership || item.membership_id !== membership.membership_id
        || item.enterprise_id !== membership.enterprise_id
        || item.recipient !== approvedRecipients().standard
        || item.payload?.setup_generation !== membership.setup_generation) {
      return json(res, 409, { ok: false, code: 'RELEASE5_SETUP_HANDOFF_SCOPE_MISMATCH' });
    }
    try { assertStandardMembershipExact(membership); } catch {
      return json(res, 409, { ok: false, code: 'RELEASE5_SETUP_HANDOFF_SCOPE_MISMATCH' });
    }
    if (membership.status !== 'PENDING_SETUP' || !['SETUP_SENT', 'EMAIL_VERIFIED'].includes(membership.setup_state)) {
      return json(res, 409, { ok: false, code: 'RELEASE5_SETUP_HANDOFF_STATE_INVALID' });
    }
  } else {
    const invitationId = String(req.body?.invitation_id || '');
    invitation = state.invitations?.[invitationId];
    if (!invitation || item.invitation_id !== invitationId
        || item.membership_id !== invitation.membership_id
        || item.enterprise_id !== invitation.enterprise_id
        || item.recipient !== approvedRecipients().recruit
        || invitation.recruit_email !== approvedRecipients().recruit
        || item.invitation_token_generation !== invitation.token_generation) {
      return json(res, 409, { ok: false, code: 'RELEASE5_INVITATION_HANDOFF_SCOPE_MISMATCH' });
    }
    const invitationMembership = state.memberships?.[invitation.membership_id];
    try {
      assertStandardMembershipExact(invitationMembership);
      assertInvitationExact(invitation, invitationMembership);
    } catch {
      return json(res, 409, { ok: false, code: 'RELEASE5_INVITATION_HANDOFF_SCOPE_MISMATCH' });
    }
    if (invitationMembership.status !== 'ACTIVE' || invitationMembership.setup_state !== 'COMPLETE') {
      return json(res, 409, { ok: false, code: 'RELEASE5_INVITATION_MANAGER_STATE_INVALID' });
    }
  }
  const token = createTokenWrapper(process.env.RECRUITING_TOKEN_WRAP_KEY).unwrap(item.token_capsule);
  const tokenDigest = digestToken(token);
  const now = Date.now();
  const future = (value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > now;
  };
  if (handoff === 'ADMIN_VERIFY' || handoff === 'STANDARD_VERIFY') {
    const challenge = state.manager_challenges?.[tokenDigest];
    if (!challenge || challenge.membership_id !== membership.membership_id || challenge.consumed_at
        || item.payload?.challenge_id !== challenge.challenge_id || !future(challenge.expires_at)) {
      return json(res, 409, { ok: false, code: 'RELEASE5_MANAGER_CHALLENGE_NOT_CURRENT' });
    }
  } else if (handoff === 'MANAGER_SETUP') {
    const challenge = state.manager_setup_challenges?.[tokenDigest];
    if (!challenge || challenge.membership_id !== membership.membership_id
        || challenge.generation !== membership.setup_generation || challenge.consumed_at || challenge.superseded_at
        || item.payload?.setup_generation !== challenge.generation || !future(challenge.expires_at)) {
      return json(res, 409, { ok: false, code: 'RELEASE5_SETUP_CHALLENGE_NOT_CURRENT' });
    }
  } else if (invitation.token_digest !== tokenDigest || invitation.accepted_at
      || item.invitation_token_generation !== invitation.token_generation
      || !future(invitation.expires_at)) {
    return json(res, 409, { ok: false, code: 'RELEASE5_INVITATION_CHALLENGE_NOT_CURRENT' });
  }
  const service = getRecruitingService(process.env);
  let cookie;
  let destination;
  if (handoff === 'ADMIN_VERIFY' || handoff === 'STANDARD_VERIFY') {
    const verified = await service.verifyManager(token);
    cookie = secureCookie('__Host-more_recruiting_manager', verified.session_token, 8 * 60 * 60);
    destination = handoff === 'ADMIN_VERIFY' ? '/recruiting/master-control' : '/recruiting/home';
  } else if (handoff === 'MANAGER_SETUP') {
    const started = await service.beginManagerSetup(token);
    const completed = await service.completeManagerSetup(started.setup_session_token, started.csrf_token, STANDARD_PROFILE_ID);
    cookie = secureCookie('__Host-more_recruiting_manager', completed.manager_session_token, 8 * 60 * 60);
    destination = '/recruiting/home';
  } else {
    const accepted = await service.acceptInvitation(token, { accepted: true, version: 'recruiting_v1_consent_2026_08' });
    cookie = secureCookie('__Host-more_recruiting_invite', accepted.invite_session_token, 30 * 24 * 60 * 60);
    destination = '/recruiting/continue';
  }
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Set-Cookie', cookie);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    ok: true,
    destination,
    cookieIssued: true,
    valuesExposed: false,
  });
}

function safeState(state) {
  const memberships = Object.values(state.memberships || {});
  const invitations = Object.values(state.invitations || {});
  const outbox = Object.values(state.outbox || {});
  const outboxByKindState = {};
  const allowedKinds = new Set([
    'MANAGER_VERIFICATION', 'MANAGER_SETUP', 'RECRUIT_INVITATION', 'CONSULTATION_APPROVAL',
    'CONSULTING_AGREED_PLAN', 'MANAGER_BOS_READY', 'MANAGER_BA_INTELLIGENCE_READY',
  ]);
  const allowedStates = new Set(['PENDING', 'SENDING', 'DELIVERED', 'FAILED']);
  let invalidOutboxCount = 0;
  for (const item of outbox) {
    if (!allowedKinds.has(item.kind) || !allowedStates.has(item.state)) {
      invalidOutboxCount += 1;
      continue;
    }
    const key = `${item.kind}:${item.state}`;
    outboxByKindState[key] = (outboxByKindState[key] || 0) + 1;
  }
  return {
    membershipCount: memberships.length,
    activeAdminCount: memberships.filter((item) => item.status === 'ACTIVE' && item.admin_roles?.includes('RECRUITING_ADMIN')).length,
    activeStandardCount: memberships.filter((item) => item.status === 'ACTIVE' && !item.admin_roles?.includes('RECRUITING_ADMIN')).length,
    pendingManagerCount: memberships.filter((item) => item.status === 'PENDING_SETUP').length,
    invitationCount: invitations.length,
    acceptedInvitationCount: invitations.filter((item) => Boolean(item.accepted_at)).length,
    bosReadyCount: invitations.filter((item) => Boolean(item.bos_profile_id)).length,
    baReadyCount: invitations.filter((item) => item.ba_readiness === 'BA_INTELLIGENCE_READY').length,
    outboxByKindState,
    invalidOutboxCount,
  };
}

export default async function handler(req, res) {
  if (!boundaryValid() || requestHost(req) !== STABLE_HOST || !authorized(req)) {
    return json(res, 404, { ok: false, code: 'NOT_FOUND' });
  }
  const redis = getRecruitingRedis(process.env);
  try {
    const op = String(req.query?.op || '');
    if (op === 'inspect' && req.method === 'GET') {
      const inventory = await inspectKeys(redis);
      return json(res, inventory.stable && inventory.unexpected === 0 ? 200 : 409, {
        ok: inventory.stable && inventory.unexpected === 0,
        stable: inventory.stable,
        totalKeys: inventory.total,
        keyClasses: inventory.classes,
        unexpectedKeyCount: inventory.unexpected,
        recordsDeleted: 0,
        valuesExposed: false,
      });
    }
    if (op === 'bootstrap' && req.method === 'POST') {
      if (req.body?.confirm !== SYNTHETIC_MARKER) return json(res, 422, { ok: false, code: 'RELEASE5_SYNTHETIC_CONFIRMATION_REQUIRED' });
      const result = await bootstrap(redis);
      return json(res, 200, { ok: true, ...result, valuesExposed: false });
    }
    if (op === 'create-standard-manager' && req.method === 'POST') return createStandardManagerViaHttp(redis, req, res);
    if (op === 'create-recruit-invitation' && req.method === 'POST') return createRecruitInviteViaHttp(redis, req, res);
    if (op === 'consume-auth' && req.method === 'POST') return consumeDeliveredAuth(redis, req, res);
    if (op === 'status' && req.method === 'GET') return json(res, 200, { ok: true, ...safeState(await readState(redis)), valuesExposed: false });
    return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return json(res, 409, { ok: false, code: String(error?.message || 'RELEASE5_CANARY_CONTROLLER_FAILED').split(':')[0] });
  }
}
