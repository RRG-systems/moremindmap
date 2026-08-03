import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler, {
  createSubdev1OperatorHandler,
} from '../api/internal/subdev1-operator.js';
import {
  InMemorySubdev1OperatorBridgeStore,
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
  SUBDEV1_PROFILE_RECORD_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const origin = 'http://localhost:5173';
const accessCode = ['SUB', 'DEV', '1'].join('');
const signingSecret = 'synthetic-operator-signing-secret-at-least-thirty-two-bytes';
const profileA = 'mm-20990101-aaaaaaaa';
const profileB = 'mm-20990102-bbbbbbbb';

function env(overrides = {}) {
  return {
    NODE_ENV: 'test',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'true',
    MORE_SUBDEV1_OPERATOR_CODE: accessCode,
    MORE_SUBDEV1_OPERATOR_SIGNING_SECRET: signingSecret,
    MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: origin,
    MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: 'private_beta_synthetic',
    MORE_SUBDEV1_OPERATOR_TTL_SECONDS: '900',
    ...overrides,
  };
}

function record(profileId, suffix) {
  return {
    record_version: SUBDEV1_PROFILE_RECORD_VERSION,
    profile_id: profileId,
    subscriber_subject_ref: `subject_${suffix}`,
    exact_scope: {
      tenant_id: `tenant_${suffix}`,
      profile_id: profileId,
      business_id: `business_${suffix}`,
      subscriber_id: `subscriber_${suffix}`,
    },
    profile_revision: `revision_${suffix}`,
    consent_ref: `consent_${suffix}`,
    consent_purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
    consent_status: 'ACTIVE',
    provenance: {
      source: 'SYNTHETIC_ISOLATED_FIXTURE',
      record_ref: `fixture_${suffix}`,
    },
  };
}

function repository() {
  const records = new Map([
    [profileA, record(profileA, 'a')],
    [profileB, record(profileB, 'b')],
  ]);
  return {
    async resolveExactProfile(profileId) {
      const found = records.get(profileId);
      return found
        ? { status: 'FOUND', record: structuredClone(found) }
        : { status: 'NOT_FOUND', record: null };
    },
  };
}

function randomToken() {
  let count = 0;
  return () => `api-test-token-${String(count += 1).padStart(48, '0')}`;
}

function responseRecorder() {
  return {
    statusCode: 200,
    headers: new Map(),
    body: null,
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
    end() {
      return this;
    },
  };
}

function request({
  method = 'GET',
  body,
  cookie = '',
  requestOrigin = origin,
  contentType = 'application/json',
  csrfProof = '',
  csrfIntent = '',
  diagnostic = false,
} = {}) {
  return {
    method,
    body,
    headers: {
      origin: requestOrigin,
      cookie,
      'content-type': contentType,
      'x-subdev1-csrf': csrfProof,
      'x-subdev1-csrf-intent': csrfIntent,
      'x-more-private-context-diagnostic': diagnostic ? 'predicate-v1' : '',
    },
  };
}

function setCookies(response) {
  const value = response.headers.get('set-cookie');
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function mergeCookieJar(jar, response) {
  const next = new Map(jar);
  for (const serialized of setCookies(response)) {
    const pair = serialized.split(';', 1)[0];
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) next.set(name, value);
    else next.delete(name);
  }
  return next;
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

function handlerFixture(overrides = {}) {
  let now = 1_000;
  const store = overrides.store || new InMemorySubdev1OperatorBridgeStore();
  const route = createSubdev1OperatorHandler({
    env: overrides.env || env(),
    store,
    profileRepository: overrides.profileRepository || repository(),
    clock: () => now,
    randomToken: randomToken(),
  });
  return {
    route,
    store,
    setNow(value) {
      now = value;
    },
  };
}

async function call(route, options) {
  const res = responseRecorder();
  await route(request(options), res);
  return res;
}

async function bootstrap(route, jar = new Map(), csrfIntent = 'POST') {
  const res = await call(route, {
    method: 'GET',
    cookie: cookieHeader(jar),
    csrfIntent,
  });
  return {
    response: res,
    jar: mergeCookieJar(jar, res),
    csrf: res.body?.csrf_token,
  };
}

async function activate(route, bootstrapState, submittedCode = accessCode) {
  const res = await call(route, {
    method: 'POST',
    cookie: cookieHeader(bootstrapState.jar),
    body: {
      operation: 'ACTIVATE',
      access_code: submittedCode,
    },
    csrfProof: bootstrapState.csrf,
  });
  return {
    response: res,
    jar: mergeCookieJar(bootstrapState.jar, res),
  };
}

test('default handler is exported and remains default-off without configuration', async () => {
  assert.equal(typeof handler, 'function');
  const res = await call(handler, { method: 'GET' });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
});

test('GET establishes HttpOnly browser binding and one-time CSRF without authority', async () => {
  const { route } = handlerFixture();
  const state = await bootstrap(route);
  assert.equal(state.response.statusCode, 200);
  assert.equal(state.response.body.active, false);
  assert.equal(state.response.body.profile_state, 'NO_PROFILE');
  assert.equal(typeof state.csrf, 'string');
  const serialized = setCookies(state.response).join('\n');
  assert.match(serialized, /HttpOnly/);
  assert.match(serialized, /SameSite=Strict/);
  assert.doesNotMatch(JSON.stringify(state.response.body), new RegExp(accessCode));
});

test('wrong origin, malformed request, missing code, and wrong code are generic denials', async () => {
  const { route } = handlerFixture();
  const state = await bootstrap(route);
  const originDenied = await call(route, {
    method: 'POST',
    cookie: cookieHeader(state.jar),
    requestOrigin: 'http://attacker.invalid',
    body: {
      operation: 'ACTIVATE',
      access_code: accessCode,
    },
    csrfProof: state.csrf,
  });
  assert.equal(originDenied.statusCode, 403);
  assert.equal(originDenied.body.error, 'request_denied');

  for (const submittedCode of [null, '', 'incorrect']) {
    const refreshed = await bootstrap(route, state.jar);
    const denied = await activate(route, refreshed, submittedCode);
    assert.equal(denied.response.statusCode, 403);
    assert.deepEqual(denied.response.body, { ok: false, error: 'request_denied' });
  }

  const refreshed = await bootstrap(route, state.jar);
  const malformed = await call(route, {
    method: 'POST',
    cookie: cookieHeader(refreshed.jar),
    contentType: 'text/plain',
    body: 'not-json',
    csrfProof: refreshed.csrf,
  });
  assert.equal(malformed.statusCode, 401);
  assert.equal(malformed.body.error, 'authentication_required');
});

test('correct code creates only a temporary customer-independent operator context', async () => {
  const { route, store } = handlerFixture();
  const state = await bootstrap(route);
  const activated = await activate(route, state);
  assert.equal(activated.response.statusCode, 200);
  assert.equal(activated.response.body.active, true);
  assert.equal(activated.response.body.profile_state, 'NO_PROFILE');
  assert.equal(activated.response.body.capability_scope, 'SUBSCRIPTION_PRIVATE_BETA');
  assert.equal('paid_entitlement' in activated.response.body, false);
  assert.equal('coach_authority' in activated.response.body, false);
  assert.equal('canonical_identity_authority' in activated.response.body, false);
  assert.equal('context_token' in activated.response.body, false);
  assert.doesNotMatch(JSON.stringify(activated.response.body), new RegExp(accessCode));
  const stored = store.snapshot().contexts[0][1];
  assert.equal(stored.active_profile, null);
});

test('copied operator cookie without browser binding cannot activate authority', async () => {
  const { route } = handlerFixture();
  const first = await bootstrap(route);
  const activated = await activate(route, first);
  const operatorEntry = [...activated.jar].find(([name]) => name.includes('subdev1_operator'));
  assert.ok(operatorEntry);

  const second = await bootstrap(route);
  const copiedJar = new Map(second.jar);
  copiedJar.set(...operatorEntry);
  const inspected = await bootstrap(route, copiedJar);
  assert.equal(inspected.response.body.active, false);
});

test('privacy-safe diagnostic distinguishes lookup miss from validated context', async () => {
  const { route } = handlerFixture();
  const initial = await bootstrap(route);
  const missJar = new Map(initial.jar);
  missJar.set('more_subdev1_operator', 'missing-context-token-with-sufficient-length-000000');
  const missed = await call(route, {
    method: 'GET',
    cookie: cookieHeader(missJar),
    diagnostic: true,
  });
  assert.equal(missed.statusCode, 200);
  assert.equal(missed.body.active, false);
  assert.deepEqual(missed.body.context_diagnostic, {
    browser_cookie_present: true,
    context_cookie_present: true,
    persistence_lookup: 'MISS',
    context_integrity: 'NOT_EVALUATED',
    failed_predicate_identifier: 'CONTEXT_LOOKUP_MISS',
  });

  const activated = await activate(route, initial);
  const found = await call(route, {
    method: 'GET',
    cookie: cookieHeader(activated.jar),
    diagnostic: true,
  });
  assert.equal(found.statusCode, 200);
  assert.equal(found.body.active, true);
  assert.deepEqual(found.body.context_diagnostic, {
    browser_cookie_present: true,
    context_cookie_present: true,
    persistence_lookup: 'HIT',
    context_integrity: 'PASS',
    failed_predicate_identifier: null,
  });
  assert.equal('context_diagnostic' in initial.response.body, false);
});

test('profile selection resolves exact scope and rejects client-supplied authority claims', async () => {
  const { route } = handlerFixture();
  const initial = await bootstrap(route);
  const activated = await activate(route, initial);
  let ready = await bootstrap(route, activated.jar);

  const injected = await call(route, {
    method: 'POST',
    cookie: cookieHeader(ready.jar),
    body: {
      operation: 'SELECT_PROFILE',
      profile_id: profileA,
      tenant_id: 'attacker',
    },
    csrfProof: ready.csrf,
  });
  assert.equal(injected.statusCode, 401);
  assert.equal(injected.body.error, 'authentication_required');

  ready = await bootstrap(route, activated.jar);
  const selected = await call(route, {
    method: 'POST',
    cookie: cookieHeader(ready.jar),
    body: {
      operation: 'SELECT_PROFILE',
      profile_id: profileA,
    },
    csrfProof: ready.csrf,
  });
  assert.equal(selected.statusCode, 200);
  assert.equal(selected.body.profile_state, 'PROFILE_ACTIVE');
  assert.equal(selected.body.profile_receipt.profile_id, profileA);
  assert.equal(selected.body.profile_receipt.exact_scope.profile_id, profileA);
  assert.equal(selected.body.profile_receipt.exact_scope.tenant_id, 'tenant_a');
  assert.equal('coach_authority' in selected.body, false);
  assert.equal('paid_entitlement' in selected.body, false);
});

test('unknown, malformed, and ambiguous profile outcomes remain non-enumerating', async () => {
  const ambiguousRepository = {
    async resolveExactProfile() {
      return { status: 'AMBIGUOUS', record: null };
    },
  };
  for (const profileRepository of [repository(), ambiguousRepository]) {
    const { route } = handlerFixture({ profileRepository });
    const initial = await bootstrap(route);
    const activated = await activate(route, initial);
    const ready = await bootstrap(route, activated.jar);
    const selected = await call(route, {
      method: 'POST',
      cookie: cookieHeader(ready.jar),
      body: {
        operation: 'SELECT_PROFILE',
        profile_id: profileRepository === ambiguousRepository
          ? profileA
          : 'mm-20990103-cccccccc',
      },
      csrfProof: ready.csrf,
    });
    assert.equal(selected.statusCode, 404);
    assert.deepEqual(selected.body, { ok: false, error: 'profile_unavailable' });
  }
});

test('switching profiles replaces scope and failed switch leaves no stale profile', async () => {
  const { route } = handlerFixture();
  const initial = await bootstrap(route);
  const activated = await activate(route, initial);
  let jar = activated.jar;

  async function choose(profileId) {
    const ready = await bootstrap(route, jar);
    jar = ready.jar;
    const selected = await call(route, {
      method: 'POST',
      cookie: cookieHeader(jar),
      body: {
        operation: 'SELECT_PROFILE',
        profile_id: profileId,
      },
      csrfProof: ready.csrf,
    });
    return selected;
  }

  assert.equal((await choose(profileA)).body.profile_receipt.profile_id, profileA);
  assert.equal((await choose(profileB)).body.profile_receipt.profile_id, profileB);
  const denied = await choose('mm-20990103-cccccccc');
  assert.equal(denied.statusCode, 404);
  const inspected = await bootstrap(route, jar);
  assert.equal(inspected.response.body.active, true);
  assert.equal(inspected.response.body.profile_state, 'RESOLUTION_DENIED');
});

test('DELETE clears capability and profile cookies and restores locked state', async () => {
  const { route } = handlerFixture();
  const initial = await bootstrap(route);
  const activated = await activate(route, initial);
  const ready = await bootstrap(route, activated.jar, 'DELETE');
  const cleared = await call(route, {
    method: 'DELETE',
    cookie: cookieHeader(ready.jar),
    csrfProof: ready.csrf,
  });
  assert.equal(cleared.statusCode, 200);
  assert.equal(cleared.body.cleared, true);
  assert.match(setCookies(cleared).join('\n'), /Max-Age=0/);
});

test('security response headers and method boundary remain fail-closed', async () => {
  const { route } = handlerFixture();
  const res = await call(route, { method: 'PATCH' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(res.headers.get('allow'), undefined);
});

test('UI uses server endpoint, clears code, gates profile input, and contains no authority literal', () => {
  const uiPath = path.join(
    dirname,
    '../src/components/businessAssessment/DeveloperAccessPanel.jsx',
  );
  const source = fs.readFileSync(uiPath, 'utf8');
  assert.match(source, /\/api\/internal\/subdev1-operator/);
  assert.match(source, /setAccessCode\(''\)/);
  assert.match(source, /state\.active/);
  assert.match(source, /Internal Beta Access Active/);
  assert.match(source, /authority_source:\s*'temporary_internal_beta_operator_context'/);
  assert.match(source, /client_authority:\s*false/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, new RegExp(accessCode));
  assert.doesNotMatch(source, /mm-\d{8}-[a-z0-9]{8}/);
  assert.doesNotMatch(source, /coach_authority:\s*true|paid_entitlement:\s*true/);
});

test('missing secret configuration and disabled feature fail closed at the HTTP boundary', async () => {
  for (const fixtureEnv of [
    env({ MORE_SUBDEV1_OPERATOR_ENABLED: 'false' }),
    env({ MORE_SUBDEV1_OPERATOR_SIGNING_SECRET: '' }),
  ]) {
    const { route } = handlerFixture({ env: fixtureEnv });
    const res = await call(route, { method: 'GET' });
    assert.equal(res.statusCode, fixtureEnv.MORE_SUBDEV1_OPERATOR_ENABLED === 'false'
      ? 404
      : 503);
    assert.equal(res.body.error, 'feature_unavailable');
  }
});
