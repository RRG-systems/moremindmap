import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyRecruitingState, InMemoryRecruitingStore } from '../src/lib/recruitingV1/store.js';
import { RecruitingV1Service, createSyntheticNotificationTransport } from '../src/lib/recruitingV1/service.js';
import { consultingReadinessFor, publicInvitation } from '../src/lib/recruitingV1/contracts.js';
import { RedisRecruitingStore } from '../api/engine/recruitingV1/redisStore.js';
import { createRecruitingHttpHandler } from '../api/engine/recruitingV1/http.js';

const NOW = new Date('2026-09-09T18:00:00.000Z');
const MANAGER = Object.freeze({
  membership_id: 'membership_two_box', manager_subject_id: 'manager_two_box', enterprise_id: 'enterprise_two_box',
  manager_profile_id: 'mm-20990101-manager1', manager_name: 'Synthetic Manager', manager_email: 'manager@example.test',
  enterprise_name: 'Synthetic Company', status: 'ACTIVE', setup_state: 'COMPLETE', entitlement_mode: '5_per_month',
});
const PROFILE = 'mm-20990101-person01';
const ASSESSMENT = 'ba-two-box-person';
const consent = Object.freeze({ accepted: true, version: 'recruiting_v1_consent_2026_08' });
const receipt = Object.freeze({
  contract: 'recruiting_canonical_new_ba_ready_receipt_v1', profile_id: PROFILE, assessment_id: ASSESSMENT,
  realization_id: 'new-ba:synthetic-current', realization_sha256: 'a'.repeat(64), artifact_sha256: 'b'.repeat(64),
  completeness: 'PASS', customer_projection_completeness: 'COMPLETE', retrieval_path: 'synthetic-current',
});
const currentReceipt = () => ({ ready: true, ...receipt });

function harness({ membership = MANAGER, store = null, reader = currentReceipt } = {}) {
  const source = store || new InMemoryRecruitingStore(createEmptyRecruitingState([membership]));
  const service = new RecruitingV1Service({
    store: source, now: () => NOW, transport: createSyntheticNotificationTransport(), canonicalReadinessReader: reader,
  });
  return { store: source, service };
}
async function authenticate(service, profileId = MANAGER.manager_profile_id) {
  const challenge = await service.requestManagerVerification(profileId);
  return (await service.verifyManager(challenge.verification_token)).session_token;
}
const input = (index) => ({ recruit_name: `Synthetic Person ${index}`, recruit_email: `person.${index}@example.test` });
async function acceptedReady(service, token, index = 1) {
  const created = await service.createInvitation(token, input(index), `new-${index}`);
  await service.acceptInvitation(created.invitation_token, consent);
  await service.bindBosProfile(created.invitation.invitation_id, PROFILE, { verified: true });
  await service.projectBaState(created.invitation.invitation_id, { assessment_id: ASSESSMENT, state: 'BA_INTELLIGENCE_READY', canonical_receipt: receipt });
  return created;
}

test('one combined invitation consumes one allowance, retains both products, and exposes authoritative UTC period', async () => {
  const membership = { ...MANAGER, entitlement_period: { period_start: '2026-09-05T00:00:00.000Z', period_end: '2026-10-05T00:00:00.000Z' } };
  const { service, store } = harness({ membership });
  const token = await authenticate(service);
  const created = await service.createInvitation(token, input(1), 'combined-one');
  assert.equal(created.invitation_allowance.used, 1);
  assert.equal(created.invitation_allowance.remaining, 4);
  assert.deepEqual(created.invitation_allowance.products, ['BOS', 'BA']);
  assert.equal(created.invitation_allowance.period_end, '2026-10-05T00:00:00.000Z');
  assert.equal(created.entitlements.bos.used, 1);
  assert.equal(created.entitlements.ba.used, 1);
  await service.acceptInvitation(created.invitation_token, consent);
  assert.equal((await service.home(token)).invitation_allowance.used, 1);
  assert.equal((await service.home(token)).invitation_allowance.reserved, 0);
  assert.equal((await service.home(token)).invitation_allowance.consumed, 1);
  // Retain safe accounting when an older record has unequal product balances.
  await store.transaction((state) => {
    state.invitations.legacy = { ...state.invitations[created.invitation.invitation_id], invitation_id: 'legacy', candidate_id: 'legacy', bos_entitlement_state: 'RELEASED', ba_entitlement_state: 'RESERVED' };
    return true;
  });
  const home = await service.home(token);
  assert.equal(home.invitation_allowance.remaining, Math.min(home.entitlements.bos.remaining, home.entitlements.ba.remaining));
  assert.equal(home.invitation_allowance.remaining, 3);
});

test('concurrent duplicate submissions return one person, one reservation and one invitation outbox', async () => {
  const { service, store } = harness();
  const token = await authenticate(service);
  const results = await Promise.all(Array.from({ length: 12 }, (_, index) => service.createInvitation(token, {
    recruit_name: 'Same Synthetic Person', recruit_email: index % 2 ? ' DUPLICATE@EXAMPLE.TEST ' : 'duplicate@example.test',
  }, `independent-click-${index}`)));
  assert.equal(new Set(results.map((item) => item.invitation.invitation_id)).size, 1);
  assert.equal(results.filter((item) => item.idempotent === false).length, 1);
  const snapshot = await store.read();
  assert.equal(Object.keys(snapshot.invitations).length, 1);
  assert.equal(Object.values(snapshot.outbox).filter((item) => item.kind === 'RECRUIT_INVITATION').length, 1);
  assert.equal((await service.home(token)).invitation_allowance.used, 1);
  await assert.rejects(service.createInvitation(token, input('other'), 'independent-click-0'), /IDEMPOTENCY_IDENTITY_MISMATCH/u);
});

test('completed, failed and revoked people remain in invitation list and create never silently resends or debits them', async () => {
  const { service, store } = harness();
  const token = await authenticate(service);
  const ready = await acceptedReady(service, token);
  const failed = await service.createInvitation(token, input(2), 'failed');
  await service.recordDelivery(failed.outbox_id, { success: false });
  const revoked = await service.createInvitation(token, input(3), 'revoked');
  await service.revokeInvitation(token, revoked.invitation.invitation_id);
  const before = await store.read();
  for (const index of [1, 2, 3]) {
    const duplicate = await service.createInvitation(token, input(index), `retry-create-${index}`);
    assert.equal(duplicate.idempotent, true);
    assert.equal(duplicate.outbox_id, undefined);
    assert.equal(duplicate.invitation_token, undefined);
  }
  const after = await store.read();
  assert.deepEqual(after.invitations, before.invitations);
  assert.deepEqual(after.outbox, before.outbox);
  const home = await service.home(token);
  assert.equal(home.candidates.length, 3);
  assert.equal(home.candidates.filter((item) => item.consulting_ready).length, 1);
  assert.equal(home.candidates.find((item) => item.consulting_ready).invitation_id, ready.invitation.invitation_id);
  assert.equal(home.candidates.find((item) => item.invitation_id === failed.invitation.invitation_id).progress_label, 'Delivery failed');
  assert.equal(home.candidates.find((item) => item.invitation_id === revoked.invitation.invitation_id).progress_label, 'Revoked');
});

class MemoryRedis {
  constructor() { this.values = new Map(); }
  async get(key) { return this.values.get(key) ?? null; }
  async set(key, value, ...options) {
    if (options.includes('NX') && this.values.has(key)) return null;
    this.values.set(key, value); return 'OK';
  }
  async eval(script, count, ...args) {
    const keys = args.slice(0, count); const values = args.slice(count);
    if (this.values.get(keys[0]) !== values[0]) return 0;
    if (script.includes("redis.call('DEL'")) this.values.delete(keys[0]);
    else this.values.set(keys[1], values[1]);
    return 1;
  }
}

test('independent Redis-backed service instances cannot race past the five combined invitation limit', async () => {
  const redis = new MemoryRedis();
  const stores = [0, 1].map(() => new RedisRecruitingStore(redis, { namespace: 'nonprod:recruiting-v1:two-box-race' }));
  await stores[0].transaction((state) => { Object.assign(state, createEmptyRecruitingState([MANAGER])); return true; });
  const services = stores.map((store) => harness({ store }).service);
  const token = await authenticate(services[0]);
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => services[index % 2].createInvitation(token, input(index), `race-${index}`)));
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 5);
  assert.equal(results.filter((item) => item.status === 'rejected' && /ALLOWANCE_EXHAUSTED/u.test(item.reason.message)).length, 3);
  assert.equal((await services[0].home(token)).invitation_allowance.remaining, 0);
  assert.equal(Object.keys((await stores[1].read()).invitations).length, 5);
  const duplicate = await services[1].createInvitation(token, input(0), 'race-duplicate');
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.invitation_allowance.used, 5);
});

test('disjoint migrated product reservations still cap five distinct combined invitations and retain release/reset policy', async () => {
  const { service, store } = harness();
  let token = await authenticate(service);
  const created = [];
  for (let index = 0; index < 5; index += 1) created.push(await service.createInvitation(token, input(index), `split-${index}`));
  await store.transaction((state) => {
    created.forEach((item, index) => {
      const invitation = state.invitations[item.invitation.invitation_id];
      invitation.bos_entitlement_state = index < 2 ? 'RELEASED' : 'RESERVED';
      invitation.ba_entitlement_state = index < 2 ? 'RESERVED' : 'RELEASED';
    });
    return true;
  });
  let home = await service.home(token);
  assert.equal(home.entitlements.bos.used, 3);
  assert.equal(home.entitlements.ba.used, 2);
  assert.equal(home.invitation_allowance.used, 5);
  assert.equal(home.invitation_allowance.remaining, 0);
  await assert.rejects(service.createInvitation(token, input(6), 'sixth-split'), /ALLOWANCE_EXHAUSTED/u);
  const duplicate = await service.createInvitation(token, input(0), 'duplicate-split-at-zero');
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.invitation_allowance.used, 5);
  await service.recordDelivery(created[0].outbox_id, { success: false });
  home = await service.home(token);
  assert.equal(home.invitation_allowance.used, 4);
  assert.equal(home.invitation_allowance.remaining, 1);
  const resent = await service.resendInvitation(token, created[0].invitation.invitation_id, { expectedResendCount: 0 });
  assert.equal(resent.invitation_allowance.used, 5);
  assert.equal(resent.invitation_allowance.remaining, 0);
  await service.acceptInvitation(resent.invitation_token, consent);
  service.now = () => new Date('2026-10-02T00:01:00.000Z');
  token = await authenticate(service);
  home = await service.home(token);
  assert.equal(home.invitation_allowance.period_start, '2026-10-01T00:00:00.000Z');
  assert.equal(home.invitation_allowance.period_end, '2026-11-01T00:00:00.000Z');
  assert.equal(home.invitation_allowance.remaining, 5);
  assert.equal(home.candidates.some((item) => item.invitation_id === created[0].invitation.invitation_id && item.state === 'ACCEPTED'), true);
});

test('explicit failed-delivery resend uses one compare-and-set revision across racing clicks', async () => {
  const { service, store } = harness();
  const token = await authenticate(service);
  const created = await service.createInvitation(token, input(1), 'resend-cas-original');
  await service.recordDelivery(created.outbox_id, { success: false });
  const results = await Promise.all(Array.from({ length: 8 }, (_, index) => service.resendInvitation(token, created.invitation.invitation_id, { expectedResendCount: 0, idempotencyKey: `resend-click-${index}` })));
  assert.equal(results.filter((item) => item.outbox_id).length, 1);
  assert.equal(results.filter((item) => item.resend_superseded).length, 7);
  const snapshot = await store.read();
  const invitation = snapshot.invitations[created.invitation.invitation_id];
  assert.equal(invitation.resend_count, 1);
  assert.equal(invitation.token_generation, 2);
  assert.equal(Object.values(snapshot.outbox).filter((item) => item.kind === 'RECRUIT_INVITATION').length, 2);
  assert.equal((await service.home(token)).invitation_allowance.used, 1);
});

test('prior-month partially reserved invitation cannot enter a full current-month combined union', async () => {
  for (const retainedProduct of ['bos', 'ba']) {
    const { service, store } = harness();
    const token = await authenticate(service);
    const created = [];
    for (let index = 0; index < 5; index += 1) created.push(await service.createInvitation(token, input(index), `current-${index}`));
    await store.transaction((state) => {
      created.forEach((item, index) => {
        const invitation = state.invitations[item.invitation.invitation_id];
        invitation.bos_entitlement_state = index < 3 ? 'RESERVED' : 'RELEASED';
        invitation.ba_entitlement_state = index < 3 ? 'RELEASED' : 'RESERVED';
      });
      state.invitations.prior_month_partial = {
        ...state.invitations[created[0].invitation.invitation_id],
        invitation_id: 'prior_month_partial', candidate_id: 'prior_month_partial_person', recruit_email: 'prior-month@example.test',
        entitlement_period_start: '2026-08-01T00:00:00.000Z', entitlement_period_end: '2026-09-01T00:00:00.000Z',
        bos_entitlement_state: retainedProduct === 'bos' ? 'RESERVED' : 'RELEASED',
        ba_entitlement_state: retainedProduct === 'ba' ? 'RESERVED' : 'RELEASED',
      };
      return true;
    });
    const before = await store.read();
    const home = await service.home(token);
    assert.equal(home.entitlements.bos.remaining, 2);
    assert.equal(home.entitlements.ba.remaining, 3);
    assert.equal(home.invitation_allowance.remaining, 0);
    await assert.rejects(service.resendInvitation(token, 'prior_month_partial', { expectedResendCount: 0 }), /ALLOWANCE_EXHAUSTED/u);
    const denied = await store.read();
    assert.deepEqual(denied.invitations.prior_month_partial, before.invitations.prior_month_partial);
    assert.deepEqual(denied.outbox, before.outbox);
    assert.equal((await service.home(token)).invitation_allowance.used, 5);
    // Completing a partial reservation already in this month's union remains
    // permitted when that product has capacity: it adds no sixth person.
    const samePeriod = await service.resendInvitation(token, created[0].invitation.invitation_id, { expectedResendCount: 0 });
    assert.equal(samePeriod.invitation_allowance.used, 5);
    assert.equal(samePeriod.invitation_allowance.remaining, 0);
  }
});

test('Darren unlimited remains server-owned and does not change a regular manager cap', async () => {
  const { service } = harness({ membership: { ...MANAGER, entitlement_mode: 'unlimited', admin_roles: ['RECRUITING_ADMIN'], recruiting_governance: { all_enterprises: true } } });
  const token = await authenticate(service);
  for (let index = 0; index < 9; index += 1) await service.createInvitation(token, { ...input(index), entitlement_mode: '5_per_month' }, `unlimited-${index}`);
  const home = await service.home(token);
  assert.equal(home.invitation_allowance.mode, 'unlimited');
  assert.equal(home.invitation_allowance.limit, null);
  assert.equal(home.invitation_allowance.remaining, null);
  assert.equal(home.invitation_allowance.used, 9);
  const standard = harness();
  const regularToken = await authenticate(standard.service);
  const regular = await standard.service.createInvitation(regularToken, { ...input(1), entitlement_mode: 'unlimited' }, 'cannot-elevate');
  assert.equal(regular.invitation_allowance.mode, '5_per_month');
});

test('ready requires both complete current canonical results, exact profile, consent and manager relationship', async () => {
  let current = currentReceipt();
  const { service, store } = harness({ reader: async () => current });
  const token = await authenticate(service);
  const created = await service.createInvitation(token, input(1), 'strict-readiness');
  const id = created.invitation.invitation_id;
  await service.acceptInvitation(created.invitation_token, consent);
  assert.equal((await service.home(token)).candidates[0].consulting_ready, false);
  await service.bindBosProfile(id, PROFILE, { verified: true });
  assert.equal((await service.home(token)).candidates[0].progress_label, 'Taking BA');
  await service.projectBaState(id, { assessment_id: ASSESSMENT, state: 'BA_IN_PROGRESS' });
  assert.equal((await service.home(token)).candidates[0].consulting_ready, false);
  await assert.rejects(service.projectBaState(id, { assessment_id: ASSESSMENT, state: 'BA_INTELLIGENCE_READY', canonical_receipt: { ...receipt, profile_id: 'mm-20990101-other001' } }), /CANONICAL_BA_PROFILE_MISMATCH/u);
  await assert.rejects(service.projectBaState(id, { assessment_id: ASSESSMENT, state: 'BA_INTELLIGENCE_READY', canonical_receipt: { ...receipt, artifact_sha256: 'invalid' } }), /CANONICAL_BA_RECEIPT_REQUIRED/u);
  await service.projectBaState(id, { assessment_id: ASSESSMENT, state: 'BA_INTELLIGENCE_READY', canonical_receipt: receipt });
  const candidate = await service.candidateContext(token, created.invitation.candidate_id);
  assert.equal(candidate.invitation.consulting_ready, true);
  assert.deepEqual(candidate.canonical_readiness.ba_realization_receipt, receipt);
  const snapshot = await store.read();
  const invitation = snapshot.invitations[id];
  for (const altered of [
    { ...invitation, state: 'REVOKED' }, { ...invitation, consent: null },
    { ...invitation, manager_subject_id: 'wrong' }, { ...invitation, enterprise_id: 'wrong' },
    { ...invitation, ba_realization_receipt: { ...receipt, profile_id: 'mm-20990101-other001' } },
  ]) assert.equal(consultingReadinessFor(altered, snapshot.memberships[MANAGER.membership_id]).ready, false);
  assert.equal(publicInvitation({ ...invitation, consent: null }).progress_label, 'Results need verification');
  for (const field of ['profile_id', 'assessment_id', 'realization_id', 'realization_sha256', 'artifact_sha256']) {
    current = { ...currentReceipt(), [field]: 'mismatch' };
    assert.equal((await service.home(token)).candidates[0].consulting_ready, false, field);
  }
  service.canonicalReadinessReader = async () => { throw new Error('synthetic unavailable'); };
  assert.equal((await service.home(token)).candidates[0].consulting_blocker, 'RECRUITING_CONSULTING_CANONICAL_VERIFICATION_UNAVAILABLE');
});

test('manager isolation and revocation during canonical verification cannot expose a ready row', async () => {
  const { service, store } = harness();
  const token = await authenticate(service);
  const created = await acceptedReady(service, token);
  await store.transaction((state) => {
    state.memberships.other = { ...state.memberships[MANAGER.membership_id], membership_id: 'other', manager_subject_id: 'other-manager', manager_profile_id: 'mm-20990101-other001' };
    return true;
  });
  const otherToken = await authenticate(service, 'mm-20990101-other001');
  assert.equal((await service.home(otherToken)).candidates.length, 0);
  await assert.rejects(service.candidateContext(otherToken, created.invitation.candidate_id), /CANDIDATE_SCOPE_DENIED/u);
  service.canonicalReadinessReader = async () => {
    await store.transaction((state) => { state.invitations[created.invitation.invitation_id].state = 'REVOKED'; return true; });
    return currentReceipt();
  };
  const home = await service.home(token);
  assert.equal(home.candidates[0].consulting_ready, false);
  assert.equal(home.candidates[0].state, 'REVOKED');
});

test('late invitation delivery cannot overwrite an accepted relationship or resurrect a revoked invitation', async () => {
  const { service, store } = harness();
  const token = await authenticate(service);
  const accepted = await service.createInvitation(token, input(1), 'late-accepted');
  await service.acceptInvitation(accepted.invitation_token, consent);
  await service.recordDelivery(accepted.outbox_id, { success: true });
  assert.equal((await store.read()).invitations[accepted.invitation.invitation_id].state, 'ACCEPTED');
  const revoked = await service.createInvitation(token, input(2), 'late-revoked');
  await service.revokeInvitation(token, revoked.invitation.invitation_id);
  await service.recordDelivery(revoked.outbox_id, { success: true });
  assert.equal((await store.read()).invitations[revoked.invitation.invitation_id].state, 'REVOKED');
  assert.equal((await service.home(token)).invitation_allowance.used, 1);
});

function response() {
  return { headers: {}, statusCode: null, body: null, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
test('injected actual HTTP handler uses scoped service and refuses implicit canonical/provider fallbacks', async () => {
  const { service } = harness();
  const handler = createRecruitingHttpHandler({ service, env: { RECRUITING_V1_ENABLED: 'true', NODE_ENV: 'development' } });
  const token = await authenticate(service);
  const home = response();
  await handler({ method: 'GET', headers: { host: '127.0.0.1:5269', cookie: `__Host-more_recruiting_manager=${token}` }, query: { view: 'home' } }, home);
  assert.equal(home.statusCode, 200);
  assert.equal(home.body.invitation_allowance.limit, 5);
  assert.match(home.headers['Set-Cookie'], /HttpOnly/u);
  const cookie = home.headers['Set-Cookie'].split(';')[0];
  const denied = response();
  await handler({ method: 'POST', headers: { host: '127.0.0.1:5269', origin: 'http://127.0.0.1:5269', cookie, 'x-recruiting-csrf': home.body.csrf_token }, body: { action: 'GENERATE_INTELLIGENCE', candidate_id: 'synthetic' } }, denied);
  assert.equal(denied.body.code, 'RECRUITING_INJECTED_INTELLIGENCE_REQUIRED');
});

test('HTTP quota and delivery failures return a usable CSRF proof without another invitation debit', async () => {
  const { service } = harness();
  let token = await authenticate(service);
  for (let index = 0; index < 5; index += 1) await service.createInvitation(token, input(index), `fill-${index}`);
  const handler = createRecruitingHttpHandler({ service, env: { RECRUITING_V1_ENABLED: 'true', NODE_ENV: 'development' } });
  let csrf = await service.issueManagerCsrf(token);
  async function create(index) {
    const res = response();
    await handler({ method: 'POST', headers: { host: '127.0.0.1:5269', origin: 'http://127.0.0.1:5269', cookie: `__Host-more_recruiting_manager=${token}`, 'x-recruiting-csrf': csrf, 'idempotency-key': `http-${index}` }, body: { action: 'CREATE_INVITATION', ...input(index) } }, res);
    if (res.headers['Set-Cookie']) token = decodeURIComponent(res.headers['Set-Cookie'].split(';')[0].split('=')[1]);
    if (res.body.csrf_token) csrf = res.body.csrf_token;
    return res;
  }
  const exhausted = await create(6);
  assert.equal(exhausted.statusCode, 409);
  assert.equal(exhausted.body.code, 'RECRUITING_INVITATION_ALLOWANCE_EXHAUSTED');
  assert.ok(exhausted.body.csrf_token);
  const duplicate = await create(0);
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.idempotent, true);
  assert.equal(duplicate.body.invitation_allowance.used, 5);

  const failed = harness();
  failed.service.transport = { synthetic: true, deliver: async () => ({ success: false }) };
  const failedToken = await authenticate(failed.service);
  const failedHandler = createRecruitingHttpHandler({ service: failed.service, env: { RECRUITING_V1_ENABLED: 'true', NODE_ENV: 'development' } });
  const delivery = response();
  await failedHandler({ method: 'POST', headers: { host: '127.0.0.1:5269', origin: 'http://127.0.0.1:5269', cookie: `__Host-more_recruiting_manager=${failedToken}`, 'x-recruiting-csrf': await failed.service.issueManagerCsrf(failedToken), 'idempotency-key': 'delivery-fails' }, body: { action: 'CREATE_INVITATION', ...input(9) } }, delivery);
  assert.equal(delivery.body.code, 'RECRUITING_NOTIFICATION_DELIVERY_FAILED');
  const activeToken = decodeURIComponent(delivery.headers['Set-Cookie'].split(';')[0].split('=')[1]);
  await failed.service.consumeManagerCsrf(activeToken, delivery.body.csrf_token);
  const home = await failed.service.home(activeToken);
  assert.equal(home.candidates[0].state, 'DELIVERY_FAILED');
  assert.equal(home.invitation_allowance.remaining, 5);
});
