import { E_TO_P_DIMENSIONS, UNIVERSAL_DOCTRINE } from './constants.js'
import { deepFreeze, invariant } from './utils.js'

export function validateUniversalDoctrine(doctrine = UNIVERSAL_DOCTRINE) {
  invariant(doctrine.contract_id === 'more-universal-business-doctrine-runtime-v1', 'DOCTRINE_ID', 'Universal doctrine contract ID is invalid.')
  invariant(Array.isArray(doctrine.principles) && doctrine.principles.length >= 6, 'DOCTRINE_DEPTH', 'Universal doctrine principles are incomplete.')
  invariant(doctrine.principles.some((item) => item.includes('Whole-Person')), 'DOCTRINE_WP_BOUNDARY', 'Whole-Person boundary is missing.')
  invariant(doctrine.prohibited_shortcuts.includes('HEURISTIC_AS_FACT'), 'DOCTRINE_HEURISTIC_BOUNDARY', 'Heuristic boundary is missing.')
  return true
}

export function createUniversalDoctrineRuntime() {
  validateUniversalDoctrine()
  return deepFreeze({
    ...UNIVERSAL_DOCTRINE,
    e_to_p_dimensions: [...E_TO_P_DIMENSIONS],
    evaluateClaim({ epistemic_class, evidence_refs = [], heuristic = false, business_cause_established_by_personality = false }) {
      invariant(!heuristic, 'HEURISTIC_AS_FACT', 'Founder or cassette heuristics cannot be admitted as customer facts.')
      invariant(!business_cause_established_by_personality, 'PERSONALITY_AS_CAUSE', 'Whole-Person intelligence cannot establish a business cause.')
      invariant(['KNOWN', 'INFERRED', 'MISSING', 'CONTRADICTED'].includes(epistemic_class), 'EPISTEMIC_CLASS', 'Claim epistemic class is invalid.')
      if (epistemic_class === 'KNOWN') invariant(evidence_refs.length > 0, 'KNOWN_WITHOUT_EVIDENCE', 'A known claim requires governed evidence.')
      return true
    },
  })
}

