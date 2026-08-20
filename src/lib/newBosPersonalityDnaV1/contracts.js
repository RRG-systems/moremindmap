import {
  CONFIDENCE_STATES,
  DIMENSIONS,
  EPISTEMIC_CLASSES,
  FORBIDDEN_WHOLE_PERSON_LANGUAGE,
  NEW_BOS_REAL_PROFILE_HS_GATE_V1,
  NEW_BOS_HUMAN_REALIZATION_VERSION,
  RUNTIME_STAGES,
  SURFACES,
} from './constants.js';
import { validateRichSpecializedIntelligence } from './domainContracts.js';

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateEvidenceAuthority(raw, activation) {
  if (activation === 'synthetic_lab') {
    invariant(raw?.synthetic === true, 'Synthetic lab activation requires a synthetic fixture');
    invariant(/^SYNTH-PDNV1-/.test(raw.subject_token || ''), 'Synthetic subject token is required');
    return;
  }
  invariant(activation === NEW_BOS_REAL_PROFILE_HS_GATE_V1, 'New BOS V1 activation is not authorized');
  invariant(raw?.real_profile_gate === true && raw?.synthetic === false, 'Real-profile gate evidence must be explicitly classified');
  invariant(/^MM-[A-Z0-9-]+$/.test(raw.profile_id || ''), 'Real-profile gate requires an adapter-verified profile identity');
  invariant(raw.subject_token === `REAL-PDNV1-${raw.profile_id}`, 'Real-profile gate subject token is not identity-bound');
  invariant(raw.governed_local_snapshot === true, 'Real-profile gate requires a governed local snapshot');
  invariant(raw.identity_verified_by_adapter === true, 'Real-profile gate adapter identity proof is required');
}

export function validateRawEvidence(raw, activation = 'synthetic_lab') {
  validateEvidenceAuthority(raw, activation);
  invariant(raw.identity_context && typeof raw.identity_context === 'object', 'Identity/context object is required');
  invariant(Array.isArray(raw.questions) && raw.questions.length > 0, 'Exact question evidence is required');
  invariant(Array.isArray(raw.evidence) && raw.evidence.length > 0, 'Evidence ledger is required');
  const ids = new Set(raw.evidence.map((item) => item.evidence_id));
  invariant(ids.size === raw.evidence.length, 'Evidence IDs must be unique');
  raw.evidence.forEach((item) => {
    invariant(EPISTEMIC_CLASSES.includes(item.epistemic_class), `Unknown epistemic class: ${item.epistemic_class}`);
    invariant(item.source_ref, `Missing source reference for ${item.evidence_id}`);
  });
  DIMENSIONS.forEach(({ id }) => {
    invariant(Number.isFinite(raw.scores?.[id]), `Missing canonical score: ${id}`);
    invariant(raw.scores[id] >= 0 && raw.scores[id] <= 100, `Score out of range: ${id}`);
  });
  return raw;
}

function validateEvidenceRefs(items, evidenceIds, label) {
  items.forEach((item) => {
    invariant(item.id, `${label} item requires id`);
    invariant(CONFIDENCE_STATES.includes(item.confidence), `${label} ${item.id} has invalid confidence`);
    invariant(Array.isArray(item.evidence_refs), `${label} ${item.id} requires evidence_refs`);
    item.evidence_refs.forEach((ref) => invariant(evidenceIds.has(ref), `${label} ${item.id} references missing evidence ${ref}`));
    (item.counterevidence_refs || []).forEach((ref) => invariant(evidenceIds.has(ref), `${label} ${item.id} references missing counterevidence ${ref}`));
    invariant(item.what_would_change_it, `${label} ${item.id} requires a falsifier`);
  });
}

export function validateInterpretationDraft(raw, draft) {
  const evidenceIds = new Set(raw.evidence.map((item) => item.evidence_id));
  validateEvidenceRefs(draft.topology || [], evidenceIds, 'Topology');
  validateEvidenceRefs(draft.attributes || [], evidenceIds, 'Attribute');
  validateEvidenceRefs(draft.dynamics || [], evidenceIds, 'Dynamic');
  invariant(draft.specialized && typeof draft.specialized === 'object', 'Specialized intelligence is required');
  if (draft.specialized.version) validateRichSpecializedIntelligence(draft.specialized, evidenceIds);
  invariant(draft.whole_person && typeof draft.whole_person === 'object', 'Whole-person candidate is required');
  invariant(Array.isArray(draft.abstentions), 'Abstention ledger is required');
  return draft;
}

export function assertVectorFreeWholePerson(wholePerson) {
  const customerMeaning = {
    core_explanation: wholePerson.core_explanation,
    central_tension: wholePerson.central_tension,
    mechanisms: wholePerson.mechanisms,
    identity_tensions: wholePerson.identity_tensions,
    goal_conflicts: wholePerson.goal_conflicts,
    private_calculations: wholePerson.private_calculations,
    pressure_and_recovery: wholePerson.pressure_and_recovery,
    work_and_relationships: wholePerson.work_and_relationships,
    identity_distillation: wholePerson.identity_distillation,
  };
  const text = JSON.stringify(customerMeaning).toLowerCase();
  FORBIDDEN_WHOLE_PERSON_LANGUAGE.forEach((term) => {
    invariant(!text.includes(term), `Whole-person model leaked assessment language: ${term}`);
  });
  return wholePerson;
}

export function validateSurfacePackets(packets) {
  invariant(Array.isArray(packets), 'Surface packets must be an array');
  invariant(packets.length === SURFACES.length, `Expected ${SURFACES.length} surfaces`);
  const ids = new Set(packets.map((item) => item.surface_id));
  SURFACES.forEach(({ id }) => invariant(ids.has(id), `Missing customer surface: ${id}`));
  packets.forEach((packet) => {
    invariant(packet.local_mission, `Surface ${packet.surface_id} requires local mission`);
    invariant(packet.whole_person_ref, `Surface ${packet.surface_id} requires whole-person reference`);
    invariant(packet.library_selection?.authorities?.length > 0, `Surface ${packet.surface_id} requires library authority`);
    invariant(Array.isArray(packet.claim_refs), `Surface ${packet.surface_id} requires claim refs`);
    invariant(packet.whole_person_model && typeof packet.whole_person_model === 'object', `Surface ${packet.surface_id} requires the frozen whole-person model`);
    invariant(packet.resolved_local_truth?.version === 'bos_resolved_surface_truth_v1', `Surface ${packet.surface_id} requires resolved local truth`);
    invariant(packet.resolved_local_truth.surface_id === packet.surface_id, `Surface ${packet.surface_id} local truth is mismatched`);
    invariant(Array.isArray(packet.resolved_local_truth.resolved_claims), `Surface ${packet.surface_id} requires resolved claims`);
    invariant(Array.isArray(packet.resolved_local_truth.evidence), `Surface ${packet.surface_id} requires resolved evidence`);
    if (packet.human_realization) {
      invariant(packet.human_realization.version === NEW_BOS_HUMAN_REALIZATION_VERSION, `Surface ${packet.surface_id} human realization version mismatch`);
      invariant(packet.human_realization.surface_id === packet.surface_id, `Surface ${packet.surface_id} human realization is mismatched`);
      invariant(typeof packet.human_realization.customer_prose === 'string' && packet.human_realization.customer_prose.trim(), `Surface ${packet.surface_id} requires customer prose`);
      invariant(Array.isArray(packet.human_realization.governed_evidence_refs), `Surface ${packet.surface_id} requires governed evidence refs`);
      invariant(packet.human_realization_audit?.blocking === false, `Surface ${packet.surface_id} human realization audit must remain non-blocking`);
      invariant(Array.isArray(packet.human_realization_audit?.notes), `Surface ${packet.surface_id} requires non-blocking audit notes`);
    }
  });
  return packets;
}

export function validateRuntimeArtifact(artifact) {
  invariant(
    artifact?.synthetic === true
      || (artifact?.real_profile_gate === true
        && /^MM-[A-Z0-9-]+$/.test(artifact.profile_id || '')
        && artifact.subject_token === `REAL-PDNV1-${artifact.profile_id}`),
    'Runtime artifact authority classification is invalid',
  );
  invariant(artifact.stage_receipts?.length === RUNTIME_STAGES.length, 'Every runtime stage requires a receipt');
  RUNTIME_STAGES.forEach((stage) => invariant(
    artifact.stage_receipts.some((receipt) => receipt.stage === stage && receipt.status === 'complete'),
    `Runtime stage incomplete: ${stage}`,
  ));
  assertVectorFreeWholePerson(artifact.whole_person_model);
  validateSurfacePackets(artifact.surface_packets);
  return artifact;
}
