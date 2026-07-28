import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_COMMAND_VERSION,
  ASYNC_SECURITY_QUERY_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js';
import {
  createQualificationDigestFunction,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js';
import {
  defaultRemoteSharedSecurityConfiguration,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js';
import {
  createUpstashRedisRemoteSharedSecurityAdapter,
  remoteSharedSecurityCompleteScriptManifestDigest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js';

const sha = (character) => character.repeat(64);

function query() {
  return {
    query_version: ASYNC_SECURITY_QUERY_VERSION,
    query_type: 'GET_SECURITY_EPOCH',
    environment_id: 'LOCAL_SYNTHETIC',
    correlation_ref: 'health_query',
    subject_ref: null,
    session_token_hash: null,
    entitlement_token_hash: null,
    exact_scope_hash: sha('a'),
    requested_runtime: null,
    requested_action: null,
    required_consistency: 'PRIMARY_OR_LINEARIZABLE',
  };
}

function command() {
  return {
    command_version: ASYNC_SECURITY_COMMAND_VERSION,
    command_type: 'ADVANCE_SECURITY_EPOCH',
    environment_id: 'LOCAL_SYNTHETIC',
    idempotency_key_hash: sha('b'),
    fingerprint: sha('c'),
    correlation_ref: 'health_command',
    expected_versions: {},
    arguments: { exact_scope_hash: sha('a'), expected_epoch: 1 },
  };
}

test('default adapter is source-off, Promise-native, and performs zero fetches', async () => {
  let fetches = 0;
  const adapter = createUpstashRedisRemoteSharedSecurityAdapter({
    fetch_impl: async () => {
      fetches += 1;
      throw new Error('must not be reached');
    },
  });
  const calls = [
    adapter.describeCapability(),
    adapter.health(),
    adapter.serverTime(),
    adapter.queryAuthoritative(query()),
    adapter.executeAtomic(command()),
  ];
  assert.equal(calls.every((value) => value instanceof Promise), true);
  const [capability, health, time, queryResult, commandResult] = await Promise.all(calls);
  assert.equal(capability.deployment_grade, false);
  assert.equal(capability.live_connection_verified, false);
  assert.equal(health.state, 'UNCONFIGURED');
  assert.equal(health.allowed_for_security, false);
  assert.equal(time.ok, false);
  assert.equal(queryResult.ok, false);
  assert.equal(commandResult.ok, false);
  assert.equal(fetches, 0);
  assert.equal(adapter.providerActivityLedger().length, 0);
});

test('configuration cannot substitute for qualification evidence', async () => {
  const configuration = {
    ...defaultRemoteSharedSecurityConfiguration(),
    enabled: true,
    emergency_disabled: false,
    environment_id: 'PRIVATE_PREVIEW',
    provider_database_id_digest: sha('1'),
    namespace_digest: sha('2'),
    script_manifest_digest: remoteSharedSecurityCompleteScriptManifestDigest(),
    audit_retention_days: 1,
    backup_retention_days: 1,
  };
  let fetches = 0;
  const adapter = createUpstashRedisRemoteSharedSecurityAdapter({
    configuration,
    keyed_digest: createQualificationDigestFunction('preview-fixture-key-material-no-authority'),
    resolve_secret_reference: async () => 'not-authorized',
    fetch_impl: async () => {
      fetches += 1;
      return { ok: true, json: async () => ({}) };
    },
  });
  assert.equal((await adapter.health()).state, 'UNCONFIGURED');
  assert.equal((await adapter.describeCapability()).deployment_grade, false);
  assert.equal(fetches, 0);
});

test('emergency disable dominates even with complete injected dependencies', async () => {
  const configuration = {
    ...defaultRemoteSharedSecurityConfiguration(),
    environment_id: 'TEST',
    provider_database_id_digest: sha('1'),
    namespace_digest: sha('2'),
    script_manifest_digest: remoteSharedSecurityCompleteScriptManifestDigest(),
  };
  let fetches = 0;
  const adapter = createUpstashRedisRemoteSharedSecurityAdapter({
    configuration,
    offline_transport_test: true,
    keyed_digest: createQualificationDigestFunction('emergency-fixture-key-material-value'),
    resolve_secret_reference: async () => 'fixture-reference',
    fetch_impl: async () => {
      fetches += 1;
      return { ok: true, json: async () => ({}) };
    },
  });
  const health = await adapter.health();
  assert.equal(health.allowed_for_security, false);
  assert.equal(health.state, 'UNCONFIGURED');
  assert.equal(fetches, 0);
});

