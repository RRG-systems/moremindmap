import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { scopeFingerprint } from '../contracts.js';
import { EphemeralTranscriptBuffer } from '../personalRsl.js';
import { retrieveRelevantPersonalHistory } from '../retrieval.js';
import { createGovernedChangeProposal, createProposalDecision } from '../afw05/contracts.js';
import { createConfirmedPersonalRslMutation } from '../afw05/personalRslMutation.js';
import { createHiddenCandidateFromExtraction } from './contracts.js';
import { assembleWholeCoachingUnderstandingPacketV2 } from './wholeCoachingPacket.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createFreeGptLivingRelationshipRuntimeV2({
  scope,
  session_id,
  store,
  conversation_seam,
  candidate_extractor,
  authorization_interpreter,
  doctrine_retrieval,
  canonical_artifacts,
  business_truth,
  whole_person_execution_context,
  uncertainty = [],
  vertical_context = null,
  external_evidence = [],
  evidence_catalog = [],
  relationship_context = null,
  initial_conversation = [],
  initial_pending_proposal_id = null,
  clock = () => new Date().toISOString(),
}) {
  if (!store || !conversation_seam || !candidate_extractor || !authorization_interpreter || !doctrine_retrieval) throw new TypeError('FREE_GPT_V2_RUNTIME_DEPENDENCIES_REQUIRED');
  const transcript = new EphemeralTranscriptBuffer({ max_turns: 24 });
  let currentUnderstanding = null;
  let pendingProposalId = initial_pending_proposal_id;
  let currentExternalEvidence = clone(external_evidence);
  for (const turn of initial_conversation) {
    if (!['customer', 'coach'].includes(turn?.role) || typeof turn?.content !== 'string' || !turn.content.trim()) {
      throw new TypeError('FREE_GPT_V2_INITIAL_CONVERSATION_INVALID');
    }
    transcript.push({ role: turn.role, content: turn.content.trim() });
  }

  function assemble({
    purpose = relationship_context?.session_kind === 'FIRST_EVER' ? 'ONBOARDING' : 'WEEKLY_COACHING',
    active_lens = 'OVERVIEW',
    topics = [],
    visible_customer_context = null,
    as_of_at = clock(),
  } = {}) {
    const rslStore = store.buildPersonalRslStore({ scope });
    const history = retrieveRelevantPersonalHistory({ store: rslStore, scope, purpose, active_lens, topics, as_of_at });
    if (!history.ok) return history;
    const publication = store.readCurrent({ scope });
    if (!publication.ok) return publication;
    const assembled = assembleWholeCoachingUnderstandingPacketV2({
      scope,
      session_id,
      artifacts: canonical_artifacts,
      personal_history: history,
      business_truth,
      whole_person_execution_context,
      uncertainty,
      current_state: {
        living_publication_version: publication.publication.publication_version,
        living_publication_hash: publication.publication.publication_hash,
        five_boxes: publication.publication.five_boxes,
        engagement: publication.publication.engagement,
      },
      doctrine_retrieval,
      vertical_context,
      conversation: transcript.snapshot().turns,
      visible_customer_context,
      external_evidence: currentExternalEvidence,
      relationship_context,
      purpose,
      active_lens,
      assembled_at: as_of_at,
    });
    if (assembled.ok) currentUnderstanding = assembled.packet;
    return assembled;
  }

  async function commitProposalDecision({ proposal, decision, edited_items = [], note = null, idempotency_key }) {
    const decidedAt = clock();
    const created = createProposalDecision({
      proposal,
      decision,
      actor: { actor_type: 'CUSTOMER', actor_ref: scope.subject_id },
      edited_items,
      decided_at: decidedAt,
      note,
    });
    if (!created.ok) return created;
    let event = null;
    if (created.decision.mutation_authorized) {
      const mutation = createConfirmedPersonalRslMutation({
        proposal,
        decision: created.decision,
        evidence_catalog,
        event_id: `rsl_${hashCanonicalJson({ proposal_id: proposal.proposal_id, decision_hash: created.decision.decision_hash }).slice(0, 24)}`,
        recorded_at: decidedAt,
      });
      if (!mutation.ok) return mutation;
      event = mutation.event;
    }
    const committed = await store.commitDecision({ scope, proposal, decision: created.decision, event, idempotency_key, committed_at: decidedAt });
    if (!committed.ok) return committed;
    pendingProposalId = null;
    if (committed.mutation_performed) {
      const activeObject = proposal.affected_governed_objects[0];
      const reassembled = assemble({
        purpose: proposal.proposal_type === 'PLAN_CHANGE_CANDIDATE' ? 'FINISH_PLAN_135' : 'WEEKLY_COACHING',
        active_lens: activeObject === 'PLAN_135' ? 'PLAN' : activeObject || 'OVERVIEW',
        as_of_at: decidedAt,
      });
      if (!reassembled.ok) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_POST_PUBLICATION_ASSEMBLY_FAILED', detail: reassembled.code });
    }
    return deepFreeze({ ...clone(committed), decision: created.decision, next_state_packet: currentUnderstanding?.base_state_packet || null, continuation_ready: true });
  }

  return Object.freeze({
    inspect() {
      const current = store.readCurrent({ scope });
      return deepFreeze({
        ok: current.ok,
        architecture: 'WHOLE_COACHING_UNDERSTANDING_PLUS_FREE_FRONTIER_CONVERSATION',
        exact_scope_bound: true,
        current_publication_version: current.publication?.publication_version || null,
        current_publication_hash: current.publication?.publication_hash || null,
        pending_proposal_id: pendingProposalId,
        raw_transcript_durable: false,
        conversation_tree_runtime: false,
        provider_direct_mutation: false,
        universal_rsl_runtime_read: false,
        relationship_session_kind: relationship_context?.session_kind || 'WEEKLY',
        governed_external_evidence_count: currentExternalEvidence.length,
        afw05_mutation_core_reused: true,
      });
    },

    assemble,

    async coach({
      customer_turn,
      purpose = relationship_context?.session_kind === 'FIRST_EVER' ? 'ONBOARDING' : 'WEEKLY_COACHING',
      active_lens = 'OVERVIEW',
      topics = [],
      visible_customer_context = null,
    }) {
      if (typeof customer_turn !== 'string' || !customer_turn.trim()) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CUSTOMER_MESSAGE_REQUIRED' });
      const normalizedTurn = customer_turn.trim();
      transcript.push({ role: 'customer', content: normalizedTurn });
      let authorization = null;
      let decisionResult = null;

      if (pendingProposalId) {
        const found = store.readProposal({ scope, proposal_id: pendingProposalId });
        if (!found.ok) return found;
        authorization = await authorization_interpreter.interpret({ proposal: found.proposal, customer_message: normalizedTurn });
        if (!authorization.ok) return authorization;
        if (['CONFIRM', 'EDIT', 'DEFER', 'REJECT'].includes(authorization.decision)) {
          decisionResult = await commitProposalDecision({
            proposal: found.proposal,
            decision: authorization.decision,
            edited_items: authorization.decision === 'EDIT' ? authorization.effective_items : [],
            note: 'Natural customer authorization interpreted against the exact pending proposal.',
            idempotency_key: `natural:${found.proposal.proposal_id}:${hashCanonicalJson({ message: normalizedTurn, decision: authorization.decision, items: authorization.effective_items })}`,
          });
          if (!decisionResult.ok) return decisionResult;
        }
      }

      const assembled = assemble({ purpose, active_lens, topics, visible_customer_context });
      if (!assembled.ok) return assembled;
      const coaching = await conversation_seam.coach({ packet: currentUnderstanding, customer_message: normalizedTurn, mutation_performed: Boolean(decisionResult?.mutation_performed) });
      if (!coaching.ok) return coaching;
      transcript.push({ role: 'coach', content: coaching.customer_message });
      if (coaching.external_evidence?.length) {
        const byId = new Map(currentExternalEvidence.map((item) => [item.external_evidence_id, item]));
        for (const item of coaching.external_evidence) byId.set(item.external_evidence_id, clone(item));
        currentExternalEvidence = [...byId.values()];
        const researched = assemble({ purpose, active_lens, topics, visible_customer_context });
        if (!researched.ok) return researched;
      }

      if (decisionResult || (authorization && ['AMBIGUOUS', 'NONE'].includes(authorization.decision))) {
        const publication = store.readCurrent({ scope });
        return deepFreeze({
          ok: true,
          code: decisionResult ? 'FREE_GPT_V2_NATURAL_AUTHORIZATION_TURN_COMPLETE' : 'FREE_GPT_V2_AMBIGUOUS_AUTHORIZATION_TURN_COMPLETE',
          customer_message: coaching.customer_message,
          proposal: decisionResult ? null : store.readProposal({ scope, proposal_id: pendingProposalId }).proposal,
          confirmation_required: !decisionResult,
          authorization,
          decision: decisionResult?.decision || null,
          publication: publication.publication,
          mutation_performed: Boolean(decisionResult?.mutation_performed),
          provider_receipts: [authorization?.receipt, coaching.receipt].filter(Boolean),
          research: coaching.research,
          external_evidence: clone(coaching.external_evidence || []),
          extraction: { candidate: null, skipped: true, reason: decisionResult ? 'AUTHORIZATION_HANDLED' : 'PENDING_PROPOSAL_REMAINS' },
        });
      }

      const extraction = await candidate_extractor.extract({ packet: currentUnderstanding, customer_message: normalizedTurn, coach_message: coaching.customer_message });
      if (!extraction.ok) return extraction;
      const publication = store.readCurrent({ scope });
      let proposal = null;
      if (extraction.candidate) {
        let supersedesEventIds = [];
        if (extraction.candidate.proposal_type === 'CORRECTION_CANDIDATE') {
          const replay = store.buildPersonalRslStore({ scope }).replay({ scope, effective_as_of: clock(), recorded_as_of: clock() });
          if (!replay.ok) return replay;
          const correctedFields = new Set(extraction.candidate.items.map((item) => item.field));
          supersedesEventIds = replay.state.active_events
            .filter((event) => (event.semantic_payload?.items || []).some((item) => correctedFields.has(item.field)))
            .map((event) => event.event_id);
          if (!supersedesEventIds.length) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CORRECTION_TARGET_REQUIRED' });
        }
        const hidden = createHiddenCandidateFromExtraction({
          session_id,
          scope_hash: scopeFingerprint(scope),
          state_packet_hash: currentUnderstanding.base_state_packet.packet_hash,
          candidate: extraction.candidate,
          created_at: clock(),
        });
        const governed = createGovernedChangeProposal({
          hidden_proposal: hidden,
          scope,
          source_state_packet: currentUnderstanding.base_state_packet,
          current_publication: publication.publication,
          created_at: clock(),
          supersedes_event_ids: supersedesEventIds,
        });
        if (!governed.ok) return governed;
        const saved = await store.saveProposal({ scope, proposal: governed.proposal, saved_at: clock() });
        if (!saved.ok) return saved;
        proposal = governed.proposal;
        if (proposal.proposal_class === 'DURABLE_MUTATION_PROPOSED') pendingProposalId = proposal.proposal_id;
      }
      return deepFreeze({
        ok: true,
        code: 'FREE_GPT_V2_COACHING_TURN_COMPLETE',
        customer_message: coaching.customer_message,
        proposal,
        confirmation_required: proposal?.proposal_class === 'DURABLE_MUTATION_PROPOSED',
        authorization: null,
        publication: publication.publication,
        mutation_performed: false,
        provider_receipts: [coaching.receipt, extraction.receipt],
        research: coaching.research,
        external_evidence: clone(coaching.external_evidence || []),
        extraction: { candidate: extraction.candidate, skipped: false },
      });
    },

    async decide({ proposal_id, decision, edited_items = [], note = null, idempotency_key }) {
      const found = store.readProposal({ scope, proposal_id });
      if (!found.ok) return found;
      return commitProposalDecision({ proposal: found.proposal, decision, edited_items, note, idempotency_key });
    },

    currentStatePacket() { return currentUnderstanding?.base_state_packet ? deepFreeze(clone(currentUnderstanding.base_state_packet)) : null; },
    wholeUnderstandingPacket() { return currentUnderstanding ? deepFreeze(clone(currentUnderstanding)) : null; },
    pendingProposal() {
      if (!pendingProposalId) return null;
      const found = store.readProposal({ scope, proposal_id: pendingProposalId });
      return found.ok && found.workflow_status === 'AWAITING_CUSTOMER_DECISION' ? deepFreeze(clone(found.proposal)) : null;
    },
    transcriptBoundary() { return transcript.snapshot(); },
    externalEvidenceBoundary() { return deepFreeze(clone(currentExternalEvidence)); },
    clearEphemeralConversation() { return transcript.clear(); },
  });
}
