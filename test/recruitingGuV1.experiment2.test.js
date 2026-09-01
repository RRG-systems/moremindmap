import test from 'node:test';
import assert from 'node:assert/strict';

import { createRecruitingGuV1DemoRuntime } from '../api/engine/recruitingGuV1/demoRuntime.js';
import { createRecruitingGuExperiment2OpenAiTransport } from '../api/engine/recruitingGuV1/openAiTransport.js';
import { createSyntheticPurposeRankedContext } from '../api/engine/recruitingGuV1/purposeRankedContext.js';
import { createSyntheticAuthoredSurfaces } from '../api/engine/recruitingGuV1/authoredSurfaces.js';
import {
  RECRUITING_GU_EXPERIMENT_2_CONDITIONS,
  RECRUITING_GU_EXPERIMENT_2_VERSION,
  validateRecruitingGuCoachMove,
} from '../src/lib/recruitingGuV1/experiment2Contract.js';
import { createPatriciaReadOnlyRedis } from '../api/engine/recruitingGuV1/readOnlyCanonicalRedis.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';

function planFor(payload) {
  const object = payload.governedReality.objects[0];
  const type = object.kind === 'PERSON' ? 'PERSON' : object.kind === 'TIME_SERIES' ? 'LINE_CHART' : 'PLAIN_LANGUAGE';
  return {
    planVersion: payload.planVersion,
    stateBinding: payload.exactStateBinding,
    purpose: { humanWords: payload.currentHumanPurpose, interpretedPurpose: payload.currentHumanPurpose, meetingNeed: 'See one governed idea.', materiallyChanged: false },
    guidance: { eyebrow: 'CURRENT READ', headline: 'One governed idea', summary: 'The evidence supports one revisable view.', nextCue: 'What do you notice?', whyThisEnvironment: 'The visual clarifies the meaning.' },
    hypotheses: [],
    blocks: [{ blockId: 'block-one-governed-view', type, title: 'One governed view', subtitle: 'No fact is added.', objectIds: [object.id], evidenceIds: object.sourceIds?.slice(0, 1) || [], emphasis: 'PRIMARY', reason: 'The meaning benefits from being seen.' }],
    interactions: ['SHOW_EVIDENCE'],
    completion: { recommendation: 'CONTINUE', ready: false, summary: 'Keep thinking together.', nextStep: 'Answer the question.' },
  };
}

function transportFactory({ visual = false, captures = [] } = {}) {
  return async ({ messages, schemaName }) => {
    const payload = JSON.parse(messages[1].content);
    captures.push({ schemaName, payload });
    if (schemaName === 'more_recruiting_gu_v1_experiment_2_coach_move') return {
      parsed: {
        version: RECRUITING_GU_EXPERIMENT_2_VERSION,
        insight: 'Jordan may protect quality by keeping important work close.',
        explanation: 'That strength can build trust and can also keep the business dependent on one person.',
        selfDiscoveryQuestion: 'Where does that protect the work, and where does it begin to limit Jordan?',
        visual: { materiallyHelps: visual, semanticIdea: visual ? 'Show the supported person-level tradeoff without claiming business cause.' : null },
      },
      receipt: { modelReturned: 'openai/gpt-5.6-luna', providerReturned: 'OpenAI', latencyMs: 11, store: false },
    };
    if (schemaName === 'more_recruiting_gu_v1_plan_proposal') throw new Error('PLAN_NOT_USED');
    return { parsed: planFor(payload), receipt: { modelReturned: 'openai/gpt-5.6-luna', providerReturned: 'OpenAI', latencyMs: 13, store: false } };
  };
}

async function openYou(runtime) {
  let result = await runtime.openSubject('SYNTHETIC');
  result = await runtime.mutate(result.session.session_id, 'CHANGE_ROOM', { room: 'YOU', expected_revision: result.session.revision });
  return result;
}

test('Experiment 2 preserves four independently runnable ablation conditions', async () => {
  for (const condition of Object.values(RECRUITING_GU_EXPERIMENT_2_CONDITIONS)) {
    const captures = [];
    const runtime = createRecruitingGuV1DemoRuntime({ experimentCondition: condition, frontierTransport: transportFactory({ captures }) });
    let result = await openYou(runtime);
    result = await runtime.mutate(result.session.session_id, 'CHAT', {
      message: 'What should I understand about this person that might not be obvious at first?',
      actor: 'MANAGER',
      expected_revision: result.session.revision,
    });
    if (condition === RECRUITING_GU_EXPERIMENT_2_CONDITIONS.CONTROL) {
      assert.ok(result.session.current_projection);
      assert.equal(captures[0].schemaName, 'more_recruiting_v2_surface_plan_003a');
    } else {
      assert.equal(result.session.current_projection, null);
      assert.equal(result.session.current_coach_move.condition, condition);
      assert.equal(captures[0].schemaName, 'more_recruiting_gu_v1_experiment_2_coach_move');
      assert.equal(Boolean(captures[0].payload.purposeRankedUnderstanding), condition !== RECRUITING_GU_EXPERIMENT_2_CONDITIONS.SPLIT);
      assert.equal(captures[0].payload.demonstrations.length, condition === RECRUITING_GU_EXPERIMENT_2_CONDITIONS.DEMONSTRATIONS ? 3 : 0);
    }
  }
});

test('coach turn survives independently and optional compiler adds no duplicate chat turn', async () => {
  const runtime = createRecruitingGuV1DemoRuntime({ frontierTransport: transportFactory({ visual: true }) });
  let result = await openYou(runtime);
  result = await runtime.mutate(result.session.session_id, 'CHAT', {
    message: 'What could be one of their biggest strengths?', actor: 'MANAGER', expected_revision: result.session.revision,
  });
  assert.equal(result.visual_requested, true);
  assert.equal(result.session.conversation.length, 2);
  assert.equal(result.session.current_projection, null);
  const coachRevision = result.session.revision;
  result = await runtime.mutate(result.session.session_id, 'COMPILE_GU', {
    coach_move_id: result.coach_move_id, expected_revision: coachRevision,
  });
  assert.ok(result.session.current_projection);
  assert.equal(result.session.conversation.length, 2);
  assert.equal(result.session.current_projection.coach_move_id, result.session.current_coach_move.coach_move_id);
});

test('purpose-ranked YOU is BOS-only and BUSINESS selects no more than two verified bibles', async () => {
  const authoredSurfaces = createSyntheticAuthoredSurfaces();
  const you = await createSyntheticPurposeRankedContext({ room: 'YOU', purpose: 'What is not obvious about this person?', authoredSurfaces });
  assert.ok(you.context.governedBos);
  assert.equal(you.context.governedBa, null);
  assert.equal(you.context.firstPartyAnswers.ba.length, 0);
  assert.equal(you.context.realEstateAuthorities.length, 0);
  const business = await createSyntheticPurposeRankedContext({ room: 'YOUR_BUSINESS', purpose: 'What opportunity and capacity issue may be holding growth back?', authoredSurfaces });
  assert.ok(business.context.governedBos);
  assert.ok(business.context.governedBa);
  assert.ok(business.context.realEstateAuthorities.length > 0);
  assert.ok(business.context.realEstateAuthorities.length <= 2);
  assert.ok(business.receipt.contextCharacters < 100_000);
});

test('coach validator refuses invented numbers and verbatim protected first-party answers', () => {
  const purposeContext = { firstPartyAnswers: { bos: [{ answer: 'I have not told my team how exhausted I feel every night.' }], ba: [] } };
  const validation = validateRecruitingGuCoachMove({
    candidate: {
      version: RECRUITING_GU_EXPERIMENT_2_VERSION,
      insight: 'I have not told my team how exhausted I feel every night.',
      explanation: 'Revenue will improve by 47%.',
      selfDiscoveryQuestion: 'What feels important?',
      visual: { materiallyHelps: false, semanticIdea: null },
    },
    governedWorld: {},
    purposeContext,
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes('COACH_MOVE_PROTECTED_ANSWER_EXPOSURE'));
  assert.ok(validation.errors.includes('COACH_MOVE_INVENTED_NUMERIC_CLAIM:47%'));
});

test('coach validator repairs an incomplete visible thought instead of publishing truncation', () => {
  const validation = validateRecruitingGuCoachMove({
    candidate: {
      version: RECRUITING_GU_EXPERIMENT_2_VERSION,
      insight: 'The opportunity may be stronger, while the missing piece is',
      explanation: 'The evidence supports a bounded comparison.',
      selfDiscoveryQuestion: 'What would help you test that?',
      visual: { materiallyHelps: false, semanticIdea: null },
    },
    governedWorld: {},
    purposeContext: null,
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes('COACH_MOVE_INSIGHT_COMPLETE_SENTENCE_REQUIRED'));
});

test('temporary subject tabs expose no Patricia profile ID and Patricia fails closed without the canonical reader', async () => {
  const runtime = createRecruitingGuV1DemoRuntime({ frontierTransport: transportFactory() });
  const home = await runtime.home();
  assert.deepEqual(home.experiment_subjects.map((item) => item.label), ['SYNTHETIC', 'PATRICIA']);
  assert.equal(JSON.stringify(home.experiment_subjects).includes('mm-20260708-dsst020z'), false);
  await assert.rejects(() => runtime.openSubject('PATRICIA'), /PATRICIA_READ_ONLY_REDIS_REQUIRED/u);
});

test('demo reset is subject-scoped, returns a no-mutation receipt, and restores a fresh subject baseline', async () => {
  const runtime = createRecruitingGuV1DemoRuntime({ frontierTransport: transportFactory() });
  const opened = await runtime.openSubject('SYNTHETIC');
  const reset = await runtime.reset('SYNTHETIC');
  assert.deepEqual(reset, {
    reset: true,
    subject: 'SYNTHETIC',
    external_mutation: false,
    canonical_mutation: false,
  });
  await assert.rejects(() => runtime.read(opened.session.session_id), /SESSION_NOT_FOUND/u);
  const fresh = await runtime.openSubject('SYNTHETIC');
  assert.notEqual(fresh.session.session_id, opened.session.session_id);
  assert.equal(fresh.session.current_room, 'HOME');
  assert.equal(fresh.session.revision, 1);
});

test('Patricia demo reset deletes only Patricia session state and cannot touch canonical authority', async () => {
  const state = createEmptyRecruitingState();
  state.shared_business_sessions = {
    session_patricia_demo: {
      session_id: 'session_patricia_demo',
      relationship_id: 'rel-experiment-2-darren-patricia-read-only',
      status: 'ACTIVE',
    },
    session_synthetic_demo: {
      session_id: 'session_synthetic_demo',
      relationship_id: 'rel-synthetic-darren-jordan-v2',
      status: 'ACTIVE',
    },
  };
  const store = new InMemoryRecruitingStore(state);
  const runtime = createRecruitingGuV1DemoRuntime({ store, frontierTransport: transportFactory() });

  const receipt = await runtime.reset('PATRICIA');
  assert.deepEqual(receipt, {
    reset: true,
    subject: 'PATRICIA',
    external_mutation: false,
    canonical_mutation: false,
  });
  const after = await store.read();
  assert.equal(after.shared_business_sessions.session_patricia_demo, undefined);
  assert.equal(after.shared_business_sessions.session_synthetic_demo.relationship_id, 'rel-synthetic-darren-jordan-v2');
});

test('Patricia Redis projection permits only profile-scoped reads and forwards zero writes', async () => {
  const values = new Map([
    ['business_assessment_by_profile:mm-20260708-dsst020z', 'ba-20260714-64ca0783'],
    ['business_assessment:ba-20260714-64ca0783', '{"status":"complete"}'],
  ]);
  const forwarded = { get: 0, set: 0, eval: 0 };
  const redis = {
    async get(key) { forwarded.get += 1; return values.get(key) || null; },
    async set() { forwarded.set += 1; return 'OK'; },
    async eval() { forwarded.eval += 1; return 1; },
  };
  const readOnly = createPatriciaReadOnlyRedis({
    redis,
    profileId: 'mm-20260708-dsst020z',
    bosNamespace: 'nonprod:new-bos:production-canary:v1',
    baNamespace: 'nonprod:new-ba:v1',
  });
  assert.equal(await readOnly.get('business_assessment_by_profile:mm-20260708-dsst020z'), 'ba-20260714-64ca0783');
  assert.equal(await readOnly.get('business_assessment:ba-20260714-64ca0783'), '{"status":"complete"}');
  await assert.rejects(() => readOnly.get('vault:profile:mm-20260617-ybnwt0ks'), /KEY_SCOPE_DENIED/u);
  assert.throws(() => readOnly.set('anything', 'value'), /WRITE_DENIED/u);
  assert.throws(() => readOnly.eval('return 1', 0), /WRITE_DENIED/u);
  assert.deepEqual(forwarded, { get: 2, set: 0, eval: 0 });
  assert.equal(readOnly.audit().write_commands_forwarded, 0);
  assert.equal(readOnly.audit().canonical_mutation, false);
});

test('Experiment 2 uses direct OpenAI Responses with one fixed strict no-store configuration', async () => {
  let captured;
  const client = {
    responses: {
      async create(request) {
        captured = request;
        return {
          id: 'resp_experiment_2_test',
          status: 'completed',
          model: 'gpt-5.6-sol',
          output_text: JSON.stringify({ ok: true }),
          usage: { input_tokens: 10, output_tokens: 4, input_tokens_details: { cached_tokens: 0 } },
        };
      },
    },
  };
  const transport = createRecruitingGuExperiment2OpenAiTransport({ client });
  const response = await transport({
    messages: [{ role: 'system', content: 'Return the fixture.' }],
    schemaName: 'experiment_2_transport_test',
    schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
  });
  assert.deepEqual(response.parsed, { ok: true });
  assert.equal(captured.model, 'gpt-5.6-sol');
  assert.equal(captured.store, false);
  assert.equal(captured.background, false);
  assert.deepEqual(captured.reasoning, { effort: 'low' });
  assert.equal(captured.text.format.type, 'json_schema');
  assert.equal(captured.text.format.strict, true);
  assert.equal(response.receipt.requestedProvider, 'OpenAI');
});
