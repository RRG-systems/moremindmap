/**
 * dd-role-fit-evidence-interpretation.js
 *
 * Secure server-side GPT evidence interpreter for District Director Role Fit.
 * POST /api/leadership/dd-role-fit-evidence-interpretation
 *
 * - Never exposes API keys client-side
 * - Interprets free-text evidence only (does not mutate profiles / Redis)
 * - Returns structured JSON for deterministic bounded scoring
 * - Fail closed: missing key / model error → non-OK response (client falls back)
 *
 * Model selection (role-fit local only — does not change global model registry):
 *   ROLE_FIT_MODEL → OPENAI_MODEL → BOS_REPORT_MODEL → default gpt-5.5
 */

const ROUTE_NAME = 'leadership.dd_role_fit_evidence';
const DEFAULT_MODEL = 'gpt-5.5';
const MODEL_TIMEOUT_MS = 28000;
const MAX_EVIDENCE_CHARS = 4000;
const MAX_CONTEXT_CHARS = 6000;

const ALLOWED_CLASSIFICATIONS = new Set(['positive', 'negative', 'mixed', 'neutral']);
const ALLOWED_DIRECTIONS = new Set(['positive', 'negative']);
const ALLOWED_SEVERITIES = new Set(['low', 'moderate', 'high']);
const ALLOWED_DURATIONS = new Set(['one_time', 'recent', 'sustained', 'unknown']);
const ALLOWED_FIT_ADJ = new Set([
  'increase_materially',
  'increase_modestly',
  'no_change',
  'decrease_modestly',
  'decrease_materially',
]);
const ALLOWED_RISK_ADJ = new Set(['increase', 'no_change', 'decrease']);

const CANONICAL_DIMENSIONS = [
  'Recruiting / Growth Drive',
  'Accountability / Follow-through',
  'Agent Support / Service Orientation',
  'Compliance Discipline',
  'Training / Communication',
  'Operational Responsiveness',
  'Partner / Ecosystem Advocacy',
];

const DIMENSION_ALIASES = {
  'recruiting / growth drive': 'Recruiting / Growth Drive',
  'recruiting / growth': 'Recruiting / Growth Drive',
  recruiting: 'Recruiting / Growth Drive',
  growth: 'Recruiting / Growth Drive',
  'accountability / follow-through': 'Accountability / Follow-through',
  accountability: 'Accountability / Follow-through',
  'agent support / service orientation': 'Agent Support / Service Orientation',
  'agent support': 'Agent Support / Service Orientation',
  'compliance discipline': 'Compliance Discipline',
  compliance: 'Compliance Discipline',
  'compliance / operations': 'Compliance Discipline',
  'training / communication': 'Training / Communication',
  training: 'Training / Communication',
  'operational responsiveness': 'Operational Responsiveness',
  operations: 'Operational Responsiveness',
  'partner / ecosystem advocacy': 'Partner / Ecosystem Advocacy',
  'partner advocacy': 'Partner / Ecosystem Advocacy',
};

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Role-Fit-Access-Code');
  res.setHeader('Cache-Control', 'no-store');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function sanitizeModelName(value, fallback) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed.length > 128) return fallback;
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return fallback;
  return trimmed;
}

/**
 * Role-fit local model resolution. Does not mutate MODEL_REGISTRY.
 * Priority: ROLE_FIT_MODEL → OPENAI_MODEL → BOS_REPORT_MODEL → default.
 */
function resolveRoleFitModel() {
  const candidates = [
    { env: 'ROLE_FIT_MODEL', value: process.env.ROLE_FIT_MODEL },
    { env: 'OPENAI_MODEL', value: process.env.OPENAI_MODEL },
    { env: 'BOS_REPORT_MODEL', value: process.env.BOS_REPORT_MODEL },
  ];
  for (const c of candidates) {
    if (c.value !== undefined && c.value !== null && String(c.value).trim() !== '') {
      return {
        model: sanitizeModelName(c.value, DEFAULT_MODEL),
        model_source: 'env',
        env_var: c.env,
      };
    }
  }
  return {
    model: DEFAULT_MODEL,
    model_source: 'default',
    env_var: null,
  };
}

function usesCompletionTokenParameter(model) {
  return /^(gpt-5|o\d|o[134]|chatgpt-4o)/i.test(String(model || ''));
}

function normalizeDimension(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  if (CANONICAL_DIMENSIONS.includes(raw)) return raw;
  const alias = DIMENSION_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  // fuzzy contains
  const lower = raw.toLowerCase();
  for (const dim of CANONICAL_DIMENSIONS) {
    if (lower.includes(dim.toLowerCase().split('/')[0].trim().toLowerCase())) {
      return dim;
    }
  }
  return null;
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

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

function normalizeSignal(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const dimension = normalizeDimension(raw.dimension);
  const direction = ALLOWED_DIRECTIONS.has(String(raw.direction || '').toLowerCase())
    ? String(raw.direction).toLowerCase()
    : null;
  const severity = ALLOWED_SEVERITIES.has(String(raw.severity || '').toLowerCase())
    ? String(raw.severity).toLowerCase()
    : 'moderate';
  const duration = ALLOWED_DURATIONS.has(String(raw.duration || '').toLowerCase())
    ? String(raw.duration).toLowerCase()
    : 'unknown';
  const summary = cleanText(raw.summary, 280);
  if (!dimension || !direction || !summary) return null;
  return { dimension, direction, severity, duration, summary };
}

function normalizeInterpretation(parsed) {
  const classificationRaw = String(parsed?.classification || 'neutral').toLowerCase();
  const classification = ALLOWED_CLASSIFICATIONS.has(classificationRaw)
    ? classificationRaw
    : 'neutral';

  const signals = Array.isArray(parsed?.signals)
    ? parsed.signals.map(normalizeSignal).filter(Boolean).slice(0, 12)
    : [];

  const affectedFromPayload = Array.isArray(parsed?.affected_dimensions)
    ? parsed.affected_dimensions.map(normalizeDimension).filter(Boolean)
    : [];
  const affectedFromSignals = signals.map((s) => s.dimension);
  const affected_dimensions = Array.from(
    new Set([...affectedFromPayload, ...affectedFromSignals]),
  ).filter((d) => CANONICAL_DIMENSIONS.includes(d));

  const ra = parsed?.recommended_adjustments && typeof parsed.recommended_adjustments === 'object'
    ? parsed.recommended_adjustments
    : {};

  const fitAdj = (key, fallback = 'no_change') => {
    const v = String(ra[key] || fallback).toLowerCase();
    return ALLOWED_FIT_ADJ.has(v) ? v : fallback;
  };
  const riskAdj = (key, fallback = 'no_change') => {
    const v = String(ra[key] || fallback).toLowerCase();
    return ALLOWED_RISK_ADJ.has(v) ? v : fallback;
  };

  // Guardrail: empty/unrelated → force neutral recommendations
  let recommended_adjustments = {
    growth_fit: fitAdj('growth_fit'),
    evidence_adjusted_fit: fitAdj('evidence_adjusted_fit'),
    overall_fit: fitAdj('overall_fit'),
    compliance_ops_risk: riskAdj('compliance_ops_risk'),
    support_required: riskAdj('support_required'),
  };

  if (classification === 'neutral') {
    recommended_adjustments = {
      growth_fit: 'no_change',
      evidence_adjusted_fit: 'no_change',
      overall_fit: 'no_change',
      compliance_ops_risk: 'no_change',
      support_required: 'no_change',
    };
  }

  return {
    classification,
    confidence: clampConfidence(parsed?.confidence),
    affected_dimensions,
    signals,
    recommended_adjustments,
    plain_english_summary: cleanText(
      parsed?.plain_english_summary || 'No material role-fit evidence signal detected.',
      600,
    ),
    board_safe_interpretation: cleanText(
      parsed?.board_safe_interpretation ||
        'Evidence interpretation is advisory. Deterministic scoring remains the scoring guardrail.',
      600,
    ),
    guardrail_note: cleanText(
      parsed?.guardrail_note ||
        'GPT interprets evidence only. Deterministic code applies bounded score adjustments. Behavioral Fit baseline is preserved.',
      400,
    ),
  };
}

function buildSystemPrompt() {
  return [
    'You are the MORE MindMap District Director Role Fit evidence interpreter.',
    'Interpret free-text performance evidence for a real-estate District Director seat.',
    'Return STRICT JSON only matching the schema. No markdown. No prose outside JSON.',
    '',
    'Classification rules:',
    '- positive: clear recruiting/growth excellence or material constructive performance signal',
    '- negative: clear underperformance, below-standard recruiting, watch-list, compliance/support failures',
    '- mixed: both constructive and concerning role-relevant signals',
    '- neutral: empty, vague, or unrelated to DD role performance',
    '',
    'Natural language MUST be understood. Examples of negative free-text that must classify negative:',
    '- "DARREN HAS BEEN BELOW RECRUITING STANDARDS FOR THE LAST 3 YEARS BY 10%"',
    '- "this person isn\'t a very good recruiter and has been on my watch list for three years"',
    '',
    'Positive examples that must classify positive:',
    '- "was the number 1 recruiter at fathom in 2025"',
    '- "was a top 10% recruiter at Fathom"',
    '',
    'Mixed examples:',
    '- "was a top 10% recruiter at Fathom but has recurring compliance document review delays"',
    '',
    'Guardrails:',
    '- Do NOT invent facts beyond the evidence text.',
    '- Do NOT alter or invent BOS profile data.',
    '- Do NOT output final numeric scores.',
    '- Recommend only bounded adjustment categories (not point values).',
    '- Prefer sustained duration when multi-year / last 3 years language is present.',
    '- Recruiting underperformance should map to Recruiting / Growth Drive and decrease_materially (or modestly if mild).',
    '',
    'JSON schema keys exactly:',
    '{',
    '  "classification": "positive|negative|mixed|neutral",',
    '  "confidence": 0.0-1.0,',
    '  "affected_dimensions": [canonical dimension labels],',
    '  "signals": [{ "dimension", "direction":"positive|negative", "severity":"low|moderate|high", "duration":"one_time|recent|sustained|unknown", "summary" }],',
    '  "recommended_adjustments": {',
    '    "growth_fit": "increase_materially|increase_modestly|no_change|decrease_modestly|decrease_materially",',
    '    "evidence_adjusted_fit": same set,',
    '    "overall_fit": same set,',
    '    "compliance_ops_risk": "increase|no_change|decrease",',
    '    "support_required": "increase|no_change|decrease"',
    '  },',
    '  "plain_english_summary": string,',
    '  "board_safe_interpretation": string,',
    '  "guardrail_note": string',
    '}',
    '',
    `Canonical dimensions: ${CANONICAL_DIMENSIONS.join('; ')}`,
  ].join('\n');
}

function buildUserPrompt({ evidenceText, deterministicContext, profileId, roleModelId }) {
  const ctx =
    deterministicContext && typeof deterministicContext === 'object'
      ? deterministicContext
      : {};
  return JSON.stringify(
    {
      task: 'interpret_dd_role_fit_performance_evidence',
      evidence_text: evidenceText,
      profile_id: profileId || null,
      role_model_id: roleModelId || 'fathom_district_director_v1',
      deterministic_context: {
        role_label: ctx.role_label || 'Fathom District Director',
        primary_economic_lever: ctx.primary_economic_lever || 'Recruiting / Growth',
        behavioral_fit_note:
          ctx.behavioral_fit_note ||
          'Behavioral Fit is BOS-only baseline and must remain visible; GPT does not replace it.',
        available_dimensions: CANONICAL_DIMENSIONS,
        notes: cleanText(ctx.notes || '', 1500),
      },
      output_requirement: 'structured_json_only',
    },
    null,
    2,
  ).slice(0, MAX_CONTEXT_CHARS + MAX_EVIDENCE_CHARS + 2000);
}

async function callOpenAiJson({ apiKey, model, systemPrompt, userPrompt }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  // Match established production OpenAI routes (universal-translator, BA futures):
  // gpt-5 / o-series use max_completion_tokens and reject custom temperature.
  const isGpt5Family = usesCompletionTokenParameter(model);
  const tokenParam = isGpt5Family
    ? { max_completion_tokens: 1400 }
    : { max_tokens: 1400 };

  try {
    const body = {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...tokenParam,
    };
    if (!isGpt5Family) {
      body.temperature = 0.2;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Do not leak response body (may contain sensitive diagnostics)
      const err = new Error('openai_request_failed');
      err.status = response.status;
      err.safeCode =
        response.status === 400
          ? 'model_rejection'
          : response.status === 401 || response.status === 403
            ? 'openai_auth_failed'
            : response.status === 429
              ? 'openai_rate_limited'
              : 'openai_request_failed';
      throw err;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      const err = new Error('openai_empty_content');
      err.safeCode = 'openai_empty_content';
      throw err;
    }
    return content;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const err = new Error('openai_timeout');
      err.safeCode = 'openai_timeout';
      throw err;
    }
    if (error?.safeCode) throw error;
    const err = new Error('openai_request_failed');
    err.safeCode = 'openai_request_failed';
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'method_not_allowed',
      message: 'POST only',
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[DD_ROLE_FIT_EVIDENCE] OPENAI_API_KEY not configured');
    return res.status(503).json({
      ok: false,
      error: 'model_not_configured',
      message: 'GPT evidence interpretation unavailable.',
      fallback_recommended: true,
    });
  }

  const body = parseBody(req);
  const evidenceText = cleanText(body.evidence_text ?? body.evidenceText ?? '', MAX_EVIDENCE_CHARS);
  const profileId = cleanText(body.profile_id ?? body.profileId ?? '', 64);
  const roleModelId = cleanText(
    body.role_model_id ?? body.roleModelId ?? 'fathom_district_director_v1',
    80,
  );
  const deterministicContext =
    body.deterministic_context && typeof body.deterministic_context === 'object'
      ? body.deterministic_context
      : body.deterministicContext && typeof body.deterministicContext === 'object'
        ? body.deterministicContext
        : {};

  // Empty evidence → deterministic-equivalent neutral without model call
  if (!evidenceText) {
    return res.status(200).json({
      ok: true,
      interpretation_source: 'empty_evidence',
      model_used: null,
      model_source: null,
      model_env_var: null,
      route_name: ROUTE_NAME,
      interpretation: normalizeInterpretation({
        classification: 'neutral',
        confidence: 1,
        affected_dimensions: [],
        signals: [],
        recommended_adjustments: {
          growth_fit: 'no_change',
          evidence_adjusted_fit: 'no_change',
          overall_fit: 'no_change',
          compliance_ops_risk: 'no_change',
          support_required: 'no_change',
        },
        plain_english_summary: 'No external performance evidence entered.',
        board_safe_interpretation:
          'No free-text evidence was provided. Deterministic baseline scoring applies.',
        guardrail_note:
          'Empty evidence path. GPT was not called. Deterministic scoring remains authoritative.',
      }),
      interpreted_at: new Date().toISOString(),
    });
  }

  const modelResolution = resolveRoleFitModel();
  const model = modelResolution.model;

  try {
    const content = await callOpenAiJson({
      apiKey,
      model,
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt({
        evidenceText,
        deterministicContext,
        profileId,
        roleModelId,
      }),
    });

    const parsed = extractJsonObject(content);
    const interpretation = normalizeInterpretation(parsed);

    return res.status(200).json({
      ok: true,
      interpretation_source: 'gpt',
      model_used: model,
      model_source: modelResolution.model_source,
      model_env_var: modelResolution.env_var,
      route_name: ROUTE_NAME,
      interpretation,
      interpreted_at: new Date().toISOString(),
      // Explicit non-mutation contract
      mutates_profile: false,
      mutates_redis: false,
      final_score_decided_by_gpt: false,
    });
  } catch (error) {
    console.error('[DD_ROLE_FIT_EVIDENCE] interpretation failed', {
      safe_code: error?.safeCode || error?.message || 'unknown',
      status: error?.status || null,
      model,
    });
    return res.status(503).json({
      ok: false,
      error: error?.safeCode || 'interpretation_failed',
      message: 'GPT evidence interpretation unavailable.',
      fallback_recommended: true,
      model_used: model,
      model_source: modelResolution.model_source,
    });
  }
}
