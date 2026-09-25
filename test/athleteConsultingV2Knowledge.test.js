import test from 'node:test';
import assert from 'node:assert/strict';
import { BOS_LIBRARY, LIBRARY_MANIFEST_SHA256 } from '../src/lib/newBosPersonalityDnaV1/libraryRegistry.js';
import { retrieveAthleteKnowledge, selectAthleteKnowledge } from '../server/athleteConsultingV2/knowledge.js';
import { createCoach } from '../server/athleteConsultingV2/coach.js';
import { bundles } from '../server/athleteConsultingV2/bundles.js';

test('athlete knowledge selects only bounded applicable BOS reasoning sources', () => {
  assert.deepEqual(selectAthleteKnowledge({ task: 'OPENING', view: 'home' }), [14, 15]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'sport', text: 'What future path and move?' }), [14, 12, 13]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'sport', text: 'Explain my Five Futures and One Move' }), [14, 12, 13]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'plan', text: 'one move' }), [14, 13]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'home', text: 'Explain the eight vectors in my BOS' }), [14, 1, 15]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'home', text: 'Which higher-order behavioral attributes apply?' }), [14, 3]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'home', text: 'Discuss causal behavioral dynamics without certainty' }), [14, 4]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'sport', text: 'How do I recover from setbacks?' }), [14, 5]);
  assert.deepEqual(selectAthleteKnowledge({ task: 'CHAT', view: 'home', text: 'How do I handle conflict?' }), [14, 5]);
});

test('retrieval passes exact pinned hashes and records only actual bounded source coverage', async () => {
  let selection;
  const retriever = { async retrieve(value) { selection = value; return { manifest_sha256: value.manifest_sha256,
    authorities: value.authorities.map((entry) => ({ ...entry, bounded_block: 'Trusted bounded source text' })) }; } };
  const result = await retrieveAthleteKnowledge({ task: 'OPENING', view: 'home', retriever });
  assert.equal(selection.manifest_sha256, LIBRARY_MANIFEST_SHA256);
  assert.deepEqual(selection.authorities, BOS_LIBRARY.filter((entry) => [14, 15].includes(entry.id)));
  assert.deepEqual(result.context.blocks.map((entry) => entry.id), [14, 15]);
  assert.equal(result.receipt.athlete_sport_coaching_library, 'NOT_AVAILABLE_AS_APPROVED_PINNED_SOURCE');
  assert.equal(result.context.blocks[0].use, 'GOVERNED_REASONING_REFERENCE_NOT_ATHLETE_FACT');
});

test('mismatched source hash fails closed', async () => {
  const retriever = { async retrieve(value) { return { manifest_sha256: value.manifest_sha256,
    authorities: value.authorities.map((entry) => ({ ...entry, sha256: '0'.repeat(64), bounded_block: 'wrong' })) }; } };
  await assert.rejects(retrieveAthleteKnowledge({ task: 'OPENING', view: 'home', retriever }), /ATHLETE_KNOWLEDGE_INTEGRITY/);
});

test('actual pinned retrieval includes the epistemic and whole-person doctrine sections', async () => {
  const result = await retrieveAthleteKnowledge({ task: 'OPENING', view: 'home' });
  const evidence = result.context.blocks.find((item) => item.id === 14);
  const synthesis = result.context.blocks.find((item) => item.id === 15);
  assert.match(evidence.excerpt, /Contradiction Protocol/u);
  assert.match(synthesis.excerpt, /Synthesis Algorithm/u);
  assert.equal(result.receipt.sources.length, 2);
});

test('each advertised foundational source can be retrieved at its pinned hash on an applicable request', async () => {
  for (const [id, text] of [
    [1, 'Explain the eight vectors in my BOS'],
    [3, 'Which higher-order behavioral attributes apply?'],
    [4, 'Discuss causal behavioral dynamics without certainty'],
  ]) {
    const result = await retrieveAthleteKnowledge({ task: 'CHAT', view: 'home', text });
    const source = BOS_LIBRARY.find((entry) => entry.id === id);
    assert.ok(result.context.blocks.some((block) => block.id === id && block.sha256 === source.sha256));
    assert.ok(result.receipt.sources.some((receipt) => receipt.id === id && receipt.source_sha256 === source.sha256));
    assert.ok(result.context.blocks.length <= 3);
  }
});

test('failed knowledge retrieval records a private failure and never calls the model', async () => {
  const evidence = [];
  let providerCalls = 0;
  const coach = createCoach({ env: { ATHLETE_CONSULTING_FLAGSHIP_ENABLED: 'true' },
    evidenceSink: async (event) => { evidence.push(event); },
    knowledgeRetriever: async () => { throw new Error('PINNED_SOURCE_MISSING'); },
    transport: async () => { providerCalls++; throw new Error('unexpected'); } });
  await assert.rejects(coach(bundles.nia, { messages: [], view: 'home' }, 'OPENING'), /COACH_REQUEST_FAILED/u);
  assert.equal(providerCalls, 0);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].kind, 'failure');
  assert.equal(evidence[0].stage, 'knowledge_retrieval');
  assert.equal(evidence[0].request_sha256, null);
});
