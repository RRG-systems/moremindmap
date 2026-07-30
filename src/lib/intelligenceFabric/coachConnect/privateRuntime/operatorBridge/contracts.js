import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { canonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  exactPrivateRuntimeScope,
  hashPrivateRuntimeScope,
  isOpaquePrivateRuntimeReference,
  samePrivateRuntimeScope,
} from '../contracts.js';

export const SUBDEV1_OPERATOR_CONTEXT_VERSION = 'subdev1-operator-context-v1';
export const SUBDEV1_PROFILE_RECORD_VERSION = 'subdev1-canonical-profile-record-v1';
export const SUBDEV1_PROFILE_RECEIPT_VERSION = 'subdev1-profile-scope-receipt-v1';
export const SUBDEV1_OPERATOR_CAPABILITY_SCOPE = 'SUBSCRIPTION_PRIVATE_BETA';
export const SUBDEV1_PROFILE_CONSENT_PURPOSE =
  'SUBSCRIPTION_PRIVATE_BETA_OPERATOR_ACCESS';
export const SUBDEV1_OPERATOR_ALLOWED_ACTIONS = deepFreeze([
  'SELECT_PROFILE',
  'OPEN_SUBSCRIPTION',
  'SUBSCRIPTION_READ',
  'SUBSCRIPTION_INTERACTION',
]);
export const SUBDEV1_OPERATOR_CONTEXT_STATES = deepFreeze([
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'CLEARED',
]);
export const SUBDEV1_PROFILE_STATES = deepFreeze([
  'NO_PROFILE',
  'RESOLUTION_PENDING',
  'PROFILE_ACTIVE',
  'RESOLUTION_DENIED',
  'PROFILE_CLEARED',
]);

const CONTEXT_FIELDS = deepFreeze([
  'context_version',
  'context_id',
  'token_hash',
  'environment_id',
  'browser_binding_hash',
  'capability_scope',
  'allowed_actions',
  'issued_at',
  'not_before',
  'expires_at',
  'status',
  'revoked_at',
  'revocation_reason',
  'profile_state',
  'profile_generation',
  'active_profile',
  'stripe_authority',
  'billing_authority',
  'coach_authority',
  'canonical_identity_authority',
  'canonical_mutation_authority',
  'deployment_authority',
  'environment_authority',
  'provider_authority',
  'integrity_digest',
]);

const PROFILE_RECORD_FIELDS = deepFreeze([
  'record_version',
  'profile_id',
  'subscriber_subject_ref',
  'exact_scope',
  'profile_revision',
  'consent_ref',
  'consent_purpose',
  'consent_status',
  'provenance',
]);

const PROFILE_RECEIPT_FIELDS = deepFreeze([
  'receipt_version',
  'profile_id',
  'subscriber_subject_ref',
  'exact_scope',
  'exact_scope_hash',
  'profile_revision',
  'consent_ref',
  'consent_purpose',
  'consent_status',
  'provenance',
  'resolved_at',
  'profile_generation',
  'receipt_digest',
]);

const PROVENANCE_FIELDS = deepFreeze(['source', 'record_ref']);
const PROVENANCE_SOURCES = deepFreeze([
  'CANONICAL_PROFILE_REPOSITORY',
  'SYNTHETIC_ISOLATED_FIXTURE',
]);

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactFields = (value, fields) => object(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const frozen = (value) => deepFreeze(structuredClone(value));
const issue = (code, field) => ({ code, field });
const validation = (errors, value = null) => frozen({
  valid: errors.length === 0,
  errors,
  value: errors.length === 0 ? value : null,
});

function signingKey(value) {
  return typeof value === 'string' && value.length >= 32 ? value : null;
}

function hmac(value, secret, domain) {
  const key = signingKey(secret);
  if (!key) return null;
  return crypto.createHmac('sha256', key)
    .update(canonicalJson({ domain, value }))
    .digest('hex');
}

function safeEqual(left, right) {
  if (!sha256(left) || !sha256(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function without(value, field) {
  const copy = { ...value };
  delete copy[field];
  return copy;
}

function validProvenance(value) {
  return exactFields(value, PROVENANCE_FIELDS)
    && PROVENANCE_SOURCES.includes(value.source)
    && isOpaquePrivateRuntimeReference(value.record_ref);
}

export function subdev1OperatorContextDigest(value, signingSecret) {
  return hmac(without(value, 'integrity_digest'), signingSecret, 'subdev1_operator_context_v1');
}

export function subdev1ProfileReceiptDigest(value, signingSecret) {
  return hmac(without(value, 'receipt_digest'), signingSecret, 'subdev1_profile_receipt_v1');
}

export function validateSubdev1CanonicalProfileRecord(value) {
  const errors = [];
  if (!exactFields(value, PROFILE_RECORD_FIELDS)) {
    return validation([issue('PROFILE_SCOPE_INVALID', 'fields')]);
  }
  if (value.record_version !== SUBDEV1_PROFILE_RECORD_VERSION) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'record_version'));
  }
  if (!isOpaquePrivateRuntimeReference(value.profile_id)
    || !/^mm-\d{8}-[a-z0-9]{8}$/.test(value.profile_id)) {
    errors.push(issue('PROFILE_ID_INVALID', 'profile_id'));
  }
  if (!isOpaquePrivateRuntimeReference(value.subscriber_subject_ref)) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'subscriber_subject_ref'));
  }
  if (!exactPrivateRuntimeScope(value.exact_scope)
    || value.exact_scope?.profile_id !== value.profile_id) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'exact_scope'));
  }
  if (!isOpaquePrivateRuntimeReference(value.profile_revision)) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'profile_revision'));
  }
  if (!isOpaquePrivateRuntimeReference(value.consent_ref)
    || value.consent_purpose !== SUBDEV1_PROFILE_CONSENT_PURPOSE
    || value.consent_status !== 'ACTIVE') {
    errors.push(issue('PROFILE_CONSENT_REQUIRED', 'consent'));
  }
  if (!validProvenance(value.provenance)) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'provenance'));
  }
  return validation(errors, value);
}

export function validateSubdev1ProfileReceipt(value, {
  signingSecret = null,
  expectedProfileId = null,
  expectedScope = null,
  expectedGeneration = null,
} = {}) {
  const errors = [];
  if (!exactFields(value, PROFILE_RECEIPT_FIELDS)) {
    return validation([issue('PROFILE_RECEIPT_STALE', 'fields')]);
  }
  if (value.receipt_version !== SUBDEV1_PROFILE_RECEIPT_VERSION) {
    errors.push(issue('PROFILE_RECEIPT_STALE', 'receipt_version'));
  }
  if (!isOpaquePrivateRuntimeReference(value.profile_id)
    || !/^mm-\d{8}-[a-z0-9]{8}$/.test(value.profile_id)) {
    errors.push(issue('PROFILE_ID_INVALID', 'profile_id'));
  }
  if (!isOpaquePrivateRuntimeReference(value.subscriber_subject_ref)
    || !isOpaquePrivateRuntimeReference(value.profile_revision)
    || !isOpaquePrivateRuntimeReference(value.consent_ref)) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'identity'));
  }
  if (!exactPrivateRuntimeScope(value.exact_scope)
    || value.exact_scope.profile_id !== value.profile_id
    || !sha256(value.exact_scope_hash)
    || value.exact_scope_hash !== hashPrivateRuntimeScope(value.exact_scope)) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'exact_scope'));
  }
  if (value.consent_purpose !== SUBDEV1_PROFILE_CONSENT_PURPOSE
    || value.consent_status !== 'ACTIVE') {
    errors.push(issue('PROFILE_CONSENT_REQUIRED', 'consent_status'));
  }
  if (!validProvenance(value.provenance) || !timestamp(value.resolved_at)) {
    errors.push(issue('PROFILE_SCOPE_INVALID', 'provenance'));
  }
  if (!Number.isInteger(value.profile_generation) || value.profile_generation < 1) {
    errors.push(issue('PROFILE_RECEIPT_STALE', 'profile_generation'));
  }
  const expectedDigest = subdev1ProfileReceiptDigest(value, signingSecret);
  if (!safeEqual(value.receipt_digest, expectedDigest)) {
    errors.push(issue('PROFILE_RECEIPT_STALE', 'receipt_digest'));
  }
  if (expectedProfileId != null && value.profile_id !== expectedProfileId) {
    errors.push(issue('PROFILE_RECEIPT_STALE', 'profile_id'));
  }
  if (expectedScope != null && !samePrivateRuntimeScope(value.exact_scope, expectedScope)) {
    errors.push(issue('PROFILE_RECEIPT_STALE', 'exact_scope'));
  }
  if (expectedGeneration != null && value.profile_generation !== expectedGeneration) {
    errors.push(issue('PROFILE_RECEIPT_STALE', 'profile_generation'));
  }
  return validation(errors, value);
}

export function createSubdev1ProfileReceipt({
  record,
  profileGeneration,
  resolvedAt,
  signingSecret,
}) {
  const recordValidation = validateSubdev1CanonicalProfileRecord(record);
  if (!recordValidation.valid
    || !Number.isInteger(profileGeneration)
    || profileGeneration < 1
    || !timestamp(resolvedAt)
    || !signingKey(signingSecret)) {
    return frozen({ ok: false, code: recordValidation.errors?.[0]?.code || 'PROFILE_SCOPE_INVALID' });
  }
  const receipt = {
    receipt_version: SUBDEV1_PROFILE_RECEIPT_VERSION,
    profile_id: record.profile_id,
    subscriber_subject_ref: record.subscriber_subject_ref,
    exact_scope: structuredClone(record.exact_scope),
    exact_scope_hash: hashPrivateRuntimeScope(record.exact_scope),
    profile_revision: record.profile_revision,
    consent_ref: record.consent_ref,
    consent_purpose: record.consent_purpose,
    consent_status: record.consent_status,
    provenance: structuredClone(record.provenance),
    resolved_at: resolvedAt,
    profile_generation: profileGeneration,
    receipt_digest: null,
  };
  receipt.receipt_digest = subdev1ProfileReceiptDigest(receipt, signingSecret);
  const checked = validateSubdev1ProfileReceipt(receipt, {
    signingSecret,
    expectedGeneration: profileGeneration,
  });
  return checked.valid
    ? frozen({ ok: true, receipt })
    : frozen({ ok: false, code: checked.errors[0]?.code || 'PROFILE_SCOPE_INVALID' });
}

export function validateSubdev1OperatorContext(value, {
  signingSecret = null,
  environmentId = null,
  browserBindingHash = null,
  tokenHash = null,
  action = null,
  now = null,
  requireProfile = false,
  suppliedProfileReceipt = null,
} = {}) {
  const errors = [];
  if (!exactFields(value, CONTEXT_FIELDS)) {
    return validation([issue('OPERATOR_CONTEXT_INVALID', 'fields')]);
  }
  if (value.context_version !== SUBDEV1_OPERATOR_CONTEXT_VERSION
    || !isOpaquePrivateRuntimeReference(value.context_id)
    || !sha256(value.token_hash)
    || !isOpaquePrivateRuntimeReference(value.environment_id)
    || !sha256(value.browser_binding_hash)
    || value.capability_scope !== SUBDEV1_OPERATOR_CAPABILITY_SCOPE) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'identity'));
  }
  if (!Array.isArray(value.allowed_actions)
    || value.allowed_actions.length !== SUBDEV1_OPERATOR_ALLOWED_ACTIONS.length
    || new Set(value.allowed_actions).size !== value.allowed_actions.length
    || value.allowed_actions.some((item) => !SUBDEV1_OPERATOR_ALLOWED_ACTIONS.includes(item))) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'allowed_actions'));
  }
  if (!timestamp(value.issued_at)
    || !timestamp(value.not_before)
    || !timestamp(value.expires_at)
    || Date.parse(value.not_before) < Date.parse(value.issued_at)
    || Date.parse(value.expires_at) <= Date.parse(value.issued_at)) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'time'));
  }
  if (!SUBDEV1_OPERATOR_CONTEXT_STATES.includes(value.status)) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'status'));
  }
  if ((value.status === 'REVOKED' || value.status === 'CLEARED')
    && (!timestamp(value.revoked_at) || !isOpaquePrivateRuntimeReference(value.revocation_reason))) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'revocation'));
  }
  if ((value.status === 'ACTIVE' || value.status === 'EXPIRED')
    && (value.revoked_at !== null || value.revocation_reason !== null)) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'revocation'));
  }
  if (!SUBDEV1_PROFILE_STATES.includes(value.profile_state)
    || !Number.isInteger(value.profile_generation)
    || value.profile_generation < 0) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'profile_state'));
  }
  if (value.profile_state === 'PROFILE_ACTIVE') {
    const profile = validateSubdev1ProfileReceipt(value.active_profile, {
      signingSecret,
      expectedGeneration: value.profile_generation,
    });
    if (!profile.valid) errors.push(issue('PROFILE_RECEIPT_STALE', 'active_profile'));
  } else if (value.active_profile !== null) {
    errors.push(issue('PROFILE_RECEIPT_STALE', 'active_profile'));
  }
  for (const field of [
    'stripe_authority',
    'billing_authority',
    'coach_authority',
    'canonical_identity_authority',
    'canonical_mutation_authority',
    'deployment_authority',
    'environment_authority',
    'provider_authority',
  ]) {
    if (value[field] !== false) errors.push(issue('OPERATOR_ACTION_DENIED', field));
  }
  const expectedDigest = subdev1OperatorContextDigest(value, signingSecret);
  if (!safeEqual(value.integrity_digest, expectedDigest)) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'integrity_digest'));
  }
  if (environmentId != null && value.environment_id !== environmentId) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'environment_id'));
  }
  if (browserBindingHash != null && value.browser_binding_hash !== browserBindingHash) {
    errors.push(issue('OPERATOR_BROWSER_BINDING_INVALID', 'browser_binding_hash'));
  }
  if (tokenHash != null && value.token_hash !== tokenHash) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'token_hash'));
  }
  if (action != null && !value.allowed_actions.includes(action)) {
    errors.push(issue('OPERATOR_ACTION_DENIED', 'action'));
  }
  if (value.status === 'EXPIRED'
    || (Number.isFinite(now) && timestamp(value.expires_at) && Date.parse(value.expires_at) <= now)) {
    errors.push(issue('OPERATOR_CONTEXT_EXPIRED', 'expires_at'));
  } else if (value.status === 'REVOKED' || value.status === 'CLEARED') {
    errors.push(issue('OPERATOR_CONTEXT_REVOKED', 'status'));
  } else if (Number.isFinite(now)
    && timestamp(value.not_before)
    && Date.parse(value.not_before) > now) {
    errors.push(issue('OPERATOR_CONTEXT_INVALID', 'not_before'));
  }
  if (requireProfile) {
    if (value.profile_state !== 'PROFILE_ACTIVE' || !value.active_profile) {
      errors.push(issue('PROFILE_RESOLUTION_DENIED', 'active_profile'));
    } else {
      const supplied = validateSubdev1ProfileReceipt(suppliedProfileReceipt, {
        signingSecret,
        expectedProfileId: value.active_profile.profile_id,
        expectedScope: value.active_profile.exact_scope,
        expectedGeneration: value.profile_generation,
      });
      if (!supplied.valid
        || suppliedProfileReceipt.receipt_digest !== value.active_profile.receipt_digest) {
        errors.push(issue('PROFILE_RECEIPT_STALE', 'supplied_profile_receipt'));
      }
    }
  }
  return validation(errors, value);
}

export function createSubdev1OperatorContext({
  contextId,
  tokenHash,
  environmentId,
  browserBindingHash,
  issuedAt,
  expiresAt,
  signingSecret,
}) {
  const context = {
    context_version: SUBDEV1_OPERATOR_CONTEXT_VERSION,
    context_id: contextId,
    token_hash: tokenHash,
    environment_id: environmentId,
    browser_binding_hash: browserBindingHash,
    capability_scope: SUBDEV1_OPERATOR_CAPABILITY_SCOPE,
    allowed_actions: [...SUBDEV1_OPERATOR_ALLOWED_ACTIONS],
    issued_at: issuedAt,
    not_before: issuedAt,
    expires_at: expiresAt,
    status: 'ACTIVE',
    revoked_at: null,
    revocation_reason: null,
    profile_state: 'NO_PROFILE',
    profile_generation: 0,
    active_profile: null,
    stripe_authority: false,
    billing_authority: false,
    coach_authority: false,
    canonical_identity_authority: false,
    canonical_mutation_authority: false,
    deployment_authority: false,
    environment_authority: false,
    provider_authority: false,
    integrity_digest: null,
  };
  context.integrity_digest = subdev1OperatorContextDigest(context, signingSecret);
  const checked = validateSubdev1OperatorContext(context, {
    signingSecret,
    environmentId,
    browserBindingHash,
    tokenHash,
  });
  return checked.valid
    ? frozen({ ok: true, context })
    : frozen({ ok: false, code: checked.errors[0]?.code || 'OPERATOR_CONTEXT_INVALID' });
}

export function withSubdev1ContextIntegrity(context, signingSecret) {
  const value = { ...structuredClone(context), integrity_digest: null };
  value.integrity_digest = subdev1OperatorContextDigest(value, signingSecret);
  return frozen(value);
}

export function subdev1OperatorContractFields() {
  return frozen({
    context: CONTEXT_FIELDS,
    profile_record: PROFILE_RECORD_FIELDS,
    profile_receipt: PROFILE_RECEIPT_FIELDS,
    provenance: PROVENANCE_FIELDS,
  });
}
