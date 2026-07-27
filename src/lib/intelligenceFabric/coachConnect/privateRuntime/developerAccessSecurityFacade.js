import { deepFreeze } from '../../validation.js';
import { isThenable } from '../productionSecurity/asyncSharedSecurityStatePort.js';

export const DEVELOPER_ACCESS_SECURITY_FACADE_VERSION = 'developer-access-security-facade-v2';

export const CANONICAL_ASYNC_SECURITY_SERVICE_METHODS = deepFreeze([
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
]);

const frozen = (value) => deepFreeze(structuredClone(value));
const denial = (code = 'RUNTIME_AUTHORITY_DENIED') => frozen({
  ok: false,
  allowed: false,
  code,
});

export function validateCanonicalAsyncSecurityServiceShape(service) {
  const missing = CANONICAL_ASYNC_SECURITY_SERVICE_METHODS
    .filter((method) => typeof service?.[method] !== 'function');
  return frozen({
    valid: missing.length === 0,
    missing,
  });
}

async function invokeService(service, method, args = []) {
  let returned;
  try {
    returned = service[method](...args);
  } catch {
    return denial('ASYNC_SECURITY_CONTRACT_VIOLATION');
  }
  if (!isThenable(returned)) return denial('ASYNC_SECURITY_CONTRACT_VIOLATION');
  try {
    const settled = await returned;
    if (!settled || typeof settled !== 'object' || Array.isArray(settled)) {
      return denial('ASYNC_SECURITY_RESULT_INVALID');
    }
    return frozen(settled);
  } catch {
    return denial('ASYNC_SECURITY_REJECTED');
  }
}

function requireAllowed(decision, fallback) {
  return decision?.ok === true && decision?.allowed === true
    ? decision
    : denial(decision?.code || fallback);
}

export function createDeveloperAccessSecurityFacadeV2({
  canonicalSecurityService,
} = {}) {
  const validation = validateCanonicalAsyncSecurityServiceShape(canonicalSecurityService);
  if (!validation.valid) {
    throw new TypeError(`canonical async security service is invalid: ${validation.missing.join(',')}`);
  }

  const resolveAuthenticated = async (requestContext) => {
    const decision = await invokeService(
      canonicalSecurityService,
      'resolveAuthenticatedContext',
      [requestContext],
    );
    return requireAllowed(decision, 'AUTHENTICATION_REQUIRED');
  };

  return Object.freeze({
    async describe() {
      const service = await invokeService(canonicalSecurityService, 'describe');
      if (service?.ok !== true) return service;
      return frozen({
        ok: true,
        facade_version: DEVELOPER_ACCESS_SECURITY_FACADE_VERSION,
        canonical_service_version: service.service_version,
        canonical_security_path: true,
        independent_state: false,
        provider_connection: false,
      });
    },

    async resolveAuthenticatedContext(requestContext) {
      return resolveAuthenticated(requestContext);
    },

    async evaluateBootstrapEligibility(requestContext) {
      const authenticated = await resolveAuthenticated(requestContext);
      if (!authenticated.allowed) return authenticated;
      const decision = await invokeService(
        canonicalSecurityService,
        'evaluatePrivateTestEligibility',
        [authenticated.authenticated_context],
      );
      return requireAllowed(decision, 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE');
    },

    async issueCsrf(requestContext, intent) {
      const authenticated = await resolveAuthenticated(requestContext);
      if (!authenticated.allowed) return authenticated;
      const decision = await invokeService(
        canonicalSecurityService,
        'issueCsrfGrant',
        [authenticated.authenticated_context, intent],
      );
      return requireAllowed(decision, 'CSRF_VALIDATION_FAILED');
    },

    async issueEntitlement(requestContext, submittedCode) {
      const authenticated = await resolveAuthenticated(requestContext);
      if (!authenticated.allowed) return authenticated;
      const eligibility = await invokeService(
        canonicalSecurityService,
        'evaluatePrivateTestEligibility',
        [authenticated.authenticated_context],
      );
      if (!requireAllowed(eligibility, 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE').allowed) {
        return denial(eligibility?.code || 'PRIVATE_TEST_BOOTSTRAP_INELIGIBLE');
      }
      const decision = await invokeService(
        canonicalSecurityService,
        'issueTemporaryEntitlement',
        [{
          request_context: requestContext,
          authenticated_context: authenticated.authenticated_context,
          eligibility_decision: eligibility,
          submitted_code: submittedCode,
        }],
      );
      return requireAllowed(decision, 'ENTITLEMENT_INVALID');
    },

    async inspectEntitlement(requestContext) {
      const authenticated = await resolveAuthenticated(requestContext);
      if (!authenticated.allowed) return authenticated;
      const decision = await invokeService(
        canonicalSecurityService,
        'inspectTemporaryEntitlement',
        [requestContext],
      );
      return requireAllowed(decision, 'ENTITLEMENT_REQUIRED');
    },

    async revokeEntitlement(requestContext) {
      const authenticated = await resolveAuthenticated(requestContext);
      if (!authenticated.allowed) return authenticated;
      const decision = await invokeService(
        canonicalSecurityService,
        'revokeTemporaryEntitlement',
        [{
          request_context: requestContext,
          authenticated_context: authenticated.authenticated_context,
        }],
      );
      return decision?.ok === true
        ? decision
        : denial(decision?.code || 'ENTITLEMENT_REVOKED');
    },
  });
}
