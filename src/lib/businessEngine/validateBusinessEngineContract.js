/**
 * Schema-like validator for business-engine-contract-v1.
 * Deterministic structural validation only — not intelligence reinterpretation.
 */

import { CONTRACT_NAME, CONTRACT_VERSION } from './contractVersion.js';

export const REQUIRED_TOP_LEVEL_DOMAINS = Object.freeze([
  'contract_metadata',
  'identity',
  'vertical_context',
  'current_business_reality',
  'governing_business_pattern',
  'behavioral_modifier',
  'business_model_alignment',
  'business_engine_dimensions',
  'relationship_lake',
  'current_trajectory',
  'potential_business_future',
  'potential_trajectory',
  'primary_constraint',
  'causal_explanation',
  'no_change_consequence',
  'future_change_logic',
  'one_move',
  'modeled_opportunity',
  'confidence_reality',
  'truth_boundaries',
  'truth_rail',
  'footer_intelligence',
]);

const INTELLIGENCE_NODE_KEYS = [
  'current',
  'previous',
  'trend',
  'reason_for_change',
  'evidence_sources',
  'last_updated',
  'confidence',
  'provenance',
  'source_type',
  'fallback_used',
  'fallback_reason',
  'intelligence_status',
];

const MODEL_NAME_LEAK_RE =
  /\b(gpt-?4|gpt-?5|gpt-?3\.5|claude|o1|o3|gemini|sonnet|opus|chatgpt|openai|anthropic)\b/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function looksLikeIntelligenceNode(value) {
  if (!isPlainObject(value)) return false;
  return (
    Object.prototype.hasOwnProperty.call(value, 'current') ||
    Object.prototype.hasOwnProperty.call(value, 'intelligence_status') ||
    Object.prototype.hasOwnProperty.call(value, 'source_type')
  );
}

function validateIntelligenceNode(node, path, errors, warnings) {
  if (!isPlainObject(node)) {
    errors.push(`${path} must be an object intelligence node`);
    return;
  }
  for (const key of ['source_type', 'intelligence_status', 'fallback_used']) {
    if (node[key] === undefined) {
      warnings.push(`${path}.${key} missing`);
    }
  }
  if (node.fallback_used && !node.fallback_reason) {
    errors.push(`${path}.fallback_reason required when fallback_used is true`);
  }
  if (!node.fallback_used && node.fallback_reason) {
    warnings.push(`${path}.fallback_reason present while fallback_used is false`);
  }
  if (!Array.isArray(node.evidence_sources)) {
    warnings.push(`${path}.evidence_sources should be an array`);
  }
  // temporal fields may be null on snapshot but keys should exist for future-proofing
  for (const key of INTELLIGENCE_NODE_KEYS) {
    if (!(key in node) && key !== 'extra') {
      warnings.push(`${path}.${key} key absent (future-proof field recommended)`);
    }
  }
}

function scanForModelNames(value, path, errors, seen = new Set()) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (MODEL_NAME_LEAK_RE.test(value)) {
      errors.push(`${path} exposes internal model name: "${value.slice(0, 80)}"`);
    }
    return;
  }
  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForModelNames(item, `${path}[${index}]`, errors, seen));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    // skip technical provenance artifact names
    if (key === 'source_artifact' || key === 'source_path' || key === 'path' || key === 'artifact') {
      continue;
    }
    scanForModelNames(child, `${path}.${key}`, errors, seen);
  }
}

/**
 * @returns {{ valid: boolean, errors: string[], warnings: string[], contract_version: string|null }}
 */
export function validateBusinessEngineContract(contract) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(contract)) {
    return {
      valid: false,
      errors: ['contract must be a plain object'],
      warnings: [],
      contract_version: null,
    };
  }

  for (const domain of REQUIRED_TOP_LEVEL_DOMAINS) {
    if (!(domain in contract)) {
      errors.push(`missing required top-level domain: ${domain}`);
    }
  }

  const meta = contract.contract_metadata;
  if (!isPlainObject(meta)) {
    errors.push('contract_metadata must be an object');
  } else {
    if (meta.contract_name !== CONTRACT_NAME) {
      errors.push(`contract_metadata.contract_name must be ${CONTRACT_NAME}`);
    }
    if (meta.contract_version !== CONTRACT_VERSION) {
      errors.push(`contract_metadata.contract_version must be ${CONTRACT_VERSION}`);
    }
    for (const key of [
      'generated_at',
      'source_profile_id',
      'source_assessment_id',
      'compatibility_mode',
      'legacy_fallbacks_used',
    ]) {
      if (!(key in meta)) warnings.push(`contract_metadata.${key} missing`);
    }
    if (!Array.isArray(meta.legacy_fallbacks_used)) {
      errors.push('contract_metadata.legacy_fallbacks_used must be an array');
    }
  }

  const intelligenceDomains = [
    'current_business_reality',
    'governing_business_pattern',
    'behavioral_modifier',
    'business_model_alignment',
    'business_engine_dimensions',
    'current_trajectory',
    'potential_business_future',
    'potential_trajectory',
    'primary_constraint',
    'causal_explanation',
    'no_change_consequence',
    'future_change_logic',
    'one_move',
    'modeled_opportunity',
    'confidence_reality',
    'truth_boundaries',
    'truth_rail',
    'footer_intelligence',
  ];

  for (const domain of intelligenceDomains) {
    if (looksLikeIntelligenceNode(contract[domain])) {
      validateIntelligenceNode(contract[domain], domain, errors, warnings);
    } else if (domain in contract) {
      warnings.push(`${domain} is not shaped as a standard intelligence node`);
    }
  }

  const lake = contract.relationship_lake;
  if (isPlainObject(lake)) {
    if (looksLikeIntelligenceNode(lake.streams)) {
      validateIntelligenceNode(lake.streams, 'relationship_lake.streams', errors, warnings);
    } else {
      errors.push('relationship_lake.streams must be an intelligence node');
    }
    if (looksLikeIntelligenceNode(lake.outflow)) {
      validateIntelligenceNode(lake.outflow, 'relationship_lake.outflow', errors, warnings);
    } else {
      errors.push('relationship_lake.outflow must be an intelligence node');
    }
  }

  // Customer-facing scan: identity + current payloads commonly rendered
  scanForModelNames(contract.identity, 'identity', errors);
  scanForModelNames(contract.footer_intelligence?.current, 'footer_intelligence.current', errors);
  scanForModelNames(contract.one_move?.current, 'one_move.current', errors);
  scanForModelNames(contract.governing_business_pattern?.current, 'governing_business_pattern.current', errors);
  scanForModelNames(contract.current_trajectory?.current, 'current_trajectory.current', errors);
  scanForModelNames(contract.potential_trajectory?.current, 'potential_trajectory.current', errors);

  if (meta?.customer_facing_model_names_exposed === true) {
    errors.push('contract_metadata.customer_facing_model_names_exposed must be false');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    contract_version: meta?.contract_version || null,
  };
}

export default validateBusinessEngineContract;
