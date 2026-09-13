import assert from 'node:assert/strict';
import test from 'node:test';

import { createFrontierConversationSeamV2 } from '../src/lib/subscriptionV1/freeGptV2/providerSeams.js';

function packet(preferredName) {
  return {
    packet_hash: 'a'.repeat(64),
    session_id: 'session_f09_offline_contract',
    provider_understanding: {
      coaching_session: {
        current_phase: 'STARTED',
        preferred_conversational_name: preferredName,
      },
    },
  };
}

async function coach({ output, suppliedPacket = packet('Jordan'), mutation_performed = false }) {
  let calls = 0;
  const seam = createFrontierConversationSeamV2({
    enabled: true,
    web_search_enabled: false,
    now: () => '2026-09-11T23:00:00.000Z',
    transport: async () => {
      calls += 1;
      return { output, usage: {}, latency_ms: 0 };
    },
  });
  const result = await seam.coach({
    packet: suppliedPacket,
    customer_message: 'What should I think about next?',
    mutation_performed,
  });
  return { result, calls };
}

test('F09 accepts an ordinary useful opening answer without forcing a name repetition', async () => {
  const customerMessage = 'Let us first understand what changed before choosing the next move.';
  const { result, calls } = await coach({ output: { customer_message: customerMessage } });
  assert.equal(calls, 1);
  assert.equal(result.ok, true, result.code);
  assert.equal(result.code, 'FREE_GPT_V2_CONVERSATION_ACCEPTED');
  assert.equal(result.customer_message, customerMessage);
  assert.equal(result.mutation_performed, false);
});

test('F09 still requires valid governed preferred-name context at a started opening', async () => {
  for (const preferredName of [undefined, null, '', '   ']) {
    const { result } = await coach({
      suppliedPacket: packet(preferredName),
      output: { customer_message: 'Jordan, what changed?' },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SUBSCRIPTION_S1_1_PREFERRED_NAME_OPENING_REQUIRED');
  }
});

test('F09 preserves schema, credential-leak, and false-mutation-claim rejection', async () => {
  const invalid = await coach({ output: { customer_message: 'Useful answer.', extra: true } });
  assert.equal(invalid.result.code, 'FREE_GPT_V2_CONVERSATION_OUTPUT_INVALID');

  const secret = await coach({ output: { customer_message: 'OPENAI_API_KEY must not appear.' } });
  assert.equal(secret.result.code, 'FREE_GPT_V2_CATASTROPHIC_INTEGRITY_REJECTED');
  assert.ok(secret.result.errors.includes('SECRET_OR_CREDENTIAL_LEAKAGE'));

  const falseClaim = await coach({ output: { customer_message: 'I have updated your plan.' } });
  assert.equal(falseClaim.result.code, 'FREE_GPT_V2_CATASTROPHIC_INTEGRITY_REJECTED');
  assert.ok(falseClaim.result.errors.includes('FALSE_DURABLE_MUTATION_CLAIM'));
});
