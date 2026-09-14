import { validateLoanOriginatorTypedEvidence, projectLoanOriginatorEvidenceForWbm } from '../../../src/lib/baVerticalCassettesV1/loanOriginatorEvidence.js';
import { LOAN_ORIGINATOR_CASSETTE_REGISTRATION } from '../../../src/lib/baVerticalCassettesV1/loanOriginatorCassette.js';

// The accepted source determines this finite reference map. It is not a prefix
// exception permitting arbitrary evidence IDs to become person-business proof.
export function loanOriginatorFusionEvidenceMap(source) {
  const evidence = source?.business_evidence;
  if (evidence?.vertical_binding?.vertical_id !== 'loan_originator') return null;
  if (evidence.evidence_sufficiency?.status !== 'PASS') throw new Error('new_ba_lo_fusion_sufficiency_required');
  const allowedKeys = new Set(LOAN_ORIGINATOR_CASSETTE_REGISTRATION.intake_contract.questions.map(item => item.key));
  const keys = Object.keys(evidence.answers || {});
  if (!keys.length || keys.some(key => !allowedKeys.has(key))) throw new Error('new_ba_lo_fusion_mission_scope_invalid');
  const typed = validateLoanOriginatorTypedEvidence(evidence.typed_evidence);
  return new Map([
    ...keys.map((key, index) => [`BE-${String(index + 1).padStart(2, '0')}`, `${source.assessment_id}-lo-mission-${key}`]),
    ...projectLoanOriginatorEvidenceForWbm(typed).map((field, index) => [`LO-TYPED-${String(index + 1).padStart(3, '0')}`, `${source.assessment_id}-lo-field-${field.source_ref.split('.').at(-1)}`]),
  ]);
}
