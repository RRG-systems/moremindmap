import crypto from 'crypto';
import Redis from 'ioredis';
import { DARREN_PROFILE_ID, SNAPSHOT_VERSION } from './darren-intelligence-snapshot-core.js';

export const DARREN_STRATEGY_CONTEXT_TYPE = 'darren_leadership_intelligence';
export const DARREN_STRATEGY_GENERATION_VERSION = 'DARREN-FIVE-FUTURES-ONE-MOVE-V1';
export const DARREN_STRATEGY_PERSISTENCE_VERSION = 'generated_strategy_v1';

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
    persistence_version: DARREN_STRATEGY_PERSISTENCE_VERSION
  };
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
