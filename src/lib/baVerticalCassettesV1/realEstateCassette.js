import { deepFreeze } from './contracts.js';

export const REAL_ESTATE_INTAKE_CONTRACT_ID = 'real-estate-business-assessment-intake-v1';
export const REAL_ESTATE_INTAKE_CONTRACT_VERSION = '1.0.0';
export const REAL_ESTATE_INTAKE_CONTRACT_SHA256 =
  'fd2fd783fbf1576c8283d8fa88aa64cca55338ad1f6ca6ffc4eb4b8f68d79a3b';

export const REAL_ESTATE_EVIDENCE_CONTRACT_ID = 'real-estate-business-evidence-routing-v1';
export const REAL_ESTATE_EVIDENCE_CONTRACT_VERSION = '1.0.0';
export const REAL_ESTATE_EVIDENCE_CONTRACT_SHA256 =
  'c6646f3adab48400c0bb76506c910e2984ed98a8926e9e5d596addccb5d31e8f';

export const REAL_ESTATE_CASSETTE_MANIFEST_SHA256 =
  'e9d2e0f35644f6afcc2135f738eaff8b53076482fe1e5d41b1a92874ad84a7d1';
export const REAL_ESTATE_CASSETTE_REGISTRY_SHA256 =
  '68b48a79241aece3d41f2cd685dd24074dcb1aae321a8ee217f5b05902229812';

export const REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_ID = 'real-estate-box-1-projection-v1';
export const REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_VERSION = '1.0.0';
export const REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_SHA256 =
  '8fb61be306b995a5e02a3f95f85164eb2e1045d07671b6f10497c80e92ca6d21';
export const REAL_ESTATE_UNIVERSAL_DOWNSTREAM_MISSIONS = deepFreeze([
  'WHY',
  'FUTURES',
  'MOVE',
  'PLAN',
  'EVIDENCE',
]);
export const REAL_ESTATE_BOX_1_PROJECTION_CONTRACT = deepFreeze({
  contract_id: REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_ID,
  version: REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_VERSION,
  adapter_id: 'real-profile-governed-metric-evidence-projection-v6',
  scope: 'BOX_1_ONLY',
  universal_downstream_missions: REAL_ESTATE_UNIVERSAL_DOWNSTREAM_MISSIONS,
});

export const REAL_ESTATE_INTAKE_QUESTIONS = deepFreeze([
  { key: 'q1', purpose: 'Business Awareness Reality', title: 'Do you currently have enough leads and opportunities to achieve your goals?', prompt: 'Why or why not?\n\nBe specific.', rows: 8 },
  { key: 'q2', purpose: 'Desired Future', title: 'What are your goals over the next:', prompt: '• 12 months\n• 24 months\n• 36 months\n\nAnd where would you like your business and life to be in 5–7 years?\n\nBe specific.', rows: 10 },
  { key: 'q3', purpose: 'Relationship Asset Reality', title: 'How many people are currently in your database?', prompt: 'Of those, approximately how many are true relationships?\n\n(True relationships = people who know you and think of you when it is time to buy, sell, or refer.)', rows: 8 },
  { key: 'q4', purpose: 'Business Generation Behavior', title: 'If I asked you to generate business today and meet three new people before the day ended, what would you do?', prompt: 'Be specific.', rows: 8 },
  { key: 'q5', purpose: 'Database Intelligence', title: 'Describe your database and follow-up system.', prompt: 'Include:\n\n• CRM\n• database size\n• database organization\n• A+, A, B, C, D segmentation if applicable\n• vendor database if applicable\n• frequency of contact\n• follow-up process\n• strengths\n• weaknesses', rows: 12 },
  { key: 'q6', purpose: 'Lead Generation Reality', title: 'What lead generation activities are you willing to do consistently?', prompt: 'What lead generation activities are you unwilling to do?\n\nWhy?', rows: 9 },
  { key: 'q7', purpose: 'Accountability Reality', title: 'Who is holding you accountable?', prompt: 'Describe:\n\n• coach\n• manager\n• team leader\n• spouse\n• accountability partner\n• nobody\n\nHow effective is that accountability?', rows: 11 },
  { key: 'q8', purpose: 'Systems Reality', title: 'Describe your business systems.', prompt: 'Include:\n\n• listing process\n• buyer process\n• lead conversion\n• transaction management\n• recruiting process if applicable\n\nWhat works?\n\nWhat is missing?', rows: 12 },
  { key: 'q9', purpose: 'Financial Reality', title: 'Provide as much business and financial information as you are willing to share.', prompt: 'Examples:\n\n• units closed\n• sales volume\n• average sales price\n• revenue\n• GCI\n• expenses\n• profit\n• marketing spend\n• P&L summaries\n• annual results\n• quarterly results\n• business notes\n• financial observations\n\nThe more information provided, the higher the confidence of the analysis.', rows: 18 },
  { key: 'q10', purpose: 'Constraint Reality', title: 'What do you believe is currently limiting your growth?', prompt: 'What is the biggest problem in the business today?\n\nIf I could wave a magic wand and solve one problem immediately, what would it be?', rows: 10 },
  { key: 'q11', purpose: 'Team Reality', title: 'If you have a team:', prompt: 'Enter team member Profile IDs.\n\nInclude:\n\n• role\n• production level\n• brief notes if helpful\n\nIf you do not have a team, leave blank.', rows: 12 },
  { key: 'q12', purpose: 'Scaling Reality', title: 'Imagine your goals were tripled overnight.', prompt: 'What would have to change for that outcome to become possible?\n\nWhat is the first thing that breaks?', rows: 10 },
]);

export const REAL_ESTATE_QUESTION_AUTHORITY = deepFreeze({
  q1: { purpose: 'Business Awareness Reality', primary_domain: 'demand', secondary_domains: ['pipeline', 'goals'], customer_question: 'How customers currently become aware of the business', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'EVIDENCE'] },
  q2: { purpose: 'Desired Future', primary_domain: 'goals', secondary_domains: ['stage', 'capacity'], customer_question: 'The business outcome the owner wants to create', affected_surfaces: ['NOW', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] },
  q3: { purpose: 'Relationship Asset Reality', primary_domain: 'relationship', secondary_domains: ['demand'], customer_question: 'The current relationship asset and how it contributes to demand', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'EVIDENCE'] },
  q4: { purpose: 'Business Generation Behavior', primary_domain: 'demand', secondary_domains: ['relationship', 'conversion'], customer_question: 'How the business currently creates new opportunities', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'EVIDENCE'] },
  q5: { purpose: 'Database Intelligence', primary_domain: 'relationship', secondary_domains: ['pipeline', 'conversion', 'operations'], customer_question: 'How relationship and database intelligence is organized and used', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] },
  q6: { purpose: 'Lead Generation Reality', primary_domain: 'demand', secondary_domains: ['capacity', 'operations'], customer_question: 'How lead generation currently operates', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'PLAN', 'EVIDENCE'] },
  q7: { purpose: 'Accountability Reality', primary_domain: 'accountability', secondary_domains: ['operations', 'team'], customer_question: 'How accountability currently works', affected_surfaces: ['NOW', 'WHY', 'MOVE', 'PLAN', 'EVIDENCE'] },
  q8: { purpose: 'Systems Reality', primary_domain: 'operations', secondary_domains: ['listing', 'buyer', 'conversion', 'transaction'], customer_question: 'Which operating systems exist and how consistently they work', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] },
  q9: { purpose: 'Financial Reality', primary_domain: 'financial', secondary_domains: ['stage', 'capacity'], customer_question: 'The current financial reality of the business', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'PLAN', 'EVIDENCE'] },
  q10: { purpose: 'Constraint Reality', primary_domain: 'constraints', secondary_domains: ['capacity', 'operations'], customer_question: 'The most important current business constraint', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] },
  q11: { purpose: 'Team Reality', primary_domain: 'team', secondary_domains: ['capacity', 'accountability'], customer_question: 'The current team structure, ownership, and capacity', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] },
  q12: { purpose: 'Scaling Reality', primary_domain: 'capacity', secondary_domains: ['stage', 'team', 'operations'], customer_question: 'What currently limits or enables the business to scale', affected_surfaces: ['NOW', 'WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'] },
});

export const REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS = deepFreeze([
  { mission_id: 'GOAL_ANCHOR', questions: ['q2'], description: 'A governed desired-business outcome is available.' },
  { mission_id: 'DEMAND_RELATIONSHIP_REALITY', questions: ['q1', 'q3', 'q4', 'q5', 'q6'], description: 'At least one governed demand or relationship reality is available.' },
  { mission_id: 'OPERATING_REALITY', questions: ['q5', 'q7', 'q8'], description: 'At least one governed operating, system, or accountability reality is available.' },
  { mission_id: 'CONSTRAINT_ANCHOR', questions: ['q10'], description: 'A governed current constraint is available.' },
  { mission_id: 'SCALING_CAPACITY_ANCHOR', questions: ['q12'], description: 'A governed scaling or capacity reality is available.' },
]);

export const REAL_ESTATE_WBM_AUTHORITY_ROUTE = deepFreeze({
  base: ['RE-01', 'RE-16'],
  domains: {
    financial: ['RE-01', 'RE-16'], demand: ['RE-02', 'RE-03', 'RE-04', 'RE-05', 'RE-06'], relationship: ['RE-02', 'RE-03', 'RE-04'],
    conversion: ['RE-03', 'RE-06'], pipeline: ['RE-06', 'RE-09', 'RE-10'], listing: ['RE-09', 'RE-11'], buyer: ['RE-10', 'RE-11'],
    transaction: ['RE-09', 'RE-10', 'RE-11'], operations: ['RE-11', 'RE-12', 'RE-13'], accountability: ['RE-12', 'RE-14', 'RE-15'],
    capacity: ['RE-11', 'RE-12', 'RE-13', 'RE-14'], team: ['RE-13', 'RE-14', 'RE-15', 'RE-16'], stage: ['RE-12', 'RE-13', 'RE-16'],
    goals: ['RE-13', 'RE-16'], constraints: ['RE-06', 'RE-12', 'RE-13'], market: ['RE-01', 'RE-05', 'RE-16'], dynamic_context: ['RE-01'],
  },
});

export const REAL_ESTATE_CASSETTE_REGISTRATION = deepFreeze({
  contract_version: 'ba-governed-cassette-registration-v1',
  vertical_id: 'real_estate',
  vertical_label: 'Real Estate',
  cassette_id: 'real-estate-cassette-v1',
  cassette_version: '1.0.0',
  supported: true,
  active: true,
  cassette_manifest_sha256: REAL_ESTATE_CASSETTE_MANIFEST_SHA256,
  cassette_registry_sha256: REAL_ESTATE_CASSETTE_REGISTRY_SHA256,
  intake_contract: {
    contract_id: REAL_ESTATE_INTAKE_CONTRACT_ID,
    version: REAL_ESTATE_INTAKE_CONTRACT_VERSION,
    sha256: REAL_ESTATE_INTAKE_CONTRACT_SHA256,
    questions: REAL_ESTATE_INTAKE_QUESTIONS,
    assessment_type_strategy: 'real-estate-team-q11-v1',
    team_profile_question_key: 'q11',
    financial_text_question_key: 'q9',
  },
  evidence_contract: {
    contract_id: REAL_ESTATE_EVIDENCE_CONTRACT_ID,
    version: REAL_ESTATE_EVIDENCE_CONTRACT_VERSION,
    sha256: REAL_ESTATE_EVIDENCE_CONTRACT_SHA256,
    question_authority: REAL_ESTATE_QUESTION_AUTHORITY,
    sufficiency_missions: REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS,
  },
  wbm_authority: {
    library_key: 'real_estate',
    route: REAL_ESTATE_WBM_AUTHORITY_ROUTE,
  },
  box_1_projection: {
    ...REAL_ESTATE_BOX_1_PROJECTION_CONTRACT,
    sha256: REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_SHA256,
    customer_label: 'Your current business snapshot',
  },
  downstream: {
    universal_box_missions: REAL_ESTATE_UNIVERSAL_DOWNSTREAM_MISSIONS,
    five_futures_contract: 'five-futures-v2',
    one_move_contract: 'one-move-v2',
    plan_contract: 'plan-135-v1',
    subscription_vertical_id: 'REAL_ESTATE',
  },
  compatibility: {
    assessment_version: 'business_assessment_v1_intake',
    legacy_assessment_types: ['real_estate_agent', 'real_estate_team'],
    legacy_realization_identity_version: 'new_ba_composite_realization_identity_v2',
  },
});

export function realEstateAssessmentTypeForAnswers(answers = {}) {
  return String(answers.q11 || '').trim() ? 'real_estate_team' : 'real_estate_agent';
}
