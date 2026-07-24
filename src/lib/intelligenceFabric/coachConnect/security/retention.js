import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import { exactSecurityScope } from './contracts.js';

const DAY = 86_400_000;

export const COACH_CONNECT_RETENTION_POLICY = deepFreeze({
  policy_version: 'coach-connect-retention-proposal-v1',
  status: 'PROPOSED_NOT_AUTHORIZED',
  destructive_execution_authorized: false,
  records: {
    unlock_attempt: { default_days: 1, minimum_days: 0.05, maximum_days: 30 },
    capability_metadata: { default_days: 1, minimum_days: 0.05, maximum_days: 30 },
    auth_session_metadata: { default_days: 30, minimum_days: 1, maximum_days: 180 },
    relationship_entitlement_snapshot: { default_days: 90, minimum_days: 30, maximum_days: 730 },
    live_session_event: { default_days: 90, minimum_days: 30, maximum_days: 365 },
    raw_transcript_reference: { default_days: 7, minimum_days: 0, maximum_days: 30 },
    unreviewed_artifact: { default_days: 14, minimum_days: 0, maximum_days: 30 },
    reviewed_structured_intelligence: { default_days: 365, minimum_days: 90, maximum_days: 730 },
    private_coach_artifact: { default_days: 90, minimum_days: 0, maximum_days: 365 },
    proposal_confirmation_promotion: { default_days: 730, minimum_days: 90, maximum_days: 2555 },
    projection_cache: { default_days: 1, minimum_days: 0, maximum_days: 7 },
    security_audit_event: { default_days: 365, minimum_days: 90, maximum_days: 730 },
    deletion_tombstone: { default_days: 2555, minimum_days: 365, maximum_days: 2555 },
    test_proof_artifact: { default_days: 30, minimum_days: 1, maximum_days: 90 },
  },
});

export const LOCAL_JSONL_DELETION_CAPABILITY = deepFreeze({
  physical_deletion_supported: false,
  logical_tombstone_supported: true,
  deletion_epoch_supported: true,
  claim: 'LOGICAL_DENIAL_ONLY',
  unresolved_architecture_conflict: 'LOCAL_JSONL_PHYSICAL_DELETION',
});

export function createRetentionPlan({
  record_type,
  scope,
  reference_time,
  evaluated_at,
  policy = COACH_CONNECT_RETENTION_POLICY,
  legal_hold = false,
}) {
  const rule = policy.records?.[record_type];
  const reference = Date.parse(reference_time);
  const evaluated = Date.parse(evaluated_at);
  if (!rule || !exactSecurityScope(scope) || !Number.isFinite(reference) || !Number.isFinite(evaluated)) return deepFreeze({ ok: false, code: 'DELETION_REQUIRED' });
  const due = reference + rule.default_days * DAY;
  const body = {
    record_type,
    scope_hash: hashCanonicalJson(scope),
    reference_time: new Date(reference).toISOString(),
    evaluated_at: new Date(evaluated).toISOString(),
    due_at: new Date(due).toISOString(),
    status: legal_hold ? 'BLOCKED_BY_LEGAL_HOLD' : evaluated >= due ? 'DUE' : 'NOT_DUE',
    policy_status: policy.status,
    destructive_execution_authorized: policy.destructive_execution_authorized === true,
    logical_deletion_only: true,
    physical_deletion_supported: false,
    limitations: ['RETENTION_POLICY_AUTHORITY', 'LOCAL_JSONL_PHYSICAL_DELETION'],
  };
  return deepFreeze({ ok: true, plan: { ...body, plan_id: `retention_${hashCanonicalJson(body).slice(0, 32)}` } });
}

export function evaluateRecordDeletionEpoch({ store, scope, record_epoch = 0 }) {
  if (!exactSecurityScope(scope) || !Number.isInteger(record_epoch) || record_epoch < 0) return deepFreeze({ allowed: false, code: 'DELETION_REQUIRED' });
  const current = store.getDeletionEpoch(hashCanonicalJson(scope));
  if (!current.ok) return deepFreeze({ allowed: false, code: 'DELETION_REQUIRED' });
  return deepFreeze(record_epoch < current.epoch
    ? { allowed: false, code: 'DELETION_REQUIRED', current_epoch: current.epoch }
    : { allowed: true, code: null, current_epoch: current.epoch });
}

export async function executeSyntheticLogicalDeletion({
  store,
  scope,
  reason_code,
  actor,
  now = new Date().toISOString(),
  flags,
  backing_delete = null,
  expected_epoch = null,
}) {
  if (!flags?.retention_policy_approved
    || !flags?.deletion_execution_enabled
    || flags?.synthetic_only !== true
    || flags?.production_traffic_enabled === true
    || flags?.emergency_disabled === true) {
    return deepFreeze({ ok: false, code: 'DELETION_REQUIRED', physical_deletion: false });
  }
  if (!exactSecurityScope(scope) || !actor?.actor_id || !reason_code) return deepFreeze({ ok: false, code: 'DELETION_REQUIRED', physical_deletion: false });
  const scope_hash = hashCanonicalJson(scope);
  const current = store.getDeletionEpoch(scope_hash);
  if (!current.ok || (expected_epoch != null && expected_epoch !== current.epoch)) return deepFreeze({ ok: false, code: 'REQUEST_REPLAY_DETECTED', physical_deletion: false });
  const record = {
    scope_hash,
    epoch: current.epoch + 1,
    reason_code,
    advanced_at: now,
    policy_version: 'coach-connect-retention-proposal-v1',
    actor_ref: hashCanonicalJson({ domain: 'deletion_actor', value: actor.actor_id }),
  };
  const advanced = store.advanceDeletionEpoch(record);
  if (!advanced.ok) return deepFreeze({ ok: false, code: advanced.code || 'DELETION_FAILED', physical_deletion: false });
  let backing = { ok: false, code: 'TRANSCRIPT_BACKING_STORE_UNRESOLVED' };
  if (typeof backing_delete === 'function') {
    try { backing = await backing_delete({ scope_hash, deletion_epoch: record.epoch }); } catch { backing = { ok: false, code: 'BACKING_DELETE_FAILED' }; }
  }
  return deepFreeze({
    ok: backing.ok === true,
    code: backing.ok === true ? null : 'DELETION_FAILED',
    logical_denial_proven: true,
    physical_deletion: false,
    local_jsonl_physical_deletion: false,
    backing_content_deletion: backing.ok === true,
    deletion_epoch: record.epoch,
    tombstone: record,
    limitations: [
      'LOCAL_JSONL_PHYSICAL_DELETION',
      ...(backing.ok === true ? [] : ['TRANSCRIPT_BACKING_STORE']),
    ],
  });
}
