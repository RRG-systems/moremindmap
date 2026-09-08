import { hashCanonicalJson } from '../intelligenceFabric/hashing.js'

export const LIVING_CONSULT_CONTRACT = 'more-athlete-living-consult-v1'
export const LIVING_CONSULT_VERSION = '1.0.0-synthetic-local'
export const LIVING_CONSULT_NAMESPACE = 'more-athlete-living-consult-v1:synthetic:mara-rowan'

export const SYNTHETIC_IDENTITIES = Object.freeze({
  subjectId: 'synthetic-athlete-mara-lcv1',
  athleteId: 'synthetic-athlete-mara-lcv1',
  athleteDisplayName: 'Mara',
  instructorId: 'synthetic-instructor-rowan-lcv1',
  instructorDisplayName: 'Coach Rowan',
  relationshipId: 'athlete-consult-rel-mara-rowan-v1',
})

export const SESSION_PHASES = Object.freeze({
  IDLE: 'IDLE',
  STARTED: 'STARTED',
  ACTIVE: 'ACTIVE',
  ENDING: 'ENDING',
  NOTES_READY: 'NOTES_READY',
})

export const AUDIENCES = Object.freeze({
  PRIVATE: 'athlete-private',
  JOINT: 'joint',
  SHAREABLE_PLAN: 'shareable-plan',
})

export const ACTORS = Object.freeze({
  ATHLETE: 'athlete',
  INSTRUCTOR: 'instructor',
  MORE: 'more',
  SYSTEM: 'system',
})

export const ATHLETE_MAP_CONFIRMATION = 'I confirm this change to our Athlete Performance Map.'
export const ATHLETE_PLAN_CONFIRMATION = 'I agree to this Athlete Development Agreement.'
export const EVIDENCE_CONFIRMATION = 'I confirm this is an accurate account from me.'

export const OPEN_LOOP_STATES = Object.freeze([
  'open',
  'due',
  'attempted',
  'completed',
  'missed',
  'intelligently_abandoned',
  'superseded',
  'unresolved',
])

export const ROOM_IDS = Object.freeze({
  BOS: 'bos',
  MAP: 'map',
  WHERE: 'where',
  FUTURES: 'futures',
  MOVE: 'move',
  EVIDENCE: 'evidence',
  PLAN: 'plan',
})

export const ACTION_TYPES = Object.freeze({
  START_SESSION: 'START_SESSION',
  APPEND_CHAT: 'APPEND_CHAT',
  CAPTURE_NEW_EVIDENCE: 'CAPTURE_NEW_EVIDENCE',
  DECIDE_EVIDENCE_CANDIDATE: 'DECIDE_EVIDENCE_CANDIDATE',
  PROPOSE_MAP_CHANGE: 'PROPOSE_MAP_CHANGE',
  DECIDE_MAP_CHANGE: 'DECIDE_MAP_CHANGE',
  PROPOSE_PLAN: 'PROPOSE_PLAN',
  DECIDE_PLAN: 'DECIDE_PLAN',
  RECORD_ATTEMPT: 'RECORD_ATTEMPT',
  RECORD_OUTCOME: 'RECORD_OUTCOME',
  ASSESS_CAUSAL_CONFIDENCE: 'ASSESS_CAUSAL_CONFIDENCE',
  UPDATE_OPEN_LOOP: 'UPDATE_OPEN_LOOP',
  ACK_NOTICE: 'ACK_NOTICE',
  ADD_MIDDLE_GU: 'ADD_MIDDLE_GU',
  END_SESSION: 'END_SESSION',
  SHARE_PLAN_PREVIEW: 'SHARE_PLAN_PREVIEW',
})

export function clone(value) {
  return value == null ? value : structuredClone(value)
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const child of Object.values(value)) deepFreeze(child)
  return value
}

export function assertLivingConsult(condition, code, details = null) {
  if (!condition) {
    const error = new Error(code)
    error.code = code
    if (details != null) error.details = details
    throw error
  }
}

export function cleanText(value, { max = 1800, required = true } = {}) {
  const text = typeof value === 'string' ? value.trim() : ''
  assertLivingConsult(!required || text.length > 0, 'ATHLETE_LIVING_CONSULT_TEXT_REQUIRED')
  assertLivingConsult(text.length <= max, 'ATHLETE_LIVING_CONSULT_TEXT_TOO_LONG')
  return text
}

export function stableId(prefix, value, length = 20) {
  return `${prefix}_${hashCanonicalJson(value).slice(0, length)}`
}

export function stateIdentity(value) {
  const state = clone(value)
  if (state && typeof state === 'object') delete state.stateHash
  return hashCanonicalJson(state)
}

export function assertActor(actor, allowed = [ACTORS.ATHLETE, ACTORS.INSTRUCTOR, ACTORS.MORE, ACTORS.SYSTEM]) {
  assertLivingConsult(allowed.includes(actor), 'ATHLETE_LIVING_CONSULT_ACTOR_INVALID')
  return actor
}

export function assertAudience(audience) {
  assertLivingConsult(Object.values(AUDIENCES).includes(audience), 'ATHLETE_LIVING_CONSULT_AUDIENCE_INVALID')
  return audience
}

export function assertSyntheticIdentity(options = {}) {
  const ids = { ...SYNTHETIC_IDENTITIES, ...(options.identities || {}) }
  const serialized = JSON.stringify(ids)
  assertLivingConsult(/^synthetic-/u.test(ids.subjectId), 'ATHLETE_LIVING_CONSULT_SYNTHETIC_SUBJECT_REQUIRED')
  assertLivingConsult(/^synthetic-/u.test(ids.athleteId), 'ATHLETE_LIVING_CONSULT_SYNTHETIC_ATHLETE_REQUIRED')
  assertLivingConsult(/^synthetic-/u.test(ids.instructorId), 'ATHLETE_LIVING_CONSULT_SYNTHETIC_INSTRUCTOR_REQUIRED')
  assertLivingConsult(/^athlete-consult-rel-/u.test(ids.relationshipId), 'ATHLETE_LIVING_CONSULT_RELATIONSHIP_NAMESPACE_INVALID')
  assertLivingConsult(!/(subscription:|recruiting:|candidate_|manager_|enterprise_)/iu.test(serialized), 'ATHLETE_LIVING_CONSULT_FOREIGN_IDENTITY_LEAK')
  return ids
}

export function eventHash(unsignedEvent) {
  return hashCanonicalJson(unsignedEvent)
}

export function assertNoCustomerOrExternalEffects(value) {
  assertLivingConsult(value && typeof value === 'object' && Object.values(value).every((count) => count === 0), 'ATHLETE_LIVING_CONSULT_EXTERNAL_EFFECT_FORBIDDEN')
  return value
}

export function assertNoPrivateExistenceLeak(value) {
  const serialized = JSON.stringify(value)
  assertLivingConsult(!/(excludedPrivateObjectCount|privateObjectCount|privateBos|private_source|private evidence|sourceArtifactSha256|sourceStateHash|currentRealityHash|bosArtifactIdentity)/iu.test(serialized), 'ATHLETE_LIVING_CONSULT_PRIVATE_EXISTENCE_LEAK')
  return value
}

export function publicProjectionIdentity(value) {
  return stableId('projection', value, 24)
}
