import assert from 'node:assert/strict';
import test from 'node:test';

import { __testNewBosCheckpointValueValid as valid } from '../api/internal/release5-canary-controller.js';
import { stableHash } from '../src/lib/recruitingV1/contracts.js';

const namespace = 'preview:new-bos:release5-two-box-20260909';
const campaign = 'a'.repeat(64);
const unitIdentity = 'b'.repeat(64);
const request = 'c'.repeat(64);
const accepted = 'd'.repeat(64);
const priorHash = 'e'.repeat(64);
const archiveHash = 'f'.repeat(64);
const observedAt = '2026-09-10T12:00:00.000Z';

function key(unit, suffix = '') {
  return `${namespace}:resumable-v1:${campaign}:unit:${unit}${suffix ? `:${suffix}` : ''}`;
}

test('Release 5 inspector accepts the exact nested semantic-rejection archive writer shape', () => {
  const prior = {
    version: 'new_bos_resumable_unit_checkpoint_v1',
    campaign_sha256: campaign,
    unit_id: 'semantic:whole_person_decision_synthesis',
    unit_identity_sha256: unitIdentity,
    request_sha256: request,
    state: 'SEMANTIC_REJECTED',
    attempt: 2,
    observation: { status: 'completed' },
    semantic_rejection_code: 'VECTOR_FREE_ASSESSMENT_LANGUAGE_REJECTION',
    semantic_validator: 'assertVectorFreeWholePerson',
    semantic_rejection_detail: 'ADAPTABILITY_LANGUAGE',
    semantic_validation_code_sha256: archiveHash,
  };
  const value = {
    version: 'new_bos_resumable_semantic_rejection_archive_v1',
    campaign_sha256: campaign,
    unit_id: prior.unit_id,
    prior_checkpoint_sha256: stableHash(prior),
    prior_checkpoint: prior,
    prior_attempt: 2,
    semantic_rejection_code: prior.semantic_rejection_code,
    semantic_validator: prior.semantic_validator,
    semantic_rejection_detail: prior.semantic_rejection_detail,
    semantic_validation_code_sha256: prior.semantic_validation_code_sha256,
    retired_at: observedAt,
    replacement_authorized: true,
  };
  assert.equal(valid(key(prior.unit_id, 'semantic-rejection-archive-v1:attempt:2'), value), true);
  assert.equal(valid(key(prior.unit_id, 'semantic-rejection-archive-v1:attempt:2'), {
    ...value, prior_checkpoint_sha256: priorHash,
  }), false);
});

test('Release 5 inspector accepts exact stage-3 and stage-4 invalid archive variants', () => {
  const stage3 = {
    version: 'new_bos_resumable_invalid_semantic_archive_v1',
    campaign_sha256: campaign,
    unit_id: 'semantic:whole_person_decision_synthesis',
    prior_checkpoint_sha256: priorHash,
    prior_attempt: 1,
    unit_identity_sha256: unitIdentity,
    request_sha256: request,
    accepted_value_sha256: accepted,
    failure_code: 'Whole-person model leaked assessment language: assessment',
    retired_at: observedAt,
    replacement_authorized: true,
  };
  const stage4 = {
    version: 'new_bos_resumable_invalid_dependency_archive_v1',
    campaign_sha256: campaign,
    unit_id: 'semantic:surface_routing',
    prior_checkpoint_sha256: priorHash,
    prior_attempt: 1,
    unit_identity_sha256: unitIdentity,
    request_sha256: request,
    accepted_value_sha256: accepted,
    invalidated_by_unit: 'semantic:whole_person_decision_synthesis',
    invalidated_by_accepted_value_sha256: accepted,
    retired_at: observedAt,
    replacement_authorized: true,
  };
  assert.equal(valid(key(stage3.unit_id, 'invalid-semantic-archive-v1'), stage3), true);
  assert.equal(valid(key(stage4.unit_id, 'invalid-semantic-archive-v1'), stage4), true);
  assert.equal(valid(key(stage4.unit_id, 'invalid-semantic-archive-v1'), {
    ...stage4, invalidated_by_unit: 'semantic:operating_domains',
  }), false);
});

test('Release 5 inspector accepts the exact dependency-invalidation root without invented hashes', () => {
  const value = {
    version: 'new_bos_resumable_dependency_invalidation_v1',
    campaign_sha256: campaign,
    unit_id: 'semantic:surface_routing',
    prior_attempt: 1,
    next_attempt: 2,
    state: 'DEPENDENCY_INVALIDATED',
    invalidated_by_unit: 'semantic:whole_person_decision_synthesis',
    replacement_reason: 'stage3_vector_free_contract_violation',
    invalid_semantic_archive_sha256: archiveHash,
    invalidated_by_archive_sha256: priorHash,
    invalidated_at: observedAt,
  };
  assert.equal(valid(key(value.unit_id), value), true);
  assert.equal(valid(key(value.unit_id), { ...value, next_attempt: 3 }), false);
});
