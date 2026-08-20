import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DESTINATIONS,
  RICH_SPECIALIST_DOMAINS,
  SURFACES,
  SYNTHETIC_FIXTURES,
  buildPersonalityDnaRuntime,
  runPersonalityDnaProductionContract,
  validateSurfaceRendering,
} from '../src/lib/newBosPersonalityDnaV1/index.js';

const artifacts = SYNTHETIC_FIXTURES.map((fixture) => buildPersonalityDnaRuntime(fixture));
const richArtifact = artifacts.find(({ subject_token: token }) => token === 'SYNTH-PDNV1-MOSAIC');

test('four synthetic people remain materially distinct', () => {
  assert.equal(artifacts.length, 4);
  assert.equal(new Set(artifacts.map(({ whole_person_model: model }) => model.core_explanation)).size, 4);
  assert.equal(new Set(artifacts.map(({ whole_person_model: model }) => model.identity_distillation)).size, 4);
});

test('nine destinations preserve every canonical surface exactly once', () => {
  assert.equal(DESTINATIONS.length, 9);
  const routed = DESTINATIONS.flatMap(({ surfaceIds }) => surfaceIds);
  assert.equal(routed.length, 15);
  assert.deepEqual(new Set(routed), new Set(SURFACES.map(({ id }) => id)));
});

test('every surface receives the frozen whole person and resolved local truth', () => {
  artifacts.forEach((artifact) => artifact.surface_packets.forEach((packet) => {
    assert.equal(packet.whole_person_model, artifact.whole_person_model);
    assert.equal(packet.resolved_local_truth.whole_person_model, artifact.whole_person_model);
    assert.equal(packet.resolved_local_truth.surface_id, packet.surface_id);
    assert.deepEqual(packet.claim_refs, packet.resolved_local_truth.resolved_claims.map(({ id }) => id));
    assert.ok(packet.resolved_local_truth.lineage.library_manifest_sha256);
  }));
});

test('resolved surface claims retain evidence, counterevidence, confounds and falsifiers', () => {
  richArtifact.surface_packets.forEach((packet) => {
    const evidenceIds = new Set(packet.resolved_local_truth.evidence.map(({ evidence_id: id }) => id));
    packet.resolved_local_truth.resolved_claims.forEach((claim) => {
      claim.evidence_refs.forEach((ref) => assert.ok(evidenceIds.has(ref), `${packet.surface_id}:${ref}`));
      claim.counterevidence_refs.forEach((ref) => assert.ok(evidenceIds.has(ref), `${packet.surface_id}:${ref}`));
      assert.ok(claim.what_would_change_it);
    });
    assert.ok(Array.isArray(packet.resolved_local_truth.confounds));
    assert.ok(Array.isArray(packet.resolved_local_truth.abstentions));
  });
});

test('rich fixture implements the complete typed specialist-domain inventory', () => {
  const specialized = richArtifact.personality_dna.specialized_intelligence;
  assert.equal(specialized.version, 'bos_depth_contract_v1');
  RICH_SPECIALIST_DOMAINS.forEach((domain) => assert.ok(specialized[domain], domain));
  assert.equal(specialized.personality_dna.coordinate_explanations.length, 8);
  assert.equal(specialized.five_futures.items.length, 5);
  assert.ok(specialized.communication.dimensions.length >= 10);
  assert.ok(specialized.strengths_vulnerabilities.mechanisms.length >= 3);
  assert.ok(specialized.pressure_conflict.transformations.length >= 3);
});

test('rich fixture carries dense evidence, causal mechanisms, contradictions and compensation', () => {
  assert.ok(richArtifact.raw_evidence.evidence.length >= 20);
  assert.ok(richArtifact.personality_dna.topology.length >= 4);
  assert.ok(richArtifact.personality_dna.attributes.length >= 4);
  assert.ok(richArtifact.personality_dna.causal_dynamics.length >= 5);
  assert.ok(richArtifact.personality_dna.private_calculations.length >= 4);
  assert.ok(richArtifact.personality_dna.compensation.length >= 3);
  assert.ok(richArtifact.personality_dna.evidence_certainty.contradictions.length >= 2);
  assert.ok(richArtifact.personality_dna.evidence_certainty.abstentions.length >= 4);
});

test('all fifteen rich renderings preserve evidence-bound semantic depth', () => {
  assert.equal(richArtifact.surface_packets.length, 15);
  richArtifact.surface_packets.forEach((packet) => {
    assert.equal(packet.rendering.depth_contract, 'rich_surface_v1');
    assert.ok(packet.rendering.evidence_refs.length > 0);
    assert.ok(packet.rendering.summary.length > 80);
  });
});

test('Five Futures retain mechanism, movers, horizon, falsifier and review trigger', () => {
  const futures = richArtifact.surface_packets.find(({ surface_id: id }) => id === 'five_futures').rendering.futures;
  assert.equal(futures.length, 5);
  futures.forEach((future) => ['condition', 'mechanism', 'trajectory', 'movers', 'horizon', 'falsifier', 'review_trigger']
    .forEach((field) => assert.ok(future[field], `${future.label}:${field}`)));
});

test('One Move remains mechanism-bound, reversible, observable and falsifiable', () => {
  const move = richArtifact.surface_packets.find(({ surface_id: id }) => id === 'one_move').rendering;
  ['target_mechanism', 'intervention', 'strength_preserved', 'reversibility', 'observable_result', 'falsifier', 'stop_adjust_condition']
    .forEach((field) => assert.ok(move[field], field));
  assert.ok(move.alternatives_considered.length >= 2);
});

test('role and energy boundaries remain explicit', () => {
  assert.equal(richArtifact.personality_dna.specialized_intelligence.role_seat.selected_fit, 'NATURAL_FIT');
  assert.equal(richArtifact.personality_dna.specialized_intelligence.energy.trajectory.status, 'INSUFFICIENT_EVIDENCE');
  const lantern = artifacts.find(({ subject_token: token }) => token === 'SYNTH-PDNV1-LANTERN');
  assert.equal(lantern.personality_dna.specialized_intelligence.role.fit, 'INSUFFICIENT_EVIDENCE');
  assert.match(lantern.surface_packets.find(({ surface_id: id }) => id === 'role_seat').rendering.headline, /Insufficient Evidence/);
});

test('truth validator leaves future wording free while rejecting protected-trait causation and missing evidence', () => {
  const packet = richArtifact.surface_packets.find(({ surface_id: id }) => id === 'this_is_you');
  const base = { ...packet.rendering, depth_contract: undefined };
  assert.doesNotThrow(() => validateSurfaceRendering({ surfaceId: packet.surface_id, rendering: { ...base, headline: 'You will always win.' }, localTruth: packet.resolved_local_truth, subjectToken: richArtifact.subject_token }));
  assert.throws(() => validateSurfaceRendering({ surfaceId: packet.surface_id, rendering: { ...base, headline: 'Because of your religion, this pattern is fixed.' }, localTruth: packet.resolved_local_truth, subjectToken: richArtifact.subject_token }), /prohibited-claim/);
  assert.throws(() => validateSurfaceRendering({ surfaceId: packet.surface_id, rendering: { ...packet.rendering, evidence_refs: ['missing-evidence'] }, localTruth: packet.resolved_local_truth, subjectToken: richArtifact.subject_token }), /missing evidence/);
});

test('production-shaped realizer receives only sanitized whole-human and local truth', async () => {
  const fixture = SYNTHETIC_FIXTURES.find(({ fixture_id: id }) => id === 'mosaic');
  let calls = 0;
  const result = await runPersonalityDnaProductionContract({
    activation: 'synthetic_lab',
    rawEvidence: fixture.rawEvidence,
    providerModel: 'synthetic-no-provider',
    libraryRetriever: { retrieve: async (selection) => ({ manifest_sha256: selection.manifest_sha256, authorities: selection.authorities }) },
    reasoningProvider: { infer: async () => fixture.interpretationDraft },
    surfaceRealizer: {
      realize: async (payload) => {
        calls += 1;
        assert.equal(payload.personality_dna, undefined);
        assert.equal(payload.resolved_local_truth, undefined);
        assert.equal(payload.local_surface_packet, undefined);
        assert.equal(payload.human_realization_input.person.display_name, fixture.rawEvidence.identity_context.display_name);
        assert.ok(Array.isArray(payload.human_realization_input.local_truth.insights));
        assert.doesNotMatch(JSON.stringify(payload.human_realization_input), /evidence_refs|subject_token|claim_id/);
        const boundary = ['how_people_experience_you', 'five_futures', 'role_seat', 'personal_operating_energy']
          .includes(payload.surface_id) ? ' This may depend on context, and we do not yet know every boundary.' : '';
        return { customer_prose: `This part of the map connects the whole person to ${payload.human_realization_input.surface.name}.${boundary}` };
      },
    },
  });
  assert.equal(calls, 15);
  assert.equal(result.surface_packets.length, 15);
  assert.ok(result.surface_packets.every(({ human_realization: realization }) => realization?.customer_prose));
  assert.equal(result.safety.provider_called, true);
});
