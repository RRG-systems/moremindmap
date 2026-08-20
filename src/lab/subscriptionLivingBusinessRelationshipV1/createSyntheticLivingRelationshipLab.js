import { hashCanonicalJson } from '../../lib/intelligenceFabric/hashing.js';
import {
  InMemoryLivingRelationshipStore,
  createAuthorityReference,
  createEvidenceReference,
  createConfirmedPersonalRslMutation,
  createFreeGptLivingRelationshipRuntimeV2,
  createGovernedChangeProposal,
  createHiddenCandidateFromExtraction,
  createInitialLivingBusinessTwinPublication,
  createLivingConversationController,
  createFrontierConversationSeamV2,
  createNaturalAuthorizationInterpreterV1,
  createPostResponseCandidateExtractorV1,
  createProposalDecision,
  initialLivingStateFromBusinessTwin,
  scopeFingerprint,
} from '../../lib/subscriptionV1/index.js';
import { retrieveCoachingDoctrine } from '../../lib/subscriptionV1/afw04/index.js';
import { loadBaProgressiveDisclosureV1 } from '../baProgressiveDisclosureV1/loadBaProgressiveDisclosureV1.js';
import {
  FOUNDER_REVIEW_SUBJECT_V2,
  createSyntheticFounderReviewViewModelV2,
  scanSyntheticFounderReviewCoherenceV2,
} from './createSyntheticFounderReviewSubjectV2.js';
import { createLiveDemoBrowserTransport } from './createLiveDemoBrowserTransport.js';
import {
  createSyntheticRealEstateFounderViewModelV1,
  getSyntheticRealEstateSubjectV1,
} from './createSyntheticRealEstateFounderSubjectsV1.js';

const marcusScope = Object.freeze({
  subject_id: 'subject_synthetic_afw06_marcus',
  membership_id: 'membership_synthetic_afw06_marcus',
  tenant_id: 'tenant_synthetic_afw06',
  profile_id: 'SYNTHETIC-AFW06-MARCUS',
  business_id: 'business_synthetic_afw06_marcus',
});

function scopeForSubject(subjectKey, relationshipKey = null) {
  if (subjectKey === 'marcus' && !relationshipKey) return marcusScope;
  const slug = String(subjectKey).replaceAll(/[^a-z0-9]+/giu, '_');
  const relationshipSlug = relationshipKey ? `_${String(relationshipKey).replaceAll(/[^a-z0-9]+/giu, '_')}` : '';
  return Object.freeze({
    subject_id: `subject_synthetic_subscription_${slug}${relationshipSlug}`,
    membership_id: `membership_synthetic_subscription_${slug}${relationshipSlug}`,
    tenant_id: 'tenant_synthetic_subscription_founder_demo',
    profile_id: `SYNTHETIC-SUBSCRIPTION-${String(subjectKey).toUpperCase()}`,
    business_id: `business_synthetic_subscription_${slug}${relationshipSlug}`,
  });
}

export function syntheticSubscriptionScopeForSubject(subjectKey, relationshipKey = null) {
  return scopeForSubject(subjectKey, relationshipKey);
}

function artifact(scopeValue, artifactType, extra = {}) {
  const contentHash = extra.content_hash || hashCanonicalJson({ campaign: 'subscription-v1-afw06-synthetic', artifactType });
  return {
    artifact_id: `${artifactType.toLowerCase()}_synthetic_afw06`, artifact_type: artifactType, version: '1.0.0', content_hash: contentHash,
    authority: createAuthorityReference({ authority_id: `${artifactType.toLowerCase()}_synthetic_authority`, authority_version: '1.0.0' }),
    parent_artifact_ids: [], created_at: '2026-08-19T09:00:00.000Z', supersedes_artifact_id: null,
    scope: { ...scopeValue }, status: 'COMPLETE', validation_status: 'PASS', compatibility_status: 'COMPATIBLE',
    bindings: extra.bindings || {}, payload: extra.payload || {}, domain_boundary: extra.domain_boundary,
  };
}

function canonicalArtifacts(scope = marcusScope) {
  const bos = artifact(scope, 'NEW_BOS', { payload: {
    communication: 'Marcus thinks clearly when the conversation is direct, calm, and tied to an observable business decision.',
    motivation: 'He wants growth that does not quietly increase how much work returns to him.',
    execution_feasibility: 'A bounded test with visible proof is more workable than a broad reorganization.',
  } });
  const ba = artifact(scope, 'NEW_BA', { payload: {
    business_reality: FOUNDER_REVIEW_SUBJECT_V2.business_reality,
    reported_goal: FOUNDER_REVIEW_SUBJECT_V2.goal,
    missing_evidence: ['Capacity released after delegation has not yet been measured.', 'Manager-owned decision quality is not yet observed.'],
  } });
  const fusion = artifact(scope, 'BOS_BA_FUSION', { bindings: { bos_hash: bos.content_hash, ba_hash: ba.content_hash }, payload: {
    execution_fit: 'Test one contained ownership transfer with explicit boundaries and a weekly evidence review.',
    boundary: 'The business bottleneck comes from business evidence; person truth only shapes how the experiment is made feasible.',
  } });
  const wbm = artifact(scope, 'WHOLE_BUSINESS_MODEL_V1', { bindings: { ba_hash: ba.content_hash, fusion_hash: fusion.content_hash }, domain_boundary: { business_causes: 'BUSINESS_EVIDENCE_ONLY', whole_person_role: 'EXECUTION_FEASIBILITY_ONLY' }, payload: {
    governing_constraint: FOUNDER_REVIEW_SUBJECT_V2.constraint,
    mechanisms: ['Decision rights are incomplete.', 'Managers own tasks but not the full result.', 'Exception handling recenters work on the founder.'],
    causal_chain: ['Incomplete decision boundary', 'exceptions return to Marcus', 'manager ownership weakens', 'capacity remains founder-bound'],
    counterevidence: ['The team already completes routine delivery work reliably.'],
    falsifiers: ['A manager-owned lane holds quality and deadlines for four weeks without founder rescue.'],
  } });
  const futureMeanings = [
    'The current founder-centered pattern continues.',
    'Early manager ownership begins to hold.',
    'A durable management operating lane takes shape.',
    'A broader operating-model change succeeds.',
    'Exceptions and capacity pressure intensify.',
  ];
  const futures = artifact(scope, 'FIVE_FUTURES_V2', { bindings: { wbm_hash: wbm.content_hash }, payload: { trajectories: [22, 17, 29, 21, 11].map((relative_support_weight, index) => ({ role: `ROLE_${index + 1}`, relative_support_weight, meaning: futureMeanings[index], conditional: true })) } });
  const move = artifact(scope, 'ONE_MOVE_V2', { bindings: { wbm_hash: wbm.content_hash }, payload: { selected: true, mechanism_id: 'synthetic_decision_rights_bottleneck', title: FOUNDER_REVIEW_SUBJECT_V2.one_move, intervention: FOUNDER_REVIEW_SUBJECT_V2.one_move_intervention, proof: FOUNDER_REVIEW_SUBJECT_V2.proof } });
  const plan = artifact(scope, 'PLAN_135', { bindings: { wbm_hash: wbm.content_hash, one_move_hash: move.content_hash }, payload: {
    goal: FOUNDER_REVIEW_SUBJECT_V2.goal,
    ways: [{ title: 'Prove one manager-owned lane', strategies: ['Choose the lane', 'Define the owner', 'Write decision rights', 'Set the proof signals', 'Review the evidence weekly'] }, { title: null, strategies: [] }, { title: null, strategies: [] }],
    honest_state: 'One way is complete. Ways two and three remain open and must not be invented.',
  } });
  const evidence = artifact(scope, 'EVIDENCE_LEDGER', { bindings: { ba_hash: ba.content_hash, wbm_hash: wbm.content_hash }, payload: {
    known: ['Demand is reliable.', 'Important exceptions return to Marcus.'],
    inferred: ['Incomplete decision rights may be reinforcing founder dependence.'],
    missing: ['Measured capacity release.', 'Observed manager-owned exception handling.'],
    contradicted: [],
  } });
  return [bos, ba, fusion, wbm, futures, move, plan, evidence];
}

function canonicalRealEstateArtifacts(scope, subject) {
  const withHash = (artifactType, extra) => ({
    ...extra,
    content_hash: hashCanonicalJson({
      campaign: 'subscription-v1-founder-real-estate-synthetic-v1',
      subject_key: subject.key,
      artifact_type: artifactType,
      payload: extra.payload || {},
      bindings: extra.bindings || {},
    }),
  });
  const bos = artifact(scope, 'NEW_BOS', withHash('NEW_BOS', { payload: {
    communication: subject.wholePerson.communication,
    motivation: subject.wholePerson.motivation,
    execution_feasibility: subject.wholePerson.feasibility,
    synthetic_only: true,
  } }));
  const ba = artifact(scope, 'NEW_BA', withHash('NEW_BA', { payload: {
    business_reality: subject.businessReality,
    reported_goal: subject.goal,
    current_metrics: subject.metrics,
    known: subject.known,
    inferred: subject.inferred,
    missing_evidence: subject.missing,
    counterevidence: subject.counterevidence,
    synthetic_only: true,
  } }));
  const fusion = artifact(scope, 'BOS_BA_FUSION', withHash('BOS_BA_FUSION', {
    bindings: { bos_hash: bos.content_hash, ba_hash: ba.content_hash },
    payload: {
      execution_fit: subject.wholePerson.feasibility,
      boundary: 'Business diagnosis remains governed by business evidence. Whole-Person truth shapes communication and execution feasibility only.',
    },
  }));
  const wbm = artifact(scope, 'WHOLE_BUSINESS_MODEL_V1', withHash('WHOLE_BUSINESS_MODEL_V1', {
    bindings: { ba_hash: ba.content_hash, fusion_hash: fusion.content_hash },
    domain_boundary: { business_causes: 'BUSINESS_EVIDENCE_ONLY', whole_person_role: 'EXECUTION_FEASIBILITY_ONLY' },
    payload: {
      governing_constraint_hypothesis: subject.constraint,
      mechanisms: subject.mechanisms,
      causal_chain: subject.mechanisms,
      counterevidence: subject.counterevidence,
      falsifiers: [subject.falsifier],
      uncertainty_rule: 'Multiple explanations remain live until the missing evidence distinguishes them.',
    },
  }));
  const roles = ['CURRENT_COURSE', 'EMERGING_FUTURE', 'BETTER_FUTURE', 'BOLD_FUTURE', 'DOWNSIDE_FUTURE'];
  const futures = artifact(scope, 'FIVE_FUTURES_V2', withHash('FIVE_FUTURES_V2', {
    bindings: { wbm_hash: wbm.content_hash },
    payload: { trajectories: subject.futures.map((relative_support_weight, index) => ({ role: roles[index], relative_support_weight, meaning: subject.futureMeanings[index], conditional: true })) },
  }));
  const move = artifact(scope, 'ONE_MOVE_V2', withHash('ONE_MOVE_V2', {
    bindings: { wbm_hash: wbm.content_hash },
    payload: { selected: true, mechanism_id: `synthetic_${subject.key}_evidence_building`, title: subject.oneMove, intervention: subject.intervention, proof: subject.proof },
  }));
  const plan = artifact(scope, 'PLAN_135', withHash('PLAN_135', {
    bindings: { wbm_hash: wbm.content_hash, one_move_hash: move.content_hash },
    payload: {
      goal: subject.goal,
      ways: [{ title: subject.planWay, strategies: subject.strategies }, { title: null, strategies: [] }, { title: null, strategies: [] }],
      honest_state: 'One evidence-supported way is complete. Ways two and three remain open and must not be invented.',
    },
  }));
  const evidence = artifact(scope, 'EVIDENCE_LEDGER', withHash('EVIDENCE_LEDGER', {
    bindings: { ba_hash: ba.content_hash, wbm_hash: wbm.content_hash },
    payload: { known: subject.known, inferred: subject.inferred, missing: subject.missing, counterevidence: subject.counterevidence, contradicted: [] },
  }));
  return [bos, ba, fusion, wbm, futures, move, plan, evidence];
}

const planItems = [
  { field: 'plan_135.way_2', value: JSON.stringify({ title: 'Build manager-owned delivery', strategies: ['Define one owned outcome', 'Write the decision boundary', 'Publish a weekly scorecard', 'Coach exceptions on a cadence', 'Inspect capacity actually released'] }) },
  { field: 'plan_135.way_3', value: JSON.stringify({ title: 'Build a measured growth lane', strategies: ['Choose one acquisition lane', 'Define qualified demand', 'Set a bounded test', 'Measure stage conversion', 'Keep, change, or stop from evidence'] }) },
];

function acceptedSyntheticOutputs() {
  return [
    {
      customer_message: 'You already have the goal and a strong first path. The unfinished part is giving yourself two genuinely different ways to reach it. I can add a manager-owned delivery path and a measured growth path—each with five concrete strategies—without changing the goal or your current One Move. Would you like me to update the map with those two paths?',
      proposal: { proposal_type: 'PLAN_CHANGE_CANDIDATE', target_contract: 'PLAN_135', operation: 'PROPOSE', summary: 'Complete Ways 2 and 3 of your 1–3–5.', items: planItems, reason: 'The customer asked to finish the 1–3–5 while preserving the accepted goal and first path.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE' },
      research_need: null,
    },
    {
      customer_message: 'That makes sense to challenge. I can record that the downside path now feels overstated because the new contract changes the immediate risk picture. That would not erase the current model; it would add your correction so the map can carry the disagreement honestly. Should I add it?',
      proposal: { proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'LIVING_BUSINESS_STATE', operation: 'PROPOSE', summary: 'Record the customer’s challenge to the current downside trajectory.', items: [{ field: 'five_futures.challenge', value: 'The downside path feels overstated after the newly signed contract changed the immediate risk picture.' }], reason: 'The customer challenged a modeled trajectory with new customer-reported context.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE' },
      research_need: null,
    },
    {
      customer_message: 'Your map and I are working from the same updated state now. The full 1–3–5 is visible, and the accepted plan change is part of what I understand about the business. What feels most important to pressure-test next?',
      proposal: { proposal_type: 'NO_MUTATION', target_contract: null, operation: 'NONE', summary: 'Continue from the newly published Living Twin.', items: [], reason: 'No new durable business fact requires confirmation.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: false, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE' },
      research_need: null,
    },
  ];
}

function candidateType(proposalType, items) {
  if (proposalType === 'PLAN_CHANGE_CANDIDATE') return 'PLAN_CHANGE_CANDIDATE';
  if (proposalType === 'CORRECTION_CANDIDATE') return 'CORRECTION_CANDIDATE';
  if (proposalType === 'COMMITMENT_CANDIDATE') return 'COMMITMENT_CANDIDATE';
  if (items?.some((item) => item.field === 'five_futures.challenge')) return 'FUTURES_CHALLENGE_CANDIDATE';
  if (items?.some((item) => item.field === 'one_move.challenge')) return 'ONE_MOVE_CHALLENGE_CANDIDATE';
  return 'EVIDENCE_CANDIDATE';
}

function splitAcceptedOutputs(outputs) {
  return {
    conversation: outputs.map((output) => ({ customer_message: output.customer_message })),
    candidates: outputs.map((output) => ({ candidate: output.proposal?.proposal_type === 'NO_MUTATION' || !output.proposal
      ? null
      : { candidate_type: candidateType(output.proposal.proposal_type, output.proposal.items), ...output.proposal } })),
  };
}

function productProofQueues(legacy) {
  return {
    CONVERSATION: [legacy.conversation[0], legacy.conversation[2]],
    CANDIDATE_EXTRACTION: [legacy.candidates[0]],
    NATURAL_AUTHORIZATION: [(request) => {
      const input = JSON.parse(request.input[1].content);
      return {
        decision: 'CONFIRM',
        proposal_hash: input.pending_proposal.proposal_hash,
        effective_items: [],
        unambiguous: true,
        reason: 'Accepted synthetic provider fixture: the customer explicitly authorized the exact pending proposal.',
      };
    }],
  };
}

function relationshipContext(sessionKind, subject = null) {
  const firstName = subject?.firstName || 'Marcus';
  const highValueGaps = subject
    ? [...subject.missing, `What capacity or freedom ${firstName} most wants the business to create.`]
    : ['How Marcus behaves when a manager makes a reasonable decision he would have made differently.', 'Whether direct concise coaching remains useful when the business is under delivery pressure.', 'What capacity or freedom Marcus most wants the business to create.', 'Measured capacity released after ownership transfer.'];
  if (sessionKind === 'FIRST_EVER') {
    return {
      session_kind: 'FIRST_EVER',
      mission: 'Begin the real coaching relationship while naturally validating the existing BOS and strengthening the highest-value thin, missing, uncertain, or contradicted person and business evidence.',
      bos_validation: {
        status: 'NOT_YET_COMPLETED',
        reassessment_allowed: false,
        useful_techniques: ['adaptive evidence-seeking questions', 'direct validation of important existing conclusions', 'an optional 1–100 truthfulness question when useful'],
        important_rule: 'There is no question quota or scripted onboarding sequence. Stop initialization naturally when understanding is sufficient for useful coaching.',
        high_value_gaps: highValueGaps,
      },
    };
  }
  return {
    session_kind: 'WEEKLY',
    mission: 'Continue the longitudinal relationship from prior commitments, execution, outcomes, learning, current numbers, and the present Vision-to-Perspective gap. Do not repeat BOS onboarding.',
    bos_validation: { status: 'ESTABLISHED', repeat_weekly: false },
    continuity_rule: 'Use relevant Personal RSL as accumulated relationship memory, never as a prescriptive rulebook or transcript dump.',
  };
}

const MARCUS_WEEKLY_CONTINUITY_SEED = Object.freeze([
  {
    candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
    summary: 'Remember that Marcus wants the numbers first and short direct explanations.',
    items: [{ field: 'evidence.communication_preference', value: 'Give me the numbers first, keep the explanation short, and ask me one strong question.' }],
    reason: 'Marcus explicitly asked MORE to remember this durable communication preference.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  },
  {
    candidate_type: 'COMMITMENT_CANDIDATE', proposal_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135', operation: 'PROPOSE',
    summary: 'Run the manager-owned delivery lane for one full week without rescuing routine exceptions.',
    items: [{ field: 'commitment.weekly', value: 'Run the manager-owned delivery lane for one full week; keep routine decisions with the manager; record any exception Marcus must rescue.' }],
    reason: 'Marcus explicitly made this bounded weekly commitment.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  },
  {
    candidate_type: 'OUTCOME_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
    summary: 'The manager-owned lane completed all five client milestones on time; one unfamiliar pricing exception returned to Marcus; routine decisions stayed with the manager; Marcus recovered four delivery hours.',
    items: [{ field: 'evidence.execution_outcome', value: 'All five client milestones finished on time. One unfamiliar pricing exception returned to Marcus. Routine decisions stayed with the manager. Marcus recovered four delivery hours.' }],
    reason: 'This is synthetic observed outcome evidence for the later-session continuity proof.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
  },
]);

function weeklyContinuitySeed(subject = null) {
  if (!subject) return MARCUS_WEEKLY_CONTINUITY_SEED;
  return [
    {
      candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
      summary: `Remember ${subject.firstName}’s durable communication preference.`,
      items: [{ field: 'evidence.communication_preference', value: subject.weekly.preference }],
      reason: `${subject.firstName} explicitly asked MORE to remember this communication preference.`, evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    },
    {
      candidate_type: 'COMMITMENT_CANDIDATE', proposal_type: 'COMMITMENT_CANDIDATE', target_contract: 'PLAN_135', operation: 'PROPOSE',
      summary: subject.weekly.commitment,
      items: [{ field: 'commitment.weekly', value: subject.weekly.commitment }],
      reason: `${subject.firstName} made this bounded synthetic weekly commitment.`, evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    },
    {
      candidate_type: 'OUTCOME_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
      summary: subject.weekly.outcome,
      items: [{ field: 'evidence.execution_outcome', value: subject.weekly.outcome }],
      reason: 'This is synthetic observed outcome evidence for later-session continuity proof.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    },
  ];
}

async function seedWeeklyContinuity({ runtime, store, sessionId, clock, scope, subject = null }) {
  for (const [index, candidate] of weeklyContinuitySeed(subject).entries()) {
    const packet = runtime.wholeUnderstandingPacket();
    const publication = store.readCurrent({ scope });
    const hidden = createHiddenCandidateFromExtraction({
      session_id: sessionId,
      scope_hash: scopeFingerprint(scope),
      state_packet_hash: packet.base_state_packet.packet_hash,
      candidate,
      created_at: clock(),
    });
    const governed = createGovernedChangeProposal({ hidden_proposal: hidden, scope, source_state_packet: packet.base_state_packet, current_publication: publication.publication, created_at: clock() });
    if (!governed.ok) throw new Error(governed.code);
    const saved = await store.saveProposal({ scope, proposal: governed.proposal, saved_at: clock() });
    if (!saved.ok) throw new Error(saved.code);
    const decision = createProposalDecision({ proposal: governed.proposal, decision: 'CONFIRM', actor: { actor_type: 'CUSTOMER', actor_ref: scope.subject_id }, decided_at: clock(), note: 'Synthetic continuity fixture confirmed through the governed AFW-05 path.' });
    if (!decision.ok) throw new Error(decision.code);
    const mutation = createConfirmedPersonalRslMutation({ proposal: governed.proposal, decision: decision.decision, evidence_catalog: [], event_id: `rsl_synthetic_weekly_${index + 1}`, recorded_at: clock() });
    if (!mutation.ok) throw new Error(mutation.code);
    const committed = await store.commitDecision({ scope, proposal: governed.proposal, decision: decision.decision, event: mutation.event, idempotency_key: `synthetic-weekly-seed:${index + 1}`, committed_at: clock() });
    if (!committed.ok) throw new Error(committed.code);
    const reassembled = runtime.assemble({ as_of_at: clock() });
    if (!reassembled.ok) throw new Error(reassembled.code);
  }
}

export async function createSyntheticLivingRelationshipLab({ accepted_outputs = null, conversation_outputs = null, candidate_outputs = null, authorization_outputs = null, vertical_id = FOUNDER_REVIEW_SUBJECT_V2.vertical_id, product_proof_sequence = false, live_provider = false, transport: suppliedTransport = null, session_kind = 'FIRST_EVER', subject_key = 'marcus', relationship_key = null, store: suppliedStore = null, session_id: suppliedSessionId = null, clock: suppliedClock = null, initial_conversation = [], external_evidence = [], seed_weekly_fixture = true } = {}) {
  const realization = await loadBaProgressiveDisclosureV1('synthetic-top');
  const realEstateSubject = subject_key === 'marcus' ? null : getSyntheticRealEstateSubjectV1(subject_key);
  const subjectVerticalId = realEstateSubject ? 'REAL_ESTATE' : vertical_id;
  const scope = scopeForSubject(subject_key, relationship_key);
  const baseViewModel = realEstateSubject
    ? createSyntheticRealEstateFounderViewModelV1(realization.customerViewModel, subject_key)
    : createSyntheticFounderReviewViewModelV2(realization.customerViewModel);
  const artifacts = realEstateSubject ? canonicalRealEstateArtifacts(scope, realEstateSubject) : canonicalArtifacts(scope);
  const initial = createInitialLivingBusinessTwinPublication({
    scope,
    artifact_lineage: artifacts.map(({ artifact_type, content_hash }) => ({ artifact_type, content_hash })),
    initial_state: initialLivingStateFromBusinessTwin(baseViewModel),
    published_at: '2026-08-19T09:00:00.000Z',
  });
  if (!initial.ok) throw new Error(initial.code);
  const store = suppliedStore || new InMemoryLivingRelationshipStore();
  const existing = store.readCurrent({ scope });
  if (!existing.ok) {
    const initialized = await store.initialize({ scope, publication: initial.publication });
    if (!initialized.ok) throw new Error(initialized.code);
  }
  const legacy = splitAcceptedOutputs(accepted_outputs || acceptedSyntheticOutputs());
  const configuredQueues = {
    CONVERSATION: conversation_outputs || legacy.conversation,
    CANDIDATE_EXTRACTION: candidate_outputs || legacy.candidates,
    NATURAL_AUTHORIZATION: authorization_outputs || [],
  };
  const queues = product_proof_sequence && !accepted_outputs && !conversation_outputs && !candidate_outputs && !authorization_outputs
    ? productProofQueues(legacy)
    : configuredQueues;
  if (!suppliedTransport && !live_provider && (!Array.isArray(queues.CONVERSATION) || !queues.CONVERSATION.length || !Array.isArray(queues.CANDIDATE_EXTRACTION) || !queues.CANDIDATE_EXTRACTION.length)) throw new TypeError('AFW06_ACCEPTED_SYNTHETIC_OUTPUTS_REQUIRED');
  const outputIndex = { CONVERSATION: 0, CANDIDATE_EXTRACTION: 0, NATURAL_AUTHORIZATION: 0 };
  const replayTransport = async (_request, { stage }) => {
    const queue = queues[stage];
    if (!queue?.length) throw new Error(`FREE_GPT_V2_SYNTHETIC_${stage}_OUTPUT_REQUIRED`);
    const queued = queue[Math.min(outputIndex[stage]++, queue.length - 1)];
    const output = typeof queued === 'function' ? queued(_request) : queued;
    return {
    output,
    usage: { input_tokens: 1800, cached_input_tokens: 0, output_tokens: 260 },
    latency_ms: 420,
    first_token_latency_ms: 170,
  };
  };
  const transport = suppliedTransport || (live_provider ? createLiveDemoBrowserTransport() : replayTransport);
  let tick = 0;
  const clock = suppliedClock || (() => new Date(Date.parse('2026-08-19T09:01:00.000Z') + tick++ * 1000).toISOString());
  const conversationSeam = createFrontierConversationSeamV2({ transport, enabled: true, now: clock });
  const candidateExtractor = createPostResponseCandidateExtractorV1({ transport, enabled: true, now: clock });
  const authorizationInterpreter = createNaturalAuthorizationInterpreterV1({ transport, enabled: true, now: clock });
  const businessTruth = [createEvidenceReference({ evidence_id: `synthetic_business_state_${subject_key}`, evidence_domain: 'BUSINESS', content_hash: hashCanonicalJson({ synthetic: true, subject_key, state: 'accepted' }), certainty: 'KNOWN' })];
  const wholePerson = [createEvidenceReference({ evidence_id: `synthetic_execution_context_${subject_key}`, evidence_domain: 'WHOLE_PERSON_EXECUTION', content_hash: hashCanonicalJson({ synthetic: true, subject_key, context: 'execution' }), certainty: 'INFERRED' })];
  const sessionId = suppliedSessionId || `session_synthetic_subscription_${subject_key.replaceAll('-', '_')}_${session_kind.toLowerCase()}`;
  const snapshot = store.snapshot();
  const currentPublication = snapshot.publications?.[snapshot.current_publication_hash] || null;
  const pendingProposal = Object.values(snapshot.proposals || {})
    .filter((entry) => entry?.workflow_status === 'AWAITING_CUSTOMER_DECISION'
      && entry?.proposal?.expected_prior_publication_hash === snapshot.current_publication_hash
      && entry?.proposal?.expected_prior_publication_version === currentPublication?.publication_version)
    .sort((left, right) => String(right.persisted_at).localeCompare(String(left.persisted_at)))[0]?.proposal?.proposal_id || null;
  const runtime = createFreeGptLivingRelationshipRuntimeV2({
    scope,
    session_id: sessionId,
    store,
    conversation_seam: conversationSeam,
    candidate_extractor: candidateExtractor,
    authorization_interpreter: authorizationInterpreter,
    doctrine_retrieval: retrieveCoachingDoctrine({ purpose: session_kind === 'FIRST_EVER' ? 'ONBOARDING' : 'WEEKLY_COACHING', vertical_id: subjectVerticalId }),
    canonical_artifacts: artifacts,
    business_truth: businessTruth,
    whole_person_execution_context: wholePerson,
    vertical_context: { vertical_id: subjectVerticalId || 'NO_MATURE_CASSETTE', business_stage: realEstateSubject?.stage || 'GROWING_FOUNDER_LED', business_model: realEstateSubject ? 'RESIDENTIAL_REAL_ESTATE_AGENT_OR_TEAM' : 'PROFESSIONAL_SERVICES_DELIVERY', fixture_class: 'SYNTHETIC_ONLY' },
    external_evidence,
    relationship_context: relationshipContext(session_kind, realEstateSubject),
    initial_conversation,
    initial_pending_proposal_id: pendingProposal,
    clock,
  });
  const assembled = runtime.assemble({ visible_customer_context: { surface: 'Plan', visible_objects: ['Goal', 'Way 1', 'Open Way 2', 'Open Way 3'] }, as_of_at: clock() });
  if (!assembled.ok) throw new Error(assembled.code);
  if (session_kind === 'WEEKLY' && seed_weekly_fixture) await seedWeeklyContinuity({ runtime, store, sessionId, clock, scope, subject: realEstateSubject });
  const controller = createLivingConversationController({ runtime, store, scope, base_view_model: baseViewModel, evidence_catalog: [] });
  const coherence = realEstateSubject
    ? { valid: true, matches: [], synthetic_subject_key: subject_key }
    : scanSyntheticFounderReviewCoherenceV2({
      subject: FOUNDER_REVIEW_SUBJECT_V2,
      base_view_model: baseViewModel,
      canonical_artifacts: artifacts,
      vertical_context: { vertical_id: subjectVerticalId || 'NO_MATURE_CASSETTE', business_model: 'PROFESSIONAL_SERVICES_DELIVERY' },
      whole_coaching_understanding: controller.wholeUnderstandingPacket().provider_understanding,
    });
  if (!coherence.valid) throw new Error(`FREE_GPT_V2_SYNTHETIC_PACKET_INCOHERENT:${coherence.matches.join('|')}`);
  return {
    controller,
    scope,
    baseViewModel,
    founder_review_subject: realEstateSubject || FOUNDER_REVIEW_SUBJECT_V2,
    founder_review_coherence: coherence,
    relationship_context: relationshipContext(session_kind, realEstateSubject),
    current_profile_key: subject_key,
    profile_options: [
      { key: 're-mid', label: 'Jordan · Mid-level agent · Primary Founder test' },
      { key: 're-early', label: 'Elena · Early-stage agent' },
      { key: 're-team', label: 'Sofia · Team transition' },
      { key: 'marcus', label: 'Marcus · Professional-services portability' },
    ],
    fixture: { synthetic_only: true, network_calls: live_provider || suppliedTransport ? 'LIVE_PROVIDER_BOUNDED' : 0, real_customer_data: false, provider_replay: live_provider || suppliedTransport ? 'NONE_LIVE_GPT_5_6_SOL' : 'ACCEPTED_SYNTHETIC_OUTPUT_SEQUENCE' },
  };
}
