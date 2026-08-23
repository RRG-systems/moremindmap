import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  BUSINESS_ASSESSMENT_QUESTION_KEYS,
  buildGovernedQuestionStates,
} from '../api/engine/businessAssessment/questionStates.js';

test('question states preserve answered, unanswered, and explicit not-applicable semantics', () => {
  const states = buildGovernedQuestionStates({
    assessmentId: 'ba-20260821-aabbccdd',
    answers: { q1: 'Governed answer', q2: '', q3: 'Answer wins' },
    requestedStates: { q2: 'NOT_APPLICABLE', q3: 'NOT_APPLICABLE', q4: 'UNKNOWN_CLIENT_VALUE' },
  });
  assert.deepEqual(Object.keys(states), BUSINESS_ASSESSMENT_QUESTION_KEYS);
  assert.equal(states.q1.state, 'ANSWERED');
  assert.equal(states.q2.state, 'NOT_APPLICABLE');
  assert.deepEqual(states.q2.evidence_refs, ['business_assessment:ba-20260821-aabbccdd:inputs.question_states.q2']);
  assert.equal(states.q3.state, 'ANSWERED');
  assert.equal(states.q4.state, 'UNANSWERED');
  assert.deepEqual(states.q4.evidence_refs, []);
});

test('server owns question-state evidence references and rejects missing assessment identity', () => {
  assert.throws(() => buildGovernedQuestionStates({ answers: {} }), /assessment_id_required/u);
  const states = buildGovernedQuestionStates({
    assessmentId: 'ba-20260821-aabbccdd',
    answers: {},
    requestedStates: { q11: { state: 'NOT_APPLICABLE', evidence_refs: ['client:invented'] } },
  });
  assert.equal(states.q11.reason, 'Customer explicitly marked this assessment question as not applicable.');
  assert.deepEqual(states.q11.evidence_refs, ['business_assessment:ba-20260821-aabbccdd:inputs.question_states.q11']);
});

test('new assessment submission uses canonical New BA and never the legacy generation sequence', () => {
  const source = fs.readFileSync('src/BusinessAssessment.jsx', 'utf8');
  const submit = source.slice(source.indexOf('async function submitAssessment()'), source.indexOf('async function retryCanonicalGeneration()'));
  const retry = source.slice(source.indexOf('async function retryCanonicalGeneration()'), source.indexOf('async function generateRetrievedAssessment()'));
  assert.match(submit, /enterCanonicalNewBaAfterIntake/u);
  assert.match(retry, /enterCanonicalNewBaAfterIntake/u);
  assert.doesNotMatch(submit, /runGenerationSequence|business-assessment\/analyze|generate-briefing|generate-futures/u);
  assert.doesNotMatch(retry, /runGenerationSequence|business-assessment\/analyze|generate-briefing|generate-futures/u);
});
