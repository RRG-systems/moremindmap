import { CONTRACTS, DOMAIN_TERRITORY_ROUTING, LENS_IDS, TERRITORY_IDS } from './constants.js'
import { canonicalHash, deepFreeze, invariant, unique } from './utils.js'

function evidenceRecords(manifest) {
  return Object.entries(manifest.answer_receipts || {}).map(([question, receipt]) => ({
    evidence_ref: `${manifest.assessment_id}-${question}`,
    question,
    sha256: receipt.sha256,
    purpose: receipt.purpose,
    primary_domain: receipt.primary_domain,
    secondary_domains: receipt.secondary_domains || [],
  }))
}

export function validateRealEstateRegistries({ territoryRegistry, lensRegistry }) {
  invariant(territoryRegistry?.registry_id === 'more-real-estate-business-territory-registry-v2', 'TERRITORY_REGISTRY_ID', 'Real Estate territory registry identity is invalid.')
  invariant(territoryRegistry.territory_count === 8 && territoryRegistry.territories?.length === 8, 'TERRITORY_COUNT', 'Exactly eight Real Estate territories are required.')
  invariant(JSON.stringify(territoryRegistry.territories.map((item) => item.territory_id)) === JSON.stringify(TERRITORY_IDS), 'TERRITORY_ORDER', 'Real Estate territory order has drifted.')
  invariant(lensRegistry?.registry_id === 'more-real-estate-diagnostic-lens-registry-v1', 'LENS_REGISTRY_ID', 'Real Estate diagnostic lens registry identity is invalid.')
  invariant(lensRegistry.lens_count === 10 && lensRegistry.lenses?.length === 10, 'LENS_COUNT', 'Exactly ten Real Estate diagnostic lenses are required.')
  invariant(JSON.stringify(lensRegistry.lenses.map((item) => item.lens_id)) === JSON.stringify(LENS_IDS), 'LENS_ORDER', 'Diagnostic lens order has drifted.')
  return true
}

export function routeEvidenceToTerritories({ evidenceManifest, territoryRegistry }) {
  invariant(evidenceManifest?.assessment_id, 'EVIDENCE_MANIFEST', 'A sanitized governed evidence manifest is required.')
  const records = evidenceRecords(evidenceManifest)
  invariant(records.length === 12, 'EVIDENCE_COUNT', 'Exactly twelve governed BA answer receipts are required for this proof.')

  const routing = territoryRegistry.territories.map((territory) => {
    const routed = records.filter((record) => {
      const domains = [record.primary_domain, ...record.secondary_domains]
      return domains.some((domain) => (DOMAIN_TERRITORY_ROUTING[domain] || []).includes(territory.territory_id))
    })
    return {
      territory_id: territory.territory_id,
      territory_name: territory.name,
      evidence_refs: unique(routed.map((item) => item.evidence_ref)),
      matched_domains: unique(routed.flatMap((item) => [item.primary_domain, ...item.secondary_domains])),
      route_reason: routed.length
        ? 'Governed intake purpose/domain routing made this territory material.'
        : 'No governed intake domain routed directly; downstream synthesis may retain it as missing or contextual.',
    }
  })
  invariant(routing.every((item) => item.evidence_refs.length > 0), 'TERRITORY_COVERAGE', 'Every Real Estate territory must receive governed evidence or an explicit missingness route.')
  return deepFreeze(routing)
}

export function createRealEstateCassetteRuntime({ territoryRegistry, lensRegistry, evidenceManifest }) {
  validateRealEstateRegistries({ territoryRegistry, lensRegistry })
  const territoryRouting = routeEvidenceToTerritories({ evidenceManifest, territoryRegistry })
  return deepFreeze({
    contract_id: CONTRACTS.cassette,
    contract_version: '1.0.0',
    schema_version: '1.0.0',
    vertical: 'real_estate',
    territory_registry_id: territoryRegistry.registry_id,
    territory_registry_hash: canonicalHash(territoryRegistry),
    diagnostic_lens_registry_id: lensRegistry.registry_id,
    diagnostic_lens_registry_hash: canonicalHash(lensRegistry),
    territory_routing: territoryRouting,
    heuristic_boundary: 'Cassette heuristics are inquiry aids and never customer facts.',
    runtime_boundary: 'The cassette routes governed evidence and vertical meaning; it does not diagnose from a single intake answer.',
  })
}

