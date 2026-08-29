import { createRecruitingGuV1DemoRuntime } from '../api/engine/recruitingGuV1/demoRuntime.js';
import { createRecruitingGuExperiment2OpenAiTransport } from '../api/engine/recruitingGuV1/openAiTransport.js';
import {
  RECRUITING_GU_EXPERIMENT_2_CONDITIONS,
  RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
} from '../src/lib/recruitingGuV1/experiment2Contract.js';

const YOU_QUESTION = 'What should I understand about this person that might not be obvious at first?';
const CORRECTION = 'That does not quite fit. Jordan is willing to move quickly when the client experience is protected.';
const BUSINESS_QUESTION = 'What looks like the biggest opportunity in this business right now—and what might be keeping this person from getting where they want to go?';

function publicMove(result) {
  const coach = result.session.current_coach_move;
  const projection = result.session.current_projection;
  const move = coach?.move || (projection ? {
    insight: projection.plan.guidance.headline,
    explanation: projection.plan.guidance.summary,
    selfDiscoveryQuestion: projection.plan.guidance.nextCue,
    visual: { materiallyHelps: true, semanticIdea: projection.plan.guidance.whyThisEnvironment },
  } : null);
  return {
    room: result.session.current_room,
    move,
    visual_requested: result.visual_requested ?? Boolean(projection),
    visual_compiled: Boolean(projection),
    visual_blocks: projection?.plan?.blocks?.map((block) => ({ type: block.type, title: block.title })) || [],
    coach_latency_ms: result.latency?.coach_ms ?? result.latency?.total_ms ?? null,
    visual_latency_ms: result.latency?.visual_ms ?? (projection ? result.latency?.total_ms : null),
    provider_latency_ms: result.latency?.provider_ms ?? null,
    attempts: result.provider_receipt?.attempts || 1,
    repair_events: result.provider_receipt?.repairEvents || [],
    prompt_characters: result.provider_receipt?.promptCharacters || null,
    governed_world_characters: result.provider_receipt?.governedWorldCharacters || null,
    purpose_context_characters: result.provider_receipt?.purposeContextCharacters || result.context_receipt?.contextCharacters || 0,
    demonstration_count: result.provider_receipt?.demonstrationCount || 0,
    selected_real_estate_authorities: result.context_receipt?.selectedRealEstateAuthorities || [],
    model_returned: result.provider_receipt?.provider?.modelReturned || result.provider_receipt?.modelConfig?.model || null,
    provider_returned: result.provider_receipt?.provider?.providerReturned || null,
  };
}

async function compileIfRequested(runtime, result) {
  if (result.visual_requested !== true || !result.coach_move_id) return { result, visual: null };
  try {
    const visual = await runtime.mutate(result.session.session_id, 'COMPILE_GU', {
      coach_move_id: result.coach_move_id,
      expected_revision: result.session.revision,
    });
    return { result: visual, visual: publicMove(visual) };
  } catch (error) {
    return {
      result,
      visual: {
        failed_closed: true,
        code: error.code || error.message,
        attempts: error.attempts || null,
        validation_errors: error.validationErrors || [],
      },
    };
  }
}

async function ask(runtime, session, message) {
  const coached = await runtime.mutate(session.session_id, 'CHAT', {
    message,
    actor: 'MANAGER',
    expected_revision: session.revision,
  });
  const coaching = publicMove(coached);
  const compiled = await compileIfRequested(runtime, coached);
  return { coaching, visual: compiled.visual, session: compiled.result.session };
}

function publicTurn(turn) {
  return { coaching: turn.coaching, visual: turn.visual };
}

async function runCondition(condition) {
  const transport = createRecruitingGuExperiment2OpenAiTransport({
    apiKey: process.env.OPENAI_API_KEY,
    modelConfig: RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
  });
  const runtime = createRecruitingGuV1DemoRuntime({
    experimentCondition: condition,
    frontierTransport: transport,
  });
  let opened = await runtime.openSubject('SYNTHETIC');
  let changed = await runtime.mutate(opened.session.session_id, 'CHANGE_ROOM', {
    room: 'YOU', expected_revision: opened.session.revision,
  });
  const first = await ask(runtime, changed.session, YOU_QUESTION);
  const correction = await ask(runtime, first.session, CORRECTION);
  changed = await runtime.mutate(correction.session.session_id, 'CHANGE_ROOM', {
    room: 'YOUR_BUSINESS', expected_revision: correction.session.revision,
  });
  const business = await ask(runtime, changed.session, BUSINESS_QUESTION);
  return {
    condition,
    subject: 'SYNTHETIC',
    fixed_inputs: { you_question: YOU_QUESTION, correction: CORRECTION, business_question: BUSINESS_QUESTION },
    first: publicTurn(first),
    correction: publicTurn(correction),
    business: publicTurn(business),
    invariants: business.session.invariants,
  };
}

if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_REQUIRED');

const results = [];
const requestedCondition = process.argv[2] || '';
const conditions = requestedCondition ? [requestedCondition] : Object.values(RECRUITING_GU_EXPERIMENT_2_CONDITIONS);
if (conditions.some((condition) => !Object.values(RECRUITING_GU_EXPERIMENT_2_CONDITIONS).includes(condition))) {
  throw new Error('EXPERIMENT_2_CONDITION_INVALID');
}
for (const condition of conditions) {
  const startedAt = Date.now();
  try {
    const result = await runCondition(condition);
    results.push({ ...result, elapsed_ms: Date.now() - startedAt });
  } catch (error) {
    results.push({ condition, subject: 'SYNTHETIC', failed_closed: true, code: error.code || error.message, elapsed_ms: Date.now() - startedAt });
  }
}

console.log(JSON.stringify({
  contract: 'recruiting_gu_v1_experiment_2_ablation_receipt_v1',
  generated_at: new Date().toISOString(),
  model_config: RECRUITING_GU_EXPERIMENT_2_MODEL_CONFIG,
  raw_context_persisted: false,
  raw_sensitive_answers_persisted: false,
  results,
}, null, 2));
