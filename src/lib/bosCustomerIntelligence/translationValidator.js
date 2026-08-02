import { containsUnsupportedNarrativeClaim } from '../bosTruthfulness/claimValidator.js';
import {
  ALLOWED_CLASSIFICATIONS,
  BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT,
  BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  BOS_LAYER2_VERSION,
  CUSTOMER_COPY_FIELDS,
  INSUFFICIENT_EVIDENCE,
  TRANSLATION_STATUS,
} from './contracts.js';
import {
  hashSemanticValue,
  isSufficientProjectedClaim,
  packetWithoutSemanticHash,
  stableStringify,
} from './semanticPacket.js';

const DIRECT_QUOTATION = /[“”"]|(?:^|\s)'[^']{3,}'(?:\s|$)/;
const NUMERIC_TOKEN = /\b\d+(?:\.\d+)?(?:%|x)?\b/gi;

function validationResult(failures) {
  return Object.freeze({
    valid: failures.length === 0,
    failures: Object.freeze([...failures]),
  });
}

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return stableStringify(actual) === stableStringify(expected);
}

function sourceNumbers(surface) {
  const corpus = [
    ...(surface.claims || []).map(({ claim }) => claim),
    stableStringify(surface.protected_values || {}),
  ].join(' ');
  return new Set([...corpus.matchAll(NUMERIC_TOKEN)].map((match) => match[0].toLowerCase()));
}

function outputText(translation) {
  return CUSTOMER_COPY_FIELDS
    .map((field) => translation?.customer_copy?.[field] || '')
    .join(' ')
    .trim();
}

function expectedSemanticContracts(surface) {
  return (surface.claims || []).map((claim) => ({
    claim_id: claim.claim_id,
    claim: claim.claim,
    classification: claim.classification,
    confidence_score: claim.confidence.score,
    confidence_band: claim.confidence.band,
    confidence_calibrated: claim.confidence.calibrated,
    confidence_basis: claim.confidence.basis,
    sufficiency_status: claim.evidence_sufficiency.status,
    abstained: claim.abstention.abstained,
    abstention_reason: claim.abstention.reason,
  }));
}

function validateSurface(surface, index, failures) {
  const prefix = `surfaces[${index}]`;
  if (!surface || typeof surface !== 'object') {
    failures.push(`${prefix}:invalid_surface`);
    return;
  }
  if (!surface.surface_id) failures.push(`${prefix}:missing_surface_id`);
  if (!surface.role) failures.push(`${prefix}:missing_role`);
  if (!Array.isArray(surface.claims) || surface.claims.length === 0) {
    failures.push(`${prefix}:missing_claims`);
  }
  const claimIds = new Set();
  (surface.claims || []).forEach((claim, claimIndex) => {
    const claimPrefix = `${prefix}.claims[${claimIndex}]`;
    if (!claim.claim_id || claimIds.has(claim.claim_id)) {
      failures.push(`${claimPrefix}:invalid_or_duplicate_claim_id`);
    }
    claimIds.add(claim.claim_id);
    if (!ALLOWED_CLASSIFICATIONS.includes(claim.classification)) {
      failures.push(`${claimPrefix}:invalid_classification`);
    }
    if (!['sufficient', 'insufficient'].includes(claim.evidence_sufficiency?.status)) {
      failures.push(`${claimPrefix}:invalid_sufficiency`);
    }
    if (claim.confidence?.calibrated !== false) {
      failures.push(`${claimPrefix}:confidence_must_remain_uncalibrated`);
    }
    if (!Number.isFinite(claim.confidence?.score)) {
      failures.push(`${claimPrefix}:invalid_confidence_score`);
    }
    if (claim.evidence_sufficiency?.status === 'insufficient'
        && (claim.claim !== INSUFFICIENT_EVIDENCE
          || claim.classification !== INSUFFICIENT_EVIDENCE
          || claim.abstention?.abstained !== true)) {
      failures.push(`${claimPrefix}:invalid_abstention_contract`);
    }
    if ('excerpt' in claim || 'proposed_claim' in claim || 'source_path' in claim) {
      failures.push(`${claimPrefix}:disallowed_raw_source_field`);
    }
  });
}

export function validateLayer3SemanticPacket(packet) {
  const failures = [];
  if (!packet || typeof packet !== 'object') return validationResult(['invalid_packet']);
  if (packet.version !== BOS_CUSTOMER_INTELLIGENCE_VERSION) failures.push('invalid_version');
  if (packet.layer2_version !== BOS_LAYER2_VERSION) failures.push('invalid_layer2_version');
  if (packet.output_variant !== BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT) {
    failures.push('invalid_output_variant');
  }
  if (packet.translation_variant !== BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT) {
    failures.push('invalid_translation_variant');
  }
  if (packet.source_authority !== 'deterministic_layer_2') failures.push('invalid_authority');
  if (packet.translation_only !== true) failures.push('translation_only_required');
  if (packet.protected_contract?.layer_1_scores_modified !== false
      || packet.protected_contract?.layer_2_claims_modified !== false
      || packet.protected_contract?.canonical_bos_modified !== false
      || packet.protected_contract?.downstream_contracts_modified !== false
      || packet.protected_contract?.confidence_calibration_claimed !== false) {
    failures.push('protected_contract_drift');
  }
  if (!Array.isArray(packet.surfaces) || packet.surfaces.length === 0) {
    failures.push('missing_surfaces');
  }
  const surfaceIds = new Set();
  (packet.surfaces || []).forEach((surface, index) => {
    validateSurface(surface, index, failures);
    if (surfaceIds.has(surface?.surface_id)) failures.push(`surfaces[${index}]:duplicate_surface_id`);
    surfaceIds.add(surface?.surface_id);
  });
  const expectedManifestHash = hashSemanticValue((packet.surfaces || []).map((surface) => ({
    surface_id: surface.surface_id,
    role: surface.role,
    claim_ids: (surface.claims || []).map(({ claim_id }) => claim_id),
  })));
  if (packet.surface_manifest_hash !== expectedManifestHash) {
    failures.push('surface_manifest_hash_mismatch');
  }
  const expectedHash = hashSemanticValue(packetWithoutSemanticHash(packet));
  if (packet.semantic_hash !== expectedHash) failures.push('semantic_hash_mismatch');
  const serialized = stableStringify(packet);
  for (const forbidden of ['profile_id', 'person_name', 'company_name', 'intake_answers', 'answer_text']) {
    if (serialized.includes(`"${forbidden}"`)) failures.push(`forbidden_identity_or_answer_field:${forbidden}`);
  }
  return validationResult(failures);
}

function validateTranslation(surface, translation, failures) {
  const prefix = `translations.${surface.surface_id}`;
  if (!translation) {
    failures.push(`${prefix}:missing_translation`);
    return;
  }
  if (translation.surface_id !== surface.surface_id) failures.push(`${prefix}:surface_id_mismatch`);
  const expectedIds = (surface.claims || []).map(({ claim_id }) => claim_id);
  if (stableStringify(translation.claim_ids) !== stableStringify(expectedIds)) {
    failures.push(`${prefix}:claim_ids_changed`);
  }
  if (stableStringify(translation.semantic_contracts)
      !== stableStringify(expectedSemanticContracts(surface))) {
    failures.push(`${prefix}:semantic_contract_changed`);
  }
  if (!exactKeys(translation.customer_copy, CUSTOMER_COPY_FIELDS)) {
    failures.push(`${prefix}:invalid_customer_copy_shape`);
    return;
  }
  for (const field of CUSTOMER_COPY_FIELDS) {
    const value = translation.customer_copy[field];
    if (typeof value !== 'string' || value.length > 1200) {
      failures.push(`${prefix}:invalid_${field}`);
    }
  }

  const sufficient = (surface.claims || []).filter(isSufficientProjectedClaim);
  if (sufficient.length === 0) {
    if (translation.status !== TRANSLATION_STATUS.ABSTAINED
        || translation.customer_copy.headline !== INSUFFICIENT_EVIDENCE
        || translation.customer_copy.explanation !== INSUFFICIENT_EVIDENCE
        || translation.customer_copy.recognizable_pattern !== '') {
      failures.push(`${prefix}:abstention_weakened`);
    }
  } else if (translation.status !== TRANSLATION_STATUS.TRANSLATED) {
    failures.push(`${prefix}:supported_surface_not_translated`);
  }

  const text = outputText(translation);
  if (containsUnsupportedNarrativeClaim(text)) failures.push(`${prefix}:unsupported_claim_language`);
  if (DIRECT_QUOTATION.test(text)) failures.push(`${prefix}:direct_quotation_not_allowed`);
  const allowedNumbers = sourceNumbers(surface);
  for (const match of text.matchAll(NUMERIC_TOKEN)) {
    if (!allowedNumbers.has(match[0].toLowerCase())) {
      failures.push(`${prefix}:new_numeric_claim:${match[0]}`);
    }
  }
  if (translation.customer_copy.recognizable_pattern
      && !translation.customer_copy.recognizable_pattern.startsWith('You may notice')) {
    failures.push(`${prefix}:recognizable_pattern_not_bounded`);
  }
  if (translation.customer_copy.practical_use
      && !/^(Use|Treat) this as\b/.test(translation.customer_copy.practical_use)) {
    failures.push(`${prefix}:practical_use_not_bounded`);
  }
  if (sufficient.length > 0
      && !/\b(not proof|does not establish|hypothesis|uncalibrated|may not)\b/i.test(
        translation.customer_copy.evidence_boundary,
      )) {
    failures.push(`${prefix}:missing_uncertainty_boundary`);
  }
}

export function validateLayer3TranslationBundle(packet, bundle) {
  const failures = [];
  const packetValidation = validateLayer3SemanticPacket(packet);
  if (!packetValidation.valid) {
    failures.push(...packetValidation.failures.map((failure) => `packet:${failure}`));
    return validationResult(failures);
  }
  if (!bundle || typeof bundle !== 'object') return validationResult(['invalid_bundle']);
  if (bundle.version !== BOS_CUSTOMER_INTELLIGENCE_VERSION) failures.push('invalid_bundle_version');
  if (bundle.source_hash !== packet.semantic_hash) failures.push('bundle_source_hash_mismatch');
  if (!Array.isArray(bundle.translations)) failures.push('missing_translations');
  const byId = new Map((bundle.translations || []).map((item) => [item?.surface_id, item]));
  if (byId.size !== (bundle.translations || []).length) failures.push('duplicate_translation_surface');
  if ((bundle.translations || []).length !== packet.surfaces.length) {
    failures.push('translation_count_mismatch');
  }
  for (const surface of packet.surfaces) validateTranslation(surface, byId.get(surface.surface_id), failures);
  return validationResult(failures);
}

export function semanticContractsForSurface(surface) {
  return expectedSemanticContracts(surface);
}
