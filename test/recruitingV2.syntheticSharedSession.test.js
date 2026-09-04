import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildRecruitingV2FrontierContext,
  createRecruitingV2DemoBaseline,
  createSyntheticReferenceFrontierOutput,
  RECRUITING_V2_DEMO_INVARIANTS,
  RECRUITING_V2_DEMO_SEQUENCE,
  transitionRecruitingV2Demo,
  validateRecruitingV2FrontierOutput,
} from '../src/lib/recruitingV2Demo/session.js';
import {
  createRecruitingV2DemoRuntime,
  InMemoryRecruitingV2DemoStore,
  recruitingV2SyntheticDemoEnabled,
} from '../api/engine/recruitingV2Demo/runtime.js';

const CAPABILITY = Object.freeze({
  contract: 'recruiting_synthetic_demo_capability_v1',
  demo_scope_id: 'leadership_demo_scope_v2_test',
  subject_key: 'recruiting-darren-jordan-v1',
  allowed_product: 'recruiting',
  synthetic_only: true,
});

const MATERIAL_MEANING = 'The opportunities exist. I do not trust what I can hand off without hurting the client experience.';

async function reachMeaning(state, options = {}) {
  let current = await transitionRecruitingV2Demo(state, 'START_SESSION', {}, options);
  while (current.chapter !== 'jordan-says') current = await transitionRecruitingV2Demo(current, 'ADVANCE', {}, options);
  return current;
}

test('frozen Campaign 2G baseline is synthetic, exact-resettable, and contains required future seams', () => {
  const first = createRecruitingV2DemoBaseline();
  const second = createRecruitingV2DemoBaseline();
  assert.deepEqual(first, second);
  assert.equal(first.relationship_session_id, 'synthetic:recruiting-v2:darren-jordan:shared-session');
  assert.equal(first.chapter, 'start');
  assert.equal(first.session_revision, 0);
  assert.equal(first.synthetic_only, true);
  assert.equal(first.demo_only, true);
  assert.equal(first.projection_eligibility.cross_product_projection_permitted, false);
  assert.deepEqual(first.zero_impact, {
    real_invitations: 0,
    emails: 0,
    memberships: 0,
    entitlements: 0,
    canonical_writes: 0,
    customer_retrievals: 0,
    provider_context_contains_real_customer_data: false,
  });
  assert.deepEqual(RECRUITING_V2_DEMO_INVARIANTS, {
    manager_session_required: false,
    manager_membership_read_permitted: false,
    entitlement_consumption_permitted: false,
    real_invitation_or_email_permitted: false,
    canonical_bos_ba_write_permitted: false,
    real_customer_retrieval_permitted: false,
    cross_product_projection_permitted: false,
  });
});

test('whole synthetic session context carries actor, perspective, provenance, revision, and no real customer identifiers', async () => {
  const state = await reachMeaning(createRecruitingV2DemoBaseline());
  const context = buildRecruitingV2FrontierContext(state, MATERIAL_MEANING);
  assert.equal(context.contract, 'recruiting_v2_shared_session_frontier_context_v1');
  assert.equal(context.synthetic_only, true);
  assert.equal(context.new_assertion.asserted_by, 'synthetic:jordan-mitchell');
  assert.equal(context.new_assertion.perspective, 'candidate');
  assert.match(context.candidate_bos.provenance, /no canonical customer retrieval/iu);
  assert.doesNotMatch(JSON.stringify(context), /mm-\d{8}-[a-z0-9]{8}|@|customer_id|profile_id/iu);
});

test('natural Jordan meaning can materially revise the hypothesis through a store-false frontier request', async () => {
  let state = await reachMeaning(createRecruitingV2DemoBaseline());
  const requests = [];
  state = await transitionRecruitingV2Demo(state, 'SUBMIT_MEANING', { meaning: MATERIAL_MEANING }, {
    provider: async (request) => {
      requests.push(request);
      return { output: createSyntheticReferenceFrontierOutput(MATERIAL_MEANING), receipt: { model: 'gpt-5.6-sol' } };
    },
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].store, false);
  assert.equal(requests[0].model, 'gpt-5.6-sol');
  assert.equal(requests[0].text.format.strict, true);
  assert.equal(state.chapter, 'noticed');
  assert.equal(state.working_gap.status, 'WORKING_UNDERSTANDING');
  assert.match(state.working_gap.headline, /decision-safe capacity/iu);
  assert.equal(state.hypotheses[0].status, 'WEAKENED');
  assert.equal(state.hypotheses.at(-1).supersedes, state.hypotheses[0].hypothesis_id);
  assert.equal(state.frontier_receipts[0].store, false);
  assert.equal(state.frontier_receipts[0].real_customer_context, false);
  assert.equal(state.assertions.at(-1).asserted_by, 'synthetic:jordan-mitchell');
});

test('MORE noticed is omitted when the new meaning does not warrant a material revision', async () => {
  let state = await reachMeaning(createRecruitingV2DemoBaseline());
  const meaning = 'I want the business to feel calmer, but I do not yet know which part of the work is causing the pressure.';
  state = await transitionRecruitingV2Demo(state, 'SUBMIT_MEANING', { meaning }, {
    provider: async () => createSyntheticReferenceFrontierOutput(meaning),
  });
  assert.equal(state.chapter, 'gap-revised');
  assert.equal(state.working_gap.status, 'PROVISIONAL');
  assert.equal(state.hypotheses[0].status, 'ACTIVE_PROVISIONAL');
  assert.equal(state.help.supported.length, 0);
  assert.match(state.learn_next[0], /recent example/iu);
  state = await transitionRecruitingV2Demo(state, 'ADVANCE');
  assert.equal(state.chapter, 'help');
  state = await transitionRecruitingV2Demo(state, 'CONTINUE_WITHOUT_HELP');
  assert.equal(state.chapter, 'plan');
});

test('unsupported frontier help and unsupported Darren commitments fail closed', async () => {
  const invalid = createSyntheticReferenceFrontierOutput(MATERIAL_MEANING);
  invalid.help.supported[0].capability_id = 'synthetic_capability_more_leads';
  assert.throws(() => validateRecruitingV2FrontierOutput(invalid), /HELP_SCOPE_DENIED/);

  let state = await reachMeaning(createRecruitingV2DemoBaseline());
  state = await transitionRecruitingV2Demo(state, 'SUBMIT_MEANING', { meaning: MATERIAL_MEANING }, {
    provider: async () => createSyntheticReferenceFrontierOutput(MATERIAL_MEANING),
  });
  state = await transitionRecruitingV2Demo(state, 'ADVANCE');
  state = await transitionRecruitingV2Demo(state, 'ADVANCE');
  assert.equal(state.chapter, 'help');
  await assert.rejects(
    transitionRecruitingV2Demo(state, 'SAVE_COMMITMENT', { commitment: 'I guarantee I will provide more leads and growth.' }),
    /UNSUPPORTED_COMMITMENT_DENIED/,
  );
});

test('the full 14-screen golden path reaches an honest decision, completion, Learn Next, and exact reset', async () => {
  const baseline = createRecruitingV2DemoBaseline();
  let state = await reachMeaning(baseline);
  state = await transitionRecruitingV2Demo(state, 'SUBMIT_MEANING', { meaning: MATERIAL_MEANING }, {
    provider: async () => createSyntheticReferenceFrontierOutput(MATERIAL_MEANING),
  });
  state = await transitionRecruitingV2Demo(state, 'ADVANCE');
  state = await transitionRecruitingV2Demo(state, 'ADVANCE');
  state = await transitionRecruitingV2Demo(state, 'SAVE_COMMITMENT', { commitment: 'I will run one weekly opportunity-and-capacity conversation with you.' });
  assert.equal(state.chapter, 'plan');
  state = await transitionRecruitingV2Demo(state, 'ADVANCE');
  assert.equal(state.chapter, 'sees-now');
  state = await transitionRecruitingV2Demo(state, 'ADVANCE');
  assert.equal(state.chapter, 'decision');
  state = await transitionRecruitingV2Demo(state, 'SAVE_DECISION', { choice: 'ANOTHER_CONVERSATION', rationale: 'Test one safe handoff first.' });
  assert.equal(state.chapter, 'complete');
  assert.equal(state.completed, true);
  assert.equal(state.decision.asserted_by, 'synthetic:jordan-mitchell');
  assert.ok(state.learn_next.length > 0);
  const reset = await transitionRecruitingV2Demo(state, 'RESET_SESSION');
  assert.deepEqual(reset, baseline);
  assert.deepEqual(RECRUITING_V2_DEMO_SEQUENCE, ['start', 'home', 'you-me', 'you', 'business', 'gap-first', 'jordan-says', 'noticed', 'gap-revised', 'help', 'plan', 'sees-now', 'decision', 'complete']);
});

test('server runtime is capability-scoped, one-time-CSRF protected, durable across reads, and resettable', async () => {
  const store = new InMemoryRecruitingV2DemoStore();
  const requests = [];
  const runtime = createRecruitingV2DemoRuntime({
    env: { RECRUITING_V2_SYNTHETIC_DEMO_ENABLED: 'true' },
    store,
    providerFactory: () => async (request) => { requests.push(request); return { output: createSyntheticReferenceFrontierOutput(MATERIAL_MEANING), receipt: { model: 'gpt-5.6-sol' } }; },
  });
  await assert.rejects(runtime.read({ ...CAPABILITY, allowed_product: 'subscription' }), /SCOPE_DENIED/);
  const opened = await runtime.read(CAPABILITY);
  assert.equal(opened.session.chapter, 'start');
  const started = await runtime.mutate(CAPABILITY, opened.csrf_token, 'START_SESSION');
  assert.equal(started.session.chapter, 'home');
  await assert.rejects(runtime.mutate(CAPABILITY, opened.csrf_token, 'ADVANCE'), /CSRF_INVALID/);
  assert.equal((await runtime.read(CAPABILITY)).session.chapter, 'home');
  const reset = await runtime.mutate(CAPABILITY, started.csrf_token, 'RESET_SESSION');
  assert.equal(reset.session.chapter, 'start');
  assert.equal(requests.length, 0);
});

test('Production airlock preserves the retired Campaign 2G source while launching the Consulting Demonstration with synthetic isolation', () => {
  const app = fs.readFileSync(new URL('../src/recruitingV2Demo/RecruitingV2DemoApp.jsx', import.meta.url), 'utf8');
  const api = fs.readFileSync(new URL('../api/recruiting/v2-demo.js', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../api/engine/recruitingV2Demo/runtime.js', import.meta.url), 'utf8');
  const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const launcher = fs.readFileSync(new URL('../src/LeadershipDemo.jsx', import.meta.url), 'utf8');
  const launcherApi = fs.readFileSync(new URL('../api/internal/leadership-demo-entry.js', import.meta.url), 'utf8');
  const recruitingV1 = fs.readFileSync(new URL('../src/recruitingV1/RecruitingV1App.jsx', import.meta.url), 'utf8');
  const guApp = fs.readFileSync(new URL('../src/recruitingGuV1/RecruitingGuV1App.jsx', import.meta.url), 'utf8');
  const guApi = fs.readFileSync(new URL('../api/recruiting/gu-v1-demo.js', import.meta.url), 'utf8');
  const combined = `${api}\n${runtime}`;
  assert.match(main, /path="\/recruiting-v2\/demo"/u);
  assert.doesNotMatch(combined, /getRecruitingService|getCanonicalProfile|inspectManager|membership_by|consumeEntitlement|reserveInvitation|Resend|sendEmail|saveCanonicalProfile/u);
  assert.doesNotMatch(app, /\/api\/recruiting\/runtime|manager session|Profile ID/u);
  assert.doesNotMatch(app, />[^<]*(?:GPT-5\.6|ChatGPT|OpenAI)[^<]*</iu);
  assert.doesNotMatch(app, /Frontier receipt|reference_id|synthetic_capability|Raw internal reasoning/u);
  assert.match(app, />Reset Demo</u);
  assert.match(app, /event\.key === 'Escape'/u);
  assert.match(app, /detailReturnFocus\.current\?\.focus/u);
  assert.equal((launcher.match(/title: 'CONSULTING DEMONSTRATION'/gu) || []).length, 1);
  assert.equal((launcher.match(/action: 'LAUNCH_/gu) || []).length, 3);
  assert.match(launcher, /recruiting-gu-v1\/demo/u);
  assert.match(launcherApi, /redirect_to: '\/recruiting-gu-v1\/demo'/u);
  assert.doesNotMatch(launcherApi, /redirect_to: '\/recruiting\/demo'/u);
  assert.match(recruitingV1, /RECRUITING_GU_V1_ENABLED.+\/recruiting-gu-v1\/demo/u);
  assert.doesNotMatch(recruitingV1, /RecruitingDemoExperience|DarrenSyntheticDemoSurface/u);
  assert.match(main, /path="\/recruiting-gu-v1\/demo"/u);
  assert.doesNotMatch(`${guApi}\n${guApp}`, /Stripe\(|sendEmail\(|grantEntitlement\(/u);
  assert.equal(recruitingV2SyntheticDemoEnabled({ RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true' }), true);
  assert.equal(recruitingV2SyntheticDemoEnabled({}), false);
});
