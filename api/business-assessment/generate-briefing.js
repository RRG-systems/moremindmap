import {
  businessAssessmentByProfileKey,
  businessAssessmentKey,
  createRedisClient,
  getCanonicalProfile,
  parseProfileId,
  setCors
} from './shared.js';
import { REAL_ESTATE_BUSINESS_MODEL_V1 } from '../engine/businessAssessment/realEstateBusinessModelV1.js';
import { buildExecutiveDiagnosticBriefingPrompt } from '../engine/businessAssessment/buildExecutiveDiagnosticBriefingPrompt.js';

const BRIEFING_VERSION = 'executive_diagnostic_briefing_v1';
const MODEL = process.env.BUSINESS_ASSESSMENT_OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-2024-08-06';

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
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }

    const first = body.indexOf('{');
    const last = body.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(body.slice(first, last + 1));
    }

    throw new Error('invalid_json_response');
  }
}

function normalizeBriefingOutput(parsed, { assessmentId, ownerProfileId, prompt }) {
  const now = new Date().toISOString();
  return {
    ...parsed,
    version: parsed.version || BRIEFING_VERSION,
    generated_at: parsed.generated_at || now,
    assessment_id: parsed.assessment_id || assessmentId,
    owner_profile_id: parsed.owner_profile_id || ownerProfileId,
    title: parsed.title || 'Executive Diagnostic Briefing',
    audience_type: parsed.audience_type || prompt.audience_type,
    word_count_target: parsed.word_count_target || prompt.word_count_target
  };
}

function validateBriefingOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, reason: 'briefing_not_object' };
  }

  const required = [
    'version',
    'generated_at',
    'assessment_id',
    'owner_profile_id',
    'title',
    'audience_type',
    'word_count_target',
    'briefing_markdown',
    'sections',
    'primary_constraint_snapshot',
    'current_trajectory_signal',
    'confidence_snapshot',
    'missing_data',
    'caveats'
  ];

  const missing = required.filter((key) => value[key] === undefined || value[key] === null);
  if (missing.length) return { valid: false, reason: 'missing_required_keys', missing };

  if (value.version !== BRIEFING_VERSION) {
    return { valid: false, reason: 'invalid_version', version: value.version };
  }

  if (value.title !== 'Executive Diagnostic Briefing') {
    return { valid: false, reason: 'invalid_title', title: value.title };
  }

  if (typeof value.briefing_markdown !== 'string' || value.briefing_markdown.trim().length < 3000) {
    return { valid: false, reason: 'briefing_markdown_too_short' };
  }

  if (!Array.isArray(value.sections) || value.sections.length < 10) {
    return { valid: false, reason: 'sections_missing_or_too_few' };
  }

  const malformedSection = value.sections.find(
    (section) =>
      !section ||
      typeof section !== 'object' ||
      !section.key ||
      !section.title ||
      typeof section.body !== 'string' ||
      section.body.trim().length < 80
  );

  if (malformedSection) {
    return { valid: false, reason: 'malformed_section', section: malformedSection?.key || malformedSection?.title };
  }

  return { valid: true };
}

async function callOpenAIForBriefing(prompt) {
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
      max_completion_tokens: 12000
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let redis;
  try {
    const { assessment_id, owner_profile_id } = req.body || {};

    if (!assessment_id && !owner_profile_id) {
      return res.status(400).json({ ok: false, error: 'missing_assessment_id_or_profile_id' });
    }

    redis = createRedisClient();
    const assessmentId = await resolveAssessmentId(redis, { assessment_id, owner_profile_id });

    if (!assessmentId) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found' });
    }

    const rawAssessment = await redis.get(businessAssessmentKey(assessmentId));
    if (!rawAssessment) {
      return res.status(404).json({ ok: false, error: 'assessment_not_found', assessment_id: assessmentId });
    }

    const assessmentRecord = JSON.parse(rawAssessment);
    const ownerProfileId = assessmentRecord.owner_profile_id || owner_profile_id;
    const businessIntelligenceDraft = assessmentRecord.output?.business_intelligence_draft;

    if (!businessIntelligenceDraft) {
      return res.status(409).json({
        ok: false,
        error: 'missing_business_intelligence_draft',
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

    const prompt = buildExecutiveDiagnosticBriefingPrompt({
      assessmentRecord,
      businessIntelligenceDraft,
      canonicalProfile: profileLookup.dossier,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1
    });

    const generation = await callOpenAIForBriefing(prompt);
    const briefing = normalizeBriefingOutput(generation.parsed, {
      assessmentId,
      ownerProfileId,
      prompt
    });

    const validation = validateBriefingOutput(briefing);
    if (!validation.valid) {
      return res.status(502).json({
        ok: false,
        error: 'invalid_briefing_output',
        validation,
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId
      });
    }

    const now = new Date().toISOString();
    const updatedRecord = {
      ...assessmentRecord,
      status: 'executive_diagnostic_briefing_ready',
      updated_at: now,
      output: {
        ...(assessmentRecord.output || {}),
        executive_diagnostic_briefing_v1: briefing
      },
      metadata: {
        ...(assessmentRecord.metadata || {}),
        briefing_version: BRIEFING_VERSION,
        briefing_generated_at: now,
        briefing_model: generation.model,
        briefing_usage: generation.usage
      }
    };

    await redis.set(businessAssessmentKey(assessmentId), JSON.stringify(updatedRecord));

    return res.status(200).json({
      ok: true,
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      status: 'executive_diagnostic_briefing_ready',
      executive_diagnostic_briefing_v1: briefing
    });
  } catch (error) {
    console.error('[BUSINESS-ASSESSMENT-BRIEFING] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'briefing_generation_failed',
      detail: error.message || 'Unknown briefing generation error',
      code: error.code,
      status: error.status,
      details: error.details
    });
  } finally {
    if (redis) await redis.disconnect();
  }
}
