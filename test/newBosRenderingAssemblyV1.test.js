import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  SURFACES,
  SYNTHETIC_FIXTURES,
  assembleRealizedSurfaceRendering,
  auditHumanRealization,
  buildPersonalityDnaRuntime,
  createHumanRealization,
  customerProseSha256,
  validateBrowserRenderableCandidate,
} from '../src/lib/newBosPersonalityDnaV1/index.js';

const fixture = SYNTHETIC_FIXTURES.find(({ fixture_id: id }) => id === 'mosaic');
const artifact = buildPersonalityDnaRuntime(fixture);

function proseFor(packet) {
  return `You will succeed if every supported condition for ${packet.label} holds. This intentionally ordinary future wording is not a structural rendering concern.\n\nThe second paragraph remains provider-owned communication.`;
}

function completeCandidate() {
  const surfacePackets = artifact.surface_packets.map((packet) => {
    const humanRealization = createHumanRealization({
      surfaceId: packet.surface_id,
      customerProse: proseFor(packet),
      localSurfacePacket: packet,
    });
    return {
      ...packet,
      human_realization: humanRealization,
      human_realization_audit: auditHumanRealization({
        surfaceId: packet.surface_id,
        realization: humanRealization,
        localTruth: packet.resolved_local_truth,
      }),
      rendering: assembleRealizedSurfaceRendering({
        packet,
        humanRealization,
        profileId: artifact.profile_id,
        subjectToken: artifact.subject_token,
      }),
    };
  });
  return { ...artifact, surface_packets: surfacePackets };
}

function mutableCandidate() {
  return structuredClone(completeCandidate());
}

test('portable prose digest matches canonical SHA-256', () => {
  ['', 'abc', 'whole-person realization 🚀'].forEach((value) => assert.equal(
    customerProseSha256(value),
    crypto.createHash('sha256').update(value).digest('hex'),
  ));
});

test('complete deterministic assembly is browser-renderable across all fifteen surfaces', () => {
  const candidate = completeCandidate();
  assert.equal(validateBrowserRenderableCandidate(candidate), candidate);
  assert.equal(candidate.surface_packets.length, SURFACES.length);
  candidate.surface_packets.forEach((packet) => {
    assert.equal(packet.rendering.depth_contract, 'rich_surface_v1');
    assert.ok(packet.human_realization.customer_prose.includes(packet.rendering.headline));
    assert.ok(packet.human_realization.customer_prose.includes(packet.rendering.summary));
    assert.equal(
      packet.rendering.assembly_identity.customer_prose_sha256,
      crypto.createHash('sha256').update(packet.human_realization.customer_prose).digest('hex'),
    );
  });
});

test('structural gate does not police ordinary realized prose form', () => {
  const candidate = completeCandidate();
  assert.match(candidate.surface_packets[0].human_realization.customer_prose, /You will succeed/u);
  assert.doesNotThrow(() => validateBrowserRenderableCandidate(candidate));
});

test('null rendering fails closed before freeze', () => {
  const candidate = mutableCandidate();
  candidate.surface_packets[0].rendering = null;
  assert.throws(() => validateBrowserRenderableCandidate(candidate), /requires a browser rendering object/u);
});

test('missing required renderer field and malformed nested array fail closed', () => {
  const missing = mutableCandidate();
  delete missing.surface_packets.find(({ surface_id: id }) => id === 'this_is_you').rendering.recognizable_moments;
  assert.throws(() => validateBrowserRenderableCandidate(missing), /recognizable_moments/u);

  const malformed = mutableCandidate();
  malformed.surface_packets.find(({ surface_id: id }) => id === 'how_you_operate').rendering.mechanisms = null;
  assert.throws(() => validateBrowserRenderableCandidate(malformed), /how_you_operate\.mechanisms/u);
});

test('surface, profile, subject and prose association mismatches fail closed', () => {
  const surfaceMismatch = mutableCandidate();
  surfaceMismatch.surface_packets[0].rendering.assembly_identity.surface_id = 'personality_dna';
  assert.throws(() => validateBrowserRenderableCandidate(surfaceMismatch), /rendering assembly identity mismatch/u);

  const profileMismatch = mutableCandidate();
  profileMismatch.surface_packets[0].rendering.assembly_identity.profile_id = 'MM-TEST-PROFILE';
  assert.throws(() => validateBrowserRenderableCandidate(profileMismatch), /rendering profile identity mismatch/u);

  const subjectMismatch = mutableCandidate();
  subjectMismatch.surface_packets[0].rendering.assembly_identity.subject_token = 'SYNTH-PDNV1-OTHER';
  assert.throws(() => validateBrowserRenderableCandidate(subjectMismatch), /rendering subject identity mismatch/u);

  const proseMismatch = mutableCandidate();
  proseMismatch.surface_packets[0].rendering.assembly_identity.customer_prose_sha256 = '0'.repeat(64);
  assert.throws(() => validateBrowserRenderableCandidate(proseMismatch), /realized-prose digest mismatch/u);
});

test('missing, duplicate and unknown canonical surfaces fail closed', () => {
  const missing = mutableCandidate();
  missing.surface_packets.pop();
  assert.throws(() => validateBrowserRenderableCandidate(missing), /exactly 15 surfaces/u);

  const duplicate = mutableCandidate();
  duplicate.surface_packets[14] = structuredClone(duplicate.surface_packets[0]);
  assert.throws(() => validateBrowserRenderableCandidate(duplicate), /duplicate surface/u);

  const unknown = mutableCandidate();
  unknown.surface_packets[14].surface_id = 'unknown_surface';
  assert.throws(() => validateBrowserRenderableCandidate(unknown), /unknown surface/u);
});

test('Five Futures remain five governed conditional trajectories', () => {
  const candidate = completeCandidate();
  const packet = candidate.surface_packets.find(({ surface_id: id }) => id === 'five_futures');
  const sourceItems = packet.resolved_local_truth.specialist_truth.five_futures.items;
  assert.equal(packet.rendering.futures.length, 5);
  packet.rendering.futures.forEach((future, index) => {
    assert.equal(future.condition, sourceItems[index].condition);
    assert.equal(future.mechanism, sourceItems[index].mechanism);
    assert.equal(future.trajectory, sourceItems[index].trajectory);
    assert.equal(future.label, sourceItems[index].future_identity);
  });

  const malformed = mutableCandidate();
  malformed.surface_packets.find(({ surface_id: id }) => id === 'five_futures').rendering.futures[0].condition = '';
  assert.throws(() => validateBrowserRenderableCandidate(malformed), /Future 1 requires condition/u);
});

test('deterministic gate rejects structurally valid but non-governed rendering substitution', () => {
  const candidate = mutableCandidate();
  candidate.surface_packets.find(({ surface_id: id }) => id === 'work_dna').rendering.fit_summary = 'A substituted but structurally valid sentence.';
  assert.throws(() => validateBrowserRenderableCandidate(candidate), /does not match deterministic governed assembly/u);
});
