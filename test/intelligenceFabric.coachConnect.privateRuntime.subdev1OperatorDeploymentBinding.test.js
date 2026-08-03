import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPrivateRuntimeLiveCompositionV2,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
import {
  createPrivateRuntimeOperatorBridgeLiveBindingV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/operatorBridgeBinding.js';
import {
  createPrivateRuntimeLiveAttachmentCoordinatorV1,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/attachmentCoordinator.js';
import {
  InMemorySubdev1OperatorBridgeStore,
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
  SUBDEV1_PROFILE_RECORD_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';
import {
  hashPrivateRuntimeScope,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/contracts.js';

const origin = 'https://private.example.test';
const accessCode = ['SUB', 'DEV', '1'].join('');
const profileId = 'mm-20990101-aaaaaaaa';
const exactScope = {
  tenant_id: 'tenant_a',
  profile_id: profileId,
  business_id: 'business_a',
  subscriber_id: 'subscriber_a',
};
const exactScopeHash = hashPrivateRuntimeScope(exactScope);
const now = Date.parse('2099-01-01T00:00:00.000Z');

function fixtureEnv(overrides = {}) {
  return {
    NODE_ENV: 'test',
    MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'true',
    MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED: 'false',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'true',
    MORE_SUBDEV1_OPERATOR_CODE: accessCode,
    MORE_SUBDEV1_OPERATOR_SIGNING_SECRET:
      'operator-binding-signing-secret-at-least-thirty-two-bytes',
    MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: origin,
    MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: 'private_beta_test',
    MORE_SUBDEV1_OPERATOR_TTL_SECONDS: '900',
    ...overrides,
  };
}

function binding(fixtureOverrides = {}) {
  const env = fixtureOverrides.env || fixtureEnv();
  let token = 0;
  const productBindingAttestation = {
    environment_id: 'private_beta_test',
    subscriber_subject_ref: 'subject_a',
    exact_scope: exactScope,
    exact_scope_hash: exactScopeHash,
  };
  const productExecutionBinding = {
    exact_scope: exactScope,
    exact_scope_hash: exactScopeHash,
    approved_profile_ids: [profileId],
  };
  return createPrivateRuntimeOperatorBridgeLiveBindingV1({
    env,
    store: fixtureOverrides.store || new InMemorySubdev1OperatorBridgeStore(),
    profileRepository: {
      async resolveExactProfile(selected) {
        return selected === profileId
          ? {
              status: 'FOUND',
              record: {
                record_version: SUBDEV1_PROFILE_RECORD_VERSION,
                profile_id: profileId,
                subscriber_subject_ref: 'subject_a',
                exact_scope: exactScope,
                profile_revision: 'revision_a',
                consent_ref: 'private_test_approval_a',
                consent_purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
                consent_status: 'ACTIVE',
                provenance: {
                  source: 'SYNTHETIC_ISOLATED_FIXTURE',
                  record_ref: 'fixture_a',
                },
              },
            }
          : { status: 'NOT_FOUND', record: null };
      },
    },
    authority: fixtureOverrides.authority || {
      authority_packet: {
        environment_id: 'private_beta_test',
        live_enabled: true,
        emergency_disabled: false,
      },
      activation_receipt: {
        deployment_commit_sha: 'a'.repeat(40),
        deployment_tree_sha: 'b'.repeat(40),
        approved: true,
        controlled_internal_beta: true,
        private_live_only: true,
        public_access: false,
      },
    },
    productBindingAttestation,
    productExecutionBinding,
    resolveMemberBindings: fixtureOverrides.resolveMemberBindings || (async (selected) =>
      selected === profileId
        ? {
            valid: true,
            value: {
              product_binding_attestation: productBindingAttestation,
              product_execution_binding: productExecutionBinding,
              cohort_digest: 'c'.repeat(64),
              member: { member_sha256: 'd'.repeat(64) },
            },
          }
        : { valid: false, value: null }),
    clock: () => now,
    randomToken: () => `operator-binding-token-${String(token += 1).padStart(40, '0')}`,
    diagnosticSink: fixtureOverrides.diagnosticSink,
  });
}

function request(body = {}, cookie = '') {
  return {
    method: 'POST',
    headers: {
      origin,
      cookie,
      'x-correlation-id': 'correlation_operator_binding',
      'x-idempotency-key': 'idempotency_operator_binding',
    },
    body,
  };
}

async function activateAndSelect(operatorBinding) {
  const bridge = operatorBinding.operatorContextBridge;
  const browser = await bridge.establishBrowser();
  const activationCsrf = await bridge.issueCsrf({
    request: request(),
    browserToken: browser.browser_token,
  });
  const activated = await bridge.activate({
    request: request(),
    browserToken: browser.browser_token,
    csrfProof: activationCsrf.csrf_proof,
    submittedCode: accessCode,
  });
  const selectionCsrf = await bridge.issueCsrf({
    request: request(),
    browserToken: browser.browser_token,
  });
  const selected = await bridge.selectProfile({
    request: request(),
    browserToken: browser.browser_token,
    contextToken: activated.context_token,
    csrfProof: selectionCsrf.csrf_proof,
    profileId,
  });
  return { browser, activated, selected };
}

test('default binding remains locked when either existing activation flag is off', async () => {
  const privateOff = binding({
    env: fixtureEnv({ MORE_PRIVATE_RUNTIME_LIVE_ENABLED: 'false' }),
  });
  assert.equal(
    (await privateOff.operatorActivationDecision()).code,
    'RUNTIME_DEFAULT_OFF',
  );
  const operatorOff = binding({
    env: fixtureEnv({ MORE_SUBDEV1_OPERATOR_ENABLED: 'false' }),
  });
  assert.equal(
    (await operatorOff.operatorActivationDecision()).code,
    'OPERATOR_BRIDGE_DISABLED',
  );
});

test('binding maps a revalidated operator profile to Subscription-only authority', async () => {
  const operatorBinding = binding();
  const session = await activateAndSelect(operatorBinding);
  const req = request(
    {},
    `more_subdev1_browser=${session.browser.browser_token}; `
      + `more_subdev1_operator=${session.activated.context_token}`,
  );
  const resolved = await operatorBinding.resolveOperatorContext({ req, body: {} });
  assert.equal(resolved.value.operator_present, true);
  const consumed = await operatorBinding.operatorContextBridge.consume({
    contextToken: resolved.value.context_token,
    browserToken: resolved.value.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: session.selected.profile_receipt,
  });
  const mapped = await operatorBinding.resolveOperatorBridgeInput({
    req,
    request_context: resolved.value,
    operator_context: consumed,
  });
  assert.equal(mapped.ok, true);
  assert.deepEqual(mapped.value.request.requested_attachments, [
    'BUSINESS_ENGINE',
    'SUBSCRIPTION_RUNTIME',
  ]);
  assert.equal(mapped.value.capability.coach_authority, false);
  assert.equal(mapped.value.capability.stripe_authority, false);
  assert.equal(mapped.value.capability.canonical_mutation_authority, false);
  assert.equal(
    mapped.value.capability.allowed_runtime_actions.includes(
      'COACH_CONNECT_SUBSCRIBER',
    ),
    false,
  );
});

test('real attachment coordinator accepts the canonical evidence class and rejects arbitrary classes', async () => {
  const operatorBinding = binding();
  const session = await activateAndSelect(operatorBinding);
  const req = request(
    {},
    `more_subdev1_browser=${session.browser.browser_token}; `
      + `more_subdev1_operator=${session.activated.context_token}`,
  );
  const resolved = await operatorBinding.resolveOperatorContext({ req, body: {} });
  const consumed = await operatorBinding.operatorContextBridge.consume({
    contextToken: resolved.value.context_token,
    browserToken: resolved.value.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: session.selected.profile_receipt,
  });
  const mapped = await operatorBinding.resolveOperatorBridgeInput({
    req,
    request_context: resolved.value,
    operator_context: consumed,
  });
  assert.equal(mapped.ok, true);
  assert.equal(
    mapped.value.authority.shared_state_evidence_class,
    'FUTURE_PRIVATE_LIVE',
  );

  const coordinator = createPrivateRuntimeLiveAttachmentCoordinatorV1({
    businessEngineAdapter: {
      describeCapability() {
        return {
          canonical_source_only: true,
          read_only: true,
          can_build_engine: false,
          can_persist_engine: false,
          production_connection: false,
        };
      },
      async lookupCanonicalBusinessEngine() {
        return {
          ok: true,
          engines: [{
            source: 'CANONICAL_BUSINESS_ENGINE',
            business_engine_ref: 'business_engine_fixture_a',
            business_engine_version: 'business_engine_version_fixture_a',
            business_engine_contract_hash: 'a'.repeat(64),
            exact_scope: exactScope,
            write_authorized: false,
          }],
        };
      },
    },
    subscriptionRuntimeAdapter: {
      async resolveExistingSubscriptionRuntime() {
        return {
          ok: true,
          runtime: {
            inspect_contract() {
              return {
                commands: [],
                queries: [],
                public_routes: [],
                feature_flags_default_off: true,
              };
            },
          },
          descriptor: {
            existing_runtime: true,
            production_namespace: false,
            customer_data: false,
            migration: false,
            exact_scope: exactScope,
            subscription_ref: 'subscription_fixture_a',
            runtime_contract_version: 'subscription_runtime_fixture_v1',
          },
        };
      },
    },
    clock: () => new Date(now).toISOString(),
  });

  const accepted = await coordinator.attach(mapped.value);
  assert.equal(accepted.ok, true);
  assert.equal(accepted.runtime_ready, true);
  assert.equal(accepted.partial_handles_discarded, false);
  assert.equal(accepted.coach_connect_attached, false);
  assert.equal(accepted.coach_connect_attachment, null);

  const rejected = await coordinator.attach({
    ...mapped.value,
    authority: {
      ...mapped.value.authority,
      shared_state_evidence_class: 'UNRECOGNIZED_PRIVATE_LIVE_CLASS',
    },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'SESSION_ELEVATION_REQUIRED');
  assert.equal(rejected.runtime_ready, false);
  assert.equal(rejected.partial_handles_discarded, true);
});

test('existing live composition consumes the default binding without canonical identity', async () => {
  const operatorBinding = binding();
  const session = await activateAndSelect(operatorBinding);
  const attachedInputs = [];
  const canonicalSecurityService = Object.fromEntries([
    'describe',
    'health',
    'beginPreAuth',
    'completeAuthentication',
    'resolveAuthenticatedContext',
    'evaluatePrivateTestEligibility',
    'issueCsrfGrant',
    'issueTemporaryEntitlement',
    'inspectTemporaryEntitlement',
    'evaluatePrivateRuntimeAuthority',
    'revokeTemporaryEntitlement',
    'logout',
    'inspectRecovery',
  ].map((method) => [method, async () => ({
    ok: false,
    allowed: false,
    code: 'AUTHENTICATION_REQUIRED',
  })]));
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService,
    privateRuntimeBridge: {
      async attach(input) {
        attachedInputs.push(input);
        return {
          ok: true,
          allowed: true,
          runtime_ready: true,
          business_engine_attached: true,
          subscription_runtime_attached: true,
          coach_connect_attached: false,
          coach_connect_attachment: null,
          coach_connect_attachment_ref: null,
        };
      },
    },
    operatorContextBridge: operatorBinding.operatorContextBridge,
    resolveOperatorContext: operatorBinding.resolveOperatorContext,
    resolveOperatorBridgeInput: operatorBinding.resolveOperatorBridgeInput,
    operatorActivationDecision: operatorBinding.operatorActivationDecision,
    activationDecision: async () => ({
      ok: false,
      allowed: false,
      code: 'AUTHENTICATION_REQUIRED',
    }),
  });
  const cookie = `more_subdev1_browser=${session.browser.browser_token}; `
    + `more_subdev1_operator=${session.activated.context_token}`;
  const result = await composition.operations.bootstrap(request({}, cookie));
  assert.equal(result.ok, true);
  assert.equal(result.runtime_ready, true);
  assert.equal(result.operator_context_verified, true);
  assert.equal(result.canonical_identity_authority, false);
  assert.equal(result.coach_authority, false);
  assert.equal(attachedInputs.length, 1);
  assert.deepEqual(attachedInputs[0].request.requested_attachments, [
    'BUSINESS_ENGINE',
    'SUBSCRIPTION_RUNTIME',
  ]);

  const canonicalDenied = await composition.operations.beginLogin({
    browser_binding_reference: 'canonical-path-remains-fail-closed',
  });
  assert.equal(canonicalDenied.ok, false);
  assert.equal(canonicalDenied.allowed, false);
  assert.equal(canonicalDenied.code, 'AUTHENTICATION_REQUIRED');

  const coachDenied = await composition.operations.bootstrap(
    request({ request_coach: true }, cookie),
  );
  assert.equal(coachDenied.code, 'COACH_CONNECT_STATE_MISSING');
});

test('attachment diagnostic receipt requires the fully validated deployment-bound operator path', async () => {
  const emitted = [];
  const operatorBinding = binding({ diagnosticSink: (receipt) => emitted.push(receipt) });
  const session = await activateAndSelect(operatorBinding);
  const req = request(
    {},
    `more_subdev1_browser=${session.browser.browser_token}; `
      + `more_subdev1_operator=${session.activated.context_token}`,
  );
  const resolved = await operatorBinding.resolveOperatorContext({ req, body: {} });
  const consumed = await operatorBinding.operatorContextBridge.consume({
    contextToken: resolved.value.context_token,
    browserToken: resolved.value.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: session.selected.profile_receipt,
  });
  const mapped = await operatorBinding.resolveOperatorBridgeInput({
    req,
    request_context: resolved.value,
    operator_context: consumed,
  });
  assert.equal(mapped.ok, true);

  const attempts = [
    { operator_context: { ...consumed, allowed: false }, bridge_input: mapped.value },
    { operator_context: { ...consumed, profile_state: 'NO_PROFILE' }, bridge_input: mapped.value },
    {
      operator_context: {
        ...consumed,
        exact_scope: { ...consumed.exact_scope, business_id: 'wrong_business' },
      },
      bridge_input: mapped.value,
    },
    {
      operator_context: consumed,
      bridge_input: {
        ...mapped.value,
        edgeAttestation: { ...mapped.value.edgeAttestation, operator_context_verified: false },
      },
    },
    {
      operator_context: consumed,
      bridge_input: {
        ...mapped.value,
        authority: { ...mapped.value.authority, deployment_grade_security_state: false },
      },
    },
    {
      operator_context: consumed,
      bridge_input: {
        ...mapped.value,
        cohort_binding_receipt: {
          ...mapped.value.cohort_binding_receipt,
          cohort_digest: 'invalid',
        },
      },
    },
    {
      operator_context: consumed,
      bridge_input: {
        ...mapped.value,
        cohort_binding_receipt: {
          ...mapped.value.cohort_binding_receipt,
          member_digest: 'invalid',
        },
      },
    },
    {
      operator_context: consumed,
      bridge_input: {
        ...mapped.value,
        cohort_binding_receipt: {
          ...mapped.value.cohort_binding_receipt,
          exact_scope_hash: 'e'.repeat(64),
        },
      },
    },
    {
      operator_context: consumed,
      bridge_input: {
        ...mapped.value,
        cohort_binding_receipt: {
          ...mapped.value.cohort_binding_receipt,
          process_local_profile_cache: true,
        },
      },
    },
  ];
  for (const attempt of attempts) {
    const denied = await operatorBinding.recordOperatorAttachmentDiagnostic({
      ...attempt,
      predicate_code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
      stage: 'ATTACHMENT_COORDINATOR',
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'ATTACHMENT_DIAGNOSTIC_NOT_AUTHORIZED');
  }
  assert.equal(emitted.length, 0);

  const recorded = await operatorBinding.recordOperatorAttachmentDiagnostic({
    operator_context: consumed,
    bridge_input: mapped.value,
    predicate_code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
    stage: 'ATTACHMENT_COORDINATOR',
  });
  assert.equal(recorded.ok, true);
  assert.equal(recorded.recorded, true);
  assert.equal(emitted.length, 1);
  assert.deepEqual(Object.keys(emitted[0]).sort(), [
    'correlation_id',
    'deployment_version_identifier',
    'occurred_at',
    'outcome',
    'predicate_code',
    'profile_category',
    'receipt_version',
    'stage',
  ]);
  assert.equal(emitted[0].profile_category, 'SYNTHETIC');
  assert.equal(JSON.stringify(emitted[0]).includes(profileId), false);
  assert.equal(JSON.stringify(emitted[0]).includes(accessCode), false);
  const audit = await operatorBinding.operatorStore.auditSnapshot();
  const diagnosticAudit = audit.at(-1);
  assert.equal(
    diagnosticAudit.event_type,
    'PRIVATE_BETA_OPERATOR_ATTACHMENT_DIAGNOSTIC_RECORDED',
  );
  assert.equal(diagnosticAudit.failure_code, 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND');
  assert.equal(JSON.stringify(diagnosticAudit).includes(profileId), false);
  assert.equal(JSON.stringify(diagnosticAudit).includes(accessCode), false);
});

test('protected diagnostic log remains available when audit persistence is unavailable', async () => {
  const emitted = [];
  const operatorBinding = binding({ diagnosticSink: (receipt) => emitted.push(receipt) });
  const session = await activateAndSelect(operatorBinding);
  const req = request(
    {},
    `more_subdev1_browser=${session.browser.browser_token}; `
      + `more_subdev1_operator=${session.activated.context_token}`,
  );
  const resolved = await operatorBinding.resolveOperatorContext({ req, body: {} });
  const consumed = await operatorBinding.operatorContextBridge.consume({
    contextToken: resolved.value.context_token,
    browserToken: resolved.value.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: session.selected.profile_receipt,
  });
  const mapped = await operatorBinding.resolveOperatorBridgeInput({
    req,
    request_context: resolved.value,
    operator_context: consumed,
  });
  const appendAudit = operatorBinding.operatorStore.appendAudit.bind(
    operatorBinding.operatorStore,
  );
  operatorBinding.operatorStore.appendAudit = (event) => (
    event?.event_type === 'PRIVATE_BETA_OPERATOR_ATTACHMENT_DIAGNOSTIC_RECORDED'
      ? { ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' }
      : appendAudit(event)
  );

  const recorded = await operatorBinding.recordOperatorAttachmentDiagnostic({
    operator_context: consumed,
    bridge_input: mapped.value,
    predicate_code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
    stage: 'ATTACHMENT_COORDINATOR',
  });
  assert.equal(recorded.ok, true);
  assert.equal(recorded.protected_log_emitted, true);
  assert.equal(recorded.protected_audit_persisted, false);
  assert.equal(emitted.length, 1);
  assert.equal(JSON.stringify(emitted[0]).includes(profileId), false);
  assert.equal(JSON.stringify(emitted[0]).includes(accessCode), false);
});

test('default protected diagnostic sink emits the restricted receipt at server error level', async () => {
  const emitted = [];
  const priorError = console.error;
  console.error = (...args) => emitted.push(args);
  try {
    const operatorBinding = binding();
    const session = await activateAndSelect(operatorBinding);
    const req = request(
      {},
      `more_subdev1_browser=${session.browser.browser_token}; `
        + `more_subdev1_operator=${session.activated.context_token}`,
    );
    const resolved = await operatorBinding.resolveOperatorContext({ req, body: {} });
    const consumed = await operatorBinding.operatorContextBridge.consume({
      contextToken: resolved.value.context_token,
      browserToken: resolved.value.browser_token,
      action: 'OPEN_SUBSCRIPTION',
      profileReceipt: session.selected.profile_receipt,
    });
    const mapped = await operatorBinding.resolveOperatorBridgeInput({
      req,
      request_context: resolved.value,
      operator_context: consumed,
    });
    const recorded = await operatorBinding.recordOperatorAttachmentDiagnostic({
      operator_context: consumed,
      bridge_input: mapped.value,
      predicate_code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
      stage: 'ATTACHMENT_COORDINATOR',
    });
    assert.equal(recorded.ok, true);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0][0], 'PRIVATE_BETA_OPERATOR_ATTACHMENT_DIAGNOSTIC_RECEIPT');
    assert.equal(JSON.stringify(emitted).includes(profileId), false);
    assert.equal(JSON.stringify(emitted).includes(accessCode), false);
  } finally {
    console.error = priorError;
  }
});

test('forged missing inactive and unselected operator requests emit no attachment receipt', async () => {
  const emitted = [];
  const operatorBinding = binding({ diagnosticSink: (receipt) => emitted.push(receipt) });
  const canonicalSecurityService = Object.fromEntries([
    'describe',
    'health',
    'beginPreAuth',
    'completeAuthentication',
    'resolveAuthenticatedContext',
    'evaluatePrivateTestEligibility',
    'issueCsrfGrant',
    'issueTemporaryEntitlement',
    'inspectTemporaryEntitlement',
    'evaluatePrivateRuntimeAuthority',
    'revokeTemporaryEntitlement',
    'logout',
    'inspectRecovery',
  ].map((method) => [method, async () => ({
    ok: false,
    allowed: false,
    code: 'AUTHENTICATION_REQUIRED',
  })]));
  const composition = createPrivateRuntimeLiveCompositionV2({
    canonicalSecurityService,
    privateRuntimeBridge: {
      async attach() {
        return {
          ok: false,
          allowed: false,
          code: 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
          runtime_ready: false,
        };
      },
    },
    operatorContextBridge: operatorBinding.operatorContextBridge,
    resolveOperatorContext: operatorBinding.resolveOperatorContext,
    resolveOperatorBridgeInput: operatorBinding.resolveOperatorBridgeInput,
    recordOperatorAttachmentDiagnostic:
      operatorBinding.recordOperatorAttachmentDiagnostic,
    operatorActivationDecision: operatorBinding.operatorActivationDecision,
    activationDecision: async () => ({
      ok: false,
      allowed: false,
      code: 'AUTHENTICATION_REQUIRED',
    }),
  });

  await composition.operations.bootstrap(request());
  await composition.operations.bootstrap(request({}, 'forged_cookie_name=value'));
  await composition.operations.bootstrap(request(
    {},
    '__Host-more_subdev1_browser=forged; __Host-more_subdev1_operator=forged',
  ));
  const browser = await operatorBinding.operatorContextBridge.establishBrowser();
  const csrf = await operatorBinding.operatorContextBridge.issueCsrf({
    request: request(),
    browserToken: browser.browser_token,
  });
  const activated = await operatorBinding.operatorContextBridge.activate({
    request: request(),
    browserToken: browser.browser_token,
    csrfProof: csrf.csrf_proof,
    submittedCode: accessCode,
  });
  await composition.operations.bootstrap(request(
    {},
    `more_subdev1_browser=${browser.browser_token}; `
      + `more_subdev1_operator=${activated.context_token}`,
  ));
  assert.equal(emitted.length, 0);

  const selected = await activateAndSelect(operatorBinding);
  const validResult = await composition.operations.bootstrap(request(
    {},
    `more_subdev1_browser=${selected.browser.browser_token}; `
      + `more_subdev1_operator=${selected.activated.context_token}`,
  ));
  assert.equal(validResult.code, 'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND');
  assert.equal(emitted.length, 1);
});

test('wrong deployment receipt prevents diagnostic emission', async () => {
  const emitted = [];
  const operatorBinding = binding({
    diagnosticSink: (receipt) => emitted.push(receipt),
    authority: {
      authority_packet: {
        environment_id: 'private_beta_test',
        live_enabled: true,
        emergency_disabled: false,
      },
      activation_receipt: {
        deployment_commit_sha: 'wrong',
        deployment_tree_sha: 'wrong',
        approved: true,
        controlled_internal_beta: true,
        private_live_only: true,
        public_access: false,
      },
    },
  });
  const session = await activateAndSelect(operatorBinding);
  const req = request(
    {},
    `more_subdev1_browser=${session.browser.browser_token}; `
      + `more_subdev1_operator=${session.activated.context_token}`,
  );
  const resolved = await operatorBinding.resolveOperatorContext({ req, body: {} });
  const consumed = await operatorBinding.operatorContextBridge.consume({
    contextToken: resolved.value.context_token,
    browserToken: resolved.value.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: session.selected.profile_receipt,
  });
  const mapped = await operatorBinding.resolveOperatorBridgeInput({
    req,
    request_context: resolved.value,
    operator_context: consumed,
  });
  const denied = await operatorBinding.recordOperatorAttachmentDiagnostic({
    operator_context: consumed,
    bridge_input: mapped.value,
    predicate_code: 'ATTACHMENT_PARTIAL_FAILURE',
  });
  assert.equal(denied.code, 'ATTACHMENT_DIAGNOSTIC_NOT_AUTHORIZED');
  assert.equal(emitted.length, 0);
});
