import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PATRICIA_ANSWER_SHA256,
  PATRICIA_ASSESSMENT_ID,
  PATRICIA_PROFILE_ID,
  resolveBundledBosAuthority,
} from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { createFrozenCanaryRealizationGenerator } from '../api/engine/newBaProductionReadinessV1/canaryRealizationFactory.js';
import { classifyCompatiblePriorRealization } from '../api/engine/newBaProductionReadinessV1/compatibilitySelection.js';
import { validateBosFusionAuthority } from '../api/engine/newBaProductionReadinessV1/fusionContract.js';
import { buildLaunchSafeNewBaEnvelope } from '../api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { createNewBaModernizationService } from '../api/engine/newBaProductionReadinessV1/modernizationService.js';
import { buildNewBaRealizationIdentity } from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import { sha256Stable } from '../api/engine/newBaProductionReadinessV1/stable.js';
import { buildLegacyRealEstateVerticalBinding } from '../api/business-assessment/verticalBinding.js';

function identity(overrides = {}) {
  const components = {
    profile_id: 'MM-20260708-DSST020Z',
    assessment_id: 'ba-20260714-64ca0783',
    canonical_business_evidence_sha256: '1'.repeat(64),
    bos_authority_sha256: '2'.repeat(64),
    bos_fusion_contract_sha256: '3'.repeat(64),
    bos_evidence_boundary_sha256: '4'.repeat(64),
    bos_ba_fusion_policy_version: 'business-cause-from-business-evidence_execution-modifiers-from-bos_v1',
    ba_intelligence_version: 'wbm-v1_five-futures-v2_one-move-v2_plan-135-v1',
    universal_authority_manifest_sha256: '5'.repeat(64),
    cassette_version: 'real-estate-cassette-v1',
    projection_version: 'ba-progressive-disclosure-v1',
    real_profile_projection_adapter_version: 'real-profile-governed-metric-evidence-projection-v5',
    projection_sha256: '6'.repeat(64),
    ui_version: 'real-estate-ba-v1-final-convergence',
    ui_sha256: '7'.repeat(64),
    provider_model: 'gpt-5.6-sol',
    provider_policy_version: 'gpt-5.6-sol-store-false-strict-v1',
    compatibility_class: 'A',
    ...overrides,
  };
  const sha256 = sha256Stable(components);
  return {
    version: 'new_ba_composite_realization_identity_v2',
    realization_id: `new-ba:${components.profile_id}:${components.assessment_id}:${sha256}`,
    sha256,
    components,
  };
}

function currentEnvelope(overrides = {}) {
  return {
    realization_identity: identity(),
    completeness: { status: 'PASS' },
    artifact: {
      business_reality: { frozen_whole_person_authority: { bos_hash: '2'.repeat(64) } },
      fusion: { proof_sha256: '8'.repeat(64), bos_authority: { artifact_sha256: '2'.repeat(64) } },
    },
    ...overrides,
  };
}

test('complete prior BA remains serveable when only BOS snapshot and presentation versions advance', () => {
  const desired = identity({
    bos_authority_sha256: '9'.repeat(64),
    bos_fusion_contract_sha256: 'a'.repeat(64),
    bos_evidence_boundary_sha256: 'b'.repeat(64),
    real_profile_projection_adapter_version: 'real-profile-governed-metric-evidence-projection-v6',
    projection_sha256: 'c'.repeat(64),
    ui_sha256: 'd'.repeat(64),
  });
  const result = classifyCompatiblePriorRealization({ current: currentEnvelope(), desiredIdentity: desired });
  assert.equal(result.serveable, true);
  assert.equal(result.reason, 'immutable_prior_remains_compatible');
  assert.equal(result.uses_recorded_bos_fusion_snapshot, true);
  assert.deepEqual(result.drift_fields, [
    'bos_authority_sha256',
    'bos_evidence_boundary_sha256',
    'bos_fusion_contract_sha256',
    'projection_sha256',
    'real_profile_projection_adapter_version',
    'ui_sha256',
  ]);
});

test('compatible-prior selection fails closed for evidence, assessment, intelligence, model, or cassette drift', () => {
  for (const [field, value] of [
    ['canonical_business_evidence_sha256', '9'.repeat(64)],
    ['assessment_id', 'ba-20260714-drift'],
    ['ba_intelligence_version', 'wbm-v2'],
    ['universal_authority_manifest_sha256', '9'.repeat(64)],
    ['provider_model', 'substitute-model'],
    ['cassette_version', 'different-cassette'],
  ]) {
    const result = classifyCompatiblePriorRealization({ current: currentEnvelope(), desiredIdentity: identity({ [field]: value }) });
    assert.equal(result.serveable, false, field);
    assert.equal(result.reason, 'canonical_authority_drift', field);
    assert.deepEqual(result.prohibited_drift_fields, [field], field);
  }
});

test('compatible-prior selection requires a complete artifact and internally matched recorded BOS fusion', () => {
  const desired = identity({ bos_authority_sha256: '9'.repeat(64) });
  assert.equal(classifyCompatiblePriorRealization({ current: currentEnvelope({ completeness: { status: 'FAIL' } }), desiredIdentity: desired }).serveable, false);
  assert.equal(classifyCompatiblePriorRealization({
    current: currentEnvelope({ artifact: { business_reality: { frozen_whole_person_authority: { bos_hash: '2'.repeat(64) } }, fusion: { proof_sha256: '8'.repeat(64), bos_authority: { artifact_sha256: '3'.repeat(64) } } } }),
    desiredIdentity: desired,
  }).reason, 'recorded_bos_fusion_snapshot_invalid');
  assert.equal(classifyCompatiblePriorRealization({
    current: currentEnvelope({ realization_identity: { ...identity(), sha256: 'f'.repeat(64) } }),
    desiredIdentity: desired,
  }).reason, 'identity_digest_invalid');
});

test('ordinary New BA route keeps generalized generation while packaging frozen authorities', () => {
  const route = fs.readFileSync('api/moremindmap/new-ba.js', 'utf8');
  assert.match(route, /campaign\.advance\(source\.profile_id\)/u);
  const deployment = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const includeFiles = deployment.functions['api/moremindmap/new-ba.js'].includeFiles;
  assert.equal(includeFiles, 'docs/ba-intelligence-authority-library-v1/**');
  assert.match(fs.readFileSync('api/engine/newBaProductionReadinessV1/canonicalReader.js', 'utf8'), /pinnedAuthority\//u);
  const deploymentIgnore = fs.readFileSync('.vercelignore', 'utf8');
  assert.doesNotMatch(deploymentIgnore, /^docs\/\*\*$/mu);
  assert.ok(deploymentIgnore.lastIndexOf('!docs/ba-intelligence-authority-library-v1/**') > deploymentIgnore.lastIndexOf('*.md'));
  assert.ok(deploymentIgnore.lastIndexOf('!docs/ba-intelligence-authority-library-v1/**') > deploymentIgnore.lastIndexOf('*.txt'));
});

test('retrieval serves an internally fused compatible prior without provider execution or publication', async () => {
  const answers = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`q${index + 1}`, `governed answer ${index + 1}`]));
  const businessEvidence = {
    profile_id: PATRICIA_PROFILE_ID,
    assessment_id: PATRICIA_ASSESSMENT_ID,
    answers,
    answer_sha256: { ...PATRICIA_ANSWER_SHA256 },
    evidence_sha256: '1'.repeat(64),
    evidence_sufficiency: { status: 'PASS', unanswered_questions: [], reasons: [] },
    created_at: '2026-07-14T16:26:52.501Z',
    read_only: true,
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_agent',
    vertical_binding: buildLegacyRealEstateVerticalBinding({
      version: 'business_assessment_v1_intake',
      assessment_type: 'real_estate_agent',
    }),
  };
  const recordedBos = resolveBundledBosAuthority(PATRICIA_PROFILE_ID);
  const source = {
    profile_id: PATRICIA_PROFILE_ID,
    assessment_id: PATRICIA_ASSESSMENT_ID,
    source_kind: 'SAVED_BUSINESS_ASSESSMENT',
    business_evidence: businessEvidence,
    bos_authority: recordedBos,
  };
  const generated = await createFrozenCanaryRealizationGenerator().generate({ source });
  const recordedIdentity = buildNewBaRealizationIdentity({
    profileId: PATRICIA_PROFILE_ID,
    assessmentId: PATRICIA_ASSESSMENT_ID,
    evidenceSha256: businessEvidence.evidence_sha256,
    bosAuthoritySha256: recordedBos.sha256,
    bosFusionContractSha256: recordedBos.fusion_contract_sha256,
    bosEvidenceBoundarySha256: recordedBos.evidence_boundary_sha256,
    compatibilityClass: 'A',
  });
  const current = buildLaunchSafeNewBaEnvelope({
    profileId: PATRICIA_PROFILE_ID,
    realizationIdentity: recordedIdentity,
    artifact: generated.artifact,
    compatibility: { class: 'A', label: 'FULLY_COMPATIBLE' },
    providerAccounting: generated.provider_accounting,
  });

  const nextFusion = validateBosFusionAuthority({
    ...recordedBos.fusion_authority,
    source_realization_id: 'new-bos:test-current',
    source_artifact_sha256: '9'.repeat(64),
  }, { profileId: PATRICIA_PROFILE_ID });
  const desiredSource = {
    ...source,
    bos_authority: {
      ...recordedBos,
      realization_id: nextFusion.source_realization_id,
      sha256: nextFusion.source_artifact_sha256,
      fusion_authority: nextFusion,
      fusion_contract_sha256: nextFusion.contract_sha256,
      evidence_boundary_sha256: nextFusion.evidence_boundary_sha256,
    },
  };
  let providerCalls = 0;
  let publicationCalls = 0;
  const service = createNewBaModernizationService({
    config: {
      staged: true,
      customerActive: true,
      fusionValidated: true,
      canaryEnabled: false,
      providerEnabled: true,
      persistenceEnabled: true,
      allowedProfileIds: [],
      namespace: 'nonprod:new-ba:test',
      providerModel: 'gpt-5.6-sol',
    },
    authorityReader: { read: async () => desiredSource },
    realizationStore: {
      inspect: async () => ({ state: 'stale', current, pointer: current.realization_id }),
      persistImmutable: async () => { publicationCalls += 1; },
      advancePointer: async () => { publicationCalls += 1; },
    },
    singleFlight: { run: async () => { throw new Error('single_flight_must_not_run'); } },
    generator: { advance: async () => { providerCalls += 1; throw new Error('provider_must_not_run'); } },
  });
  const result = await service.retrieve({ profileId: PATRICIA_PROFILE_ID });
  assert.equal(result.receipt.path, 'compatible_prior_fast_path');
  assert.equal(result.receipt.realization_id, current.realization_id);
  assert.equal(result.receipt.completeness, 'PASS');
  assert.equal(providerCalls, 0);
  assert.equal(publicationCalls, 0);
});
