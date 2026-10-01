import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { youthIntakeGate } from '../src/athleteAcademyV1/participationGate.js';
import { latestBirthDate } from '../src/athleteAcademyV1/californiaAge.js';

test('California date-picker age limit respects midnight and leap-day boundaries', () => {
  assert.equal(latestBirthDate(13, Date.parse('2026-09-30T06:59:00Z')), '2013-09-29');
  assert.equal(latestBirthDate(13, Date.parse('2026-09-30T07:00:00Z')), '2013-09-30');
  assert.equal(latestBirthDate(18, Date.parse('2028-02-29T20:00:00Z')), '2010-02-28');
  assert.equal(latestBirthDate(13, Date.parse('2028-02-29T20:00:00Z')), '2015-02-28');
});

const policyVersion = 'candidate-review-v1';
const dossier = age => ({ person: { age }, entitlements: { bos: true, apa: true },
  participation: { status: 'guardian_required', athleteAccepted: false,
    policyVersion, guardianId: null, guardianPolicyVersion: null } });

test('all ages 13–17 stay closed until current guardian approval', () => {
  for (const age of [13, 14, 15, 16, 17]) {
    const d = dossier(age);
    assert.equal(youthIntakeGate(d, policyVersion), 'review');
    d.participation.athleteAccepted = true;
    assert.equal(youthIntakeGate(d, policyVersion), 'guardian');
    d.participation.status = 'authorized';
    d.participation.guardianId = `fictional-guardian-${age}`;
    d.participation.guardianPolicyVersion = policyVersion;
    assert.equal(youthIntakeGate(d, policyVersion, 'bos'), null);
    assert.equal(youthIntakeGate(d, policyVersion, 'apa'), null);
    assert.equal(youthIntakeGate(d, 'new-policy-version'), 'review');
    d.participation.status = 'withdrawn';
    assert.equal(youthIntakeGate(d, policyVersion), 'withdrawn');
  }
});

test('missing academy entitlement stays closed while adult routes are unchanged', () => {
  assert.equal(youthIntakeGate(dossier(12), policyVersion), 'age');
  const youth = dossier(13);
  youth.entitlements.bos = false;
  assert.equal(youthIntakeGate(youth, policyVersion), 'academy');
  const adult = dossier(18);
  assert.equal(youthIntakeGate(adult, policyVersion), null);
});

test('workspace tests the youth route gate before rendering private intake and progress', async () => {
  const source = await readFile(new URL('../src/athleteAcademyV1/App.jsx', import.meta.url), 'utf8');
  const gate = source.indexOf('else if(youthPrivateGate)content=');
  assert.ok(gate > 0);
  assert.ok(gate < source.indexOf("else if(['bos','apa'].includes(page)&&d)content="));
  assert.ok(gate < source.indexOf("else if(page==='progress'&&job)content="));
  assert.match(source, /route\(\)==='progress'&&!youthHeld&&!youthGate/);
});
