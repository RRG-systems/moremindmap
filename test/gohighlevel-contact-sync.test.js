import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  GHL_EVENT_TYPE,
  GHL_TAG_CONFIG,
  buildSubscriptionActiveContactEvent,
  resetGoHighLevelResolverCachesForTests,
  syncContactToGoHighLevel
} from '../api/integrations/gohighlevel/contactSync.js';
import {
  queueBaCompletedContactSync,
  queueBosCompletedContactSync
} from '../api/integrations/gohighlevel/completionHooks.js';

const ENV = {
  GHL_CONTACT_SYNC_ENABLED: 'true',
  GHL_PRIVATE_INTEGRATION_TOKEN: 'test-token-must-never-be-logged',
  GHL_LOCATION_ID: 'location-test',
  GHL_FIELD_MORE_PROFILE_ID: 'field-profile-id',
  GHL_FIELD_MORE_ASSESSMENT_TYPE: 'field-assessment-type',
  GHL_FIELD_MORE_ASSESSMENT_STATUS: 'field-assessment-status',
  GHL_FIELD_MORE_ASSESSMENT_COMPLETED_AT: 'field-completed-at',
  GHL_FIELD_MORE_SUBSCRIPTION_STATUS: 'field-subscription-status',
  GHL_FIELD_MORE_SOURCE: 'field-source'
};

function response(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function successfulFetch({ existingTags = ['MMM', 'BOS Completed', 'BA Completed', 'Subscription Active'] } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method: options.method, body, headers: options.headers });
    if (url.endsWith('/tags') && options.method === 'GET') {
      return response(200, { tags: existingTags.map((name, index) => ({ id: `tag-${index}`, name })) });
    }
    if (url.endsWith('/tags') && options.method === 'POST') return response(200, { tag: { id: 'created-tag', name: body.name } });
    if (url.endsWith('/contacts/upsert')) return response(200, { contact: { id: 'contact-123' } });
    throw new Error(`Unexpected URL ${url}`);
  };
  return { fetchImpl, calls };
}

const baseContact = {
  profileId: 'mm-20260716-abcdefgh',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ADA@EXAMPLE.COM',
  phone: '+1 (602) 555-0100',
  assessmentType: 'BOS',
  completionStatus: 'Completed',
  completedAt: '2026-07-16T12:00:00.000Z',
  source: 'existing-campaign',
  eventType: GHL_EVENT_TYPE.BOS_COMPLETED
};

test.beforeEach(() => resetGoHighLevelResolverCachesForTests());

test('GHL tags are centralized in one changeable configuration object', () => {
  assert.deepEqual(GHL_TAG_CONFIG, {
    BASE: 'MMM',
    BOS_COMPLETED: 'BOS Completed',
    BA_COMPLETED: 'BA Completed',
    SUBSCRIPTION_ACTIVE: 'Subscription Active'
  });
});

test('BOS builds one authorized upsert with profile ID and event-specific tags', async () => {
  const mock = successfulFetch();
  const result = await syncContactToGoHighLevel(baseContact, { env: ENV, fetchImpl: mock.fetchImpl, logger: {} });
  assert.equal(result.success, true);
  const upserts = mock.calls.filter((call) => call.url.endsWith('/contacts/upsert'));
  assert.equal(upserts.length, 1);
  assert.deepEqual(upserts[0].body.tags, ['MMM', 'BOS Completed']);
  assert.equal(upserts[0].body.email, 'ada@example.com');
  assert.equal(upserts[0].body.phone, '+16025550100');
  assert.ok(upserts[0].body.customFields.some((field) => field.id === 'field-profile-id' && field.field_value === baseContact.profileId));
  assert.ok(upserts[0].body.customFields.some((field) => field.id === 'field-assessment-status' && field.field_value === 'Completed'));
  assert.equal(mock.calls.some((call) => call.url.endsWith('/customFields')), false);
  const serialized = JSON.stringify(upserts[0].body);
  for (const forbidden of ['answers', 'scores', 'narrative', 'five futures', 'one move', 'confidence', 'evidence', 'financial']) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false);
  }
});

test('BA uses BA tag and not BOS tag', async () => {
  const mock = successfulFetch();
  await syncContactToGoHighLevel({ ...baseContact, eventType: GHL_EVENT_TYPE.BA_COMPLETED, assessmentType: 'BA' }, { env: ENV, fetchImpl: mock.fetchImpl, logger: {} });
  const payload = mock.calls.find((call) => call.url.endsWith('/contacts/upsert')).body;
  assert.deepEqual(payload.tags, ['MMM', 'BA Completed']);
  assert.equal(payload.tags.includes('BOS Completed'), false);
});

test('missing or disabled configuration skips safely', async () => {
  assert.equal((await syncContactToGoHighLevel(baseContact, { env: {}, logger: {} })).reason, 'feature_disabled');
  assert.equal((await syncContactToGoHighLevel(baseContact, { env: { GHL_CONTACT_SYNC_ENABLED: 'true' }, logger: {} })).reason, 'missing_private_integration_token');
});

test('static custom field references avoid schema requests while tags remain cached', async () => {
  const mock = successfulFetch({ existingTags: [' mmm '] });
  await syncContactToGoHighLevel(baseContact, { env: ENV, fetchImpl: mock.fetchImpl, logger: {} });
  await syncContactToGoHighLevel(baseContact, { env: ENV, fetchImpl: mock.fetchImpl, logger: {} });
  assert.equal(mock.calls.filter((call) => call.url.endsWith('/customFields')).length, 0);
  assert.equal(mock.calls.filter((call) => call.url.endsWith('/tags') && call.method === 'GET').length, 1);
  assert.equal(mock.calls.filter((call) => call.url.endsWith('/tags') && call.method === 'POST').length, 1);
  assert.equal(mock.calls.filter((call) => call.url.endsWith('/contacts/upsert')).length, 2);
});

test('key-based custom field references produce key payload entries', async () => {
  const mock = successfulFetch();
  const keyEnv = Object.fromEntries(Object.entries(ENV).map(([name, value]) => [
    name,
    name.startsWith('GHL_FIELD_') ? `contact.${name.toLowerCase()}` : value
  ]));
  const outcome = await syncContactToGoHighLevel(baseContact, { env: keyEnv, fetchImpl: mock.fetchImpl, logger: {} });
  assert.equal(outcome.success, true);
  const fields = mock.calls.find((call) => call.url.endsWith('/contacts/upsert')).body.customFields;
  assert.ok(fields.every((field) => field.key?.startsWith('contact.') && !('id' in field)));
});

test('missing required static field reference skips safely before network access', async () => {
  let calls = 0;
  const { GHL_FIELD_MORE_SOURCE: _missing, ...incompleteEnv } = ENV;
  const outcome = await syncContactToGoHighLevel(baseContact, {
    env: incompleteEnv,
    fetchImpl: async () => { calls += 1; return response(500); },
    logger: {}
  });
  assert.equal(outcome.skipped, true);
  assert.equal(outcome.reason, 'configuration_missing');
  assert.deepEqual(outcome.missingConfiguration, ['GHL_FIELD_MORE_SOURCE']);
  assert.equal(calls, 0);
});

test('optional subscription field reference may be omitted', async () => {
  const mock = successfulFetch();
  const { GHL_FIELD_MORE_SUBSCRIPTION_STATUS: _optional, ...withoutOptional } = ENV;
  const outcome = await syncContactToGoHighLevel(baseContact, { env: withoutOptional, fetchImpl: mock.fetchImpl, logger: {} });
  assert.equal(outcome.success, true);
  const upsert = mock.calls.find((call) => call.url.endsWith('/contacts/upsert'));
  assert.equal(upsert.body.customFields.length, 5);
});

for (const [status, reason, retryable] of [[401, 'authorization_failed', false], [429, 'rate_limited', true], [500, 'ghl_server_error', true]]) {
  test(`HTTP ${status} is classified without leaking the token`, async () => {
    const logs = [];
    const outcome = await syncContactToGoHighLevel(baseContact, {
      env: ENV,
      fetchImpl: async () => response(status),
      logger: { info: (...args) => logs.push(args) }
    });
    assert.equal(outcome.reason, reason);
    assert.equal(outcome.retryable, retryable);
    assert.equal(JSON.stringify({ outcome, logs }).includes(ENV.GHL_PRIVATE_INTEGRATION_TOKEN), false);
  });
}

test('network timeout is bounded and retryable', async () => {
  const started = Date.now();
  const fetchImpl = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const outcome = await syncContactToGoHighLevel(baseContact, { env: ENV, fetchImpl, timeoutMs: 100, logger: {} });
  assert.equal(outcome.reason, 'request_timeout');
  assert.equal(outcome.retryable, true);
  assert.ok(Date.now() - started < 1000);
});

test('completion helpers queue exactly one fail-open sync per BOS and BA completion', async () => {
  const payloads = [];
  const backgroundTasks = [];
  const sync = async (payload) => { payloads.push(payload); throw new Error('simulated outage'); };
  const waitUntil = (promise) => backgroundTasks.push(promise);
  queueBosCompletedContactSync(baseContact, { sync, waitUntil, logger: {} });
  queueBaCompletedContactSync(baseContact, { sync, waitUntil, logger: {} });
  assert.equal(backgroundTasks.length, 2);
  await Promise.all(backgroundTasks);
  assert.equal(payloads.length, 2);
  assert.equal(payloads.filter((payload) => payload.eventType === GHL_EVENT_TYPE.BOS_COMPLETED).length, 1);
  assert.equal(payloads.filter((payload) => payload.eventType === GHL_EVENT_TYPE.BA_COMPLETED).length, 1);
});

test('waitUntil receives one bounded promise and the response path does not await it', async () => {
  let resolveSync;
  const sync = () => new Promise((resolve) => { resolveSync = resolve; });
  const backgroundTasks = [];
  const scheduled = queueBosCompletedContactSync(baseContact, {
    sync,
    waitUntil: (promise) => backgroundTasks.push(promise),
    logger: {}
  });
  assert.deepEqual(scheduled, { scheduled: true, reason: null });
  assert.equal(backgroundTasks.length, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof resolveSync, 'function');
  let settled = false;
  backgroundTasks[0].then(() => { settled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  resolveSync({ attempted: true, success: true });
  await backgroundTasks[0];
});

test('background rejection is handled with sanitized logging', async () => {
  const logs = [];
  const tasks = [];
  queueBaCompletedContactSync(baseContact, {
    sync: async () => { throw new Error(`sensitive ${ENV.GHL_PRIVATE_INTEGRATION_TOKEN}`); },
    waitUntil: (promise) => tasks.push(promise),
    logger: { warn: (...args) => logs.push(args) }
  });
  const outcome = await tasks[0];
  assert.equal(outcome.reason, 'unexpected_sync_error');
  assert.equal(JSON.stringify(logs).includes(ENV.GHL_PRIVATE_INTEGRATION_TOKEN), false);
});

test('missing background primitive fails safely and does not dispatch', async () => {
  let syncCalls = 0;
  const scheduled = queueBosCompletedContactSync(baseContact, {
    sync: async () => { syncCalls += 1; },
    waitUntil: () => { throw new Error('request context missing'); },
    logger: {}
  });
  assert.deepEqual(scheduled, { scheduled: false, reason: 'background_primitive_unavailable' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(syncCalls, 0);
});

test('source hooks occur once and after canonical persistence', async () => {
  const bos = await readFile(new URL('../api/engine/canonical/executeCanonicalGeneration.js', import.meta.url), 'utf8');
  const ba = await readFile(new URL('../api/business-assessment/start.js', import.meta.url), 'utf8');
  assert.equal((bos.match(/queueBosCompletedContactSync\(/g) || []).length, 1);
  assert.ok(bos.indexOf('if (vault_result?.success)') < bos.indexOf('queueBosCompletedContactSync('));
  assert.equal((ba.match(/queueBaCompletedContactSync\(/g) || []).length, 1);
  assert.ok(ba.indexOf('await redis.set(businessAssessmentKey') < ba.indexOf('queueBaCompletedContactSync('));
});

test('subscription helper exists without a runtime hook', () => {
  const event = buildSubscriptionActiveContactEvent({ profileId: baseContact.profileId });
  assert.equal(event.eventType, GHL_EVENT_TYPE.SUBSCRIPTION_ACTIVE);
  assert.equal(event.subscriptionStatus, 'active');
});

test('server-only field and token environment names are absent from client source', async () => {
  const clientFiles = ['../src/Profile.jsx', '../src/BusinessAssessment.jsx'];
  const forbidden = ['GHL_PRIVATE_INTEGRATION_TOKEN', 'GHL_FIELD_MORE_PROFILE_ID', 'GHL_FIELD_MORE_SOURCE'];
  for (const file of clientFiles) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    for (const name of forbidden) assert.equal(source.includes(name), false);
  }
});

test('repository contains no committed real GHL field references', async () => {
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  for (const line of envExample.split('\n').filter((line) => line.startsWith('GHL_FIELD_'))) {
    assert.match(line, /^GHL_FIELD_[A-Z_]+=$/);
  }
});
