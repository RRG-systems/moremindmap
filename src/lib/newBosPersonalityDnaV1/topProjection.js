import { DIMENSIONS, NEW_BOS_VISUAL_SYSTEM_VERSION } from './constants.js';

export const NEW_BOS_TOP_PROJECTION_VERSION = 'bos_customer_top_projection_v1';

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function first(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
}

function compact(values, limit = 5) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))].slice(0, limit);
}

function surfaceRendering(artifact, surfaceId) {
  return artifact.surface_packets?.find(({ surface_id: id }) => id === surfaceId)?.rendering || {};
}

function projectedBand(score) {
  if (score >= 72) return 'higher_relative_prior';
  if (score <= 35) return 'lower_relative_prior';
  return 'context_sensitive_prior';
}

/**
 * Converts a complete canonical 0-1 score source into customer-facing 0-100
 * coordinates. A source already expressed on 0-100 is preserved exactly.
 */
export function projectCanonicalScores(canonicalScores) {
  const entries = DIMENSIONS.map(({ id }) => [id, canonicalScores?.[id]]);
  entries.forEach(([id, score]) => invariant(
    Number.isFinite(score) && score >= 0 && score <= 100,
    `top_projection_score_invalid:${id}`,
  ));
  const normalizedSource = entries.every(([, score]) => score <= 1);
  return Object.freeze(Object.fromEntries(entries.map(([id, score]) => [
    id,
    normalizedSource ? Math.round(score * 10000) / 100 : score,
  ])));
}

export function buildCustomerTopProjection(artifact) {
  invariant(artifact && typeof artifact === 'object', 'top_projection_artifact_required');
  invariant(Array.isArray(artifact.surface_packets), 'top_projection_surface_packets_required');

  const recognition = surfaceRendering(artifact, 'this_is_you');
  const identity = surfaceRendering(artifact, 'operating_identity');
  const operating = surfaceRendering(artifact, 'how_you_operate');
  const people = surfaceRendering(artifact, 'how_people_experience_you');
  const communication = surfaceRendering(artifact, 'communication_dna');
  const strengths = surfaceRendering(artifact, 'strengths_vulnerabilities');
  const pressure = surfaceRendering(artifact, 'pressure_conflict');
  const work = surfaceRendering(artifact, 'work_dna');
  const role = surfaceRendering(artifact, 'role_seat');
  const cognition = surfaceRendering(artifact, 'cognitive_operating_style');
  const energy = surfaceRendering(artifact, 'personal_operating_energy');
  const futures = surfaceRendering(artifact, 'five_futures');
  const oneMove = surfaceRendering(artifact, 'one_move');
  const validation = surfaceRendering(artifact, 'evidence_certainty');
  const scores = projectCanonicalScores(artifact.canonical_scores);
  const bands = Object.freeze(Object.fromEntries(DIMENSIONS.map(({ id }) => [id, projectedBand(scores[id])])));

  const heroExplanation = first(recognition.summary, recognition.headline);
  const identityHeading = first(identity.headline, identity.summary);
  const identityExplanation = first(identity.summary, recognition.summary);
  invariant(heroExplanation, 'top_projection_recognition_meaning_required');
  invariant(identityHeading && identityExplanation, 'top_projection_identity_meaning_required');

  const visualBos = Object.freeze({
    version: NEW_BOS_VISUAL_SYSTEM_VERSION,
    operating_identity: identityHeading,
    primary_pattern: first(operating.headline, operating.summary),
    secondary_pattern: first(strengths.headline, strengths.summary),
    tertiary_pattern: first(people.headline, people.summary),
    operating_core: identityHeading,
    core_explanation: heroExplanation,
    inputs: Object.freeze(compact([
      cognition.headline,
      communication.headline,
      pressure.headline,
      work.headline,
    ], 4)),
    outputs: Object.freeze(compact([
      operating.headline,
      people.headline,
      strengths.headline,
      role.headline,
    ], 4)),
    operating_loop: Object.freeze(compact([
      cognition.headline,
      operating.headline,
      people.headline,
      pressure.headline,
      oneMove.headline,
    ], 7)),
    central_tension: first(strengths.summary, identityExplanation),
    transfer_gap: first(strengths.summary, work.summary),
    pressure_shift: first(pressure.headline, pressure.summary),
    recovery_path: first(pressure.summary, pressure.headline),
    energy_source: first(energy.headline, energy.summary),
    fatigue_source: first(energy.summary, energy.headline),
    environment_fit: first(work.headline, work.summary),
    environment_risk: first(work.summary, role.summary),
    one_move: first(oneMove.headline, oneMove.summary),
    one_move_result: first(oneMove.summary, oneMove.headline),
    futures: Object.freeze((futures.futures || []).slice(0, 5).map((future) => Object.freeze({
      label: first(future.label, future.future_identity),
      condition: first(future.condition),
      trajectory: first(future.trajectory),
    }))),
    signals: Object.freeze(compact([validation.headline, futures.summary, oneMove.summary, identity.summary], 4)),
  });

  Object.entries(visualBos).forEach(([key, value]) => {
    if (key === 'version') return;
    invariant(Array.isArray(value) ? value.length > 0 : Boolean(value), `top_projection_visual_bos_field_required:${key}`);
  });

  return Object.freeze({
    version: NEW_BOS_TOP_PROJECTION_VERSION,
    score_projection: Object.freeze({
      source_scale: DIMENSIONS.every(({ id }) => artifact.canonical_scores[id] <= 1) ? 'canonical_0_1' : 'customer_0_100',
      customer_scale: 'customer_0_100',
      scores,
      bands,
    }),
    hero: Object.freeze({ core_explanation: heroExplanation }),
    personality_dna_map: Object.freeze({
      identity_distillation: identityHeading,
      central_tension: identityExplanation,
    }),
    visual_bos: visualBos,
    lineage: Object.freeze({
      score_source: 'artifact.canonical_scores',
      hero_source: 'surface_packets.this_is_you.rendering',
      identity_source: 'surface_packets.operating_identity.rendering',
      visual_bos_source: 'governed_surface_renderings',
      surface_realizations_regenerated: false,
    }),
  });
}

export function resolveCustomerTopProjection(artifact) {
  return artifact.top_projection?.version === NEW_BOS_TOP_PROJECTION_VERSION
    ? artifact.top_projection
    : buildCustomerTopProjection(artifact);
}

export function attachCustomerTopProjection(artifact) {
  return Object.freeze({
    ...artifact,
    top_projection: buildCustomerTopProjection(artifact),
  });
}
