import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { FakeRedis } from '../scripts/athlete-consulting-v2-review/fakeRedis.mjs';
import { createAthleteConsultingV2Handler } from '../server/athleteConsultingV2/handler.js';
import { issueLeadershipLauncherCapability, issueAthleteConsultingDemoCapability } from '../api/engine/leadershipDemo/authority.js';

const env = Object.freeze({
  RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
  SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
  ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true',
  ATHLETE_CONSULTING_V2_ENABLED: 'true',
  ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true',
});
function request({ method = 'GET', cookie = '', kind = 'state', slug = 'nia', body = null, origin = 'https://moremindmap.com', headers = {} } = {}) {
  return {
    method, url: `/api/internal/athlete-living-consult-one-shot-v1?kind=${kind}&athlete=${slug}`,
    body, headers: { host: 'moremindmap.com', origin, 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.70',
      'user-agent': 'Synthetic Coach Connect offline test', cookie,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), ...headers }, socket: {},
  };
}
async function invoke(handler, req) {
  const response = { statusCode: 200, headers: {}, chunks: [],
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.chunks.push(String(value)); },
  };
  await handler(req, response);
  return { status: response.statusCode, body: JSON.parse(response.chunks.join('') || '{}') };
}
async function cookie(redis) {
  const launcher = await issueLeadershipLauncherCapability({ redis, req: request(), env });
  const athlete = await issueAthleteConsultingDemoCapability({ redis, req: request(), launcher: launcher.capability, env });
  return athlete.cookie.split(';')[0];
}
function audio(seed = 0) {
  const bytes = Buffer.concat([Buffer.from([0, 0, 0, 20, 102, 116, 121, 112]), Buffer.alloc(1024, seed)]);
  return { mime: 'audio/mp4', data: bytes.toString('base64') };
}
function voiceBody(state, sound = audio(), actor = 'instructor') {
  return { action: 'transcribe_coach_voice', requestId: `voice-${crypto.randomUUID()}`, audio: sound,
    revision: state.revision, proof_revision: state._transport.revision,
    state_hash: state._transport.state_hash, actor_capability: state._transport.actors[actor] };
}

test('coach voice path is exact-scope, instructor-only, one-use and text-only', async () => {
  const redis = new FakeRedis(); let calls = 0;
  const handler = createAthleteConsultingV2Handler({ env, redis,
    transcribe: async () => { calls++; return 'Editable fictional practice note.'; },
    coach: async () => { throw Error('Coach provider must not run for transcription'); },
  });
  assert.equal((await invoke(handler, request({ kind: 'transcribe', method: 'POST' }))).status, 401);
  const credential = await cookie(redis);
  const state = (await invoke(handler, request({ cookie: credential }))).body;
  const badOrigin = await invoke(handler, request({ kind: 'transcribe', method: 'POST', cookie: credential,
    origin: 'https://hostile.invalid', body: voiceBody(state) }));
  assert.equal(badOrigin.status, 403);
  const forged = await invoke(handler, request({ kind: 'transcribe', method: 'POST', cookie: credential,
    body: voiceBody(state, audio(), 'athlete') }));
  assert.equal(forged.body.error, 'ACTOR_AUTHORITY_DENIED');
  assert.equal(calls, 0);
  const submitted = await invoke(handler, request({ kind: 'transcribe', method: 'POST', cookie: credential,
    body: voiceBody(state), headers: { 'x-athlete-consulting-csrf': state._transport.csrf } }));
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  assert.deepEqual(submitted.body, { text: 'Editable fictional practice note.', saved_audio: false });
  assert.equal(calls, 1);
  const after = (await invoke(handler, request({ cookie: credential }))).body;
  assert.equal(after.messages.length, 0);
  assert.equal(after.plan, null);
  assert.equal(after.learning.length, 0);
  const replay = await invoke(handler, request({ kind: 'transcribe', method: 'POST', cookie: credential,
    body: voiceBody(after), headers: { 'x-athlete-consulting-csrf': after._transport.csrf } }));
  assert.equal(replay.status, 200);
  assert.equal(calls, 1);
  const wrong = (await invoke(handler, request({ cookie: credential, slug: 'sofia' }))).body;
  const crossed = await invoke(handler, request({ kind: 'transcribe', method: 'POST', cookie: credential, slug: 'sofia',
    body: voiceBody(wrong, audio(1)), headers: { 'x-athlete-consulting-csrf': after._transport.csrf } }));
  assert.equal(crossed.body.error, 'CSRF_DENIED');
  assert.equal(calls, 1);
});

test('voice transcription is default-off and bounded to four new clips per fifteen minutes', async () => {
  const redis = new FakeRedis(); let calls = 0;
  const off = createAthleteConsultingV2Handler({ env: { ...env, ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'false' }, redis,
    transcribe: async () => { calls++; return 'Should not run'; } });
  const credential = await cookie(redis);
  const offState = (await invoke(off, request({ cookie: credential }))).body;
  const denied = await invoke(off, request({ kind: 'transcribe', method: 'POST', cookie: credential,
    body: voiceBody(offState), headers: { 'x-athlete-consulting-csrf': offState._transport.csrf } }));
  assert.equal(denied.status, 404);
  assert.equal(calls, 0);
  const on = createAthleteConsultingV2Handler({ env, redis,
    transcribe: async () => { calls++; return 'Synthetic transcript'; } });
  for (let index = 1; index <= 5; index++) {
    const state = (await invoke(on, request({ cookie: credential }))).body;
    const result = await invoke(on, request({ kind: 'transcribe', method: 'POST', cookie: credential,
      body: voiceBody(state, audio(index)), headers: { 'x-athlete-consulting-csrf': state._transport.csrf } }));
    assert.equal(result.status, index <= 4 ? 200 : 429);
  }
  assert.equal(calls, 4);
});
