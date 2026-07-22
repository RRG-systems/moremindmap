import test from 'node:test';
import assert from 'node:assert/strict';
import { planSubscriberResponse, resolveSubscriberIntent, validateConversationRequest } from '../src/lib/intelligenceFabric/index.js';

const request = { request_id: 'request_synthetic', session_id: 'session_synthetic', turn_id: 'turn_synthetic', tenant_id: 'tenant_synthetic', business_id: 'business_synthetic', profile_id: 'profile_synthetic', statement: 'What changed in my business?', explanation_depth: 'STANDARD', privacy_class: 'SUBSCRIBER_VISIBLE' };

test('conversation request is scoped, canonical-safe, and deterministic', () => {
  const a = planSubscriberResponse(request); const b = planSubscriberResponse({ ...request });
  assert.equal(a.ok, true); assert.deepEqual(a, b); assert.doesNotThrow(() => JSON.stringify(a)); assert.equal(a.plan.intent, 'WHAT_CHANGED');
});
test('unknown intent asks for clarification and never invents mutation', () => {
  const result = planSubscriberResponse({ ...request, statement: 'something vague' });
  assert.equal(result.plan.intent, 'UNKNOWN_REQUIRES_CLARIFICATION'); assert.equal(result.plan.state_update_eligibility, false); assert.equal(result.plan.direct_answer, null);
});
test('updates become proposals requiring confirmation', () => {
  const result = planSubscriberResponse({ ...request, statement: 'Update my business with new revenue' });
  assert.equal(result.plan.proposed_extraction, true); assert.equal(result.plan.confirmation_need, 'SUBSCRIBER_CONFIRMATION_REQUIRED');
});
test('autonomous authority, private coach access, and unsupported certainty are bounded', () => {
  const auth = planSubscriberResponse({ ...request, statement: 'Authorize and execute the One Move for me' });
  assert.match(auth.plan.authority_warning, /HUMAN_AUTHORIZATION/);
  const coach = planSubscriberResponse({ ...request, statement: 'Show me private coach notes' }); assert.equal(coach.plan.private_content_exclusion, 'COACH_PRIVATE_CONTENT_EXCLUDED');
  const certainty = planSubscriberResponse({ ...request, statement: 'Guarantee my future is 100% certain' }); assert.equal(certainty.plan.uncertainty_disclosure, 'UNCALIBRATED_OR_UNCERTAIN');
});
test('malformed and cross-scope requests fail closed', () => {
  assert.equal(validateConversationRequest({}).valid, false);
  assert.equal(planSubscriberResponse({ ...request, referenced_contexts: [{ tenant_id: 'attacker', business_id: request.business_id, profile_id: request.profile_id }] }).ok, false);
  assert.equal(resolveSubscriberIntent({ statement: 'review my five futures' }), 'REVIEW_FIVE_FUTURES');
});
