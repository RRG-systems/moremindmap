import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';

import BuildProfileInput from '../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { normalizeAssessmentAnswers } from '../api/engine/normalizeAssessmentAnswers.js';
import customerIntelligenceHandler from '../api/moremindmap/customer-intelligence.js';
import {
  BOS_CUSTOMER_INTELLIGENCE_MODEL,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  INSUFFICIENT_EVIDENCE,
} from '../src/lib/bosCustomerIntelligence/contracts.js';
import { buildDeterministicLayer3Translation } from '../src/lib/bosCustomerIntelligence/deterministicFallback.js';
import { buildLayer3TranslationRequest } from '../src/lib/bosCustomerIntelligence/modelContract.js';
import { translateLayer3SemanticPacket } from '../src/lib/bosCustomerIntelligence/orchestrator.js';
import { applyLayer3Translations } from '../src/lib/bosCustomerIntelligence/premiumSurfaceAdapter.js';
import {
  buildLayer3SemanticPacket,
  hashSemanticValue,
  packetWithoutSemanticHash,
} from '../src/lib/bosCustomerIntelligence/semanticPacket.js';
import {
  clearLayer3TranslationCache,
} from '../src/lib/bosCustomerIntelligence/translationCache.js';
import {
  validateLayer3SemanticPacket,
  validateLayer3TranslationBundle,
} from '../src/lib/bosCustomerIntelligence/translationValidator.js';
import { buildLayer3VisualDNAViewModel } from '../src/lib/bosCustomerIntelligence/visualDNAAdapter.js';
import { buildNarrativeV3 } from '../src/lib/narrativeV3/buildNarrativeV3.js';
import { buildCustomerBOSViewModel } from '../src/lib/reports/buildCustomerBOSViewModel.js';
import { buildVisualDNAViewModel } from '../src/lib/visualDNA/buildVisualDNAViewModel.js';
import {
  SYNTHETIC_PROFILE_ID,
  buildCompleteBosUiAnswers,
} from './fixtures/bosMeasurementFoundationFixture.js';

async function buildLayer3Fixture() {
  const previous = process.env.GPT_RESCORING_ENABLED;
  process.env.GPT_RESCORING_ENABLED = 'false';
  try {
    const answers = normalizeAssessmentAnswers(buildCompleteBosUiAnswers());
    const profileInput = new BuildProfileInput().build({
      answers,
      metadata: { profile_id: SYNTHETIC_PROFILE_ID },
    });
    const canonicalProfile = await generateCanonicalProfile(profileInput, {
      profile_id: SYNTHETIC_PROFILE_ID,
      model: 'canonical-layer3-test',
    });
    const canonical = {
      profile_id: SYNTHETIC_PROFILE_ID,
      person_name: 'Synthetic Operator',
      company_name: 'Synthetic Company',
      intake_answers: answers,
      canonical_profile_json: canonicalProfile,
    };
    const narrative = await buildNarrativeV3(canonical, false, null, true);
    const deterministicVisualDNA = buildVisualDNAViewModel(canonical, narrative);
    const viewModel = buildCustomerBOSViewModel({
      canonical,
      narrative,
      profileId: canonical.profile_id,
      personName: canonical.person_name,
      company: canonical.company_name,
      ranked: canonicalProfile.ranked_dimensions,
      deterministicVisualDNA,
    });
    return { canonical, narrative, viewModel, deterministicVisualDNA };
  } finally {
    if (previous === undefined) delete process.env.GPT_RESCORING_ENABLED;
    else process.env.GPT_RESCORING_ENABLED = previous;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('immutable semantic packet contains only Layer 2 claims and protected display values', async () => {
  const { canonical, narrative, viewModel } = await buildLayer3Fixture();
  const canonicalBefore = JSON.stringify(canonical);
  const narrativeBefore = JSON.stringify(narrative);
  const viewModelBefore = JSON.stringify(viewModel);
  const packet = buildLayer3SemanticPacket(viewModel);

  assert.equal(packet.version, BOS_CUSTOMER_INTELLIGENCE_VERSION);
  assert.equal(packet.source_authority, 'deterministic_layer_2');
  assert.equal(packet.translation_only, true);
  assert.equal(packet.protected_contract.layer_1_scores_modified, false);
  assert.equal(packet.protected_contract.layer_2_claims_modified, false);
  assert.equal(packet.protected_contract.canonical_bos_modified, false);
  assert.equal(packet.protected_contract.downstream_contracts_modified, false);
  assert.equal(packet.protected_contract.confidence_calibration_claimed, false);
  assert.equal(packet.surfaces.length, 17);
  assert.equal(Object.isFrozen(packet), true);
  assert.equal(Object.isFrozen(packet.surfaces[0].claims[0]), true);
  assert.equal(validateLayer3SemanticPacket(packet).valid, true);
  assert.equal(packet.semantic_hash, hashSemanticValue(packetWithoutSemanticHash(packet)));

  const serialized = JSON.stringify(packet);
  assert.doesNotMatch(serialized, /Synthetic Operator|Synthetic Company/);
  assert.doesNotMatch(serialized, /intake_answers|answer_text|source_path|excerpt/);
  assert.equal(JSON.stringify(canonical), canonicalBefore);
  assert.equal(JSON.stringify(narrative), narrativeBefore);
  assert.equal(JSON.stringify(viewModel), viewModelBefore);
});

test('semantic hash is reproducible and changes when a protected score changes', async () => {
  const { viewModel } = await buildLayer3Fixture();
  const first = buildLayer3SemanticPacket(viewModel);
  const second = buildLayer3SemanticPacket(viewModel);
  assert.equal(first.semantic_hash, second.semantic_hash);

  const changedViewModel = clone(viewModel);
  changedViewModel.operatingScores[0].score += 0.01;
  const changed = buildLayer3SemanticPacket(changedViewModel);
  assert.notEqual(changed.semantic_hash, first.semantic_hash);
});

test('deterministic fallback preserves every claim contract and abstains explicitly', async () => {
  const { viewModel } = await buildLayer3Fixture();
  const packet = buildLayer3SemanticPacket(viewModel);
  const bundle = buildDeterministicLayer3Translation(packet);
  const validation = validateLayer3TranslationBundle(packet, bundle);

  assert.deepEqual(validation.failures, []);
  assert.equal(bundle.source_hash, packet.semantic_hash);
  assert.equal(bundle.translations.length, packet.surfaces.length);
  const future = bundle.translations.find(({ surface_id }) => (
    surface_id === 'five_futures.summary'
  ));
  const team = bundle.translations.find(({ surface_id }) => surface_id === 'team.primary');
  for (const translation of [future, team]) {
    assert.equal(translation.status, 'abstained');
    assert.equal(translation.customer_copy.headline, INSUFFICIENT_EVIDENCE);
    assert.equal(translation.customer_copy.explanation, INSUFFICIENT_EVIDENCE);
    assert.equal(translation.customer_copy.recognizable_pattern, '');
  }
});

test('validator rejects semantic drift, false certainty, new numbers, and fabricated quotes', async () => {
  const { viewModel } = await buildLayer3Fixture();
  const packet = buildLayer3SemanticPacket(viewModel);
  const fallback = buildDeterministicLayer3Translation(packet);

  const driftedContract = clone(fallback);
  driftedContract.translations[0].semantic_contracts[0].confidence_score = 0.99;
  assert.equal(validateLayer3TranslationBundle(packet, driftedContract).valid, false);

  const translatedIndex = fallback.translations.findIndex(({ status }) => status === 'translated');
  const certainty = clone(fallback);
  certainty.translations[translatedIndex].customer_copy.recognizable_pattern =
    'You may notice this will always transform your results.';
  assert.equal(validateLayer3TranslationBundle(packet, certainty).valid, false);

  const number = clone(fallback);
  number.translations[translatedIndex].customer_copy.recognizable_pattern =
    'You may notice performance improves by 25%.';
  assert.equal(validateLayer3TranslationBundle(packet, number).valid, false);

  const quotation = clone(fallback);
  quotation.translations[translatedIndex].customer_copy.recognizable_pattern =
    'You may notice teammates saying “this is exactly how you work”.';
  assert.equal(validateLayer3TranslationBundle(packet, quotation).valid, false);
});

test('GPT-5.6 request is Responses structured output and receives only the semantic packet', async () => {
  const { viewModel } = await buildLayer3Fixture();
  const packet = buildLayer3SemanticPacket(viewModel);
  const request = buildLayer3TranslationRequest(packet);

  assert.equal(request.model, BOS_CUSTOMER_INTELLIGENCE_MODEL);
  assert.deepEqual(request.reasoning, { effort: 'none' });
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.strict, true);
  assert.equal(request.input.length, 2);
  assert.match(request.input[0].content[0].text, /translation only/i);
  assert.deepEqual(JSON.parse(request.input[1].content[0].text), packet);
  assert.doesNotMatch(request.input[1].content[0].text, /intake_answers|answer_text/);
});

test('orchestrator is feature-gated, validates GPT output, caches by hash, and fails closed', async () => {
  const { viewModel } = await buildLayer3Fixture();
  const packet = buildLayer3SemanticPacket(viewModel);
  clearLayer3TranslationCache(packet, null);

  let transportCalls = 0;
  const validBundle = buildDeterministicLayer3Translation(packet);
  const disabled = await translateLayer3SemanticPacket({
    packet,
    enabled: false,
    transport: async () => {
      transportCalls += 1;
      return { output_text: JSON.stringify(validBundle) };
    },
    cacheOptions: { storage: null },
  });
  assert.equal(disabled.receipt.source, 'deterministic_fallback');
  assert.equal(disabled.receipt.reason, 'feature_disabled');
  assert.equal(transportCalls, 0);

  const translated = await translateLayer3SemanticPacket({
    packet,
    enabled: true,
    transport: async () => {
      transportCalls += 1;
      return { output_text: JSON.stringify(validBundle) };
    },
    cacheOptions: { storage: null },
  });
  assert.equal(translated.receipt.source, 'gpt_translation');
  assert.equal(translated.receipt.model, BOS_CUSTOMER_INTELLIGENCE_MODEL);
  assert.equal(transportCalls, 1);

  const cached = await translateLayer3SemanticPacket({
    packet,
    enabled: true,
    transport: async () => {
      transportCalls += 1;
      throw new Error('should not be called');
    },
    cacheOptions: { storage: null },
  });
  assert.equal(cached.receipt.source, 'cache');
  assert.equal(transportCalls, 1);

  clearLayer3TranslationCache(packet, null);
  const invalidBundle = clone(validBundle);
  invalidBundle.translations[0].semantic_contracts[0].claim = 'Invented truth';
  const rejected = await translateLayer3SemanticPacket({
    packet,
    enabled: true,
    transport: async () => ({ output_text: JSON.stringify(invalidBundle) }),
    cacheOptions: { storage: null },
  });
  assert.equal(rejected.receipt.source, 'deterministic_fallback');
  assert.equal(rejected.receipt.reason, 'layer3_model_translation_rejected');

  const timedOut = await translateLayer3SemanticPacket({
    packet,
    enabled: true,
    transport: async () => new Promise(() => {}),
    timeoutMs: 5,
    cacheOptions: { storage: null },
  });
  assert.equal(timedOut.receipt.source, 'deterministic_fallback');
  assert.equal(timedOut.receipt.reason, 'layer3_translation_timeout');
});

test('premium adapter changes customer copy only and preserves technical sources byte-for-byte', async () => {
  const { canonical, narrative, viewModel } = await buildLayer3Fixture();
  const canonicalBefore = JSON.stringify(canonical);
  const narrativeBefore = JSON.stringify(narrative);
  const technicalSourceBefore = JSON.stringify(viewModel.technicalSource);
  const advancedSourceBefore = JSON.stringify(viewModel.advancedSource);
  const packet = buildLayer3SemanticPacket(viewModel);
  const bundle = buildDeterministicLayer3Translation(packet);
  const translated = applyLayer3Translations(viewModel, packet, bundle, {
    source: 'deterministic_fallback',
  });

  assert.equal(translated.tabs.length, 8);
  assert.equal(translated.overviewSections.length, 5);
  assert.equal(translated.scoreMeaning.customerIntelligenceActive, true);
  assert.equal(translated.customer_intelligence.translation_only, true);
  assert.equal(translated.customer_intelligence.technical_source_unchanged, true);
  assert.equal(translated.truthfulness, viewModel.truthfulness);
  assert.equal(JSON.stringify(translated.technicalSource), technicalSourceBefore);
  assert.equal(JSON.stringify(translated.advancedSource), advancedSourceBefore);
  assert.equal(JSON.stringify(canonical), canonicalBefore);
  assert.equal(JSON.stringify(narrative), narrativeBefore);
  assert.equal(translated.teamFit.content.includes(INSUFFICIENT_EVIDENCE), true);
  assert.equal(translated.fiveFuturesSections.every(({ content }) => (
    content.includes(INSUFFICIENT_EVIDENCE)
  )), true);
  assert.equal(translated.oneMove.claimContracts, viewModel.oneMove.claimContracts);
});

test('Visual DNA adapter preserves score topology and removes unsupported defaults', async () => {
  const { viewModel, deterministicVisualDNA } = await buildLayer3Fixture();
  const sourceBefore = JSON.stringify(deterministicVisualDNA);
  const dimensionsBefore = JSON.stringify(deterministicVisualDNA.topDimensions);
  const packet = buildLayer3SemanticPacket(viewModel);
  const bundle = buildDeterministicLayer3Translation(packet);
  const visual = buildLayer3VisualDNAViewModel(deterministicVisualDNA, bundle);

  assert.equal(JSON.stringify(deterministicVisualDNA), sourceBefore);
  assert.equal(JSON.stringify(visual.topDimensions), dimensionsBefore);
  assert.equal(visual.futureBottleneck, INSUFFICIENT_EVIDENCE);
  assert.equal(visual.wrongSeatRisk, INSUFFICIENT_EVIDENCE);
  assert.deepEqual(visual.energySource, [INSUFFICIENT_EVIDENCE]);
  assert.deepEqual(visual.roleFitSignals, [INSUFFICIENT_EVIDENCE]);
  assert.equal(visual.futureCards.length, 5);
  assert.equal(visual.futureCards.every(({ summary }) => summary === INSUFFICIENT_EVIDENCE), true);
  assert.equal(visual.customer_intelligence.translation_only, true);
});

test('sparse Layer 2 input remains a complete explicit-abstention customer experience', async () => {
  const narrative = await buildNarrativeV3({}, false, null, true);
  const viewModel = buildCustomerBOSViewModel({
    canonical: {},
    narrative,
    profileId: 'mm-synthetic-layer3-sparse',
  });
  const packet = buildLayer3SemanticPacket(viewModel);
  const bundle = buildDeterministicLayer3Translation(packet);
  const translated = applyLayer3Translations(viewModel, packet, bundle);

  assert.equal(validateLayer3SemanticPacket(packet).valid, true);
  assert.equal(validateLayer3TranslationBundle(packet, bundle).valid, true);
  assert.equal(bundle.translations.every(({ status }) => status === 'abstained'), true);
  assert.equal(translated.tabs.length, 8);
  assert.equal(translated.overviewSections.length, 5);
  assert.equal(translated.overviewSections.every(({ content }) => (
    content.includes(INSUFFICIENT_EVIDENCE)
  )), true);
});

test('production translation route is unavailable by default and performs no model call', async () => {
  const previousFlag = process.env.BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED;
  delete process.env.OPENAI_API_KEY;
  try {
    const response = responseRecorder();
    await customerIntelligenceHandler({ method: 'POST', body: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.body, { error: 'feature_disabled' });
  } finally {
    if (previousFlag === undefined) delete process.env.BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED;
    else process.env.BOS_LAYER3_CUSTOMER_INTELLIGENCE_ENABLED = previousFlag;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
