import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';

export const REMOTE_SHARED_SECURITY_HEALTH_CONTROLLER_VERSION =
  'remote-shared-security-health-controller-v1';

const STATES = new Set([
  'UNCONFIGURED',
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'PARTITIONED',
  'RECOVERING',
]);
const PARTITION_CODES = new Set([
  'NAMESPACE_MISMATCH',
  'PROVIDER_PARTITION_SUSPECTED',
  'PRIMARY_AUTHORITY_NOT_PROVEN',
  'SCRIPT_VERSION_MISMATCH',
  'SERVER_TIME_NOT_PROVEN',
]);
const IMMEDIATE_UNAVAILABLE_CODES = new Set([
  'CONFIGURATION_INVALID',
  'PROVIDER_AUTHENTICATION_FAILED',
  'PROVIDER_FORBIDDEN',
  'PROVIDER_RESPONSE_MALFORMED',
  'ATOMICITY_NOT_PROVEN',
]);
const frozen = (value) => deepFreeze(structuredClone(value));

export class RemoteSharedSecurityHealthController {
  constructor({
    configured = false,
    emergency_disabled = true,
    adapter_id = 'remote_shared_security_unconfigured',
    environment_id = 'LOCAL_SYNTHETIC',
    configuration_digest = '0'.repeat(64),
    script_manifest_digest = '0'.repeat(64),
    failure_threshold = 3,
    failure_window_ms = 30000,
    breaker_open_ms = 15000,
    recovery_success_threshold = 3,
    clock = () => Date.now(),
  } = {}) {
    this.adapter_id = adapter_id;
    this.environment_id = environment_id;
    this.configuration_digest = configuration_digest;
    this.script_manifest_digest = script_manifest_digest;
    this.failure_threshold = failure_threshold;
    this.failure_window_ms = failure_window_ms;
    this.breaker_open_ms = breaker_open_ms;
    this.recovery_success_threshold = recovery_success_threshold;
    this.clock = clock;
    this.configured = configured === true;
    this.emergency_disabled = emergency_disabled !== false;
    this.state = this.configured && !this.emergency_disabled ? 'RECOVERING' : 'UNCONFIGURED';
    this.failures = [];
    this.recovery_successes = 0;
    this.last_provider_time_ms = null;
    this.last_canary_epoch = null;
    this.last_receipt_ref = null;
    this.breaker_open_until_ms = 0;
    this.last_failure_code = this.state === 'UNCONFIGURED' ? 'UNCONFIGURED' : 'RECOVERY_NOT_PROVEN';
  }

  denyPreflight() {
    const now = this.clock();
    if (!this.configured || this.emergency_disabled) {
      return frozen({
        allowed: false,
        code: this.emergency_disabled ? 'UNCONFIGURED' : 'CONFIGURATION_INVALID',
        state: 'UNCONFIGURED',
        provider_probe_required: false,
      });
    }
    if (this.breaker_open_until_ms > now) {
      return frozen({
        allowed: false,
        code: this.last_failure_code || 'PROVIDER_UNAVAILABLE',
        state: this.state,
        provider_probe_required: false,
      });
    }
    return frozen({
      allowed: false,
      code: this.state === 'HEALTHY' ? 'PROVIDER_PROBE_REQUIRED' : 'RECOVERY_NOT_PROVEN',
      state: this.state,
      provider_probe_required: true,
    });
  }

  observeFailure(code) {
    const now = this.clock();
    this.recovery_successes = 0;
    this.last_failure_code = code;
    if (PARTITION_CODES.has(code)) {
      this.state = 'PARTITIONED';
      this.breaker_open_until_ms = now + this.breaker_open_ms;
      return this.snapshot();
    }
    if (IMMEDIATE_UNAVAILABLE_CODES.has(code)) {
      this.state = 'UNAVAILABLE';
      this.breaker_open_until_ms = now + this.breaker_open_ms;
      return this.snapshot();
    }
    this.failures = this.failures
      .filter((at) => now - at <= this.failure_window_ms);
    this.failures.push(now);
    this.state = this.failures.length >= this.failure_threshold
      ? 'UNAVAILABLE'
      : 'DEGRADED';
    if (this.state === 'UNAVAILABLE') {
      this.breaker_open_until_ms = now + this.breaker_open_ms;
    }
    return this.snapshot();
  }

  observeCanary(proof) {
    const structurallyValid = proof
      && Number.isSafeInteger(proof.server_time_ms)
      && Number.isSafeInteger(proof.canary_epoch)
      && proof.configuration_digest === this.configuration_digest
      && proof.script_manifest_digest === this.script_manifest_digest
      && proof.primary_authority_proven === true
      && proof.atomic_script_proven === true
      && proof.critical_alert_open === false
      && typeof proof.receipt_ref === 'string';
    if (!structurallyValid) return this.observeFailure('RECOVERY_NOT_PROVEN');
    if ((this.last_provider_time_ms != null
      && proof.server_time_ms < this.last_provider_time_ms - 1000)
      || (this.last_canary_epoch != null && proof.canary_epoch <= this.last_canary_epoch)) {
      return this.observeFailure('PROVIDER_PARTITION_SUSPECTED');
    }
    this.last_provider_time_ms = proof.server_time_ms;
    this.last_canary_epoch = proof.canary_epoch;
    this.last_receipt_ref = proof.receipt_ref;
    this.breaker_open_until_ms = 0;
    this.failures = [];
    this.recovery_successes += 1;
    this.state = this.recovery_successes >= this.recovery_success_threshold
      ? 'HEALTHY'
      : 'RECOVERING';
    this.last_failure_code = this.state === 'HEALTHY' ? null : 'RECOVERY_NOT_PROVEN';
    return this.snapshot();
  }

  setEmergencyDisabled(value) {
    this.emergency_disabled = value !== false;
    if (this.emergency_disabled) {
      this.state = 'UNCONFIGURED';
      this.recovery_successes = 0;
      this.last_failure_code = 'UNCONFIGURED';
    } else if (this.configured) {
      this.state = 'RECOVERING';
      this.last_failure_code = 'RECOVERY_NOT_PROVEN';
    }
    return this.snapshot();
  }

  snapshot() {
    const now = this.clock();
    if (!STATES.has(this.state)) this.state = 'UNAVAILABLE';
    return frozen({
      controller_version: REMOTE_SHARED_SECURITY_HEALTH_CONTROLLER_VERSION,
      state: this.state,
      allowed_for_security: this.state === 'HEALTHY'
        && !this.emergency_disabled
        && this.breaker_open_until_ms <= now,
      adapter_id: this.adapter_id,
      environment_id: this.environment_id,
      configuration_digest: this.configuration_digest,
      script_manifest_digest: this.script_manifest_digest,
      recovery_successes: this.recovery_successes,
      recovery_success_threshold: this.recovery_success_threshold,
      last_provider_time_ms: this.last_provider_time_ms,
      last_canary_epoch: this.last_canary_epoch,
      receipt_ref: this.last_receipt_ref || `health_${hashCanonicalJson({
        state: this.state,
        environment_id: this.environment_id,
        now_bucket: Math.floor(now / 15000),
      }).slice(0, 32)}`,
      failure_code: this.last_failure_code,
      breaker_open: this.breaker_open_until_ms > now,
      breaker_open_until_ms: this.breaker_open_until_ms,
      local_authority: false,
      local_allow_cache: false,
    });
  }
}

export function createRemoteSharedSecurityHealthController(options = {}) {
  return new RemoteSharedSecurityHealthController(options);
}
