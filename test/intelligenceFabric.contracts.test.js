import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidProfileId as currentProfileValidator } from '../api/engine/vault/generateProfileId.js';
import {
  MISSION_001_EXAMPLES, SYNTHETIC_IDS, SYNTHETIC_NOW, syntheticEvent, syntheticProvenance,
  canonicalJson, compareIdempotentEvents, compareImmutableFields, createIntelligenceEvent,
  createPayloadHash, defaultPrivacyClassification, evaluateConsent, evaluateRelationshipAuthorization,
  hashCanonicalJson, isCompatibleProfileId, validateAnonymizedAggregate, validateCoachUserRelationship,
  validateConsentRecord, validateIdentityRef, validateIntelligenceEvent, validateKnowledgeUseReceipt,
  validateModelUseReceipt, validatePrivacyClassification, validatePrivacyTransition,
  validateProvenanceRecord, validateSubscriptionEntitlementRef, validateTenantRelationship,
} from '../src/lib/intelligenceFabric/index.js';

const validRelationship = () => ({
  relationship_id: 'rel_synthetic_001', relationship_type: 'COACH_USER',
  source_tenant_id: SYNTHETIC_IDS.tenant, target_id: SYNTHETIC_IDS.profile,
  status: 'ACTIVE', effective_at: SYNTHETIC_NOW, created_at: SYNTHETIC_NOW,
  granted_scopes: ['assessment'], revoked_scopes: [], consent_record_ids: ['consent_synthetic_active'],
  provenance: syntheticProvenance,
});

test('valid minimal and full IntelligenceEvent objects are immutable', () => {
  const minimal = createIntelligenceEvent(syntheticEvent());
  assert.equal(minimal.validation.valid, true);
  assert.equal(Object.isFrozen(minimal.event), true);
  assert.equal(validateIntelligenceEvent(syntheticEvent({ observed_at: null, expires_at: null })).valid, true);
});

test('event structural and closed-enum failures fail closed', () => {
  for (const [patch, code] of [
    [{ event_id: '' }, 'IF_REQUIRED'], [{ event_type: 'bad type' }, 'IF_INVALID_TYPE'],
    [{ authority_type: 'OPINION' }, 'IF_INVALID_ENUM'], [{ truth_class: 'FACT' }, 'IF_INVALID_ENUM'],
    [{ privacy_classification: null }, 'IF_INVALID_ENUM'], [{ consent_scope: null }, 'IF_CONSENT_REQUIRED'],
    [{ profile_id: null, business_id: null, subscription_id: null }, 'IF_INVALID_IDENTITY_SCOPE'],
    [{ occurred_at: '07/20/2026' }, 'IF_INVALID_TIMESTAMP'],
  ]) assert.ok(validateIntelligenceEvent(syntheticEvent(patch)).errors.some((e) => e.code === code));
});

test('invalid payloads fail safely without leaking raw private values', () => {
  const secret = 'never-echo-this-private-value';
  const event = syntheticEvent({ payload: { private: secret, invalid: undefined }, payload_hash: 'bad' });
  const result = validateIntelligenceEvent(event);
  assert.equal(result.valid, false);
  assert.equal(JSON.stringify(result.errors).includes(secret), false);
});

test('canonical JSON and payload hashing ignore object key ordering', () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
  assert.equal(hashCanonicalJson({ b: 2, a: 1 }), hashCanonicalJson({ a: 1, b: 2 }));
  assert.equal(createPayloadHash({ b: 2, a: 1 }), createPayloadHash({ a: 1, b: 2 }));
  assert.throws(() => canonicalJson({ invalid: undefined }), TypeError);
});

test('corrections and supersessions reference prior events', () => {
  assert.equal(validateIntelligenceEvent(MISSION_001_EXAMPLES.user_correction_event).valid, true);
  assert.equal(validateIntelligenceEvent(syntheticEvent({ correction_of_event_id: 'evt_synthetic_001' })).valid, false);
  assert.equal(validateIntelligenceEvent(syntheticEvent({ supersedes_event_id: 'evt_synthetic_001' })).valid, false);
});

test('immutable-field comparison detects mutation', () => {
  assert.deepEqual(compareImmutableFields(syntheticEvent(), syntheticEvent()).changed_fields, []);
  assert.deepEqual(compareImmutableFields(syntheticEvent(), syntheticEvent({ event_id: 'evt_changed' })).changed_fields, ['event_id']);
});

test('profile ID validation remains compatible with current MORE validator', () => {
  for (const value of [SYNTHETIC_IDS.profile, 'MM-20260115-test0001', 'Synthetic Person', 'mm-bad']) {
    assert.equal(isCompatibleProfileId(value), currentProfileValidator(value));
  }
});

test('identity types remain distinct and display names cannot become IDs', () => {
  const profile = { type: 'PROFILE', id: SYNTHETIC_IDS.profile, tenant_id: SYNTHETIC_IDS.tenant };
  assert.equal(validateIdentityRef(profile, 'PROFILE').valid, true);
  assert.equal(validateIdentityRef(profile, 'PERSON').valid, false);
  assert.equal(validateIdentityRef({ type: 'PERSON', id: 'Synthetic Person', display_name: 'Synthetic Person', tenant_id: SYNTHETIC_IDS.tenant }).valid, false);
});

test('tenant relationship validation denies implicit cross-tenant access', () => {
  assert.equal(validateCoachUserRelationship(validRelationship()).valid, true);
  assert.equal(validateTenantRelationship({ ...validRelationship(), target_tenant_id: SYNTHETIC_IDS.otherTenant }).valid, false);
  assert.equal(validateTenantRelationship({ ...validRelationship(), target_tenant_id: SYNTHETIC_IDS.otherTenant, cross_tenant_authorization: { policy_id: 'policy_synthetic' } }).valid, true);
});

test('coach relationship does not imply membership and contracts grant no authorization', () => {
  const result = validateCoachUserRelationship(validRelationship());
  assert.equal(result.normalized_value.grants_runtime_authorization, false);
  assert.equal(validateTenantRelationship({ ...validRelationship(), relationship_type: 'ORGANIZATION_MEMBERSHIP' }, 'COACH_USER').valid, false);
});

test('subscription entitlement does not imply universal access', () => {
  const result = validateSubscriptionEntitlementRef({ ...validRelationship(), relationship_type: 'SUBSCRIPTION_ENTITLEMENT', granted_scopes: ['subscription_features'] });
  assert.equal(result.valid, true);
  assert.equal(evaluateRelationshipAuthorization({ relationship: result.normalized_value, required_scope: 'universal_data', tenant_id: SYNTHETIC_IDS.tenant }).authorized, false);
});

test('consent defaults deny universal, cross-tenant, and private coach learning', () => {
  const result = validateConsentRecord(MISSION_001_EXAMPLES.consent_activation);
  assert.equal(result.valid, true);
  assert.equal(result.normalized_value.learning_eligibility, false);
  assert.equal(result.normalized_value.cross_tenant_eligibility, false);
  assert.equal(result.normalized_value.legal_retention_policy, 'NOT_CONFIGURED');
  assert.equal(result.normalized_value.grants_runtime_authorization, false);
});

test('consent gates absence, purpose, revocation, expiry, and authorization separately', () => {
  const base = { purpose: 'business_assessment', scope: 'assessment', tenant_id: SYNTHETIC_IDS.tenant, at: '2026-01-16T00:00:00.000Z' };
  assert.equal(evaluateConsent(base).reason, 'ABSENCE_IS_NOT_CONSENT');
  assert.equal(evaluateConsent({ ...base, consent: MISSION_001_EXAMPLES.consent_activation, purpose: 'marketing', relationship_authorized: true }).allowed, false);
  assert.equal(evaluateConsent({ ...base, consent: MISSION_001_EXAMPLES.consent_revocation, relationship_authorized: true }).allowed, false);
  const expired = { ...MISSION_001_EXAMPLES.consent_activation, expires_at: '2026-01-15T18:00:00.000Z' };
  assert.equal(evaluateConsent({ ...base, consent: expired, relationship_authorized: true }).allowed, false);
  assert.equal(evaluateConsent({ ...base, consent: MISSION_001_EXAMPLES.consent_activation }).reason, 'CONSENT_DOES_NOT_PROVE_AUTHORIZATION');
  assert.equal(evaluateConsent({ ...base, consent: MISSION_001_EXAMPLES.consent_activation, relationship_authorized: true }).allowed, true);
});

test('superseded consent remains explicit and cannot be treated as active', () => {
  const consent = { ...MISSION_001_EXAMPLES.consent_activation, status: 'SUPERSEDED', supersedes_consent_id: 'consent_prior' };
  assert.equal(validateConsentRecord(consent).valid, true);
  assert.equal(evaluateConsent({ consent, purpose: consent.purpose, scope: 'assessment', tenant_id: consent.tenant_id, relationship_authorized: true }).allowed, false);
});

test('privacy taxonomy rejects unknowns and silent downgrade', () => {
  assert.equal(validatePrivacyClassification('SECRETISH').valid, false);
  assert.equal(defaultPrivacyClassification({ private_coach_content: true }), 'COACH_SESSION_PRIVATE');
  assert.equal(validatePrivacyTransition('COACH_SESSION_PRIVATE', 'INTERNAL').valid, false);
  assert.equal(validatePrivacyTransition('TENANT_PRIVATE', 'RESTRICTED_FINANCIAL').valid, true);
});

test('pseudonymized is not anonymized and aggregates reject identity refs', () => {
  assert.equal(validateAnonymizedAggregate({ privacy_classification: 'ANONYMIZED_AGGREGATE', pseudonymized: true }).valid, false);
  assert.equal(validateAnonymizedAggregate({ privacy_classification: 'ANONYMIZED_AGGREGATE', profile_id: SYNTHETIC_IDS.profile }).valid, false);
  assert.equal(validateAnonymizedAggregate({ privacy_classification: 'ANONYMIZED_AGGREGATE', metric: 12 }).valid, true);
});

test('provenance validates user, coach, deterministic, and model origins', () => {
  assert.equal(validateProvenanceRecord(syntheticProvenance).valid, true);
  assert.equal(validateProvenanceRecord({ ...syntheticProvenance, source_type: 'COACH_OBSERVATION' }).valid, true);
  assert.equal(validateProvenanceRecord(MISSION_001_EXAMPLES.deterministic_rule_provenance, { deterministic: true }).valid, true);
  assert.equal(validateProvenanceRecord(MISSION_001_EXAMPLES.model_assisted_provenance, { synthetic: true }).valid, true);
  assert.equal(validateProvenanceRecord({ ...syntheticProvenance, transcript: 'private' }).valid, false);
});

test('receipts require aligned source versions and hashes and grant no authority', () => {
  const valid = validateKnowledgeUseReceipt(MISSION_001_EXAMPLES.knowledge_use_receipt);
  assert.equal(valid.valid, true);
  assert.equal(valid.normalized_value.grants_authority, false);
  assert.equal(valid.normalized_value.records_approval, false);
  assert.equal(validateKnowledgeUseReceipt({ ...MISSION_001_EXAMPLES.knowledge_use_receipt, source_versions: [] }).valid, false);
});

test('model receipt supports deterministic NO_MODEL_USED and rejects raw content', () => {
  assert.equal(validateModelUseReceipt(MISSION_001_EXAMPLES.no_model_used_receipt).valid, true);
  assert.equal(validateModelUseReceipt({ ...MISSION_001_EXAMPLES.no_model_used_receipt, transcript: 'private' }).valid, false);
});

test('idempotency distinguishes duplicate-safe, conflict, and distinct', () => {
  const base = syntheticEvent();
  assert.equal(compareIdempotentEvents(base, { ...base, event_id: 'evt_synthetic_retry' }).status, 'DUPLICATE_SAFE');
  assert.equal(compareIdempotentEvents(base, syntheticEvent({ payload: { changed: true }, payload_hash: createPayloadHash({ changed: true }) })).status, 'DUPLICATE_CONFLICT');
  assert.equal(compareIdempotentEvents(base, syntheticEvent({ idempotency_key: 'idem_other' })).status, 'DISTINCT');
});

test('late-arriving and future evidence remain valid and distinguishable', () => {
  const late = validateIntelligenceEvent(MISSION_001_EXAMPLES.late_arriving_evidence, { now: '2026-02-01T00:00:00.000Z' });
  assert.equal(late.valid, true);
  assert.ok(late.warnings.some((w) => w.code === 'IF_LATE_ARRIVAL'));
  const future = validateIntelligenceEvent(syntheticEvent({ occurred_at: '2027-01-01T00:00:00.000Z' }), { now: SYNTHETIC_NOW });
  assert.equal(future.valid, true);
  assert.ok(future.warnings.some((w) => w.code === 'IF_FUTURE_EVENT'));
});

test('authority/truth conflicts are explicit', () => {
  assert.equal(validateIntelligenceEvent(syntheticEvent({ truth_class: 'OBSERVED_TRUTH' })).valid, false);
  assert.equal(validateIntelligenceEvent(MISSION_001_EXAMPLES.weekly_kpi_evidence_event).valid, true);
  assert.equal(validateIntelligenceEvent(MISSION_001_EXAMPLES.coach_recommendation_event).valid, true);
});
