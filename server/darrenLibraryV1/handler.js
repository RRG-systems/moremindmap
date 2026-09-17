import fs from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { get as getBlob } from '@vercel/blob';
import {
  authenticateLeadershipLauncher,
  darrenDemoLibraryEnabled,
  sameOriginLeadershipDemoRequest,
  setLeadershipDemoNoStore,
} from '../../api/engine/leadershipDemo/authority.js';
import { getSubscriptionRedis } from '../../api/engine/subscriptionV1/internalDevInfrastructure.js';

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const PRIVATE_BOS_KEY = 'more:darren-library:v1:private:bos:bailea';
const PRIVATE_BOS_SHA256 = 'acb4c0c4842210b26c0fc813fab255e0fe9eb3cc0cab84e9305865f69980cdcc';
// Immutable approved Ava master, SHA-256 0ce33da618227803cd8a1d4b0969b22f903b939caddb16efa539c25d6135c9ee.
const FILM_STORE_ID = 'store_S5qe0BacKoM3GVxo';
const FILM_PATHNAME = 'darren-library/whole-story-ava-0ce33da6.mp4';
const FILM_ETAG = '"b0ef42b4358fd041f9d4b29c55432a5a-7"';
const FILM_SIZE = 54014685;
const FILM_RANGE_MAX = 2 * 1024 * 1024;
const SYNTHETIC_MM = Object.freeze({
  nia: 'MM-20260913-D702ACBF',
  eli: 'MM-20260913-6A49112B',
  rowan: 'MM-20260913-99A1DB45',
  sofia: 'MM-20260913-6184D6D9',
});
const DECKS = Object.freeze({
  lisa: { count: 16, stem: 'MORE_Youth_Sports_v05_School' },
  darren: { count: 26, stem: 'MORE_Athlete_Darren_Technical_Vision_v1' },
});
const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.vtt': 'text/vtt; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.json': 'application/json; charset=utf-8',
});
const BOS_FIELDS = [
  'version', 'synthetic', 'record_kind', 'mm', 'intake_mode', 'subject',
  'evidence', 'domains', 'synthesis', 'reading', 'artifact_sha256',
];

function sendJson(res, status, body, method = 'GET') {
  const bytes = Buffer.from(JSON.stringify(body));
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', String(bytes.length));
  res.end(method === 'HEAD' ? undefined : bytes);
}

function sendBytes(res, status, bytes, filename, method) {
  res.statusCode = status;
  res.setHeader('Content-Type', CONTENT_TYPES[path.extname(filename)] || 'application/octet-stream');
  res.setHeader('Content-Length', String(bytes.length));
  if (filename.endsWith('.pptx')) {
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filename)}"`);
  }
  res.end(method === 'HEAD' ? undefined : bytes);
}

function filmRange(header) {
  if (header == null) return { partial: false };
  if (typeof header !== 'string') return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return null;
    start = FILM_SIZE - Math.min(suffix, FILM_SIZE);
    end = FILM_SIZE - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : FILM_SIZE - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= FILM_SIZE || end < start) return null;
    end = Math.min(end, FILM_SIZE - 1);
  }
  end = Math.min(end, start + FILM_RANGE_MAX - 1);
  return { partial: true, start, end };
}

async function sendFilm(req, res, { env, getFilm }) {
  if (env.DARREN_LIBRARY_MEDIA_STORE_ID !== FILM_STORE_ID) {
    return sendJson(res, 503, { ok: false, code: 'DARREN_LIBRARY_MEDIA_NOT_BOUND' }, req.method);
  }
  const range = filmRange(req.headers?.['if-range'] && req.headers['if-range'] !== FILM_ETAG ? null : req.headers?.range);
  if (!range) {
    res.setHeader('Content-Range', `bytes */${FILM_SIZE}`);
    return sendJson(res, 416, { ok: false, code: 'FILM_RANGE_NOT_SATISFIABLE' }, req.method);
  }
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', FILM_ETAG);
  const expectedLength = range.partial ? range.end - range.start + 1 : FILM_SIZE;
  if (req.method === 'HEAD') {
    res.statusCode = range.partial ? 206 : 200;
    res.setHeader('Content-Length', String(expectedLength));
    if (range.partial) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${FILM_SIZE}`);
    return res.end();
  }

  const upstreamRange = range.partial ? `bytes=${range.start}-${range.end}` : undefined;
  const result = await getFilm(FILM_PATHNAME, {
    access: 'private',
    storeId: FILM_STORE_ID,
    ...(upstreamRange ? { headers: { Range: upstreamRange } } : {}),
  });
  if (!result?.stream || result.blob?.etag !== FILM_ETAG) {
    await result?.stream?.cancel?.();
    return sendJson(res, 503, { ok: false, code: 'DARREN_LIBRARY_MEDIA_UNAVAILABLE' }, req.method);
  }
  const actualLength = Number(result.headers?.get?.('content-length'));
  const actualRange = result.headers?.get?.('content-range');
  if (actualLength !== expectedLength || (range.partial && actualRange !== `bytes ${range.start}-${range.end}/${FILM_SIZE}`)) {
    await result.stream.cancel?.();
    return sendJson(res, 503, { ok: false, code: 'DARREN_LIBRARY_MEDIA_MISMATCH' }, req.method);
  }
  res.statusCode = range.partial ? 206 : 200;
  res.setHeader('Content-Length', String(expectedLength));
  if (range.partial) res.setHeader('Content-Range', actualRange);
  const readable = Readable.fromWeb(result.stream);
  for await (const chunk of readable) {
    if (res.destroyed) { readable.destroy(); return; }
    if (!res.write(chunk)) await once(res, 'drain');
  }
  return res.end();
}

function exactRoute(req) {
  const supplied = req.query?.path ?? new URL(req.url || '/', 'https://example.invalid').searchParams.get('path');
  if (Array.isArray(supplied) || typeof supplied !== 'string') return null;
  let value;
  try { value = decodeURIComponent(supplied).replace(/^\/+/, ''); } catch { return null; }
  if (value.includes('..') || value.includes('\\') || value.includes('\0') || value.includes('//') || value.includes('%')) return null;
  return value;
}

async function syntheticReading(kind, slug, readFile) {
  const artifact = JSON.parse(await readFile(path.join(ROOT, 'data', `${slug}-${kind}.json`), 'utf8'));
  if (artifact.mm !== SYNTHETIC_MM[slug]) throw new Error('SYNTHETIC_REPORT_IDENTITY_MISMATCH');
  const source = kind === 'bos'
    ? JSON.parse(await readFile(path.join(ROOT, 'data', `${slug}-bos-source.json`), 'utf8'))
    : null;
  return {
    artifact: kind === 'bos'
      ? Object.fromEntries(BOS_FIELDS.filter(key => key in artifact).map(key => [key, artifact[key]]))
      : artifact,
    ...(source ? { source: { questions: source.questions, answers: source.answers } } : {}),
  };
}

async function approvedPrivateReading(redis) {
  const bytes = await redis.getBuffer(PRIVATE_BOS_KEY);
  if (!bytes) return null;
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== PRIVATE_BOS_SHA256) {
    throw new Error('PRIVATE_BOS_HASH_MISMATCH');
  }
  return bytes;
}

export function createDarrenDemoLibraryHandler({
  env = globalThis.process?.env || {},
  getRedis = getSubscriptionRedis,
  authenticate = authenticateLeadershipLauncher,
  readFile = fs.readFile,
  getFilm = getBlob,
  privateReading = null,
} = {}) {
  return async function darrenDemoLibraryHandler(req, res) {
    setLeadershipDemoNoStore(res);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");

    const method = String(req.method || 'GET').toUpperCase();
    if (!darrenDemoLibraryEnabled(env)) return sendJson(res, 404, { ok: false, code: 'DARREN_DEMO_LIBRARY_DEFAULT_OFF' }, method);
    if (method !== 'GET' && method !== 'HEAD') return sendJson(res, 405, { ok: false, code: 'READ_ONLY_LIBRARY' }, method);
    if (!sameOriginLeadershipDemoRequest(req, { allowMissingForGet: true })) {
      return sendJson(res, 403, { ok: false, code: 'DARREN_LIBRARY_ORIGIN_DENIED' }, method);
    }
    const route = exactRoute(req);
    if (route === null) return sendJson(res, 404, { ok: false, code: 'LIBRARY_ROUTE_NOT_FOUND' }, method);
    try {
      const redis = getRedis(env);
      const auth = await authenticate({ redis, req });
      if (!auth.ok) return sendJson(res, auth.status || 401, { ok: false, code: auth.code || 'LEADERSHIP_DEMO_LAUNCHER_REQUIRED' }, method);
      if (auth.capability?.library_read_scope !== 'approved_saved_bos_v1') {
        return sendJson(res, 403, { ok: false, code: 'DARREN_LIBRARY_SCOPE_DENIED' }, method);
      }

      if (route === 'media/whole-story-ava.mp4') return await sendFilm(req, res, { env, getFilm });

      if (route === 'api/report-card/private-bos') {
        const reading = await (privateReading ? privateReading({ redis }) : approvedPrivateReading(redis));
        if (!reading) return sendJson(res, 503, { ok: false, code: 'PRIVATE_READING_NOT_BOUND' }, method);
        const parsed = Buffer.isBuffer(reading) ? JSON.parse(reading.toString('utf8')) : reading;
        const subject = parsed?.artifact?.subject;
        if (typeof subject?.name !== 'string' || typeof subject?.sport !== 'string' || !Number.isInteger(subject?.age)) {
          throw new Error('PRIVATE_BOS_SUBJECT_INVALID');
        }
        return sendJson(res, 200, {
          ok: true,
          subject: { name: subject.name, sport: subject.sport, age: subject.age },
          href: '/darren-library/bos.html?athlete=bailea',
        }, method);
      }

      const report = route.match(/^api\/report\/(bos|apa)\/(nia|eli|rowan|sofia|bailea)$/);
      if (report) {
        const [, kind, slug] = report;
        if (slug === 'bailea') {
          if (kind !== 'bos') return sendJson(res, 404, { ok: false, code: 'PRIVATE_APA_NOT_IN_LIBRARY' }, method);
          const reading = await (privateReading ? privateReading({ redis }) : approvedPrivateReading(redis));
          if (!reading) return sendJson(res, 503, { ok: false, code: 'PRIVATE_READING_NOT_BOUND' }, method);
          return Buffer.isBuffer(reading)
            ? sendBytes(res, 200, reading, 'protected-reading.json', method)
            : sendJson(res, 200, reading, method);
        }
        return sendJson(res, 200, await syntheticReading(kind, slug, readFile), method);
      }

      let file = null;
      if (['', 'library', 'presentation/lisa', 'presentation/darren'].includes(route)) file = path.join(ROOT, 'dist', 'index.html');
      else if (route === 'bos.html' || route === 'apa.html') file = path.join(ROOT, 'dist', route);
      else if (/^assets\/[A-Za-z0-9_.-]+$/.test(route)) file = path.join(ROOT, 'dist', route);
      else if (route === 'media/whole-story-ava.vtt') file = path.join(ROOT, 'media', 'whole-story-ava.vtt');
      else {
        const deck = route.match(/^decks\/(lisa|darren)\/([A-Za-z0-9_.-]+)$/);
        if (deck) {
          const [, slug, name] = deck;
          const spec = DECKS[slug];
          const slide = name.match(/^slide-([1-9]\d*)\.webp$/);
          const allowed = (slide && Number(slide[1]) <= spec.count)
            || name === `${spec.stem}.pptx` || name === `${spec.stem}.pdf`;
          if (allowed) file = path.join(ROOT, 'decks', slug, name);
        }
      }
      if (!file) return sendJson(res, 404, { ok: false, code: 'LIBRARY_ROUTE_NOT_FOUND' }, method);
      return sendBytes(res, 200, await readFile(file), file, method);
    } catch (error) {
      if (res.headersSent) return res.destroy?.(error);
      return sendJson(res, error?.code === 'ENOENT' ? 404 : 500, { ok: false, code: 'LIBRARY_READ_FAILED' }, method);
    }
  };
}

export default createDarrenDemoLibraryHandler();
