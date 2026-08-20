import { CONTRACTS, LENS_IDS } from './constants.js'
import { deepFreeze, invariant, unique } from './utils.js'

const SIGNAL_STATES = new Set(['SUFFICIENT', 'INSUFFICIENT', 'CONSTRAINED', 'SUPPORTED', 'UNKNOWN', 'CONTRADICTED'])

export function resolveGoalRelativeGoverningFork({ signals = {} }) {
  for (const [name, signal] of Object.entries(signals)) {
    invariant(SIGNAL_STATES.has(signal.state), 'SIGNAL_STATE', `Invalid governed signal state for ${name}.`)
  }
  const hasGoal = Boolean(signals.goal?.evidence_refs?.length)
  const opportunity = signals.opportunity_flow?.state || 'UNKNOWN'
  const conversion = signals.conversion?.state || 'UNKNOWN'
  const capacity = signals.capacity?.state || 'UNKNOWN'
  const q1 = signals.operator_problem_label?.state || 'UNKNOWN'

  let fork = 'UNCERTAIN_OR_CONTRADICTORY'
  if (hasGoal && opportunity === 'INSUFFICIENT' && !['CONTRADICTED', 'UNKNOWN'].includes(conversion)) {
    fork = 'INSUFFICIENT_OPPORTUNITY_RELATIVE_TO_GOAL'
  } else if (hasGoal && opportunity === 'SUFFICIENT' && ['CONSTRAINED', 'INSUFFICIENT'].includes(conversion) && !['CONSTRAINED', 'INSUFFICIENT'].includes(capacity)) {
    fork = 'SUFFICIENT_OPPORTUNITY_INVESTIGATE_CONVERSION'
  } else if (hasGoal && opportunity === 'SUFFICIENT' && ['CONSTRAINED', 'INSUFFICIENT'].includes(capacity)) {
    fork = 'SUFFICIENT_OPPORTUNITY_INVESTIGATE_SCALE'
  }

  return deepFreeze({
    fork,
    q1_used_as_business_report_only: true,
    q1_determined_diagnosis: false,
    crosschecked_signal_names: unique(['goal', 'opportunity_flow', 'conversion', 'capacity', 'operator_problem_label'].filter((key) => signals[key])),
    evidence_refs: unique(Object.values(signals).flatMap((signal) => signal.evidence_refs || [])),
    rationale: fork === 'INSUFFICIENT_OPPORTUNITY_RELATIVE_TO_GOAL'
      ? 'Goal-relative evidence supports an opportunity-sufficiency focus after cross-checking conversion and capacity.'
      : fork === 'SUFFICIENT_OPPORTUNITY_INVESTIGATE_CONVERSION'
        ? 'Goal-relative evidence supports a conversion, follow-up or stage-flow focus after opportunity sufficiency is established and capacity is not the leading constraint.'
      : fork === 'SUFFICIENT_OPPORTUNITY_INVESTIGATE_SCALE'
        ? 'Goal-relative evidence supports a capacity, ownership or leverage focus after opportunity sufficiency is established.'
        : `The governed evidence does not separate opportunity, conversion and capacity cleanly; the operator label (${q1.toLowerCase()}) remains one report, not the diagnosis.`,
  })
}

function statusForLens(lensId, context) {
  const active = new Set(context.activeTerritoryIds)
  if (lensId === 'RE-DL-01' || lensId === 'RE-DL-02' || lensId === 'RE-DL-09' || lensId === 'RE-DL-10') return 'EXAMINED'
  const required = {
    'RE-DL-03': ['RE-T01'],
    'RE-DL-04': ['RE-T02'],
    'RE-DL-05': ['RE-T03'],
    'RE-DL-06': ['RE-T04', 'RE-T05'],
    'RE-DL-07': ['RE-T06'],
    'RE-DL-08': ['RE-T07', 'RE-T08'],
  }[lensId] || []
  return required.some((territoryId) => active.has(territoryId)) ? 'EXAMINED' : 'IMMATERIAL_WITH_REASON'
}

export function runDiagnosticLenses({ lensRegistry, cassetteRuntime, signals, contradictions = [], missingEvidence = [], governingConstraint = null, downstreamReady = false }) {
  invariant(lensRegistry?.lenses?.length === 10, 'LENS_REGISTRY', 'A complete ten-lens registry is required.')
  const governingFork = resolveGoalRelativeGoverningFork({ signals })
  const activeTerritoryIds = cassetteRuntime.territory_routing.filter((route) => route.evidence_refs.length).map((route) => route.territory_id)

  const receipts = lensRegistry.lenses.map((lens, index) => {
    let status = statusForLens(lens.lens_id, { activeTerritoryIds })
    if (lens.lens_id === 'RE-DL-10' && !downstreamReady) status = 'BLOCKED_BY_MISSING_EVIDENCE'
    return {
      lens_id: lens.lens_id,
      lens_order: lens.lens_order,
      status,
      territory_refs: lens.territories_examined.filter((id) => activeTerritoryIds.includes(id)),
      evidence_refs: unique(cassetteRuntime.territory_routing.filter((route) => lens.territories_examined.includes(route.territory_id)).flatMap((route) => route.evidence_refs)),
      claim_refs: [],
      missing_evidence_refs: unique(missingEvidence.map((item) => item.missing_id || item.missing_ref)),
      contradiction_refs: unique(contradictions.map((item) => item.contradiction_id || item.contradiction_ref)),
      heuristic_refs: lens.heuristics_available || [],
      whole_person_relationship_refs: [],
      result_summary: lens.lens_id === 'RE-DL-01'
        ? governingFork.rationale
        : lens.lens_id === 'RE-DL-09'
          ? (governingConstraint?.meaning || 'The governing mechanism remains evidence-bound and conditional.')
          : lens.mission,
      confidence: status === 'IMMATERIAL_WITH_REASON' ? 'NOT_APPLICABLE' : (missingEvidence.length ? 'MODERATE' : 'HIGH'),
      customer_visible_eligibility: status === 'EXAMINED' ? 'ELIGIBLE_WITH_DISCLOSURE' : 'INTERNAL_ONLY',
      next_lens_ids: index === lensRegistry.lenses.length - 1 ? [] : (lens.possible_next_lenses || []).filter((id) => LENS_IDS.includes(id)),
      branching_reason: status === 'IMMATERIAL_WITH_REASON'
        ? 'The governed evidence did not make this lens material for the current state.'
        : `The lens was selected from the ${governingFork.fork} branch and its material territories.`,
    }
  })

  return deepFreeze({
    contract_id: CONTRACTS.lenses,
    contract_version: '1.0.0',
    schema_version: '1.0.0',
    governing_fork: governingFork,
    receipts,
    examined_lenses: receipts.filter((item) => item.status === 'EXAMINED').map((item) => item.lens_id),
    blocked_lenses: receipts.filter((item) => item.status.startsWith('BLOCKED')).map((item) => item.lens_id),
    rigid_tree_prohibited: true,
  })
}
