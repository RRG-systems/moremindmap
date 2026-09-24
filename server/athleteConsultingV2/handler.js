import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  athleteConsultingDarrenDemoEnabled, authenticateAthleteConsultingDemoRequest,
  issueAthleteConsultingDemoCsrf, consumeAthleteConsultingDemoCsrf,
  sameOriginLeadershipDemoRequest, enforceAthleteConsultingDemoRateLimit,
  deriveAthleteConsultingActorCapabilities,
} from '../../api/engine/leadershipDemo/authority.js';
import { getSubscriptionRedis } from '../../api/engine/subscriptionV1/internalDevInfrastructure.js';
import { bundles, athletes, binding, digest } from './bundles.js';
import { createStore } from './store.js';
import { createCoach } from './coach.js';
import { applyLiveCapture } from './capture.js';
import { transcribeCoachVoice, validateCoachVoice } from './transcription.js';

const equal = (a, b) => typeof a === 'string' && typeof b === 'string'
  && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store, max-age=0');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.end(JSON.stringify(body));
};
async function bodyOf(req) {
  let body = req.body;
  if (!body) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 400000) throw Error('REQUEST_TOO_LARGE'); chunks.push(chunk); }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Buffer.byteLength(JSON.stringify(body)) > (['capture_demo','transcribe_coach_voice'].includes(body.action) ? 400000 : 50000)) throw Error('REQUEST_TOO_LARGE');
  return body;
}
const expectedRole = body => body.action === 'transcribe_coach_voice' ? 'instructor' : body.action === 'capture_demo'
  ? body.capture?.role === 'athlete' ? 'athlete' : body.capture?.role === 'coach' ? 'instructor' : null
  : body.action === 'approve'
  ? body.actor === 'athlete' ? 'athlete' : body.actor === 'coach' ? 'instructor' : null
  : ['draft', 'discard', 'reset'].includes(body.action) ? 'shared_editor'
    : ['feedback', 'remember', 'forget', 'finish'].includes(body.action) ? 'athlete' : 'conversation';

export function createAthleteConsultingV2Handler({ env = globalThis.process?.env || {}, redis: injectedRedis, authenticate, coach: injectedCoach, transport, transcribe: injectedTranscribe } = {}) {
  return async (req, res) => {
    try {
      if (!athleteConsultingDarrenDemoEnabled(env) || env.ATHLETE_CONSULTING_V2_ENABLED !== 'true') return send(res, 404, { error: 'ATHLETE_V2_DISABLED' });
      const method = req.method || 'GET';
      if (!['GET', 'POST'].includes(method)) return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      if (!sameOriginLeadershipDemoRequest(req, { allowMissingForGet: method === 'GET' })) return send(res, 403, { error: 'ORIGIN_DENIED' });
      if (method === 'POST' && String(req.headers['content-type']).split(';')[0] !== 'application/json') return send(res, 415, { error: 'JSON_REQUIRED' });
      const redis = injectedRedis || getSubscriptionRedis(env);
      const auth = await (authenticate || authenticateAthleteConsultingDemoRequest)({ redis, req, env });
      if (!auth?.ok || auth.capability?.synthetic_only !== true || auth.capability?.allowed_product !== 'athlete-consulting-tool'
        || !auth.capability.demo_scope_id || JSON.stringify(auth.capability.allowed_subjects) !== JSON.stringify(['nia', 'sofia'])) {
        return send(res, 401, { error: 'SHARED_LEADERSHIP_ENTRY_REQUIRED' });
      }
      const u = new URL(req.url, 'http://request.invalid');
      const kind = u.searchParams.get('kind'), slug = u.searchParams.get('athlete');
      if (kind === 'registry' && method === 'GET') return send(res, 200, athletes);
      if (!['nia', 'sofia'].includes(slug) || !auth.capability.allowed_subjects.includes(slug)) return send(res, 403, { error: 'ATHLETE_NOT_ALLOWED' });
      const scopeId = auth.capability.demo_scope_id;
      const scopeHash = digest({ scopeId, ...binding(slug) });
      if (kind === 'bundle' && method === 'GET') return send(res, 200, bundles[slug]);
      const evidenceSink = async event => {
        const safeKind = ['request', 'response', 'receipt', 'failure'].includes(event.kind) ? event.kind : null;
        if (!safeKind || !/^[a-f0-9-]{36}$/u.test(event.id)) throw Error('EVIDENCE_CONTRACT_INVALID');
        const raw = JSON.stringify(event);
        if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw Error('EVIDENCE_TOO_LARGE');
        const key = `more:athlete-consulting-demo:v2:${scopeHash}:provider:${event.id}:${safeKind}`;
        if (await redis.set(key, raw, 'EX', 30 * 86400, 'NX') !== 'OK') throw Error('EVIDENCE_ALREADY_EXISTS');
      };
      const store = createStore({ redis, bundles, scopeId, localAction: applyLiveCapture, coach: injectedCoach || createCoach({ env, evidenceSink, transport: transport || null }) });
      const actors = deriveAthleteConsultingActorCapabilities({ capabilityToken: auth.capability_token, fixtureId: slug });
      async function responseState(state) {
        const hash = digest(state);
        const proof = await issueAthleteConsultingDemoCsrf({ redis, capabilityHash: auth.capability_hash, fixtureScopeHash: scopeHash, runtimeStateHash: hash, resetEpoch: state.revision });
        return { ...state, _transport: { csrf: proof, state_hash: hash, revision: state.revision, actors, ...binding(slug) } };
      }
      if (kind === 'state' && method === 'GET') return send(res, 200, await responseState(await store.read(slug)));
      if (!['action','transcribe'].includes(kind) || method !== 'POST') return send(res, 404, { error: 'NOT_FOUND' });
      const body = await bodyOf(req);
      if (kind === 'transcribe' && (env.ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED !== 'true'
        || body.action !== 'transcribe_coach_voice')) return send(res, 404, { error: 'VOICE_TRANSCRIPTION_DISABLED' });
      const role = expectedRole(body);
      if (!role || !equal(body.actor_capability, actors[role])) return send(res, 403, { error: 'ACTOR_AUTHORITY_DENIED' });
      if (!Number.isInteger(body.revision) || body.proof_revision !== body.revision || !/^[a-f0-9]{64}$/u.test(body.state_hash || '')
        || !await consumeAthleteConsultingDemoCsrf({ redis, capabilityHash: auth.capability_hash, fixtureScopeHash: scopeHash,
          runtimeStateHash: body.state_hash, resetEpoch: body.proof_revision, proof: req.headers['x-athlete-consulting-csrf'] })) return send(res, 403, { error: 'CSRF_DENIED' });
      const rate = await enforceAthleteConsultingDemoRateLimit({ redis, capabilityHash: auth.capability_hash, fixtureScopeHash: scopeHash });
      if (!rate.allowed) return send(res, 429, { error: 'PLEASE_WAIT' });
      if (kind === 'transcribe') {
        const audio = validateCoachVoice(body.audio);
        const audioHash = createHash('sha256').update(audio.bytes).digest('hex');
        const key = `more:athlete-consulting-demo:v2:${scopeHash}:coach-voice:${audioHash}`;
        const prior = await redis.get(key);
        if (prior) {
          const cached = JSON.parse(prior);
          return cached.status === 'complete' ? send(res, 200, { text: cached.text, saved_audio: false })
            : send(res, 409, { error: 'VOICE_ALREADY_ATTEMPTED' });
        }
        const voiceRateKey = `more:athlete-consulting-demo:v2:${scopeHash}:coach-voice-rate`;
        const voiceCount = Number(await redis.eval("local n=redis.call('INCR',KEYS[1]); if n == 1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, voiceRateKey, String(15 * 60)));
        if (voiceCount > 4) return send(res, 429, { error: 'VOICE_RATE_LIMITED' });
        if (await redis.set(key, JSON.stringify({ status: 'pending' }), 'EX', 3600, 'NX') !== 'OK') return send(res, 409, { error: 'VOICE_ALREADY_ATTEMPTED' });
        try {
          const text = await (injectedTranscribe || transcribeCoachVoice)({ env, audio: body.audio });
          await redis.set(key, JSON.stringify({ status: 'complete', text }), 'EX', 3600);
          return send(res, 200, { text, saved_audio: false });
        } catch {
          await redis.set(key, JSON.stringify({ status: 'failed' }), 'EX', 3600);
          return send(res, 503, { error: 'VOICE_TRANSCRIPTION_FAILED' });
        }
      }
      const { actor_capability: _actor, state_hash: _hash, proof_revision: _revision, ...operation } = body;
      return send(res, 200, await responseState(await store.act(slug, operation)));
    } catch (error) {
      const code = /^[A-Z0-9_]+$/u.test(error.message) ? error.message : 'REQUEST_FAILED';
      const publicCodes = new Set(['CAPTURE_REVIEW_REQUIRED','CAPTURE_MEDIA_TOO_LARGE','CAPTURE_MEDIA_INVALID','CAPTURE_DEMO_MEDIA_FULL','CAPTURE_TEXT_REQUIRED','STATE_CHANGED_RELOAD','REQUEST_ID_REUSED','PLEASE_WAIT','INVALID_PLAN','MESSAGE_REQUIRED','PLAN_CHANGED_REVIEW_LATEST','REQUEST_TOO_LARGE','SESSION_STATE_CHANGED','LEARNING_CHANGED','NO_ACTIVE_SESSION','ATHLETE_V2_STATE_TOO_LARGE','VOICE_AUDIO_INVALID','VOICE_TRANSCRIPTION_DISABLED','VOICE_TRANSCRIPTION_UNAVAILABLE']);
      return send(res, code === 'PLEASE_WAIT' ? 409 : 422, { error: publicCodes.has(code) ? code : 'REQUEST_FAILED', message: 'Your saved conversation and plan are safe. Reopen through Leadership if your access has expired.' });
    }
  };
}
