/**
 * Business Engine Contract version constants.
 * Customer-facing fields must never expose internal model names.
 */

export const CONTRACT_NAME = 'business_engine_contract';
export const CONTRACT_VERSION = 'business-engine-contract-v1';
export const VERTICAL_ADAPTER_VERSION_REAL_ESTATE = 'real-estate-vertical-adapter-v1';
export const COMPATIBILITY_MODE_BA_SNAPSHOT = 'ba_snapshot_v1';

export const SNAPSHOT_TREND = 'baseline';
export const SNAPSHOT_REASON_FOR_CHANGE = 'initial assessment snapshot';

export const SOURCE_TYPES = Object.freeze({
  CANONICAL_FUSED: 'canonical_fused_intelligence',
  DOMAIN_INTELLIGENCE: 'domain_intelligence',
  DETERMINISTIC_NORMALIZED: 'deterministic_normalized',
  LEGACY_FALLBACK: 'legacy_fallback',
  HONEST_ABSENCE: 'honest_absence',
});

export const INTELLIGENCE_STATUS = Object.freeze({
  AVAILABLE: 'available',
  PARTIAL: 'partial',
  FALLBACK: 'fallback',
  ABSENT: 'absent',
});
