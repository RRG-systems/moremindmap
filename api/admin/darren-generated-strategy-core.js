import crypto from 'crypto';
import Redis from 'ioredis';
import { DARREN_PROFILE_ID, SNAPSHOT_VERSION } from './darren-intelligence-snapshot-core.js';

export const DARREN_STRATEGY_CONTEXT_TYPE = 'darren_leadership_intelligence';
export const DARREN_STRATEGY_GENERATION_VERSION = 'DARREN-FIVE-FUTURES-ONE-MOVE-V1';
export const DARREN_STRATEGY_PERSISTENCE_VERSION = 'generated_strategy_v1';
export const ONE_MOVE_STATUS_VERSION = 'one_move_status_v0';
export const OUTCOME_LEDGER_VERSION = 'outcome_ledger_v0';

export const ONE_MOVE_ACTIONS = new Set([
  'accept',
  'modify',
  'reject',
  'mark_planned',
  'mark_in_progress',
  'mark_completed',
  'mark_skipped',
  'mark_invalidated',
  'add_result_note'
]);

export const RESULT_SIGNAL_TYPES = new Set([
  'none',
  'customer_revenue',
  'partner_capital',
  'channel_distribution',
  'profile_volume',
  'assessment_volume',
  'RRG_opportunity',
  'follow_up_meeting',
  'funded_pilot',
  'other'
]);

export const RESULT_SIGNAL_STRENGTHS = new Set([
  'none',
  'weak',
  'early',
  'moderate',
  'strong',
  'validated',
  'invalidated'
]);

export const OUTCOME_LEDGER_EVENT_TYPES = new Set([
  'one_move_planned',
  'one_move_started',
  'one_move_completed',
  'one_move_skipped',
  'one_move_invalidated',
  'result_note_added',
  'partner_signal',
  'channel_signal',
  'funding_signal',
  'revenue_signal',
  'proof_target_signal',
  'other'
]);

export const OUTCOME_LEDGER_EVENT_SOURCES = new Set([
  'one_move_status_control',
  'result_note_control',
  'admin_dashboard',
  'future_chat_context',
  'manual_admin_entry'
]);

export const OUTCOME_LEDGER_SIGNAL_TYPES = new Set([
  ...RESULT_SIGNAL_TYPES,
  'recruiting_signal',
  'retention_signal',
  'product_usage'
]);

export const EVIDENCE_WEIGHTS = new Set([
  ...RESULT_SIGNAL_STRENGTHS
]);

const MAX_NOTE_LENGTH = 1200;
const MAX_MODIFIED_MOVE_LENGTH = 2000;

function generatedStrategyKey(strategyId) {
  return `generated_strategy:${strategyId}`;
}

function generatedStrategyLatestKey(profileId, contextType) {
  return `generated_strategy_latest:${profileId}:${contextType}`;
}

function generatedStrategyIndexKey(profileId, contextType) {
  return `generated_strategy:index:${profileId}:${contextType}`;
}

function outcomeLedgerEventKey(eventId) {
  return `outcome_ledger_event:${eventId}`;
}

function outcomeLedgerIndexKey(profileId, contextType) {
  return `outcome_ledger_index:${profileId}:${contextType}`;
}

function outcomeLedgerStrategyIndexKey(strategyId) {
  return `outcome_ledger_index:strategy:${strategyId}`;
}

function createStrategyId(now = new Date()) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `gs-${datePart}-${crypto.randomBytes(5).toString('hex')}`;
}

function createOutcomeEventId(now = new Date()) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `ole-${datePart}-${crypto.randomBytes(5).toString('hex')}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeArtifact(artifact) {
  if (!artifact) return null;

  return {
    strategy_id: artifact.strategy_id || null,
    profile_id: artifact.profile_id || null,
    context_type: artifact.context_type || null,
    created_at: artifact.created_at || null,
    generated_at: artifact.generated_at || null,
    source_snapshot_version: artifact.source_snapshot_version || null,
    source_snapshot_generated_at: artifact.source_snapshot_generated_at || null,
    generation_version: artifact.generation_version || null,
    five_futures: asArray(artifact.five_futures),
    one_move: artifact.one_move || null,
    evidence_gaps: asArray(artifact.evidence_gaps),
    next_proof_targets: asArray(artifact.next_proof_targets),
    truth_boundaries: asArray(artifact.truth_boundaries),
    model_limits: asArray(artifact.model_limits),
    source_labels: artifact.source_labels || {},
    assumptions: asArray(artifact.assumptions),
    unavailable_fields: asArray(artifact.unavailable_fields),
    quality_validation: artifact.quality_validation || null,
    privacy_validation: artifact.privacy_validation || null,
    accepted_status: artifact.accepted_status || 'pending',
    outcome_status: artifact.outcome_status || 'not_recorded',
    one_move_user_note: artifact.one_move_user_note || null,
    one_move_modified_text: artifact.one_move_modified_text || null,
    one_move_result_note: artifact.one_move_result_note || null,
    result_signal_type: artifact.result_signal_type || 'none',
    result_signal_strength: artifact.result_signal_strength || 'none',
    updated_at: artifact.updated_at || null,
    status_history: asArray(artifact.status_history).slice(-25),
    latest_outcome_event_id: artifact.latest_outcome_event_id || null,
    outcome_event_count: Number.isFinite(Number(artifact.outcome_event_count)) ? Number(artifact.outcome_event_count) : 0,
    one_move_status_version: artifact.one_move_status_version || null,
    persistence_version: artifact.persistence_version || DARREN_STRATEGY_PERSISTENCE_VERSION
  };
}

function buildStrategyArtifact({ generated, snapshot }) {
  const now = new Date();
  const strategyId = createStrategyId(now);

  return {
    strategy_id: strategyId,
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    created_at: now.toISOString(),
    generated_at: generated.generated_at || now.toISOString(),
    source_snapshot_version: generated.source_snapshot_version || snapshot?.snapshot_version || SNAPSHOT_VERSION,
    source_snapshot_generated_at: snapshot?.generated_at || null,
    generation_version: DARREN_STRATEGY_GENERATION_VERSION,
    five_futures: asArray(generated.five_futures),
    one_move: generated.one_move || null,
    evidence_gaps: asArray(generated.evidence_gaps),
    next_proof_targets: asArray(generated.next_proof_targets),
    truth_boundaries: asArray(generated.truth_boundaries),
    model_limits: asArray(generated.model_limits),
    source_labels: {
      generated_strategy: 'model_output_after_schema_quality_privacy_validation',
      source_snapshot: 'darren_intelligence_snapshot',
      dashboard_context: 'dashboard_metric',
      build_map: 'repo_backed_build_map',
      strategic_goal: 'user_provided_goal',
      e_to_p_lens: 'planning_addendum_and_snapshot_scaffold'
    },
    assumptions: [
      '$250M valuation remains a scenario lens, not a guaranteed outcome.',
      '$15M-$30M gross revenue remains a user-provided strategic ambition lens.',
      'Partner capital, channel adoption, RRG activity, paid conversion, and revenue data are not yet persistently indexed.'
    ],
    unavailable_fields: asArray(snapshot?.unavailable_fields),
    quality_validation: {
      passed: true,
      one_move_weekly: true,
      one_move_concrete: true,
      one_move_proof_target_measurable: true,
      language_quality_passed: true
    },
    privacy_validation: {
      passed: true,
      raw_source_profile_exposure_detected: false,
      raw_assessment_response_exposure_detected: false,
      storage_key_exposure_detected: false,
      environment_value_exposure_detected: false,
      prompt_exposure_detected: false,
      forbidden_framing_detected: false
    },
    accepted_status: 'pending',
    outcome_status: 'not_recorded',
    one_move_user_note: null,
    one_move_modified_text: null,
    one_move_result_note: null,
    result_signal_type: 'none',
    result_signal_strength: 'none',
    updated_at: null,
    status_history: [],
    latest_outcome_event_id: null,
    outcome_event_count: 0,
    one_move_status_version: ONE_MOVE_STATUS_VERSION,
    persistence_version: DARREN_STRATEGY_PERSISTENCE_VERSION
  };
}

function statusError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function boundedText(value, maxLength) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.length > maxLength) throw statusError('one_move_status_text_too_long', 400);
  if (/canonical[\s_-]+dossier|canonical[\s_-]+profile[\s_-]+json|canonical[\s_-]+profile[\s_-]+text|assessment[\s_-]+answers|raw[\s_-]+answers/i.test(text)) {
    throw statusError('one_move_status_private_source_reference_rejected', 400);
  }
  return text;
}

function sanitizeLedgerEvent(event) {
  if (!event) return null;
  return {
    event_id: event.event_id || null,
    profile_id: event.profile_id || null,
    context_type: event.context_type || null,
    strategy_id: event.strategy_id || null,
    related_one_move_text: event.related_one_move_text || null,
    event_type: event.event_type || null,
    event_source: event.event_source || null,
    event_note: event.event_note || null,
    signal_type: event.signal_type || 'none',
    signal_strength: event.signal_strength || 'none',
    proof_target_name: event.proof_target_name || null,
    future_path: event.future_path || null,
    evidence_weight: event.evidence_weight || 'none',
    created_at: event.created_at || null,
    created_by_context: event.created_by_context || 'admin_darren_dashboard',
    ledger_version: event.ledger_version || OUTCOME_LEDGER_VERSION,
    source_labels: event.source_labels || {},
    safety_flags: event.safety_flags || {},
    not_yet_claims: asArray(event.not_yet_claims),
    linked_strategy_status_snapshot: event.linked_strategy_status_snapshot || null
  };
}

function summarizeLedgerEvent(event) {
  const note = String(event?.event_note || '').trim();
  return {
    event_id: event?.event_id || null,
    created_at: event?.created_at || null,
    event_type: event?.event_type || null,
    signal_type: event?.signal_type || 'none',
    signal_strength: event?.signal_strength || 'none',
    evidence_weight: event?.evidence_weight || 'none',
    note_preview: note ? note.slice(0, 180) : null
  };
}

function applyOneMoveAction(artifact, input) {
  const action = String(input?.action || '').trim();
  if (!ONE_MOVE_ACTIONS.has(action)) throw statusError('invalid_one_move_status_action', 400);

  const now = new Date().toISOString();
  const note = boundedText(input?.note, MAX_NOTE_LENGTH);
  const modifiedText = boundedText(input?.modified_one_move_text, MAX_MODIFIED_MOVE_LENGTH);
  const signalType = String(input?.result_signal_type || artifact.result_signal_type || 'none').trim();
  const signalStrength = String(input?.result_signal_strength || artifact.result_signal_strength || 'none').trim();

  if (!RESULT_SIGNAL_TYPES.has(signalType)) throw statusError('invalid_result_signal_type', 400);
  if (!RESULT_SIGNAL_STRENGTHS.has(signalStrength)) throw statusError('invalid_result_signal_strength', 400);
  if (action === 'modify' && !modifiedText) throw statusError('modified_one_move_text_required', 400);

  const updated = {
    ...artifact,
    updated_at: now,
    result_signal_type: signalType,
    result_signal_strength: signalStrength,
    one_move_status_version: ONE_MOVE_STATUS_VERSION
  };

  if (note) updated.one_move_user_note = note;
  if (action === 'add_result_note' && note) updated.one_move_result_note = note;

  if (action === 'accept') updated.accepted_status = 'accepted';
  if (action === 'modify') {
    updated.accepted_status = 'modified';
    updated.one_move_modified_text = modifiedText;
  }
  if (action === 'reject') updated.accepted_status = 'rejected';
  if (action === 'mark_planned') updated.outcome_status = 'planned';
  if (action === 'mark_in_progress') updated.outcome_status = 'in_progress';
  if (action === 'mark_completed') updated.outcome_status = 'completed';
  if (action === 'mark_skipped') updated.outcome_status = 'skipped';
  if (action === 'mark_invalidated') updated.outcome_status = 'invalidated';
  if (action === 'add_result_note' && updated.outcome_status === 'not_recorded') updated.outcome_status = 'in_progress';

  const historyEvent = {
    action,
    accepted_status: updated.accepted_status,
    outcome_status: updated.outcome_status,
    result_signal_type: updated.result_signal_type,
    result_signal_strength: updated.result_signal_strength,
    note_present: Boolean(note),
    modified_text_present: Boolean(modifiedText),
    created_at: now
  };
  updated.status_history = [...asArray(artifact.status_history), historyEvent].slice(-25);
  return updated;
}

function getRedis() {
  if (!process.env.REDIS_URL) {
    const error = new Error('strategy_persistence_not_configured');
    error.code = 'strategy_persistence_not_configured';
    error.status = 500;
    throw error;
  }
  return new Redis(process.env.REDIS_URL);
}

export async function persistDarrenGeneratedStrategy({ generated, snapshot }) {
  const redis = getRedis();
  try {
    const artifact = buildStrategyArtifact({ generated, snapshot });
    await redis.set(generatedStrategyKey(artifact.strategy_id), JSON.stringify(artifact));
    await redis.set(generatedStrategyLatestKey(artifact.profile_id, artifact.context_type), artifact.strategy_id);
    await redis.sadd(generatedStrategyIndexKey(artifact.profile_id, artifact.context_type), artifact.strategy_id);
    return sanitizeArtifact(artifact);
  } finally {
    redis.disconnect();
  }
}

export async function loadLatestDarrenGeneratedStrategy() {
  const redis = getRedis();
  try {
    const strategyId = await redis.get(generatedStrategyLatestKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE));
    if (!strategyId) return null;

    const raw = await redis.get(generatedStrategyKey(strategyId));
    if (!raw) return null;

    try {
      return sanitizeArtifact(JSON.parse(raw));
    } catch {
      const error = new Error('strategy_artifact_parse_failed');
      error.code = 'strategy_artifact_parse_failed';
      error.status = 500;
      throw error;
    }
  } finally {
    redis.disconnect();
  }
}

export async function updateDarrenOneMoveStatus(input) {
  const strategyId = String(input?.strategy_id || '').trim();
  if (!strategyId) throw statusError('strategy_id_required', 400);
  const action = String(input?.action || '').trim();
  if (!ONE_MOVE_ACTIONS.has(action)) throw statusError('invalid_one_move_status_action', 400);

  const redis = getRedis();
  try {
    const raw = await redis.get(generatedStrategyKey(strategyId));
    if (!raw) throw statusError('generated_strategy_not_found', 404);

    let artifact;
    try {
      artifact = JSON.parse(raw);
    } catch {
      throw statusError('strategy_artifact_parse_failed', 500);
    }

    if (artifact.profile_id !== DARREN_PROFILE_ID || artifact.context_type !== DARREN_STRATEGY_CONTEXT_TYPE) {
      throw statusError('generated_strategy_context_mismatch', 403);
    }

    const updated = applyOneMoveAction(artifact, input);
    await redis.set(generatedStrategyKey(strategyId), JSON.stringify(updated));
    await redis.set(generatedStrategyLatestKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), strategyId);
    return sanitizeArtifact(updated);
  } finally {
    redis.disconnect();
  }
}

function validateStrategyContext(artifact) {
  if (artifact.profile_id !== DARREN_PROFILE_ID || artifact.context_type !== DARREN_STRATEGY_CONTEXT_TYPE) {
    throw statusError('generated_strategy_context_mismatch', 403);
  }
}

function buildOutcomeLedgerEvent(artifact, input) {
  const eventType = String(input?.event_type || '').trim();
  if (!OUTCOME_LEDGER_EVENT_TYPES.has(eventType)) throw statusError('invalid_outcome_event_type', 400);

  const eventSource = String(input?.event_source || 'admin_dashboard').trim();
  const signalType = String(input?.signal_type || 'none').trim();
  const signalStrength = String(input?.signal_strength || 'none').trim();
  const evidenceWeight = String(input?.evidence_weight || signalStrength || 'none').trim();

  if (!OUTCOME_LEDGER_EVENT_SOURCES.has(eventSource)) throw statusError('invalid_outcome_event_source', 400);
  if (!OUTCOME_LEDGER_SIGNAL_TYPES.has(signalType)) throw statusError('invalid_outcome_signal_type', 400);
  if (!RESULT_SIGNAL_STRENGTHS.has(signalStrength)) throw statusError('invalid_outcome_signal_strength', 400);
  if (!EVIDENCE_WEIGHTS.has(evidenceWeight)) throw statusError('invalid_outcome_evidence_weight', 400);

  const now = new Date();
  const eventNote = boundedText(input?.event_note, MAX_NOTE_LENGTH);
  const proofTargetName = boundedText(input?.proof_target_name, 240);
  const futurePath = boundedText(input?.future_path, 240);

  return {
    event_id: createOutcomeEventId(now),
    profile_id: DARREN_PROFILE_ID,
    context_type: DARREN_STRATEGY_CONTEXT_TYPE,
    strategy_id: artifact.strategy_id,
    related_one_move_text: artifact.one_move_modified_text || artifact.one_move?.exact_action || artifact.one_move?.summary || null,
    event_type: eventType,
    event_source: eventSource,
    event_note: eventNote,
    signal_type: signalType,
    signal_strength: signalStrength,
    proof_target_name: proofTargetName,
    future_path: futurePath,
    evidence_weight: evidenceWeight,
    created_at: now.toISOString(),
    created_by_context: 'admin_darren_dashboard',
    ledger_version: OUTCOME_LEDGER_VERSION,
    source_labels: {
      event: 'admin_entered_outcome_ledger_v0',
      strategy: 'generated_strategy_artifact',
      one_move: 'generated_or_modified_one_move',
      signal: 'admin_classified_signal'
    },
    safety_flags: {
      raw_profile_source_included: false,
      raw_assessment_responses_included: false,
      environment_values_included: false,
      storage_keys_exposed_to_client: false,
      automatic_learning_claimed: false
    },
    not_yet_claims: [
      'Outcome Ledger v0 records evidence events but does not automatically update future likelihood.',
      'Since Last Snapshot comparison is not live yet.',
      'Strategy chat is not live yet.',
      'Automatic learning is not claimed until later snapshots compare evidence over time.'
    ],
    linked_strategy_status_snapshot: {
      accepted_status: artifact.accepted_status || 'pending',
      outcome_status: artifact.outcome_status || 'not_recorded',
      status_history_count: asArray(artifact.status_history).length
    }
  };
}

export async function createDarrenOutcomeLedgerEvent(input) {
  const strategyId = String(input?.strategy_id || '').trim();
  if (!strategyId) throw statusError('strategy_id_required', 400);
  if (!OUTCOME_LEDGER_EVENT_TYPES.has(String(input?.event_type || '').trim())) {
    throw statusError('invalid_outcome_event_type', 400);
  }
  if (input?.signal_type && !OUTCOME_LEDGER_SIGNAL_TYPES.has(String(input.signal_type).trim())) {
    throw statusError('invalid_outcome_signal_type', 400);
  }
  if (input?.evidence_weight && !EVIDENCE_WEIGHTS.has(String(input.evidence_weight).trim())) {
    throw statusError('invalid_outcome_evidence_weight', 400);
  }

  const redis = getRedis();
  try {
    const raw = await redis.get(generatedStrategyKey(strategyId));
    if (!raw) throw statusError('generated_strategy_not_found', 404);

    let artifact;
    try {
      artifact = JSON.parse(raw);
    } catch {
      throw statusError('strategy_artifact_parse_failed', 500);
    }

    validateStrategyContext(artifact);
    const event = buildOutcomeLedgerEvent(artifact, input);
    const currentCount = Number.isFinite(Number(artifact.outcome_event_count)) ? Number(artifact.outcome_event_count) : 0;
    const updatedArtifact = {
      ...artifact,
      latest_outcome_event_id: event.event_id,
      outcome_event_count: currentCount + 1,
      updated_at: event.created_at,
      status_history: [
        ...asArray(artifact.status_history),
        {
          action: 'outcome_ledger_event_created',
          event_type: event.event_type,
          signal_type: event.signal_type,
          signal_strength: event.signal_strength,
          evidence_weight: event.evidence_weight,
          note_present: Boolean(event.event_note),
          created_at: event.created_at
        }
      ].slice(-25)
    };

    await redis.set(outcomeLedgerEventKey(event.event_id), JSON.stringify(event));
    await redis.sadd(outcomeLedgerIndexKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), event.event_id);
    await redis.sadd(outcomeLedgerStrategyIndexKey(strategyId), event.event_id);
    await redis.set(generatedStrategyKey(strategyId), JSON.stringify(updatedArtifact));
    await redis.set(generatedStrategyLatestKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE), strategyId);

    return {
      event: sanitizeLedgerEvent(event),
      updated_strategy: sanitizeArtifact(updatedArtifact),
      latest_outcome_event_summary: summarizeLedgerEvent(event)
    };
  } finally {
    redis.disconnect();
  }
}

export async function loadDarrenOutcomeLedgerEvents({ strategy_id: strategyId = null, limit = 10 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 10, 25));
  const redis = getRedis();
  try {
    let eventIds;
    if (strategyId) {
      eventIds = await redis.smembers(outcomeLedgerStrategyIndexKey(String(strategyId).trim()));
    } else {
      eventIds = await redis.smembers(outcomeLedgerIndexKey(DARREN_PROFILE_ID, DARREN_STRATEGY_CONTEXT_TYPE));
    }

    if (!eventIds.length) return [];
    const rawEvents = await Promise.all(eventIds.map((eventId) => redis.get(outcomeLedgerEventKey(eventId))));
    return rawEvents
      .map((raw) => {
        if (!raw) return null;
        try {
          return sanitizeLedgerEvent(JSON.parse(raw));
        } catch {
          return null;
        }
      })
      .filter((event) => event?.profile_id === DARREN_PROFILE_ID && event?.context_type === DARREN_STRATEGY_CONTEXT_TYPE)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, safeLimit);
  } finally {
    redis.disconnect();
  }
}
