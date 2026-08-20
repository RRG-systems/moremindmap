import { hashCanonicalJson } from '../../../hashing.js';
import { validateConsentRecord } from '../../../consentPrivacy.js';
import { validateVerticalOperatingPolicy } from '../../../durableCore.js';
import { deepFreeze } from '../../../validation.js';
import {
  exactPrivateRuntimeScope,
  samePrivateRuntimeScope,
} from '../contracts.js';

export const PRIVATE_LIVE_PRODUCT_EXECUTION_BINDING_VERSION =
  'private-live-product-execution-binding-v1';
export const PRIVATE_LIVE_PRODUCT_EXECUTION_REFERENCE_VARIABLE =
  'MORE_PRIVATE_RUNTIME_PRODUCT_EXECUTION_BINDING_REF';

const FIELDS = Object.freeze([
  'binding_version',
  'environment_id',
  'configuration_authority_packet_sha256',
  'product_binding_attestation_sha256',
  'business_engine_execution_contract_sha256',
  'exact_scope',
  'exact_scope_hash',
  'approved_profile_ids',
  'execution_enabled',
  'source_default_off',
  'private_beta_only',
  'public_access',
  'persistence_mode',
  'append_only',
  'immutable_history',
  'destructive_updates',
  'transcript_persistence',
  'conversation_content_persistence',
  'product_store_connection_ref',
  'persistence_namespace_prefix',
  'vertical_operating_policy',
  'intervention_candidates',
  'support_by_slot',
  'market_context_graph',
  'authority_conflict_graph',
  'evidence_consent',
  'issued_at',
  'review_due_at',
  'binding_sha256',
]);
const SLOTS = Object.freeze([
  'CURRENT',
  'MOST_LIKELY_NEXT',
  'ALTERNATIVE_1',
  'ALTERNATIVE_2',
  'ALTERNATIVE_3',
]);
const RANKING_DIMENSIONS = Object.freeze([
  'expected_leverage',
  'probability_shift',
  'constraint_centrality',
  'user_goal_alignment',
  'behavioral_fit',
  'execution_feasibility',
  'financial_feasibility',
  'evidence_quality',
  'outcome_support',
  'time_to_signal',
  'reversibility',
  'downside_risk',
  'privacy_compliance_burden',
  'confidence',
]);

const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const reference = (value) => typeof value === 'string'
  && /^[A-Z][A-Z0-9_]{2,127}$/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const exactFields = (value) => object(value)
  && Object.keys(value).length === FIELDS.length
  && Object.keys(value).every((key) => FIELDS.includes(key));
const issue = (code, field) => Object.freeze({ code, field });
const result = (errors, value = null) => deepFreeze({
  valid: errors.length === 0,
  errors,
  value: errors.length === 0 ? structuredClone(value) : null,
});

export function privateLiveProductExecutionBindingDigest(value) {
  if (!object(value)) throw new TypeError('product execution binding must be an object');
  const copy = { ...value };
  delete copy.binding_sha256;
  return hashCanonicalJson(copy);
}

function validCandidates(candidates, tenantId) {
  return Array.isArray(candidates)
    && candidates.length >= 2
    && candidates.every((candidate) => object(candidate)
      && typeof candidate.intervention_id === 'string'
      && typeof candidate.template_id === 'string'
      && candidate.tenant_id === tenantId
      && typeof candidate.target_constraint === 'string'
      && typeof candidate.target_future_or_transition === 'string'
      && object(candidate.dimensions)
      && RANKING_DIMENSIONS.every((dimension) =>
        Number.isFinite(candidate.dimensions[dimension])
        && candidate.dimensions[dimension] >= 0
        && candidate.dimensions[dimension] <= 1));
}

function validSupportBySlot(value) {
  return object(value)
    && Object.keys(value).every((slot) => SLOTS.includes(slot))
    && Object.values(value).every((entry) => object(entry)
      && Object.values(entry).every((metric) =>
        Array.isArray(metric)
          ? metric.every((item) => typeof item === 'string')
          : Number.isFinite(metric)));
}

export function validatePrivateLiveProductExecutionBindingV1(value, {
  environmentId,
  configurationAuthorityPacketSha256,
  productBindingAttestation,
  nowMs = Date.now(),
} = {}) {
  const errors = [];
  if (!exactFields(value)) {
    return result([issue('PRIVATE_LIVE_PRODUCT_BINDING_INVALID', 'fields')]);
  }
  if (value.binding_version !== PRIVATE_LIVE_PRODUCT_EXECUTION_BINDING_VERSION) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_INVALID', 'binding_version'));
  }
  if (value.environment_id !== environmentId) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_MISMATCH', 'environment_id'));
  }
  if (!sha256(value.configuration_authority_packet_sha256)
    || value.configuration_authority_packet_sha256 !== configurationAuthorityPacketSha256) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_MISMATCH', 'configuration_authority_packet_sha256'));
  }
  if (!sha256(value.product_binding_attestation_sha256)
    || value.product_binding_attestation_sha256 !== productBindingAttestation?.binding_sha256) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_MISMATCH', 'product_binding_attestation_sha256'));
  }
  if (!sha256(value.business_engine_execution_contract_sha256)) {
    errors.push(issue('BUSINESS_ENGINE_EXECUTION_CONTRACT_DIGEST_REQUIRED', 'business_engine_execution_contract_sha256'));
  }
  if (!exactPrivateRuntimeScope(value.exact_scope)
    || !samePrivateRuntimeScope(value.exact_scope, productBindingAttestation?.exact_scope)
    || value.exact_scope_hash !== productBindingAttestation?.exact_scope_hash) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_MISMATCH', 'exact_scope'));
  }
  if (!Array.isArray(value.approved_profile_ids)
    || value.approved_profile_ids.length !== new Set(value.approved_profile_ids).size
    || value.approved_profile_ids.length === 0
    || value.approved_profile_ids.some((profileId) => typeof profileId !== 'string')
    || !value.approved_profile_ids.includes(value.exact_scope?.profile_id)) {
    errors.push(issue('APPROVED_PROFILE_ID_REQUIRED', 'approved_profile_ids'));
  }
  if (value.execution_enabled !== true
    || value.source_default_off !== true
    || value.private_beta_only !== true
    || value.public_access !== false) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_NOT_PRIVATE_BETA', 'activation'));
  }
  if (value.persistence_mode !== 'APPEND_ONLY_IMMUTABLE_V1'
    || value.append_only !== true
    || value.immutable_history !== true
    || value.destructive_updates !== false) {
    errors.push(issue('APPEND_ONLY_PERSISTENCE_REQUIRED', 'persistence_mode'));
  }
  if (value.transcript_persistence !== false
    || value.conversation_content_persistence !== false) {
    errors.push(issue('PRIVATE_CONTENT_PERSISTENCE_DENIED', 'transcript_persistence'));
  }
  if (!reference(value.product_store_connection_ref)) {
    errors.push(issue('PRODUCT_STORE_CONNECTION_REFERENCE_REQUIRED', 'product_store_connection_ref'));
  }
  if (typeof value.persistence_namespace_prefix !== 'string'
    || !/^more:private-live:product:[a-z0-9][a-z0-9:_-]{2,95}$/.test(value.persistence_namespace_prefix)
    || value.persistence_namespace_prefix.includes('qualification')
    || value.persistence_namespace_prefix.includes('security')) {
    errors.push(issue('PRODUCT_STORE_NAMESPACE_INVALID', 'persistence_namespace_prefix'));
  }
  const policy = validateVerticalOperatingPolicy(value.vertical_operating_policy);
  if (!policy.valid || value.vertical_operating_policy?.tenant_id !== value.exact_scope?.tenant_id) {
    errors.push(issue('VERTICAL_OPERATING_POLICY_INVALID', 'vertical_operating_policy'));
  }
  if (!validCandidates(value.intervention_candidates, value.exact_scope?.tenant_id)) {
    errors.push(issue('INTERVENTION_CANDIDATES_INVALID', 'intervention_candidates'));
  }
  if (!validSupportBySlot(value.support_by_slot)) {
    errors.push(issue('FUTURE_SUPPORT_INVALID', 'support_by_slot'));
  }
  if (!object(value.market_context_graph)
    || !Array.isArray(value.market_context_graph.indicator_nodes)) {
    errors.push(issue('MARKET_CONTEXT_INVALID', 'market_context_graph'));
  }
  if (!object(value.authority_conflict_graph)
    || !Array.isArray(value.authority_conflict_graph.conflicts)) {
    errors.push(issue('AUTHORITY_CONFLICT_GRAPH_INVALID', 'authority_conflict_graph'));
  }
  const consent = validateConsentRecord(value.evidence_consent);
  if (!consent.valid
    || value.evidence_consent?.tenant_id !== value.exact_scope?.tenant_id
    || value.evidence_consent?.subject_ref?.id !== value.exact_scope?.profile_id
    || value.evidence_consent?.status !== 'ACTIVE'
    || value.evidence_consent?.purpose !== 'business_assessment'
    || !value.evidence_consent?.scope?.includes('assessment')) {
    errors.push(issue('EVIDENCE_CONSENT_INVALID', 'evidence_consent'));
  }
  if (!timestamp(value.issued_at)
    || !timestamp(value.review_due_at)
    || Date.parse(value.issued_at) > nowMs
    || Date.parse(value.review_due_at) <= Date.parse(value.issued_at)
    || Date.parse(value.review_due_at) <= nowMs) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_EXPIRED', 'review_due_at'));
  }
  if (!sha256(value.binding_sha256)
    || value.binding_sha256 !== privateLiveProductExecutionBindingDigest(value)) {
    errors.push(issue('PRIVATE_LIVE_PRODUCT_BINDING_DIGEST_MISMATCH', 'binding_sha256'));
  }
  return result(errors, value);
}

export async function readPrivateLiveProductExecutionBindingV1({
  env,
  resolveReference,
  environmentId,
  configurationAuthorityPacketSha256,
  productBindingAttestation,
  nowMs = Date.now(),
} = {}) {
  const referenceName = env?.[PRIVATE_LIVE_PRODUCT_EXECUTION_REFERENCE_VARIABLE];
  if (typeof referenceName !== 'string' || typeof resolveReference !== 'function') {
    return deepFreeze({
      ok: false,
      allowed: false,
      code: 'PRIVATE_LIVE_PRODUCT_EXECUTION_UNCONFIGURED',
    });
  }
  try {
    const serialized = await resolveReference(referenceName, {
      purpose: PRIVATE_LIVE_PRODUCT_EXECUTION_REFERENCE_VARIABLE,
      secret: false,
    });
    if (typeof serialized !== 'string' || serialized.length > 262144) throw new TypeError();
    const parsed = JSON.parse(serialized);
    const validation = validatePrivateLiveProductExecutionBindingV1(parsed, {
      environmentId,
      configurationAuthorityPacketSha256,
      productBindingAttestation,
      nowMs,
    });
    return validation.valid
      ? deepFreeze({ ok: true, allowed: false, binding: validation.value })
      : deepFreeze({
        ok: false,
        allowed: false,
        code: validation.errors[0]?.code || 'PRIVATE_LIVE_PRODUCT_BINDING_INVALID',
        field: validation.errors[0]?.field || null,
      });
  } catch {
    return deepFreeze({
      ok: false,
      allowed: false,
      code: 'PRIVATE_LIVE_PRODUCT_BINDING_INVALID',
    });
  }
}
