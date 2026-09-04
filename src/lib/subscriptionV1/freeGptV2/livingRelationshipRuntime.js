import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { scopeFingerprint } from '../contracts.js';
import { EphemeralTranscriptBuffer } from '../personalRsl.js';
import { retrieveRelevantPersonalHistory } from '../retrieval.js';
import { createGovernedChangeProposal, createProposalDecision } from '../afw05/contracts.js';
import { createConfirmedPersonalRslMutation } from '../afw05/personalRslMutation.js';
import { correctionRecordCatalog, correctionTargetContext, resolveCorrectionTargets } from '../afw05/correctionTargets.js';
import {
  createLinkedCausalReviewEvent,
  createRelationshipEpisodeEvent,
  derivePrivateLongitudinalScorecard,
  derivePrivacySafeFutureLearningCandidates,
} from '../lineage.js';
import { createHiddenCandidateFromExtraction } from './contracts.js';
import { assembleWholeCoachingUnderstandingPacketV2 } from './wholeCoachingPacket.js';
import { assembleTemporalCoachingState } from './temporalState.js';
import { assembleRelationshipContinuityState } from './relationshipContinuity.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createFreeGptLivingRelationshipRuntimeV2({
  scope,
  session_id,
  store,
  conversation_seam,
  session_close_seam,
  candidate_extractor,
  authorization_interpreter,
  doctrine_retrieval,
  canonical_artifacts,
  business_truth,
  whole_person_execution_context,
  uncertainty = [],
  external_evidence = [],
  evidence_catalog = [],
  relationship_context = null,
  coaching_session = null,
  session_temporal_context = null,
  initial_conversation = [],
  initial_pending_proposal_id = null,
  clock = () => new Date().toISOString(),
  monotonic_clock = () => Date.now(),
}) {
  if (!store || !conversation_seam || !session_close_seam || !candidate_extractor || !authorization_interpreter || !doctrine_retrieval) throw new TypeError('FREE_GPT_V2_RUNTIME_DEPENDENCIES_REQUIRED');
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
    customer_message = '',
    as_of_at = clock(),
  } = {}) {
    const rslStore = store.buildPersonalRslStore({ scope });
    const history = retrieveRelevantPersonalHistory({ store: rslStore, scope, purpose, active_lens, topics, as_of_at });
    if (!history.ok) return history;
    const publication = store.readCurrent({ scope });
    if (!publication.ok) return publication;
    const rslReplay = rslStore.replay({ scope, effective_as_of: as_of_at, recorded_as_of: as_of_at });
    if (!rslReplay.ok) return rslReplay;
    const activeRslEvents = rslReplay.state.active_events;
    const episodeRead = store.readRelationshipEpisodes({ scope });
    if (!episodeRead.ok) return episodeRead;
    const scorecard = derivePrivateLongitudinalScorecard({
      scope,
      active_events: activeRslEvents,
      historical_events: rslStore.read({ scope }).records.map((record) => record.event),
      episode_events: episodeRead.records.map((record) => record.event),
      as_of_at,
    });
    if (!scorecard.ok) return scorecard;
    const pending = pendingProposalId ? store.readProposal({ scope, proposal_id: pendingProposalId }) : null;
    const temporalState = assembleTemporalCoachingState({
      as_of_at,
      session_history: session_temporal_context?.session_history || [],
      current_session_id: session_id,
      personal_rsl_records: activeRslEvents,
      canonical_artifacts,
      current_publication: publication.publication,
    });
    const relationshipContinuity = assembleRelationshipContinuityState({
      active_personal_rsl_events: activeRslEvents,
      pending_proposal: pending?.ok ? pending.proposal : null,
      canonical_artifacts,
      longitudinal_scorecard: scorecard.scorecard,
      as_of_at,
    });
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
      conversation: transcript.snapshot().turns,
      visible_customer_context,
      external_evidence: currentExternalEvidence,
      relationship_context,
      coaching_session,
      temporal_state: temporalState,
      relationship_continuity: relationshipContinuity,
      purpose,
      active_lens,
      topics,
      customer_message,
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
    let derivedEvents = [];
    if (created.decision.mutation_authorized) {
      const rslStore = store.buildPersonalRslStore({ scope });
      const replay = rslStore.replay({ scope, effective_as_of: decidedAt, recorded_as_of: decidedAt });
      if (!replay.ok) return replay;
      const targetBinding = correctionTargetContext({ scope, proposal: { ...proposal, proposed_items: created.decision.effective_items }, active_events: replay.state.active_events });
      if (!targetBinding.ok) return targetBinding;
      const mutation = createConfirmedPersonalRslMutation({
        proposal,
        decision: created.decision,
        evidence_catalog,
        active_personal_rsl_events: replay.state.active_events,
        event_id: `rsl_${hashCanonicalJson({ proposal_id: proposal.proposal_id, decision_hash: created.decision.decision_hash }).slice(0, 24)}`,
        recorded_at: decidedAt,
      });
      if (!mutation.ok) return mutation;
      event = mutation.event;
      if (event.event_type === 'OUTCOME') {
        const review = createLinkedCausalReviewEvent({
          scope,
          active_events: [...replay.state.active_events, event],
          outcome_event: event,
          event_id: `rsl_review_${hashCanonicalJson({ outcome: event.content_hash, at: decidedAt }).slice(0, 20)}`,
          recorded_at: decidedAt,
        });
        if (!review.ok) return review;
        derivedEvents = [review.event];
      }
    }
    const committed = await store.commitDecision({ scope, proposal, decision: created.decision, event, derived_events: derivedEvents, idempotency_key, committed_at: decidedAt });
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
        coaching_episode_phase: coaching_session?.current_phase || 'ACTIVE',
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
      on_coaching_ready = null,
    }) {
      if (typeof customer_turn !== 'string' || !customer_turn.trim()) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CUSTOMER_MESSAGE_REQUIRED' });
      if (on_coaching_ready != null && typeof on_coaching_ready !== 'function') return deepFreeze({ ok: false, code: 'FREE_GPT_V2_COACHING_READY_CALLBACK_INVALID' });
      const turnStartedAt = monotonic_clock();
      const normalizedTurn = customer_turn.trim();
      transcript.push({ role: 'customer', content: normalizedTurn });
      let authorization = null;
      let decisionResult = null;

      if (pendingProposalId) {
        const found = store.readProposal({ scope, proposal_id: pendingProposalId });
        if (!found.ok) return found;
        const replay = store.buildPersonalRslStore({ scope }).replay({ scope, effective_as_of: clock(), recorded_as_of: clock() });
        if (!replay.ok) return replay;
        const binding = correctionTargetContext({ scope, proposal: found.proposal, active_events: replay.state.active_events });
        if (!binding.ok) return binding;
        authorization = await authorization_interpreter.interpret({
          proposal: found.proposal, customer_message: normalizedTurn,
          target_context: correctionRecordCatalog({ scope, active_events: binding.targets }),
          conversation: transcript.snapshot().turns,
        });
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

      const assembled = assemble({ purpose, active_lens, topics, visible_customer_context, customer_message: normalizedTurn });
      if (!assembled.ok) return assembled;
      const coaching = await conversation_seam.coach({ packet: currentUnderstanding, customer_message: normalizedTurn, mutation_performed: Boolean(decisionResult?.mutation_performed) });
      if (!coaching.ok) return coaching;
      transcript.push({ role: 'coach', content: coaching.customer_message });
      const coachingReadyAt = monotonic_clock();
      if (on_coaching_ready) {
        await on_coaching_ready(deepFreeze({
          ok: true,
          code: 'SUBSCRIPTION_FLAGSHIP_S1_COACHING_READY',
          customer_message: coaching.customer_message,
          provider_receipts: [authorization?.receipt, coaching.receipt].filter(Boolean),
          research: coaching.research,
          external_evidence: clone(coaching.external_evidence || []),
          mutation_performed: Boolean(decisionResult?.mutation_performed),
          context_selection_receipt: currentUnderstanding.context_selection_receipt,
          timing: {
            time_to_first_useful_ms: Math.max(0, coachingReadyAt - turnStartedAt),
            candidate_extraction_started: false,
          },
        }));
      }
      if (coaching.external_evidence?.length) {
        const byId = new Map(currentExternalEvidence.map((item) => [item.external_evidence_id, item]));
        for (const item of coaching.external_evidence) byId.set(item.external_evidence_id, clone(item));
        currentExternalEvidence = [...byId.values()];
        const researched = assemble({ purpose, active_lens, topics, visible_customer_context, customer_message: normalizedTurn });
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
          context_selection_receipt: currentUnderstanding.context_selection_receipt,
          timing: {
            time_to_first_useful_ms: Math.max(0, coachingReadyAt - turnStartedAt),
            candidate_extraction_ms: 0,
            total_ms: Math.max(0, monotonic_clock() - turnStartedAt),
            coaching_delivered_before_extraction: true,
          },
        });
      }

      const extractionPacket = currentUnderstanding;
      const extractionStartedAt = monotonic_clock();
      const activeRead = store.buildPersonalRslStore({ scope }).replay({ scope, effective_as_of: clock(), recorded_as_of: clock() });
      if (!activeRead.ok) return activeRead;
      const extraction = await candidate_extractor.extract({ packet: extractionPacket, customer_message: normalizedTurn, coach_message: coaching.customer_message,
        correction_records: correctionRecordCatalog({ scope, active_events: activeRead.state.active_events }),
      });
      if (!extraction.ok) return extraction;
      const extractionCompletedAt = monotonic_clock();
      const publication = store.readCurrent({ scope });
      if (!publication.ok) return publication;
      const extractionSourceState = extractionPacket.base_state_packet.current_state;
      if (publication.publication.publication_version !== extractionSourceState.living_publication_version
        || publication.publication.publication_hash !== extractionSourceState.living_publication_hash) {
        return deepFreeze({
          ok: false,
          code: 'FREE_GPT_V2_POST_RESPONSE_EXTRACTION_STALE',
          customer_message: coaching.customer_message,
          mutation_performed: false,
          provider_receipts: [coaching.receipt, extraction.receipt],
          extraction: { candidate: null, skipped: false, discarded: true, reason: 'STATE_CHANGED_DURING_CANDIDATE_EXTRACTION' },
          context_selection_receipt: extractionPacket.context_selection_receipt,
          timing: {
            time_to_first_useful_ms: Math.max(0, coachingReadyAt - turnStartedAt),
            candidate_extraction_ms: Math.max(0, extractionCompletedAt - extractionStartedAt),
            total_ms: Math.max(0, extractionCompletedAt - turnStartedAt),
            coaching_delivered_before_extraction: true,
          },
        });
      }
      let proposal = null;
      if (extraction.candidate) {
        let supersedesEventIds = [];
        if (extraction.candidate.proposal_type === 'CORRECTION_CANDIDATE') {
          const replay = store.buildPersonalRslStore({ scope }).replay({ scope, effective_as_of: clock(), recorded_as_of: clock() });
          if (!replay.ok) return replay;
          const binding = resolveCorrectionTargets({ scope, items: extraction.candidate.items,
            authority_ref_ids: extraction.candidate.authority_ref_ids, active_events: replay.state.active_events });
          if (!binding.ok) return deepFreeze({ ...binding, customer_message: coaching.customer_message, mutation_performed: false });
          supersedesEventIds = binding.supersedes_event_ids;
        }
        const hidden = createHiddenCandidateFromExtraction({
          session_id,
          scope_hash: scopeFingerprint(scope),
          state_packet_hash: extractionPacket.base_state_packet.packet_hash,
          candidate: extraction.candidate,
          created_at: clock(),
        });
        const governed = createGovernedChangeProposal({
          hidden_proposal: hidden,
          scope,
          source_state_packet: extractionPacket.base_state_packet,
          current_publication: publication.publication,
          created_at: clock(),
          supersedes_event_ids: supersedesEventIds,
        });
        if (!governed.ok) return governed;
        const customerDiscussion = createRelationshipEpisodeEvent({
          scope,
          session_id,
          event_type: 'CUSTOMER_DISCUSSION',
          summary: extraction.candidate.summary,
          occurred_at: clock(),
          source_content_hash: hashCanonicalJson({ role: 'customer', content: normalizedTurn }),
          proposal_id: governed.proposal.proposal_id,
        });
        const moreSuggestion = createRelationshipEpisodeEvent({
          scope,
          session_id,
          event_type: 'MORE_SUGGESTION',
          summary: coaching.customer_message.slice(0, 1200),
          occurred_at: clock(),
          source_content_hash: hashCanonicalJson({ role: 'coach', content: coaching.customer_message }),
          proposal_id: governed.proposal.proposal_id,
        });
        if (!customerDiscussion.ok || !moreSuggestion.ok) return deepFreeze({ ok: false, code: customerDiscussion.code || moreSuggestion.code });
        const saved = await store.saveProposal({
          scope,
          proposal: governed.proposal,
          saved_at: clock(),
          relationship_episode_events: [customerDiscussion.event, moreSuggestion.event],
        });
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
        context_selection_receipt: extractionPacket.context_selection_receipt,
        timing: {
          time_to_first_useful_ms: Math.max(0, coachingReadyAt - turnStartedAt),
          candidate_extraction_ms: Math.max(0, extractionCompletedAt - extractionStartedAt),
          total_ms: Math.max(0, extractionCompletedAt - turnStartedAt),
          coaching_delivered_before_extraction: true,
        },
      });
    },

    async decide({ proposal_id, decision, edited_items = [], note = null, idempotency_key }) {
      const found = store.readProposal({ scope, proposal_id });
      if (!found.ok) return found;
      return commitProposalDecision({ proposal: found.proposal, decision, edited_items, note, idempotency_key });
    },

    async closeSession({ active_lens = 'OVERVIEW', visible_customer_context = null, mode = 'REQUEST_ALIGNMENT', alignment_message = null, prior_session_learning = null } = {}) {
      if (coaching_session?.current_phase !== 'ENDING') return deepFreeze({ ok: false, code: 'SUBSCRIPTION_S1_1_ENDING_PHASE_REQUIRED' });
      const assembled = assemble({
        purpose: 'WEEKLY_COACHING',
        active_lens,
        visible_customer_context,
        customer_message: mode === 'FINALIZE' ? String(alignment_message || '').trim() : '',
      });
      if (!assembled.ok) return assembled;
      const pending = pendingProposalId ? store.readProposal({ scope, proposal_id: pendingProposalId }) : null;
      const closed = await session_close_seam.close({
        packet: currentUnderstanding,
        pending_proposal: pending?.ok ? pending.proposal : null,
        mode,
        alignment_message,
        prior_session_learning,
      });
      if (!closed.ok) return closed;
      return deepFreeze({
        ...closed,
        confirmation_required: Boolean(pending?.ok),
        proposal: pending?.ok ? pending.proposal : null,
        transcript_persisted: false,
        relationship_continues: true,
      });
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
    longitudinalScorecard({ as_of_at = clock() } = {}) {
      const rslStore = store.buildPersonalRslStore({ scope });
      const replay = rslStore.replay({ scope, effective_as_of: as_of_at, recorded_as_of: as_of_at });
      if (!replay.ok) return replay;
      const episodes = store.readRelationshipEpisodes({ scope });
      if (!episodes.ok) return episodes;
      return derivePrivateLongitudinalScorecard({
        scope,
        active_events: replay.state.active_events,
        historical_events: rslStore.read({ scope }).records.map((record) => record.event),
        episode_events: episodes.records.map((record) => record.event),
        as_of_at,
      });
    },
    futureLearningCandidates({ as_of_at = clock() } = {}) {
      const rslStore = store.buildPersonalRslStore({ scope });
      const replay = rslStore.replay({ scope, effective_as_of: as_of_at, recorded_as_of: as_of_at });
      if (!replay.ok) return replay;
      return derivePrivacySafeFutureLearningCandidates({ scope, active_events: replay.state.active_events, as_of_at });
    },
    clearEphemeralConversation() { return transcript.clear(); },
  });
}
