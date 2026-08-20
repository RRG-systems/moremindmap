import { containsUnsupportedNarrativeClaim } from '../bosTruthfulness/claimValidator.js';
import {
  ALLOWED_CLASSIFICATIONS,
  BOS_CUSTOMER_INTELLIGENCE_OUTPUT_VARIANT,
  BOS_CUSTOMER_INTELLIGENCE_TRANSLATION_VARIANT,
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  BOS_LAYER2_VERSION,
  CUSTOMER_COPY_BLOCK_KINDS,
  CUSTOMER_COPY_KEYS,
  INSUFFICIENT_EVIDENCE,
  TRANSLATION_FORMATS,
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
const TECHNICAL_CUSTOMER_LANGUAGE = /\b(?:layer\s*1|topology(?:\s+score)?|contributing\s+answer\s+signals?|evidence\s+contracts?|uncalibrated\s+assessment|semantic\s+packets?|validators?|provenance\s+paths?)\b/i;

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
  return [
    translation?.customer_copy?.headline,
    ...(translation?.customer_copy?.blocks || []).map(({ text }) => text),
  ].filter(Boolean).join(' ').trim();
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
  if (!surface.translation_guidance
      || !Object.values(TRANSLATION_FORMATS).includes(
        surface.translation_guidance.output_format,
      )) {
    failures.push(`${prefix}:invalid_translation_guidance`);
  }
  if (!Array.isArray(surface.translation_guidance?.allowed_block_kinds)
      || surface.translation_guidance.allowed_block_kinds.length === 0
      || surface.translation_guidance.allowed_block_kinds.some(
        (kind) => !CUSTOMER_COPY_BLOCK_KINDS.includes(kind),
      )) {
    failures.push(`${prefix}:invalid_allowed_block_kinds`);
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
  const insufficientClaimSets = new Set();
  (packet.surfaces || []).forEach((surface, index) => {
    validateSurface(surface, index, failures);
    if (surfaceIds.has(surface?.surface_id)) failures.push(`surfaces[${index}]:duplicate_surface_id`);
    surfaceIds.add(surface?.surface_id);
    const allInsufficient = (surface?.claims || []).length > 0
      && surface.claims.every((claim) => !isSufficientProjectedClaim(claim));
    const claimSet = (surface?.claims || []).map(({ claim_id: claimId }) => claimId).sort().join('|');
    if (allInsufficient && claimSet) {
      if (insufficientClaimSets.has(claimSet)) {
        failures.push(`surfaces[${index}]:duplicate_insufficient_claim_surface`);
      }
      insufficientClaimSets.add(claimSet);
    }
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
  const expectedFormat = surface.translation_guidance?.output_format;
  if (translation.format !== expectedFormat) failures.push(`${prefix}:format_changed`);
  if (!exactKeys(translation.customer_copy, CUSTOMER_COPY_KEYS)) {
    failures.push(`${prefix}:invalid_customer_copy_shape`);
    return;
  }
  const headline = translation.customer_copy.headline;
  if (typeof headline !== 'string' || !headline.trim() || headline.length > 180) {
    failures.push(`${prefix}:invalid_headline`);
  }
  const blocks = translation.customer_copy.blocks;
  if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > 3) {
    failures.push(`${prefix}:invalid_blocks`);
    return;
  }
  const seenKinds = new Set();
  blocks.forEach((block, blockIndex) => {
    const blockPrefix = `${prefix}.blocks[${blockIndex}]`;
    if (!exactKeys(block, ['kind', 'text'])) failures.push(`${blockPrefix}:invalid_shape`);
    if (!surface.translation_guidance.allowed_block_kinds.includes(block?.kind)) {
      failures.push(`${blockPrefix}:kind_not_allowed`);
    }
    if (seenKinds.has(block?.kind)) failures.push(`${blockPrefix}:duplicate_kind`);
    seenKinds.add(block?.kind);
    if (typeof block?.text !== 'string' || !block.text.trim() || block.text.length > 1200) {
      failures.push(`${blockPrefix}:invalid_text`);
    }
  });

  const sufficient = (surface.claims || []).filter(isSufficientProjectedClaim);
  if (sufficient.length === 0) {
    if (translation.status !== TRANSLATION_STATUS.ABSTAINED
        || translation.format !== TRANSLATION_FORMATS.ABSTENTION
        || blocks.length !== 1
        || blocks[0]?.kind !== 'limitation') {
      failures.push(`${prefix}:abstention_weakened`);
    }
  } else if (translation.status !== TRANSLATION_STATUS.TRANSLATED) {
    failures.push(`${prefix}:supported_surface_not_translated`);
  }

  const hypothesis = sufficient.some(({ classification }) => classification === 'Hypothesis');
  if (hypothesis && !blocks.some(({ kind }) => kind === 'limitation')) {
    failures.push(`${prefix}:hypothesis_limitation_missing`);
  }

  const text = outputText(translation);
  if (containsUnsupportedNarrativeClaim(text)) failures.push(`${prefix}:unsupported_claim_language`);
  if (DIRECT_QUOTATION.test(text)) failures.push(`${prefix}:direct_quotation_not_allowed`);
  if (TECHNICAL_CUSTOMER_LANGUAGE.test(text)) failures.push(`${prefix}:technical_language_leakage`);
  if (text.includes(INSUFFICIENT_EVIDENCE)) failures.push(`${prefix}:raw_abstention_phrase_exposed`);
  const allowedNumbers = sourceNumbers(surface);
  for (const match of text.matchAll(NUMERIC_TOKEN)) {
    if (!allowedNumbers.has(match[0].toLowerCase())) {
      failures.push(`${prefix}:new_numeric_claim:${match[0]}`);
    }
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

  const seenCustomerBlocks = new Map();
  for (const translation of bundle.translations || []) {
    for (const block of translation?.customer_copy?.blocks || []) {
      const normalized = String(block?.text || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalized.length < 32) continue;
      if (seenCustomerBlocks.has(normalized)) {
        failures.push(
          `translations.${translation.surface_id}:repeated_customer_copy:${seenCustomerBlocks.get(normalized)}`,
        );
      } else {
        seenCustomerBlocks.set(normalized, translation.surface_id);
      }
    }
  }
  return validationResult(failures);
}

export function semanticContractsForSurface(surface) {
  return expectedSemanticContracts(surface);
}
