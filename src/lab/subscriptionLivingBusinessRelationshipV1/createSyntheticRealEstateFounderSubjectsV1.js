import { createSyntheticFounderReviewViewModelV2 } from './createSyntheticFounderReviewSubjectV2.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const SUBJECTS = {
  're-early': {
    key: 're-early', firstName: 'Elena', businessName: 'Cedar Key Realty', stage: 'EARLY_STAGE_AGENT',
    production: '$1.6M trailing-12-month sales volume', goal: 'Build toward one dependable closing per month without relying on last-minute activity spikes.',
    goalShort: '12 closings / year', operatingGoal: '1 closing / month',
    wholePerson: {
      communication: 'Elena engages best with plain language, a visible reason for the question, and one decision at a time.',
      motivation: 'She wants a stable real-estate business that supports her family without making every month feel like a restart.',
      feasibility: 'Small observable experiments fit better than a dense operating overhaul while evidence is still thin.',
    },
    businessReality: 'An early-stage residential agent with some relationship traction, uneven opportunity flow, and incomplete measurement across database, lead generation, conversion, skills, systems, and execution.',
    metrics: [
      ['Closed volume', '$1.6M', 'Trailing 12 months · reported'], ['Closings', '5', 'Trailing 12 months · reported'],
      ['Contacts', '~340', 'Combined sources · reported estimate'], ['Active opportunities', '3', 'Current · reported'],
    ],
    known: ['Five closings were reported in the trailing 12 months.', 'Approximately 340 contacts exist across a CRM, phone, and personal lists.', 'Three opportunities are currently described as active.', 'Two recent closings came from referrals.', 'No weekly opportunity-flow scorecard is currently maintained.'],
    inferred: ['Inconsistent qualified opportunity flow and weak stage visibility are both plausible contributors.', 'Relationship strength may be underused, but the qualified portion of the database is not yet known.'],
    missing: ['Reconciled lead-source and stage-conversion history.', 'Current qualified-relationship count and live-conversation pace.', 'Appointments held versus set during the last 90 days.', 'Skill evidence separating conversation volume from conversion quality.', 'Expense, commission, and capacity reconciliation.'],
    counterevidence: ['Two referral closings show that relationships can already produce business.', 'Three active opportunities mean the business is not starting from zero demand.'],
    constraint: 'The business cannot yet distinguish insufficient qualified opportunity flow from inconsistent conversion and follow-through.',
    mechanisms: ['Lead activity is not consistently classified by source and stage.', 'Database quality and relationship recency remain partly estimated.', 'Follow-up happens, but the operating cadence is not reliably visible.', 'Skill, activity, and conversion evidence are not reconciled.'],
    falsifier: 'Four weeks of reconciled activity and stage data showing healthy qualified flow but weak appointment-to-client conversion would move the diagnosis toward skill or conversion.',
    futures: [25, 20, 24, 15, 16],
    futureMeanings: ['Uneven production continues while evidence remains thin.', 'A repeatable weekly opportunity rhythm begins to form.', 'The relationship asset produces a more dependable one-closing-per-month path.', 'One channel and follow-up system create faster-than-expected momentum.', 'Inconsistent activity and weak visibility extend the restart cycle.'],
    oneMove: 'Four-week opportunity-flow truth sprint',
    intervention: 'Track every qualified conversation, appointment, active opportunity, follow-up completion, and source for four weeks while protecting two consistent opportunity blocks.',
    proof: 'The four-week record shows whether the primary shortfall is opportunity volume, source quality, conversion, or execution—and produces at least one repeatable next action.',
    planWay: 'Build a measurable weekly opportunity rhythm',
    strategies: ['Define a qualified conversation', 'Reconcile active opportunities', 'Protect two weekly opportunity blocks', 'Track source-to-appointment movement', 'Review the numbers and adjust weekly'],
    weekly: {
      preference: 'Keep the explanation practical and show Elena the smallest observable next step.',
      commitment: 'Complete two protected opportunity blocks and reconcile every active opportunity for one week.',
      outcome: 'Both opportunity blocks were completed. Nine qualified conversations were recorded, one appointment was held, three active opportunities were reconciled, and two follow-ups slipped into the next week.',
    },
  },
  're-mid': {
    key: 're-mid', firstName: 'Jordan', businessName: 'Jordan Lee Residential', stage: 'MID_LEVEL_AGENT_PRIMARY_FOUNDER_TEST',
    production: '$5.2M trailing-12-month sales volume', goal: 'Grow toward $10M in annual sales volume while learning whether first leverage will release productive capacity.',
    goalShort: '$10M annual volume', operatingGoal: 'Approximately 24–26 closings / year',
    wholePerson: {
      communication: 'Jordan prefers direct, specific dialogue, wants the numbers visible, and engages most when a question reveals a real tradeoff rather than presuming the answer.',
      motivation: 'Jordan wants meaningful growth and more control of time without diluting the client experience that created the business.',
      feasibility: 'Jordan can sustain a bounded measurement or delegation test, but a broad hire-before-clarity plan risks adding management load.',
    },
    businessReality: 'A mid-level residential agent with credible referral strength, partial pipeline visibility, rising service load, and genuine uncertainty about whether the next constraint is opportunity flow, conversion, operating discipline, or first leverage.',
    metrics: [
      ['Closed volume', '$5.2M', 'Trailing 12 months · reported'], ['Closings', '13', 'Trailing 12 months · reported'],
      ['Combined contacts', '~820', 'CRM + phone · reported estimate'], ['Active opportunities', '10', 'Current · reported, not reconciled'],
    ],
    known: ['Thirteen closings and approximately $5.2M in volume were reported for the trailing 12 months.', 'Approximately 820 contacts exist across the CRM and phone.', 'Referrals are believed to have produced about 58% of recent closings.', 'Ten opportunities are currently described as active, but stage definitions are inconsistent.', 'Jordan estimates about 13 weekly hours on coordination, scheduling, paperwork, and CRM cleanup.', 'A first assistant is being considered, but no role scorecard or capacity baseline exists.'],
    inferred: ['Referral strength is real, while repeatable relationship activation may be less systematic than the asset warrants.', 'Administrative load may be consuming opportunity time, but the amount of truly transferable work is not yet proven.', 'The $10M gap may involve more than one constraint: qualified flow, conversion, operating cadence, and capacity all remain plausible.'],
    missing: ['Reconciled 90-day source-to-close conversion by stage.', 'Current qualified-relationship count and actual live-conversation pace.', 'Time study separating client-value work, transaction coordination, lead generation, and avoidable rework.', 'Gross commission, expense, and margin reconciliation sufficient for a hire decision.', 'Evidence that an assistant would own outcomes rather than merely absorb tasks.', 'Listings-versus-buyers mix and capacity effect across the last 12 months.'],
    counterevidence: ['Thirteen closings show that Jordan can already convert some opportunities.', 'Referral concentration may indicate strong relationship equity rather than a pure lead shortage.', 'Ten described active opportunities could support near-term growth if their stage quality is real.', 'Administrative load may reflect temporary transaction mix rather than a durable role constraint.'],
    constraint: 'The business does not yet have enough reconciled opportunity-and-capacity evidence to know whether doubling production requires more qualified flow, better conversion, stronger operating discipline, first leverage, or a combination.',
    mechanisms: ['Relationship opportunity is not consistently classified from contact through close.', 'Source and stage definitions are uneven, weakening diagnosis.', 'Administrative work and founder-only client work are not separated cleanly.', 'The contemplated assistant role has no bounded outcome or economic proof yet.'],
    falsifier: 'A four-week record showing sufficient qualified flow and conversion while 10–15 hours of transferable work repeatedly crowds out client-value activity would materially strengthen the first-leverage hypothesis.',
    futures: [24, 18, 28, 18, 12],
    futureMeanings: ['Jordan keeps growing unevenly through personal effort and referrals.', 'Measurement and operating cadence improve before a hire is justified.', 'A clearer relationship-to-opportunity engine and bounded leverage test support sustainable progress toward $10M.', 'Strong pipeline evidence and role clarity enable faster scale with first leverage.', 'A premature hire or unresolved opportunity gap adds cost without releasing productive capacity.'],
    oneMove: 'Four-week opportunity-and-capacity baseline',
    intervention: 'For four weeks, reconcile opportunity stages and sources while tracking Jordan’s time by client-value work, opportunity creation, transaction coordination, rework, and work that could have a different owner.',
    proof: 'The record identifies the dominant growth constraint and defines a bounded assistant outcome—or proves that hiring is not yet the next move.',
    planWay: 'Build a measurable path from relationships to dependable opportunity',
    strategies: ['Reconcile the current pipeline', 'Define qualified relationship and opportunity stages', 'Protect opportunity-creation time', 'Track source, conversion, and time use', 'Use four weeks of evidence to decide the leverage test'],
    weekly: {
      preference: 'Give Jordan the numbers first, stay concise, and ask one question that exposes the real decision.',
      commitment: 'Track every opportunity movement and classify work time for five business days.',
      outcome: 'Jordan tracked all five days: 17 qualified conversations, four appointments, two signed clients, 11.5 hours of coordination, 3 hours of CRM/rework, and one missed follow-up block after a client issue.',
    },
  },
  're-team': {
    key: 're-team', firstName: 'Sofia', businessName: 'Ramirez Property Group', stage: 'HIGHER_PRODUCING_TEAM_TRANSITION',
    production: '$18.4M trailing-12-month sales volume', goal: 'Grow a profitable team business toward $28M while reducing leader-only production and preserving client trust.',
    goalShort: '$28M profitable team volume', operatingGoal: 'Leader capacity released without quality loss',
    wholePerson: {
      communication: 'Sofia values direct challenge, fast synthesis, and explicit proof; she also notices quickly when a recommendation ignores people or client trust.',
      motivation: 'She wants a business that creates opportunity for the team and no longer requires her to be the invisible operating system.',
      feasibility: 'Sofia can move quickly, but a visible seat/decision-rights test is more reliable than announcing a new org chart before role evidence is complete.',
    },
    businessReality: 'A higher-producing residential team moving from leader-powered production toward an operating business, with meaningful demand, mixed team ownership, incomplete economics, and plausible constraints across leadership, role/seat, systems, capacity, and organizational design.',
    metrics: [
      ['Closed volume', '$18.4M', 'Trailing 12 months · team-reported'], ['Closings', '44', 'Trailing 12 months · team-reported'],
      ['Team', '3 + leader', 'Admin, buyer agent, contract TC'], ['Active opportunities', '16', 'Current · mixed stage confidence'],
    ],
    known: ['Forty-four team closings and approximately $18.4M in volume were reported for the trailing 12 months.', 'The team includes an administrator, one buyer agent, and a contract transaction coordinator.', 'Sofia still leads nearly every listing consultation and most pricing or client-exception decisions.', 'Sixteen opportunities are currently described as active across buyer and listing work.', 'Weekly team meetings occur, but role scorecards and decision rights are inconsistent.', 'Team profitability and leader-versus-team production are not fully reconciled.'],
    inferred: ['Opportunity volume appears meaningful enough that organizational throughput may matter.', 'Role ambiguity and leader recapture may be limiting leverage, while skill distribution and economics remain alternative explanations.', 'The team may need clearer seats and operating standards, but the evidence does not yet justify a full redesign.'],
    missing: ['Reconciled team P&L and leader-versus-team gross commission.', 'Stage conversion by agent and opportunity type.', 'Decision-rights and role/seat map for listings, buyers, pricing, and client exceptions.', 'Evidence of which work truly requires Sofia’s judgment.', 'Quality, rework, and customer-experience signals by owner.', 'Recruiting, education, and accountability effectiveness over time.'],
    counterevidence: ['The buyer agent has independently closed several clients with strong satisfaction.', 'The current team already handles transaction coordination reliably.', 'Listing concentration on Sofia may reflect market positioning, not only delegation failure.'],
    constraint: 'The team has not yet separated leader-essential judgment from work that should belong to durable roles, and the economic/quality evidence is incomplete.',
    mechanisms: ['Key decisions and relationships remain concentrated in Sofia.', 'Role ownership, scorecards, and exception rights vary by situation.', 'Team economics do not yet show which leverage creates profitable capacity.', 'Skill development and operating-system gaps may be intertwined.'],
    falsifier: 'A seat-specific trial with stable quality, profitable throughput, and fewer leader interventions would support organizational leverage; failure despite clear authority would shift attention toward skill, role fit, or business-model economics.',
    futures: [21, 20, 26, 23, 10],
    futureMeanings: ['Leader-powered production remains the primary engine.', 'Selected roles gain ownership while Sofia still carries critical exceptions.', 'A clearer leadership and operating model creates profitable team leverage.', 'Strong role/seat evidence supports a larger organizational transition.', 'Complexity and payroll rise faster than independent production and profit.'],
    oneMove: 'One-seat decision-rights and outcome trial',
    intervention: 'Choose one recurring team outcome, name the accountable seat, define decision and exception rights, inspect quality and economics, and observe whether Sofia’s intervention actually declines.',
    proof: 'The seat owns the outcome through repeated cycles, quality and economics hold, and Sofia’s intervention falls without hidden rescue or client harm.',
    planWay: 'Prove durable role ownership before redesigning the organization',
    strategies: ['Map leader-essential decisions', 'Choose one outcome and accountable seat', 'Define decision and exception rights', 'Track quality, economics, and intervention', 'Use repeated evidence to keep, coach, change, or stop'],
    weekly: {
      preference: 'Be direct with Sofia, show the economic and operating evidence, and challenge assumptions without flattening the people involved.',
      commitment: 'Let the buyer-agent seat own one complete buyer decision cycle under written exception rules.',
      outcome: 'The buyer agent owned two client decisions and one inspection negotiation; client response stayed positive, one pricing exception returned to Sofia, and Sofia intervened once without a documented trigger.',
    },
  },
};

export const SYNTHETIC_REAL_ESTATE_SUBJECTS_V1 = Object.freeze(Object.fromEntries(Object.entries(SUBJECTS).map(([key, value]) => [key, Object.freeze(value)])));

function drawerPayload(subject, destination) {
  const mission = {
    where: 'See the accepted current numbers and the material evidence gaps without pretending the business is fully measured.',
    futures: 'Understand five conditional paths and what evidence or choices would move relative support.',
    move: `Inspect the current governed experiment: ${subject.oneMove}. It is a testable recommendation, not a predetermined truth.`,
    plan: `Advance the stated goal while preserving open strategy where customer-supported paths are not yet complete: ${subject.goal}`,
    evidence: 'Keep reported facts, bounded inference, counterevidence, contradiction, and missingness visibly distinct.',
  }[destination] || 'Inspect the governed business reality without forcing a coaching framework.';
  return [
    { id: 'known', title: 'What we know', items: subject.known },
    { id: 'meaning', title: 'What this may mean', items: [mission, ...subject.inferred] },
    { id: 'counterevidence', title: 'Counterevidence and alternatives', items: subject.counterevidence },
    { id: 'missing', title: 'What MORE still needs to know', items: subject.missing },
    { id: 'mind-change', title: 'What would change our view', items: [subject.falsifier] },
    { id: 'confidence', title: 'Evidence and confidence', items: ['Confidence remains moderate-to-limited because multiple constraint explanations remain plausible and material evidence is missing.'] },
  ];
}

function strategyObjects(subject) {
  return subject.strategies.map((title, index) => ({
    order: index + 1, mission: `SYNTHETIC_RE_${subject.key.toUpperCase().replaceAll('-', '_')}_${index + 1}`,
    title, headline: title, description: title, supportingText: title, flow: [], target: null,
    firstAction: index === 0 ? title : `Define the smallest observable action for ${title.toLowerCase()}.`,
    cadence: 'Weekly evidence review.', observationWindow: 'Four weeks.', scorecard: ['qualified opportunity', 'conversion', 'time/capacity', 'quality', 'learning'],
    proof: [subject.proof], stopConditions: ['Stop or narrow any test if client harm, material financial risk, hidden rework, or uncontained workload appears.'],
    confidence: 'Moderate-to-limited — a bounded evidence-building test is warranted while diagnosis remains open.', objectId: `plan-strategy-${index + 1}`,
  }));
}

function replaceResidualSyntheticTemplateStrings(value, subject) {
  if (typeof value === 'string') return value
    .replaceAll('Northstar Delivery Partners', subject.businessName)
    .replaceAll('Marcus', subject.firstName)
    .replaceAll('Professional Services', 'Real Estate')
    .replaceAll('professional-services', 'real-estate')
    .replaceAll('professional services', 'real estate')
    .replaceAll('delivery lane', 'operating area')
    .replaceAll('delivery lanes', 'operating areas');
  if (Array.isArray(value)) return value.map((item) => replaceResidualSyntheticTemplateStrings(item, subject));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceResidualSyntheticTemplateStrings(item, subject)]));
  return value;
}

export function createSyntheticRealEstateFounderViewModelV1(templateViewModel, subjectKey = 're-mid') {
  const subject = SUBJECTS[subjectKey];
  if (!subject) throw new TypeError('SUBSCRIPTION_SYNTHETIC_REAL_ESTATE_SUBJECT_UNKNOWN');
  const viewModel = clone(createSyntheticFounderReviewViewModelV2(templateViewModel));
  viewModel.identity = { firstName: subject.firstName, business: subject.businessName, vertical: 'Real Estate' };
  viewModel.hero = { eyebrow: `${subject.firstName}’s Business Twin`, title: 'Your real-estate business. Understood as one living system.', subtitle: 'One living map. Five destinations. One continuous business relationship.', modelDate: `Fully synthetic Founder fixture · ${subject.stage}` };

  const cards = viewModel.layer0.cards;
  Object.assign(cards.find((card) => card.id === 'where'), { value: subject.metrics[0][1], qualifier: subject.metrics[0][0], description: 'See the current real-estate business without filling evidence gaps.', details: subject.metrics.slice(1).map(([label, value, qualifier]) => ({ value, label, epistemicClass: qualifier })) });
  Object.assign(cards.find((card) => card.id === 'futures'), { value: `${Math.max(...subject.futures)}%`, qualifier: 'Highest relative support', description: 'Five conditional paths grounded in the same incomplete evidence.', items: ['Current Course', 'Emerging Future', 'Better Future', 'Bold Future', 'Downside Future'].map((label, index) => ({ label, probability: subject.futures[index] })) });
  Object.assign(cards.find((card) => card.id === 'move'), { value: subject.oneMove, qualifier: subject.intervention });
  Object.assign(cards.find((card) => card.id === 'plan'), { value: 'One grounded way. Two honest openings.', qualifier: subject.planWay });
  Object.assign(cards.find((card) => card.id === 'evidence'), { value: `${subject.known.length} things known`, qualifier: `${subject.inferred.length} inferred · ${subject.missing.length} missing`, items: [{ value: subject.known.length, label: 'Things we know' }, { value: subject.inferred.length, label: 'Things we infer' }, { value: subject.missing.length, label: 'Things we still need to learn' }] });
  viewModel.layer0.bigPicture = `${subject.production}. Multiple growth explanations remain plausible; the current map preserves the uncertainty rather than forcing one diagnosis.`;
  viewModel.layer0.bigPictureQualifier = subject.constraint;
  viewModel.layer0.nextStep = subject.oneMove;
  viewModel.layer0.nextStepQualifier = subject.proof;

  viewModel.destinations.where = {
    eyebrow: '1. Where You Are', headline: `${subject.firstName}’s current real-estate business snapshot.`, subhead: subject.businessReality,
    metrics: subject.metrics.map(([title, value, qualifier], index) => ({ title, value, qualifier, tone: index < 2 ? 'green' : index === 2 ? 'amber' : 'teal', objectId: `where-metric-${index + 1}` })),
    pathway: {
      today: subject.metrics.map(([title, value, qualifier], index) => ({ title, value, qualifier, tone: 'green', objectId: `where-today-${index + 1}` })),
      goal: [{ title: 'Stated goal', value: subject.goalShort, qualifier: subject.goal, tone: 'indigo', objectId: 'where-goal-1' }, { title: 'Operating direction', value: subject.operatingGoal, qualifier: 'Customer-stated direction', tone: 'violet', objectId: 'where-goal-2' }],
      required: [{ title: 'Decision-useful evidence', value: '4 weeks', qualifier: 'Bounded current test', tone: 'violet', objectId: 'where-required-1' }, { title: 'Constraint diagnosis', value: 'Still open', qualifier: 'Multiple plausible explanations', tone: 'amber', objectId: 'where-required-2' }],
    },
    realities: [
      { title: 'Established production', text: subject.production, tone: 'green', objectId: 'where-reality-1' },
      { title: 'Competing explanations', text: subject.constraint, tone: 'amber', objectId: 'where-reality-2' },
      { title: 'Evidence before commitment', text: subject.falsifier, tone: 'violet', objectId: 'where-reality-3' },
    ],
    gap: `The gap is not automatically one tactic or hire. It is the measurable distance between ${subject.production} and ${subject.goalShort}, plus the evidence required to know what is governing it.`,
    entrances: [{ label: 'See the current numbers', objectId: 'where-metric-1' }, { label: 'See competing explanations', objectId: 'where-reality-2' }, { label: 'See what MORE still needs to know', objectId: 'evidence-summary-missing' }],
  };

  const roles = ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future'];
  const labels = ['Current Course', 'Emerging Future', 'Better Future', 'Bold Future', 'Downside Future'];
  viewModel.destinations.futures = {
    eyebrow: `${subject.firstName}’s Business Twin`, headline: 'Five Possible Futures', subhead: 'Five conditional trajectories from the same governed real-estate evidence.', probabilitySemantics: 'Modeled relative support across conditional trajectories, not probability or destiny.',
    items: roles.map((role, index) => ({ role, label: labels[index], meaning: subject.futureMeanings[index], title: subject.futureMeanings[index], probability: subject.futures[index], confidence: 'MODERATE_TO_LIMITED', summary: subject.futureMeanings[index], condition: subject.futureMeanings[index], keyCharacteristics: subject.known.slice(0, 4), supporting: subject.known.slice(0, 3), opposing: subject.counterevidence, missing: subject.missing, falsifiers: [subject.falsifier], objectId: `future-${role}` })),
    ifMoveWorks: roles.map((role, index) => ({ role, label: labels[index], probability: subject.futures[index] })),
  };

  viewModel.destinations.move = {
    eyebrow: 'Your One Move', headline: subject.oneMove, subhead: subject.intervention,
    logic: [
      { label: 'What is unresolved', value: 'The governing constraint is not yet singular', description: subject.constraint, tone: 'amber', objectId: 'move-logic-1' },
      { label: 'What may be causing it', value: 'Several mechanisms remain plausible', description: subject.mechanisms.join(' '), tone: 'violet', objectId: 'move-logic-2' },
      { label: 'The move', value: subject.oneMove, description: subject.intervention, tone: 'amber', objectId: 'move-logic-3' },
      { label: 'What we are testing', value: 'Which explanation survives evidence?', description: subject.proof, tone: 'blue', objectId: 'move-logic-4' },
    ],
    reasons: [
      { title: 'It preserves uncertainty', text: 'The current evidence does not justify pretending one tactic, skill, system, or leverage decision is already proven.', objectId: 'move-reason-1' },
      { title: 'It creates decision evidence', text: subject.proof, objectId: 'move-reason-2' },
      { title: 'It is bounded', text: 'The test is short enough to learn without locking the business into an unsupported redesign.', objectId: 'move-reason-3' },
    ],
    proof: [{ label: subject.proof, objectId: 'move-proof-1' }, { label: 'Known, inferred, missing, and contradicted evidence remain distinct.', objectId: 'move-proof-2' }, { label: 'The next decision changes when the evidence changes.', objectId: 'move-proof-3' }, { label: 'No real-estate tactic is presumed to be universally correct.', objectId: 'move-proof-4' }],
    startHere: { text: subject.strategies[0], qualifier: 'Begin with the smallest observable step that improves both the business and the diagnosis.', objectId: 'move-start-here' }, deepDiveObjectId: 'move-deep-dive',
  };

  viewModel.destinations.plan = {
    eyebrow: 'Your 1–3–5 Plan', headline: subject.goal, subhead: 'One customer-stated goal. One grounded Way. Two honest openings until more strategy is co-created.',
    goal: { title: subject.goal, monthly: subject.operatingGoal, monthlyLabel: 'Operating direction', annual: subject.goalShort, annualLabel: 'Stated goal', horizon: 'Current customer-stated horizon.', classification: 'REPORTED' },
    ways: [{ status: 'SELECTED_COMPLETE', title: subject.planWay, destinationState: subject.goal, whyPriority: subject.constraint }, { status: 'OPEN', title: null, destinationState: null, whyPriority: null }, { status: 'OPEN', title: null, destinationState: null, whyPriority: null }],
    strategies: strategyObjects(subject), oneMove: { status: 'ALONGSIDE_PLAN_NOT_A_STRATEGY', title: subject.oneMove, intervention: subject.intervention, whyAlongside: 'The plan advances the goal while the One Move improves the evidence required to choose well.', proofBoundary: subject.proof }, completion: { goal: true, way1: true, way2: false, way3: false },
  };

  const ledger = [
    ...subject.known.map((reality, index) => ({ id: `known-${index + 1}`, reality, value: 'Customer-reported synthetic evidence', basis: 'Synthetic governed fixture', status: 'REPORTED', confidence: 'Known', objectId: `evidence-row-${index + 1}` })),
    ...subject.inferred.map((reality, index) => ({ id: `inferred-${index + 1}`, reality, value: 'Evidence-bound interpretation', basis: 'Multiple explanations preserved', status: 'INFERRED', confidence: 'Moderate-to-limited', objectId: `evidence-row-${subject.known.length + index + 1}` })),
    ...subject.missing.map((reality, index) => ({ id: `missing-${index + 1}`, reality, value: 'Not yet known', basis: 'Material evidence gap', status: 'MISSING', confidence: 'Open', objectId: `evidence-row-${subject.known.length + subject.inferred.length + index + 1}` })),
  ];
  viewModel.destinations.evidence = {
    eyebrow: 'The Evidence', headline: 'See exactly what MORE knows — and what remains unresolved.', subhead: 'Reported facts, bounded inference, alternatives, and missingness stay visibly separate.',
    categories: [{ id: 'known', label: 'What we know', value: subject.known.length, summary: 'Synthetic customer-reported facts.', objectId: 'evidence-summary-known' }, { id: 'inferred', label: 'What we believe may be happening', value: subject.inferred.length, summary: 'Bounded interpretation.', objectId: 'evidence-summary-inferred' }, { id: 'missing', label: 'What would sharpen the map', value: subject.missing.length, summary: 'Material evidence gaps.', objectId: 'evidence-summary-missing' }, { id: 'uncertain', label: 'Competing explanations', value: subject.counterevidence.length, summary: 'Counterevidence and alternatives.', objectId: 'evidence-summary-uncertain' }],
    ledger, coverage: [{ territory: 'Relationships / database', confidence: 'Limited', known: 1, inferred: 1, missing: 2 }, { territory: 'Opportunity / lead flow', confidence: 'Limited', known: 1, inferred: 1, missing: 2 }, { territory: 'Conversion', confidence: 'Limited', known: 1, inferred: 1, missing: 2 }, { territory: 'Systems / execution', confidence: 'Moderate', known: 1, inferred: 1, missing: 1 }, { territory: 'Economics / capacity', confidence: 'Limited', known: 1, inferred: 1, missing: 2 }],
    counterevidence: subject.counterevidence, mindChanges: [subject.falsifier], truthColumns: [{ label: 'Factual reality', title: 'What MORE knows', items: subject.known }, { label: 'Interpreted reality', title: 'What MORE believes may be happening', items: subject.inferred }, { label: 'Open questions', title: 'What MORE still needs to know', items: subject.missing }],
    traceCards: [{ label: 'WHY — Current constraint hypothesis', title: 'Multiple explanations remain live', summary: subject.constraint, tone: 'green', objectId: 'evidence-trace-1' }, { label: 'Five Futures', title: 'Five conditional trajectories', summary: 'Relative support totals exactly 100.', tone: 'violet', objectId: 'evidence-trace-2' }, { label: 'One Move', title: subject.oneMove, summary: subject.intervention, tone: 'amber', objectId: 'evidence-trace-3' }, { label: 'Plan', title: '1 Goal → 1 grounded Way → 2 honest openings', summary: subject.goal, tone: 'blue', objectId: 'evidence-trace-4' }],
    qualityKey: [{ label: 'Known', meaning: 'Customer-reported synthetic fact.' }, { label: 'Inferred', meaning: 'Supported interpretation, not direct observation.' }, { label: 'Missing', meaning: 'Important evidence not yet available.' }, { label: 'Modeled', meaning: 'Conditional goal-supporting requirement.' }], highestValueMissing: subject.missing,
  };
  viewModel.livingMap = { headline: `Keep ${subject.firstName}’s Real Estate Business Twin alive as the business changes.`, copy: 'The map keeps business facts, hypotheses, and learning distinct.', action: 'What a Living Twin means', active: false };
  for (const object of Object.values(viewModel.objects)) {
    const destination = object.destination || 'evidence';
    object.display_payload = { title: destination === 'where' ? 'Current real-estate reality' : destination === 'futures' ? 'Conditional trajectory' : destination === 'move' ? subject.oneMove : destination === 'plan' ? subject.goal : 'Governed real-estate evidence', tone: object.display_payload?.tone || 'green' };
    object.drawer_payload = drawerPayload(subject, destination);
  }
  const cleaned = replaceResidualSyntheticTemplateStrings(viewModel, subject);
  const serialized = JSON.stringify(cleaned);
  const contamination = serialized.match(/\b(?:Patricia|Amber|Wally|Tammy|Daniel|Dave|Marcus|Northstar Delivery Partners|professional-services)\b/gu) || [];
  if (contamination.length) throw new TypeError(`SUBSCRIPTION_SYNTHETIC_REAL_ESTATE_CONTAMINATION:${[...new Set(contamination)].join('|')}`);
  if (subject.futures.reduce((sum, value) => sum + value, 0) !== 100) throw new TypeError('SUBSCRIPTION_SYNTHETIC_REAL_ESTATE_FUTURES_TOTAL_INVALID');
  return cleaned;
}

export function getSyntheticRealEstateSubjectV1(subjectKey = 're-mid') {
  const subject = SUBJECTS[subjectKey];
  if (!subject) throw new TypeError('SUBSCRIPTION_SYNTHETIC_REAL_ESTATE_SUBJECT_UNKNOWN');
  return clone(subject);
}
