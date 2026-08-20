import {
  CONTRACTS,
  DOMAIN_TERRITORY_ROUTING,
  E_TO_P_DIMENSIONS,
  TERRITORY_IDS,
  WBM_EPISTEMIC_MAP,
} from './constants.js'
import { canonicalHash, deepFreeze, hashWithout, invariant, sentence, unique } from './utils.js'

function domainTerritories(domainId) {
  return DOMAIN_TERRITORY_ROUTING[domainId] || ['RE-T08']
}

function mapEpistemic(epistemicClass) {
  return WBM_EPISTEMIC_MAP[epistemicClass] || 'INFERRED'
}

function confidenceFor(epistemicClass) {
  if (epistemicClass === 'KNOWN' || epistemicClass === 'STRONGLY_SUPPORTED') return 'HIGH'
  if (epistemicClass === 'SUPPORTED_HYPOTHESIS') return 'MODERATE'
  return 'LOW'
}

function eligibilityFor(epistemicState) {
  if (epistemicState === 'KNOWN') return 'ELIGIBLE'
  if (epistemicState === 'INFERRED' || epistemicState === 'MISSING' || epistemicState === 'CONTRADICTED') return 'ELIGIBLE_WITH_DISCLOSURE'
  return 'INTERNAL_ONLY'
}

function sourceClassFor(epistemicClass) {
  return epistemicClass === 'KNOWN' ? 'CUSTOMER_STATED' : epistemicClass === 'INSUFFICIENT_EVIDENCE' ? 'UNKNOWN' : 'SUPPORTED_HYPOTHESIS'
}

function sourceNatureFor(epistemicClass) {
  return epistemicClass === 'KNOWN' ? 'CUSTOMER_REPORTED' : epistemicClass === 'INSUFFICIENT_EVIDENCE' ? 'ABSENT' : 'FRONTIER_INTERPRETATION'
}

function projectClaim(source, domainId, claimType = null, authorityRefs = []) {
  const epistemic = mapEpistemic(source.epistemic_class)
  const primary = domainTerritories(domainId)[0]
  return {
    claim_id: source.claim_id,
    claim_type: claimType || (epistemic === 'KNOWN' ? 'FACT' : 'SUPPORTED_HYPOTHESIS'),
    primary_territory_id: primary,
    statement: sentence(source.meaning),
    epistemic_state: epistemic,
    source_class: sourceClassFor(source.epistemic_class),
    source_nature: sourceNatureFor(source.epistemic_class),
    evidence_refs: unique(source.evidence_refs),
    authority_refs: unique(authorityRefs),
    derivation: null,
    confidence: confidenceFor(source.epistemic_class),
    cross_territory_refs: unique(domainTerritories(domainId).slice(1)),
    alternatives: unique(source.confounds),
    falsifier: source.falsifier || null,
    customer_visible_eligibility: eligibilityFor(epistemic),
  }
}

function inferAssetDomain(asset, wbm) {
  const evidence = new Set(asset.evidence_refs || [])
  const scored = wbm.domain_states.map((domain) => ({
    domain_id: domain.domain_id,
    score: domain.claims.flatMap((claim) => claim.evidence_refs || []).filter((ref) => evidence.has(ref)).length,
  })).sort((a, b) => b.score - a.score || a.domain_id.localeCompare(b.domain_id))
  return scored[0]?.score ? scored[0].domain_id : 'stage'
}

function realitySummary(summary, claimRefs, missingRefs, contradictionRefs, confidence = 'MODERATE') {
  return {
    summary: sentence(summary),
    claim_refs: unique(claimRefs),
    confidence,
    missing_evidence_refs: unique(missingRefs),
    contradiction_refs: unique(contradictionRefs),
  }
}

function mapMissing(wbm) {
  return (wbm.epistemic_state?.missing_evidence || []).map((item) => ({
    missing_id: item.missing_id,
    territory_id: domainTerritories(item.domain)[0],
    question: item.question,
    decision_impact: item.decision_impact,
  }))
}

function mapContradictions(wbm) {
  return (wbm.epistemic_state?.contradictions || []).map((item) => ({
    contradiction_id: item.contradiction_id,
    claim_refs: unique(item.evidence_refs),
    status: item.status,
    meaning: item.meaning,
    decision_impact: 'This contradiction prevents unsupported reconciliation and can change economic or causal interpretation.',
  }))
}

function mapLensTraversal(lensRuntime, claims) {
  const claimIds = claims.map((claim) => claim.claim_id)
  return lensRuntime.receipts.map((receipt, index) => ({
    lens_id: receipt.lens_id,
    lens_order: receipt.lens_order,
    status: receipt.status,
    evidence_refs_examined: receipt.evidence_refs,
    territories_activated: receipt.territory_refs,
    supported_interpretation_refs: receipt.status === 'EXAMINED' ? claimIds.filter((id) => receipt.territory_refs.some((territoryId) => claims.find((claim) => claim.claim_id === id)?.primary_territory_id === territoryId)) : [],
    challenged_interpretation_refs: [],
    contradiction_refs: receipt.contradiction_refs,
    confidence_delta: receipt.status === 'EXAMINED' ? 'INCREASED' : receipt.status === 'BLOCKED_BY_MISSING_EVIDENCE' ? 'UNRESOLVED' : 'UNCHANGED',
    next_lens_id: lensRuntime.receipts[index + 1]?.lens_id || null,
    focus_or_stop_result: receipt.result_summary,
  }))
}

function validateAuthorityBinding(binding) {
  invariant(binding?.universal_doctrine_version === '1.0.0', 'AUTHORITY_DOCTRINE', 'Universal doctrine binding is invalid.')
  invariant(Object.keys(binding.universal_authority_hashes || {}).length === 12, 'UNIVERSAL_AUTHORITY_COUNT', 'All twelve Universal authorities are required.')
  invariant(Object.keys(binding.vertical_authority_hashes || {}).length === 16, 'VERTICAL_AUTHORITY_COUNT', 'All sixteen Real Estate authorities are required.')
  invariant(/^[a-f0-9]{64}$/.test(binding.territory_registry_hash || ''), 'TERRITORY_REGISTRY_HASH', 'Territory registry hash is invalid.')
  invariant(/^[a-f0-9]{64}$/.test(binding.diagnostic_lens_registry_hash || ''), 'LENS_REGISTRY_HASH', 'Lens registry hash is invalid.')
}

export function buildVerticalBusinessRealityModel({ acceptedWbm, authorityBinding, cassetteRuntime, lensRuntime, eToPRuntime, evidenceManifest }) {
  invariant(acceptedWbm?.contract_id === 'more-whole-business-model-v1', 'WBM_CONTRACT', 'An accepted frozen WBM V1 is required for compatibility projection.')
  invariant(acceptedWbm.validation_receipt?.status === 'PASS', 'WBM_ACCEPTANCE', 'The WBM must already be accepted and validated.')
  validateAuthorityBinding(authorityBinding)
  invariant(evidenceManifest.assessment_id === acceptedWbm.assessment_identity.assessment_id, 'ASSESSMENT_BINDING', 'Evidence manifest and WBM assessment identity do not match.')
  invariant(evidenceManifest.profile_id.toLowerCase() === acceptedWbm.assessment_identity.owner_profile_id.toLowerCase(), 'PROFILE_BINDING', 'Evidence manifest and WBM profile identity do not match.')

  const domainClaims = acceptedWbm.domain_states.flatMap((domain) => domain.claims.map((claim) => projectClaim(claim, domain.domain_id, null, domain.authority_refs)))
  const assetClaims = acceptedWbm.assets.map((claim) => projectClaim(claim, inferAssetDomain(claim, acceptedWbm), 'ASSET'))
  const vulnerabilityClaims = acceptedWbm.vulnerabilities.map((claim) => projectClaim(claim, inferAssetDomain(claim, acceptedWbm), 'VULNERABILITY'))
  const projectedClaims = [...domainClaims, ...assetClaims, ...vulnerabilityClaims]
  const territoryGapClaims = cassetteRuntime.territory_routing.filter((route) => !projectedClaims.some((claim) => claim.primary_territory_id === route.territory_id)).map((route) => ({
    claim_id: `vbrm-missing-${route.territory_id.toLowerCase()}-state-v1`,
    claim_type: 'SUPPORTED_HYPOTHESIS',
    primary_territory_id: route.territory_id,
    statement: `The governed evidence makes ${route.territory_name.toLowerCase()} material, but the accepted state does not establish a separate conclusion for it.`,
    epistemic_state: 'MISSING',
    source_class: 'UNKNOWN',
    source_nature: 'ABSENT',
    evidence_refs: route.evidence_refs,
    authority_refs: [],
    derivation: null,
    confidence: 'LOW',
    cross_territory_refs: [],
    alternatives: [],
    falsifier: 'Governed territory-specific evidence supports a distinct state.',
    customer_visible_eligibility: 'ELIGIBLE_WITH_DISCLOSURE',
  }))
  const claims = [...projectedClaims, ...territoryGapClaims]
  invariant(new Set(claims.map((claim) => claim.claim_id)).size === claims.length, 'CLAIM_ID_COLLISION', 'VBRM claim IDs must be unique.')

  const missingEvidence = mapMissing(acceptedWbm)
  const contradictions = mapContradictions(acceptedWbm)
  const missingIds = missingEvidence.map((item) => item.missing_id)
  const contradictionIds = contradictions.map((item) => item.contradiction_id)
  const lensTraversal = mapLensTraversal(lensRuntime, claims)

  const territoryStates = cassetteRuntime.territory_routing.map((route) => {
    const owned = claims.filter((claim) => claim.primary_territory_id === route.territory_id)
    const missing = missingEvidence.filter((item) => item.territory_id === route.territory_id)
    return {
      territory_id: route.territory_id,
      state_summary: owned.length
        ? owned.slice(0, 3).map((claim) => claim.statement).join(' ')
        : `This territory remains material but unresolved under the governed evidence.`,
      claim_refs: owned.map((claim) => claim.claim_id),
      asset_refs: owned.filter((claim) => claim.claim_type === 'ASSET').map((claim) => claim.claim_id),
      vulnerability_refs: owned.filter((claim) => claim.claim_type === 'VULNERABILITY').map((claim) => claim.claim_id),
      missing_evidence_refs: missing.map((item) => item.missing_id),
      contradiction_refs: route.territory_id === 'RE-T06' ? contradictionIds : [],
      e_to_p_dimensions: [...E_TO_P_DIMENSIONS],
      confidence: owned.some((claim) => claim.confidence === 'HIGH') ? 'MODERATE' : 'LOW',
      cross_territory_refs: TERRITORY_IDS.filter((id) => id !== route.territory_id),
    }
  })

  const currentRealityStates = Object.values(acceptedWbm.current_business_reality || {})
  const allDomainClaimRefs = domainClaims.map((claim) => claim.claim_id)
  const goals = acceptedWbm.current_business_reality?.goals
  const businessModelSummary = Object.entries(acceptedWbm.business_model || {}).filter(([key]) => key !== 'evidence_refs').map(([key, value]) => `${key.replaceAll('_', ' ')}: ${value}`).join(' ')
  const eligible = claims.filter((claim) => claim.customer_visible_eligibility === 'ELIGIBLE').map((claim) => claim.claim_id)
  const disclosed = claims.filter((claim) => claim.customer_visible_eligibility === 'ELIGIBLE_WITH_DISCLOSURE').map((claim) => claim.claim_id)

  const vbrm = {
    contract_id: CONTRACTS.vbrm,
    contract_version: '1.0.0',
    schema_version: '1.0.0',
    identity: {
      ...acceptedWbm.assessment_identity,
      cassette_id: cassetteRuntime.contract_id,
      cassette_version: cassetteRuntime.contract_version,
    },
    authority_binding: authorityBinding,
    current_business_reality: realitySummary(currentRealityStates.map((item) => item.state).join(' '), allDomainClaimRefs, missingIds, contradictionIds),
    desired_business_reality: realitySummary(goals?.state, domainClaims.filter((claim) => claim.primary_territory_id === 'RE-T08').map((claim) => claim.claim_id), missingIds.filter((id) => id.includes('longitudinal')), [], 'MODERATE'),
    business_model_reality: realitySummary(businessModelSummary, allDomainClaimRefs, missingIds, contradictionIds),
    territory_states: territoryStates,
    e_to_p_state: eToPRuntime.states,
    claims,
    missing_evidence: missingEvidence,
    contradictions,
    diagnostic_lens_traversal: lensTraversal,
    whole_person_execution_context: {
      authority_bound: true,
      whole_person_hash: acceptedWbm.frozen_whole_person_authority.bos_hash,
      allowed_modifier_claim_refs: acceptedWbm.person_business_synthesis.map((item) => item.relationship_id),
      business_cause_prohibited: true,
    },
    team_context: {
      business_level_evidence_refs: unique(acceptedWbm.current_business_reality?.team?.evidence_refs),
      authorized_person_profile_refs: [],
      person_level_synthesis_allowed: false,
    },
    dynamic_research: {
      executed: false,
      warrant_refs: missingEvidence.filter((item) => item.missing_id.includes('market')).map((item) => item.missing_id),
      research_claim_refs: [],
      canon_override_prohibited: true,
    },
    projection_eligibility: {
      eligible_claim_refs: eligible,
      disclosure_required_claim_refs: disclosed,
      internal_only_claim_refs: [],
      prohibited_claim_refs: [],
    },
    state_lineage: {
      state_version: 1,
      previous_state_hash: null,
      evidence_packet_hash: canonicalHash({
        assessment_id: evidenceManifest.assessment_id,
        profile_id: evidenceManifest.profile_id.toLowerCase(),
        answer_receipts: evidenceManifest.answer_receipts,
      }),
      adapter_contract_version: 'accepted-wbm-compatibility-projection-v1',
      created_at: acceptedWbm.state_lineage.created_at,
    },
  }
  vbrm.state_hash = hashWithout(vbrm, ['state_hash'])
  validateVerticalBusinessRealityModel(vbrm)
  return deepFreeze(vbrm)
}

export function validateVerticalBusinessRealityModel(vbrm) {
  invariant(vbrm?.contract_id === CONTRACTS.vbrm, 'VBRM_CONTRACT', 'VBRM contract is invalid.')
  invariant(TERRITORY_IDS.every((id) => vbrm.territory_states.some((item) => item.territory_id === id)), 'VBRM_TERRITORIES', 'All eight territory states are required.')
  invariant(vbrm.e_to_p_state.length === 6, 'VBRM_E_TO_P', 'All six E to P states are required.')
  invariant(vbrm.diagnostic_lens_traversal.length === 10, 'VBRM_LENSES', 'All ten diagnostic lens receipts are required.')
  invariant(vbrm.claims.every((claim) => claim.source_class !== 'FOUNDER_HEURISTIC'), 'VBRM_HEURISTIC_FACT', 'Heuristics cannot enter the VBRM claim ledger.')
  invariant(vbrm.whole_person_execution_context.business_cause_prohibited === true, 'VBRM_WP_BOUNDARY', 'Whole-Person business-cause prohibition is required.')
  invariant(vbrm.team_context.person_level_synthesis_allowed === false || vbrm.team_context.authorized_person_profile_refs.length > 0, 'VBRM_TEAM_AUTHORITY', 'Person-level team synthesis requires separate authority.')
  invariant(vbrm.state_hash === hashWithout(vbrm, ['state_hash']), 'VBRM_HASH', 'VBRM state hash replay failed.')
  invariant(vbrm.current_business_reality.claim_refs.length > 0, 'VBRM_REALITY', 'Current business reality cannot be empty.')
  return true
}
