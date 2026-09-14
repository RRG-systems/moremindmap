import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildCustomerConfirmedVerticalBinding } from '../api/business-assessment/verticalBinding.js';
import { normalizeGovernedAssessmentRecord } from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { classifyNewBaCompatibility } from '../api/engine/newBaProductionReadinessV1/compatibility.js';
import { NEW_BA_BOS_FUSION_PROOF_CONTRACT, projectBosFusionAuthorityFromArtifact } from '../api/engine/newBaProductionReadinessV1/fusionContract.js';
import { buildLaunchSafeNewBaEnvelope } from '../api/engine/newBaProductionReadinessV1/launchSafeRealizationStore.js';
import { buildNewBaRealizationIdentityV3 } from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import {
  createScopedLoanOriginatorGenerationContext,
  prepareScopedLoanOriginatorAssessment,
} from '../api/engine/newBaProductionReadinessV1/scopedLoanOriginatorGeneration.js';
import { sha256Stable } from '../api/engine/newBaProductionReadinessV1/stable.js';
import { buildLaunchSafeRealizationEnvelope as buildLaunchSafeNewBosEnvelope } from '../api/engine/newBosProductionReadinessV1/launchSafeRealizationStore.js';
import { buildNewBosRealizationIdentity } from '../api/engine/newBosProductionReadinessV1/realizationIdentity.js';
import { adaptCanonicalProfileToNewBosRawEvidence } from '../api/engine/newBosProductionReadinessV1/canonicalAdapter.js';
import { classifyNewBosCompatibility } from '../api/engine/newBosProductionReadinessV1/compatibility.js';
import {
  fullPersonQaAssessmentDigest,
  fullPersonQaBaRealizationIdDigest,
  fullPersonQaBosRealizationIdDigest,
  fullPersonQaCustodySha256,
  fullPersonQaProfileDigest,
  fullPersonQaSyntheticProvenance,
  fullPersonQaSyntheticProvenanceSha256,
  fullPersonQaVerticalAuthoritySha256,
  issueFullPersonQaCapability,
  verifyFullPersonQaCapability,
} from '../api/engine/subscriptionV1/fullPersonQaAccess.js';
import {
  authenticateSyntheticQaRuntimeRequest,
  syntheticQaAccessContext,
  syntheticQaRuntimeCustodySnapshot,
  syntheticQaRuntimeEnabled,
} from '../api/engine/subscriptionV1/syntheticQaRuntimeAuth.js';
import {
  createSyntheticQaCustodyReaders,
  createSyntheticQaProviderBoundary,
  createSyntheticQaSubscriptionV1RuntimeComposition,
  resolveSyntheticQaEntitlement,
  resolveSyntheticQaSourceLibrary,
  syntheticQaFailureProjection,
  syntheticQaGetProjection,
  syntheticQaProviderEnabled,
} from '../api/engine/subscriptionV1/syntheticQaRuntimeComposition.js';
import {
  assertSyntheticQaBusinessScope,
  syntheticQaCapabilityStateKey,
  syntheticQaRuntimeKeys,
  syntheticQaRuntimeRelationshipKey,
} from '../api/engine/subscriptionV1/syntheticQaRuntimeInfrastructure.js';
import {
  createPaidSubscriberLoader,
  projectCompletedRealProfileToSubscription,
  resolvePaidSourceLibrary,
} from '../api/engine/subscriptionV1/paidSubscriberLoader.js';
import {
  pinnedLoanOriginatorSubscriptionSources,
  pinnedSubscriptionSources,
} from '../api/engine/subscriptionV1/pinnedSources.js';
import { redactPaidRuntimePayload } from '../api/engine/subscriptionV1/paidRuntimeHandler.js';
import { authenticatePaidRuntimeRequest } from '../api/engine/subscriptionV1/paidRuntimeAuth.js';
import { paidRuntimeRelationshipKey } from '../api/engine/subscriptionV1/paidRuntimeInfrastructure.js';
import { createPaidMembershipBinder, PAID_MEMBERSHIP_NAMESPACE } from '../api/stripe/paidMembership.js';
import { createCurrentNewBaMembershipReadinessReader } from '../api/stripe/paidMembershipReadiness.js';
import { createSubscriptionV1RuntimeEntry } from '../api/internal/subscription-v1-runtime.js';
import {
  PRODUCTION_BA_CASSETTE_REGISTRY,
  buildCustomerConfirmedSelection,
} from '../src/lib/baVerticalCassettesV1/index.js';
import { hashCanonicalJson } from '../src/lib/intelligenceFabric/hashing.js';
import { createCanonicalProfileOwnerReader } from '../src/lib/publicSiteAirlockV1/canonicalProfileOwnerReader.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import {
  createProfileOwnershipAdapter,
  profileOwnerCookie,
  resolveProfileOwnershipAudience,
} from '../src/lib/publicSiteAirlockV1/profileOwnership.js';
import {
  SYNTHETIC_FIXTURES,
  assembleRealizedSurfaceRendering,
  auditHumanRealization,
  buildPersonalityDnaRuntime,
  createHumanRealization,
} from '../src/lib/newBosPersonalityDnaV1/index.js';
import { attachCustomerTopProjection } from '../src/lib/newBosPersonalityDnaV1/topProjection.js';
import { InMemoryLivingRelationshipStore } from '../src/lib/subscriptionV1/afw05/store.js';
import { InMemoryAllowanceSessionLedger } from '../src/lib/subscriptionV1/sessionLedger.js';

const NOW = new Date('2026-09-13T18:00:00.000Z');
const PROFILE_IDS = Object.freeze([
  'mm-20260913-a1b2c3d4',
  'mm-20260913-b2c3d4e5',
  'mm-20260913-c3d4e5f6',
  'mm-20260913-d4e5f6g7',
]);
const PROFILE_ID = PROFILE_IDS[0];
const ASSESSMENT_IDS = Object.freeze([
  'ba-20260913-aabbccdd',
  'ba-20260913-00000001',
  'ba-20260913-00000002',
  'ba-20260913-00000003',
]);
const ASSESSMENT_ID = ASSESSMENT_IDS[0];
const REALIZATION_PROFILE_ID = PROFILE_ID.toUpperCase();
const NEW_BA_NAMESPACE = 'preview:new-ba:synthetic-full-person-qa-v1';
const NEW_BOS_NAMESPACE = 'preview:new-bos:synthetic-full-person-qa-v1';
const CREATED_AT = '2026-09-13T17:05:00.000Z';
const DIGEST_KEY = 'synthetic-runtime-auth-digest-key-for-tests-0000000000000001';
const SIGNING_KEY = 'synthetic-runtime-auth-signing-key-for-tests-000000000000001';
const TOKEN = 'Q'.repeat(43);
const CASE_IDS = Object.freeze([
  'COHORT-V1-RE-A',
  'COHORT-V1-RE-B',
  'COHORT-V1-LO-A',
  'COHORT-V1-LO-B',
]);
const PERSON_NAMES = Object.freeze([
  'Avery Synthetic',
  'Blair Synthetic',
  'Casey Synthetic',
  'Devon Synthetic',
]);
const authorityIdForCase = (caseId) => `synthetic_qa_runtime_person_${CASE_IDS.indexOf(caseId) + 1}`;
const syntheticProvenanceForCase = (caseId) => fullPersonQaSyntheticProvenance({
  authority_id: authorityIdForCase(caseId),
  case_id: caseId,
});
// Mechanically stripped copies of the two frozen LO native-input maps. They
// contain fictional offline assessment evidence only; no generated artifacts,
// provider assignment, credential, registered Profile, or customer state.
const LO_NATIVE_FIXTURES = JSON.parse(fs.readFileSync(
  new URL('./fixtures/subscriptionV1SyntheticQaLoanOriginatorNativeInputs.json', import.meta.url),
  'utf8',
));
const digest = (label) => hashCanonicalJson({ label });
const clone = (value) => JSON.parse(JSON.stringify(value));

class MemoryRedis {
  constructor() {
    this.values = new Map();
    this.reads = [];
    this.readCounts = new Map();
    this.readHooks = new Map();
  }

  async get(key) {
    this.reads.push(key);
    const count = (this.readCounts.get(key) || 0) + 1;
    this.readCounts.set(key, count);
    const value = this.values.get(key) ?? null;
    this.readHooks.get(`${key}:${count}`)?.({ redis: this, key, value });
    return value;
  }

  afterRead(key, count, callback) {
    this.readHooks.set(`${key}:${count}`, callback);
  }
}

function request(cookie = '') {
  return {
    method: 'GET',
    headers: {
      host: 'subscription-canary.example.test',
      origin: 'https://subscription-canary.example.test',
      'x-forwarded-proto': 'https',
      'x-vercel-forwarded-for': '203.0.113.24',
      'x-forwarded-for': '203.0.113.24',
      'user-agent': 'Synthetic QA runtime test browser',
      ...(cookie ? { cookie } : {}),
    },
    socket: {},
  };
}

function manifest() {
  return JSON.stringify(runtimeFixtures().map((fixture) => {
    const selected = {
      vertical_id: fixture.verticalId,
      vertical_authority_sha256: fullPersonQaVerticalAuthoritySha256(
        fixture.governedAssessment.vertical_binding,
      ),
      vertical_binding_sha256: fixture.governedAssessment.vertical_binding.binding_sha256,
      canonical_profile_artifact_sha256: sha256Stable(fixture.profile),
      bos_canonical_source_sha256: fixture.bos.canonical_source_sha256,
      assessment_evidence_sha256: fixture.governedAssessment.evidence_sha256,
      ba_realization_identity_sha256: fixture.ba.realization_identity.sha256,
      ba_artifact_sha256: fixture.ba.artifact_sha256,
      ba_envelope_sha256: sha256Stable(fixture.ba),
      bos_realization_identity_sha256: fixture.bos.realization_identity.sha256,
      bos_artifact_sha256: fixture.bos.artifact_sha256,
      bos_envelope_sha256: sha256Stable(fixture.bos),
    };
    const entry = {
      authority_id: authorityIdForCase(fixture.caseId),
      case_id: fixture.caseId,
      profile_digest: fullPersonQaProfileDigest(fixture.profileId, DIGEST_KEY),
      assessment_digest: fullPersonQaAssessmentDigest(fixture.assessmentId, DIGEST_KEY),
      ...selected,
      ba_realization_id_digest: fullPersonQaBaRealizationIdDigest(fixture.ba.realization_id, DIGEST_KEY),
      bos_realization_id_digest: fullPersonQaBosRealizationIdDigest(fixture.bos.realization_id, DIGEST_KEY),
      expires_at: '2026-09-30T00:00:00.000Z',
      status: 'active',
      synthetic_provenance_sha256: fullPersonQaSyntheticProvenanceSha256(
        fixture.profile.synthetic_qa_provenance,
      ),
    };
    return { ...entry, custody_sha256: fullPersonQaCustodySha256(entry) };
  }));
}

function environment(overrides = {}) {
  return {
    PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED: 'true',
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST: manifest(),
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_DIGEST_KEY: DIGEST_KEY,
    MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_SIGNING_KEY: SIGNING_KEY,
    NEW_BA_DERIVED_NAMESPACE: NEW_BA_NAMESPACE,
    NEW_BA_BOS_NAMESPACE: NEW_BOS_NAMESPACE,
    ...overrides,
  };
}

function assessmentRecord({
  profileId = PROFILE_ID,
  assessmentId = ASSESSMENT_ID,
  variant = 0,
  caseId = CASE_IDS[variant],
} = {}) {
  const registration = PRODUCTION_BA_CASSETTE_REGISTRY.resolveVertical('real_estate');
  const selection = buildCustomerConfirmedSelection(registration);
  return {
    owner_profile_id: profileId,
    assessment_id: assessmentId,
    status: 'complete',
    version: 'business_assessment_v1_intake',
    assessment_type: 'real_estate_agent',
    synthetic_qa_provenance: syntheticProvenanceForCase(caseId),
    created_at: '2026-09-13T17:00:00.000Z',
    updated_at: '2026-09-13T17:05:00.000Z',
    vertical_binding: buildCustomerConfirmedVerticalBinding({
      selection,
      selectedAt: '2026-09-13T17:00:00.000Z',
    }),
    inputs: {
      answers: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [
        `q${index + 1}`,
        `Governed synthetic evidence ${variant + 1} for question ${index + 1}`,
      ])),
    },
  };
}

let cachedScopedLoanOriginatorContext;
function scopedLoanOriginatorContext() {
  cachedScopedLoanOriginatorContext ||= createScopedLoanOriginatorGenerationContext();
  return cachedScopedLoanOriginatorContext;
}

function loanOriginatorAssessmentRecord({ profileId, assessmentId, caseId }) {
  assert.equal(LO_NATIVE_FIXTURES.contract_id,
    'subscription-v1-synthetic-qa-lo-native-input-fixtures-v1');
  assert.equal(LO_NATIVE_FIXTURES.data_status, 'FICTIONAL_OFFLINE_TEST_FIXTURE_ONLY');
  const mapping = LO_NATIVE_FIXTURES.cases.find(({ case_id: candidate }) => candidate === caseId);
  assert.ok(mapping, `missing offline Loan Originator mapping for ${caseId}`);
  assert.equal(hashCanonicalJson(mapping.native_inputs), mapping.native_inputs_sha256,
    `${caseId} offline Loan Originator native input custody drift`);
  const prepared = prepareScopedLoanOriginatorAssessment({
    profileId: profileId.toUpperCase(),
    assessmentId,
    createdAt: CREATED_AT,
    nativeInputs: clone(mapping.native_inputs),
  }, scopedLoanOriginatorContext());
  return {
    ...prepared,
    synthetic_qa_provenance: syntheticProvenanceForCase(caseId),
  };
}

function normalizeFixtureAssessment(record, profileId, verticalId) {
  return normalizeGovernedAssessmentRecord(
    record,
    profileId.toUpperCase(),
    verticalId === 'loan_originator'
      ? scopedLoanOriginatorContext()
      : {},
  );
}

function canonicalProfileRecord(profileId = PROFILE_ID, personName = PERSON_NAMES[0], variant = 0) {
  const caseId = CASE_IDS[variant];
  return {
    profile_id: profileId,
    person_name: personName,
    created_at: '2026-09-13T16:00:00.000Z',
    synthetic_qa_provenance: syntheticProvenanceForCase(caseId),
    canonical_profile_json: {
      profile_id: profileId,
      person_name: personName,
      vector_scores: {
        vector: 0.82 - (variant * 0.02),
        velocity: 0.71 + (variant * 0.01),
        signal: 0.66 + (variant * 0.02),
        fidelity: 0.74 - (variant * 0.01),
        framework: 0.62 + (variant * 0.01),
        flex: 0.69 - (variant * 0.01),
        leverage: 0.77 + (variant * 0.01),
        horizon: 0.81 - (variant * 0.02),
      },
      intake_answers: [{
        question_id: 'q01',
        question_text: 'What matters in this fictional scenario?',
        question_type: 'text',
        answer_text: `Clear decision ownership in fictional scenario ${variant + 1}.`,
      }],
    },
  };
}

function completedBosEnvelope(profile = canonicalProfileRecord()) {
  const realizationProfileId = String(profile.profile_id).toUpperCase();
  const fixture = SYNTHETIC_FIXTURES.find(({ fixture_id: fixtureId }) => fixtureId === 'mosaic');
  const rawEvidence = adaptCanonicalProfileToNewBosRawEvidence({
    envelope: profile,
    expectedProfileId: realizationProfileId,
  });
  const interpretationDraft = clone(fixture.interpretationDraft);
  const bindDraftEvidence = (value) => {
    if (Array.isArray(value)) {
      value.forEach(bindDraftEvidence);
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'evidence_refs' && Array.isArray(child)) value[key] = ['q01'];
      else if (key === 'counterevidence_refs' && Array.isArray(child)) value[key] = child.length ? ['q01'] : [];
      else bindDraftEvidence(child);
    }
  };
  bindDraftEvidence(interpretationDraft);
  const seeded = buildPersonalityDnaRuntime({ rawEvidence, interpretationDraft });
  const surfacePackets = seeded.surface_packets.map((packet) => {
    const customerProse = `The governed meaning for ${packet.label} remains bounded to this fake fixture and its evidence.\n\nA second paragraph preserves the complete launch-safe rendering contract.`;
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
        profileId: realizationProfileId,
        subjectToken: seeded.subject_token,
      }),
    };
  });
  const artifact = attachCustomerTopProjection({ ...seeded, surface_packets: surfacePackets });
  const canonicalSourceSha256 = rawEvidence.generation_metadata.canonical_source_sha256;
  const compatibility = classifyNewBosCompatibility(rawEvidence);
  const realizationIdentity = buildNewBosRealizationIdentity({
    profileId: realizationProfileId,
    canonicalSourceSha256,
    rawEvidenceVersion: rawEvidence.version,
    providerModel: 'gpt-5.6-sol',
    compatibilityClass: compatibility.class,
  });
  const envelope = buildLaunchSafeNewBosEnvelope({
    profileId: realizationProfileId,
    realizationIdentity,
    artifact,
    compatibility,
    providerAccounting: { calls: 0, store: false },
    createdAt: CREATED_AT,
  });
  return {
    ...envelope,
    synthetic_qa_provenance: clone(profile.synthetic_qa_provenance),
  };
}

function fusionAuthorityFor(bosEnvelope) {
  return projectBosFusionAuthorityFromArtifact({
    artifact: bosEnvelope.artifact,
    profileId: bosEnvelope.profile_id,
    realizationId: bosEnvelope.realization_id,
    artifactSha256: bosEnvelope.artifact_sha256,
    realizationVersion: bosEnvelope.realization_identity.version,
  });
}

function customerViewModel({ personName, verticalId, variant }) {
  const roles = ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future'];
  const loanOriginator = verticalId === 'loan_originator';
  const verticalLabel = loanOriginator ? 'Loan Originator' : 'Real Estate';
  const firstName = personName.split(' ')[0];
  const goalTitle = loanOriginator
    ? 'Build a steadier fictional origination practice'
    : 'Build a transferable fictional company';
  return {
    identity: { firstName, business: `${firstName} Synthetic Practice`, vertical: verticalLabel },
    vertical: { state: 'CUSTOMER_CONFIRMED', vertical_id: verticalId, label: verticalLabel },
    hero: { eyebrow: `${firstName}’s Business Twin`, title: `A governed fictional business map ${variant + 1}`, subtitle: 'Current and evidence-bound.', modelDate: 'Sep 13, 2026' },
    layerContract: { stop_after: 2, layer_3_exists: false },
    layer0: { cards: [{ id: 'plan', value: loanOriginator ? 'Plan remains open' : 'Plan ready' }, { id: 'evidence', value: 'Evidence ready', items: [{ label: 'Things we know', value: 2 }] }] },
    destinations: {
      where: { headline: `Current fictional ${loanOriginator ? 'origination' : 'operating'} reality` },
      futures: { items: roles.map((role) => ({ role, title: role.replaceAll('_', ' '), probability: 20 })) },
      move: { headline: loanOriginator ? 'Run one bounded relationship-system test' : 'Create visible decision ownership' },
      plan: {
        headline: loanOriginator ? 'Plan remains open for customer agreement' : 'Transfer routine decisions',
        goal: { title: goalTitle },
        ways: loanOriginator
          ? Array.from({ length: 3 }, () => ({ status: 'OPEN', title: null }))
          : [
              { status: 'SELECTED_COMPLETE', title: 'Clarify ownership' },
              { status: 'OPEN', title: null },
              { status: 'OPEN', title: null },
            ],
        strategies: loanOriginator
          ? []
          : Array.from({ length: 5 }, (_, index) => ({ title: `Strategy ${index + 1}` })),
        ...(loanOriginator ? {
          planState: 'LO_OPEN_DRAFT',
          openStrategyPositions: 15,
          completion: { goal: true, way1: false, way2: false, way3: false },
        } : {}),
      },
      evidence: { categories: [{ id: 'known', label: 'Known', value: 2 }] },
    },
    objects: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`object-${index + 1}`, { title: `Fictional inspectable object ${variant + 1}.${index + 1}` }])),
  };
}

function loanOriginatorOpenPlan({ profileId, personName }) {
  const verticalAuthorityRefs = Object.keys(
    scopedLoanOriginatorContext().generationContext.authority_hashes,
  ).sort();
  const oneMoveTitle = 'Run one bounded fictional relationship-system test';
  return {
    contract_id: 'generalized-1-3-5-plan-v1',
    version: '1.0.0',
    plan_state: 'LO_OPEN_DRAFT',
    identity: {
      subject_key: profileId,
      business: `${personName.split(' ')[0]} Synthetic Practice`,
      vertical: 'Loan Originator',
    },
    bindings: {
      verticalId: 'loan_originator',
      subjectKey: profileId,
      verticalAuthorityRefs,
      probability_contract: 'five-futures-probability-v1',
      probability_role_order: ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future'],
      one_move_title: oneMoveTitle,
      constraint_title: 'The fictional operating constraint remains a hypothesis.',
    },
    goal: {
      goal_id: 'goal-1',
      title: 'Build a steadier fictional origination practice',
      monthly_display: null,
      annual_display: null,
      horizon: 'The stated fictional goal horizon from governed offline evidence.',
      epistemic_class: 'DESIRED_STATE_NOT_CURRENT_PERFORMANCE',
      source_ref: 'offline-lo-goal-source',
      current_gap: [],
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
      status: 'ALONGSIDE_PLAN_NOT_A_STRATEGY',
      title: oneMoveTitle,
      intervention: 'Test one fictional relationship cadence without claiming it is the customer plan.',
      why_alongside: 'The One Move is a proposal to discuss. Business strategies and any commitment to act remain open.',
      proof_boundary: 'Effectiveness must be observed through the stated proof and failure conditions.',
      source_ref: 'offline-lo-one-move-source',
      proposal_status: 'PROPOSED_NOT_CUSTOMER_AGREED',
      first_action: { text: 'Choose one fictional relationship cohort.', source_ref: 'offline-lo-first-action-source' },
      proof: [{ text: 'The bounded fictional cadence is completed as defined.', source_ref: 'offline-lo-proof-source' }],
      failure_or_stop: ['Stop if the fictional evidence contradicts the proposed mechanism.'],
    },
    customer_boundary: {
      proposed_plan_not_customer_commitment: true,
      customer_agreed: false,
      all_ways_intentionally_open: true,
      ways_two_three_intentionally_open: true,
      build_the_rest_myself: true,
      living_map_bridge_explanatory_only: true,
      subscription_runtime_active: false,
    },
    validation: {
      goal_count: 1,
      way_socket_count: 3,
      selected_way_count: 0,
      strategy_count: 0,
      open_strategy_positions: 15,
      one_move_outside_strategy_count: true,
      source_and_class_preservation: 'PASS',
    },
  };
}

function completedBaArtifact({ assessment, bosEnvelope, personName, variant, verticalId }) {
  const profileId = bosEnvelope.profile_id;
  const assessmentId = assessment.assessment_id;
  const governedAssessment = normalizeFixtureAssessment(assessment, profileId, verticalId);
  const verticalBinding = governedAssessment.vertical_binding;
  const bosAuthority = fusionAuthorityFor(bosEnvelope);
  const wholeBusinessModelSha256 = digest(`synthetic-runtime-auth-whole-business-model:${profileId}`);
  const fiveFuturesSha256 = digest(`synthetic-runtime-auth-five-futures:${profileId}`);
  const oneMoveSha256 = digest(`synthetic-runtime-auth-one-move:${profileId}`);
  const viewModel = customerViewModel({ personName, verticalId, variant });
  const futures = ['current_course', 'emerging_future', 'better_future', 'bold_future', 'downside_future']
    .map((futureRole, index) => ({
      future_role: futureRole,
      title: futureRole.replaceAll('_', ' '),
      business_state_if_realized: `Conditional fake business state ${index + 1}`,
      conditionality: `If fake condition ${index + 1} holds`,
      normalized_relative_support_weight: 20,
      certainty_support_classification: 'SUPPORTED_HYPOTHESIS',
      leading_indicators: [`Fake indicator ${index + 1}`],
      risks: [`Fake risk ${index + 1}`],
      assumptions: [`Fake assumption ${index + 1}`],
      falsifiers: [`Fake falsifier ${index + 1}`],
    }));
  const plan = verticalId === 'loan_originator'
    ? loanOriginatorOpenPlan({ profileId, personName })
    : {
    contract_id: 'generalized-1-3-5-plan-v1',
    version: '1.0.0',
    goal: { title: 'Build a transferable fictional company' },
    ways: [
      { way_id: 'way-1', status: 'SELECTED_COMPLETE', title: 'Clarify ownership', strategies: [] },
      { way_id: 'way-2', status: 'OPEN', title: null, strategies: [] },
      { way_id: 'way-3', status: 'OPEN', title: null, strategies: [] },
    ],
    strategies: Array.from({ length: 5 }, (_, index) => ({ title: `Strategy ${index + 1}` })),
  };
  const cassetteBinding = {
    vertical_id: verticalBinding.vertical_id,
    cassette_id: verticalBinding.cassette_id,
    cassette_version: verticalBinding.cassette_version,
    projection_contract_id: verticalBinding.box_1_projection_contract_id,
    projection_contract_version: verticalBinding.box_1_projection_contract_version,
    projection_contract_sha256: verticalBinding.box_1_projection_contract_sha256,
    adapter_id: verticalBinding.box_1_projection_adapter_id,
    binding_sha256: verticalBinding.binding_sha256,
  };
  const artifactBase = {
    contract_id: 'new-ba-production-realization-v2',
    version: '2.0.0',
    profile_id: profileId,
    assessment_id: assessmentId,
    source_kind: 'SAVED_BUSINESS_ASSESSMENT',
    authority: { status: 'FROZEN' },
    business_reality: {
      version: '1.0.0',
      state_hash: wholeBusinessModelSha256,
      assessment_identity: {
        assessment_id: assessmentId,
        owner_profile_id: profileId,
        vertical: verticalBinding.vertical_id,
        vertical_binding: clone(verticalBinding),
      },
      frozen_whole_person_authority: {
        profile_id: profileId,
        bos_version: bosAuthority.source_version,
        bos_hash: bosEnvelope.artifact_sha256,
        selected_claim_refs: bosAuthority.claims.map((claim) => claim.claim_ref),
      },
      business_model: { value_creation: 'Fake specialist advisory work', leverage: 'A fake delivery team' },
      current_business_reality: { summary: 'Fake founder-centered delivery' },
      governed_business_evidence: [{ domain: 'operations', value: 'Routine fake decisions return to the founder.' }],
      domain_states: [{
        domain_id: 'operations',
        claims: [
          { meaning: 'Routine fake decisions return to the founder.', epistemic_class: 'KNOWN' },
          { meaning: 'Clear ownership may reduce delay.', epistemic_class: 'SUPPORTED_HYPOTHESIS' },
        ],
      }],
      causal_model: { mechanisms: [{ underlying_mechanism: 'Fake decision rights remain implicit.' }] },
      governing_constraint: { candidate: 'Implicit decision rights', falsifier: 'Managers own routine decisions without rescue.' },
      assets: [{ meaning: 'Fake client trust' }],
      vulnerabilities: [{ meaning: 'Fake founder approval delay' }],
      epistemic_state: {
        missing_evidence: [{ question: 'How often do fake managers decide without escalation?' }],
        contradictions: [{ statement: 'Some fake delivery decisions already stay with the team.' }],
        counterevidence: ['The fake team has resolved some client issues.'],
        mind_change_conditions: ['Observed independent ownership over four weeks.'],
      },
      ...(verticalId === 'loan_originator' ? {
        source_integrity: {
          authority_hashes: clone(scopedLoanOriginatorContext().generationContext.authority_hashes),
        },
      } : {}),
    },
    five_futures: { version: '2.0.0', artifact_hash: fiveFuturesSha256, support_semantics: 'Conditional relative support totaling 100.', futures },
    one_move: {
      version: '2.0.0',
      artifact_hash: oneMoveSha256,
      primary_mechanism_ids: ['mechanism_decision_rights'],
      title: 'Make one fake decision lane explicit',
      intervention: 'Assign routine fake delivery decisions to one named role.',
      why_now: 'A bounded fake ownership test can reveal whether approval delay is causal.',
      execution_definition: 'Publish the fake decision boundary and review exceptions weekly.',
      bounded_execution_steps: ['Choose the lane.', 'Name the owner.', 'Review only defined exceptions.'],
      leading_indicators: ['Share of routine fake decisions made without escalation'],
      success_evidence: ['Fewer routine fake approvals return to the founder'],
      failure_evidence: ['Fake escalations remain unchanged'],
      falsifiers: ['The fake boundary does not change decision flow'],
      stop_or_reconsider_conditions: ['Fake client risk rises materially'],
    },
    plan_135: plan,
    evidence: { categories: [{ id: 'known', label: 'Known', value: 1 }] },
    customer_view_model: viewModel,
    internal_trace: { status: 'COMPLETE' },
    provider_accounting: {
      calls: 0,
      accepted_calls: 0,
      submissions: 0,
      retries: 0,
      receipts: [],
      attempts: [],
      store: false,
      raw_request_persisted: false,
      raw_response_persisted: false,
    },
    lineage: {
      contract_id: 'real-profile-new-ba-lineage-v1',
      version: '1.0.0',
      profile_id: profileId,
      assessment_id: assessmentId,
      business_evidence_sha256: governedAssessment.evidence_sha256,
      vertical_binding_sha256: verticalBinding.binding_sha256,
      vertical_id: verticalBinding.vertical_id,
      cassette_id: verticalBinding.cassette_id,
      cassette_version: verticalBinding.cassette_version,
      bos_authority_sha256: bosEnvelope.artifact_sha256,
      bos_fusion_contract_sha256: bosAuthority.contract_sha256,
      whole_business_model_sha256: wholeBusinessModelSha256,
      five_futures_sha256: fiveFuturesSha256,
      one_move_sha256: oneMoveSha256,
      plan_sha256: sha256Stable(plan),
      customer_projection_sha256: sha256Stable(viewModel),
      provider_response_direct_publication: false,
    },
  };
  const fusionBase = {
    contract_id: NEW_BA_BOS_FUSION_PROOF_CONTRACT,
    version: '1.0.0',
    profile_id: profileId,
    assessment_id: assessmentId,
    bos_authority: {
      realization_id: bosEnvelope.realization_id,
      artifact_sha256: bosEnvelope.artifact_sha256,
      source_version: bosAuthority.source_version,
      fusion_contract_sha256: bosAuthority.contract_sha256,
      evidence_boundary_sha256: bosAuthority.evidence_boundary_sha256,
      claim_count: bosAuthority.claims.length,
    },
    relationships: [{
      relationship_type: 'FEASIBILITY_MODIFIER',
      business_cause_established_by_personality: false,
      execution_adjustment: 'Make the fake boundary concrete and observable.',
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
  const artifact = {
    ...artifactBase,
    cassette_binding: cassetteBinding,
    fusion: { ...fusionBase, proof_sha256: sha256Stable(fusionBase) },
  };
  artifact.lineage.lineage_sha256 = sha256Stable(artifact.lineage);
  return { artifact, governedAssessment };
}

function completedBaEnvelope({ assessment, bosEnvelope, personName, variant, verticalId }) {
  const { artifact, governedAssessment } = completedBaArtifact({
    assessment,
    bosEnvelope,
    personName,
    variant,
    verticalId,
  });
  const bosAuthority = fusionAuthorityFor(bosEnvelope);
  const compatibility = classifyNewBaCompatibility({
    profile_id: bosEnvelope.profile_id,
    assessment_id: assessment.assessment_id,
    business_evidence: governedAssessment,
    bos_authority: {
      compatible: ['A', 'B'].includes(bosEnvelope.compatibility.class),
      sha256: bosEnvelope.artifact_sha256,
      fusion_authority: bosAuthority,
      fusion_contract_sha256: bosAuthority.contract_sha256,
      evidence_boundary_sha256: bosAuthority.evidence_boundary_sha256,
    },
  });
  const identity = buildNewBaRealizationIdentityV3({
    profileId: bosEnvelope.profile_id,
    assessmentId: assessment.assessment_id,
    evidenceSha256: governedAssessment.evidence_sha256,
    bosAuthoritySha256: artifact.lineage.bos_authority_sha256,
    bosFusionContractSha256: artifact.lineage.bos_fusion_contract_sha256,
    bosEvidenceBoundarySha256: artifact.fusion.bos_authority.evidence_boundary_sha256,
    compatibilityClass: compatibility.class,
    verticalBinding: governedAssessment.vertical_binding,
  });
  const envelope = buildLaunchSafeNewBaEnvelope({
    profileId: bosEnvelope.profile_id,
    realizationIdentity: identity,
    artifact,
    compatibility,
    providerAccounting: artifact.provider_accounting,
    createdAt: CREATED_AT,
  });
  return {
    ...envelope,
    synthetic_qa_provenance: clone(assessment.synthetic_qa_provenance),
  };
}

let cachedRuntimeFixtures;
function runtimeFixtures() {
  if (!cachedRuntimeFixtures) {
    cachedRuntimeFixtures = Object.freeze(PROFILE_IDS.map((profileId, variant) => {
      const caseId = CASE_IDS[variant];
      const assessmentId = ASSESSMENT_IDS[variant];
      const personName = PERSON_NAMES[variant];
      const verticalId = variant < 2 ? 'real_estate' : 'loan_originator';
      const profile = canonicalProfileRecord(profileId, personName, variant);
      const assessment = verticalId === 'loan_originator'
        ? loanOriginatorAssessmentRecord({ profileId, assessmentId, caseId })
        : assessmentRecord({ profileId, assessmentId, variant });
      const bos = completedBosEnvelope(profile);
      const ba = completedBaEnvelope({
        assessment,
        bosEnvelope: bos,
        personName,
        variant,
        verticalId,
      });
      const governedAssessment = normalizeFixtureAssessment(assessment, profileId, verticalId);
      return Object.freeze({
        profileId,
        assessmentId,
        caseId,
        verticalId,
        profile,
        assessment,
        governedAssessment,
        ba,
        bos,
      });
    }));
  }
  return cachedRuntimeFixtures;
}

function runtimeFixture() {
  return runtimeFixtures()[0];
}

function seedRuntimeCustody(redis, {
  fixture = runtimeFixture(),
  profile = fixture.profile,
  record = fixture.assessment,
  ba = fixture.ba,
  bos = fixture.bos,
} = {}) {
  const profileId = fixture.profileId;
  const realizationProfileId = profileId.toUpperCase();
  const assessmentId = fixture.assessmentId;
  const profileKey = `vault:profile:${profileId}`;
  const legacyProfileKey = `vault:profile:${profileId.replace(/^mm-/u, 'MM-')}`;
  const assessmentPointerKey = `business_assessment_by_profile:${profileId}`;
  const assessmentKey = `business_assessment:${assessmentId}`;
  const baPointerKey = `${NEW_BA_NAMESPACE}:latest-compatible:${realizationProfileId}`;
  const baArtifactKey = `${NEW_BA_NAMESPACE}:artifact:${realizationProfileId}:${ba.realization_id}`;
  const bosArtifactKey = `${NEW_BOS_NAMESPACE}:artifact:${realizationProfileId}:${bos.realization_id}`;
  redis.values.set(profileKey, JSON.stringify(profile));
  redis.values.set(assessmentPointerKey, assessmentId);
  redis.values.set(assessmentKey, JSON.stringify(record));
  redis.values.set(baPointerKey, ba.realization_id);
  redis.values.set(baArtifactKey, JSON.stringify(ba));
  redis.values.set(bosArtifactKey, JSON.stringify(bos));
  return {
    profileKey,
    legacyProfileKey,
    assessmentPointerKey,
    assessmentKey,
    baPointerKey,
    baArtifactKey,
    bosArtifactKey,
  };
}

function provisionRuntimeAuthority(redis, overrides = {}) {
  const fixture = overrides.fixture || runtimeFixture();
  const token = overrides.token || TOKEN;
  const rawManifest = overrides.rawManifest || manifest();
  const req = request();
  const issued = issueFullPersonQaCapability({
    profile_id: fixture.profileId,
    manifest: rawManifest,
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    req,
    now: NOW,
    token_factory: () => token,
  });
  redis.values.set(
    syntheticQaCapabilityStateKey(issued.capability_hash),
    JSON.stringify(issued.receipt),
  );
  const keys = seedRuntimeCustody(redis, { ...overrides, fixture });
  return {
    req: request(`__Host-more_subscription_full_person_qa=${token}`),
    issued,
    keys,
    rawManifest,
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('synthetic QA runtime is exact-value default-off before cookie or Redis access', async () => {
  assert.equal(syntheticQaRuntimeEnabled({ PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED: 'true' }), true);
  for (const value of [undefined, '', 'TRUE', '1', true]) {
    let reads = 0;
    const result = await authenticateSyntheticQaRuntimeRequest({
      redis: { async get() { reads += 1; throw new Error('must not read'); } },
      req: request(),
      env: { PUBLIC_SUBSCRIPTION_SYNTHETIC_QA_ENABLED: value },
      now: NOW,
    });
    assert.equal(result.status, 404);
    assert.equal(result.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_DEFAULT_OFF');
    assert.equal(reads, 0);
  }
});

test('composition keeps provider spending independently default-off and private', async () => {
  for (const value of [undefined, '', 'true', 'TRUE', '1', true]) {
    assert.equal(syntheticQaProviderEnabled({
      SUBSCRIPTION_V1_SYNTHETIC_QA_PROVIDER_ENABLED: value,
    }), false);
  }
  let transportFactories = 0;
  let guCalls = 0;
  const held = createSyntheticQaProviderBoundary({
    env: {},
    transportFactory: () => { transportFactories += 1; return async () => ({}); },
    guGenerator: async () => { guCalls += 1; return {}; },
  });
  assert.throws(() => held.createTransport(), /PROVIDER_BUDGET_NOT_AUTHORIZED/u);
  await assert.rejects(held.generateGu({}), /PROVIDER_BUDGET_NOT_AUTHORIZED/u);
  assert.equal(transportFactories, 0);
  assert.equal(guCalls, 0);

  const redis = {
    async get() { throw new Error('must not read during composition'); },
    async set() { throw new Error('must not write during composition'); },
    async eval() { throw new Error('must not evaluate during composition'); },
  };
  const composed = createSyntheticQaSubscriptionV1RuntimeComposition({
    redis,
    env: {
      NEW_BA_DERIVED_NAMESPACE: 'preview:new-ba:synthetic-full-person-qa-v1',
      NEW_BA_BOS_NAMESPACE: 'preview:new-bos:synthetic-full-person-qa-v1',
    },
    providerTransportFactory: () => { transportFactories += 1; return async () => ({}); },
    guGenerator: async () => { guCalls += 1; return {}; },
  });
  assert.equal(typeof composed, 'function');
  assert.equal(transportFactories, 0);
  assert.equal(guCalls, 0);

  const publicPayload = redactPaidRuntimePayload({
    ok: true,
    provider: { model: 'hidden-model', assignment: 'hidden-assignment' },
    provider_receipt: { credential: 'hidden-secret' },
    architecture: { source_library: 'hidden-library' },
    stripe_customer_hash: 'a'.repeat(64),
    stripe_subscription_hash: 'b'.repeat(64),
    hero: { subtitle: 'Internal assignment: gpt-5.6-sol via OpenAI.' },
    display: { value: 'Provider model is gpt-5.6-sol.' },
    runtime_notes: [
      'internal assignment: model alpha',
      'routed through Sol',
      'the inference backend is Codex',
      'engine selection is secret-arm-b',
      'Llama 4 Maverick',
      'DeepSeek V3',
      'o3-pro',
      'provider A handled this request',
      'model alpha handled this request',
    ],
    coaching: { message: 'The business model is still being tested.' },
  }, {
    successful_get: true,
    successful_get_projector: syntheticQaGetProjection,
    failure_projector: syntheticQaFailureProjection,
  });
  assert.equal(publicPayload.subscriber.kind, 'SYNTHETIC_QA_SUBSCRIBER');
  assert.equal(publicPayload.entitlement.billing_evidence, false);
  assert.equal(publicPayload.entitlement.stripe_subscription_created, undefined);
  assert.equal(publicPayload.hero.subtitle, 'Private runtime configuration is not exposed.');
  assert.equal(publicPayload.display.value, 'Private runtime configuration is not exposed.');
  assert.equal(publicPayload.runtime_notes, undefined);
  assert.equal(publicPayload.coaching.message, 'The business model is still being tested.');
  const serialized = JSON.stringify(publicPayload);
  for (const forbidden of ['hidden-model', 'hidden-assignment', 'hidden-secret', 'hidden-library', 'stripe_customer_hash', 'stripe_subscription_hash', 'gpt-5.6-sol', 'OpenAI']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('a selected but invalid synthetic QA cookie fails closed instead of falling through', async () => {
  const calls = [];
  const env = environment({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' });
  const entry = createSubscriptionV1RuntimeEntry({
    env,
    getRedis: () => ({ marker: 'redis' }),
    authenticateSyntheticQa: async () => ({
      ok: false,
      status: 401,
      code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_INVALID',
    }),
    authenticateInternal: async () => { calls.push('internal'); return { ok: true }; },
    paidRuntimeFactory: async () => { calls.push('paid'); return async () => {}; },
  });
  const res = response();
  await entry(request('__Host-more_subscription_full_person_qa=malformed'), res);
  assert.deepEqual(calls, []);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, {
    ok: false,
    code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_CAPABILITY_INVALID',
    reentry_required: true,
  });
});

test('opaque capability selects one exact governed Profile and stable isolated scope', async () => {
  const redis = new MemoryRedis();
  const { req, issued } = provisionRuntimeAuthority(redis);
  assert.equal(fullPersonQaCustodySha256({
    ...issued.receipt,
    expires_at: issued.receipt.authority_expires_at,
    status: 'active',
  }), issued.receipt.custody_sha256);
  const directVerification = verifyFullPersonQaCapability({
    req,
    receipt: JSON.stringify(issued.receipt),
    manifest: manifest(),
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    now: NOW,
  });
  assert.equal(directVerification.ok, true, JSON.stringify({ directVerification, receipt: issued.receipt }));
  const result = await authenticateSyntheticQaRuntimeRequest({
    redis,
    req,
    env: environment(),
    now: NOW,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.capability.profile_id, undefined);
  assert.equal(result.capability.subject_key, result.scope.subject_id);
  assert.equal(result.scope.profile_id, PROFILE_ID);
  assert.equal(result.scope.tenant_id, 'synthetic_qa');
  assert.equal(result.membership_verified, false);
  assert.equal(result.capability_verified, true);
  assert.equal(result.capability.synthetic_only, true);
  assert.equal(result.capability.billing_evidence, false);
  assert.equal(result.capability.stripe_subscription_created, false);
  assert.equal(result.membership_context.assessment_id, ASSESSMENT_ID);
  assert.equal(result.membership_context.authority_id, issued.receipt.authority_id);
  assert.equal(result.capability_hash, issued.capability_hash);
  const privateSnapshot = syntheticQaRuntimeCustodySnapshot(result);
  assert.equal(privateSnapshot.profile_id, PROFILE_ID);
  assert.equal(privateSnapshot.assessment_id, ASSESSMENT_ID);
  assert.equal(privateSnapshot.realization_record.realization_id, runtimeFixture().ba.realization_id);
  assert.equal(privateSnapshot.bos_realization_record.realization_id, runtimeFixture().bos.realization_id);
  assert.equal(privateSnapshot.byte_stable_across_reads, true);
  assert.equal(Object.isFrozen(privateSnapshot), true);
  assert.equal(syntheticQaRuntimeCustodySnapshot(result.membership_context), privateSnapshot);
  assert.equal(syntheticQaRuntimeCustodySnapshot(req), privateSnapshot);
  assert.equal(Object.keys(result).includes('custody_snapshot'), false);
  assert.deepEqual(redis.reads, [
    syntheticQaCapabilityStateKey(issued.capability_hash),
    `vault:profile:${PROFILE_ID}`,
    `vault:profile:${PROFILE_ID.replace(/^mm-/u, 'MM-')}`,
    `business_assessment_by_profile:${PROFILE_ID}`,
    `${NEW_BA_NAMESPACE}:latest-compatible:${REALIZATION_PROFILE_ID}`,
    `business_assessment:${ASSESSMENT_ID}`,
    `${NEW_BA_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${runtimeFixture().ba.realization_id}`,
    `${NEW_BOS_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${runtimeFixture().bos.realization_id}`,
    `vault:profile:${PROFILE_ID}`,
    `vault:profile:${PROFILE_ID.replace(/^mm-/u, 'MM-')}`,
    `business_assessment_by_profile:${PROFILE_ID}`,
    `business_assessment:${ASSESSMENT_ID}`,
    `${NEW_BA_NAMESPACE}:latest-compatible:${REALIZATION_PROFILE_ID}`,
    `${NEW_BA_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${runtimeFixture().ba.realization_id}`,
    `${NEW_BOS_NAMESPACE}:artifact:${REALIZATION_PROFILE_ID}:${runtimeFixture().bos.realization_id}`,
  ]);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /PAID_STRIPE|stripe_customer|stripe_subscription_hash|provider|model|fake inspectable object|canonical_profile_artifact_sha256/iu);
});

test('the exact four cohort authenticates and projects concrete offline Profile, assessment, BOS, and BA custody', async () => {
  const fixtures = runtimeFixtures();
  assert.equal(fixtures.length, 4);
  assert.deepEqual(fixtures.map(({ caseId }) => caseId), CASE_IDS);
  assert.deepEqual(fixtures.map(({ verticalId }) => verticalId), [
    'real_estate',
    'real_estate',
    'loan_originator',
    'loan_originator',
  ]);
  assert.equal(new Set(fixtures.map(({ profileId }) => profileId)).size, 4);
  assert.equal(new Set(fixtures.map(({ assessmentId }) => assessmentId)).size, 4);
  assert.equal(new Set(fixtures.map(({ ba }) => ba.realization_id)).size, 4);
  assert.equal(new Set(fixtures.map(({ bos }) => bos.realization_id)).size, 4);
  assert.equal(PRODUCTION_BA_CASSETTE_REGISTRY.hasVertical('loan_originator'), false);

  const rows = JSON.parse(manifest());
  assert.equal(rows.length, 4);
  assert.equal(rows.some((row) => JSON.stringify(row).includes('placeholder')), false);

  for (const [index, fixture] of fixtures.entries()) {
    const redis = new MemoryRedis();
    const token = String.fromCharCode('R'.charCodeAt(0) + index).repeat(43);
    const { req, issued } = provisionRuntimeAuthority(redis, { fixture, token });
    const auth = await authenticateSyntheticQaRuntimeRequest({
      redis,
      req,
      env: environment(),
      now: NOW,
    });
    assert.equal(auth.ok, true, `${fixture.caseId}: ${JSON.stringify(auth)}`);
    assert.equal(auth.scope.profile_id, fixture.profileId);
    assert.equal(auth.membership_context.assessment_id, fixture.assessmentId);
    assert.equal(auth.membership_context.authority_id, issued.receipt.authority_id);

    const snapshot = syntheticQaRuntimeCustodySnapshot(auth);
    assert.equal(snapshot.profile_id, fixture.profileId);
    assert.equal(snapshot.assessment_id, fixture.assessmentId);
    assert.equal(snapshot.assessment.vertical_binding.vertical_id, fixture.verticalId);
    assert.equal(snapshot.realization_record.realization_id, fixture.ba.realization_id);
    assert.equal(snapshot.bos_realization_record.realization_id, fixture.bos.realization_id);
    assert.equal(snapshot.realization_record.provider_accounting.calls, 0);
    assert.equal(snapshot.bos_realization_record.provider_accounting.calls, 0);
    if (fixture.verticalId === 'loan_originator') {
      assert.equal(snapshot.assessment.typed_evidence.field_count, 145);
      assert.equal(snapshot.realization_record.completeness.status, 'PASS_WITH_OPEN_PLAN');
      assert.equal(snapshot.realization_record.artifact.plan_135.plan_state, 'LO_OPEN_DRAFT');
      assert.equal(snapshot.realization_record.artifact.plan_135.strategies.length, 0);
    } else {
      assert.equal(snapshot.realization_record.completeness.status, 'PASS');
    }

    const readCount = redis.reads.length;
    const readers = createSyntheticQaCustodyReaders();
    const [profileLookup, realizationRecord, bosRealizationRecord] = await Promise.all([
      readers.readCanonicalProfile({ membership_context: auth.membership_context }),
      readers.readCompletedRealization({
        profile_id: fixture.profileId,
        membership_context: auth.membership_context,
      }),
      readers.readCompletedBosRealization({
        profile_id: fixture.profileId,
        realization_id: fixture.bos.realization_id,
        membership_context: auth.membership_context,
      }),
    ]);
    const projection = projectCompletedRealProfileToSubscription({
      scope: auth.scope,
      assessment_id: fixture.assessmentId,
      profile_lookup: profileLookup,
      realization_record: realizationRecord,
      bos_realization_record: bosRealizationRecord,
      assertBusinessScope: assertSyntheticQaBusinessScope,
      synthetic_only: true,
      scope_authority_id: auth.membership_context.authority_id,
    });
    assert.equal(projection.synthetic_only, true);
    assert.equal(projection.doctrine_vertical_id,
      fixture.verticalId === 'loan_originator' ? 'LOAN_ORIGINATOR' : 'REAL_ESTATE');
    assert.equal(projection.canonical_artifacts.length, 8);
    assert.equal(projection.bos_authority_claim_count, 6);
    const projectedPlan = projection.canonical_artifacts.find(
      ({ artifact_type: artifactType }) => artifactType === 'PLAN_135',
    );
    if (fixture.verticalId === 'loan_originator') {
      assert.equal(projectedPlan.status, 'OPEN_NOT_CUSTOMER_AGREED');
      assert.equal(projectedPlan.validation_status, 'PASS_WITH_OPEN_PLAN');
      assert.equal(projectedPlan.bindings.plan_state, 'LO_OPEN_DRAFT');
      assert.equal(projectedPlan.bindings.customer_plan_status, 'OPEN_NOT_CUSTOMER_AGREED');
      assert.equal(projectedPlan.bindings.customer_plan_complete, false);
      assert.equal(projectedPlan.bindings.vertical_id, 'loan_originator');
      assert.equal(projectedPlan.bindings.completeness_policy, 'SYNTHETIC_QA_RELEASE_4_LO_OPEN_PLAN');
      assert.match(projectedPlan.bindings.vertical_binding_hash, /^[a-f0-9]{64}$/u);
      assert.equal(projectedPlan.payload.customer_boundary.customer_agreed, false);
      assert.notEqual(projectedPlan.status, 'COMPLETE');
      assert.notEqual(projectedPlan.validation_status, 'PASS');
    } else {
      assert.equal(projectedPlan.status, 'COMPLETE');
      assert.equal(projectedPlan.validation_status, 'PASS');
    }
    const sourceLibrary = resolveSyntheticQaSourceLibrary({ projection });
    assert.equal(sourceLibrary.info.status, 'AVAILABLE');
    assert.deepEqual(sourceLibrary.info.namespaces,
      fixture.verticalId === 'loan_originator'
        ? ['more.ba-bible.loan-originator']
        : ['more.ba-bible.real-estate', 'more.dj-field-doctrine.real-estate']);

    const relationshipStore = new InMemoryLivingRelationshipStore();
    let providerTransportFactoryCalls = 0;
    const loadSubscriber = createPaidSubscriberLoader({
      ...readers,
      resolveSubscriberAuthority: (membershipContext) => {
        const resolved = syntheticQaAccessContext({ ok: true, membership_context: membershipContext });
        return { scope: resolved.scope, scope_hash: resolved.scope_hash };
      },
      resolveRuntimeKeys: syntheticQaRuntimeKeys,
      resolveRuntimeRelationshipKey: syntheticQaRuntimeRelationshipKey,
      assertBusinessScope: assertSyntheticQaBusinessScope,
      openRelationshipStore: async () => relationshipStore,
      readExternalEvidenceForRuntime: async () => [],
      createTransport: () => {
        providerTransportFactoryCalls += 1;
        throw new Error('synthetic_qa_provider_must_remain_unopened_during_load');
      },
      resolveSourceLibrary: resolveSyntheticQaSourceLibrary,
      syntheticOnly: true,
      loaderId: 'subscription_v1_exact_full_person_synthetic_qa_runtime_loader_v1',
    });
    let loaded;
    try {
      loaded = await loadSubscriber({
        redis,
        relationship_key: auth.capability.relationship_key,
        subject_key: auth.capability.subject_key,
        membership_context: auth.membership_context,
        session_id: `session_${String(index + 1).padStart(24, '0')}`,
        session_kind: 'FIRST_EVER',
        now: () => CREATED_AT,
      });
    } catch (error) {
      error.message = `${fixture.caseId}: ${error.message}`;
      throw error;
    }
    assert.equal(loaded.current.ok, true, `${fixture.caseId}: ${loaded.current.code}`);
    assert.equal(loaded.architecture.provider_calls_during_load, 0);
    assert.equal(providerTransportFactoryCalls, 0);
    const understanding = loaded.controller.wholeUnderstandingPacket();
    assert.ok(understanding, `${fixture.caseId}: whole understanding unavailable`);
    if (fixture.verticalId === 'loan_originator') {
      const plan = understanding.provider_understanding.plan;
      assert.equal(plan['Plan state'], 'Lo open draft');
      assert.equal(plan['Customer boundary']['Customer agreed'], false);
      assert.equal(plan['Customer boundary']['Proposed plan not customer commitment'], true);
      assert.equal(plan.Strategies.length, 0);
      assert.equal(plan.Validation['Selected way count'], 0);
      assert.doesNotMatch(JSON.stringify(plan), /customer[_ ]agreed["': ]+true/iu);
    }
    assert.equal(redis.reads.length, readCount, `${fixture.caseId} re-read mutable custody after authentication`);
  }
});

test('every canonical record requires exact manifest-bound server-authored synthetic provenance', async () => {
  const fixture = runtimeFixture();
  const alterations = [
    {
      record: 'profile',
      seedKey: 'profile',
      hashField: 'canonical_profile_artifact_sha256',
      mutate(value) { delete value.synthetic_qa_provenance; },
    },
    {
      record: 'assessment',
      seedKey: 'record',
      hashField: null,
      mutate(value) { value.synthetic_qa_provenance.synthetic_only = false; },
    },
    {
      record: 'bos',
      seedKey: 'bos',
      hashField: 'bos_envelope_sha256',
      mutate(value) { value.synthetic_qa_provenance.authority_id = 'synthetic_qa_runtime_mismatched_authority'; },
    },
    {
      record: 'ba',
      seedKey: 'ba',
      hashField: 'ba_envelope_sha256',
      mutate(value) { value.synthetic_qa_provenance.real_customer_state = true; },
    },
  ];
  for (const alteration of alterations) {
    const changedRecord = clone(fixture[alteration.record]);
    alteration.mutate(changedRecord);
    const rows = JSON.parse(manifest());
    const row = rows.find(({ case_id: caseId }) => caseId === fixture.caseId);
    row.synthetic_provenance_sha256 = digest(
      `untrusted-resealed-provenance:${alteration.record}`,
    );
    if (alteration.hashField) row[alteration.hashField] = sha256Stable(changedRecord);
    row.custody_sha256 = fullPersonQaCustodySha256(row);
    const rawManifest = JSON.stringify(rows);
    const redis = new MemoryRedis();
    const { req } = provisionRuntimeAuthority(redis, {
      fixture,
      rawManifest,
      [alteration.seedKey]: changedRecord,
    });
    const denied = await authenticateSyntheticQaRuntimeRequest({
      redis,
      req,
      env: environment({
        MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST: rawManifest,
      }),
      now: NOW,
    });
    assert.equal(denied.status, 409, alteration.record);
    assert.equal(denied.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY', alteration.record);
    assert.equal(syntheticQaRuntimeCustodySnapshot(req), null, alteration.record);
  }
});

test('missing capability and changed or mismatched governed assessment fail closed', async () => {
  const missing = new MemoryRedis();
  const absent = await authenticateSyntheticQaRuntimeRequest({
    redis: missing,
    req: request(),
    env: environment(),
    now: NOW,
  });
  assert.equal(absent.status, 401);
  assert.equal(missing.reads.length, 0);

  const mismatched = new MemoryRedis();
  const record = assessmentRecord();
  record.owner_profile_id = PROFILE_IDS[1];
  const { req } = provisionRuntimeAuthority(mismatched, { record });
  const denied = await authenticateSyntheticQaRuntimeRequest({
    redis: mismatched,
    req,
    env: environment(),
    now: NOW,
  });
  assert.equal(denied.status, 409);
  assert.equal(denied.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY');
  assert.equal(Object.hasOwn(denied, 'scope'), false);
});

test('Profile, assessment, BA, and recorded BOS substitution all return one generic fail-closed result', async (t) => {
  const substitutions = [
    ['Profile', (redis, keys) => {
      const substituted = canonicalProfileRecord(PROFILE_IDS[1]);
      redis.values.set(keys.profileKey, JSON.stringify(substituted));
    }],
    ['legacy Profile alias', (redis, keys) => {
      redis.values.set(keys.legacyProfileKey, JSON.stringify(canonicalProfileRecord()));
    }],
    ['assessment', (redis, keys) => {
      const substituted = clone(runtimeFixture().assessment);
      substituted.inputs.answers.q1 = 'Substituted fake evidence';
      redis.values.set(keys.assessmentKey, JSON.stringify(substituted));
    }],
    ['BA', (redis, keys) => {
      const substituted = clone(runtimeFixture().ba);
      substituted.artifact.customer_view_model.hero.title = 'Substituted fake BA artifact';
      redis.values.set(keys.baArtifactKey, JSON.stringify(substituted));
    }],
    ['BA envelope metadata', (redis, keys) => {
      const substituted = clone(runtimeFixture().ba);
      substituted.created_at = '2026-09-13T17:06:00.000Z';
      redis.values.set(keys.baArtifactKey, JSON.stringify(substituted));
    }],
    ['BA identity version', (redis, keys) => {
      const substituted = clone(runtimeFixture().ba);
      substituted.realization_identity.version = 'new_ba_composite_realization_identity_v2';
      redis.values.set(keys.baArtifactKey, JSON.stringify(substituted));
    }],
    ['BA identity suffix', (redis, keys) => {
      const substituted = clone(runtimeFixture().ba);
      substituted.realization_identity.sha256 = digest('substituted-ba-identity-suffix');
      redis.values.set(keys.baArtifactKey, JSON.stringify(substituted));
    }],
    ['BOS', (redis, keys) => {
      const substituted = clone(runtimeFixture().bos);
      substituted.artifact.identity_context.display_name = 'Substituted Fake BOS';
      redis.values.set(keys.bosArtifactKey, JSON.stringify(substituted));
    }],
    ['BOS envelope metadata', (redis, keys) => {
      const substituted = clone(runtimeFixture().bos);
      substituted.created_at = '2026-09-13T17:06:00.000Z';
      redis.values.set(keys.bosArtifactKey, JSON.stringify(substituted));
    }],
    ['BOS identity version', (redis, keys) => {
      const substituted = clone(runtimeFixture().bos);
      substituted.realization_identity.version = 'new_bos_composite_realization_identity_future';
      redis.values.set(keys.bosArtifactKey, JSON.stringify(substituted));
    }],
    ['BOS identity suffix', (redis, keys) => {
      const substituted = clone(runtimeFixture().bos);
      substituted.realization_identity.sha256 = digest('substituted-bos-identity-suffix');
      redis.values.set(keys.bosArtifactKey, JSON.stringify(substituted));
    }],
  ];
  for (const [label, substitute] of substitutions) {
    await t.test(label, async () => {
      const redis = new MemoryRedis();
      const { req, keys } = provisionRuntimeAuthority(redis);
      substitute(redis, keys);
      const denied = await authenticateSyntheticQaRuntimeRequest({
        redis,
        req,
        env: environment(),
        now: NOW,
      });
      assert.deepEqual(denied, {
        ok: false,
        code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY',
        status: 409,
        failure_class: 'GOVERNED_PROFILE_ASSESSMENT_OR_REALIZATION_UNAVAILABLE',
      });
      assert.equal(syntheticQaRuntimeCustodySnapshot(req), null);
    });
  }
});

test('double-read detects Profile, assessment, BA, and BOS pointer or byte races', async (t) => {
  const races = [
    ['Profile bytes', ({ redis, keys }) => redis.afterRead(keys.profileKey, 1, () => {
      redis.values.set(keys.profileKey, `${redis.values.get(keys.profileKey)} `);
    })],
    ['legacy Profile alias', ({ redis, keys }) => redis.afterRead(keys.legacyProfileKey, 1, () => {
      redis.values.set(keys.legacyProfileKey, JSON.stringify(canonicalProfileRecord()));
    })],
    ['assessment pointer', ({ redis, keys }) => redis.afterRead(keys.assessmentPointerKey, 1, () => {
      redis.values.set(keys.assessmentPointerKey, 'ba-20260913-deadbeef');
    })],
    ['assessment bytes', ({ redis, keys }) => redis.afterRead(keys.assessmentKey, 1, () => {
      redis.values.set(keys.assessmentKey, `${redis.values.get(keys.assessmentKey)} `);
    })],
    ['BA pointer', ({ redis, keys }) => redis.afterRead(keys.baPointerKey, 1, () => {
      redis.values.set(keys.baPointerKey, `new-ba:${REALIZATION_PROFILE_ID}:${ASSESSMENT_ID}:${digest('raced-ba-pointer')}`);
    })],
    ['BA bytes', ({ redis, keys }) => redis.afterRead(keys.baArtifactKey, 1, () => {
      redis.values.set(keys.baArtifactKey, `${redis.values.get(keys.baArtifactKey)} `);
    })],
    ['BOS bytes', ({ redis, keys }) => redis.afterRead(keys.bosArtifactKey, 1, () => {
      redis.values.set(keys.bosArtifactKey, `${redis.values.get(keys.bosArtifactKey)} `);
    })],
  ];
  for (const [label, arrange] of races) {
    await t.test(label, async () => {
      const redis = new MemoryRedis();
      const provisioned = provisionRuntimeAuthority(redis);
      arrange({ redis, ...provisioned });
      const denied = await authenticateSyntheticQaRuntimeRequest({
        redis,
        req: provisioned.req,
        env: environment(),
        now: NOW,
      });
      assert.equal(denied.status, 409);
      assert.equal(denied.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY');
      assert.equal(Object.hasOwn(denied, 'scope'), false);
    });
  }
});

test('realization identifiers are canonical before any derived Redis artifact lookup', async (t) => {
  const malformedBaPointers = [
    `new-ba:${REALIZATION_PROFILE_ID}:${ASSESSMENT_ID}:../escape`,
    `new-ba:${REALIZATION_PROFILE_ID}:${ASSESSMENT_ID}:${'a'.repeat(65)}`,
  ];
  for (const pointer of malformedBaPointers) {
    await t.test(`BA pointer ${pointer.length}`, async () => {
      const redis = new MemoryRedis();
      const provisioned = provisionRuntimeAuthority(redis);
      redis.values.set(provisioned.keys.baPointerKey, pointer);
      const denied = await authenticateSyntheticQaRuntimeRequest({
        redis,
        req: provisioned.req,
        env: environment(),
        now: NOW,
      });
      assert.equal(denied.status, 409);
      assert.equal(denied.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY');
      assert.equal(redis.reads.some((key) => key.includes(pointer)), false);
    });
  }

  const malformedBosIds = [
    `new-bos:${REALIZATION_PROFILE_ID}:../escape`,
    `new-bos:${REALIZATION_PROFILE_ID}:${'b'.repeat(65)}`,
  ];
  for (const realizationId of malformedBosIds) {
    await t.test(`BOS realization ${realizationId.length}`, async () => {
      const redis = new MemoryRedis();
      const ba = clone(runtimeFixture().ba);
      ba.artifact.fusion.bos_authority.realization_id = realizationId;
      const provisioned = provisionRuntimeAuthority(redis, { ba });
      const denied = await authenticateSyntheticQaRuntimeRequest({
        redis,
        req: provisioned.req,
        env: environment(),
        now: NOW,
      });
      assert.equal(denied.status, 409);
      assert.equal(denied.code, 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY');
      assert.equal(redis.reads.some((key) => key.includes(realizationId)), false);
    });
  }
});

test('post-authentication loaders consume only the immutable request-local custody snapshot', async () => {
  const redis = new MemoryRedis();
  const { req, keys } = provisionRuntimeAuthority(redis);
  const auth = await authenticateSyntheticQaRuntimeRequest({ redis, req, env: environment(), now: NOW });
  assert.equal(auth.ok, true);
  const snapshot = syntheticQaRuntimeCustodySnapshot(auth);
  const readCount = redis.reads.length;
  redis.values.set(keys.profileKey, JSON.stringify(canonicalProfileRecord(PROFILE_IDS[1])));
  redis.values.set(keys.baArtifactKey, JSON.stringify({ substituted: true }));
  redis.values.set(keys.bosArtifactKey, JSON.stringify({ substituted: true }));

  const readers = createSyntheticQaCustodyReaders();
  const profile = await readers.readCanonicalProfile({
    redis,
    profile_id: PROFILE_ID,
    membership_context: auth.membership_context,
  });
  const ba = await readers.readCompletedRealization({
    redis,
    profile_id: PROFILE_ID,
    membership_context: auth.membership_context,
  });
  const bos = await readers.readCompletedBosRealization({
    redis,
    profile_id: PROFILE_ID,
    realization_id: snapshot.bos_realization_record.realization_id,
    membership_context: auth.membership_context,
  });
  assert.equal(profile, snapshot.profile_lookup);
  assert.equal(ba, snapshot.realization_record);
  assert.equal(bos, snapshot.bos_realization_record);
  assert.equal(redis.reads.length, readCount);
  await assert.rejects(
    readers.readCanonicalProfile({ membership_context: { ...auth.membership_context } }),
    /CUSTODY_SNAPSHOT_REQUIRED/u,
  );
  await assert.rejects(
    readers.readCompletedBosRealization({
      profile_id: PROFILE_ID,
      realization_id: `new-bos:${REALIZATION_PROFILE_ID}:${digest('wrong-bos')}`,
      membership_context: auth.membership_context,
    }),
    /CUSTODY_BOS_MISMATCH/u,
  );
});

test('custody rejection stops before scope runtime, history, CSRF, loader, or provider boundaries', async () => {
  const redis = new MemoryRedis();
  const { req, keys } = provisionRuntimeAuthority(redis);
  redis.values.set(keys.profileKey, JSON.stringify(canonicalProfileRecord(PROFILE_IDS[1])));
  const downstream = [];
  const entry = createSubscriptionV1RuntimeEntry({
    env: environment({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' }),
    getRedis: () => redis,
    authenticateSyntheticQa: (args) => authenticateSyntheticQaRuntimeRequest({
      ...args,
      now: NOW,
    }),
    syntheticQaRuntimeFactory: async () => {
      downstream.push('synthetic-runtime');
      return async () => {};
    },
    authenticateInternal: async () => { downstream.push('internal-auth'); return { ok: true }; },
    paidRuntimeFactory: async () => { downstream.push('paid-runtime'); return async () => {}; },
    ordinary: async () => { downstream.push('ordinary-runtime'); },
  });
  const res = response();
  await entry(req, res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.payload, {
    ok: false,
    code: 'SUBSCRIPTION_V1_SYNTHETIC_QA_PROFILE_NOT_READY',
    reentry_required: true,
  });
  assert.deepEqual(downstream, []);
  assert.equal(redis.reads.some((key) => /:(?:living|living-backup|allowance|research|diagnostics|relationship|conversation|runtime-csrf):/u.test(key)), false);
});

test('synthetic access context projects a valid nonbilling entitlement and public label', async () => {
  const redis = new MemoryRedis();
  const { req } = provisionRuntimeAuthority(redis);
  const auth = await authenticateSyntheticQaRuntimeRequest({ redis, req, env: environment(), now: NOW });
  const context = syntheticQaAccessContext(auth);
  const entitlement = await resolveSyntheticQaEntitlement({
    scope: auth.scope,
    membership_context: context,
    now: NOW,
  });
  assert.equal(entitlement.contract_id, 'synthetic_qa_entitlement');
  assert.equal(entitlement.billing_evidence, false);
  assert.equal(entitlement.stripe_subscription_created, false);
  assert.equal(entitlement.synthetic_only, true);

  const projected = syntheticQaGetProjection({
    ok: true,
    demo_subject: 'must disappear',
    provider: { model: 'must disappear later at redaction' },
  });
  assert.equal(projected.demo_subject, undefined);
  assert.equal(projected.subscriber.kind, 'SYNTHETIC_QA_SUBSCRIBER');
  assert.equal(projected.entitlement.source, 'EXACT_FOUR_SYNTHETIC_QA_MANIFEST');
  assert.equal(projected.entitlement.billing_evidence, false);
  assert.equal(syntheticQaFailureProjection({ ok: false, code: 'SUBSCRIPTION_V1_RUNTIME_UNAVAILABLE' }).code,
    'SUBSCRIPTION_V1_SYNTHETIC_QA_RUNTIME_UNAVAILABLE');
});

test('capability reissue preserves the manifest-governed cycle and cannot reset allowance', async () => {
  const redis = new MemoryRedis();
  seedRuntimeCustody(redis);
  const issueAt = async (at, token) => {
    const baseRequest = request();
    const issued = issueFullPersonQaCapability({
      profile_id: PROFILE_ID,
      manifest: manifest(),
      digest_key: DIGEST_KEY,
      signing_key: SIGNING_KEY,
      req: baseRequest,
      now: at,
      token_factory: () => token,
    });
    redis.values.set(syntheticQaCapabilityStateKey(issued.capability_hash), JSON.stringify(issued.receipt));
    return authenticateSyntheticQaRuntimeRequest({
      redis,
      req: request(`__Host-more_subscription_full_person_qa=${token}`),
      env: environment(),
      now: at,
    });
  };

  const firstAuth = await issueAt(NOW, 'L'.repeat(43));
  const secondNow = new Date(NOW.getTime() + 60 * 60 * 1000);
  const secondAuth = await issueAt(secondNow, 'M'.repeat(43));
  assert.notEqual(firstAuth.capability.expires_at, secondAuth.capability.expires_at);
  assert.equal(firstAuth.membership_context.access_ends_at, '2026-09-30T00:00:00.000Z');
  assert.equal(secondAuth.membership_context.access_ends_at, firstAuth.membership_context.access_ends_at);

  const firstEntitlement = await resolveSyntheticQaEntitlement({
    scope: firstAuth.scope,
    membership_context: firstAuth.membership_context,
    now: NOW,
  });
  const secondEntitlement = await resolveSyntheticQaEntitlement({
    scope: secondAuth.scope,
    membership_context: secondAuth.membership_context,
    now: secondNow,
  });
  assert.equal(secondEntitlement.entitlement_id, firstEntitlement.entitlement_id);
  assert.equal(secondEntitlement.billing_cycle_start, firstEntitlement.billing_cycle_start);
  assert.equal(secondEntitlement.billing_cycle_end, firstEntitlement.billing_cycle_end);

  const ledger = new InMemoryAllowanceSessionLedger();
  const firstCycle = ledger.createCycle(firstEntitlement).ledger;
  const reserved = ledger.reserve({
    ledger_id: firstCycle.ledger_id,
    scope: firstAuth.scope,
    idempotency_key: 'synthetic-reissue-first-use',
    now: NOW.toISOString(),
  });
  ledger.activate({ session_id: reserved.session.session_id, scope: firstAuth.scope, now: NOW.toISOString() });
  ledger.recordFirstValidResponse({
    session_id: reserved.session.session_id,
    scope: firstAuth.scope,
    response_hash: 'a'.repeat(64),
    now: NOW.toISOString(),
  });
  const replayedCycle = ledger.createCycle(secondEntitlement);
  assert.equal(replayedCycle.code, 'IDEMPOTENT_REPLAY');
  assert.equal(replayedCycle.ledger.ledger_id, firstCycle.ledger_id);
  assert.equal(replayedCycle.ledger.standard_slots_consumed, 1);
});

test('valid synthetic QA authority has priority while an absent authority preserves existing routes', async () => {
  const calls = [];
  const env = environment({ PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true' });
  const synthetic = createSubscriptionV1RuntimeEntry({
    env,
    getRedis: () => ({ marker: 'redis' }),
    authenticateSyntheticQa: async () => ({ ok: true }),
    syntheticQaRuntimeFactory: async () => async (_req, res) => {
      calls.push('synthetic');
      return res.status(200).json({ ok: true });
    },
    authenticateInternal: async () => { calls.push('internal'); return { ok: false }; },
    paidRuntimeFactory: async () => { calls.push('paid'); throw new Error('must not run'); },
  });
  await synthetic(request(), response());
  assert.deepEqual(calls, ['synthetic']);

  calls.length = 0;
  const paid = createSubscriptionV1RuntimeEntry({
    env,
    getRedis: () => ({ marker: 'redis' }),
    authenticateSyntheticQa: async () => ({ ok: false, status: 401 }),
    authenticateInternal: async () => { calls.push('internal'); return { ok: false }; },
    paidRuntimeFactory: async () => async (_req, res) => {
      calls.push('paid');
      return res.status(403).json({ ok: false, code: 'SUBSCRIPTION_V1_PAID_MEMBERSHIP_REQUIRED' });
    },
  });
  await paid(request(), response());
  assert.deepEqual(calls, ['internal', 'paid']);
});

const ORDINARY_PAID_LO_BA_NAMESPACE = 'preview:new-ba:ordinary-paid-lo-regression-v1';
const ORDINARY_PAID_LO_BOS_NAMESPACE = 'preview:new-bos:ordinary-paid-lo-regression-v1';
const ORDINARY_PAID_LO_OWNER_SIGNING_KEY = 'ordinary-paid-lo-owner-signing-key-for-offline-tests-0001';
const ORDINARY_PAID_LO_AUTH_ENV = Object.freeze({
  PUBLIC_SUBSCRIPTION_RUNTIME_ENABLED: 'true',
  PUBLIC_PROFILE_OWNERSHIP_ENVIRONMENT: 'preview',
  PUBLIC_SITE_URL: 'https://ordinary-paid-lo.example.test',
  MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: ORDINARY_PAID_LO_OWNER_SIGNING_KEY,
});

function ordinaryPaidLoanOriginatorFixture(variant = 2) {
  assert.ok([2, 3].includes(variant));
  const source = runtimeFixtures()[variant];
  assert.equal(source.verticalId, 'loan_originator');
  const profile = clone(source.profile);
  const assessment = clone(source.assessment);
  const bos = clone(source.bos);
  delete profile.synthetic_qa_provenance;
  delete assessment.synthetic_qa_provenance;
  delete bos.synthetic_qa_provenance;
  const { artifact, governedAssessment } = completedBaArtifact({
    assessment,
    bosEnvelope: bos,
    personName: PERSON_NAMES[variant],
    variant,
    verticalId: 'loan_originator',
  });
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
  const bosAuthority = fusionAuthorityFor(bos);
  const identity = buildNewBaRealizationIdentityV3({
    profileId: source.profileId.toUpperCase(),
    assessmentId: source.assessmentId,
    evidenceSha256: governedAssessment.evidence_sha256,
    bosAuthoritySha256: artifact.lineage.bos_authority_sha256,
    bosFusionContractSha256: artifact.lineage.bos_fusion_contract_sha256,
    bosEvidenceBoundarySha256: bosAuthority.evidence_boundary_sha256,
    compatibilityClass: 'A',
    providerModel: 'gpt-5.6-sol',
    verticalBinding: governedAssessment.vertical_binding,
  });
  const ba = buildLaunchSafeNewBaEnvelope({
    profileId: source.profileId.toUpperCase(),
    realizationIdentity: identity,
    artifact,
    compatibility: { class: 'A', label: 'Canonical ordinary paid Loan Originator fixture' },
    providerAccounting: artifact.provider_accounting,
    createdAt: CREATED_AT,
  });
  return Object.freeze({
    profileId: source.profileId,
    assessmentId: source.assessmentId,
    personName: PERSON_NAMES[variant],
    recipientEmail: `ordinary-lo-${variant}@example.test`,
    profile,
    assessment,
    governedAssessment,
    ba,
    bos,
  });
}

async function seedOrdinaryPaidLoanOriginatorCustody(store, fixture) {
  const realizationProfileId = fixture.profileId.toUpperCase();
  const profileKey = `vault:profile:${fixture.profileId}`;
  const assessmentPointerKey = `business_assessment_by_profile:${fixture.profileId}`;
  const assessmentKey = `business_assessment:${fixture.assessmentId}`;
  const baPointerKey = `${ORDINARY_PAID_LO_BA_NAMESPACE}:latest-compatible:${realizationProfileId}`;
  const baArtifactKey = `${ORDINARY_PAID_LO_BA_NAMESPACE}:artifact:${realizationProfileId}:${fixture.ba.realization_id}`;
  const bosArtifactKey = `${ORDINARY_PAID_LO_BOS_NAMESPACE}:artifact:${realizationProfileId}:${fixture.bos.realization_id}`;
  await store.set(profileKey, JSON.stringify({
    email: fixture.recipientEmail,
    person_name: fixture.personName,
    canonical_profile_json: clone(fixture.profile.canonical_profile_json),
  }));
  await store.set(assessmentPointerKey, fixture.assessmentId);
  await store.set(assessmentKey, JSON.stringify(fixture.assessment));
  await store.set(baPointerKey, fixture.ba.realization_id);
  await store.set(baArtifactKey, JSON.stringify(fixture.ba));
  await store.set(bosArtifactKey, JSON.stringify(fixture.bos));
  return Object.freeze({
    profileKey,
    assessmentPointerKey,
    assessmentKey,
    baPointerKey,
    baArtifactKey,
    bosArtifactKey,
  });
}

async function issueOrdinaryPaidOwnerCookie({ store, ownerReader, fixture, token }) {
  let deliveredToken = null;
  const ownership = createProfileOwnershipAdapter({
    store,
    ownerReader,
    transport: {
      async send(message) {
        assert.equal(message.recipient, fixture.recipientEmail);
        deliveredToken = message.token;
        return { success: true };
      },
    },
    signingKey: ORDINARY_PAID_LO_OWNER_SIGNING_KEY,
    audience: resolveProfileOwnershipAudience(ORDINARY_PAID_LO_AUTH_ENV),
    clock: () => NOW.getTime(),
    tokenFactory: () => token,
    minimumResponseDelayMs: 0,
  });
  await ownership.requestChallenge({ profile_id: fixture.profileId, return_path: '/step-2' });
  assert.equal(deliveredToken, token);
  const consumed = await ownership.consumeChallenge(deliveredToken);
  deliveredToken = null;
  return {
    cookieHeader: profileOwnerCookie(consumed.receipt).split(';')[0],
    ownership,
  };
}

function paidMembershipContextFrom({ authenticated, membership }) {
  return {
    authenticated: authenticated.authenticated,
    membership_verified: authenticated.membership_verified,
    binding_source: authenticated.binding_source,
    scope: authenticated.scope,
    assessment_id: membership.assessment_id,
    membership_binding: membership.membership_binding,
  };
}

test('two ordinary authenticated paid Loan Originators traverse readiness, membership, loader, and isolated open-plan state without provider access', async () => {
  const store = new MemoryPublicStore();
  const fixtures = [ordinaryPaidLoanOriginatorFixture(2), ordinaryPaidLoanOriginatorFixture(3)];
  for (const fixture of fixtures) await seedOrdinaryPaidLoanOriginatorCustody(store, fixture);
  const ownerReader = createCanonicalProfileOwnerReader(store);
  const readinessReader = createCurrentNewBaMembershipReadinessReader({
    store,
    namespace: ORDINARY_PAID_LO_BA_NAMESPACE,
    bosNamespace: ORDINARY_PAID_LO_BOS_NAMESPACE,
  });
  const results = [];

  for (const [index, fixture] of fixtures.entries()) {
    const readiness = await readinessReader({
      profile_id: fixture.profileId,
      assessment: fixture.assessment,
    });
    assert.equal(readiness.ready, true);
    assert.equal(readiness.vertical_binding_sha256, fixture.governedAssessment.vertical_binding.binding_sha256);
    assert.equal(readiness.runtime_compatible_bos_ready, true);
    assert.equal(readiness.bos_realization_id, fixture.bos.realization_id);

    const issued = await issueOrdinaryPaidOwnerCookie({
      store,
      ownerReader,
      fixture,
      token: `ordinary-paid-lo-owner-${index + 1}-token`,
    });
    const binder = createPaidMembershipBinder({
      store,
      ownershipVerifier: (input) => issued.ownership.verifyRequest(input),
      ownerReader,
      profileStateReader: async () => ({ bos: 'ready', ba: 'pending' }),
      currentNewBaReadinessReader: readinessReader,
      clock: () => NOW.getTime(),
    });
    const membership = await binder({
      profile_id: fixture.profileId,
      cookie_header: issued.cookieHeader,
    });
    const authenticated = await authenticatePaidRuntimeRequest({
      redis: store,
      req: { headers: { cookie: issued.cookieHeader } },
      env: ORDINARY_PAID_LO_AUTH_ENV,
      nowMs: NOW.getTime(),
    });
    assert.equal(authenticated.ok, true, authenticated.code);
    assert.equal(authenticated.capability.synthetic_only, false);
    assert.deepEqual(authenticated.scope, membership.scope);

    let providerFactoryCalls = 0;
    const relationshipStore = new InMemoryLivingRelationshipStore();
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
        const pointer = await store.get(`${ORDINARY_PAID_LO_BA_NAMESPACE}:latest-compatible:${profileId.toUpperCase()}`);
        return JSON.parse(await store.get(`${ORDINARY_PAID_LO_BA_NAMESPACE}:artifact:${profileId.toUpperCase()}:${pointer}`));
      },
      readCompletedBosRealization: async ({ profile_id: profileId, realization_id: realizationId }) => JSON.parse(
        await store.get(`${ORDINARY_PAID_LO_BOS_NAMESPACE}:artifact:${profileId.toUpperCase()}:${realizationId}`),
      ),
      openRelationshipStore: async () => relationshipStore,
      readExternalEvidenceForRuntime: async () => [],
      createTransport: () => {
        providerFactoryCalls += 1;
        throw new Error('ordinary_paid_lo_provider_must_not_open_during_load');
      },
    });
    const loaded = await loader({
      redis: store,
      relationship_key: authenticated.capability.relationship_key,
      subject_key: authenticated.capability.subject_key,
      membership_context: paidMembershipContextFrom({ authenticated, membership }),
      session_id: `session_${String(index + 2).repeat(24)}`,
      session_kind: 'FIRST_EVER',
      coaching_episode_phase: 'IDLE',
      initial_conversation: [],
      now: () => CREATED_AT,
    });
    assert.equal(loaded.current.ok, true, loaded.current.code);
    assert.equal(loaded.identity.vertical, 'Loan Originator');
    assert.equal(loaded.identity.synthetic_only, false);
    assert.equal(loaded.architecture.canonical_owned_profile_loaded, true);
    assert.equal(loaded.architecture.provider_calls_during_load, 0);
    assert.equal(providerFactoryCalls, 0);
    assert.match(
      loaded.relationship_context.capability_context.knowledge_library,
      /canonical Loan Originator knowledge/u,
    );

    const projection = projectCompletedRealProfileToSubscription({
      scope: authenticated.scope,
      assessment_id: fixture.assessmentId,
      profile_lookup: {
        found: true,
        profile_id: fixture.profileId,
        dossier: { canonical_profile_json: fixture.profile.canonical_profile_json },
      },
      realization_record: fixture.ba,
      bos_realization_record: fixture.bos,
    });
    const plan = projection.canonical_artifacts.find(({ artifact_type: artifactType }) => artifactType === 'PLAN_135');
    assert.equal(plan.status, 'OPEN_NOT_CUSTOMER_AGREED');
    assert.equal(plan.validation_status, 'PASS_WITH_OPEN_PLAN');
    assert.equal(plan.bindings.completeness_policy, 'CANONICAL_PAID_LO_OPEN_PLAN');
    assert.equal(plan.bindings.customer_plan_status, 'OPEN_NOT_CUSTOMER_AGREED');
    assert.equal(plan.bindings.customer_plan_complete, false);
    assert.equal(plan.payload.customer_boundary.customer_agreed, false);
    assert.equal(plan.payload.customer_boundary.proposed_plan_not_customer_commitment, true);
    assert.equal(plan.payload.validation.selected_way_count, 0);
    assert.equal(plan.payload.validation.strategy_count, 0);
    results.push({ authenticated, loaded, membership, relationshipStore });
  }

  const [left, right] = results;
  assert.notEqual(left.membership.scope.subject_id, right.membership.scope.subject_id);
  assert.notEqual(left.membership.scope.membership_id, right.membership.scope.membership_id);
  assert.notEqual(left.membership.scope.tenant_id, right.membership.scope.tenant_id);
  assert.notEqual(left.membership.scope.business_id, right.membership.scope.business_id);
  assert.notEqual(
    paidRuntimeRelationshipKey(left.membership.scope),
    paidRuntimeRelationshipKey(right.membership.scope),
  );
  assert.notDeepEqual(left.loaded.keys, right.loaded.keys);
  assert.notEqual(
    left.relationshipStore.snapshot().current_publication_hash,
    right.relationshipStore.snapshot().current_publication_hash,
  );
});

test('ordinary paid LO custody drift fails before membership persistence or a downstream provider effect', async (t) => {
  const cases = [
    ['wrong owner', async ({ store, keys }) => {
      const assessment = JSON.parse(await store.get(keys.assessmentKey));
      assessment.owner_profile_id = 'mm-20260913-deadbeef';
      await store.set(keys.assessmentKey, JSON.stringify(assessment));
    }],
    ['artifact hash drift', async ({ store, keys }) => {
      const envelope = JSON.parse(await store.get(keys.baArtifactKey));
      envelope.artifact_sha256 = 'f'.repeat(64);
      await store.set(keys.baArtifactKey, JSON.stringify(envelope));
    }],
    ['current pointer drift', async ({ store, keys }) => {
      await store.set(keys.baPointerKey, 'new-ba:MM-20260913-C3D4E5F6:ba-20260913-00000002:' + '0'.repeat(64));
    }],
    ['vertical authority conflict', async ({ store, keys }) => {
      const envelope = JSON.parse(await store.get(keys.baArtifactKey));
      envelope.artifact.customer_view_model.vertical.vertical_id = 'real_estate';
      await store.set(keys.baArtifactKey, JSON.stringify(envelope));
    }],
    ['missing recorded BOS', async ({ store, keys }) => {
      await store.del(keys.bosArtifactKey);
    }],
    ['inflated customer agreement', async ({ store, keys }) => {
      const envelope = JSON.parse(await store.get(keys.baArtifactKey));
      envelope.artifact.plan_135.customer_boundary.customer_agreed = true;
      envelope.artifact.plan_135.customer_boundary.proposed_plan_not_customer_commitment = false;
      await store.set(keys.baArtifactKey, JSON.stringify(envelope));
    }],
  ];

  for (const [label, mutate] of cases) {
    await t.test(label, async () => {
      const store = new MemoryPublicStore();
      const fixture = ordinaryPaidLoanOriginatorFixture(2);
      const keys = await seedOrdinaryPaidLoanOriginatorCustody(store, fixture);
      await mutate({ store, keys, fixture });
      const readinessReader = createCurrentNewBaMembershipReadinessReader({
        store,
        namespace: ORDINARY_PAID_LO_BA_NAMESPACE,
        bosNamespace: ORDINARY_PAID_LO_BOS_NAMESPACE,
      });
      const binder = createPaidMembershipBinder({
        store,
        ownershipVerifier: async () => true,
        ownerReader: createCanonicalProfileOwnerReader(store),
        profileStateReader: async () => ({ bos: 'ready', ba: 'pending' }),
        currentNewBaReadinessReader: readinessReader,
        clock: () => NOW.getTime(),
      });
      let providerEffects = 0;
      const reachProviderBoundary = async () => {
        const membership = await binder({
          profile_id: fixture.profileId,
          cookie_header: 'verified-by-test-ownership-adapter',
        });
        providerEffects += 1;
        return membership;
      };
      await assert.rejects(reachProviderBoundary(), /completed_bos_and_business_assessment_required/u);
      assert.equal(providerEffects, 0);
      assert.equal(
        [...store.values.keys()].some((key) => key.startsWith(`${PAID_MEMBERSHIP_NAMESPACE}:`)),
        false,
      );
    });
  }
});

test('the synthetic QA capability cookie cannot authenticate an ordinary paid subscriber', async () => {
  const issued = issueFullPersonQaCapability({
    profile_id: PROFILE_ID,
    manifest: manifest(),
    digest_key: DIGEST_KEY,
    signing_key: SIGNING_KEY,
    req: request(),
    now: NOW,
    token_factory: () => 'N'.repeat(43),
  });
  let membershipReads = 0;
  const denied = await authenticatePaidRuntimeRequest({
    redis: { async get() { membershipReads += 1; return null; } },
    req: { headers: { cookie: issued.cookie.split(';')[0] } },
    env: ORDINARY_PAID_LO_AUTH_ENV,
    nowMs: NOW.getTime(),
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'SUBSCRIPTION_V1_PAID_PROFILE_OWNER_RECEIPT_REQUIRED');
  assert.equal(denied.status, 401);
  assert.equal(membershipReads, 0);
});

test('ordinary paid source resolution stays pinned to verified RE or LO authority only', () => {
  const realEstateProjection = { synthetic_only: false, doctrine_vertical_id: 'REAL_ESTATE' };
  const loanOriginatorProjection = { synthetic_only: false, doctrine_vertical_id: 'LOAN_ORIGINATOR' };
  const realEstate = resolvePaidSourceLibrary({
    projection: realEstateProjection,
    synthetic_only: false,
  });
  const loanOriginator = resolvePaidSourceLibrary({
    projection: loanOriginatorProjection,
    synthetic_only: false,
  });
  assert.equal(realEstate, pinnedSubscriptionSources());
  assert.equal(loanOriginator, pinnedLoanOriginatorSubscriptionSources());

  const found = loanOriginator.execute('more_source_search', {
    query: 'aggregate pipeline capacity evidence',
    namespace: 'more.ba-bible.loan-originator',
  });
  assert.equal(found.ok, true);
  assert.equal(found.code, 'SOURCE_MATCHES');
  assert.ok(found.results.length > 0);
  const selected = found.results[0];
  const read = loanOriginator.execute('more_source_read', {
    source_id: selected.source_id,
    version: selected.version,
    document_sha256: selected.document_sha256,
    start_line: selected.start_line,
    line_count: 8,
  });
  assert.equal(read.ok, true);
  assert.equal(read.customer_truth_override_allowed, false);

  assert.throws(() => resolvePaidSourceLibrary({
    projection: { synthetic_only: false, doctrine_vertical_id: 'PROFESSIONAL_SERVICES' },
    synthetic_only: false,
  }), /PAID_SUBSCRIBER_SOURCE_VERTICAL_UNSUPPORTED/u);
  assert.throws(() => resolvePaidSourceLibrary({
    projection: loanOriginatorProjection,
    synthetic_only: true,
  }), /PAID_SUBSCRIBER_SOURCE_SCOPE_MISMATCH/u);
  assert.throws(() => resolvePaidSourceLibrary({
    projection: { synthetic_only: false, doctrine_vertical_id: 'REAL_ESTATE|LOAN_ORIGINATOR' },
    synthetic_only: false,
  }), /PAID_SUBSCRIBER_SOURCE_VERTICAL_UNSUPPORTED/u);
});


test('staged single-case QA requires the actual complete BOS and BA and rejects old omitted capabilities before profile reads', async () => {
  const fixtures = runtimeFixtures();
  const fixture = fixtures[2];
  const rawManifest = JSON.stringify(JSON.parse(manifest()).filter(row => row.case_id === fixture.caseId));
  const env = environment({ MOREMINDMAP_SERVER_ONLY_SUBSCRIPTION_SYNTHETIC_QA_MANIFEST: rawManifest });
  for (const missing of [null, 'baArtifactKey', 'bosArtifactKey']) {
    const redis = new MemoryRedis();
    const { req, keys } = provisionRuntimeAuthority(redis, { fixture, rawManifest });
    if (missing) redis.values.delete(keys[missing]);
    const result = await authenticateSyntheticQaRuntimeRequest({ redis, req, env, now: NOW });
    if (!missing) {
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.scope.profile_id, fixture.profileId);
      assert.equal(result.membership_context.assessment_id, fixture.assessmentId);
      const custody = syntheticQaRuntimeCustodySnapshot(result);
      assert.equal(custody.realization_record.realization_id, fixture.ba.realization_id);
      assert.equal(custody.bos_realization_record.realization_id, fixture.bos.realization_id);
    } else {
      assert.equal(result.ok, false); assert.equal(Object.hasOwn(result, 'scope'), false);
      assert.equal(syntheticQaRuntimeCustodySnapshot(req), null);
    }
  }
  for (const omitted of fixtures.filter(entry => entry.caseId !== fixture.caseId)) {
    const redis = new MemoryRedis();
    const { req } = provisionRuntimeAuthority(redis, { fixture: omitted }); // Old full-four capability and real records still exist.
    redis.reads = [];
    const denied = await authenticateSyntheticQaRuntimeRequest({ redis, req, env, now: NOW });
    assert.equal(denied.ok, false); assert.equal(denied.status, 401);
    assert.equal(redis.reads.some(key => key.startsWith('vault:profile:')), false);
  }
});
