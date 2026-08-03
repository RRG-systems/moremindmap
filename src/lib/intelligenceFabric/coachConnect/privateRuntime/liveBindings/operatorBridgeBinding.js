import crypto from 'node:crypto';
import Redis from 'ioredis';
import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  createUpstashRedisRemoteSharedSecurityAdapter,
  UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
} from '../../productionSecurity/remoteSharedSecurity/upstashRedisAdapter.js';
import {
  createQualificationDigestFunction,
} from '../../productionSecurity/remoteSharedSecurity/keyspace.js';
import {
  createExactVaultProfileReader,
  createExactBusinessAssessmentReader,
  createSubdev1CanonicalExactProfileRepository,
  createSubdev1OperatorBridge,
  createUpstashSubdev1OperatorBridgeStore,
  readSubdev1OperatorCookies,
} from '../operatorBridge/index.js';
import {
  PRIVATE_RUNTIME_CONTRACT_VERSIONS,
  hashPrivateRuntimeScope,
  samePrivateRuntimeScope,
} from '../contracts.js';
import {
  privateRuntimeProductStoreConnectionAllowedV1,
  readPrivateRuntimeLiveConfigurationAuthorityV1,
} from './configurationAuthority.js';
import {
  readPrivateLiveProductExecutionBindingV1,
} from './productExecutionBinding.js';
import {
  projectPrivateRuntimeCohortMemberBindingsV1,
} from './profileCohort.js';

export const PRIVATE_RUNTIME_OPERATOR_BRIDGE_BINDING_VERSION =
  'private-runtime-operator-bridge-live-binding-v1';

export const SUBDEV1_ATTACHMENT_DIAGNOSTIC_RECEIPT_VERSION =
  'private-beta-operator-attachment-diagnostic-receipt-v1';

export const SUBDEV1_POST_PROFILE_ATTACHMENT_DENIAL_CODES = Object.freeze([
  'PRIVATE_RUNTIME_DISABLED',
  'SESSION_ELEVATION_REQUIRED',
  'BUSINESS_ENGINE_ATTACHMENT_NOT_FOUND',
  'BUSINESS_ENGINE_ATTACHMENT_AMBIGUOUS',
  'BUSINESS_ENGINE_ATTACHMENT_MISMATCH',
  'SUBSCRIPTION_RUNTIME_UNAVAILABLE',
  'SUBSCRIPTION_RUNTIME_ATTACHMENT_MISMATCH',
  'COACH_CONNECT_STATE_MISSING',
  'COACH_CONNECT_ATTACHMENT_MISMATCH',
  'OPERATOR_ACTION_DENIED',
  'PRIVATE_ENTITLEMENT_REQUIRED',
  'ATTACHMENT_PARTIAL_FAILURE',
  'ACTION_NOT_ALLOWLISTED',
  'SENSITIVE_EVIDENCE_REJECTED',
  'ASYNC_SECURITY_CONTRACT_VIOLATION',
  'ASYNC_SECURITY_RESULT_INVALID',
  'ASYNC_SECURITY_REJECTED',
]);

const frozen = (value) => deepFreeze(structuredClone(value));
const denial = (code = 'OPERATOR_BRIDGE_CONFIGURATION_INVALID', status = 503) => frozen({
  ok: false,
  allowed: false,
  code,
  status,
});
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const gitSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const boundedReference = (value) => typeof value === 'string'
  && value.length >= 3
  && value.length <= 160
  && /^[a-zA-Z0-9:_-]+$/.test(value);

function diagnosticProfileCategory(operatorContext) {
  const source = String(operatorContext?.provenance?.source || '').toUpperCase();
  return source.includes('SYNTHETIC') ? 'SYNTHETIC' : 'APPROVED_PROFILE';
}

function attachmentDiagnosticAuthorityValid({
  operatorContext,
  bridgeInput,
  authority,
  predicateCode,
}) {
  const request = bridgeInput?.request;
  const decision = bridgeInput?.authority;
  const activation = authority?.activation_receipt;
  return SUBDEV1_POST_PROFILE_ATTACHMENT_DENIAL_CODES.includes(predicateCode)
    && operatorContext?.source === 'temporary_internal_beta_operator_context'
    && operatorContext.allowed === true
    && operatorContext.capability_scope === 'SUBSCRIPTION_PRIVATE_BETA'
    && operatorContext.action !== 'SELECT_PROFILE'
    && operatorContext.profile_state === 'PROFILE_ACTIVE'
    && Number.isInteger(operatorContext.profile_generation)
    && operatorContext.profile_generation >= 1
    && sha256(operatorContext.exact_scope_hash)
    && operatorContext.exact_scope_hash === hashPrivateRuntimeScope(operatorContext.exact_scope)
    && operatorContext.paid_entitlement === false
    && operatorContext.stripe_authority === false
    && operatorContext.billing_authority === false
    && operatorContext.coach_authority === false
    && operatorContext.canonical_identity_authority === false
    && operatorContext.canonical_mutation_authority === false
    && operatorContext.deployment_authority === false
    && operatorContext.environment_authority === false
    && operatorContext.provider_authority === false
    && bridgeInput?.edgeAttestation?.operator_context_verified === true
    && bridgeInput.edgeAttestation.named_identity_verified === false
    && bridgeInput.edgeAttestation.mfa_verified === false
    && bridgeInput.edgeAttestation.public_access === false
    && decision?.allowed === true
    && decision.operator_context_verified === true
    && decision.deployment_grade_security_state === true
    && decision.no_local_fallback === true
    && decision.shared_state_evidence_class === 'FUTURE_PRIVATE_LIVE'
    && boundedReference(decision.authority_fingerprint)
    && request?.subscriber_subject_ref === operatorContext.subscriber_subject_ref
    && samePrivateRuntimeScope(request?.exact_scope, operatorContext.exact_scope)
    && bridgeInput?.subjectReceipt?.exact_scope_hash === operatorContext.exact_scope_hash
    && bridgeInput?.capability?.exact_scope_hash === operatorContext.exact_scope_hash
    && bridgeInput?.capability?.coach_authority === false
    && bridgeInput?.capability?.stripe_authority === false
    && bridgeInput?.capability?.deployment_authority === false
    && sha256(bridgeInput?.cohort_binding_receipt?.cohort_digest)
    && sha256(bridgeInput?.cohort_binding_receipt?.member_digest)
    && bridgeInput.cohort_binding_receipt.exact_scope_hash
      === operatorContext.exact_scope_hash
    && bridgeInput.cohort_binding_receipt.process_local_profile_cache === false
    && boundedReference(request?.correlation_id)
    && gitSha(activation?.deployment_commit_sha)
    && gitSha(activation?.deployment_tree_sha)
    && activation?.approved === true
    && activation?.controlled_internal_beta === true
    && activation?.private_live_only === true
    && activation?.public_access === false;
}

function requestReference(req, header, prefix) {
  const value = req?.headers?.[header];
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= 160
    && /^[a-zA-Z0-9:_-]+$/.test(value)
    ? value
    : `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function operatorRequestContext({ req, body }) {
  const cookies = readSubdev1OperatorCookies(req?.headers?.cookie);
  const anyOperatorCookie = cookies.browser_valid || cookies.context_valid;
  return frozen({
    ok: true,
    allowed: false,
    value: {
      operator_present: anyOperatorCookie,
      context_token: cookies.context_valid ? cookies.context : '',
      browser_token: cookies.browser_valid ? cookies.browser : '',
      correlation_ref: requestReference(req, 'x-correlation-id', 'correlation'),
      idempotency_ref: requestReference(req, 'x-idempotency-key', 'idempotency'),
      requested_operation: body?.intelligence_operation || null,
    },
  });
}

export function createPrivateRuntimeOperatorBridgeLiveBindingV1({
  env = globalThis.process?.env || {},
  store,
  profileRepository,
  authority,
  productBindingAttestation,
  productExecutionBinding,
  resolveMemberBindings = null,
  clock = () => Date.now(),
  randomToken,
  diagnosticSink = (receipt) => {
    globalThis.console?.info?.(
      'PRIVATE_BETA_OPERATOR_ATTACHMENT_DIAGNOSTIC_RECEIPT',
      JSON.stringify(receipt),
    );
  },
} = {}) {
  const bridge = createSubdev1OperatorBridge({
    env,
    store,
    profileRepository,
    clock,
    randomToken,
  });

  async function operatorActivationDecision() {
    if (env.MORE_PRIVATE_RUNTIME_LIVE_ENABLED !== 'true'
      || env.MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED !== 'false'
      || authority?.authority_packet?.live_enabled !== true
      || authority?.authority_packet?.emergency_disabled === true
      || authority?.activation_receipt == null) {
      return denial('RUNTIME_DEFAULT_OFF', 404);
    }
    const configured = await bridge.configured();
    return configured.ok
      ? frozen({ ok: true, allowed: true })
      : denial(configured.code, configured.status);
  }

  async function resolveOperatorBridgeInput({
    req,
    request_context: requestContext,
    operator_context: operatorContext,
  }) {
    if (req?.body?.request_coach === true) {
      return denial('COACH_CONNECT_STATE_MISSING', 403);
    }
    const exactScope = operatorContext?.exact_scope;
    const memberResolution = typeof resolveMemberBindings === 'function'
      ? await resolveMemberBindings(exactScope?.profile_id)
      : null;
    const selectedProductBinding = memberResolution?.valid
      ? memberResolution.value.product_binding_attestation
      : productBindingAttestation;
    const selectedExecutionBinding = memberResolution?.valid
      ? memberResolution.value.product_execution_binding
      : productExecutionBinding;
    if (!operatorContext?.allowed
      || (typeof resolveMemberBindings === 'function' && !memberResolution?.valid)
      || operatorContext.capability_scope !== 'SUBSCRIPTION_PRIVATE_BETA'
      || operatorContext.coach_authority !== false
      || operatorContext.stripe_authority !== false
      || operatorContext.canonical_identity_authority !== false
      || operatorContext.canonical_mutation_authority !== false
      || !samePrivateRuntimeScope(exactScope, selectedProductBinding?.exact_scope)
      || !samePrivateRuntimeScope(exactScope, selectedExecutionBinding?.exact_scope)
      || operatorContext.subscriber_subject_ref
        !== selectedProductBinding?.subscriber_subject_ref
      || operatorContext.exact_scope_hash !== hashPrivateRuntimeScope(exactScope)
      || operatorContext.exact_scope_hash !== selectedProductBinding?.exact_scope_hash
      || !selectedExecutionBinding?.approved_profile_ids?.includes(exactScope?.profile_id)) {
      return denial('EXACT_SCOPE_MISMATCH', 403);
    }
    const now = new Date(clock()).toISOString();
    const sessionRef = operatorContext.context_id;
    const authorityDecision = {
      ok: true,
      allowed: true,
      source: operatorContext.source,
      operator_context_verified: true,
      environment_id: authority.authority_packet.environment_id,
      subscriber_subject_ref: operatorContext.subscriber_subject_ref,
      authenticated_session_ref: sessionRef,
      entitlement_ref: operatorContext.context_id,
      exact_scope_hash: operatorContext.exact_scope_hash,
      security_epoch: operatorContext.profile_generation,
      requested_runtime: 'SUBSCRIPTION_RUNTIME',
      requested_action: operatorContext.action,
      evaluated_at: now,
      expires_at: operatorContext.expires_at,
      deployment_grade_security_state: true,
      no_local_fallback: true,
      shared_state_evidence_class: 'FUTURE_PRIVATE_LIVE',
      admin_authority: false,
      deployment_authority: false,
      billing_authority: false,
      coach_authority: false,
      canonical_mutation_authority: false,
      canonical_identity_authority: false,
      authority_fingerprint: hashCanonicalJson({
        context_id: operatorContext.context_id,
        exact_scope_hash: operatorContext.exact_scope_hash,
        profile_generation: operatorContext.profile_generation,
        expires_at: operatorContext.expires_at,
      }),
    };
    const browserBindingHash = hashCanonicalJson({
      domain: 'subdev1_operator_runtime_browser_binding_v1',
      browser_token: requestContext.browser_token,
    });
    return frozen({
      ok: true,
      allowed: false,
      value: {
        request: {
          request_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.attachmentRequest,
          environment_id: authority.authority_packet.environment_id,
          subscriber_subject_ref: operatorContext.subscriber_subject_ref,
          authenticated_session_ref: sessionRef,
          capability_ref: operatorContext.context_id,
          exact_scope: exactScope,
          requested_attachments: [
            'BUSINESS_ENGINE',
            'SUBSCRIPTION_RUNTIME',
          ],
          correlation_id: requestContext.correlation_ref,
          requested_at: now,
        },
        edgeAttestation: {
          operator_context_verified: true,
          named_identity_verified: false,
          mfa_verified: false,
          public_access: false,
        },
        authority: authorityDecision,
        operatorContext,
        subjectReceipt: {
          subject_receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.subjectReceipt,
          subscriber_subject_ref: operatorContext.subscriber_subject_ref,
          exact_scope_hash: operatorContext.exact_scope_hash,
        },
        sessionReceipt: {
          session_receipt_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.sessionReceipt,
          subscriber_subject_ref: operatorContext.subscriber_subject_ref,
          authenticated_session_ref: sessionRef,
        },
        capability: {
          envelope_version: PRIVATE_RUNTIME_CONTRACT_VERSIONS.capability,
          capability_id: operatorContext.context_id,
          environment_id: authority.authority_packet.environment_id,
          subscriber_subject_ref: operatorContext.subscriber_subject_ref,
          authenticated_session_ref: sessionRef,
          subject_security_version: operatorContext.profile_generation,
          session_epoch: operatorContext.profile_generation,
          browser_binding_hash: browserBindingHash,
          exact_scope_hash: operatorContext.exact_scope_hash,
          entitlement_source: operatorContext.source,
          allowed_runtime_actions: [
            'BUSINESS_ENGINE_READ',
            'SUBSCRIPTION_INTERACTION',
          ],
          issued_at: now,
          expires_at: operatorContext.expires_at,
          status: 'ACTIVE',
          stripe_authority: false,
          billing_authority: false,
          operator_authority: true,
          deployment_authority: false,
          coach_authority: false,
          canonical_mutation_authority: false,
        },
        entitlement: {
          access_type: 'more_monthly_intelligence',
          status: 'active',
          source: operatorContext.source,
          temporary: true,
          billing_evidence: false,
          stripe_subscription_created: false,
          canonical_mutation_authority: false,
          paid_entitlement: false,
          issued_at: now,
          expires_at: operatorContext.expires_at,
        },
        requestContext: {
          ...requestContext,
          exact_scope_hash: operatorContext.exact_scope_hash,
        },
        cohort_binding_receipt: memberResolution?.valid
          ? {
              cohort_digest: memberResolution.value.cohort_digest,
              member_digest: memberResolution.value.member.member_sha256,
              exact_scope_hash: operatorContext.exact_scope_hash,
              process_local_profile_cache: false,
            }
          : null,
      },
    });
  }

  async function recordOperatorAttachmentDiagnostic({
    operator_context: operatorContext,
    bridge_input: bridgeInput,
    predicate_code: predicateCode,
    stage = 'ATTACHMENT_COORDINATOR',
  } = {}) {
    if (stage !== 'ATTACHMENT_COORDINATOR'
      || !attachmentDiagnosticAuthorityValid({
        operatorContext,
        bridgeInput,
        authority,
        predicateCode,
      })) {
      return denial('ATTACHMENT_DIAGNOSTIC_NOT_AUTHORIZED', 403);
    }
    const occurredAt = new Date(clock()).toISOString();
    const receipt = frozen({
      receipt_version: SUBDEV1_ATTACHMENT_DIAGNOSTIC_RECEIPT_VERSION,
      predicate_code: predicateCode,
      occurred_at: occurredAt,
      deployment_version_identifier: authority.activation_receipt.deployment_commit_sha,
      profile_category: diagnosticProfileCategory(operatorContext),
      correlation_id: bridgeInput.request.correlation_id,
      stage,
      outcome: 'DENIED',
    });
    const receiptRef = `subdev1_attachment_diagnostic_${hashCanonicalJson(receipt).slice(0, 32)}`;
    let emitted = false;
    if (typeof diagnosticSink === 'function') {
      try {
        await diagnosticSink(receipt);
        emitted = true;
      } catch {
        emitted = false;
      }
    }
    let stored;
    try {
      stored = await store?.appendAudit?.({
        event_type: 'PRIVATE_BETA_OPERATOR_ATTACHMENT_DIAGNOSTIC_RECORDED',
        decision: 'DENIED',
        failure_code: predicateCode,
        occurred_at: occurredAt,
        context_ref: receiptRef,
        exact_scope_hash: operatorContext.exact_scope_hash,
      });
    } catch {
      stored = null;
    }
    if (!emitted && stored?.ok !== true) return denial('OPERATOR_STORE_UNAVAILABLE', 503);
    return frozen({
      ok: true,
      allowed: false,
      recorded: true,
      receipt_ref: receiptRef,
      protected_log_emitted: emitted,
      protected_audit_persisted: stored?.ok === true,
    });
  }

  return Object.freeze({
    binding_version: PRIVATE_RUNTIME_OPERATOR_BRIDGE_BINDING_VERSION,
    ok: true,
    allowed: false,
    source_default_off: true,
    operatorContextBridge: bridge,
    operatorStore: store,
    profileRepository,
    resolveOperatorContext: async ({ req, body }) => {
      const result = operatorRequestContext({ req, body });
      return frozen({
        ...result,
        value: {
          ...result.value,
          browser_token: result.value.browser_token,
        },
      });
    },
    resolveOperatorBridgeInput,
    recordOperatorAttachmentDiagnostic,
    operatorActivationDecision,
  });
}

export async function buildPrivateRuntimeOperatorBridgeDeploymentBindingV1({
  env = globalThis.process?.env || {},
  resolveReference,
  fetchImpl = globalThis.fetch,
  clock = () => Date.now(),
  createProductStoreClient = (url) => new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    ...(url.startsWith('rediss://') ? { tls: {} } : {}),
  }),
  commandExecutor = null,
  randomToken,
} = {}) {
  const adapterSourceSha256 = env.MORE_PRIVATE_RUNTIME_QUALIFIED_ADAPTER_SOURCE_SHA256;
  if (!sha256(adapterSourceSha256)) return denial();
  const authority = await readPrivateRuntimeLiveConfigurationAuthorityV1({
    env,
    resolveReference,
    adapterImplementationId: UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION,
    adapterSourceSha256,
    nowMs: clock(),
  });
  if (!authority.ok
    || authority.authority_packet.live_enabled !== true
    || authority.authority_packet.emergency_disabled === true
    || authority.activation_receipt == null) {
    return denial(authority.code || 'RUNTIME_DEFAULT_OFF', authority.status || 404);
  }
  const secretResolver = authority.resolve_secret_reference;
  const scopeHashKey = await secretResolver(
    authority.remote_configuration.scope_hash_key_ref,
    { purpose: 'PRIVATE_RUNTIME_SCOPE_HASH_KEY', secret: true },
  );
  if (typeof scopeHashKey !== 'string' || scopeHashKey.length < 16) return denial();
  const statePort = createUpstashRedisRemoteSharedSecurityAdapter({
    configuration: authority.remote_configuration,
    operating_mode: 'PRIVATE_LIVE',
    qualification_certificate: authority.qualification_certificate,
    live_environment_attestation: authority.live_environment_attestation,
    expected_adapter_source_sha256: adapterSourceSha256,
    expected_qualification_review_package_sha256:
      '28b42df527bea92dce9a0ccfab9b72a933f8975529e3f02a64853b289f0c47ac',
    expected_attestation_repair_review_package_sha256:
      '4545be94544cdaf29940a45968ef2ac52b6865ed901aac87b84c265bf69f1b45',
    resolve_secret_reference: secretResolver,
    keyed_digest: createQualificationDigestFunction(scopeHashKey),
    fetch_impl: fetchImpl,
    clock,
  });
  const productBindingAttestation = authority.product_binding_attestation;
  const productExecution = await readPrivateLiveProductExecutionBindingV1({
    env,
    resolveReference: secretResolver,
    environmentId: authority.authority_packet.environment_id,
    configurationAuthorityPacketSha256: authority.authority_packet.packet_sha256,
    productBindingAttestation,
    nowMs: clock(),
  });
  if (!productExecution.ok) return denial(productExecution.code);
  const productStoreUrl = await secretResolver(
    productExecution.binding.product_store_connection_ref,
    { purpose: 'MORE_PRIVATE_RUNTIME_PRODUCT_STORE_CONNECTION', secret: true },
  );
  if (!privateRuntimeProductStoreConnectionAllowedV1({
    reference: productExecution.binding.product_store_connection_ref,
    value: productStoreUrl,
    env,
  })) {
    return denial('PRODUCT_STORE_CONNECTION_REQUIRED');
  }
  let productClient;
  try {
    productClient = createProductStoreClient(productStoreUrl);
  } catch {
    return denial('PRODUCT_STORE_CONNECTION_REQUIRED');
  }
  const store = createUpstashSubdev1OperatorBridgeStore({
    configuration: authority.remote_configuration,
    resolveSecretReference: secretResolver,
    fetchImpl,
    commandExecutor,
  });
  const resolveCohortMemberBindings = authority.approved_profile_cohort == null
    ? null
    : async (profileId) => projectPrivateRuntimeCohortMemberBindingsV1({
        cohort: authority.approved_profile_cohort,
        profileId,
        rootProductBindingAttestation: productBindingAttestation,
        rootProductExecutionBinding: productExecution.binding,
        configurationAuthorityPacketSha256: authority.authority_packet.packet_sha256,
        nowMs: clock(),
      });
  const profileRepository = createSubdev1CanonicalExactProfileRepository({
    readCanonicalProfile: createExactVaultProfileReader({ client: productClient }),
    readBusinessAssessment: createExactBusinessAssessmentReader({ client: productClient }),
    productBindingAttestation,
    productExecutionBinding: productExecution.binding,
    approvedProfileCohort: authority.approved_profile_cohort,
    statePort,
    environmentId: authority.authority_packet.environment_id,
    clock,
  });
  return createPrivateRuntimeOperatorBridgeLiveBindingV1({
    env,
    store,
    profileRepository,
    authority,
    productBindingAttestation,
    productExecutionBinding: productExecution.binding,
    resolveMemberBindings: resolveCohortMemberBindings,
    clock,
    randomToken,
  });
}
