import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import {
  DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1,
  FRONTIER_CONVERSATION_OUTPUT_SCHEMA_V2,
  NATURAL_AUTHORIZATION_OUTPUT_SCHEMA_V1,
  SESSION_CLOSE_OUTPUT_SCHEMA_V1,
  createFreeGptProviderReceipt,
  validateConversationOutputV2,
  validateDurableCandidateOutput,
  validateNaturalAuthorizationOutput,
  validateSessionCloseOutputV1,
} from './contracts.js';
import {
  FREE_GPT_V2_CUSTOMER_EXPRESSION_BOUNDARY,
  FREE_GPT_V2_COACHING_MISSION,
  FREE_GPT_V2_MODEL,
  FREE_GPT_V2_RUNTIME_POLICY,
  SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS,
} from './constants.js';
import { validateCatastrophicIntegrityV2 } from './catastrophicIntegrity.js';

function requestBase(schema, maxOutputTokens = FREE_GPT_V2_RUNTIME_POLICY.max_output_tokens) {
  return { model: FREE_GPT_V2_MODEL, store: false, background: false, tools: [], reasoning: { effort: 'xhigh' }, max_output_tokens: maxOutputTokens, text: { format: schema } };
}

function receipt(stage, request, response, now) {
  const base = createFreeGptProviderReceipt({
    stage, request_hash: response.request_hash || hashCanonicalJson(request), response_hash: hashCanonicalJson(response.output),
    usage: response.usage || {}, latency_ms: response.latency_ms || 0,
    web_search_calls: response.web_search_calls || 0,
    attempt_count: response.attempt_count || 1,
    estimated_token_cost_microusd: response.estimated_cost_microusd || 0,
    created_at: now(),
  });
  return response.source_library ? deepFreeze({ ...base, governed_reference_material: {
    contract_id: 'governed_reference_material_receipt_v1',
    library_registry_sha256: response.source_library.registry_sha256,
    internal_source_calls: response.internal_source_calls || 0,
    calls: response.internal_source_receipts || [],
    customer_truth_override_allowed: false,
  } }) : base;
}

function durableStateProjection(packet) {
  const understanding = packet.provider_understanding || {};
  const historyLineages = (packet.base_state_packet?.relevant_history || [])
    .filter((event) => event?.semantic_payload?.lineage?.intervention_lineage_id)
    .map((event) => ({
      intervention_lineage_id: event.semantic_payload.lineage.intervention_lineage_id,
      event_type: event.event_type,
      summary: event.semantic_payload.summary || null,
      stage: event.semantic_payload.lineage.stage,
      open_loop_state: event.semantic_payload.lineage.open_loop_state,
      effective_at: event.effective_at,
    }));
  const continuityLineages = (packet.authorized_intervention_lineage_handles || [])
    .filter((item) => item?.intervention_lineage_id)
    .map((item) => ({
      intervention_lineage_id: item.intervention_lineage_id,
      event_type: 'INTERVENTION_LINEAGE',
      summary: item.summary || null,
      stage: 'LONGITUDINAL_PROJECTION',
      open_loop_state: item.open_loop_state,
      effective_at: item.due_at || null,
    }));
  const activeInterventionLineages = [...new Map([...historyLineages, ...continuityLineages]
    .map((item) => [item.intervention_lineage_id, item])).values()];
  return JSON.parse(JSON.stringify({
    living_business_twin: understanding.living_business_twin || {},
    relevant_coaching_history: understanding.relevant_coaching_history || [],
    active_intervention_lineages: activeInterventionLineages,
  }));
}

function allowedInterventionLineageIds(packet) {
  return [...new Set([
    ...(packet.base_state_packet?.relevant_history || []).map((event) => event?.semantic_payload?.lineage?.intervention_lineage_id),
    ...(packet.authorized_intervention_lineage_handles || []).map((item) => item?.intervention_lineage_id),
  ]
    .filter((value) => /^intervention_[a-f0-9]{24}$/u.test(value || '')))];
}

function preferredNameRequirement(packet, phase) {
  const session = packet?.provider_understanding?.coaching_session;
  if (session?.current_phase !== phase) return { required: false, valid: true, name: null };
  const name = String(session?.preferred_conversational_name || '').trim();
  if (!name) return { required: true, valid: false, name: null };
  return { required: true, valid: true, name };
}

function messageUsesName(message, name) {
  return String(message || '').toLocaleLowerCase().includes(String(name || '').toLocaleLowerCase());
}

export function createFrontierConversationSeamV2({
  transport,
  enabled = false,
  now = () => new Date().toISOString(),
  denied_customer_terms = [],
  domain_instruction = '',
  web_search_enabled = true,
  coaching_mission = FREE_GPT_V2_COACHING_MISSION,
  coaching_demonstrations = SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS,
  customer_expression_boundary = FREE_GPT_V2_CUSTOMER_EXPRESSION_BOUNDARY,
}) {
  if (typeof transport !== 'function') throw new TypeError('FREE_GPT_V2_CONVERSATION_TRANSPORT_REQUIRED');
  const inFlight = new Set();
  return deepFreeze({
    inspect: () => deepFreeze({ ...FREE_GPT_V2_RUNTIME_POLICY, enabled, web_search_enabled, output_contract: 'CUSTOMER_MESSAGE_ONLY' }),
    async coach({ packet, customer_message, mutation_performed = false }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_PROVIDER_DEFAULT_OFF' });
      if (!packet?.packet_hash || !packet?.provider_understanding) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_PACKET_REQUIRED' });
      if (inFlight.has(packet.session_id)) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_ONE_REQUEST_IN_FLIGHT' });
      const request = {
        ...requestBase(FRONTIER_CONVERSATION_OUTPUT_SCHEMA_V2, FREE_GPT_V2_RUNTIME_POLICY.conversation_max_output_tokens),
        tools: web_search_enabled ? [{ type: 'web_search' }] : [],
        ...(web_search_enabled ? { include: ['web_search_call.action.sources'] } : {}),
        input: [
          { role: 'system', content: domain_instruction
            ? `${coaching_mission}\n\nDOMAIN ADAPTER\n${domain_instruction}`
            : coaching_mission },
          { role: 'user', content: JSON.stringify({
            whole_coaching_understanding: packet.provider_understanding,
            coaching_demonstrations,
            customer_message,
            deterministic_transition: mutation_performed
              ? { mutation_performed: true, current_governed_state_reassembled: true }
              : { mutation_performed: false },
          }) },
          { role: 'system', content: customer_expression_boundary },
        ],
      };
      inFlight.add(packet.session_id);
      try {
        const response = await transport(deepFreeze(request), { stage: 'CONVERSATION' });
        const schema = validateConversationOutputV2(response?.output);
        if (!schema.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CONVERSATION_OUTPUT_INVALID', errors: schema.errors });
        const openingName = preferredNameRequirement(packet, 'STARTED');
        // Governed name context must be valid; ordinary coaching need not repeat it in every answer.
        if (!openingName.valid) {
          return deepFreeze({ ok: false, code: 'SUBSCRIPTION_S1_1_PREFERRED_NAME_OPENING_REQUIRED' });
        }
        const integrity = validateCatastrophicIntegrityV2({ message: response.output.customer_message, mutation_performed, denied_customer_terms, contradicted_claims: packet.catastrophic_constraints?.contradicted_claims || [] });
        if (!integrity.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CATASTROPHIC_INTEGRITY_REJECTED', errors: integrity.failures });
        if (response.source_library && /more\.(?:ba-bible|dj-field-doctrine)\.|\b[a-f0-9]{64}\b|\/(?:Users|private|home)\/|\bSOURCE_[A-Z_]+\b/u.test(response.output.customer_message)) {
          return deepFreeze({ ok: false, code: 'MORE_SOURCE_CUSTOMER_INTERNALS_REJECTED' });
        }
        return deepFreeze({
          ok: true,
          code: 'FREE_GPT_V2_CONVERSATION_ACCEPTED',
          customer_message: response.output.customer_message,
          external_evidence: Array.isArray(response.external_evidence) ? response.external_evidence : [],
          research: {
            used: Number(response.web_search_calls || 0) > 0,
            web_search_calls: Number(response.web_search_calls || 0),
            source_count: Array.isArray(response.external_evidence) ? response.external_evidence.length : 0,
            ...(response.source_library ? {
              internal_source_calls: response.internal_source_calls || 0,
              internal_source_receipts: response.internal_source_receipts || [],
              source_library: response.source_library,
              transport_trace: response.transport_trace,
            } : {}),
          },
          receipt: receipt('CONVERSATION', request, response, now),
          mutation_performed,
        });
      } finally { inFlight.delete(packet.session_id); }
    },
  });
}

export function createSessionCloseSeamV1({
  transport,
  enabled = false,
  now = () => new Date().toISOString(),
  denied_customer_terms = [],
  domain_instruction = '',
  coaching_mission = FREE_GPT_V2_COACHING_MISSION,
  coaching_demonstrations = SUBSCRIPTION_S1_DJ_COACHING_DEMONSTRATIONS,
}) {
  if (typeof transport !== 'function') throw new TypeError('SUBSCRIPTION_S1_1_SESSION_CLOSE_TRANSPORT_REQUIRED');
  const inFlight = new Set();
  return deepFreeze({
    inspect: () => deepFreeze({ enabled, output_contract: 'MUTUAL_SESSION_CLOSE_AND_LEARNING', mutation_authority: false, durable_write: false }),
    async close({ packet, pending_proposal = null, mode = 'REQUEST_ALIGNMENT', alignment_message = null, prior_session_learning = null }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'SUBSCRIPTION_S1_1_SESSION_CLOSE_DEFAULT_OFF' });
      if (!packet?.packet_hash || !packet?.provider_understanding) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_PACKET_REQUIRED' });
      if (inFlight.has(packet.session_id)) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_ONE_REQUEST_IN_FLIGHT' });
      if (!['REQUEST_ALIGNMENT', 'REVIEW_RESPONSE', 'FINALIZE'].includes(mode)) return deepFreeze({ ok: false, code: 'SUBSCRIPTION_S1_1_SESSION_CLOSE_MODE_INVALID' });
      if (mode === 'REVIEW_RESPONSE' && (typeof alignment_message !== 'string' || !alignment_message.trim())) return deepFreeze({ ok: false, code: 'SUBSCRIPTION_S1_1_MUTUAL_CLOSE_ALIGNMENT_REQUIRED' });
      const priorValidation = prior_session_learning
        ? validateSessionCloseOutputV1({ customer_message: 'Ephemeral mutual-close draft.', session_learning: prior_session_learning })
        : null;
      const safePriorLearning = priorValidation?.valid ? prior_session_learning : null;
      const closeInstruction = mode === 'REQUEST_ALIGNMENT'
        ? 'This is the first half of a mutual close. Briefly reflect where you believe the session landed, then ask one natural question that lets the human agree, correct, or add what matters before the session is fully closed. The session-learning fields are an ephemeral draft, not final understanding.'
        : mode === 'FINALIZE'
          ? 'The human explicitly selected Finish session. Produce an accurate final recap and close warmly. This authorizes ending the session only, never a business commitment or map change. Preserve unresolved matters and any uncertainty about the recap. This final response is shown with the session closed. Do not ask for another reply or correction before closing; leave unconfirmed points open to revisit or correct in the next session.'
          : 'The human has responded during the closing review. Understand their intent and update the draft with any correction. Set close_intent to REVIEW for correction-only replies, questions about the recap, or any ambiguity about ending; CONTINUE when they want to resume coaching; FINISH only when they clearly agree to finish; or LEAVE when they need to stop without confirming the recap. A correction is not agreement. For CONTINUE, respond naturally to the reopened concern without a farewell. For REVIEW, keep the recap open for review. Never turn discussion into a commitment.';
      const request = {
        ...requestBase(SESSION_CLOSE_OUTPUT_SCHEMA_V1, FREE_GPT_V2_RUNTIME_POLICY.session_close_max_output_tokens),
        input: [
          { role: 'system', content: `${coaching_mission}${domain_instruction ? `\n\nDOMAIN ADAPTER\n${domain_instruction}` : ''}\n\nThe coaching episode is in its closing review. ${closeInstruction} Set recap_confirmed true only when the current human reply explicitly confirms the recap content; a request to finish, a correction alone, and an unanswered recap are not confirmation. Return close_intent REVIEW for the initial reflection. Speak simply and naturally. Use the governed preferred conversational name near this close. Capture the seven session-learning fields from governed state and this conversation without inventing facts. "Durable governed meaning" is only a candidate summary: never claim it was saved or authorized. If nothing was established for a field, say so plainly. Do not create a visual receipt; S2 owns that surface.` },
          { role: 'user', content: JSON.stringify({
            whole_coaching_understanding: packet.provider_understanding,
            coaching_demonstrations,
            pending_proposal: pending_proposal ? {
              summary: pending_proposal.summary,
              reason: pending_proposal.reason,
              confirmation_required: true,
            } : null,
            mutual_close: {
              mode,
              human_alignment_response: mode !== 'REQUEST_ALIGNMENT' ? String(alignment_message || '').trim() : null,
              prior_ephemeral_draft: safePriorLearning,
              final_learning_must_reflect_shared_understanding: true,
              explicit_finish_selected: mode === 'FINALIZE',
            },
            close_contract: {
              relationship_continues: true,
              no_canonical_or_personal_rsl_write: true,
              transcript_is_not_canonical_truth: true,
              next_phase_after_notes_ready: 'IDLE',
            },
          }) },
        ],
      };
      inFlight.add(packet.session_id);
      try {
        const response = await transport(deepFreeze(request), { stage: 'SESSION_CLOSE' });
        const schema = validateSessionCloseOutputV1(response?.output);
        if (!schema.valid) return deepFreeze({ ok: false, code: 'SUBSCRIPTION_S1_1_SESSION_CLOSE_OUTPUT_INVALID', errors: schema.errors });
        const closingName = preferredNameRequirement(packet, 'ENDING');
        if (!closingName.valid || !closingName.required || !messageUsesName(response.output.customer_message, closingName.name)) {
          return deepFreeze({ ok: false, code: 'SUBSCRIPTION_S1_1_PREFERRED_NAME_CLOSING_REQUIRED' });
        }
        const integrity = validateCatastrophicIntegrityV2({ message: response.output.customer_message, mutation_performed: false, denied_customer_terms, contradicted_claims: packet.catastrophic_constraints?.contradicted_claims || [] });
        if (!integrity.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CATASTROPHIC_INTEGRITY_REJECTED', errors: integrity.failures });
        const intent = mode === 'REQUEST_ALIGNMENT' ? 'REVIEW' : mode === 'FINALIZE' ? 'FINISH' : response.output.close_intent || 'REVIEW';
        const finished = ['FINISH', 'LEAVE'].includes(intent);
        return deepFreeze({
          ok: true,
          code: intent === 'CONTINUE' ? 'SUBSCRIPTION_SESSION_COACHING_RESUMED' : finished ? 'SUBSCRIPTION_S1_1_SESSION_LEARNING_NOTES_READY' : 'SUBSCRIPTION_S1_1_MUTUAL_CLOSE_ALIGNMENT_REQUESTED',
          customer_message: response.output.customer_message,
          session_learning: intent === 'CONTINUE' ? null : {
            contract: 'SUBSCRIPTION_FLAGSHIP_S1_1_SESSION_LEARNING_V1',
            status: finished ? 'NOTES_READY' : 'DRAFT_AWAITING_ALIGNMENT',
            ...response.output.session_learning,
            persisted: false,
            canonical_mutation_performed: false,
            personal_rsl_mutation_performed: false,
            future_s2_gu_receipt: 'MANDATORY_NOT_IMPLEMENTED_IN_S1_1',
          },
          mutual_close: {
            mode,
            close_intent: intent,
            human_alignment_required: intent === 'REVIEW',
            alignment_established: mode === 'REVIEW_RESPONSE' && intent === 'FINISH' && response.output.recap_confirmed === true,
            continue_coaching: intent === 'CONTINUE',
            human_response_reviewed: mode === 'REVIEW_RESPONSE',
            draft_revised: Boolean(safePriorLearning && hashCanonicalJson(safePriorLearning) !== hashCanonicalJson(response.output.session_learning)),
          },
          receipt: receipt('SESSION_CLOSE', request, response, now),
          mutation_performed: false,
        });
      } finally { inFlight.delete(packet.session_id); }
    },
  });
}

export function createPostResponseCandidateExtractorV1({ transport, enabled = false, now = () => new Date().toISOString() }) {
  if (typeof transport !== 'function') throw new TypeError('FREE_GPT_V2_EXTRACTOR_TRANSPORT_REQUIRED');
  return deepFreeze({
    inspect: () => deepFreeze({ enabled, output_contract: 'CANDIDATE_OR_NULL', mutation_authority: false }),
    async extract({ packet, customer_message, coach_message, correction_records = [], pending_proposals = [] }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_EXTRACTOR_DEFAULT_OFF' });
      const authorityRefs = [...packet.allowed_refs.authority, ...correction_records.map((record) => record.authority_ref)];
      const request = {
        ...requestBase(DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1, FREE_GPT_V2_RUNTIME_POLICY.candidate_max_output_tokens),
        input: [
          { role: 'system', content: 'Extract only a durable customer-specific candidate that the customer actually stated, corrected, challenged, committed to, decided, attempted, reported as an outcome, or explicitly co-created. Preserve potential durable candidates; exact confirmation downstream prevents mutation. Do not turn ordinary reflection, brainstorming, questions, coach suggestions, or transient emotion into durable state. Return null when no durable candidate exists, including when the customer merely restates the exact current durable relationship state. The current customer and coach messages are ephemeral evidence for this extraction and are intentionally not part of current_durable_relationship_state. The customer message is authoritative for what the customer asked MORE to remember or change. A coach statement that no memory update has completed is the expected pre-proposal condition; it is not evidence against extracting the customer’s candidate and must not cause null. Never infer consent. Never mutate state. Bind references only from the governed allowlists. Use only the governed AFW-05 target contracts and exact executable field paths in the schema. A newly stated durable communication preference maps to PERSONAL_RSL_CANDIDATE with an EVIDENCE_CANDIDATE proposal at evidence.communication_preference. A newly stated preferred coaching cadence maps to PERSONAL_RSL_CANDIDATE with an EVIDENCE_CANDIDATE proposal at evidence.coaching_cadence_preference; the coach may acknowledge the intended adjustment, but the preference is not durable until exact downstream authorization. A commitment or action item maps to COMMITMENT_CANDIDATE. A customer-authorized bounded action or experiment that should later be evaluated uses commitment.intervention. Include explicit due date, observation-window dates, falsifiers, or open-loop state as additional commitment.* items only when the customer actually supplied them. Other commitments use commitment.action. A durable customer decision maps to EVIDENCE_CANDIDATE at evidence.decision. A concrete attempt or experiment maps to EVIDENCE_CANDIDATE at evidence.attempt and MUST include evidence.intervention_lineage_id copied exactly from active_intervention_lineages plus evidence.execution_degree as PARTIAL or COMPLETE. A reported result maps to OUTCOME_CANDIDATE at evidence.outcome and MUST include the same exact evidence.intervention_lineage_id plus evidence.outcome_classification. Include observation-window dates, confounders, external shocks, falsifiers, requested attribution, and open-loop state only when supported. Never attach an attempt or outcome to a lineage by date, similarity, or guesswork. Return null if the customer has not identified which active intervention they mean. A lasting operating change maps to EVIDENCE_CANDIDATE at evidence.operating_change. Use CORRECTION_CANDIDATE only when the customer corrects an exact durable field already present in current_durable_relationship_state, preserving the same field path so deterministic code can bind the superseded event. Otherwise treat newly changed reality as a new evidence or operating-change candidate. Each is still only a proposal and requires later exact customer confirmation. When the customer explicitly asks MORE to remember a semantically new communication preference or coaching cadence, return that proposal. Related BOS guidance, business intelligence, coaching doctrine, or the current ephemeral exchange is not durable relationship memory and cannot make the request a duplicate. For a communication preference or coaching cadence, return null for duplication only when the same semantic preference already appears in current_durable_relationship_state. For other durable meaning, return null for duplication only when the same semantic meaning already appears there. A plan way value must be a JSON object with a title and exactly five customer-supported strategies. Map Futures or One Move challenges to evidence or a challenge field without directly rewriting the canonical model. Map external research to RESEARCH_CANDIDATE.' },
          { role: 'user', content: JSON.stringify({ customer_message, coach_message, current_durable_relationship_state: durableStateProjection(packet),
            ...(pending_proposals.length ? { unconfirmed_pending_proposals: pending_proposals.map((proposal) => ({
              status: 'UNCONFIRMED_DRAFT_NOT_DURABLE_CUSTOMER_STATE',
              proposal_hash: proposal.proposal_hash,
              summary: proposal.summary,
              proposed_items: proposal.proposed_items,
            })) } : {}),
            correction_records, allowed_evidence_ref_ids: packet.allowed_refs.evidence, allowed_authority_ref_ids: authorityRefs }) },
          { role: 'system', content: 'Exact correction record boundary v1: a shared field name is not a record identity. For a correction, use the exact customer-identified record from correction_records, copy its authority_ref into authority_ref_ids, and preserve all of its items including unchanged context. Never attach a new follow-up attempt to an older tracking exercise just because both have an execution degree. A linked observation must retain its exact intervention_lineage_id. Do not guess a target by field similarity, dates, or the coach’s mistaken recollection. If the customer’s intended target does not exist or is unclear, return null; conversation may clarify without mutation. A conditional request must not be split into an unconditional partial correction.' },
          ...(pending_proposals.length ? [{ role: 'system', content: 'Pending draft review boundary: unconfirmed_pending_proposals are proposed words awaiting review, not accepted customer commitments or durable truth. Set replaces_pending_proposal_hashes only for exact listed drafts that the current customer explicitly replaces, narrows, or revises. A shared field, similar wording, a new additional action, a reported attempt, or an uncertain relationship is not replacement. Use an empty array in those cases. Preserve the distinction between the original total work and remaining work; never subtract counts or rewrite the original history. Preserve any customer conditions in the new candidate. This annotation changes draft review eligibility only and never confirms, rejects, or commits customer state.' }] : []),
        ],
      };
      const response = await transport(deepFreeze(request), { stage: 'CANDIDATE_EXTRACTION' });
      const validation = validateDurableCandidateOutput(response?.output, {
        allowed_evidence_refs: packet.allowed_refs.evidence,
        allowed_authority_refs: authorityRefs,
        allowed_intervention_lineage_ids: allowedInterventionLineageIds(packet),
        allowed_pending_proposal_hashes: pending_proposals.map((proposal) => proposal.proposal_hash),
      });
      if (!validation.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CANDIDATE_OUTPUT_INVALID', errors: validation.errors });
      return deepFreeze({ ok: true, code: validation.candidate ? 'FREE_GPT_V2_DURABLE_CANDIDATE_EXTRACTED' : 'FREE_GPT_V2_NO_DURABLE_CANDIDATE', candidate: validation.candidate, replaces_pending_proposal_hashes: validation.replaces_pending_proposal_hashes || [], receipt: receipt('CANDIDATE_EXTRACTION', request, response, now), mutation_performed: false });
    },
  });
}

export function createNaturalAuthorizationInterpreterV1({ transport, enabled = false, now = () => new Date().toISOString() }) {
  if (typeof transport !== 'function') throw new TypeError('FREE_GPT_V2_AUTHORIZATION_TRANSPORT_REQUIRED');
  return deepFreeze({
    inspect: () => deepFreeze({ enabled, exact_proposal_binding: true, ambiguous_fails_closed: true, mutation_authority: false }),
    async interpret({ proposal, customer_message, target_context = [], conversation = [] }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_AUTHORIZATION_DEFAULT_OFF' });
      // Deny-only guard, not a consent parser. A model cannot discard an
      // explicit unresolved condition and authorize a convenient subset.
      // Unconditional turns still use the unchanged natural interpreter.
      if (/\b(?:if|unless|provided|providing|assuming|contingent|conditional|as long as|on condition|only when|only where|only for|only to)\b/iu.test(customer_message)) {
        return deepFreeze({ ok: true, code: 'FREE_GPT_V2_CONDITIONAL_AUTHORIZATION_REQUIRES_CLARIFICATION',
          decision: 'AMBIGUOUS', proposal_hash: proposal.proposal_hash, effective_items: [], unambiguous: false,
          reason: 'The customer attached a condition or target restriction. Resolve it and obtain exact unconditional authorization; never discard it.', mutation_performed: false });
      }
      const request = {
        ...requestBase(NATURAL_AUTHORIZATION_OUTPUT_SCHEMA_V1, FREE_GPT_V2_RUNTIME_POLICY.authorization_max_output_tokens),
        input: [
          { role: 'system', content: 'Interpret whether the customer unambiguously confirms, edits, defers, or rejects this exact pending proposal. Do not infer consent from enthusiasm, questions, topic continuation, or ambiguous assent. Bind the exact proposal hash. Return AMBIGUOUS or NONE when exact authorization is absent. Only EDIT may contain effective_items; for every other decision, effective_items must be an empty array.' },
          { role: 'user', content: JSON.stringify({ pending_proposal: { proposal_hash: proposal.proposal_hash, summary: proposal.summary, reason: proposal.reason, proposed_items: proposal.proposed_items, target_contract: proposal.target_contract, supersedes_event_ids: proposal.supersedes_event_ids, retracts_event_ids: proposal.retracts_event_ids }, target_context, conversation, customer_message }) },
          { role: 'system', content: 'Exact whole-intent boundary v1: authorization covers the entire intended change and exact record, never a convenient subset. Treat all target restrictions and conditions as part of consent. If an attachment is conditional on a commitment existing, absence of that exact commitment means no authorization. Never classify that condition as separate from the mutation. Compare the customer’s words against the full target context and conversation. Another record with similar fields is not the intended target. Return AMBIGUOUS when a condition, target identity, additional requested facts, or changed meaning is unresolved; do not silently discard it and CONFIRM. Conversation can resolve the uncertainty without a write.' },
        ],
      };
      const response = await transport(deepFreeze(request), { stage: 'NATURAL_AUTHORIZATION' });
      const validation = validateNaturalAuthorizationOutput(response?.output, proposal);
      if (!validation.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_AUTHORIZATION_OUTPUT_INVALID', errors: validation.errors });
      const interpreted = response.output;
      return deepFreeze({ ok: true, code: ['CONFIRM', 'EDIT', 'DEFER', 'REJECT'].includes(interpreted.decision) ? 'FREE_GPT_V2_EXACT_NATURAL_AUTHORIZATION' : 'FREE_GPT_V2_NO_EXACT_AUTHORIZATION', ...interpreted, receipt: receipt('NATURAL_AUTHORIZATION', request, response, now), mutation_performed: false });
    },
  });
}
