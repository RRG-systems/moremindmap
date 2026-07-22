export const DURABLE_CORE_CONTRACT_VERSION = '1.0.0';

export const DURABLE_OBJECT_TYPES = Object.freeze([
  'UserIntentState', 'UserEvidenceLedger', 'RealEstateKnowledgeGraph',
  'HumanJudgmentAuthority', 'CoachingInterventionLibrary', 'MarketContextGraph',
  'OutcomeValidationLedger', 'AuthorityConflictGraph', 'BeliefState', 'BusinessEngineState',
  'BusinessEngineStateVersion', 'FutureState', 'FutureProbabilityChange',
  'InterventionState', 'InterventionEvent', 'ConversationSession', 'ConversationEvent',
  'EvidenceGap', 'ConfidenceState', 'ExplanationTrace', 'LearningPromotionRecord',
  'ExperimentRecord', 'VerticalOperatingPolicy',
]);

export const OBJECT_KINDS = Object.freeze({
  UserIntentState: 'STATE', UserEvidenceLedger: 'LEDGER', RealEstateKnowledgeGraph: 'GRAPH',
  HumanJudgmentAuthority: 'LEDGER', CoachingInterventionLibrary: 'LIBRARY', MarketContextGraph: 'GRAPH',
  OutcomeValidationLedger: 'LEDGER', AuthorityConflictGraph: 'GRAPH', BeliefState: 'STATE_GRAPH',
  BusinessEngineState: 'STATE', BusinessEngineStateVersion: 'VERSION', FutureState: 'STATE',
  FutureProbabilityChange: 'RECEIPT', InterventionState: 'STATE', InterventionEvent: 'EVENT',
  ConversationSession: 'STATE', ConversationEvent: 'EVENT', EvidenceGap: 'STATE',
  ConfidenceState: 'STATE', ExplanationTrace: 'RECEIPT', LearningPromotionRecord: 'RECORD',
  ExperimentRecord: 'RECORD', VerticalOperatingPolicy: 'POLICY',
});

export const OBJECT_AUTHORITY = Object.freeze({
  UserIntentState: 'USER_DIRECTION', UserEvidenceLedger: 'USER_EVIDENCE',
  RealEstateKnowledgeGraph: 'DOMAIN_KNOWLEDGE', HumanJudgmentAuthority: 'PRIVATE_HUMAN_JUDGMENT',
  CoachingInterventionLibrary: 'UNIVERSAL_COACHING', MarketContextGraph: 'MARKET_CONTEXT',
  OutcomeValidationLedger: 'INTERVENTION_OUTCOME', AuthorityConflictGraph: 'GOVERNANCE_CONFLICT',
  BeliefState: 'GOVERNANCE_CONFLICT', BusinessEngineState: 'USER_EVIDENCE',
  BusinessEngineStateVersion: 'USER_EVIDENCE', FutureState: 'GOVERNANCE_CONFLICT',
  FutureProbabilityChange: 'GOVERNANCE_CONFLICT', InterventionState: 'INTERVENTION_OUTCOME',
  InterventionEvent: 'INTERVENTION_OUTCOME', ConversationSession: 'USER_DIRECTION',
  ConversationEvent: 'USER_DIRECTION', EvidenceGap: 'GOVERNANCE_CONFLICT',
  ConfidenceState: 'GOVERNANCE_CONFLICT', ExplanationTrace: 'GOVERNANCE_CONFLICT',
  LearningPromotionRecord: 'GOVERNANCE_CONFLICT', ExperimentRecord: 'INTERVENTION_OUTCOME',
  VerticalOperatingPolicy: 'DOMAIN_KNOWLEDGE',
});

export const OBJECT_TRUTH_CLASS = Object.freeze({
  UserIntentState: 'PERSONAL_TRUTH', UserEvidenceLedger: 'OBSERVED_TRUTH',
  RealEstateKnowledgeGraph: 'DOMAIN_TRUTH', HumanJudgmentAuthority: 'PERSONAL_TRUTH',
  CoachingInterventionLibrary: 'INTERVENTION_TRUTH', MarketContextGraph: 'DOMAIN_TRUTH',
  OutcomeValidationLedger: 'INTERVENTION_TRUTH', AuthorityConflictGraph: 'INTERVENTION_TRUTH',
  BeliefState: 'INTERVENTION_TRUTH', BusinessEngineState: 'OBSERVED_TRUTH',
  BusinessEngineStateVersion: 'OBSERVED_TRUTH', FutureState: 'INTERVENTION_TRUTH',
  FutureProbabilityChange: 'INTERVENTION_TRUTH', InterventionState: 'INTERVENTION_TRUTH',
  InterventionEvent: 'INTERVENTION_TRUTH', ConversationSession: 'PERSONAL_TRUTH',
  ConversationEvent: 'PERSONAL_TRUTH', EvidenceGap: 'INTERVENTION_TRUTH',
  ConfidenceState: 'INTERVENTION_TRUTH', ExplanationTrace: 'INTERVENTION_TRUTH',
  LearningPromotionRecord: 'INTERVENTION_TRUTH', ExperimentRecord: 'INTERVENTION_TRUTH',
  VerticalOperatingPolicy: 'DOMAIN_TRUTH',
});

export const INTERVENTION_STATUSES = Object.freeze([
  'PROPOSED', 'DISCUSSED', 'ACCEPTED', 'ACTIVE', 'BLOCKED', 'COMPLETED', 'VALIDATED',
  'REPLACED', 'REJECTED', 'DEFERRED',
]);

export const INTERVENTION_TRANSITIONS = Object.freeze({
  PROPOSED: ['DISCUSSED', 'REJECTED', 'DEFERRED'], DISCUSSED: ['ACCEPTED', 'REJECTED', 'DEFERRED'],
  ACCEPTED: ['ACTIVE', 'DEFERRED'], ACTIVE: ['BLOCKED', 'COMPLETED'], BLOCKED: ['ACTIVE', 'REPLACED', 'DEFERRED'],
  COMPLETED: ['VALIDATED'], VALIDATED: ['REPLACED'], REPLACED: [], REJECTED: [], DEFERRED: ['DISCUSSED', 'REPLACED'],
});

export const LEARNING_STATES = Object.freeze([
  'ANECDOTAL', 'OBSERVED', 'SUPPORTED', 'REPLICATED', 'VALIDATED', 'CANONICAL', 'REJECTED', 'RETIRED',
]);

export const LEARNING_TRANSITIONS = Object.freeze({
  ANECDOTAL: ['OBSERVED', 'REJECTED'], OBSERVED: ['SUPPORTED', 'REJECTED'],
  SUPPORTED: ['REPLICATED', 'REJECTED'], REPLICATED: ['VALIDATED', 'REJECTED'],
  VALIDATED: ['CANONICAL', 'REJECTED'], CANONICAL: ['RETIRED'], REJECTED: [], RETIRED: [],
});

export const CONVERSATION_EVENT_TYPES = Object.freeze([
  'ASSISTANT_OPENING', 'QUESTION', 'USER_RESPONSE', 'EXTRACTION_PROPOSAL', 'CONFIRMATION',
  'CORRECTION', 'DEFERRAL', 'EVIDENCE_CAPTURE_CANDIDATE', 'EXPLANATION_REQUEST',
  'CHALLENGE', 'ALTERNATIVE_REQUEST', 'FREE_FORM_TRANSITION',
]);

export const CONFIDENCE_DIMENSIONS = Object.freeze([
  'evidence_completeness', 'evidence_quality', 'state_confidence', 'belief_confidence',
  'future_confidence', 'intervention_confidence', 'market_context_confidence',
]);
