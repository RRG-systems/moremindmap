import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import test from 'node:test';

import { recruitingHttpHandler } from '../api/engine/recruitingV1/http.js';
import { resetSyntheticRecruitingRuntimeForTest } from '../api/engine/recruitingV1/runtime.js';
import { MANAGER_SESSION_TTL_MS } from '../src/lib/recruitingV1/contracts.js';
import { resolveAuthenticatedRecruitingLanding } from '../src/lib/recruitingV1/landing.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';

const appSource = readFileSync(new URL('../src/recruitingV1/RecruitingV1App.jsx', import.meta.url), 'utf8');

function invoke({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
  const responseHeaders = {};
  let statusCode = 200;
  return new Promise((resolve, reject) => {
    const req = {
      method,
      query,
      body,
      headers: { host: 'moremindmap.com', origin: 'https://moremindmap.com', ...headers },
    };
    const res = {
      setHeader(name, value) { responseHeaders[name.toLowerCase()] = value; },
      status(code) { statusCode = code; return this; },
      json(payload) { resolve({ status: statusCode, headers: responseHeaders, payload }); },
    };
    recruitingHttpHandler(req, res).catch(reject);
  });
}

function cookiePair(setCookie) {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return String(value).split(';')[0];
}

async function establishManager(profileId) {
  const requested = await invoke({
    method: 'POST',
    body: { action: 'REQUEST_MANAGER_VERIFICATION', profile_id: profileId },
  });
  const verified = await invoke({
    method: 'POST',
    body: { action: 'VERIFY_MANAGER', token: requested.payload.verification_token },
  });
  return { requested, verified, cookie: cookiePair(verified.headers['set-cookie']) };
}

test('ManagerExperience claims home hydration once even when navigate changes identity', () => {
  const refIndex = appSource.indexOf('const homeHydrationStarted = useRef(false);');
  const guardIndex = appSource.indexOf('if (SYNTHETIC || homeHydrationStarted.current) return;');
  const claimIndex = appSource.indexOf('homeHydrationStarted.current = true;');
  const homeReadIndex = appSource.indexOf("api({ view: 'home' })", claimIndex);
  const dependencyIndex = appSource.indexOf('}, [navigate]);', homeReadIndex);
  assert.ok(refIndex > -1);
  assert.ok(guardIndex > refIndex);
  assert.ok(claimIndex > guardIndex);
  assert.ok(homeReadIndex > claimIndex);
  assert.ok(dependencyIndex > homeReadIndex);
});

test('Darren Admin hydrates once, reaches Master Control, and refreshes without a transient 401', async () => {
  const priorNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();
  try {
    const established = await establishManager('mm-20990101-darren01');
    const setCookie = String(established.verified.headers['set-cookie']);
    assert.match(setCookie, /^__Host-more_recruiting_manager=/);
    assert.match(setCookie, /; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800$/);
    assert.equal(setCookie.includes('Domain='), false);

    const home = await invoke({ query: { view: 'home' }, headers: { cookie: established.cookie } });
    assert.equal(home.status, 200);
    assert.equal(home.payload.manager.capabilities.master_control, true);
    assert.equal(resolveAuthenticatedRecruitingLanding({
      pathname: '/recruiting/home',
      manager: home.payload.manager,
    }), '/recruiting/master-control');

    const masterControl = await invoke({
      query: { view: 'master_control' },
      headers: { cookie: cookiePair(home.headers['set-cookie']) },
    });
    const refreshedHome = await invoke({
      query: { view: 'home' },
      headers: { cookie: cookiePair(masterControl.headers['set-cookie']) },
    });
    const refreshedMasterControl = await invoke({
      query: { view: 'master_control' },
      headers: { cookie: cookiePair(refreshedHome.headers['set-cookie']) },
    });

    assert.deepEqual([
      established.requested.status,
      established.verified.status,
      home.status,
      masterControl.status,
      refreshedHome.status,
      refreshedMasterControl.status,
    ], [200, 200, 200, 200, 200, 200]);
  } finally {
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
  }
});

test('standard Manager stays on Recruiting Home, opens candidate Layer 01, and re-enters without a transient 401', async () => {
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();
  const established = await establishManager('mm-20990101-sophia01');
  const home = await invoke({ query: { view: 'home' }, headers: { cookie: established.cookie } });
  assert.equal(home.status, 200);
  assert.equal(home.payload.manager.capabilities.master_control, false);
  assert.equal(resolveAuthenticatedRecruitingLanding({
    pathname: '/recruiting/home',
    manager: home.payload.manager,
  }), null);

  const candidate = await invoke({
    query: { view: 'candidate', candidate_id: 'candidate_synthetic_evan' },
    headers: { cookie: cookiePair(home.headers['set-cookie']) },
  });
  const refreshedHome = await invoke({
    query: { view: 'home' },
    headers: { cookie: cookiePair(candidate.headers['set-cookie']) },
  });
  const sameBrowserReentry = await invoke({
    query: { view: 'home' },
    headers: { cookie: cookiePair(refreshedHome.headers['set-cookie']) },
  });

  assert.deepEqual([
    established.requested.status,
    established.verified.status,
    home.status,
    candidate.status,
    refreshedHome.status,
    sameBrowserReentry.status,
  ], [200, 200, 200, 200, 200, 200]);
});

test('expired sessions, consumed verification replay, and logout continue to fail closed', async () => {
  let now = new Date('2026-08-25T12:00:00.000Z');
  const membership = {
    membership_id: 'membership_expiry_manager',
    manager_subject_id: 'manager_expiry',
    enterprise_id: 'enterprise_expiry',
    manager_profile_id: 'mm-20990101-expiry01',
    manager_name: 'Expiry Manager',
    manager_email: 'expiry.manager@example.test',
    enterprise_name: 'Expiry Enterprise',
    status: 'ACTIVE',
    synthetic_only: true,
  };
  const service = new RecruitingV1Service({
    store: new InMemoryRecruitingStore(createEmptyRecruitingState([membership])),
    now: () => new Date(now),
    transport: createSyntheticNotificationTransport(),
  });
  const requested = await service.requestManagerVerification(membership.manager_profile_id);
  const verified = await service.verifyManager(requested.verification_token);
  await assert.rejects(service.verifyManager(requested.verification_token), /RECRUITING_MANAGER_CHALLENGE_INVALID/);
  now = new Date(now.getTime() + MANAGER_SESSION_TTL_MS);
  await assert.rejects(service.inspectManager(verified.session_token), /RECRUITING_MANAGER_SESSION_REQUIRED/);

  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();
  const browser = await establishManager('mm-20990101-sophia01');
  const replay = await invoke({
    method: 'POST',
    body: { action: 'VERIFY_MANAGER', token: browser.requested.payload.verification_token },
  });
  assert.equal(replay.status, 422);
  assert.equal(replay.payload.code, 'RECRUITING_MANAGER_CHALLENGE_INVALID');
  assert.equal((await invoke({ query: { view: 'home' }, headers: { cookie: browser.cookie } })).status, 200);

  const logout = await invoke({ method: 'DELETE', headers: { cookie: browser.cookie } });
  assert.equal(logout.status, 200);
  assert.equal(logout.payload.code, 'RECRUITING_SESSION_CLEARED');
  assert.equal(Array.isArray(logout.headers['set-cookie']), true);
  assert.equal(String(logout.headers['set-cookie']).includes('__Host-more_recruiting_manager=;'), true);
  assert.equal(String(logout.headers['set-cookie']).includes('Max-Age=0'), true);
  const afterLogout = await invoke({ query: { view: 'home' } });
  assert.equal(afterLogout.status, 401);
  assert.equal(afterLogout.payload.code, 'RECRUITING_MANAGER_SESSION_REQUIRED');
});
