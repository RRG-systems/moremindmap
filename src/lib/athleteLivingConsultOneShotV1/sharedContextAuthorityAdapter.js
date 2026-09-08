import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { createProposalDecision, validateGovernedChangeProposal } from '../subscriptionV1/afw05/contracts.js';
import {
  ATHLETE_DOMAIN,
  assertAthletePresentationSafePayloadV1,
  validateAthleteDomainAdapterV1,
  validateAthleteLivingRelationshipScopeV1,
} from './athleteDomainAdapter.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9][a-z0-9:_-]{7,159}$/u;
const ROOMS = new Set(['HOME', 'YOU', 'YOUR_SPORT', 'PLAN']);
const SOURCE_KINDS = new Set(['ATHLETE_BOS', 'ATHLETE_APA', 'ATHLETE_LIVING_MAP']);
const SOURCE_CLASSES = new Set(['ATHLETE_SELF_REPORT', 'ATHLETE_REPORT', 'INSTRUCTOR_REPORT', 'INSTRUCTOR_OBSERVATION', 'SHARED_AGREEMENT', 'OBJECTIVE_RECORD', 'BOUNDED_INFERENCE', 'MISSING']);
const EPISTEMIC = new Set(['KNOWN', 'REPORTED', 'OBSERVED', 'MEASURED', 'AGREED', 'INFERRED', 'UNCERTAIN', 'MISSING', 'CONTRADICTED']);
const ACTIONS = new Set(['READ_SHARED_CONTEXT', 'PROPOSE_SHARED_PLAN', 'CONFIRM_SHARED_PLAN']);
const PURPOSE = 'ATHLETE_LIVING_CONSULT_SHARED';

export const ATHLETE_SHARED_CONTEXT_GRANT_CONTRACT = 'athlete_shared_context_grant_v1';
export const ATHLETE_SHARED_CONTEXT_PROJECTION_CONTRACT = 'athlete_shared_context_projection_v1';
export const ATHLETE_SHARED_CONFIRMATION_CONTRACT = 'athlete_shared_human_confirmation_v1';
export const ATHLETE_SHARED_QUORUM_RECEIPT_CONTRACT = 'athlete_shared_quorum_authority_receipt_v1';
export const ATHLETE_SHARED_CONTEXT_PURPOSE = PURPOSE;

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, expected) {
  return isObject(value)
    && Object.keys(value).length === expected.length
    && expected.every((key) => Object.hasOwn(value, key));
}

function validId(value) {
  return typeof value === 'string' && ID.test(value);
}

function iso(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new TypeError('ATHLETE_SHARED_CONTEXT_TIMESTAMP_INVALID');
  return new Date(value).toISOString();
}

function hashWithout(value, field) {
  const unsigned = clone(value);
  delete unsigned[field];
  return hashCanonicalJson(unsigned);
}

function uniqueSortedStrings(values, predicate = validId) {
  if (!Array.isArray(values) || values.length < 1 || values.some((value) => !predicate(value))) throw new TypeError('ATHLETE_SHARED_CONTEXT_LIST_INVALID');
  return [...new Set(values)].sort();
}

function publicDenied(code = 'ATHLETE_SHARED_CONTEXT_DENIED') {
  return deepFreeze({ ok: false, code, shared_objects: [], private_object_existence_disclosed: false });
}

function validateRelationship(relationship, scope) {
  return exactKeys(relationship, ['relationship_id', 'athlete_actor_id', 'instructor_actor_id', 'synthetic_only'])
    && validId(relationship.relationship_id)
    && validId(relationship.athlete_actor_id)
    && validId(relationship.instructor_actor_id)
    && relationship.relationship_id === scope.relationship_id
    && relationship.athlete_actor_id === scope.subject_id
    && relationship.synthetic_only === true;
}

function validateArtifactBinding(binding) {
  return exactKeys(binding, ['source_kind', 'artifact_id', 'artifact_version', 'content_hash'])
    && SOURCE_KINDS.has(binding?.source_kind)
    && validId(binding?.artifact_id)
    && typeof binding?.artifact_version === 'string' && binding.artifact_version.length > 0
    && HASH.test(binding?.content_hash || '');
}

function validateSharedObject(object, grantBindings) {
  const keys = ['object_id', 'source_binding', 'source_class', 'epistemic_status', 'presentation', 'evidence_refs', 'observed_at', 'presentation_safe'];
  if (Object.hasOwn(object || {}, 'page_context_refs')) keys.push('page_context_refs');
  if (!exactKeys(object, keys) || !validId(object.object_id) || !validateArtifactBinding(object.source_binding)
    || !SOURCE_CLASSES.has(object.source_class) || !EPISTEMIC.has(object.epistemic_status)
    || !isObject(object.presentation) || !Array.isArray(object.evidence_refs)
    || object.evidence_refs.some((entry) => !validId(entry)) || object.presentation_safe !== true) return false;
  if (object.page_context_refs != null && (!Array.isArray(object.page_context_refs)
    || object.page_context_refs.some((entry) => typeof entry !== 'string' || !entry.trim() || entry.length > 160))) return false;
  if (object.observed_at != null && !Number.isFinite(Date.parse(object.observed_at))) return false;
  if (!grantBindings.some((binding) => hashCanonicalJson(binding) === hashCanonicalJson(object.source_binding))) return false;
  try { assertAthletePresentationSafePayloadV1(object.presentation); } catch { return false; }
  return true;
}

export function createAthleteSharedContextGrantV1({
  scope,
  relationship,
  source_artifact_bindings,
  allowed_object_ids,
  allowed_actions = ['READ_SHARED_CONTEXT', 'PROPOSE_SHARED_PLAN', 'CONFIRM_SHARED_PLAN'],
  purpose = PURPOSE,
  audience = ['ATHLETE', 'INSTRUCTOR'],
  permission_version = 1,
  granted_at,
  expires_at,
  granted_by,
}) {
  const scopeValidation = validateAthleteLivingRelationshipScopeV1(scope);
  if (!scopeValidation.valid || !validateRelationship(relationship, scope)) throw new TypeError('ATHLETE_SHARED_CONTEXT_SCOPE_OR_RELATIONSHIP_INVALID');
  if (!Array.isArray(source_artifact_bindings) || source_artifact_bindings.length < 1 || source_artifact_bindings.some((binding) => !validateArtifactBinding(binding))) throw new TypeError('ATHLETE_SHARED_CONTEXT_SOURCE_BINDING_INVALID');
  const objectIds = uniqueSortedStrings(allowed_object_ids);
  const actions = uniqueSortedStrings(allowed_actions, (value) => ACTIONS.has(value));
  const audiences = uniqueSortedStrings(audience, (value) => ['ATHLETE', 'INSTRUCTOR'].includes(value));
  if (audiences.join('|') !== 'ATHLETE|INSTRUCTOR' || purpose !== PURPOSE) throw new TypeError('ATHLETE_SHARED_CONTEXT_AUDIENCE_OR_PURPOSE_INVALID');
  if (!Number.isInteger(permission_version) || permission_version < 1) throw new TypeError('ATHLETE_SHARED_CONTEXT_PERMISSION_VERSION_INVALID');
  if (granted_by?.actor_role !== 'ATHLETE' || granted_by?.actor_ref !== relationship.athlete_actor_id) throw new TypeError('ATHLETE_SHARED_CONTEXT_ATHLETE_GRANT_REQUIRED');
  const grantedAt = iso(granted_at);
  const expiresAt = iso(expires_at);
  if (Date.parse(expiresAt) <= Date.parse(grantedAt)) throw new TypeError('ATHLETE_SHARED_CONTEXT_EXPIRY_INVALID');
  const bindingList = clone(source_artifact_bindings).sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
  const identity = { scope_hash: scope.scope_hash, relationship_id: relationship.relationship_id, purpose, permission_version, allowed_object_ids: objectIds, source_artifact_bindings: bindingList };
  const body = {
    contract_id: ATHLETE_SHARED_CONTEXT_GRANT_CONTRACT,
    schema_version: '1.0.0',
    grant_id: `athlete_grant_${hashCanonicalJson(identity).slice(0, 24)}`,
    domain: ATHLETE_DOMAIN,
    domain_scope_hash: scope.scope_hash,
    relationship: clone(relationship),
    purpose,
    audience: audiences,
    source_artifact_bindings: bindingList,
    allowed_object_ids: objectIds,
    allowed_actions: actions,
    permission_version,
    state: 'ACTIVE',
    granted_at: grantedAt,
    expires_at: expiresAt,
    revoked_at: null,
    granted_by: clone(granted_by),
    synthetic_only: true,
    private_object_existence_disclosure: false,
  };
  return deepFreeze({ ...body, grant_hash: hashCanonicalJson(body) });
}

export function validateAthleteSharedContextGrantV1(grant, { scope, relationship, purpose = PURPOSE, as_of_at } = {}) {
  const errors = [];
  if (grant?.contract_id !== ATHLETE_SHARED_CONTEXT_GRANT_CONTRACT || grant?.schema_version !== '1.0.0'
    || grant?.domain !== ATHLETE_DOMAIN || grant?.synthetic_only !== true
    || grant?.private_object_existence_disclosure !== false) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_CONTRACT_INVALID');
  if (scope && (grant?.domain_scope_hash !== scope.scope_hash || !validateRelationship(grant?.relationship, scope))) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_SCOPE_DENIED');
  if (relationship && hashCanonicalJson(grant?.relationship) !== hashCanonicalJson(relationship)) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_RELATIONSHIP_DENIED');
  if (grant?.purpose !== purpose || grant?.audience?.join('|') !== 'ATHLETE|INSTRUCTOR') errors.push('ATHLETE_SHARED_CONTEXT_GRANT_PURPOSE_DENIED');
  if (!Array.isArray(grant?.source_artifact_bindings) || grant.source_artifact_bindings.some((binding) => !validateArtifactBinding(binding))) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_SOURCE_INVALID');
  try {
    uniqueSortedStrings(grant?.allowed_object_ids);
    uniqueSortedStrings(grant?.allowed_actions, (value) => ACTIONS.has(value));
  } catch { errors.push('ATHLETE_SHARED_CONTEXT_GRANT_ALLOWLIST_INVALID'); }
  if (grant?.granted_by?.actor_role !== 'ATHLETE' || grant?.granted_by?.actor_ref !== grant?.relationship?.athlete_actor_id) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_OWNER_INVALID');
  if (!Number.isInteger(grant?.permission_version) || grant.permission_version < 1
    || !Number.isFinite(Date.parse(grant?.granted_at)) || !Number.isFinite(Date.parse(grant?.expires_at))
    || Date.parse(grant?.expires_at) <= Date.parse(grant?.granted_at)) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_TIME_INVALID');
  if (!['ACTIVE', 'REVOKED'].includes(grant?.state) || (grant?.state === 'ACTIVE' && grant?.revoked_at !== null)
    || (grant?.state === 'REVOKED' && !Number.isFinite(Date.parse(grant?.revoked_at)))) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_STATE_INVALID');
  if (as_of_at && (grant?.state !== 'ACTIVE' || Date.parse(as_of_at) < Date.parse(grant?.granted_at) || Date.parse(as_of_at) >= Date.parse(grant?.expires_at))) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_NOT_ACTIVE');
  if (!HASH.test(grant?.grant_hash || '') || grant.grant_hash !== hashWithout(grant, 'grant_hash')) errors.push('ATHLETE_SHARED_CONTEXT_GRANT_HASH_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function revokeAthleteSharedContextGrantV1({ grant, actor, expected_permission_version, revoked_at }) {
  const validation = validateAthleteSharedContextGrantV1(grant);
  if (!validation.valid || grant.state !== 'ACTIVE') return publicDenied('ATHLETE_SHARED_CONTEXT_REVOCATION_DENIED');
  if (actor?.actor_role !== 'ATHLETE' || actor?.actor_ref !== grant.relationship.athlete_actor_id
    || expected_permission_version !== grant.permission_version) return publicDenied('ATHLETE_SHARED_CONTEXT_REVOCATION_DENIED');
  const body = {
    ...clone(grant),
    permission_version: grant.permission_version + 1,
    state: 'REVOKED',
    revoked_at: iso(revoked_at),
    supersedes_grant_hash: grant.grant_hash,
  };
  delete body.grant_hash;
  return deepFreeze({ ok: true, code: 'ATHLETE_SHARED_CONTEXT_GRANT_REVOKED', grant: { ...body, grant_hash: hashCanonicalJson(body) } });
}

export function compileAthleteSharedContextV1({
  adapter,
  grant,
  relationship,
  object_catalog,
  purpose = PURPOSE,
  as_of_at,
  page_context = { room: 'HOME', visible_object_ids: [] },
}) {
  const adapterValidation = validateAthleteDomainAdapterV1(adapter);
  if (!adapterValidation.valid || !validateRelationship(relationship, adapter.domain_scope)) return publicDenied();
  const grantValidation = validateAthleteSharedContextGrantV1(grant, { scope: adapter.domain_scope, relationship, purpose, as_of_at });
  if (!grantValidation.valid || !grant.allowed_actions.includes('READ_SHARED_CONTEXT')) return publicDenied();
  if (!ROOMS.has(page_context?.room) || !Array.isArray(page_context?.visible_object_ids)) return publicDenied();
  if (!Array.isArray(object_catalog)) return publicDenied();
  const byId = new Map();
  for (const object of object_catalog) {
    if (!validId(object?.object_id) || byId.has(object.object_id)) return publicDenied();
    byId.set(object.object_id, object);
  }
  const selected = [];
  for (const objectId of grant.allowed_object_ids) {
    const object = byId.get(objectId);
    if (!object || !validateSharedObject(object, grant.source_artifact_bindings)) return publicDenied();
    selected.push(clone(object));
  }
  const visibleIds = new Set(page_context.visible_object_ids);
  const visibleAuthorized = new Set(selected.filter((object) => visibleIds.has(object.object_id)
    || (object.page_context_refs || []).some((id) => visibleIds.has(id))).map((object) => object.object_id));
  selected.sort((left, right) => Number(visibleAuthorized.has(right.object_id)) - Number(visibleAuthorized.has(left.object_id)) || left.object_id.localeCompare(right.object_id));
  const projectedObjects = selected.map((object) => ({
    ...object,
    relevance: visibleAuthorized.has(object.object_id) ? 'ACTIVE_VIEW' : 'RELATIONSHIP_CONTEXT',
  }));
  const projectionBody = {
    contract_id: ATHLETE_SHARED_CONTEXT_PROJECTION_CONTRACT,
    schema_version: '1.0.0',
    domain: ATHLETE_DOMAIN,
    domain_scope_hash: adapter.domain_scope_hash,
    relationship_ref: adapter.relationship_ref,
    purpose,
    audience: ['ATHLETE', 'INSTRUCTOR'],
    permission_version: grant.permission_version,
    source_artifact_bindings: clone(grant.source_artifact_bindings),
    shared_objects: projectedObjects,
    page_context: {
      room: page_context.room,
      visible_authorized_object_ids: [...visibleAuthorized].sort(),
    },
    authority_filter_applied_before_ranking: true,
    page_context_is_relevance_prior_not_authority: true,
    model_receives_forbidden_object_existence: false,
    client_receives_forbidden_object_existence: false,
    private_object_existence_disclosed: false,
    compiled_at: iso(as_of_at),
  };
  const projection = deepFreeze({ ...projectionBody, projection_hash: hashCanonicalJson(projectionBody) });
  const receiptBody = {
    contract_id: 'athlete_shared_context_authority_receipt_v1',
    schema_version: '1.0.0',
    domain_scope_hash: adapter.domain_scope_hash,
    relationship_ref: adapter.relationship_ref,
    grant_id: grant.grant_id,
    grant_hash: grant.grant_hash,
    permission_version: grant.permission_version,
    purpose,
    projection_hash: projection.projection_hash,
    allowed_object_ids: clone(grant.allowed_object_ids),
    expires_at: grant.expires_at,
    compiled_at: iso(as_of_at),
    private_object_existence_disclosed: false,
  };
  const authorityReceipt = deepFreeze({ ...receiptBody, receipt_hash: hashCanonicalJson(receiptBody) });
  return deepFreeze({
    ok: true,
    code: 'ATHLETE_SHARED_CONTEXT_COMPILED',
    projection,
    authority_receipt: authorityReceipt,
    shared_objects: projection.shared_objects,
    private_object_existence_disclosed: false,
  });
}

export function buildAthleteConsultSurfaceProjectionV1({
  compiled_context,
  bos_presentation_artifact = null,
  bos_authority_object_id = null,
  apa_customer_view_model,
  apa_source_binding,
  projected_at,
}) {
  if (compiled_context?.ok !== true || compiled_context?.projection?.contract_id !== ATHLETE_SHARED_CONTEXT_PROJECTION_CONTRACT) {
    return publicDenied('ATHLETE_CONSULT_SURFACE_PROJECTION_DENIED');
  }
  if (!validateArtifactBinding(apa_source_binding) || apa_source_binding.source_kind !== 'ATHLETE_APA'
    || !compiled_context.projection.source_artifact_bindings.some((binding) => hashCanonicalJson(binding) === hashCanonicalJson(apa_source_binding))) {
    return publicDenied('ATHLETE_CONSULT_SURFACE_PROJECTION_DENIED');
  }
  try { assertAthletePresentationSafePayloadV1(apa_customer_view_model); } catch { return publicDenied('ATHLETE_CONSULT_SURFACE_PROJECTION_DENIED'); }
  let bos = null;
  if (bos_presentation_artifact != null || bos_authority_object_id != null) {
    const authorizedBosObject = compiled_context.shared_objects.find((object) => object.object_id === bos_authority_object_id
      && object.source_binding.source_kind === 'ATHLETE_BOS');
    if (!authorizedBosObject || bos_presentation_artifact == null) return publicDenied('ATHLETE_CONSULT_SURFACE_PROJECTION_DENIED');
    try { assertAthletePresentationSafePayloadV1(bos_presentation_artifact); } catch { return publicDenied('ATHLETE_CONSULT_SURFACE_PROJECTION_DENIED'); }
    if (authorizedBosObject.source_binding.content_hash !== hashCanonicalJson(bos_presentation_artifact)
      || !compiled_context.projection.source_artifact_bindings.some((binding) => binding.source_kind === 'ATHLETE_BOS'
        && hashCanonicalJson(binding) === hashCanonicalJson(authorizedBosObject.source_binding))) {
      return publicDenied('ATHLETE_CONSULT_SURFACE_PROJECTION_DENIED');
    }
    bos = {
      artifact: clone(bos_presentation_artifact),
      authority_object_id: authorizedBosObject.object_id,
      source_binding: clone(authorizedBosObject.source_binding),
      presentation_safe: true,
    };
  }
  const body = {
    contract_id: 'athlete_living_consult_surface_projection_v1',
    schema_version: '1.0.0',
    domain_scope_hash: compiled_context.projection.domain_scope_hash,
    authority_receipt_hash: compiled_context.authority_receipt.receipt_hash,
    surfaces: {
      bos,
      apa: {
        customerViewModel: clone(apa_customer_view_model),
        source_binding: clone(apa_source_binding),
        presentation_safe: true,
      },
    },
    bos_status: bos ? 'AVAILABLE' : 'UNAVAILABLE',
    forbidden_object_existence_disclosed: false,
    projected_at: iso(projected_at),
  };
  return deepFreeze({ ok: true, code: 'ATHLETE_CONSULT_SURFACES_PROJECTED', projection: { ...body, projection_hash: hashCanonicalJson(body) } });
}

export function createAthleteSharedHumanConfirmationV1({
  adapter,
  grant,
  relationship,
  proposal,
  actor,
  decision,
  edited_items = [],
  confirmed_at,
}) {
  const adapterValidation = validateAthleteDomainAdapterV1(adapter);
  const grantValidation = validateAthleteSharedContextGrantV1(grant, { scope: adapter?.domain_scope, relationship, purpose: PURPOSE, as_of_at: confirmed_at });
  const proposalValidation = validateGovernedChangeProposal(proposal);
  if (!adapterValidation.valid || !grantValidation.valid || !proposalValidation.valid
    || proposal.scope_hash !== adapter.rsl_scope_hash || proposal.target_contract !== 'athlete_living_map_v1'
    || !grant.allowed_actions.includes('CONFIRM_SHARED_PLAN')) return publicDenied('ATHLETE_SHARED_CONFIRMATION_DENIED');
  const expectedRef = actor?.actor_role === 'ATHLETE' ? relationship.athlete_actor_id
    : actor?.actor_role === 'INSTRUCTOR' ? relationship.instructor_actor_id : null;
  if (!expectedRef || actor.actor_ref !== expectedRef || !['CONFIRM', 'EDIT', 'REJECT'].includes(decision)
    || (decision === 'EDIT' && (!Array.isArray(edited_items) || !edited_items.length))
    || (decision !== 'EDIT' && edited_items.length)) return publicDenied('ATHLETE_SHARED_CONFIRMATION_DENIED');
  const effectiveItems = decision === 'EDIT' ? clone(edited_items) : clone(proposal.proposed_items);
  const body = {
    contract_id: ATHLETE_SHARED_CONFIRMATION_CONTRACT,
    schema_version: '1.0.0',
    confirmation_id: `athlete_confirmation_${hashCanonicalJson({ proposal_hash: proposal.proposal_hash, actor, decision, effectiveItems, confirmed_at }).slice(0, 24)}`,
    domain_scope_hash: adapter.domain_scope_hash,
    rsl_scope_hash: adapter.rsl_scope_hash,
    relationship_ref: adapter.relationship_ref,
    grant_id: grant.grant_id,
    grant_hash: grant.grant_hash,
    permission_version: grant.permission_version,
    proposal_id: proposal.proposal_id,
    proposal_hash: proposal.proposal_hash,
    expected_prior_publication_version: proposal.expected_prior_publication_version,
    expected_prior_publication_hash: proposal.expected_prior_publication_hash,
    actor: clone(actor),
    decision,
    effective_items: effectiveItems,
    effective_items_hash: hashCanonicalJson(effectiveItems),
    confirmed_at: iso(confirmed_at),
    explicit_human_confirmation: true,
    model_output_authorizes_mutation: false,
    synthetic_only: true,
  };
  return deepFreeze({ ok: true, code: 'ATHLETE_SHARED_HUMAN_CONFIRMATION_RECORDED', confirmation: { ...body, confirmation_hash: hashCanonicalJson(body) } });
}

export function validateAthleteSharedHumanConfirmationV1(confirmation, { adapter, grant, relationship, proposal } = {}) {
  const errors = [];
  if (confirmation?.contract_id !== ATHLETE_SHARED_CONFIRMATION_CONTRACT || confirmation?.schema_version !== '1.0.0'
    || confirmation?.explicit_human_confirmation !== true || confirmation?.model_output_authorizes_mutation !== false
    || confirmation?.synthetic_only !== true || !['ATHLETE', 'INSTRUCTOR'].includes(confirmation?.actor?.actor_role)) errors.push('ATHLETE_SHARED_CONFIRMATION_CONTRACT_INVALID');
  const expectedRef = confirmation?.actor?.actor_role === 'ATHLETE' ? relationship?.athlete_actor_id : relationship?.instructor_actor_id;
  if (relationship && confirmation?.actor?.actor_ref !== expectedRef) errors.push('ATHLETE_SHARED_CONFIRMATION_ACTOR_INVALID');
  if (adapter && (confirmation?.domain_scope_hash !== adapter.domain_scope_hash || confirmation?.rsl_scope_hash !== adapter.rsl_scope_hash)) errors.push('ATHLETE_SHARED_CONFIRMATION_SCOPE_DENIED');
  if (grant && (confirmation?.grant_hash !== grant.grant_hash || confirmation?.permission_version !== grant.permission_version)) errors.push('ATHLETE_SHARED_CONFIRMATION_GRANT_STALE');
  if (proposal && (confirmation?.proposal_hash !== proposal.proposal_hash
    || confirmation?.expected_prior_publication_hash !== proposal.expected_prior_publication_hash
    || confirmation?.expected_prior_publication_version !== proposal.expected_prior_publication_version)) errors.push('ATHLETE_SHARED_CONFIRMATION_PROPOSAL_STALE');
  if (!HASH.test(confirmation?.effective_items_hash || '') || confirmation.effective_items_hash !== hashCanonicalJson(confirmation?.effective_items)
    || !HASH.test(confirmation?.confirmation_hash || '') || confirmation.confirmation_hash !== hashWithout(confirmation, 'confirmation_hash')) errors.push('ATHLETE_SHARED_CONFIRMATION_HASH_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function createAthleteSharedQuorumDecisionV1({
  adapter,
  grant,
  relationship,
  proposal,
  confirmations,
  decided_at,
}) {
  if (!Array.isArray(confirmations) || confirmations.length !== 2) return publicDenied('ATHLETE_SHARED_QUORUM_PENDING');
  const byRole = new Map();
  for (const confirmation of confirmations) {
    const validation = validateAthleteSharedHumanConfirmationV1(confirmation, { adapter, grant, relationship, proposal });
    if (!validation.valid || byRole.has(confirmation.actor.actor_role)) return publicDenied('ATHLETE_SHARED_QUORUM_DENIED');
    byRole.set(confirmation.actor.actor_role, confirmation);
  }
  const athlete = byRole.get('ATHLETE');
  const instructor = byRole.get('INSTRUCTOR');
  if (!athlete || !instructor) return publicDenied('ATHLETE_SHARED_QUORUM_PENDING');
  if (athlete.decision === 'REJECT' || instructor.decision === 'REJECT') {
    return deepFreeze({ ok: true, code: 'ATHLETE_SHARED_PLAN_REJECTED_NO_MUTATION', mutation_authorized: false, shared_objects: [], private_object_existence_disclosed: false });
  }
  if (athlete.decision !== instructor.decision || athlete.effective_items_hash !== instructor.effective_items_hash) return publicDenied('ATHLETE_SHARED_QUORUM_DECISIONS_DIVERGED');
  const quorumAuthorityBody = {
    contract_id: 'athlete_shared_quorum_pre_authority_v1',
    schema_version: '1.0.0',
    domain: ATHLETE_DOMAIN,
    rsl_scope_hash: proposal.scope_hash,
    proposal_id: proposal.proposal_id,
    proposal_hash: proposal.proposal_hash,
    expected_prior_publication_version: proposal.expected_prior_publication_version,
    expected_prior_publication_hash: proposal.expected_prior_publication_hash,
    athlete_confirmation_id: athlete.confirmation_id,
    athlete_confirmation_hash: athlete.confirmation_hash,
    instructor_confirmation_id: instructor.confirmation_id,
    instructor_confirmation_hash: instructor.confirmation_hash,
    decision: athlete.decision,
    effective_items_hash: athlete.effective_items_hash,
    status: 'JOINT_APPROVED',
  };
  const jointAuthority = deepFreeze({ ...quorumAuthorityBody, authority_hash: hashCanonicalJson(quorumAuthorityBody) });
  const coreDecision = createProposalDecision({
    proposal,
    decision: athlete.decision,
    actor: { actor_type: 'JOINT_AUTHORITY', actor_ref: proposal.scope.athlete_relationship_id },
    edited_items: athlete.decision === 'EDIT' ? clone(athlete.effective_items) : [],
    decided_at,
    joint_authority: jointAuthority,
  });
  if (!coreDecision.ok) return publicDenied('ATHLETE_SHARED_QUORUM_CORE_DECISION_REFUSED');
  const receiptBody = {
    contract_id: ATHLETE_SHARED_QUORUM_RECEIPT_CONTRACT,
    schema_version: '1.0.0',
    domain: ATHLETE_DOMAIN,
    domain_scope_hash: adapter.domain_scope_hash,
    rsl_scope_hash: adapter.rsl_scope_hash,
    relationship_ref: adapter.relationship_ref,
    proposal_id: proposal.proposal_id,
    proposal_hash: proposal.proposal_hash,
    expected_prior_publication_version: proposal.expected_prior_publication_version,
    expected_prior_publication_hash: proposal.expected_prior_publication_hash,
    grant_id: grant.grant_id,
    grant_hash: grant.grant_hash,
    permission_version: grant.permission_version,
    athlete_confirmation_id: athlete.confirmation_id,
    athlete_confirmation_hash: athlete.confirmation_hash,
    instructor_confirmation_id: instructor.confirmation_id,
    instructor_confirmation_hash: instructor.confirmation_hash,
    quorum_authority_hash: jointAuthority.authority_hash,
    status: 'JOINT_APPROVED',
    subscription_decision_hash: coreDecision.decision.decision_hash,
    effective_items_hash: athlete.effective_items_hash,
    athlete_confirmed: true,
    instructor_confirmed: true,
    human_agreement_explicit: true,
    model_output_authorized_mutation: false,
    synthetic_only: true,
    decided_at: iso(decided_at),
  };
  const receipt = deepFreeze({ ...receiptBody, receipt_hash: hashCanonicalJson(receiptBody) });
  return deepFreeze({ ok: true, code: 'ATHLETE_SHARED_QUORUM_AUTHORIZED', mutation_authorized: true, decision: coreDecision.decision, quorum_receipt: receipt });
}

export function validateAthleteSharedQuorumReceiptV1(receipt, {
  adapter,
  grant,
  proposal,
  decision,
  confirmations = [],
} = {}) {
  const errors = [];
  if (receipt?.contract_id !== ATHLETE_SHARED_QUORUM_RECEIPT_CONTRACT || receipt?.schema_version !== '1.0.0'
    || receipt?.domain !== ATHLETE_DOMAIN || receipt?.athlete_confirmed !== true || receipt?.instructor_confirmed !== true
    || receipt?.human_agreement_explicit !== true || receipt?.model_output_authorized_mutation !== false
    || receipt?.status !== 'JOINT_APPROVED'
    || receipt?.synthetic_only !== true) errors.push('ATHLETE_SHARED_QUORUM_RECEIPT_CONTRACT_INVALID');
  if (adapter && (receipt?.domain_scope_hash !== adapter.domain_scope_hash || receipt?.rsl_scope_hash !== adapter.rsl_scope_hash)) errors.push('ATHLETE_SHARED_QUORUM_RECEIPT_SCOPE_DENIED');
  if (grant && (receipt?.grant_id !== grant.grant_id || receipt?.grant_hash !== grant.grant_hash
    || receipt?.permission_version !== grant.permission_version)) errors.push('ATHLETE_SHARED_QUORUM_RECEIPT_GRANT_INVALID');
  if (proposal && (receipt?.proposal_id !== proposal.proposal_id || receipt?.proposal_hash !== proposal.proposal_hash
    || receipt?.expected_prior_publication_version !== proposal.expected_prior_publication_version
    || receipt?.expected_prior_publication_hash !== proposal.expected_prior_publication_hash)) errors.push('ATHLETE_SHARED_QUORUM_RECEIPT_PROPOSAL_INVALID');
  if (decision && (receipt?.subscription_decision_hash !== decision.decision_hash
    || receipt?.effective_items_hash !== hashCanonicalJson(decision.effective_items))) errors.push('ATHLETE_SHARED_QUORUM_RECEIPT_DECISION_INVALID');
  if (confirmations.length) {
    const byRole = new Map(confirmations.map((confirmation) => [confirmation?.actor?.actor_role, confirmation]));
    const athlete = byRole.get('ATHLETE');
    const instructor = byRole.get('INSTRUCTOR');
    if (confirmations.length !== 2 || !athlete || !instructor
      || receipt?.athlete_confirmation_id !== athlete.confirmation_id
      || receipt?.athlete_confirmation_hash !== athlete.confirmation_hash
      || receipt?.instructor_confirmation_id !== instructor.confirmation_id
      || receipt?.instructor_confirmation_hash !== instructor.confirmation_hash) errors.push('ATHLETE_SHARED_QUORUM_RECEIPT_CONFIRMATIONS_INVALID');
  }
  if (!validId(receipt?.athlete_confirmation_id) || !validId(receipt?.instructor_confirmation_id)
    || receipt?.athlete_confirmation_id === receipt?.instructor_confirmation_id
    || !HASH.test(receipt?.athlete_confirmation_hash || '') || !HASH.test(receipt?.instructor_confirmation_hash || '')
    || receipt?.athlete_confirmation_hash === receipt?.instructor_confirmation_hash
    || !HASH.test(receipt?.quorum_authority_hash || '') || !HASH.test(receipt?.subscription_decision_hash || '')
    || !HASH.test(receipt?.expected_prior_publication_hash || '')
    || !HASH.test(receipt?.receipt_hash || '') || receipt.receipt_hash !== hashWithout(receipt, 'receipt_hash')) errors.push('ATHLETE_SHARED_QUORUM_RECEIPT_HASH_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}
