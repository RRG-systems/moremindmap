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
const MODEL = process.env.BUSINESS_ASSESSMENT_BRIEFING_MODEL || 'gpt-4o-2024-08-06';
const REQUIRED_SECTION_TITLES = [
  'Executive Readout',
  'Current Business Reality',
  'Behavioral Reality Applied to the Business',
  'Relationship / Database Reality',
  'Lead Generation Reality',
  'Lead Conversion / Follow-Up Reality',
  'Systems Reality',
  'Accountability Reality',
  'Financial Reality',
  'Team / Leadership Reality',
  'Contradictions and Blind Spots',
  'Primary Constraint',
  'Current Trajectory Signal',
  'Confidence / Missing Data',
  'Strategic Interpretation',
  'Preliminary One Move Direction'
];
const MINIMUM_BRIEFING_CHARACTERS = 12000;
const MINIMUM_BRIEFING_WORDS = 1800;
const MINIMUM_SECTION_BODY_WORDS = 90;

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
  const normalized = {
    ...parsed,
    version: parsed.version || BRIEFING_VERSION,
    generated_at: parsed.generated_at || now,
    assessment_id: parsed.assessment_id || assessmentId,
    owner_profile_id: parsed.owner_profile_id || ownerProfileId,
    title: parsed.title || 'Executive Diagnostic Briefing',
    audience_type: parsed.audience_type || prompt.audience_type,
    word_count_target: parsed.word_count_target || prompt.word_count_target
  };

  const sectionMarkdown = buildBriefingMarkdownFromSections(normalized);
  if (wordCount(sectionMarkdown) > wordCount(normalized.briefing_markdown)) {
    normalized.briefing_markdown = sectionMarkdown;
  }

  return normalized;
}

function buildBriefingMarkdownFromSections(value) {
  if (!value || !Array.isArray(value.sections) || !value.sections.length) {
    return String(value?.briefing_markdown || '').trim();
  }

  const parts = [`# ${value.title || 'Executive Diagnostic Briefing'}`];

  for (const section of value.sections) {
    if (!section || typeof section !== 'object') continue;
    const title = String(section.title || '').trim();
    const body = String(section.body || '').trim();
    if (!title && !body) continue;

    if (title) parts.push(`\n## ${title}`);
    if (body) parts.push(body);

    if (Array.isArray(section.evidence) && section.evidence.length) {
      parts.push(
        [
          'Evidence:',
          ...section.evidence
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, 6)
            .map((item) => `- ${item}`)
        ].join('\n')
      );
    }

    if (section.confidence) {
      parts.push(`Confidence: ${String(section.confidence).trim()}`);
    }
  }

  const caveats = Array.isArray(value.caveats)
    ? value.caveats.map((item) => String(item || '').trim()).filter(Boolean)
    : [String(value.caveats || '').trim()].filter(Boolean);
  if (caveats.length) {
    parts.push(`\n## Caveats\n${caveats.join('\n')}`);
  }

  return parts.join('\n\n').trim();
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function sectionWordCount(section) {
  const bodyWords = wordCount(section?.body);
  const evidenceWords = Array.isArray(section?.evidence) ? wordCount(section.evidence.join(' ')) : 0;
  return {
    bodyWords,
    combinedWords: bodyWords + evidenceWords
  };
}

function sectionTitleFingerprint(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bthe\b/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
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

  const briefingMarkdown = String(value.briefing_markdown || '').trim();
  const briefingWordCount = wordCount(briefingMarkdown);

  if (typeof value.briefing_markdown !== 'string' || briefingMarkdown.length < MINIMUM_BRIEFING_CHARACTERS) {
    return {
      valid: false,
      reason: 'briefing_markdown_too_short',
      minimum_characters: MINIMUM_BRIEFING_CHARACTERS,
      actual_characters: briefingMarkdown.length
    };
  }

  if (briefingWordCount < MINIMUM_BRIEFING_WORDS) {
    return {
      valid: false,
      reason: 'briefing_word_count_too_short',
      minimum_words: MINIMUM_BRIEFING_WORDS,
      actual_words: briefingWordCount
    };
  }

  if (!Array.isArray(value.sections) || value.sections.length < REQUIRED_SECTION_TITLES.length) {
    return {
      valid: false,
      reason: 'sections_missing_or_too_few',
      minimum_sections: REQUIRED_SECTION_TITLES.length,
      actual_sections: Array.isArray(value.sections) ? value.sections.length : 0
    };
  }

  const sectionText = [
    briefingMarkdown,
    ...value.sections.map((section) => `${section?.title || ''}\n${section?.body || ''}`)
  ].join('\n');
  const sectionTextFingerprint = sectionTitleFingerprint(sectionText);
  const missingSectionTitles = REQUIRED_SECTION_TITLES.filter(
    (title) =>
      !sectionText.includes(title) &&
      !sectionTextFingerprint.includes(sectionTitleFingerprint(title))
  );

  if (missingSectionTitles.length) {
    return {
      valid: false,
      reason: 'required_section_titles_missing',
      missing_section_titles: missingSectionTitles
    };
  }

  const malformedSection = value.sections.find((section) => {
    if (
      !section ||
      typeof section !== 'object' ||
      !section.key ||
      !section.title ||
      typeof section.body !== 'string'
    ) {
      return true;
    }

    const counts = sectionWordCount(section);
    return counts.bodyWords < 60 || counts.combinedWords < MINIMUM_SECTION_BODY_WORDS;
  });

  if (malformedSection) {
    const counts = sectionWordCount(malformedSection);
    return {
      valid: false,
      reason: 'malformed_or_thin_section',
      section: malformedSection?.key || malformedSection?.title,
      minimum_words: MINIMUM_SECTION_BODY_WORDS,
      actual_body_words: counts.bodyWords,
      actual_words: counts.combinedWords
    };
  }

  return { valid: true };
}

function shouldAttemptBriefingRepair(validation) {
  return [
    'briefing_markdown_too_short',
    'briefing_word_count_too_short',
    'malformed_or_thin_section'
  ].includes(validation?.reason);
}

function compactForRepair(value, maxLength = 36000) {
  const body = JSON.stringify(value ?? {}, null, 2);
  if (body.length <= maxLength) return body;
  return `${body.slice(0, maxLength)}\n[TRUNCATED ${body.length - maxLength} CHARACTERS]`;
}

function buildRepairPrompt(prompt, previousOutput, validation) {
  return {
    ...prompt,
    messages: [
      ...prompt.messages,
      {
        role: 'assistant',
        content: compactForRepair(previousOutput)
      },
      {
        role: 'user',
        content: [
          'The previous JSON output failed validation for the Executive Diagnostic Briefing.',
          `Validation failure: ${JSON.stringify(validation)}`,
          'Return one corrected complete JSON object with the same required top-level keys.',
          'Keep the product name exactly "Executive Diagnostic Briefing".',
          'Do not summarize briefly and do not use placeholder markdown.',
          'The briefing_markdown field must contain the full written briefing, not a pointer to the sections.',
          'The corrected output must be at least 12,000 characters and at least 1,800 words.',
          'Each of the 16 required sections must have a substantial body of at least 120 words.',
          'Preserve the same evidence and diagnostic conclusions, but expand the reasoning, implications, and missing-data explanation where needed.',
          'Return valid JSON only. No markdown fences.'
        ].join('\n')
      }
    ]
  };
}

function elapsed(startedAt) {
  return `${Date.now() - startedAt}ms`;
}

async function callOpenAIForBriefing(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'missing_openai_api_key';
    throw error;
  }

  const startedAt = Date.now();
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
      max_completion_tokens: 10000
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
    usage: data.usage || null,
    duration_ms: Date.now() - startedAt
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
  const requestStartedAt = Date.now();
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

    const promptStartedAt = Date.now();
    const prompt = buildExecutiveDiagnosticBriefingPrompt({
      assessmentRecord,
      businessIntelligenceDraft,
      canonicalProfile: profileLookup.dossier,
      realEstateBusinessModel: REAL_ESTATE_BUSINESS_MODEL_V1
    });
    console.log('[BUSINESS-ASSESSMENT-BRIEFING] Prompt built', {
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      model: MODEL,
      messages_characters: JSON.stringify(prompt.messages).length,
      word_count_target: prompt.word_count_target,
      duration: elapsed(promptStartedAt)
    });

    let generation = await callOpenAIForBriefing(prompt);
    console.log('[BUSINESS-ASSESSMENT-BRIEFING] OpenAI completed', {
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      model: generation.model,
      duration_ms: generation.duration_ms,
      usage: generation.usage || null
    });
    let briefing = normalizeBriefingOutput(generation.parsed, {
      assessmentId,
      ownerProfileId,
      prompt
    });

    let validation = validateBriefingOutput(briefing);
    if (!validation.valid && shouldAttemptBriefingRepair(validation)) {
      const repairPrompt = buildRepairPrompt(prompt, briefing, validation);
      console.log('[BUSINESS-ASSESSMENT-BRIEFING] Repairing briefing output', {
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId,
        reason: validation.reason
      });
      generation = await callOpenAIForBriefing(repairPrompt);
      console.log('[BUSINESS-ASSESSMENT-BRIEFING] Repair OpenAI completed', {
        assessment_id: assessmentId,
        owner_profile_id: ownerProfileId,
        model: generation.model,
        duration_ms: generation.duration_ms,
        usage: generation.usage || null
      });
      briefing = normalizeBriefingOutput(generation.parsed, {
        assessmentId,
        ownerProfileId,
        prompt
      });
      validation = validateBriefingOutput(briefing);
    }

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
    console.log('[BUSINESS-ASSESSMENT-BRIEFING] Saved briefing', {
      assessment_id: assessmentId,
      owner_profile_id: ownerProfileId,
      total_duration: elapsed(requestStartedAt)
    });

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
