import { CONTRACTS, E_TO_P_DIMENSIONS, E_TO_P_STATES } from './constants.js'
import { deepFreeze, invariant, unique } from './utils.js'

const DEFAULT_MEANINGS = Object.freeze({
  MODELS: 'The explicit operating model required to produce the intended result.',
  SYSTEMS: 'The repeatable process, ownership and feedback loop supporting execution.',
  TOOLS: 'The governed tools and data actually used by the system.',
  ACCOUNTABILITY: 'The ownership, inspection and correction that keep execution purposeful.',
  COACHING: 'The applied outside challenge that changes decisions or execution.',
  ONGOING_EDUCATION: 'The skill-building tied to a current capability gap and applied in practice.',
})

export function buildUniversalEToPState({ evidenceByDimension = {}, requiredCapabilities = {}, verticalMeanings = {}, materialDimensions = E_TO_P_DIMENSIONS } = {}) {
  const material = new Set(materialDimensions)
  const states = E_TO_P_DIMENSIONS.map((dimension) => {
    const evidence = evidenceByDimension[dimension] || {}
    const state = material.has(dimension) ? (evidence.state || 'MISSING') : 'NOT_APPLICABLE'
    invariant(E_TO_P_STATES.includes(state), 'E_TO_P_STATE', `Invalid E to P state for ${dimension}.`)
    const evidenceRefs = unique(evidence.evidence_refs)
    const missingEvidenceRefs = unique(evidence.missing_evidence_refs)
    if (['PURPOSEFUL', 'TRANSITIONAL', 'ENTREPRENEURIAL', 'CONFLICTED'].includes(state)) {
      invariant(evidenceRefs.length > 0, 'E_TO_P_EVIDENCE', `${dimension} cannot be ${state} without evidence.`)
    }
    if (state === 'MISSING') invariant(missingEvidenceRefs.length > 0, 'E_TO_P_MISSING_REF', `${dimension} requires an explicit missing-evidence reference.`)
    const confidence = evidence.confidence || (evidenceRefs.length ? 'MODERATE' : 'LOW')
    return {
      dimension,
      state,
      evidence_refs: evidenceRefs,
      confidence,
      rationale: evidence.rationale || `${dimension} remains ${state.toLowerCase().replaceAll('_', ' ')} under the governed evidence.`,
      missing_evidence_refs: missingEvidenceRefs,
    }
  })

  const details = states.map((state) => ({
    dimension: state.dimension,
    current_state: state.rationale,
    required_capability: requiredCapabilities[state.dimension] || DEFAULT_MEANINGS[state.dimension],
    gap: state.state === 'PURPOSEFUL' || state.state === 'NOT_APPLICABLE'
      ? null
      : `The governed evidence does not yet prove purposeful ${state.dimension.toLowerCase().replaceAll('_', ' ')}.`,
    confidence: state.confidence,
    evidence_refs: state.evidence_refs,
    vertical_meaning: verticalMeanings[state.dimension] || DEFAULT_MEANINGS[state.dimension],
    constraint_relevance: 'Evaluate only when this capability materially changes the governing business mechanism.',
    trajectory_relevance: 'Use as a condition or indicator; never convert the state into a calibrated probability.',
    intervention_relevance: 'May shape execution prerequisites, ownership, cadence or proof signals.',
  }))

  return deepFreeze({
    contract_id: CONTRACTS.eToP,
    contract_version: '1.0.0',
    schema_version: '1.0.0',
    states,
    details,
    aggregate_score_prohibited: true,
  })
}
