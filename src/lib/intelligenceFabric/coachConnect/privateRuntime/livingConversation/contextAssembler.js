import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import { exactPrivateRuntimeScope } from '../contracts.js';

export const LIVING_CONVERSATION_CONTEXT_VERSION =
  'living-conversation-context-v1';

const CONTEXT_TYPES = Object.freeze([
  'BOS_CONVERSATION_CONTEXT',
  'BUSINESS_ASSESSMENT_CONTEXT',
  'BUSINESS_ENGINE_CURRENT_STATE',
  'BUSINESS_ENGINE_HISTORY',
  'FIVE_FUTURES_CONTEXT',
  'ONE_MOVE_CONTEXT',
  'EVIDENCE_CONFIDENCE_CONTEXT',
  'TRUTH_BOUNDARIES_CONTEXT',
]);
const BLOCKED_KEY = /(^|_)(answers?|raw|payload|transcript|messages?|prompt|response|secret|token|cookie|authorization|e?mail|phone|first_name|last_name|full_name|customer_name|contact|owner_contact|street|address|image_url)($|_)/i;
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_VALUE = /\+?\d[\d ().-]{7,}\d/;
const MAX_CONTEXT_CHARS = 48_000;

const frozen = (value) => deepFreeze(structuredClone(value));
const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function safeText(value, max = 800) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const phoneCandidate = normalized.match(PHONE_VALUE)?.[0] || '';
  if (EMAIL_VALUE.test(normalized)
    || phoneCandidate.replace(/\D/g, '').length >= 10) return '[REDACTED]';
  return normalized.slice(0, max);
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4 || value == null) return null;
  if (typeof value === 'string') return safeText(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((entry) => sanitizeValue(entry, depth + 1));
  }
  if (!object(value)) return null;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !BLOCKED_KEY.test(key))
    .slice(0, 24)
    .map(([key, child]) => [key, sanitizeValue(child, depth + 1)]));
}

function canonicalProfile(dossier) {
  return dossier?.canonical_profile_json
    || dossier?.canonical_dossier?.canonical_profile_json
    || dossier?.canonical_dossier
    || dossier
    || {};
}

function rankedDimensions(canonical) {
  const cognition = canonical?.rescoring_gpt || canonical?.rescoring_v1 || {};
  const ranked = cognition.ranked_dimensions || canonical?.ranked_dimensions || [];
  return Array.isArray(ranked)
    ? ranked.slice(0, 8).map((entry, index) => ({
        rank: Number.isInteger(entry?.rank) ? entry.rank : index + 1,
        dimension: safeText(
          entry?.dimension || entry?.label || entry?.name || entry?.code,
          120,
        ),
        score: Number.isFinite(entry?.display_score)
          ? entry.display_score
          : Number.isFinite(entry?.gpt_rescored_score)
            ? entry.gpt_rescored_score
            : Number.isFinite(entry?.score) ? entry.score : null,
        confidence: Number.isFinite(entry?.confidence) ? entry.confidence : null,
        classification: 'INFERRED',
      }))
    : [];
}

function firstText(...values) {
  for (const value of values) {
    const text = safeText(value, 1200);
    if (text) return text;
  }
  return null;
}

function bosProjection(dossier) {
  const canonical = canonicalProfile(dossier);
  const cognition = canonical?.rescoring_gpt || canonical?.rescoring_v1 || {};
  const renderReady = cognition?.render_ready || {};
  const interpretation = canonical?.behavioral_dna_interpretation
    || canonical?.behavioral_dna
    || {};
  return {
    source_class: 'CANONICAL_BOS',
    interpretation_class: 'BEHAVIORAL_INFERENCE_NOT_BUSINESS_FACT',
    profile_type: firstText(
      canonical?.behavioral_profile?.profile_type,
      canonical?.profile_type,
      interpretation?.profile_type,
    ),
    operating_pattern: firstText(
      renderReady?.profile_dna,
      interpretation?.operating_pattern,
      interpretation?.summary,
      interpretation?.body,
    ),
    decision_pattern: firstText(
      interpretation?.decision_pattern,
      renderReady?.decision_pattern,
    ),
    pressure_pattern: firstText(
      interpretation?.pressure_pattern,
      interpretation?.pressure_response,
      renderReady?.pressure_shift,
    ),
    communication_pattern: firstText(
      interpretation?.communication_pattern,
      renderReady?.communication_style,
    ),
    ranked_dimensions: rankedDimensions(canonical),
    missingness: rankedDimensions(canonical).length === 0
      ? ['RANKED_BEHAVIORAL_DIMENSIONS_UNAVAILABLE']
      : [],
  };
}

function contractNode(node, classification) {
  return {
    classification,
    current: sanitizeValue(node?.current),
    confidence: Number.isFinite(node?.confidence) ? node.confidence : null,
    evidence_references: Array.isArray(node?.evidence_sources)
      ? node.evidence_sources.slice(0, 20)
      : [],
    fallback_used: node?.fallback_used === true,
    intelligence_status: safeText(node?.intelligence_status, 120),
    missing: node?.current == null || node?.fallback_used === true,
    last_updated: safeText(node?.last_updated, 64),
  };
}

function assessmentProjection(contract) {
  return {
    source_class: 'CANONICAL_BUSINESS_ASSESSMENT',
    snapshot_mode: contract?.contract_metadata?.snapshot_mode === true,
    generated_at: contract?.contract_metadata?.generated_at || null,
    current_business_reality: contractNode(
      contract?.current_business_reality,
      'OBSERVED',
    ),
    business_model_alignment: contractNode(
      contract?.business_model_alignment,
      'INFERRED',
    ),
    primary_constraint: contractNode(contract?.primary_constraint, 'INFERRED'),
    behavioral_modifier: contractNode(contract?.behavioral_modifier, 'INFERRED'),
    assessment_is_historical_context: true,
  };
}

function currentStateProjection(snapshot) {
  const state = snapshot?.durable_runtime?.business_engine_state || {};
  return {
    source_class: 'LIVING_BUSINESS_ENGINE',
    business_engine_state_id: state.business_engine_state_id || null,
    state_version: state.state_version || null,
    as_of_at: state.as_of_at || null,
    current_operating_state: sanitizeValue(state.current_operating_state),
    financial_reality: sanitizeValue(state.financial_reality),
    behavioral_reality: sanitizeValue(state.behavioral_reality),
    business_model_alignment: sanitizeValue(state.business_model_alignment),
    constraint_reality: sanitizeValue(state.constraint_reality),
    trend_summary: safeText(state.trend_summary, 300),
    primary_constraint_id: state.primary_constraint_id || null,
  };
}

function historyProjection(snapshot) {
  const state = snapshot?.durable_runtime?.business_engine_state || {};
  const version = snapshot?.durable_runtime?.business_engine_state_version || {};
  return {
    current_state_version_id: version.state_version_id || null,
    previous_state_version_id: version.previous_state_version_id || null,
    previous_state: sanitizeValue(state.current_operating_state?.previous),
    historical_comparison: sanitizeValue(state.historical_comparison),
    material_changes: sanitizeValue(version.material_changes || []),
    changed_fields: sanitizeValue(version.changed_fields || []),
    unchanged_fields: sanitizeValue(version.unchanged_fields || []),
  };
}

function futureProjection(snapshot) {
  const future = snapshot?.predictive_runtime?.future_engine || {};
  return {
    future_set_version: future.future_set_version || null,
    explanation_summary: safeText(future.explanation_trace?.safe_summary, 1000),
    human_review_required: future.human_review_required === true,
    futures: (future.versions || []).slice(0, 5).map((entry) => ({
      stable_future_identity: entry.stable_future_identity,
      slot: entry.slot,
      name: safeText(entry.name, 200),
      status: entry.status,
      description: safeText(entry.description, 600),
      probability: entry.probability,
      probability_confidence: sanitizeValue(entry.probability_confidence),
      uncertainty_band: sanitizeValue(entry.uncertainty_band),
      expected_consequence: safeText(entry.expected_consequence, 600),
      structural_change_required: entry.structural_change_required === true,
      what_increases_probability: sanitizeValue(entry.what_increases_probability),
      what_decreases_probability: sanitizeValue(entry.what_decreases_probability),
      missing_evidence: sanitizeValue(entry.missing_evidence),
    })),
  };
}

function oneMoveProjection(snapshot) {
  const oneMove = snapshot?.predictive_runtime?.one_move;
  const ranking = snapshot?.predictive_runtime?.intervention_ranking;
  if (!oneMove) {
    return {
      available: false,
      reason: ranking?.receipt?.human_review_required
        ? 'HUMAN_REVIEW_REQUIRED'
        : 'NO_ELIGIBLE_ONE_MOVE',
    };
  }
  return {
    available: true,
    one_move_id: oneMove.one_move_id,
    candidate_id: oneMove.candidate_id,
    status: oneMove.status,
    target_constraint: safeText(oneMove.target_constraint, 600),
    target_future_transition: safeText(oneMove.target_future_transition, 600),
    expected_probability_shift: oneMove.expected_probability_shift,
    expected_business_effect: sanitizeValue(oneMove.expected_business_effect),
    expected_signal_window: sanitizeValue(oneMove.expected_signal_window),
    expected_outcome_window: sanitizeValue(oneMove.expected_outcome_window),
    confidence_dimensions: sanitizeValue(oneMove.confidence_dimensions),
    explanation_trace_ref: oneMove.explanation_trace_ref || null,
    human_review_required: ranking?.receipt?.human_review_required === true,
  };
}

function evidenceProjection(snapshot) {
  const durable = snapshot?.durable_runtime || {};
  return {
    evidence_references: (durable.business_engine_state?.evidence_ids || []).slice(0, 40),
    confidence: sanitizeValue(durable.confidence_state),
    evidence_gaps: (durable.evidence_gaps || []).slice(0, 20).map((gap) => ({
      evidence_gap_id: gap.evidence_gap_id,
      gap_type: gap.gap_type,
      missing_data: sanitizeValue(gap.missing_data),
      priority: gap.priority,
      request_reason: safeText(gap.request_reason, 600),
      recommended_question: safeText(gap.recommended_question, 600),
    })),
    explanation: {
      evidence_inputs: sanitizeValue(durable.explanation_trace?.evidence_inputs),
      changed_outputs: sanitizeValue(durable.explanation_trace?.changed_outputs),
      unchanged_outputs: sanitizeValue(durable.explanation_trace?.unchanged_outputs),
      human_review_required: durable.explanation_trace?.human_review_required === true,
      safe_summary: sanitizeValue(durable.explanation_trace?.safe_summary),
    },
  };
}

function truthProjection(contract, snapshot) {
  return {
    truth_boundaries: contractNode(contract?.truth_boundaries, 'KNOWN'),
    assessment_inference_is_not_current_fact: true,
    future_is_modeled_not_predicted: true,
    model_output_is_proposal_only: true,
    proposed_evidence_requires_subscriber_confirmation: true,
    causal_proof_not_claimed: true,
    unresolved_conflicts: sanitizeValue(
      snapshot?.durable_runtime?.explanation_trace?.conflicts || [],
    ),
  };
}

function item(type, value, exactScope) {
  return {
    context_id: `living_context_${type.toLowerCase()}`,
    context_type: type,
    value,
    privacy_classification: 'TENANT_PRIVATE',
    scope_match: exactPrivateRuntimeScope(exactScope),
  };
}

function exactObjectScope(value, exactScope, { profileRequired = true } = {}) {
  return object(value)
    && value.tenant_id === exactScope.tenant_id
    && value.business_id === exactScope.business_id
    && (!profileRequired || value.profile_id === exactScope.profile_id)
    && (value.profile_id == null || value.profile_id === exactScope.profile_id);
}

function compactReferences(values) {
  return [...new Set(values.filter((value) =>
    typeof value === 'string' && value.length > 0 && value.length <= 256))].sort();
}

function referenceRegistry(businessEngineContract, snapshot) {
  const durable = snapshot.durable_runtime;
  const predictive = snapshot.predictive_runtime;
  const contractReferences = [
    businessEngineContract.current_business_reality,
    businessEngineContract.business_model_alignment,
    businessEngineContract.primary_constraint,
    businessEngineContract.behavioral_modifier,
    businessEngineContract.truth_boundaries,
  ].flatMap((node) => Array.isArray(node?.evidence_sources)
    ? node.evidence_sources
    : []);
  const evidenceReferences = compactReferences([
    ...contractReferences,
    ...(durable.business_engine_state?.evidence_ids || []),
    durable.explanation_trace?.explanation_trace_id,
    durable.business_engine_state?.business_engine_state_id,
    durable.business_engine_state_version?.state_version_id,
  ]);
  const gapReferences = compactReferences((durable.evidence_gaps || [])
    .map((gap) => gap.evidence_gap_id));
  const futures = (predictive.future_engine?.versions || []).map((future) => ({
    stable_future_identity: future.stable_future_identity,
    slot: future.slot,
  })).filter((future) => typeof future.stable_future_identity === 'string'
    && typeof future.slot === 'string');
  const oneMoveReferences = compactReferences([
    predictive.one_move?.one_move_id,
  ]);
  return frozen({
    evidence_references: compactReferences([
      ...evidenceReferences,
      ...gapReferences,
      ...futures.map((future) => future.stable_future_identity),
      ...oneMoveReferences,
    ]),
    gap_references: gapReferences,
    future_references: futures,
    one_move_references: oneMoveReferences,
  });
}

export function assembleLivingConversationContextV1({
  dossier,
  businessEngineContract,
  snapshot,
  exactScope,
  expectedScopeHash,
} = {}) {
  const dossierProfileId = canonicalProfile(dossier)?.profile_id
    || dossier?.profile_id;
  const contractProfileId = businessEngineContract?.identity?.profile_id
    || dossierProfileId;
  const livingState = snapshot?.durable_runtime?.business_engine_state;
  const livingStateVersion = snapshot?.durable_runtime?.business_engine_state_version;
  if (!exactPrivateRuntimeScope(exactScope)
    || !object(dossier)
    || !object(businessEngineContract)
    || !object(snapshot?.durable_runtime)
    || !object(snapshot?.predictive_runtime)
    || typeof expectedScopeHash !== 'string'
    || !/^[a-f0-9]{64}$/.test(expectedScopeHash)
    || snapshot?.exact_scope_hash !== expectedScopeHash
    || typeof dossierProfileId !== 'string'
    || typeof contractProfileId !== 'string'
    || dossierProfileId.toLowerCase() !== exactScope.profile_id.toLowerCase()
    || contractProfileId.toLowerCase() !== exactScope.profile_id.toLowerCase()) {
    return frozen({
      ok: false,
      code: 'LIVING_CONVERSATION_CONTEXT_INVALID',
    });
  }
  if (!exactObjectScope(livingState, exactScope)
    || !exactObjectScope(livingStateVersion, exactScope)) {
    return frozen({
      ok: false,
      code: 'LIVING_CONVERSATION_CONTEXT_INVALID',
    });
  }
  const context = [
    item('BOS_CONVERSATION_CONTEXT', bosProjection(dossier), exactScope),
    item('BUSINESS_ASSESSMENT_CONTEXT', assessmentProjection(businessEngineContract), exactScope),
    item('BUSINESS_ENGINE_CURRENT_STATE', currentStateProjection(snapshot), exactScope),
    item('BUSINESS_ENGINE_HISTORY', historyProjection(snapshot), exactScope),
    item('FIVE_FUTURES_CONTEXT', futureProjection(snapshot), exactScope),
    item('ONE_MOVE_CONTEXT', oneMoveProjection(snapshot), exactScope),
    item('EVIDENCE_CONFIDENCE_CONTEXT', evidenceProjection(snapshot), exactScope),
    item('TRUTH_BOUNDARIES_CONTEXT', truthProjection(businessEngineContract, snapshot), exactScope),
  ];
  const serialized = JSON.stringify(context);
  if (serialized.length > MAX_CONTEXT_CHARS) {
    return frozen({
      ok: false,
      code: 'LIVING_CONVERSATION_CONTEXT_INVALID',
    });
  }
  const contextHash = hashCanonicalJson(context);
  return frozen({
    ok: true,
    context_version: LIVING_CONVERSATION_CONTEXT_VERSION,
    context,
    reference_registry: referenceRegistry(businessEngineContract, snapshot),
    receipt: {
      context_version: LIVING_CONVERSATION_CONTEXT_VERSION,
      context_hash: contextHash,
      context_types: CONTEXT_TYPES,
      item_count: context.length,
      exact_scope_hash: expectedScopeHash,
      coach_private_content_included: false,
      raw_dossier_included: false,
      raw_assessment_answers_included: false,
      transcript_included: false,
    },
  });
}

export { CONTEXT_TYPES, MAX_CONTEXT_CHARS };
