import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { sameScope } from '../contracts.js';

const referenceField = 'evidence.intervention_lineage_id';
export const correctionRecordReference = (event) => `personal_rsl_event:${event.event_id}:${event.content_hash}`;
const observation = (event) => ['EXECUTION_OBSERVED', 'OUTCOME_OBSERVED'].includes(event?.semantic_payload?.lineage?.stage);

// Field names are not record identities. A shared execution/outcome field may
// belong to many interventions. Bind a correction to an exact active record.
export function resolveCorrectionTargets({ scope, items, authority_ref_ids = [], active_events = [], supersedes_event_ids = null }) {
  const deny = (code) => deepFreeze({ ok: false, code });
  if (active_events.some((event) => !sameScope(event.scope, scope))) return deny('AFW05_CORRECTION_SCOPE_DENIED');
  const fields = new Set(items.map((item) => item.field).filter((field) => field !== referenceField));
  const handles = authority_ref_ids.filter((ref) => ref.startsWith('personal_rsl_event:'));
  let targets;
  if (supersedes_event_ids !== null) {
    targets = supersedes_event_ids.map((id) => active_events.find((event) => event.event_id === id));
    if (targets.some((event) => !event)) return deny('AFW05_CORRECTION_TARGET_NOT_ACTIVE');
  } else if (handles.length) {
    targets = handles.map((ref) => active_events.find((event) => correctionRecordReference(event) === ref));
    if (targets.some((event) => !event)) return deny('AFW05_CORRECTION_RECORD_REFERENCE_INVALID');
  } else {
    targets = active_events.filter((event) => event.semantic_payload?.items?.some((item) => fields.has(item.field)));
  }
  if (targets.length !== 1) return deny('AFW05_CORRECTION_EXACT_RECORD_REQUIRED');
  const target = targets[0];
  const priorItems = target.semantic_payload?.items || [];
  if (!priorItems.some((item) => fields.has(item.field))) return deny('AFW05_CORRECTION_FIELD_NOT_ON_TARGET');
  // Supersession removes an event, not just one field. Never discard the rest
  // of its meaning, nor detach a corrected observation from its intervention.
  if (priorItems.some((item) => !items.some((next) => next.field === item.field))) return deny('AFW05_CORRECTION_COMPLETE_RECORD_REQUIRED');
  if (observation(target)) {
    if (!handles.includes(correctionRecordReference(target))) return deny('AFW05_CORRECTION_OBSERVATION_REFERENCE_REQUIRED');
    const lineageId = items.find((item) => item.field === referenceField)?.value;
    if (lineageId !== target.semantic_payload.lineage.intervention_lineage_id) return deny('AFW05_CORRECTION_LINEAGE_MISMATCH');
  }
  return deepFreeze({ ok: true, code: 'AFW05_CORRECTION_EXACT_RECORD_BOUND', targets, supersedes_event_ids: [target.event_id] });
}

export function correctionTargetContext({ scope, proposal, active_events }) {
  if (proposal.proposal_type !== 'CORRECTION_CANDIDATE' || proposal.retracts_event_ids?.length) return { ok: true, targets: [] };
  const explicit = proposal.supersedes_event_ids.map((id) => active_events.find((event) => event.event_id === id));
  // Existing explicit intervention retirement is not an observation-field edit.
  // Preserve that governed operation; the AFW-05 store still checks exact scope.
  if (explicit.length && explicit.every((event) => event && !observation(event)
    && !event.semantic_payload?.items?.some((item) => proposal.proposed_items.some((next) => next.field === item.field)))) {
    return { ok: true, targets: explicit };
  }
  return resolveCorrectionTargets({ scope, items: proposal.proposed_items, authority_ref_ids: proposal.authority_ref_ids, active_events, supersedes_event_ids: proposal.supersedes_event_ids });
}

export function correctionRecordCatalog({ scope, active_events }) {
  return active_events.filter((event) => sameScope(event.scope, scope)).map((event) => ({
    authority_ref: correctionRecordReference(event),
    summary: event.semantic_payload?.summary || null,
    items: event.semantic_payload?.items || [],
    lineage: event.semantic_payload?.lineage || null,
    effective_at: event.effective_at,
  }));
}
