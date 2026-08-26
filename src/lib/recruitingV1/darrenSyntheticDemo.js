import { SYNTHETIC_REAL_ESTATE_SUBJECTS_V1 } from '../../lab/subscriptionLivingBusinessRelationshipV1/createSyntheticRealEstateFounderSubjectsV1.js';
import { boundedText, stableHash } from './contracts.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const JORDAN = SYNTHETIC_REAL_ESTATE_SUBJECTS_V1['re-mid'];

export const DARREN_SYNTHETIC_DEMO_CONTRACT = 'recruiting_darren_synthetic_demo_v1';
export const DARREN_SYNTHETIC_DEMO_CANDIDATE_ID = 'demo_synthetic_jordan_v1';

function jordanBosAuthority() {
  return Object.freeze({
    authority_class: 'SYNTHETIC_BOS',
    subject_ref: 'subscription_synthetic_real_estate_subject_v1:re-mid',
    evidence: {
      jordan_bos_communication: { dimension: 'communication', narrative_hint: JORDAN.wholePerson.communication },
      jordan_bos_motivation: { dimension: 'motivation', narrative_hint: JORDAN.wholePerson.motivation },
      jordan_bos_feasibility: { dimension: 'execution_feasibility', narrative_hint: JORDAN.wholePerson.feasibility },
    },
    summary: `${JORDAN.wholePerson.communication} ${JORDAN.wholePerson.motivation}`,
    missing: ['No real-customer behavioral evidence exists because Jordan is a synthetic demo subject.'],
  });
}

function jordanBaAuthority() {
  const evidence = Object.fromEntries([
    ...JORDAN.known.map((statement, index) => [`jordan_ba_known_${index + 1}`, { truth_class: 'SYNTHETIC_REPORTED', statement }]),
    ...JORDAN.inferred.map((statement, index) => [`jordan_ba_inferred_${index + 1}`, { truth_class: 'SYNTHETIC_INFERENCE', statement }]),
    ['jordan_ba_constraint', { truth_class: 'SYNTHETIC_GOVERNED_HYPOTHESIS', statement: JORDAN.constraint }],
    ['jordan_ba_one_move', { truth_class: 'SYNTHETIC_GOVERNED_RECOMMENDATION', statement: JORDAN.oneMove }],
  ]);
  return Object.freeze({
    authority_class: 'SYNTHETIC_BA',
    subject_ref: 'subscription_synthetic_real_estate_subject_v1:re-mid',
    intelligence_ready: true,
    evidence,
    summary: JORDAN.businessReality,
    missing: clone(JORDAN.missing),
  });
}

function baselineOpportunity() {
  return {
    authority_id: 'demo_synthetic_opportunity_jordan_v1',
    enterprise_id: 'demo_synthetic_enterprise_v1',
    demo_only: true,
    items: [
      {
        opportunity_evidence_id: 'demo_opp_evidence_review', category: 'COACHING_AND_TRAINING', scope: 'LOCAL_LEADER_PRIMARY',
        statement: 'The synthetic demo assumes access to a structured opportunity-and-capacity evidence review; actual Darren or enterprise capabilities are not asserted.',
        status: 'SUPPORTED', source: 'Synthetic demo authority', source_date: '2026-08-23', freshness: 'SYNTHETIC_BASELINE', constraints: ['Demo-only capability; verify real availability before any customer conversation.'], counterevidence: [],
      },
      {
        opportunity_evidence_id: 'demo_opp_leverage_hypothesis', category: 'OPERATIONS_AND_LEVERAGE', scope: 'LOCAL_LEADER_PRIMARY',
        statement: 'A bounded first-leverage decision review is available in the synthetic scenario when opportunity, economics, and transferable-work evidence support it.',
        status: 'CONDITIONAL', source: 'Synthetic demo authority', source_date: '2026-08-23', freshness: 'SYNTHETIC_BASELINE', constraints: ['No hiring outcome or operating support is promised.'], counterevidence: ['Jordan may need better opportunity evidence before leverage is the next move.'],
      },
      {
        opportunity_evidence_id: 'demo_opp_no_lead_promise', category: 'LEAD_OPPORTUNITY', scope: 'LOCAL_LEADER_PRIMARY',
        statement: 'The demo establishes no company-provided lead volume, allocation, or conversion outcome.',
        status: 'NON_PROMISE', source: 'Synthetic demo authority', source_date: '2026-08-23', freshness: 'SYNTHETIC_BASELINE', constraints: [], counterevidence: [],
      },
    ],
  };
}

function baselineEvidence() {
  return [
    {
      evidence_id: 'demo_evidence_growth_goal', candidate_id: DARREN_SYNTHETIC_DEMO_CANDIDATE_ID, type: 'GOAL',
      claim: JORDAN.goal, source: 'Synthetic Jordan fixture', source_date: '2026-08-23', recorded_at: '2026-08-23T00:00:00.000Z',
      truth_class: 'MANAGER_SUPPLIED_EVIDENCE', canonical_recruit_truth_mutated: false, demo_only: true,
    },
    {
      evidence_id: 'demo_evidence_leverage_question', candidate_id: DARREN_SYNTHETIC_DEMO_CANDIDATE_ID, type: 'OBSERVATION',
      claim: 'Jordan is considering a first assistant, while the scenario intentionally leaves the dominant constraint unresolved.',
      source: 'Synthetic Jordan fixture', source_date: '2026-08-23', recorded_at: '2026-08-23T00:00:00.000Z',
      truth_class: 'MANAGER_SUPPLIED_EVIDENCE', canonical_recruit_truth_mutated: false, demo_only: true,
    },
  ];
}

function baselineIntelligence() {
  return {
    contract: 'recruiting_intelligence_projection_v1',
    generated_at: '2026-08-23T00:00:00.000Z',
    stale: false,
    demo_only: true,
    synthetic_recruit: true,
    output: {
      understand_this_recruit: {
        summary: 'Jordan is pursuing material growth while testing whether stronger operating evidence or first leverage deserves priority.',
        important_realities: ['The growth goal is explicit.', 'The dominant constraint remains deliberately unresolved.'],
      },
      bilateral_communication: {
        advantage: 'Darren can make the decision concrete without pretending the missing evidence is settled.',
        recruiter_watchout: 'A decisive recommendation would outrun the synthetic evidence currently available.',
        adaptation: 'Separate opportunity-flow proof from leverage readiness and let Jordan test both hypotheses.',
      },
      authentic_angles: [{
        title: 'Test the first-leverage decision against current opportunity flow',
        recruit_need: 'Jordan wants growth without simply adding personal workload.',
        current_reality: 'The scenario supports a leverage question but leaves pipeline and transferable-work evidence incomplete.',
        locally_supported_help: 'A synthetic bounded opportunity-and-capacity evidence review is supported in this demo.',
        rationale: 'The review can distinguish whether leverage or opportunity generation is the nearer constraint.',
        validating_question: 'What evidence would tell you an assistant removes a real constraint rather than adding management work?',
        uncertainty: 'Actual repeatable opportunity flow and transferable work volume remain unknown.',
        recruit_evidence_ids: ['demo_evidence_growth_goal'],
        opportunity_evidence_ids: ['demo_opp_evidence_review'],
      }],
      withheld_angles: ['No lead-volume or production promise is supported by the synthetic opportunity authority.'],
      success_environment: {
        natural_success_patterns: ['Purposeful relationship-led growth with visible operating proof'],
        supportive_conditions: ['Clear ownership boundaries', 'Truthful weekly numbers'],
        likely_frictions: ['Hiring before work and economics are visible'],
      },
      missing_evidence: ['Qualified opportunity flow', 'Transferable recurring work', 'Assistant economics'],
      meeting_plan: {
        start_here: 'Ask Jordan what changed between the current production level and the stated growth goal.',
        learn: ['How opportunity is created now', 'Which recurring work can leave Jordan’s hands'],
        listen_for: ['A demand constraint', 'An ownership constraint'],
        your_watchout: 'Do not assume first leverage is the answer because it is under consideration.',
        supported_paths_if_confirmed: ['Opportunity-and-capacity evidence review'],
        do_not_assume: 'Do not imply a lead source, staffing result, or recruiting promise.',
        next_step_if_fit_is_real: 'Agree on one bounded evidence review before recommending a move.',
      },
    },
  };
}

export function createDarrenSyntheticDemoBaseline({ managerName = 'Darren', enterpriseName = 'MORE MindMap' } = {}) {
  const recruitBos = jordanBosAuthority();
  const recruitBa = jordanBaAuthority();
  const candidate = {
    candidate_id: DARREN_SYNTHETIC_DEMO_CANDIDATE_ID,
    invitation_id: null,
    recruit_name: 'Jordan Lee',
    recruit_email: null,
    purpose: 'Synthetic Recruiting V1 demonstration only.',
    state: 'DEMO_ONLY', readiness_state: 'BA_INTELLIGENCE_READY', ba_readiness: 'BA_INTELLIGENCE_READY',
    delivery_state: 'NOT_APPLICABLE', entitlement_state: 'NOT_APPLICABLE', accepted_at: null,
    bos_profile_id: 'synthetic:re-mid:bos-v1', ba_assessment_id: 'synthetic:re-mid:ba-v1',
    demo_only: true, synthetic_only: true,
  };
  const state = {
    contract: DARREN_SYNTHETIC_DEMO_CONTRACT,
    baseline_version: '1.0.0',
    demo_only: true,
    synthetic_only: true,
    label: 'DEMO CANDIDATE — SYNTHETIC DATA',
    manager: { name: managerName, enterprise_name: enterpriseName, capabilities: { darren_demo: true } },
    candidates: [candidate],
    recruit: {
      name: 'Jordan Lee', readiness: 'BA_INTELLIGENCE_READY',
      bos_summary: recruitBos.summary,
      ba_summary: recruitBa.summary,
      known: ['Synthetic BOS authority ready', 'Synthetic BA authority ready', ...JORDAN.known.slice(0, 4)],
      unknown: clone(JORDAN.missing),
    },
    opportunity: baselineOpportunity(),
    manager_evidence: baselineEvidence(),
    intelligence: baselineIntelligence(),
    internal_authority: {
      recruit_bos: recruitBos,
      recruit_ba: recruitBa,
      recruit_bos_sha256: stableHash(recruitBos),
      recruit_ba_sha256: stableHash(recruitBa),
    },
    resettable: true,
    updated_at: null,
  };
  return Object.freeze(clone(state));
}

export function publicDarrenSyntheticDemoState(state, { entitlement, managerAuthorityMode = 'SYNTHETIC_BOS_ONLY' } = {}) {
  const projected = clone(state);
  delete projected.internal_authority;
  if (projected.intelligence) delete projected.intelligence.manager_bos_reference_sha256;
  projected.entitlement = clone(entitlement);
  projected.manager_authority_mode = managerAuthorityMode;
  projected.ledger_effect = Object.freeze({ invitations: 0, emails: 0, relationships: 0, entitlement: 0, recruiting_audit: 0 });
  return Object.freeze(projected);
}

export function assembleDarrenSyntheticDemoInputs({ state, membership, managerBos }) {
  if (state?.contract !== DARREN_SYNTHETIC_DEMO_CONTRACT || state?.demo_only !== true) throw new Error('RECRUITING_DEMO_STATE_INVALID');
  return Object.freeze({
    membership: {
      membership_id: `demo:${membership.membership_id}`,
      enterprise_id: `demo:${membership.enterprise_id}`,
    },
    invitation: {
      candidate_id: DARREN_SYNTHETIC_DEMO_CANDIDATE_ID,
      bos_profile_id: 'synthetic:re-mid:bos-v1',
    },
    managerBos,
    recruitBos: clone(state.internal_authority.recruit_bos),
    recruitBa: clone(state.internal_authority.recruit_ba),
    opportunity: clone(state.opportunity),
    managerEvidence: clone(state.manager_evidence),
  });
}

export function addDarrenSyntheticDemoEvidence(state, input, now = new Date()) {
  const claim = boundedText(input?.claim, 2000);
  const source = boundedText(input?.source, 300);
  const type = boundedText(input?.type, 80);
  const sourceDate = boundedText(input?.source_date, 40);
  if (!claim || !source || !type || !/^\d{4}-\d{2}-\d{2}$/u.test(sourceDate)) throw new Error('RECRUITING_DEMO_EVIDENCE_INVALID');
  const next = clone(state);
  const evidence = {
    evidence_id: `demo_evidence_${stableHash({ claim, source, sourceDate }).slice(0, 16)}`,
    candidate_id: DARREN_SYNTHETIC_DEMO_CANDIDATE_ID,
    type, claim, source, source_date: sourceDate, recorded_at: now.toISOString(),
    truth_class: 'MANAGER_SUPPLIED_EVIDENCE', canonical_recruit_truth_mutated: false, demo_only: true,
  };
  if (!next.manager_evidence.some((item) => item.evidence_id === evidence.evidence_id)) next.manager_evidence.push(evidence);
  if (next.intelligence) next.intelligence.stale = true;
  next.updated_at = now.toISOString();
  return Object.freeze({ state: next, evidence });
}

export function saveDarrenSyntheticDemoOpportunity(state, items, now = new Date()) {
  if (!Array.isArray(items) || items.length > 30 || items.some((item) => item?.demo_only !== true && item?.source !== 'Synthetic demo authority')) {
    throw new Error('RECRUITING_DEMO_OPPORTUNITY_INVALID');
  }
  const next = clone(state);
  next.opportunity.items = clone(items).map((item) => ({ ...item, demo_only: true }));
  if (next.intelligence) next.intelligence.stale = true;
  next.updated_at = now.toISOString();
  return Object.freeze(next);
}

export function saveDarrenSyntheticDemoIntelligence(state, intelligence, { managerBosReferenceSha256, now = new Date() } = {}) {
  if (intelligence?.contract !== 'recruiting_intelligence_projection_v1' || !intelligence?.output) throw new Error('RECRUITING_DEMO_INTELLIGENCE_INVALID');
  const next = clone(state);
  next.intelligence = {
    ...clone(intelligence),
    generated_at: now.toISOString(),
    stale: false,
    demo_only: true,
    synthetic_recruit: true,
    manager_bos_reference_sha256: managerBosReferenceSha256,
  };
  next.updated_at = now.toISOString();
  return Object.freeze(next);
}

export const DARREN_SYNTHETIC_DEMO_INVARIANTS = Object.freeze({
  real_invitation_created: false,
  email_delivery_permitted: false,
  entitlement_consumed: false,
  real_relationship_created: false,
  canonical_customer_mutation_permitted: false,
  manager_bos_storage_permitted: false,
  real_recruiting_audit_permitted: false,
});
