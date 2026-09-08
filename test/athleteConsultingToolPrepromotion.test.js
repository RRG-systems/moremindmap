import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  ATHLETE_CONSULT_DEMO_FIXTURE_IDS_V1,
  createAthleteConsultDemoFixtureV1,
} from '../server/athleteLivingConsultOneShotV1/demoFixtures.js';
import {
  ATHLETE_LIVING_CONSULT_ONE_SHOT_DEMO_POLICY_V1,
  createAthleteLivingConsultOneShotDemoRuntimeV1,
  createAthleteLivingConsultStructuralQaSeamsV1,
} from '../server/athleteLivingConsultOneShotV1/demoRuntime.js';

const rawMikaBos = JSON.parse(fs.readFileSync(
  new URL('../server/athleteLivingConsultOneShotV1/fixtures/mika-bos-v1.json', import.meta.url),
  'utf8',
));

test('the pre-promotion tool exposes exactly two complete and materially different fictional athletes', async () => {
  assert.deepEqual(ATHLETE_CONSULT_DEMO_FIXTURE_IDS_V1, ['mika', 'avery']);
  const fixtures = ATHLETE_CONSULT_DEMO_FIXTURE_IDS_V1.map((id) => createAthleteConsultDemoFixtureV1(id, rawMikaBos));
  assert.deepEqual(fixtures.map((fixture) => fixture.subject.displayName), ['Mika', 'Avery']);
  assert.deepEqual(fixtures.map((fixture) => fixture.subject.sport), ['Soccer', 'Swimming']);
  assert.equal(new Set(fixtures.map((fixture) => fixture.relationshipId)).size, 2);
  assert.equal(new Set(fixtures.map((fixture) => fixture.athleteProfileId)).size, 2);
  for (const fixture of fixtures) {
    assert.equal(fixture.rawBos.surface_packets.length, 15);
    assert.equal(fixture.apaClaims.length, 20);
    assert.ok(fixture.apaOpenEvidence.contradictions.length >= 1);
    assert.ok(fixture.apaOpenEvidence.missing.length >= 1);
    assert.ok(fixture.apaViewModel.destinations.futures.items.length >= 3);
    assert.ok(fixture.plan.intervention);
    assert.ok(fixture.plan.falsifier);
  }
  assert.notEqual(fixtures[0].rawBos.whole_person_model.core_explanation, fixtures[1].rawBos.whole_person_model.core_explanation);
  assert.notEqual(fixtures[0].apaViewModel.layer0.bigPicture, fixtures[1].apaViewModel.layer0.bigPicture);
  assert.doesNotMatch(JSON.stringify(fixtures[1]), /\bMika\b|\bCoach Ellis\b|\bsoccer\b|\brerace/u);

  const structural = createAthleteLivingConsultStructuralQaSeamsV1();
  const runtimes = await Promise.all(ATHLETE_CONSULT_DEMO_FIXTURE_IDS_V1.map((fixture_id) => createAthleteLivingConsultOneShotDemoRuntimeV1({
    fixture_id,
    env: {},
    coach_seam: structural.coach,
    candidate_extractor: structural.candidate,
    close_seam: structural.close,
  })));
  const inspections = runtimes.map((runtime) => runtime.inspect());
  assert.equal(new Set(inspections.map((inspection) => inspection.current_state_hash)).size, 2);
  assert.equal(new Set(inspections.map((inspection) => inspection.personal_rsl.scope_hash)).size, 2);
  assert.equal(new Set(inspections.map((inspection) => inspection.demo_fixture.bos_presentation_projection_hash)).size, 2);
  assert.equal(new Set(inspections.map((inspection) => inspection.demo_fixture.apa_view_model_hash)).size, 2);
});

test('the frozen provider policy is the Subscription-grade Sol/xhigh Responses path', () => {
  assert.deepEqual(ATHLETE_LIVING_CONSULT_ONE_SHOT_DEMO_POLICY_V1, {
    domain: 'ATHLETE',
    age_band: '18–20',
    synthetic_only: true,
    fixed_fixture_created_at: '2026-09-05T22:00:00.000Z',
    provider: 'OpenAI Responses API',
    model: 'gpt-5.6-sol',
    reasoning_effort: 'xhigh',
    store: false,
    background: false,
    web_search: 'AVAILABLE_IN_FOUNDATION_BUT_DEFAULT_OFF_FOR_ONE_SHOT',
    universal_rsl_reads: false,
    universal_promotion: false,
    autonomous_scientific_closed_loop: false,
  });
});

test('the customer surface contains no speaker-selector implementation', () => {
  const app = fs.readFileSync(new URL('../src/athleteLivingConsultOneShotV1/App.jsx', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../src/athleteLivingConsultOneShotV1/styles.css', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /Who is speaking|Who is asking for the change|speaker selector|onSpeaker|setSpeaker|alc-shot-speakers/iu);
  assert.doesNotMatch(css, /alc-shot-speakers/iu);
});
