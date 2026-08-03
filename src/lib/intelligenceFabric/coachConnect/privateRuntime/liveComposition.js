import { deepFreeze } from '../../validation.js';
import { isThenable } from '../productionSecurity/asyncSharedSecurityStatePort.js';
import {
  createDeveloperAccessSecurityFacadeV2,
  validateCanonicalAsyncSecurityServiceShape,
} from './developerAccessSecurityFacade.js';
import {
  buildPrivateRuntimeLiveCompositionRootV2,
  createDeferredPrivateRuntimeLiveCompositionV2,
} from './liveBindings/compositionRoot.js';

export const PRIVATE_RUNTIME_LIVE_COMPOSITION_VERSION = 'private-runtime-live-composition-v2';

const frozen = (value) => deepFreeze(structuredClone(value));
const denial = (code = 'ASYNC_SECURITY_UNCONFIGURED', status = 404) => frozen({
  ok: false,
  allowed: false,
  code,
  status,
});

export async function settlePrivateRuntimeLiveOperation(operation, args = []) {
  if (typeof operation !== 'function') return denial();
  let returned;
  try {
    returned = operation(...args);
  } catch {
    return denial('ASYNC_SECURITY_CONTRACT_VIOLATION', 503);
  }
  if (!isThenable(returned)) return denial('ASYNC_SECURITY_CONTRACT_VIOLATION', 503);
  try {
    const value = await returned;
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.ok !== 'boolean') {
      return denial('ASYNC_SECURITY_RESULT_INVALID', 503);
    }
    return Object.freeze(value);
  } catch {
    return denial('ASYNC_SECURITY_REJECTED', 503);
  }
}

const UNCONFIGURED_OPERATIONS = Object.freeze(Object.fromEntries([
  'beginLogin',
  'completeLogin',
  'inspectSession',
  'developerAccess',
  'resolveSubscriptionEntitlement',
  'bootstrap',
  'logout',
].map((name) => [name, async () => denial()])));

const UNCONFIGURED_COMPOSITION = Object.freeze({
  composition_version: PRIVATE_RUNTIME_LIVE_COMPOSITION_VERSION,
  configured: false,
  source_default_off: true,
  provider_adapter: false,
  provider_connection: false,
  v1_fallback: false,
  mixed_sync_async: false,
  enabled: () => false,
  describe: async () => frozen({
    ok: true,
    allowed: false,
    composition_version: PRIVATE_RUNTIME_LIVE_COMPOSITION_VERSION,
    configured: false,
    state: 'UNCONFIGURED',
    source_default_off: true,
    provider_adapter: false,
    provider_connection: false,
    v1_fallback: false,
  }),
  operations: UNCONFIGURED_OPERATIONS,
});

let sourceBoundComposition = null;

export function resetPrivateRuntimeLiveCompositionV2ForTests() {
  if (globalThis.process?.env?.NODE_ENV !== 'test') return false;
  sourceBoundComposition = null;
  return true;
}

function requestBody(req) {
  if (typeof req?.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req?.body || {};
}

export function createPrivateRuntimeLiveCompositionV2({
  canonicalSecurityService,
  developerAccessFacade = null,
  assertionPort = null,
  privateRuntimeBridge = null,
  intelligenceExecution = null,
  resolveRequestContext = null,
  resolveBridgeInput = null,
  operatorContextBridge = null,
  resolveOperatorContext = null,
  resolveOperatorBridgeInput = null,
  recordOperatorAttachmentDiagnostic = null,
  serializeAuthenticatedSession = null,
  activationDecision = async () => false,
  operatorActivationDecision = async () => false,
  providerAdapterBound = false,
} = {}) {
  const serviceValidation = validateCanonicalAsyncSecurityServiceShape(canonicalSecurityService);
  if (!serviceValidation.valid) {
    throw new TypeError(`canonical async security service is invalid: ${serviceValidation.missing.join(',')}`);
  }
  const facade = developerAccessFacade
    || createDeveloperAccessSecurityFacadeV2({ canonicalSecurityService });
  const inFlightBootstrap = new Map();

  async function active(req) {
    const decision = await settlePrivateRuntimeLiveOperation(activationDecision, [req]);
    return decision.ok === true && decision.allowed === true
      ? decision
      : denial(decision.code || 'ASYNC_SECURITY_UNCONFIGURED', decision.status || 404);
  }

  async function contextFor(kind, req, extra = {}) {
    if (typeof resolveRequestContext !== 'function') return denial();
    return settlePrivateRuntimeLiveOperation(resolveRequestContext, [{
      kind,
      req,
      body: requestBody(req),
      ...extra,
    }]);
  }

  async function invokeService(method, args) {
    return settlePrivateRuntimeLiveOperation(
      canonicalSecurityService?.[method]?.bind(canonicalSecurityService),
      args,
    );
  }

  async function bootstrapOperatorContext(req, body) {
    if (typeof operatorContextBridge?.inspect !== 'function'
      || typeof operatorContextBridge?.consume !== 'function'
      || typeof privateRuntimeBridge?.attach !== 'function'
      || typeof resolveOperatorContext !== 'function'
      || typeof resolveOperatorBridgeInput !== 'function') {
      return null;
    }
    const resolved = await settlePrivateRuntimeLiveOperation(
      resolveOperatorContext,
      [{ req, body }],
    );
    if (!resolved.ok) return resolved;
    if (resolved.value?.operator_present !== true) return null;

    const activation = await settlePrivateRuntimeLiveOperation(
      operatorActivationDecision,
      [req],
    );
    if (!activation.allowed) {
      return denial(activation.code || 'OPERATOR_BRIDGE_DISABLED', activation.status || 404);
    }
    const tokens = {
      contextToken: resolved.value.context_token,
      browserToken: resolved.value.browser_token,
    };
    const inspected = await settlePrivateRuntimeLiveOperation(
      operatorContextBridge.inspect.bind(operatorContextBridge),
      [tokens],
    );
    if (!inspected.allowed
      || inspected.active !== true
      || inspected.profile_state !== 'PROFILE_ACTIVE'
      || !inspected.profile_receipt) {
      return denial(inspected.code || 'PROFILE_RESOLUTION_DENIED', 403);
    }
    const intelligenceOperation = body.intelligence_operation || null;
    const action = intelligenceOperation == null
      ? 'OPEN_SUBSCRIPTION'
      : 'SUBSCRIPTION_INTERACTION';
    const consumed = await settlePrivateRuntimeLiveOperation(
      operatorContextBridge.consume.bind(operatorContextBridge),
      [{
        ...tokens,
        action,
        profileReceipt: inspected.profile_receipt,
      }],
    );
    if (!consumed.allowed) return consumed;

    const bridgeInput = await settlePrivateRuntimeLiveOperation(
      resolveOperatorBridgeInput,
      [{
        req,
        request_context: resolved.value,
        operator_context: consumed,
      }],
    );
    if (!bridgeInput.ok) return bridgeInput;
    const attached = await settlePrivateRuntimeLiveOperation(
      privateRuntimeBridge.attach.bind(privateRuntimeBridge),
      [bridgeInput.value],
    );
    if (!attached.ok) {
      if (typeof recordOperatorAttachmentDiagnostic === 'function') {
        await settlePrivateRuntimeLiveOperation(
          recordOperatorAttachmentDiagnostic,
          [{
            operator_context: consumed,
            bridge_input: bridgeInput.value,
            predicate_code: attached.code,
            stage: 'ATTACHMENT_COORDINATOR',
          }],
        );
      }
      return attached;
    }

    const current = await settlePrivateRuntimeLiveOperation(
      operatorContextBridge.consume.bind(operatorContextBridge),
      [{
        ...tokens,
        action,
        profileReceipt: inspected.profile_receipt,
      }],
    );
    if (!current.allowed
      || current.context_id !== consumed.context_id
      || current.profile_generation !== consumed.profile_generation
      || current.exact_scope_hash !== consumed.exact_scope_hash) {
      return denial(current.code || 'PROFILE_RECEIPT_STALE', 403);
    }
    if (intelligenceOperation == null) {
      return Object.freeze({
        ...attached,
        operator_context_verified: true,
        authority_source: 'temporary_internal_beta_operator_context',
        canonical_identity_authority: false,
        coach_authority: false,
        stripe_authority: false,
      });
    }
    if (typeof intelligenceExecution?.execute !== 'function') {
      return denial('PRIVATE_LIVE_PRODUCT_EXECUTION_UNCONFIGURED', 404);
    }
    const executed = await settlePrivateRuntimeLiveOperation(
      intelligenceExecution.execute.bind(intelligenceExecution),
      [{
        operation: intelligenceOperation,
        request: {
          ...bridgeInput.value.request,
          intelligence_input: body.intelligence_input || null,
        },
        requestContext: bridgeInput.value.requestContext,
        authority: bridgeInput.value.authority,
        attachmentSet: attached,
      }],
    );
    if (!executed.ok) return executed;
    return Object.freeze({
      ...attached,
      ...executed,
      runtime_ready: attached.runtime_ready === true
        && executed.runtime_ready === true,
      operator_context_verified: true,
      authority_source: 'temporary_internal_beta_operator_context',
      canonical_identity_authority: false,
      coach_authority: false,
      stripe_authority: false,
    });
  }

  const operations = {
    async beginLogin(input, req = null) {
      const activation = await active(req);
      if (!activation.allowed) return activation;
      const context = await contextFor('login', req, { input });
      if (!context.ok) return context;
      const begun = await invokeService('beginPreAuth', [context.value]);
      if (!begun.allowed) return begun;
      if (typeof assertionPort?.beginAuthorization !== 'function') {
        return denial('SUBJECT_ASSERTION_REQUIRED', 401);
      }
      const authorization = await settlePrivateRuntimeLiveOperation(
        assertionPort.beginAuthorization.bind(assertionPort),
        [{
          pre_auth_session_ref: begun.pre_auth_session_ref,
          browser_binding_hash: context.value.browser_binding_hash,
          correlation_ref: context.value.correlation_ref,
          edge_attestation: context.value.edge_attestation,
          rotation_parent_session_token_hash:
            context.value.rotation_parent_session_token_hash,
          rotation_parent_reference: context.value.rotation_parent_reference,
        }],
      );
      if (!authorization.ok) return authorization;
      return frozen({
        ...begun,
        authorization_url: authorization.authorization_url,
        transaction_cookie_value: authorization.transaction_cookie_value,
        browser_binding_cookie_value: context.value.browser_binding_reference,
        authority_granted: false,
      });
    },

    async completeLogin(req) {
      const activation = await active(req);
      if (!activation.allowed) return activation;
      if (typeof assertionPort?.verify !== 'function') return denial('SUBJECT_ASSERTION_REQUIRED', 401);
      const context = await contextFor('callback', req);
      if (!context.ok) return context;
      const assertion = await settlePrivateRuntimeLiveOperation(
        assertionPort.verify.bind(assertionPort),
        [context.value.assertion_input],
      );
      if (!assertion.ok || assertion.verified_assertion?.verification_status !== 'VERIFIED') {
        return denial(assertion.code || 'SUBJECT_ASSERTION_INVALID', 401);
      }
      const authenticated = await invokeService('completeAuthentication', [{
        ...context.value,
        verified_assertion: assertion.verified_assertion,
        rotation_parent_session_token_hash:
          assertion.rotation_parent_session_token_hash,
        rotation_parent_reference: assertion.rotation_parent_reference,
      }]);
      if (!authenticated.allowed) return authenticated;
      if (typeof serializeAuthenticatedSession !== 'function') {
        return denial('SESSION_ELEVATION_REQUIRED', 503);
      }
      const serialized = await settlePrivateRuntimeLiveOperation(
        serializeAuthenticatedSession,
        [{ result: authenticated, context: context.value }],
      );
      if (!serialized.ok || typeof serialized.value !== 'string') {
        return denial(serialized.code || 'SESSION_ELEVATION_REQUIRED', 503);
      }
      return frozen({
        ...authenticated,
        session_cookie_value: serialized.value,
        raw_assertion_present: false,
        raw_token_persisted: false,
      });
    },

    async inspectSession(req) {
      const activation = await active(req);
      if (!activation.allowed) return activation;
      const context = await contextFor('session', req);
      if (!context.ok) return context;
      const authenticated = await invokeService('resolveAuthenticatedContext', [context.value]);
      if (!authenticated.allowed) return authenticated;
      const entitlement = context.value.entitlement_token_hash
        ? await invokeService('inspectTemporaryEntitlement', [context.value])
        : denial('ENTITLEMENT_REQUIRED', 403);
      return frozen({
        ok: true,
        allowed: true,
        status: 200,
        authenticated: true,
        entitlement_active: entitlement.allowed === true,
        runtime_ready: false,
        session_receipt: authenticated.canonical_subject?.receipt_ref || null,
        attachment_receipts: null,
      });
    },

    async developerAccess(req) {
      const activation = await active(req);
      if (!activation.allowed) return activation;
      const context = await contextFor('developer_access', req);
      if (!context.ok) return context;
      if (req?.method === 'GET') {
        const authenticated = await settlePrivateRuntimeLiveOperation(
          facade.resolveAuthenticatedContext.bind(facade),
          [context.value],
        );
        if (!authenticated.allowed) return authenticated;
        const method = String(req?.headers?.['x-coach-connect-csrf-intent'] || 'POST')
          .toUpperCase() === 'DELETE' ? 'DELETE' : 'POST';
        const csrf = await settlePrivateRuntimeLiveOperation(
          facade.issueCsrf.bind(facade),
          [context.value, {
            route: '/api/internal/developer-access',
            method,
            browser_binding_hash: context.value.browser_binding_hash,
          }],
        );
        if (!csrf.allowed) return csrf;
        const entitlement = context.value.entitlement_token_hash
          ? await settlePrivateRuntimeLiveOperation(
            facade.inspectEntitlement.bind(facade),
            [context.value],
          )
          : denial('ENTITLEMENT_REQUIRED', 403);
        return frozen({
          ok: true,
          allowed: entitlement.allowed === true,
          status: entitlement.allowed === true ? 200 : 403,
          csrf_proof: csrf.csrf_proof,
          csrf_method: method,
          entitlement: entitlement.entitlement || null,
        });
      }
      if (req?.method === 'POST') {
        return settlePrivateRuntimeLiveOperation(
          facade.issueEntitlement.bind(facade),
          [context.value, requestBody(req).access_code],
        );
      }
      if (req?.method === 'DELETE') {
        return settlePrivateRuntimeLiveOperation(
          facade.revokeEntitlement.bind(facade),
          [context.value],
        );
      }
      return denial('RUNTIME_ACTION_DENIED', 405);
    },

    async resolveSubscriptionEntitlement(req) {
      const activation = await active(req);
      if (!activation.allowed) return activation;
      const context = await contextFor('subscription_entitlement', req);
      if (!context.ok) return context;
      const authority = await invokeService('evaluatePrivateRuntimeAuthority', [{
        request_context: context.value,
        requested_runtime: 'SUBSCRIPTION_RUNTIME',
        requested_action: 'inspect_private_subscription_entitlement',
      }]);
      if (!authority.allowed) return authority;
      const entitlement = await invokeService('inspectTemporaryEntitlement', [context.value]);
      return entitlement.allowed
        ? frozen({ ...entitlement, authority })
        : entitlement;
    },

    async bootstrap(req) {
      const body = requestBody(req);
      const operatorResult = await bootstrapOperatorContext(req, body);
      if (operatorResult != null) return operatorResult;
      const activation = await active(req);
      if (!activation.allowed) return activation;
      if (typeof privateRuntimeBridge?.attach !== 'function'
        || typeof resolveBridgeInput !== 'function') return denial();
      const context = await contextFor('bootstrap', req);
      if (!context.ok) return context;
      const authority = await invokeService('evaluatePrivateRuntimeAuthority', [{
        request_context: context.value,
        requested_runtime: 'BUSINESS_ENGINE',
        requested_action: 'attach_existing_private_runtime',
      }]);
      if (!authority.allowed) return authority;
      const intelligenceOperation = body.intelligence_operation || null;
      const bridgeKey = [
        authority.authority_fingerprint,
        intelligenceOperation || 'ATTACH_ONLY',
        context.value.idempotency_ref || 'NO_IDEMPOTENCY_REFERENCE',
      ].join(':');
      if (!inFlightBootstrap.has(bridgeKey)) {
        const pending = (async () => {
          const bridgeInput = await settlePrivateRuntimeLiveOperation(
            resolveBridgeInput,
            [{ req, request_context: context.value, authority }],
          );
          if (!bridgeInput.ok) return bridgeInput;
          const attached = await settlePrivateRuntimeLiveOperation(
            privateRuntimeBridge.attach.bind(privateRuntimeBridge),
            [bridgeInput.value],
          );
          if (!attached.ok) return attached;
          const revalidated = await invokeService('evaluatePrivateRuntimeAuthority', [{
            request_context: context.value,
            requested_runtime: 'BUSINESS_ENGINE',
            requested_action: 'attach_existing_private_runtime',
          }]);
          if (!revalidated.allowed
            || revalidated.authority_fingerprint !== authority.authority_fingerprint) {
            return denial('RUNTIME_AUTHORITY_DENIED', 403);
          }
          if (intelligenceOperation == null) return attached;
          if (typeof intelligenceExecution?.execute !== 'function') {
            return denial('PRIVATE_LIVE_PRODUCT_EXECUTION_UNCONFIGURED', 404);
          }
          const executed = await settlePrivateRuntimeLiveOperation(
            intelligenceExecution.execute.bind(intelligenceExecution),
            [{
              operation: intelligenceOperation,
              request: {
                ...bridgeInput.value.request,
                intelligence_input: body.intelligence_input || null,
              },
              requestContext: context.value,
              authority: revalidated,
              attachmentSet: attached,
            }],
          );
          if (!executed.ok) return executed;
          return frozen({
            ...attached,
            ...executed,
            runtime_ready: attached.runtime_ready === true
              && executed.runtime_ready === true,
          });
        })();
        inFlightBootstrap.set(bridgeKey, pending);
        pending.finally(() => inFlightBootstrap.delete(bridgeKey));
      }
      return inFlightBootstrap.get(bridgeKey);
    },

    async logout(req) {
      const activation = await active(req);
      if (!activation.allowed) return activation;
      const context = await contextFor('logout', req);
      if (!context.ok) return context;
      return invokeService('logout', [{ request_context: context.value }]);
    },
  };

  return Object.freeze({
    composition_version: PRIVATE_RUNTIME_LIVE_COMPOSITION_VERSION,
    configured: true,
    source_default_off: true,
    provider_adapter: providerAdapterBound === true,
    provider_connection: false,
    v1_fallback: false,
    mixed_sync_async: false,
    enabled: (req) => active(req),
    async describe() {
      const service = await invokeService('describe');
      return frozen({
        ok: service.ok === true,
        allowed: false,
        composition_version: PRIVATE_RUNTIME_LIVE_COMPOSITION_VERSION,
        configured: true,
        state: service.ok ? 'CONFIGURED_DEFAULT_OFF' : 'INVALID',
        source_default_off: true,
        provider_adapter: providerAdapterBound === true,
        provider_connection: service.capability?.live_connection_verified === true,
        v1_fallback: false,
      });
    },
    operations: Object.freeze(operations),
  });
}

export function getPrivateRuntimeLiveCompositionV2() {
  if (!sourceBoundComposition) {
    sourceBoundComposition = createDeferredPrivateRuntimeLiveCompositionV2({
      build: () => buildPrivateRuntimeLiveCompositionRootV2({
        createLiveComposition: createPrivateRuntimeLiveCompositionV2,
      }),
    });
  }
  return sourceBoundComposition || UNCONFIGURED_COMPOSITION;
}
