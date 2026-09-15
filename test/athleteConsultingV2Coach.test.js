import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  SCHEMA, INSTRUCTIONS, coachingInput, createCoach, ATHLETE_CONSULTING_V2_COACH_POLICY,
} from '../server/athleteConsultingV2/coach.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const bundle = {
  person: { mm: 'synthetic-coach-adapter-test', name: 'Fictional Athlete' },
  bos: { reading: 'Fictional BOS understanding.', evidence: ['self report'], artifact_sha256: 'b'.repeat(64) },
  bos_source: { answers: { question: 'Fictional response' } },
  apa: { artifact_sha256: 'a'.repeat(64), overview: 'Fictional sport reality.',
    receipts: ['private'], receipt: 'private', audit: 'private', bos_sources: ['private'] },
};
const state = {
  plan: null, draft: null, learning: [],
  sessions: Array.from({ length: 8 }, (_, number) => ({ number })),
  messages: Array.from({ length: 55 }, (_, number) => ({ content: `Fictional message ${number}` })),
  view: 'home', speaker: 'athlete', status: 'active',
};
const output = () => ({ reply: 'What changed for you?', plan: null, plan_change: 'none', retire_draft: false, learning: [], recap: '' });
const response = (changes = {}) => ({
  id: 'offline-response-only', model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(output()),
  output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output()) }] }],
  usage: { input_tokens: 10, output_tokens: 10 }, ...changes,
});

test('schema, instructions, input function and imported mission match the frozen release bytes', async () => {
  // These digests were computed from the locked source/engine files, before adaptation.
  assert.equal(hash(JSON.stringify(SCHEMA)), 'fa318e7b7c3f1bedbb85698ff3f48707845850cd16754f5f0291c2ceb3730c37');
  assert.equal(hash(INSTRUCTIONS), 'b5dd647ebe4284f4c34c13a16fae02f99665cc644f5ff785c171bdd44fc00256');
  assert.equal(hash(coachingInput.toString()), '4adb7432300aa455cb79f2407d489784c711029bcd7ed55ed8632494dd0bd9d4');
  const mission = await readFile(new URL('../server/athleteConsultingV2/model2-mission.js', import.meta.url));
  assert.equal(hash(mission), '3c4b6d0236b82e118c871683c77f3ede64725cf7e9e542f8aa58b06cf06a09a2');
  const source = await readFile(new URL('../server/athleteConsultingV2/coach.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /node:(?:fs|child_process)|execFile|keychain|vercel.*decrypt|ATHLETE_USE_EXISTING_BOS_CONNECTION/u);
});

test('offline transport receives the exact frozen request, unmodifiable policy and full selected context', async () => {
  const events = [];
  let calls = 0;
  const coach = createCoach({
    env: {}, evidenceSink: async (event) => { events.push(event); },
    transport: async (request, options) => {
      calls += 1;
      assert.deepEqual(events.map((event) => event.kind), ['request']);
      assert.deepEqual(Object.keys(request), ['model', 'reasoning', 'store', 'max_output_tokens', 'instructions', 'input', 'text']);
      assert.equal(request.model, 'gpt-5.6-sol');
      assert.deepEqual(request.reasoning, { effort: 'xhigh' });
      assert.equal(request.store, false);
      assert.equal(request.max_output_tokens, 6500);
      assert.equal(request.instructions, INSTRUCTIONS);
      assert.deepEqual(request.text.format, { type: 'json_schema', name: 'athlete_coaching', strict: true, schema: SCHEMA });
      assert.equal(options.maxRetries, 0);
      assert.equal(options.timeout, 180000);
      assert.ok(options.signal instanceof AbortSignal);
      assert.throws(() => { request.reasoning.effort = 'low'; }, TypeError);
      const input = JSON.parse(request.input);
      assert.equal(input.task, 'CHAT');
      assert.deepEqual(input.athlete, bundle.person);
      assert.equal(input.full_youth_bos, bundle.bos.reading);
      assert.deepEqual(input.bos_evidence, bundle.bos.evidence);
      assert.deepEqual(input.bos_answers, bundle.bos_source.answers);
      assert.deepEqual(input.previous_sessions, state.sessions.slice(-6));
      assert.deepEqual(input.conversation, state.messages.slice(-50));
      for (const key of ['receipts', 'receipt', 'audit', 'bos_sources']) assert.equal(Object.hasOwn(input.full_youth_apa, key), false);
      assert.ok(Number.isFinite(Date.parse(input.now)));
      return response();
    },
  });
  assert.deepEqual(await coach(bundle, state, 'CHAT'), output());
  assert.equal(calls, 1);
  assert.deepEqual(events.map((event) => event.kind), ['request', 'response', 'receipt']);
  assert.equal(new Set(events.map((event) => event.id)).size, 1);
  assert.equal(events[0].record.request_sha256, hash(JSON.stringify(events[0].request)));
  assert.deepEqual(events[1].response, response());
  assert.equal(events[2].status, 'completed');
  assert.equal(ATHLETE_CONSULTING_V2_COACH_POLICY.max_retries, 0);
  assert.deepEqual(ATHLETE_CONSULTING_V2_COACH_POLICY.frozen_request_delta, []);
});

test('request and raw response persistence must finish before provider call or result delivery', async () => {
  let releaseRequest, releaseResponse;
  const requestGate = new Promise((resolve) => { releaseRequest = resolve; });
  const responseGate = new Promise((resolve) => { releaseResponse = resolve; });
  const events = [];
  let calls = 0, returned = false;
  const coach = createCoach({ env: {}, evidenceSink: async (event) => {
    events.push(event.kind);
    if (event.kind === 'request') await requestGate;
    if (event.kind === 'response') await responseGate;
  }, transport: async () => { calls += 1; return response(); } });
  const pending = coach(bundle, state, 'CHAT').then((value) => { returned = true; return value; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 0);
  releaseRequest();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(returned, false);
  assert.deepEqual(events, ['request', 'response']);
  releaseResponse();
  assert.deepEqual(await pending, output());
  assert.deepEqual(events, ['request', 'response', 'receipt']);
});

test('incomplete, invalid, invalid-plan and wrong-model first responses are preserved without retries', async (context) => {
  const cases = [
    ['incomplete', response({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), 'COACH_RESPONSE_INCOMPLETE'],
    ['missing output', response({ output_text: '' }), 'COACH_RESPONSE_INCOMPLETE'],
    ['invalid JSON', response({ output_text: '{invalid' }), 'COACH_RESPONSE_INVALID'],
    ['invalid schema', response({ output_text: JSON.stringify({ ...output(), learning: 'not-an-array' }) }), 'COACH_RESPONSE_INVALID'],
    ['blank reply', response({ output_text: JSON.stringify({ ...output(), reply: ' ' }) }), 'COACH_RESPONSE_INVALID'],
    ['invalid plan', response({ output_text: JSON.stringify({ ...output(), plan: { title: 'Plan', why: 'Reason', steps: [], review: 'Later' } }) }), 'COACH_PLAN_INVALID'],
    ['wrong model', response({ model: 'unapproved-model' }), 'COACH_RESPONSE_MODEL_MISMATCH'],
  ];
  for (const [name, raw, code] of cases) await context.test(name, async () => {
    const events = [];
    let calls = 0;
    const coach = createCoach({ env: {}, evidenceSink: async (event) => { events.push(event); },
      transport: async () => { calls += 1; return raw; } });
    await assert.rejects(coach(bundle, state, 'CHAT'), { message: code });
    assert.equal(calls, 1);
    assert.deepEqual(events.map((event) => event.kind), ['request', 'response', 'failure']);
    assert.deepEqual(events[1].response, raw);
    assert.equal(events[2].code, code);
    assert.equal(events[2].status, 'failed');
  });
});

test('provider errors have one attempt and a durable sanitized failure before rejection', async () => {
  const events = [];
  let calls = 0;
  const coach = createCoach({ env: {}, evidenceSink: async (event) => { events.push(event); }, transport: async () => {
    calls += 1;
    const error = new Error('Sensitive transport details must not be returned');
    error.status = 503;
    error.code = 'service_unavailable';
    throw error;
  } });
  await assert.rejects(coach(bundle, state, 'CLOSE'), { message: 'COACH_REQUEST_FAILED' });
  assert.equal(calls, 1);
  assert.deepEqual(events.map((event) => event.kind), ['request', 'failure']);
  assert.equal(events[1].http_status, 503);
  assert.equal(events[1].provider_code, 'service_unavailable');
  assert.doesNotMatch(JSON.stringify(events), /Sensitive transport details/u);
});

test('missing private sink and missing server key fail without any fallback', async () => {
  assert.throws(() => createCoach({ env: {} }), { message: 'COACH_PRIVATE_EVIDENCE_SINK_REQUIRED' });
  const events = [];
  const coach = createCoach({ env: {}, evidenceSink: async (event) => { events.push(event); } });
  await assert.rejects(coach(bundle, state, 'OPENING'), { message: 'COACH_CONNECTION_UNAVAILABLE' });
  assert.deepEqual(events.map((event) => event.kind), ['request', 'failure']);
});

test('failure at each evidence boundary fails closed, including after a successful model response', async (context) => {
  for (const failKind of ['request', 'response', 'receipt']) await context.test(failKind, async () => {
    const events = [];
    let calls = 0;
    const coach = createCoach({ env: {}, evidenceSink: async (event) => {
      events.push(event);
      if (event.kind === failKind) throw new Error('private storage unavailable');
    }, transport: async () => { calls += 1; return response(); } });
    await assert.rejects(coach(bundle, state, 'CHAT'), { message: 'COACH_EVIDENCE_UNAVAILABLE' });
    assert.equal(calls, failKind === 'request' ? 0 : 1);
    assert.equal(events.at(-1).kind, 'failure');
    assert.equal(events.at(-1).code, 'COACH_EVIDENCE_UNAVAILABLE');
  });
});
