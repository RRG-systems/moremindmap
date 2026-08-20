import path from 'node:path'

import { canonicalJson, invariant } from './utils.js'

function typeMatches(value, type) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === type
}

function pointer(root, ref) {
  return ref.replace(/^#\//, '').split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root)
}

function resolveRef(ref, rootSchema, schemas) {
  if (ref.startsWith('#/')) return { schema: pointer(rootSchema, ref), root: rootSchema }
  const [fileRef, fragment] = ref.split('#')
  const external = schemas[fileRef] || schemas[path.basename(fileRef)] || Object.values(schemas).find((schema) => schema.$id === fileRef || schema.$id?.endsWith(`/${fileRef}`))
  if (!external) return null
  return { schema: fragment ? pointer(external, `#${fragment}`) : external, root: external }
}

function check(value, schema, location, rootSchema, schemas, errors) {
  if (!schema || typeof schema !== 'object') return
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, rootSchema, schemas)
    if (!resolved) {
      errors.push(`${location}: unresolved $ref ${schema.$ref}`)
      return
    }
    check(value, resolved.schema, location, resolved.root, schemas, errors)
    return
  }
  if (schema.anyOf) {
    const passes = schema.anyOf.some((candidate) => {
      const localErrors = []
      check(value, candidate, location, rootSchema, schemas, localErrors)
      return localErrors.length === 0
    })
    if (!passes) errors.push(`${location}: no anyOf branch matched`)
    return
  }
  if (schema.oneOf) {
    const passCount = schema.oneOf.filter((candidate) => {
      const localErrors = []
      check(value, candidate, location, rootSchema, schemas, localErrors)
      return localErrors.length === 0
    }).length
    if (passCount !== 1) errors.push(`${location}: expected exactly one oneOf branch, got ${passCount}`)
  }
  for (const candidate of schema.allOf || []) check(value, candidate, location, rootSchema, schemas, errors)
  if (schema.if) {
    const conditionalErrors = []
    check(value, schema.if, location, rootSchema, schemas, conditionalErrors)
    if (conditionalErrors.length === 0 && schema.then) check(value, schema.then, location, rootSchema, schemas, errors)
  }
  if (schema.const !== undefined && canonicalJson(value) !== canonicalJson(schema.const)) errors.push(`${location}: value does not match const`)
  if (schema.enum && !schema.enum.some((candidate) => canonicalJson(value) === canonicalJson(candidate))) errors.push(`${location}: value is not in enum`)
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((type) => typeMatches(value, type))) {
      errors.push(`${location}: expected ${types.join('|')}`)
      return
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${location}: shorter than minLength`)
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${location}: longer than maxLength`)
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) errors.push(`${location}: pattern mismatch`)
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${location}: below minimum`)
    if (schema.maximum != null && value > schema.maximum) errors.push(`${location}: above maximum`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${location}: fewer than minItems`)
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${location}: more than maxItems`)
    if (schema.uniqueItems && new Set(value.map(canonicalJson)).size !== value.length) errors.push(`${location}: duplicate array items`)
    value.forEach((item, index) => check(item, schema.items, `${location}[${index}]`, rootSchema, schemas, errors))
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const required of schema.required || []) {
      if (!(required in value)) errors.push(`${location}: missing required property ${required}`)
    }
    if (schema.additionalProperties === false && schema.properties) {
      for (const key of Object.keys(value)) if (!(key in schema.properties)) errors.push(`${location}: additional property ${key}`)
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.properties?.[key]) check(child, schema.properties[key], `${location}.${key}`, rootSchema, schemas, errors)
    }
  }
}

export function validateAgainstSchema(value, schema, schemas = {}) {
  const errors = []
  check(value, schema, '$', schema, schemas, errors)
  return { pass: errors.length === 0, errors }
}

export function assertSchema(value, schema, schemas = {}, label = 'artifact') {
  const result = validateAgainstSchema(value, schema, schemas)
  invariant(result.pass, 'SCHEMA_VALIDATION', `${label} failed the frozen schema contract.`, { errors: result.errors })
  return result
}

