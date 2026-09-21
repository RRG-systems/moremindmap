import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createNewBaRouteHandler } from '../api/engine/newBaProductionReadinessV1/routeHandler.js';
import { createNewBosProductionRouteHandler } from '../api/engine/newBosProductionReadinessV1/routeHandler.js';
import { authorizePublicOrRecruitingProductRequest } from '../api/engine/recruitingV1/canonicalAdapters.js';
import { MemoryPublicStore } from '../src/lib/publicSiteAirlockV1/memoryStore.js';
import {
  TEMPORARY_PROFILE_ID_ONLY_READ_MODE,
  temporaryProfileIdOnlyReadEnabled,
} from '../src/lib/publicSiteAirlockV1/temporaryProfileIdOnlyRetrieval.js';
import { createPublicSiteService } from '../src/lib/publicSiteAirlockV1/service.js';

const PROFILE_ID = 'mm-20990101-owner001';
const ENABLED_ENV = {
  PUBLIC_PRODUCT_START_ENFORCEMENT_ENABLED: 'true',
  PUBLIC_TEMPORARY_PROFILE_ID_ONLY_RETRIEVAL_ENABLED: 'true',
};

function responseDouble() {
  return {
    statusCode: 200,
    payload: null,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('temporary Profile-ID-only authority is explicit, reversible and limited to BOS/BA reads', async () => {
  const store = new MemoryPublicStore();
  const request = { headers: {} };
  assert.equal(temporaryProfileIdOnlyReadEnabled(ENABLED_ENV, 'behavior_operating_system'), true);
  assert.equal(temporaryProfileIdOnlyReadEnabled(ENABLED_ENV, 'business_assessment'), true);
  assert.equal(temporaryProfileIdOnlyReadEnabled(ENABLED_ENV, 'more_monthly_intelligence'), false);
  assert.equal(temporaryProfileIdOnlyReadEnabled({ ...ENABLED_ENV, PUBLIC_TEMPORARY_PROFILE_ID_ONLY_RETRIEVAL_ENABLED: 'false' }, 'behavior_operating_system'), false);

  const authority = await authorizePublicOrRecruitingProductRequest({
    req: request,
    store,
    productKey: 'behavior_operating_system',
    profileId: PROFILE_ID,
    env: ENABLED_ENV,
    read: true,
    force: true,
    allowTemporaryProfileIdOnlyRead: true,
  });
  assert.equal(authority.mode, TEMPORARY_PROFILE_ID_ONLY_READ_MODE);

  await assert.rejects(
    authorizePublicOrRecruitingProductRequest({
      req: request,
      store,
      productKey: 'behavior_operating_system',
      profileId: PROFILE_ID,
      env: ENABLED_ENV,
      read: true,
      force: true,
    }),
    /public_product_authority_denied/u,
  );
  await assert.rejects(
    authorizePublicOrRecruitingProductRequest({
      req: request,
      store,
      productKey: 'more_monthly_intelligence',
      profileId: PROFILE_ID,
      env: ENABLED_ENV,
      read: true,
      force: true,
      allowTemporaryProfileIdOnlyRead: true,
    }),
    /public_product_authority_denied/u,
  );
});

test('temporary lookup opens only saved BOS/BA locators while purchase and Subscription retain owner verification', async () => {
  const store = new MemoryPublicStore();
  let ownershipChecks = 0;
  const service = createPublicSiteService({
    store,
    startSigningKey: 'synthetic-start-signing-key-at-least-32-characters',
    complimentaryPepper: 'synthetic-complimentary-pepper-at-least-32-characters',
    profileStateReader: async () => ({ bos: 'ready', ba: 'ready' }),
    ownershipVerifier: async () => { ownershipChecks += 1; return false; },
    temporaryProfileIdOnlyReadEnabled: true,
  });

  const bos = await service.lookupEntry({
    value: PROFILE_ID,
    product_key: 'behavior_operating_system',
  });
  assert.equal(bos.state, 'ready');
  assert.equal(bos.ownership_verified, false);
  assert.equal(bos.temporary_profile_id_only_read, true);
  assert.equal(ownershipChecks, 0);

  const ba = await service.lookupEntry({
    value: PROFILE_ID,
    product_key: 'business_assessment',
  });
  assert.equal(ba.state, 'ready');
  assert.equal(ba.temporary_profile_id_only_read, true);
  assert.equal(ownershipChecks, 0);

  await assert.rejects(
    service.createPurchaseIntent({
      product_key: 'business_assessment',
      profile_id: PROFILE_ID,
      vertical_selection: { vertical_id: 'real_estate', confirmation: 'CUSTOMER_CONFIRMED' },
      idempotency_key: 'temporary-read-must-not-buy',
    }),
    /profile_ownership_required/u,
  );
  assert.deepEqual(
    await service.enterMonthlySubscription({ profile_id: PROFILE_ID }),
    { state: 'ownership_verification_required' },
  );
  assert.equal(ownershipChecks, 2);
});

test('temporary authority is forced read-only and cannot trigger BA projection writes', async () => {
  let bosReadOnly = false;
  const bosResponse = responseDouble();
  await createNewBosProductionRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => ({ mode: TEMPORARY_PROFILE_ID_ONLY_READ_MODE }),
    serviceFactory: async () => ({
      retrieve: async ({ readOnly }) => {
        bosReadOnly = readOnly;
        return { artifact: { profile_id: PROFILE_ID } };
      },
    }),
  })({ method: 'GET', query: { id: PROFILE_ID }, headers: {} }, bosResponse);
  assert.equal(bosResponse.statusCode, 200);
  assert.equal(bosReadOnly, true);

  let baReadOnly = false;
  let projections = 0;
  const baResponse = responseDouble();
  await createNewBaRouteHandler({
    config: { staged: true, canaryEnabled: false, customerActive: true },
    authorizeCustomerRead: async () => ({ mode: TEMPORARY_PROFILE_ID_ONLY_READ_MODE }),
    serviceFactory: async () => ({
      service: {
        retrieve: async ({ readOnly }) => {
          baReadOnly = readOnly;
          return { artifact: { profile_id: PROFILE_ID } };
        },
      },
    }),
    onCanonicalServed: async () => { projections += 1; },
  })({ method: 'GET', query: { id: PROFILE_ID }, headers: {} }, baResponse);
  assert.equal(baResponse.statusCode, 200);
  assert.equal(baReadOnly, true);
  assert.equal(projections, 0);
});

test('ordinary BOS and Profile-ID BA destinations explicitly opt into the temporary read seam', () => {
  const bosRoute = fs.readFileSync(new URL('../api/moremindmap/retrieve-profile.js', import.meta.url), 'utf8');
  const currentBosRoute = fs.readFileSync(new URL('../api/moremindmap/new-bos.js', import.meta.url), 'utf8');
  const baRoute = fs.readFileSync(new URL('../api/business-assessment/retrieve.js', import.meta.url), 'utf8');
  const currentBaRoute = fs.readFileSync(new URL('../api/moremindmap/new-ba.js', import.meta.url), 'utf8');
  for (const source of [bosRoute, currentBosRoute, baRoute, currentBaRoute]) {
    assert.match(source, /allowTemporaryProfileIdOnlyRead:\s*true/u);
  }
  assert.doesNotMatch(
    fs.readFileSync(new URL('../src/lib/publicSiteAirlockV1/productBoundary.js', import.meta.url), 'utf8'),
    /TEMPORARY_PROFILE_ID_ONLY/u,
  );
});
