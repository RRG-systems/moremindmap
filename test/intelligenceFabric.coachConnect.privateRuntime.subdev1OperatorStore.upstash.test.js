import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUpstashSubdev1OperatorBridgeStore,
  SUBDEV1_OPERATOR_STORE_METHODS,
  validateSubdev1OperatorStore,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';

const digest = (character) => character.repeat(64);

function configuration(namespaceDigest = digest('a')) {
  return {
    provider: 'UPSTASH_REDIS',
    enabled: true,
    emergency_disabled: false,
    namespace_prefix: 'more:cc:security:v2',
    namespace_digest: namespaceDigest,
    provider_endpoint_ref: 'UPSTASH_ENDPOINT_REF',
    provider_credential_ref: 'UPSTASH_CREDENTIAL_REF',
    command_timeout_ms: 1000,
    audit_retention_days: 7,
  };
}

function fakeExecutor({ now = { value: Date.now() }, commands = [] } = {}) {
  const records = new Map();
  const audits = new Map();
  const execute = async (command) => {
    commands.push(structuredClone(command));
    const key = command[3];
    const operation = command[4];
    const payload = JSON.parse(command[5]);
    const prior = records.get(key);
    if (prior?.expires_at <= now.value) records.delete(key);
    if (operation === 'SAVE_CONTEXT') {
      if (records.has(key)) return { ok: false, code: 'OPERATOR_CONTEXT_INVALID' };
      records.set(key, {
        value: payload.context_json,
        expires_at: now.value + payload.ttl_ms,
      });
      return { ok: true, context_id: payload.context_id };
    }
    if (operation === 'GET_CONTEXT') {
      const found = records.get(key);
      return found
        ? { ok: true, status: 'FOUND', context_json: found.value }
        : { ok: true, status: 'NOT_FOUND', context_json: null };
    }
    if (operation === 'REPLACE_CONTEXT') {
      const found = records.get(key);
      if (!found
        || JSON.parse(found.value).profile_generation
          !== payload.expected_profile_generation) {
        return { ok: false, code: 'PROFILE_RECEIPT_STALE' };
      }
      records.set(key, {
        value: payload.context_json,
        expires_at: now.value + payload.ttl_ms,
      });
      return {
        ok: true,
        context_id: payload.context_id,
        profile_generation: payload.profile_generation,
      };
    }
    if (operation === 'APPEND_AUDIT') {
      const events = audits.get(key) || [];
      events.push(JSON.parse(payload.event_json));
      audits.set(key, events.slice(-payload.max_entries));
      return { ok: true, event_id: payload.event_id };
    }
    if (operation === 'AUDIT_SNAPSHOT') {
      return { ok: true, events: structuredClone(audits.get(key) || []) };
    }
    return { ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' };
  };
  return { execute, records, audits, now };
}

function context(tokenHash, expiresAt) {
  return {
    token_hash: tokenHash,
    context_id: 'context_shared_restart',
    profile_generation: 0,
    expires_at: expiresAt,
    status: 'ACTIVE',
    revoked_at: null,
    revocation_reason: null,
    active_profile: null,
  };
}

test('Upstash adapter satisfies the existing nine-method deployment contract', () => {
  const store = createUpstashSubdev1OperatorBridgeStore({
    configuration: configuration(),
    commandExecutor: async () => ({ ok: true }),
  });
  assert.deepEqual(validateSubdev1OperatorStore(store), {
    valid: true,
    missing_methods: [],
  });
  assert.deepEqual(
    SUBDEV1_OPERATOR_STORE_METHODS.filter((method) => typeof store[method] === 'function'),
    SUBDEV1_OPERATOR_STORE_METHODS,
  );
  const description = store.describe();
  assert.equal(description.deployment_grade, true);
  assert.equal(description.shared_across_instances, true);
  assert.equal(description.restart_durable, true);
  assert.equal(description.no_local_fallback, true);
  assert.equal(description.stores_raw_subdev1, false);
});

test('two instances and reconstructed instances share durable context state', async () => {
  const backend = fakeExecutor();
  const options = {
    configuration: configuration(),
    commandExecutor: backend.execute,
  };
  const first = createUpstashSubdev1OperatorBridgeStore(options);
  const second = createUpstashSubdev1OperatorBridgeStore(options);
  const tokenHash = digest('b');
  const record = context(tokenHash, new Date(Date.now() + 60_000).toISOString());
  assert.equal((await first.saveContext(record)).ok, true);
  assert.deepEqual((await second.getContextByTokenHash(tokenHash)).context, record);

  const reconstructed = createUpstashSubdev1OperatorBridgeStore(options);
  assert.deepEqual((await reconstructed.getContextByTokenHash(tokenHash)).context, record);
  const replacement = { ...record, profile_generation: 1 };
  assert.equal((await reconstructed.replaceContext({
    token_hash: tokenHash,
    expected_profile_generation: 0,
    context: replacement,
  })).ok, true);
  assert.equal(
    (await first.getContextByTokenHash(tokenHash)).context.profile_generation,
    1,
  );
});

test('namespace digest isolates otherwise identical operator records', async () => {
  const backend = fakeExecutor();
  const tokenHash = digest('c');
  const first = createUpstashSubdev1OperatorBridgeStore({
    configuration: configuration(digest('d')),
    commandExecutor: backend.execute,
  });
  const isolated = createUpstashSubdev1OperatorBridgeStore({
    configuration: configuration(digest('e')),
    commandExecutor: backend.execute,
  });
  assert.equal((await first.saveContext(
    context(tokenHash, new Date(Date.now() + 60_000).toISOString()),
  )).ok, true);
  assert.equal((await isolated.getContextByTokenHash(tokenHash)).status, 'NOT_FOUND');
  assert.notEqual(first.describe().namespace_digest, isolated.describe().namespace_digest);
});

test('provider failures fail closed and no raw developer code enters provider commands', async () => {
  const commands = [];
  const backend = fakeExecutor({ commands });
  const store = createUpstashSubdev1OperatorBridgeStore({
    configuration: configuration(),
    commandExecutor: backend.execute,
  });
  await store.saveContext(
    context(digest('f'), new Date(Date.now() + 60_000).toISOString()),
  );
  assert.equal(JSON.stringify(commands).includes(['SUB', 'DEV', '1'].join('')), false);

  const unavailable = createUpstashSubdev1OperatorBridgeStore({
    configuration: configuration(),
    commandExecutor: async () => {
      throw new Error('synthetic provider outage');
    },
  });
  assert.equal(
    (await unavailable.getContextByTokenHash(digest('f'))).code,
    'OPERATOR_STORE_UNAVAILABLE',
  );
});

test('context retrieval preserves opaque JSON fields and rejects malformed provider shapes', async () => {
  const tokenHash = digest('1');
  const record = context(tokenHash, new Date(Date.now() + 60_000).toISOString());
  const exactJson = JSON.stringify(record);
  const store = createUpstashSubdev1OperatorBridgeStore({
    configuration: configuration(),
    commandExecutor: async (command) => {
      assert.equal(command[4], 'GET_CONTEXT');
      return { ok: true, status: 'FOUND', context_json: exactJson };
    },
  });
  assert.deepEqual((await store.getContextByTokenHash(tokenHash)).context, record);

  for (const providerResult of [
    { ok: true, status: 'FOUND', context_json: '{not-json' },
    { ok: true, status: 'FOUND', context_json: '[]' },
    { ok: true, status: 'FOUND', context: record },
  ]) {
    const malformed = createUpstashSubdev1OperatorBridgeStore({
      configuration: configuration(),
      commandExecutor: async () => providerResult,
    });
    assert.equal(
      (await malformed.getContextByTokenHash(tokenHash)).code,
      'OPERATOR_STORE_UNAVAILABLE',
    );
  }
});
