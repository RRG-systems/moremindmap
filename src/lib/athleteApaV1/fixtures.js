import { DEFAULT_ATHLETE_APA_QUESTIONS, FICTIONAL_NORTHSTAR_QUESTIONS } from './questions.js'

export const SYNTHETIC_SUBJECT = Object.freeze({
  id: 'synthetic-athlete-mara-apa-v1',
  bosSubjectId: 'synthetic-athlete-mara',
  displayName: 'Mara',
  ageBand: '14–17',
  sport: 'Volleyball',
  fictional: true,
})

export const SYNTHETIC_RELATIONSHIP = Object.freeze({
  id: 'synthetic-athlete-mara-rowan-apa-v1',
  athleteId: SYNTHETIC_SUBJECT.id,
  instructorId: 'synthetic-instructor-rowan',
  instructorDisplayName: 'Coach Rowan',
  purpose: 'synthetic_joint_current_reality',
  audience: ['athlete', 'instructor'],
  fictional: true,
})

const atom = (id, topic, statement, sourceClass, actor, extras = {}) => ({
  id,
  topic,
  statement,
  sourceClass,
  actor,
  epistemicStatus: sourceClass === 'OBJECTIVE_RECORD' ? 'MEASURED' : sourceClass === 'SHARED_AGREEMENT' ? 'AGREED' : sourceClass === 'INSTRUCTOR_OBSERVATION' ? 'OBSERVED' : 'REPORTED',
  confidence: sourceClass === 'MODEL_INFERENCE' ? 'BOUNDED_INFERENCE' : 'DIRECT_SOURCE',
  eventTime: null,
  ...extras,
})

export const SYNTHETIC_ATOMS = Object.freeze({
  sport: atom('F01', 'sport_context', 'The map concerns volleyball during late preseason.', 'SHARED_AGREEMENT', 'athlete+instructor', { explicitAgreement: true }),
  athleteGoal: atom('F02', 'athlete_goal', 'Mara wants serve reception to feel more reliable before the October qualifier.', 'ATHLETE_REPORT', 'athlete'),
  athleteMeaning: atom('F03', 'athlete_meaning', 'It matters to Mara because she wants to begin live play knowing what to do rather than guessing.', 'ATHLETE_REPORT', 'athlete'),
  instructorPriority: atom('F04', 'instructor_priority', 'Coach Rowan is prioritizing Mara’s transition into the first live rep and her serve-receive decisions.', 'INSTRUCTOR_REPORT', 'instructor'),
  sharedGoal: atom('F05', 'shared_goal', 'Both explicitly agree that serve-receive development matters in this phase.', 'SHARED_AGREEMENT', 'athlete+instructor', { explicitAgreement: true }),
  athleteFocus: atom('F06', 'athlete_focus', 'Mara is focusing on reading serve direction and getting her platform set earlier.', 'ATHLETE_REPORT', 'athlete'),
  instructorFocus: atom('F07', 'instructor_focus', 'Coach Rowan is focusing on an earlier ready position and a clear first assignment.', 'INSTRUCTOR_REPORT', 'instructor'),
  athleteAsset: atom('F08', 'current_asset', 'Mara reports feeling decisive once play is moving.', 'ATHLETE_REPORT', 'athlete'),
  instructorAsset: atom('F09', 'current_asset', 'Coach Rowan has observed good reads and quick resets after a ball is in play.', 'INSTRUCTOR_OBSERVATION', 'instructor'),
  athleteGap: atom('F10', 'current_gap', 'Mara reports that the first drill or first assignment is sometimes unclear at the start.', 'ATHLETE_REPORT', 'athlete'),
  instructorGap: atom('F11', 'current_gap', 'Coach Rowan has observed pauses before some first reps and has not established why they occur.', 'INSTRUCTOR_OBSERVATION', 'instructor'),
  attempt: atom('F12', 'current_attempt', 'Both report trying a three-minute pre-practice huddle with a clear first-drill cue.', 'SHARED_AGREEMENT', 'athlete+instructor', { explicitAgreement: true, executionState: 'ATTEMPTED_PARTIALLY' }),
  execution: atom('F13', 'execution_state', 'The huddle and cue happened at two of three comparable practices.', 'SHARED_AGREEMENT', 'athlete+instructor', { explicitAgreement: true, executionState: 'ATTEMPTED_PARTIALLY' }),
  athleteChange: atom('F14', 'recent_change', 'Mara reports that the two cued practices felt easier to enter.', 'ATHLETE_REPORT', 'athlete'),
  instructorChange: atom('F15', 'recent_change', 'Coach Rowan observed less waiting at one of the two cued practices and no clear difference at the other.', 'INSTRUCTOR_OBSERVATION', 'instructor'),
  objective: atom('F16', 'objective_evidence', 'A controlled-drill chart records 17 playable serve receptions out of 24 attempts.', 'OBJECTIVE_RECORD', 'qualified-record', { eventTime: '2026-08-31', recordRef: 'fictional-chart-vb-20260831', comparisonLimit: 'No comparable baseline was supplied.' }),
  persistentGap: atom('F17', 'persistent_gap', 'Neither source can yet establish that serve reception improved in live play.', 'SHARED_AGREEMENT', 'athlete+instructor', { explicitAgreement: true }),
  constraintAthlete: atom('F18', 'current_constraint', 'Mara reports that school dismissal and the family ride make one practice arrival tight.', 'ATHLETE_REPORT', 'athlete'),
  constraintInstructor: atom('F19', 'current_constraint', 'Coach Rowan reports that the first drill sometimes changes close to practice.', 'INSTRUCTOR_REPORT', 'instructor'),
  event: atom('F20', 'upcoming_event', 'A fictional October 18 qualifier is the next relevant event.', 'SHARED_AGREEMENT', 'athlete+instructor', { explicitAgreement: true, eventTime: '2026-10-18' }),
})

const response = (id, questionId, voices, atoms = [], missing = []) => ({ id, questionId, voices, atoms, missing })

export const DEFAULT_SYNTHETIC_RESPONSES = Object.freeze([
  response('R01', 'APA01', [{ actor: 'athlete+instructor', text: 'Volleyball, late preseason. We are about six weeks from a qualifier.' }], [SYNTHETIC_ATOMS.sport]),
  response('R02', 'APA02', [{ actor: 'athlete', text: 'I want serve reception to feel more reliable before the October qualifier. I want to start live play knowing what to do instead of guessing.' }], [SYNTHETIC_ATOMS.athleteGoal, SYNTHETIC_ATOMS.athleteMeaning]),
  response('R03', 'APA03', [{ actor: 'instructor', text: 'I am helping Mara move into the first live rep sooner and make clearer serve-receive decisions.' }], [SYNTHETIC_ATOMS.instructorPriority]),
  response('R04', 'APA04', [{ actor: 'athlete', text: 'We agree on serve reception. I think unclear first instructions matter more than hesitation.' }, { actor: 'instructor', text: 'We agree on serve reception. I see the pause, but I do not know the cause yet.' }], [SYNTHETIC_ATOMS.sharedGoal], [{ id: 'M01', topic: 'first_rep_start', statement: 'The available sources do not resolve whether the early pause is mainly an instruction issue, another condition, or hesitation.', sourceClaimIds: ['F10', 'F11'], status: 'UNRESOLVED' }]),
  response('R05', 'APA05', [{ actor: 'athlete', text: 'I am reading the direction of the serve and trying to set my platform earlier. Last week I called the seam earlier on one ball.' }], [SYNTHETIC_ATOMS.athleteFocus]),
  response('R06', 'APA06', [{ actor: 'instructor', text: 'I am working on ready position and making the first assignment unmistakable. In Tuesday’s drill, Mara reset quickly after a hard first ball.' }], [SYNTHETIC_ATOMS.instructorFocus]),
  response('R07', 'APA07', [{ actor: 'athlete', text: 'Once play starts, I usually know what I want to do.' }, { actor: 'instructor', text: 'Once a ball is live, Mara often reads it well and resets quickly.' }], [SYNTHETIC_ATOMS.athleteAsset, SYNTHETIC_ATOMS.instructorAsset]),
  response('R08', 'APA08', [{ actor: 'athlete', text: 'The first drill or first assignment is sometimes unclear to me.' }, { actor: 'instructor', text: 'I see pauses before some first reps. I have not established why.' }], [SYNTHETIC_ATOMS.athleteGap, SYNTHETIC_ATOMS.instructorGap]),
  response('R09', 'APA09', [{ actor: 'athlete+instructor', text: 'We agreed to try a three-minute huddle before practice and a clear first-drill cue. It happened at two of three comparable practices.' }], [SYNTHETIC_ATOMS.attempt, SYNTHETIC_ATOMS.execution]),
  response('R10', 'APA10', [{ actor: 'athlete', text: 'The two practices with the cue felt easier to enter.' }, { actor: 'instructor', text: 'There was less waiting at one of those practices and no clear difference at the other.' }], [SYNTHETIC_ATOMS.athleteChange, SYNTHETIC_ATOMS.instructorChange]),
  response('R11', 'APA11', [{ actor: 'athlete+instructor', text: 'We cannot yet say serve reception improved in live play. We have only two cued practices and no comparable game baseline.' }], [SYNTHETIC_ATOMS.persistentGap]),
  response('R12', 'APA12', [{ actor: 'athlete', text: 'School dismissal and our ride make one practice arrival tight.' }, { actor: 'instructor', text: 'The first drill sometimes changes close to practice.' }], [SYNTHETIC_ATOMS.constraintAthlete, SYNTHETIC_ATOMS.constraintInstructor]),
  response('R13', 'APA13', [{ actor: 'athlete+instructor', text: 'A fictional qualifier on October 18 is the next event that matters.' }], [SYNTHETIC_ATOMS.event]),
  response('R14', 'APA14', [{ actor: 'athlete+instructor', text: 'We can use a controlled-drill chart: 17 of 24 serve receptions were playable. We are missing a comparable baseline, live-play comparison, and enough repeated practices.' }], [SYNTHETIC_ATOMS.objective], [
    { id: 'M02', topic: 'serve_reception_change', statement: 'A comparable baseline is missing.', status: 'MISSING' },
    { id: 'M03', topic: 'live_play_transfer', statement: 'Comparable live-play evidence is missing.', status: 'MISSING' },
  ]),
])

const byId = Object.fromEntries(DEFAULT_SYNTHETIC_RESPONSES.map((item) => [item.questionId, item]))
const grouped = (id, questionId, sourceIds, voices) => response(id, questionId, voices, sourceIds.flatMap((sourceId) => byId[sourceId].atoms), sourceIds.flatMap((sourceId) => byId[sourceId].missing))

export const NORTHSTAR_SYNTHETIC_RESPONSES = Object.freeze([
  grouped('NR01', 'NS01', ['APA01', 'APA13'], [{ actor: 'athlete+instructor', text: 'Volleyball, late preseason, with a fictional October 18 qualifier ahead.' }]),
  grouped('NR02', 'NS02', ['APA02'], [{ actor: 'athlete', text: 'I want serve reception to feel steadier so I can begin live play without guessing.' }]),
  grouped('NR03', 'NS03', ['APA03'], [{ actor: 'instructor', text: 'I want Mara to enter the first live rep sooner and make clear serve-receive decisions.' }]),
  grouped('NR04', 'NS04', ['APA04'], byId.APA04.voices),
  grouped('NR05', 'NS05', ['APA05', 'APA06', 'APA07'], [{ actor: 'athlete', text: 'Clear first instructions help; once play starts I usually feel decisive.' }, { actor: 'instructor', text: 'A clear assignment helps; once play starts Mara often reads and resets well.' }]),
  grouped('NR06', 'NS06', ['APA08'], byId.APA08.voices),
  grouped('NR07', 'NS07', ['APA09'], byId.APA09.voices),
  grouped('NR08', 'NS08', ['APA10'], byId.APA10.voices),
  grouped('NR09', 'NS09', ['APA11'], byId.APA11.voices),
  grouped('NR10', 'NS10', ['APA12'], byId.APA12.voices),
  response('NR11', 'NS11', [{ actor: 'athlete+instructor', text: 'The current safe record is a controlled-drill chart with 17 playable receptions in 24 attempts.' }], [SYNTHETIC_ATOMS.objective]),
  response('NR12', 'NS12', [{ actor: 'athlete+instructor', text: 'We still need a comparable baseline, live-play evidence, and more repeated practices.' }], [], byId.APA14.missing),
])

export const SYNTHETIC_FIXTURES = Object.freeze({
  'more-athlete-default-v1': {
    id: 'synthetic-mara-default-apa-v1',
    subject: SYNTHETIC_SUBJECT,
    relationship: SYNTHETIC_RELATIONSHIP,
    questions: DEFAULT_ATHLETE_APA_QUESTIONS,
    responses: DEFAULT_SYNTHETIC_RESPONSES,
    asOf: '2026-09-04T12:00:00-07:00',
  },
  'fictional-northstar-v1': {
    id: 'synthetic-mara-northstar-apa-v1',
    subject: SYNTHETIC_SUBJECT,
    relationship: SYNTHETIC_RELATIONSHIP,
    questions: FICTIONAL_NORTHSTAR_QUESTIONS,
    responses: NORTHSTAR_SYNTHETIC_RESPONSES,
    asOf: '2026-09-04T12:00:00-07:00',
  },
})
