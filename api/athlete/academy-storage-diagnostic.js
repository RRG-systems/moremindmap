import process from 'node:process';
import Redis from 'ioredis';
import {workerAuthorized} from '../../server/athleteAcademyV1/worker.js';

const SAFE_NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
]);

function safeFailure(error) {
  if (SAFE_NETWORK_CODES.has(error?.code)) return error.code;
  const message = String(error?.message || '');
  if (/Connection is closed/i.test(message)) return 'CONNECTION_CLOSED';
  if (/Stream isn't writeable|stream is not writable/i.test(message)) return 'STREAM_NOT_WRITABLE';
  if (/timeout|timed out/i.test(message)) return 'ETIMEDOUT';
  if (/getaddrinfo/i.test(message)) return 'DNS_RESOLUTION_FAILED';
  if (/WRONGPASS|invalid username-password/i.test(message)) return 'AUTH_REJECTED';
  if (/NOAUTH|authentication required/i.test(message)) return 'AUTH_REQUIRED';
  if (/AUTH.*no password|wrong number of arguments.*auth/i.test(message)) return 'AUTH_CONFIGURATION_INVALID';
  if (/unknown command.*HELLO/i.test(message)) return 'RESP_NEGOTIATION_FAILED';
  if (/certificate|self.signed|unable.to.verify|CERT_/i.test(`${error?.code || ''} ${message}`)) return 'TLS_REJECTED';
  if (/^[A-Z][A-Z0-9_]{1,63}$/.test(String(error?.code || ''))) return error.code;
  return 'STORAGE_PING_FAILED';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  let redis;
  let firstConnectionError;
  try {
    workerAuthorized(process.env, req.headers.authorization);
    if (req.method !== 'GET') return res.status(405).json({ok: false, error: 'METHOD_NOT_ALLOWED'});
    const raw = process.env.ATHLETE_ACADEMY_REDIS_URL || '';
    const ca = process.env.ATHLETE_ACADEMY_REDIS_CA_PEM || '';
    let parsed;
    try { parsed = new URL(raw); } catch { return res.status(503).json({ok: false, stage: 'configuration', error: 'URL_INVALID'}); }
    const shape = {
      tlsUrl: parsed.protocol === 'rediss:',
      credentialsPresent: Boolean(parsed.username && parsed.password),
      caCertificates: (ca.match(/-----BEGIN CERTIFICATE-----/g) || []).length,
    };
    if (!shape.tlsUrl || shape.caCertificates < 1) return res.status(503).json({ok: false, stage: 'configuration', error: 'TLS_CONFIGURATION_INVALID', ...shape});
    redis = new Redis(raw, {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      autoResendUnfulfilledCommands: false,
      retryStrategy: null,
      tls: {ca},
    });
    redis.once('error', error => { firstConnectionError = error; });
    const pong = await Promise.race([
      redis.connect().then(() => redis.ping()),
      new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('PING_TIMEOUT'), {code: 'ETIMEDOUT'})), 15000)),
    ]);
    return res.status(200).json({ok: pong === 'PONG', stage: 'ping', ...shape});
  } catch (error) {
    return res.status(error?.status || 503).json({ok: false, stage: 'ping', error: safeFailure(firstConnectionError || error)});
  } finally {
    redis?.disconnect();
  }
}
