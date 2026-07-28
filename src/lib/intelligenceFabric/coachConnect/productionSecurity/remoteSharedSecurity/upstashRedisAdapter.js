import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  buildRemoteAtomicCommandInvocation,
  parseRemoteAtomicCommandReply,
  remoteAtomicCommandRetryDecision,
} from './atomicCommands.js';
import {
  buildRemoteAuthoritativeQueryInvocation,
  parseRemoteAuthoritativeQueryReply,
  remoteAuthoritativeQueryRetryDecision,
  remoteSharedSecurityQueryScriptManifest,
} from './authoritativeQueries.js';
import {
  defaultRemoteSharedSecurityConfiguration,
  remoteSharedSecurityConfigurationDigest,
  validateRemoteSharedSecurityConfiguration,
} from './configuration.js';
import {
  RemoteSharedSecurityAdapterError,
  normalizeRemoteProviderFailure,
  projectRemoteCapabilityToV2,
  projectRemoteHealthToV2,
  projectRemoteServerTimeToV2,
  remoteCommandFailure,
  remoteQueryFailure,
  validateRemoteCommandEnvelope,
  validateRemoteQueryEnvelope,
} from './contracts.js';
import {
  createRemoteSharedSecurityHealthController,
} from './health.js';
import {
  createRemoteSharedSecurityKeyspace,
} from './keyspace.js';
import {
  remoteSharedSecurityCommandScriptManifest,
} from './scriptManifest.js';

export const UPSTASH_REMOTE_SHARED_SECURITY_ADAPTER_VERSION =
  'upstash-remote-shared-security-adapter-v1';

const HEALTH_SCRIPT = String.raw`-- remote-shared-security-health-lua-v1
local envelope = cjson.decode(ARGV[1])
local t = redis.call('TIME')
local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
redis.call('SET', KEYS[1], envelope.canary_value, 'PX', '60000')
local compared = redis.call('GET', KEYS[1])
if compared ~= envelope.canary_value then return redis.error_reply('CANARY_COMPARE_FAILED') end
local epoch = redis.call('INCR', KEYS[2])
redis.call('XADD', KEYS[3], 'MAXLEN', '~', tostring(envelope.audit_max_entries), '*',
  'receipt_ref', envelope.receipt_ref,
  'event_type', 'ADAPTER_HEALTH_CANARY',
  'decision', 'OBSERVED',
  'failure_code', '',
  'environment_digest', envelope.environment_digest,
  'correlation_ref', envelope.correlation_ref,
  'occurred_at_ms', tostring(now),
  'configuration_digest', envelope.configuration_digest,
  'script_digest', envelope.script_manifest_digest)
redis.call('XTRIM', KEYS[3], 'MINID', '~',
  tostring(now - envelope.audit_retention_ms) .. '-0')
return cjson.encode({
  server_time_ms = now,
  canary_epoch = epoch,
  configuration_digest = envelope.configuration_digest,
  script_manifest_digest = envelope.script_manifest_digest,
  primary_authority_proven = true,
  atomic_script_proven = true,
  critical_alert_open = false,
  receipt_ref = envelope.receipt_ref
})`;

const TIME_SCRIPT = String.raw`-- remote-shared-security-time-lua-v1
local envelope = cjson.decode(ARGV[1])
local t = redis.call('TIME')
local now = (tonumber(t[1]) * 1000) + math.floor(tonumber(t[2]) / 1000)
redis.call('SET', KEYS[1], envelope.script_manifest_digest, 'PX', '60000')
return cjson.encode({
  ok = true,
  server_time_ms = now,
  receipt_ref = envelope.receipt_ref
})`;

const frozen = (value) => deepFreeze(structuredClone(value));
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function remoteSharedSecurityCompleteScriptManifestDigest() {
  return hashCanonicalJson({
    commands: remoteSharedSecurityCommandScriptManifest()
      .map(({ operation_type, sha256: digest }) => [operation_type, digest]),
    queries: remoteSharedSecurityQueryScriptManifest()
      .map(({ operation_type, sha256: digest }) => [operation_type, digest]),
    health: hashCanonicalJson(HEALTH_SCRIPT),
    time: hashCanonicalJson(TIME_SCRIPT),
  });
}

function qualificationMatches(attestation, {
  configuration,
  configurationDigest,
  scriptManifestDigest,
}) {
  return attestation?.attestation_version === 'remote-shared-security-qualification-attestation-v1'
    && attestation.adapter_id === configuration.adapter_id
    && attestation.environment_id === configuration.environment_id
    && attestation.namespace_digest === configuration.namespace_digest
    && attestation.configuration_digest === configurationDigest
    && attestation.script_manifest_digest === scriptManifestDigest
    && attestation.primary_authority_proven === true
    && attestation.atomic_script_proven === true
    && attestation.live_connection_verified === true
    && attestation.zero_customer_data === true
    && attestation.disposable_namespace === true
    && Number.isFinite(Date.parse(attestation.qualified_at))
    && Number.isFinite(Date.parse(attestation.expires_at))
    && Date.parse(attestation.expires_at) > Date.now();
}

export class UpstashRedisRemoteSharedSecurityAdapter {
  #configuration;
  #configurationDigest;
  #scriptManifestDigest;
  #qualificationAttestation;
  #qualificationMatched;
  #offlineTransportTest;
  #resolveSecretReference;
  #fetch;
  #keyspace;
  #healthController;
  #providerActivity;

  constructor({
    configuration = defaultRemoteSharedSecurityConfiguration(),
    qualification_attestation = null,
    offline_transport_test = false,
    resolve_secret_reference = null,
    keyed_digest = null,
    fetch_impl = globalThis.fetch,
    clock = () => Date.now(),
  } = {}) {
    this.#configuration = frozen(configuration);
    this.#scriptManifestDigest = remoteSharedSecurityCompleteScriptManifestDigest();
    this.#configurationDigest = remoteSharedSecurityConfigurationDigest(this.#configuration);
    this.#qualificationAttestation = qualification_attestation
      ? frozen(qualification_attestation)
      : null;
    this.#offlineTransportTest = offline_transport_test === true
      && configuration.environment_id === 'TEST'
      && typeof fetch_impl === 'function';
    this.#qualificationMatched = qualificationMatches(this.#qualificationAttestation, {
      configuration: this.#configuration,
      configurationDigest: this.#configurationDigest,
      scriptManifestDigest: this.#scriptManifestDigest,
    });
    const checked = validateRemoteSharedSecurityConfiguration(this.#configuration, {
      qualification_authorized: this.#qualificationMatched || this.#offlineTransportTest,
      expected_script_manifest_digest: this.#configuration.enabled
        ? this.#scriptManifestDigest
        : null,
    });
    this.configuration_valid = checked.valid;
    this.#resolveSecretReference = resolve_secret_reference;
    this.#fetch = fetch_impl;
    this.#keyspace = typeof keyed_digest === 'function' && sha256(configuration.namespace_digest)
      ? createRemoteSharedSecurityKeyspace({
        namespace_digest: configuration.namespace_digest,
        digest: keyed_digest,
      })
      : null;
    const configured = checked.valid
      && configuration.enabled === true
      && configuration.emergency_disabled === false
      && this.#keyspace != null
      && typeof resolve_secret_reference === 'function'
      && typeof fetch_impl === 'function'
      && (this.#qualificationMatched || this.#offlineTransportTest);
    this.#healthController = createRemoteSharedSecurityHealthController({
      configured,
      emergency_disabled: configuration.emergency_disabled,
      adapter_id: configuration.adapter_id,
      environment_id: configuration.environment_id,
      configuration_digest: this.#configurationDigest,
      script_manifest_digest: this.#scriptManifestDigest,
      failure_threshold: configuration.breaker_failure_threshold,
      failure_window_ms: configuration.breaker_window_ms,
      breaker_open_ms: configuration.breaker_open_ms,
      recovery_success_threshold: configuration.recovery_success_threshold,
      clock,
    });
    this.#providerActivity = [];
  }

  async describeCapability() {
    const health = this.#healthController.snapshot();
    const qualifiedHealthy = this.#qualificationMatched && health.state === 'HEALTHY';
    return projectRemoteCapabilityToV2({
      adapter_id: this.#configuration.adapter_id,
      environment_id: this.#configuration.environment_id,
      available: qualifiedHealthy,
      deployment_grade: qualifiedHealthy,
      primary_authority_proven: qualifiedHealthy,
      live_connection_verified: qualifiedHealthy,
    });
  }

  async health() {
    const preflight = this.#healthController.denyPreflight();
    if (!preflight.provider_probe_required) {
      return this.#projectHealth(this.#healthController.snapshot());
    }
    try {
      const proof = await this.#executeWithRetry(
        this.#healthInvocation(),
        'HEALTH_CANARY',
        this.#configuration.query_timeout_ms,
        1,
      );
      const parsed = this.#parseJsonReply(proof);
      const state = this.#healthController.observeCanary(parsed);
      return this.#projectHealth(state);
    } catch (cause) {
      const failure = normalizeRemoteProviderFailure(cause);
      const state = this.#healthController.observeFailure(failure.code);
      return this.#projectHealth(state);
    }
  }

  async serverTime() {
    const preflight = this.#healthController.denyPreflight();
    if (!preflight.provider_probe_required) {
      return projectRemoteServerTimeToV2({
        ok: false,
        server_time_ms: 0,
        failure_code: preflight.code,
        receipt_ref: this.#healthController.snapshot().receipt_ref,
      });
    }
    try {
      const reply = await this.#executeWithRetry(
        this.#timeInvocation(),
        'SERVER_TIME',
        this.#configuration.query_timeout_ms,
        1,
      );
      const parsed = this.#parseJsonReply(reply);
      return projectRemoteServerTimeToV2({
        ok: parsed.ok === true,
        server_time_ms: parsed.server_time_ms,
        failure_code: parsed.ok === true ? null : 'SERVER_TIME_NOT_PROVEN',
        receipt_ref: parsed.receipt_ref,
      });
    } catch (cause) {
      const failure = normalizeRemoteProviderFailure(cause);
      this.#healthController.observeFailure(failure.code);
      return projectRemoteServerTimeToV2({
        ok: false,
        server_time_ms: 0,
        failure_code: failure.code,
        receipt_ref: failure.receipt_ref,
      });
    }
  }

  async queryAuthoritative(query) {
    const checked = validateRemoteQueryEnvelope(query);
    if (!this.#isTransportConfigured()) {
      return remoteQueryFailure(checked.query_type, 'UNCONFIGURED', 0);
    }
    const health = await this.health();
    if (health.state !== 'HEALTHY' || health.allowed_for_security !== true) {
      return remoteQueryFailure(
        checked.query_type,
        health.state === 'PARTITIONED'
          ? 'PROVIDER_PARTITION_SUSPECTED'
          : health.state === 'RECOVERING'
            ? 'RECOVERY_NOT_PROVEN'
            : 'PROVIDER_UNAVAILABLE',
        Date.parse(health.server_time),
      );
    }
    const invocation = buildRemoteAuthoritativeQueryInvocation(checked, {
      keyspace: this.#keyspace,
      configuration_digest: this.#configurationDigest,
      environment_digest: this.#configuration.namespace_digest,
      audit_retention_ms: this.#configuration.audit_retention_days * 86400000,
    });
    try {
      const reply = await this.#executeWithRetry(
        invocation,
        'AUTHORITATIVE_QUERY',
        this.#configuration.query_timeout_ms,
        this.#configuration.query_retry_limit,
        checked,
      );
      return parseRemoteAuthoritativeQueryReply(reply, checked.query_type);
    } catch (cause) {
      const failure = normalizeRemoteProviderFailure(cause);
      this.#healthController.observeFailure(failure.code);
      return remoteQueryFailure(checked.query_type, failure.code, 0);
    }
  }

  async executeAtomic(command) {
    const checked = validateRemoteCommandEnvelope(command);
    if (!this.#isTransportConfigured()) {
      return remoteCommandFailure(checked.command_type, 'UNCONFIGURED', 0);
    }
    const health = await this.health();
    if (health.state !== 'HEALTHY' || health.allowed_for_security !== true) {
      return remoteCommandFailure(
        checked.command_type,
        health.state === 'PARTITIONED'
          ? 'PROVIDER_PARTITION_SUSPECTED'
          : health.state === 'RECOVERING'
            ? 'RECOVERY_NOT_PROVEN'
            : 'PROVIDER_UNAVAILABLE',
        Date.parse(health.server_time),
      );
    }
    const invocation = buildRemoteAtomicCommandInvocation(checked, {
      keyspace: this.#keyspace,
      configuration_digest: this.#configurationDigest,
      environment_digest: this.#configuration.namespace_digest,
      emergency_disabled: this.#configuration.emergency_disabled,
      audit_retention_ms: this.#configuration.audit_retention_days * 86400000,
    });
    try {
      const reply = await this.#executeWithRetry(
        invocation,
        'ATOMIC_COMMAND',
        this.#configuration.command_timeout_ms,
        this.#configuration.command_retry_limit,
        checked,
      );
      return parseRemoteAtomicCommandReply(reply, checked.command_type);
    } catch (cause) {
      const failure = normalizeRemoteProviderFailure(cause);
      this.#healthController.observeFailure(failure.code);
      return remoteCommandFailure(checked.command_type, failure.code, 0);
    }
  }

  providerActivityLedger() {
    return frozen(this.#providerActivity);
  }

  #isTransportConfigured() {
    return this.configuration_valid
      && this.#configuration.enabled === true
      && this.#configuration.emergency_disabled === false
      && this.#keyspace != null
      && (this.#qualificationMatched || this.#offlineTransportTest);
  }

  #projectHealth(state) {
    return projectRemoteHealthToV2({
      state: state.state,
      allowed_for_security: state.allowed_for_security,
      environment_id: this.#configuration.environment_id,
      adapter_id: this.#configuration.adapter_id,
      deployment_grade: this.#qualificationMatched && state.state === 'HEALTHY',
      live_connection_verified: this.#qualificationMatched && state.state === 'HEALTHY',
      server_time_ms: state.last_provider_time_ms || 0,
      failure_code: state.failure_code,
      receipt_ref: state.receipt_ref,
    });
  }

  #healthInvocation() {
    const receiptRef = `health_${hashCanonicalJson({
      adapter_id: this.#configuration.adapter_id,
      configuration_digest: this.#configurationDigest,
      activity_count: this.#providerActivity.length,
    }).slice(0, 32)}`;
    const envelope = {
      canary_value: hashCanonicalJson({ receipt_ref: receiptRef }),
      receipt_ref: receiptRef,
      environment_digest: this.#configuration.namespace_digest,
      configuration_digest: this.#configurationDigest,
      script_manifest_digest: this.#scriptManifestDigest,
      correlation_ref: 'adapter_health_canary',
      audit_max_entries: 10000,
      audit_retention_ms: Math.max(
        1,
        this.#configuration.audit_retention_days,
      ) * 86400000,
    };
    const command = [
      'EVAL',
      HEALTH_SCRIPT,
      3,
      this.#keyspace.canary(envelope.canary_value),
      this.#keyspace.recovery('health_generation'),
      this.#keyspace.audit,
      JSON.stringify(envelope),
    ];
    return frozen({ command, operation_type: 'HEALTH_CANARY' });
  }

  #timeInvocation() {
    const receiptRef = `time_${hashCanonicalJson({
      adapter_id: this.#configuration.adapter_id,
      activity_count: this.#providerActivity.length,
    }).slice(0, 32)}`;
    const envelope = {
      receipt_ref: receiptRef,
      script_manifest_digest: this.#scriptManifestDigest,
    };
    const command = [
      'EVAL',
      TIME_SCRIPT,
      1,
      this.#keyspace.canary(receiptRef),
      JSON.stringify(envelope),
    ];
    return frozen({ command, operation_type: 'SERVER_TIME' });
  }

  async #executeWithRetry(invocation, purpose, timeoutMs, retryLimit, envelope = null) {
    let attempt = 0;
    let lastFailure = null;
    while (attempt <= retryLimit) {
      try {
        return await this.#executeProviderEval(invocation.command, purpose, timeoutMs, attempt);
      } catch (cause) {
        const failure = normalizeRemoteProviderFailure(cause);
        lastFailure = failure;
        const decision = purpose === 'ATOMIC_COMMAND'
          ? remoteAtomicCommandRetryDecision({
            attempt,
            error_code: failure.code,
            command: envelope,
          })
          : purpose === 'AUTHORITATIVE_QUERY'
            ? remoteAuthoritativeQueryRetryDecision({
              attempt,
              error_code: failure.code,
            })
            : {
              retry: attempt === 0
                && ['PROVIDER_TIMEOUT', 'PROVIDER_UNAVAILABLE'].includes(failure.code),
            };
        if (!decision.retry || attempt >= retryLimit) throw failure;
        attempt += 1;
      }
    }
    throw lastFailure || new RemoteSharedSecurityAdapterError('PROVIDER_UNAVAILABLE');
  }

  async #executeProviderEval(command, purpose, timeoutMs, attempt) {
    if (!Array.isArray(command) || command[0] !== 'EVAL') {
      throw new RemoteSharedSecurityAdapterError('PRIMARY_AUTHORITY_NOT_PROVEN');
    }
    const endpoint = await this.#resolveSecretReference(
      this.#configuration.provider_endpoint_ref,
      { purpose: 'REMOTE_SHARED_SECURITY_PROVIDER_ENDPOINT' },
    );
    const credential = await this.#resolveSecretReference(
      this.#configuration.provider_credential_ref,
      { purpose: 'REMOTE_SHARED_SECURITY_PROVIDER_CREDENTIAL' },
    );
    if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint)
      || typeof credential !== 'string' || credential.length < 16) {
      throw new RemoteSharedSecurityAdapterError('UNCONFIGURED');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    this.#providerActivity.push({
      activity_version: 'remote-provider-activity-v1',
      transport_class: this.#offlineTransportTest
        ? 'OFFLINE_SIMULATOR'
        : 'AUTHORIZED_DISPOSABLE_PROVIDER',
      purpose,
      primitive: 'EVAL',
      attempt,
      at_ms: started,
      customer_data: false,
      credential_logged: false,
      endpoint_logged: false,
    });
    try {
      const response = await this.#fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        signal: controller.signal,
      });
      if (!response?.ok) {
        const error = new Error('remote provider request rejected');
        error.status = response?.status;
        throw error;
      }
      const body = await response.json();
      if (!body || Object.hasOwn(body, 'error') || !Object.hasOwn(body, 'result')) {
        throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
      }
      return body.result;
    } finally {
      clearTimeout(timeout);
    }
  }

  #parseJsonReply(reply) {
    const payload = Array.isArray(reply) && reply.length === 1 ? reply[0] : reply;
    if (typeof payload !== 'string') {
      if (!payload || typeof payload !== 'object') {
        throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
      }
      return payload;
    }
    try {
      return JSON.parse(payload);
    } catch {
      throw new RemoteSharedSecurityAdapterError('PROVIDER_RESPONSE_MALFORMED');
    }
  }
}

export function createUpstashRedisRemoteSharedSecurityAdapter(options = {}) {
  return new UpstashRedisRemoteSharedSecurityAdapter(options);
}

const TEARDOWN_SCRIPT = String.raw`-- remote-shared-security-disposable-teardown-lua-v1
local envelope = cjson.decode(ARGV[1])
local expected = envelope.namespace_prefix .. ':{' .. envelope.namespace_digest .. '}:'
if string.sub(KEYS[1], 1, string.len(expected)) ~= expected then
  return redis.error_reply('NAMESPACE_MISMATCH')
end
local result = redis.call('SCAN', envelope.cursor, 'MATCH', expected .. '*', 'COUNT', '200')
local removed = 0
if #result[2] > 0 then
  removed = redis.call('UNLINK', unpack(result[2]))
end
return cjson.encode({ cursor = result[1], removed = removed, namespace_digest = envelope.namespace_digest })`;

export function buildDisposableQualificationTeardownInvocation({
  namespace_digest,
  cursor = '0',
  authority_receipt_ref,
} = {}) {
  if (!sha256(namespace_digest)
    || typeof cursor !== 'string'
    || !/^[0-9]+$/.test(cursor)
    || typeof authority_receipt_ref !== 'string'
    || authority_receipt_ref.length < 1) {
    throw new RemoteSharedSecurityAdapterError('CONFIGURATION_INVALID');
  }
  const prefix = 'more:cc:security:v2';
  const ownershipKey = `${prefix}:{${namespace_digest}}:adapter:ownership`;
  return frozen({
    primitive: 'EVAL',
    operation_type: 'DISPOSABLE_NAMESPACE_TEARDOWN',
    destructive_scope: 'ONE_EXACT_QUALIFICATION_NAMESPACE',
    production_namespace_allowed: false,
    control_plane_resource_deletion: false,
    backup_deletion_claimed: false,
    command: [
      'EVAL',
      TEARDOWN_SCRIPT,
      1,
      ownershipKey,
      JSON.stringify({
        namespace_prefix: prefix,
        namespace_digest,
        cursor,
        authority_receipt_ref,
      }),
    ],
  });
}
