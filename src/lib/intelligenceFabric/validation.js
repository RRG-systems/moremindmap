import { VALIDATION_ERROR_CODES } from './constants.js';

export function issue(code, path, message, severity = 'ERROR', details = {}) {
  return { code, path, message, severity, expected: details.expected ?? null,
    received: details.received ?? null, related_ids: details.related_ids ?? [] };
}

export function validationResult(contract_name, errors, warnings = [], normalized_value = null) {
  return Object.freeze({ valid: errors.length === 0, errors, warnings, normalized_value,
    contract_name, contract_version: '1.0.0' });
}

export function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function requireString(value, path, errors) {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(issue(VALIDATION_ERROR_CODES.REQUIRED, path, `${path} must be a non-empty string`));
    return false;
  }
  return true;
}

export function requireEnum(value, allowed, path, errors) {
  if (!allowed.includes(value)) {
    errors.push(issue(VALIDATION_ERROR_CODES.INVALID_ENUM, path, `${path} is not a supported value`, 'ERROR', { expected: allowed, received: value }));
    return false;
  }
  return true;
}

export function isCanonicalTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function validateTimestamp(value, path, errors, required = false) {
  if (value == null && !required) return true;
  if (!isCanonicalTimestamp(value)) {
    errors.push(issue(VALIDATION_ERROR_CODES.INVALID_TIMESTAMP, path, `${path} must be an unambiguous UTC ISO-8601 timestamp`));
    return false;
  }
  return true;
}

export function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return value;
}
