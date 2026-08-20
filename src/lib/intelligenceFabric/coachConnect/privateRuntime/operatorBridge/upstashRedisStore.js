import crypto from 'node:crypto';
import { deepFreeze } from '../../../validation.js';
import { validateCsrfGrant } from '../../security/contracts.js';

export const SUBDEV1_UPSTASH_OPERATOR_STORE_VERSION =
  'subdev1-upstash-operator-store-v1';

const OPERATOR_STORE_SCRIPT = String.raw`-- subdev1-upstash-operator-store-v1
local operation = ARGV[1]
local payload = cjson.decode(ARGV[2])
local time = redis.call('TIME')
local now = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)

local function result(value)
  value.server_time_ms = now
  return cjson.encode(value)
end

if operation == 'RATE_LIMIT' then
  local current = redis.call('GET', KEYS[1])
  local state = current and cjson.decode(current) or {
    window_started_at = now, count = 0, blocked_until = 0, violations = 0
  }
  if now - tonumber(state.window_started_at) >= tonumber(payload.window_ms) then
    state = {
      window_started_at = now, count = 0, blocked_until = 0, violations = 0
    }
  end
  if tonumber(state.blocked_until) > now then
    return result({
      ok = false,
      code = 'OPERATOR_RATE_LIMITED',
      retry_after_ms = tonumber(state.blocked_until) - now
    })
  end
  state.count = tonumber(state.count) + 1
  if tonumber(state.count) > tonumber(payload.limit) then
    state.violations = tonumber(state.violations) + 1
    local exponent = math.min(tonumber(state.violations) - 1, 5)
    state.blocked_until = now + (tonumber(payload.cooldown_base_ms) * (2 ^ exponent))
    redis.call('SET', KEYS[1], cjson.encode(state), 'PX',
      math.max(tonumber(payload.window_ms), tonumber(state.blocked_until) - now))
    return result({
      ok = false,
      code = 'OPERATOR_RATE_LIMITED',
      retry_after_ms = tonumber(state.blocked_until) - now
    })
  end
  redis.call('SET', KEYS[1], cjson.encode(state), 'PX', tonumber(payload.window_ms))
  return result({ ok = true, remaining = math.max(0, tonumber(payload.limit) - state.count) })
end

if operation == 'ISSUE_CSRF' then
  local inserted = redis.call('SET', KEYS[1], payload.record_json, 'NX', 'PX',
    tonumber(payload.ttl_ms))
  if not inserted then return result({ ok = false, code = 'CSRF_VALIDATION_FAILED' }) end
  return result({ ok = true, grant_id = payload.grant_id })
end

if operation == 'CONSUME_CSRF' then
  local serialized = redis.call('GET', KEYS[1])
  if not serialized then return result({ ok = false, code = 'CSRF_VALIDATION_FAILED' }) end
  local record = cjson.decode(serialized)
  if record.status ~= 'ACTIVE'
    or record.browser_binding_hash ~= payload.browser_binding_hash
    or record.method ~= payload.method
    or record.route ~= payload.route
    or record.environment_id ~= payload.environment_id
    or tonumber(record.expires_at_ms) <= now then
    return result({ ok = false, code = 'CSRF_VALIDATION_FAILED' })
  end
  record.status = 'CONSUMED'
  record.consumed_at = payload.consumed_at
  redis.call('SET', KEYS[1], cjson.encode(record), 'PX',
    math.max(1, tonumber(record.expires_at_ms) - now))
  return result({ ok = true, grant_id = record.grant_id })
end

if operation == 'SAVE_CONTEXT' then
  local inserted = redis.call('SET', KEYS[1], payload.context_json, 'NX', 'PX',
    tonumber(payload.ttl_ms))
  if not inserted then return result({ ok = false, code = 'OPERATOR_CONTEXT_INVALID' }) end
  return result({ ok = true, context_id = payload.context_id })
end

if operation == 'GET_CONTEXT' then
  local serialized = redis.call('GET', KEYS[1])
  if not serialized then
    return result({ ok = true, status = 'NOT_FOUND', context = cjson.null })
  end
  return result({ ok = true, status = 'FOUND', context = cjson.decode(serialized) })
end

if operation == 'REPLACE_CONTEXT' then
  local serialized = redis.call('GET', KEYS[1])
  if not serialized then return result({ ok = false, code = 'PROFILE_RECEIPT_STALE' }) end
  local prior = cjson.decode(serialized)
  if tonumber(prior.profile_generation) ~= tonumber(payload.expected_profile_generation)
    or prior.token_hash ~= payload.token_hash then
    return result({ ok = false, code = 'PROFILE_RECEIPT_STALE' })
  end
  redis.call('SET', KEYS[1], payload.context_json, 'PX', tonumber(payload.ttl_ms))
  return result({
    ok = true,
    context_id = payload.context_id,
    profile_generation = payload.profile_generation
  })
end

if operation == 'APPEND_AUDIT' then
  redis.call('RPUSH', KEYS[1], payload.event_json)
  redis.call('LTRIM', KEYS[1], -tonumber(payload.max_entries), -1)
  redis.call('PEXPIRE', KEYS[1], tonumber(payload.retention_ms))
  return result({ ok = true, event_id = payload.event_id })
end

if operation == 'AUDIT_SNAPSHOT' then
  local rows = redis.call('LRANGE', KEYS[1], 0, -1)
  local events = {}
  for _, serialized in ipairs(rows) do
    table.insert(events, cjson.decode(serialized))
  end
  return result({ ok = true, events = events })
end

return result({ ok = false, code = 'OPERATOR_STORE_UNAVAILABLE' })`;

const frozen = (value) => deepFreeze(structuredClone(value));
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const sha256Value = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const boundedInteger = (value, fallback, minimum, maximum) =>
  Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;

function ttlFromIso(value, now = Date.now()) {
  const expiry = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(expiry) && expiry > now ? expiry - now : null;
}

function privacySafeAuditEvent(value) {
  const event = {
    event_type: value?.event_type ?? null,
    decision: value?.decision ?? null,
    failure_code: value?.failure_code ?? null,
    occurred_at: value?.occurred_at ?? null,
    context_ref: value?.context_ref ?? null,
    exact_scope_hash: value?.exact_scope_hash ?? null,
  };
  const serialized = JSON.stringify(event);
  if (serialized.length > 4096
    || /access_code|submitted_code|raw_code|password|credential|secret|token/i.test(
      Object.keys(value || {}).join(' '),
    )) {
    return null;
  }
  return event;
}

export class UpstashSubdev1OperatorBridgeStore {
  #configuration;
  #resolveSecretReference;
  #fetch;
  #commandExecutor;
  #namespace;

  constructor({
    configuration,
    resolveSecretReference,
    fetchImpl = globalThis.fetch,
    commandExecutor = null,
  } = {}) {
    this.#configuration = structuredClone(configuration || {});
    this.#resolveSecretReference = resolveSecretReference;
    this.#fetch = fetchImpl;
    this.#commandExecutor = commandExecutor;
    const digest = sha256Value(configuration?.namespace_digest)
      ? configuration.namespace_digest.slice(0, 24)
      : 'unconfigured';
    this.#namespace =
      `${configuration?.namespace_prefix || 'more:cc:security:v2'}:subdev1:v1:${digest}`;
  }

  describe() {
    const configured = this.#configuration?.provider === 'UPSTASH_REDIS'
      && this.#configuration?.enabled === true
      && this.#configuration?.emergency_disabled === false
      && sha256Value(this.#configuration?.namespace_digest)
      && (
        typeof this.#commandExecutor === 'function'
        || (
          typeof this.#resolveSecretReference === 'function'
          && typeof this.#fetch === 'function'
          && typeof this.#configuration?.provider_endpoint_ref === 'string'
          && typeof this.#configuration?.provider_credential_ref === 'string'
        )
      );
    return frozen({
      store_version: SUBDEV1_UPSTASH_OPERATOR_STORE_VERSION,
      store_class: 'UPSTASH_REDIS_SUBDEV1_OPERATOR_BRIDGE',
      available: configured,
      deployment_grade: configured,
      shared_across_instances: configured,
      restart_durable: configured,
      no_local_fallback: true,
      synthetic_only: false,
      namespace_digest: sha256(this.#namespace),
      stores_raw_subdev1: false,
      stores_raw_cookie_tokens: false,
    });
  }

  async #execute(operation, keySuffix, payload) {
    if (this.describe().available !== true) {
      return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    }
    const key = `${this.#namespace}:${keySuffix}`;
    const command = [
      'EVAL',
      OPERATOR_STORE_SCRIPT,
      1,
      key,
      operation,
      JSON.stringify(payload),
    ];
    try {
      let raw;
      if (typeof this.#commandExecutor === 'function') {
        raw = await this.#commandExecutor(command);
      } else {
        const [endpoint, credential] = await Promise.all([
          this.#resolveSecretReference(
            this.#configuration.provider_endpoint_ref,
            { purpose: 'REMOTE_SHARED_SECURITY_PROVIDER_ENDPOINT' },
          ),
          this.#resolveSecretReference(
            this.#configuration.provider_credential_ref,
            { purpose: 'REMOTE_SHARED_SECURITY_PROVIDER_CREDENTIAL', secret: true },
          ),
        ]);
        if (typeof endpoint !== 'string'
          || !/^https:\/\//.test(endpoint)
          || typeof credential !== 'string'
          || credential.length < 16) {
          return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
        }
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          boundedInteger(this.#configuration.command_timeout_ms, 1500, 250, 3000),
        );
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
          if (!response?.ok) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
          const body = await response.json();
          if (!body || Object.hasOwn(body, 'error') || !Object.hasOwn(body, 'result')) {
            return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
          }
          raw = body.result;
        } finally {
          clearTimeout(timeout);
        }
      }
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? frozen(parsed)
        : frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    } catch {
      return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    }
  }

  async rateLimit({
    key,
    window_ms = 60_000,
    limit = 5,
    cooldown_base_ms = window_ms,
  }) {
    if (typeof key !== 'string' || key.length < 3) {
      return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    }
    return this.#execute('RATE_LIMIT', `rate:${sha256(key)}`, {
      window_ms: boundedInteger(window_ms, 60_000, 1_000, 3_600_000),
      limit: boundedInteger(limit, 5, 1, 100),
      cooldown_base_ms: boundedInteger(cooldown_base_ms, 60_000, 1_000, 3_600_000),
    });
  }

  async issueCsrfGrant(record) {
    const checked = validateCsrfGrant(record);
    const ttlMs = ttlFromIso(record?.expires_at);
    if (!checked.valid || !ttlMs) {
      return frozen({ ok: false, code: 'CSRF_VALIDATION_FAILED' });
    }
    const storedRecord = {
      ...record,
      expires_at_ms: Date.parse(record.expires_at),
    };
    return this.#execute('ISSUE_CSRF', `csrf:${record.proof_hash}`, {
      record_json: JSON.stringify(storedRecord),
      grant_id: record.grant_id,
      ttl_ms: ttlMs,
    });
  }

  async consumeCsrfGrant(input) {
    return this.#execute('CONSUME_CSRF', `csrf:${input?.proof_hash}`, {
      browser_binding_hash: input?.browser_binding_hash,
      method: input?.method,
      route: input?.route,
      environment_id: input?.environment_id,
      consumed_at: new Date(Number.isFinite(input?.now) ? input.now : Date.now()).toISOString(),
    });
  }

  async saveContext(context) {
    const ttlMs = ttlFromIso(context?.expires_at);
    if (!sha256Value(context?.token_hash) || !ttlMs) {
      return frozen({ ok: false, code: 'OPERATOR_CONTEXT_INVALID' });
    }
    return this.#execute('SAVE_CONTEXT', `context:${context.token_hash}`, {
      context_json: JSON.stringify(context),
      context_id: context.context_id,
      ttl_ms: ttlMs,
    });
  }

  async getContextByTokenHash(tokenHash) {
    if (!sha256Value(tokenHash)) {
      return frozen({
        ok: true,
        status: 'NOT_FOUND',
        context: null,
      });
    }
    return this.#execute('GET_CONTEXT', `context:${tokenHash}`, {});
  }

  async replaceContext({
    token_hash: tokenHash,
    expected_profile_generation: expectedProfileGeneration,
    context,
  }) {
    const ttlMs = ttlFromIso(context?.expires_at);
    if (!sha256Value(tokenHash)
      || context?.token_hash !== tokenHash
      || !Number.isInteger(expectedProfileGeneration)
      || !ttlMs) {
      return frozen({ ok: false, code: 'PROFILE_RECEIPT_STALE' });
    }
    return this.#execute('REPLACE_CONTEXT', `context:${tokenHash}`, {
      token_hash: tokenHash,
      expected_profile_generation: expectedProfileGeneration,
      context_json: JSON.stringify(context),
      context_id: context.context_id,
      profile_generation: context.profile_generation,
      ttl_ms: ttlMs,
    });
  }

  async appendAudit(value) {
    const event = privacySafeAuditEvent(value);
    if (!event) return frozen({ ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' });
    const eventId = `subdev1_audit_${sha256(JSON.stringify(event)).slice(0, 32)}`;
    return this.#execute('APPEND_AUDIT', 'audit', {
      event_json: JSON.stringify(event),
      event_id: eventId,
      max_entries: 2_000,
      retention_ms: boundedInteger(
        this.#configuration.audit_retention_days,
        7,
        1,
        30,
      ) * 86_400_000,
    });
  }

  async auditSnapshot() {
    const result = await this.#execute('AUDIT_SNAPSHOT', 'audit', {});
    return result.ok && Array.isArray(result.events) ? frozen(result.events) : frozen([]);
  }
}

export function createUpstashSubdev1OperatorBridgeStore(options = {}) {
  return new UpstashSubdev1OperatorBridgeStore(options);
}

export function subdev1OperatorStoreScriptDigest() {
  return sha256(OPERATOR_STORE_SCRIPT);
}
