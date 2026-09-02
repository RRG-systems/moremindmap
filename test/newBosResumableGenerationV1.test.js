import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { RICH_SYNTHETIC_FIXTURE } from '../src/lib/newBosPersonalityDnaV1/richSyntheticFixture.js';
import { runPersonalityDnaProductionContract } from '../src/lib/newBosPersonalityDnaV1/runtimeOrchestrator.js';
import { createRedisNewBosResumableGenerationStore } from '../api/engine/newBosProductionReadinessV1/resumableGenerationStore.js';
import { retireStaleNewBosBackgroundResponse } from '../api/engine/newBosProductionReadinessV1/backgroundResponsesTransport.js';
import { authorizeNewBosOperatorInspection } from '../api/engine/newBosProductionReadinessV1/config.js';
import { inspectNewBosResumableRuntimeState } from '../api/engine/newBosProductionReadinessV1/runtimeStateInspector.js';
import { realizePersonalityDnaArtifactBounded } from '../api/engine/newBosProductionReadinessV1/boundedSurfaceRealization.js';
import { runNewBosResumableSemanticGeneration } from '../api/engine/newBosProductionReadinessV1/resumableGenerationOrchestrator.js';
import {
  assembleNewBosReasoningDraftV1,
  buildNewBosResumableCampaignIdentity,
  buildNewBosSemanticStageSchema,
  NEW_BOS_SEMANTIC_STAGES,
  validateNewBosSemanticStageFragment,
} from '../api/engine/newBosProductionReadinessV1/resumableSemanticContract.js';
import { buildNewBosRealizationIdentity, sha256Stable } from '../api/engine/newBosProductionReadinessV1/realizationIdentity.js';
import {
  classifyCompletedStage3ValidationError,
  providerResponseIdSha256,
  sanitizeCompletedStage3ProviderMetadata,
} from '../api/engine/newBosProductionReadinessV1/completedStage3ValidationDiagnostic.js';

function fakeRedis() {
  const values = new Map();
  return {
    values,
    async get(key) {
      return values.get(key) || null;
    },
    async set(key, value, ...args) {
      if (args.includes('NX') && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    },
    async eval(_script, keyCount, ...args) {
      const keys = args.slice(0, keyCount);
      const argv = args.slice(keyCount);
      if (keyCount === 3) {
        if (values.get(keys[0]) !== argv[0]) return 'STAGE3_CHANGED';
        const archive = values.get(keys[1]);
        if (archive && archive !== argv[1]) return 'STAGE3_ARCHIVE_CONFLICT';
        const claim = values.get(keys[2]);
        if (claim && claim !== argv[3]) return 'CLAIM_CONFLICT';
        values.set(keys[1], argv[1]);
        values.set(keys[0], argv[2]);
        values.set(keys[2], argv[3]);
        return 'OK';
      }
      if (values.get(keys[0]) !== argv[0]) return 'STAGE3_CHANGED';
      if (values.get(keys[1]) !== argv[1]) return 'STAGE4_CHANGED';
      const archive3 = values.get(keys[2]);
      if (archive3 && archive3 !== argv[2]) return 'STAGE3_ARCHIVE_CONFLICT';
      const archive4 = values.get(keys[3]);
      if (archive4 && archive4 !== argv[3]) return 'STAGE4_ARCHIVE_CONFLICT';
      const claim = values.get(keys[4]);
      if (claim && claim !== argv[6]) return 'CLAIM_CONFLICT';
      values.set(keys[2], argv[2]);
      values.set(keys[3], argv[3]);
      values.set(keys[0], argv[4]);
      values.set(keys[1], argv[5]);
      values.set(keys[4], argv[6]);
      return 'OK';
    },
  };
}

function splitFixture() {
  const draft = RICH_SYNTHETIC_FIXTURE.interpretationDraft;
  const claims = new Map([...draft.topology, ...draft.attributes, ...draft.dynamics].map((item) => [item.id, item]));
  const surfaceEvidenceRefs = Object.fromEntries(Object.entries(draft.surface_claims).map(([surfaceId, claimIds]) => [
    surfaceId,
    [...new Set(claimIds.flatMap((claimId) => {
      const claim = claims.get(claimId);
      return [...(claim?.evidence_refs || []), ...(claim?.counterevidence_refs || [])];
    }))],
  ]));
  return [
    {
      stage_id: 'causal_foundation',
      fragment: {
        topology: draft.topology,
        attributes: draft.attributes,
        dynamics: draft.dynamics,
        sequences: draft.sequences,
        strengths_and_overuse: draft.strengths_and_overuse,
        compensation: draft.compensation,
      },
    },
    {
      stage_id: 'operating_domains',
      fragment: {
        specialized: Object.fromEntries([
          'version', 'recognition', 'personality_dna', 'operating_engine', 'people_experience', 'communication',
          'strengths_vulnerabilities', 'pressure_conflict', 'work_environment', 'role_seat', 'leadership', 'cognition', 'energy',
        ].map((key) => [key, draft.specialized[key]])),
      },
    },
    {
      stage_id: 'whole_person_decision_synthesis',
      fragment: {
        whole_person: draft.whole_person,
        abstentions: draft.abstentions,
        validation_backlog: draft.validation_backlog,
        specialized: Object.fromEntries([
          'five_futures', 'one_move', 'validation', 'operating_identity', 'visual_bos',
        ].map((key) => [key, draft.specialized[key]])),
      },
    },
    {
      stage_id: 'surface_routing',
      fragment: {
        surface_claims: draft.surface_claims,
        surface_evidence_refs: surfaceEvidenceRefs,
      },
    },
  ];
}

const CAMPAIGN = 'a'.repeat(64);
const UNIT_IDENTITY = 'b'.repeat(64);
const REQUEST = 'c'.repeat(64);

test('four semantic contracts own every final top-level and specialized field exactly once', () => {
  const evidenceIds = RICH_SYNTHETIC_FIXTURE.rawEvidence.evidence.map(({ evidence_id: id }) => id);
  const top = [];
  const specialized = [];
  NEW_BOS_SEMANTIC_STAGES.forEach((stage) => {
    const schema = buildNewBosSemanticStageSchema({ stageId: stage.id, evidenceIds });
    top.push(...Object.keys(schema.properties).filter((key) => key !== 'specialized'));
    if (schema.properties.specialized) specialized.push(...Object.keys(schema.properties.specialized.properties));
  });
  assert.equal(new Set(top).size, top.length);
  assert.equal(new Set(specialized).size, specialized.length);
  assert.equal(top.length, 11);
  assert.equal(specialized.length, 18);
});

test('deterministic assembly reconstructs the unchanged whole-person interpretation contract', () => {
  const assembled = assembleNewBosReasoningDraftV1({ fragments: splitFixture() });
  const expected = { ...RICH_SYNTHETIC_FIXTURE.interpretationDraft };
  delete expected.surface_renderings;
  expected.surface_evidence_refs = splitFixture().find(({ stage_id: id }) => id === 'surface_routing').fragment.surface_evidence_refs;
  assert.deepEqual(assembled, expected);
});

test('stage-3 checkpoint validation enforces the existing vector-free whole-person invariant before acceptance', () => {
  const valid = splitFixture().find(({ stage_id: id }) => id === 'whole_person_decision_synthesis').fragment;
  assert.equal(validateNewBosSemanticStageFragment({
    stageId: 'whole_person_decision_synthesis',
    fragment: valid,
  }), valid);
  for (const forbidden of ['assessment', 'vector', 'dimension', 'structure score', 'measured pattern']) {
    const invalid = structuredClone(valid);
    invalid.whole_person.core_explanation = `This ${forbidden} wording must never enter an accepted checkpoint.`;
    assert.throws(() => validateNewBosSemanticStageFragment({
      stageId: 'whole_person_decision_synthesis',
      fragment: invalid,
    }), new RegExp(`Whole-person model leaked assessment language: ${forbidden}`, 'u'));
  }
});

test('completed stage-3 diagnostic classifies validation without retaining provider content or identifiers', () => {
  const response = {
    id: 'resp_private_completed_stage3',
    status: 'completed',
    model: 'gpt-5.6-sol',
    service_tier: 'priority',
    created_at: 1,
    completed_at: 2,
    output_text: 'private provider content must never enter the receipt',
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
      input_tokens_details: { cached_tokens: 2 },
      output_tokens_details: { reasoning_tokens: 3 },
    },
  };
  const metadata = sanitizeCompletedStage3ProviderMetadata(response);
  assert.equal(metadata.provider_response_id_sha256, providerResponseIdSha256(response.id));
  assert.equal(JSON.stringify(metadata).includes(response.id), false);
  assert.equal(JSON.stringify(metadata).includes(response.output_text), false);
  assert.deepEqual(classifyCompletedStage3ValidationError(
    new Error('Whole-person model leaked assessment language: assessment'),
  ), {
    category: 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION',
    validator: 'assertVectorFreeWholePerson',
    language_class: 'ASSESSMENT_LANGUAGE',
    validation_code_sha256: providerResponseIdSha256('Whole-person model leaked assessment language: assessment'),
  });
  assert.equal(
    classifyCompletedStage3ValidationError(new Error('new_bos_semantic_fragment_key_mismatch:whole_person_decision_synthesis')).category,
    'SCHEMA_SHAPE_REJECTION',
  );
  assert.equal(
    classifyCompletedStage3ValidationError(new Error('new_bos_semantic_stage_invalid_json')).category,
    'OUTPUT_CONTRACT_REJECTION',
  );
  assert.deepEqual(classifyCompletedStage3ValidationError(
    new Error('Whole-person model leaked assessment language: adaptability'),
  ), {
    category: 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION',
    validator: 'assertVectorFreeWholePerson',
    language_class: 'ADAPTABILITY_LANGUAGE',
    validation_code_sha256: providerResponseIdSha256('Whole-person model leaked assessment language: adaptability'),
  });
});

function semanticRejectionHarness({ profileId, sourceHash, namespace }) {
  const rawEvidence = Object.freeze({
    ...RICH_SYNTHETIC_FIXTURE.rawEvidence,
    generation_metadata: Object.freeze({ canonical_source_sha256: sourceHash }),
  });
  const realizationIdentity = buildNewBosRealizationIdentity({
    profileId,
    canonicalSourceSha256: sourceHash,
    rawEvidenceVersion: rawEvidence.version,
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: 'A',
  });
  const governedContext = [{
    retrieved: {
      authorities: [{ id: 1, title: 'Synthetic doctrine', sha256: 'e'.repeat(64), bounded_block: 'Use governed evidence without invention.' }],
    },
  }];
  const redis = fakeRedis();
  return {
    rawEvidence,
    realizationIdentity,
    governedContext,
    store: createRedisNewBosResumableGenerationStore({ redis, namespace }),
    campaign: buildNewBosResumableCampaignIdentity({
      realizationIdentity,
      evidenceIds: rawEvidence.evidence.map(({ evidence_id: id }) => id),
    }),
  };
}

test('fresh vector-free stage-3 rejection persists the typed validator receipt and can never be accepted', async () => {
  const harness = semanticRejectionHarness({
    profileId: 'MM-SYNTHETIC-FRESH-REJECTION',
    sourceHash: '1'.repeat(64),
    namespace: 'nonprod:new-bos:fresh-semantic-rejection-test',
  });
  const fragments = splitFixture();
  const invalidStage3 = structuredClone(fragments[2].fragment);
  invalidStage3.whole_person.core_explanation = 'Adaptability language is prohibited in this customer-facing contract.';
  let creates = 0;
  const client = {
    responses: {
      async create() {
        const fragment = [fragments[0].fragment, fragments[1].fragment, invalidStage3][creates];
        creates += 1;
        return {
          id: `resp_fresh_rejection_${creates}`,
          status: 'completed',
          model: 'gpt-5.6-sol',
          output_text: JSON.stringify(fragment),
          usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
        };
      },
      async retrieve() { throw new Error('fresh result must not use provider retrieval'); },
    },
  };
  await assert.rejects(runNewBosResumableSemanticGeneration({
    ...harness,
    model: 'gpt-5.6-sol',
    client,
    checkpointStore: harness.store,
  }), /Whole-person model leaked assessment language: adaptability/u);
  assert.equal(creates, 3);
  const stage3 = await harness.store.inspect({
    campaignSha256: harness.campaign.sha256,
    unitId: 'semantic:whole_person_decision_synthesis',
  });
  assert.equal(stage3.record.state, 'SEMANTIC_REJECTED');
  assert.equal(stage3.record.observation.status, 'completed');
  assert.equal(stage3.record.attempt, 1);
  assert.equal(stage3.record.semantic_rejection_code, 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION');
  assert.equal(stage3.record.semantic_validator, 'assertVectorFreeWholePerson');
  assert.equal(stage3.record.semantic_rejection_detail, 'ADAPTABILITY_LANGUAGE');
  assert.equal(stage3.classification.state, 'SEMANTIC_REJECTED');
  assert.equal(stage3.classification.reason, 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION');
  await assert.rejects(harness.store.accept({
    campaignSha256: harness.campaign.sha256,
    unitId: 'semantic:whole_person_decision_synthesis',
    unitIdentitySha256: stage3.record.unit_identity_sha256,
    requestSha256: stage3.record.request_sha256,
    value: fragments[2].fragment,
  }), /accept_semantic_rejected/u);
});

test('resumed completed vector-free rejection persists the same typed receipt with zero replacement submission', async () => {
  const harness = semanticRejectionHarness({
    profileId: 'MM-SYNTHETIC-RESUMED-REJECTION',
    sourceHash: '2'.repeat(64),
    namespace: 'nonprod:new-bos:resumed-semantic-rejection-test',
  });
  const fragments = splitFixture();
  const invalidStage3 = structuredClone(fragments[2].fragment);
  invalidStage3.whole_person.core_explanation = 'Adaptability language is prohibited in this resumed customer-facing contract.';
  let creates = 0;
  let retrieves = 0;
  const client = {
    responses: {
      async create() {
        creates += 1;
        if (creates < 3) return {
          id: `resp_resumed_dependency_${creates}`,
          status: 'completed',
          model: 'gpt-5.6-sol',
          output_text: JSON.stringify(fragments[creates - 1].fragment),
        };
        return { id: 'resp_resumed_stage3', status: 'in_progress', model: 'gpt-5.6-sol' };
      },
      async retrieve(responseId) {
        retrieves += 1;
        assert.equal(responseId, 'resp_resumed_stage3');
        return {
          id: responseId,
          status: 'completed',
          model: 'gpt-5.6-sol',
          output_text: JSON.stringify(invalidStage3),
          usage: { input_tokens: 20, output_tokens: 20, total_tokens: 40 },
        };
      },
    },
  };
  await assert.rejects(runNewBosResumableSemanticGeneration({
    ...harness,
    model: 'gpt-5.6-sol',
    client,
    checkpointStore: harness.store,
    interactiveWaitMs: 0,
  }), /new_bos_background_poll_timeout/u);
  await assert.rejects(runNewBosResumableSemanticGeneration({
    ...harness,
    model: 'gpt-5.6-sol',
    client,
    checkpointStore: harness.store,
    interactiveWaitMs: 0,
  }), /Whole-person model leaked assessment language: adaptability/u);
  assert.equal(creates, 3);
  assert.equal(retrieves, 1);
  const stage3 = await harness.store.inspect({
    campaignSha256: harness.campaign.sha256,
    unitId: 'semantic:whole_person_decision_synthesis',
  });
  assert.equal(stage3.record.state, 'SEMANTIC_REJECTED');
  assert.equal(stage3.record.observation.status, 'completed');
  assert.equal(stage3.record.attempt, 1);
  assert.equal(stage3.record.semantic_rejection_code, 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION');
  assert.equal(stage3.record.semantic_validator, 'assertVectorFreeWholePerson');
  assert.equal(stage3.record.semantic_rejection_detail, 'ADAPTABILITY_LANGUAGE');
  assert.equal(stage3.classification.state, 'SEMANTIC_REJECTED');
  assert.equal(stage3.classification.reason, 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION');
});

test('malformed semantic output is typed while provider terminal failure remains a distinct machinery state', async () => {
  const semantic = classifyCompletedStage3ValidationError(
    new Error('new_bos_semantic_fragment_key_mismatch:whole_person_decision_synthesis'),
  );
  assert.equal(semantic.category, 'SCHEMA_SHAPE_REJECTION');
  assert.equal(classifyCompletedStage3ValidationError(
    new Error('new_bos_semantic_stage_invalid_json'),
  ).category, 'OUTPUT_CONTRACT_REJECTION');
  const redis = fakeRedis();
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace: 'nonprod:new-bos:terminal-distinction-test' });
  await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:causal_foundation', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:causal_foundation',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: 'resp_terminal', status: 'incomplete', incomplete_details_reason: 'content_filter' },
  });
  const terminal = await store.inspect({ campaignSha256: CAMPAIGN, unitId: 'semantic:causal_foundation' });
  assert.notEqual(terminal.record.state, 'SEMANTIC_REJECTED');
  assert.equal(terminal.classification.state, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(terminal.classification.reason, 'content_filter');
});

test('one authorized Stage-3 semantic-rejection replacement archives the exact typed attempt and cannot be claimed twice', async () => {
  const redis = fakeRedis();
  const namespace = 'nonprod:new-bos:semantic-rejection-replacement-test';
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace });
  const fragments = splitFixture();
  const preserved = new Map();
  for (const [index, stageId] of ['causal_foundation', 'operating_domains'].entries()) {
    const unitId = `semantic:${stageId}`;
    const unitIdentitySha256 = String(index + 1).repeat(64);
    const requestSha256 = String(index + 3).repeat(64);
    await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256, requestSha256 });
    await store.observe({
      campaignSha256: CAMPAIGN,
      unitId,
      unitIdentitySha256,
      requestSha256,
      event: { provider_response_id: `resp_preserved_${index}`, status: 'completed' },
    });
    await store.accept({
      campaignSha256: CAMPAIGN,
      unitId,
      unitIdentitySha256,
      requestSha256,
      value: fragments[index].fragment,
    });
  }
  for (const [key, value] of redis.values.entries()) {
    if (/semantic:(causal_foundation|operating_domains)$/u.test(key)) preserved.set(key, value);
  }

  const unitId = 'semantic:whole_person_decision_synthesis';
  const unitIdentitySha256 = '7'.repeat(64);
  const requestSha256 = '8'.repeat(64);
  await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256, requestSha256 });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256,
    requestSha256,
    event: {
      provider_response_id: 'resp_stage3_attempt_1',
      status: 'incomplete',
      incomplete_details_reason: 'max_output_tokens',
    },
  });
  const attempt2 = await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256, requestSha256 });
  assert.equal(attempt2.record.attempt, 2);
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256,
    requestSha256,
    event: { provider_response_id: 'resp_stage3_attempt_2', status: 'completed' },
  });
  await store.rejectSemantic({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256,
    requestSha256,
    rejection: {
      category: 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION',
      validator: 'assertVectorFreeWholePerson',
      language_class: 'ADAPTABILITY_LANGUAGE',
      validation_code_sha256: 'd'.repeat(64),
    },
  });
  const rejected = await store.inspect({ campaignSha256: CAMPAIGN, unitId });
  const retired = await store.retireSemanticRejectedStage3AndPrepareReplacement({
    campaignSha256: CAMPAIGN,
    expectedStage3: {
      unit_identity_sha256: unitIdentitySha256,
      request_sha256: requestSha256,
      provider_response_id_sha256: rejected.record.observation.provider_response_id_sha256,
      semantic_validation_code_sha256: 'd'.repeat(64),
    },
    now: new Date('2026-09-02T03:00:00.000Z'),
  });
  assert.equal(retired.disposition, 'START_STAGE3_REPLACEMENT');
  assert.equal(retired.record.attempt, 3);
  assert.equal(retired.record.retry_sequence, 'authorized_stage3_semantic_rejection_replacement');
  assert.equal(retired.record.semantic_rejection_archive_sha256, retired.archive_sha256);
  const archivedEntry = [...redis.values.entries()].find(([key]) => key.includes(':semantic-rejection-archive-v1:attempt:2'));
  assert.ok(archivedEntry);
  const archived = JSON.parse(archivedEntry[1]);
  assert.deepEqual(archived.prior_checkpoint, rejected.record);
  assert.equal(archived.semantic_rejection_code, 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION');
  assert.equal(archived.semantic_validator, 'assertVectorFreeWholePerson');
  assert.equal(archived.semantic_rejection_detail, 'ADAPTABILITY_LANGUAGE');
  assert.equal(archived.replacement_authorized, true);
  for (const [key, value] of preserved) assert.equal(redis.values.get(key), value);
  await assert.rejects(store.retireSemanticRejectedStage3AndPrepareReplacement({
    campaignSha256: CAMPAIGN,
    expectedStage3: {
      unit_identity_sha256: unitIdentitySha256,
      request_sha256: requestSha256,
      provider_response_id_sha256: rejected.record.observation.provider_response_id_sha256,
      semantic_validation_code_sha256: 'd'.repeat(64),
    },
  }), /checkpoint_identity_mismatch/u);
});

test('assembled interpretation runs through the unchanged production runtime validators without provider inference', async () => {
  const artifact = await runPersonalityDnaProductionContract({
    activation: 'synthetic_lab',
    rawEvidence: RICH_SYNTHETIC_FIXTURE.rawEvidence,
    providerModel: 'synthetic-no-provider',
    libraryRetriever: { retrieve: async (selection) => ({ manifest_sha256: selection.manifest_sha256, authorities: selection.authorities }) },
    reasoningProvider: null,
    interpretationDraft: assembleNewBosReasoningDraftV1({ fragments: splitFixture() }),
  });
  assert.equal(artifact.surface_packets.length, 15);
  assert.deepEqual(artifact.whole_person_model.core_explanation, RICH_SYNTHETIC_FIXTURE.interpretationDraft.whole_person.core_explanation);
});

test('campaign identity is deterministic and changes when the final realization identity changes', () => {
  const realization = buildNewBosRealizationIdentity({
    profileId: 'MM-SYNTHETIC-RESUME',
    canonicalSourceSha256: 'd'.repeat(64),
    rawEvidenceVersion: 'synthetic_raw_evidence_v1',
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: 'A',
  });
  const evidenceIds = RICH_SYNTHETIC_FIXTURE.rawEvidence.evidence.map(({ evidence_id: id }) => id);
  const left = buildNewBosResumableCampaignIdentity({ realizationIdentity: realization, evidenceIds });
  const right = buildNewBosResumableCampaignIdentity({ realizationIdentity: realization, evidenceIds });
  assert.equal(left.sha256, right.sha256);
  assert.notEqual(left.sha256, buildNewBosResumableCampaignIdentity({
    realizationIdentity: { ...realization, sha256: 'e'.repeat(64) },
    evidenceIds,
  }).sha256);
});

test('durable unit resumes an exact active response and reuses accepted output', async () => {
  const store = createRedisNewBosResumableGenerationStore({ redis: fakeRedis(), namespace: 'nonprod:new-bos:resumable-test' });
  const initial = await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:causal_foundation', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(initial.disposition, 'START_INITIAL');
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:causal_foundation',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: 'resp_synthetic_active', status: 'in_progress' },
  });
  assert.equal((await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:causal_foundation', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST })).disposition, 'RESUME_EXACT');
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:causal_foundation',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: 'resp_synthetic_active', status: 'completed', usage: { output_tokens: 10 } },
  });
  const value = { topology: [] };
  await store.accept({ campaignSha256: CAMPAIGN, unitId: 'semantic:causal_foundation', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST, value });
  const reused = await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:causal_foundation', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(reused.disposition, 'REUSE_ACCEPTED');
  assert.equal(reused.record.accepted_value_sha256, sha256Stable(value));
  await assert.rejects(store.rejectSemantic({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:causal_foundation',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    rejection: {
      category: 'SCHEMA_SHAPE_REJECTION',
      validator: 'validateNewBosSemanticStageFragment',
      validation_code_sha256: 'f'.repeat(64),
    },
  }), /reject_accepted/u);
  const stillAccepted = await store.inspect({ campaignSha256: CAMPAIGN, unitId: 'semantic:causal_foundation' });
  assert.equal(stillAccepted.record.state, 'ACCEPTED');
  assert.equal(stillAccepted.record.accepted_value_sha256, sha256Stable(value));
});

test('incomplete without a provider reason requires human review and cannot spend retry authority', async () => {
  const store = createRedisNewBosResumableGenerationStore({ redis: fakeRedis(), namespace: 'nonprod:new-bos:incomplete-test' });
  await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:operating_domains', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:operating_domains',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: 'resp_synthetic_incomplete', status: 'incomplete' },
  });
  const stopped = await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:operating_domains', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(stopped.disposition, 'STOP');
  assert.equal(stopped.classification.state, 'HUMAN_REVIEW_REQUIRED');
  assert.equal(stopped.classification.reason, 'incomplete_reason_missing');
});

test('max-output terminal state preserves attempt one and permits exactly one generic replacement', async () => {
  const redis = fakeRedis();
  const namespace = 'nonprod:new-bos:max-output-recovery-test';
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace });
  const unitId = 'semantic:causal_foundation';
  await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: {
      provider_response_id: 'resp_max_output_attempt_one',
      status: 'incomplete',
      incomplete_details_reason: 'max_output_tokens',
      usage: { output_tokens: 64000 },
    },
  });
  const replacement = await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(replacement.disposition, 'START_REPLACEMENT');
  assert.equal(replacement.record.attempt, 2);
  const archive = [...redis.values.entries()].find(([key]) => key.includes(':terminal-archive-v1:attempt:1'));
  assert.ok(archive);
  const archived = JSON.parse(archive[1]);
  assert.equal(archived.observation.status, 'incomplete');
  assert.equal(archived.observation.incomplete_details_reason, 'max_output_tokens');
  assert.equal(archived.replacement_authorized, true);

  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: {
      provider_response_id: 'resp_max_output_attempt_two',
      status: 'incomplete',
      incomplete_details_reason: 'max_output_tokens',
      usage: { output_tokens: 64000 },
    },
  });
  const exhausted = await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(exhausted.disposition, 'STOP');
  assert.equal(exhausted.classification.state, 'TERMINAL_EXHAUSTED');
  assert.equal(exhausted.classification.reason, 'max_output_tokens');
});

test('documented transient machinery failure permits exactly one replacement', async () => {
  const store = createRedisNewBosResumableGenerationStore({ redis: fakeRedis(), namespace: 'nonprod:new-bos:retry-test' });
  const unitId = 'surface:this_is_you';
  await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  await store.observe({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST, event: { status: 'failed', error_code: 'service_unavailable' } });
  assert.equal((await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST })).disposition, 'START_REPLACEMENT');
  await store.observe({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST, event: { status: 'failed', error_code: 'service_unavailable' } });
  const exhausted = await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(exhausted.disposition, 'STOP');
  assert.equal(exhausted.classification.state, 'TERMINAL_EXHAUSTED');
});

test('exact max-output then server-error sequence permits one third-and-final attempt', async () => {
  const redis = fakeRedis();
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace: 'nonprod:new-bos:final-sequence-retry-test' });
  const unitId = 'semantic:causal_foundation';

  await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: {
      provider_response_id: 'resp_sequence_attempt_one',
      status: 'incomplete',
      incomplete_details_reason: 'max_output_tokens',
    },
  });
  assert.equal((await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST })).record.attempt, 2);
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: {
      provider_response_id: 'resp_sequence_attempt_two',
      status: 'failed',
      error_code: 'server_error',
    },
  });

  const review = await store.inspect({ campaignSha256: CAMPAIGN, unitId });
  assert.equal(review.classification.disposition, 'START_REPLACEMENT');
  assert.equal(review.classification.retry_sequence, 'max_output_tokens_to_server_error');
  assert.equal(review.classification.final_attempt, 3);

  const finalAttempt = await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(finalAttempt.disposition, 'START_REPLACEMENT');
  assert.equal(finalAttempt.record.attempt, 3);
  assert.equal(finalAttempt.record.retry_sequence, 'max_output_tokens_to_server_error');
  const attemptTwoArchive = [...redis.values.entries()].find(([key]) => key.includes(':terminal-archive-v1:attempt:2'));
  assert.ok(attemptTwoArchive);
  assert.equal(JSON.parse(attemptTwoArchive[1]).observation.error_code, 'server_error');

  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: {
      provider_response_id: 'resp_sequence_attempt_three',
      status: 'failed',
      error_code: 'server_error',
    },
  });
  const exhausted = await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(exhausted.disposition, 'STOP');
  assert.equal(exhausted.classification.state, 'TERMINAL_EXHAUSTED');
  assert.equal(exhausted.classification.reason, 'server_error');
});

test('third-attempt authority is denied for any other two-attempt sequence', async () => {
  const redis = fakeRedis();
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace: 'nonprod:new-bos:other-sequence-stop-test' });
  const unitId = 'semantic:causal_foundation';

  await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: 'resp_other_attempt_one', status: 'failed', error_code: 'service_unavailable' },
  });
  await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId,
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: 'resp_other_attempt_two', status: 'failed', error_code: 'server_error' },
  });

  const stopped = await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(stopped.disposition, 'STOP');
  assert.equal(stopped.classification.state, 'TERMINAL_EXHAUSTED');
  assert.equal(stopped.classification.reason, 'server_error');
  assert.equal([...redis.values.keys()].some((key) => key.includes(':terminal-archive-v1:attempt:2')), false);
});

test('unconfirmed response-ID custody stops instead of blindly resubmitting', async () => {
  const store = createRedisNewBosResumableGenerationStore({ redis: fakeRedis(), namespace: 'nonprod:new-bos:crash-gap-test' });
  await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:surface_routing', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  const stopped = await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:surface_routing', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(stopped.disposition, 'STOP');
  assert.equal(stopped.classification.reason, 'response_id_custody_unconfirmed');
});

test('stale queued surface-routing can be retired exactly once without touching accepted semantic checkpoints', async () => {
  const redis = fakeRedis();
  const namespace = 'nonprod:new-bos:stale-surface-routing-test';
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace });
  for (const [index, stageId] of ['causal_foundation', 'operating_domains', 'whole_person_decision_synthesis'].entries()) {
    const unitId = `semantic:${stageId}`;
    const unitIdentitySha256 = String(index + 1).repeat(64);
    const requestSha256 = String(index + 4).repeat(64);
    await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256, requestSha256 });
    await store.observe({
      campaignSha256: CAMPAIGN,
      unitId,
      unitIdentitySha256,
      requestSha256,
      event: { provider_response_id: `resp_${stageId}`, status: 'completed' },
    });
    await store.accept({
      campaignSha256: CAMPAIGN,
      unitId,
      unitIdentitySha256,
      requestSha256,
      value: splitFixture()[index].fragment,
    });
  }
  const acceptedBefore = new Map([...redis.values.entries()].filter(([key]) => /semantic:(causal_foundation|operating_domains|whole_person_decision_synthesis)$/u.test(key)));
  const responseId = 'resp_stale_surface_routing';
  await store.prepare({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
  });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: responseId, status: 'queued' },
  });
  const responseIdSha256 = crypto.createHash('sha256').update(responseId).digest('hex');
  const claimed = await store.claimStaleQueuedReplacement({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    expectedProviderResponseIdSha256: responseIdSha256,
    now: new Date(Date.now() + 31 * 60 * 1000),
  });
  assert.equal(claimed.responseId, responseId);
  const repeatedClaim = await store.claimStaleQueuedReplacement({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    expectedProviderResponseIdSha256: responseIdSha256,
    now: new Date(Date.now() + 32 * 60 * 1000),
  });
  assert.deepEqual(repeatedClaim.claim, claimed.claim);
  await assert.rejects(() => store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: responseId, status: 'in_progress' },
  }), /new_bos_stale_queue_replacement_claim_active/u);
  const replacement = await store.retireStaleQueuedAndPrepareReplacement({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    expectedProviderResponseIdSha256: responseIdSha256,
    cancellation: { provider_response_id: responseId, status: 'cancelled' },
  });
  assert.equal(replacement.disposition, 'START_REPLACEMENT');
  assert.equal(replacement.record.attempt, 2);
  assert.equal(replacement.record.retry_sequence, 'stale_queued_external_response');
  for (const [key, value] of acceptedBefore) assert.equal(redis.values.get(key), value);
  assert.equal([...redis.values.keys()].filter((key) => key.includes(':stale-active-archive-v1:attempt:1')).length, 1);

  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
    event: { provider_response_id: 'resp_replacement', status: 'failed', error_code: 'server_error' },
  });
  const stopped = await store.prepare({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: UNIT_IDENTITY,
    requestSha256: REQUEST,
  });
  assert.equal(stopped.disposition, 'STOP');
  assert.equal(stopped.classification.state, 'TERMINAL_EXHAUSTED');
});

test('provider retirement cancels only active exact responses and preserves completed work', async () => {
  const calls = [];
  const activeClient = {
    responses: {
      async retrieve(responseId) { calls.push(['retrieve', responseId]); return { id: responseId, status: 'queued' }; },
      async cancel(responseId) { calls.push(['cancel', responseId]); return { id: responseId, status: 'cancelled' }; },
    },
  };
  const retired = await retireStaleNewBosBackgroundResponse({ client: activeClient, responseId: 'resp_exact' });
  assert.equal(retired.disposition, 'RETIRE_CANCELLED');
  assert.deepEqual(calls, [['retrieve', 'resp_exact'], ['cancel', 'resp_exact']]);

  const completedClient = {
    responses: {
      async retrieve(responseId) { return { id: responseId, status: 'completed', output_text: '{}' }; },
      async cancel() { throw new Error('completed response must not be cancelled'); },
    },
  };
  const completed = await retireStaleNewBosBackgroundResponse({ client: completedClient, responseId: 'resp_completed' });
  assert.equal(completed.disposition, 'PRESERVE_COMPLETED');
  assert.equal(completed.provider_response.status, 'completed');
});

test('invalid accepted stage 3 and its stage-4 dependency retire atomically while stages 1-2 remain byte-identical', async () => {
  const redis = fakeRedis();
  const namespace = 'nonprod:new-bos:invalid-stage3-repair-test';
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace });
  const fragments = splitFixture();
  for (const [index, stageId] of ['causal_foundation', 'operating_domains'].entries()) {
    const unitId = `semantic:${stageId}`;
    const unitIdentitySha256 = String(index + 1).repeat(64);
    const requestSha256 = String(index + 3).repeat(64);
    await store.prepare({ campaignSha256: CAMPAIGN, unitId, unitIdentitySha256, requestSha256 });
    await store.observe({
      campaignSha256: CAMPAIGN,
      unitId,
      unitIdentitySha256,
      requestSha256,
      event: { provider_response_id: `resp_${stageId}`, status: 'completed' },
    });
    await store.accept({
      campaignSha256: CAMPAIGN,
      unitId,
      unitIdentitySha256,
      requestSha256,
      value: fragments[index].fragment,
    });
  }
  const stage12Before = new Map([...redis.values.entries()].filter(([key]) => /semantic:(causal_foundation|operating_domains)$/u.test(key)));
  const stage3Identity = '7'.repeat(64);
  const stage3Request = '8'.repeat(64);
  const invalidStage3 = structuredClone(fragments[2].fragment);
  invalidStage3.whole_person.core_explanation = 'This assessment language is invalid customer meaning.';
  await store.prepare({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:whole_person_decision_synthesis',
    unitIdentitySha256: stage3Identity,
    requestSha256: stage3Request,
  });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:whole_person_decision_synthesis',
    unitIdentitySha256: stage3Identity,
    requestSha256: stage3Request,
    event: { provider_response_id: 'resp_invalid_stage3', status: 'completed' },
  });
  const stage3Accepted = await store.accept({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:whole_person_decision_synthesis',
    unitIdentitySha256: stage3Identity,
    requestSha256: stage3Request,
    value: invalidStage3,
  });

  const stage4Identity = '9'.repeat(64);
  const stage4Request = 'a'.repeat(64);
  await store.prepare({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: stage4Identity,
    requestSha256: stage4Request,
  });
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: stage4Identity,
    requestSha256: stage4Request,
    event: { provider_response_id: 'resp_stage4_attempt1', status: 'incomplete', incomplete_details_reason: 'max_output_tokens' },
  });
  const stage4Attempt2 = await store.prepare({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: stage4Identity,
    requestSha256: stage4Request,
  });
  assert.equal(stage4Attempt2.record.attempt, 2);
  await store.observe({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: stage4Identity,
    requestSha256: stage4Request,
    event: { provider_response_id: 'resp_stage4_attempt2', status: 'completed' },
  });
  const stage4Accepted = await store.accept({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: stage4Identity,
    requestSha256: stage4Request,
    value: fragments[3].fragment,
  });

  const retired = await store.retireInvalidStage3AndDependentStage4({
    campaignSha256: CAMPAIGN,
    expectedStage3: {
      unit_identity_sha256: stage3Identity,
      request_sha256: stage3Request,
      accepted_value_sha256: stage3Accepted.accepted_value_sha256,
    },
    expectedStage4: {
      unit_identity_sha256: stage4Identity,
      request_sha256: stage4Request,
      accepted_value_sha256: stage4Accepted.accepted_value_sha256,
    },
    failureCode: 'Whole-person model leaked assessment language: assessment',
  });
  assert.equal(retired.stage3.attempt, 2);
  assert.equal(retired.stage4.state, 'DEPENDENCY_INVALIDATED');
  assert.equal(retired.stage4.next_attempt, 3);
  for (const [key, value] of stage12Before) assert.equal(redis.values.get(key), value);
  assert.equal([...redis.values.keys()].filter((key) => key.includes(':invalid-semantic-archive-v1')).length, 2);

  const newStage4Identity = 'b'.repeat(64);
  const newStage4Request = 'c'.repeat(64);
  const stage4Replacement = await store.prepare({
    campaignSha256: CAMPAIGN,
    unitId: 'semantic:surface_routing',
    unitIdentitySha256: newStage4Identity,
    requestSha256: newStage4Request,
  });
  assert.equal(stage4Replacement.disposition, 'START_REPLACEMENT');
  assert.equal(stage4Replacement.record.attempt, 3);
  assert.equal(stage4Replacement.record.unit_identity_sha256, newStage4Identity);
  assert.equal(stage4Replacement.record.retry_sequence, 'stage3_vector_free_dependency_replacement');
});

test('all 15 accepted surface checkpoints survive restart and suppress regeneration', async () => {
  const interpreted = assembleNewBosReasoningDraftV1({ fragments: splitFixture() });
  const base = await runPersonalityDnaProductionContract({
    activation: 'synthetic_lab',
    rawEvidence: RICH_SYNTHETIC_FIXTURE.rawEvidence,
    providerModel: 'synthetic-no-provider',
    libraryRetriever: { retrieve: async (selection) => ({ manifest_sha256: selection.manifest_sha256, authorities: selection.authorities }) },
    reasoningProvider: null,
    interpretationDraft: interpreted,
  });
  const subjectToken = 'REAL-PDNV1-MM-SYNTHETIC-RESUME';
  const wholePersonModel = Object.freeze({ ...base.whole_person_model, subject_token: subjectToken });
  const artifact = Object.freeze({
    ...base,
    real_profile_gate: true,
    profile_id: 'MM-SYNTHETIC-RESUME',
    subject_token: subjectToken,
    whole_person_model: wholePersonModel,
    personality_dna: Object.freeze({ ...base.personality_dna, subject_token: subjectToken }),
    raw_evidence: Object.freeze({
      ...base.raw_evidence,
      synthetic: false,
      real_profile_gate: true,
      profile_id: 'MM-SYNTHETIC-RESUME',
      subject_token: subjectToken,
    }),
    surface_packets: Object.freeze(base.surface_packets.map((packet) => Object.freeze({
      ...packet,
      whole_person_model: wholePersonModel,
      resolved_local_truth: Object.freeze({
        ...packet.resolved_local_truth,
        subject_token: subjectToken,
        whole_person_model: wholePersonModel,
      }),
    }))),
  });
  const redis = fakeRedis();
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace: 'nonprod:new-bos:surface-restart-test' });
  let calls = 0;
  const surfaceRealizer = {
    async realize({ surface_id: surfaceId }) {
      calls += 1;
      return {
        customer_prose: `This governed ${surfaceId.replaceAll('_', ' ')} view connects the whole person to the evidence already preserved in this synthetic map.`,
        generation: {
          provider_response_id: `resp_${surfaceId}`,
          returned_model: 'gpt-5.6-sol',
          usage: { input_tokens: 1, output_tokens: 1, reasoning_tokens: 0 },
        },
      };
    },
  };
  const campaignIdentity = { sha256: 'f'.repeat(64) };
  const first = await realizePersonalityDnaArtifactBounded({
    artifact,
    providerModel: 'gpt-5.6-sol',
    surfaceRealizer,
    checkpointStore: store,
    campaignIdentity,
  });
  assert.equal(calls, 15);
  const second = await realizePersonalityDnaArtifactBounded({
    artifact,
    providerModel: 'gpt-5.6-sol',
    surfaceRealizer,
    checkpointStore: store,
    campaignIdentity,
  });
  assert.equal(calls, 15);
  assert.equal(first.surface_packets.length, 15);
  assert.equal(sha256Stable(first.surface_packets), sha256Stable(second.surface_packets));
});

test('four-stage provider execution resumes entirely from accepted semantic checkpoints', async () => {
  const redis = fakeRedis();
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace: 'nonprod:new-bos:semantic-restart-test' });
  const fragments = splitFixture();
  const rawEvidence = Object.freeze({
    ...RICH_SYNTHETIC_FIXTURE.rawEvidence,
    generation_metadata: Object.freeze({ canonical_source_sha256: 'd'.repeat(64) }),
  });
  const realizationIdentity = buildNewBosRealizationIdentity({
    profileId: 'MM-SYNTHETIC-STAGES',
    canonicalSourceSha256: 'd'.repeat(64),
    rawEvidenceVersion: rawEvidence.version,
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: 'A',
  });
  let creates = 0;
  const client = {
    responses: {
      async create() {
        const fragment = fragments[creates].fragment;
        creates += 1;
        return {
          id: `resp_semantic_${creates}`,
          status: 'completed',
          model: 'gpt-5.6-sol',
          output_text: JSON.stringify(fragment),
          usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20, output_tokens_details: { reasoning_tokens: 2 } },
        };
      },
      async retrieve() {
        throw new Error('accepted semantic checkpoints must not retrieve provider responses');
      },
    },
  };
  const governedContext = [{
    retrieved: {
      authorities: [{ id: 1, title: 'Synthetic doctrine', sha256: 'e'.repeat(64), bounded_block: 'Use governed evidence without invention.' }],
    },
  }];
  const first = await runNewBosResumableSemanticGeneration({
    rawEvidence,
    governedContext,
    realizationIdentity,
    model: 'gpt-5.6-sol',
    client,
    checkpointStore: store,
  });
  assert.equal(creates, 4);
  assert.equal(first.accepted_stages.length, 4);
  assert.equal(first.campaign_provider_submissions, 4);
  assert.equal(first.provider_submissions, 4);
  const second = await runNewBosResumableSemanticGeneration({
    rawEvidence,
    governedContext,
    realizationIdentity,
    model: 'gpt-5.6-sol',
    client,
    checkpointStore: store,
  });
  assert.equal(creates, 4);
  assert.equal(second.campaign_provider_submissions, 4);
  assert.equal(second.provider_submissions, 0);
  assert.equal(second.interpretation_draft_sha256, first.interpretation_draft_sha256);
  assert.deepEqual(second.interpretation_draft, first.interpretation_draft);
});

test('operator inspection replays the exact campaign and exposes only sanitized runtime metadata', async () => {
  const redis = fakeRedis();
  const namespace = 'nonprod:new-bos:runtime-inspector-test';
  const store = createRedisNewBosResumableGenerationStore({ redis, namespace });
  const rawEvidence = Object.freeze({
    ...RICH_SYNTHETIC_FIXTURE.rawEvidence,
    profile_id: 'MM-SYNTHETIC-INSPECTOR',
    generation_metadata: Object.freeze({ canonical_source_sha256: '7'.repeat(64) }),
  });
  const realizationIdentity = buildNewBosRealizationIdentity({
    profileId: rawEvidence.profile_id,
    canonicalSourceSha256: rawEvidence.generation_metadata.canonical_source_sha256,
    rawEvidenceVersion: rawEvidence.version,
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: 'A',
  });
  const evidenceIds = rawEvidence.evidence.map(({ evidence_id: id }) => id);
  const campaign = buildNewBosResumableCampaignIdentity({ realizationIdentity, evidenceIds });
  await store.prepare({
    campaignSha256: campaign.sha256,
    unitId: 'semantic:causal_foundation',
    unitIdentitySha256: '8'.repeat(64),
    requestSha256: '9'.repeat(64),
  });
  await store.observe({
    campaignSha256: campaign.sha256,
    unitId: 'semantic:causal_foundation',
    unitIdentitySha256: '8'.repeat(64),
    requestSha256: '9'.repeat(64),
    event: {
      provider_response_id: 'resp_must_not_escape',
      status: 'incomplete',
      incomplete_details_reason: 'max_output_tokens',
      usage: { input_tokens: 100, output_tokens: 200, customer_payload: 'must-not-escape' },
    },
  });
  const result = await inspectNewBosResumableRuntimeState({
    config: { namespace },
    redisUrl: 'rediss://operator:super-secret@example.invalid:6380/2',
    rawEvidence,
    realizationIdentity,
    realizationInspection: { state: 'missing', pointer: null, current: null },
    checkpointStore: store,
  });
  assert.equal(result.campaign_sha256, campaign.sha256);
  assert.equal(result.units.length, 19);
  assert.deepEqual(result.recovery_review_provenance, {
    source: 'resumable_checkpoint_recovery',
    unit_identity: 'semantic:causal_foundation',
    checkpoint_state: 'TERMINAL_RETRYABLE',
    recovery_disposition: 'START_REPLACEMENT',
    reason: 'max_output_tokens',
  });
  assert.equal(result.units[0].attempt, 1);
  assert.equal(result.units[0].provider_terminal_status, 'incomplete');
  assert.deepEqual(result.units[0].usage, { input_tokens: 100, output_tokens: 200 });
  assert.equal(result.redis_binding.database_index, '2');
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /resp_must_not_escape|super-secret|operator@example|customer_payload|must-not-escape/u);
  assert.doesNotMatch(serialized, /"accepted_value":/u);
});

test('operator inspection requires the existing exact canary-token authority even when customers are active', () => {
  const config = { staged: true, customerActive: true, accessToken: 'operator-token' };
  assert.equal(authorizeNewBosOperatorInspection({
    config,
    profileId: 'mm-synthetic-inspector',
    suppliedToken: 'operator-token',
  }), 'MM-SYNTHETIC-INSPECTOR');
  assert.throws(() => authorizeNewBosOperatorInspection({
    config,
    profileId: 'MM-SYNTHETIC-INSPECTOR',
    suppliedToken: 'wrong-token',
  }), /new_bos_operator_inspection_access_denied/u);
  assert.equal(authorizeNewBosOperatorInspection({
    config,
    profileId: 'MM-SYNTHETIC-INSPECTOR',
    platformProtected: true,
  }), 'MM-SYNTHETIC-INSPECTOR');
});
