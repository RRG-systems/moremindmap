import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createQualificationDigestFunction,
  createRemoteSharedSecurityKeyspace,
  remoteSharedSecurityKeysShareOneSlot,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/remoteSharedSecurity/keyspace.js';

const namespaceDigest = 'a'.repeat(64);
const digest = createQualificationDigestFunction('offline-qualification-fixture-key-32-bytes');

test('all remote keys are opaque and share one environment hash slot', () => {
  const keyspace = createRemoteSharedSecurityKeyspace({ namespace_digest: namespaceDigest, digest });
  const keys = [
    keyspace.externalSubject('verified_subject_fixture'),
    keyspace.exactScope('b'.repeat(64)),
    keyspace.sessionToken('c'.repeat(64)),
    keyspace.approval('subscriber_fixture', 'b'.repeat(64)),
    keyspace.entitlementToken('d'.repeat(64)),
    keyspace.csrf('e'.repeat(64)),
    keyspace.replay('f'.repeat(64)),
    keyspace.scopeEpoch('b'.repeat(64)),
    keyspace.audit,
  ];
  assert.equal(remoteSharedSecurityKeysShareOneSlot(keys), true);
  assert.equal(keys.every((key) => key.startsWith(`more:cc:security:v2:{${namespaceDigest}}:`)), true);
  assert.equal(keys.join('\n').includes('verified_subject_fixture'), false);
  assert.equal(keys.join('\n').includes('subscriber_fixture'), false);
});

test('different environment namespaces cannot collide', () => {
  const first = createRemoteSharedSecurityKeyspace({ namespace_digest: namespaceDigest, digest });
  const second = createRemoteSharedSecurityKeyspace({
    namespace_digest: 'b'.repeat(64),
    digest,
  });
  assert.notEqual(first.sessionToken('c'.repeat(64)), second.sessionToken('c'.repeat(64)));
  assert.equal(remoteSharedSecurityKeysShareOneSlot([
    first.sessionToken('c'.repeat(64)),
    second.sessionToken('c'.repeat(64)),
  ]), false);
});

test('keyspace rejects missing keyed digest material and arbitrary families', () => {
  assert.throws(
    () => createRemoteSharedSecurityKeyspace({ namespace_digest: namespaceDigest }),
    /invalid/,
  );
  assert.throws(
    () => createQualificationDigestFunction('short'),
    /server-side secret/,
  );
});

test('rate-limit keys contain only an opaque keyed dimension', () => {
  const keyspace = createRemoteSharedSecurityKeyspace({ namespace_digest: namespaceDigest, digest });
  const key = keyspace.rateLimit('pre_auth', 'raw-address-prohibited-fixture', 'window_1');
  assert.equal(key.includes('raw-address-prohibited-fixture'), false);
  assert.match(key, /:rate:[a-f0-9]{64}$/);
});

