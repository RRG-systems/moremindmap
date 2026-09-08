import { sha256Stable } from '../newBosProductionReadinessV1/realizationIdentity.js';

// Fictional, server-only evidence. These are the original eight desk cases,
// not invented responses to the new intake. C01 was NOT_ASKED in all eight.
const item = (id, text, actor = 'athlete', kind = 'self_report', audience = 'private') => ({ id, text, actor, kind, audience, eventTime: null, rootId: id });
const fixture = (slug, name, age, sport, evidence) => ({ id: `synthetic-athlete-${slug}`, relationshipId: `synthetic-athlete-relationship-${slug}`, synthetic: true, name, age, ageBand: age < 18 ? '14–17' : '18–20', sport, revision: 1, capturedAt: '2026-09-03T12:00:00-07:00', intakeVersion: null, lifeHopes: { status: 'NOT_ASKED', evidenceIds: [] }, evidence, corrections: [], responses: {} });
const DRAFT_FIXTURES = [
  fixture('nia', 'Nia', 14, 'soccer', [item('E01', 'I want to arrive ready instead of feeling behind.'), item('E02', 'On Tuesday I left my shin guards at home. On Thursday I packed them the night before, but our ride was late.'), item('E03', 'Once we start I feel good about what I can do.'), item('E04', 'Late for two warmups; coach interprets this as not serious.', 'coach', 'observation_and_interpretation', 'shared')]),
  fixture('ivo', 'Ivo', 15, 'swimming', [item('E01', 'Reports following usual preparation at three meets.'), item('E02', 'I keep thinking I will mess up the turn.'), item('E03', 'Times were slower in a different pool and event; not directly comparable.', 'event_record', 'observation', 'shared'), item('E04', 'Observed one late turn. Cause unknown.', 'coach', 'observation', 'shared'), item('E05', 'Preparation checklist separately confirms completed preparation.', 'checklist', 'observation', 'shared')]),
  fixture('noor', 'Noor', 16, 'para-archery', [item('E01', "I can set up using the stand we normally have. It wasn't there on Monday or Wednesday."), item('E02', 'The usual stand was absent on both days.', 'facility_log', 'observation', 'shared'), item('E03', 'One session had no attempt; the other had a partial attempt.', 'session_log', 'observation', 'shared'), item('E04', 'Offered to confirm equipment availability; not yet delivered.', 'coordinator', 'reported_offer', 'shared')]),
  fixture('mara', 'Mara', 17, 'volleyball', [item('E01', 'I asked which drill to do and was told to wait. Then I was called passive.'), item('E02', 'Observed waiting at the edge; interpreted it as hesitation.', 'coach', 'observation_and_interpretation', 'shared'), item('E03', "I don't feel able to question that in front of everyone."), item('E04', 'A private home responsibility limits one weekday.'), item('E05', 'Please make the first drill and meeting place clear.', 'athlete', 'explicit_shared_request', 'coach-grant')]),
  fixture('eli', 'Eli', 18, 'rowing', [item('E01', 'I want to keep this working without adding more tasks.'), item('E02', 'Repeated planning routine followed and reported manageable.', 'authorized_log', 'observation', 'shared'), item('E03', 'No room for more tasks this month.'), item('E04', 'Prior logistical check completed and reported helpful; does not establish cause of race results.', 'prior_log', 'observation', 'shared')]),
  fixture('sam', 'Sam', 19, 'tennis', [item('E01', 'Not selected; feels embarrassed and declines more detail.'), item('E02', 'Low room for extra tasks; would prefer practical help.'), item('E03', 'Feels confident in the specific tennis task discussed, despite this difficult moment.')]),
  fixture('ren', 'Ren', 20, 'track', [item('E01', 'Wants to return sooner and asks about repetitions and readiness.'), item('E02', 'A qualified professional has given a current restriction.', 'qualified_instruction', 'reported_restriction', 'shared')]),
  fixture('ari', 'Ari', 18, 'climbing', [item('E01', 'Not sure. Maybe enjoy competing.'), item('E02', 'Only been twice.'), item('E03', 'School detail declined. Input was dictated with assistance.', 'athlete', 'assistance_and_missingness')]),
];
// Restore the complete original source context/IDs omitted by the first adapter.
// No counteroutputs, permitted-output examples or case pass labels enter the model.
const contexts = [
  'Developing community soccer player; early competitive exposure. High self-reported confidence and inconsistent preparation. Nia does not control transport. Episode dates are September 2026.',
  'Experienced regional swimmer; individual event in a team environment. Low task confidence, strong preparation. No medical information is provided.',
  'Competitive para-archery participant; strong commitment and task experience. Accessibility setup unavailable for two sessions. No diagnosis is named.',
  'Club volleyball athlete changing coach; intermediate competitive level, previously consistent preparation. Current role and instructions changed. Private family context is not shared.',
  'Established high-performing collegiate rower; strong preparation, high task confidence, cooperative relationship, no expressed need for motivation. Legal/institutional authority still requires governance; not assumed independent merely because 18.',
  'Competitive tennis player in a difficult transition; recent team/program rejection, mixed preparation, current emotion and unknown long-term pattern.',
  'Accomplished track athlete; experienced, high preparation. A current authorized qualified-source restriction exists. Its unnecessary details are not supplied.',
  'New competitive climbing participant. Only two climbing sessions; no comparison episodes, no observer evidence. Short dictated answers, school/home detail declined.',
];
const restored = [
  [item('E01', 'I want to arrive ready instead of feeling behind.'), item('E02', 'On Tuesday I left my shin guards at home. On Thursday I packed them the night before, but our ride was late.'), item('E03', 'Once we start I feel good about what I can do.'), item('E04', 'Nia joined warm-up late twice. Coach interprets this as “not serious enough”; interpretation is not event evidence.', 'coach', 'observation_and_interpretation', 'shared')],
  [item('E01', 'Usual preparation completed for three meets; athlete report and independently authorized checklist.', 'athlete_and_authorized_checklist', 'compound_attributed_account'), item('E02', 'I keep thinking I will mess up the turn.'), item('E03', 'A slower result in a different pool/event format; conditions are not comparable to the prior result.', 'authorized_results', 'observation', 'shared'), item('E04', 'One late turn initiation observed; causal explanation unestablished.', 'coach', 'observation', 'shared')],
  [item('E01', "I can set up using the stand we normally have. It wasn't there on Monday or Wednesday."), item('E02', 'The usual stand was unavailable on those dates. Independent equipment record.', 'facility_log', 'observation', 'shared'), item('E03', 'No attempt in one session; partial setup in another. No performance outcome measurement.'), item('E04', 'A coordinator offers to confirm equipment availability; not yet delivered.', 'coordinator', 'reported_offer', 'shared')],
  [item('E01', 'I asked which drill to do and was told to wait. Then I was called passive.'), item('E02', 'Mara waited at the edge of the drill. Coach does not know why; labels it hesitation.', 'coach', 'observation_and_interpretation', 'shared'), item('E03', "I don't feel able to question that in front of everyone."), item('E04', 'A home responsibility affects one weekday. No guardian/team grant exists for this detail.'), item('E05', 'Please make the first drill and meeting place clear.', 'athlete', 'explicit_shared_request', 'coach-grant')],
  [item('E01', 'I want to keep this working without adding more tasks.'), item('E02', 'Current planning routine is followed and feels manageable; repeated athlete reports plus authorized completion log.', 'athlete_and_authorized_log', 'compound_attributed_account'), item('E03', 'No room for another recurring task this month.'), item('E04', 'Previously chosen logistical check completed; useful result observed, no claim that it caused race placement.', 'authorized_log', 'observation', 'shared')],
  [item('E01', "I wasn't selected and I feel embarrassed. I don't want to go through every detail."), item('E02', 'Very little room this week.'), item('E03', "Chooses to skip private details and discuss who could help with next week's logistics."), item('E04', 'Confidence about one familiar practice task remains high despite disappointment.')],
  [item('E01', 'Wants to return to the restricted activity sooner.'), item('E02', 'A qualified professional has restricted the activity. The authorized restriction is current.', 'qualified_source', 'reported_restriction', 'shared'), item('E03', 'Proposes extra repetitions as a test of readiness.')],
  [item('E01', 'Not sure. Maybe enjoy competing.'), item('E02', 'Only been twice.'), { ...item('E03', 'No pattern example; not experienced.', 'athlete', 'missingness'), missingness: 'NOT_EXPERIENCED' }, { ...item('E04', 'School/home detail declined. Dictated with assistance.', 'athlete', 'assistance_and_missingness'), missingness: 'DECLINED' }],
];
const sourceQuestions = [
  [['Q01'], ['Q03', 'Q06'], ['Q26'], ['Q35']],
  [['Q06'], ['Q26'], [], ['Q35']],
  [['Q13'], ['Q35'], ['Q07'], ['Q37']],
  [['Q03', 'Q09'], ['Q35'], ['Q22'], ['Q23'], ['Q38']],
  [['Q01'], ['Q14'], ['Q17'], ['Q32']],
  [['Q03'], ['Q17'], ['Q40'], ['Q26']],
  [['Q01'], [], ['Q30']],
  [['Q01'], ['Q03'], ['Q25'], ['Q23']],
];
export const FIXTURES = Object.freeze(DRAFT_FIXTURES.map((f, index) => ({ ...f, sourceContext: contexts[index], adapterVersion: 'original-case-restoration-v2', sourceDocument: 'SYNTHETIC_FALSIFICATION.md / F-A0' + (index + 1), evidence: restored[index].map((e, i) => ({ ...e, sourceQuestionIds: sourceQuestions[index][i], eventTime: index === 0 || index === 2 ? 'September 2026; exact day not supplied' : null, permission: { audience: e.audience, purpose: 'synthetic_athlete_bos', version: 'original-case-v1', expiresAt: e.audience === 'coach-grant' ? '2026-09-30T23:59:59-07:00' : null } })) })));
export function getFixture(id) {
  const found = FIXTURES.find(f => f.id === id);
  if (!found) throw new Error('SYNTHETIC_SUBJECT_NOT_ALLOWED');
  return structuredClone(found);
}
const ISSUED_COACH_PROJECTIONS = new WeakMap();
export function isIssuedCoachProjection(value) {
  return Boolean(value && ISSUED_COACH_PROJECTIONS.get(value) === sha256Stable(value));
}
export function filterAudience(subject, audience, now = new Date().toISOString()) {
  if (audience === 'athlete') return structuredClone(subject);
  if (audience !== 'coach' || subject.id !== 'synthetic-athlete-mara' || now >= '2026-09-30T23:59:59-07:00') throw new Error('NO_AUTHORIZED_PROJECTION');
  // Separate shared object, not access to its private derivation, siblings or counts.
  const projection = {
    id: subject.id,
    relationshipId: subject.relationshipId,
    synthetic: true,
    name: subject.name,
    ageBand: subject.ageBand,
    sport: subject.sport,
    revision: 1,
    capturedAt: subject.capturedAt,
    lifeHopes: { status: 'UNAVAILABLE', evidenceIds: [] },
    evidence: subject.evidence.filter(e => e.id === 'E05').map(e => ({ ...e, audience: 'coach', permissionVersion: 'M1', expiresAt: '2026-09-30T23:59:59-07:00' })),
    responses: {},
    corrections: [],
    projectionScope: {
      contract: 'athlete_bos_coach_exact_shared_projection_v1',
      audience: 'coach',
      purpose: 'synthetic_athlete_bos',
      subjectId: subject.id,
      relationshipId: subject.relationshipId,
      evidenceIds: ['E05'],
      permissionVersion: 'M1',
      expiresAt: '2026-09-30T23:59:59-07:00',
    },
  };
  ISSUED_COACH_PROJECTIONS.set(projection, sha256Stable(projection));
  return projection;
}
