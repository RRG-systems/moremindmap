import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
  UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
  buildDisposableQualificationTeardownInvocation,
  createQualificationDigestFunction,
  createUpstashRedisRemoteSharedSecurityAdapter,
  defaultRemoteSharedSecurityConfiguration,
  evaluateRemoteSharedSecurityOperatingAuthority,
  privateLiveEnvironmentAttestationDigest,
  remoteSecurityQualificationCertificateDigest,
  remoteSharedSecurityCompleteScriptManifestDigest,
  remoteSharedSecurityConfigurationDigest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';

const now = Date.parse('2026-07-28T12:00:00.000Z');
const sha = (character) => character.repeat(64);
const sourceDigest = sha('a');
const reviewPackageDigest = sha('b');
const repairReviewPackageDigest = sha('7');

function configuration(overrides = {}) {
  return {
    ...defaultRemoteSharedSecurityConfiguration(),
    enabled: true,
    emergency_disabled: false,
    environment_id: 'PRIVATE_PRODUCTION_CLASSIFIED',
    provider_database_id_digest: sha('c'),
    namespace_digest: sha('d'),
    adapter_id: 'private_live_upstash_adapter',
    script_manifest_digest: remoteSharedSecurityCompleteScriptManifestDigest(),
    audit_retention_days: 1,
    backup_retention_days: 1,
    ...overrides,
  };
}

function certificate(overrides = {}) {
  const value = {
    certificate_version: 'remote-security-qualification-certificate-v1',
    adapter_implementation_id: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapter_source_sha256: sourceDigest,
    contract_version: ASYNC_SECURITY_STATE_CONTRACT_VERSION,
    adapter_contract_version: REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
    provider_class: 'UPSTASH_REDIS',
    qualification_review_package_name:
      'PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_ATOMIC_AUDIT_REPAIR_REVIEW_V1.zip',
    qualification_review_package_sha256: reviewPackageDigest,
    attestation_repair_review_package_name:
      'PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_REVIEW_V1.zip',
    attestation_repair_review_package_sha256: repairReviewPackageDigest,
    qualified_script_manifest_sha256: remoteSharedSecurityCompleteScriptManifestDigest(),
    qualification_verdict:
      'PRIVATE_RUNTIME_REMOTE_SHARED_SECURITY_ADAPTER_QUALIFIED_WITH_LIMITS',
    qualified_at: '2026-07-27T12:00:00.000Z',
    review_due_at: '2026-08-27T12:00:00.000Z',
    capabilities: {
      promise_native: true,
      provider_native_atomic_commands: true,
      authoritative_primary_queries: true,
      authority_snapshot_internally_consistent: true,
      race_failure_qualified: true,
      mandatory_audit_coupled: true,
      restart_recovery_proven: true,
      fail_closed_outage_proven: true,
      namespace_isolation_proven: true,
    },
    known_limits: ['private_live_only', 'named_testers_require_separate_activation'],
    zero_customer_data: true,
    qualification_namespace_teardown_proven: true,
    certificate_sha256: sha('0'),
    ...overrides,
  };
  return {
    ...value,
    certificate_sha256: remoteSecurityQualificationCertificateDigest(value),
  };
}

function liveAttestation(config, qualCertificate, overrides = {}) {
  const value = {
    attestation_version: 'private-live-environment-attestation-v1',
    operating_mode: 'PRIVATE_LIVE',
    environment_id: config.environment_id,
    vercel_project_reference: 'private_live_project_reference',
    provider_classification: 'PRODUCTION',
    deployment_target: 'production',
    provider_class: config.provider,
    persistent_namespace: true,
    disposable_namespace: false,
    private_live_only: true,
    public_access: false,
    production_customer_rollout: false,
    namespace_prefix: config.namespace_prefix,
    namespace_digest: config.namespace_digest,
    adapter_implementation_id: qualCertificate.adapter_implementation_id,
    adapter_source_sha256: qualCertificate.adapter_source_sha256,
    qualification_certificate_sha256: qualCertificate.certificate_sha256,
    contract_version: qualCertificate.contract_version,
    adapter_contract_version: qualCertificate.adapter_contract_version,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    protected_edge: true,
    named_identity_only: true,
    mfa_backed_operator: true,
    runtime_default_state: 'OFF',
    runtime_activation_approved: false,
    emergency_disable_supported: true,
    emergency_disable_state: 'READY',
    retention_class: 'private_security_metadata_30_day_max',
    backup_class: 'private_security_governed_backup',
    deletion_class: 'governed_delete_or_crypto_erasure',
    approved_tester_scope_digest: sha('e'),
    approved_profile_id_scope_digest: sha('f'),
    activation_owner_ref: 'private_live_activation_owner',
    rollback_owner_ref: 'private_live_rollback_owner',
    operator_approval_ref: 'private_live_operator_approval',
    issued_at: '2026-07-28T10:00:00.000Z',
    review_due_at: '2026-08-28T10:00:00.000Z',
    attestation_sha256: sha('0'),
    ...overrides,
  };
  return {
    ...value,
    attestation_sha256: privateLiveEnvironmentAttestationDigest(value),
  };
}

function qualificationAttestation(config, overrides = {}) {
  return {
    attestation_version: 'remote-shared-security-qualification-attestation-v1',
    adapter_id: config.adapter_id,
    environment_id: config.environment_id,
    namespace_digest: config.namespace_digest,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    primary_authority_proven: true,
    atomic_script_proven: true,
    live_connection_verified: true,
    zero_customer_data: true,
    disposable_namespace: true,
    qualified_at: '2026-07-27T12:00:00.000Z',
    expires_at: '2026-08-27T12:00:00.000Z',
    ...overrides,
  };
}

function evaluatePrivateLive({
  config = configuration(),
  qualCertificate = null,
  attestation = null,
  operatingMode = 'PRIVATE_LIVE',
  expectedSourceDigest = sourceDigest,
} = {}) {
  const resolvedCertificate = qualCertificate || certificate();
  const resolvedAttestation = attestation
    || liveAttestation(config, resolvedCertificate);
  return evaluateRemoteSharedSecurityOperatingAuthority({
    operating_mode: operatingMode,
    configuration: config,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    qualification_certificate: resolvedCertificate,
    live_environment_attestation: resolvedAttestation,
    expected_adapter_implementation_id: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    expected_adapter_source_sha256: expectedSourceDigest,
    expected_qualification_review_package_sha256: reviewPackageDigest,
    expected_attestation_repair_review_package_sha256: repairReviewPackageDigest,
    now_ms: now,
  });
}

test('qualification mode remains exact and disposable-only', () => {
  const config = configuration({
    environment_id: 'DISPOSABLE_QUALIFICATION',
    namespace_digest: sha('1'),
  });
  const accepted = evaluateRemoteSharedSecurityOperatingAuthority({
    operating_mode: 'QUALIFICATION',
    configuration: config,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    qualification_attestation: qualificationAttestation(config),
    now_ms: now,
  });
  assert.equal(accepted.valid, true);

  const rejected = evaluateRemoteSharedSecurityOperatingAuthority({
    operating_mode: 'QUALIFICATION',
    configuration: config,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    qualification_attestation: qualificationAttestation(config, {
      disposable_namespace: false,
      persistent_namespace: true,
    }),
    now_ms: now,
  });
  assert.equal(rejected.valid, false);
  assert.equal(rejected.errors.some(({ code }) => (
    code === 'DISPOSABLE_QUALIFICATION_NAMESPACE_REQUIRED'
  )), true);
});

test('private-live mode is persistent-only and rejects disposable attestation state', () => {
  const config = configuration();
  const qualCertificate = certificate();
  const attestation = liveAttestation(config, qualCertificate, {
    persistent_namespace: false,
    disposable_namespace: true,
  });
  const result = evaluatePrivateLive({ config, qualCertificate, attestation });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some(({ code }) => code === 'PRIVATE_LIVE_NAMESPACE_REQUIRED'), true);
});

test('private-live mode requires both certificate and environment attestation', () => {
  const config = configuration();
  const noCertificate = evaluateRemoteSharedSecurityOperatingAuthority({
    operating_mode: 'PRIVATE_LIVE',
    configuration: config,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    qualification_certificate: null,
    live_environment_attestation: liveAttestation(config, certificate()),
    expected_adapter_implementation_id: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    expected_adapter_source_sha256: sourceDigest,
    expected_qualification_review_package_sha256: reviewPackageDigest,
    expected_attestation_repair_review_package_sha256: repairReviewPackageDigest,
    now_ms: now,
  });
  const noAttestation = evaluateRemoteSharedSecurityOperatingAuthority({
    operating_mode: 'PRIVATE_LIVE',
    configuration: config,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    qualification_certificate: certificate(),
    live_environment_attestation: null,
    expected_adapter_implementation_id: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    expected_adapter_source_sha256: sourceDigest,
    expected_qualification_review_package_sha256: reviewPackageDigest,
    expected_attestation_repair_review_package_sha256: repairReviewPackageDigest,
    now_ms: now,
  });
  assert.equal(noCertificate.valid, false);
  assert.equal(noAttestation.valid, false);
});

test('expired certificate and adapter source mismatch deny', () => {
  const config = configuration();
  const expiredCertificate = certificate({
    qualified_at: '2026-06-01T00:00:00.000Z',
    review_due_at: '2026-07-01T00:00:00.000Z',
  });
  const expired = evaluatePrivateLive({
    config,
    qualCertificate: expiredCertificate,
    attestation: liveAttestation(config, expiredCertificate),
  });
  const sourceMismatch = evaluatePrivateLive({ expectedSourceDigest: sha('9') });
  assert.equal(expired.valid, false);
  assert.equal(expired.errors.some(({ code }) => code === 'QUALIFICATION_CERTIFICATE_EXPIRED'), true);
  assert.equal(sourceMismatch.valid, false);
  assert.equal(sourceMismatch.errors.some(({ code }) => code === 'ADAPTER_SOURCE_DIGEST_MISMATCH'), true);
});

test('environment and namespace mismatches deny', () => {
  const config = configuration();
  const qualCertificate = certificate();
  const environmentMismatch = liveAttestation(config, qualCertificate, {
    environment_id: 'PRIVATE_PREVIEW',
    provider_classification: 'PREVIEW',
    deployment_target: 'preview',
  });
  const namespaceMismatch = liveAttestation(config, qualCertificate, {
    namespace_digest: sha('8'),
  });
  assert.equal(evaluatePrivateLive({
    config,
    qualCertificate,
    attestation: environmentMismatch,
  }).valid, false);
  assert.equal(evaluatePrivateLive({
    config,
    qualCertificate,
    attestation: namespaceMismatch,
  }).valid, false);
});

test('contract mismatch denies without changing V2', () => {
  const config = configuration();
  const mismatchedCertificate = certificate({ contract_version: 'shared-security-state-async-v3' });
  const result = evaluatePrivateLive({
    config,
    qualCertificate: mismatchedCertificate,
    attestation: liveAttestation(config, mismatchedCertificate),
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some(({ code }) => code === 'ASYNC_SECURITY_CONTRACT_VIOLATION'), true);
});

test('public exposure and customer rollout deny', () => {
  const config = configuration();
  const qualCertificate = certificate();
  const result = evaluatePrivateLive({
    config,
    qualCertificate,
    attestation: liveAttestation(config, qualCertificate, {
      public_access: true,
      production_customer_rollout: true,
    }),
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors.some(({ code }) => (
    code === 'PUBLIC_OR_CUSTOMER_ACTIVATION_DENIED'
  )), true);
});

test('default-on, activation approval, and missing emergency state deny', () => {
  const config = configuration();
  const qualCertificate = certificate();
  const defaultOn = liveAttestation(config, qualCertificate, {
    runtime_default_state: 'ON',
    runtime_activation_approved: true,
  });
  const missingEmergency = { ...liveAttestation(config, qualCertificate) };
  delete missingEmergency.emergency_disable_state;
  assert.equal(evaluatePrivateLive({
    config,
    qualCertificate,
    attestation: defaultOn,
  }).valid, false);
  assert.equal(evaluatePrivateLive({
    config,
    qualCertificate,
    attestation: missingEmergency,
  }).valid, false);
});

test('mode is explicit and is never inferred from namespace naming', () => {
  const config = configuration({
    namespace_prefix: 'more:cc:security:v2',
    adapter_id: 'qualification_named_private_live_adapter',
  });
  const qualCertificate = certificate();
  const result = evaluateRemoteSharedSecurityOperatingAuthority({
    operating_mode: null,
    configuration: config,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    qualification_certificate: qualCertificate,
    live_environment_attestation: liveAttestation(config, qualCertificate),
    expected_adapter_implementation_id: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    expected_adapter_source_sha256: sourceDigest,
    expected_qualification_review_package_sha256: reviewPackageDigest,
    expected_attestation_repair_review_package_sha256: repairReviewPackageDigest,
    now_ms: now,
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'OPERATING_MODE_INVALID');
});

test('qualification evidence cannot activate private live and mixed bundles deny', () => {
  const config = configuration();
  const qualCertificate = certificate();
  const result = evaluateRemoteSharedSecurityOperatingAuthority({
    operating_mode: 'PRIVATE_LIVE',
    configuration: config,
    configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    script_manifest_digest: config.script_manifest_digest,
    qualification_attestation: qualificationAttestation(config),
    qualification_certificate: qualCertificate,
    live_environment_attestation: liveAttestation(config, qualCertificate),
    expected_adapter_implementation_id: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    expected_adapter_source_sha256: sourceDigest,
    expected_qualification_review_package_sha256: reviewPackageDigest,
    expected_attestation_repair_review_package_sha256: repairReviewPackageDigest,
    now_ms: now,
  });
  assert.equal(result.valid, false);
  assert.equal(result.errors[0].code, 'OPERATING_AUTHORITY_MIXED');
});

test('private-live evidence cannot authorize disposable qualification teardown', () => {
  assert.throws(() => buildDisposableQualificationTeardownInvocation({
    operating_mode: 'PRIVATE_LIVE',
    namespace_digest: sha('d'),
    cursor: '0',
    authority_receipt_ref: 'private_live_operator_approval',
  }), /CONFIGURATION_INVALID/);
});

test('unknown mode and offline flag cannot create a local or synthetic live fallback', async () => {
  const config = configuration({ environment_id: 'TEST' });
  let fetches = 0;
  const adapter = createUpstashRedisRemoteSharedSecurityAdapter({
    configuration: config,
    operating_mode: 'UNREVIEWED_MODE',
    offline_transport_test: true,
    keyed_digest: createQualificationDigestFunction('offline-fallback-rejection-material'),
    resolve_secret_reference: async () => 'unconfigured_reference',
    fetch_impl: async () => {
      fetches += 1;
      return { ok: true, json: async () => ({ result: '{}' }) };
    },
  });
  assert.equal((await adapter.health()).state, 'UNCONFIGURED');
  assert.equal((await adapter.describeCapability()).deployment_grade, false);
  assert.equal(fetches, 0);
});

test('valid private-live authority remains health-gated and uses no local authority', async () => {
  const config = configuration();
  const qualCertificate = certificate();
  const attestation = liveAttestation(config, qualCertificate);
  let canaryEpoch = 0;
  const adapter = createUpstashRedisRemoteSharedSecurityAdapter({
    configuration: config,
    operating_mode: 'PRIVATE_LIVE',
    qualification_certificate: qualCertificate,
    live_environment_attestation: attestation,
    expected_adapter_source_sha256: sourceDigest,
    expected_qualification_review_package_sha256: reviewPackageDigest,
    expected_attestation_repair_review_package_sha256: repairReviewPackageDigest,
    keyed_digest: createQualificationDigestFunction('private-live-keyed-digest-fixture-material'),
    resolve_secret_reference: async (reference) => (
      reference === config.provider_endpoint_ref
        ? 'https://private-live-mock.invalid'
        : 'private-live-mock-credential-value'
    ),
    fetch_impl: async (_endpoint, request) => {
      const command = JSON.parse(request.body);
      const envelope = JSON.parse(command.at(-1));
      canaryEpoch += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          result: JSON.stringify({
            server_time_ms: now + canaryEpoch,
            canary_epoch: canaryEpoch,
            configuration_digest: envelope.configuration_digest,
            script_manifest_digest: config.script_manifest_digest,
            primary_authority_proven: true,
            atomic_script_proven: true,
            critical_alert_open: false,
            receipt_ref: `private_live_health_${canaryEpoch}`,
          }),
        }),
      };
    },
    clock: () => now,
  });
  assert.equal((await adapter.describeCapability()).deployment_grade, false);
  assert.equal((await adapter.health()).state, 'RECOVERING');
  assert.equal((await adapter.health()).state, 'RECOVERING');
  assert.equal((await adapter.health()).state, 'HEALTHY');
  const capability = await adapter.describeCapability();
  assert.equal(capability.deployment_grade, true);
  assert.equal(capability.live_connection_verified, true);
  assert.equal(adapter.providerActivityLedger().every(({ transport_class }) => (
    transport_class === 'AUTHORIZED_PRIVATE_LIVE_PROVIDER'
  )), true);
});
