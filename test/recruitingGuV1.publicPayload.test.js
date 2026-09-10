import test from 'node:test';
import assert from 'node:assert/strict';

import {
  containsInternalRecruitingGuAssignment,
  publicRecruitingGuPayload,
} from '../src/lib/recruitingGuV1/publicPayload.js';

test('browser projection removes nested provider and model assignments without mutating server custody', () => {
  const internal = {
    session: {
      model_output_is_canonical: false,
      events: [{ metadata: { provider: 'hidden-assignment', plan_version: 2 } }],
      current_projection: {
        plan: { guidance: { summary: 'The manager mentioned OpenAI as ordinary conversation text.' } },
        receipt: {
          totalLatencyMs: 120,
          provider: { modelReturned: 'hidden-model', gateway: 'hidden-gateway' },
          requestedProvider: 'hidden-provider',
        },
      },
      current_coach_move: { condition: 'hidden-arm', move: { text: 'safe' } },
      authored_surfaces: {
        ba: {
          business_model: { value_creation: 'Synthetic advisory work' },
          future: { condition: 'Ten governed conversations', model: 'relationship flywheel' },
        },
        bos: {
          surface_packets: [{
            human_realization: {
              generation: {
                requested_model: 'hidden-requested-model',
                returned_model: 'hidden-returned-model',
                model: 'hidden-model',
                copy: 'Authored product prose remains visible.',
              },
            },
          }],
        },
        receipts: { bos: { complete_surface_count: 15 } },
      },
      agreement_delivery: {
        results: [{ state: 'DELIVERED', provider_receipt: 'hidden-receipt' }],
      },
    },
    experiment_condition: 'hidden-arm',
    coach_move_id: 'coach_move_public',
    provider_receipt: { modelConfig: { model: 'hidden-model' } },
    latency: { total_ms: 240, provider_ms: 120 },
  };

  assert.equal(containsInternalRecruitingGuAssignment(internal), true);
  const projected = publicRecruitingGuPayload(internal);
  assert.equal(containsInternalRecruitingGuAssignment(projected), false);
  assert.equal(projected.session.current_projection.receipt.totalLatencyMs, 120);
  assert.equal(projected.session.events[0].metadata.plan_version, 2);
  assert.equal(projected.session.authored_surfaces.ba.business_model.value_creation, 'Synthetic advisory work');
  assert.equal(projected.session.authored_surfaces.ba.future.condition, 'Ten governed conversations');
  assert.equal(projected.session.authored_surfaces.ba.future.model, 'relationship flywheel');
  assert.equal(projected.session.authored_surfaces.bos.surface_packets[0].human_realization.generation.requested_model, undefined);
  assert.equal(projected.session.authored_surfaces.bos.surface_packets[0].human_realization.generation.returned_model, undefined);
  assert.equal(projected.session.authored_surfaces.bos.surface_packets[0].human_realization.generation.model, undefined);
  assert.equal(projected.session.authored_surfaces.bos.surface_packets[0].human_realization.generation.copy, 'Authored product prose remains visible.');
  assert.equal(projected.session.agreement_delivery.results[0].state, 'DELIVERED');
  assert.equal(projected.session.agreement_delivery.results[0].provider_receipt, undefined);
  assert.equal(projected.session.current_coach_move.condition, undefined);
  assert.equal(projected.experiment_condition, undefined);
  assert.equal(projected.projection_deferred, true);
  assert.equal(projected.latency.total_ms, 240);
  assert.equal(projected.latency.provider_ms, undefined);
  assert.match(projected.session.current_projection.plan.guidance.summary, /OpenAI/u);
  assert.equal(internal.session.events[0].metadata.provider, 'hidden-assignment');
});

test('browser projection fails closed on unreasonable object depth', () => {
  let value = {};
  for (let index = 0; index < 70; index += 1) value = { child: value };
  assert.throws(() => publicRecruitingGuPayload(value), /PUBLIC_PAYLOAD_BOUND_EXCEEDED/u);
});
