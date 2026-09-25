import assert from 'node:assert/strict';
import test from 'node:test';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { initial } from '../server/athleteConsultingV2/state.js';
import {
  ATHLETE_VISUAL_EVENTS, ATHLETE_VISUAL_OUTPUT_SCHEMA, buildAthleteVisualWorld,
  validateAthleteVisualPlan, materializeAthleteVisualPlan, createAthleteVisualComposer,
} from '../server/athleteConsultingV2/visual.js';

const scopeId = 'private-darren-synthetic-visual-test';
const sessionId = 'visual-session-2026-09-25';
const triggerRequestId = 'visual-request-2026-09-25';
const baseState = (slug = 'nia') => initial(bundles[slug]);
const worldFor = (event, state = baseState(), slug = 'nia', extras = {}) => buildAthleteVisualWorld({
  event, bundle: bundles[slug], state, scopeId, sessionId, triggerRequestId, ...extras,
});
function candidate(world, { render = true, objects = ['athlete-apa'], evidence = ['athlete-source-apa'],
  blocks = render ? 1 : 0 } = {}) {
  return {
    planVersion: 'athlete-consulting-v2-visual-v1', event: world.event,
    stateBinding: structuredClone(world.stateBinding), renderDecision: { render,
      reason: render ? world.presentationCopy.renderReason : world.presentationCopy.noRenderReason },
    guidance: structuredClone(world.presentationCopy.guidance),
    blocks: Array.from({ length: blocks }, (_, index) => ({
      blockId: `athlete-block-view-${index + 1}`, type: 'PLAIN_LANGUAGE',
      ...world.presentationCopy.blocksByType.PLAIN_LANGUAGE, objectIds: objects, evidenceIds: evidence,
      emphasis: 'normal', reason: world.presentationCopy.blockReason,
    })), interactions: [],
  };
}

test('server-selected visual events are scoped to exact pinned synthetic report source and session', () => {
  assert.deepEqual(ATHLETE_VISUAL_EVENTS, ['SESSION_OPENING', 'COACHING_MOMENT', 'SESSION_FINALIZATION']);
  assert.equal(ATHLETE_VISUAL_OUTPUT_SCHEMA.strict, true);
  const nia = worldFor('SESSION_OPENING');
  const sofia = worldFor('SESSION_OPENING', baseState('sofia'), 'sofia');
  assert.equal(nia.stateBinding.mm, bundles.nia.person.mm);
  assert.equal(nia.stateBinding.bosHash, bundles.nia.bos.artifact_sha256);
  assert.equal(nia.stateBinding.baselineApaHash, bundles.nia.apa.artifact_sha256);
  assert.equal(nia.stateBinding.currentApaHash, bundles.nia.apa.artifact_sha256);
  assert.notEqual(nia.stateBinding.relationshipScopeHash, sofia.stateBinding.relationshipScopeHash);
  assert.deepEqual(nia.truthBoundaries.authority, 'No interaction, customer mutation, message, billing, or external-action authority.');
  assert.throws(() => { nia.stateBinding.mm = sofia.stateBinding.mm; }, TypeError);
  assert.throws(() => worldFor('UNAUTHORIZED_EVENT'), /ATHLETE_VISUAL_EVENT_INVALID/u);
  assert.throws(() => worldFor('SESSION_OPENING', baseState('sofia')), /ATHLETE_VISUAL_SOURCE_SCOPE_DENIED/u);
  assert.throws(() => buildAthleteVisualWorld({ event: 'SESSION_OPENING', bundle: {
    ...bundles.nia, bos: { ...bundles.nia.bos, artifact_sha256: '0'.repeat(64) },
  }, state: baseState(), scopeId, sessionId, triggerRequestId }), /ATHLETE_VISUAL_SOURCE_SCOPE_DENIED/u);
  assert.throws(() => buildAthleteVisualWorld({ event: 'SESSION_OPENING', bundle: {
    ...bundles.nia, bos: { ...bundles.nia.bos, reading: { ...bundles.nia.bos.reading, map_intro: 'Forged' } },
  }, state: baseState(), scopeId, sessionId, triggerRequestId }), /REPORT_INTEGRITY_FAILURE/u);
});

test('opening is mandatory, one block and grounded in same-source objects', () => {
  const world = worldFor('SESSION_OPENING');
  const valid = candidate(world);
  assert.equal(validateAthleteVisualPlan({ candidate: valid, world }).ok, true);
  const reordered = structuredClone(valid);
  reordered.guidance = Object.fromEntries(Object.entries(reordered.guidance).reverse());
  assert.equal(validateAthleteVisualPlan({ candidate: reordered, world }).ok, true);
  assert.equal(materializeAthleteVisualPlan({ candidate: valid, world }).blocks[0].objects[0].id, 'athlete-apa');
  assert.deepEqual(materializeAthleteVisualPlan({ candidate: valid, world }).interactions, []);
  for (const bad of [
    candidate(world, { render: false, blocks: 0 }),
    candidate(world, { blocks: 2 }),
    { ...valid, interactions: ['approve-plan'] },
    { ...valid, stateBinding: { ...valid.stateBinding, mm: bundles.sofia.person.mm } },
    { ...valid, blocks: [null] },
    { ...valid, blocks: [{ ...valid.blocks[0], objectIds: ['sofia-plan'] }] },
    { ...valid, blocks: [{ ...valid.blocks[0], evidenceIds: ['athlete-source-bos'] }] },
  ]) assert.equal(validateAthleteVisualPlan({ candidate: bad, world }).ok, false);
});

test('mid-session normally chooses no visual; a useful visual stays within current governed objects', () => {
  const world = worldFor('COACHING_MOMENT', baseState(), 'nia', { currentExchange: {
    athleteMessage: 'I am not ready to change my plan.', coachMessage: 'That is fine. What matters right now?',
  } });
  assert.equal(world.currentExchange.classification, 'CURRENT_SESSION_EPHEMERAL_NONCANONICAL');
  const noRender = candidate(world, { render: false, blocks: 0 });
  assert.equal(validateAthleteVisualPlan({ candidate: noRender, world }).ok, true);
  assert.equal(validateAthleteVisualPlan({ candidate: candidate(world), world }).ok, true);
  assert.equal(validateAthleteVisualPlan({ candidate: { ...noRender, blocks: candidate(world).blocks }, world }).ok, false);
  assert.throws(() => worldFor('SESSION_OPENING', baseState(), 'nia', { currentExchange: {
    athleteMessage: 'A', coachMessage: 'B',
  } }), /ATHLETE_VISUAL_EXCHANGE_EVENT_DENIED/u);
});

test('mid-session can compare two real APA options without admitting a rejected or invented arm', () => {
  for (const slug of ['nia', 'sofia']) {
    const world = worldFor('COACHING_MOMENT', baseState(slug), slug);
    assert.deepEqual(world.objects.filter((item) => item.kind === 'APA_OPTION').map((item) => item.id),
      ['athlete-option-m1', 'athlete-option-m2', 'athlete-option-m3']);
    assert.equal(world.objects.some((item) => item.id === 'athlete-option-m4'), false);
    const compared = candidate(world, { objects: ['athlete-option-m1', 'athlete-option-m2'],
      evidence: ['athlete-source-apa'] });
    compared.blocks[0].type = 'COMPARISON';
    Object.assign(compared.blocks[0], world.presentationCopy.blocksByType.COMPARISON);
    assert.equal(validateAthleteVisualPlan({ candidate: compared, world }).ok, true);
    const rendered = materializeAthleteVisualPlan({ candidate: compared, world });
    assert.equal(rendered.blocks[0].objects.length, 2);
    assert.equal(rendered.blocks[0].objects[0].statement, bundles[slug].apa.report.candidates[0].action);
    const rejected = structuredClone(compared);
    rejected.blocks[0].objectIds[1] = 'athlete-option-m4';
    assert.equal(validateAthleteVisualPlan({ candidate: rejected, world }).ok, false);
    const invented = structuredClone(compared);
    invented.blocks[0].objectIds[1] = 'athlete-option-imagined';
    assert.equal(validateAthleteVisualPlan({ candidate: invented, world }).ok, false);
  }
});

test('a confirmed correction withholds every prior APA object until exact publication clears review', () => {
  const state = baseState();
  state.apaNeedsReview = true;
  const held = worldFor('COACHING_MOMENT', state);
  assert.equal(held.evidence.some((item) => item.id === 'athlete-source-apa'), false);
  assert.equal(held.objects.some((item) => item.sourceIds.includes('athlete-source-apa')), false);
  assert.equal(held.objects.some((item) => item.id === 'athlete-bos'), true);
  const stale = candidate(held);
  assert.equal(validateAthleteVisualPlan({ candidate: stale, world: held }).ok, false);
  const opening = worldFor('SESSION_OPENING', state);
  assert.equal(validateAthleteVisualPlan({ candidate: candidate(opening, {
    objects: ['athlete-bos'], evidence: ['athlete-source-bos'],
  }), world: opening }).ok, true);
  state.apaNeedsReview = false;
  const published = worldFor('COACHING_MOMENT', state);
  assert.equal(published.objects.some((item) => item.id === 'athlete-apa'), true);
  assert.notEqual(held.stateBinding.triggerHash, published.stateBinding.triggerHash);
});

test('eligible finalization requires exact current recap, cannot claim acceptance or silently alter plan', () => {
  const state = baseState();
  assert.throws(() => worldFor('SESSION_FINALIZATION', state), /ATHLETE_VISUAL_FINALIZATION_NOT_ELIGIBLE/u);
  state.closing = { id: 'closing-review', summary: 'We discussed a possible cue but made no agreement.',
    continuity: 'Ask whether it felt useful next time.' };
  const world = worldFor('SESSION_FINALIZATION', state);
  const final = candidate(world, { objects: ['athlete-session-recap'], evidence: ['athlete-source-session-recap'] });
  assert.equal(validateAthleteVisualPlan({ candidate: final, world }).ok, true);
  assert.equal(materializeAthleteVisualPlan({ candidate: final, world }).blocks[0].objects[0].qualifier,
    state.closing.continuity);
  assert.equal(validateAthleteVisualPlan({ candidate: candidate(world), world }).ok, false);
  const falsePlan = { ...final, guidance: { ...final.guidance, summary: 'Your agreed plan is now saved.' } };
  assert.equal(validateAthleteVisualPlan({ candidate: falsePlan, world }).ok, false);
  assert.equal(state.plan, null);
  const inventedMap = { ...final, guidance: { ...final.guidance, summary: 'Your APA has changed.' } };
  assert.equal(validateAthleteVisualPlan({ candidate: inventedMap, world }).ok, false);
  const fabricatedCoach = { ...final, guidance: { ...final.guidance,
    summary: 'Coach Alex agreed to train you tomorrow.' } };
  assert.deepEqual(validateAthleteVisualPlan({ candidate: fabricatedCoach, world }).errors,
    ['ATHLETE_VISUAL_FREE_TEXT_DENIED']);
  const fabricatedBlock = structuredClone(final);
  fabricatedBlock.blocks[0].subtitle = 'Coach Alex committed to your new plan.';
  assert.deepEqual(validateAthleteVisualPlan({ candidate: fabricatedBlock, world }).errors,
    ['ATHLETE_VISUAL_FREE_TEXT_DENIED']);
});

test('finalization must show each exact saved accepted or proposed plan status', () => {
  const state = baseState();
  state.closing = { id: 'closing-review', summary: 'We discussed the week.',
    continuity: 'Review the options next time.' };
  state.plan = { id: 'accepted-plan', hash: 'a'.repeat(64), title: 'The agreed step',
    why: 'The athlete chose it.', review: 'Next week.',
    accepted_at: '2026-09-25T08:00:00.000Z', approvals: ['athlete'],
    steps: [{ action: 'Try a short cue.', when: 'At practice.', notice: 'Whether it helps.', owner: 'athlete' }] };
  state.draft = { id: 'proposed-plan', hash: 'b'.repeat(64), title: 'A different proposed step',
    why: 'Still to review.', review: 'When ready.', approvals: [],
    steps: [{ action: 'Compare another cue.', when: 'Later.', notice: 'Whether it fits.', owner: 'athlete' }] };
  const world = worldFor('SESSION_FINALIZATION', state);
  const recapOnly = candidate(world, { objects: ['athlete-session-recap'],
    evidence: ['athlete-source-session-recap'] });
  assert.ok(validateAthleteVisualPlan({ candidate: recapOnly, world }).errors
    .includes('ATHLETE_VISUAL_FINAL_PLAN_STATUS_REQUIRED'));
  const acceptedOnly = candidate(world, { objects: ['athlete-session-recap', 'athlete-plan'],
    evidence: ['athlete-source-session-recap', 'athlete-source-plan'] });
  assert.ok(validateAthleteVisualPlan({ candidate: acceptedOnly, world }).errors
    .includes('ATHLETE_VISUAL_FINAL_PLAN_STATUS_REQUIRED'));
  const complete = candidate(world, { objects: ['athlete-session-recap', 'athlete-plan', 'athlete-draft'],
    evidence: ['athlete-source-session-recap', 'athlete-source-plan', 'athlete-source-draft'] });
  assert.equal(validateAthleteVisualPlan({ candidate: complete, world }).ok, true);
  const objects = materializeAthleteVisualPlan({ candidate: complete, world }).blocks[0].objects;
  assert.equal(objects.find(item => item.id === 'athlete-plan').kind, 'ACCEPTED_PLAN');
  assert.equal(objects.find(item => item.id === 'athlete-draft').kind, 'PROPOSED_PLAN');
});

test('unapproved or incomplete plan cannot enter the visual world as an accepted commitment', () => {
  const state = baseState();
  state.plan = { title: 'Maybe', why: 'Maybe', steps: [{ action: 'Try', when: 'Soon', notice: 'Feel', owner: 'athlete' }],
    review: 'Later', approvals: [] };
  assert.throws(() => worldFor('SESSION_OPENING', state), /ATHLETE_VISUAL_PLAN_AUTHORITY_INVALID/u);
});

test('current APA binding rejects a different athlete, tampered baseline or unverified artifact', () => {
  const state = baseState();
  const baselineView = { artifact: bundles.nia.apa, baseline_hash: bundles.nia.apa.artifact_sha256, version: 0 };
  const world = worldFor('SESSION_OPENING', state, 'nia', { currentApa: baselineView });
  assert.equal(world.stateBinding.currentApaVersion, '0');
  assert.equal(world.stateBinding.currentApaHash, bundles.nia.apa.artifact_sha256);
  assert.throws(() => worldFor('SESSION_OPENING', state, 'nia', { currentApa: {
    ...baselineView, artifact: { ...bundles.nia.apa, mm: bundles.sofia.person.mm },
  } }), /ATHLETE_VISUAL_SOURCE_SCOPE_DENIED/u);
  assert.throws(() => worldFor('SESSION_OPENING', state, 'nia', { currentApa: {
    ...baselineView, baseline_hash: bundles.sofia.apa.artifact_sha256,
  } }), /ATHLETE_VISUAL_SOURCE_SCOPE_DENIED/u);
  assert.throws(() => worldFor('SESSION_OPENING', state, 'nia', { currentApa: {
    ...baselineView, artifact: { ...bundles.nia.apa, report: { ...bundles.nia.apa.report, opening: 'Forged' } },
  } }), /ATHLETE_VISUAL_CURRENT_APA_INVALID/u);
});

test('one injected model call records private request/response/receipt before delivering valid plan', async () => {
  const world = worldFor('SESSION_OPENING');
  const expected = candidate(world);
  const events = [];
  let calls = 0;
  const compose = createAthleteVisualComposer({ env: {}, evidenceSink: async (event) => { events.push(event); },
    transport: async (request, options) => {
      calls++;
      assert.deepEqual(events.map((event) => event.kind), ['request']);
      assert.equal(request.model, 'gpt-5.6-sol');
      assert.equal(request.store, false);
      assert.equal(request.background, false);
      assert.deepEqual(request.tools, []);
      assert.equal(options.maxRetries, 0);
      assert.equal(request.text.format, ATHLETE_VISUAL_OUTPUT_SCHEMA);
      return { model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(expected), usage: { input_tokens: 5 } };
    } });
  const result = await compose(world);
  assert.equal(calls, 1);
  assert.deepEqual(events.map((event) => event.kind), ['request', 'response', 'receipt']);
  assert.equal(result.plan.blocks[0].objects[0].id, 'athlete-apa');
  assert.equal(result.receipt.status, 'completed');
  assert.throws(() => { result.plan.blocks[0].objects[0].statement = 'Forged'; }, TypeError);
});

test('invalid first result and provider failure fail closed with no retry or action', async () => {
  const world = worldFor('SESSION_OPENING');
  for (const response of [
    { model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(candidate(world, { render: false, blocks: 0 })) },
    { model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify({ ...candidate(world),
      guidance: { ...candidate(world).guidance, summary: 'Coach Alex agreed to train you tomorrow.' } }) },
    { model: 'wrong-model', status: 'completed', output_text: JSON.stringify(candidate(world)) },
    { model: 'gpt-5.6-sol', status: 'incomplete', output_text: '' },
  ]) {
    const events = [];
    let calls = 0;
    const compose = createAthleteVisualComposer({ env: {}, evidenceSink: async (event) => events.push(event),
      transport: async () => { calls++; return response; } });
    await assert.rejects(compose(world), /^Error: ATHLETE_VISUAL_/u);
    assert.equal(calls, 1);
    assert.deepEqual(events.map((event) => event.kind), ['request', 'response', 'failure']);
  }
  assert.throws(() => createAthleteVisualComposer({ env: {} }), /ATHLETE_VISUAL_PRIVATE_EVIDENCE_SINK_REQUIRED/u);
});

test('missing private evidence at request, response or receipt boundary never delivers a visual', async () => {
  const world = worldFor('SESSION_OPENING');
  for (const failKind of ['request', 'response', 'receipt']) {
    let calls = 0, failed = false;
    const kinds = [];
    const compose = createAthleteVisualComposer({ env: {}, evidenceSink: async (event) => {
      kinds.push(event.kind);
      if (event.kind === failKind && !failed) { failed = true; throw new Error('Private storage unavailable'); }
    }, transport: async () => {
      calls++;
      return { model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(candidate(world)) };
    } });
    await assert.rejects(compose(world), /ATHLETE_VISUAL_EVIDENCE_UNAVAILABLE/u);
    assert.equal(calls, failKind === 'request' ? 0 : 1);
    assert.equal(kinds.at(-1), 'failure');
  }
});
