import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createScopedLoanOriginatorGenerationContext,
  prepareScopedLoanOriginatorAssessment,
} from '../api/engine/newBaProductionReadinessV1/scopedLoanOriginatorGeneration.js';
import {
  createAuthorizedSyntheticTopSource,
  normalizeGovernedAssessmentRecord,
  SYNTHETIC_TOP_PROFILE_ID,
} from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { validateBaProviderEgressPayload } from '../api/engine/newBaProductionReadinessV1/privacyEgress.js';
import {
  buildGovernedRealProfileWbmInput,
  createRealProfileGenerationContext,
} from '../api/engine/newBaProductionReadinessV1/realProfileGeneration.js';
import { createBoundedOpenAITripletProvider } from '../api/runtime/_patriciaCanonicalBaTripletV1.mjs';
import { buildTrajectoryGenerationMission } from '../src/lib/fiveFuturesV2/trajectoryContract.js';
import { buildCandidateGenerationMission } from '../src/lib/oneMoveV2/candidateContract.js';
import {
  assertLoanOriginatorPrivacyBoundary,
  inspectLoanOriginatorPrivacyBoundary,
  normalizeLoanOriginatorTypedEvidence,
} from '../src/lib/baVerticalCassettesV1/loanOriginatorEvidence.js';

const PROFILE_ID = 'MM-20260914-LOPRIVACY';
const ASSESSMENT_ID = 'ba-20260914-deadbeef';
const CAPTURED_AT = '2026-09-14T00:00:00.000Z';
const RED_TEAM_VALUE = 'Borrower John Smith SSN 123-45-6789 at 123 Main Street';
const SYSTEMIC_TEXT_CANARIES = Object.freeze([
  'Prospect: Cher',
  'Borrower’s name is Cher',
  'Client’s name is Cher',
  'Mortgagor: Cher',
  'Consumer: Cher',
  'Lead: Cher',
  'Homebuyer: Cher',
  'veteran borrower',
  'woman borrower',
  'borrower is not a citizen',
  'born 2 January 1980',
  'born January 2nd, 1980',
]);
const STRUCTURAL_KEY_CANARIES = Object.freeze([
  ['dob', '1980-01-02'],
  ['date_of_birth', '1980-01-02'],
  ['birthdate', '1980-01-02'],
  ['tin', '123456789'],
  ['ein', '123456789'],
  ['tax_id', '123456789'],
  ['routing_number', 123456789],
  ['drivers_license', 'D1234567'],
  ['license_number', 'D1234567'],
  ['passport_number', 'X12345678'],
  ['full_name', 'Jane Doe'],
  ['first_name', 'Jane'],
  ['last_name', 'Doe'],
  ['person_name', 'Jane Doe'],
  ['client_name', 'Cher'],
  ['national_origin', 'American'],
  ['sex', 'female'],
  ['gender', 'woman'],
  ['sexual_orientation', 'gay'],
  ['age', 42],
  ['marital_status', 'married'],
  ['family_status', 'familial'],
]);
const CONTEXTUAL_OBJECT_CANARIES = Object.freeze([
  ['borrower.name', { observation: 'aggregate effect', borrower: { name: 'Cher' } }],
  ['client.name', { observation: 'aggregate effect', client: { name: 'Cher' } }],
  ['borrower.income', { observation: 'aggregate effect', borrower: { income: 120000 } }],
  ['applicant.assets', { observation: 'aggregate effect', applicant: { assets: 50000 } }],
  ['account.number', { observation: 'aggregate effect', account: { number: '123456789' } }],
  ['loan.id', { observation: 'aggregate effect', loan: { id: 'ABC12345' } }],
  ['application.id', { observation: 'aggregate effect', application: { id: 'APP12345' } }],
  ['bank.routing', { observation: 'aggregate effect', bank: { routing: 123456789 } }],
  ['birth.date', { observation: 'aggregate effect', birth: { date: '1980-01-02' } }],
  ['government.number', { observation: 'aggregate effect', government: { number: 'AZ1234567' } }],
  ['role+name', { observation: 'aggregate effect', role: 'borrower', name: 'Cher' }],
  ['role+income', { observation: 'aggregate effect', role: 'client', income: 120000 }],
  ['party_type+first', { observation: 'aggregate effect', party_type: 'Applicant', first: 'José' }],
  ['coApplicant.name', { observation: 'aggregate effect', coApplicant: { name: 'Cher' } }],
  ['loanApplicant.name', { observation: 'aggregate effect', loanApplicant: { name: 'Cher' } }],
  ['prospect.name', { observation: 'aggregate effect', prospect: { name: 'Cher' } }],
  ['type+name', { observation: 'aggregate effect', type: 'borrower', name: 'Cher' }],
  ['entity_type+name', { observation: 'aggregate effect', entity_type: 'client', name: 'Cher' }],
  ['subject+name', { observation: 'aggregate effect', subject: 'applicant', name: 'Cher' }],
  ['mortgage.id', { observation: 'aggregate effect', mortgage: { id: 'MORT12345' } }],
  ['loan.reference', { observation: 'aggregate effect', loan: { reference: 'LOAN12345' } }],
  ['application.ref', { observation: 'aggregate effect', application: { ref: 'APP12345' } }],
  ['account.acct', { observation: 'aggregate effect', account: { acct: '123456789' } }],
  ['co-applicant array first', { observation: 'aggregate effect', 'co-applicant-data': [{ first: 'Cher' }] }],
  ['loan applicant array last', { observation: 'aggregate effect', loan_applicant_details: [{ last: 'Doe' }] }],
  ['mortgage record ref', { observation: 'aggregate effect', mortgageRecord: [{ ref: 'MORT12345' }] }],
  ['bank account acct', { observation: 'aggregate effect', bankAccount: { acct: '123456789' } }],
  ['mortgagor.name', { observation: 'aggregate effect', mortgagor: { name: 'Cher' } }],
  ['consumer.name', { observation: 'aggregate effect', consumer: { name: 'Cher' } }],
  ['lead.name', { observation: 'aggregate effect', lead: { name: 'Cher' } }],
  ['homebuyer.name', { observation: 'aggregate effect', homebuyer: { name: 'Cher' } }],
  ['cosigner.name', { observation: 'aggregate effect', cosigner: { name: 'Cher' } }],
  ['guarantor.name', { observation: 'aggregate effect', guarantor: { name: 'Cher' } }],
  ['loan.key', { observation: 'aggregate effect', loan: { key: 'L123456' } }],
  ['application.num', { observation: 'aggregate effect', application: { num: 'A123456' } }],
  ['account.no', { observation: 'aggregate effect', account: { no: '123456789' } }],
  ['unknown person container', { observation: 'aggregate effect', mysteryParty: { name: 'Cher' } }],
  ['unknown array container', { observation: 'aggregate effect', arbitrary_records: [{ first: 'Jane', last: 'Doe' }] }],
  ['participant role income', { observation: 'aggregate effect', participant: 'mortgagor', income: 120000 }],
]);
const FIXTURE = JSON.parse(readFileSync(new URL(
  './fixtures/subscriptionV1SyntheticQaLoanOriginatorNativeInputs.json',
  import.meta.url,
), 'utf8')).cases[0].native_inputs;

function assertPrivacyViolation(callback, expectedPath = null) {
  assert.throws(callback, (error) => {
    assert.equal(error.code, 'loan_originator_privacy_boundary_violation');
    assert.equal(error.privacy_receipt.status, 'REJECTED');
    assert.ok(error.privacy_receipt.finding_count > 0);
    assert.ok(error.findings.every((finding) => !Object.hasOwn(finding, 'value')));
    if (expectedPath) assert.ok(error.findings.some(({ path }) => path.includes(expectedPath)), error.message);
    return true;
  });
}

test('value classifier rejects the P1 red-team payload in scalar, list, and nested typed evidence shapes', () => {
  for (const [fieldId, value] of [
    ['goal_why_narrative', RED_TEAM_VALUE],
    ['osn_sources', [RED_TEAM_VALUE]],
    ['service_quality_effect', { observation: RED_TEAM_VALUE }],
  ]) {
    assertPrivacyViolation(() => normalizeLoanOriginatorTypedEvidence({
      assessmentId: ASSESSMENT_ID,
      capturedAt: CAPTURED_AT,
      typedEvidence: { [fieldId]: { value } },
    }), fieldId);
  }
});

test('value classifier rejects borrower identity and regulated loan-level canaries in every raw value shape', () => {
  const canaries = [
    'DOB 01/02/1980',
    'DOB January 2, 1980',
    'date of birth January 2, 1980',
    'birthdate 1980-01-02',
    'Taxpayer ID 12-3456789',
    'The applicant is Black',
    'the applicant is african american',
    'applicant is muslim',
    'Female borrower has a disability',
    'pregnant borrower',
    'Routing number 123456789',
    'routing number 123-456-789',
    'Client Jane Doe',
    'Borrower: Cher',
    'applicant José',
    'borrower john smith',
    'client jane doe',
    'applicant name: jane doe',
    'Jane Doe',
    'I spoke with Jane Doe yesterday.',
    'Jane Doe asked for a 6.5% rate',
    'john smith requested a 6.5% rate',
    'borrower has a disability',
    '42-year-old borrower',
    'married borrower',
    'Mexican applicant',
    'client said she needs help',
    'we quoted the client a 6.5% rate',
    'client income is 120000',
    'Driver license D1234567',
    'Loan number ABC-123456',
    'SSN 123 45 6789',
    'social security number 123 45 6789',
    'customer@example.com',
    '(602) 555-0144',
    ...SYSTEMIC_TEXT_CANARIES,
  ];
  canaries.forEach((canary, index) => {
    const shapes = [canary, [canary], { evidence: [{ note: canary }] }];
    shapes.forEach((shape, shapeIndex) => {
      const receipt = inspectLoanOriginatorPrivacyBoundary(shape, {
        path: `canary_${index}.shape_${shapeIndex}`,
      });
      assert.equal(receipt.status, 'REJECTED', `${canary} shape ${shapeIndex}`);
      assert.equal(receipt.rejected_before_use, true, `${canary} shape ${shapeIndex}`);
      assert.ok(receipt.findings.every((finding) => !Object.hasOwn(finding, 'value')), canary);
    });
  });
});

test('systemic subject, protected-trait, and DOB prose rejects inside a valid typed shape', () => {
  SYSTEMIC_TEXT_CANARIES.forEach((canary) => {
    assertPrivacyViolation(() => normalizeLoanOriginatorTypedEvidence({
      assessmentId: ASSESSMENT_ID,
      capturedAt: CAPTURED_AT,
      typedEvidence: {
        service_quality_effect: { value: { observation: canary } },
      },
    }), 'service_quality_effect');
  });
});

test('shared classifier rejects every labeled residual canary again at final LO provider egress', () => {
  const canaries = [
    'borrower john smith',
    'client jane doe',
    'applicant name: jane doe',
    'SSN 123 45 6789',
    'social security number 123 45 6789',
    'date of birth January 2, 1980',
    'routing number 123-456-789',
    'the applicant is african american',
    'pregnant borrower',
    'applicant is muslim',
    'client said she needs help',
    'we quoted the client a 6.5% rate',
    'client income is 120000',
    'birthdate 1980-01-02',
    'Borrower: Cher',
    'applicant José',
    'borrower has a disability',
    '42-year-old borrower',
    'married borrower',
    'Mexican applicant',
    'john smith requested a 6.5% rate',
    ...SYSTEMIC_TEXT_CANARIES,
  ];
  canaries.forEach((canary, index) => {
    const shapes = [canary, [canary], { evidence: [{ note: canary }] }];
    shapes.forEach((shape, shapeIndex) => {
      assert.throws(() => validateBaProviderEgressPayload({
        store: false,
        mission: {
          assessment_identity: { vertical: 'loan_originator' },
          context_packet: {
            typed_evidence: { service_quality_effect: { value: shape } },
          },
        },
      }), (error) => {
        assert.equal(error.message, 'new_ba_privacy_egress_rejected', `${index}:${shapeIndex}`);
        assert.ok(error.findings.length > 0, `${canary} shape ${shapeIndex}`);
        return true;
      });
    });
  });
});

test('forbidden semantic keys reject structured and numeric loan-level data before normalization and egress', () => {
  STRUCTURAL_KEY_CANARIES.forEach(([key, value]) => {
    const nestedValue = { observation: 'aggregate effect', [key]: value };
    const rawReceipt = inspectLoanOriginatorPrivacyBoundary(nestedValue, {
      path: 'raw_nested_typed_value',
    });
    assert.equal(rawReceipt.status, 'REJECTED', key);
    assert.ok(rawReceipt.findings.some(({ path }) => path.includes(key)), key);
    assertPrivacyViolation(() => normalizeLoanOriginatorTypedEvidence({
      assessmentId: ASSESSMENT_ID,
      capturedAt: CAPTURED_AT,
      typedEvidence: { service_quality_effect: { value: nestedValue } },
    }), key);

    assert.throws(() => validateBaProviderEgressPayload({
      store: false,
      mission: {
        assessment_identity: { vertical: 'loan_originator' },
        context_packet: {
          typed_evidence: { service_quality_effect: { value: nestedValue } },
        },
      },
    }), (error) => {
      assert.equal(error.message, 'new_ba_privacy_egress_rejected', key);
      assert.ok(error.findings.some(({ path }) => path.includes(key)), key);
      return true;
    });
  });
});

test('context-aware traversal rejects composed borrower and regulated identifiers at every boundary', () => {
  CONTEXTUAL_OBJECT_CANARIES.forEach(([label, nestedValue]) => {
    const rawReceipt = inspectLoanOriginatorPrivacyBoundary(nestedValue, {
      path: 'raw_contextual_typed_value',
    });
    assert.equal(rawReceipt.status, 'REJECTED', label);

    assertPrivacyViolation(() => normalizeLoanOriginatorTypedEvidence({
      assessmentId: ASSESSMENT_ID,
      capturedAt: CAPTURED_AT,
      typedEvidence: { service_quality_effect: { value: nestedValue } },
    }));

    assert.throws(() => validateBaProviderEgressPayload({
      store: false,
      mission: {
        assessment_identity: { vertical: 'loan_originator' },
        context_packet: {
          typed_evidence: { service_quality_effect: { value: nestedValue } },
        },
      },
    }), (error) => {
      assert.equal(error.message, 'new_ba_privacy_egress_rejected', label);
      assert.ok(error.findings.length > 0, label);
      return true;
    });
  });
});

test('context-aware traversal preserves aggregate nested business structures', () => {
  const value = {
    observation: 'aggregate effect',
    borrower: { count: 25, trend: 'improving' },
    loan: { count: 18, stage: 'FUNDED' },
    application: { count: 22, stage: 'APPLICATION' },
    bank: { channel_count: 2 },
    prospect: { count: 14, trend: 'growing' },
    mortgage: { count: 11, stage: 'FUNDED' },
    mortgagor: { count: 11, volume: 2200000 },
    consumer: { count: 19, volume: 3800000 },
    lead: { count: 31, volume: 6200000 },
    homebuyer: { count: 9, volume: 1800000 },
    cosigner: { count: 2, volume: 400000 },
    guarantor: { count: 1, volume: 200000 },
    account: { count: 4, volume: 800000 },
  };
  assert.equal(inspectLoanOriginatorPrivacyBoundary(value).status, 'PASS');
  const governed = normalizeLoanOriginatorTypedEvidence({
    assessmentId: ASSESSMENT_ID,
    capturedAt: CAPTURED_AT,
    typedEvidence: { service_quality_effect: { value } },
  });
  assert.equal(governed.fields.service_quality_effect.question_state, 'ANSWERED');
  assert.equal(validateBaProviderEgressPayload({
    store: false,
    mission: {
      assessment_identity: { vertical: 'loan_originator' },
      context_packet: { typed_evidence: governed },
    },
  }).status, 'PASS');
});

test('current fictional aggregate business fixture remains accepted with an immutable PASS receipt', () => {
  const receipt = assertLoanOriginatorPrivacyBoundary({ trace: 'aggregate fixture', ...FIXTURE }, {
    path: 'fixture.native_inputs',
  });
  assert.equal(receipt.status, 'PASS');
  assert.equal(receipt.classification, 'AGGREGATE_BUSINESS_EVIDENCE_ONLY');
  assert.equal(receipt.borrower_pii_used, false);
  assert.equal(receipt.regulated_loan_level_identity_used, false);
  assert.equal(receipt.finding_count, 0);
  assert.ok(receipt.inspected_scalar_count > 0);
  assert.ok(Object.isFrozen(receipt));
  assert.ok(Object.isFrozen(receipt.findings));
});

test('the frozen fictional LO fixture reaches a clean WBM provider preflight without changing evidence custody', () => {
  const context = createScopedLoanOriginatorGenerationContext();
  const prepared = prepareScopedLoanOriginatorAssessment({
    profileId: SYNTHETIC_TOP_PROFILE_ID,
    assessmentId: 'ba-20260914-cafebabe',
    createdAt: CAPTURED_AT,
    nativeInputs: structuredClone(FIXTURE),
  }, context);
  const businessEvidence = normalizeGovernedAssessmentRecord(prepared, SYNTHETIC_TOP_PROFILE_ID, {
    cassetteRegistry: context.cassetteRegistry,
    generationContext: context.generationContext,
  });
  const source = {
    ...createAuthorizedSyntheticTopSource(),
    assessment_id: prepared.assessment_id,
    business_evidence: businessEvidence,
  };
  const generation = createRealProfileGenerationContext({
    source,
    displayName: 'Zyqx Pvtr',
    library: context.library,
    cassetteRegistry: context.cassetteRegistry,
  });
  assert.equal(generation.providerPreflight.status, 'PASS');
  assert.equal(generation.providerPreflight.prohibited_identity_findings, 0);
  assert.equal(generation.input.governed_business_evidence.length, generation.context.business_evidence.length);
  assert.equal(generation.input.governed_business_evidence.length, 33);
});

test('the actual triplet factory wrapper preserves strict LO egress without treating SDK schema metadata as a person', async () => {
  const context = createScopedLoanOriginatorGenerationContext();
  const prepared = prepareScopedLoanOriginatorAssessment({
    profileId: SYNTHETIC_TOP_PROFILE_ID,
    assessmentId: 'ba-20260914-cafebabe',
    createdAt: CAPTURED_AT,
    nativeInputs: structuredClone(FIXTURE),
  }, context);
  const source = {
    ...createAuthorizedSyntheticTopSource(),
    assessment_id: prepared.assessment_id,
    business_evidence: normalizeGovernedAssessmentRecord(prepared, SYNTHETIC_TOP_PROFILE_ID, {
      cassetteRegistry: context.cassetteRegistry,
      generationContext: context.generationContext,
    }),
  };
  const generation = createRealProfileGenerationContext({
    source,
    displayName: 'Zyqx Pvtr',
    library: context.library,
    cassetteRegistry: context.cassetteRegistry,
  });
  let capturedRequest = null;
  const provider = createBoundedOpenAITripletProvider({
    transport: async (request) => {
      capturedRequest = request;
      assert.equal(validateBaProviderEgressPayload(request).status, 'PASS');
      const error = new Error('stop_after_wire_privacy_proof');
      error.code = 'STOP_AFTER_WIRE_PRIVACY_PROOF';
      throw error;
    },
  });
  await assert.rejects(provider.call({
    stage: 'whole_business_model_v1',
    mission: generation.mission,
    schema: generation.schema,
    schemaName: 'real_profile_whole_business_model_v1',
    maxOutputTokens: 60_000,
  }), (error) => error.code === 'STOP_AFTER_WIRE_PRIVACY_PROOF');
  assert.ok(capturedRequest.input[0].content[0].text.includes('\nFROZEN MISSION:\n'));
  assert.equal(capturedRequest.text.format.name, 'real_profile_whole_business_model_v1');
});

test('the actual triplet factory wrapper still rejects borrower PII before external transport', async () => {
  let externalTransportReached = false;
  const provider = createBoundedOpenAITripletProvider({
    transport: async (request) => {
      validateBaProviderEgressPayload(request);
      externalTransportReached = true;
      throw new Error('external_transport_must_not_run');
    },
  });
  await assert.rejects(provider.call({
    stage: 'whole_business_model_v1',
    mission: {
      assessment_identity: { vertical: 'loan_originator' },
      context_packet: { business_evidence: [{ value: RED_TEAM_VALUE }] },
    },
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { status: { type: 'string' } },
      required: ['status'],
    },
    schemaName: 'real_profile_whole_business_model_v1',
    maxOutputTokens: 1_000,
  }), (error) => {
    assert.equal(error.message, 'new_ba_privacy_egress_rejected');
    assert.ok(error.findings.some(({ code }) => [
      'BORROWER_OR_CUSTOMER_NAME',
      'SOCIAL_SECURITY_NUMBER',
      'EXACT_STREET_ADDRESS',
    ].includes(code)));
    return true;
  });
  assert.equal(externalTransportReached, false);
});

test('derived-context name handling keeps safe authority prose while rejecting strong subject-name labels', () => {
  for (const safeValue of [
    'Do not create customer prose.',
    'Convert demand into completed client outcomes.',
    'State identity and context plainly.',
  ]) {
    assert.equal(inspectLoanOriginatorPrivacyBoundary(safeValue, {
      detectUnlabeledNames: false,
      detectBareLabeledNames: false,
    }).status, 'PASS', safeValue);
  }
  for (const prohibitedValue of [
    'Borrower Jane Carter requested a meeting.',
    'Customer Jane Carter',
  ]) {
    const receipt = inspectLoanOriginatorPrivacyBoundary(prohibitedValue, {
      detectUnlabeledNames: false,
      detectBareLabeledNames: false,
    });
    assert.equal(receipt.status, 'REJECTED', prohibitedValue);
    assert.ok(receipt.findings.some(({ code }) => code === 'BORROWER_OR_CUSTOMER_NAME'), prohibitedValue);
  }
});

test('all three exact factory wrappers pass while altered wire bindings fail closed', async () => {
  const bindings = [
    ['whole_business_model_v1', 'real_profile_whole_business_model_v1', 'whole_business_model_construction_v1'],
    ['five_futures_v2', 'real_profile_five_futures_v2', 'five-futures-v2-trajectory-generation'],
    ['one_move_v2', 'real_profile_one_move_v2_candidates', 'one-move-v2-candidate-generation-v1'],
  ];
  for (const [stage, schemaName, missionId] of bindings) {
    const downstreamContext = stage === 'five_futures_v2'
      ? {
        context_contract: 'five-futures-v2-wbm-context-v1',
        binding: { vertical_authority_id: 'loan-originator-intelligence-module-core' },
        business_model: { value_creation: 'Create trusted residential representation and convert demand into completed client outcomes.' },
        current_business_reality: [],
        authority_receipts: [{ selected_authority_ids: ['loan-originator-intelligence-module-core'] }],
        evidence_refs: [],
      }
      : {
        context_contract: 'one-move-v2-governed-context-v1',
        binding: { vertical_authority_id: 'loan-originator-intelligence-module-core' },
        governing_constraint: { constraint_type: 'capacity' },
        causal_mechanisms: [],
        evidence_refs: [],
        selected_intervention_authorities: [{
          authority_id: 'loan-originator-intelligence-module-core',
          selected_sections: [{ content: 'This Bible does not prescribe customer wording or customer-facing realization.' }],
        }],
        selected_script_intelligence: [{ content: 'Offer a connection to a licensed specialist when regulated expertise is needed.' }],
        selection_authority_receipt: { selected_authority_ids: ['loan-originator-intelligence-module-core'] },
      };
    const factoryMission = stage === 'five_futures_v2'
      ? buildTrajectoryGenerationMission(downstreamContext)
      : stage === 'one_move_v2'
        ? buildCandidateGenerationMission(downstreamContext)
        : {
          mission_id: missionId,
          assessment_identity: { vertical: 'loan_originator' },
          context_packet: { business_evidence: [{ value: 'Aggregate funded volume and team capacity only.' }] },
        };
    const provider = createBoundedOpenAITripletProvider({
      startingStage: stage,
      transport: async (request) => {
        assert.equal(validateBaProviderEgressPayload(request).status, 'PASS', stage);
        const marker = '\nFROZEN MISSION:\n';
        const wireText = request.input[0].content[0].text;
        const markerIndex = wireText.indexOf(marker);
        const mission = JSON.parse(wireText.slice(markerIndex + marker.length));
        const variants = [];
        const alteredStage = structuredClone(request);
        alteredStage.input[0].content[0].text = wireText.replace(`MORE MindMap ${stage} —`, 'MORE MindMap unknown_stage —');
        variants.push(alteredStage);
        const alteredSchema = structuredClone(request);
        alteredSchema.text.format.name = `${schemaName}_drift`;
        variants.push(alteredSchema);
        const alteredMission = structuredClone(request);
        alteredMission.input[0].content[0].text = `${wireText.slice(0, markerIndex + marker.length)}${JSON.stringify({ ...mission, mission_id: `${missionId}-drift` })}`;
        variants.push(alteredMission);
        const missingDelimiter = structuredClone(request);
        missingDelimiter.input[0].content[0].text = wireText.replace(marker, '\n');
        variants.push(missingDelimiter);
        const duplicateDelimiter = structuredClone(request);
        duplicateDelimiter.input[0].content[0].text = wireText.replace(marker, `${marker}${marker}`);
        variants.push(duplicateDelimiter);
        const invalidJson = structuredClone(request);
        invalidJson.input[0].content[0].text = `${wireText.slice(0, markerIndex + marker.length)}{`;
        variants.push(invalidJson);
        const wrapperRemoved = structuredClone(request);
        wrapperRemoved.input[0].content[0].text = JSON.stringify(mission);
        variants.push(wrapperRemoved);
        const wrapperRemovedAndSchemaDrifted = structuredClone(wrapperRemoved);
        wrapperRemovedAndSchemaDrifted.text.format.name = `${schemaName}_drift`;
        variants.push(wrapperRemovedAndSchemaDrifted);
        if (mission.context) {
          const downstreamContextPii = structuredClone(request);
          downstreamContextPii.input[0].content[0].text = `${wireText.slice(0, markerIndex + marker.length)}${JSON.stringify({
            ...mission,
            context: { ...mission.context, diagnostic: RED_TEAM_VALUE },
          })}`;
          variants.push(downstreamContextPii);
          const downstreamContextName = structuredClone(request);
          downstreamContextName.input[0].content[0].text = `${wireText.slice(0, markerIndex + marker.length)}${JSON.stringify({
            ...mission,
            context: { ...mission.context, diagnostic: 'Borrower: Jane Carter' },
          })}`;
          variants.push(downstreamContextName);
          for (const [authorityKey, prohibitedValue] of [
            ['authority_receipts', 'Borrower Jane Carter'],
            ['selected_intervention_authorities', 'Customer Jane Carter'],
            ['selected_script_intelligence', 'borrower has a disability'],
            ['selection_authority_receipt', 'client said she needs help'],
          ]) {
            if (!Object.hasOwn(mission.context, authorityKey)) continue;
            const hiddenInAuthority = structuredClone(request);
            const authorityValue = mission.context[authorityKey];
            const changedContext = {
              ...mission.context,
              [authorityKey]: Array.isArray(authorityValue)
                ? [...authorityValue, { injected_note: prohibitedValue }]
                : { ...authorityValue, injected_note: prohibitedValue },
            };
            hiddenInAuthority.input[0].content[0].text = `${wireText.slice(0, markerIndex + marker.length)}${JSON.stringify({
              ...mission,
              context: changedContext,
            })}`;
            variants.push(hiddenInAuthority);
          }
          for (const prohibitedValue of ['Borrower Jane Carter', 'Jane Carter']) {
            const rawEvidenceBesideDerivedMission = structuredClone(request);
            rawEvidenceBesideDerivedMission.business_evidence = [{ value: prohibitedValue }];
            variants.push(rawEvidenceBesideDerivedMission);
          }
        }
        if (stage !== 'whole_business_model_v1') {
          const missingContext = structuredClone(request);
          const { context: removedContext, ...missionWithoutContext } = mission;
          assert.ok(removedContext);
          missingContext.input[0].content[0].text = `${wireText.slice(0, markerIndex + marker.length)}${JSON.stringify(missionWithoutContext)}`;
          variants.push(missingContext);
          const nullContext = structuredClone(request);
          nullContext.input[0].content[0].text = `${wireText.slice(0, markerIndex + marker.length)}${JSON.stringify({
            ...mission,
            context: null,
          })}`;
          variants.push(nullContext);
        }
        const outsideMissionPii = structuredClone(request);
        outsideMissionPii.audit_note = 'private-person@example.com';
        variants.push(outsideMissionPii);
        variants.forEach((variant) => assert.throws(
          () => validateBaProviderEgressPayload(variant),
          /new_ba_privacy_egress_rejected/u,
          stage,
        ));
        const error = new Error('stop_after_wire_binding_matrix');
        error.code = 'STOP_AFTER_WIRE_BINDING_MATRIX';
        throw error;
      },
    });
    await assert.rejects(provider.call({
      stage,
      mission: factoryMission,
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: { status: { type: 'string' } },
        required: ['status'],
      },
      schemaName,
      maxOutputTokens: 1_000,
    }), (error) => error.code === 'STOP_AFTER_WIRE_BINDING_MATRIX');
  }
});

test('scoped preparation rejects mission-answer PII before returning a persistence candidate', () => {
  const nativeInputs = structuredClone(FIXTURE);
  nativeInputs.answers.LO_CORE_11_OPERATOR_DIAGNOSIS = RED_TEAM_VALUE;
  const context = createScopedLoanOriginatorGenerationContext();
  assertPrivacyViolation(() => prepareScopedLoanOriginatorAssessment({
    profileId: PROFILE_ID,
    assessmentId: ASSESSMENT_ID,
    createdAt: CAPTURED_AT,
    nativeInputs,
  }, context), 'answers.LO_CORE_11_OPERATOR_DIAGNOSIS');
});

test('WBM construction rechecks stored mission prose before assembling governed evidence', () => {
  const context = createScopedLoanOriginatorGenerationContext();
  const prepared = prepareScopedLoanOriginatorAssessment({
    profileId: PROFILE_ID,
    assessmentId: ASSESSMENT_ID,
    createdAt: CAPTURED_AT,
    nativeInputs: structuredClone(FIXTURE),
  }, context);
  const source = {
    profile_id: PROFILE_ID,
    assessment_id: ASSESSMENT_ID,
    business_evidence: {
      ...prepared,
      profile_id: PROFILE_ID,
      answers: {
        ...prepared.inputs.answers,
        LO_CORE_11_OPERATOR_DIAGNOSIS: RED_TEAM_VALUE,
      },
      typed_evidence: prepared.inputs.typed_evidence,
    },
    bos_authority: { profile_id: PROFILE_ID },
  };
  assertPrivacyViolation(() => buildGovernedRealProfileWbmInput({
    source,
    requestedAt: CAPTURED_AT,
    cassetteRegistry: context.cassetteRegistry,
  }), 'answers.LO_CORE_11_OPERATOR_DIAGNOSIS');
});

test('final provider egress independently rejects LO PII before any transport', () => {
  for (const vertical of ['loan_originator', 'loan-originator', 'loanOriginator']) {
    assert.throws(() => validateBaProviderEgressPayload({
      store: false,
      mission: {
        assessment_identity: { vertical },
        context_packet: { business_evidence: [{ value: RED_TEAM_VALUE }] },
      },
    }), (error) => {
      assert.equal(error.message, 'new_ba_privacy_egress_rejected');
      assert.ok(error.findings.some(({ code }) => [
        'BORROWER_OR_CUSTOMER_NAME',
        'SOCIAL_SECURITY_NUMBER',
        'EXACT_STREET_ADDRESS',
      ].includes(code)));
      return true;
    });
  }
});
