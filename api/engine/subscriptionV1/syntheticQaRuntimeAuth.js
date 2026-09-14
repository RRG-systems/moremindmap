import { deepFreeze } from '../../../src/lib/intelligenceFabric/validation.js';
import { scopeFingerprint } from '../../../src/lib/subscriptionV1/contracts.js';
import { normalizeProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';
import { normalizeGovernedAssessmentRecord } from '../newBaProductionReadinessV1/canonicalReader.js';
import {
  fullPersonQaCapabilityLookup,
  verifyFullPersonQaCapability,
} from './fullPersonQaAccess.js';
import {
  syntheticQaCapabilityStateKey,
  syntheticQaRuntimeRelationshipKey,
  syntheticQaScope,
} from './syntheticQaRuntimeInfrastructure.js';

export const SYNTHETIC_QA_AUTHORITY_SOURCE = 'SERVER_VERIFIED_EXACT_SYNTHETIC_PROFILE';

const ASSESSMENT_ID = /^ba-\d{8}-[a-f0-9]{8}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function rejected(code, failureClass, status) {
  return deepFreeze({ ok: false, code, status, failure_class: failureClass });
}

function parseRecord(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeNow(nowMs, now) {
  if (nowMs !== undefined) return Number(nowMs);
  if (now instanceof Date) return now.getTime();
  if (now !== undefined) return new Date(now).getTime();
  return Date.now();
}

function qaConfig(env) {
  return {
    manifest: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST,
    digest_key: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY,
    signing_key: env.MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY,
  };
}

export function syntheticQaRuntimeEnabled(env = globalThis.process?.env || {}) {
  return env.PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED === 'true';
}

/**
 * Resolve the exact governed BA binding for one synthetic Profile. The pointer
 * and record are both read twice so a concurrent replacement cannot silently
 * change the scope being authenticated.
 */
export async function readSyntheticQaAssessmentBinding({ redis, profile_id } = {}) {
  if (typeof redis?.get !== 'function') throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_STORE_REQUIRED');
  const profileId = normalizeProfileId(profile_id);
  if (!profileId) throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_INVALID');
  const pointerKey = `business_assessment_by_profile:${profileId}`;
  const firstPointer = await redis.get(pointerKey);
  if (!ASSESSMENT_ID.test(String(firstPointer || ''))) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ASSESSMENT_REQUIRED');
  }
  const assessmentKey = `business_assessment:${firstPointer}`;
  const firstRaw = await redis.get(assessmentKey);
  const firstRecord = parseRecord(firstRaw);
  if (!firstRecord) throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ASSESSMENT_REQUIRED');
  const evidence = normalizeGovernedAssessmentRecord(firstRecord, profileId.toUpperCase());
  if (evidence.assessment_id !== firstPointer
    || evidence.profile_id !== profileId.toUpperCase()
    || !SHA256.test(String(evidence.vertical_binding?.binding_sha256 || ''))) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ASSESSMENT_BINDING_INVALID');
  }
  const [secondPointer, secondRaw] = await Promise.all([
    redis.get(pointerKey),
    redis.get(assessmentKey),
  ]);
  if (secondPointer !== firstPointer || secondRaw !== firstRaw) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ASSESSMENT_CHANGED');
  }
  return deepFreeze({
    profile_id: profileId,
    assessment_id: firstPointer,
    vertical_binding_sha256: evidence.vertical_binding.binding_sha256,
    vertical_id: evidence.vertical_binding.vertical_id,
  });
}

export function syntheticQaAccessContext(auth) {
  const supplied = auth?.membership_context || auth?.capability?.membership_context;
  const scope = supplied?.scope || auth?.capability?.scope || auth?.scope;
  const authenticated = supplied?.authenticated
    ?? auth?.capability?.authenticated
    ?? auth?.authenticated;
  const capabilityVerified = supplied?.capability_verified
    ?? auth?.capability?.capability_verified
    ?? auth?.capability_verified;
  const membershipVerified = supplied?.membership_verified
    ?? auth?.capability?.membership_verified
    ?? auth?.membership_verified;
  const bindingSource = supplied?.binding_source || auth?.capability?.binding_source || auth?.binding_source;
  if (auth?.ok !== true
    || authenticated !== true
    || capabilityVerified !== true
    || membershipVerified !== false
    || bindingSource !== SYNTHETIC_QA_AUTHORITY_SOURCE
    || !scope
    || typeof scope !== 'object') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_ACCESS_CONTEXT_REQUIRED');
  }
  const scopeHash = scopeFingerprint(scope);
  return deepFreeze({
    ...supplied,
    authenticated: true,
    capability_verified: true,
    membership_verified: false,
    binding_source: bindingSource,
    scope,
    scope_hash: scopeHash,
    assessment_id: supplied?.assessment_id || auth?.capability?.assessment_id,
    authority_id: supplied?.authority_id || auth?.capability?.authority_id,
    manifest_version: supplied?.manifest_version || auth?.capability?.manifest_version,
    manifest_sha256: supplied?.manifest_sha256 || auth?.capability?.manifest_sha256,
    access_ends_at: supplied?.access_ends_at || auth?.capability?.authority_expires_at,
    synthetic_only: true,
    billing_evidence: false,
    stripe_subscription_created: false,
  });
}

export async function authenticateSyntheticQaRuntimeRequest({
  redis,
  req,
  env = globalThis.process?.env || {},
  now,
  nowMs,
} = {}) {
  if (!syntheticQaRuntimeEnabled(env)) {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_DEFAULT_OFF',
      'RUNTIME_DEFAULT_OFF',
      404,
    );
  }
  const currentTimeMs = normalizeNow(nowMs, now);
  if (!Number.isFinite(currentTimeMs)) {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_UNAVAILABLE',
      'CLOCK_UNAVAILABLE',
      503,
    );
  }
  const config = qaConfig(env);
  let lookup;
  try {
    lookup = fullPersonQaCapabilityLookup({ req, signing_key: config.signing_key });
  } catch {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_UNAVAILABLE',
      'CONFIGURATION_UNAVAILABLE',
      503,
    );
  }
  if (!lookup.ok) {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_REQUIRED',
      'CAPABILITY_COOKIE_MISSING_OR_INVALID',
      401,
    );
  }
  let rawReceipt;
  try {
    rawReceipt = await redis.get(syntheticQaCapabilityStateKey(lookup.capability_hash));
  } catch {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_UNAVAILABLE',
      'CAPABILITY_STORE_UNAVAILABLE',
      503,
    );
  }
  const verified = verifyFullPersonQaCapability({
    req,
    receipt: rawReceipt,
    manifest: config.manifest,
    digest_key: config.digest_key,
    signing_key: config.signing_key,
    now: new Date(currentTimeMs),
  });
  if (!verified.ok) {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_INVALID',
      'CAPABILITY_STATE_MISSING_INVALID_REVOKED_OR_EXPIRED',
      401,
    );
  }
  let assessment;
  try {
    assessment = await readSyntheticQaAssessmentBinding({
      redis,
      profile_id: verified.capability.profile_id,
    });
  } catch {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY',
      'GOVERNED_PROFILE_ASSESSMENT_OR_REALIZATION_UNAVAILABLE',
      409,
    );
  }
  const scope = syntheticQaScope({
    profile_id: assessment.profile_id,
    assessment_id: assessment.assessment_id,
    vertical_binding_sha256: assessment.vertical_binding_sha256,
    authority_id: verified.capability.authority_id,
  });
  const scopeHash = scopeFingerprint(scope);
  const membershipContext = deepFreeze({
    authenticated: true,
    capability_verified: true,
    membership_verified: false,
    binding_source: SYNTHETIC_QA_AUTHORITY_SOURCE,
    scope,
    scope_hash: scopeHash,
    assessment_id: assessment.assessment_id,
    authority_id: verified.capability.authority_id,
    manifest_version: verified.capability.manifest_version,
    manifest_sha256: verified.capability.manifest_sha256,
    access_ends_at: verified.capability.authority_expires_at,
    synthetic_only: true,
    billing_evidence: false,
    stripe_subscription_created: false,
  });
  const capability = deepFreeze({
    contract: 'subscription_v1_synthetic_qa_runtime_capability_v1',
    relationship_key: syntheticQaRuntimeRelationshipKey(scope),
    subject_key: scope.subject_id,
    authority_source: SYNTHETIC_QA_AUTHORITY_SOURCE,
    authenticated: true,
    capability_verified: true,
    membership_verified: false,
    binding_source: SYNTHETIC_QA_AUTHORITY_SOURCE,
    scope,
    scope_hash: scopeHash,
    assessment_id: assessment.assessment_id,
    authority_id: verified.capability.authority_id,
    manifest_version: verified.capability.manifest_version,
    manifest_sha256: verified.capability.manifest_sha256,
    expires_at: verified.capability.expires_at,
    authority_expires_at: verified.capability.authority_expires_at,
    synthetic_only: true,
    billing_evidence: false,
    stripe_subscription_created: false,
    membership_context: membershipContext,
  });
  return deepFreeze({
    ok: true,
    code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_AUTHENTICATED',
    capability,
    // Runtime CSRF/idempotency follows the signed opaque browser capability,
    // not an observational hash that changes when an unrelated manifest row
    // is edited.
    capability_hash: verified.capability_hash,
    scope,
    membership_context: membershipContext,
    authenticated: true,
    capability_verified: true,
    membership_verified: false,
    binding_source: SYNTHETIC_QA_AUTHORITY_SOURCE,
  });
}
