import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { recordExecutionEvidence, validateOutcome } from '../intelligenceFabric/runtime/outcomeValidation.js';
import { relationshipIdentityForScope, sameScope, scopeFingerprint, validateSubscriptionV1Contract } from './contracts.js';
import { createPersonalRslEvent } from './personalRsl.js';
import { InMemoryUniversalCandidateCapture } from './universalCandidates.js';
import { validateSessionLearningMeaning } from './sessionLearning.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const LINEAGE_ID = /^intervention_[a-f0-9]{24}$/u;
const EPISODE_EVENT_TYPES = new Set(['CUSTOMER_DISCUSSION', 'MORE_SUGGESTION', 'CUSTOMER_AGREEMENT', 'JOINT_AGREEMENT', 'SESSION_LEARNING']);

export const OPEN_LOOP_STATES = deepFreeze([
  'OPEN',
  'DUE',
  'ATTEMPTED',
  'COMPLETED',
  'MISSED',
  'INTELLIGENTLY_ABANDONED',
  'SUPERSEDED',
  'UNRESOLVED',
]);

export const EXECUTION_DEGREES = deepFreeze(['NOT_ATTEMPTED', 'PARTIAL', 'COMPLETE']);
export const OUTCOME_CLASSIFICATIONS = deepFreeze([
  'BENEFICIAL',
  'STERILE',
  'ADVERSE',
  'MIXED',
  'INCONCLUSIVE',
  'NOT_TESTED_INSUFFICIENT_EXECUTION',
  'CONFOUNDED',
  'INTELLIGENTLY_ABANDONED',
]);

function iso(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  } catch { /* A short semicolon-delimited value is an allowed customer-facing representation. */ }
  return value.split(';').map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function itemValues(items = []) {
  return new Map(items.map((item) => [item.field, item.value]));
}

function lineageValue(values, scope, businessField, athleteField) {
  return values.get(scope?.domain === 'ATHLETE' ? athleteField : businessField);
}

function lineageOf(event, derived = null) {
  const lineage = event?.semantic_payload?.lineage || derived?.get(event?.event_id)?.lineage;
  return lineage && LINEAGE_ID.test(lineage.intervention_lineage_id || '') ? lineage : null;
}

export function isAgreedIntervention(event, derived = null) {
  return event?.event_type === 'INTERVENTION' || (event?.event_type === 'CORRECTION'
    && lineageOf(event, derived)?.stage === 'CUSTOMER_AGREED'
    && event.semantic_payload?.items?.some((item) => item.field === (event.scope?.domain === 'ATHLETE'
      ? 'athlete_plan.intervention' : 'commitment.intervention')));
}


// Read-only repair for historical confirmed correction records. Keep the signed
// event and publication untouched; expose recovered tracking as attributed data.
export function deriveLegacyInterventionLineages({ scope, historical_events = [] }) {
  const derived = new Map();
  const events = historical_events;
  const ids = events.map(event => event?.event_id);
  if (new Set(ids).size !== ids.length || events.some(event => !sameScope(event?.scope, scope))) return derived;
  const valid = event => {
    if (!event || !validateSubscriptionV1Contract(event).valid) return false;
    const unsigned = clone(event); delete unsigned.content_hash;
    return event.content_hash === hashCanonicalJson(unsigned);
  };
  const confirmed = event => valid(event) && event.confirmation_event_id
    && event.confirmation_event_id === event.semantic_payload?.decision_id
    && event.establishing_authority?.authority_hash === event.semantic_payload?.decision_hash
    && ['CUSTOMER_SELF_REPORT', 'JOINT_HUMAN_AGREEMENT'].includes(event.source_class);
  const field = scope?.domain === 'ATHLETE' ? 'athlete_plan.intervention' : 'commitment.intervention';
  for (const [index, event] of events.entries()) {
    if (event?.event_type !== 'CORRECTION' || event.semantic_payload?.lineage != null
      || event.supersedes_event_ids?.length !== 1 || event.retracts_event_ids?.length
      || !valid(event) || !event.confirmation_event_id
      || event.confirmation_event_id !== event.semantic_payload?.decision_id
      || event.establishing_authority?.authority_hash !== event.semantic_payload?.decision_hash
      || !['CUSTOMER_SELF_REPORT', 'JOINT_HUMAN_AGREEMENT'].includes(event.source_class)) continue;
    const parentIndex = ids.indexOf(event.supersedes_event_ids[0]);
    if (parentIndex < 0 || parentIndex >= index) continue;
    const parent = events[parentIndex], inherited = lineageOf(parent, derived);
    if (!confirmed(parent) || !isAgreedIntervention(parent, derived) || inherited?.stage !== 'CUSTOMER_AGREED'
      || event.recorded_at < parent.recorded_at || event.effective_at < parent.effective_at
      || events.slice(parentIndex + 1, index).some(previous => [...(previous.supersedes_event_ids || []), ...(previous.retracts_event_ids || [])].includes(parent.event_id))) continue;
    const items = event.semantic_payload.items || [], previousItems = parent.semantic_payload?.items || [];
    if (!items.some(item => item.field === field && typeof item.value === 'string' && item.value.trim())
      || previousItems.some(item => !items.some(next => next.field === item.field))) continue;
    const sourceIds = [...(derived.get(parent.event_id)?.provenance.source_event_ids || [parent.event_id]), event.event_id];
    if (sourceIds.length > 32) continue;
    const values = itemValues(items), prefix = scope?.domain === 'ATHLETE' ? 'athlete_plan' : 'commitment';
    const value = key => values.get(`${prefix}.${key}`);
    const lineage = { ...clone(inherited), stage: 'CUSTOMER_AGREED',
      open_loop_state: normalizeLoopState(value('open_loop_state'), inherited.open_loop_state),
      due_at: values.has(`${prefix}.due_at`) ? iso(value('due_at')) : inherited.due_at,
      observation_window: {
        start: values.has(`${prefix}.observation_window_start`) ? iso(value('observation_window_start')) : inherited.observation_window?.start || null,
        end: values.has(`${prefix}.observation_window_end`) ? iso(value('observation_window_end')) : inherited.observation_window?.end || null,
      },
      falsifiers: values.has(`${prefix}.falsifiers`) ? stringList(value('falsifiers')) : clone(inherited.falsifiers || []),
    };
    derived.set(event.event_id, deepFreeze({ lineage, provenance: {
      basis: 'EXACT_CONFIRMED_CORRECTION_SUPERSESSION_CHAIN', derived_only: true,
      source_event_ids: sourceIds, source_content_hashes: sourceIds.map(id => events[ids.indexOf(id)].content_hash),
      stored_event_unchanged: true, stored_publication_unchanged: true,
    } }));
  }
  return derived;
}

function isObservation(event, type) {
  return event.event_type === type || (event.event_type === 'CORRECTION'
    && lineageOf(event)?.stage === (type === 'ATTEMPT' ? 'EXECUTION_OBSERVED' : 'OUTCOME_OBSERVED'));
}

function eventsForLineage(events, lineageId, derived = null) {
  return (events || []).filter((event) => lineageOf(event, derived)?.intervention_lineage_id === lineageId);
}

function normalizeLoopState(value, fallback) {
  const normalized = String(value || fallback || '').trim().toUpperCase().replaceAll(' ', '_');
  return OPEN_LOOP_STATES.includes(normalized) ? normalized : fallback;
}

function normalizeExecutionDegree(value) {
  const normalized = String(value || '').trim().toUpperCase().replaceAll(' ', '_');
  return EXECUTION_DEGREES.includes(normalized) ? normalized : null;
}

function normalizeOutcomeClassification(value) {
  const normalized = String(value || '').trim().toUpperCase().replace(/[ /-]+/gu, '_');
  return OUTCOME_CLASSIFICATIONS.includes(normalized) ? normalized : null;
}

export function createRelationshipEpisodeEvent({
  scope,
  session_id,
  event_type,
  summary,
  occurred_at,
  source_content_hash,
  proposal_id = null,
  decision_id = null,
  intervention_lineage_id = null,
  supersedes_episode_event_id = null,
  session_learning = null,
}) {
  if (!EPISODE_EVENT_TYPES.has(event_type)) return deepFreeze({ ok: false, code: 'RELATIONSHIP_EPISODE_EVENT_TYPE_INVALID' });
  if (typeof summary !== 'string' || !summary.trim() || summary.length > 1200) return deepFreeze({ ok: false, code: 'RELATIONSHIP_EPISODE_SUMMARY_INVALID' });
  if (!/^[a-f0-9]{64}$/u.test(source_content_hash || '')) return deepFreeze({ ok: false, code: 'RELATIONSHIP_EPISODE_SOURCE_HASH_REQUIRED' });
  if (intervention_lineage_id && !LINEAGE_ID.test(intervention_lineage_id)) return deepFreeze({ ok: false, code: 'RELATIONSHIP_EPISODE_LINEAGE_INVALID' });
  if (supersedes_episode_event_id && !/^episode_[a-f0-9]{24}$/u.test(supersedes_episode_event_id)) return deepFreeze({ ok: false, code: 'RELATIONSHIP_EPISODE_SUPERSESSION_INVALID' });
  if (session_learning !== null && (event_type !== 'SESSION_LEARNING' || !validateSessionLearningMeaning(session_learning))) {
    return deepFreeze({ ok: false, code: 'RELATIONSHIP_EPISODE_SESSION_LEARNING_INVALID' });
  }
  const learning = session_learning === null ? {} : { session_learning: clone(session_learning) };
  const supersession = supersedes_episode_event_id ? { supersedes_episode_event_id } : {};
  const body = {
    contract_id: 'subscription_relationship_episode_provenance_v1',
    schema_version: '1.0.0',
    episode_event_id: `episode_${hashCanonicalJson({ scope: scopeFingerprint(scope), session_id, event_type, summary, occurred_at, source_content_hash, proposal_id, decision_id, intervention_lineage_id, ...supersession, ...learning }).slice(0, 24)}`,
    scope: clone(scope),
    scope_hash: scopeFingerprint(scope),
    session_id,
    event_type,
    summary: summary.trim(),
    ...learning,
    source_content_hash,
    proposal_id,
    decision_id,
    intervention_lineage_id,
    ...supersession,
    occurred_at: new Date(occurred_at).toISOString(),
    canonical_customer_truth: false,
    personal_rsl_event: false,
    raw_customer_transcript_persisted: false,
    universal_learning_eligible: false,
  };
  return deepFreeze({ ok: true, code: 'RELATIONSHIP_EPISODE_EVENT_CREATED', event: { ...body, event_hash: hashCanonicalJson(body) } });
}

export function validateRelationshipEpisodeEvent(event, scope) {
  if (!event || event.contract_id !== 'subscription_relationship_episode_provenance_v1' || event.schema_version !== '1.0.0') return false;
  if (!sameScope(event.scope, scope) || event.scope_hash !== scopeFingerprint(scope) || !EPISODE_EVENT_TYPES.has(event.event_type)) return false;
  if (event.canonical_customer_truth !== false || event.personal_rsl_event !== false || event.raw_customer_transcript_persisted !== false) return false;
  if (Object.hasOwn(event, 'session_learning') && (event.event_type !== 'SESSION_LEARNING' || !validateSessionLearningMeaning(event.session_learning))) return false;
  const unsigned = clone(event);
  delete unsigned.event_hash;
  return event.event_hash === hashCanonicalJson(unsigned);
}

export function createConfirmedLineageMetadata({ proposal, decision, event_type, effective_items, active_events = [], historical_events = active_events }) {
  const derived = deriveLegacyInterventionLineages({ scope: proposal.scope, historical_events });
  let correctedInterventionLineageId = null;
  if (event_type === 'CORRECTION' && proposal.supersedes_event_ids?.length === 1) {
    const original = active_events.find((event) => event.event_id === proposal.supersedes_event_ids[0]);
    const stage = lineageOf(original, derived)?.stage;
    // Replace the agreed version without retiring its stable intervention identity.
    // A retirement or unrelated correction has no replacement intervention item.
    if (stage === 'CUSTOMER_AGREED' && isAgreedIntervention(original, derived)
      && effective_items.some((item) => item.field === (proposal.scope?.domain === 'ATHLETE'
        ? 'athlete_plan.intervention' : 'commitment.intervention'))) {
      if (!sameScope(original.scope, proposal.scope)) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_INTERVENTION_LINEAGE_NOT_FOUND' });
      correctedInterventionLineageId = lineageOf(original, derived)?.intervention_lineage_id || null;
      if (!correctedInterventionLineageId) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_INTERVENTION_LINEAGE_REQUIRED' });
      event_type = 'INTERVENTION';
    }
    // Keep the immutable CORRECTION event while preserving observation meaning.
    if (stage === 'EXECUTION_OBSERVED') event_type = 'ATTEMPT';
    if (stage === 'OUTCOME_OBSERVED') event_type = 'OUTCOME';
  }
  const values = itemValues(effective_items);
  if (event_type === 'INTERVENTION') {
    const interventionLineageId = correctedInterventionLineageId || `intervention_${hashCanonicalJson({ scope: proposal.scope_hash, proposal: proposal.proposal_hash, decision: decision.decision_hash }).slice(0, 24)}`;
    return deepFreeze({
      ok: true,
      lineage: {
        contract_id: 'subscription_personal_rsl_intervention_lineage_v1',
        intervention_lineage_id: interventionLineageId,
        stage: 'CUSTOMER_AGREED',
        open_loop_state: normalizeLoopState(lineageValue(values, proposal.scope, 'commitment.open_loop_state', 'athlete_plan.open_loop_state'), 'OPEN'),
        due_at: iso(lineageValue(values, proposal.scope, 'commitment.due_at', 'athlete_plan.due_at')),
        observation_window: {
          start: iso(lineageValue(values, proposal.scope, 'commitment.observation_window_start', 'athlete_plan.observation_window_start')),
          end: iso(lineageValue(values, proposal.scope, 'commitment.observation_window_end', 'athlete_plan.observation_window_end')),
        },
        execution_degree: 'NOT_ATTEMPTED',
        outcome_classification: null,
        confounders: [],
        external_shocks: [],
        falsifiers: stringList(lineageValue(values, proposal.scope, 'commitment.falsifiers', 'athlete_plan.falsifiers')),
        causal_confidence: 'UNASSESSED',
        requested_attribution: 'ASSOCIATED_ONLY',
        parent_intervention_event_id: null,
      },
    });
  }
  if (!['ATTEMPT', 'OUTCOME'].includes(event_type)) return deepFreeze({ ok: true, lineage: null });
  const interventionLineageId = String(lineageValue(values, proposal.scope, 'evidence.intervention_lineage_id', 'athlete_evidence.intervention_lineage_id') || '').trim();
  if (!LINEAGE_ID.test(interventionLineageId)) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_INTERVENTION_LINEAGE_REQUIRED' });
  const linked = eventsForLineage(active_events, interventionLineageId, derived);
  const intervention = linked.find(event => isAgreedIntervention(event, derived));
  if (!intervention || !sameScope(intervention.scope, proposal.scope)) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_INTERVENTION_LINEAGE_NOT_FOUND' });
  if (event_type === 'OUTCOME' && !linked.some((event) => isObservation(event, 'ATTEMPT'))) {
    return deepFreeze({ ok: false, code: 'PERSONAL_RSL_OUTCOME_REQUIRES_LINKED_EXECUTION' });
  }
  const inherited = lineageOf(intervention, derived);
  const executionDegree = event_type === 'ATTEMPT'
    ? normalizeExecutionDegree(lineageValue(values, proposal.scope, 'evidence.execution_degree', 'athlete_evidence.execution_degree'))
    : linked.map(event => lineageOf(event, derived)).find((lineage) => lineage?.stage === 'EXECUTION_OBSERVED')?.execution_degree || null;
  if (event_type === 'ATTEMPT' && !executionDegree) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_EXECUTION_DEGREE_REQUIRED' });
  const outcomeClassification = event_type === 'OUTCOME'
    ? normalizeOutcomeClassification(lineageValue(values, proposal.scope, 'evidence.outcome_classification', 'athlete_evidence.outcome_classification'))
    : null;
  if (event_type === 'OUTCOME' && !outcomeClassification) return deepFreeze({ ok: false, code: 'PERSONAL_RSL_OUTCOME_CLASSIFICATION_REQUIRED' });
  const confounders = stringList(lineageValue(values, proposal.scope, 'evidence.confounders', 'athlete_evidence.confounders'));
  const externalShocks = stringList(lineageValue(values, proposal.scope, 'evidence.external_shocks', 'athlete_evidence.external_shocks'));
  const requestedLoop = lineageValue(values, proposal.scope, 'evidence.open_loop_state', 'athlete_evidence.open_loop_state');
  const openLoopState = event_type === 'ATTEMPT'
    ? normalizeLoopState(requestedLoop, executionDegree === 'COMPLETE' ? 'COMPLETED' : 'ATTEMPTED')
    : normalizeLoopState(requestedLoop, confounders.length || externalShocks.length || ['INCONCLUSIVE', 'CONFOUNDED'].includes(outcomeClassification) ? 'UNRESOLVED' : 'COMPLETED');
  return deepFreeze({
    ok: true,
    lineage: {
      contract_id: 'subscription_personal_rsl_intervention_lineage_v1',
      intervention_lineage_id: interventionLineageId,
      stage: event_type === 'ATTEMPT' ? 'EXECUTION_OBSERVED' : 'OUTCOME_OBSERVED',
      open_loop_state: openLoopState,
      due_at: inherited?.due_at || null,
      observation_window: {
        start: iso(lineageValue(values, proposal.scope, 'evidence.observation_window_start', 'athlete_evidence.observation_window_start')) || inherited?.observation_window?.start || null,
        end: iso(lineageValue(values, proposal.scope, 'evidence.observation_window_end', 'athlete_evidence.observation_window_end')) || inherited?.observation_window?.end || null,
      },
      execution_degree: executionDegree,
      outcome_classification: outcomeClassification,
      confounders,
      external_shocks: externalShocks,
      falsifiers: stringList(lineageValue(values, proposal.scope, 'evidence.falsifiers', 'athlete_evidence.falsifiers')).length
        ? stringList(lineageValue(values, proposal.scope, 'evidence.falsifiers', 'athlete_evidence.falsifiers'))
        : inherited?.falsifiers || [],
      causal_confidence: 'UNASSESSED',
      requested_attribution: String(lineageValue(values, proposal.scope, 'evidence.requested_attribution', 'athlete_evidence.requested_attribution') || 'ASSOCIATED_ONLY').trim().toUpperCase(),
      parent_intervention_event_id: intervention.event_id,
    },
  });
}

export function createLinkedCausalReviewEvent({ scope, active_events, historical_events = active_events, outcome_event, event_id, recorded_at }) {
  const derived = deriveLegacyInterventionLineages({ scope, historical_events });
  const outcomeLineage = lineageOf(outcome_event);
  if (!outcomeLineage || outcomeLineage.stage !== 'OUTCOME_OBSERVED') return deepFreeze({ ok: false, code: 'LINEAGE_OUTCOME_EVENT_REQUIRED' });
  const linked = eventsForLineage(active_events, outcomeLineage.intervention_lineage_id, derived);
  const intervention = linked.find(event => isAgreedIntervention(event, derived));
  const attempt = [...linked].reverse().find((event) => isObservation(event, 'ATTEMPT'));
  if (!intervention || !attempt || !sameScope(intervention.scope, scope) || !sameScope(attempt.scope, scope) || !sameScope(outcome_event.scope, scope)) {
    return deepFreeze({ ok: false, code: 'LINEAGE_CAUSAL_REVIEW_SOURCE_CHAIN_INVALID' });
  }
  const attemptLineage = lineageOf(attempt);
  const actualAction = attempt.semantic_payload?.summary || 'A linked execution observation was recorded.';
  const scopeRef = scope?.domain === 'ATHLETE'
    ? { domain: 'ATHLETE', tenant_id: scope.tenant_id, profile_id: scope.profile_id, athlete_relationship_id: relationshipIdentityForScope(scope) }
    : { tenant_id: scope.tenant_id, business_id: relationshipIdentityForScope(scope), profile_id: scope.profile_id };
  const execution = recordExecutionEvidence({
    tenant_id: scope.tenant_id,
    scope_ref: scopeRef,
    intervention_id: outcomeLineage.intervention_lineage_id,
    planned_action: intervention.semantic_payload?.summary || (scope?.domain === 'ATHLETE' ? 'Jointly authorized Athlete intervention' : 'Customer-authorized intervention'),
    actual_action: actualAction,
    start_time: attempt.effective_at,
    completion_time: attemptLineage.execution_degree === 'COMPLETE' ? attempt.effective_at : null,
    execution_quality: attemptLineage.execution_degree === 'COMPLETE' ? 1 : 0.6,
    adherence: attemptLineage.execution_degree === 'COMPLETE' ? 1 : 0.5,
    privacy_classification: 'TENANT_PRIVATE',
    consent_basis: 'PERSONAL_COACHING_ONLY',
    supporting_artifacts: [],
    missing_execution_evidence: attemptLineage.execution_degree === 'PARTIAL' ? ['FULL_EXECUTION_NOT_ESTABLISHED'] : [],
    human_observation: { source_event_hash: attempt.content_hash },
  });
  if (!execution.ok) return execution;
  const classification = outcomeLineage.outcome_classification;
  const reviewed = validateOutcome({
    tenant_id: scope.tenant_id,
    intervention_id: outcomeLineage.intervention_lineage_id,
    execution: execution.record,
    as_of_at: recorded_at,
    expected_signal: { start: outcomeLineage.observation_window?.start || attempt.effective_at },
    expected_outcome: { end: outcomeLineage.observation_window?.end || outcome_event.effective_at },
    actual_outcome: { success: classification === 'BENEFICIAL' ? true : classification === 'ADVERSE' || classification === 'STERILE' ? false : null, classification },
    confounders: clone(outcomeLineage.confounders || []),
    external_shocks: clone(outcomeLineage.external_shocks || []),
    alternative_explanations: clone(outcomeLineage.falsifiers || []),
    matched_contexts: [],
    replicated_contexts: [],
    replication_count: 0,
    requested_attribution: ['ASSOCIATED_ONLY', 'TEMPORALLY_ALIGNED', 'MECHANISM_CONSISTENT'].includes(outcomeLineage.requested_attribution) ? outcomeLineage.requested_attribution : 'ASSOCIATED_ONLY',
    design_receipt: null,
    causal_authorization: null,
    privacy_classification: 'TENANT_PRIVATE',
    consent_basis: 'PERSONAL_COACHING_ONLY',
  });
  if (!reviewed.ok) return deepFreeze({ ok: false, code: 'LINEAGE_CAUSAL_REVIEW_DENIED', detail: reviewed.attribution?.attribution_status || null });
  return createPersonalRslEvent({
    event_id,
    scope,
    session_id: outcome_event.session_id,
    event_type: 'CONFIDENCE_CHANGE',
    effective_at: recorded_at,
    recorded_at,
    source_class: 'DETERMINISTIC_RUNTIME',
    actor: { actor_type: 'DETERMINISTIC_RUNTIME', actor_ref: 'subscription_outcome_validation_v1' },
    establishing_authority: {
      authority_id: `outcome_validation:${reviewed.record.outcome_validation_id}`,
      authority_version: '1.0.0',
      authority_hash: hashCanonicalJson(reviewed.record),
    },
    semantic_payload: {
      summary: 'The observed outcome remains bounded by its execution evidence, timing, confounders, and alternative explanations.',
      purpose: 'WEEKLY_COACHING',
      lens: 'EVIDENCE',
      privacy_classification: 'TENANT_PRIVATE',
      raw_transcript_persisted: false,
      derived_from_event_ids: [intervention.event_id, attempt.event_id, outcome_event.event_id],
      outcome_validation: {
        validation_status: reviewed.record.validation_status,
        attribution_status: reviewed.record.attribution_status,
        causal_confidence: reviewed.record.causal_confidence,
        counterfactual_status: reviewed.record.counterfactual_status,
        learning_eligibility: false,
      },
      lineage: {
        ...clone(outcomeLineage),
        stage: 'CAUSAL_REVIEW',
        causal_confidence: reviewed.record.causal_confidence,
        validation_status: reviewed.record.validation_status,
        attribution_status: reviewed.record.attribution_status,
      },
    },
    evidence_refs: [],
    supersedes_event_ids: [],
    retracts_event_ids: [],
    confirmation_event_id: null,
  });
}

function projectedLoopState(lineageEvents, asOfAt, derived = null) {
  const latest = lineageEvents.at(-1);
  const lineage = lineageOf(latest, derived);
  if (!lineage) return 'UNRESOLVED';
  if (['INTELLIGENTLY_ABANDONED', 'SUPERSEDED', 'UNRESOLVED'].includes(lineage.open_loop_state)) return lineage.open_loop_state;
  const attempts = lineageEvents.filter((event) => isObservation(event, 'ATTEMPT'));
  const outcomes = lineageEvents.filter((event) => isObservation(event, 'OUTCOME'));
  if (outcomes.length) return lineage.open_loop_state;
  if (attempts.length) {
    const degree = lineageOf(attempts.at(-1))?.execution_degree;
    if (degree === 'COMPLETE' && lineage.observation_window?.end && Date.parse(asOfAt) > Date.parse(lineage.observation_window.end)) return 'UNRESOLVED';
    return degree === 'COMPLETE' ? 'COMPLETED' : 'ATTEMPTED';
  }
  if (lineage.due_at) {
    const dueAt = Date.parse(lineage.due_at);
    const asOf = Date.parse(asOfAt);
    if (asOf >= dueAt && asOf <= dueAt + 86_400_000) return 'DUE';
    if (asOf > dueAt + 86_400_000) return 'MISSED';
  }
  return lineage.open_loop_state;
}

export function derivePrivateLongitudinalScorecard({ scope, active_events = [], historical_events = null, episode_events = [], as_of_at }) {
  const scopedActive = (active_events || []).filter((event) => sameScope(event.scope, scope));
  const history = Array.isArray(historical_events) ? historical_events : active_events;
  const scoped = (history || []).filter((event) => sameScope(event.scope, scope));
  if (scopedActive.length !== (active_events || []).length || scoped.length !== (history || []).length) return deepFreeze({ ok: false, code: 'LONGITUDINAL_SCORECARD_SCOPE_DENIED' });
  const derived = deriveLegacyInterventionLineages({ scope, historical_events: scoped });
  const activeEventIds = new Set(scopedActive.map((event) => event.event_id));
  const supersededEventIds = new Set(scopedActive.flatMap((event) => [...(event.supersedes_event_ids || []), ...(event.retracts_event_ids || [])]));
  const byLineage = new Map();
  for (const event of scoped) {
    const lineage = lineageOf(event, derived);
    if (!lineage) continue;
    const list = byLineage.get(lineage.intervention_lineage_id) || [];
    list.push(event);
    byLineage.set(lineage.intervention_lineage_id, list);
  }
  const interventions = [...byLineage.entries()].map(([lineageId, events]) => {
    const ordered = events.sort((left, right) => left.effective_at.localeCompare(right.effective_at) || left.recorded_at.localeCompare(right.recorded_at));
    const currentIntervention = [...ordered].reverse().find((event) => activeEventIds.has(event.event_id) && isAgreedIntervention(event, derived));
    const intervention = currentIntervention || ordered.find(event => isAgreedIntervention(event, derived));
    const correctedIntervention = ordered.some((event) => event.event_type === 'CORRECTION' && isAgreedIntervention(event, derived));
    const correctedObservation = ordered.some((event) => event.event_type === 'CORRECTION' && (isObservation(event, 'ATTEMPT') || isObservation(event, 'OUTCOME')));
    const currentObservations = (correctedObservation || correctedIntervention) ? ordered.filter((event) => activeEventIds.has(event.event_id)) : ordered;
    const attempts = currentObservations.filter((event) => isObservation(event, 'ATTEMPT'));
    const outcomes = currentObservations.filter((event) => isObservation(event, 'OUTCOME'));
    const reviews = ordered.filter((event) => lineageOf(event)?.stage === 'CAUSAL_REVIEW');
    return {
      intervention_lineage_id: lineageId,
      decided: intervention?.semantic_payload?.summary || null,
      ...(derived.has(intervention?.event_id) ? { lineage_recovery: clone(derived.get(intervention.event_id).provenance) } : {}),
      ...(scope?.domain === 'ATHLETE' ? { original_reason: intervention?.semantic_payload?.original_reason || null } : {}),
      agreed_at: intervention?.effective_at || null,
      actually_tried: attempts.map((event) => ({ summary: event.semantic_payload?.summary || null, at: event.effective_at, degree: lineageOf(event)?.execution_degree || null })),
      what_happened: outcomes.map((event) => ({ summary: event.semantic_payload?.summary || null, at: event.effective_at, classification: lineageOf(event)?.outcome_classification || null })),
      causal_reviews: reviews.map((event) => ({ at: event.effective_at, validation_status: event.semantic_payload?.outcome_validation?.validation_status || null, attribution_status: event.semantic_payload?.outcome_validation?.attribution_status || null, confidence: event.semantic_payload?.outcome_validation?.causal_confidence || null })),
      open_loop_state: correctedIntervention && currentIntervention ? projectedLoopState(currentObservations, as_of_at, derived)
        : ordered.some((event) => supersededEventIds.has(event.event_id) && (!correctedObservation || isAgreedIntervention(event, derived))) ? 'SUPERSEDED' : projectedLoopState(currentObservations, as_of_at, derived),
      due_at: lineageOf(intervention, derived)?.due_at || null,
      observation_window: clone(lineageOf(intervention, derived)?.observation_window || { start: null, end: null }),
      remains_uncertain: !outcomes.length || !reviews.length || reviews.some((event) => ['CONFOUNDED', 'ASSOCIATED_ONLY'].includes(event.semantic_payload?.outcome_validation?.attribution_status)),
      source_event_ids: ordered.map((event) => event.event_id),
      active_source_event_ids: ordered.filter((event) => activeEventIds.has(event.event_id)).map((event) => event.event_id),
      superseded_source_event_ids: ordered.filter((event) => supersededEventIds.has(event.event_id)).map((event) => event.event_id),
    };
  });
  const contradictions = scopedActive.filter((event) => event.event_type === 'CONTRADICTION_OPENED').map((event) => ({ event_id: event.event_id, summary: event.semantic_payload?.summary || null }));
  const corrections = scopedActive.filter((event) => ['CORRECTION', 'EVIDENCE_CORRECTED', 'RETRACTION'].includes(event.event_type)).map((event) => ({ event_id: event.event_id, summary: event.semantic_payload?.summary || null, supersedes_event_ids: event.supersedes_event_ids, retracts_event_ids: event.retracts_event_ids }));
  const privateEpisodes = (episode_events || []).filter((event) => validateRelationshipEpisodeEvent(event, scope));
  const body = {
    contract_id: 'subscription_private_longitudinal_scorecard_v1',
    schema_version: '1.0.0',
    scope_hash: scopeFingerprint(scope),
    as_of_at: new Date(as_of_at).toISOString(),
    interventions,
    decisions: scoped.filter((event) => ['DECISION', 'COMMITMENT', 'INTERVENTION'].includes(event.event_type) || isAgreedIntervention(event, derived)).map((event) => ({ event_id: event.event_id, type: event.event_type, summary: event.semantic_payload?.summary || null, effective_at: event.effective_at, current: activeEventIds.has(event.event_id) })),
    corrections,
    unresolved_contradictions: contradictions,
    episode_provenance_count: privateEpisodes.length,
    month_12_answers: {
      what_did_we_decide: interventions.map((item) => item.decided).filter(Boolean),
      what_did_you_actually_try: interventions.flatMap((item) => item.actually_tried),
      what_happened: interventions.flatMap((item) => item.what_happened),
      what_changed: corrections,
      what_remains_uncertain: interventions.filter((item) => item.remains_uncertain).map((item) => ({ intervention_lineage_id: item.intervention_lineage_id, open_loop_state: item.open_loop_state })),
    },
    derived_only: true,
    second_truth_store: false,
    raw_transcript_required: false,
    universal_runtime_read_enabled: false,
    universal_promotion_enabled: false,
  };
  return deepFreeze({ ok: true, code: 'PRIVATE_LONGITUDINAL_SCORECARD_DERIVED', scorecard: { ...body, projection_hash: hashCanonicalJson(body) } });
}

export function derivePrivacySafeFutureLearningCandidates({ scope, active_events = [], as_of_at }) {
  const capture = new InMemoryUniversalCandidateCapture();
  const scorecard = derivePrivateLongitudinalScorecard({ scope, active_events, episode_events: [], as_of_at });
  if (!scorecard.ok) return scorecard;
  const byId = new Map(active_events.map((event) => [event.event_id, event]));
  const candidates = [];
  for (const lineage of scorecard.scorecard.interventions) {
    const events = lineage.source_event_ids.map((id) => byId.get(id)).filter(Boolean);
    if (!events.some((event) => ['OUTCOME', 'CONFIDENCE_CHANGE', 'VALIDATION', 'FALSIFICATION'].includes(event.event_type))) continue;
    const outcome = lineage.what_happened.at(-1);
    const captured = capture.capture({
      scope,
      source_events: events,
      condition: { condition_class: 'PRIVATE_CONTEXT_REDACTED' },
      intervention: { intervention_class: 'CUSTOMER_AUTHORIZED_BOUNDED_ACTION' },
      execution_context: { execution_degree: lineage.actually_tried.at(-1)?.degree || 'NOT_ATTEMPTED' },
      outcome: { outcome_classification: outcome?.classification || 'INCONCLUSIVE' },
      outcome_direction: outcome?.classification === 'BENEFICIAL' ? 'POSITIVE' : outcome?.classification === 'ADVERSE' || outcome?.classification === 'STERILE' ? 'NEGATIVE' : outcome?.classification === 'CONFOUNDED' ? 'CONFOUNDED' : 'UNRESOLVED',
      validation_state: lineage.causal_reviews.at(-1)?.validation_status || 'PENDING',
      confounders: lineage.causal_reviews.at(-1)?.attribution_status === 'CONFOUNDED' ? ['PRESENT_REDACTED'] : [],
      falsifiers: [],
      privacy_policy_ref: null,
      eligibility_policy_ref: null,
      created_at: as_of_at,
    });
    if (!captured.ok) return captured;
    candidates.push(captured.candidate);
  }
  return deepFreeze({
    ok: true,
    code: 'PRIVACY_SAFE_FUTURE_LEARNING_CANDIDATES_DERIVED',
    candidates,
    direct_customer_identifiers_present: false,
    private_customer_truth_present: false,
    universal_runtime_read_enabled: false,
    universal_promotion_enabled: false,
  });
}
