import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import {
  DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1,
  FRONTIER_CONVERSATION_OUTPUT_SCHEMA_V2,
  NATURAL_AUTHORIZATION_OUTPUT_SCHEMA_V1,
  createFreeGptProviderReceipt,
  validateConversationOutputV2,
  validateDurableCandidateOutput,
  validateNaturalAuthorizationOutput,
} from './contracts.js';
import { FREE_GPT_V2_COACHING_MISSION, FREE_GPT_V2_MODEL, FREE_GPT_V2_RUNTIME_POLICY } from './constants.js';
import { validateCatastrophicIntegrityV2 } from './catastrophicIntegrity.js';

function requestBase(schema, maxOutputTokens = FREE_GPT_V2_RUNTIME_POLICY.max_output_tokens) {
  return { model: FREE_GPT_V2_MODEL, store: false, background: false, tools: [], reasoning: { effort: 'xhigh' }, max_output_tokens: maxOutputTokens, text: { format: schema } };
}

function receipt(stage, request, response, now) {
  return createFreeGptProviderReceipt({
    stage, request_hash: hashCanonicalJson(request), response_hash: hashCanonicalJson(response.output),
    usage: response.usage || {}, latency_ms: response.latency_ms || 0,
    web_search_calls: response.web_search_calls || 0,
    attempt_count: response.attempt_count || 1,
    estimated_token_cost_microusd: response.estimated_cost_microusd || 0,
    created_at: now(),
  });
}

function durableStateProjection(packet) {
  const understanding = packet.provider_understanding || {};
  return JSON.parse(JSON.stringify({
    living_business_twin: understanding.living_business_twin || {},
    relevant_coaching_history: understanding.relevant_coaching_history || [],
  }));
}

export function createFrontierConversationSeamV2({ transport, enabled = false, now = () => new Date().toISOString(), denied_customer_terms = [] }) {
  if (typeof transport !== 'function') throw new TypeError('FREE_GPT_V2_CONVERSATION_TRANSPORT_REQUIRED');
  const inFlight = new Set();
  return deepFreeze({
    inspect: () => deepFreeze({ ...FREE_GPT_V2_RUNTIME_POLICY, enabled, output_contract: 'CUSTOMER_MESSAGE_ONLY' }),
    async coach({ packet, customer_message, mutation_performed = false }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_PROVIDER_DEFAULT_OFF' });
      if (!packet?.packet_hash || !packet?.provider_understanding) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_PACKET_REQUIRED' });
      if (inFlight.has(packet.session_id)) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_ONE_REQUEST_IN_FLIGHT' });
      const request = {
        ...requestBase(FRONTIER_CONVERSATION_OUTPUT_SCHEMA_V2, FREE_GPT_V2_RUNTIME_POLICY.conversation_max_output_tokens),
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
        input: [
          { role: 'system', content: FREE_GPT_V2_COACHING_MISSION },
          { role: 'user', content: JSON.stringify({
            whole_coaching_understanding: packet.provider_understanding,
            customer_message,
            deterministic_transition: mutation_performed
              ? { mutation_performed: true, current_governed_state_reassembled: true }
              : { mutation_performed: false },
          }) },
        ],
      };
      inFlight.add(packet.session_id);
      try {
        const response = await transport(deepFreeze(request), { stage: 'CONVERSATION' });
        const schema = validateConversationOutputV2(response?.output);
        if (!schema.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CONVERSATION_OUTPUT_INVALID', errors: schema.errors });
        const integrity = validateCatastrophicIntegrityV2({ message: response.output.customer_message, mutation_performed, denied_customer_terms, contradicted_claims: packet.catastrophic_constraints?.contradicted_claims || [] });
        if (!integrity.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CATASTROPHIC_INTEGRITY_REJECTED', errors: integrity.failures });
        return deepFreeze({
          ok: true,
          code: 'FREE_GPT_V2_CONVERSATION_ACCEPTED',
          customer_message: response.output.customer_message,
          external_evidence: Array.isArray(response.external_evidence) ? response.external_evidence : [],
          research: {
            used: Number(response.web_search_calls || 0) > 0,
            web_search_calls: Number(response.web_search_calls || 0),
            source_count: Array.isArray(response.external_evidence) ? response.external_evidence.length : 0,
          },
          receipt: receipt('CONVERSATION', request, response, now),
          mutation_performed,
        });
      } finally { inFlight.delete(packet.session_id); }
    },
  });
}

export function createPostResponseCandidateExtractorV1({ transport, enabled = false, now = () => new Date().toISOString() }) {
  if (typeof transport !== 'function') throw new TypeError('FREE_GPT_V2_EXTRACTOR_TRANSPORT_REQUIRED');
  return deepFreeze({
    inspect: () => deepFreeze({ enabled, output_contract: 'CANDIDATE_OR_NULL', mutation_authority: false }),
    async extract({ packet, customer_message, coach_message }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_EXTRACTOR_DEFAULT_OFF' });
      const request = {
        ...requestBase(DURABLE_CANDIDATE_OUTPUT_SCHEMA_V1, FREE_GPT_V2_RUNTIME_POLICY.candidate_max_output_tokens),
        input: [
          { role: 'system', content: 'Extract only a durable customer-specific candidate that the customer actually stated, corrected, challenged, committed to, decided, attempted, reported as an outcome, or explicitly co-created. Preserve potential durable candidates; exact confirmation downstream prevents mutation. Do not turn ordinary reflection, brainstorming, questions, coach suggestions, or transient emotion into durable state. Return null when no durable candidate exists, including when the customer merely restates the exact current durable relationship state. The current customer and coach messages are ephemeral evidence for this extraction and are intentionally not part of current_durable_relationship_state. The customer message is authoritative for what the customer asked MORE to remember or change. A coach statement that no memory update has completed is the expected pre-proposal condition; it is not evidence against extracting the customer’s candidate and must not cause null. Never infer consent. Never mutate state. Bind references only from the governed allowlists. Use only the governed AFW-05 target contracts and exact executable field paths in the schema. A newly stated durable communication preference maps to PERSONAL_RSL_CANDIDATE with an EVIDENCE_CANDIDATE proposal at evidence.communication_preference. An explicit customer commitment or action item maps to COMMITMENT_CANDIDATE at commitment.action. A durable customer decision maps to EVIDENCE_CANDIDATE at evidence.decision. A concrete attempt or experiment maps to EVIDENCE_CANDIDATE at evidence.attempt. A reported result maps to OUTCOME_CANDIDATE at evidence.outcome. A lasting operating change maps to EVIDENCE_CANDIDATE at evidence.operating_change. Use CORRECTION_CANDIDATE only when the customer corrects an exact durable field already present in current_durable_relationship_state, preserving the same field path so deterministic code can bind the superseded event. Otherwise treat newly changed reality as a new evidence or operating-change candidate. Each is still only a proposal and requires later exact customer confirmation. When the customer explicitly asks MORE to remember a semantically new communication preference, return that proposal. Related BOS guidance, business intelligence, coaching doctrine, or the current ephemeral exchange is not durable relationship memory and cannot make the request a duplicate. For a communication preference, return null for duplication only when the same semantic preference already appears in current_durable_relationship_state. For other durable meaning, return null for duplication only when the same semantic meaning already appears there. A plan way value must be a JSON object with a title and exactly five customer-supported strategies. Map Futures or One Move challenges to evidence or a challenge field without directly rewriting the canonical model. Map external research to RESEARCH_CANDIDATE.' },
          { role: 'user', content: JSON.stringify({ customer_message, coach_message, current_durable_relationship_state: durableStateProjection(packet), allowed_evidence_ref_ids: packet.allowed_refs.evidence, allowed_authority_ref_ids: packet.allowed_refs.authority }) },
        ],
      };
      const response = await transport(deepFreeze(request), { stage: 'CANDIDATE_EXTRACTION' });
      const validation = validateDurableCandidateOutput(response?.output, { allowed_evidence_refs: packet.allowed_refs.evidence, allowed_authority_refs: packet.allowed_refs.authority });
      if (!validation.valid) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_CANDIDATE_OUTPUT_INVALID', errors: validation.errors });
      return deepFreeze({ ok: true, code: validation.candidate ? 'FREE_GPT_V2_DURABLE_CANDIDATE_EXTRACTED' : 'FREE_GPT_V2_NO_DURABLE_CANDIDATE', candidate: validation.candidate, receipt: receipt('CANDIDATE_EXTRACTION', request, response, now), mutation_performed: false });
    },
  });
}

export function createNaturalAuthorizationInterpreterV1({ transport, enabled = false, now = () => new Date().toISOString() }) {
  if (typeof transport !== 'function') throw new TypeError('FREE_GPT_V2_AUTHORIZATION_TRANSPORT_REQUIRED');
  return deepFreeze({
    inspect: () => deepFreeze({ enabled, exact_proposal_binding: true, ambiguous_fails_closed: true, mutation_authority: false }),
    async interpret({ proposal, customer_message }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_AUTHORIZATION_DEFAULT_OFF' });
      const request = {
        ...requestBase(NATURAL_AUTHORIZATION_OUTPUT_SCHEMA_V1, FREE_GPT_V2_RUNTIME_POLICY.authorization_max_output_tokens),
        input: [
          { role: 'system', content: 'Interpret whether the customer unambiguously confirms, edits, defers, or rejects this exact pending proposal. Do not infer consent from enthusiasm, questions, topic continuation, or ambiguous assent. Bind the exact proposal hash. Return AMBIGUOUS or NONE when exact authorization is absent. Only EDIT may contain effective_items; for every other decision, effective_items must be an empty array.' },
          { role: 'user', content: JSON.stringify({ pending_proposal: { proposal_hash: proposal.proposal_hash, summary: proposal.summary, reason: proposal.reason, proposed_items: proposal.proposed_items }, customer_message }) },
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
