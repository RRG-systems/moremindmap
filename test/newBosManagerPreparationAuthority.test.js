import assert from 'node:assert/strict';
import test from 'node:test';

import {
  authorityGuardedCheckpointStore,
  authorityGuardedProviderClient,
  authorityGuardedProviderTransport,
} from '../api/engine/newBosProductionReadinessV1/productionGenerator.js';
import { recordSurfaceTransportFailure } from '../api/engine/newBosProductionReadinessV1/boundedSurfaceRealization.js';

test('New BOS blocks provider create and retrieve after manager preparation authority is lost', async () => {
  let revoked = false;
  const calls = { authority: 0, create: 0, retrieve: 0 };
  const assertCurrentAuthority = async () => {
    calls.authority += 1;
    if (revoked) throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
  };
  const client = authorityGuardedProviderClient({
    responses: {
      create: async () => { calls.create += 1; return { id: 'resp_synthetic' }; },
      retrieve: async () => { calls.retrieve += 1; return { id: 'resp_synthetic', status: 'completed' }; },
    },
  }, assertCurrentAuthority);

  assert.equal((await client.responses.create({ store: false })).id, 'resp_synthetic');
  revoked = true;
  await assert.rejects(
    client.responses.create({ store: false }),
    /RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED/u,
  );
  await assert.rejects(
    client.responses.retrieve('resp_synthetic'),
    /RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED/u,
  );
  assert.deepEqual(calls, { authority: 3, create: 1, retrieve: 0 });
});

test('New BOS preserves transport observation custody after submit while blocking semantic publication writes', async () => {
  const observed = [];
  const mutations = [];
  const store = {
    inspect: async () => null,
    prepare: async () => { mutations.push('prepare'); return {}; },
    observe: async (receipt) => { observed.push(receipt); return receipt; },
    accept: async () => { mutations.push('accept'); return {}; },
    rejectSemantic: async () => { mutations.push('rejectSemantic'); return {}; },
  };
  const assertCurrentAuthority = async () => {
    throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
  };
  const guarded = authorityGuardedCheckpointStore(store, assertCurrentAuthority);

  const receipt = {
    campaignSha256: 'a'.repeat(64),
    unitId: 'semantic:causal_foundation',
    event: { provider_response_id: 'resp_synthetic', status: 'queued' },
  };
  await guarded.observe(receipt);
  assert.deepEqual(observed, [receipt]);

  for (const operation of ['prepare', 'accept', 'rejectSemantic']) {
    await assert.rejects(
      guarded[operation]({}),
      /RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED/u,
    );
  }
  assert.deepEqual(mutations, []);
});

test('New BOS surface authority loss before provider submit records a zero-submission abort without terminal poisoning', async () => {
  let providerCalls = 0;
  const guardedTransport = authorityGuardedProviderTransport(async () => {
    providerCalls += 1;
    return { id: 'must-not-exist' };
  }, async () => {
    throw new Error('RECRUITING_CONSULTING_PREPARATION_AUTHORITY_CHANGED');
  });
  const calls = { abort: 0, observe: 0 };
  const checkpointStore = {
    async recordAuthorityAbortBeforeSubmission(input) {
      calls.abort += 1;
      assert.equal(input.expectedRecord.state, 'SUBMISSION_INTENT');
      return { recorded: true };
    },
    async observe() { calls.observe += 1; },
  };
  const prepared = {
    disposition: 'START_INITIAL',
    record: {
      state: 'SUBMISSION_INTENT',
      claim_token_sha256: 'a'.repeat(64),
      observation: null,
    },
  };
  const unit = {
    unit_id: 'surface:recognition',
    unit_identity_sha256: 'b'.repeat(64),
    request_sha256: 'c'.repeat(64),
  };

  let failure;
  try { await guardedTransport({ store: false }); } catch (error) { failure = error; }
  assert.equal(failure.provider_submission_blocked_by_authority, true);
  await recordSurfaceTransportFailure({
    error: failure,
    checkpointStore,
    prepared,
    campaignSha256: 'd'.repeat(64),
    unit,
  });
  assert.equal(providerCalls, 0);
  assert.deepEqual(calls, { abort: 1, observe: 0 });
});
