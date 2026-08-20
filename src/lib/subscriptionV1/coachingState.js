import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import {
  contractHeader,
  createAuthorityReference,
  sameScope,
  validateSubscriptionV1Contract,
} from './contracts.js';
import {
  COACHING_DOCTRINE_INSERTION_POINT,
  REQUIRED_STATE_ARTIFACT_TYPES,
  UNIVERSAL_RSL_RUNTIME_FLAGS,
} from './constants.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export function createLineageVersionIdentity(artifact) {
  const lineage = {
    ...contractHeader('lineage_version_identity'),
    artifact_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    version: artifact.version,
    content_hash: artifact.content_hash,
    authority: clone(artifact.authority || createAuthorityReference({ authority_id: `${artifact.artifact_type.toLowerCase()}_authority`, authority_version: artifact.version })),
    parent_artifact_ids: [...new Set(artifact.parent_artifact_ids || [])].sort(),
    created_at: new Date(artifact.created_at).toISOString(),
    supersedes_artifact_id: artifact.supersedes_artifact_id || null,
  };
  const validation = validateSubscriptionV1Contract(lineage);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'LINEAGE_CONTRACT_INVALID', errors: validation.errors });
  return deepFreeze({ ok: true, code: 'LINEAGE_IDENTITY_CREATED', lineage });
}

function selectNewestCompatible(artifacts, artifactType) {
  const candidates = artifacts.filter((artifact) => artifact.artifact_type === artifactType);
  const compatible = candidates.filter((artifact) => artifact.status === 'COMPLETE'
    && artifact.validation_status === 'PASS'
    && artifact.compatibility_status === 'COMPATIBLE');
  compatible.sort((left, right) => right.created_at.localeCompare(left.created_at)
    || right.version.localeCompare(left.version)
    || left.artifact_id.localeCompare(right.artifact_id));
  return { selected: compatible[0] || null, rejected: candidates.filter((candidate) => candidate !== compatible[0]) };
}

function validateCrossArtifactBindings(selected) {
  const byType = new Map(selected.map((artifact) => [artifact.artifact_type, artifact]));
  const bos = byType.get('NEW_BOS');
  const ba = byType.get('NEW_BA');
  const fusion = byType.get('BOS_BA_FUSION');
  const wbm = byType.get('WHOLE_BUSINESS_MODEL_V1');
  const futures = byType.get('FIVE_FUTURES_V2');
  const move = byType.get('ONE_MOVE_V2');
  const plan = byType.get('PLAN_135');
  const evidence = byType.get('EVIDENCE_LEDGER');
  if (fusion.bindings?.bos_hash !== bos.content_hash || fusion.bindings?.ba_hash !== ba.content_hash) return 'FUSION_AUTHORITY_BINDING_INVALID';
  if (wbm.bindings?.ba_hash !== ba.content_hash || wbm.bindings?.fusion_hash !== fusion.content_hash) return 'WBM_AUTHORITY_BINDING_INVALID';
  if (wbm.domain_boundary?.business_causes !== 'BUSINESS_EVIDENCE_ONLY'
    || wbm.domain_boundary?.whole_person_role !== 'EXECUTION_FEASIBILITY_ONLY') return 'WBM_DOMAIN_BOUNDARY_INVALID';
  const weights = futures.payload?.trajectories?.map((trajectory) => trajectory.relative_support_weight);
  if (!Array.isArray(weights) || weights.length !== 5 || weights.some((weight) => !Number.isInteger(weight) || weight < 0) || weights.reduce((sum, weight) => sum + weight, 0) !== 100) return 'FIVE_FUTURES_EXACT_100_INVALID';
  if (futures.bindings?.wbm_hash !== wbm.content_hash) return 'FIVE_FUTURES_WBM_BINDING_INVALID';
  if (move.bindings?.wbm_hash !== wbm.content_hash || !move.payload?.mechanism_id || move.payload?.selected !== true) return 'ONE_MOVE_BINDING_INVALID';
  if (plan.bindings?.one_move_hash !== move.content_hash || plan.bindings?.wbm_hash !== wbm.content_hash) return 'PLAN_BINDING_INVALID';
  if (evidence.bindings?.ba_hash !== ba.content_hash || evidence.bindings?.wbm_hash !== wbm.content_hash) return 'EVIDENCE_BINDING_INVALID';
  return null;
}

export function assembleCoachingStatePacket({
  scope,
  session_id,
  purpose,
  active_lens,
  artifacts,
  personal_history,
  business_truth,
  whole_person_execution_context,
  uncertainty = [],
  current_state = {},
  external_evidence = [],
  universal_patterns = [],
  assembled_at,
}) {
  if (!Array.isArray(artifacts)) return deepFreeze({ ok: false, code: 'CANONICAL_ARTIFACTS_REQUIRED' });
  const crossScope = artifacts.find((artifact) => !sameScope(artifact.scope, scope));
  if (crossScope) return deepFreeze({ ok: false, code: 'CROSS_SCOPE_ARTIFACT_DENIED', artifact_id: crossScope.artifact_id });
  if (external_evidence.length) return deepFreeze({ ok: false, code: 'GOVERNED_EXTERNAL_READ_NOT_AUTHORIZED' });
  if (universal_patterns.length || UNIVERSAL_RSL_RUNTIME_FLAGS.runtime_read_enabled) return deepFreeze({ ok: false, code: 'UNIVERSAL_RSL_READ_NOT_AUTHORIZED' });
  if (!personal_history?.result || !sameScope(personal_history.result.scope, scope)) return deepFreeze({ ok: false, code: 'PERSONAL_HISTORY_SCOPE_INVALID' });
  const selected = [];
  const selectionReceipt = {};
  for (const artifactType of REQUIRED_STATE_ARTIFACT_TYPES) {
    const selection = selectNewestCompatible(artifacts, artifactType);
    if (!selection.selected) return deepFreeze({ ok: false, code: 'NEWEST_COMPATIBLE_ARTIFACT_MISSING', artifact_type: artifactType });
    selected.push(selection.selected);
    selectionReceipt[artifactType] = {
      selected_artifact_id: selection.selected.artifact_id,
      selected_hash: selection.selected.content_hash,
      rejected_artifact_ids: selection.rejected.map((artifact) => artifact.artifact_id).sort(),
    };
  }
  const bindingFailure = validateCrossArtifactBindings(selected);
  if (bindingFailure) return deepFreeze({ ok: false, code: bindingFailure });
  const lineages = [];
  for (const artifact of selected) {
    const result = createLineageVersionIdentity(artifact);
    if (!result.ok) return result;
    lineages.push(result.lineage);
  }
  const history = (personal_history.selected_events || []).map((event) => ({
    event_id: event.event_id,
    event_type: event.event_type,
    effective_at: event.effective_at,
    source_class: event.source_class,
    semantic_payload: clone(event.semantic_payload),
    evidence_refs: clone(event.evidence_refs),
    content_hash: event.content_hash,
  }));
  const body = {
    ...contractHeader('coaching_state_packet'),
    packet_id: `state_packet_${hashCanonicalJson({ scope, session_id, purpose, active_lens, lineage: lineages.map((item) => item.content_hash), retrieval: personal_history.result.result_hash }).slice(0, 24)}`,
    scope: clone(scope),
    session_id,
    purpose,
    active_lens,
    artifact_lineage: lineages,
    business_truth: clone(business_truth || []),
    whole_person_execution_context: clone(whole_person_execution_context || []),
    personal_rsl_retrieval_hash: personal_history.result.result_hash,
    relevant_history: history,
    current_state: clone(current_state),
    external_evidence_ids: [],
    universal_pattern_ids: [],
    uncertainty: clone(uncertainty),
    assembled_at: new Date(assembled_at).toISOString(),
  };
  const packet = deepFreeze({ ...body, packet_hash: hashCanonicalJson(body) });
  const validation = validateSubscriptionV1Contract(packet);
  if (!validation.valid) return deepFreeze({ ok: false, code: 'COACHING_STATE_PACKET_CONTRACT_INVALID', errors: validation.errors });
  return deepFreeze({
    ok: true,
    code: 'COACHING_STATE_PACKET_ASSEMBLED',
    packet,
    selection_receipt: selectionReceipt,
    domain_boundary: {
      business_causes: 'BUSINESS_EVIDENCE_ONLY',
      whole_person_role: 'EXECUTION_FEASIBILITY_ONLY',
      personality_as_business_cause_allowed: false,
    },
    provider_execution: 'NOT_IMPLEMENTED_STOP_BEFORE_AFW_04',
    coaching_doctrine_insertion_point: COACHING_DOCTRINE_INSERTION_POINT,
  });
}
