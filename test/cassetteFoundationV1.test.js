import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import process from 'node:process';
import test from 'node:test';

import startAssessmentHandler from '../api/business-assessment/start.js';
import {
  buildCustomerConfirmedVerticalBinding,
  buildLegacyRealEstateVerticalBinding,
  validatePersistedVerticalBinding,
} from '../api/business-assessment/verticalBinding.js';
import { classifyCompatiblePriorRealization } from '../api/engine/newBaProductionReadinessV1/compatibilitySelection.js';
import { projectNewBaBox1ThroughCassette } from '../api/engine/newBaProductionReadinessV1/projectionDispatch.js';
import {
  buildNewBaRealizationIdentity,
  buildNewBaRealizationIdentityV3,
} from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import {
  BA_VERTICAL_FAILURE_CODES,
  PRODUCTION_BA_CASSETTE_REGISTRY,
  REAL_ESTATE_BOX_1_PROJECTION_CONTRACT,
  REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_SHA256,
  REAL_ESTATE_CASSETTE_REGISTRATION,
  REAL_ESTATE_EVIDENCE_CONTRACT_ID,
  REAL_ESTATE_EVIDENCE_CONTRACT_SHA256,
  REAL_ESTATE_EVIDENCE_CONTRACT_VERSION,
  REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS,
  REAL_ESTATE_INTAKE_CONTRACT_ID,
  REAL_ESTATE_INTAKE_CONTRACT_SHA256,
  REAL_ESTATE_INTAKE_CONTRACT_VERSION,
  REAL_ESTATE_INTAKE_QUESTIONS,
  REAL_ESTATE_QUESTION_AUTHORITY,
  buildCustomerConfirmedSelection,
  createGovernedCassetteRegistry,
  projectBaCassetteBindingToSubscriptionVerticalContext,
  resolveConfirmedVerticalSelection,
  stableCanonicalize,
} from '../src/lib/baVerticalCassettesV1/index.js';
import {
  assembleWholeBusinessContext,
  loadFrozenAuthorityLibrary,
} from '../src/lib/wholeBusinessModelV1/index.js';

const HEX = Object.freeze({
  cassette: 'a'.repeat(64), registry: 'b'.repeat(64), intake: 'c'.repeat(64), evidence: 'd'.repeat(64), projection: 'e'.repeat(64), binding: 'f'.repeat(64),
});

function sha256Stable(value) {
  return crypto.createHash('sha256').update(stableCanonicalize(value)).digest('hex');
}

function fictionalRegistration() {
  return {
    contract_version: 'ba-governed-cassette-registration-v1',
    vertical_id: 'fictional_services',
    vertical_label: 'Fictional Services',
    cassette_id: 'fictional-services-cassette-test-v1',
    cassette_version: '0.0.1-test',
    supported: true,
    active: true,
    cassette_manifest_sha256: HEX.cassette,
    cassette_registry_sha256: HEX.registry,
    intake_contract: {
      contract_id: 'fictional-intake-test-v1', version: '0.0.1-test', sha256: HEX.intake,
      questions: [{ key: 'f1', purpose: 'Fictional capacity', title: 'Synthetic question', prompt: 'Synthetic only', rows: 4 }],
    },
    evidence_contract: {
      contract_id: 'fictional-evidence-test-v1', version: '0.0.1-test', sha256: HEX.evidence,
      question_authority: { f1: { primary_domain: 'operations', secondary_domains: ['capacity'] } },
      sufficiency_missions: [{ mission_id: 'FICTIONAL_OPERATING_REALITY', questions: ['f1'], description: 'Synthetic only' }],
    },
    wbm_authority: { library_key: 'fictional_services', route: { base: ['FX-01'], domains: { operations: ['FX-02'], capacity: ['FX-02'] } } },
    box_1_projection: {
      contract_id: 'fictional-box-1-projection-test-v1',
      version: '0.0.1-test',
      adapter_id: 'fictional-box-1-test-v1',
      scope: 'BOX_1_ONLY',
      universal_downstream_missions: ['WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'],
      sha256: HEX.projection,
      customer_label: 'Fictional current state',
    },
    downstream: {
      universal_box_missions: ['WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE'],
      five_futures_contract: 'five-futures-v2', one_move_contract: 'one-move-v2', plan_contract: 'plan-135-v1', subscription_vertical_id: 'FICTIONAL_SERVICES',
    },
    compatibility: { assessment_version: 'fictional-assessment-test-v1', legacy_assessment_types: [], legacy_realization_identity_version: null },
  };
}

function responseHarness() {
  const state = { statusCode: 0, payload: null, headers: {} };
  return {
    state,
    res: {
      setHeader(key, value) { state.headers[key] = value; },
      status(code) { state.statusCode = code; return this; },
      json(payload) { state.payload = payload; return this; },
      end() { return this; },
    },
  };
}

function identityInput(overrides = {}) {
  return {
    profileId: 'MM-20260821-CASS0001', assessmentId: 'ba-20260821-aabbccdd',
    evidenceSha256: '1'.repeat(64), bosAuthoritySha256: '2'.repeat(64),
    bosFusionContractSha256: '3'.repeat(64), bosEvidenceBoundarySha256: '4'.repeat(64),
    compatibilityClass: 'A', ...overrides,
  };
}

test('production registry contains exactly immutable Real Estate cassette #1', () => {
  const registrations = PRODUCTION_BA_CASSETTE_REGISTRY.listSupported();
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].vertical_id, 'real_estate');
  assert.equal(registrations[0].cassette_id, 'real-estate-cassette-v1');
  assert.equal(Object.isFrozen(registrations[0]), true);
  assert.throws(() => createGovernedCassetteRegistry([REAL_ESTATE_CASSETTE_REGISTRATION, REAL_ESTATE_CASSETTE_REGISTRATION]), /BA_CASSETTE_BINDING_MISMATCH/u);
  assert.equal(PRODUCTION_BA_CASSETTE_REGISTRY.hasVertical('fictional_services'), false);
});

test('extracted intake and evidence contracts replay their pinned canonical hashes', () => {
  assert.equal(sha256Stable({
    contract_id: REAL_ESTATE_INTAKE_CONTRACT_ID,
    version: REAL_ESTATE_INTAKE_CONTRACT_VERSION,
    questions: REAL_ESTATE_INTAKE_QUESTIONS,
    assessment_type_strategy: 'real-estate-team-q11-v1',
    team_profile_question_key: 'q11',
    financial_text_question_key: 'q9',
  }), REAL_ESTATE_INTAKE_CONTRACT_SHA256);
  assert.equal(sha256Stable({
    contract_id: REAL_ESTATE_EVIDENCE_CONTRACT_ID,
    version: REAL_ESTATE_EVIDENCE_CONTRACT_VERSION,
    question_authority: REAL_ESTATE_QUESTION_AUTHORITY,
    sufficiency_missions: REAL_ESTATE_EVIDENCE_SUFFICIENCY_MISSIONS,
  }), REAL_ESTATE_EVIDENCE_CONTRACT_SHA256);
  assert.equal(
    sha256Stable(REAL_ESTATE_BOX_1_PROJECTION_CONTRACT),
    REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_SHA256,
  );
  assert.equal(REAL_ESTATE_INTAKE_QUESTIONS.length, 12);
  assert.deepEqual(REAL_ESTATE_INTAKE_QUESTIONS.map((question) => question.key), Array.from({ length: 12 }, (_, index) => `q${index + 1}`));
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync('docs/ba-intelligence-authority-library-v1/freeze/REAL_ESTATE_CASSETTE_MANIFEST_V1.json')).digest('hex'),
    REAL_ESTATE_CASSETTE_REGISTRATION.cassette_manifest_sha256,
  );
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync('docs/ba-intelligence-authority-library-v1/registries/REAL_ESTATE_CASSETTE_REGISTRY_V1.json')).digest('hex'),
    REAL_ESTATE_CASSETTE_REGISTRATION.cassette_registry_sha256,
  );
});

test('current Production gate keeps Recruiting, canonical New BA, question states, and responsive UI semantics', () => {
  const startSource = fs.readFileSync('api/business-assessment/start.js', 'utf8');
  const handlerSource = startSource.slice(startSource.indexOf('export default async function handler'));
  assert.ok(handlerSource.indexOf('verticalBinding = buildCustomerConfirmedVerticalBinding') < handlerSource.indexOf('resolveRecruitingBaOwnerProfile'));
  assert.ok(handlerSource.indexOf('resolveRecruitingBaOwnerProfile') < handlerSource.indexOf('redis = createRedisClient()'));
  assert.match(handlerSource, /buildGovernedQuestionStates/u);
  assert.match(handlerSource, /recruiting_relationship_ref/u);
  assert.match(handlerSource, /projectRecruitingBaState/u);

  const uiSource = fs.readFileSync('src/BusinessAssessment.jsx', 'utf8');
  assert.match(uiSource, /const QUESTIONS = REAL_ESTATE_INTAKE_QUESTIONS/u);
  assert.match(uiSource, /vertical_selection: assessmentProfile\.verticalSelection/u);
  assert.match(uiSource, /question_states: questionStates/u);
  assert.match(uiSource, /recruiting_mode: recruitingMode \? 'accepted_invitation'/u);
  assert.match(uiSource, /enterCanonicalNewBaAfterIntake/u);
  assert.match(uiSource, /data-testid="recruiting-begin-business-assessment"/u);
  assert.match(uiSource, /This question is not applicable/u);
  assert.doesNotMatch(uiSource, /const industry = 'Real Estate'/u);
});

test('selection gate rejects blank, malformed, unsupported, and unconfirmed values', () => {
  assert.throws(() => resolveConfirmedVerticalSelection(null), new RegExp(BA_VERTICAL_FAILURE_CODES.SELECTION_REQUIRED, 'u'));
  assert.throws(() => resolveConfirmedVerticalSelection('real_estate'), new RegExp(BA_VERTICAL_FAILURE_CODES.SELECTION_MALFORMED, 'u'));
  assert.throws(() => resolveConfirmedVerticalSelection({ contract_version: 'ba-vertical-selection-v1', vertical_id: 'loan_originator', confirmation: 'CUSTOMER_CONFIRMED' }), new RegExp(BA_VERTICAL_FAILURE_CODES.SELECTION_UNSUPPORTED, 'u'));
  assert.throws(() => resolveConfirmedVerticalSelection({ ...buildCustomerConfirmedSelection(REAL_ESTATE_CASSETTE_REGISTRATION), confirmation: 'SUGGESTED' }), new RegExp(BA_VERTICAL_FAILURE_CODES.SELECTION_UNCONFIRMED, 'u'));
});

test('server resolves binding independently, ignores client authority hashes, and detects persistence tampering', () => {
  const selection = { ...buildCustomerConfirmedSelection(REAL_ESTATE_CASSETTE_REGISTRATION), cassette_manifest_sha256: '0'.repeat(64), registry_sha256: '0'.repeat(64) };
  const binding = buildCustomerConfirmedVerticalBinding({ selection, selectedAt: '2026-08-21T12:00:00.000Z' });
  assert.equal(binding.cassette_manifest_sha256, REAL_ESTATE_CASSETTE_REGISTRATION.cassette_manifest_sha256);
  assert.notEqual(binding.cassette_manifest_sha256, selection.cassette_manifest_sha256);
  assert.deepEqual(validatePersistedVerticalBinding(binding), binding);
  assert.throws(() => validatePersistedVerticalBinding({ ...binding, evidence_contract_sha256: '0'.repeat(64) }), new RegExp(BA_VERTICAL_FAILURE_CODES.AUTHORITY_HASH_MISMATCH, 'u'));
});

test('assessment API fails before Redis/profile access for missing or unsupported selection', async () => {
  const oldRedis = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  try {
    for (const vertical_selection of [null, { contract_version: 'ba-vertical-selection-v1', vertical_id: 'loan_originator', cassette_id: 'not-registered', cassette_version: '0', confirmation: 'CUSTOMER_CONFIRMED' }]) {
      const { state, res } = responseHarness();
      await startAssessmentHandler({ method: 'POST', body: { owner_profile_id: 'MM-20260821-CASS0001', vertical_selection, answers: {} } }, res);
      assert.equal(state.statusCode, 400);
      assert.match(state.payload.error_code, /^BA_/u);
      assert.doesNotMatch(state.payload.error, /REDIS|hash|cassette_manifest/iu);
    }
  } finally {
    if (oldRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = oldRedis;
  }
});

test('legacy mapping is exact, non-mutating, and ambiguous records fail closed', () => {
  const record = { version: 'business_assessment_v1_intake', assessment_type: 'real_estate_team', inputs: { answers: { q1: 'unchanged' } } };
  const before = structuredClone(record);
  const binding = buildLegacyRealEstateVerticalBinding(record);
  assert.equal(binding.selection_source, 'LEGACY_EXPLICIT_COMPATIBILITY');
  assert.equal(binding.selected_at, null);
  assert.equal(binding.historical_confirmation_time, 'UNKNOWN');
  assert.deepEqual(record, before);
  for (const invalid of [
    { ...record, version: 'business_assessment_v0' },
    { ...record, assessment_type: 'general_business' },
    { version: 'business_assessment_v1_intake' },
  ]) assert.throws(() => buildLegacyRealEstateVerticalBinding(invalid), new RegExp(BA_VERTICAL_FAILURE_CODES.LEGACY_IDENTITY_AMBIGUOUS, 'u'));
});

test('V3 binds exact cassette authority while accepted V2 Real Estate remains explicitly serveable', () => {
  const binding = buildLegacyRealEstateVerticalBinding({ version: 'business_assessment_v1_intake', assessment_type: 'real_estate_agent' });
  const v2 = buildNewBaRealizationIdentity(identityInput());
  const v3 = buildNewBaRealizationIdentityV3({ ...identityInput(), verticalBinding: binding });
  assert.equal(v3.version, 'new_ba_composite_realization_identity_v3');
  assert.equal(v3.components.vertical_id, 'real_estate');
  assert.equal(v3.components.cassette_id, 'real-estate-cassette-v1');
  assert.equal(v3.components.intake_contract_sha256, REAL_ESTATE_INTAKE_CONTRACT_SHA256);
  assert.equal(v3.components.box_1_projection_contract_sha256, REAL_ESTATE_BOX_1_PROJECTION_CONTRACT_SHA256);
  const current = {
    realization_identity: v2,
    completeness: { status: 'PASS' },
    artifact: { fusion: { proof_sha256: '5'.repeat(64), bos_authority: { artifact_sha256: '2'.repeat(64) } }, business_reality: { frozen_whole_person_authority: { bos_hash: '2'.repeat(64) } } },
  };
  const result = classifyCompatiblePriorRealization({ current, desiredIdentity: v3 });
  assert.equal(result.serveable, true);
  assert.match(result.reason, /v2_real_estate_prior/u);
  const fictionalBinding = buildCustomerConfirmedVerticalBinding({ selection: buildCustomerConfirmedSelection(fictionalRegistration()), registry: createGovernedCassetteRegistry([fictionalRegistration()]), selectedAt: '2026-08-21T12:00:00.000Z' });
  const fictionalV3 = buildNewBaRealizationIdentityV3({ ...identityInput(), verticalBinding: fictionalBinding });
  assert.equal(classifyCompatiblePriorRealization({ current, desiredIdentity: fictionalV3 }).serveable, false);
});

test('Box 1 projection and Subscription context resolve only through exact cassette binding', () => {
  const fiction = fictionalRegistration();
  const registry = createGovernedCassetteRegistry([fiction]);
  const binding = buildCustomerConfirmedVerticalBinding({ selection: buildCustomerConfirmedSelection(fiction), registry, selectedAt: '2026-08-21T12:00:00.000Z' });
  const projected = projectNewBaBox1ThroughCassette({
    verticalBinding: binding,
    sourceViewModel: { marker: 'FICTIONAL_INPUT' },
    bindings: {},
    registry,
    adapters: { 'fictional-box-1-test-v1': ({ sourceViewModel }) => ({ customerViewModel: { marker: sourceViewModel.marker }, internalTrace: {}, plan135: {}, validation: {} }) },
  });
  assert.equal(projected.customerViewModel.marker, 'FICTIONAL_INPUT');
  assert.equal(projected.customerViewModel.vertical.label, 'Fictional Services');
  assert.equal(projected.cassette_projection.adapter_id, 'fictional-box-1-test-v1');
  assert.equal(projected.cassette_projection.projection_contract_sha256, HEX.projection);
  const verticalContext = projectBaCassetteBindingToSubscriptionVerticalContext(binding, { registry });
  assert.equal(verticalContext.vertical_id, 'FICTIONAL_SERVICES');
  assert.equal(verticalContext.provenance, 'GOVERNED_BA_CASSETTE_BINDING');
  assert.throws(() => projectBaCassetteBindingToSubscriptionVerticalContext({ ...binding, cassette_manifest_sha256: '0'.repeat(64) }, { registry }), new RegExp(BA_VERTICAL_FAILURE_CODES.AUTHORITY_HASH_MISMATCH, 'u'));
});

test('fictional injected cassette specializes WBM routing without Real Estate leakage or runtime fork', () => {
  const fiction = fictionalRegistration();
  const registry = createGovernedCassetteRegistry([fiction]);
  const binding = buildCustomerConfirmedVerticalBinding({ selection: buildCustomerConfirmedSelection(fiction), registry, selectedAt: '2026-08-21T12:00:00.000Z' });
  const realLibrary = loadFrozenAuthorityLibrary();
  const section = (id) => ({ section_id: `${id}:mission`, title: 'Mission', normalized_title: 'mission', markdown: `Governed fictional authority ${id}.` });
  const verticalBibles = ['FX-01', 'FX-02'].map((authority_id) => ({ authority_id, title: `Fictional ${authority_id}`, version: 'test', sha256: crypto.createHash('sha256').update(authority_id).digest('hex'), sections: [section(authority_id)] }));
  const library = { ...realLibrary, vertical_bibles: verticalBibles, vertical_interactions: { interactions: [] } };
  const input = {
    requested_at: '2026-08-21T12:00:00.000Z',
    assessment_identity: { business_id: 'fictional-business', assessment_id: 'fictional-assessment', assessment_version: 'fictional-assessment-test-v1', owner_profile_id: 'synthetic-fictional-owner', vertical: fiction.vertical_id, vertical_binding: binding, business_model_identity: 'fictional-services', completion_state: 'COMPLETE', assessed_at: '2026-08-21T11:00:00.000Z' },
    frozen_whole_person_authority: { profile_id: 'synthetic-fictional-owner', bos_version: 'synthetic-bos', bos_hash: 'f'.repeat(64), claims: [{ claim_id: 'WP-FX-01', meaning: 'Synthetic execution-fit context only.', relevant_domains: ['operations'], epistemic_class: 'SUPPORTED_HYPOTHESIS', evidence_refs: [] }] },
    governed_business_evidence: [{ evidence_id: 'FX-E-01', business_id: 'fictional-business', profile_id: 'synthetic-fictional-owner', domain: 'operations', evidence_class: 'OPERATOR_REPORTED', source_ref: 'synthetic://fictional/f1', observed_at: '2026-08-21T11:00:00.000Z', value: 'A fictional operating fact.' }],
    contradictions: [], missing_evidence: [], dynamic_intelligence: [], team_authority: null,
    authorization: { permitted_profile_ids: ['synthetic-fictional-owner'] }, context_hints: { material_domains: ['operations'] },
  };
  const context = assembleWholeBusinessContext(input, { registry, cassetteRegistry: registry, library, contextBudget: { vertical_authorities: 2 } });
  assert.deepEqual(context.selection_receipt.selected_authority_ids.filter((id) => id.startsWith('FX-')), ['FX-01', 'FX-02']);
  assert.equal(context.selection_receipt.cassette_id, fiction.cassette_id);
  assert.doesNotMatch(JSON.stringify(context.selected_vertical_authorities), /\bRE-|real estate|listing|buyer|closing\b/iu);
  assert.deepEqual(fiction.downstream.universal_box_missions, ['WHY', 'FUTURES', 'MOVE', 'PLAN', 'EVIDENCE']);
  assert.equal(PRODUCTION_BA_CASSETTE_REGISTRY.hasVertical(fiction.vertical_id), false);
});
