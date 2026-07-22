import { buildDurableObject } from '../durableCore.js';
import { OBJECT_AUTHORITY, OBJECT_TRUTH_CLASS } from '../durableCoreConstants.js';
import { hashCanonicalJson } from '../hashing.js';
import { deepFreeze } from '../validation.js';
import { defineProjection, replayProjection } from './replay.js';
import { routeSynthesis } from './governedSynthesis.js';
import { runRealityEngine } from './realityEngine.js';
import { rankEvidenceGaps, updateBeliefState } from './beliefUpdater.js';

export const EVIDENCE_LEDGER_PROJECTION = defineProjection({
  projection_id: 'user-evidence-ledger', projection_version: '1.0.0', initial_state: { entries: [] },
  apply: (state, event) => {
    if (!['KPI_EVIDENCE_RECORDED', 'EVIDENCE_CORRECTED'].includes(event.event_type)) return state;
    const entry = { evidence_id: `evidence_${event.event_id}`, evidence_type: 'KPI', metric_id: event.payload.metric_id,
      value: event.payload.value, unit: event.payload.unit, period: event.payload.period || null,
      source_event_id: event.event_id, verification_method: event.payload.verification_method || 'USER_ENTERED',
      verification_state: event.payload.verification_state || 'USER_ATTESTED', confidence: event.confidence ?? .5,
      occurred_at: event.occurred_at, observed_at: event.observed_at, recorded_at: event.recorded_at,
      correction_of_evidence_id: event.correction_of_event_id ? `evidence_${event.correction_of_event_id}` : null,
      supersedes_evidence_id: event.supersedes_event_id ? `evidence_${event.supersedes_event_id}` : null,
      privacy_classification: event.privacy_classification, provenance: event.provenance };
    return { entries: [...state.entries, entry] };
  },
});

function evidenceLedger(input, replay) {
  const at = input.as_of_at, id = `ledger_runtime_${hashCanonicalJson({ tenant: input.tenant_id, business: input.business_id }).slice(0, 16)}`;
  const raw = { object_type: 'UserEvidenceLedger', contract_version: '1.0.0', schema_version: '1.0.0', object_id: id, ledger_id: id,
    tenant_id: input.tenant_id, profile_id: input.profile_id, business_id: input.business_id, organization_id: input.organization_id ?? null,
    subscription_id: input.subscription_id ?? null, authority_type: OBJECT_AUTHORITY.UserEvidenceLedger, truth_class: OBJECT_TRUTH_CLASS.UserEvidenceLedger,
    status: 'ACTIVE', created_at: at, updated_at: at, effective_at: at, expires_at: null,
    source_event_ids: replay.receipt.applied_event_ids, provenance: input.provenance, privacy_classification: 'TENANT_PRIVATE', consent_record_ids: input.consent_record_ids || [],
    version: 1, previous_version_id: null, supersedes_id: null, validation_state: 'VALIDATED', scope: 'RUNTIME_CURRENT_EVIDENCE',
    evidence_entries: replay.state.entries, period_start: null, period_end: at, verification_state: 'MIXED', completeness_state: 'POLICY_EVALUATED' };
  return buildDurableObject('UserEvidenceLedger', raw);
}

export function runDurableIntelligenceRuntime(input) {
  const replay = replayProjection({ definition: EVIDENCE_LEDGER_PROJECTION, stored_events: input.stored_events || [], tenant_id: input.tenant_id,
    filter: input.filter || {}, context: { projection_policy_version: 'evidence-ledger-v1' }, checkpoint: input.checkpoint || null });
  if (!replay.ok) return deepFreeze({ ok: false, phase: 'REPLAY', failure: replay.failure || { code: replay.status } });
  const ledger = evidenceLedger(input, replay); if (!ledger.validation.valid) return deepFreeze({ ok: false, phase: 'EVIDENCE_LEDGER', failure: { errors: ledger.validation.errors } });
  const candidates = ledger.value.evidence_entries.map((entry) => ({ candidate_id: entry.evidence_id, position_id: `position_${entry.evidence_id}`,
    tenant_id: input.tenant_id, authority_type: 'USER_EVIDENCE', privacy_classification: entry.privacy_classification,
    provenance_valid: true, applicable: true, asserted_value: { metric_id: entry.metric_id, value: entry.value, unit: entry.unit }, source_ids: [entry.evidence_id],
    consent_record: input.consent_record, relationship_authorized: input.relationship_authorized === true }));
  const synthesis = routeSynthesis({ request_id: `route_${replay.replay_hash.slice(0, 16)}`, claim_type: 'MEASUREMENT', tenant_id: input.tenant_id,
    purpose: input.purpose, scope: input.scope, as_of_at: input.as_of_at, candidates });
  if (!synthesis.ok && candidates.length) return deepFreeze({ ok: false, phase: 'SYNTHESIS', failure: synthesis.receipt });
  const reality = runRealityEngine({ ...input, evidence_ledger: ledger.value, synthesis_bundle: synthesis.bundle,
    synthesis_receipt: synthesis.receipt, source_event_ids: replay.receipt.applied_event_ids });
  if (!reality.ok) return deepFreeze({ ok: false, phase: 'REALITY', failure: reality.errors });
  const rankedGaps = rankEvidenceGaps(reality.evidence_gaps);
  const belief = updateBeliefState({ ...input, business_engine_state: reality.business_engine_state,
    prior_belief_state: input.prior_belief_state, observations: input.belief_observations || [], ranked_gaps: rankedGaps,
    conflict_ids: reality.business_engine_state.conflict_ids, source_event_ids: replay.receipt.applied_event_ids });
  if (!belief.ok) return deepFreeze({ ok: false, phase: 'BELIEF', failure: belief.errors });
  const result = { event_replay: replay, evidence_ledger: ledger.value, synthesis_receipt: synthesis.receipt,
    business_engine_state: reality.business_engine_state, business_engine_state_version: reality.business_engine_state_version,
    belief_state: belief.belief_state, evidence_gaps: rankedGaps, confidence_state: reality.confidence_state,
    explanation_trace: reality.explanation_trace };
  return deepFreeze({ ok: true, status: 'RUNTIME_RECONSTRUCTED', ...result,
    runtime_hash: hashCanonicalJson({ replay_hash: replay.replay_hash, state: reality.output_hash, belief: belief.output_hash }) });
}
