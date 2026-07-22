import { createPayloadHash } from './hashing.js';

export const SYNTHETIC_NOW = '2026-01-15T12:00:00.000Z';
export const SYNTHETIC_IDS = Object.freeze({
  tenant: 'tenant_synthetic_alpha', otherTenant: 'tenant_synthetic_beta',
  profile: 'mm-20260115-test0001', business: 'business_synthetic_001',
  coach: 'coach_synthetic_001', subscription: 'subscription_synthetic_001',
});

export const syntheticProvenance = Object.freeze({
  source_id: 'source_synthetic_001', source_type: 'USER_ENTRY', source_version: '1.0.0',
  source_location: 'synthetic://mission-001/example', source_hash: 'sha256:synthetic-source-hash',
  source_actor: { type: 'ACTOR', id: 'actor_synthetic_user', tenant_id: SYNTHETIC_IDS.tenant },
  source_system: { id: 'system_more_example', version: '1.0.0' }, captured_at: SYNTHETIC_NOW,
  parent_source_ids: [], confidence: 1, notes: 'Synthetic Mission 001 fixture.',
});

export function syntheticEvent(overrides = {}) {
  const payload = overrides.payload ?? { goal: 'Synthetic goal' };
  const payloadHash = Object.prototype.hasOwnProperty.call(overrides, 'payload_hash')
    ? overrides.payload_hash
    : createPayloadHash(payload);
  return {
    event_id: 'evt_synthetic_001', event_type: 'USER_GOAL_RECORDED', schema_version: '1.0.0',
    profile_id: SYNTHETIC_IDS.profile, business_id: SYNTHETIC_IDS.business,
    organization_id: null, subscription_id: SYNTHETIC_IDS.subscription, tenant_id: SYNTHETIC_IDS.tenant,
    authority_type: 'USER_DIRECTION', truth_class: 'PERSONAL_TRUTH',
    source_actor: { type: 'ACTOR', id: 'actor_synthetic_user' }, source_artifact: { id: 'artifact_synthetic_001', version: '1.0.0' },
    source_system: { id: 'system_more_example', version: '1.0.0' }, occurred_at: SYNTHETIC_NOW,
    observed_at: SYNTHETIC_NOW, recorded_at: SYNTHETIC_NOW, effective_at: SYNTHETIC_NOW, expires_at: null,
    payload, payload_hash: payloadHash, idempotency_key: 'idem_synthetic_001', confidence: 1,
    privacy_classification: 'USER_PRIVATE', consent_scope: [], supersedes_event_id: null,
    correction_of_event_id: null, causation_event_id: null, correlation_id: 'corr_synthetic_001',
    provenance: syntheticProvenance, created_by: { type: 'ACTOR', id: 'actor_synthetic_user' }, ...overrides,
  };
}

export const MISSION_001_EXAMPLES = Object.freeze({
  user_goal_event: syntheticEvent(),
  weekly_kpi_evidence_event: syntheticEvent({ event_id: 'evt_synthetic_kpi', event_type: 'KPI_EVIDENCE_RECORDED', authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', payload: { week: '2026-W02', conversations: 12 }, idempotency_key: 'idem_synthetic_kpi', privacy_classification: 'RESTRICTED_FINANCIAL', payload_hash: createPayloadHash({ week: '2026-W02', conversations: 12 }) }),
  user_correction_event: syntheticEvent({ event_id: 'evt_synthetic_correction', event_type: 'EVIDENCE_CORRECTED', authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', correction_of_event_id: 'evt_synthetic_kpi', payload: { conversations: 13 }, payload_hash: createPayloadHash({ conversations: 13 }), idempotency_key: 'idem_synthetic_correction' }),
  coach_observation_event: syntheticEvent({ event_id: 'evt_synthetic_coach_observation', event_type: 'COACH_OBSERVATION_RECORDED', authority_type: 'PRIVATE_HUMAN_JUDGMENT', truth_class: 'PERSONAL_TRUTH', privacy_classification: 'COACH_SESSION_PRIVATE', payload: { observation_code: 'FOLLOW_UP_PATTERN' }, payload_hash: createPayloadHash({ observation_code: 'FOLLOW_UP_PATTERN' }), idempotency_key: 'idem_synthetic_coach_observation' }),
  coach_recommendation_event: syntheticEvent({ event_id: 'evt_synthetic_coach_recommendation', event_type: 'COACH_RECOMMENDATION_RECORDED', authority_type: 'PRIVATE_HUMAN_JUDGMENT', truth_class: 'INTERVENTION_TRUTH', privacy_classification: 'COACH_SESSION_PRIVATE', payload: { recommendation_code: 'WEEKLY_REVIEW' }, payload_hash: createPayloadHash({ recommendation_code: 'WEEKLY_REVIEW' }), idempotency_key: 'idem_synthetic_coach_recommendation' }),
  consent_activation: { consent_id: 'consent_synthetic_active', subject_ref: { type: 'PROFILE', id: SYNTHETIC_IDS.profile, tenant_id: SYNTHETIC_IDS.tenant }, tenant_id: SYNTHETIC_IDS.tenant, consent_type: 'EVIDENCE_USE', status: 'ACTIVE', scope: ['assessment'], purpose: 'business_assessment', data_categories: ['KPI'], authorized_parties: ['system_more_example'], effective_at: SYNTHETIC_NOW, created_at: SYNTHETIC_NOW, source_artifact: { id: 'artifact_consent', version: '1.0.0' }, policy_version: 'NOT_CONFIGURED', provenance: syntheticProvenance },
  consent_revocation: { consent_id: 'consent_synthetic_revoked', subject_ref: { type: 'PROFILE', id: SYNTHETIC_IDS.profile, tenant_id: SYNTHETIC_IDS.tenant }, tenant_id: SYNTHETIC_IDS.tenant, consent_type: 'EVIDENCE_USE', status: 'REVOKED', scope: ['assessment'], purpose: 'business_assessment', data_categories: ['KPI'], authorized_parties: [], effective_at: SYNTHETIC_NOW, revoked_at: '2026-01-16T12:00:00.000Z', created_at: SYNTHETIC_NOW, supersedes_consent_id: 'consent_synthetic_active', source_artifact: { id: 'artifact_consent', version: '1.0.0' }, policy_version: 'NOT_CONFIGURED', provenance: syntheticProvenance },
  private_coach_session_event: syntheticEvent({ event_id: 'evt_synthetic_private_session', event_type: 'COACH_SESSION_NOTE_RECORDED', authority_type: 'PRIVATE_HUMAN_JUDGMENT', privacy_classification: 'COACH_SESSION_PRIVATE', payload: { note_code: 'PRIVATE_NOTE_PRESENT' }, payload_hash: createPayloadHash({ note_code: 'PRIVATE_NOTE_PRESENT' }), idempotency_key: 'idem_synthetic_private_session' }),
  deterministic_rule_provenance: { ...syntheticProvenance, transformation_type: 'DETERMINISTIC_RULE', transformer_version: 'rule-v1', transformed_at: SYNTHETIC_NOW },
  model_assisted_provenance: { ...syntheticProvenance, source_type: 'MODEL_DERIVATION', model_receipt_id: 'receipt_synthetic_model', prompt_receipt_id: 'receipt_synthetic_prompt' },
  knowledge_use_receipt: { receipt_id: 'receipt_synthetic_knowledge', receipt_type: 'KNOWLEDGE_USE', consumer_operation: 'synthetic_assessment', consumer_version: '1.0.0', used_at: SYNTHETIC_NOW, source_ids: ['claim_synthetic_001'], source_versions: ['1.0.0'], source_hashes: ['sha256:synthetic'], authority_type: 'DOMAIN_KNOWLEDGE', truth_class: 'DOMAIN_TRUTH', tenant_id: SYNTHETIC_IDS.tenant, privacy_classification: 'TENANT_PRIVATE', consent_record_ids: [], provenance: syntheticProvenance },
  no_model_used_receipt: { receipt_id: 'receipt_synthetic_no_model', receipt_type: 'MODEL_USE', consumer_operation: 'deterministic_rule', consumer_version: '1.0.0', used_at: SYNTHETIC_NOW, source_ids: ['source_synthetic_001'], source_versions: ['1.0.0'], source_hashes: ['sha256:synthetic'], model_name: 'NO_MODEL_USED', model_version: 'NO_MODEL_USED', tenant_id: SYNTHETIC_IDS.tenant, privacy_classification: 'TENANT_PRIVATE', provenance: syntheticProvenance },
  cross_tenant_rejection: { source_tenant_id: SYNTHETIC_IDS.tenant, target_tenant_id: SYNTHETIC_IDS.otherTenant, expected: 'CROSS_TENANT_DENIED' },
  late_arriving_evidence: syntheticEvent({ event_id: 'evt_synthetic_late', event_type: 'KPI_EVIDENCE_RECORDED', authority_type: 'USER_EVIDENCE', truth_class: 'OBSERVED_TRUTH', occurred_at: '2026-01-01T12:00:00.000Z', idempotency_key: 'idem_synthetic_late' }),
  duplicate_idempotency_conflict: { idempotency_key: 'idem_synthetic_001', expected: 'DUPLICATE_CONFLICT' },
  privacy_downgrade_rejection: { from: 'COACH_SESSION_PRIVATE', to: 'INTERNAL', expected: 'IF_PRIVACY_DOWNGRADE' },
});
