import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { hasCurrentApaState, hasFlagshipState, coachingWriteHold,
  assertCoachingWritable } from '../server/athleteAcademyV1/coaching/compatibility.js';
import { academyConfig } from '../server/athleteAcademyV1/config.js';
import { buildCanonicalCoachBundle, hash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { initialCoachState } from '../server/athleteAcademyV1/coaching/state.js';
import { createApaContinuityService } from '../server/athleteAcademyV1/coaching/apaContinuity.js';
import { continuityView, apaReadingLabel } from '../src/athleteAcademyV1/coach/currentApaUi.js';

const clone = value => structuredClone(value);
const compatible = () => ({ currentApaEnabled: true, flagshipEnabled: true, coachingWriteHold: false });
const currentMarkers = {
  published: { currentApa: { version: 1 } },
  draft: { apaDraft: { id: 'review-only' } },
  confirmation: { apaConfirmedChanges: [{ id: 'explicit-owner-choice' }] },
  archived: { apaSourceArchive: [{ sourceBinding: 'preserved' }] },
};
const flagshipMarkers = {
  contract: { rslLedgerContract: 'athlete_academy_rsl_ledger_v1' },
  event: { rslEvents: [{ event_id: 'owner-statement' }] },
  review: { apaReviewRequirements: [{ event_id: 'explicit-correction' }] },
  archived: { rslSourceArchive: [{ events: [] }] },
  start: { sessionStartMap: { sessionId: 'preserved-session' } },
  pending: { pendingAttempt: { id: 'unresolved', flagship: { contract: 'athlete_academy_flagship_attempt_v1' } } },
  visual: { visuals: [{ id: 'saved-reveal' }] },
};

for (const [label, state] of Object.entries(currentMarkers)) {
  test(`current APA ${label} survives a flag downgrade as a pure automatic read hold`, () => {
    const original = clone(state), config = { ...compatible(), currentApaEnabled: false, flagshipEnabled: false };
    assert.equal(hasCurrentApaState(state), true); assert.equal(hasFlagshipState(state), false);
    assert.deepEqual(coachingWriteHold(config, state), {
      contract: 'athlete_academy_coaching_read_hold_v1', active: true,
      reason: 'CURRENT_APA_STATE_REQUIRES_COMPATIBLE_BUILD', evolved_state_preserved: true,
      provider_or_mutation_admitted: false,
    });
    assert.throws(() => assertCoachingWritable(config, state), { code: 'COACHING_COMPATIBILITY_READ_ONLY', status: 503 });
    assert.deepEqual(state, original);
    assert.equal(coachingWriteHold(compatible(), state), null);
    assert.doesNotThrow(() => assertCoachingWritable(compatible(), state));
    assert.deepEqual(state, original);
  });
}

for (const [label, state] of Object.entries(flagshipMarkers)) {
  test(`flagship ${label} never falls back to an older writable service after downgrade`, () => {
    const original = clone(state), config = { ...compatible(), flagshipEnabled: false };
    assert.equal(hasFlagshipState(state), true);
    assert.equal(coachingWriteHold(config, state).reason, 'FLAGSHIP_STATE_REQUIRES_COMPATIBLE_BUILD');
    assert.throws(() => assertCoachingWritable(config, state), { code: 'COACHING_COMPATIBILITY_READ_ONLY', status: 503 });
    assert.deepEqual(state, original);
    assert.equal(coachingWriteHold(compatible(), state), null);
    assert.deepEqual(state, original);
  });
}

test('operator hold takes precedence and is not inferred from a caller-supplied surface field', () => {
  const state = { ...currentMarkers.published, ...flagshipMarkers.event };
  const config = { currentApaEnabled: false, flagshipEnabled: false, coachingWriteHold: true };
  assert.equal(coachingWriteHold(config, state).reason, 'OPERATOR_READ_HOLD');
  assert.equal(coachingWriteHold(compatible(), { coaching_write_hold: { active: true } }), null);
  assert.deepEqual(state, { ...currentMarkers.published, ...flagshipMarkers.event });
});

test('pristine baseline does not acquire a false evolved-state marker or broader authority', () => {
  const state = { currentApa: null, apaDraft: null, apaConfirmedChanges: [], apaSourceArchive: [],
    rslEvents: [], apaReviewRequirements: [], rslSourceArchive: [], sessionStartMap: null,
    pendingAttempt: null, visuals: [], plan: { id: 'prior-owner-plan' }, learning: [{ id: 'prior-owner-learning' }] };
  assert.equal(hasCurrentApaState(state), false); assert.equal(hasFlagshipState(state), false);
  assert.equal(coachingWriteHold({}, state), null);
  assert.equal(coachingWriteHold({ coachingWriteHold: true }, state).reason, 'OPERATOR_READ_HOLD');
  assert.deepEqual(state.plan, { id: 'prior-owner-plan' });
  assert.deepEqual(state.learning, [{ id: 'prior-owner-learning' }]);
});

test('read hold configuration is exact server-side opt-in, never a truthy string or client claim', () => {
  for (const value of [undefined, '', '0', 'true', 'yes', true, 1])
    assert.equal(academyConfig({ ATHLETE_ACADEMY_COACHING_WRITE_HOLD: value }).coachingWriteHold, false);
  assert.equal(academyConfig({ ATHLETE_ACADEMY_COACHING_WRITE_HOLD: '1' }).coachingWriteHold, true);
  const config = academyConfig({});
  assert.equal(config.currentApaEnabled, false); assert.equal(config.flagshipEnabled, false);
  assert.equal(config.coachingWriteHold, false);
});

function fixture() {
  const actorId = 'fictional-compatibility-owner', mm = 'MM-FICTIONAL-COMPATIBILITY';
  const replace = value => JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm, mm).replaceAll('Nia', 'Mira Compatibility'));
  const bos = replace(nia.bos), apa = replace(nia.apa), bosInput = replace(nia.bos_source);
  bos.mm = mm; bos.synthetic = false; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = false; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { actorId, mm, name: 'Mira Compatibility', age: 18, sport: 'Volleyball', synthetic: false };
  bosInput.person = { ...bosInput.person, ...person };
  const account = { id: actorId, verified: true, sessionVersion: 1 };
  const principalFor = a => ({ authenticated: true, actorId: a.id, subjectActorId: a.id, mm, role: 'athlete',
    grants: { reportsRead: true, coachingRead: true, participation: true } });
  const bundle = buildCanonicalCoachBundle({ person, bos, apa, bosInput }, principalFor(account));
  const state = initialCoachState(bundle);
  const service = createApaContinuityService({ config: {}, now: () => Date.parse('2026-09-27T18:00:00.000Z'),
    principalFor, initialState: initialCoachState,
    repo: { transact() { assert.fail('Pure read projection must not access storage'); } },
    academy: { participant() { assert.fail('Pure read projection must not manufacture mutation authority'); } },
    bundleFor() { assert.fail('Pure read projection uses its exact supplied canonical bundle'); },
    transport() { assert.fail('Compatibility projection must never invoke a provider'); } });
  return { bundle, account, state, service };
}

test('flagship downgrade retains the owner baseline reader without relabeling it as a published current APA', () => {
  const f = fixture(); f.state.rslLedgerContract = 'athlete_academy_rsl_ledger_v1';
  const before = clone(f.state);
  const exposed = f.service.exposed(f.state, f.bundle, f.account);
  assert.equal(exposed.capabilities.currentApa, true);
  assert.equal(exposed.coaching_write_hold.active, true);
  assert.equal(exposed.continuity.current_version, 0); assert.equal(exposed.continuity.current, null);
  const view = continuityView(f.bundle, exposed);
  assert.equal(view.verified, true); assert.equal(view.actionAllowed, false);
  assert.equal(apaReadingLabel(view), 'Original APA · no published update');
  assert.deepEqual(exposed.continuity.original, f.bundle.apa);
  assert.deepEqual(f.service.currentArtifact(f.state, f.bundle, f.account), f.bundle.apa);
  assert.deepEqual(f.state, before);
});

test('downgrade does not turn an invalid evolved current record into a successful baseline fallback', () => {
  const f = fixture(); f.state.currentApa = { version: 1, artifact: { actorId: 'foreign', mm: f.bundle.person.mm } };
  const before = clone(f.state);
  assert.throws(() => f.service.currentArtifact(f.state, f.bundle, f.account));
  assert.throws(() => f.service.exposed(f.state, f.bundle, f.account));
  assert.deepEqual(f.state, before);
});

test('retained reader preserves exact account/report fences rather than broadening authority during hold', () => {
  const f = fixture(); f.state.rslLedgerContract = 'athlete_academy_rsl_ledger_v1';
  assert.throws(() => f.service.currentArtifact(f.state, f.bundle, { ...f.account, id: 'foreign-account' }),
    /COACH_ACTOR_AUTHORITY_DENIED/u);
  const changed = clone(f.bundle); changed.binding.bos = '0'.repeat(64);
  assert.throws(() => f.service.currentArtifact(f.state, changed, f.account), /COACH_REPORT_SOURCE_MISMATCH/u);
});

test('source-pair drift remains stale and cannot label new baseline as verified historical current guidance', () => {
  const f = fixture(); f.state.rslLedgerContract = 'athlete_academy_rsl_ledger_v1';
  f.state.sourceBinding.bos = '0'.repeat(64);
  const before = clone(f.state), exposed = f.service.exposed(f.state, f.bundle, f.account);
  assert.equal(exposed.continuity.stale, true); assert.equal(exposed.apaNeedsReview, true);
  const view = continuityView(f.bundle, exposed);
  assert.equal(view.verified, false); assert.equal(view.actionAllowed, false);
  assert.equal(apaReadingLabel(view), 'Last verified APA · currency unconfirmed');
  assert.deepEqual(f.state, before);
});
