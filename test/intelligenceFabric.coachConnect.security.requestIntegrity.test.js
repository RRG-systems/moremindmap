import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimRequestReplay,
  completeRequestReplay,
  consumeCsrfGrant,
  evaluateRequestOrigin,
  evaluateRequestTimestamp,
  InMemorySecurityStateStore,
  issueCsrfGrant,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';

const route = '/api/internal/developer-access';
const environment = 'security-test';

test('origin validation is exact and supports only trusted missing-Origin fallback', () => {
  const allowed = ['https://preview.example.test'];
  assert.equal(evaluateRequestOrigin({ request: { headers: { origin: allowed[0] } }, allowed_origins: allowed }).allowed, true);
  assert.equal(evaluateRequestOrigin({ request: { headers: { origin: 'https://attacker.example.test' } }, allowed_origins: allowed }).code, 'ORIGIN_VALIDATION_FAILED');
  assert.equal(evaluateRequestOrigin({ request: { headers: { origin: 'null' } }, allowed_origins: allowed }).allowed, false);
  assert.equal(evaluateRequestOrigin({ request: { headers: { referer: `${allowed[0]}/map`, 'sec-fetch-site': 'same-origin' } }, allowed_origins: allowed }).allowed, true);
  assert.equal(evaluateRequestOrigin({ request: { headers: { referer: `${allowed[0]}/map`, 'sec-fetch-site': 'cross-site' } }, allowed_origins: allowed }).allowed, false);
});

test('CSRF proof is method route browser environment bound and one-time', () => {
  const store = new InMemorySecurityStateStore();
  const issued = issueCsrfGrant({
    store,
    proof: 'csrf-proof-security-at-least-twenty-four-characters',
    browser_binding_hash: 'browser_hash',
    method: 'POST',
    route,
    environment_id: environment,
    now: 1000,
  });
  assert.equal(issued.ok, true);
  assert.equal(consumeCsrfGrant({ store, proof: issued.proof, browser_binding_hash: 'other_browser', method: 'POST', route, environment_id: environment, now: 2000 }).allowed, false);
  assert.equal(consumeCsrfGrant({ store, proof: issued.proof, browser_binding_hash: 'browser_hash', method: 'POST', route, environment_id: environment, now: 2000 }).allowed, true);
  assert.equal(consumeCsrfGrant({ store, proof: issued.proof, browser_binding_hash: 'browser_hash', method: 'POST', route, environment_id: environment, now: 2001 }).code, 'CSRF_VALIDATION_FAILED');
});

test('request timestamp fails closed outside the replay window', () => {
  assert.equal(evaluateRequestTimestamp({ timestamp: 1000, now: 2000, window_ms: 2000 }).allowed, true);
  assert.equal(evaluateRequestTimestamp({ timestamp: 1000, now: 4000, window_ms: 2000 }).code, 'REQUEST_REPLAY_DETECTED');
  assert.equal(evaluateRequestTimestamp({ timestamp: 'ambiguous', now: 2000 }).allowed, false);
});

test('idempotent replay returns prior result while conflicting fingerprint denies', () => {
  const store = new InMemorySecurityStateStore();
  const input = { store, scope: { tenant_id: 't' }, action: 'CONFIRM', idempotency_key: 'idem', nonce: 'nonce', request_fingerprint: { response: 'ACCEPT' }, now: 1000 };
  const first = claimRequestReplay(input);
  assert.equal(first.status, 'CLAIMED');
  assert.equal(completeRequestReplay({ store, key: first.key, fingerprint: first.fingerprint, result_reference: 'receipt_1', now: 1100 }).ok, true);
  const replay = claimRequestReplay({ ...input, now: 1200 });
  assert.equal(replay.status, 'IDEMPOTENT_REPLAY');
  assert.equal(replay.result_reference, 'receipt_1');
  assert.equal(claimRequestReplay({ ...input, request_fingerprint: { response: 'REJECT' }, now: 1300 }).code, 'REQUEST_REPLAY_DETECTED');
});
