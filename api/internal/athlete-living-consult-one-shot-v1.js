import { Buffer } from 'node:buffer';
import { createAthleteConsultingV2Handler } from '../../server/athleteConsultingV2/handler.js';
import { hashCanonicalJson } from '../../src/lib/intelligenceFabric/hashing.js';
import {
  athleteConsultingDarrenDemoEnabled,
  authenticateAthleteConsultingDemoRequest,
  bindAthleteConsultingGovernedActor,
  consumeAthleteConsultingDemoCsrf,
  deriveAthleteConsultingActorCapabilities,
  enforceAthleteConsultingDemoRateLimit,
  issueAthleteConsultingDemoCsrf,
  sameOriginLeadershipDemoRequest,
} from '../engine/leadershipDemo/authority.js';
import { getSubscriptionRedis } from '../engine/subscriptionV1/internalDevInfrastructure.js';
import { createAthleteLivingConsultOneShotDemoRuntimeV1 } from '../../server/athleteLivingConsultOneShotV1/demoRuntime.js';
import {
  athleteConsultingFixtureBindingV1,
  athleteConsultingSessionKeys,
  createAthleteConsultingSessionEnvelopeV1,
  persistAthleteConsultingSessionEnvelopeV1,
  readAthleteConsultingSessionEnvelopeV1,
  resetAthleteConsultingSessionEnvelopeV1,
  withAthleteConsultingSessionLeaseV1,
} from '../../server/athleteLivingConsultOneShotV1/durableInfrastructure.js';

const ACTIONS = new Set([
  'START_MY_FIRST_SESSION',
  'START_SESSION',
  'SET_PAGE_CONTEXT',
  'TURN',
  'GRANT_BOS',
  'REVOKE_BOS',
  'PROPOSE_PLAN',
  'REVISE_PROPOSAL',
  'CONFIRM',
  'RECORD_ATTEMPT',
  'RECORD_OUTCOME',
  'REQUEST_CLOSE',
  'CLOSE_SESSION',
  'RESET',
]);
const ATHLETE_ROOMS = new Set(['HOME', 'YOU', 'YOUR_SPORT', 'PLAN']);
const ATHLETE_OPEN_LOOP_STATES = new Set(['OPEN', 'DUE', 'ATTEMPTED', 'COMPLETED', 'MISSED', 'INTELLIGENTLY_ABANDONED', 'SUPERSEDED', 'UNRESOLVED']);
const ATHLETE_EXECUTION_DEGREES = new Set(['PARTIAL', 'COMPLETE']);
const ATHLETE_OUTCOME_CLASSIFICATIONS = new Set(['BENEFICIAL', 'STERILE', 'ADVERSE', 'MIXED', 'INCONCLUSIVE', 'NOT_TESTED_INSUFFICIENT_EXECUTION', 'CONFOUNDED', 'INTELLIGENTLY_ABANDONED']);
const INTERVENTION_LINEAGE_ID = /^intervention_[a-f0-9]{24}$/u;
const MAX_TURN_MESSAGE_BYTES = 48 * 1024;
const MAX_CONVERSATION_ENTRIES = 240;
const MAX_OPERATIONAL_RUNTIME_SNAPSHOT_BYTES = 1024 * 1024;

function utf8Bytes(value) {
  return typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : Number.POSITIVE_INFINITY;
}

function jsonEncodedStringBytes(value) {
  return typeof value === 'string'
    ? Buffer.byteLength(JSON.stringify(value), 'utf8')
    : Number.POSITIVE_INFINITY;
}

function validBoundedText(value, maxBytes, { required = false } = {}) {
  if (value == null && !required) return true;
  return typeof value === 'string'
    && (!required || Boolean(value.trim()))
    && utf8Bytes(value) <= maxBytes
    && jsonEncodedStringBytes(value) <= maxBytes;
}

function validPageContext(value) {
  if (!value || typeof value !== 'object' || !ATHLETE_ROOMS.has(value.room)) return false;
  const hasSnake = Object.hasOwn(value, 'visible_object_ids');
  const hasCamel = Object.hasOwn(value, 'visibleObjectIds');
  if (hasSnake && hasCamel) return false;
  const ids = hasSnake ? value.visible_object_ids : hasCamel ? value.visibleObjectIds : [];
  return Array.isArray(ids)
    && ids.length <= 100
    && new Set(ids).size === ids.length
    && ids.every((id) => typeof id === 'string' && Boolean(id.trim())
      && utf8Bytes(id) <= 200 && jsonEncodedStringBytes(id) <= 200);
}

function requestPayloadError(body, { conversationCount = null } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'ATHLETE_LIVING_CONSULT_PAYLOAD_INVALID';
  }
  if (body.action === 'SET_PAGE_CONTEXT' && !validPageContext(body)) {
    return 'ATHLETE_PAGE_CONTEXT_INVALID';
  }
  if (body.action === 'TURN') {
    if (!validBoundedText(body.message, MAX_TURN_MESSAGE_BYTES, { required: true })
      || jsonEncodedStringBytes(body.message.trim()) > MAX_TURN_MESSAGE_BYTES) {
      return 'ATHLETE_TURN_MESSAGE_TOO_LARGE_OR_INVALID';
    }
    if (body.page_context != null && !validPageContext(body.page_context)) {
      return 'ATHLETE_PAGE_CONTEXT_INVALID';
    }
    if (Number.isInteger(conversationCount) && conversationCount > MAX_CONVERSATION_ENTRIES - 2) {
      return 'ATHLETE_CONVERSATION_LIMIT_REACHED';
    }
  }
  if (['PROPOSE_PLAN', 'REVISE_PROPOSAL'].includes(body.action)) {
    if (!validBoundedText(body.summary, 1_200)
      || !validBoundedText(body.reason, 1_200)
      || (body.items != null && (!Array.isArray(body.items) || body.items.length > 12
        || body.items.some((item) => !item || typeof item !== 'object'
          || !validBoundedText(item.field, 100, { required: true })
          || !validBoundedText(item.value, 1_200, { required: true }))))) {
      return 'ATHLETE_PROPOSAL_PAYLOAD_INVALID';
    }
  }
  if (['RECORD_ATTEMPT', 'RECORD_OUTCOME'].includes(body.action)) {
    if (!validBoundedText(body.summary, 1_000, { required: true })) {
      return 'ATHLETE_EVIDENCE_SUMMARY_INVALID';
    }
    if (!INTERVENTION_LINEAGE_ID.test(body.intervention_lineage_id || '')
      || (body.open_loop_state != null && !ATHLETE_OPEN_LOOP_STATES.has(body.open_loop_state))) {
      return 'ATHLETE_EVIDENCE_LINEAGE_INVALID';
    }
  }
  if (body.action === 'RECORD_ATTEMPT'
    && !ATHLETE_EXECUTION_DEGREES.has(body.execution_degree)) {
    return 'ATHLETE_EXECUTION_DEGREE_INVALID';
  }
  if (body.action === 'RECORD_OUTCOME') {
    if (!ATHLETE_OUTCOME_CLASSIFICATIONS.has(body.outcome_classification)) {
      return 'ATHLETE_OUTCOME_CLASSIFICATION_INVALID';
    }
    for (const field of ['confounders', 'external_shocks']) {
      if (body[field] != null && (!Array.isArray(body[field]) || body[field].length > 20
        || body[field].some((value) => !validBoundedText(value, 600, { required: true }))
        || Buffer.byteLength(JSON.stringify(body[field]), 'utf8') > 1_200)) {
        return 'ATHLETE_EVIDENCE_CONTEXT_INVALID';
      }
    }
  }
  if (body.action === 'CLOSE_SESSION'
    && !validBoundedText(body.alignment_message, 800, { required: true })) {
    return 'ATHLETE_MUTUAL_CLOSE_ALIGNMENT_REQUIRED';
  }
  return null;
}

function stateCapacityError(runtime, action) {
  if (action === 'RESET') return null;
  const snapshotBytes = Buffer.byteLength(JSON.stringify(runtime.snapshot()), 'utf8');
  return snapshotBytes >= MAX_OPERATIONAL_RUNTIME_SNAPSHOT_BYTES
    ? 'ATHLETE_SESSION_CAPACITY_REACHED'
    : null;
}

function requestUrl(request) {
  return new URL(String(request.url || '/api/internal/athlete-living-consult-one-shot-v1'), 'http://127.0.0.1');
}

function fixtureFromRequest(request, body = null) {
  return String(body?.fixture_id || requestUrl(request).searchParams.get('fixture') || 'mika').trim().toLowerCase();
}

async function readBody(request, maxBytes = 400_000) {
  if (request.body && typeof request.body === 'object') {
    if (Buffer.byteLength(JSON.stringify(request.body), 'utf8') > maxBytes) throw new Error('ATHLETE_LIVING_CONSULT_REQUEST_TOO_LARGE');
    return request.body;
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('ATHLETE_LIVING_CONSULT_REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function setHeaders(response, contentType = 'application/json; charset=utf-8') {
  response.setHeader('content-type', contentType);
  response.setHeader('cache-control', 'no-store, private, max-age=0');
  response.setHeader('pragma', 'no-cache');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
}

function send(response, status, payload) {
  response.statusCode = status;
  setHeaders(response);
  response.end(JSON.stringify(payload));
}

function header(request, name) {
  if (typeof request.get === 'function') return request.get(name);
  return request.headers?.[name.toLowerCase()];
}

function statusFor(code) {
  if (/CSRF|ORIGIN|AUTH|DENIED/u.test(code || '')) return 403;
  if (/STALE|CONFLICT/u.test(code || '')) return 409;
  if (/NOT_CONFIGURED/u.test(code || '')) return 503;
  return 422;
}

export function createAthleteLivingConsultOneShotHandlerV1({
  env = globalThis.process?.env || {},
  redis: injectedRedis = null,
  createRuntime = null,
  authenticate = null,
  allowReset = true,
  clock = () => new Date(),
} = {}) {
  const v2Handler = createAthleteConsultingV2Handler({ env, redis: injectedRedis, authenticate });
  const runtimeFactory = createRuntime || ((fixtureId, { runtime_snapshot = null } = {}) => (
    createAthleteLivingConsultOneShotDemoRuntimeV1({
      env,
      fixture_id: fixtureId,
      runtime_snapshot,
    })
  ));

  function clientAuthority(authority) {
    return {
      conversation_capability: authority.conversation,
      shared_editor_capability: authority.shared_editor,
      athlete_actor_capability: authority.athlete,
      instructor_actor_capability: authority.instructor,
    };
  }

  async function authorize(redis, request) {
    if (typeof authenticate === 'function') return authenticate({ redis, req: request, env });
    return authenticateAthleteConsultingDemoRequest({ redis, req: request, env });
  }

  async function baseline(fixtureId) {
    const runtime = await runtimeFactory(fixtureId, { runtime_snapshot: null });
    const demoFixture = runtime.inspect?.().demo_fixture;
    const fixtureBinding = athleteConsultingFixtureBindingV1(fixtureId, demoFixture);
    const keys = athleteConsultingSessionKeys({ fixtureBinding });
    return { runtime, fixtureBinding, keys };
  }

  async function hydratedRuntime(fixtureId, seed, envelope) {
    return envelope
      ? runtimeFactory(fixtureId, { runtime_snapshot: envelope.runtime_snapshot })
      : seed;
  }

  function operationReceipt({ operationIdHash, semanticHash, action, status, startedAt, result = null }) {
    return {
      operation_id_hash: operationIdHash,
      semantic_hash: semanticHash,
      action,
      status,
      started_at: startedAt,
      completed_at: ['COMPLETED', 'REFUSED'].includes(status) ? new Date(clock()).toISOString() : null,
      result_code: result?.code || null,
      result_revision: Number.isInteger(result?.revision) ? result.revision : null,
      result_state_hash: result?.state_hash || null,
      mutation_performed: result?.mutation_performed === true,
    };
  }

  function responseEnvelope(payload, { fixtureId, csrfToken, authority }) {
    return {
      ...payload,
      fixture_id: fixtureId,
      csrf_token: csrfToken,
      authority_capabilities: clientAuthority(authority),
    };
  }

  async function freshCsrf({ redis, auth, keys, payload, resetEpoch }) {
    return issueAthleteConsultingDemoCsrf({
      redis,
      capabilityHash: auth.capability_hash,
      fixtureScopeHash: keys.fixture_scope_hash,
      runtimeStateHash: payload.state_hash,
      resetEpoch,
    });
  }

  return async function athleteLivingConsultOneShotHandler(request, response) {
    try {
      if (!athleteConsultingDarrenDemoEnabled(env)) {
        return send(response, 404, { ok: false, code: 'ATHLETE_CONSULTING_DEMO_DEFAULT_OFF' });
      }
      if (request.method === 'GET' && requestUrl(request).searchParams.get('version_only') === '1') {
        return send(response, 200, { version: env.ATHLETE_CONSULTING_V2_ENABLED === 'true' ? 2 : 1 });
      }
      if (env.ATHLETE_CONSULTING_V2_ENABLED === 'true') return await v2Handler(request, response);
      const method = String(request.method || 'GET').toUpperCase();
      if (!sameOriginLeadershipDemoRequest(request, { allowMissingForGet: method === 'GET' })) {
        return send(response, 403, { ok: false, code: 'ATHLETE_LIVING_CONSULT_ORIGIN_DENIED' });
      }
      if (!['GET', 'POST'].includes(method)) return send(response, 405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
      const mediaType = String(header(request, 'content-type') || '').toLowerCase().split(';')[0].trim();
      if (method === 'POST' && mediaType !== 'application/json') {
        return send(response, 415, { ok: false, code: 'ATHLETE_LIVING_CONSULT_JSON_REQUIRED' });
      }
      const redis = injectedRedis || getSubscriptionRedis(env);
      const auth = await authorize(redis, request);
      if (!auth?.ok || auth.capability?.synthetic_only !== true
        || auth.capability?.allowed_product !== 'athlete-consulting-tool') {
        return send(response, auth?.status || 403, { ok: false, code: auth?.code || 'ATHLETE_LIVING_CONSULT_SYNTHETIC_AUTHORITY_REQUIRED' });
      }
      const body = method === 'POST' ? await readBody(request) : null;
      const fixtureId = fixtureFromRequest(request, body);
      if (!auth.capability.allowed_subjects?.includes(fixtureId)) {
        return send(response, 403, { ok: false, code: 'ATHLETE_CONSULT_DEMO_FIXTURE_NOT_ALLOWED' });
      }
      if (method === 'POST' && !ACTIONS.has(body?.action)) {
        return send(response, 422, { ok: false, code: 'ATHLETE_LIVING_CONSULT_ACTION_DENIED' });
      }
      if (method === 'POST' && (typeof body.idempotency_key !== 'string'
        || body.idempotency_key.length < 16 || body.idempotency_key.length > 180)) {
        return send(response, 422, { ok: false, code: 'ATHLETE_LIVING_CONSULT_IDEMPOTENCY_KEY_REQUIRED' });
      }
      const staticPayloadError = method === 'POST' ? requestPayloadError(body) : null;
      if (staticPayloadError) return send(response, 422, { ok: false, code: staticPayloadError });
      const seed = await baseline(fixtureId);
      const rate = await enforceAthleteConsultingDemoRateLimit({
        redis,
        capabilityHash: auth.capability_hash,
        fixtureScopeHash: seed.keys.fixture_scope_hash,
      });
      if (!rate.allowed) return send(response, 429, { ok: false, code: 'ATHLETE_LIVING_CONSULT_RATE_LIMITED' });
      const authority = deriveAthleteConsultingActorCapabilities({
        capabilityToken: auth.capability_token,
        fixtureId,
      });

      return await withAthleteConsultingSessionLeaseV1({
        redis,
        keys: seed.keys,
        operation: async (lease) => {
          const read = await readAthleteConsultingSessionEnvelopeV1({
            redis,
            keys: seed.keys,
            fixtureBinding: seed.fixtureBinding,
          });
          let priorEnvelope = read.envelope;
          const grantExpiresAt = Date.parse(priorEnvelope?.runtime_snapshot?.current_grant?.expires_at || '');
          const grantExpired = priorEnvelope && Number.isFinite(grantExpiresAt)
            && grantExpiresAt <= new Date(clock()).getTime();
          let runtime = grantExpired
            ? seed.runtime
            : await hydratedRuntime(fixtureId, seed.runtime, priorEnvelope);
          if (grantExpired) {
            priorEnvelope = createAthleteConsultingSessionEnvelopeV1({
              fixtureBinding: seed.fixtureBinding,
              runtimeSnapshot: runtime.snapshot(),
              priorEnvelope,
              resetEpoch: priorEnvelope.reset_epoch + 1,
              operationReceipt: null,
              idempotencyReceipts: priorEnvelope.idempotency_receipts,
              now: clock(),
            });
            await persistAthleteConsultingSessionEnvelopeV1({
              redis,
              keys: seed.keys,
              fixtureBinding: seed.fixtureBinding,
              lease,
              envelope: priorEnvelope,
              rotateBackup: true,
            });
          }
          if (!priorEnvelope) {
            priorEnvelope = createAthleteConsultingSessionEnvelopeV1({
              fixtureBinding: seed.fixtureBinding,
              runtimeSnapshot: runtime.snapshot(),
              now: clock(),
            });
            await persistAthleteConsultingSessionEnvelopeV1({
              redis,
              keys: seed.keys,
              fixtureBinding: seed.fixtureBinding,
              lease,
              envelope: priorEnvelope,
            });
          }

          if (method === 'GET') {
            await lease.assertOwned();
            const payload = runtime.bootstrap();
            const csrfToken = await freshCsrf({
              redis,
              auth,
              keys: seed.keys,
              payload,
              resetEpoch: priorEnvelope.reset_epoch,
            });
            return send(response, 200, responseEnvelope(payload, {
              fixtureId,
              csrfToken,
              authority,
            }));
          }

          const current = runtime.bootstrap();
          const csrfOk = await consumeAthleteConsultingDemoCsrf({
            redis,
            capabilityHash: auth.capability_hash,
            fixtureScopeHash: seed.keys.fixture_scope_hash,
            runtimeStateHash: current.state_hash,
            resetEpoch: priorEnvelope.reset_epoch,
            proof: header(request, 'x-athlete-living-consult-csrf'),
          });
          if (!csrfOk) return send(response, 403, { ok: false, code: 'ATHLETE_LIVING_CONSULT_CSRF_DENIED' });

          const operationIdHash = hashCanonicalJson({
            fixture_scope_hash: seed.keys.fixture_scope_hash,
            client_idempotency_key: body.idempotency_key,
          });
          const semanticBody = { ...body };
          delete semanticBody.idempotency_key;
          delete semanticBody.actor_capability;
          delete semanticBody.conversation_capability;
          delete semanticBody.shared_editor_capability;
          const semanticHash = hashCanonicalJson({ action: body.action, payload: semanticBody });
          const priorOperation = priorEnvelope.operation_receipt;
          const priorIdempotency = priorEnvelope.idempotency_receipts
            .find((receipt) => receipt.operation_id_hash === operationIdHash);
          if (priorIdempotency && priorIdempotency.semantic_hash !== semanticHash) {
            const csrfToken = await freshCsrf({ redis, auth, keys: seed.keys, payload: current, resetEpoch: priorEnvelope.reset_epoch });
            return send(response, 409, responseEnvelope({ ok: false, code: 'ATHLETE_IDEMPOTENCY_CONFLICT' }, { fixtureId, csrfToken, authority }));
          }
          if (priorIdempotency) {
            const payload = {
              ...current,
              code: 'ATHLETE_IDEMPOTENT_REPLAY',
              original_result_code: priorIdempotency.result_code,
              original_result_revision: priorIdempotency.result_revision,
              original_result_state_hash: priorIdempotency.result_state_hash,
              original_mutation_performed: priorIdempotency.mutation_performed,
            };
            const csrfToken = await freshCsrf({ redis, auth, keys: seed.keys, payload, resetEpoch: priorEnvelope.reset_epoch });
            return send(response, 200, responseEnvelope(payload, { fixtureId, csrfToken, authority }));
          }
          if (priorOperation?.operation_id_hash === operationIdHash
            && priorOperation.semantic_hash !== semanticHash) {
            const csrfToken = await freshCsrf({ redis, auth, keys: seed.keys, payload: current, resetEpoch: priorEnvelope.reset_epoch });
            return send(response, 409, responseEnvelope({
              ok: false,
              code: 'ATHLETE_IDEMPOTENCY_CONFLICT',
            }, { fixtureId, csrfToken, authority }));
          }
          if (priorOperation?.status === 'IN_PROGRESS' && body.action !== 'RESET') {
            const csrfToken = await freshCsrf({ redis, auth, keys: seed.keys, payload: current, resetEpoch: priorEnvelope.reset_epoch });
            return send(response, 409, responseEnvelope({
              ok: false,
              code: 'ATHLETE_OPERATION_OUTCOME_UNKNOWN',
              operation_matches: priorOperation.operation_id_hash === operationIdHash
                && priorOperation.semantic_hash === semanticHash,
            }, { fixtureId, csrfToken, authority }));
          }

          const stateBoundPayloadError = requestPayloadError(body, {
            conversationCount: current.conversation?.length,
          }) || stateCapacityError(runtime, body.action);
          if (stateBoundPayloadError) {
            const csrfToken = await freshCsrf({
              redis,
              auth,
              keys: seed.keys,
              payload: current,
              resetEpoch: priorEnvelope.reset_epoch,
            });
            return send(response, 422, responseEnvelope({
              ok: false,
              code: stateBoundPayloadError,
              current_revision: current.revision,
              current_state_hash: current.state_hash,
            }, { fixtureId, csrfToken, authority }));
          }

          if (body.action === 'RESET') {
            if (!allowReset) {
              const csrfToken = await freshCsrf({ redis, auth, keys: seed.keys, payload: current, resetEpoch: priorEnvelope.reset_epoch });
              return send(response, 403, responseEnvelope({ ok: false, code: 'ATHLETE_LIVING_CONSULT_RESET_DENIED' }, { fixtureId, csrfToken, authority }));
            }
            runtime = await runtimeFactory(fixtureId, { runtime_snapshot: null });
            const payload = { ...runtime.bootstrap(), code: 'ATHLETE_LIVING_CONSULT_SYNTHETIC_RESET' };
            const resetReceipt = operationReceipt({
              operationIdHash,
              semanticHash,
              action: body.action,
              status: 'COMPLETED',
              startedAt: new Date(clock()).toISOString(),
              result: payload,
            });
            const resetEnvelope = createAthleteConsultingSessionEnvelopeV1({
              fixtureBinding: seed.fixtureBinding,
              runtimeSnapshot: runtime.snapshot(),
              priorEnvelope,
              resetEpoch: priorEnvelope.reset_epoch + 1,
              operationReceipt: resetReceipt,
              idempotencyReceipts: [
                ...priorEnvelope.idempotency_receipts,
                resetReceipt,
              ].slice(-32),
              now: clock(),
            });
            await resetAthleteConsultingSessionEnvelopeV1({
              redis,
              keys: seed.keys,
              fixtureBinding: seed.fixtureBinding,
              lease,
              baselineEnvelope: resetEnvelope,
            });
            const csrfToken = await freshCsrf({ redis, auth, keys: seed.keys, payload, resetEpoch: resetEnvelope.reset_epoch });
            return send(response, 200, responseEnvelope(payload, { fixtureId, csrfToken, authority }));
          }

          const bound = bindAthleteConsultingGovernedActor({
            action: body.action,
            body,
            expectedCapabilities: authority,
          });
          if (!bound.ok) {
            const csrfToken = await freshCsrf({ redis, auth, keys: seed.keys, payload: current, resetEpoch: priorEnvelope.reset_epoch });
            return send(response, 403, responseEnvelope({ ok: false, code: bound.code }, { fixtureId, csrfToken, authority }));
          }

          const startedAt = new Date(clock()).toISOString();
          const reservation = operationReceipt({
            operationIdHash,
            semanticHash,
            action: body.action,
            status: 'IN_PROGRESS',
            startedAt,
          });
          priorEnvelope = createAthleteConsultingSessionEnvelopeV1({
            fixtureBinding: seed.fixtureBinding,
            runtimeSnapshot: runtime.snapshot(),
            priorEnvelope,
            operationReceipt: reservation,
            now: clock(),
          });
          await persistAthleteConsultingSessionEnvelopeV1({
            redis,
            keys: seed.keys,
            fixtureBinding: seed.fixtureBinding,
            lease,
            envelope: priorEnvelope,
            rotateBackup: true,
          });

          const progressive = body.action === 'TURN'
            && String(header(request, 'accept') || '').includes('application/x-ndjson')
            && typeof response.write === 'function';
          if (progressive) setHeaders(response, 'application/x-ndjson; charset=utf-8');
          const runtimeBody = { ...bound.body, idempotency_key: operationIdHash };
          const persistCheckpoint = async () => {
            await lease.assertOwned();
            priorEnvelope = createAthleteConsultingSessionEnvelopeV1({
              fixtureBinding: seed.fixtureBinding,
              runtimeSnapshot: runtime.snapshot(),
              priorEnvelope,
              operationReceipt: reservation,
              now: clock(),
            });
            await persistAthleteConsultingSessionEnvelopeV1({
              redis,
              keys: seed.keys,
              fixtureBinding: seed.fixtureBinding,
              lease,
              envelope: priorEnvelope,
            });
          };
          const result = await runtime.dispatch(body.action, runtimeBody, {
            onDurableCheckpoint: persistCheckpoint,
            onCoachingReady: async (payload) => {
              await persistCheckpoint();
              await lease.assertOwned();
              if (progressive) response.write(`${JSON.stringify({ ...payload, fixture_id: fixtureId })}\n`);
            },
          });
          await lease.assertOwned();
          const terminalState = runtime.bootstrap();
          const finalReceipt = operationReceipt({
            operationIdHash,
            semanticHash,
            action: body.action,
            status: result.ok ? 'COMPLETED' : 'REFUSED',
            startedAt,
            result: {
              ...result,
              revision: terminalState.revision,
              state_hash: terminalState.state_hash,
            },
          });
          const finalEnvelope = createAthleteConsultingSessionEnvelopeV1({
            fixtureBinding: seed.fixtureBinding,
            runtimeSnapshot: runtime.snapshot(),
            priorEnvelope,
            operationReceipt: finalReceipt,
            idempotencyReceipts: [...priorEnvelope.idempotency_receipts, finalReceipt].slice(-32),
            now: clock(),
          });
          await persistAthleteConsultingSessionEnvelopeV1({
            redis,
            keys: seed.keys,
            fixtureBinding: seed.fixtureBinding,
            lease,
            envelope: finalEnvelope,
          });
          const csrfToken = await freshCsrf({
            redis,
            auth,
            keys: seed.keys,
            payload: terminalState,
            resetEpoch: finalEnvelope.reset_epoch,
          });
          const terminal = result.ok
            ? responseEnvelope(result, { fixtureId, csrfToken, authority })
            : responseEnvelope({
                ok: false,
                code: result.code || 'ATHLETE_LIVING_CONSULT_REFUSED',
                current_revision: terminalState.revision,
                current_state_hash: terminalState.state_hash,
              }, { fixtureId, csrfToken, authority });
          if (progressive) {
            response.write(`${JSON.stringify(terminal)}\n`);
            return response.end();
          }
          return send(response, result.ok ? 200 : statusFor(result.code), terminal);
        }
      });
    } catch (error) {
      const knownCode = String(error?.message || error?.code || '');
      const code = knownCode === 'ATHLETE_LIVING_CONSULT_REQUEST_IN_FLIGHT'
        ? knownCode
        : knownCode === 'ATHLETE_LIVING_CONSULT_REQUEST_TOO_LARGE'
          ? knownCode
          : knownCode === 'ATHLETE_OPERATION_OUTCOME_UNKNOWN'
            ? knownCode
            : 'ATHLETE_LIVING_CONSULT_UNAVAILABLE';
      const status = code === 'ATHLETE_LIVING_CONSULT_REQUEST_IN_FLIGHT' || code === 'ATHLETE_OPERATION_OUTCOME_UNKNOWN'
        ? 409
        : code === 'ATHLETE_LIVING_CONSULT_REQUEST_TOO_LARGE' ? 413 : 503;
      console.error(JSON.stringify({
        event: 'ATHLETE_LIVING_CONSULT_REQUEST_FAILED_CLOSED',
        code,
        raw_error_logged: false,
        secret_logged: false,
      }));
      const responseType = response.headers?.['content-type'] || response.getHeader?.('content-type');
      if ((response.headersSent || String(responseType || '').startsWith('application/x-ndjson'))
        && !response.ended && !response.writableEnded && typeof response.write === 'function') {
        response.write(`${JSON.stringify({ ok: false, code })}\n`);
        return response.end();
      }
      if (!response.ended && !response.writableEnded) return send(response, status, { ok: false, code });
      return undefined;
    }
  };
}

const productionHandler = createAthleteLivingConsultOneShotHandlerV1();

export default function handler(request, response) {
  return productionHandler(request, response);
}
