import { Buffer } from 'node:buffer';

import { deepFreeze } from '../../../src/lib/intelligenceFabric/validation.js';
import { scopeFingerprint } from '../../../src/lib/subscriptionV1/contracts.js';
import { normalizeProfileId } from '../../../src/lib/publicSiteAirlockV1/contracts.js';
import { normalizeGovernedAssessmentRecord } from '../newBaProductionReadinessV1/canonicalReader.js';
import { classifyNewBaCompatibility } from '../newBaProductionReadinessV1/compatibility.js';
import { projectBosFusionAuthorityFromArtifact } from '../newBaProductionReadinessV1/fusionContract.js';
import { createScopedLoanOriginatorGenerationContext } from '../newBaProductionReadinessV1/scopedLoanOriginatorGeneration.js';
import { adaptCanonicalProfileToNewBosRawEvidence } from '../newBosProductionReadinessV1/canonicalAdapter.js';
import { classifyNewBosCompatibility } from '../newBosProductionReadinessV1/compatibility.js';
import {
  fullPersonQaAssessmentDigest,
  fullPersonQaBaRealizationIdDigest,
  fullPersonQaBosRealizationIdDigest,
  fullPersonQaCapabilityLookup,
  fullPersonQaCustodySha256,
  fullPersonQaSyntheticProvenanceSha256,
  fullPersonQaVerticalAuthoritySha256,
  verifyFullPersonQaCapability,
} from './fullPersonQaAccess.js';
import { readNewBaProductionConfig } from '../newBaProductionReadinessV1/config.js';
import {
  buildNewBaRealizationIdentityV3,
  NEW_BA_REALIZATION_IDENTITY_VERSION_V3,
} from '../newBaProductionReadinessV1/realizationIdentity.js';
import { sha256Stable } from '../newBaProductionReadinessV1/stable.js';
import {
  buildNewBosRealizationIdentity,
  NEW_BOS_REALIZATION_IDENTITY_VERSION,
} from '../newBosProductionReadinessV1/realizationIdentity.js';
import {
  PAID_SUBSCRIBER_COMPLETENESS_POLICY,
  validatePaidSubscriberRuntimeCustody,
} from './paidSubscriberCustody.js';
import {
  syntheticQaCapabilityStateKey,
  syntheticQaRuntimeRelationshipKey,
  syntheticQaScope,
} from './syntheticQaRuntimeInfrastructure.js';

export const SYNTHETIC_QA_AUTHORITY_SOURCE = 'SERVER_VERIFIED_EXACT_SYNTHETIC_PROFILE';

const ASSESSMENT_ID = /^ba-\d{8}-[a-f0-9]{8}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_PROFILE_BYTES = 8 * 1024 * 1024;
const MAX_ASSESSMENT_BYTES = 1024 * 1024;
const MAX_REALIZATION_BYTES = 16 * 1024 * 1024;
const SYNTHETIC_BA_NAMESPACE = /^preview:new-ba:synthetic-full-person-qa-v\d+$/u;
const SYNTHETIC_BOS_NAMESPACE = /^preview:new-bos:synthetic-full-person-qa-v\d+$/u;
const privateCustodySnapshots = new WeakMap();
let scopedLoanOriginatorContext;

function assessmentAuthorityForVertical(verticalId) {
  if (verticalId === 'real_estate') return Object.freeze({});
  if (verticalId !== 'loan_originator') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_VERTICAL_UNSUPPORTED');
  }
  scopedLoanOriginatorContext ||= createScopedLoanOriginatorGenerationContext();
  return Object.freeze({
    cassetteRegistry: scopedLoanOriginatorContext.cassetteRegistry,
    generationContext: scopedLoanOriginatorContext.generationContext,
  });
}

function normalizeSyntheticQaAssessment(record, profileId, expectedVerticalId) {
  const evidence = normalizeGovernedAssessmentRecord(
    record,
    profileId,
    assessmentAuthorityForVertical(expectedVerticalId),
  );
  if (evidence.vertical_binding?.vertical_id !== expectedVerticalId) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_VERTICAL_MISMATCH');
  }
  return evidence;
}

function rejected(code, failureClass, status) {
  return deepFreeze({ ok: false, code, status, failure_class: failureClass });
}

function parseRecord(raw, maxBytes = MAX_ASSESSMENT_BYTES) {
  if (typeof raw !== 'string' || !raw || Buffer.byteLength(raw, 'utf8') > maxBytes) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function exactProfileOwner(record, profileId) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  const canonical = record.canonical_profile_json
    || record.canonical_dossier?.canonical_profile_json
    || record.canonical_dossier?.canonical_dossier?.canonical_profile_json
    || null;
  const identifiers = [
    record.profile_id,
    record.canonical_dossier?.profile_id,
    record.canonical_dossier?.canonical_dossier?.profile_id,
    canonical?.profile_id,
    canonical?.metadata?.profile_id,
  ].filter((value) => value !== undefined && value !== null && String(value).trim());
  return identifiers.length > 0
    && identifiers.every((value) => normalizeProfileId(value) === profileId);
}

function isCanonicalTimestamp(value) {
  return typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function syntheticRecordProvenanceSha256(records, expected) {
  if (!Array.isArray(records) || records.length !== 4) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_RECORD_PROVENANCE_REQUIRED');
  }
  let hashes;
  try {
    hashes = records.map((record) => fullPersonQaSyntheticProvenanceSha256(
      record?.synthetic_qa_provenance,
    ));
  } catch {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_RECORD_PROVENANCE_REQUIRED');
  }
  if (!SHA256.test(String(expected?.synthetic_provenance_sha256 || ''))
    || new Set(hashes).size !== 1
    || hashes[0] !== expected.synthetic_provenance_sha256
    || records.some((record) => record.synthetic_qa_provenance.authority_id !== expected.authority_id
      || record.synthetic_qa_provenance.case_id !== expected.case_id)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_RECORD_PROVENANCE_REQUIRED');
  }
  return hashes[0];
}

function snapshotFor(value) {
  if (!value || typeof value !== 'object') return null;
  return privateCustodySnapshots.get(value)
    || privateCustodySnapshots.get(value.membership_context)
    || privateCustodySnapshots.get(value.capability)
    || null;
}

function retainSnapshot(value, snapshot) {
  if (value && typeof value === 'object') privateCustodySnapshots.set(value, snapshot);
  return value;
}

/**
 * Private request-local access for the already validated Profile/BOS/BA
 * snapshot. The snapshot is held in a WeakMap rather than on enumerable auth
 * data so response projection and diagnostic serialization cannot expose it.
 */
export function syntheticQaRuntimeCustodySnapshot(value) {
  return snapshotFor(value);
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
export async function readSyntheticQaAssessmentBinding({ redis, profile_id, expected_vertical_id } = {}) {
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
  const evidence = normalizeSyntheticQaAssessment(
    firstRecord,
    profileId.toUpperCase(),
    expected_vertical_id,
  );
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

/**
 * Capture and validate every immutable source needed to authorize one exact
 * synthetic person. Every pointer and serialized artifact is read again before
 * validation, and the accepted parsed values are detached from Redis in one
 * deeply frozen request-local snapshot.
 */
export async function readSyntheticQaRuntimeCustodySnapshot({
  redis,
  profile_id,
  expected,
  digest_key,
  env = globalThis.process?.env || {},
} = {}) {
  if (typeof redis?.get !== 'function') throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_STORE_REQUIRED');
  const profileId = normalizeProfileId(profile_id);
  if (!profileId || !expected || typeof expected !== 'object') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_EXPECTATION_REQUIRED');
  }
  const realizationConfig = readNewBaProductionConfig(env);
  if (!SYNTHETIC_BA_NAMESPACE.test(realizationConfig.namespace)
    || !SYNTHETIC_BOS_NAMESPACE.test(realizationConfig.bosNamespace)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_NAMESPACE_INVALID');
  }
  const realizationProfileId = profileId.toUpperCase();
  const profileKey = `vault:profile:${profileId}`;
  const legacyProfileKey = `vault:profile:${profileId.replace(/^mm-/u, 'MM-')}`;
  const assessmentPointerKey = `business_assessment_by_profile:${profileId}`;
  const baPointerKey = `${realizationConfig.namespace}:latest-compatible:${realizationProfileId}`;

  const [firstProfileRaw, firstLegacyProfileRaw, firstAssessmentPointer, firstBaPointer] = await Promise.all([
    redis.get(profileKey),
    redis.get(legacyProfileKey),
    redis.get(assessmentPointerKey),
    redis.get(baPointerKey),
  ]);
  if (!firstProfileRaw
    || firstLegacyProfileRaw != null
    || !ASSESSMENT_ID.test(String(firstAssessmentPointer || ''))
    || typeof firstBaPointer !== 'string') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_POINTER_REQUIRED');
  }
  const expectedBaPrefix = `new-ba:${realizationProfileId}:${firstAssessmentPointer}:`;
  const baIdentitySha256 = firstBaPointer.slice(expectedBaPrefix.length);
  if (!firstBaPointer.startsWith(expectedBaPrefix)
    || firstBaPointer.length !== expectedBaPrefix.length + 64
    || !SHA256.test(baIdentitySha256)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_POINTER_REQUIRED');
  }
  const assessmentKey = `business_assessment:${firstAssessmentPointer}`;
  const baArtifactKey = `${realizationConfig.namespace}:artifact:${realizationProfileId}:${firstBaPointer}`;
  const [firstAssessmentRaw, firstBaRaw] = await Promise.all([
    redis.get(assessmentKey),
    redis.get(baArtifactKey),
  ]);
  const preliminaryBa = parseRecord(firstBaRaw, MAX_REALIZATION_BYTES);
  const recordedBosRealizationId = preliminaryBa?.artifact?.fusion?.bos_authority?.realization_id;
  const expectedBosPrefix = `new-bos:${realizationProfileId}:`;
  const bosIdentitySha256 = typeof recordedBosRealizationId === 'string'
    ? recordedBosRealizationId.slice(expectedBosPrefix.length)
    : '';
  if (typeof recordedBosRealizationId !== 'string'
    || !recordedBosRealizationId.startsWith(expectedBosPrefix)
    || recordedBosRealizationId.length !== expectedBosPrefix.length + 64
    || !SHA256.test(bosIdentitySha256)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_RECORDED_BOS_REQUIRED');
  }
  const bosArtifactKey = `${realizationConfig.bosNamespace}:artifact:${realizationProfileId}:${recordedBosRealizationId}`;
  const firstBosRaw = await redis.get(bosArtifactKey);

  const [
    secondProfileRaw,
    secondLegacyProfileRaw,
    secondAssessmentPointer,
    secondAssessmentRaw,
    secondBaPointer,
    secondBaRaw,
    secondBosRaw,
  ] = await Promise.all([
    redis.get(profileKey),
    redis.get(legacyProfileKey),
    redis.get(assessmentPointerKey),
    redis.get(assessmentKey),
    redis.get(baPointerKey),
    redis.get(baArtifactKey),
    redis.get(bosArtifactKey),
  ]);
  if (secondProfileRaw !== firstProfileRaw
    || secondLegacyProfileRaw !== firstLegacyProfileRaw
    || secondAssessmentPointer !== firstAssessmentPointer
    || secondAssessmentRaw !== firstAssessmentRaw
    || secondBaPointer !== firstBaPointer
    || secondBaRaw !== firstBaRaw
    || secondBosRaw !== firstBosRaw) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_CHANGED');
  }

  const profileRecord = parseRecord(firstProfileRaw, MAX_PROFILE_BYTES);
  const assessmentRecord = parseRecord(firstAssessmentRaw, MAX_ASSESSMENT_BYTES);
  const baRealizationRecord = preliminaryBa;
  const bosRealizationRecord = parseRecord(firstBosRaw, MAX_REALIZATION_BYTES);
  if (!profileRecord || !assessmentRecord || !baRealizationRecord || !bosRealizationRecord
    || !exactProfileOwner(profileRecord, profileId)) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_INVALID');
  }
  const syntheticProvenanceSha256 = syntheticRecordProvenanceSha256([
    profileRecord,
    assessmentRecord,
    bosRealizationRecord,
    baRealizationRecord,
  ], expected);

  const assessment = normalizeSyntheticQaAssessment(
    assessmentRecord,
    realizationProfileId,
    expected.vertical_id,
  );
  const adaptedBosRawEvidence = adaptCanonicalProfileToNewBosRawEvidence({
    envelope: profileRecord,
    expectedProfileId: realizationProfileId,
  });
  const recomputedBosSourceSha256 = adaptedBosRawEvidence.generation_metadata.canonical_source_sha256;
  const recomputedBosCompatibility = classifyNewBosCompatibility(adaptedBosRawEvidence);
  const expectedBosIdentity = buildNewBosRealizationIdentity({
    profileId: realizationProfileId,
    canonicalSourceSha256: recomputedBosSourceSha256,
    rawEvidenceVersion: adaptedBosRawEvidence.version,
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: recomputedBosCompatibility.class,
  });
  const projectedBosAuthority = projectBosFusionAuthorityFromArtifact({
    artifact: bosRealizationRecord.artifact,
    profileId: realizationProfileId,
    realizationId: recordedBosRealizationId,
    artifactSha256: bosRealizationRecord.artifact_sha256,
    realizationVersion: bosRealizationRecord.realization_identity?.version,
  });
  const recomputedBaCompatibility = classifyNewBaCompatibility({
    profile_id: realizationProfileId,
    assessment_id: assessment.assessment_id,
    business_evidence: assessment,
    bos_authority: {
      compatible: ['A', 'B'].includes(recomputedBosCompatibility.class),
      sha256: bosRealizationRecord.artifact_sha256,
      fusion_authority: projectedBosAuthority,
      fusion_contract_sha256: projectedBosAuthority.contract_sha256,
      evidence_boundary_sha256: projectedBosAuthority.evidence_boundary_sha256,
    },
  });
  const expectedBaIdentity = buildNewBaRealizationIdentityV3({
    profileId: realizationProfileId,
    assessmentId: assessment.assessment_id,
    evidenceSha256: assessment.evidence_sha256,
    bosAuthoritySha256: bosRealizationRecord.artifact_sha256,
    bosFusionContractSha256: projectedBosAuthority.contract_sha256,
    bosEvidenceBoundarySha256: projectedBosAuthority.evidence_boundary_sha256,
    compatibilityClass: recomputedBaCompatibility.class,
    verticalBinding: assessment.vertical_binding,
  });
  const runtimeCustody = validatePaidSubscriberRuntimeCustody({
    profile_id: profileId,
    assessment_id: assessment.assessment_id,
    realization_record: baRealizationRecord,
    bos_realization_record: bosRealizationRecord,
    completeness_policy: expected.vertical_id === 'loan_originator'
      ? PAID_SUBSCRIBER_COMPLETENESS_POLICY.SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN
      : PAID_SUBSCRIBER_COMPLETENESS_POLICY.COMPLETE_ONLY,
  });
  const baIdentity = baRealizationRecord.realization_identity;
  const bosIdentity = bosRealizationRecord.realization_identity;
  const actual = {
    assessment_digest: fullPersonQaAssessmentDigest(assessment.assessment_id, digest_key),
    vertical_id: assessment.vertical_binding.vertical_id,
    vertical_authority_sha256: fullPersonQaVerticalAuthoritySha256(assessment.vertical_binding),
    vertical_binding_sha256: assessment.vertical_binding.binding_sha256,
    canonical_profile_artifact_sha256: sha256Stable(profileRecord),
    synthetic_provenance_sha256: syntheticProvenanceSha256,
    bos_canonical_source_sha256: bosRealizationRecord.canonical_source_sha256,
    assessment_evidence_sha256: assessment.evidence_sha256,
    ba_realization_id_digest: fullPersonQaBaRealizationIdDigest(firstBaPointer, digest_key),
    ba_realization_identity_sha256: baIdentity?.sha256,
    ba_artifact_sha256: baRealizationRecord.artifact_sha256,
    ba_envelope_sha256: sha256Stable(baRealizationRecord),
    bos_realization_id_digest: fullPersonQaBosRealizationIdDigest(recordedBosRealizationId, digest_key),
    bos_realization_identity_sha256: bosIdentity?.sha256,
    bos_artifact_sha256: bosRealizationRecord.artifact_sha256,
    bos_envelope_sha256: sha256Stable(bosRealizationRecord),
  };
  const expectedFields = Object.keys(actual);
  if (expectedFields.some((field) => actual[field] !== expected[field])
    || !SHA256.test(String(baIdentity?.sha256 || ''))
    || baIdentity.version !== NEW_BA_REALIZATION_IDENTITY_VERSION_V3
    || sha256Stable(baIdentity) !== sha256Stable(expectedBaIdentity)
    || baIdentity.sha256 !== sha256Stable(baIdentity.components)
    || baIdentitySha256 !== baIdentity.sha256
    || baIdentity.realization_id !== firstBaPointer
    || baRealizationRecord.realization_id !== firstBaPointer
    || baIdentity.components?.profile_id !== realizationProfileId
    || baIdentity.components?.assessment_id !== assessment.assessment_id
    || baIdentity.components?.canonical_business_evidence_sha256 !== assessment.evidence_sha256
    || baIdentity.components?.vertical_binding_sha256 !== assessment.vertical_binding.binding_sha256
    || baRealizationRecord.artifact?.lineage?.business_evidence_sha256 !== assessment.evidence_sha256
    || baRealizationRecord.artifact?.lineage?.vertical_binding_sha256 !== assessment.vertical_binding.binding_sha256
    || !isCanonicalTimestamp(baRealizationRecord.created_at)
    || baRealizationRecord.compatibility?.class !== recomputedBaCompatibility.class
    || baRealizationRecord.compatibility?.label !== recomputedBaCompatibility.label
    || !SHA256.test(String(bosIdentity?.sha256 || ''))
    || bosIdentity.version !== NEW_BOS_REALIZATION_IDENTITY_VERSION
    || sha256Stable(bosIdentity) !== sha256Stable(expectedBosIdentity)
    || bosIdentity.sha256 !== sha256Stable(bosIdentity.components)
    || bosIdentitySha256 !== bosIdentity.sha256
    || bosIdentity.realization_id !== recordedBosRealizationId
    || bosRealizationRecord.realization_id !== recordedBosRealizationId
    || bosIdentity.components?.profile_id !== realizationProfileId
    || bosIdentity.components?.canonical_evidence_sha256 !== actual.bos_canonical_source_sha256
    || bosIdentity.components?.canonical_evidence_version !== adaptedBosRawEvidence.version
    || recomputedBosSourceSha256 !== actual.bos_canonical_source_sha256
    || sha256Stable(bosRealizationRecord.artifact?.raw_evidence) !== sha256Stable(adaptedBosRawEvidence)
    || !isCanonicalTimestamp(bosRealizationRecord.created_at)
    || bosRealizationRecord.compatibility?.class !== recomputedBosCompatibility.class
    || bosRealizationRecord.compatibility?.label !== recomputedBosCompatibility.label
    || runtimeCustody.profile_id !== realizationProfileId
    || runtimeCustody.assessment_id !== assessment.assessment_id
    || runtimeCustody.realization_id !== firstBaPointer
    || runtimeCustody.artifact_sha256 !== actual.ba_artifact_sha256
    || runtimeCustody.vertical_binding_sha256 !== actual.vertical_binding_sha256
    || runtimeCustody.bos_realization_id !== recordedBosRealizationId
    || runtimeCustody.bos_artifact_sha256 !== actual.bos_artifact_sha256
    || runtimeCustody.bos_custody_source !== 'EXACT_RECORDED_LAUNCH_SAFE_BOS_REALIZATION') {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_INVALID');
  }
  const custodySha256 = fullPersonQaCustodySha256({
    authority_id: expected.authority_id,
    case_id: expected.case_id,
    profile_digest: expected.profile_digest,
    ...actual,
    expires_at: expected.authority_expires_at,
    status: 'active',
  });
  if (custodySha256 !== expected.custody_sha256) {
    throw new Error('SUBSCRIPTION_V1_SYNTHETIC_QA_CUSTODY_INVALID');
  }

  return deepFreeze({
    contract: 'subscription_v1_synthetic_qa_runtime_custody_snapshot_v1',
    profile_id: profileId,
    assessment_id: assessment.assessment_id,
    profile_lookup: {
      found: true,
      profile_id: profileId,
      key: profileKey,
      dossier: profileRecord,
    },
    assessment_record: assessmentRecord,
    assessment,
    realization_record: baRealizationRecord,
    bos_realization_record: bosRealizationRecord,
    runtime_custody: runtimeCustody,
    manifest_custody: {
      authority_id: expected.authority_id,
      case_id: expected.case_id,
      profile_digest: expected.profile_digest,
      ...actual,
      custody_sha256: custodySha256,
      expires_at: expected.authority_expires_at,
    },
    source_keys: {
      profile: profileKey,
      profile_legacy_alias: legacyProfileKey,
      assessment_pointer: assessmentPointerKey,
      assessment: assessmentKey,
      ba_pointer: baPointerKey,
      ba_artifact: baArtifactKey,
      bos_artifact: bosArtifactKey,
    },
    byte_stable_across_reads: true,
    read_only: true,
    mutation_performed: false,
  });
}

export function syntheticQaAccessContext(auth) {
  const supplied = auth?.membership_context || auth?.capability?.membership_context;
  const custodySnapshot = snapshotFor(auth) || snapshotFor(supplied) || snapshotFor(auth?.capability);
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
  const context = deepFreeze({
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
  if (custodySnapshot) retainSnapshot(context, custodySnapshot);
  return context;
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
  let custodySnapshot;
  try {
    custodySnapshot = await readSyntheticQaRuntimeCustodySnapshot({
      redis,
      profile_id: verified.capability.profile_id,
      expected: verified.capability,
      digest_key: config.digest_key,
      env,
    });
  } catch {
    return rejected(
      'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY',
      'GOVERNED_PROFILE_ASSESSMENT_OR_REALIZATION_UNAVAILABLE',
      409,
    );
  }
  const scope = syntheticQaScope({
    profile_id: custodySnapshot.profile_id,
    assessment_id: custodySnapshot.assessment_id,
    vertical_binding_sha256: custodySnapshot.manifest_custody.vertical_binding_sha256,
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
    assessment_id: custodySnapshot.assessment_id,
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
    assessment_id: custodySnapshot.assessment_id,
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
  const authenticated = deepFreeze({
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
  for (const value of [req, membershipContext, capability, authenticated]) {
    retainSnapshot(value, custodySnapshot);
  }
  return authenticated;
}
