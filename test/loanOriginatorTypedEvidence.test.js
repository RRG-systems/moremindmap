import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LOAN_ORIGINATOR_FIELD_DEFINITIONS,
  normalizeLoanOriginatorTypedEvidence,
  validateLoanOriginatorTypedEvidence,
} from '../src/lib/baVerticalCassettesV1/loanOriginatorEvidence.js';

const ASSESSMENT_ID = 'ba-20260914-offline-typed-evidence';
const CAPTURED_AT = '2026-09-14T00:00:00.000Z';

function normalize(values) {
  return normalizeLoanOriginatorTypedEvidence({
    assessmentId: ASSESSMENT_ID,
    capturedAt: CAPTURED_AT,
    typedEvidence: values,
  });
}

function validValueForType(type) {
  if (type.startsWith('enum:')) return type.slice('enum:'.length).split('|')[0];
  if (type.startsWith('enum_set:')) return [type.slice('enum_set:'.length).split('|')[0]];
  const values = {
    string: 'customer-stated value',
    string_or_role: 'LO',
    string_or_enum: 'PER_FUNDED',
    string_set: ['customer-stated category'],
    number: 36,
    integer_nonnegative: 24,
    currency_nonnegative: 8_400_000,
    boolean: true,
    date: '2026-08-31',
    source_date: { source: 'customer-report', date: '2026-08-31' },
    definition_ref: 'lo.close-fund.v1',
    id_ref: 'system:weekly-calls',
    provenance_ref: 'customer:statement:1',
    evidence_ref: 'business_assessment:field:1',
    id_ref_set: ['system:weekly-calls'],
    evidence_ref_set: ['business_assessment:field:1'],
    evidence_ref_set_or_string: ['business_assessment:field:1'],
    number_or_string: 20,
    integer_nonnegative_or_range: { min: 100, max: 200 },
    numeric_range: { min: 0.8, max: 1.2 },
    ratio: 0.4,
    ratio_or_count: 0.25,
    metric_map: { PURCHASE: 20, REFINANCE: 4 },
    metric_definition: { value: 24, definition_id: 'lo.close-fund.v1' },
    metric_with_window: { value: 12, window: 'TRAILING_12_MONTHS' },
    currency_metric: { amount: 1_200, currency: 'USD' },
    frequency: 'WEEKLY',
    metric_or_frequency: 'WEEKLY',
    metric_or_structured_observation: { observation: 'Three of four completed.' },
    string_enum_map: { OTHER_PURPOSE: 'APPLICABLE' },
    definition_state_map: { PURCHASE: 'APPLICABLE' },
    row_set: ['professional relationships'],
    row_set_or_explicit_none_unknown: 'NONE_KNOWN',
    structured_activity: { activity: 'calls', cadence: 'WEEKLY' },
    structured_owner_handoff: { owner: 'LO', handoff_to: 'SHARED_PROCESSING' },
    structured_observation: { observation: 'Customer-reported delay.' },
    structured_scope: { scope: 'INDIVIDUAL' },
    structured_outcome: { outcome: 'Customer-reported improvement.' },
    structured_stage_scope: { purpose: 'PURCHASE', stage: 'APPLICATION' },
    structured_economic_terms: { basis: 'PER_FUNDED' },
    structured_claim: { claim: 'Corrected aggregate funded count.', value: 24 },
  };
  if (!Object.hasOwn(values, type)) throw new Error(`test_value_missing:${type}`);
  return structuredClone(values[type]);
}

test('all 145 frozen LO typed fields accept their declared canonical value family', () => {
  for (const definition of LOAN_ORIGINATOR_FIELD_DEFINITIONS) {
    const governed = normalize({ [definition.id]: { value: validValueForType(definition.type) } });
    assert.equal(validateLoanOriginatorTypedEvidence(governed), governed, definition.id);
  }
});

test('the exact primitive and list shapes used by both native LO mappings remain valid', () => {
  const nativeMappingShapes = {
    producing_status: 'PRODUCING',
    role_types: ['INDIVIDUAL_PRODUCER'],
    platform_models: ['RETAIL_DIRECT'],
    business_subject_scope: 'INDIVIDUAL',
    goal_metric: 'FUNDED_UNITS',
    goal_target_value: 36,
    goal_unit_currency: 'funded loans',
    goal_subject_scope: 'INDIVIDUAL',
    goal_why_narrative: 'Customer-stated forward business goal.',
    funded_units_12m: 24,
    funded_volume_12m: 8_400_000,
    production_as_of_date: '2026-08-31',
    production_subject_scope: 'INDIVIDUAL',
    purchase_applicability: 'APPLICABLE',
    refinance_applicability: 'APPLICABLE',
    osn_sources: ['professional relationships', 'past customers', 'direct inquiries'],
    crn_categories: ['PAST_CUSTOMER'],
    system_action: 'conversations and handoffs',
    system_tool: 'company CRM, calendar, and checklists',
    team_support_state: 'SUPPORTED',
    operator_hypothesis_description: 'Customer-stated operator hypothesis.',
  };
  const governed = normalize(nativeMappingShapes);
  assert.equal(validateLoanOriginatorTypedEvidence(governed), governed);
  assert.equal(Object.values(governed.fields).filter((field) => field.question_state === 'ANSWERED').length, 21);
});

test('normalization rejects mislabeled value shapes, ranges, enums, dates, refs, and structures', () => {
  const invalidCases = [
    ['vertical_confirmation', 'loan_originator_confirmed'],
    ['role_types', ['INDIVIDUAL_PRODUCER', 'INDIVIDUAL_PRODUCER']],
    ['goal_unit_currency', '   '],
    ['other_residential_purposes', ['HELOC', 'HELOC']],
    ['goal_target_value', Number.POSITIVE_INFINITY],
    ['funded_units_12m', 1.5],
    ['funded_volume_12m', -1],
    ['funded_terminal_definition', 'not a stable ref'],
    ['production_as_of_date', '2026-02-30'],
    ['production_purpose_segments', { PURCHASE: 'twenty' }],
    ['other_purpose_applicability', { HELOC: 'YES' }],
    ['purpose_stage_applicability', { APPLICATION: 'ENABLED' }],
    ['osn_sources', [{}]],
    ['osn_meaningful_size_or_scope', true],
    ['osn_active_measure', { value: 12 }],
    ['osn_activity_cadence', { note: 'weekly' }],
    ['osn_system_link', 'system link with spaces'],
    ['crn_meaningful_size', { min: 200, max: 100 }],
    ['crn_authority_source_date', { source: 'customer-report', date: '2026-02-30' }],
    ['opportunity_count_definition', { value: 40 }],
    ['pending_open_share', -0.1],
    ['system_frequency', { note: 'weekly' }],
    ['system_owner', ['LO']],
    ['work_owner_handoff', { handoff_to: 'PROCESSING' }],
    ['service_quality_effect', { note: 'slower response' }],
    ['platform_limits', 'NONE REPORTED'],
    ['platform_affected_scope', { label: 'Purchase applications' }],
    ['platform_volatile_fact_flag', 1],
    ['operator_supporting_observations', ['reference with spaces']],
    ['priority_strategy_system_link', ['system:one', 'system:one']],
    ['priority_target_cadence', true],
    ['priority_actual_execution', ['unstructured']],
    ['priority_outcome', { note: 'improved' }],
    ['conversion_trigger_evidence', ['bad evidence ref']],
    ['conversion_affected_scope', { scope: 'FUNNEL' }],
    ['conversion_displayed_derived_rate', 40],
    ['compensation_revenue_basis', { basis: 'PER_FUNDED' }],
    ['gross_amount_per_funded_or_period', { amount: -1, currency: 'USD' }],
    ['salary_draw_branch_distinctions', { note: 'unknown' }],
    ['economic_assumption_source', 'source with spaces'],
    ['economic_sensitivity_range', { min: 1.2, max: 0.8 }],
    ['contradiction_corrected_claim', { note: 'corrected' }],
    ['contradiction_supersession_link', 'bad supersession ref'],
  ];

  for (const [fieldId, value] of invalidCases) {
    assert.throws(
      () => normalize({ [fieldId]: { value } }),
      new RegExp(`loan_originator_typed_evidence_value_invalid:${fieldId}`, 'u'),
      fieldId,
    );
  }
});

test('governed evidence validation independently rejects a post-normalization value substitution', () => {
  const governed = normalize({
    goal_target_value: 36,
    production_as_of_date: '2026-08-31',
    conversion_displayed_derived_rate: 0.4,
  });
  for (const [fieldId, invalidValue] of [
    ['goal_target_value', '36'],
    ['production_as_of_date', '2026-08-31T00:00:00.000Z'],
    ['conversion_displayed_derived_rate', 40],
  ]) {
    const substituted = structuredClone(governed);
    substituted.fields[fieldId].value = invalidValue;
    assert.throws(
      () => validateLoanOriginatorTypedEvidence(substituted),
      new RegExp(`loan_originator_governed_evidence_answered_field_invalid:${fieldId}`, 'u'),
      fieldId,
    );
  }
});
