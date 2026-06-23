import crypto from 'crypto';
import Redis from 'ioredis';
import { DARREN_PROFILE_ID, SNAPSHOT_VERSION } from './darren-intelligence-snapshot-core.js';

export const DARREN_STRATEGY_CONTEXT_TYPE = 'darren_leadership_intelligence';
export const DARREN_STRATEGY_GENERATION_VERSION = 'DARREN-FIVE-FUTURES-ONE-MOVE-V1';
export const DARREN_STRATEGY_PERSISTENCE_VERSION = 'generated_strategy_v1';
export const ONE_MOVE_STATUS_VERSION = 'one_move_status_v0';

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

function createStrategyId(now = new Date()) {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `gs-${datePart}-${crypto.randomBytes(5).toString('hex')}`;
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
