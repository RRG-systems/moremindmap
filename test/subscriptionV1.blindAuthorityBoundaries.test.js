import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { issueBlindScope } from '../api/engine/subscriptionBlindDemo/authority.js';
import { createBlindProvider } from '../api/engine/subscriptionBlindDemo/provider.js';

const auth = () => ({ ok: true, capability_hash: 'a'.repeat(64), capability: {
  contract: 'subscription_v1_internal_capability_v2', authority_source: 'LEADERSHIP_DEMO',
  launcher_scope_id: 'leadership_demo_guard', synthetic_only: true, allowed_demo_subjects: ['synthetic'],
  demo_subject_id: 'synthetic', subject_key: 're-mid', relationship_key: 'rel_11111111111111111111',
  synthetic_relationship_key: 'rel_11111111111111111111', expires_at: new Date(Date.now() + 3600000).toISOString(),
} });

test('all nonexperiment product and subject contexts are denied before any credential consumption', () => {
  const cases = [
    ['canonical subscription', { authority_source: 'SUBSCRIPTION' }],
    ['real customer', { synthetic_only: false }],
    ['Patricia', { subject_key: 'patricia-demo-s2', demo_subject_id: 'patricia-demo' }],
    ['Consulting', { contract: 'recruiting_demo_capability_v1' }],
    ['Recruiting', { authority_source: 'RECRUITING_ADMIN' }],
    ['BOS', { authority_source: 'BOS' }],
    ['BA', { authority_source: 'BA' }],
    ['Fusion', { authority_source: 'FUSION' }],
    ['Coach Connect', { authority_source: 'COACH_CONNECT' }],
    ['direct synthetic', { authority_source: 'DIRECT_SYNTHETIC' }],
    ['wrong root', { relationship_key: 'rel_22222222222222222222' }],
    ['expired', { expires_at: '2000-01-01T00:00:00.000Z' }],
    ['missing launcher', { launcher_scope_id: null }],
    ['missing allowed subject', { allowed_demo_subjects: [] }],
  ];
  let reads = 0, transmissions = 0;
  const env = new Proxy({}, { get() { reads += 1; return 'fixture-only'; } });
  for (const [label, overrides] of cases) {
    const value = auth(); Object.assign(value.capability, overrides);
    assert.throws(() => {
      const scope = issueBlindScope(value, '1');
      createBlindProvider({ scope, env, clientFactory() { transmissions += 1; } });
    }, /BLIND_DEMO_AUTHORITY_DENIED/u, label);
  }
  for (const value of [null, {}, { ...auth(), ok: false }, { ...auth(), capability_hash: '' }]) {
    assert.throws(() => issueBlindScope(value, '1'), /BLIND_DEMO_AUTHORITY_DENIED/u);
  }
  assert.equal(reads, 0);
  assert.equal(transmissions, 0);
});

test('only one server module consumes the new binding and only authenticated demo dispatcher imports the route', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? walk(path.join(dir, entry.name)) : /\.[cm]?jsx?$/u.test(entry.name) ? [path.join(dir, entry.name)] : []);
  const consumers = [...walk(path.join(root, 'api')), ...walk(path.join(root, 'src'))].filter((file) => fs.readFileSync(file, 'utf8').includes('SUBSCRIPTION_DEMO_EXPERIMENT_API_KEY'));
  assert.deepEqual(consumers.map((file) => path.relative(root, file)), ['api/engine/subscriptionBlindDemo/provider.js']);
  const entry = fs.readFileSync(path.join(root, 'api/internal/subscription-v1-runtime.js'), 'utf8');
  assert.match(entry, /if \(auth\.ok && hasDarrenDemoAuthority\(auth\.capability\)\)/u);
  const clientFiles = walk(path.join(root, 'src'));
  for (const file of clientFiles) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /subscriptionBlindDemo\/(?:privateAssignment|provider|authority)/u);
});
