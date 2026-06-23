import { buildDarrenIntelligenceSnapshot } from './darren-intelligence-snapshot-core.js';

const DEFAULT_ADMIN_CODE = 'MOREADMIN26';
const DEFAULT_GENERATION_MODEL = 'gpt-4o-2024-08-06';
const SAFE_DARREN_GENERATION_MODELS = new Set([
  'gpt-4o-2024-08-06',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o'
]);
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
const WEEKLY_TIMEFRAME_FALLBACK = 'Next 7 days';
const BROAD_TIMEFRAME_PATTERN = /\b(q[1-4]|quarter|later this year|eventually|someday|future quarter|next quarter|202[6-9]|203\d|annual|year[-\s]*long)\b/i;
const WEEKLY_TIMEFRAME_PATTERN = /\b(this week|next 7 days|seven days|by friday|before the next dashboard review|within 7 days|next week)\b/i;
const CONCRETE_ACTION_PATTERN = /\b(contact|call|ask|choose|pick|schedule|secure|request|send|meet|pilot|partner|brokerage|mortgage|channel|profiles?|assessments?|commit|audience access|next meeting|proof target)\b/i;
const GENERIC_PROOF_PATTERN = /\b(increase awareness|build momentum|create alignment|drive engagement|improve visibility|grow interest|explore opportunities|strengthen relationships)\b/i;
const GENERIC_CORPORATE_LANGUAGE_RULES = [
  { id: 'unlock_new_audiences', pattern: /\bunlock new audiences\b/i },
  { id: 'redefine_leadership_intelligence', pattern: /\bredefine leadership intelligence\b/i },
  { id: 'ensure_every_action_aligns', pattern: /\bensure every action aligns\b/i },
  { id: 'growth_trajectory_attracts', pattern: /\bgrowth trajectory attracts\b/i },
  { id: 'market_penetration', pattern: /\bmarket penetration\b/i },
  { id: 'strategic_alignment_faster_growth', pattern: /\bstrategic alignment\b.*\bfaster growth\b/i },
  { id: 'real_time_insights', pattern: /\breal[-\s]*time insights\b/i },
  { id: 'synergistic_growth', pattern: /\bsynerg(?:y|istic)\b/i }
];
const FORBIDDEN_OUTPUT_RULES = [
  { id: 'private_source_dossier', category: 'private_source_exposure', pattern: /canonical[\s_-]+dossier/i },
  { id: 'private_source_profile_json', category: 'private_source_exposure', pattern: /canonical[\s_-]+profile[\s_-]+json/i },
  { id: 'private_source_profile_text', category: 'private_source_exposure', pattern: /canonical[\s_-]+profile[\s_-]+text/i },
  { id: 'private_assessment_response_set', category: 'private_source_exposure', pattern: /assessment[\s_-]+answers/i },
  { id: 'private_answer_set', category: 'private_source_exposure', pattern: /raw[\s_-]+answers/i },
  { id: 'storage_key_exposure', category: 'storage_exposure', pattern: /\b(?:vault|business_assessment):[A-Za-z0-9:_-]+/i },
  { id: 'env_openai_key', category: 'env_exposure', pattern: /openai[\s_-]*api[\s_-]*key/i },
  { id: 'env_admin_code', category: 'env_exposure', pattern: /moremindmap[\s_-]*admin[\s_-]*dashboard[\s_-]*code/i },
  { id: 'prompt_exposure', category: 'prompt_exposure', pattern: /(?:system|developer|user)[\s_-]*prompt|raw[\s_-]*prompt/i },
  { id: 'provider_payload_phrase', category: 'model_output_exposure', pattern: /raw[\s_-]*model[\s_-]*output/i },
  { id: 'role_boundary_phrase', category: 'forbidden_framing', pattern: /\brole[\s_-]+lane\b/i },
  { id: 'boundary_policing_phrase', category: 'forbidden_framing', pattern: /\blane[\s_-]+check\b/i },
  { id: 'lane_policing_phrase', category: 'forbidden_framing', pattern: /\blane[\s_-]+policing\b/i },
  { id: 'stay_in_lane_phrase', category: 'forbidden_framing', pattern: /\bstay\s+in\s+(?:your\s+)?lane\b/i },
  { id: 'initials_context_phrase', category: 'forbidden_framing', pattern: /\bd\.?j\.?[\s_-]+context\b/i },
  { id: 'initials_only_phrase', category: 'forbidden_framing', pattern: /\bd\.j\.?\b|\bdj\b/i },
  { id: 'steve_jobs_comparison', category: 'forbidden_framing', pattern: /\bsteve\s+jobs\b/i },
  { id: 'woz_comparison', category: 'forbidden_framing', pattern: /\bwoz\b|\bwozniak\b/i }
];

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

  // Darren generation uses a route-specific safe model fallback because shared
  // OPENAI_MODEL may be set to a future/non-chat-compatible value.
  if (SAFE_DARREN_GENERATION_MODELS.has(explicitModel)) return explicitModel;
  return DEFAULT_GENERATION_MODEL;
}

function usesCompletionTokenParameter(model) {
  return /^(o[134]|o\d|chatgpt-4o)/i.test(model);
}

function getProvidedAdminCode(req) {
  const headers = req.headers || {};
  const authHeader = headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return (
    headers['x-admin-code'] ||
    req.query?.admin_code ||
    req.query?.code ||
    ''
  ).toString().trim();
}

function isSafeDebugMode(req) {
  const headers = req.headers || {};
  return req.query?.debug === '1' || String(headers['x-debug-mode'] || '').toLowerCase() === 'safe';
}

function createDiagnostic() {
  const model = configuredGenerationModel();
  const tokenParameter = usesCompletionTokenParameter(model) ? 'max_completion_tokens' : 'max_tokens';
  return {
    generation_stage: 'initialized',
    failure_stage: null,
    safe_error_code: null,
    http_status: null,
    model,
    token_parameter: tokenParameter,
    snapshot_loaded: false,
    snapshot_ok: false,
    openai_requested: false,
    openai_responded: false,
    parsing_failed: false,
    privacy_scan_failed: false,
    schema_validation_failed: false,
    safety_check_failed: false,
    safety_failure_code: null,
    safety_failure_category: null,
    failed_field_path: null,
    matched_rule_id: null,
    timeout: false,
    response_status: null,
    error_name: null
  };
}

function updateDiagnostic(diagnostic, generationStage, details = {}) {
  if (!diagnostic) return diagnostic;
  if (generationStage) diagnostic.generation_stage = generationStage;
  for (const key of [
    'failure_stage',
    'safe_error_code',
    'http_status',
    'model',
    'token_parameter',
    'snapshot_loaded',
    'snapshot_ok',
    'openai_requested',
    'openai_responded',
    'parsing_failed',
    'privacy_scan_failed',
    'schema_validation_failed',
    'safety_check_failed',
    'safety_failure_code',
    'safety_failure_category',
    'failed_field_path',
    'matched_rule_id',
    'timeout',
    'response_status',
    'error_name'
  ]) {
    if (Object.prototype.hasOwnProperty.call(details, key)) diagnostic[key] = details[key];
  }
  return diagnostic;
}

function safeErrorName(error) {
  const name = String(error?.name || 'Error')
    .replace(/[^A-Za-z0-9_:-]/g, '')
    .slice(0, 80);
  return name || 'Error';
}

function sendError(res, status, error, diagnostic, debugMode) {
  updateDiagnostic(diagnostic, diagnostic.generation_stage, {
    safe_error_code: error,
    http_status: status,
    response_status: status
  });
  const body = { ok: false, error };
  if (debugMode) body.diagnostic = { ...diagnostic };
  return res.status(status).json(body);
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

async function loadSnapshot(diagnostic) {
  updateDiagnostic(diagnostic, 'snapshot_load_started');
  try {
    const snapshot = await buildDarrenIntelligenceSnapshot();
    updateDiagnostic(diagnostic, 'snapshot_loaded', {
      snapshot_loaded: true,
      snapshot_ok: true
    });
    return snapshot;
  } catch (error) {
    const safeStatus = error?.status || 500;
    updateDiagnostic(diagnostic, null, {
      failure_stage: 'snapshot_builder_exception',
      safe_error_code: 'darren_intelligence_snapshot_builder_exception',
      http_status: safeStatus,
      response_status: safeStatus,
      snapshot_loaded: false,
      snapshot_ok: false,
      error_name: safeErrorName(error)
    });
    const wrapped = new Error('snapshot_builder_exception');
    wrapped.status = safeStatus;
    wrapped.safeError = 'darren_intelligence_snapshot_builder_exception';
    wrapped.safeErrorDetail = error?.code || null;
    throw wrapped;
  }
}

function buildPrompt(snapshot, diagnostic) {
  updateDiagnostic(diagnostic, 'prompt_built');
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
          'Write like a sharp operating memo for Darren, not corporate strategy filler.',
          'Make every future materially different and grounded in current evidence, missing proof, business model path, Darren Momentum Machine advantage, the E to P shift, and overclaim risk.',
          'For Conservative Continuation, frame disciplined V1 proof-building, not failure.',
          'For Dashboard-Led Sales Traction, treat the dashboard as evidence supporting the story, not the story itself.',
          'For Channel Distribution Acceleration, separate access from adoption.',
          'For Strategic Partner Capital Acceleration, separate interest from funding.',
          'For Full V2 Leadership Intelligence Company Path, separate roadmap from live capability.',
          'The One Move must be weekly: this week, next 7 days, by Friday, or before the next dashboard review. Never use a quarter, future quarter, later this year, or eventually.',
          'The One Move must name who or what partner category Darren should contact, what he should ask for, what measurable proof target he is creating, what signal counts, and what he must not claim.',
          'Sales story fields must be plain English Darren can use in a real partner conversation. Avoid corporate phrases like unlock new audiences, redefine leadership intelligence, or real-time insights.',
          'Use language like: interest is useful but it is not proof; the dashboard is evidence, not the whole story; create one measurable signal; sell the path and the proof, not V2 as live.',
          'Make the E to P move explicit: instinct to model, motion to system, interest to proof, access to adoption, conversation to commitment, excitement to measurable signal.',
          'The stable panels remain the source-labeled operating picture for future strategy chat. Do not write chat content now.',
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
          quality_requirements: {
            one_move_timeframe: 'must be this week, next 7 days, by Friday, or before the next dashboard review',
            one_move_exact_action: 'must name a person/category/company type, an ask, and a measurable proof target',
            one_move_proof_target: 'must define a measurable signal, not whether someone likes the idea',
            momentum_machine: 'Darren creates motion, opens doors, activates partners, and needs short-cycle proof targets',
            e_to_p: 'Entrepreneurial energy creates motion; Purposeful scale requires models, systems, tools, accountability, coaching, ongoing education, and no hubris'
          },
          language_requirements: {
            plain_english: true,
            avoid_corporate_filler: [
              'unlock new audiences',
              'redefine leadership intelligence',
              'ensure every action aligns',
              'growth trajectory attracts',
              'market penetration',
              'strategic alignment leading to faster growth',
              'real-time insights'
            ],
            future_chat_preparation: 'Generated panels are the grounded operating picture. Future chat may explore ideas, but the panels/snapshot remain the source-labeled truth layer.'
          },
          grounding_snapshot: safeSnapshot
        })
      }
    ]
  };
}

async function callOpenAIForDarrenIntelligence(snapshot, diagnostic) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error('OPENAI_API_KEY is not configured');
    error.code = 'missing_openai_api_key';
    throw error;
  }

  const model = configuredGenerationModel();
  const tokenParameter = usesCompletionTokenParameter(model)
    ? { max_completion_tokens: GENERATION_MAX_TOKENS }
    : { max_tokens: GENERATION_MAX_TOKENS };
  updateDiagnostic(diagnostic, 'openai_request_started', {
    model,
    token_parameter: Object.keys(tokenParameter)[0],
    openai_requested: true
  });
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
      messages: buildPrompt(snapshot, diagnostic).messages,
      response_format: { type: 'json_object' },
      ...tokenParameter
    }),
    signal: controller.signal
  }).catch((error) => {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Darren intelligence generation timed out');
      timeoutError.code = 'darren_intelligence_generation_timeout';
      updateDiagnostic(diagnostic, 'openai_request_timeout', {
        safe_error_code: timeoutError.code,
        model,
        timeout: true,
        openai_requested: true,
        openai_responded: false
      });
      throw timeoutError;
    }
    throw error;
  }).finally(() => clearTimeout(timeout));

  const data = await response.json().catch(() => ({}));
  updateDiagnostic(diagnostic, response.ok ? 'openai_response_received' : 'openai_response_failed', {
    response_status: response.status,
    openai_requested: true,
    openai_responded: true,
    model
  });
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
    updateDiagnostic(diagnostic, 'model_response_parse_started');
    parsed = extractJsonObject(data?.choices?.[0]?.message?.content);
    updateDiagnostic(diagnostic, 'model_response_parsed');
  } catch (error) {
    error.code = 'darren_intelligence_model_response_invalid';
    error.model = model;
    updateDiagnostic(diagnostic, 'model_response_invalid', {
      safe_error_code: error.code,
      parsing_failed: true,
      model,
      openai_responded: true
    });
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

function generatedUserFacingFields(generated) {
  return {
    five_futures: generated?.five_futures,
    one_move: generated?.one_move,
    evidence_gaps: generated?.evidence_gaps,
    next_proof_targets: generated?.next_proof_targets,
    truth_boundaries: generated?.truth_boundaries,
    model_limits: generated?.model_limits
  };
}

function findForbiddenExposure(value, path = 'generated') {
  if (typeof value === 'string') {
    for (const rule of FORBIDDEN_OUTPUT_RULES) {
      if (rule.pattern.test(value)) {
        return {
          safety_check_failed: true,
          safety_failure_code: 'generated_output_failed_privacy_scan',
          safety_failure_category: rule.category,
          failed_field_path: path,
          matched_rule_id: rule.id
        };
      }
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const result = findForbiddenExposure(value[index], `${path}[${index}]`);
      if (result) return result;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const result = findForbiddenExposure(child, `${path}.${key}`);
      if (result) return result;
    }
  }
  return null;
}

function validateGeneratedSchema(generated) {
  if (!Array.isArray(generated.five_futures) || generated.five_futures.length !== REQUIRED_FUTURE_NAMES.length) return false;
  const names = generated.five_futures.map((future) => future.name);
  if (!REQUIRED_FUTURE_NAMES.every((name) => names.includes(name))) return false;
  for (const future of generated.five_futures) {
    if (
      !future.summary ||
      !future.current_evidence ||
      !future.missing_evidence ||
      !future.likely_bottleneck ||
      !future.upside ||
      !future.danger ||
      !future.what_makes_it_more_likely ||
      !future.what_would_invalidate_it ||
      !future.e_to_p_shift ||
      !future.sales_story ||
      !future.what_not_to_overclaim
    ) return false;
  }
  if (!generated.one_move?.title || !generated.one_move?.exact_action || !generated.one_move?.proof_target) return false;
  if (!Array.isArray(generated.truth_boundaries) || generated.truth_boundaries.length < REQUIRED_TRUTH_BOUNDARIES.length) return false;
  return true;
}

function normalizeOneMoveTimeframe(value) {
  const text = normalizeString(value, WEEKLY_TIMEFRAME_FALLBACK);
  if (BROAD_TIMEFRAME_PATTERN.test(text)) return WEEKLY_TIMEFRAME_FALLBACK;
  return text;
}

function validateOneMoveQuality(oneMove = {}) {
  const timeframe = String(oneMove.timeframe || '');
  const exactAction = String(oneMove.exact_action || '');
  const proofTarget = String(oneMove.proof_target || '');
  const expectedSignal = String(oneMove.expected_signal || '');
  const whatToSay = String(oneMove.what_to_say || '');
  const whatNotToSay = String(oneMove.what_not_to_say || '');

  if (!WEEKLY_TIMEFRAME_PATTERN.test(timeframe)) {
    return {
      code: 'one_move_timeframe_not_weekly',
      category: 'one_move_weekly_validation',
      field: 'one_move.timeframe'
    };
  }
  if (exactAction.length < 80 || !CONCRETE_ACTION_PATTERN.test(exactAction)) {
    return {
      code: 'one_move_exact_action_not_concrete',
      category: 'one_move_concreteness_validation',
      field: 'one_move.exact_action'
    };
  }
  if (proofTarget.length < 50 || GENERIC_PROOF_PATTERN.test(proofTarget)) {
    return {
      code: 'one_move_proof_target_not_measurable',
      category: 'one_move_proof_validation',
      field: 'one_move.proof_target'
    };
  }
  if (expectedSignal.length < 35 || whatToSay.length < 35 || whatNotToSay.length < 35) {
    return {
      code: 'one_move_sales_fields_too_thin',
      category: 'one_move_sales_utility_validation',
      field: 'one_move'
    };
  }
  return null;
}

function findGenericCorporateLanguage(generated) {
  const fields = {
    'one_move.summary': generated?.one_move?.summary,
    'one_move.why_this_move': generated?.one_move?.why_this_move,
    'one_move.exact_action': generated?.one_move?.exact_action,
    'one_move.proof_target': generated?.one_move?.proof_target,
    'one_move.what_to_say': generated?.one_move?.what_to_say,
    'one_move.what_not_to_say': generated?.one_move?.what_not_to_say
  };

  for (let index = 0; index < generated.five_futures.length; index += 1) {
    fields[`five_futures[${index}].summary`] = generated.five_futures[index]?.summary;
    fields[`five_futures[${index}].sales_story`] = generated.five_futures[index]?.sales_story;
    fields[`five_futures[${index}].what_not_to_overclaim`] = generated.five_futures[index]?.what_not_to_overclaim;
  }

  for (const [field, value] of Object.entries(fields)) {
    const text = String(value || '');
    for (const rule of GENERIC_CORPORATE_LANGUAGE_RULES) {
      if (rule.pattern.test(text)) {
        return {
          code: 'generated_strategy_language_too_generic',
          category: 'language_quality_validation',
          field,
          rule: rule.id
        };
      }
    }
  }
  return null;
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

function normalizeGeneratedIntelligence(parsed, snapshot, modelResult, diagnostic) {
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
      timeframe: normalizeOneMoveTimeframe(oneMove.timeframe),
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

  if (!validateGeneratedSchema(normalized)) {
    updateDiagnostic(diagnostic, 'schema_validation_failed', {
      safe_error_code: 'darren_intelligence_schema_validation_failed',
      schema_validation_failed: true
    });
    const error = new Error('darren_intelligence_schema_validation_failed');
    error.code = 'darren_intelligence_schema_validation_failed';
    throw error;
  }

  const oneMoveQualityFailure = validateOneMoveQuality(normalized.one_move);
  if (oneMoveQualityFailure) {
    updateDiagnostic(diagnostic, 'schema_validation_failed', {
      safe_error_code: 'darren_intelligence_quality_validation_failed',
      schema_validation_failed: true,
      safety_check_failed: true,
      safety_failure_code: oneMoveQualityFailure.code,
      safety_failure_category: oneMoveQualityFailure.category,
      failed_field_path: oneMoveQualityFailure.field,
      matched_rule_id: oneMoveQualityFailure.code
    });
    const error = new Error('darren_intelligence_quality_validation_failed');
    error.code = 'darren_intelligence_quality_validation_failed';
    throw error;
  }

  const languageQualityFailure = findGenericCorporateLanguage(normalized);
  if (languageQualityFailure) {
    updateDiagnostic(diagnostic, 'schema_validation_failed', {
      safe_error_code: 'darren_intelligence_quality_validation_failed',
      schema_validation_failed: true,
      safety_check_failed: true,
      safety_failure_code: languageQualityFailure.code,
      safety_failure_category: languageQualityFailure.category,
      failed_field_path: languageQualityFailure.field,
      matched_rule_id: languageQualityFailure.rule
    });
    const error = new Error('darren_intelligence_quality_validation_failed');
    error.code = 'darren_intelligence_quality_validation_failed';
    throw error;
  }

  updateDiagnostic(diagnostic, 'privacy_scan_started');
  const safetyFailure = findForbiddenExposure(generatedUserFacingFields(normalized));
  if (safetyFailure) {
    updateDiagnostic(diagnostic, 'privacy_scan_failed', {
      safe_error_code: 'generated_output_failed_privacy_scan',
      privacy_scan_failed: true,
      ...safetyFailure
    });
    const error = new Error('generated_output_failed_privacy_scan');
    error.code = 'generated_output_failed_privacy_scan';
    error.safetyFailure = safetyFailure;
    throw error;
  }

  updateDiagnostic(diagnostic, 'privacy_scan_passed');
  updateDiagnostic(diagnostic, 'generation_complete');
  return normalized;
}

export default async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  const diagnostic = createDiagnostic();
  updateDiagnostic(diagnostic, 'handler_started');
  updateDiagnostic(diagnostic, 'auth_checked');
  const expectedCode = configuredAdminCode();
  const providedCode = getProvidedAdminCode(req);
  if (!expectedCode || providedCode !== expectedCode) {
    return res.status(403).json({ ok: false, error: 'admin_generation_access_denied' });
  }

  updateDiagnostic(diagnostic, 'auth_passed');
  const debugMode = isSafeDebugMode(req);
  updateDiagnostic(diagnostic, 'debug_mode_resolved');
  updateDiagnostic(diagnostic, 'diagnostic_initialized');

  try {
    updateDiagnostic(diagnostic, 'before_snapshot_load_call');
    const snapshot = await loadSnapshot(diagnostic);
    const modelResult = await callOpenAIForDarrenIntelligence(snapshot, diagnostic);
    const generated = normalizeGeneratedIntelligence(modelResult.parsed, snapshot, modelResult, diagnostic);
    return res.status(200).json(generated);
  } catch (error) {
    if (error?.safeError) {
      logSafeGenerationDiagnostic('snapshot_load_failed', {
        error_code: error.safeError,
        http_status: error.status,
        snapshot_loaded: false
      });
      return sendError(res, error.status || 500, error.safeError, diagnostic, debugMode);
    }
    if (error?.code === 'missing_openai_api_key') {
      logSafeGenerationDiagnostic('model_not_configured', {
        error_code: error.code,
        snapshot_loaded: true
      });
      return sendError(res, 503, 'darren_intelligence_model_not_configured', diagnostic, debugMode);
    }
    if (error?.code === 'darren_intelligence_generation_timeout') {
      logSafeGenerationDiagnostic('model_timeout', {
        error_code: error.code,
        model: configuredGenerationModel(),
        snapshot_loaded: true
      });
      return sendError(res, 504, 'darren_intelligence_generation_timeout', diagnostic, debugMode);
    }
    if (error?.code === 'darren_intelligence_model_request_failed') {
      logSafeGenerationDiagnostic('model_request_failed', {
        error_code: error.openai_error_code || error.openai_error_type || error.code,
        http_status: error.status,
        model: error.model,
        snapshot_loaded: true,
        openai_responded: true
      });
      return sendError(res, 502, 'darren_intelligence_model_request_failed', diagnostic, debugMode);
    }
    if (error?.code === 'darren_intelligence_model_response_invalid') {
      logSafeGenerationDiagnostic('model_response_invalid', {
        error_code: error.code,
        model: error.model,
        snapshot_loaded: true,
        openai_responded: true,
        parsing_failed: true
      });
      return sendError(res, 502, 'darren_intelligence_model_response_invalid', diagnostic, debugMode);
    }
    if (error?.code === 'darren_intelligence_schema_validation_failed') {
      logSafeGenerationDiagnostic('schema_validation_failed', {
        error_code: error.code,
        model: configuredGenerationModel(),
        snapshot_loaded: true,
        openai_responded: true
      });
      return sendError(res, 502, 'darren_intelligence_schema_validation_failed', diagnostic, debugMode);
    }
    if (error?.code === 'darren_intelligence_quality_validation_failed') {
      logSafeGenerationDiagnostic('quality_validation_failed', {
        error_code: error.code,
        model: configuredGenerationModel(),
        snapshot_loaded: true,
        openai_responded: true
      });
      return sendError(res, 502, 'darren_intelligence_quality_validation_failed', diagnostic, debugMode);
    }
    if (error?.code === 'generated_output_failed_privacy_scan') {
      logSafeGenerationDiagnostic('privacy_scan_failed', {
        error_code: error.code,
        model: configuredGenerationModel(),
        snapshot_loaded: true,
        openai_responded: true,
        privacy_scan_failed: true
      });
      return sendError(res, 502, 'darren_intelligence_generation_failed_privacy_scan', diagnostic, debugMode);
    }
    updateDiagnostic(diagnostic, null, {
      failure_stage: 'unhandled_generation_failure',
      safe_error_code: error?.code || 'unhandled_generation_failure',
      http_status: 500,
      response_status: 500,
      error_name: safeErrorName(error)
    });
    logSafeGenerationDiagnostic('unhandled_generation_failure', {
      error_code: error?.code || 'unhandled_generation_failure',
      model: configuredGenerationModel()
    });
    return sendError(res, 500, 'darren_intelligence_generation_failed', diagnostic, debugMode);
  }
}
