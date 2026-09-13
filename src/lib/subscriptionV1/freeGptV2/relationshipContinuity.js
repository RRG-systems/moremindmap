import { deepFreeze } from '../../intelligenceFabric/validation.js';
import { OUTCOME_CLASSIFICATIONS, validateRelationshipEpisodeEvent } from '../lineage.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const POSITIVE_OUTCOMES = new Set(['BENEFICIAL', 'POSITIVE', 'POSSIBLE_POSITIVE']);

function iso(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function eventItems(event) {
  return Array.isArray(event?.semantic_payload?.items) ? event.semantic_payload.items : [];
}

function semanticEvent(event) {
  return {
    kind: event.event_type || 'GOVERNED_MEANING',
    effective_at: iso(event.effective_at),
    recorded_at: iso(event.recorded_at),
    summary: event.semantic_payload?.summary || null,
    items: eventItems(event).map(({ field, value }) => ({ field, value })),
    attribution: 'AUTHORIZED_PERSONAL_RSL',
    provenance: 'ACTIVE_EXACT_SCOPE_PERSONAL_RSL_EVENT',
  };
}

function isCommitment(event) {
  return event.event_type === 'COMMITMENT' || eventItems(event).some((item) => item?.field === 'commitment.action');
}

function isAttempt(event) {
  return event.event_type === 'INTERVENTION' || eventItems(event).some((item) => /^evidence\.(?:attempt|experiment)$/u.test(item?.field || ''));
}

function isOutcome(event) {
  return event.event_type === 'OUTCOME' || eventItems(event).some((item) => /^evidence\.(?:outcome|execution_outcome|operating_change|changed_reality|state_change)$/u.test(item?.field || ''));
}

function explicitOpenLoop(event) {
  return eventItems(event).some((item) => /(?:open_loop|deferred|revisit|unresolved|evidence_awaited)/u.test(item?.field || ''));
}

function outcomeDirection(event) {
  const explicit = String(event.semantic_payload?.outcome_direction || '').toUpperCase();
  if (['POSITIVE', 'IMPROVED', 'COMPLETED', 'SUCCESS'].includes(explicit)) return 'POSITIVE';
  if (OUTCOME_CLASSIFICATIONS.includes(explicit) || ['NEGATIVE', 'POSSIBLE_POSITIVE'].includes(explicit)) return explicit;
  // Words such as "improved" or "completed" can appear in a negation or a
  // confounded report. Without explicit classification, preserve uncertainty.
  return 'UNCLASSIFIED';
}

function priorSessionLearning({ scope, current_session_id, records, as_of_at }) {
  const eligible = records.filter(({ event, appended_at }) => event?.event_type === 'SESSION_LEARNING'
    && event.session_id !== current_session_id && validateRelationshipEpisodeEvent(event, scope)
    && iso(event.occurred_at) && iso(appended_at)
    && Date.parse(event.occurred_at) <= Date.parse(as_of_at) && Date.parse(appended_at) <= Date.parse(as_of_at))
    .sort((left, right) => right.event.occurred_at.localeCompare(left.event.occurred_at)
      || right.appended_at.localeCompare(left.appended_at)
      || right.event.episode_event_id.localeCompare(left.event.episode_event_id));
  const selected = [];
  let characters = 0;
  for (const record of eligible) {
    const { event, appended_at } = record;
    const size = event.session_learning
      ? Object.values(event.session_learning).reduce((total, field) => total + field.length, 0)
      : event.summary.length;
    if (selected.length === 4 || characters + size > 8400) continue;
    characters += size;
    selected.push({
      episode_event_id: event.episode_event_id,
      event_hash: event.event_hash,
      source_content_hash: event.source_content_hash,
      session_id: event.session_id,
      occurred_at: iso(event.occurred_at),
      recorded_at: iso(appended_at),
      ...(event.session_learning ? { meaning: clone(event.session_learning) } : { summary: event.summary }),
      attribution: 'PRIOR_SESSION_CLOSING_NOTES',
      provenance: 'EXACT_SCOPE_IMMUTABLE_RELATIONSHIP_EPISODE',
      canonical_customer_truth: false,
      personal_rsl_event: false,
    });
  }
  return {
    notes: selected.reverse(),
    eligible_count: eligible.length,
    omitted_count: eligible.length - selected.length,
    selection: 'MOST_RECENT_PRIOR_SESSION_NOTES_WITHIN_BUDGET',
    maximum_notes: 4,
    maximum_meaning_characters: 8400,
    use: 'Remember these as dated session discussion and shared understanding, including uncertainty and unresolved questions. They do not authorize commitments or establish current customer facts. Current customer corrections and active Personal RSL take precedence; consult the current correction and outcome context before reusing older notes. Omitted notes are not proof that nothing else was discussed.',
    raw_transcript_required: false,
    second_truth_store: false,
  };
}

export function assembleRelationshipContinuityState({
  scope,
  current_session_id = null,
  relationship_episode_records = [],
  active_personal_rsl_events = [],
  pending_proposal = null,
  canonical_artifacts = [],
  longitudinal_scorecard = null,
  as_of_at,
} = {}) {
  const currentAt = iso(as_of_at);
  if (!currentAt) throw new TypeError('SUBSCRIPTION_S1_1_RELATIONSHIP_CONTINUITY_AS_OF_REQUIRED');
  const events = (Array.isArray(active_personal_rsl_events) ? active_personal_rsl_events : [])
    .filter((event) => event?.effective_at && event?.recorded_at)
    .sort((left, right) => left.effective_at.localeCompare(right.effective_at) || left.recorded_at.localeCompare(right.recorded_at));
  const outcomes = events.filter(isOutcome);
  const attempts = events.filter((event) => isCommitment(event) || isAttempt(event));
  const evidenceArtifact = canonical_artifacts.find((artifact) => artifact.artifact_type === 'EVIDENCE_LEDGER');
  const planArtifact = canonical_artifacts.find((artifact) => artifact.artifact_type === 'PLAN_135');
  const openLoops = [];
  if (pending_proposal) {
    openLoops.push({
      kind: 'DECISION_AWAITING_CUSTOMER_AUTHORIZATION',
      summary: pending_proposal.summary,
      status: 'OPEN',
      attribution: 'CURRENT_GOVERNED_PROPOSAL_WORKFLOW',
      provenance: 'EXACT_PENDING_PROPOSAL',
      canonical_truth: false,
    });
  }
  for (const event of events.filter(explicitOpenLoop).slice(-6)) {
    openLoops.push({ ...semanticEvent(event), status: 'EXPLICITLY_OPEN', canonical_truth: true });
  }
  const stableLineages = longitudinal_scorecard?.interventions || [];
  if (stableLineages.length) {
    for (const lineage of stableLineages.slice(-8)) {
      openLoops.push({
        kind: 'STABLE_INTERVENTION_LINEAGE',
        ...(lineage.lineage_recovery ? { tracking_recovery: clone(lineage.lineage_recovery) } : {}),
        intervention_lineage_id: lineage.intervention_lineage_id,
        summary: lineage.decided,
        status: lineage.open_loop_state,
        due_at: lineage.due_at,
        execution_observations: lineage.actually_tried,
        outcome_observations: lineage.what_happened,
        causal_reviews: lineage.causal_reviews,
        remains_uncertain: lineage.remains_uncertain,
        attribution: 'AUTHORIZED_LINKED_PERSONAL_RSL',
        provenance: 'DETERMINISTIC_INTERVENTION_LINEAGE',
        canonical_truth: true,
        automatic_closure_prohibited: false,
      });
    }
  } else {
    for (const event of attempts.slice(-6)) {
      openLoops.push({
        ...semanticEvent(event),
        status: 'LEGACY_UNLINKED_AWAITING_REPORTED_OUTCOME',
        canonical_truth: true,
        automatic_closure_prohibited: true,
        nearest_date_inference_used: false,
      });
    }
  }
  for (const missing of (evidenceArtifact?.payload?.missing || []).slice(0, 6)) {
    openLoops.push({
      kind: 'EVIDENCE_AWAITED',
      summary: missing,
      status: 'OPEN_EVIDENCE_GAP',
      attribution: 'CURRENT_BUSINESS_TWIN_EVIDENCE_LEDGER',
      provenance: 'CANONICAL_EVIDENCE_LEDGER',
      canonical_truth: true,
    });
  }
  const vision = planArtifact?.payload?.goal || null;
  const earnedProgress = stableLineages.length
    ? stableLineages.flatMap((lineage) => lineage.what_happened.map((outcome) => ({
      authorized_intervention: lineage.decided,
      execution_observations: lineage.actually_tried,
      observed_change: outcome,
      causal_reviews: lineage.causal_reviews,
      outcome_direction: outcome.classification || 'UNCLASSIFIED',
      relationship_to_vision: vision ? { governed_vision: vision, interpretation_required: true } : null,
      praise_is_not_warranted_without_specific_observed_movement: true,
      stable_lineage_used: true,
    })))
    : outcomes.map((outcome) => ({
      prior_attempt_or_commitment: null,
      observed_change: semanticEvent(outcome),
      outcome_direction: outcomeDirection(outcome),
      relationship_to_vision: vision ? { governed_vision: vision, interpretation_required: true } : null,
      praise_is_not_warranted_without_specific_observed_movement: true,
      stable_lineage_used: false,
      nearest_date_inference_used: false,
    }));
  const state = {
    contract: 'SUBSCRIPTION_FLAGSHIP_S1_1_RELATIONSHIP_CONTINUITY_V1',
    as_of_at: currentAt,
    prior_session_learning: priorSessionLearning({ scope, current_session_id, records: relationship_episode_records, as_of_at: currentAt }),
    open_loops: openLoops.slice(-12),
    open_loop_use: 'Surface at most one only when it is relevant now. An open loop is not automatically a new canonical fact.',
    earned_progress_evidence: earnedProgress,
    earned_progress_use: 'Recognize only specific governed movement: prior state, attempt, observed change, and relationship to Vision. Do not generate generic praise.',
    maintain_course_evidence: {
      observed_positive_or_possible_positive_outcomes: earnedProgress.filter((item) => POSITIVE_OUTCOMES.has(item.outcome_direction)),
      other_observed_outcomes: earnedProgress.filter((item) => !POSITIVE_OUTCOMES.has(item.outcome_direction)),
      current_counterevidence: clone(evidenceArtifact?.payload?.counterevidence || evidenceArtifact?.payload?.contradicted || []),
      current_missingness: clone(evidenceArtifact?.payload?.missing || []),
      frontier_judgment_required: true,
      continued_observation_is_a_valid_decision: true,
      manufacture_problem_or_intervention: false,
    },
    longitudinal_scorecard: longitudinal_scorecard ? {
      projection_hash: longitudinal_scorecard.projection_hash,
      intervention_count: longitudinal_scorecard.interventions.length,
      month_12_answers: clone(longitudinal_scorecard.month_12_answers),
      raw_transcript_required: false,
      second_truth_store: false,
    } : null,
    mutual_close: {
      required_before_full_close: true,
      current_alignment_status: 'NOT_YET_ESTABLISHED',
      human_can_correct_final_understanding: true,
      final_learning_must_reflect_shared_understanding: true,
      durable_write_requires_existing_governed_authorization: true,
      draft_learning_is_ephemeral_and_non_authoritative: true,
      future_s2_session_notes_gu_seam: 'PRESERVED_NOT_IMPLEMENTED_IN_S1_1',
    },
    orchestration_boundary: 'These are governed state and coaching principles, not dialogue rules, scripts, trees, or visible framework labels.',
  };
  return deepFreeze(clone(state));
}
