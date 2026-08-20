import { hashCanonicalJson } from '../intelligenceFabric/hashing.js';
import { deepFreeze } from '../intelligenceFabric/validation.js';
import { contractHeader, sameScope, scopeFingerprint, validateSubscriptionV1Contract } from './contracts.js';
import { OUTCOME_DIRECTIONS, UNIVERSAL_RSL_RUNTIME_FLAGS } from './constants.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

export class InMemoryUniversalCandidateCapture {
  constructor({ flags = UNIVERSAL_RSL_RUNTIME_FLAGS } = {}) {
    if (flags.candidate_capture_enabled !== true || flags.runtime_read_enabled !== false || flags.promotion_enabled !== false) {
      throw new TypeError('Universal candidate capture requires read and promotion hard-off');
    }
    this.flags = clone(flags);
    this.partitions = new Map();
  }

  capture({
    scope,
    source_events,
    condition,
    intervention,
    execution_context,
    outcome,
    outcome_direction,
    validation_state = 'PENDING',
    confounders = [],
    falsifiers = [],
    privacy_policy_ref = null,
    eligibility_policy_ref = null,
    created_at,
  }) {
    if (!OUTCOME_DIRECTIONS.includes(outcome_direction)) return deepFreeze({ ok: false, code: 'OUTCOME_DIRECTION_REQUIRED' });
    if (!Array.isArray(source_events) || source_events.length === 0 || source_events.some((event) => !sameScope(event.scope, scope))) {
      return deepFreeze({ ok: false, code: 'UNIVERSAL_CANDIDATE_SOURCE_SCOPE_INVALID' });
    }
    const eventTypes = new Set(source_events.map((event) => event.event_type));
    if (!eventTypes.has('OUTCOME') && !eventTypes.has('FALSIFICATION') && !eventTypes.has('VALIDATION')) {
      return deepFreeze({ ok: false, code: 'OUTCOME_OR_VALIDATION_SOURCE_REQUIRED' });
    }
    const policyConfigured = Boolean(privacy_policy_ref && eligibility_policy_ref);
    const body = {
      ...contractHeader('universal_rsl_candidate'),
      candidate_id: `universal_candidate_${hashCanonicalJson({ scope: scopeFingerprint(scope), source_event_ids: source_events.map((event) => event.event_id).sort(), outcome_direction }).slice(0, 24)}`,
      source_scope_hash: scopeFingerprint(scope),
      source_event_hashes: source_events.map((event) => event.content_hash).sort(),
      state: policyConfigured ? 'CANDIDATE_PRIVATE' : 'PERSONAL_ONLY',
      condition: clone(condition || {}),
      intervention: clone(intervention || {}),
      execution_context: clone(execution_context || {}),
      outcome: clone(outcome || {}),
      outcome_direction,
      validation_state,
      confounders: clone(confounders),
      falsifiers: clone(falsifiers),
      privacy_policy_ref: privacy_policy_ref || 'POLICY_NOT_CONFIGURED',
      eligibility_policy_ref: eligibility_policy_ref || 'POLICY_NOT_CONFIGURED',
      runtime_read_enabled: false,
      promotion_enabled: false,
      created_at: new Date(created_at).toISOString(),
    };
    const candidate = deepFreeze({ ...body, candidate_hash: hashCanonicalJson(body) });
    const validation = validateSubscriptionV1Contract(candidate);
    if (!validation.valid) return deepFreeze({ ok: false, code: 'UNIVERSAL_CANDIDATE_CONTRACT_INVALID', errors: validation.errors });
    const key = scopeFingerprint(scope);
    const partition = this.partitions.get(key) || new Map();
    const existing = partition.get(candidate.candidate_id);
    if (existing && existing.candidate_hash !== candidate.candidate_hash) return deepFreeze({ ok: false, code: 'UNIVERSAL_CANDIDATE_ID_CONFLICT' });
    partition.set(candidate.candidate_id, clone(candidate));
    this.partitions.set(key, partition);
    return deepFreeze({
      ok: true,
      code: existing ? 'IDEMPOTENT_REPLAY' : 'UNIVERSAL_CANDIDATE_CAPTURED_PRIVATE',
      candidate,
      policy_configured: policyConfigured,
      customer_runtime_eligible: false,
    });
  }

  inspectPrivate({ scope }) {
    const partition = this.partitions.get(scopeFingerprint(scope));
    return deepFreeze({ ok: true, code: 'PRIVATE_GOVERNANCE_INSPECTION_ONLY', candidates: partition ? [...partition.values()].map(clone) : [] });
  }

  retrieveForCustomerRuntime() {
    return deepFreeze({ ok: false, code: 'UNIVERSAL_RSL_RUNTIME_READ_DISABLED', patterns: [] });
  }

  promote() {
    return deepFreeze({ ok: false, code: 'UNIVERSAL_RSL_PROMOTION_DISABLED', mutated: false });
  }
}
