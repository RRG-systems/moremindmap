import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import questionContract from '../src/lib/baVerticalCassettesV1/loanOriginatorQuestionContract.generated.json' with { type: 'json' };
import typedEvidenceRegistry from '../docs/lo-cassette-2-final-canonical-authority-v1/04_CANONICAL_LO_TYPED_ANSWER_EVIDENCE_REGISTRY_V1.json' with { type: 'json' };
import branchingContract from '../docs/lo-cassette-2-final-canonical-authority-v1/05_CANONICAL_LO_BRANCHING_APPLICABILITY_SKIP_CONTRACT_V1.json' with { type: 'json' };
import {
  LOAN_ORIGINATOR_CASSETTE_REGISTRATION,
  LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_FILE_SHA256,
  LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_SHA256,
  LOAN_ORIGINATOR_INTAKE_CONTRACT_SHA256,
  LOAN_ORIGINATOR_QUESTION_ARCHITECTURE_FINGERPRINT,
} from '../src/lib/baVerticalCassettesV1/loanOriginatorCassette.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

test('generated LO questions are byte-pinned and reproduce the frozen question architecture', () => {
  const generatedUrl = new URL(
    '../src/lib/baVerticalCassettesV1/loanOriginatorQuestionContract.generated.json',
    import.meta.url,
  );
  const canonicalQuestionSource = readFileSync(new URL(
    '../docs/lo-cassette-2-final-canonical-authority-v1/03_CANONICAL_LO_INTAKE_QUESTION_CONTRACT_V1.md',
    import.meta.url,
  ), 'utf8');
  const mission = [...canonicalQuestionSource.matchAll(/\*\*Canonical mission ID:\*\*\s*`([^`]+)`/gu)]
    .map((match) => match[1]);
  const wording = [...canonicalQuestionSource.matchAll(/\*\*Customer question:\*\*\s*\n\*\*([^\n]+)\*\*/gu)]
    .map((match) => match[1].trim());
  const architectureBytes = JSON.stringify({
    mission,
    words: wording,
    screens: typedEvidenceRegistry.screens.map((screen) => ({
      id: screen.id,
      kind: screen.kind,
      fields: screen.fields,
    })),
    core_order: branchingContract.fresh_producing_path.core_order,
    conditional_order: branchingContract.fresh_producing_path.conditional_order,
    fresh_max: branchingContract.fresh_producing_path.maximum_questions,
    hard: branchingContract.hard_customer_facing_ceiling,
  });
  const semanticPayload = {
    schema_version: questionContract.schema_version,
    contract_id: questionContract.contract_id,
    source_sha256: questionContract.source_sha256,
    questions: questionContract.questions,
  };

  assert.equal(sha256(readFileSync(generatedUrl)),
    LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_FILE_SHA256);
  assert.equal(hashCanonicalJson(semanticPayload),
    LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_SHA256);
  assert.equal(sha256(architectureBytes),
    LOAN_ORIGINATOR_QUESTION_ARCHITECTURE_FINGERPRINT);
  assert.equal(questionContract.source_sha256, LOAN_ORIGINATOR_INTAKE_CONTRACT_SHA256);
  assert.equal(questionContract.question_architecture_fingerprint,
    LOAN_ORIGINATOR_QUESTION_ARCHITECTURE_FINGERPRINT);
  assert.equal(questionContract.generated_contract_sha256,
    LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_SHA256);
  assert.deepEqual(questionContract.questions.map((question) => question.key), mission);
  assert.deepEqual(questionContract.questions.map((question) => question.title), wording);
  assert.equal(LOAN_ORIGINATOR_CASSETTE_REGISTRATION.intake_contract.question_architecture_fingerprint,
    LOAN_ORIGINATOR_QUESTION_ARCHITECTURE_FINGERPRINT);
  assert.equal(LOAN_ORIGINATOR_CASSETTE_REGISTRATION.intake_contract.generated_file_sha256,
    LOAN_ORIGINATOR_GENERATED_QUESTION_CONTRACT_FILE_SHA256);
});
