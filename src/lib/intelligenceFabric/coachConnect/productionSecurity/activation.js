import { deepFreeze } from '../../validation.js';
import {
  DEFAULT_PRODUCTION_SECURITY_FLAGS,
  PRODUCTION_SECURITY_CAPABILITY_FLAGS,
  RATIFIED_ARCHITECTURE_DECISIONS,
  RATIFIED_DECISION_STATUS,
} from './constants.js';

export const PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS = deepFreeze({
  implemented: 'COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTED_WITH_ACTIVATION_GATES',
  blocked: 'COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTATION_BLOCKED',
  failed: 'COACH_CONNECT_PRODUCTION_SECURITY_PREREQUISITES_IMPLEMENTATION_FAILED',
});

export function evaluateProductionSecurityActivation({
  flags = DEFAULT_PRODUCTION_SECURITY_FLAGS,
  capability,
  store = null,
} = {}) {
  let code = 'ACTIVE_SYNTHETIC';
  if (flags.emergency_disabled !== false) code = 'PRODUCTION_PREREQUISITE_INACTIVE';
  else if (flags.foundation_enabled !== true) code = 'PRODUCTION_PREREQUISITE_INACTIVE';
  else if (flags.synthetic_only !== true) code = 'PRODUCTION_PREREQUISITE_INACTIVE';
  else if (flags.production_traffic_enabled === true
    || flags.deployment_enabled === true
    || flags.live_auth_provider_enabled === true
    || flags.live_shared_state_enabled === true
    || flags.live_object_store_enabled === true
    || flags.stripe_enabled === true) code = 'PRODUCTION_PREREQUISITE_INACTIVE';
  else if (flags.transcript_persistence_enabled === true
    || flags.transcript_backup_enabled === true
    || flags.destructive_deletion_enabled === true) code = 'PRODUCTION_PREREQUISITE_INACTIVE';
  else if (!PRODUCTION_SECURITY_CAPABILITY_FLAGS[capability]
    || flags[PRODUCTION_SECURITY_CAPABILITY_FLAGS[capability]] !== true) code = 'PRODUCTION_PREREQUISITE_INACTIVE';
  else if (capability === 'SHARED_STATE') {
    const description = store?.describeCapability?.();
    if (!description
      || description.adapter_class !== 'SYNTHETIC_LOCAL'
      || description.deployment_grade !== false) code = 'SHARED_SECURITY_STATE_REQUIRED';
  }
  return deepFreeze({
    allowed: code === 'ACTIVE_SYNTHETIC',
    code,
    capability: capability || null,
    proof_class: code === 'ACTIVE_SYNTHETIC' ? 'SYNTHETIC_ONLY' : 'INACTIVE',
    production_authorized: false,
    deployment_ready: false,
  });
}

export function evaluateProductionSecurityImplementationVerdict({
  decision_status = RATIFIED_DECISION_STATUS,
  decisions = RATIFIED_ARCHITECTURE_DECISIONS,
  sprint_results = [],
  validation_failed = false,
  boundary_violation = false,
} = {}) {
  const mandatoryDecisionIds = Object.keys(RATIFIED_ARCHITECTURE_DECISIONS);
  const decisionsApproved = decision_status === RATIFIED_DECISION_STATUS
    && mandatoryDecisionIds.every((decisionId) => typeof decisions?.[decisionId] === 'string'
      && decisions[decisionId].length > 0);
  const sprintIds = new Set(sprint_results
    .filter((result) => result?.status === 'PASS')
    .map((result) => result.sprint));
  const allSprintsPassed = Array.from({ length: 7 }, (_, index) => index + 1)
    .every((sprint) => sprintIds.has(sprint));
  let verdict = PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS.implemented;
  if (validation_failed || boundary_violation) verdict = PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS.failed;
  else if (!decisionsApproved || !allSprintsPassed) verdict = PRODUCTION_SECURITY_IMPLEMENTATION_VERDICTS.blocked;
  return deepFreeze({
    verdict,
    decisions_approved: decisionsApproved,
    all_sprints_passed: allSprintsPassed,
    activation_gates_preserved: true,
    deployment_ready: false,
    production_certified: false,
    production_authorized: false,
  });
}

export { DEFAULT_PRODUCTION_SECURITY_FLAGS };
