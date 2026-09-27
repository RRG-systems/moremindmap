import assert from 'node:assert/strict';
import test from 'node:test';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { apaValidatorDiagnostic, safeApaValidatorPath } from '../server/athleteConsultingV2/apaDiagnostics.js';
import { publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';

function proposal() {
  const sourceMessageId = '11111111-1111-4111-8111-111111111111';
  return { bundle: nia, expectedVersion: 0,
    state: { mm: nia.person.mm, messages: [{ id: sourceMessageId, role: 'user',
      speaker: 'athlete', text: 'My synthetic training schedule changed.',
      at: '2026-09-25T08:00:00.000Z' }] },
    confirmedChange: { id: '22222222-2222-4222-8222-222222222222',
      source_message_id: sourceMessageId, athlete_slug: nia.person.slug, mm: nia.person.mm,
      kind: 'reality', supersedes: [], confirmed: true, confirmed_by: 'athlete',
      confirmed_at: '2026-09-25T08:01:00.000Z', reason: 'Confirmed synthetic reality.' },
    candidate: { confirmation: structuredClone(nia.apa.confirmation),
      report: structuredClone(nia.apa.report) } };
}

test('APA diagnostics retain only a closed rule, structural path and stage', () => {
  const error = new Error('CURRENT_APA_CHANGE_NOT_SOURCE_BOUND');
  error.validation_path = 'report.candidates.0.gates.1.reason';
  error.private_content = 'Never retained';
  assert.deepEqual(apaValidatorDiagnostic(error, { stage: 'publication_dry_run' }), {
    validator_code: 'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND',
    validator_path: 'report.candidates.0.gates.1.reason', stage: 'publication_dry_run',
  });
  assert.deepEqual(apaValidatorDiagnostic(new Error('FIRST_LAYER_TOO_LONG'),
    { stage: 'publication_dry_run', path: 'report' }), {
    validator_code: 'FIRST_LAYER_TOO_LONG', validator_path: 'report', stage: 'publication_dry_run',
  });
});

test('APA diagnostics reject arbitrary exception text, entity IDs and invented enum codes', () => {
  const privateError = new Error('Private model output and token');
  privateError.validation_path = 'report';
  assert.deepEqual(apaValidatorDiagnostic(privateError, { stage: 'Private stage' }), {
    validator_code: null, validator_path: null, stage: null,
  });
  for (const code of ['CURRENT_APA_PRIVATE_PAYLOAD', 'APA_DELTA_SECRET_VALUE',
    'OPENAI_API_KEY', 'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND\nprivate']) {
    assert.equal(apaValidatorDiagnostic(new Error(code)).validator_code, null);
  }
  for (const path of ['report.candidates.some-private-id.action', 'report.__proto__',
    'report.domains.100.goal', 'report.domains.01.goal', 'report[0]', 'private',
    'report.candidates.0.action\nprivate', 'report.' + 'goal.'.repeat(20)]) {
    assert.equal(safeApaValidatorPath(path), null);
  }
});

test('frozen, uncited and schema failures keep their existing error with safe indexed path', () => {
  const cases = [
    { mutate: input => { input.candidate.report.headline += ' Changed.'; },
      code: 'CURRENT_APA_UNCITED_FIELD_CHANGED', path: 'report.headline' },
    { mutate: input => { input.candidate.report.candidates[0].bos_fit += ' Changed.'; },
      code: 'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND', path: 'report.candidates.0.bos_fit' },
    { mutate: input => { input.candidate.report.domains[0].extra = 'Forbidden'; },
      code: 'CURRENT_APA_REPORT_SCHEMA_INVALID', path: 'report' },
  ];
  for (const entry of cases) {
    const input = proposal(), before = JSON.stringify(input.bundle);
    entry.mutate(input);
    assert.throws(() => publishCurrentApa(input), error => {
      assert.equal(error.message, entry.code);
      assert.deepEqual(apaValidatorDiagnostic(error, { stage: 'publication_dry_run' }), {
        validator_code: entry.code, validator_path: entry.path, stage: 'publication_dry_run',
      });
      return true;
    });
    assert.equal(JSON.stringify(input.bundle), before);
  }
});

test('unchanged youth rule failure is reported at truthful coarse report location', () => {
  const input = proposal();
  input.candidate.report.domains[0].strength = 'word '.repeat(130);
  assert.throws(() => publishCurrentApa(input), error => {
    assert.equal(error.message, 'FIRST_LAYER_TOO_LONG');
    assert.deepEqual(apaValidatorDiagnostic(error, { stage: 'publication_dry_run' }), {
      validator_code: 'FIRST_LAYER_TOO_LONG', validator_path: 'report', stage: 'publication_dry_run',
    });
    return true;
  });
});

test('unsupported priority or timing preserves a content-free grounding rule and indexed path', () => {
  const input = proposal();
  input.candidate.confirmation.review_date = '2026-10-03';
  input.candidate.narrative_updates = [{ field: 'confirmation.review_date', value: '2026-10-03',
    refs: [`APA:CURRENT:${input.confirmedChange.id}`] }];
  assert.throws(() => publishCurrentApa(input), error => {
    assert.deepEqual(apaValidatorDiagnostic(error, { stage: 'publication_dry_run' }), {
      validator_code: 'APA_NARRATIVE_SOURCE_TEXT_REQUIRED',
      validator_path: 'narrative_updates.0.value', stage: 'publication_dry_run',
    });
    assert.doesNotMatch(JSON.stringify(apaValidatorDiagnostic(error, { stage: 'publication_dry_run' })),
      /2026-10-03|synthetic training|source_message_id/u);
    return true;
  });
});
