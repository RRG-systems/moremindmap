import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSubdev1OperatorBridge,
  createUpstashSubdev1OperatorBridgeStore,
  SUBDEV1_PROFILE_CONSENT_PURPOSE,
  SUBDEV1_PROFILE_RECORD_VERSION,
} from '../src/lib/intelligenceFabric/coachConnect/privateRuntime/operatorBridge/index.js';

const origin = 'https://private.example.test';
const accessCode = ['SUB', 'DEV', '1'].join('');
const profileId = 'mm-20990101-aaaaaaaa';

function executor(now) {
  const records = new Map();
  const audits = [];
  return async (command) => {
    const key = command[3];
    const operation = command[4];
    const payload = JSON.parse(command[5]);
    const prior = records.get(key);
    if (prior?.expires_at <= now.value) records.delete(key);
    if (operation === 'RATE_LIMIT') return { ok: true, remaining: payload.limit - 1 };
    if (operation === 'ISSUE_CSRF') {
      if (records.has(key)) return { ok: false, code: 'CSRF_VALIDATION_FAILED' };
      const value = JSON.parse(payload.record_json);
      records.set(key, { value, expires_at: now.value + payload.ttl_ms });
      return { ok: true, grant_id: payload.grant_id };
    }
    if (operation === 'CONSUME_CSRF') {
      const found = records.get(key);
      if (!found
        || found.value.status !== 'ACTIVE'
        || found.value.browser_binding_hash !== payload.browser_binding_hash
        || found.value.method !== payload.method
        || found.value.route !== payload.route
        || found.value.environment_id !== payload.environment_id) {
        return { ok: false, code: 'CSRF_VALIDATION_FAILED' };
      }
      found.value.status = 'CONSUMED';
      return { ok: true, grant_id: found.value.grant_id };
    }
    if (operation === 'SAVE_CONTEXT') {
      if (records.has(key)) return { ok: false, code: 'OPERATOR_CONTEXT_INVALID' };
      records.set(key, {
        value: payload.context_json,
        expires_at: now.value + payload.ttl_ms,
      });
      return { ok: true, context_id: payload.context_id };
    }
    if (operation === 'GET_CONTEXT') {
      const found = records.get(key);
      return found
        ? { ok: true, status: 'FOUND', context_json: found.value }
        : { ok: true, status: 'NOT_FOUND', context_json: null };
    }
    if (operation === 'REPLACE_CONTEXT') {
      const found = records.get(key);
      if (!found
        || JSON.parse(found.value).profile_generation
          !== payload.expected_profile_generation) {
        return { ok: false, code: 'PROFILE_RECEIPT_STALE' };
      }
      found.value = payload.context_json;
      found.expires_at = now.value + payload.ttl_ms;
      return {
        ok: true,
        context_id: payload.context_id,
        profile_generation: payload.profile_generation,
      };
    }
    if (operation === 'APPEND_AUDIT') {
      audits.push(JSON.parse(payload.event_json));
      return { ok: true, event_id: payload.event_id };
    }
    if (operation === 'AUDIT_SNAPSHOT') return { ok: true, events: audits };
    return { ok: false, code: 'OPERATOR_STORE_UNAVAILABLE' };
  };
}

function fixture() {
  const now = { value: Date.now() };
  const commandExecutor = executor(now);
  const configuration = {
    provider: 'UPSTASH_REDIS',
    enabled: true,
    emergency_disabled: false,
    namespace_prefix: 'more:cc:security:v2',
    namespace_digest: 'a'.repeat(64),
    provider_endpoint_ref: 'UPSTASH_ENDPOINT_REF',
    provider_credential_ref: 'UPSTASH_CREDENTIAL_REF',
    command_timeout_ms: 1000,
    audit_retention_days: 7,
  };
  const env = {
    NODE_ENV: 'production',
    MORE_SUBDEV1_OPERATOR_ENABLED: 'true',
    MORE_SUBDEV1_OPERATOR_CODE: accessCode,
    MORE_SUBDEV1_OPERATOR_SIGNING_SECRET:
      'deployment-store-signing-secret-at-least-thirty-two-bytes',
    MORE_SUBDEV1_OPERATOR_ALLOWED_ORIGINS: origin,
    MORE_SUBDEV1_OPERATOR_ENVIRONMENT_ID: 'private_beta_live',
    MORE_SUBDEV1_OPERATOR_TTL_SECONDS: '60',
  };
  const repository = {
    async resolveExactProfile(selected) {
      return selected === profileId
        ? {
            status: 'FOUND',
            record: {
              record_version: SUBDEV1_PROFILE_RECORD_VERSION,
              profile_id: profileId,
              subscriber_subject_ref: 'subscriber_subject_a',
              exact_scope: {
                tenant_id: 'tenant_a',
                profile_id: profileId,
                business_id: 'business_a',
                subscriber_id: 'subscriber_a',
              },
              profile_revision: 'revision_a',
              consent_ref: 'private_test_approval_a',
              consent_purpose: SUBDEV1_PROFILE_CONSENT_PURPOSE,
              consent_status: 'ACTIVE',
              provenance: {
                source: 'SYNTHETIC_ISOLATED_FIXTURE',
                record_ref: 'fixture_a',
              },
            },
          }
        : { status: 'NOT_FOUND', record: null };
    },
  };
  let token = 0;
  const createBridge = () => createSubdev1OperatorBridge({
    env,
    store: createUpstashSubdev1OperatorBridgeStore({
      configuration,
      commandExecutor,
    }),
    profileRepository: repository,
    clock: () => now.value,
    randomToken: () => `deployment-token-${String(token += 1).padStart(48, '0')}`,
  });
  return { now, createBridge };
}

function request(method = 'POST') {
  return { method, headers: { origin } };
}

async function csrf(bridge, browserToken, method = 'POST') {
  return bridge.issueCsrf({
    request: request(method),
    browserToken,
    method,
  });
}

test('restart, browser binding, generation, revocation, clear, and TTL preserve bridge semantics', async () => {
  const { now, createBridge } = fixture();
  const first = createBridge();
  const browser = await first.establishBrowser();
  const activationCsrf = await csrf(first, browser.browser_token);
  const activated = await first.activate({
    request: request(),
    browserToken: browser.browser_token,
    csrfProof: activationCsrf.csrf_proof,
    submittedCode: accessCode,
  });
  assert.equal(activated.ok, true);

  const restarted = createBridge();
  assert.equal((await restarted.inspect({
    contextToken: activated.context_token,
    browserToken: browser.browser_token,
  })).active, true);
  assert.equal((await restarted.inspect({
    contextToken: activated.context_token,
    browserToken: `${browser.browser_token}copied`,
  })).active, false);

  const selectionCsrf = await csrf(restarted, browser.browser_token);
  const selected = await restarted.selectProfile({
    request: request(),
    browserToken: browser.browser_token,
    contextToken: activated.context_token,
    csrfProof: selectionCsrf.csrf_proof,
    profileId,
  });
  assert.equal(selected.ok, true);
  const consumed = await restarted.consume({
    contextToken: activated.context_token,
    browserToken: browser.browser_token,
    action: 'OPEN_SUBSCRIPTION',
    profileReceipt: selected.profile_receipt,
  });
  assert.equal(consumed.allowed, true);

  const revoked = await restarted.revoke({
    contextToken: activated.context_token,
    browserToken: browser.browser_token,
    reasonCode: 'synthetic_test',
  });
  assert.equal(revoked.revoked, true);
  assert.equal((await restarted.inspect({
    contextToken: activated.context_token,
    browserToken: browser.browser_token,
  })).active, false);

  const secondBrowser = await restarted.establishBrowser();
  const secondCsrf = await csrf(restarted, secondBrowser.browser_token);
  const second = await restarted.activate({
    request: request(),
    browserToken: secondBrowser.browser_token,
    csrfProof: secondCsrf.csrf_proof,
    submittedCode: accessCode,
  });
  const clearCsrf = await csrf(restarted, secondBrowser.browser_token, 'DELETE');
  assert.equal((await restarted.clear({
    request: request('DELETE'),
    browserToken: secondBrowser.browser_token,
    contextToken: second.context_token,
    csrfProof: clearCsrf.csrf_proof,
  })).cleared, true);

  const expiryBrowser = await restarted.establishBrowser();
  const expiryCsrf = await csrf(restarted, expiryBrowser.browser_token);
  const expiring = await restarted.activate({
    request: request(),
    browserToken: expiryBrowser.browser_token,
    csrfProof: expiryCsrf.csrf_proof,
    submittedCode: accessCode,
  });
  now.value += 61_000;
  assert.equal((await restarted.inspect({
    contextToken: expiring.context_token,
    browserToken: expiryBrowser.browser_token,
  })).active, false);
});
