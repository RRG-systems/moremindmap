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
    authority: {
      authority_packet: {
        environment_id: 'private_beta_test',
        live_enabled: true,
        emergency_disabled: false,
      },
      activation_receipt: { approved: true },
    },
    productBindingAttestation: {
      environment_id: 'private_beta_test',
      subscriber_subject_ref: 'subject_a',
      exact_scope: exactScope,
      exact_scope_hash: exactScopeHash,
    },
    productExecutionBinding: {
      exact_scope: exactScope,
      exact_scope_hash: exactScopeHash,
      approved_profile_ids: [profileId],
    },
    clock: () => now,
    randomToken: () => `operator-binding-token-${String(token += 1).padStart(40, '0')}`,
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
