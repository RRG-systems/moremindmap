import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createExactVaultProfileReader,
  createSubdev1AuthoritativeProfileResolver,
  createSubdev1CanonicalExactProfileRepository,
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const now = '2099-01-01T00:00:00.000Z';

function result(queryType, record) {
  return {
    result_version: 'async-security-query-result-v2',
    ok: true,
    query_type: queryType,
    consistency_proven: true,
    server_time: now,
    record_version: 1,
    record,
    failure_code: null,
    receipt_ref: `receipt_${queryType.toLowerCase()}`,
  };
}

function authority(profileId, suffix) {
  const exactScope = {
    tenant_id: `tenant_${suffix}`,
    profile_id: profileId,
    business_id: `business_${suffix}`,
    subscriber_id: `subscriber_${suffix}`,
  };
  const exactScopeHash = hashPrivateRuntimeScope(exactScope);
  const subject = `subscriber_subject_${suffix}`;
  return {
    exactScope,
    productBinding: {
      environment_id: 'private_beta_test',
      subscriber_subject_ref: subject,
      exact_scope: exactScope,
      exact_scope_hash: exactScopeHash,
    },
    productExecution: {
      environment_id: 'private_beta_test',
      exact_scope: exactScope,
      exact_scope_hash: exactScopeHash,
      approved_profile_ids: [profileId],
      execution_enabled: true,
      private_beta_only: true,
      public_access: false,
    },
    statePort: {
      async queryAuthoritative(query) {
        if (query.query_type === 'GET_SECURITY_EPOCH') {
          return result(query.query_type, {
            exact_scope_hash: exactScopeHash,
            security_epoch: 3,
          });
        }
        return result(query.query_type, {
          record_version: 'private-test-approval-v1',
          approval_ref: `approval_${suffix}`,
          environment_id: 'private_beta_test',
          subscriber_subject_ref: subject,
          exact_scope_hash: exactScopeHash,
          purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
          status: 'ACTIVE',
          issued_at: '2098-12-01T00:00:00.000Z',
          expires_at: '2099-02-01T00:00:00.000Z',
          security_epoch: 3,
        });
      },
    },
  };
}

function repository(profileId, suffix) {
  const configured = authority(profileId, suffix);
  let reads = 0;
  const client = {
    async get(key) {
      reads += 1;
      assert.equal(key, `vault:profile:${profileId}`);
      return JSON.stringify({
        profile_id: profileId,
        canonical_profile_json: {
          profile_id: profileId,
          synthetic_fixture: true,
        },
      });
    },
  };
  return {
    reads: () => reads,
    repository: createSubdev1CanonicalExactProfileRepository({
      readCanonicalProfile: createExactVaultProfileReader({ client }),
      productBindingAttestation: configured.productBinding,
      productExecutionBinding: configured.productExecution,
      statePort: configured.statePort,
      environmentId: 'private_beta_test',
    }),
  };
}

test('synthetic Profiles A and B resolve independently to exact canonical scope', async () => {
  for (const [profileId, suffix] of [
    ['mm-20990101-aaaaaaaa', 'a'],
    ['mm-20990102-bbbbbbbb', 'b'],
  ]) {
    const fixture = repository(profileId, suffix);
    const resolver = createSubdev1AuthoritativeProfileResolver({
      repository: fixture.repository,
    });
    const resolved = await resolver.resolve(profileId);
    assert.equal(resolved.allowed, true);
    assert.equal(resolved.record.profile_id, profileId);
    assert.deepEqual(resolved.record.exact_scope, authority(profileId, suffix).exactScope);
    assert.equal(resolved.record.consent_ref, `approval_${suffix}`);
    assert.equal(
      resolved.record.consent_purpose,
      SUBDEV1_PROFILE_CONSENT_PURPOSE,
    );
    assert.equal(resolved.record.provenance.source, 'CANONICAL_PROFILE_REPOSITORY');
    assert.match(resolved.record.profile_revision, /^vault_revision_[a-f0-9]{64}$/);
    assert.equal(fixture.reads(), 1);
  }
});

test('repository revalidates explicit permitted-test authority on every use', async () => {
  const profileId = 'mm-20990101-aaaaaaaa';
  const configured = authority(profileId, 'a');
  let authorityReads = 0;
  const statePort = {
    async queryAuthoritative(query) {
      authorityReads += 1;
      return configured.statePort.queryAuthoritative(query);
    },
  };
  const profileRepository = createSubdev1CanonicalExactProfileRepository({
    readCanonicalProfile: async () => ({
      status: 'FOUND',
      record: { profile_id: profileId },
    }),
    productBindingAttestation: configured.productBinding,
    productExecutionBinding: configured.productExecution,
    statePort,
    environmentId: 'private_beta_test',
  });
  const resolver = createSubdev1AuthoritativeProfileResolver({
    repository: profileRepository,
  });
  assert.equal((await resolver.resolve(profileId)).allowed, true);
  assert.equal((await resolver.resolve(profileId)).allowed, true);
  assert.equal(authorityReads, 4);
  assert.equal(profileRepository.non_enumerating, true);
  assert.equal(profileRepository.mutation_authority, false);
  assert.equal(profileRepository.authority_source, 'EXPLICIT_PRIVATE_TEST_APPROVAL');
});

test('exact Vault reader performs one exact non-enumerating key read and no writes', async () => {
  const calls = [];
  const reader = createExactVaultProfileReader({
    client: {
      async get(key) {
        calls.push(['get', key]);
        return JSON.stringify({
          profile_id: 'mm-20990101-aaaaaaaa',
          canonical_profile_json: { profile_id: 'mm-20990101-aaaaaaaa' },
        });
      },
      async set() {
        calls.push(['set']);
      },
    },
  });
  assert.equal((await reader('mm-20990101-aaaaaaaa')).status, 'FOUND');
  assert.deepEqual(calls, [
    ['get', 'vault:profile:mm-20990101-aaaaaaaa'],
  ]);
});
