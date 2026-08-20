import { sha256Text } from '../canonicalSha256.js';

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return sha256Text(value);
}

export function canonicalHash(value) {
  return sha256(canonicalJson(value));
}

export function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
