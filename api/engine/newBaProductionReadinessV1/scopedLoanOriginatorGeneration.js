import { fileURLToPath } from 'node:url';
import { createGovernedCassetteRegistry, buildCustomerConfirmedSelection } from '../../../src/lib/baVerticalCassettesV1/registry.js';
import { LOAN_ORIGINATOR_CASSETTE_REGISTRATION } from '../../../src/lib/baVerticalCassettesV1/loanOriginatorCassette.js';
import {
  assertLoanOriginatorPrivacyBoundary,
  normalizeLoanOriginatorTypedEvidence,
  validateLoanOriginatorTypedEvidence,
} from '../../../src/lib/baVerticalCassettesV1/loanOriginatorEvidence.js';
import { buildCustomerConfirmedVerticalBinding } from '../../business-assessment/verticalBinding.js';
import { loadFrozenAuthorityLibrary } from '../../../src/lib/wholeBusinessModelV1/authorityLibrary.js';
import { bindFrozenLoanOriginatorAuthorityLibrary } from '../../../src/lib/wholeBusinessModelV1/loanOriginatorAuthorityLibrary.js';
import { createLoanOriginatorProjectionV1 } from './loanOriginatorProjectionAdapter.js';
import { sha256Stable, normalizeProfileId, normalizeAssessmentId } from './stable.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value); Object.values(value).forEach(deepFreeze); return value;
}

const LO = 'loan-originator-intelligence-module-';
const MACHINE = `${LO}business-machine-v1`;
const SYSTEMS = `${LO}systems-capacity-constraints-v1`;
const EVIDENCE = `${LO}context-boundaries-evidence-v1`;
const COACHING = `${LO}translation-coaching-v1`;

// This creates a scoped dependency bundle. It does not alter the public registry.
export function createScopedLoanOriginatorGenerationContext({
  libraryRoot = fileURLToPath(new URL('../../../docs/ba-intelligence-authority-library-v1', import.meta.url)),
  loAuthorityRoot = fileURLToPath(new URL('../../../docs/lo-cassette-2-final-canonical-authority-v1', import.meta.url)),
} = {}) {
  const registration = LOAN_ORIGINATOR_CASSETTE_REGISTRATION;
  const cassetteRegistry = createGovernedCassetteRegistry([registration]);
  const library = bindFrozenLoanOriginatorAuthorityLibrary(loadFrozenAuthorityLibrary({ libraryRoot }), registration, { loAuthorityRoot });
  const authorityRouteByConstraint = deepFreeze({
    demand: ['UB-04', 'UB-06', 'UB-03', MACHINE, EVIDENCE],
    conversion: ['UB-06', 'UB-12', 'UB-03', MACHINE, EVIDENCE],
    capacity: ['UB-03', 'UB-08', 'UB-10', SYSTEMS, EVIDENCE],
    economics: ['UB-01', 'UB-02', 'UB-11', MACHINE, EVIDENCE],
    role: ['UB-08', 'UB-09', 'UB-10', SYSTEMS, COACHING, EVIDENCE],
    team: ['UB-08', 'UB-09', 'UB-10', SYSTEMS, EVIDENCE],
    system: ['UB-03', 'UB-08', 'UB-12', SYSTEMS, COACHING, EVIDENCE],
    market: ['UB-01', 'UB-11', 'UB-12', MACHINE, EVIDENCE],
    mixed: ['UB-03', 'UB-08', 'UB-12', SYSTEMS, MACHINE, EVIDENCE],
    insufficient_evidence: ['UB-03', 'UB-12', 'UB-11', EVIDENCE, MACHINE],
  });
  const scriptSelection = deepFreeze({
    contract_id: 'one-move-cassette-script-selection-v1', vertical_id: 'loan_originator',
    mode: 'NO_APPROVED_SCRIPT_LIBRARY', authority_root_hash: registration.cassette_manifest_sha256,
    reason: 'This scoped LO candidate has no approved Loan Originator script catalog. Use its governed business and coaching authorities without substituting Real Estate scripts.',
  });
  const oneMoveContextOptions = deepFreeze({ authorityRouteByConstraint, scriptSelection });
  const core = deepFreeze({
    contract_id: 'scoped-lo-native-generation-context-v1', vertical_id: 'loan_originator',
    authority_root_sha256: registration.cassette_manifest_sha256,
    authority_hashes: Object.fromEntries(library.vertical_bibles.map(item => [item.authority_id, item.sha256])),
    authority_selection_hashes: Object.fromEntries(library.vertical_bibles.map(item => [item.authority_id, item.section_selection_sha256])),
    one_move_selection: {
      authority_route_by_constraint: authorityRouteByConstraint,
      script_selection: scriptSelection,
    },
  });
  return Object.freeze({
    cassetteRegistry, library,
    projectionAdapters: Object.freeze({ 'loan-originator-box-1-projection-v1': createLoanOriginatorProjectionV1 }),
    oneMoveContextOptions,
    generationContext: deepFreeze({ ...core, sha256: sha256Stable(core) }),
  });
}

export function assertScopedLoanOriginatorGenerationContext({ cassetteRegistry, library, oneMoveContextOptions, generationContext } = {}) {
  const registration = cassetteRegistry?.resolveVertical('loan_originator');
  const expected = {
    contract_id: 'scoped-lo-native-generation-context-v1', vertical_id: 'loan_originator',
    authority_root_sha256: registration?.cassette_manifest_sha256,
    authority_hashes: Object.fromEntries((library?.vertical_bibles || []).map(item => [item.authority_id, item.sha256])),
    authority_selection_hashes: Object.fromEntries((library?.vertical_bibles || []).map(item => [item.authority_id, item.section_selection_sha256])),
    one_move_selection: {
      authority_route_by_constraint: oneMoveContextOptions?.authorityRouteByConstraint,
      script_selection: oneMoveContextOptions?.scriptSelection,
    },
  };
  if (library?.vertical_id !== 'loan_originator'
    || library.vertical_authority_root_sha256 !== expected.authority_root_sha256
    || library.real_estate_bibles?.length !== 0
    || !library.vertical_bibles?.length
    || library.vertical_bibles.some(item => !item.authority_id.startsWith('loan-originator-intelligence-module-'))
    || generationContext?.sha256 !== sha256Stable(expected)
    || sha256Stable(generationContext) !== sha256Stable({ ...expected, sha256: sha256Stable(expected) })) {
    throw new Error('scoped_lo_native_context_custody_mismatch');
  }
  return generationContext;
}

// The caller supplies the already frozen native mapping and genuinely issued local identity.
// Neither a prepared record nor synthetic confirmation is a generated or live account.
export function prepareScopedLoanOriginatorAssessment({ profileId, assessmentId, createdAt, nativeInputs }, context) {
  normalizeProfileId(profileId); normalizeAssessmentId(assessmentId);
  assertScopedLoanOriginatorGenerationContext(context);
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('scoped_lo_preparation_timestamp_invalid');
  if (!context?.generationContext?.sha256 || !context?.cassetteRegistry) throw new Error('scoped_lo_generation_context_required');
  if (!nativeInputs?.answers || !nativeInputs.typed_evidence || !nativeInputs.question_states) throw new Error('scoped_lo_native_inputs_required');
  assertLoanOriginatorPrivacyBoundary({ answers: nativeInputs.answers, typed_evidence: nativeInputs.typed_evidence }, {
    path: 'business_assessment.inputs',
  });
  const registration = context.cassetteRegistry.resolveVertical('loan_originator');
  const keys = registration.intake_contract.questions.map(item => item.key);
  if (Object.keys(nativeInputs.answers).some(key => !keys.includes(key))) throw new Error('scoped_lo_unknown_mission');
  const typedEvidence = validateLoanOriginatorTypedEvidence(normalizeLoanOriginatorTypedEvidence({
    typedEvidence: nativeInputs.typed_evidence, requestedQuestionStates: nativeInputs.question_states,
    assessmentId, capturedAt: createdAt,
  }));
  const verticalBinding = buildCustomerConfirmedVerticalBinding({
    selection: buildCustomerConfirmedSelection(registration), selectedAt: createdAt, registry: context.cassetteRegistry,
  });
  return deepFreeze({
    version: 'business_assessment_v1_intake', assessment_id: assessmentId,
    owner_profile_id: profileId, status: 'intake_saved', assessment_type: 'loan_originator',
    created_at: createdAt, submitted_at: null, completed_at: null,
    vertical_binding: verticalBinding, generation_context: context.generationContext,
    inputs: { answers: structuredClone(nativeInputs.answers), question_states: typedEvidence.question_states, typed_evidence: typedEvidence },
  });
}
