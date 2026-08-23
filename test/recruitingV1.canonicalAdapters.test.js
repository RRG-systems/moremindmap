import assert from 'node:assert/strict';
import test from 'node:test';

import {
  onRecruitingBosVaultVerified,
  projectRecruitingBaState,
  reconcileRecruitingCanonicalBaReady,
  reconcileRecruitingCanonicalBaReadySafely,
  resolveRecruitingBaOwnerProfile,
  resolveRecruitingBosStartMetadata,
} from '../api/engine/recruitingV1/canonicalAdapters.js';
import { getRecruitingService, resetSyntheticRecruitingRuntimeForTest } from '../api/engine/recruitingV1/runtime.js';

const ENV = { RECRUITING_V1_SYNTHETIC_REVIEW: 'true' };
const CONSENT = { accepted: true, version: 'recruiting_v1_consent_2026_08' };

async function acceptedRelationship() {
  resetSyntheticRecruitingRuntimeForTest();
  const service = getRecruitingService(ENV);
  const challenge = await service.requestManagerVerification('mm-20990101-sophia01');
  const verified = await service.verifyManager(challenge.verification_token);
  const created = await service.createInvitation(verified.session_token, {
    recruit_name: 'Synthetic Canonical Recruit',
    recruit_email: 'canonical.recruit@example.test',
    purpose: 'Synthetic adapter proof only.',
  }, 'canonical-adapter-proof');
  const accepted = await service.acceptInvitation(created.invitation_token, CONSENT);
  return {
    service,
    invitation: created.invitation,
    cookie: `__Host-more_recruiting_invite=${accepted.invite_session_token}`,
  };
}

test('canonical BOS and BA adapters derive authority from the accepted HttpOnly relationship', async () => {
  const { invitation, cookie } = await acceptedRelationship();
  const req = { headers: { cookie } };
  const metadata = await resolveRecruitingBosStartMetadata(req, {
    recruiting_mode: 'accepted_invitation',
    recruiting_untrusted_value: 'drop-me',
    person_name: 'Synthetic Canonical Recruit',
  }, ENV);
  assert.equal(metadata.recruiting_relationship_ref, invitation.invitation_id);
  assert.equal(metadata.recruiting_purpose, 'RECRUITING_INTELLIGENCE');
  assert.equal(metadata.recruiting_mode, undefined);
  assert.equal(metadata.recruiting_untrusted_value, undefined);

  await assert.rejects(
    resolveRecruitingBaOwnerProfile(req, 'mm-20990101-attacker1', { required: true, env: ENV }),
    /RECRUITING_BOS_READY_REQUIRED_FOR_BA/,
  );
  await assert.rejects(
    onRecruitingBosVaultVerified({ relationshipRef: invitation.invitation_id, profileId: 'mm-20990101-recruit1', vaultResult: { success: false }, env: ENV }),
    /VERIFIED_BOS_VAULT_RECEIPT_REQUIRED/,
  );
  await onRecruitingBosVaultVerified({
    relationshipRef: invitation.invitation_id,
    profileId: 'mm-20990101-recruit1',
    vaultResult: { success: true, vault_key: 'synthetic-vault-receipt' },
    env: ENV,
  });
  const owner = await resolveRecruitingBaOwnerProfile(req, 'mm-20990101-attacker1', { required: true, env: ENV });
  assert.equal(owner.owner_profile_id, 'mm-20990101-recruit1');
  assert.notEqual(owner.owner_profile_id, 'mm-20990101-attacker1');
});

test('canonical projection failure records only a retryable sanitized receipt and never invalidates accepted BA', async () => {
  resetSyntheticRecruitingRuntimeForTest();
  const writes = [];
  const redis = {
    async get() {
      return JSON.stringify({
        assessment_id: 'ba-synthetic-deferred',
        owner_profile_id: 'mm-20990101-recruit4',
        metadata: { recruiting_relationship_ref: 'invite_unavailable_runtime' },
      });
    },
    async set(...args) { writes.push(args); return 'OK'; },
  };
  const result = {
    artifact: {
      profile_id: 'mm-20990101-recruit4',
      assessment_id: 'ba-synthetic-deferred',
      realization_id: 'new-ba:mm-20990101-recruit4:ba-synthetic-deferred:fixture',
      state: { completeness: 'COMPLETE' },
    },
    receipt: {
      path: 'current_fast_path', realization_sha256: 'e'.repeat(64), artifact_sha256: 'f'.repeat(64), completeness: 'PASS',
    },
  };
  const deferred = await reconcileRecruitingCanonicalBaReadySafely({
    redis,
    result,
    env: {
      RECRUITING_V1_ENABLED: 'true',
      RECRUITING_V1_NAMESPACE: 'preview:recruiting-v1:deferred-test',
    },
  });
  assert.deepEqual(deferred, { projected: false, deferred: true, reason: 'RECRUITING_CANONICAL_PROJECTION_DEFERRED' });
  assert.equal(writes.length, 1);
  const persisted = JSON.parse(writes[0][1]);
  assert.equal(persisted.retryable, true);
  assert.equal(persisted.canonical_ba_accepted, true);
  assert.equal(persisted.raw_error_persisted, false);
  assert.equal(JSON.stringify(persisted).includes('REDIS_URL'), false);
});

test('canonical New BA fast-path retrieval reconciles Recruiting readiness without legacy output authority', async () => {
  const { invitation } = await acceptedRelationship();
  await onRecruitingBosVaultVerified({
    relationshipRef: invitation.invitation_id,
    profileId: 'mm-20990101-recruit3',
    vaultResult: { success: true },
    env: ENV,
  });
  await projectRecruitingBaState({
    relationshipRef: invitation.invitation_id,
    assessmentId: 'ba-synthetic-fast-path',
    state: 'BA_INTAKE_SAVED',
    env: ENV,
  });
  const assessment = {
    assessment_id: 'ba-synthetic-fast-path',
    owner_profile_id: 'MM-20990101-RECRUIT3',
    metadata: { recruiting_relationship_ref: invitation.invitation_id },
    output: { business_intelligence_draft: { ignored: true } },
  };
  const result = {
    artifact: {
      profile_id: 'mm-20990101-recruit3',
      assessment_id: 'ba-synthetic-fast-path',
      realization_id: 'new-ba:mm-20990101-recruit3:ba-synthetic-fast-path:fixture',
      state: { completeness: 'COMPLETE' },
    },
    receipt: {
      path: 'current_fast_path',
      realization_sha256: 'c'.repeat(64),
      artifact_sha256: 'd'.repeat(64),
      completeness: 'PASS',
    },
  };
  const reconciled = await reconcileRecruitingCanonicalBaReady({
    redis: { async get() { return JSON.stringify(assessment); } },
    result,
    env: ENV,
  });
  assert.equal(reconciled.ba_readiness, 'BA_INTELLIGENCE_READY');
});

test('BA Intelligence Ready requires a complete validated canonical New BA receipt, never legacy output fields', async () => {
  const { invitation } = await acceptedRelationship();
  await onRecruitingBosVaultVerified({
    relationshipRef: invitation.invitation_id,
    profileId: 'mm-20990101-recruit2',
    vaultResult: { success: true },
    env: ENV,
  });
  await projectRecruitingBaState({ relationshipRef: invitation.invitation_id, assessmentId: 'ba-synthetic-1', state: 'BA_INTAKE_SAVED', env: ENV });
  await assert.rejects(
    projectRecruitingBaState({
      relationshipRef: invitation.invitation_id,
      assessmentId: 'ba-synthetic-1',
      state: 'BA_INTELLIGENCE_READY',
      env: ENV,
    }),
    /RECRUITING_CANONICAL_BA_RECEIPT_REQUIRED/,
  );
  const result = await projectRecruitingBaState({
    relationshipRef: invitation.invitation_id,
    assessmentId: 'ba-synthetic-1',
    state: 'BA_INTELLIGENCE_READY',
    canonicalReceipt: {
      contract: 'recruiting_canonical_new_ba_ready_receipt_v1',
      profile_id: 'mm-20990101-recruit2',
      assessment_id: 'ba-synthetic-1',
      realization_id: 'new-ba:mm-20990101-recruit2:ba-synthetic-1:fixture',
      realization_sha256: 'a'.repeat(64),
      artifact_sha256: 'b'.repeat(64),
      completeness: 'PASS',
      customer_projection_completeness: 'COMPLETE',
      retrieval_path: 'current_fast_path',
    },
    env: ENV,
  });
  assert.equal(result.ba_readiness, 'BA_INTELLIGENCE_READY');
});
