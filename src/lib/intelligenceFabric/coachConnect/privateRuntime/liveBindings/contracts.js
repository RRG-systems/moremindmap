import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  exactPrivateRuntimeScope,
  hashPrivateRuntimeScope,
  isOpaquePrivateRuntimeReference,
  samePrivateRuntimeScope,
} from '../contracts.js';

export const PRIVATE_RUNTIME_LIVE_BINDING_CONTRACT_VERSION =
  'private-runtime-live-binding-contract-v1';
export const PRIVATE_RUNTIME_PRODUCT_BINDING_VERSION =
  'private-runtime-product-binding-attestation-v1';
export const PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_VERSION =
  'private-runtime-configuration-authority-v1';
export const PRIVATE_RUNTIME_ACTIVATION_RECEIPT_VERSION =
  'private-runtime-activation-receipt-v1';
export const PRIVATE_RUNTIME_COHORT_ACTIVATION_RECEIPT_VERSION =
  'private-runtime-cohort-activation-receipt-v2';
export const PRIVATE_RUNTIME_ROLLBACK_RECEIPT_VERSION =
  'private-runtime-rollback-receipt-v1';
const PRIVATE_RUNTIME_COHORT_ACTIVATION_COUNT = 4;

const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const frozen = (value) => deepFreeze(structuredClone(value));
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const issue = (code, field) => ({ code, field });
const result = (errors, value = null) => frozen({
  valid: errors.length === 0,
  errors,
  value: errors.length === 0 ? value : null,
});

const PRODUCT_BINDING_FIELDS = deepFreeze([
  'binding_version',
  'environment_id',
  'subscriber_subject_ref',
  'exact_scope',
  'exact_scope_hash',
  'business_engine',
  'subscription_runtime',
  'coach_connect_runtime',
  'issued_at',
  'review_due_at',
  'binding_sha256',
]);

const BUSINESS_ENGINE_FIELDS = deepFreeze([
  'source',
  'exact_scope',
  'business_engine_ref',
  'business_engine_version',
  'business_engine_contract_hash',
  'write_authorized',
]);

const SUBSCRIPTION_FIELDS = deepFreeze([
  'existing_runtime',
  'subscription_ref',
  'runtime_contract_version',
  'exact_scope',
  'production_namespace',
  'customer_data',
  'migration',
]);

const COACH_CONNECT_FIELDS = deepFreeze([
  'existing_runtime',
  'runtime_ref',
  'exact_scope',
  'relationship_ref',
  'consent_ref',
  'coach_identity_ref',
  'text_only',
  'production_persistence',
  'transcript_persistence',
  'live_model_provider',
  'live_media_provider',
  'stripe',
  'canonical_mutation_authority',
]);

const AUTHORITY_PACKET_FIELDS = deepFreeze([
  'packet_version',
  'environment_id',
  'operating_mode',
  'source_default_off',
  'live_enabled',
  'emergency_disabled',
  'protected_edge_policy_digest',
  'remote_security_configuration_digest',
  'qualification_certificate_digest',
  'live_environment_attestation_digest',
  'product_binding_attestation_digest',
  'assertion_configuration_digest',
  'qualified_adapter_source_sha256',
  'private_access_code_ref',
  'edge_assertion_key_ref',
  'activation_receipt_ref',
  'activation_owner_ref',
  'rollback_owner_ref',
  'monitoring_owner_ref',
  'issued_at',
  'review_due_at',
  'packet_sha256',
]);

const ACTIVATION_FIELDS = deepFreeze([
  'receipt_version',
  'environment_id',
  'configuration_authority_packet_digest',
  'exact_scope_hash',
  'approved',
  'private_live_only',
  'public_access',
  'named_tester_scope',
  'production_customer_rollout',
  'activation_owner_ref',
  'rollback_owner_ref',
  'emergency_disable_ready',
  'issued_at',
  'expires_at',
  'receipt_sha256',
]);

const COHORT_ACTIVATION_FIELDS = deepFreeze([
  'receipt_version',
  'environment_id',
  'configuration_authority_packet_digest',
  'approved_profile_cohort_digest',
  'cohort_count',
  'deployment_commit_sha',
  'deployment_tree_sha',
  'vercel_project_reference',
  'product_binding_attestation_digest',
  'approved',
  'controlled_internal_beta',
  'private_live_only',
  'public_access',
  'source_default_off',
  'named_tester_scope',
  'production_customer_rollout',
  'activation_owner_ref',
  'rollback_owner_ref',
  'rollback_receipt_ref',
  'rollback_receipt_digest',
  'emergency_disable_ready',
  'issued_at',
  'expires_at',
  'receipt_sha256',
]);

const ROLLBACK_FIELDS = deepFreeze([
  'receipt_version',
  'environment_id',
  'configuration_authority_packet_digest',
  'approved_profile_cohort_digest',
  'runtime_live_enabled_target',
  'subdev1_operator_enabled_target',
  'activation_receipt_invalidated_target',
  'cohort_revoked_target',
  'public_access',
  'append_only_history_preserved',
  'source_revert_required',
  'rollback_owner_ref',
  'issued_at',
  'expires_at',
  'receipt_sha256',
]);

function digestWithout(value, digestField) {
  if (!object(value)) throw new TypeError('attested object required');
  const copy = { ...value };
  delete copy[digestField];
  return hashCanonicalJson(copy);
}

function datesValid(issuedAt, reviewDueAt, nowMs) {
  return timestamp(issuedAt)
    && timestamp(reviewDueAt)
    && Date.parse(reviewDueAt) > Date.parse(issuedAt)
    && (!Number.isFinite(nowMs) || Date.parse(reviewDueAt) > nowMs);
}

export function privateRuntimeProductBindingDigest(value) {
  return digestWithout(value, 'binding_sha256');
}

export function privateRuntimeConfigurationAuthorityDigest(value) {
  return digestWithout(value, 'packet_sha256');
}

export function privateRuntimeActivationReceiptDigest(value) {
  return digestWithout(value, 'receipt_sha256');
}

export function privateRuntimeRollbackReceiptDigest(value) {
  return digestWithout(value, 'receipt_sha256');
}

export function validatePrivateRuntimeProductBindingAttestationV1(value, {
  environmentId = null,
  subscriberSubjectRef = null,
  exactScopeHash = null,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(value, PRODUCT_BINDING_FIELDS)) {
    return result([issue('PRODUCT_BINDING_ATTESTATION_INVALID', 'fields')]);
  }
  if (value.binding_version !== PRIVATE_RUNTIME_PRODUCT_BINDING_VERSION) {
    errors.push(issue('PRODUCT_BINDING_ATTESTATION_INVALID', 'binding_version'));
  }
  if (!isOpaquePrivateRuntimeReference(value.environment_id)
    || (environmentId != null && value.environment_id !== environmentId)) {
    errors.push(issue('PRODUCT_BINDING_ATTESTATION_MISMATCH', 'environment_id'));
  }
  if (!isOpaquePrivateRuntimeReference(value.subscriber_subject_ref)
    || (subscriberSubjectRef != null
      && value.subscriber_subject_ref !== subscriberSubjectRef)) {
    errors.push(issue('PRODUCT_BINDING_ATTESTATION_MISMATCH', 'subscriber_subject_ref'));
  }
  if (!exactPrivateRuntimeScope(value.exact_scope)
    || !sha256(value.exact_scope_hash)
    || value.exact_scope_hash !== hashPrivateRuntimeScope(value.exact_scope)
    || (exactScopeHash != null && value.exact_scope_hash !== exactScopeHash)) {
    errors.push(issue('PRODUCT_BINDING_ATTESTATION_MISMATCH', 'exact_scope'));
  }

  const engine = value.business_engine;
  if (!exactFields(engine, BUSINESS_ENGINE_FIELDS)
    || engine.source !== 'CANONICAL_BUSINESS_ENGINE'
    || !samePrivateRuntimeScope(engine.exact_scope, value.exact_scope)
    || !isOpaquePrivateRuntimeReference(engine.business_engine_ref)
    || !isOpaquePrivateRuntimeReference(engine.business_engine_version)
    || !sha256(engine.business_engine_contract_hash)
    || engine.write_authorized !== false) {
    errors.push(issue('BUSINESS_ENGINE_ATTACHMENT_MISMATCH', 'business_engine'));
  }

  const subscription = value.subscription_runtime;
  if (!exactFields(subscription, SUBSCRIPTION_FIELDS)
    || subscription.existing_runtime !== true
    || !samePrivateRuntimeScope(subscription.exact_scope, value.exact_scope)
    || !isOpaquePrivateRuntimeReference(subscription.subscription_ref)
    || !isOpaquePrivateRuntimeReference(subscription.runtime_contract_version)
    || subscription.production_namespace !== false
    || subscription.customer_data !== false
    || subscription.migration !== false) {
    errors.push(issue('SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH', 'subscription_runtime'));
  }

  const coach = value.coach_connect_runtime;
  if (coach != null && (!exactFields(coach, COACH_CONNECT_FIELDS)
    || coach.existing_runtime !== true
    || !samePrivateRuntimeScope(coach.exact_scope, value.exact_scope)
    || !isOpaquePrivateRuntimeReference(coach.runtime_ref)
    || !isOpaquePrivateRuntimeReference(coach.relationship_ref)
    || !isOpaquePrivateRuntimeReference(coach.consent_ref)
    || !isOpaquePrivateRuntimeReference(coach.coach_identity_ref)
    || coach.text_only !== true
    || coach.production_persistence !== false
    || coach.transcript_persistence !== false
    || coach.live_model_provider !== false
    || coach.live_media_provider !== false
    || coach.stripe !== false
    || coach.canonical_mutation_authority !== false)) {
    errors.push(issue('COACH_CONNECT_STATE_MISSING', 'coach_connect_runtime'));
  }

  if (!datesValid(value.issued_at, value.review_due_at, nowMs)) {
    errors.push(issue('PRODUCT_BINDING_ATTESTATION_EXPIRED', 'review_due_at'));
  }
  if (!sha256(value.binding_sha256)
    || value.binding_sha256 !== privateRuntimeProductBindingDigest(value)) {
    errors.push(issue('PRODUCT_BINDING_ATTESTATION_DIGEST_MISMATCH', 'binding_sha256'));
  }
  return result(errors, value);
}

export function validatePrivateRuntimeConfigurationAuthorityV1(value, {
  environmentId = null,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(value, AUTHORITY_PACKET_FIELDS)) {
    return result([issue('CONFIGURATION_AUTHORITY_INVALID', 'fields')]);
  }
  if (value.packet_version !== PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_VERSION
    || value.operating_mode !== 'PRIVATE_LIVE'
    || value.source_default_off !== true
    || typeof value.live_enabled !== 'boolean'
    || typeof value.emergency_disabled !== 'boolean') {
    errors.push(issue('CONFIGURATION_AUTHORITY_INVALID', 'mode'));
  }
  if (!isOpaquePrivateRuntimeReference(value.environment_id)
    || (environmentId != null && value.environment_id !== environmentId)) {
    errors.push(issue('CONFIGURATION_AUTHORITY_MISMATCH', 'environment_id'));
  }
  for (const field of [
    'protected_edge_policy_digest',
    'remote_security_configuration_digest',
    'qualification_certificate_digest',
    'live_environment_attestation_digest',
    'product_binding_attestation_digest',
    'assertion_configuration_digest',
    'qualified_adapter_source_sha256',
  ]) {
    if (!sha256(value[field])) errors.push(issue('CONFIGURATION_AUTHORITY_INVALID', field));
  }
  for (const field of [
    'private_access_code_ref',
    'edge_assertion_key_ref',
    'activation_owner_ref',
    'rollback_owner_ref',
    'monitoring_owner_ref',
  ]) {
    if (!isOpaquePrivateRuntimeReference(value[field])) {
      errors.push(issue('CONFIGURATION_AUTHORITY_INVALID', field));
    }
  }
  if (value.activation_receipt_ref !== null
    && !isOpaquePrivateRuntimeReference(value.activation_receipt_ref)) {
    errors.push(issue('CONFIGURATION_AUTHORITY_INVALID', 'activation_receipt_ref'));
  }
  if (value.live_enabled === true && value.activation_receipt_ref === null) {
    errors.push(issue('ACTIVATION_AUTHORITY_REQUIRED', 'activation_receipt_ref'));
  }
  if (!datesValid(value.issued_at, value.review_due_at, nowMs)) {
    errors.push(issue('CONFIGURATION_AUTHORITY_EXPIRED', 'review_due_at'));
  }
  if (!sha256(value.packet_sha256)
    || value.packet_sha256 !== privateRuntimeConfigurationAuthorityDigest(value)) {
    errors.push(issue('CONFIGURATION_AUTHORITY_DIGEST_MISMATCH', 'packet_sha256'));
  }
  return result(errors, value);
}

export function validatePrivateRuntimeActivationReceiptV1(value, {
  environmentId,
  configurationAuthorityPacketDigest,
  exactScopeHash,
  activationOwnerRef,
  rollbackOwnerRef,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(value, ACTIVATION_FIELDS)) {
    return result([issue('ACTIVATION_AUTHORITY_REQUIRED', 'fields')]);
  }
  if (value.receipt_version !== PRIVATE_RUNTIME_ACTIVATION_RECEIPT_VERSION
    || value.environment_id !== environmentId
    || value.configuration_authority_packet_digest !== configurationAuthorityPacketDigest
    || value.exact_scope_hash !== exactScopeHash
    || value.activation_owner_ref !== activationOwnerRef
    || value.rollback_owner_ref !== rollbackOwnerRef) {
    errors.push(issue('ACTIVATION_AUTHORITY_MISMATCH', 'binding'));
  }
  if (value.approved !== true
    || value.private_live_only !== true
    || value.public_access !== false
    || value.named_tester_scope !== 'EXACT_APPROVED_COHORT_ONLY'
    || value.production_customer_rollout !== false
    || value.emergency_disable_ready !== true) {
    errors.push(issue('ACTIVATION_AUTHORITY_REQUIRED', 'authority'));
  }
  if (!datesValid(value.issued_at, value.expires_at, nowMs)) {
    errors.push(issue('ACTIVATION_AUTHORITY_EXPIRED', 'expires_at'));
  }
  if (!sha256(value.receipt_sha256)
    || value.receipt_sha256 !== privateRuntimeActivationReceiptDigest(value)) {
    errors.push(issue('ACTIVATION_AUTHORITY_DIGEST_MISMATCH', 'receipt_sha256'));
  }
  return result(errors, value);
}

export function validatePrivateRuntimeRollbackReceiptV1(value, {
  environmentId,
  configurationAuthorityPacketDigest,
  approvedProfileCohortDigest,
  rollbackOwnerRef,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(value, ROLLBACK_FIELDS)) {
    return result([issue('ROLLBACK_AUTHORITY_REQUIRED', 'fields')]);
  }
  if (value.receipt_version !== PRIVATE_RUNTIME_ROLLBACK_RECEIPT_VERSION
    || value.environment_id !== environmentId
    || value.configuration_authority_packet_digest !== configurationAuthorityPacketDigest
    || value.approved_profile_cohort_digest !== approvedProfileCohortDigest
    || value.rollback_owner_ref !== rollbackOwnerRef) {
    errors.push(issue('ROLLBACK_AUTHORITY_MISMATCH', 'binding'));
  }
  if (value.runtime_live_enabled_target !== false
    || value.subdev1_operator_enabled_target !== false
    || value.activation_receipt_invalidated_target !== true
    || value.cohort_revoked_target !== true
    || value.public_access !== false
    || value.append_only_history_preserved !== true
    || value.source_revert_required !== false) {
    errors.push(issue('ROLLBACK_AUTHORITY_REQUIRED', 'target'));
  }
  if (!datesValid(value.issued_at, value.expires_at, nowMs)) {
    errors.push(issue('ROLLBACK_AUTHORITY_EXPIRED', 'expires_at'));
  }
  if (!sha256(value.receipt_sha256)
    || value.receipt_sha256 !== privateRuntimeRollbackReceiptDigest(value)) {
    errors.push(issue('ROLLBACK_AUTHORITY_DIGEST_MISMATCH', 'receipt_sha256'));
  }
  return result(errors, value);
}

export function validatePrivateRuntimeCohortActivationReceiptV2(value, {
  environmentId,
  configurationAuthorityPacketDigest,
  approvedProfileCohortDigest,
  cohortCount,
  deploymentCommitSha = null,
  vercelProjectReference,
  productBindingAttestationDigest,
  activationOwnerRef,
  rollbackOwnerRef,
  rollbackReceiptDigest,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(value, COHORT_ACTIVATION_FIELDS)) {
    return result([issue('ACTIVATION_AUTHORITY_REQUIRED', 'fields')]);
  }
  if (value.receipt_version !== PRIVATE_RUNTIME_COHORT_ACTIVATION_RECEIPT_VERSION
    || value.environment_id !== environmentId
    || value.configuration_authority_packet_digest !== configurationAuthorityPacketDigest
    || value.approved_profile_cohort_digest !== approvedProfileCohortDigest
    || value.cohort_count !== cohortCount
    || !/^[a-f0-9]{40}$/.test(deploymentCommitSha || '')
    || value.deployment_commit_sha !== deploymentCommitSha
    || value.vercel_project_reference !== vercelProjectReference
    || value.product_binding_attestation_digest !== productBindingAttestationDigest
    || value.activation_owner_ref !== activationOwnerRef
    || value.rollback_owner_ref !== rollbackOwnerRef
    || value.rollback_receipt_digest !== rollbackReceiptDigest) {
    errors.push(issue('ACTIVATION_AUTHORITY_MISMATCH', 'binding'));
  }
  if (!/^[a-f0-9]{40}$/.test(value.deployment_commit_sha)
    || !/^[a-f0-9]{40}$/.test(value.deployment_tree_sha)
    || !isOpaquePrivateRuntimeReference(value.vercel_project_reference)
    || !isOpaquePrivateRuntimeReference(value.rollback_receipt_ref)
    || !sha256(value.approved_profile_cohort_digest)
    || !sha256(value.product_binding_attestation_digest)
    || !sha256(value.rollback_receipt_digest)
    || !Number.isInteger(value.cohort_count)
    || value.cohort_count !== PRIVATE_RUNTIME_COHORT_ACTIVATION_COUNT
    || cohortCount !== PRIVATE_RUNTIME_COHORT_ACTIVATION_COUNT) {
    errors.push(issue('ACTIVATION_AUTHORITY_MISMATCH', 'identity'));
  }
  if (value.approved !== true
    || value.controlled_internal_beta !== true
    || value.private_live_only !== true
    || value.public_access !== false
    || value.source_default_off !== true
    || value.named_tester_scope !== 'EXACT_APPROVED_COHORT_ONLY'
    || value.production_customer_rollout !== false
    || value.emergency_disable_ready !== true) {
    errors.push(issue('ACTIVATION_AUTHORITY_REQUIRED', 'authority'));
  }
  if (!datesValid(value.issued_at, value.expires_at, nowMs)) {
    errors.push(issue('ACTIVATION_AUTHORITY_EXPIRED', 'expires_at'));
  }
  if (!sha256(value.receipt_sha256)
    || value.receipt_sha256 !== privateRuntimeActivationReceiptDigest(value)) {
    errors.push(issue('ACTIVATION_AUTHORITY_DIGEST_MISMATCH', 'receipt_sha256'));
  }
  return result(errors, value);
}

export function privateRuntimeLiveBindingContractFields() {
  return frozen({
    product_binding: PRODUCT_BINDING_FIELDS,
    business_engine: BUSINESS_ENGINE_FIELDS,
    subscription_runtime: SUBSCRIPTION_FIELDS,
    coach_connect_runtime: COACH_CONNECT_FIELDS,
    configuration_authority: AUTHORITY_PACKET_FIELDS,
    activation_receipt: ACTIVATION_FIELDS,
    cohort_activation_receipt: COHORT_ACTIVATION_FIELDS,
    rollback_receipt: ROLLBACK_FIELDS,
  });
}
