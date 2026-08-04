import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  OpenAiLivingConversationProvider,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/livingConversation/openAiProvider.js';
import {
  LIVING_CONVERSATION_PROVIDER_CREDENTIAL_REFERENCE,
  livingConversationProviderBindingDigest,
  readLivingConversationProviderBindingV1,
  validateLivingConversationProviderBindingV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/livingConversation/providerBinding.js';

const nowMs = Date.parse('2026-08-04T12:00:00.000Z');
const environmentId = 'private_live_living_conversation';
const packetSha = 'a'.repeat(64);
const productBinding = Object.freeze({
  binding_sha256: 'b'.repeat(64),
  exact_scope_hash: 'c'.repeat(64),
});

function binding(overrides = {}) {
  const value = {
    binding_version: 'living-conversation-provider-binding-v1',
    environment_id: environmentId,
    configuration_authority_packet_sha256: packetSha,
    product_binding_attestation_sha256: productBinding.binding_sha256,
    enabled: true,
    source_default_off: true,
    private_beta_only: true,
    public_access: false,
    provider: 'OPENAI',
    credential_ref: LIVING_CONVERSATION_PROVIDER_CREDENTIAL_REFERENCE,
    model: 'synthetic-model-v1',
    scope_mode: 'EXACT_PROFILE',
    exact_scope_hash: productBinding.exact_scope_hash,
    approved_profile_cohort_sha256: null,
    provider_data_retention_mode: 'ZERO_DATA_RETENTION',
    allowed_purposes: ['CONVERSATION_PLAN_PROPOSAL'],
    timeout_ms: 10_000,
    max_output_tokens: 1_800,
    max_input_chars: 56_000,
    issued_at: '2026-08-04T00:00:00.000Z',
    review_due_at: '2026-09-04T00:00:00.000Z',
    ...overrides,
  };
  value.binding_sha256 = livingConversationProviderBindingDigest(value);
  return value;
}

test('provider binding is exact, protected, private-beta-only, and default-off', async () => {
  const valid = validateLivingConversationProviderBindingV1(binding(), {
    environmentId,
    configurationAuthorityPacketSha256: packetSha,
    productBindingAttestation: productBinding,
    nowMs,
  });
  assert.equal(valid.valid, true, JSON.stringify(valid.errors));
  const standardRetention = validateLivingConversationProviderBindingV1(binding({
    provider_data_retention_mode: 'STANDARD_ABUSE_MONITORING_STORE_FALSE',
  }), {
    environmentId,
    configurationAuthorityPacketSha256: packetSha,
    productBindingAttestation: productBinding,
    nowMs,
  });
  assert.equal(standardRetention.valid, true, JSON.stringify(standardRetention.errors));
  for (const patch of [
    { public_access: true },
    { source_default_off: false },
    { enabled: false },
    { allowed_purposes: ['CONVERSATION_PLAN_PROPOSAL', 'EXTRACTION_PROPOSAL'] },
    { credential_ref: 'invalid-reference' },
    { credential_ref: 'OPENAI_API_KEY' },
    { credential_ref: 'MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_CREDENTIAL' },
    { credential_ref: 'MORE_PRIVATE_RUNTIME_OTHER_SECRET' },
    { provider_data_retention_mode: 'UNDECLARED_RETENTION' },
    { scope_mode: 'APPROVED_PROFILE_COHORT' },
    { review_due_at: '2026-08-04T11:00:00.000Z' },
  ]) {
    assert.equal(validateLivingConversationProviderBindingV1(binding(patch), {
      environmentId,
      configurationAuthorityPacketSha256: packetSha,
      productBindingAttestation: productBinding,
      nowMs,
    }).valid, false);
  }
  const absent = await readLivingConversationProviderBindingV1({
    env: {},
    resolveReference: async () => {
      throw new Error('must not be called');
    },
  });
  assert.equal(absent.ok, false);
  assert.equal(absent.configured, false);
  assert.equal(absent.code, 'LIVING_CONVERSATION_PROVIDER_UNCONFIGURED');
});

test('provider binding resolves a bounded non-secret document and never resolves its credential', async () => {
  const calls = [];
  const value = binding();
  const result = await readLivingConversationProviderBindingV1({
    env: {
      MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_BINDING_REF:
        'MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_BINDING_JSON',
    },
    resolveReference: async (reference, options) => {
      calls.push({ reference, options });
      return JSON.stringify(value);
    },
    environmentId,
    configurationAuthorityPacketSha256: packetSha,
    productBindingAttestation: productBinding,
    nowMs,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(calls, [{
    reference: 'MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_BINDING_JSON',
    options: {
      purpose: 'MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_BINDING_REF',
      secret: false,
    },
  }]);
  assert.equal(calls.some((call) => call.reference === value.credential_ref), false);
});

test('OpenAI provider uses server-only authorization and returns only a proposal', async () => {
  let observed;
  const provider = new OpenAiLivingConversationProvider({
    apiKey: ['synthetic', 'credential', 'material'].join('-'),
    model: 'synthetic-model-v1',
    fetchImpl: async (url, options) => {
      observed = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            choices: [{ message: { content: JSON.stringify({
              payload_version: 'living-conversation-provider-payload-v1',
              natural_response: 'A grounded natural response.',
              reasoning_summary: 'A safe summary.',
              grounding: { known: [], observed: [], inferred: [], unknown: [] },
              evidence_references: [],
              confidence: { level: 'LOW', explanation: 'Evidence is sparse.' },
              missing_evidence: [],
              behavioral_modifiers: [],
              five_future_references: [],
              one_move_references: [],
              challenge: null,
              clarifying_questions: ['What changed this week?'],
              proposed_evidence: [],
            }) } }],
            usage: { prompt_tokens: 100, completion_tokens: 50 },
          };
        },
      };
    },
  });
  const result = await provider.propose({
    purpose: 'CONVERSATION_PLAN_PROPOSAL',
    request_id: 'request_provider',
    tenant_id: 'tenant_provider',
    profile_id: 'profile_provider',
    business_id: 'business_provider',
    user_input: 'What should I focus on?',
    context: [],
  });
  assert.equal(result.proposal_type, 'RESPONSE_PLAN');
  assert.equal(result.provider_id, 'OPENAI');
  assert.equal(observed.url, 'https://api.openai.com/v1/chat/completions');
  assert.match(observed.options.headers.Authorization, /^Bearer synthetic-/);
  const requestBody = JSON.parse(observed.options.body);
  assert.equal(requestBody.response_format.type, 'json_schema');
  assert.equal(requestBody.response_format.json_schema.strict, true);
  assert.equal(requestBody.response_format.json_schema.schema.additionalProperties, false);
  assert.equal(requestBody.store, false);
  assert.deepEqual(requestBody.messages.map((message) => message.role), [
    'system',
    'developer',
    'user',
  ]);
  assert.equal(JSON.stringify(result).includes('credential-material'), false);
});

test('provider timeout remains active through body consumption', async () => {
  let cancelled = false;
  const provider = new OpenAiLivingConversationProvider({
    apiKey: ['synthetic', 'credential', 'material'].join('-'),
    model: 'synthetic-model-v1',
    timeoutMs: 1,
    fetchImpl: async (_url, options) => ({
      ok: true,
      status: 200,
      body: {
        getReader() {
          return {
            read() {
              return new Promise((_resolve, reject) => {
                options.signal.addEventListener('abort', () => {
                  const error = new Error('aborted');
                  error.name = 'AbortError';
                  reject(error);
                });
              });
            },
            async cancel() {
              cancelled = true;
            },
          };
        },
      },
    }),
  });
  await assert.rejects(provider.propose({
    purpose: 'CONVERSATION_PLAN_PROPOSAL',
    user_input: 'A question',
    context: [],
  }), (error) => error.code === 'TIMEOUT');
  assert.equal(cancelled, false);
});

test('cohort provider binding requires the exact protected cohort digest', () => {
  const cohort = { cohort_sha256: 'd'.repeat(64) };
  const value = binding({
    scope_mode: 'APPROVED_PROFILE_COHORT',
    exact_scope_hash: null,
    approved_profile_cohort_sha256: cohort.cohort_sha256,
  });
  assert.equal(validateLivingConversationProviderBindingV1(value, {
    environmentId,
    configurationAuthorityPacketSha256: packetSha,
    productBindingAttestation: productBinding,
    approvedProfileCohort: cohort,
    nowMs,
  }).valid, true);
  assert.equal(validateLivingConversationProviderBindingV1(value, {
    environmentId,
    configurationAuthorityPacketSha256: packetSha,
    productBindingAttestation: productBinding,
    approvedProfileCohort: { cohort_sha256: 'e'.repeat(64) },
    nowMs,
  }).valid, false);
});

test('provider refuses non-conversation purpose and degrades safely on upstream failures', async () => {
  const provider = new OpenAiLivingConversationProvider({
    apiKey: ['synthetic', 'credential', 'material'].join('-'),
    model: 'synthetic-model-v1',
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  await assert.rejects(
    provider.propose({ purpose: 'EXTRACTION_PROPOSAL' }),
    (error) => error.code === 'PROVIDER_ERROR',
  );
  await assert.rejects(
    provider.propose({
      purpose: 'CONVERSATION_PLAN_PROPOSAL',
      user_input: 'A question',
      context: [],
    }),
    (error) => error.code === 'RATE_LIMIT',
  );
});

test('composition root resolves the provider credential server-side and binds both execution modes', () => {
  const source = readFileSync(new URL(
    '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/compositionRoot.js',
    import.meta.url,
  ), 'utf8');
  assert.match(source, /readLivingConversationProviderBindingV1/);
  assert.match(source, /purpose: 'MORE_PRIVATE_RUNTIME_CONVERSATION_PROVIDER_CREDENTIAL',[\s\S]{0,80}secret: true/);
  assert.doesNotMatch(source, /OPENAI_API_KEY/);
  assert.equal((source.match(/conversationProvider,/g) || []).length >= 2, true);
  assert.equal((source.match(/conversationProviderBinding,/g) || []).length >= 2, true);
});
