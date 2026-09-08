import { validateQuestionSet } from './questions.js'

export const ATHLETE_CURRENT_REALITY_CONTRACT = 'athlete-current-reality-v1'
export const ATHLETE_APA_CASSETTE_INTERFACE = 'athlete-apa-box1-cassette-v1'
export const ATHLETE_BOS_APA_FUSION_CONTRACT = 'athlete-bos-apa-fusion-v1'

export const SOURCE_CLASSES = Object.freeze([
  'ATHLETE_REPORT',
  'INSTRUCTOR_REPORT',
  'INSTRUCTOR_OBSERVATION',
  'SHARED_AGREEMENT',
  'OBJECTIVE_RECORD',
  'MISSING',
  'MODEL_INFERENCE',
])

const ALLOWED_TOPICS = new Set([
  'sport_context', 'current_phase', 'athlete_goal', 'athlete_meaning', 'instructor_priority',
  'shared_goal', 'goal_difference', 'athlete_focus', 'instructor_focus', 'current_asset',
  'current_gap', 'source_difference', 'current_attempt', 'execution_state', 'recent_change',
  'change_evidence', 'persistent_gap', 'attempt_conditions', 'current_constraint',
  'upcoming_event', 'objective_evidence', 'missing_evidence', 'first_rep_start',
  'serve_reception_change', 'live_play_transfer',
])

const FORBIDDEN_PRODUCT_TERMS = /(?:talent score|coachability score|personality score|selection rank|scholarship probability|professional probability|diagnos(?:is|e)|medical clearance|ready to play)/iu

export function assert(condition, code) {
  if (!condition) throw new Error(code)
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

// Portable, deterministic state identity for the browser-only synthetic lab.
// The sealed evidence package separately records SHA-256 file hashes.
export function portableStateHash(value) {
  const input = stableStringify(value)
  let hash = 0xcbf29ce484222325n
  for (const character of input) {
    hash ^= BigInt(character.codePointAt(0))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return `fnv1a64-${hash.toString(16).padStart(16, '0')}`
}

export function validateCassette(cassette) {
  assert(cassette?.interface === ATHLETE_APA_CASSETTE_INTERFACE, 'ATHLETE_APA_CASSETTE_INTERFACE_MISMATCH')
  assert(/^[a-z0-9-]+$/u.test(cassette.id), 'ATHLETE_APA_CASSETTE_ID_INVALID')
  assert(cassette.version && cassette.label && cassette.box1Vocabulary, 'ATHLETE_APA_CASSETTE_METADATA_INCOMPLETE')
  validateQuestionSet(cassette.questions)
  assert(typeof cassette.normalize === 'function', 'ATHLETE_APA_CASSETTE_NORMALIZER_REQUIRED')
  return cassette
}

function validateAtom(atom, question, seenAtoms) {
  assert(atom?.id && !seenAtoms.has(atom.id), 'ATHLETE_APA_ATOM_ID_INVALID')
  seenAtoms.add(atom.id)
  assert(ALLOWED_TOPICS.has(atom.topic), 'ATHLETE_APA_TOPIC_NOT_ALLOWED')
  assert(SOURCE_CLASSES.includes(atom.sourceClass), 'ATHLETE_APA_SOURCE_CLASS_INVALID')
  assert(question.evidenceTargets.includes(atom.topic), 'ATHLETE_APA_QUESTION_TARGET_MISMATCH')
  assert(atom.statement?.trim() && !FORBIDDEN_PRODUCT_TERMS.test(atom.statement), 'ATHLETE_APA_ATOM_UNSAFE')
  if (atom.sourceClass === 'SHARED_AGREEMENT') {
    assert(atom.actor === 'athlete+instructor' && atom.explicitAgreement === true, 'ATHLETE_APA_AGREEMENT_MUST_BE_EXPLICIT')
  }
  if (atom.sourceClass === 'OBJECTIVE_RECORD') assert(atom.recordRef, 'ATHLETE_APA_OBJECTIVE_RECORD_REFERENCE_REQUIRED')
  if (atom.sourceClass === 'MODEL_INFERENCE') assert(atom.confidence === 'BOUNDED_INFERENCE', 'ATHLETE_APA_INFERENCE_MUST_BE_BOUNDED')
}

export function normalizeCassetteFixture(cassette, fixture) {
  validateCassette(cassette)
  assert(fixture?.subject?.fictional === true && fixture?.relationship?.fictional === true, 'ATHLETE_APA_SYNTHETIC_ONLY')
  assert(fixture.subject.id === fixture.relationship.athleteId, 'ATHLETE_APA_RELATIONSHIP_SUBJECT_MISMATCH')
  assert(fixture.responses.length === cassette.questions.length, 'ATHLETE_APA_RESPONSE_COUNT_MISMATCH')
  const questions = new Map(cassette.questions.map((question) => [question.id, question]))
  const seenQuestions = new Set()
  const seenAtoms = new Set()
  const claims = []
  const missingEvidence = []
  for (const response of fixture.responses) {
    const question = questions.get(response.questionId)
    assert(question && !seenQuestions.has(question.id), 'ATHLETE_APA_RESPONSE_QUESTION_INVALID')
    seenQuestions.add(question.id)
    assert(Array.isArray(response.voices) && response.voices.length > 0, 'ATHLETE_APA_RESPONSE_VOICE_REQUIRED')
    for (const voice of response.voices) assert(['athlete', 'instructor', 'athlete+instructor'].includes(voice.actor) && voice.text?.trim(), 'ATHLETE_APA_RESPONSE_VOICE_INVALID')
    for (const sourceAtom of response.atoms || []) {
      validateAtom(sourceAtom, question, seenAtoms)
      claims.push({
        ...structuredClone(sourceAtom),
        id: `${cassette.id}:${sourceAtom.id}`,
        evidenceIds: [`${cassette.id}:${response.id}`],
        provenance: {
          cassetteId: cassette.id,
          cassetteVersion: cassette.version,
          questionId: question.id,
          responseId: response.id,
          sourceClass: sourceAtom.sourceClass,
          actor: sourceAtom.actor,
        },
      })
    }
    for (const gap of response.missing || []) {
      assert(gap.id && ALLOWED_TOPICS.has(gap.topic) && ['MISSING', 'UNRESOLVED'].includes(gap.status), 'ATHLETE_APA_MISSING_EVIDENCE_INVALID')
      if (gap.status === 'MISSING') missingEvidence.push({ ...structuredClone(gap), id: `${cassette.id}:${gap.id}`, provenance: { cassetteId: cassette.id, questionId: question.id, responseId: response.id } })
    }
  }
  assert(seenQuestions.size === cassette.questions.length, 'ATHLETE_APA_QUESTION_COVERAGE_INCOMPLETE')
  const contradictions = fixture.responses.flatMap((response) => response.missing || []).filter((item) => item.status === 'UNRESOLVED').map((item) => ({
    ...structuredClone(item),
    id: `${cassette.id}:${item.id}`,
    sourceClaimIds: item.sourceClaimIds.map((id) => `${cassette.id}:${id}`),
  }))
  const result = {
    contract: ATHLETE_CURRENT_REALITY_CONTRACT,
    version: '1.0.0-synthetic',
    subject: structuredClone(fixture.subject),
    relationship: structuredClone(fixture.relationship),
    cassetteBinding: {
      interface: cassette.interface,
      id: cassette.id,
      version: cassette.version,
      label: cassette.label,
      fictional: cassette.fictional === true,
      questionsHash: portableStateHash(cassette.questions),
      sourceResponseHash: portableStateHash(fixture.responses),
    },
    asOf: fixture.asOf,
    scope: { purpose: 'synthetic_joint_current_reality', audience: ['athlete', 'instructor'], writable: false },
    claims,
    contradictions,
    missingEvidence,
    guardrails: {
      scores: false,
      rankings: false,
      selectionUse: false,
      medicalClearance: false,
      personalityCausation: false,
      inferredAgreement: false,
    },
  }
  result.stateHash = portableStateHash(result)
  return validateCurrentReality(result)
}

export function validateCurrentReality(value) {
  assert(value?.contract === ATHLETE_CURRENT_REALITY_CONTRACT, 'ATHLETE_APA_CURRENT_REALITY_CONTRACT_INVALID')
  assert(value.subject?.fictional === true && value.relationship?.fictional === true, 'ATHLETE_APA_CURRENT_REALITY_SYNTHETIC_ONLY')
  assert(value.scope?.writable === false, 'ATHLETE_APA_CURRENT_REALITY_MUST_BE_READ_ONLY')
  assert(value.cassetteBinding?.interface === ATHLETE_APA_CASSETTE_INTERFACE, 'ATHLETE_APA_CASSETTE_BINDING_INVALID')
  const { stateHash, ...hashable } = value
  assert(stateHash === portableStateHash(hashable), 'ATHLETE_APA_CURRENT_REALITY_HASH_INVALID')
  const serialized = stableStringify(value)
  assert(!FORBIDDEN_PRODUCT_TERMS.test(serialized), 'ATHLETE_APA_CURRENT_REALITY_UNSAFE')
  assert(!/real[_ -]?estate|q11|listing volume|gross commission|lead conversion/iu.test(serialized), 'ATHLETE_APA_BUSINESS_CASSETTE_LEAK')
  return value
}

export function semanticCurrentReality(value) {
  validateCurrentReality(value)
  return {
    subject: { ageBand: value.subject.ageBand, sport: value.subject.sport },
    claims: value.claims.map(({ topic, statement, sourceClass, actor, epistemicStatus, eventTime, executionState, comparisonLimit }) => ({ topic, statement, sourceClass, actor, epistemicStatus, eventTime, executionState, comparisonLimit })).sort((a, b) => a.statement.localeCompare(b.statement)),
    contradictions: value.contradictions.map(({ topic, statement, status }) => ({ topic, statement, status })),
    missingEvidence: value.missingEvidence.map(({ topic, statement, status }) => ({ topic, statement, status })).sort((a, b) => a.statement.localeCompare(b.statement)),
    guardrails: value.guardrails,
  }
}

export function assertSafeCustomerArtifact(value) {
  const serialized = stableStringify(value)
  assert(!FORBIDDEN_PRODUCT_TERMS.test(serialized), 'ATHLETE_APA_CUSTOMER_ARTIFACT_UNSAFE')
  assert(!/(home responsibility affects|called passive|do not feel able to question|E01|E03|E04)/iu.test(serialized), 'ATHLETE_APA_PRIVATE_BOS_LEAK')
  assert(!/(scholarship|professional future|predicted outcome|talent ceiling)/iu.test(serialized), 'ATHLETE_APA_PREDICTION_OR_SELECTION_LEAK')
  return value
}
