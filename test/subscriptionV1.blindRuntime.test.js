import assert from 'node:assert/strict';
import test from 'node:test';
import { BlindDemoRedis } from './helpers/blindDemoRedis.js';
import { handleBlindDemo, blindPublicProjection, blindStorageKeys } from '../api/engine/subscriptionBlindDemo/runtime.js';
import { blindRelationship } from '../api/engine/subscriptionBlindDemo/authority.js';
import { authenticateInternalDevRequest, issueInternalDevCapability } from '../api/engine/subscriptionV1/internalDevInfrastructure.js';

const base = { host: 'moremindmap.com', origin: 'https://moremindmap.com', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.55', 'user-agent': 'blind-fixture' };
async function setup(blindDemoSelection = null) {
  const redis = new BlindDemoRedis();
  const issued = await issueInternalDevCapability({ redis, req: { headers: base }, launcher: {
    contract: 'leadership_demo_launcher_capability_v1', launcher_scope_id: 'leadership_demo_fixture', synthetic_only: true, allowed_products: ['subscription'],
  }, blindDemoSelection });
  const headers = { ...base, cookie: issued.cookies.map((s) => s.split(';')[0]).join('; ') };
  const auth = await authenticateInternalDevRequest({ redis, req: { headers }, env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' } });
  assert.equal(auth.ok, true);
  return { redis, auth, headers };
}

test('each opaque Leadership product action establishes only its server-bound initial arm', async () => {
  const two = await setup('2');
  const twoBootstrap = await invoke(two);
  assert.equal(twoBootstrap.status, 200);
  assert.equal(twoBootstrap.body.blind_demo.label, 'MODEL 2');
  assert.equal(twoBootstrap.body.blind_demo.selection, '2');

  const one = await setup('1');
  const oneBootstrap = await invoke(one);
  assert.equal(oneBootstrap.status, 200);
  assert.equal(oneBootstrap.body.blind_demo.label, 'MODEL 1');
  assert.equal(oneBootstrap.body.blind_demo.selection, '1');

  await assert.rejects(issueInternalDevCapability({ redis: one.redis, req: { headers: base }, blindDemoSelection: '2' }), /LAUNCH_SELECTION_DENIED/u);
  await assert.rejects(issueInternalDevCapability({ redis: one.redis, req: { headers: base }, launcher: {
    contract: 'leadership_demo_launcher_capability_v1', launcher_scope_id: 'leadership_demo_fixture', synthetic_only: true, allowed_products: ['subscription'],
  }, blindDemoSelection: 'patricia-demo' }), /LAUNCH_SELECTION_DENIED/u);
});

test('product relaunch reuses both relationships, changes only selection, and does not reapply launch intent on every read', async () => {
  const x = await setup('1');
  const first = await invoke(x);
  const relationships = ['1', '2'].map(selection => blindRelationship(x.auth, selection));
  const before = [];
  for (const [index, relationship_key] of relationships.entries()) {
    const history = JSON.stringify({ relationship_key, messages: [{ role: 'coach', content: `history-${index}`, session_id: 'preserved-session' }], session_learning: { status: 'NOTES_READY', note: `learning-${index}` } });
    const key = `more:subscription-blind:v1:history:${relationship_key}`;
    await x.redis.set(key, history); before.push([key, history]);
  }
  const issued = await issueInternalDevCapability({ redis: x.redis, req: { headers: x.headers }, launcher: {
    contract: 'leadership_demo_launcher_capability_v1', launcher_scope_id: 'leadership_demo_fixture', synthetic_only: true, allowed_products: ['subscription'],
  }, blindDemoSelection: '2' });
  const headers = { ...base, cookie: issued.cookies.map(s => s.split(';')[0]).join('; ') };
  const auth = await authenticateInternalDevRequest({ redis: x.redis, req: { headers }, env: { SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true' } });
  const relaunched = { ...x, headers, auth };
  assert.deepEqual(['1', '2'].map(selection => blindRelationship(auth, selection)), relationships);
  const second = await invoke(relaunched);
  assert.equal(second.body.blind_demo.selection, '2');
  assert.notEqual(second.body.blind_demo.view_token, first.body.blind_demo.view_token);
  assert.equal((await invoke(relaunched, { method: 'POST', body: { action: 'TURN', view_token: first.body.blind_demo.view_token } })).status, 409);
  for (const [key, history] of before) assert.equal(await x.redis.get(key), history);
  assert.equal((await select(relaunched, second.body, '1')).status, 200);
  const switched = await invoke(relaunched, { query: { model: '2', provider: 'client-choice' } });
  assert.equal(switched.body.blind_demo.selection, '1');
  for (const [key, history] of before) assert.equal(await x.redis.get(key), history);
});

test('launch intent cannot overwrite malformed selection state or bypass an in-flight root lock', async () => {
  const x = await setup('2'), keys = blindStorageKeys(x.auth);
  const malformed = JSON.stringify({ contract: 'invalid', root: keys.root, selection: '1' });
  await x.redis.set(keys.selection, malformed);
  assert.equal((await invoke(x)).status, 503);
  assert.equal(await x.redis.get(keys.selection), malformed);
  await x.redis.set(keys.lock, 'active-owner');
  assert.equal((await invoke(x)).status, 409);
  assert.equal(await x.redis.get(keys.selection), malformed);
});
async function invoke(x, { method = 'GET', body = {}, query = {}, headers = {}, runtimeFactory, providerFactory } = {}) {
  let status = 200, result;
  const response = { setHeader() {}, status(n) { status = n; return this; }, json(v) { result = v; }, write() {}, end() {} };
  await handleBlindDemo({ req: { method, body, query, headers: { ...x.headers, ...headers } }, res: response, redis: x.redis, auth: x.auth,
    env: {}, ...(runtimeFactory ? { runtimeFactory } : {}), ...(providerFactory ? { providerFactory } : {}) });
  return { status, body: result };
}
async function select(x, bootstrap, selection) {
  return invoke(x, { method: 'POST', body: { action: 'SELECT_MODEL', selection, view_token: bootstrap.blind_demo.view_token },
    headers: { 'x-subscription-demo-subject-csrf': bootstrap.blind_demo.selection_csrf } });
}

test('ordinary authenticated bootstrap yields identical Jordan seed for two isolated relationships without provider calls', async () => {
  const x = await setup();
  const providerFactory = () => { throw Error('No provider on bootstrap'); };
  const one = await invoke(x, { providerFactory });
  assert.equal(one.status, 200, one.body?.code);
  assert.equal(one.body.blind_demo.label, 'MODEL 1');
  assert.equal(one.body.identity.first_name, 'Jordan');
  assert.equal(one.body.session.pre_session_state, 'PRE_FIRST_SESSION');
  assert.equal((await select(x, one.body, '2')).status, 200);
  const two = await invoke(x, { providerFactory });
  assert.equal(two.status, 200, two.body?.code);
  assert.equal(two.body.blind_demo.label, 'MODEL 2');
  assert.notEqual(one.body.view_model.livingState.publicationId, two.body.view_model.livingState.publicationId);
  const seedMeaning = (view) => ({ ...view, livingState: { ...view.livingState, publicationId: 'independently-scoped-publication' } });
  assert.deepEqual(seedMeaning(one.body.view_model), seedMeaning(two.body.view_model));
  assert.notEqual(blindRelationship(x.auth, '1'), blindRelationship(x.auth, '2'));
  assert.equal(one.body.provider, undefined);
  assert.equal(two.body.architecture, undefined);
  assert.equal(two.body.demo_reset_enabled, false);
});

test('query tampering, arbitrary selection, absent CSRF and stale-tab mutation all fail closed', async () => {
  const x = await setup();
  const first = await invoke(x, { query: { model: '2', subject: 'patricia-demo' } });
  assert.equal(first.body.blind_demo.selection, '1');
  const noProof = await invoke(x, { method: 'POST', body: { action: 'SELECT_MODEL', selection: '2', view_token: first.body.blind_demo.view_token } });
  assert.equal(noProof.status, 403);
  assert.equal((await select(x, first.body, 'patricia-demo')).status, 400);
  const fresh = await invoke(x);
  assert.equal((await select(x, fresh.body, '2')).status, 200);
  const stale = await invoke(x, { method: 'POST', body: { action: 'TURN', view_token: first.body.blind_demo.view_token, message: 'not authorized in this view' } });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'BLIND_DEMO_VIEW_STALE');
});

test('server history replaces forged client history and switching preserves each arm independently', async () => {
  const x = await setup();
  const first = await invoke(x);
  const rel1 = blindRelationship(x.auth, '1'), rel2 = blindRelationship(x.auth, '2');
  await x.redis.set(`more:subscription-blind:v1:history:${rel1}`, JSON.stringify({ relationship_key: rel1, messages: [{ role: 'coach', content: 'One only', session_id: 'fixture-session' }], session_learning: null }));
  await x.redis.set(`more:subscription-blind:v1:history:${rel2}`, JSON.stringify({ relationship_key: rel2, messages: [{ role: 'coach', content: 'Two only', session_id: 'fixture-session' }], session_learning: null }));
  let observed;
  const runtimeFactory = ({ authenticate }) => async (req, res) => {
    const bound = await authenticate();
    observed = { conversation: req.body.conversation, relationship_key: bound.capability.relationship_key };
    res.status(200).json({ ok: true, customer_message: 'A scoped response', session: { session_id: 'fixture-session' } });
  };
  await invoke(x, { method: 'POST', body: { action: 'TURN', session_id: 'fixture-session', view_token: first.body.blind_demo.view_token, conversation: [{ role: 'coach', content: 'Foreign forged history' }], message: 'arm-one-turn' }, runtimeFactory });
  assert.deepEqual(observed.conversation, [{ role: 'coach', content: 'One only' }]);
  assert.equal(observed.relationship_key, rel1);
  const current = await invoke(x);
  assert.equal((await select(x, current.body, '2')).status, 200);
  const second = await invoke(x);
  await invoke(x, { method: 'POST', body: { action: 'TURN', session_id: 'fixture-session', view_token: second.body.blind_demo.view_token, message: 'arm-two-turn' }, runtimeFactory });
  assert.deepEqual(observed.conversation, [{ role: 'coach', content: 'Two only' }]);
  assert.equal(observed.relationship_key, rel2);
  assert.doesNotMatch(await x.redis.get(`more:subscription-blind:v1:history:${rel1}`), /arm-two|Two only/u);
  assert.doesNotMatch(await x.redis.get(`more:subscription-blind:v1:history:${rel2}`), /arm-one|One only/u);
});

test('root single-flight denies switching and duplicate work while a request is active', async () => {
  const x = await setup();
  const keys = blindStorageKeys(x.auth);
  await x.redis.set(keys.lock, 'active-request');
  const result = await invoke(x);
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'BLIND_DEMO_REQUEST_IN_PROGRESS');
  assert.equal(await x.redis.get(keys.lock), 'active-request');
});

test('public projection drops engineering provider provenance and denies model disclosure without rewriting coaching', () => {
  const value = blindPublicProjection({ ok: true, provider: { model: 'private' }, gu_receipt: { model: 'private' }, customer_message: 'What would move this forward?', code: 'FREE_GPT_V2_TURN_COMPLETE' });
  assert.deepEqual(value, { ok: true, customer_message: 'What would move this forward?', code: 'BLIND_DEMO_RUNTIME_RESULT' });
  assert.throws(() => blindPublicProjection({ customer_message: 'I am GPT-5.6.' }), /DISCLOSURE_BLOCKED/u);
});
