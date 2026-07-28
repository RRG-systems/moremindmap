import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_COMMAND_VERSION,
  ASYNC_SECURITY_QUERY_VERSION,
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/asyncSecurityContracts.js';
import {
  RemoteSharedSecurityAdapterError,
  allRemoteFailuresMapToV2,
  projectRemoteCapabilityToV2,
  remoteSharedSecurityContractIdentity,
  validateRemoteCommandEnvelope,
  validateRemoteQueryEnvelope,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/contracts.js';
import {
  REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
  defaultRemoteSharedSecurityConfiguration as defaultConfiguration,
  remoteSharedSecurityConfigurationDigest,
  validateRemoteSharedSecurityConfiguration,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js';

const sha = (character) => character.repeat(64);

function enabledQualificationConfiguration() {
  return {
    ...defaultConfiguration(),
    enabled: true,
    emergency_disabled: false,
    environment_id: 'DISPOSABLE_QUALIFICATION',
    provider_database_id_digest: sha('1'),
    namespace_digest: sha('2'),
    script_manifest_digest: sha('3'),
    audit_retention_days: 1,
    backup_retention_days: 1,
  };
}

test('remote contract identity projects exactly onto committed Async Security V2', () => {
  const identity = remoteSharedSecurityContractIdentity();
  assert.equal(identity.contract_version, ASYNC_SECURITY_STATE_CONTRACT_VERSION);
  assert.equal(identity.adapter_contract_version, REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION);
  assert.equal(identity.provider_client_exposed, false);
  assert.equal(allRemoteFailuresMapToV2(), true);
});

test('configuration is source-default-off and emergency-disabled', () => {
  const configuration = defaultConfiguration();
  assert.equal(configuration.enabled, false);
  assert.equal(configuration.emergency_disabled, true);
  assert.equal(validateRemoteSharedSecurityConfiguration(configuration).valid, true);
});

test('enabled configuration fails without explicit qualification authority', () => {
  const configuration = enabledQualificationConfiguration();
  assert.equal(validateRemoteSharedSecurityConfiguration(configuration).valid, false);
  assert.equal(validateRemoteSharedSecurityConfiguration(configuration, {
    qualification_authorized: true,
  }).valid, true);
});

test('raw endpoint and client-exposed configuration are rejected', () => {
  const rawEndpoint = {
    ...defaultConfiguration(),
    provider_endpoint_ref: 'https://provider.invalid',
  };
  assert.equal(validateRemoteSharedSecurityConfiguration(rawEndpoint).valid, false);
  assert.equal(validateRemoteSharedSecurityConfiguration({
    ...defaultConfiguration(),
    telemetry_enabled: true,
  }).valid, false);
});

test('configuration digest excludes secret values and remains deterministic', () => {
  const configuration = defaultConfiguration();
  const first = remoteSharedSecurityConfigurationDigest(configuration);
  const second = remoteSharedSecurityConfigurationDigest(structuredClone(configuration));
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.equal(JSON.stringify(configuration).includes('Bearer '), false);
});

test('query and command validation accept only exact committed V2 envelopes', () => {
  const query = {
    query_version: ASYNC_SECURITY_QUERY_VERSION,
    query_type: 'GET_SECURITY_EPOCH',
    environment_id: 'TEST',
    correlation_ref: 'correlation_contract',
    subject_ref: null,
    session_token_hash: null,
    entitlement_token_hash: null,
    exact_scope_hash: sha('a'),
    requested_runtime: null,
    requested_action: null,
    required_consistency: 'PRIMARY_OR_LINEARIZABLE',
  };
  const command = {
    command_version: ASYNC_SECURITY_COMMAND_VERSION,
    command_type: 'ADVANCE_SECURITY_EPOCH',
    environment_id: 'TEST',
    idempotency_key_hash: sha('b'),
    fingerprint: sha('c'),
    correlation_ref: 'correlation_command',
    expected_versions: {},
    arguments: { exact_scope_hash: sha('a'), expected_epoch: 1 },
  };
  assert.deepEqual(validateRemoteQueryEnvelope(query), query);
  assert.deepEqual(validateRemoteCommandEnvelope(command), command);
  assert.throws(
    () => validateRemoteQueryEnvelope({ ...query, required_consistency: 'EVENTUAL' }),
    RemoteSharedSecurityAdapterError,
  );
  assert.throws(
    () => validateRemoteCommandEnvelope({ ...command, arguments: { raw_token: 'forbidden' } }),
    RemoteSharedSecurityAdapterError,
  );
});

test('capability remains unqualified until an exact live proof exists', () => {
  const capability = projectRemoteCapabilityToV2({
    adapter_id: 'remote_adapter_contract',
    environment_id: 'TEST',
    available: false,
    deployment_grade: false,
    primary_authority_proven: false,
    live_connection_verified: false,
  });
  assert.equal(capability.promise_native, true);
  assert.equal(capability.no_local_fallback, true);
  assert.equal(capability.deployment_grade, false);
  assert.equal(capability.live_connection_verified, false);
  assert.equal(capability.stores_product_content, false);
  assert.equal(capability.stores_transcripts, false);
});
