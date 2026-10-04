import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuth } from '../server/athleteAcademyV1/auth.js';
import { createAcademyService } from '../server/athleteAcademyV1/service.js';
import { academyConfig } from '../server/athleteAcademyV1/config.js';
import { digest } from '../server/athleteAcademyV1/repository.js';
import { YOUTH_REGISTER_INDEX, APPROVAL_BASIS, registerYouth, indexYouth, createYouthApprovalRegisterReader } from '../server/athleteAcademyV1/youthApprovalRegister.js';

const at = Date.parse('2026-10-03T19:00:00Z');
const policyVersion = 'candidate-review-v1';
const command = extra => ({ requestId: randomUUID(), ...extra });
function fixture(age = 13) {
  const records = new Map();
  const repo = {
    read: async key => structuredClone(records.get(key) ?? null),
    transact: async (keys, mutate) => {
      const tx = await mutate(Object.fromEntries(keys.map(key => [key, structuredClone(records.get(key) ?? null)])));
      for (const [key, value] of Object.entries(tx.writes)) {
        assert.ok(keys.includes(key)); records.set(key, structuredClone(value));
      }
      return structuredClone(tx.result);
    },
  };
  const config = academyConfig({ ATHLETE_ACADEMY_ENABLED: '1', ATHLETE_ACADEMY_ORIGIN: 'http://127.0.0.1:5321',
    ATHLETE_ACADEMY_LOCAL_PREVIEW: '1', ATHLETE_ACADEMY_SYNTHETIC_PREVIEW: '1', ATHLETE_ACADEMY_REAL_YOUTH_ENABLED: '1',
    ATHLETE_ACADEMY_MAIL_ENABLED: '1' });
  const athlete = { id: randomUUID(), mm: 'MM-20261003-AAAAAAAA', role: 'participant', verified: true, sessionVersion: 1, email: 'athlete@test.invalid' };
  const adult = { id: randomUUID(), displayName: 'Fictional Adult', email: 'adult@test.invalid', dateOfBirth: '1980-01-01', region: 'US-CA', role: 'guardian', verified: true, sessionVersion: 1 };
  const dossier = { mm: athlete.mm, ownerId: athlete.id, synthetic: true, createdAt: at, revision: 0,
    person: { name: 'Fictional Youth', dateOfBirth: `${2026 - age}-01-01` },
    memberships: [{ institutionId: 'beyond-today-sports-institute', status: 'active' }],
    entitlements: { bos: true, apa: true, coach: true }, participation: { athleteAccepted: true, policyVersion, status: age < 18 ? 'guardian_required' : 'self_authorized' },
    intake: { bos: { revision: 0, answers: [], complete: false } }, reports: { bos: null, apa: null }, jobs: [], events: [] };
  const indexed = registerYouth(dossier, at);
  records.set(`account:${athlete.id}`, athlete); records.set(`account:${adult.id}`, adult); records.set(`dossier:${athlete.mm}`, dossier);
  if (indexed) records.set(YOUTH_REGISTER_INDEX, indexYouth(null, athlete.mm));
  const auth = createAuth({ repo, config, now: () => at });
  const academy = createAcademyService({ repo, config, auth, now: () => at });
  const read = createYouthApprovalRegisterReader({ repo, config, now: () => at, authorize: async principal => principal });
  const grant = { authenticated: true, actorId: 'fictional-assigned-safety-operator', permission: 'youth_approval_register_read', current: true, scope: 'california_youth', syntheticOnly: false, subjectMms: 'all_registered_california_youth' };
  async function invite(recipient = adult) {
    const result = await academy.inviteGuardian(athlete, command({ email: recipient.email }));
    return (await repo.read(`mail:${result.mailId}`)).token;
  }
  return { records, repo, config, athlete, adult, auth, academy, read, grant, invite };
}

test('both California youth age bands are registered without invented approval; adults are excluded', async () => {
  for (const age of [13, 14, 15, 16, 17]) {
    const f = fixture(age), result = await f.read(f.grant);
    assert.equal(result.rows[0].ageBandAtRegistration, age === 17 ? '17' : '13-16');
    assert.equal(result.rows[0].approvalStatus, 'approval_missing');
    assert.deepEqual(result.rows[0].approvals, []);
    assert.equal(result.historicalCoverageVerified, false);
  }
  const adult = fixture(18); assert.equal(await adult.repo.read(YOUTH_REGISTER_INDEX), null);
});

test('real signup transaction indexes both youth bands but not adult or guardian-only accounts', async () => {
  const f = fixture(18);
  for (const age of [13, 17, 18]) {
    await f.auth.signup({ email: `registered-${age}@test.invalid`, displayName: `Fictional Registered ${age}`,
      dateOfBirth: `${2026 - age}-01-01`, region: 'US-CA', sport: 'Soccer', password: 'Fictional-only-password-2026' });
  }
  await f.auth.signup({ email: 'registered-guardian@test.invalid', displayName: 'Fictional Guardian Only',
    accountRole: 'guardian', dateOfBirth: '1980-01-01', region: 'US-CA', password: 'Fictional-only-password-2026' });
  const result = await f.read(f.grant);
  assert.equal(result.indexedCount, 2);
  assert.deepEqual(result.rows.map(r => r.ageBandAtRegistration).sort(), ['13-16', '17']);
  assert.ok(result.rows.every(r => r.approvalStatus === 'approval_missing'));
});

test('actual authenticated persisted adult is captured; client names or verified labels cannot substitute', async () => {
  const f = fixture(), token = await f.invite();
  await f.academy.acceptGuardian(f.adult, command({ token, accepted: true, policyVersion,
    adultName: 'Spoofed', adultEmail: 'spoof@test.invalid', independentlyVerified: true, guardianRelationship: 'parent' }));
  const row = (await f.read(f.grant)).rows[0], approval = row.approvals[0];
  assert.equal(approval.adultId, f.adult.id); assert.equal(approval.adultName, f.adult.displayName);
  assert.equal(approval.adultEmail, f.adult.email); assert.equal(approval.basis, APPROVAL_BASIS);
  assert.equal(approval.claimedRelationship, 'parent'); assert.equal(approval.independentlyVerified, false);
  assert.equal(row.approvalStatus, 'approved_self_attested');
});

test('unverified or mismatched accounts cannot create an approval or consume the correct invitation', async () => {
  const f = fixture(), token = await f.invite(), before = await f.repo.read(`dossier:${f.athlete.mm}`);
  f.records.set(`account:${f.adult.id}`, { ...f.adult, verified: false });
  await assert.rejects(f.academy.acceptGuardian(f.adult, command({ token, accepted: true, policyVersion })), /SESSION_EXPIRED/);
  f.records.set(`account:${f.adult.id}`, { ...f.adult, email: 'mismatch@test.invalid' });
  await assert.rejects(f.academy.acceptGuardian(f.adult, command({ token, accepted: true, policyVersion })), /GUARDIAN_INVITATION_INVALID/);
  assert.deepEqual(await f.repo.read(`dossier:${f.athlete.mm}`), before);
  assert.equal((await f.repo.read(`token:${digest(token)}`)).used, false);
});

test('same approval event is idempotent and conflicting replay cannot append or change its issuer', async () => {
  const f = fixture(), token = await f.invite(), body = command({ token, accepted: true, policyVersion });
  assert.deepEqual(await f.academy.acceptGuardian(f.adult, body), { accepted: true });
  assert.deepEqual(await f.academy.acceptGuardian(f.adult, body), { accepted: true });
  await assert.rejects(f.academy.acceptGuardian(f.adult, { ...body, guardianRelationship: 'parent' }), /REQUEST_ID_CONFLICT/);
  assert.equal((await f.read(f.grant)).rows[0].approvals.length, 1);
});

test('withdrawal pauses participation, preserves originals and approval history, and replay cannot reactivate', async () => {
  const f = fixture(17), token = await f.invite(), body = command({ token, accepted: true, policyVersion });
  await f.academy.acceptGuardian(f.adult, body);
  const d = f.records.get(`dossier:${f.athlete.mm}`); d.reports = { bos: { original: 'preserve' }, apa: { original: 'preserve' } };
  const original = structuredClone(d.reports);
  await f.academy.withdraw(f.adult, command({ mm: f.athlete.mm }));
  await f.academy.acceptGuardian(f.adult, body);
  const saved = await f.repo.read(`dossier:${f.athlete.mm}`), row = (await f.read(f.grant)).rows[0];
  assert.equal(saved.participation.status, 'withdrawn'); assert.deepEqual(saved.reports, original);
  assert.equal(row.approvals[0].status, 'withdrawn'); assert.equal(row.approvalCurrent, false);
  assert.throws(() => f.academy.participant(saved, f.athlete, 'bos'), /PARTICIPATION_WITHDRAWN/);
});

test('replacement retains the first event and assigns only the actual new approving adult', async () => {
  const f = fixture(), first = await f.invite();
  await f.academy.acceptGuardian(f.adult, command({ token: first, accepted: true, policyVersion }));
  const next = { ...f.adult, id: randomUUID(), displayName: 'Fictional Next Adult', email: 'next@test.invalid' };
  f.records.set(`account:${next.id}`, next);
  const token = await f.invite(next);
  await f.academy.acceptGuardian(next, command({ token, accepted: true, policyVersion }));
  const history = (await f.read(f.grant)).rows[0].approvals;
  assert.equal(history[0].adultId, f.adult.id); assert.equal(history[0].status, 'replaced');
  assert.equal(history[0].replacedByApprovalId, history[1].approvalId); assert.equal(history[1].adultId, next.id);
});

test('private register read requires current staff authorization before any repository read', async () => {
  let reads = 0;
  const f = fixture();
  const reader = createYouthApprovalRegisterReader({ repo: { read: async () => { reads++; return null; } }, config: f.config, authorize: async p => p });
  for (const patch of [{ authenticated: false }, { current: false }, { permission: 'academy_directory_read' }, { syntheticOnly: true }, { scope: 'all' }])
    await assert.rejects(reader({ ...f.grant, ...patch }), /YOUTH_REGISTER_READ_DENIED/);
  assert.equal(reads, 0);
});

test('no register, adult contact, tokens or private answers escape participant or minimal staff projections', async () => {
  const f = fixture(), token = await f.invite();
  await f.academy.acceptGuardian(f.adult, command({ token, accepted: true, policyVersion }));
  const d = f.records.get(`dossier:${f.athlete.mm}`); d.youthApprovalRegister.approvals[0].unexpectedSecret = 'never-project';
  const publicView = f.academy.publicDossier(d), staffView = await f.read(f.grant);
  assert.equal(Object.hasOwn(publicView, 'youthApprovalRegister'), false);
  assert.equal(JSON.stringify(publicView).includes(f.adult.email), false);
  assert.equal(JSON.stringify(staffView).includes('never-project'), false);
  assert.equal(JSON.stringify(staffView).includes(token), false);
  assert.equal(Object.hasOwn(staffView.rows[0], 'intake'), false);
});

test('missing stored adult fields stay missing and legacy history is not fabricated', async () => {
  const f = fixture(), token = await f.invite();
  f.records.set(`account:${f.adult.id}`, { ...f.adult, displayName: null });
  await f.academy.acceptGuardian(f.adult, command({ token, accepted: true, policyVersion }));
  const row = (await f.read(f.grant)).rows[0];
  assert.equal(row.approvals[0].adultName, null); assert.equal(row.approvals[0].claimedRelationship, null);
  assert.ok(row.missingFields.includes('adultName')); assert.ok(row.missingFields.includes('claimedRelationship'));
  assert.equal(row.independentlyVerified, false);
  f.records.get(`dossier:${f.athlete.mm}`).youthApprovalRegister.approvals[0].adultEmail = null;
  const missingEmail = (await f.read(f.grant)).rows[0];
  assert.equal(missingEmail.approvals[0].adultEmail, null);
  assert.ok(missingEmail.missingFields.includes('adultEmail'));
});

test('out-of-scope query and missing indexed dossier fail safely without broad key scans', async () => {
  const f = fixture();
  await assert.rejects(f.read(f.grant, { mm: 'another-athlete' }), /YOUTH_REGISTER_QUERY_INVALID/);
  await assert.rejects(f.read(f.grant, { limit: 51 }), /YOUTH_REGISTER_QUERY_INVALID/);
  f.records.delete(`dossier:${f.athlete.mm}`);
  await assert.rejects(f.read(f.grant), /YOUTH_REGISTER_RECORD_UNAVAILABLE/);
});

test('policy advancement, disabled youth and aging out cannot advertise a historical approval as current', async () => {
  const f = fixture(17), token = await f.invite();
  await f.academy.acceptGuardian(f.adult, command({ token, accepted: true, policyVersion }));
  f.config.reviewedYouthPolicyVersion = 'new-reviewed-policy-v2';
  let row = (await f.read(f.grant)).rows[0];
  assert.equal(row.policyCurrent, false); assert.equal(row.approvalCurrent, false);
  assert.equal(row.approvalStatus, 'approval_not_current');
  assert.equal(row.approvals[0].policyVersion, policyVersion);
  f.config.reviewedYouthPolicyVersion = null; f.config.realYouthEnabled = false;
  row = (await f.read(f.grant)).rows[0]; assert.equal(row.approvalCurrent, false);
  f.config.realYouthEnabled = true;
  const later = createYouthApprovalRegisterReader({ repo: f.repo, config: f.config,
    authorize: async p => p, now: () => Date.parse('2027-01-02T19:00:00Z') });
  row = (await later(f.grant)).rows[0];
  assert.equal(row.currentAgeBand, 'adult'); assert.equal(row.approvalStatus, 'aged_out');
  assert.equal(row.approvalCurrent, false); assert.equal(row.approvals[0].status, 'approved');
});
