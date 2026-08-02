import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import test from 'node:test';

import BuildProfileInput from '../api/engine/buildProfileInput.js';
import {
  assessAssessmentCompleteness,
  assessProfileInputCompleteness,
} from '../api/engine/assessmentCompleteness.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { inferCommunicationStyle } from '../api/engine/canonical/inferCommunicationStyle.js';
import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import {
  NARRATIVE_CACHE_TTL_HOURS,
  NARRATIVE_CACHE_VERSION,
  buildNarrativeCanonicalSemanticHash,
  cacheNarrative,
  clearCache,
  getCachedNarrative,
} from '../src/lib/narrativeV3/cache.js';
import {
  applyTruthfulnessGate,
  buildInsufficientEvidenceSection,
} from '../src/lib/narrativeV3/truthfulnessGate.js';
import { buildCustomerBOSViewModel } from '../src/lib/reports/buildCustomerBOSViewModel.js';
import { buildCompleteBosUiAnswers } from './fixtures/bosMeasurementFoundationFixture.js';

const TRUTHFULNESS_VERSION = 'bos_truthfulness_v1';
const NARRATIVE_SECTIONS = [
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
];

function buildTruthfulnessContract() {
  return {
    version: TRUTHFULNESS_VERSION,
    authority: 'deterministic_layer_2',
    claims: [],
    claims_by_id: {},
    section_claim_map: {},
    summary: {
      total_claims: 0,
      sufficient_claims: 0,
      insufficient_claims: 0,
    },
  };
}

function buildCacheableNarrative() {
  const truthfulness = buildTruthfulnessContract();
  return NARRATIVE_SECTIONS.reduce((narrative, section) => ({
    ...narrative,
    [section]: buildInsufficientEvidenceSection(section),
  }), {
    render_source: 'fallback_local',
    truthfulness_version: TRUTHFULNESS_VERSION,
    truthfulness,
  });
}

function installMemoryLocalStorage() {
  const values = new Map();
  const localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorage,
  });
  return {
    localStorage,
    restore() {
      if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
      else delete globalThis.localStorage;
    },
  };
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
    profile_id: 'mm-synthetic-hardening-sparse',
    intake_answers: {},
    canonical_profile_json: {
      profile_id: 'mm-synthetic-hardening-sparse',
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

async function buildCompleteCanonicalRecord() {
  const previous = process.env.GPT_RESCORING_ENABLED;
  process.env.GPT_RESCORING_ENABLED = 'false';
  try {
    const profileInput = new BuildProfileInput().build({
      answers: buildCompleteBosUiAnswers(),
    });
    const canonical = await generateCanonicalProfile(profileInput, {
      profile_id: 'mm-synthetic-layer2-hardening',
      model: 'canonical-layer2-hardening-test',
    });
    return {
      profile_id: canonical.profile_id,
      intake_answers: buildCompleteBosUiAnswers(),
      canonical_profile_json: canonical,
    };
  } finally {
    if (previous === undefined) delete process.env.GPT_RESCORING_ENABLED;
    else process.env.GPT_RESCORING_ENABLED = previous;
  }
}

test('cache enforces schema version TTL and active truthfulness version', () => {
  const storage = installMemoryLocalStorage();
  const narrative = buildCacheableNarrative();
  const canonical = buildSparseCanonicalRecord();
  const canonicalSemanticHash = buildNarrativeCanonicalSemanticHash(canonical);
  try {
    const legacyId = 'legacy-cache';
    storage.localStorage.setItem(`v3_narrative_${legacyId}`, JSON.stringify(narrative));
    assert.equal(getCachedNarrative(legacyId, canonical), null);

    const expiredId = 'expired-cache';
    storage.localStorage.setItem(`v3_narrative_${expiredId}`, JSON.stringify({
      data: narrative,
      cacheVersion: NARRATIVE_CACHE_VERSION,
      truthfulnessVersion: TRUTHFULNESS_VERSION,
      canonicalSemanticHash,
      cachedAt: new Date(Date.now() - (NARRATIVE_CACHE_TTL_HOURS + 1) * 60 * 60 * 1000).toISOString(),
      ttlHours: NARRATIVE_CACHE_TTL_HOURS,
    }));
    assert.equal(getCachedNarrative(expiredId, canonical), null);

    const oldVersionId = 'old-version-cache';
    storage.localStorage.setItem(`v3_narrative_${oldVersionId}`, JSON.stringify({
      data: narrative,
      cacheVersion: NARRATIVE_CACHE_VERSION - 1,
      truthfulnessVersion: TRUTHFULNESS_VERSION,
      canonicalSemanticHash,
      cachedAt: new Date().toISOString(),
      ttlHours: NARRATIVE_CACHE_TTL_HOURS,
    }));
    assert.equal(getCachedNarrative(oldVersionId, canonical), null);

    assert.equal(cacheNarrative('legacy-write', { render_source: 'legacy' }, canonical), false);
    assert.equal(cacheNarrative('active-write', narrative, canonical), true);
    assert.equal(getCachedNarrative('active-write', canonical), narrative);
    const changedCanonical = structuredClone(canonical);
    changedCanonical.canonical_profile_json.vector_scores.signal = 0.5;
    assert.equal(getCachedNarrative('active-write', changedCanonical), null);
  } finally {
    clearCache('active-write');
    storage.restore();
  }
});

test('cache treats a non-Storage localStorage placeholder as unavailable', () => {
  const canonical = buildSparseCanonicalRecord();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {},
  });
  try {
    assert.equal(getCachedNarrative('non-storage-placeholder', canonical), null);
    assert.equal(cacheNarrative('non-storage-active', buildCacheableNarrative(), canonical), true);
    assert.equal(
      getCachedNarrative('non-storage-active', canonical).truthfulness_version,
      TRUTHFULNESS_VERSION,
    );
  } finally {
    clearCache('non-storage-active');
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('legacy cache cannot bypass Layer 2 in buildNarrativeV3', async () => {
  const storage = installMemoryLocalStorage();
  const profileId = 'mm-synthetic-legacy-cache-bypass';
  try {
    storage.localStorage.setItem(`v3_narrative_${profileId}`, JSON.stringify({
      ...buildCacheableNarrative(),
      truthfulness_version: undefined,
      truthfulness: undefined,
    }));

    const narrative = await buildNarrativeV3(
      buildSparseCanonicalRecord(),
      false,
      profileId,
      false,
    );
    assert.equal(narrative.truthfulness_version, TRUTHFULNESS_VERSION);
    assert.equal(narrative.truthfulness.version, TRUTHFULNESS_VERSION);
    assert.equal(narrative.truthfulness_summary.sufficient_claims, 0);
    assert.equal(narrative.executiveSummary.body, 'Insufficient Evidence');
  } finally {
    clearCache(profileId);
    storage.restore();
  }
});

test('truthfulness projection exceptions fail closed for every structured section shape', () => {
  const throwingTruthfulness = new Proxy({}, {
    get() {
      throw new Error('synthetic truthfulness failure');
    },
  });

  for (const section of NARRATIVE_SECTIONS) {
    const rendering = applyTruthfulnessGate(section, {
      body: 'Confident legacy narrative must not survive.',
      summary: 'Confident legacy narrative must not survive.',
    }, throwingTruthfulness);
    assert.equal(rendering.truthfulness.version, TRUTHFULNESS_VERSION);
    assert.equal(rendering.claim_contracts.length, 0);
    assert.doesNotMatch(JSON.stringify(rendering), /Confident legacy narrative/);
  }

  assert.equal(
    applyTruthfulnessGate('teamExperience', {}, throwingTruthfulness).body,
    'Insufficient Evidence',
  );
  assert.equal(
    applyTruthfulnessGate('fiveFutures', {}, throwingTruthfulness).futures.length,
    5,
  );
  assert.equal(
    applyTruthfulnessGate('recommendedNextStep', {}, throwingTruthfulness).body,
    'Insufficient Evidence',
  );
});

test('null and malformed canonical render paths return a complete Layer 2 abstention view model', async () => {
  const nullNarrative = await buildNarrativeV3(null, false, null, true);
  assert.equal(nullNarrative.truthfulness_version, TRUTHFULNESS_VERSION);
  assert.equal(nullNarrative.render_source, 'truthfulness_fail_closed');
  assert.ok(NARRATIVE_SECTIONS.every((section) => nullNarrative[section]));

  const customer = buildCustomerBOSViewModel({
    canonical: {},
    narrative: nullNarrative,
    profileId: 'mm-synthetic-null-canonical',
  });
  assert.equal(customer.tabs.length, 8);
  assert.equal(customer.overviewSections.length, 5);
  assert.ok(customer.overviewSections.every(({ content }) => content === 'Insufficient Evidence'));

  const malformedCanonical = new Proxy({}, {
    get() {
      throw new Error('synthetic canonical failure');
    },
  });
  const malformedNarrative = await buildNarrativeV3(malformedCanonical, false, null, true);
  assert.equal(malformedNarrative.truthfulness_version, TRUTHFULNESS_VERSION);
  assert.equal(malformedNarrative.render_source, 'truthfulness_fail_closed');
  assert.equal(malformedNarrative.executiveSummary.body, 'Insufficient Evidence');
});

test('complete and partial intakes receive deterministic completeness classifications', () => {
  const completeAnswers = buildCompleteBosUiAnswers();
  const complete = assessAssessmentCompleteness(completeAnswers);
  assert.equal(complete.status, 'complete');
  assert.equal(complete.valid_answer_count, 28);
  assert.equal(complete.quality_score, 100);

  const partialAnswers = { ...completeAnswers };
  delete partialAnswers[28];
  const partial = assessAssessmentCompleteness(partialAnswers);
  assert.equal(partial.status, 'partial');
  assert.equal(partial.valid_answer_count, 27);
  assert.deepEqual(partial.missing_question_ids, [28]);
  assert.equal(partial.quality_score, 96);

  const invalidAnswers = { ...completeAnswers, 13: ['F'] };
  const invalid = assessAssessmentCompleteness(invalidAnswers);
  assert.equal(invalid.status, 'partial');
  assert.equal(invalid.valid_answer_count, 27);
  assert.deepEqual(invalid.invalid_question_ids, [13]);
  assert.equal(invalid.quality_score, 96);
});

test('all intake paths share completeness and incomplete profile quality cannot report 100', () => {
  const partialAnswers = buildCompleteBosUiAnswers();
  delete partialAnswers[28];
  const profileInput = new BuildProfileInput().build({ answers: partialAnswers });
  const diagnostic = assessProfileInputCompleteness(profileInput);

  assert.equal(profileInput.metadata.assessment_completeness.status, 'partial');
  assert.equal(profileInput.metadata.data_quality, 'low');
  assert.equal(diagnostic.valid_answer_count, 27);
  assert.equal(diagnostic.quality_score, 96);

  const startSource = readFileSync(
    new URL('../api/moremindmap/start.js', import.meta.url),
    'utf8',
  );
  const canonicalSource = readFileSync(
    new URL('../api/engine/canonical/executeCanonicalGeneration.js', import.meta.url),
    'utf8',
  );
  assert.match(startSource, /assessment_completeness:\s*assessmentCompleteness/);
  assert.match(canonicalSource, /assessProfileInputCompleteness\(job\.profileInput\)/);
  assert.match(canonicalSource, /quality_score = assessmentCompleteness\.quality_score/);
  assert.doesNotMatch(canonicalSource, /quality_score\s*=\s*100/);
});

test('topology emotional-smoothing high moderate and low branches are reachable', () => {
  const ranked = [{ dimension: 'signal' }, { dimension: 'flex' }];
  const base = {
    vector: 0.4,
    signal: 0.4,
    fidelity: 0.4,
    velocity: 0.4,
    leverage: 0.4,
    flex: 0.4,
    framework: 0.4,
    horizon: 0.4,
  };

  assert.match(
    inferCommunicationStyle({ ...base, signal: 0.7, flex: 0.6 }, ranked).emotional_calibration,
    /^High emotional smoothing/,
  );
  assert.equal(
    inferCommunicationStyle(base, ranked).emotional_calibration,
    'Moderate emotional calibration',
  );
  assert.match(
    inferCommunicationStyle({ ...base, signal: 0.2, flex: 0.2 }, ranked).emotional_calibration,
    /^Low emotional smoothing/,
  );
});

test('hardening preserves canonical and customer contracts on complete intake', async () => {
  const record = await buildCompleteCanonicalRecord();
  const canonical = record.canonical_profile_json;
  assert.equal(Object.keys(canonical.intake_answers).length, 28);
  assert.equal('assessment_completeness' in canonical, false);
  assert.equal('truthfulness' in canonical, false);
  assert.equal('assessment_completeness' in canonical.metadata, false);

  const narrative = await buildNarrativeV3(record, false, null, true);
  const customer = buildCustomerBOSViewModel({
    canonical: record,
    narrative,
    profileId: record.profile_id,
    ranked: canonical.ranked_dimensions,
  });
  assert.equal(narrative.truthfulness_version, TRUTHFULNESS_VERSION);
  assert.equal(customer.tabs.length, 8);
  assert.equal(customer.overviewSections.length, 5);
  assert.ok(customer.customerSummary.executive);
  assert.ok(customer.oneMove.content);
});
