import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAuthorizedSyntheticTopSource,
  createReadOnlyBaAuthorityReader,
} from '../api/engine/newBaProductionReadinessV1/canonicalReader.js';
import { createFrozenCanaryRealizationGenerator } from '../api/engine/newBaProductionReadinessV1/canaryRealizationFactory.js';
import { classifyNewBaCompatibility } from '../api/engine/newBaProductionReadinessV1/compatibility.js';
import { createNewBaModernizationService } from '../api/engine/newBaProductionReadinessV1/modernizationService.js';
import { createPinnedRealProfileCampaignGenerator } from '../api/engine/newBaProductionReadinessV1/productionService.js';
import { createRealProfileNewBaGenerationCampaign } from '../api/engine/newBaProductionReadinessV1/realProfileGenerationCampaign.js';
import { createRedisNewBaBackgroundResponseStore } from '../api/engine/newBaProductionReadinessV1/backgroundResponseStore.js';
import { buildNewBaRealizationIdentityV3 } from '../api/engine/newBaProductionReadinessV1/realizationIdentity.js';
import {
  authorityGuardedBaBackgroundStore,
  authorityGuardedBaProviderClient,
} from '../api/engine/newBaProductionReadinessV1/realProfileGeneration.js';

const PROFILE = 'MM-20990101-AUTH0001';
const EXPECTED_ASSESSMENT = 'ba-20990101-a1b2c3d4';
const EXPECTED_RELATIONSHIP = 'invite-manager-preparation-authority';
const EXPECTED_AUTHORITY = Object.freeze({
  expectedAssessmentId: EXPECTED_ASSESSMENT,
  expectedRelationshipRef: EXPECTED_RELATIONSHIP,
});

function realizationIdentityFor(source) {
  const compatibility = classifyNewBaCompatibility(source);
  return buildNewBaRealizationIdentityV3({
    profileId: source.profile_id,
    assessmentId: source.assessment_id,
    evidenceSha256: source.business_evidence.evidence_sha256,
    bosAuthoritySha256: source.bos_authority.sha256,
    bosFusionContractSha256: source.bos_authority.fusion_contract_sha256,
    bosEvidenceBoundarySha256: source.bos_authority.evidence_boundary_sha256,
    compatibilityClass: compatibility.class,
    verticalBinding: source.business_evidence.vertical_binding,
    providerModel: 'gpt-5.6-sol',
  });
}

function identityReceipt(identity) {
  return Object.freeze({
    version: identity.version,
    realization_id: identity.realization_id,
    sha256: identity.sha256,
  });
}

test('New BA rechecks authority at provider create and retrieve after an earlier outer guard passed', async () => {
  let revoked = false;
  const calls = { authority: 0, create: 0, retrieve: 0 };
  const assertCurrentAuthority = async () => {
    calls.authority += 1;
    if (revoked) throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
  };
  const client = authorityGuardedBaProviderClient({
    responses: {
      async create() { calls.create += 1; return { id: 'resp-ba-authority' }; },
      async retrieve() { calls.retrieve += 1; return { id: 'resp-ba-authority', status: 'completed' }; },
    },
  }, assertCurrentAuthority);

  await assertCurrentAuthority();
  revoked = true;
  await assert.rejects(
    client.responses.create({ store: false }),
    /RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED/u,
  );
  await assert.rejects(
    client.responses.retrieve('resp-ba-authority'),
    /RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED/u,
  );
  assert.deepEqual(calls, { authority: 3, create: 0, retrieve: 0 });
});

test('New BA guards recovery preparation but preserves post-submit response checkpoint custody after revocation', async () => {
  let revoked = false;
  const calls = { authority: 0, prepare: 0, save: 0 };
  const assertCurrentAuthority = async () => {
    calls.authority += 1;
    if (revoked) throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
  };
  const store = authorityGuardedBaBackgroundStore({
    async prepare() { calls.prepare += 1; return { disposition: 'start_new', checkpoint: null }; },
    async load() { return null; },
    async save(input) { calls.save += 1; return input; },
  }, assertCurrentAuthority);

  await assertCurrentAuthority();
  revoked = true;
  await assert.rejects(
    store.prepare({ profileId: PROFILE, generationIdentitySha256: 'a'.repeat(64), stage: 'whole_business_model_v1' }),
    /RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED/u,
  );
  const event = { provider_response_id: 'resp-ba-authority', status: 'queued' };
  assert.equal((await store.save({ event })).event, event);
  assert.deepEqual(calls, { authority: 2, prepare: 0, save: 1 });
});

test('New BA rechecks authority immediately before terminal-checkpoint recovery mutation', async () => {
  const generationIdentitySha256 = 'a'.repeat(64);
  const stage = 'whole_business_model_v1';
  const mutations = [];
  let authorityChecks = 0;
  const assertCurrentAuthority = async () => {
    authorityChecks += 1;
    if (authorityChecks === 2) throw new Error('RECRUITING_MANAGER_MEMBERSHIP_INACTIVE');
  };
  const checkpoint = {
    version: 'new_ba_background_response_checkpoint_v1',
    profile_id: PROFILE,
    generation_identity_sha256: generationIdentitySha256,
    stage,
    scientific_request_sha256: 'b'.repeat(64),
    provider_response_id: 'resp-terminal-ba-authority',
    provider_status: 'failed',
  };
  const rawStore = createRedisNewBaBackgroundResponseStore({
    namespace: 'nonprod:new-ba:manager-preparation-recovery-guard',
    redis: {
      async get(key) {
        return key.includes(':background-response:') && !key.includes(':automatic-recovery-v1')
          ? JSON.stringify(checkpoint)
          : null;
      },
      async set(...args) { mutations.push(args); return 'OK'; },
    },
  });
  const guarded = authorityGuardedBaBackgroundStore(rawStore, assertCurrentAuthority);

  await assert.rejects(
    guarded.prepare({ profileId: PROFILE, generationIdentitySha256, stage, assertCurrentAuthority }),
    /RECRUITING_MANAGER_MEMBERSHIP_INACTIVE/u,
  );
  assert.equal(authorityChecks, 2);
  assert.equal(mutations.length, 0);
});

test('canonical BA reader rejects a swapped assessment pointer before reading its target or BOS authority', async () => {
  const calls = [];
  const reader = createReadOnlyBaAuthorityReader({
    bosNamespace: 'nonprod:new-bos:manager-preparation-test',
    redis: {
      async get(key) {
        calls.push(key);
        return 'ba-20990101-deadbeef';
      },
    },
  });

  await assert.rejects(
    reader.read(PROFILE, EXPECTED_AUTHORITY),
    /new_ba_manager_preparation_assessment_authority_mismatch/u,
  );
  assert.deepEqual(calls, ['business_assessment_by_profile:mm-20990101-auth0001']);
});

test('canonical BA reader rejects a relationship mismatch before normalization or BOS authority reads', async () => {
  const calls = [];
  const reader = createReadOnlyBaAuthorityReader({
    bosNamespace: 'nonprod:new-bos:manager-preparation-test',
    redis: {
      async get(key) {
        calls.push(key);
        if (key === 'business_assessment_by_profile:mm-20990101-auth0001') return EXPECTED_ASSESSMENT;
        if (key === `business_assessment:${EXPECTED_ASSESSMENT}`) {
          return JSON.stringify({ metadata: { recruiting_relationship_ref: 'invite-other-manager' } });
        }
        throw new Error(`unexpected_downstream_read:${key}`);
      },
    },
  });

  await assert.rejects(
    reader.read(PROFILE, EXPECTED_AUTHORITY),
    /new_ba_manager_preparation_relationship_authority_mismatch/u,
  );
  assert.deepEqual(calls, [
    'business_assessment_by_profile:mm-20990101-auth0001',
    `business_assessment:${EXPECTED_ASSESSMENT}`,
  ]);
});

test('modernization retrieval passes exact manager authority to generation and never persists after its rejection', async () => {
  const source = createAuthorizedSyntheticTopSource();
  const expectedAuthority = Object.freeze({
    expectedAssessmentId: source.assessment_id,
    expectedRelationshipRef: EXPECTED_RELATIONSHIP,
  });
  const calls = { authority: [], inspect: 0, generator: 0, persist: 0, pointer: 0 };
  const service = createNewBaModernizationService({
    config: {
      staged: true,
      customerActive: true,
      fusionValidated: true,
      canaryEnabled: false,
      providerEnabled: true,
      persistenceEnabled: true,
      allowedProfileIds: [],
      namespace: 'nonprod:new-ba:manager-preparation-test',
      providerModel: 'gpt-5.6-sol',
    },
    authorityReader: {
      async read(profileId, authority) {
        calls.authority.push([profileId, authority]);
        return source;
      },
    },
    realizationStore: {
      async inspect() { calls.inspect += 1; return { state: 'missing', current: null, pointer: null }; },
      async persistImmutable() { calls.persist += 1; },
      async advancePointer() { calls.pointer += 1; },
    },
    singleFlight: { async run(_key, operation) { return operation(); } },
    generator: {
      async advance(input) {
        calls.generator += 1;
        assert.deepEqual(input.expectedAuthority, expectedAuthority);
        throw new Error('new_ba_manager_preparation_assessment_authority_mismatch');
      },
    },
  });

  await assert.rejects(
    service.retrieve({ profileId: source.profile_id, expectedAuthority }),
    /new_ba_manager_preparation_assessment_authority_mismatch/u,
  );
  assert.deepEqual(calls.authority, [[source.profile_id, expectedAuthority]]);
  assert.equal(calls.generator, 1);
  assert.equal(calls.persist, 0);
  assert.equal(calls.pointer, 0);
});

test('modernization revalidates live manager authority after generation and before immutable realization writes', async () => {
  const source = createAuthorizedSyntheticTopSource();
  const calls = { authorityGuard: 0, generator: 0, persist: 0, pointer: 0 };
  const frozen = createFrozenCanaryRealizationGenerator();
  const expectedAuthority = {
    expectedAssessmentId: source.assessment_id,
    expectedRelationshipRef: EXPECTED_RELATIONSHIP,
    async assertCurrent() {
      calls.authorityGuard += 1;
      if (calls.authorityGuard === 2) throw new Error('RECRUITING_MANAGER_MEMBERSHIP_INACTIVE');
    },
  };
  const service = createNewBaModernizationService({
    config: {
      staged: true,
      customerActive: true,
      fusionValidated: true,
      canaryEnabled: false,
      providerEnabled: true,
      persistenceEnabled: true,
      allowedProfileIds: [],
      namespace: 'nonprod:new-ba:manager-preparation-write-guard',
      providerModel: 'gpt-5.6-sol',
    },
    authorityReader: { async read() { return source; } },
    realizationStore: {
      async inspect() { return { state: 'missing', current: null, pointer: null }; },
      async persistImmutable() { calls.persist += 1; },
      async advancePointer() { calls.pointer += 1; },
    },
    singleFlight: { async run(_key, operation) { return operation(); } },
    generator: {
      async generate(input) {
        calls.generator += 1;
        return frozen.generate(input);
      },
    },
  });

  await assert.rejects(
    service.retrieve({ profileId: source.profile_id, expectedAuthority }),
    /RECRUITING_MANAGER_MEMBERSHIP_INACTIVE/u,
  );
  assert.equal(calls.generator, 1);
  assert.equal(calls.authorityGuard, 2);
  assert.equal(calls.persist, 0);
  assert.equal(calls.pointer, 0);
});

test('campaign pins the same manager authority into its nested stage read and blocks provider/checkpoint work after a swap', async () => {
  const source = {
    ...createAuthorizedSyntheticTopSource(),
    identity_context: { display_name: 'Authority Guard Subject' },
  };
  const expectedAuthority = Object.freeze({
    expectedAssessmentId: source.assessment_id,
    expectedRelationshipRef: EXPECTED_RELATIONSHIP,
  });
  const calls = { authority: 0, checkpointRead: 0, checkpointWrite: 0, failureWrite: 0, provider: 0, realization: 0 };
  const campaign = createRealProfileNewBaGenerationCampaign({
    config: {
      staged: true,
      customerActive: true,
      canaryEnabled: false,
      providerEnabled: true,
      persistenceEnabled: true,
      namespace: 'nonprod:new-ba:manager-preparation-campaign',
      providerModel: 'gpt-5.6-sol',
    },
    redis: {
      async get() { calls.checkpointRead += 1; return null; },
      async set() { calls.checkpointWrite += 1; return 'OK'; },
      async rpush() { calls.failureWrite += 1; return 1; },
      async llen() { return 0; },
    },
    authorityReader: {
      async read(profileId, authority) {
        calls.authority += 1;
        assert.equal(profileId, source.profile_id);
        assert.deepEqual(authority, expectedAuthority);
        if (calls.authority === 2) {
          throw new Error('new_ba_manager_preparation_relationship_authority_mismatch');
        }
        return source;
      },
    },
    realizationStore: {
      async inspect() { calls.realization += 1; return { state: 'missing', current: null, pointer: null }; },
    },
    backgroundResponseStore: {
      async prepare() { calls.provider += 1; throw new Error('provider_must_not_start'); },
    },
    apiKey: 'test-api-key-that-is-long-enough',
  });

  await assert.rejects(
    campaign.advance(source.profile_id, expectedAuthority),
    /new_ba_manager_preparation_relationship_authority_mismatch/u,
  );
  assert.equal(calls.authority, 2);
  assert.equal(calls.checkpointRead, 3);
  assert.equal(calls.checkpointWrite, 0);
  assert.equal(calls.failureWrite, 0);
  assert.equal(calls.provider, 0);
  assert.equal(calls.realization, 0);
});

test('production campaign adapter forwards the exact modernization source identity into the nested campaign', async () => {
  const source = createAuthorizedSyntheticTopSource();
  const realizationIdentity = realizationIdentityFor(source);
  const expectedAuthority = Object.freeze({
    expectedAssessmentId: source.assessment_id,
    expectedRelationshipRef: EXPECTED_RELATIONSHIP,
  });
  let received = null;
  const generator = createPinnedRealProfileCampaignGenerator({
    async advance(...args) {
      received = args;
      return { complete: false };
    },
  });

  await generator.advance({ source, realizationIdentity, expectedAuthority });
  assert.deepEqual(received, [source.profile_id, expectedAuthority, realizationIdentity]);
});

test('nested campaign rejects a canonical source whose full realization identity differs from the modernization snapshot before checkpoint or provider work', async () => {
  const sourceA = {
    ...createAuthorizedSyntheticTopSource(),
    identity_context: { display_name: 'Source Identity A' },
  };
  const sourceB = {
    ...sourceA,
    business_evidence: {
      ...sourceA.business_evidence,
      evidence_sha256: 'f'.repeat(64),
    },
  };
  const expectedIdentityA = realizationIdentityFor(sourceA);
  assert.notEqual(realizationIdentityFor(sourceB).sha256, expectedIdentityA.sha256);
  const calls = { authority: 0, checkpointRead: 0, checkpointWrite: 0, failureWrite: 0, provider: 0, realization: 0 };
  const campaign = createRealProfileNewBaGenerationCampaign({
    config: {
      staged: true,
      customerActive: true,
      canaryEnabled: false,
      providerEnabled: true,
      persistenceEnabled: true,
      namespace: 'nonprod:new-ba:source-identity-pin',
      providerModel: 'gpt-5.6-sol',
    },
    redis: {
      async get() { calls.checkpointRead += 1; return null; },
      async set() { calls.checkpointWrite += 1; return 'OK'; },
      async rpush() { calls.failureWrite += 1; return 1; },
      async llen() { return 0; },
    },
    authorityReader: {
      async read() {
        calls.authority += 1;
        return sourceB;
      },
    },
    realizationStore: {
      async inspect() { calls.realization += 1; return { state: 'missing', current: null, pointer: null }; },
    },
    backgroundResponseStore: {
      async prepare() { calls.provider += 1; throw new Error('provider_must_not_start'); },
    },
    apiKey: 'test-api-key-that-is-long-enough',
  });

  await assert.rejects(
    campaign.advance(sourceA.profile_id, null, expectedIdentityA),
    /new_ba_real_profile_campaign_expected_realization_identity_mismatch/u,
  );
  assert.deepEqual(calls, {
    authority: 1,
    checkpointRead: 0,
    checkpointWrite: 0,
    failureWrite: 0,
    provider: 0,
    realization: 0,
  });
});

test('modernization rejects an ABA nested-source artifact whose generation identity receipt differs even when canonical source returns to A', async () => {
  const sourceA = createAuthorizedSyntheticTopSource();
  const sourceB = {
    ...sourceA,
    business_evidence: {
      ...sourceA.business_evidence,
      evidence_sha256: 'e'.repeat(64),
    },
  };
  const identityA = realizationIdentityFor(sourceA);
  const identityB = realizationIdentityFor(sourceB);
  assert.notEqual(identityB.sha256, identityA.sha256);
  const generatedB = await createFrozenCanaryRealizationGenerator().generate({ source: sourceB });
  const calls = { authority: 0, generator: 0, persist: 0, pointer: 0 };
  const service = createNewBaModernizationService({
    config: {
      staged: true,
      customerActive: true,
      fusionValidated: true,
      canaryEnabled: false,
      providerEnabled: true,
      persistenceEnabled: true,
      allowedProfileIds: [],
      namespace: 'nonprod:new-ba:source-identity-aba',
      providerModel: 'gpt-5.6-sol',
    },
    authorityReader: {
      async read() {
        calls.authority += 1;
        return sourceA;
      },
    },
    realizationStore: {
      async inspect() { return { state: 'missing', current: null, pointer: null }; },
      async persistImmutable() { calls.persist += 1; },
      async advancePointer() { calls.pointer += 1; },
    },
    singleFlight: { async run(_key, operation) { return operation(); } },
    generator: {
      async advance(input) {
        calls.generator += 1;
        assert.equal(input.realizationIdentity.sha256, identityA.sha256);
        return {
          complete: true,
          artifact: generatedB.artifact,
          provider_accounting: generatedB.provider_accounting,
          source_realization_identity: identityReceipt(identityB),
        };
      },
    },
  });

  await assert.rejects(
    service.retrieve({ profileId: sourceA.profile_id }),
    /new_ba_generation_source_identity_mismatch/u,
  );
  assert.deepEqual(calls, { authority: 1, generator: 1, persist: 0, pointer: 0 });
});
