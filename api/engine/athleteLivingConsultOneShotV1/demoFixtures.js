import {
  ATHLETE_APA_PARITY_CLAIMS,
  ATHLETE_APA_PARITY_FIXTURE,
  ATHLETE_APA_PARITY_OPEN_EVIDENCE,
  ATHLETE_APA_PARITY_RELATIONSHIP,
  ATHLETE_APA_PARITY_SUBJECT,
} from '../../../src/lib/athleteApaV1/parityFixture.js';
import { ATHLETE_APA_PARITY_V1 } from '../../../src/lib/athleteApaV1/parityProjection.js';
import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function mapStrings(value, transform) {
  if (typeof value === 'string') return transform(value);
  if (Array.isArray(value)) return value.map((entry) => mapStrings(entry, transform));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, mapStrings(entry, transform)]));
}

function averyLanguage(value) {
  return value
    .replaceAll('synthetic-athlete-parity', 'synthetic-athlete-avery')
    .replaceAll('synthetic-instructor-ellis', 'synthetic-instructor-navarro')
    .replaceAll('Coach Ellis', 'Coach Navarro')
    .replaceAll('Mika', 'Avery')
    .replaceAll('mika', 'avery')
    .replaceAll('soccer and distance-running athlete', 'competitive swimmer')
    .replaceAll('Soccer', 'Swimming')
    .replaceAll('soccer', 'swimming')
    .replace(/\bleague match\b/gu, 'conference swim meet')
    .replace(/\bmatch outcomes\b/gu, 'race outcomes')
    .replace(/\bmatch evidence\b/gu, 'race evidence')
    .replace(/\bmatches\b/gu, 'meets')
    .replace(/\bmatch\b/gu, 'meet')
    .replace(/\bhigh-pressure sequences\b/gu, 'high-pressure race segments')
    .replace(/\bpractice sequences\b/gu, 'timed race segments')
    .replace(/\bsequences\b/gu, 'segments')
    .replace(/\bsequence\b/gu, 'segment')
    .replace(/\bteammates\b/gu, 'relay teammates')
    .replace(/\bteammate\b/gu, 'relay teammate')
    .replace(/\bthe field\b/gu, 'the pool')
    .replace(/\bfield reading\b/gu, 'race reading')
    .replace(/\bfield change\b/gu, 'pool change')
    .replace(/\bthe ball arrived\b/gu, 'the turn arrived')
    .replace(/\bthe pass arrived\b/gu, 'the turn arrived')
    .replace(/\bthe next play\b/gu, 'the next length')
    .replace(/\bplays\b/gu, 'races')
    .replace(/\bplay\b/gu, 'race')
    .replace(/\bgames\b/gu, 'meets')
    .replace(/\bgame\b/gu, 'meet')
    .replace(/\bset pieces\b/gu, 'relay exchanges')
    .replace(/\bset-piece\b/gu, 'relay-exchange')
    .replace(/\bpasses\b/gu, 'turns')
    .replace(/\bpass\b/gu, 'turn')
    .replace(/\bpossessions\b/gu, 'lengths')
    .replace(/\bpossession\b/gu, 'length')
    .replace(/\bfirst touch\b/gu, 'first turn')
    .replace(/\bball\b/gu, 'wall')
    .replace(/\bstarting lineup\b/gu, 'relay order')
    .replace(/\blineup\b/gu, 'relay order')
    .replace(/\bplaying or running\b/gu, 'swimming')
    .replace(/\brunning\b/gu, 'swimming');
}

const AVERY_SURFACES = Object.freeze({
  this_is_you: {
    headline: 'Precision matters, but it is not the whole life',
    summary: 'You care about swimming, engineering, and doing dependable work. You also want a life with close friends, room to create, and enough freedom that achievement does not become your whole identity. College competition matters now; it is not a prediction about who you must become.',
  },
  personality_dna: {
    headline: 'You prepare deeply, then hold yourself to the plan',
    summary: 'Across school, swimming, and team work, you reduce uncertainty by preparing carefully and choosing a clear standard. That often creates calm execution. When reality changes, the same strength can make adjustment feel like failure instead of useful information.',
  },
  strengths: {
    headline: 'Careful preparation gives you a real base',
    summary: 'You notice details, practice deliberately, and can repeat a process without needing constant attention. The evidence supports preparation as a recurring strength. It does not prove that more control always produces a better race.',
  },
  strengths_in_motion: {
    headline: 'Your best work is quiet, exact, and repeatable',
    summary: 'You tend to make progress by finding one controllable detail, practicing it, and checking what actually happened. That can be valuable in technical events and demanding school work. It may be less useful when the moment calls for a fast reset instead of another correction.',
  },
  pressure_pattern: {
    headline: 'One mistake can pull your attention backward',
    summary: 'Avery reports that a poor turn can stay in mind for the next length. Coach Navarro has seen technically sound training followed by cautious racing after an early mistake. The cause is not settled; fatigue, pacing, meet context, and expectations remain plausible alternatives.',
  },
  learning: {
    headline: 'Specific feedback works when there is room to test it',
    summary: 'You learn well from a concrete cue and a comparable repetition. You are less helped by broad instructions that leave you guessing what success looks like. One useful next test should not become a verdict about your mentality.',
  },
  decisions: {
    headline: 'You trust choices that have a clear reason',
    summary: 'You prefer to understand why a change matters before committing to it. That protects you from random adjustments. It can also delay a simple experiment when the evidence is incomplete and waiting will not make it complete.',
  },
  communication: {
    headline: 'You say more when the question is precise',
    summary: 'Avery is more likely to share a useful observation when the conversation asks about a specific moment. Silence should not be treated as lack of care. How this changes across teammates, coaches, and race pressure remains open.',
  },
  relationships: {
    headline: 'Trust grows when correction does not become judgment',
    summary: 'You respond best when another person stays curious about what happened before prescribing more discipline. The current Athlete and instructor accounts agree on that need, while differing on whether fitness or reset behavior matters most right now.',
  },
  energy: {
    headline: 'Capacity is real, and it changes the useful next step',
    summary: 'Training, school, and recovery already fill most weeks. Avery reports room for one bounded addition. No health conclusion is supported, and qualified restrictions remain outside this synthetic reading.',
  },
  identity_tensions: {
    headline: 'High standards can steady you—or narrow you',
    summary: 'Your standards help you prepare and care about details. Under pressure, they may also make one imperfect moment feel larger than it is. The evidence supports the tension, not a fixed trait or diagnosis.',
  },
  goals: {
    headline: 'You want performance and a wider future',
    summary: 'You want to race with more freedom this season while continuing engineering study and protecting relationships outside sport. Those directions can coexist, but the right balance is still yours to discover.',
  },
  evidence_certainty: {
    headline: 'Training quality is supported; the race constraint is still open',
    summary: 'Athlete report, instructor observation, and one small qualified split sample support consistent preparation and variable later-race execution. They do not establish whether fitness, pacing, reset behavior, or another condition is the main cause.',
  },
  operating_identity: {
    headline: 'Prepare with precision, then let the next moment be new',
    summary: 'A useful, revisable direction is emerging: your preparation gives you a strong base, and your next growth edge may be using that base without trying to repair the previous moment while the race is still moving.',
  },
  future_direction: {
    headline: 'The future stays conditional and yours',
    summary: 'Several futures remain possible: continued college competition, a stronger technical season, a different relationship with pressure, or a decision to rebalance sport and engineering. None is a prediction, ranking, or selection judgment.',
  },
});

function createAveryBosArtifact(rawMikaBos) {
  const artifact = mapStrings(clone(rawMikaBos), averyLanguage);
  artifact.identity = 'synthetic-athlete-avery-bos-v1';
  artifact.identity_context = {
    ...artifact.identity_context,
    subject_token: 'synthetic-athlete-avery',
    relationship_id: 'synthetic-athlete-avery-coach-navarro-bos-v1',
    display_name: 'Avery',
    sport_context: 'fictional competitive swimmer',
    recognition: 'Avery prepares carefully and wants to race with more freedom, while building a wider life in engineering, close relationships, and creative work. One imperfect moment may pull attention backward, but the current evidence does not establish why.',
  };
  artifact.subject = { id: 'synthetic-athlete-avery', name: 'Avery', ageBand: '18–20', sport: 'Swimming' };
  artifact.whole_person_model = {
    ...artifact.whole_person_model,
    core_explanation: 'Across swimming, engineering study, and team responsibilities, Avery prepares carefully, looks for a precise reason, and works toward repeatable execution. That pattern can create dependable work. In competition, one imperfect moment may hold attention longer than it helps; this is a supported possibility, not a proven personality cause.',
    central_tension: 'Avery wants the freedom to race decisively while also wanting enough control to avoid wasting careful preparation.',
    identity_distillation: 'Avery is better understood as a precise, self-directed young adult learning when preparation has done its job and the next moment needs a fresh response—not as a perfectionist label.',
    pressure_and_recovery: 'Avery reports replaying an early turn during later lengths in two races. Coach Navarro observed cautious pacing after one early mistake. Fitness, meet context, and expectation pressure remain live alternatives.',
    work_and_relationships: 'Avery wants engineering work, close relationships, and swimming to coexist without any single arena becoming the entire identity. Direct, specific questions make it easier to share useful detail.',
    uncertainty: [
      'Whether the first-turn reset is the main race constraint.',
      'How fitness, pacing, meet context, and expectation pressure interact.',
      'Whether a short reset cue transfers across events.',
      'How Avery wants sport to fit after college.',
      'All BOS examples are Avery’s fictional self-report and remain open to correction.',
    ],
  };
  artifact.athlete_map = {
    ...artifact.athlete_map,
    recognition: 'Avery combines deep preparation and high standards with a wish to race more freely and build a wider life in engineering, friendship, and creative work.',
    preparation_and_action: 'Avery uses repeatable practice plans, written split notes, and precise cues. These actions support consistency in training but are not proven causes of race performance.',
    people_and_communication: 'Avery offers the most useful detail when a question names a specific moment. Coach and athlete accounts differ on whether current race variation begins with fitness or with recovery after a mistake.',
    strengths_and_pressure: 'Technical preparation and self-direction are recurring assets. In two reported races, an early mistake stayed active in Avery’s attention; broader pressure behavior is not established.',
    sport_school_and_responsibilities: 'Avery is balancing college swimming, engineering coursework, recovery, and relationships, with room for one bounded experiment rather than another full program.',
    growth_conditions: 'Concrete cues, comparable repetitions, and nonjudgmental review appear useful in the available accounts.',
    learning_and_problem_solving: 'Avery learns by understanding the mechanism, trying a precise change, and comparing what happened. Incomplete evidence should stay incomplete.',
    energy_capacity_and_recovery: 'Current capacity supports one small addition. No medical, diagnostic, or physical-readiness conclusion is available.',
    unknowns: [
      'Whether fitness or reset behavior better explains late-race variation.',
      'Whether a reset cue transfers to a full meet.',
      'What balance Avery wants between sport and engineering after college.',
      'How teammates experience Avery’s communication under pressure.',
    ],
  };
  artifact.plan = {
    ...artifact.plan,
    recognition: artifact.identity_context.recognition,
    lifeHopes: {
      status: 'athlete_expressed',
      meaning: 'Avery hopes to continue engineering study, protect close relationships and creative time, and let swimming remain a chosen part of life rather than the whole identity. The exact balance after college remains open.',
      evidenceIds: ['C01'],
    },
    goals: [
      { id: 'G01', meaning: 'Race the second half with the same freedom shown in training.', authorship: 'athlete_chosen', evidenceIds: ['C02', 'C03'] },
      { id: 'G02', meaning: 'Continue engineering study while protecting close relationships and creative work.', authorship: 'athlete_chosen', evidenceIds: ['C01'] },
      { id: 'G03', meaning: 'Learn whether one reset cue helps after an imperfect early turn without adding training load.', authorship: 'athlete_chosen', evidenceIds: ['C17', 'C20'] },
    ],
    domains: [
      { domainId: 'personality_dna', meaning: 'Avery prepares deeply and values a clear reason. That can support dependable work; it does not establish a performance cause.', claimIds: [], causalIds: [], evidenceIds: ['C01', 'C04', 'C06'], counterEvidenceIds: [], unknowns: ['How this pattern changes across settings.'], abstention: 'No fixed perfectionism or mentality label is supported.' },
      { domainId: 'pressure_and_recovery', meaning: 'Avery reports that an early turn can stay active in attention. Coach Navarro sees a possible next-length effect. Fitness, pacing, meet context, and expectations remain plausible alternatives.', claimIds: [], causalIds: [], evidenceIds: ['C10', 'C11', 'C14', 'C15'], counterEvidenceIds: ['C16'], unknowns: ['Which condition matters most.'], abstention: 'The cause is unresolved.' },
      { domainId: 'life_direction', meaning: 'Avery wants swimming, engineering, relationships, and creative work to coexist without one arena becoming the entire identity.', claimIds: [], causalIds: [], evidenceIds: ['C01', 'C02'], counterEvidenceIds: [], unknowns: ['How Avery wants sport to fit after college.'], abstention: 'No career or sport future is predicted.' },
    ],
    futures: [
      { title: 'Race with a clean next moment', athleteGoalId: 'G01', baselineClaimIds: [], condition: 'A reset cue proves usable without adding cognitive load.', controllableActions: ['Define one cue.', 'Use it in comparable segments.', 'Review Athlete and instructor observations separately.'], externalDependencies: ['Comparable training conditions.'], mechanismHypothesis: 'A short cue may help Avery return attention to the next length.', alternatives: ['Fitness or pacing may matter more.', 'No cue may be needed.'], possibility: 'Avery may race more freely after an imperfect moment.', horizon: 'Six comparable segments, then review.', evidenceIds: ['C10', 'C11', 'C14', 'C15', 'C16'], counterEvidenceIds: ['C16'], uncertainty: 'Transfer to a meet is unknown.', indicators: ['The cue is usable.', 'Planned next-length behavior returns.'], falsifier: 'The cue adds control or no useful signal appears.', reviewTrigger: 'After six comparable segments.' },
      { title: 'Preparation stays a base, not a cage', athleteGoalId: 'G01', baselineClaimIds: [], condition: 'The plan can guide the race while allowing a fresh response to changed reality.', controllableActions: ['Keep the training plan stable.', 'Name what remains controllable after a mistake.'], externalDependencies: ['Event and meet context.'], mechanismHypothesis: 'Preparation may support freedom when it is not used to repair the previous moment.', alternatives: ['The current plan may need revision.', 'Pacing may be the more useful focus.'], possibility: 'Avery may use careful preparation without carrying each mistake forward.', horizon: 'Current season, with bounded reviews.', evidenceIds: ['C04', 'C08', 'C10'], counterEvidenceIds: ['C16'], uncertainty: 'The relationship between preparation and race response is not causal truth.', indicators: ['Avery reports trust in the plan.', 'Coach-observed behavior remains comparable.'], falsifier: 'Preparation becomes more rigid or performance does not change.', reviewTrigger: 'At a comparable practice or meet review.' },
      { title: 'A wider life stays visible', athleteGoalId: 'G02', baselineClaimIds: [], condition: 'Sport choices remain compatible with engineering, relationships, and creative life.', controllableActions: ['Review choices at major transitions.', 'Keep uncertainty about post-college sport open.'], externalDependencies: ['College, work, and sport opportunities.'], mechanismHypothesis: 'Making wider priorities visible may help Avery choose rather than default.', alternatives: ['Sport may become more or less central.', 'A different life direction may emerge.'], possibility: 'Avery may carry the strengths of sport into a life that is not defined only by performance.', horizon: 'Toward and beyond college.', evidenceIds: ['C01'], counterEvidenceIds: [], uncertainty: 'No career, scholarship, or sport outcome is predicted.', indicators: ['Choices remain athlete-authored.', 'Important relationships and interests remain visible.'], falsifier: 'Avery’s desired life changes.', reviewTrigger: 'At a major life or sport transition.' },
    ],
    move: {
      kind: 'explore', suggestion: 'If Avery and Coach Navarro both choose it, test one agreed reset cue after an imperfect early turn in six comparable segments while keeping the training plan stable.', purpose: 'Learn whether the cue is usable without naming the cause.', evidenceIds: ['C10', 'C11', 'C16', 'C20'], alternativesConsidered: ['Make no change yet.', 'Gather a larger split sample first.', 'Focus on pacing or fitness instead.'], whyThis: 'It is bounded, reversible, and fits current capacity.', proposedActor: 'Avery and Coach Navarro, only by shared choice.', willingness: 'proposal_only', prerequisites: ['Comparable segments.', 'One agreed cue.', 'No additional training load.'], burden: 'Six existing segments and brief separate observations.', risk: 'The cue may add control or distract from the race.', reversibility: 'Immediate.', observation: 'Turn quality, cue use, trust in the plan, next-length behavior, and split.', observationWindow: 'Six comparable segments.', reviewEvent: 'Review both accounts and the qualified record.', falsifier: 'The cue adds hesitation or comparable segments show no useful signal.', confounders: ['Fitness.', 'Pacing.', 'Training load.', 'Meet context.', 'Expectations.'], inconclusiveIf: 'Segments are not comparable or the sample remains too small.', stopOrAdjust: 'Stop if the cue adds load or either person wants to pause.', uncertainty: 'A useful result would not prove the cause or predict meet performance.',
    },
    unknowns: artifact.whole_person_model.uncertainty,
  };
  artifact.surface_packets = (artifact.surface_packets || []).map((packet) => {
    const copy = AVERY_SURFACES[packet.surface_id];
    if (!copy) return packet;
    return {
      ...packet,
      editorial_headline: copy.headline,
      primary_realization: copy.summary,
      rendering: {
        ...packet.rendering,
        headline: copy.headline,
        summary: copy.summary,
        evidence_count: 20,
        abstention_visible: true,
        visual: {
          ...(packet.rendering?.visual || {}),
          anchor: copy.summary,
          uncertainty: artifact.whole_person_model.uncertainty,
        },
      },
      human_realization: {
        ...packet.human_realization,
        customer_prose: `## ${copy.headline}\n\n${copy.summary}`,
      },
      resolved_local_truth: {
        ...(packet.resolved_local_truth || {}),
        unknowns: artifact.whole_person_model.uncertainty.slice(0, 2),
      },
    };
  });
  artifact.sourceHash = hashCanonicalJson({
    identity_context: artifact.identity_context,
    subject: artifact.subject,
    whole_person_model: artifact.whole_person_model,
    athlete_map: artifact.athlete_map,
    plan: artifact.plan,
    surface_packets: artifact.surface_packets,
  });
  return artifact;
}

function createAveryApa() {
  const subject = Object.freeze({ id: 'synthetic-athlete-avery', displayName: 'Avery', ageBand: '18–20', sport: 'Swimming', fictional: true });
  const relationship = Object.freeze({
    id: 'synthetic-athlete-avery-coach-navarro-apa-v1',
    athleteId: subject.id,
    instructorId: 'synthetic-instructor-navarro',
    instructorDisplayName: 'Coach Navarro',
    purpose: 'synthetic_joint_athlete_current_reality',
    audience: ['athlete', 'instructor'],
    writable: false,
    fictional: true,
  });
  const statements = [
    ['sport_context', 'This map concerns Avery’s current college swimming season.', 'SHARED_AGREEMENT', 'athlete+instructor', 'AGREED'],
    ['athlete_goal', 'Avery wants to race the second half with the same freedom shown in training.', 'ATHLETE_REPORT', 'athlete', 'REPORTED'],
    ['athlete_meaning', 'This matters because Avery wants careful preparation to support performance rather than become another source of control.', 'ATHLETE_REPORT', 'athlete', 'REPORTED'],
    ['instructor_priority', 'Coach Navarro is helping Avery reset after an imperfect turn without changing the whole race plan.', 'INSTRUCTOR_REPORT', 'instructor', 'REPORTED'],
    ['shared_goal', 'Avery and Coach Navarro agree that recovering the next length after a mistake is a useful current direction.', 'SHARED_AGREEMENT', 'athlete+instructor', 'AGREED'],
    ['athlete_focus', 'Avery is practicing one breath and one external cue after each turn.', 'ATHLETE_REPORT', 'athlete', 'REPORTED'],
    ['instructor_focus', 'Coach Navarro is holding pacing constant while observing the first turn and next length.', 'INSTRUCTOR_REPORT', 'instructor', 'REPORTED'],
    ['current_asset', 'Avery reports that detailed preparation makes training repeatable.', 'ATHLETE_REPORT', 'athlete', 'REPORTED'],
    ['current_asset', 'Coach Navarro has observed technically consistent starts and early-race pacing in four recent timed swims.', 'INSTRUCTOR_OBSERVATION', 'instructor', 'OBSERVED'],
    ['current_gap', 'Avery believes late-race inconsistency may be a fitness problem.', 'ATHLETE_REPORT', 'athlete', 'REPORTED'],
    ['current_gap', 'Coach Navarro has observed a larger drop after an early technical mistake than after clean early segments.', 'INSTRUCTOR_OBSERVATION', 'instructor', 'OBSERVED'],
    ['current_attempt', 'They have discussed a reset cue but have not yet accepted it as a shared intervention.', 'SHARED_AGREEMENT', 'athlete+instructor', 'AGREED'],
    ['execution_state', 'No jointly accepted reset intervention has been attempted yet.', 'SHARED_AGREEMENT', 'athlete+instructor', 'AGREED'],
    ['recent_change', 'Avery reports two training swims that felt freer after leaving the previous turn alone.', 'ATHLETE_REPORT', 'athlete', 'REPORTED'],
    ['recent_change', 'Coach Navarro observed steadier next-length pacing in one of those two swims and no clear difference in the other.', 'INSTRUCTOR_OBSERVATION', 'instructor', 'OBSERVED'],
    ['objective_evidence', 'A qualified six-swim split sample shows stable opening pace and variable later pace, with only two swims containing a coded early-turn error.', 'OBJECTIVE_RECORD', 'qualified-record', 'MEASURED'],
    ['persistent_gap', 'The current sources cannot establish whether fitness, pacing, reset behavior, or meet pressure is the main cause.', 'SHARED_AGREEMENT', 'athlete+instructor', 'AGREED'],
    ['current_constraint', 'Avery has room for one bounded addition, not another conditioning block.', 'ATHLETE_REPORT', 'athlete', 'REPORTED'],
    ['current_constraint', 'Coach Navarro reports that event distance and meet load must stay comparable before interpreting change.', 'INSTRUCTOR_REPORT', 'instructor', 'REPORTED'],
    ['upcoming_event', 'A fictional October 18 conference meet is the next possible observation point.', 'SHARED_AGREEMENT', 'athlete+instructor', 'AGREED'],
  ];
  const claims = statements.map(([topic, statement, sourceClass, actor, epistemicStatus], index) => ({
    id: `V${String(index + 1).padStart(2, '0')}`,
    topic,
    statement,
    sourceClass,
    actor,
    questionId: `APA${String(Math.min(14, index + 1)).padStart(2, '0')}`,
    epistemicStatus,
    confidence: 'DIRECT_SOURCE',
    ...(sourceClass === 'SHARED_AGREEMENT' ? { explicitAgreement: true } : {}),
    ...(sourceClass === 'OBJECTIVE_RECORD' ? { eventTime: '2026-09-02', recordRef: 'fictional-swim-split-sample-20260902', comparisonLimit: 'Six swims; only two coded early-turn errors.' } : {}),
  }));
  const openEvidence = Object.freeze({
    contradictions: [{ id: 'VU01', topic: 'late_race_constraint', statement: 'Avery emphasizes fitness; Coach Navarro emphasizes what happens after an early mistake. The current small record does not resolve the difference.', status: 'UNRESOLVED', sourceClaimIds: ['V10', 'V11', 'V16'] }],
    missing: [
      { id: 'VM01', topic: 'comparable_baseline', statement: 'A larger comparable split sample with coded turn quality is missing.', status: 'MISSING' },
      { id: 'VM02', topic: 'meet_transfer', statement: 'Repeated meet evidence after a jointly accepted reset experiment is missing.', status: 'MISSING' },
    ],
  });
  const customerViewModel = mapStrings(clone(ATHLETE_APA_PARITY_V1.customerViewModel), averyLanguage);
  customerViewModel.identity = { ...customerViewModel.identity, subjectId: subject.id, displayName: subject.displayName, sport: subject.sport };
  customerViewModel.hero = { ...customerViewModel.hero, title: 'Avery’s current Athlete map', summary: 'Training preparation is dependable. What changes later-race performance is still open.' };
  customerViewModel.layer0 = {
    ...customerViewModel.layer0,
    bigPicture: 'Preparation is consistent. The reason later-race execution varies is not settled.',
    bigPictureQualifier: 'Athlete report, instructor observation, and one small split sample disagree on the main constraint.',
    nextStep: 'Test one reset cue in six comparable race segments.',
    nextStepQualifier: 'Small enough to stop. Specific enough to observe. Not accepted yet.',
    cards: customerViewModel.layer0.cards.map((card) => card.id === 'move'
      ? { ...card, value: 'Test one reset cue in six comparable race segments.', qualifier: 'Suggestion only · not accepted' }
      : card.id === 'evidence'
        ? { ...card, items: [{ value: '20', label: 'Direct source items' }, { value: '3', label: 'Bounded interpretations' }, { value: '3', label: 'Open evidence items' }] }
        : card),
  };
  customerViewModel.destinations.where = {
    ...customerViewModel.destinations.where,
    headline: 'Preparation is steady. Race freedom varies.',
    domains: [
      { label: 'SPORT', summary: 'Technically consistent early swimming; later-race pace varies, especially in the small sample after an early turn error.', epistemicClass: 'MIXED_EVIDENCE' },
      { label: 'TRAINING', summary: 'Detailed preparation and repeatable technical work are supported by athlete report and instructor observation.', epistemicClass: 'SUPPORTED' },
      { label: 'WARRIOR MENTALITY', summary: 'Avery may carry one mistake forward, but fitness, pacing, meet context, and expectations remain plausible explanations.', epistemicClass: 'CONTRADICTED' },
    ],
    openReality: { text: 'Avery and Coach Navarro disagree about whether fitness or reset behavior matters most. The qualified sample is too small to decide.' },
  };
  customerViewModel.destinations.move = { ...customerViewModel.destinations.move, headline: 'Test one reset cue in six comparable race segments.', status: 'PROPOSED_NOT_ACCEPTED' };
  customerViewModel.destinations.plan = { ...customerViewModel.destinations.plan, headline: 'Hold the training plan steady and learn from one bounded reset test.', summary: 'No shared commitment is recorded yet.' };
  customerViewModel.destinations.evidence = { ...customerViewModel.destinations.evidence, headline: 'The sources disagree, and the sample is small.', highestValueMissing: openEvidence.missing.map((entry) => entry.statement) };
  return Object.freeze({
    subject,
    relationship,
    fixture: Object.freeze({ ...mapStrings(clone(ATHLETE_APA_PARITY_FIXTURE), averyLanguage), subject, relationship, claims, openEvidence, asOf: '2026-09-06T09:00:00-07:00' }),
    claims: Object.freeze(claims),
    openEvidence,
    customerViewModel: Object.freeze(customerViewModel),
    realizationIdentity: Object.freeze({ contract: 'athlete-apa-realization-identity-v1', fixture_id: 'avery', subject_id: subject.id, synthetic_only: true }),
  });
}

export const ATHLETE_CONSULT_DEMO_FIXTURE_IDS_V1 = Object.freeze(['mika', 'avery']);

export function createAthleteConsultDemoFixtureV1(fixtureId, rawMikaBos) {
  if (!ATHLETE_CONSULT_DEMO_FIXTURE_IDS_V1.includes(fixtureId)) throw new TypeError('ATHLETE_CONSULT_DEMO_FIXTURE_NOT_ALLOWED');
  if (fixtureId === 'mika') return Object.freeze({
    id: 'mika',
    subject: ATHLETE_APA_PARITY_SUBJECT,
    relationship: ATHLETE_APA_PARITY_RELATIONSHIP,
    rawBos: rawMikaBos,
    apaFixture: ATHLETE_APA_PARITY_FIXTURE,
    apaClaims: ATHLETE_APA_PARITY_CLAIMS,
    apaOpenEvidence: ATHLETE_APA_PARITY_OPEN_EVIDENCE,
    apaViewModel: ATHLETE_APA_PARITY_V1.customerViewModel,
    realizationIdentity: ATHLETE_APA_PARITY_V1.realizationIdentity,
    relationshipId: 'synthetic-athlete-mika-coach-ellis-consulting-tool-v1',
    membershipId: 'synthetic-athlete-mika-membership-consulting-tool-v1',
    athleteProfileId: 'synthetic-athlete-mika-profile-consulting-tool-v1',
    bosArtifactId: 'athlete-bos-mika-presentation-safe-v1',
    apaArtifactId: 'athlete-apa-mika-live-ba-parity-v1',
    plan: {
      summary: 'Test one shared cue in four comparable practice moments.',
      intervention: 'Use one agreed cue before four comparable practice sequences.',
      falsifier: 'The cue adds confusion, or comparable sequences show no useful signal.',
      attempt: 'Mika completed part of the agreed first-rep clarity check in two synthetic practice sessions.',
      outcome: 'In the synthetic follow-up, Mika entered the first rep with less hesitation in two sessions; the reason remains uncertain.',
      confounders: ['Practice intensity and drill familiarity also changed.'],
    },
  });
  const avery = createAveryApa();
  return Object.freeze({
    id: 'avery',
    subject: avery.subject,
    relationship: avery.relationship,
    rawBos: createAveryBosArtifact(rawMikaBos),
    apaFixture: avery.fixture,
    apaClaims: avery.claims,
    apaOpenEvidence: avery.openEvidence,
    apaViewModel: avery.customerViewModel,
    realizationIdentity: avery.realizationIdentity,
    relationshipId: 'synthetic-athlete-avery-coach-navarro-consulting-tool-v1',
    membershipId: 'synthetic-athlete-avery-membership-consulting-tool-v1',
    athleteProfileId: 'synthetic-athlete-avery-profile-consulting-tool-v1',
    bosArtifactId: 'athlete-bos-avery-presentation-safe-v1',
    apaArtifactId: 'athlete-apa-avery-live-ba-parity-v1',
    plan: {
      summary: 'Test one reset cue in six comparable race segments.',
      intervention: 'Use one agreed reset cue after the first turn in six comparable race segments.',
      falsifier: 'The cue increases hesitation, or comparable segments show no useful signal.',
      attempt: 'Avery used the agreed reset cue in four of six synthetic race segments.',
      outcome: 'In the synthetic follow-up, Avery’s next-length pace was steadier in two segments and unchanged in two; the reason remains uncertain.',
      confounders: ['Training load and event distance also changed.'],
    },
  });
}
