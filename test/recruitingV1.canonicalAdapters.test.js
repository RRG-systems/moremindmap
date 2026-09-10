import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorizeBusinessAssessmentIdBeforeRead,
  authorizePublicOrRecruitingProductRequest,
  onRecruitingBosVaultVerified,
  projectRecruitingBaState,
  projectRecruitingBosInProgress,
  reconcileRecruitingBosReadyFromCompletedJob,
  reconcileRecruitingCanonicalBaReady,
  reconcileRecruitingCanonicalBaReadySafely,
  resolveRecruitingBaOwnerProfile,
  resolveRecruitingBosStartMetadata,
} from '../api/engine/recruitingV1/canonicalAdapters.js';
import { getRecruitingService, resetSyntheticRecruitingRuntimeForTest } from '../api/engine/recruitingV1/runtime.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import { PRODUCT_EXECUTION_CONTRACT_VERSION } from '../src/lib/publicSiteAirlockV1/productBoundary.js';
import { sealStartToken } from '../src/lib/publicSiteAirlockV1/security.js';

const ENV = { RECRUITING_V1_SYNTHETIC_REVIEW: 'true' };
const ENFORCED_ENV = {
  ...ENV,
  PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
  MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY: 'synthetic-public-start-signing-key-32-bytes',
  MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY: 'synthetic-profile-owner-signing-key-32-bytes',
};
const CONSENT = { accepted: true, version: 'recruiting_v1_consent_2026_08' };
const BOS_JOB_ID = '22222222-2222-5222-a222-222222222222';
const EMPTY_PUBLIC_STORE = Object.freeze({ async get() { return null; } });

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

  const bosStarted = await projectRecruitingBosInProgress({
    relationshipRef: invitation.invitation_id,
    jobId: BOS_JOB_ID,
    env: ENV,
  });
  assert.deepEqual(bosStarted, {
    projected: true,
    candidate_id: invitation.candidate_id,
    readiness_state: 'BOS_IN_PROGRESS',
    progress_state: 'BOS_IN_PROGRESS',
    bos_job_id: BOS_JOB_ID,
  });
  assert.deepEqual(
    await projectRecruitingBosInProgress({ relationshipRef: invitation.invitation_id, jobId: BOS_JOB_ID, env: ENV }),
    bosStarted,
  );
  assert.deepEqual(await projectRecruitingBosInProgress({ relationshipRef: '', env: ENV }), {
    projected: false,
    reason: 'NOT_A_RECRUITING_JOB',
  });

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
  assert.equal((await projectRecruitingBosInProgress({
    relationshipRef: invitation.invitation_id,
    jobId: BOS_JOB_ID,
    env: ENV,
  })).projected, true);
  const owner = await resolveRecruitingBaOwnerProfile(req, 'mm-20990101-attacker1', { required: true, env: ENV });
  assert.equal(owner.owner_profile_id, 'mm-20990101-recruit1');
  assert.notEqual(owner.owner_profile_id, 'mm-20990101-attacker1');
});

test('public enforcement accepts only the exact server-bound Recruiting relationship, Profile, and BA', async () => {
  const { invitation, cookie } = await acceptedRelationship();
  const req = { headers: { cookie }, body: { recruiting_mode: 'forged-client-value-is-not-authority' } };

  const bosStart = await authorizePublicOrRecruitingProductRequest({
    req,
    store: EMPTY_PUBLIC_STORE,
    productKey: 'behavior_operating_system',
    env: ENFORCED_ENV,
    allowUnboundBosStart: true,
  });
  assert.equal(bosStart.mode, 'recruiting_invite_session');
  assert.equal(bosStart.relationship_ref, invitation.invitation_id);

  const metadata = await resolveRecruitingBosStartMetadata(
    req,
    { person_name: 'Synthetic Recruit', recruiting_relationship_ref: 'attacker-controlled' },
    ENFORCED_ENV,
    { authority: bosStart },
  );
  assert.equal(metadata.recruiting_relationship_ref, invitation.invitation_id);

  await assert.rejects(
    authorizePublicOrRecruitingProductRequest({
      req,
      store: EMPTY_PUBLIC_STORE,
      productKey: 'behavior_operating_system',
      relationshipRef: 'invite_other_relationship',
      env: ENFORCED_ENV,
    }),
    /public_product_authority_denied/u,
  );

  const profileId = 'mm-20990101-recruit5';
  await onRecruitingBosVaultVerified({
    relationshipRef: invitation.invitation_id,
    profileId,
    vaultResult: { success: true },
    env: ENFORCED_ENV,
  });
  const owner = await resolveRecruitingBaOwnerProfile(req, 'mm-20990101-attacker1', {
    inspectIfPresent: true,
    env: ENFORCED_ENV,
  });
  assert.equal(owner.owner_profile_id, profileId);

  const bosRead = await authorizePublicOrRecruitingProductRequest({
    req,
    store: EMPTY_PUBLIC_STORE,
    productKey: 'behavior_operating_system',
    profileId,
    read: true,
    force: true,
    allowProfileBoundBosRead: true,
    env: ENFORCED_ENV,
  });
  assert.equal(bosRead.profile_id, profileId);
  await assert.rejects(
    authorizePublicOrRecruitingProductRequest({
      req,
      store: EMPTY_PUBLIC_STORE,
      productKey: 'behavior_operating_system',
      profileId: 'mm-20990101-other001',
      read: true,
      force: true,
      allowProfileBoundBosRead: true,
      env: ENFORCED_ENV,
    }),
    /public_product_authority_denied/u,
  );

  const assessmentId = 'ba-20990101-aabbccdd';
  await assert.rejects(
    authorizePublicOrRecruitingProductRequest({
      req,
      store: EMPTY_PUBLIC_STORE,
      productKey: 'business_assessment',
      profileId,
      relationshipRef: invitation.invitation_id,
      assessmentId,
      env: ENFORCED_ENV,
    }),
    /public_product_authority_denied/u,
  );
  await projectRecruitingBaState({
    relationshipRef: invitation.invitation_id,
    assessmentId,
    state: 'BA_INTAKE_SAVED',
    env: ENFORCED_ENV,
  });
  const ba = await authorizePublicOrRecruitingProductRequest({
    req,
    store: EMPTY_PUBLIC_STORE,
    productKey: 'business_assessment',
    profileId,
    relationshipRef: invitation.invitation_id,
    assessmentId,
    env: ENFORCED_ENV,
  });
  assert.equal(ba.assessment_id, assessmentId);

  for (const scopedMismatch of [
    { relationshipRef: 'invite_other_relationship', profileId, assessmentId },
    { relationshipRef: invitation.invitation_id, profileId: 'mm-20990101-other001', assessmentId },
    { relationshipRef: invitation.invitation_id, profileId, assessmentId: 'ba-20990101-ffffffff' },
  ]) {
    await assert.rejects(
      authorizePublicOrRecruitingProductRequest({
        req,
        store: EMPTY_PUBLIC_STORE,
        productKey: 'business_assessment',
        env: ENFORCED_ENV,
        ...scopedMismatch,
      }),
      /public_product_authority_denied/u,
    );
  }

  await assert.rejects(
    authorizePublicOrRecruitingProductRequest({
      req: { headers: {}, body: { recruiting_mode: 'accepted_invitation' } },
      store: EMPTY_PUBLIC_STORE,
      productKey: 'behavior_operating_system',
      env: ENFORCED_ENV,
      allowUnboundBosStart: true,
    }),
    /public_product_authority_denied/u,
  );
});

test('completed Recruiting BOS status repairs only an exact verified Vault/job binding', async () => {
  const { invitation, cookie } = await acceptedRelationship();
  const req = { headers: { cookie } };
  const authority = await authorizePublicOrRecruitingProductRequest({
    req,
    store: EMPTY_PUBLIC_STORE,
    productKey: 'behavior_operating_system',
    relationshipRef: invitation.invitation_id,
    env: ENFORCED_ENV,
  });
  const profileId = 'mm-20990101-repair01';
  const job = {
    job_id: 'job-recruiting-complete',
    status: 'complete',
    canonical_profile_id: profileId,
    payload: { metadata: { recruiting_relationship_ref: invitation.invitation_id } },
  };
  const exactVault = {
    profile_id: profileId,
    job_id: job.job_id,
    created_at: '2099-01-01T00:00:00.000Z',
    canonical_profile_json: { vector_scores: { action: 7 } },
  };

  await assert.rejects(
    reconcileRecruitingBosReadyFromCompletedJob({
      redis: { async get() { return JSON.stringify({ ...exactVault, job_id: 'other-job' }); } },
      authority,
      job,
      env: ENFORCED_ENV,
    }),
    /RECRUITING_COMPLETED_BOS_VAULT_IDENTITY_MISMATCH/u,
  );
  await assert.rejects(
    resolveRecruitingBaOwnerProfile(req, '', { required: true, env: ENFORCED_ENV }),
    /RECRUITING_BOS_READY_REQUIRED_FOR_BA/u,
  );

  const repaired = await reconcileRecruitingBosReadyFromCompletedJob({
    redis: { async get(key) {
      assert.equal(key, `vault:profile:${profileId}`);
      return JSON.stringify(exactVault);
    } },
    authority,
    job,
    env: ENFORCED_ENV,
  });
  assert.equal(repaired.projected, true);
  assert.equal(repaired.reconciled, true);

  const refreshedAuthority = await authorizePublicOrRecruitingProductRequest({
    req,
    store: EMPTY_PUBLIC_STORE,
    productKey: 'behavior_operating_system',
    profileId,
    env: ENFORCED_ENV,
    read: true,
    force: true,
    allowProfileBoundBosRead: true,
  });
  const alreadyBound = await reconcileRecruitingBosReadyFromCompletedJob({
    redis: { async get() { throw new Error('Vault must not be reread after exact binding'); } },
    authority: refreshedAuthority,
    job,
    env: ENFORCED_ENV,
  });
  assert.equal(alreadyBound.reason, 'RECRUITING_BOS_ALREADY_BOUND');
});

test('BA Profile and Assessment locators require exact pre-read authority', async () => {
  const { invitation, cookie } = await acceptedRelationship();
  const profileId = 'mm-20990101-baread01';
  const assessmentId = 'ba-20990101-a1b2c3d4';
  await onRecruitingBosVaultVerified({
    relationshipRef: invitation.invitation_id,
    profileId,
    vaultResult: { success: true },
    env: ENFORCED_ENV,
  });
  await projectRecruitingBaState({
    relationshipRef: invitation.invitation_id,
    assessmentId,
    state: 'BA_INTAKE_SAVED',
    env: ENFORCED_ENV,
  });
  const req = { headers: { cookie } };
  const profileRead = await authorizePublicOrRecruitingProductRequest({
    req,
    store: EMPTY_PUBLIC_STORE,
    productKey: 'business_assessment',
    profileId,
    read: true,
    force: true,
    allowProfileBoundBaRead: true,
    env: ENFORCED_ENV,
  });
  assert.equal(profileRead.profile_id, profileId);
  const assessmentRead = await authorizeBusinessAssessmentIdBeforeRead({
    req,
    store: EMPTY_PUBLIC_STORE,
    assessmentId,
    env: ENFORCED_ENV,
  });
  assert.equal(assessmentRead.assessment_id, assessmentId);
  await assert.rejects(
    authorizeBusinessAssessmentIdBeforeRead({
      req,
      store: EMPTY_PUBLIC_STORE,
      assessmentId: 'ba-20990101-ffffffff',
      env: ENFORCED_ENV,
    }),
    /public_product_authority_denied/u,
  );

  const store = new MemoryPublicStore();
  const grantId = 'grant_ba_locator';
  const publicProfileId = 'mm-20990101-public01';
  const publicAssessmentId = 'ba-20990101-1234abcd';
  await store.set(`access_grant:${grantId}`, JSON.stringify({
    grant_id: grantId,
    status: 'active',
    product_key: 'business_assessment',
    profile_id: publicProfileId,
  }));
  await store.set(`public_product_v1:grant_execution:${grantId}`, JSON.stringify({
    contract_version: PRODUCT_EXECUTION_CONTRACT_VERSION,
    authority_type: 'PUBLIC_GRANT',
    authority_ref: grantId,
    product_key: 'business_assessment',
    state: 'COMMITTED',
    identifiers: { assessment_id: publicAssessmentId },
  }));
  const token = sealStartToken(
    { grant_id: grantId, product_key: 'business_assessment' },
    ENFORCED_ENV.MOREMINDMAP_SERVER_ONLY_PRODUCT_START_SIGNING_KEY,
  );
  const publicRead = await authorizeBusinessAssessmentIdBeforeRead({
    req: { headers: { 'x-more-start-token': token } },
    store,
    assessmentId: publicAssessmentId,
    env: ENFORCED_ENV,
  });
  assert.equal(publicRead.profile_id, publicProfileId);
  await assert.rejects(
    authorizeBusinessAssessmentIdBeforeRead({
      req: { headers: { 'x-more-start-token': token } },
      store,
      assessmentId: 'ba-20990101-ffffffff',
      env: ENFORCED_ENV,
    }),
    /public_product_authority_denied/u,
  );
});

test('canonical projection failure records only a retryable sanitized receipt and never invalidates accepted BA', async () => {
  resetSyntheticRecruitingRuntimeForTest();
  const writes = [];
  const assessmentId = 'ba-20990101-acde0004';
  const redis = {
    async get(key) {
      if (key === 'business_assessment_by_profile:mm-20990101-recruit4') return assessmentId;
      return JSON.stringify({
        assessment_id: assessmentId,
        owner_profile_id: 'mm-20990101-recruit4',
        metadata: { recruiting_relationship_ref: 'invite_unavailable_runtime' },
      });
    },
    async set(...args) { writes.push(args); return 'OK'; },
  };
  const result = {
    artifact: {
      profile_id: 'mm-20990101-recruit4',
      assessment_id: assessmentId,
      realization_id: `new-ba:mm-20990101-recruit4:${assessmentId}:fixture`,
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

test('manager preparation authorization loss is never converted into a canonical BA retry receipt', async () => {
  const writes = [];
  const profileId = 'mm-20990101-manager4';
  const assessmentId = 'ba-20990101-acde1234';
  const redis = {
    async get(key) {
      if (key === `business_assessment_by_profile:${profileId}`) return assessmentId;
      return JSON.stringify({
        assessment_id: assessmentId,
        owner_profile_id: profileId,
        metadata: { recruiting_relationship_ref: 'invite-manager-revoked' },
      });
    },
    async set(...args) { writes.push(args); return 'OK'; },
  };
  const result = {
    artifact: {
      profile_id: profileId,
      assessment_id: assessmentId,
      realization_id: `new-ba:${profileId}:${assessmentId}:fixture`,
      state: { completeness: 'COMPLETE' },
    },
    receipt: {
      path: 'current_fast_path',
      realization_sha256: 'a'.repeat(64),
      artifact_sha256: 'b'.repeat(64),
      completeness: 'PASS',
    },
  };
  await assert.rejects(
    reconcileRecruitingCanonicalBaReadySafely({
      redis,
      result,
      env: { RECRUITING_V1_NAMESPACE: 'preview:recruiting-v1:revoked-test' },
      authority: {
        mode: 'recruiting_manager_candidate_preparation',
        relationship_ref: 'invite-manager-revoked',
        candidate_id: 'candidate-manager-revoked',
        profile_id: profileId,
        assessment_id: assessmentId,
      },
      service: {
        async projectBaState() { throw new Error('RECRUITING_MANAGER_MEMBERSHIP_INACTIVE'); },
      },
    }),
    /RECRUITING_MANAGER_MEMBERSHIP_INACTIVE/u,
  );
  assert.equal(writes.length, 0);
});

test('manager preparation refuses a moved canonical BA pointer before projection and writes no retry receipt', async () => {
  const writes = [];
  let projectionCalls = 0;
  const profileId = 'mm-20990101-manager5';
  const assessmentId = 'ba-20990101-acde1235';
  const result = {
    artifact: {
      profile_id: profileId,
      assessment_id: assessmentId,
      realization_id: `new-ba:${profileId}:${assessmentId}:fixture`,
      state: { completeness: 'COMPLETE' },
    },
    receipt: {
      path: 'current_fast_path',
      realization_sha256: 'a'.repeat(64),
      artifact_sha256: 'b'.repeat(64),
      completeness: 'PASS',
    },
  };
  await assert.rejects(
    reconcileRecruitingCanonicalBaReadySafely({
      redis: {
        async get(key) {
          if (key === `business_assessment_by_profile:${profileId}`) return 'ba-20990101-deadbeef';
          throw new Error(`unexpected_stale_assessment_read:${key}`);
        },
        async set(...args) { writes.push(args); return 'OK'; },
      },
      result,
      authority: {
        mode: 'recruiting_manager_candidate_preparation',
        relationship_ref: 'invite-manager-pointer-moved',
        candidate_id: 'candidate-manager-pointer-moved',
        profile_id: profileId,
        assessment_id: assessmentId,
      },
      service: {
        async projectBaState() { projectionCalls += 1; },
      },
    }),
    /RECRUITING_CANONICAL_BA_ASSESSMENT_POINTER_MISMATCH/u,
  );
  assert.equal(projectionCalls, 0);
  assert.equal(writes.length, 0);
});

test('manager BA projection atomically refuses pointer or assessment changes after canonical read', async (t) => {
  const profileId = 'mm-20990101-manager6';
  const assessmentId = 'ba-20990101-acde1236';
  const pointerKey = `business_assessment_by_profile:${profileId}`;
  const assessmentKey = `business_assessment:${assessmentId}`;
  const pointerRaw = ` ${assessmentId.toUpperCase()} `;
  const assessmentRaw = `${JSON.stringify({
    assessment_id: assessmentId,
    owner_profile_id: profileId,
    metadata: { recruiting_relationship_ref: 'invite-manager-source-race' },
  })}\n`;
  const result = {
    artifact: {
      profile_id: profileId,
      assessment_id: assessmentId,
      realization_id: `new-ba:${profileId}:${assessmentId}:fixture`,
      state: { completeness: 'COMPLETE' },
    },
    receipt: {
      path: 'current_fast_path',
      realization_sha256: 'a'.repeat(64),
      artifact_sha256: 'b'.repeat(64),
      completeness: 'PASS',
    },
  };
  const authority = {
    mode: 'recruiting_manager_candidate_preparation',
    relationship_ref: 'invite-manager-source-race',
    candidate_id: 'candidate-manager-source-race',
    profile_id: profileId,
    assessment_id: assessmentId,
  };

  for (const scenario of [
    { name: 'Profile to Assessment pointer changes', key: pointerKey, replacement: 'ba-20990101-deadbeef' },
    { name: 'canonical Assessment JSON changes', key: assessmentKey, replacement: assessmentRaw.replace('}\n', ',"revision":2}\n') },
  ]) {
    await t.test(scenario.name, async () => {
      const values = new Map([[pointerKey, pointerRaw], [assessmentKey, assessmentRaw]]);
      const writes = [];
      let readyProjected = false;
      const redis = {
        async get(key) { return values.get(key) ?? null; },
        async set(...args) { writes.push(args); return 'OK'; },
      };
      const service = {
        async projectBaState(_relationshipRef, input) {
          assert.deepEqual(input.canonical_source_guard.guards, [
            { key: pointerKey, expected: pointerRaw },
            { key: assessmentKey, expected: assessmentRaw },
          ]);
          values.set(scenario.key, scenario.replacement);
          await input.canonical_source_guard.assertCurrent();
          readyProjected = true;
          return { candidate_id: authority.candidate_id, ba_readiness: 'BA_INTELLIGENCE_READY' };
        },
      };

      await assert.rejects(
        reconcileRecruitingCanonicalBaReadySafely({ redis, result, authority, service }),
        /RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED/u,
      );
      assert.equal(readyProjected, false);
      assert.equal(writes.length, 0);
    });
  }
});

test('manager BA projection carries the pre-generation source guard across a completed New BA retrieval', async () => {
  const profileId = 'mm-20990101-manager7';
  const assessmentId = 'ba-20990101-acde1237';
  const pointerKey = `business_assessment_by_profile:${profileId}`;
  const assessmentKey = `business_assessment:${assessmentId}`;
  const pointerRaw = assessmentId;
  const assessmentRaw = JSON.stringify({
    assessment_id: assessmentId,
    owner_profile_id: profileId,
    metadata: { recruiting_relationship_ref: 'invite-manager-pre-generation' },
    revision: 1,
  });
  const values = new Map([
    [pointerKey, pointerRaw],
    [assessmentKey, assessmentRaw.replace('"revision":1', '"revision":2')],
  ]);
  const canonicalSourceGuard = {
    guards: [
      { key: pointerKey, expected: pointerRaw },
      { key: assessmentKey, expected: assessmentRaw },
    ],
    async assertCurrent() {
      for (const guard of this.guards) {
        if (values.get(guard.key) !== guard.expected) {
          throw new Error('RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED');
        }
      }
    },
  };
  let projected = false;
  const result = {
    artifact: {
      profile_id: profileId,
      assessment_id: assessmentId,
      realization_id: `new-ba:${profileId}:${assessmentId}:fixture`,
      state: { completeness: 'COMPLETE' },
    },
    receipt: {
      path: 'rebuilt_missing',
      realization_sha256: 'a'.repeat(64),
      artifact_sha256: 'b'.repeat(64),
      completeness: 'PASS',
    },
  };
  await assert.rejects(
    reconcileRecruitingCanonicalBaReadySafely({
      redis: { async get(key) { return values.get(key) ?? null; }, async set() { throw new Error('retry receipt must not be written'); } },
      result,
      canonicalSourceGuard,
      authority: {
        mode: 'recruiting_manager_candidate_preparation',
        relationship_ref: 'invite-manager-pre-generation',
        candidate_id: 'candidate-manager-pre-generation',
        profile_id: profileId,
        assessment_id: assessmentId,
      },
      service: {
        async projectBaState(_relationshipRef, input) {
          await input.canonical_source_guard.assertCurrent();
          projected = true;
          return { candidate_id: 'candidate-manager-pre-generation', ba_readiness: 'BA_INTELLIGENCE_READY' };
        },
      },
    }),
    /RECRUITING_CANONICAL_BA_SOURCE_GUARD_CHANGED/u,
  );
  assert.equal(projected, false);
});

test('canonical New BA fast-path retrieval reconciles Recruiting readiness without legacy output authority', async () => {
  const { invitation } = await acceptedRelationship();
  await onRecruitingBosVaultVerified({
    relationshipRef: invitation.invitation_id,
    profileId: 'mm-20990101-recruit3',
    vaultResult: { success: true },
    env: ENV,
  });
  const assessmentId = 'ba-20990101-acde0003';
  await projectRecruitingBaState({
    relationshipRef: invitation.invitation_id,
    assessmentId,
    state: 'BA_INTAKE_SAVED',
    env: ENV,
  });
  const assessment = {
    assessment_id: assessmentId,
    owner_profile_id: 'MM-20990101-RECRUIT3',
    metadata: { recruiting_relationship_ref: invitation.invitation_id },
    output: { business_intelligence_draft: { ignored: true } },
  };
  const result = {
    artifact: {
      profile_id: 'mm-20990101-recruit3',
      assessment_id: assessmentId,
      realization_id: `new-ba:mm-20990101-recruit3:${assessmentId}:fixture`,
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
    redis: {
      async get(key) {
        if (key === 'business_assessment_by_profile:mm-20990101-recruit3') return assessmentId;
        return JSON.stringify(assessment);
      },
    },
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

test('manager preparation can reconcile completed BOS only for its exact server-bound candidate and job', async () => {
  const profileId = 'mm-20990101-manager1';
  const job = {
    job_id: 'job-manager-preparation',
    status: 'complete',
    canonical_profile_id: profileId,
    payload: { metadata: { recruiting_relationship_ref: 'invite-manager-preparation' } },
  };
  const authority = {
    mode: 'recruiting_manager_candidate_preparation',
    relationship_ref: 'invite-manager-preparation',
    candidate_id: 'candidate-manager-preparation',
    bos_job_id: job.job_id,
    profile_id: null,
  };
  const redis = { async get() { return JSON.stringify({ profile_id: profileId, job_id: job.job_id, canonical_profile_json: { valid: true } }); } };

  await assert.rejects(
    reconcileRecruitingBosReadyFromCompletedJob({
      redis,
      authority: { ...authority, bos_job_id: 'different-job' },
      job,
      service: { async bindBosProfile() { throw new Error('must not bind'); } },
    }),
    /RECRUITING_COMPLETED_BOS_JOB_AUTHORITY_MISMATCH/u,
  );

  let bound = null;
  const result = await reconcileRecruitingBosReadyFromCompletedJob({
    redis,
    authority,
    job,
    service: {
      async bindBosProfile(relationshipRef, receivedProfile, receipt, options) {
        bound = { relationshipRef, receivedProfile, receipt, options };
        return { candidate_id: authority.candidate_id, readiness_state: 'BOS_READY' };
      },
    },
  });
  assert.equal(result.reconciled, true);
  assert.equal(bound.relationshipRef, authority.relationship_ref);
  assert.equal(bound.receivedProfile, profileId);
  assert.equal(bound.receipt.verified, true);
  assert.equal(bound.options.preparationAuthority, authority);
});
