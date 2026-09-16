import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLoanOriginatorProjectionV1,
  projectLoanOriginatorBox1OntoCustomerViewModel,
} from '../api/engine/newBaProductionReadinessV1/loanOriginatorProjectionAdapter.js';
import { sha256Stable } from '../api/engine/newBaProductionReadinessV1/stable.js';
import { validateProgressiveBusinessTwin } from '../src/lib/baProgressiveDisclosureV1/projection.js';
import { normalizeLoanOriginatorTypedEvidence } from '../src/lib/baVerticalCassettesV1/loanOriginatorEvidence.js';

const PROFILE_ID = 'MM-20990101-LOFIXTURE';
const ASSESSMENT_ID = 'ba-lo-projection-fixture-v1';
const EVIDENCE_SHA = 'fixture-business-evidence-sha';
const WBM_SHA = 'a'.repeat(64);
const CAPTURED_AT = '2099-01-01T00:00:00.000Z';
const FUTURE_ROLES = Object.freeze(['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future']);
const SYSTEMS_CAPACITY_MISSION_IDS = Object.freeze([
  'LO_CORE_08_RELATIONSHIP_SYSTEMS',
  'LO_CORE_09_TEAM_CAPACITY',
  'LO_CORE_10_PLATFORM_CAPABILITY',
  'LO_CORE_12_ACCOUNTABILITY_EXECUTION',
]);
const SYSTEMS_CAPACITY_DOMAIN_MISSIONS = Object.freeze({
  operations: Object.freeze(['LO_CORE_08_RELATIONSHIP_SYSTEMS', 'LO_CORE_10_PLATFORM_CAPABILITY']),
  capacity: Object.freeze(['LO_CORE_09_TEAM_CAPACITY', 'LO_CORE_12_ACCOUNTABILITY_EXECUTION']),
});

const QUICK_FACT_SPECS = Object.freeze([
  ['combined-soi-current', 'Funded loans', ['funded_units_12m']],
  ['attributed-contacts-estimate', 'Funded principal volume', ['funded_volume_12m']],
  ['top-of-mind-current', 'Opportunity sources', ['osn_sources']],
  ['monthly-closing-goal', 'Customer business goal', ['goal_metric', 'goal_target_value', 'goal_unit_currency', 'goal_subject_scope']],
  ['annual-closing-goal', 'Goal priority', ['goal_priority']],
  ['current-live-contacts', 'Customer relationship network size', ['crn_meaningful_size']],
  ['current-active-pipeline', 'Comparable opportunity pipeline', [
    'funnel_purpose', 'funnel_window', 'funnel_cohort_basis', 'opportunity_count_definition',
    'application_count_definition', 'purchase_active_transaction', 'refinance_active_loan', 'close_fund_count_definition',
  ]],
  ['relationship-asset-target', 'Required opportunity flow', [
    'goal_metric', 'goal_target_value', 'goal_unit_currency', 'funnel_cohort_basis',
    'conversion_displayed_derived_rate', 'conversion_affected_scope',
  ]],
  ['live-contact-goal-pace', 'Required conversion', [
    'goal_metric', 'goal_target_value', 'opportunity_count_definition',
    'close_fund_count_definition', 'conversion_displayed_derived_rate',
  ]],
  ['combined-pipeline-target', 'Required sustainable capacity', [
    'goal_target_value', 'work_load', 'sustainable_capacity', 'economic_sustainable_capacity', 'work_ownership_rows',
  ]],
]);

function genericInspector(status = 'SUPPORTED_HYPOTHESIS') {
  return {
    status,
    level1: {
      meaning: 'The saved business evidence supports a bounded current-state interpretation.',
      why: 'The interpretation remains conditional on the accepted business evidence.',
      goal: 'The customer-stated business outcome remains separate from current performance.',
      helps: ['Accepted evidence supports this bounded interpretation.'],
      hurts: ['Missing corroboration limits confidence.'],
    },
    level2: [
      { title: 'What we know', items: ['The customer supplied governed business evidence.'] },
      { title: 'What we infer', items: ['The operating implication is evidence-bound.'] },
      { title: 'What is still missing', items: ['Independent corroboration remains unavailable.'] },
      { title: 'What would change our mind', items: ['Contrary observed business results.'] },
    ],
  };
}

function rawTypedEvidence({ fundedVolume = true, contradiction = false, fundedEvidenceClass = 'OBSERVED' } = {}) {
  return {
    funded_units_12m: {
      value: 24,
      evidence_class: fundedEvidenceClass,
      contradiction_links: contradiction ? ['accepted-unresolved-contradiction'] : [],
    },
    ...(fundedVolume ? { funded_volume_12m: { value: 8400000, evidence_class: 'OBSERVED' } } : {}),
    osn_sources: { value: ['Referral partners', 'Past customers'], evidence_class: 'OBSERVED' },
    crn_meaningful_size: { value: 180, evidence_class: 'OBSERVED' },
    goal_metric: { value: 'FUNDED_UNITS', evidence_class: 'OBSERVED' },
    goal_target_value: { value: 36, evidence_class: 'OBSERVED' },
    goal_unit_currency: { value: 'FUNDED_LOANS', evidence_class: 'OBSERVED' },
    goal_subject_scope: { value: 'INDIVIDUAL', evidence_class: 'OBSERVED' },
    goal_priority: { value: 'PRIMARY', evidence_class: 'OBSERVED' },
    relationship_systems: { value: ['Weekly partner follow-up'], evidence_class: 'OBSERVED' },
    system_owner: { value: 'Loan originator', evidence_class: 'OBSERVED' },
    team_support_state: { value: 'SUPPORTED', evidence_class: 'OBSERVED' },
    work_load: { value: { value: 42, definition: 'customer-described weekly workload' }, evidence_class: 'OBSERVED' },
    platform_limits: { value: ['Manual handoff visibility'], evidence_class: 'OBSERVED' },
    accountability_priorities: { value: ['Weekly source follow-through'], evidence_class: 'OBSERVED' },
    operator_hypothesis_description: { value: 'Inconsistent source follow-through may constrain opportunity flow.', evidence_class: 'OBSERVED' },
    operator_supporting_observations: { value: ['observation:source-follow-through-varies'], evidence_class: 'OBSERVED' },
  };
}

function cardValue(id, fields) {
  const values = {
    'combined-soi-current': fields.funded_units_12m.question_state === 'ANSWERED' ? '24' : 'Not measured',
    'attributed-contacts-estimate': fields.funded_volume_12m.question_state === 'ANSWERED' ? '8,400,000' : 'Not measured',
    'top-of-mind-current': fields.osn_sources.question_state === 'ANSWERED' ? 'Referral partners, Past customers' : 'Not measured',
    'monthly-closing-goal': '36 FUNDED_LOANS',
    'annual-closing-goal': 'PRIMARY',
    'current-live-contacts': '180',
    'current-active-pipeline': 'Not measured',
    'relationship-asset-target': 'Not modeled from current evidence',
    'live-contact-goal-pace': 'Not modeled from current evidence',
    'combined-pipeline-target': 'Not modeled from current evidence',
  };
  return values[id];
}

function resultState(id, fields, fieldIds) {
  if (['current-active-pipeline', 'relationship-asset-target', 'live-contact-goal-pace', 'combined-pipeline-target'].includes(id)) {
    return 'NOT_ESTABLISHED';
  }
  if (id === 'monthly-closing-goal') return 'CUSTOMER_REPORTED_GOAL';
  return fieldIds.every((fieldId) => fields[fieldId].question_state === 'ANSWERED') ? 'CUSTOMER_REPORTED' : 'MISSING';
}

function domainInterpretationFixtures(typedEvidence, inspectors, {
  operationsInterpretation = true,
  capacityInterpretation = true,
  operationsMeaning = 'OPERATIONS_INTERPRETATION_CANARY: follow-through is partly systematic.',
  capacityMeaning = 'CAPACITY_INTERPRETATION_CANARY: sustainable load remains incompletely established.',
} = {}) {
  return Object.fromEntries(Object.entries(SYSTEMS_CAPACITY_DOMAIN_MISSIONS).map(([domain, missionIds]) => {
    const accepted = domain === 'operations' ? operationsInterpretation : capacityInterpretation;
    const meaning = domain === 'operations' ? operationsMeaning : capacityMeaning;
    const inspectorId = accepted ? `domain-${domain}-claim-1` : `lo-${domain}-interpretation-unestablished`;
    const inspectorContent = {
      ...genericInspector(accepted ? 'INFERRED' : 'MISSING'),
      level1: {
        ...genericInspector().level1,
        meaning: accepted ? meaning : `The accepted business model does not establish an ${domain} interpretation.`,
      },
    };
    const claim = accepted ? {
      claim_id: `${domain}-claim-1`,
      meaning,
      epistemic_class: 'INFERRED',
      evidence_refs: [`${domain}-evidence-ref`],
      falsifier: `Contrary governed ${domain} evidence.`,
    } : null;
    const fields = Object.values(typedEvidence.fields)
      .filter((field) => missionIds.includes(field.mission_id))
      .sort((left, right) => left.field_id.localeCompare(right.field_id))
      .map((field) => ({
        field_id: field.field_id,
        field_sha256: sha256Stable(field),
        question_state: field.question_state,
        source_ref: `business_assessment.inputs.typed_evidence.fields.${field.field_id}`,
        value: field.value,
        definition_id: field.definition_id,
        period_or_not_temporal: field.period_or_not_temporal,
        subject_scope: field.subject_scope,
        provenance: field.provenance,
      }));
    const binding = {
      contract_id: 'lo-domain-interpretation-binding-v1',
      domain_id: domain,
      profile_id: PROFILE_ID,
      assessment_id: ASSESSMENT_ID,
      business_evidence_sha256: EVIDENCE_SHA,
      whole_business_model_sha256: WBM_SHA,
      state: accepted ? 'ACCEPTED_CLAIM' : 'NOT_ESTABLISHED',
      claim,
      claim_sha256: claim ? sha256Stable(claim) : null,
      inspector_id: inspectorId,
      inspector_content_sha256: sha256Stable(inspectorContent),
      fields,
    };
    inspectors[inspectorId] = { ...inspectorContent, source_binding: binding };
    return [domain, binding];
  }));
}

function sourceFixture(options = {}) {
  const typedEvidence = normalizeLoanOriginatorTypedEvidence({
    typedEvidence: rawTypedEvidence(options),
    assessmentId: ASSESSMENT_ID,
    capturedAt: CAPTURED_AT,
  });
  const inspectors = {};
  const quickFacts = QUICK_FACT_SPECS.map(([id, label, fieldIds]) => {
    const inspectorId = `lo-fact-${id}`;
    const fields = fieldIds.map((fieldId) => typedEvidence.fields[fieldId]);
    inspectors[inspectorId] = {
      ...genericInspector(fields.every((field) => field.question_state === 'ANSWERED') ? 'REPORTED' : 'MISSING'),
      source_binding: {
        contract_id: 'lo-quick-fact-evidence-binding-v1',
        profile_id: PROFILE_ID,
        assessment_id: ASSESSMENT_ID,
        business_evidence_sha256: EVIDENCE_SHA,
        result_state: resultState(id, typedEvidence.fields, fieldIds),
        fields: fieldIds.map((fieldId) => {
          const field = typedEvidence.fields[fieldId];
          return {
            field_id: fieldId,
            source_ref: `business_assessment.inputs.typed_evidence.fields.${fieldId}`,
            question_state: field.question_state,
            value: field.value,
            definition_id: field.definition_id,
            period_or_not_temporal: field.period_or_not_temporal,
            subject_scope: field.subject_scope,
            provenance: field.provenance,
            field_sha256: sha256Stable(field),
          };
        }),
      },
    };
    const missing = resultState(id, typedEvidence.fields, fieldIds) === 'MISSING';
    const withheld = resultState(id, typedEvidence.fields, fieldIds) === 'NOT_ESTABLISHED';
    return {
      id,
      label,
      value: cardValue(id, typedEvidence.fields),
      qualifier: withheld ? 'No governed result has been accepted' : missing ? 'Missing governed evidence' : 'Customer reported · governed observation window',
      tone: withheld || missing ? 'amber' : 'green',
      inspectorId,
    };
  });
  const evidenceCategories = ['known', 'inferred', 'missing', 'uncertain'].map((id) => ({
    id,
    label: id,
    value: id === 'missing' ? 12 : 3,
    summary: `${id} evidence remains classified`,
    inspectorId: `category-${id}`,
  }));
  const futures = FUTURE_ROLES.map((role) => ({
    id: `future-${role}`,
    role,
    label: role.replaceAll('_', ' '),
    weight: 20,
    title: `${role.replaceAll('_', ' ')} business path`,
    summary: 'The business state remains conditional.',
    condition: 'If the stated operating condition holds.',
    inspectorId: `future-${role}`,
  }));
  const supportingIds = [
    'why', 'mechanism', 'move', 'first-step', 'proof',
    ...[0, 1, 2, 3].map((index) => `logic-${index}`),
    ...evidenceCategories.map((category) => category.inspectorId),
    ...futures.map((future) => future.inspectorId),
  ];
  supportingIds.forEach((id) => { inspectors[id] = genericInspector(); });
  const domainInterpretations = domainInterpretationFixtures(typedEvidence, inspectors, options);

  return {
    identity: { firstName: 'Casey', business: 'Casey’s Loan Origination Business', vertical: 'Residential Loan Originator' },
    verticalBinding: { vertical_id: 'loan_originator' },
    quickFacts,
    inspectors,
    businessMap: {
      center: { title: 'Casey’s Loan Origination Business', inspectorId: 'why' },
      goalBacksolve: quickFacts.filter((card) => ['monthly-closing-goal', 'annual-closing-goal', 'relationship-asset-target', 'live-contact-goal-pace', 'combined-pipeline-target'].includes(card.id)),
      helping: [{ label: 'Repeat customers and partners create useful opportunity access.' }],
      engines: [
        { id: 'relationship', title: 'Relationship', inspectorId: 'why', confidence: 'Evidence-bound', metrics: [] },
        { id: 'demand', title: 'Demand', inspectorId: 'mechanism', confidence: 'Evidence-bound', metrics: [] },
      ],
    },
    why: {
      title: 'Source follow-through is not yet consistently inspectable',
      summary: 'Inconsistent source follow-through may constrain opportunity flow.',
      whyStronger: 'Accepted evidence supports a bounded working explanation.',
      inspectorId: 'why',
      mechanisms: [{ label: 'Preparation delays the next source conversation.', inspectorId: 'mechanism' }],
      alternatives: ['Capacity may be the stronger constraint.'],
      mindChange: 'Observed source-to-stage results contradict the working explanation.',
    },
    futures: {
      items: futures,
      semantics: 'Conditional trajectory support, not empirical forecast probability.',
      moveRelationship: 'The proposal changes a trajectory only if its proof conditions hold.',
    },
    move: {
      title: 'Run one bounded source follow-through practice',
      intervention: 'Try one customer-chosen source conversation and observe what happens.',
      whyNow: 'A bounded practice can create observable evidence.',
      inspectorId: 'move',
      observation: 'Review after the agreed observation window.',
      logic: ['Constraint', 'Mechanism', 'Intervention', 'Proof'].map((label, index) => ({ label, value: `${label} from accepted evidence`, inspectorId: `logic-${index}` })),
      firstSteps: [{ text: 'Choose one source conversation you are willing to practice.', inspectorId: 'first-step' }],
      proof: [{ label: 'The conversation happens with the intended quality.', inspectorId: 'proof' }],
      failure: ['Pause if this conflicts with existing customer service commitments.'],
    },
    plan: { objective: 'Move from 24 to 36 funded loans over the next twelve months with a sustainable week.', wholePerson: [] },
    numerical: { comparisons: [], measurementScorecard: [], systemStandards: [], deeperScenarios: [] },
    evidence: {
      categories: evidenceCategories,
      counterevidence: ['A different explanation may fit.'],
      mindChanges: ['Observed results differ.'],
    },
    livingMap: { headline: 'Continue learning', copy: 'Review new evidence.', action: 'Continue' },
    currentStates: {
      operationsState: 'OPERATIONS_STATE_CANARY: follow-through is partly systematic.',
      capacityState: 'CAPACITY_STATE_CANARY: sustainable load remains incompletely established.',
    },
    loanOriginator: { typedEvidence, domainInterpretations },
    internal: {
      profile_id: PROFILE_ID,
      assessment_id: ASSESSMENT_ID,
      business_evidence_sha256: EVIDENCE_SHA,
      whole_business_model_sha256: WBM_SHA,
    },
  };
}

function customerFixture() {
  return {
    identity: { firstName: 'Casey' },
    nav: [],
    layer0: { cards: [] },
    destinations: { where: { realities: [{ id: 'old' }] } },
    objects: {
      existing: {
        object_id: 'existing', destination: 'where', surface: 'fixture', display_payload: { title: 'Existing' },
        drawer_payload: [], return_state_id: 'where:layer1:existing',
      },
    },
  };
}

function assertProjectionSourcePrivacyRejected(mutateSource, expectedPath) {
  const source = structuredClone(sourceFixture());
  mutateSource(source);
  let projection;
  assert.throws(() => {
    projection = createLoanOriginatorProjectionV1({
      sourceViewModel: source,
      bindings: {
        subjectKey: 'lo-projection-fixture',
        verticalId: 'loan_originator',
        verticalAuthorityRefs: ['loan-originator-intelligence-module-business-machine-v1'],
      },
    });
  }, (error) => {
    assert.equal(error.code, 'loan_originator_privacy_boundary_violation');
    assert.equal(error.privacy_receipt.status, 'REJECTED');
    assert.ok(error.findings.some(({ path }) => path.includes(expectedPath)), error.message);
    return true;
  });
  assert.equal(projection, undefined);
}

test('LO Box 1 projection is immutable and missing evidence cannot render as reported green', () => {
  const source = sourceFixture({ fundedVolume: false });
  const customer = customerFixture();
  const sourceBefore = structuredClone(source);
  const customerBefore = structuredClone(customer);
  const projected = projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customer, sourceViewModel: source });
  const repeated = projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customer, sourceViewModel: source });

  assert.deepEqual(source, sourceBefore);
  assert.deepEqual(customer, customerBefore);
  assert.deepEqual(projected, repeated);
  assert.ok(Object.isFrozen(projected));
  assert.ok(Object.isFrozen(projected.destinations.where.realities));
  assert.equal(projected.destinations.where.realities.length, 5);

  const byId = Object.fromEntries(projected.destinations.where.realities.map((surface) => [surface.id, surface]));
  assert.deepEqual([byId['business-now'].epistemicClass, byId['business-now'].tone], ['PARTIALLY_REPORTED', 'amber']);
  assert.deepEqual([byId['business-sources'].epistemicClass, byId['business-sources'].tone], ['REPORTED', 'green']);
  assert.deepEqual([byId['business-pipeline'].epistemicClass, byId['business-pipeline'].tone], ['MISSING', 'amber']);
  assert.deepEqual([byId['systems-capacity'].epistemicClass, byId['systems-capacity'].tone], ['INFERRED_WITH_MISSING_EVIDENCE', 'amber']);
  assert.deepEqual([byId['business-constraint'].epistemicClass, byId['business-constraint'].tone], ['INFERRED_WITH_MISSING_EVIDENCE', 'amber']);
  projected.destinations.where.realities.forEach((surface) => {
    const object = projected.objects[surface.objectId];
    assert.equal(object.epistemic_class, surface.epistemicClass);
    assert.equal(object.display_payload.tone, surface.tone);
    assert.equal(object.return_state_id, `where:layer1:${surface.objectId}`);
    assert.equal(object.clickable, true);
  });
});

test('LO systems and capacity keeps all four canonical missions plus exact full-WBM interpretation lineage', () => {
  const source = sourceFixture();
  const result = createLoanOriginatorProjectionV1({
    sourceViewModel: source,
    bindings: {
      subjectKey: 'lo-projection-fixture',
      verticalId: 'loan_originator',
      verticalAuthorityRefs: ['loan-originator-intelligence-module-business-machine-v1'],
    },
  });
  const internal = result.internalTrace.objects['where-reality-4'];
  assert.equal(internal.source_authority, 'domain-operations-claim-1');
  assert.deepEqual(internal.lineage_refs, [
    'domain-operations-claim-1',
    'domain-capacity-claim-1',
  ]);
  assert.equal(internal.evidence_field_ids.length, 43);
  assert.ok(internal.evidence_field_ids.includes('relationship_systems'));
  assert.ok(internal.evidence_field_ids.includes('work_load'));
  assert.ok(internal.evidence_field_ids.includes('platform_limits'));
  assert.ok(internal.evidence_field_ids.includes('accountability_priorities'));
  assert.deepEqual(internal.interpretation_bindings, Object.values(source.loanOriginator.domainInterpretations));
  const customer = result.customerViewModel.destinations.where.realities.find(({ id }) => id === 'systems-capacity');
  assert.match(customer.text, /OPERATIONS_INTERPRETATION_CANARY/u);
  assert.match(customer.text, /CAPACITY_INTERPRETATION_CANARY/u);
  assert.doesNotMatch(JSON.stringify(result.customerViewModel.objects[customer.objectId]),
    /claim_sha256|field_sha256|inspector_id|interpretation_bindings/u);
});

test('LO systems and capacity renders only each accepted full-WBM domain interpretation', () => {
  for (const [domain, presentState, absentState] of [
    ['operations', 'OPERATIONS_INTERPRETATION_CANARY', 'CAPACITY_INTERPRETATION_CANARY'],
    ['capacity', 'CAPACITY_INTERPRETATION_CANARY', 'OPERATIONS_INTERPRETATION_CANARY'],
  ]) {
    const source = sourceFixture({
      operationsInterpretation: domain === 'operations',
      capacityInterpretation: domain === 'capacity',
    });
    const projected = projectLoanOriginatorBox1OntoCustomerViewModel({
      customerViewModel: customerFixture(),
      sourceViewModel: source,
    });
    const surface = projected.destinations.where.realities.find(({ id }) => id === 'systems-capacity');
    assert.match(surface.text, new RegExp(presentState, 'u'), domain);
    assert.doesNotMatch(surface.text, new RegExp(absentState, 'u'), domain);
    assert.match(surface.text, new RegExp(`${domain === 'operations' ? 'Capacity' : 'Operations'} interpretation is not established`, 'u'));
  }
});

test('LO systems and capacity preserves reported facts and explicit missingness when neither interpretation exists', () => {
  const source = sourceFixture({ operationsInterpretation: false, capacityInterpretation: false });
  const result = createLoanOriginatorProjectionV1({
    sourceViewModel: source,
    bindings: {
      subjectKey: 'lo-projection-fixture',
      verticalId: 'loan_originator',
      verticalAuthorityRefs: ['loan-originator-intelligence-module-business-machine-v1'],
    },
  });
  const customer = result.customerViewModel.destinations.where.realities.find(({ id }) => id === 'systems-capacity');
  const internal = result.internalTrace.objects[customer.objectId];
  assert.equal(customer.epistemicClass, 'PARTIALLY_REPORTED');
  assert.equal(customer.tone, 'amber');
  assert.match(customer.text, /Operations interpretation is not established/u);
  assert.match(customer.text, /Capacity interpretation is not established/u);
  assert.equal(internal.source_authority, 'lo-operations-interpretation-unestablished');
  assert.deepEqual(internal.lineage_refs, [
    'lo-operations-interpretation-unestablished',
    'lo-capacity-interpretation-unestablished',
  ]);
  const facts = result.customerViewModel.objects[customer.objectId].drawer_payload
    .find(({ id }) => id === 'reported-facts-and-missingness').items;
  assert.ok(facts.some((item) => item.startsWith('relationship systems:') && item.includes('customer reported')));
  assert.ok(facts.some((item) => item.startsWith('accountability priorities:') && item.includes('customer reported')));
});

test('LO systems and capacity fails closed when its domain interpretation binding is tampered', () => {
  const source = structuredClone(sourceFixture());
  source.loanOriginator.domainInterpretations.operations.fields[0].value = 'tampered';
  assert.throws(
    () => projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customerFixture(), sourceViewModel: source }),
    /loan_originator_domain_interpretation_custody_invalid:operations/u,
  );
});

test('LO systems and capacity validates every retained field binding property', () => {
  for (const mutate of [
    (field) => { field.question_state = 'UNANSWERED'; },
    (field) => { field.definition_id = 'tampered-definition'; },
    (field) => { field.period_or_not_temporal = 'LIFETIME'; },
    (field) => { field.subject_scope = 'borrower'; },
    (field) => { field.provenance = { source: 'tampered' }; },
    (field) => { field.source_ref = 'tampered.source'; },
    (field) => { field.field_sha256 = 'f'.repeat(64); },
  ]) {
    const source = structuredClone(sourceFixture());
    const boundField = source.loanOriginator.domainInterpretations.operations.fields
      .find(({ field_id: fieldId }) => fieldId === 'relationship_systems');
    assert.ok(boundField);
    mutate(boundField);
    assert.throws(
      () => projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customerFixture(), sourceViewModel: source }),
      /loan_originator_domain_interpretation_custody_invalid:operations/u,
    );
  }
});

test('LO systems and capacity rejects a bare person name inside an otherwise valid interpretation binding', () => {
  const source = sourceFixture({ operationsMeaning: 'Jane Doe has available capacity.' });
  for (const project of [
    () => projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customerFixture(), sourceViewModel: source }),
    () => createLoanOriginatorProjectionV1({
      sourceViewModel: source,
      bindings: {
        subjectKey: 'lo-projection-fixture',
        verticalId: 'loan_originator',
        verticalAuthorityRefs: ['loan-originator-intelligence-module-business-machine-v1'],
      },
    }),
  ]) {
    assert.throws(project, (error) => {
      assert.equal(error.code, 'loan_originator_privacy_boundary_violation');
      assert.ok(error.findings.some(({ code }) => code === 'POSSIBLE_PERSON_NAME'));
      assert.doesNotMatch(JSON.stringify(error.findings), /Jane Doe/u);
      return true;
    });
  }
});

test('LO systems and capacity rejects missing, borrowed, reordered, duplicated, and corrupted domain custody', () => {
  for (const mutate of [
    (source) => { delete source.loanOriginator.domainInterpretations; },
    (source) => { delete source.loanOriginator.domainInterpretations.operations; },
    (source) => { source.loanOriginator.domainInterpretations.operations = source.loanOriginator.domainInterpretations.capacity; },
    (source) => { source.loanOriginator.domainInterpretations.operations.inspector_id = 'why'; },
    (source) => { source.loanOriginator.domainInterpretations.operations.claim.meaning = 'Invented operating conclusion.'; },
    (source) => { source.internal.whole_business_model_sha256 = 'f'.repeat(64); },
    (source) => { delete source.inspectors[source.loanOriginator.domainInterpretations.capacity.inspector_id].source_binding; },
    (source) => { source.inspectors[source.loanOriginator.domainInterpretations.operations.inspector_id].level1.meaning = 'Substituted interpretation.'; },
    (source) => { source.loanOriginator.domainInterpretations.operations.fields.reverse(); },
    (source) => { source.loanOriginator.domainInterpretations.operations.fields.push(
      structuredClone(source.loanOriginator.domainInterpretations.operations.fields[0]),
    ); },
  ]) {
    const source = structuredClone(sourceFixture());
    mutate(source);
    assert.throws(
      () => projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customerFixture(), sourceViewModel: source }),
      /loan_originator_domain_interpretation/u,
    );
  }
});

test('shared Business Map engines cannot replace or spoof full-WBM domain interpretation custody', () => {
  const source = structuredClone(sourceFixture());
  source.businessMap.engines = [
    { id: 'operations', title: 'Capacity', summary: 'SPOOFED_ENGINE_INTERPRETATION', inspectorId: 'why' },
  ];
  const projected = projectLoanOriginatorBox1OntoCustomerViewModel({
    customerViewModel: customerFixture(),
    sourceViewModel: source,
  });
  const surface = projected.destinations.where.realities.find(({ id }) => id === 'systems-capacity');
  assert.match(surface.text, /OPERATIONS_INTERPRETATION_CANARY/u);
  assert.match(surface.text, /CAPACITY_INTERPRETATION_CANARY/u);
  assert.doesNotMatch(surface.text, /SPOOFED_ENGINE_INTERPRETATION/u);
});

test('LO Box 1 derives contradiction state and tone from validated field evidence', () => {
  const source = sourceFixture({ contradiction: true });
  const projected = projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customerFixture(), sourceViewModel: source });
  const surface = projected.destinations.where.realities.find(({ id }) => id === 'business-now');
  assert.equal(surface.epistemicClass, 'CONTRADICTED');
  assert.equal(surface.tone, 'coral');
  assert.equal(projected.objects[surface.objectId].epistemic_class, 'CONTRADICTED');
});

test('customer-supplied derived provenance remains reported rather than becoming a MORE calculation', () => {
  const source = sourceFixture({ fundedEvidenceClass: 'DERIVED' });
  const projected = projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customerFixture(), sourceViewModel: source });
  const surface = projected.destinations.where.realities.find(({ id }) => id === 'business-now');
  assert.equal(surface.epistemicClass, 'REPORTED');
  assert.equal(surface.tone, 'green');
});

test('LO Box 1 fails closed when quick-fact evidence custody does not match the validated field', () => {
  const source = structuredClone(sourceFixture());
  source.inspectors['lo-fact-combined-soi-current'].source_binding.fields[0].field_sha256 = 'tampered';
  assert.throws(
    () => projectLoanOriginatorBox1OntoCustomerViewModel({ customerViewModel: customerFixture(), sourceViewModel: source }),
    /loan_originator_surface_field_custody_mismatch:funded_units_12m/,
  );
});

test('final LO projection revalidates with exact customer, internal object, and statement-trace parity', () => {
  const source = sourceFixture();
  const sourceBefore = structuredClone(source);
  const result = createLoanOriginatorProjectionV1({
    sourceViewModel: source,
    bindings: {
      subjectKey: 'lo-projection-fixture',
      verticalId: 'loan_originator',
      verticalAuthorityRefs: ['loan-originator-intelligence-module-business-machine-v1'],
    },
  });

  assert.deepEqual(source, sourceBefore);
  assert.equal(validateProgressiveBusinessTwin(result), true);
  assert.equal(result.validation.final_progressive_projection_revalidated, true);
  assert.equal(result.validation.customer_internal_trace_parity, true);
  const privacyReceipt = result.internalTrace.loan_originator_box_1.privacy_classification_receipt;
  const { receipt_sha256: receiptSha256, ...receiptBody } = privacyReceipt;
  assert.equal(result.internalTrace.loan_originator_box_1.borrower_pii_used, privacyReceipt.borrower_pii_used);
  assert.equal(result.internalTrace.loan_originator_box_1.regulated_loan_level_identity_used,
    privacyReceipt.regulated_loan_level_identity_used);
  assert.equal(privacyReceipt.status, 'PASS');
  assert.equal(privacyReceipt.borrower_pii_used, false);
  assert.equal(privacyReceipt.regulated_loan_level_identity_used, false);
  assert.equal(privacyReceipt.classification_scope, 'COMPLETE_OUTWARD_LO_PROJECTION_SOURCE');
  assert.equal(privacyReceipt.authorized_profile_identity_source_path, 'source_view_model.identity.firstName');
  assert.equal(privacyReceipt.governed_evidence_sha256, sha256Stable(source.loanOriginator.typedEvidence));
  const { firstName, ...remainingIdentity } = source.identity;
  assert.equal(privacyReceipt.inspected_corpus_sha256, sha256Stable({
    ...source,
    identity: { ...remainingIdentity, authorized_profile_display_identity: firstName },
  }));
  assert.equal(privacyReceipt.projection_source_sha256, sha256Stable(source));
  assert.equal(receiptSha256, sha256Stable(receiptBody));
  assert.ok(Object.isFrozen(privacyReceipt));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.internalTrace));
  assert.deepEqual(
    Object.keys(result.customerViewModel.objects).sort(),
    Object.keys(result.internalTrace.objects).sort(),
  );
  assert.deepEqual(
    result.internalTrace.projection_trace.map(({ statement_id: statementId }) => statementId).sort(),
    Object.keys(result.internalTrace.objects).sort(),
  );
  for (let index = 1; index <= 5; index += 1) {
    const objectId = `where-reality-${index}`;
    const customer = result.customerViewModel.objects[objectId];
    const internal = result.internalTrace.objects[objectId];
    assert.equal(customer.return_state_id, `where:layer1:${objectId}`);
    assert.equal(internal.return_state_id, customer.return_state_id);
    assert.equal(internal.destination, customer.destination);
    assert.equal(internal.surface, customer.surface);
    assert.ok(internal.source_authority);
    assert.ok(internal.lineage_refs.length > 0);
    assert.ok(internal.evidence_field_ids.length > 0);
  }
});

test('LO projection rejects a post-validation borrower value before cards, drawers, or trace are built', () => {
  const source = structuredClone(sourceFixture());
  source.loanOriginator.typedEvidence.fields.operator_hypothesis_description.value =
    'Borrower John Smith SSN 123-45-6789 at 123 Main Street';
  assert.throws(
    () => createLoanOriginatorProjectionV1({
      sourceViewModel: source,
      bindings: {
        subjectKey: 'lo-projection-fixture',
        verticalId: 'loan_originator',
        verticalAuthorityRefs: ['loan-originator-intelligence-module-business-machine-v1'],
      },
    }),
    /loan_originator_privacy_boundary_violation/u,
  );
});

test('LO projection rejects borrower identity from why summary before projection', () => {
  assertProjectionSourcePrivacyRejected((source) => {
    source.why.summary = 'Borrower Jane Doe';
  }, 'why.summary');
});

test('direct LO Box projection rejects outward-source PII before building customer surfaces', () => {
  const source = structuredClone(sourceFixture());
  source.why.summary = 'Borrower Jane Doe';
  let projection;
  assert.throws(() => {
    projection = projectLoanOriginatorBox1OntoCustomerViewModel({
      customerViewModel: customerFixture(),
      sourceViewModel: source,
    });
  }, /loan_originator_privacy_boundary_violation/u);
  assert.equal(projection, undefined);
});

test('LO projection rejects SSN from current operations state before projection', () => {
  assertProjectionSourcePrivacyRejected((source) => {
    source.currentStates.operationsState = 'SSN 123-45-6789';
  }, 'currentStates.operationsState');
});

test('LO projection rejects borrower identity from current capacity state before projection', () => {
  assertProjectionSourcePrivacyRejected((source) => {
    source.currentStates.capacityState = 'Borrower Jane Doe determines available capacity.';
  }, 'currentStates.capacityState');
});

test('LO projection rejects customer identity from quick facts before projection', () => {
  assertProjectionSourcePrivacyRejected((source) => {
    source.quickFacts[0].value = 'client jane doe';
  }, 'quickFacts[0].value');
});

test('LO projection rejects protected-class data from inspector drawers before projection', () => {
  assertProjectionSourcePrivacyRejected((source) => {
    const inspectorId = source.quickFacts[0].inspectorId;
    source.inspectors[inspectorId].level1.meaning = 'applicant is muslim';
  }, 'inspectors');
});
