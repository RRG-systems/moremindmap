import crypto from 'node:crypto';
import net from 'node:net';
import { deepFreeze } from '../../validation.js';
import { PRODUCTION_SECURITY_POLICY_VERSIONS } from './constants.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export function createRatifiedTrustedProxyPolicy({
  environment_id,
  exact_project_reference,
} = {}) {
  if (!environment_id || !exact_project_reference) {
    return frozen({ ok: false, code: 'TRUSTED_PROXY_POLICY_UNAPPROVED' });
  }
  return frozen({
    ok: true,
    policy: {
      proxy_policy_id: 'vercel-single-edge-trust-v1',
      environment_id,
      trusted_peer_rules: [{
        edge: 'VERCEL',
        exact_project_reference,
        upstream_proxy_allowed: false,
        platform_metadata_required: true,
      }],
      forwarded_header_order: ['x-vercel-forwarded-for'],
      maximum_chain_length: 1,
      private_reserved_policy: 'TELEMETRY_BUCKET_ONLY_NEVER_AUTHORITY',
      ipv4_mapped_ipv6_policy: 'NORMALIZE_TO_IPV4',
      client_address_use: ['TELEMETRY', 'RATE_CONTROL'],
      authorization_input: false,
      raw_address_audit_allowed: false,
      status: 'APPROVED',
      policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.transport_trust,
      live_deployment_proven: false,
    },
  });
}

function normalizeAddress(value) {
  if (typeof value !== 'string') return null;
  let candidate = value.trim();
  if (candidate.startsWith('::ffff:')) candidate = candidate.slice(7);
  const version = net.isIP(candidate);
  return version ? { value: candidate.toLowerCase(), version } : null;
}

function networkClass(address) {
  if (!address) return 'INVALID';
  const value = address.value;
  if (address.version === 4) {
    if (value.startsWith('10.')
      || value.startsWith('127.')
      || value.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(value)
      || value.startsWith('169.254.')) return 'PRIVATE_OR_RESERVED';
  } else if (value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) {
    return 'PRIVATE_OR_RESERVED';
  }
  return 'PUBLIC';
}

export function resolveTrustedClientAddress({
  policy,
  connection_metadata,
  forwarded_headers = {},
  platform_contract_verified = false,
  privacy_hmac_key = '',
  proof_class = 'STATIC_ONLY',
}) {
  const base = {
    resolution: 'UNAVAILABLE',
    privacy_safe_network_bucket: null,
    chain_length: 0,
    trusted_hop_count: 0,
    reason_code: 'DEPLOYMENT_SHAPED_PROOF_REQUIRED',
    policy_version: policy?.policy_version || null,
    raw_address_included: false,
    authorization_input: false,
    proof_class,
  };
  if (!policy || policy.status !== 'APPROVED') {
    return frozen({ ...base, reason_code: 'TRUSTED_PROXY_POLICY_UNAPPROVED' });
  }
  const suppliedChain = String(forwarded_headers['x-forwarded-for'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!connection_metadata?.platform_attested && suppliedChain.length) {
    return frozen({
      ...base,
      resolution: 'AMBIGUOUS',
      chain_length: suppliedChain.length,
      reason_code: 'UNTRUSTED_FORWARDED_HEADER',
    });
  }
  if (!platform_contract_verified
    || connection_metadata?.source !== 'VERCEL_EDGE'
    || connection_metadata?.project_reference !== policy.trusted_peer_rules[0].exact_project_reference
    || connection_metadata?.upstream_proxy_present === true) {
    return frozen({ ...base, reason_code: 'VERCEL_ATTESTATION_UNVERIFIED' });
  }
  const attestedValues = Array.isArray(connection_metadata.client_address_chain)
    ? connection_metadata.client_address_chain
    : [];
  if (attestedValues.length !== 1 || attestedValues.length > policy.maximum_chain_length) {
    return frozen({
      ...base,
      resolution: 'AMBIGUOUS',
      chain_length: attestedValues.length,
      reason_code: 'CLIENT_ADDRESS_CHAIN_AMBIGUOUS',
    });
  }
  const normalized = normalizeAddress(attestedValues[0]);
  if (!normalized || typeof privacy_hmac_key !== 'string' || privacy_hmac_key.length < 32) {
    return frozen({
      ...base,
      resolution: normalized ? 'UNAVAILABLE' : 'AMBIGUOUS',
      chain_length: attestedValues.length,
      reason_code: normalized ? 'PRIVACY_KEY_UNAVAILABLE' : 'CLIENT_ADDRESS_INVALID',
    });
  }
  const bucket = crypto.createHmac('sha256', privacy_hmac_key)
    .update(`coach-connect-network-bucket-v1:${normalized.version}:${normalized.value}`)
    .digest('hex');
  return frozen({
    ...base,
    resolution: 'VERIFIED',
    privacy_safe_network_bucket: `${networkClass(normalized)}:${bucket.slice(0, 24)}`,
    chain_length: 1,
    trusted_hop_count: 1,
    reason_code: null,
    live_deployment_certified: false,
  });
}
