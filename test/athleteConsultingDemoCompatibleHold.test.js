import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { FakeRedis } from '../scripts/athlete-consulting-v2-review/fakeRedis.mjs';
import { createStore, athleteConsultingV2Keys } from '../server/athleteConsultingV2/store.js';
import { createAthleteConsultingV2Handler } from '../server/athleteConsultingV2/handler.js';
import { applyLiveCapture } from '../server/athleteConsultingV2/capture.js';
import { hash } from '../server/athleteConsultingV2/state.js';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { currentApaView } from '../server/athleteConsultingV2/currentApa.js';
import { createAthleteLivingConsultOneShotHandlerV1 } from '../api/internal/athlete-living-consult-one-shot-v1.js';
import { athleteConsultingDemoConsultingWriteHold, athleteConsultingV2Enabled,
  authenticateAthleteConsultingDemoRequest, issueLeadershipLauncherCapability,
  issueAthleteConsultingDemoCapability } from '../api/engine/leadershipDemo/authority.js';

const env = Object.freeze({ RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
  SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true', ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true',
  ATHLETE_CONSULTING_V2_ENABLED: 'true', ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true' });
const heldEnv = Object.freeze({ ...env, ATHLETE_CONSULTING_V2_ENABLED: 'false',
  ATHLETE_CONSULTING_DEMO_CONSULTING_WRITE_HOLD: 'true' });
const output = { reply: 'Fictional offline reply.', plan: null, plan_change: 'none',
  retire_draft: false, learning: ['The athlete prefers one manageable step.'], recap: '' };
const note = (subject = 'nia') => ({ subject, role: 'coach', source: 'Coach Alex (synthetic)',
  kind: 'text', text: 'Reviewed fictional observation for this athlete.', attachments: [],
  reviewed: true, channel: 'coach_connect_box04_v1' });
const forbiddenProvider = async () => { throw Error('UNEXPECTED_PROVIDER'); };
const clone = value => structuredClone(value);

function storeFor(redis, scopeId, options = {}) {
  return createStore({ redis, bundles, scopeId, coach: forbiddenProvider,
    localAction: applyLiveCapture, ...options });
}
async function act(store, body, slug = 'nia') {
  return store.act(slug, { ...body, requestId: body.requestId || randomUUID(),
    revision: (await store.read(slug)).revision });
}
function reseal(envelope) {
  const { envelope_hash: _old, ...unsigned } = envelope;
  return JSON.stringify({ ...unsigned, envelope_hash: hash(unsigned) });
}
async function evolvedFixture(redis = new FakeRedis(), scopeId = `offline-compatible-hold:${randomUUID()}`) {
  const store = storeFor(redis, scopeId, { coach: async () => clone(output),
    apaComposer: async ({ bundle, record, confirmedChange }) => {
      const prior = currentApaView(bundle, record).artifact;
      const candidate = { confirmation: clone(prior.confirmation), report: clone(prior.report) };
      candidate.report.domains[1].gap = `A reviewed fictional practice constraint, revision ${(record?.version || 0) + 1}.`;
      candidate.report.domains[1].refs.push(`APA:CURRENT:${confirmedChange.id}`);
      return { candidate, changed: true };
    } });
  await act(store, { action: 'start' });
  let state = await act(store, { action: 'message', text: 'My practice week changed.', speaker: 'athlete' });
  const sourceMessageId = state.messages.findLast(item => item.role === 'user').id;
  await act(store, { action: 'remember', items: output.learning });
  const drafted = await act(store, { action: 'draft', plan: { title: 'One chosen step', why: 'Athlete choice',
    steps: [{ action: 'Ask one question', when: 'Next practice', notice: 'Whether it helped', owner: 'athlete' }], review: 'After practice' } });
  await act(store, { action: 'approve', id: drafted.draft.id, hash: drafted.draft.hash, actor: 'athlete' });
  state = await act(store, { action: 'update_apa', kind: 'reality', supersedes: [],
    reason: 'Explicit fictional practice review.', sourceMessageId, expectedApaVersion: 0 });
  assert.ok(state.apaDraft);
  await act(store, { action: 'publish_apa', id: state.apaDraft.id, hash: state.apaDraft.hash });
  state = await act(store, { action: 'update_apa', kind: 'reality', supersedes: [],
    reason: 'Second exact private review.', sourceMessageId, expectedApaVersion: 1 });
  assert.ok(state.apaDraft);
  const keys = athleteConsultingV2Keys({ scopeId, slug: 'nia', bundle: bundles.nia });
  const saved = JSON.parse(await redis.get(keys.state)), pendingId = randomUUID();
  // Fictional crash fixture: exact valid persisted envelope, not a runtime fork.
  saved.state.beforeWorking = saved.state.status;
  saved.state.status = 'working';
  saved.state.pending = { task: 'APA_UPDATE', requestId: pendingId, at: '2026-09-27T00:00:00.000Z' };
  saved.operations[pendingId] = { hash: hash({ fictionalPending: true }), status: 'pending', task: 'APA_UPDATE' };
  const raw = reseal(saved);
  await redis.set(keys.state, raw);
  return { redis, scopeId, keys, raw, saved: JSON.parse(raw), pendingId };
}
function assertCaptureOnly(before, after) {
  const mutable = new Set(['messages', 'events', 'revision', 'processed']);
  for (const field of Object.keys(before.state)) if (!mutable.has(field))
    assert.deepEqual(after.state[field], before.state[field], field);
  assert.deepEqual(after.state.messages.slice(0, -1), before.state.messages);
  assert.deepEqual(after.state.events.slice(0, -1), before.state.events);
  assert.equal(after.state.events.at(-1).type, 'demo_capture_received');
  assert.equal(after.state.messages.at(-1).capture.reviewed, true);
  assert.equal(after.state.revision, before.state.revision + 1);
  for (const [id, operation] of Object.entries(before.operations)) assert.deepEqual(after.operations[id], operation);
}
function req({ method = 'GET', cookie = '', kind = 'state', slug = 'nia', body = null,
  origin = 'https://moremindmap.com', headers = {}, url } = {}) {
  const target = url || `/api/internal/athlete-living-consult-one-shot-v1?kind=${kind}&athlete=${slug}`;
  return { method, url: target, body, query: Object.fromEntries(new URL(target, origin).searchParams),
    headers: { host: 'moremindmap.com', origin, 'x-forwarded-proto': 'https',
      'x-forwarded-for': '203.0.113.71', 'user-agent': 'Fictional offline hold test', cookie,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...headers }, socket: {} };
}
async function invoke(handler, request) {
  const res = { statusCode: 200, headers: {}, chunks: [], status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; }, json(value) { this.payload = value; return this; },
    end(value = '') { this.chunks.push(String(value)); } };
  await handler(request, res);
  return { status: res.statusCode, body: res.payload || JSON.parse(res.chunks.join('') || '{}') };
}
async function credentials(redis, configuration = env) {
  const launcher = await issueLeadershipLauncherCapability({ redis, req: req(), env: configuration });
  const issued = await issueAthleteConsultingDemoCapability({ redis, req: req(), launcher: launcher.capability, env: configuration });
  return { cookie: issued.cookie.split(';')[0], scopeId: issued.capability.demo_scope_id };
}
function bodyFor(state, operation, actor = 'instructor') {
  return { ...operation, requestId: operation.requestId || randomUUID(), revision: state.revision,
    proof_revision: state._transport.revision, state_hash: state._transport.state_hash,
    actor_capability: state._transport.actors[actor] };
}
async function post(handler, credential, state, operation, options = {}) {
  return invoke(handler, req({ method: 'POST', kind: options.kind || 'action', cookie: credential,
    body: bodyFor(state, operation, options.actor), headers: { 'x-athlete-consulting-csrf': state._transport.csrf }, ...options.request }));
}

test('new hold is literal true, default off, and keeps effective V2 subjects rather than V1', async () => {
  assert.equal(athleteConsultingDemoConsultingWriteHold(env), false);
  assert.equal(athleteConsultingDemoConsultingWriteHold({ ...env, ATHLETE_CONSULTING_DEMO_CONSULTING_WRITE_HOLD: '1' }), false);
  assert.equal(athleteConsultingV2Enabled({ ...env, ATHLETE_CONSULTING_V2_ENABLED: 'false' }), false);
  assert.equal(athleteConsultingV2Enabled(heldEnv), true);
  const redis = new FakeRedis(), issued = await credentials(redis);
  const authenticated = await authenticateAthleteConsultingDemoRequest({ redis, req: req({ cookie: issued.cookie }), env: heldEnv });
  assert.equal(authenticated.ok, true);
  assert.deepEqual(authenticated.capability.allowed_subjects, ['nia', 'sofia']);
});

test('held cold reads preserve exact evolved and pending bytes without initializing or recovering', async () => {
  const fixture = await evolvedFixture();
  const held = storeFor(fixture.redis, fixture.scopeId, { consultingWriteHold: true });
  fixture.redis.calls.length = 0; fixture.redis.evalCalls.length = 0;
  const state = await held.read('nia');
  assert.equal(state.consulting_write_hold.active, true);
  assert.equal(state.status, 'working');
  assert.deepEqual(state.pending, fixture.saved.state.pending);
  assert.equal(currentApaView(bundles.nia, state.currentApa).version, 1);
  assert.equal(state.apaDraft.previewRecord.version, 2);
  assert.deepEqual(state.plan, fixture.saved.state.plan);
  assert.deepEqual(state.learning, fixture.saved.state.learning);
  assert.deepEqual(state.messages, fixture.saved.state.messages);
  assert.equal(fixture.redis.values.get(fixture.keys.state), fixture.raw);
  assert.deepEqual(fixture.redis.calls.map(item => item[0]), ['get']);
  assert.equal(fixture.redis.evalCalls.length, 0);
  const sofiaKeys = athleteConsultingV2Keys({ scopeId: fixture.scopeId, slug: 'sofia', bundle: bundles.sofia });
  assert.equal((await held.read('sofia')).status, 'ready');
  assert.equal(fixture.redis.values.has(sofiaKeys.state), false);
});

test('every Consulting mutation and non-Box04 capture is refused without touching persisted state', async () => {
  const fixture = await evolvedFixture(), held = storeFor(fixture.redis, fixture.scopeId, { consultingWriteHold: true });
  const actions = ['start', 'message', 'close', 'finish', 'continue', 'reset', 'feedback', 'remember', 'forget',
    'confirm_fact', 'update_apa', 'publish_apa', 'discard_apa', 'approve', 'draft', 'discard'];
  for (const action of actions) await assert.rejects(held.act('nia', { action, requestId: randomUUID(), revision: fixture.saved.state.revision }), /ATHLETE_CONSULTING_READ_ONLY/u);
  for (const capture of [{ ...note(), reviewed: false }, { ...note(), role: 'athlete' }, { ...note(), channel: undefined }])
    await assert.rejects(held.act('nia', { action: 'capture_demo', capture, requestId: randomUUID(), revision: fixture.saved.state.revision }), /ATHLETE_CONSULTING_READ_ONLY/u);
  assert.equal(fixture.redis.values.get(fixture.keys.state), fixture.raw);
});

test('unverifiable evolved current APA fails unavailable without baseline fallback or repair writes', async () => {
  const fixture = await evolvedFixture();
  const corrupt = clone(fixture.saved);
  corrupt.state.currentApa.artifact.report.opening = 'Unverifiable replacement';
  const raw = reseal(corrupt);
  await fixture.redis.set(fixture.keys.state, raw);
  const held = storeFor(fixture.redis, fixture.scopeId, { consultingWriteHold: true });
  fixture.redis.evalCalls.length = 0;
  await assert.rejects(held.read('nia'), /ATHLETE_V2_STATE_CORRUPT/u);
  assert.equal(fixture.redis.values.get(fixture.keys.state), raw);
  assert.equal(fixture.redis.evalCalls.length, 0);
});

test('held reviewed Coach Connect capture appends once and never recovers pending or rewrites evolved state', async () => {
  const fixture = await evolvedFixture(), held = storeFor(fixture.redis, fixture.scopeId, { consultingWriteHold: true });
  const body = { action: 'capture_demo', capture: note(), requestId: randomUUID(), revision: fixture.saved.state.revision };
  const state = await held.act('nia', body), raw = fixture.redis.values.get(fixture.keys.state);
  assertCaptureOnly(fixture.saved, JSON.parse(raw));
  assert.equal(state.status, 'working');
  assert.equal(state.coachNoteHandoff.pending_count, 1);
  assert.equal(state.events.filter(event => event.type === 'coach_note_opened').length, 0);
  await held.act('nia', body);
  assert.equal(fixture.redis.values.get(fixture.keys.state), raw);
  await assert.rejects(held.act('nia', { ...body, capture: { ...note(), text: 'Changed replay' } }), /REQUEST_ID_REUSED/u);
  await assert.rejects(held.act('nia', { ...body, requestId: randomUUID() }), /STATE_CHANGED_RELOAD/u);
});

test('active worker lease still refuses held capture; held reads do not age or recover it', async () => {
  const fixture = await evolvedFixture(), held = storeFor(fixture.redis, fixture.scopeId, { consultingWriteHold: true });
  await fixture.redis.set(fixture.keys.lock, 'fictional-existing-worker', 'PX', 30000, 'NX');
  await assert.rejects(held.act('nia', { action: 'capture_demo', capture: note(), requestId: randomUUID(), revision: fixture.saved.state.revision }), /PLEASE_WAIT/u);
  await held.read('nia');
  assert.equal(fixture.redis.values.get(fixture.keys.state), fixture.raw);
  assert.equal(await fixture.redis.get(fixture.keys.lock), 'fictional-existing-worker');
});

test('upgrade keeps evolved data and hands the held note to only the next opening once', async () => {
  const fixture = await evolvedFixture(), held = storeFor(fixture.redis, fixture.scopeId, { consultingWriteHold: true });
  const captured = await held.act('nia', { action: 'capture_demo', capture: note(), requestId: randomUUID(), revision: fixture.saved.state.revision });
  const requests = [];
  const upgraded = storeFor(fixture.redis, fixture.scopeId, { coach: async (_bundle, state, task) => {
    requests.push({ task, notes: state.messages.filter(message => message.coach_note_handoff === 'next_opening').map(message => message.id) });
    return clone(output);
  } });
  let state = await upgraded.read('nia');
  assert.equal(requests.length, 0);
  assert.deepEqual(state.currentApa, captured.currentApa);
  assert.deepEqual(state.apaDraft, captured.apaDraft);
  assert.deepEqual(state.plan, captured.plan);
  assert.deepEqual(state.learning, captured.learning);
  assert.equal(state.status, 'active');
  assert.equal(state.pending, undefined);
  assert.equal(JSON.parse(fixture.redis.values.get(fixture.keys.state)).operations[fixture.pendingId].status, 'unknown');
  await act(upgraded, { action: 'finish' });
  state = await act(upgraded, { action: 'start' });
  assert.deepEqual(requests[0].notes, captured.coachNoteHandoff.pending_ids);
  assert.equal(state.coachNoteHandoff.pending_count, 0);
  await act(upgraded, { action: 'finish' });
  await act(upgraded, { action: 'start' });
  assert.deepEqual(requests[1].notes, []);
});

test('held V1 selector and direct API cannot invoke the legacy runtime or Consulting provider', async () => {
  const redis = new FakeRedis(), issued = await credentials(redis);
  let legacyCalls = 0;
  const handler = createAthleteLivingConsultOneShotHandlerV1({ env: heldEnv, redis,
    createRuntime: () => { legacyCalls++; throw Error('LEGACY_RUNTIME_FORBIDDEN'); } });
  assert.deepEqual((await invoke(handler, req({ url: '/api/internal/athlete-living-consult-one-shot-v1?version_only=1' }))).body, { version: 2 });
  const state = (await invoke(handler, req({ cookie: issued.cookie }))).body;
  const denied = await post(handler, issued.cookie, state, { action: 'START_MY_FIRST_SESSION' }, { actor: 'conversation' });
  assert.equal(denied.status, 503);
  assert.equal(denied.body.error, 'ATHLETE_CONSULTING_READ_ONLY');
  assert.equal(legacyCalls, 0);
  const off = createAthleteLivingConsultOneShotHandlerV1({ env: { ...heldEnv, ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'false' }, redis });
  assert.equal((await invoke(off, req())).status, 404);
});

test('held Coach Connect keeps real synthetic auth, actor, CSRF, selected-athlete and reviewed-send guards', async () => {
  const redis = new FakeRedis(), issued = await credentials(redis);
  const handler = createAthleteConsultingV2Handler({ env: heldEnv, redis, coach: forbiddenProvider });
  assert.equal((await invoke(handler, req())).status, 401);
  let state = (await invoke(handler, req({ cookie: issued.cookie }))).body;
  const operation = { action: 'capture_demo', capture: note() };
  assert.equal((await post(handler, issued.cookie, state, operation, { actor: 'athlete' })).body.error, 'ACTOR_AUTHORITY_DENIED');
  assert.equal((await post(handler, issued.cookie, state, operation, { request: { origin: 'https://hostile.invalid' } })).status, 403);
  const cross = await post(handler, issued.cookie, state, operation, { request: { slug: 'sofia' } });
  assert.equal(cross.body.error, 'ACTOR_AUTHORITY_DENIED');
  const sofia = (await invoke(handler, req({ cookie: issued.cookie, slug: 'sofia' }))).body;
  const crossedProof = await invoke(handler, req({ method: 'POST', kind: 'action', slug: 'sofia', cookie: issued.cookie,
    body: bodyFor(sofia, { ...operation, capture: note('sofia') }),
    headers: { 'x-athlete-consulting-csrf': state._transport.csrf } }));
  assert.equal(crossedProof.body.error, 'CSRF_DENIED');
  state = (await invoke(handler, req({ cookie: issued.cookie }))).body;
  const unreviewed = await post(handler, issued.cookie, state, { ...operation, capture: { ...note(), reviewed: false } });
  assert.notEqual(unreviewed.status, 200);
  state = (await invoke(handler, req({ cookie: issued.cookie }))).body;
  const saved = await post(handler, issued.cookie, state, operation);
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.messages.length, 1);
  assert.equal(saved.body.coachNoteHandoff.pending_count, 1);
  assert.equal(saved.body.currentApa, null);
  assert.equal(saved.body.plan, null);
  assert.deepEqual(saved.body.learning, []);
  const replay = await post(handler, issued.cookie, state, operation);
  assert.equal(replay.body.error, 'CSRF_DENIED');
});

test('native held state and authenticated note append preserve the same exact pending evolved envelope', async () => {
  const redis = new FakeRedis(), issued = await credentials(redis);
  const fixture = await evolvedFixture(redis, issued.scopeId);
  const handler = createAthleteConsultingV2Handler({ env: heldEnv, redis, coach: forbiddenProvider });
  const before = await invoke(handler, req({ cookie: issued.cookie }));
  assert.equal(before.status, 200);
  assert.equal(before.body.currentApa.version, 1);
  assert.equal(before.body.apaDraft.previewRecord.version, 2);
  assert.equal(before.body.status, 'working');
  assert.equal(redis.values.get(fixture.keys.state), fixture.raw);
  const saved = await post(handler, issued.cookie, before.body, { action: 'capture_demo', capture: note() });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assertCaptureOnly(fixture.saved, JSON.parse(redis.values.get(fixture.keys.state)));
  assert.deepEqual(saved.body.pending, before.body.pending);
  assert.deepEqual(saved.body.currentApa, before.body.currentApa);
  assert.deepEqual(saved.body.apaDraft, before.body.apaDraft);
});

test('held voice keeps independent flag, instructor and one-attempt guards without Consulting persistence', async () => {
  const redis = new FakeRedis(), issued = await credentials(redis); let calls = 0;
  const handler = createAthleteConsultingV2Handler({ env: heldEnv, redis, coach: forbiddenProvider,
    transcribe: async () => { calls++; return 'Editable fictional voice text.'; } });
  const audio = { mime: 'audio/mp4', data: Buffer.concat([Buffer.from([0, 0, 0, 20, 102, 116, 121, 112]), Buffer.alloc(1000)]).toString('base64') };
  let state = (await invoke(handler, req({ cookie: issued.cookie }))).body;
  const voice = { action: 'transcribe_coach_voice', audio };
  assert.equal((await post(handler, issued.cookie, state, voice, { kind: 'transcribe', actor: 'athlete' })).body.error, 'ACTOR_AUTHORITY_DENIED');
  const result = await post(handler, issued.cookie, state, voice, { kind: 'transcribe' });
  assert.equal(result.status, 200);
  assert.equal(result.body.saved_audio, false);
  state = (await invoke(handler, req({ cookie: issued.cookie }))).body;
  assert.equal(state.messages.length, 0);
  assert.equal((await post(handler, issued.cookie, state, voice, { kind: 'transcribe' })).status, 200);
  assert.equal(calls, 1);
  const keys = athleteConsultingV2Keys({ scopeId: issued.scopeId, slug: 'nia', bundle: bundles.nia });
  assert.equal(redis.values.has(keys.state), false);
  const off = createAthleteConsultingV2Handler({ env: { ...heldEnv, ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'false' }, redis, coach: forbiddenProvider });
  state = (await invoke(off, req({ cookie: issued.cookie }))).body;
  assert.equal((await post(off, issued.cookie, state, voice, { kind: 'transcribe' })).status, 404);
});
