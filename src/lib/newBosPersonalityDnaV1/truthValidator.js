import {
  CONFIDENCE_STATES,
  NEW_BOS_HUMAN_REALIZATION_VERSION,
  ROLE_FIT_STATES,
  SURFACES,
} from './constants.js';
import { invariant } from './contracts.js';

const CATASTROPHIC_PROHIBITED_ASSERTION_PATTERNS = Object.freeze([
  /\byou(?:r)?\s+(?:iq|intelligence quotient)(?:\s+(?:is|score|ranking))?\b/i,
  /\byou (?:are|rank) (?:a |an )?(?:genius|intellectually gifted|top \d+(?:\.\d+)?% intellectually)\b/i,
  /\byou (?:have|meet the criteria for|are diagnosed with) (?:a |an )?(?:clinical |mental |personality )?(?:diagnosis|disorder|condition)\b/i,
  /\byou (?:are|seem) (?:autistic|bipolar|clinically depressed|a narcissist|a psychopath)\b/i,
  /\bbecause of your (?:race|ethnicity|religion|sexual orientation|gender identity|disability)\b/i,
  /\byour (?:race|ethnicity|religion|sexual orientation|gender identity|disability) (?:makes|causes|explains|means)\b/i,
]);

const STRUCTURED_RENDERING_PROHIBITED_ASSERTION_PATTERNS = Object.freeze([
  ...CATASTROPHIC_PROHIBITED_ASSERTION_PATTERNS,
]);

const INTERNAL_CUSTOMER_LANGUAGE = Object.freeze([
  /\b(?:claim|evidence|counterevidence|surface|profile|subject)_id\b/i,
  /\b(?:evidence_refs|counterevidence_refs|source_ref|library_selection|source_lineage)\b/i,
  /\b(?:KNOWN|STRONGLY_SUPPORTED|SUPPORTED_HYPOTHESIS|TENTATIVE|INSUFFICIENT_EVIDENCE)\b/,
  /\b(?:bos_[a-z0-9_]+|moremindmap:\/\/|sha-?256|manifest hash|schema version)\b/i,
]);

const SECRET_OR_CREDENTIAL_LANGUAGE = Object.freeze([
  /\bsk-[a-z0-9_-]{12,}\b/i,
  /\b(?:OPENAI_API_KEY|VERCEL_TOKEN|AUTH_TOKEN|API_SECRET)\s*[:=]\s*\S+/i,
  /\bBearer\s+[a-z0-9._~-]{16,}\b/i,
]);

const CANONICAL_SCORE_ASSERTION = /\b(command|tempo|relational awareness|precision|leverage|adaptability|structure|perspective)\b(?:\s+(?:coordinate|score|value|rating))?\s*(?:is|of|=|:)?\s*(\d+(?:\.\d+)?%?)/giu;

function stringsIn(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsIn(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => stringsIn(item, output));
  return output;
}

function normalizedNumberTokens(value) {
  return new Set(stringsIn(value)
    .flatMap((text) => [...text.matchAll(/\b\d+(?:\.\d+)?%?\b/g)].map((match) => match[0])));
}

function groundedNumber(token, governedTokens) {
  if (governedTokens.has(token)) return true;
  const numeric = Number.parseFloat(token.replace('%', ''));
  if (!Number.isFinite(numeric)) return false;
  const equivalents = new Set([String(numeric)]);
  if (numeric > 0 && numeric < 1 && !token.endsWith('%')) equivalents.add(String(Number((numeric * 100).toFixed(10))));
  if (token.endsWith('%')) equivalents.add(String(numeric));
  return [...equivalents].some((value) => governedTokens.has(value) || governedTokens.has(`${value}%`));
}

function validateStructuredTruthIntegrity(surfaceId, localTruth) {
  invariant(Array.isArray(localTruth.abstentions), `Surface ${surfaceId} requires structured abstentions`);

  const role = localTruth.specialist_truth?.role_seat;
  if (surfaceId === 'role_seat' && Array.isArray(role?.fit_states)) {
    invariant(
      ROLE_FIT_STATES.includes(role.selected_fit),
      'Role surface requires a governed selected-fit state',
    );
  }

  const energy = localTruth.specialist_truth?.energy;
  const energyUsesLayeredContract = ['trait', 'state', 'context', 'trajectory']
    .some((layer) => energy?.[layer] && typeof energy[layer] === 'object');
  if (surfaceId === 'personal_operating_energy' && energyUsesLayeredContract) {
    ['trait', 'state', 'context', 'trajectory'].forEach((layer) => {
      invariant(energy[layer] && typeof energy[layer] === 'object', `Energy surface requires structured ${layer} state`);
      invariant(CONFIDENCE_STATES.includes(energy[layer].status), `Energy ${layer} requires governed status`);
    });
  }
}

function validateCanonicalScoreClaims(surfaceId, text, localTruth) {
  const governedNumberTokens = normalizedNumberTokens({
    evidence: localTruth.evidence,
    specialist_truth: localTruth.specialist_truth,
    resolved_claims: localTruth.resolved_claims,
  });
  for (const match of text.matchAll(CANONICAL_SCORE_ASSERTION)) {
    invariant(
      groundedNumber(match[2], governedNumberTokens),
      `Surface ${surfaceId} mutated the canonical ${match[1]} score`,
    );
  }
}

function collectRefs(value, output = []) {
  if (Array.isArray(value)) value.forEach((item) => collectRefs(item, output));
  else if (value && typeof value === 'object') {
    if (Array.isArray(value.evidence_refs)) output.push(...value.evidence_refs);
    if (Array.isArray(value.counterevidence_refs)) output.push(...value.counterevidence_refs);
    Object.values(value).forEach((item) => collectRefs(item, output));
  }
  return output;
}

function validateRichRendering(surfaceId, rendering, availableEvidenceIds) {
  invariant(rendering.depth_contract === 'rich_surface_v1', `Surface ${surfaceId} rich rendering version mismatch`);
  invariant(Array.isArray(rendering.evidence_refs) && rendering.evidence_refs.length > 0, `Surface ${surfaceId} rich rendering requires evidence_refs`);
  collectRefs(rendering).forEach((ref) => invariant(availableEvidenceIds.has(ref), `Surface ${surfaceId} rendering references missing evidence ${ref}`));

  if (surfaceId === 'five_futures') {
    invariant(rendering.futures?.length === 5, 'Five Futures rendering requires exactly five trajectories');
    rendering.futures.forEach((future, index) => {
      ['condition', 'mechanism', 'trajectory', 'falsifier', 'review_trigger'].forEach((field) => {
        invariant(typeof future[field] === 'string' && future[field].trim(), `Future ${index + 1} requires ${field}`);
      });
    });
  }
  if (surfaceId === 'one_move') {
    ['target_mechanism', 'intervention', 'strength_preserved', 'observable_result', 'falsifier', 'stop_adjust_condition']
      .forEach((field) => invariant(typeof rendering[field] === 'string' && rendering[field].trim(), `One Move rendering requires ${field}`));
  }
  if (surfaceId === 'evidence_certainty') {
    invariant(rendering.claims?.every((claim) => claim.human_label && !/^\w\d{2}$/i.test(claim.human_label)), 'Validation claims require human-readable labels');
  }
}

export function validateSurfaceRendering({
  surfaceId,
  rendering,
  localTruth,
  subjectToken,
  forbiddenSubjectTokens = [],
}) {
  invariant(SURFACES.some(({ id }) => id === surfaceId), `Unknown realized surface ${surfaceId}`);
  invariant(rendering && typeof rendering === 'object', `Surface ${surfaceId} requires a rendering object`);
  invariant(typeof rendering.headline === 'string' && rendering.headline.trim(), `Surface ${surfaceId} requires a headline`);
  invariant(typeof rendering.summary === 'string' && rendering.summary.trim(), `Surface ${surfaceId} requires a summary`);
  invariant(localTruth?.version === 'bos_resolved_surface_truth_v1', `Surface ${surfaceId} requires resolved governed truth`);
  invariant(localTruth.surface_id === surfaceId, `Surface ${surfaceId} received mismatched local truth`);

  const text = stringsIn(rendering).join('\n');
  STRUCTURED_RENDERING_PROHIBITED_ASSERTION_PATTERNS.forEach((pattern) => invariant(!pattern.test(text), `Surface ${surfaceId} failed prohibited-claim validation: ${pattern}`));
  forbiddenSubjectTokens
    .filter((token) => token && token !== subjectToken)
    .forEach((token) => invariant(!text.includes(token), `Surface ${surfaceId} contains cross-fixture token ${token}`));

  const availableEvidenceIds = new Set((localTruth.evidence || []).map(({ evidence_id: id }) => id));
  if (rendering.depth_contract) validateRichRendering(surfaceId, rendering, availableEvidenceIds);
  validateStructuredTruthIntegrity(surfaceId, localTruth);
  return rendering;
}

export function validateAllSurfaceRenderings(packets, subjectToken, forbiddenSubjectTokens = []) {
  packets.forEach((packet) => {
    if (!packet.rendering) return;
    validateSurfaceRendering({
      surfaceId: packet.surface_id,
      rendering: packet.rendering,
      localTruth: packet.resolved_local_truth,
      subjectToken,
      forbiddenSubjectTokens,
    });
  });
  return packets;
}

/** Minimal post-generation catastrophic integrity gate. It never judges ordinary prose meaning or form. */
export function validateHumanRealization({
  surfaceId,
  realization,
  localTruth,
  subjectToken,
  forbiddenSubjectTokens = [],
}) {
  invariant(SURFACES.some(({ id }) => id === surfaceId), `Unknown human-realization surface ${surfaceId}`);
  invariant(realization?.version === NEW_BOS_HUMAN_REALIZATION_VERSION, `Surface ${surfaceId} human realization version mismatch`);
  invariant(realization.surface_id === surfaceId, `Surface ${surfaceId} human realization is mismatched`);
  invariant(typeof realization.customer_prose === 'string' && realization.customer_prose.trim(), `Surface ${surfaceId} requires customer prose`);
  invariant(localTruth?.version === 'bos_resolved_surface_truth_v1', `Surface ${surfaceId} requires resolved governed truth`);
  invariant(localTruth.surface_id === surfaceId, `Surface ${surfaceId} received mismatched local truth`);

  const text = realization.customer_prose.trim();
  CATASTROPHIC_PROHIBITED_ASSERTION_PATTERNS.forEach((pattern) => invariant(!pattern.test(text), `Surface ${surfaceId} failed catastrophic-claim validation: ${pattern}`));
  INTERNAL_CUSTOMER_LANGUAGE.forEach((pattern) => invariant(!pattern.test(text), `Surface ${surfaceId} leaked internal language: ${pattern}`));
  SECRET_OR_CREDENTIAL_LANGUAGE.forEach((pattern) => invariant(!pattern.test(text), `Surface ${surfaceId} leaked secret or credential material`));
  forbiddenSubjectTokens
    .filter((token) => token && token !== subjectToken)
    .forEach((token) => invariant(!text.includes(token), `Surface ${surfaceId} contains cross-fixture token ${token}`));
  invariant(!subjectToken || !text.includes(subjectToken), `Surface ${surfaceId} leaked its subject token`);

  const availableEvidenceIds = new Set((localTruth.evidence || []).map(({ evidence_id: id }) => id));
  invariant(Array.isArray(realization.governed_evidence_refs), `Surface ${surfaceId} requires governed evidence refs`);
  invariant(realization.governed_evidence_refs.length > 0, `Surface ${surfaceId} requires at least one governed evidence ref`);
  realization.governed_evidence_refs.forEach((ref) => invariant(availableEvidenceIds.has(ref), `Surface ${surfaceId} realization references missing evidence ${ref}`));

  validateCanonicalScoreClaims(surfaceId, text, localTruth);
  validateStructuredTruthIntegrity(surfaceId, localTruth);
  return realization;
}

/** Structural review notes only. Customer wording is never inspected, rewritten, retried, or blocked here. */
export function auditHumanRealization({ surfaceId, realization, localTruth }) {
  void realization;
  const notes = [];
  if (surfaceId === 'role_seat' && localTruth?.specialist_truth?.role_seat?.selected_fit === 'INSUFFICIENT_EVIDENCE') {
    notes.push(Object.freeze({ code: 'governed_role_fit_abstention_active', blocking: false }));
  }
  if (surfaceId === 'personal_operating_energy' && localTruth?.specialist_truth?.energy?.trajectory?.status === 'INSUFFICIENT_EVIDENCE') {
    notes.push(Object.freeze({ code: 'governed_energy_trajectory_abstention_active', blocking: false }));
  }
  return Object.freeze({
    version: 'bos_human_realization_non_blocking_audit_v4',
    surface_id: surfaceId,
    blocking: false,
    notes: Object.freeze(notes),
  });
}

export function validateAllHumanRealizations(packets, subjectToken, forbiddenSubjectTokens = []) {
  packets.forEach((packet) => {
    if (!packet.human_realization) return;
    validateHumanRealization({
      surfaceId: packet.surface_id,
      realization: packet.human_realization,
      localTruth: packet.resolved_local_truth,
      subjectToken,
      forbiddenSubjectTokens,
    });
  });
  return packets;
}

export {
  CATASTROPHIC_PROHIBITED_ASSERTION_PATTERNS,
  INTERNAL_CUSTOMER_LANGUAGE,
  STRUCTURED_RENDERING_PROHIBITED_ASSERTION_PATTERNS as PROHIBITED_ASSERTION_PATTERNS,
};
