import snapshotHandler from './darren-intelligence-snapshot.js';

const DEFAULT_ADMIN_CODE = 'MOREADMIN26';
const DEFAULT_GENERATION_MODEL = 'gpt-4o-2024-08-06';
const GENERATION_TIMEOUT_MS = 70000;
const GENERATION_MAX_TOKENS = 5000;
const REQUIRED_FUTURE_NAMES = [
  'Conservative Continuation',
  'Dashboard-Led Sales Traction',
  'Channel Distribution Acceleration',
  'Strategic Partner Capital Acceleration',
  'Full V2 Leadership Intelligence Company Path'
];
const REQUIRED_TRUTH_BOUNDARIES = [
  'Valuation assumptions are not guarantees.',
  'Partner interest is not funding.',
  'Funding conversations are not revenue.',
  'Channel access is not adoption.',
  'Audience reach is not revenue.',
  'RRG readiness is not live until tracked.',
  'Cross-vertical expansion is hypothesis until evidenced.',
  'Paid/free/revenue fields are unavailable until indexed.'
];
const FORBIDDEN_OUTPUT_FRAGMENTS = [
  ['canonical', 'dossier'],
  ['canonical', 'profile', 'json'],
  ['canonical', 'profile', 'text'],
  ['assessment', 'answers'],
  ['raw', 'answers'],
  ['role', 'lane'],
  ['d' + 'j', 'context'],
  ['d' + 'j'],
  ['d' + '.j.'],
  ['steve', 'jobs'],
  ['w' + 'oz'],
  ['lane', 'policing'],
  ['lane', 'check'],
  ['stay', 'in', 'your', 'lane'],
  ['stay', 'in', 'lane']
].map((parts) => parts.join('_'));

function setJsonHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Code');
}

function configuredAdminCode() {
  return process.env.MOREMINDMAP_ADMIN_DASHBOARD_CODE || DEFAULT_ADMIN_CODE;
}

function configuredGenerationModel() {
  const explicitModel = String(process.env.DARREN_INTELLIGENCE_OPENAI_MODEL || '').trim();
  const sharedModel = String(process.env.OPENAI_MODEL || '').trim();
  const selected = explicitModel || sharedModel || DEFAULT_GENERATION_MODEL;

  if (!/^[A-Za-z0-9._:-]+$/.test(selected)) return DEFAULT_GENERATION_MODEL;
  return selected;
}

function usesCompletionTokenParameter(model) {
  return /^(gpt-5|o[134]|o\d|chatgpt-4o)/i.test(model);
}

function getProvidedAdminCode(req) {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return (
    req.headers['x-admin-code'] ||
    req.query?.admin_code ||
    req.query?.code ||
    ''
  ).toString().trim();
}

function extractJsonObject(content) {
  if (!content) throw new Error('empty_model_response');
  const trimmed = String(content).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) throw new Error('model_response_not_json');
    return JSON.parse(trimmed.slice(first, last + 1));
  }
}

function createCaptureResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

async function loadSnapshot(req) {
  const capture = createCaptureResponse();
  await snapshotHandler(
    {
      ...req,
      method: 'GET',
      query: {
        ...(req.query || {}),
        code: undefined,
        admin_code: undefined
      }
    },
    capture
  );

  if (capture.statusCode !== 200 || !capture.body?.ok) {
    const error = new Error(capture.body?.error || 'snapshot_unavailable');
    error.status = capture.statusCode || 500;
    error.safeError = capture.body?.error || 'snapshot_unavailable';
    throw error;
  }

  return capture.body;
}

function buildPrompt(snapshot) {
  const safeSnapshot = {
    snapshot_version: snapshot.snapshot_version,
    generated_at: snapshot.generated_at,
    darren: {
      profile_id: snapshot.darren?.profile_id,
      behavioral_identity: snapshot.darren?.behavioral_identity,
      operating_mode: snapshot.darren?.operating_mode,
      operating_advantage: snapshot.darren?.operating_advantage,
      operating_risk: snapshot.darren?.operating_risk,
      purposeful_scale_recommendation: snapshot.darren?.purposeful_scale_recommendation
    },
    strategic_goal: snapshot.strategic_goal,
    current_dashboard_context: snapshot.current_dashboard_context,
    build_map_context: snapshot.build_map_context,
    e_to_p_lens: snapshot.e_to_p_lens,
    path_comparison: snapshot.path_comparison,
    evidence_gaps: snapshot.evidence_gaps,
    next_proof_targets: snapshot.next_proof_targets,
    what_not_to_overclaim: snapshot.what_not_to_overclaim,
    unavailable_fields: snapshot.unavailable_fields
  };

  return {
    messages: [
      {
        role: 'system',
        content: [
          'You generate source-labeled strategic intelligence for Darren inside MORE MindMap.',
          'Return only valid JSON. Do not include markdown.',
          'No chat. No motivational fluff. No fake certainty.',
          'Do not mention backstage product/build governance, celebrity comparisons, lane policing, or supervisory framing.',
          'Darren-facing language must feel empowering and centered on his momentum, strategy, opportunity map, sales story, strongest path, and next proof target.',
          'Truth boundaries are mandatory: valuation assumptions are not guarantees; partner interest is not funding; funding conversations are not revenue; channel access is not adoption; audience reach is not revenue; RRG readiness is not live until tracked; cross-vertical expansion is hypothesis until evidenced; paid/free/revenue fields are unavailable until indexed.'
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          task: 'Generate Darren actual MMM + RRG Five Futures and One Move from the sanitized Darren Intelligence Snapshot.',
          required_future_names: REQUIRED_FUTURE_NAMES,
          required_schema: {
            ok: true,
            generated_at: 'ISO timestamp',
            source_snapshot_version: 'string',
            darren_profile_id: 'string',
            five_futures: [
              {
                name: 'required future name',
                summary: 'string',
                current_evidence: 'string',
                missing_evidence: 'string',
                likely_bottleneck: 'string',
                upside: 'string',
                danger: 'string',
                what_makes_it_more_likely: 'string',
                what_would_invalidate_it: 'string',
                e_to_p_shift: 'string',
                sales_story: 'string',
                what_not_to_overclaim: 'string'
              }
            ],
            one_move: {
              title: 'string',
              summary: 'string',
              why_this_move: 'string',
              exact_action: 'string',
              proof_target: 'string',
              expected_signal: 'string',
              what_to_say: 'string',
              what_not_to_say: 'string',
              timeframe: 'string',
              success_condition: 'string'
            },
            evidence_gaps: ['string'],
            next_proof_targets: ['string'],
            truth_boundaries: REQUIRED_TRUTH_BOUNDARIES,
            model_limits: ['string']
          },
          grounding_snapshot: safeSnapshot
        })
      }
    ]
  };
}

async function callOpenAIForDarrenIntelligence(snapshot) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'missing_openai_api_key';
    throw error;
  }

  const model = configuredGenerationModel();
  const tokenParameter = usesCompletionTokenParameter(model)
    ? { max_completion_tokens: GENERATION_MAX_TOKENS }
    : { max_tokens: GENERATION_MAX_TOKENS };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: buildPrompt(snapshot).messages,
      response_format: { type: 'json_object' },
      ...tokenParameter
    }),
    signal: controller.signal
  }).catch((error) => {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Darren intelligence generation timed out');
      timeoutError.code = 'darren_intelligence_generation_timeout';
      throw timeoutError;
    }
    throw error;
  }).finally(() => clearTimeout(timeout));

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('OpenAI request failed');
    error.code = 'darren_intelligence_model_request_failed';
    error.status = response.status;
    error.model = model;
    error.openai_error_type = data?.error?.type || null;
    error.openai_error_code = data?.error?.code || null;
    throw error;
  }

  let parsed;
  try {
    parsed = extractJsonObject(data?.choices?.[0]?.message?.content);
  } catch (error) {
    error.code = 'darren_intelligence_model_response_invalid';
    error.model = model;
    throw error;
  }

  return {
    parsed,
    model: data.model || model,
    usage: data.usage || null
  };
}

function logSafeGenerationDiagnostic(stage, details = {}) {
  console.warn('[DARREN_INTELLIGENCE_GENERATE]', {
    generation_stage: stage,
    error_code: details.error_code || null,
    http_status: details.http_status || null,
    model: details.model || null,
    snapshot_loaded: details.snapshot_loaded === true,
    openai_responded: details.openai_responded === true,
    parsing_failed: details.parsing_failed === true,
    privacy_scan_failed: details.privacy_scan_failed === true
  });
}

function hasForbiddenExposure(value) {
  const serialized = JSON.stringify(value || {}).toLowerCase().replace(/\s+/g, '_');
  return FORBIDDEN_OUTPUT_FRAGMENTS.some((fragment) => serialized.includes(fragment));
}

function normalizeString(value, fallback = 'Unavailable') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeFuture(future, index) {
  const requiredName = REQUIRED_FUTURE_NAMES[index] || normalizeString(future?.name, 'Future');
  return {
    name: requiredName,
    summary: normalizeString(future?.summary),
    current_evidence: normalizeString(future?.current_evidence),
    missing_evidence: normalizeString(future?.missing_evidence),
    likely_bottleneck: normalizeString(future?.likely_bottleneck),
    upside: normalizeString(future?.upside),
    danger: normalizeString(future?.danger),
    what_makes_it_more_likely: normalizeString(future?.what_makes_it_more_likely),
    what_would_invalidate_it: normalizeString(future?.what_would_invalidate_it),
    e_to_p_shift: normalizeString(future?.e_to_p_shift),
    sales_story: normalizeString(future?.sales_story),
    what_not_to_overclaim: normalizeString(future?.what_not_to_overclaim)
  };
}

function normalizeGeneratedIntelligence(parsed, snapshot, modelResult) {
  const futures = Array.isArray(parsed?.five_futures) ? parsed.five_futures : [];
  const normalizedFutures = REQUIRED_FUTURE_NAMES.map((name, index) => normalizeFuture(futures[index] || { name }, index));
  const oneMove = parsed?.one_move || {};
  const normalized = {
    ok: true,
    generated_at: new Date().toISOString(),
    source_snapshot_version: snapshot.snapshot_version,
    darren_profile_id: snapshot.darren?.profile_id || null,
    five_futures: normalizedFutures,
    one_move: {
      title: normalizeString(oneMove.title, 'This Week: Prove The Strongest Path'),
      summary: normalizeString(oneMove.summary),
      why_this_move: normalizeString(oneMove.why_this_move),
      exact_action: normalizeString(oneMove.exact_action),
      proof_target: normalizeString(oneMove.proof_target),
      expected_signal: normalizeString(oneMove.expected_signal),
      what_to_say: normalizeString(oneMove.what_to_say),
      what_not_to_say: normalizeString(oneMove.what_not_to_say),
      timeframe: normalizeString(oneMove.timeframe, 'This week'),
      success_condition: normalizeString(oneMove.success_condition)
    },
    evidence_gaps: Array.isArray(parsed?.evidence_gaps) ? parsed.evidence_gaps.map((item) => normalizeString(item)).slice(0, 12) : snapshot.evidence_gaps,
    next_proof_targets: Array.isArray(parsed?.next_proof_targets) ? parsed.next_proof_targets.map((item) => normalizeString(item)).slice(0, 12) : snapshot.next_proof_targets,
    truth_boundaries: REQUIRED_TRUTH_BOUNDARIES,
    model_limits: Array.isArray(parsed?.model_limits) ? parsed.model_limits.map((item) => normalizeString(item)).slice(0, 12) : [
      'Generated from the current Darren Intelligence Snapshot only.',
      'No verified revenue, RRG activity, partner capital pipeline, or channel adoption data is available yet.',
      'This is strategic intelligence, not a guarantee.'
    ],
    persistence: {
      saved: false,
      reason: 'return_only_v1_no_redis_persistence'
    }
  };

  if (hasForbiddenExposure(normalized)) {
    const error = new Error('generated_output_failed_privacy_scan');
    error.code = 'generated_output_failed_privacy_scan';
    throw error;
  }

  return normalized;
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_generation_access_denied' });
  }

  try {
    const snapshot = await loadSnapshot(req);
    const modelResult = await callOpenAIForDarrenIntelligence(snapshot);
    const generated = normalizeGeneratedIntelligence(modelResult.parsed, snapshot, modelResult);
    return res.status(200).json(generated);
  } catch (error) {
    if (error?.safeError) {
      logSafeGenerationDiagnostic('snapshot_load_failed', {
        error_code: error.safeError,
        http_status: error.status,
        snapshot_loaded: false
      });
      return res.status(error.status || 500).json({ ok: false, error: error.safeError });
    }
    if (error?.code === 'missing_openai_api_key') {
      logSafeGenerationDiagnostic('model_not_configured', {
        error_code: error.code,
        snapshot_loaded: true
      });
      return res.status(503).json({ ok: false, error: 'darren_intelligence_model_not_configured' });
    }
    if (error?.code === 'darren_intelligence_generation_timeout') {
      logSafeGenerationDiagnostic('model_timeout', {
        error_code: error.code,
        model: configuredGenerationModel(),
        snapshot_loaded: true
      });
      return res.status(504).json({ ok: false, error: 'darren_intelligence_generation_timeout' });
    }
    if (error?.code === 'darren_intelligence_model_request_failed') {
      logSafeGenerationDiagnostic('model_request_failed', {
        error_code: error.openai_error_code || error.openai_error_type || error.code,
        http_status: error.status,
        model: error.model,
        snapshot_loaded: true,
        openai_responded: true
      });
      return res.status(502).json({ ok: false, error: 'darren_intelligence_model_request_failed' });
    }
    if (error?.code === 'darren_intelligence_model_response_invalid') {
      logSafeGenerationDiagnostic('model_response_invalid', {
        error_code: error.code,
        model: error.model,
        snapshot_loaded: true,
        openai_responded: true,
        parsing_failed: true
      });
      return res.status(502).json({ ok: false, error: 'darren_intelligence_model_response_invalid' });
    }
    if (error?.code === 'generated_output_failed_privacy_scan') {
      logSafeGenerationDiagnostic('privacy_scan_failed', {
        error_code: error.code,
        model: configuredGenerationModel(),
        snapshot_loaded: true,
        openai_responded: true,
        privacy_scan_failed: true
      });
      return res.status(502).json({ ok: false, error: 'darren_intelligence_generation_failed_privacy_scan' });
    }
    logSafeGenerationDiagnostic('unhandled_generation_failure', {
      error_code: error?.code || 'unhandled_generation_failure',
      model: configuredGenerationModel()
    });
    return res.status(500).json({ ok: false, error: 'darren_intelligence_generation_failed' });
  }
}
