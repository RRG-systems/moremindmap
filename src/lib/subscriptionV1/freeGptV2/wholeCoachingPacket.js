import { hashCanonicalJson } from '../../intelligenceFabric/hashing.js';
import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { createEvidenceReference } from '../contracts.js';
import { assembleCoachingStatePacket } from '../coachingState.js';
import { purposeRankPrivateAdvisorContext } from './purposeRankedContext.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const HASH = /^[a-f0-9]{64}$/u;
const INTERNAL_KEY = /(?:^|_)(?:id|ids|hash|hashes|ref|refs|reference|references|schema|scope|binding|bindings|lineage|provider|contract)(?:$|_)/iu;
const SECRET_PATTERN = /(?:sk-[A-Za-z0-9_-]{16,}|OPENAI_API_KEY|authorization\s*:\s*bearer|cookie\s*:)/iu;
const INTERNAL_VALUE = /^(?:[A-Z][A-Z0-9_]{2,}|(?:ME|UK|RE|PS)-\d{2}|(?:subject|membership|tenant|profile|business|artifact|evidence|rsl|proposal|decision|living_twin)_[A-Za-z0-9_-]+)$/u;

function humanize(value) {
  return String(value).replaceAll('_', ' ').toLowerCase().replace(/^./u, (letter) => letter.toUpperCase());
}

function semanticProjection(value, depth = 0) {
  if (depth > 16 || value == null) return value;
  if (typeof value === 'string') {
    if (SECRET_PATTERN.test(value)) throw new TypeError('FREE_GPT_V2_SECRET_DENIED');
    return INTERNAL_VALUE.test(value) ? humanize(value) : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => semanticProjection(item, depth + 1));
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (INTERNAL_KEY.test(key)) continue;
    result[humanize(key)] = semanticProjection(child, depth + 1);
  }
  return result;
}

function selectArtifacts(artifacts, receipt) {
  const byId = new Map(artifacts.map((artifact) => [artifact.artifact_id, artifact]));
  return Object.fromEntries(Object.entries(receipt).map(([type, selection]) => [type, byId.get(selection.selected_artifact_id)]));
}

export function createGovernedCoachingEvidenceCatalog({ business_truth = [], whole_person_execution_context = [], external_evidence = [] } = {}) {
  const catalog = [];
  for (const source of [...business_truth, ...whole_person_execution_context]) catalog.push(createEvidenceReference(source));
  for (const source of external_evidence) {
    if (typeof source?.external_evidence_id !== 'string'
      || !HASH.test(source?.content_hash || '')
      || source.status !== 'TEMPORARY_CONTEXT'
      || source.privacy_classification !== 'PUBLIC'
      || source.customer_truth_override_allowed !== false
      || !String(source.source_url || '').startsWith('https://')) {
      throw new TypeError('FREE_GPT_V2_EXTERNAL_EVIDENCE_AUTHORITY_INVALID');
    }
    catalog.push(createEvidenceReference({
      evidence_id: source.external_evidence_id,
      evidence_domain: 'EXTERNAL',
      content_hash: source.content_hash,
      certainty: 'OBSERVED',
    }));
  }
  const byId = new Map();
  for (const reference of catalog) {
    const existing = byId.get(reference.evidence_id);
    if (existing && hashCanonicalJson(existing) !== hashCanonicalJson(reference)) {
      throw new TypeError('FREE_GPT_V2_EVIDENCE_IDENTITY_COLLISION');
    }
    byId.set(reference.evidence_id, reference);
  }
  return deepFreeze([...byId.values()].sort((left, right) => left.evidence_id.localeCompare(right.evidence_id)));
}

function refsFor(selected, evidenceCatalog, basePacket, doctrine, externalEvidence) {
  const evidence = evidenceCatalog.map((item) => item.evidence_id);
  const authority = [...(doctrine.selected_authority_refs || [])]
    .concat(Object.values(selected).map((artifact) => `canonical_artifact:${artifact.artifact_type}:${artifact.content_hash}`))
    .concat(`personal_rsl:${basePacket.personal_rsl_retrieval_hash}`)
    .concat(externalEvidence.map((item) => item.external_evidence_id ? `external_evidence:${item.external_evidence_id}` : null).filter(Boolean));
  return { evidence: [...new Set(evidence)].sort(), authority: [...new Set(authority)].sort() };
}

function providerPacket({ selected, basePacket, doctrine, conversation, visibleContext, externalEvidence, relationshipContext, coachingSession, temporalState, relationshipContinuity }) {
  const history = (basePacket.relevant_history || []).map((event) => ({
    kind: humanize(event.event_type),
    happened_at: event.effective_at,
    meaning: semanticProjection(event.semantic_payload),
  }));
  return {
    whole_person: semanticProjection(selected.NEW_BOS?.payload || {}),
    whole_business: semanticProjection({
      business_assessment: selected.NEW_BA?.payload || {},
      whole_business_model: selected.WHOLE_BUSINESS_MODEL_V1?.payload || {},
      person_business_fit: selected.BOS_BA_FUSION?.payload || {},
    }),
    possible_futures: semanticProjection(selected.FIVE_FUTURES_V2?.payload || {}),
    one_move: semanticProjection(selected.ONE_MOVE_V2?.payload || {}),
    plan: semanticProjection(selected.PLAN_135?.payload || {}),
    evidence: semanticProjection({
      ledger: selected.EVIDENCE_LEDGER?.payload || {},
      business_truth: basePacket.business_truth || [],
      whole_person_execution_context: basePacket.whole_person_execution_context || [],
      uncertainty: basePacket.uncertainty || [],
    }),
    living_business_twin: semanticProjection(basePacket.current_state || {}),
    relevant_coaching_history: semanticProjection(history),
    coaching_intelligence: {
      universal: (doctrine.layers?.universal_kernel || []).map(({ title, guidance }) => ({ title, guidance })),
      vertical: [],
      vertical_context: null,
      semantic_cassette_injected: false,
    },
    current_conversation: semanticProjection(conversation.slice(-24)),
    subscription_relationship: semanticProjection(relationshipContext),
    coaching_session: clone(coachingSession),
    temporal_state: semanticProjection(temporalState),
    relationship_continuity: semanticProjection(relationshipContinuity),
    visible_customer_context: semanticProjection(visibleContext),
    governed_external_context: semanticProjection(externalEvidence.map(({ purpose, source_title, source_url, citation, retrieved_at }) => ({ purpose, source_title, source_url, citation, retrieved_at }))),
    truth_boundaries: {
      business_causes: 'Use business evidence only.',
      whole_person_role: 'Use person truth only for communication, motivation, and feasible execution.',
      uncertainty: 'Preserve what is missing, uncertain, modeled, or contradicted.',
      durable_change: 'Never say the map changed unless an authorized mutation already completed.',
    },
  };
}

export function assembleWholeCoachingUnderstandingPacketV2({
  scope,
  session_id,
  artifacts,
  personal_history,
  business_truth,
  whole_person_execution_context,
  uncertainty = [],
  current_state,
  doctrine_retrieval,
  conversation = [],
  visible_customer_context = null,
  external_evidence = [],
  relationship_context = null,
  coaching_session = null,
  temporal_state = null,
  relationship_continuity = null,
  purpose = relationship_context?.session_kind === 'FIRST_EVER' ? 'ONBOARDING' : 'WEEKLY_COACHING',
  active_lens = 'OVERVIEW',
  topics = [],
  customer_message = '',
  assembled_at,
}) {
  if (!doctrine_retrieval?.retrieval_hash) return deepFreeze({ ok: false, code: 'FREE_GPT_V2_DOCTRINE_REQUIRED' });
  const base = assembleCoachingStatePacket({
    scope, session_id, purpose, active_lens, artifacts, personal_history,
    business_truth, whole_person_execution_context, uncertainty, current_state, assembled_at,
  });
  if (!base.ok) return deepFreeze(base);
  let selected;
  let provider_understanding;
  let rankedContext;
  let evidenceCatalog;
  try {
    selected = selectArtifacts(artifacts, base.selection_receipt);
    evidenceCatalog = createGovernedCoachingEvidenceCatalog({
      business_truth: base.packet.business_truth,
      whole_person_execution_context: base.packet.whole_person_execution_context,
      external_evidence,
    });
    const fullProviderUnderstanding = providerPacket({ selected, basePacket: base.packet, doctrine: doctrine_retrieval, conversation, visibleContext: visible_customer_context, externalEvidence: external_evidence, relationshipContext: relationship_context, coachingSession: coaching_session, temporalState: temporal_state, relationshipContinuity: relationship_continuity });
    rankedContext = purposeRankPrivateAdvisorContext({
      full_provider_understanding: fullProviderUnderstanding,
      doctrine_retrieval,
      purpose,
      active_lens,
      topics,
      customer_message,
    });
    provider_understanding = rankedContext.provider_understanding;
  } catch (error) {
    return deepFreeze({ ok: false, code: error.message || 'FREE_GPT_V2_PROVIDER_PROJECTION_FAILED' });
  }
  const allowed_refs = refsFor(selected, evidenceCatalog, base.packet, rankedContext.doctrine_retrieval, external_evidence);
  const authorizedInterventionLineageHandles = (relationship_continuity?.open_loops || [])
    .filter((item) => item?.kind === 'STABLE_INTERVENTION_LINEAGE' && /^intervention_[a-f0-9]{24}$/u.test(item.intervention_lineage_id || ''))
    .map((item) => ({
      intervention_lineage_id: item.intervention_lineage_id,
      summary: item.summary || null,
      open_loop_state: item.status,
      due_at: item.due_at || null,
    }));
  const body = {
    contract_id: 'whole_coaching_understanding_packet_v2',
    schema_version: '2.0.0',
    scope: clone(scope),
    session_id,
    base_state_packet: base.packet,
    selected_artifacts: Object.fromEntries(Object.entries(selected).map(([type, artifact]) => [type, { artifact_id: artifact.artifact_id, content_hash: artifact.content_hash }])),
    doctrine_retrieval_hash: rankedContext.doctrine_retrieval.retrieval_hash,
    full_doctrine_corpus_hash: doctrine_retrieval.retrieval_hash,
    context_selection_receipt: rankedContext.receipt,
    allowed_refs,
    authorized_intervention_lineage_handles: authorizedInterventionLineageHandles,
    catastrophic_constraints: {
      contradicted_claims: clone(selected.EVIDENCE_LEDGER?.payload?.contradicted || []),
    },
    provider_understanding,
    provider_projection_contains_internal_identity: false,
    provider_projection_contains_hashes: false,
    provider_projection_contains_modes: false,
    assembled_at: new Date(assembled_at).toISOString(),
  };
  const packet = deepFreeze({ ...body, packet_hash: hashCanonicalJson(body) });
  return deepFreeze({
    ok: true,
    code: 'WHOLE_COACHING_UNDERSTANDING_PACKET_V2_ASSEMBLED',
    packet,
    provider_understanding,
    selection_receipt: base.selection_receipt,
    context_selection_receipt: rankedContext.receipt,
    domain_boundary: base.domain_boundary,
  });
}
