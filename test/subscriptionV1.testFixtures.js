import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import {
  createAuthorityReference,
  createBusinessMembership,
  createCanonicalCustomerSubject,
  createEvidenceReference,
  createPersonalRslEvent,
} from '../src/lib/subscriptionV1/index.js';

export const TEST_TIME = '2026-08-18T20:00:00.000Z';

export const testScope = (overrides = {}) => ({
  subject_id: 'subject_test_alpha',
  membership_id: 'membership_test_alpha',
  tenant_id: 'tenant_test',
  profile_id: 'MM-TEST-PROFILE-ALPHA',
  business_id: 'business_test_alpha',
  ...overrides,
});

export const testAuthority = (id = 'test_authority') => createAuthorityReference({ authority_id: id, authority_version: '1.0.0' });

export function testSubject(overrides = {}) {
  return createCanonicalCustomerSubject({
    subject_id: overrides.subject_id || 'subject_test_alpha',
    issuer: overrides.issuer || 'https://identity.example.test',
    provider_subject: overrides.provider_subject || 'provider-subject-alpha',
    created_at: TEST_TIME,
    ...overrides,
  });
}

export function testMembership(overrides = {}) {
  const scope = testScope(overrides);
  return createBusinessMembership({
    ...scope,
    role: overrides.role || 'OWNER',
    status: overrides.status || 'ACTIVE',
    created_at: TEST_TIME,
  });
}

export function testStripeEvents(scope = testScope(), overrides = {}) {
  const binding = {
    subject_id: scope.subject_id,
    membership_id: scope.membership_id,
    scope,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    membership_verified: true,
  };
  return [{
    event_id: 'evt_subscription_active_alpha',
    event_type: 'customer.subscription.updated',
    created_at: TEST_TIME,
    signature_verified: true,
    membership_binding: binding,
    customer_id: 'cus_test_alpha',
    subscription_id: 'sub_test_alpha',
    status: 'active',
    cancel_at_period_end: false,
    current_period_start: '2026-08-01T00:00:00.000Z',
    current_period_end: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }];
}

const artifactHash = (type, version = '1.0.0') => hashCanonicalJson({ fixture: 'subscription-v1', type, version });

function artifact(scope, artifact_type, extra = {}) {
  const version = extra.version || '1.0.0';
  return {
    artifact_id: `${artifact_type.toLowerCase()}_fixture_${version.replaceAll('.', '_')}`,
    artifact_type,
    version,
    content_hash: extra.content_hash || artifactHash(artifact_type, version),
    authority: testAuthority(`${artifact_type.toLowerCase()}_authority`),
    parent_artifact_ids: extra.parent_artifact_ids || [],
    created_at: extra.created_at || '2026-08-18T18:00:00.000Z',
    supersedes_artifact_id: extra.supersedes_artifact_id || null,
    scope: { ...scope },
    status: extra.status || 'COMPLETE',
    validation_status: extra.validation_status || 'PASS',
    compatibility_status: extra.compatibility_status || 'COMPATIBLE',
    bindings: extra.bindings || {},
    payload: extra.payload || {},
    domain_boundary: extra.domain_boundary,
  };
}

export function testArtifacts(scope = testScope()) {
  const bos = artifact(scope, 'NEW_BOS');
  const ba = artifact(scope, 'NEW_BA');
  const fusion = artifact(scope, 'BOS_BA_FUSION', { bindings: { bos_hash: bos.content_hash, ba_hash: ba.content_hash } });
  const wbm = artifact(scope, 'WHOLE_BUSINESS_MODEL_V1', {
    bindings: { ba_hash: ba.content_hash, fusion_hash: fusion.content_hash },
    domain_boundary: { business_causes: 'BUSINESS_EVIDENCE_ONLY', whole_person_role: 'EXECUTION_FEASIBILITY_ONLY' },
  });
  const futures = artifact(scope, 'FIVE_FUTURES_V2', {
    bindings: { wbm_hash: wbm.content_hash },
    payload: { trajectories: [27, 15, 20, 12, 26].map((relative_support_weight, index) => ({ role: `ROLE_${index + 1}`, relative_support_weight })) },
  });
  const move = artifact(scope, 'ONE_MOVE_V2', {
    bindings: { wbm_hash: wbm.content_hash },
    payload: { selected: true, mechanism_id: 'mechanism_fixture_alpha' },
  });
  const plan = artifact(scope, 'PLAN_135', { bindings: { wbm_hash: wbm.content_hash, one_move_hash: move.content_hash } });
  const evidence = artifact(scope, 'EVIDENCE_LEDGER', { bindings: { ba_hash: ba.content_hash, wbm_hash: wbm.content_hash } });
  return [bos, ba, fusion, wbm, futures, move, plan, evidence];
}

export function testBusinessTruth() {
  return [createEvidenceReference({
    evidence_id: 'business_evidence_alpha',
    evidence_domain: 'BUSINESS',
    content_hash: hashCanonicalJson({ fact: 'business fixture' }),
    certainty: 'KNOWN',
  })];
}

export function testWholePersonContext() {
  return [createEvidenceReference({
    evidence_id: 'whole_person_execution_alpha',
    evidence_domain: 'WHOLE_PERSON_EXECUTION',
    content_hash: hashCanonicalJson({ fact: 'execution fixture' }),
    certainty: 'INFERRED',
  })];
}

export function testRslEvent(scope = testScope(), overrides = {}) {
  return createPersonalRslEvent({
    event_id: overrides.event_id || 'rsl_event_fixture_alpha',
    scope,
    session_id: overrides.session_id || 'session_fixture_alpha',
    event_type: overrides.event_type || 'EVIDENCE_ASSERTED',
    effective_at: overrides.effective_at || '2026-08-10T00:00:00.000Z',
    recorded_at: overrides.recorded_at || '2026-08-10T00:01:00.000Z',
    source_class: overrides.source_class || 'CUSTOMER_SELF_REPORT',
    actor: overrides.actor || { actor_type: 'CUSTOMER', actor_ref: scope.subject_id },
    establishing_authority: overrides.establishing_authority || testAuthority('customer_confirmation_authority'),
    semantic_payload: overrides.semantic_payload || { lens: 'WHERE_YOU_ARE', statement: 'A governed fixture fact', privacy_classification: 'TENANT_PRIVATE' },
    evidence_refs: overrides.evidence_refs || testBusinessTruth(),
    supersedes_event_ids: overrides.supersedes_event_ids || [],
    retracts_event_ids: overrides.retracts_event_ids || [],
    confirmation_event_id: overrides.confirmation_event_id === undefined ? 'confirmation_fixture_alpha' : overrides.confirmation_event_id,
  });
}
