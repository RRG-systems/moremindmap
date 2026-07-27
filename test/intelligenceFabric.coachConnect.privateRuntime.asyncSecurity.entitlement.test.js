import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { resolveSubscriptionEntitlement } from '../api/internal/subscription-entitlement.js';
import {
  SyntheticAsyncSecurityStateAdapter,
  createSyntheticAsyncSecurityBackend,
} from '../src/lib/intelligenceFabric/coachConnect/productionSecurity/index.js';
import {
  createCanonicalAsyncSecurityServiceV2,
  createDeveloperAccessSecurityFacadeV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/index.js';

const now = Date.parse('2026-07-27T21:00:00.000Z');
const environmentId = 'synthetic_async_environment';
const externalSubjectRef = 'verified_external_subject_alpha';
const subscriberSubjectRef = 'canonical_subscriber_alpha';
const scopeHash = 'a'.repeat(64);
const sessionHash = 'b'.repeat(64);
const browserHash = 'c'.repeat(64);
const accessCode = 'SUBDEV1';
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function snapshot() {
  const mapping = {
    record_version: 'canonical-subject-mapping-v1',
    external_subject_ref: externalSubjectRef,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    mapping_version: 1,
    security_version: 1,
    status: 'ACTIVE',
    subscriber_confirmed: true,
    auto_enrolled: false,
    bound_at: '2026-07-27T20:00:00.000Z',
  };
  const session = {
    record_version: 'authenticated-private-session-v2',
    authenticated_session_ref: 'authenticated_session_alpha',
    session_token_hash: sessionHash,
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    browser_binding_hash: browserHash,
    subject_security_version: 1,
    session_epoch: 1,
    security_epoch: 1,
    session_class: 'AUTHENTICATED',
    status: 'ACTIVE',
    issued_at: '2026-07-27T20:00:00.000Z',
    expires_at: '2026-07-27T22:00:00.000Z',
  };
  const approval = {
    record_version: 'private-test-approval-v1',
    approval_ref: 'private_test_approval_alpha',
    environment_id: environmentId,
    subscriber_subject_ref: subscriberSubjectRef,
    exact_scope_hash: scopeHash,
    purpose: 'TEMPORARY_PRIVATE_SUBSCRIPTION_TEST',
    status: 'ACTIVE',
    issued_at: '2026-07-27T20:00:00.000Z',
    expires_at: '2026-07-27T21:30:00.000Z',
    security_epoch: 1,
  };
  return {
    canonical_by_external: [[externalSubjectRef, mapping]],
    canonical_by_scope: [[scopeHash, {
      subscriber_subject_ref: subscriberSubjectRef,
      external_subject_ref: externalSubjectRef,
      exact_scope_hash: scopeHash,
      mapping_version: 1,
      status: 'ACTIVE',
    }]],
    sessions_by_token: [[sessionHash, session]],
    sessions_by_ref: [['authenticated_session_alpha', session]],
    approvals: [[`${subscriberSubjectRef}|${scopeHash}`, approval]],
    security_epochs: [[scopeHash, 1]],
  };
}

function requestContext(overrides = {}) {
  return {
    environment_id: environmentId,
    external_subject_ref: externalSubjectRef,
    session_token_hash: sessionHash,
    exact_scope_hash: scopeHash,
    browser_binding_hash: browserHash,
    correlation_ref: 'correlation_entitlement_alpha',
    route: '/api/internal/developer-access',
    method: 'POST',
    idempotency_ref: 'entitlement_attempt_alpha',
    edge_attestation: {
      named_identity_verified: true,
      mfa_verified: true,
      public_access: false,
    },
    ...overrides,
  };
}

function harness({
  state = snapshot(),
  configuration = {},
  tokens = ['csrf_material_alpha', 'entitlement_material_alpha'],
} = {}) {
  const backend = createSyntheticAsyncSecurityBackend(state, { clock: () => now });
  const adapter = new SyntheticAsyncSecurityStateAdapter({
    backend,
    environment_id: environmentId,
  });
  let tokenIndex = 0;
  const service = createCanonicalAsyncSecurityServiceV2({
    statePort: adapter,
    environmentId,
    expectedPrivateAccessCode: accessCode,
    tokenFactory: async () => tokens[tokenIndex++] || `entropy_material_${tokenIndex}`,
    tokenHasher: async (value) => hash(value),
    configuration: {
      enabled: true,
      emergency_disabled: false,
      environment_allowlist: [environmentId],
      subject_allowlist: [subscriberSubjectRef],
      scope_allowlist: [scopeHash],
      csrf_ttl_ms: 60_000,
      entitlement_ttl_ms: 600_000,
      rate_limit_attempts: 5,
      ...configuration,
    },
  });
  return {
    adapter,
    backend,
    service,
    facade: createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService: service }),
  };
}

async function issueCsrfAndEligibility(service, context = requestContext()) {
  const authenticated = await service.resolveAuthenticatedContext(context);
  const eligibility = authenticated.allowed
    ? await service.evaluatePrivateTestEligibility(authenticated.authenticated_context)
    : authenticated;
  const csrf = eligibility.allowed
    ? await service.issueCsrfGrant(authenticated.authenticated_context, {
      route: context.route,
      method: context.method,
      browser_binding_hash: context.browser_binding_hash,
    })
    : eligibility;
  return { authenticated, eligibility, csrf };
}

test('unauthenticated access code and authenticated but ineligible subject fail before issuance', async () => {
  const { facade, backend } = harness();
  const unauthenticated = await facade.issueEntitlement({
    ...requestContext(),
    edge_attestation: {
      named_identity_verified: false,
      mfa_verified: false,
      public_access: false,
    },
  }, accessCode);
  assert.equal(unauthenticated.allowed, false);
  assert.equal(backend.entitlements_by_ref.size, 0);

  const ineligible = harness({ configuration: { enabled: false } });
  const denied = await ineligible.facade.issueEntitlement(requestContext(), accessCode);
  assert.equal(denied.allowed, false);
  assert.equal(ineligible.backend.entitlements_by_ref.size, 0);
});

test('eligibility alone grants code attempt but no runtime authority', async () => {
  const { service } = harness();
  const authenticated = await service.resolveAuthenticatedContext(requestContext());
  const eligibility = await service.evaluatePrivateTestEligibility(
    authenticated.authenticated_context,
  );
  assert.equal(eligibility.allowed, true);
  assert.equal(eligibility.runtime_access, false);
  const authority = await service.evaluatePrivateRuntimeAuthority({
    request_context: requestContext(),
    requested_runtime: 'SUBSCRIPTION_RUNTIME',
    requested_action: 'inspect_private_subscription_entitlement',
  });
  assert.equal(authority.allowed, false);
  assert.equal(authority.code, 'RUNTIME_ACTION_DENIED');
});

test('ordered CSRF flow issues one exact temporary unpaid entitlement', async () => {
  const { service, backend } = harness();
  const { eligibility, csrf } = await issueCsrfAndEligibility(service);
  assert.equal(csrf.allowed, true);
  const issued = await service.issueTemporaryEntitlement({
    request_context: requestContext({ csrf_proof: csrf.csrf_proof }),
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  assert.equal(issued.allowed, true);
  assert.equal(backend.entitlements_by_ref.size, 1);
  assert.equal(backend.csrf_grants.get(hash(csrf.csrf_proof)).status, 'CONSUMED');
  assert.equal(issued.entitlement.temporary, true);
  assert.equal(issued.entitlement.paid_entitlement, false);
  assert.equal(issued.entitlement.billing_evidence, false);
  assert.equal(issued.entitlement.stripe_subscription_created, false);
  for (const field of [
    'admin_authority',
    'operator_authority',
    'deployment_authority',
    'billing_authority',
    'coach_authority',
    'canonical_mutation_authority',
  ]) {
    assert.equal(issued.entitlement[field], false, field);
  }
});

test('entitlement is exact subject, session, browser, environment, scope, version, and epoch bound', async () => {
  const { service } = harness();
  const { eligibility, csrf } = await issueCsrfAndEligibility(service);
  const issued = await service.issueTemporaryEntitlement({
    request_context: requestContext({ csrf_proof: csrf.csrf_proof }),
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  const entitlementTokenHash = hash(issued.entitlement_cookie_value);
  const exact = await service.inspectTemporaryEntitlement(requestContext({
    entitlement_token_hash: entitlementTokenHash,
  }));
  assert.equal(exact.allowed, true);
  for (const mismatch of [
    { browser_binding_hash: 'd'.repeat(64) },
    { exact_scope_hash: 'e'.repeat(64) },
    { environment_id: 'different_environment' },
    { session_token_hash: 'f'.repeat(64) },
  ]) {
    assert.equal((await service.inspectTemporaryEntitlement(requestContext({
      entitlement_token_hash: entitlementTokenHash,
      ...mismatch,
    }))).allowed, false);
  }
});

test('runtime authority requires one current entitlement snapshot', async () => {
  const { service } = harness();
  const { eligibility, csrf } = await issueCsrfAndEligibility(service);
  const issued = await service.issueTemporaryEntitlement({
    request_context: requestContext({ csrf_proof: csrf.csrf_proof }),
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  const authority = await service.evaluatePrivateRuntimeAuthority({
    request_context: requestContext({
      entitlement_token_hash: hash(issued.entitlement_cookie_value),
    }),
    requested_runtime: 'SUBSCRIPTION_RUNTIME',
    requested_action: 'inspect_private_subscription_entitlement',
  });
  assert.equal(authority.allowed, true);
  assert.equal(authority.deployment_grade_security_state, false);
  assert.equal(authority.no_local_fallback, true);
  assert.equal(authority.billing_authority, false);
});

test('private subscription projection awaits authority and ignores paid fallback', async () => {
  const { service } = harness();
  const { eligibility, csrf } = await issueCsrfAndEligibility(service);
  const issued = await service.issueTemporaryEntitlement({
    request_context: requestContext({ csrf_proof: csrf.csrf_proof }),
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  let settled = false;
  const delayedService = {
    async evaluatePrivateRuntimeAuthority(input) {
      await Promise.resolve();
      settled = true;
      return service.evaluatePrivateRuntimeAuthority(input);
    },
    inspectTemporaryEntitlement: (...args) => service.inspectTemporaryEntitlement(...args),
  };
  const returned = resolveSubscriptionEntitlement({
    canonicalSecurityServiceV2: delayedService,
    requestContext: requestContext({
      entitlement_token_hash: hash(issued.entitlement_cookie_value),
    }),
    paidAccessGrant: {
      access_type: 'more_monthly_intelligence',
      status: 'active',
    },
  });
  assert.equal(returned instanceof Promise, true);
  assert.equal(settled, false);
  const result = await returned;
  assert.equal(settled, true);
  assert.equal(result.allowed, true);
  assert.equal(result.entitlement.source, 'temporary_internal_subscription_entitlement');
  assert.equal(result.entitlement.billing_evidence, false);
  assert.equal(result.entitlement.stripe_subscription_created, false);
});

test('CSRF is single use and concurrent entitlement issue creates at most one active record', async () => {
  const { service, backend } = harness({
    tokens: [
      'csrf_material_alpha',
      'entitlement_material_first',
      'entitlement_material_second',
    ],
  });
  const { eligibility, csrf } = await issueCsrfAndEligibility(service);
  const attempt = () => service.issueTemporaryEntitlement({
    request_context: requestContext({ csrf_proof: csrf.csrf_proof }),
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  const decisions = await Promise.all([attempt(), attempt()]);
  assert.equal(decisions.filter((decision) => decision.allowed).length, 1);
  assert.equal([...backend.entitlements_by_ref.values()]
    .filter((record) => record.status === 'ACTIVE').length, 1);
});

test('wrong CSRF binding, invalid code, approval race, epoch race, audit failure, and outage deny', async () => {
  const wrongBinding = harness();
  const started = await issueCsrfAndEligibility(wrongBinding.service);
  const wrongMethod = await wrongBinding.service.issueTemporaryEntitlement({
    request_context: requestContext({
      csrf_proof: started.csrf.csrf_proof,
      method: 'DELETE',
    }),
    eligibility_decision: started.eligibility,
    submitted_code: accessCode,
  });
  assert.equal(wrongMethod.allowed, false);

  const invalidCode = harness();
  const invalidStarted = await issueCsrfAndEligibility(invalidCode.service);
  assert.equal((await invalidCode.service.issueTemporaryEntitlement({
    request_context: requestContext({ csrf_proof: invalidStarted.csrf.csrf_proof }),
    eligibility_decision: invalidStarted.eligibility,
    submitted_code: 'incorrect',
  })).allowed, false);

  for (const mutation of [
    (backend) => backend.approvals.set(`${subscriberSubjectRef}|${scopeHash}`, {
      ...backend.approvals.get(`${subscriberSubjectRef}|${scopeHash}`),
      status: 'REVOKED',
    }),
    (backend) => backend.security_epochs.set(scopeHash, 2),
    (backend) => { backend.audit_failure = true; },
    (backend) => { backend.availability = 'UNAVAILABLE'; },
  ]) {
    const current = harness();
    const phase = await issueCsrfAndEligibility(current.service);
    mutation(current.backend);
    const decision = await current.service.issueTemporaryEntitlement({
      request_context: requestContext({ csrf_proof: phase.csrf.csrf_proof }),
      eligibility_decision: phase.eligibility,
      submitted_code: accessCode,
    });
    assert.equal(decision.allowed, false);
    assert.equal(current.backend.entitlements_by_ref.size, 0);
  }
});

test('raw access code and cookie material never enter canonical state, audit, or safe projection', async () => {
  const { service, backend } = harness();
  const { eligibility, csrf } = await issueCsrfAndEligibility(service);
  const issued = await service.issueTemporaryEntitlement({
    request_context: requestContext({ csrf_proof: csrf.csrf_proof }),
    eligibility_decision: eligibility,
    submitted_code: accessCode,
  });
  const persisted = JSON.stringify({
    csrf: [...backend.csrf_grants.values()],
    entitlements: [...backend.entitlements_by_ref.values()],
    audits: backend.audits,
  });
  assert.equal(persisted.includes(accessCode), false);
  assert.equal(persisted.includes(csrf.csrf_proof), false);
  assert.equal(persisted.includes(issued.entitlement_cookie_value), false);
  assert.equal(JSON.stringify(issued.entitlement).includes('token'), false);
});

