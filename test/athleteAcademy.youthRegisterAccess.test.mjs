import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createAuth } from '../server/athleteAcademyV1/auth.js';
import { academyConfig } from '../server/athleteAcademyV1/config.js';
import { createAcademyHandler } from '../server/athleteAcademyV1/handler.js';
import { createYouthApprovalRegisterReader, YOUTH_REGISTER_INDEX, registerYouth } from '../server/athleteAcademyV1/youthApprovalRegister.js';
import { ALL_REGISTERED_YOUTH, parseYouthRegisterBinding, createYouthRegisterAuthorizer,
  revokeYouthRegisterAssignment, youthStaffGrantKey } from '../server/athleteAcademyV1/youthRegisterAccess.js';

const at = Date.parse('2026-10-04T09:00:00Z');
function fixture() {
  let clock = at;
  const records = new Map(), reads = [];
  const repo = {
    read: async key => { reads.push(key); return structuredClone(records.get(key) ?? null); },
    putImmutable: async (key, value) => { assert.equal(records.has(key), false); records.set(key, structuredClone(value)); },
    transact: async (keys, mutation) => {
      reads.push(...keys);
      const tx = await mutation(Object.fromEntries(keys.map(key => [key, structuredClone(records.get(key) ?? null)])));
      for (const [key, value] of Object.entries(tx.writes)) { assert.ok(keys.includes(key)); records.set(key, structuredClone(value)); }
      return structuredClone(tx.result);
    },
  };
  const actor = { id: randomUUID(), verified: true, role: 'guardian', region: 'US-CA', displayName: 'Fictional Assigned Adult',
    dateOfBirth: '1980-01-01', email: 'assigned-staff@test.invalid', securityVersion: 1, sessionVersion: 1 };
  const binding = { actorId: actor.id, assignmentId: randomUUID(), securityVersion: 1, startsAt: at - 1000,
    expiresAt: at + 86400000, permission: 'youth_approval_register_read', scope: 'california_youth',
    subjectMms: ALL_REGISTERED_YOUTH, authorityReceipt: 'fictional:reviewed-staff-assignment-v1' };
  const config = academyConfig({ ATHLETE_ACADEMY_ENABLED: '1', ATHLETE_ACADEMY_ORIGIN: 'https://candidate.invalid',
    ATHLETE_ACADEMY_REAL_YOUTH_ENABLED: '1', ATHLETE_ACADEMY_REVIEWED_YOUTH_POLICY_VERSION: 'reviewed-youth-v1',
    ATHLETE_ACADEMY_YOUTH_REGISTER_STAFF_BINDING: JSON.stringify(binding) });
  records.set(`account:${actor.id}`, structuredClone(actor));
  for (const [mm, birthDate] of [['MM-20261004-AAAAAAAA', '2013-01-01'], ['MM-20261004-BBBBBBBB', '2009-01-01']]) {
    const dossier = { mm, ownerId: randomUUID(), person: { name: 'Fictional Youth', dateOfBirth: birthDate, region: 'US-CA' },
      createdAt: at, memberships: [], participation: { status: 'guardian_required', policyVersion: 'reviewed-youth-v1' },
      reports: { bos: { original: true }, apa: { original: true } }, intake: { private: 'never-project' } };
    registerYouth(dossier, at); records.set(`dossier:${mm}`, dossier);
  }
  records.set(YOUTH_REGISTER_INDEX, { schemaVersion: 1, mms: ['MM-20261004-AAAAAAAA', 'MM-20261004-BBBBBBBB'] });
  const now = () => clock, authorize = createYouthRegisterAuthorizer({ repo, config, now });
  const reader = createYouthApprovalRegisterReader({ repo, config, authorize, now });
  const auth = createAuth({ repo, config, now });
  const handler = createAcademyHandler({ config, auth, academy: {}, coaching: {}, deliver: async () => assert.fail('mail forbidden'),
    youthRegister: reader, authorizeYouthRegister: authorize });
  return { records, reads, repo, actor, binding, config, authorize, reader, auth, handler, time: value => { clock = value; } };
}
const youthReads = f => f.reads.filter(key => key === YOUTH_REGISTER_INDEX || key.startsWith('dossier:'));

test('staff assignment is absent by default; malformed or overbroad deployment metadata fails closed', () => {
  assert.equal(parseYouthRegisterBinding(undefined), null);
  const f = fixture();
  for (const patch of [{ actorId: 'DarrenDemo' }, { permission: '*' }, { scope: 'all' }, { subjectMms: [] },
    { expiresAt: at + 100 * 86400000 }, { authorityReceipt: '' }, { browserRole: 'staff' }])
    assert.throws(() => parseYouthRegisterBinding(JSON.stringify({ ...f.binding, ...patch })), /YOUTH_REGISTER_BINDING_INVALID/);
});

test('NEW binding provisions only the verified assigned adult and preserves original dossiers', async () => {
  const f = fixture(), before = JSON.stringify([...f.records].filter(([k]) => k.startsWith('dossier:')));
  const result = await f.reader(f.actor);
  assert.deepEqual(result.rows.map(r => r.currentAgeBand), ['13-16', '17']);
  assert.equal(result.rows.every(r => r.independentlyVerified === false), true);
  const grant = f.records.get(youthStaffGrantKey(f.actor.id));
  assert.equal(grant.assignments.length, 1); assert.equal(grant.currentAssignmentId, f.binding.assignmentId);
  assert.equal(JSON.stringify([...f.records].filter(([k]) => k.startsWith('dossier:'))), before);
  assert.equal(JSON.stringify(result).includes('never-project'), false);
  assert.equal(JSON.stringify(result).includes('termsHash'), false);
});

test('browser-supplied staff flags, demo codes, another actor and unverified principals never read youth', async () => {
  const f = fixture();
  for (const actor of [null, { ...f.actor, id: randomUUID(), authenticated: true, role: 'staff', code: 'DarrenDemo' },
    { ...f.actor, verified: false }, { ...f.actor, id: randomUUID(), permission: 'youth_approval_register_read' }])
    await assert.rejects(f.reader(actor), /YOUTH_REGISTER_READ_DENIED/);
  assert.deepEqual(youthReads(f), []);
});

test('fresh account verification, session revocation, security revision, adult age and California scope precede youth reads', async () => {
  for (const patch of [{ verified: false }, { sessionVersion: 2 }, { securityVersion: 2 }, { role: 'staff' },
    { dateOfBirth: '2009-01-01' }, { region: 'US-AZ' }, { id: randomUUID() }]) {
    const f = fixture(); f.records.set(`account:${f.actor.id}`, { ...f.actor, ...patch });
    await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/); assert.deepEqual(youthReads(f), []);
  }
});

test('future and expired assignments fail without reading the youth index or dossiers', async () => {
  for (const when of [at - 2000, at + 86400000]) {
    const f = fixture(); f.time(when);
    await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/); assert.deepEqual(youthReads(f), []);
  }
});

test('durable revocation is idempotent and a previous deployment cannot resurrect the same assignment', async () => {
  const f = fixture(); await f.reader(f.actor);
  const revoke = { repo: f.repo, actorId: f.actor.id, assignmentId: f.binding.assignmentId, at,
    authorityReceipt: 'fictional:reviewed-revocation-v1' };
  await revokeYouthRegisterAssignment(revoke); await revokeYouthRegisterAssignment(revoke); f.reads.length = 0;
  await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/); assert.deepEqual(youthReads(f), []);
  assert.equal(f.records.get(youthStaffGrantKey(f.actor.id)).assignments.length, 1);
});

test('new assignment retains history, replaces the prior grant and prevents old-assignment rollback', async () => {
  const f = fixture(); await f.reader(f.actor); const original = f.config.youthRegisterBinding;
  f.config.youthRegisterBinding = parseYouthRegisterBinding(JSON.stringify({ ...f.binding, assignmentId: randomUUID(), startsAt: at - 500 }));
  await f.reader(f.actor); const saved = f.records.get(youthStaffGrantKey(f.actor.id));
  assert.equal(saved.assignments[0].status, 'replaced'); assert.equal(saved.assignments.length, 2);
  f.config.youthRegisterBinding = original; f.reads.length = 0;
  await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/); assert.deepEqual(youthReads(f), []);
});

test('first use of an older or same-epoch deployment cannot replace a newer durable grant', async () => {
  for (const startsAt of [at - 1000, at - 500]) {
    const f = fixture();
    f.config.youthRegisterBinding = parseYouthRegisterBinding(JSON.stringify({ ...f.binding, startsAt: at - 500 }));
    await f.reader(f.actor);
    const before = structuredClone(f.records.get(youthStaffGrantKey(f.actor.id)));
    f.config.youthRegisterBinding = parseYouthRegisterBinding(JSON.stringify({ ...f.binding, startsAt, assignmentId: randomUUID() }));
    f.reads.length = 0;
    await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/);
    assert.deepEqual(youthReads(f), []);
    assert.deepEqual(f.records.get(youthStaffGrantKey(f.actor.id)), before);
  }
});

test('same assignment ID cannot silently widen its terms', async () => {
  const f = fixture(); f.config.youthRegisterBinding = parseYouthRegisterBinding(JSON.stringify({ ...f.binding,
    subjectMms: ['MM-20261004-AAAAAAAA'] }));
  await f.reader(f.actor); f.config.youthRegisterBinding = parseYouthRegisterBinding(JSON.stringify(f.binding));
  f.reads.length = 0; await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/); assert.deepEqual(youthReads(f), []);
});

test('an exact athlete assignment neither reads another dossier nor exposes global counts', async () => {
  const f = fixture(); f.config.youthRegisterBinding = parseYouthRegisterBinding(JSON.stringify({ ...f.binding,
    subjectMms: ['MM-20261004-AAAAAAAA'] }));
  const result = await f.reader(f.actor);
  assert.equal(result.indexedCount, 1); assert.equal(result.rows.length, 1);
  assert.equal(f.reads.includes('dossier:MM-20261004-BBBBBBBB'), false);
});

test('expiry during the read prevents output even after an initially current grant', async () => {
  const f = fixture(), originalRead = f.repo.read;
  f.repo.read = async key => { const result = await originalRead(key); if (key.startsWith('dossier:')) f.time(at + 86400000); return result; };
  await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/);
});

test('revocation during the read prevents output', async () => {
  const f = fixture(), originalRead = f.repo.read; let revoked = false;
  f.repo.read = async key => { const result = await originalRead(key); if (key.startsWith('dossier:') && !revoked) {
    revoked = true; await revokeYouthRegisterAssignment({ repo: f.repo, actorId: f.actor.id, assignmentId: f.binding.assignmentId,
      at, authorityReceipt: 'fictional:concurrent-revocation-v1' });
  } return result; };
  await assert.rejects(f.reader(f.actor), /YOUTH_REGISTER_READ_DENIED/);
});

async function post(f, patch = {}, body = { action: 'youth_approval_register' }) {
  const session = await f.auth.createSession(f.actor), headers = { cookie: `more_athlete_academy=${session.raw}`,
    origin: f.config.origin, 'content-type': 'application/json', 'x-csrf-token': session.session.csrf, 'sec-fetch-site': 'same-origin',
    ...patch };
  const response = { headers: {}, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; },
    json(result) { this.result = result; return this; } };
  f.reads.length = 0; await f.handler({ method: 'POST', headers, body, socket: { remoteAddress: 'fictional-address' } }, response);
  return response;
}

test('existing authenticated Academy route serves only the minimal register and applies private headers', async () => {
  const f = fixture(), r = await post(f);
  assert.equal(r.statusCode, 200); assert.equal(r.result.youthApprovalRegister.rows.length, 2);
  assert.equal(r.headers['Cache-Control'], 'no-store, private'); assert.equal(r.headers.Vary, 'Cookie');
  assert.equal(r.headers['Referrer-Policy'], 'no-referrer'); assert.equal(Object.hasOwn(r.result, 'account'), false);
  assert.equal(JSON.stringify(r.result).includes('assigned-staff@test.invalid'), false);
});

test('CSRF mismatch, cross-origin, cross-site and anonymous requests deny before youth reads', async () => {
  for (const patch of [{ 'x-csrf-token': 'wrong' }, { origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { cookie: '' }]) {
    const f = fixture(), r = await post(f, patch);
    assert.equal(r.statusCode, 403); assert.equal(r.result.ok, false); assert.deepEqual(youthReads(f), []);
  }
});

test('client scope override and public assignment/revocation actions are unavailable', async () => {
  const f = fixture();
  const denied = await post(f, {}, { action: 'youth_approval_register', scope: 'all', actorId: f.actor.id });
  assert.equal(denied.statusCode, 422); assert.deepEqual(youthReads(f), []);
  for (const action of ['youth_staff_assign', 'youth_staff_revoke', 'youth_register_export']) {
    const r = await post(f, {}, { action }); assert.equal(r.statusCode, 404); assert.equal(r.result.error.code, 'ACTION_NOT_FOUND');
  }
});

test('bootstrap advertises staff capability only after current server authorization, without reading youth records', async () => {
  for (const enabled of [true, false]) {
    const f = fixture(), session = await f.auth.createSession(f.actor);
    if (!enabled) f.config.youthRegisterBinding = null;
    const response = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(result) { this.result = result; return this; } };
    f.reads.length = 0;
    await f.handler({ method: 'GET', headers: { cookie: `more_athlete_academy=${session.raw}`, 'sec-fetch-site': 'same-origin' } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.result.capabilities.youthApprovalRegister, enabled ? true : undefined);
    assert.deepEqual(youthReads(f), []);
    assert.equal(JSON.stringify(response.result).includes(f.binding.assignmentId), false);
  }
});

test('a normal sign-in session expires at its exact expiry boundary', async () => {
  const f = fixture(), created = await f.auth.createSession(f.actor);
  f.time(created.session.expiresAt);
  assert.equal(await f.auth.session(created.raw), null);
});
