import crypto from 'node:crypto';

const VECTOR_FREE_FAILURE = /^Whole-person model leaked assessment language: (assessment|vector|dimension|structure score|measured pattern)$/u;

const VECTOR_FREE_CLASSES = Object.freeze({
  assessment: 'ASSESSMENT_LANGUAGE',
  vector: 'VECTOR_LANGUAGE',
  dimension: 'DIMENSION_LANGUAGE',
  'structure score': 'STRUCTURE_SCORE_LANGUAGE',
  'measured pattern': 'MEASURED_PATTERN_LANGUAGE',
});

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeUsage(usage) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return null;
  return Object.freeze({
    input_tokens: Number(usage.input_tokens) || 0,
    cached_input_tokens: Number(usage.input_tokens_details?.cached_tokens) || 0,
    output_tokens: Number(usage.output_tokens) || 0,
    reasoning_tokens: Number(usage.output_tokens_details?.reasoning_tokens) || 0,
    total_tokens: Number(usage.total_tokens) || 0,
  });
}

export function providerResponseIdSha256(responseId) {
  return sha256Text(responseId);
}

export function sanitizeCompletedStage3ProviderMetadata(response) {
  return Object.freeze({
    provider_response_id_sha256: providerResponseIdSha256(response?.id),
    status: response?.status || null,
    incomplete_details_reason: response?.incomplete_details?.reason || null,
    error_code: response?.error?.code || null,
    model: response?.model || null,
    service_tier: response?.service_tier || null,
    created_at: response?.created_at || null,
    completed_at: response?.completed_at || null,
    usage: safeUsage(response?.usage),
  });
}

export function classifyCompletedStage3ValidationError(error) {
  const message = String(error?.message || '');
  const vectorFree = message.match(VECTOR_FREE_FAILURE);
  if (vectorFree) {
    return Object.freeze({
      category: 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION',
      validator: 'assertVectorFreeWholePerson',
      language_class: VECTOR_FREE_CLASSES[vectorFree[1]],
      validation_code_sha256: sha256Text(message),
    });
  }
  if (/new_bos_semantic_fragment_(?:invalid|key_mismatch)/u.test(message)) {
    return Object.freeze({
      category: 'SCHEMA_SHAPE_REJECTION',
      validator: 'validateNewBosSemanticStageFragment',
      validation_code_sha256: sha256Text(message),
    });
  }
  if (/new_bos_semantic_stage_(?:empty_output|invalid_json|model_substitution_rejected|terminal_status)/u.test(message)) {
    return Object.freeze({
      category: 'OUTPUT_CONTRACT_REJECTION',
      validator: 'createNewBosSemanticStageProvider',
      validation_code_sha256: sha256Text(message),
    });
  }
  if (/required|missing/u.test(message)) {
    return Object.freeze({
      category: 'MISSING_REQUIRED_FIELD',
      validator: 'validateNewBosSemanticStageFragment',
      validation_code_sha256: sha256Text(message),
    });
  }
  if (/semantic|evidence|authority|truth/u.test(message)) {
    return Object.freeze({
      category: 'SEMANTIC_CONTRACT_REJECTION',
      validator: 'validateNewBosSemanticStageFragment',
      validation_code_sha256: sha256Text(message),
    });
  }
  return Object.freeze({
    category: 'OTHER_TYPED_VALIDATION_REJECTION',
    validator: 'stage3_acceptance_validator',
    validation_code_sha256: sha256Text(message || error?.name || 'unknown_validation_error'),
  });
}
