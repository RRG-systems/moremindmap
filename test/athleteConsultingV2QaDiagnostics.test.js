import assert from 'node:assert/strict';
import test from 'node:test';
import { safeDiagnostics, safeApaMetadata } from '../scripts/athlete-consulting-v2-review/safe-diagnostics.mjs';

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

test('APA failure receipts expose underlying allowlisted rule without model text', () => {
  const event = { kind: 'failure', code: 'APA_COMPOSITION_CANDIDATE_INVALID',
    stage: 'publication_dry_run', validator_code: 'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND',
    validator_path: 'report.candidates.0.gates.0.reason', output_text: 'PRIVATE',
    delta_receipt: { private: 'PRIVATE' }, provider_code: 'PRIVATE' };
  assert.deepEqual(safeDiagnostics(event), {
    code: 'APA_COMPOSITION_CANDIDATE_INVALID', stage: 'publication_dry_run',
    http_status: null, validation_errors: [],
    validator_code: 'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND',
    validator_path: 'report.candidates.0.gates.0.reason',
  });
  event.validator_code = 'CURRENT_APA_PRIVATE';
  event.validator_path = 'report.candidates.secret.action';
  assert.equal(safeDiagnostics(event).validator_code, null);
  assert.equal(safeDiagnostics(event).validator_path, null);
});

test('APA accounting retains only bounded sizes, exact hashes and source identity', () => {
  const sha = 'a'.repeat(64), id = '11111111-1111-4111-8111-111111111111';
  const basis = { delta_binding_sha256: sha, request_sha256: sha, input_chars: 120000,
    input_bytes: 120030, current_version: 0, athlete_slug: 'sofia',
    source_id: `APA:CURRENT:${id}`, source_message_id: id, request: 'PRIVATE' };
  const safe = safeApaMetadata({ kind: 'receipt', receipt: { ...basis,
    output_chars: 3400, output_bytes: 3500, before_sha256: sha, after_sha256: sha,
    publication_performed: false, changed: true, candidate: 'PRIVATE',
    delta_receipt: { private: 'PRIVATE' } } });
  assert.deepEqual(safe, { apa: { delta_binding_sha256: sha, request_sha256: sha,
    before_sha256: sha, after_sha256: sha, input_chars: 120000, input_bytes: 120030,
    output_chars: 3400, output_bytes: 3500, current_version: 0, athlete_slug: 'sofia',
    source_id: `APA:CURRENT:${id}`, source_message_id: id, changed: true, publication_performed: false } });
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE/u);
  assert.deepEqual(safeApaMetadata({ basis: { delta_binding_sha256: 'PRIVATE' } }), {});
  assert.deepEqual(safeApaMetadata({ basis: { delta_binding_sha256: sha,
    input_chars: -1, output_bytes: 10000001, current_version: 25,
    source_id: 'PRIVATE', athlete_slug: 'PRIVATE', after_sha256: 'PRIVATE' } }), {
    apa: { delta_binding_sha256: sha },
  });
});

test('diagnostics do not retain object values that coerce to an allowed string', () => {
  const forged = text => ({ private: 'PRIVATE', toString: () => text });
  assert.equal(safeDiagnostics({ kind: 'failure', code: forged('COACH_RESPONSE_INVALID') }).code, null);
  assert.deepEqual(safeApaMetadata({ basis: { delta_binding_sha256: forged('a'.repeat(64)) } }), {});
  const safe = safeApaMetadata({ basis: { delta_binding_sha256: 'a'.repeat(64),
    source_id: forged('APA:CURRENT:11111111-1111-4111-8111-111111111111'),
    source_message_id: forged('11111111-1111-4111-8111-111111111111') } });
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|source_id|source_message_id/u);
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
