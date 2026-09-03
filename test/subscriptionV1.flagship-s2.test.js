import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import { createSubscriptionV1RuntimeHandler } from '../api/internal/subscription-v1-runtime.js';
import { loadProductionIntendedSyntheticSubscriber } from '../api/engine/subscriptionV1/internalDevSubscriberLoader.js';
import {
  PATRICIA_DEMO_FIXTURE_FILE_SHA256,
  PATRICIA_DEMO_RELATIONSHIP_KEY,
  PATRICIA_DEMO_SCOPE,
  PATRICIA_DEMO_SUBJECT_KEY,
  PATRICIA_DEMO_SOURCE_PATH,
  loadPatriciaDerivedDemoSubscriber,
  provePatriciaDemoStorageIsolation,
} from '../api/engine/subscriptionS2/patriciaDemoSubscriberLoader.js';
import { createSubscriptionS2GuRuntime } from '../api/engine/subscriptionS2/guRuntime.js';
import { internalDevKeys } from '../api/engine/subscriptionV1/internalDevInfrastructure.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { subscriptionS2CustomerText, validateSubscriptionS2GuPlan } from '../src/lib/subscriptionS2/guContract.js';

class FakeRedis {
  constructor() { this.values = new Map(); this.lists = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async set(key, value, ...args) { if (args.includes('NX') && this.values.has(key)) return null; this.values.set(key, String(value)); return 'OK'; }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
  async incr(key) { const value = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(value)); return value; }
  async expire() { return 1; }
  async lpush(key, value) { const values = this.lists.get(key) || []; values.unshift(value); this.lists.set(key, values); return values.length; }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return 'OK'; }
  async lrange(key, start, end) { return (this.lists.get(key) || []).slice(start, end + 1); }
  async eval(_script, keyCount, ...parts) {
    const keys = parts.slice(0, keyCount);
    const args = parts.slice(keyCount);
    if (keyCount === 1) { if (this.values.get(keys[0]) !== args[0]) return 0; this.values.delete(keys[0]); return 1; }
    if (keyCount === 3) { if (this.values.get(keys[0]) !== args[0]) return 0; const prior = this.values.get(keys[1]); if (prior) this.values.set(keys[2], prior); this.values.set(keys[1], args[1]); return 1; }
    throw new Error('Unexpected fake Redis script');
  }
}

const noProviderTransport = async (_request, { stage } = {}) => ({
  output: stage === 'CONVERSATION' ? { customer_message: 'Let us focus on one useful next step.' } : { candidate: null },
  usage: {}, latency_ms: 1, web_search_calls: 0, external_evidence: [],
});

function directRequest({ method = 'GET', body = {}, csrf = null } = {}) {
  return {
    method,
    query: {},
    body,
    headers: {
      host: '127.0.0.1:5199',
      origin: method === 'GET' ? '' : 'http://127.0.0.1:5199',
      'x-forwarded-proto': 'http',
      accept: 'application/json',
      ...(csrf ? { 'x-subscription-runtime-csrf': csrf } : {}),
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function invoke(handler, request) {
  let status = 200;
  let body = null;
  const headers = {};
  await handler(request, {
    status(value) { status = value; return this; },
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    json(value) { body = value; return value; },
    write(value) { body = `${body || ''}${value}`; },
    end(value) { if (value) body = `${body || ''}${value}`; },
    flush() {}, flushHeaders() {},
  });
  return { status, body, headers };
}

function mockGu({ event, loaded, keys }) {
  return Promise.resolve({
    ok: true,
    plan: { event, guidance: { eyebrow: 'MORE', headline: 'A clear start', summary: 'One useful idea.', nextCue: 'What happened?' }, blocks: [], interactions: [] },
    receipt: { provider: { stage: 'S2_GU', model: 'gpt-5.6-sol', store: false, latency_ms: 1 } },
    current: loaded.controller.current(),
    world: { stateBinding: { relationshipScopeHash: keys.scope_hash } },
  });
}

test('S2 opening is read-only until an explicit first-session start and the mandatory GU precedes relationship establishment', async () => {
  const redis = new FakeRedis();
  const capability = { relationship_key: 'rel_11111111111111111111', subject_key: 're-mid', synthetic_only: true };
  const loader = (args) => loadProductionIntendedSyntheticSubscriber({ ...args, transport: noProviderTransport });
  const handler = createSubscriptionV1RuntimeHandler({
    getRedis: () => redis,
    authenticate: async () => ({ ok: true, capability, capability_hash: hashCanonicalJson(capability) }),
    loadSubscriber: loader,
    generateGu: mockGu,
    env: { OPENAI_API_KEY: 'unused-test-key' },
  });
  const keys = internalDevKeys(capability);
  const opened = await invoke(handler, directRequest());
  assert.equal(opened.status, 200);
  assert.equal(opened.body.session.pre_session_state, 'PRE_FIRST_SESSION');
  assert.equal(opened.body.session.start_action, 'START_MY_FIRST_SESSION');
  assert.equal(opened.body.session.session_id, null);
  assert.equal(await redis.get(keys.s2_relationship), null);
  const allowanceAfterOpen = JSON.parse(await redis.get(keys.allowance));
  assert.equal(allowanceAfterOpen.sessions.length, 0);

  const started = await invoke(handler, directRequest({ method: 'POST', csrf: opened.body.csrf_token, body: { action: 'START_MY_FIRST_SESSION' } }));
  assert.equal(started.status, 200);
  assert.equal(started.body.gu_plan.event, 'FIRST_SESSION_WELCOME');
  assert.equal(started.body.first_session_relationship_event.event_type, 'FIRST_SESSION_DELIBERATELY_STARTED');
  assert.equal(started.body.allowance_consumed, false);
  assert.equal(started.body.mutation_performed, false);
  assert.equal(started.body.session.coaching_episode_phase, 'STARTED');
  assert.ok(await redis.get(keys.s2_relationship));
  const ended = await invoke(handler, directRequest({ method: 'POST', csrf: started.body.csrf_token, body: { action: 'END_SESSION', session_id: started.body.session.session_id, cumulative_active_seconds: 0, conversation: [], visible_customer_context: { surface: 'overview', visible_objects: [] } } }));
  assert.equal(ended.status, 200);
  assert.equal(ended.body.gu_plan.event, 'SESSION_CLOSING');
  assert.equal(ended.body.next_pre_session.start_action, 'START_SESSION');
  assert.equal(ended.body.next_pre_session.pre_session_state, 'READY_TO_START');
  assert.equal(ended.body.session_map_delta, null);
  assert.match(ended.body.session_learning_episode.event_hash, /^[a-f0-9]{64}$/u);
  assert.equal(ended.body.session_learning_episode.canonical_customer_truth_mutated, false);
  assert.equal(ended.body.session_learning_episode.personal_rsl_mutated, false);
  const closedLoaded = await loader({
    redis,
    relationship_key: capability.relationship_key,
    subject_key: capability.subject_key,
    session_id: started.body.session.session_id,
    session_kind: 'WEEKLY',
    coaching_episode_phase: 'IDLE',
    initial_conversation: [],
    env: { OPENAI_API_KEY: 'unused-test-key' },
  });
  const episodeRecords = closedLoaded.store.readRelationshipEpisodes({ scope: closedLoaded.scope }).records;
  assert.equal(episodeRecords.some((record) => record.event.event_type === 'SESSION_LEARNING'), true);
  assert.equal(closedLoaded.store.verifyRelationshipEpisodes({ scope: closedLoaded.scope }).ok, true);
  const returned = await invoke(handler, directRequest());
  assert.equal(returned.body.session.start_action, 'START_SESSION');
  assert.equal(returned.body.first_session_relationship_established, true);
});

test('S2 GU keeps the exact frontier configuration, renders only supplied objects, and rejects internal jargon', async () => {
  const redis = new FakeRedis();
  const loaded = await loadProductionIntendedSyntheticSubscriber({
    redis,
    relationship_key: 'rel_11111111111111111111',
    subject_key: 're-mid',
    session_id: 'session_111111111111111111111111',
    session_kind: 'FIRST_EVER',
    transport: noProviderTransport,
  });
  let captured;
  const runtime = createSubscriptionS2GuRuntime({ transport: async (request) => {
    captured = request;
    return {
      output: {
        renderDecision: { render: true, reason: 'A small welcome view makes the start clear.' },
        guidance: { eyebrow: 'ignored', headline: 'ignored', summary: 'Start with one clear goal and remember that the entire relationship can adapt as the coach learns what helps the customer think, decide, and act.', nextCue: 'What would make today useful, and what way of working together would help you think most clearly right now?' },
        blocks: [{ blockId: 's2-block-welcome', type: 'PLAIN_LANGUAGE', title: 'Welcome to MORE', subtitle: 'You can change the pace at any time.', objectIds: ['s2-first-session-welcome'], evidenceIds: ['s2-source-coaching-session'], emphasis: 'PRIMARY', reason: 'This helps the first conversation feel clear.' }],
      },
      receipt: { provider: 'OpenAI Responses API', model: request.model, reasoning_effort: request.reasoning.effort, store: request.store, background: request.background, tools: 0, latency_ms: 1 },
    };
  } });
  const current = loaded.controller.current();
  const result = await runtime.generate({
    event: 'FIRST_SESSION_WELCOME',
    packet: loaded.controller.wholeUnderstandingPacket(),
    publication: current.publication,
    viewModel: current.view_model,
    relationshipScopeHash: loaded.keys.scope_hash,
  });
  assert.equal(result.ok, true);
  assert.equal(captured.model, 'gpt-5.6-sol');
  assert.equal(captured.reasoning.effort, 'xhigh');
  assert.equal(captured.store, false);
  assert.equal(captured.background, false);
  assert.deepEqual(captured.tools, []);
  assert.equal(captured.text.format.schema.properties.blocks.maxItems, 2);
  assert.match(captured.input[0].content, /fifth grader/iu);
  assert.match(captured.input[0].content, /lead generation/iu);
  assert.match(captured.input[1].content, /quick welcome, not a Business Twin report/iu);
  assert.equal(result.plan.blocks[0].objects[0].id, 's2-first-session-welcome');
  assert.equal(result.plan.blocks[0].objects[0].statement, 'Congratulations, Jordan. Your coaching relationship starts here.');
  assert.deepEqual(result.plan.blocks[0].objects[0].items, []);
  assert.ok(result.plan.guidance.summary.split(/\s+/u).length <= 18);
  assert.ok(result.plan.guidance.nextCue.split(/\s+/u).length <= 18);
  assert.equal(result.plan.blocks[0].subtitle, '');
  assert.deepEqual(result.world.objects.map((item) => item.id), ['s2-first-session-welcome']);
  const overfilledWelcome = structuredClone(result.plan);
  overfilledWelcome.blocks.push({ blockId: 's2-block-extra-vision', type: 'PLAIN_LANGUAGE', title: 'Where you are going', subtitle: '', objectIds: ['s2-vision'], evidenceIds: ['s2-source-business-twin'], emphasis: 'SECONDARY', reason: 'Show more context.' });
  const overfilledErrors = validateSubscriptionS2GuPlan({ candidate: overfilledWelcome, world: result.world }).errors;
  assert.equal(overfilledErrors.includes('S2_GU_FIRST_WELCOME_ONE_BLOCK_REQUIRED'), true);
  assert.equal(overfilledErrors.includes('S2_GU_FIRST_WELCOME_ONLY_REQUIRED'), true);
  const leaked = structuredClone(result.plan);
  leaked.guidance.summary = 'The governed RSL state binding was retrieved.';
  assert.equal(validateSubscriptionS2GuPlan({ candidate: leaked, world: result.world }).errors.includes('S2_GU_CUSTOMER_LANGUAGE_INTERNAL_JARGON'), true);

  const restrained = createSubscriptionS2GuRuntime({ transport: async () => ({
    output: {
      renderDecision: { render: false, reason: 'The conversation is already clear without a visual.' },
      guidance: { eyebrow: 'ignored', headline: 'ignored', summary: 'No visual is needed.', nextCue: 'Keep talking.' },
      blocks: [],
    },
    receipt: { provider: 'OpenAI Responses API', model: 'gpt-5.6-sol', reasoning_effort: 'xhigh', store: false, background: false, tools: 0, latency_ms: 1 },
  }) });
  const noVisual = await restrained.generate({
    event: 'COACHING_MOMENT', packet: loaded.controller.wholeUnderstandingPacket(), publication: current.publication,
    viewModel: current.view_model, relationshipScopeHash: loaded.keys.scope_hash,
  });
  assert.equal(noVisual.plan.renderDecision.render, false);
  assert.deepEqual(noVisual.plan.blocks, []);
  assert.equal(noVisual.world.objects.some((item) => item.id === 's2-relationship-preferences'), false);
});

test('Patricia-derived S2 demo uses a byte-sealed source and an independent writable relationship that persists only in demo keys', async () => {
  const raw = fs.readFileSync(PATRICIA_DEMO_SOURCE_PATH);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), PATRICIA_DEMO_FIXTURE_FILE_SHA256);
  const isolation = provePatriciaDemoStorageIsolation();
  assert.equal(isolation.ok, true);
  assert.equal(isolation.actual_patricia_write_path, false);
  const redis = new FakeRedis();
  const transport = async (request, { stage }) => {
    if (stage === 'CONVERSATION') return { output: { customer_message: 'Avery, your best next step may be to make one handoff work from start to finish. Which handoff would free the most time?' }, usage: {}, latency_ms: 1 };
    if (stage === 'CANDIDATE_EXTRACTION') return { output: { candidate: {
      candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
      summary: 'Remember the customer’s communication preference.',
      items: [{ field: 'evidence.communication_preference', value: 'Lead with one clear point, then ask one question.' }],
      reason: 'The customer explicitly asked MORE to keep this preference.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
      generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    } }, usage: {}, latency_ms: 1 };
    const input = JSON.parse(request.input[1].content);
    return { output: { decision: 'CONFIRM', proposal_hash: input.pending_proposal.proposal_hash, effective_items: [], unambiguous: true, reason: 'Exact confirmation.' }, usage: {}, latency_ms: 1 };
  };
  const first = await loadPatriciaDerivedDemoSubscriber({
    redis, relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY, subject_key: PATRICIA_DEMO_SUBJECT_KEY,
    session_id: 'session_aaaaaaaaaaaaaaaaaaaaaaaa', session_kind: 'FIRST_EVER', transport,
  });
  assert.deepEqual(first.scope, PATRICIA_DEMO_SCOPE);
  assert.equal(first.identity.demo_copy_only, true);
  const proposal = await first.controller.send({ message: 'Please keep that as my communication preference.' });
  assert.equal(proposal.confirmation_required, true);
  const accepted = await first.controller.decide({ proposal_id: proposal.proposal.proposal_id, decision: 'CONFIRM', idempotency_key: 'patricia-demo-isolated-proof' });
  assert.equal(accepted.mutation_performed, true);
  const later = await loadPatriciaDerivedDemoSubscriber({
    redis, relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY, subject_key: PATRICIA_DEMO_SUBJECT_KEY,
    session_id: 'session_bbbbbbbbbbbbbbbbbbbbbbbb', session_kind: 'WEEKLY', transport,
  });
  assert.equal(later.controller.current().publication.publication_version, 2);
  assert.equal(later.store.readPersonalRsl({ scope: later.scope }).records.length, 1);
  assert.equal([...redis.values.keys()].every((key) => !/mm-20260708-dsst020z|PATRICIA_TEST_A_PROFILE|ba-20260714-64ca0783/iu.test(key)), true);
  assert.equal([...redis.values.keys()].some((key) => key.includes(later.keys.scope_hash)), true);
  assert.notEqual(later.keys.scope_hash, internalDevKeys({ relationship_key: 'rel_11111111111111111111', subject_key: 're-mid' }).scope_hash);
});

test('a real demo-only AFW-05 change triggers the mandatory map-change GU while an ordinary turn keeps middle GU restrained', async () => {
  const redis = new FakeRedis();
  const capability = { relationship_key: PATRICIA_DEMO_RELATIONSHIP_KEY, subject_key: PATRICIA_DEMO_SUBJECT_KEY, synthetic_only: true, local_demo_only: true };
  const transport = async (_request, { stage }) => {
    if (stage === 'CONVERSATION') return { output: { customer_message: 'Avery, one clear point matters most. What would make this handoff useful?' }, usage: {}, latency_ms: 1 };
    if (stage === 'CANDIDATE_EXTRACTION') return { output: { candidate: {
      candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
      summary: 'Keep the customer’s clear communication preference.', items: [{ field: 'evidence.communication_preference', value: 'Lead with one clear point, then ask one question.' }],
      reason: 'The customer explicitly asked MORE to keep this preference.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
      generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    } }, usage: {}, latency_ms: 1 };
    return { output: { decision: 'NONE', proposal_hash: '0'.repeat(64), effective_items: [], unambiguous: false, reason: 'No natural authorization request.' }, usage: {}, latency_ms: 1 };
  };
  const events = [];
  const generateGu = async ({ event, loaded }) => {
    events.push(event);
    return {
      ok: true,
      plan: {
        event,
        renderDecision: { render: event !== 'COACHING_MOMENT', reason: event === 'COACHING_MOMENT' ? 'Conversation is enough.' : 'This event requires a visual.' },
        guidance: { eyebrow: 'MORE', headline: event, summary: 'One clear idea.', nextCue: 'What matters next?' },
        blocks: event === 'COACHING_MOMENT' ? [] : [{ blockId: `s2-block-${event.toLowerCase().replaceAll('_', '-')}`, type: 'PLAIN_LANGUAGE', title: 'What matters', subtitle: '', objects: [] }],
        interactions: [],
      },
      receipt: { provider: { stage: 'S2_GU', model: 'gpt-5.6-sol', store: false, latency_ms: 1 } },
      current: loaded.controller.current(),
    };
  };
  const handler = createSubscriptionV1RuntimeHandler({
    getRedis: () => redis,
    authenticate: async () => ({ ok: true, capability, capability_hash: hashCanonicalJson(capability) }),
    loadSubscriber: (args) => loadPatriciaDerivedDemoSubscriber({ ...args, transport }),
    generateGu,
    env: { OPENAI_API_KEY: 'unused-test-key' },
  });
  const opened = await invoke(handler, directRequest());
  const started = await invoke(handler, directRequest({ method: 'POST', csrf: opened.body.csrf_token, body: { action: 'START_MY_FIRST_SESSION' } }));
  const turn = await invoke(handler, directRequest({ method: 'POST', csrf: started.body.csrf_token, body: { action: 'TURN', session_id: started.body.session.session_id, message: 'Please keep that way of speaking with me.', conversation: [], visible_customer_context: { surface: 'overview', visible_objects: [] } } }));
  assert.equal(turn.status, 200);
  assert.equal(turn.body.confirmation_required, true);
  assert.equal(turn.body.gu_plan, null);
  assert.equal(events.includes('COACHING_MOMENT'), true);
  const decision = await invoke(handler, directRequest({ method: 'POST', csrf: turn.body.csrf_token, body: { action: 'DECISION', session_id: started.body.session.session_id, proposal_id: turn.body.proposal.proposal_id, decision: 'CONFIRM', edited_items: [] } }));
  assert.equal(decision.status, 200);
  assert.equal(decision.body.mutation_performed, true);
  assert.equal(decision.body.gu_plan.event, 'MAP_CHANGE');
  assert.equal(events.at(-1), 'MAP_CHANGE');
  assert.equal(decision.body.session_map_delta.material, true);
});

test('Synthetic Jordan acknowledges a durable communication preference once and later turns keep the preference GU ineligible', async () => {
  const redis = new FakeRedis();
  const capability = { relationship_key: 'rel_22222222222222222222', subject_key: 're-mid', synthetic_only: true, local_demo_only: true };
  const transport = async (_request, { stage }) => {
    if (stage === 'CONVERSATION') return { output: { customer_message: 'Jordan, I will keep this simple. What is the one decision you want to make?' }, usage: {}, latency_ms: 1 };
    if (stage === 'CANDIDATE_EXTRACTION') return { output: { candidate: {
      candidate_type: 'PERSONAL_RSL_CANDIDATE', proposal_type: 'EVIDENCE_CANDIDATE', target_contract: 'EVIDENCE_LEDGER', operation: 'PROPOSE',
      summary: 'Remember Jordan’s durable communication preference.', items: [{ field: 'evidence.communication_preference', value: 'Speak simply and ask one focused question.' }],
      reason: 'Jordan explicitly asked MORE to remember this preference.', evidence_ref_ids: [], authority_ref_ids: [], confirmation_required: true,
      generalization_scope: 'CONTEXT_SPECIFIC_NOT_GENERALIZABLE',
    } }, usage: {}, latency_ms: 1 };
    return { output: { decision: 'NONE', proposal_hash: '0'.repeat(64), effective_items: [], unambiguous: false, reason: 'No natural authorization request.' }, usage: {}, latency_ms: 1 };
  };
  const events = [];
  const generateGu = async ({ event, loaded }) => {
    events.push(event);
    return {
      ok: true,
      plan: {
        event,
        renderDecision: { render: event !== 'COACHING_MOMENT', reason: event === 'COACHING_MOMENT' ? 'Conversation is enough.' : 'This event requires a visual.' },
        guidance: { eyebrow: 'MORE', headline: event, summary: 'One clear idea.', nextCue: 'What matters next?' },
        blocks: event === 'COACHING_MOMENT' ? [] : [{ blockId: `s2-block-${event.toLowerCase().replaceAll('_', '-')}`, type: 'PLAIN_LANGUAGE', title: 'What matters', subtitle: '', objects: [] }],
        interactions: [],
      },
      receipt: { provider: { stage: 'S2_GU', model: 'gpt-5.6-sol', store: false, latency_ms: 1 } },
      current: loaded.controller.current(),
    };
  };
  const handler = createSubscriptionV1RuntimeHandler({
    getRedis: () => redis,
    authenticate: async () => ({ ok: true, capability, capability_hash: hashCanonicalJson(capability) }),
    loadSubscriber: (args) => loadProductionIntendedSyntheticSubscriber({ ...args, transport }),
    generateGu,
    env: { OPENAI_API_KEY: 'unused-test-key' },
  });
  const opened = await invoke(handler, directRequest());
  const started = await invoke(handler, directRequest({ method: 'POST', csrf: opened.body.csrf_token, body: { action: 'START_MY_FIRST_SESSION' } }));
  const proposed = await invoke(handler, directRequest({ method: 'POST', csrf: started.body.csrf_token, body: { action: 'TURN', session_id: started.body.session.session_id, message: 'Please remember to speak simply and ask one focused question.', conversation: [], visible_customer_context: { surface: 'overview', visible_objects: [] } } }));
  assert.equal(proposed.status, 200);
  assert.equal(proposed.body.confirmation_required, true);
  assert.equal(proposed.body.gu_plan, null);
  const confirmed = await invoke(handler, directRequest({ method: 'POST', csrf: proposed.body.csrf_token, body: { action: 'DECISION', session_id: started.body.session.session_id, proposal_id: proposed.body.proposal.proposal_id, decision: 'CONFIRM', edited_items: [] } }));
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.mutation_performed, true);
  assert.equal(confirmed.body.gu_plan.event, 'MAP_CHANGE');
  const later = await invoke(handler, directRequest({ method: 'POST', csrf: confirmed.body.csrf_token, body: { action: 'TURN', session_id: started.body.session.session_id, message: 'What should I focus on now?', conversation: [], visible_customer_context: { surface: 'overview', visible_objects: [] } } }));
  assert.equal(later.status, 200);
  assert.equal(later.body.gu_plan, null);
  assert.deepEqual(events, ['FIRST_SESSION_WELCOME', 'COACHING_MOMENT', 'MAP_CHANGE', 'COACHING_MOMENT']);
});

test('rendered S2 change surface supports explicit start, mandatory GU, Synthetic Jordan demo reset, Enter semantics, and customer-language recovery', () => {
  const ui = fs.readFileSync(new URL('../src/subscriptionV1/SubscriptionV1InternalDevApp.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/subscriptionV1/internalDev.css', import.meta.url), 'utf8');
  const renderer = fs.readFileSync(new URL('../src/subscriptionS2/SubscriptionS2GuRenderer.jsx', import.meta.url), 'utf8');
  const server = fs.readFileSync(new URL('../scripts/subscriptionS2LocalServer.mjs', import.meta.url), 'utf8');
  const runtime = fs.readFileSync(new URL('../api/internal/subscription-v1-runtime.js', import.meta.url), 'utf8');
  assert.match(ui, /START MY FIRST SESSION/u);
  assert.match(ui, /START SESSION/u);
  assert.match(ui, /SYNTHETIC JORDAN/u);
  assert.match(ui, /RESET DEMO/u);
  assert.doesNotMatch(ui, /PATRICIA|chooseDemoSubject|subscription-v1-demo-subject/iu);
  assert.match(ui, /event\.key !== 'Enter' \|\| event\.shiftKey/u);
  assert.match(ui, /submitLockRef/u);
  assert.match(ui, /explain it more simply/u);
  assert.match(ui, /className="s2-session-start-note"/u);
  assert.match(styles, /\.s2-session-start button\s*\{[^}]*min-width:\s*14rem;[^}]*background:\s*linear-gradient/u);
  assert.match(styles, /\.s2-gu\s*\{[^}]*display:\s*grid;[^}]*border-radius:\s*1rem;/u);
  assert.match(renderer, /data-s2-gu-event/u);
  assert.doesNotMatch(renderer, /block\.type\.replaceAll/u);
  assert.match(server, /127\.0\.0\.1/u);
  assert.match(server, /isolated_process_memory: true/u);
  assert.doesNotMatch(server, /REDIS_URL|moremindmap\.com/iu);
  assert.doesNotMatch(server, /PATRICIA|patricia-demo|PATRICIA_DERIVED/u);
  assert.match(server, /stripe_subscription_created:\s*false/u);
  assert.match(runtime, /conversational_time_controller:\s*false/u);
  assert.doesNotMatch(ui, /setTimeout\([^)]*30\s*\*\s*60/iu);
});

test('S2 GU projection translates complex business language before it reaches rendered customer cards', () => {
  const translated = subscriptionS2CustomerText('The business does not yet have enough reconciled opportunity-and-capacity evidence to know whether doubling production requires more qualified flow, better conversion, stronger operating discipline, first leverage, or a combination.');
  assert.equal(translated, 'We still need to learn whether growth requires more good leads, better conversion, stronger work routines, the right help, or a combination.');
  assert.doesNotMatch(translated, /reconciled|capacity|qualified flow|operating discipline|first leverage|constraint|hypothesis|governed|epistemic/iu);

  const plan = subscriptionS2CustomerText('Four-week opportunity-and-capacity baseline. For four weeks, reconcile opportunity stages and sources while tracking time by client-value work, opportunity-creation, transaction coordination, rework, and work that could have a different owner. The record identifies the dominant growth roadblock and defines a bounded assistant outcome—or proves that hiring is not yet the next move. Reconcile the current pipeline. Define qualified relationship and opportunity stages. Protect opportunity-creation time. Use four weeks of evidence to decide the leverage test.');
  assert.match(plan, /four-week look at leads and time/iu);
  assert.match(plan, /check which leads are real and where they came from/iu);
  assert.match(plan, /work that directly helps clients/iu);
  assert.match(plan, /sets a clear result for testing an assistant/iu);
  assert.doesNotMatch(plan, /baseline|reconcile|client-value|opportunity-creation|transaction coordination|rework|dominant growth roadblock|bounded assistant outcome|leverage test/iu);

  const openItems = subscriptionS2CustomerText('The customer ended this bounded session before a substantive coaching exchange. Open loops remain. Reconciled 90-day source-to-close conversion by stage. Open evidence gap. Current qualified-relationship count. Time study separating client-value work and rework. Gross commission, expense, and margin reconciliation sufficient for a hire decision.');
  assert.match(openItems, /past 90 days of leads, appointments, and closings/iu);
  assert.match(openItems, /number of real prospects/iu);
  assert.match(openItems, /income, expenses, and profit/iu);
  assert.doesNotMatch(openItems, /bounded|substantive coaching exchange|open loops|reconciled|source-to-close|evidence gap|qualified-relationship|time study|client-value|rework|margin reconciliation/iu);

  const patricia = subscriptionS2CustomerText('Opportunity generation is judged insufficient and remains relationship-led. Goals progress from two monthly closings toward a delegated multi-agent business. A combined relationship base exists but lacks complete, segmented, system-governed records. External coaching covers development and recruiting, while operating accountability is mostly self-held or absent. Core workflows are articulated, but execution and follow-through remain leader-centered. Production, gross, and expense figures are reported, but their periods, reconciliation, and owner economics remain unresolved. Organization, time management, and distraction are the operator-identified constraints. Equal profit and business contribution coexist with a reported concentration of work on the operator. Additional help, delegation, and daily CRM use are identified as necessary capacity changes. Leader-centered execution without a governed relationship, delegation, measurement, and accountability system. Transfer one recurring workflow with explicit decision rights, quality boundaries, exception rules, and inspected completion. Customer-reported snapshot. Supported hypothesis. Financial bridge. Unreconciled. Material open evidence. Research when purpose requires it.');
  assert.match(patricia, /New business still comes mainly from relationships/iu);
  assert.match(patricia, /Hand off one repeat task with clear ownership/iu);
  assert.match(patricia, /What you told MORE/iu);
  assert.doesNotMatch(patricia, /system-|operator-identified|leader-centered|decision rights|quality boundaries|exception rules|inspected completion|supported hypothesis|financial bridge|unreconciled|material open evidence/iu);
});
