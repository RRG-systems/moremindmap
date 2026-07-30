import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSubdev1AuthoritativeProfileResolver,
  createSubdev1OperatorBridge,
  createSubdev1OperatorContextConsumer,
  InMemorySubdev1OperatorBridgeStore,
  SUBDEV1_OPERATOR_ALLOWED_ACTIONS,
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
  SUBDEV1_PROFILE_RECORD_VERSION,
  validateSubdev1OperatorContext,
  validateSubdev1ProfileReceipt,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';

const origin = 'http://localhost:5173';
const accessCode = ['SUB', 'DEV', '1'].join('');
const signingSecret = 'synthetic-subdev1-signing-secret-at-least-thirty-two-bytes';
const profileA = 'mm-20990101-aaaaaaaa';
const profileB = 'mm-20990102-bbbbbbbb';

const env = {
  NODE_ENV: 'test',
  MORE_SUBDEV1_OPERATOR_ENABLED: 'true',
  MORE_SUBDEV1_OPERATOR_CODE: accessCode,
  MORE_SUBDEV1_OPERATOR_SIGNING_SECRET: signingSecret,
  MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: origin,
  MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: 'private_beta_synthetic',
  MORE_SUBDEV1_OPERATOR_TTL_SECONDS: '900',
};

function record(profileId, suffix, overrides = {}) {
  return {
    record_version: SUBDEV1_PROFILE_RECORD_VERSION,
    profile_id: profileId,
    subscriber_subject_ref: `subscriber_subject_${suffix}`,
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
    ...overrides,
  };
}

function repository({
  records = new Map([
    [profileA, record(profileA, 'a')],
    [profileB, record(profileB, 'b')],
  ]),
  ambiguous = new Set(),
} = {}) {
  const calls = [];
  return {
    calls,
    records,
    async resolveExactProfile(profileId) {
      calls.push(profileId);
      if (ambiguous.has(profileId)) return { status: 'AMBIGUOUS', record: null };
      const found = records.get(profileId);
      return found
        ? { status: 'FOUND', record: structuredClone(found) }
        : { status: 'NOT_FOUND', record: null };
    },
  };
}

function deterministicTokens() {
  let count = 0;
  return () => `opaque-test-token-${String(count += 1).padStart(40, '0')}`;
}

function request(method = 'POST', requestOrigin = origin) {
  return { method, headers: { origin: requestOrigin } };
}

function fixture({
  currentTime = 1_000,
  fixtureEnv = env,
  fixtureStore = new InMemorySubdev1OperatorBridgeStore(),
  fixtureRepository = repository(),
} = {}) {
  let now = currentTime;
  const bridge = createSubdev1OperatorBridge({
    env: fixtureEnv,
    store: fixtureStore,
    profileRepository: fixtureRepository,
    clock: () => now,
    randomToken: deterministicTokens(),
  });
  return {
    bridge,
    store: fixtureStore,
    profileRepository: fixtureRepository,
    setNow(value) { now = value; },
  };
}

async function activate(testFixture, submittedCode = accessCode, browserToken = '') {
  const browser = await testFixture.bridge.establishBrowser(browserToken);
  assert.equal(browser.ok, true);
  const csrf = await testFixture.bridge.issueCsrf({
    request: request(),
    browserToken: browser.browser_token,
    method: 'POST',
  });
  assert.equal(csrf.ok, true);
  const activated = await testFixture.bridge.activate({
    request: request(),
    browserToken: browser.browser_token,
    csrfProof: csrf.csrf_proof,
    submittedCode,
  });
  return { browser, activated };
}

async function select(testFixture, session, profileId) {
  const csrf = await testFixture.bridge.issueCsrf({
    request: request(),
    browserToken: session.browser.browser_token,
    method: 'POST',
  });
  assert.equal(csrf.ok, true);
  return testFixture.bridge.selectProfile({
    request: request(),
    browserToken: session.browser.browser_token,
    contextToken: session.activated.context_token,
    csrfProof: csrf.csrf_proof,
    profileId,
  });
}

test('feature is default-off and incomplete configuration fails closed', async () => {
  const disabled = fixture({ fixtureEnv: { ...env, MORE_SUBDEV1_OPERATOR_ENABLED: 'false' } });
  assert.equal((await disabled.bridge.establishBrowser()).code, 'OPERATOR_BRIDGE_DISABLED');
  const incomplete = fixture({
    fixtureEnv: { ...env, MORE_SUBDEV1_OPERATOR_SIGNING_SECRET: '' },
  });
  assert.equal(
    (await incomplete.bridge.establishBrowser()).code,
    'OPERATOR_BRIDGE_CONFIGURATION_INVALID',
  );
});

test('production rejects the synthetic local store', async () => {
  const production = fixture({ fixtureEnv: { ...env, NODE_ENV: 'production' } });
  assert.equal(
    (await production.bridge.establishBrowser()).code,
    'OPERATOR_BRIDGE_CONFIGURATION_INVALID',
  );
});

test('missing, empty, malformed, and incorrect code are denied generically by the bridge', async () => {
  for (const submitted of [null, '', { value: accessCode }, 'incorrect']) {
    const testFixture = fixture();
    const session = await activate(testFixture, submitted);
    assert.equal(session.activated.ok, false);
    assert.equal(session.activated.code, 'OPERATOR_CODE_INVALID');
  }
});

test('correct code creates a temporary customer-independent context', async () => {
  const testFixture = fixture();
  const session = await activate(testFixture);
  assert.equal(session.activated.ok, true);
  assert.equal(session.activated.capability_scope, 'SUBSCRIPTION_PRIVATE_BETA');
  assert.equal(session.activated.profile_state, 'NO_PROFILE');
  const snapshot = testFixture.store.snapshot();
  assert.equal(snapshot.contexts.length, 1);
  const stored = snapshot.contexts[0][1];
  assert.equal(stored.active_profile, null);
  assert.equal(JSON.stringify(stored).includes(profileA), false);
  assert.equal(stored.coach_authority, false);
  assert.equal(stored.stripe_authority, false);
  assert.equal(stored.canonical_identity_authority, false);
  assert.equal('raw_token' in stored, false);
  assert.equal('access_code' in stored, false);
});

test('one-time CSRF and explicit origin are required', async () => {
  const testFixture = fixture();
  const browser = await testFixture.bridge.establishBrowser();
  const csrf = await testFixture.bridge.issueCsrf({
    request: request(),
    browserToken: browser.browser_token,
  });
  const deniedOrigin = await testFixture.bridge.activate({
    request: request('POST', 'http://attacker.invalid'),
    browserToken: browser.browser_token,
    csrfProof: csrf.csrf_proof,
    submittedCode: accessCode,
  });
  assert.equal(deniedOrigin.code, 'ORIGIN_VALIDATION_FAILED');
  const accepted = await testFixture.bridge.activate({
    request: request(),
    browserToken: browser.browser_token,
    csrfProof: csrf.csrf_proof,
    submittedCode: accessCode,
  });
  assert.equal(accepted.ok, true);
  const replay = await testFixture.bridge.activate({
    request: request(),
    browserToken: browser.browser_token,
    csrfProof: csrf.csrf_proof,
    submittedCode: accessCode,
  });
  assert.equal(replay.code, 'CSRF_VALIDATION_FAILED');
});

test('rate protection bounds repeated activation attempts', async () => {
  const testFixture = fixture();
  const browser = await testFixture.bridge.establishBrowser();
  let last;
  for (let index = 0; index < 6; index += 1) {
    const csrf = await testFixture.bridge.issueCsrf({
      request: request(),
      browserToken: browser.browser_token,
    });
    last = await testFixture.bridge.activate({
      request: request(),
      browserToken: browser.browser_token,
      csrfProof: csrf.csrf_proof,
      submittedCode: 'incorrect',
    });
  }
  assert.equal(last.code, 'OPERATOR_RATE_LIMITED');
});

test('aggregate origin limit survives browser-binding cookie replacement', async () => {
  const testFixture = fixture();
  let last;
  for (let index = 0; index < 31; index += 1) {
    const browser = await testFixture.bridge.establishBrowser();
    const csrf = await testFixture.bridge.issueCsrf({
      request: request(),
      browserToken: browser.browser_token,
    });
    last = await testFixture.bridge.activate({
      request: request(),
      browserToken: browser.browser_token,
      csrfProof: csrf.csrf_proof,
      submittedCode: 'incorrect',
    });
  }
  assert.equal(last.code, 'OPERATOR_RATE_LIMITED');
});

test('context is browser-bound and copied capability fails', async () => {
  const testFixture = fixture();
  const session = await activate(testFixture);
  const otherBrowser = (await testFixture.bridge.establishBrowser()).browser_token;
  const copied = await testFixture.bridge.consume({
    contextToken: session.activated.context_token,
    browserToken: otherBrowser,
    action: 'SELECT_PROFILE',
  });
  assert.equal(copied.code, 'OPERATOR_BROWSER_BINDING_INVALID');
});

test('expiry, explicit clear, and administrative revocation remove authority', async () => {
  const expiredFixture = fixture();
  const expiredSession = await activate(expiredFixture);
  expiredFixture.setNow(Date.parse(expiredSession.activated.expires_at) + 1);
  assert.equal(
    (await expiredFixture.bridge.consume({
      contextToken: expiredSession.activated.context_token,
      browserToken: expiredSession.browser.browser_token,
      action: 'SELECT_PROFILE',
    })).code,
    'OPERATOR_CONTEXT_EXPIRED',
  );

  const clearFixture = fixture();
  const clearSession = await activate(clearFixture);
  const clearCsrf = await clearFixture.bridge.issueCsrf({
    request: request('DELETE'),
    browserToken: clearSession.browser.browser_token,
    method: 'DELETE',
  });
  assert.equal((await clearFixture.bridge.clear({
    request: request('DELETE'),
    browserToken: clearSession.browser.browser_token,
    contextToken: clearSession.activated.context_token,
    csrfProof: clearCsrf.csrf_proof,
  })).cleared, true);
  assert.equal(
    (await clearFixture.bridge.consume({
      contextToken: clearSession.activated.context_token,
      browserToken: clearSession.browser.browser_token,
      action: 'SELECT_PROFILE',
    })).code,
    'OPERATOR_CONTEXT_REVOKED',
  );

  const revokeFixture = fixture();
  const revokeSession = await activate(revokeFixture);
  assert.equal((await revokeFixture.bridge.revoke({
    contextToken: revokeSession.activated.context_token,
    browserToken: revokeSession.browser.browser_token,
  })).revoked, true);
  assert.equal(
    (await revokeFixture.bridge.consume({
      contextToken: revokeSession.activated.context_token,
      browserToken: revokeSession.browser.browser_token,
      action: 'SELECT_PROFILE',
    })).code,
    'OPERATOR_CONTEXT_REVOKED',
  );
});

test('profile resolver accepts exact synthetic A and B records with provenance', async () => {
  const profileRepository = repository();
  const resolver = createSubdev1AuthoritativeProfileResolver({
    repository: profileRepository,
  });
  for (const profileId of [profileA, profileB]) {
    const resolved = await resolver.resolve(profileId);
    assert.equal(resolved.allowed, true);
    assert.equal(resolved.record.profile_id, profileId);
    assert.equal(resolved.record.exact_scope.profile_id, profileId);
    assert.equal(resolved.record.provenance.source, 'SYNTHETIC_ISOLATED_FIXTURE');
    assert.equal(resolved.repository_mutated, false);
    assert.equal(resolved.enumerated, false);
  }
});

test('profile resolver fails closed for missing, malformed, unknown, ambiguous, and invalid scope', async () => {
  const ambiguousRepository = repository({ ambiguous: new Set([profileA]) });
  const ambiguous = createSubdev1AuthoritativeProfileResolver({
    repository: ambiguousRepository,
  });
  assert.equal((await ambiguous.resolve(profileA)).code, 'PROFILE_RESOLUTION_AMBIGUOUS');

  const missing = createSubdev1AuthoritativeProfileResolver({
    repository: repository(),
  });
  assert.equal((await missing.resolve()).code, 'PROFILE_ID_INVALID');
  assert.equal((await missing.resolve('not-a-profile')).code, 'PROFILE_ID_INVALID');
  assert.equal(
    (await missing.resolve('mm-20990103-cccccccc')).code,
    'PROFILE_RESOLUTION_DENIED',
  );

  const badRecords = new Map([[
    profileA,
    record(profileA, 'a', {
      exact_scope: {
        tenant_id: 'tenant_a',
        profile_id: profileB,
        business_id: 'business_a',
        subscriber_id: 'subscriber_a',
      },
    }),
  ]]);
  const invalid = createSubdev1AuthoritativeProfileResolver({
    repository: repository({ records: badRecords }),
  });
  assert.equal((await invalid.resolve(profileA)).code, 'PROFILE_SCOPE_INVALID');
});

test('client tenant, business, subscriber, name, and syntax claims are never resolver inputs', async () => {
  const profileRepository = repository();
  const resolver = createSubdev1AuthoritativeProfileResolver({
    repository: profileRepository,
  });
  const resolved = await resolver.resolve(profileA, {
    tenant_id: 'attacker',
    business_id: 'attacker',
    subscriber_id: 'attacker',
    name: 'Attacker',
  });
  assert.equal(resolved.allowed, true);
  assert.deepEqual(profileRepository.calls, [profileA]);
  assert.equal(resolved.record.exact_scope.tenant_id, 'tenant_a');
  assert.equal(resolved.record.exact_scope.business_id, 'business_a');
  assert.equal(resolved.record.exact_scope.subscriber_id, 'subscriber_a');
});

test('profile A activates, switch clears A before B, and stale A receipt is denied', async () => {
  const testFixture = fixture();
  const session = await activate(testFixture);
  const selectedA = await select(testFixture, session, profileA);
  assert.equal(selectedA.allowed, true);
  assert.equal(selectedA.profile_receipt.profile_id, profileA);
  const consumedA = await testFixture.bridge.consume({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: selectedA.profile_receipt,
  });
  assert.equal(consumedA.allowed, true);
  assert.equal(consumedA.exact_scope.profile_id, profileA);

  const selectedB = await select(testFixture, session, profileB);
  assert.equal(selectedB.allowed, true);
  assert.equal(selectedB.profile_receipt.profile_id, profileB);
  const staleA = await testFixture.bridge.consume({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: selectedA.profile_receipt,
  });
  assert.equal(staleA.code, 'PROFILE_RECEIPT_STALE');
  const consumedB = await testFixture.bridge.consume({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: selectedB.profile_receipt,
  });
  assert.equal(consumedB.allowed, true);
  assert.equal(consumedB.exact_scope.profile_id, profileB);
  assert.equal(consumedB.profile_generation, 2);
});

test('failed switch clears prior profile and leaves no stale active scope', async () => {
  const testFixture = fixture();
  const session = await activate(testFixture);
  const selectedA = await select(testFixture, session, profileA);
  const denied = await select(testFixture, session, 'mm-20990103-cccccccc');
  assert.equal(denied.code, 'PROFILE_RESOLUTION_DENIED');
  const stale = await testFixture.bridge.consume({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: selectedA.profile_receipt,
  });
  assert.equal(stale.code, 'PROFILE_RESOLUTION_DENIED');
  assert.equal(
    (await testFixture.bridge.inspect({
      contextToken: session.activated.context_token,
      browserToken: session.browser.browser_token,
    })).profile_state,
    'RESOLUTION_DENIED',
  );
});

test('tampered context and profile receipt fail integrity validation', async () => {
  const testFixture = fixture();
  const session = await activate(testFixture);
  const selected = await select(testFixture, session, profileA);
  const snapshot = testFixture.store.snapshot();
  const stored = snapshot.contexts[0][1];
  assert.equal(validateSubdev1OperatorContext({
    ...stored,
    coach_authority: true,
  }, {
    signingSecret,
  }).valid, false);
  assert.equal(validateSubdev1ProfileReceipt({
    ...selected.profile_receipt,
    profile_id: profileB,
  }, {
    signingSecret,
  }).valid, false);
});

test('private-runtime consumer returns Subscription-only exact scope and no other authority', async () => {
  const testFixture = fixture();
  const session = await activate(testFixture);
  const selected = await select(testFixture, session, profileA);
  const consumer = createSubdev1OperatorContextConsumer({
    env,
    store: testFixture.store,
    profileRepository: testFixture.profileRepository,
    clock: () => 1_000,
    randomToken: deterministicTokens(),
  });
  const result = await consumer.consume({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
    action: 'SUBSCRIPTION_INTERACTION',
    profileReceipt: selected.profile_receipt,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.source, 'temporary_internal_beta_operator_context');
  assert.equal(result.exact_scope.profile_id, profileA);
  assert.equal(result.paid_entitlement, false);
  assert.equal(result.stripe_authority, false);
  assert.equal(result.coach_authority, false);
  assert.equal(result.canonical_identity_authority, false);
  assert.equal(result.deployment_authority, false);
  assert.equal(result.environment_authority, false);
  assert.equal(result.provider_authority, false);
});

test('use-time revalidation denies withdrawn consent and clears the prior profile', async () => {
  const profileRepository = repository();
  const testFixture = fixture({ fixtureRepository: profileRepository });
  const session = await activate(testFixture);
  const selected = await select(testFixture, session, profileA);
  profileRepository.records.set(profileA, {
    ...profileRepository.records.get(profileA),
    consent_status: 'REVOKED',
  });
  const denied = await testFixture.bridge.consume({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
    action: 'SUBSCRIPTION_READ',
    profileReceipt: selected.profile_receipt,
  });
  assert.equal(denied.code, 'PROFILE_RESOLUTION_DENIED');
  const inspected = await testFixture.bridge.inspect({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
  });
  assert.equal(inspected.profile_state, 'RESOLUTION_DENIED');
  assert.equal(inspected.profile_receipt, null);
});

test('use-time revalidation denies canonical revision drift', async () => {
  const profileRepository = repository();
  const testFixture = fixture({ fixtureRepository: profileRepository });
  const session = await activate(testFixture);
  const selected = await select(testFixture, session, profileA);
  profileRepository.records.set(profileA, {
    ...profileRepository.records.get(profileA),
    profile_revision: 'revision_a_changed',
  });
  const denied = await testFixture.bridge.consume({
    contextToken: session.activated.context_token,
    browserToken: session.browser.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: selected.profile_receipt,
  });
  assert.equal(denied.code, 'PROFILE_RESOLUTION_DENIED');
});

test('Promise-native state-store adapters work and rejected store calls fail closed', async () => {
  const baseStore = new InMemorySubdev1OperatorBridgeStore();
  const promiseStore = Object.fromEntries(
    [
      'describe',
      'rateLimit',
      'issueCsrfGrant',
      'consumeCsrfGrant',
      'saveContext',
      'getContextByTokenHash',
      'replaceContext',
      'appendAudit',
      'auditSnapshot',
    ].map((method) => [
      method,
      async (...args) => baseStore[method](...args),
    ]),
  );
  const testFixture = fixture({ fixtureStore: promiseStore });
  const session = await activate(testFixture);
  assert.equal(session.activated.ok, true);

  const rejectingStore = {
    ...promiseStore,
    async describe() {
      throw new Error('synthetic outage');
    },
  };
  const unavailable = fixture({ fixtureStore: rejectingStore });
  assert.equal(
    (await unavailable.bridge.establishBrowser()).code,
    'OPERATOR_BRIDGE_CONFIGURATION_INVALID',
  );
});

test('audit append failure prevents operator authority publication', async () => {
  const baseStore = new InMemorySubdev1OperatorBridgeStore();
  const auditFailingStore = {
    describe: (...args) => baseStore.describe(...args),
    rateLimit: (...args) => baseStore.rateLimit(...args),
    issueCsrfGrant: (...args) => baseStore.issueCsrfGrant(...args),
    consumeCsrfGrant: (...args) => baseStore.consumeCsrfGrant(...args),
    saveContext: (...args) => baseStore.saveContext(...args),
    getContextByTokenHash: (...args) => baseStore.getContextByTokenHash(...args),
    replaceContext: (...args) => baseStore.replaceContext(...args),
    appendAudit: async () => ({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' }),
    auditSnapshot: (...args) => baseStore.auditSnapshot(...args),
  };
  const testFixture = fixture({ fixtureStore: auditFailingStore });
  const browser = await testFixture.bridge.establishBrowser();
  const csrf = await testFixture.bridge.issueCsrf({
    request: request(),
    browserToken: browser.browser_token,
  });
  const denied = await testFixture.bridge.activate({
    request: request(),
    browserToken: browser.browser_token,
    csrfProof: csrf.csrf_proof,
    submittedCode: accessCode,
  });
  assert.equal(denied.code, 'OPERATOR_STORE_UNAVAILABLE');
  assert.equal(baseStore.snapshot().contexts.length, 0);
});

test('Coach actions and unknown actions are never accepted', async () => {
  const testFixture = fixture();
  const session = await activate(testFixture);
  for (const action of ['COACH_CONNECT_SUBSCRIBER', 'COACH_SESSION_START', 'ADMIN']) {
    assert.equal(SUBDEV1_OPERATOR_ALLOWED_ACTIONS.includes(action), false);
    assert.equal((await testFixture.bridge.consume({
      contextToken: session.activated.context_token,
      browserToken: session.browser.browser_token,
      action,
    })).code, 'OPERATOR_ACTION_DENIED');
  }
});

test('store outage fails closed and audit contains no secret, raw token, Profile ID, or full scope', async () => {
  const unavailable = fixture({
    fixtureStore: new InMemorySubdev1OperatorBridgeStore(null, { available: false }),
  });
  assert.equal(
    (await unavailable.bridge.establishBrowser()).code,
    'OPERATOR_BRIDGE_CONFIGURATION_INVALID',
  );

  const testFixture = fixture();
  const session = await activate(testFixture);
  await select(testFixture, session, profileA);
  const serializedAudit = JSON.stringify(testFixture.store.auditSnapshot());
  assert.doesNotMatch(serializedAudit, /"access_code"|"submitted_code"/);
  assert.doesNotMatch(serializedAudit, /opaque-test-token/);
  assert.doesNotMatch(serializedAudit, new RegExp(profileA));
  assert.doesNotMatch(serializedAudit, /tenant_a|business_a|subscriber_a/);
});
