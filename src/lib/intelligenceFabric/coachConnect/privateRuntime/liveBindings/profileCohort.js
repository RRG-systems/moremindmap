import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  exactPrivateRuntimeScope,
  hashPrivateRuntimeScope,
  isOpaquePrivateRuntimeReference,
} from '../contracts.js';
import {
  privateRuntimeProductBindingDigest,
  validatePrivateRuntimeProductBindingAttestationV1,
} from './contracts.js';
import {
  privateLiveProductExecutionBindingDigest,
  validatePrivateLiveProductExecutionBindingV1,
} from './productExecutionBinding.js';

export const PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_VERSION =
  'private-runtime-approved-profile-cohort-v1';
export const PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_REFERENCE_VARIABLE =
  'MORE_PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_REF';
export const PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_PURPOSE =
  'SUBSCRIPTION_PRIVATE_BETA_OPERATOR_ACCESS';
export const PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_SIZE = 4;

const COHORT_FIELDS = Object.freeze([
  'cohort_version',
  'environment_id',
  'cohort_id',
  'cohort_revision',
  'operating_mode',
  'source_default_off',
  'public_access',
  'revoked',
  'member_count',
  'members',
  'issued_at',
  'expires_at',
  'cohort_sha256',
]);
const MEMBER_FIELDS = Object.freeze([
  'profile_id',
  'subscriber_subject_ref',
  'exact_scope',
  'exact_scope_hash',
  'business_engine_execution_contract_sha256',
  'approval_ref',
  'approval_status',
  'approval_purpose',
  'revoked',
  'member_sha256',
]);

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const profileId = (value) => typeof value === 'string'
  && /^mm-\d{8}-[a-z0-9]{8}$/.test(value);
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const issue = (code, field) => Object.freeze({ code, field });
const frozen = (value) => deepFreeze(structuredClone(value));
const result = (errors, value = null) => frozen({
  valid: errors.length === 0,
  errors,
  value: errors.length === 0 ? value : null,
});

function digestWithout(value, field) {
  const copy = { ...value };
  delete copy[field];
  return hashCanonicalJson(copy);
}

export function privateRuntimeApprovedProfileCohortMemberDigest(value) {
  if (!object(value)) throw new TypeError('cohort member required');
  return digestWithout(value, 'member_sha256');
}

export function privateRuntimeApprovedProfileCohortDigest(value) {
  if (!object(value)) throw new TypeError('profile cohort required');
  return digestWithout(value, 'cohort_sha256');
}

export function createPrivateRuntimeApprovedProfileCohortV1({
  environmentId,
  cohortId,
  cohortRevision,
  members,
  issuedAt,
  expiresAt,
} = {}) {
  const normalizedMembers = Array.isArray(members)
    ? members.map((member) => {
        const normalized = {
          profile_id: member.profile_id,
          subscriber_subject_ref: member.subscriber_subject_ref,
          exact_scope: structuredClone(member.exact_scope),
          exact_scope_hash: hashPrivateRuntimeScope(member.exact_scope),
          business_engine_execution_contract_sha256:
            member.business_engine_execution_contract_sha256,
          approval_ref: member.approval_ref,
          approval_status: 'ACTIVE',
          approval_purpose: PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_PURPOSE,
          revoked: false,
        };
        normalized.member_sha256 =
          privateRuntimeApprovedProfileCohortMemberDigest(normalized);
        return normalized;
      })
    : [];
  const cohort = {
    cohort_version: PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_VERSION,
    environment_id: environmentId,
    cohort_id: cohortId,
    cohort_revision: cohortRevision,
    operating_mode: 'CONTROLLED_INTERNAL_BETA',
    source_default_off: true,
    public_access: false,
    revoked: false,
    member_count: normalizedMembers.length,
    members: normalizedMembers,
    issued_at: issuedAt,
    expires_at: expiresAt,
  };
  cohort.cohort_sha256 = privateRuntimeApprovedProfileCohortDigest(cohort);
  const validation = validatePrivateRuntimeApprovedProfileCohortV1(cohort, {
    environmentId,
    expectedCount: PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_SIZE,
    nowMs: Date.parse(issuedAt),
  });
  if (!validation.valid) {
    throw new TypeError(validation.errors[0]?.code || 'APPROVED_PROFILE_COHORT_INVALID');
  }
  return validation.value;
}

export function validatePrivateRuntimeApprovedProfileCohortV1(value, {
  environmentId = null,
  expectedCount = PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_SIZE,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(value, COHORT_FIELDS)) {
    return result([issue('APPROVED_PROFILE_COHORT_INVALID', 'fields')]);
  }
  if (value.cohort_version !== PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_VERSION
    || value.operating_mode !== 'CONTROLLED_INTERNAL_BETA'
    || value.source_default_off !== true
    || value.public_access !== false
    || value.revoked !== false) {
    errors.push(issue('APPROVED_PROFILE_COHORT_INVALID', 'mode'));
  }
  if (!isOpaquePrivateRuntimeReference(value.environment_id)
    || (environmentId != null && value.environment_id !== environmentId)
    || !isOpaquePrivateRuntimeReference(value.cohort_id)
    || !isOpaquePrivateRuntimeReference(value.cohort_revision)) {
    errors.push(issue('APPROVED_PROFILE_COHORT_MISMATCH', 'identity'));
  }
  if (!Array.isArray(value.members)
    || value.members.length !== PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_SIZE
    || value.member_count !== value.members.length
    || expectedCount !== PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_SIZE
    || value.member_count !== expectedCount) {
    errors.push(issue('APPROVED_PROFILE_COHORT_INVALID', 'members'));
  }

  const ids = new Set();
  const subjects = new Set();
  const scopes = new Set();
  for (const member of Array.isArray(value.members) ? value.members : []) {
    if (!exactFields(member, MEMBER_FIELDS)) {
      errors.push(issue('APPROVED_PROFILE_COHORT_MEMBER_INVALID', 'member_fields'));
      continue;
    }
    if (!profileId(member.profile_id)
      || member.profile_id.includes('*')
      || ids.has(member.profile_id)) {
      errors.push(issue('APPROVED_PROFILE_COHORT_MEMBER_INVALID', 'profile_id'));
    }
    ids.add(member.profile_id);
    if (!isOpaquePrivateRuntimeReference(member.subscriber_subject_ref)
      || subjects.has(member.subscriber_subject_ref)) {
      errors.push(issue('APPROVED_PROFILE_COHORT_MEMBER_INVALID', 'subscriber_subject_ref'));
    }
    subjects.add(member.subscriber_subject_ref);
    if (!exactPrivateRuntimeScope(member.exact_scope)
      || member.exact_scope.profile_id !== member.profile_id
      || !sha256(member.exact_scope_hash)
      || member.exact_scope_hash !== hashPrivateRuntimeScope(member.exact_scope)
      || scopes.has(member.exact_scope_hash)) {
      errors.push(issue('APPROVED_PROFILE_COHORT_MEMBER_INVALID', 'exact_scope'));
    }
    scopes.add(member.exact_scope_hash);
    if (!sha256(member.business_engine_execution_contract_sha256)) {
      errors.push(issue('APPROVED_PROFILE_COHORT_MEMBER_INVALID', 'business_engine_execution_contract_sha256'));
    }
    if (!isOpaquePrivateRuntimeReference(member.approval_ref)
      || member.approval_status !== 'ACTIVE'
      || member.approval_purpose !== PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_PURPOSE
      || member.revoked !== false) {
      errors.push(issue('APPROVED_PROFILE_COHORT_MEMBER_INVALID', 'approval'));
    }
    if (!sha256(member.member_sha256)
      || member.member_sha256 !== privateRuntimeApprovedProfileCohortMemberDigest(member)) {
      errors.push(issue('APPROVED_PROFILE_COHORT_MEMBER_DIGEST_MISMATCH', 'member_sha256'));
    }
  }
  if (!timestamp(value.issued_at)
    || !timestamp(value.expires_at)
    || Date.parse(value.expires_at) <= Date.parse(value.issued_at)
    || Date.parse(value.expires_at) <= nowMs) {
    errors.push(issue('APPROVED_PROFILE_COHORT_EXPIRED', 'expires_at'));
  }
  if (!sha256(value.cohort_sha256)
    || value.cohort_sha256 !== privateRuntimeApprovedProfileCohortDigest(value)) {
    errors.push(issue('APPROVED_PROFILE_COHORT_DIGEST_MISMATCH', 'cohort_sha256'));
  }
  return result(errors, value);
}

function projectedReference(prefix, member) {
  return `${prefix}_${member.member_sha256.slice(0, 32)}`;
}

function projectEvidenceConsent(root, member, cohort) {
  return {
    ...structuredClone(root),
    consent_id: projectedReference('consent_private_beta', member),
    subject_ref: {
      ...structuredClone(root.subject_ref),
      id: member.profile_id,
      tenant_id: member.exact_scope.tenant_id,
    },
    tenant_id: member.exact_scope.tenant_id,
    effective_at: cohort.issued_at,
    expires_at: cohort.expires_at,
    revoked_at: null,
    status: 'ACTIVE',
    provenance: {
      ...structuredClone(root.provenance),
      protected_cohort_digest: cohort.cohort_sha256,
      approval_ref: member.approval_ref,
    },
    source_artifact: member.approval_ref,
  };
}

export function projectPrivateRuntimeCohortMemberBindingsV1({
  cohort,
  profileId: selectedProfileId,
  rootProductBindingAttestation,
  rootProductExecutionBinding,
  configurationAuthorityPacketSha256,
  nowMs = Date.now(),
} = {}) {
  const cohortValidation = validatePrivateRuntimeApprovedProfileCohortV1(cohort, {
    environmentId: rootProductBindingAttestation?.environment_id,
    nowMs,
  });
  if (!cohortValidation.valid || !profileId(selectedProfileId)) {
    return result([issue('APPROVED_PROFILE_COHORT_MEMBER_NOT_FOUND', 'profile_id')]);
  }
  const member = cohort.members.find((entry) => entry.profile_id === selectedProfileId);
  if (!member) {
    return result([issue('APPROVED_PROFILE_COHORT_MEMBER_NOT_FOUND', 'profile_id')]);
  }

  const product = structuredClone(rootProductBindingAttestation);
  product.subscriber_subject_ref = member.subscriber_subject_ref;
  product.exact_scope = structuredClone(member.exact_scope);
  product.exact_scope_hash = member.exact_scope_hash;
  product.business_engine = {
    ...product.business_engine,
    exact_scope: structuredClone(member.exact_scope),
    business_engine_ref: projectedReference('business_engine_private_beta', member),
    business_engine_contract_hash: member.business_engine_execution_contract_sha256,
  };
  product.subscription_runtime = {
    ...product.subscription_runtime,
    exact_scope: structuredClone(member.exact_scope),
    subscription_ref: projectedReference('subscription_private_beta', member),
  };
  product.coach_connect_runtime = null;
  product.binding_sha256 = privateRuntimeProductBindingDigest(product);

  const execution = structuredClone(rootProductExecutionBinding);
  execution.configuration_authority_packet_sha256 = configurationAuthorityPacketSha256;
  execution.product_binding_attestation_sha256 = product.binding_sha256;
  execution.business_engine_execution_contract_sha256 =
    member.business_engine_execution_contract_sha256;
  execution.exact_scope = structuredClone(member.exact_scope);
  execution.exact_scope_hash = member.exact_scope_hash;
  execution.approved_profile_ids = cohort.members.map((entry) => entry.profile_id);
  execution.vertical_operating_policy = {
    ...execution.vertical_operating_policy,
    tenant_id: member.exact_scope.tenant_id,
  };
  execution.intervention_candidates = execution.intervention_candidates.map((candidate) => ({
    ...candidate,
    tenant_id: member.exact_scope.tenant_id,
  }));
  execution.evidence_consent = projectEvidenceConsent(
    execution.evidence_consent,
    member,
    cohort,
  );
  execution.binding_sha256 = privateLiveProductExecutionBindingDigest(execution);

  const productValidation = validatePrivateRuntimeProductBindingAttestationV1(product, {
    environmentId: cohort.environment_id,
    subscriberSubjectRef: member.subscriber_subject_ref,
    exactScopeHash: member.exact_scope_hash,
    nowMs,
  });
  const executionValidation = validatePrivateLiveProductExecutionBindingV1(execution, {
    environmentId: cohort.environment_id,
    configurationAuthorityPacketSha256,
    productBindingAttestation: product,
    nowMs,
  });
  if (!productValidation.valid || !executionValidation.valid) {
    return result([
      ...(productValidation.errors || []),
      ...(executionValidation.errors || []),
    ]);
  }
  return result([], {
    member,
    product_binding_attestation: product,
    product_execution_binding: execution,
    cohort_digest: cohort.cohort_sha256,
  });
}

export async function readPrivateRuntimeApprovedProfileCohortV1({
  env = globalThis.process?.env || {},
  resolveReference,
  environmentId,
  nowMs = Date.now(),
} = {}) {
  const reference = env[PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_REFERENCE_VARIABLE];
  if (typeof reference !== 'string' || typeof resolveReference !== 'function') {
    return frozen({ ok: false, allowed: false, code: 'APPROVED_PROFILE_COHORT_UNCONFIGURED' });
  }
  try {
    const serialized = await resolveReference(reference, {
      purpose: PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_REFERENCE_VARIABLE,
      secret: false,
    });
    if (typeof serialized !== 'string' || serialized.length > 262144) throw new TypeError();
    const parsed = JSON.parse(serialized);
    const validation = validatePrivateRuntimeApprovedProfileCohortV1(parsed, {
      environmentId,
      nowMs,
    });
    return validation.valid
      ? frozen({ ok: true, allowed: false, cohort: validation.value, reference })
      : frozen({
          ok: false,
          allowed: false,
          code: validation.errors[0]?.code || 'APPROVED_PROFILE_COHORT_INVALID',
          field: validation.errors[0]?.field || null,
        });
  } catch {
    return frozen({ ok: false, allowed: false, code: 'APPROVED_PROFILE_COHORT_INVALID' });
  }
}
