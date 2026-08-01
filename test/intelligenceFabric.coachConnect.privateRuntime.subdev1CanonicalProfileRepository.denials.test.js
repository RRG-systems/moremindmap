import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSubdev1AuthoritativeProfileResolver,
  createSubdev1CanonicalExactProfileRepository,
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';
import {
  createRemoteSecurityRecord,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/recordSchemas.js';

const profileId = 'mm-20990101-aaaaaaaa';
const exactScope = {
  tenant_id: 'tenant_a',
  profile_id: profileId,
  business_id: 'business_a',
  subscriber_id: 'subscriber_a',
};
const exactScopeHash = hashPrivateRuntimeScope(exactScope);

function canonicalApprovalRecord({
  scopeHash,
  status,
  purpose,
  securityEpoch,
}) {
  const issuedAtMs = Date.parse('2098-12-01T00:00:00.000Z');
  const expiresAtMs = Date.parse('2099-02-01T00:00:00.000Z');
  const base = createRemoteSecurityRecord({
    schema_name: 'PrivateTestApprovalV1',
    environment_digest: 'd'.repeat(64),
    provider_time_ms: issuedAtMs,
    fields: {
      approval_ref: 'approval_a',
      environment_id: 'private_beta_test',
      subscriber_subject_ref: 'subject_a',
      exact_scope_hash: scopeHash,
      purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
      provenance_ref: 'e'.repeat(64),
      status: 'ACTIVE',
      approval_epoch: 1,
      security_epoch: 2,
      issued_at: new Date(issuedAtMs).toISOString(),
      expires_at: new Date(expiresAtMs).toISOString(),
      issued_at_ms: issuedAtMs,
      expires_at_ms: expiresAtMs,
    },
  });
  const changed = {
    ...base,
    purpose,
    status,
    security_epoch: securityEpoch,
  };
  if (status === 'REVOKED') {
    changed.revoked_at_ms = issuedAtMs + 1000;
    changed.updated_at_ms = issuedAtMs + 1000;
  }
  return changed;
}

function queryResult(queryType, {
  ok = true,
  record = null,
  failureCode = null,
} = {}) {
  return {
    result_version: 'async-security-query-result-v2',
    ok,
    query_type: queryType,
    consistency_proven: ok,
    server_time: '2099-01-01T00:00:00.000Z',
    record_version: ok ? 1 : null,
    record: ok ? record : null,
    failure_code: ok ? null : failureCode,
    receipt_ref: `receipt_${queryType.toLowerCase()}`,
  };
}

function fixture({
  vaultStatus = 'FOUND',
  vaultRecord = { profile_id: profileId },
  approvalStatus = 'ACTIVE',
  approvalPurpose = 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
  approvalEpoch = 2,
  currentEpoch = 2,
  approvedProfiles = [profileId],
  productScope = exactScope,
  executionScope = productScope,
} = {}) {
  const scopeHash = hashPrivateRuntimeScope(productScope);
  const executionScopeHash = hashPrivateRuntimeScope(executionScope);
  return createSubdev1CanonicalExactProfileRepository({
    readCanonicalProfile: async () => ({
      status: vaultStatus,
      record: vaultStatus === 'FOUND' ? vaultRecord : null,
    }),
    productBindingAttestation: {
      environment_id: 'private_beta_test',
      subscriber_subject_ref: 'subject_a',
      exact_scope: productScope,
      exact_scope_hash: scopeHash,
    },
    productExecutionBinding: {
      environment_id: 'private_beta_test',
      exact_scope: executionScope,
      exact_scope_hash: executionScopeHash,
      approved_profile_ids: approvedProfiles,
      execution_enabled: true,
      private_beta_only: true,
      public_access: false,
    },
    statePort: {
      async queryAuthoritative(query) {
        if (query.query_type === 'GET_SECURITY_EPOCH') {
          return queryResult(query.query_type, {
            record: {
              exact_scope_hash: scopeHash,
              security_epoch: currentEpoch,
            },
          });
        }
        return queryResult(query.query_type, {
          record: canonicalApprovalRecord({
            scopeHash,
            status: approvalStatus,
            purpose: approvalPurpose,
            securityEpoch: approvalEpoch,
          }),
        });
      },
    },
    environmentId: 'private_beta_test',
  });
}

async function resolve(repository, selected = profileId) {
  return repository.resolveExactProfile(selected, {
    purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
    mutation_allowed: false,
    enumeration_allowed: false,
  });
}

test('missing, malformed, unknown, ambiguous, and incomplete records fail closed', async () => {
  assert.equal((await resolve(fixture(), 'not-a-profile')).status, 'NOT_FOUND');
  assert.equal((await resolve(fixture({ vaultStatus: 'NOT_FOUND' }))).status, 'NOT_FOUND');
  assert.equal((await resolve(fixture({ vaultStatus: 'AMBIGUOUS' }))).status, 'AMBIGUOUS');
  assert.equal((await resolve(fixture({
    vaultStatus: 'INCOMPLETE',
    vaultRecord: null,
  }))).status, 'INCOMPLETE');
  assert.equal((await resolve(fixture({ approvedProfiles: [] }))).status, 'NOT_FOUND');
});

test('missing, revoked, wrong-purpose, and stale permitted-test authority fail closed', async () => {
  assert.equal((await resolve(fixture({ approvalStatus: 'REVOKED' }))).status, 'NOT_FOUND');
  assert.equal((await resolve(fixture({ approvalPurpose: 'OTHER' }))).status, 'NOT_FOUND');
  assert.equal((await resolve(fixture({
    approvalEpoch: 1,
    currentEpoch: 2,
  }))).status, 'NOT_FOUND');
});

test('client scope/name claims are rejected and syntax alone grants no authority', async () => {
  const repository = fixture();
  const deniedClaims = await repository.resolveExactProfile(profileId, {
    purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
    mutation_allowed: false,
    enumeration_allowed: false,
    tenant_id: 'client_tenant',
    business_id: 'client_business',
    subscriber_id: 'client_subscriber',
    name: 'Client Name',
  });
  assert.equal(deniedClaims.status, 'DENIED');

  const differentProfile = 'mm-20990102-bbbbbbbb';
  assert.equal((await resolve(repository, differentProfile)).status, 'NOT_FOUND');
  const resolver = createSubdev1AuthoritativeProfileResolver({ repository });
  assert.equal((await resolver.resolve('Client Name')).allowed, false);
});

test('configured subject and exact scope must be complete and mutually consistent', async () => {
  const mismatchedScope = { ...exactScope, business_id: 'business_other' };
  assert.equal((await resolve(fixture({ executionScope: mismatchedScope }))).status, 'NOT_FOUND');
  assert.equal(exactScopeHash, hashPrivateRuntimeScope(exactScope));
});
