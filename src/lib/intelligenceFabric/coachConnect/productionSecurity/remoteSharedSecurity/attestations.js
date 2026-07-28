import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  isOpaqueAsyncSecurityReference,
} from '../asyncSecurityContracts.js';
import {
  REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
} from './configuration.js';

export const REMOTE_SHARED_SECURITY_OPERATING_MODES = deepFreeze([
  'QUALIFICATION',
  'PRIVATE_LIVE',
]);

export const REMOTE_SHARED_SECURITY_QUALIFICATION_CERTIFICATE_VERSION =
  'remote-security-qualification-certificate-v1';
export const REMOTE_SHARED_SECURITY_LIVE_ATTESTATION_VERSION =
  'private-live-environment-attestation-v1';

const QUALIFICATION_VERDICT =
  'PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_QUALIFIED_WITH_LIMITS';

const CERTIFICATE_FIELDS = deepFreeze([
  'certificate_version',
  'adapter_implementation_id',
  'adapter_source_sha256',
  'contract_version',
  'adapter_contract_version',
  'provider_class',
  'qualification_review_package_name',
  'qualification_review_package_sha256',
  'attestation_repair_review_package_name',
  'attestation_repair_review_package_sha256',
  'qualified_script_manifest_sha256',
  'qualification_verdict',
  'qualified_at',
  'review_due_at',
  'capabilities',
  'known_limits',
  'zero_customer_data',
  'qualification_namespace_teardown_proven',
  'certificate_sha256',
]);

const CAPABILITY_FIELDS = deepFreeze([
  'promise_native',
  'provider_native_atomic_commands',
  'authoritative_primary_queries',
  'authority_snapshot_internally_consistent',
  'race_failure_qualified',
  'mandatory_audit_coupled',
  'restart_recovery_proven',
  'fail_closed_outage_proven',
  'namespace_isolation_proven',
]);

const LIVE_ATTESTATION_FIELDS = deepFreeze([
  'attestation_version',
  'operating_mode',
  'environment_id',
  'vercel_project_reference',
  'provider_classification',
  'deployment_target',
  'provider_class',
  'persistent_namespace',
  'disposable_namespace',
  'private_live_only',
  'public_access',
  'production_customer_rollout',
  'namespace_prefix',
  'namespace_digest',
  'adapter_implementation_id',
  'adapter_source_sha256',
  'qualification_certificate_sha256',
  'contract_version',
  'adapter_contract_version',
  'configuration_digest',
  'protected_edge',
  'named_identity_only',
  'mfa_backed_operator',
  'runtime_default_state',
  'runtime_activation_approved',
  'emergency_disable_supported',
  'emergency_disable_state',
  'retention_class',
  'backup_class',
  'deletion_class',
  'approved_tester_scope_digest',
  'approved_profile_id_scope_digest',
  'activation_owner_ref',
  'rollback_owner_ref',
  'operator_approval_ref',
  'issued_at',
  'review_due_at',
  'attestation_sha256',
]);

const LIVE_ENVIRONMENTS = deepFreeze([
  'PRIVATE_PREVIEW',
  'PRIVATE_PRODUCTION_CLASSIFIED',
]);

const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value) => typeof value === 'string'
  && Number.isFinite(Date.parse(value));
const exactFields = (value, fields) => value
  && typeof value === 'object'
  && !Array.isArray(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const frozen = (value) => deepFreeze(structuredClone(value));
const issue = (code, field) => frozen({ code, field });

function digestWithout(value, digestField) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('attestation object required');
  }
  const digestable = Object.fromEntries(
    Object.entries(value).filter(([field]) => field !== digestField),
  );
  return hashCanonicalJson(digestable);
}

function validCapabilities(capabilities) {
  return exactFields(capabilities, CAPABILITY_FIELDS)
    && CAPABILITY_FIELDS.every((field) => capabilities[field] === true);
}

function validateDates(issuedAt, reviewDueAt, nowMs) {
  return timestamp(issuedAt)
    && timestamp(reviewDueAt)
    && Date.parse(issuedAt) <= nowMs
    && Date.parse(reviewDueAt) > nowMs
    && Date.parse(reviewDueAt) > Date.parse(issuedAt);
}

export function remoteSecurityQualificationCertificateFields() {
  return CERTIFICATE_FIELDS;
}

export function privateLiveEnvironmentAttestationFields() {
  return LIVE_ATTESTATION_FIELDS;
}

export function remoteSecurityQualificationCertificateDigest(certificate) {
  return digestWithout(certificate, 'certificate_sha256');
}

export function privateLiveEnvironmentAttestationDigest(attestation) {
  return digestWithout(attestation, 'attestation_sha256');
}

export function validateRemoteSecurityQualificationCertificate(certificate, {
  expected_adapter_implementation_id,
  expected_adapter_source_sha256,
  expected_provider_class,
  expected_qualification_review_package_sha256,
  expected_attestation_repair_review_package_sha256,
  expected_script_manifest_sha256,
  now_ms = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(certificate, CERTIFICATE_FIELDS)) {
    return frozen({
      valid: false,
      errors: [issue('QUALIFICATION_CERTIFICATE_INVALID', 'fields')],
      value: null,
    });
  }
  if (certificate.certificate_version
    !== REMOTE_SHARED_SECURITY_QUALIFICATION_CERTIFICATE_VERSION) {
    errors.push(issue('QUALIFICATION_CERTIFICATE_INVALID', 'certificate_version'));
  }
  if (!isOpaqueAsyncSecurityReference(certificate.adapter_implementation_id)
    || certificate.adapter_implementation_id !== expected_adapter_implementation_id) {
    errors.push(issue('ADAPTER_IMPLEMENTATION_MISMATCH', 'adapter_implementation_id'));
  }
  if (!sha256(certificate.adapter_source_sha256)
    || certificate.adapter_source_sha256 !== expected_adapter_source_sha256) {
    errors.push(issue('ADAPTER_SOURCE_DIGEST_MISMATCH', 'adapter_source_sha256'));
  }
  if (certificate.contract_version !== ASYNC_SECURITY_STATE_CONTRACT_VERSION) {
    errors.push(issue('ASYNC_SECURITY_CONTRACT_VIOLATION', 'contract_version'));
  }
  if (certificate.adapter_contract_version
    !== REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION) {
    errors.push(issue('ADAPTER_CONTRACT_MISMATCH', 'adapter_contract_version'));
  }
  if (certificate.provider_class !== expected_provider_class) {
    errors.push(issue('PROVIDER_CLASS_MISMATCH', 'provider_class'));
  }
  if (!isOpaqueAsyncSecurityReference(certificate.qualification_review_package_name)
    || !sha256(certificate.qualification_review_package_sha256)
    || certificate.qualification_review_package_sha256
      !== expected_qualification_review_package_sha256) {
    errors.push(issue(
      'QUALIFICATION_REVIEW_PACKAGE_MISMATCH',
      'qualification_review_package_sha256',
    ));
  }
  if (!isOpaqueAsyncSecurityReference(certificate.attestation_repair_review_package_name)
    || !sha256(certificate.attestation_repair_review_package_sha256)
    || certificate.attestation_repair_review_package_sha256
      !== expected_attestation_repair_review_package_sha256) {
    errors.push(issue(
      'ATTESTATION_REPAIR_REVIEW_PACKAGE_MISMATCH',
      'attestation_repair_review_package_sha256',
    ));
  }
  if (!sha256(certificate.qualified_script_manifest_sha256)
    || certificate.qualified_script_manifest_sha256 !== expected_script_manifest_sha256) {
    errors.push(issue(
      'QUALIFIED_SCRIPT_MANIFEST_MISMATCH',
      'qualified_script_manifest_sha256',
    ));
  }
  if (certificate.qualification_verdict !== QUALIFICATION_VERDICT) {
    errors.push(issue('QUALIFICATION_VERDICT_INVALID', 'qualification_verdict'));
  }
  if (!validateDates(certificate.qualified_at, certificate.review_due_at, now_ms)) {
    errors.push(issue('QUALIFICATION_CERTIFICATE_EXPIRED', 'review_due_at'));
  }
  if (!validCapabilities(certificate.capabilities)) {
    errors.push(issue('QUALIFICATION_CAPABILITY_MISSING', 'capabilities'));
  }
  if (!Array.isArray(certificate.known_limits)
    || certificate.known_limits.length > 32
    || certificate.known_limits.some((entry) => !isOpaqueAsyncSecurityReference(entry, 128))) {
    errors.push(issue('QUALIFICATION_CERTIFICATE_INVALID', 'known_limits'));
  }
  if (certificate.zero_customer_data !== true
    || certificate.qualification_namespace_teardown_proven !== true) {
    errors.push(issue('QUALIFICATION_EVIDENCE_INCOMPLETE', 'evidence'));
  }
  if (!sha256(certificate.certificate_sha256)
    || certificate.certificate_sha256
      !== remoteSecurityQualificationCertificateDigest(certificate)) {
    errors.push(issue('QUALIFICATION_CERTIFICATE_DIGEST_MISMATCH', 'certificate_sha256'));
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? certificate : null,
  });
}

export function validatePrivateLiveEnvironmentAttestation(attestation, {
  configuration,
  configuration_digest,
  qualification_certificate,
  expected_adapter_implementation_id,
  expected_adapter_source_sha256,
  now_ms = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(attestation, LIVE_ATTESTATION_FIELDS)) {
    return frozen({
      valid: false,
      errors: [issue('LIVE_ENVIRONMENT_ATTESTATION_INVALID', 'fields')],
      value: null,
    });
  }
  if (attestation.attestation_version !== REMOTE_SHARED_SECURITY_LIVE_ATTESTATION_VERSION) {
    errors.push(issue('LIVE_ENVIRONMENT_ATTESTATION_INVALID', 'attestation_version'));
  }
  if (attestation.operating_mode !== 'PRIVATE_LIVE') {
    errors.push(issue('OPERATING_MODE_INVALID', 'operating_mode'));
  }
  if (!LIVE_ENVIRONMENTS.includes(attestation.environment_id)
    || attestation.environment_id !== configuration?.environment_id) {
    errors.push(issue('ENVIRONMENT_MISMATCH', 'environment_id'));
  }
  if (!isOpaqueAsyncSecurityReference(attestation.vercel_project_reference)
    || !['PREVIEW', 'PRODUCTION'].includes(attestation.provider_classification)
    || !['preview', 'production'].includes(attestation.deployment_target)) {
    errors.push(issue('LIVE_ENVIRONMENT_ATTESTATION_INVALID', 'deployment_identity'));
  }
  if (attestation.environment_id === 'PRIVATE_PREVIEW'
    && (attestation.provider_classification !== 'PREVIEW'
      || attestation.deployment_target !== 'preview')) {
    errors.push(issue('ENVIRONMENT_CLASSIFICATION_MISMATCH', 'provider_classification'));
  }
  if (attestation.environment_id === 'PRIVATE_PRODUCTION_CLASSIFIED'
    && (attestation.provider_classification !== 'PRODUCTION'
      || attestation.deployment_target !== 'production')) {
    errors.push(issue('ENVIRONMENT_CLASSIFICATION_MISMATCH', 'provider_classification'));
  }
  if (attestation.provider_class !== configuration?.provider) {
    errors.push(issue('PROVIDER_CLASS_MISMATCH', 'provider_class'));
  }
  if (attestation.persistent_namespace !== true
    || attestation.disposable_namespace !== false
    || attestation.private_live_only !== true) {
    errors.push(issue('PRIVATE_LIVE_NAMESPACE_REQUIRED', 'namespace_mode'));
  }
  if (attestation.public_access !== false
    || attestation.production_customer_rollout !== false) {
    errors.push(issue('PUBLIC_OR_CUSTOMER_ACTIVATION_DENIED', 'exposure'));
  }
  if (attestation.namespace_prefix !== configuration?.namespace_prefix
    || attestation.namespace_digest !== configuration?.namespace_digest) {
    errors.push(issue('NAMESPACE_MISMATCH', 'namespace_digest'));
  }
  if (!sha256(attestation.namespace_digest)) {
    errors.push(issue('LIVE_ENVIRONMENT_ATTESTATION_INVALID', 'namespace_digest'));
  }
  if (attestation.adapter_implementation_id !== expected_adapter_implementation_id
    || attestation.adapter_implementation_id
      !== qualification_certificate?.adapter_implementation_id) {
    errors.push(issue('ADAPTER_IMPLEMENTATION_MISMATCH', 'adapter_implementation_id'));
  }
  if (attestation.adapter_source_sha256 !== expected_adapter_source_sha256
    || attestation.adapter_source_sha256 !== qualification_certificate?.adapter_source_sha256) {
    errors.push(issue('ADAPTER_SOURCE_DIGEST_MISMATCH', 'adapter_source_sha256'));
  }
  if (attestation.qualification_certificate_sha256
    !== qualification_certificate?.certificate_sha256) {
    errors.push(issue(
      'QUALIFICATION_CERTIFICATE_DIGEST_MISMATCH',
      'qualification_certificate_sha256',
    ));
  }
  if (attestation.contract_version !== ASYNC_SECURITY_STATE_CONTRACT_VERSION
    || attestation.contract_version !== qualification_certificate?.contract_version) {
    errors.push(issue('ASYNC_SECURITY_CONTRACT_VIOLATION', 'contract_version'));
  }
  if (attestation.adapter_contract_version
    !== REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION
    || attestation.adapter_contract_version
      !== qualification_certificate?.adapter_contract_version) {
    errors.push(issue('ADAPTER_CONTRACT_MISMATCH', 'adapter_contract_version'));
  }
  if (attestation.configuration_digest !== configuration_digest) {
    errors.push(issue('CONFIGURATION_DIGEST_MISMATCH', 'configuration_digest'));
  }
  if (attestation.protected_edge !== true
    || attestation.named_identity_only !== true
    || attestation.mfa_backed_operator !== true) {
    errors.push(issue('PROTECTED_EDGE_REQUIRED', 'protected_edge'));
  }
  if (attestation.runtime_default_state !== 'OFF'
    || attestation.runtime_activation_approved !== false) {
    errors.push(issue('SOURCE_DEFAULT_OFF_REQUIRED', 'runtime_default_state'));
  }
  if (attestation.emergency_disable_supported !== true
    || attestation.emergency_disable_state !== 'READY') {
    errors.push(issue('EMERGENCY_DISABLE_REQUIRED', 'emergency_disable_state'));
  }
  for (const field of [
    'retention_class',
    'backup_class',
    'deletion_class',
    'activation_owner_ref',
    'rollback_owner_ref',
    'operator_approval_ref',
  ]) {
    if (!isOpaqueAsyncSecurityReference(attestation[field])) {
      errors.push(issue('LIVE_ENVIRONMENT_ATTESTATION_INVALID', field));
    }
  }
  for (const field of ['approved_tester_scope_digest', 'approved_profile_id_scope_digest']) {
    if (!sha256(attestation[field])) {
      errors.push(issue('LIVE_ENVIRONMENT_ATTESTATION_INVALID', field));
    }
  }
  if (!validateDates(attestation.issued_at, attestation.review_due_at, now_ms)) {
    errors.push(issue('LIVE_ENVIRONMENT_ATTESTATION_EXPIRED', 'review_due_at'));
  }
  if (!sha256(attestation.attestation_sha256)
    || attestation.attestation_sha256
      !== privateLiveEnvironmentAttestationDigest(attestation)) {
    errors.push(issue('LIVE_ATTESTATION_DIGEST_MISMATCH', 'attestation_sha256'));
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? attestation : null,
  });
}

function validateQualificationAttestation(attestation, {
  configuration,
  configuration_digest,
  script_manifest_digest,
  now_ms,
}) {
  const errors = [];
  if (attestation?.attestation_version
    !== 'remote-shared-security-qualification-attestation-v1') {
    errors.push(issue('QUALIFICATION_ATTESTATION_INVALID', 'attestation_version'));
  }
  if (attestation?.adapter_id !== configuration?.adapter_id) {
    errors.push(issue('ADAPTER_IMPLEMENTATION_MISMATCH', 'adapter_id'));
  }
  if (attestation?.environment_id !== configuration?.environment_id) {
    errors.push(issue('ENVIRONMENT_MISMATCH', 'environment_id'));
  }
  if (attestation?.namespace_digest !== configuration?.namespace_digest) {
    errors.push(issue('NAMESPACE_MISMATCH', 'namespace_digest'));
  }
  if (attestation?.configuration_digest !== configuration_digest) {
    errors.push(issue('CONFIGURATION_DIGEST_MISMATCH', 'configuration_digest'));
  }
  if (attestation?.script_manifest_digest !== script_manifest_digest) {
    errors.push(issue('SCRIPT_VERSION_MISMATCH', 'script_manifest_digest'));
  }
  if (attestation?.primary_authority_proven !== true
    || attestation?.atomic_script_proven !== true
    || attestation?.live_connection_verified !== true
    || attestation?.zero_customer_data !== true) {
    errors.push(issue('QUALIFICATION_EVIDENCE_INCOMPLETE', 'evidence'));
  }
  if (attestation?.disposable_namespace !== true
    || attestation?.persistent_namespace === true) {
    errors.push(issue('DISPOSABLE_QUALIFICATION_NAMESPACE_REQUIRED', 'namespace_mode'));
  }
  if (!validateDates(attestation?.qualified_at, attestation?.expires_at, now_ms)) {
    errors.push(issue('QUALIFICATION_ATTESTATION_EXPIRED', 'expires_at'));
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? attestation : null,
  });
}

export function evaluateRemoteSharedSecurityOperatingAuthority({
  operating_mode,
  configuration,
  configuration_digest,
  script_manifest_digest,
  qualification_attestation = null,
  qualification_certificate = null,
  live_environment_attestation = null,
  expected_adapter_implementation_id = null,
  expected_adapter_source_sha256 = null,
  expected_qualification_review_package_sha256 = null,
  expected_attestation_repair_review_package_sha256 = null,
  now_ms = Date.now(),
} = {}) {
  if (!REMOTE_SHARED_SECURITY_OPERATING_MODES.includes(operating_mode)) {
    return frozen({
      valid: false,
      operating_mode: null,
      authority_class: 'NONE',
      errors: [issue('OPERATING_MODE_INVALID', 'operating_mode')],
    });
  }
  if (operating_mode === 'QUALIFICATION') {
    if (qualification_certificate != null || live_environment_attestation != null) {
      return frozen({
        valid: false,
        operating_mode,
        authority_class: 'QUALIFICATION',
        errors: [issue('OPERATING_AUTHORITY_MIXED', 'authority_bundle')],
      });
    }
    const checked = validateQualificationAttestation(qualification_attestation, {
      configuration,
      configuration_digest,
      script_manifest_digest,
      now_ms,
    });
    return frozen({
      valid: checked.valid,
      operating_mode,
      authority_class: 'QUALIFICATION',
      errors: checked.errors,
    });
  }
  if (qualification_attestation != null) {
    return frozen({
      valid: false,
      operating_mode,
      authority_class: 'PRIVATE_LIVE',
      errors: [issue('OPERATING_AUTHORITY_MIXED', 'qualification_attestation')],
    });
  }
  const certificate = validateRemoteSecurityQualificationCertificate(
    qualification_certificate,
    {
      expected_adapter_implementation_id,
      expected_adapter_source_sha256,
      expected_provider_class: configuration?.provider,
      expected_qualification_review_package_sha256,
      expected_attestation_repair_review_package_sha256,
      expected_script_manifest_sha256: script_manifest_digest,
      now_ms,
    },
  );
  const live = validatePrivateLiveEnvironmentAttestation(
    live_environment_attestation,
    {
      configuration,
      configuration_digest,
      qualification_certificate,
      expected_adapter_implementation_id,
      expected_adapter_source_sha256,
      now_ms,
    },
  );
  return frozen({
    valid: certificate.valid && live.valid,
    operating_mode,
    authority_class: 'PRIVATE_LIVE',
    errors: [...certificate.errors, ...live.errors],
  });
}
