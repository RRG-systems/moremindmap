import assert from 'node:assert/strict';
import test from 'node:test';

import { adaptCanonicalProfileToNewBosRawEvidence } from '../api/engine/newBosProductionReadinessV1/canonicalAdapter.js';
import { classifyNewBosCompatibility } from '../api/engine/newBosProductionReadinessV1/compatibility.js';

const PROFILE_ID = 'MM-20260804-QCMR6KP4';

function envelope(overrides = {}) {
  const vectorScores = {
    vector: 0.17,
    signal: 0.82,
    fidelity: 0.69,
    velocity: -0.1,
    leverage: 0.33,
    flex: 0.6,
    framework: 0.25,
    horizon: 0.33,
    ...overrides,
  };
  return {
    canonical_profile_json: {
      profile_id: PROFILE_ID,
      assessment_version: 'mini-v2',
      vector_scores: vectorScores,
      intake_answers: Array.from({ length: 24 }, (_, index) => ({
        question_id: `q${index + 1}`,
        question_text: `Governed question ${index + 1}`,
        answer_text: `Governed answer ${index + 1}`,
      })),
    },
  };
}

test('small negative signed-topology coordinates project to the governed New BOS floor', () => {
  const raw = adaptCanonicalProfileToNewBosRawEvidence({ envelope: envelope(), expectedProfileId: PROFILE_ID });
  assert.equal(raw.scores.tempo, 0);
  assert.equal(raw.scores.relational_awareness, 82);
  assert.equal(raw.scores.precision, 69);
  assert.equal(classifyNewBosCompatibility(raw).class, 'A');
});

test('valid 0-1 and 0-100 coordinate forms remain exact', () => {
  const normalized = adaptCanonicalProfileToNewBosRawEvidence({ envelope: envelope({ velocity: 0.41 }), expectedProfileId: PROFILE_ID });
  assert.equal(normalized.scores.tempo, 41);
  const customerScale = adaptCanonicalProfileToNewBosRawEvidence({ envelope: envelope({ velocity: 41 }), expectedProfileId: PROFILE_ID });
  assert.equal(customerScale.scores.tempo, 41);
});

test('coordinates outside governed signed and customer-scale bounds fail closed', () => {
  assert.throws(
    () => adaptCanonicalProfileToNewBosRawEvidence({ envelope: envelope({ velocity: -1.01 }), expectedProfileId: PROFILE_ID }),
    /new_bos_canonical_score_out_of_range:velocity/u,
  );
  assert.throws(
    () => adaptCanonicalProfileToNewBosRawEvidence({ envelope: envelope({ velocity: 101 }), expectedProfileId: PROFILE_ID }),
    /new_bos_canonical_score_out_of_range:velocity/u,
  );
});
