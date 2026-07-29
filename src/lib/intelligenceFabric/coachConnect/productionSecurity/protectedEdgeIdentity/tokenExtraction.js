import { deepFreeze } from '../../../validation.js';
import {
  PROTECTED_EDGE_TOKEN_SOURCES,
} from './contracts.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const deny = (code) => frozen({
  ok: false,
  allowed: false,
  code,
  serialized: null,
  raw_token_logged: false,
});

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return null;
  const exact = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(exact)) return exact.length === 1 ? exact[0] : Symbol.for('duplicate');
  return exact ?? null;
}

function queryContainsIdentityMaterial(req) {
  const forbidden = new Set([
    'token',
    'id_token',
    'access_token',
    'identity_token',
    'assertion',
  ]);
  if (req?.query && typeof req.query === 'object'
    && Object.keys(req.query).some((key) => forbidden.has(String(key).toLowerCase()))) {
    return true;
  }
  try {
    const url = new URL(req?.url || '/', 'https://protected-edge.invalid');
    return [...url.searchParams.keys()]
      .some((key) => forbidden.has(String(key).toLowerCase()));
  } catch {
    return false;
  }
}

function boundedJwt(value) {
  return typeof value === 'string'
    && value.length >= 64
    && value.length <= 16384
    && value.split('.').length === 3
    && !/[\r\n\0\s]/.test(value);
}

export function extractProtectedEdgeUpstreamTokenV1(req, {
  tokenSource,
} = {}) {
  if (!PROTECTED_EDGE_TOKEN_SOURCES.includes(tokenSource)) {
    return deny('PROTECTED_EDGE_PROVIDER_UNSUPPORTED');
  }
  if (queryContainsIdentityMaterial(req)) {
    return deny('PROTECTED_EDGE_QUERY_TOKEN_REJECTED');
  }
  const internal = headerValue(req?.headers, 'x-more-protected-edge-assertion');
  if (internal != null) return deny('PROTECTED_EDGE_INTERNAL_ASSERTION_SPOOFED');

  const passport = headerValue(req?.headers, 'x-vercel-oidc-passport-token');
  const authorization = headerValue(req?.headers, 'authorization');
  if (passport === Symbol.for('duplicate') || authorization === Symbol.for('duplicate')) {
    return deny('PROTECTED_EDGE_TOKEN_SOURCE_CONFLICT');
  }

  const authorizationCarriesBearer = typeof authorization === 'string'
    && /^Bearer\s+/i.test(authorization);
  if (passport != null && authorizationCarriesBearer) {
    return deny('PROTECTED_EDGE_TOKEN_SOURCE_CONFLICT');
  }

  let serialized = null;
  if (tokenSource === 'X_VERCEL_OIDC_PASSPORT_TOKEN') {
    if (passport == null) return deny('PROTECTED_EDGE_TOKEN_MISSING');
    serialized = passport;
  } else {
    if (authorization == null) return deny('PROTECTED_EDGE_TOKEN_MISSING');
    const match = typeof authorization === 'string'
      ? authorization.match(/^Bearer ([^\s]+)$/)
      : null;
    if (!match) return deny('PROTECTED_EDGE_TOKEN_MALFORMED');
    serialized = match[1];
  }
  if (!boundedJwt(serialized)) return deny('PROTECTED_EDGE_TOKEN_MALFORMED');
  return Object.freeze({
    ok: true,
    allowed: false,
    code: null,
    serialized,
    source: tokenSource,
    raw_token_logged: false,
  });
}
