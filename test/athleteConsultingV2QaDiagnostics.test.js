import assert from 'node:assert/strict';
import test from 'node:test';
import { safeDiagnostics } from '../scripts/athlete-consulting-v2-review/safe-diagnostics.mjs';

test('QA failures retain only content-free internal codes, stages and numeric status', () => {
  const event = { kind: 'failure', code: 'ATHLETE_VISUAL_PLAN_FAILED_CLOSED',
    stage: 'response_evidence', http_status: 502,
    validation_errors: ['ATHLETE_VISUAL_FINAL_RECAP_REQUIRED',
      'ATHLETE_VISUAL_FINAL_RECAP_REQUIRED'],
    message: 'private response detail', output_text: 'private synthetic content',
    provider_code: 'private provider detail' };
  assert.deepEqual(safeDiagnostics(event), {
    code: 'ATHLETE_VISUAL_PLAN_FAILED_CLOSED', stage: 'response_evidence',
    http_status: 502, validation_errors: ['ATHLETE_VISUAL_FINAL_RECAP_REQUIRED'],
  });
  assert.doesNotMatch(JSON.stringify(safeDiagnostics(event)), /private/u);
});

test('QA diagnostics reject arbitrary text, payload fields and unapproved codes', () => {
  assert.deepEqual(safeDiagnostics({ kind: 'failure', code: 'secret value',
    stage: 'private content', http_status: 999,
    validation_errors: ['private content', 'OPENAI_API_KEY', null, {},
      'ATHLETE_VISUAL_' + 'A'.repeat(121)] }), {
    code: null, stage: null, http_status: null, validation_errors: [],
  });
  assert.deepEqual(safeDiagnostics({ kind: 'response', code: 'COACH_RESPONSE_INVALID' }), {});
});
