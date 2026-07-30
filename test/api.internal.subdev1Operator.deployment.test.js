import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSubdev1OperatorDeploymentHandler,
} from '../api/internal/subdev1-operator.js';
import {
  InMemorySubdev1OperatorBridgeStore,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';

const origin = 'https://private.example.test';
const accessCode = ['SUB', 'DEV', '1'].join('');

function environment(overrides = {}) {
  return {
    NODE_ENV: 'test',
    MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'true',
    MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED: 'false',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'true',
    MORE_SUBDEV1_OPERATOR_CODE: accessCode,
    MORE_SUBDEV1_OPERATOR_SIGNING_SECRET:
      'deployment-api-signing-secret-at-least-thirty-two-bytes',
    MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: origin,
    MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: 'private_beta_test',
    MORE_SUBDEV1_OPERATOR_TTL_SECONDS: '900',
    ...overrides,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    headers: new Map(),
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function request() {
  return {
    method: 'GET',
    headers: {
      origin,
      cookie: '',
      'x-subdev1-csrf-intent': 'POST',
    },
  };
}

test('default deployment API stays locked and does not construct bindings while off', async () => {
  let builds = 0;
  const route = createSubdev1OperatorDeploymentHandler({
    env: environment({ MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'false' }),
    buildBinding: async () => {
      builds += 1;
      throw new Error('must not construct');
    },
  });
  const res = response();
  await route(request(), res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'feature_unavailable');
  assert.equal(builds, 0);
});

test('complete deployment binding supplies the API store and repository lazily', async () => {
  let builds = 0;
  const store = new InMemorySubdev1OperatorBridgeStore();
  const profileRepository = {
    async resolveExactProfile() {
      return { status: 'NOT_FOUND', record: null };
    },
  };
  const route = createSubdev1OperatorDeploymentHandler({
    env: environment(),
    buildBinding: async () => {
      builds += 1;
      return {
        ok: true,
        operatorStore: store,
        profileRepository,
      };
    },
  });
  const first = response();
  await route(request(), first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.active, false);
  assert.equal(typeof first.body.csrf_token, 'string');
  assert.equal(builds, 1);
  const second = response();
  await route(request(), second);
  assert.equal(second.statusCode, 200);
  assert.equal(builds, 1);
  assert.equal(JSON.stringify(first.body).includes(accessCode), false);
});

test('incomplete deployment binding fails closed without local fallback', async () => {
  const route = createSubdev1OperatorDeploymentHandler({
    env: environment(),
    buildBinding: async () => ({
      ok: false,
      code: 'OPERATOR_BRIDGE_CONFIGURATION_INVALID',
    }),
  });
  const res = response();
  await route(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'feature_unavailable');
});
