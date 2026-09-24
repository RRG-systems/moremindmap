import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { validateCoachVoice, transcribeCoachVoice } from '../server/athleteConsultingV2/transcription.js';

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
