import { Buffer, File } from 'node:buffer';

export const COACH_VOICE_MAX_BYTES = 250000;
const PROVIDER_REQUEST_ID = /^req_[A-Za-z0-9_-]{1,120}$/u;
const FAILURE_CATEGORIES = new Set(['missing_key', 'file_build', 'sdk_load', 'client_init',
  'provider_http', 'connection', 'timeout', 'invalid_result', 'unknown']);
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

const providerStatus = (error) => Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
  ? error.status : null;
const providerRequestId = (error) => {
  const value = error?.requestID || error?.request_id || error?._request_id;
  return typeof value === 'string' && PROVIDER_REQUEST_ID.test(value) ? value : null;
};

export class CoachVoiceTranscriptionFailure extends Error {
  constructor(stage, category, error = null) {
    super('VOICE_TRANSCRIPTION_FAILED');
    const safeStage = stage === 'pre_invoke' || stage === 'invoke' ? stage : 'unknown';
    this.diagnostic = Object.freeze({
      stage: safeStage,
      category: FAILURE_CATEGORIES.has(category) ? category : 'unknown',
      sdk_invoke_count: safeStage === 'invoke' ? 1 : safeStage === 'pre_invoke' ? 0 : null,
      provider_http_status: safeStage === 'invoke' ? providerStatus(error) : null,
      provider_request_id: safeStage === 'invoke' ? providerRequestId(error) : null,
    });
  }
}

function invokeFailureCategory(error) {
  if (providerStatus(error) !== null) return 'provider_http';
  if (error?.name === 'APIConnectionTimeoutError') return 'timeout';
  if (error?.name === 'APIConnectionError') return 'connection';
  return 'unknown';
}

export async function transcribeCoachVoice({ env = globalThis.process?.env || {}, audio, transport, sdkFetch } = {}) {
  if (env.ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED !== 'true') throw new Error('VOICE_TRANSCRIPTION_DISABLED');
  const validated = validateCoachVoice(audio);
  if (!transport && !env.OPENAI_API_KEY) throw new CoachVoiceTranscriptionFailure('pre_invoke', 'missing_key');
  let file;
  try {
    file = new File([validated.bytes], validated.filename, { type: validated.mime });
  } catch {
    throw new CoachVoiceTranscriptionFailure('pre_invoke', 'file_build');
  }
  let invoke = transport;
  if (!invoke) {
    let OpenAI;
    try {
      ({ default: OpenAI } = await import('openai'));
    } catch {
      throw new CoachVoiceTranscriptionFailure('pre_invoke', 'sdk_load');
    }
    try {
      const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: 30000,
        ...(sdkFetch ? { fetch: sdkFetch } : {}) });
      invoke = (input) => client.audio.transcriptions.create(input, { maxRetries: 0, timeout: 30000 });
    } catch {
      throw new CoachVoiceTranscriptionFailure('pre_invoke', 'client_init');
    }
  }
  let result;
  try {
    result = await invoke({ model: 'gpt-transcribe', file });
  } catch (error) {
    throw new CoachVoiceTranscriptionFailure('invoke', invokeFailureCategory(error), error);
  }
  const text = typeof result?.text === 'string' ? result.text.trim() : '';
  if (!text || text.length > 4000) throw new CoachVoiceTranscriptionFailure('invoke', 'invalid_result', result);
  return text;
}
