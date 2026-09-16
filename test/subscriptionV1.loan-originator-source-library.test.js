import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { createSubscriptionLiveDemoOpenAiTransport } from '../api/engine/subscriptionV1/liveDemoOpenAiTransport.js';
import {
  pinnedLoanOriginatorSubscriptionSources,
  pinnedSubscriptionSources,
} from '../api/engine/subscriptionV1/pinnedSources.js';
import {
  LOAN_ORIGINATOR_SOURCE_NAMESPACES,
  LOAN_ORIGINATOR_SOURCE_TOOLS,
  MORE_SOURCE_TOOLS,
} from '../api/engine/subscriptionV1/readOnlySources.js';
import { resolveSyntheticQaSourceLibrary } from '../api/engine/subscriptionV1/syntheticQaRuntimeComposition.js';

const copy = (value) => JSON.parse(JSON.stringify(value));
const request = () => ({
  model: 'gpt-5.6-sol',
  reasoning: { effort: 'xhigh' },
  store: false,
  background: false,
  max_output_tokens: 2000,
  tools: [],
  text: { format: { type: 'json_schema', name: 'offline', strict: true, schema: { type: 'object' } } },
  input: [{ role: 'user', content: 'Use governed Loan Originator references without creating a commitment.' }],
});
const response = (output, n) => ({
  id: `offline-lo-source-${n}`,
  status: 'completed',
  output,
  usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 0 } },
});
const call = (name, args, n) => response([{
  type: 'function_call',
  call_id: `lo-call-${n}`,
  name,
  arguments: JSON.stringify(args),
  status: 'completed',
}], n);
const final = (n) => response([{
  type: 'message',
  role: 'assistant',
  content: [{
    type: 'output_text',
    text: JSON.stringify({ customer_message: 'This remains governed exploration, not an agreed plan.' }),
    annotations: [],
  }],
}], n);

test('pinned Loan Originator source custody is complete, isolated, and byte-verifiable', () => {
  const library = pinnedLoanOriginatorSubscriptionSources();
  assert.equal(library.info.status, 'AVAILABLE');
  assert.equal(library.info.document_count, 16);
  assert.deepEqual(library.info.namespaces, LOAN_ORIGINATOR_SOURCE_NAMESPACES);
  assert.deepEqual(library.tools, LOAN_ORIGINATOR_SOURCE_TOOLS);
  assert.notDeepEqual(library.tools, MORE_SOURCE_TOOLS);

  const found = library.execute('more_source_search', {
    query: 'Opportunity Source Network and Customer Relationship Network',
    namespace: 'more.ba-bible.loan-originator',
  });
  assert.equal(found.ok, true);
  assert.equal(found.code, 'SOURCE_MATCHES');
  assert.ok(found.results.length > 0);
  assert.ok(found.results.every((row) => row.namespace === 'more.ba-bible.loan-originator'));

  const chosen = found.results[0];
  const read = library.execute('more_source_read', {
    source_id: chosen.source_id,
    version: chosen.version,
    document_sha256: chosen.document_sha256,
    start_line: chosen.start_line,
    line_count: 12,
  });
  assert.equal(read.ok, true);
  assert.equal(createHash('sha256').update(read.excerpt).digest('hex'), read.excerpt_sha256);
  assert.equal(read.customer_truth_override_allowed, false);

  const rejected = library.execute('more_source_search', {
    query: 'listing consultation',
    namespace: 'more.ba-bible.real-estate',
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'SOURCE_ARGUMENTS_INVALID');
});

test('Loan Originator conversation advertises only the isolated LO tools', async () => {
  const library = pinnedLoanOriginatorSubscriptionSources();
  const args = {
    query: 'aggregate pipeline capacity evidence',
    namespace: 'more.ba-bible.loan-originator',
  };
  const queue = [call('more_source_search', args, 1), final(2)];
  const wires = [];
  const transport = createSubscriptionLiveDemoOpenAiTransport({
    apiKey: 'offline-only',
    sourceLibrary: library,
    maxTransportRetries: 0,
    client: { responses: { create: async (wire) => {
      wires.push(copy(wire));
      return queue.shift();
    } } },
  });
  const result = await transport(request(), { stage: 'CONVERSATION' });
  assert.equal(result.internal_source_calls, 1);
  assert.equal(wires.length, 2);
  assert.deepEqual(wires[0].tools, LOAN_ORIGINATOR_SOURCE_TOOLS);
  assert.deepEqual(wires[1].tools, LOAN_ORIGINATOR_SOURCE_TOOLS);
  assert.equal(JSON.stringify(wires).includes('more.ba-bible.real-estate'), false);
  assert.equal(JSON.stringify(wires).includes('more.dj-field-doctrine.real-estate'), false);
});

test('synthetic runtime resolves the exact source library for each supported vertical only', () => {
  const realEstate = resolveSyntheticQaSourceLibrary({
    projection: { synthetic_only: true, doctrine_vertical_id: 'REAL_ESTATE' },
  });
  const loanOriginator = resolveSyntheticQaSourceLibrary({
    projection: { synthetic_only: true, doctrine_vertical_id: 'LOAN_ORIGINATOR' },
  });
  assert.equal(realEstate, pinnedSubscriptionSources());
  assert.equal(loanOriginator, pinnedLoanOriginatorSubscriptionSources());
  assert.throws(() => resolveSyntheticQaSourceLibrary({
    projection: { synthetic_only: true, doctrine_vertical_id: 'PROFESSIONAL_SERVICES' },
  }), /SOURCE_VERTICAL_UNSUPPORTED/);
  assert.throws(() => resolveSyntheticQaSourceLibrary({
    projection: { synthetic_only: false, doctrine_vertical_id: 'LOAN_ORIGINATOR' },
  }), /SOURCE_SCOPE_REQUIRED/);
});
