import { hashCanonicalJson } from '../../../src/lib/intelligenceFabric/hashing.js';
import { CREATION_LANGUAGE_CONTRACT } from '../../../src/lib/recruitingV2/creationLanguage.js';
import {
  SUBSCRIPTION_S2_GU_OUTPUT_SCHEMA,
  SUBSCRIPTION_S2_GU_PLAN_VERSION,
  buildSubscriptionS2GuWorld,
  materializeSubscriptionS2GuPlan,
  validateSubscriptionS2GuPlan,
} from '../../../src/lib/subscriptionS2/guContract.js';
import { createSubscriptionS2OpenAiTransport } from './openAiTransport.js';

const EVENT_MISSION = Object.freeze({
  FIRST_SESSION_WELCOME: {
    eyebrow: 'WELCOME TO MORE',
    headline: 'WELCOME TO MORE',
    mission: 'Create a small, calm welcome that makes the continuing coaching relationship tangible. Show only the most useful starting context and the adjustable relationship preferences. End with one natural invitation that can teach MORE how this human wants to be coached without turning the moment into a form.',
  },
  SESSION_OPENING: {
    eyebrow: 'HERE’S WHERE WE ARE',
    headline: 'Here’s where we left off',
    mission: 'Show one important orientation for today. Use only what exists and matters from direction, a real earlier agreement, what happened, or what matters now. Do not recap the whole business. If there is no earlier agreement, omit it. If nothing meaningful changed, say that simply. Make accountability feel like continuity, not inspection.',
  },
  COACHING_MOMENT: {
    eyebrow: 'A CLEARER VIEW',
    headline: 'Here’s one way to see it',
    mission: 'Decide whether a small visual would materially improve the human’s understanding of the current coaching moment. Most turns should not render. If plain conversation is enough, set render to false and return no blocks. If a visual is genuinely useful, select only one or two blocks and one important idea.',
  },
  MAP_CHANGE: {
    eyebrow: 'YOUR LIVING MAP',
    headline: 'Here’s how your map changed',
    mission: 'Show the real governed delta that just published after exact authorization. Make before-to-after consequence clear, use only the supplied delta, and never imply a broader change than the governed publication proves.',
  },
  SESSION_CLOSING: {
    eyebrow: 'UNTIL NEXT TIME',
    headline: 'Here’s what we’re carrying forward',
    mission: 'Turn the mutually aligned session learning into a concise closing receipt: what mattered, what changed or did not change, what was agreed, what remains open, and what should be picked up next. Never imply a map change unless the real delta is supplied. Never imply that ephemeral notes became canonical or Personal RSL truth.',
  },
});

const SYSTEM = `You are MORE's governed visual compiler for the flagship private Subscription relationship.

The deterministic product has already chosen the mandatory GU event. Your job is to select the smallest useful composition from the supplied governed objects. The Free Frontier coach remains responsible for the middle conversation; do not create a workflow, coaching script, dashboard, or a new business interpretation.

Use only supplied object and evidence IDs. Never invent a fact, number, source, commitment, outcome, memory, map change, authorization, or action. The renderer owns values and layout. Preserve missingness and causal humility. Session learning is a shared noncanonical receipt unless separately authorized. A map may be described as changed only for a supplied real AFW-05 delta.

Think deeply and show simply. One important orientation is better than a state dump. Use plain language a fifth grader could understand without sounding childish. Prefer familiar real-estate and business words such as lead generation, database, appointments, listings, buyers, closings, follow-up, conversion, income, expenses, goals, plans, and next steps. Explain any number in ordinary words. Do not use technical, clinical, system, model, evidence-process, or framework language. Return only the strict requested JSON schema.`;

function requestFor({ world, event, repair = null }) {
  const mission = EVENT_MISSION[event];
  return Object.freeze({
    model: 'gpt-5.6-sol',
    store: false,
    background: false,
    tools: [],
    reasoning: { effort: 'xhigh' },
    max_output_tokens: 6000,
    text: { format: SUBSCRIPTION_S2_GU_OUTPUT_SCHEMA },
    input: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: JSON.stringify({
        planVersion: SUBSCRIPTION_S2_GU_PLAN_VERSION,
        exactStateBinding: world.stateBinding,
        event,
        mandatoryMission: mission,
        governedWorld: world,
        creationLanguage: {
          ...CREATION_LANGUAGE_CONTRACT,
          permittedVisualPrimitives: SUBSCRIPTION_S2_GU_OUTPUT_SCHEMA.schema.properties.blocks.items.properties.type.enum,
          interactions: [],
        },
        instruction: event === 'COACHING_MOMENT'
          ? 'Choose whether a visual materially improves this moment. Usually it will not. If render is false, return zero blocks. If render is true, return one or two blocks. Each sentence should carry one clear idea. Do not expose internal architecture, contracts, hashes, RSL, AFW, provenance, state binding, model, or provider mechanics.'
          : event === 'SESSION_OPENING'
            ? 'Set render to true. Select exactly one block and no more than two closely related objects. Put the important point first. Omit empty prior agreements and empty progress. Do not show a metric inventory or full state report. Copy the mandatory eyebrow and headline exactly. Keep the summary and next cue short. Do not expose internal architecture, contracts, hashes, RSL, AFW, provenance, state binding, model, or provider mechanics.'
            : 'Set render to true. Select one or two blocks. Use the required event object. Copy the mandatory eyebrow and headline exactly. Keep the summary and next cue short. Each sentence should carry one clear idea. Do not expose internal architecture, contracts, hashes, RSL, AFW, provenance, state binding, model, or provider mechanics.',
        ...(repair ? { validationRepair: { errors: repair.errors, rejectedCandidate: repair.candidate } } : {}),
      }) },
    ],
  });
}

export function createSubscriptionS2GuRuntime({ apiKey, transport = null, maxAttempts = 2 } = {}) {
  const callFrontier = transport || createSubscriptionS2OpenAiTransport({ apiKey });
  return Object.freeze({
    async generate({ event, packet, publication, viewModel, sessionLearning = null, mapDelta = null, relationshipScopeHash }) {
      const world = buildSubscriptionS2GuWorld({ event, packet, publication, viewModel, sessionLearning, mapDelta, relationshipScopeHash });
      const attempts = [];
      let repair = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const request = requestFor({ world, event, repair });
        const response = await callFrontier(request);
        const mission = EVENT_MISSION[event];
        const candidate = {
          ...response.output,
          planVersion: SUBSCRIPTION_S2_GU_PLAN_VERSION,
          event,
          stateBinding: world.stateBinding,
          guidance: {
            ...response.output?.guidance,
            eyebrow: mission.eyebrow,
            headline: mission.headline,
          },
          interactions: [],
        };
        const validation = validateSubscriptionS2GuPlan({ candidate, world });
        attempts.push({ attempt, validation: validation.errors, receipt: response.receipt });
        if (validation.ok) {
          const receipt = Object.freeze({
            runtime: 'subscription-flagship-s2-gu-runtime-v1',
            event,
            provider: response.receipt,
            attempts: attempt,
            validation_repair_count: attempt - 1,
            world_hash: hashCanonicalJson(world),
            state_binding_hash: hashCanonicalJson(world.stateBinding),
            store: false,
            mutation_authority: false,
            raw_payloads_persisted: false,
          });
          return Object.freeze({ ok: true, plan: materializeSubscriptionS2GuPlan({ candidate, world, receipt }), receipt, world });
        }
        repair = { candidate, errors: validation.errors };
      }
      const error = new Error('SUBSCRIPTION_S2_GU_PLAN_FAILED_CLOSED');
      error.code = 'SUBSCRIPTION_S2_GU_PLAN_FAILED_CLOSED';
      error.validationErrors = attempts.at(-1)?.validation || [];
      throw error;
    },
  });
}
