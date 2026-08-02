import {
  BOS_CUSTOMER_INTELLIGENCE_VERSION,
  DETERMINISTIC_ABSTENTION_COPY,
  INSUFFICIENT_EVIDENCE,
  TRANSLATION_STATUS,
} from './contracts.js';
import { isSufficientProjectedClaim } from './semanticPacket.js';
import { semanticContractsForSurface } from './translationValidator.js';

function humanize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function supportedCopy(surface, sufficient) {
  const classifications = [...new Set(sufficient.map(({ classification }) => classification))];
  const confidenceBands = [...new Set(sufficient.map(({ confidence }) => humanize(confidence.band)))];
  const isHypothesis = classifications.includes('Hypothesis');
  return {
    headline: surface.label,
    explanation: sufficient.map(({ claim }) => claim).join(' '),
    recognizable_pattern:
      'You may notice the described pattern in some situations. Check where it matches your actual behavior and where it does not.',
    evidence_boundary: isHypothesis
      ? `This is a hypothesis with ${confidenceBands.join(' and ')} uncalibrated confidence, not proof of an outcome.`
      : `This is ${classifications.join(' and ').toLowerCase()} evidence with ${confidenceBands.join(' and ')} uncalibrated confidence, not proof of a fixed personality type or outcome.`,
    practical_use:
      'Use this as a prompt to notice where the supported pattern does and does not match your lived experience.',
  };
}

function translationForSurface(surface) {
  const sufficient = (surface.claims || []).filter(isSufficientProjectedClaim);
  const abstained = sufficient.length === 0;
  return {
    surface_id: surface.surface_id,
    claim_ids: (surface.claims || []).map(({ claim_id }) => claim_id),
    status: abstained ? TRANSLATION_STATUS.ABSTAINED : TRANSLATION_STATUS.TRANSLATED,
    customer_copy: abstained
      ? { ...DETERMINISTIC_ABSTENTION_COPY }
      : supportedCopy(surface, sufficient),
    semantic_contracts: semanticContractsForSurface(surface),
  };
}

export function buildDeterministicLayer3Translation(packet) {
  return Object.freeze({
    version: BOS_CUSTOMER_INTELLIGENCE_VERSION,
    source_hash: packet.semantic_hash,
    translations: Object.freeze(packet.surfaces.map(translationForSurface)),
  });
}

export function isAbstentionTranslation(translation) {
  return translation?.status === TRANSLATION_STATUS.ABSTAINED
    && translation?.customer_copy?.headline === INSUFFICIENT_EVIDENCE;
}
