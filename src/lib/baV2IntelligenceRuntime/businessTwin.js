import { CONTRACTS, FUTURE_ROLES, TWIN_DESTINATIONS } from './constants.js'
import { deepFreeze, hashWithout, invariant, sentence, unique } from './utils.js'
import { validateVerticalBusinessRealityModel } from './vbrm.js'

const DESTINATION_META = Object.freeze({
  YOUR_BUSINESS_NOW: ['YOUR BUSINESS NOW', 'See the actual current business system, its assets, vulnerabilities and honest gaps.', ['VBRM']],
  WHATS_DRIVING_IT: ['WHAT’S DRIVING IT', 'Understand the supported causal mechanisms, alternatives and conditions that would change the view.', ['WBM', 'VBRM']],
  WHERE_ITS_HEADING: ['WHERE IT’S HEADING', 'Compare five conditional trajectories using deterministic relative-support weights, not probabilities.', ['FIVE_FUTURES', 'WBM']],
  WHAT_CHANGES_IT: ['WHAT CHANGES IT', 'See the selected bounded intervention and the mechanism it is designed to test.', ['ONE_MOVE', 'WBM']],
  HOW_YOU_EXECUTE_IT: ['HOW YOU EXECUTE IT', 'Translate the move into prerequisites, ownership, steps, proof and execution adjustments.', ['ONE_MOVE', 'WHOLE_PERSON_EXECUTION']],
  WHY_WE_BELIEVE_IT: ['WHY WE BELIEVE IT', 'Separate what is known, inferred, missing and contradicted, with explicit mind-change conditions.', ['VBRM', 'WBM', 'LINEAGE']],
})

function statement({ id, destination, text, artifact, path, refs, epistemic = 'INFERRED', confidence = 'MODERATE', disclosure = 'WITH_DISCLOSURE' }) {
  return {
    statement_id: id,
    destination_id: destination,
    customer_text: sentence(text),
    source_artifact: artifact,
    source_path: path,
    source_claim_refs: unique(refs),
    epistemic_state: epistemic,
    confidence,
    disclosure_policy: disclosure,
  }
}

function nowStatements(vbrm) {
  const territoryStatements = vbrm.territory_states.map((territory, index) => statement({
    id: `twin-now-territory-${territory.territory_id}`,
    destination: 'YOUR_BUSINESS_NOW',
    text: territory.state_summary,
    artifact: 'VBRM',
    path: `territory_states[${index}].state_summary`,
    refs: territory.claim_refs.length ? territory.claim_refs : (territory.missing_evidence_refs.length ? territory.missing_evidence_refs : [`vbrm-territory-${territory.territory_id}`]),
    epistemic: territory.claim_refs.length ? 'INFERRED' : 'MISSING',
    confidence: territory.confidence,
    disclosure: 'WITH_DISCLOSURE',
  }))
  const claimStatements = vbrm.claims.filter((claim) => claim.customer_visible_eligibility !== 'PROHIBITED').map((claim, index) => statement({
    id: `twin-now-${String(index + 1).padStart(3, '0')}`,
    destination: 'YOUR_BUSINESS_NOW',
    text: claim.statement,
    artifact: 'VBRM',
    path: `claims[${index}].statement`,
    refs: [claim.claim_id],
    epistemic: claim.epistemic_state,
    confidence: claim.confidence,
    disclosure: claim.customer_visible_eligibility === 'ELIGIBLE' ? 'DIRECT' : 'WITH_DISCLOSURE',
  }))
  return [...territoryStatements, ...claimStatements]
}

function whyStatements(wbm) {
  const constraint = statement({
    id: 'twin-why-constraint', destination: 'WHATS_DRIVING_IT', text: wbm.governing_constraint.candidate,
    artifact: 'WBM', path: 'governing_constraint.candidate', refs: [wbm.governing_constraint.constraint_id],
    epistemic: 'INFERRED', confidence: 'MODERATE', disclosure: 'WITH_DISCLOSURE',
  })
  const mechanisms = wbm.causal_model.mechanisms.map((mechanism, index) => statement({
    id: `twin-why-mechanism-${String(index + 1).padStart(2, '0')}`,
    destination: 'WHATS_DRIVING_IT', text: mechanism.underlying_mechanism,
    artifact: 'WBM', path: `causal_model.mechanisms[${index}].underlying_mechanism`, refs: [mechanism.mechanism_id],
    epistemic: 'INFERRED', confidence: mechanism.epistemic_class === 'TENTATIVE' ? 'LOW' : 'MODERATE', disclosure: 'WITH_DISCLOSURE',
  }))
  return [constraint, ...mechanisms]
}

function futureStatements(fiveFutures) {
  invariant(JSON.stringify(fiveFutures.futures.map((future) => future.future_role)) === JSON.stringify(FUTURE_ROLES), 'TWIN_FUTURE_ROLES', 'Five Futures roles or order have drifted.')
  return fiveFutures.futures.map((future, index) => statement({
    id: `twin-future-${future.future_role}`,
    destination: 'WHERE_ITS_HEADING',
    text: `${future.title}. ${future.state_summary} Relative support: ${future.normalized_relative_support_weight} of 100.`,
    artifact: 'FIVE_FUTURES', path: `futures[${index}]`, refs: [future.future_id],
    epistemic: 'CONDITIONAL', confidence: 'NOT_APPLICABLE', disclosure: 'WITH_DISCLOSURE',
  }))
}

function moveStatements(oneMove) {
  return [
    statement({ id: 'twin-move-selected', destination: 'WHAT_CHANGES_IT', text: `${oneMove.title}. ${oneMove.intervention}`, artifact: 'ONE_MOVE', path: 'intervention', refs: [oneMove.one_move_id], epistemic: 'CONDITIONAL', confidence: 'MODERATE' }),
    statement({ id: 'twin-move-why-now', destination: 'WHAT_CHANGES_IT', text: oneMove.why_now, artifact: 'ONE_MOVE', path: 'why_now', refs: [oneMove.one_move_id], epistemic: 'INFERRED', confidence: 'MODERATE' }),
    statement({ id: 'twin-move-success', destination: 'WHAT_CHANGES_IT', text: `Evidence that would support the move: ${oneMove.success_evidence.join(' ')}`, artifact: 'ONE_MOVE', path: 'success_evidence', refs: [oneMove.one_move_id], epistemic: 'CONDITIONAL', confidence: 'NOT_APPLICABLE' }),
    statement({ id: 'twin-move-failure', destination: 'WHAT_CHANGES_IT', text: `Evidence that would challenge the move: ${oneMove.failure_evidence.join(' ')}`, artifact: 'ONE_MOVE', path: 'failure_evidence', refs: [oneMove.one_move_id], epistemic: 'CONDITIONAL', confidence: 'NOT_APPLICABLE' }),
  ]
}

function executionStatements(oneMove) {
  const steps = oneMove.bounded_execution_steps.map((step, index) => statement({
    id: `twin-execute-step-${String(index + 1).padStart(2, '0')}`,
    destination: 'HOW_YOU_EXECUTE_IT', text: typeof step === 'string' ? step : `${step.step_title}. ${step.action}`,
    artifact: 'ONE_MOVE', path: `bounded_execution_steps[${index}]`, refs: [oneMove.one_move_id],
    epistemic: 'CONDITIONAL', confidence: 'NOT_APPLICABLE', disclosure: 'DIRECT',
  }))
  const modifiers = oneMove.whole_person_execution_considerations.map((item, index) => statement({
    id: `twin-execute-adjustment-${String(index + 1).padStart(2, '0')}`,
    destination: 'HOW_YOU_EXECUTE_IT', text: item.execution_adjustment,
    artifact: 'WHOLE_PERSON_EXECUTION', path: `whole_person_execution_considerations[${index}]`, refs: [item.relationship_ref],
    epistemic: 'CONDITIONAL', confidence: 'LOW', disclosure: 'DETAIL_ONLY',
  }))
  return [...steps, ...modifiers]
}

function evidenceStatements(vbrm, wbm) {
  const missing = vbrm.missing_evidence.map((item, index) => statement({
    id: `twin-evidence-missing-${String(index + 1).padStart(2, '0')}`,
    destination: 'WHY_WE_BELIEVE_IT', text: `Still needed: ${item.question}`,
    artifact: 'VBRM', path: `missing_evidence[${index}]`, refs: [item.missing_id], epistemic: 'MISSING', confidence: 'LOW', disclosure: 'DIRECT',
  }))
  const contradictions = vbrm.contradictions.map((item, index) => statement({
    id: `twin-evidence-contradiction-${String(index + 1).padStart(2, '0')}`,
    destination: 'WHY_WE_BELIEVE_IT', text: `Unresolved: ${item.meaning}`,
    artifact: 'VBRM', path: `contradictions[${index}]`, refs: [item.contradiction_id], epistemic: 'CONTRADICTED', confidence: 'LOW', disclosure: 'DIRECT',
  }))
  const mindChange = wbm.epistemic_state.mind_change_conditions.map((text, index) => statement({
    id: `twin-evidence-mind-change-${String(index + 1).padStart(2, '0')}`,
    destination: 'WHY_WE_BELIEVE_IT', text: `What would change this view: ${text}`,
    artifact: 'WBM', path: `epistemic_state.mind_change_conditions[${index}]`, refs: [wbm.governing_constraint.constraint_id], epistemic: 'CONDITIONAL', confidence: 'NOT_APPLICABLE', disclosure: 'DETAIL_ONLY',
  }))
  return [...missing, ...contradictions, ...mindChange]
}

function buildEdges(wbm, statements, territoryRegistry) {
  const nodes = new Set(territoryRegistry.territories.map((item) => `twin-node-${item.territory_id}`))
  return wbm.causal_model.mechanisms.flatMap((mechanism, mechanismIndex) => {
    const territoryIds = unique(mechanism.affected_domains.flatMap((domain) => {
      const match = territoryRegistry.territories.find((territory) => territory.fact_classes.some((item) => item.toLowerCase().includes(domain.replaceAll('_', ' '))))
      return match ? [match.territory_id] : []
    }))
    const route = territoryIds.length >= 2 ? territoryIds : ['RE-T04', 'RE-T05']
    const from = `twin-node-${route[0]}`
    const to = `twin-node-${route[1]}`
    if (!nodes.has(from) || !nodes.has(to)) return []
    const statementRef = statements.find((item) => item.source_claim_refs.includes(mechanism.mechanism_id))?.statement_id
    return [{
      edge_id: `twin-edge-${String(mechanismIndex + 1).padStart(2, '0')}`,
      from_node_id: from,
      to_node_id: to,
      relationship_type: 'SUPPORTED_CAUSAL',
      statement_ref: statementRef,
      magnitude_claimed: false,
    }]
  })
}

export function buildBusinessTwin({ vbrm, acceptedWbm, fiveFutures, oneMove, lineage, territoryRegistry, adapter }) {
  validateVerticalBusinessRealityModel(vbrm)
  invariant(adapter.output.accepted_wbm_hash === acceptedWbm.state_hash, 'TWIN_ADAPTER_WBM', 'Compatibility adapter does not bind the accepted WBM.')
  invariant(oneMove.five_futures_binding.hash === fiveFutures.artifact_hash, 'TWIN_MOVE_FUTURES', 'One Move does not bind Five Futures.')

  const projectionTrace = [
    ...nowStatements(vbrm),
    ...whyStatements(acceptedWbm),
    ...futureStatements(fiveFutures),
    ...moveStatements(oneMove),
    ...executionStatements(oneMove),
    ...evidenceStatements(vbrm, acceptedWbm),
    statement({ id: 'twin-living-map-explanation', destination: 'WHY_WE_BELIEVE_IT', text: 'A Living Map would revisit this frozen baseline only when governed new evidence creates a validated state transition.', artifact: 'VBRM', path: 'state_lineage', refs: [vbrm.state_hash], epistemic: 'CONDITIONAL', confidence: 'NOT_APPLICABLE', disclosure: 'DIRECT' }),
  ]
  const byDestination = Object.fromEntries(TWIN_DESTINATIONS.map((id) => [id, projectionTrace.filter((statement) => statement.destination_id === id)]))
  invariant(Object.values(byDestination).every((items) => items.length > 0), 'TWIN_DESTINATION_EMPTY', 'Every Business Twin destination requires governed statements.')

  const domainNodes = territoryRegistry.territories.map((territory) => {
    const state = vbrm.territory_states.find((item) => item.territory_id === territory.territory_id)
    const refs = [`twin-now-territory-${territory.territory_id}`]
    invariant(refs.length > 0, 'TWIN_NODE_EMPTY', `Territory ${territory.territory_id} has no customer-visible state.`)
    return {
      node_id: `twin-node-${territory.territory_id}`,
      territory_id: territory.territory_id,
      mission: territory.mission,
      statement_refs: refs,
      state_label: state.state_summary,
      confidence: state.confidence,
      customer_visible: true,
    }
  })

  const destinations = TWIN_DESTINATIONS.map((id, index) => ({
    destination_id: id,
    order: index + 1,
    name: DESTINATION_META[id][0],
    mission: DESTINATION_META[id][1],
    allowed_source_layers: DESTINATION_META[id][2],
    statement_refs: byDestination[id].map((item) => item.statement_id),
    disclosure_refs: byDestination[id].filter((item) => item.disclosure_policy !== 'DIRECT').map((item) => item.statement_id),
  }))

  const twin = {
    contract_id: CONTRACTS.twin,
    contract_version: '1.0.0',
    schema_version: '1.0.0',
    identity: {
      business_id: vbrm.identity.business_id,
      assessment_id: vbrm.identity.assessment_id,
      owner_profile_id: vbrm.identity.owner_profile_id,
      vertical: vbrm.identity.vertical,
      frozen_state: true,
    },
    artifact_bindings: {
      vbrm: { version: vbrm.contract_version, hash: vbrm.state_hash },
      wbm: { version: acceptedWbm.contract_version, hash: acceptedWbm.state_hash },
      five_futures: { version: fiveFutures.contract_version, hash: fiveFutures.artifact_hash },
      one_move: { version: oneMove.contract_version, hash: oneMove.artifact_hash },
      lineage_hash: lineage.cross_artifact_lineage_hash,
    },
    orientation: {
      where_you_are_statement_refs: domainNodes.flatMap((node) => node.statement_refs.slice(0, 1)),
      what_matters_now_statement_refs: ['twin-why-constraint', 'twin-move-selected'],
      where_you_are_going_statement_refs: byDestination.WHERE_ITS_HEADING.map((item) => item.statement_id),
    },
    domain_nodes: domainNodes,
    relationship_edges: buildEdges(acceptedWbm, projectionTrace, territoryRegistry),
    destinations,
    projection_trace: projectionTrace,
    living_map_transition: {
      transition_count: 1,
      mode: 'EXPLANATORY_ONLY',
      live_capability_claimed: false,
      event_socket_version: '1.0.0',
      explanation_statement_ref: 'twin-living-map-explanation',
    },
    runtime_boundaries: {
      provider_calls: false,
      network_calls: false,
      customer_mutation: false,
      subscription_active: false,
      whole_person_business_cause_prohibited: true,
    },
    twin_lineage: {
      twin_version: 1,
      previous_twin_hash: null,
      created_at: acceptedWbm.state_lineage.created_at,
    },
  }
  twin.twin_hash = hashWithout(twin, ['twin_hash'])
  validateBusinessTwin(twin)
  return deepFreeze(twin)
}

export function validateBusinessTwin(twin) {
  invariant(twin?.contract_id === CONTRACTS.twin, 'TWIN_CONTRACT', 'Business Twin contract is invalid.')
  invariant(JSON.stringify(twin.destinations.map((item) => item.destination_id)) === JSON.stringify(TWIN_DESTINATIONS), 'TWIN_DESTINATIONS', 'Business Twin destinations or order have drifted.')
  invariant(twin.domain_nodes.length === 8, 'TWIN_TERRITORIES', 'Business Twin requires all eight vertical territories.')
  invariant(twin.living_map_transition.transition_count === 1 && twin.living_map_transition.live_capability_claimed === false, 'TWIN_LIVING_MAP', 'Living Map boundary is invalid.')
  invariant(Object.values(twin.runtime_boundaries).every((value) => value === false || value === true), 'TWIN_RUNTIME_BOUNDARY', 'Business Twin runtime boundaries are incomplete.')
  invariant(twin.runtime_boundaries.provider_calls === false && twin.runtime_boundaries.network_calls === false && twin.runtime_boundaries.customer_mutation === false, 'TWIN_SIDE_EFFECT', 'Frozen Business Twin cannot call providers, use the network or mutate customer state.')
  invariant(twin.runtime_boundaries.whole_person_business_cause_prohibited === true, 'TWIN_WP_BOUNDARY', 'Whole-Person business-cause prohibition is required.')
  invariant(twin.twin_hash === hashWithout(twin, ['twin_hash']), 'TWIN_HASH', 'Business Twin hash replay failed.')
  return true
}

export function projectCustomerSafeBusinessTwin(twin) {
  validateBusinessTwin(twin)
  const traceById = new Map(twin.projection_trace.map((item) => [item.statement_id, item]))
  const view = {
    orientation: Object.fromEntries(Object.entries(twin.orientation).map(([key, refs]) => [key, refs.map((ref) => traceById.get(ref).customer_text)])),
    business_territories: twin.domain_nodes.map((node) => ({
      territory: ({
        'RE-T01': 'Relationship / Database Engine',
        'RE-T02': 'Opportunity / Lead Generation',
        'RE-T03': 'Follow-Up / Conversion',
        'RE-T04': 'Operating / Systems',
        'RE-T05': 'Execution / Accountability',
        'RE-T06': 'Economics / Financial',
        'RE-T07': 'Capacity / Team / Leverage',
        'RE-T08': 'Direction / Business Model',
      })[node.territory_id],
      state: node.state_label,
      confidence: node.confidence,
      statements: node.statement_refs.map((ref) => traceById.get(ref).customer_text),
    })),
    destinations: twin.destinations.map((destination) => ({
      id: destination.destination_id,
      name: destination.name,
      mission: destination.mission,
      statements: destination.statement_refs.map((ref) => {
        const source = traceById.get(ref)
        return { text: source.customer_text, epistemic_state: source.epistemic_state, disclosure_policy: source.disclosure_policy }
      }),
    })),
    living_map_transition: {
      mode: twin.living_map_transition.mode,
      live_capability_claimed: false,
      explanation: traceById.get(twin.living_map_transition.explanation_statement_ref).customer_text,
    },
  }
  const serialized = JSON.stringify(view)
  invariant(!/\b(?:mm|ba)-20\d{6}-[a-z0-9]+\b/i.test(serialized), 'CUSTOMER_ID_LEAK', 'Customer-safe Business Twin leaked a technical identity.')
  invariant(!/[a-f0-9]{64}/i.test(serialized), 'CUSTOMER_HASH_LEAK', 'Customer-safe Business Twin leaked a hash.')
  return deepFreeze(view)
}
