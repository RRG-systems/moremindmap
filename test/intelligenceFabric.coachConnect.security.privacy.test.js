import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSecurityAuditEvent,
  redactSecurityValue,
  shapePrivacyResponse,
  validateCoachConnectPrivacyTransition,
  verifyPrivacySafeValue,
} from '../src/lib/intelligenceFabric/coachConnect/security/index.js';

test('privacy transitions require purpose consent and human review', () => {
  assert.equal(validateCoachConnectPrivacyTransition({ from: 'COACH_SHARED', to: 'BUSINESS_ENGINE_ELIGIBLE', purpose: 'BUSINESS_ENGINE_EVALUATION', authorized: true, consent_granted: true, human_reviewed: true }).allowed, true);
  assert.equal(validateCoachConnectPrivacyTransition({ from: 'COACH_SHARED', to: 'BUSINESS_ENGINE_ELIGIBLE', purpose: 'BUSINESS_ENGINE_EVALUATION', authorized: true, consent_granted: false, human_reviewed: true }).code, 'CONSENT_MISSING');
  assert.equal(validateCoachConnectPrivacyTransition({ from: 'RESTRICTED_SENSITIVE', to: 'COACH_SHARED', purpose: 'COACH_SHARING', authorized: true, consent_granted: true }).code, 'REDACTION_FAILED');
  assert.equal(validateCoachConnectPrivacyTransition({ from: 'LEARNING_CANDIDATE', to: 'LEARNING_INELIGIBLE', authorized: true }).allowed, true);
});

test('response shaping uses an allowlist and strips private or unknown fields', () => {
  const shaped = shapePrivacyResponse('entitlement', {
    access_type: 'more_monthly_intelligence',
    status: 'active',
    source: 'temporary_internal_subscription_entitlement',
    temporary: true,
    expires_at: '2026-07-24T00:15:00.000Z',
    billing_evidence: false,
    stripe_subscription_created: false,
    admin_authority: false,
    coach_authority: false,
    operator_authority: false,
    canonical_mutation_authority: false,
    raw_token: 'must-not-leak',
    internal_scope_hash: 'internal-only',
  });
  assert.equal(shaped.ok, true);
  assert.equal('raw_token' in shaped.value, false);
  assert.equal('internal_scope_hash' in shaped.value, false);
  assert.deepEqual(shaped.redaction_trace.removed_fields, ['internal_scope_hash', 'raw_token']);
});

test('nested forbidden response material is detected', () => {
  const result = verifyPrivacySafeValue({ allowed: true, nested: [{ raw_transcript: 'private words' }] });
  assert.equal(result.safe, false);
  assert.match(result.forbidden_path, /raw_transcript/);
});

test('secure redaction handles nested errors circular values and canary secrets', () => {
  const canary = ['canary', 'private', 'value'].join('-');
  const circular = { message: `failed ${canary}`, nested: { authorization: `Bearer ${canary}` }, error: new Error(`cause ${canary}`) };
  circular.self = circular;
  const safe = redactSecurityValue(circular, { sensitive_values: [canary] });
  const serialized = JSON.stringify(safe);
  assert.doesNotMatch(serialized, new RegExp(canary));
  assert.doesNotMatch(serialized, /Bearer/);
  assert.match(serialized, /\[CIRCULAR\]/);
  const audit = createSecurityAuditEvent({ event_type: 'AUTHORIZATION_DENIED', decision: 'DENIED', failure_code: 'AUTHORIZATION_DENIED', occurred_at: '2026-07-24T00:00:00.000Z', correlation_id: 'privacy_test', details: circular, sensitive_values: [canary] });
  assert.equal(audit.ok, true);
  assert.equal(audit.event.privacy_class, 'RESTRICTED_SENSITIVE');
  assert.doesNotMatch(JSON.stringify(audit), new RegExp(canary));
});
