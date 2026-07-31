import { CLAIM_CLASSIFICATIONS } from './evidenceContract.js';

const UNSUPPORTED_CERTAINTY = /\b(always|never|inevitably|definitely|certainly|guarantees?|proves?|will)\b/i;
const NUMERIC_TIMELINE = /\b(?:within\s+|after\s+|by\s+)?\d+(?:\s*[-–]\s*\d+)?\s*(?:day|week|month|quarter|year)s?\b/gi;
const QUANTIFIED_OUTCOME = /\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?x\b/gi;
const QUOTED_TEXT = /["“]([^"”]{3,})["”]/g;

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceCorpus(sourceTexts) {
  return normalizeText((Array.isArray(sourceTexts) ? sourceTexts : []).filter(Boolean).join(' '));
}

function unsupportedMatches(pattern, claim, corpus) {
  const matches = [...String(claim || '').matchAll(pattern)].map((match) => match[0]);
  return matches.filter((match) => !corpus.includes(normalizeText(match)));
}

export function validateClaim({
  claim,
  classification = CLAIM_CLASSIFICATIONS.INFERRED,
  evidence = [],
  provenance = [],
  sourceTexts = [],
}) {
  const failures = [];
  const text = String(claim || '').trim();
  const corpus = sourceCorpus(sourceTexts);

  if (!text) failures.push('empty_claim');
  if (!Array.isArray(evidence) || evidence.length === 0) failures.push('missing_evidence');
  if (!Array.isArray(provenance) || provenance.length === 0) failures.push('missing_provenance');

  const quotations = [...text.matchAll(QUOTED_TEXT)].map((match) => match[1]);
  for (const quotation of quotations) {
    if (!corpus.includes(normalizeText(quotation))) {
      failures.push(`fabricated_quotation:${quotation}`);
    }
  }

  for (const timeline of unsupportedMatches(NUMERIC_TIMELINE, text, corpus)) {
    failures.push(`unsupported_timeline:${timeline}`);
  }

  for (const quantified of unsupportedMatches(QUANTIFIED_OUTCOME, text, corpus)) {
    failures.push(`unsupported_quantification:${quantified}`);
  }

  if (classification !== CLAIM_CLASSIFICATIONS.MEASURED && UNSUPPORTED_CERTAINTY.test(text)) {
    failures.push('unsupported_certainty_language');
  }

  return Object.freeze({
    valid: failures.length === 0,
    failures: Object.freeze(failures),
  });
}

export function containsUnsupportedNarrativeClaim(text) {
  const value = String(text || '');
  return UNSUPPORTED_CERTAINTY.test(value)
    || new RegExp(NUMERIC_TIMELINE.source, NUMERIC_TIMELINE.flags.replace('g', '')).test(value)
    || new RegExp(QUANTIFIED_OUTCOME.source, QUANTIFIED_OUTCOME.flags.replace('g', '')).test(value);
}

export {
  NUMERIC_TIMELINE,
  QUANTIFIED_OUTCOME,
  QUOTED_TEXT,
  UNSUPPORTED_CERTAINTY,
};
