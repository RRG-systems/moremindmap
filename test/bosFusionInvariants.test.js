import assert from 'node:assert/strict';
import process from 'node:process';
import test from 'node:test';
import { createServer } from 'vite';

import BuildProfileInput from '../api/engine/buildProfileInput.js';
import { generateCanonicalProfile } from '../api/engine/canonical/canonicalProfileGenerator.js';
import { normalizeAssessmentAnswers } from '../api/engine/normalizeAssessmentAnswers.js';
import { buildBusinessIntelligenceDraft } from '../api/engine/businessAssessment/buildBusinessIntelligenceDraft.js';
import { buildExecutiveDiagnosticBriefingPrompt } from '../api/engine/businessAssessment/buildExecutiveDiagnosticBriefingPrompt.js';
import {
  buildFiveFuturesOnlyPrompt,
  buildOneMovePrompt,
} from '../api/engine/businessAssessment/buildFiveFuturesPrompt.js';
import { resolveCanonicalBehavioralData } from '../api/engine/businessAssessment/canonicalBehavioralResolver.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../api/engine/businessAssessment/realEstateBusinessModelV1.js';
import { buildBusinessEngineContract } from '../src/lib/businessEngine/buildBusinessEngineContract.js';
import { projectBusinessEngineVisualV2 } from '../src/lib/businessEngine/projectBusinessEngineVisualV2.js';
import { validateBusinessEngineContract } from '../src/lib/businessEngine/validateBusinessEngineContract.js';
import {
  SYNTHETIC_PROFILE_ID,
  buildBusinessAssessmentRecord,
  buildCompleteBosUiAnswers,
  buildExecutiveBriefing,
  buildFiveFutures,
  buildOneMove,
} from './fixtures/bosMeasurementFoundationFixture.js';

function rankSignature(dimensions) {
  return dimensions.map((item) => `${item.dimension}:${item.score}`).join('|');
}

async function buildCustomerBAViewModelThroughVite(retrieve, canonical) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  try {
    const module = await server.ssrLoadModule('/src/lib/businessAssessment/buildCustomerBAViewModel.js');
    return module.buildCustomerBAViewModel(retrieve, canonical);
  } finally {
    await server.close();
  }
}

test('golden BOS to BA fusion preserves contracts ranks evidence and provenance', async () => {
  const previous = process.env.GPT_RESCORING_ENABLED;
  process.env.GPT_RESCORING_ENABLED = 'false';
  try {
    const normalizedAnswers = normalizeAssessmentAnswers(buildCompleteBosUiAnswers());
    const profileInput = new BuildProfileInput().build({ answers: normalizedAnswers, metadata: {} });
    const canonical = await generateCanonicalProfile(profileInput, {
      profile_id: SYNTHETIC_PROFILE_ID,
      model: 'canonical-fusion-invariant-test',
    });
    const canonicalRecord = { canonical_profile_json: canonical };
    const assessment = buildBusinessAssessmentRecord();
    const draft = buildBusinessIntelligenceDraft({
      assessmentRecord: assessment,
      canonicalProfile: canonicalRecord,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
    });
    const briefing = buildExecutiveBriefing();
    const fiveFutures = buildFiveFutures();
    const oneMove = buildOneMove();

    const executivePrompt = buildExecutiveDiagnosticBriefingPrompt({
      assessmentRecord: assessment,
      businessIntelligenceDraft: draft,
      canonicalProfile: canonicalRecord,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
    });
    const futuresPrompt = buildFiveFuturesOnlyPrompt({
      assessmentRecord: assessment,
      businessIntelligenceDraft: draft,
      executiveDiagnosticBriefing: briefing,
      canonicalProfile: canonicalRecord,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
    });
    const oneMovePrompt = buildOneMovePrompt({
      assessmentRecord: assessment,
      businessIntelligenceDraft: draft,
      executiveDiagnosticBriefing: briefing,
      fiveFutures,
      canonicalProfile: canonicalRecord,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1,
    });

    const retrieve = {
      assessment: {
        ...assessment,
        status: 'five_futures_and_one_move_ready',
        output: {
          business_intelligence_draft: draft,
          executive_diagnostic_briefing_v1: briefing,
          five_futures_v1: fiveFutures,
          one_move_v1: oneMove,
        },
      },
      profile: canonical,
      profile_id: SYNTHETIC_PROFILE_ID,
      has_business_intelligence_draft: true,
      has_five_futures: true,
      has_one_move: true,
    };

    const contract = buildBusinessEngineContract(retrieve);
    const contractValidation = validateBusinessEngineContract(contract);
    const projection = projectBusinessEngineVisualV2(contract, {
      identity: { profile_id: SYNTHETIC_PROFILE_ID, owner_name: 'Synthetic Operator' },
    });
    const customerViewModel = await buildCustomerBAViewModelThroughVite(retrieve, canonical);
    assert.equal(Object.keys(profileInput.raw_answers).length, 28);
    assert.equal(canonical.intake_answers && Object.keys(canonical.intake_answers).length, 28);
    assert.equal(contractValidation.valid, true, contractValidation.errors.join('; '));
    assert.equal(contract.contract_metadata.contract_version, 'business-engine-contract-v1');

    const resolved = resolveCanonicalBehavioralData(canonicalRecord);
    const expectedRankSignature = rankSignature(resolved.ranked_dimensions);
    assert.equal(rankSignature(draft.behavioral_reality.ranked_dimensions), expectedRankSignature);

    for (const prompt of [executivePrompt, futuresPrompt, oneMovePrompt]) {
      const packet = JSON.parse(prompt.messages[1].content);
      assert.equal(
        rankSignature(packet.canonical_profile_snapshot.ranked_dimensions),
        expectedRankSignature,
      );
      assert.equal(
        packet._packet_integrity.omitted_paths.some(({ path }) => (
          path.startsWith('canonical_profile_snapshot')
          || path.startsWith('business_intelligence_draft.behavioral_reality')
          || path.startsWith('business_intelligence_draft.behavior_business_fusion')
        )),
        false,
      );
    }

    assert.deepEqual(
      draft.behavior_business_fusion.evidence.top_dimensions.map((item) => item.dimension),
      resolved.ranked_dimensions.slice(0, 3).map((item) => item.dimension),
    );
    assert.ok(contract.behavioral_modifier.evidence_sources.length > 0);
    assert.ok(contract.behavioral_modifier.provenance.source_artifact);
    assert.equal(fiveFutures.futures.length, 5);
    assert.equal(fiveFutures.futures.reduce((sum, future) => sum + future.probability, 0), 100);
    assert.equal(oneMove.version, 'one_move_v1');
    assert.ok(contract.one_move.current);
    assert.ok(projection.one_move.available);
    assert.equal(projection.identity.profile_id, SYNTHETIC_PROFILE_ID);
    assert.ok(projection.one_move.available);
    assert.equal(customerViewModel.profile_id, SYNTHETIC_PROFILE_ID);
    assert.equal(customerViewModel.visual_dna.business_assessment_map.data_status, 'available');
    assert.ok(customerViewModel.visual_dna.five_futures_one_move);
    assert.ok(customerViewModel.visual_dna_cards.every((card) => card.generation_allowed === false));
  } finally {
    if (previous === undefined) delete process.env.GPT_RESCORING_ENABLED;
    else process.env.GPT_RESCORING_ENABLED = previous;
  }
});
