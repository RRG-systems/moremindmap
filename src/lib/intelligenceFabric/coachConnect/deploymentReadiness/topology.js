import { CONTRACT_VERSIONS, ROUTE_CLASSES } from './constants.js';
import {
  canonicalDigest,
  isObject,
  isSha256,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export function topologyDigest(value) {
  return canonicalDigest(value, ['topology_digest']);
}

export function validateTopology(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'TOPOLOGY_UNVERIFIED', field: '$' }], value);
  requireVersion(errors, value, 'topology_contract_version', 'topology');
  requireFields(errors, value, [
    'deployment_adapter_class', 'selected_initial_target', 'target_reference_hash',
    'target_isolated', 'existing_public_project_excluded',
    'global_edge_access_required', 'named_identity_required', 'mfa_required',
    'upstream_proxy_permitted', 'custom_domain_permitted', 'public_alias_permitted',
    'route_classes', 'region_policy_ref', 'live_inspection_performed', 'status',
  ], 'TOPOLOGY_UNVERIFIED');
  if (value.deployment_adapter_class !== 'PROVIDER_SPECIFIC_DEPLOYMENT_ADAPTER'
    || value.selected_initial_target !== 'VERCEL'
    || !isSha256(value.target_reference_hash)) {
    errors.push({ code: 'TOPOLOGY_UNVERIFIED', field: 'adapter' });
  }
  for (const [field, expected] of Object.entries({
    target_isolated: true,
    existing_public_project_excluded: true,
    global_edge_access_required: true,
    named_identity_required: true,
    mfa_required: true,
    upstream_proxy_permitted: false,
    custom_domain_permitted: false,
    public_alias_permitted: false,
    live_inspection_performed: false,
  })) {
    if (value[field] !== expected) errors.push({
      code: field === 'existing_public_project_excluded'
        ? 'EXISTING_PUBLIC_PROJECT_PROHIBITED'
        : field.includes('domain') || field.includes('alias')
          ? 'PUBLIC_ACCESS_POSSIBLE'
          : 'OUTER_ACCESS_POLICY_REQUIRED',
      field,
    });
  }
  if (!isObject(value.route_classes)
    || ROUTE_CLASSES.some((route) => value.route_classes[route] !== 'OUTER_ACCESS_DENIED')) {
    errors.push({ code: 'ROUTE_COVERAGE_INCOMPLETE', field: 'route_classes' });
  }
  if (value.status !== 'VALIDATED_OFFLINE') errors.push({ code: 'TOPOLOGY_UNVERIFIED', field: 'status' });
  return validationResult(errors, value);
}

export function createOfflineTopology(overrides = {}) {
  return Object.freeze({
    topology_contract_version: CONTRACT_VERSIONS.topology,
    deployment_adapter_class: 'PROVIDER_SPECIFIC_DEPLOYMENT_ADAPTER',
    selected_initial_target: 'VERCEL',
    target_reference_hash: 'c'.repeat(64),
    target_isolated: true,
    existing_public_project_excluded: true,
    global_edge_access_required: true,
    named_identity_required: true,
    mfa_required: true,
    upstream_proxy_permitted: false,
    custom_domain_permitted: false,
    public_alias_permitted: false,
    route_classes: Object.fromEntries(ROUTE_CLASSES.map((route) => [route, 'OUTER_ACCESS_DENIED'])),
    region_policy_ref: 'region-policy-unresolved-no-deployment',
    live_inspection_performed: false,
    status: 'VALIDATED_OFFLINE',
    ...overrides,
  });
}
