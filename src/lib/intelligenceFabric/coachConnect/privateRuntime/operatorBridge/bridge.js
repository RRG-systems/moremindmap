import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { canonicalJson, hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import { validateCsrfGrant } from '../../security/contracts.js';
import { evaluateRequestOrigin } from '../../security/requestIntegrity.js';
import {
  createSubdev1OperatorContext,
  createSubdev1ProfileReceipt,
  SUBDEV1_OPERATOR_ALLOWED_ACTIONS,
  subdev1OperatorContextDigest,
  validateSubdev1OperatorContext,
  withSubdev1ContextIntegrity,
} from './contracts.js';
import {
  createSubdev1AuthoritativeProfileResolver,
  createUnavailableSubdev1ProfileRepository,
} from './resolver.js';
import {
  InMemorySubdev1OperatorBridgeStore,
  validateSubdev1OperatorStore,
} from './store.js';

export const SUBDEV1_OPERATOR_ROUTE = '/api/internal/subdev1-operator';
export const SUBDEV1_LOCAL_BROWSER_COOKIE = 'more_subdev1_browser';
export const SUBDEV1_SECURE_BROWSER_COOKIE = '__Host-more_subdev1_browser';
export const SUBDEV1_LOCAL_CONTEXT_COOKIE = 'more_subdev1_operator';
export const SUBDEV1_SECURE_CONTEXT_COOKIE = '__Host-more_subdev1_operator';
export const SUBDEV1_DEFAULT_TTL_SECONDS = 15 * 60;
export const SUBDEV1_MAX_TTL_SECONDS = 30 * 60;
export const SUBDEV1_MIN_TTL_SECONDS = 60;

const frozen = (value) => deepFreeze(structuredClone(value));
const text = (value, max = 512) => typeof value === 'string' && value.length <= max
  ? value
  : '';
const nowIso = (now) => new Date(now).toISOString();
const denial = (code, status = 403, extras = {}) => frozen({
  ok: false,
  allowed: false,
  code,
  status,
  ...extras,
});

function runtimeName(env) {
  return String(env?.VERCEL_ENV || env?.NODE_ENV || 'local').trim().toLowerCase();
}

function opaque(value, max = 160) {
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= max
    && !/\s/.test(value)
    && !/[/?#@]/.test(value);
}

function signingSecret(env) {
  return text(env?.MORE_SUBDEV1_OPERATOR_SIGNING_SECRET, 4096);
}

function environmentId(env) {
  return text(env?.MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID, 160);
}

function allowedOrigins(env) {
  return text(env?.MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS, 2048)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function ttlSeconds(env) {
  if (env?.MORE_SUBDEV1_OPERATOR_TTL_SECONDS == null
    || env.MORE_SUBDEV1_OPERATOR_TTL_SECONDS === '') {
    return SUBDEV1_DEFAULT_TTL_SECONDS;
  }
  const value = Number(env.MORE_SUBDEV1_OPERATOR_TTL_SECONDS);
  return Number.isInteger(value)
    && value >= SUBDEV1_MIN_TTL_SECONDS
    && value <= SUBDEV1_MAX_TTL_SECONDS
    ? value
    : null;
}

function keyedHash(value, secret, domain) {
  if (!text(secret, 4096) || secret.length < 32 || !text(value, 8192)) return null;
  return crypto.createHmac('sha256', secret)
    .update(canonicalJson({ domain, value }))
    .digest('hex');
}

function timingSafeCodeMatch(submitted, expected) {
  if (typeof submitted !== 'string'
    || typeof expected !== 'string'
    || submitted.length < 1
    || submitted.length > 128
    || expected.length < 1
    || expected.length > 128) {
    return false;
  }
  const left = Buffer.from(submitted);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    crypto.timingSafeEqual(right, right);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function exactCookie(header, names) {
  const entries = String(header || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...rest] = part.split('=');
      return { name, value: rest.join('=') };
    })
    .filter((entry) => names.includes(entry.name));
  return entries.length === 1 && entries[0].value
    ? { ok: true, name: entries[0].name, value: entries[0].value }
    : { ok: false, value: '' };
}

export function readSubdev1OperatorCookies(cookieHeader = '') {
  const browser = exactCookie(cookieHeader, [
    SUBDEV1_LOCAL_BROWSER_COOKIE,
    SUBDEV1_SECURE_BROWSER_COOKIE,
  ]);
  const context = exactCookie(cookieHeader, [
    SUBDEV1_LOCAL_CONTEXT_COOKIE,
    SUBDEV1_SECURE_CONTEXT_COOKIE,
  ]);
  return frozen({
    browser: browser.ok ? browser.value : '',
    context: context.ok ? context.value : '',
    browser_valid: browser.ok,
    context_valid: context.ok,
  });
}

export function subdev1SecureCookieRequired({
  req,
  env = globalThis.process?.env || {},
} = {}) {
  const runtime = runtimeName(env);
  const forwarded = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return runtime === 'production'
    || runtime === 'preview'
    || runtime === 'staging'
    || forwarded === 'https';
}

function cookie(name, value, maxAge, secure) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function subdev1BrowserCookie(token, maxAge, context = {}) {
  const secure = subdev1SecureCookieRequired(context);
  return cookie(
    secure ? SUBDEV1_SECURE_BROWSER_COOKIE : SUBDEV1_LOCAL_BROWSER_COOKIE,
    token,
    maxAge,
    secure,
  );
}

export function subdev1ContextCookie(token, maxAge, context = {}) {
  const secure = subdev1SecureCookieRequired(context);
  return cookie(
    secure ? SUBDEV1_SECURE_CONTEXT_COOKIE : SUBDEV1_LOCAL_CONTEXT_COOKIE,
    token,
    maxAge,
    secure,
  );
}

export function clearSubdev1Cookies(context = {}) {
  const secure = subdev1SecureCookieRequired(context);
  return frozen([
    cookie(
      secure ? SUBDEV1_SECURE_CONTEXT_COOKIE : SUBDEV1_LOCAL_CONTEXT_COOKIE,
      '',
      0,
      secure,
    ),
    cookie(
      secure ? SUBDEV1_SECURE_BROWSER_COOKIE : SUBDEV1_LOCAL_BROWSER_COOKIE,
      '',
      0,
      secure,
    ),
  ]);
}

async function storeCall(store, method, input) {
  try {
    const value = await store?.[method]?.(input);
    return value && typeof value === 'object'
      ? frozen({ ok: true, value })
      : frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE', value: null });
  } catch {
    return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE', value: null });
  }
}

async function validateConfiguration(env, store) {
  if (env?.MORE_SUBDEV1_OPERATOR_ENABLED !== 'true') {
    return denial('OPERATOR_BRIDGE_DISABLED', 404);
  }
  const expectedCode = text(env.MORE_SUBDEV1_OPERATOR_CODE, 128);
  const secret = signingSecret(env);
  const envId = environmentId(env);
  const origins = allowedOrigins(env);
  const ttl = ttlSeconds(env);
  const storeValidation = validateSubdev1OperatorStore(store);
  const described = storeValidation.valid
    ? await storeCall(store, 'describe')
    : { ok: false, value: null };
  const description = described.ok ? described.value : null;
  if (!expectedCode
    || secret.length < 32
    || !opaque(envId)
    || origins.length < 1
    || ttl == null
    || !storeValidation.valid
    || description?.available !== true) {
    return denial('OPERATOR_BRIDGE_CONFIGURATION_INVALID', 503);
  }
  if (runtimeName(env) === 'production'
    && (description.deployment_grade !== true
      || description.shared_across_instances !== true
      || description.restart_durable !== true
      || description.no_local_fallback !== true)) {
    return denial('OPERATOR_BRIDGE_CONFIGURATION_INVALID', 503);
  }
  return frozen({
    ok: true,
    allowed: true,
    expected_code: expectedCode,
    signing_secret: secret,
    environment_id: envId,
    allowed_origins: origins,
    ttl_seconds: ttl,
  });
}

async function audit(store, {
  eventType,
  decision,
  code = null,
  occurredAt,
  contextRef = null,
  exactScopeHash = null,
}) {
  return storeCall(store, 'appendAudit', {
    event_type: eventType,
    decision,
    failure_code: code,
    occurred_at: occurredAt,
    context_ref: contextRef,
    exact_scope_hash: exactScopeHash,
  });
}

function privacySafeProfile(receipt) {
  if (!receipt) return null;
  return frozen({
    receipt_version: receipt.receipt_version,
    profile_id: receipt.profile_id,
    subscriber_subject_ref: receipt.subscriber_subject_ref,
    exact_scope: receipt.exact_scope,
    exact_scope_hash: receipt.exact_scope_hash,
    profile_revision: receipt.profile_revision,
    consent_ref: receipt.consent_ref,
    consent_purpose: receipt.consent_purpose,
    consent_status: receipt.consent_status,
    provenance: receipt.provenance,
    resolved_at: receipt.resolved_at,
    profile_generation: receipt.profile_generation,
    receipt_digest: receipt.receipt_digest,
  });
}

function sameAuthoritativeProfile(record, receipt) {
  return record?.profile_id === receipt?.profile_id
    && record?.subscriber_subject_ref === receipt?.subscriber_subject_ref
    && hashCanonicalJson(record?.exact_scope) === receipt?.exact_scope_hash
    && record?.profile_revision === receipt?.profile_revision
    && record?.consent_ref === receipt?.consent_ref
    && record?.consent_purpose === receipt?.consent_purpose
    && record?.consent_status === 'ACTIVE'
    && canonicalJson(record?.provenance) === canonicalJson(receipt?.provenance);
}

function profileSwitchReceipt({ prior, next, occurredAt }) {
  const receipt = {
    receipt_version: 'subdev1-profile-switch-receipt-v1',
    prior_exact_scope_hash: prior?.active_profile?.exact_scope_hash || null,
    next_exact_scope_hash: next.exact_scope_hash,
    prior_profile_session_closed: prior?.active_profile != null,
    profile_scoped_state_cleared_before_resolution: true,
    process_local_profile_cache_used: false,
    profile_generation: next.profile_generation,
    occurred_at: occurredAt,
  };
  return frozen({
    ...receipt,
    receipt_digest: hashCanonicalJson(receipt),
  });
}

export function createSubdev1OperatorBridge({
  env = globalThis.process?.env || {},
  store = new InMemorySubdev1OperatorBridgeStore(),
  profileRepository = createUnavailableSubdev1ProfileRepository(),
  clock = () => Date.now(),
  randomToken = () => crypto.randomBytes(32).toString('base64url'),
} = {}) {
  const resolver = createSubdev1AuthoritativeProfileResolver({
    repository: profileRepository,
  });

  async function configured() {
    return validateConfiguration(env, store);
  }

  function browserBindingHash(browserToken, config) {
    return keyedHash(browserToken, config.signing_secret, 'subdev1_browser_binding_v1');
  }

  function contextTokenHash(contextToken, config) {
    return keyedHash(contextToken, config.signing_secret, 'subdev1_context_token_v1');
  }

  function validateOrigin(request, config) {
    return evaluateRequestOrigin({
      request,
      allowed_origins: config.allowed_origins,
      require_origin: true,
    });
  }

  async function establishBrowser(browserToken = '') {
    const config = await configured();
    if (!config.ok) return config;
    const existing = text(browserToken, 4096);
    const token = existing.length >= 32 ? existing : randomToken();
    if (typeof token !== 'string' || token.length < 32) {
      return denial('OPERATOR_CONTEXT_INVALID', 503);
    }
    const bindingHash = browserBindingHash(token, config);
    if (!bindingHash) return denial('OPERATOR_CONTEXT_INVALID', 503);
    return frozen({
      ok: true,
      allowed: true,
      browser_token: token,
      browser_binding_hash: bindingHash,
      newly_issued: existing !== token,
      max_age: SUBDEV1_MAX_TTL_SECONDS,
    });
  }

  async function issueCsrf({
    request,
    browserToken,
    method = 'POST',
  }) {
    const config = await configured();
    if (!config.ok) return config;
    const origin = validateOrigin(request, config);
    if (!origin.allowed) return denial('ORIGIN_VALIDATION_FAILED', 403);
    const bindingHash = browserBindingHash(browserToken, config);
    if (!bindingHash) return denial('OPERATOR_BROWSER_BINDING_INVALID', 401);
    const proof = randomToken();
    const proofHash = hashCanonicalJson({
      domain: 'coach_connect_csrf',
      proof,
    });
    const issuedAt = clock();
    const record = {
      grant_id: `csrf_${proofHash.slice(0, 32)}`,
      proof_hash: proofHash,
      browser_binding_hash: bindingHash,
      method: String(method || '').toUpperCase(),
      route: SUBDEV1_OPERATOR_ROUTE,
      environment_id: config.environment_id,
      issued_at: nowIso(issuedAt),
      expires_at: nowIso(issuedAt + 300_000),
      status: 'ACTIVE',
    };
    if (!validateCsrfGrant(record).valid) {
      return denial('CSRF_VALIDATION_FAILED', 403);
    }
    const issued = await storeCall(store, 'issueCsrfGrant', record);
    return issued.ok && issued.value.ok
      ? frozen({ ok: true, allowed: true, csrf_proof: proof, method })
      : denial('CSRF_VALIDATION_FAILED', 403);
  }

  async function consumeCsrf({
    request,
    browserToken,
    proof,
    method,
    config,
  }) {
    const origin = validateOrigin(request, config);
    if (!origin.allowed) return denial('ORIGIN_VALIDATION_FAILED', 403);
    const bindingHash = browserBindingHash(browserToken, config);
    if (!bindingHash) return denial('OPERATOR_BROWSER_BINDING_INVALID', 401);
    if (typeof proof !== 'string' || proof.length < 24) {
      return denial('CSRF_VALIDATION_FAILED', 403);
    }
    const checked = await storeCall(store, 'consumeCsrfGrant', {
      proof_hash: hashCanonicalJson({
        domain: 'coach_connect_csrf',
        proof,
      }),
      browser_binding_hash: bindingHash,
      method: String(method || '').toUpperCase(),
      route: SUBDEV1_OPERATOR_ROUTE,
      environment_id: config.environment_id,
      now: clock(),
    });
    return checked.ok && checked.value.ok
      ? frozen({
          ok: true,
          allowed: true,
          browser_binding_hash: bindingHash,
          request_origin: origin.origin,
        })
      : denial('CSRF_VALIDATION_FAILED', 403);
  }

  async function readVerifiedContext({
    contextToken,
    browserToken,
    action = null,
    requireProfile = false,
    suppliedProfileReceipt = null,
  }) {
    const config = await configured();
    if (!config.ok) return config;
    const tokenHash = contextTokenHash(contextToken, config);
    const bindingHash = browserBindingHash(browserToken, config);
    if (!tokenHash || !bindingHash) {
      return denial('OPERATOR_CONTEXT_INVALID', 401, {
        diagnostic: {
          persistence_lookup: 'NOT_ATTEMPTED',
          failed_predicate_identifier: 'TOKEN_OR_BROWSER_HASH_INVALID',
          context_integrity: 'NOT_EVALUATED',
        },
      });
    }
    const lookup = await storeCall(store, 'getContextByTokenHash', tokenHash);
    const found = lookup.value;
    if (!lookup.ok || !found?.ok || found.status !== 'FOUND') {
      const unavailable = !lookup.ok || found?.code === 'OPERATOR_STORE_UNAVAILABLE';
      return denial(
        unavailable ? 'OPERATOR_STORE_UNAVAILABLE' : 'OPERATOR_CONTEXT_INVALID',
        unavailable ? 503 : 401,
        {
          diagnostic: {
            persistence_lookup: unavailable
              ? 'UNAVAILABLE'
              : found?.status === 'NOT_FOUND' ? 'MISS' : 'INVALID_RESPONSE',
            failed_predicate_identifier: unavailable
              ? 'OPERATOR_STORE_UNAVAILABLE'
              : 'CONTEXT_LOOKUP_MISS',
            context_integrity: 'NOT_EVALUATED',
          },
        },
      );
    }
    const checked = validateSubdev1OperatorContext(found.context, {
      signingSecret: config.signing_secret,
      environmentId: config.environment_id,
      browserBindingHash: bindingHash,
      tokenHash,
      action,
      now: clock(),
      requireProfile,
      suppliedProfileReceipt,
    });
    if (!checked.valid) {
      const firstError = checked.errors[0] || {};
      return denial(firstError.code || 'OPERATOR_CONTEXT_INVALID', 401, {
        diagnostic: {
          persistence_lookup: 'HIT',
          failed_predicate_identifier:
            `${firstError.code || 'OPERATOR_CONTEXT_INVALID'}:${firstError.field || 'unknown'}`,
          context_integrity: firstError.field === 'integrity_digest' ? 'FAIL' : 'NOT_PROVEN',
        },
      });
    }
    return frozen({
      ok: true,
      allowed: true,
      config,
      context: checked.value,
      token_hash: tokenHash,
      browser_binding_hash: bindingHash,
      diagnostic: {
        persistence_lookup: 'HIT',
        failed_predicate_identifier: null,
        context_integrity: 'PASS',
      },
    });
  }

  async function activate({
    request,
    browserToken,
    csrfProof,
    submittedCode,
  }) {
    const config = await configured();
    if (!config.ok) return config;
    const now = clock();
    const integrity = await consumeCsrf({
      request,
      browserToken,
      proof: csrfProof,
      method: 'POST',
      config,
    });
    if (!integrity.ok) {
      await audit(store, {
        eventType: 'SUBDEV1_OPERATOR_ACTIVATION_DENIED',
        decision: 'DENIED',
        code: integrity.code,
        occurredAt: nowIso(now),
      });
      return integrity;
    }
    const ratePolicies = [
      {
        key: hashCanonicalJson({
          domain: 'subdev1_operator_activation_rate_browser',
          environment_id: config.environment_id,
          browser_binding_hash: integrity.browser_binding_hash,
        }),
        limit: 5,
      },
      {
        key: hashCanonicalJson({
          domain: 'subdev1_operator_activation_rate_origin',
          environment_id: config.environment_id,
          origin: integrity.request_origin,
        }),
        limit: 30,
      },
    ];
    for (const policy of ratePolicies) {
      const rateCall = await storeCall(store, 'rateLimit', {
        key: policy.key,
        now,
        window_ms: 60_000,
        limit: policy.limit,
      });
      const rate = rateCall.value;
      if (!rateCall.ok || !rate?.ok) {
        return denial(
          rate?.code || 'OPERATOR_STORE_UNAVAILABLE',
          rate?.code === 'OPERATOR_RATE_LIMITED' ? 429 : 503,
          { retry_after_ms: rate?.retry_after_ms },
        );
      }
    }
    if (!timingSafeCodeMatch(submittedCode, config.expected_code)) {
      await audit(store, {
        eventType: 'SUBDEV1_OPERATOR_ACTIVATION_DENIED',
        decision: 'DENIED',
        code: 'OPERATOR_CODE_INVALID',
        occurredAt: nowIso(now),
      });
      return denial('OPERATOR_CODE_INVALID', 401);
    }
    const rawContextToken = randomToken();
    if (typeof rawContextToken !== 'string' || rawContextToken.length < 32) {
      return denial('OPERATOR_CONTEXT_INVALID', 503);
    }
    const tokenHash = contextTokenHash(rawContextToken, config);
    const contextId = `subdev1_context_${tokenHash.slice(0, 32)}`;
    const issuedAt = nowIso(now);
    const expiresAt = nowIso(now + config.ttl_seconds * 1000);
    const created = createSubdev1OperatorContext({
      contextId,
      tokenHash,
      environmentId: config.environment_id,
      browserBindingHash: integrity.browser_binding_hash,
      issuedAt,
      expiresAt,
      signingSecret: config.signing_secret,
    });
    if (!created.ok) return denial(created.code, 503);
    const audited = await audit(store, {
      eventType: 'SUBDEV1_OPERATOR_CONTEXT_ISSUANCE_APPROVED',
      decision: 'ALLOWED',
      occurredAt: issuedAt,
      contextRef: contextId,
    });
    if (!audited.ok || !audited.value.ok) {
      return denial('OPERATOR_STORE_UNAVAILABLE', 503);
    }
    const saved = await storeCall(store, 'saveContext', created.context);
    if (!saved.ok || !saved.value.ok) {
      return denial(saved.value?.code || 'OPERATOR_STORE_UNAVAILABLE', 503);
    }
    return frozen({
      ok: true,
      allowed: true,
      context_token: rawContextToken,
      context_id: contextId,
      issued_at: issuedAt,
      expires_at: expiresAt,
      max_age: config.ttl_seconds,
      capability_scope: created.context.capability_scope,
      profile_state: created.context.profile_state,
    });
  }

  async function selectProfile({
    request,
    browserToken,
    contextToken,
    csrfProof,
    profileId,
  }) {
    const config = await configured();
    if (!config.ok) return config;
    const integrity = await consumeCsrf({
      request,
      browserToken,
      proof: csrfProof,
      method: 'POST',
      config,
    });
    if (!integrity.ok) return integrity;
    const verified = await readVerifiedContext({
      contextToken,
      browserToken,
      action: 'SELECT_PROFILE',
    });
    if (!verified.ok) return verified;
    const prior = verified.context;
    const nextGeneration = prior.profile_generation + 1;
    const pending = withSubdev1ContextIntegrity({
      ...prior,
      profile_state: 'RESOLUTION_PENDING',
      profile_generation: nextGeneration,
      active_profile: null,
    }, config.signing_secret);
    const clearedCall = await storeCall(store, 'replaceContext', {
      token_hash: verified.token_hash,
      expected_profile_generation: prior.profile_generation,
      context: pending,
    });
    if (!clearedCall.ok || !clearedCall.value.ok) {
      return denial(clearedCall.value?.code || 'OPERATOR_STORE_UNAVAILABLE', 503);
    }

    const resolution = await resolver.resolve(profileId);
    if (!resolution.allowed) {
      const deniedContext = withSubdev1ContextIntegrity({
        ...pending,
        profile_state: 'RESOLUTION_DENIED',
        active_profile: null,
      }, config.signing_secret);
      await storeCall(store, 'replaceContext', {
        token_hash: verified.token_hash,
        expected_profile_generation: nextGeneration,
        context: deniedContext,
      });
      await audit(store, {
        eventType: 'SUBDEV1_PROFILE_RESOLUTION_DENIED',
        decision: 'DENIED',
        code: resolution.code,
        occurredAt: nowIso(clock()),
        contextRef: prior.context_id,
      });
      return denial('PROFILE_RESOLUTION_DENIED', 404);
    }

    const receiptResult = createSubdev1ProfileReceipt({
      record: resolution.record,
      profileGeneration: nextGeneration,
      resolvedAt: nowIso(clock()),
      signingSecret: config.signing_secret,
    });
    if (!receiptResult.ok) return denial(receiptResult.code, 403);
    const active = withSubdev1ContextIntegrity({
      ...pending,
      profile_state: 'PROFILE_ACTIVE',
      active_profile: receiptResult.receipt,
    }, config.signing_secret);
    const audited = await audit(store, {
      eventType: 'SUBDEV1_PROFILE_RESOLUTION_APPROVED',
      decision: 'ALLOWED',
      occurredAt: receiptResult.receipt.resolved_at,
      contextRef: prior.context_id,
      exactScopeHash: receiptResult.receipt.exact_scope_hash,
    });
    if (!audited.ok || !audited.value.ok) {
      return denial('OPERATOR_STORE_UNAVAILABLE', 503);
    }
    const activatedCall = await storeCall(store, 'replaceContext', {
      token_hash: verified.token_hash,
      expected_profile_generation: nextGeneration,
      context: active,
    });
    if (!activatedCall.ok || !activatedCall.value.ok) {
      return denial(activatedCall.value?.code || 'OPERATOR_STORE_UNAVAILABLE', 503);
    }
    return frozen({
      ok: true,
      allowed: true,
      context_id: prior.context_id,
      profile_state: 'PROFILE_ACTIVE',
      profile_receipt: privacySafeProfile(receiptResult.receipt),
      profile_switch_receipt: profileSwitchReceipt({
        prior,
        next: receiptResult.receipt,
        occurredAt: receiptResult.receipt.resolved_at,
      }),
    });
  }

  async function inspect({
    contextToken,
    browserToken,
  }) {
    const verified = await readVerifiedContext({ contextToken, browserToken });
    if (!verified.ok) {
      return frozen({
        ok: true,
        allowed: false,
        active: false,
        code: verified.code,
        profile_state: 'NO_PROFILE',
        profile_receipt: null,
        diagnostic: verified.diagnostic || null,
      });
    }
    return frozen({
      ok: true,
      allowed: true,
      active: true,
      context_id: verified.context.context_id,
      capability_scope: verified.context.capability_scope,
      issued_at: verified.context.issued_at,
      expires_at: verified.context.expires_at,
      profile_state: verified.context.profile_state,
      profile_receipt: privacySafeProfile(verified.context.active_profile),
      stripe_authority: false,
      coach_authority: false,
      canonical_identity_authority: false,
      diagnostic: verified.diagnostic || null,
    });
  }

  async function clear({
    request,
    browserToken,
    contextToken,
    csrfProof,
  }) {
    const config = await configured();
    if (!config.ok) return config;
    const integrity = await consumeCsrf({
      request,
      browserToken,
      proof: csrfProof,
      method: 'DELETE',
      config,
    });
    if (!integrity.ok) return integrity;
    const verified = await readVerifiedContext({ contextToken, browserToken });
    if (!verified.ok) return verified;
    const clearedAt = nowIso(clock());
    const next = withSubdev1ContextIntegrity({
      ...verified.context,
      status: 'CLEARED',
      revoked_at: clearedAt,
      revocation_reason: 'USER_CLEARED',
      profile_state: 'PROFILE_CLEARED',
      profile_generation: verified.context.profile_generation + 1,
      active_profile: null,
    }, config.signing_secret);
    const saved = await storeCall(store, 'replaceContext', {
      token_hash: verified.token_hash,
      expected_profile_generation: verified.context.profile_generation,
      context: next,
    });
    if (!saved.ok || !saved.value.ok) {
      return denial(saved.value?.code || 'OPERATOR_STORE_UNAVAILABLE', 503);
    }
    await audit(store, {
      eventType: 'SUBDEV1_OPERATOR_CONTEXT_CLEARED',
      decision: 'ALLOWED',
      occurredAt: clearedAt,
      contextRef: verified.context.context_id,
    });
    return frozen({ ok: true, allowed: false, cleared: true });
  }

  async function revoke({
    contextToken,
    browserToken,
    reasonCode = 'ADMINISTRATIVE_REVOCATION',
  }) {
    const verified = await readVerifiedContext({ contextToken, browserToken });
    if (!verified.ok) return verified;
    if (!opaque(reasonCode)) return denial('OPERATOR_CONTEXT_INVALID', 400);
    const revokedAt = nowIso(clock());
    const next = withSubdev1ContextIntegrity({
      ...verified.context,
      status: 'REVOKED',
      revoked_at: revokedAt,
      revocation_reason: reasonCode,
      profile_state: 'PROFILE_CLEARED',
      profile_generation: verified.context.profile_generation + 1,
      active_profile: null,
    }, verified.config.signing_secret);
    const saved = await storeCall(store, 'replaceContext', {
      token_hash: verified.token_hash,
      expected_profile_generation: verified.context.profile_generation,
      context: next,
    });
    return saved.ok && saved.value.ok
      ? frozen({ ok: true, allowed: false, revoked: true })
      : denial(saved.value?.code || 'OPERATOR_STORE_UNAVAILABLE', 503);
  }

  async function consume({
    contextToken,
    browserToken,
    action,
    profileReceipt = null,
  }) {
    const requireProfile = action !== 'SELECT_PROFILE';
    const verified = await readVerifiedContext({
      contextToken,
      browserToken,
      action,
      requireProfile,
      suppliedProfileReceipt: profileReceipt,
    });
    if (!verified.ok) return verified;
    const profile = verified.context.active_profile;
    if (requireProfile) {
      const current = await resolver.resolve(profile.profile_id);
      if (!current.allowed || !sameAuthoritativeProfile(current.record, profile)) {
        const invalidated = withSubdev1ContextIntegrity({
          ...verified.context,
          profile_state: 'RESOLUTION_DENIED',
          profile_generation: verified.context.profile_generation + 1,
          active_profile: null,
        }, verified.config.signing_secret);
        await storeCall(store, 'replaceContext', {
          token_hash: verified.token_hash,
          expected_profile_generation: verified.context.profile_generation,
          context: invalidated,
        });
        await audit(store, {
          eventType: 'SUBDEV1_PROFILE_USE_TIME_REVALIDATION_DENIED',
          decision: 'DENIED',
          code: 'PROFILE_RESOLUTION_DENIED',
          occurredAt: nowIso(clock()),
          contextRef: verified.context.context_id,
        });
        return denial('PROFILE_RESOLUTION_DENIED', 403);
      }
    }
    return frozen({
      ok: true,
      allowed: true,
      context_version: verified.context.context_version,
      context_id: verified.context.context_id,
      source: 'temporary_internal_beta_operator_context',
      capability_scope: verified.context.capability_scope,
      action,
      expires_at: verified.context.expires_at,
      profile_state: verified.context.profile_state,
      subscriber_subject_ref: profile?.subscriber_subject_ref || null,
      exact_scope: profile?.exact_scope || null,
      exact_scope_hash: profile?.exact_scope_hash || null,
      profile_revision: profile?.profile_revision || null,
      consent_ref: profile?.consent_ref || null,
      consent_purpose: profile?.consent_purpose || null,
      provenance: profile?.provenance || null,
      profile_generation: verified.context.profile_generation,
      paid_entitlement: false,
      stripe_authority: false,
      billing_authority: false,
      coach_authority: false,
      canonical_identity_authority: false,
      canonical_mutation_authority: false,
      deployment_authority: false,
      environment_authority: false,
      provider_authority: false,
    });
  }

  async function contextIntegrity(context) {
    const config = await configured();
    return config.ok
      ? subdev1OperatorContextDigest(context, config.signing_secret)
      : null;
  }

  return Object.freeze({
    bridge_version: 'subdev1-operator-bridge-v1',
    architecture_version: 'subdev1-operator-bridge-architecture-v1.1',
    source_default_off: true,
    customer_independent: true,
    canonical_identity: false,
    paid_entitlement: false,
    coach_authority: false,
    configured,
    establishBrowser,
    issueCsrf,
    activate,
    selectProfile,
    inspect,
    clear,
    revoke,
    consume,
    contextIntegrity,
  });
}

export function createSubdev1OperatorContextConsumer(options = {}) {
  const bridge = createSubdev1OperatorBridge(options);
  return Object.freeze({
    consumer_version: 'subdev1-private-runtime-consumer-v1',
    canonical_session_replacement: false,
    subscription_only: true,
    consume: bridge.consume,
  });
}
