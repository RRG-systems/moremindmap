import { hashCanonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';
import {
  SUBSCRIPTION_S2_GU_OUTPUT_SCHEMA,
  SUBSCRIPTION_S2_GU_PLAN_VERSION,
  materializeSubscriptionS2GuPlan,
  validateSubscriptionS2GuPlan,
} from '../../src/lib/subscriptionS2/guContract.js';
import { createSubscriptionS2OpenAiTransport } from '../../api/engine/subscriptionS2/openAiTransport.js';

const EVENT_MISSION = Object.freeze({
  FIRST_SESSION_WELCOME: Object.freeze({
    eyebrow: 'WELCOME TO MORE',
    headline: 'Welcome to MORE',
    mission: 'Create one calm welcome to this continuing Athlete and instructor relationship. Show only how the two humans will think and decide together.',
  }),
  SESSION_OPENING: Object.freeze({
    eyebrow: 'HERE IS WHERE YOU ARE',
    headline: 'Here is where you left off',
    mission: 'Show one useful orientation for today from the current Athlete map, a real prior agreement, what happened, or what remains open. Do not create a state report.',
  }),
  COACHING_MOMENT: Object.freeze({
    eyebrow: 'A CLEARER VIEW',
    headline: 'Here is one way to see it',
    mission: 'Usually let the conversation be enough. Render only when one or two supplied objects would materially improve understanding.',
  }),
  MAP_CHANGE: Object.freeze({
    eyebrow: 'YOUR LIVING MAP',
    headline: 'Here is how your map changed',
    mission: 'Show only the exact before-to-after change approved by both humans, including its reason or observation boundary when supplied.',
  }),
  SESSION_CLOSING: Object.freeze({
    eyebrow: 'UNTIL NEXT TIME',
    headline: 'Here is what you are carrying forward',
    mission: 'Show a small shared close: what mattered, what was agreed, what remains open, and where the continuing relationship should resume.',
  }),
});

const SYSTEM = `You are MORE's governed visual compiler for a shared Athlete and instructor relationship involving a fictional athlete aged 18–20.

The deterministic product already chose the event. Select the smallest useful composition from supplied governed objects. The free frontier coach owns the conversation. Do not create a workflow, coaching script, performance cause, diagnosis, ranking, selection judgment, or predicted future.

Use only supplied object and evidence IDs. Never invent facts, numbers, sources, commitments, outcomes, memories, map changes, authority, or actions. Preserve athlete voice, instructor observation, qualified record, inference, contradiction, missingness, and uncertainty. A visual has no mutation authority. A map may be described as changed only when an exact two-human committed delta is supplied.

Think deeply and show simply. Use familiar sport and training language. Do not expose internal architecture, contracts, hashes, Personal RSL, AFW, provenance, state binding, model, or provider mechanics. Return only the strict requested JSON schema.`;

function requestFor({ event, world, repair = null }) {
  const mission = EVENT_MISSION[event];
  if (!mission) throw new TypeError('ATHLETE_S2_GU_EVENT_INVALID');
  const mandatory = event !== 'COACHING_MOMENT';
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
          permittedVisualPrimitives: SUBSCRIPTION_S2_GU_OUTPUT_SCHEMA.schema.properties.blocks.items.properties.type.enum,
          interactions: [],
          valuesOwnedByRenderer: true,
          modelSelectsOnlyGovernedReferences: true,
        },
        instruction: mandatory
          ? 'Render one small truthful surface with one or two blocks. Copy the mandatory eyebrow and headline. Use the event-required object. Keep each sentence clear and short.'
          : 'Usually return render false and zero blocks. Render one or two blocks only if the supplied objects make the current idea materially easier to understand.',
        ...(repair ? { validationRepair: { errors: repair.errors, rejectedCandidate: repair.candidate } } : {}),
      }) },
    ],
  });
}

export function createAthleteS2GuRuntimeV1({ apiKey, transport = null, maxAttempts = 2 } = {}) {
  const callFrontier = transport || createSubscriptionS2OpenAiTransport({ apiKey });
  return Object.freeze({
    inspect: () => Object.freeze({
      provider: 'OpenAI Responses API',
      model: 'gpt-5.6-sol',
      reasoning_effort: 'xhigh',
      store: false,
      background: false,
      tools: 0,
      mutation_authority: false,
    }),
    async generate({ event, world }) {
      let repair = null;
      const attempts = [];
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const request = requestFor({ event, world, repair });
        const response = await callFrontier(request, { stage: 'ATHLETE_GU' });
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
        attempts.push({ attempt, errors: validation.errors, provider: response.receipt || null });
        if (validation.ok) {
          const receipt = Object.freeze({
            runtime: 'athlete-living-consult-s2-gu-runtime-v1',
            event,
            provider: response.receipt || null,
            attempts: attempt,
            validation_repair_count: attempt - 1,
            world_hash: hashCanonicalJson(world),
            state_binding_hash: hashCanonicalJson(world.stateBinding),
            store: false,
            mutation_authority: false,
            raw_payloads_persisted: false,
          });
          return Object.freeze({
            ok: true,
            plan: materializeSubscriptionS2GuPlan({ candidate, world, receipt }),
            receipt,
          });
        }
        repair = { candidate, errors: validation.errors };
      }
      const error = new Error('ATHLETE_S2_GU_PLAN_FAILED_CLOSED');
      error.code = 'ATHLETE_S2_GU_PLAN_FAILED_CLOSED';
      error.validationErrors = attempts.at(-1)?.errors || [];
      throw error;
    },
  });
}

export const ATHLETE_S2_GU_RUNTIME_POLICY_V1 = Object.freeze({
  provider: 'OpenAI Responses API',
  model: 'gpt-5.6-sol',
  reasoning_effort: 'xhigh',
  store: false,
  background: false,
  tools: 0,
  mutation_authority: false,
  semantic_cassette_injected: false,
});
