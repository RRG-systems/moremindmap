import { buildPersonalityDnaRuntime } from '../lib/newBosPersonalityDnaV1/engine.js';
import { SYNTHETIC_FIXTURES } from '../lib/newBosPersonalityDnaV1/syntheticFixtures.js';
import { getSyntheticRealEstateSubjectV1 } from '../lab/subscriptionLivingBusinessRelationshipV1/createSyntheticRealEstateFounderSubjectsV1.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

function surface(eyebrow, headline, summary, extra = {}) {
  return { eyebrow, headline, summary, ...extra };
}

export function createSyntheticJordanBosArtifact() {
  const fixture = clone(SYNTHETIC_FIXTURES.find(({ fixture_id }) => fixture_id === 'atlas'));
  const subject = getSyntheticRealEstateSubjectV1('re-mid');
  const raw = fixture.rawEvidence;
  const draft = fixture.interpretationDraft;
  raw.subject_token = 'SYNTH-PDNV1-RECRUITING-HYBRID-JORDAN';
  raw.source_artifact_ids = ['synthetic_jordan_recruiting_bos_v1', 'subscription_synthetic_real_estate_subject_v1:re-mid'];
  raw.identity_context = { display_name: 'Jordan Lee', role: 'Synthetic real-estate business owner', context: 'Synthetic Recruiting Hybrid/GU V1 fixture; not a real customer.' };
  raw.scores = { command: 62, tempo: 58, relational_awareness: 78, precision: 74, leverage: 55, adaptability: 64, structure: 52, perspective: 73 };
  raw.score_source_refs = Object.fromEntries(Object.keys(raw.scores).map((id) => [id, ['synthetic_jordan_recruiting_bos_v1']]));
  raw.questions = [
    { question_id: 'q01', exact_question: 'What makes a business conversation useful?', exact_answer: 'Give me the numbers, be direct, and show me the tradeoff instead of assuming the answer.' },
    { question_id: 'q02', exact_question: 'What are you trying to protect as you grow?', exact_answer: 'The trust and client experience that created the business, plus enough control of my time to keep doing the work well.' },
    { question_id: 'q03', exact_question: 'What happens when the next move is unclear?', exact_answer: 'I can run a bounded test, but I do not want to add a person or a system before the real constraint is visible.' },
    { question_id: 'q04', exact_question: 'What helps you make a decision?', exact_answer: 'A clear baseline, specific evidence, and one question that exposes the real choice.' },
  ];
  raw.structured_inputs = [{ field: 'recruiting_context', exact_value: 'synthetic_co_present_business_meeting' }];
  raw.evidence = [
    { evidence_id: 'e01', epistemic_class: 'self_report', source_ref: 'q01', exact_content: subject.wholePerson.communication },
    { evidence_id: 'e02', epistemic_class: 'self_report', source_ref: 'q02', exact_content: subject.wholePerson.motivation },
    { evidence_id: 'e03', epistemic_class: 'self_report', source_ref: 'q03', exact_content: subject.wholePerson.feasibility },
    { evidence_id: 'e04', epistemic_class: 'self_report', source_ref: 'q04', exact_content: subject.weekly.preference },
    { evidence_id: 'e05', epistemic_class: 'contradiction', source_ref: 'cross_answer:q02:q03', exact_content: 'Jordan wants meaningful growth while refusing unsupported scale.' },
    { evidence_id: 'e06', epistemic_class: 'outcome_evidence', source_ref: 'synthetic_week_observation', exact_content: subject.weekly.outcome },
  ];
  raw.contradictions = [{ contradiction_id: 'c01', evidence_refs: ['e02', 'e05'], statement: 'Growth is wanted, while preserving trust and decision quality limits unsupported acceleration.' }];
  raw.uncertainties = [...subject.missing];
  raw.abstentions = ['No clinical or IQ inference.', 'No claim that personality proves the business constraint.', 'No customer or hiring outcome is predicted.'];

  draft.whole_person = {
    core_explanation: `${subject.wholePerson.communication} ${subject.wholePerson.motivation}`,
    central_tension: 'Jordan wants meaningful growth and more control of time without diluting the client trust that created the business.',
    mechanisms: ['Visible numbers make tradeoffs discussable.', 'A bounded test preserves agency while creating decision evidence.'],
    identity_tensions: ['Wants growth without trading away the human quality that makes the business work.'],
    goal_conflicts: ['Wants help releasing capacity, but not before the opportunity and capacity evidence supports it.'],
    private_calculations: ['If the evidence does not change the decision, the extra complexity is not yet worth it.'],
    pressure_and_recovery: 'Under pressure, Jordan benefits from separating the immediate client issue from the longer-term operating decision.',
    work_and_relationships: 'The strongest supported fit is direct, evidence-visible collaboration that preserves Jordan’s ownership of the decision.',
    identity_distillation: 'The Evidence-Grounded Relationship Builder',
    evidence_refs: ['e01', 'e02', 'e03', 'e04', 'e05', 'e06'],
    confidence: 'SUPPORTED_HYPOTHESIS',
    what_would_change_it: subject.falsifier,
  };
  draft.abstentions = [...raw.abstentions];
  draft.validation_backlog = [...subject.missing];
  draft.surface_renderings = {
    this_is_you: surface('Recognition', 'You build trust by making the real tradeoff discussable.', subject.wholePerson.communication, { highlights: ['Directness works best when the numbers and uncertainty are both visible.', 'You want help thinking—not a conclusion imposed on you.'] }),
    personality_dna: surface('Visual DNA', 'Relational awareness, specificity, and evidence travel together.', 'Your map supports careful client trust and practical decision-making. No score proves what is causing the current business constraint.', { highlights: ['Trust is an operating asset.', 'Visible evidence protects choice.'] }),
    how_you_operate: surface('Operating mechanics', 'You move when the next step is bounded and learnable.', subject.wholePerson.feasibility, { highlights: ['Best with a concrete baseline.', 'Resists complexity before clarity.'] }),
    how_people_experience_you: surface('Interpersonal experience', 'Direct, grounded, and protective of the relationship.', 'People are likely to know where you stand when the evidence is concrete. When evidence is weak, your refusal to pretend certainty can be mistaken for hesitation.', { highlights: ['Appreciated for honest tradeoffs.', 'Potential misunderstanding: evidence discipline can look like delay.'] }),
    communication_dna: surface('Communication', 'Numbers first. One real question. No manufactured certainty.', subject.weekly.preference, { highlights: ['Natural mode: direct and specific.', 'Repair move: separate fact, account, and hypothesis.'] }),
    strengths_vulnerabilities: surface('Strength and shadow', 'The strength is relationship-grounded judgment. The shadow is carrying too much personally.', 'Jordan can protect quality and trust while making practical calls. If that protection remains person-bound, growth can keep borrowing time from the same human.', { highlights: ['Strength: credible relational judgment.', 'Overuse cost: capacity stays personally held.'] }),
    pressure_conflict: surface('Pressure shift', 'Client urgency can displace the evidence-building work.', subject.weekly.outcome, { highlights: ['Normal: specific and relational.', 'Pressure: immediate client work wins.', 'Recovery: restore the baseline and review the tradeoff.'] }),
    work_dna: surface('Work environment', 'Give you client meaning, visible evidence, and ownership of the call.', 'Jordan is likely to work best where the human relationship matters and the operating numbers are honest. Unsupported scripts and hidden assumptions erode trust.', { highlights: ['Energizers: client value, real tradeoffs, usable evidence.', 'Drains: ceremony, vague pipeline language, unsupported promises.'] }),
    role_seat: surface('Role & seat', 'Natural fit: relationship-led producer with evidence-visible leverage.', 'The supported fit is a seat where trust, business development, and practical decision-making meet. This is not a universal role guarantee.', { highlights: ['Fit class: Natural Fit.', 'Condition: leverage must release capacity without diluting experience.', 'Evidence boundary: synthetic Recruiting context only.'] }),
    cognitive_operating_style: surface('Applied reasoning', 'You think by making the numbers and the human consequence visible together.', 'The evidence supports practical synthesis in a familiar business context. It does not support an IQ estimate or universal ranking.', { highlights: ['Supported: tradeoff reasoning and practical synthesis.', 'Still learning: behavior across unfamiliar roles.'] }),
    personal_operating_energy: surface('Operating energy', 'Meaningful client work activates; unresolved coordination load accumulates.', 'The synthetic evidence suggests that relational work matters and administrative ambiguity consumes attention. It does not establish wellbeing or a stable long-term energy baseline.', { highlights: ['Current business load: reported, not clinically interpreted.', 'Direction of travel: insufficient longitudinal evidence.'] }),
    five_futures: surface('Conditional trajectories', 'Five futures turn on whether opportunity and transferable capacity become visible.', 'These are conditional behavioral trajectories, not forecasts.', { futures: ['Current Course', 'Emerging Future', 'Better Future', 'Bold Future', 'Downside Future'].map((label, index) => ({ label, condition: subject.futureMeanings[index], trajectory: subject.futureMeanings[index] })) }),
    one_move: surface('Intervention', subject.oneMove, subject.intervention, { experiment: subject.proof, protects: 'Protects client trust and Jordan’s decision authority while improving the evidence.' }),
    evidence_certainty: surface('Make your map alive — the validation', 'The person is visible. The business cause remains open.', 'We know how Jordan prefers to think and what the synthetic business reports. We do not infer that a personality pattern caused the production or capacity question.', { highlights: ['Known: direct, specific, evidence-visible communication preference.', 'Supported: bounded testing fits the current decision.', 'Missing: reconciled opportunity, economics, and transferable capacity.', 'Abstention: no causal or hiring conclusion.'] }),
    operating_identity: surface('Operating identity', 'The Evidence-Grounded Relationship Builder', 'You create value by making trust and the real decision visible at the same time. Your next edge is proving which work must remain yours—and which work should not.', { highlights: ['A memorable distillation, not a fixed type.'] }),
  };
  return buildPersonalityDnaRuntime(fixture);
}
