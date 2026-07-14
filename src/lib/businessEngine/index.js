export {
  CONTRACT_NAME,
  CONTRACT_VERSION,
  VERTICAL_ADAPTER_VERSION_REAL_ESTATE,
  COMPATIBILITY_MODE_BA_SNAPSHOT,
  SOURCE_TYPES,
  INTELLIGENCE_STATUS,
} from './contractVersion.js';

export { FIELD_SOURCE_PRIORITY } from './fieldSourcePriority.js';
export { buildBusinessEngineContract } from './buildBusinessEngineContract.js';
export {
  validateBusinessEngineContract,
  REQUIRED_TOP_LEVEL_DOMAINS,
} from './validateBusinessEngineContract.js';
export { projectBusinessMapFromContract } from './projectBusinessMapFromContract.js';
export { projectBusinessEngineVisualV2 } from './projectBusinessEngineVisualV2.js';
export {
  REAL_ESTATE_LEGACY_STREAMS,
  REAL_ESTATE_LEGACY_OUTFLOW,
  buildVerticalContext,
  isRealEstateAssessment,
} from './realEstateVerticalAdapter.js';
export {
  TRAJECTORY_DIRECTIONS,
  buildTrajectoryVisualization,
  normalizeVisualizationDirection,
  resolvePotentialTrajectoryDirection,
  isFutureCategoryDirectionLabel,
  formatContractDisplayRows,
  buildCurrentRealityDisplayRows,
  buildPotentialFutureDisplayRows,
  extractAssessmentMetricSources,
} from './contractDisplaySemantics.js';
export {
  buildGoalIntelligence,
  isGoalAvailable,
  GOAL_SOURCES,
  GOAL_TYPES,
} from './goalIntelligence.js';
export {
  buildRealEstateTargetModel,
  computeRelationshipGap,
  targetTrueRelationshipsFromIncome,
  INCOME_PER_TRUE_RELATIONSHIP,
  TRUE_RELATIONSHIP_INCOME_TABLE,
} from './realEstateTargetModel.js';
