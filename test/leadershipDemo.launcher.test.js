import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  LEADERSHIP_DEMO_AUTHORITY,
  athleteConsultingDarrenDemoEnabled,
  authenticateAthleteConsultingDemoRequest,
  authenticateLeadershipLauncher,
  authenticateRecruitingDemoRequest,
  consumeLeadershipEntryCsrf,
  consumeLeadershipLauncherCsrf,
  exactLeadershipDemoCode,
  issueLeadershipEntryCsrf,
  issueLeadershipLauncherCapability,
  issueLeadershipLauncherCsrf,
  issueAthleteConsultingDemoCapability,
  issueRecruitingDemoCapability,
  issueRecruitingDemoCsrf,
  consumeRecruitingDemoCsrf,
  issueRecruitingDemoCapabilityForManager,
  sameOriginLeadershipDemoRequest,
} from '../api/engine/leadershipDemo/authority.js';
import { issueInternalDevCapability } from '../api/engine/subscriptionV1/internalDevInfrastructure.js';

class FakeRedis {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async getdel(key) { const value = this.values.get(key) ?? null; this.values.delete(key); return value; }
  async set(key, value, ...args) {
    if (args.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, String(value));
    return 'OK';
  }
  async incr(key) { const value = Number(this.values.get(key) || 0) + 1; this.values.set(key, String(value)); return value; }
  async expire() { return 1; }
}

function request({ cookie = '', origin = 'https://moremindmap.com', agent = 'Leadership demo test browser', address = '203.0.113.21', method = 'POST' } = {}) {
  return {
    method,
    headers: {
      host: 'moremindmap.com',
      origin,
      'x-forwarded-proto': 'https',
      'x-forwarded-for': address,
      'user-agent': agent,
      cookie,
    },
    socket: {},
  };
}

function cookiePair(setCookie) {
  return String(setCookie).split(';')[0];
}

test('launcher entry is exact, same-origin, rate-limit ready, and protected by one-time CSRF', async () => {
  const redis = new FakeRedis();
  const req = request();
  const proof = await issueLeadershipEntryCsrf({ redis, req });
  assert.equal(await consumeLeadershipEntryCsrf({ redis, req, proof }), true);
  assert.equal(await consumeLeadershipEntryCsrf({ redis, req, proof }), false);
  assert.equal(exactLeadershipDemoCode('test-leadership-code', { LEADERSHIP_DEMO_ACCESS_CODE: 'test-leadership-code' }), true);
  assert.equal(exactLeadershipDemoCode('darrendemo', {}), false);
  assert.equal(exactLeadershipDemoCode('DarrenDemo', {}), false);
  assert.equal(sameOriginLeadershipDemoRequest(req), true);
  assert.equal(sameOriginLeadershipDemoRequest(request({ origin: 'https://evil.example' })), false);
  assert.equal(LEADERSHIP_DEMO_AUTHORITY.launcher_authenticates_real_products, false);
});

test('one valid launcher capability can return from a product and consume a fresh CSRF without reauthentication', async () => {
  const redis = new FakeRedis();
  const req = request();
  const capability = await issueLeadershipLauncherCapability({ redis, req });
  const cookie = cookiePair(capability.cookie);
  const returnedRequest = request({ cookie });
  const authenticated = await authenticateLeadershipLauncher({ redis, req: returnedRequest });
  assert.equal(authenticated.ok, true);

  const first = await issueLeadershipLauncherCsrf({ redis, capabilityHash: authenticated.capability_hash });
  assert.equal(await consumeLeadershipLauncherCsrf({ redis, capabilityHash: authenticated.capability_hash, proof: first }), true);

  const second = await issueLeadershipLauncherCsrf({ redis, capabilityHash: authenticated.capability_hash });
  assert.notEqual(second, first);
  assert.equal(await consumeLeadershipLauncherCsrf({ redis, capabilityHash: authenticated.capability_hash, proof: second }), true);
  assert.equal((await authenticateLeadershipLauncher({ redis, req: returnedRequest })).ok, true);
});

test('opaque launcher is browser-bound, expiring, and exchanges through one-time launch CSRF', async () => {
  const redis = new FakeRedis();
  const now = new Date('2026-08-26T16:00:00.000Z');
  const base = request();
  const issued = await issueLeadershipLauncherCapability({ redis, req: base, now });
  assert.match(issued.cookie, /^__Host-more_leadership_demo=/u);
  assert.match(issued.cookie, /Path=\/; HttpOnly; Secure; SameSite=Strict/u);
  assert.doesNotMatch(issued.cookie, /Domain=/u);
  assert.doesNotMatch(issued.cookie, /darrendemo/u);

  const authorized = request({ cookie: cookiePair(issued.cookie) });
  const auth = await authenticateLeadershipLauncher({ redis, req: authorized, now: new Date('2026-08-26T16:10:00.000Z') });
  assert.equal(auth.ok, true);
  const csrf = await issueLeadershipLauncherCsrf({ redis, capabilityHash: auth.capability_hash });
  assert.equal(await consumeLeadershipLauncherCsrf({ redis, capabilityHash: auth.capability_hash, proof: csrf }), true);
  assert.equal(await consumeLeadershipLauncherCsrf({ redis, capabilityHash: auth.capability_hash, proof: csrf }), false);
  assert.equal((await authenticateLeadershipLauncher({ redis, req: request({ cookie: cookiePair(issued.cookie), agent: 'Other browser' }), now })).ok, false);
  assert.equal((await authenticateLeadershipLauncher({ redis, req: authorized, now: new Date('2026-08-26T16:31:00.000Z') })).ok, false);
});

test('Recruiting receives only a narrower synthetic capability and the launcher cookie is not accepted by Recruiting', async () => {
  const redis = new FakeRedis();
  const req = request();
  const launcher = await issueLeadershipLauncherCapability({ redis, req });
  const launcherReq = request({ cookie: cookiePair(launcher.cookie) });
  const launcherAuth = await authenticateLeadershipLauncher({ redis, req: launcherReq });
  const recruiting = await issueRecruitingDemoCapability({ redis, req: launcherReq, launcher: launcherAuth.capability });
  assert.match(recruiting.cookie, /^__Host-more_recruiting_demo=/u);
  assert.match(recruiting.cookie, /Path=\/; HttpOnly; Secure; SameSite=Strict/u);
  assert.doesNotMatch(recruiting.cookie, /Domain=/u);
  assert.equal((await authenticateRecruitingDemoRequest({ redis, req: launcherReq })).ok, false);
  const recruitingAuth = await authenticateRecruitingDemoRequest({ redis, req: request({ cookie: cookiePair(recruiting.cookie) }) });
  assert.equal(recruitingAuth.ok, true);
  assert.equal(recruitingAuth.capability.allowed_product, 'recruiting');
  assert.equal(recruitingAuth.capability.synthetic_only, true);
  assert.equal(recruitingAuth.capability.subject_key, 'recruiting-darren-jordan-v1');
});

test('Recruiting demo CSRF survives serverless instance rotation and remains single use', async () => {
  const redis = new FakeRedis();
  const capabilityHash = 'a'.repeat(64);
  const proof = await issueRecruitingDemoCsrf({ redis, capabilityHash });

  assert.equal(LEADERSHIP_DEMO_AUTHORITY.recruiting_demo_csrf_ttl_seconds, 300);
  assert.equal(await consumeRecruitingDemoCsrf({ redis, capabilityHash, proof: '' }), false);
  assert.equal(await consumeRecruitingDemoCsrf({ redis, capabilityHash, proof: 'short' }), false);
  assert.equal(await consumeRecruitingDemoCsrf({ redis, capabilityHash: 'b'.repeat(64), proof }), false);
  assert.equal(await consumeRecruitingDemoCsrf({ redis, capabilityHash, proof }), true);
  assert.equal(await consumeRecruitingDemoCsrf({ redis, capabilityHash, proof }), false);
});

test('authenticated Darren admin can mint only the same isolated synthetic Recruiting capability', async () => {
  const redis = new FakeRedis();
  const req = request();
  await assert.rejects(() => issueRecruitingDemoCapabilityForManager({
    redis, req, managerSubjectId: 'manager-standard', membershipId: 'membership-standard', masterControl: false,
  }), /RECRUITING_DEMO_MANAGER_AUTHORITY_DENIED/u);

  const issued = await issueRecruitingDemoCapabilityForManager({
    redis, req, managerSubjectId: 'manager-darren', membershipId: 'membership-darren', masterControl: true,
  });
  const auth = await authenticateRecruitingDemoRequest({ redis, req: request({ cookie: cookiePair(issued.cookie) }) });
  assert.equal(auth.ok, true);
  assert.equal(auth.capability.synthetic_only, true);
  assert.equal(auth.capability.allowed_product, 'recruiting');
  assert.equal(auth.capability.subject_key, 'recruiting-darren-jordan-v1');
  assert.match(auth.capability.demo_scope_id, /^recruiting_manager_[a-f0-9]{24}$/u);
});

test('Subscription launcher exchange reuses the existing re-mid synthetic capability and relationship cookies', async () => {
  const redis = new FakeRedis();
  const issued = await issueInternalDevCapability({ redis, req: request(), launcher: {
    contract: 'leadership_demo_launcher_capability_v1',
    launcher_scope_id: 'leadership_demo_aaaaaaaaaaaaaaaaaaaaaaaa',
    allowed_products: ['recruiting', 'subscription'],
    synthetic_only: true,
  } });
  assert.equal(issued.capability.subject_key, 're-mid');
  assert.equal(issued.capability.demo_subject_switching, false);
  assert.equal(issued.capability.demo_reset_enabled, true);
  assert.deepEqual(issued.capability.allowed_demo_subjects, ['synthetic']);
  assert.equal(issued.capability.synthetic_only, true);
  assert.equal(issued.capability.billing_evidence, false);
  assert.equal(issued.capability.stripe_subscription_created, false);
  assert.equal(issued.capability.blind_demo_launch_selection, undefined);
  assert.equal(issued.cookies.some((value) => value.startsWith('__Host-more_subscription_internal=')), true);
  assert.equal(issued.cookies.some((value) => value.startsWith('__Host-more_subscription_relationship=')), true);
});

test('Athlete Consulting is default-off and becomes an exact fourth, separately scoped launcher capability only under the composite gate', async () => {
  const redis = new FakeRedis();
  const req = request();
  const baseEnv = {
    RECRUITING_DARREN_SYNTHETIC_DEMO_ENABLED: 'true',
    SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'true',
  };
  assert.equal(athleteConsultingDarrenDemoEnabled(baseEnv), false);
  const base = await issueLeadershipLauncherCapability({ redis, req, env: baseEnv });
  assert.deepEqual(base.capability.allowed_products, ['recruiting', 'subscription']);
  await assert.rejects(() => issueAthleteConsultingDemoCapability({ redis, req, launcher: base.capability, env: baseEnv }), /SCOPE_DENIED/u);

  const enabledEnv = { ...baseEnv, ATHLETE_CONSULTING_DARREN_DEMO_ENABLED: 'true' };
  const expanded = await issueLeadershipLauncherCapability({ redis, req, env: enabledEnv });
  assert.deepEqual(expanded.capability.allowed_products, ['recruiting', 'subscription', 'athlete-consulting-tool']);
  const athlete = await issueAthleteConsultingDemoCapability({ redis, req, launcher: expanded.capability, env: enabledEnv });
  assert.match(athlete.cookie, /^__Host-more_athlete_consult_demo=/u);
  assert.deepEqual(athlete.capability.allowed_subjects, ['mika', 'avery']);
  assert.equal(athlete.capability.allowed_product, 'athlete-consulting-tool');
  const athleteReq = request({ cookie: cookiePair(athlete.cookie) });
  assert.equal((await authenticateAthleteConsultingDemoRequest({ redis, req: athleteReq, env: enabledEnv })).ok, true);
  assert.equal((await authenticateAthleteConsultingDemoRequest({ redis, req: athleteReq, env: { ...enabledEnv, SUBSCRIPTION_V1_INTERNAL_DEV_ENABLED: 'false' } })).status, 404);
});

test('Leadership launcher keeps one Box 04 with distinct V2 choices and preserves Box 05', () => {
  const launcher = fs.readFileSync(new URL('../src/LeadershipDemo.jsx', import.meta.url), 'utf8');
  const portal = fs.readFileSync(new URL('../src/LeadershipPortal.jsx', import.meta.url), 'utf8');
  const launcherApi = fs.readFileSync(new URL('../api/internal/leadership-demo-entry.js', import.meta.url), 'utf8');
  const recruitingApi = fs.readFileSync(new URL('../api/recruiting/gu-v1-demo.js', import.meta.url), 'utf8');
  const recruitingApp = fs.readFileSync(new URL('../src/recruitingV1/RecruitingV1App.jsx', import.meta.url), 'utf8');
  const consultingDemoApp = fs.readFileSync(new URL('../src/recruitingGuV1/RecruitingGuV1App.jsx', import.meta.url), 'utf8');
  const consultingDemoClient = fs.readFileSync(new URL('../src/lib/recruitingGuV1/client.js', import.meta.url), 'utf8');
  assert.equal((launcher.match(/title: 'CONSULTING DEMONSTRATION'/gu) || []).length, 1);
  assert.equal((launcher.match(/title: 'SUBSCRIPTION MODEL 1'/gu) || []).length, 1);
  assert.equal((launcher.match(/title: 'SUBSCRIPTION MODEL 2'/gu) || []).length, 1);
  assert.equal((launcher.match(/title: 'ATHLETE CONSULTING TOOL'/gu) || []).length, 1);
  assert.equal((launcher.match(/title: 'ATHLETE COACH CONNECT'/gu) || []).length, 1);
  assert.equal((launcher.match(/number: '04'/gu) || []).length, 1);
  assert.equal((launcher.match(/number: '05'/gu) || []).length, 1);
  assert.match(launcher, /product\.id !== 'athlete-coach-connect'/u);
  assert.match(launcher, /<article key=\{product\.id\}[\s\S]*?>04<\/span>/u);
  assert.match(launcher, /\[product, coachConnect\]\.map\(\(choice\) => \(/u);
  assert.match(launcher, /onClick=\{\(\) => launch\(choice\)\}/u);
  assert.match(launcher, /choice\.title/u);
  assert.equal((launcher.match(/action: 'LAUNCH_/gu) || []).length, 5);
  assert.equal((launcher.match(/action: 'OPEN_DARREN_LIBRARY'/gu) || []).length, 1);
  assert.match(launcher, /ATHLETE_V2_PRODUCT_IDS = \[\.\.\.ATHLETE_PRODUCT_IDS, 'athlete-coach-connect'\]/u);
  assert.match(launcher, /ATHLETE_V2_LIBRARY_PRODUCT_IDS = \[\.\.\.ATHLETE_V2_PRODUCT_IDS, 'presentations-athlete-reports'\]/u);
  assert.match(launcher, /\(exactAthleteV2 \|\| exactAthleteV2Library\) && coachChoice\?\.version === 2/u);
  assert.match(launcher, /HOME → YOU → YOUR BUSINESS → PLAN/u);
  assert.match(launcher, /'\/athlete-consulting-tool\/demo\?capture=1&role=coach'/u);
  assert.match(launcherApi, /redirect_to: '\/recruiting-gu-v1\/demo'/u);
  assert.match(launcherApi, /title: 'CONSULTING DEMONSTRATION'/u);
  assert.match(launcherApi, /LAUNCH_SUBSCRIPTION_MODEL_1/u);
  assert.match(launcherApi, /LAUNCH_SUBSCRIPTION_MODEL_2/u);
  assert.match(launcherApi, /LAUNCH_ATHLETE_CONSULTING_TOOL/u);
  assert.match(launcherApi, /LAUNCH_ATHLETE_COACH_CONNECT/u);
  assert.match(launcherApi, /id: 'athlete-coach-connect', title: 'ATHLETE COACH CONNECT', version: 2/u);
  assert.match(launcherApi, /OPEN_DARREN_LIBRARY/u);
  assert.doesNotMatch(launcherApi, /action === 'LAUNCH_SUBSCRIPTION'/u);
  assert.doesNotMatch(launcher, /OpenAI|GPT|Grok|xAI|provider logo|pricing/u);
  assert.match(launcherApi, /action === 'LAUNCH_SUBSCRIPTION_MODEL_1' \? '1'/u);
  assert.match(launcherApi, /action === 'LAUNCH_SUBSCRIPTION_MODEL_2' \? '2'/u);
  assert.doesNotMatch(launcherApi, /req\.body\??\.\s*(?:model|selection|provider|blindDemoSelection)/u);
  assert.doesNotMatch(launcherApi, /title: 'Recruiting GU V1'/u);
  assert.doesNotMatch(launcherApi, /redirect_to: '\/recruiting\/demo'/u);
  assert.doesNotMatch(launcher, /Craig Fox|Executive \/ Board|Company Alignment|leadershipDemoSlides|slide-\d+/u);
  assert.doesNotMatch(launcher, /Recruiting GU V1|Candidate intelligence/u);
  assert.match(consultingDemoApp, /<small>Consulting Demonstration<\/small>/u);
  assert.match(consultingDemoApp, /DEMONSTRATION SUBJECT/u);
  assert.match(consultingDemoApp, /data-demo-only-control="true"/u);
  assert.match(consultingDemoApp, />Reset Demo<\/button>/u);
  assert.match(consultingDemoApp, /resetGuDemoSubject\(subject\)/u);
  assert.match(consultingDemoClient, /RESET_SYNTHETIC_DEMO/u);
  assert.match(consultingDemoApp, /new-ba-production-experience/u);
  assert.match(launcher, /addEventListener\('pageshow'/u);
  assert.match(consultingDemoApp, /YOU is BOS-only; YOUR BUSINESS is BOS \+ BA \/ Business Twin/u);
  assert.match(consultingDemoApp, /real \? <small>Consulting Tool<\/small> : <small>Consulting Demonstration<\/small>/u);
  assert.doesNotMatch(consultingDemoApp, /Recruiting GU V1|RECRUITING \/ BUSINESS CONSULTATION|through Recruiting|READY INVITEES/u);
  assert.doesNotMatch(portal, /darrendemo|leadershipDemoAccess/u);
  assert.match(portal, /x-leadership-demo-entry-csrf/u);
  assert.doesNotMatch(recruitingApi, /more_recruiting_manager|MANAGER_COOKIE/u);
  assert.match(recruitingApp, /location\.pathname === '\/recruiting\/demo'.+RECRUITING_GU_V1_ENABLED.+\/recruiting-gu-v1\/demo/u);
  assert.doesNotMatch(recruitingApp, /RecruitingDemoExperience|DarrenSyntheticDemoSurface|six-destination manager journey/u);
});
