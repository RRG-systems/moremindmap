import {
  buildProgressiveBusinessTwin,
  createBaProgressiveDisclosureV1,
  validateGeneralizedPlan135V1,
} from '../../../src/lib/baProgressiveDisclosureV1/index.js';

const CUSTOMER_TECHNICAL_REFERENCE = /(?:[a-f0-9]{64}|source(?:[_ ]?path|[_ ]?ref|[_ ]?future[_ ]?id)|evidence[_ ]?ref|lineage[_ ]?ref|vertical[_ ]?authority[_ ]?ref|inspector[_ ]?id|profile[_ ]?id|assessment[_ ]?id|chain.of.thought|relative support|not probability|how we calculate these probabilities)/giu;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function bounded(values, limit, fallback) {
  const accepted = [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object' && value.business_truth_changed === false) return value.execution_adjustment;
      return null;
    })
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim()))].slice(0, limit);
  return accepted.length ? accepted : [fallback];
}

function modeFor(source) {
  const move = [source.move?.title, source.move?.intervention, source.move?.execution?.workflow].filter(Boolean).join(' ');
  if (/conversion|source.to.stage|crm.*(?:flow|queue|pipeline)|dated next action/iu.test(move)) return 'VISIBLE_CONVERSION_SYSTEM';
  if (/ownership transfer|transfer.*(?:workflow|ownership)|decision rights|planned owner unavailability|without .*rescu/iu.test(move)) return 'DISTRIBUTED_DECISION_RIGHTS';
  return 'FROZEN_BASE_PLAN';
}

function sanitizeCustomerProjectionString(value) {
  return String(value)
    .replace(/\b[a-f0-9]{64}\b/giu, 'governed record')
    .replace(/\bchain[^\p{L}\p{N}]of[^\p{L}\p{N}]thought\b/giu, 'supporting rationale')
    .replace(/\bsource(?:[_ ]?paths?|[_ ]?refs?|[_ ]?future[_ ]?ids?)\b/giu, 'governed source')
    .replace(/\bevidence[_ ]?refs?\b/giu, 'supporting evidence')
    .replace(/\blineage[_ ]?refs?\b/giu, 'supporting history')
    .replace(/\bvertical[_ ]?authority[_ ]?refs?\b/giu, 'industry authority')
    .replace(/\binspector[_ ]?ids?\b/giu, 'evidence view')
    .replace(/\bprofile[_ ]?ids?\b/giu, 'customer record')
    .replace(/\bassessment[_ ]?ids?\b/giu, 'assessment record')
    .replace(/\brelative support\b/giu, 'trajectory evidence')
    .replace(/\bnot (?:a )?probability\b/giu, 'a conditional trajectory estimate')
    .replace(/\bhow we calculate these probabilities\b/giu, 'what supports these estimates')
    .replace(CUSTOMER_TECHNICAL_REFERENCE, 'governed context');
}

function sanitizeCustomerString(value) {
  const sanitized = sanitizeCustomerProjectionString(value)
    .replace(/\band\s+(?=[A-Z]{2,8}-\d+\b)/gu, '')
    .replace(/\b[A-Z]{2,8}-\d+\b\s*,?\s*/gu, '')
    .replace(/\s{2,}/gu, ' ')
    .replace(/^\s*(?:,|and)\s*/iu, '')
    .trim();
  return /[\p{L}\p{N}]/u.test(sanitized) ? sanitized : '';
}

function sanitizeCustomerProjectionInput(value) {
  if (typeof value === 'string') return sanitizeCustomerProjectionString(value);
  if (Array.isArray(value)) return value.map(sanitizeCustomerProjectionInput);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeCustomerProjectionInput(child)]));
  }
  return value;
}

function sanitizeCustomerValue(value) {
  if (typeof value === 'string') return sanitizeCustomerString(value);
  if (Array.isArray(value)) return value.map(sanitizeCustomerValue).filter((item) => item !== '');
  if (value && typeof value === 'object') {
    const sanitized = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitizeCustomerValue(child)]));
    if (Array.isArray(sanitized.items) && sanitized.items.length === 0) {
      sanitized.items = ['No accepted evidence is available for this section.'];
    }
    return sanitized;
  }
  return value;
}

function governedMetricSemantics(card) {
  const value = String(card.value || '').trim();
  const label = String(card.label || '').trim();
  const qualifier = String(card.qualifier || '').trim();
  const missing = /^(?:Not measured|Not numerically stated)$/iu.test(value);
  const withheld = /^Not modeled from current evidence$/iu.test(value);
  const goal = /goal|desired/iu.test(`${label} ${qualifier}`);
  if (withheld) return {
    epistemicClass: 'MISSING',
    what: `No ${label.toLowerCase()} is projected because the accepted evidence does not support a governed numeric requirement.`,
    source: 'No modeled value has been accepted for this field.',
    interpretation: 'MORE is withholding a number instead of converting incomplete evidence into false precision.',
    supports: 'This preserves the distinction between current business reality and a future goal-supporting model.',
    against: 'A value would be misleading until the relevant current state and goal are numerically established.',
    missing: `Current governed evidence required to model ${label.toLowerCase()}.`,
    mindChange: `Accepted current-state and goal evidence sufficient to calculate ${label.toLowerCase()} deterministically.`,
  };
  if (missing) return {
    epistemicClass: 'MISSING',
    what: `${label} is not established by the accepted business evidence.`,
    source: 'The saved assessment contains no accepted numeric value for this field.',
    interpretation: 'MORE preserves this as missing evidence; it is not treated as zero and is not estimated.',
    supports: 'This identifies a measurement gap that limits diagnostic precision.',
    against: 'No accepted current value is available to support a numerical conclusion.',
    missing: `A current, governed measure of ${label.toLowerCase()}.`,
    mindChange: `Accepted business evidence that directly establishes ${label.toLowerCase()}.`,
  };
  if (goal) return {
    epistemicClass: 'REPORTED',
    what: `The saved assessment states ${value} for ${label.toLowerCase()}.`,
    source: `Operator-reported desired state · ${qualifier}.`,
    interpretation: 'MORE treats this as a stated goal, not as current performance or a guaranteed outcome.',
    supports: 'This orients the plan while remaining separate from current-state evidence.',
    against: 'The goal alone does not prove current capacity, feasibility, or progress.',
    missing: 'Current operating measures needed to test the gap between today and the stated goal.',
    mindChange: 'Accepted evidence that the goal has changed or was recorded incorrectly.',
  };
  return {
    epistemicClass: 'REPORTED',
    what: `The saved assessment reports ${value} for ${label.toLowerCase()}.`,
    source: `Operator-reported accepted business evidence · ${qualifier}.`,
    interpretation: 'MORE uses this as a current-state fact while keeping it separate from causal interpretation.',
    supports: 'This grounds the current business snapshot and any evidence-bound comparison that explicitly uses it.',
    against: 'This value alone does not establish why the business is producing its current results.',
    missing: 'Direct operating records may strengthen corroboration without changing the reported value.',
    mindChange: 'Accepted evidence that corrects, supersedes, or time-bounds the reported value.',
  };
}

function governedMetricDrawer(card) {
  const semantic = governedMetricSemantics(card);
  return {
    epistemicClass: semantic.epistemicClass,
    confidence: card.qualifier,
    sections: [
      ['what-this-is', 'What This Is', semantic.what],
      ['source-evidence', 'Source / Evidence', semantic.source],
      ['interpretation', 'How MORE Interprets It', semantic.interpretation],
      ['supports', 'What It Supports', semantic.supports],
      ['against', 'What Works Against It', semantic.against],
      ['missing', "What's Missing", semantic.missing],
      ['confidence', 'Confidence', card.qualifier],
      ['mind-change', 'What Would Change It', semantic.mindChange],
    ].map(([id, title, item]) => ({ id, title, items: [item] })),
  };
}

function applyGovernedMetricProjection(customer, source) {
  const byId = new Map((source.quickFacts || []).map((item) => [item.id, item]));
  const ordered = {
    metrics: ['combined-soi-current', 'attributed-contacts-estimate', 'top-of-mind-current', 'monthly-closing-goal'],
    today: ['attributed-contacts-estimate', 'top-of-mind-current', 'current-live-contacts', 'current-active-pipeline'],
    goal: ['monthly-closing-goal', 'annual-closing-goal'],
    required: ['relationship-asset-target', 'live-contact-goal-pace', 'combined-pipeline-target'],
  };
  const display = (id) => {
    const card = byId.get(id);
    return card ? { title: card.label, value: card.value, qualifier: card.qualifier, tone: card.tone } : null;
  };
  const replaceSeries = (items, ids) => (items || []).map((item, index) => {
    const next = display(ids[index]);
    return next ? { ...item, ...next } : item;
  });
  customer.destinations.where.metrics = replaceSeries(customer.destinations.where.metrics, ordered.metrics);
  customer.destinations.where.pathway.today = replaceSeries(customer.destinations.where.pathway.today, ordered.today);
  customer.destinations.where.pathway.goal = replaceSeries(customer.destinations.where.pathway.goal, ordered.goal);
  customer.destinations.where.pathway.required = replaceSeries(customer.destinations.where.pathway.required, ordered.required);

  const objectSeries = [
    ['where-metric-', ordered.metrics],
    ['where-today-', ordered.today],
    ['where-goal-', ordered.goal],
    ['where-required-', ordered.required],
  ];
  objectSeries.forEach(([prefix, ids]) => ids.forEach((id, index) => {
    const object = customer.objects?.[`${prefix}${index + 1}`];
    const next = display(id);
    const card = byId.get(id);
    if (object && next && card) {
      const drawer = governedMetricDrawer(card);
      object.display_payload = next;
      object.epistemic_class = drawer.epistemicClass;
      object.confidence = drawer.confidence;
      object.drawer_payload = drawer.sections;
    }
  }));

  const combined = display('combined-soi-current');
  const layerZeroWhere = customer.layer0.cards.find((card) => card.id === 'where');
  if (combined && layerZeroWhere) {
    layerZeroWhere.value = combined.value;
    layerZeroWhere.qualifier = combined.title;
    layerZeroWhere.details = [
      display('top-of-mind-current'),
      display('monthly-closing-goal'),
      display('combined-pipeline-target'),
      display('attributed-contacts-estimate'),
    ].filter(Boolean).map((item) => ({ value: item.value, label: item.title }));
  }
  if (combined && customer.objects?.['layer0-where']) {
    customer.objects['layer0-where'].display_payload = { title: 'Where You Are', value: combined.value, qualifier: combined.title, tone: combined.tone };
  }

  const evidenceOrder = [
    ...ordered.metrics,
    'annual-closing-goal',
    'current-live-contacts',
    'current-active-pipeline',
    ...ordered.required,
  ];
  customer.destinations.evidence.ledger = (customer.destinations.evidence.ledger || []).map((row, index) => {
    const next = display(evidenceOrder[index]);
    const card = byId.get(evidenceOrder[index]);
    const semantic = card ? governedMetricSemantics(card) : null;
    return next && semantic ? {
      ...row,
      reality: next.title,
      value: next.value,
      basis: next.qualifier,
      status: semantic.epistemicClass,
      confidence: next.qualifier,
    } : row;
  });
  evidenceOrder.forEach((id, index) => {
    const object = customer.objects?.[`evidence-row-${index + 1}`];
    const next = display(id);
    const card = byId.get(id);
    if (object && next && card) {
      const drawer = governedMetricDrawer(card);
      object.display_payload = next;
      object.epistemic_class = drawer.epistemicClass;
      object.confidence = drawer.confidence;
      object.drawer_payload = drawer.sections;
    }
  });
  const classifiedEvidence = evidenceOrder.map((id) => byId.get(id)).filter(Boolean).map((card) => ({ card, semantic: governedMetricSemantics(card) }));
  const factualColumn = customer.destinations.evidence.truthColumns?.find((column) => column.label === 'Factual reality');
  const openQuestionsColumn = customer.destinations.evidence.truthColumns?.find((column) => column.label === 'Open questions');
  if (factualColumn) {
    factualColumn.items = classifiedEvidence
      .filter(({ semantic }) => semantic.epistemicClass === 'REPORTED')
      .map(({ card }) => `${card.label}: ${card.value}`)
      .slice(0, 8);
  }
  if (openQuestionsColumn) {
    openQuestionsColumn.items = classifiedEvidence
      .filter(({ semantic }) => semantic.epistemicClass === 'MISSING')
      .map(({ card }) => card.label)
      .slice(0, 8);
  }
  return customer;
}

function makeStrategy({ source, base, spec, index, wayTitle }) {
  const [mission, title, headline, fallbackAction, scorecard] = spec;
  const move = source.move;
  const plan = source.plan || {};
  const moveStep = move.firstSteps?.[index];
  const lineage = [source.why?.inspectorId, move.inspectorId, moveStep?.inspectorId].filter(Boolean);
  return {
    strategy_id: `real-profile-${mission.toLowerCase().replaceAll('_', '-')}`,
    mission,
    title,
    headline,
    description: headline,
    way_relationship: wayTitle,
    goal_relationship: plan.objective,
    constraint_relationship: source.why.title,
    mechanism_relationship: source.why.mechanisms?.[0]?.label || source.why.summary,
    vertical_authority_refs: [...(base.strategies[0]?.vertical_authority_refs || ['FROZEN_REAL_ESTATE_VERTICAL_AUTHORITY_V1'])],
    numerical_target: null,
    epistemic_class: 'GOVERNED_STRATEGIC_ACTION',
    owner_boundary: 'The business owner sets the standard and exception boundary; the assigned role owns execution inside that boundary.',
    first_action: moveStep?.text || plan.steps?.[index] || fallbackAction,
    cadence: plan.cadence || move.observation || 'Inspect after each repeated operating cycle.',
    observation_window: plan.observation || move.observation,
    scorecard: bounded(scorecard, 7, 'observable workflow completion'),
    proof: bounded(move.proof?.map((item) => item.label), 5, 'The workflow remains complete and reliable without hidden owner rescue.'),
    failure_or_stop: bounded(plan.stopConditions || move.failure, 4, 'Stop when ownership, quality, continuity, or customer safety boundaries are breached.'),
    execution_feasibility: bounded(plan.wholePerson, 4, 'Use the accepted Whole-Person authority only to shape execution feasibility.'),
    confidence: 'EVIDENCE_BOUND · the strategy operationalizes the accepted One Move without changing its business semantics',
    evidence_lineage_refs: lineage.length ? lineage.slice(0, 8) : [move.inspectorId],
  };
}

function ownershipStrategies(source, base) {
  const wayTitle = 'Distribute Decision Rights + Manager Ownership';
  const specs = [
    ['DEFINE_TRANSFER_BOUNDARY', 'Define the workflow boundary', 'Name one recurrent workflow, its start, its finish, and the result it must protect.', 'Choose the smallest recurrent workflow that is important enough to observe.', ['workflow start', 'workflow finish', 'accepted outcome']],
    ['ASSIGN_ACCOUNTABLE_OWNER', 'Assign one accountable owner', 'Give one role end-to-end ownership instead of distributing accountability across helpers.', 'Name the role that will own the complete workflow.', ['accountable owner', 'ownership acceptance', 'handoff completeness']],
    ['DEFINE_DECISION_RIGHTS', 'Write decision rights and exception rules', 'Make in-bound decisions, quality standards, and true exceptions explicit before the trial begins.', 'Write what the owner may decide and what must escalate.', ['in-bound decisions', 'exceptions', 'decision latency']],
    ['OBSERVE_INDEPENDENT_EXECUTION', 'Run without hidden rescue', 'Let the assigned owner execute while interventions, reversals, rework, and rescues remain visible.', 'Start the bounded trial and record every exception or intervention.', ['completion', 'quality', 'rework', 'owner interventions']],
    ['INSPECT_TRANSFER_PROOF', 'Inspect proof and decide the next state', 'Compare completion, decision ownership, quality, and released capacity before keeping, changing, or stopping the transfer.', 'Schedule the evidence review before the trial begins.', ['independent completion', 'decision fidelity', 'quality held', 'capacity released']],
  ];
  return specs.map((spec, index) => makeStrategy({ source, base, spec, index, wayTitle }));
}

function conversionStrategies(source, base) {
  const wayTitle = 'Make Conversion Visible + Repeatable';
  const specs = [
    ['DEFINE_SOURCE_STAGE_PATH', 'Define one source-to-stage path', 'Use one shared vocabulary from source through outcome.', 'Define the stages and required fields before the next review.', ['field completeness', 'opportunities by source', 'stage movement']],
    ['SET_RESPONSE_STANDARD', 'Set response and next-action standards', 'Make timely follow-up inspectable for every new opportunity.', 'Agree the response window and required dated next action.', ['response time', 'next-action completeness', 'aged opportunities']],
    ['MAKE_PIPELINE_INSPECTABLE', 'Keep the active pipeline complete', 'Preserve source, stage, owner, and dated next action for every live opportunity.', 'Identify active opportunities and remove ambiguous stage labels.', ['active opportunities', 'stage aging', 'owner completeness']],
    ['INSPECT_CONVERSION_WEEKLY', 'Inspect conversion every week', 'Review exceptions and leakage by source before adding more demand.', 'Create the first source-to-stage exception list.', ['appointment rate', 'agreement rate', 'pipeline creation', 'loss reason']],
    ['ALLOCATE_BY_EVIDENCE', 'Make source decisions from observed conversion', 'Keep, change, or stop activity only after the bounded observation window produces usable evidence.', 'Write the decision rule before the observation begins.', ['conversion by source', 'effort by source', 'quality of outcome']],
  ];
  return specs.map((spec, index) => makeStrategy({ source, base, spec, index, wayTitle }));
}

function realProfilePlan({ source, base, mode }) {
  const goalStatement = source.plan?.objective || base.goal.title;
  const ownership = mode === 'DISTRIBUTED_DECISION_RIGHTS';
  const conversion = mode === 'VISIBLE_CONVERSION_SYSTEM';
  const plan = {
    ...base,
    version: '1.0.0',
    goal: {
      ...base.goal,
      title: goalStatement,
      monthly_display: null,
      annual_display: null,
      statement_display: goalStatement,
    },
    ways: base.ways.map((way, index) => index ? way : {
      ...way,
      title: ownership ? 'Distribute Decision Rights + Manager Ownership' : conversion ? 'Make Conversion Visible + Repeatable' : way.title,
      destination_state: ownership ? 'A recurrent operating outcome remains owned and reliable without returning to the business owner.' : conversion ? 'A source-to-stage system makes follow-up, leakage, and conversion inspectable.' : way.destination_state,
      why_priority: ownership || conversion ? source.move.whyNow : way.why_priority,
      business_stage_fit: ownership ? 'DISTRIBUTED_DECISION_RIGHTS' : conversion ? 'VISIBLE_CONVERSION_SYSTEM' : way.business_stage_fit,
    }),
    strategies: ownership ? ownershipStrategies(source, base) : conversion ? conversionStrategies(source, base) : base.strategies,
  };
  validateGeneralizedPlan135V1(plan);
  return deepFreeze(plan);
}

export function createRealProfileProjectionV2({ sourceViewModel, bindings }) {
  const customerProjectionInput = sanitizeCustomerProjectionInput(structuredClone(sourceViewModel));
  const frozenBase = createBaProgressiveDisclosureV1({ sourceViewModel: customerProjectionInput, bindings });
  const mode = modeFor(customerProjectionInput);
  const plan135 = realProfilePlan({ source: customerProjectionInput, base: frozenBase.plan135, mode });
  const projected = buildProgressiveBusinessTwin({ sourceViewModel: customerProjectionInput, probability: frozenBase.probability, plan135, bindings });
  const customer = structuredClone(projected.customerViewModel);
  applyGovernedMetricProjection(customer, customerProjectionInput);
  customer.destinations.plan.headline = plan135.goal.title;
  customer.destinations.plan.goal = {
    ...customer.destinations.plan.goal,
    title: plan135.goal.title,
    statement: plan135.goal.statement_display,
    monthly: null,
    monthlyLabel: null,
    annual: null,
    annualLabel: null,
  };
  const customerViewModel = deepFreeze(sanitizeCustomerValue(customer));
  return deepFreeze({
    contract_id: 'ba-real-profile-projection-adapter-v6',
    version: '6.0.0',
    probability: frozenBase.probability,
    plan135,
    customerViewModel,
    internalTrace: projected.internalTrace,
    validation: {
      ...projected.validation,
      real_profile_adapter: 'PASS',
      qualitative_goal_preserved: true,
      plan_mode: mode,
      frozen_projection_sources_modified: false,
    },
  });
}
