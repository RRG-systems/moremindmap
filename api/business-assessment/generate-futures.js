import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  getCanonicalProfile,
  parseProfileId,
  setCors
} from './shared.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../engine/businessAssessment/realEstateBusinessModelV1.js';
import {
  buildFiveFuturesOnlyPrompt,
  buildOneMovePrompt,
  REQUIRED_FUTURE_KEYS
} from '../engine/businessAssessment/buildFiveFuturesPrompt.js';

const FIVE_FUTURES_VERSION = 'five_futures_v1';
const ONE_MOVE_VERSION = 'one_move_v1';
const MODEL = process.env.BUSINESS_ASSESSMENT_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06';
const FUTURES_ENDPOINT_TIME_BUDGET_MS = 165000;
const FIVE_FUTURES_STAGE_TIMEOUT_MS = 75000;
const ONE_MOVE_STAGE_TIMEOUT_MS = 60000;
const FUTURES_OPENAI_SAFETY_BUFFER_MS = 10000;
const FIVE_FUTURES_STAGE_MAX_COMPLETION_TOKENS = 6000;
const ONE_MOVE_STAGE_MAX_COMPLETION_TOKENS = 3500;
const REQUIRED_FUTURE_FIELDS = [
  'title',
  'probability',
  'status',
  'summary',
  'trajectory_logic',
  'evidence',
  'confidence'
];
const REQUIRED_ONE_MOVE_FIELDS = [
  'title',
  'root_constraint',
  'intervention_category',
  'recommendation',
  'why_this_move',
  'expected_probability_shift',
  'first_30_days',
  'success_indicators',
  'confidence'
];

async function resolveAssessmentId(redis, { assessment_id, owner_profile_id }) {
  if (assessment_id) return assessment_id;
  const parsedProfile = parseProfileId(owner_profile_id);
  if (!parsedProfile) return null;
  return redis.get(businessAssessmentByProfileKey(parsedProfile.normalized));
}

function extractJsonObject(content) {
  const body = String(content || '').trim();
  if (!body) throw new Error('empty_model_response');

  try {
    return JSON.parse(body);
  } catch {
    const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1].trim());

    const first = body.indexOf('{');
    const last = body.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(body.slice(first, last + 1));

    throw new Error('invalid_json_response');
  }
}

function normalizeFuturesOutput(parsed, { assessmentId, ownerProfileId }) {
  const now = new Date().toISOString();
  const fiveFutures = parsed.five_futures_v1 || parsed.fiveFutures || parsed;
  const oneMove = parsed.one_move_v1 || parsed.oneMove || parsed.one_move;

  return {
    five_futures_v1: {
      ...fiveFutures,
      version: fiveFutures?.version || FIVE_FUTURES_VERSION,
      generated_at: fiveFutures?.generated_at || now,
      assessment_id: fiveFutures?.assessment_id || assessmentId,
      owner_profile_id: fiveFutures?.owner_profile_id || ownerProfileId,
      title: fiveFutures?.title || 'Five Futures',
      subtitle: fiveFutures?.subtitle || 'The future is not predicted. It is modeled.'
    },
    one_move_v1: {
      ...oneMove,
      version: oneMove?.version || ONE_MOVE_VERSION,
      generated_at: oneMove?.generated_at || now,
      assessment_id: oneMove?.assessment_id || assessmentId,
      owner_profile_id: oneMove?.owner_profile_id || ownerProfileId
    }
  };
}

function normalizeFiveFuturesOutput(parsed, { assessmentId, ownerProfileId }) {
  return normalizeFuturesOutput({ five_futures_v1: parsed?.five_futures_v1 || parsed }, {
    assessmentId,
    ownerProfileId
  }).five_futures_v1;
}

function normalizeOneMoveOutput(parsed, { assessmentId, ownerProfileId }) {
  return normalizeFuturesOutput({ one_move_v1: parsed?.one_move_v1 || parsed?.oneMove || parsed }, {
    assessmentId,
    ownerProfileId
  }).one_move_v1;
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validateFiveFutures(fiveFutures) {
  if (!fiveFutures || typeof fiveFutures !== 'object' || Array.isArray(fiveFutures)) {
    return { valid: false, reason: 'five_futures_not_object' };
  }

  if (fiveFutures.version !== FIVE_FUTURES_VERSION) {
    return { valid: false, reason: 'invalid_five_futures_version', version: fiveFutures.version };
  }

  if (!Array.isArray(fiveFutures.futures) || fiveFutures.futures.length !== REQUIRED_FUTURE_KEYS.length) {
    return {
      valid: false,
      reason: 'invalid_future_count',
      expected: REQUIRED_FUTURE_KEYS.length,
      actual: Array.isArray(fiveFutures.futures) ? fiveFutures.futures.length : 0
    };
  }

  const futuresByKey = new Map(fiveFutures.futures.map((future) => [future?.key, future]));
  const missingKeys = REQUIRED_FUTURE_KEYS.filter((key) => !futuresByKey.has(key));
  if (missingKeys.length) return { valid: false, reason: 'missing_future_keys', missingKeys };

  const probabilities = [];
  for (const key of REQUIRED_FUTURE_KEYS) {
    const future = futuresByKey.get(key);
    const missingFields = REQUIRED_FUTURE_FIELDS.filter(
      (field) => future?.[field] === undefined || future?.[field] === null || future?.[field] === ''
    );
    if (missingFields.length) return { valid: false, reason: 'future_missing_required_fields', key, missingFields };

    const probability = numberValue(future.probability);
    if (probability === null || probability < 0 || probability > 100) {
      return { valid: false, reason: 'invalid_future_probability', key, probability: future.probability };
    }
    probabilities.push(probability);

    if (!Array.isArray(future.evidence) || future.evidence.length === 0) {
      return { valid: false, reason: 'future_evidence_missing', key };
    }
    if (!Array.isArray(future.signal_bullets) || future.signal_bullets.length < 2) {
      return { valid: false, reason: 'future_signal_bullets_missing', key };
    }
    if (!future.short_interpretation || !future.central_insight) {
      return { valid: false, reason: 'future_visual_ready_fields_missing', key };
    }
    if (!future.visual_color_hint || !future.visual_position_hint) {
      return { valid: false, reason: 'future_visual_hints_missing', key };
    }
    if (!Array.isArray(future.input_sources_used) || future.input_sources_used.length === 0) {
      return { valid: false, reason: 'future_input_sources_missing', key };
    }
  }

  const probabilityTotal = probabilities.reduce((sum, value) => sum + value, 0);
  if (Math.abs(probabilityTotal - 100) > 1) {
    return { valid: false, reason: 'probabilities_do_not_sum_to_100', probabilityTotal };
  }

  if (fiveFutures.probability_total !== undefined && Math.abs(numberValue(fiveFutures.probability_total) - 100) > 1) {
    return {
      valid: false,
      reason: 'probability_total_field_invalid',
      probability_total: fiveFutures.probability_total
    };
  }

  return { valid: true };
}

function validateOneMove(oneMove) {
  if (!oneMove || typeof oneMove !== 'object' || Array.isArray(oneMove)) {
    return { valid: false, reason: 'one_move_not_object' };
  }

  if (oneMove.version !== ONE_MOVE_VERSION) {
    return { valid: false, reason: 'invalid_one_move_version', version: oneMove.version };
  }

  const missingFields = REQUIRED_ONE_MOVE_FIELDS.filter(
    (field) => oneMove[field] === undefined || oneMove[field] === null || oneMove[field] === ''
  );
  if (missingFields.length) return { valid: false, reason: 'one_move_missing_required_fields', missingFields };

  if (typeof oneMove.expected_probability_shift !== 'object') {
    return { valid: false, reason: 'one_move_probability_shift_invalid' };
  }

  if (!Array.isArray(oneMove.first_30_days) || oneMove.first_30_days.length === 0) {
    return { valid: false, reason: 'one_move_first_30_days_missing' };
  }

  if (!Array.isArray(oneMove.success_indicators) || oneMove.success_indicators.length === 0) {
    return { valid: false, reason: 'one_move_success_indicators_missing' };
  }

  return { valid: true };
}

function validateOutput({ five_futures_v1, one_move_v1 }) {
  const futuresValidation = validateFiveFutures(five_futures_v1);
  if (!futuresValidation.valid) return { valid: false, scope: 'five_futures_v1', ...futuresValidation };

  const oneMoveValidation = validateOneMove(one_move_v1);
  if (!oneMoveValidation.valid) return { valid: false, scope: 'one_move_v1', ...oneMoveValidation };

  return { valid: true };
}

function elapsedMs(startedAt) {
  return Date.now() - startedAt;
}

function remainingMs(startedAt) {
  return Math.max(0, FUTURES_ENDPOINT_TIME_BUDGET_MS - elapsedMs(startedAt));
}

function shouldStopBeforeTimeout(startedAt, timeoutMs) {
  return remainingMs(startedAt) <= timeoutMs + FUTURES_OPENAI_SAFETY_BUFFER_MS;
}

function futuresDiagnostics({
  assessmentId,
  ownerProfileId,
  prompt,
  startedAt,
  stage,
  error,
  validation,
  timeoutMs,
  maxCompletionTokens
}) {
  return {
    generated_at: new Date().toISOString(),
    stage,
    error: error || null,
    validation: validation || null,
    assessment_id: assessmentId,
    owner_profile_id: ownerProfileId,
    model: MODEL,
    prompt_chars: JSON.stringify(prompt?.messages || []).length,
    user_prompt_chars: String(prompt?.messages?.[1]?.content || '').length,
    max_completion_tokens: maxCompletionTokens || null,
    elapsed_ms: elapsedMs(startedAt),
    remaining_ms: remainingMs(startedAt),
    timeout_ms: timeoutMs || null
  };
}

async function saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics) {
  const now = new Date().toISOString();
  await redis.set(
    businessAssessmentKey(assessmentId),
    JSON.stringify({
      ...assessmentRecord,
      updated_at: now,
      metadata: {
        ...(assessmentRecord.metadata || {}),
        last_futures_generation_error: diagnostics
      }
    })
  );
}

function sendFuturesTimeBudgetExceeded(res, diagnostics, assessmentStatus) {
  return res.status(503).json({
    ok: false,
    error: 'futures_generation_time_budget_exceeded',
    status: assessmentStatus,
    assessment_id: diagnostics.assessment_id,
    owner_profile_id: diagnostics.owner_profile_id,
    diagnostics
  });
}

async function callOpenAIForFutures(prompt, { timeoutMs, maxCompletionTokens, stage } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'missing_openai_api_key';
    throw error;
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: prompt.messages,
      response_format: { type: 'json_object' },
      max_completion_tokens: maxCompletionTokens
    }),
    signal: controller.signal
  }).catch((error) => {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI futures call exceeded ${timeoutMs}ms`);
      timeoutError.code = 'openai_futures_call_timeout';
      timeoutError.timeout_ms = timeoutMs;
      timeoutError.stage = stage;
      throw timeoutError;
    }
    throw error;
  }).finally(() => clearTimeout(timeout));

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('Empty response from OpenAI');
    error.details = data;
    throw error;
  }

  return {
    parsed: extractJsonObject(content),
    model: data.model || MODEL,
    usage: data.usage || null,
    duration_ms: Date.now() - startedAt,
    stage
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  let redis;
  const requestStartedAt = Date.now();
  let activeAssessmentRecord = null;
  let activeAssessmentId = null;
  let activeOwnerProfileId = null;
  try {
    const { assessment_id, owner_profile_id } = req.body || {};
    if (!assessment_id && !owner_profile_id) {
      return res.status(400).json({ ok: false, error: 'missing_assessment_id_or_profile_id' });
    }

    redis = createRedisClient();
    const assessmentId = await resolveAssessmentId(redis, { assessment_id, owner_profile_id });
    activeAssessmentId = assessmentId;
    if (!assessmentId) return res.status(404).json({ ok: false, error: 'assessment_not_found' });

    const rawAssessment = await redis.get(businessAssessmentKey(assessmentId));
    if (!rawAssessment) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found', assessment_id: assessmentId });
    }

    const assessmentRecord = JSON.parse(rawAssessment);
    activeAssessmentRecord = assessmentRecord;
    const ownerProfileId = assessmentRecord.owner_profile_id || owner_profile_id;
    activeOwnerProfileId = ownerProfileId;
    const businessIntelligenceDraft = assessmentRecord.output?.business_intelligence_draft;
    const executiveDiagnosticBriefing = assessmentRecord.output?.executive_diagnostic_briefing_v1;

    if (!businessIntelligenceDraft) {
      return res.status(409).json({
        ok: false,
        error: 'missing_business_intelligence_draft',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    if (!executiveDiagnosticBriefing) {
      return res.status(409).json({
        ok: false,
        error: 'missing_executive_diagnostic_briefing',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const profileLookup = await getCanonicalProfile(redis, ownerProfileId);
    if (!profileLookup.found) {
      return res.status(404).json({
        ok: false,
        error: 'profile_not_found',
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const fiveFuturesPrompt = buildFiveFuturesOnlyPrompt({
      assessmentRecord,
      businessIntelligenceDraft,
      executiveDiagnosticBriefing,
      canonicalProfile: profileLookup.dossier,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1
    });

    const beforeOpenAIDiagnostics = futuresDiagnostics({
      assessmentId,
      ownerProfileId,
      prompt: fiveFuturesPrompt,
      startedAt: requestStartedAt,
      stage: 'before_five_futures_stage',
      error: 'five_futures_stage_started',
      timeoutMs: FIVE_FUTURES_STAGE_TIMEOUT_MS,
      maxCompletionTokens: FIVE_FUTURES_STAGE_MAX_COMPLETION_TOKENS
    });
    await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, beforeOpenAIDiagnostics);

    if (shouldStopBeforeTimeout(requestStartedAt, FIVE_FUTURES_STAGE_TIMEOUT_MS)) {
      const diagnostics = futuresDiagnostics({
        assessmentId,
        ownerProfileId,
        prompt: fiveFuturesPrompt,
        startedAt: requestStartedAt,
        stage: 'before_five_futures_stage',
        error: 'insufficient_time_before_five_futures_stage',
        timeoutMs: FIVE_FUTURES_STAGE_TIMEOUT_MS,
        maxCompletionTokens: FIVE_FUTURES_STAGE_MAX_COMPLETION_TOKENS
      });
      await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
      return sendFuturesTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
    }

    let fiveFuturesGeneration;
    try {
      fiveFuturesGeneration = await callOpenAIForFutures(fiveFuturesPrompt, {
        timeoutMs: FIVE_FUTURES_STAGE_TIMEOUT_MS,
        maxCompletionTokens: FIVE_FUTURES_STAGE_MAX_COMPLETION_TOKENS,
        stage: 'five_futures_stage'
      });
    } catch (error) {
      if (error?.code === 'openai_futures_call_timeout') {
        const diagnostics = futuresDiagnostics({
          assessmentId,
          ownerProfileId,
          prompt: fiveFuturesPrompt,
          startedAt: requestStartedAt,
          stage: 'five_futures_stage_timeout',
          error: 'openai_five_futures_stage_timeout',
          timeoutMs: error.timeout_ms,
          maxCompletionTokens: FIVE_FUTURES_STAGE_MAX_COMPLETION_TOKENS
        });
        await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
        return sendFuturesTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
      }
      throw error;
    }

    const fiveFutures = normalizeFiveFuturesOutput(fiveFuturesGeneration.parsed, { assessmentId, ownerProfileId });
    const fiveFuturesValidation = validateFiveFutures(fiveFutures);
    if (!fiveFuturesValidation.valid) {
      const diagnostics = futuresDiagnostics({
        assessmentId,
        ownerProfileId,
        prompt: fiveFuturesPrompt,
        startedAt: requestStartedAt,
        stage: 'five_futures_stage_validation_failed',
        error: 'invalid_five_futures_output',
        validation: fiveFuturesValidation,
        timeoutMs: FIVE_FUTURES_STAGE_TIMEOUT_MS,
        maxCompletionTokens: FIVE_FUTURES_STAGE_MAX_COMPLETION_TOKENS
      });
      diagnostics.generation_duration_ms = fiveFuturesGeneration.duration_ms;
      diagnostics.generation_usage = fiveFuturesGeneration.usage || null;
      await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
      return res.status(502).json({
        ok: false,
        error: 'invalid_five_futures_output',
        validation: fiveFuturesValidation,
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const oneMovePrompt = buildOneMovePrompt({
      assessmentRecord,
      businessIntelligenceDraft,
      executiveDiagnosticBriefing,
      fiveFutures,
      canonicalProfile: profileLookup.dossier,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1
    });
    const beforeOneMoveDiagnostics = futuresDiagnostics({
      assessmentId,
      ownerProfileId,
      prompt: oneMovePrompt,
      startedAt: requestStartedAt,
      stage: 'before_one_move_stage',
      error: 'one_move_stage_started',
      timeoutMs: ONE_MOVE_STAGE_TIMEOUT_MS,
      maxCompletionTokens: ONE_MOVE_STAGE_MAX_COMPLETION_TOKENS
    });
    beforeOneMoveDiagnostics.five_futures_stage_duration_ms = fiveFuturesGeneration.duration_ms;
    beforeOneMoveDiagnostics.five_futures_stage_usage = fiveFuturesGeneration.usage || null;
    await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, beforeOneMoveDiagnostics);

    if (shouldStopBeforeTimeout(requestStartedAt, ONE_MOVE_STAGE_TIMEOUT_MS)) {
      const diagnostics = futuresDiagnostics({
        assessmentId,
        ownerProfileId,
        prompt: oneMovePrompt,
        startedAt: requestStartedAt,
        stage: 'before_one_move_stage',
        error: 'insufficient_time_before_one_move_stage',
        timeoutMs: ONE_MOVE_STAGE_TIMEOUT_MS,
        maxCompletionTokens: ONE_MOVE_STAGE_MAX_COMPLETION_TOKENS
      });
      diagnostics.five_futures_stage_duration_ms = fiveFuturesGeneration.duration_ms;
      diagnostics.five_futures_stage_usage = fiveFuturesGeneration.usage || null;
      await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
      return sendFuturesTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
    }

    let oneMoveGeneration;
    try {
      oneMoveGeneration = await callOpenAIForFutures(oneMovePrompt, {
        timeoutMs: ONE_MOVE_STAGE_TIMEOUT_MS,
        maxCompletionTokens: ONE_MOVE_STAGE_MAX_COMPLETION_TOKENS,
        stage: 'one_move_stage'
      });
    } catch (error) {
      if (error?.code === 'openai_futures_call_timeout') {
        const diagnostics = futuresDiagnostics({
          assessmentId,
          ownerProfileId,
          prompt: oneMovePrompt,
          startedAt: requestStartedAt,
          stage: 'one_move_stage_timeout',
          error: 'openai_one_move_stage_timeout',
          timeoutMs: error.timeout_ms,
          maxCompletionTokens: ONE_MOVE_STAGE_MAX_COMPLETION_TOKENS
        });
        diagnostics.five_futures_stage_duration_ms = fiveFuturesGeneration.duration_ms;
        diagnostics.five_futures_stage_usage = fiveFuturesGeneration.usage || null;
        await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
        return sendFuturesTimeBudgetExceeded(res, diagnostics, assessmentRecord.status);
      }
      throw error;
    }

    const oneMove = normalizeOneMoveOutput(oneMoveGeneration.parsed, { assessmentId, ownerProfileId });
    const oneMoveValidation = validateOneMove(oneMove);
    if (!oneMoveValidation.valid) {
      const diagnostics = futuresDiagnostics({
        assessmentId,
        ownerProfileId,
        prompt: oneMovePrompt,
        startedAt: requestStartedAt,
        stage: 'one_move_stage_validation_failed',
        error: 'invalid_one_move_output',
        validation: oneMoveValidation,
        timeoutMs: ONE_MOVE_STAGE_TIMEOUT_MS,
        maxCompletionTokens: ONE_MOVE_STAGE_MAX_COMPLETION_TOKENS
      });
      diagnostics.five_futures_stage_duration_ms = fiveFuturesGeneration.duration_ms;
      diagnostics.five_futures_stage_usage = fiveFuturesGeneration.usage || null;
      diagnostics.one_move_stage_duration_ms = oneMoveGeneration.duration_ms;
      diagnostics.one_move_stage_usage = oneMoveGeneration.usage || null;
      await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
      return res.status(502).json({
        ok: false,
        error: 'invalid_one_move_output',
        validation: oneMoveValidation,
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const normalized = { five_futures_v1: fiveFutures, one_move_v1: oneMove };
    const validation = validateOutput(normalized);
    if (!validation.valid) {
      const diagnostics = futuresDiagnostics({
        assessmentId,
        ownerProfileId,
        prompt: oneMovePrompt,
        startedAt: requestStartedAt,
        stage: 'assembled_futures_validation_failed',
        error: 'assembled_futures_validation_failed',
        validation,
        timeoutMs: ONE_MOVE_STAGE_TIMEOUT_MS,
        maxCompletionTokens: ONE_MOVE_STAGE_MAX_COMPLETION_TOKENS
      });
      diagnostics.five_futures_stage_duration_ms = fiveFuturesGeneration.duration_ms;
      diagnostics.five_futures_stage_usage = fiveFuturesGeneration.usage || null;
      diagnostics.one_move_stage_duration_ms = oneMoveGeneration.duration_ms;
      diagnostics.one_move_stage_usage = oneMoveGeneration.usage || null;
      await saveFuturesFailureMetadata(redis, assessmentRecord, assessmentId, diagnostics);
      return res.status(502).json({
        ok: false,
        error: 'invalid_futures_output',
        validation,
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const now = new Date().toISOString();
    const updatedRecord = {
      ...assessmentRecord,
      status: 'five_futures_and_one_move_ready',
      updated_at: now,
      output: {
        ...(assessmentRecord.output || {}),
        five_futures_v1: normalized.five_futures_v1,
        one_move_v1: normalized.one_move_v1
      },
      metadata: {
        ...(assessmentRecord.metadata || {}),
        futures_version: FIVE_FUTURES_VERSION,
        one_move_version: ONE_MOVE_VERSION,
        futures_generated_at: now,
        futures_model: fiveFuturesGeneration.model,
        futures_usage: {
          five_futures_stage: fiveFuturesGeneration.usage || null,
          one_move_stage: oneMoveGeneration.usage || null,
          total_tokens:
            (fiveFuturesGeneration.usage?.total_tokens || 0) +
            (oneMoveGeneration.usage?.total_tokens || 0)
        },
        futures_stage_durations_ms: {
          five_futures_stage: fiveFuturesGeneration.duration_ms,
          one_move_stage: oneMoveGeneration.duration_ms
        },
        last_futures_generation_error: undefined
      }
    };
    delete updatedRecord.metadata.last_futures_generation_error;

    await redis.set(businessAssessmentKey(assessmentId), JSON.stringify(updatedRecord));

    return res.status(200).json({
      ok: true,
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      status: 'five_futures_and_one_move_ready',
      five_futures_v1: normalized.five_futures_v1,
      one_move_v1: normalized.one_move_v1
    });
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-FUTURES] Error:', error);
    if (error?.code === 'openai_futures_call_timeout' && redis && activeAssessmentRecord && activeAssessmentId) {
      const diagnostics = futuresDiagnostics({
        assessmentId: activeAssessmentId,
        ownerProfileId: activeOwnerProfileId || activeAssessmentRecord.owner_profile_id,
        prompt: null,
        startedAt: requestStartedAt,
        stage: 'openai_futures_call_timeout',
        error: 'openai_futures_call_timeout',
        timeoutMs: error.timeout_ms
      });
      await saveFuturesFailureMetadata(redis, activeAssessmentRecord, activeAssessmentId, diagnostics);
      return sendFuturesTimeBudgetExceeded(res, diagnostics, activeAssessmentRecord.status);
    }

    if (redis && activeAssessmentRecord && activeAssessmentId) {
      const diagnostics = futuresDiagnostics({
        assessmentId: activeAssessmentId,
        ownerProfileId: activeOwnerProfileId || activeAssessmentRecord.owner_profile_id,
        prompt: null,
        startedAt: requestStartedAt,
        stage: 'futures_generation_failed',
        error: error.message || 'Unknown futures generation error'
      });
      diagnostics.code = error.code;
      diagnostics.status = error.status;
      await saveFuturesFailureMetadata(redis, activeAssessmentRecord, activeAssessmentId, diagnostics);
    }

    return res.status(500).json({
      ok: false,
      error: 'futures_generation_failed',
      detail: error.message || 'Unknown futures generation error',
      code: error.code,
      status: error.status,
      details: error.details
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}
