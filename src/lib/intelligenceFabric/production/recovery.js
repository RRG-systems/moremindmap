import { hashCanonicalJson } from '../hashing.js'; import { deepFreeze } from '../validation.js';

export async function appendThenProject({ adapter, append_request, projection, recovery_driver, as_of_at }) {
  const append = await adapter.append(append_request); if (!append.ok) return deepFreeze({ ok: false, phase: 'APPEND', append });
  if (append.status === 'IDEMPOTENT_REPLAY') return deepFreeze({ ok: true, status: 'IDEMPOTENT_REPLAY', append, projection: null });
  try { const value = await projection(); return deepFreeze({ ok: true, status: 'APPENDED_AND_PROJECTED', append, projection: value }); }
  catch { const record = { recovery_id: `recovery_${hashCanonicalJson({ event_id: append.event_id, as_of_at }).slice(0, 20)}`, event_id: append.event_id,
    status: 'PROJECTION_RETRY_REQUIRED', reason_code: 'PROJECTION_FAILURE', attempt: 0, created_at: as_of_at }; recovery_driver?.recordRecovery(record);
    return deepFreeze({ ok: true, status: 'APPENDED_PROJECTION_PENDING', append, recovery: record }); }
}

export async function retryProjection({ recovery_record, projection, recovery_driver, as_of_at }) {
  try { const value = await projection(); const audit = { ...recovery_record, status: 'RECOVERED', attempt: recovery_record.attempt + 1, recovered_at: as_of_at, output_hash: hashCanonicalJson(value) }; recovery_driver?.recordRecovery(audit); return deepFreeze({ ok: true, status: 'RECOVERED', value, audit }); }
  catch { const audit = { ...recovery_record, status: 'RETRY_FAILED', attempt: recovery_record.attempt + 1, attempted_at: as_of_at }; recovery_driver?.recordRecovery(audit); return deepFreeze({ ok: false, status: 'RETRY_FAILED', audit }); }
}

export function validateCheckpointWatermark({ checkpoint, records }) {
  const prefix = records.filter((record) => record.recorded_sequence <= checkpoint.recorded_sequence);
  if (prefix.some((record) => record.effective_at < checkpoint.minimum_effective_at && record.recorded_sequence > checkpoint.source_sequence_floor)) return deepFreeze({ valid: false, code: 'LATE_EFFECTIVE_EVENT_REBUILD_REQUIRED' });
  return deepFreeze({ valid: true });
}
