import { deepFreeze } from '../../intelligenceFabric/validation.js';

export const AFW05_VERSION = '1.0.0';

export const PROPOSAL_DECISIONS = deepFreeze([
  'CONFIRM',
  'EDIT',
  'REJECT',
  'DEFER',
]);

export const MUTATING_PROPOSAL_TYPES = deepFreeze([
  'EVIDENCE_CANDIDATE',
  'CORRECTION_CANDIDATE',
  'COMMITMENT_CANDIDATE',
  'PLAN_CHANGE_CANDIDATE',
]);

export const ADVISORY_PROPOSAL_TYPES = deepFreeze([
  'QUESTION',
  'RESEARCH_CANDIDATE',
  'NO_MUTATION',
]);

export const PROPOSAL_EVENT_TYPES = deepFreeze({
  EVIDENCE_CANDIDATE: 'EVIDENCE_ASSERTED',
  CORRECTION_CANDIDATE: 'CORRECTION',
  COMMITMENT_CANDIDATE: 'COMMITMENT',
  PLAN_CHANGE_CANDIDATE: 'PLAN_CHANGE',
});

export const LIVING_TWIN_BOXES = deepFreeze([
  'WHERE_YOU_ARE',
  'FIVE_FUTURES',
  'ONE_MOVE',
  'PLAN_135',
  'EVIDENCE',
]);

export const ALLOWED_MUTATION_TARGETS = deepFreeze({
  EVIDENCE_CANDIDATE: ['EVIDENCE_LEDGER', 'LIVING_BUSINESS_STATE'],
  CORRECTION_CANDIDATE: ['EVIDENCE_LEDGER', 'LIVING_BUSINESS_STATE'],
  COMMITMENT_CANDIDATE: ['LIVING_BUSINESS_STATE', 'PLAN_135'],
  PLAN_CHANGE_CANDIDATE: ['PLAN_135'],
});

export const LIVING_RELATIONSHIP_POLICY = deepFreeze({
  policy_id: 'subscription_v1_afw05_living_business_relationship',
  policy_version: AFW05_VERSION,
  mutation_before_confirmation: false,
  provider_authored_canonical_truth: false,
  deterministic_recomputation: true,
  complete_publication_only: true,
  atomic_pointer_advance: true,
  partial_publication_allowed: false,
  raw_transcript_canonical: false,
  universal_rsl_runtime_read: false,
  universal_rsl_promotion: false,
  coach_connect_activation: false,
});
