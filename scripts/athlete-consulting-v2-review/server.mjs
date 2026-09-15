// Isolated loopback-only browser proof. NEVER a deployment entry point.
// Real shared gate + candidate handler; in-memory Redis and frozen response replay.
import http from 'node:http';
import net from 'node:net';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { FakeRedis } from './fakeRedis.mjs';

const root = resolve(import.meta.dirname, '../..');
const frozen = '/Users/rrg/.codex/.chatgpt-projects/g-p-6996ab388f80819194f3951033f470fc/research/athlete-consulting-v2-release-2026-09-15/source';
const evidence = resolve(root, 'docs/athlete-consulting-v2-release/browser-evidence', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(evidence, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const env = Object.freeze({ RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true', SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true', ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true', ATHLETE_CONSULTING_V2_ENABLED: 'true', OPENAI_API_KEY: '' });
Object.assign(process.env, env, { REDIS_URL: 'redis://synthetic-fixture.invalid:1', LEADERSHIP_DEMO_ACCESS_CODE: 'synthetic-test-entry-only' });
const redis = new FakeRedis();
globalThis[Symbol.for('athlete-v2-review-redis')] = redis;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'ioredis') return { shortCircuit: true, url: `data:text/javascript,${encodeURIComponent("export default class Redis { constructor() { return globalThis[Symbol.for('athlete-v2-review-redis')]; } }")}` };
  return next(specifier, context);
} });
const { default: entry } = await import('../../api/internal/leadership-demo-entry.js');
const { createAthleteConsultingV2Handler } = await import('../../server/athleteConsultingV2/handler.js');
const { createAthleteLivingConsultOneShotHandlerV1 } = await import('../../api/internal/athlete-living-consult-one-shot-v1.js');
hooks.deregister();
const attempts = [], requests = [], denied = [];
const responseIds = {
  nia: { opening: 'ece41f34-1242-4a16-ad45-c4c2b8e009ae', returning: 'ee0a6e08-d564-42d7-8315-8fc3efc48e93', chat: 'c220f8dd-6574-45de-a3ce-e2306d9d5ea1', revision: 'ee8bd8a0-95d3-4bdc-bae2-8953c57f039c', close: 'd822a1ce-fa00-4d6e-bfcd-7173b29b0436' },
  sofia: { opening: '66e1497a-7b0d-4629-9aa2-26c336bfbc99', chat: 'cd997792-f44d-4176-9c7b-ceef14971d7e', close: '4bff5e4e-65d5-4a3e-b7d0-b17f1f017e8d' },
};
const transport = async request => {
  const input = JSON.parse(request.input), slug = input.athlete.slug;
  const kind = input.task === 'CLOSE' ? 'close' : input.task === 'OPENING' ? input.previous_sessions.length && slug === 'nia' ? 'returning' : 'opening' : slug === 'nia' && input.pending_draft ? 'revision' : 'chat';
  const id = responseIds[slug]?.[kind];
  if (!id) throw Error('REVIEW_REPLAY_NOT_AVAILABLE');
  const bytes = readFileSync(resolve(frozen, 'evidence/provider', id + '-response.json'));
  attempts.push({ kind: 'FROZEN_RESPONSE_REPLAY_NOT_NEW_COACHING_PROOF', slug, task: input.task, fixture_id: id, fixture_sha256: sha(bytes), input_sha256: sha(request.input), at: new Date().toISOString() });
  return JSON.parse(bytes);
};
const handler = createAthleteConsultingV2Handler({ env, redis, transport });
const dispatcher = createAthleteLivingConsultOneShotHandlerV1({ env, redis });
const denyOutbound = () => { denied.push({ at: new Date().toISOString(), type: 'SERVER_OUTBOUND_BLOCKED' }); throw Error('REVIEW_NETWORK_DENIED'); };
globalThis.fetch = denyOutbound;
net.Socket.prototype.connect = denyOutbound;
syncBuiltinESMExports();
let sequence = 0;
function receipt() {
  const states = [...redis.values].filter(([key]) => key.endsWith(':state')).map(([key, value]) => {
    const envelope = JSON.parse(value), state = envelope.state || envelope;
    return { key_sha256: sha(key), revision: state.revision, status: state.status, messages: state.messages?.length, sessions: state.sessions?.length, plan: state.plan?.title || null, draft: state.draft?.title || null, learning: state.learning?.length };
  });
  writeFileSync(resolve(evidence, String(++sequence).padStart(4, '0') + '-receipt.json'), JSON.stringify({ at: new Date().toISOString(), real_provider_calls: 0, real_redis_connections: 0, original_5285_untouched: true, cookie_security_unchanged: true, requests, replay_attempts: attempts, denied_outbound: denied, states }, null, 2) + '\n', { flag: 'wx' });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:5286');
  req.query = Object.fromEntries(url.searchParams);
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'");
  res.on('finish', () => { requests.push({ method: req.method, path: url.pathname, kind: url.searchParams.get('kind'), athlete: url.searchParams.get('athlete'), status: res.statusCode }); if (url.pathname.startsWith('/api/')) receipt(); });
  try {
    if (req.headers.host !== '127.0.0.1:5286' && req.headers.host !== 'localhost:5286') { res.statusCode = 403; return res.end('REVIEW_HOST_DENIED'); }
    if (url.pathname === '/api/internal/leadership-demo-entry') {
      if (req.method === 'POST') {
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 50000) throw Error('REVIEW_BODY_LIMIT'); }
        req.body = JSON.parse(body || '{}');
        if (!['ENTER','LAUNCH_ATHLETE_CONSULTING_TOOL'].includes(req.body.action)) { res.statusCode = 403; return res.end('REVIEW_OTHER_PRODUCT_DISABLED'); }
      }
      return await entry(req, res);
    }
    if (url.pathname === '/api/internal/athlete-living-consult-one-shot-v1') return await (url.searchParams.get('version_only') === '1' ? dispatcher : handler)(req, res);
    const routes = new Set(['/leadership','/leadership-demo','/athlete-consulting-tool/demo']);
    const pages = new Set(['/athlete-consulting-tool/demo/workspace.html','/athlete-consulting-tool/demo/apa-reading.html']);
    let file;
    if (routes.has(url.pathname)) file = resolve(root, 'dist/index.html');
    else if (pages.has(url.pathname) || /^\/assets\/[A-Za-z0-9_.-]+$/.test(url.pathname)) file = resolve(root, 'dist', url.pathname.slice(1));
    else { res.statusCode = 404; return res.end('REVIEW_ROUTE_NOT_ALLOWED'); }
    if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
    res.setHeader('Content-Type', ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' })[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch { res.statusCode = 500; res.end('ISOLATED_REVIEW_ERROR'); }
});
server.listen(5286, '127.0.0.1', () => { receipt(); console.log(JSON.stringify({ url: 'http://127.0.0.1:5286/leadership', evidence, mode: 'FROZEN_REPLAY_AND_IN_MEMORY_STORAGE', real_provider_calls: 0, live_access: false })); });
