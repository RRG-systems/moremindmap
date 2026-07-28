import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REMOTE_SECURITY_RECORD_SCHEMAS,
  containsForbiddenRemoteSecurityMaterial,
  createRemoteSecurityRecord,
  remoteSecurityBackupRestoreQualificationPlan,
  remoteSecurityDeletionDecision,
  remoteSecurityRecordManifest,
  remoteSecurityRecordRetentionDecision,
  validateRemoteSecurityRecord,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js';
import {
  defaultRemoteSharedSecurityConfiguration,
  remoteSharedSecurityEnvironmentIsolationDecision,
  remoteSharedSecurityRetentionDecision,
  remoteSharedSecuritySecretBoundary,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/configuration.js';
import {
  remoteSharedSecurityCommandScriptManifest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/scriptManifest.js';
import {
  remoteSharedSecurityQueryScriptManifest,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/authoritativeQueries.js';
import {
  buildDisposableQualificationTeardownInvocation,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js';

const environmentDigest = 'a'.repeat(64);
const now = Date.parse('2026-07-27T20:00:00.000Z');

test('record manifest contains the ten reviewed record families', () => {
  const manifest = remoteSecurityRecordManifest();
  assert.equal(manifest.length, 10);
  assert.equal(Object.keys(REMOTE_SECURITY_RECORD_SCHEMAS).length, 10);
  assert.equal(manifest.every((entry) => entry.raw_token_persistence === false), true);
  assert.equal(manifest.every((entry) => entry.product_content_persistence === false), true);
});

test('record creation is versioned, provider-timed, and deterministic', () => {
  const record = createRemoteSecurityRecord({
    schema_name: 'SecurityEpochV1',
    environment_digest: environmentDigest,
    provider_time_ms: now,
    fields: {
      scope_digest: 'b'.repeat(64),
      epoch: 1,
      status: 'ACTIVE',
      reason_code: 'INITIALIZED',
      last_audit_receipt_ref: 'audit_fixture',
    },
  });
  assert.equal(record.record_type, 'security-epoch-v1');
  assert.equal(record.record_version, 1);
  assert.match(record.record_etag, /^[a-f0-9]{64}$/);
  assert.equal(validateRemoteSecurityRecord(record, { environment_digest: environmentDigest }).valid, true);
});

test('forbidden identity, credential, product, and transcript material is rejected', () => {
  for (const value of [
    { raw_token: 'fixture' },
    { credential_value: 'fixture' },
    { email: 'fixture' },
    { business_engine_payload: {} },
    { transcript: 'fixture' },
    { prompt: 'fixture' },
    { stripe_customer: 'fixture' },
  ]) {
    assert.equal(containsForbiddenRemoteSecurityMaterial(value), true);
  }
  assert.throws(() => createRemoteSecurityRecord({
    schema_name: 'PrivacySafeSecurityAuditV2',
    environment_digest: environmentDigest,
    provider_time_ms: now,
    fields: {
      status: 'APPENDED',
      audit_id_hash: 'b'.repeat(64),
      event_type: 'AUTHENTICATION',
      transcript: 'forbidden',
    },
  }), /invalid/);
});

test('provider TTL controls authority and does not claim backup deletion', () => {
  const record = createRemoteSecurityRecord({
    schema_name: 'CsrfGrantV2',
    environment_digest: environmentDigest,
    provider_time_ms: now,
    fields: {
      status: 'ACTIVE',
      grant_ref: 'grant_fixture',
      grant_lookup: 'b'.repeat(64),
      session_ref: 'session_fixture',
      expires_at_ms: now + 60_000,
    },
  });
  assert.equal(remoteSecurityRecordRetentionDecision(record, now).authoritative, true);
  assert.equal(remoteSecurityRecordRetentionDecision(record, now + 60_000).authoritative, false);
  assert.equal(remoteSecurityRecordRetentionDecision(record, now).deletion_proof, false);
  assert.equal(remoteSecurityRecordRetentionDecision(record, now).backup_retention_extends_authority, false);
});

test('allow and denial audit is same-script and time-bounded', () => {
  const sources = [
    ...remoteSharedSecurityCommandScriptManifest(),
    ...remoteSharedSecurityQueryScriptManifest(),
  ].map((entry) => entry.source);
  assert.equal(sources.every((source) => source.includes("'XADD'")), true);
  assert.equal(sources.every((source) => source.includes("'XTRIM'")), true);
  assert.equal(sources.every((source) => source.includes("'MINID'")), true);
  assert.equal(sources.some((source) => /raw_token|transcript|model_output/.test(source)), false);
});

test('environment isolation rejects shared database, credential, namespace, or digest keys', () => {
  const first = {
    ...defaultRemoteSharedSecurityConfiguration(),
    environment_id: 'PRIVATE_PREVIEW',
    provider_database_id_digest: '1'.repeat(64),
    namespace_digest: '2'.repeat(64),
  };
  const colliding = {
    ...first,
    environment_id: 'PRIVATE_PRODUCTION_CLASSIFIED',
  };
  const collision = remoteSharedSecurityEnvironmentIsolationDecision(first, colliding);
  assert.equal(collision.isolated, false);
  assert.equal(collision.failures.includes('PROVIDER_DATABASE_COLLISION'), true);
  assert.equal(collision.failures.includes('PROVIDER_CREDENTIAL_COLLISION'), true);
  assert.equal(collision.failures.includes('NAMESPACE_COLLISION'), true);
});

test('retention and secret boundaries fail closed without named live authority', () => {
  const preview = {
    ...defaultRemoteSharedSecurityConfiguration(),
    environment_id: 'PRIVATE_PREVIEW',
  };
  assert.equal(remoteSharedSecurityRetentionDecision(preview).allowed, false);
  const secretBoundary = remoteSharedSecuritySecretBoundary();
  assert.equal(secretBoundary.server_side_only, true);
  assert.equal(secretBoundary.repository_values_allowed, false);
  assert.equal(secretBoundary.client_bundle_values_allowed, false);
  assert.equal(secretBoundary.credential_binding_campaign_required, true);
});

test('backup restore requires an isolated empty namespace and never includes content', () => {
  const plan = remoteSecurityBackupRestoreQualificationPlan({
    source_environment_id: 'DISPOSABLE_QUALIFICATION',
    source_namespace_digest: '1'.repeat(64),
    restore_environment_id: 'DISPOSABLE_RESTORE',
    restore_namespace_digest: '2'.repeat(64),
    backup_retention_days: 1,
  });
  assert.equal(plan.allowed_for_qualification, true);
  assert.equal(plan.isolated_empty_restore_required, true);
  assert.equal(plan.in_place_restore_allowed, false);
  assert.equal(plan.production_customer_data_allowed, false);
  assert.equal(plan.transcript_backup_allowed, false);
  assert.equal(plan.teardown_after_proof_required, true);
});

test('deletion proof does not confuse TTL, teardown, or backups with erasure', () => {
  const incomplete = remoteSecurityDeletionDecision({
    active_authority_revoked: true,
    epoch_advanced: true,
  });
  assert.equal(incomplete.deletion_proven, false);
  assert.equal(incomplete.expiry_is_deletion_proof, false);
  assert.equal(incomplete.namespace_teardown_is_backup_deletion_proof, false);
  assert.equal(incomplete.cryptographic_erasure_claimed, false);
});

test('teardown construction is namespace-bounded and never flushes a database', () => {
  const invocation = buildDisposableQualificationTeardownInvocation({
    operating_mode: 'QUALIFICATION',
    namespace_digest: 'a'.repeat(64),
    cursor: '0',
    authority_receipt_ref: 'future_qualification_authority',
  });
  assert.equal(invocation.destructive_scope, 'ONE_EXACT_QUALIFICATION_NAMESPACE');
  assert.equal(invocation.production_namespace_allowed, false);
  assert.equal(invocation.backup_deletion_claimed, false);
  assert.match(invocation.command[1], /SCAN/);
  assert.match(invocation.command[1], /UNLINK/);
  assert.doesNotMatch(invocation.command[1], /FLUSHDB|FLUSHALL/);
});
