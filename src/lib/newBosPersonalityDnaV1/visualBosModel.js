import { NEW_BOS_VISUAL_SYSTEM_VERSION } from './constants.js';
import { resolveCustomerTopProjection } from './topProjection.js';

function compact(values, limit = 5) {
  return [...new Set((values || []).filter((value) => typeof value === 'string' && value.trim()))].slice(0, limit);
}

function surfaceRendering(artifact, surfaceId) {
  return artifact.surface_packets.find(({ surface_id: id }) => id === surfaceId)?.rendering || {};
}

function first(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || 'Evidence still developing';
}

/**
 * Projects an already-governed artifact into a visual-system view model.
 * It does not infer identity from scores or use personality lookup tables.
 */
export function buildVisualBosModel(artifact) {
  const topProjection = resolveCustomerTopProjection(artifact);
  const projected = topProjection.visual_bos;
  const dna = artifact.personality_dna;
  const rich = dna.specialized_intelligence?.visual_bos || {};
  const dynamics = dna.causal_dynamics || [];
  const futures = surfaceRendering(artifact, 'five_futures').futures || [];
  const evidence = dna.evidence_certainty;

  return Object.freeze({
    version: NEW_BOS_VISUAL_SYSTEM_VERSION,
    subject_token: artifact.subject_token,
    display_name: artifact.identity_context.display_name,
    operating_identity: projected.operating_identity,
    primary_pattern: projected.primary_pattern,
    secondary_pattern: projected.secondary_pattern,
    tertiary_pattern: projected.tertiary_pattern,
    operating_core: projected.operating_core,
    core_explanation: projected.core_explanation,
    inputs: projected.inputs,
    outputs: projected.outputs,
    operating_loop: projected.operating_loop,
    central_tension: projected.central_tension,
    transfer_gap: projected.transfer_gap,
    pressure_shift: projected.pressure_shift,
    recovery_path: projected.recovery_path,
    energy_source: projected.energy_source,
    fatigue_source: projected.fatigue_source,
    environment_fit: projected.environment_fit,
    environment_risk: projected.environment_risk,
    one_move: projected.one_move,
    one_move_result: projected.one_move_result,
    futures: Object.freeze((projected.futures.length ? projected.futures : futures).slice(0, 5).map((future) => Object.freeze({
      label: first(future.label, future.future_identity),
      condition: first(future.condition),
      trajectory: first(future.trajectory),
    }))),
    signals: Object.freeze(compact(projected.signals.length ? projected.signals : rich.signals || [
      ...(dna.evidence_certainty.validation_backlog || []),
      ...dynamics.map(({ what_would_change_it: value }) => value),
    ], 4)),
    evidence_summary: Object.freeze({
      known: evidence.known.length,
      strongly_supported: evidence.strongly_supported.length,
      learning: evidence.supported_hypotheses.length + evidence.tentative.length,
      abstentions: evidence.abstentions.length,
    }),
    evidence_boundary: 'A synthesis of governed evidence and bounded hypotheses—not a prediction, diagnosis, or fixed type.',
  });
}

export default buildVisualBosModel;
