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
  'explain_like_busy',
  'coach_me_through_this'
]);

const ALLOWED_MODELS = new Set([
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4.1-mini',
  'gpt-4.1',
  'gpt-5-mini',
  'gpt-5'
]);

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
  const explicit = cleanText(process.env.UNIVERSAL_TRANSLATOR_OPENAI_MODEL, 80);
  if (explicit && ALLOWED_MODELS.has(explicit)) return explicit;
  return 'gpt-4o-mini';
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

function buildMessages(input, dictionaryTerms) {
  return [
    {
      role: 'system',
      content: [
        'You are the MORE MindMap Universal Translator.',
        'You translate meaning, not language.',
        'Use the locked method: technical claim, human behavior underneath it, real-world consequence, plain-language explanation, coaching sentence.',
        'Preserve accuracy, evidence limits, warnings, and not-live boundaries.',
        'Do not hype, invent proof, soften overclaim warnings, or say translation replaces the source.',
        'Return only JSON with translation fields: what_it_says, what_it_means, why_it_matters, what_to_do_next, optional how_this_shows_up_in_real_life, optional what_not_to_overclaim, optional truth_boundary, and dictionary_terms_used.'
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

async function callTranslatorModel(input, dictionaryTerms) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('translator_model_not_configured');
    error.safeCode = 'universal_translator_model_not_configured';
    throw error;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: configuredModel(),
      messages: buildMessages(input, dictionaryTerms),
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: 900
    })
  });

  if (!response.ok) {
    const error = new Error('translator_model_request_failed');
    error.safeCode = 'universal_translator_model_request_failed';
    throw error;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error('translator_model_response_invalid');
    error.safeCode = 'universal_translator_model_response_invalid';
    throw error;
  }

  return parseModelJson(content);
}

function sanitizeTranslation(modelResult, input, dictionaryTerms) {
  const translation = modelResult?.translation && typeof modelResult.translation === 'object'
    ? modelResult.translation
    : modelResult;

  const terms = Array.isArray(modelResult?.dictionary_terms_used)
    ? modelResult.dictionary_terms_used
    : dictionaryTerms.map((entry) => entry.label);

  return {
    ok: true,
    source_type: input.source_type,
    translation_mode: input.translation_mode,
    translation: {
      what_it_says: cleanText(translation?.what_it_says, 900),
      what_it_means: cleanText(translation?.what_it_means, 900),
      why_it_matters: cleanText(translation?.why_it_matters, 900),
      what_to_do_next: cleanText(translation?.what_to_do_next, 900),
      how_this_shows_up_in_real_life: cleanText(translation?.how_this_shows_up_in_real_life, 900),
      what_not_to_overclaim: cleanText(translation?.what_not_to_overclaim, 900),
      truth_boundary: cleanText(translation?.truth_boundary, 900)
    },
    dictionary_terms_used: terms.map((term) => cleanText(term, 80)).filter(Boolean).slice(0, 12),
    source_of_truth_note: 'The original MORE MindMap output remains the source of truth.',
    mutation_performed: false
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
    return sendJson(res, 500, {
      ok: false,
      error: error.safeCode || 'universal_translator_failed'
    });
  }
}
