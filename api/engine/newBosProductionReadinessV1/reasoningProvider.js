import crypto from 'node:crypto';

import OpenAI from 'openai';

import { compactGovernedContext } from './libraryRetriever.js';
import {
  buildPseudonymousReasoningPacket,
  deriveProviderIdentityTokens,
  inspectProviderPrivacy,
  sanitizeProviderBoundText,
} from './privacyEgress.js';
import { buildNewBosReasoningSchema, NEW_BOS_REASONING_OUTPUT_BUDGET } from './reasoningContract.js';

function outputText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  return (response?.output || []).flatMap((item) => item?.content || [])
    .filter((item) => item?.type === 'output_text')
    .map((item) => item.text)
    .join('');
}

function usageReceipt(response) {
  return Object.freeze({
    input_tokens: Number(response?.usage?.input_tokens) || 0,
    cached_input_tokens: Number(response?.usage?.input_tokens_details?.cached_tokens) || 0,
    output_tokens: Number(response?.usage?.output_tokens) || 0,
    reasoning_tokens: Number(response?.usage?.output_tokens_details?.reasoning_tokens) || 0,
  });
}

function modelMatches(requested, returned) {
  return !returned || returned === requested || String(returned).startsWith(`${requested}-`);
}

export function buildNewBosReasoningRequest({ rawEvidence, governedContext, model, privacyTokens = [] }) {
  const governedPrivacyTokens = [...deriveProviderIdentityTokens(rawEvidence), ...privacyTokens];
  const packet = buildPseudonymousReasoningPacket(rawEvidence, governedPrivacyTokens);
  const evidenceIds = packet.evidence.map(({ evidence_id: id }) => id);
  const doctrine = compactGovernedContext(governedContext).map((item) => Object.freeze({
    ...item,
    doctrine: sanitizeProviderBoundText(item.doctrine, governedPrivacyTokens),
  }));
  const request = Object.freeze({
    model,
    store: false,
    reasoning: Object.freeze({ effort: 'xhigh' }),
    max_output_tokens: NEW_BOS_REASONING_OUTPUT_BUDGET.max_output_tokens,
    safety_identifier: crypto.createHash('sha256').update(`new-bos-canary:${rawEvidence.generation_metadata.canonical_source_sha256}`).digest('hex').slice(0, 32),
    input: Object.freeze([Object.freeze({
      role: 'user',
      content: Object.freeze([Object.freeze({
        type: 'input_text',
        text: [
          'MORE MindMap New BOS Personality DNA V1 — governed whole-person reasoning.',
          '',
          'Mission: use the supplied canonical score priors, exact governed self-report evidence, and bounded frozen doctrine to produce the complete typed interpretation draft required by the response schema.',
          '',
          'Hard boundaries:',
          '- Every claim must cite supplied evidence IDs. Scores are probabilistic priors, never identity.',
          '- Use all eight coordinates causally where supported; do not treat a low score as automatic avoidance.',
          '- Preserve contradictions, counterevidence, confounds, falsifiers, uncertainty, and abstention.',
          '- Never invent biography, scenes, quotations, observer reactions, outcomes, dates, numbers, or history.',
          '- Never diagnose, estimate or proxy IQ, infer protected traits, or make psychometric rankings.',
          '- Five Futures are conditional trajectories. One Move is reversible, mechanism-bound, and evidence-bound.',
          '- `whole_person` customer meaning must be vector-free and assessment-free. It must not use coordinate names, vector/dimension/score/assessment language, or measured-pattern language.',
          '- Claim IDs must be unique. Every surface_claims entry must reference an ID from topology, attributes, or dynamics.',
          '- Every surface_evidence_refs entry must reference a supplied evidence ID.',
          '- The eight personality_dna coordinate_explanations must include each governed coordinate exactly once.',
          '- State each internal semantic value once in its owning field. Preserve every required distinction, but use evidence IDs instead of repeating source prose and do not restate sibling fields.',
          '- Emit minified JSON without indentation, line breaks, carriage returns, or repeated whitespace. After every value, immediately emit the required delimiter or next key.',
          '- Return only the response-schema JSON.',
          '',
          'GOVERNED PSEUDONYMOUS EVIDENCE:',
          JSON.stringify(packet),
          '',
          'BOUNDED HASH-VERIFIED DOCTRINE:',
          JSON.stringify(doctrine),
        ].join('\n'),
      })]),
    })]),
    text: Object.freeze({
      verbosity: NEW_BOS_REASONING_OUTPUT_BUDGET.text_verbosity,
      format: Object.freeze({
        type: 'json_schema',
        name: 'new_bos_personality_dna_interpretation_draft_v1',
        strict: true,
        schema: buildNewBosReasoningSchema(evidenceIds),
      }),
    }),
  });
  const privacy = inspectProviderPrivacy(request, governedPrivacyTokens);
  if (!privacy.valid) {
    const error = new Error('new_bos_reasoning_privacy_gate_failed');
    error.failures = privacy.failures;
    throw error;
  }
  return request;
}

export function createNewBosReasoningProvider({ transport, model, capture = async () => {}, privacyTokens = [] } = {}) {
  if (typeof transport !== 'function') throw new Error('new_bos_reasoning_transport_required');
  if (!model) throw new Error('new_bos_reasoning_model_required');
  if (typeof capture !== 'function') throw new Error('new_bos_reasoning_capture_invalid');
  let calls = 0;

  return Object.freeze({
    async infer({ raw_evidence: rawEvidence, governed_context: governedContext }) {
      if (calls !== 0) throw new Error('new_bos_reasoning_single_call_boundary_exceeded');
      calls += 1;
      const request = buildNewBosReasoningRequest({ rawEvidence, governedContext, model, privacyTokens });
      const startedAt = Date.now();
      const response = await transport(request);
      const rawReceipt = Object.freeze({
        stage: 'whole_person_reasoning',
        requested_model: model,
        returned_model: response?.model || null,
        provider_response_id: response?._request_id || response?.id || null,
        latency_ms: Date.now() - startedAt,
        usage: usageReceipt(response),
      });
      await capture(Object.freeze({ request, response, receipt: rawReceipt, captured_before_validation: true }));
      if (response?.status && response.status !== 'completed') throw new Error(`new_bos_reasoning_terminal_status:${response.status}`);
      if (!modelMatches(model, response?.model)) throw new Error('new_bos_reasoning_model_substitution_rejected');
      const text = outputText(response);
      if (!text) throw new Error('new_bos_reasoning_empty_output');
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('new_bos_reasoning_invalid_json');
      }
      return parsed;
    },
    callCount() {
      return calls;
    },
  });
}

export function createOpenAINewBosReasoningProvider({ apiKey, model, timeoutMs = 1_800_000, capture, privacyTokens } = {}) {
  if (!apiKey) throw new Error('new_bos_reasoning_openai_key_missing');
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: timeoutMs });
  return createNewBosReasoningProvider({
    model,
    capture,
    privacyTokens,
    transport: (request) => client.responses.create(request),
  });
}
