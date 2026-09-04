import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { issueBlindScope, blindRelationship } from '../api/engine/subscriptionBlindDemo/authority.js';
import { createBlindProvider } from '../api/engine/subscriptionBlindDemo/provider.js';
import { PRIVATE_ASSIGNMENT } from '../api/engine/subscriptionBlindDemo/privateAssignment.js';

const auth = () => ({ ok: true, capability_hash: 'a'.repeat(64), capability: {
  contract: 'subscription_v1_internal_capability_v2', authority_source: 'LEADERSHIP_DEMO',
  launcher_scope_id: 'leadership_demo_test', synthetic_only: true, allowed_demo_subjects: ['synthetic'],
  demo_subject_id: 'synthetic', subject_key: 're-mid', relationship_key: 'rel_11111111111111111111',
  synthetic_relationship_key: 'rel_11111111111111111111', expires_at: new Date(Date.now() + 3600000).toISOString(),
} });
const request = { model: 'gpt-5.6-sol', store: false, background: false, reasoning: { effort: 'xhigh' },
  tools: [], max_output_tokens: 6000, text: { format: { type: 'json_schema' } }, input: [{ role: 'user', content: 'Synthetic governed test.' }] };

test('demo credential read requires server-issued authenticated synthetic scope', () => {
  let reads = 0;
  const env = new Proxy({}, { get() { reads += 1; throw Error('credential read denied'); } });
  for (const scope of [null, {}, { selection: '1', synthetic_only: true, subject_key: 're-mid' }]) {
    assert.throws(() => createBlindProvider({ scope, env }), /BLIND_DEMO_PROVIDER_SCOPE_DENIED/u);
  }
  for (const overrides of [{ synthetic_only: false }, { authority_source: 'DIRECT_SYNTHETIC' }, { subject_key: 'patricia-demo-s2' }, { expires_at: '2020-01-01' }]) {
    const value = auth(); Object.assign(value.capability, overrides);
    assert.throws(() => issueBlindScope(value, '1'), /BLIND_DEMO_AUTHORITY_DENIED/u);
  }
  assert.equal(reads, 0);
});

test('each private assignment reads only its own credential and cannot fall back', async () => {
  for (const id of ['1', '2']) {
    const scope = issueBlindScope(auth(), id);
    const canonical = PRIVATE_ASSIGNMENT[id] === 'canonical';
    const ownName = canonical ? 'OPENAI_API_KEY' : 'SUBSCRIPTION_DEMO_EXPERIMENT_API_KEY';
    const reads = [];
    const env = new Proxy({}, { get(_t, key) { reads.push(key); return key === ownName ? 'synthetic-test-credential' : undefined; } });
    let options, wire;
    const provider = createBlindProvider({ scope, env, clientFactory(args) {
      options = args;
      return { responses: { async create(value) { wire = value; return { id: 'synthetic-response', status: 'completed', output_text: '{"candidate":null}', output: [], usage: {} }; } } };
    } });
    await provider.coaching(request, { stage: 'CANDIDATE_EXTRACTION' });
    assert.deepEqual(reads, [ownName]);
    assert.ok(options.baseURL === (canonical ? 'https://api.openai.com/v1' : 'https://api.x.ai/v1'), 'exact assigned destination');
    assert.ok(wire.model === (canonical ? 'gpt-5.6-sol' : 'grok-4.6'), 'exact assigned model');
    assert.deepEqual(wire.input, request.input);
    assert.deepEqual(wire.text, request.text);
    assert.deepEqual(wire.reasoning, request.reasoning);
    assert.equal(wire.store, false);
    assert.throws(() => createBlindProvider({ scope, env: { [canonical ? 'SUBSCRIPTION_DEMO_EXPERIMENT_API_KEY' : 'OPENAI_API_KEY']: 'wrong-provider-fixture' } }), /BLIND_DEMO_PROVIDER_BINDING_REQUIRED/u);
  }
});

test('canonical and visual transports retain privacy and identical governed request policy', async () => {
  for (const id of ['1', '2']) {
    let calls = 0;
    const provider = createBlindProvider({ scope: issueBlindScope(auth(), id), env: { OPENAI_API_KEY: 'fixture-one', SUBSCRIPTION_DEMO_EXPERIMENT_API_KEY: 'fixture-two' },
      clientFactory: () => ({ responses: { async create() { calls += 1; return { status: 'completed', output_text: '{}', output: [], usage: {} }; } } }) });
    await assert.rejects(provider.visual({ ...request, store: true }), /POLICY_DENIED/u);
    await assert.rejects(provider.coaching({ ...request, input: [{ role: 'user', content: 'person@example.invalid' }] }, { stage: 'CANDIDATE_EXTRACTION' }), /REAL_CUSTOMER_DATA_DENIED/u);
    assert.equal(calls, 0);
  }
});

test('blind selection cannot accept profile identifiers or merge the two deterministic relationships', () => {
  const value = auth();
  assert.notEqual(blindRelationship(value, '1'), blindRelationship(value, '2'));
  assert.equal(blindRelationship(value, '1'), blindRelationship(value, '1'));
  for (const id of ['patricia-demo', 're-mid', 'MODEL 1', '', '3']) assert.throws(() => issueBlindScope(value, id), /SELECTION_DENIED/u);
});

test('additional provider binding has a single server-only consumer; canonical transport defaults unchanged', () => {
  const files = fs.readdirSync(new URL('../api/engine/subscriptionBlindDemo/', import.meta.url));
  assert.ok(files.includes('provider.js'));
  for (const path of ['../api/engine/subscriptionV1/liveDemoOpenAiTransport.js', '../api/engine/subscriptionS2/openAiTransport.js']) {
    const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /SUBSCRIPTION_DEMO_EXPERIMENT_API_KEY/u);
    assert.match(source, /suppliedClient \|\| new OpenAI/u);
  }
});
