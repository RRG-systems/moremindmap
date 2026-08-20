const clone = (value) => JSON.parse(JSON.stringify(value));

export const FOUNDER_REVIEW_SUBJECT_V2 = Object.freeze({
  first_name: 'Marcus',
  business_name: 'Northstar Delivery Partners',
  vertical_id: 'PROFESSIONAL_SERVICES',
  vertical_label: 'Professional Services',
  business_reality: 'A growing professional-services firm with reliable demand and founder-dependent delivery decisions.',
  goal: 'Build dependable delivery capacity without lowering client quality.',
  constraint: 'Important delivery decisions and exceptions return to Marcus.',
  mechanism: 'Incomplete decision rights recenter exception handling on Marcus and keep delivery capacity founder-bound.',
  one_move: 'End-to-end ownership transfer trial',
  one_move_intervention: 'Transfer one recurring delivery lane with explicit decision rights, quality boundaries, exception rules, and inspected completion.',
  proof: 'The lane finishes on time and holds quality without Marcus rescuing it.',
  known: Object.freeze([
    'Six recurring delivery lanes are active.',
    'Eighteen client engagements are currently active.',
    'Fourteen routine delivery decisions returned to Marcus in the last observed week.',
    'One recurring delivery lane is currently manager-owned end to end.',
    'Client commitments were completed on time in 92% of the current review window.',
  ]),
  inferred: Object.freeze([
    'Incomplete decision rights may be reinforcing founder dependence.',
    'Managers appear to own tasks more consistently than complete delivery outcomes.',
  ]),
  missing: Object.freeze([
    'Capacity released after a full ownership transfer has not yet been measured.',
    'Manager-owned exception quality has not yet been observed across four complete cycles.',
  ]),
});

const FORBIDDEN_STALE_SEMANTICS = [
  /\breal[ -]?estate\b/giu,
  /\bclosings?\b/giu,
  /\bSOI\b/gu,
  /\blistings?\b/giu,
  /\bbuyers?\b/giu,
  /\bsellers?\b/giu,
  /\btop-of-mind\b/giu,
  /\b6\s*[×x]\s*6\b/giu,
  /\b8\s*[×x]\s*8\b/giu,
  /\b35\+\s*(?:touch|year)\b/giu,
  /\b(?:2800|1652|720|1800)\b/gu,
];

function objectDisplayLookup(viewModel) {
  const lookup = new Map();
  const add = (entry, payload = {}) => {
    if (!entry?.objectId) return;
    lookup.set(entry.objectId, {
      title: entry.title || entry.label || payload.title,
      value: entry.value || entry.headline || entry.summary || entry.text || payload.value,
      qualifier: entry.qualifier || entry.supportingText || payload.qualifier,
      tone: entry.tone || payload.tone,
    });
  };
  viewModel.layer0.cards.forEach((entry) => add({ ...entry, objectId: entry.objectId }, { value: entry.value, qualifier: entry.qualifier }));
  viewModel.destinations.where.metrics.forEach(add);
  Object.values(viewModel.destinations.where.pathway).flat().forEach(add);
  viewModel.destinations.where.realities.forEach(add);
  viewModel.destinations.where.entrances.forEach(add);
  viewModel.destinations.futures.items.forEach((entry) => add({ ...entry, value: `${entry.probability}%`, qualifier: entry.meaning }));
  viewModel.destinations.move.logic.forEach(add);
  viewModel.destinations.move.reasons.forEach(add);
  viewModel.destinations.move.proof.forEach(add);
  add({ ...viewModel.destinations.move.startHere, title: 'Start here', value: viewModel.destinations.move.startHere.text });
  viewModel.destinations.plan.strategies.forEach(add);
  viewModel.destinations.evidence.categories.forEach(add);
  viewModel.destinations.evidence.ledger.forEach((entry) => add({ ...entry, title: entry.reality }));
  viewModel.destinations.evidence.traceCards.forEach(add);
  return lookup;
}

function drawerPayload(destination, focusTitle) {
  const subject = FOUNDER_REVIEW_SUBJECT_V2;
  const byDestination = {
    where: {
      meaning: `${subject.business_reality} ${subject.constraint}`,
      goal: subject.goal,
      evidence: subject.known.slice(0, 4),
      missing: subject.missing,
    },
    futures: {
      meaning: 'Each trajectory is conditional on whether ownership, decision quality, demand, and delivery capacity change.',
      goal: 'Use trajectories to understand conditions and choices, not as destiny or calibrated certainty.',
      evidence: [subject.known[1], subject.known[2], subject.known[3], subject.inferred[0]],
      missing: subject.missing,
    },
    move: {
      meaning: `${subject.constraint} ${subject.mechanism}`,
      goal: `${subject.one_move}: ${subject.one_move_intervention}`,
      evidence: [subject.known[0], subject.known[2], subject.known[3], subject.proof],
      missing: subject.missing,
    },
    plan: {
      meaning: `The plan supports one business goal: ${subject.goal}`,
      goal: 'Every displayed Way must be grounded in customer-confirmed strategies; unfinished Ways remain open rather than being filled with invented strategy.',
      evidence: [subject.known[0], subject.known[2], subject.known[4], subject.one_move_intervention],
      missing: subject.missing,
    },
    evidence: {
      meaning: 'Known facts, bounded inference, and material missingness remain visibly separate.',
      goal: 'New observations should sharpen the map without silently rewriting accepted business truth.',
      evidence: subject.known,
      missing: subject.missing,
    },
  };
  const selected = byDestination[destination] || byDestination.evidence;
  return [
    { id: 'known', title: 'What we know', items: selected.evidence },
    { id: 'meaning', title: `What ${focusTitle || 'this'} means`, items: [selected.meaning] },
    { id: 'goal', title: 'What the goal requires', items: [selected.goal] },
    { id: 'counterevidence', title: 'Counterevidence and confounds', items: ['The team already completes routine delivery work reliably, so the issue may be narrower than overall capability.', 'Source economics or role fit could explain part of the capacity pressure.'] },
    { id: 'missing', title: 'What MORE still needs to know', items: selected.missing },
    { id: 'mind-change', title: 'What would change our view', items: ['Four complete manager-owned delivery cycles with few routine escalations, stable quality, and measurable capacity release would materially update the diagnosis.'] },
    { id: 'confidence', title: 'Evidence and confidence', items: ['Current confidence is moderate because the operating pattern is supported, while transfer outcomes remain unobserved.'] },
  ];
}

function planStrategies() {
  return [
    ['Map recurring delivery decisions', 'Identify the decisions that repeatedly return to Marcus and the client outcome each protects.'],
    ['Define decision-rights bands', 'Give the delivery owner explicit authority, quality boundaries, and exception rules.'],
    ['Create one explicit exception path', 'Route true exceptions without turning every decision into founder consultation.'],
    ['Score manager-owned delivery', 'Inspect completion, client quality, decision fidelity, and rework rather than task volume alone.'],
    ['Coach decision quality on a fixed cadence', 'Use a scheduled evidence review to build judgment without restoring founder dependence.'],
  ].map(([title, headline], index) => ({
    order: index + 1,
    mission: `PROFESSIONAL_SERVICES_OWNERSHIP_${index + 1}`,
    title,
    headline,
    description: headline,
    supportingText: headline,
    flow: [],
    target: null,
    firstAction: index === 0 ? 'Log recurring approvals and rescues for one delivery week.' : headline,
    cadence: 'Weekly evidence review.',
    observationWindow: 'Four complete delivery cycles.',
    scorecard: ['completion', 'client quality', 'rework', 'founder interventions'],
    proof: [FOUNDER_REVIEW_SUBJECT_V2.proof],
    stopConditions: ['Stop or narrow the transfer if client harm, hidden rework, margin loss, or uncontained risk appears.'],
    confidence: 'Moderate — current operating evidence supports a bounded ownership test.',
    objectId: `plan-strategy-${index + 1}`,
  }));
}

export function createSyntheticFounderReviewViewModelV2(templateViewModel) {
  const viewModel = clone(templateViewModel);
  const subject = FOUNDER_REVIEW_SUBJECT_V2;
  viewModel.identity = { firstName: subject.first_name, business: subject.business_name, vertical: subject.vertical_label };
  viewModel.hero = {
    eyebrow: `${subject.first_name}’s Business Twin`,
    title: 'Your business. Understood as one living system.',
    subtitle: 'One coherent business reality. Five destinations. One continuous coaching relationship.',
    modelDate: 'Synthetic founder-review fixture · Professional services',
  };

  const cards = viewModel.layer0.cards;
  Object.assign(cards.find((card) => card.id === 'where'), {
    value: '6', qualifier: 'Recurring delivery lanes', description: 'See the professional-services business as it stands today.',
    details: [
      { value: '18', label: 'Active client engagements', epistemicClass: 'REPORTED' },
      { value: '14 / week', label: 'Decisions returning to Marcus', epistemicClass: 'REPORTED' },
      { value: '1 of 6', label: 'Manager-owned delivery lanes', epistemicClass: 'REPORTED' },
      { value: '92%', label: 'On-time client commitments', epistemicClass: 'REPORTED' },
    ],
  });
  Object.assign(cards.find((card) => card.id === 'futures'), {
    value: '29%', qualifier: 'Better Future', description: 'Five conditional paths for this delivery business.',
    items: [
      { label: 'Current Course', probability: 22 }, { label: 'Emerging Future', probability: 17 },
      { label: 'Better Future', probability: 29 }, { label: 'Bold Future', probability: 21 },
      { label: 'Downside Future', probability: 11 },
    ],
  });
  Object.assign(cards.find((card) => card.id === 'move'), { value: subject.one_move, qualifier: subject.one_move_intervention });
  Object.assign(cards.find((card) => card.id === 'plan'), { value: 'One real way. Two honest openings.', qualifier: 'Finish the plan through conversation—without inventing strategy.' });
  Object.assign(cards.find((card) => card.id === 'evidence'), {
    value: '5 things known', qualifier: '2 inferred · 2 missing',
    items: [{ value: 5, label: 'Things we know' }, { value: 2, label: 'Things we infer' }, { value: 2, label: 'Things we still need to learn' }],
  });
  viewModel.layer0.bigPicture = 'The business most strongly supports a Better Future if one delivery lane proves it can stay owned without founder rescue.';
  viewModel.layer0.bigPictureQualifier = 'Current Course remains plausible while decision rights and released capacity are still unproven.';
  viewModel.layer0.nextStep = 'Choose one recurring delivery lane to transfer end to end.';
  viewModel.layer0.nextStepQualifier = 'Small enough to bound. Important enough to matter. Repeated often enough to observe.';

  viewModel.destinations.where = {
    eyebrow: '1. Where You Are', headline: 'Your current professional-services business snapshot.',
    subhead: 'The accepted picture of delivery, ownership, quality, and capacity today.',
    metrics: [
      { title: 'Recurring delivery lanes', value: '6', qualifier: 'Current / reported', tone: 'green', objectId: 'where-metric-1' },
      { title: 'Active client engagements', value: '18', qualifier: 'Current / reported', tone: 'green', objectId: 'where-metric-2' },
      { title: 'Decisions returning to Marcus', value: '14 / week', qualifier: 'Current review window', tone: 'amber', objectId: 'where-metric-3' },
      { title: 'On-time client commitments', value: '92%', qualifier: 'Current review window', tone: 'teal', objectId: 'where-metric-4' },
    ],
    pathway: {
      today: [
        { title: 'Active delivery lanes', value: '6', qualifier: 'Current / reported', tone: 'green', objectId: 'where-today-1' },
        { title: 'Manager-owned end to end', value: '1 lane', qualifier: 'Current / reported', tone: 'green', objectId: 'where-today-2' },
        { title: 'Founder-returned decisions', value: '14 / week', qualifier: 'Current review window', tone: 'amber', objectId: 'where-today-3' },
        { title: 'Active client engagements', value: '18', qualifier: 'Current / reported', tone: 'teal', objectId: 'where-today-4' },
      ],
      goal: [
        { title: 'Dependable manager-owned lanes', value: '3', qualifier: 'Stated operating goal', tone: 'indigo', objectId: 'where-goal-1' },
        { title: 'Client quality floor', value: '≥ 90%', qualifier: 'Stated protection boundary', tone: 'violet', objectId: 'where-goal-2' },
      ],
      required: [
        { title: 'Complete ownership transfer', value: '1 lane', qualifier: 'Bounded proof model', tone: 'violet', objectId: 'where-required-1' },
        { title: 'Explicit decision rights', value: 'Written', qualifier: 'Required operating condition', tone: 'violet', objectId: 'where-required-2' },
        { title: 'Observed delivery cycles', value: '4', qualifier: 'Evidence target', tone: 'violet', objectId: 'where-required-3' },
      ],
    },
    realities: [
      { title: 'Reliable demand', text: 'Eighteen active client engagements show that opportunity is not the primary current constraint.', tone: 'green', objectId: 'where-reality-1' },
      { title: 'Incomplete ownership', text: 'Routine delivery exceptions still lack durable decision boundaries.', tone: 'amber', objectId: 'where-reality-2' },
      { title: 'Founder-bound capacity', text: 'Fourteen routine decisions returned to Marcus in the last observed week.', tone: 'violet', objectId: 'where-reality-3' },
    ],
    gap: 'The gap is not simply more staff. It is proving that one complete delivery outcome can stay owned while client quality holds.',
    entrances: [
      { label: 'See the ownership numbers', objectId: 'where-required-1' },
      { label: 'See what MORE still needs to know', objectId: 'evidence-summary-missing' },
      { label: 'Explore the full business model', objectId: 'where-reality-2' },
    ],
  };

  const futureDefinitions = [
    ['current_course', 'Current Course', 22, 'Founder-centered delivery continues', 'If decision rights stay incomplete, reliable demand continues alongside recurring founder intervention.'],
    ['emerging_future', 'Emerging Future', 17, 'Early manager ownership begins to hold', 'If one lane stays owned through routine exceptions, early distributed capacity becomes observable.'],
    ['better_future', 'Better Future', 29, 'Durable manager-owned delivery', 'If outcome authority, quality boundaries, and evidence review align, delivery capacity can grow without returning every issue to Marcus.'],
    ['bold_future', 'Bold Future', 21, 'A leadership platform supports expansion', 'If distributed delivery proves stable, the firm can test broader growth without cloning the founder bottleneck.'],
    ['downside_future', 'Downside Future', 11, 'Demand amplifies founder dependence', 'If engagement volume rises before ownership changes, queues, rework, and founder load can widen.'],
  ];
  viewModel.destinations.futures = {
    eyebrow: `${subject.first_name}’s Business Twin`, headline: 'Five Possible Futures',
    subhead: 'Five conditional trajectories based on the same professional-services business reality.',
    probabilitySemantics: 'Modeled relative support across conditional trajectories, not destiny.',
    items: futureDefinitions.map(([role, label, probability, title, condition]) => ({
      role, label, meaning: title, title, probability, confidence: 'MODERATE', summary: condition, condition,
      keyCharacteristics: [subject.known[0], subject.known[2], subject.known[4], 'Transfer outcomes remain unobserved.'],
      supporting: [subject.known[0], subject.known[1], subject.known[2], subject.known[3]],
      opposing: ['The team already completes routine delivery work reliably.', 'Role fit or source economics may explain part of the pressure.'],
      missing: [...subject.missing],
      falsifiers: ['Four complete manager-owned cycles with stable quality and little founder intervention would materially change this path.'],
      objectId: `future-${role}`,
    })),
    ifMoveWorks: [15, 18, 39, 19, 9].map((probability, index) => ({ role: futureDefinitions[index][0], label: futureDefinitions[index][1], probability })),
  };

  viewModel.destinations.move = {
    eyebrow: 'Your One Move', headline: subject.one_move, subhead: subject.one_move_intervention,
    logic: [
      { label: 'What’s holding you back', value: 'Founder-centered delivery ownership', description: subject.constraint, tone: 'amber', objectId: 'move-logic-1' },
      { label: 'What’s causing it', value: 'Exceptions repeatedly return to Marcus', description: subject.mechanism, tone: 'violet', objectId: 'move-logic-2' },
      { label: 'The move', value: 'Transfer one delivery lane end to end', description: subject.one_move_intervention, tone: 'amber', objectId: 'move-logic-3' },
      { label: 'What we’re testing', value: 'Can delivery stay reliable without founder rescue?', description: subject.proof, tone: 'blue', objectId: 'move-logic-4' },
    ],
    reasons: [
      { title: 'It attacks the constraint', text: 'The problem is not simply needing more help. Decisions and accountability still tend to return to Marcus.', objectId: 'move-reason-1' },
      { title: 'It creates proof', text: 'One complete lane reveals whether ownership can move without client quality or delivery breaking down.', objectId: 'move-reason-2' },
      { title: 'It is bounded', text: 'The firm is not reorganizing everything. It will transfer one lane, inspect the result, and learn.', objectId: 'move-reason-3' },
    ],
    proof: [
      { label: 'The delivery lane finishes without Marcus rescuing it.', objectId: 'move-proof-1' },
      { label: 'Decisions stay with the owner inside explicit boundaries.', objectId: 'move-proof-2' },
      { label: 'Client quality holds without hidden intervention.', objectId: 'move-proof-3' },
      { label: 'Founder capacity is actually released.', objectId: 'move-proof-4' },
    ],
    startHere: { text: 'Choose one recurring delivery lane that keeps returning to Marcus.', qualifier: 'Small enough to transfer. Important enough to matter. Repeated often enough to observe.', objectId: 'move-start-here' },
    deepDiveObjectId: 'move-deep-dive',
  };

  viewModel.destinations.plan = {
    eyebrow: 'Your 1–3–5 Plan', headline: subject.goal,
    subhead: 'One goal. One complete way. Two honest openings for customer-supported strategy.',
    goal: { title: subject.goal, monthly: '3', monthlyLabel: 'manager-owned lanes', annual: '12 weeks', annualLabel: 'proof horizon', horizon: 'Twelve-week operating proof horizon.', classification: 'REPORTED' },
    ways: [
      { status: 'SELECTED_COMPLETE', title: 'Prove Manager-Owned Delivery', destinationState: 'One recurring delivery outcome stays owned without depending on Marcus’s availability.', whyPriority: subject.mechanism },
      { status: 'OPEN', title: null, destinationState: null, whyPriority: null },
      { status: 'OPEN', title: null, destinationState: null, whyPriority: null },
    ],
    strategies: planStrategies(),
    oneMove: { status: 'ALONGSIDE_PLAN_NOT_A_STRATEGY', title: subject.one_move, intervention: subject.one_move_intervention, whyAlongside: 'The plan builds durable delivery ownership while the One Move tests the governing mechanism.', proofBoundary: subject.proof },
    completion: { goal: true, way1: true, way2: false, way3: false },
  };

  const ledger = [
    ['Active delivery lanes', '6', 'REPORTED'], ['Active client engagements', '18', 'REPORTED'],
    ['Decisions returning to Marcus', '14 / week', 'REPORTED'], ['Manager-owned lanes', '1 of 6', 'REPORTED'],
    ['On-time client commitments', '92%', 'REPORTED'], ['Decision-rights bottleneck', 'Supported mechanism', 'INFERRED'],
    ['Task ownership versus outcome ownership', 'Not yet directly observed', 'MISSING'], ['Capacity released after transfer', 'Not yet measured', 'MISSING'],
  ].map(([reality, value, status], index) => ({ id: `evidence-row-${index + 1}`, reality, value, basis: status === 'REPORTED' ? 'Synthetic customer-reported evidence' : status === 'INFERRED' ? 'Evidence-bound interpretation' : 'Material evidence gap', status, confidence: status === 'REPORTED' ? 'Known' : status === 'INFERRED' ? 'Moderate' : 'Open', objectId: `evidence-row-${index + 1}` }));
  viewModel.destinations.evidence = {
    eyebrow: 'The Evidence', headline: 'See exactly what MORE knows — and what remains unproven.',
    subhead: 'Every conclusion stays connected to professional-services evidence, bounded inference, or explicit missingness.',
    categories: [
      { id: 'known', label: 'What we know', value: 5, summary: 'Current delivery, demand, ownership, and quality facts.', objectId: 'evidence-summary-known' },
      { id: 'inferred', label: 'What we believe is happening', value: 2, summary: 'Mechanisms remain conditional and evidence-bound.', objectId: 'evidence-summary-inferred' },
      { id: 'missing', label: 'What would sharpen the map', value: 2, summary: 'Transfer outcome and released-capacity evidence.', objectId: 'evidence-summary-missing' },
      { id: 'uncertain', label: 'What we’re still learning', value: 2, summary: 'Decision quality and durability across repeated cycles.', objectId: 'evidence-summary-uncertain' },
    ],
    ledger,
    coverage: [
      ['Demand', 'High', 2, 0, 0], ['Delivery', 'High', 2, 0, 0], ['Decision rights', 'Moderate', 1, 1, 1],
      ['Team ownership', 'Moderate', 1, 1, 1], ['Client quality', 'High', 1, 0, 0], ['Capacity release', 'Open', 0, 0, 1],
      ['Economics', 'Open', 0, 0, 1], ['Direction and goal', 'High', 1, 0, 0],
    ].map(([territory, confidence, known, inferred, missing]) => ({ territory, confidence, known, inferred, missing })),
    counterevidence: ['The team already completes routine delivery work reliably.', 'Role fit or source economics may explain part of the capacity pressure.'],
    mindChanges: ['Four complete manager-owned delivery cycles with stable quality, few routine escalations, and measurable capacity release.'],
    truthColumns: [
      { label: 'Factual reality', title: 'What MORE knows', items: [...subject.known] },
      { label: 'Interpreted reality', title: 'What MORE believes is happening', items: [...subject.inferred] },
      { label: 'Open questions', title: 'What MORE still needs to know', items: [...subject.missing] },
    ],
    traceCards: [
      { label: 'WHY — Governing Constraint', title: 'Founder-centered delivery ownership', summary: subject.constraint, tone: 'green', objectId: 'evidence-trace-1' },
      { label: 'Five Futures', title: 'Five conditional trajectories', summary: 'Current Course, Emerging, Better, Bold, and Downside paths remain conditional.', tone: 'violet', objectId: 'evidence-trace-2' },
      { label: 'One Move', title: subject.one_move, summary: subject.one_move_intervention, tone: 'amber', objectId: 'evidence-trace-3' },
      { label: 'Plan', title: '1 Goal → 1 complete Way → 2 honest openings', summary: subject.goal, tone: 'blue', objectId: 'evidence-trace-4' },
    ],
    qualityKey: [
      ['Known', 'Customer-reported or evidence-backed fact.'], ['Calculated', 'Deterministic result from accepted inputs.'],
      ['Inferred', 'Supported interpretation, not direct observation.'], ['Modeled', 'Conditional goal-supporting requirement.'],
      ['Missing', 'Important evidence not yet available.'], ['Contradicted', 'Accepted evidence does not currently reconcile.'],
    ].map(([label, meaning]) => ({ label, meaning })),
    highestValueMissing: [...subject.missing],
  };

  viewModel.livingMap = { headline: 'Keep this professional-services Business Twin alive as the business changes.', copy: 'The current map holds one coherent synthetic business reality.', action: 'What a Living Twin means', active: false };

  const lookup = objectDisplayLookup(viewModel);
  const destinationLabels = { where: 'Current business reality', futures: 'Conditional business trajectory', move: subject.one_move, plan: subject.goal, evidence: 'Governed business evidence' };
  for (const [objectId, object] of Object.entries(viewModel.objects)) {
    const mapped = lookup.get(objectId) || { title: destinationLabels[object.destination] || 'Governed business intelligence' };
    object.display_payload = {
      title: mapped.title || destinationLabels[object.destination],
      ...(mapped.value != null ? { value: String(mapped.value) } : {}),
      ...(mapped.qualifier != null ? { qualifier: String(mapped.qualifier) } : {}),
      tone: mapped.tone || object.display_payload?.tone || 'green',
    };
    object.drawer_payload = drawerPayload(object.destination, object.display_payload.title);
  }
  const coherence = scanSyntheticFounderReviewCoherenceV2(viewModel);
  if (!coherence.valid) throw new TypeError(`FREE_GPT_V2_SYNTHETIC_SUBJECT_INCOHERENT:${coherence.matches.join('|')}`);
  return viewModel;
}

export function scanSyntheticFounderReviewCoherenceV2(value) {
  const serialized = JSON.stringify(value);
  const matches = [...new Set(FORBIDDEN_STALE_SEMANTICS.flatMap((pattern) => serialized.match(pattern) || []))].sort();
  const required = [
    FOUNDER_REVIEW_SUBJECT_V2.business_name,
    FOUNDER_REVIEW_SUBJECT_V2.vertical_label,
    FOUNDER_REVIEW_SUBJECT_V2.goal,
    FOUNDER_REVIEW_SUBJECT_V2.one_move,
  ];
  const missing_required = required.filter((term) => !serialized.includes(term));
  return { valid: matches.length === 0 && missing_required.length === 0, matches, missing_required };
}
