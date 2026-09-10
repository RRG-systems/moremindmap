/* global Buffer, process */

import crypto from 'node:crypto';
import { getCanonicalProfile } from '../business-assessment/shared.js';
import { provisionRecruitingAdmin } from '../engine/recruitingV1/provisioning.js';
import { getRecruitingRedis, RedisRecruitingStore } from '../engine/recruitingV1/redisStore.js';
import { getRecruitingService } from '../engine/recruitingV1/runtime.js';
import { createRecruitingHttpHandler } from '../engine/recruitingV1/http.js';
import { readCurrentAuthoredSurfaces } from '../engine/recruitingGuV1/authoredSurfaces.js';
import {
  reconcileRecruitingCanonicalBaReadySafely,
} from '../engine/recruitingV1/canonicalAdapters.js';
import { createReadOnlyCanonicalReader } from '../engine/newBosProductionReadinessV1/canonicalReader.js';
import { readNewBosProductionConfig } from '../engine/newBosProductionReadinessV1/config.js';
import {
  createRedisLaunchSafeRealizationStore as createRedisNewBosRealizationStore,
  validateLaunchSafeRealizationEnvelope as validateNewBosRealizationEnvelope,
} from '../engine/newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBosModernizationService } from '../engine/newBosProductionReadinessV1/modernizationService.js';
import { createProductionNewBosGenerator } from '../engine/newBosProductionReadinessV1/productionGenerator.js';
import { createRedisNewBosResumableGenerationStore } from '../engine/newBosProductionReadinessV1/resumableGenerationStore.js';
import { createRedisSingleFlightCoordinator as createRedisNewBosSingleFlight } from '../engine/newBosProductionReadinessV1/singleFlight.js';
import { createReadOnlyBaAuthorityReader } from '../engine/newBaProductionReadinessV1/canonicalReader.js';
import { readNewBaProductionConfig } from '../engine/newBaProductionReadinessV1/config.js';
import {
  createRedisNewBaRealizationStore,
  validateLaunchSafeNewBaEnvelope,
} from '../engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBaModernizationService } from '../engine/newBaProductionReadinessV1/modernizationService.js';
import { createRealProfileNewBaGenerationCampaign } from '../engine/newBaProductionReadinessV1/realProfileGenerationCampaign.js';
import { createRedisNewBaBackgroundResponseStore } from '../engine/newBaProductionReadinessV1/backgroundResponseStore.js';
import { createRedisSingleFlight as createRedisNewBaSingleFlight } from '../engine/newBaProductionReadinessV1/singleFlight.js';
import { normalizeProfileId } from '../engine/newBaProductionReadinessV1/stable.js';
import {
  createOpaqueId,
  createOpaqueToken,
  createTokenWrapper,
  digestToken,
  MANAGER_SESSION_TTL_MS,
  normalizeEmail,
  stableHash,
} from '../../src/lib/recruitingV1/contracts.js';
import { createEmptyRecruitingState } from '../../src/lib/recruitingV1/store.js';
import { SURFACES } from '../../src/lib/newBosPersonalityDnaV1/constants.js';

const CUSTOM_ENVIRONMENT = 'subscription-canary';
const CONTROLLER_BRANCH = 'codex/home-base-v2-release5-agreement-guard-v1';
const RECRUITING_NAMESPACE = 'preview:recruiting-v1:release5_20260909_v1';
const ADMIN_PROFILE_ID = 'mm-20990909-r5adm001';
const STANDARD_PROFILE_ID = 'mm-20990909-r5mgr001';
const ADMIN_ENTERPRISE_ID = 'release5-canary-admin';
const STANDARD_ENTERPRISE_ID = 'release5-canary-standard';
const SYNTHETIC_MARKER = 'RELEASE5_RECRUITING_TWO_BOX_CANARY_SYNTHETIC_ONLY';
const BROWSER_RUNTIME_RETRY_RESET = 'RELEASE5_BROWSER_RUNTIME_RETRY_RESET';
const SESSION_RECOVERY_CONFIRMATION = 'RELEASE5_CANARY_SESSION_RECOVERY';
const STABLE_HOST = 'moremindmap-env-subscription-canary-rrg-systems-projects.vercel.app';
const NEW_BOS_NAMESPACE = 'preview:new-bos:release5-two-box-20260909';
const NEW_BA_NAMESPACE = 'preview:new-ba:release5-two-box-20260909';
const RECRUITING_STATE_KEY = `more:${RECRUITING_NAMESPACE}:state:v1`;
const MAX_RECRUITING_STATE_BYTES = 6 * 1024 * 1024;
// Every provider HTTP operation stays far below the 800 second serverless
// ceiling. Semantic work is resumable and BA advances one durable stage per
// request, so a short transport ceiling is safer than a long request lease.
const CANARY_PROVIDER_TIMEOUT_MS = 120_000;
const CANARY_SINGLE_FLIGHT_LEASE_MS = 840_000;
const CANARY_SINGLE_FLIGHT_WAIT_MS = 15_000;
const NEW_BOS_SURFACE_PATTERN = SURFACES.map((surface) => escapedPattern(surface.id)).join('|');
const NEW_BOS_UNIT_PATTERN = `(?:semantic:(?:causal_foundation|operating_domains|whole_person_decision_synthesis|surface_routing)|surface:(?:${NEW_BOS_SURFACE_PATTERN}))`;
const FORMSPREE_ENDPOINT_ENV_NAMES = Object.freeze([
  'FORMSPREE_DARREN_NOTIFICATION_ENDPOINT',
  'MOREMINDMAP_NOTIFICATION_FORMSPREE_ENDPOINT',
  'FORMSPREE_NOTIFICATION_ENDPOINT',
  'FORMSPREE_ENDPOINT',
]);
const HISTORICAL_KEY_PATTERNS = Object.freeze([
  ['historical_release4_leadership_demo', /^more:leadership-demo:v1:(?:entry-csrf:[a-f0-9]{64}|entry-rate:[a-f0-9]{32}|launcher:[a-f0-9]{64}|launcher-csrf:[a-f0-9]{64}:[a-f0-9]{64}|launch-rate:[a-f0-9]{64})$/u],
  ['historical_release4_subscription_runtime', /^more:subscription-v1:internal-dev:v1:(?:relationship:[a-f0-9]{64}|capability:[a-f0-9]{64}|subject-switch-csrf:[a-f0-9]{64}:[a-f0-9]{64}|runtime-csrf:[a-f0-9]{64}:[a-f0-9]{64}|(?:living|living-backup|living-lock|allowance-backup|allowance-lock|research|diagnostics|s2-relationship):[a-f0-9]{64}|allowance:[a-f0-9]{64}:\d{4}-\d{2})$/u],
  ['historical_release4_subscription_blind', /^more:subscription-blind:v1:(?:selection:[a-f0-9]{64}|lock:[a-f0-9]{64}|history:rel_[a-f0-9]{20})$/u],
]);

function escapedPattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function json(res, status, body) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

function safeErrorCode(error) {
  const code = String(error?.message || '').split(':')[0];
  return /^RELEASE5_[A-Z0-9_]+$/u.test(code)
    ? code
    : 'RELEASE5_CANARY_CONTROLLER_FAILED';
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
    && process.env.RECRUITING_V1_ENABLED === 'true'
    && process.env.RECRUITING_GU_V1_ENABLED === 'true'
    && process.env.RECRUITING_V1_SYNTHETIC_REVIEW === 'false'
    && process.env.RECRUITING_PUBLIC_BASE_URL === `https://${STABLE_HOST}`
    && process.env.NEW_BOS_DERIVED_NAMESPACE === NEW_BOS_NAMESPACE
    && process.env.NEW_BA_DERIVED_NAMESPACE === NEW_BA_NAMESPACE
    && process.env.NEW_BA_BOS_NAMESPACE === NEW_BOS_NAMESPACE
    && Boolean(process.env.REDIS_URL)
    && Boolean(process.env.RECRUITING_TOKEN_WRAP_KEY)
    && Boolean(process.env.RECRUITING_RESEND_API_KEY)
    && Boolean(process.env.RECRUITING_EMAIL_FROM);
}

function requestHost(req) {
  return String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim().toLowerCase();
}

function approvedRecipients() {
  // Resend's canonical non-human delivery sink supports distinct +labels,
  // keeping each synthetic identity separate without reaching a person.
  const recipients = Object.freeze({
    admin: 'delivered+release5-admin@resend.dev',
    standard: 'delivered+release5-standard@resend.dev',
    recruit: 'delivered+release5-recruit@resend.dev',
  });
  if (new Set(Object.values(recipients).map(normalizeEmail)).size !== 3
      || Object.values(recipients).some((recipient) => normalizeEmail(recipient) !== recipient)) {
    throw new Error('RELEASE5_DISTINCT_APPROVED_TEST_RECIPIENTS_REQUIRED');
  }
  return recipients;
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function assertSyntheticConfirmation(req) {
  if (req.body?.confirm !== SYNTHETIC_MARKER) {
    throw new Error('RELEASE5_SYNTHETIC_CONFIRMATION_REQUIRED');
  }
}

function assertProviderEgressIsolated() {
  if (String(process.env.GHL_CONTACT_SYNC_ENABLED || '').trim().toLowerCase() === 'true') {
    throw new Error('RELEASE5_GHL_EGRESS_MUST_BE_DISABLED');
  }
  if (FORMSPREE_ENDPOINT_ENV_NAMES.some((name) => Boolean(String(process.env[name] || '').trim()))) {
    throw new Error('RELEASE5_FORMSPREE_EGRESS_MUST_BE_UNBOUND');
  }
  if (String(process.env.OPENAI_API_KEY || '').length <= 20) {
    throw new Error('RELEASE5_OPENAI_BINDING_REQUIRED');
  }
  return Object.freeze({
    ghl: 'DISABLED',
    formspree: 'UNBOUND',
  });
}

function dynamicNewBosConfig(profileId) {
  const config = readNewBosProductionConfig({
    NEW_BOS_PRODUCTION_STAGED: 'true',
    NEW_BOS_CUSTOMER_ACTIVE: 'false',
    NEW_BOS_BA_FUSION_VALIDATED: 'true',
    NEW_BOS_CANARY_ENABLED: 'true',
    NEW_BOS_CANARY_PROFILE_IDS: profileId,
    NEW_BOS_CANARY_ACCESS_TOKEN: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
    NEW_BOS_PROVIDER_ENABLED: 'true',
    NEW_BOS_DERIVED_PERSISTENCE_ENABLED: 'true',
    NEW_BOS_DERIVED_NAMESPACE: NEW_BOS_NAMESPACE,
  });
  if (config.customerActive || config.allowedProfileIds.length !== 1
      || config.allowedProfileIds[0] !== profileId || config.namespace !== NEW_BOS_NAMESPACE) {
    throw new Error('RELEASE5_NEW_BOS_DYNAMIC_SCOPE_INVALID');
  }
  return config;
}

function dynamicNewBaConfig(profileId) {
  const config = readNewBaProductionConfig({
    NEW_BA_PRODUCTION_STAGED: 'true',
    NEW_BA_CUSTOMER_ACTIVE: 'false',
    NEW_BA_BOS_FUSION_VALIDATED: 'true',
    NEW_BA_CANARY_ENABLED: 'true',
    NEW_BA_CANARY_PROFILE_IDS: profileId,
    NEW_BA_CANARY_ACCESS_TOKEN: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
    NEW_BA_PROVIDER_ENABLED: 'true',
    NEW_BA_DERIVED_PERSISTENCE_ENABLED: 'true',
    NEW_BA_DERIVED_NAMESPACE: NEW_BA_NAMESPACE,
    NEW_BA_BOS_NAMESPACE: NEW_BOS_NAMESPACE,
  });
  if (config.customerActive || config.allowedProfileIds.length !== 1
      || config.allowedProfileIds[0] !== profileId || config.namespace !== NEW_BA_NAMESPACE
      || config.bosNamespace !== NEW_BOS_NAMESPACE) {
    throw new Error('RELEASE5_NEW_BA_DYNAMIC_SCOPE_INVALID');
  }
  return config;
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

function keyClass(key, context = {}) {
  const historical = HISTORICAL_KEY_PATTERNS.find(([, pattern]) => pattern.test(key));
  if (historical) {
    if (/:(?:lock|living-lock|allowance-lock):/u.test(key)) return 'inactive_lock_forbidden';
    return historical[0];
  }
  if (key === RECRUITING_STATE_KEY) return 'release5_recruiting_state';
  if (key === `more:${RECRUITING_NAMESPACE}:lock:v1`) return 'live_lock_forbidden';
  if (key.startsWith('vault:profile:') && SYNTHETIC_PROFILE_IDS.has(key.slice('vault:profile:'.length))) {
    return 'release5_synthetic_manager_profile';
  }
  const profile = context.profileId || '';
  const lowerProfile = profile.toLowerCase();
  if (profile && [`vault:profile:${lowerProfile}`, `vault:markdown:${lowerProfile}`].includes(key)) {
    return 'release5_synthetic_recruit_canonical';
  }
  if (context.bosJobId && key === `job:${context.bosJobId}`) return 'release5_synthetic_recruit_bos_job';
  if (context.invitationId
      && key === `recruiting_v1:product_execution:${context.invitationId}:behavior_operating_system`) {
    return 'release5_synthetic_recruit_bos_execution';
  }
  if (context.invitationId
      && key === `recruiting_v1:product_execution:${context.invitationId}:business_assessment`) {
    return 'release5_synthetic_recruit_ba_execution';
  }
  if (context.baJobId && key === `business_assessment_job:${context.baJobId}`) {
    return 'release5_synthetic_recruit_ba_job';
  }
  if (profile && key === `business_assessment_by_profile:${lowerProfile}`) {
    return 'release5_synthetic_recruit_ba_locator';
  }
  if (context.assessmentId && key === `business_assessment:${context.assessmentId}`) {
    return 'release5_synthetic_recruit_ba';
  }
  if (profile && key === 'jobs:recent') return 'release5_shared_bos_job_index';
  if (profile && key === 'vault:metadata:count') return 'release5_shared_vault_count';
  if (profile && context.vaultIndexKeys?.has(key)) return 'release5_synthetic_recruit_vault_index';
  if (context.assessmentId && key === `business_assessment:index:date:${context.assessmentDate}`) {
    return 'release5_synthetic_recruit_ba_index';
  }
  if (context.assessmentId && key === `business_assessment:index:type:${context.assessmentType}`) {
    return 'release5_synthetic_recruit_ba_index';
  }
  if (profile && context.assessmentId && new RegExp(
    `^more:${escapedPattern(RECRUITING_NAMESPACE)}:projection-retry:v1:${escapedPattern(lowerProfile)}:new-ba:${escapedPattern(profile)}:${escapedPattern(context.assessmentId)}:[a-f0-9]{64}$`,
    'u',
  ).test(key)) return 'release5_recruiting_projection_retry';
  if (key.startsWith(`${NEW_BOS_NAMESPACE}:single-flight:`)
      || key.startsWith(`${NEW_BA_NAMESPACE}:single-flight:`)) return 'live_lock_forbidden';
  if (profile && key === `${NEW_BOS_NAMESPACE}:latest-compatible:${profile}`) {
    return 'release5_new_bos_pointer';
  }
  if (profile && context.bosRealizationId
      && key === `${NEW_BOS_NAMESPACE}:artifact:${profile}:${context.bosRealizationId}`) {
    return 'release5_new_bos_artifact';
  }
  if (profile) {
    const bosCheckpoint = new RegExp(
      `^${escapedPattern(NEW_BOS_NAMESPACE)}:resumable-v1:[a-f0-9]{64}:(?:unit:${NEW_BOS_UNIT_PATTERN}(?::(?:terminal-archive-v1:attempt:\\d+|replacement-claim-v1(?::attempt:\\d+)?|stale-active-replacement-claim-v1:attempt:1|stale-active-archive-v1:attempt:1|invalid-semantic-archive-v1|semantic-rejection-archive-v1:attempt:\\d+))?|invalid-stage3-vector-free-repair-v1|semantic-rejected-stage3-replacement-v1|stage3-vector-free-request-contract-v2-claim-v1)$`,
      'u',
    );
    if (bosCheckpoint.test(key)) return 'release5_new_bos_checkpoint';
  }
  if (profile && key === `${NEW_BA_NAMESPACE}:latest-compatible:${profile}`) {
    return 'release5_new_ba_pointer';
  }
  if (profile && context.baRealizationId
      && key === `${NEW_BA_NAMESPACE}:artifact:${profile}:${context.baRealizationId}`) {
    return 'release5_new_ba_artifact';
  }
  if (profile) {
    const stages = '(?:whole_business_model_v1|five_futures_v2|one_move_v2)';
    const baCheckpoint = new RegExp(
      `^${escapedPattern(NEW_BA_NAMESPACE)}:real-profile-generation-v2:${escapedPattern(profile)}:[a-f0-9]{64}:checkpoint:${stages}$`,
      'u',
    );
    const baBackground = new RegExp(
      `^${escapedPattern(NEW_BA_NAMESPACE)}:real-profile-generation-v1:${escapedPattern(profile)}:background-response:[a-f0-9]{64}:${stages}(?::(?:automatic-recovery-v1|terminal-archive:[A-Za-z0-9_-]{8,180}))?$`,
      'u',
    );
    if (baCheckpoint.test(key)) return 'release5_new_ba_checkpoint';
    if (baBackground.test(key)) return 'release5_new_ba_background';
    if (key === `${NEW_BA_NAMESPACE}:real-profile-generation-v1:${profile}:failure-ledger`) {
      return 'release5_new_ba_failure_ledger';
    }
  }
  return 'unclassified_preserved';
}

function validateExecutionRecord(record, { invitationId, productKey }) {
  if (record?.contract_version !== 'mmm-product-single-execution-v1'
      || record.authority_type !== 'RECRUITING_RELATIONSHIP'
      || record.authority_ref !== invitationId
      || record.product_key !== productKey
      || record.state !== 'COMMITTED'
      || !/^[a-f0-9]{64}$/u.test(String(record.request_sha256 || ''))) {
    throw new Error('RELEASE5_PRODUCT_EXECUTION_SCOPE_INVALID');
  }
  return record;
}

function vaultSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 64);
}

function expectedVaultIndexes(record) {
  const keys = new Set();
  const date = String(record?.created_at || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new Error('RELEASE5_VAULT_DATE_INVALID');
  keys.add(`vault:index:date:${date}`);
  if (record.email) keys.add(`vault:index:email:${normalizeEmail(record.email)}`);
  if (record.company_slug) keys.add(`vault:index:company:${vaultSlug(record.company_slug)}`);
  const organization = record.metadata?.organization;
  for (const [field, prefix] of [
    ['department', 'department'], ['role_title', 'role'], ['reports_to', 'manager'], ['industry', 'industry'],
  ]) {
    const raw = organization?.[field];
    if (raw && raw !== 'Other') keys.add(`vault:index:${prefix}:${vaultSlug(raw)}`);
  }
  for (const item of Array.isArray(organization?.org_context) ? organization.org_context : []) {
    if (vaultSlug(item)) keys.add(`vault:index:org_context:${vaultSlug(item)}`);
  }
  return keys;
}

async function enrichStateContext(redis, context) {
  if (!context.invitationId) return context;
  let bosJobId = context.bosJobId || null;
  let baJobId = null;
  let assessmentId = context.assessmentId || null;
  let bosExecution = null;
  let baExecution = null;
  let canonicalRecord = null;
  let assessmentRecord = null;
  const bosExecutionRaw = await redis.get(`recruiting_v1:product_execution:${context.invitationId}:behavior_operating_system`);
  if (bosExecutionRaw) {
    const execution = validateExecutionRecord(parseObject(bosExecutionRaw), {
      invitationId: context.invitationId,
      productKey: 'behavior_operating_system',
    });
    bosExecution = execution;
    bosJobId = String(execution.identifiers?.job_id || '');
    if (!bosJobId || (context.bosJobId && bosJobId !== context.bosJobId)) {
      throw new Error('RELEASE5_BOS_EXECUTION_JOB_SCOPE_INVALID');
    }
    if (execution.result?.success !== true || execution.result?.job_id !== bosJobId) {
      throw new Error('RELEASE5_BOS_EXECUTION_RESULT_INVALID');
    }
  }
  const baExecutionRaw = await redis.get(`recruiting_v1:product_execution:${context.invitationId}:business_assessment`);
  if (baExecutionRaw) {
    const execution = validateExecutionRecord(parseObject(baExecutionRaw), {
      invitationId: context.invitationId,
      productKey: 'business_assessment',
    });
    baExecution = execution;
    baJobId = String(execution.identifiers?.job_id || '');
    const executionAssessmentId = String(execution.identifiers?.assessment_id || '').toLowerCase();
    if (!baJobId || !/^ba-\d{8}-[a-f0-9]{8}$/u.test(executionAssessmentId)
        || (assessmentId && assessmentId !== executionAssessmentId)) {
      throw new Error('RELEASE5_BA_EXECUTION_SCOPE_INVALID');
    }
    if (execution.result?.success !== true || execution.result?.job_id !== baJobId
        || execution.result?.assessment_id !== executionAssessmentId) {
      throw new Error('RELEASE5_BA_EXECUTION_RESULT_INVALID');
    }
    assessmentId = executionAssessmentId;
  }
  if (bosJobId && !bosExecution) throw new Error('RELEASE5_BOS_EXECUTION_REQUIRED');
  if (context.profileId) {
    const lowerProfile = context.profileId.toLowerCase();
    canonicalRecord = parseObject(await redis.get(`vault:profile:${lowerProfile}`));
    const canonicalProfileId = String(canonicalRecord?.profile_id
      || canonicalRecord?.canonical_profile_json?.profile_id || '').toLowerCase();
    if (!canonicalRecord || canonicalProfileId !== lowerProfile
        || canonicalRecord.job_id !== bosJobId
        || canonicalRecord.person_name !== 'Release 5 Synthetic Recruit'
        || canonicalRecord.email != null
        || canonicalRecord.company_name !== 'Release 5 Synthetic Real Estate Practice'
        || canonicalRecord.metadata?.saved_by !== 'vault-v1'
        || canonicalRecord.metadata?.vault_version !== '1.0.0') {
      throw new Error('RELEASE5_CANONICAL_BOS_PROFILE_SCOPE_INVALID');
    }
    const job = parseObject(await redis.get(`job:${bosJobId}`));
    const jobPayloadHash = job?.payload
      ? crypto.createHash('sha256').update(JSON.stringify(job.payload)).digest('hex')
      : null;
    if (!job || job.job_id !== bosJobId || job.status !== 'complete'
        || String(job.canonical_profile_id || '').toLowerCase() !== lowerProfile
        || job.payload?.metadata?.recruiting_relationship_ref !== context.invitationId
        || job.payload?.metadata?.recruiting_purpose !== 'RECRUITING_INTELLIGENCE'
        || job.payload?.metadata?.person_name !== 'Release 5 Synthetic Recruit'
        || job.payload?.metadata?.company_name !== 'Release 5 Synthetic Real Estate Practice'
        || jobPayloadHash !== job.intake_payload_sha256) {
      throw new Error('RELEASE5_CANONICAL_BOS_JOB_SCOPE_INVALID');
    }
  }
  let assessmentType = null;
  let assessmentDate = null;
  if (assessmentId) {
    const assessment = parseObject(await redis.get(`business_assessment:${assessmentId}`));
    if (!assessment || assessment.assessment_id !== assessmentId
        || String(assessment.owner_profile_id || '').toUpperCase() !== context.profileId
        || assessment.status !== 'intake_saved'
        || assessment.metadata?.recruiting_relationship_ref !== context.invitationId
        || assessment.metadata?.public_product_grant_id != null) {
      throw new Error('RELEASE5_BA_CANONICAL_SCOPE_INVALID');
    }
    assessmentRecord = assessment;
    assessmentType = String(assessment.assessment_type || '');
    assessmentDate = String(assessment.created_at || '').slice(0, 10);
    if (!/^[a-z0-9_-]{3,80}$/u.test(assessmentType) || !/^\d{4}-\d{2}-\d{2}$/u.test(assessmentDate)) {
      throw new Error('RELEASE5_BA_INDEX_SCOPE_INVALID');
    }
    const locator = await redis.get(`business_assessment_by_profile:${context.profileId.toLowerCase()}`);
    const baJob = parseObject(await redis.get(`business_assessment_job:${baJobId}`));
    if (!baExecution || locator !== assessmentId || !baJob
        || baJob.job_id !== baJobId || baJob.assessment_id !== assessmentId
        || String(baJob.owner_profile_id || '').toUpperCase() !== context.profileId
        || baJob.status !== 'completed' || baJob.intake_status !== 'intake_saved') {
      throw new Error('RELEASE5_BA_CANONICAL_LOCATOR_INVALID');
    }
  }
  return Object.freeze({
    ...context,
    bosJobId,
    baJobId,
    assessmentId,
    assessmentType,
    assessmentDate,
    bosExecution,
    baExecution,
    canonicalRecord,
    assessmentRecord,
    vaultIndexKeys: canonicalRecord ? expectedVaultIndexes(canonicalRecord) : new Set(),
  });
}

async function enrichAuthoredContext(redis, context) {
  if (!context.profileId) return context;
  const profile = context.profileId;
  const bosPointerKey = `${NEW_BOS_NAMESPACE}:latest-compatible:${profile}`;
  const baPointerKey = `${NEW_BA_NAMESPACE}:latest-compatible:${profile}`;
  const bosPointer = await redis.get(bosPointerKey);
  const baPointer = await redis.get(baPointerKey);
  if (!bosPointer) {
    if (baPointer || !['bos_ready', 'bos_in_progress'].includes(context.phase)) {
      throw new Error('RELEASE5_NEW_BOS_POINTER_INVALID');
    }
    return Object.freeze({
      ...context,
      bosRealizationId: null,
      baRealizationId: null,
      bosArtifactSha256: null,
      baArtifactSha256: null,
      authoredBosReady: false,
      authoredBaReady: false,
    });
  }
  if (!new RegExp(`^new-bos:${escapedPattern(profile)}:[a-f0-9]{64}$`, 'u').test(String(bosPointer))) {
    throw new Error('RELEASE5_NEW_BOS_POINTER_INVALID');
  }
  const authored = await readCurrentAuthoredSurfaces({ redis, profileId: profile, env: process.env });
  if (!authored?.bos || authored.receipts?.bos?.profile_id !== profile
      || authored.receipts.bos.realization_id !== bosPointer
      || authored.receipts.bos.complete_surface_count !== 15
      || String(authored.bos.profile_id || '').toUpperCase() !== profile
      || !/^[a-f0-9]{64}$/u.test(String(authored.receipts.bos.artifact_sha256 || ''))) {
    throw new Error('RELEASE5_NEW_BOS_AUTHORED_SURFACE_INVALID');
  }
  if (context.phase === 'ba_ready') {
    const receipt = context.baRealizationReceipt;
    if (!new RegExp(`^new-ba:${escapedPattern(profile)}:${escapedPattern(context.assessmentId)}:[a-f0-9]{64}$`, 'u').test(String(baPointer || ''))
        || !authored.ba || authored.receipts?.ba?.profile_id !== profile
        || authored.receipts.ba.assessment_id !== context.assessmentId
        || authored.receipts.ba.realization_id !== baPointer
        || authored.receipts.ba.complete !== true
        || receipt?.realization_id !== authored.receipts.ba.realization_id
        || receipt?.realization_sha256 !== authored.receipts.ba.realization_sha256
        || receipt?.artifact_sha256 !== authored.receipts.ba.artifact_sha256) {
      throw new Error('RELEASE5_NEW_BA_AUTHORED_SURFACE_INVALID');
    }
  } else if (context.phase === 'ba_in_progress' && baPointer) {
    if (!new RegExp(`^new-ba:${escapedPattern(profile)}:${escapedPattern(context.assessmentId)}:[a-f0-9]{64}$`, 'u').test(String(baPointer))
        || !authored.ba || authored.receipts?.ba?.profile_id !== profile
        || authored.receipts.ba.assessment_id !== context.assessmentId
        || authored.receipts.ba.realization_id !== baPointer
        || authored.receipts.ba.complete !== true) {
      throw new Error('RELEASE5_PARTIAL_NEW_BA_AUTHORED_SURFACE_INVALID');
    }
  } else if (baPointer || authored.ba || authored.receipts?.ba?.missing !== true) {
    throw new Error('RELEASE5_PREMATURE_NEW_BA_AUTHORED_SURFACE');
  }
  return Object.freeze({
    ...context,
    bosRealizationId: bosPointer,
    baRealizationId: baPointer || null,
    bosArtifactSha256: authored.receipts.bos.artifact_sha256,
    baArtifactSha256: authored.receipts?.ba?.artifact_sha256 || null,
    authoredBosReady: true,
    authoredBaReady: Boolean(baPointer && authored.receipts?.ba?.complete),
  });
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

function newBosCheckpointValueValid(key, value) {
  const parsed = key.match(new RegExp(
    `^${escapedPattern(NEW_BOS_NAMESPACE)}:resumable-v1:([a-f0-9]{64}):(.+)$`,
    'u',
  ));
  if (!parsed || !value || value.campaign_sha256 !== parsed[1]) return false;
  const tail = parsed[2];
  const specialVersions = Object.freeze({
    'invalid-stage3-vector-free-repair-v1': 'new_bos_invalid_stage3_vector_free_repair_claim_v1',
    'semantic-rejected-stage3-replacement-v1': 'new_bos_semantic_rejected_stage3_replacement_claim_v1',
    'stage3-vector-free-request-contract-v2-claim-v1': 'new_bos_stage3_vector_free_request_contract_v2_claim_v1',
  });
  if (specialVersions[tail]) {
    if (value.version !== specialVersions[tail]) return false;
    if (tail === 'invalid-stage3-vector-free-repair-v1') {
      return /^[a-f0-9]{64}$/u.test(String(value.stage3_archive_sha256 || ''))
        && /^[a-f0-9]{64}$/u.test(String(value.stage4_archive_sha256 || ''))
        && Number.isSafeInteger(value.replacement_stage3_attempt)
        && Number.isSafeInteger(value.replacement_stage4_attempt)
        && Number.isFinite(Date.parse(value.claimed_at));
    }
    return value.unit_id === 'semantic:whole_person_decision_synthesis'
      && /^[a-f0-9]{64}$/u.test(String(value.prior_checkpoint_sha256 || ''))
      && /^[a-f0-9]{64}$/u.test(String(value.semantic_rejection_archive_sha256 || ''))
      && Number.isSafeInteger(value.prior_attempt)
      && Number.isSafeInteger(value.next_attempt)
      && value.next_attempt >= 1
      && Number.isFinite(Date.parse(value.claimed_at));
  }
  const unitMatch = tail.match(new RegExp(
    `^unit:(${NEW_BOS_UNIT_PATTERN})(?::(terminal-archive-v1:attempt:(\\d+)|replacement-claim-v1(?::attempt:(\\d+))?|stale-active-replacement-claim-v1:attempt:1|stale-active-archive-v1:attempt:1|invalid-semantic-archive-v1|semantic-rejection-archive-v1:attempt:(\\d+)))?$`,
    'u',
  ));
  if (!unitMatch || value.unit_id !== unitMatch[1]) return false;
  const suffix = unitMatch[2] || null;
  if (!suffix) {
    const states = new Set([
      'SUBMISSION_INTENT', 'QUEUED', 'IN_PROGRESS', 'PROVIDER_COMPLETED',
      'TERMINAL', 'ACCEPTED', 'SEMANTIC_REJECTED', 'DEPENDENCY_INVALIDATED',
    ]);
    if (!states.has(value.state)) return false;
    if (value.state === 'DEPENDENCY_INVALIDATED') {
      return value.version === 'new_bos_resumable_dependency_invalidation_v1'
        && value.unit_id === 'semantic:surface_routing'
        && Number.isSafeInteger(value.prior_attempt)
        && value.next_attempt === value.prior_attempt + 1
        && value.invalidated_by_unit === 'semantic:whole_person_decision_synthesis'
        && value.replacement_reason === 'stage3_vector_free_contract_violation'
        && /^[a-f0-9]{64}$/u.test(String(value.invalid_semantic_archive_sha256 || ''))
        && /^[a-f0-9]{64}$/u.test(String(value.invalidated_by_archive_sha256 || ''))
        && Number.isFinite(Date.parse(value.invalidated_at));
    }
    if (value.version !== 'new_bos_resumable_unit_checkpoint_v1') return false;
    if (!Number.isSafeInteger(value.attempt) || value.attempt < 1 || value.attempt > 3) return false;
    if (!/^[a-f0-9]{64}$/u.test(String(value.unit_identity_sha256 || ''))
        || !/^[a-f0-9]{64}$/u.test(String(value.request_sha256 || ''))) return false;
    if (value.state === 'ACCEPTED') {
      return value.accepted_value != null
        && value.accepted_value_sha256 === stableHash(value.accepted_value);
    }
    return value.accepted_value == null && value.accepted_value_sha256 == null;
  }
  if (suffix.startsWith('semantic-rejection-archive-v1:attempt:')) {
    const prior = value.prior_checkpoint;
    return value.version === 'new_bos_resumable_semantic_rejection_archive_v1'
      && value.prior_attempt === Number(unitMatch[5])
      && value.replacement_authorized === true
      && prior?.campaign_sha256 === parsed[1]
      && prior.unit_id === value.unit_id
      && prior.attempt === value.prior_attempt
      && prior.state === 'SEMANTIC_REJECTED'
      && /^[a-f0-9]{64}$/u.test(String(prior.unit_identity_sha256 || ''))
      && /^[a-f0-9]{64}$/u.test(String(prior.request_sha256 || ''))
      && value.prior_checkpoint_sha256 === stableHash(prior)
      && value.semantic_rejection_code === prior.semantic_rejection_code
      && value.semantic_validator === prior.semantic_validator
      && value.semantic_rejection_detail === prior.semantic_rejection_detail
      && value.semantic_validation_code_sha256 === prior.semantic_validation_code_sha256;
  }
  if (!/^[a-f0-9]{64}$/u.test(String(value.unit_identity_sha256 || ''))
      || !/^[a-f0-9]{64}$/u.test(String(value.request_sha256 || ''))) return false;
  if (suffix.startsWith('terminal-archive-v1:attempt:')) {
    return value.version === 'new_bos_resumable_terminal_archive_v1'
      && value.attempt === Number(unitMatch[3])
      && value.replacement_authorized === true;
  }
  if (suffix.startsWith('replacement-claim-v1')) {
    const nextAttempt = unitMatch[4] ? Number(unitMatch[4]) : 2;
    return value.version === 'new_bos_resumable_replacement_claim_v1'
      && value.next_attempt === nextAttempt
      && value.prior_attempt === nextAttempt - 1;
  }
  if (suffix === 'stale-active-replacement-claim-v1:attempt:1') {
    return value.version === 'new_bos_resumable_stale_active_replacement_claim_v1'
      && value.unit_id === 'semantic:surface_routing'
      && value.prior_attempt === 1 && value.next_attempt === 2;
  }
  if (suffix === 'stale-active-archive-v1:attempt:1') {
    return value.version === 'new_bos_resumable_stale_active_archive_v1'
      && value.unit_id === 'semantic:surface_routing'
      && value.attempt === 1 && value.replacement_authorized === true;
  }
  if (suffix === 'invalid-semantic-archive-v1') {
    const common = /^[a-f0-9]{64}$/u.test(String(value.prior_checkpoint_sha256 || ''))
      && /^[a-f0-9]{64}$/u.test(String(value.accepted_value_sha256 || ''))
      && Number.isSafeInteger(value.prior_attempt)
      && value.replacement_authorized === true
      && Number.isFinite(Date.parse(value.retired_at));
    if (!common) return false;
    if (value.unit_id === 'semantic:whole_person_decision_synthesis') {
      return value.version === 'new_bos_resumable_invalid_semantic_archive_v1'
        && String(value.failure_code || '').startsWith('Whole-person model leaked assessment language:');
    }
    return value.unit_id === 'semantic:surface_routing'
      && value.version === 'new_bos_resumable_invalid_dependency_archive_v1'
      && value.invalidated_by_unit === 'semantic:whole_person_decision_synthesis'
      && /^[a-f0-9]{64}$/u.test(String(value.invalidated_by_accepted_value_sha256 || ''));
  }
  return false;
}

function newBaBackgroundValueValid(key, value, context) {
  const stages = '(whole_business_model_v1|five_futures_v2|one_move_v2)';
  const parsed = key.match(new RegExp(
    `^${escapedPattern(NEW_BA_NAMESPACE)}:real-profile-generation-v1:${escapedPattern(context.profileId)}:background-response:([a-f0-9]{64}):${stages}(?::(automatic-recovery-v1|terminal-archive:([A-Za-z0-9_-]{8,180})))?$`,
    'u',
  ));
  if (!parsed || !value || value.profile_id !== context.profileId
      || value.generation_identity_sha256 !== parsed[1] || value.stage !== parsed[2]) return false;
  const suffix = parsed[3] || null;
  if (!suffix) {
    if (value.version === 'new_ba_background_response_checkpoint_v1') {
      return /^[a-f0-9]{64}$/u.test(String(value.scientific_request_sha256 || ''))
        && typeof value.provider_response_id === 'string' && value.provider_response_id.length > 0;
    }
    return value.version === 'realization_terminal_checkpoint_retired_v1'
      && /^[a-f0-9]{64}$/u.test(String(value.scientific_request_sha256 || ''))
      && typeof value.retired_provider_response_id === 'string'
      && value.retired_provider_response_id.length > 0
      && value.replacement_authorized === true;
  }
  if (suffix === 'automatic-recovery-v1') {
    return value.version === 'realization_automatic_recovery_claim_v1'
      && ['failed', 'cancelled', 'incomplete'].includes(value.terminal_provider_status)
      && typeof value.terminal_response_id === 'string' && value.terminal_response_id.length > 0
      && value.maximum_replacement_submissions === 1;
  }
  return value.version === 'new_ba_terminal_checkpoint_archive_v1'
    && value.provider_response_id === parsed[4]
    && /^[a-f0-9]{64}$/u.test(String(value.scientific_request_sha256 || ''))
    && value.raw_provider_payload_persisted === false;
}

async function newBaFailureLedgerValid(redis, key, context) {
  if (await redis.type(key) !== 'list') return false;
  const length = await redis.llen(key);
  if (!Number.isSafeInteger(length) || length < 1 || length > 24) return false;
  const entries = await redis.lrange(key, 0, -1);
  for (const raw of entries) {
    const value = parseObject(raw);
    if (!value || value.contract_id !== 'new-ba-real-profile-generation-failure-receipt-v1'
        || value.profile_id !== context.profileId
        || !['whole_business_model_v1', 'five_futures_v2', 'one_move_v2'].includes(value.stage)
        || !Number.isFinite(Date.parse(value.failed_at))
        || typeof value.error_code !== 'string' || value.error_code.length < 1 || value.error_code.length > 160
        || value.raw_request_persisted !== false || value.raw_response_persisted !== false) return false;
    const { receipt_sha256: receiptSha256, ...body } = value;
    if (receiptSha256 !== stableHash(body)) return false;
    for (const hash of [value.response_output_sha256, value.response_id_hash].filter(Boolean)) {
      if (!/^[a-f0-9]{64}$/u.test(String(hash))) return false;
    }
  }
  return true;
}

async function recruitingProjectionRetryValid(redis, key, context) {
  if (await redis.type(key) !== 'string') return false;
  const value = parseObject(await redis.get(key));
  const realizationId = key.slice(key.lastIndexOf(':new-ba:') + 1);
  return Boolean(value)
    && value.contract === 'recruiting_canonical_ba_projection_retry_receipt_v1'
    && String(value.profile_id || '').toUpperCase() === context.profileId
    && value.assessment_id === context.assessmentId
    && value.realization_id === realizationId
    && value.retryable === true && value.canonical_ba_accepted === true
    && value.raw_error_persisted === false
    && Number.isFinite(Date.parse(value.created_at));
}

async function release5ValueValid(redis, key, keyClassName, context) {
  try {
    const closure = context.identityClosure;
    if (keyClassName === 'release5_recruiting_state') {
      return await redis.type(key) === 'string' && Boolean(await readState(redis));
    }
    if (keyClassName === 'release5_synthetic_manager_profile') {
      const profileId = key.slice('vault:profile:'.length);
      const expected = expectedProfiles()[profileId];
      return Boolean(expected) && await redis.type(key) === 'string'
        && await redis.get(key) === JSON.stringify(expected);
    }
    if (keyClassName === 'release5_synthetic_recruit_canonical') {
      if (await redis.type(key) !== 'string') return false;
      const raw = await redis.get(key);
      if (key.startsWith('vault:profile:')) {
        if (raw !== JSON.stringify(context.canonicalRecord)) return false;
        assertRelease5PayloadIsolation(context.canonicalRecord, closure);
        return true;
      }
      if (!raw || Buffer.byteLength(raw, 'utf8') > 2 * 1024 * 1024
          || !raw.toLowerCase().includes(context.profileId.toLowerCase())) return false;
      assertRelease5PayloadIsolation({ markdown: raw }, closure);
      return true;
    }
    if (keyClassName === 'release5_synthetic_recruit_bos_job') {
      const value = parseObject(await redis.get(key));
      assertRelease5PayloadIsolation(value, closure);
      return value?.job_id === context.bosJobId && value.status === 'complete';
    }
    if (keyClassName === 'release5_synthetic_recruit_bos_execution'
        || keyClassName === 'release5_synthetic_recruit_ba_execution') {
      const value = parseObject(await redis.get(key));
      const productKey = keyClassName.endsWith('bos_execution')
        ? 'behavior_operating_system' : 'business_assessment';
      validateExecutionRecord(value, { invitationId: context.invitationId, productKey });
      assertRelease5PayloadIsolation(value, closure);
      return true;
    }
    if (keyClassName === 'release5_synthetic_recruit_ba_job') {
      const value = parseObject(await redis.get(key));
      assertRelease5PayloadIsolation(value, closure);
      return value?.job_id === context.baJobId && value.assessment_id === context.assessmentId
        && String(value.owner_profile_id || '').toUpperCase() === context.profileId
        && value.status === 'completed' && value.intake_status === 'intake_saved';
    }
    if (keyClassName === 'release5_synthetic_recruit_ba_locator') {
      return await redis.type(key) === 'string' && await redis.get(key) === context.assessmentId;
    }
    if (keyClassName === 'release5_synthetic_recruit_ba') {
      const value = parseObject(await redis.get(key));
      assertRelease5PayloadIsolation(value, closure);
      return JSON.stringify(value) === JSON.stringify(context.assessmentRecord);
    }
    if (keyClassName === 'release5_recruiting_projection_retry') {
      if (!await recruitingProjectionRetryValid(redis, key, context)) return false;
      const value = parseObject(await redis.get(key));
      assertRelease5PayloadIsolation(value, closure);
      return true;
    }
    if (keyClassName === 'release5_new_bos_pointer') {
      return await redis.type(key) === 'string' && await redis.get(key) === context.bosRealizationId;
    }
    if (keyClassName === 'release5_new_bos_artifact') {
      if (await redis.type(key) !== 'string') return false;
      const envelope = validateNewBosRealizationEnvelope(parseObject(await redis.get(key)), { profileId: context.profileId });
      assertRelease5PayloadIsolation(envelope, closure);
      return envelope.realization_id === context.bosRealizationId
        && envelope.artifact_sha256 === context.bosArtifactSha256
        && envelope.provider_accounting?.store === false;
    }
    if (keyClassName === 'release5_new_ba_pointer') {
      return await redis.type(key) === 'string' && await redis.get(key) === context.baRealizationId;
    }
    if (keyClassName === 'release5_new_ba_artifact') {
      if (await redis.type(key) !== 'string') return false;
      const envelope = validateLaunchSafeNewBaEnvelope(parseObject(await redis.get(key)), { profileId: context.profileId });
      assertRelease5PayloadIsolation(envelope, closure);
      return envelope.realization_id === context.baRealizationId
        && envelope.assessment_id === context.assessmentId
        && envelope.artifact_sha256 === context.baArtifactSha256
        && envelope.provider_accounting?.store === false;
    }
    if (keyClassName === 'release5_new_bos_checkpoint') {
      if (await redis.type(key) !== 'string') return false;
      const value = parseObject(await redis.get(key));
      if (!newBosCheckpointValueValid(key, value)) return false;
      assertRelease5PayloadIsolation(value, closure);
      return true;
    }
    if (keyClassName === 'release5_new_ba_checkpoint') {
      if (await redis.type(key) !== 'string') return false;
      const value = parseObject(await redis.get(key));
      const match = key.match(/:real-profile-generation-v2:([^:]+):([a-f0-9]{64}):checkpoint:([^:]+)$/u);
      if (!value || value.contract_id !== 'new-ba-real-profile-generation-checkpoint-v1'
          || value.profile_id !== context.profileId || value.assessment_id !== context.assessmentId
          || value.generation_identity_sha256 !== match?.[2] || value.stage !== match?.[3]
          || value.current_customer_pointer_advanced !== false || value.raw_provider_payload_persisted !== false
          || value.artifact_sha256 !== stableHash(value.artifact)) return false;
      const { checkpoint_sha256: checkpointSha256, ...body } = value;
      if (checkpointSha256 !== stableHash(body)) return false;
      assertRelease5PayloadIsolation(value, closure);
      return true;
    }
    if (keyClassName === 'release5_new_ba_background') {
      if (await redis.type(key) !== 'string') return false;
      const value = parseObject(await redis.get(key));
      if (!newBaBackgroundValueValid(key, value, context)) return false;
      assertRelease5PayloadIsolation(value, closure);
      return true;
    }
    if (keyClassName === 'release5_new_ba_failure_ledger') {
      if (!await newBaFailureLedgerValid(redis, key, context)) return false;
      const values = (await redis.lrange(key, 0, -1)).map(parseObject);
      values.forEach((value) => assertRelease5PayloadIsolation(value, closure));
      return true;
    }
    return true;
  } catch {
    return false;
  }
}

async function inspectKeys(redis, { expectedPhase = 'auto' } = {}) {
  const before = await redis.dbsize();
  let stateContext = Object.freeze({ phase: 'invalid', profileId: null, assessmentId: null, invitationId: null, bosJobId: null });
  let auditCount = null;
  let invalidScoped = 0;
  try {
    const state = await readState(redis);
    auditCount = Array.isArray(state.audit) ? state.audit.length : null;
    stateContext = await enrichStateContext(redis, release5StateContext(state, { expectedPhase }));
    if (stateContext.profileId) stateContext = await enrichAuthoredContext(redis, stateContext);
    stateContext = Object.freeze({
      ...stateContext,
      identityClosure: release5IdentityClosure(state, {
        profileId: stateContext.profileId,
        assessmentId: stateContext.assessmentId,
      }),
    });
    if (['empty', 'bootstrap'].includes(stateContext.phase)) assertBootstrapStateSafe(state);
  } catch {
    invalidScoped += 1;
  }
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
  const classDigestEntries = {};
  for (const key of keys) {
    const classified = keyClass(key, stateContext);
    classes[classified] = (classes[classified] || 0) + 1;
    const digest = await redisKeyDigest(redis, key);
    if (!classDigestEntries[classified]) classDigestEntries[classified] = [];
    classDigestEntries[classified].push(`${key}\u0000${digest}`);
    if (classified.startsWith('historical_release4_') && !await historicalValueValid(redis, key, classified)) {
      invalidScoped += 1;
    }
    if (classified.startsWith('release5_')
        && !await release5ValueValid(redis, key, classified, stateContext)) invalidScoped += 1;
    if (classified === 'release5_shared_bos_job_index') {
      const entries = await redis.lrange(key, 0, 100);
      if (await redis.type(key) !== 'list'
          || entries.length !== 1
          || entries[0] !== stateContext.bosJobId) invalidScoped += 1;
    }
    if (classified === 'release5_shared_vault_count') {
      if (await redis.type(key) !== 'string' || await redis.get(key) !== '1') invalidScoped += 1;
    }
    if (classified === 'release5_synthetic_recruit_vault_index') {
      const members = await redis.smembers(key);
      if (await redis.type(key) !== 'set'
          || members.length !== 1
          || members[0] !== stateContext.profileId.toLowerCase()) invalidScoped += 1;
    }
    if (classified === 'release5_synthetic_recruit_ba_index') {
      const members = await redis.smembers(key);
      if (await redis.type(key) !== 'set'
          || members.length !== 1
          || members[0] !== stateContext.assessmentId) invalidScoped += 1;
    }
  }
  if (invalidScoped) classes.scoped_value_invalid = invalidScoped;
  const classFingerprints = Object.fromEntries(Object.entries(classDigestEntries)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([classification, entries]) => [classification, sha256Text(entries.sort().join('\n'))]));
  return {
    stable: before === after && after === keys.size,
    total: after,
    phase: stateContext.phase,
    profileIdSha256: stateContext.profileId ? sha256Text(stateContext.profileId) : null,
    auditCount,
    classes,
    classFingerprints,
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

async function resetRecruitingAfterBrowserRuntimeFailure(redis, req) {
  if (req.body?.confirm !== SYNTHETIC_MARKER
      || req.body?.reason !== BROWSER_RUNTIME_RETRY_RESET) {
    throw new Error('RELEASE5_SYNTHETIC_RESET_CONFIRMATION_REQUIRED');
  }
  const resetKeys = [
    RECRUITING_STATE_KEY,
    `vault:profile:${ADMIN_PROFILE_ID}`,
    `vault:profile:${STANDARD_PROFILE_ID}`,
  ];
  const expectedValues = await redis.mget(...resetKeys);
  if (expectedValues.some((value) => value == null)) {
    throw new Error('RELEASE5_SYNTHETIC_RESET_TARGET_MISSING');
  }
  const stateSnapshot = parseObject(expectedValues[0]);
  assertRecruitingStateShape(stateSnapshot);
  assertExactKeyedRecords(stateSnapshot.memberships, 'membership_id', 'RELEASE5_MEMBERSHIP_KEY_ID_MISMATCH');
  assertExactKeyedRecords(stateSnapshot.invitations, 'invitation_id', 'RELEASE5_INVITATION_KEY_ID_MISMATCH');
  const stateContext = release5StateContext(stateSnapshot, { expectedPhase: 'recruit_accepted' });
  const profiles = expectedProfiles();
  if (stateContext.phase !== 'recruit_accepted'
      || expectedValues[1] !== JSON.stringify(profiles[ADMIN_PROFILE_ID])
      || expectedValues[2] !== JSON.stringify(profiles[STANDARD_PROFILE_ID])) {
    throw new Error('RELEASE5_SYNTHETIC_RESET_TARGET_INVALID');
  }
  const before = await inspectKeys(redis, { expectedPhase: 'recruit_accepted' });
  const release5Classes = Object.entries(before.classes)
    .filter(([classification, count]) => classification.startsWith('release5_') && count > 0);
  if (!before.stable || before.unexpected !== 0 || before.phase !== 'recruit_accepted'
      || before.classes.release5_recruiting_state !== 1
      || before.classes.release5_synthetic_manager_profile !== 2
      || release5Classes.length !== 2) {
    throw new Error('RELEASE5_SYNTHETIC_RESET_SCOPE_INVALID');
  }
  const preservedFingerprints = Object.fromEntries(Object.entries(before.classFingerprints)
    .filter(([classification]) => classification.startsWith('historical_release4_')));
  const lockKey = `more:${RECRUITING_NAMESPACE}:lock:v1`;
  const recordsDeleted = Number(await redis.eval(
    "if redis.call('EXISTS',KEYS[4]) ~= 0 then return 0 end "
      + "if redis.call('GET',KEYS[1]) ~= ARGV[1] or redis.call('GET',KEYS[2]) ~= ARGV[2] or redis.call('GET',KEYS[3]) ~= ARGV[3] then return 0 end "
      + "return redis.call('DEL',KEYS[1],KEYS[2],KEYS[3])",
    4,
    ...resetKeys,
    lockKey,
    ...expectedValues,
  ));
  if (recordsDeleted !== 3) throw new Error('RELEASE5_SYNTHETIC_RESET_DELETE_INCOMPLETE');
  const after = await inspectKeys(redis, { expectedPhase: 'empty' });
  if (!after.stable || after.unexpected !== 0 || after.phase !== 'empty'
      || after.total !== before.total - recordsDeleted
      || Object.entries(after.classes).some(([classification, count]) => classification.startsWith('release5_') && count > 0)
      || Object.entries(preservedFingerprints).some(([classification, fingerprint]) =>
        after.classFingerprints[classification] !== fingerprint)) {
    throw new Error('RELEASE5_SYNTHETIC_RESET_POSTCONDITION_INVALID');
  }
  return {
    recordsDeleted,
    remainingKeys: after.total,
    protectedClassFingerprintCount: Object.keys(preservedFingerprints).length,
  };
}

async function recoverSyntheticSessions(redis, req, res) {
  if (req.body?.confirm !== SYNTHETIC_MARKER
      || req.body?.reason !== SESSION_RECOVERY_CONFIRMATION) {
    throw new Error('RELEASE5_SESSION_RECOVERY_CONFIRMATION_REQUIRED');
  }
  const before = await inspectKeys(redis);
  if (!before.stable || before.unexpected !== 0
      || before.phase !== 'bos_ready'
      || !Number.isInteger(before.auditCount)
      || before.auditCount > 120) {
    throw new Error('RELEASE5_SESSION_RECOVERY_PHASE_INVALID');
  }
  const tokens = Object.freeze({
    ADMIN: createOpaqueToken(),
    STANDARD: createOpaqueToken(),
    RECRUIT: createOpaqueToken(),
  });
  const store = new RedisRecruitingStore(redis, { namespace: RECRUITING_NAMESPACE });
  const recovered = await store.transaction((state) => {
    const context = release5StateContext(state, { requireProfile: true });
    if (context.phase !== before.phase) throw new Error('RELEASE5_SESSION_RECOVERY_STATE_CHANGED');
    const memberships = Object.values(state.memberships || {});
    const admin = memberships.find((item) => item.manager_profile_id === ADMIN_PROFILE_ID);
    const standard = memberships.find((item) => item.manager_profile_id === STANDARD_PROFILE_ID);
    if (!admin || !standard) throw new Error('RELEASE5_MANAGER_SESSION_RECOVERY_SCOPE_INVALID');
    assertAdminMembershipExact(admin);
    assertStandardMembershipExact(standard);
    if (standard.status !== 'ACTIVE' || standard.setup_state !== 'COMPLETE') {
      throw new Error('RELEASE5_STANDARD_MANAGER_STATE_MISMATCH');
    }
    const managerSessions = Object.entries(state.manager_sessions || {});
    const sessionsByRole = Object.freeze({
      ADMIN: managerSessions.filter(([, session]) => session?.membership_id === admin.membership_id),
      STANDARD: managerSessions.filter(([, session]) => session?.membership_id === standard.membership_id),
    });
    if (managerSessions.length !== sessionsByRole.ADMIN.length + sessionsByRole.STANDARD.length) {
      throw new Error('RELEASE5_MANAGER_SESSION_RECOVERY_SCOPE_INVALID');
    }
    const inviteSessions = Object.entries(state.invite_sessions || {});
    for (const [role, membership] of [['ADMIN', admin], ['STANDARD', standard]]) {
      const sessions = sessionsByRole[role];
      if (sessions.length < 1 || sessions.some(([, session]) =>
        session?.manager_subject_id !== membership.manager_subject_id
          || session?.enterprise_id !== membership.enterprise_id
          || !Number.isSafeInteger(session.rotation)
          || session.rotation < 0)) {
        throw new Error('RELEASE5_MANAGER_SESSION_RECOVERY_SCOPE_INVALID');
      }
    }
    const allPriorManagerSessionIds = new Set(managerSessions.map(([, session]) => session.session_id));
    if (Object.values(state.manager_csrf_proofs || {}).some((proof) =>
      !allPriorManagerSessionIds.has(proof?.session_id))) {
      throw new Error('RELEASE5_MANAGER_SESSION_RECOVERY_CSRF_SCOPE_INVALID');
    }
    if (inviteSessions.length < 1 || inviteSessions.some(([, session]) =>
      session?.invitation_id !== context.invitationId
        || session?.candidate_id !== context.candidateId
        || session?.enterprise_id !== STANDARD_ENTERPRISE_ID
        || !Number.isSafeInteger(session.rotation)
        || session.rotation < 0)) {
      throw new Error('RELEASE5_INVITE_SESSION_RECOVERY_SCOPE_INVALID');
    }

    const priorRecoveryAudits = state.audit.filter((event) =>
      event?.authority_source === SESSION_RECOVERY_CONFIRMATION);
    if (![0, 3].includes(priorRecoveryAudits.length)) {
      throw new Error('RELEASE5_SESSION_RECOVERY_AUDIT_SET_INVALID');
    }
    if (priorRecoveryAudits.length === 0 && state.audit.length > 117) {
      throw new Error('RELEASE5_SESSION_RECOVERY_AUDIT_HEADROOM_REQUIRED');
    }
    if (priorRecoveryAudits.length === 3) {
      const byRole = new Map();
      for (const event of priorRecoveryAudits) {
        const role = String(event?.recovery_role || '');
        if (!['ADMIN', 'STANDARD', 'RECRUIT'].includes(role) || byRole.has(role)) {
          throw new Error('RELEASE5_SESSION_RECOVERY_AUDIT_SET_INVALID');
        }
        byRole.set(role, event);
      }
      const adminEvent = byRole.get('ADMIN');
      const standardEvent = byRole.get('STANDARD');
      const recruitEvent = byRole.get('RECRUIT');
      if (adminEvent?.event_type !== 'MANAGER_SESSION_ROTATED'
          || adminEvent?.membership_id !== admin.membership_id
          || !sessionsByRole.ADMIN.some(([, session]) =>
            session?.session_id === adminEvent.session_id && session?.rotation === adminEvent.rotation)
          || standardEvent?.event_type !== 'MANAGER_SESSION_ROTATED'
          || standardEvent?.membership_id !== standard.membership_id
          || !sessionsByRole.STANDARD.some(([, session]) =>
            session?.session_id === standardEvent.session_id && session?.rotation === standardEvent.rotation)
          || recruitEvent?.event_type !== 'INVITE_SESSION_ROTATED'
          || recruitEvent?.invitation_id !== context.invitationId
          || !inviteSessions.some(([, session]) =>
            session?.invite_session_id === recruitEvent.invite_session_id
              && session?.rotation === recruitEvent.rotation)) {
        throw new Error('RELEASE5_SESSION_RECOVERY_AUDIT_SET_INVALID');
      }
    }
    state.audit = state.audit.filter((event) =>
      event?.authority_source !== SESSION_RECOVERY_CONFIRMATION);
    if (state.audit.length > 117) throw new Error('RELEASE5_SESSION_RECOVERY_AUDIT_HEADROOM_REQUIRED');

    const now = new Date();
    const timestamp = now.toISOString();
    for (const [role, membership] of [['ADMIN', admin], ['STANDARD', standard]]) {
      const sessions = sessionsByRole[role];
      const priorSessionIds = new Set(sessions.map(([, session]) => session.session_id));
      const rotation = Math.max(...sessions.map(([, session]) => session.rotation)) + 1;
      if (!Number.isSafeInteger(rotation) || rotation < 1) {
        throw new Error('RELEASE5_MANAGER_SESSION_RECOVERY_ROTATION_INVALID');
      }
      for (const [digest] of sessions) delete state.manager_sessions[digest];
      for (const [digest, proof] of Object.entries(state.manager_csrf_proofs || {})) {
        if (priorSessionIds.has(proof?.session_id)) delete state.manager_csrf_proofs[digest];
      }
      const session = {
        session_id: createOpaqueId('manager_session'),
        membership_id: membership.membership_id,
        manager_subject_id: membership.manager_subject_id,
        enterprise_id: membership.enterprise_id,
        issued_at: timestamp,
        expires_at: new Date(now.getTime() + MANAGER_SESSION_TTL_MS).toISOString(),
        rotation,
      };
      state.manager_sessions[digestToken(tokens[role])] = session;
      state.audit.push({
        event_id: createOpaqueId('audit'),
        event_type: 'MANAGER_SESSION_ROTATED',
        occurred_at: timestamp,
        membership_id: membership.membership_id,
        session_id: session.session_id,
        rotation,
        authority_source: SESSION_RECOVERY_CONFIRMATION,
        recovery_role: role,
      });
    }
    const recruitRotation = Math.max(...inviteSessions
      .map(([, session]) => session.rotation)) + 1;
    if (!Number.isSafeInteger(recruitRotation) || recruitRotation < 1) {
      throw new Error('RELEASE5_INVITE_SESSION_RECOVERY_ROTATION_INVALID');
    }
    for (const [digest] of inviteSessions) delete state.invite_sessions[digest];
    const inviteSession = {
      invite_session_id: createOpaqueId('invite_session'),
      invitation_id: context.invitationId,
      candidate_id: context.candidateId,
      enterprise_id: STANDARD_ENTERPRISE_ID,
      issued_at: timestamp,
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      rotation: recruitRotation,
    };
    state.invite_sessions[digestToken(tokens.RECRUIT)] = inviteSession;
    state.audit.push({
      event_id: createOpaqueId('audit'),
      event_type: 'INVITE_SESSION_ROTATED',
      occurred_at: timestamp,
      invitation_id: context.invitationId,
      invite_session_id: inviteSession.invite_session_id,
      rotation: recruitRotation,
      authority_source: SESSION_RECOVERY_CONFIRMATION,
      recovery_role: 'RECRUIT',
    });
    if (state.audit.length > 120) throw new Error('RELEASE5_SESSION_RECOVERY_AUDIT_BOUND_EXCEEDED');
    return {
      ...context,
      priorRecoveryAuditCount: priorRecoveryAudits.length,
      auditCount: state.audit.length,
    };
  });
  const service = getRecruitingService(process.env);
  for (const role of ['ADMIN', 'STANDARD']) {
    const inspected = await service.inspectManagerReadOnly(tokens[role]);
    const expectedProfile = role === 'ADMIN' ? ADMIN_PROFILE_ID : STANDARD_PROFILE_ID;
    if (inspected?.membership?.manager_profile_id !== expectedProfile
        || Boolean(inspected?.capabilities?.master_control) !== (role === 'ADMIN')) {
      throw new Error('RELEASE5_MANAGER_SESSION_RECOVERY_VERIFICATION_FAILED');
    }
  }
  const inspectedRecruit = await service.inspectInviteSession(tokens.RECRUIT);
  if (inspectedRecruit?.relationship?.relationship_ref !== recovered.invitationId
      || inspectedRecruit?.relationship?.candidate_id !== recovered.candidateId) {
    throw new Error('RELEASE5_INVITE_SESSION_RECOVERY_VERIFICATION_FAILED');
  }
  const after = await inspectKeys(redis, { expectedPhase: before.phase });
  const auditDelta = 3 - recovered.priorRecoveryAuditCount;
  const recoveryMode = recovered.priorRecoveryAuditCount === 0 ? 'FIRST' : 'RETRY';
  if (!after.stable || after.unexpected !== 0 || after.total !== before.total
      || ![0, 3].includes(auditDelta)
      || after.auditCount !== before.auditCount + auditDelta
      || after.auditCount !== recovered.auditCount
      || stableHash(after.classes) !== stableHash(before.classes)
      || Object.entries(before.classFingerprints).some(([classification, fingerprint]) =>
        classification !== 'release5_recruiting_state'
          && after.classFingerprints[classification] !== fingerprint)) {
    throw new Error('RELEASE5_SESSION_RECOVERY_POSTCONDITION_INVALID');
  }
  res.setHeader('Set-Cookie', [
    secureCookie('__Host-more_release5_recovery_admin', tokens.ADMIN, 10 * 60),
    secureCookie('__Host-more_release5_recovery_standard', tokens.STANDARD, 10 * 60),
    secureCookie('__Host-more_release5_recovery_recruit', tokens.RECRUIT, 10 * 60),
  ]);
  return json(res, 200, {
    ok: true,
    rolesRotated: 3,
    cookieCount: 3,
    auditDelta,
    recoveryMode,
    workflowPhase: recovered.phase,
    invitationId: recovered.invitationId,
    candidateId: recovered.candidateId,
    profileId: recovered.profileId,
    bosJobId: recovered.bosJobId,
    assessmentId: recovered.assessmentId,
    valuesExposed: false,
  });
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
  const token = managerTokenFromCookie(incoming);
  const service = getRecruitingService(process.env);
  const inspected = await service.inspectManagerReadOnly(token);
  const wantsMasterControl = view === 'master_control';
  if (inspected.membership?.status !== 'ACTIVE'
      || inspected.membership?.setup_state !== 'COMPLETE'
      || Boolean(inspected.capabilities?.master_control) !== wantsMasterControl) {
    throw new Error('RELEASE5_MANAGER_SESSION_SCOPE_MISMATCH');
  }
  // Keep the caller's valid HttpOnly session stable. Only a one-time CSRF
  // proof is minted before the literal HTTP mutation, so a later provider or
  // assertion failure cannot strand the caller behind an unreturned rotation.
  const csrf = await service.issueManagerCsrf(token);
  if (!csrf) throw new Error('RELEASE5_MANAGER_CSRF_FAILED');
  return { cookie: incoming, csrf, body: inspected };
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
  const matches = Object.values(state.outbox || {}).filter((item) => item.kind === kind
      && item.membership_id === membershipId
      && (invitationId === null || item.invitation_id === invitationId)
      && (generation === null || item.payload?.setup_generation === generation)
      && item.state === 'DELIVERED'
      && String(item.provider_receipt || '').startsWith('resend:'))
    .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
  if (matches.length > 1) throw new Error('RELEASE5_DUPLICATE_DELIVERY_DETECTED');
  return matches[0] || null;
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

function assertRecruitingStateShape(state) {
  const expectedTopLevel = new Set([
    'version', 'memberships', 'manager_challenges', 'manager_sessions', 'manager_csrf_proofs',
    'manager_setup_challenges', 'manager_setup_sessions', 'manager_setup_csrf_proofs', 'invite_sessions',
    'profile_connection_challenges', 'invitations', 'opportunity_by_enterprise', 'evidence_by_candidate',
    'intelligence_by_candidate', 'consultation_requests', 'consultation_relationships',
    'shared_business_sessions', 'gu_effect_outbox', 'outbox', 'inbox_by_membership', 'audit',
  ]);
  if (!state || state.version !== 4 || Object.keys(state).length !== expectedTopLevel.size
      || [...expectedTopLevel].some((key) => !Object.hasOwn(state, key))) {
    throw new Error('RELEASE5_RECRUITING_STATE_SHAPE_INVALID');
  }
  const mapBuckets = [...expectedTopLevel].filter((key) => !['version', 'audit'].includes(key));
  if (mapBuckets.some((key) => !state[key] || typeof state[key] !== 'object' || Array.isArray(state[key]))
      || !Array.isArray(state.audit)) {
    throw new Error('RELEASE5_RECRUITING_STATE_BUCKET_INVALID');
  }
}

function assertExactKeyedRecords(bucket, idField, code) {
  const entries = Object.entries(bucket || {});
  const embedded = entries.map(([, item]) => item?.[idField]);
  if (entries.some(([key, item]) => !item || typeof item !== 'object' || Array.isArray(item)
      || typeof item[idField] !== 'string' || item[idField] !== key)
      || new Set(embedded).size !== embedded.length) {
    throw new Error(code);
  }
}

function release5AgreementMutationScope(state, { memberships, invitation, profileId = null, assessmentId = null }) {
  const agreementsWithDeliveryEvidence = Object.entries(state.shared_business_sessions || {})
    .filter(([, session]) => session?.invariants?.external_mutation === true
      || session?.agreement_delivery?.recipients?.some((recipient) =>
        ['DELIVERED', 'FAILED'].includes(recipient?.state)));
  if (agreementsWithDeliveryEvidence.length === 0) {
    return Object.freeze({ sessionId: null, path: null, agreementComplete: false });
  }

  const invalid = () => {
    throw new Error('RELEASE5_RECRUITING_STATE_IDENTITY_SCOPE_INVALID');
  };
  if (agreementsWithDeliveryEvidence.length !== 1 || !invitation) invalid();

  const [sessionKey, session] = agreementsWithDeliveryEvidence[0];
  const membership = memberships.find((item) => item.manager_profile_id === STANDARD_PROFILE_ID) || null;
  const relationship = state.consultation_relationships?.[session?.relationship_id] || null;
  const accepted = session?.accepted_plan_snapshot;
  const delivery = session?.agreement_delivery;
  const recipients = delivery?.recipients;
  const proposals = session?.proposals;
  const decisions = session?.decisions;
  const acceptedProposals = Array.isArray(proposals)
    ? proposals.filter((item) => item?.proposal_id === accepted?.proposal_id)
    : null;
  const acceptedProposal = acceptedProposals?.[0] || null;
  const acceptedDecisions = Array.isArray(decisions)
    ? decisions.filter((item) => item?.acceptance_id === accepted?.acceptance_id)
    : [];
  const acceptedDecision = acceptedDecisions[0] || null;
  const normalizedProfile = String(profileId || invitation.bos_profile_id || '').trim().toLowerCase();
  const normalizedAssessment = String(assessmentId || invitation.ba_assessment_id || '').trim().toLowerCase();

  if (!membership
      || membership.status !== 'ACTIVE'
      || membership.setup_state !== 'COMPLETE'
      || membership.manager_profile_id !== STANDARD_PROFILE_ID
      || membership.manager_email !== approvedRecipients().standard
      || membership.enterprise_id !== STANDARD_ENTERPRISE_ID
      || sessionKey !== session.session_id
      || session.contract !== 'more_recruiting_gu_v1_shared_business_session_v1'
      || session.status !== 'COMPLETED'
      || session.synthetic_only !== false
      || session.invariants?.canonical_mutation !== false
      || session.invariants?.recruiting_v1_mutation !== false
      || session.invariants?.model_output_is_canonical !== false
      || session.manager_binding?.membership_id !== membership.membership_id
      || session.manager_binding?.subject_id !== membership.manager_subject_id
      || session.manager_binding?.enterprise_id !== membership.enterprise_id
      || session.manager_binding?.name !== membership.manager_name
      || session.manager_binding?.entitlement_mode !== membership.entitlement_mode
      || session.subject_binding?.candidate_id !== invitation.candidate_id
      || session.subject_binding?.consultation_request_id != null
      || String(session.subject_binding?.profile_id || '').toLowerCase() !== normalizedProfile
      || session.subject_binding?.name !== invitation.recruit_name
      || invitation.state !== 'ACCEPTED'
      || invitation.delivery_state !== 'DELIVERED'
      || !Number.isFinite(Date.parse(invitation.accepted_at || ''))
      || invitation.revoked_at
      || invitation.consent?.version !== 'recruiting_v1_consent_2026_08'
      || invitation.consent?.accepted_at !== invitation.accepted_at
      || invitation.membership_id !== membership.membership_id
      || invitation.manager_subject_id !== membership.manager_subject_id
      || invitation.enterprise_id !== membership.enterprise_id
      || invitation.recruit_email !== approvedRecipients().recruit
      || invitation.ba_readiness !== 'BA_INTELLIGENCE_READY'
      || String(invitation.bos_profile_id || '').toLowerCase() !== normalizedProfile
      || String(invitation.ba_assessment_id || '').toLowerCase() !== normalizedAssessment
      || !normalizedProfile
      || !normalizedAssessment
      || relationship?.relationship_id !== session.relationship_id
      || relationship.status !== 'ACTIVE'
      || relationship.membership_id !== membership.membership_id
      || relationship.manager_subject_id !== membership.manager_subject_id
      || relationship.enterprise_id !== membership.enterprise_id
      || relationship.candidate_id !== invitation.candidate_id
      || String(relationship.profile_id || '').toLowerCase() !== normalizedProfile
      || relationship.owner_name !== invitation.recruit_name
      || relationship.consent_state !== 'RECRUITING_INVITATION_ACCEPTED'
      || relationship.source !== 'RECRUITING_V1_ACCEPTED_INVITATION'
      || relationship.authorized_at !== invitation.accepted_at
      || relationship.canonical_write_authority !== false
      || accepted?.contract !== 'more_consulting_accepted_plan_snapshot_v1'
      || !accepted.acceptance_id
      || accepted.session_id !== session.session_id
      || accepted.accepted_by !== 'MANAGER'
      || accepted.accepted_at !== session.completed_at
      || !accepted.plan
      || typeof accepted.plan !== 'object'
      || Array.isArray(accepted.plan)
      || stableHash(accepted.plan) !== accepted.snapshot_hash
      || !Array.isArray(proposals)
      || acceptedProposals.length !== 1
      || proposals.filter((item) => item?.status === 'ACCEPTED').length !== 1
      || acceptedProposal?.status !== 'ACCEPTED'
      || acceptedProposal.proposal_id !== session.current_proposal_id
      || acceptedProposal.version !== accepted.version
      || !acceptedProposal.proposal
      || stableHash(acceptedProposal.proposal) !== stableHash(accepted.plan)
      || accepted.acceptance_id !== `plan-acceptance-${stableHash({
        session_id: session.session_id,
        proposal_id: accepted.proposal_id,
        version: accepted.version,
        snapshot_hash: accepted.snapshot_hash,
      }).slice(0, 24)}`
      || acceptedDecisions.length !== 1
      || decisions.at(-1) !== acceptedDecision
      || acceptedDecision.decision !== 'YES'
      || acceptedDecision.proposal_id !== accepted.proposal_id
      || acceptedDecision.actor !== accepted.accepted_by
      || acceptedDecision.decided_at !== accepted.accepted_at
      || delivery?.contract !== 'more_consulting_agreed_plan_delivery_v1'
      || delivery.acceptance_id !== accepted.acceptance_id
      || !Array.isArray(recipients)
      || recipients.length !== 2
      || new Set(recipients.map((item) => item?.recipient_role)).size !== 2
      || !recipients.some((item) => item?.recipient_role === 'PERSON')
      || !recipients.some((item) => item?.recipient_role === 'MANAGER')) invalid();

  const agreementOutboxes = Object.values(state.outbox || {})
    .filter((item) => item?.kind === 'CONSULTING_AGREED_PLAN');
  if (agreementOutboxes.length !== 2
      || new Set(recipients.map((item) => item.outbox_id)).size !== 2
      || agreementOutboxes.some((item) => !recipients.some((recipient) => recipient.outbox_id === item.outbox_id))) invalid();

  let deliveredCount = 0;
  let failedCount = 0;
  for (const recipient of recipients) {
    const expectedRecipient = recipient.recipient_role === 'PERSON'
      ? approvedRecipients().recruit
      : recipient.recipient_role === 'MANAGER' ? approvedRecipients().standard : null;
    const expectedRecipientName = recipient.recipient_role === 'PERSON'
      ? invitation.recruit_name
      : recipient.recipient_role === 'MANAGER' ? membership.manager_name : null;
    const expectedIdempotencyKey = stableHash({
      acceptance_id: accepted.acceptance_id,
      recipient_role: recipient.recipient_role,
      snapshot_hash: accepted.snapshot_hash,
    });
    const outbox = state.outbox?.[recipient.outbox_id];
    const retryAudits = (state.audit || []).filter((event) =>
      event?.event_type === 'CONSULTING_AGREED_PLAN_RETRY_AUTHORIZED'
        && event.outbox_id === recipient.outbox_id
        && event.acceptance_id === accepted.acceptance_id
        && event.recipient_role === recipient.recipient_role
        && Number.isFinite(Date.parse(event.occurred_at || '')));
    const retryAudit = retryAudits.at(-1) || null;
    const retryAt = Date.parse(retryAudit?.occurred_at || '');
    const recipientAttemptedAt = Date.parse(recipient.attempted_at || '');
    const outboxUpdatedAt = Date.parse(outbox?.updated_at || '');
    const retryAuthorized = Boolean(retryAudit)
      && retryAt >= recipientAttemptedAt
      && retryAt <= outboxUpdatedAt;
    if (!expectedRecipient
        || !expectedRecipientName
        || recipient.idempotency_key !== expectedIdempotencyKey
        || recipient.synthetic !== false
        || recipient.recipient_masked !== expectedRecipient.replace(/^(.{2}).*(@.*)$/u, '$1***$2')
        || !Number.isFinite(Date.parse(recipient.attempted_at || ''))
        || !outbox
        || outbox.outbox_id !== recipient.outbox_id
        || outbox.idempotency_key !== recipient.idempotency_key
        || outbox.kind !== 'CONSULTING_AGREED_PLAN'
        || outbox.membership_id !== membership.membership_id
        || outbox.enterprise_id !== membership.enterprise_id
        || outbox.invitation_id !== invitation.invitation_id
        || outbox.recipient !== expectedRecipient
        || outbox.payload?.recipient_role !== recipient.recipient_role
        || outbox.payload?.acceptance_id !== accepted.acceptance_id
        || outbox.payload?.recipient_name !== expectedRecipientName
        || outbox.payload?.manager_name !== membership.manager_name
        || outbox.payload?.person_name !== invitation.recruit_name
        || !outbox.payload?.accepted_plan_snapshot
        || stableHash(outbox.payload?.accepted_plan_snapshot) !== stableHash(accepted)
        || !Number.isInteger(outbox.attempts)
        || outbox.attempts < 1
        || !Number.isFinite(outboxUpdatedAt)
        || outbox.token_capsule != null) invalid();
    if (recipient.state === 'DELIVERED') {
      if (outbox.state !== 'DELIVERED'
          || outbox.provider_receipt !== recipient.provider_receipt
          || !String(recipient.provider_receipt || '').startsWith('resend:')) invalid();
      deliveredCount += 1;
    } else if (recipient.state === 'FAILED') {
      const priorFailureReceipt = /^resend_/u.test(String(recipient.provider_receipt || ''));
      const stableFailure = outbox.state === 'FAILED'
        && outbox.provider_receipt === recipient.provider_receipt;
      const retryPending = ['PENDING', 'SENDING'].includes(outbox.state)
        && outbox.provider_receipt === recipient.provider_receipt
        && (outbox.state !== 'SENDING' || Number.isFinite(Date.parse(outbox.delivery_started_at || '')));
      const retryFinished = outbox.attempts >= 2 && (
        (outbox.state === 'DELIVERED' && String(outbox.provider_receipt || '').startsWith('resend:'))
        || (outbox.state === 'FAILED' && /^resend_/u.test(String(outbox.provider_receipt || '')))
      );
      if (!priorFailureReceipt
          || (!stableFailure && !(retryAuthorized && (retryPending || retryFinished)))) invalid();
      failedCount += 1;
    } else invalid();
  }

  const agreementComplete = deliveredCount === 2 && failedCount === 0 && delivery.status === 'DELIVERED';
  const retryablePartial = deliveredCount === 1 && failedCount === 1 && delivery.status === 'PARTIAL_FAILURE';
  const retryableFailure = deliveredCount === 0 && failedCount === 2 && delivery.status === 'FAILED';
  const expectedExternalMutation = deliveredCount > 0;
  if (session.invariants.external_mutation !== expectedExternalMutation
      || !agreementComplete && !retryablePartial && !retryableFailure) invalid();
  return Object.freeze({
    sessionId: session.session_id,
    path: expectedExternalMutation
      ? Object.freeze(['shared_business_sessions', session.session_id, 'invariants', 'external_mutation'])
      : null,
    agreementComplete,
  });
}

function release5IdentityClosure(state, { profileId = null, assessmentId = null } = {}) {
  const memberships = Object.values(state.memberships || {});
  const invitation = Object.values(state.invitations || {})[0] || null;
  const agreement = release5AgreementMutationScope(state, {
    memberships, invitation, profileId, assessmentId,
  });
  return Object.freeze({
    emails: new Set(Object.values(approvedRecipients())),
    profiles: new Set([ADMIN_PROFILE_ID, STANDARD_PROFILE_ID, profileId].filter(Boolean).map((value) => String(value).toLowerCase())),
    assessments: new Set([assessmentId].filter(Boolean).map((value) => String(value).toLowerCase())),
    invitations: new Set([invitation?.invitation_id].filter(Boolean)),
    candidates: new Set([invitation?.candidate_id].filter(Boolean)),
    memberships: new Set(memberships.map((item) => item.membership_id)),
    managerSubjects: new Set(memberships.map((item) => item.manager_subject_id)),
    enterprises: new Set([ADMIN_ENTERPRISE_ID, STANDARD_ENTERPRISE_ID]),
    agreementSessionId: agreement.sessionId,
    agreementMutationPath: agreement.path,
    agreementComplete: agreement.agreementComplete,
  });
}

function assertRelease5PayloadIsolation(value, closure, code = 'RELEASE5_RECRUITING_STATE_IDENTITY_SCOPE_INVALID') {
  const serialized = JSON.stringify(value);
  const emails = serialized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) || [];
  const profiles = serialized.match(/mm-\d{8}-[a-z0-9]{8}/giu) || [];
  const assessments = serialized.match(/ba-\d{8}-[a-f0-9]{8}/giu) || [];
  if (emails.some((item) => !closure.emails.has(normalizeEmail(item)))
      || profiles.some((item) => !closure.profiles.has(String(item).toLowerCase()))
      || assessments.some((item) => !closure.assessments.has(String(item).toLowerCase()))) {
    throw new Error(code);
  }
  const exactPath = (left, right) => Array.isArray(left) && Array.isArray(right)
    && left.length === right.length && left.every((item, index) => item === right[index]);
  const visit = (node, path = []) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, [...path, index]));
      return;
    }
    for (const [key, item] of Object.entries(node)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === 'external_mutation' && item === true
          && !exactPath([...path, key], closure.agreementMutationPath)) throw new Error(code);
      if ((normalizedKey.includes('phone')
          || ['customer_id', 'person_id', 'stripe_customer_id', 'stripe_subscription_id'].includes(normalizedKey))
          && item != null && String(item).trim()) throw new Error(code);
      if (['real_customer_data', 'production_connection_used', 'customer_active', 'production_active',
        'production_customer_active', 'canonical_write_authority',
        'raw_provider_payload_persisted', 'raw_request_persisted', 'raw_response_persisted'].includes(normalizedKey)
          && item === true) throw new Error(code);
      if (typeof item === 'string') {
        const exact = item.trim();
        if (normalizedKey === 'membership_id' || normalizedKey === 'target_membership_id'
            || normalizedKey === 'actor_membership_id') {
          if (!closure.memberships.has(exact)) throw new Error(code);
        } else if (normalizedKey === 'manager_subject_id' || normalizedKey === 'subject_id') {
          if (exact.startsWith('manager_') && !closure.managerSubjects.has(exact)) throw new Error(code);
        } else if (normalizedKey === 'enterprise_id') {
          if (!closure.enterprises.has(exact)) throw new Error(code);
        } else if (normalizedKey === 'invitation_id'
            || (normalizedKey === 'relationship_ref' && exact.startsWith('invite_'))
            || (normalizedKey === 'authority_ref' && exact.startsWith('invite_'))) {
          if (!closure.invitations.has(exact)) throw new Error(code);
        } else if (normalizedKey === 'candidate_id') {
          if (!closure.candidates.has(exact)) throw new Error(code);
        } else if (['profile_id', 'manager_profile_id', 'bos_profile_id', 'owner_profile_id'].includes(normalizedKey)) {
          if (/^mm-/iu.test(exact) && !closure.profiles.has(exact.toLowerCase())) throw new Error(code);
        } else if (['assessment_id', 'ba_assessment_id'].includes(normalizedKey)) {
          if (/^ba-/iu.test(exact) && !closure.assessments.has(exact.toLowerCase())) throw new Error(code);
        }
      }
      visit(item, [...path, key]);
    }
  };
  visit(value);
}

function assertRelease5StateClosure(state, { profileId = null, assessmentId = null } = {}) {
  const limits = Object.freeze({
    memberships: 2, manager_challenges: 4, manager_sessions: 4, manager_csrf_proofs: 12,
    manager_setup_challenges: 3, manager_setup_sessions: 3, manager_setup_csrf_proofs: 8,
    invite_sessions: 3, profile_connection_challenges: 2, invitations: 1,
    opportunity_by_enterprise: 2, evidence_by_candidate: 1, intelligence_by_candidate: 1,
    consultation_requests: 1, consultation_relationships: 1, shared_business_sessions: 2,
    gu_effect_outbox: 2, outbox: 16, inbox_by_membership: 2,
  });
  for (const [bucket, limit] of Object.entries(limits)) {
    if (Object.keys(state[bucket] || {}).length > limit) throw new Error('RELEASE5_RECRUITING_STATE_BOUND_EXCEEDED');
  }
  if (state.audit.length > 120) throw new Error('RELEASE5_RECRUITING_AUDIT_BOUND_EXCEEDED');
  assertExactKeyedRecords(state.memberships, 'membership_id', 'RELEASE5_MEMBERSHIP_KEY_ID_MISMATCH');
  assertExactKeyedRecords(state.invitations, 'invitation_id', 'RELEASE5_INVITATION_KEY_ID_MISMATCH');
  assertExactKeyedRecords(state.consultation_requests, 'request_id', 'RELEASE5_CONSULTATION_REQUEST_KEY_ID_MISMATCH');
  assertExactKeyedRecords(state.consultation_relationships, 'relationship_id', 'RELEASE5_CONSULTATION_RELATIONSHIP_KEY_ID_MISMATCH');
  assertExactKeyedRecords(state.shared_business_sessions, 'session_id', 'RELEASE5_SHARED_SESSION_KEY_ID_MISMATCH');
  assertExactKeyedRecords(state.outbox, 'outbox_id', 'RELEASE5_OUTBOX_KEY_ID_MISMATCH');

  const closure = release5IdentityClosure(state, { profileId, assessmentId });
  if (Object.keys(state.opportunity_by_enterprise || {}).some((key) => !closure.enterprises.has(key))
      || Object.keys(state.evidence_by_candidate || {}).some((key) => !closure.candidates.has(key))
      || Object.keys(state.intelligence_by_candidate || {}).some((key) => !closure.candidates.has(key))
      || Object.keys(state.inbox_by_membership || {}).some((key) => !closure.memberships.has(key))) {
    throw new Error('RELEASE5_RECRUITING_STATE_REFERENCE_SCOPE_INVALID');
  }
  assertRelease5PayloadIsolation(state, closure);
}

function release5StateContext(state, { expectedPhase = 'auto', requireProfile = false, requireAssessment = false } = {}) {
  assertRecruitingStateShape(state);
  const memberships = Object.values(state.memberships || {});
  const admin = memberships.find((item) => item.manager_profile_id === ADMIN_PROFILE_ID) || null;
  const standard = memberships.find((item) => item.manager_profile_id === STANDARD_PROFILE_ID) || null;
  if (memberships.some((item) => ![ADMIN_PROFILE_ID, STANDARD_PROFILE_ID].includes(item.manager_profile_id))) {
    throw new Error('RELEASE5_UNEXPECTED_MANAGER_MEMBERSHIP');
  }
  if (memberships.length !== Number(Boolean(admin)) + Number(Boolean(standard))
      || memberships.filter((item) => item.manager_profile_id === ADMIN_PROFILE_ID).length > 1
      || memberships.filter((item) => item.manager_profile_id === STANDARD_PROFILE_ID).length > 1) {
    throw new Error('RELEASE5_DUPLICATE_MANAGER_MEMBERSHIP');
  }
  if (admin) assertAdminMembershipExact(admin);
  if (standard) assertStandardMembershipExact(standard);

  const invitations = Object.values(state.invitations || {});
  if (invitations.length > 1) throw new Error('RELEASE5_SYNTHETIC_RECRUIT_NOT_SOLE');
  const invitation = invitations[0] || null;
  if (invitation) {
    if (!standard) throw new Error('RELEASE5_RECRUIT_MANAGER_REQUIRED');
    assertInvitationExact(invitation, standard);
    if (invitation.membership_id !== standard.membership_id
        || invitation.enterprise_id !== STANDARD_ENTERPRISE_ID
        || invitation.manager_subject_id !== standard.manager_subject_id) {
      throw new Error('RELEASE5_RECRUIT_SCOPE_MISMATCH');
    }
  }
  const deliveryGroups = new Map();
  for (const item of Object.values(state.outbox || {})) {
    if (!['MANAGER_VERIFICATION', 'MANAGER_SETUP', 'RECRUIT_INVITATION'].includes(item.kind)) continue;
    const key = [item.kind, item.membership_id, item.invitation_id || '', item.payload?.setup_generation || ''].join(':');
    deliveryGroups.set(key, (deliveryGroups.get(key) || 0) + 1);
  }
  if ([...deliveryGroups.values()].some((count) => count > 1)) {
    throw new Error('RELEASE5_DUPLICATE_DELIVERY_DETECTED');
  }

  let phase = 'empty';
  if (admin) phase = 'bootstrap';
  if (standard) phase = standard.status === 'ACTIVE' && standard.setup_state === 'COMPLETE'
    ? 'managers_ready'
    : 'standard_manager_pending';
  if (invitation) phase = 'invitation_delivered';

  let normalizedProfileId = null;
  let assessmentId = null;
  if (invitation?.accepted_at) {
    if (invitation.state !== 'ACCEPTED' || invitation.revoked_at
        || invitation.delivery_state !== 'DELIVERED'
        || !Number.isFinite(Date.parse(invitation.accepted_at))
        || invitation.consent?.version !== 'recruiting_v1_consent_2026_08'
        || invitation.consent?.purpose !== 'RECRUITING_INTELLIGENCE'
        || invitation.consent?.accepted_at !== invitation.accepted_at
        || invitation.token_digest !== null
        || invitation.paired_entitlement_version !== 1
        || invitation.entitlement_state !== 'CONSUMED'
        || invitation.bos_entitlement_state !== 'CONSUMED') {
      throw new Error('RELEASE5_ACCEPTED_RECRUIT_STATE_INVALID');
    }
    phase = 'recruit_accepted';
    const rawProfileId = String(invitation.bos_profile_id || '').trim();
    const rawJobId = String(invitation.bos_job_id || '').trim();
    normalizedProfileId = rawProfileId ? normalizeProfileId(rawProfileId) : null;
    if (rawProfileId && !/^MM-\d{8}-[A-Z0-9]{8}$/u.test(normalizedProfileId)) {
      throw new Error('RELEASE5_RECRUIT_PROFILE_ID_INVALID');
    }
    assessmentId = String(invitation.ba_assessment_id || '').trim().toLowerCase() || null;
    if (assessmentId && !/^ba-\d{8}-[a-f0-9]{8}$/u.test(assessmentId)) {
      throw new Error('RELEASE5_RECRUIT_ASSESSMENT_ID_INVALID');
    }
    const noBaReceipt = invitation.ba_realization_receipt == null;
    if (!normalizedProfileId) {
      if (assessmentId || !noBaReceipt || invitation.ba_readiness !== 'BA_NOT_STARTED'
          || invitation.ba_entitlement_state !== 'RESERVED') {
        throw new Error('RELEASE5_PRE_BOS_TUPLE_INVALID');
      }
      if (rawJobId) {
        if (invitation.readiness_state !== 'BOS_IN_PROGRESS') throw new Error('RELEASE5_BOS_PROGRESS_TUPLE_INVALID');
        phase = 'bos_in_progress';
      } else if (invitation.readiness_state !== 'CONSENTED') {
        throw new Error('RELEASE5_ACCEPTED_TUPLE_INVALID');
      }
    } else {
      if (!rawJobId) throw new Error('RELEASE5_BOS_JOB_REQUIRED');
      if (invitation.ba_readiness === 'BA_NOT_STARTED') {
        if (invitation.readiness_state !== 'BOS_READY' || assessmentId || !noBaReceipt
            || invitation.ba_entitlement_state !== 'RESERVED') {
          throw new Error('RELEASE5_BOS_READY_TUPLE_INVALID');
        }
        phase = 'bos_ready';
      } else if (['BA_INTAKE_SAVED', 'BA_IN_PROGRESS'].includes(invitation.ba_readiness)) {
        if (invitation.readiness_state !== invitation.ba_readiness || !assessmentId || !noBaReceipt
            || invitation.ba_entitlement_state !== 'CONSUMED') {
          throw new Error('RELEASE5_BA_PROGRESS_TUPLE_INVALID');
        }
        phase = 'ba_in_progress';
      } else if (invitation.ba_readiness === 'BA_INTELLIGENCE_READY') {
        const receipt = invitation.ba_realization_receipt;
        if (invitation.readiness_state !== 'BA_INTELLIGENCE_READY' || !assessmentId
            || invitation.ba_entitlement_state !== 'CONSUMED'
            || receipt?.contract !== 'recruiting_canonical_new_ba_ready_receipt_v1'
            || String(receipt.profile_id || '').toUpperCase() !== normalizedProfileId
            || receipt.assessment_id !== assessmentId
            || !receipt.realization_id
            || !/^[a-f0-9]{64}$/u.test(String(receipt.realization_sha256 || ''))
            || !/^[a-f0-9]{64}$/u.test(String(receipt.artifact_sha256 || ''))
            || receipt.completeness !== 'PASS'
            || receipt.customer_projection_completeness !== 'COMPLETE') {
          throw new Error('RELEASE5_RECRUIT_BA_RECEIPT_INVALID');
        }
        phase = 'ba_ready';
      } else {
        throw new Error('RELEASE5_BA_READINESS_TUPLE_INVALID');
      }
    }
  } else if (invitation) {
    if (invitation.state !== 'DELIVERED' || invitation.delivery_state !== 'DELIVERED'
        || invitation.readiness_state !== 'INVITED' || invitation.ba_readiness !== 'BA_NOT_STARTED'
        || invitation.paired_entitlement_version !== 1
        || invitation.entitlement_state !== 'RESERVED'
        || invitation.bos_entitlement_state !== 'RESERVED'
        || invitation.ba_entitlement_state !== 'RESERVED'
        || !/^[a-f0-9]{64}$/u.test(String(invitation.token_digest || ''))
        || invitation.revoked_at || invitation.bos_job_id || invitation.bos_profile_id
        || invitation.ba_assessment_id || invitation.ba_realization_receipt || invitation.consent) {
      throw new Error('RELEASE5_UNACCEPTED_RECRUIT_TUPLE_INVALID');
    }
  }

  const allowedEmails = new Set(Object.values(approvedRecipients()));
  const emails = JSON.stringify(state).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) || [];
  if (emails.some((email) => !allowedEmails.has(normalizeEmail(email)))) {
    throw new Error('RELEASE5_RECRUITING_STATE_NON_SYNTHETIC_EMAIL');
  }
  const allowedProfiles = new Set(
    [ADMIN_PROFILE_ID, STANDARD_PROFILE_ID, normalizedProfileId]
      .filter(Boolean)
      .map((profileId) => String(profileId).toLowerCase()),
  );
  const profileIds = JSON.stringify(state).match(/mm-\d{8}-[a-z0-9]{8}/giu) || [];
  if (profileIds.some((profileId) => !allowedProfiles.has(String(profileId).toLowerCase()))) {
    throw new Error('RELEASE5_RECRUITING_STATE_CROSS_PROFILE_ID');
  }
  assertRelease5StateClosure(state, { profileId: normalizedProfileId, assessmentId });
  if (requireProfile && !normalizedProfileId) throw new Error('RELEASE5_ACCEPTED_RECRUIT_PROFILE_REQUIRED');
  if (requireAssessment && !assessmentId) throw new Error('RELEASE5_ACCEPTED_RECRUIT_ASSESSMENT_REQUIRED');

  const expected = String(expectedPhase || 'auto');
  if (expected !== 'auto') {
    const phaseMatches = expected === phase || (expected === 'bootstrap' && ['empty', 'bootstrap'].includes(phase));
    if (!phaseMatches) throw new Error('RELEASE5_REDIS_PHASE_MISMATCH');
  }
  return Object.freeze({
    phase,
    profileId: normalizedProfileId ? normalizedProfileId.toUpperCase() : null,
    assessmentId,
    invitationId: invitation?.invitation_id || null,
    candidateId: invitation?.candidate_id || null,
    bosJobId: invitation?.bos_job_id || null,
    baReadiness: invitation?.ba_readiness || 'BA_NOT_STARTED',
    baRealizationReceipt: invitation?.ba_realization_receipt || null,
  });
}

async function validatedSafeState(redis) {
  const state = await readState(redis);
  let context = await enrichStateContext(redis, release5StateContext(state));
  if (context.profileId) context = await enrichAuthoredContext(redis, context);
  return Object.freeze({ state, context, safe: safeState(state) });
}

function inviteTokenFromRequest(req) {
  const pair = String(req.headers?.cookie || '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith('__Host-more_recruiting_invite='));
  const separator = String(pair || '').indexOf('=');
  if (separator < 1) throw new Error('RELEASE5_RECRUIT_SESSION_REQUIRED');
  const token = decodeURIComponent(pair.slice(separator + 1));
  if (!token) throw new Error('RELEASE5_RECRUIT_SESSION_REQUIRED');
  return token;
}

async function assertInviteSessionExact(req, context) {
  const inspected = await getRecruitingService(process.env).inspectInviteSession(inviteTokenFromRequest(req));
  if (inspected?.relationship?.relationship_ref !== context.invitationId
      || inspected?.relationship?.candidate_id !== context.candidateId
      || inspected?.invite_session?.invitation_id !== context.invitationId
      || inspected?.invite_session?.candidate_id !== context.candidateId) {
    throw new Error('RELEASE5_RECRUIT_SESSION_SCOPE_MISMATCH');
  }
  return true;
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
  const type = await redis.type(RECRUITING_STATE_KEY);
  if (type === 'none') return createEmptyRecruitingState();
  if (type !== 'string') throw new Error('RELEASE5_RECRUITING_RAW_STATE_TYPE_INVALID');
  const raw = await redis.get(RECRUITING_STATE_KEY);
  if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_RECRUITING_STATE_BYTES) {
    throw new Error('RELEASE5_RECRUITING_RAW_STATE_SIZE_INVALID');
  }
  const state = parseObject(raw);
  assertRecruitingStateShape(state);
  // The production store's compatibility normalizer deliberately rekeys these
  // two maps. This controller validates the untouched durable envelope first,
  // so malformed aliases or duplicate embedded identities cannot be hidden by
  // normalization before a canary mutation.
  assertExactKeyedRecords(state.memberships, 'membership_id', 'RELEASE5_MEMBERSHIP_KEY_ID_MISMATCH');
  assertExactKeyedRecords(state.invitations, 'invitation_id', 'RELEASE5_INVITATION_KEY_ID_MISMATCH');
  return state;
}

async function completeManagerSetupAtomically(redis, service, token, membershipId) {
  const canonical = await getCanonicalProfile(redis, STANDARD_PROFILE_ID);
  if (!canonical.found || canonical.profile_id !== STANDARD_PROFILE_ID) {
    throw new Error('RELEASE5_STANDARD_MANAGER_PROFILE_NOT_FOUND');
  }
  const tokenDigest = digestToken(token);
  const managerSessionToken = createOpaqueToken();
  const completed = await service.store.transaction((state) => {
    const now = new Date(service.now());
    const timestamp = now.toISOString();
    const challenge = state.manager_setup_challenges?.[tokenDigest];
    const membership = state.memberships?.[membershipId];
    if (!challenge || challenge.membership_id !== membershipId
        || challenge.consumed_at || challenge.superseded_at
        || challenge.generation !== membership?.setup_generation
        || Date.parse(challenge.expires_at) <= now.getTime()) {
      throw new Error('RELEASE5_SETUP_CHALLENGE_NOT_CURRENT');
    }
    assertStandardMembershipExact(membership);
    if (membership.status !== 'PENDING_SETUP' || membership.setup_state !== 'SETUP_SENT'
        || membership.manager_profile_id !== STANDARD_PROFILE_ID) {
      throw new Error('RELEASE5_SETUP_HANDOFF_STATE_INVALID');
    }
    if (Object.values(state.manager_setup_sessions || {}).length
        || Object.values(state.manager_setup_csrf_proofs || {}).length) {
      throw new Error('RELEASE5_SETUP_INTERMEDIATE_STATE_UNEXPECTED');
    }
    challenge.consumed_at = timestamp;
    membership.status = 'ACTIVE';
    membership.setup_state = 'COMPLETE';
    membership.email_verified_at = timestamp;
    membership.profile_bound_at = timestamp;
    membership.setup_completed_at = timestamp;
    membership.updated_at = timestamp;
    const session = {
      session_id: createOpaqueId('manager_session'),
      membership_id: membership.membership_id,
      manager_subject_id: membership.manager_subject_id,
      enterprise_id: membership.enterprise_id,
      issued_at: timestamp,
      expires_at: new Date(now.getTime() + MANAGER_SESSION_TTL_MS).toISOString(),
      rotation: 0,
    };
    state.manager_sessions[digestToken(managerSessionToken)] = session;
    for (const eventType of ['MANAGER_SETUP_EMAIL_VERIFIED', 'MANAGER_SETUP_COMPLETED']) {
      state.audit.push({
        event_id: createOpaqueId('audit'),
        event_type: eventType,
        occurred_at: timestamp,
        membership_id: membership.membership_id,
        target_membership_id: membership.membership_id,
        ...(eventType === 'MANAGER_SETUP_COMPLETED' ? { profile_id: STANDARD_PROFILE_ID } : {}),
      });
    }
    return { session, membership };
  });
  return { ...completed, manager_session_token: managerSessionToken };
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
    if (membership.status !== 'PENDING_SETUP' || membership.setup_state !== 'SETUP_SENT') {
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
    const completed = await completeManagerSetupAtomically(redis, service, token, membership.membership_id);
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

function safeProviderAccounting(accounting = {}) {
  if (accounting.store !== false) throw new Error('RELEASE5_PROVIDER_STORE_FALSE_REQUIRED');
  const numeric = (name) => Number.isFinite(Number(accounting[name])) ? Number(accounting[name]) : 0;
  return Object.freeze({
    store: false,
    calls: numeric('calls'),
    reasoningCalls: numeric('reasoning_calls'),
    surfaceCalls: numeric('surface_calls'),
    retries: numeric('retries'),
  });
}

function safeProductReceipt(kind, result, profileId) {
  if (result?.review_required === true) throw new Error('RELEASE5_PRODUCT_REVIEW_REQUIRED');
  const resultProfile = String(result?.receipt?.profile_id || result?.profile_id || result?.artifact?.profile_id || '').toUpperCase();
  if (resultProfile !== profileId) throw new Error(`RELEASE5_${kind}_RESULT_PROFILE_MISMATCH`);
  const pending = result?.pending === true;
  const receipt = result?.receipt || null;
  const realizationId = receipt?.realization_id || result?.desired_realization_id || null;
  const base = {
    ok: true,
    product: kind,
    state: pending ? 'ADVANCING' : 'COMPLETE',
    status: String(result?.status || (receipt ? 'PASS' : '')).slice(0, 80) || null,
    path: String(receipt?.path || result?.path || '').slice(0, 120) || null,
    phase: String(result?.phase || result?.accepted_stage || result?.next_stage || '').slice(0, 120) || null,
    profileIdSha256: sha256Text(profileId),
    realizationIdSha256: realizationId ? sha256Text(realizationId) : null,
    artifactSha256: /^[a-f0-9]{64}$/u.test(String(receipt?.artifact_sha256 || '')) ? receipt.artifact_sha256 : null,
    customerActive: false,
    allowedProfileCount: 1,
    providerValuesExposed: false,
    valuesExposed: false,
  };
  if (pending) return base;
  if (!receipt || !result?.artifact) throw new Error(`RELEASE5_${kind}_SAFE_RECEIPT_REQUIRED`);
  if (kind === 'NEW_BOS') {
    if (receipt.production_active !== false || Number(receipt.completeness_count || 0) <= 0) {
      throw new Error('RELEASE5_NEW_BOS_COMPLETION_RECEIPT_INVALID');
    }
    return {
      ...base,
      completenessCount: Number(receipt.completeness_count),
      providerAccounting: safeProviderAccounting(receipt.provider_accounting),
    };
  }
  if (receipt.production_customer_active !== false
      || receipt.store !== false
      || receipt.fusion_gate !== 'VALIDATED_PRIVATE_ACTIVATION_OFF'
      || receipt.completeness !== 'PASS') {
    throw new Error('RELEASE5_NEW_BA_COMPLETION_RECEIPT_INVALID');
  }
  return {
    ...base,
    assessmentIdSha256: sha256Text(receipt.assessment_id),
    completeness: receipt.completeness,
    inspectableObjectCount: Number(receipt.inspectable_object_count || 0),
    providerAccounting: Object.freeze({
      store: false,
      calls: Number(receipt.provider_calls || 0),
    }),
  };
}

function boundedTwoBoxEnvelope() {
  return Object.freeze({
    valuesExposed: false,
    exactDynamicProfileCount: 1,
    additionalEnvironmentRowCount: 0,
    broadActivation: false,
    productionConnectionUsed: false,
    realCustomerReferenceCount: 0,
    implementationAssignmentsExposed: false,
  });
}

async function scanKeySet(redis) {
  let cursor = '0';
  let iterations = 0;
  const keys = new Set();
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', '*', 'COUNT', 250);
    cursor = next;
    for (const key of batch) keys.add(key);
    iterations += 1;
    if (keys.size > 5000 || iterations > 200) throw new Error('RELEASE5_REDIS_SCAN_BOUND_EXCEEDED');
  } while (cursor !== '0');
  return keys;
}

async function redisKeyDigest(redis, key) {
  const type = await redis.type(key);
  let value;
  if (type === 'string') {
    value = await redis.get(key);
  } else if (type === 'list') {
    const length = await redis.llen(key);
    if (length > 5000) throw new Error('RELEASE5_REDIS_VALUE_BOUND_EXCEEDED');
    value = await redis.lrange(key, 0, -1);
  } else if (type === 'set') {
    value = (await redis.smembers(key)).sort();
    if (value.length > 5000) throw new Error('RELEASE5_REDIS_VALUE_BOUND_EXCEEDED');
  } else if (type === 'hash') {
    const entries = Object.entries(await redis.hgetall(key)).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length > 5000) throw new Error('RELEASE5_REDIS_VALUE_BOUND_EXCEEDED');
    value = entries;
  } else if (type === 'zset') {
    value = await redis.zrange(key, 0, -1, 'WITHSCORES');
    if (value.length > 10000) throw new Error('RELEASE5_REDIS_VALUE_BOUND_EXCEEDED');
  } else {
    throw new Error('RELEASE5_REDIS_VALUE_TYPE_INVALID');
  }
  return sha256Text(JSON.stringify([type, value]));
}

async function captureKeySnapshot(redis, context) {
  const keys = await scanKeySet(redis);
  const snapshot = new Map();
  for (const key of keys) {
    const classification = keyClass(key, context);
    // A peer invocation may hold a bounded single-flight key. It is not
    // durable state: exclude it from the immutable snapshot, but require it to
    // be gone in the post-operation allowlist inspection.
    if (classification === 'live_lock_forbidden') continue;
    if (classification === 'release5_recruiting_projection_retry'
        && !await recruitingProjectionRetryValid(redis, key, context)) {
      throw new Error('RELEASE5_RETRY_RECEIPT_SCOPE_INVALID');
    }
    if (classification === 'release5_new_ba_failure_ledger'
        && !await newBaFailureLedgerValid(redis, key, context)) {
      throw new Error('RELEASE5_FAILURE_LEDGER_SCOPE_INVALID');
    }
    snapshot.set(key, Object.freeze({
      classification,
      digest: await redisKeyDigest(redis, key),
    }));
  }
  return snapshot;
}

function assertBoundedRequestIdentity(req, context, { requireAssessment = false } = {}) {
  if (String(req.body?.invitation_id || '') !== context.invitationId) {
    throw new Error('RELEASE5_INVITATION_BINDING_INVALID');
  }
  if (String(req.body?.candidate_id || '') !== context.candidateId) {
    throw new Error('RELEASE5_CANDIDATE_BINDING_INVALID');
  }
  if (String(req.body?.profile_id || '').toUpperCase() !== context.profileId) {
    throw new Error('RELEASE5_PROFILE_BINDING_INVALID');
  }
  if (requireAssessment
      && (!context.assessmentId
        || String(req.body?.assessment_id || '').toLowerCase() !== context.assessmentId)) {
    throw new Error('RELEASE5_ASSESSMENT_BINDING_REQUIRED');
  }
}

async function phaseKeyAccounting(redis, beforeSnapshot, context, phase, allowedMutableClasses, {
  allowedRemovedClasses = new Set(),
} = {}) {
  const afterKeys = await scanKeySet(redis);
  const beforeKeys = new Set(beforeSnapshot.keys());
  const added = [...afterKeys].filter((key) => !beforeKeys.has(key));
  const removed = [...beforeKeys].filter((key) => !afterKeys.has(key));
  const invalidRemoved = removed.filter((key) => !allowedRemovedClasses.has(beforeSnapshot.get(key)?.classification));
  if (invalidRemoved.length) throw new Error('RELEASE5_OPERATION_KEY_DELETION_DETECTED');
  if (removed.length && (context.phase !== 'ba_ready'
      || removed.some((key) => beforeSnapshot.get(key)?.classification !== 'release5_recruiting_projection_retry'))) {
    throw new Error('RELEASE5_OPERATION_RETRY_RECEIPT_DELETION_INVALID');
  }
  const invalid = added.filter((key) => {
    const classification = keyClass(key, context);
    return !allowedMutableClasses.has(classification);
  });
  if (invalid.length) throw new Error('RELEASE5_OPERATION_KEY_SCOPE_INVALID');
  let changedProtected = 0;
  for (const [key, prior] of beforeSnapshot.entries()) {
    if (allowedMutableClasses.has(prior.classification)) continue;
    if (await redisKeyDigest(redis, key) !== prior.digest) changedProtected += 1;
  }
  if (changedProtected) throw new Error('RELEASE5_OPERATION_PROTECTED_VALUE_CHANGED');
  const inspection = await inspectKeys(redis, { expectedPhase: context.phase });
  if (!inspection.stable || inspection.unexpected !== 0) {
    throw new Error('RELEASE5_OPERATION_POST_INSPECTION_INVALID');
  }
  const actualAdded = added.length;
  return Object.freeze({
    phase,
    beforeTotal: beforeKeys.size,
    afterTotal: afterKeys.size,
    expectedAdded: actualAdded,
    actualAdded,
    removedCount: removed.length,
    authorizedRetryReceiptRemovalCount: removed.length,
    changedProtectedCount: 0,
    unexpectedKeyCount: 0,
    customerRelatedKeyCount: 0,
    valuesExposed: false,
  });
}

function createControllerNewBosService(redis, profileId) {
  const config = dynamicNewBosConfig(profileId);
  const resumableGenerationStore = createRedisNewBosResumableGenerationStore({
    redis,
    namespace: config.namespace,
  });
  const generator = createProductionNewBosGenerator({
    apiKey: process.env.OPENAI_API_KEY,
    repositoryRoot: process.cwd(),
    model: config.providerModel,
    reasoningTimeoutMs: CANARY_PROVIDER_TIMEOUT_MS,
    surfaceTimeoutMs: CANARY_PROVIDER_TIMEOUT_MS,
    maxNewSemanticUnits: 1,
    maxNewSurfaces: 4,
    resumableGenerationStore,
  });
  return createNewBosModernizationService({
    config,
    canonicalReader: createReadOnlyCanonicalReader({ redis }),
    realizationStore: createRedisNewBosRealizationStore({
      redis,
      namespace: config.namespace,
      persistenceEnabled: config.persistenceEnabled,
    }),
    singleFlight: createRedisNewBosSingleFlight({
      redis,
      namespace: config.namespace,
      lockTtlMs: CANARY_SINGLE_FLIGHT_LEASE_MS,
      waitTimeoutMs: CANARY_SINGLE_FLIGHT_WAIT_MS,
    }),
    generator,
    resumableGenerationStore,
    redisUrl: process.env.REDIS_URL,
  });
}

function createControllerNewBaService(redis, profileId) {
  const config = dynamicNewBaConfig(profileId);
  const authorityReader = createReadOnlyBaAuthorityReader({ redis, bosNamespace: config.bosNamespace });
  const realizationStore = createRedisNewBaRealizationStore({
    redis,
    namespace: config.namespace,
    persistenceEnabled: config.persistenceEnabled,
  });
  const backgroundResponseStore = createRedisNewBaBackgroundResponseStore({
    redis,
    namespace: config.namespace,
  });
  const campaign = createRealProfileNewBaGenerationCampaign({
    config,
    redis,
    authorityReader,
    realizationStore,
    backgroundResponseStore,
    apiKey: process.env.OPENAI_API_KEY,
    backgroundRequestTimeoutMs: CANARY_PROVIDER_TIMEOUT_MS,
  });
  return createNewBaModernizationService({
    config,
    authorityReader,
    realizationStore,
    singleFlight: createRedisNewBaSingleFlight({
      redis,
      namespace: config.namespace,
      leaseMs: CANARY_SINGLE_FLIGHT_LEASE_MS,
      waitTimeoutMs: CANARY_SINGLE_FLIGHT_WAIT_MS,
    }),
    generator: Object.freeze({ advance: ({ source }) => campaign.advance(source.profile_id) }),
  });
}

async function advanceNewBos(redis, req, res) {
  assertSyntheticConfirmation(req);
  const egress = assertProviderEgressIsolated();
  const context = await enrichStateContext(
    redis,
    release5StateContext(await readState(redis), { requireProfile: true }),
  );
  assertBoundedRequestIdentity(req, context);
  await assertInviteSessionExact(req, context);
  if (!context.bosJobId) throw new Error('RELEASE5_CANONICAL_BOS_JOB_REQUIRED');
  const canonical = parseObject(await redis.get(`vault:profile:${context.profileId.toLowerCase()}`));
  if (!canonical
      || String(canonical.profile_id || canonical.canonical_profile_json?.profile_id || '').toUpperCase() !== context.profileId
      || canonical.job_id !== context.bosJobId) {
    throw new Error('RELEASE5_CANONICAL_BOS_PROFILE_REQUIRED');
  }
  const before = await captureKeySnapshot(redis, context);
  const service = createControllerNewBosService(redis, context.profileId);
  const result = await service.retrieve({
    profileId: context.profileId,
    suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
  });
  let resumeVerified = false;
  if (!result?.pending && !result?.review_required && result?.receipt && result?.artifact) {
    const replay = await service.retrieve({
      profileId: context.profileId,
      suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
      readOnly: true,
    });
    resumeVerified = replay?.receipt?.realization_id === result.receipt.realization_id
      && replay?.receipt?.artifact_sha256 === result.receipt.artifact_sha256;
    if (!resumeVerified) throw new Error('RELEASE5_NEW_BOS_RESUME_VERIFICATION_FAILED');
  }
  let postContext = await enrichStateContext(redis, release5StateContext(await readState(redis), { requireProfile: true }));
  if (!result?.pending && !result?.review_required) postContext = await enrichAuthoredContext(redis, postContext);
  const keyAccounting = await phaseKeyAccounting(redis, before, postContext, 'ADVANCE_NEW_BOS', new Set([
    'release5_new_bos_pointer', 'release5_new_bos_artifact', 'release5_new_bos_checkpoint',
  ]));
  return json(res, result?.pending ? 202 : 200, {
    ...safeProductReceipt('NEW_BOS', result, context.profileId),
    sameInviteSession: true,
    canonicalStored: true,
    resumeVerified,
    keyAccounting,
    egress,
  });
}

async function advanceNewBa(redis, req, res) {
  assertSyntheticConfirmation(req);
  const egress = assertProviderEgressIsolated();
  const context = await enrichStateContext(redis, release5StateContext(await readState(redis), {
    requireProfile: true, requireAssessment: true,
  }));
  assertBoundedRequestIdentity(req, context, { requireAssessment: true });
  await assertInviteSessionExact(req, context);
  const before = await captureKeySnapshot(redis, context);
  const service = createControllerNewBaService(redis, context.profileId);
  const result = await service.retrieve({
    profileId: context.profileId,
    suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
  });
  let projection = Object.freeze({ projected: false, reason: 'CANONICAL_BA_NOT_COMPLETE' });
  let resumeVerified = false;
  if (!result?.pending && !result?.review_required && result?.artifact && result?.receipt) {
    projection = await reconcileRecruitingCanonicalBaReadySafely({ redis, result, env: process.env });
    if (projection.projected !== true) throw new Error('RELEASE5_NEW_BA_RECRUITING_PROJECTION_INCOMPLETE');
    const after = release5StateContext(await readState(redis), {
      expectedPhase: 'ba_ready',
      requireProfile: true,
      requireAssessment: true,
    });
    if (after.profileId !== context.profileId || after.assessmentId !== context.assessmentId) {
      throw new Error('RELEASE5_NEW_BA_POST_PROJECTION_SCOPE_MISMATCH');
    }
    const replay = await service.retrieve({
      profileId: context.profileId,
      suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
      readOnly: true,
    });
    resumeVerified = replay?.receipt?.realization_id === result.receipt.realization_id
      && replay?.receipt?.artifact_sha256 === result.receipt.artifact_sha256;
    if (!resumeVerified) throw new Error('RELEASE5_NEW_BA_RESUME_VERIFICATION_FAILED');
  }
  let postContext = await enrichStateContext(redis, release5StateContext(await readState(redis), {
    requireProfile: true, requireAssessment: true,
  }));
  if (!result?.pending && !result?.review_required) postContext = await enrichAuthoredContext(redis, postContext);
  const keyAccounting = await phaseKeyAccounting(redis, before, postContext, 'ADVANCE_NEW_BA', new Set([
    'release5_recruiting_state', 'release5_new_ba_pointer', 'release5_new_ba_artifact',
    'release5_new_ba_checkpoint', 'release5_new_ba_background', 'release5_new_ba_failure_ledger',
    'release5_recruiting_projection_retry',
  ]), {
    allowedRemovedClasses: new Set(['release5_recruiting_projection_retry']),
  });
  return json(res, result?.pending ? 202 : 200, {
    ...safeProductReceipt('NEW_BA', result, context.profileId),
    recruitingProjection: projection.projected === true ? 'PROJECTED' : 'NOT_COMPLETE',
    sameInviteSession: true,
    sameProfileVerified: true,
    canonicalStored: true,
    resumeVerified,
    keyAccounting,
    egress,
  });
}

async function inspectNotificationIsolation(redis, req, res) {
  const state = await readState(redis);
  const context = await enrichStateContext(redis, release5StateContext(state));
  if (!context.invitationId || context.phase === 'invitation_delivered') {
    throw new Error('RELEASE5_ACCEPTED_RECRUIT_REQUIRED');
  }
  if (String(req.query?.invitation_id || '') !== context.invitationId) {
    throw new Error('RELEASE5_INVITATION_BINDING_INVALID');
  }
  assertProviderEgressIsolated();
  const completionKinds = new Set(['MANAGER_BOS_READY', 'MANAGER_BA_INTELLIGENCE_READY']);
  const completion = Object.values(state.outbox || {}).filter((item) => completionKinds.has(item.kind));
  const standard = Object.values(state.memberships || {})
    .find((item) => item.manager_profile_id === STANDARD_PROFILE_ID);
  const expectedCount = context.phase === 'ba_ready' ? 2 : context.phase === 'bos_ready' ? 1 : 0;
  if (completion.length !== expectedCount || completion.some((item) =>
    item.membership_id !== standard?.membership_id
      || item.enterprise_id !== STANDARD_ENTERPRISE_ID
      || item.invitation_id !== context.invitationId
      || item.recipient !== approvedRecipients().standard
      || !['PENDING', 'SENDING', 'DELIVERED'].includes(item.state)
      || (item.state === 'DELIVERED' && !String(item.provider_receipt || '').startsWith('resend:')))) {
    throw new Error('RELEASE5_COMPLETION_OUTBOX_SCOPE_INVALID');
  }
  return json(res, 200, {
    ok: true,
    outboundContactSyncDisabled: true,
    completionDestinationCount: completion.length,
    completionDestinationsSynthetic: true,
    customerCompletionDestinationCount: 0,
    productionConnectionUsed: false,
    realCustomerReferenceCount: 0,
    valuesExposed: false,
  });
}

async function runBoundedNewBos(redis, req, res) {
  assertSyntheticConfirmation(req);
  if (req.body?.execution_mode !== 'EXACT_ONE_DYNAMIC_PROFILE') {
    throw new Error('RELEASE5_NEW_BOS_EXECUTION_MODE_INVALID');
  }
  assertProviderEgressIsolated();
  let context = await enrichStateContext(redis, release5StateContext(await readState(redis), { requireProfile: true }));
  assertBoundedRequestIdentity(req, context);
  await assertInviteSessionExact(req, context);
  if (!context.bosJobId) throw new Error('RELEASE5_CANONICAL_BOS_JOB_REQUIRED');
  const canonicalRaw = await redis.get(`vault:profile:${context.profileId.toLowerCase()}`);
  const canonical = parseObject(canonicalRaw);
  if (!canonical || String(canonical.profile_id || canonical.canonical_profile_json?.profile_id || '').toUpperCase() !== context.profileId) {
    throw new Error('RELEASE5_CANONICAL_BOS_PROFILE_REQUIRED');
  }
  const before = await captureKeySnapshot(redis, context);
  const service = createControllerNewBosService(redis, context.profileId);
  const result = await service.retrieve({
    profileId: context.profileId,
    suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
  });
  if (result?.review_required) throw new Error('RELEASE5_PRODUCT_REVIEW_REQUIRED');
  if (result?.pending) {
    const pendingContext = await enrichStateContext(
      redis,
      release5StateContext(await readState(redis), { requireProfile: true }),
    );
    const keyAccounting = await phaseKeyAccounting(
      redis,
      before,
      pendingContext,
      'ADVANCE_NEW_BOS',
      new Set(['release5_new_bos_checkpoint']),
    );
    return json(res, 202, {
      ...safeProductReceipt('NEW_BOS', result, context.profileId),
      sameInviteSession: true,
      canonicalStored: true,
      resumeVerified: false,
      keyAccounting,
    });
  }
  const replay = await service.retrieve({
    profileId: context.profileId,
    suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
    readOnly: true,
  });
  if (replay?.receipt?.realization_id !== result?.receipt?.realization_id
      || replay?.receipt?.artifact_sha256 !== result?.receipt?.artifact_sha256) {
    throw new Error('RELEASE5_NEW_BOS_RESUME_VERIFICATION_FAILED');
  }
  context = await enrichStateContext(redis, release5StateContext(await readState(redis), { requireProfile: true }));
  context = await enrichAuthoredContext(redis, context);
  const safe = safeProductReceipt('NEW_BOS', result, context.profileId);
  if (safe.state !== 'COMPLETE' || safe.completenessCount !== 15) {
    throw new Error('RELEASE5_NEW_BOS_NOT_COMPLETE');
  }
  return json(res, 200, {
    ok: true,
    operation: 'RUN_BOUNDED_NEW_BOS',
    invitationId: context.invitationId,
    candidateId: context.candidateId,
    profileId: context.profileId.toLowerCase(),
    bosJobId: context.bosJobId,
    complete: true,
    surfaceCount: safe.completenessCount,
    canonicalStored: true,
    recruitingProjectionUpdated: true,
    sameInviteSession: true,
    resumeVerified: true,
    keyAccounting: await phaseKeyAccounting(redis, before, context, 'AFTER_NEW_BOS', new Set([
      'release5_new_bos_pointer', 'release5_new_bos_artifact', 'release5_new_bos_checkpoint',
    ])),
    ...boundedTwoBoxEnvelope(),
  });
}

async function runBoundedNewBa(redis, req, res) {
  assertSyntheticConfirmation(req);
  if (req.body?.execution_mode !== 'EXACT_BOUND_PROFILE') {
    throw new Error('RELEASE5_NEW_BA_EXECUTION_MODE_INVALID');
  }
  assertProviderEgressIsolated();
  let context = await enrichStateContext(redis, release5StateContext(await readState(redis), {
    requireProfile: true,
    requireAssessment: true,
  }));
  assertBoundedRequestIdentity(req, context, { requireAssessment: true });
  await assertInviteSessionExact(req, context);
  const before = await captureKeySnapshot(redis, context);
  const service = createControllerNewBaService(redis, context.profileId);
  const result = await service.retrieve({
    profileId: context.profileId,
    suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
  });
  if (result?.review_required) throw new Error('RELEASE5_PRODUCT_REVIEW_REQUIRED');
  if (result?.pending) {
    const pendingContext = await enrichStateContext(
      redis,
      release5StateContext(await readState(redis), { requireProfile: true, requireAssessment: true }),
    );
    const keyAccounting = await phaseKeyAccounting(
      redis,
      before,
      pendingContext,
      'ADVANCE_NEW_BA',
      new Set(['release5_new_ba_checkpoint', 'release5_new_ba_background', 'release5_new_ba_failure_ledger']),
    );
    return json(res, 202, {
      ...safeProductReceipt('NEW_BA', result, context.profileId),
      recruitingProjection: 'NOT_COMPLETE',
      sameInviteSession: true,
      sameProfileVerified: true,
      canonicalStored: true,
      resumeVerified: false,
      keyAccounting,
    });
  }
  if (!result?.artifact || !result?.receipt) throw new Error('RELEASE5_NEW_BA_NOT_COMPLETE');
  const projection = await reconcileRecruitingCanonicalBaReadySafely({ redis, result, env: process.env });
  if (projection.projected !== true) throw new Error('RELEASE5_NEW_BA_RECRUITING_PROJECTION_INCOMPLETE');
  const replay = await service.retrieve({
    profileId: context.profileId,
    suppliedToken: process.env.RELEASE5_CANARY_CONTROLLER_SECRET,
    readOnly: true,
  });
  if (replay?.receipt?.realization_id !== result.receipt.realization_id
      || replay?.receipt?.artifact_sha256 !== result.receipt.artifact_sha256) {
    throw new Error('RELEASE5_NEW_BA_RESUME_VERIFICATION_FAILED');
  }
  context = await enrichStateContext(redis, release5StateContext(await readState(redis), {
    expectedPhase: 'ba_ready', requireProfile: true, requireAssessment: true,
  }));
  context = await enrichAuthoredContext(redis, context);
  const safe = safeProductReceipt('NEW_BA', result, context.profileId);
  if (safe.state !== 'COMPLETE' || safe.completeness !== 'PASS') {
    throw new Error('RELEASE5_NEW_BA_NOT_COMPLETE');
  }
  return json(res, 200, {
    ok: true,
    operation: 'RUN_BOUNDED_NEW_BA',
    invitationId: context.invitationId,
    candidateId: context.candidateId,
    profileId: context.profileId.toLowerCase(),
    assessmentId: context.assessmentId,
    realizationId: result.receipt.realization_id,
    complete: true,
    completenessPass: true,
    businessTwinComplete: true,
    canonicalStored: true,
    recruitingProjectionUpdated: true,
    sameProfileVerified: true,
    sameInviteSession: true,
    keyAccounting: await phaseKeyAccounting(redis, before, context, 'AFTER_NEW_BA', new Set([
      'release5_recruiting_state', 'release5_new_ba_pointer', 'release5_new_ba_artifact',
      'release5_new_ba_checkpoint', 'release5_new_ba_background', 'release5_new_ba_failure_ledger',
      'release5_recruiting_projection_retry',
    ]), { allowedRemovedClasses: new Set(['release5_recruiting_projection_retry']) }),
    ...boundedTwoBoxEnvelope(),
  });
}

async function inspectCandidateReadiness(redis, req, res) {
  let context = await enrichStateContext(redis, release5StateContext(await readState(redis), { requireProfile: true }));
  for (const [queryName, expected] of [
    ['invitation_id', context.invitationId],
    ['candidate_id', context.candidateId],
    ['profile_id', context.profileId.toLowerCase()],
  ]) {
    if (String(req.query?.[queryName] || '').toLowerCase() !== String(expected || '').toLowerCase()) {
      throw new Error('RELEASE5_READINESS_IDENTITY_SCOPE_INVALID');
    }
  }
  if (req.query?.assessment_id != null
      && String(req.query.assessment_id).toLowerCase() !== context.assessmentId) {
    throw new Error('RELEASE5_READINESS_ASSESSMENT_SCOPE_INVALID');
  }
  context = await enrichAuthoredContext(redis, context);
  const complete = context.phase === 'ba_ready';
  return json(res, 200, {
    ok: true,
    candidateId: context.candidateId,
    profileId: context.profileId.toLowerCase(),
    assessmentId: context.assessmentId,
    progressState: complete ? 'BOTH_COMPLETE' : 'BOS_COMPLETE',
    baReadiness: complete ? 'BA_INTELLIGENCE_READY' : context.baReadiness,
    consultingReady: complete,
    sameProfileVerified: true,
    valuesExposed: false,
    productionConnectionUsed: false,
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
  try {
    const redis = getRecruitingRedis(process.env);
    // Validate the literal durable envelope before any operation can enter a
    // store method that applies compatibility normalization.
    await readState(redis);
    const op = String(req.query?.op || '');
    if (op === 'inspect' && req.method === 'GET') {
      const inventory = await inspectKeys(redis, { expectedPhase: String(req.query?.phase || 'auto') });
      return json(res, inventory.stable && inventory.unexpected === 0 ? 200 : 409, {
        ok: inventory.stable && inventory.unexpected === 0,
        stable: inventory.stable,
        workflowPhase: inventory.phase,
        profileIdSha256: inventory.profileIdSha256,
        auditCount: inventory.auditCount,
        totalKeys: inventory.total,
        keyClasses: inventory.classes,
        classFingerprints: inventory.classFingerprints,
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
    if (op === 'reset-recruiting-after-browser-runtime-failure' && req.method === 'POST') {
      const result = await resetRecruitingAfterBrowserRuntimeFailure(redis, req);
      return json(res, 200, { ok: true, ...result, valuesExposed: false });
    }
    if (op === 'recover-synthetic-sessions' && req.method === 'POST') {
      return recoverSyntheticSessions(redis, req, res);
    }
    if (op === 'create-standard-manager' && req.method === 'POST') return createStandardManagerViaHttp(redis, req, res);
    if (op === 'create-recruit-invitation' && req.method === 'POST') return createRecruitInviteViaHttp(redis, req, res);
    if (op === 'consume-auth' && req.method === 'POST') return consumeDeliveredAuth(redis, req, res);
    if (op === 'advance-new-bos' && req.method === 'POST') return advanceNewBos(redis, req, res);
    if (op === 'advance-new-ba' && req.method === 'POST') return advanceNewBa(redis, req, res);
    if (op === 'inspect-notification-isolation' && req.method === 'GET') return inspectNotificationIsolation(redis, req, res);
    if (op === 'run-bounded-new-bos' && req.method === 'POST') return runBoundedNewBos(redis, req, res);
    if (op === 'run-bounded-new-ba' && req.method === 'POST') return runBoundedNewBa(redis, req, res);
    if (op === 'inspect-candidate-readiness' && req.method === 'GET') return inspectCandidateReadiness(redis, req, res);
    if (op === 'status' && req.method === 'GET') {
      const validated = await validatedSafeState(redis);
      return json(res, 200, {
        ok: true,
        ...validated.safe,
        workflowPhase: validated.context.phase,
        valuesExposed: false,
      });
    }
    return json(res, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    return json(res, 409, { ok: false, code: safeErrorCode(error) });
  }
}

function testRelease5AgreementMutationGuard(state, { profileId = null, assessmentId = null } = {}) {
  const closure = release5IdentityClosure(state, { profileId, assessmentId });
  assertRelease5PayloadIsolation(state, closure);
  return Object.freeze({
    sessionId: closure.agreementSessionId,
    agreementComplete: closure.agreementComplete,
  });
}

export {
  newBosCheckpointValueValid as __testNewBosCheckpointValueValid,
  testRelease5AgreementMutationGuard as __testRelease5AgreementMutationGuard,
};
