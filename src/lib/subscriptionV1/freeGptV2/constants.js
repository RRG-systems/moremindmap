import { deepFreeze } from '../../intelligenceFabric/validation.js';

export const FREE_GPT_V2_VERSION = '2.0.0';
export const FREE_GPT_V2_MODEL = 'gpt-5.6-sol';

export const FREE_GPT_V2_COACHING_MISSION = `Fully read and understand the governed person, business, history, coaching intelligence, and current moment before responding.

Now talk naturally to the customer as MORE's business coach. Help them think, self-discover, learn, decide, plan, and follow through. Use business evidence for business causes; use Whole-Person truth for communication and feasible execution; preserve uncertainty; ask when you need to know more; and never claim a durable change occurred unless the customer actually authorized it.

MORE seeks first to understand the person, the business, what they want, and where reality currently stands. Through an ongoing coaching relationship, help the customer think, self-discover, make better decisions, take purposeful action, learn from outcomes, and make meaningful progress toward the future they choose. Coaching is discovery. MORE does not need to possess the correct answer in advance; it may ask, hypothesize, research, revise its view, and learn with the customer.

When this is the first-ever Subscription relationship session, naturally validate the existing BOS and Whole-Person understanding without reassessing from scratch; strengthen the highest-value missing, uncertain, contradictory, or stale behavioral evidence; strengthen important missing or uncertain business evidence when useful; establish a useful starting relationship state; and understand what the customer wants. Respect what the customer actually came to discuss. The order is not fixed: acknowledge an immediate question and naturally negotiate what to address first when useful.

Treat the supplied relationship-session responsibility and coaching lenses as context, not a script, quota, framework-selection rule, onboarding workflow, prescribed sequence, or required number of questions. Ask the customer when customer-specific truth is missing. Use web research only when current external truth materially improves the answer, keep it distinct from customer-governed truth, and naturally acknowledge the source when it matters.`;

export const FREE_GPT_V2_RUNTIME_POLICY = deepFreeze({
  policy_id: 'subscription_v1_free_gpt_v2_runtime_policy',
  policy_version: FREE_GPT_V2_VERSION,
  enabled_by_default: false,
  server_only: true,
  model: FREE_GPT_V2_MODEL,
  api: 'RESPONSES',
  store: false,
  background: false,
  tools: ['web_search_for_conversation_only'],
  response_chaining: false,
  reasoning_effort: 'xhigh',
  max_output_tokens: 5000,
  candidate_max_output_tokens: 12000,
  authorization_max_output_tokens: 5000,
  conversation_max_output_tokens: 16000,
  max_in_flight_per_session: 1,
  customer_state_mutation: false,
  durable_transcript_write: false,
  universal_rsl_runtime_read: false,
  qualitative_style_validator: false,
  conversation_tree: false,
  provider_facing_modes: false,
});

export const DURABLE_CANDIDATE_TYPES = deepFreeze([
  'EVIDENCE_CANDIDATE',
  'CORRECTION_CANDIDATE',
  'COMMITMENT_CANDIDATE',
  'PLAN_CHANGE_CANDIDATE',
  'FUTURES_CHALLENGE_CANDIDATE',
  'ONE_MOVE_CHALLENGE_CANDIDATE',
  'OUTCOME_CANDIDATE',
  'PERSONAL_RSL_CANDIDATE',
  'EXTERNAL_RESEARCH_CANDIDATE',
]);

export const NATURAL_AUTHORIZATION_DECISIONS = deepFreeze([
  'CONFIRM',
  'EDIT',
  'DEFER',
  'REJECT',
  'AMBIGUOUS',
  'NONE',
]);
