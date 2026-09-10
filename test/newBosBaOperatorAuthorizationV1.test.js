import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NEW_BA_PRODUCTION_ENVIRONMENT_CONTRACT,
  readNewBaProductionConfig,
} from '../api/engine/newBaProductionReadinessV1/config.js';
import { createNewBaRouteHandler } from '../api/engine/newBaProductionReadinessV1/routeHandler.js';
import { createNewBosProductionRouteHandler } from '../api/engine/newBosProductionReadinessV1/routeHandler.js';
import { assertNewBaGenerationOperatorAuthority } from '../api/moremindmap/new-ba-generation.js';

const PLATFORM_AUTHORITY = 'synthetic-platform-authority-secret-1234567890';

function responseDouble() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

function customerActiveConfig(overrides = {}) {
  return {
    staged: true,
    canaryEnabled: false,
    customerActive: true,
    platformAuthoritySecret: PLATFORM_AUTHORITY,
    ...overrides,
  };
}

test('New BOS diagnostics require exact platform authority even when customer runtime is active', async () => {
  let factoryCalls = 0;
  const seen = [];
  const handler = createNewBosProductionRouteHandler({
    config: customerActiveConfig(),
    serviceFactory: async () => {
      factoryCalls += 1;
      return {
        diagnose: async (input) => { seen.push(input); return { ok: true }; },
      };
    },
  });
  const request = {
    method: 'GET',
    headers: {},
    query: { diagnostic: 'state', id: 'MM-20990101-DEMO0001' },
  };

  for (const authority of ['', 'wrong-platform-authority-secret-1234567890']) {
    const response = responseDouble();
    await handler({ ...request, headers: { 'x-more-platform-authority': authority } }, response);
    assert.equal(response.statusCode, 403);
  }
  assert.equal(factoryCalls, 0);

  const authorizedResponse = responseDouble();
  await handler({
    ...request,
    headers: { 'x-more-platform-authority': PLATFORM_AUTHORITY },
  }, authorizedResponse);
  assert.equal(authorizedResponse.statusCode, 200);
  assert.equal(factoryCalls, 1);
  assert.equal(seen[0].platformProtected, true);
});

test('New BOS customer retrieval remains owner-authorized and does not require platform authority', async () => {
  let ownerCalls = 0;
  const handler = createNewBosProductionRouteHandler({
    config: customerActiveConfig(),
    authorizeCustomerRead: async ({ profileId }) => {
      ownerCalls += 1;
      assert.equal(profileId, 'MM-20990101-DEMO0001');
      return { mode: 'profile_owner_receipt' };
    },
    serviceFactory: async () => ({
      retrieve: async (input) => {
        assert.equal(input.platformProtected, false);
        return {
          artifact: { safe: true },
          receipt: { profile_id: 'MM-20990101-DEMO0001', provider_accounting: { calls: 4 } },
        };
      },
    }),
  });
  const response = responseDouble();
  await handler({
    method: 'GET',
    headers: {},
    query: { id: 'MM-20990101-DEMO0001' },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(ownerCalls, 1);
  assert.deepEqual(response.payload, { artifact: { safe: true } });
  assert.equal(Object.hasOwn(response.payload, 'receipt'), false);
});

test('New BA diagnostics require exact platform authority even when customer runtime is active', async () => {
  let factoryCalls = 0;
  const seen = [];
  const handler = createNewBaRouteHandler({
    config: customerActiveConfig(),
    serviceFactory: async () => {
      factoryCalls += 1;
      return {
        diagnose: async (input) => { seen.push(input); return { ok: true }; },
      };
    },
  });
  const request = {
    method: 'GET',
    headers: {},
    query: { diagnostic: 'state', id: 'MM-20990101-DEMO0001' },
  };

  for (const authority of ['', 'wrong-platform-authority-secret-1234567890']) {
    const response = responseDouble();
    await handler({ ...request, headers: { 'x-more-platform-authority': authority } }, response);
    assert.equal(response.statusCode, 403);
  }
  assert.equal(factoryCalls, 0);

  const authorizedResponse = responseDouble();
  await handler({
    ...request,
    headers: { 'x-more-platform-authority': PLATFORM_AUTHORITY },
  }, authorizedResponse);
  assert.equal(authorizedResponse.statusCode, 200);
  assert.equal(factoryCalls, 1);
  assert.equal(seen[0].platformProtected, true);
});

test('New BA customer retrieval remains owner-authorized and does not require platform authority', async () => {
  let ownerCalls = 0;
  const handler = createNewBaRouteHandler({
    config: customerActiveConfig(),
    authorizeCustomerRead: async ({ profileId }) => {
      ownerCalls += 1;
      assert.equal(profileId, 'MM-20990101-DEMO0001');
      return { mode: 'profile_owner_receipt' };
    },
    serviceFactory: async () => ({
      retrieve: async (input) => {
        assert.equal(input.platformProtected, false);
        return {
          artifact: { safe: true },
          receipt: {
            profile_id: 'MM-20990101-DEMO0001',
            assessment_id: 'ba-20990101-deadbeef',
            provider_calls: 4,
          },
        };
      },
    }),
  });
  const response = responseDouble();
  await handler({
    method: 'GET',
    headers: {},
    query: { id: 'MM-20990101-DEMO0001' },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(ownerCalls, 1);
  assert.deepEqual(response.payload, { artifact: { safe: true } });
  assert.equal(Object.hasOwn(response.payload, 'receipt'), false);
});

test('customer-active BOS and BA success shaping fails closed when no public artifact exists', async () => {
  for (const [createHandler, expectedError] of [
    [createNewBosProductionRouteHandler, 'New BOS realization unavailable'],
    [createNewBaRouteHandler, 'New BA realization unavailable'],
  ]) {
    const handler = createHandler({
      config: customerActiveConfig(),
      authorizeCustomerRead: async () => ({ mode: 'profile_owner_receipt' }),
      serviceFactory: async () => ({
        retrieve: async () => ({ receipt: { provider_calls: 4 } }),
      }),
    });
    const response = responseDouble();
    await handler({
      method: 'GET',
      headers: {},
      query: { id: 'MM-20990101-DEMO0001' },
    }, response);
    assert.equal(response.statusCode, 500);
    assert.deepEqual(Object.keys(response.payload).sort(), ['error', 'safe_code']);
    assert.equal(response.payload.error, expectedError);
    assert.equal(Object.hasOwn(response.payload, 'receipt'), false);
  }
});

test('New BA platform authority is server-configured and missing authority fails closed', () => {
  const configured = readNewBaProductionConfig({
    NEW_BA_PRODUCTION_STAGED: 'true',
    NEW_BA_CANARY_ENABLED: 'true',
    NEW_BA_PLATFORM_AUTHORITY_SECRET: PLATFORM_AUTHORITY,
  });
  assert.equal(configured.platformAuthoritySecret, PLATFORM_AUTHORITY);
  assert.equal(NEW_BA_PRODUCTION_ENVIRONMENT_CONTRACT.includes('NEW_BA_PLATFORM_AUTHORITY_SECRET'), true);
  assert.equal(readNewBaProductionConfig({}).platformAuthoritySecret, '');
});

test('customer-active New BA generation operations require exact platform authority', () => {
  const config = customerActiveConfig();
  assert.throws(
    () => assertNewBaGenerationOperatorAuthority({ headers: {} }, config),
    /new_ba_real_profile_generation_access_denied/u,
  );
  assert.throws(
    () => assertNewBaGenerationOperatorAuthority({
      headers: { 'x-more-platform-authority': 'wrong-platform-authority-secret-1234567890' },
    }, config),
    /new_ba_real_profile_generation_access_denied/u,
  );
  assert.doesNotThrow(() => assertNewBaGenerationOperatorAuthority({
    headers: { 'x-more-platform-authority': PLATFORM_AUTHORITY },
  }, config));
});

test('private canary New BA generation retains its exact canary-token authority path', () => {
  assert.doesNotThrow(() => assertNewBaGenerationOperatorAuthority({ headers: {} }, {
    staged: true,
    canaryEnabled: true,
    customerActive: false,
    platformAuthoritySecret: '',
  }));
});
