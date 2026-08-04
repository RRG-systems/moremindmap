import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';

export const LIVING_CONVERSATION_PROVIDER_BINDING_VERSION =
  'living-conversation-provider-binding-v1';
export const LIVING_CONVERSATION_PROVIDER_REFERENCE_VARIABLE =
  'MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_BINDING_REF';
export const LIVING_CONVERSATION_PROVIDER_CREDENTIAL_REFERENCE =
  'MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_CREDENTIAL_VALUE';
export const LIVING_CONVERSATION_PROVIDER_RETENTION_MODES = Object.freeze([
  'ZERO_DATA_RETENTION',
  'STANDARD_ABUSE_MONITORING_STORE_FALSE',
]);

export function livingConversationProviderRetentionReceipt(mode) {
  if (mode === 'ZERO_DATA_RETENTION') return 'ZERO_DATA_RETENTION_ATTESTED';
  if (mode === 'STANDARD_ABUSE_MONITORING_STORE_FALSE') {
    return 'STANDARD_ABUSE_MONITORING_STORE_FALSE_ATTESTED';
  }
  return null;
}

const FIELDS = Object.freeze([
  'binding_version',
  'environment_id',
  'configuration_authority_packet_sha256',
  'product_binding_attestation_sha256',
  'enabled',
  'source_default_off',
  'private_beta_only',
  'public_access',
  'provider',
  'credential_ref',
  'model',
  'scope_mode',
  'exact_scope_hash',
  'approved_profile_cohort_sha256',
  'provider_data_retention_mode',
  'allowed_purposes',
  'timeout_ms',
  'max_output_tokens',
  'max_input_chars',
  'issued_at',
  'review_due_at',
  'binding_sha256',
]);

const object = (value) => Boolean(value && typeof value === 'object'
  && !Array.isArray(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const reference = (value) => typeof value === 'string'
  && /^[A-Z][A-Z0-9_]{2,127}$/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const exactFields = (value) => object(value)
  && Object.keys(value).length === FIELDS.length
  && Object.keys(value).every((key) => FIELDS.includes(key));
const frozen = (value) => deepFreeze(structuredClone(value));

export function livingConversationProviderBindingDigest(value) {
  if (!object(value)) throw new TypeError('conversation provider binding required');
  const copy = { ...value };
  delete copy.binding_sha256;
  return hashCanonicalJson(copy);
}

export function validateLivingConversationProviderBindingV1(value, {
  environmentId,
  configurationAuthorityPacketSha256,
  productBindingAttestation,
  approvedProfileCohort = null,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  const issue = (code, field) => errors.push({ code, field });
  if (!exactFields(value)) {
    return frozen({
      valid: false,
      errors: [{ code: 'LIVING_CONVERSATION_PROVIDER_BINDING_INVALID', field: 'fields' }],
      value: null,
    });
  }
  if (value.binding_version !== LIVING_CONVERSATION_PROVIDER_BINDING_VERSION) {
    issue('LIVING_CONVERSATION_PROVIDER_BINDING_INVALID', 'binding_version');
  }
  if (value.environment_id !== environmentId) {
    issue('LIVING_CONVERSATION_PROVIDER_BINDING_MISMATCH', 'environment_id');
  }
  if (!sha256(value.configuration_authority_packet_sha256)
    || value.configuration_authority_packet_sha256 !== configurationAuthorityPacketSha256) {
    issue('LIVING_CONVERSATION_PROVIDER_BINDING_MISMATCH', 'configuration_authority_packet_sha256');
  }
  if (!sha256(value.product_binding_attestation_sha256)
    || value.product_binding_attestation_sha256 !== productBindingAttestation?.binding_sha256) {
    issue('LIVING_CONVERSATION_PROVIDER_BINDING_MISMATCH', 'product_binding_attestation_sha256');
  }
  if (value.enabled !== true
    || value.source_default_off !== true
    || value.private_beta_only !== true
    || value.public_access !== false) {
    issue('LIVING_CONVERSATION_PROVIDER_NOT_PRIVATE_BETA', 'activation');
  }
  if (value.provider !== 'OPENAI'
    || value.credential_ref !== LIVING_CONVERSATION_PROVIDER_CREDENTIAL_REFERENCE
    || typeof value.model !== 'string'
    || !/^[a-zA-Z0-9._-]{2,128}$/.test(value.model)) {
    issue('LIVING_CONVERSATION_PROVIDER_BINDING_INVALID', 'provider');
  }
  const exactMode = approvedProfileCohort == null
    && value.scope_mode === 'EXACT_PROFILE'
    && value.exact_scope_hash === productBindingAttestation?.exact_scope_hash
    && value.approved_profile_cohort_sha256 == null;
  const cohortMode = approvedProfileCohort != null
    && value.scope_mode === 'APPROVED_PROFILE_COHORT'
    && value.exact_scope_hash == null
    && sha256(value.approved_profile_cohort_sha256)
    && value.approved_profile_cohort_sha256 === approvedProfileCohort.cohort_sha256;
  if (!exactMode && !cohortMode) {
    issue('LIVING_CONVERSATION_PROVIDER_SCOPE_DENIED', 'scope_mode');
  }
  if (!LIVING_CONVERSATION_PROVIDER_RETENTION_MODES
    .includes(value.provider_data_retention_mode)) {
    issue('LIVING_CONVERSATION_PROVIDER_RETENTION_DENIED', 'provider_data_retention_mode');
  }
  if (!Array.isArray(value.allowed_purposes)
    || value.allowed_purposes.length !== 1
    || value.allowed_purposes[0] !== 'CONVERSATION_PLAN_PROPOSAL') {
    issue('LIVING_CONVERSATION_PROVIDER_PURPOSE_DENIED', 'allowed_purposes');
  }
  if (!Number.isInteger(value.timeout_ms) || value.timeout_ms < 1_000
    || value.timeout_ms > 30_000
    || !Number.isInteger(value.max_output_tokens) || value.max_output_tokens < 256
    || value.max_output_tokens > 4_000
    || !Number.isInteger(value.max_input_chars) || value.max_input_chars < 8_000
    || value.max_input_chars > 64_000) {
    issue('LIVING_CONVERSATION_PROVIDER_BOUNDS_INVALID', 'limits');
  }
  if (!timestamp(value.issued_at)
    || !timestamp(value.review_due_at)
    || Date.parse(value.issued_at) > nowMs
    || Date.parse(value.review_due_at) <= Date.parse(value.issued_at)
    || Date.parse(value.review_due_at) <= nowMs) {
    issue('LIVING_CONVERSATION_PROVIDER_BINDING_EXPIRED', 'review_due_at');
  }
  if (!sha256(value.binding_sha256)
    || value.binding_sha256 !== livingConversationProviderBindingDigest(value)) {
    issue('LIVING_CONVERSATION_PROVIDER_BINDING_DIGEST_MISMATCH', 'binding_sha256');
  }
  return frozen({
    valid: errors.length === 0,
    errors,
    value: errors.length === 0 ? value : null,
  });
}

export async function readLivingConversationProviderBindingV1({
  env,
  resolveReference,
  environmentId,
  configurationAuthorityPacketSha256,
  productBindingAttestation,
  approvedProfileCohort = null,
  nowMs = Date.now(),
} = {}) {
  const referenceName = env?.[LIVING_CONVERSATION_PROVIDER_REFERENCE_VARIABLE];
  if (referenceName == null) {
    return frozen({
      ok: false,
      configured: false,
      code: 'LIVING_CONVERSATION_PROVIDER_UNCONFIGURED',
    });
  }
  if (!reference(referenceName) || typeof resolveReference !== 'function') {
    return frozen({
      ok: false,
      configured: true,
      code: 'LIVING_CONVERSATION_PROVIDER_BINDING_INVALID',
    });
  }
  try {
    const serialized = await resolveReference(referenceName, {
      purpose: LIVING_CONVERSATION_PROVIDER_REFERENCE_VARIABLE,
      secret: false,
    });
    if (typeof serialized !== 'string' || serialized.length > 32_768) throw new TypeError();
    const validation = validateLivingConversationProviderBindingV1(
      JSON.parse(serialized),
      {
        environmentId,
        configurationAuthorityPacketSha256,
        productBindingAttestation,
        approvedProfileCohort,
        nowMs,
      },
    );
    return validation.valid
      ? frozen({ ok: true, configured: true, binding: validation.value })
      : frozen({
          ok: false,
          configured: true,
          code: validation.errors[0]?.code
            || 'LIVING_CONVERSATION_PROVIDER_BINDING_INVALID',
          field: validation.errors[0]?.field || null,
        });
  } catch {
    return frozen({
      ok: false,
      configured: true,
      code: 'LIVING_CONVERSATION_PROVIDER_BINDING_INVALID',
    });
  }
}
