import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';

import BuildProfileInput from '../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { normalizeAssessmentAnswers } from '../api/engine/normalizeAssessmentAnswers.js';
import {
  buildBosTruthfulnessLayer,
} from '../src/lib/bosTruthfulness/buildTruthfulnessLayer.js';
import {
  CLAIM_CLASSIFICATIONS,
  createEvidenceContract,
} from '../src/lib/bosTruthfulness/evidenceContract.js';
import {
  containsUnsupportedNarrativeClaim,
  validateClaim,
} from '../src/lib/bosTruthfulness/claimValidator.js';
import {
  analyzeWrittenEvidence,
} from '../src/lib/bosTruthfulness/writtenEvidence.js';
import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildCustomerBOSViewModel } from '../src/lib/reports/buildCustomerBOSViewModel.js';
import {
  SYNTHETIC_PROFILE_ID,
  buildCompleteBosUiAnswers,
} from './fixtures/bosMeasurementFoundationFixture.js';

const EXPECTED_WRITTEN_ROLES = [
  'life_direction',
  'setback_response',
  'immediate_pressure',
  'ambiguity_response',
  'leadership_self_assessment',
  'sustained_pressure',
  'misunderstanding_response',
  'business_operating_reality',
  'growth_tension',
  'systems_accountability',
];

async function buildCompleteCanonicalRecord() {
  const previous = process.env.GPT_RESCORING_ENABLED;
  process.env.GPT_RESCORING_ENABLED = 'false';
  try {
    const normalized = normalizeAssessmentAnswers(buildCompleteBosUiAnswers());
    const profileInput = new BuildProfileInput().build({
      answers: normalized,
      metadata: { profile_id: SYNTHETIC_PROFILE_ID },
    });
    const canonical = await generateCanonicalProfile(profileInput, {
      profile_id: SYNTHETIC_PROFILE_ID,
      model: 'canonical-truthfulness-test',
    });
    return {
      profile_id: SYNTHETIC_PROFILE_ID,
      person_name: 'Synthetic Operator',
      company_name: 'Synthetic Company',
      intake_answers: normalized,
      canonical_profile_json: canonical,
    };
  } finally {
    if (previous === undefined) delete process.env.GPT_RESCORING_ENABLED;
    else process.env.GPT_RESCORING_ENABLED = previous;
  }
}

function buildSparseCanonicalRecord() {
  const dimensions = [
    'vector',
    'signal',
    'fidelity',
    'velocity',
    'leverage',
    'flex',
    'framework',
    'horizon',
  ];
  return {
    profile_id: 'mm-synthetic-sparse-truthfulness',
    intake_answers: {},
    canonical_profile_json: {
      profile_id: 'mm-synthetic-sparse-truthfulness',
      intake_answers: {},
      vector_scores: Object.fromEntries(dimensions.map((dimension) => [dimension, 0])),
      ranked_dimensions: dimensions.map((dimension, index) => ({
        dimension,
        rank: index + 1,
        score: 0,
        confidence: 0,
        evidence_count: 0,
        contributing_answers: [],
      })),
    },
  };
}

test('every Layer 2 claim has evidence provenance confidence sufficiency and validation contracts', async () => {
  const record = await buildCompleteCanonicalRecord();
  const truthfulness = buildBosTruthfulnessLayer(record);

  assert.equal(truthfulness.version, 'bos_truthfulness_v1');
  assert.equal(truthfulness.authority, 'deterministic_layer_2');
  assert.equal(truthfulness.measurement_boundary.layer_1_scores_modified, false);
  assert.equal(truthfulness.measurement_boundary.gpt_used_for_measurement, false);
  assert.equal(truthfulness.measurement_boundary.downstream_contracts_modified, false);
  assert.equal(truthfulness.claims.length, 24);

  for (const claim of truthfulness.claims) {
    assert.ok(claim.claim_id);
    assert.ok(claim.claim);
    assert.ok(Array.isArray(claim.evidence));
    assert.ok(Array.isArray(claim.provenance));
    assert.ok(claim.provenance.length >= 1);
    assert.ok(Number.isFinite(claim.confidence.score));
    assert.equal(claim.confidence.calibrated, false);
    assert.ok(['sufficient', 'insufficient'].includes(claim.evidence_sufficiency.status));
    assert.equal(typeof claim.validation.valid, 'boolean');
    assert.equal(typeof claim.abstention.abstained, 'boolean');
    if (claim.evidence_sufficiency.status === 'insufficient') {
      assert.equal(claim.classification, CLAIM_CLASSIFICATIONS.INSUFFICIENT);
      assert.equal(claim.claim, CLAIM_CLASSIFICATIONS.INSUFFICIENT);
      assert.ok(claim.abstention.reason);
    }
  }
});

test('all ten written questions use question-aware roles and bounded signal matching', async () => {
  const record = await buildCompleteCanonicalRecord();
  const analysis = analyzeWrittenEvidence(record);

  assert.equal(analysis.question_count, 10);
  assert.equal(analysis.answered_count, 10);
  assert.deepEqual(
    Object.values(analysis.questions).map(({ evidence_role }) => evidence_role),
    EXPECTED_WRITTEN_ROLES,
  );
  assert.ok(analysis.questions.q17.signals.some(({ signal_id }) => signal_id === 'adds_structure'));
  assert.ok(analysis.questions.q24.signals.some(({ signal_id }) => signal_id === 'frustration_named'));

  const boundaryProbe = analyzeWrittenEvidence({
    intake_answers: {
      q17: { text: 'Pressure is present.' },
      q25: { text: 'Tasking continued.' },
    },
  });
  assert.deepEqual(boundaryProbe.questions.q17.signals, []);
  assert.deepEqual(boundaryProbe.questions.q25.signals, []);
});

test('sparse and partial profiles fail closed with explicit Insufficient Evidence', () => {
  const truthfulness = buildBosTruthfulnessLayer(buildSparseCanonicalRecord());

  assert.equal(truthfulness.summary.sufficient_claims, 0);
  assert.equal(truthfulness.summary.insufficient_claims, truthfulness.summary.total_claims);
  for (const claim of truthfulness.claims) {
    assert.equal(claim.claim, 'Insufficient Evidence');
    assert.equal(claim.classification, 'Insufficient Evidence');
    assert.equal(claim.evidence_sufficiency.status, 'insufficient');
    assert.ok(claim.confidence.score < 0.4);
  }
});

test('Layer 1 aggregate evidence counts remain explicit without duplicate evidence paths', () => {
  const record = buildSparseCanonicalRecord();
  record.canonical_profile_json.ranked_dimensions[0] = {
    dimension: 'vector',
    rank: 1,
    score: 0.72,
    confidence: 0.82,
    evidence_count: 4,
  };
  const truthfulness = buildBosTruthfulnessLayer(record);
  const claim = truthfulness.claims_by_id.dimension_vector;

  assert.equal(claim.evidence_sufficiency.evidence_count, 4);
  assert.equal(claim.evidence.length, 1);
  assert.equal(claim.evidence[0].source_type, 'layer_1_aggregate_measurement');
  assert.equal(claim.evidence[0].aggregate_count, 4);
  assert.equal(new Set(claim.evidence.map(({ source_path }) => source_path)).size, 1);
});

test('claim validation rejects unsupported certainty timelines quantities and quotations', () => {
  const base = {
    classification: CLAIM_CLASSIFICATIONS.INFERRED,
    evidence: [{ source_path: 'intake_answers.q17.text' }],
    provenance: [{ source: 'assessment', path: 'intake_answers.q17.text' }],
    sourceTexts: ['I review the work when conditions change.'],
  };

  assert.equal(validateClaim({ ...base, claim: 'This will always resolve the issue.' }).valid, false);
  assert.equal(validateClaim({ ...base, claim: 'The result changes within 30 days.' }).valid, false);
  assert.equal(validateClaim({ ...base, claim: 'Performance improves by 25%.' }).valid, false);
  assert.equal(validateClaim({ ...base, claim: 'The answer says “I never hesitate”.' }).valid, false);
  assert.equal(
    validateClaim({
      ...base,
      claim: 'The written response supports an inferred review pattern, not an observed outcome.',
    }).valid,
    true,
  );
  assert.equal(containsUnsupportedNarrativeClaim('This will work within 30 days.'), true);
  assert.equal(containsUnsupportedNarrativeClaim('This is a hypothesis to test.'), false);
});

test('invalid claims abstain instead of preserving an impressive proposed conclusion', () => {
  const contract = createEvidenceContract({
    claimId: 'unsafe_claim',
    claim: 'This will always increase performance by 25% within 30 days.',
    classification: CLAIM_CLASSIFICATIONS.INFERRED,
    evidence: [{ source_path: 'intake_answers.q17.text' }],
    provenance: [{ source: 'assessment', path: 'intake_answers.q17.text' }],
    confidence: 0.99,
    validation: { valid: false, failures: ['unsupported_certainty_language'] },
  });

  assert.equal(contract.claim, 'Insufficient Evidence');
  assert.equal(contract.classification, 'Insufficient Evidence');
  assert.equal(contract.confidence.band, 'very_low');
  assert.equal(contract.abstention.abstained, true);
  assert.equal(contract.proposed_claim.includes('25%'), true);
});

test('Narrative V3 and customer view model expose truthfulness contracts without changing canonical data', async () => {
  const record = await buildCompleteCanonicalRecord();
  const canonicalBefore = JSON.stringify(record);
  const narrative = await buildNarrativeV3(record, false, null, true);
  const customer = buildCustomerBOSViewModel({
    canonical: record,
    narrative,
    profileId: record.profile_id,
    personName: record.person_name,
    company: record.company_name,
    ranked: record.canonical_profile_json.ranked_dimensions,
  });

  assert.equal(JSON.stringify(record), canonicalBefore);
  assert.equal(narrative.truthfulness_version, 'bos_truthfulness_v1');
  assert.equal(narrative.truthfulness.measurement_boundary.gpt_used_for_measurement, false);
  assert.equal(narrative.hiddenContradictions.body, 'Insufficient Evidence');
  assert.equal(narrative.strategicCeiling.body, 'Insufficient Evidence');
  assert.equal(narrative.teamExperience.body, 'Insufficient Evidence');
  assert.equal(narrative.fiveFutures.summary, 'Insufficient Evidence');
  assert.equal(narrative.fiveFutures.futures.length, 5);
  assert.ok(narrative.recommendedNextStep.body.includes('Hypothesis to Test'));

  assert.equal(customer.tabs.length, 8);
  assert.equal(customer.overviewSections.length, 5);
  assert.equal(customer.meta.profileId, record.profile_id);
  assert.equal(customer.truthfulness.version, 'bos_truthfulness_v1');
  assert.equal(customer.teamFit.content, 'Insufficient Evidence');
  assert.equal(customer.mainConstraint.content, 'Insufficient Evidence');
  assert.equal(customer.fiveFuturesSections.length, 6);
  assert.ok(customer.fiveFuturesSections.every(({ content }) => (
    content.includes('Insufficient Evidence')
  )));
  assert.ok(customer.oneMove.content.includes('Hypothesis to Test'));
  assert.ok(customer.oneMove.claimContracts.length > 0);
  assert.ok(customer.operatingScores.every(({ claimContract }) => claimContract));
  assert.ok(customer.overviewSections.every(({ claimContracts }) => Array.isArray(claimContracts)));
  assert.doesNotMatch(
    JSON.stringify({
      customerSummary: customer.customerSummary,
      overviewSections: customer.overviewSections,
      teamFit: customer.teamFit,
      fiveFuturesSections: customer.fiveFuturesSections,
    }),
    /You operate best|Your strength is|As you scale|most likely direction right now/i,
  );
});

test('sparse Narrative V3 customer path contains no confident psychological conclusion', async () => {
  const record = buildSparseCanonicalRecord();
  const narrative = await buildNarrativeV3(record, false, null, true);
  const customer = buildCustomerBOSViewModel({
    canonical: record,
    narrative,
    profileId: record.profile_id,
    ranked: record.canonical_profile_json.ranked_dimensions,
  });

  assert.equal(narrative.truthfulness_summary.sufficient_claims, 0);
  assert.ok(customer.overviewSections.every(({ content }) => content === 'Insufficient Evidence'));
  assert.equal(customer.teamFit.content, 'Insufficient Evidence');
  assert.equal(customer.oneMove.content, 'Insufficient Evidence');
  assert.ok(customer.operatingScores.every(({ oneLine }) => oneLine === 'Insufficient Evidence'));
});
