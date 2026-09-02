import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { assembleCoachingStatePacket } from '../coachingState.js';
import { EphemeralTranscriptBuffer } from '../personalRsl.js';
import { retrieveRelevantPersonalHistory } from '../retrieval.js';
import { createGovernedChangeProposal, createProposalDecision } from './contracts.js';
import { createConfirmedPersonalRslMutation } from './personalRslMutation.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createLivingBusinessRelationshipRuntime({
  scope,
  session_id,
  store,
  frontier_runtime,
  doctrine_retrieval,
  canonical_artifacts,
  business_truth,
  whole_person_execution_context,
  vertical_context = null,
  initial_purpose = 'WEEKLY_COACHING',
  initial_lens = 'OVERVIEW',
  clock = () => new Date().toISOString(),
}) {
  if (!store || !frontier_runtime || !doctrine_retrieval) throw new TypeError('AFW05_RUNTIME_DEPENDENCIES_REQUIRED');
  const transcript = new EphemeralTranscriptBuffer({ max_turns: 24 });
  let currentPacket = null;

  function assemble({ purpose = initial_purpose, active_lens = initial_lens, as_of_at = clock() } = {}) {
    const rslStore = store.buildPersonalRslStore({ scope });
    const history = retrieveRelevantPersonalHistory({ store: rslStore, scope, purpose, active_lens, as_of_at });
    if (!history.ok) return history;
    const publication = store.readCurrent({ scope });
    if (!publication.ok) return publication;
    const assembled = assembleCoachingStatePacket({
      scope,
      session_id,
      purpose,
      active_lens,
      artifacts: canonical_artifacts,
      personal_history: history,
      business_truth,
      whole_person_execution_context,
      uncertainty: [],
      current_state: {
        living_publication_id: publication.publication.publication_id,
        living_publication_version: publication.publication.publication_version,
        living_publication_hash: publication.publication.publication_hash,
        five_boxes: publication.publication.five_boxes,
        engagement: publication.publication.engagement,
      },
      assembled_at: as_of_at,
    });
    if (assembled.ok) currentPacket = assembled.packet;
    return assembled;
  }

  return Object.freeze({
    inspect() {
      const current = store.readCurrent({ scope });
      return deepFreeze({
        ok: current.ok,
        exact_scope_bound: true,
        current_publication_version: current.publication?.publication_version || null,
        current_publication_hash: current.publication?.publication_hash || null,
        raw_transcript_durable: false,
        conversation_tree_runtime: false,
        provider_direct_mutation: false,
        universal_rsl_runtime_read: false,
      });
    },

    assemble,

    async coach({ customer_turn, purpose = initial_purpose, active_lens = initial_lens, external_evidence = [] }) {
      if (!currentPacket) {
        const assembled = assemble({ purpose, active_lens });
        if (!assembled.ok) return assembled;
      }
      transcript.push({ role: 'customer', content: customer_turn });
      const result = await frontier_runtime.coach({
        state_packet: currentPacket,
        doctrine_retrieval,
        customer_turn,
        vertical_context,
        external_evidence,
        history: transcript.snapshot().turns,
        session_id,
        scope_hash: currentPacket.scope ? hashCanonicalJson(currentPacket.scope) : null,
      });
      if (!result.ok) return result;
      transcript.push({ role: 'coach', content: result.customer_message });
      const publication = store.readCurrent({ scope });
      const governed = createGovernedChangeProposal({
        hidden_proposal: result.hidden_proposal,
        scope,
        source_state_packet: currentPacket,
        current_publication: publication.publication,
        created_at: clock(),
      });
      if (!governed.ok) return governed;
      const saved = await store.saveProposal({ scope, proposal: governed.proposal, saved_at: clock() });
      if (!saved.ok) return saved;
      return deepFreeze({
        ok: true,
        code: 'AFW05_COACHING_TURN_COMPLETE',
        customer_message: result.customer_message,
        proposal: governed.proposal,
        confirmation_required: governed.proposal.confirmation_required,
        research_need: result.research_need,
        provider_receipt: result.receipt,
        publication: publication.publication,
        mutation_performed: false,
      });
    },

    async decide({ proposal_id, decision, edited_items = [], note = null, evidence_catalog = [], idempotency_key }) {
      const found = store.readProposal({ scope, proposal_id });
      if (!found.ok) return found;
      const decidedAt = clock();
      const created = createProposalDecision({
        proposal: found.proposal,
        decision,
        actor: { actor_type: 'CUSTOMER', actor_ref: scope.subject_id },
        edited_items,
        decided_at: decidedAt,
        note,
      });
      if (!created.ok) return created;
      let event = null;
      if (created.decision.mutation_authorized) {
        const rslStore = store.buildPersonalRslStore({ scope });
        const replay = rslStore.replay({ scope, effective_as_of: decidedAt, recorded_as_of: decidedAt });
        if (!replay.ok) return replay;
        const mutation = createConfirmedPersonalRslMutation({
          proposal: found.proposal,
          decision: created.decision,
          evidence_catalog,
          active_personal_rsl_events: replay.state.active_events,
          event_id: `rsl_${hashCanonicalJson({ proposal_id, decision_hash: created.decision.decision_hash }).slice(0, 24)}`,
          recorded_at: decidedAt,
        });
        if (!mutation.ok) return mutation;
        event = mutation.event;
      }
      const committed = await store.commitDecision({
        scope,
        proposal: found.proposal,
        decision: created.decision,
        event,
        idempotency_key,
        committed_at: decidedAt,
      });
      if (!committed.ok) return committed;
      if (committed.mutation_performed) {
        const reassembled = assemble({ purpose: found.proposal.proposal_type === 'PLAN_CHANGE_CANDIDATE' ? 'FINISH_PLAN_135' : initial_purpose, active_lens: found.proposal.affected_governed_objects[0] === 'PLAN_135' ? 'PLAN' : initial_lens, as_of_at: decidedAt });
        if (!reassembled.ok) return deepFreeze({ ok: false, code: 'AFW05_POST_PUBLICATION_STATE_ASSEMBLY_FAILED', detail: reassembled.code });
      }
      return deepFreeze({
        ...clone(committed),
        decision: created.decision,
        next_state_packet: currentPacket,
        continuation_ready: true,
      });
    },

    currentStatePacket() { return currentPacket ? deepFreeze(clone(currentPacket)) : null; },
    transcriptBoundary() { return transcript.snapshot(); },
    clearEphemeralConversation() { return transcript.clear(); },
  });
}
