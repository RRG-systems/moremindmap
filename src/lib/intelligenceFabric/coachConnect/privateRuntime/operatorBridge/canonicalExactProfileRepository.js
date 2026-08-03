import crypto from 'node:crypto';
import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_QUERY_VERSION,
  validateAsyncSecurityQueryResult,
} from '../../productionSecurity/asyncSecurityContracts.js';
import { validatePrivateTestApprovalV1 } from '../eligibility.js';
import {
  hashPrivateRuntimeScope,
  samePrivateRuntimeScope,
} from '../contracts.js';
import {
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
  SUBDEV1_PROFILE_RECORD_VERSION,
} from './contracts.js';
import { validSubdev1ProfileId } from './resolver.js';
import {
  PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_PURPOSE,
  validatePrivateRuntimeApprovedProfileCohortV1,
} from '../liveBindings/profileCohort.js';

export const SUBDEV1_CANONICAL_PROFILE_REPOSITORY_VERSION =
  'subdev1-canonical-exact-profile-repository-v1';

const frozen = (value) => deepFreeze(structuredClone(value));
const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function queryEnvelope({
  queryType,
  environmentId,
  correlationRef,
  subjectRef = null,
  exactScopeHash = null,
}) {
  return {
    query_version: ASYNC_SECURITY_QUERY_VERSION,
    query_type: queryType,
    environment_id: environmentId,
    correlation_ref: correlationRef,
    subject_ref: subjectRef,
    session_token_hash: null,
    entitlement_token_hash: null,
    exact_scope_hash: exactScopeHash,
    requested_runtime: null,
    requested_action: null,
    required_consistency: 'PRIMARY_OR_LINEARIZABLE',
  };
}

async function authoritativeQuery(statePort, query) {
  try {
    const raw = await statePort?.queryAuthoritative?.(query);
    const checked = validateAsyncSecurityQueryResult(raw, query.query_type);
    if (!checked.valid
      || raw.ok !== true
      || raw.consistency_proven !== true) {
      return frozen({
        ok: false,
        code: raw?.failure_code || checked.errors?.[0]?.code || 'NON_AUTHORITATIVE_READ',
      });
    }
    return frozen({
      ok: true,
      record: raw.record,
      server_time: raw.server_time,
      receipt_ref: raw.receipt_ref,
    });
  } catch {
    return frozen({ ok: false, code: 'NON_AUTHORITATIVE_READ' });
  }
}

export function createExactVaultProfileReader({ client } = {}) {
  return async function readExactVaultProfile(profileId) {
    if (!validSubdev1ProfileId(profileId) || typeof client?.get !== 'function') {
      return frozen({ status: 'UNAVAILABLE', record: null });
    }
    try {
      const serialized = await client.get(`vault:profile:${profileId}`);
      if (serialized == null) return frozen({ status: 'NOT_FOUND', record: null });
      const record = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      if (Array.isArray(record)) return frozen({ status: 'AMBIGUOUS', record: null });
      if (!object(record)
        || record.profile_id !== profileId
        || (
          record.canonical_profile_json?.profile_id != null
          && record.canonical_profile_json.profile_id !== profileId
        )) {
        return frozen({ status: 'INCOMPLETE', record: null });
      }
      return frozen({ status: 'FOUND', record });
    } catch {
      return frozen({ status: 'UNAVAILABLE', record: null });
    }
  };
}

export function createExactBusinessAssessmentReader({ client } = {}) {
  return async function readExactBusinessAssessment(profileId) {
    if (!validSubdev1ProfileId(profileId) || typeof client?.get !== 'function') {
      return frozen({ status: 'UNAVAILABLE', record: null });
    }
    try {
      const assessmentId = await client.get(
        `business_assessment_by_profile:${profileId.toLowerCase()}`,
      );
      if (typeof assessmentId !== 'string' || assessmentId.length < 3) {
        return frozen({ status: 'NOT_FOUND', record: null });
      }
      const serialized = await client.get(`business_assessment:${assessmentId}`);
      if (serialized == null) return frozen({ status: 'NOT_FOUND', record: null });
      const record = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
      const ownerProfileId = String(
        record?.profile_id
          || record?.assessment?.profile_id
          || record?.owner_profile_id
          || '',
      ).toLowerCase();
      if (!object(record) || ownerProfileId !== profileId.toLowerCase()) {
        return frozen({ status: 'INCOMPLETE', record: null });
      }
      return frozen({ status: 'FOUND', assessment_id: assessmentId, record });
    } catch {
      return frozen({ status: 'UNAVAILABLE', record: null });
    }
  };
}

export function createSubdev1CanonicalExactProfileRepository({
  readCanonicalProfile,
  readBusinessAssessment = null,
  productBindingAttestation,
  productExecutionBinding,
  approvedProfileCohort = null,
  statePort,
  environmentId,
  clock = () => Date.now(),
} = {}) {
  const exactScope = productBindingAttestation?.exact_scope;
  const exactScopeHash = productBindingAttestation?.exact_scope_hash;
  const subscriberSubjectRef = productBindingAttestation?.subscriber_subject_ref;

  async function resolveExactProfile(profileId, options = {}) {
    if (!validSubdev1ProfileId(profileId)) {
      return frozen({ status: 'NOT_FOUND', record: null });
    }
    const safeOptionFields = [
      'purpose',
      'mutation_allowed',
      'enumeration_allowed',
    ];
    if (!object(options)
      || Object.keys(options).some((field) => !safeOptionFields.includes(field))
      || options.purpose !== SUBDEV1_PROFILE_CONSENT_PURPOSE
      || options.mutation_allowed !== false
      || options.enumeration_allowed !== false) {
      return frozen({ status: 'DENIED', record: null });
    }
    const cohortValidation = approvedProfileCohort == null
      ? null
      : validatePrivateRuntimeApprovedProfileCohortV1(approvedProfileCohort, {
          environmentId,
          nowMs: clock(),
        });
    if (approvedProfileCohort != null && !cohortValidation?.valid) {
      return frozen({ status: 'NOT_FOUND', record: null });
    }
    const cohortMember = cohortValidation?.valid
      ? approvedProfileCohort.members.find((member) => member.profile_id === profileId)
      : null;
    const resolvedScope = cohortMember?.exact_scope || exactScope;
    const resolvedScopeHash = cohortMember?.exact_scope_hash || exactScopeHash;
    const resolvedSubjectRef = cohortMember?.subscriber_subject_ref || subscriberSubjectRef;
    const legacyBindingValid = approvedProfileCohort == null
      && object(exactScope)
      && exactScope.profile_id === profileId
      && exactScopeHash === hashPrivateRuntimeScope(exactScope)
      && productBindingAttestation?.environment_id === environmentId
      && productExecutionBinding?.environment_id === environmentId
      && samePrivateRuntimeScope(productExecutionBinding?.exact_scope, exactScope)
      && productExecutionBinding?.exact_scope_hash === exactScopeHash
      && productExecutionBinding?.private_beta_only === true
      && productExecutionBinding?.public_access === false
      && productExecutionBinding?.execution_enabled === true
      && Array.isArray(productExecutionBinding?.approved_profile_ids)
      && productExecutionBinding.approved_profile_ids.includes(profileId)
      && typeof subscriberSubjectRef === 'string';
    const cohortBindingValid = cohortMember != null
      && cohortMember.revoked === false
      && cohortMember.approval_status === 'ACTIVE'
      && cohortMember.approval_purpose === PRIVATE_RUNTIME_APPROVED_PROFILE_COHORT_PURPOSE
      && resolvedScope?.profile_id === profileId
      && resolvedScopeHash === hashPrivateRuntimeScope(resolvedScope)
      && typeof resolvedSubjectRef === 'string';
    if (!legacyBindingValid && !cohortBindingValid) {
      return frozen({ status: 'NOT_FOUND', record: null });
    }

    let vault;
    try {
      vault = await readCanonicalProfile?.(profileId);
    } catch {
      return frozen({ status: 'UNAVAILABLE', record: null });
    }
    if (vault?.status === 'AMBIGUOUS') {
      return frozen({ status: 'AMBIGUOUS', record: null });
    }
    if (vault?.status !== 'FOUND' || !object(vault.record)) {
      return frozen({ status: vault?.status || 'NOT_FOUND', record: null });
    }

    let assessment = null;
    if (typeof readBusinessAssessment === 'function') {
      try {
        assessment = await readBusinessAssessment(profileId);
      } catch {
        return frozen({ status: 'UNAVAILABLE', record: null });
      }
      if (assessment?.status !== 'FOUND' || !object(assessment.record)) {
        return frozen({ status: assessment?.status || 'NOT_FOUND', record: null });
      }
    } else if (cohortMember != null) {
      return frozen({ status: 'UNAVAILABLE', record: null });
    }

    let consentRef = cohortMember?.approval_ref || null;
    let approvalReceiptRef = cohortMember?.member_sha256 || null;
    if (cohortMember == null) {
      const correlationRef =
        `subdev1_profile_${crypto.randomBytes(16).toString('hex')}`;
      const [approvalResult, epochResult] = await Promise.all([
        authoritativeQuery(statePort, queryEnvelope({
          queryType: 'GET_PRIVATE_TEST_APPROVAL',
          environmentId,
          correlationRef,
          subjectRef: resolvedSubjectRef,
          exactScopeHash: resolvedScopeHash,
        })),
        authoritativeQuery(statePort, queryEnvelope({
          queryType: 'GET_SECURITY_EPOCH',
          environmentId,
          correlationRef,
          exactScopeHash: resolvedScopeHash,
        })),
      ]);
      if (!approvalResult.ok || !epochResult.ok) {
        return frozen({ status: 'NOT_FOUND', record: null });
      }
      const securityEpoch = epochResult.record?.security_epoch;
      if (!Number.isInteger(securityEpoch)
        || epochResult.record?.exact_scope_hash !== resolvedScopeHash) {
        return frozen({ status: 'INCOMPLETE', record: null });
      }
      const approval = validatePrivateTestApprovalV1(approvalResult.record, {
        environmentId,
        subscriberSubjectRef: resolvedSubjectRef,
        exactScopeHash: resolvedScopeHash,
        securityEpoch,
        now: Date.parse(approvalResult.server_time),
      });
      if (!approval.valid) return frozen({ status: 'NOT_FOUND', record: null });
      consentRef = approval.value.approval_ref;
      approvalReceiptRef = approvalResult.receipt_ref;
    }

    const vaultDigest = hashCanonicalJson(vault.record);
    const assessmentDigest = assessment == null ? null : hashCanonicalJson(assessment.record);
    const revisionDigest = hashCanonicalJson({
      vault_digest: vaultDigest,
      assessment_digest: assessmentDigest,
      cohort_member_digest: cohortMember?.member_sha256 || null,
    });
    return frozen({
      status: 'FOUND',
      record: {
        record_version: SUBDEV1_PROFILE_RECORD_VERSION,
        profile_id: profileId,
        subscriber_subject_ref: resolvedSubjectRef,
        exact_scope: resolvedScope,
        profile_revision: `vault_revision_${revisionDigest}`,
        consent_ref: consentRef,
        consent_purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
        consent_status: 'ACTIVE',
        provenance: {
          source: 'CANONICAL_PROFILE_REPOSITORY',
          record_ref:
            `vault_private_test_${vaultDigest.slice(0, 24)}_${hashCanonicalJson(
              approvalReceiptRef,
            ).slice(0, 16)}`,
        },
      },
    });
  }

  return Object.freeze({
    repository_version: SUBDEV1_CANONICAL_PROFILE_REPOSITORY_VERSION,
    authoritative: true,
    exact_id_only: true,
    non_enumerating: true,
    mutation_authority: false,
    authority_source: 'EXPLICIT_PRIVATE_TEST_APPROVAL',
    resolveExactProfile,
  });
}
