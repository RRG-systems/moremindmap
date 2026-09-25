import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoach, FLAGSHIP_INSTRUCTIONS, flagshipCoachingInput,
  ATHLETE_CONSULTING_FLAGSHIP_COACH_POLICY } from '../server/athleteConsultingV2/coach.js';

const bundle = {
  person: { mm: 'synthetic-nia-test', slug: 'nia', synthetic: true },
  bos: { reading: 'Fictional baseline BOS', evidence: [], artifact_sha256: 'b'.repeat(64) },
  bos_source: { answers: { a: 'fictional' } },
  apa: { artifact_sha256: 'a'.repeat(64), report: { domains: ['baseline only'] } },
};
const output = { reply: 'What feels different now?', plan: null, plan_change: 'none',
  retire_draft: false, learning: [], recap: '' };
const response = { model: 'gpt-5.6-sol', status: 'completed',
  output_text: JSON.stringify(output), usage: { input_tokens: 1, output_tokens: 1 } };
const state = { currentApa: { version: 2, artifact: { artifact_sha256: 'c'.repeat(64),
  report: { domains: ['old claim'] } } }, apaNeedsReview: true,
plan: null, draft: null, learning: [], feedback: [], sessions: [],
messages: [{ id: 'm1', role: 'user', speaker: 'athlete', text: 'My earlier fact was wrong.' }],
view: 'sport', viewContext: { section: 'mindset' }, speaker: 'athlete', status: 'active',
governedMemory: { items: [{ event_type: 'CORRECTION', payload: { text: 'Corrected fact.' } }] } };

test('flagged coach withholds stale APA claims but retains corrected memory and pinned knowledge', async () => {
  const events = [];
  let retrievals = 0, calls = 0;
  const coach = createCoach({ env: { ATHLETE_CONSULTING_FLAGSHIP_ENABLED: 'true' },
    evidenceSink: async (event) => { events.push(event); },
    knowledgeRetriever: async ({ task, view, text }) => {
      retrievals++;
      assert.deepEqual({ task, view, text }, { task: 'CHAT', view: 'sport', text: 'My earlier fact was wrong.' });
      return { context: { source: 'pinned BOS Bible excerpt' }, receipt: { pinned: true } };
    },
    transport: async (request) => {
      calls++;
      assert.equal(request.instructions, FLAGSHIP_INSTRUCTIONS);
      const input = JSON.parse(request.input);
      assert.equal(input.full_youth_apa, null);
      assert.equal(input.current_apa_status, 'HISTORICAL_AWAITING_ATHLETE_REVIEW');
      assert.deepEqual(input.governed_personal_memory, state.governedMemory);
      assert.deepEqual(input.governed_knowledge, { source: 'pinned BOS Bible excerpt' });
      assert.deepEqual(input.visible_view_context, { section: 'mindset' });
      assert.ok(!request.input.includes('old claim'));
      return response;
    } });
  assert.deepEqual(await coach(bundle, state, 'CHAT'), output);
  assert.equal(retrievals, 1);
  assert.equal(calls, 1);
  assert.deepEqual(events.map((event) => event.kind), ['request', 'response', 'receipt']);
  assert.deepEqual(events[0].record.knowledge_receipt, { pinned: true });
  assert.equal(ATHLETE_CONSULTING_FLAGSHIP_COACH_POLICY.frozen_request_delta.length, 2);
});

test('flagged input uses current reviewed APA only while no correction requires refresh', () => {
  const input = flagshipCoachingInput(bundle, { ...state, apaNeedsReview: false }, 'CHAT');
  assert.equal(input.full_youth_apa.artifact_sha256, 'c'.repeat(64));
  assert.equal(input.current_apa_status, 'CURRENT_ATHLETE_REVIEWED');
});

test('knowledge retrieval failure is privately recorded and cannot call coach provider', async () => {
  const events = [];
  let calls = 0;
  const coach = createCoach({ env: { ATHLETE_CONSULTING_FLAGSHIP_ENABLED: 'true' },
    evidenceSink: async (event) => { events.push(event); },
    knowledgeRetriever: async () => { throw new Error('private failure detail'); },
    transport: async () => { calls++; return response; } });
  await assert.rejects(coach(bundle, state, 'CHAT'), { message: 'COACH_REQUEST_FAILED' });
  assert.equal(calls, 0);
  assert.deepEqual(events.map((event) => event.kind), ['failure']);
  assert.equal(events[0].stage, 'knowledge_retrieval');
  assert.doesNotMatch(JSON.stringify(events), /private failure detail/u);
});
