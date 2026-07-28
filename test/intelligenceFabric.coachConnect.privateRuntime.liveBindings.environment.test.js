import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASYNC_SECURITY_STATE_CONTRACT_VERSION,
  REMOTE_SHARED_SECURITY_ADAPTER_CONTRACT_VERSION,
  UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
  defaultRemoteSharedSecurityConfiguration,
  privateLiveEnvironmentAttestationDigest,
  remoteSecurityQualificationCertificateDigest,
  remoteSharedSecurityCompleteScriptManifestDigest,
  remoteSharedSecurityConfigurationDigest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import {
  liveSubscriberAssertionConfigurationDigest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/liveSubscriberAssertion/index.js';
import {
  createPrivateRuntimeEnvironmentReferenceResolver,
  privateRuntimeActivationReceiptDigest,
  privateRuntimeConfigurationAuthorityDigest,
  privateRuntimeProductBindingDigest,
  readPrivateRuntimeLiveConfigurationAuthorityV1,
  validatePrivateRuntimeLiveEnvironmentAuthorityV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/index.js';
import { hashPrivateRuntimeScope } from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const now = Date.parse('2026-07-28T12:00:00.000Z');
const sourceDigest = 'a'.repeat(64);
const scope = {
  tenant_id: 'tenant_environment',
  profile_id: 'profile_environment',
  business_id: 'business_environment',
  subscriber_id: 'subscriber_environment',
};
const scopeHash = hashPrivateRuntimeScope(scope);

function configuration(overrides = {}) {
  return {
    ...defaultRemoteSharedSecurityConfiguration(),
    enabled: true,
    emergency_disabled: false,
    environment_id: 'PRIVATE_PRODUCTION_CLASSIFIED',
    provider_endpoint_ref: 'MORE_PRIVATE_RUNTIME_PROVIDER_ENDPOINT_VALUE',
    provider_credential_ref: 'MORE_PRIVATE_RUNTIME_PROVIDER_CREDENTIAL_VALUE',
    provider_database_id_digest: 'b'.repeat(64),
    provider_region: 'private_region',
    namespace_digest: 'c'.repeat(64),
    adapter_id: 'private_live_upstash_adapter',
    script_manifest_digest: remoteSharedSecurityCompleteScriptManifestDigest(),
    audit_retention_days: 1,
    backup_retention_days: 1,
    token_hash_key_ref: 'MORE_PRIVATE_RUNTIME_TOKEN_HASH_KEY_VALUE',
    token_hash_key_id: 'private_token_hash_key_v1',
    identity_hash_key_ref: 'MORE_PRIVATE_RUNTIME_IDENTITY_HASH_KEY_VALUE',
    identity_hash_key_id: 'private_identity_hash_key_v1',
    scope_hash_key_ref: 'MORE_PRIVATE_RUNTIME_SCOPE_HASH_KEY_VALUE',
    scope_hash_key_id: 'private_scope_hash_key_v1',
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
    qualification_review_package_sha256:
      '28b42df527bea92dce9a0ccfab9b72a933f8975529e3f02a64853b289f0c47ac',
    attestation_repair_review_package_name:
      'PRIVATE_RUNTIME_REMOTE_SECURITY_ADAPTER_LIVE_ATTESTATION_REPAIR_REVIEW_V1.zip',
    attestation_repair_review_package_sha256:
      '4545be94544cdaf29940a45968ef2ac52b6865ed901aac87b84c265bf69f1b45',
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
    known_limits: ['private_live_only'],
    zero_customer_data: true,
    qualification_namespace_teardown_proven: true,
    certificate_sha256: '0'.repeat(64),
    ...overrides,
  };
  return { ...value, certificate_sha256: remoteSecurityQualificationCertificateDigest(value) };
}

function liveAttestation(config, qual, overrides = {}) {
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
    adapter_implementation_id: qual.adapter_implementation_id,
    adapter_source_sha256: qual.adapter_source_sha256,
    qualification_certificate_sha256: qual.certificate_sha256,
    contract_version: qual.contract_version,
    adapter_contract_version: qual.adapter_contract_version,
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
    approved_tester_scope_digest: 'd'.repeat(64),
    approved_profile_id_scope_digest: 'e'.repeat(64),
    activation_owner_ref: 'private_activation_owner',
    rollback_owner_ref: 'private_rollback_owner',
    operator_approval_ref: 'private_operator_approval',
    issued_at: '2026-07-28T10:00:00.000Z',
    review_due_at: '2026-08-28T10:00:00.000Z',
    attestation_sha256: '0'.repeat(64),
    ...overrides,
  };
  return { ...value, attestation_sha256: privateLiveEnvironmentAttestationDigest(value) };
}

function productBinding() {
  const value = {
    binding_version: 'private-runtime-product-binding-attestation-v1',
    environment_id: 'PRIVATE_PRODUCTION_CLASSIFIED',
    subscriber_subject_ref: 'subscriber_subject_environment',
    exact_scope: scope,
    exact_scope_hash: scopeHash,
    business_engine: {
      source: 'CANONICAL_BUSINESS_ENGINE',
      exact_scope: scope,
      business_engine_ref: 'business_engine_environment',
      business_engine_version: 'business_engine_v1',
      business_engine_contract_hash: 'f'.repeat(64),
      write_authorized: false,
    },
    subscription_runtime: {
      existing_runtime: true,
      subscription_ref: 'subscription_environment',
      runtime_contract_version: 'subscriber-runtime-service-v1',
      exact_scope: scope,
      production_namespace: false,
      customer_data: false,
      migration: false,
    },
    coach_connect_runtime: {
      existing_runtime: true,
      runtime_ref: 'coach_environment',
      exact_scope: scope,
      relationship_ref: 'relationship_environment',
      consent_ref: 'consent_environment',
      coach_identity_ref: 'coach_identity_environment',
      text_only: true,
      production_persistence: false,
      transcript_persistence: false,
      live_model_provider: false,
      live_media_provider: false,
      stripe: false,
      canonical_mutation_authority: false,
    },
    issued_at: '2026-07-28T10:00:00.000Z',
    review_due_at: '2026-08-28T10:00:00.000Z',
    binding_sha256: '0'.repeat(64),
  };
  return { ...value, binding_sha256: privateRuntimeProductBindingDigest(value) };
}

function assertionConfiguration() {
  const value = {
    config_version: 'live-subscriber-assertion-configuration-v1',
    enabled: true,
    adapter_id: 'auth0-live-subscriber-assertion-adapter-v1',
    contract_version: 'live-subscriber-assertion-verifier-v1',
    environment_id: 'PRIVATE_PRODUCTION_CLASSIFIED',
    issuer: 'https://identity.private.example/',
    audience: 'https://private.runtime.example/',
    client_id: 'private_runtime_client',
    client_secret_ref: 'MORE_PRIVATE_RUNTIME_OIDC_CLIENT_SECRET_VALUE',
    authorization_endpoint: 'https://identity.private.example/authorize',
    token_endpoint: 'https://identity.private.example/oauth/token',
    jwks_uri: 'https://identity.private.example/.well-known/jwks.json',
    redirect_uri: 'https://private.runtime.example/api/internal/private-runtime-callback',
    transaction_key_ref: 'MORE_PRIVATE_RUNTIME_OIDC_TRANSACTION_KEY_VALUE',
    identity_hash_key_ref: 'MORE_PRIVATE_RUNTIME_IDENTITY_HASH_KEY_VALUE',
    exact_scope_hash: scopeHash,
    protected_edge_policy_digest: '1'.repeat(64),
    allowed_algorithms: ['RS256'],
    mfa_required: true,
    clock_skew_seconds: 30,
    transaction_ttl_ms: 300_000,
    request_timeout_ms: 500,
    configuration_sha256: '0'.repeat(64),
  };
  return {
    ...value,
    configuration_sha256: liveSubscriberAssertionConfigurationDigest(value),
  };
}

function authorityPacket(config, qual, live, product, assertion, overrides = {}) {
  const value = {
    packet_version: 'private-runtime-configuration-authority-v1',
    environment_id: config.environment_id,
    operating_mode: 'PRIVATE_LIVE',
    source_default_off: true,
    live_enabled: false,
    emergency_disabled: false,
    protected_edge_policy_digest: assertion.protected_edge_policy_digest,
    remote_security_configuration_digest: remoteSharedSecurityConfigurationDigest(config),
    qualification_certificate_digest: qual.certificate_sha256,
    live_environment_attestation_digest: live.attestation_sha256,
    product_binding_attestation_digest: product.binding_sha256,
    assertion_configuration_digest: assertion.configuration_sha256,
    qualified_adapter_source_sha256: sourceDigest,
    private_access_code_ref: 'MORE_PRIVATE_RUNTIME_ACCESS_CODE_VALUE',
    edge_assertion_key_ref: 'MORE_PRIVATE_RUNTIME_EDGE_ASSERTION_KEY_VALUE',
    activation_receipt_ref: null,
    activation_owner_ref: live.activation_owner_ref,
    rollback_owner_ref: live.rollback_owner_ref,
    monitoring_owner_ref: 'private_monitoring_owner',
    issued_at: '2026-07-28T10:00:00.000Z',
    review_due_at: '2026-08-28T10:00:00.000Z',
    packet_sha256: '0'.repeat(64),
    ...overrides,
  };
  return { ...value, packet_sha256: privateRuntimeConfigurationAuthorityDigest(value) };
}

function authorityDocuments({ packetOverrides = {}, liveOverrides = {} } = {}) {
  const config = configuration();
  const qual = certificate();
  const live = liveAttestation(config, qual, liveOverrides);
  const product = productBinding();
  const assertion = assertionConfiguration();
  const packet = authorityPacket(config, qual, live, product, assertion, packetOverrides);
  return { config, qual, live, product, assertion, packet };
}

function environment(documents) {
  return {
    MORE_PRIVATE_RUNTIME_LIVE_ENABLED: String(documents.packet.live_enabled),
    MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED: String(documents.packet.emergency_disabled),
    MORE_PRIVATE_RUNTIME_CONFIGURATION_AUTHORITY_PACKET_REF: 'MORE_PRIVATE_RUNTIME_PACKET_VALUE',
    MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_CONFIG_REF: 'MORE_PRIVATE_RUNTIME_REMOTE_CONFIG_VALUE',
    MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_QUALIFICATION_CERTIFICATE_REF:
      'MORE_PRIVATE_RUNTIME_CERTIFICATE_VALUE',
    MORE_PRIVATE_RUNTIME_REMOTE_SECURITY_ATTESTATION_REF:
      'MORE_PRIVATE_RUNTIME_LIVE_ATTESTATION_VALUE',
    MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_ATTESTATION_REF:
      'MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_VALUE',
    MORE_PRIVATE_RUNTIME_ASSERTION_CONFIGURATION_REF:
      'MORE_PRIVATE_RUNTIME_ASSERTION_CONFIG_VALUE',
    MORE_PRIVATE_RUNTIME_PACKET_VALUE: JSON.stringify(documents.packet),
    MORE_PRIVATE_RUNTIME_REMOTE_CONFIG_VALUE: JSON.stringify(documents.config),
    MORE_PRIVATE_RUNTIME_CERTIFICATE_VALUE: JSON.stringify(documents.qual),
    MORE_PRIVATE_RUNTIME_LIVE_ATTESTATION_VALUE: JSON.stringify(documents.live),
    MORE_PRIVATE_RUNTIME_PRODUCT_BINDING_VALUE: JSON.stringify(documents.product),
    MORE_PRIVATE_RUNTIME_ASSERTION_CONFIG_VALUE: JSON.stringify(documents.assertion),
  };
}

test('exact persistent PRIVATE_LIVE authority validates source-default-off', async () => {
  const documents = authorityDocuments();
  const env = environment(documents);
  const result = await readPrivateRuntimeLiveConfigurationAuthorityV1({
    env,
    resolveReference: createPrivateRuntimeEnvironmentReferenceResolver(env),
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256: sourceDigest,
    nowMs: now,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state, 'CONFIGURED_DISABLED');
  assert.equal(result.live_authority.persistent_namespace, true);
  assert.equal(result.live_authority.disposable_namespace, false);
  assert.equal(result.provider_call_required, false);
});

test('public exposure, disposable live namespace, and namespace mismatch deny', () => {
  for (const liveOverrides of [
    { public_access: true },
    { persistent_namespace: false, disposable_namespace: true },
    { namespace_digest: '9'.repeat(64) },
  ]) {
    const documents = authorityDocuments({ liveOverrides });
    const result = validatePrivateRuntimeLiveEnvironmentAuthorityV1({
      authorityPacket: documents.packet,
      remoteConfiguration: documents.config,
      qualificationCertificate: documents.qual,
      liveEnvironmentAttestation: documents.live,
      productBindingAttestation: documents.product,
      assertionConfigurationDigest: documents.assertion.configuration_sha256,
      adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
      adapterSourceSha256: sourceDigest,
      nowMs: now,
    });
    assert.equal(result.valid, false);
  }
});

test('missing reference and source digest mismatch deny before provider work', async () => {
  const documents = authorityDocuments();
  const env = environment(documents);
  delete env.MORE_PRIVATE_RUNTIME_CERTIFICATE_VALUE;
  const missing = await readPrivateRuntimeLiveConfigurationAuthorityV1({
    env,
    resolveReference: createPrivateRuntimeEnvironmentReferenceResolver(env),
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256: sourceDigest,
    nowMs: now,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.provider_call_required, false);
  const mismatch = validatePrivateRuntimeLiveEnvironmentAuthorityV1({
    authorityPacket: documents.packet,
    remoteConfiguration: documents.config,
    qualificationCertificate: documents.qual,
    liveEnvironmentAttestation: documents.live,
    productBindingAttestation: documents.product,
    assertionConfigurationDigest: documents.assertion.configuration_sha256,
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256: '9'.repeat(64),
    nowMs: now,
  });
  assert.equal(mismatch.valid, false);
});

test('activation requires an exact separate receipt and cannot come from environment presence', async () => {
  const initial = authorityDocuments({
    packetOverrides: {
      live_enabled: true,
      activation_receipt_ref: 'MORE_PRIVATE_RUNTIME_ACTIVATION_RECEIPT_VALUE',
    },
  });
  const receiptValue = {
    receipt_version: 'private-runtime-activation-receipt-v1',
    environment_id: initial.config.environment_id,
    configuration_authority_packet_digest: initial.packet.packet_sha256,
    exact_scope_hash: initial.product.exact_scope_hash,
    approved: true,
    private_live_only: true,
    public_access: false,
    named_tester_scope: 'EXACT_APPROVED_COHORT_ONLY',
    production_customer_rollout: false,
    activation_owner_ref: initial.packet.activation_owner_ref,
    rollback_owner_ref: initial.packet.rollback_owner_ref,
    emergency_disable_ready: true,
    issued_at: '2026-07-28T10:00:00.000Z',
    expires_at: '2026-07-29T10:00:00.000Z',
    receipt_sha256: '0'.repeat(64),
  };
  const receipt = {
    ...receiptValue,
    receipt_sha256: privateRuntimeActivationReceiptDigest(receiptValue),
  };
  const env = {
    ...environment(initial),
    MORE_PRIVATE_RUNTIME_ACTIVATION_RECEIPT_VALUE: JSON.stringify(receipt),
  };
  const accepted = await readPrivateRuntimeLiveConfigurationAuthorityV1({
    env,
    resolveReference: createPrivateRuntimeEnvironmentReferenceResolver(env),
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256: sourceDigest,
    nowMs: now,
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.equal(accepted.state, 'READY_FOR_PRIVATE_TEST');

  env.MORE_PRIVATE_RUNTIME_ACTIVATION_RECEIPT_VALUE = JSON.stringify({
    ...receipt,
    public_access: true,
  });
  const denied = await readPrivateRuntimeLiveConfigurationAuthorityV1({
    env,
    resolveReference: createPrivateRuntimeEnvironmentReferenceResolver(env),
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256: sourceDigest,
    nowMs: now,
  });
  assert.equal(denied.ok, false);
});

test('emergency disable remains a distinct dominant configuration state', async () => {
  const documents = authorityDocuments({
    packetOverrides: { emergency_disabled: true },
  });
  const env = environment(documents);
  const result = await readPrivateRuntimeLiveConfigurationAuthorityV1({
    env,
    resolveReference: createPrivateRuntimeEnvironmentReferenceResolver(env),
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256: sourceDigest,
    nowMs: now,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state, 'EMERGENCY_DISABLED');
  assert.equal(result.provider_call_required, false);
});
