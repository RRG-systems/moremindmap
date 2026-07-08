/**
 * Central BOS model registry — behavior-preserving defaults (MMB6).
 * Reads process.env only at runtime. No API keys. No .env file reads.
 */

export const MODEL_REGISTRY_VERSION = 'mmb6.behavior_preserving.v1';

/**
 * Future GPT-5.5 targets — documentation/export only; does NOT affect runtime selection.
 */
export const FUTURE_GPT55_TARGET_POLICY = Object.freeze({
  _note: 'Inert policy object. Not used for runtime model resolution.',
  BOS_RESCORING_MODEL: 'gpt-5.5-2026-04-23',
  BOS_NARRATIVE_MODEL: 'gpt-5.5-2026-04-23',
  BOS_REPORT_MODEL: 'gpt-5.5-2026-04-23',
});

const ROUTE_TO_REGISTRY_KEY = Object.freeze({
  'bos.rescoring': 'BOS_RESCORING_MODEL',
  'bos.narrative': 'BOS_NARRATIVE_MODEL',
  'bos.report': 'BOS_REPORT_MODEL',
  'bos.fallback': 'BOS_FALLBACK_MODEL',
  'bos.cheap': 'BOS_CHEAP_MODEL',
  'visual_dna.image': 'VISUAL_DNA_IMAGE_MODEL',
  'business_assessment.primary': 'BUSINESS_ASSESSMENT_OPENAI_MODEL',
  'business_assessment.briefing': 'BUSINESS_ASSESSMENT_BRIEFING_MODEL',
  'darren.strategy_chat': 'DARREN_STRATEGY_CHAT_MODEL',
  'darren.intelligence': 'DARREN_INTELLIGENCE_OPENAI_MODEL',
});

const MODEL_DEFINITIONS = Object.freeze({
  BOS_RESCORING_MODEL: {
    env: ['BOS_RESCORING_MODEL'],
    default: 'gpt-4o',
  },
  BOS_NARRATIVE_MODEL: {
    env: ['BOS_NARRATIVE_MODEL'],
    default: 'gpt-4o-2024-08-06',
  },
  BOS_REPORT_MODEL: {
    env: ['BOS_REPORT_MODEL', 'OPENAI_MODEL'],
    default: 'gpt-5.5',
  },
  BOS_FALLBACK_MODEL: {
    env: ['BOS_FALLBACK_MODEL'],
    default: 'gpt-4o-2024-08-06',
  },
  BOS_CHEAP_MODEL: {
    env: ['BOS_CHEAP_MODEL'],
    default: 'gpt-5.4-mini-2026-03-17',
  },
  VISUAL_DNA_IMAGE_MODEL: {
    env: ['VISUAL_DNA_IMAGE_MODEL'],
    default: 'gpt-image-1',
  },
  BUSINESS_ASSESSMENT_OPENAI_MODEL: {
    env: ['BUSINESS_ASSESSMENT_OPENAI_MODEL', 'OPENAI_MODEL'],
    default: 'gpt-4o-2024-08-06',
  },
  BUSINESS_ASSESSMENT_BRIEFING_MODEL: {
    env: ['BUSINESS_ASSESSMENT_BRIEFING_MODEL'],
    default: 'gpt-4o-2024-08-06',
  },
  DARREN_STRATEGY_CHAT_MODEL: {
    env: ['DARREN_STRATEGY_CHAT_MODEL', 'DARREN_STRATEGY_CHAT_OPENAI_MODEL'],
    default: 'gpt-4o-2024-08-06',
  },
  DARREN_INTELLIGENCE_OPENAI_MODEL: {
    env: ['DARREN_INTELLIGENCE_OPENAI_MODEL'],
    default: 'gpt-4o-2024-08-06',
  },
});

function sanitizeModelName(value, fallback) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || trimmed.length > 128) {
    return fallback;
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function resolveModelDefinition(definition) {
  for (const envName of definition.env) {
    const raw = process.env[envName];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return {
        model: sanitizeModelName(raw, definition.default),
        model_source: 'env',
        env_var: envName,
      };
    }
  }

  return {
    model: definition.default,
    model_source: 'default',
    env_var: null,
  };
}

function deriveModelFamily(model) {
  const name = String(model || '').trim().toLowerCase();
  if (!name) return 'unknown';
  if (name.startsWith('gpt-image')) return 'gpt-image';
  if (name.startsWith('gpt-5.5')) return 'gpt-5.5';
  if (name.startsWith('gpt-5.4')) return 'gpt-5.4';
  if (name.startsWith('gpt-4o')) return 'gpt-4o';
  if (name.startsWith('gpt-4')) return 'gpt-4';
  return 'unknown';
}

function resolveRegistryKey(registryKey) {
  const definition = MODEL_DEFINITIONS[registryKey];
  if (!definition) {
    return {
      model: 'unknown',
      model_source: 'unknown',
      env_var: null,
    };
  }
  return resolveModelDefinition(definition);
}

export function getBosRescoringModel() {
  return resolveRegistryKey('BOS_RESCORING_MODEL').model;
}

export function getBosNarrativeModel() {
  return resolveRegistryKey('BOS_NARRATIVE_MODEL').model;
}

export function getBosReportModel() {
  return resolveRegistryKey('BOS_REPORT_MODEL').model;
}

export function getBosFallbackModel() {
  return resolveRegistryKey('BOS_FALLBACK_MODEL').model;
}

export function getBosCheapModel() {
  return resolveRegistryKey('BOS_CHEAP_MODEL').model;
}

export function getVisualDnaImageModel() {
  return resolveRegistryKey('VISUAL_DNA_IMAGE_MODEL').model;
}

export function getBusinessAssessmentOpenaiModel() {
  return resolveRegistryKey('BUSINESS_ASSESSMENT_OPENAI_MODEL').model;
}

export function getBusinessAssessmentBriefingModel() {
  return resolveRegistryKey('BUSINESS_ASSESSMENT_BRIEFING_MODEL').model;
}

export function getDarrenStrategyChatModel() {
  return resolveRegistryKey('DARREN_STRATEGY_CHAT_MODEL').model;
}

export function getDarrenIntelligenceOpenaiModel() {
  return resolveRegistryKey('DARREN_INTELLIGENCE_OPENAI_MODEL').model;
}

export function getModelRegistry() {
  const registry = {
    registry_version: MODEL_REGISTRY_VERSION,
  };

  for (const registryKey of Object.keys(MODEL_DEFINITIONS)) {
    const resolved = resolveRegistryKey(registryKey);
    registry[registryKey] = resolved.model;
    registry[`${registryKey}_source`] = resolved.model_source;
  }

  return registry;
}

export function getModelForRoute(routeName) {
  return resolveModelForRoute(routeName).model;
}

export function resolveModelForRoute(routeName) {
  const normalizedRoute = String(routeName || '').trim();
  const registryKey = ROUTE_TO_REGISTRY_KEY[normalizedRoute];
  if (!registryKey) {
    return {
      route_name: normalizedRoute || 'unknown',
      registry_key: null,
      model: 'unknown',
      model_source: 'unknown',
      env_var: null,
    };
  }

  const resolved = resolveRegistryKey(registryKey);
  return {
    route_name: normalizedRoute,
    registry_key: registryKey,
    ...resolved,
  };
}

export function buildModelProvenance(routeName, selectedModel, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const modelUsed = sanitizeModelName(selectedModel, 'unknown');
  const modelSource = opts.model_source
    ? String(opts.model_source)
    : (modelUsed === 'unknown' ? 'unknown' : 'default');

  const provenance = {
    registry_version: MODEL_REGISTRY_VERSION,
    route_name: String(routeName || '').trim() || 'unknown',
    model_used: modelUsed,
    model_family: deriveModelFamily(modelUsed),
    model_source: modelSource,
    fallback_used: Boolean(opts.fallback_used),
    fallback_reason: opts.fallback_reason ?? null,
    generated_at: opts.generated_at || new Date().toISOString(),
  };

  if (opts.cognition_source !== undefined && opts.cognition_source !== null && String(opts.cognition_source).trim() !== '') {
    provenance.cognition_source = String(opts.cognition_source).trim();
  }

  return provenance;
}

export { ROUTE_TO_REGISTRY_KEY, MODEL_DEFINITIONS };