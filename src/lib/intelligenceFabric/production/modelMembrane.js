import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';

export const MODEL_PURPOSES = Object.freeze([
  'CONVERSATION_PLAN_PROPOSAL',
  'EXTRACTION_PROPOSAL',
  'EXPLANATION_PROPOSAL',
  'EVIDENCE_REQUEST_PROPOSAL',
]);

export class ModelProvider {
  async propose() {
    throw Error('NOT_IMPLEMENTED');
  }
}

export class DeterministicFixtureProvider extends ModelProvider {
  constructor(response) {
    super();
    this.response = response;
    this.calls = 0;
  }

  async propose(request) {
    this.calls += 1;
    return typeof this.response === 'function'
      ? this.response(request)
      : this.response;
  }
}

const injection = /(?:ignore|disregard|override|forget|bypass).{0,40}(?:instruction|message|policy|context)|(?:reveal|print|show|repeat).{0,40}(?:system prompt|developer message|internal policy|secret|credential)|<system>|role\s*:\s*system|authorize.*one move|execute.*action/i;

function containsInjection(value, depth = 0) {
  if (depth > 8 || value == null) return false;
  if (typeof value === 'string') return injection.test(value);
  if (Array.isArray(value)) {
    return value.some((entry) => containsInjection(entry, depth + 1));
  }
  if (typeof value !== 'object') return false;
  return Object.values(value).some((entry) => containsInjection(entry, depth + 1));
}

function minimalContext(context) {
  return (context || [])
    .filter((entry) => entry.privacy_classification !== 'COACH_SESSION_PRIVATE'
      && entry.scope_match === true)
    .map((entry) => ({
      context_id: entry.context_id,
      context_type: entry.context_type,
      value: entry.value,
      privacy_classification: entry.privacy_classification,
    }))
    .sort((left, right) => left.context_id.localeCompare(right.context_id));
}

function validateProposal(output, scope) {
  if (!output
    || !['RESPONSE_PLAN', 'EXTRACTION', 'EXPLANATION', 'EVIDENCE_REQUEST']
      .includes(output.proposal_type)
    || typeof output.payload !== 'object'
    || Array.isArray(output.payload)) {
    return { valid: false, decision: 'MALFORMED' };
  }
  const forbidden = [
    'canonical_event',
    'authorization',
    'consent',
    'execute',
    'share_coach_private',
    'promote_learning',
    'calibrated_prediction',
    'causal_proof',
  ];
  if (forbidden.some((key) => key in output.payload)) {
    return { valid: false, decision: 'UNSAFE' };
  }
  if (output.scope && ['tenant_id', 'profile_id', 'business_id']
    .some((key) => output.scope[key] !== scope[key])) {
    return { valid: false, decision: 'REJECTED' };
  }
  return {
    valid: true,
    decision: output.human_review_required
      ? 'HUMAN_REVIEW_REQUIRED'
      : output.clarification_required
        ? 'CLARIFICATION_REQUIRED'
        : output.reduced_weight
          ? 'ACCEPTED_WITH_REDUCED_WEIGHT'
          : 'ACCEPTED_PROPOSAL',
  };
}

export async function runGovernedModelMembrane({
  provider,
  feature_flags: featureFlags,
  request,
  context,
  retry_policy: retryPolicy = { max_attempts: 1 },
}) {
  if (featureFlags?.model_provider_enabled !== true) {
    return deepFreeze({
      ok: false,
      decision: 'PROVIDER_FAILURE',
      code: 'MODEL_PROVIDER_DISABLED',
      provider_calls: 0,
    });
  }
  if (!MODEL_PURPOSES.includes(request?.purpose)
    || !request?.tenant_id
    || !request.profile_id
    || !request.business_id) {
    return deepFreeze({
      ok: false,
      decision: 'REJECTED',
      code: 'INVALID_MODEL_REQUEST',
    });
  }
  const scoped = minimalContext(context);
  const contextInjection = request.purpose === 'CONVERSATION_PLAN_PROPOSAL'
    ? containsInjection(scoped)
    : scoped.some((entry) => typeof entry.value === 'string'
      && injection.test(entry.value));
  if (contextInjection || containsInjection(request.user_input || '')) {
    return deepFreeze({
      ok: false,
      decision: 'UNSAFE',
      code: 'PROMPT_INJECTION_DETECTED',
      provider_calls: 0,
    });
  }
  const envelope = {
    request_version: '1.0.0',
    request_id: request.request_id,
    trace_id: request.trace_id,
    tenant_id: request.tenant_id,
    profile_id: request.profile_id,
    business_id: request.business_id,
    purpose: request.purpose,
    prompt_id: request.prompt_id,
    prompt_version: request.prompt_version,
    output_schema_version: '1.0.0',
    privacy_policy_version: 'model-context-v1',
    context: scoped,
    context_hash: hashCanonicalJson(scoped),
    user_input: request.user_input || null,
  };
  let output;
  let error;
  const attempts = Math.max(1, Math.min(2, retryPolicy.max_attempts || 1));
  for (let index = 0; index < attempts; index += 1) {
    try {
      output = await provider.propose(deepFreeze(envelope));
      error = null;
      break;
    } catch (caught) {
      error = caught;
      if (!['TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE'].includes(caught.code)) break;
    }
  }
  if (error) {
    return deepFreeze({
      ok: false,
      decision: 'PROVIDER_FAILURE',
      code: ['TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE'].includes(error.code)
        ? error.code
        : 'PROVIDER_ERROR',
      provider_calls: provider.calls ?? null,
    });
  }
  const validation = validateProposal(output, request);
  const receipt = {
    receipt_id: `model_receipt_${hashCanonicalJson({
      envelope: {
        ...envelope,
        user_input: null,
        context: envelope.context.map((entry) => ({ ...entry, value: '[MINIMIZED]' })),
      },
      output_hash: hashCanonicalJson(output),
      decision: validation.decision,
    }).slice(0, 20)}`,
    decision: validation.decision,
    request_id: request.request_id,
    trace_id: request.trace_id,
    provider_id: output.provider_id || 'DETERMINISTIC_FIXTURE',
    model_id: output.model_id || 'DETERMINISTIC_FIXTURE',
    usage: output.usage || { input_units: 0, output_units: 0, cost: null },
    proposal_hash: hashCanonicalJson(output),
    privacy_safe: true,
  };
  return deepFreeze({
    ok: validation.valid,
    decision: validation.decision,
    proposal: validation.valid
      ? {
          ...output,
          status: 'PROPOSAL_ONLY',
          canonical_mutation_eligible: false,
        }
      : null,
    receipt,
  });
}
