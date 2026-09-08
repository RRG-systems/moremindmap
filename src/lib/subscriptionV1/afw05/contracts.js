import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { sameScope, scopeFingerprint } from '../contracts.js';
import {
  ADVISORY_PROPOSAL_TYPES,
  AFW05_VERSION,
  ALLOWED_MUTATION_TARGETS,
  MUTATING_PROPOSAL_TYPES,
  PROPOSAL_DECISIONS,
} from './constants.js';

const HASH = /^[a-f0-9]{64}$/u;
const clone = (value) => JSON.parse(JSON.stringify(value));
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value, keys) => isObject(value) && Object.keys(value).every((key) => keys.includes(key));
const validTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const validHash = (value) => typeof value === 'string' && HASH.test(value);
const validItems = (items, maxItems = 8, maxValueLength = 600) => Array.isArray(items) && items.length > 0 && items.length <= maxItems
  && items.every((item) => exactKeys(item, ['field', 'value'])
    && typeof item.field === 'string' && item.field.length > 0 && item.field.length <= 100
    && typeof item.value === 'string' && item.value.length <= maxValueLength);

const ATHLETE_MUTATION_TARGET = 'athlete_living_map_v1';
const ATHLETE_FIELD = /^athlete_(?:current_reality|futures|one_move|plan|evidence)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*$/u;

function athleteAffectedObjects(items) {
  const objects = new Set();
  for (const item of items) {
    if (item.field.startsWith('athlete_current_reality.')) objects.add('CURRENT_REALITY');
    else if (item.field.startsWith('athlete_futures.')) objects.add('FUTURES');
    else if (item.field.startsWith('athlete_one_move.')) objects.add('ONE_MOVE');
    else if (item.field.startsWith('athlete_plan.')) objects.add('PLAN');
    else if (item.field.startsWith('athlete_evidence.')) objects.add('EVIDENCE');
    else objects.add('UNRESOLVED');
  }
  return [...objects].sort();
}

function mutationItemsForScope(items, scope) {
  if (scope?.domain !== 'ATHLETE') return {
    valid: validItems(items),
    affected_objects: affectedObjects(items),
  };
  return {
    valid: validItems(items, 12, 1200) && items.every((item) => ATHLETE_FIELD.test(item.field)),
    affected_objects: athleteAffectedObjects(items),
  };
}

function athleteJointAuthorityValid(binding, { proposal, decision, effectiveItems }) {
  if (!isObject(binding) || binding.contract_id !== 'athlete_shared_quorum_pre_authority_v1'
    || binding.schema_version !== '1.0.0' || binding.domain !== 'ATHLETE'
    || binding.rsl_scope_hash !== proposal.scope_hash || binding.proposal_id !== proposal.proposal_id
    || binding.proposal_hash !== proposal.proposal_hash
    || binding.expected_prior_publication_version !== proposal.expected_prior_publication_version
    || binding.expected_prior_publication_hash !== proposal.expected_prior_publication_hash
    || binding.decision !== decision || binding.effective_items_hash !== hashCanonicalJson(effectiveItems)
    || !validHash(binding.athlete_confirmation_hash) || !validHash(binding.instructor_confirmation_hash)
    || !validHash(binding.authority_hash)) return false;
  return binding.authority_hash === contentHash(binding, 'authority_hash');
}

function contentHash(value, field) {
  const unsigned = clone(value);
  delete unsigned[field];
  return hashCanonicalJson(unsigned);
}

function validateHiddenProposal(hidden) {
  if (!isObject(hidden) || hidden.contract_id !== 'coaching_mutation_candidate'
    || hidden.status !== 'HIDDEN_UNACCEPTED_PROPOSAL'
    || hidden.customer_state_mutation_performed !== false
    || !validHash(hidden.proposal_hash)) return false;
  const unsigned = clone(hidden);
  delete unsigned.proposal_hash;
  return hashCanonicalJson(unsigned) === hidden.proposal_hash;
}

function classifyProposal(hidden) {
  if (MUTATING_PROPOSAL_TYPES.includes(hidden.proposal_type)) return 'DURABLE_MUTATION_PROPOSED';
  if (ADVISORY_PROPOSAL_TYPES.includes(hidden.proposal_type)) return 'ADVISORY_ONLY';
  return 'INVALID';
}

function affectedObjects(items) {
  return [...new Set(items.map((item) => {
    if (item.field.startsWith('plan_135.')) return 'PLAN_135';
    if (item.field.startsWith('where_you_are.')) return 'WHERE_YOU_ARE';
    if (item.field.startsWith('five_futures.')) return 'FIVE_FUTURES';
    if (item.field.startsWith('one_move.')) return 'ONE_MOVE';
    if (item.field.startsWith('evidence.')) return 'EVIDENCE';
    if (item.field.startsWith('commitment.')) return 'PLAN_135';
    return 'UNRESOLVED';
  }))].sort();
}

export function createGovernedChangeProposal({
  hidden_proposal,
  scope,
  source_state_packet,
  current_publication,
  created_at,
  supersedes_event_ids = [],
  retracts_event_ids = [],
}) {
  if (!validateHiddenProposal(hidden_proposal)) return deepFreeze({ ok: false, code: 'AFW05_HIDDEN_PROPOSAL_INTEGRITY_INVALID' });
  if (!source_state_packet?.packet_hash || hidden_proposal.state_packet_hash !== source_state_packet.packet_hash) {
    return deepFreeze({ ok: false, code: 'AFW05_STATE_PACKET_BINDING_INVALID' });
  }
  if (hidden_proposal.scope_hash !== scopeFingerprint(scope)) return deepFreeze({ ok: false, code: 'AFW05_PROPOSAL_SCOPE_INVALID' });
  if (!current_publication || !sameScope(current_publication.scope, scope)) return deepFreeze({ ok: false, code: 'AFW05_CURRENT_PUBLICATION_REQUIRED' });
  const classification = classifyProposal(hidden_proposal);
  if (classification === 'INVALID') return deepFreeze({ ok: false, code: 'AFW05_PROPOSAL_TYPE_INVALID' });
  const items = clone(hidden_proposal.proposed_payload?.items || []);
  const itemPolicy = mutationItemsForScope(items, scope);
  if (classification === 'DURABLE_MUTATION_PROPOSED') {
    if (!itemPolicy.valid) return deepFreeze({ ok: false, code: 'AFW05_MUTATION_ITEMS_INVALID' });
    const targetAllowed = scope?.domain === 'ATHLETE'
      ? hidden_proposal.target_contract === ATHLETE_MUTATION_TARGET
      : ALLOWED_MUTATION_TARGETS[hidden_proposal.proposal_type]?.includes(hidden_proposal.target_contract);
    if (!targetAllowed) {
      return deepFreeze({ ok: false, code: 'AFW05_MUTATION_TARGET_DENIED' });
    }
    if (hidden_proposal.confirmation_required !== true) return deepFreeze({ ok: false, code: 'AFW05_EXPLICIT_CONFIRMATION_REQUIRED' });
    if (itemPolicy.affected_objects.includes('UNRESOLVED')) return deepFreeze({ ok: false, code: 'AFW05_GOVERNED_OBJECT_PATH_INVALID' });
  }
  const body = {
    contract_id: 'governed_change_proposal',
    schema_version: AFW05_VERSION,
    proposal_id: hidden_proposal.proposal_id,
    proposal_class: classification,
    proposal_type: hidden_proposal.proposal_type,
    target_contract: hidden_proposal.target_contract,
    operation: hidden_proposal.operation,
    scope: clone(scope),
    scope_hash: scopeFingerprint(scope),
    source_session_id: hidden_proposal.session_id,
    source_state_packet_hash: source_state_packet.packet_hash,
    source_frontier_proposal_hash: hidden_proposal.proposal_hash,
    summary: hidden_proposal.proposed_payload?.summary || hidden_proposal.reason,
    reason: hidden_proposal.reason,
    proposed_items: items,
    evidence_ref_ids: [...hidden_proposal.evidence_ref_ids],
    authority_ref_ids: [...hidden_proposal.authority_ref_ids],
    affected_governed_objects: itemPolicy.affected_objects,
    supersedes_event_ids: [...new Set(supersedes_event_ids)].sort(),
    retracts_event_ids: [...new Set(retracts_event_ids)].sort(),
    expected_prior_publication_version: current_publication.publication_version,
    expected_prior_publication_hash: current_publication.publication_hash,
    confirmation_required: classification === 'DURABLE_MUTATION_PROPOSED',
    status: classification === 'DURABLE_MUTATION_PROPOSED'
      ? (scope?.domain === 'ATHLETE' ? 'AWAITING_JOINT_DECISION' : 'AWAITING_CUSTOMER_DECISION')
      : 'ADVISORY_COMPLETE',
    created_at: new Date(created_at).toISOString(),
    mutation_performed: false,
  };
  return deepFreeze({ ok: true, code: 'AFW05_GOVERNED_PROPOSAL_CREATED', proposal: { ...body, proposal_hash: hashCanonicalJson(body) } });
}

export function validateGovernedChangeProposal(value) {
  const errors = [];
  if (!isObject(value) || value.contract_id !== 'governed_change_proposal' || value.schema_version !== AFW05_VERSION) errors.push('PROPOSAL_HEADER_INVALID');
  try { if (value.scope_hash !== scopeFingerprint(value.scope)) errors.push('PROPOSAL_SCOPE_HASH_INVALID'); } catch { errors.push('PROPOSAL_SCOPE_INVALID'); }
  if (!['DURABLE_MUTATION_PROPOSED', 'ADVISORY_ONLY'].includes(value.proposal_class)) errors.push('PROPOSAL_CLASS_INVALID');
  if (!validHash(value.source_state_packet_hash) || !validHash(value.source_frontier_proposal_hash)
    || !validHash(value.expected_prior_publication_hash) || !validHash(value.proposal_hash)) errors.push('PROPOSAL_HASH_FIELD_INVALID');
  if (!Number.isInteger(value.expected_prior_publication_version) || value.expected_prior_publication_version < 1) errors.push('PROPOSAL_PRIOR_VERSION_INVALID');
  if (!validTimestamp(value.created_at) || value.proposal_hash !== contentHash(value, 'proposal_hash')) errors.push('PROPOSAL_INTEGRITY_INVALID');
  const itemPolicy = mutationItemsForScope(value?.proposed_items, value?.scope);
  if (value.proposal_class === 'DURABLE_MUTATION_PROPOSED' && (!itemPolicy.valid || value.confirmation_required !== true)) errors.push('PROPOSAL_MUTATION_CONTRACT_INVALID');
  if (value?.scope?.domain === 'ATHLETE' && value.proposal_class === 'DURABLE_MUTATION_PROPOSED'
    && (value.target_contract !== ATHLETE_MUTATION_TARGET || value.status !== 'AWAITING_JOINT_DECISION')) errors.push('PROPOSAL_ATHLETE_DOMAIN_CONTRACT_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function createProposalDecision({ proposal, decision, actor, edited_items = [], decided_at, note = null, joint_authority = null }) {
  const proposalValidation = validateGovernedChangeProposal(proposal);
  if (!proposalValidation.valid) return deepFreeze({ ok: false, code: 'AFW05_PROPOSAL_CONTRACT_INVALID', errors: proposalValidation.errors });
  if (!PROPOSAL_DECISIONS.includes(decision)) return deepFreeze({ ok: false, code: 'AFW05_DECISION_INVALID' });
  if (proposal.proposal_class !== 'DURABLE_MUTATION_PROPOSED') return deepFreeze({ ok: false, code: 'AFW05_ADVISORY_PROPOSAL_NOT_DECIDABLE' });
  const athleteScope = proposal.scope?.domain === 'ATHLETE';
  if (athleteScope) {
    if (actor?.actor_type !== 'JOINT_AUTHORITY' || actor.actor_ref !== proposal.scope.athlete_relationship_id) {
      return deepFreeze({ ok: false, code: 'AFW05_ATHLETE_JOINT_AUTHORITY_REQUIRED' });
    }
  } else if (actor?.actor_type !== 'CUSTOMER' || actor.actor_ref !== proposal.scope.subject_id) {
    return deepFreeze({ ok: false, code: 'AFW05_CUSTOMER_DECISION_ACTOR_REQUIRED' });
  }
  if (decision === 'EDIT' && !validItems(edited_items, athleteScope ? 12 : 8, athleteScope ? 1200 : 600)) return deepFreeze({ ok: false, code: 'AFW05_EDITED_ITEMS_REQUIRED' });
  if (decision !== 'EDIT' && edited_items.length) return deepFreeze({ ok: false, code: 'AFW05_EDITED_ITEMS_UNEXPECTED' });
  const effectiveItems = decision === 'EDIT' ? clone(edited_items) : clone(proposal.proposed_items);
  const itemPolicy = mutationItemsForScope(effectiveItems, proposal.scope);
  if (['CONFIRM', 'EDIT'].includes(decision) && (!itemPolicy.valid || itemPolicy.affected_objects.includes('UNRESOLVED'))) {
    return deepFreeze({ ok: false, code: 'AFW05_GOVERNED_OBJECT_PATH_INVALID' });
  }
  if (athleteScope && !athleteJointAuthorityValid(joint_authority, { proposal, decision, effectiveItems })) {
    return deepFreeze({ ok: false, code: 'AFW05_ATHLETE_JOINT_AUTHORITY_RECEIPT_INVALID' });
  }
  const body = {
    contract_id: 'governed_proposal_decision',
    schema_version: AFW05_VERSION,
    decision_id: `decision_${hashCanonicalJson({ proposal_hash: proposal.proposal_hash, decision, effectiveItems, actor, decided_at, joint_authority_hash: athleteScope ? joint_authority.authority_hash : null }).slice(0, 24)}`,
    proposal_id: proposal.proposal_id,
    proposal_hash: proposal.proposal_hash,
    scope: clone(proposal.scope),
    scope_hash: proposal.scope_hash,
    decision,
    actor: clone(actor),
    effective_items: effectiveItems,
    note,
    expected_prior_publication_version: proposal.expected_prior_publication_version,
    expected_prior_publication_hash: proposal.expected_prior_publication_hash,
    decided_at: new Date(decided_at).toISOString(),
    mutation_authorized: ['CONFIRM', 'EDIT'].includes(decision),
    ...(athleteScope ? { joint_authority: clone(joint_authority) } : {}),
  };
  return deepFreeze({ ok: true, code: 'AFW05_PROPOSAL_DECISION_CREATED', decision: { ...body, decision_hash: hashCanonicalJson(body) } });
}

export function validateProposalDecision(value, proposal) {
  const errors = [];
  if (!isObject(value) || value.contract_id !== 'governed_proposal_decision' || value.schema_version !== AFW05_VERSION) errors.push('DECISION_HEADER_INVALID');
  if (!PROPOSAL_DECISIONS.includes(value?.decision) || !validHash(value?.decision_hash) || value.decision_hash !== contentHash(value, 'decision_hash')) errors.push('DECISION_INTEGRITY_INVALID');
  if (!sameScope(value?.scope, proposal?.scope) || value?.scope_hash !== proposal?.scope_hash || value?.proposal_hash !== proposal?.proposal_hash) errors.push('DECISION_PROPOSAL_BINDING_INVALID');
  const athleteScope = proposal?.scope?.domain === 'ATHLETE';
  if (athleteScope) {
    if (value?.actor?.actor_type !== 'JOINT_AUTHORITY' || value?.actor?.actor_ref !== proposal?.scope?.athlete_relationship_id
      || !athleteJointAuthorityValid(value?.joint_authority, {
        proposal,
        decision: value?.decision,
        effectiveItems: value?.effective_items,
      })) errors.push('DECISION_ACTOR_INVALID');
  } else if (value?.actor?.actor_type !== 'CUSTOMER' || value?.actor?.actor_ref !== proposal?.scope?.subject_id
    || Object.hasOwn(value || {}, 'joint_authority')) errors.push('DECISION_ACTOR_INVALID');
  if (!validTimestamp(value?.decided_at) || value?.mutation_authorized !== ['CONFIRM', 'EDIT'].includes(value?.decision)) errors.push('DECISION_STATE_INVALID');
  return deepFreeze({ valid: errors.length === 0, errors });
}

export function validatePublicationHash(value) {
  return Boolean(value?.publication_hash && validHash(value.publication_hash) && value.publication_hash === contentHash(value, 'publication_hash'));
}
