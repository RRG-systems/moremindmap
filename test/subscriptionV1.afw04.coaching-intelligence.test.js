import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AFW04_MODEL,
  FOUNDER_COACHING_DOCTRINE_HASH,
  FRONTIER_COACHING_OUTPUT_SCHEMA,
  createAfw04ProviderRuntime,
  createExternalEvidenceBroker,
  retrieveCoachingDoctrine,
  validateCustomerLanguage,
} from '../src/lib/subscriptionV1/index.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const statePacket = Object.freeze({
  packet_hash: hashCanonicalJson({ fixture: 'afw04-state' }),
  purpose: 'WEEKLY_COACHING', active_lens: 'WHERE_YOU_ARE',
  artifact_lineage: [{ artifact_type: 'NEW_BOS', content_hash: hashCanonicalJson('bos') }, { artifact_type: 'NEW_BA', content_hash: hashCanonicalJson('ba') }],
  business_truth: [{ evidence_id: 'business_fact_pipeline', evidence_domain: 'BUSINESS', content_hash: hashCanonicalJson('pipeline'), certainty: 'KNOWN' }],
  whole_person_execution_context: [{ evidence_id: 'execution_context_pacing', evidence_domain: 'WHOLE_PERSON_EXECUTION', content_hash: hashCanonicalJson('pacing'), certainty: 'INFERRED' }],
  uncertainty: ['Weekly qualified opportunity count is missing.'], current_state: { stated_goal: 'Improve qualified opportunity flow.' },
  personal_rsl_retrieval_hash: hashCanonicalJson({ fixture: 'personal-rsl' }),
});

function outputFor(doctrine, overrides = {}) {
  return {
    customer_message: 'You have a clear goal, but we do not yet know whether enough qualified opportunity is entering the business. What number would let us test that this week?',
    proposal: {
      proposal_type: 'QUESTION', target_contract: null, operation: 'CLARIFY', summary: 'Clarify qualified opportunity flow.', items: [], reason: 'The governing input is missing.',
      evidence_ref_ids: ['business_fact_pipeline'], authority_ref_ids: [doctrine.selected_authority_refs[0]], confirmation_required: true, generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    },
    research_need: null,
    ...overrides,
  };
}

test('AFW-04 doctrine is version/hash-bound and retrieves all three intelligence layers without code forks', () => {
  const realEstate = retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING', vertical_id: 'REAL_ESTATE' });
  const kernelOnly = retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING' });
  const services = retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING', vertical_id: 'PROFESSIONAL_SERVICES' });
  assert.equal(realEstate.doctrine_hash, FOUNDER_COACHING_DOCTRINE_HASH);
  assert.equal(realEstate.layers.universal_kernel.length, 18);
  assert.equal(realEstate.layers.vertical_cassette.every((item) => item.vertical_id === 'REAL_ESTATE'), true);
  assert.equal(kernelOnly.layers.vertical_cassette.length, 0);
  assert.equal(services.layers.vertical_cassette.every((item) => item.vertical_id === 'PROFESSIONAL_SERVICES'), true);
  assert.equal(realEstate.layers.universal_kernel.some((item) => /6x6|8x8|FSBO/u.test(item.guidance)), false);
});

test('AFW-04 provider is default-off, server-shaped, store:false, strict-schema and no-tool', async () => {
  let calls = 0;
  const runtime = createAfw04ProviderRuntime({ transport: async () => { calls += 1; return {}; } });
  assert.equal(runtime.inspect().enabled, false);
  assert.equal(runtime.inspect().model, AFW04_MODEL);
  assert.equal((await runtime.coach({ session_id: 'session-afw04' })).code, 'AFW04_PROVIDER_DEFAULT_OFF');
  assert.equal(calls, 0);
  assert.equal(FRONTIER_COACHING_OUTPUT_SCHEMA.strict, true);
});

test('AFW-04 accepts natural coaching and creates a hidden unaccepted proposal without mutation', async () => {
  const doctrine = retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING', vertical_id: 'REAL_ESTATE' });
  let captured;
  const runtime = createAfw04ProviderRuntime({ enabled: true, transport: async (request) => {
    captured = request;
    return { output: outputFor(doctrine), request_hash: hashCanonicalJson(request), usage: { input_tokens: 1000, output_tokens: 200 }, latency_ms: 1200, first_token_latency_ms: 300 };
  }, now: () => '2026-08-18T20:00:00.000Z' });
  const result = await runtime.coach({ state_packet: statePacket, doctrine_retrieval: doctrine, customer_turn: 'I need more leads.', vertical_context: { vertical_id: 'REAL_ESTATE' }, session_id: 'session-afw04-alpha', scope_hash: hashCanonicalJson('scope') });
  assert.equal(result.ok, true, result.code);
  assert.equal(captured.model, 'gpt-5.6-sol');
  assert.equal(captured.store, false);
  assert.deepEqual(captured.tools, []);
  assert.equal(captured.text.format.strict, true);
  assert.equal(result.hidden_proposal.status, 'HIDDEN_UNACCEPTED_PROPOSAL');
  assert.equal(result.hidden_proposal.customer_state_mutation_performed, false);
  assert.equal(result.mutation_performed, false);
  assert.equal(result.receipt.raw_payload_persisted, false);
});

test('AFW-04 rejects invented refs, internal labels and personality-as-business-cause', async () => {
  const doctrine = retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING' });
  const invented = createAfw04ProviderRuntime({ enabled: true, transport: async (request) => ({ output: outputFor(doctrine, { proposal: { ...outputFor(doctrine).proposal, authority_ref_ids: ['vertical_cassette:INVENTED:X'] } }), request_hash: hashCanonicalJson(request), usage: {} }) });
  assert.equal((await invented.coach({ state_packet: statePacket, doctrine_retrieval: doctrine, customer_turn: 'Help.', session_id: 'session-invented', scope_hash: hashCanonicalJson('scope') })).code, 'AFW04_PROVIDER_OUTPUT_INVALID');
  assert.equal(validateCustomerLanguage('Because your personality causes the pipeline problem.').failures.includes('PERSONALITY_AS_BUSINESS_CAUSE'), true);
  assert.equal(validateCustomerLanguage('Use UK-01 and KNOWN evidence.').valid, false);
});

test('AFW-04 retries exactly once only for transient unchanged requests and never for prose preference', async () => {
  const doctrine = retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING' });
  let calls = 0;
  const runtime = createAfw04ProviderRuntime({ enabled: true, transport: async (request) => {
    calls += 1;
    if (calls === 1) { const error = new Error('temporary'); error.code = 'ETIMEDOUT'; throw error; }
    return { output: outputFor(doctrine), request_hash: hashCanonicalJson(request), usage: { input_tokens: 10, output_tokens: 10 } };
  } });
  const accepted = await runtime.coach({ state_packet: statePacket, doctrine_retrieval: doctrine, customer_turn: 'Help.', session_id: 'session-retry', scope_hash: hashCanonicalJson('scope') });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.receipt.retry_count, 1);
  assert.equal(calls, 2);
  calls = 0;
  const invalid = createAfw04ProviderRuntime({ enabled: true, transport: async (request) => { calls += 1; return { output: outputFor(doctrine, { customer_message: 'UK-01' }), request_hash: hashCanonicalJson(request), usage: {} }; } });
  assert.equal((await invalid.coach({ state_packet: statePacket, doctrine_retrieval: doctrine, customer_turn: 'Help.', session_id: 'session-quality', scope_hash: hashCanonicalJson('scope') })).code, 'AFW04_CUSTOMER_LANGUAGE_INVALID');
  assert.equal(calls, 1);
});

test('AFW-04 external broker denies private/low-value queries and preserves primary-source provenance', async () => {
  let searched = 0;
  const broker = createExternalEvidenceBroker({ searchAdapter: async () => { searched += 1; return [{ url: 'https://www.nar.realtor/handbook', title: 'Official policy', citation: 'Written buyer agreements are required before touring, subject to applicable law.', published_at: '2026-01-01T00:00:00.000Z' }]; }, now: () => '2026-08-18T20:00:00.000Z' });
  assert.equal((await broker.research({ needed: true, purpose: 'check', materiality: 'HIGH', query: 'customer: Patricia revenue: private', desired_source_type: 'PRIMARY_OFFICIAL', private_data_required: false })).code, 'EXTERNAL_PRIVATE_QUERY_DENIED');
  assert.equal(searched, 0);
  const found = await broker.research({ needed: true, purpose: 'Verify current buyer-agreement rule', materiality: 'HIGH', query: 'current written buyer agreement rule before home touring', desired_source_type: 'PRIMARY_OFFICIAL', private_data_required: false });
  assert.equal(found.ok, true);
  assert.equal(found.evidence[0].source_trust, 'PRIMARY_OFFICIAL');
  assert.equal(found.evidence[0].customer_truth_override_allowed, false);
  assert.equal(found.evidence[0].privacy_classification, 'PUBLIC');
});

test('AFW-04 generalization scope prevents vertical learning from becoming universal authority', async () => {
  const doctrine = retrieveCoachingDoctrine({ purpose: 'WEEKLY_COACHING', vertical_id: 'PROFESSIONAL_SERVICES' });
  const proposed = outputFor(doctrine, { proposal: { ...outputFor(doctrine).proposal, authority_ref_ids: [doctrine.layers.vertical_cassette[0].authority_ref], generalization_scope: 'VERTICAL_SPECIFIC' } });
  const runtime = createAfw04ProviderRuntime({ enabled: true, transport: async (request) => ({ output: proposed, request_hash: hashCanonicalJson(request), usage: { input_tokens: 1, output_tokens: 1 } }) });
  const result = await runtime.coach({ state_packet: statePacket, doctrine_retrieval: doctrine, customer_turn: 'Margins are shrinking.', vertical_context: { vertical_id: 'PROFESSIONAL_SERVICES' }, session_id: 'session-scope', scope_hash: hashCanonicalJson('scope') });
  assert.equal(result.hidden_proposal.generalization_scope, 'VERTICAL_SPECIFIC');
  assert.equal(result.hidden_proposal.status, 'HIDDEN_UNACCEPTED_PROPOSAL');
});
