import { deepFreeze } from '../../validation.js';

export const DEFAULT_PRIVATE_RUNTIME_FLAGS = deepFreeze({
  private_runtime_enabled: false,
  private_runtime_environment_allowlist: [],
  private_runtime_subject_allowlist: [],
  private_runtime_scope_allowlist: [],
  subject_resolution_enabled: false,
  shared_security_state_enabled: false,
  subdev1_enabled: false,
  subscription_runtime_private_enabled: false,
  coach_connect_private_enabled: false,
  private_test_writes_enabled: false,
  live_model_provider_enabled: false,
  live_media_provider_enabled: false,
  transcript_persistence_enabled: false,
  production_product_persistence_enabled: false,
  migration_enabled: false,
  destructive_deletion_enabled: false,
  stripe_enabled: false,
  paid_entitlement_enabled: false,
  public_registration_enabled: false,
  public_traffic_enabled: false,
  emergency_disabled: true,
});

const RUNTIME_FLAGS = Object.freeze({
  BUSINESS_ENGINE: 'subject_resolution_enabled',
  SUBSCRIPTION_RUNTIME: 'subscription_runtime_private_enabled',
  COACH_CONNECT: 'coach_connect_private_enabled',
});

const unsafeCapabilityEnabled = (flags) => [
  'live_model_provider_enabled',
  'live_media_provider_enabled',
  'transcript_persistence_enabled',
  'production_product_persistence_enabled',
  'migration_enabled',
  'destructive_deletion_enabled',
  'stripe_enabled',
  'paid_entitlement_enabled',
  'public_registration_enabled',
  'public_traffic_enabled',
].some((field) => flags?.[field] === true);

export function evaluatePrivateRuntimeActivation({
  flags = DEFAULT_PRIVATE_RUNTIME_FLAGS,
  environmentId = null,
  subscriberSubjectRef = null,
  exactScopeHash = null,
  requestedRuntime = null,
}) {
  let code = null;
  if (flags?.emergency_disabled !== false) code = 'EMERGENCY_DISABLED';
  else if (flags?.private_runtime_enabled !== true) code = 'PRIVATE_RUNTIME_DISABLED';
  else if (unsafeCapabilityEnabled(flags)) code = 'PRIVATE_RUNTIME_DISABLED';
  else if (!flags.private_runtime_environment_allowlist?.includes(environmentId)) {
    code = 'PRIVATE_RUNTIME_ENVIRONMENT_DENIED';
  } else if (!flags.private_runtime_subject_allowlist?.includes(subscriberSubjectRef)) {
    code = 'PRIVATE_TESTER_APPROVAL_REQUIRED';
  } else if (!flags.private_runtime_scope_allowlist?.includes(exactScopeHash)) {
    code = 'PRIVATE_TESTER_APPROVAL_REQUIRED';
  } else if (flags.subject_resolution_enabled !== true || flags.shared_security_state_enabled !== true) {
    code = 'PRIVATE_RUNTIME_DISABLED';
  } else if (flags.subdev1_enabled !== true) code = 'PRIVATE_ENTITLEMENT_REQUIRED';
  else if (!RUNTIME_FLAGS[requestedRuntime] || flags[RUNTIME_FLAGS[requestedRuntime]] !== true) {
    code = 'ACTION_NOT_ALLOWLISTED';
  }
  return deepFreeze({
    allowed: code == null,
    code,
    requested_runtime: requestedRuntime,
  });
}
