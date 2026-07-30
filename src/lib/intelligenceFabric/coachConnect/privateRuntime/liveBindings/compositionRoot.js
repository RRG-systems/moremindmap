import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import Redis from 'ioredis';
import { deepFreeze } from '../../../validation.js';
import {
  createCanonicalAsyncSecurityServiceV2,
} from '../canonicalAsyncSecurityService.js';
import {
  createDeveloperAccessSecurityFacadeV2,
} from '../developerAccessSecurityFacade.js';
import {
  createUpstashRedisRemoteSharedSecurityAdapter,
  UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
} from '../../productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js';
import {
  createQualificationDigestFunction,
} from '../../productionSecurity/remoteSharedSecurity/keyspace.js';
import {
  createAuth0LiveSubscriberAssertionAdapterV1,
} from '../../productionSecurity/liveSubscriberAssertion/auth0Adapter.js';
import {
  createProtectedEdgeIdentityBindingV1,
} from '../../productionSecurity/protectedEdgeIdentity/adapter.js';
import {
  createCanonicalBusinessEngineLiveAttachmentAdapterV1,
} from './businessEngineAttachmentAdapter.js';
import {
  createExistingSubscriptionRuntimeLiveAttachmentAdapterV1,
} from './subscriptionRuntimeAttachmentAdapter.js';
import {
  createExistingCoachConnectLiveAttachmentAdapterV1,
} from './coachConnectAttachmentAdapter.js';
import {
  createPrivateRuntimeLiveAttachmentCoordinatorV1,
} from './attachmentCoordinator.js';
import {
  readPrivateRuntimeLiveConfigurationAuthorityV1,
} from './configurationAuthority.js';
import {
  readPrivateLiveProductExecutionBindingV1,
} from './productExecutionBinding.js';
import {
  createPrivateLiveProductStoreV1,
} from './privateLiveProductStore.js';
import {
  createPrivateRuntimeIntelligenceExecutionV1,
} from '../intelligenceExecution.js';
import {
  createExactVaultProfileReader,
  createSubdev1CanonicalExactProfileRepository,
  createUpstashSubdev1OperatorBridgeStore,
} from '../operatorBridge/index.js';
import {
  createPrivateRuntimeOperatorBridgeLiveBindingV1,
} from './operatorBridgeBinding.js';
import {
  PRIVATE_RUNTIME_APPROVED_CAPABILITIES,
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
} from '../contracts.js';

export const PRIVATE_RUNTIME_LIVE_COMPOSITION_ROOT_VERSION =
  'private-runtime-live-composition-root-v2';

const SESSION_COOKIE_NAME = '__Host-more_session';
const BROWSER_COOKIE_NAME = '__Host-more_browser_binding';
const OIDC_COOKIE_NAME = '__Host-more_oidc_transaction';
const ENTITLEMENT_COOKIE_NAME = '__Host-coach_connect_dev_capability';

const frozen = (value) => deepFreeze(structuredClone(value));
const denial = (code = 'ASYNC_SECURITY_UNCONFIGURED', status = 404) => frozen({
  ok: false,
  allowed: false,
  code,
  status,
});
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function cookieValue(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

function requestQuery(req) {
  if (req?.query && typeof req.query === 'object') return req.query;
  try {
    const url = new URL(req?.url || '/', 'https://private.invalid');
    return Object.fromEntries(url.searchParams.entries());
  } catch {
    return {};
  }
}

function correlationReference(req) {
  const supplied = req?.headers?.['x-correlation-id'];
  return typeof supplied === 'string'
    && supplied.length >= 3
    && supplied.length <= 160
    && /^[a-zA-Z0-9:_-]+$/.test(supplied)
    ? supplied
    : `correlation_${crypto.randomUUID().replaceAll('-', '')}`;
}

function hmac(keyMaterial, domain, value) {
  return crypto.createHmac('sha256', keyMaterial)
    .update(`${domain}\0${value}`, 'utf8')
    .digest('hex');
}

function createSessionEnvelopeCodec(keyMaterial, clock = () => Date.now()) {
  const key = crypto.createHash('sha256')
    .update('more-private-runtime-session-envelope-v2\0')
    .update(keyMaterial)
    .digest();
  return Object.freeze({
    seal(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from('private-runtime-session-envelope-v2'));
      const ciphertext = Buffer.concat([
        cipher.update(JSON.stringify(value), 'utf8'),
        cipher.final(),
      ]);
      return [
        iv.toString('base64url'),
        ciphertext.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
      ].join('.');
    },
    open(serialized) {
      try {
        if (typeof serialized !== 'string' || serialized.length > 8192) return null;
        const parts = serialized.split('.');
        if (parts.length !== 3) return null;
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          key,
          Buffer.from(parts[0], 'base64url'),
        );
        decipher.setAAD(Buffer.from('private-runtime-session-envelope-v2'));
        decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
        const value = JSON.parse(Buffer.concat([
          decipher.update(Buffer.from(parts[1], 'base64url')),
          decipher.final(),
        ]).toString('utf8'));
        return value?.envelope_version === 'private-runtime-session-envelope-v2'
          && typeof value.session_token === 'string'
          && typeof value.external_subject_ref === 'string'
          && sha256(value.exact_scope_hash)
          && typeof value.browser_binding_reference === 'string'
          && Number.isFinite(Date.parse(value.expires_at))
          && Date.parse(value.expires_at) > clock()
          ? frozen(value)
          : null;
      } catch {
        return null;
      }
    },
  });
}

function makeDeniedComposition(code = 'ASYNC_SECURITY_UNCONFIGURED', status = 404) {
  const operations = Object.freeze(Object.fromEntries([
    'beginLogin',
    'completeLogin',
    'inspectSession',
    'developerAccess',
    'resolveSubscriptionEntitlement',
    'bootstrap',
    'logout',
  ].map((name) => [name, async () => denial(code, status)])));
  return Object.freeze({
    composition_version: 'private-runtime-live-composition-v2',
    configured: false,
    source_default_off: true,
    provider_adapter: false,
    provider_connection: false,
    v1_fallback: false,
    mixed_sync_async: false,
    enabled: async () => false,
    describe: async () => frozen({
      ok: true,
      allowed: false,
      configured: false,
      state: 'UNCONFIGURED',
      code,
      provider_call_required: false,
    }),
    operations,
  });
}

export async function buildPrivateRuntimeLiveCompositionRootV2({
  createLiveComposition,
  env = globalThis.process?.env || {},
  resolveReference,
  fetchImpl = globalThis.fetch,
  clock = () => Date.now(),
  operatorContextBridge = null,
  resolveOperatorContext = null,
  resolveOperatorBridgeInput = null,
  operatorActivationDecision = null,
  createProductStoreClient = (url) => new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    tls: {},
  }),
} = {}) {
  if (typeof createLiveComposition !== 'function') return makeDeniedComposition();
  const adapterSourceSha256 = env.MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256;
  if (!sha256(adapterSourceSha256)) return makeDeniedComposition();

  const authority = await readPrivateRuntimeLiveConfigurationAuthorityV1({
    env,
    resolveReference,
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256,
    nowMs: clock(),
  });
  if (!authority.ok) {
    return makeDeniedComposition(authority.code, authority.code === 'EMERGENCY_DISABLED' ? 503 : 404);
  }

  const secretResolver = authority.resolve_secret_reference;
  const remoteConfiguration = authority.remote_configuration;
  const [tokenHashKey, scopeHashKey, privateAccessCode] =
    await Promise.all([
      secretResolver(remoteConfiguration.token_hash_key_ref, {
        purpose: 'PRIVATE_RUNTIME_TOKEN_HASH_KEY',
        secret: true,
      }),
      secretResolver(remoteConfiguration.scope_hash_key_ref, {
        purpose: 'PRIVATE_RUNTIME_SCOPE_HASH_KEY',
        secret: true,
      }),
      secretResolver(authority.authority_packet.private_access_code_ref, {
        purpose: 'PRIVATE_RUNTIME_ACCESS_CODE',
        secret: true,
      }),
    ]);
  if ([tokenHashKey, scopeHashKey, privateAccessCode]
    .some((value) => typeof value !== 'string' || value.length < 16)) {
    return makeDeniedComposition();
  }

  const keyedDigest = createQualificationDigestFunction(scopeHashKey);
  const statePort = createUpstashRedisRemoteSharedSecurityAdapter({
    configuration: remoteConfiguration,
    operating_mode: 'PRIVATE_LIVE',
    qualification_certificate: authority.qualification_certificate,
    live_environment_attestation: authority.live_environment_attestation,
    expected_adapter_source_sha256: adapterSourceSha256,
    expected_qualification_review_package_sha256:
      '28b42df527bea92dce9a0ccfab9b72a933f8975529e3f02a64853b289f0c47ac',
    expected_attestation_repair_review_package_sha256:
      '4545be94544cdaf29940a45968ef2ac52b6865ed901aac87b84c265bf69f1b45',
    resolve_secret_reference: secretResolver,
    keyed_digest: keyedDigest,
    fetch_impl: fetchImpl,
    clock,
  });
  const protectedEdgeBinding = await createProtectedEdgeIdentityBindingV1({
    configuration: authority.protected_edge_configuration,
    resolveReference: secretResolver,
    statePort,
    clock,
  });
  if (protectedEdgeBinding.configured !== true) return makeDeniedComposition();

  const productBinding = authority.product_binding_attestation;
  const canonicalSecurityService = createCanonicalAsyncSecurityServiceV2({
    statePort,
    environmentId: authority.authority_packet.environment_id,
    expectedPrivateAccessCode: privateAccessCode,
    tokenHasher: async (value) => hmac(tokenHashKey, 'private_runtime_token', value),
    configuration: {
      enabled: authority.authority_packet.live_enabled === true,
      emergency_disabled: authority.authority_packet.emergency_disabled === true,
      environment_allowlist: [authority.authority_packet.environment_id],
      subject_allowlist: [productBinding.subscriber_subject_ref],
      scope_allowlist: [productBinding.exact_scope_hash],
      pre_auth_ttl_ms: 5 * 60_000,
      session_ttl_ms: 30 * 60_000,
      csrf_ttl_ms: 5 * 60_000,
      entitlement_ttl_ms: 15 * 60_000,
      rate_limit_window_ms: 60_000,
      rate_limit_attempts: 5,
    },
  });
  const developerAccessFacade = createDeveloperAccessSecurityFacadeV2({
    canonicalSecurityService,
  });
  const assertionPort = await createAuth0LiveSubscriberAssertionAdapterV1({
    configuration: authority.assertion_configuration,
    resolveSecretReference: secretResolver,
    fetchImpl,
    clock,
  });
  if (assertionPort.configured !== true) return makeDeniedComposition();

  const businessEngineAdapter =
    createCanonicalBusinessEngineLiveAttachmentAdapterV1({
      productBindingAttestation: productBinding,
      nowMs: clock(),
    });
  const subscriptionRuntimeAdapter =
    createExistingSubscriptionRuntimeLiveAttachmentAdapterV1({
      productBindingAttestation: productBinding,
      nowMs: clock(),
    });
  const coachConnectAdapter = productBinding.coach_connect_runtime
    ? createExistingCoachConnectLiveAttachmentAdapterV1({
      productBindingAttestation: productBinding,
      nowMs: clock(),
    })
    : null;
  const privateRuntimeBridge = createPrivateRuntimeLiveAttachmentCoordinatorV1({
    businessEngineAdapter,
    subscriptionRuntimeAdapter,
    coachConnectAdapter,
    clock: () => new Date(clock()).toISOString(),
  });
  let intelligenceExecution = null;
  let productClient = null;
  const productExecutionBinding = await readPrivateLiveProductExecutionBindingV1({
    env,
    resolveReference: secretResolver,
    environmentId: authority.authority_packet.environment_id,
    configurationAuthorityPacketSha256: authority.authority_packet.packet_sha256,
    productBindingAttestation: productBinding,
    nowMs: clock(),
  });
  if (productExecutionBinding.ok) {
    const productStoreUrl = await secretResolver(
      productExecutionBinding.binding.product_store_connection_ref,
      {
        purpose: 'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_CONNECTION',
        secret: true,
      },
    );
    if (typeof productStoreUrl !== 'string'
      || !productStoreUrl.startsWith('rediss://')) {
      return makeDeniedComposition('PRODUCT_STORE_CONNECTION_REQUIRED', 503);
    }
    try {
      productClient = createProductStoreClient(productStoreUrl);
      intelligenceExecution = createPrivateRuntimeIntelligenceExecutionV1({
        productStore: createPrivateLiveProductStoreV1({
          client: productClient,
          namespacePrefix:
            productExecutionBinding.binding.persistence_namespace_prefix,
          exactScope: productExecutionBinding.binding.exact_scope,
          clock: () => new Date(clock()).toISOString(),
        }),
        binding: productExecutionBinding.binding,
        productBindingAttestation: productBinding,
        clock: () => new Date(clock()).toISOString(),
      });
    } catch {
      return makeDeniedComposition('PRODUCT_STORE_CONNECTION_REQUIRED', 503);
    }
  } else if (env.MORE_PRIVATE_RUNTIME_PRODUCT_EXECUTION_BINDING_REF != null) {
    return makeDeniedComposition(productExecutionBinding.code, 503);
  }

  let resolvedOperatorContextBridge = operatorContextBridge;
  let resolvedOperatorContext = resolveOperatorContext;
  let resolvedOperatorBridgeInput = resolveOperatorBridgeInput;
  let resolvedOperatorActivationDecision = operatorActivationDecision;
  if (resolvedOperatorContextBridge == null
    && resolvedOperatorContext == null
    && resolvedOperatorBridgeInput == null
    && resolvedOperatorActivationDecision == null
    && productExecutionBinding.ok
    && productClient != null) {
    const deploymentStore = createUpstashSubdev1OperatorBridgeStore({
      configuration: remoteConfiguration,
      resolveSecretReference: secretResolver,
      fetchImpl,
    });
    const profileRepository = createSubdev1CanonicalExactProfileRepository({
      readCanonicalProfile: createExactVaultProfileReader({ client: productClient }),
      productBindingAttestation: productBinding,
      productExecutionBinding: productExecutionBinding.binding,
      statePort,
      environmentId: authority.authority_packet.environment_id,
    });
    const operatorBinding = createPrivateRuntimeOperatorBridgeLiveBindingV1({
      env,
      store: deploymentStore,
      profileRepository,
      authority,
      productBindingAttestation: productBinding,
      productExecutionBinding: productExecutionBinding.binding,
      clock,
    });
    resolvedOperatorContextBridge = operatorBinding.operatorContextBridge;
    resolvedOperatorContext = operatorBinding.resolveOperatorContext;
    resolvedOperatorBridgeInput = operatorBinding.resolveOperatorBridgeInput;
    resolvedOperatorActivationDecision =
      operatorBinding.operatorActivationDecision;
  }

  const sessionCodec = createSessionEnvelopeCodec(tokenHashKey, clock);

  async function active(req) {
    if (authority.authority_packet.emergency_disabled === true) {
      return denial('EMERGENCY_DISABLED', 503);
    }
    if (authority.authority_packet.live_enabled !== true
      || authority.activation_receipt == null) {
      return denial('RUNTIME_DEFAULT_OFF', 404);
    }
    const edge = await protectedEdgeBinding.bindRequest(req, {
      correlationRef: correlationReference(req),
    });
    if (!edge.allowed) return edge;
    const health = await canonicalSecurityService.health();
    if (!health.allowed) return denial(
      health.code || 'SHARED_SECURITY_STATE_UNAVAILABLE',
      503,
    );
    return frozen({
      ok: true,
      allowed: true,
      status: 200,
      edge_attestation: edge.edge_attestation,
    });
  }

  async function contextFor({ kind, req, input }) {
    const activation = await active(req);
    if (!activation.allowed) return activation;
    const correlationRef = correlationReference(req);
    if (kind === 'login') {
      const browserReference = input?.browser_binding_reference;
      if (typeof browserReference !== 'string'
        || browserReference.length < 16
        || browserReference.length > 512) {
        return denial('AUTHENTICATION_REQUIRED', 401);
      }
      const currentEnvelope = sessionCodec.open(
        cookieValue(req?.headers?.cookie, SESSION_COOKIE_NAME),
      );
      const rotation = currentEnvelope
        && currentEnvelope.browser_binding_reference === browserReference
        && typeof currentEnvelope.authenticated_session_ref === 'string'
        ? {
            rotation_parent_session_token_hash: hmac(
              tokenHashKey,
              'private_runtime_token',
              currentEnvelope.session_token,
            ),
            rotation_parent_reference: currentEnvelope.authenticated_session_ref,
          }
        : {};
      return {
        ok: true,
        allowed: false,
        value: {
          environment_id: authority.authority_packet.environment_id,
          browser_binding_hash: hmac(
            tokenHashKey,
            'browser_binding',
            browserReference,
          ),
          browser_binding_reference: browserReference,
          correlation_ref: correlationRef,
          edge_attestation: activation.edge_attestation,
          ...rotation,
        },
      };
    }
    if (kind === 'callback') {
      const preAuthToken = cookieValue(req?.headers?.cookie, SESSION_COOKIE_NAME);
      const browserReference = cookieValue(req?.headers?.cookie, BROWSER_COOKIE_NAME);
      const transactionCookie = cookieValue(req?.headers?.cookie, OIDC_COOKIE_NAME);
      const query = requestQuery(req);
      if (!preAuthToken || !browserReference || !transactionCookie) {
        return denial('OIDC_STATE_INVALID', 401);
      }
      const browserHash = hmac(tokenHashKey, 'browser_binding', browserReference);
      return {
        ok: true,
        allowed: false,
        value: {
          environment_id: authority.authority_packet.environment_id,
          pre_auth_token_hash: hmac(
            tokenHashKey,
            'private_runtime_token',
            preAuthToken,
          ),
          browser_binding_hash: browserHash,
          browser_binding_reference: browserReference,
          correlation_ref: correlationRef,
          edge_attestation: activation.edge_attestation,
          assertion_input: {
            code: query.code,
            state: query.state,
            transaction_cookie_value: transactionCookie,
            pre_auth_session_ref: query.login_reference,
            browser_binding_hash: browserHash,
            edge_attestation: activation.edge_attestation,
          },
        },
      };
    }

    const envelope = sessionCodec.open(
      cookieValue(req?.headers?.cookie, SESSION_COOKIE_NAME),
    );
    if (!envelope) return denial('AUTHENTICATION_REQUIRED', 401);
    const entitlementToken = cookieValue(req?.headers?.cookie, ENTITLEMENT_COOKIE_NAME);
    return {
      ok: true,
      allowed: false,
      value: {
        environment_id: authority.authority_packet.environment_id,
        external_subject_ref: envelope.external_subject_ref,
        session_token_hash: hmac(
          tokenHashKey,
          'private_runtime_token',
          envelope.session_token,
        ),
        exact_scope_hash: envelope.exact_scope_hash,
        browser_binding_hash: hmac(
          tokenHashKey,
          'browser_binding',
          envelope.browser_binding_reference,
        ),
        correlation_ref: correlationRef,
        route: req?.url?.split('?')[0] || `/api/internal/${kind}`,
        method: req?.method || 'GET',
        idempotency_ref: req?.headers?.['x-idempotency-key']
          || `request_${correlationRef}`,
        csrf_proof: req?.headers?.['x-coach-connect-csrf'] || null,
        entitlement_token_hash: entitlementToken
          ? hmac(tokenHashKey, 'private_runtime_token', entitlementToken)
          : null,
        edge_attestation: activation.edge_attestation,
      },
    };
  }

  async function serializeAuthenticatedSession({ result, context }) {
    if (result?.allowed !== true
      || typeof result.session_cookie_value !== 'string'
      || typeof result.canonical_subject?.external_subject_ref !== 'string'
      || !sha256(result.canonical_subject?.exact_scope_hash)) {
      return denial('SESSION_ELEVATION_REQUIRED', 401);
    }
    return {
      ok: true,
      allowed: true,
      value: sessionCodec.seal({
        envelope_version: 'private-runtime-session-envelope-v2',
        session_token: result.session_cookie_value,
        authenticated_session_ref: result.authenticated_session_ref,
        external_subject_ref: result.canonical_subject.external_subject_ref,
        exact_scope_hash: result.canonical_subject.exact_scope_hash,
        browser_binding_reference: context.browser_binding_reference,
        expires_at: result.expires_at,
      }),
    };
  }

  async function bridgeInput({ request_context: requestContext, authority: authorityDecision }) {
    const [authenticated, entitlement] = await Promise.all([
      canonicalSecurityService.resolveAuthenticatedContext(requestContext),
      canonicalSecurityService.inspectTemporaryEntitlement(requestContext),
    ]);
    if (!authenticated.allowed || !entitlement.allowed) {
      return denial(authenticated.code || entitlement.code || 'RUNTIME_AUTHORITY_DENIED', 403);
    }
    const normalizedEntitlement = {
      ...entitlement.entitlement,
      status: String(entitlement.entitlement.status).toLowerCase(),
    };
    const request = {
      request_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.attachmentRequest,
      environment_id: authority.authority_packet.environment_id,
      subscriber_subject_ref: authorityDecision.subscriber_subject_ref,
      authenticated_session_ref: authorityDecision.authenticated_session_ref,
      capability_ref: authorityDecision.entitlement_ref,
      exact_scope: productBinding.exact_scope,
      requested_attachments: [
        'BUSINESS_ENGINE',
        'SUBSCRIPTION_RUNTIME',
        ...(productBinding.coach_connect_runtime ? ['COACH_CONNECT'] : []),
      ],
      correlation_id: requestContext.correlation_ref,
      requested_at: authorityDecision.evaluated_at,
    };
    return {
      ok: true,
      allowed: false,
      value: {
        request,
        edgeAttestation: requestContext.edge_attestation,
        authority: authorityDecision,
        subjectReceipt: {
          subject_receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.subjectReceipt,
          subscriber_subject_ref: authorityDecision.subscriber_subject_ref,
          exact_scope_hash: authorityDecision.exact_scope_hash,
        },
        sessionReceipt: {
          session_receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.sessionReceipt,
          subscriber_subject_ref: authorityDecision.subscriber_subject_ref,
          authenticated_session_ref: authorityDecision.authenticated_session_ref,
        },
        capability: {
          envelope_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.capability,
          capability_id: authorityDecision.entitlement_ref,
          environment_id: authorityDecision.environment_id,
          subscriber_subject_ref: authorityDecision.subscriber_subject_ref,
          authenticated_session_ref: authorityDecision.authenticated_session_ref,
          subject_security_version:
            authenticated.authenticated_context.subject_security_version,
          session_epoch: authenticated.authenticated_context.session_epoch,
          browser_binding_hash: authenticated.authenticated_context.browser_binding_hash,
          exact_scope_hash: authorityDecision.exact_scope_hash,
          entitlement_source: 'temporary_internal_subscription_entitlement',
          allowed_runtime_actions: [...PRIVATE_RUNTIME_APPROVED_CAPABILITIES],
          issued_at: normalizedEntitlement.issued_at,
          expires_at: authorityDecision.expires_at,
          status: 'ACTIVE',
          stripe_authority: false,
          billing_authority: false,
          operator_authority: false,
          deployment_authority: false,
          coach_authority: false,
          canonical_mutation_authority: false,
        },
        entitlement: normalizedEntitlement,
      },
    };
  }

  const composition = createLiveComposition({
    canonicalSecurityService,
    developerAccessFacade,
    assertionPort,
    privateRuntimeBridge,
    intelligenceExecution,
    resolveRequestContext: contextFor,
    resolveBridgeInput: bridgeInput,
    operatorContextBridge: resolvedOperatorContextBridge,
    resolveOperatorContext: resolvedOperatorContext,
    resolveOperatorBridgeInput: resolvedOperatorBridgeInput,
    serializeAuthenticatedSession,
    activationDecision: active,
    operatorActivationDecision:
      resolvedOperatorActivationDecision || (async () => false),
    providerAdapterBound: true,
  });
  return Object.freeze({
    ...composition,
    composition_root_version: PRIVATE_RUNTIME_LIVE_COMPOSITION_ROOT_VERSION,
    live_authority_fingerprint: authority.live_authority.authority_fingerprint,
    provider_adapter: true,
    source_default_off: true,
    public_access: false,
  });
}

export function createDeferredPrivateRuntimeLiveCompositionV2({
  build,
} = {}) {
  let pending = null;
  const resolve = async () => {
    if (!pending) {
      pending = Promise.resolve().then(build).catch(() => makeDeniedComposition());
    }
    return pending;
  };
  const operations = Object.freeze(Object.fromEntries([
    'beginLogin',
    'completeLogin',
    'inspectSession',
    'developerAccess',
    'resolveSubscriptionEntitlement',
    'bootstrap',
    'logout',
  ].map((name) => [name, async (...args) => {
    const composition = await resolve();
    return composition.operations[name](...args);
  }])));
  return Object.freeze({
    composition_version: 'private-runtime-live-composition-v2',
    composition_root_version: PRIVATE_RUNTIME_LIVE_COMPOSITION_ROOT_VERSION,
    configured: false,
    deferred_configuration: true,
    source_default_off: true,
    provider_adapter: false,
    provider_connection: false,
    v1_fallback: false,
    mixed_sync_async: false,
    enabled: async (req) => (await resolve()).enabled(req),
    describe: async () => (await resolve()).describe(),
    operations,
  });
}
