// Private QA only: real candidate UI/handlers, synthetic Leadership authority,
// dedicated loopback Redis, and a hard shared budget for real model calls.
// Never deploy this file or use Vite's dev server for this review.
import http from 'node:http';
import net from 'node:net';
import process from 'node:process';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, lstatSync, mkdtempSync, readFileSync,
  realpathSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { createCoach } from '../../server/athleteConsultingV2/coach.js';
import { createAthleteVisualComposer } from '../../server/athleteConsultingV2/visual.js';
import { createApaComposer } from '../../server/athleteConsultingV2/apaComposer.js';
import { safeDiagnostics, safeApaMetadata } from './safe-diagnostics.mjs';
import { forkSyntheticRun } from './fork-synthetic-run.mjs';

const root = resolve(import.meta.dirname, '../..');
const dist = resolve(root, 'dist');
const port = 5286;
const runPrefix = '/private/tmp/moremindmap-athlete-flagship-qa-';
const modelCallLimit = 8;
const priorModelAttempts = 15;
const cumulativeModelCallLimit = 23;
const precedingRunDir = '/private/tmp/moremindmap-athlete-flagship-qa-llbFb8';
const run2ClaimPath = '/private/tmp/moremindmap-athlete-flagship-run2-llbFb8.json';
const allowedModel = 'gpt-5.6-sol';
const localAccessCode = 'synthetic-test-entry-only';
const startupCodes = new Set(['ATHLETE_QA_SOURCE_NOT_SEALED', 'ATHLETE_QA_BUILD_STALE',
  'ATHLETE_QA_BUILD_MISMATCH', 'ATHLETE_QA_RESUME_DIR_DENIED',
  'ATHLETE_QA_ARGUMENTS_DENIED', 'ATHLETE_QA_RESUME_CUSTODY_CHANGED',
  'ATHLETE_QA_LOCAL_REDIS_UNAVAILABLE', 'ATHLETE_QA_PROVIDER_BINDING_REQUIRED',
  'ATHLETE_QA_LOCAL_REDIS_EXITED', 'ATHLETE_QA_FORK_INVALID']);
const pages = ['index.html', 'athlete-consulting-tool/demo/workspace.html',
  'athlete-consulting-tool/demo/apa-reading.html'];
const sha = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const wait = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));

let runDir = null;
let redisProcess = null;
let redis = null;
let server = null;
let budgetKey = null;
let stopping = false;

function printStatus(url, count, failureCode = null) {
  process.stdout.write(JSON.stringify({ url, run_dir: runDir,
    model_call_count: Number(count) || 0,
    ...(failureCode ? { error_code: failureCode } : {}) }) + '\n');
}

function checkBuild() {
  if (git('status', '--porcelain')) throw new Error('ATHLETE_QA_SOURCE_NOT_SEALED');
  const manifest = JSON.parse(readFileSync(resolve(dist, '.athlete-qa-build.json'), 'utf8'));
  if (manifest.schema !== 'more.athlete.flagship.loopback-build/v1'
    || manifest.head !== git('rev-parse', 'HEAD')
    || manifest.tree !== git('rev-parse', 'HEAD^{tree}')) throw new Error('ATHLETE_QA_BUILD_STALE');
  const actual = [...pages, ...readdirSync(resolve(dist, 'assets'))
    .filter(name => /^[A-Za-z0-9_.-]+$/u.test(name)).map(name => `assets/${name}`).sort()];
  if (JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify([...actual].sort())
    || actual.some(file => manifest.files[file] !== sha(readFileSync(resolve(dist, file))))) {
    throw new Error('ATHLETE_QA_BUILD_MISMATCH');
  }
  return { head: manifest.head, tree: manifest.tree,
    build_sha256: sha(readFileSync(resolve(dist, '.athlete-qa-build.json'))) };
}

function privateRunDirectory(custody) {
  let fresh = false;
  let lineage = null;
  if (process.argv.length === 4 && process.argv[2] === '--fork-dir'
    && process.argv[3] === precedingRunDir) {
    try { lstatSync(run2ClaimPath); throw new Error('ATHLETE_QA_ARGUMENTS_DENIED'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    runDir = mkdtempSync(runPrefix);
    chmodSync(runDir, 0o700);
    try { lineage = forkSyntheticRun({ sourceDir: precedingRunDir, targetDir: runDir }); }
    catch { throw new Error('ATHLETE_QA_FORK_INVALID'); }
    fresh = true;
  } else if (process.argv.length === 4 && process.argv[2] === '--resume-dir') {
    const candidate = process.argv[3];
    if (!candidate.startsWith(runPrefix) || basename(candidate).includes('/')
      || !lstatSync(candidate).isDirectory() || realpathSync(candidate) !== candidate
      || lstatSync(candidate).uid !== process.getuid()
      || (lstatSync(candidate).mode & 0o077) !== 0) throw new Error('ATHLETE_QA_RESUME_DIR_DENIED');
    runDir = candidate;
  } else throw new Error('ATHLETE_QA_ARGUMENTS_DENIED');
  const receiptPath = resolve(runDir, 'run.json');
  if (fresh) {
    writeFileSync(receiptPath, JSON.stringify({ schema: 'more.athlete.flagship.loopback-run/v2',
      ...custody, created_at: new Date().toISOString(), model_call_limit: modelCallLimit,
      prior_model_attempts: priorModelAttempts, cumulative_model_call_limit: cumulativeModelCallLimit,
      lineage, synthetic_only: true, local_redis_only: true }) + '\n', { flag: 'wx', mode: 0o600 });
    // One create-only phase claim prevents a new fork from silently renewing
    // the eight-attempt allowance. Restarts must use this same run directory.
    writeFileSync(run2ClaimPath, JSON.stringify({ run_dir: runDir, ...custody,
      model_call_limit: modelCallLimit }) + '\n', { flag: 'wx', mode: 0o600 });
  }
  else {
    const prior = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const phaseClaim = JSON.parse(readFileSync(run2ClaimPath, 'utf8'));
    if (prior.schema !== 'more.athlete.flagship.loopback-run/v2'
      || prior.head !== custody.head || prior.tree !== custody.tree
      || prior.build_sha256 !== custody.build_sha256
      || prior.model_call_limit !== modelCallLimit
      || prior.prior_model_attempts !== priorModelAttempts
      || prior.cumulative_model_call_limit !== cumulativeModelCallLimit
      || prior.lineage?.source_dir !== precedingRunDir
      || phaseClaim.run_dir !== runDir || phaseClaim.head !== custody.head
      || phaseClaim.tree !== custody.tree || phaseClaim.build_sha256 !== custody.build_sha256
      || phaseClaim.model_call_limit !== modelCallLimit) throw new Error('ATHLETE_QA_RESUME_CUSTODY_CHANGED');
  }
}

async function availablePort() {
  const probe = net.createServer();
  await new Promise((resolveListen, rejectListen) => {
    probe.once('error', rejectListen);
    probe.listen(0, '127.0.0.1', resolveListen);
  });
  const candidate = probe.address().port;
  await new Promise(resolveClose => probe.close(resolveClose));
  return candidate;
}

async function localRedis() {
  const redisPort = await availablePort();
  let spawnFailed = false;
  redisProcess = spawn('redis-server', ['--bind', '127.0.0.1', '--port', String(redisPort),
    '--protected-mode', 'yes', '--dir', runDir, '--appendonly', 'yes',
    '--appendfsync', 'always', '--save', '', '--logfile', '/dev/null',
    '--daemonize', 'no'], { cwd: runDir, stdio: 'ignore',
    env: { PATH: process.env.PATH || '/usr/bin:/bin', LANG: 'C' } });
  redisProcess.once('error', () => { spawnFailed = true; });
  const url = `redis://127.0.0.1:${redisPort}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnFailed || redisProcess.exitCode !== null) break;
    const socketReady = await new Promise(resolveSocket => {
      const socket = net.connect(redisPort, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolveSocket(true); });
      socket.once('error', () => resolveSocket(false));
    });
    if (socketReady && redisProcess.exitCode === null) { ready = true; break; }
    await wait(50);
  }
  if (!ready) throw new Error('ATHLETE_QA_LOCAL_REDIS_UNAVAILABLE');
  redis = new Redis(url, { connectTimeout: 2000, commandTimeout: 5000,
    maxRetriesPerRequest: 1, enableReadyCheck: true, lazyConnect: true,
    retryStrategy: () => null });
  redis.on('error', () => { /* never log local transport details */ });
  if (await redis.ping() !== 'PONG' || redisProcess.exitCode !== null) {
    throw new Error('ATHLETE_QA_LOCAL_REDIS_UNAVAILABLE');
  }
  return url;
}

function appendReceipt(value) {
  appendFileSync(resolve(runDir, 'receipts.jsonl'), JSON.stringify(value) + '\n',
    { flag: 'a', mode: 0o600 });
}

function safeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  return Object.fromEntries(['input_tokens', 'output_tokens', 'total_tokens']
    .filter(key => Number.isSafeInteger(usage[key]) && usage[key] >= 0)
    .map(key => [key, usage[key]]));
}

function evidenceSinkFor(runId) {
  return async event => {
    if (!['request', 'response', 'receipt', 'failure'].includes(event?.kind)
      || !/^[a-f0-9-]{36}$/u.test(event.id || '')) throw new Error('ATHLETE_QA_EVIDENCE_INVALID');
    const record = { kind: event.kind, id: event.id, at: new Date().toISOString(),
      payload_sha256: sha(JSON.stringify(event)),
      status: typeof event.status === 'string' ? event.status
        : typeof event.response?.status === 'string' ? event.response.status : null,
      model: typeof event.model === 'string' ? event.model
        : typeof event.response?.model === 'string' ? event.response.model
          : typeof event.request?.model === 'string' ? event.request.model : null,
      usage: safeUsage(event.usage || event.response?.usage), ...safeDiagnostics(event),
      ...safeApaMetadata(event) };
    const key = `qa:athlete-flagship:${runId}:evidence:${event.id}:${event.kind}`;
    if (await redis.set(key, JSON.stringify(record), 'NX') !== 'OK') {
      throw new Error('ATHLETE_QA_EVIDENCE_DUPLICATE');
    }
    appendReceipt(record);
  };
}

function transportFor(client) {
  return async (request, options = {}) => {
    if (request?.model !== allowedModel) throw new Error('ATHLETE_QA_MODEL_DENIED');
    const timeout = options.timeout === 600000 ? 600000 : 180000;
    // INCR is durable before network invocation; every composer shares this key.
    const ordinal = await redis.incr(budgetKey);
    if (ordinal > modelCallLimit) throw new Error('ATHLETE_QA_MODEL_BUDGET_EXHAUSTED');
    const basis = { kind: 'model_invocation', ordinal, at: new Date().toISOString(),
      model: allowedModel, request_sha256: sha(JSON.stringify(request)) };
    appendReceipt({ ...basis, status: 'attempted' });
    try {
      const response = await client.responses.create(request, {
        signal: options.signal || AbortSignal.timeout(timeout), maxRetries: 0,
        timeout,
      });
      appendReceipt({ ...basis, at: new Date().toISOString(), status: response?.status || 'unknown',
        response_model: response?.model || null, usage: safeUsage(response?.usage) });
      return response;
    } catch (error) {
      appendReceipt({ ...basis, at: new Date().toISOString(), status: 'failed',
        http_status: Number.isInteger(error?.status) ? error.status : null });
      throw error;
    }
  };
}

async function requestBody(req) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 50000) throw new Error('ATHLETE_QA_BODY_LIMIT');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function stop(failed = false, failureCode = null) {
  if (stopping) return;
  stopping = true;
  if (server) {
    server.closeAllConnections();
    await new Promise(resolveClose => server.close(resolveClose));
  }
  let count = 0;
  try { count = Number(await redis?.get(budgetKey)) || 0; } catch { /* local store may have failed */ }
  printStatus(failed ? null : `http://127.0.0.1:${port}/leadership`, count,
    failed ? (startupCodes.has(failureCode) ? failureCode : 'ATHLETE_QA_START_FAILED') : null);
  try { await redis?.quit(); } catch { redis?.disconnect(); }
  if (redisProcess && redisProcess.exitCode === null) redisProcess.kill('SIGTERM');
  if (failed) process.exitCode = 1;
}

async function main() {
  process.umask(0o077);
  const custody = checkBuild();
  const apiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.length < 20) throw new Error('ATHLETE_QA_PROVIDER_BINDING_REQUIRED');
  privateRunDirectory(custody);
  const redisUrl = await localRedis();
  const runId = sha(runDir);
  budgetKey = `qa:athlete-flagship:${runId}:model-calls`;
  const env = Object.freeze({ REDIS_URL: redisUrl,
    LEADERSHIP_DEMO_ACCESS_CODE: localAccessCode,
    RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
    SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
    ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true',
    ATHLETE_CONSULTING_V2_ENABLED: 'true',
    ATHLETE_CONSULTING_FLAGSHIP_ENABLED: 'true',
    ATHLETE_COACH_CONNECT_VOICE_TRANSCRIPTION_ENABLED: 'false' });
  Object.assign(process.env, env);
  const nativeFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = () => { throw new Error('ATHLETE_QA_UNSCOPED_FETCH_DENIED'); };
  const secureFetch = (input, init) => {
    const target = new URL(typeof input === 'string' ? input : input.url);
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    if (target.origin !== 'https://api.openai.com' || target.pathname !== '/v1/responses'
      || method !== 'POST') throw new Error('ATHLETE_QA_PROVIDER_TARGET_DENIED');
    return nativeFetch(input, init);
  };
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 180000, fetch: secureFetch });
  const transport = transportFor(client);
  const evidenceSink = evidenceSinkFor(runId);
  const { default: leadershipEntry } = await import('../../api/internal/leadership-demo-entry.js');
  const { createAthleteConsultingV2Handler } = await import('../../server/athleteConsultingV2/handler.js');
  const { createAthleteLivingConsultOneShotHandlerV1 } = await import('../../api/internal/athlete-living-consult-one-shot-v1.js');
  const handler = createAthleteConsultingV2Handler({ env, redis,
    coach: createCoach({ env, transport, evidenceSink }),
    visualComposer: createAthleteVisualComposer({ env, transport, evidenceSink }),
    apaComposer: createApaComposer({ env, transport, evidenceSink }) });
  const versionProbe = createAthleteLivingConsultOneShotHandlerV1({ env, redis });
  const routePages = new Set(['/leadership', '/leadership-demo', '/athlete-consulting-tool/demo']);
  const innerPages = new Set(['/athlete-consulting-tool/demo/workspace.html',
    '/athlete-consulting-tool/demo/apa-reading.html']);
  server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'");
    try {
      if (!req.url?.startsWith('/') || req.headers.host !== `127.0.0.1:${port}`
        || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
        res.statusCode = 403; return res.end('LOOPBACK_ONLY');
      }
      delete req.headers['x-forwarded-host'];
      delete req.headers['x-forwarded-proto'];
      delete req.headers['x-forwarded-for'];
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      req.query = Object.fromEntries(url.searchParams);
      res.status = code => { res.statusCode = code; return res; };
      res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
      if (url.pathname === '/api/internal/leadership-demo-entry') {
        if (req.method === 'POST') {
          req.body = await requestBody(req);
          if (!['ENTER', 'LAUNCH_ATHLETE_CONSULTING_TOOL'].includes(req.body.action)) {
            res.statusCode = 403; return res.end('OTHER_PRODUCT_DISABLED');
          }
        }
        return await leadershipEntry(req, res);
      }
      if (url.pathname === '/api/internal/athlete-living-consult-one-shot-v1') {
        return await (url.searchParams.get('version_only') === '1' ? versionProbe : handler)(req, res);
      }
      let file = null;
      if (routePages.has(url.pathname)) file = resolve(dist, 'index.html');
      else if (innerPages.has(url.pathname)
        || /^\/assets\/[A-Za-z0-9_.-]+$/u.test(url.pathname)) file = resolve(dist, url.pathname.slice(1));
      else { res.statusCode = 404; return res.end('NOT_FOUND'); }
      if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript',
        '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
      return res.end(readFileSync(file));
    } catch {
      res.statusCode = 500;
      return res.end('ISOLATED_QA_ERROR');
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  printStatus(`http://127.0.0.1:${port}/leadership`, await redis.get(budgetKey));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void stop(); });
  redisProcess.once('exit', () => { if (!stopping) void stop(true, 'ATHLETE_QA_LOCAL_REDIS_EXITED'); });
}

main().catch(error => { void stop(true, error?.message); });
