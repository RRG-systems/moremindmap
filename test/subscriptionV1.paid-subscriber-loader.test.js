import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { createCanonicalProfileOwnerReader } from '../src/lib/publicSiteAirlockV1/canonicalProfileOwnerReader.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { createPublicRuntime } from '../src/lib/publicSiteAirlockV1/runtime.js';
import {
  createProfileOwnershipAdapter,
  profileOwnerCookie,
  resolveProfileOwnershipAudience,
} from '../src/lib/publicSiteAirlockV1/profileOwnership.js';
import {
  createProfileStateReader,
  isExactLegacyBusinessAssessmentComplete,
} from '../src/lib/publicSiteAirlockV1/profileStateReader.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';
import { InMemoryLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/store.js';
import { buildLaunchSafeNewBaEnvelope } from '../api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import {
  buildNewBaRealizationIdentity,
  buildNewBaRealizationIdentityV3,
} from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import {
  PATRICIA_ASSESSMENT_ID,
  PATRICIA_PROFILE_ID,
  normalizeGovernedAssessmentRecord,
  resolveBundledBosAuthority,
} from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import {
  NEW_BA_BOS_FUSION_PROOF_CONTRACT,
  projectBosFusionAuthorityFromArtifact,
} from '../api/engine/newBaProductionReadinessV1/fusionContract.js';
import { sha256Stable } from '../api/engine/newBaProductionReadinessV1/stable.js';
import {
  buildCustomerConfirmedVerticalBinding,
  buildLegacyRealEstateVerticalBinding,
} from '../api/business-assessment/verticalBinding.js';
import { buildLaunchSafeRealizationEnvelope as buildLaunchSafeNewBosEnvelope } from '../api/engine/newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { buildNewBosRealizationIdentity } from '../api/engine/newBosProductionReadinessV1/realizationIdentity.js';
import { authenticatePaidRuntimeRequest } from '../api/engine/subscriptionV1/paidRuntimeAuth.js';
import {
  PAID_SUBSCRIBER_REQUIRED_ARTIFACT_TYPES,
  createCurrentRealProfileRealizationReader,
  createPaidSubscriberLoader,
  createRecordedBosRealizationReader,
  projectCompletedRealProfileToSubscription,
} from '../api/engine/subscriptionV1/paidSubscriberLoader.js';
import {
  paidRuntimeRelationshipKey,
  resolvePaidEntitlementFromStore,
} from '../api/engine/subscriptionV1/paidRuntimeInfrastructure.js';
import { createPaidMembershipBinder, PAID_MEMBERSHIP_NAMESPACE } from '../api/stripe/paidMembership.js';
import { createCurrentNewBaMembershipReadinessReader } from '../api/stripe/paidMembershipReadiness.js';
import {
  PRODUCTION_BA_CASSETTE_REGISTRY,
  buildCustomerConfirmedSelection,
} from '../src/lib/baVerticalCassettesV1/index.js';
import {
  SYNTHETIC_FIXTURES,
  assembleRealizedSurfaceRendering,
  auditHumanRealization,
  buildPersonalityDnaRuntime,
  createHumanRealization,
} from '../src/lib/newBosPersonalityDnaV1/index.js';
import { attachCustomerTopProjection } from '../src/lib/newBosPersonalityDnaV1/topProjection.js';

const PROFILE_ID = 'mm-20990101-load0001';
const REALIZATION_PROFILE_ID = PROFILE_ID.toUpperCase();
const ASSESSMENT_ID = 'ba-20990101-acde0001';
const CREATED_AT = '2099-01-02T03:04:05.000Z';
const RUNTIME_AT = '2099-01-03T04:05:06.000Z';
const SESSION_ID = 'session_0123456789abcdef01234567';
const CURRENT_NEW_BA_NAMESPACE = 'nonprod:new-ba:cohort-re-a-preparation-v1';
const CURRENT_NEW_BOS_NAMESPACE = 'nonprod:new-bos:cohort-re-a-preparation-v1';
const digest = (label) => hashCanonicalJson({ label });
const VERTICAL_BINDING_SHA256 = digest('vertical-binding-current-authority');
const BUSINESS_ID = `business_${hashCanonicalJson({
  domain: 'more-paid-subscription-business-v1',
  profile_id: PROFILE_ID,
  assessment_id: ASSESSMENT_ID,
  vertical_binding_sha256: VERTICAL_BINDING_SHA256,
}).slice(0, 40)}`;
const SCOPE = Object.freeze({
  subject_id: 'subject_loader_contract_0001',
  membership_id: 'membership_loader_contract_0001',
  tenant_id: 'tenant_loader_contract_0001',
  profile_id: PROFILE_ID,
  business_id: BUSINESS_ID,
});

const clone = (value) => JSON.parse(JSON.stringify(value));

function completedBosEnvelope({ fixtureId = 'mosaic', profileId = REALIZATION_PROFILE_ID, identitySuffix = '' } = {}) {
  const fixture = SYNTHETIC_FIXTURES.find(({ fixture_id: id }) => id === fixtureId);
  const runtime = buildPersonalityDnaRuntime(fixture);
  const seeded = {
    ...runtime,
    profile_id: profileId,
    raw_evidence: { ...runtime.raw_evidence, profile_id: profileId },
  };
  const surfacePackets = seeded.surface_packets.map((packet) => {
    const customerProse = `The governed meaning for ${packet.label} remains bounded to this fictional fixture and its evidence.\n\nA second paragraph preserves the complete launch-safe rendering contract.`;
    const humanRealization = createHumanRealization({
      surfaceId: packet.surface_id,
      customerProse,
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
        profileId,
        subjectToken: seeded.subject_token,
      }),
    };
  });
  const realizedArtifact = attachCustomerTopProjection({ ...seeded, surface_packets: surfacePackets });
  const artifact = identitySuffix
    ? {
      ...realizedArtifact,
      identity_context: {
        ...realizedArtifact.identity_context,
        display_name: `${realizedArtifact.identity_context.display_name} ${identitySuffix}`,
      },
    }
    : realizedArtifact;
  const realizationIdentity = buildNewBosRealizationIdentity({
    profileId,
    canonicalSourceSha256: digest(`bos-canonical-${fixtureId}-${profileId}`),
    rawEvidenceVersion: `synthetic-${fixtureId}-loader-v1`,
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: 'A',
  });
  return buildLaunchSafeNewBosEnvelope({
    profileId,
    realizationIdentity,
    artifact,
    compatibility: { class: 'A', label: 'Complete fictional loader contract' },
    providerAccounting: { calls: 0, store: false },
    createdAt: CREATED_AT,
  });
}

const DEFAULT_BOS_ENVELOPE = completedBosEnvelope();

function fusionAuthorityFor(bosEnvelope) {
  return projectBosFusionAuthorityFromArtifact({
    artifact: bosEnvelope.artifact,
    profileId: bosEnvelope.profile_id,
    realizationId: bosEnvelope.realization_id,
    artifactSha256: bosEnvelope.artifact_sha256,
    realizationVersion: bosEnvelope.realization_identity.version,
  });
}

function customerViewModel(variant) {
  const roles = ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future'];
  return {
    identity: { firstName: 'Avery', business: 'Avery’s Services Company', vertical: 'Professional Services' },
    vertical: { state: 'CUSTOMER_CONFIRMED', vertical_id: 'professional_services', label: 'Professional Services' },
    hero: { eyebrow: 'Avery’s Business Twin', title: 'A governed business map', subtitle: 'Current and evidence-bound.', modelDate: 'Jan 2, 2099' },
    layerContract: { stop_after: 2, layer_3_exists: false },
    layer0: { cards: [{ id: 'plan', value: 'Plan ready' }, { id: 'evidence', value: 'Evidence ready', items: [{ label: 'Things we know', value: 2 }] }] },
    destinations: {
      where: { headline: `Current operating reality ${variant}` },
      futures: { items: roles.map((role) => ({ role, title: role.replaceAll('_', ' '), probability: 20 })) },
      move: { headline: `Create visible ownership ${variant}` },
      plan: {
        headline: `Transfer routine decisions ${variant}`,
        goal: { title: `Build a transferable company ${variant}` },
        ways: [
          { status: 'SELECTED_COMPLETE', title: 'Clarify ownership' },
          { status: 'OPEN', title: null },
          { status: 'OPEN', title: null },
        ],
        strategies: Array.from({ length: 5 }, (_, index) => ({ title: `Strategy ${index + 1} ${variant}` })),
      },
      evidence: { categories: [{ id: 'known', label: 'Known', value: 2 }] },
    },
    objects: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`object-${index + 1}`, { title: `Inspectable object ${index + 1}` }])),
  };
}

function completedArtifact(variant = 'current', bosEnvelope = DEFAULT_BOS_ENVELOPE) {
  const businessEvidenceHash = digest(`business-evidence-${variant}`);
  const bosAuthority = fusionAuthorityFor(bosEnvelope);
  const bosAuthorityHash = bosEnvelope.artifact_sha256;
  const wbmHash = digest(`whole-business-model-${variant}`);
  const futuresHash = digest(`five-futures-${variant}`);
  const moveHash = digest(`one-move-${variant}`);
  const viewModel = customerViewModel(variant);
  const futures = ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future']
    .map((futureRole, index) => ({
      future_role: futureRole,
      title: `${futureRole.replaceAll('_', ' ')} ${variant}`,
      business_state_if_realized: `Conditional business state ${index + 1}`,
      conditionality: `If condition ${index + 1} holds`,
      normalized_relative_support_weight: 20,
      certainty_support_classification: 'SUPPORTED_HYPOTHESIS',
      leading_indicators: [`Indicator ${index + 1}`],
      risks: [`Risk ${index + 1}`],
      assumptions: [`Assumption ${index + 1}`],
      falsifiers: [`Falsifier ${index + 1}`],
    }));
  const plan = {
    contract_id: 'generalized-1-3-5-plan-v1',
    version: '1.0.0',
    goal: { title: `Build a transferable company ${variant}` },
    ways: [
      { way_id: 'way-1', status: 'SELECTED_COMPLETE', title: 'Clarify ownership', strategies: [] },
      { way_id: 'way-2', status: 'OPEN', title: null, strategies: [] },
      { way_id: 'way-3', status: 'OPEN', title: null, strategies: [] },
    ],
    strategies: Array.from({ length: 5 }, (_, index) => ({ title: `Strategy ${index + 1} ${variant}` })),
  };
  const artifactBase = {
    contract_id: 'new-ba-production-realization-v2',
    version: '2.0.0',
    profile_id: REALIZATION_PROFILE_ID,
    assessment_id: ASSESSMENT_ID,
    source_kind: 'CANONICAL_PROFILE_AND_BUSINESS_ASSESSMENT',
    authority: { status: 'FROZEN' },
    business_reality: {
      version: '1.0.0',
      state_hash: wbmHash,
      assessment_identity: {
        assessment_id: ASSESSMENT_ID,
        owner_profile_id: PROFILE_ID,
      },
      frozen_whole_person_authority: {
        profile_id: PROFILE_ID,
        bos_version: 'test-bos-authority-v1',
        bos_hash: bosAuthorityHash,
        selected_claim_refs: [],
      },
      business_model: { value_creation: 'Specialized advisory work', leverage: 'A small delivery team' },
      current_business_reality: { summary: `Founder-centered delivery ${variant}` },
      governed_business_evidence: [{ domain: 'operations', value: 'Routine decisions still return to the founder.' }],
      domain_states: [{
        domain_id: 'operations',
        claims: [
          { meaning: 'Routine decisions still return to the founder.', epistemic_class: 'KNOWN' },
          { meaning: 'Clear ownership may reduce approval delay.', epistemic_class: 'SUPPORTED_HYPOTHESIS' },
        ],
      }],
      causal_model: { mechanisms: [{ underlying_mechanism: 'Decision rights remain implicit.' }] },
      governing_constraint: { candidate: 'Implicit decision rights', falsifier: 'Managers own routine decisions without rescue.' },
      assets: [{ meaning: 'Strong client trust' }],
      vulnerabilities: [{ meaning: 'Founder approval delay' }],
      epistemic_state: {
        missing_evidence: [{ question: 'How often do managers decide without escalation?' }],
        contradictions: [{ statement: 'Some delivery decisions already stay with the team.' }],
        counterevidence: ['The team has independently resolved some client issues.'],
        mind_change_conditions: ['Observed independent ownership over four weeks.'],
      },
    },
    five_futures: { version: '2.0.0', artifact_hash: futuresHash, support_semantics: 'Conditional relative support totaling 100.', futures },
    one_move: {
      version: '2.0.0',
      artifact_hash: moveHash,
      primary_mechanism_ids: ['mechanism_decision_rights'],
      title: `Make one decision lane explicit ${variant}`,
      intervention: 'Assign routine delivery decisions to one named role.',
      why_now: 'A bounded ownership test can reveal whether approval delay is causal.',
      execution_definition: 'Publish the decision boundary and review exceptions weekly.',
      bounded_execution_steps: ['Choose the lane.', 'Name the owner.', 'Review only defined exceptions.'],
      leading_indicators: ['Share of routine decisions made without escalation'],
      success_evidence: ['Fewer routine approvals return to the founder'],
      failure_evidence: ['Escalations remain unchanged'],
      falsifiers: ['The boundary does not change decision flow'],
      stop_or_reconsider_conditions: ['Client risk rises materially'],
    },
    plan_135: plan,
    evidence: { categories: [{ id: 'known', label: 'Known', value: 1 }] },
    customer_view_model: viewModel,
    internal_trace: { status: 'COMPLETE' },
    provider_accounting: { accepted_calls: 3, store: false },
    lineage: {
      contract_id: 'real-profile-new-ba-lineage-v1',
      version: '1.0.0',
      profile_id: REALIZATION_PROFILE_ID,
      assessment_id: ASSESSMENT_ID,
      business_evidence_sha256: businessEvidenceHash,
      vertical_binding_sha256: VERTICAL_BINDING_SHA256,
      bos_authority_sha256: bosAuthorityHash,
      bos_fusion_contract_sha256: bosAuthority.contract_sha256,
      whole_business_model_sha256: wbmHash,
      five_futures_sha256: futuresHash,
      one_move_sha256: moveHash,
      plan_sha256: sha256Stable(plan),
      customer_projection_sha256: sha256Stable(viewModel),
      provider_response_direct_publication: false,
    },
  };
  const fusionBase = {
    contract_id: NEW_BA_BOS_FUSION_PROOF_CONTRACT,
    version: '1.0.0',
    profile_id: REALIZATION_PROFILE_ID,
    assessment_id: ASSESSMENT_ID,
    bos_authority: {
      realization_id: bosEnvelope.realization_id,
      artifact_sha256: bosAuthorityHash,
      source_version: bosAuthority.source_version,
      fusion_contract_sha256: artifactBase.lineage.bos_fusion_contract_sha256,
      evidence_boundary_sha256: bosAuthority.evidence_boundary_sha256,
      claim_count: bosAuthority.claims.length,
    },
    relationships: [{
      relationship_type: 'FEASIBILITY_MODIFIER',
      business_cause_established_by_personality: false,
      execution_adjustment: 'Make the boundary concrete and observable.',
    }],
    causal_boundary: {
      business_cause_source: 'BUSINESS_EVIDENCE_AND_WBM_MECHANISMS_ONLY',
      bos_contribution: 'EXECUTION_MODIFIER_ONLY',
      personality_score_to_business_cause: 'PROHIBITED',
      business_evidence_mutation: false,
    },
    privacy_boundary: {
      raw_bos_evidence_in_customer_projection: false,
      personality_scores_in_ba_artifact: false,
      provider_store: false,
    },
    customer_projection_effect: 'EXISTING_CANONICAL_EXECUTION_GUIDANCE_ONLY',
  };
  return { ...artifactBase, fusion: { ...fusionBase, proof_sha256: sha256Stable(fusionBase) } };
}

function completedEnvelope(variant = 'current', bosEnvelope = DEFAULT_BOS_ENVELOPE) {
  const artifact = completedArtifact(variant, bosEnvelope);
  const identity = buildNewBaRealizationIdentity({
    profileId: REALIZATION_PROFILE_ID,
    assessmentId: ASSESSMENT_ID,
    evidenceSha256: artifact.lineage.business_evidence_sha256,
    bosAuthoritySha256: artifact.lineage.bos_authority_sha256,
    bosFusionContractSha256: artifact.lineage.bos_fusion_contract_sha256,
    bosEvidenceBoundarySha256: artifact.fusion.bos_authority.evidence_boundary_sha256,
    compatibilityClass: 'A',
  });
  return buildLaunchSafeNewBaEnvelope({
    profileId: REALIZATION_PROFILE_ID,
    realizationIdentity: identity,
    artifact,
    compatibility: { class: 'A', label: 'Fully compatible test contract' },
    providerAccounting: { accepted_calls: 3, store: false },
    createdAt: CREATED_AT,
  });
}

function completedBundledPatriciaV3Envelope() {
  const bundled = resolveBundledBosAuthority(PATRICIA_PROFILE_ID);
  const verticalBinding = buildLegacyRealEstateVerticalBinding({
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_agent',
  });
  const artifact = JSON.parse(JSON.stringify(completedArtifact('bundled-patricia-v3'))
    .replaceAll(REALIZATION_PROFILE_ID, PATRICIA_PROFILE_ID)
    .replaceAll(PROFILE_ID, PATRICIA_PROFILE_ID.toLowerCase())
    .replaceAll(ASSESSMENT_ID, PATRICIA_ASSESSMENT_ID));
  artifact.business_reality.frozen_whole_person_authority.bos_version = bundled.version;
  artifact.business_reality.frozen_whole_person_authority.bos_hash = bundled.sha256;
  artifact.business_reality.frozen_whole_person_authority.selected_claim_refs = bundled.fusion_authority.claims
    .map((claim) => claim.claim_ref);
  artifact.lineage.vertical_binding_sha256 = verticalBinding.binding_sha256;
  artifact.lineage.bos_authority_sha256 = bundled.sha256;
  artifact.lineage.bos_fusion_contract_sha256 = bundled.fusion_contract_sha256;
  artifact.fusion.bos_authority = {
    realization_id: bundled.realization_id,
    artifact_sha256: bundled.sha256,
    source_version: bundled.fusion_authority.source_version,
    fusion_contract_sha256: bundled.fusion_contract_sha256,
    evidence_boundary_sha256: bundled.evidence_boundary_sha256,
    claim_count: bundled.fusion_authority.claims.length,
  };
  const { proof_sha256: ignoredProof, ...fusionCore } = artifact.fusion;
  void ignoredProof;
  artifact.fusion.proof_sha256 = sha256Stable(fusionCore);
  const identity = buildNewBaRealizationIdentityV3({
    profileId: PATRICIA_PROFILE_ID,
    assessmentId: PATRICIA_ASSESSMENT_ID,
    evidenceSha256: artifact.lineage.business_evidence_sha256,
    bosAuthoritySha256: bundled.sha256,
    bosFusionContractSha256: bundled.fusion_contract_sha256,
    bosEvidenceBoundarySha256: bundled.evidence_boundary_sha256,
    compatibilityClass: 'A',
    verticalBinding,
  });
  return {
    envelope: buildLaunchSafeNewBaEnvelope({
      profileId: PATRICIA_PROFILE_ID,
      realizationIdentity: identity,
      artifact,
      compatibility: { class: 'A', label: 'Pinned bundled V3 compatibility contract' },
      providerAccounting: { accepted_calls: 0, store: false },
      createdAt: CREATED_AT,
    }),
    verticalBinding,
  };
}

function currentAveryAssessment() {
  const selection = buildCustomerConfirmedSelection(
    PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical('real_estate'),
  );
  return {
    assessment_id: ASSESSMENT_ID,
    owner_profile_id: PROFILE_ID,
    status: 'complete',
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_agent',
    created_at: CREATED_AT,
    vertical_binding: buildCustomerConfirmedVerticalBinding({
      selection,
      selectedAt: CREATED_AT,
    }),
    inputs: {
      answers: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [
        `q${index + 1}`,
        `Fictional Avery Real Estate operating evidence ${index + 1}: the team is testing clear ownership for routine client decisions.`,
      ])),
    },
  };
}

function legacyCompleteBaOutput() {
  return {
    business_intelligence_draft: { version: 'business_intelligence_draft_v1' },
    executive_diagnostic_briefing_v1: { version: 'executive_diagnostic_briefing_v1' },
    five_futures_v1: { version: 'five_futures_v1' },
    one_move_v1: { version: 'one_move_v1' },
  };
}

function completedCurrentAveryEnvelope({
  assessment = currentAveryAssessment(),
  bosEnvelope = DEFAULT_BOS_ENVELOPE,
} = {}) {
  const governedAssessment = normalizeGovernedAssessmentRecord(
    assessment,
    REALIZATION_PROFILE_ID,
  );
  const verticalBinding = governedAssessment.vertical_binding;
  const artifact = completedArtifact('current-avery-real-estate', bosEnvelope);
  artifact.source_kind = 'SAVED_BUSINESS_ASSESSMENT';
  artifact.business_reality.assessment_identity.vertical = verticalBinding.vertical_id;
  artifact.business_reality.assessment_identity.vertical_binding = clone(verticalBinding);
  artifact.lineage.business_evidence_sha256 = governedAssessment.evidence_sha256;
  artifact.lineage.vertical_binding_sha256 = verticalBinding.binding_sha256;
  artifact.lineage.vertical_id = verticalBinding.vertical_id;
  artifact.lineage.cassette_id = verticalBinding.cassette_id;
  artifact.lineage.cassette_version = verticalBinding.cassette_version;
  artifact.customer_view_model.identity.business = 'Avery Collins Real Estate';
  artifact.customer_view_model.identity.vertical = 'Real Estate';
  artifact.customer_view_model.vertical = {
    state: 'CUSTOMER_CONFIRMED',
    vertical_id: verticalBinding.vertical_id,
    label: verticalBinding.vertical_label,
  };
  artifact.lineage.customer_projection_sha256 = sha256Stable(artifact.customer_view_model);
  artifact.lineage.vertical_id = verticalBinding.vertical_id;
  artifact.lineage.cassette_id = verticalBinding.cassette_id;
  artifact.lineage.cassette_version = verticalBinding.cassette_version;
  artifact.cassette_binding = {
    vertical_id: verticalBinding.vertical_id,
    cassette_id: verticalBinding.cassette_id,
    cassette_version: verticalBinding.cassette_version,
    projection_contract_id: verticalBinding.box_1_projection_contract_id,
    projection_contract_version: verticalBinding.box_1_projection_contract_version,
    projection_contract_sha256: verticalBinding.box_1_projection_contract_sha256,
    adapter_id: verticalBinding.box_1_projection_adapter_id,
    binding_sha256: verticalBinding.binding_sha256,
  };
  artifact.provider_accounting = {
    model: 'gpt-5.6-sol',
    calls: 3,
    accepted_calls: 3,
    submissions: 3,
    retries: 0,
    receipts: [],
    attempts: [],
    store: false,
    raw_request_persisted: false,
    raw_response_persisted: false,
  };
  artifact.lineage.lineage_sha256 = sha256Stable(artifact.lineage);
  const identity = buildNewBaRealizationIdentityV3({
    profileId: REALIZATION_PROFILE_ID,
    assessmentId: ASSESSMENT_ID,
    evidenceSha256: governedAssessment.evidence_sha256,
    bosAuthoritySha256: artifact.lineage.bos_authority_sha256,
    bosFusionContractSha256: artifact.lineage.bos_fusion_contract_sha256,
    bosEvidenceBoundarySha256: artifact.fusion.bos_authority.evidence_boundary_sha256,
    compatibilityClass: 'A',
    verticalBinding,
  });
  return buildLaunchSafeNewBaEnvelope({
    profileId: REALIZATION_PROFILE_ID,
    realizationIdentity: identity,
    artifact,
    compatibility: { class: 'A', label: 'Current fictional Avery Real Estate contract' },
    providerAccounting: artifact.provider_accounting,
    createdAt: CREATED_AT,
  });
}

function completedCurrentAveryV2Envelope({
  assessment = currentAveryAssessment(),
  bosEnvelope = DEFAULT_BOS_ENVELOPE,
} = {}) {
  const v3Envelope = completedCurrentAveryEnvelope({ assessment, bosEnvelope });
  const artifact = v3Envelope.artifact;
  const identity = buildNewBaRealizationIdentity({
    profileId: REALIZATION_PROFILE_ID,
    assessmentId: ASSESSMENT_ID,
    evidenceSha256: artifact.lineage.business_evidence_sha256,
    bosAuthoritySha256: artifact.lineage.bos_authority_sha256,
    bosFusionContractSha256: artifact.lineage.bos_fusion_contract_sha256,
    bosEvidenceBoundarySha256: artifact.fusion.bos_authority.evidence_boundary_sha256,
    compatibilityClass: 'A',
  });
  return buildLaunchSafeNewBaEnvelope({
    profileId: REALIZATION_PROFILE_ID,
    realizationIdentity: identity,
    artifact,
    compatibility: { class: 'A', label: 'Compatible prior V2 Real Estate contract' },
    providerAccounting: artifact.provider_accounting,
    createdAt: CREATED_AT,
  });
}

async function seedCurrentAveryCustody(store, {
  assessment = currentAveryAssessment(),
  envelope = completedCurrentAveryEnvelope({ assessment }),
} = {}) {
  await store.set(`vault:profile:${PROFILE_ID}`, JSON.stringify({
    email: 'avery.collins@example.test',
    person_name: 'Avery Collins',
    canonical_profile_json: {
      person_name: 'Avery Collins',
      private_note: 'Fictional source-only note must not enter the coaching packet.',
    },
  }));
  await store.set(`business_assessment_by_profile:${PROFILE_ID}`, ASSESSMENT_ID);
  await store.set(`business_assessment:${ASSESSMENT_ID}`, JSON.stringify(assessment));
  await store.set(
    `${CURRENT_NEW_BA_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${envelope.realization_id}`,
    JSON.stringify(envelope),
  );
  await store.set(
    `${CURRENT_NEW_BA_NAMESPACE}:latest-compatible:${REALIZATION_PROFILE_ID}`,
    envelope.realization_id,
  );
  await store.set(
    `${CURRENT_NEW_BOS_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${bosEnvelopeId(envelope)}`,
    JSON.stringify(DEFAULT_BOS_ENVELOPE),
  );
  await store.set(
    `${CURRENT_NEW_BOS_NAMESPACE}:latest-compatible:${REALIZATION_PROFILE_ID}`,
    bosEnvelopeId(envelope),
  );
  return { assessment, envelope };
}

function bosEnvelopeId(envelope) {
  return envelope.artifact.fusion.bos_authority.realization_id;
}

function canonicalProfile(profileId = PROFILE_ID) {
  return {
    found: true,
    profile_id: profileId,
    dossier: {
      canonical_profile_json: {
        person_name: 'Avery Example',
        private_note: 'This raw profile source detail must never enter runtime state.',
      },
    },
  };
}

function membershipContext(overrides = {}) {
  return {
    authenticated: true,
    membership_verified: true,
    binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
    scope: SCOPE,
    ...overrides,
  };
}

function loaderFor({
  envelope = completedEnvelope(),
  bosEnvelope = DEFAULT_BOS_ENVELOPE,
  store = new InMemoryLivingRelationshipStore(),
  counters = {},
} = {}) {
  const providerTransport = async () => {
    counters.provider = (counters.provider || 0) + 1;
    throw new Error('provider_must_not_run_during_load');
  };
  const loader = createPaidSubscriberLoader({
    readCanonicalProfile: async () => {
      counters.profile = (counters.profile || 0) + 1;
      return canonicalProfile();
    },
    readCompletedRealization: async () => {
      counters.realization = (counters.realization || 0) + 1;
      return typeof envelope === 'function' ? envelope() : envelope;
    },
    readCompletedBosRealization: async ({ realization_id }) => {
      counters.bos_realization = (counters.bos_realization || 0) + 1;
      counters.bos_realization_id = realization_id;
      return typeof bosEnvelope === 'function' ? bosEnvelope() : bosEnvelope;
    },
    openRelationshipStore: async ({ keys }) => {
      counters.keys = keys;
      return store;
    },
    readExternalEvidenceForRuntime: async () => [],
    createTransport: () => {
      counters.transport_factory = (counters.transport_factory || 0) + 1;
      return providerTransport;
    },
  });
  return { loader, store };
}

function loadArgs(overrides = {}) {
  return {
    redis: {},
    relationship_key: paidRuntimeRelationshipKey(SCOPE),
    subject_key: SCOPE.subject_id,
    membership_context: membershipContext(),
    session_id: SESSION_ID,
    session_kind: 'FIRST_EVER',
    coaching_episode_phase: 'IDLE',
    initial_conversation: [],
    env: {},
    now: () => RUNTIME_AT,
    ...overrides,
  };
}

test('paid subscriber loader composes owned canonical profile and completed BOS/BA into Free GPT V2/AFW05 without a provider call', async () => {
  const counters = {};
  const { loader, store } = loaderFor({ counters });
  const loaded = await loader(loadArgs());

  assert.equal(counters.profile, 1);
  assert.equal(counters.realization, 1);
  assert.equal(counters.bos_realization, 1);
  assert.equal(counters.bos_realization_id, DEFAULT_BOS_ENVELOPE.realization_id);
  assert.equal(counters.provider || 0, 0);
  assert.equal(counters.transport_factory || 0, 0);
  assert.equal(loaded.current.ok, true);
  assert.deepEqual(loaded.scope, SCOPE);
  assert.equal(loaded.keys.scope_hash, loaded.architecture.exact_scope_hash);
  assert.deepEqual(loaded.identity, {
    first_name: 'Avery',
    vertical: 'Professional Services',
    synthetic_only: false,
    demo_copy_only: false,
  });
  assert.equal(loaded.current.publication.source_artifact_lineage.length, 8);
  assert.deepEqual(
    loaded.current.publication.source_artifact_lineage.map((item) => item.artifact_type),
    PAID_SUBSCRIBER_REQUIRED_ARTIFACT_TYPES,
  );
  assert.equal(loaded.architecture.free_gpt_v2, true);
  assert.equal(loaded.architecture.afw05_core_reused, true);
  assert.equal(loaded.architecture.completed_recorded_bos_realization_loaded, true);
  assert.equal(loaded.architecture.governed_whole_person_claim_count, 6);
  assert.equal(loaded.architecture.bos_authority_projection_source, 'EXACT_RECORDED_LAUNCH_SAFE_BOS_REALIZATION');
  assert.equal(loaded.architecture.raw_canonical_profile_forwarded, false);
  assert.equal(loaded.architecture.raw_bos_artifact_forwarded, false);
  assert.equal(loaded.architecture.synthetic_lab_state_loaded, false);
  assert.equal(loaded.architecture.provider_calls_during_load, 0);

  const understanding = loaded.controller.wholeUnderstandingPacket();
  const runtimeText = JSON.stringify({ snapshot: store.snapshot(), understanding });
  assert.equal(runtimeText.includes('This raw profile source detail must never enter runtime state.'), false);
  const providerText = JSON.stringify(understanding.provider_understanding);
  assert.equal(understanding.provider_understanding.subscription_relationship['Capability context']['Live web research available'], false);
  assert.match(understanding.provider_understanding.subscription_relationship['Capability context']['Customer notice'], /does not search the live web/);
  for (const privateId of [...Object.values(SCOPE), ASSESSMENT_ID]) assert.equal(providerText.includes(privateId), false);
  const bosAuthority = fusionAuthorityFor(DEFAULT_BOS_ENVELOPE);
  for (const claim of bosAuthority.claims) assert.equal(providerText.includes(claim.meaning), true);
  for (const privateValue of [
    DEFAULT_BOS_ENVELOPE.profile_id,
    DEFAULT_BOS_ENVELOPE.realization_id,
    DEFAULT_BOS_ENVELOPE.artifact_sha256,
    DEFAULT_BOS_ENVELOPE.artifact.subject_token,
    ...bosAuthority.claims.flatMap((claim) => [claim.claim_ref, claim.meaning_sha256, ...claim.evidence_refs]),
  ]) assert.equal(providerText.includes(privateValue), false);
  assert.equal(/canonical_scores|personality_scores|vector_scores/iu.test(providerText), false);

  const source = fs.readFileSync(new URL('../api/engine/subscriptionV1/paidSubscriberLoader.js', import.meta.url), 'utf8');
  assert.equal(source.includes('/lab/'), false);
  assert.equal(source.toLowerCase().includes('patricia'), false);
});

test('paid subscriber loader fails closed on ownership, assessment, and completion drift', async (t) => {
  const envelope = completedEnvelope();

  await t.test('canonical profile must exactly match paid scope', () => {
    assert.throws(() => projectCompletedRealProfileToSubscription({
      scope: SCOPE,
      profile_lookup: canonicalProfile('mm-20990101-other001'),
      realization_record: envelope,
      bos_realization_record: DEFAULT_BOS_ENVELOPE,
    }), /PAID_SUBSCRIBER_CANONICAL_OWNED_PROFILE_REQUIRED/u);
  });

  await t.test('optional assessment binding must match validated realization', async () => {
    const { loader } = loaderFor({ envelope });
    await assert.rejects(loader(loadArgs({
      membership_context: membershipContext({ assessment_id: 'ba-20990101-acde0002' }),
    })), /PAID_SUBSCRIBER_ASSESSMENT_BINDING_MISMATCH/u);
  });

  await t.test('completed realization assessment must derive the authenticated business scope', async () => {
    const wrongScope = { ...SCOPE, business_id: `business_${'f'.repeat(40)}` };
    const { loader } = loaderFor({ envelope });
    await assert.rejects(loader(loadArgs({
      relationship_key: paidRuntimeRelationshipKey(wrongScope),
      membership_context: membershipContext({ scope: wrongScope }),
    })), /PAID_SUBSCRIBER_ASSESSMENT_BUSINESS_BINDING_MISMATCH/u);
  });

  await t.test('flat membership binding must match every exact scope field', async () => {
    const { loader } = loaderFor({ envelope });
    await assert.rejects(loader(loadArgs({
      membership_context: membershipContext({
        membership_binding: {
          ...SCOPE,
          tenant_id: 'tenant_wrong_contract_0001',
          membership_verified: true,
          binding_source: 'AUTHENTICATED_SERVER_CONTEXT',
        },
      }),
    })), /PAID_SUBSCRIBER_MEMBERSHIP_BINDING_MISMATCH/u);
  });

  await t.test('incomplete realization cannot seed runtime state', async () => {
    const incomplete = clone(envelope);
    delete incomplete.artifact.fusion;
    const { loader } = loaderFor({ envelope: incomplete });
    await assert.rejects(loader(loadArgs()), /new_ba_store_artifact_hash_mismatch|new_ba_bos_fusion_proof_contract_invalid|new_ba_realization/u);
  });

  await t.test('realization identity and recorded BOS authority must remain cross-bound', async () => {
    const identityDrift = clone(envelope);
    identityDrift.realization_identity.components.bos_authority_sha256 = digest('unbound-bos-authority');
    const { loader: identityLoader } = loaderFor({ envelope: identityDrift });
    await assert.rejects(identityLoader(loadArgs()), /PAID_SUBSCRIBER_REALIZATION_IDENTITY_BINDING_MISMATCH/u);

    const recordedBosDrift = clone(envelope);
    recordedBosDrift.artifact.fusion.bos_authority.artifact_sha256 = digest('other-recorded-bos-authority');
    recordedBosDrift.artifact.fusion.proof_sha256 = sha256Stable({
      ...recordedBosDrift.artifact.fusion,
      proof_sha256: undefined,
    });
    recordedBosDrift.artifact_sha256 = sha256Stable(recordedBosDrift.artifact);
    const { loader: recordedBosLoader } = loaderFor({ envelope: recordedBosDrift });
    await assert.rejects(recordedBosLoader(loadArgs()), /PAID_SUBSCRIBER_RECORDED_AUTHORITY_BINDING_MISMATCH/u);
  });

  await t.test('subject and relationship keys are consistency checks, never substitute authority', async () => {
    const { loader } = loaderFor({ envelope });
    await assert.rejects(loader(loadArgs({ subject_key: 'subject_wrong_contract_0001' })), /PAID_SUBSCRIBER_RUNTIME_IDENTITY_BINDING_MISMATCH/u);
    await assert.rejects(loader(loadArgs({ relationship_key: 'paid_wrong_contract_0001' })), /PAID_SUBSCRIBER_RUNTIME_IDENTITY_BINDING_MISMATCH/u);
  });
});

test('paid subscriber loader rejects recorded BOS snapshot drift before relationship state or provider access', async (t) => {
  await t.test('a different valid BOS artifact cannot satisfy the recorded BA snapshot', async () => {
    const counters = {};
    const { loader } = loaderFor({
      bosEnvelope: completedBosEnvelope({ identitySuffix: 'alternate valid snapshot' }),
      counters,
    });
    await assert.rejects(loader(loadArgs()), /PAID_SUBSCRIBER_BOS_AUTHORITY_SNAPSHOT_BINDING_MISMATCH/u);
    assert.equal(counters.keys, undefined);
    assert.equal(counters.provider || 0, 0);
    assert.equal(counters.transport_factory || 0, 0);
  });

  await t.test('a cross-profile BOS envelope is rejected by the launch-safe boundary', async () => {
    const counters = {};
    const { loader } = loaderFor({
      bosEnvelope: completedBosEnvelope({ profileId: 'MM-20990101-OTHERBOS' }),
      counters,
    });
    await assert.rejects(loader(loadArgs()), /new_bos_launch_store_profile_isolation_failure/u);
    assert.equal(counters.keys, undefined);
    assert.equal(counters.provider || 0, 0);
  });

  for (const [name, mutate] of [
    ['compatibility class', (record) => { record.compatibility.class = 'C'; }],
    ['provider retention', (record) => { record.provider_accounting.store = true; }],
  ]) {
    await t.test(`${name} metadata drift is rejected`, async () => {
      const bosEnvelope = clone(DEFAULT_BOS_ENVELOPE);
      mutate(bosEnvelope);
      const counters = {};
      const { loader } = loaderFor({ bosEnvelope, counters });
      await assert.rejects(loader(loadArgs()), /PAID_SUBSCRIBER_LAUNCH_SAFE_BOS_REALIZATION_REQUIRED/u);
      assert.equal(counters.keys, undefined);
      assert.equal(counters.provider || 0, 0);
    });
  }

  for (const [name, mutate] of [
    ['source version', (recorded) => { recorded.source_version = 'other-bos-source-version'; }],
    ['evidence boundary', (recorded) => { recorded.evidence_boundary_sha256 = digest('other-evidence-boundary'); }],
    ['claim count', (recorded) => { recorded.claim_count += 1; }],
  ]) {
    await t.test(`${name} drift is rejected`, async () => {
      const drifted = clone(completedEnvelope());
      mutate(drifted.artifact.fusion.bos_authority);
      const { proof_sha256: ignored, ...fusionCore } = drifted.artifact.fusion;
      void ignored;
      drifted.artifact.fusion.proof_sha256 = sha256Stable(fusionCore);
      drifted.artifact_sha256 = sha256Stable(drifted.artifact);
      const counters = {};
      const { loader } = loaderFor({ envelope: drifted, counters });
      await assert.rejects(loader(loadArgs()), /PAID_SUBSCRIBER_BOS_AUTHORITY_SNAPSHOT_BINDING_MISMATCH/u);
      assert.equal(counters.keys, undefined);
      assert.equal(counters.provider || 0, 0);
    });
  }
});

test('only a cryptographically pinned bundled BOS snapshot may use compact paid compatibility without a Redis envelope', async (t) => {
  await t.test('a genuine V3 identity bound to Patricia pinned BOS custody remains compact-compatible', () => {
    const { envelope, verticalBinding } = completedBundledPatriciaV3Envelope();
    const profileId = PATRICIA_PROFILE_ID.toLowerCase();
    const scope = {
      subject_id: 'subject_patricia_bundled_v3',
      membership_id: 'membership_patricia_bundled_v3',
      tenant_id: 'tenant_patricia_bundled_v3',
      profile_id: profileId,
      business_id: `business_${hashCanonicalJson({
        domain: 'more-paid-subscription-business-v1',
        profile_id: profileId,
        assessment_id: PATRICIA_ASSESSMENT_ID,
        vertical_binding_sha256: verticalBinding.binding_sha256,
      }).slice(0, 40)}`,
    };
    const projection = projectCompletedRealProfileToSubscription({
      scope,
      assessment_id: PATRICIA_ASSESSMENT_ID,
      profile_lookup: canonicalProfile(profileId),
      realization_record: envelope,
      bos_realization_record: null,
    });
    assert.equal(projection.bos_authority_claim_count, 0);
    assert.equal(projection.bos_authority_projection_source, 'RECORDED_NEW_BA_COMPACT_COMPATIBILITY');
    assert.deepEqual(
      projection.canonical_artifacts.find(({ artifact_type }) => artifact_type === 'NEW_BOS').payload.governed_claims,
      [],
    );
  });

  await t.test('a V2 identity bound to an unpinned dynamic BOS fails closed when that exact envelope is missing', async () => {
    const counters = {};
    const { loader } = loaderFor({ bosEnvelope: null, counters });
    await assert.rejects(loader(loadArgs()), /PAID_SUBSCRIBER_RECORDED_BOS_REALIZATION_REQUIRED/u);
    assert.equal(counters.provider || 0, 0);
    assert.equal(counters.transport_factory || 0, 0);
    assert.equal(counters.keys, undefined);
  });
});

test('paid subscriber loader resumes the same AFW05 baseline and requires reconciliation before a changed canonical baseline', async () => {
  let currentEnvelope = completedEnvelope('current');
  const counters = {};
  const store = new InMemoryLivingRelationshipStore();
  const { loader } = loaderFor({ envelope: () => currentEnvelope, store, counters });

  const first = await loader(loadArgs());
  const replay = await loader(loadArgs({ session_kind: 'WEEKLY' }));
  assert.equal(replay.current.publication.publication_hash, first.current.publication.publication_hash);
  assert.equal(store.snapshot().transaction_count, 1);
  assert.equal(counters.provider || 0, 0);

  currentEnvelope = completedEnvelope('changed');
  await assert.rejects(loader(loadArgs({ session_kind: 'WEEKLY' })), /PAID_SUBSCRIBER_BASELINE_RECONCILIATION_REQUIRED/u);
  assert.equal(store.snapshot().current_publication_hash, first.current.publication.publication_hash);
  assert.equal(counters.provider || 0, 0);
});

test('current realization reader delegates only to the governed current pointer', async () => {
  const calls = [];
  const envelope = completedEnvelope();
  const reader = createCurrentRealProfileRealizationReader({
    realizationStore: {
      async getCurrent({ profileId }) {
        calls.push(profileId);
        return envelope;
      },
    },
  });
  assert.equal(await reader({ profile_id: PROFILE_ID }), envelope);
  assert.deepEqual(calls, [REALIZATION_PROFILE_ID]);
});

test('recorded BOS reader retrieves only the exact immutable realization named by New BA', async () => {
  const calls = [];
  const reader = createRecordedBosRealizationReader({
    realizationStore: {
      async getRealization(input) {
        calls.push(input);
        return DEFAULT_BOS_ENVELOPE;
      },
    },
  });
  assert.equal(await reader({
    profile_id: PROFILE_ID,
    realization_id: DEFAULT_BOS_ENVELOPE.realization_id,
  }), DEFAULT_BOS_ENVELOPE);
  assert.deepEqual(calls, [{
    profileId: REALIZATION_PROFILE_ID,
    realizationId: DEFAULT_BOS_ENVELOPE.realization_id,
  }]);
  const missing = createRecordedBosRealizationReader({
    realizationStore: { async getRealization() { return null; } },
  });
  assert.equal(await missing({ profile_id: PROFILE_ID, realization_id: 'legacy-bundled-bos-snapshot' }), null);
});

test('current New BA bridges signed Avery ownership to provider-free paid readiness while Stripe entitlement remains absent', async () => {
  const store = new MemoryPublicStore();
  const { assessment, envelope } = await seedCurrentAveryCustody(store);
  const assessmentRawBefore = await store.get(`business_assessment:${ASSESSMENT_ID}`);
  const envelopeKey = `${CURRENT_NEW_BA_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${envelope.realization_id}`;
  const envelopeRawBefore = await store.get(envelopeKey);
  const profileStateReader = createProfileStateReader(store);
  assert.deepEqual(await profileStateReader(PROFILE_ID), { bos: 'ready', ba: 'pending' });
  assert.equal(Object.hasOwn(assessment, 'output'), false);

  const currentNewBaReadinessReader = createCurrentNewBaMembershipReadinessReader({
    store,
    namespace: CURRENT_NEW_BA_NAMESPACE,
    bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
  });
  const readiness = await currentNewBaReadinessReader({
    profile_id: PROFILE_ID,
    assessment,
  });
  assert.equal(readiness.ready, true);
  assert.equal(readiness.source, 'CURRENT_NEW_BA_LAUNCH_SAFE_REALIZATION');
  assert.equal(readiness.realization_id, envelope.realization_id);
  assert.equal(readiness.runtime_compatible_bos_ready, true);
  assert.equal(readiness.bos_realization_id, DEFAULT_BOS_ENVELOPE.realization_id);
  assert.equal(readiness.bos_artifact_sha256, DEFAULT_BOS_ENVELOPE.artifact_sha256);
  assert.equal(readiness.bos_custody_source, 'EXACT_RECORDED_LAUNCH_SAFE_BOS_REALIZATION');
  assert.equal(readiness.mutation_performed, false);

  const nowMs = Date.parse(RUNTIME_AT);
  const signingKey = 'synthetic-local-owner-signing-key-with-at-least-32-characters';
  const authEnv = {
    PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true',
    PUBLIC_PROFILE_OWNERSHIP_ENVIRONMENT: 'preview',
    PUBLIC_SITE_URL: 'https://paid-candidate.example.test',
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: signingKey,
  };
  const ownerReader = createCanonicalProfileOwnerReader(store);
  let deliveredToken = null;
  let syntheticDeliveryCount = 0;
  const ownership = createProfileOwnershipAdapter({
    store,
    ownerReader,
    transport: {
      async send(message) {
        deliveredToken = message.token;
        syntheticDeliveryCount += 1;
        return { success: true };
      },
    },
    signingKey,
    audience: resolveProfileOwnershipAudience(authEnv),
    clock: () => nowMs,
    tokenFactory: () => 'synthetic-local-owner-token-cohort-re-a-only',
    minimumResponseDelayMs: 0,
  });
  await ownership.requestChallenge({ profile_id: PROFILE_ID, return_path: '/step-2' });
  assert.equal(syntheticDeliveryCount, 1);
  assert.equal(typeof deliveredToken, 'string');
  const ownerReceipt = await ownership.consumeChallenge(deliveredToken);
  deliveredToken = null;
  const cookieHeader = profileOwnerCookie(ownerReceipt.receipt).split(';')[0];
  assert.equal(ownership.verifyRequest({ profile_id: PROFILE_ID, cookie_header: cookieHeader }), true);

  const binder = createPaidMembershipBinder({
    store,
    ownershipVerifier: (input) => ownership.verifyRequest(input),
    ownerReader,
    profileStateReader,
    currentNewBaReadinessReader,
    clock: () => nowMs,
  });
  const membership = await binder({ profile_id: PROFILE_ID, cookie_header: cookieHeader });
  assert.equal(membership.authenticated, true);
  assert.equal(membership.membership_verified, true);
  assert.equal(membership.assessment_id, ASSESSMENT_ID);
  assert.equal(membership.scope.profile_id, PROFILE_ID);
  assert.equal(
    [...store.values.keys()].filter((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)).length,
    4,
  );

  const service = createPublicSiteService({
    store,
    monthlyCheckoutEnabled: true,
    monthlyMembershipBinder: binder,
    clock: () => nowMs,
  });
  const intent = await service.createPurchaseIntent({
    product_key: 'more_monthly_intelligence',
    profile_id: PROFILE_ID,
    idempotency_key: 'cohort-re-a-monthly-preparation-0001',
  }, { cookie_header: cookieHeader });
  assert.equal(intent.status, 'awaiting_provider_checkout');
  assert.equal(intent.expected_price_minor, 3895);
  assert.equal(intent.currency, 'usd');
  assert.equal(intent.cadence, 'monthly');
  assert.deepEqual(intent.membership_binding, membership.membership_binding);

  const publicRuntime = createPublicRuntime({
    ...authEnv,
    PUBLIC_CHECKOUT_ENABLED: 'true',
    PUBLIC_SUBSCRIPTION_CHECKOUT_ENABLED: 'true',
    PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
    PUBLIC_SUBSCRIPTION_DESTINATION: '/subscription',
    MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: 'synthetic-public-start-key-with-at-least-32-characters',
    MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_RESEND_API_KEY: 're_synthetic_profile_owner_key_123456',
    PUBLIC_PROFILE_OWNERSHIP_EMAIL_FROM: 'MORE MindMap <hello@moremindmap.example>',
    PUBLIC_STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: 'sk_test_synthetic_never_sent',
    STRIPE_PRICE_BEHAVIOR_OS: 'price_synthetic_bos_14900',
    STRIPE_PRICE_BUSINESS_ASSESSMENT: 'price_synthetic_ba_4900',
    STRIPE_PRICE_MORE_MONTHLY_INTELLIGENCE: 'price_synthetic_monthly_3895',
    STRIPE_WEBHOOK_SECRET: 'whsec_synthetic_paid_subscription_1234567890',
    REDIS_URL: 'redis://synthetic.example.test:6379',
    NEW_BA_DERIVED_NAMESPACE: CURRENT_NEW_BA_NAMESPACE,
    NEW_BA_BOS_NAMESPACE: CURRENT_NEW_BOS_NAMESPACE,
    NEW_BA_PROVIDER_MODEL: 'gpt-5.6-sol',
  }, {
    store,
    ownerReader,
    profileStateReader,
    ownership,
    clock: () => nowMs,
  });
  const defaultWiredIntent = await publicRuntime.service.createPurchaseIntent({
    product_key: 'more_monthly_intelligence',
    profile_id: PROFILE_ID,
    idempotency_key: 'cohort-re-a-default-public-runtime-0001',
  }, { cookie_header: cookieHeader });
  assert.equal(defaultWiredIntent.status, 'awaiting_provider_checkout');
  assert.equal(defaultWiredIntent.membership_binding.assessment_id, ASSESSMENT_ID);
  assert.equal(defaultWiredIntent.membership_binding.membership_id, membership.membership_id);

  const authenticated = await authenticatePaidRuntimeRequest({
    redis: store,
    req: { headers: { cookie: cookieHeader } },
    env: authEnv,
    nowMs,
  });
  assert.equal(authenticated.ok, true, authenticated.code);
  assert.deepEqual(authenticated.scope, membership.scope);
  const membershipContextForLoader = {
    authenticated: authenticated.authenticated,
    membership_verified: authenticated.membership_verified,
    binding_source: authenticated.binding_source,
    scope: authenticated.scope,
    assessment_id: membership.assessment_id,
    membership_binding: membership.membership_binding,
  };

  for (const [arm, sessionId] of [
    ['MODEL_1', SESSION_ID],
    ['MODEL_2', 'session_111111111111111111111111'],
  ]) {
    const relationshipStore = new InMemoryLivingRelationshipStore();
    let transportFactoryCalls = 0;
    const syntheticStages = [];
    const loader = createPaidSubscriberLoader({
      readCanonicalProfile: async ({ profile_id: profileId }) => {
        const record = JSON.parse(await store.get(`vault:profile:${profileId}`));
        return {
          found: true,
          profile_id: profileId,
          dossier: { canonical_profile_json: record.canonical_profile_json },
        };
      },
      readCompletedRealization: async ({ profile_id: profileId }) => {
        const pointer = await store.get(`${CURRENT_NEW_BA_NAMESPACE}:latest-compatible:${profileId.toUpperCase()}`);
        return JSON.parse(await store.get(`${CURRENT_NEW_BA_NAMESPACE}:artifact:${profileId.toUpperCase()}:${pointer}`));
      },
      readCompletedBosRealization: async ({ profile_id: profileId, realization_id: realizationId }) => {
        const raw = await store.get(`${CURRENT_NEW_BOS_NAMESPACE}:artifact:${profileId.toUpperCase()}:${realizationId}`);
        return raw ? JSON.parse(raw) : null;
      },
      openRelationshipStore: async () => relationshipStore,
      readExternalEvidenceForRuntime: async () => [],
      createTransport: () => {
        transportFactoryCalls += 1;
        throw new Error('external_provider_transport_must_remain_unopened');
      },
    });
    const localSyntheticTransport = async (request, { stage }) => {
      syntheticStages.push(stage);
      if (stage === 'CONVERSATION') {
        assert.deepEqual(request.tools, []);
        assert.equal(Object.hasOwn(request, 'max_tool_calls'), false);
        assert.equal(request.include?.some(value => value.startsWith('web_search_call')), undefined);
        return {
          output: {
            customer_message: 'Avery, begin with one routine client decision that still returns to you. What boundary would let the team own it safely?',
          },
          usage: {},
          latency_ms: 1,
          web_search_calls: 0,
          external_evidence: [],
        };
      }
      return {
        output: { candidate: null },
        usage: {},
        latency_ms: 1,
        web_search_calls: 0,
        external_evidence: [],
      };
    };
    const loaded = await loader({
      redis: store,
      relationship_key: authenticated.capability.relationship_key,
      subject_key: authenticated.capability.subject_key,
      membership_context: membershipContextForLoader,
      session_id: sessionId,
      session_kind: 'FIRST_EVER',
      coaching_episode_phase: 'ACTIVE',
      initial_conversation: [],
      transport: localSyntheticTransport,
      now: () => RUNTIME_AT,
    });
    assert.equal(loaded.current.ok, true, `${arm}: ${loaded.current.code}`);
    assert.equal(loaded.identity.first_name, 'Avery');
    assert.equal(loaded.identity.vertical, 'Real Estate');
    assert.equal(loaded.architecture.provider_calls_during_load, 0);
    assert.equal(transportFactoryCalls, 0);
    const understandingText = JSON.stringify(loaded.controller.wholeUnderstandingPacket());
    assert.equal(understandingText.includes('Fictional source-only note must not enter the coaching packet.'), false);
    const beforeTurn = relationshipStore.snapshot();
    const turn = await loaded.controller.send({
      message: 'Which decision should I hand off first?',
      active_lens: 'MOVE',
      purpose: 'WEEKLY_COACHING',
      topics: ['decision ownership'],
    });
    assert.equal(turn.ok, true, `${arm}: ${turn.code}`);
    assert.equal(turn.mutation_performed, false);
    assert.equal(turn.confirmation_required, false);
    assert.deepEqual(syntheticStages, ['CONVERSATION', 'CANDIDATE_EXTRACTION']);
    const afterTurn = relationshipStore.snapshot();
    assert.equal(afterTurn.current_publication_hash, beforeTurn.current_publication_hash);
    assert.deepEqual(afterTurn.personal_rsl_records, beforeTurn.personal_rsl_records);
    assert.deepEqual(afterTurn.proposals, beforeTurn.proposals);
  }

  await assert.rejects(
    resolvePaidEntitlementFromStore({
      redis: store,
      scope: membership.scope,
      now: new Date(RUNTIME_AT),
    }),
    /PAID_ENTITLEMENT_RECONCILIATION_REQUIRED/u,
  );
  assert.equal(await store.get(`business_assessment:${ASSESSMENT_ID}`), assessmentRawBefore);
  assert.equal(await store.get(envelopeKey), envelopeRawBefore);
  const forbiddenKey = [...store.values.keys(), ...store.sets.keys()].find((key) => (
    key.startsWith('access_grant:')
    || key.startsWith('access_grant_by_')
    || key.startsWith('payment_event')
    || key.startsWith('stripe_')
  ));
  assert.equal(forbiddenKey, undefined);
});

test('current New BA paid-readiness bridge requires runtime-compatible custody and fails closed before paid writes', async (t) => {
  await t.test('legacy-complete BA cannot bypass current runtime readiness', async () => {
    const store = new MemoryPublicStore();
    const assessment = {
      ...currentAveryAssessment(),
      output: legacyCompleteBaOutput(),
    };
    await seedCurrentAveryCustody(store, { assessment });
    const profileStateReader = createProfileStateReader(store);
    assert.equal(isExactLegacyBusinessAssessmentComplete(assessment), true);
    assert.deepEqual(await profileStateReader(PROFILE_ID), { bos: 'ready', ba: 'ready' });
    let currentReaderCalls = 0;
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader,
      currentNewBaReadinessReader: async () => { currentReaderCalls += 1; return { ready: false }; },
      clock: () => Date.parse(RUNTIME_AT),
    });
    await assert.rejects(
      binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
      /completed_bos_and_business_assessment_required/u,
    );
    assert.equal(currentReaderCalls, 1);
    assert.equal(isExactLegacyBusinessAssessmentComplete(assessment), true);
    assert.equal(
      [...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)),
      false,
    );
  });

  await t.test('legacy-complete BA remains eligible when exact current runtime readiness exists', async () => {
    const store = new MemoryPublicStore();
    const assessment = {
      ...currentAveryAssessment(),
      output: legacyCompleteBaOutput(),
    };
    await seedCurrentAveryCustody(store, { assessment });
    const profileStateReader = createProfileStateReader(store);
    const exactReader = createCurrentNewBaMembershipReadinessReader({
      store,
      namespace: CURRENT_NEW_BA_NAMESPACE,
      bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
    });
    let currentReaderCalls = 0;
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader,
      currentNewBaReadinessReader: async (input) => {
        currentReaderCalls += 1;
        return exactReader(input);
      },
      clock: () => Date.parse(RUNTIME_AT),
    });
    const result = await binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' });
    assert.equal(result.membership_verified, true);
    assert.equal(currentReaderCalls, 1);
    assert.equal(isExactLegacyBusinessAssessmentComplete(assessment), true);
  });

  await t.test('compatible prior V2 Real Estate custody remains eligible when the runtime can load it', async () => {
    const store = new MemoryPublicStore();
    const assessment = {
      ...currentAveryAssessment(),
      output: legacyCompleteBaOutput(),
    };
    const envelope = completedCurrentAveryV2Envelope({ assessment });
    await seedCurrentAveryCustody(store, { assessment, envelope });
    const reader = createCurrentNewBaMembershipReadinessReader({
      store,
      namespace: CURRENT_NEW_BA_NAMESPACE,
      bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
    });
    const receipt = await reader({ profile_id: PROFILE_ID, assessment });
    assert.equal(receipt.ready, true);
    assert.equal(receipt.realization_id, envelope.realization_id);
    assert.equal(receipt.runtime_compatible_bos_ready, true);
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader: createProfileStateReader(store),
      currentNewBaReadinessReader: reader,
      clock: () => Date.parse(RUNTIME_AT),
    });
    assert.equal((await binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' })).membership_verified, true);
  });

  await t.test('stale legacy-ready profile state cannot authorize an exact incomplete assessment', async () => {
    const store = new MemoryPublicStore();
    await seedCurrentAveryCustody(store);
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
      clock: () => Date.parse(RUNTIME_AT),
    });
    await assert.rejects(
      binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
      /completed_bos_and_business_assessment_required/u,
    );
    assert.equal(
      [...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)),
      false,
    );
  });

  await t.test('assessment pointer and record races fail closed before any paid membership write', async (race) => {
    for (const drift of ['pointer', 'record']) {
      await race.test(`${drift} drift`, async () => {
        const store = new MemoryPublicStore();
        const assessment = {
          ...currentAveryAssessment(),
          output: legacyCompleteBaOutput(),
        };
        await seedCurrentAveryCustody(store, { assessment });
        const readinessReader = createCurrentNewBaMembershipReadinessReader({
          store,
          namespace: CURRENT_NEW_BA_NAMESPACE,
          bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
        });
        const readinessReceipt = await readinessReader({ profile_id: PROFILE_ID, assessment });
        const pointerKey = `business_assessment_by_profile:${PROFILE_ID}`;
        const recordKey = `business_assessment:${ASSESSMENT_ID}`;
        const storeGet = store.get.bind(store);
        let pointerReads = 0;
        let recordReads = 0;
        store.get = async (key) => {
          const value = await storeGet(key);
          if (key === pointerKey) {
            pointerReads += 1;
            return drift === 'pointer' && pointerReads === 2
              ? `${ASSESSMENT_ID}-advanced`
              : value;
          }
          if (key === recordKey) {
            recordReads += 1;
            if (drift === 'record' && recordReads === 2) {
              const advanced = JSON.parse(value);
              advanced.output.one_move_v1 = {
                ...advanced.output.one_move_v1,
                race_marker: 'advanced-after-readiness-proof',
              };
              return JSON.stringify(advanced);
            }
          }
          return value;
        };
        const binder = createPaidMembershipBinder({
          store,
          ownershipVerifier: async () => true,
          ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
          profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
          currentNewBaReadinessReader: async () => readinessReceipt,
          clock: () => Date.parse(RUNTIME_AT),
        });
        await assert.rejects(
          binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
          /completed_bos_and_business_assessment_required/u,
        );
        assert.equal(pointerReads, 2);
        assert.equal(recordReads, 2);
        assert.equal(
          [...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)),
          false,
        );
      });
    }
  });

  await t.test('BOS-pending state never invokes the current reader or creates membership records', async () => {
    const store = new MemoryPublicStore();
    await seedCurrentAveryCustody(store);
    let currentReaderCalls = 0;
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader: async () => ({ bos: 'pending', ba: 'pending' }),
      currentNewBaReadinessReader: async () => { currentReaderCalls += 1; return { ready: true }; },
      clock: () => Date.parse(RUNTIME_AT),
    });
    await assert.rejects(
      binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
      /completed_bos_and_business_assessment_required/u,
    );
    assert.equal(currentReaderCalls, 0);
    assert.equal([...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)), false);
  });

  await t.test('missing or drifting current custody preserves the generic prerequisite failure', async () => {
    const store = new MemoryPublicStore();
    const { assessment, envelope } = await seedCurrentAveryCustody(store);
    await store.del(`${CURRENT_NEW_BA_NAMESPACE}:latest-compatible:${REALIZATION_PROFILE_ID}`);
    const reader = createCurrentNewBaMembershipReadinessReader({
      store,
      namespace: CURRENT_NEW_BA_NAMESPACE,
      bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
    });
    assert.equal((await reader({ profile_id: PROFILE_ID, assessment })).ready, false);
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader: async () => ({ bos: 'ready', ba: 'pending' }),
      currentNewBaReadinessReader: reader,
      clock: () => Date.parse(RUNTIME_AT),
    });
    await assert.rejects(
      binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
      /completed_bos_and_business_assessment_required/u,
    );
    assert.equal([...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)), false);

    await store.set(`${CURRENT_NEW_BA_NAMESPACE}:latest-compatible:${REALIZATION_PROFILE_ID}`, envelope.realization_id);
    const driftedAssessment = clone(assessment);
    driftedAssessment.inputs.answers.q10 = 'A different synthetic constraint that was never bound to the current realization.';
    await store.set(`business_assessment:${ASSESSMENT_ID}`, JSON.stringify(driftedAssessment));
    await assert.rejects(
      reader({ profile_id: PROFILE_ID, assessment: driftedAssessment }),
      /paid_current_new_ba_readiness_reconciliation_required/u,
    );
    await assert.rejects(
      binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
      /completed_bos_and_business_assessment_required/u,
    );
    assert.equal([...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)), false);
  });

  await t.test('missing recorded BOS custody fails before any paid membership write', async () => {
    const store = new MemoryPublicStore();
    const { assessment, envelope } = await seedCurrentAveryCustody(store);
    await store.del(`${CURRENT_NEW_BOS_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${bosEnvelopeId(envelope)}`);
    const reader = createCurrentNewBaMembershipReadinessReader({
      store,
      namespace: CURRENT_NEW_BA_NAMESPACE,
      bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
    });
    await assert.rejects(
      reader({ profile_id: PROFILE_ID, assessment }),
      /paid_current_new_ba_readiness_reconciliation_required/u,
    );
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
      currentNewBaReadinessReader: reader,
      clock: () => Date.parse(RUNTIME_AT),
    });
    await assert.rejects(
      binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
      /completed_bos_and_business_assessment_required/u,
    );
    assert.equal([...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)), false);
  });

  await t.test('malformed ready receipts cannot authorize paid membership writes', async () => {
    const store = new MemoryPublicStore();
    const { assessment } = await seedCurrentAveryCustody(store);
    const reader = createCurrentNewBaMembershipReadinessReader({
      store,
      namespace: CURRENT_NEW_BA_NAMESPACE,
      bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
    });
    const validReceipt = await reader({ profile_id: PROFILE_ID, assessment });
    const malformedReceipts = [
      { ...validReceipt, profile_id: 'wrong-profile' },
      { ...validReceipt, mutation_performed: true },
      { ...validReceipt, provider_store: true },
      { ...validReceipt, vertical_binding_sha256: '0'.repeat(64) },
      { ...validReceipt, realization_id: `${validReceipt.realization_id}-forged` },
      { ...validReceipt, runtime_compatible_bos_ready: false },
      { ...validReceipt, bos_realization_id: '' },
      { ...validReceipt, bos_artifact_sha256: '0'.repeat(63) },
      { ...validReceipt, bos_custody_source: 'UNVERIFIED' },
    ];
    for (const receipt of malformedReceipts) {
      const binder = createPaidMembershipBinder({
        store,
        ownershipVerifier: async () => true,
        ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
        profileStateReader: async () => ({ bos: 'ready', ba: 'pending' }),
        currentNewBaReadinessReader: async () => receipt,
        clock: () => Date.parse(RUNTIME_AT),
      });
      await assert.rejects(
        binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
        /completed_bos_and_business_assessment_required/u,
      );
      assert.equal(
        [...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)),
        false,
      );
    }
  });

  await t.test('assessment pointer and stored record identity must agree before paid writes', async () => {
    const store = new MemoryPublicStore();
    const { assessment } = await seedCurrentAveryCustody(store);
    const reader = createCurrentNewBaMembershipReadinessReader({
      store,
      namespace: CURRENT_NEW_BA_NAMESPACE,
      bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
    });
    const validReceipt = await reader({ profile_id: PROFILE_ID, assessment });
    const mismatchedAssessment = clone(assessment);
    mismatchedAssessment.assessment_id = `${ASSESSMENT_ID}-mismatched`;
    await store.set(`business_assessment:${ASSESSMENT_ID}`, JSON.stringify(mismatchedAssessment));
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: async () => true,
      ownerReader: async () => ({ profile_id: PROFILE_ID, recipient_email: 'avery.collins@example.test' }),
      profileStateReader: async () => ({ bos: 'ready', ba: 'pending' }),
      currentNewBaReadinessReader: async () => validReceipt,
      clock: () => Date.parse(RUNTIME_AT),
    });
    await assert.rejects(
      binder({ profile_id: PROFILE_ID, cookie_header: 'synthetic' }),
      /completed_bos_and_business_assessment_required/u,
    );
    assert.equal(
      [...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)),
      false,
    );
  });

  for (const [label, mutate] of [
    ['synthetic source', (record) => { record.artifact.source_kind = 'AUTHORIZED_SYNTHETIC_GENERALIZATION_PROOF'; }],
    ['zero-call accounting', (record) => { record.artifact.provider_accounting.calls = 0; record.provider_accounting.calls = 0; }],
    ['cassette projection drift', (record) => { record.artifact.cassette_binding.vertical_id = 'other_vertical'; }],
    ['lineage content drift', (record) => { record.artifact.plan_135.goal.title = 'Unbound synthetic plan mutation'; }],
  ]) {
    await t.test(`${label} is rejected by the internal readiness reader`, async () => {
      const store = new MemoryPublicStore();
      const assessment = currentAveryAssessment();
      const envelope = clone(completedCurrentAveryEnvelope({ assessment }));
      mutate(envelope);
      envelope.artifact_sha256 = sha256Stable(envelope.artifact);
      envelope.completeness.artifact_sha256 = envelope.artifact_sha256;
      await seedCurrentAveryCustody(store, { assessment, envelope });
      const reader = createCurrentNewBaMembershipReadinessReader({
        store,
        namespace: CURRENT_NEW_BA_NAMESPACE,
        bosNamespace: CURRENT_NEW_BOS_NAMESPACE,
      });
      await assert.rejects(
        reader({ profile_id: PROFILE_ID, assessment }),
        /paid_current_new_ba_readiness_reconciliation_required/u,
      );
      assert.equal([...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)), false);
    });
  }
});
