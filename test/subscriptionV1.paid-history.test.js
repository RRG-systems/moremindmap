import assert from 'node:assert/strict';
import nodeTest from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPaidSubscriptionV1RuntimeHandler, redactPaidRuntimePayload } from '../api/engine/subscriptionV1/paidRuntimeHandler.js';
import { createPaidConversationHistory, firstPaidTurnDisplayedOpeningContext } from '../api/engine/subscriptionV1/paidConversationHistory.js';
import { paidRuntimeKeys } from '../api/engine/subscriptionV1/paidRuntimeInfrastructure.js';
import { SESSION_LEARNING_FIELDS } from '../src/lib/subscriptionV1/sessionLearning.js';

const isReopenWorker = process.argv.includes('--paid-history-reopen-worker');
const test = isReopenWorker ? () => {} : nodeTest;

class MemoryRedis {
  values = new Map();
  lists = new Map();
  calls = [];
  failHistorySave = false;
  async get(key) { this.calls.push(['get', key]); return this.values.get(key) ?? null; }
  async getdel(key) { const value = await this.get(key); this.values.delete(key); return value; }
  async set(key, value, ...args) {
    this.calls.push(['set', key]);
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value)); return 'OK';
  }
  async lpush(key, value) { const list = this.lists.get(key) || []; list.unshift(value); this.lists.set(key, list); return list.length; }
  async ltrim(key, start, end) { this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1)); return 'OK'; }
  async expire() { return 1; }
  async eval(_script, count, ...parts) {
    const keys = parts.slice(0, count); const args = parts.slice(count);
    this.calls.push(['eval', ...keys]);
    if (this.values.get(keys[0]) !== args[0]) return 0;
    if (count === 1) { this.values.delete(keys[0]); return 1; }
    assert.equal(count, 3);
    if (this.failHistorySave && keys[1].includes(':conversation:')) throw new Error('SCRIPTED_HISTORY_WRITE_FAILURE');
    const prior = this.values.get(keys[1]);
    if (prior) this.values.set(keys[2], prior);
    this.values.set(keys[1], args[1]); return 1;
  }
}

const scope = Object.freeze({ subject_id: 'subject_history_0001', membership_id: 'membership_history_0001',
  tenant_id: 'tenant_history_0001', profile_id: 'mm-20260913-abcd1234', business_id: 'business_history_0001' });
const learning = Object.fromEntries(SESSION_LEARNING_FIELDS.map((key) => [key, `Server-owned ${key.replaceAll('_', ' ')}.`]));
const keys = paidRuntimeKeys({ scope });

function req({ method = 'GET', body = {}, csrf, stream = false, origin } = {}) {
  return { method, body, query: {}, headers: { host: 'paid-history.test',
    origin: origin ?? (method === 'GET' ? '' : 'https://paid-history.test'), 'x-forwarded-proto': 'https',
    accept: stream ? 'application/x-ndjson' : 'application/json',
    ...(csrf ? { 'x-subscription-runtime-csrf': csrf } : {}) }, socket: { remoteAddress: '127.0.0.1' } };
}

async function invoke(handler, request, onWrite = null) {
  const result = { status: 200, body: null, chunks: [], headers: {} };
  await handler(request, {
    statusCode: 200, headersSent: false,
    status(value) { result.status = value; this.statusCode = value; return this; },
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    json(value) { result.body = value; this.headersSent = true; return value; },
    write(value) { onWrite?.(value); result.chunks.push(String(value)); this.headersSent = true; return true; },
    end(value) { if (value) this.write(value); }, flush() {}, flushHeaders() {},
  });
  if (result.chunks.length) result.events = result.chunks.join('').trim().split('\n').map((line) => JSON.parse(line));
  return result;
}

function harness() {
  const redis = new MemoryRedis();
  const seen = { load: [], send: [], close: [], extraction: 0, episodes: [] };
  const control = { failTurn: false, failAfterDelivery: false, suspend: false, block: null, failCheckpoint: false };
  function handler(forScope = scope) {
    const current = { ok: true, publication: { publication_hash: 'e'.repeat(64), publication_version: 1, changed_governed_objects: [] }, view_model: { greeting: 'Welcome.' } };
    return createPaidSubscriptionV1RuntimeHandler({ redis,
      authenticate: async () => ({ ok: true, capability_hash: 'd'.repeat(64), authenticated: true,
        membership_verified: true, binding_source: 'AUTHENTICATED_SERVER_CONTEXT', scope: forScope,
        capability: { relationship_key: 'paid_test_relationship', subject_key: forScope.subject_id } }),
      resolveKeys: ({ scope: owned }) => paidRuntimeKeys({ scope: owned }),
      resolveEntitlement: async ({ scope: owned }) => ({ contract_id: 'paid_entitlement', schema_version: '1.1.0',
        entitlement_id: 'entitlement_history_0001', scope: owned, stripe_customer_hash: 'b'.repeat(64), stripe_subscription_hash: 'c'.repeat(64),
        state: control.suspend ? 'SUSPENDED_PAYMENT' : 'ACTIVE', billing_cycle_start: '2020-01-01T00:00:00.000Z',
        billing_cycle_end: '2099-01-01T00:00:00.000Z', access_ends_at: null, source_event_ids: ['evt_history_0001'],
        projected_at: '2026-09-13T12:00:00.000Z', policy_version: 'paid_history_offline_test' }),
      loadSubscriber: async (args) => {
        seen.load.push(args);
        return { scope: forScope, current, identity: { first_name: 'Avery', vertical: 'Real Estate' },
          store: { readRelationshipEpisodes: () => ({ records: seen.episodes.map((event) => ({ event })) }),
            readPersonalRsl: () => ({ records: [] }),
            appendRelationshipEpisodeEvents: async ({ events }) => { seen.episodes.push(...events); return { ok: true }; } },
          // Frozen controller matches the real production-intended runtime.
          controller: Object.freeze({ current: () => current, pendingProposal: () => null,
            send: async (sendArgs) => {
              seen.send.push({ ...sendArgs, initial_conversation: args.initial_conversation });
              if (control.block) await control.block();
              if (control.failTurn) return { ok: false, code: 'SCRIPTED_REJECTION' };
              if (control.failCheckpoint) redis.failHistorySave = true;
              const accepted = { ok: true, code: 'COACHING_ACCEPTED', customer_message: `Coach response to: ${sendArgs.message}`,
                mutation_performed: false, provider_receipts: [], research: { used: false }, external_evidence: [] };
              await sendArgs.on_coaching_ready?.(accepted);
              seen.extraction += 1;
              if (control.failAfterDelivery) return { ok: false, code: 'SCRIPTED_EXTRACTION_REJECTION' };
              return accepted;
            },
            endSession: async (closeArgs) => {
              seen.close.push(closeArgs);
              const final = closeArgs.mode === 'FINALIZE';
              return { ok: true, customer_message: final ? 'The session is closed with accurate notes.' : 'Review these notes.',
                session_learning: { status: final ? 'NOTES_READY' : 'DRAFT_AWAITING_ALIGNMENT', ...learning },
                mutual_close: { close_intent: final ? 'FINISH' : 'REVIEW', human_alignment_required: !final, alignment_established: false } };
            },
          }),
        };
      },
      generateGu: async ({ event, loaded }) => ({ ok: true, plan: { event, renderDecision: { render: true },
        guidance: { eyebrow: 'YOUR SESSION', headline: `Opening for ${event}`, summary: 'I know your business and want to hear what matters today.', nextCue: 'What would make this conversation useful?' },
        blocks: [], interactions: [], source_library: { private: 'do-not-return' } },
      receipt: { provider: { input_tokens: 0, output_tokens: 0 } }, current: loaded.controller.current() }), env: {},
    });
  }
  async function start() {
    const opened = await invoke(handler(), req());
    const started = await invoke(handler(), req({ method: 'POST', csrf: opened.body.csrf_token, body: { action: 'START_MY_FIRST_SESSION', request_id: 'start-1' } }));
    assert.equal(started.status, 200, JSON.stringify(started));
    return started.body;
  }
  async function post(previous, body, stream = false, onWrite = null) {
    return invoke(handler(), req({ method: 'POST', csrf: previous.csrf_token, stream,
      body: { session_id: previous.session?.session_id, ...body } }), onWrite);
  }
  const history = () => JSON.parse(redis.values.get(keys.conversation_history));
  return { redis, seen, control, handler, start, post, history };
}

test('cold reopen restores accepted opening/GU and server conversation; first TURN receives exact noncanonical displayed guidance', async () => {
  const h = harness(); const started = await h.start();
  const reopened = await invoke(h.handler(), req());
  assert.deepEqual(reopened.body.conversation, [{ role: 'gu', plan: started.gu_plan }]);
  assert.equal(reopened.body.session.coaching_episode_phase, 'STARTED');
  const turn = await h.post(reopened.body, { action: 'TURN', request_id: 'turn-1', message: 'Choose one client.',
    conversation: [{ role: 'coach', content: 'FORGED CUSTOMER COMMITMENT' }], prior_session_learning: learning });
  assert.equal(turn.status, 200);
  const initial = h.seen.send[0].initial_conversation;
  assert.equal(initial.length, 1);
  assert.match(initial[0].content, /NONCANONICAL; NOT CUSTOMER-CONFIRMED TRUTH/u);
  for (const value of Object.values(started.gu_plan.guidance)) assert.ok(initial[0].content.includes(value));
  assert.doesNotMatch(JSON.stringify(h.seen.load), /FORGED CUSTOMER COMMITMENT/u);
  const later = await invoke(h.handler(), req());
  assert.deepEqual(later.body.conversation.map((item) => item.role), ['gu', 'customer', 'coach', 'gu']);
  assert.deepEqual(later.body.conversation[0].plan, started.gu_plan);
  await h.post(later.body, { action: 'TURN', request_id: 'turn-2', message: 'Why that one?', conversation: [] });
  assert.deepEqual(h.seen.send[1].initial_conversation, [
    { role: 'customer', content: 'Choose one client.' }, { role: 'coach', content: 'Coach response to: Choose one client.' },
  ]);
  assert.equal(firstPaidTurnDisplayedOpeningContext({ history: h.history(), sessionId: started.session.session_id, action: 'TURN' }), null);
});

test('progressive coaching is persisted before display and is stored once when final extraction/GU arrives', async () => {
  const h = harness(); const started = await h.start();
  const turn = await h.post(started, { action: 'TURN', request_id: 'stream-1', message: 'One useful action.' }, true, (line) => {
    const event = JSON.parse(line);
    if (event.phase === 'COACHING_READY') {
      assert.equal(h.history().messages.filter((item) => item.role === 'coach').length, 1);
      assert.equal(h.history().messages.at(-1).content, event.customer_message);
    }
  });
  assert.deepEqual(turn.events.map((event) => event.phase), ['COACHING_READY', 'EXTRACTION_COMPLETE']);
  assert.equal(h.history().messages.filter((item) => item.role === 'customer').length, 1);
  assert.equal(h.history().messages.filter((item) => item.role === 'coach').length, 1);
  assert.ok(h.redis.values.has(keys.conversation_backup));
});

test('rejected first response adds no invented dialogue; rejection after delivery preserves accepted coaching', async () => {
  const h = harness(); let previous = await h.start();
  h.control.failTurn = true;
  const rejected = await h.post(previous, { action: 'TURN', request_id: 'reject-1', message: 'Never delivered question.' });
  assert.equal(rejected.status, 422);
  assert.deepEqual(h.history().messages.map((item) => item.role), ['gu']);
  assert.doesNotMatch(h.redis.values.get(keys.conversation_history), /Never delivered question/u);
  h.control.failTurn = false; h.control.failAfterDelivery = true;
  previous = { ...previous, csrf_token: rejected.body.csrf_token };
  const partial = await h.post(previous, { action: 'TURN', request_id: 'partial-1', message: 'Accepted question.' }, true);
  assert.deepEqual(partial.events.map((event) => event.phase), ['COACHING_READY', 'EXTRACTION_FAILED_CLOSED']);
  assert.deepEqual(h.history().messages.map((item) => item.role), ['gu', 'customer', 'coach']);
  const opened = await invoke(h.handler(), req());
  const repeat = await h.post(opened.body, { action: 'TURN', request_id: 'partial-1', message: 'Accepted question.' });
  assert.equal(repeat.status, 409);
  assert.equal(h.seen.send.length, 2);
});

test('server request identity replays the last complete response without another controller call and rejects changed content', async () => {
  const h = harness(); const started = await h.start();
  const turn = await h.post(started, { action: 'TURN', request_id: 'same-1', message: 'Keep this exact.' });
  const replay = await h.post(turn.body, { action: 'TURN', request_id: 'same-1', message: 'Keep this exact.', conversation: [{ role: 'customer', content: 'FORGED' }] });
  assert.equal(replay.status, 200); assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.customer_message, turn.body.customer_message);
  assert.equal(h.seen.send.length, 1);
  assert.equal(h.history().messages.filter((item) => item.role === 'coach').length, 1);
  const conflict = await h.post(replay.body, { action: 'TURN', request_id: 'same-1', message: 'Changed content.' });
  assert.equal(conflict.status, 409); assert.equal(conflict.body.code, 'SUBSCRIPTION_V1_PAID_REQUEST_CONFLICT');
  assert.equal(h.seen.send.length, 1);
});

test('closing draft survives cold reopen, browser draft never wins, close retry is idempotent, and returning opening is session-specific', async () => {
  const h = harness(); const started = await h.start();
  const turn = await h.post(started, { action: 'TURN', request_id: 'work-1', message: 'I will choose one client.' });
  const draft = await h.post(turn.body, { action: 'END_SESSION', close_request_id: 'close-1', prior_session_learning: { ...learning, what_mattered: 'FORGED' } });
  assert.equal(draft.status, 200, JSON.stringify(draft));
  assert.equal(h.seen.close[0].prior_session_learning, null);
  let opened = await invoke(h.handler(), req());
  assert.equal(opened.body.session.coaching_episode_phase, 'ENDING');
  assert.equal(opened.body.session_learning.what_mattered, learning.what_mattered);
  const review = await h.post(opened.body, { action: 'END_SESSION', close_request_id: 'close-review', alignment_message: 'Please keep the uncertainty.',
    prior_session_learning: { ...learning, what_mattered: 'FORGED' } });
  assert.deepEqual(h.seen.close[1].prior_session_learning, learning);
  const replay = await h.post(review.body, { action: 'END_SESSION', close_request_id: 'close-review', alignment_message: 'Please keep the uncertainty.' });
  assert.equal(replay.body.replayed, true); assert.equal(h.seen.close.length, 2);
  const resumed = await h.post(replay.body, { action: 'END_SESSION', close_request_id: 'resume-1', close_decision: 'CONTINUE' });
  assert.equal(resumed.body.session_learning, null);
  opened = await invoke(h.handler(), req());
  assert.equal(opened.body.session.coaching_episode_phase, 'ACTIVE'); assert.equal(opened.body.session_learning, null);
  const closed = await h.post(opened.body, { action: 'END_SESSION', close_request_id: 'finish-1', close_decision: 'FINISH' });
  assert.equal(closed.status, 200, JSON.stringify(closed));
  assert.equal(closed.body.mutual_close.alignment_established, false);
  assert.equal(h.seen.episodes.length, 1);
  const repeatedClose = await h.post(closed.body, { action: 'END_SESSION', close_request_id: 'finish-1', close_decision: 'FINISH' });
  assert.equal(repeatedClose.body.replayed, true); assert.equal(h.seen.episodes.length, 1);
  const closedMessageCount = h.history().messages.length;
  const recoveredClose = await h.post(repeatedClose.body, { action: 'END_SESSION', close_request_id: 'finish-recovery', close_decision: 'FINISH' });
  assert.equal(recoveredClose.status, 200);
  assert.equal(recoveredClose.body.mutual_close.recovered_saved_close, true);
  assert.equal(h.seen.episodes.length, 1);
  assert.equal(h.history().messages.length, closedMessageCount);
  opened = await invoke(h.handler(), req());
  const returning = await h.post(opened.body, { action: 'START_SESSION', request_id: 'return-1' });
  assert.equal(returning.status, 200);
  assert.notEqual(returning.body.session.session_id, started.session.session_id);
  await h.post(returning.body, { action: 'TURN', request_id: 'return-turn', message: 'Back again.' });
  const context = h.seen.send.at(-1).initial_conversation;
  assert.equal(context.length, 1); assert.match(context[0].content, /Opening for SESSION_OPENING/u);
  assert.doesNotMatch(context[0].content, /FIRST_SESSION_WELCOME/u);
});

test('every authenticated scope field isolates history and a scope-mismatched record fails closed', async () => {
  const h = harness(); await h.start();
  for (const field of Object.keys(scope)) {
    const other = { ...scope, [field]: `${scope[field]}_other` };
    assert.notEqual(paidRuntimeKeys({ scope: other }).conversation_history, keys.conversation_history);
    const opened = await invoke(h.handler(other), req());
    assert.equal(opened.status, 200); assert.deepEqual(opened.body.conversation, []);
  }
  const tampered = h.history(); tampered.scope.business_id = 'business_another_scope';
  h.redis.values.set(keys.conversation_history, JSON.stringify(tampered));
  const before = h.seen.load.length;
  const denied = await invoke(h.handler(), req());
  assert.equal(denied.status, 503); assert.equal(h.seen.load.length, before);
  assert.throws(() => createPaidConversationHistory({ redis: h.redis, scope: { ...scope, extra: 'untrusted' } }), /SCOPE_REQUIRED/u);
});

test('entitlement, origin and CSRF rejection do not access paid history', async () => {
  const h = harness();
  h.control.suspend = true;
  const suspended = await invoke(h.handler(), req());
  assert.equal(suspended.status, 409); assert.equal(h.seen.load.length, 0);
  h.control.suspend = false;
  assert.equal((await invoke(h.handler(), req({ method: 'POST', origin: 'https://attacker.test', body: { action: 'TURN' } }))).status, 403);
  assert.equal((await invoke(h.handler(), req({ method: 'POST', body: { action: 'TURN' } }))).status, 403);
  assert.equal(h.redis.calls.some((entry) => entry.slice(1).some((key) => String(key).includes(':conversation'))), false);
});

test('one scope lock covers the full request and prevents simultaneous cold workers from interleaving', async () => {
  const h = harness(); const started = await h.start();
  let entered; const entering = new Promise((resolve) => { entered = resolve; });
  let release; const blocked = new Promise((resolve) => { release = resolve; });
  h.control.block = async () => { entered(); await blocked; };
  const ongoing = h.post(started, { action: 'TURN', request_id: 'locked-1', message: 'Wait for this.' });
  await entering;
  const before = h.seen.load.length;
  const denied = await invoke(h.handler(), req());
  assert.equal(denied.status, 409); assert.equal(denied.body.code, 'SUBSCRIPTION_V1_PAID_REQUEST_IN_PROGRESS');
  assert.equal(h.seen.load.length, before);
  release(); assert.equal((await ongoing).status, 200);
  assert.equal(h.redis.values.has(keys.conversation_lock), false);
});

test('history checkpoint failure sends no invented success and halts later extraction; a lost lease cannot overwrite state', async () => {
  const h = harness(); const started = await h.start(); h.control.failCheckpoint = true;
  const failed = await h.post(started, { action: 'TURN', request_id: 'write-fail', message: 'Must save before delivery.' }, true);
  assert.equal(failed.status, 503); assert.equal(failed.events.some((event) => event.ok === true), false);
  assert.equal(h.seen.extraction, 0); assert.equal(h.history().messages.filter((item) => item.role === 'coach').length, 0);
  h.redis.failHistorySave = false;
  const store = createPaidConversationHistory({ redis: h.redis, scope }); await store.open();
  const before = h.redis.values.get(keys.conversation_history);
  h.redis.values.set(keys.conversation_lock, 'another-worker');
  await assert.rejects(store.save(store.snapshot()), /LOCK_LOST/u);
  await store.release();
  assert.equal(h.redis.values.get(keys.conversation_history), before);
  assert.equal(h.redis.values.get(keys.conversation_lock), 'another-worker');
});

test('private source structures are recursively excluded while original visible guidance and source links survive', () => {
  const privateKeys = ['internal_source_calls', 'internal_source_receipts', 'source_library', 'transport_trace', 'governed_reference_material'];
  const privateFields = Object.fromEntries(privateKeys.map((key) => [key, { content: 'PRIVATE_SOURCE_SENTINEL' }]));
  const clean = redactPaidRuntimePayload({ ok: true, ...privateFields, nested: [{ ...privateFields,
    guidance: { summary: 'Keep the coaching words.' }, external_evidence: [{ title: 'Reference', source_url: 'https://example.test/reference' }] }] });
  assert.doesNotMatch(JSON.stringify(clean), /PRIVATE_SOURCE_SENTINEL/u);
  assert.equal(clean.nested[0].guidance.summary, 'Keep the coaching words.');
  assert.equal(clean.nested[0].external_evidence[0].source_url, 'https://example.test/reference');
});

test('final history SAVE failure after delivered COACHING_READY retains its checkpoint and emits no final success', async () => {
  const h = harness(); const started = await h.start();
  let deliveredCheckpoint;
  const failed = await h.post(started, { action: 'TURN', request_id: 'final-save-fail', message: 'Preserve this delivered answer.' }, true, (line) => {
    const event = JSON.parse(line);
    if (event.phase === 'COACHING_READY') {
      deliveredCheckpoint = h.redis.values.get(keys.conversation_history);
      h.redis.failHistorySave = true;
    }
  });
  assert.ok(deliveredCheckpoint);
  assert.deepEqual(failed.events.map((event) => event.ok), [true, false]);
  assert.equal(failed.events[0].phase, 'COACHING_READY');
  assert.equal(failed.events[1].code, 'SUBSCRIPTION_V1_PAID_HISTORY_UNAVAILABLE');
  assert.equal(failed.events.some((event) => event.phase === 'EXTRACTION_COMPLETE'), false);
  assert.equal(h.seen.extraction, 1);
  assert.equal(h.redis.values.get(keys.conversation_history), deliveredCheckpoint);
  assert.deepEqual(h.history().messages.map((item) => item.role), ['gu', 'customer', 'coach']);
  h.redis.failHistorySave = false;
  const reopened = await invoke(h.handler(), req());
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.conversation.at(-1).content, failed.events[0].customer_message);
  assert.equal(reopened.body.session.coaching_episode_phase, 'ACTIVE');
});

test('a separate Node process reopens serialized isolated storage and actual paid GET restores dialogue, opening and closing phase', async () => {
  const h = harness(); const started = await h.start();
  const coached = await h.post(started, { action: 'TURN', request_id: 'process-turn', message: 'Remember our bounded plan.' });
  const draft = await h.post(coached.body, { action: 'END_SESSION', close_request_id: 'process-close' });
  assert.equal(draft.status, 200);
  const expected = await invoke(h.handler(), req());
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--paid-history-reopen-worker'], {
    // No inherited credentials or runtime configuration; all records are local test doubles.
    env: {}, encoding: 'utf8', timeout: 10_000, maxBuffer: 4 * 1024 * 1024,
    input: JSON.stringify({ values: [...h.redis.values], lists: [...h.redis.lists], episodes: h.seen.episodes }),
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  const reopened = JSON.parse(child.stdout);
  assert.notEqual(reopened.pid, process.pid);
  assert.equal(reopened.send_calls, 0); assert.equal(reopened.close_calls, 0);
  assert.equal(reopened.result.status, 200);
  assert.deepEqual(reopened.result.body.conversation, expected.body.conversation);
  assert.deepEqual(reopened.result.body.conversation[0].plan, started.gu_plan);
  assert.equal(reopened.result.body.session.session_id, started.session.session_id);
  assert.equal(reopened.result.body.session.coaching_episode_phase, 'ENDING');
  assert.deepEqual(reopened.result.body.session_learning, expected.body.session_learning);
});

if (isReopenWorker) {
  const records = JSON.parse(readFileSync(0, 'utf8'));
  const reopened = harness();
  reopened.redis.values = new Map(records.values);
  reopened.redis.lists = new Map(records.lists);
  reopened.seen.episodes = records.episodes;
  const result = await invoke(reopened.handler(), req());
  process.stdout.write(JSON.stringify({ pid: process.pid, result, send_calls: reopened.seen.send.length, close_calls: reopened.seen.close.length }));
}
