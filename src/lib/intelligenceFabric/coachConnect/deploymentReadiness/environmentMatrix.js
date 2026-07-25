import { CONTRACT_VERSIONS, ENVIRONMENT_CLASSES } from './constants.js';
import {
  isObject,
  isOpaque,
  requireFields,
  requireVersion,
  validationResult,
} from './contracts.js';

export const ENVIRONMENT_MATRIX = Object.freeze({
  LOCAL: Object.freeze({ network_posture: 'LOOPBACK_ONLY', outer_access_required: false }),
  CI: Object.freeze({ network_posture: 'NETWORK_DENIED', outer_access_required: false }),
  PREVIEW: Object.freeze({ network_posture: 'DISABLED_UNLESS_SEPARATELY_AUTHORIZED', outer_access_required: true }),
  INTERNAL_STAGING: Object.freeze({ network_posture: 'GLOBAL_EDGE_IDENTITY_REQUIRED', outer_access_required: true }),
  INTERNAL_PRODUCTION_SHAPED: Object.freeze({ network_posture: 'GLOBAL_EDGE_IDENTITY_REQUIRED', outer_access_required: true }),
  FUTURE_PUBLIC_PRODUCTION: Object.freeze({ network_posture: 'NOT_IMPLEMENTABLE_IN_THIS_CAMPAIGN', outer_access_required: true }),
});

export function validateEnvironment(value) {
  const errors = [];
  if (!isObject(value)) return validationResult([{ code: 'ENVIRONMENT_UNVERIFIED', field: '$' }], value);
  requireVersion(errors, value, 'environment_contract_version', 'environment');
  requireFields(errors, value, [
    'environment_id', 'environment_class', 'network_posture',
    'inbound_route_permitted', 'outer_access_required',
    'public_access_permitted', 'hosted_preview_permitted', 'synthetic_only',
    'customer_data_permitted', 'live_dependencies_permitted',
    'application_secrets_permitted', 'status',
  ], 'ENVIRONMENT_UNVERIFIED');
  if (!isOpaque(value.environment_id)) errors.push({ code: 'ENVIRONMENT_UNVERIFIED', field: 'environment_id' });
  if (!ENVIRONMENT_CLASSES.includes(value.environment_class)) {
    errors.push({ code: 'ENVIRONMENT_UNVERIFIED', field: 'environment_class' });
  }
  const expected = ENVIRONMENT_MATRIX[value.environment_class];
  if (expected && value.network_posture !== expected.network_posture) errors.push({ code: 'ENVIRONMENT_UNVERIFIED', field: 'network_posture' });
  if (expected && value.outer_access_required !== expected.outer_access_required) errors.push({ code: 'OUTER_ACCESS_POLICY_REQUIRED', field: 'outer_access_required' });
  for (const key of [
    'inbound_route_permitted', 'public_access_permitted', 'hosted_preview_permitted',
    'customer_data_permitted', 'live_dependencies_permitted', 'application_secrets_permitted',
  ]) {
    if (value[key] !== false) errors.push({ code: 'PUBLIC_ACCESS_POSSIBLE', field: key });
  }
  if (value.synthetic_only !== true || value.status !== 'VALIDATED_OFFLINE') {
    errors.push({ code: 'ENVIRONMENT_UNVERIFIED', field: 'status' });
  }
  return validationResult(errors, value);
}

export function createOfflineEnvironment(environmentClass, environmentId) {
  const matrix = ENVIRONMENT_MATRIX[environmentClass];
  if (!matrix) return null;
  return Object.freeze({
    environment_contract_version: CONTRACT_VERSIONS.environment,
    environment_id: environmentId,
    environment_class: environmentClass,
    network_posture: matrix.network_posture,
    inbound_route_permitted: false,
    outer_access_required: matrix.outer_access_required,
    public_access_permitted: false,
    hosted_preview_permitted: false,
    synthetic_only: true,
    customer_data_permitted: false,
    live_dependencies_permitted: false,
    application_secrets_permitted: false,
    status: 'VALIDATED_OFFLINE',
  });
}
