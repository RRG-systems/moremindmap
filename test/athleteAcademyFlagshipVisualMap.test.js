import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { initial } from '../server/athleteConsultingV2/state.js';
import { hash, buildCanonicalCoachBundle } from '../server/athleteAcademyV1/coaching/bundle.js';
import { initialCoachState, applyActorAction } from '../server/athleteAcademyV1/coaching/state.js';
import { createMainCurrentApaAdapter } from '../server/athleteAcademyV1/coaching/currentApa.js';
import { currentApaHash } from '../server/athleteApa/currentApaCore.js';
import { createMainMapChangeAdapter, MAIN_SESSION_MAP_START_CONTRACT,
  MAIN_SESSION_MAP_CHANGE_CONTRACT, mainMapClassification } from '../server/athleteAcademyV1/coaching/mapChange.js';
import { createMainVisualAdapter, MAIN_VISUAL_PLAN_VERSION,
  MAIN_VISUAL_WORLD_CONTRACT } from '../server/athleteAcademyV1/coaching/visual.js';
import { buildAthleteVisualWorld as demoWorld } from '../server/athleteConsultingV2/visual.js';
import { captureSessionStartMap as demoStart } from '../server/athleteConsultingV2/mapChange.js';

const clone = value => structuredClone(value);
const at = '2026-09-27T18:01:00.000Z';
const messageId = '11111111-1111-4111-8111-111111111111';
const changeId = '22222222-2222-4222-8222-222222222222';
const sessionId = '77777777-7777-4777-8777-777777777777';

// Offline structural replay only. This fictional canonical-shaped owner has an
// independently named account/MM and freshly checked report pair, not fixture
// identity or evidence of real account/model/browser acceptance.
function fixture({ synthetic = false, label = 'alpha' } = {}) {
  const actorId = `fictional-visual-owner-${label}`, mm = `MM-FICTIONAL-VISUAL-${label.toUpperCase()}`;
  const replace = value => JSON.parse(JSON.stringify(value).replaceAll(nia.person.mm, mm)
    .replaceAll('Nia', `Mira ${label}`));
  const bos = replace(nia.bos), apa = replace(nia.apa), bosInput = replace(nia.bos_source);
  bos.mm = mm; bos.synthetic = synthetic; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = synthetic; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { actorId, mm, name: `Mira ${label}`, age: 18, sport: 'Volleyball', synthetic };
  bosInput.person = { ...bosInput.person, ...person };
  const principal = { authenticated: true, actorId, subjectActorId: actorId, mm, role: 'athlete',
    grants: { reportsRead: true, coachingRead: true, participation: true } };
  const bundle = buildCanonicalCoachBundle({ person, bos, apa, bosInput }, principal);
  let state = initialCoachState(bundle); state.sessionId = sessionId;
  const authority = Object.freeze({ fixtureFence: true });
  let allowed = true;
  const assertFencedAuthority = input => allowed && input.authority === authority
    && input.bundle === bundle && input.principal.actorId === actorId
    && input.state.mm === mm && hash(input.state.sourceBinding) === hash(bundle.binding);
  const current = createMainCurrentApaAdapter({ assertFencedAuthority });
  const maps = createMainMapChangeAdapter({ assertFencedAuthority, currentApaAdapter: current });
  const visuals = createMainVisualAdapter({ assertFencedAuthority, currentApaAdapter: current, mapChangeAdapter: maps });
  const input = extras => ({ bundle, principal, state, authority, ...extras });
  const world = (event = 'SESSION_OPENING', extras = {}) => visuals.buildAthleteVisualWorld(input({
    event, scopeId: `private-account:${actorId}`, sessionId: state.sessionId,
    triggerRequestId: 'fictional-visual-trigger', ...extras }));
  return { bundle, principal, current, maps, visuals, input, world,
    get state() { return state; }, setState(next) { state = JSON.parse(JSON.stringify(next)); }, revoke() { allowed = false; } };
}
function candidate(world, { ids = ['athlete-bos'], render = true, blocks = 1 } = {}) {
  return { planVersion: MAIN_VISUAL_PLAN_VERSION, event: world.event, stateBinding: clone(world.stateBinding),
    renderDecision: { render, reason: render ? world.presentationCopy.renderReason : world.presentationCopy.noRenderReason },
    guidance: clone(world.presentationCopy.guidance),
    blocks: render ? Array.from({ length: blocks }, (_, index) => ({ blockId: `athlete-block-replay-${index}`,
      type: 'PLAIN_LANGUAGE', ...world.presentationCopy.blocksByType.PLAIN_LANGUAGE,
      objectIds: ids, evidenceIds: [], emphasis: 'normal', reason: world.presentationCopy.blockReason })) : [],
    interactions: [] };
}
function publish(f) {
  const text = 'My Tuesday practice is shorter now.';
  f.state.messages.push({ id: messageId, role: 'user', speaker: 'athlete', actorId: f.principal.actorId,
    text, at: '2026-09-27T18:00:00.000Z' });
  const prior = f.current.currentApaView(f.input({ record: f.state.currentApa }));
  const proposed = { confirmation: clone(prior.artifact.confirmation), report: clone(prior.artifact.report), narrative_updates: [] };
  const source = `APA:ACADEMY:${f.bundle.binding.actorId}:${changeId}`;
  proposed.report.domains[1].gap = 'Tuesday practice is shorter, leaving less time for a calm passing cue.';
  proposed.report.domains[1].refs.push(source);
  const result = f.current.publishCurrentApa(f.input({ record: f.state.currentApa, expectedVersion: prior.version,
    candidate: proposed, confirmedChange: { actorId: f.principal.actorId, mm: f.bundle.person.mm,
      id: changeId, source_message_id: messageId, confirmed: true, confirmed_by: 'athlete', kind: 'reality',
      supersedes: [], reason: 'The fictional owner reviewed the exact saved message.', confirmed_at: at } }));
  f.state.currentApa = result.record; f.state.revision++;
  return result;
}
const body = { title: 'Try one calm cue', why: 'The owner explicitly chose it.', review: 'After practice',
  steps: [{ action: 'Try one calm cue', when: 'Tuesday practice', notice: 'Whether it helps', owner: 'athlete' }] };
function accept(f) {
  const drafted = applyActorAction(f.state, { action: 'draft', plan: body }, f.bundle, f.principal);
  f.setState(applyActorAction(drafted, { action: 'approve', id: drafted.draft.id, hash: drafted.draft.hash }, f.bundle, f.principal));
}
async function composed(f, world = f.world(), options = {}) {
  const events = [], calls = { count: 0 };
  const compose = f.visuals.createAthleteVisualComposer({ env: {}, evidenceSink: async event => {
    events.push(event);
    if (options.failKind === event.kind) throw new Error('Fictional evidence failure');
  }, transport: async request => {
    calls.count++;
    assert.equal(Object.isFrozen(request), true);
    assert.equal(Object.isFrozen(request.text.format.schema.properties.stateBinding), true);
    return { model: 'gpt-5.6-sol', status: 'completed', output_text: JSON.stringify(options.candidate || candidate(world)),
      usage: { input_tokens: 1, output_tokens: 1 } };
  } });
  return { events, calls, run: () => compose(world) };
}

test('main account map/world contracts bind actual account MM and exact report pair without fixture labels', () => {
  const f = fixture(), before = hash(f.state), start = f.maps.captureSessionStartMap(f.input());
  assert.equal(start.contract, MAIN_SESSION_MAP_START_CONTRACT);
  assert.equal(start.binding.actorId, f.principal.actorId);
  assert.equal(Object.hasOwn(start.binding, 'slug'), false);
  const map = f.maps.buildSessionMapChange(f.input({ startMap: start }));
  assert.equal(map.contract, MAIN_SESSION_MAP_CHANGE_CONTRACT);
  assert.deepEqual(map.unchanged, { saved_apa: true, accepted_plan: true });
  const world = f.world();
  assert.equal(world.contract, MAIN_VISUAL_WORLD_CONTRACT);
  assert.equal(world.stateBinding.actorId, f.principal.actorId);
  assert.equal(world.stateBinding.currentApaHash, f.bundle.apa.artifact_sha256);
  assert.equal(world.stateBinding.currentApaVersion, '0');
  assert.equal(world.evidence.every(item => item.classification.startsWith('PRIVATE_AUTHENTICATED_')), true);
  assert.equal(hash(f.state), before);
  assert.throws(() => { world.objects[0].statement = 'Forgery'; }, TypeError);
});

test('synthetic classification is explicit but never substitutes for main authenticated ownership', () => {
  const realShaped = fixture(), synthetic = fixture({ synthetic: true });
  assert.equal(synthetic.world().evidence.every(item => item.classification.startsWith('AUTHENTICATED_SYNTHETIC_')), true);
  assert.equal(realShaped.world().evidence.every(item => !item.classification.startsWith('SYNTHETIC_')), true);
  assert.equal(mainMapClassification('BASELINE', { ...realShaped.bundle,
    bos: { ...realShaped.bundle.bos, synthetic: true } }), 'AUTHENTICATED_SYNTHETIC_BASELINE');
  assert.throws(() => synthetic.world('SESSION_OPENING', { principal: { ...synthetic.principal, authenticated: false } }), /COACH_ACTOR_AUTHORITY_DENIED/u);
  assert.throws(() => realShaped.world('SESSION_OPENING', { bundle: bundles.nia }), /MAIN_MAP_CANONICAL_SOURCE_REQUIRED|COACH_CANONICAL_PAIR_REQUIRED/u);
});

test('both main factories fail closed without explicit service-owned synchronous fencing', () => {
  const f = fixture();
  assert.throws(() => createMainMapChangeAdapter(), /MAIN_MAP_FENCE_REQUIRED/u);
  assert.throws(() => createMainVisualAdapter(), /MAIN_VISUAL_FENCE_REQUIRED/u);
  for (const result of [false, null, undefined, Promise.resolve(true)]) {
    const maps = createMainMapChangeAdapter({ currentApaAdapter: f.current, assertFencedAuthority: () => result });
    assert.throws(() => maps.captureSessionStartMap(f.input()), /MAIN_MAP_FENCE_REQUIRED/u);
  }
  f.revoke();
  assert.throws(() => f.world(), /MAIN_VISUAL_FENCE_REQUIRED/u);
  assert.throws(() => f.maps.captureSessionStartMap(f.input()), /MAIN_MAP_FENCE_REQUIRED/u);
});

test('wrong actor, role, MM, reports grant, state source and visual session cannot cross the main lane', () => {
  const f = fixture();
  for (const principal of [
    { ...f.principal, actorId: 'other-owner' },
    { ...f.principal, subjectActorId: 'other-owner' },
    { ...f.principal, role: 'coach' },
    { ...f.principal, mm: 'other-mm' },
    { ...f.principal, grants: { ...f.principal.grants, reportsRead: false } },
  ]) assert.throws(() => f.world('SESSION_OPENING', { principal }));
  const state = clone(f.state); state.sourceBinding.actorId = 'other-owner';
  assert.throws(() => f.world('SESSION_OPENING', { state }), /MAIN_MAP_CANONICAL_SOURCE_REQUIRED/u);
  assert.throws(() => f.world('SESSION_OPENING', { sessionId: 'different-session' }), /MAIN_VISUAL_FENCE_REQUIRED/u);
});

test('main visual always reads the full current-APA reader, rejecting foreign, unverified and changed receipt state', () => {
  const f = fixture(), start = f.maps.captureSessionStartMap(f.input());
  const result = publish(f);
  const world = f.world();
  assert.equal(world.stateBinding.currentApaVersion, '1');
  assert.equal(world.stateBinding.currentApaHash, result.record.artifact.artifact_sha256);
  assert.throws(() => f.world('SESSION_OPENING', { currentApa: { artifact: result.record.artifact } }), /MAIN_VISUAL_CURRENT_APA_SOURCE_REQUIRED/u);
  const map = f.maps.buildSessionMapChange(f.input({ startMap: start }));
  assert.equal(map.apa.status, 'PUBLISHED_CHANGE');
  assert.equal(map.apa.receipts[0].receipt_hash, result.receipt.receipt_hash);
  assert.equal(map.apa.entries.find(entry => entry.path === 'report.domains.training.gap').now,
    result.record.artifact.report.domains[1].gap);
  f.state.currentApa.receipts[0].reason = 'Changed without resealing';
  assert.throws(() => f.world());
  assert.throws(() => f.maps.buildSessionMapChange(f.input({ startMap: start })));
});

test('accepted plan comparison uses exact actual owner approvals, independently of APA publication', () => {
  const f = fixture(), start = f.maps.captureSessionStartMap(f.input());
  accept(f);
  const map = f.maps.buildSessionMapChange(f.input({ startMap: start }));
  assert.equal(map.plan.status, 'ACCEPTED_CHANGE');
  assert.equal(map.apa.status, 'UNCHANGED');
  assert.equal(map.plan.now.hash, currentApaHash(f.state.plan));
  assert.equal(f.world().objects.find(item => item.id === 'athlete-plan').kind, 'ACCEPTED_PLAN');
  assert.equal(f.state.plan.approvals[0].actorId, f.principal.actorId);
  assert.equal(f.state.plan.approvals[0].hash, f.state.plan.hash);
});

test('historical private plan missing optional metadata still needs exact actual actor approval and body hash', () => {
  const f = fixture(); accept(f);
  delete f.state.plan.visibility; delete f.state.plan.proposedBy;
  assert.equal(f.world().objects.find(item => item.id === 'athlete-plan').kind, 'ACCEPTED_PLAN');
  f.state.plan.approvals = ['athlete'];
  assert.throws(() => f.world(), /MAP_CHANGE_PLAN_NOT_ACCEPTED/u);
});

for (const [label, alter] of Object.entries({
  'demo role-string approval': plan => { plan.approvals = ['athlete']; },
  'other actor approval': plan => { plan.approvals[0].actorId = 'other-owner'; },
  'stale approved body hash': plan => { plan.steps[0].when = 'Unreviewed Friday'; },
  'missing exact acceptance': plan => { delete plan.accepted_at; },
  'unapproved coach commitment': plan => { plan.steps[0].owner = 'coach'; },
  'shared relabel': plan => { plan.visibility = 'shared'; },
  'wrong proposal actor': plan => { plan.proposedBy = 'other-owner'; },
  'approval after acceptance': plan => { plan.approvals[0].at = '2099-01-01T00:00:00.000Z'; },
})) test(`main rejects ${label} as an accepted plan`, () => {
  const f = fixture(); accept(f); alter(f.state.plan);
  assert.throws(() => f.world(), /MAP_CHANGE_PLAN_NOT_ACCEPTED/u);
  assert.throws(() => f.maps.captureSessionStartMap(f.input()), /MAP_CHANGE_PLAN_NOT_ACCEPTED/u);
});

test('review-pending APA is historical only; rejected arms and unverifiable learning are not offered as authority', () => {
  const f = fixture();
  f.state.apaNeedsReview = true;
  f.state.learning = [{ text: 'Forged learning', actorId: 'other-owner', approved_at: at },
    { text: 'Old role-only learning', speaker: 'athlete', approved_at: at },
    { text: 'Keep it concise', actorId: f.principal.actorId, speaker: 'athlete', approved_at: at },
    { text: 'A coach observation', actorId: f.principal.actorId, speaker: 'coach', approved_at: at },
    { text: 'A noncanonical approval date', actorId: f.principal.actorId, speaker: 'athlete', approved_at: '2026-09-27' },
    { text: ' '.repeat(20), actorId: f.principal.actorId, speaker: 'athlete', approved_at: at },
    { text: 'Too long '.repeat(200), actorId: f.principal.actorId, speaker: 'athlete', approved_at: at }];
  const world = f.world();
  assert.equal(world.objects.some(item => item.sourceIds.includes('athlete-source-apa')), false);
  assert.equal(world.objects.find(item => item.id === 'athlete-learning').items.length, 1);
  assert.equal(world.objects.find(item => item.id === 'athlete-learning').items[0].label, 'Keep it concise');
  assert.equal(f.visuals.validateAthleteVisualPlan({ world, candidate: candidate(world) }).ok, true);
  f.state.apaNeedsReview = false;
  assert.equal(f.world().objects.some(item => item.id === 'athlete-option-m4'), false);
});

test('legacy closing truthfully has no start comparison and never fabricates before/unchanged claims', () => {
  const f = fixture();
  const map = f.maps.buildLegacySessionMapChange(f.input());
  assert.equal(map.comparison, 'UNAVAILABLE_START_SNAPSHOT');
  assert.equal(map.apa.before, null); assert.equal(map.plan.before, null);
  assert.deepEqual(map.unchanged, { saved_apa: null, accepted_plan: null });
  f.state.closing = { summary: 'We discussed possibilities without agreeing a plan.', continuity: 'Review next time.' };
  const world = f.world('SESSION_FINALIZATION');
  assert.match(world.truthBoundaries.map, /comparison is unavailable/u);
  const final = candidate(world, { ids: ['athlete-map-change', 'athlete-session-recap'] });
  assert.equal(f.visuals.validateAthleteVisualPlan({ candidate: final, world }).ok, true);
  assert.equal(f.visuals.validateAthleteVisualPlan({ candidate: candidate(world), world }).ok, false);
});

test('main finalization requires map reveal, recap and exact accepted versus proposed plan status', () => {
  const f = fixture(); f.state.sessionStartMap = f.maps.captureSessionStartMap(f.input());
  accept(f);
  f.setState(applyActorAction(f.state, { action: 'draft', plan: { ...body, title: 'A separate proposal' } }, f.bundle, f.principal));
  f.state.closing = { summary: 'We discussed the two steps.', continuity: 'The new proposal needs review.' };
  const world = f.world('SESSION_FINALIZATION');
  const complete = candidate(world, { ids: ['athlete-map-change', 'athlete-session-recap', 'athlete-plan', 'athlete-draft'] });
  assert.equal(f.visuals.validateAthleteVisualPlan({ candidate: complete, world }).ok, true);
  const rendered = f.visuals.materializeAthleteVisualPlan({ candidate: complete, world });
  assert.equal(rendered.blocks[0].objects[2].kind, 'ACCEPTED_PLAN');
  assert.equal(rendered.blocks[0].objects[3].kind, 'PROPOSED_PLAN');
  for (const missing of ['athlete-map-change', 'athlete-session-recap', 'athlete-plan', 'athlete-draft']) {
    const incomplete = clone(complete); incomplete.blocks[0].objectIds = incomplete.blocks[0].objectIds.filter(id => id !== missing);
    assert.equal(f.visuals.validateAthleteVisualPlan({ candidate: incomplete, world }).ok, false);
  }
});

test('main composer rejects copied/saved or demo worlds rather than trusting a claimed contract', async () => {
  const f = fixture(), world = f.world(), compose = f.visuals.createAthleteVisualComposer({ env: {},
    evidenceSink: async () => {}, transport: async () => { assert.fail('No call for unowned world'); } });
  assert.throws(() => compose(clone(world)), /MAIN_VISUAL_WORLD_AUTHORITY_REQUIRED/u);
  const demoState = initial(bundles.nia); demoState.sessionId = sessionId;
  const foreign = demoWorld({ event: 'SESSION_OPENING', bundle: bundles.nia, state: demoState,
    scopeId: 'fictional-demo-only', sessionId, triggerRequestId: 'fixture' });
  assert.throws(() => compose(foreign), /MAIN_VISUAL_WORLD_AUTHORITY_REQUIRED/u);
  const legacyStart = demoStart({ bundle: bundles.nia, state: demoState });
  assert.throws(() => f.maps.buildSessionMapChange(f.input({ startMap: legacyStart })), /MAP_CHANGE_START_INVALID/u);
});

test('strict frozen main request records first result and cold recovery releases exact material with zero extra calls', async () => {
  const f = fixture(), world = f.world(), c = await composed(f, world), before = hash(f.state);
  const result = await c.run();
  assert.equal(c.calls.count, 1);
  assert.deepEqual(c.events.map(event => event.kind), ['request', 'response', 'receipt']);
  const saved = { world, savedRequest: c.events[0], savedResponse: c.events[1], savedReceipt: c.events[2] };
  const recovered = f.visuals.recoverAthleteVisualComposition(saved);
  assert.deepEqual(recovered.plan, result.plan); assert.deepEqual(recovered.receipt, result.receipt);
  assert.equal(recovered.no_provider_call, true); assert.equal(c.calls.count, 1);
  const noReceipt = f.visuals.recoverAthleteVisualComposition({ ...saved, savedReceipt: null });
  assert.equal(noReceipt.receipt.completed, null);
  assert.equal(noReceipt.receipt.recovered_from_saved_response, true);
  assert.equal(hash(f.state), before);
});

test('schema-ordered main binding is exact by keys and values, not object insertion order', async () => {
  const f = fixture(), world = f.world(), valid = candidate(world);
  const keys = Object.keys(f.visuals.ATHLETE_VISUAL_OUTPUT_SCHEMA.schema.properties.stateBinding.properties);
  valid.stateBinding = Object.fromEntries(keys.map(key => [key, world.stateBinding[key]]));
  assert.notEqual(JSON.stringify(valid.stateBinding), JSON.stringify(world.stateBinding));
  assert.equal(f.visuals.validateAthleteVisualPlan({ candidate: valid, world }).ok, true);
  const c = await composed(f, world, { candidate: valid }); await c.run();
  assert.equal(c.calls.count, 1);
  const recovered = f.visuals.recoverAthleteVisualComposition({ world,
    savedRequest: c.events[0], savedResponse: c.events[1], savedReceipt: c.events[2] });
  assert.deepEqual(recovered.plan.stateBinding, valid.stateBinding);
  for (const alter of [binding => { delete binding.actorId; }, binding => { binding.actorId = 'foreign'; },
    binding => { binding.extraActor = f.principal.actorId; }, binding => { binding.stateRevision++; },
    binding => { binding.actorId = undefined; }]) {
    const bad = clone(valid); alter(bad.stateBinding);
    assert.equal(f.visuals.validateAthleteVisualPlan({ candidate: bad, world }).ok, false);
  }
});

test('saved recovery rejects every world/request/response/receipt fence mismatch without provider rerun', async () => {
  const f = fixture(), world = f.world(), c = await composed(f, world); await c.run();
  const original = { savedRequest: c.events[0], savedResponse: c.events[1], savedReceipt: c.events[2] };
  const attacks = [
    saved => { saved.savedRequest.record.mm = 'foreign'; },
    saved => { saved.savedRequest.record.world_sha256 = '0'.repeat(64); },
    saved => { saved.savedRequest.request.input[0].content = 'Bypass'; },
    saved => { saved.savedRequest.request.store = true; },
    saved => { saved.savedResponse.id = 'foreign'; },
    saved => { saved.savedResponse.response.status = 'incomplete'; },
    saved => { saved.savedResponse.response.output_text += ' '; },
    saved => { saved.savedReceipt.response_sha256 = '0'.repeat(64); },
    saved => { saved.savedReceipt.request_sha256 = '0'.repeat(64); },
    saved => { saved.savedReceipt.usage = { invented: 99 }; },
    saved => { saved.savedReceipt.addedAuthority = true; },
  ];
  for (const attack of attacks) {
    const saved = clone(original); attack(saved);
    assert.throws(() => f.visuals.recoverAthleteVisualComposition({ world, ...saved }), /ATHLETE_VISUAL_RECOVERY_EVIDENCE_INVALID/u);
  }
  const changed = f.world('SESSION_OPENING', { triggerRequestId: 'next-request' });
  assert.throws(() => f.visuals.recoverAthleteVisualComposition({ world: changed, ...original }), /ATHLETE_VISUAL_RECOVERY_EVIDENCE_INVALID/u);
  assert.equal(c.calls.count, 1);
});

test('evidence boundary failures and invalid first generated result never deliver or retry', async () => {
  for (const failKind of ['request', 'response', 'receipt']) {
    const f = fixture(), world = f.world(), c = await composed(f, world, { failKind });
    await assert.rejects(c.run(), /ATHLETE_VISUAL_EVIDENCE_UNAVAILABLE/u);
    assert.equal(c.calls.count, failKind === 'request' ? 0 : 1);
  }
  const f = fixture(), world = f.world(), invalid = candidate(world); invalid.interactions.push('approve');
  const c = await composed(f, world, { candidate: invalid });
  await assert.rejects(c.run(), /ATHLETE_VISUAL_PLAN_FAILED_CLOSED/u);
  assert.equal(c.calls.count, 1); assert.equal(c.events.at(-1).kind, 'failure');
});
