import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { AFW04_MODEL, AFW04_PRICING_POLICY, AFW04_RUNTIME_POLICY } from './constants.js';
import { createCoachingMutationCandidate, createProviderUsageReceipt, FRONTIER_COACHING_OUTPUT_SCHEMA, validateFrontierCoachingOutput } from './contracts.js';
import { createMinimizedCoachingPacket, validateCustomerLanguage } from './privacyMembrane.js';

const transientCodes = new Set(['ETIMEDOUT', 'ECONNRESET', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE']);

export function computeProviderCost({ input_tokens, cached_input_tokens = 0, output_tokens, web_search_calls = 0 }, policy = AFW04_PRICING_POLICY) {
  const uncached = Math.max(0, input_tokens - cached_input_tokens);
  return Number((((uncached * policy.input_per_unit) + (cached_input_tokens * policy.cached_input_per_unit) + (output_tokens * policy.output_per_unit)) / policy.unit_tokens + (web_search_calls * policy.web_search_per_1000_calls / 1000)).toFixed(8));
}

function allowedRefs(packet, doctrine, externalEvidence) {
  return {
    evidence: [...(packet.business_truth || []), ...(packet.whole_person_execution_context || [])].map((item) => item.evidence_id).concat(externalEvidence.map((item) => item.external_evidence_id)),
    authority: [...doctrine.selected_authority_refs, ...(packet.artifact_lineage || []).map((item) => `canonical_artifact:${item.artifact_type}:${item.content_hash}`), `personal_rsl:${packet.personal_rsl_retrieval_hash}`].concat(externalEvidence.map((item) => `external_evidence:${item.external_evidence_id}`)),
  };
}

export function createAfw04ProviderRuntime({ transport, enabled = false, now = () => new Date().toISOString() }) {
  if (typeof transport !== 'function') throw new TypeError('AFW04_TRANSPORT_REQUIRED');
  const inFlight = new Set();
  return deepFreeze({
    inspect: () => deepFreeze({ ...AFW04_RUNTIME_POLICY, enabled }),
    async coach({ state_packet, doctrine_retrieval, customer_turn, vertical_context = null, external_evidence = [], history = [], session_id, scope_hash }) {
      if (!enabled) return deepFreeze({ ok: false, code: 'AFW04_PROVIDER_DEFAULT_OFF' });
      if (inFlight.has(session_id)) return deepFreeze({ ok: false, code: 'AFW04_ONE_REQUEST_IN_FLIGHT' });
      const minimized = createMinimizedCoachingPacket({ state_packet, doctrine_retrieval, customer_turn, vertical_context, external_evidence, history });
      if (!minimized.ok) return minimized;
      const refs = allowedRefs(state_packet, doctrine_retrieval, external_evidence);
      const request = {
        model: AFW04_MODEL,
        store: false,
        background: false,
        tools: [],
        reasoning: { effort: 'xhigh' },
        max_output_tokens: AFW04_RUNTIME_POLICY.max_output_tokens,
        text: { format: FRONTIER_COACHING_OUTPUT_SCHEMA },
        input: [
          { role: 'system', content: 'Understand the whole governed state before responding. Coach naturally in plain customer language, with short varied turns rather than a repeated recap-rationale-question template. Use or ignore the available coaching intelligence as judgment requires; never recite or mechanically march through frameworks. A validation mission is not an intake quota: respond to what the customer actually says, stop chasing repeated unknowns, and let a maturing exchange move toward provisional synthesis and one useful next action. Do not echo or classify every answer, explain the diagnostic purpose of every question, or prescribe a full protocol when the customer can interpret and co-design the next step; when useful, ask what the customer notices before offering the diagnosis. Business causes require business evidence. Whole-person evidence may shape communication or feasibility, never invent a business cause. When a current external fact is material and absent, identify a minimized public research need instead of relying on memory. Return a natural customer message and one hidden typed proposal. Never show internal IDs, enum labels, schemas, or architecture.' },
          { role: 'user', content: JSON.stringify({ packet: minimized.packet, allowed_evidence_ref_ids: refs.evidence, allowed_authority_ref_ids: refs.authority }) },
        ],
      };
      const requestHash = hashCanonicalJson(request);
      inFlight.add(session_id);
      let retryCount = 0;
      try {
        let response;
        for (;;) {
          try { response = await transport(deepFreeze(request)); break; } catch (error) {
            if (retryCount >= AFW04_RUNTIME_POLICY.transient_retries || !transientCodes.has(error?.code)) throw error;
            retryCount += 1;
          }
        }
        if (response?.request_hash && response.request_hash !== requestHash) return deepFreeze({ ok: false, code: 'AFW04_RETRY_INPUT_DRIFT' });
        const parsed = response?.output;
        const schema = validateFrontierCoachingOutput(parsed, { allowed_evidence_refs: refs.evidence, allowed_authority_refs: refs.authority });
        if (!schema.valid) return deepFreeze({ ok: false, code: 'AFW04_PROVIDER_OUTPUT_INVALID', errors: schema.errors, provider_calls: retryCount + 1 });
        const language = validateCustomerLanguage(parsed.customer_message);
        if (!language.valid) return deepFreeze({ ok: false, code: 'AFW04_CUSTOMER_LANGUAGE_INVALID', errors: language.failures, provider_calls: retryCount + 1 });
        const responseHash = hashCanonicalJson(parsed);
        const usage = response.usage || {};
        const cost = computeProviderCost({ input_tokens: usage.input_tokens || 0, cached_input_tokens: usage.cached_input_tokens || 0, output_tokens: usage.output_tokens || 0 });
        return deepFreeze({
          ok: true,
          code: 'AFW04_FRONTIER_COACHING_ACCEPTED',
          customer_message: parsed.customer_message,
          hidden_proposal: createCoachingMutationCandidate({ session_id, scope_hash, state_packet_hash: state_packet.packet_hash, output: parsed, created_at: now() }),
          research_need: parsed.research_need,
          receipt: createProviderUsageReceipt({ request_hash: requestHash, response_hash: responseHash, input_tokens: usage.input_tokens || 0, cached_input_tokens: usage.cached_input_tokens || 0, output_tokens: usage.output_tokens || 0, latency_ms: response.latency_ms || 0, first_token_latency_ms: response.first_token_latency_ms || 0, retry_count: retryCount, computed_cost_usd: cost, created_at: now() }),
          mutation_performed: false,
          raw_request_persisted: false,
          raw_response_persisted: false,
        });
      } finally { inFlight.delete(session_id); }
    },
  });
}
