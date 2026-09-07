/* global process */

const CANONICAL_PRODUCTION_ORIGIN = 'https://moremindmap.com';

function normalizedOrigin(value, code) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(code);
  }
  const loopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if ((parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:'))
    || parsed.username
    || parsed.password
    || parsed.pathname !== '/'
    || parsed.search
    || parsed.hash) {
    throw new Error(code);
  }
  return parsed.origin;
}

function vercelHostname(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw.includes('://') || raw.includes('/') || raw.includes('@')) {
    throw new Error('public_vercel_origin_invalid');
  }
  let parsed;
  try {
    parsed = new URL(`https://${raw}`);
  } catch {
    throw new Error('public_vercel_origin_invalid');
  }
  if (parsed.hostname !== raw || !parsed.hostname.endsWith('.vercel.app') || parsed.port) {
    throw new Error('public_vercel_origin_invalid');
  }
  return parsed.hostname;
}

export function resolveVercelDeploymentOrigin(env = process.env) {
  if (!String(env.VERCEL_URL || '').trim()) return '';
  return `https://${vercelHostname(env.VERCEL_URL)}`;
}

export function resolvePublicSiteOrigin(env = process.env) {
  // VERCEL_URL is provider-owned deployment metadata. Prefer it in Preview so
  // Checkout never redirects a canary customer to the Production alias.
  if (String(env.VERCEL_ENV || '').toLowerCase() === 'preview') {
    const previewOrigin = resolveVercelDeploymentOrigin(env);
    if (previewOrigin) {
      if (String(env.PUBLIC_SITE_URL || '').trim()
        && normalizedOrigin(env.PUBLIC_SITE_URL, 'public_site_origin_invalid') !== previewOrigin) {
        throw new Error('public_site_preview_origin_mismatch');
      }
      return previewOrigin;
    }
  }

  if (String(env.PUBLIC_SITE_URL || '').trim()) {
    return normalizedOrigin(env.PUBLIC_SITE_URL, 'public_site_origin_invalid');
  }

  if (String(env.SITE_URL || '').trim()) {
    return normalizedOrigin(env.SITE_URL, 'public_site_origin_invalid');
  }

  if (String(env.VERCEL_PROJECT_PRODUCTION_URL || '').trim()) {
    return `https://${vercelHostname(env.VERCEL_PROJECT_PRODUCTION_URL)}`;
  }

  const deploymentOrigin = resolveVercelDeploymentOrigin(env);
  return deploymentOrigin || CANONICAL_PRODUCTION_ORIGIN;
}

export function resolvePublicSiteAllowedOrigins(env = process.env) {
  const configured = String(env.PUBLIC_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizedOrigin(value, 'public_allowed_origin_invalid'));
  return [...new Set([...configured, resolvePublicSiteOrigin(env)])];
}

export const PUBLIC_SITE_ORIGIN_CONTRACT = Object.freeze({
  canonical_production_origin: CANONICAL_PRODUCTION_ORIGIN,
  request_host_is_authority: false,
  preview_source: 'VERCEL_URL',
});
