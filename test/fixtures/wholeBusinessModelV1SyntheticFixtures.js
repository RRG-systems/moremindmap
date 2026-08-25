import {
  FIVE_FUTURES_V2_ROLES,
  LATER_RUNTIME_BOUNDARIES,
  WBM_CONTRACT_ID,
  WBM_CONTRACT_VERSION,
  WBM_SCHEMA_VERSION,
  canonicalHash,
  sha256,
} from '../../src/lib/wholeBusinessModelV1/index.js';
import { buildCustomerConfirmedVerticalBinding } from '../../api/business-assessment/verticalBinding.js';
import { buildCustomerConfirmedSelection, REAL_ESTATE_CASSETTE_REGISTRATION } from '../../src/lib/baVerticalCassettesV1/index.js';

const CASES = [
  ['new-agent-tiny-database', 'new agent / tiny database', ['relationship', 'demand', 'stage'], 'demand', 'A tiny qualified relationship base constrains opportunity creation before conversion skill can be observed.', ['Small known-person pool limits qualified conversations.', 'Low conversation volume produces thin pipeline evidence.', 'Thin pipeline prevents stable transaction learning.'], 'STABLE', false, true, false, false],
  ['relationship-heavy-stable-solo', 'relationship-heavy stable solo', ['relationship', 'transaction', 'financial'], 'system', 'Reliable referrals protect current production while inconsistent continuity exposes future relationship decay.', ['Strong advocacy produces repeat/referral opportunity.', 'Informal continuity sustains present volume.', 'Lack of a durable follow-up system makes the asset founder-dependent.'], 'STABLE', false, true, false, false],
  ['large-dead-database', 'large dead database', ['relationship', 'demand', 'conversion'], 'system', 'Contact capture is being mistaken for active relationship continuity, so nominal database size does not become mindshare or opportunity.', ['Many records create apparent asset size.', 'Low recent meaningful contact leaves weak mindshare.', 'Weak mindshare suppresses qualified conversations and referrals.'], 'DETERIORATING', false, false, false, false],
  ['paid-lead-weak-followup', 'paid-lead dependent / weak follow-up', ['demand', 'conversion', 'pipeline', 'financial'], 'conversion', 'Rented demand enters faster than the follow-up system can qualify and advance it, converting acquisition spend into pipeline leakage.', ['Paid sources create lead volume.', 'Response and follow-up decay before qualification.', 'Low advancement raises acquisition cost per closed transaction.'], 'DETERIORATING', false, true, false, false],
  ['listing-heavy-producer', 'listing-heavy high producer', ['listing', 'transaction', 'capacity', 'financial'], 'capacity', 'Listing production is strong, but coordination load and founder approval concentrate delivery capacity at the producer.', ['Listing skill creates inventory and closings.', 'Central approval creates a service queue.', 'Queue growth threatens responsiveness and future listing capacity.'], 'IMPROVING', true, true, false, false],
  ['buyer-heavy-capacity', 'buyer-heavy capacity-constrained', ['buyer', 'transaction', 'capacity'], 'capacity', 'Buyer service intensity consumes prime prospecting time, so current delivery success suppresses replacement demand.', ['Active buyers require showings and offer work.', 'Service absorbs discretionary calendar capacity.', 'Prospecting falls and future pipeline thins.'], 'DETERIORATING', false, true, false, false],
  ['high-gci-weak-profit', 'high GCI / weak profit', ['financial', 'demand', 'team'], 'economics', 'High gross commission is masking weak retained economics caused by acquisition, split, and overhead load.', ['Strong top-line commission suggests success.', 'Source, split, and overhead costs absorb contribution.', 'Cash retained for resilience and owner wealth remains weak.'], 'STABLE', true, false, false, false],
  ['accidental-success', 'accidental success / weak systems', ['operations', 'accountability', 'demand'], 'system', 'Intermittent inbound opportunity protects income while reducing the felt need to build a repeatable operating system.', ['Unplanned opportunity periodically converts.', 'Income recovery lowers urgency for system work.', 'Execution remains variable and forecastability stays weak.'], 'MIXED', false, true, false, false],
  ['leverage-ready-solo', 'leverage-ready solo', ['capacity', 'operations', 'financial'], 'role', 'The owner remains the coordination hub after economics and repeatable work justify leverage, making role concentration the active ceiling.', ['Stable production funds support capacity.', 'Repeatable administrative work remains with owner.', 'Owner coordination time limits higher-value production and leadership.'], 'IMPROVING', false, true, false, false],
  ['premature-team', 'premature team', ['team', 'financial', 'demand'], 'economics', 'Fixed team capacity was added before reliable opportunity and contribution economics could support it.', ['Team seats create recurring cost.', 'Qualified opportunity per seat remains thin.', 'Leader production subsidizes the organization.'], 'DETERIORATING', true, false, false, false],
  ['leader-dependent-team', 'leader-dependent team', ['team', 'demand', 'conversion', 'accountability'], 'team', 'Leader-generated opportunity and intervention make team output appear stronger than independent productive capacity.', ['Leader creates and rescues opportunities.', 'Members depend on leader routing and decisions.', 'Team output falls when leader attention shifts.'], 'STABLE', true, true, false, false],
  ['recruiting-onboarding-failure', 'recruiting/onboarding failure', ['team', 'accountability', 'operations'], 'system', 'Recruiting activity adds people without a role-specific activation system, so headcount does not become productive capacity.', ['Recruiting increases starts.', 'Onboarding lacks staged expectations and feedback.', 'Time-to-productivity remains long and attrition rises.'], 'DETERIORATING', true, false, false, false],
  ['strong-team-weak-owner-economics', 'strong team / weak owner economics', ['team', 'financial', 'operations'], 'economics', 'Operational output is distributed, but compensation and overhead structure leave the owner with weak retained value.', ['Team closes meaningful volume.', 'Splits and infrastructure consume contribution.', 'Owner carries risk without proportional retained economics.'], 'STABLE', true, false, false, false],
  ['geographic-farmer', 'geographic farmer', ['demand', 'relationship', 'listing'], 'demand', 'Farm activity is consistent, but insufficient local engagement and appointment conversion delay the channel payoff.', ['Repeated geographic presence builds recognition.', 'Engagement and live conversations remain limited.', 'Listing appointments lag activity volume.'], 'IMPROVING', false, true, true, false],
  ['open-house-growth', 'open-house-led growth', ['demand', 'conversion', 'buyer'], 'conversion', 'Open houses create conversations, but weak qualification and post-event continuity prevent event traffic from becoming represented clients.', ['Events create concentrated visitor contact.', 'Readiness and representation needs are weakly qualified.', 'Follow-up loses context and appointment conversion stays low.'], 'MIXED', false, true, true, false],
  ['pipeline-aging', 'pipeline aging / delayed downturn', ['pipeline', 'conversion', 'financial'], 'conversion', 'Current closings reflect earlier pipeline strength while recent stage aging signals a delayed production downturn.', ['Lagging closings remain healthy.', 'Current opportunities spend longer in stage.', 'Lower advancement today implies weaker future closings.'], 'DETERIORATING', false, false, false, true],
  ['market-slowdown', 'market slowdown exposure', ['market', 'demand', 'financial'], 'market', 'External transaction friction is reducing opportunity velocity while source concentration leaves little internal offset.', ['Market cycle lengthens customer decisions.', 'A concentrated demand channel loses velocity.', 'Pipeline and cash sensitivity rise together.'], 'DETERIORATING', false, false, true, false],
  ['time-freedom', 'strong business seeking time freedom', ['capacity', 'team', 'operations'], 'role', 'Business economics are strong, but owner-held decisions keep the business dependent on personal availability.', ['Systems produce stable delivery.', 'Decision rights remain centralized.', 'Owner absence slows exceptions and growth choices.'], 'IMPROVING', true, true, false, false],
  ['succession-transfer', 'succession/book-transfer problem', ['relationship', 'team', 'stage'], 'mixed', 'Relationship equity is attached to the founder rather than transferred through governed introductions and shared service trust.', ['Founder has durable client trust.', 'Successor visibility and authority remain low.', 'The book loses continuity when founder participation declines.'], 'STABLE', true, true, false, false],
  ['contradictory-thin', 'contradictory / thin evidence', ['financial', 'pipeline', 'constraints'], 'insufficient_evidence', 'Available signals conflict and are too thin to choose a single governing constraint without inventing certainty.', ['Operator reports strong pipeline.', 'Recorded stage evidence suggests aging and low advancement.', 'Missing source and time-window alignment prevents reconciliation.'], 'UNCERTAIN', false, false, false, true],
];

export const WBM_SYNTHETIC_CASES = Object.freeze(CASES.map(([
  case_id,
  name,
  domains,
  constraint_type,
  mechanism,
  causal_chain,
  momentum,
  team,
  whole_person_relevant,
  dynamic,
  contradictory,
]) => Object.freeze({
  case_id,
  name,
  domains,
  constraint_type,
  mechanism,
  causal_chain,
  momentum,
  team,
  whole_person_relevant,
  dynamic,
  contradictory,
})));

function evidence(caseDefinition, businessId, ownerProfileId) {
  return caseDefinition.domains.map((domain, index) => ({
    evidence_id: `${caseDefinition.case_id}-e${index + 1}`,
    business_id: businessId,
    profile_id: ownerProfileId,
    domain,
    evidence_class: index === 0 ? 'DIRECT' : 'OPERATOR_REPORTED',
    source_ref: `synthetic://${caseDefinition.case_id}/${domain}`,
    observed_at: `2026-08-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    value: `${caseDefinition.name}:${domain}:material-signal-${index + 1}`,
    units: null,
    period: 'synthetic-current-state',
  }));
}

export function buildSyntheticWholeBusinessInput(caseDefinition) {
  const businessId = `synthetic-business-${caseDefinition.case_id}`;
  const ownerProfileId = `synthetic-profile-${caseDefinition.case_id}`;
  const facts = evidence(caseDefinition, businessId, ownerProfileId);
  const teamProfileId = `synthetic-member-${caseDefinition.case_id}`;
  return {
    requested_at: '2026-08-12T12:00:00.000Z',
    assessment_identity: {
      business_id: businessId,
      assessment_id: `synthetic-assessment-${caseDefinition.case_id}`,
      assessment_version: 'synthetic-ba-v1',
      owner_profile_id: ownerProfileId,
      vertical: 'real_estate',
      vertical_binding: buildCustomerConfirmedVerticalBinding({
        selection: buildCustomerConfirmedSelection(REAL_ESTATE_CASSETTE_REGISTRATION),
        selectedAt: '2026-08-12T11:59:00.000Z',
      }),
      business_model_identity: 'residential-real-estate-agent-or-team',
      completion_state: 'COMPLETE',
      assessed_at: '2026-08-12T12:00:00.000Z',
    },
    frozen_whole_person_authority: {
      profile_id: ownerProfileId,
      bos_version: 'new-bos-whole-person-v1-frozen',
      bos_hash: sha256(`frozen-bos:${caseDefinition.case_id}`),
      claims: [{
        claim_id: `wp-${caseDefinition.case_id}-operating`,
        meaning: caseDefinition.whole_person_relevant
          ? 'The operator tends to sustain work that has visible feedback and may require external structure when the payoff is delayed.'
          : 'No material operator-business link is established for the current evidence domains.',
        relevant_domains: caseDefinition.whole_person_relevant ? caseDefinition.domains : ['goals'],
        epistemic_class: 'STRONGLY_SUPPORTED',
        evidence_refs: [`synthetic-bos://${caseDefinition.case_id}/operating`],
      }],
    },
    governed_business_evidence: facts,
    contradictions: caseDefinition.contradictory ? [{
      contradiction_id: `contradiction-${caseDefinition.case_id}`,
      evidence_refs: [facts[0].evidence_id, facts[1].evidence_id],
      domains: caseDefinition.domains.slice(0, 2),
      status: 'UNRESOLVED',
    }] : [],
    missing_evidence: [{
      missing_id: `missing-${caseDefinition.case_id}`,
      domain: caseDefinition.domains[0],
      question: `Which time-bounded measure would falsify the primary ${caseDefinition.domains[0]} mechanism?`,
      decision_impact: 'Could strengthen, weaken, or replace the governing-constraint candidate.',
    }],
    dynamic_intelligence: caseDefinition.dynamic ? [{
      dynamic_id: `dynamic-${caseDefinition.case_id}`,
      business_id: businessId,
      canon_status: 'DYNAMIC_NOT_CANON',
      authority: 'synthetic-market-context',
      observed_at: '2026-08-12T12:00:00.000Z',
      finding: 'Current local market conditions may materially affect the observed business mechanism.',
    }] : [],
    team_authority: caseDefinition.team ? {
      team_id: `synthetic-team-${caseDefinition.case_id}`,
      business_id: businessId,
      members: [{
        business_id: businessId,
        team_id: `synthetic-team-${caseDefinition.case_id}`,
        profile_id: teamProfileId,
        bos_version: 'new-bos-whole-person-v1-frozen',
        bos_hash: sha256(`frozen-team-bos:${caseDefinition.case_id}`),
        role: 'team_member',
        seat: 'production_or_operations',
        membership_status: 'ACTIVE',
        permissions: ['WBM_CONTEXT'],
        visibility: 'BUSINESS_GOVERNED',
        effective_at: '2026-01-01T00:00:00.000Z',
        version: '1.0.0',
        relevant_domains: caseDefinition.domains,
        governed_claim_refs: [`team-claim-${caseDefinition.case_id}`],
        evidence_scope: facts.map((fact) => fact.evidence_id),
      }],
    } : null,
    authorization: {
      permitted_profile_ids: caseDefinition.team ? [ownerProfileId, teamProfileId] : [ownerProfileId],
    },
    context_hints: { material_domains: caseDefinition.domains },
  };
}

function claim({ id, meaning, evidenceRef, epistemicClass = 'STRONGLY_SUPPORTED', falsifier }) {
  return {
    claim_id: id,
    meaning,
    epistemic_class: epistemicClass,
    evidence_refs: [evidenceRef],
    counterevidence_refs: [],
    confounds: ['synthetic fixture preserves alternative explanations for contract validation'],
    falsifier: falsifier || 'The claim weakens if a comparable time-bounded observation fails to reproduce the stated relationship.',
  };
}

export function buildSyntheticWholeBusinessCandidate(caseDefinition, context) {
  const evidenceRefs = context.business_evidence.map((item) => item.evidence_id);
  const primaryEvidenceRef = evidenceRefs[0];
  const mechanismId = `mechanism-${caseDefinition.case_id}`;
  const constraintEpistemic = caseDefinition.constraint_type === 'insufficient_evidence'
    ? 'INSUFFICIENT_EVIDENCE'
    : (caseDefinition.contradictory ? 'CONFLICTED' : 'SUPPORTED_HYPOTHESIS');
  const selectedWpClaim = context.frozen_whole_person_authority.selected_claims[0];
  const teamMember = context.team_context.selected_members[0];
  const model = {
    contract_id: WBM_CONTRACT_ID,
    contract_version: WBM_CONTRACT_VERSION,
    schema_version: WBM_SCHEMA_VERSION,
    assessment_identity: context.assessment_identity,
    frozen_whole_person_authority: {
      profile_id: context.frozen_whole_person_authority.profile_id,
      bos_version: context.frozen_whole_person_authority.bos_version,
      bos_hash: context.frozen_whole_person_authority.bos_hash,
      selected_claim_refs: context.frozen_whole_person_authority.selected_claims.map((item) => item.claim_id),
    },
    source_integrity: {
      context_hash: context.context_hash,
      authority_hashes: context.selection_receipt.authority_hashes,
      evidence_refs: evidenceRefs,
      dynamic_refs: context.dynamic_intelligence.map((item) => item.dynamic_id),
    },
    authority_receipts: [context.selection_receipt],
    governed_business_evidence: evidenceRefs.map((evidence_ref) => ({ evidence_ref })),
    current_business_reality: Object.fromEntries(caseDefinition.domains.map((domain) => [domain, {
      evidence_refs: context.business_evidence.filter((item) => item.domain === domain).map((item) => item.evidence_id),
      state: `Material ${domain} state for ${caseDefinition.name}`,
    }])),
    business_model: {
      value_creation: 'Create trusted residential representation and convert demand into completed client outcomes.',
      demand_entry: caseDefinition.domains.includes('relationship') ? 'relationship and referral opportunity' : 'case-specific demand source',
      conversion: 'qualification, appointment, representation, transaction',
      delivery: 'advisory and transaction execution',
      value_capture: 'commission less direct and operating costs',
      leverage: caseDefinition.team ? 'team-role capacity' : 'systems and selective support',
      concentration: caseDefinition.mechanism,
      evidence_refs: evidenceRefs,
    },
    domain_states: caseDefinition.domains.map((domain, index) => ({
      domain_id: domain,
      authority_refs: context.selection_receipt.selected_authority_ids,
      epistemic_class: caseDefinition.contradictory && index === 0 ? 'CONFLICTED' : 'STRONGLY_SUPPORTED',
      claims: [claim({
        id: `${caseDefinition.case_id}-${domain}-state`,
        meaning: `The ${domain} evidence is material to ${caseDefinition.name}.`,
        evidenceRef: evidenceRefs[index],
        epistemicClass: caseDefinition.contradictory && index === 0 ? 'CONFLICTED' : 'STRONGLY_SUPPORTED',
      })],
      mechanisms: [mechanismId],
      strengths: index === 0 ? [`Observed ${domain} asset`] : [],
      failure_modes: index === caseDefinition.domains.length - 1 ? [caseDefinition.mechanism] : [],
      interactions: [],
      missing_evidence: context.missing_evidence.filter((item) => item.domain === domain),
      abstentions: [],
    })),
    person_business_synthesis: selectedWpClaim && caseDefinition.whole_person_relevant ? [{
      relationship_id: `person-link-${caseDefinition.case_id}`,
      business_mechanism_ref: mechanismId,
      whole_person_claim_ref: selectedWpClaim.claim_id,
      relationship_type: 'FEASIBILITY_MODIFIER',
      business_evidence_refs: [primaryEvidenceRef],
      whole_person_evidence_refs: selectedWpClaim.evidence_refs,
      alternative_explanations: ['system design', 'resource load', 'market conditions'],
      epistemic_class: 'SUPPORTED_HYPOTHESIS',
      falsifier: 'If execution remains unchanged under materially different support and feedback conditions, this feasibility link weakens.',
      intervention_implications: ['Use feedback and support only as implementation context; do not redefine the business constraint.'],
      business_cause_established_by_personality: false,
    }] : [],
    team_organizational_synthesis: teamMember ? [{
      relationship_id: `team-link-${caseDefinition.case_id}`,
      intelligence_level: 'ORGANIZATIONAL',
      profile_refs: [teamMember.profile_id],
      business_evidence_refs: [primaryEvidenceRef],
      structural_explanations_tested: ['role design', 'decision rights', 'workload', 'capacity', 'incentives', 'missing systems'],
      finding: caseDefinition.mechanism,
      epistemic_class: 'SUPPORTED_HYPOTHESIS',
      people_averaged: false,
    }] : [],
    causal_model: {
      mechanisms: [{
        mechanism_id: mechanismId,
        observed_symptom: `${caseDefinition.name} exhibits a material ${caseDefinition.domains[0]} symptom.`,
        underlying_mechanism: caseDefinition.mechanism,
        causal_chain: caseDefinition.causal_chain,
        evidence_refs: evidenceRefs,
        counterevidence_refs: caseDefinition.contradictory ? [evidenceRefs[1]] : [],
        confounds: ['time-window mismatch', 'market or source-mix change', 'measurement quality'],
        delayed_effects: ['Leading changes may appear before transaction and financial outcomes.'],
        feedback_loops: ['Current outcomes change capacity, attention, and the next operating cycle.'],
        falsifier: 'The mechanism weakens if its named driver changes with adequate fidelity and linked indicators do not respond absent material confounds.',
        epistemic_class: constraintEpistemic,
        affected_domains: caseDefinition.domains,
      }],
      reinforcing_loops: [],
      balancing_loops: [],
      compensating_strengths: [`Existing ${caseDefinition.domains[0]} capability`],
      confounds: ['synthetic fixture confound'],
    },
    governing_constraint: {
      constraint_id: `constraint-${caseDefinition.case_id}`,
      constraint_type: caseDefinition.constraint_type,
      candidate: caseDefinition.constraint_type === 'insufficient_evidence' ? null : caseDefinition.mechanism,
      evidence_refs: caseDefinition.constraint_type === 'insufficient_evidence' ? [] : evidenceRefs,
      alternatives: [{
        constraint_type: 'mixed',
        explanation: 'A coupled constraint may explain the same symptoms.',
        relative_support: 'WEAKER_OR_UNRESOLVED',
      }],
      why_current_candidate_stronger: caseDefinition.constraint_type === 'insufficient_evidence'
        ? 'No candidate is stronger because evidence conflicts.'
        : 'The causal chain spans the observed domains and retains a falsifier.',
      epistemic_class: constraintEpistemic,
      falsifier: caseDefinition.constraint_type === 'insufficient_evidence'
        ? null
        : 'Candidate weakens if throughput improves without changing the named mechanism.',
    },
    assets: [claim({
      id: `asset-${caseDefinition.case_id}`,
      meaning: `The business has an evidence-supported ${caseDefinition.domains[0]} asset.`,
      evidenceRef: primaryEvidenceRef,
      epistemicClass: 'KNOWN',
    })],
    vulnerabilities: [claim({
      id: `vulnerability-${caseDefinition.case_id}`,
      meaning: caseDefinition.mechanism,
      evidenceRef: primaryEvidenceRef,
      epistemicClass: constraintEpistemic,
    })],
    momentum: {
      direction: caseDefinition.momentum,
      emerging_changes: [`The ${caseDefinition.domains.at(-1)} signal is material to direction of travel.`],
      leading_indicators: [{ indicator: `${caseDefinition.domains[0]} leading signal`, evidence_refs: [primaryEvidenceRef] }],
      lagging_indicators: [{ indicator: 'closed transaction or retained financial outcome', evidence_refs: [evidenceRefs.at(-1)] }],
      evidence_refs: evidenceRefs,
      epistemic_class: caseDefinition.contradictory ? 'CONFLICTED' : 'SUPPORTED_HYPOTHESIS',
    },
    epistemic_state: {
      claim_support: [{ claim_id: `constraint-${caseDefinition.case_id}`, epistemic_class: constraintEpistemic }],
      contradictions: context.contradictions,
      counterevidence: caseDefinition.contradictory ? [{ evidence_ref: evidenceRefs[1] }] : [],
      missing_evidence: context.missing_evidence,
      mind_change_conditions: ['Resolve the highest-value missing evidence and observe the named falsifier.'],
    },
    open_questions: context.missing_evidence.map((item) => ({
      question_id: item.missing_id,
      question: item.question,
      expected_decision_impact: item.decision_impact,
    })),
    dynamic_research: caseDefinition.dynamic ? [{
      dynamic_research_warranted: true,
      research_question: `What current local evidence materially changes the ${caseDefinition.domains[0]} interpretation?`,
      authority: 'dynamic-market-or-regulatory-source-required',
      why_freshness_or_gap_matters: 'The current external condition may change mechanism support without rewriting canon.',
      expected_decision_impact: 'Could strengthen, weaken, or contextualize the mechanism while leaving stable doctrine unchanged.',
    }] : [],
    projection_eligibility: {
      five_futures_v2: {
        status: caseDefinition.constraint_type === 'insufficient_evidence' ? 'ELIGIBLE_WITH_DISCLOSURE' : 'ELIGIBLE',
        reasons: ['WBM state exists; trajectories and weights remain downstream.'],
      },
      one_move_v2: {
        status: caseDefinition.constraint_type === 'insufficient_evidence' ? 'BLOCKED_MISSING_EVIDENCE' : 'ELIGIBLE_WITH_DISCLOSURE',
        reasons: ['Constraint/mechanism state exists; candidate ranking and selection remain downstream.'],
      },
    },
    state_lineage: {
      state_version: 1,
      prior_state: null,
      created_at: '2026-08-12T12:00:00.000Z',
      evidence_horizon: 'synthetic-current-state',
      input_hash: context.input_receipt.input_hash,
    },
    downstream_contributions: {
      five_futures_v2: {
        roles: [...FIVE_FUTURES_V2_ROLES],
        state_fields: ['momentum', 'emerging_changes', 'constraints', 'assets', 'vulnerabilities', 'causal_mechanisms', 'evidence', 'counterevidence', 'missing_evidence', 'operator_business_interactions', 'team_context', 'dynamic_context'],
        trajectories_generated: false,
        weights_computed: false,
      },
      one_move_v2: {
        state_fields: ['governing_constraint', 'causal_mechanisms', 'falsifiers', 'operator_business_interactions', 'leading_indicators'],
        candidates_ranked: false,
        move_selected: false,
      },
    },
    runtime_boundaries: { ...LATER_RUNTIME_BOUNDARIES },
  };
  model.fixture_candidate_hash = canonicalHash({ case_id: caseDefinition.case_id, mechanism: caseDefinition.mechanism });
  return model;
}
