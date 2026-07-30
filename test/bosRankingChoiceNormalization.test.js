import test from 'node:test';
import assert from 'node:assert/strict';

import { BuildProfileInput } from '../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { normalizeAssessmentAnswers } from '../api/engine/normalizeAssessmentAnswers.js';
import { QUESTION_MAP } from '../api/engine/questionMap.js';

const TARGET_SELECTIONS = {
  q6: ['3', '2', '4', '1'],
  q12: ['3', '2', '4', '1'],
  q13: ['D', 'C'],
  q18: ['2', '4', '3', '1'],
};

const WRITTEN_ANSWERS = {
  q2: 'Meaningful work, service, relationships, and sustainable progress matter most.',
  q14: 'A plan changed. I reviewed the facts, spoke with the people involved, and selected a practical next step.',
  q17: 'Under pressure I become direct and focused. I organize the work and keep moving.',
  q20: 'I gathered the available facts, named the decision, and chose a reversible path.',
  q22: 'I lead through clear expectations and direct action while making room for questions.',
  q24: 'When momentum slows, I review ownership, sequence, and the next practical decision.',
  q25: 'I ask what the other person heard and clarify the intent.',
  q26: 'I naturally set direction and help the group organize the next move.',
  q27: 'I am building useful work that serves people and remains sustainable.',
  q28: 'A weekly review, written priorities, and clear ownership keep the work organized.',
};

function buildCompleteUiAnswers() {
  return {
    1: 'A',
    2: WRITTEN_ANSWERS.q2,
    3: 'B',
    4: 'A',
    5: 'E',
    6: [...TARGET_SELECTIONS.q6],
    7: 'D',
    8: 'B',
    9: 'A',
    10: 'C',
    11: 'B',
    12: [...TARGET_SELECTIONS.q12],
    13: [...TARGET_SELECTIONS.q13],
    14: WRITTEN_ANSWERS.q14,
    15: 'C',
    16: 'A',
    17: WRITTEN_ANSWERS.q17,
    18: [...TARGET_SELECTIONS.q18],
    19: 'B',
    20: WRITTEN_ANSWERS.q20,
    21: 'A',
    22: WRITTEN_ANSWERS.q22,
    23: 'D',
    24: WRITTEN_ANSWERS.q24,
    25: WRITTEN_ANSWERS.q25,
    26: WRITTEN_ANSWERS.q26,
    27: WRITTEN_ANSWERS.q27,
    28: WRITTEN_ANSWERS.q28,
  };
}

function captureWarnings(callback) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(' '));

  try {
    return { result: callback(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function buildProfile(answers) {
  return new BuildProfileInput().build({ answers });
}

test('intake normalization uses question metadata and preserves submitted order', () => {
  const normalized = normalizeAssessmentAnswers(buildCompleteUiAnswers());

  assert.deepEqual(normalized.q1, { choice: 'A' });
  assert.deepEqual(normalized.q2, { text: WRITTEN_ANSWERS.q2 });
  assert.deepEqual(normalized.q6, { choice: '3,2,4,1' });
  assert.deepEqual(normalized.q12, { choice: '3,2,4,1' });
  assert.deepEqual(normalized.q13, { choice: 'D,C' });
  assert.deepEqual(normalized.q18, { choice: '2,4,3,1' });
});

test('ordinary corrected BOS answer shapes remain unchanged', () => {
  const ordinary = {
    q1: { choice: 'A' },
    q2: { text: WRITTEN_ANSWERS.q2 },
  };

  assert.deepEqual(normalizeAssessmentAnswers(ordinary), ordinary);
});

test('legacy and corrected ranking shapes are accepted without changing order', () => {
  for (const answer of [
    { text: '3,2,4,1' },
    { choice: '3,2,4,1' },
  ]) {
    const profile = buildProfile({
      ...normalizeAssessmentAnswers(buildCompleteUiAnswers()),
      q6: answer,
    });

    assert.equal(profile.raw_answers.q6.answer_choice, '3,2,4,1');
    assert.deepEqual(profile.raw_answers.q6.answer_choices, ['3', '2', '4', '1']);
    assert.deepEqual(
      profile.raw_answers.q6.normalized_dimensions,
      { fidelity: 1.5, horizon: 0.5, framework: 0.5 },
    );
    assert.equal(
      profile.raw_answers.q6.answer_text,
      'Understanding the situation fully before acting > Keeping people aligned and stable > Maintaining control of how things unfold > Getting to a clear result quickly',
    );
  }
});

test('legacy and corrected choose-two shapes preserve both submitted selections', () => {
  for (const answer of [
    { text: 'D,C' },
    { choice: 'D,C' },
  ]) {
    const profile = buildProfile({
      ...normalizeAssessmentAnswers(buildCompleteUiAnswers()),
      q13: answer,
    });

    assert.equal(profile.raw_answers.q13.question_type, 'choose_two');
    assert.equal(profile.raw_answers.q13.answer_choice, 'D,C');
    assert.deepEqual(profile.raw_answers.q13.answer_choices, ['D', 'C']);
    assert.match(profile.raw_answers.q13.answer_text, /Focus on building one or two strong connections/);
    assert.match(profile.raw_answers.q13.answer_text, /Observe how people interact before engaging/);
    assert.deepEqual(profile.raw_answers.q13.normalized_dimensions, {
      signal: 1.3,
      leverage: 0.5,
      flex: 0.5,
      framework: 0.5,
      fidelity: 0.5,
    });
  }
});

test('missing or invalid ranking responses retain existing guarded degradation', () => {
  for (const answer of [
    { text: '' },
    { choice: '3,2,4' },
    { choice: '3,2,2,1' },
    { choice: '3,2,4,9' },
  ]) {
    const { result, warnings } = captureWarnings(() => buildProfile({
      ...normalizeAssessmentAnswers(buildCompleteUiAnswers()),
      q6: answer,
    }));

    assert.equal(result.raw_answers.q6, undefined);
    assert.ok(warnings.some((warning) =>
      warning.includes('RANKING q6') && (
        warning.includes('missing choice')
        || warning.includes('invalid choice')
      )
    ));
  }
});

test('explicit choice has unambiguous precedence and is ingested once', () => {
  const normalized = normalizeAssessmentAnswers({
    q6: {
      choice: '3,2,4,1',
      text: '1,2,3,4',
    },
  });
  const profile = buildProfile({
    ...normalizeAssessmentAnswers(buildCompleteUiAnswers()),
    q6: normalized.q6,
  });

  assert.deepEqual(normalized.q6, {
    choice: '3,2,4,1',
    text: '1,2,3,4',
  });
  assert.equal(profile.raw_answers.q6.answer_choice, '3,2,4,1');
  assert.equal(Object.keys(profile.raw_answers).filter((key) => key === 'q6').length, 1);
  for (const dimension of Object.values(profile.dimension_scores)) {
    assert.ok(
      dimension.contributing_answers.filter((questionId) => questionId === 6).length <= 1,
    );
  }
});

test('target-shaped Q6/Q12/Q13/Q18 fixture reaches canonical analysis without guards or duplicates', async () => {
  const retainedAnswers = normalizeAssessmentAnswers(buildCompleteUiAnswers());
  const { result: profileInput, warnings } = captureWarnings(() =>
    buildProfile(retainedAnswers)
  );
  const canonical = await generateCanonicalProfile(profileInput, {
    profile_id: 'mm-20260730-sanitized',
  });

  assert.equal(QUESTION_MAP.set_1.v1.find(({ id }) => id === 13).type, 'choose_two');
  assert.equal(Object.keys(retainedAnswers).length, 28);
  assert.equal(Object.keys(profileInput.raw_answers).length, 28);
  assert.equal(Object.keys(canonical.intake_answers).length, 28);

  assert.equal(profileInput.raw_answers.q6.answer_choice, '3,2,4,1');
  assert.equal(profileInput.raw_answers.q12.answer_choice, '3,2,4,1');
  assert.equal(profileInput.raw_answers.q13.answer_choice, 'D,C');
  assert.equal(profileInput.raw_answers.q18.answer_choice, '2,4,3,1');

  assert.deepEqual(canonical.intake_answers.q6.answer_choices, TARGET_SELECTIONS.q6);
  assert.deepEqual(canonical.intake_answers.q12.answer_choices, TARGET_SELECTIONS.q12);
  assert.deepEqual(canonical.intake_answers.q13.answer_choices, TARGET_SELECTIONS.q13);
  assert.deepEqual(canonical.intake_answers.q18.answer_choices, TARGET_SELECTIONS.q18);

  assert.equal(new Set(Object.keys(profileInput.raw_answers)).size, 28);
  assert.equal(new Set(Object.keys(canonical.intake_answers)).size, 28);
  assert.equal(
    warnings.filter((warning) =>
      /q(?:6|12|13|18)\\b/.test(warning)
      && /missing choice|invalid choice/.test(warning)
    ).length,
    0,
  );
});
