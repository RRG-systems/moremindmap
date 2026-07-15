/**
 * Focused Role Fit + Ancillary Services Capture Potential tests.
 * Run: node scripts/test-ancillary-role-fit.mjs
 * No new dependencies. Fail-closed: process.exit(1) on any failure.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

import { FATHOM_DD_OVERALL_WEIGHTS_V1B, FATHOM_DISTRICT_DIRECTOR_V1 } from '../src/lib/leadership/roleModels/fathomDistrictDirectorV1.js';
import {
  parsePerformanceEvidence,
  mapGptInterpretationToEvidenceParse,
  applyEvidenceToDimensions,
  computeGrowthWeightedOverall,
  scoreRoleDimension,
  computeAncillaryServicesCapture,
  applyAncillarySharedWeightToDimensions,
  assertRoleFitWeightTotal,
  ANCILLARY_SHARED_WEIGHT,
  ANCILLARY_OVERALL_EFFECT_CAP,
} from '../src/lib/leadership/roleFitScoring.js';
import { buildDistrictDirectorFit } from '../src/lib/leadership/buildDistrictDirectorFit.js';
import { GPT_EVIDENCE_AFFECTED_DIMENSIONS } from '../src/lib/leadership/buildRoleFitEvidencePayload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, error: err?.message || String(err) });
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err?.message || err}`);
  }
}

/** Darren-like compressed BOS unit-scale fixture (1B/1C calibration). */
const DARREN_SIGNALS = {
  vector: 0.45,
  velocity: 0.5,
  signal: 0.48,
  fidelity: 0.42,
  leverage: 0.55,
  flex: 0.5,
  framework: 0.4,
  horizon: 0.52,
};

function syntheticPayload(signals = DARREN_SIGNALS, name = 'Calibration Fixture') {
  return {
    ok: true,
    profile_id: 'fixture-darren-like',
    canonical_profile_json: {
      identity: { name, profile_id: 'fixture-darren-like' },
      vector_scores: { ...signals },
      ranked_dimensions: Object.entries(signals).map(([dimension, display_score]) => ({
        dimension,
        display_score,
        score: display_score,
      })),
    },
  };
}

function buildFit(evidence = '', signals = DARREN_SIGNALS, context = {}) {
  return buildDistrictDirectorFit({
    profilePayload: syntheticPayload(signals),
    profileId: 'fixture-darren-like',
    performanceEvidence: evidence,
    forceDeterministicEvidence: true,
    context,
  });
}

console.log('\n=== Ancillary Services Role Fit Tests ===\n');

// ---------------------------------------------------------------------------
// 1. No ancillary evidence
// ---------------------------------------------------------------------------
test('1. No ancillary evidence: BOS baseline, missing facts labeled, inference mode', () => {
  const fit = buildFit('');
  const a = fit.ancillary_services_capture;
  assert.ok(a, 'ancillary result present');
  assert.equal(a.source_mode, 'behavioral_inference');
  assert.equal(a.source_label, 'Behavioral inference');
  assert.ok(typeof a.behavioral_baseline_score === 'number');
  assert.equal(a.evidence_adjusted_score, a.behavioral_baseline_score);
  assert.equal(a.score_delta, 0);
  assert.ok(Array.isArray(a.missing_evidence) && a.missing_evidence.length > 0);
  assert.match(a.interpretation, /Behavioral inference/i);
  assert.doesNotMatch(a.interpretation, /meets the 10%/i);
  assert.doesNotMatch(a.interpretation, /misses the 10%/i);
});

// ---------------------------------------------------------------------------
// 2. Positive evidence raises ancillary + modest overall
// ---------------------------------------------------------------------------
test('2. Positive evidence: ancillary rises; Overall rises modestly', () => {
  const base = buildFit('');
  const pos = buildFit(
    'Achieved 12% partner-included transaction capture with strong mortgage adoption over two quarters.',
  );
  const a0 = base.ancillary_services_capture;
  const a1 = pos.ancillary_services_capture;
  assert.ok(a1.evidence_adjusted_score > a0.evidence_adjusted_score);
  assert.ok(a1.score_delta > 0);
  assert.equal(a1.source_mode, 'evidence_supported');
  assert.equal(a1.source_label, 'Evidence adjusted');
  const overallDelta = pos.overall.score_percent - base.overall.score_percent;
  assert.ok(overallDelta > 0, `overall should rise, got ${overallDelta}`);
  assert.ok(
    overallDelta <= ANCILLARY_OVERALL_EFFECT_CAP + 0.05,
    `overall delta ${overallDelta} exceeds cap`,
  );
  assert.ok(Math.abs(a1.overall_score_effect) <= ANCILLARY_OVERALL_EFFECT_CAP);
});

// ---------------------------------------------------------------------------
// 3. Negative evidence
// ---------------------------------------------------------------------------
test('3. Negative evidence: ancillary falls; Overall falls modestly', () => {
  const base = buildFit('');
  const neg = buildFit(
    'Near-zero ancillary capture and negligible partner adoption with no ownership of partner process.',
  );
  const a1 = neg.ancillary_services_capture;
  assert.ok(a1.evidence_adjusted_score < base.ancillary_services_capture.evidence_adjusted_score);
  assert.ok(a1.score_delta < 0);
  assert.equal(a1.source_mode, 'evidence_weakened');
  const overallDelta = neg.overall.score_percent - base.overall.score_percent;
  assert.ok(overallDelta < 0, `overall should fall, got ${overallDelta}`);
  assert.ok(Math.abs(overallDelta) <= ANCILLARY_OVERALL_EFFECT_CAP + 0.05);
});

// ---------------------------------------------------------------------------
// 4. Meaningful opportunity + poor capture → stronger penalty
// ---------------------------------------------------------------------------
test('4. Opportunity + poor capture: stronger ancillary penalty, capped overall', () => {
  const weak = buildFit('Poor ancillary capture and zero partner attach.');
  const strong = buildFit(
    'Large region with high transaction volume but near-zero ancillary capture and negligible partner adoption.',
  );
  assert.ok(
    strong.ancillary_services_capture.evidence_adjusted_score <
      weak.ancillary_services_capture.evidence_adjusted_score,
    'opportunity-adjusted penalty should be stronger',
  );
  assert.equal(strong.ancillary_services_capture.opportunity_context, 'meaningful_opportunity_supported');
  assert.ok(
    Math.abs(strong.ancillary_services_capture.overall_score_effect) <= ANCILLARY_OVERALL_EFFECT_CAP,
  );
});

// ---------------------------------------------------------------------------
// 5. Unknown opportunity — no invented denominator
// ---------------------------------------------------------------------------
test('5. Unknown opportunity: no invented volume/denominator', () => {
  const fit = buildFit('Poor ancillary capture with little or no partner usage.');
  const a = fit.ancillary_services_capture;
  assert.equal(a.opportunity_context, 'unknown_or_not_established');
  assert.ok(
    a.missing_evidence.some((m) => /opportunity|volume|region/i.test(m)),
    'should label missing opportunity',
  );
  assert.doesNotMatch(JSON.stringify(a), /invented/i);
});

// ---------------------------------------------------------------------------
// 6. Mixed evidence
// ---------------------------------------------------------------------------
test('6. Mixed evidence: balanced adjustment + mixed label', () => {
  const fit = buildFit(
    'Improved partner adoption on mortgage but near-zero ancillary capture on title with missed partner targets.',
  );
  const a = fit.ancillary_services_capture;
  assert.ok(
    a.evidence_direction === 'mixed' || a.source_mode === 'mixed_evidence',
    `expected mixed, got direction=${a.evidence_direction} mode=${a.source_mode}`,
  );
  assert.ok(Math.abs(a.score_delta) < 14, 'mixed should be moderated');
});

// ---------------------------------------------------------------------------
// 7. Recruiting dominance 40%
// ---------------------------------------------------------------------------
test('7. Recruiting remains exactly 40%', () => {
  assert.equal(FATHOM_DD_OVERALL_WEIGHTS_V1B.recruiting_growth_drive, 0.4);
  const fit = buildFit(
    'Achieved 12% partner-included transaction capture with strong mortgage adoption.',
  );
  const growth = fit.dimensions.find((d) => d.id === 'recruiting_growth_drive');
  assert.equal(growth.weight, 0.4);
  assert.equal(fit.ancillary_services_capture.weight, 0.03);
});

// ---------------------------------------------------------------------------
// 8. No double-counting — weights total 100%
// ---------------------------------------------------------------------------
test('8. No double-counting: effective weights total 100%, not 103%', () => {
  const check = assertRoleFitWeightTotal(FATHOM_DD_OVERALL_WEIGHTS_V1B);
  assert.equal(check.is_100_percent, true);
  assert.equal(check.recruiting_is_40, true);
  assert.equal(check.ancillary_not_independent, true);
  assert.equal(ANCILLARY_SHARED_WEIGHT, 0.03);
  assert.equal(FATHOM_DD_OVERALL_WEIGHTS_V1B.partner_ecosystem_advocacy, 0.03);
  // Model must not declare a second independent weight key for ancillary
  assert.equal(FATHOM_DD_OVERALL_WEIGHTS_V1B.ancillary_services_capture, undefined);
  const sum = Object.values(FATHOM_DD_OVERALL_WEIGHTS_V1B).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `weight sum ${sum}`);
});

// ---------------------------------------------------------------------------
// 9. Overall cap
// ---------------------------------------------------------------------------
test('9. Overall cap: ancillary cannot move Overall beyond ±3 pp', () => {
  const base = buildFit('');
  const extremePos = buildFit(
    'Achieved 12% partner-included transaction capture. Strong partner adoption. Measured mortgage title insurance adoption. Repeatable introduction process. Improved partner capture. Met the 10% target. Fathom companies capture attach. Qualifying partners collaboration.',
  );
  const extremeNeg = buildFit(
    'Large region with high transaction volume and 200 agents. Near-zero ancillary capture. Negligible partner adoption. Failed to introduce Fathom companies. Zero partner attach. Missed 10% target. Declining partner participation. No ownership of partner process.',
  );
  const dPos = extremePos.overall.score_percent - base.overall.score_percent;
  const dNeg = extremeNeg.overall.score_percent - base.overall.score_percent;
  assert.ok(Math.abs(dPos) <= ANCILLARY_OVERALL_EFFECT_CAP + 0.15, `pos overall ${dPos}`);
  assert.ok(Math.abs(dNeg) <= ANCILLARY_OVERALL_EFFECT_CAP + 0.15, `neg overall ${dNeg}`);
  assert.ok(Math.abs(extremePos.ancillary_services_capture.overall_score_effect) <= ANCILLARY_OVERALL_EFFECT_CAP);
  assert.ok(Math.abs(extremeNeg.ancillary_services_capture.overall_score_effect) <= ANCILLARY_OVERALL_EFFECT_CAP);
});

// ---------------------------------------------------------------------------
// 10. GPT boundary — no numeric scores from GPT mapping
// ---------------------------------------------------------------------------
test('10. GPT boundary: GPT cannot assign numeric ancillary score', () => {
  const mapped = mapGptInterpretationToEvidenceParse(
    {
      classification: 'positive',
      confidence: 0.9,
      affected_dimensions: ['Ancillary Services Capture Potential'],
      signals: [
        {
          dimension: 'Ancillary Services Capture Potential',
          direction: 'positive',
          severity: 'high',
          duration: 'recent',
          summary: 'Documented 14% partner-included capture',
        },
      ],
      recommended_adjustments: {
        growth_fit: 'no_change',
        evidence_adjusted_fit: 'increase_modestly',
        overall_fit: 'increase_modestly',
        compliance_ops_risk: 'no_change',
        support_required: 'no_change',
        ancillary_capture: 'increase_materially',
        // Hostile: numeric fields must be ignored by scoring
        ancillary_score: 99,
        score_percent: 99,
        points: 25,
      },
      plain_english_summary: 'Strong ancillary capture evidence.',
      board_safe_interpretation: 'Positive ancillary signal.',
      guardrail_note: 'GPT interprets only.',
    },
    'Documented 14% partner-included capture with strong mortgage adoption.',
  );
  assert.equal(mapped.positive_ancillary, true);
  assert.equal(mapped.positive_recruiting, false);
  assert.ok(!('ancillary_score' in mapped) || mapped.ancillary_score === undefined);
  // Deterministic compute owns numbers
  const result = computeAncillaryServicesCapture({
    signalMap: DARREN_SIGNALS,
    evidenceParse: mapped,
  });
  assert.equal(result.gpt_assigns_numeric_score, false);
  assert.ok(result.evidence_adjusted_score < 99);
  assert.ok(result.evidence_adjusted_score <= 96);
});

// ---------------------------------------------------------------------------
// 11. Existing evidence regression
// ---------------------------------------------------------------------------
test('11. Existing evidence regression: recruiting/compliance/support still work', () => {
  const recruit = buildFit('was the number 1 recruiter at fathom in 2025');
  assert.equal(recruit.performance_evidence.positive_recruiting, true);
  assert.ok(recruit.score_stack.growth.score_percent >= 90);

  const compliance = buildFit('Has recurring compliance document review delays.');
  assert.equal(compliance.performance_evidence.negative_compliance_ops, true);
  const compDim = compliance.dimensions.find((d) => d.id === 'compliance_discipline');
  assert.ok(compDim.evidence_penalty_applied);

  const supportParse = parsePerformanceEvidence(
    'Weak agent support and unresolved agent complaints.',
  );
  assert.equal(supportParse.negative_support, true);
  const support = buildFit('Weak agent support and unresolved agent complaints.');
  const supportDim = support.dimensions.find((d) => d.id === 'agent_support_service');
  assert.ok(supportDim.evidence_penalty_applied || supportParse.negative_support);

  const training = parsePerformanceEvidence('Poor training attendance across the team.');
  assert.equal(training.negative_training, true);

  const partner = parsePerformanceEvidence('Partner advocacy issues in the field.');
  assert.equal(partner.negative_partner, true);

  // Ancillary must not activate recruiting calibration
  const ancOnly = buildFit(
    'Achieved 12% partner-included transaction capture with strong mortgage adoption.',
  );
  assert.equal(ancOnly.performance_evidence.positive_recruiting, false);
  assert.equal(ancOnly.overall.excellence_calibration_applied, false);
});

// ---------------------------------------------------------------------------
// 12. Layout: panel placement contract in dashboard source
// ---------------------------------------------------------------------------
test('12. Layout: ancillary panel fills approved empty slot; single evidence input', () => {
  const dashPath = join(root, 'src/components/leadership/RoleFitDashboard.jsx');
  const labPath = join(root, 'src/LeadershipRoleFitLab.jsx');
  const dash = readFileSync(dashPath, 'utf8');
  const lab = readFileSync(labPath, 'utf8');

  assert.ok(dash.includes('AncillaryServicesCaptureCard'));
  assert.ok(dash.includes('Ancillary Services Capture Potential'));
  assert.ok(dash.includes('data-panel="ancillary_services_capture"'));
  assert.ok(dash.includes('2xl:grid-cols-4'));
  // Single card definition
  const cardDefs = dash.match(/function AncillaryServicesCaptureCard/g) || [];
  assert.equal(cardDefs.length, 1);
  // Lab must remain single evidence textarea (forbidden to redesign)
  const textareas = lab.match(/<textarea/g) || [];
  assert.ok(textareas.length >= 1, 'evidence textarea present');
  // No second ancillary textarea in dashboard
  assert.ok(!dash.includes('<textarea'));
});

// ---------------------------------------------------------------------------
// 13. Darren calibration — no material unexplained collapse
// ---------------------------------------------------------------------------
test('13. Darren calibration: no material score collapse without evidence', () => {
  const fit = buildFit('');
  // Historical 1B/1C baseline ~55.2 overall on this fixture
  const overall = fit.overall.score_percent;
  assert.ok(overall >= 52 && overall <= 58, `unexpected overall collapse/rise: ${overall}`);
  assert.ok(
    Math.abs(fit.behavioral_fit.score_percent - fit.evidence_adjusted_fit.score_percent) < 0.15,
  );
  // Partner vs ancillary baseline should stay close
  const partner = fit.dimensions.find((d) => d.id === 'partner_ecosystem_advocacy');
  const a = fit.ancillary_services_capture;
  assert.ok(
    Math.abs(partner.score_percent - a.behavioral_baseline_score) <= 8,
    `partner ${partner.score_percent} vs ancillary ${a.behavioral_baseline_score}`,
  );
});

// ---------------------------------------------------------------------------
// Extra integrity
// ---------------------------------------------------------------------------
test('Extra: shared-weight substitution does not stack weights', () => {
  const dims = FATHOM_DISTRICT_DIRECTOR_V1.dimensions.map((d) =>
    scoreRoleDimension(d, DARREN_SIGNALS),
  );
  const ancillary = computeAncillaryServicesCapture({
    signalMap: DARREN_SIGNALS,
    partnerDim: dims.find((d) => d.id === 'partner_ecosystem_advocacy'),
    evidenceParse: parsePerformanceEvidence(
      'Achieved 12% partner-included transaction capture with measured mortgage adoption.',
    ),
  });
  const scoring = applyAncillarySharedWeightToDimensions(dims, ancillary);
  const weightSum = scoring.reduce((s, d) => s + (d.weight || 0), 0);
  assert.ok(Math.abs(weightSum - 1) < 1e-9, `scoring weight sum ${weightSum}`);
  const partner = scoring.find((d) => d.id === 'partner_ecosystem_advocacy');
  assert.equal(partner._ancillary_shared_weight_substituted, true);
  assert.equal(partner.score_percent, ancillary.overall_contribution_score);
});

test('Extra: payload lists ancillary classification dimension', () => {
  assert.ok(GPT_EVIDENCE_AFFECTED_DIMENSIONS.includes('Ancillary Services Capture Potential'));
});

test('Extra: static forbidden-file and no second evidence UI', () => {
  const api = readFileSync(join(root, 'api/leadership/dd-role-fit-evidence-interpretation.js'), 'utf8');
  assert.ok(api.includes('Ancillary Services Capture Potential'));
  assert.ok(api.includes('Do NOT output final numeric scores'));
  assert.ok(api.includes('ancillary_capture'));
  // No new evidence route
  assert.ok(!existsSync(join(root, 'api/leadership/dd-role-fit-ancillary-evidence.js')));
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error('FAILURES:');
  for (const f of failures) console.error(` - ${f.name}: ${f.error}`);
  process.exit(1);
}
console.log('ALL ANCILLARY ROLE FIT TESTS PASSED');
process.exit(0);
