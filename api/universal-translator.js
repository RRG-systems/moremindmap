import {
  moreMeaningDictionary,
  universalTranslatorDoctrine
} from '../src/data/moreMeaningDictionary.js';

const SOURCE_TYPES = new Set([
  'bos_profile',
  'bos_section',
  'business_assessment',
  'five_futures',
  'one_move',
  'truth_boundary',
  'adaptive_draft',
  'general_moremindmap'
]);

const TRANSLATION_MODES = new Set([
  'plain_english',
  // Legacy/internal compatibility only. The current UI exposes plain_english and coach_me_through_this.
  'explain_like_busy',
  'coach_me_through_this'
]);

const ALLOWED_MODELS = new Set([
  'gpt-4o-2024-08-06',
  'gpt-4o-2024-05-13',
  'gpt-4o',
  'gpt-5.4-mini',
  'gpt-5.4-mini-2026-03-17',
  'gpt-5.4-2026-03-05',
  'gpt-5.4-nano-2026-03-17',
  'gpt-5.5',
  'gpt-5.5-2026-04-23',
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-5'
]);
const DEFAULT_TRANSLATOR_MODEL = 'gpt-4o-2024-08-06';
const TRANSLATOR_TIMEOUT_MS = 22000;

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function looksLikeRawPayload(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.length < 800) return false;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return true;
  }
  return /"canonical_dossier"|"canonical_profile_json"|"assessment_answers"|"raw_answers"/i.test(trimmed);
}

function isStringLike(value) {
  return value === undefined || value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function configuredModel() {
  const explicit = cleanText(process.env.UNIVERSAL_TRANSLATOR_MODEL || process.env.UNIVERSAL_TRANSLATOR_OPENAI_MODEL, 80);
  if (explicit && ALLOWED_MODELS.has(explicit)) return explicit;
  return DEFAULT_TRANSLATOR_MODEL;
}

function configuredModelPlan() {
  const primaryModel = configuredModel();
  return {
    primary_model: primaryModel,
    fallback_model: primaryModel === DEFAULT_TRANSLATOR_MODEL ? null : DEFAULT_TRANSLATOR_MODEL,
    env_model_configured: Boolean(cleanText(process.env.UNIVERSAL_TRANSLATOR_MODEL || process.env.UNIVERSAL_TRANSLATOR_OPENAI_MODEL, 80))
  };
}

function usesCompletionTokenParameter(model) {
  return /^(gpt-5|o\d|o[134]|chatgpt-4o)/i.test(String(model || ''));
}

function translatorRequestBody({ model, input, dictionaryTerms }) {
  const tokenParameter = usesCompletionTokenParameter(model) ? 'max_completion_tokens' : 'max_tokens';
  const body = {
    model,
    messages: buildMessages(input, dictionaryTerms),
    response_format: { type: 'json_object' },
    [tokenParameter]: 900
  };
  if (!usesCompletionTokenParameter(model)) body.temperature = 0.25;
  return body;
}

function modelFailureCode(error) {
  return error?.safeCode || error?.code || 'universal_translator_model_request_failed';
}

function logTranslatorModelFailure({ model, stage, error }) {
  console.warn('universal_translator_model_attempt_failed', {
    stage,
    model,
    safe_code: modelFailureCode(error),
    status: error?.status || null
  });
}

function relevantDictionaryTerms(sourceText) {
  const normalized = String(sourceText || '').toLowerCase();
  const directMatches = moreMeaningDictionary.filter((entry) => {
    const label = entry.label.toLowerCase();
    return normalized.includes(label) || label.split(/\s+/).some((part) => part.length > 5 && normalized.includes(part));
  });

  const fallback = moreMeaningDictionary.filter((entry) =>
    ['One Move', 'Truth Boundary', 'Evidence Weight', 'Behavior Operating System', 'Business Assessment'].includes(entry.label)
  );

  const merged = [...directMatches, ...fallback];
  const seen = new Set();
  return merged
    .filter((entry) => {
      if (seen.has(entry.label)) return false;
      seen.add(entry.label);
      return true;
    })
    .slice(0, 12)
    .map((entry) => ({
      label: entry.label,
      plain_english_meaning: entry.plain_english_meaning,
      user_facing_translation_rule: entry.user_facing_translation_rule,
      overclaim_warning: entry.overclaim_warning || ''
    }));
}

function sourceTypeInstructions(sourceType) {
  if (sourceType === 'bos_profile' || sourceType === 'bos_section') {
    return [
      'For BOS/Profile sources, translate behavior, not generic personality traits.',
      'Explain how this person operates, what the profile says about behavior, where the pattern helps, and where it can cost them.',
      'Explain how the behavior may show up under pressure and how other people may experience it when the source supports that.',
      'Prefer filling how_this_shows_up_in_real_life.',
      'Fill what_not_to_overclaim when the source could be overstated.',
      'If the source excerpt is organized into BOS sections, translate section by section. Do not collapse the profile into a generic personality summary.',
      'For bos_section, translate only the submitted BOS section. Do not infer the entire profile.',
      'Do not diagnose, make clinical claims, say personality is fixed, or imply predictive certainty.',
      'Mention that the BOS describes operating tendencies, not destiny, when relevant.',
      'Use behaviorally specific, practical English. Avoid generic personality-test copy and motivational wallpaper.'
    ].join(' ');
  }

  if (sourceType === 'business_assessment' || sourceType === 'five_futures' || sourceType === 'one_move' || sourceType === 'truth_boundary') {
    return [
      'For Business Assessment sources, explain the business consequence, evidence limit, and next practical action.',
      'Preserve what not to overclaim and do not turn possible futures into promises.'
    ].join(' ');
  }

  return 'Translate the source into practical meaning while preserving limits and source-of-truth boundaries.';
}

function modeInstructions(translationMode) {
  if (translationMode === 'coach_me_through_this') {
    return [
      'Act like a practical business coach helping the user understand and use this section.',
      'Make this visibly different from Plain English mode.',
      'Explain what the section is really saying, why it matters, what signal it reveals, what risk or opportunity to notice, and one useful question or next step.',
      'Prefer filling headline, what_it_means, why_it_matters, what_to_watch, coaching_question, and what_to_do_next.',
      'Use a supportive, practical, coaching-oriented tone.',
      'Do not change the source truth, invent proof, add unsupported strategy, or imply the translation replaces the original output.'
    ].join(' ');
  }

  if (translationMode === 'explain_like_busy') {
    return [
      'Legacy mode. Treat this as a compact Plain English translation.',
      'Keep it short, direct, and non-cutesy.',
      'Do not add a coaching framework unless the source clearly requires one.'
    ].join(' ');
  }

  return [
    'Translate this into clear, simple, direct language.',
    'Make it easy to understand what the source means.',
    'Use fewer words than coaching mode.',
    'Do not add new strategy.',
    'Do not over-coach.',
    'Do not turn the response into an action plan unless a practical next step is clearly present in the source.'
  ].join(' ');
}

function buildMessages(input, dictionaryTerms) {
  return [
    {
      role: 'system',
      content: [
        'You are the MORE MindMap Universal Translator.',
        'You translate meaning, not language.',
        'Preserve accuracy, evidence limits, warnings, and not-live boundaries.',
        'Do not hype, invent proof, soften overclaim warnings, or say translation replaces the source.',
        'Keep the translation English-only. Do not add language selection, locale handling, or multilingual metadata.',
        'Return only JSON with translation fields: optional headline, what_it_says, what_it_means, why_it_matters, what_to_do_next, optional what_to_watch, optional coaching_question, optional how_this_shows_up_in_real_life, optional what_not_to_overclaim, optional truth_boundary, and dictionary_terms_used.',
        'For Plain English mode, the goal is: What does this mean?',
        'For Coach Me Through This mode, the goal is: How should I think about this and use it?'
      ].join(' ')
    },
    {
      role: 'user',
      content: JSON.stringify({
        translator_doctrine: universalTranslatorDoctrine,
        source_type: input.source_type,
        translation_mode: input.translation_mode,
        source_title: input.source_title,
        source_excerpt: input.source_excerpt,
        profile_context: input.profile_context,
        business_context: input.business_context,
        mode_instructions: modeInstructions(input.translation_mode),
        source_type_instructions: sourceTypeInstructions(input.source_type),
        dictionary_terms: dictionaryTerms
      })
    }
  ];
}

function parseModelJson(content) {
  const text = String(content || '').trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) throw new Error('translator_response_not_json');
  return JSON.parse(text.slice(first, last + 1));
}

async function callSingleTranslatorModel({ model, input, dictionaryTerms }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('translator_model_not_configured');
    error.safeCode = 'universal_translator_model_not_configured';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSLATOR_TIMEOUT_MS);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(translatorRequestBody({ model, input, dictionaryTerms })),
    signal: controller.signal
  }).catch((error) => {
    const safeErrorObject = new Error(error?.name === 'AbortError' ? 'translator_model_timeout' : 'translator_model_request_failed');
    safeErrorObject.safeCode = error?.name === 'AbortError'
      ? 'universal_translator_model_timeout'
      : 'universal_translator_model_request_failed';
    throw safeErrorObject;
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const error = new Error('translator_model_request_failed');
    error.safeCode = 'universal_translator_model_request_failed';
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('translator_model_response_invalid');
    error.safeCode = 'universal_translator_model_response_invalid';
    throw error;
  }

  try {
    return parseModelJson(content);
  } catch {
    const error = new Error('translator_model_response_invalid');
    error.safeCode = 'universal_translator_model_response_invalid';
    throw error;
  }
}

async function callTranslatorModel(input, dictionaryTerms) {
  const plan = configuredModelPlan();
  try {
    const parsed = await callSingleTranslatorModel({
      model: plan.primary_model,
      input,
      dictionaryTerms
    });
    return {
      parsed,
      model_used: plan.primary_model,
      fallback_used: false,
      model_selection: plan
    };
  } catch (primaryError) {
    logTranslatorModelFailure({ model: plan.primary_model, stage: 'primary', error: primaryError });
    if (!plan.fallback_model) throw primaryError;

    try {
      const parsed = await callSingleTranslatorModel({
        model: plan.fallback_model,
        input,
        dictionaryTerms
      });
      return {
        parsed,
        model_used: plan.fallback_model,
        fallback_used: true,
        model_selection: plan,
        primary_failure_code: modelFailureCode(primaryError)
      };
    } catch (fallbackError) {
      logTranslatorModelFailure({ model: plan.fallback_model, stage: 'fallback', error: fallbackError });
      const error = new Error('translator_model_fallback_failed');
      error.safeCode = modelFailureCode(fallbackError);
      error.modelTrace = {
        primary_model: plan.primary_model,
        fallback_model: plan.fallback_model,
        primary_failure_code: modelFailureCode(primaryError),
        fallback_failure_code: modelFailureCode(fallbackError)
      };
      throw error;
    }
  }
}

function sanitizeTranslation(modelResult, input, dictionaryTerms) {
  const result = modelResult?.parsed || modelResult || {};
  const translation = result?.translation && typeof result.translation === 'object'
    ? result.translation
    : result;

  const terms = Array.isArray(result?.dictionary_terms_used)
    ? result.dictionary_terms_used
    : dictionaryTerms.map((entry) => entry.label);

  return {
    ok: true,
    source_type: input.source_type,
    translation_mode: input.translation_mode,
    translation: {
      headline: cleanText(translation?.headline, 220),
      what_it_says: cleanText(translation?.what_it_says, 900),
      what_it_means: cleanText(translation?.what_it_means, 900),
      why_it_matters: cleanText(translation?.why_it_matters, 900),
      what_to_do_next: cleanText(translation?.what_to_do_next, 900),
      what_to_watch: cleanText(translation?.what_to_watch, 900),
      coaching_question: cleanText(translation?.coaching_question, 900),
      how_this_shows_up_in_real_life: cleanText(translation?.how_this_shows_up_in_real_life, 900),
      what_not_to_overclaim: cleanText(translation?.what_not_to_overclaim, 900),
      truth_boundary: cleanText(translation?.truth_boundary, 900)
    },
    dictionary_terms_used: terms.map((term) => cleanText(term, 80)).filter(Boolean).slice(0, 12),
    source_of_truth_note: 'The original MORE MindMap output remains the source of truth.',
    mutation_performed: false,
    model_used: cleanText(modelResult?.model_used, 80),
    fallback_used: modelResult?.fallback_used === true,
    model_selection: {
      primary_model: cleanText(modelResult?.model_selection?.primary_model, 80),
      fallback_model: cleanText(modelResult?.model_selection?.fallback_model, 80),
      primary_model_failed: modelResult?.fallback_used === true,
      env_model_configured: modelResult?.model_selection?.env_model_configured === true
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (
      !isStringLike(body.source_excerpt) ||
      !isStringLike(body.source_title) ||
      !isStringLike(body.profile_context) ||
      !isStringLike(body.business_context)
    ) {
      return sendJson(res, 400, { ok: false, error: 'universal_translator_raw_payload_not_allowed' });
    }

    const sourceType = cleanText(body.source_type, 80);
    const translationMode = cleanText(body.translation_mode || 'plain_english', 80);
    const sourceTitle = cleanText(body.source_title, 180);
    const sourceExcerpt = cleanText(body.source_excerpt, 6000);
    const profileContext = cleanText(body.profile_context, 1200);
    const businessContext = cleanText(body.business_context, 1200);

    if (!SOURCE_TYPES.has(sourceType)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_universal_translator_source_type' });
    }
    if (!TRANSLATION_MODES.has(translationMode)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_universal_translator_mode' });
    }
    if (!sourceExcerpt) {
      return sendJson(res, 400, { ok: false, error: 'universal_translator_source_excerpt_required' });
    }
    if (looksLikeRawPayload(body.source_excerpt)) {
      return sendJson(res, 400, { ok: false, error: 'universal_translator_source_excerpt_too_raw' });
    }

    const input = {
      source_type: sourceType,
      translation_mode: translationMode,
      source_title: sourceTitle,
      source_excerpt: sourceExcerpt,
      profile_context: profileContext,
      business_context: businessContext
    };
    const dictionaryTerms = relevantDictionaryTerms(`${sourceTitle} ${sourceExcerpt}`);
    const modelResult = await callTranslatorModel(input, dictionaryTerms);
    return sendJson(res, 200, sanitizeTranslation(modelResult, input, dictionaryTerms));
  } catch (error) {
    const errorCode = error.safeCode || 'universal_translator_failed';
    const status = errorCode.includes('model') ? 503 : 500;
    return sendJson(res, status, {
      ok: false,
      error: errorCode,
      mutation_performed: false,
      model_trace: error?.modelTrace ? {
        primary_model: cleanText(error.modelTrace.primary_model, 80),
        fallback_model: cleanText(error.modelTrace.fallback_model, 80),
        primary_failure_code: cleanText(error.modelTrace.primary_failure_code, 120),
        fallback_failure_code: cleanText(error.modelTrace.fallback_failure_code, 120)
      } : undefined
    });
  }
}
