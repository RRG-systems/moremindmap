import crypto from 'node:crypto';
import { hashCanonicalJson } from '../../hashing.js';
import { deepFreeze } from '../../validation.js';
import {
  ASYNC_SECURITY_COMMAND_VERSION,
  ASYNC_SECURITY_QUERY_VERSION,
  validateAsyncSecurityCapability,
  validateAsyncSecurityCommandResult,
  validateAsyncSecurityHealth,
  validateAsyncSecurityQueryResult,
  validateAsyncSecurityTime,
} from '../productionSecurity/asyncSecurityContracts.js';
import {
  invokeAsyncSecurityMethod,
  isThenable,
} from '../productionSecurity/asyncSharedSecurityStatePort.js';
import {
  AUTHENTICATED_PRIVATE_CONTEXT_VERSION,
  createPrivateTestEligibilityDecision,
  evaluatePrivateTestEligibilityActivation,
  normalizePrivateTestEligibilityConfiguration,
  validatePrivateTestApprovalV1,
} from './eligibility.js';

export const CANONICAL_ASYNC_SECURITY_SERVICE_VERSION = 'private-runtime-canonical-security-service-v2';
export const CANONICAL_SUBJECT_DECISION_VERSION = 'canonical-subject-decision-v2';

const frozen = (value) => deepFreeze(structuredClone(value));
const text = (value, max = 256) => typeof value === 'string'
  && value.trim().length > 0
  && value.length <= max
  && !value.includes('@')
  && !/\s/.test(value);
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const activeAt = (record, now) => record?.status === 'ACTIVE'
  && timestamp(record.expires_at)
  && Date.parse(record.expires_at) > now;
const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');
const randomOpaque = (prefix) => `${prefix}_${crypto.randomBytes(24).toString('base64url')}`;

const denial = (code, details = {}) => frozen({
  ok: false,
  allowed: false,
  code,
  ...details,
});

function queryEnvelope(environmentId, correlationRef, queryType, fields = {}) {
  return {
    query_version: ASYNC_SECURITY_QUERY_VERSION,
    query_type: queryType,
    environment_id: environmentId,
    correlation_ref: correlationRef,
    subject_ref: fields.subject_ref ?? null,
    session_token_hash: fields.session_token_hash ?? null,
    entitlement_token_hash: fields.entitlement_token_hash ?? null,
    exact_scope_hash: fields.exact_scope_hash ?? null,
    requested_runtime: fields.requested_runtime ?? null,
    requested_action: fields.requested_action ?? null,
    required_consistency: 'PRIMARY_OR_LINEARIZABLE',
  };
}

function commandEnvelope(environmentId, correlationRef, commandType, {
  idempotencyKeyHash,
  expectedVersions = {},
  arguments: commandArguments = {},
}) {
  return {
    command_version: ASYNC_SECURITY_COMMAND_VERSION,
    command_type: commandType,
    environment_id: environmentId,
    idempotency_key_hash: idempotencyKeyHash,
    fingerprint: hashCanonicalJson({
      command_type: commandType,
      environment_id: environmentId,
      expected_versions: expectedVersions,
      arguments: commandArguments,
    }),
    correlation_ref: correlationRef,
    expected_versions: expectedVersions,
    arguments: commandArguments,
  };
}

async function callStatePort(statePort, method, args, validator = null) {
  try {
    const value = await invokeAsyncSecurityMethod(statePort, method, args);
    if (validator) {
      const checked = validator(value);
      if (!checked.valid) return denial('ASYNC_SECURITY_RESULT_INVALID');
    }
    return frozen({ ok: true, value });
  } catch {
    return denial('ASYNC_SECURITY_REJECTED');
  }
}

function validateRequestContext(requestContext, environmentId) {
  if (!requestContext || typeof requestContext !== 'object' || Array.isArray(requestContext)) {
    return denial('AUTHENTICATION_REQUIRED');
  }
  if (requestContext.edge_attestation?.named_identity_verified !== true
    || requestContext.edge_attestation?.mfa_verified !== true
    || requestContext.edge_attestation?.public_access !== false
    || requestContext.environment_id !== environmentId
    || !text(requestContext.external_subject_ref)
    || !sha256(requestContext.session_token_hash)
    || !sha256(requestContext.exact_scope_hash)
    || !sha256(requestContext.browser_binding_hash)
    || !text(requestContext.correlation_ref)) {
    return denial('AUTHENTICATION_REQUIRED');
  }
  return frozen({ ok: true, allowed: true, request_context: requestContext });
}

function validateMapping(record, requestContext) {
  if (!record
    || record.record_version !== 'canonical-subject-mapping-v1'
    || record.status !== 'ACTIVE'
    || record.auto_enrolled !== false
    || record.external_subject_ref !== requestContext.external_subject_ref
    || record.exact_scope_hash !== requestContext.exact_scope_hash
    || !text(record.subscriber_subject_ref)
    || !Number.isInteger(record.security_version)
    || record.security_version < 1) {
    return denial('SUBJECT_MAPPING_NOT_FOUND');
  }
  return frozen({ ok: true, allowed: true, mapping: record });
}

function validateSession(record, requestContext, mapping, now) {
  const authenticatedSessionRef = record?.authenticated_session_ref || record?.session_ref;
  if (!record
    || record.record_version !== 'authenticated-private-session-v2'
    || (record.session_class != null && record.session_class !== 'AUTHENTICATED')
    || !text(authenticatedSessionRef)
    || !activeAt(record, now)
    || record.environment_id !== requestContext.environment_id
    || record.session_token_hash !== requestContext.session_token_hash
    || record.subscriber_subject_ref !== mapping.subscriber_subject_ref
    || record.exact_scope_hash !== mapping.exact_scope_hash
    || record.browser_binding_hash !== requestContext.browser_binding_hash
    || record.subject_security_version !== mapping.security_version
    || !Number.isInteger(record.session_epoch)
    || record.session_epoch < 1
    || !Number.isInteger(record.security_epoch)
    || record.security_epoch < 1) {
    const code = record?.status === 'REVOKED'
      ? 'SESSION_REVOKED'
      : record?.status === 'ROTATED'
        ? 'SESSION_ROTATED'
        : record?.status === 'EXPIRED'
          ? 'SESSION_EXPIRED'
          : 'SESSION_ELEVATION_REQUIRED';
    return denial(code);
  }
  return frozen({
    ok: true,
    allowed: true,
    authenticated_session_ref: authenticatedSessionRef,
    session: record,
  });
}

function validateInverseScope(record, mapping) {
  if (!record
    || record.subscriber_subject_ref !== mapping.subscriber_subject_ref
    || record.external_subject_ref !== mapping.external_subject_ref
    || record.exact_scope_hash !== mapping.exact_scope_hash
    || record.status !== 'ACTIVE') {
    return denial('SUBJECT_MAPPING_AMBIGUOUS');
  }
  return frozen({ ok: true, allowed: true });
}

export function createCanonicalAsyncSecurityServiceV2({
  statePort,
  environmentId,
  configuration = {},
  expectedPrivateAccessCode = null,
  tokenFactory = async (kind) => randomOpaque(kind),
  tokenHasher = async (value) => sha256Text(value),
} = {}) {
  if (!statePort || !text(environmentId)) {
    throw new TypeError('canonical async security service requires statePort and environmentId');
  }
  const eligibilityConfiguration = normalizePrivateTestEligibilityConfiguration(configuration);
  const csrfTtlMs = Number.isInteger(configuration.csrf_ttl_ms)
    ? Math.max(1_000, Math.min(configuration.csrf_ttl_ms, 15 * 60_000))
    : 5 * 60_000;
  const entitlementTtlMs = Number.isInteger(configuration.entitlement_ttl_ms)
    ? Math.max(1_000, Math.min(configuration.entitlement_ttl_ms, 60 * 60_000))
    : 15 * 60_000;
  const preAuthTtlMs = Number.isInteger(configuration.pre_auth_ttl_ms)
    ? Math.max(1_000, Math.min(configuration.pre_auth_ttl_ms, 10 * 60_000))
    : 5 * 60_000;
  const sessionTtlMs = Number.isInteger(configuration.session_ttl_ms)
    ? Math.max(1_000, Math.min(configuration.session_ttl_ms, 12 * 60 * 60_000))
    : 30 * 60_000;
  const rateLimitWindowMs = Number.isInteger(configuration.rate_limit_window_ms)
    ? Math.max(1_000, configuration.rate_limit_window_ms)
    : 60_000;
  const rateLimitAttempts = Number.isInteger(configuration.rate_limit_attempts)
    ? Math.max(1, configuration.rate_limit_attempts)
    : 5;

  async function invokeInjected(factory, args = []) {
    try {
      const returned = factory(...args);
      if (!isThenable(returned)) return denial('ASYNC_SECURITY_CONTRACT_VIOLATION');
      const value = await returned;
      return frozen({ ok: true, value });
    } catch {
      return denial('ASYNC_SECURITY_REJECTED');
    }
  }

  async function verifyPrivateAccessCode(submittedCode) {
    if (typeof submittedCode !== 'string'
      || typeof expectedPrivateAccessCode !== 'string'
      || expectedPrivateAccessCode.length === 0) {
      return false;
    }
    const submittedDigest = crypto.createHash('sha256').update(submittedCode).digest();
    const expectedDigest = crypto.createHash('sha256').update(expectedPrivateAccessCode).digest();
    return crypto.timingSafeEqual(submittedDigest, expectedDigest);
  }

  async function readHealth() {
    const result = await callStatePort(
      statePort,
      'health',
      [],
      validateAsyncSecurityHealth,
    );
    if (!result.ok) return result;
    const health = result.value;
    if (health.environment_id !== environmentId
      || health.state !== 'HEALTHY'
      || health.allowed_for_security !== true
      || health.no_local_fallback !== true) {
      return denial(health.failure_code || 'SHARED_SECURITY_STATE_UNAVAILABLE', {
        health,
      });
    }
    return frozen({ ok: true, allowed: true, health });
  }

  async function authoritativeQuery(queryType, correlationRef, fields = {}) {
    const result = await callStatePort(
      statePort,
      'queryAuthoritative',
      [queryEnvelope(environmentId, correlationRef, queryType, fields)],
      (value) => validateAsyncSecurityQueryResult(value, queryType),
    );
    if (!result.ok) return result;
    if (result.value.ok !== true || result.value.consistency_proven !== true) {
      return denial(result.value.failure_code || 'NON_AUTHORITATIVE_READ', {
        receipt_ref: result.value.receipt_ref,
      });
    }
    return frozen({
      ok: true,
      allowed: true,
      record: result.value.record,
      server_time: result.value.server_time,
      receipt_ref: result.value.receipt_ref,
    });
  }

  async function executeAtomic(commandType, correlationRef, fields) {
    const command = commandEnvelope(environmentId, correlationRef, commandType, fields);
    const result = await callStatePort(
      statePort,
      'executeAtomic',
      [command],
      (value) => validateAsyncSecurityCommandResult(value, commandType),
    );
    if (!result.ok) return result;
    if (result.value.ok !== true || result.value.committed !== true) {
      return denial(result.value.failure_code || 'ASYNC_SECURITY_REJECTED');
    }
    return frozen({
      ok: true,
      allowed: true,
      command_result: result.value,
    });
  }

  async function authoritativeServerTime() {
    const result = await callStatePort(
      statePort,
      'serverTime',
      [],
      validateAsyncSecurityTime,
    );
    if (!result.ok) return result;
    if (result.value.ok !== true) {
      return denial(result.value.failure_code || 'SECURITY_STATE_CLOCK_INVALID');
    }
    return frozen({
      ok: true,
      allowed: true,
      server_time: result.value.server_time,
      now: Date.parse(result.value.server_time),
    });
  }

  function authenticationActivationDecision() {
    if (eligibilityConfiguration.emergency_disabled !== false) {
      return denial('EMERGENCY_DISABLED');
    }
    if (eligibilityConfiguration.enabled !== true
      || !eligibilityConfiguration.environment_allowlist.includes(environmentId)) {
      return denial('ASYNC_SECURITY_UNCONFIGURED');
    }
    return frozen({ ok: true, allowed: true });
  }

  const service = {
    async describe() {
      const capabilityResult = await callStatePort(
        statePort,
        'describeCapability',
        [],
        validateAsyncSecurityCapability,
      );
      if (!capabilityResult.ok) return capabilityResult;
      return frozen({
        ok: true,
        allowed: false,
        service_version: CANONICAL_ASYNC_SECURITY_SERVICE_VERSION,
        state_contract_version: capabilityResult.value.contract_version,
        authoritative_record_set: 'ASYNC_SECURITY_V2_ONLY',
        v1_fallback: false,
        mixed_sync_async: false,
        provider_connection: capabilityResult.value.live_connection_verified,
        capability: capabilityResult.value,
      });
    },

    async health() {
      return readHealth();
    },

    async beginPreAuth(input) {
      const activation = authenticationActivationDecision();
      if (!activation.allowed) return activation;
      if (!input
        || input.environment_id !== environmentId
        || input.edge_attestation?.named_identity_verified !== true
        || input.edge_attestation?.mfa_verified !== true
        || input.edge_attestation?.public_access !== false
        || !sha256(input.browser_binding_hash)
        || !text(input.correlation_ref)) {
        return denial('AUTHENTICATION_REQUIRED');
      }
      const health = await readHealth();
      if (!health.allowed) return health;
      const time = await authoritativeServerTime();
      if (!time.allowed) return time;
      const tokenResult = await invokeInjected(tokenFactory, ['preauth']);
      if (!tokenResult.ok || !text(tokenResult.value, 512)) {
        return denial('SESSION_ELEVATION_REQUIRED');
      }
      const tokenHashResult = await invokeInjected(tokenHasher, [tokenResult.value]);
      if (!tokenHashResult.ok || !sha256(tokenHashResult.value)) {
        return denial('SESSION_ELEVATION_REQUIRED');
      }
      const preAuthRef = `pre_auth_${tokenHashResult.value.slice(0, 32)}`;
      const preAuth = {
        record_version: 'pre-auth-private-session-v2',
        pre_auth_session_ref: preAuthRef,
        session_token_hash: tokenHashResult.value,
        environment_id: environmentId,
        browser_binding_hash: input.browser_binding_hash,
        session_epoch: 0,
        status: 'ACTIVE',
        issued_at: time.server_time,
        expires_at: new Date(time.now + preAuthTtlMs).toISOString(),
      };
      const begun = await executeAtomic(
        'BEGIN_PRE_AUTH',
        input.correlation_ref,
        {
          idempotencyKeyHash: hashCanonicalJson({
            operation: 'BEGIN_PRE_AUTH',
            pre_auth_session_ref: preAuthRef,
          }),
          arguments: { pre_auth_session: preAuth },
        },
      );
      if (!begun.allowed) return begun;
      return frozen({
        ok: true,
        allowed: true,
        decision_version: 'pre-auth-decision-v2',
        code: null,
        pre_auth_session_ref: preAuthRef,
        pre_auth_cookie_value: tokenResult.value,
        expires_at: preAuth.expires_at,
        authority_granted: false,
        audit_receipt_ref: begun.command_result.audit_receipt_ref,
      });
    },

    async completeAuthentication(input) {
      const activation = authenticationActivationDecision();
      if (!activation.allowed) return activation;
      if (!input
        || input.environment_id !== environmentId
        || input.edge_attestation?.named_identity_verified !== true
        || input.edge_attestation?.mfa_verified !== true
        || input.edge_attestation?.public_access !== false
        || input.verified_assertion?.verification_status !== 'VERIFIED'
        || input.verified_assertion?.named_identity_verified !== true
        || input.verified_assertion?.mfa_verified !== true
        || !text(input.verified_assertion?.external_subject_ref)
        || !sha256(input.verified_assertion?.exact_scope_hash)
        || !sha256(input.pre_auth_token_hash)
        || !sha256(input.browser_binding_hash)
        || !text(input.correlation_ref)) {
        return denial('SUBJECT_ASSERTION_INVALID');
      }
      const health = await readHealth();
      if (!health.allowed) return health;
      const preAuthResult = await authoritativeQuery(
        'GET_SESSION_BY_TOKEN_HASH',
        input.correlation_ref,
        { session_token_hash: input.pre_auth_token_hash },
      );
      if (!preAuthResult.allowed) return preAuthResult;
      const preAuth = preAuthResult.record;
      const now = Date.parse(preAuthResult.server_time);
      if (preAuth.record_version !== 'pre-auth-private-session-v2'
        || preAuth.session_class !== 'PRE_AUTH'
        || !activeAt(preAuth, now)
        || preAuth.environment_id !== environmentId
        || preAuth.browser_binding_hash !== input.browser_binding_hash) {
        return denial('SESSION_ELEVATION_REQUIRED');
      }
      const mappingResult = await authoritativeQuery(
        'RESOLVE_CANONICAL_SUBJECT',
        input.correlation_ref,
        { subject_ref: input.verified_assertion.external_subject_ref },
      );
      if (!mappingResult.allowed) return mappingResult;
      const mappingCheck = validateMapping(mappingResult.record, {
        external_subject_ref: input.verified_assertion.external_subject_ref,
        exact_scope_hash: input.verified_assertion.exact_scope_hash,
      });
      if (!mappingCheck.allowed) return mappingCheck;
      const inverseResult = await authoritativeQuery(
        'RESOLVE_EXACT_SCOPE',
        input.correlation_ref,
        {
          subject_ref: mappingCheck.mapping.subscriber_subject_ref,
          exact_scope_hash: mappingCheck.mapping.exact_scope_hash,
        },
      );
      if (!inverseResult.allowed
        || !validateInverseScope(inverseResult.record, mappingCheck.mapping).allowed) {
        return denial('SUBJECT_MAPPING_AMBIGUOUS');
      }
      const epochResult = await authoritativeQuery(
        'GET_SECURITY_EPOCH',
        input.correlation_ref,
        { exact_scope_hash: mappingCheck.mapping.exact_scope_hash },
      );
      if (!epochResult.allowed || !Number.isInteger(epochResult.record?.security_epoch)
        || epochResult.record.security_epoch < 1) {
        return denial('SUBJECT_MAPPING_STALE');
      }
      let sessionEpoch = 1;
      let rotationParentReference = preAuth.pre_auth_session_ref;
      if (input.rotation_parent_session_token_hash != null) {
        if (!sha256(input.rotation_parent_session_token_hash)
          || !text(input.rotation_parent_reference)) {
          return denial('SESSION_ROTATION_FAILED');
        }
        const parentResult = await authoritativeQuery(
          'GET_SESSION_BY_TOKEN_HASH',
          input.correlation_ref,
          { session_token_hash: input.rotation_parent_session_token_hash },
        );
        if (!parentResult.allowed) return parentResult;
        const parentCheck = validateSession(parentResult.record, {
          environment_id: environmentId,
          session_token_hash: input.rotation_parent_session_token_hash,
          browser_binding_hash: input.browser_binding_hash,
        }, mappingCheck.mapping, Date.parse(parentResult.server_time));
        if (!parentCheck.allowed
          || parentCheck.authenticated_session_ref !== input.rotation_parent_reference) {
          return denial('SESSION_ROTATION_FAILED');
        }
        sessionEpoch = parentCheck.session.session_epoch + 1;
        rotationParentReference = input.rotation_parent_reference;
      }
      const tokenResult = await invokeInjected(tokenFactory, ['session']);
      if (!tokenResult.ok || !text(tokenResult.value, 512)) {
        return denial('SESSION_ROTATION_FAILED');
      }
      const tokenHashResult = await invokeInjected(tokenHasher, [tokenResult.value]);
      if (!tokenHashResult.ok || !sha256(tokenHashResult.value)) {
        return denial('SESSION_ROTATION_FAILED');
      }
      const sessionRef = `authenticated_session_${tokenHashResult.value.slice(0, 32)}`;
      const expiresAt = new Date(now + sessionTtlMs).toISOString();
      const session = {
        record_version: 'authenticated-private-session-v2',
        authenticated_session_ref: sessionRef,
        session_token_hash: tokenHashResult.value,
        environment_id: environmentId,
        subscriber_subject_ref: mappingCheck.mapping.subscriber_subject_ref,
        exact_scope_hash: mappingCheck.mapping.exact_scope_hash,
        browser_binding_hash: input.browser_binding_hash,
        subject_security_version: mappingCheck.mapping.security_version,
        session_epoch: sessionEpoch,
        security_epoch: epochResult.record.security_epoch,
        session_class: 'AUTHENTICATED',
        rotation_parent_reference: rotationParentReference,
        status: 'ACTIVE',
        issued_at: preAuthResult.server_time,
        expires_at: expiresAt,
      };
      const elevated = await executeAtomic(
        'ELEVATE_AUTHENTICATED_SESSION',
        input.correlation_ref,
        {
          idempotencyKeyHash: hashCanonicalJson({
            operation: 'ELEVATE_AUTHENTICATED_SESSION',
            pre_auth_session_ref: preAuth.pre_auth_session_ref,
          }),
          expectedVersions: {
            mapping_version: mappingCheck.mapping.mapping_version,
            security_epoch: epochResult.record.security_epoch,
            session_epoch: sessionEpoch - 1,
          },
          arguments: {
            pre_auth_session_ref: preAuth.pre_auth_session_ref,
            authenticated_session: session,
          },
        },
      );
      if (!elevated.allowed) return elevated;
      const authenticatedRequestContext = {
        environment_id: environmentId,
        external_subject_ref: mappingCheck.mapping.external_subject_ref,
        session_token_hash: tokenHashResult.value,
        exact_scope_hash: mappingCheck.mapping.exact_scope_hash,
        browser_binding_hash: input.browser_binding_hash,
        correlation_ref: input.correlation_ref,
        edge_attestation: input.edge_attestation,
      };
      const resolved = await service.resolveAuthenticatedContext(authenticatedRequestContext);
      if (!resolved.allowed) return resolved;
      return frozen({
        ...resolved,
        decision_version: 'authentication-decision-v2',
        authenticated_session_ref: sessionRef,
        session_cookie_value: tokenResult.value,
        expires_at: expiresAt,
        prior_session_invalidated: input.rotation_parent_session_token_hash != null,
        audit_receipt_ref: elevated.command_result.audit_receipt_ref,
      });
    },

    async resolveAuthenticatedContext(requestContext) {
      const requestCheck = validateRequestContext(requestContext, environmentId);
      if (!requestCheck.allowed) return requestCheck;
      const activation = evaluatePrivateTestEligibilityActivation({
        configuration: eligibilityConfiguration,
        environmentId,
        subscriberSubjectRef: eligibilityConfiguration.subject_allowlist[0] || null,
        exactScopeHash: requestContext.exact_scope_hash,
      });
      if (activation.code === 'EMERGENCY_DISABLED') return denial('EMERGENCY_DISABLED');

      const health = await readHealth();
      if (!health.allowed) return health;

      const sessionResult = await authoritativeQuery(
        'GET_SESSION_BY_TOKEN_HASH',
        requestContext.correlation_ref,
        { session_token_hash: requestContext.session_token_hash },
      );
      if (!sessionResult.allowed) return sessionResult;

      const mappingResult = await authoritativeQuery(
        'RESOLVE_CANONICAL_SUBJECT',
        requestContext.correlation_ref,
        { subject_ref: requestContext.external_subject_ref },
      );
      if (!mappingResult.allowed) return mappingResult;
      const mappingCheck = validateMapping(mappingResult.record, requestContext);
      if (!mappingCheck.allowed) return mappingCheck;

      const inverseResult = await authoritativeQuery(
        'RESOLVE_EXACT_SCOPE',
        requestContext.correlation_ref,
        {
          subject_ref: mappingCheck.mapping.subscriber_subject_ref,
          exact_scope_hash: mappingCheck.mapping.exact_scope_hash,
        },
      );
      if (!inverseResult.allowed) return inverseResult;
      const inverseCheck = validateInverseScope(inverseResult.record, mappingCheck.mapping);
      if (!inverseCheck.allowed) return inverseCheck;

      const now = Date.parse(sessionResult.server_time);
      const sessionCheck = validateSession(
        sessionResult.record,
        requestContext,
        mappingCheck.mapping,
        now,
      );
      if (!sessionCheck.allowed) return sessionCheck;

      const canonicalReceipt = frozen({
        decision_version: CANONICAL_SUBJECT_DECISION_VERSION,
        allowed: true,
        external_subject_ref: mappingCheck.mapping.external_subject_ref,
        subscriber_subject_ref: mappingCheck.mapping.subscriber_subject_ref,
        exact_scope_hash: mappingCheck.mapping.exact_scope_hash,
        subject_security_version: mappingCheck.mapping.security_version,
        mapping_status: mappingCheck.mapping.status,
        auto_enrolled: false,
        failure_code: null,
        receipt_ref: mappingResult.receipt_ref,
      });
      const authenticatedContext = frozen({
        context_version: AUTHENTICATED_PRIVATE_CONTEXT_VERSION,
        environment_id: environmentId,
        external_subject_ref: mappingCheck.mapping.external_subject_ref,
        subscriber_subject_ref: mappingCheck.mapping.subscriber_subject_ref,
        authenticated_session_ref: sessionCheck.authenticated_session_ref,
        session_token_hash: requestContext.session_token_hash,
        exact_scope_hash: mappingCheck.mapping.exact_scope_hash,
        browser_binding_hash: requestContext.browser_binding_hash,
        subject_security_version: mappingCheck.mapping.security_version,
        session_epoch: sessionCheck.session.session_epoch,
        security_epoch: sessionCheck.session.security_epoch,
        expires_at: sessionCheck.session.expires_at,
        correlation_ref: requestContext.correlation_ref,
        resolution_receipt_ref: mappingResult.receipt_ref,
      });
      return frozen({
        ok: true,
        allowed: true,
        decision_version: 'authenticated-context-decision-v2',
        code: null,
        canonical_subject: canonicalReceipt,
        authenticated_context: authenticatedContext,
      });
    },

    async evaluatePrivateTestEligibility(authenticatedContext) {
      if (!authenticatedContext
        || authenticatedContext.context_version !== AUTHENTICATED_PRIVATE_CONTEXT_VERSION
        || authenticatedContext.environment_id !== environmentId
        || !text(authenticatedContext.subscriber_subject_ref)
        || !sha256(authenticatedContext.exact_scope_hash)
        || !text(authenticatedContext.authenticated_session_ref)
        || !text(authenticatedContext.correlation_ref)) {
        return denial('AUTHENTICATION_REQUIRED');
      }
      const activation = evaluatePrivateTestEligibilityActivation({
        configuration: eligibilityConfiguration,
        environmentId,
        subscriberSubjectRef: authenticatedContext.subscriber_subject_ref,
        exactScopeHash: authenticatedContext.exact_scope_hash,
      });
      if (!activation.allowed) return denial(activation.code);

      const health = await readHealth();
      if (!health.allowed) return health;
      const approvalResult = await authoritativeQuery(
        'GET_PRIVATE_TEST_APPROVAL',
        authenticatedContext.correlation_ref,
        {
          subject_ref: authenticatedContext.subscriber_subject_ref,
          exact_scope_hash: authenticatedContext.exact_scope_hash,
        },
      );
      if (!approvalResult.allowed) return approvalResult;
      const epochResult = await authoritativeQuery(
        'GET_SECURITY_EPOCH',
        authenticatedContext.correlation_ref,
        { exact_scope_hash: authenticatedContext.exact_scope_hash },
      );
      if (!epochResult.allowed) return epochResult;
      const epoch = epochResult.record?.security_epoch;
      if (!Number.isInteger(epoch)
        || epoch !== authenticatedContext.security_epoch
        || epochResult.record?.exact_scope_hash !== authenticatedContext.exact_scope_hash) {
        return denial('SUBJECT_MAPPING_STALE');
      }
      const approval = validatePrivateTestApprovalV1(approvalResult.record, {
        environmentId,
        subscriberSubjectRef: authenticatedContext.subscriber_subject_ref,
        exactScopeHash: authenticatedContext.exact_scope_hash,
        securityEpoch: epoch,
        now: Date.parse(approvalResult.server_time),
      });
      if (!approval.valid) return denial(approval.errors[0]?.code || 'PRIVATE_TEST_APPROVAL_REQUIRED');
      return createPrivateTestEligibilityDecision({
        environmentId,
        authenticatedContext,
        approval: approval.value,
        securityEpoch: epoch,
        evaluatedAt: approvalResult.server_time,
      });
    },

    async issueCsrfGrant(authenticatedContext, intent) {
      if (!authenticatedContext
        || authenticatedContext.context_version !== AUTHENTICATED_PRIVATE_CONTEXT_VERSION
        || authenticatedContext.environment_id !== environmentId
        || !text(authenticatedContext.authenticated_session_ref)
        || !sha256(authenticatedContext.browser_binding_hash)
        || !text(authenticatedContext.correlation_ref)
        || !intent
        || !text(intent.route, 160)
        || !text(intent.method, 32)
        || intent.browser_binding_hash !== authenticatedContext.browser_binding_hash) {
        return denial('CSRF_VALIDATION_FAILED');
      }
      const activation = evaluatePrivateTestEligibilityActivation({
        configuration: eligibilityConfiguration,
        environmentId,
        subscriberSubjectRef: authenticatedContext.subscriber_subject_ref,
        exactScopeHash: authenticatedContext.exact_scope_hash,
      });
      if (!activation.allowed) return denial(activation.code);
      const health = await readHealth();
      if (!health.allowed) return health;
      const time = await authoritativeServerTime();
      if (!time.allowed) return time;
      const proofResult = await invokeInjected(tokenFactory, ['csrf']);
      if (!proofResult.ok || !text(proofResult.value, 512)) {
        return denial('CSRF_VALIDATION_FAILED');
      }
      const hashResult = await invokeInjected(tokenHasher, [proofResult.value]);
      if (!hashResult.ok || !sha256(hashResult.value)) return denial('CSRF_VALIDATION_FAILED');
      const expiryMs = Math.min(
        time.now + csrfTtlMs,
        Date.parse(authenticatedContext.expires_at),
      );
      if (!Number.isFinite(expiryMs) || expiryMs <= time.now) return denial('SESSION_EXPIRED');
      const csrfGrantRef = `csrf_grant_${hashResult.value.slice(0, 32)}`;
      const grant = {
        record_version: 'csrf-grant-v2',
        csrf_grant_ref: csrfGrantRef,
        csrf_proof_hash: hashResult.value,
        environment_id: environmentId,
        subscriber_subject_ref: authenticatedContext.subscriber_subject_ref,
        authenticated_session_ref: authenticatedContext.authenticated_session_ref,
        browser_binding_hash: authenticatedContext.browser_binding_hash,
        exact_scope_hash: authenticatedContext.exact_scope_hash,
        method: intent.method,
        route: intent.route,
        status: 'ACTIVE',
        issued_at: time.server_time,
        expires_at: new Date(expiryMs).toISOString(),
        security_epoch: authenticatedContext.security_epoch,
      };
      const result = await executeAtomic(
        'ISSUE_CSRF_GRANT',
        authenticatedContext.correlation_ref,
        {
          idempotencyKeyHash: hashCanonicalJson({
            operation: 'ISSUE_CSRF_GRANT',
            csrf_grant_ref: csrfGrantRef,
          }),
          expectedVersions: {
            security_epoch: authenticatedContext.security_epoch,
            session_epoch: authenticatedContext.session_epoch,
          },
          arguments: { csrf_grant: grant },
        },
      );
      if (!result.allowed) return result;
      return frozen({
        ok: true,
        allowed: true,
        decision_version: 'csrf-grant-decision-v2',
        code: null,
        csrf_grant_ref: csrfGrantRef,
        csrf_proof: proofResult.value,
        route: intent.route,
        method: intent.method,
        expires_at: grant.expires_at,
        audit_receipt_ref: result.command_result.audit_receipt_ref,
      });
    },

    async issueTemporaryEntitlement(input) {
      const requestContext = input?.request_context;
      const authenticated = await service.resolveAuthenticatedContext(requestContext);
      if (!authenticated.allowed) return authenticated;
      const currentEligibility = await service.evaluatePrivateTestEligibility(
        authenticated.authenticated_context,
      );
      if (!currentEligibility.allowed) return currentEligibility;
      if (input?.eligibility_decision?.allowed !== true
        || input.eligibility_decision.subscriber_subject_ref
          !== currentEligibility.subscriber_subject_ref
        || input.eligibility_decision.authenticated_session_ref
          !== currentEligibility.authenticated_session_ref
        || input.eligibility_decision.exact_scope_hash
          !== currentEligibility.exact_scope_hash
        || input.eligibility_decision.security_epoch !== currentEligibility.security_epoch
        || !text(requestContext?.csrf_proof, 512)
        || !text(requestContext?.route, 160)
        || !text(requestContext?.method, 32)) {
        return denial('PRIVATE_TEST_BOOTSTRAP_INELIGIBLE');
      }
      const csrfHash = await invokeInjected(tokenHasher, [requestContext.csrf_proof]);
      if (!csrfHash.ok || !sha256(csrfHash.value)) return denial('CSRF_VALIDATION_FAILED');
      const rateLimit = await executeAtomic(
        'APPLY_RATE_LIMIT',
        authenticated.authenticated_context.correlation_ref,
        {
          idempotencyKeyHash: hashCanonicalJson({
            operation: 'APPLY_RATE_LIMIT',
            request_ref: requestContext.idempotency_ref || csrfHash.value,
          }),
          arguments: {
            dimension_hash: hashCanonicalJson({
              environment_id: environmentId,
              subscriber_subject_ref: authenticated.authenticated_context.subscriber_subject_ref,
              exact_scope_hash: authenticated.authenticated_context.exact_scope_hash,
            }),
            window_ms: rateLimitWindowMs,
            limit: rateLimitAttempts,
          },
        },
      );
      if (!rateLimit.allowed) return rateLimit;
      if (!(await verifyPrivateAccessCode(input?.submitted_code))) {
        return denial('ENTITLEMENT_INVALID');
      }
      const time = await authoritativeServerTime();
      if (!time.allowed) return time;
      const tokenResult = await invokeInjected(tokenFactory, ['entitlement']);
      if (!tokenResult.ok || !text(tokenResult.value, 512)) return denial('ENTITLEMENT_INVALID');
      const tokenHashResult = await invokeInjected(tokenHasher, [tokenResult.value]);
      if (!tokenHashResult.ok || !sha256(tokenHashResult.value)) return denial('ENTITLEMENT_INVALID');
      const expiryMs = Math.min(
        time.now + entitlementTtlMs,
        Date.parse(authenticated.authenticated_context.expires_at),
        Date.parse(currentEligibility.expires_at),
        timestamp(configuration.activation_expires_at)
          ? Date.parse(configuration.activation_expires_at)
          : Number.POSITIVE_INFINITY,
      );
      if (!Number.isFinite(expiryMs) || expiryMs <= time.now) return denial('ENTITLEMENT_EXPIRED');
      const entitlementRef = `temporary_entitlement_${tokenHashResult.value.slice(0, 32)}`;
      const entitlement = {
        record_version: 'temporary-private-entitlement-v2',
        entitlement_ref: entitlementRef,
        entitlement_token_hash: tokenHashResult.value,
        environment_id: environmentId,
        subscriber_subject_ref: authenticated.authenticated_context.subscriber_subject_ref,
        authenticated_session_ref: authenticated.authenticated_context.authenticated_session_ref,
        browser_binding_hash: authenticated.authenticated_context.browser_binding_hash,
        exact_scope_hash: authenticated.authenticated_context.exact_scope_hash,
        subject_security_version: authenticated.authenticated_context.subject_security_version,
        session_epoch: authenticated.authenticated_context.session_epoch,
        security_epoch: authenticated.authenticated_context.security_epoch,
        source: 'temporary_internal_subscription_entitlement',
        access_type: 'more_monthly_intelligence',
        status: 'ACTIVE',
        issued_at: time.server_time,
        expires_at: new Date(expiryMs).toISOString(),
        temporary: true,
        paid_entitlement: false,
        billing_evidence: false,
        stripe_subscription_created: false,
        admin_authority: false,
        operator_authority: false,
        deployment_authority: false,
        billing_authority: false,
        coach_authority: false,
        canonical_mutation_authority: false,
      };
      const issued = await executeAtomic(
        'CONSUME_CSRF_AND_ISSUE_TEMPORARY_ENTITLEMENT',
        authenticated.authenticated_context.correlation_ref,
        {
          idempotencyKeyHash: hashCanonicalJson({
            operation: 'ISSUE_TEMPORARY_ENTITLEMENT',
            csrf_proof_hash: csrfHash.value,
          }),
          expectedVersions: {
            security_epoch: authenticated.authenticated_context.security_epoch,
            session_epoch: authenticated.authenticated_context.session_epoch,
          },
          arguments: {
            csrf_proof_hash: csrfHash.value,
            authenticated_session_ref: authenticated.authenticated_context.authenticated_session_ref,
            subscriber_subject_ref: authenticated.authenticated_context.subscriber_subject_ref,
            exact_scope_hash: authenticated.authenticated_context.exact_scope_hash,
            browser_binding_hash: authenticated.authenticated_context.browser_binding_hash,
            method: requestContext.method,
            route: requestContext.route,
            code_verified: true,
            entitlement,
          },
        },
      );
      if (!issued.allowed) return issued;
      const safeEntitlement = { ...entitlement };
      delete safeEntitlement.entitlement_token_hash;
      return frozen({
        ok: true,
        allowed: true,
        decision_version: 'temporary-entitlement-decision-v2',
        code: null,
        entitlement: safeEntitlement,
        entitlement_cookie_value: tokenResult.value,
        audit_receipt_ref: issued.command_result.audit_receipt_ref,
      });
    },

    async inspectTemporaryEntitlement(requestContext) {
      const authenticated = await service.resolveAuthenticatedContext(requestContext);
      if (!authenticated.allowed) return authenticated;
      if (!sha256(requestContext?.entitlement_token_hash)) return denial('ENTITLEMENT_REQUIRED');
      const result = await authoritativeQuery(
        'GET_TEMPORARY_ENTITLEMENT_BY_TOKEN_HASH',
        authenticated.authenticated_context.correlation_ref,
        { entitlement_token_hash: requestContext.entitlement_token_hash },
      );
      if (!result.allowed) return result;
      const entitlement = result.record;
      const now = Date.parse(result.server_time);
      if (!activeAt(entitlement, now)
        || entitlement.record_version !== 'temporary-private-entitlement-v2'
        || entitlement.environment_id !== environmentId
        || entitlement.subscriber_subject_ref
          !== authenticated.authenticated_context.subscriber_subject_ref
        || entitlement.authenticated_session_ref
          !== authenticated.authenticated_context.authenticated_session_ref
        || entitlement.browser_binding_hash
          !== authenticated.authenticated_context.browser_binding_hash
        || entitlement.exact_scope_hash !== authenticated.authenticated_context.exact_scope_hash
        || entitlement.subject_security_version
          !== authenticated.authenticated_context.subject_security_version
        || entitlement.session_epoch !== authenticated.authenticated_context.session_epoch
        || entitlement.security_epoch !== authenticated.authenticated_context.security_epoch
        || entitlement.temporary !== true
        || entitlement.paid_entitlement !== false
        || entitlement.billing_evidence !== false
        || entitlement.stripe_subscription_created !== false) {
        return denial(entitlement?.status === 'REVOKED'
          ? 'ENTITLEMENT_REVOKED'
          : 'ENTITLEMENT_INVALID');
      }
      const safeEntitlement = { ...entitlement };
      delete safeEntitlement.entitlement_token_hash;
      return frozen({
        ok: true,
        allowed: true,
        decision_version: 'temporary-entitlement-decision-v2',
        code: null,
        entitlement: safeEntitlement,
        receipt_ref: result.receipt_ref,
      });
    },

    async evaluatePrivateRuntimeAuthority(input) {
      const requestContext = input?.request_context;
      const authenticated = await service.resolveAuthenticatedContext(requestContext);
      if (!authenticated.allowed) return authenticated;
      const activation = evaluatePrivateTestEligibilityActivation({
        configuration: eligibilityConfiguration,
        environmentId,
        subscriberSubjectRef: authenticated.authenticated_context.subscriber_subject_ref,
        exactScopeHash: authenticated.authenticated_context.exact_scope_hash,
      });
      if (!activation.allowed) return denial(activation.code);
      if (!sha256(requestContext?.entitlement_token_hash)
        || !text(input?.requested_runtime, 160)
        || !text(input?.requested_action, 160)
        || !['BUSINESS_ENGINE', 'SUBSCRIPTION_RUNTIME', 'COACH_CONNECT']
          .includes(input.requested_runtime)) {
        return denial('RUNTIME_ACTION_DENIED');
      }
      const snapshot = await authoritativeQuery(
        'READ_AUTHORITY_SNAPSHOT',
        authenticated.authenticated_context.correlation_ref,
        {
          subject_ref: authenticated.authenticated_context.subscriber_subject_ref,
          session_token_hash: requestContext.session_token_hash,
          entitlement_token_hash: requestContext.entitlement_token_hash,
          exact_scope_hash: authenticated.authenticated_context.exact_scope_hash,
          requested_runtime: input.requested_runtime,
          requested_action: input.requested_action,
        },
      );
      if (!snapshot.allowed) return snapshot;
      const record = snapshot.record;
      if (record.security_epoch !== authenticated.authenticated_context.security_epoch
        || record.session?.authenticated_session_ref
          !== authenticated.authenticated_context.authenticated_session_ref
        || record.entitlement?.temporary !== true
        || record.entitlement?.paid_entitlement !== false
        || record.entitlement?.billing_evidence !== false
        || record.entitlement?.stripe_subscription_created !== false) {
        return denial('RUNTIME_AUTHORITY_DENIED');
      }
      const description = await service.describe();
      if (!description.ok) return description;
      const evaluatedAt = record.evaluated_at || snapshot.server_time;
      const expiresAt = new Date(Math.min(
        Date.parse(record.session.expires_at),
        Date.parse(record.approval.expires_at),
        Date.parse(record.entitlement.expires_at),
      )).toISOString();
      const authorityFields = {
        decision_version: 'private-runtime-authority-decision-v2',
        allowed: true,
        environment_id: environmentId,
        subscriber_subject_ref: authenticated.authenticated_context.subscriber_subject_ref,
        authenticated_session_ref: authenticated.authenticated_context.authenticated_session_ref,
        entitlement_ref: record.entitlement.entitlement_ref,
        exact_scope_hash: authenticated.authenticated_context.exact_scope_hash,
        security_epoch: record.security_epoch,
        requested_runtime: input.requested_runtime,
        requested_action: input.requested_action,
        evaluated_at: evaluatedAt,
        expires_at: expiresAt,
        deployment_grade_security_state: description.capability.deployment_grade,
        no_local_fallback: description.capability.no_local_fallback,
        shared_state_evidence_class: description.capability.deployment_grade
          ? 'FUTURE_PRIVATE_LIVE'
          : 'DEPLOYMENT_SHAPED_OFFLINE',
        admin_authority: false,
        operator_authority: false,
        deployment_authority: false,
        billing_authority: false,
        coach_authority: false,
        canonical_mutation_authority: false,
      };
      return frozen({
        ok: true,
        code: null,
        authority_fingerprint: hashCanonicalJson(authorityFields),
        ...authorityFields,
      });
    },

    async revokeTemporaryEntitlement(input) {
      const authenticated = await service.resolveAuthenticatedContext(input?.request_context);
      if (!authenticated.allowed) return authenticated;
      const inspected = await service.inspectTemporaryEntitlement(input.request_context);
      if (!inspected.allowed) return inspected;
      const revoked = await executeAtomic(
        'REVOKE_TEMPORARY_ENTITLEMENT',
        authenticated.authenticated_context.correlation_ref,
        {
          idempotencyKeyHash: hashCanonicalJson({
            operation: 'REVOKE_TEMPORARY_ENTITLEMENT',
            entitlement_ref: inspected.entitlement.entitlement_ref,
          }),
          expectedVersions: {
            security_epoch: authenticated.authenticated_context.security_epoch,
          },
          arguments: {
            entitlement_ref: inspected.entitlement.entitlement_ref,
          },
        },
      );
      if (!revoked.allowed) return revoked;
      return frozen({
        ok: true,
        allowed: false,
        decision_version: 'temporary-entitlement-revocation-decision-v2',
        code: 'ENTITLEMENT_REVOKED',
        entitlement_revoked: true,
        client_entitlement_cookie_clear: true,
        audit_receipt_ref: revoked.command_result.audit_receipt_ref,
      });
    },

    async logout(input) {
      const requestContext = input?.request_context;
      const clientClear = {
        client_session_cookie_clear: true,
        client_entitlement_cookie_clear: true,
        runtime_handles_detached: true,
      };
      if (!requestContext
        || requestContext.environment_id !== environmentId
        || !sha256(requestContext.session_token_hash)
        || !text(requestContext.correlation_ref)) {
        return denial('AUTHENTICATION_REQUIRED', clientClear);
      }
      const health = await readHealth();
      if (!health.allowed) {
        return denial('LOGOUT_REVOCATION_UNCONFIRMED', {
          ...clientClear,
          server_revocation_confirmed: false,
          local_revocation_queued: false,
        });
      }
      const sessionResult = await authoritativeQuery(
        'GET_SESSION_BY_TOKEN_HASH',
        requestContext.correlation_ref,
        { session_token_hash: requestContext.session_token_hash },
      );
      if (!sessionResult.allowed) {
        return frozen({
          ok: true,
          allowed: false,
          decision_version: 'logout-decision-v2',
          code: sessionResult.code,
          ...clientClear,
          server_revocation_confirmed: sessionResult.code === 'SESSION_NOT_FOUND',
          already_revoked: false,
          local_revocation_queued: false,
        });
      }
      const session = sessionResult.record;
      if (['REVOKED', 'ROTATED', 'EXPIRED', 'EMERGENCY_REVOKED'].includes(session.status)) {
        return frozen({
          ok: true,
          allowed: false,
          decision_version: 'logout-decision-v2',
          code: session.status === 'REVOKED' ? 'SESSION_REVOKED' : 'SESSION_ROTATED',
          ...clientClear,
          server_revocation_confirmed: true,
          already_revoked: true,
          local_revocation_queued: false,
        });
      }
      if (session.record_version !== 'authenticated-private-session-v2'
        || session.session_class !== 'AUTHENTICATED'
        || !text(session.authenticated_session_ref)) {
        return denial('LOGOUT_REVOCATION_UNCONFIRMED', {
          ...clientClear,
          server_revocation_confirmed: false,
          local_revocation_queued: false,
        });
      }
      const revoked = await executeAtomic(
        'REVOKE_RUNTIME_ACCESS',
        requestContext.correlation_ref,
        {
          idempotencyKeyHash: hashCanonicalJson({
            operation: 'REVOKE_RUNTIME_ACCESS',
            authenticated_session_ref: session.authenticated_session_ref,
          }),
          expectedVersions: {
            security_epoch: session.security_epoch,
            session_epoch: session.session_epoch,
          },
          arguments: {
            authenticated_session_ref: session.authenticated_session_ref,
          },
        },
      );
      if (!revoked.allowed) {
        return denial('LOGOUT_REVOCATION_UNCONFIRMED', {
          ...clientClear,
          server_revocation_confirmed: false,
          local_revocation_queued: false,
        });
      }
      return frozen({
        ok: true,
        allowed: false,
        decision_version: 'logout-decision-v2',
        code: 'SESSION_REVOKED',
        ...clientClear,
        server_revocation_confirmed: true,
        already_revoked: false,
        local_revocation_queued: false,
        security_epoch: revoked.command_result.new_versions.security_epoch,
        audit_receipt_ref: revoked.command_result.audit_receipt_ref,
      });
    },

    async inspectRecovery(input) {
      const authority = await service.evaluatePrivateRuntimeAuthority(input);
      if (!authority.allowed) {
        return denial(authority.code || 'RUNTIME_AUTHORITY_DENIED', {
          recovered: false,
          evidence_class: 'SYNTHETIC',
          deployment_grade: false,
          local_fallback_used: false,
        });
      }
      const description = await service.describe();
      if (!description.ok) return description;
      return frozen({
        ok: true,
        allowed: true,
        decision_version: 'private-runtime-recovery-decision-v2',
        code: null,
        recovered: true,
        evidence_class: description.capability.deployment_grade
          ? 'FUTURE_PRIVATE_LIVE'
          : 'SYNTHETIC',
        deployment_grade: description.capability.deployment_grade,
        live_connection_verified: description.capability.live_connection_verified,
        local_fallback_used: false,
        authority,
      });
    },
  };

  return Object.freeze(service);
}

export function canonicalAsyncSecurityDecisionFingerprint(value) {
  return hashCanonicalJson(value);
}
