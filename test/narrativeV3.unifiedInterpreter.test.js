import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildUnifiedInterpretation } from '../src/lib/narrativeV3/unifiedInterpreter.js';
import { buildCustomerBOSViewModel } from '../src/lib/reports/buildCustomerBOSViewModel.js';

const EMOTION_KEYWORDS = {
  stuck: ['stuck', 'stall', 'freeze', 'paralysis', 'paralyze'],
  anxious: ['anxiety', 'anxious', 'worried', 'worry', 'concern', 'nervous'],
  fearful: ['fear', 'afraid', 'scared', 'terror'],
  lost: ['lost', 'confused', 'unclear', "don't know", 'unsure'],
  avoidant: ['avoid', 'avoidance', 'put off', 'delay', 'escape'],
  frustrated: ['frustrated', 'frustration', 'upset', 'angry', 'mad'],
  hopeful: ['excited', 'enthusiastic', 'opportunity', 'possibilities'],
  confident: ['confident', 'confident', 'assured', 'sure'],
};

const TARGET_SHAPED_ANSWERS = {
  q2: {
    text: 'Faith, family, service, disciplined routines, and useful work shape the next chapter.',
  },
  q14: {
    text: 'A partnership changed direction. I reviewed the facts, spoke directly, and selected a different path.',
  },
  q17: {
    text: 'Direct and focused. I create quiet space, organize the work, and move through the next task.',
  },
  q20: {
    text: 'I gathered the available facts, contacted the decision makers, and chose a practical path.',
  },
  q22: {
    text: 'I lead through action and clear expectations. Delegation and direct conversations require deliberate attention.',
  },
  q24: {
    text: 'I pause before speaking, value initiative, and address issues after reviewing the facts.',
  },
  q25: {
    text: 'I ask questions and compare what each person heard.',
  },
  q26: {
    text: 'I take an active role and bring structure when the pace varies.',
  },
  q27: {
    text: 'I am building useful work that serves people and leaves a meaningful legacy.',
  },
  q28: {
    text: 'Routine, reading, journaling, and next-day planning keep the work organized.',
  },
};

const RANKED_DIMENSIONS = [
  { dimension: 'vector', score: 0.82, rank: 1, confidence: 0.9, evidence_count: 4 },
  { dimension: 'signal', score: 0.71, rank: 2, confidence: 0.86, evidence_count: 4 },
  { dimension: 'velocity', score: 0.64, rank: 3, confidence: 0.84, evidence_count: 3 },
  { dimension: 'flex', score: 0.57, rank: 4, confidence: 0.82, evidence_count: 3 },
  { dimension: 'fidelity', score: 0.49, rank: 5, confidence: 0.8, evidence_count: 3 },
  { dimension: 'horizon', score: 0.43, rank: 6, confidence: 0.78, evidence_count: 2 },
  { dimension: 'leverage', score: 0.36, rank: 7, confidence: 0.76, evidence_count: 2 },
  { dimension: 'framework', score: 0.29, rank: 8, confidence: 0.74, evidence_count: 2 },
];

function buildCanonical(intakeAnswers) {
  const vectorScores = Object.fromEntries(
    RANKED_DIMENSIONS.map(({ dimension, score }) => [dimension, score]),
  );

  const canonicalProfile = {
    profile_id: 'mm-20260730-guard001',
    intake_answers: intakeAnswers,
    vector_scores: vectorScores,
    ranked_dimensions: RANKED_DIMENSIONS,
    top_systems: {
      primary_driver: {
        dimension: 'vector',
        score: 0.82,
        description: 'Sets direction and moves decisions forward.',
        operating_manifestation: 'Creates a clear path and establishes the next decision.',
        pressure_manifestation: 'Increases direction and pace under load.',
      },
      secondary_stabilizer: {
        dimension: 'signal',
        score: 0.71,
        description: 'Reads people and context before finalizing a path.',
        operating_manifestation: 'Checks how decisions land with the people involved.',
        pressure_manifestation: 'Looks for additional human context under load.',
      },
      opposing_pattern_1: {
        dimension: 'framework',
        score: 0.29,
        description: 'Uses only the structure needed for the current decision.',
        operating_manifestation: 'Prefers practical rules over heavy process.',
      },
      opposing_pattern_2: {
        dimension: 'leverage',
        score: 0.36,
        description: 'Builds systems after the operating pattern becomes clear.',
        operating_manifestation: 'Uses direct effort before formalizing repeatable systems.',
      },
      dimension_tradeoffs: [
        {
          dimensions: ['vector', 'signal'],
          tradeoff: 'Direction must leave enough room for human context.',
          cost: 'Fast clarity can outpace shared interpretation.',
        },
      ],
    },
  };

  return {
    profile_id: canonicalProfile.profile_id,
    person_name: 'Sanitized Regression Subject',
    company_name: 'Sanitized Example',
    created_at: '2026-07-30T00:00:00.000Z',
    intake_answers: intakeAnswers,
    canonical_profile_json: canonicalProfile,
  };
}

function buildUnified(intakeAnswers) {
  return buildUnifiedInterpretation(buildCanonical(intakeAnswers));
}

function countRecognizedEmotionBuckets(intakeAnswers) {
  const writtenText = Object.values(intakeAnswers)
    .map((answer) => answer?.text || '')
    .join(' ')
    .toLowerCase();

  return Object.values(EMOTION_KEYWORDS)
    .filter((keywords) => keywords.some((keyword) => writtenText.includes(keyword)))
    .length;
}

test('no recognized emotion keywords returns deterministic neutral low state', () => {
  let unified;

  assert.doesNotThrow(() => {
    unified = buildUnified({
      q2: {
        text: 'Faith, family, service, disciplined routines, and useful work shape the next chapter.',
      },
    });
  });

  assert.equal(unified.emotional_state.primaryEmotion, 'neutral');
  assert.equal(unified.emotional_state.emotionalIntensity, 'low');
});

test('empty written-answer set returns deterministic neutral low state', () => {
  let unified;

  assert.doesNotThrow(() => {
    unified = buildUnified({});
  });

  assert.equal(unified.emotional_state.primaryEmotion, 'neutral');
  assert.equal(unified.emotional_state.emotionalIntensity, 'low');
});

test('one recognized emotion bucket selects that bucket', () => {
  const unified = buildUnified({
    q2: { text: 'I feel afraid when the decision arrives without context.' },
  });

  assert.equal(unified.emotional_state.primaryEmotion, 'fearful');
  assert.equal(unified.emotional_state.emotionalIntensity, 'low');
});

test('multiple emotion buckets preserve dominant-count selection', () => {
  const unified = buildUnified({
    q2: {
      text: 'I feel anxious, worried, and nervous about the transition, and also frustrated by the timing.',
    },
  });

  assert.equal(unified.emotional_state.primaryEmotion, 'anxious');
  assert.equal(unified.emotional_state.emotionalIntensity, 'moderate');
});

test('tied emotion buckets preserve deterministic later-key selection', () => {
  const answers = {
    q2: { text: 'I feel stuck and anxious about the decision.' },
  };

  const first = buildUnified(answers);
  const second = buildUnified(answers);

  assert.equal(first.emotional_state.primaryEmotion, 'anxious');
  assert.equal(second.emotional_state.primaryEmotion, 'anxious');
});

test('target-shaped written answers with zero emotion buckets complete Narrative V3', async () => {
  assert.equal(countRecognizedEmotionBuckets(TARGET_SHAPED_ANSWERS), 0);

  const narrative = await buildNarrativeV3(
    buildCanonical(TARGET_SHAPED_ANSWERS),
    false,
    null,
    true,
  );

  assert.equal(narrative.render_source, 'fallback_local');
  for (const section of [
    'profileDNA',
    'communicationStyle',
    'hiddenContradictions',
    'strategicCeiling',
    'coachingLeverage',
    'teamExperience',
    'facilitatorNotes',
    'fiveFutures',
    'recommendedNextStep',
    'executiveSummary',
  ]) {
    assert.ok(narrative[section], `expected Narrative V3 section: ${section}`);
  }
});

test('target-shaped written answers complete the customer BOS view-model path', async () => {
  const canonical = buildCanonical(TARGET_SHAPED_ANSWERS);
  const narrative = await buildNarrativeV3(canonical, false, null, true);
  const customerViewModel = buildCustomerBOSViewModel({
    canonical,
    narrative,
    profileId: canonical.profile_id,
    personName: canonical.person_name,
    company: canonical.company_name,
    ranked: canonical.canonical_profile_json.ranked_dimensions,
  });

  assert.deepEqual(
    customerViewModel.tabs.map(({ id }) => id),
    [
      'overview',
      'scores-reveal',
      'visual-dna',
      'five-futures',
      'one-move',
      'team-fit',
      'how-to-use',
      'advanced-source',
    ],
  );
  assert.deepEqual(
    customerViewModel.overviewSections.map(({ id }) => id),
    [
      'executive-summary',
      'core-operating-pattern',
      'key-advantage',
      'main-scaling-risk',
      'main-constraint',
    ],
  );
  assert.ok(customerViewModel.customerSummary.executive);
  assert.ok(customerViewModel.oneMove.content);
  assert.doesNotMatch(
    JSON.stringify(customerViewModel),
    /Failed to render profile narrative/,
  );
});
