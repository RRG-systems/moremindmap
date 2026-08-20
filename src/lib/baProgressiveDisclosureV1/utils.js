export class BaProgressiveDisclosureIntegrityError extends Error {
  constructor(code, detail = '') {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'BaProgressiveDisclosureIntegrityError'
    this.code = code
  }
}

export function invariant(condition, code, detail) {
  if (!condition) throw new BaProgressiveDisclosureIntegrityError(code, detail)
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  Object.values(value).forEach(deepFreeze)
  return value
}

export function unique(values = []) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ''))]
}

export function boundedList(values = [], limit = 6) {
  return unique(values).slice(0, limit)
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function largestRemainder(values, total = 100) {
  invariant(Array.isArray(values) && values.length > 0, 'BA_PD_NORMALIZATION_INPUT_INVALID')
  invariant(values.every((value) => Number.isFinite(value) && value >= 0), 'BA_PD_NORMALIZATION_VALUE_INVALID')
  const sum = values.reduce((accumulator, value) => accumulator + value, 0)
  invariant(sum > 0, 'BA_PD_NORMALIZATION_ZERO_TOTAL')
  const exact = values.map((value) => (value / sum) * total)
  const floors = exact.map(Math.floor)
  let remaining = total - floors.reduce((accumulator, value) => accumulator + value, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  for (let index = 0; index < remaining; index += 1) floors[order[index].index] += 1
  remaining = total - floors.reduce((accumulator, value) => accumulator + value, 0)
  invariant(remaining === 0, 'BA_PD_NORMALIZATION_TOTAL_DRIFT')
  return floors
}

export function asNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? '').replaceAll(',', '').replace(/[^0-9.-]/gu, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function findById(items = [], id) {
  return items.find((item) => item.id === id || item.numerical_id === id)
}

export function findByLabel(items = [], pattern) {
  return items.find((item) => pattern.test(String(item.label || item.customer_label || '')))
}

export function classifyEpistemic(value = '') {
  const token = String(value).toLowerCase()
  if (/contradict|conflict/u.test(token)) return 'CONTRADICTED'
  if (/not measured|not yet known|unknown|missing/u.test(token)) return 'MISSING'
  if (/goal-supporting|modeled requirement|target/u.test(token)) return 'MODELED_REQUIREMENT'
  if (/benchmark|coaching|standard/u.test(token)) return 'BENCHMARK'
  if (/scenario|modeled range/u.test(token)) return 'MODELED_RANGE'
  if (/calculated|derived|estimate/u.test(token)) return 'CALCULATED'
  if (/infer|hypothesis|tentative/u.test(token)) return 'INFERRED'
  if (/probability/u.test(token)) return 'MODEL_ESTIMATED_PROBABILITY'
  return 'REPORTED'
}

export function textArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim())
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}
