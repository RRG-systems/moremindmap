import {
  BASE_AUTHORITY_ROUTE,
  DEFAULT_AUTHORITY_SECTIONS,
  DEFAULT_CONTEXT_BUDGET,
  DOMAIN_AUTHORITY_EXPANSION,
  WBM_ROUTER_VERSION,
} from './constants.js';
import { canonicalHash, unique } from './canonical.js';
import { getAuthority, loadFrozenAuthorityLibrary, selectAuthoritySections } from './authorityLibrary.js';
import { integrity } from './errors.js';
import { validateWholeBusinessInputs } from './inputContracts.js';

function materialDomains(input) {
  return unique([
    ...input.governed_business_evidence.map((item) => item.domain),
    ...input.missing_evidence.map((item) => item.domain),
    ...input.contradictions.flatMap((item) => item.domains || []),
    ...(input.context_hints?.material_domains || []),
  ]).filter((domain) => DOMAIN_AUTHORITY_EXPANSION[domain]);
}

function selectAuthorityIds(domains, budget) {
  const universal = [...BASE_AUTHORITY_ROUTE.universal];
  const vertical = [...BASE_AUTHORITY_ROUTE.real_estate];
  for (const domain of domains) {
    const route = DOMAIN_AUTHORITY_EXPANSION[domain];
    universal.push(...route.universal);
    vertical.push(...route.real_estate);
  }
  return {
    universal: unique(universal).slice(0, budget.universal_authorities),
    vertical: unique(vertical).slice(0, budget.vertical_authorities),
  };
}

function interactionIsRelevant(interaction, selectedIds) {
  const selected = new Set(selectedIds);
  return interaction.authority_dependencies.every((authorityId) => selected.has(authorityId));
}

function selectWholePersonClaims(input, domains, budget) {
  return input.frozen_whole_person_authority.claims
    .filter((claim) => claim.relevant_domains.some((domain) => domains.includes(domain)))
    .slice(0, budget.whole_person_claims)
    .map((claim) => ({
      claim_id: claim.claim_id,
      meaning: claim.meaning,
      relevant_domains: claim.relevant_domains,
      epistemic_class: claim.epistemic_class,
      evidence_refs: claim.evidence_refs || [],
      prohibited_use: 'MAY_NOT_OVERRIDE_BUSINESS_FACTS_OR_ESTABLISH_BUSINESS_CAUSE_ALONE',
    }));
}

function teamMemberRelevance(member, domains) {
  const roleDomains = member.relevant_domains || [];
  return roleDomains.some((domain) => domains.includes(domain));
}

function selectTeamContext(input, domains, budget) {
  if (!input.team_authority) return { selected: [], excluded: [] };
  const selected = [];
  const excluded = [];
  for (const member of input.team_authority.members) {
    if (teamMemberRelevance(member, domains) && selected.length < budget.team_members) {
      selected.push({
        profile_id: member.profile_id,
        role: member.role,
        seat: member.seat,
        bos_version: member.bos_version,
        bos_hash: member.bos_hash,
        reporting_to_profile_id: member.reporting_to_profile_id || null,
        relevant_domains: member.relevant_domains,
        governed_claim_refs: member.governed_claim_refs || [],
        evidence_scope: member.evidence_scope || [],
      });
    } else {
      excluded.push({
        profile_id: member.profile_id,
        reason: selected.length >= budget.team_members ? 'CONTEXT_BUDGET' : 'NOT_MATERIALLY_RELEVANT',
      });
    }
  }
  return { selected, excluded };
}

function assembleAuthorityPackets(library, authorityIds, budget) {
  return authorityIds.map((authorityId) => {
    const authority = getAuthority(library, authorityId);
    const sections = selectAuthoritySections(authority, DEFAULT_AUTHORITY_SECTIONS)
      .slice(0, budget.sections_per_authority);
    return {
      authority_id: authority.authority_id,
      title: authority.title,
      version: authority.version,
      sha256: authority.sha256,
      selected_sections: sections,
    };
  });
}

export function assembleWholeBusinessContext(input, options = {}) {
  const inputReceipt = validateWholeBusinessInputs(input);
  const library = options.library || loadFrozenAuthorityLibrary(options);
  const budget = { ...DEFAULT_CONTEXT_BUDGET, ...(options.contextBudget || {}) };
  const domains = materialDomains(input);
  const ids = selectAuthorityIds(domains, budget);
  integrity(ids.universal.length < 12, 'MALFORMED_STATE', 'Selective assembly may not load all 12 Universal Bibles');
  integrity(ids.vertical.length < 16, 'MALFORMED_STATE', 'Selective assembly may not load all 16 Real Estate Bibles');
  const selectedIds = [...ids.universal, ...ids.vertical];
  const team = selectTeamContext(input, domains, budget);
  const wholePersonClaims = selectWholePersonClaims(input, domains, budget);
  const dynamic = (input.dynamic_intelligence || []).slice(0, budget.dynamic_items);
  const packet = {
    packet_contract: 'whole-business-context-packet-v1',
    purpose: 'whole_business_model_construction',
    assessment_identity: input.assessment_identity,
    input_receipt: inputReceipt,
    business_evidence: input.governed_business_evidence,
    missing_evidence: input.missing_evidence,
    contradictions: input.contradictions,
    selected_universal_authorities: assembleAuthorityPackets(library, ids.universal, budget),
    selected_vertical_authorities: assembleAuthorityPackets(library, ids.vertical, budget),
    selected_cross_authority_interactions: [
      ...library.universal_interactions.interactions,
      ...library.real_estate_interactions.interactions,
    ].filter((interaction) => interactionIsRelevant(interaction, selectedIds)),
    frozen_whole_person_authority: {
      profile_id: input.frozen_whole_person_authority.profile_id,
      bos_version: input.frozen_whole_person_authority.bos_version,
      bos_hash: input.frozen_whole_person_authority.bos_hash,
      selected_claims: wholePersonClaims,
    },
    team_context: {
      team_id: input.team_authority?.team_id || null,
      selected_members: team.selected,
      excluded_members: team.excluded,
      aggregation_prohibited: true,
    },
    dynamic_intelligence: dynamic,
    rsl_context: {
      status: 'DORMANT_OPTIONAL',
      selected_refs: [],
      required_for_wbm: false,
    },
    precedence_rules: [
      'VERIFIED_CURRENT_BUSINESS_EVIDENCE_OVER_GENERIC_ASSUMPTION',
      'WHOLE_PERSON_GOVERNS_PERSON_BUSINESS_EVIDENCE_GOVERNS_BUSINESS',
      'VERTICAL_SPECIALIZES_UNIVERSAL_FOR_LEGITIMATE_DOMAIN_DIFFERENCES',
      'DYNAMIC_CONTEXT_NEVER_SILENTLY_REWRITES_CANON',
      'FOUNDER_HEURISTICS_REMAIN_QUALIFIED',
      'CONTRADICTIONS_AND_MISSING_EVIDENCE_SURVIVE',
      'NO_FALSE_RECONCILIATION',
    ],
    context_limits: budget,
  };
  packet.selection_receipt = {
    router_version: WBM_ROUTER_VERSION,
    frozen_library_manifest_id: library.freeze_manifest.manifest_id,
    frozen_library_version: library.freeze_manifest.version,
    frozen_library_verdict: library.freeze_manifest.verdict,
    purpose: packet.purpose,
    business_id: input.assessment_identity.business_id,
    vertical_id: input.assessment_identity.vertical,
    selected_authority_ids: selectedIds,
    selected_section_ids: [
      ...packet.selected_universal_authorities,
      ...packet.selected_vertical_authorities,
    ].flatMap((authority) => authority.selected_sections.map((section) => section.section_id)),
    authority_hashes: Object.fromEntries([
      ...packet.selected_universal_authorities,
      ...packet.selected_vertical_authorities,
    ].map((authority) => [authority.authority_id, authority.sha256])),
    business_evidence_refs: input.governed_business_evidence.map((item) => item.evidence_id),
    wpm_refs: wholePersonClaims.map((claim) => claim.claim_id),
    team_member_refs: team.selected.map((member) => member.profile_id),
    dynamic_research_refs: dynamic.map((item) => item.dynamic_id),
    rsl_refs: [],
    exclusions: [
      ...[...library.universal_bibles, ...library.real_estate_bibles]
        .filter((authority) => !selectedIds.includes(authority.authority_id))
        .map((authority) => ({ authority_id: authority.authority_id, reason: 'NOT_SELECTED_FOR_CURRENT_EVIDENCE_DOMAINS' })),
      ...team.excluded,
    ],
    expansion_reasons: domains,
    created_at: input.requested_at,
  };
  packet.context_hash = canonicalHash(packet);
  return Object.freeze(packet);
}
