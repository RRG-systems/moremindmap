import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { authenticateLeadershipLauncher, issueLeadershipLauncherCapability } from '../api/engine/leadershipDemo/authority.js';
import { createDarrenDemoLibraryHandler } from '../server/darrenLibraryV1/handler.js';

const ROOT = fileURLToPath(new URL('../server/darrenLibraryV1/', import.meta.url));
const ENABLED = Object.freeze({
  RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
  SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
  DARREN_DEMO_LIBRARY_ENABLED: 'true',
});

function request(route, { method = 'GET', origin = 'https://moremindmap.com', cookie = '', agent = 'Library test browser' } = {}) {
  return {
    method,
    url: `/api/internal/darren-demo-library?path=${encodeURIComponent(route)}`,
    query: { path: route },
    headers: { host: 'moremindmap.com', 'x-forwarded-proto': 'https', 'x-forwarded-for': '203.0.113.15', 'user-agent': agent, cookie, ...(origin ? { origin } : {}) },
  };
}

function response() {
  const headers = new Map();
  return {
    statusCode: 200,
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    getHeader(name) { return headers.get(name.toLowerCase()); },
    end(value) { this.body = value ? Buffer.from(value) : Buffer.alloc(0); },
    json() { return JSON.parse(this.body.toString('utf8')); },
  };
}

function handler({ env = ENABLED, getRedis = () => ({ getBuffer: async () => null }), authenticate = async () => ({ ok: true, capability: { library_read_scope: 'approved_saved_bos_v1' } }), readFile = fs.promises.readFile, privateReading = null } = {}) {
  return createDarrenDemoLibraryHandler({ env, getRedis, authenticate, readFile, privateReading });
}

class FakeRedis {
  constructor() { this.values = new Map(); }
  async set(key, value) { this.values.set(key, String(value)); return 'OK'; }
  async get(key) { return this.values.get(key) ?? null; }
  async getBuffer(key) { const value = this.values.get(key); return value ? Buffer.from(value) : null; }
}

test('library defaults off and denies mutation, foreign origin, and missing session', async () => {
  const off = response();
  await handler({ env: {} })(request('library'), off);
  assert.equal(off.statusCode, 404);
  assert.equal(off.json().code, 'DARREN_DEMO_LIBRARY_DEFAULT_OFF');

  const mutation = response();
  await handler()(request('library', { method: 'POST' }), mutation);
  assert.equal(mutation.statusCode, 405);

  const foreign = response();
  await handler()(request('library', { origin: 'https://attacker.example' }), foreign);
  assert.equal(foreign.statusCode, 403);

  let fileRead = false;
  const unauthorized = response();
  await handler({ authenticate: async () => ({ ok: false, status: 401, code: 'NO_SESSION' }), readFile: async () => { fileRead = true; } })(request('decks/darren/slide-1.webp'), unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(fileRead, false);
  assert.equal(unauthorized.getHeader('cache-control'), 'no-store, private, max-age=0');
  assert.match(unauthorized.getHeader('content-security-policy'), /frame-ancestors 'none'/u);

  const wrongScope = response();
  await handler({ authenticate: async () => ({ ok: true, capability: { library_read_scope: null } }) })(request('library'), wrongScope);
  assert.equal(wrongScope.statusCode, 403);
});

test('real Leadership launcher grants only the exact scoped library session, not older, expired or foreign sessions', async () => {
  const redis = new FakeRedis();
  const issued = await issueLeadershipLauncherCapability({ redis, req: request('library'), env: ENABLED });
  assert.equal(issued.capability.synthetic_only, true);
  assert.deepEqual(issued.capability.allowed_products, ['recruiting', 'subscription']);
  assert.equal(issued.capability.library_read_scope, 'approved_saved_bos_v1');
  const cookie = issued.cookie.split(';')[0];
  const actual = handler({ getRedis: () => redis, authenticate: ({ redis: store, req }) => authenticateLeadershipLauncher({ redis: store, req }) });

  const valid = response();
  await actual(request('library', { cookie }), valid);
  assert.equal(valid.statusCode, 200);

  const foreign = response();
  await actual(request('library', { cookie, agent: 'Another browser' }), foreign);
  assert.equal(foreign.statusCode, 401);

  const unrelated = response();
  await actual(request('library', { cookie: '__Host-more_athlete_consult_demo=other-product' }), unrelated);
  assert.equal(unrelated.statusCode, 401);

  const old = await issueLeadershipLauncherCapability({ redis, req: request('library'), env: { ...ENABLED, DARREN_DEMO_LIBRARY_ENABLED: 'false' } });
  const oldSession = response();
  await actual(request('library', { cookie: old.cookie.split(';')[0] }), oldSession);
  assert.equal(oldSession.statusCode, 403);

  const expired = await issueLeadershipLauncherCapability({ redis, req: request('library'), env: ENABLED, now: new Date(Date.now() - 60 * 60 * 1000) });
  const expiredSession = response();
  await actual(request('library', { cookie: expired.cookie.split(';')[0] }), expiredSession);
  assert.equal(expiredSession.statusCode, 401);
});

test('authenticated pages and bundled assets remain server-routed, no-store and HEAD-safe', async () => {
  for (const route of ['library', 'presentation/lisa', 'presentation/darren', 'bos.html', 'apa.html']) {
    const res = response();
    await handler()(request(route), res);
    assert.equal(res.statusCode, 200, route);
    assert.match(res.getHeader('content-type'), /^text\/html/u);
    assert.equal(res.getHeader('cache-control'), 'no-store, private, max-age=0');
    assert.ok(res.body.length > 0);
  }
  const files = fs.readdirSync(path.join(ROOT, 'dist', 'assets'));
  const asset = files.find(name => name.endsWith('.js'));
  const head = response();
  await handler()(request(`assets/${asset}`, { method: 'HEAD', origin: null }), head);
  assert.equal(head.statusCode, 200);
  assert.equal(head.body.length, 0);
  assert.ok(Number(head.getHeader('content-length')) > 0);
});

test('synthetic reports preserve their own MM identity and BOS evidence source', async () => {
  const expected = { nia: 'MM-20260913-D702ACBF', eli: 'MM-20260913-6A49112B', rowan: 'MM-20260913-99A1DB45', sofia: 'MM-20260913-6184D6D9' };
  for (const [slug, mm] of Object.entries(expected)) {
    for (const kind of ['bos', 'apa']) {
      const res = response();
      await handler()(request(`api/report/${kind}/${slug}`), res);
      assert.equal(res.statusCode, 200, `${slug}/${kind}`);
      assert.equal(res.json().artifact.mm, mm);
      if (kind === 'bos') {
        assert.equal(res.json().artifact.synthetic, true);
        assert.ok(res.json().source.answers.length > 0);
        assert.ok(res.json().artifact.reading.chapters.length >= 8);
      }
    }
  }
});

test('slides and approved deck files are allowlisted; traversal and private APA are not', async () => {
  for (const [slug, count, stem] of [
    ['lisa', 16, 'MORE_Youth_Sports_v05_School'],
    ['darren', 26, 'MORE_Athlete_Darren_Technical_Vision_v1'],
  ]) {
    for (const name of [`slide-1.webp`, `slide-${count}.webp`, `${stem}.pdf`, `${stem}.pptx`]) {
      const res = response();
      await handler()(request(`decks/${slug}/${name}`), res);
      assert.equal(res.statusCode, 200, `${slug}/${name}`);
      assert.ok(res.body.length > 0);
    }
    const outOfRange = response();
    await handler()(request(`decks/${slug}/slide-${count + 1}.webp`), outOfRange);
    assert.equal(outOfRange.statusCode, 404);
  }
  for (const route of ['../data/nia-bos.json', 'decks/lisa/../../data/nia-bos.json', 'assets/%252e%252e', 'api/report/apa/bailea']) {
    const res = response();
    await handler()(request(route), res);
    assert.equal(res.statusCode, 404, route);
  }
});

test('private BOS is held without binding and can be exercised only with a synthetic injected payload', async () => {
  const held = response();
  await handler()(request('api/report/bos/bailea'), held);
  assert.equal(held.statusCode, 503);
  assert.equal(held.json().code, 'PRIVATE_READING_NOT_BOUND');

  const syntheticPrivate = { artifact: { mm: 'MM-SYNTHETIC-PRIVATE-TEST', subject: { name: 'Fixture Person', sport: 'Fixture Sport', age: 18 } }, source: { answers: [] } };
  const injected = response();
  await handler({ privateReading: async () => syntheticPrivate })(request('api/report/bos/bailea'), injected);
  assert.equal(injected.statusCode, 200);
  assert.deepEqual(injected.json(), syntheticPrivate);

  const card = response();
  await handler({ privateReading: async () => syntheticPrivate })(request('api/report-card/private-bos'), card);
  assert.equal(card.statusCode, 200);
  assert.deepEqual(card.json().subject, syntheticPrivate.artifact.subject);
  assert.equal(card.json().href, '/darren-library/bos.html?athlete=bailea');

  const wrongBytes = response();
  await handler({ getRedis: () => ({ getBuffer: async () => Buffer.from('{}') }) })(request('api/report/bos/bailea'), wrongBytes);
  assert.equal(wrongBytes.statusCode, 500);
  assert.equal(wrongBytes.json().code, 'LIBRARY_READ_FAILED');
});

test('client source and built client bundles contain no private participant identity or source', () => {
  const clientFiles = [
    path.join(ROOT, 'client/src/main.jsx'),
    path.join(ROOT, 'client/bos/App.jsx'),
    path.join(ROOT, 'client/apa/main.jsx'),
    ...fs.readdirSync(path.join(ROOT, 'dist', 'assets')).map(name => path.join(ROOT, 'dist', 'assets', name)),
  ];
  for (const filename of clientFiles) {
    const content = fs.readFileSync(filename, 'utf8');
    assert.doesNotMatch(content, /Bailea|Harmon|private-source|private-release/u, filename);
  }
});
