import crypto from 'node:crypto';
import {
  clearSubdev1Cookies,
  createSubdev1OperatorBridge,
  InMemorySubdev1OperatorBridgeStore,
  readSubdev1OperatorCookies,
  subdev1BrowserCookie,
  subdev1ContextCookie,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';
import {
  buildPrivateRuntimeOperatorBridgeDeploymentBindingV1,
} from '../../src/lib/intelligenceFabric/coachConnect/privateRuntime/liveBindings/operatorBridgeBinding.js';

const defaultStore = new InMemorySubdev1OperatorBridgeStore();

function securityHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  res.setHeader('Vary', 'Origin, Cookie');
}

function parsedBody(req) {
  if (typeof req?.body === 'string') {
    if (req.body.length > 4096) return null;
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req?.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : null;
}

function exactBody(value, fields) {
  return value
    && Object.keys(value).length === fields.length
    && Object.keys(value).every((field) => fields.includes(field));
}

function safeFailure(code) {
  if (code === 'OPERATOR_BRIDGE_DISABLED') {
    return { status: 404, body: { ok: false, error: 'feature_unavailable' } };
  }
  if (code === 'OPERATOR_CONTEXT_INVALID'
    || code === 'OPERATOR_CONTEXT_EXPIRED'
    || code === 'OPERATOR_CONTEXT_REVOKED'
    || code === 'OPERATOR_BROWSER_BINDING_INVALID') {
    return { status: 401, body: { ok: false, error: 'authentication_required' } };
  }
  if (code === 'PROFILE_RESOLUTION_DENIED'
    || code === 'PROFILE_RESOLUTION_AMBIGUOUS'
    || code === 'PROFILE_ID_INVALID'
    || code === 'PROFILE_SCOPE_INVALID'
    || code === 'PROFILE_CONSENT_REQUIRED'
    || code === 'PROFILE_RECEIPT_STALE') {
    return { status: 404, body: { ok: false, error: 'profile_unavailable' } };
  }
  if (code === 'OPERATOR_RATE_LIMITED') {
    return { status: 429, body: { ok: false, error: 'request_denied' } };
  }
  if (code === 'OPERATOR_BRIDGE_CONFIGURATION_INVALID'
    || code === 'OPERATOR_STORE_UNAVAILABLE') {
    return { status: 503, body: { ok: false, error: 'feature_unavailable' } };
  }
  return { status: 403, body: { ok: false, error: 'request_denied' } };
}

function fail(res, code) {
  const safe = safeFailure(code);
  return res.status(safe.status).json(safe.body);
}

function setCookies(res, cookies) {
  const values = cookies.filter(Boolean);
  if (values.length) res.setHeader('Set-Cookie', values);
}

export function createSubdev1OperatorHandler({
  env = globalThis.process?.env || {},
  store = defaultStore,
  profileRepository,
  clock = () => Date.now(),
  randomToken = () => crypto.randomBytes(32).toString('base64url'),
} = {}) {
  const bridge = createSubdev1OperatorBridge({
    env,
    store,
    profileRepository,
    clock,
    randomToken,
  });

  return async function subdev1OperatorHandler(req, res) {
    securityHeaders(res);
    if (!['GET', 'POST', 'DELETE'].includes(req?.method)) {
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }

    const existingCookies = readSubdev1OperatorCookies(req?.headers?.cookie);

    if (req.method === 'GET') {
      const diagnosticRequested = req?.headers?.['x-more-private-context-diagnostic']
        === 'predicate-v1';
      const browser = await bridge.establishBrowser(
        existingCookies.browser_valid ? existingCookies.browser : '',
      );
      if (!browser.ok) return fail(res, browser.code);
      const intent = String(req?.headers?.['x-subdev1-csrf-intent'] || 'POST')
        .toUpperCase() === 'DELETE'
        ? 'DELETE'
        : 'POST';
      const csrf = await bridge.issueCsrf({
        request: req,
        browserToken: browser.browser_token,
        method: intent,
      });
      if (!csrf.ok) return fail(res, csrf.code);
      const status = existingCookies.context_valid
        ? await bridge.inspect({
            contextToken: existingCookies.context,
            browserToken: browser.browser_token,
          })
        : {
            active: false,
            profile_state: 'NO_PROFILE',
            profile_receipt: null,
          };
      if (browser.newly_issued) {
        setCookies(res, [
          subdev1BrowserCookie(browser.browser_token, browser.max_age, { req, env }),
        ]);
      }
      return res.status(200).json({
        ok: true,
        active: status.active === true,
        capability_scope: status.active ? status.capability_scope : null,
        expires_at: status.active ? status.expires_at : null,
        profile_state: status.profile_state || 'NO_PROFILE',
        profile_receipt: status.profile_receipt || null,
        csrf_token: csrf.csrf_proof,
        csrf_method: intent,
        ...(diagnosticRequested ? {
          context_diagnostic: {
            browser_cookie_present: existingCookies.browser_valid,
            context_cookie_present: existingCookies.context_valid,
            persistence_lookup: status.diagnostic?.persistence_lookup || 'NOT_ATTEMPTED',
            context_integrity: status.diagnostic?.context_integrity || 'NOT_EVALUATED',
            failed_predicate_identifier:
              status.diagnostic?.failed_predicate_identifier || null,
          },
        } : {}),
      });
    }

    if (!existingCookies.browser_valid) {
      return fail(res, 'OPERATOR_BROWSER_BINDING_INVALID');
    }
    const csrfProof = req?.headers?.['x-subdev1-csrf'];

    if (req.method === 'DELETE') {
      const cleared = await bridge.clear({
        request: req,
        browserToken: existingCookies.browser,
        contextToken: existingCookies.context_valid ? existingCookies.context : '',
        csrfProof,
      });
      if (!cleared.ok) return fail(res, cleared.code);
      setCookies(res, clearSubdev1Cookies({ req, env }));
      return res.status(200).json({ ok: true, active: false, cleared: true });
    }

    const contentType = String(req?.headers?.['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      return fail(res, 'OPERATOR_CONTEXT_INVALID');
    }
    const input = parsedBody(req);
    if (input?.operation === 'ACTIVATE') {
      if (!exactBody(input, ['operation', 'access_code'])) {
        return fail(res, 'OPERATOR_CONTEXT_INVALID');
      }
      const activated = await bridge.activate({
        request: req,
        browserToken: existingCookies.browser,
        csrfProof,
        submittedCode: input.access_code,
      });
      if (!activated.ok) return fail(res, activated.code);
      setCookies(res, [
        subdev1ContextCookie(
          activated.context_token,
          activated.max_age,
          { req, env },
        ),
      ]);
      return res.status(200).json({
        ok: true,
        active: true,
        capability_scope: activated.capability_scope,
        expires_at: activated.expires_at,
        profile_state: activated.profile_state,
      });
    }

    if (input?.operation === 'SELECT_PROFILE') {
      if (!exactBody(input, ['operation', 'profile_id'])
        || !existingCookies.context_valid) {
        return fail(res, 'OPERATOR_CONTEXT_INVALID');
      }
      const selected = await bridge.selectProfile({
        request: req,
        browserToken: existingCookies.browser,
        contextToken: existingCookies.context,
        csrfProof,
        profileId: input.profile_id,
      });
      if (!selected.ok) return fail(res, selected.code);
      return res.status(200).json({
        ok: true,
        active: true,
        profile_state: selected.profile_state,
        profile_receipt: selected.profile_receipt,
        profile_switch_receipt: selected.profile_switch_receipt,
      });
    }

    return fail(res, 'OPERATOR_CONTEXT_INVALID');
  };
}

export function createSubdev1OperatorDeploymentHandler({
  env = globalThis.process?.env || {},
  buildBinding = buildPrivateRuntimeOperatorBridgeDeploymentBindingV1,
} = {}) {
  let resolvedHandler = null;
  let pending = null;

  return async function subdev1OperatorDeploymentHandler(req, res) {
    if (env.MORE_PRIVATE_RUNTIME_LIVE_ENABLED !== 'true'
      || env.MORE_PRIVATE_RUNTIME_EMERGENCY_DISABLED !== 'false'
      || env.MORE_SUBDEV1_OPERATOR_ENABLED !== 'true') {
      return createSubdev1OperatorHandler({
        env: {
          ...env,
          MORE_SUBDEV1_OPERATOR_ENABLED: 'false',
        },
        store: null,
        profileRepository: null,
      })(req, res);
    }
    if (resolvedHandler == null) {
      if (pending == null) {
        pending = Promise.resolve(buildBinding({ env }))
          .then((binding) => {
            if (binding?.ok !== true
              || binding?.operatorStore == null
              || binding?.profileRepository == null) {
              return null;
            }
            return createSubdev1OperatorHandler({
              env,
              store: binding.operatorStore,
              profileRepository: binding.profileRepository,
            });
          })
          .catch(() => null)
          .finally(() => {
            pending = null;
          });
      }
      resolvedHandler = await pending;
    }
    if (resolvedHandler == null) {
      return createSubdev1OperatorHandler({
        env,
        store: null,
        profileRepository: null,
      })(req, res);
    }
    return resolvedHandler(req, res);
  };
}

export default createSubdev1OperatorDeploymentHandler();
