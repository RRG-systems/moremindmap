// Local-only deterministic adapters. This module is never imported by runtime routes.
import { createRecruitingGuV1RealRuntime } from '../../api/engine/recruitingGuV1/realRuntime.js';
import { createSyntheticAuthoredSurfaces } from '../../api/engine/recruitingGuV1/authoredSurfaces.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../../src/lib/recruitingV1/service.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../../src/lib/recruitingV1/store.js';
import { normalizeProfileId, stableHash } from '../../src/lib/recruitingV1/contracts.js';
import { RECRUITING_GU_EXPERIMENT_2_VERSION } from '../../src/lib/recruitingGuV1/experiment2Contract.js';

export const FIXTURE_MEMBERSHIPS = Object.freeze([
  {
    membership_id: 'membership_review_standard', manager_subject_id: 'manager_review_standard',
    enterprise_id: 'enterprise_review', manager_profile_id: 'mm-20990101-manager1',
    manager_name: 'Morgan Vale', manager_email: 'morgan@example.test', enterprise_name: 'Synthetic Review Realty',
    status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: '5_per_month', synthetic_only: true,
  },
  {
    membership_id: 'membership_review_other', manager_subject_id: 'manager_review_other',
    enterprise_id: 'enterprise_review_other', manager_profile_id: 'mm-20990101-manager2',
    manager_name: 'Avery West', manager_email: 'avery@example.test', enterprise_name: 'Other Synthetic Realty',
    status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: '5_per_month', synthetic_only: true,
  },
]);

export function deterministicConsultingTransport({ messages, schemaName }) {
  const input = JSON.parse(messages[1].content);
  const receipt = { modelReturned: 'DETERMINISTIC_LOCAL_ADAPTER', providerReturned: 'NO_PROVIDER', latencyMs: 0, store: false, synthetic: true };
  if (schemaName === 'more_recruiting_gu_v1_plan_proposal') {
    const prior = input.current_proposal;
    const request = input.current_request;
    const manager = input.people.manager;
    const person = input.people.invitee;
    const timing = /Tuesday/iu.test(request) ? 'Starting next Tuesday, for four weeks' : 'Weekly for four weeks';
    return Promise.resolve({
      parsed: {
        title: prior?.title || 'A shared four-week experiment',
        summary: `${manager} and ${person} will review one agreed experiment and what they learn from it.`,
        commitments: [
          { owner: manager, commitment: /thirty|30/iu.test(request) ? 'Hold a thirty-minute review.' : 'Hold the weekly review.', timing, intendedOutcome: 'Review the evidence before adding scope.' },
          { owner: person, commitment: 'Bring an account of what was tried and what happened.', timing, intendedOutcome: 'Decide together what to try next.' },
        ],
        unresolved: ['Any commercial terms remain outside this shared plan.'],
      },
      receipt,
    });
  }
  if (schemaName === 'more_recruiting_gu_v1_experiment_2_coach_move') {
    const person = input.governedReality.people.invitee.name;
    return Promise.resolve({ parsed: {
      version: RECRUITING_GU_EXPERIMENT_2_VERSION,
      insight: `${person} can test one change before adding more commitments.`,
      explanation: 'The shared evidence provides a starting point, while the outcome of the next experiment remains unknown.',
      selfDiscoveryQuestion: 'What would you both want to learn from the next week?',
      visual: { materiallyHelps: true, semanticIdea: 'Show the supported person and business view while keeping the next outcome open.' },
    }, receipt });
  }
  const firstObject = input.governedReality.objects[0];
  const typeByKind = { PERSON: 'PERSON', BUSINESS_TWIN: 'PLAIN_LANGUAGE', RELATIONSHIP: 'RELATIONSHIP', EVIDENCE_GAP: 'EVIDENCE_GAP' };
  return Promise.resolve({ parsed: {
    planVersion: input.planVersion, stateBinding: input.exactStateBinding,
    purpose: { humanWords: input.currentHumanPurpose, interpretedPurpose: input.currentHumanPurpose, meetingNeed: 'Examine the shared evidence together.', materiallyChanged: false },
    guidance: { eyebrow: 'CURRENT READ', headline: 'A shared view to consider together.', summary: 'The supported evidence remains separate from the experiment outcome.', nextCue: 'Discuss what matters next.', whyThisEnvironment: 'The requested visual keeps the shared question visible.' },
    hypotheses: [],
    blocks: [{ blockId: 'review-supported-read', type: typeByKind[firstObject.kind] || 'PLAIN_LANGUAGE', title: firstObject.title, subtitle: 'The current evidence supports discussion, not a promised outcome.', objectIds: [firstObject.id], evidenceIds: firstObject.sourceIds?.slice(0, 1) || [], emphasis: 'PRIMARY', reason: 'The requested visual helps the humans examine the evidence.' }],
    interactions: ['SHOW_EVIDENCE', 'CHANGE_PURPOSE'],
    completion: { recommendation: 'CONTINUE', ready: false, summary: 'The humans still own the decision.', nextStep: 'Continue the conversation.' },
  }, receipt });
}

export function authoredFixtureFor({ profileId, name, assessmentId }) {
  const base = createSyntheticAuthoredSurfaces();
  const sourceProfileId = base.bos.profile_id;
  // Explicitly authored local fixture variants; these are never canonical writes.
  const rename = (value) => typeof value === 'string'
    ? value.replaceAll('Jordan Lee', name).replaceAll('Jordan', name.split(' ')[0]).replaceAll(sourceProfileId, profileId.toUpperCase())
    : Array.isArray(value) ? value.map(rename)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rename(item)])) : value;
  const bos = rename(base.bos);
  bos.profile_id = profileId.toUpperCase();
  const ba = rename(base.ba);
  const realizationHash = stableHash({ profileId, assessmentId, fixture: 'two-box-review-v1' });
  return {
    bos, ba,
    receipts: {
      bos: { source: 'injected_synthetic_fixture', profile_id: profileId.toUpperCase(), realization_id: `synthetic-bos:${profileId}`, artifact_sha256: stableHash(bos), complete_surface_count: 15 },
      ba: { source: 'injected_synthetic_fixture', profile_id: profileId.toUpperCase(), assessment_id: assessmentId, realization_id: `synthetic-ba:${profileId}:${realizationHash}`, realization_sha256: realizationHash, artifact_sha256: stableHash(ba), complete: true },
    },
  };
}

export async function createConsultingRuntimeFixture({
  memberships = FIXTURE_MEMBERSHIPS, now = () => new Date('2026-09-09T18:00:00.000Z'),
  frontierTransport = deterministicConsultingTransport, notificationTransport = createSyntheticNotificationTransport(),
} = {}) {
  if (memberships.some((item) => !item.manager_email.endsWith('.test'))) throw new Error('REVIEW_SYNTHETIC_RECIPIENT_REQUIRED');
  const store = new InMemoryRecruitingStore(createEmptyRecruitingState(memberships));
  const authoredValues = new Map();
  const providerRequests = [];
  const canonicalReads = [];
  const redis = { async get() { throw new Error('REVIEW_REAL_REDIS_FORBIDDEN'); } };
  const authoredSurfacesReader = async ({ profileId }) => {
    canonicalReads.push(normalizeProfileId(profileId));
    const authored = authoredValues.get(normalizeProfileId(profileId));
    if (!authored) throw new Error('RECRUITING_GU_V1_COMPLETE_BOS_NOT_READY');
    return structuredClone(authored);
  };
  const service = new RecruitingV1Service({
    store, now, transport: notificationTransport,
    canonicalReadinessReader: async ({ invitation }) => {
      const authored = await authoredSurfacesReader({ profileId: invitation.bos_profile_id });
      return { ...authored.receipts.ba, ready: Boolean(authored.bos && authored.ba && authored.receipts.bos.complete_surface_count === 15 && authored.receipts.ba.complete) };
    },
  });
  const tokens = {};
  for (const membership of memberships.filter((item) => item.status === 'ACTIVE')) {
    const verification = await service.requestManagerVerification(membership.manager_profile_id);
    tokens[membership.membership_id] = (await service.verifyManager(verification.verification_token)).session_token;
  }
  const runtime = createRecruitingGuV1RealRuntime({
    env: {}, service, redis, authoredSurfacesReader,
    canonicalContextResolver: async () => ({ context: { synthetic: true }, receipt: { synthetic: true, canonical_mutation: false } }),
    frontierTransport: async (request) => { providerRequests.push(structuredClone(request)); return frontierTransport(request); },
  });
  async function addPerson({
    membershipId = memberships[0].membership_id, name = 'Jordan Lee', email = 'jordan@example.test',
    profileId = 'mm-20990101-jordan01', readiness = 'READY',
  } = {}) {
    if (!email.endsWith('.test') || !normalizeProfileId(profileId)) throw new Error('REVIEW_SYNTHETIC_PERSON_REQUIRED');
    const issued = await service.createInvitation(tokens[membershipId], { recruit_name: name, recruit_email: email, purpose: 'Synthetic local Consulting review' }, `fixture:${email}`);
    await service.deliverOutbox(issued.outbox_id);
    const invitationId = issued.invitation.invitation_id;
    const candidateId = issued.invitation.candidate_id;
    const result = { invitationId, candidateId, profileId, name, email, membershipId };
    if (readiness === 'INVITED') return result;
    const accepted = await service.acceptInvitation(issued.invitation_token, { accepted: true, version: 'recruiting_v1_consent_2026_08' });
    result.inviteSessionToken = accepted.invite_session_token;
    await service.projectBosInProgress(invitationId, { job_id: `synthetic_${candidateId}` });
    if (readiness === 'BOS_IN_PROGRESS') return result;
    await service.bindBosProfile(invitationId, profileId, { verified: true });
    const assessmentId = `ba_synthetic_${candidateId}`;
    result.assessmentId = assessmentId;
    const authored = authoredFixtureFor({ profileId, name, assessmentId });
    authoredValues.set(profileId, authored);
    if (readiness === 'BOS_READY') { authored.ba = null; authored.receipts.ba.complete = false; return result; }
    if (readiness === 'BA_IN_PROGRESS') {
      await service.projectBaState(invitationId, { assessment_id: assessmentId, state: 'BA_IN_PROGRESS' });
      authored.ba = null; authored.receipts.ba.complete = false;
      return result;
    }
    await service.projectBaState(invitationId, {
      assessment_id: assessmentId, state: 'BA_INTELLIGENCE_READY',
      canonical_receipt: {
        contract: 'recruiting_canonical_new_ba_ready_receipt_v1',
        ...authored.receipts.ba, completeness: 'PASS', customer_projection_completeness: 'COMPLETE',
        retrieval_path: 'injected_synthetic_fixture_only',
      },
    });
    return result;
  }
  return { store, service, runtime, tokens, memberships, authoredValues, authoredSurfacesReader, providerRequests, canonicalReads, redis, addPerson };
}
