import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthorizedSyntheticTopSource } from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { createFrozenCanaryRealizationGenerator } from '../api/engine/newBaProductionReadinessV1/canaryRealizationFactory.js';
import {
  NEW_BA_COMPLETENESS_STATUS,
  validateCompleteNewBaRealization,
} from '../api/engine/newBaProductionReadinessV1/completeness.js';
import {
  buildLaunchSafeNewBaEnvelope,
  createMemoryNewBaRealizationStore,
  validateLaunchSafeNewBaEnvelope,
} from '../api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { buildNewBaRealizationIdentity } from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';

const LO_AUTHORITY_REF = 'loan-originator-intelligence-module-offline-open-plan-test-v1';

async function frozenRealEstateArtifact() {
  const source = createAuthorizedSyntheticTopSource();
  const generated = await createFrozenCanaryRealizationGenerator().generate({ source });
  return { source, artifact: generated.artifact };
}

// This fixture changes only the fields needed to exercise the shared open-plan
// contract. It is not a generated Loan Originator realization or acceptance
// evidence for the provider/runtime campaign.
function openPlanContractFixture(baseArtifact) {
  const artifact = structuredClone(baseArtifact);
  const plan = artifact.plan_135;
  artifact.cassette_binding = { ...(artifact.cassette_binding || {}), vertical_id: 'loan_originator' };
  artifact.business_reality = {
    ...artifact.business_reality,
    assessment_identity: { ...(artifact.business_reality.assessment_identity || {}), vertical: 'loan_originator' },
    source_integrity: {
      ...(artifact.business_reality.source_integrity || {}),
      authority_hashes: { [LO_AUTHORITY_REF]: 'a'.repeat(64) },
    },
  };
  artifact.lineage = { ...artifact.lineage, vertical_id: 'loan_originator' };
  artifact.customer_view_model = {
    ...artifact.customer_view_model,
    vertical: { ...(artifact.customer_view_model.vertical || {}), vertical_id: 'loan_originator' },
  };
  artifact.plan_135 = {
    ...plan,
    plan_state: 'LO_OPEN_DRAFT',
    bindings: {
      ...plan.bindings,
      verticalId: 'loan_originator',
      verticalAuthorityRefs: [LO_AUTHORITY_REF],
    },
    ways: [1, 2, 3].map((position) => ({
      way_id: `way-${position}`,
      status: 'OPEN',
      title: null,
      destination_state: null,
      strategies: [],
      open_strategy_positions: 5,
    })),
    strategies: [],
    open_strategy_positions: 15,
    one_move: {
      ...plan.one_move,
      status: 'ALONGSIDE_PLAN_NOT_A_STRATEGY',
      proposal_status: 'PROPOSED_NOT_CUSTOMER_AGREED',
      first_action: { text: 'Discuss the proposed experiment.', source_ref: plan.one_move.source_ref },
      proof: [{ text: 'Observe bounded evidence.', source_ref: plan.one_move.source_ref }],
      failure_or_stop: ['Stop if the boundary fails.'],
    },
    customer_boundary: {
      ...plan.customer_boundary,
      proposed_plan_not_customer_commitment: true,
      customer_agreed: false,
      all_ways_intentionally_open: true,
    },
    validation: {
      ...plan.validation,
      selected_way_count: 0,
      strategy_count: 0,
      open_strategy_positions: 15,
    },
  };
  return artifact;
}

function identityFor(source) {
  return buildNewBaRealizationIdentity({
    profileId: source.profile_id,
    assessmentId: source.assessment_id,
    evidenceSha256: source.business_evidence.evidence_sha256,
    bosAuthoritySha256: source.bos_authority.sha256,
    bosFusionContractSha256: source.bos_authority.fusion_contract_sha256,
    bosEvidenceBoundarySha256: source.bos_authority.evidence_boundary_sha256,
    compatibilityClass: 'A',
  });
}

test('LO open-plan analysis is explicit and cannot report generic complete PASS', async () => {
  const { artifact: realEstateArtifact } = await frozenRealEstateArtifact();
  assert.equal(validateCompleteNewBaRealization(realEstateArtifact).status, NEW_BA_COMPLETENESS_STATUS.COMPLETE);

  const validation = validateCompleteNewBaRealization(openPlanContractFixture(realEstateArtifact));
  assert.equal(validation.status, NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN);
  assert.notEqual(validation.status, NEW_BA_COMPLETENESS_STATUS.COMPLETE);
  assert.equal(validation.plan_state, 'LO_OPEN_DRAFT');
  assert.equal(validation.plan_strategy_count, 0);
  assert.equal(validation.plan_customer_commitment, false);
  assert.equal(validation.customer_plan_status, 'OPEN_NOT_CUSTOMER_AGREED');
  assert.equal(validation.customer_plan_complete, false);
  assert.equal(validation.storage_eligible, true);
});

test('non-LO realizations reject every LO open-plan marker before launch-safe storage', async () => {
  const { source, artifact: realEstateArtifact } = await frozenRealEstateArtifact();
  const mutations = [
    ['plan state', (artifact) => { artifact.plan_135.plan_state = 'LO_OPEN_DRAFT'; }],
    ['vertical binding', (artifact) => { artifact.plan_135.bindings.verticalId = 'loan_originator'; }],
    ['vertical authority', (artifact) => {
      artifact.plan_135.bindings.verticalAuthorityRefs = [LO_AUTHORITY_REF];
    }],
  ];

  for (const [name, mutate] of mutations) {
    const artifact = structuredClone(realEstateArtifact);
    mutate(artifact);
    assert.throws(
      () => validateCompleteNewBaRealization(artifact),
      /new_ba_realization_lo_open_plan_scope_invalid/u,
      name,
    );
    assert.throws(
      () => buildLaunchSafeNewBaEnvelope({
        profileId: source.profile_id,
        realizationIdentity: identityFor(source),
        artifact,
        compatibility: { class: 'A', label: 'FULLY_COMPATIBLE' },
        providerAccounting: { store: false, calls: 0 },
      }),
      /new_ba_realization_lo_open_plan_scope_invalid/u,
      name,
    );
  }

  const values = new Map();
  createMemoryNewBaRealizationStore({ namespace: 'nonprod:new-ba:cross-vertical-open-plan-test', values });
  assert.equal(values.size, 0);
});

test('launch-safe store preserves the open-plan receipt and rejects completeness inflation', async () => {
  const { source, artifact: realEstateArtifact } = await frozenRealEstateArtifact();
  const artifact = openPlanContractFixture(realEstateArtifact);
  const envelope = buildLaunchSafeNewBaEnvelope({
    profileId: source.profile_id,
    realizationIdentity: identityFor(source),
    artifact,
    compatibility: { class: 'A', label: 'FULLY_COMPATIBLE' },
    providerAccounting: { store: false, calls: 0 },
  });
  assert.equal(envelope.completeness.status, NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN);

  const store = createMemoryNewBaRealizationStore({ namespace: 'nonprod:new-ba:open-plan-status-test' });
  await store.persistImmutable(envelope);
  await store.advancePointer({
    profileId: source.profile_id,
    expectedCurrentId: null,
    nextRealizationId: envelope.realization_id,
  });
  const stored = await store.getCurrent({ profileId: source.profile_id });
  assert.equal(stored.completeness.status, NEW_BA_COMPLETENESS_STATUS.VALID_ANALYSIS_WITH_OPEN_PLAN);
  assert.equal(stored.completeness.customer_plan_complete, false);

  const inflated = structuredClone(envelope);
  inflated.completeness.status = NEW_BA_COMPLETENESS_STATUS.COMPLETE;
  inflated.completeness.plan_customer_commitment = true;
  inflated.completeness.customer_plan_complete = true;
  assert.throws(
    () => validateLaunchSafeNewBaEnvelope(inflated, { profileId: source.profile_id }),
    /new_ba_store_completeness_receipt_mismatch/u,
  );
});
