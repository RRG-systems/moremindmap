import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionCloseSeamV1 } from '../src/lib/subscriptionV1/freeGptV2/providerSeams.js';
import { validateCoachingEpisodeTransition } from '../src/lib/subscriptionV1/freeGptV2/sessionEpisode.js';
import { SESSION_LEARNING_FIELDS } from '../src/lib/subscriptionV1/sessionLearning.js';

const learning = Object.fromEntries(SESSION_LEARNING_FIELDS.map((field) => [field, 'This remains discussion. No new task was agreed.']));
const packet = { packet_hash: 'a'.repeat(64), session_id: 'synthetic-close', provider_understanding: { coaching_session: { current_phase: 'ENDING', preferred_conversational_name: 'Jordan' } } };
async function close({ intent, recapConfirmed, mode = 'REVIEW_RESPONSE', message = 'Please correct that; I have not agreed to finish.' } = {}) {
  const calls = [];
  const seam = createSessionCloseSeamV1({ enabled: true, transport: async (request, options) => {
    calls.push({ request, options });
    return { output: { customer_message: 'Jordan, we can keep that question open.', session_learning: learning, ...(intent === undefined ? {} : { close_intent: intent }), ...(recapConfirmed === undefined ? {} : { recap_confirmed: recapConfirmed }) } };
  } });
  return { result: await seam.close({ packet, mode, alignment_message: message, prior_session_learning: learning }), calls };
}

test('correction-only and legacy ambiguous closing output remain reviewable without saving or asserting agreement', async () => {
  for (const intent of [undefined, 'REVIEW']) {
    const { result, calls } = await close({ intent });
    assert.equal(result.ok, true);
    assert.equal(result.mutual_close.human_alignment_required, true);
    assert.equal(result.mutual_close.alignment_established, false);
    assert.equal(result.session_learning.status, 'DRAFT_AWAITING_ALIGNMENT');
    assert.equal(result.session_learning.persisted, false);
    assert.equal(result.mutation_performed, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.stage, 'SESSION_CLOSE');
    assert.equal(JSON.parse(calls[0].request.input[1].content).mutual_close.human_alignment_response, 'Please correct that; I have not agreed to finish.');
  }
});

test('a request to continue releases the draft and allows the same episode to become active', async () => {
  const { result, calls } = await close({ intent: 'CONTINUE', message: 'Can we work through the obstacle before ending?' });
  assert.equal(result.ok, true);
  assert.equal(result.mutual_close.continue_coaching, true);
  assert.equal(result.mutual_close.alignment_established, false);
  assert.equal(result.session_learning, null);
  assert.equal(calls.length, 1, 'No extra classifier call.');
  assert.equal(validateCoachingEpisodeTransition('ENDING', 'ACTIVE').valid, true);
  assert.equal(validateCoachingEpisodeTransition('ENDING', 'ENDING').valid, true);
});

test('clear finishing intent closes only the session and never grants canonical mutation authority', async () => {
  // This customer confirms the recap itself, not only the decision to finish.
  const { result } = await close({ intent: 'FINISH', recapConfirmed: true, message: 'Yes, that is accurate. Please finish this session.' });
  assert.equal(result.mutual_close.alignment_established, true);
  assert.equal(result.session_learning.status, 'NOTES_READY');
  assert.equal(result.session_learning.canonical_mutation_performed, false);
  assert.equal(result.session_learning.personal_rsl_mutation_performed, false);
  assert.equal(result.session_learning.what_was_decided, learning.what_was_decided);
});

test('an urgent stop is distinguished from agreeing with the recap', async () => {
  const { result } = await close({ intent: 'LEAVE', message: 'I need to go; we have not resolved this.' });
  assert.equal(result.ok, true);
  assert.equal(result.mutual_close.close_intent, 'LEAVE');
  assert.equal(result.mutual_close.human_alignment_required, false);
  assert.equal(result.mutual_close.alignment_established, false);
});

test('the initial reflection cannot self-authorize finalization even if the generated intent says finish', async () => {
  const { result } = await close({ intent: 'FINISH', mode: 'REQUEST_ALIGNMENT', message: null });
  assert.equal(result.mutual_close.close_intent, 'REVIEW');
  assert.equal(result.mutual_close.alignment_established, false);
});

test('the explicit finish control can finish without a ceremonial extra text reply', async () => {
  const { result, calls } = await close({ intent: 'REVIEW', mode: 'FINALIZE', message: null });
  assert.equal(result.ok, true);
  assert.equal(result.mutual_close.close_intent, 'FINISH');
  assert.equal(JSON.parse(calls[0].request.input[1].content).mutual_close.explicit_finish_selected, true);
});

test('unknown close intents fail closed rather than guessing permission', async () => {
  const { result } = await close({ intent: 'PROBABLY_DONE' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'SUBSCRIPTION_S1_1_SESSION_CLOSE_OUTPUT_INVALID');
});
