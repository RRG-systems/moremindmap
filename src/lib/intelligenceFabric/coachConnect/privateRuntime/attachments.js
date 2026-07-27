import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
  exactPrivateRuntimeScope,
  hashPrivateRuntimeScope,
  samePrivateRuntimeScope,
} from './contracts.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const opaque = (value) => typeof value === 'string'
  && value.length > 0
  && value.length <= 256
  && !value.includes('@')
  && !/\s/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function validatePrivateRuntimeAttachmentRequest(value) {
  const errors = [];
  const fields = [
    'request_version',
    'environment_id',
    'subscriber_subject_ref',
    'authenticated_session_ref',
    'capability_ref',
    'exact_scope',
    'requested_attachments',
    'correlation_id',
    'requested_at',
  ];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return frozen({ valid: false, errors: [{ code: 'ATTACHMENT_PARTIAL_FAILURE', field: '$' }] });
  }
  if (Object.keys(value).length !== fields.length || Object.keys(value).some((field) => !fields.includes(field))) {
    errors.push({ code: 'ATTACHMENT_PARTIAL_FAILURE', field: 'fields' });
  }
  if (value.request_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.attachmentRequest) {
    errors.push({ code: 'ATTACHMENT_PARTIAL_FAILURE', field: 'request_version' });
  }
  for (const field of [
    'environment_id',
    'subscriber_subject_ref',
    'authenticated_session_ref',
    'capability_ref',
    'correlation_id',
  ]) {
    if (!opaque(value[field])) errors.push({ code: 'ATTACHMENT_PARTIAL_FAILURE', field });
  }
  if (!exactPrivateRuntimeScope(value.exact_scope)) {
    errors.push({ code: 'ATTACHMENT_PARTIAL_FAILURE', field: 'exact_scope' });
  }
  if (!Array.isArray(value.requested_attachments)
    || value.requested_attachments.join(',') !== 'BUSINESS_ENGINE,SUBSCRIPTION_RUNTIME,COACH_CONNECT') {
    errors.push({ code: 'ATTACHMENT_PARTIAL_FAILURE', field: 'requested_attachments' });
  }
  if (!timestamp(value.requested_at)) errors.push({ code: 'ATTACHMENT_PARTIAL_FAILURE', field: 'requested_at' });
  return frozen({ valid: errors.length === 0, errors, value: errors.length ? null : value });
}

export function validateCanonicalBusinessEngineAttachmentPort(port) {
  let description = null;
  try {
    description = port?.describeCapability?.();
  } catch {
    description = null;
  }
  const valid = typeof port?.lookupCanonicalBusinessEngine === 'function'
    && description?.canonical_source_only === true
    && description?.read_only === true
    && description?.can_build_engine === false
    && description?.can_persist_engine === false
    && description?.production_connection === false;
  return frozen({ valid, description: valid ? description : null });
}

function validateCanonicalEngineRecord(record, scope) {
  if (!record
    || record.source !== 'CANONICAL_BUSINESS_ENGINE'
    || !opaque(record.business_engine_ref)
    || !opaque(record.business_engine_version)
    || !sha256(record.business_engine_contract_hash)
    || !samePrivateRuntimeScope(record.exact_scope, scope)
    || 'payload' in record
    || 'business_engine_contract' in record
    || 'profile_id_generated' in record
    || record.write_authorized === true) {
    return false;
  }
  return true;
}

export async function attachCanonicalBusinessEngine({
  port,
  request,
  authority,
  subjectReceipt,
  attachedAt,
}) {
  const requestValidation = validatePrivateRuntimeAttachmentRequest(request);
  if (!requestValidation.valid || authority?.allowed !== true) {
    return frozen({ ok: false, code: authority?.code || 'SESSION_ELEVATION_REQUIRED' });
  }
  if (subjectReceipt?.subject_receipt_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.subjectReceipt
    || subjectReceipt.subscriber_subject_ref !== request.subscriber_subject_ref
    || subjectReceipt.exact_scope_hash !== hashPrivateRuntimeScope(request.exact_scope)) {
    return frozen({ ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH' });
  }
  const portValidation = validateCanonicalBusinessEngineAttachmentPort(port);
  if (!portValidation.valid) return frozen({ ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND' });
  let lookup;
  try {
    lookup = await port.lookupCanonicalBusinessEngine(frozen(request.exact_scope));
  } catch {
    return frozen({ ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND' });
  }
  if (!lookup?.ok || !Array.isArray(lookup.engines) || lookup.engines.length === 0) {
    return frozen({ ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND' });
  }
  if (lookup.engines.length !== 1) {
    return frozen({ ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_AMBIGUOUS' });
  }
  const engine = lookup.engines[0];
  if (!validateCanonicalEngineRecord(engine, request.exact_scope)) {
    return frozen({ ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH' });
  }
  if (!timestamp(attachedAt)) return frozen({ ok: false, code: 'BUSINESS_ENGINE_ATTACHMENT_MISMATCH' });
  const attachmentId = `business_engine_attachment_${hashCanonicalJson({
    subscriber_subject_ref: request.subscriber_subject_ref,
    exact_scope_hash: hashPrivateRuntimeScope(request.exact_scope),
    business_engine_ref: engine.business_engine_ref,
    business_engine_version: engine.business_engine_version,
    business_engine_contract_hash: engine.business_engine_contract_hash,
  }).slice(0, 32)}`;
  return frozen({
    ok: true,
    receipt: {
      receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.businessEngineAttachment,
      attachment_id: attachmentId,
      subscriber_subject_ref: request.subscriber_subject_ref,
      exact_scope_hash: hashPrivateRuntimeScope(request.exact_scope),
      business_engine_ref: engine.business_engine_ref,
      business_engine_version: engine.business_engine_version,
      business_engine_contract_hash: engine.business_engine_contract_hash,
      source: 'CANONICAL_BUSINESS_ENGINE',
      read_authorized: true,
      write_authorized: false,
      duplicate_engine_created: false,
      attached_at: attachedAt,
    },
    inspection: {
      business_engine_count: 1,
      payload_retained: false,
      profile_id_changed: false,
      canonical_mutation_authority: false,
    },
  });
}

export const PRIVATE_RUNTIME_SUBSCRIPTION_INTERACTIONS = deepFreeze([
  'READ_CURRENT_STATE',
  'REQUEST_EVIDENCE_GAPS',
  'READ_BUSINESS_ENGINE',
  'READ_FIVE_FUTURES',
  'READ_ONE_MOVE',
  'REQUEST_EXPLANATION',
  'START_SESSION',
  'SUBMIT_TURN',
  'DECIDE_EXTRACTION',
]);

export function attachExistingSubscriptionRuntime({
  request,
  authority,
  businessEngineReceipt,
  entitlement,
  runtime,
  subscription,
  attachedAt,
}) {
  const requestValidation = validatePrivateRuntimeAttachmentRequest(request);
  if (!requestValidation.valid || authority?.allowed !== true) {
    return frozen({ ok: false, code: authority?.code || 'SESSION_ELEVATION_REQUIRED' });
  }
  if (businessEngineReceipt?.receipt_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.businessEngineAttachment
    || businessEngineReceipt.subscriber_subject_ref !== request.subscriber_subject_ref
    || businessEngineReceipt.exact_scope_hash !== hashPrivateRuntimeScope(request.exact_scope)
    || businessEngineReceipt.source !== 'CANONICAL_BUSINESS_ENGINE'
    || businessEngineReceipt.write_authorized !== false) {
    return frozen({ ok: false, code: 'SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH' });
  }
  if (entitlement?.access_type !== 'more_monthly_intelligence'
    || entitlement.status !== 'active'
    || entitlement.source !== 'temporary_internal_subscription_entitlement'
    || entitlement.temporary !== true
    || entitlement.billing_evidence !== false
    || entitlement.stripe_subscription_created !== false
    || entitlement.canonical_mutation_authority !== false
    || !timestamp(entitlement.expires_at)
    || Date.parse(entitlement.expires_at) <= Date.parse(attachedAt)) {
    return frozen({ ok: false, code: 'PRIVATE_ENTITLEMENT_REQUIRED' });
  }
  const contract = runtime?.inspect_contract?.();
  if (!contract
    || !Array.isArray(contract.commands)
    || !Array.isArray(contract.queries)
    || contract.public_routes?.length !== 0
    || contract.feature_flags_default_off !== true
    || subscription?.existing_runtime !== true
    || subscription?.production_namespace !== false
    || subscription?.customer_data !== false
    || subscription?.migration !== false
    || !samePrivateRuntimeScope(subscription?.exact_scope, request.exact_scope)
    || !opaque(subscription?.subscription_ref)
    || !opaque(subscription?.runtime_contract_version)) {
    return frozen({ ok: false, code: 'SUBSCRIPTION_RUNTIME_UNAVAILABLE' });
  }
  if (!timestamp(attachedAt)) return frozen({ ok: false, code: 'SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH' });
  const attachmentId = `subscription_runtime_attachment_${hashCanonicalJson({
    subject_ref: request.subscriber_subject_ref,
    session_ref: request.authenticated_session_ref,
    scope_hash: hashPrivateRuntimeScope(request.exact_scope),
    business_engine_attachment_ref: businessEngineReceipt.attachment_id,
    subscription_ref: subscription.subscription_ref,
  }).slice(0, 32)}`;
  return Object.freeze({
    ok: true,
    receipt: frozen({
      receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.subscriptionAttachment,
      attachment_id: attachmentId,
      subscriber_subject_ref: request.subscriber_subject_ref,
      authenticated_session_ref: request.authenticated_session_ref,
      exact_scope_hash: hashPrivateRuntimeScope(request.exact_scope),
      business_engine_attachment_ref: businessEngineReceipt.attachment_id,
      subscription_ref: subscription.subscription_ref,
      runtime_contract_version: subscription.runtime_contract_version,
      entitlement_source: 'temporary_internal_subscription_entitlement',
      allowed_interactions: [...PRIVATE_RUNTIME_SUBSCRIPTION_INTERACTIONS],
      paid_entitlement: false,
      stripe_authority: false,
      canonical_write_authority: false,
      attached_at: attachedAt,
    }),
    runtime_handle: runtime,
    isolation: frozen({
      production_namespace: false,
      customer_data: false,
      migration: false,
    }),
  });
}

export const PRIVATE_RUNTIME_COACH_CONNECT_CAPABILITIES = deepFreeze([
  'SUBSCRIBER_PROJECTION',
  'STRUCTURED_NON_VOICE_SESSION_WHEN_ALREADY_AUTHORIZED',
]);

export function attachExistingCoachConnectRuntime({
  request,
  authority,
  businessEngineReceipt,
  subscriptionAttachment,
  runtime,
  coachState,
  attachedAt,
}) {
  const requestValidation = validatePrivateRuntimeAttachmentRequest(request);
  if (!requestValidation.valid || authority?.allowed !== true) {
    return frozen({ ok: false, code: authority?.code || 'SESSION_ELEVATION_REQUIRED' });
  }
  const subscriptionReceipt = subscriptionAttachment?.receipt;
  if (businessEngineReceipt?.receipt_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.businessEngineAttachment
    || subscriptionReceipt?.receipt_version !== PRIVATE_RUNTIME_CONTRACT_VERSIONS.subscriptionAttachment
    || businessEngineReceipt.subscriber_subject_ref !== request.subscriber_subject_ref
    || subscriptionReceipt.subscriber_subject_ref !== request.subscriber_subject_ref
    || businessEngineReceipt.exact_scope_hash !== hashPrivateRuntimeScope(request.exact_scope)
    || subscriptionReceipt.exact_scope_hash !== hashPrivateRuntimeScope(request.exact_scope)
    || subscriptionReceipt.business_engine_attachment_ref !== businessEngineReceipt.attachment_id
    || subscriptionReceipt.authenticated_session_ref !== request.authenticated_session_ref) {
    return frozen({ ok: false, code: 'COACH_CONNECT_ATTACHMENT_MISMATCH' });
  }
  const inspection = runtime?.inspect?.();
  if (!inspection
    || inspection.one_business_engine !== true
    || inspection.second_business_engine !== false
    || inspection.live_billing !== false
    || inspection.live_provider !== false
    || inspection.public_routes?.length !== 0
    || coachState?.existing_runtime !== true
    || coachState?.production_persistence !== false
    || coachState?.transcript_persistence !== false
    || coachState?.live_model_provider !== false
    || coachState?.live_media_provider !== false
    || coachState?.stripe !== false
    || !samePrivateRuntimeScope(coachState?.exact_scope, request.exact_scope)
    || !opaque(coachState?.runtime_ref)
    || !timestamp(attachedAt)) {
    return frozen({ ok: false, code: 'COACH_CONNECT_STATE_MISSING' });
  }
  const attachmentId = `coach_connect_attachment_${hashCanonicalJson({
    subject_ref: request.subscriber_subject_ref,
    scope_hash: hashPrivateRuntimeScope(request.exact_scope),
    business_engine_attachment_ref: businessEngineReceipt.attachment_id,
    subscription_attachment_ref: subscriptionReceipt.attachment_id,
    runtime_ref: coachState.runtime_ref,
  }).slice(0, 32)}`;
  return Object.freeze({
    ok: true,
    receipt: frozen({
      receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.coachConnectAttachment,
      attachment_id: attachmentId,
      subscriber_subject_ref: request.subscriber_subject_ref,
      exact_scope_hash: hashPrivateRuntimeScope(request.exact_scope),
      business_engine_attachment_ref: businessEngineReceipt.attachment_id,
      subscription_runtime_attachment_ref: subscriptionReceipt.attachment_id,
      coach_connect_runtime_ref: coachState.runtime_ref,
      allowed_capabilities: [...PRIVATE_RUNTIME_COACH_CONNECT_CAPABILITIES],
      live_auth_provider: false,
      live_billing: false,
      live_model_provider: false,
      live_voice_video: false,
      transcript_persistence: false,
      canonical_mutation_authority: false,
      second_business_engine: false,
      attached_at: attachedAt,
    }),
    runtime_handle: runtime,
    coach_state_handle: coachState,
    inspection: frozen({
      business_engine_count: 1,
      existing_runtime: true,
      private_coach_content_exposed: false,
      production_persistence: false,
      stripe: false,
    }),
  });
}
