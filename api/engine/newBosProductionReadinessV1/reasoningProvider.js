import crypto from 'node:crypto';

import OpenAI from 'openai';

import { FORBIDDEN_WHOLE_PERSON_LANGUAGE } from '../../../src/lib/newBosPersonalityDnaV1/constants.js';

import { compactGovernedContext } from './libraryRetriever.js';
import {
  buildPseudonymousReasoningPacket,
  deriveProviderIdentityTokens,
  inspectProviderPrivacy,
  sanitizeProviderBoundText,
  sanitizeProviderBoundValue,
} from './privacyEgress.js';
import { buildNewBosReasoningSchema, NEW_BOS_REASONING_OUTPUT_BUDGET } from './reasoningContract.js';
import {
  buildNewBosSemanticStageSchema,
  semanticStageById,
  validateNewBosSemanticStageFragment,
} from './resumableSemanticContract.js';

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

export const NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1 = 'new_bos_semantic_stage_request_v1';
export const NEW_BOS_STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2 = 'new_bos_stage3_vector_free_request_v2';

export function semanticStageRequestContractVersion(stageId) {
  return stageId === 'whole_person_decision_synthesis'
    ? NEW_BOS_STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2
    : NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1;
}

function stageOutputBoundary({ stageId, requestContractVersion }) {
  if (stageId !== 'whole_person_decision_synthesis') return [];
  if (requestContractVersion === NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1) return [];
  if (requestContractVersion !== NEW_BOS_STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2) {
    throw new Error('new_bos_stage3_request_contract_unsupported');
  }
  return [
    '',
    `STAGE-3 OUTPUT BOUNDARY — ${NEW_BOS_STAGE3_VECTOR_FREE_REQUEST_CONTRACT_V2}:`,
    '- Coordinate vocabulary in the supplied evidence, doctrine, and accepted dependencies is internal analytic context and provenance only. Retain that intelligence for reasoning; do not copy its assessment language into customer meaning.',
    '- Every customer-facing human-meaning field inside `whole_person` must exclude every exact term in the shared prohibited-vocabulary list below.',
    '- Express supported mechanisms as ordinary lived behavior: what the person notices, decides, protects, changes, repeats, experiences, or does. Do not describe the person through assessment, vector, coordinate, score, dimension, or measured-pattern terminology.',
    `- SHARED PROHIBITED VOCABULARY (derived from the canonical validator): ${JSON.stringify(FORBIDDEN_WHOLE_PERSON_LANGUAGE)}`,
    '- This is a language boundary, not an intelligence-removal instruction. Preserve causal meaning, evidence, uncertainty, contradictions, and falsifiers.',
  ];
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

export function buildNewBosSemanticStageRequest({
  rawEvidence,
  governedContext,
  model,
  stageId,
  acceptedDependencies = [],
  privacyTokens = [],
  requestContractVersion = semanticStageRequestContractVersion(stageId),
}) {
  const stage = semanticStageById(stageId);
  if (stageId !== 'whole_person_decision_synthesis'
    && requestContractVersion !== NEW_BOS_SEMANTIC_STAGE_REQUEST_CONTRACT_V1) {
    throw new Error('new_bos_semantic_stage_request_contract_unsupported');
  }
  const governedPrivacyTokens = [...deriveProviderIdentityTokens(rawEvidence), ...privacyTokens];
  const packet = buildPseudonymousReasoningPacket(rawEvidence, governedPrivacyTokens);
  const evidenceIds = packet.evidence.map(({ evidence_id: id }) => id);
  const doctrine = compactGovernedContext(governedContext).map((item) => Object.freeze({
    ...item,
    doctrine: sanitizeProviderBoundText(item.doctrine, governedPrivacyTokens),
  }));
  const dependencies = acceptedDependencies.map(({ stage_id: dependencyStageId, fragment, fragment_sha256: fragmentSha256 }) => Object.freeze({
    stage_id: dependencyStageId,
    fragment_sha256: fragmentSha256,
    accepted_fragment: sanitizeProviderBoundValue(fragment, governedPrivacyTokens),
  }));
  const request = Object.freeze({
    model,
    store: false,
    reasoning: Object.freeze({ effort: 'xhigh' }),
    max_output_tokens: NEW_BOS_REASONING_OUTPUT_BUDGET.max_output_tokens,
    safety_identifier: crypto.createHash('sha256')
      .update(`new-bos-resumable:${stageId}:${rawEvidence.generation_metadata.canonical_source_sha256}`)
      .digest('hex')
      .slice(0, 32),
    input: Object.freeze([Object.freeze({
      role: 'user',
      content: Object.freeze([Object.freeze({
        type: 'input_text',
        text: [
          'MORE MindMap New BOS Resumable Generation V1 — governed whole-person semantic stage.',
          '',
          `Stage: ${stage.id}.`,
          `Mission: ${stage.mission}`,
          '',
          'Understand the complete governed person before producing this stage. The stage boundary limits output ownership, not reasoning context.',
          'Return only the fields owned by this stage and required by the strict response schema.',
          'Do not repeat sibling-stage intelligence. Do not invent biography, scenes, quotations, observer reactions, outcomes, dates, numbers, or history.',
          'Scores are probabilistic priors, never identity. Preserve contradictions, counterevidence, confounds, falsifiers, uncertainty, and abstention.',
          'Never diagnose, proxy intelligence, infer protected traits, or weaken a semantic distinction merely to reduce output.',
          'Every evidence reference must resolve to a supplied evidence ID. Reuse accepted claim IDs exactly where dependencies establish them.',
          'Emit minified JSON only.',
          '',
          'GOVERNED PSEUDONYMOUS EVIDENCE:',
          JSON.stringify(packet),
          '',
          'BOUNDED HASH-VERIFIED DOCTRINE:',
          JSON.stringify(doctrine),
          '',
          'ACCEPTED HASH-BOUND DEPENDENCIES:',
          JSON.stringify(dependencies),
          ...stageOutputBoundary({ stageId, requestContractVersion }),
        ].join('\n'),
      })]),
    })]),
    text: Object.freeze({
      verbosity: NEW_BOS_REASONING_OUTPUT_BUDGET.text_verbosity,
      format: Object.freeze({
        type: 'json_schema',
        name: `new_bos_resumable_${stage.id}_v1`,
        strict: true,
        schema: buildNewBosSemanticStageSchema({ stageId, evidenceIds }),
      }),
    }),
  });
  const privacy = inspectProviderPrivacy(request, governedPrivacyTokens);
  if (!privacy.valid) {
    const error = new Error('new_bos_semantic_stage_privacy_gate_failed');
    error.failures = privacy.failures;
    throw error;
  }
  return request;
}

export function createNewBosSemanticStageProvider({
  transport,
  model,
  stageId,
  capture = async () => {},
  privacyTokens = [],
  requestContractVersion = semanticStageRequestContractVersion(stageId),
} = {}) {
  if (typeof transport !== 'function') throw new Error('new_bos_semantic_stage_transport_required');
  if (!model) throw new Error('new_bos_semantic_stage_model_required');
  semanticStageById(stageId);
  let calls = 0;
  return Object.freeze({
    async infer({ raw_evidence: rawEvidence, governed_context: governedContext, accepted_dependencies: acceptedDependencies = [] }) {
      if (calls !== 0) throw new Error('new_bos_semantic_stage_single_call_boundary_exceeded');
      calls += 1;
      const request = buildNewBosSemanticStageRequest({
        rawEvidence,
        governedContext,
        model,
        stageId,
        acceptedDependencies,
        privacyTokens,
        requestContractVersion,
      });
      const startedAt = Date.now();
      const response = await transport(request);
      const receipt = Object.freeze({
        stage: stageId,
        requested_model: model,
        returned_model: response?.model || null,
        provider_response_id: response?._request_id || response?.id || null,
        latency_ms: Date.now() - startedAt,
        usage: usageReceipt(response),
      });
      await capture(Object.freeze({ request, response, receipt, captured_before_validation: true }));
      if (response?.status && response.status !== 'completed') throw new Error(`new_bos_semantic_stage_terminal_status:${response.status}`);
      if (!modelMatches(model, response?.model)) throw new Error('new_bos_semantic_stage_model_substitution_rejected');
      const serialized = outputText(response);
      if (!serialized) throw new Error('new_bos_semantic_stage_empty_output');
      let parsed;
      try {
        parsed = JSON.parse(serialized);
      } catch {
        throw new Error('new_bos_semantic_stage_invalid_json');
      }
      return validateNewBosSemanticStageFragment({ stageId, fragment: parsed });
    },
    callCount() {
      return calls;
    },
  });
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
