import assert from 'node:assert/strict';
import process from 'node:process';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { FakeRedis } from '../scripts/athlete-consulting-v2-review/fakeRedis.mjs';

// These process-local values are synthetic test fixtures. No existing access
// code, Redis URL or provider credential is read or copied into this test.
const env = Object.freeze({
  RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
  SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
  ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true',
  ATHLETE_CONSULTING_V2_ENABLED: 'true',
});
const entryRedis = new FakeRedis();
globalThis[Symbol.for('athlete-v2-test-redis')] = entryRedis;
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'ioredis') return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent("export default class Redis { constructor() { return globalThis[Symbol.for('athlete-v2-test-redis')]; } }")}` };
  return nextResolve(specifier, context);
} });
Object.assign(process.env, env, { REDIS_URL: 'redis://synthetic-fixture.invalid:1', LEADERSHIP_DEMO_ACCESS_CODE: 'synthetic-test-entry-only', OPENAI_API_KEY: '' });
const { default: leadershipEntry } = await import('../api/internal/leadership-demo-entry.js');
const { createAthleteConsultingV2Handler } = await import('../server/athleteConsultingV2/handler.js');
const { createAthleteLivingConsultOneShotHandlerV1 } = await import('../api/internal/athlete-living-consult-one-shot-v1.js');
const { issueLeadershipLauncherCapability, issueAthleteConsultingDemoCapability, authenticateAthleteConsultingDemoRequest } = await import('../api/engine/leadershipDemo/authority.js');
const { bundles, binding } = await import('../server/athleteConsultingV2/bundles.js');
const { athleteConsultingV2Keys } = await import('../server/athleteConsultingV2/store.js');
hooks.deregister();

const cookiePair = (cookie) => String(cookie).split(';')[0];
function req({ method = 'GET', cookie = '', kind = 'state', slug = 'nia', body = null, origin = 'https://moremindmap.com', headers = {}, url } = {}) {
  const target = url || `/api/internal/athlete-living-consult-one-shot-v1?kind=${kind}&athlete=${slug}`;
  return { method, url: target, query: Object.fromEntries(new URL(target, 'https://moremindmap.com').searchParams), body,
    headers: { host: 'moremindmap.com', origin, 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.55',
      'user-agent': 'Athlete V2 synthetic offline browser', cookie, ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...headers }, socket: {} };
}
async function invoke(handler, request) {
  const response = { statusCode: 200, headers: {}, chunks: [],
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    json(value) { this.payload = value; return this; },
    write(value) { this.chunks.push(String(value)); },
    end(value = '') { this.chunks.push(String(value)); this.ended = true; },
  };
  await handler(request, response);
  return { status: response.statusCode, body: response.payload ?? JSON.parse(response.chunks.join('') || '{}'), headers: response.headers };
}
async function capability(redis, selectedEnv = env) {
  const launcher = await issueLeadershipLauncherCapability({ redis, req: req(), env: selectedEnv });
  const issued = await issueAthleteConsultingDemoCapability({ redis, req: req(), launcher: launcher.capability, env: selectedEnv });
  return { ...issued, cookie: cookiePair(issued.cookie) };
}
function setup(redis = new FakeRedis()) {
  const calls = [];
  const coach = async (bundle, state, task) => {
    calls.push({ slug: bundle.person.slug, task, messages: state.messages.length });
    return { reply: `Offline structural ${task} for ${bundle.person.slug}.`, plan: null, plan_change: 'none', retire_draft: false, learning: [], recap: task === 'CLOSE' ? 'Offline structural recap.' : '' };
  };
  return { redis, calls, handler: createAthleteConsultingV2Handler({ env, redis, coach }) };
}
async function stateOf(handler, cookie, slug = 'nia') {
  const result = await invoke(handler, req({ cookie, slug }));
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}
function operation(state, action, requestId, data = {}, role = 'conversation') {
  return { action, requestId, revision: state.revision, proof_revision: state._transport.revision,
    state_hash: state._transport.state_hash, actor_capability: state._transport.actors[role], ...data };
}
async function act(handler, cookie, state, action, requestId, data = {}, role = 'conversation', slug = 'nia') {
  return invoke(handler, req({ method: 'POST', cookie, slug, kind: 'action', body: operation(state, action, requestId, data, role),
    headers: { 'x-athlete-consulting-csrf': state._transport.csrf } }));
}

test('real shared Leadership entry and launcher issue Nia/Sofia under V2 using one-time proofs', async () => {
  entryRedis.clear(); Object.assign(process.env, env);
  const prepared = await invoke(leadershipEntry, req({ url: '/api/internal/leadership-demo-entry' }));
  assert.equal(prepared.status, 200);
  const enterRequest = req({ method: 'POST', url: '/api/internal/leadership-demo-entry', body: { action: 'ENTER', access_code: 'synthetic-test-entry-only' },
    headers: { 'x-leadership-demo-entry-csrf': prepared.body.csrf_token } });
  const entered = await invoke(leadershipEntry, enterRequest);
  assert.equal(entered.status, 200);
  assert.equal(entered.body.redirect_to, '/leadership-demo');
  assert.equal((await invoke(leadershipEntry, enterRequest)).status, 403);
  const launcherCookie = cookiePair(entered.headers['set-cookie']);
  const launcher = await invoke(leadershipEntry, req({ cookie: launcherCookie, url: '/api/internal/leadership-demo-entry?view=launcher' }));
  assert.deepEqual(launcher.body.choices.map((item) => item.id), ['recruiting', 'subscription-model-1', 'subscription-model-2', 'athlete-consulting-tool']);
  assert.equal(launcher.body.choices.find(item => item.id === 'athlete-consulting-tool').version, 2);
  process.env.ATHLETE_CONSULTING_V2_ENABLED = 'false';
  const legacyLauncher = await invoke(leadershipEntry, req({ cookie: launcherCookie, url: '/api/internal/leadership-demo-entry?view=launcher' }));
  assert.deepEqual(legacyLauncher.body.choices.find(item => item.id === 'athlete-consulting-tool'), { id: 'athlete-consulting-tool', title: 'ATHLETE CONSULTING TOOL' });
  process.env.ATHLETE_CONSULTING_V2_ENABLED = 'true';
  const launchRequest = req({ method: 'POST', cookie: launcherCookie, url: '/api/internal/leadership-demo-entry', body: { action: 'LAUNCH_ATHLETE_CONSULTING_TOOL' },
    headers: { 'x-leadership-demo-launch-csrf': launcher.body.csrf_token } });
  const launched = await invoke(leadershipEntry, launchRequest);
  assert.equal(launched.status, 200);
  assert.equal(launched.body.redirect_to, '/athlete-consulting-tool/demo');
  assert.match(launched.headers['set-cookie'], /HttpOnly; Secure; SameSite=Strict/u);
  const auth = await authenticateAthleteConsultingDemoRequest({ redis: entryRedis, env, req: req({ cookie: cookiePair(launched.headers['set-cookie']) }) });
  assert.equal(auth.ok, true);
  assert.deepEqual(auth.capability.allowed_subjects, ['nia', 'sofia']);
  assert.equal(auth.capability.synthetic_only, true);
  assert.equal((await invoke(leadershipEntry, launchRequest)).status, 403);
  const wrong = await invoke(leadershipEntry, req({ method: 'POST', url: '/api/internal/leadership-demo-entry', origin: 'https://hostile.invalid', body: { action: 'ENTER' } }));
  assert.equal(wrong.status, 403);
});

test('V2 off preserves Mika/Avery capability and legacy dispatcher; enabled V2 rejects old capability', async () => {
  const redis = new FakeRedis(), off = { ...env, ATHLETE_CONSULTING_V2_ENABLED: 'false' };
  const legacy = await capability(redis, off);
  assert.deepEqual(legacy.capability.allowed_subjects, ['mika', 'avery']);
  assert.equal((await authenticateAthleteConsultingDemoRequest({ redis, env: off, req: req({ cookie: legacy.cookie }) })).ok, true);
  assert.equal((await authenticateAthleteConsultingDemoRequest({ redis, env, req: req({ cookie: legacy.cookie }) })).ok, false);
  const legacyDispatcher = createAthleteLivingConsultOneShotHandlerV1({ env: off, redis });
  const read = await invoke(legacyDispatcher, req({ cookie: legacy.cookie, url: '/api/internal/athlete-living-consult-one-shot-v1?fixture=mika' }));
  assert.equal(read.status, 200);
  assert.equal(read.body.fixture_id, 'mika');
  assert.equal(read.body.code, 'ATHLETE_LIVING_CONSULT_BOOTSTRAPPED');
  const v2 = createAthleteLivingConsultOneShotHandlerV1({ env, redis });
  assert.equal((await invoke(v2, req({ cookie: legacy.cookie, kind: 'bundle' }))).status, 401);
  const modern = await capability(redis);
  const bundled = await invoke(v2, req({ cookie: modern.cookie, kind: 'bundle', slug: 'sofia' }));
  assert.equal(bundled.status, 200);
  assert.equal(bundled.body.person.slug, 'sofia');
  assert.equal((await invoke(v2, req({ cookie: modern.cookie, slug: 'mika' }))).status, 403);
});

test('composite flags fail before Redis and public version probe reveals only selected version', async () => {
  const redis = new FakeRedis();
  for (const key of Object.keys(env)) {
    const handler = createAthleteConsultingV2Handler({ env: { ...env, [key]: 'false' }, redis });
    assert.equal((await invoke(handler, req())).status, 404);
  }
  assert.equal(redis.calls.length, 0);
  for (const version of [1, 2]) {
    const dispatcher = createAthleteLivingConsultOneShotHandlerV1({ env: { ...env, ATHLETE_CONSULTING_V2_ENABLED: version === 2 ? 'true' : 'false' }, redis });
    assert.deepEqual((await invoke(dispatcher, req({ url: '/api/internal/athlete-living-consult-one-shot-v1?version_only=1' }))).body, { version });
  }
  assert.equal(redis.calls.length, 0);
});

test('unauthenticated bundle/registry/state and forged or wrong-scope authorities fail closed', async () => {
  const { redis, handler, calls } = setup();
  for (const kind of ['bundle', 'registry', 'state']) assert.equal((await invoke(handler, req({ kind }))).status, 401);
  const issued = await capability(redis);
  assert.equal((await invoke(handler, req({ cookie: issued.cookie, kind: 'bundle', origin: 'https://hostile.invalid' }))).status, 403);
  assert.equal((await invoke(handler, req({ cookie: issued.cookie, kind: 'bundle', headers: { 'user-agent': 'another browser' } }))).status, 401);
  const capKey = `more:leadership-demo:v1:athlete-consulting:${issued.capability_hash}`;
  for (const mutation of [{ synthetic_only: false }, { allowed_product: 'subscription' }, { demo_scope_id: '' }, { allowed_subjects: ['sofia', 'nia'] }]) {
    await redis.set(capKey, JSON.stringify({ ...issued.capability, ...mutation }));
    assert.equal((await invoke(handler, req({ cookie: issued.cookie, kind: 'bundle' }))).status, 401);
  }
  assert.equal(calls.length, 0);
  assert.equal([...redis.values.keys()].some((key) => key.startsWith('more:athlete-consulting-demo:v2:')), false);
});

test('registry selection and bundled report bindings are exact and remain isolated from state writes', async () => {
  const { redis, handler, calls } = setup(), issued = await capability(redis);
  const registry = await invoke(handler, req({ cookie: issued.cookie, kind: 'registry' }));
  assert.equal(registry.status, 200);
  assert.match(registry.headers['cache-control'], /no-store/u);
  for (const slug of ['nia', 'sofia']) {
    const result = await invoke(handler, req({ cookie: issued.cookie, kind: 'bundle', slug }));
    assert.equal(result.status, 200);
    assert.equal(result.body.person.mm, bundles[slug].person.mm);
    assert.equal(result.body.bos.artifact_sha256, binding(slug).bos);
    assert.equal(result.body.apa.artifact_sha256, binding(slug).apa);
  }
  assert.equal(calls.length, 0);
  assert.equal([...redis.values.keys()].some((key) => key.endsWith(':state')), false);
});

test('JSON, payload, actor-capability and cross-athlete proof rejection precede state mutation', async () => {
  const { redis, handler, calls } = setup(), issued = await capability(redis);
  const nia = await stateOf(handler, issued.cookie), sofia = await stateOf(handler, issued.cookie, 'sofia');
  const original = operation(nia, 'start', 'actor-start');
  const request = { method: 'POST', cookie: issued.cookie, kind: 'action', body: original, headers: { 'x-athlete-consulting-csrf': nia._transport.csrf } };
  assert.equal((await invoke(handler, req({ ...request, headers: { ...request.headers, 'content-type': 'text/plain' } }))).status, 415);
  assert.equal((await invoke(handler, req({ ...request, body: { ...original, actor_capability: 'typed-athlete-is-not-authority' } }))).body.error, 'ACTOR_AUTHORITY_DENIED');
  assert.equal((await invoke(handler, req({ ...request, body: { ...original, actor_capability: nia._transport.actors.athlete } }))).body.error, 'ACTOR_AUTHORITY_DENIED');
  const wrongAthlete = await invoke(handler, req({ ...request, slug: 'sofia', body: operation(sofia, 'start', 'cross-athlete-start') }));
  assert.equal(wrongAthlete.body.error, 'CSRF_DENIED');
  const tooLarge = await invoke(handler, req({ ...request, body: { ...original, text: 'x'.repeat(50001) } }));
  assert.equal(tooLarge.status, 422);
  assert.equal(tooLarge.body.error, 'REQUEST_TOO_LARGE');
  assert.equal(calls.length, 0);
  assert.equal([...redis.values.keys()].some((key) => key.endsWith(':state')), false);
  const started = await invoke(handler, req(request));
  assert.equal(started.status, 200);
  assert.equal(started.body.status, 'active');
  assert.equal(calls.length, 1);
  const consumed = await invoke(handler, req(request));
  assert.equal(consumed.body.error, 'CSRF_DENIED');
  assert.equal(calls.length, 1);
});

test('unused CSRF cannot authorize a later revision by substituting current operation revision', async () => {
  const { redis, handler, calls } = setup(), issued = await capability(redis);
  const stale = await stateOf(handler, issued.cookie), fresh = await stateOf(handler, issued.cookie);
  const started = await act(handler, issued.cookie, fresh, 'start', 'revision-start');
  assert.equal(started.status, 200);
  const forged = await act(handler, issued.cookie, stale, 'message', 'stale-proof-current-revision', { revision: started.body.revision, text: 'This stale proof must be denied.' });
  assert.equal(forged.status, 403);
  assert.equal(forged.body.error, 'CSRF_DENIED');
  assert.equal(calls.length, 1);
});

test('wrong proof revision, altered state hash, expired proof and other browser capability are denied', async () => {
  const { redis, handler, calls } = setup(), one = await capability(redis), two = await capability(redis);
  for (const change of [{ proof_revision: 10 }, { state_hash: 'f'.repeat(64) }]) {
    const state = await stateOf(handler, one.cookie);
    const result = await act(handler, one.cookie, state, 'start', 'wrong-proof', change);
    assert.equal(result.body.error, 'CSRF_DENIED');
  }
  const old = await stateOf(handler, one.cookie), other = await stateOf(handler, two.cookie);
  const crossed = await invoke(handler, req({ method: 'POST', cookie: two.cookie, kind: 'action',
    body: operation(other, 'start', 'other-browser'), headers: { 'x-athlete-consulting-csrf': old._transport.csrf } }));
  assert.equal(crossed.body.error, 'CSRF_DENIED');
  redis.advance(5 * 60 * 1000 + 1);
  assert.equal((await act(handler, one.cookie, old, 'start', 'expired-proof')).body.error, 'CSRF_DENIED');
  assert.equal(calls.length, 0);
});

test('state survives cold handlers, separates athlete and launcher scopes, and reset archives only the selected state', async () => {
  const { redis, handler, calls } = setup(), one = await capability(redis), two = await capability(redis);
  let nia = await stateOf(handler, one.cookie);
  nia = (await act(handler, one.cookie, nia, 'start', 'isolation-start')).body;
  nia = (await act(handler, one.cookie, nia, 'message', 'isolation-message', { text: 'Fictional Nia discussion.' })).body;
  const sofia = await stateOf(handler, one.cookie, 'sofia'), otherScope = await stateOf(handler, two.cookie);
  assert.equal(sofia.messages.length, 0); assert.equal(otherScope.messages.length, 0);
  const cold = setup(redis).handler;
  const recovered = await stateOf(cold, one.cookie);
  assert.deepEqual(recovered.messages, nia.messages);
  assert.equal(recovered.revision, nia.revision);
  const keys = athleteConsultingV2Keys({ scopeId: one.capability.demo_scope_id, slug: 'nia', bundle: bundles.nia });
  const beforeReset = await redis.get(keys.state);
  const reset = await act(handler, one.cookie, recovered, 'reset', 'isolation-reset', {}, 'shared_editor');
  assert.equal(reset.status, 200); assert.equal(reset.body.messages.length, 0); assert.equal(reset.body.status, 'ready');
  const backup = [...redis.values.keys()].find((key) => key.startsWith(`${keys.backup}:`));
  assert.equal(await redis.get(backup), beforeReset);
  assert.equal((await stateOf(handler, one.cookie, 'sofia')).revision, sofia.revision);
  assert.equal((await stateOf(handler, two.cookie)).revision, otherScope.revision);
  assert.equal(calls.length, 2);
  assert.equal([...redis.values.keys()].some((key) => key.startsWith('more:subscription-v1:')), false);
  assert.equal([...redis.values.keys()].some((key) => key.startsWith('more:athlete-consulting-demo:v1:')), false);
});

test('same semantic operation replays with a fresh proof and conflicting request ID cannot mutate', async () => {
  const { redis, handler, calls } = setup(), issued = await capability(redis);
  const initial = await stateOf(handler, issued.cookie);
  const started = await act(handler, issued.cookie, initial, 'start', 'replay-start');
  assert.equal(started.status, 200);
  const fresh = await stateOf(handler, issued.cookie);
  const replay = await act(handler, issued.cookie, fresh, 'start', 'replay-start');
  assert.equal(replay.status, 200);
  assert.equal(replay.body.revision, started.body.revision);
  assert.deepEqual(replay.body.messages, started.body.messages);
  assert.equal(calls.length, 1);
  const conflict = await act(handler, issued.cookie, replay.body, 'message', 'replay-start', { text: 'Different meaning.' });
  assert.equal(conflict.status, 422); assert.equal(conflict.body.error, 'REQUEST_ID_REUSED');
  assert.equal(calls.length, 1);
});

test('role-specific agreement cannot be fabricated from conversation or another actor capability', async () => {
  const { redis, handler } = setup(), issued = await capability(redis);
  const initial = await stateOf(handler, issued.cookie);
  const plan = { title: 'Fictional shared plan', why: 'Offline proof', review: 'Next conversation', steps: [
    { action: 'Notice one moment.', when: 'Next practice', notice: 'How it felt', owner: 'athlete' },
    { action: 'Discuss the observation.', when: 'After practice', notice: 'Athlete perspective', owner: 'coach' },
  ] };
  const drafted = await act(handler, issued.cookie, initial, 'draft', 'role-draft', { plan }, 'shared_editor');
  assert.equal(drafted.status, 200);
  const body = { id: drafted.body.draft.id, hash: drafted.body.draft.hash, actor: 'coach' };
  const forged = await act(handler, issued.cookie, drafted.body, 'approve', 'forged-coach-approval', body, 'athlete');
  assert.equal(forged.body.error, 'ACTOR_AUTHORITY_DENIED');
  const acceptedAthlete = await act(handler, issued.cookie, drafted.body, 'approve', 'athlete-approval', { ...body, actor: 'athlete' }, 'athlete');
  assert.equal(acceptedAthlete.status, 200); assert.equal(acceptedAthlete.body.plan, null);
  assert.deepEqual(acceptedAthlete.body.draft.approvals, ['athlete']);
  const acceptedCoach = await act(handler, issued.cookie, acceptedAthlete.body, 'approve', 'coach-approval', body, 'instructor');
  assert.equal(acceptedCoach.status, 200); assert.equal(acceptedCoach.body.draft, null);
  assert.deepEqual(acceptedCoach.body.plan.approvals, ['athlete', 'coach']);
});

test('fake Redis enforces expiry and owner checks used by actual authority and store Lua', async () => {
  const redis = new FakeRedis({ now: () => 1000 });
  assert.equal(await redis.set('proof', 'one-use', 'NX', 'EX', 3), 'OK');
  assert.equal(await redis.set('proof', 'replace', 'NX'), null);
  assert.equal(await redis.ttl('proof'), 3);
  assert.equal(await redis.getdel('proof'), 'one-use');
  assert.equal(await redis.getdel('proof'), null);
  await redis.set('lease', 'owner', 'PX', 100);
  redis.advance(101);
  assert.equal(await redis.get('lease'), null);
  assert.equal(await redis.pttl('lease'), -2);
});
