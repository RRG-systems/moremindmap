import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSyntheticQaEntitlement,
  consumeSyntheticQaRuntimeCsrf,
  issueSyntheticQaRuntimeCsrf,
  assertSyntheticQaBusinessScope,
  SYNTHETIC_QA_RUNTIME_NAMESPACE,
  syntheticQaRuntimeKeys,
  syntheticQaRuntimeRelationshipKey,
  syntheticQaScope,
} from '../api/engine/subscriptionV1/syntheticQaRuntimeInfrastructure.js';
import { entitlementAllowsCoaching } from '../src/lib/subscriptionV1/entitlement.js';
import { validateSubscriptionV1Contract } from '../src/lib/subscriptionV1/contracts.js';

const input = {
  profile_id: 'mm-20260910-an45m4vu',
  assessment_id: 'ba-20260910-bcac8865',
  vertical_binding_sha256: '9'.repeat(64),
  authority_id: 'synthetic-cohort-v1-re-a',
};

test('synthetic QA scope and runtime keys are deterministic, exact, and paid-namespace isolated', () => {
  const scope = syntheticQaScope(input);
  assert.deepEqual(scope, syntheticQaScope({ ...input }));
  assert.equal(scope.profile_id, input.profile_id);
  assert.match(scope.subject_id, /^synthetic_qa_subject_[a-f0-9]{40}$/u);
  assert.match(scope.membership_id, /^synthetic_qa_scope_[a-f0-9]{40}$/u);
  assert.match(scope.business_id, /^business_[a-f0-9]{40}$/u);
  assert.equal(scope.tenant_id, 'synthetic_qa');

  const keys = syntheticQaRuntimeKeys({ scope });
  assert.equal(Object.values(keys).filter((value) => typeof value === 'string')
    .every((value) => value === keys.scope_hash || value.startsWith(`${SYNTHETIC_QA_RUNTIME_NAMESPACE}:`)), true);
  assert.equal(Object.values(keys).some((value) => String(value).includes('paid-runtime')), false);
  assert.match(syntheticQaRuntimeRelationshipKey(scope), /^synthetic_qa_[a-f0-9]{32}$/u);
  assert.doesNotThrow(() => assertSyntheticQaBusinessScope(
    scope,
    input.assessment_id,
    input.vertical_binding_sha256,
    input.authority_id,
  ));

  const other = syntheticQaScope({ ...input, profile_id: 'mm-20260910-bbbbbbbb' });
  assert.notEqual(syntheticQaRuntimeKeys({ scope: other }).scope_hash, keys.scope_hash);
  assert.notEqual(syntheticQaRuntimeRelationshipKey(other), syntheticQaRuntimeRelationshipKey(scope));
});

test('synthetic QA entitlement is valid and truthfully nonbilling', () => {
  const scope = syntheticQaScope(input);
  const entitlement = createSyntheticQaEntitlement({
    scope,
    authority_id: input.authority_id,
    manifest_version: 'synthetic-cohort-v1',
    manifest_sha256: 'a'.repeat(64),
    expires_at: '2026-10-15T00:00:00.000Z',
    as_of: new Date('2026-09-13T20:00:00.000Z'),
  });
  assert.equal(validateSubscriptionV1Contract(entitlement).valid, true);
  assert.equal(entitlement.contract_id, 'synthetic_qa_entitlement');
  assert.equal(entitlement.billing_evidence, false);
  assert.equal(entitlement.stripe_subscription_created, false);
  assert.equal(entitlement.synthetic_only, true);
  assert.equal('stripe_customer_hash' in entitlement, false);
  assert.equal('stripe_subscription_hash' in entitlement, false);
  assert.equal('source_event_ids' in entitlement, false);
  assert.deepEqual(entitlementAllowsCoaching(entitlement, '2026-09-13T20:00:00.000Z'), {
    allowed: true,
    code: 'ENTITLEMENT_ACTIVE',
    entitlement_id: entitlement.entitlement_id,
  });
  assert.deepEqual(entitlementAllowsCoaching(entitlement, '2026-10-15T00:00:00.000Z'), {
    allowed: false,
    code: 'ENTITLEMENT_TERMINATED',
  });
});

test('synthetic QA entitlement fails closed on expiry, malformed authority, and billing-shaped additions', () => {
  const scope = syntheticQaScope(input);
  assert.throws(() => createSyntheticQaEntitlement({
    scope,
    authority_id: input.authority_id,
    manifest_version: 'synthetic-cohort-v1',
    manifest_sha256: 'a'.repeat(64),
    expires_at: '2026-09-13T19:59:59.000Z',
    as_of: new Date('2026-09-13T20:00:00.000Z'),
  }), /ENTITLEMENT_EXPIRED/u);
  assert.throws(() => syntheticQaScope({ ...input, authority_id: 'short' }), /AUTHORITY_INVALID/u);

  const entitlement = createSyntheticQaEntitlement({
    scope,
    authority_id: input.authority_id,
    manifest_version: 'synthetic-cohort-v1',
    manifest_sha256: 'b'.repeat(64),
    expires_at: '2026-10-15T00:00:00.000Z',
    as_of: new Date('2026-09-13T20:00:00.000Z'),
  });
  const corrupted = { ...entitlement, stripe_customer_hash: 'c'.repeat(64) };
  assert.equal(validateSubscriptionV1Contract(corrupted).valid, false);
  assert.equal(entitlementAllowsCoaching(corrupted, '2026-09-13T20:00:00.000Z').allowed, false);
});

test('synthetic runtime CSRF is one-time and never enters an internal or paid namespace', async () => {
  const values = new Map();
  const seenKeys = [];
  const redis = {
    async set(key, value) {
      seenKeys.push(key);
      if (values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    },
    async getdel(key) {
      seenKeys.push(key);
      const value = values.get(key) ?? null;
      values.delete(key);
      return value;
    },
  };
  const capabilityHash = 'f'.repeat(64);
  const proof = await issueSyntheticQaRuntimeCsrf({ redis, capabilityHash });
  assert.equal(await consumeSyntheticQaRuntimeCsrf({ redis, capabilityHash, proof }), true);
  assert.equal(await consumeSyntheticQaRuntimeCsrf({ redis, capabilityHash, proof }), false);
  assert.equal(seenKeys.every((key) => key.startsWith(`${SYNTHETIC_QA_RUNTIME_NAMESPACE}:runtime-csrf:`)), true);
  assert.equal(seenKeys.some((key) => /internal-dev|paid-runtime/u.test(key)), false);
});
