import { deepFreeze } from './contracts.js';
import questionContract from './loanOriginatorQuestionContract.generated.json' with { type: 'json' };
import typedEvidenceRegistry from '../../../docs/lo-cassette-2-final-canonical-authority-v1/04_CANONICAL_LO_TYPED_ANSWER_EVIDENCE_REGISTRY_V1.json' with { type: 'json' };
import branchingContract from '../../../docs/lo-cassette-2-final-canonical-authority-v1/05_CANONICAL_LO_BRANCHING_APPLICABILITY_SKIP_CONTRACT_V1.json' with { type: 'json' };
import authorityRegistry from '../../../docs/lo-cassette-2-final-canonical-authority-v1/22_CANONICAL_AUTHORITY_ID_REGISTRY_V1.json' with { type: 'json' };
import syntheticAcceptance from '../../../docs/lo-cassette-2-final-canonical-authority-v1/20_CANONICAL_LO_SYNTHETIC_ACCEPTANCE_REGISTRY_V1.json' with { type: 'json' };
import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';

export const LOAN_ORIGINATOR_VERTICAL_ID = 'loan_originator';
export const LOAN_ORIGINATOR_CASSETTE_ID = 'loan-originator-cassette-v1';
export const LOAN_ORIGINATOR_CASSETTE_VERSION = '1.0.0';
export const LOAN_ORIGINATOR_CASSETTE_MANIFEST_SHA256 =
  '1d1b5b04705e453716bcd4fbc73ab080f1c4981570ec6df7026b4d0c4b09cc8d';
export const LOAN_ORIGINATOR_CASSETTE_REGISTRY_SHA256 =
  'c6e94e348fd487451fd983a473a111da507a3d1b201354c236a0238453bb297c';

export const LOAN_ORIGINATOR_INTAKE_CONTRACT_ID = 'loan-originator-business-assessment-intake-v1';
export const LOAN_ORIGINATOR_INTAKE_CONTRACT_VERSION = '1.0.0';
export const LOAN_ORIGINATOR_INTAKE_CONTRACT_SHA256 =
  'e3ba0de40e066a2fbd9ad6c4febb95d2509c15d1b4e39c570feb93287aa29f46';
export const LOAN_ORIGINATOR_QUESTION_ARCHITECTURE_FINGERPRINT =
  'a01b65214f47b5bc999ea1312618ef53cec277b48deda34ce7bf5f3df69b8207';
export const LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_SHA256 =
  '3bc1c47e908278c792099698a89ae93f1ed75503ef8a10b1024ca1a5548f3cf1';
export const LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_FILE_SHA256 =
  'f9a1ccd1712ef5649eec17e5291a9aefaaa741654b14c9faf5dbae755a2267d5';

const generatedQuestionContractSha256 = hashCanonicalJson({
  schema_version: questionContract.schema_version,
  contract_id: questionContract.contract_id,
  source_sha256: questionContract.source_sha256,
  questions: questionContract.questions,
});
if (questionContract.contract_id !== LOAN_ORIGINATOR_INTAKE_CONTRACT_ID
  || questionContract.source_sha256 !== LOAN_ORIGINATOR_INTAKE_CONTRACT_SHA256
  || questionContract.question_architecture_fingerprint !== LOAN_ORIGINATOR_QUESTION_ARCHITECTURE_FINGERPRINT
  || questionContract.generated_contract_sha256 !== LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_SHA256
  || generatedQuestionContractSha256 !== LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_SHA256
  || !Array.isArray(questionContract.questions)
  || questionContract.questions.length !== 15) {
  throw new Error('loan_originator_generated_question_contract_custody_mismatch');
}

export const LOAN_ORIGINATOR_EVIDENCE_CONTRACT_ID = 'loan-originator-governed-business-evidence-v1';
export const LOAN_ORIGINATOR_EVIDENCE_CONTRACT_VERSION = '1.0.0';
export const LOAN_ORIGINATOR_EVIDENCE_CONTRACT_SHA256 =
  '40f23557b3f7e0f91a3128f7f64b30334488425841a8a545f502255033891982';
export const LOAN_ORIGINATOR_BRANCHING_CONTRACT_SHA256 =
  'b8d34a2a012c2c9a3c9a2f68011d318d84b74493bc4e821ceab3177d54089f24';

export const LOAN_ORIGINATOR_BOX_1_PROJECTION_CONTRACT_ID = 'loan-originator-box-1-projection-v1';
export const LOAN_ORIGINATOR_BOX_1_PROJECTION_CONTRACT_VERSION = '1.0.0';
export const LOAN_ORIGINATOR_BOX_1_PROJECTION_CONTRACT_SHA256 =
  'dbd59e1e7c8ce691f7340a49de27157659ee56d3e6587b5b4329f0390429faa9';

export const LOAN_ORIGINATOR_SUBSCRIPTION_CONTEXT_ID = 'loan-originator-subscription-context-v1';
export const LOAN_ORIGINATOR_TYPED_FIELD_COUNT = 145;

export const LOAN_ORIGINATOR_INTAKE_QUESTIONS = deepFreeze(questionContract.questions);
export const LOAN_ORIGINATOR_TYPED_EVIDENCE_REGISTRY = deepFreeze(typedEvidenceRegistry);
export const LOAN_ORIGINATOR_BRANCHING_CONTRACT = deepFreeze(branchingContract);
export const LOAN_ORIGINATOR_SYNTHETIC_ACCEPTANCE = deepFreeze(syntheticAcceptance);

export function resolveLoanOriginatorQuestionPath({
  producingStatus = 'PRODUCING',
  verticalConfirmed = true,
  conditionalMissionIds = [],
  syntheticCaseId = null,
  returningEvidenceSatisfied = false,
} = {}) {
  const core = branchingContract.fresh_producing_path.core_order;
  const frozenPath = syntheticCaseId
    ? branchingContract.fresh_synthetic_replay.find((path) => path.path === syntheticCaseId)
    : null;
  if (syntheticCaseId && !frozenPath) throw new Error(`loan_originator_synthetic_path_unknown:${syntheticCaseId}`);
  if (!verticalConfirmed || producingStatus === 'NON_PRODUCING' || producingStatus === 'UNSUPPORTED') {
    return deepFreeze({
      status: 'TERMINATED_OUT_OF_SCOPE',
      mission_ids: [core[0]],
      question_count: 1,
      box_1_projection_authorized: false,
      downstream_projection_authorized: false,
    });
  }
  if (frozenPath?.terminal === 'OUT_OF_SCOPE') {
    return deepFreeze({
      status: 'TERMINATED_OUT_OF_SCOPE',
      mission_ids: [core[0]],
      question_count: 1,
      box_1_projection_authorized: false,
      downstream_projection_authorized: false,
    });
  }
  if (returningEvidenceSatisfied) {
    return deepFreeze({
      status: 'RETURNING_EVIDENCE_SATISFIED',
      mission_ids: [core[0]],
      skipped_evidence_satisfied: [...branchingContract.evidence_satisfied_negative_control.skipped_evidence_satisfied],
      question_count: 1,
      box_1_projection_authorized: true,
      downstream_projection_authorized: true,
    });
  }
  let conditionals = conditionalMissionIds;
  if (frozenPath) {
    conditionals = frozenPath.conditionals;
  }
  const allowed = branchingContract.fresh_producing_path.conditional_order;
  const unknown = conditionals.find((missionId) => !allowed.includes(missionId));
  if (unknown) throw new Error(`loan_originator_conditional_mission_unsupported:${unknown}`);
  const ordered = allowed.filter((missionId) => conditionals.includes(missionId));
  const missionIds = [...core, ...ordered];
  if (missionIds.length > branchingContract.fresh_producing_path.maximum_questions) {
    throw new Error('loan_originator_question_ceiling_exceeded');
  }
  return deepFreeze({
    status: 'ACTIVE',
    mission_ids: missionIds,
    question_count: missionIds.length,
    box_1_projection_authorized: true,
    downstream_projection_authorized: true,
  });
}

const QUESTION_DOMAINS = Object.freeze({
  LO_CORE_01_BUSINESS_SCOPE: ['stage', 'goals'],
  LO_CORE_02_PRIMARY_GOAL: ['goals', 'financial'],
  LO_CORE_03_PRODUCTION_WINDOWS: ['financial', 'stage'],
  LO_CORE_04_PURPOSE_APPLICABILITY: ['demand', 'market'],
  LO_CORE_05_OPPORTUNITY_SOURCE_NETWORK: ['demand', 'relationship'],
  LO_CORE_06_CUSTOMER_RELATIONSHIP_NETWORK: ['relationship', 'demand'],
  LO_CORE_07_OPPORTUNITY_FUNNEL: ['pipeline', 'conversion'],
  LO_CORE_08_RELATIONSHIP_SYSTEMS: ['operations', 'relationship'],
  LO_CORE_09_TEAM_CAPACITY: ['team', 'capacity'],
  LO_CORE_10_PLATFORM_CAPABILITY: ['operations', 'capacity'],
  LO_CORE_11_OPERATOR_DIAGNOSIS: ['constraints', 'goals'],
  LO_CORE_12_ACCOUNTABILITY_EXECUTION: ['accountability', 'operations'],
  LO_COND_13_CONVERSION_FALLOUT_CYCLE: ['conversion', 'pipeline'],
  LO_COND_14_ECONOMICS: ['financial', 'goals'],
  LO_COND_15_CONTRADICTION_CLARIFICATION: ['constraints', 'dynamic_context'],
});

export const LOAN_ORIGINATOR_QUESTION_AUTHORITY = deepFreeze(Object.fromEntries(
  LOAN_ORIGINATOR_INTAKE_QUESTIONS.map((question) => {
    const [primaryDomain, ...secondaryDomains] = QUESTION_DOMAINS[question.key];
    return [question.key, {
      purpose: question.purpose,
      primary_domain: primaryDomain,
      secondary_domains: secondaryDomains,
      customer_question: question.title,
      affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'],
    }];
  }),
));

export const LOAN_ORIGINATOR_EVIDENCE_SUFFICIENCY_MISSIONS = deepFreeze([
  { mission_id: 'LO_SCOPE', questions: ['LO_CORE_01_BUSINESS_SCOPE'], description: 'Producing Loan Originator scope is governed.' },
  { mission_id: 'LO_GOAL', questions: ['LO_CORE_02_PRIMARY_GOAL'], description: 'The owner supplied a governed business goal or governed missingness.' },
  { mission_id: 'LO_PRODUCTION', questions: ['LO_CORE_03_PRODUCTION_WINDOWS'], description: 'Production reality or governed missingness is available.' },
  { mission_id: 'LO_DEMAND_NETWORKS', questions: ['LO_CORE_05_OPPORTUNITY_SOURCE_NETWORK', 'LO_CORE_06_CUSTOMER_RELATIONSHIP_NETWORK'], description: 'Opportunity and relationship network evidence remains distinct.' },
  { mission_id: 'LO_FUNNEL_SYSTEM_CAPACITY', questions: ['LO_CORE_07_OPPORTUNITY_FUNNEL', 'LO_CORE_08_RELATIONSHIP_SYSTEMS', 'LO_CORE_09_TEAM_CAPACITY', 'LO_CORE_10_PLATFORM_CAPABILITY'], description: 'Funnel, systems, and capacity evidence is governed independently.' },
  { mission_id: 'LO_CONSTRAINT_EXECUTION', questions: ['LO_CORE_11_OPERATOR_DIAGNOSIS', 'LO_CORE_12_ACCOUNTABILITY_EXECUTION'], description: 'Constraint and execution evidence is governed.' },
]);

const MODULES = authorityRegistry.durable_modules;
const ALL_MODULES = Object.freeze(Object.values(MODULES));

export const LOAN_ORIGINATOR_WBM_AUTHORITY_ROUTE = deepFreeze({
  base: [MODULES.business_machine, MODULES.context_boundaries_evidence],
  domains: {
    financial: [MODULES.business_machine, MODULES.context_boundaries_evidence],
    demand: [MODULES.business_machine, MODULES.systems_capacity_constraints],
    relationship: [MODULES.business_machine, MODULES.translation_coaching],
    conversion: [MODULES.business_machine, MODULES.systems_capacity_constraints],
    pipeline: [MODULES.business_machine, MODULES.systems_capacity_constraints],
    listing: [MODULES.context_boundaries_evidence],
    buyer: [MODULES.context_boundaries_evidence],
    transaction: [MODULES.systems_capacity_constraints],
    operations: [MODULES.systems_capacity_constraints, MODULES.business_machine],
    accountability: [MODULES.translation_coaching, MODULES.systems_capacity_constraints],
    capacity: [MODULES.systems_capacity_constraints, MODULES.translation_coaching],
    team: [MODULES.systems_capacity_constraints, MODULES.translation_coaching],
    stage: [MODULES.business_machine, MODULES.context_boundaries_evidence],
    goals: [MODULES.business_machine, MODULES.translation_coaching],
    constraints: [MODULES.systems_capacity_constraints, MODULES.context_boundaries_evidence],
    market: [MODULES.context_boundaries_evidence, MODULES.business_machine],
    dynamic_context: [MODULES.context_boundaries_evidence],
  },
  allowed_authority_ids: ALL_MODULES,
});

export const LOAN_ORIGINATOR_BOX_1_SURFACES = deepFreeze([
  'Your Business Now',
  'Where Your Business Comes From',
  'Your Business Pipeline',
  'Your System & Capacity',
  'What’s Holding You Back',
]);

export const LOAN_ORIGINATOR_CASSETTE_REGISTRATION = deepFreeze({
  contract_version: 'ba-governed-cassette-registration-v1',
  vertical_id: LOAN_ORIGINATOR_VERTICAL_ID,
  vertical_label: 'Loan Originator',
  cassette_id: LOAN_ORIGINATOR_CASSETTE_ID,
  cassette_version: LOAN_ORIGINATOR_CASSETTE_VERSION,
  supported: true,
  active: true,
  cassette_manifest_sha256: LOAN_ORIGINATOR_CASSETTE_MANIFEST_SHA256,
  cassette_registry_sha256: LOAN_ORIGINATOR_CASSETTE_REGISTRY_SHA256,
  intake_contract: {
    contract_id: LOAN_ORIGINATOR_INTAKE_CONTRACT_ID,
    version: LOAN_ORIGINATOR_INTAKE_CONTRACT_VERSION,
    sha256: LOAN_ORIGINATOR_INTAKE_CONTRACT_SHA256,
    question_architecture_fingerprint: LOAN_ORIGINATOR_QUESTION_ARCHITECTURE_FINGERPRINT,
    generated_contract_sha256: LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_SHA256,
    generated_file_sha256: LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_FILE_SHA256,
    questions: LOAN_ORIGINATOR_INTAKE_QUESTIONS,
    core_question_count: 12,
    conditional_question_count: 3,
    assessment_type_strategy: 'loan-originator-producing-scope-v1',
  },
  evidence_contract: {
    contract_id: LOAN_ORIGINATOR_EVIDENCE_CONTRACT_ID,
    version: LOAN_ORIGINATOR_EVIDENCE_CONTRACT_VERSION,
    sha256: LOAN_ORIGINATOR_EVIDENCE_CONTRACT_SHA256,
    branching_contract_sha256: LOAN_ORIGINATOR_BRANCHING_CONTRACT_SHA256,
    question_authority: LOAN_ORIGINATOR_QUESTION_AUTHORITY,
    sufficiency_missions: LOAN_ORIGINATOR_EVIDENCE_SUFFICIENCY_MISSIONS,
    typed_registry: LOAN_ORIGINATOR_TYPED_EVIDENCE_REGISTRY,
    branching_contract: LOAN_ORIGINATOR_BRANCHING_CONTRACT,
    typed_field_count: LOAN_ORIGINATOR_TYPED_FIELD_COUNT,
  },
  wbm_authority: {
    library_key: 'loan_originator',
    route: LOAN_ORIGINATOR_WBM_AUTHORITY_ROUTE,
    authority_root_sha256: LOAN_ORIGINATOR_CASSETTE_MANIFEST_SHA256,
  },
  box_1_projection: {
    contract_id: LOAN_ORIGINATOR_BOX_1_PROJECTION_CONTRACT_ID,
    version: LOAN_ORIGINATOR_BOX_1_PROJECTION_CONTRACT_VERSION,
    adapter_id: 'loan-originator-box-1-projection-v1',
    scope: 'BOX_1_ONLY',
    universal_downstream_missions: ['WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'],
    sha256: LOAN_ORIGINATOR_BOX_1_PROJECTION_CONTRACT_SHA256,
    customer_label: 'Your Loan Origination Business',
    surfaces: LOAN_ORIGINATOR_BOX_1_SURFACES,
  },
  downstream: {
    universal_box_missions: ['WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'],
    five_futures_contract: 'five-futures-v2',
    one_move_contract: 'one-move-v2',
    plan_contract: 'plan-135-v1',
    subscription_vertical_id: 'LOAN_ORIGINATOR',
    subscription_context_id: LOAN_ORIGINATOR_SUBSCRIPTION_CONTEXT_ID,
  },
  compatibility: {
    assessment_version: 'business_assessment_v1_intake',
    legacy_assessment_types: [],
    legacy_realization_identity_version: null,
  },
});
