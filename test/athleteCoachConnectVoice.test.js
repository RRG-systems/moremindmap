import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { CoachVoiceTranscriptionFailure, validateCoachVoice, transcribeCoachVoice } from '../server/athleteConsultingV2/transcription.js';
import { api } from '../src/athleteConsultingV2/transport.js';

const sample = () => ({ mime: 'audio/mp4', data: Buffer.concat([
  Buffer.from([0, 0, 0, 20, 102, 116, 121, 112]), Buffer.alloc(1024),
]).toString('base64') });

test('Coach Connect voice accepts only bounded supported audio with matching bytes', () => {
  const valid = validateCoachVoice(sample());
  assert.equal(valid.mime, 'audio/mp4');
  assert.equal(valid.filename, 'coach-note.m4a');
  assert.equal(valid.bytes.length, 1032);
  for (const audio of [
    { ...sample(), mime: 'image/jpeg' },
    { ...sample(), data: Buffer.alloc(250001).toString('base64') },
    { ...sample(), data: Buffer.alloc(200).toString('base64') },
    { ...sample(), data: 'not-base64!' },
  ]) assert.throws(() => validateCoachVoice(audio), { message: 'VOICE_AUDIO_INVALID' });
});

test('transcription is default-off and makes no provider call', async () => {
  let calls = 0;
  await assert.rejects(transcribeCoachVoice({ env: {}, audio: sample(), transport: async () => { calls++; } }),
    { message: 'VOICE_TRANSCRIPTION_DISABLED' });
  assert.equal(calls, 0);
});

test('missing provider key has a safe pre-invoke receipt and no SDK call', async () => {
  await assert.rejects(transcribeCoachVoice({
    env: { ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true' }, audio: sample(),
  }), (error) => {
    assert.ok(error instanceof CoachVoiceTranscriptionFailure);
    assert.equal(error.message, 'VOICE_TRANSCRIPTION_FAILED');
    assert.deepEqual(error.diagnostic, {
      stage: 'pre_invoke', category: 'missing_key', sdk_invoke_count: 0,
      provider_http_status: null, provider_request_id: null,
    });
    return true;
  });
});

test('installed SDK builds a multipart transcription request through an offline fetch stub', async () => {
  let calls = 0;
  const text = await transcribeCoachVoice({
    env: { ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true', OPENAI_API_KEY: 'synthetic-test-key' },
    audio: sample(), sdkFetch: async (url, init) => {
      if (String(url).startsWith('data:')) return new Response('', { status: 200 });
      calls++;
      assert.match(String(url), /\/v1\/audio\/transcriptions$/u);
      assert.equal(init.method, 'POST');
      assert.equal(init.body?.constructor?.name, 'FormData');
      return new Response(JSON.stringify({ text: 'Synthetic editable transcript.' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(calls, 1);
  assert.equal(text, 'Synthetic editable transcript.');
});

test('SDK provider HTTP failure exposes only allowlisted status and request ID', async () => {
  let calls = 0;
  await assert.rejects(transcribeCoachVoice({
    env: { ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true', OPENAI_API_KEY: 'synthetic-test-key' },
    audio: sample(), sdkFetch: async (url) => {
      if (String(url).startsWith('data:')) return new Response('', { status: 200 });
      calls++;
      return new Response(JSON.stringify({ error: { message: 'private provider response', type: 'private_type' } }), {
        status: 401, headers: { 'content-type': 'application/json', 'x-request-id': 'req_SyntheticVoice123' },
      });
    },
  }), (error) => {
    assert.ok(error instanceof CoachVoiceTranscriptionFailure);
    assert.deepEqual(error.diagnostic, {
      stage: 'invoke', category: 'provider_http', sdk_invoke_count: 1,
      provider_http_status: 401, provider_request_id: 'req_SyntheticVoice123',
    });
    assert.doesNotMatch(JSON.stringify(error), /private provider response|private_type/u);
    return true;
  });
  assert.equal(calls, 1);
});

test('enabled synthetic transport receives one file and returns only editable text', async () => {
  let calls = 0;
  const text = await transcribeCoachVoice({
    env: { ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true' }, audio: sample(),
    transport: async (request) => {
      calls++;
      assert.equal(request.model, 'gpt-transcribe');
      assert.equal(request.file.name, 'coach-note.m4a');
      assert.equal(request.file.type, 'audio/mp4');
      assert.equal(request.file.size, 1032);
      return { text: '  Coach Alex noticed a fictional reset after a missed pass.  ' };
    },
  });
  assert.equal(calls, 1);
  assert.equal(text, 'Coach Alex noticed a fictional reset after a missed pass.');
});

test('provider failure and unusable transcripts fail without raw details or retry', async () => {
  for (const output of [null, { text: '' }, { text: 'x'.repeat(4001) }]) {
    let calls = 0;
    await assert.rejects(transcribeCoachVoice({
      env: { ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true' }, audio: sample(),
      transport: async () => { calls++; return output; },
    }), { message: 'VOICE_TRANSCRIPTION_FAILED' });
    assert.equal(calls, 1);
  }
  await assert.rejects(transcribeCoachVoice({
    env: { ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'true' }, audio: sample(),
    transport: async () => { throw Error('private provider response'); },
  }), { message: 'VOICE_TRANSCRIPTION_FAILED' });
});

test('Coach Connect displays the Leadership sign-in link only for an auth-class error', () => {
  const capture = fs.readFileSync(new URL('../src/athleteConsultingV2/Capture.jsx', import.meta.url), 'utf8');
  assert.match(capture, /needsLeadershipSignIn=error==='Please enter through the shared Leadership gate\.'/u);
  assert.match(capture, /\{needsLeadershipSignIn&&<a href="\/leadership"/u);
  assert.match(capture, /Reference \$\{e\.voice_diagnostic_id\}/u);
  assert.equal((capture.match(/Open the existing Leadership sign-in/gu) || []).length, 1);
});

test('voice transport carries only a validated failure reference into the UI error', async () => {
  const originalFetch = globalThis.fetch;
  const attemptId = '123e4567-e89b-42d3-a456-426614174000';
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: 'VOICE_TRANSCRIPTION_FAILED', diagnostic: { attempt_id: attemptId, category: 'provider_http' },
  }), { status: 503, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(api('transcribe/sofia', { action: 'transcribe_coach_voice', audio: sample() }, {
      revision: 0, state_hash: 'a'.repeat(64), csrf: 'synthetic-csrf', actors: { instructor: 'synthetic-actor' },
    }), (error) => {
      assert.equal(error.message, 'VOICE_TRANSCRIPTION_FAILED');
      assert.equal(error.voice_diagnostic_id, attemptId);
      assert.equal(Object.hasOwn(error, 'diagnostic'), false);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
