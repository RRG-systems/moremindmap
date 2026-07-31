import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import BuildProfileInput from '../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { inferRoleFit } from '../api/engine/canonical/inferRoleFit.js';
import { generateFallbackCanonical } from '../api/engine/canonical/canonicalFallback.js';
import { normalizeAssessmentAnswers } from '../api/engine/normalizeAssessmentAnswers.js';
import {
  QUESTION_ROUTE_REGISTRY,
  WRITTEN_QUESTION_IDS,
  getQuestionByEvidenceRole,
  validateQuestionRouteRegistry,
} from '../api/engine/questionEvidenceRegistry.js';
import {
  BOS_MEASUREMENT_CONTRACT_VERSION,
  classifyTopologyScore,
  topologyThreshold,
} from '../api/engine/measurement/measurementContract.js';
import { buildBusinessIntelligenceDraft } from '../api/engine/businessAssessment/buildBusinessIntelligenceDraft.js';
import { buildExecutiveDiagnosticBriefingPrompt } from '../api/engine/businessAssessment/buildExecutiveDiagnosticBriefingPrompt.js';
import {
  buildFiveFuturesOnlyPrompt,
  buildOneMovePrompt,
} from '../api/engine/businessAssessment/buildFiveFuturesPrompt.js';
import { resolveCanonicalBehavioralData } from '../api/engine/businessAssessment/canonicalBehavioralResolver.js';
import { serializePromptPacket } from '../api/engine/businessAssessment/promptPacketIntegrity.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../api/engine/businessAssessment/realEstateBusinessModelV1.js';
import { buildMicroScenario } from '../src/lib/narrativeV3/structuredInterpreter.js';
import { getScoreFromProfile, normalizeOperatingScore } from '../src/lib/reports/scoreLabels.js';
import {
  SYNTHETIC_PROFILE_ID,
  buildBusinessAssessmentRecord,
  buildCompleteBosUiAnswers,
  buildExecutiveBriefing,
  buildFiveFutures,
} from './fixtures/bosMeasurementFoundationFixture.js';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..');

async function buildSyntheticCanonical() {
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
      model: 'canonical-measurement-test',
    });
    return { normalized, profileInput, canonical };
  } finally {
    if (previous === undefined) delete process.env.GPT_RESCORING_ENABLED;
    else process.env.GPT_RESCORING_ENABLED = previous;
  }
}

test('unified topology contract defines negative, no-evidence, and reachable bands', () => {
  assert.equal(BOS_MEASUREMENT_CONTRACT_VERSION, 'bos_measurement_v1');
  assert.equal(classifyTopologyScore(-0.1, 3), 'inverse');
  assert.equal(classifyTopologyScore(0, 0), 'no_evidence');
  assert.equal(classifyTopologyScore(0.2, 3), 'low');
  assert.equal(classifyTopologyScore(0.5, 3), 'moderate');
  assert.equal(classifyTopologyScore(0.7, 3), 'high');
  assert.equal(classifyTopologyScore(0.9, 3), 'extreme');
  assert.equal(classifyTopologyScore(-0.2, 0), 'no_evidence');
  assert.equal(topologyThreshold(6.5), 0.65);
});

test('canonical score predicates no longer contain legacy 0-10 thresholds', () => {
  const canonicalDir = path.join(REPO_ROOT, 'api/engine/canonical');
  const legacyThreshold = /[<>]=?\s*(?:3\.0|3\.5|4\.0|4\.5|5\.0|5\.5|6\.0|6\.5|7\.0|7\.5|8\.0)\b/;
  const offenders = readdirSync(canonicalDir)
    .filter((name) => name.endsWith('.js') && !name.includes('-BACKUP-'))
    .filter((name) => legacyThreshold.test(readFileSync(path.join(canonicalDir, name), 'utf8')));
  assert.deepEqual(offenders, []);

  const residualScaleLeaks = [
    ['api/engine/canonical/inferContradictions.js', /threshold\s*=\s*6(?:\.0)?\b/],
    ['api/engine/canonical/extractIntelligence.js', /(?:velocity\s*>\s*fidelity|vector\s*>\s*signal)\s*\+\s*2\b/],
    ['api/engine/canonical/canonicalFallback.js', /raw_score\s*\|\|\s*5|vector_scores\[dim\]\s*=\s*5/],
    ['api/engine/canonical/canonicalProfileSchema.js', /0[-–]10/],
    ['src/lib/narrativeV3/structuredInterpreter.js', /primarySystem\.score\s*>\s*2\b/],
    ['src/lib/narrativeV3/unifiedInterpreter.js', /primaryScore\s*>\s*1\.5\b/],
  ].filter(([file, pattern]) => pattern.test(readFileSync(path.join(REPO_ROOT, file), 'utf8')));
  assert.deepEqual(residualScaleLeaks, []);
});

test('high and low canonical role-fit branches are mathematically reachable', () => {
  const high = inferRoleFit({
    vector: 0.82,
    horizon: 0.72,
    framework: 0.7,
    velocity: 0.74,
    fidelity: 0.68,
    flex: 0.6,
    signal: 0.7,
    leverage: 0.7,
  }, { business_reality: {}, growth_tension: {}, stall_patterns: {} });
  assert.ok(high.natural_roles.includes('Founder/CEO'));
  assert.ok(high.natural_roles.includes('COO/Operator'));

  const low = inferRoleFit({
    vector: 0.2,
    horizon: 0.25,
    framework: 0.2,
    velocity: 0.2,
    fidelity: 0.2,
    flex: 0.2,
    signal: 0.2,
    leverage: 0.2,
  }, { business_reality: {}, growth_tension: {}, stall_patterns: {} });
  assert.ok(low.friction_roles.includes('Executive Leadership'));
  assert.ok(low.friction_roles.includes('Strategy/Long-Term Planning'));
});

test('fallback and rendering preserve zero and negative topology semantics', () => {
  const fallback = generateFallbackCanonical({
    dimension_scores: { vector: { raw_score: 0 } },
    raw_answers: {},
  });
  assert.equal(fallback.vector_scores.vector, 0);
  assert.equal(fallback.vector_scores.signal, 0);
  assert.equal(normalizeOperatingScore(-0.4), 0);
  assert.equal(normalizeOperatingScore(0.7), 0.7);
  assert.equal(normalizeOperatingScore(1.2), 1);
  assert.equal(getScoreFromProfile('Vector', { vector_scores: { vector: 0 } }, [{ dimension: 'vector', score: 0, evidence_count: 0 }]), null);
  assert.equal(buildMicroScenario({ primarySystem: { score: 0.3, operating: '' }, secondarySystem: { operating: '' } }, 'strain') !== null, true);
  assert.equal(buildMicroScenario({ primarySystem: { score: 0.1, operating: '' }, secondarySystem: { operating: '' } }, 'strain'), null);
});

test('metadata registry routes all questions once and all ten written questions correctly', () => {
  const validation = validateQuestionRouteRegistry();
  assert.equal(validation.valid, true);
  assert.equal(validation.question_count, 28);
  assert.equal(validation.routed_question_count, 28);
  assert.deepEqual(validation.missing_evidence_roles, []);
  assert.equal(QUESTION_ROUTE_REGISTRY.length, 28);
  assert.deepEqual(WRITTEN_QUESTION_IDS, [2, 14, 17, 20, 22, 24, 25, 26, 27, 28]);
  assert.equal(getQuestionByEvidenceRole('immediate_pressure')?.id, 17);
  assert.equal(getQuestionByEvidenceRole('sustained_pressure')?.id, 24);
});

test('complete intake preserves 28 answers and routes Q17 immediate-pressure evidence', async () => {
  const { profileInput, canonical } = await buildSyntheticCanonical();
  assert.equal(Object.keys(profileInput.raw_answers).length, 28);
  assert.equal(Object.keys(profileInput.written_responses).length, 10);
  assert.equal(profileInput.pressure_analysis.immediate_stress_response.source, 'Q17');
  assert.equal(profileInput.pressure_analysis.immediate_stress_response.pattern_type, 'Tighter+Faster');
  assert.ok(canonical.role_fit_analysis.natural_roles.length > 0);
  assert.notDeepEqual(canonical.role_fit_analysis.natural_roles, ['Needs dimension refinement for specific role fit']);
  assert.deepEqual(canonical.role_fit_analysis.friction_roles, ['Broad role flexibility']);
});

test('canonical resolver applies one wrapper, rank, score, confidence, and GPT precedence rule', () => {
  const canonical = {
    ranked_dimensions: [{ dimension: 'vector', score: 0.4, confidence: 0.5 }],
    rescoring_v1: { ranked_dimensions: [{ dimension: 'vector', rescored_score: 0.6, confidence: 0.7 }] },
    rescoring_gpt: {
      ranked_dimensions: [{
        dimension: 'vector',
        display_score: 0.72,
        gpt_rescored_score: 0.7,
        support_adjusted_score: 0.5,
        confidence: 0.8,
      }],
    },
  };
  const resolved = resolveCanonicalBehavioralData({ canonical_dossier: { canonical_profile_json: canonical } });
  assert.equal(resolved.provenance.canonical_shape, 'canonical_dossier.canonical_profile_json');
  assert.equal(resolved.provenance.ranked_source, 'rescoring_gpt.ranked_dimensions');
  assert.equal(resolved.ranked_dimensions[0].score, 0.72);
  assert.equal(resolved.ranked_dimensions[0].confidence, 0.8);
  assert.equal(resolved.ranked_dimensions[0].provenance.score_source, 'display_score');
});

test('schema-aware packet compaction remains valid deterministic JSON and preserves required fields', () => {
  const payload = {
    task: 'measurement packet',
    assessment_answers: { q1: 'x'.repeat(8000), q2: 'y'.repeat(6000) },
    business_intelligence_draft: { evidence: Array.from({ length: 80 }, (_, index) => `evidence-${index}-${'z'.repeat(100)}`) },
    canonical_profile_snapshot: { ranked_dimensions: Array.from({ length: 8 }, (_, index) => ({ dimension: `d${index}`, score: index / 10 })) },
  };
  const options = { maxCharacters: 5000, requiredTopLevelKeys: Object.keys(payload) };
  const first = serializePromptPacket(payload, options);
  const second = serializePromptPacket(payload, options);
  assert.equal(first.json, second.json);
  assert.ok(first.json.length <= 5000);
  const parsed = JSON.parse(first.json);
  for (const key of Object.keys(payload)) assert.ok(Object.hasOwn(parsed, key));
  assert.equal(parsed._packet_integrity.compacted, true);
  assert.ok(parsed._packet_integrity.omitted_path_count > 0);
});

test('BID Executive Five Futures and One Move prompts consume identical behavioral semantics', async () => {
  const { canonical } = await buildSyntheticCanonical();
  const assessmentRecord = buildBusinessAssessmentRecord();
  const bid = buildBusinessIntelligenceDraft({
    assessmentRecord,
    canonicalProfile: { canonical_profile_json: canonical },
    realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
  });
  const executivePrompt = buildExecutiveDiagnosticBriefingPrompt({
    assessmentRecord,
    businessIntelligenceDraft: bid,
    canonicalProfile: { canonical_profile_json: canonical },
    realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
  });
  const futuresPrompt = buildFiveFuturesOnlyPrompt({
    assessmentRecord,
    businessIntelligenceDraft: bid,
    executiveDiagnosticBriefing: buildExecutiveBriefing(),
    canonicalProfile: { canonical_profile_json: canonical },
    realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
  });
  const oneMovePrompt = buildOneMovePrompt({
    assessmentRecord,
    businessIntelligenceDraft: bid,
    executiveDiagnosticBriefing: buildExecutiveBriefing(),
    fiveFutures: buildFiveFutures(),
    canonicalProfile: { canonical_profile_json: canonical },
    realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
  });

  const expected = bid.behavioral_reality.ranked_dimensions.map(({ dimension, score }) => ({ dimension, score }));
  for (const prompt of [executivePrompt, futuresPrompt, oneMovePrompt]) {
    const packet = JSON.parse(prompt.messages[1].content);
    const actual = packet.canonical_profile_snapshot.ranked_dimensions.map(({ dimension, score }) => ({ dimension, score }));
    assert.deepEqual(actual, expected);
    assert.equal(packet._packet_integrity.version, 'prompt_packet_integrity_v1');
  }
});
