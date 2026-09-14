import { invariant } from './utils.js'

// The caller supplies this scope from the accepted cassette, never from a display label.
export function isLoanOriginatorProjection(source, bindings = {}) {
  const requested = bindings.verticalId
  const bound = source?.verticalBinding?.vertical_id
  if (requested !== 'loan_originator' && bound !== 'loan_originator') return false
  invariant(requested === 'loan_originator' && bound === requested, 'BA_PD_LO_SCOPE_MISMATCH')
  invariant(source?.loanOriginator?.typedEvidence?.fields, 'BA_PD_LO_TYPED_EVIDENCE_MISSING')
  const authorities = bindings.verticalAuthorityRefs
  invariant(Array.isArray(authorities) && authorities.length > 0 && authorities.every((id) =>
    typeof id === 'string' && id.startsWith('loan-originator-intelligence-module-')),
  'BA_PD_LO_AUTHORITY_SCOPE_MISMATCH')
  return true
}
