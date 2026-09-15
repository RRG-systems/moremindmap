import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { withAthleteConsultingSessionLeaseV1 } from '../athleteLivingConsultOneShotV1/durableInfrastructure.js';
import { hash, initial, requireThat, validatePlan, applyOutput, applyLocalAction } from './state.js';

export const ATHLETE_V2_PREFIX = 'more:athlete-consulting-demo:v2';
export const MAX_STATE_BYTES = 4 * 1024 * 1024;
const ARRAY_FIELDS = ['messages', 'learning', 'feedback', 'suggestedLearning', 'sessions', 'events', 'processed'];
const TERMINAL = ['completed', 'failed', 'unknown'];
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = (value) => structuredClone(value);
const safeCode = (error) => /^[A-Z_]+$/u.test(error?.message) ? error.message : 'COACH_REQUEST_FAILED';
const FAILURE = 'MORE could not complete this response. Your message and saved plan are safe. You can try again when ready.';
const INTERRUPTED = 'The connection was interrupted. Your saved conversation and plan are intact.';

// The owner check, expected-state check, archive and replacement are one Redis operation.
export const PERSIST_LUA = `-- ATHLETE_CONSULTING_V2_FENCED_PERSIST
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
local prior=redis.call('GET',KEYS[2])
if (prior or '') ~= ARGV[3] then return -1 end
if ARGV[4] == '1' and prior then
  local backup=redis.call('GET',KEYS[3])
  if backup and backup ~= prior then return -2 end
  redis.call('SET',KEYS[3],prior,'NX')
end
redis.call('SET',KEYS[2],ARGV[2])
redis.call('PEXPIRE',KEYS[1],ARGV[5])
return 1`;

function bindingFor(scopeId, slug, bundle) {
  requireThat(typeof scopeId === 'string' && scopeId.trim() && scopeId.length <= 4096, 'ATHLETE_V2_SCOPE_REQUIRED');
  requireThat(['nia', 'sofia'].includes(slug) && bundle?.person?.slug === slug, 'UNKNOWN_ATHLETE');
  requireThat(bundle.person.synthetic === true && bundle.bos?.synthetic === true && bundle.apa?.synthetic === true
    && bundle.person.mm === bundle.bos.mm && bundle.person.mm === bundle.apa.mm
    && /^[a-f0-9]{64}$/u.test(bundle.bos.artifact_sha256 || '') && /^[a-f0-9]{64}$/u.test(bundle.apa.artifact_sha256 || ''), 'REPORT_IDENTITY_MISMATCH');
  return { scope_hash: hash(scopeId), slug, mm: bundle.person.mm, bos_hash: bundle.bos.artifact_sha256, apa_hash: bundle.apa.artifact_sha256 };
}

export function athleteConsultingV2Keys({ scopeId, slug, bundle }) {
  const binding = bindingFor(scopeId, slug, bundle);
  const prefix = `${ATHLETE_V2_PREFIX}:${hash(binding)}`;
  return { state: `${prefix}:state`, lock: `${prefix}:lock`, backup: `${prefix}:backup`, binding };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function semanticRequestHash(body) {
  return hash(canonical(Object.fromEntries(Object.entries(body).filter(([key]) => !['requestId', 'revision'].includes(key)))));
}

function validateEnvelope(envelope, binding) {
  requireThat(object(envelope) && envelope.version === 2 && hash(envelope.binding) === hash(binding)
    && object(envelope.state) && object(envelope.operations), 'ATHLETE_V2_STATE_CORRUPT');
  const { envelope_hash: digest, ...unsigned } = envelope;
  requireThat(digest === hash(unsigned), 'ATHLETE_V2_STATE_CORRUPT');
  const state = envelope.state;
  requireThat(state.version === 2 && state.mm === binding.mm && Number.isSafeInteger(state.revision) && state.revision >= 0
    && ['ready', 'active', 'working', 'review', 'closed'].includes(state.status)
    && ARRAY_FIELDS.every((field) => Array.isArray(state[field])), 'ATHLETE_V2_STATE_CORRUPT');
  try {
    if (state.plan) validatePlan(state.plan);
    if (state.draft) { validatePlan(state.draft); requireThat(Array.isArray(state.draft.approvals), 'INVALID_PLAN'); }
  } catch { throw new Error('ATHLETE_V2_STATE_CORRUPT'); }
  for (const entry of Object.values(envelope.operations)) {
    requireThat(object(entry) && /^[a-f0-9]{64}$/u.test(entry.hash || '')
      && [...TERMINAL, 'pending'].includes(entry.status), 'ATHLETE_V2_STATE_CORRUPT');
  }
  if (state.status === 'working') {
    const operation = envelope.operations[state.pending?.requestId];
    requireThat(operation?.status === 'pending' && ['OPENING', 'CHAT', 'CLOSE'].includes(state.pending?.task)
      && ['ready', 'active', 'review', 'closed'].includes(state.beforeWorking), 'ATHLETE_V2_STATE_CORRUPT');
  }
}

function seal(envelope) {
  const { envelope_hash: _prior, ...unsigned } = envelope;
  return { ...unsigned, envelope_hash: hash(unsigned) };
}

export function createStore({ redis, bundles, coach, scopeId }) {
  requireThat(redis && typeof redis.get === 'function' && typeof redis.set === 'function' && typeof redis.eval === 'function', 'ATHLETE_V2_STORAGE_REQUIRED');
  requireThat(typeof coach === 'function', 'ATHLETE_V2_COACH_REQUIRED');
  const context = (slug) => {
    requireThat(['nia', 'sofia'].includes(slug) && Object.hasOwn(bundles, slug), 'UNKNOWN_ATHLETE');
    return { bundle: bundles[slug], keys: athleteConsultingV2Keys({ scopeId, slug, bundle: bundles[slug] }) };
  };
  async function load({ bundle, keys }) {
    const raw = await redis.get(keys.state);
    if (raw === null || raw === undefined) return { raw: '', envelope: seal({ version: 2, binding: keys.binding, state: initial(bundle), operations: {} }) };
    requireThat(typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') <= MAX_STATE_BYTES, 'ATHLETE_V2_STATE_TOO_LARGE');
    let envelope;
    try { envelope = JSON.parse(raw); } catch { throw new Error('ATHLETE_V2_STATE_CORRUPT'); }
    validateEnvelope(envelope, keys.binding);
    return { raw, envelope };
  }
  async function persist(ctx, lease, previous, envelope, backupId = null) {
    const next = seal(envelope);
    validateEnvelope(next, ctx.keys.binding);
    const serialized = JSON.stringify(next);
    requireThat(Buffer.byteLength(serialized, 'utf8') <= MAX_STATE_BYTES, 'ATHLETE_V2_STATE_TOO_LARGE');
    requireThat(!lease.lost, 'ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST');
    const result = Number(await redis.eval(PERSIST_LUA, 3, ctx.keys.lock, ctx.keys.state,
      backupId ? `${ctx.keys.backup}:${hash(backupId)}` : ctx.keys.backup,
      lease.owner, serialized, previous, backupId ? '1' : '0', String(lease.lease_ms)));
    if (result === 0) { lease.lost = true; throw new Error('ATHLETE_LIVING_CONSULT_DURABLE_LOCK_LOST'); }
    requireThat(result !== -1, 'STATE_CHANGED_RELOAD');
    requireThat(result === 1, 'ATHLETE_V2_BACKUP_CONFLICT');
    return { raw: serialized, envelope: next };
  }
  async function leaseOperation(ctx, operation) {
    try { return await withAthleteConsultingSessionLeaseV1({ redis, keys: ctx.keys, operation }); }
    catch (error) {
      if (error.message === 'ATHLETE_LIVING_CONSULT_REQUEST_IN_FLIGHT') throw new Error('PLEASE_WAIT');
      throw error;
    }
  }
  async function recover(ctx, lease, saved) {
    if (saved.envelope.state.status !== 'working') return saved;
    // Acquiring the shared lease proves the original worker no longer owns it.
    const envelope = clone(saved.envelope), state = envelope.state;
    const { requestId, task } = state.pending;
    state.status = state.beforeWorking;
    state.lastError = INTERRUPTED;
    state.events.push({ type: 'coach_failed', code: 'COACH_OUTCOME_UNKNOWN', task, at: new Date().toISOString() });
    delete state.pending;
    state.revision++;
    state.processed = [...state.processed, requestId].slice(-200);
    envelope.operations[requestId] = { ...envelope.operations[requestId], status: 'unknown', completed_at: new Date().toISOString(), revision: state.revision };
    return persist(ctx, lease, saved.raw, envelope);
  }
  async function read(slug) {
    const ctx = context(slug), saved = await load(ctx);
    if (saved.envelope.state.status !== 'working') return clone(saved.envelope.state);
    try {
      return await leaseOperation(ctx, async (lease) => clone((await recover(ctx, lease, await load(ctx))).envelope.state));
    } catch (error) {
      if (error.message === 'PLEASE_WAIT') return clone((await load(ctx)).envelope.state);
      throw error;
    }
  }
  async function act(slug, body) {
    requireThat(object(body) && typeof body.requestId === 'string' && /^[A-Za-z0-9._:-]{1,160}$/u.test(body.requestId)
      && !['__proto__', 'constructor', 'prototype'].includes(body.requestId)
      && Number.isSafeInteger(body.revision) && body.revision >= 0, 'STATE_CHANGED_RELOAD');
    const ctx = context(slug), requestHash = semanticRequestHash(body);
    return leaseOperation(ctx, async (lease) => {
      let saved = await recover(ctx, lease, await load(ctx));
      const existing = Object.hasOwn(saved.envelope.operations, body.requestId) ? saved.envelope.operations[body.requestId] : null;
      if (existing) {
        requireThat(existing.hash === requestHash, 'REQUEST_ID_REUSED');
        requireThat(TERMINAL.includes(existing.status), 'PLEASE_WAIT');
        return clone(saved.envelope.state);
      }
      requireThat(body.revision === saved.envelope.state.revision, 'STATE_CHANGED_RELOAD');
      let envelope = clone(saved.envelope), state = envelope.state;
      const started = new Date().toISOString();
      let status = 'completed';
      if (body.action === 'reset') {
        // The previous envelope is archived atomically; request history survives restart.
        state = { ...initial(ctx.bundle), revision: state.revision, processed: state.processed };
        envelope.state = state;
        envelope.reset = { requestId: body.requestId, at: started };
      } else if (['start', 'message', 'close'].includes(body.action)) {
        const task = body.action === 'start' ? 'OPENING' : body.action === 'close' ? 'CLOSE' : 'CHAT';
        requireThat(task === 'OPENING' ? ['ready', 'closed'].includes(state.status) : ['active', 'review'].includes(state.status), 'SESSION_STATE_CHANGED');
        state.speaker = body.speaker === 'coach' ? 'coach' : 'athlete';
        state.view = ['home', 'you', 'sport', 'plan'].includes(body.view) ? body.view : 'home';
        if (task === 'CHAT') {
          requireThat(typeof body.text === 'string' && body.text.trim().length > 0 && body.text.length <= 10000, 'MESSAGE_REQUIRED');
          state.messages.push({ id: randomUUID(), role: 'user', speaker: state.speaker, text: body.text.trim(), at: started });
          if (state.status === 'review') { state.status = 'active'; state.closing = null; }
        }
        state.beforeWorking = state.status;
        state.status = 'working';
        state.pending = { task, at: started, requestId: body.requestId };
        envelope.operations[body.requestId] = { hash: requestHash, status: 'pending', task, started_at: started };
        saved = await persist(ctx, lease, saved.raw, envelope);
        await lease.assertOwned();
        let output, failure;
        try { output = await coach(clone(ctx.bundle), clone(state), task); }
        catch (error) { failure = error; }
        // No response can publish after lease ownership has changed.
        await lease.assertOwned();
        envelope = clone(saved.envelope); state = envelope.state;
        state.status = state.beforeWorking;
        if (!failure) {
          try { applyOutput(state, output, task); } catch (error) { failure = error; }
        }
        if (failure) {
          status = 'failed';
          state.lastError = FAILURE;
          state.events.push({ type: 'coach_failed', code: safeCode(failure), task, at: new Date().toISOString() });
        }
        delete state.pending;
      } else applyLocalAction(state, body, ctx.bundle);
      state.revision++;
      state.processed = [...state.processed, body.requestId].slice(-200);
      envelope.operations[body.requestId] = { ...envelope.operations[body.requestId], hash: requestHash, status, started_at: started, completed_at: new Date().toISOString(), revision: state.revision };
      return clone((await persist(ctx, lease, saved.raw, envelope, body.action === 'reset' ? body.requestId : null)).envelope.state);
    });
  }
  return { read, act };
}
