/* global process */

import { businessAssessmentByProfileKey, businessAssessmentKey, parseAssessmentId, parseProfileId } from '../../business-assessment/shared.js';
import { advanceMiniV2JobOnce } from '../miniV2JobAdvancer.js';
import { createNewBaProductionService } from '../newBaProductionReadinessV1/productionService.js';
import { normalizeGovernedAssessmentRecord } from '../newBaProductionReadinessV1/canonicalReader.js';
import { createNewBosProductionService } from '../newBosProductionReadinessV1/productionService.js';
import { readCurrentAuthoredSurfaces } from '../recruitingGuV1/authoredSurfaces.js';
import { RedisPublicStore } from '../../../src/lib/publicSiteAirlockV1/redisStore.js';
import {
  reconcileRecruitingBosReadyFromCompletedJob,
  reconcileRecruitingBosStartFromCommittedExecution,
  reconcileRecruitingCanonicalBaReadySafely,
} from './canonicalAdapters.js';
import { createConsultingPreparationCoordinator } from './consultingPreparation.js';
import { getRecruitingRedis } from './redisStore.js';
import { getRecruitingService } from './runtime.js';

export async function inspectGovernedBaIntake({ redis, profileId, relationshipRef, expectedAssessmentId = null }) {
  const normalizedProfile = parseProfileId(profileId)?.normalized;
  if (!normalizedProfile) throw new Error('RECRUITING_CONSULTING_BA_PROFILE_INVALID');
  const pointer = await redis.get(businessAssessmentByProfileKey(normalizedProfile));
  if (!pointer) {
    if (expectedAssessmentId) throw new Error('RECRUITING_CONSULTING_BA_IDENTITY_MISMATCH');
    return Object.freeze({ state: 'MISSING', assessment_id: null });
  }
  const normalizedAssessment = parseAssessmentId(pointer)?.normalized;
  if (!normalizedAssessment || (expectedAssessmentId && parseAssessmentId(expectedAssessmentId)?.normalized !== normalizedAssessment)) {
    throw new Error('RECRUITING_CONSULTING_BA_IDENTITY_MISMATCH');
  }
  const raw = await redis.get(businessAssessmentKey(normalizedAssessment));
  if (!raw) throw new Error('RECRUITING_CONSULTING_BA_POINTER_TARGET_INVALID');
  let record;
  try { record = JSON.parse(raw); } catch { throw new Error('RECRUITING_CONSULTING_BA_RECORD_INVALID'); }
  if (parseProfileId(record?.owner_profile_id)?.normalized !== normalizedProfile
      || parseAssessmentId(record?.assessment_id)?.normalized !== normalizedAssessment
      || String(record?.metadata?.recruiting_relationship_ref || '').trim() !== relationshipRef) {
    throw new Error('RECRUITING_CONSULTING_BA_RELATIONSHIP_MISMATCH');
  }
  try {
    normalizeGovernedAssessmentRecord(record, normalizedProfile.toUpperCase());
  } catch (error) {
    if (String(error?.message || '').startsWith('new_ba_business_evidence_insufficient:')) {
      return Object.freeze({ state: 'MISSING', assessment_id: normalizedAssessment });
    }
    throw error;
  }
  const pointerKey = businessAssessmentByProfileKey(normalizedProfile);
  const assessmentKey = businessAssessmentKey(normalizedAssessment);
  const guards = Object.freeze([
    Object.freeze({ key: pointerKey, expected: pointer }),
    Object.freeze({ key: assessmentKey, expected: raw }),
  ]);
  return Object.freeze({
    state: 'READY',
    assessment_id: normalizedAssessment,
    canonical_source_guard: Object.freeze({
      guards,
      async assertCurrent() {
        const current = await Promise.all(guards.map((guard) => redis.get(guard.key)));
        if (guards.some((guard, index) => current[index] !== guard.expected)) {
          throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED');
        }
      },
    }),
  });
}

let cached;

export function getConsultingPreparationCoordinator(env = process.env) {
  if (cached) return cached;
  const redis = getRecruitingRedis(env);
  const service = getRecruitingService(env);
  let newBosService;
  let newBaService;
  cached = createConsultingPreparationCoordinator({
    service,
    redis,
    executionStore: new RedisPublicStore(redis),
    env,
    readAuthoredSurfaces: ({ profileId }) => readCurrentAuthoredSurfaces({ redis, profileId, env }),
    reconcileBosStart: reconcileRecruitingBosStartFromCommittedExecution,
    advanceBosJob: advanceMiniV2JobOnce,
    reconcileBosReady: reconcileRecruitingBosReadyFromCompletedJob,
    inspectBaIntake: inspectGovernedBaIntake,
    createNewBosService: async () => {
      newBosService ||= createNewBosProductionService({ redis, env });
      return newBosService;
    },
    createNewBaService: async () => {
      newBaService ||= createNewBaProductionService({ redis, env });
      return newBaService;
    },
    reconcileBaReady: reconcileRecruitingCanonicalBaReadySafely,
    newBosAccessToken: env.NEW_BOS_CUSTOMER_ACTIVE === 'true' ? '' : env.NEW_BOS_CANARY_ACCESS_TOKEN,
    newBaAccessToken: env.NEW_BA_CUSTOMER_ACTIVE === 'true' ? '' : env.NEW_BA_CANARY_ACCESS_TOKEN,
  });
  return cached;
}

export function resetConsultingPreparationCoordinatorForTest() {
  cached = null;
}
