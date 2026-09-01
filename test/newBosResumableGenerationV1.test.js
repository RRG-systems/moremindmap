import assert from 'node:assert/strict';
import test from 'node:test';

import { RICH_SYNTHETIC_FIXTURE } from '../src/lib/newBosPersonalityDnaV1/richSyntheticFixture.js';
import { runPersonalityDnaProductionContract } from '../src/lib/newBosPersonalityDnaV1/runtimeOrchestrator.js';
import { createRedisNewBosResumableGenerationStore } from '../api/engine/newBosProductionReadinessV1/resumableGenerationStore.js';
import { authorizeNewBosOperatorInspection } from '../api/engine/newBosProductionReadinessV1/config.js';
import { inspectNewBosResumableRuntimeState } from '../api/engine/newBosProductionReadinessV1/runtimeStateInspector.js';
import { realizePersonalityDnaArtifactBounded } from '../api/engine/newBosProductionReadinessV1/boundedSurfaceRealization.js';
import { runNewBosResumableSemanticGeneration } from '../api/engine/newBosProductionReadinessV1/resumableGenerationOrchestrator.js';
import {
  assembleNewBosReasoningDraftV1,
  buildNewBosResumableCampaignIdentity,
  buildNewBosSemanticStageSchema,
  NEW_BOS_SEMANTIC_STAGES,
} from '../api/engine/newBosProductionReadinessV1/resumableSemanticContract.js';
import { buildNewBosRealizationIdentity, sha256Stable } from '../api/engine/newBosProductionReadinessV1/realizationIdentity.js';

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

test('unconfirmed response-ID custody stops instead of blindly resubmitting', async () => {
  const store = createRedisNewBosResumableGenerationStore({ redis: fakeRedis(), namespace: 'nonprod:new-bos:crash-gap-test' });
  await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:surface_routing', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  const stopped = await store.prepare({ campaignSha256: CAMPAIGN, unitId: 'semantic:surface_routing', unitIdentitySha256: UNIT_IDENTITY, requestSha256: REQUEST });
  assert.equal(stopped.disposition, 'STOP');
  assert.equal(stopped.classification.reason, 'response_id_custody_unconfirmed');
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
    source: 'resumable_checkpoint_classification',
    unit_identity: 'semantic:causal_foundation',
    checkpoint_state: 'HUMAN_REVIEW_REQUIRED',
    review_reason: 'max_output_tokens',
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
