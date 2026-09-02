import { deepFreeze } from '../../intelligenceFabric/validation.js';

const DAY_MS = 86_400_000;
const clone = (value) => JSON.parse(JSON.stringify(value));

function iso(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function elapsedDays(from, to) {
  if (!iso(from) || !iso(to)) return null;
  return Math.max(0, Math.round(((Date.parse(to) - Date.parse(from)) / DAY_MS) * 10) / 10);
}

function cadencePerMonth(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return null;
  if (/\b(?:once|one|1)\b[^.]{0,24}\bmonth\b/u.test(text) || /\bmonthly\b/u.test(text)) return 1;
  if (/\b(?:twice|two|2)\b[^.]{0,24}\bmonth\b/u.test(text) || /\bevery other week\b/u.test(text) || /\bbiweekly\b/u.test(text)) return 2;
  if (/\b(?:three|3)\b[^.]{0,24}\bmonth\b/u.test(text)) return 3;
  if (/\b(?:four|4)\b[^.]{0,24}\bmonth\b/u.test(text) || /\b(?:approximately\s+)?weekly\b/u.test(text)) return 4;
  return null;
}

function eventFromRecord(record) {
  return record?.event && typeof record.event === 'object' ? record.event : record;
}

function eventItems(event) {
  return Array.isArray(event?.semantic_payload?.items) ? event.semantic_payload.items : [];
}

function activeRslEvents(records) {
  return (Array.isArray(records) ? records : [])
    .map(eventFromRecord)
    .filter((event) => event?.effective_at && event?.recorded_at)
    .sort((left, right) => left.effective_at.localeCompare(right.effective_at) || left.recorded_at.localeCompare(right.recorded_at));
}

function cadenceState(events) {
  const candidates = events.flatMap((event) => eventItems(event)
    .filter((item) => item?.field === 'evidence.coaching_cadence_preference')
    .map((item) => ({ event, value: String(item.value || '').trim() })))
    .filter((entry) => entry.value);
  const selected = candidates.at(-1) || null;
  const sessionsPerMonth = selected ? cadencePerMonth(selected.value) : 4;
  return {
    customer_preference: selected?.value || null,
    sessions_per_month: sessionsPerMonth,
    approximate_interval_days: sessionsPerMonth ? Math.round((30.4375 / sessionsPerMonth) * 10) / 10 : null,
    source: selected ? 'AUTHORIZED_PERSONAL_RSL_CADENCE_PREFERENCE' : 'DEFAULT_SUBSCRIPTION_PRODUCT_INTENT',
    source_effective_at: iso(selected?.event?.effective_at),
    customer_confirmed: Boolean(selected),
    regularity_over_frequency: true,
  };
}

function nextWindow(lastEnd, cadence) {
  if (!lastEnd || !cadence.approximate_interval_days) return null;
  const center = Date.parse(lastEnd) + cadence.approximate_interval_days * DAY_MS;
  const toleranceDays = Math.max(2, Math.round(cadence.approximate_interval_days * 0.25));
  return {
    starts_at: new Date(center - toleranceDays * DAY_MS).toISOString(),
    target_at: new Date(center).toISOString(),
    ends_at: new Date(center + toleranceDays * DAY_MS).toISOString(),
    interpretation: 'Approximate continuity window from governed cadence, not an attendance deadline.',
  };
}

function datedMeaning(events) {
  return events
    .filter((event) => ['COMMITMENT', 'INTERVENTION', 'OUTCOME', 'STATE_CHANGE', 'DECISION', 'LEARNING'].includes(event.event_type)
      || eventItems(event).some((item) => /^(?:commitment\.|evidence\.(?:attempt|outcome|execution_outcome|operating_change|changed_reality|state_change))/u.test(item.field)))
    .slice(-20)
    .map((event) => {
      const items = eventItems(event).map((item) => ({ field: item.field, value: item.value }));
      const dueDate = items.map((item) => String(item.value || '').match(/\b\d{4}-\d{2}-\d{2}\b/u)?.[0]).find(Boolean) || null;
      return {
        type: event.event_type || 'GOVERNED_MEANING',
        effective_at: iso(event.effective_at),
        recorded_at: iso(event.recorded_at),
        due_date: dueDate && iso(`${dueDate}T23:59:59.999Z`),
        summary: event.semantic_payload?.summary || null,
        items,
        provenance: 'AUTHORIZED_PERSONAL_RSL_EVENT',
      };
    });
}

function persistedReality(artifacts, asOfAt) {
  const byType = new Map((Array.isArray(artifacts) ? artifacts : []).map((artifact) => [artifact.artifact_type, artifact]));
  const selections = [
    ['VISION_OR_GOAL', byType.get('PLAN_135')?.payload?.goal, byType.get('PLAN_135')],
    ['CONSTRAINT', byType.get('WHOLE_BUSINESS_MODEL_V1')?.payload?.governing_constraint_hypothesis || byType.get('WHOLE_BUSINESS_MODEL_V1')?.payload?.governing_constraint, byType.get('WHOLE_BUSINESS_MODEL_V1')],
    ['ONE_MOVE', byType.get('ONE_MOVE_V2')?.payload?.title, byType.get('ONE_MOVE_V2')],
  ];
  return selections.filter(([, value, artifact]) => value && artifact?.created_at).map(([kind, value, artifact]) => ({
    kind,
    governed_value: value,
    established_at: iso(artifact.created_at),
    persisted_days: elapsedDays(artifact.created_at, asOfAt),
    provenance: `${artifact.artifact_type}_CANONICAL_ARTIFACT`,
  }));
}

export function assembleTemporalCoachingState({
  as_of_at,
  session_history = [],
  current_session_id = null,
  personal_rsl_records = [],
  canonical_artifacts = [],
  current_publication = null,
} = {}) {
  const currentAt = iso(as_of_at);
  if (!currentAt) throw new TypeError('SUBSCRIPTION_S1_1_TEMPORAL_AS_OF_REQUIRED');
  const completed = (Array.isArray(session_history) ? session_history : [])
    .filter((session) => session?.session_id !== current_session_id && session?.charge_point_reached && session?.ended_at)
    .sort((left, right) => right.ended_at.localeCompare(left.ended_at));
  const lastSession = completed[0] || null;
  const events = activeRslEvents(personal_rsl_records);
  const cadence = cadenceState(events);
  const lastEnd = iso(lastSession?.ended_at);
  const materialChanges = events.filter((event) => lastEnd && Date.parse(event.recorded_at) > Date.parse(lastEnd));
  const state = {
    contract: 'SUBSCRIPTION_FLAGSHIP_S1_1_TEMPORAL_STATE_V1',
    current_time: currentAt,
    clock_source: 'DETERMINISTIC_SERVER_RUNTIME',
    timezone: 'UTC',
    last_coaching_session: lastSession ? {
      allowance_activation_at: iso(lastSession.activated_at),
      ended_at: lastEnd,
      elapsed_days_since_end: elapsedDays(lastEnd, currentAt),
      start_time_semantics: 'Allowance activation is the best currently persisted start timestamp; exact semantic first-engagement time is not yet durable.',
      provenance: 'DURABLE_ALLOWANCE_SESSION_LEDGER',
    } : null,
    coaching_cadence: cadence,
    expected_next_session_window: nextWindow(lastEnd, cadence),
    dated_commitments_attempts_outcomes: datedMeaning(events),
    material_governed_changes_since_previous_session: materialChanges.map((event) => ({
      type: event.event_type,
      effective_at: iso(event.effective_at),
      recorded_at: iso(event.recorded_at),
      summary: event.semantic_payload?.summary || null,
      provenance: 'AUTHORIZED_PERSONAL_RSL_EVENT',
    })),
    material_business_twin_change_since_previous_session: lastEnd && current_publication?.published_at && Date.parse(current_publication.published_at) > Date.parse(lastEnd) ? {
      publication_version: current_publication.publication_version,
      published_at: iso(current_publication.published_at),
      interpretation: 'The governed Business Twin publication changed after the prior session. The publication alone does not establish which change matters to today’s purpose.',
      provenance: 'LIVING_BUSINESS_TWIN_PUBLICATION',
    } : null,
    important_reality_persistence: persistedReality(canonical_artifacts, currentAt),
    current_business_twin_publication: current_publication ? {
      publication_version: current_publication.publication_version,
      published_at: iso(current_publication.published_at),
      provenance: 'LIVING_BUSINESS_TWIN_PUBLICATION',
    } : null,
    missingness: {
      exact_semantic_prior_session_start: lastSession ? 'NOT_CURRENTLY_DURABLE' : 'NO_PRIOR_SUBSTANTIVE_SESSION',
      commitment_due_dates: 'PRESENT_ONLY_WHEN_EXPLICITLY_DATED_IN_GOVERNED_MEANING',
      temporal_history_fabricated: false,
      prior_business_twin_publication_binding: lastSession?.publication_version ? 'AVAILABLE' : 'NOT_CURRENTLY_BOUND_TO_ALLOWANCE_SESSION_LEDGER',
    },
  };
  return deepFreeze(clone(state));
}
