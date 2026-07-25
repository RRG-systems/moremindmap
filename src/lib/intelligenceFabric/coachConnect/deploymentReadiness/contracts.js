import crypto from 'node:crypto';
import {
  CONTRACT_VERSIONS,
  FORBIDDEN_SENSITIVE_KEYS,
} from './constants.js';

export const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const isText = (value, max = 512) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max;
export const isOpaque = (value, max = 256) => isText(value, max)
  && !/[@:/\\\s]/u.test(value);
export const isTimestamp = (value) => typeof value === 'string'
  && Number.isFinite(Date.parse(value));
export const isSha256 = (value) => /^[a-f0-9]{64}$/u.test(value ?? '');

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalDigest(value, excluded = []) {
  const excludedKeys = new Set(excluded);
  const source = isObject(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !excludedKeys.has(key)))
    : value;
  return crypto.createHash('sha256')
    .update(JSON.stringify(canonicalize(source)))
    .digest('hex');
}

export function hasSensitiveKey(value) {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, nested]) => (
    FORBIDDEN_SENSITIVE_KEYS.some((forbidden) => (
      key.toLowerCase() === forbidden
      || key.toLowerCase().endsWith(`_${forbidden}`)
    ))
    || hasSensitiveKey(nested)
  ));
}

export function validationResult(errors, value) {
  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    value: errors.length === 0 ? Object.freeze(structuredClone(value)) : null,
  });
}

export function requireVersion(errors, value, field, versionKey) {
  if (value?.[field] !== CONTRACT_VERSIONS[versionKey]) {
    errors.push({ code: 'UNKNOWN_CONTRACT_VERSION', field });
  }
}

export function requireFields(errors, value, fields, code = 'REQUIRED_FIELD_MISSING') {
  for (const field of fields) {
    if (!(field in (value ?? {})) || value[field] == null || value[field] === '') {
      errors.push({ code, field });
    }
  }
}
