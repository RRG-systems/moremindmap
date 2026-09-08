import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { scopeFingerprint } from '../subscriptionV1/contracts.js';
import { createConfirmedLineageMetadata } from '../subscriptionV1/lineage.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const HASH = /^[a-f0-9]{64}$/u;
const ID = /^[a-z0-9][a-z0-9:_-]{7,159}$/u;
const FIELD = /^athlete_(?:current_reality|futures|one_move|plan|evidence)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/u;
const FORBIDDEN_KEYS = new Set([
  'raw_answer',
  'raw_answers',
  'raw_response',
  'raw_responses',
  'raw_transcript',
  'transcript',
  'private_only',
  'private_source_detail',
  'sensitive_source_detail',
  'provider_request',
  'provider_response',
  'prompt',
]);

export const ATHLETE_DOMAIN = 'ATHLETE';
export const ATHLETE_LIVING_RELATIONSHIP_SCOPE_CONTRACT = 'athlete_living_relationship_scope_v1';
export const ATHLETE_DOMAIN_ADAPTER_CONTRACT = 'athlete_domain_adapter_receipt_v1';
export const ATHLETE_LIVING_MAP_CONTRACT = 'athlete_living_map_publication_v1';
export const ATHLETE_MAP_DELTA_RECEIPT_CONTRACT = 'athlete_living_map_delta_receipt_v1';
export const ATHLETE_SHARED_MUTATION_TARGET = 'athlete_living_map_v1';

export const ATHLETE_MUTATION_POLICY_V1 = deepFreeze({
  target_contract: ATHLETE_SHARED_MUTATION_TARGET,
  allowed_prefixes: [
    'athlete_current_reality.',
    'athlete_futures.',
    'athlete_one_move.',
    'athlete_plan.',
    'athlete_evidence.',
  ],
  object_by_prefix: {
    'athlete_current_reality.': 'CURRENT_REALITY',
    'athlete_futures.': 'FUTURES',
    'athlete_one_move.': 'ONE_MOVE',
    'athlete_plan.': 'PLAN',
    'athlete_evidence.': 'EVIDENCE',
  },
  business_paths_permitted: false,
});

export const ATHLETE_LINEAGE_SIGNAL_BY_FIELD_V1 = deepFreeze({
  'athlete_plan.intervention': 'INTERVENTION',
  'athlete_plan.open_loop_state': 'OPEN_LOOP_STATE',
  'athlete_plan.due_at': 'DUE_AT',
  'athlete_plan.observation_window_start': 'OBSERVATION_WINDOW_START',
  'athlete_plan.observation_window_end': 'OBSERVATION_WINDOW_END',
  'athlete_plan.falsifiers': 'FALSIFIERS',
  'athlete_evidence.intervention_lineage_id': 'INTERVENTION_LINEAGE_ID',
  'athlete_evidence.execution_degree': 'EXECUTION_DEGREE',
  'athlete_evidence.outcome_classification': 'OUTCOME_CLASSIFICATION',
  'athlete_evidence.confounders': 'CONFOUNDERS',
  'athlete_evidence.external_shocks': 'EXTERNAL_SHOCKS',
  'athlete_evidence.observation_window_start': 'OBSERVATION_WINDOW_START',
  'athlete_evidence.observation_window_end': 'OBSERVATION_WINDOW_END',
  'athlete_evidence.falsifiers': 'FALSIFIERS',
  'athlete_evidence.requested_attribution': 'REQUESTED_ATTRIBUTION',
  'athlete_evidence.open_loop_state': 'OPEN_LOOP_STATE',
  'athlete_evidence.decision': 'DECISION',
  'athlete_evidence.friction': 'FRICTION',
  'athlete_evidence.changed_reality': 'CHANGED_REALITY',
});

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

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function iso(value) {
  if (!validTimestamp(value)) throw new TypeError('ATHLETE_TIMESTAMP_INVALID');
  return new Date(value).toISOString();
}

function hashWithout(value, field) {
  const unsigned = clone(value);
  delete unsigned[field];
  return hashCanonicalJson(unsigned);
}

function getAtPath(value, path) {
  return path.split('.').reduce((cursor, key) => cursor?.[key], value);
}

function setAtPath(value, path, nextValue) {
  const segments = path.split('.');
  let cursor = value;
  for (const segment of segments.slice(0, -1)) {
    if (!isObject(cursor[segment])) cursor[segment] = {};
    cursor = cursor[segment];
  }
  cursor[segments.at(-1)] = nextValue;
}

function containsForbiddenPresentationMaterial(value, depth = 0) {
  if (depth > 16 || value == null) return false;
  if (Array.isArray(value)) return value.some((entry) => containsForbiddenPresentationMaterial(entry, depth + 1));
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, entry]) => FORBIDDEN_KEYS.has(key.toLowerCase())
    || containsForbiddenPresentationMaterial(entry, depth + 1));
}

export function assertAthletePresentationSafePayloadV1(value) {
  if (!isObject(value) || containsForbiddenPresentationMaterial(value)) {
    throw new TypeError('ATHLETE_PRESENTATION_SAFE_PAYLOAD_REQUIRED');
  }
  return value;
}

export function createAthleteLivingRelationshipScopeV1({
  subject_id,
  relationship_id,
  membership_id,
  tenant_id,
  athlete_profile_id,
  age_band = '18–20',
  synthetic_only = true,
}) {
  const body = {
    contract_id: ATHLETE_LIVING_RELATIONSHIP_SCOPE_CONTRACT,
    schema_version: '1.0.0',
    domain: ATHLETE_DOMAIN,
    subject_id,
    relationship_id,
    membership_id,
    tenant_id,
    athlete_profile_id,
    age_band,
    synthetic_only,
  };
  const scope = deepFreeze({ ...body, scope_hash: hashCanonicalJson(body) });
  const validation = validateAthleteLivingRelationshipScopeV1(scope);
  if (!validation.valid) throw new TypeError(validation.errors[0]);
  return scope;
}

export function validateAthleteLivingRelationshipScopeV1(scope) {
  const errors = [];
  const keys = [
    'contract_id', 'schema_version', 'domain', 'subject_id', 'relationship_id',
    'membership_id', 'tenant_id', 'athlete_profile_id', 'age_band',
    'synthetic_only', 'scope_hash',
  ];
  if (!exactKeys(scope, keys)) errors.push('ATHLETE_SCOPE_FIELDS_INVALID');
  if (scope?.contract_id !== ATHLETE_LIVING_RELATIONSHIP_SCOPE_CONTRACT || scope?.schema_version !== '1.0.0') errors.push('ATHLETE_SCOPE_CONTRACT_INVALID');
  if (scope?.domain !== ATHLETE_DOMAIN) errors.push('ATHLETE_SCOPE_DOMAIN_INVALID');
  for (const key of ['subject_id', 'relationship_id', 'membership_id', 'tenant_id', 'athlete_profile_id']) {
    if (!validId(scope?.[key])) errors.push(`ATHLETE_SCOPE_${key.toUpperCase()}_INVALID`);
  }
  if (scope?.age_band !== '18–20') errors.push('ATHLETE_SCOPE_18_20_ONLY');
  if (scope?.synthetic_only !== true) errors.push('ATHLETE_SCOPE_SYNTHETIC_ONLY');
  if (!HASH.test(scope?.scope_hash || '') || scope.scope_hash !== hashWithout(scope, 'scope_hash')) errors.push('ATHLETE_SCOPE_HASH_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function createAthleteDomainAdapterV1({ scope }) {
  const validation = validateAthleteLivingRelationshipScopeV1(scope);
  if (!validation.valid) throw new TypeError(validation.errors[0]);
  const rslScope = {
    domain: ATHLETE_DOMAIN,
    subject_id: scope.subject_id,
    membership_id: scope.membership_id,
    tenant_id: scope.tenant_id,
    profile_id: scope.athlete_profile_id,
    athlete_relationship_id: scope.relationship_id,
  };
  const body = {
    contract_id: ATHLETE_DOMAIN_ADAPTER_CONTRACT,
    schema_version: '1.0.0',
    domain: ATHLETE_DOMAIN,
    domain_scope: clone(scope),
    domain_scope_hash: scope.scope_hash,
    rsl_scope: rslScope,
    rsl_scope_hash: scopeFingerprint(rslScope),
    relationship_ref: `athlete_relationship_${hashCanonicalJson({ relationship_id: scope.relationship_id }).slice(0, 32)}`,
    synthetic_only: true,
    proposal_policy: clone(ATHLETE_MUTATION_POLICY_V1),
  };
  return deepFreeze({ ...body, adapter_hash: hashCanonicalJson(body) });
}

export function validateAthleteDomainAdapterV1(adapter) {
  const errors = [];
  const scopeValidation = validateAthleteLivingRelationshipScopeV1(adapter?.domain_scope);
  if (!scopeValidation.valid) errors.push(...scopeValidation.errors);
  if (adapter?.contract_id !== ATHLETE_DOMAIN_ADAPTER_CONTRACT || adapter?.schema_version !== '1.0.0' || adapter?.domain !== ATHLETE_DOMAIN) errors.push('ATHLETE_DOMAIN_ADAPTER_CONTRACT_INVALID');
  if (adapter?.domain_scope_hash !== adapter?.domain_scope?.scope_hash) errors.push('ATHLETE_DOMAIN_ADAPTER_SCOPE_BINDING_INVALID');
  try {
    if (adapter?.rsl_scope_hash !== scopeFingerprint(adapter?.rsl_scope)) errors.push('ATHLETE_DOMAIN_ADAPTER_RSL_SCOPE_HASH_INVALID');
  } catch {
    errors.push('ATHLETE_DOMAIN_ADAPTER_RSL_SCOPE_INVALID');
  }
  if (Object.keys(adapter?.rsl_scope || {}).join('|') !== 'domain|subject_id|membership_id|tenant_id|profile_id|athlete_relationship_id'
    || adapter?.rsl_scope?.domain !== ATHLETE_DOMAIN
    || adapter?.rsl_scope?.athlete_relationship_id !== adapter?.domain_scope?.relationship_id) errors.push('ATHLETE_DOMAIN_ADAPTER_SCOPE_SHAPE_INVALID');
  if (adapter?.synthetic_only !== true) errors.push('ATHLETE_DOMAIN_ADAPTER_BOUNDARY_INVALID');
  if (!HASH.test(adapter?.adapter_hash || '') || adapter.adapter_hash !== hashWithout(adapter, 'adapter_hash')) errors.push('ATHLETE_DOMAIN_ADAPTER_HASH_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function adaptAthletePersonalRslInputV1({ adapter, input }) {
  const validation = validateAthleteDomainAdapterV1(adapter);
  if (!validation.valid) throw new TypeError(validation.errors[0]);
  return deepFreeze({
    ...clone(input),
    scope: clone(adapter.rsl_scope),
    semantic_payload: {
      ...clone(input.semantic_payload || {}),
      domain: ATHLETE_DOMAIN,
      athlete_relationship_scope_hash: adapter.domain_scope_hash,
      athlete_relationship_ref: adapter.relationship_ref,
      synthetic_only: true,
    },
  });
}

export function classifyAthleteMutationItemsV1(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 12) {
    return deepFreeze({ valid: false, errors: ['ATHLETE_MUTATION_ITEMS_INVALID'], affected_objects: [] });
  }
  const affected = new Set();
  const errors = [];
  for (const item of items) {
    if (!exactKeys(item, ['field', 'value']) || typeof item.field !== 'string' || !FIELD.test(item.field)
      || typeof item.value !== 'string' || !item.value.trim() || item.value.length > 1200) {
      errors.push('ATHLETE_MUTATION_ITEM_INVALID');
      continue;
    }
    const prefix = ATHLETE_MUTATION_POLICY_V1.allowed_prefixes.find((candidate) => item.field.startsWith(candidate));
    if (!prefix) errors.push('ATHLETE_MUTATION_FIELD_DENIED');
    else affected.add(ATHLETE_MUTATION_POLICY_V1.object_by_prefix[prefix]);
  }
  return deepFreeze({ valid: errors.length === 0, errors, affected_objects: [...affected].sort() });
}

export function adaptAthleteLineageItemsToUniversalV1(items) {
  const classification = classifyAthleteMutationItemsV1(items);
  if (!classification.valid) return deepFreeze({ ok: false, code: 'ATHLETE_LINEAGE_ITEMS_INVALID', errors: classification.errors });
  const lineageSignals = [];
  for (const item of items) {
    const signal = ATHLETE_LINEAGE_SIGNAL_BY_FIELD_V1[item.field];
    if (signal) lineageSignals.push({ field: item.field, signal, value: item.value });
  }
  if (!lineageSignals.length) return deepFreeze({ ok: false, code: 'ATHLETE_LINEAGE_FIELDS_NOT_PRESENT' });
  const body = {
    contract_id: 'athlete_lineage_vocabulary_adapter_receipt_v1',
    schema_version: '1.0.0',
    athlete_items_hash: hashCanonicalJson(items),
    lineage_signals_hash: hashCanonicalJson(lineageSignals),
    athlete_items_remain_persisted: true,
    universal_engine_accepts_athlete_fields_directly: true,
  };
  return deepFreeze({
    ok: true,
    code: 'ATHLETE_LINEAGE_ITEMS_ADAPTED',
    athlete_items: clone(items),
    lineage_signals: lineageSignals,
    receipt: { ...body, receipt_hash: hashCanonicalJson(body) },
  });
}

export function inferAthleteRslEventTypeV1({ proposal_type, items }) {
  const classification = classifyAthleteMutationItemsV1(items);
  if (!classification.valid) return null;
  const fields = items.map(({ field }) => field);
  if (proposal_type === 'CORRECTION_CANDIDATE') return 'CORRECTION';
  if (proposal_type === 'PLAN_CHANGE_CANDIDATE') return 'PLAN_CHANGE';
  if (proposal_type === 'COMMITMENT_CANDIDATE') return fields.includes('athlete_plan.intervention') ? 'INTERVENTION' : 'COMMITMENT';
  if (fields.some((field) => field.startsWith('athlete_evidence.outcome'))) return 'OUTCOME';
  if (fields.some((field) => field.startsWith('athlete_evidence.execution') || field.startsWith('athlete_evidence.attempt'))) return 'ATTEMPT';
  if (fields.some((field) => field.startsWith('athlete_evidence.decision'))) return 'DECISION';
  if (fields.some((field) => field.startsWith('athlete_evidence.friction'))) return 'FRICTION';
  if (fields.some((field) => field.startsWith('athlete_evidence.changed_reality'))) return 'STATE_CHANGE';
  return proposal_type === 'EVIDENCE_CANDIDATE' ? 'EVIDENCE_ASSERTED' : null;
}

export function createAthleteLineageMetadataV1({ proposal, decision, event_type, active_events = [] }) {
  const adapted = adaptAthleteLineageItemsToUniversalV1(decision?.effective_items || []);
  if (!adapted.ok) return adapted;
  const lineage = createConfirmedLineageMetadata({
    proposal,
    decision,
    event_type,
    effective_items: adapted.athlete_items,
    active_events,
  });
  if (!lineage.ok) return lineage;
  return deepFreeze({
    ok: true,
    code: 'ATHLETE_LINEAGE_METADATA_CREATED',
    lineage: lineage.lineage,
    athlete_items: adapted.athlete_items,
    vocabulary_receipt: adapted.receipt,
  });
}

function normalizeInitialState(value) {
  const state = clone(value || {});
  const expected = ['athlete_current_reality', 'athlete_futures', 'athlete_one_move', 'athlete_plan', 'athlete_evidence'];
  if (!exactKeys(state, expected) || expected.some((key) => !isObject(state[key]))) throw new TypeError('ATHLETE_LIVING_MAP_STATE_INVALID');
  assertAthletePresentationSafePayloadV1(state);
  return state;
}

export function createInitialAthleteLivingMapPublicationV1({
  adapter,
  initial_state,
  source_state_hash,
  authority_receipt_hash,
  created_at,
}) {
  const adapterValidation = validateAthleteDomainAdapterV1(adapter);
  if (!adapterValidation.valid) throw new TypeError(adapterValidation.errors[0]);
  if (!HASH.test(source_state_hash || '') || !HASH.test(authority_receipt_hash || '')) throw new TypeError('ATHLETE_LIVING_MAP_SOURCE_AUTHORITY_HASH_REQUIRED');
  const state = normalizeInitialState(initial_state);
  const body = {
    contract_id: ATHLETE_LIVING_MAP_CONTRACT,
    schema_version: '1.0.0',
    domain: ATHLETE_DOMAIN,
    domain_scope_hash: adapter.domain_scope_hash,
    scope: clone(adapter.rsl_scope),
    scope_hash: adapter.rsl_scope_hash,
    publication_version: 1,
    prior_publication_hash: null,
    source_state_hash,
    authority_receipt_hash,
    state,
    material_change: false,
    changed_object_paths: [],
    derived_projection: true,
    second_truth_store: false,
    raw_transcript_required: false,
    published_at: iso(created_at),
  };
  const publication = deepFreeze({ ...body, publication_hash: hashCanonicalJson(body) });
  const validation = validateAthleteLivingMapPublicationV1(publication, adapter);
  if (!validation.valid) throw new TypeError(validation.errors[0]);
  return publication;
}

export function validateAthleteLivingMapPublicationV1(publication, adapter) {
  const errors = [];
  if (publication?.contract_id !== ATHLETE_LIVING_MAP_CONTRACT || publication?.schema_version !== '1.0.0' || publication?.domain !== ATHLETE_DOMAIN) errors.push('ATHLETE_LIVING_MAP_CONTRACT_INVALID');
  if (adapter) {
    const adapterValidation = validateAthleteDomainAdapterV1(adapter);
    if (!adapterValidation.valid || publication?.domain_scope_hash !== adapter.domain_scope_hash
      || publication?.scope_hash !== adapter.rsl_scope_hash) errors.push('ATHLETE_LIVING_MAP_SCOPE_DENIED');
  }
  try {
    if (publication?.scope_hash !== scopeFingerprint(publication?.scope)) errors.push('ATHLETE_LIVING_MAP_RSL_SCOPE_INVALID');
    normalizeInitialState(publication?.state);
  } catch {
    errors.push('ATHLETE_LIVING_MAP_STATE_INVALID');
  }
  if (!Number.isInteger(publication?.publication_version) || publication.publication_version < 1
    || !HASH.test(publication?.source_state_hash || '') || !HASH.test(publication?.authority_receipt_hash || '')
    || !validTimestamp(publication?.published_at) || publication?.derived_projection !== true
    || publication?.second_truth_store !== false || publication?.raw_transcript_required !== false) errors.push('ATHLETE_LIVING_MAP_BOUNDARY_INVALID');
  if (!Array.isArray(publication?.changed_object_paths) || publication.changed_object_paths.some((path) => !FIELD.test(path))) errors.push('ATHLETE_LIVING_MAP_CHANGED_PATH_INVALID');
  if (publication?.publication_version === 1 && publication?.prior_publication_hash !== null) errors.push('ATHLETE_LIVING_MAP_INITIAL_PRIOR_INVALID');
  if (publication?.publication_version > 1 && !HASH.test(publication?.prior_publication_hash || '')) errors.push('ATHLETE_LIVING_MAP_PRIOR_REQUIRED');
  if (!HASH.test(publication?.publication_hash || '') || publication.publication_hash !== hashWithout(publication, 'publication_hash')) errors.push('ATHLETE_LIVING_MAP_HASH_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

function validAuthoritativeQuorumContext({
  adapter,
  proposal,
  decision,
  quorumReceipt,
  authoritativeGrant,
  authoritativeRelationship,
  authoritativeConfirmations,
  recordedAt,
}) {
  if (!isObject(authoritativeGrant) || !isObject(authoritativeRelationship)
    || !Array.isArray(authoritativeConfirmations) || authoritativeConfirmations.length !== 2) return false;
  if (authoritativeGrant.contract_id !== 'athlete_shared_context_grant_v1'
    || authoritativeGrant.state !== 'ACTIVE'
    || authoritativeGrant.synthetic_only !== true
    || authoritativeGrant.domain_scope_hash !== adapter.domain_scope_hash
    || authoritativeGrant.grant_id !== quorumReceipt?.grant_id
    || authoritativeGrant.grant_hash !== quorumReceipt?.grant_hash
    || authoritativeGrant.permission_version !== quorumReceipt?.permission_version
    || authoritativeGrant.grant_hash !== hashWithout(authoritativeGrant, 'grant_hash')
    || !validTimestamp(authoritativeGrant.granted_at)
    || !validTimestamp(authoritativeGrant.expires_at)
    || Date.parse(recordedAt) < Date.parse(authoritativeGrant.granted_at)
    || Date.parse(recordedAt) >= Date.parse(authoritativeGrant.expires_at)) return false;
  if (authoritativeRelationship.relationship_id !== adapter.domain_scope.relationship_id
    || authoritativeRelationship.athlete_actor_id !== adapter.domain_scope.subject_id
    || authoritativeRelationship.synthetic_only !== true
    || hashCanonicalJson(authoritativeGrant.relationship) !== hashCanonicalJson(authoritativeRelationship)) return false;
  if (!proposal?.authority_ref_ids?.includes(authoritativeGrant.grant_id)
    || !proposal.authority_ref_ids.includes(authoritativeGrant.grant_hash)
    || !proposal.authority_ref_ids.includes(`athlete-permission-version:${authoritativeGrant.permission_version}`)) return false;

  const byRole = new Map();
  for (const confirmation of authoritativeConfirmations) {
    const role = confirmation?.actor?.actor_role;
    const expectedActorRef = role === 'ATHLETE' ? authoritativeRelationship.athlete_actor_id
      : role === 'INSTRUCTOR' ? authoritativeRelationship.instructor_actor_id : null;
    if (!expectedActorRef || byRole.has(role)
      || confirmation.contract_id !== 'athlete_shared_human_confirmation_v1'
      || confirmation.synthetic_only !== true
      || confirmation.explicit_human_confirmation !== true
      || confirmation.model_output_authorizes_mutation !== false
      || confirmation.domain_scope_hash !== adapter.domain_scope_hash
      || confirmation.rsl_scope_hash !== adapter.rsl_scope_hash
      || confirmation.relationship_ref !== adapter.relationship_ref
      || confirmation.grant_id !== authoritativeGrant.grant_id
      || confirmation.grant_hash !== authoritativeGrant.grant_hash
      || confirmation.permission_version !== authoritativeGrant.permission_version
      || confirmation.proposal_id !== proposal.proposal_id
      || confirmation.proposal_hash !== proposal.proposal_hash
      || confirmation.expected_prior_publication_version !== proposal.expected_prior_publication_version
      || confirmation.expected_prior_publication_hash !== proposal.expected_prior_publication_hash
      || confirmation.actor.actor_ref !== expectedActorRef
      || confirmation.decision !== decision.decision
      || confirmation.effective_items_hash !== hashCanonicalJson(decision.effective_items)
      || confirmation.confirmation_hash !== hashWithout(confirmation, 'confirmation_hash')) return false;
    byRole.set(role, confirmation);
  }
  const athlete = byRole.get('ATHLETE');
  const instructor = byRole.get('INSTRUCTOR');
  return Boolean(athlete && instructor
    && quorumReceipt.athlete_confirmation_id === athlete.confirmation_id
    && quorumReceipt.athlete_confirmation_hash === athlete.confirmation_hash
    && quorumReceipt.instructor_confirmation_id === instructor.confirmation_id
    && quorumReceipt.instructor_confirmation_hash === instructor.confirmation_hash);
}

export function recomputeAthleteLivingMapV1({
  adapter,
  current_publication,
  proposal,
  decision,
  quorum_receipt,
  authoritative_grant,
  authoritative_relationship,
  authoritative_confirmations,
  recorded_at,
}) {
  const publicationValidation = validateAthleteLivingMapPublicationV1(current_publication, adapter);
  if (!publicationValidation.valid) return deepFreeze({ ok: false, code: 'ATHLETE_LIVING_MAP_CURRENT_PUBLICATION_INVALID', errors: publicationValidation.errors });
  const classified = classifyAthleteMutationItemsV1(decision?.effective_items);
  if (!classified.valid || proposal?.target_contract !== ATHLETE_SHARED_MUTATION_TARGET) return deepFreeze({ ok: false, code: 'ATHLETE_LIVING_MAP_MUTATION_POLICY_DENIED' });
  if (decision?.mutation_authorized !== true || decision?.proposal_hash !== proposal?.proposal_hash
    || decision?.expected_prior_publication_version !== current_publication.publication_version
    || decision?.expected_prior_publication_hash !== current_publication.publication_hash) {
    return deepFreeze({ ok: false, code: 'ATHLETE_LIVING_MAP_STALE_OR_UNAUTHORIZED' });
  }
  const jointAuthority = decision?.joint_authority;
  const jointAuthorityUnsigned = jointAuthority ? clone(jointAuthority) : null;
  if (jointAuthorityUnsigned) delete jointAuthorityUnsigned.authority_hash;
  const exactRelationship = hashCanonicalJson(quorum_receipt?.relationship_ref || null) === hashCanonicalJson(adapter.relationship_ref);
  const grantBoundToProposal = proposal.authority_ref_ids?.includes(quorum_receipt?.grant_id)
    && proposal.authority_ref_ids?.includes(quorum_receipt?.grant_hash)
    && proposal.authority_ref_ids?.includes(`athlete-permission-version:${quorum_receipt?.permission_version}`);
  const authoritativeContextValid = validAuthoritativeQuorumContext({
    adapter,
    proposal,
    decision,
    quorumReceipt: quorum_receipt,
    authoritativeGrant: authoritative_grant,
    authoritativeRelationship: authoritative_relationship,
    authoritativeConfirmations: authoritative_confirmations,
    recordedAt: recorded_at,
  });
  if (!authoritativeContextValid
    || quorum_receipt?.contract_id !== 'athlete_shared_quorum_authority_receipt_v1'
    || quorum_receipt?.proposal_hash !== proposal.proposal_hash
    || quorum_receipt?.subscription_decision_hash !== decision.decision_hash
    || quorum_receipt?.domain_scope_hash !== adapter.domain_scope_hash
    || quorum_receipt?.rsl_scope_hash !== adapter.rsl_scope_hash
    || !exactRelationship
    || !grantBoundToProposal
    || quorum_receipt?.human_agreement_explicit !== true
    || quorum_receipt?.athlete_confirmed !== true
    || quorum_receipt?.instructor_confirmed !== true
    || quorum_receipt?.expected_prior_publication_version !== current_publication.publication_version
    || quorum_receipt?.expected_prior_publication_hash !== current_publication.publication_hash
    || quorum_receipt?.effective_items_hash !== hashCanonicalJson(decision.effective_items)
    || !jointAuthority
    || jointAuthority.rsl_scope_hash !== adapter.rsl_scope_hash
    || jointAuthority.proposal_id !== proposal.proposal_id
    || jointAuthority.proposal_hash !== proposal.proposal_hash
    || jointAuthority.expected_prior_publication_version !== current_publication.publication_version
    || jointAuthority.expected_prior_publication_hash !== current_publication.publication_hash
    || jointAuthority.effective_items_hash !== hashCanonicalJson(decision.effective_items)
    || jointAuthority.athlete_confirmation_id !== quorum_receipt.athlete_confirmation_id
    || jointAuthority.athlete_confirmation_hash !== quorum_receipt.athlete_confirmation_hash
    || jointAuthority.instructor_confirmation_id !== quorum_receipt.instructor_confirmation_id
    || jointAuthority.instructor_confirmation_hash !== quorum_receipt.instructor_confirmation_hash
    || jointAuthority.authority_hash !== quorum_receipt.quorum_authority_hash
    || !HASH.test(jointAuthority?.authority_hash || '')
    || jointAuthority.authority_hash !== hashCanonicalJson(jointAuthorityUnsigned)
    || !HASH.test(quorum_receipt?.receipt_hash || '')
    || quorum_receipt.receipt_hash !== hashWithout(quorum_receipt, 'receipt_hash')) {
    return deepFreeze({ ok: false, code: 'ATHLETE_LIVING_MAP_SHARED_QUORUM_REQUIRED' });
  }
  const nextState = clone(current_publication.state);
  const deltas = [];
  for (const item of decision.effective_items) {
    const before = getAtPath(nextState, item.field);
    if (before === item.value) continue;
    setAtPath(nextState, item.field, item.value);
    deltas.push({
      field: item.field,
      before: before ?? null,
      after: item.value,
      before_hash: hashCanonicalJson(before ?? null),
      after_hash: hashCanonicalJson(item.value),
    });
  }
  if (!deltas.length) return deepFreeze({ ok: true, code: 'ATHLETE_LIVING_MAP_NO_MATERIAL_CHANGE', publication: current_publication, delta_receipt: null });
  assertAthletePresentationSafePayloadV1(nextState);
  const body = {
    ...clone(current_publication),
    publication_version: current_publication.publication_version + 1,
    prior_publication_hash: current_publication.publication_hash,
    source_state_hash: hashCanonicalJson({ prior: current_publication.source_state_hash, proposal_hash: proposal.proposal_hash, decision_hash: decision.decision_hash }),
    authority_receipt_hash: quorum_receipt.receipt_hash,
    state: nextState,
    material_change: true,
    changed_object_paths: deltas.map(({ field }) => field).sort(),
    published_at: iso(recorded_at),
  };
  delete body.publication_hash;
  const publication = deepFreeze({ ...body, publication_hash: hashCanonicalJson(body) });
  const validation = validateAthleteLivingMapPublicationV1(publication, adapter);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'ATHLETE_LIVING_MAP_RECOMPUTATION_INVALID', errors: validation.errors });
  const receiptBody = {
    contract_id: ATHLETE_MAP_DELTA_RECEIPT_CONTRACT,
    schema_version: '1.0.0',
    domain: ATHLETE_DOMAIN,
    domain_scope_hash: adapter.domain_scope_hash,
    proposal_hash: proposal.proposal_hash,
    decision_hash: decision.decision_hash,
    quorum_receipt_hash: quorum_receipt.receipt_hash,
    prior_publication_version: current_publication.publication_version,
    prior_publication_hash: current_publication.publication_hash,
    publication_version: publication.publication_version,
    publication_hash: publication.publication_hash,
    material_change: true,
    changed_objects: classified.affected_objects,
    deltas,
    customer_message: 'YOUR MAP JUST CHANGED',
    recorded_at: iso(recorded_at),
    mutation_source: 'EXPLICIT_ATHLETE_INSTRUCTOR_SHARED_AGREEMENT',
  };
  const deltaReceipt = deepFreeze({ ...receiptBody, receipt_hash: hashCanonicalJson(receiptBody) });
  return deepFreeze({ ok: true, code: 'ATHLETE_LIVING_MAP_RECOMPUTED', publication, delta_receipt: deltaReceipt });
}

export function validateAthleteMapDeltaReceiptV1(receipt, { adapter, before, after } = {}) {
  const errors = [];
  if (receipt?.contract_id !== ATHLETE_MAP_DELTA_RECEIPT_CONTRACT || receipt?.schema_version !== '1.0.0'
    || receipt?.domain !== ATHLETE_DOMAIN || receipt?.material_change !== true
    || receipt?.customer_message !== 'YOUR MAP JUST CHANGED') errors.push('ATHLETE_MAP_DELTA_RECEIPT_CONTRACT_INVALID');
  if (!Array.isArray(receipt?.deltas) || !receipt.deltas.length || receipt.deltas.some((delta) => !FIELD.test(delta.field)
    || delta.before_hash !== hashCanonicalJson(delta.before) || delta.after_hash !== hashCanonicalJson(delta.after))) errors.push('ATHLETE_MAP_DELTA_RECEIPT_DELTA_INVALID');
  if (adapter && receipt?.domain_scope_hash !== adapter.domain_scope_hash) errors.push('ATHLETE_MAP_DELTA_RECEIPT_SCOPE_DENIED');
  if (before && (receipt?.prior_publication_hash !== before.publication_hash || receipt?.prior_publication_version !== before.publication_version)) errors.push('ATHLETE_MAP_DELTA_RECEIPT_PRIOR_BINDING_INVALID');
  if (after && (receipt?.publication_hash !== after.publication_hash || receipt?.publication_version !== after.publication_version)) errors.push('ATHLETE_MAP_DELTA_RECEIPT_AFTER_BINDING_INVALID');
  if (!HASH.test(receipt?.receipt_hash || '') || receipt.receipt_hash !== hashWithout(receipt, 'receipt_hash')) errors.push('ATHLETE_MAP_DELTA_RECEIPT_HASH_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function createAthletePublicationAdapterV1(adapter, { authority_context_provider } = {}) {
  const adapterValidation = validateAthleteDomainAdapterV1(adapter);
  if (!adapterValidation.valid) throw new TypeError(adapterValidation.errors[0]);
  return Object.freeze({
    validatePublication(publication) {
      return validateAthleteLivingMapPublicationV1(publication, adapter).valid;
    },
    recompute({ prior_publication, personal_rsl_replay, proposal, decision, authority_receipt, published_at }) {
      if (!personal_rsl_replay?.ok || !Array.isArray(personal_rsl_replay?.state?.active_events)) {
        return deepFreeze({ ok: false, code: 'ATHLETE_LIVING_MAP_RSL_REPLAY_REQUIRED' });
      }
      const authorityContext = typeof authority_context_provider === 'function'
        ? authority_context_provider({ proposal, decision, authority_receipt, published_at })
        : null;
      if (!authorityContext) return deepFreeze({ ok: false, code: 'ATHLETE_LIVING_MAP_AUTHORITATIVE_QUORUM_REQUIRED' });
      return recomputeAthleteLivingMapV1({
        adapter,
        current_publication: prior_publication,
        proposal,
        decision,
        quorum_receipt: authority_receipt,
        authoritative_grant: authorityContext.grant,
        authoritative_relationship: authorityContext.relationship,
        authoritative_confirmations: authorityContext.confirmations,
        recorded_at: published_at,
      });
    },
  });
}
