import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildUnifiedInterpretation } from '../src/lib/narrativeV3/unifiedInterpreter.js';

const canonical = {
  profile_id: 'mm-20990101-neutral01',
  person_name: 'Neutral Signal Fixture',
  intake_answers: {
    q2: {
      text: 'Faith, family, service, disciplined routines, and useful work shape the next chapter.',
    },
  },
  canonical_profile_json: {
    vector_scores: { vector: 0.8, signal: 0.7 },
    ranked_dimensions: [
      { dimension: 'vector', score: 0.8, rank: 1, evidence_count: 2 },
      { dimension: 'signal', score: 0.7, rank: 2, evidence_count: 2 },
    ],
    top_systems: {
      primary_driver: { dimension: 'vector', score: 0.8 },
      secondary_stabilizer: { dimension: 'signal', score: 0.7 },
    },
  },
};

test('zero recognized emotion buckets produce a neutral low interpretation', () => {
  const unified = buildUnifiedInterpretation(canonical);

  assert.equal(unified.emotional_state.primaryEmotion, 'neutral');
  assert.equal(unified.emotional_state.emotionalIntensity, 'low');
});

test('zero recognized emotion buckets complete Narrative V3 generation', async () => {
  const narrative = await buildNarrativeV3(canonical, false, null, true);

  assert.equal(narrative.render_source, 'fallback_local');
  assert.ok(narrative.executiveSummary);
  assert.ok(narrative.recommendedNextStep);
});
