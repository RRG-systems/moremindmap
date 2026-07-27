import {
  allowedDeveloperAccessOrigins,
  capabilityCookie,
  createDeveloperBinding,
  createDeveloperBindingFromCanonicalContext,
  developerAccessEnvironmentDecision,
  developerCapabilityFromCookie,
  evaluateDeveloperAccess,
  getDefaultDeveloperSecurityStore,
  revokeCapabilityCookie,
  revokeDeveloperCapability,
  SECURE_CAPABILITY_COOKIE_NAME,
} from './developer-access-security.js';
import { resolveSubscriptionEntitlement } from './subscription-entitlement.js';
import {
  appendSecurityAudit,
  consumeCsrfGrant,
  evaluateRequestOrigin,
  issueCsrfGrant,
  safeSecurityClientError,
} from '../../src/lib/intelligenceFabric/coachConnect/security/index.js';
import {
  getPrivateRuntimeLiveCompositionV2,
  settlePrivateRuntimeLiveOperation,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveComposition.js';
import crypto from 'node:crypto';

const ROUTE = '/api/internal/developer-access';

function body(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function securityHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  res.setHeader('Vary', 'Origin, Cookie');
}

function respondFailure(res, code, extras = {}) {
  const safe = safeSecurityClientError(code, { include_retry_after: extras.retry_after_ms });
  return res.status(extras.status || safe.status).json({ ...safe.body, ...(extras.csrf_token ? { csrf_token: extras.csrf_token, csrf_method: extras.csrf_method } : {}) });
}

function auditEndpointDenial({ store, req, binding, code, event_type, now }) {
  appendSecurityAudit(store, {
    event_type,
    decision: 'DENIED',
    failure_code: code,
    occurred_at: new Date(now).toISOString(),
    correlation_id: String(req.headers?.['x-correlation-id'] || 'developer-access-endpoint').slice(0, 160),
    scope: binding?.scope || null,
    details: {
      method: req.method,
      route: ROUTE,
      reason_codes: [code],
    },
  });
}

function createLegacyDeveloperAccessHandler({
  store = getDefaultDeveloperSecurityStore(),
  resolveSubjectBinding = () => null,
  resolveCanonicalSubjectContext = null,
  resolvePrivateRuntimeAuthority = null,
  randomToken = () => crypto.randomBytes(32).toString('base64url'),
  clock = () => Date.now(),
} = {}) {
  return function handler(req, res) {
    securityHeaders(res);
    const env = globalThis.process?.env || {};
    const now = clock();
    const privateRuntimeDecision = typeof resolvePrivateRuntimeAuthority === 'function'
      ? resolvePrivateRuntimeAuthority(req)
      : null;
    const environment = developerAccessEnvironmentDecision(env, store, privateRuntimeDecision);
    if (!environment.ok) {
      auditEndpointDenial({ store, req, binding: null, code: environment.code, event_type: 'CAPABILITY_DENIED', now });
      return respondFailure(res, environment.code, { status: environment.status });
    }
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    const canonicalContext = typeof resolveCanonicalSubjectContext === 'function'
      ? resolveCanonicalSubjectContext(req)
      : null;
    const rawBinding = typeof resolveCanonicalSubjectContext === 'function'
      ? null
      : resolveSubjectBinding(req);
    const binding = canonicalContext
      ? createDeveloperBindingFromCanonicalContext(canonicalContext, env)
      : rawBinding
        ? createDeveloperBinding(rawBinding, env)
        : null;
    if (!binding) {
      auditEndpointDenial({ store, req, binding: null, code: 'AUTHENTICATION_FAILED', event_type: 'AUTHENTICATION_DENIED', now });
      return respondFailure(res, 'AUTHENTICATION_FAILED');
    }
    const origin = evaluateRequestOrigin({ request: req, allowed_origins: allowedDeveloperAccessOrigins(env), require_origin: true });
    if (!origin.allowed) {
      auditEndpointDenial({ store, req, binding, code: origin.code, event_type: 'ORIGIN_DENIED', now });
      return respondFailure(res, origin.code);
    }

    if (req.method === 'GET') {
      const intent = String(req.headers?.['x-coach-connect-csrf-intent'] || 'POST').toUpperCase();
      const csrfMethod = intent === 'DELETE' ? 'DELETE' : 'POST';
      const issued = issueCsrfGrant({
        store,
        proof: randomToken(),
        browser_binding_hash: binding.browser_binding_hash,
        method: csrfMethod,
        route: ROUTE,
        environment_id: env.COACH_CONNECT_DEVELOPER_ACCESS_ENVIRONMENT_ID,
        now,
      });
      if (!issued.ok) return respondFailure(res, issued.code);
      const access = resolveSubscriptionEntitlement({
        req,
        env,
        now,
        store,
        subject_binding: binding,
        privateRuntimeDecision,
      });
      return res.status(access.allowed ? 200 : 403).json({
        ok: access.allowed,
        ...access,
        csrf_token: issued.proof,
        csrf_method: csrfMethod,
      });
    }

    const csrf = consumeCsrfGrant({
      store,
      proof: req.headers?.['x-coach-connect-csrf'],
      browser_binding_hash: binding.browser_binding_hash,
      method: req.method,
      route: ROUTE,
      environment_id: env.COACH_CONNECT_DEVELOPER_ACCESS_ENVIRONMENT_ID,
      now,
    });
    if (!csrf.allowed) {
      auditEndpointDenial({ store, req, binding, code: csrf.code, event_type: 'CSRF_DENIED', now });
      return respondFailure(res, csrf.code);
    }

    if (req.method === 'DELETE') {
      const token = developerCapabilityFromCookie(req.headers?.cookie);
      const revoked = revokeDeveloperCapability({
        token,
        env,
        now,
        store,
        subject_binding: binding,
        private_runtime_decision: privateRuntimeDecision,
      });
      if (!revoked.ok) return respondFailure(res, revoked.code);
      res.setHeader('Set-Cookie', revokeCapabilityCookie({ req, env }));
      return res.status(200).json({ ok: true, revoked: true });
    }

    const decision = evaluateDeveloperAccess({
      req,
      submittedCode: body(req).access_code,
      env,
      now,
      store,
      subject_binding: binding,
      origin_decision: origin,
      csrf_decision: csrf,
      private_runtime_decision: privateRuntimeDecision,
      random_token: randomToken,
    });
    if (!decision.ok) return respondFailure(res, decision.code, { status: decision.status, retry_after_ms: decision.retry_after_ms });
    res.setHeader('Set-Cookie', capabilityCookie(decision.capability, decision.maxAge, { req, env }));
    return res.status(200).json({
      ok: true,
      capability_issued: true,
      expires_in_seconds: decision.maxAge,
      entitlement_scope: 'subject_bound_temporary_monthly_intelligence',
    });
  };
}

function createV2DeveloperAccessHandler({
  liveCompositionV2 = null,
  compositionAccessor = getPrivateRuntimeLiveCompositionV2,
} = {}) {
  return async function developerAccessV2Handler(req, res) {
    securityHeaders(res);
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    const composition = liveCompositionV2 || compositionAccessor();
    const result = await settlePrivateRuntimeLiveOperation(
      composition?.operations?.developerAccess,
      [req],
    );
    if (!result?.ok) {
      return respondFailure(res, result?.code || 'CAPABILITY_INVALID', {
        status: result?.status || 404,
      });
    }
    if (req.method === 'GET') {
      return res.status(result.status || (result.allowed ? 200 : 403)).json({
        ok: result.allowed === true,
        allowed: result.allowed === true,
        entitlement: result.entitlement || null,
        csrf_token: result.csrf_proof,
        csrf_method: result.csrf_method,
      });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', revokeCapabilityCookie({ req }));
      return res.status(200).json({ ok: true, revoked: true });
    }
    if (typeof result.entitlement_cookie_value !== 'string') {
      return respondFailure(res, 'CAPABILITY_INVALID', { status: 503 });
    }
    res.setHeader(
      'Set-Cookie',
      `${SECURE_CAPABILITY_COOKIE_NAME}=${result.entitlement_cookie_value}; Path=/; HttpOnly; Secure; SameSite=Strict`,
    );
    return res.status(200).json({
      ok: true,
      capability_issued: true,
      expires_at: result.entitlement?.expires_at,
      entitlement_scope: 'subject_bound_temporary_monthly_intelligence',
    });
  };
}

export function createDeveloperAccessHandler(options = {}) {
  const legacyKeys = [
    'store',
    'resolveSubjectBinding',
    'resolveCanonicalSubjectContext',
    'resolvePrivateRuntimeAuthority',
    'randomToken',
    'clock',
  ];
  return options.legacyV1 === true || legacyKeys.some((key) => Object.hasOwn(options, key))
    ? createLegacyDeveloperAccessHandler(options)
    : createV2DeveloperAccessHandler(options);
}

export default createDeveloperAccessHandler();
