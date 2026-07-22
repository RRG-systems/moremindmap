import test from 'node:test'; import assert from 'node:assert/strict';
import { MISSION_001_EXAMPLES, SYNTHETIC_IDS, SYNTHETIC_NOW } from '../src/lib/intelligenceFabric/index.js';
import { GOVERNED_SYNTHESIS_ROUTES, routeSynthesis } from '../src/lib/intelligenceFabric/runtime/governedSynthesis.js';

const candidate = (patch = {}) => ({ candidate_id: 'candidate_synthetic_evidence', position_id: 'position_synthetic_evidence',
  tenant_id: SYNTHETIC_IDS.tenant, authority_type: 'USER_EVIDENCE', privacy_classification: 'TENANT_PRIVATE',
  provenance_valid: true, applicable: true, asserted_value: 12, source_ids: ['evidence_synthetic_001'], ...patch });
const request = (patch = {}) => ({ request_id: 'request_synthetic_001', claim_type: 'MEASUREMENT', tenant_id: SYNTHETIC_IDS.tenant,
  purpose: 'business_assessment', scope: 'assessment', as_of_at: SYNTHETIC_NOW, candidates: [candidate()], ...patch });

test('claim routes are explicit and current evidence dominates measurements', () => {
  assert.ok(GOVERNED_SYNTHESIS_ROUTES.MEASUREMENT.includes('USER_EVIDENCE'));
  const result = routeSynthesis(request()); assert.equal(result.decision, 'ALLOW');
  assert.equal(result.bundle.dominant_authority, 'USER_EVIDENCE'); assert.equal(result.receipt.no_fixed_weights, true);
});

test('ineligible authority is excluded with machine reason', () => {
  const result = routeSynthesis(request({ candidates: [candidate({ authority_type: 'USER_DIRECTION' })] }));
  assert.equal(result.decision, 'DENY'); assert.equal(result.receipt.excluded[0].reason, 'AUTHORITY_INELIGIBLE');
});

test('cross-tenant candidate fails before inclusion and receipt does not expose candidate ID', () => {
  const result = routeSynthesis(request({ candidates: [candidate({ tenant_id: 'tenant_synthetic_other' })] }));
  assert.equal(result.decision, 'DENY'); assert.deepEqual(result.receipt.included_ids, []);
  assert.equal(JSON.stringify(result.receipt.excluded).includes('candidate_synthetic_evidence'), false);
});

test('private coach content requires consent and relationship and cannot route universal', () => {
  const coach = candidate({ candidate_id: 'candidate_synthetic_coach', position_id: 'position_synthetic_coach', authority_type: 'PRIVATE_HUMAN_JUDGMENT', privacy_classification: 'COACH_SESSION_PRIVATE',
    consent_record: MISSION_001_EXAMPLES.consent_activation, relationship_authorized: true });
  const privateResult = routeSynthesis(request({ claim_type: 'BEHAVIORAL_INTERPRETATION', candidates: [coach] }));
  assert.equal(privateResult.decision, 'ALLOW');
  assert.equal(routeSynthesis(request({ claim_type: 'BEHAVIORAL_INTERPRETATION', candidates: [{ ...coach, relationship_authorized: false }] })).decision, 'DENY');
  assert.equal(routeSynthesis(request({ claim_type: 'BEHAVIORAL_INTERPRETATION', candidates: [coach], universal_use: true })).decision, 'DENY');
});

test('wrong-purpose and revoked consent fail independently of relationship', () => {
  const coach = candidate({ authority_type: 'PRIVATE_HUMAN_JUDGMENT', privacy_classification: 'COACH_SESSION_PRIVATE', relationship_authorized: true,
    consent_record: MISSION_001_EXAMPLES.consent_activation });
  assert.equal(routeSynthesis(request({ claim_type: 'HUMAN_RECOMMENDATION', purpose: 'marketing', candidates: [coach] })).receipt.excluded[0].reason, 'CONSENT_PURPOSE_MISMATCH');
  assert.equal(routeSynthesis(request({ claim_type: 'HUMAN_RECOMMENDATION', candidates: [{ ...coach, consent_record: MISSION_001_EXAMPLES.consent_revocation }] })).receipt.excluded[0].reason, 'CONSENT_INACTIVE');
});

test('material disagreement preserves positions and requires human review', () => {
  const result = routeSynthesis(request({ candidates: [candidate(), candidate({ candidate_id: 'candidate_synthetic_counter', position_id: 'position_synthetic_counter', asserted_value: 8 })] }));
  assert.equal(result.decision, 'ALLOW_WITH_REVIEW'); assert.equal(result.bundle.positions.length, 2);
  assert.equal(result.bundle.conflict.status, 'OPEN'); assert.ok(result.receipt.review_codes.includes('HIGH_IMPACT_CONFLICT'));
});

test('future and unknown claim types are denied in this campaign', () => {
  assert.equal(routeSynthesis(request({ claim_type: 'FUTURE_HYPOTHESIS' })).receipt.reason_codes[0], 'CLAIM_OUT_OF_SCOPE');
  assert.equal(routeSynthesis(request({ claim_type: 'SYNTHETIC_UNKNOWN' })).decision, 'DENY');
});

test('causal and promotion routes always require review', () => {
  const outcome = candidate({ authority_type: 'INTERVENTION_OUTCOME' });
  assert.equal(routeSynthesis(request({ claim_type: 'OUTCOME_ATTRIBUTION', candidates: [outcome] })).decision, 'ALLOW_WITH_REVIEW');
  const governance = candidate({ authority_type: 'GOVERNANCE_CONFLICT' });
  assert.equal(routeSynthesis(request({ claim_type: 'REUSABLE_LEARNING', candidates: [governance] })).decision, 'ALLOW_WITH_REVIEW');
});
