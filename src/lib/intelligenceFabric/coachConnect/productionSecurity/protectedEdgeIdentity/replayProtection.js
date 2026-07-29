import { hashCanonicalJson } from '../../../hashing.js';
import { deepFreeze } from '../../../validation.js';
import {
  ASYNC_SECURITY_COMMAND_RESULT_VERSION,
  ASYNC_SECURITY_COMMAND_VERSION,
  validateAsyncSecurityCommandResult,
  validateAsyncSecurityHealth,
} from '../asyncSecurityContracts.js';
import {
  invokeAsyncSecurityMethod,
} from '../asyncSharedSecurityStatePort.js';

const frozen = (value) => deepFreeze(structuredClone(value));
const deny = (code) => frozen({ ok: false, allowed: false, code });
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function createProtectedEdgeReplayProtectorV1({
  statePort,
  environmentId,
  clock = () => Date.now(),
} = {}) {
  return Object.freeze({
    async claim({
      replayKeyHash,
      fingerprint,
      correlationRef,
      expiresAtMs,
      strictOneTime = true,
    } = {}) {
      if (!statePort
        || !sha256(replayKeyHash)
        || !sha256(fingerprint)
        || typeof correlationRef !== 'string'
        || correlationRef.length < 3
        || !Number.isFinite(expiresAtMs)
        || expiresAtMs <= clock()) {
        return deny('PROTECTED_EDGE_REPLAY_STATE_UNAVAILABLE');
      }
      try {
        const health = await invokeAsyncSecurityMethod(statePort, 'health');
        const checkedHealth = validateAsyncSecurityHealth(health);
        if (!checkedHealth.valid
          || health.environment_id !== environmentId
          || health.state !== 'HEALTHY'
          || health.allowed_for_security !== true
          || health.no_local_fallback !== true) {
          return deny('PROTECTED_EDGE_REPLAY_STATE_UNAVAILABLE');
        }
        const command = {
          command_version: ASYNC_SECURITY_COMMAND_VERSION,
          command_type: 'CLAIM_REPLAY',
          environment_id: environmentId,
          idempotency_key_hash: replayKeyHash,
          fingerprint,
          correlation_ref: correlationRef,
          expected_versions: {},
          arguments: {
            replay_key_hash: replayKeyHash,
            expires_at_ms: expiresAtMs,
            context_ref: `edge_context_${hashCanonicalJson({
              replayKeyHash,
              fingerprint,
            }).slice(0, 32)}`,
          },
        };
        const result = await invokeAsyncSecurityMethod(statePort, 'executeAtomic', [command]);
        const checked = validateAsyncSecurityCommandResult(result, 'CLAIM_REPLAY');
        if (!checked.valid
          || result.result_version !== ASYNC_SECURITY_COMMAND_RESULT_VERSION
          || result.ok !== true
          || result.committed !== true) {
          return deny(result?.failure_code || 'PROTECTED_EDGE_REPLAY_DETECTED');
        }
        if (strictOneTime && result.idempotent_replay === true) {
          return deny('PROTECTED_EDGE_REPLAY_DETECTED');
        }
        return frozen({
          ok: true,
          allowed: true,
          code: null,
          idempotent_session_reuse: result.idempotent_replay === true,
          audit_receipt_ref: result.audit_receipt_ref,
        });
      } catch {
        return deny('PROTECTED_EDGE_REPLAY_STATE_UNAVAILABLE');
      }
    },
  });
}
