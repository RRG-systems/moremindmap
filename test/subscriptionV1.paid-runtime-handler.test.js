import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPaidSubscriptionV1RuntimeHandler,
  redactPaidRuntimePayload,
} from '../api/engine/subscriptionV1/paidRuntimeHandler.js';

class FakeRedis {
  constructor() {
    this.values = new Map();
    this.lists = new Map();
    this.calls = 0;
    this.writeCalls = [];
  }

  async get(key) { this.calls += 1; return this.values.get(key) ?? null; }
  async getdel(key) { this.calls += 1; this.writeCalls.push(['getdel', key]); const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async set(key, value, ...args) {
    this.calls += 1;
    this.writeCalls.push(['set', key]);
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async lpush(key, value) {
    this.calls += 1;
    this.writeCalls.push(['lpush', key]);
    const list = this.lists.get(key) || [];
    list.unshift(value);
    this.lists.set(key, list);
    return list.length;
  }
  async ltrim(key, start, end) {
    this.calls += 1;
    this.writeCalls.push(['ltrim', key]);
    this.lists.set(key, (this.lists.get(key) || []).slice(start, end + 1));
    return 'OK';
  }
  async expire(key) { this.calls += 1; this.writeCalls.push(['expire', key]); return 1; }
  async eval(_script, keyCount, ...parts) {
    this.calls += 1;
    const keys = parts.slice(0, keyCount);
    this.writeCalls.push(['eval', ...keys]);
    const args = parts.slice(keyCount);
    if (keyCount === 1) {
      if (this.values.get(keys[0]) !== args[0]) return 0;
      this.values.delete(keys[0]);
      return 1;
    }
    if (keyCount === 3) {
      if (this.values.get(keys[0]) !== args[0]) return 0;
      const prior = this.values.get(keys[1]);
      if (prior) this.values.set(keys[2], prior);
      this.values.set(keys[1], args[1]);
      return 1;
    }
    throw new Error('Unexpected fake Redis script');
  }
}

const scope = Object.freeze({
  subject_id: 'subject_paid_runtime_0001',
  membership_id: 'membership_paid_runtime_0001',
  tenant_id: 'tenant_paid_runtime_0001',
  profile_id: 'mm-20260911-a1b2c3d4',
  business_id: 'business_paid_runtime_0001',
});

const keys = Object.freeze({
  scope_hash: 'a'.repeat(64),
  living_state: 'paid:living',
  living_backup: 'paid:living-backup',
  living_lock: 'paid:living-lock',
  allowance: 'paid:allowance',
  allowance_backup: 'paid:allowance-backup',
  allowance_lock: 'paid:allowance-lock',
  research: 'paid:research',
  diagnostics: 'paid:diagnostics',
  s2_relationship: 'paid:first-session-relationship',
});

const entitlement = Object.freeze({
  contract_id: 'paid_entitlement',
  schema_version: '1.1.0',
  entitlement_id: 'entitlement_paid_runtime_0001',
  scope,
  stripe_customer_hash: 'b'.repeat(64),
  stripe_subscription_hash: 'c'.repeat(64),
  state: 'ACTIVE',
  billing_cycle_start: '2020-01-01T00:00:00.000Z',
  billing_cycle_end: '2099-01-01T00:00:00.000Z',
  access_ends_at: null,
  source_event_ids: ['evt_paid_runtime_0001'],
  projected_at: '2026-09-11T12:00:00.000Z',
  policy_version: 'subscription_v1_paid_runtime_test',
});

const membershipContext = Object.freeze({
  authenticated: true,
  membership_verified: true,
  binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
  scope,
});

function request({ method = 'GET', query = {}, body = {}, csrf = null, accept = 'application/json', origin } = {}) {
  return {
    method,
    query,
    body,
    headers: {
      host: 'moremindmap.test',
      origin: origin ?? (method === 'GET' ? '' : 'https://moremindmap.test'),
      'x-forwarded-proto': 'https',
      accept,
      ...(csrf ? { 'x-subscription-runtime-csrf': csrf } : {}),
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function invoke(handler, req) {
  let status = 200;
  let body = null;
  const headers = {};
  await handler(req, {
    statusCode: 200,
    status(value) { status = value; this.statusCode = value; return this; },
    setHeader(name, value) { headers[String(name).toLowerCase()] = value; },
    json(value) { body = value; return value; },
    write(value) { body = `${body || ''}${value}`; return true; },
    end(value) { if (value) body = `${body || ''}${value}`; },
    flush() {},
    flushHeaders() {},
  });
  return { status, body, headers };
}

function authResult() {
  return {
    ok: true,
    authenticated: true,
    capability_hash: 'd'.repeat(64),
    capability: {
      relationship_key: 'paid_runtime_relationship_0001',
      subject_key: scope.subject_id,
      paid_membership_scope: scope,
      authenticated: true,
      membership_verified: true,
      binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    },
    scope,
    paid_membership_scope: scope,
    membership_verified: true,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
  };
}

function current() {
  return {
    view_model: {
      profile_id: scope.profile_id,
      greeting: 'Welcome back.',
      provider: { name: 'forbidden-provider-value' },
      business_model: 'Customer-visible business model.',
    },
    publication: {
      profile_id: scope.profile_id,
      publication_hash: 'e'.repeat(64),
      internal_authority_id: 'forbidden-authority-value',
    },
  };
}

function loadedSubscriber() {
  const visible = current();
  return {
    scope,
    identity: {
      first_name: 'Avery',
      vertical: 'Real Estate',
      synthetic_only: false,
      demo_copy_only: false,
      profile_id: scope.profile_id,
      membership_id: 'forbidden-membership-value',
      credential: 'forbidden-credential-value',
    },
    current: visible,
    architecture: {
      model: 'forbidden-model-value',
      provider: 'forbidden-provider-value',
    },
    controller: {
      current: () => visible,
      pendingProposal: () => null,
      send: async ({ on_coaching_ready }) => {
        const result = {
          ok: true,
          code: 'SUBSCRIPTION_V1_COACHING_READY',
          customer_message: 'One useful next step is ready.',
          mutation_performed: false,
          confirmation_required: false,
          proposal: null,
          external_evidence: [{
            external_evidence_id: 'evidence_customer_visible_0001',
            source_url: 'https://example.test/evidence',
            title: 'Customer-visible evidence',
            provider: 'forbidden-provider-value',
          }],
          research: { used: false, web_search_calls: 0, source_count: 0 },
          provider_receipts: [{
            model: 'forbidden-model-value',
            provider: 'forbidden-provider-value',
            input_tokens: 1,
            output_tokens: 1,
          }],
          context_selection_receipt: {
            assignment: 'forbidden-assignment-value',
            credential: 'forbidden-credential-value',
          },
          extraction: {
            status: 'COMPLETE',
            provider: 'forbidden-provider-value',
            model: 'forbidden-model-value',
          },
          timing: { total_ms: 1 },
        };
        await on_coaching_ready?.(result);
        return result;
      },
    },
  };
}

function createHarness({ entitlementResolver = async () => entitlement } = {}) {
  const redis = new FakeRedis();
  const seen = { auth: 0, load: [], entitlement: 0, keys: [], order: [] };
  const handler = createPaidSubscriptionV1RuntimeHandler({
    redis,
    authenticate: async () => { seen.auth += 1; seen.order.push('auth'); return authResult(); },
    loadSubscriber: async (args) => { seen.load.push(args); seen.order.push('load'); return loadedSubscriber(); },
    resolveEntitlement: async (args) => { seen.entitlement += 1; seen.order.push('entitlement'); return entitlementResolver(args); },
    resolveKeys: (args) => { seen.keys.push(args); seen.order.push('keys'); return keys; },
    generateGu: async ({ event, loaded }) => ({
      ok: true,
      plan: {
        event,
        renderDecision: { render: event !== 'COACHING_MOMENT' },
        blocks: [],
        interactions: [],
      },
      receipt: {
        provider: 'forbidden-provider-value',
        model: 'forbidden-model-value',
        credential: 'forbidden-credential-value',
      },
      current: loaded.controller.current(),
    }),
    env: {},
  });
  return { handler, redis, seen };
}

function assertNoPrivateRuntimeDetails(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    'forbidden-provider-value',
    'forbidden-model-value',
    'forbidden-assignment-value',
    'forbidden-credential-value',
    'forbidden-membership-value',
    'forbidden-authority-value',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);

  const stack = [value];
  while (stack.length) {
    const currentValue = stack.pop();
    if (!currentValue || typeof currentValue !== 'object') continue;
    for (const [key, child] of Object.entries(currentValue)) {
      assert.doesNotMatch(key, /provider|diagnostic|receipt|assignment|credential/iu);
      assert.notEqual(key, 'model');
      assert.notEqual(key, 'architecture');
      assert.equal([
        'subject_id', 'membership_id', 'tenant_id', 'business_id', 'relationship_id',
        'relationship_key', 'capability_hash', 'entitlement_id', 'ledger_id',
        'stripe_customer_hash', 'stripe_subscription_hash', 'authority_id', 'authority_hash',
      ].includes(key), false, key);
      stack.push(child);
    }
  }
}

test('successful GET uses the paid subscriber projection without returning private membership identity', async () => {
  const { handler, seen } = createHarness();
  const opened = await invoke(handler, request());

  assert.equal(opened.status, 200);
  assert.deepEqual(opened.body.subscriber, { kind: 'PAID_SUBSCRIBER' });
  assert.deepEqual(opened.body.entitlement, {
    source: 'PAID_STRIPE',
    billing_evidence: true,
    stripe_mutation: false,
    same_downstream_session_contract: true,
  });
  assert.equal(opened.body.demo_subject, undefined);
  assert.equal(opened.body.demo_subject_switching, undefined);
  assert.equal(opened.body.demo_reset_enabled, undefined);
  assert.equal(opened.body.identity.profile_id, undefined);
  assert.equal(opened.body.view_model.profile_id, undefined);
  assert.equal(opened.body.publication.profile_id, undefined);
  assert.equal(opened.body.profile_id, undefined);
  assert.equal(opened.body.view_model.business_model, 'Customer-visible business model.');
  assert.equal(typeof opened.body.csrf_token, 'string');
  assert.equal(seen.auth, 1);
  assert.equal(seen.load.length, 1);
  assert.ok(seen.order.indexOf('entitlement') < seen.order.indexOf('load'));
  assert.deepEqual(seen.load[0].membership_context, membershipContext);
  assert.deepEqual(seen.keys[0].scope, scope);
  assertNoPrivateRuntimeDetails(opened.body);
});

test('missing or suspended paid entitlement stops before subscriber loading, CSRF, or durable writes', async (t) => {
  const cases = [
    {
      name: 'missing entitlement',
      resolve: async () => { throw new Error('PAID_ENTITLEMENT_RECONCILIATION_REQUIRED'); },
      status: 503,
      code: 'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE',
    },
    {
      name: 'suspended entitlement',
      resolve: async () => ({ ...entitlement, state: 'SUSPENDED_PAYMENT' }),
      status: 409,
      code: 'ENTITLEMENT_SUSPENDED_PAYMENT',
    },
  ];

  for (const candidate of cases) {
    for (const method of ['GET', 'POST']) {
      await t.test(`${candidate.name} on ${method}`, async () => {
        const { handler, redis, seen } = createHarness({ entitlementResolver: candidate.resolve });
        const denied = await invoke(handler, request({ method, body: { action: 'TURN' } }));

        assert.equal(denied.status, candidate.status);
        assert.equal(denied.body.code, candidate.code);
        assert.equal(denied.body.mutation_performed, false);
        assert.equal(denied.body.csrf_token, undefined);
        assert.equal(seen.auth, 1);
        assert.equal(seen.entitlement, 1);
        assert.equal(seen.load.length, 0);
        assert.deepEqual(seen.order, ['auth', 'keys', 'entitlement']);
        assert.deepEqual(redis.writeCalls, []);
      });
    }
  }
});

test('JSON redaction is recursive while preserving runtime identifiers and actionable customer errors', () => {
  const redacted = redactPaidRuntimePayload({
    ok: false,
    code: 'SUBSCRIPTION_V1_RUNTIME_CSRF_DENIED',
    error: 'Please sign in again.',
    profile_id: 'forbidden-top-level-profile',
    identity: { profile_id: scope.profile_id },
    session: { session_id: 'session_customer_visible_0001', provider: 'forbidden-provider-value' },
    episode: { episode_id: 'episode_customer_visible_0001', model: 'forbidden-model-value' },
    proposal: { proposal_id: 'proposal_customer_visible_0001', assignment: 'forbidden-assignment-value' },
    private_authority_id: 'forbidden-authority-value',
    credentials: { api_key: 'forbidden-credential-value' },
  });
  assert.equal(redacted.code, 'SUBSCRIPTION_V1_RUNTIME_CSRF_DENIED');
  assert.equal(redacted.error, 'Please sign in again.');
  assert.equal(redacted.identity.profile_id, undefined);
  assert.equal(redacted.profile_id, undefined);
  assert.equal(redacted.session.session_id, 'session_customer_visible_0001');
  assert.equal(redacted.episode.episode_id, 'episode_customer_visible_0001');
  assert.equal(redacted.proposal.proposal_id, 'proposal_customer_visible_0001');
  assertNoPrivateRuntimeDetails(redacted);
});

test('generic inner-runtime unavailability is normalized to the paid recovery boundary', () => {
  assert.deepEqual(
    redactPaidRuntimePayload({
      ok: false,
      code: 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE',
      detail: 'PAID_ENTITLEMENT_RECONCILIATION_REQUIRED',
      mutation_performed: false,
    }),
    {
      ok: false,
      code: 'SUBSCRIPTION_V1_PAID_RUNTIME_UNAVAILABLE',
      mutation_performed: false,
    },
  );
});

test('GET diagnostics is denied before authentication, storage, loader, entitlement, or key access', async () => {
  const { handler, redis, seen } = createHarness();
  const denied = await invoke(handler, request({ query: { view: 'diagnostics' } }));
  assert.equal(denied.status, 404);
  assert.deepEqual(denied.body, { ok: false, error: 'not_found' });
  assert.equal(denied.headers['cache-control'], 'no-store, private, max-age=0');
  assert.equal(redis.calls, 0);
  assert.equal(seen.auth, 0);
  assert.equal(seen.load.length, 0);
  assert.equal(seen.entitlement, 0);
  assert.equal(seen.keys.length, 0);
});

test('inner runtime still owns same-origin and CSRF enforcement', async () => {
  const { handler, seen } = createHarness();
  const wrongOrigin = await invoke(handler, request({ method: 'POST', origin: 'https://attacker.test', body: { action: 'TURN' } }));
  assert.equal(wrongOrigin.status, 403);
  assert.equal(wrongOrigin.body.code, 'SUBSCRIPTION_V1_ORIGIN_DENIED');
  assert.equal(seen.auth, 0);

  const missingCsrf = await invoke(handler, request({ method: 'POST', body: { action: 'TURN' } }));
  assert.equal(missingCsrf.status, 403);
  assert.equal(missingCsrf.body.code, 'SUBSCRIPTION_V1_RUNTIME_CSRF_DENIED');
  assert.equal(seen.auth, 1);
  assert.equal(seen.load.length, 0);
});

test('NDJSON coaching events are redacted line by line without losing session continuity', async () => {
  const { handler, redis } = createHarness();
  const opened = await invoke(handler, request());
  const started = await invoke(handler, request({
    method: 'POST',
    csrf: opened.body.csrf_token,
    body: { action: 'START_MY_FIRST_SESSION' },
  }));
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.equal(started.body.session.session_id.startsWith('session_'), true);
  assertNoPrivateRuntimeDetails(started.body);

  const firstEvent = JSON.parse(await redis.get(keys.s2_relationship));
  assert.equal(firstEvent.synthetic_only, false);

  const streamed = await invoke(handler, request({
    method: 'POST',
    csrf: started.body.csrf_token,
    accept: 'application/x-ndjson',
    body: {
      action: 'TURN',
      session_id: started.body.session.session_id,
      message: 'Help me choose one useful next step.',
      conversation: [],
    },
  }));
  assert.equal(streamed.status, 200);
  assert.match(streamed.headers['content-type'], /^application\/x-ndjson/u);
  const events = streamed.body.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(events.map((event) => event.phase), ['COACHING_READY', 'EXTRACTION_COMPLETE']);
  assert.equal(events.every((event) => event.session.session_id === started.body.session.session_id), true);
  for (const event of events) assertNoPrivateRuntimeDetails(event);
});
