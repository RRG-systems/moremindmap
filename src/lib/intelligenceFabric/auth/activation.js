import { deepFreeze } from '../validation.js';

export const DEFAULT_COACH_AUTH_FLAGS = deepFreeze({ coach_auth_enabled: false, account_creation_enabled: false,
  verification_enabled: false, session_enabled: false, acceptance_context_enabled: false,
  production_traffic_enabled: false, synthetic_only: true, emergency_disabled: true });

export function evaluateCoachAuthActivation({ flags = DEFAULT_COACH_AUTH_FLAGS, capability }) {
  let code = 'ACTIVE';
  if (flags.emergency_disabled !== false) code = 'EMERGENCY_DISABLED';
  else if (flags.coach_auth_enabled !== true) code = 'COACH_AUTH_DISABLED';
  else if (flags.synthetic_only !== true || flags.production_traffic_enabled === true) code = 'PRODUCTION_ACTIVATION_DENIED';
  else if (capability === 'ACCOUNT_CREATE' && flags.account_creation_enabled !== true) code = 'ACCOUNT_CREATION_DISABLED';
  else if (capability === 'VERIFY' && flags.verification_enabled !== true) code = 'VERIFICATION_DISABLED';
  else if (capability === 'SESSION' && flags.session_enabled !== true) code = 'SESSION_DISABLED';
  else if (capability === 'ACCEPTANCE_CONTEXT' && flags.acceptance_context_enabled !== true) code = 'ACCEPTANCE_CONTEXT_DISABLED';
  return deepFreeze({ allowed: code === 'ACTIVE', code });
}
