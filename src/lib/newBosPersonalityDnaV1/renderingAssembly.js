import { CONFIDENCE_STATES, SURFACES } from './constants.js';
import { invariant } from './contracts.js';
import { validateHumanRealization, validateSurfaceRendering } from './truthValidator.js';

const SHA256_INITIAL = Object.freeze([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const SHA256_ROUND = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

/** Browser-safe synchronous SHA-256 used only to bind rendering to exact realized prose. */
export function customerProseSha256(value) {
  const input = new TextEncoder().encode(String(value));
  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  view.setUint32(paddedLength - 8, high, false);
  view.setUint32(paddedLength - 4, low, false);

  const hash = [...SHA256_INITIAL];
  const words = new Uint32Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const before = words[index - 15];
      const prior = words[index - 2];
      const sigma0 = rotateRight(before, 7) ^ rotateRight(before, 18) ^ (before >>> 3);
      const sigma1 = rotateRight(prior, 17) ^ rotateRight(prior, 19) ^ (prior >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const upper1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 = (h + upper1 + choose + SHA256_ROUND[index] + words[index]) >>> 0;
      const upper0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (upper0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

function proseFragments(customerProse) {
  const paragraphs = String(customerProse).split(/\r?\n\s*\r?\n/u).map((item) => item.trim()).filter(Boolean);
  invariant(paragraphs.length > 0, 'Rendering assembly requires realized customer prose');
  const summary = paragraphs.find((item) => !/^#{1,6}\s+/u.test(item)) || paragraphs[0];
  const heading = paragraphs[0].match(/^#{1,6}\s+(.+)$/u)?.[1];
  const headline = heading || summary.match(/^.+?[.!?](?=\s|$)/us)?.[0] || summary;
  invariant(String(headline).trim() && String(summary).trim(), 'Rendering assembly requires non-empty prose fragments');
  invariant(String(customerProse).includes(headline), 'Rendering headline must remain an exact realized-prose substring');
  invariant(String(customerProse).includes(summary), 'Rendering summary must remain an exact realized-prose substring');
  return { headline, summary };
}

function structuredRendering(surfaceId, specialistTruth, summary) {
  switch (surfaceId) {
    case 'this_is_you': {
      const recognition = specialistTruth.recognition;
      return {
        recognizable_moments: recognition.recognizable_moments,
        mechanisms: recognition.mechanisms,
        private_calculations: recognition.private_calculations,
        tensions: recognition.tensions,
      };
    }
    case 'personality_dna': return { ...specialistTruth.personality_dna };
    case 'how_you_operate': return {
      operating_loop: specialistTruth.operating_engine.loop,
      mechanisms: specialistTruth.operating_engine.mechanisms,
    };
    case 'how_people_experience_you': return { ...specialistTruth.people_experience };
    case 'communication_dna': return { ...specialistTruth.communication };
    case 'strengths_vulnerabilities': return { ...specialistTruth.strengths_vulnerabilities };
    case 'pressure_conflict': return { ...specialistTruth.pressure_conflict };
    case 'work_dna': return { ...specialistTruth.work_environment };
    case 'role_seat': return { ...specialistTruth.role_seat };
    case 'cognitive_operating_style': return { ...specialistTruth.cognition };
    case 'personal_operating_energy': {
      const energy = specialistTruth.energy;
      return {
        layers: { trait: energy.trait, state: energy.state, context: energy.context, trajectory: energy.trajectory },
        activation: energy.activation,
        depletion: energy.depletion,
        resilience: energy.resilience,
        recovery: energy.recovery,
      };
    }
    case 'five_futures': return {
      futures: specialistTruth.five_futures.items.map((future) => ({ ...future, label: future.future_identity })),
    };
    case 'one_move': return { ...specialistTruth.one_move };
    case 'evidence_certainty': return {
      ...specialistTruth.validation,
      future_relationship: summary,
    };
    case 'operating_identity': return { ...specialistTruth.operating_identity };
    default: throw new Error(`Unknown rendering assembly surface ${surfaceId}`);
  }
}

export function assembleRealizedSurfaceRendering({ packet, humanRealization, profileId = null, subjectToken }) {
  invariant(SURFACES.some(({ id }) => id === packet?.surface_id), `Unknown rendering assembly surface ${packet?.surface_id}`);
  invariant(humanRealization?.surface_id === packet.surface_id, `Surface ${packet.surface_id} realization is mismatched during rendering assembly`);
  invariant(packet.resolved_local_truth?.surface_id === packet.surface_id, `Surface ${packet.surface_id} truth is mismatched during rendering assembly`);
  invariant(packet.resolved_local_truth.subject_token === subjectToken, `Surface ${packet.surface_id} subject is mismatched during rendering assembly`);
  const customerProse = humanRealization.customer_prose;
  const { headline, summary } = proseFragments(customerProse);
  const evidenceRefs = packet.resolved_local_truth.evidence.map(({ evidence_id: id }) => id);
  return Object.freeze({
    depth_contract: 'rich_surface_v1',
    eyebrow: packet.label,
    headline,
    summary,
    evidence_refs: Object.freeze(evidenceRefs),
    assembly_identity: Object.freeze({
      contract: 'bos_browser_rendering_completeness_v1',
      surface_id: packet.surface_id,
      profile_id: profileId || null,
      subject_token: subjectToken,
      customer_prose_sha256: customerProseSha256(customerProse),
    }),
    ...structuredRendering(packet.surface_id, packet.resolved_local_truth.specialist_truth, summary),
  });
}

function requiredText(value, label) {
  invariant(typeof value === 'string' && value.trim(), `${label} requires text`);
}

function requiredArray(value, label, minimum = 1, exact = null) {
  invariant(Array.isArray(value) && value.length >= minimum, `${label} requires at least ${minimum} item${minimum === 1 ? '' : 's'}`);
  if (exact != null) invariant(value.length === exact, `${label} requires exactly ${exact} items`);
}

function evidenceBound(items, label, fields, { requiresFalsifier = true } = {}) {
  requiredArray(items, label);
  items.forEach((item, index) => {
    invariant(item && typeof item === 'object', `${label}[${index}] requires an object`);
    fields.forEach((field) => requiredText(item[field], `${label}[${index}].${field}`));
    invariant(CONFIDENCE_STATES.includes(item.confidence), `${label}[${index}] requires governed confidence`);
    requiredArray(item.evidence_refs, `${label}[${index}].evidence_refs`);
    if (requiresFalsifier) requiredText(item.falsifier || item.what_would_change_it, `${label}[${index}].falsifier`);
  });
}

function requiredRenderingShape(surfaceId, rendering) {
  requiredText(rendering.eyebrow, `${surfaceId}.eyebrow`);
  switch (surfaceId) {
    case 'this_is_you':
      requiredArray(rendering.recognizable_moments, 'this_is_you.recognizable_moments');
      rendering.recognizable_moments.forEach((item, index) => requiredText(item, `this_is_you.recognizable_moments[${index}]`));
      evidenceBound(rendering.mechanisms, 'this_is_you.mechanisms', ['label', 'explanation']);
      requiredArray(rendering.private_calculations, 'this_is_you.private_calculations');
      rendering.private_calculations.forEach((item, index) => requiredText(item, `this_is_you.private_calculations[${index}]`));
      break;
    case 'personality_dna':
      requiredArray(rendering.coordinate_explanations, 'personality_dna.coordinate_explanations', 8, 8);
      evidenceBound(
        rendering.coordinate_explanations,
        'personality_dna.coordinate_explanations',
        ['coordinate_id', 'label', 'availability', 'interaction', 'not_meaning'],
        { requiresFalsifier: false },
      );
      ['topology_summary', 'speed', 'temperature'].forEach((field) => requiredText(rendering[field], `personality_dna.${field}`));
      break;
    case 'how_you_operate':
      requiredArray(rendering.operating_loop, 'how_you_operate.operating_loop');
      rendering.operating_loop.forEach((item, index) => requiredText(item, `how_you_operate.operating_loop[${index}]`));
      evidenceBound(rendering.mechanisms, 'how_you_operate.mechanisms', ['label', 'explanation']);
      break;
    case 'how_people_experience_you':
      evidenceBound(rendering.states, 'how_people_experience_you.states', ['label', 'hypothesis']);
      requiredText(rendering.observer_boundary, 'how_people_experience_you.observer_boundary');
      break;
    case 'communication_dna':
      ['speed', 'temperature'].forEach((field) => requiredText(rendering[field], `communication_dna.${field}`));
      evidenceBound(rendering.dimensions, 'communication_dna.dimensions', ['label', 'continuum', 'interpretation']);
      break;
    case 'strengths_vulnerabilities':
      evidenceBound(rendering.mechanisms, 'strengths_vulnerabilities.mechanisms', ['strength', 'immediate_payoff', 'reinforcement', 'delayed_cost', 'conditions']);
      break;
    case 'pressure_conflict':
      ['baseline', 'pressure_state', 'recovery'].forEach((field) => requiredText(rendering[field], `pressure_conflict.${field}`));
      evidenceBound(rendering.transformations, 'pressure_conflict.transformations', ['label', 'baseline', 'pressure_expression', 'recovery']);
      break;
    case 'work_dna':
      evidenceBound(rendering.demands, 'work_dna.demands', ['demand', 'natural_fit', 'adaptation_cost', 'sustainability']);
      ['fit_summary', 'friction_summary'].forEach((field) => requiredText(rendering[field], `work_dna.${field}`));
      break;
    case 'role_seat':
      ['selected_fit', 'selected_configuration', 'plural_success_note', 'review_trigger'].forEach((field) => requiredText(rendering[field], `role_seat.${field}`));
      evidenceBound(rendering.fit_states, 'role_seat.fit_states', ['fit_class', 'role_configuration', 'reasoning']);
      requiredArray(rendering.scaffolding, 'role_seat.scaffolding');
      rendering.scaffolding.forEach((item, index) => requiredText(item, `role_seat.scaffolding[${index}]`));
      break;
    case 'cognitive_operating_style':
      requiredText(rendering.boundary, 'cognitive_operating_style.boundary');
      evidenceBound(rendering.indicators, 'cognitive_operating_style.indicators', ['indicator', 'task_demand', 'observed_process', 'outcome', 'correction_transfer', 'assistance']);
      break;
    case 'personal_operating_energy':
      ['trait', 'state', 'context', 'trajectory'].forEach((layer) => {
        invariant(rendering.layers?.[layer] && typeof rendering.layers[layer] === 'object', `personal_operating_energy.layers.${layer} requires an object`);
        invariant(CONFIDENCE_STATES.includes(rendering.layers[layer].status), `personal_operating_energy.layers.${layer} requires governed status`);
        requiredText(rendering.layers[layer].summary, `personal_operating_energy.layers.${layer}.summary`);
        requiredArray(rendering.layers[layer].evidence_refs, `personal_operating_energy.layers.${layer}.evidence_refs`);
        requiredText(rendering.layers[layer].falsifier, `personal_operating_energy.layers.${layer}.falsifier`);
      });
      ['activation', 'depletion', 'resilience', 'recovery'].forEach((field) => requiredText(rendering[field], `personal_operating_energy.${field}`));
      break;
    case 'five_futures':
      requiredArray(rendering.futures, 'five_futures.futures', 5, 5);
      evidenceBound(rendering.futures, 'five_futures.futures', ['label', 'condition', 'mechanism', 'trajectory', 'triggers', 'indicators', 'movers', 'horizon', 'falsifier', 'review_trigger']);
      break;
    case 'one_move':
      ['target_mechanism', 'intervention', 'rationale', 'strength_preserved', 'expected_outcome', 'burden', 'risk', 'reversibility', 'observable_result', 'horizon', 'falsifier', 'stop_adjust_condition']
        .forEach((field) => requiredText(rendering[field], `one_move.${field}`));
      invariant(CONFIDENCE_STATES.includes(rendering.confidence), 'one_move requires governed confidence');
      requiredArray(rendering.evidence_refs, 'one_move.evidence_refs');
      requiredArray(rendering.alternatives_considered, 'one_move.alternatives_considered');
      rendering.alternatives_considered.forEach((item, index) => requiredText(item, `one_move.alternatives_considered[${index}]`));
      break;
    case 'evidence_certainty':
      evidenceBound(rendering.claims, 'evidence_certainty.claims', ['human_label', 'claim', 'inference_boundary']);
      requiredArray(rendering.conflicts, 'evidence_certainty.conflicts');
      rendering.conflicts.forEach((item, index) => requiredText(item, `evidence_certainty.conflicts[${index}]`));
      requiredArray(rendering.what_would_change_the_map, 'evidence_certainty.what_would_change_the_map');
      rendering.what_would_change_the_map.forEach((item, index) => requiredText(item, `evidence_certainty.what_would_change_the_map[${index}]`));
      requiredText(rendering.future_relationship, 'evidence_certainty.future_relationship');
      break;
    case 'operating_identity':
      ['governing_logic', 'memorable_use', 'not_a_type', 'falsifier'].forEach((field) => requiredText(rendering[field], `operating_identity.${field}`));
      requiredArray(rendering.evidence_refs, 'operating_identity.evidence_refs');
      break;
    default: throw new Error(`Unknown browser-rendering surface ${surfaceId}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function validateBrowserRenderableCandidate(candidate, forbiddenIdentityTokens = []) {
  invariant(candidate && typeof candidate === 'object', 'Browser-renderable candidate requires an artifact');
  invariant(Array.isArray(candidate.surface_packets), 'Browser-renderable candidate requires surface packets');
  invariant(candidate.surface_packets.length === SURFACES.length, `Browser-renderable candidate requires exactly ${SURFACES.length} surfaces`);
  const canonicalIds = new Set(SURFACES.map(({ id }) => id));
  const ids = candidate.surface_packets.map(({ surface_id: id }) => id);
  ids.forEach((id) => invariant(canonicalIds.has(id), `Browser-renderable candidate contains unknown surface ${id}`));
  invariant(new Set(ids).size === SURFACES.length, 'Browser-renderable candidate contains a duplicate surface');
  if (candidate.real_profile_gate === true) {
    invariant(/^MM-[A-Z0-9-]+$/u.test(candidate.profile_id || ''), 'Browser-renderable real candidate requires profile identity');
    invariant(candidate.subject_token === `REAL-PDNV1-${candidate.profile_id}`, 'Browser-renderable candidate profile and subject identity mismatch');
  }
  invariant(candidate.raw_evidence?.subject_token === candidate.subject_token, 'Browser-renderable candidate raw subject identity mismatch');
  invariant((candidate.raw_evidence?.profile_id || null) === (candidate.profile_id || null), 'Browser-renderable candidate raw profile identity mismatch');

  SURFACES.forEach((surface) => {
    const packet = candidate.surface_packets.find(({ surface_id: id }) => id === surface.id);
    invariant(packet.surface_number === surface.number, `Surface ${surface.id} number mismatch`);
    invariant(packet.label === surface.label, `Surface ${surface.id} label mismatch`);
    invariant(packet.destination === surface.destination, `Surface ${surface.id} destination mismatch`);
    invariant(packet.resolved_local_truth?.surface_id === surface.id, `Surface ${surface.id} resolved truth mismatch`);
    invariant(packet.resolved_local_truth.subject_token === candidate.subject_token, `Surface ${surface.id} resolved subject mismatch`);
    invariant(packet.human_realization?.surface_id === surface.id, `Surface ${surface.id} human realization mismatch`);
    invariant(packet.rendering && typeof packet.rendering === 'object', `Surface ${surface.id} requires a browser rendering object`);
    invariant(packet.rendering.assembly_identity?.surface_id === surface.id, `Surface ${surface.id} rendering assembly identity mismatch`);
    invariant((packet.rendering.assembly_identity.profile_id || null) === (candidate.profile_id || null), `Surface ${surface.id} rendering profile identity mismatch`);
    invariant(packet.rendering.assembly_identity.subject_token === candidate.subject_token, `Surface ${surface.id} rendering subject identity mismatch`);
    invariant(
      packet.rendering.assembly_identity.customer_prose_sha256 === customerProseSha256(packet.human_realization.customer_prose),
      `Surface ${surface.id} realized-prose digest mismatch`,
    );
    validateHumanRealization({
      surfaceId: surface.id,
      realization: packet.human_realization,
      localTruth: packet.resolved_local_truth,
      subjectToken: candidate.subject_token,
      forbiddenSubjectTokens: forbiddenIdentityTokens,
    });
    validateSurfaceRendering({
      surfaceId: surface.id,
      rendering: packet.rendering,
      localTruth: packet.resolved_local_truth,
      subjectToken: candidate.subject_token,
      forbiddenSubjectTokens: forbiddenIdentityTokens,
    });
    requiredRenderingShape(surface.id, packet.rendering);
    const expected = assembleRealizedSurfaceRendering({
      packet,
      humanRealization: packet.human_realization,
      profileId: candidate.profile_id || null,
      subjectToken: candidate.subject_token,
    });
    invariant(
      JSON.stringify(stable(packet.rendering)) === JSON.stringify(stable(expected)),
      `Surface ${surface.id} rendering does not match deterministic governed assembly`,
    );
  });
  return candidate;
}
