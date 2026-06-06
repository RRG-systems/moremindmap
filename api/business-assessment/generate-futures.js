import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  getCanonicalProfile,
  parseProfileId,
  setCors
} from './shared.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../engine/businessAssessment/realEstateBusinessModelV1.js';
import { buildFiveFuturesPrompt, REQUIRED_FUTURE_KEYS } from '../engine/businessAssessment/buildFiveFuturesPrompt.js';

const FIVE_FUTURES_VERSION = 'five_futures_v1';
const ONE_MOVE_VERSION = 'one_move_v1';
const MODEL = process.env.BUSINESS_ASSESSMENT_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06';
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

async function callOpenAIForFutures(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'missing_openai_api_key';
    throw error;
  }

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
      max_completion_tokens: 14000
    })
  });

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
    usage: data.usage || null
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  let redis;
  try {
    const { assessment_id, owner_profile_id } = req.body || {};
    if (!assessment_id && !owner_profile_id) {
      return res.status(400).json({ ok: false, error: 'missing_assessment_id_or_profile_id' });
    }

    redis = createRedisClient();
    const assessmentId = await resolveAssessmentId(redis, { assessment_id, owner_profile_id });
    if (!assessmentId) return res.status(404).json({ ok: false, error: 'assessment_not_found' });

    const rawAssessment = await redis.get(businessAssessmentKey(assessmentId));
    if (!rawAssessment) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found', assessment_id: assessmentId });
    }

    const assessmentRecord = JSON.parse(rawAssessment);
    const ownerProfileId = assessmentRecord.owner_profile_id || owner_profile_id;
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

    const prompt = buildFiveFuturesPrompt({
      assessmentRecord,
      businessIntelligenceDraft,
      executiveDiagnosticBriefing,
      canonicalProfile: profileLookup.dossier,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1
    });

    const generation = await callOpenAIForFutures(prompt);
    const normalized = normalizeFuturesOutput(generation.parsed, { assessmentId, ownerProfileId });
    const validation = validateOutput(normalized);
    if (!validation.valid) {
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
        futures_model: generation.model,
        futures_usage: generation.usage
      }
    };

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
