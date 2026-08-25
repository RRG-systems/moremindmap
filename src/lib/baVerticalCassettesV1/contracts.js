export const BA_VERTICAL_SELECTION_CONTRACT_VERSION = 'ba-vertical-selection-v1';

export const BA_VERTICAL_SELECTION_CONFIRMATION = 'CUSTOMER_CONFIRMED';

export const BA_VERTICAL_SELECTION_SOURCES = Object.freeze([
  'CUSTOMER_CONFIRMED',
  'LEGACY_EXPLICIT_COMPATIBILITY',
]);

export const BA_VERTICAL_FAILURE_CODES = Object.freeze({
  SELECTION_REQUIRED: 'BA_VERTICAL_SELECTION_REQUIRED',
  SELECTION_MALFORMED: 'BA_VERTICAL_SELECTION_MALFORMED',
  SELECTION_UNSUPPORTED: 'BA_VERTICAL_SELECTION_UNSUPPORTED',
  SELECTION_UNCONFIRMED: 'BA_VERTICAL_SELECTION_UNCONFIRMED',
  REGISTRATION_MISSING: 'BA_CASSETTE_REGISTRATION_MISSING',
  BINDING_MISMATCH: 'BA_CASSETTE_BINDING_MISMATCH',
  AUTHORITY_HASH_MISMATCH: 'BA_CASSETTE_AUTHORITY_HASH_MISMATCH',
  CROSS_CASSETTE_CONTAMINATION: 'BA_CROSS_CASSETTE_CONTAMINATION',
  LEGACY_IDENTITY_AMBIGUOUS: 'BA_LEGACY_VERTICAL_IDENTITY_AMBIGUOUS',
});

export const BA_VERTICAL_CUSTOMER_SAFE_UNAVAILABLE_MESSAGE =
  'Business Assessment is not yet available for that business type. Your profile and customer information have not been changed.';

export const BA_VERTICAL_CUSTOMER_SAFE_CONFIRMATION_MESSAGE =
  'Confirm your business type before continuing to the Business Assessment.';

export class BaVerticalContractError extends Error {
  constructor(code, internalDetail = '') {
    super(code);
    this.name = 'BaVerticalContractError';
    this.code = code;
    this.internal_detail = internalDetail;
  }
}

export function stableCanonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(stableCanonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableCanonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
