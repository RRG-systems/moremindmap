// Local synthetic proof only. Never import this entrypoint into Product routes.
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { networkInterfaces } from 'node:os';
import { Socket } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.argv[2] || 5269);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('REVIEW_PORT_INVALID');
const egressAttempts = [];
globalThis.fetch = async () => { egressAttempts.push('fetch'); throw new Error('REVIEW_EXTERNAL_FETCH_DENIED'); };
Socket.prototype.connect = function blockedReviewConnect() {
  egressAttempts.push('socket_connect');
  throw new Error('REVIEW_OUTBOUND_SOCKET_DENIED');
};
const [{ createConsultingRuntimeFixture }, { createRecruitingHttpHandler }, { createRecruitingGuV1Handler }] = await Promise.all([
  import('./runtimeFixture.mjs'),
  import('../../api/engine/recruitingV1/http.js'),
  import('../../api/recruiting/gu-v1.js'),
]);

const env = Object.freeze({ RECRUITING_V1_ENABLED: 'true', RECRUITING_GU_V1_ENABLED: 'true', NODE_ENV: 'development' });
const privateAddresses = Object.values(networkInterfaces()).flat().filter((n) => n.family === 'IPv4' && !n.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address)).map((n) => n.address);
const allowedHosts = ['127.0.0.1', 'localhost', ...privateAddresses];
const memberships = [
  { membership_id: 'review_admin', manager_subject_id: 'review_darren', enterprise_id: 'review_enterprise', manager_profile_id: 'mm-20990101-darren01', manager_name: 'Darren', manager_email: 'darren@example.test', enterprise_name: 'MORE Review Enterprise', status: 'ACTIVE', entitlement_mode: 'unlimited', admin_roles: ['RECRUITING_ADMIN'], recruiting_governance: { all_enterprises: true, enterprise_ids: [] }, synthetic_only: true },
  { membership_id: 'review_manager', manager_subject_id: 'review_sophia', enterprise_id: 'review_enterprise', manager_profile_id: 'mm-20990101-sophia01', manager_name: 'Sophia Bennett', manager_email: 'sophia@example.test', enterprise_name: 'Harborline Realty Group', status: 'ACTIVE', entitlement_mode: '5_per_month', synthetic_only: true },
  { membership_id: 'review_empty', manager_subject_id: 'review_empty_manager', enterprise_id: 'review_other_enterprise', manager_profile_id: 'mm-20990101-morgan01', manager_name: 'Morgan Chen', manager_email: 'morgan@example.test', enterprise_name: 'Summit Realty Group', status: 'ACTIVE', entitlement_mode: '5_per_month', synthetic_only: true },
];
let fixture;
let recruitment;
let consulting;
const requests = [];
let retryDeliverySeen = 0;
const deliveryCaptures = [];
const notificationTransport = {
  synthetic: true,
  async deliver(item) {
    if (!String(item.recipient).endsWith('.test')) throw new Error('REVIEW_SYNTHETIC_TEST_RECIPIENT_REQUIRED');
    const fail = port === 5270 && item.kind === 'RECRUIT_INVITATION' && item.recipient === 'delivery-retry@example.test' && retryDeliverySeen++ === 0;
    deliveryCaptures.push({ kind: item.kind, recipient: item.recipient, success: !fail });
    return { success: !fail, receipt: fail ? 'synthetic:first-attempt-failure' : `synthetic:capture:${item.outbox_id}` };
  },
};

async function initialize() {
  fixture = await createConsultingRuntimeFixture({ memberships, notificationTransport });
  // Fixture API is source-owned and runs the real invitation/acceptance transitions.
  await fixture.addPerson({ membershipId: 'review_manager', name: 'Jordan Lee', email: 'jordan@example.test', profileId: 'mm-20990101-jordan01', readiness: 'READY' });
  await fixture.addPerson({ membershipId: 'review_manager', name: 'Avery Brooks', email: 'avery@example.test', profileId: 'mm-20990101-avery001', readiness: 'READY' });
  await fixture.addPerson({ membershipId: 'review_manager', name: 'Casey Rivera', email: 'casey@example.test', profileId: 'mm-20990101-casey001', readiness: 'BA_IN_PROGRESS' });
  await fixture.addPerson({ membershipId: 'review_manager', name: 'Taylor Reed', email: 'taylor@example.test', profileId: 'mm-20990101-taylor01', readiness: 'INVITED' });
  await fixture.addPerson({ membershipId: 'review_admin', name: 'Jamie Park', email: 'jamie@example.test', profileId: 'mm-20990101-jamie001', readiness: 'READY' });
  recruitment = createRecruitingHttpHandler({ env, service: fixture.service, executionStore: null, candidateProjection: async () => { throw new Error('REVIEW_RETIRED_PROJECTION_UNAVAILABLE'); }, generateIntelligence: async () => { throw new Error('REVIEW_RETIRED_INTELLIGENCE_UNAVAILABLE'); } });
  consulting = createRecruitingGuV1Handler({ env, service: fixture.service, runtime: fixture.runtime });
}

await initialize();
const roles = { admin: memberships[0], manager: memberships[1], empty: memberships[2] };
const toLocalCookie = (value) => String(value).replaceAll('__Host-more_recruiting_', 'more_review_recruiting_').replace(/; Secure/gi, '');
function respond(res, status, payload) { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(payload)); }

const server = await createServer({
  root, configFile: false, envFile: false,
  define: {
    'import.meta.env.VITE_RECRUITING_V1_ENABLED': '"true"',
    'import.meta.env.VITE_RECRUITING_GU_V1_ENABLED': '"true"',
    'import.meta.env.VITE_RECRUITING_V1_SYNTHETIC_REVIEW': '"false"',
  },
  plugins: [react(), {
    name: 'isolated-synthetic-recruiting-http-proof',
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        const address = req.headers.host || '';
        const host = address.split(':')[0];
        if (!allowedHosts.includes(host)) return respond(res, 403, { code: 'REVIEW_HOST_DENIED' });
        const url = new URL(req.url, `http://${address}`);
        if (/\/(?:\.env|\.git|\.vercel)(?:[/.]|$)/.test(url.pathname)) return respond(res, 404, { code: 'NOT_FOUND' });
        const pathname = decodeURIComponent(url.pathname);
        if (pathname.startsWith('/@fs/') && !pathname.includes('/node_modules/')) return respond(res, 404, { code: 'REVIEW_FILESYSTEM_PATH_DENIED' });
        const reviewRoute = /^\/(?:__review(?:\/|$)|recruiting(?:\/|$)|recruiting-gu-v1(?:\/|$))/u.test(pathname);
        const sourceRoute = /^\/(?:src\/|api\/|node_modules\/|@vite\/|@id\/|@fs\/|@react-refresh$|favicon\.svg$|index\.html$)/u.test(pathname);
        if (!reviewRoute && !sourceRoute) return respond(res, 404, { code: 'REVIEW_ROUTE_NOT_ALLOWLISTED' });
        try {
          if (url.pathname === '/__review') {
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Cache-Control', 'no-store');
            return res.end('<!doctype html><title>Synthetic two-box review</title><h1>Local synthetic review only</h1><p>Actual Recruiting and Consulting handlers. No live providers, email, Redis or customers.</p><ul><li><a href="/__review/login?role=admin">Darren admin</a></li><li><a href="/__review/login?role=manager">Standard manager — Sophia</a></li><li><a href="/__review/login?role=empty">Empty manager — Morgan</a></li></ul>');
          }
          if (url.pathname === '/__review/login') {
            const member = roles[url.searchParams.get('role')];
            if (!member) return respond(res, 400, { code: 'REVIEW_ROLE_INVALID' });
            const challenge = await fixture.service.requestManagerVerification(member.manager_profile_id);
            const session = await fixture.service.verifyManager(challenge.verification_token);
            res.setHeader('Set-Cookie', `more_review_recruiting_manager=${encodeURIComponent(session.session_token)}; Path=/; HttpOnly; SameSite=Strict`);
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Location', '/recruiting/home'); res.statusCode = 302; return res.end();
          }
          if (url.pathname === '/__review/status') {
            const state = await fixture.store.read();
            return respond(res, 200, { synthetic_only: true, production_mutations: 0, credentials_loaded: false, egress_attempts: egressAttempts, requests, counts: { memberships: Object.keys(state.memberships).length, invitations: Object.keys(state.invitations).length, sessions: Object.keys(state.shared_business_sessions).length }, sessions: Object.values(state.shared_business_sessions).map((item) => ({ session_id: item.session_id, subject_binding: item.subject_binding, status: item.status, accepted_plan_snapshot: item.accepted_plan_snapshot, agreement_delivery: item.agreement_delivery })), delivery_records: Object.values(state.outbox).map((item) => ({ kind: item.kind, recipient: item.recipient, state: item.state, attempts: item.attempts, provider_receipt: item.provider_receipt, accepted_plan_snapshot: item.payload?.accepted_plan_snapshot })) });
          }
          const handler = url.pathname === '/api/recruiting/runtime' ? recruitment : url.pathname === '/api/recruiting/gu-v1' ? consulting : null;
          if (!handler) {
            // Vite transforms source imports under /api/engine; these are not runtime API endpoints.
            if (url.pathname.startsWith('/api/') && !/^\/api\/engine\/.+\.js$/.test(url.pathname)) return respond(res, 403, { code: 'REVIEW_API_NOT_ALLOWLISTED' });
            return next();
          }
          req.headers.cookie = String(req.headers.cookie || '').replaceAll('more_review_recruiting_', '__Host-more_recruiting_');
          req.headers['x-forwarded-host'] = address;
          req.headers['x-forwarded-proto'] = 'http';
          req.query = Object.fromEntries(url.searchParams);
          const chunks = []; let size = 0;
          for await (const chunk of req) { size += chunk.length; if (size > 128 * 1024) throw new Error('REVIEW_BODY_LIMIT'); chunks.push(chunk); }
          req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
          for (const field of ['recruit_email', 'manager_email']) {
            if (req.body[field] && !String(req.body[field]).toLowerCase().endsWith('.test')) return respond(res, 422, { ok: false, code: 'REVIEW_SYNTHETIC_TEST_RECIPIENT_REQUIRED' });
          }
          const setHeader = res.setHeader.bind(res);
          res.setHeader = (name, value) => setHeader(name, name.toLowerCase() === 'set-cookie' ? Array.isArray(value) ? value.map(toLocalCookie) : toLocalCookie(value) : value);
          res.status = (code) => { res.statusCode = code; return res; };
          res.json = (value) => { res.end(JSON.stringify(value)); return res; };
          res.on('finish', () => requests.push({ route: url.pathname, method: req.method, view: req.query.view || null, action: req.body.action || null, status: res.statusCode }));
          return await handler(req, res);
        } catch (error) { if (!res.headersSent) return respond(res, 500, { code: error.message }); return res.end(); }
      });
    },
    transformIndexHtml() {
      // HTTP LAN is not a browser secure context. This local-only UUID compatibility
      // bridge keeps real HTTPS Product source unchanged and uses browser entropy.
      return [{ tag: 'script', children: 'if (globalThis.crypto && !crypto.randomUUID) crypto.randomUUID = () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));', injectTo: 'head' }];
    },
  }],
  server: { host: '0.0.0.0', port, strictPort: true, allowedHosts, fs: { strict: true, allow: [root, fileURLToPath(new URL('../../node_modules', import.meta.url))] } },
});
await server.listen();
console.log(JSON.stringify({ review: 'SYNTHETIC_ACTUAL_HTTP_ONLY', pid: process.pid, bind: '0.0.0.0', port, localhost: `http://127.0.0.1:${port}/__review`, lan: privateAddresses.map((ip) => `http://${ip}:${port}/__review`), no_production_proxy: true, env_files_disabled: true, outbound_network_denied: true }));
