import { Buffer, File } from 'node:buffer';

export const COACH_VOICE_MAX_BYTES = 250000;
const MIME_EXTENSION = Object.freeze({
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
});

export function validateCoachVoice(audio) {
  if (!audio || typeof audio !== 'object' || Array.isArray(audio)
    || typeof audio.mime !== 'string' || !Object.hasOwn(MIME_EXTENSION, audio.mime)
    || typeof audio.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/u.test(audio.data)) {
    throw new Error('VOICE_AUDIO_INVALID');
  }
  const bytes = Buffer.from(audio.data, 'base64');
  if (bytes.length < 100 || bytes.length > COACH_VOICE_MAX_BYTES
    || bytes.toString('base64') !== audio.data) throw new Error('VOICE_AUDIO_INVALID');
  const mime = audio.mime;
  const valid = mime === 'audio/webm' ? bytes.subarray(0, 4).toString('hex') === '1a45dfa3'
    : mime === 'audio/mpeg' ? bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    : mime.includes('wav') ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE'
    : bytes.toString('ascii', 4, 8) === 'ftyp';
  if (!valid) throw new Error('VOICE_AUDIO_INVALID');
  return { bytes, mime, filename: `coach-note.${MIME_EXTENSION[mime]}` };
}

export async function transcribeCoachVoice({ env = globalThis.process?.env || {}, audio, transport } = {}) {
  if (env.ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED !== 'true') throw new Error('VOICE_TRANSCRIPTION_DISABLED');
  const validated = validateCoachVoice(audio);
  if (!transport && !env.OPENAI_API_KEY) throw new Error('VOICE_TRANSCRIPTION_UNAVAILABLE');
  try {
    const request = {
      model: 'gpt-transcribe',
      file: new File([validated.bytes], validated.filename, { type: validated.mime }),
    };
    let invoke = transport;
    if (!invoke) {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 30000 });
      invoke = (input) => client.audio.transcriptions.create(input, { maxRetries: 0, timeout: 30000 });
    }
    const result = await invoke(request);
    const text = typeof result?.text === 'string' ? result.text.trim() : '';
    if (!text || text.length > 4000) throw new Error('VOICE_TRANSCRIPT_INVALID');
    return text;
  } catch {
    throw new Error('VOICE_TRANSCRIPTION_FAILED');
  }
}
