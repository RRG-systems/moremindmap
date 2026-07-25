import { deepFreeze } from '../../validation.js';
import { evaluateProductionSecurityActivation } from './activation.js';
import { PRODUCTION_SECURITY_POLICY_VERSIONS } from './constants.js';

const frozen = (value) => deepFreeze(structuredClone(value));

export const RATIFIED_HSTS_STAGES = deepFreeze([
  { stage: 'CANARY', max_age_seconds: 300 },
  { stage: 'OBSERVED', max_age_seconds: 86_400 },
  { stage: 'TARGET', max_age_seconds: 31_536_000 },
]);

export function createRatifiedTransportEnvironmentPolicy({
  environment_id,
  exact_host_allowlist,
  trusted_proxy_policy_id = 'vercel-single-edge-trust-v1',
} = {}) {
  const hosts = Array.isArray(exact_host_allowlist)
    ? [...new Set(exact_host_allowlist.map((host) => String(host).trim().toLowerCase()).filter(Boolean))]
    : [];
  if (!environment_id || !hosts.length) {
    return frozen({ ok: false, code: 'HSTS_POLICY_UNAPPROVED' });
  }
  return frozen({
    ok: true,
    policy: {
      environment_id,
      environment_class: 'PRODUCTION',
      exact_host_allowlist: hosts,
      verified_https_termination: true,
      trusted_proxy_policy_id,
      hsts: {
        enabled: true,
        stages: RATIFIED_HSTS_STAGES,
        include_subdomains: false,
        preload: false,
      },
      emergency_disabled: false,
      status: 'APPROVED',
      policy_version: PRODUCTION_SECURITY_POLICY_VERSIONS.transport_trust,
      live_deployment_enabled: false,
    },
  });
}

export function evaluateSyntheticHstsPolicy({
  policy,
  request_context,
  client_address_resolution,
  flags,
  stage = 'CANARY',
}) {
  const activation = evaluateProductionSecurityActivation({
    flags,
    capability: 'TRANSPORT_POLICY',
  });
  const deny = (code) => frozen({
    emit: false,
    code,
    header_name: null,
    header_value: null,
    proof_class: 'SYNTHETIC_ONLY',
    deployment_action: false,
    production_header_emitted: false,
  });
  if (!activation.allowed) return deny('PRODUCTION_PREREQUISITE_INACTIVE');
  if (!policy || policy.status !== 'APPROVED' || policy.hsts?.enabled !== true || policy.emergency_disabled === true) {
    return deny('HSTS_POLICY_UNAPPROVED');
  }
  if (request_context?.actual_production_traffic === true
    || request_context?.proof_class !== 'SYNTHETIC_DEPLOYMENT_SHAPED'
    || request_context?.environment_id !== policy.environment_id
    || request_context?.environment_class !== 'PRODUCTION'
    || !policy.exact_host_allowlist.includes(String(request_context?.host || '').toLowerCase())) {
    return deny('HSTS_POLICY_UNAPPROVED');
  }
  if (request_context?.https_termination_verified !== true
    || request_context?.protocol !== 'https') return deny('HTTPS_TERMINATION_UNVERIFIED');
  if (client_address_resolution?.resolution !== 'VERIFIED'
    || client_address_resolution.policy_version !== policy.policy_version) {
    return deny('TRUSTED_PROXY_POLICY_UNAPPROVED');
  }
  const selected = policy.hsts.stages.find((item) => item.stage === stage);
  if (!selected) return deny('HSTS_POLICY_UNAPPROVED');
  return frozen({
    emit: true,
    code: null,
    header_name: 'Strict-Transport-Security',
    header_value: `max-age=${selected.max_age_seconds}`,
    stage,
    include_subdomains: false,
    preload: false,
    proof_class: 'SYNTHETIC_DEPLOYMENT_SHAPED',
    deployment_action: false,
    production_header_emitted: false,
  });
}
