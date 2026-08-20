import { canonicalHash, canonicalJson } from '../wholeBusinessModelV1/canonical.js'

export { canonicalHash, canonicalJson }

export function invariant(condition, code, message, details = {}) {
  if (!condition) {
    const error = new Error(message)
    error.name = 'BaV2RuntimeIntegrityError'
    error.code = code
    error.details = details
    throw error
  }
}

export function unique(values = []) {
  return [...new Set(values.filter(Boolean))]
}

export function clone(value) {
  return value == null ? value : structuredClone(value)
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

export function hashWithout(object, fields = []) {
  const copy = clone(object)
  for (const field of fields) delete copy[field]
  return canonicalHash(copy)
}

export function words(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean)
}

export function sentence(text, fallback = 'The governed evidence does not yet support a more specific statement.') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  return normalized || fallback
}

