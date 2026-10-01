import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { academyConfig, ageOn, participationPolicyVersion } from '../server/athleteAcademyV1/config.js';
import { createAuth, publicAccount } from '../server/athleteAcademyV1/auth.js';
import { createAcademyService } from '../server/athleteAcademyV1/service.js';
import { createAcademyHandler } from '../server/athleteAcademyV1/handler.js';
import { runAssessmentQueue } from '../server/athleteAcademyV1/worker.js';
import { validateSubject } from '../server/athleteAcademyV1/bos/contract.js';
import { buildCanonicalCoachBundle, hash as bundleHash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { COACH_NOTES_POLICY_VERSION } from '../server/athleteAcademyV1/coaching/coachNotesPolicy.js';
import { digest } from '../server/athleteAcademyV1/repository.js';

const password = 'Fictional-guardian-password-2026';
const policyVersion = 'candidate-review-v1';
const request = extra => ({ requestId: randomUUID(), ...extra });

test('real youth cannot activate using the adult policy or switch alone; adults keep their existing policy', async () => {
  const base = { ATHLETE_ACADEMY_ENABLED: '1', ATHLETE_ACADEMY_ORIGIN: 'https://example.invalid',
    ATHLETE_ACADEMY_REAL_YOUTH_ENABLED: '1', ATHLETE_ACADEMY_MAIL_ENABLED: '1',
    ATHLETE_ACADEMY_REVIEWED_POLICY_VERSION: 'existing-adult-policy-v1' };
  const held = academyConfig(base);
  assert.equal(held.realYouthEnabled, false);
  assert.equal(held.cohort.minimumAge, 18);
  assert.equal(participationPolicyVersion(held, 18), 'existing-adult-policy-v1');
  assert.throws(() => participationPolicyVersion(held, 17), /YOUTH_ENROLLMENT_NOT_ACTIVE/);
  const repo = memoryRepository(), auth = createAuth({ repo, config: held, now: () => Date.parse('2026-09-30T20:00:00Z') });
  for (const age of [13, 16, 17]) {
    const email = `held${age}@test.invalid`;
    await assert.rejects(auth.signup({ email, displayName: 'Fictional held youth', dateOfBirth: `${2026-age}-01-01`,
      region: 'US-CA', sport: 'Soccer', password }), /PILOT_CALIFORNIA_18_PLUS/);
    assert.equal(await repo.read(`email:${digest(email)}`), null);
  }
  assert.equal(await repo.read('queue:mail'), null);
  const enabled = academyConfig({ ...base, ATHLETE_ACADEMY_REVIEWED_YOUTH_POLICY_VERSION: 'fictional-test-youth-policy-v1' });
  assert.equal(enabled.realYouthEnabled, true);
  assert.equal(enabled.cohort.minimumAge, 13);
  assert.equal(participationPolicyVersion(enabled, 17), 'fictional-test-youth-policy-v1');
  assert.equal(participationPolicyVersion(enabled, 18), 'existing-adult-policy-v1');
  assert.throws(() => academyConfig({ ...base, ATHLETE_ACADEMY_REVIEWED_YOUTH_POLICY_VERSION: '<unreviewed>' }), /YOUTH_POLICY_CONFIG_INVALID/);
});

test('new youth policy re-review blocks processing and does not silently rewrite saved original evidence', async () => {
  const ctx = context(), athlete = await signupVerified(ctx, { email: 'policy-change@test.invalid', name: 'Fictional policy athlete', birth: '2009-09-22' }),
    guardian = await signupVerified(ctx, { email: 'policy-guardian@test.invalid', name: 'Fictional policy guardian', birth: '1980-01-01', guardian: true });
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const invite = await ctx.academy.inviteGuardian(athlete, request({ email: guardian.email }));
  await ctx.academy.acceptGuardian(guardian, request({ token: (await ctx.repo.read(`mail:${invite.mailId}`)).token, accepted: true, policyVersion }));
  const before = await ctx.repo.read(`dossier:${athlete.mm}`);
  ctx.config.reviewedYouthPolicyVersion = 'fictional-new-youth-policy-v2';
  assert.throws(() => ctx.academy.participant(before, athlete, 'bos'), /PARTICIPATION_REVIEW_REQUIRED/);
  assert.deepEqual(await ctx.repo.read(`dossier:${athlete.mm}`), before);
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion: 'fictional-new-youth-policy-v2' }));
  const after = await ctx.academy.dossier(athlete);
  assert.equal(after.participation.status, 'guardian_required');
  assert.throws(() => ctx.academy.participant(after, athlete, 'bos'), /GUARDIAN_REQUIRED/);
  assert.deepEqual(after.intake, before.intake);
  assert.deepEqual(after.reports, before.reports);
});

function memoryRepository() {
  const records = new Map();
  const read = async key => structuredClone(records.get(key) ?? null);
  const transact = async (keys, mutate) => {
    const snapshot = Object.fromEntries(keys.map(key => [key, structuredClone(records.get(key) ?? null)]));
    const transaction = await mutate(snapshot);
    for (const [key, value] of Object.entries(transaction.writes || {})) records.set(key, structuredClone(value));
    return structuredClone(transaction.result);
  };
  const putImmutable = async (key, value) => transact([key], saved => {
    if (saved[key] !== null) return { writes: {}, result: saved[key] };
    return { writes: { [key]: value }, result: value };
  });
  return { read, transact, putImmutable };
}

function context({ youth = true, time = '2026-09-23T06:59:00Z' } = {}) {
  let clock = Date.parse(time);
  const config = academyConfig({
    ATHLETE_ACADEMY_ENABLED: '1',
    ATHLETE_ACADEMY_ORIGIN: 'http://127.0.0.1:5321',
    ATHLETE_ACADEMY_LOCAL_PREVIEW: '1',
    ATHLETE_ACADEMY_SYNTHETIC_PREVIEW: '1',
    ATHLETE_ACADEMY_MAIL_ENABLED: '1',
    ATHLETE_ACADEMY_REAL_YOUTH_ENABLED: youth ? '1' : '0',
    ATHLETE_ACADEMY_BEYOND_TODAY_CODE_SHA256: digest('synthetic-code'),
  });
  const repo = memoryRepository();
  const now = () => clock;
  const auth = createAuth({ repo, config, now });
  const academy = createAcademyService({ repo, config, auth, now });
  return { repo, config, auth, academy, setTime: value => { clock = Date.parse(value); } };
}

async function signupVerified(ctx, { email, name, birth, guardian = false }) {
  const body = { email, displayName: name, dateOfBirth: birth, region: 'US-CA', password,
    ...(guardian ? { accountRole: 'guardian' } : { sport: 'Soccer', institutionId: 'beyond-today-sports-institute', institutionCode: 'synthetic-code' }) };
  const signed = await ctx.auth.signup(body);
  const mail = await ctx.repo.read(`mail:${signed.mailId}`);
  await ctx.auth.verifyEmail(mail.token);
  return (await ctx.auth.login({ email, password })).session.account;
}

test('under-13, non-California and invalid-date signup reject before any storage or mail write', async () => {
  const ctx = context({ time: '2026-09-30T20:00:00Z' });
  let writes = 0;
  const originalTransact = ctx.repo.transact;
  ctx.repo.transact = (...args) => { writes++; return originalTransact(...args); };
  const base = { displayName: 'Fictional excluded enrollment', sport: 'Soccer', password, region: 'US-CA' };
  await assert.rejects(ctx.auth.signup({ ...base, email: 'under13@test.invalid', dateOfBirth: '2014-01-01' }), /PILOT_CALIFORNIA_13_PLUS/);
  for (const age of [13, 14, 15, 16, 17]) {
    for (const region of ['US-AZ', 'US-NV', '']) {
      await assert.rejects(ctx.auth.signup({ ...base, region, email: `excluded-${age}-${region || 'missing'}@test.invalid`,
        dateOfBirth: `${2026-age}-01-01` }), /PILOT_CALIFORNIA_13_PLUS/);
    }
  }
  await assert.rejects(ctx.auth.signup({ ...base, accountRole: 'guardian', email: 'non-ca-guardian@test.invalid',
    region: 'US-AZ', dateOfBirth: '1980-01-01' }), /ADULT_GUARDIAN_REQUIRED/);
  for (const dateOfBirth of ['2013-02-29', '2026-10-01']) {
    await assert.rejects(ctx.auth.signup({ ...base, email: 'invalid-date@test.invalid', dateOfBirth }), /BIRTH_DATE_INVALID/);
  }
  assert.equal(writes, 0);
  assert.equal(await ctx.repo.read('queue:mail'), null);
});

test('California birthday boundary is local-time, and youth remains off by default', async () => {
  for (const [birth, before, after] of [
    ['2013-09-23', 12, 13],
    ['2010-09-23', 15, 16],
    ['2009-09-23', 16, 17],
    ['2008-09-23', 17, 18],
  ]) {
    assert.equal(ageOn(birth, Date.parse('2026-09-23T06:59:00Z')), before);
    assert.equal(ageOn(birth, Date.parse('2026-09-23T07:00:00Z')), after);
  }
  assert.equal(ageOn('2008-09-23', Date.parse('2026-09-23T06:59:00Z')), 17);
  assert.equal(ageOn('2008-09-23', Date.parse('2026-09-23T07:00:00Z')), 18);
  const adultOnly = context({ youth: false });
  assert.equal(adultOnly.config.cohort.minimumAge, 18);
  await assert.rejects(adultOnly.auth.signup({ email: 'seventeen@test.invalid', displayName: 'Seventeen', dateOfBirth: '2008-09-23', region: 'US-CA', sport: 'Soccer', password }), /PILOT_CALIFORNIA_18_PLUS/);
  await assert.rejects(adultOnly.auth.signup({ email: 'guardian@test.invalid', displayName: 'Guardian', dateOfBirth: '1980-01-01', region: 'US-CA', accountRole: 'guardian', password }), /YOUTH_ENROLLMENT_NOT_ACTIVE/);
  assert.equal(adultOnly.config.realYouthEnabled, false);
  const adult = await signupVerified(adultOnly, { email: 'adult@test.invalid', name: 'Adult Participant', birth: '2000-01-01' });
  assert.equal(adult.role, 'participant');
  assert.match(adult.mm, /^MM-\d{8}-[A-F0-9]{8}$/);
  assert.equal((await adultOnly.academy.getDossier(adult, { mm: adult.mm })).dossier.participation.status, 'self_authorized');
});

test('locked BOS and private coaching validators admit 13 only after surrounding service authorization', async () => {
  const subject = { synthetic: true, record_kind: 'synthetic_test', mm: 'MM-20260923-ABCDEF01', age: 13, intake_mode: 'standard', answers: Array.from({ length: 20 }, (_, i) => ({ question_id: `Q${String(i + 1).padStart(2, '0')}`, text: 'Fictional answer' })) };
  assert.doesNotThrow(() => validateSubject(subject));
  assert.throws(() => validateSubject({ ...subject, age: 12 }), /AGE_OUT_OF_SCOPE/);
  const fixture = JSON.parse(await readFile(new URL('../server/athleteConsultingV2/fixtures/sofia.json', import.meta.url)));
  const withHash = value => { const { artifact_sha256: _prior, ...body } = value; return { ...body, artifact_sha256: bundleHash(body) }; };
  const bos = withHash({ ...fixture.bos, subject: { ...fixture.bos.subject, age: 13 } });
  const apa = withHash({ ...fixture.apa, identity: { ...fixture.apa.identity, age: 13 }, bos_sha256: bundleHash(bos) });
  const person = { ...fixture.person, age: 13, actorId: 'synthetic-athlete' };
  const principal = { authenticated: true, actorId: person.actorId, subjectActorId: person.actorId, mm: person.mm, role: 'athlete', grants: { coachingRead: true, reportsRead: true, participation: true } };
  const bosInput = { ...fixture.bos_source, age: 13, person: { mm: person.mm } };
  assert.equal(buildCanonicalCoachBundle({ person, bos, apa, bosInput }, principal).person.age, 13);
  assert.throws(() => buildCanonicalCoachBundle({ person: { ...person, age: 12 }, bos, apa, bosInput }, principal), /COACH_CANONICAL_PAIR_REQUIRED/);
});

test('guardian-only signup requires email confirmation and creates no athlete profile', async () => {
  const ctx = context();
  const email = 'newguardian@test.invalid';
  const signed = await ctx.auth.signup({ accountRole: 'guardian', email, displayName: 'New Guardian', dateOfBirth: '1980-01-01', region: 'US-CA', password });
  assert.equal(signed.verificationRequired, true);
  await assert.rejects(ctx.auth.login({ email, password }), /VERIFY_EMAIL_FIRST/);
  const mail = await ctx.repo.read(`mail:${signed.mailId}`);
  await ctx.auth.verifyEmail(mail.token);
  await assert.rejects(ctx.auth.verifyEmail(mail.token), /LINK_EXPIRED_OR_USED/);
  const account = (await ctx.auth.login({ email, password })).session.account;
  assert.equal(account.role, 'guardian');
  assert.equal(publicAccount(account).mm, undefined);
  assert.equal(account.sport, undefined);
  assert.equal(account.mm, undefined);
  assert.equal(await ctx.repo.read('dossier:undefined'), null);
});

test('guardian HTTP session exposes no athlete list and cannot invoke participant or coaching actions', async () => {
  const ctx = context();
  const email = 'httpguardian@test.invalid';
  ctx.config.coachNotesEnabled = true;
  ctx.config.coachNotesPolicyVersion = COACH_NOTES_POLICY_VERSION;
  await signupVerified(ctx, { email, name: 'HTTP Guardian', birth: '1980-01-01', guardian: true });
  const handler = createAcademyHandler({ config: ctx.config, auth: ctx.auth, academy: ctx.academy, coaching: { bundle: async () => { throw Error('coaching must not run'); } }, deliver: async () => {} });
  const invoke = async ({ method = 'GET', cookie, csrf, body = {} } = {}) => {
    const result = { headers: {} };
    const response = { setHeader: (name, value) => { result.headers[name] = value; }, status: code => { result.status = code; return response; }, json: data => { result.body = data; return result; } };
    await handler({ method, body, headers: { origin: 'http://127.0.0.1:5321', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}) }, socket: { remoteAddress: '127.0.0.1' } }, response, { defer: () => {} });
    return result;
  };
  const boot = await invoke();
  const signed = await invoke({ method: 'POST', cookie: boot.headers['Set-Cookie'].split(';')[0], csrf: boot.body.csrfToken, body: { action: 'login', email, password } });
  assert.equal(signed.status, 200);
  const cookie = signed.headers['Set-Cookie'].split(';')[0], csrf = signed.body.csrfToken;
  const privateBoot = await invoke({ cookie });
  assert.equal(privateBoot.body.account.role, 'guardian');
  assert.equal(privateBoot.body.account.mm, undefined);
  assert.deepEqual(privateBoot.body.athletes, []);
  assert.equal(privateBoot.body.capabilities.coachNotes, undefined);
  for (const action of ['get_dossier', 'coach_bundle', 'redeem_institution', 'coach_notes_view']) {
    const denied = await invoke({ method: 'POST', cookie, csrf, body: { action, requestId: randomUUID(), mm: 'MM-20260923-ABCDEF01' } });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, 'PARTICIPANT_ACCOUNT_REQUIRED');
  }
  const dashboard = await invoke({ method: 'POST', cookie, csrf, body: { action: 'guardian_dashboard', requestId: randomUUID() } });
  assert.equal(dashboard.status, 200);
  assert.deepEqual(dashboard.body.participants, []);
});

test('13–16 participant and guardian-only accounts keep distinct identities and permissions', async () => {
  const ctx = context();
  assert.equal(ctx.config.cohort.minimumAge, 13);
  await assert.rejects(ctx.auth.signup({ email: 'twelve@test.invalid', displayName: 'Twelve', dateOfBirth: '2013-09-23', region: 'US-CA', sport: 'Soccer', password }), /PILOT_CALIFORNIA_13_PLUS/);
  const athlete = await signupVerified(ctx, { email: 'athlete@test.invalid', name: 'Rowan Test', birth: '2013-09-22' });
  const secondAthlete = await signupVerified(ctx, { email: 'olderathlete@test.invalid', name: '  ROWAN   TEST  ', birth: '2010-09-22' });
  const guardian = await signupVerified(ctx, { email: 'guardian@test.invalid', name: 'Parent Test', birth: '1980-01-01', guardian: true });
  assert.equal(athlete.role, 'participant');
  assert.equal(guardian.role, 'guardian');
  assert.equal(publicAccount(guardian).mm, undefined);
  assert.equal((await ctx.repo.read(`account:${guardian.id}`)).sport, undefined);
  assert.equal(await ctx.repo.read('dossier:undefined'), null);
  assert.notEqual(athlete.id, secondAthlete.id);
  assert.notEqual(athlete.mm, secondAthlete.mm);
  await assert.rejects(ctx.academy.getDossier(guardian, { mm: athlete.mm }), /NOT_FOUND/);
  await assert.rejects(ctx.auth.redeem(guardian, { institutionId: 'beyond-today-sports-institute', institutionCode: 'synthetic-code' }), /PARTICIPANT_ACCOUNT_REQUIRED/);
  await assert.rejects(ctx.academy.saveIntake(guardian, request({ mm: athlete.mm, service: 'bos', answers: [], revision: 0 })), /NOT_FOUND/);
  const own = await ctx.academy.dossier(athlete);
  assert.equal(own.participation.status, 'guardian_required');
  assert.throws(() => ctx.academy.participant(own, athlete, 'bos'), /PARTICIPATION_REVIEW_REQUIRED/);
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const invite = await ctx.academy.inviteGuardian(athlete, request({ email: guardian.email }));
  const firstMail = await ctx.repo.read(`mail:${invite.mailId}`);
  const replacement = await ctx.academy.inviteGuardian(athlete, request({ email: guardian.email }));
  const secondMail = await ctx.repo.read(`mail:${replacement.mailId}`);
  await assert.rejects(ctx.academy.guardianPreview(guardian, { token: firstMail.token }), error => error.code === 'GUARDIAN_INVITATION_INVALID' && !error.message.includes(athlete.mm) && !error.message.includes('Rowan'));
  assert.equal((await ctx.academy.guardianPreview(guardian, { token: secondMail.token })).mm, athlete.mm);
  await ctx.academy.acceptGuardian(guardian, request({ token: secondMail.token, accepted: true, policyVersion }));
  await assert.rejects(ctx.academy.guardianPreview(guardian, { token: secondMail.token }), /GUARDIAN_INVITATION_INVALID/);
  const approved = await ctx.academy.dossier(athlete);
  assert.equal(approved.participation.status, 'authorized');
  assert.equal(approved.participation.guardianId, guardian.id);
  assert.equal((await ctx.academy.guardians(guardian)).participants[0].active, true);
  assert.doesNotThrow(() => ctx.academy.participant(approved, athlete, 'bos'));
});

test('every California age 13–17 requires separate guardian approval and own scope in fictional HTTP sessions', async () => {
  const ctx = context();
  const cases = [13,14,15,16,17].map(age => ({ age, birth: `${2026-age}-09-22`, athleteEmail: `age${age}@test.invalid`, guardianEmail: `age${age}-guardian@test.invalid` }));
  for (const item of cases) {
    item.athlete = await signupVerified(ctx, { email: item.athleteEmail, name: `Fictional Age ${item.age}`, birth: item.birth });
    item.guardian = await signupVerified(ctx, { email: item.guardianEmail, name: `Fictional Guardian ${item.age}`, birth: '1980-01-01', guardian: true });
    assert.notEqual(item.athlete.id, item.guardian.id);
    assert.equal((await ctx.academy.getDossier(item.athlete, { mm: item.athlete.mm })).dossier.person.age, item.age);
  }
  assert.notEqual(cases[0].athlete.mm, cases[1].athlete.mm);
  const handler = createAcademyHandler({ config: ctx.config, auth: ctx.auth, academy: ctx.academy, coaching: { bundle: async () => { throw Error('coaching must not run'); } }, deliver: async () => {} });
  const invoke = async ({ method = 'GET', cookie, csrf, body = {} } = {}) => {
    const result = { headers: {} };
    const response = { setHeader: (name, value) => { result.headers[name] = value; }, status: code => { result.status = code; return response; }, json: data => { result.body = data; return result; } };
    await handler({ method, body, headers: { origin: 'http://127.0.0.1:5321', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}) }, socket: { remoteAddress: '127.0.0.1' } }, response, { defer: () => {} });
    return result;
  };
  const signIn = async email => {
    const boot = await invoke();
    const signed = await invoke({ method: 'POST', cookie: boot.headers['Set-Cookie'].split(';')[0], csrf: boot.body.csrfToken, body: { action: 'login', email, password } });
    assert.equal(signed.status, 200);
    return { cookie: signed.headers['Set-Cookie'].split(';')[0], csrf: signed.body.csrfToken, account: signed.body.account };
  };
  const post = (session, action, extra = {}) => invoke({ method: 'POST', cookie: session.cookie, csrf: session.csrf, body: request({ action, ...extra }) });
  for (const item of cases) {
    item.athleteSession = await signIn(item.athleteEmail);
    item.guardianSession = await signIn(item.guardianEmail);
  }
  for (const item of cases) {
    assert.equal(item.athleteSession.account.mm, item.athlete.mm);
    assert.equal(item.guardianSession.account.role, 'guardian');
    assert.equal(item.guardianSession.account.mm, undefined);
    const athleteBoot = await invoke({ cookie: item.athleteSession.cookie });
    assert.deepEqual(athleteBoot.body.athletes.map(athlete => athlete.mm), [item.athlete.mm]);
    const guardianBoot = await invoke({ cookie: item.guardianSession.cookie });
    assert.deepEqual(guardianBoot.body.athletes, []);
    assert.deepEqual((await post(item.guardianSession, 'guardian_dashboard')).body.participants, []);

    const firstRead = await post(item.athleteSession, 'get_dossier', { mm: item.athlete.mm });
    assert.equal(firstRead.body.dossier.participation.status, 'guardian_required');
    const firstSave = await post(item.athleteSession, 'save_intake', { mm: item.athlete.mm, service: 'bos', revision: firstRead.body.dossier.revision, answers: [{ question_id: 'Q01', text: 'Fictional answer', skipped: false }] });
    assert.equal(firstSave.status, 403);
    assert.equal(firstSave.body.error.code, 'PARTICIPATION_REVIEW_REQUIRED');
    const prematureInvite = await post(item.athleteSession, 'invite_guardian', { email: item.guardianEmail });
    assert.equal(prematureInvite.status, 403);
    assert.equal(prematureInvite.body.error.code, 'PARTICIPATION_REVIEW_REQUIRED');

    const accepted = await post(item.athleteSession, 'accept_participation', { accepted: true, policyVersion });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.dossier.participation.status, 'guardian_required');
    const unapprovedSave = await post(item.athleteSession, 'save_intake', { mm: item.athlete.mm, service: 'bos', revision: accepted.body.dossier.revision, answers: [{ question_id: 'Q01', text: 'Fictional answer', skipped: false }] });
    assert.equal(unapprovedSave.status, 403);
    assert.equal(unapprovedSave.body.error.code, 'GUARDIAN_REQUIRED');

    const invited = await post(item.athleteSession, 'invite_guardian', { email: item.guardianEmail });
    assert.equal(invited.status, 200);
    assert.equal(invited.body.delivery, 'pending');
    const queued = await ctx.repo.read('queue:mail');
    const invitation = await ctx.repo.read(`mail:${queued.ids.at(-1)}`);
    const otherGuardian = cases.find(candidate => candidate !== item).guardianSession;
    const wrongPreview = await post(otherGuardian, 'guardian_invitation', { token: invitation.token });
    assert.equal(wrongPreview.status, 403);
    assert.equal(wrongPreview.body.error.code, 'GUARDIAN_INVITATION_INVALID');
    assert.equal(JSON.stringify(wrongPreview.body).includes(item.athlete.mm), false);
    const preview = await post(item.guardianSession, 'guardian_invitation', { token: invitation.token });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.mm, item.athlete.mm);
    const guardianPrivateRead = await post(item.guardianSession, 'get_dossier', { mm: item.athlete.mm });
    assert.equal(guardianPrivateRead.status, 403);
    assert.equal(guardianPrivateRead.body.error.code, 'PARTICIPANT_ACCOUNT_REQUIRED');
    const approved = await post(item.guardianSession, 'accept_guardian', { token: invitation.token, accepted: true, policyVersion });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.accepted, true);
    const replay = await post(item.guardianSession, 'guardian_invitation', { token: invitation.token });
    assert.equal(replay.status, 403);
    assert.deepEqual((await post(item.guardianSession, 'guardian_dashboard')).body.participants.map(participant => participant.mm), [item.athlete.mm]);
    const authorizedRead = await post(item.athleteSession, 'get_dossier', { mm: item.athlete.mm });
    assert.equal(authorizedRead.body.dossier.participation.status, 'authorized');
    const saved = await post(item.athleteSession, 'save_intake', { mm: item.athlete.mm, service: 'bos', revision: authorizedRead.body.dossier.revision, answers: [{ question_id: 'Q01', text: `Fictional age ${item.age} answer`, skipped: false }] });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.dossier.intake.bos.answers[0].text, `Fictional age ${item.age} answer`);
  }
  const crossAthleteRead = await post(cases[0].athleteSession, 'get_dossier', { mm: cases[1].athlete.mm });
  assert.equal(crossAthleteRead.status, 404);
  assert.equal(crossAthleteRead.body.error.code, 'NOT_FOUND');
  for (const item of cases) {
    const withdrawn = await post(item.guardianSession, 'withdraw_participation', { mm: item.athlete.mm });
    assert.equal(withdrawn.status, 200);
    assert.deepEqual((await post(item.guardianSession, 'guardian_dashboard')).body.participants, []);
    const afterWithdrawal = await post(item.athleteSession, 'get_dossier', { mm: item.athlete.mm });
    const denied = await post(item.athleteSession, 'save_intake', { mm: item.athlete.mm, service: 'bos', revision: afterWithdrawal.body.dossier.revision, answers: [{ question_id: 'Q01', text: 'Must remain blocked', skipped: false }] });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, 'PARTICIPATION_WITHDRAWN');
  }
});

test('wrong-account and expired invitations disclose no athlete identity; guardian recovery rotates sessions', async () => {
  const ctx = context();
  const athlete = await signupVerified(ctx, { email: 'athlete2@test.invalid', name: 'Casey Test', birth: '2013-09-22' });
  const intended = await signupVerified(ctx, { email: 'intended@test.invalid', name: 'Intended Guardian', birth: '1980-01-01', guardian: true });
  const wrong = await signupVerified(ctx, { email: 'wrong@test.invalid', name: 'Other Guardian', birth: '1980-01-01', guardian: true });
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const invite = await ctx.academy.inviteGuardian(athlete, request({ email: intended.email }));
  const mail = await ctx.repo.read(`mail:${invite.mailId}`);
  await assert.rejects(ctx.academy.guardianPreview(wrong, { token: mail.token }), error => error.code === 'GUARDIAN_INVITATION_INVALID' && !error.message.includes(athlete.mm) && !error.message.includes('Casey'));
  assert.deepEqual((await ctx.academy.guardians(wrong)).participants, []);
  const oldSession = await ctx.auth.login({ email: intended.email, password });
  const reset = await ctx.auth.requestReset({ email: intended.email });
  const resetMail = await ctx.repo.read(`mail:${reset.mailId}`);
  await ctx.auth.resetPassword({ token: resetMail.token, password: 'Fictional-new-guardian-password-2026' });
  assert.equal(await ctx.auth.session(oldSession.raw), null);
  await assert.rejects(ctx.auth.login({ email: intended.email, password }), /EMAIL_OR_PASSWORD_NOT_RECOGNIZED/);
  assert.equal((await ctx.auth.login({ email: intended.email, password: 'Fictional-new-guardian-password-2026' })).session.account.id, intended.id);
  ctx.setTime('2026-09-24T07:00:00Z');
  await assert.rejects(ctx.academy.guardianPreview(intended, { token: mail.token }), /GUARDIAN_INVITATION_INVALID/);
});

test('a pre-candidate pending guardian link remains usable without backfilling customer state', async () => {
  const ctx = context();
  const athlete = await signupVerified(ctx, { email: 'legacyathlete@test.invalid', name: 'Legacy Athlete', birth: '2009-09-23' });
  const guardian = await signupVerified(ctx, { email: 'legacyguardian@test.invalid', name: 'Legacy Guardian', birth: '1980-01-01', guardian: true });
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const invite = await ctx.academy.inviteGuardian(athlete, request({ email: guardian.email }));
  const mail = await ctx.repo.read(`mail:${invite.mailId}`);
  const key = `dossier:${athlete.mm}`;
  await ctx.repo.transact([key], saved => {
    delete saved[key].participation.pendingGuardianTokenHash;
    return { writes: { [key]: saved[key] }, result: true };
  });
  assert.equal((await ctx.academy.guardianPreview(guardian, { token: mail.token })).mm, athlete.mm);
  assert.equal((await ctx.academy.acceptGuardian(guardian, request({ token: mail.token, accepted: true, policyVersion }))).accepted, true);
});

test('California birthday reads preserve MM and original approval evidence without automatic policy migration', async () => {
  const ctx = context();
  const athlete = await signupVerified(ctx, { email: 'turning18@test.invalid', name: 'Birthday Athlete', birth: '2008-09-23' });
  const guardian = await signupVerified(ctx, { email: 'birthdayguardian@test.invalid', name: 'Birthday Guardian', birth: '1980-01-01', guardian: true });
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const invite = await ctx.academy.inviteGuardian(athlete, request({ email: guardian.email }));
  const mail = await ctx.repo.read(`mail:${invite.mailId}`);
  await ctx.academy.acceptGuardian(guardian, request({ token: mail.token, accepted: true, policyVersion }));
  assert.equal((await ctx.academy.guardians(guardian)).participants.length, 1);
  ctx.setTime('2026-09-23T07:00:00Z');
  const transitioned = (await ctx.academy.getDossier(athlete, { mm: athlete.mm })).dossier;
  assert.equal(transitioned.person.age, 18);
  assert.equal(transitioned.participation.status, 'authorized');
  assert.equal(transitioned.participation.guardianId, guardian.id);
  assert.equal(transitioned.mm, athlete.mm);
  assert.equal((await ctx.academy.guardians(guardian)).participants.length, 0);
  await assert.rejects(ctx.academy.withdraw(guardian, request({ mm: athlete.mm })), /NOT_FOUND/);
  const saved = await ctx.academy.dossier(athlete);
  assert.equal(saved.events.filter(e => e.type === 'adult_transition').length, 0);
  assert.doesNotThrow(() => ctx.academy.participant(saved, athlete, 'bos'));
});

test('guardian acceptance rechecks age inside the atomic write at the California birthday', async () => {
  const ctx = context();
  const athlete = await signupVerified(ctx, { email: 'birthdayrace@test.invalid', name: 'Birthday Race', birth: '2008-09-23' });
  const guardian = await signupVerified(ctx, { email: 'raceguardian@test.invalid', name: 'Race Guardian', birth: '1980-01-01', guardian: true });
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const invite = await ctx.academy.inviteGuardian(athlete, request({ email: guardian.email }));
  const mail = await ctx.repo.read(`mail:${invite.mailId}`);
  assert.equal((await ctx.academy.guardianPreview(guardian, { token: mail.token })).mm, athlete.mm);
  const originalTransact = ctx.repo.transact;
  ctx.repo.transact = (keys, mutation) => {
    if (keys.some(key => key.startsWith('guardian:'))) ctx.setTime('2026-09-23T07:00:00Z');
    return originalTransact(keys, mutation);
  };
  await assert.rejects(ctx.academy.acceptGuardian(guardian, request({ token: mail.token, accepted: true, policyVersion })), /GUARDIAN_INVITATION_INVALID/);
  assert.equal((await ctx.repo.read(`dossier:${athlete.mm}`)).participation.guardianId, undefined);
});

test('former guardian cannot poll the minor dashboard after withdrawal and reassignment', async () => {
  const ctx = context();
  const athlete = await signupVerified(ctx, { email: 'reassigned@test.invalid', name: 'Reassigned Athlete', birth: '2012-01-01' });
  const former = await signupVerified(ctx, { email: 'former@test.invalid', name: 'Former Guardian', birth: '1980-01-01', guardian: true });
  const current = await signupVerified(ctx, { email: 'current@test.invalid', name: 'Current Guardian', birth: '1980-01-01', guardian: true });
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const first = await ctx.academy.inviteGuardian(athlete, request({ email: former.email }));
  await ctx.academy.acceptGuardian(former, request({ token: (await ctx.repo.read(`mail:${first.mailId}`)).token, accepted: true, policyVersion }));
  assert.equal((await ctx.academy.guardians(former)).participants.length, 1);
  await ctx.academy.withdraw(former, request({ mm: athlete.mm }));
  await ctx.academy.acceptParticipation(athlete, request({ accepted: true, policyVersion }));
  const second = await ctx.academy.inviteGuardian(athlete, request({ email: current.email }));
  await ctx.academy.acceptGuardian(current, request({ token: (await ctx.repo.read(`mail:${second.mailId}`)).token, accepted: true, policyVersion }));
  assert.deepEqual((await ctx.academy.guardians(former)).participants, []);
  assert.equal((await ctx.academy.guardians(current)).participants[0].mm, athlete.mm);
});

test('worker safely pauses a now-ineligible under-13 job rather than retrying generation', async () => {
  const records = new Map([
    ['queue:assessments', { jobs: ['underage-job'] }],
    ['job:underage-job', { jobId: 'underage-job', ownerId: 'athlete', status: 'ready' }],
    ['account:athlete', { id: 'athlete', verified: true }],
  ]);
  const repo = { read: async key => records.get(key) ?? null, transact: async (keys, mutation) => {
    const snapshot = Object.fromEntries(keys.map(key => [key, records.get(key) ?? null]));
    const tx = mutation(snapshot);
    for (const [key, value] of Object.entries(tx.writes)) records.set(key, value);
    return tx.result;
  } };
  const denial = Object.assign(new Error('PILOT_13_PLUS'), { code: 'PILOT_13_PLUS' });
  const runtime = { repo, academy: { getJob: async () => { throw denial; }, advance: async () => { throw Error('must not advance'); } } };
  assert.deepEqual(await runAssessmentQueue(runtime), { advanced: 0, waiting: 1 });
  assert.equal(records.get('queue-pause:underage-job').reason, 'PILOT_13_PLUS');
});
