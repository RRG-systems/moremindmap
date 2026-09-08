import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { recruitingHttpHandler } from '../api/engine/recruitingV1/http.js';
import { resetSyntheticRecruitingRuntimeForTest } from '../api/engine/recruitingV1/runtime.js';
import { canonicalJson } from '../src/lib/publicSiteAirlockV1/contracts.js';
import {
  PROFILE_OWNER_COOKIE,
  resolveProfileOwnershipAudience,
} from '../src/lib/publicSiteAirlockV1/profileOwnership.js';

function invoke({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
  const responseHeaders = {};
  let statusCode = 200;
  return new Promise((resolve, reject) => {
    const req = {
      method, query, body,
      headers: { host: 'localhost:4173', origin: 'http://localhost:4173', ...headers },
    };
    const res = {
      setHeader(name, value) { responseHeaders[name.toLowerCase()] = value; },
      status(code) { statusCode = code; return this; },
      json(payload) { resolve({ status: statusCode, headers: responseHeaders, payload }); },
      end() { resolve({ status: statusCode, headers: responseHeaders, payload: null }); },
    };
    recruitingHttpHandler(req, res).catch(reject);
  });
}

function cookiePair(setCookie) {
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return String(value).split(';')[0];
}

function signedProfileOwnerCookie(profileId) {
  const audience = resolveProfileOwnershipAudience(process.env);
  const claims = {
    version: 'more-public-profile-owner-receipt-v1',
    issuer: 'MORE_MINDMAP_PUBLIC_PROFILE_OWNER',
    audience,
    purpose: 'PROFILE_BOUND_CUSTOMER_ENTRY',
    profile_id: profileId,
    challenge_receipt_ref: 'synthetic-http-owner-proof',
    issued_at_ms: Date.now(),
    expires_at_ms: Date.now() + 30 * 60 * 1000,
  };
  const body = Buffer.from(canonicalJson(claims)).toString('base64url');
  const signature = crypto.createHmac(
    'sha256',
    process.env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY,
  ).update(`mmm-public-profile-owner-receipt-v1\0${audience}\0${body}`).digest('base64url');
  return `${PROFILE_OWNER_COOKIE}=${encodeURIComponent(`${body}.${signature}`)}`;
}

test('Recruiting HTTP is default-off unless the reviewed server feature flag is enabled', async () => {
  const priorSynthetic = process.env.RECRUITING_V1_SYNTHETIC_REVIEW;
  const priorEnabled = process.env.RECRUITING_V1_ENABLED;
  delete process.env.RECRUITING_V1_SYNTHETIC_REVIEW;
  delete process.env.RECRUITING_V1_ENABLED;
  resetSyntheticRecruitingRuntimeForTest();
  try {
    const response = await invoke({ query: { view: 'session' } });
    assert.equal(response.status, 404);
    assert.equal(response.payload.code, 'NOT_FOUND');
  } finally {
    if (priorSynthetic === undefined) delete process.env.RECRUITING_V1_SYNTHETIC_REVIEW;
    else process.env.RECRUITING_V1_SYNTHETIC_REVIEW = priorSynthetic;
    if (priorEnabled === undefined) delete process.env.RECRUITING_V1_ENABLED;
    else process.env.RECRUITING_V1_ENABLED = priorEnabled;
    resetSyntheticRecruitingRuntimeForTest();
  }
});

test('HTTP boundary provisions no manager, rotates opaque cookies, and requires a one-time same-origin CSRF proof', async () => {
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();
  const requested = await invoke({ method: 'POST', body: { action: 'REQUEST_MANAGER_VERIFICATION', profile_id: 'mm-20990101-sophia01' } });
  assert.equal(requested.status, 200);
  assert.ok(requested.payload.verification_token);

  const verified = await invoke({ method: 'POST', body: { action: 'VERIFY_MANAGER', token: requested.payload.verification_token } });
  assert.equal(verified.status, 200);
  const firstCookie = cookiePair(verified.headers['set-cookie']);
  assert.match(firstCookie, /^__Host-more_recruiting_manager=/);
  assert.equal(String(verified.headers['set-cookie']).includes('HttpOnly'), true);
  assert.equal(String(verified.headers['set-cookie']).includes('SameSite=Strict'), true);

  const home = await invoke({ query: { view: 'home' }, headers: { cookie: firstCookie } });
  assert.equal(home.status, 200);
  assert.ok(home.payload.csrf_token);
  const rotatedCookie = cookiePair(home.headers['set-cookie']);
  assert.notEqual(rotatedCookie, firstCookie);
  assert.equal(home.payload.existing_recruit.available, false);

  const deniedWithoutCsrf = await invoke({
    method: 'POST', headers: { cookie: rotatedCookie },
    body: { action: 'CREATE_INVITATION', recruit_name: 'Synthetic Recruit', recruit_email: 'api.recruit@example.test', purpose: 'Synthetic API proof.' },
  });
  assert.equal(deniedWithoutCsrf.status, 403);
  assert.equal(deniedWithoutCsrf.payload.code, 'RECRUITING_CSRF_INVALID');

  const refreshed = await invoke({ query: { view: 'home' }, headers: { cookie: rotatedCookie } });
  const currentCookie = cookiePair(refreshed.headers['set-cookie']);
  const created = await invoke({
    method: 'POST',
    headers: { cookie: currentCookie, 'x-recruiting-csrf': refreshed.payload.csrf_token, 'idempotency-key': 'synthetic-http-invite-1' },
    body: { action: 'CREATE_INVITATION', recruit_name: 'Synthetic Recruit', recruit_email: 'api.recruit@example.test', purpose: 'Synthetic API proof.' },
  });
  assert.equal(created.status, 200);
  assert.equal(created.payload.invitation.state, 'ISSUED');
  assert.equal(created.payload.delivery.state, 'DELIVERED');
  assert.equal(created.payload.entitlement.remaining, refreshed.payload.entitlement.remaining - 1);

  const replayedProof = await invoke({
    method: 'POST',
    headers: { cookie: cookiePair(created.headers['set-cookie']), 'x-recruiting-csrf': refreshed.payload.csrf_token, 'idempotency-key': 'synthetic-http-invite-1' },
    body: { action: 'CREATE_INVITATION', recruit_name: 'Synthetic Recruit', recruit_email: 'api.recruit@example.test', purpose: 'Synthetic API proof.' },
  });
  assert.equal(replayedProof.status, 403);
  assert.equal(replayedProof.payload.code, 'RECRUITING_CSRF_INVALID');
});

test('HTTP origin check rejects cross-origin mutation before any state operation', async () => {
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();
  const denied = await invoke({ method: 'POST', headers: { origin: 'https://attacker.example.test' }, body: { action: 'REQUEST_MANAGER_VERIFICATION', profile_id: 'mm-20990101-sophia01' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.payload.code, 'RECRUITING_ORIGIN_DENIED');
});

test('production manager cookies are HttpOnly, Secure, SameSite Strict, and host scoped', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();
  try {
    const requested = await invoke({ method: 'POST', body: { action: 'REQUEST_MANAGER_VERIFICATION', profile_id: 'mm-20990101-sophia01' } });
    const verified = await invoke({ method: 'POST', body: { action: 'VERIFY_MANAGER', token: requested.payload.verification_token } });
    const setCookie = String(verified.headers['set-cookie']);
    assert.match(setCookie, /^__Host-more_recruiting_manager=/);
    assert.match(setCookie, /; Path=\/; HttpOnly; Secure; SameSite=Strict;/);
    assert.equal(setCookie.includes('Domain='), false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('Master Control HTTP is admin-scoped and manager setup exchanges the raw token for HttpOnly sessions', async () => {
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();
  const requested = await invoke({ method: 'POST', body: { action: 'REQUEST_MANAGER_VERIFICATION', profile_id: 'mm-20990101-darren01' } });
  const verified = await invoke({ method: 'POST', body: { action: 'VERIFY_MANAGER', token: requested.payload.verification_token } });
  const adminCookie = cookiePair(verified.headers['set-cookie']);
  const roster = await invoke({ query: { view: 'master_control' }, headers: { cookie: adminCookie } });
  assert.equal(roster.status, 200);
  assert.equal(roster.payload.default_view, 'ALL_AUTHORIZED_MEMBERSHIPS');
  assert.equal(roster.payload.total, 5);
  assert.equal(roster.payload.memberships.some((item) => item.entitlement.mode === 'unlimited'), true);

  const created = await invoke({
    method: 'POST',
    headers: { cookie: cookiePair(roster.headers['set-cookie']), 'x-recruiting-csrf': roster.payload.csrf_token },
    body: {
      action: 'ADMIN_CREATE_MANAGER', manager_name: 'HTTP Setup Manager', manager_email: 'http.setup@example.test',
      enterprise_id: 'enterprise_http_setup', enterprise_name: 'HTTP Setup Enterprise',
    },
  });
  assert.equal(created.status, 200);
  assert.ok(created.payload.setup_token);
  assert.equal(created.payload.membership.status, 'PENDING_SETUP');

  const preview = await invoke({ query: { view: 'manager_setup_preview', token: created.payload.setup_token } });
  assert.equal(preview.status, 200);
  assert.equal(preview.payload.preview.enterprise_name, 'HTTP Setup Enterprise');

  const begun = await invoke({ method: 'POST', body: { action: 'BEGIN_MANAGER_SETUP', token: created.payload.setup_token } });
  assert.equal(begun.status, 200);
  const setupCookie = cookiePair(begun.headers['set-cookie']);
  assert.match(setupCookie, /^__Host-more_recruiting_setup=/);
  assert.equal(String(begun.headers['set-cookie']).includes('HttpOnly'), true);

  const completed = await invoke({
    method: 'POST',
    headers: { cookie: setupCookie, 'x-recruiting-setup-csrf': begun.payload.csrf_token },
    body: { action: 'COMPLETE_MANAGER_SETUP', profile_id: 'mm-20990101-httpset1' },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.payload.membership.status, 'ACTIVE');
  assert.equal(String(completed.headers['set-cookie']).includes('__Host-more_recruiting_manager='), true);
  assert.equal(String(completed.headers['set-cookie']).includes('__Host-more_recruiting_setup=;'), true);

  const replay = await invoke({ method: 'POST', body: { action: 'BEGIN_MANAGER_SETUP', token: created.payload.setup_token } });
  assert.equal(replay.status, 422);
  assert.equal(replay.payload.code, 'RECRUITING_MANAGER_SETUP_TOKEN_INVALID');
});

test('accepted HttpOnly invite session exposes a server-derived recruit continuation and rotates without leaking authority', async () => {
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  resetSyntheticRecruitingRuntimeForTest();

  const requested = await invoke({
    method: 'POST',
    body: { action: 'REQUEST_MANAGER_VERIFICATION', profile_id: 'mm-20990101-sophia01' },
  });
  const verified = await invoke({
    method: 'POST',
    body: { action: 'VERIFY_MANAGER', token: requested.payload.verification_token },
  });
  const home = await invoke({
    query: { view: 'home' },
    headers: { cookie: cookiePair(verified.headers['set-cookie']) },
  });
  const created = await invoke({
    method: 'POST',
    headers: {
      cookie: cookiePair(home.headers['set-cookie']),
      'x-recruiting-csrf': home.payload.csrf_token,
      'idempotency-key': 'synthetic-http-continuation-1',
    },
    body: {
      action: 'CREATE_INVITATION',
      recruit_name: 'Continuation Recruit',
      recruit_email: 'continuation.recruit@example.test',
      purpose: 'Synthetic continuation contract proof.',
    },
  });
  const accepted = await invoke({
    method: 'POST',
    body: {
      action: 'ACCEPT_INVITATION',
      token: created.payload.invitation_token,
      consent: { accepted: true, version: 'recruiting_v1_consent_2026_08' },
    },
  });
  const acceptedCookie = cookiePair(accepted.headers['set-cookie']);
  const continuation = await invoke({
    query: { view: 'invite_session' },
    headers: { cookie: acceptedCookie },
  });

  assert.equal(continuation.status, 200);
  assert.equal(continuation.payload.continuation.contract, 'recruiting_invite_continuation_v1');
  assert.equal(continuation.payload.continuation.authority, 'accepted_invite_session');
  assert.equal(continuation.payload.continuation.progress_state, 'INVITED');
  assert.equal(continuation.payload.continuation.next_step.destination, '/profile?recruiting=1');
  assert.equal(continuation.payload.continuation.requires_manual_profile_id, false);
  assert.equal(continuation.payload.continuation.requires_new_manager_invitation, false);
  assert.notEqual(cookiePair(continuation.headers['set-cookie']), acceptedCookie);
  assert.match(String(continuation.headers['set-cookie']), /HttpOnly/u);
  assert.doesNotMatch(JSON.stringify(continuation.payload), /invitation_token|invite_session_token/u);
});

test('existing Profile connection ignores body identity, requires both receipts, and rotates the accepted invite session', async () => {
  process.env.RECRUITING_V1_SYNTHETIC_REVIEW = 'true';
  process.env.MOREMINDMAP_SERVER_ONLY_PROFILE_OWNERSHIP_SIGNING_KEY = 'synthetic-http-profile-owner-signing-key-123456';
  process.env.PUBLIC_PROFILE_OWNERSHIP_ENVIRONMENT = 'test';
  process.env.PUBLIC_SITE_URL = 'http://localhost:4173';
  resetSyntheticRecruitingRuntimeForTest();

  const requested = await invoke({
    method: 'POST',
    body: { action: 'REQUEST_MANAGER_VERIFICATION', profile_id: 'mm-20990101-sophia01' },
  });
  const verified = await invoke({
    method: 'POST',
    body: { action: 'VERIFY_MANAGER', token: requested.payload.verification_token },
  });
  const home = await invoke({
    query: { view: 'home' },
    headers: { cookie: cookiePair(verified.headers['set-cookie']) },
  });
  const created = await invoke({
    method: 'POST',
    headers: {
      cookie: cookiePair(home.headers['set-cookie']),
      'x-recruiting-csrf': home.payload.csrf_token,
      'idempotency-key': 'synthetic-http-existing-profile-1',
    },
    body: {
      action: 'CREATE_INVITATION',
      recruit_name: 'Continuation Recruit',
      recruit_email: 'continuation.recruit@example.test',
      purpose: 'Synthetic existing-Profile continuation proof.',
    },
  });
  const accepted = await invoke({
    method: 'POST',
    body: {
      action: 'ACCEPT_INVITATION',
      token: created.payload.invitation_token,
      consent: { accepted: true, version: 'recruiting_v1_consent_2026_08' },
    },
  });
  const acceptedCookie = cookiePair(accepted.headers['set-cookie']);

  const denied = await invoke({
    method: 'POST',
    headers: { cookie: acceptedCookie },
    body: { action: 'CONNECT_OWNED_PROFILE', profile_id: 'mm-20990101-attacker' },
  });
  assert.equal(denied.status, 401);
  assert.equal(denied.payload.code, 'RECRUITING_PROFILE_OWNER_RECEIPT_REQUIRED');

  const ownerCookie = signedProfileOwnerCookie('mm-20990101-recru001');
  const connected = await invoke({
    method: 'POST',
    headers: { cookie: `${acceptedCookie}; ${ownerCookie}` },
    body: {
      action: 'CONNECT_OWNED_PROFILE',
      profile_id: 'mm-20990101-wrong001',
    },
  });
  assert.equal(connected.status, 200);
  assert.equal(connected.payload.continuation.progress_state, 'BOS_COMPLETE');
  assert.equal(connected.payload.continuation.profile_binding.profile_id, 'mm-20990101-recru001');
  assert.equal(connected.payload.continuation.next_step.destination, '/business-assessment?recruiting=1');
  assert.doesNotMatch(connected.payload.continuation.next_step.destination, /(?:\?|&)id=/u);
  const rotatedCookie = cookiePair(connected.headers['set-cookie']);
  assert.notEqual(rotatedCookie, acceptedCookie);
  assert.match(String(connected.headers['set-cookie']), /HttpOnly/u);
  assert.doesNotMatch(JSON.stringify(connected.payload), /invite_session_token|invitation_token/u);

  const replayedOldSession = await invoke({
    method: 'POST',
    headers: { cookie: `${acceptedCookie}; ${ownerCookie}` },
    body: { action: 'CONNECT_OWNED_PROFILE' },
  });
  assert.equal(replayedOldSession.status, 401);
  assert.equal(replayedOldSession.payload.code, 'RECRUITING_INVITE_SESSION_REQUIRED');
});
