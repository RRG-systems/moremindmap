import { DEFAULT_ATHLETE_APA_QUESTIONS } from './questions.js'
import { sha256Text } from '../canonicalSha256.js'

export const ATHLETE_APA_PARITY_SUBJECT = Object.freeze({
  id: 'synthetic-athlete-parity',
  displayName: 'Mika',
  ageBand: '18–20',
  sport: 'Soccer',
  fictional: true,
})

export const ATHLETE_APA_PARITY_RELATIONSHIP = Object.freeze({
  id: 'synthetic-athlete-parity-coach-ellis-apa-v2',
  athleteId: ATHLETE_APA_PARITY_SUBJECT.id,
  instructorId: 'synthetic-instructor-ellis',
  instructorDisplayName: 'Coach Ellis',
  purpose: 'synthetic_joint_athlete_current_reality',
  audience: ['athlete', 'instructor'],
  writable: false,
  fictional: true,
})

export const ATHLETE_APA_MINOR_AUTHORITY_PROOF = Object.freeze({
  contract: 'athlete-apa-minor-authority-boundary-v1',
  subject: Object.freeze({ id: 'synthetic-athlete-minor-boundary', displayName: 'Rowan', age: 16, ageBand: '14–17', fictional: true }),
  relationship: Object.freeze({ id: 'synthetic-athlete-minor-boundary-instructor', instructorId: 'synthetic-instructor-rivera', fictional: true }),
  authorization: Object.freeze({
    purpose: 'synthetic_joint_athlete_current_reality',
    audience: Object.freeze(['athlete', 'instructor']),
    athleteAssent: Object.freeze({ status: 'GRANTED', grantedAt: '2026-09-05T14:00:00-07:00', revocable: true }),
    guardianPermission: Object.freeze({ status: 'GRANTED', grantedAt: '2026-09-05T14:02:00-07:00', revocable: true }),
    expiresAt: '2026-12-05T14:00:00-07:00',
    readOnly: true,
    writable: false,
  }),
  projection: Object.freeze({
    status: 'AUTHORIZED_SYNTHETIC_BOUNDARY_ONLY',
    jointClaims: Object.freeze([]),
    athletePrivateBos: Object.freeze({ status: 'NOT_SHARED', existenceDisclosure: false, claims: Object.freeze([]) }),
    instructorPrivateMaterial: Object.freeze({ status: 'NOT_SHARED', existenceDisclosure: false, claims: Object.freeze([]) }),
  }),
  effects: Object.freeze({ providerCalls: 0, networkCalls: 0, persistenceWrites: 0, canonicalMutation: false, customerMutation: false }),
  limits: Object.freeze([
    'Synthetic design proof only; it is not legal, safeguarding, or production-readiness approval.',
    'Assent and guardian permission are both required for this fictional joint purpose and may be revoked.',
    'Private-only meaning and private-only object existence remain outside the joint projection.',
  ]),
})

const claim = (id, topic, statement, sourceClass, actor, questionId, extras = {}) => Object.freeze({
  id, topic, statement, sourceClass, actor, questionId,
  epistemicStatus: sourceClass === 'OBJECTIVE_RECORD' ? 'MEASURED' : sourceClass === 'SHARED_AGREEMENT' ? 'AGREED' : sourceClass === 'INSTRUCTOR_OBSERVATION' ? 'OBSERVED' : 'REPORTED',
  confidence: sourceClass === 'BOUNDED_INFERENCE' ? 'BOUNDED_INFERENCE' : 'DIRECT_SOURCE',
  ...extras,
})

export const ATHLETE_APA_PARITY_CLAIMS = Object.freeze([
  claim('A01', 'sport_context', 'This map concerns Mika’s current soccer development during the early competitive season.', 'SHARED_AGREEMENT', 'athlete+instructor', 'APA01', { explicitAgreement: true }),
  claim('A02', 'athlete_goal', 'Mika wants to read the field earlier and communicate one useful thing in important moments.', 'ATHLETE_REPORT', 'athlete', 'APA02'),
  claim('A03', 'athlete_meaning', 'This matters because Mika wants teammates to have useful information without feeling responsible for solving the whole play.', 'ATHLETE_REPORT', 'athlete', 'APA02'),
  claim('A04', 'instructor_priority', 'Coach Ellis is helping Mika scan before receiving and make one clear contribution before the next action.', 'INSTRUCTOR_REPORT', 'instructor', 'APA03'),
  claim('A05', 'shared_goal', 'Mika and Coach Ellis explicitly agree that earlier information and clearer communication are useful current directions.', 'SHARED_AGREEMENT', 'athlete+instructor', 'APA04', { explicitAgreement: true }),
  claim('A06', 'athlete_focus', 'Mika is practicing one look over the shoulder before the pass arrives.', 'ATHLETE_REPORT', 'athlete', 'APA05'),
  claim('A07', 'instructor_focus', 'Coach Ellis is using one concrete scanning cue and one short communication cue in comparable practice moments.', 'INSTRUCTOR_REPORT', 'instructor', 'APA06'),
  claim('A08', 'current_asset', 'Mika reports staying involved after mistakes more reliably when there is one concrete thing to notice next.', 'ATHLETE_REPORT', 'athlete', 'APA07'),
  claim('A09', 'current_asset', 'Coach Ellis has observed Mika recover position and rejoin the next phase after several disrupted plays.', 'INSTRUCTOR_OBSERVATION', 'instructor', 'APA07'),
  claim('A10', 'current_gap', 'Mika reports that higher-pressure moments can bring either silence or several instructions at once.', 'ATHLETE_REPORT', 'athlete', 'APA08'),
  claim('A11', 'current_gap', 'Coach Ellis has observed useful information arrive late or become crowded in two recent high-pressure sequences.', 'INSTRUCTOR_OBSERVATION', 'instructor', 'APA08'),
  claim('A12', 'current_attempt', 'They agreed to test one shared cue before four comparable practice sequences.', 'SHARED_AGREEMENT', 'athlete+instructor', 'APA09', { explicitAgreement: true, executionState: 'ATTEMPTED_PARTIALLY' }),
  claim('A13', 'execution_state', 'The shared cue was actually used in three of four planned practice sequences.', 'SHARED_AGREEMENT', 'athlete+instructor', 'APA09', { explicitAgreement: true, executionState: 'ATTEMPTED_PARTIALLY' }),
  claim('A14', 'recent_change', 'Mika reports that choosing one message made two of those sequences feel less crowded.', 'ATHLETE_REPORT', 'athlete', 'APA10'),
  claim('A15', 'recent_change', 'Coach Ellis observed one timely useful cue in two of the three attempted sequences and no clear change in the third.', 'INSTRUCTOR_OBSERVATION', 'instructor', 'APA10'),
  claim('A16', 'objective_evidence', 'A qualified ten-sequence film sample records a scan before receiving in seven sequences.', 'OBJECTIVE_RECORD', 'qualified-record', 'APA14', { eventTime: '2026-09-01', recordRef: 'fictional-film-sample-20260901', comparisonLimit: 'One small controlled sample; no comparable earlier baseline.' }),
  claim('A17', 'persistent_gap', 'Neither source can yet establish that the cue changes decision quality or match outcomes.', 'SHARED_AGREEMENT', 'athlete+instructor', 'APA11', { explicitAgreement: true }),
  claim('A18', 'current_constraint', 'Mika has room for one small addition, not another full training schedule.', 'ATHLETE_REPORT', 'athlete', 'APA12'),
  claim('A19', 'current_constraint', 'Coach Ellis reports that role and opponent conditions vary enough that practice sequences must be compared carefully.', 'INSTRUCTOR_REPORT', 'instructor', 'APA12'),
  claim('A20', 'upcoming_event', 'A fictional October 12 league match is the next agreed observation point.', 'SHARED_AGREEMENT', 'athlete+instructor', 'APA13', { explicitAgreement: true, eventTime: '2026-10-12' }),
])

export const ATHLETE_APA_PARITY_OPEN_EVIDENCE = Object.freeze({
  contradictions: [
    { id: 'U01', topic: 'communication_timing', statement: 'The sources agree that communication varies under pressure, but they do not establish whether timing, message load, role clarity, or another condition is primary.', status: 'UNRESOLVED', sourceClaimIds: ['A10', 'A11'] },
  ],
  missing: [
    { id: 'M01', topic: 'comparable_baseline', statement: 'A comparable earlier film sample is missing.', status: 'MISSING' },
    { id: 'M02', topic: 'match_transfer', statement: 'Repeated match evidence connecting the cue to decisions or outcomes is missing.', status: 'MISSING' },
  ],
})

export const ATHLETE_BOS_PARITY_BINDING = Object.freeze({
  sourceArtifactIdentity: '36934ae920c93266c2cfb21b8eee0002a2dfa22cf414f12d9a108343ac17c433',
  sourceArtifactSha256: '21dad9299058dbdaa935bc89e66a0d3126d9c845c18b599bfa6afda3cd1ce6d0',
  sourceStateHash: 'fb6745f0df0cd0e71140b30c4add2b895eb4476e45ad869294e0273a706cb220',
  subjectId: 'synthetic-athlete-parity',
  audience: ['athlete'],
  jointProjection: {
    purpose: 'synthetic_joint_athlete_current_reality',
    status: 'NO_AUTHORIZED_JOINT_CLAIMS',
    claims: [],
    reason: 'The current Mika BOS artifact is athlete-private. Identity may bind; private meaning and private-only object existence may not enter this joint map without a separate athlete-authorized projection.',
  },
})

const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
}

const state = {
  contract: 'athlete-apa-box1-governed-current-reality-v2',
  version: '2.0.0-synthetic-parity',
  subject: ATHLETE_APA_PARITY_SUBJECT,
  relationship: ATHLETE_APA_PARITY_RELATIONSHIP,
  questions: DEFAULT_ATHLETE_APA_QUESTIONS,
  claims: ATHLETE_APA_PARITY_CLAIMS,
  openEvidence: ATHLETE_APA_PARITY_OPEN_EVIDENCE,
  bosBinding: ATHLETE_BOS_PARITY_BINDING,
  asOf: '2026-09-05T15:00:00-07:00',
}

export const ATHLETE_APA_PARITY_FIXTURE = Object.freeze({
  ...state,
  stateHash: sha256Text(JSON.stringify(stable(state))),
  guarantees: Object.freeze({ syntheticOnly: true, readOnly: true, noProviderCall: true, noPersistence: true, noYouthScore: true, noSelectionMeaning: true, noMedicalDirection: true }),
})
