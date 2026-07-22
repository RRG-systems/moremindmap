import { deepFreeze } from '../../validation.js';
import { liveSessionSemanticHash, validateProjectionRefresh } from './contracts.js';

const safe = (value) => JSON.parse(JSON.stringify(value, (key, item) => /raw|transcript|provider_payload|secret|token|private_note/i.test(key) ? undefined : item));

export function refreshLiveSessionProjections({ subscriber_scope, business_engine, previous_version, reason_for_change, evidence_sources, fail_target = null, now }) {
  if (!business_engine?.business_engine_id || !Number.isInteger(business_engine.version)) return deepFreeze({ ok: false, code: 'BUSINESS_ENGINE_REQUIRED' });
  const refresh = { projection_id: `refresh_${liveSessionSemanticHash({ id: business_engine.business_engine_id, version: business_engine.version }).slice(0, 24)}`, business_engine_id: business_engine.business_engine_id, previous_version, new_version: business_engine.version, changed_sections: ['confidence_reality', 'five_futures_evaluation', 'one_move_evaluation'], reason_for_change, evidence_sources, refreshed_at: now, refresh_status: fail_target ? 'FAILED' : 'COMPLETED', subscriber_scope, privacy_class: 'BUSINESS_ENGINE_ELIGIBLE', schema_version: '1.0.0', policy_version: business_engine.policy_version || 'policy_live_v1' };
  const validation = validateProjectionRefresh(refresh); if (!validation.valid) return deepFreeze({ ok: false, code: 'INVALID_PROJECTION_REFRESH', errors: validation.errors });
  if (fail_target) return deepFreeze({ ok: false, code: 'PROJECTION_REFRESH_FAILED', failed_target: fail_target, refresh, exposed_version: previous_version });
  const shared = { source: 'AUTHORITATIVE_BUSINESS_ENGINE', business_engine_id: business_engine.business_engine_id, business_engine_version: business_engine.version, refreshed_at: now, canonical_write_capability: false };
  return deepFreeze({ ok: true, refresh, subscriber_projection: safe({ ...shared, confidence_reality: business_engine.confidence_reality, five_futures: business_engine.five_futures, one_move: business_engine.one_move }), coach_projection: safe({ ...shared, confidence_reality: business_engine.confidence_reality, five_futures: business_engine.five_futures, one_move: business_engine.one_move }) });
}
