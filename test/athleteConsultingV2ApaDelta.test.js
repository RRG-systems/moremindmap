import test from 'node:test';
import assert from 'node:assert/strict';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { currentApaView, currentApaHash, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { APA_DELTA_SCHEMA, apaDeltaBinding, reconstructApaDelta } from '../server/athleteConsultingV2/apaDelta.js';
import { APA_NARRATIVE_FIELDS } from '../server/athleteConsultingV2/apaNarrative.js';

const clone = value => structuredClone(value);
const messageId = '11111111-1111-4111-8111-111111111111';
const changeId = '22222222-2222-4222-8222-222222222222';
const secondMessageId = '33333333-3333-4333-8333-333333333333';
const secondChangeId = '44444444-4444-4444-8444-444444444444';
const sourceId = id => `APA:CURRENT:${id}`;
function setup(bundle = nia, options = {}) {
  const id = options.changeId || changeId, sourceMessageId = options.messageId || messageId;
  const confirmedChange = { id, source_message_id: sourceMessageId, athlete_slug: bundle.person.slug,
    mm: bundle.person.mm, kind: options.kind || 'reality', supersedes: options.supersedes || [],
    confirmed: true, confirmed_by: 'athlete', confirmed_at: '2026-09-25T08:01:00.000Z',
    reason: 'Athlete confirmed the changed training reality.' };
  const state = { mm: bundle.person.mm, messages: [{ id: sourceMessageId, role: 'user', speaker: 'athlete',
    text: 'Training now happens on Tuesdays, and my passing decision still feels rushed.',
    at: '2026-09-25T08:00:00.000Z' }] };
  const prior = currentApaView(bundle, options.record || null);
  return { bundle, prior, confirmedChange, state, record: options.record || null, expectedVersion: prior.version };
}
function entity(value) {
  const copy = clone(value);
  delete copy.bos_refs;
  if (copy.candidate_id && !Object.hasOwn(copy, 'review_schedule')) copy.review_schedule = null;
  return copy;
}
function deltaFor(input) {
  return { contract: 'athlete_current_apa_delta_v1', binding: clone(apaDeltaBinding(input)),
    domains: [], futures: [], candidates: [], narratives: [] };
}
function materialDelta(input) {
  const delta = deltaFor(input), source = sourceId(input.confirmedChange.id);
  const domain = entity(input.prior.artifact.report.domains[1]);
  domain.gap = 'Tuesday practice leaves less time to rehearse calm passing choices.';
  domain.refs.push(source);
  const future = entity(input.prior.artifact.report.futures[0]);
  future.conditions = 'If Tuesday practice remains crowded, a shorter passing-choice cue may fit.';
  future.refs.push(source);
  delta.domains.push(domain); delta.futures.push(future);
  if (input.confirmedChange.kind === 'correction') {
    // An original uncited summary is not secretly assigned legacy citations.
    // The selected synthetic athlete must explicitly review/reconfirm it.
    delta.narratives = APA_NARRATIVE_FIELDS.map(field => ({ field,
      value: clone(input.prior.artifact.report[field]), refs: [source] }));
  }
  return delta;
}
function restoreLegacy(candidate, prior) {
  const copy = clone(candidate);
  for (const [index, item] of copy.report.candidates.entries()) {
    if (!Object.hasOwn(prior.artifact.report.candidates[index], 'review_schedule') && item.review_schedule === null) {
      delete item.review_schedule;
    }
  }
  return copy;
}
function run(input, delta = materialDelta(input)) { return reconstructApaDelta({ ...input, delta }); }
function publish(input, candidate) { return publishCurrentApa({ ...input, candidate: restoreLegacy(candidate, input.prior) }); }

test('delta schema is a strict bounded complete-entity envelope with no writable BOS or winner fields', () => {
  assert.deepEqual(APA_DELTA_SCHEMA.required, ['contract', 'binding', 'domains', 'futures', 'candidates', 'narratives']);
  assert.equal(APA_DELTA_SCHEMA.additionalProperties, false);
  for (const [family, bound] of [['domains', 4], ['futures', 5], ['candidates', 5]]) {
    const schema = APA_DELTA_SCHEMA.properties[family];
    assert.equal(schema.maxItems, bound);
    assert.equal(schema.items.additionalProperties, false);
    assert.equal(Object.hasOwn(schema.items.properties, 'bos_refs'), false);
    assert.equal(Object.hasOwn(schema.items.properties, 'winner'), false);
  }
  assert.ok(APA_DELTA_SCHEMA.properties.candidates.items.required.includes('review_schedule'));
  assert.ok(APA_DELTA_SCHEMA.properties.candidates.items.required.includes('gates'));
  assert.ok(APA_DELTA_SCHEMA.properties.candidates.items.required.includes('selection_signals'));
  assert.equal(APA_DELTA_SCHEMA.properties.narratives.maxItems, 5);
});

test('binding pins the synthetic athlete, source, baseline and exact current revision', () => {
  const input = setup(), binding = apaDeltaBinding(input);
  assert.deepEqual(binding, { synthetic: true, athlete_slug: 'nia', mm: nia.person.mm,
    bos_sha256: nia.bos.artifact_sha256, baseline_apa_sha256: nia.apa.artifact_sha256,
    current_apa_sha256: nia.apa.artifact_sha256, current_apa_version: 0,
    source_id: sourceId(changeId), source_message_id: messageId });
  assert.ok(Object.isFrozen(binding));
});

test('typed entities reproduce full publication hashes/material paths without changing copied content', () => {
  const input = setup(), before = clone(input), delta = materialDelta(input), result = run(input, delta);
  const direct = { confirmation: clone(input.prior.artifact.confirmation), report: clone(input.prior.artifact.report),
    narrative_updates: [] };
  direct.report.domains[1] = { ...clone(delta.domains[0]), bos_refs: clone(direct.report.domains[1].bos_refs) };
  direct.report.futures[0] = { ...clone(delta.futures[0]), bos_refs: clone(direct.report.futures[0].bos_refs) };
  const full = publish(input, direct), reduced = publish(input, result.candidate);
  assert.equal(currentApaHash(restoreLegacy(result.candidate, input.prior)), currentApaHash(direct));
  assert.equal(reduced.record.artifact.artifact_sha256, full.record.artifact.artifact_sha256);
  assert.deepEqual(reduced.receipt.material_paths, full.receipt.material_paths);
  assert.deepEqual(reduced.record, full.record);
  assert.deepEqual(input, before);
  assert.deepEqual(result.candidate.report.coach_view, input.prior.artifact.report.coach_view);
  assert.deepEqual(result.candidate.report.domains[0], input.prior.artifact.report.domains[0]);
  assert.deepEqual(result.candidate.report.domains[1].bos_refs, input.prior.artifact.report.domains[1].bos_refs);
  assert.ok(Object.isFrozen(result.candidate.report));
});

test('receipt is content-free with exact strict before/after hashes and target IDs', () => {
  const input = setup(), result = run(input), strictBefore = run(input, deltaFor(input)).candidate;
  assert.deepEqual(result.receipt, { contract: 'athlete_current_apa_delta_reconstruction_v1',
    hash_basis: 'STRICT_FULL_COMPOSITION_CANDIDATE', before_sha256: currentApaHash(strictBefore),
    after_sha256: currentApaHash(result.candidate),
    targeted_entities: { domains: ['training'], futures: ['current_course'], candidates: [], narratives: [] },
    unchanged_copy: { frozen_confirmation_fields: true, copied_report_fields: [...APA_NARRATIVE_FIELDS, 'coach_view'],
      bos_refs: true, untargeted_entities: true },
    legacy_review_schedule_padding: input.prior.artifact.report.candidates.filter(c => !Object.hasOwn(c, 'review_schedule')).length });
  assert.equal(JSON.stringify(result.receipt).includes(input.state.messages[0].text), false);
  assert.equal(JSON.stringify(result.receipt).includes(input.prior.artifact.report.headline), false);
});

test('goal changes couple only to the targeted domain confirmation goal', () => {
  const input = setup(), delta = materialDelta(input);
  delta.domains[0].goal = 'Use the shorter passing-choice cue during team practice.';
  const result = run(input, delta), published = publish(input, result.candidate);
  assert.equal(result.candidate.confirmation.goals.training, delta.domains[0].goal);
  assert.deepEqual(result.candidate.confirmation.goals.school, input.prior.artifact.confirmation.goals.school);
  assert.ok(published.receipt.material_paths.includes('confirmation.goals.training'));
  assert.ok(published.receipt.material_paths.includes('report.domains.training.goal'));
});

test('complete candidate gate replacement reproduces deterministic selection and full publication', () => {
  const input = setup(), delta = materialDelta(input), selected = input.prior.artifact.move.candidate_id;
  const index = input.prior.artifact.report.candidates.findIndex(c => c.candidate_id === selected);
  const replacement = entity(input.prior.artifact.report.candidates[index]), source = sourceId(changeId);
  replacement.refs.push(source); replacement.gates[0].refs.push(source);
  replacement.gates[0].pass = false;
  replacement.gates[0].reason = 'The athlete has not agreed to this test under the newly reported conditions.';
  delta.candidates.push(replacement);
  const result = run(input, delta), reduced = publish(input, result.candidate);
  assert.notEqual(reduced.record.artifact.move?.candidate_id, selected);
  assert.ok(reduced.receipt.material_paths.includes('move.selection'));
  assert.ok(reduced.receipt.material_paths.includes(`report.candidates.${selected}.gates.athlete_agency.pass`));
  const direct = restoreLegacy(run(input, materialDelta(input)).candidate, input.prior);
  direct.report.candidates[index] = { ...clone(replacement), bos_refs: clone(input.prior.artifact.report.candidates[index].bos_refs) };
  assert.deepEqual(reduced.record, publish(input, direct).record);
});

test('source-bound categorical selection changes remain server selected rather than model chosen', () => {
  const input = setup(), delta = materialDelta(input), replacement = entity(input.prior.artifact.report.candidates[0]);
  const before = replacement.selection_signals.constraint_leverage;
  replacement.selection_signals.constraint_leverage = before === 'NONE' ? 'DIRECT' : 'NONE';
  replacement.refs.push(sourceId(changeId)); delta.candidates.push(replacement);
  const published = publish(input, run(input, delta).candidate);
  assert.ok(published.receipt.material_paths.includes('report.candidates.M1.selection_signals'));
  assert.equal(published.record.artifact.report.candidates[0].selection_signals.constraint_leverage,
    replacement.selection_signals.constraint_leverage);
});

test('when no candidate passes all five youth gates the server yields no One Move', () => {
  const input = setup(), delta = materialDelta(input);
  delta.candidates = input.prior.artifact.report.candidates.map(priorCandidate => {
    const replacement = entity(priorCandidate), gate = replacement.gates[0];
    replacement.refs.push(sourceId(changeId)); gate.refs.push(sourceId(changeId));
    gate.pass = false; gate.reason = 'The athlete has not agreed to this alternative under the current conditions.';
    return replacement;
  });
  const published = publish(input, run(input, delta).candidate);
  assert.equal(published.record.artifact.status, 'needs_confirmation');
  assert.equal(published.record.artifact.move, null);
  assert.equal(published.record.artifact.receipt.selected_candidate_id, null);
});

test('empty arrays copy the complete current map and make no material revision', () => {
  const input = setup(), result = run(input, deltaFor(input));
  assert.equal(result.receipt.before_sha256, result.receipt.after_sha256);
  assert.equal(publish(input, result.candidate).changed, false);
  assert.deepEqual(restoreLegacy(result.candidate, input.prior), {
    confirmation: input.prior.artifact.confirmation, report: input.prior.artifact.report, narrative_updates: [] });
});

test('newer current APA is copied rather than reconstructed from the immutable original', () => {
  const first = setup(), record = publish(first, run(first).candidate).record;
  const second = setup(nia, { record, messageId: secondMessageId, changeId: secondChangeId });
  const result = run(second, deltaFor(second));
  assert.equal(apaDeltaBinding(second).current_apa_sha256, record.artifact.artifact_sha256);
  assert.equal(apaDeltaBinding(second).current_apa_version, 1);
  assert.deepEqual(result.candidate.report.domains[1], record.artifact.report.domains[1]);
  assert.notDeepEqual(result.candidate.report.domains[1], nia.apa.report.domains[1]);
});

test('legacy schedules are padded only for strict compatibility and existing schedules survive', () => {
  const input = setup(), result = run(input, deltaFor(input));
  for (const item of result.candidate.report.candidates) assert.ok(Object.hasOwn(item, 'review_schedule'));
  assert.deepEqual(restoreLegacy(result.candidate, input.prior).report.candidates, input.prior.artifact.report.candidates);
  const delta = materialDelta(input), replacement = entity(input.prior.artifact.report.candidates[0]);
  replacement.review_schedule = { purpose: 'setup_check', setup_check: 'Ask whether the setup was agreed.',
    progress_check: 'After an appropriate team practice, ask whether the cue helped.' };
  replacement.refs.push(sourceId(changeId)); delta.candidates.push(replacement);
  const published = publish(input, run(input, delta).candidate);
  const next = setup(nia, { record: published.record, messageId: secondMessageId, changeId: secondChangeId });
  assert.deepEqual(run(next, deltaFor(next)).candidate.report.candidates[0].review_schedule, replacement.review_schedule);
});

test('binding mismatch, real/cross-athlete/unconfirmed source and tampered prior fail closed', () => {
  const input = setup();
  for (const field of ['mm', 'bos_sha256', 'baseline_apa_sha256', 'current_apa_sha256', 'source_id', 'source_message_id']) {
    const delta = materialDelta(input); delta.binding[field] = 'different';
    assert.throws(() => run(input, delta), /APA_DELTA_BINDING_MISMATCH/u);
  }
  const stale = materialDelta(input); stale.binding.current_apa_version = 1;
  assert.throws(() => run(input, stale), /APA_DELTA_BINDING_MISMATCH/u);
  for (const changes of [{ mm: sofia.person.mm }, { athlete_slug: 'sofia' }, { confirmed: false }, { confirmed_by: 'coach' }]) {
    assert.throws(() => apaDeltaBinding({ ...input, confirmedChange: { ...input.confirmedChange, ...changes } }),
      /APA_DELTA_CONFIRMED_SOURCE_INVALID/u);
  }
  const real = clone(nia); real.person.synthetic = false;
  assert.throws(() => apaDeltaBinding({ ...input, bundle: real }), /REPORT_IDENTITY_MISMATCH/u);
  const prior = clone(input.prior); prior.artifact.report.headline += ' Changed.';
  assert.throws(() => apaDeltaBinding({ ...input, prior }), /APA_DELTA_PRIOR_INVALID/u);
});

test('unknown, duplicate and reordered replacement targets reject with bounded paths', () => {
  const input = setup(), unknown = materialDelta(input);
  const replacement = entity(input.prior.artifact.report.candidates[0]); replacement.candidate_id = 'private-unrecognized-model-target';
  unknown.candidates.push(replacement);
  assert.throws(() => run(input, unknown), error => error.message === 'APA_DELTA_TARGET_INVALID'
    && error.validation_path === 'report.candidates'
    && !JSON.stringify({ code: error.message, path: error.validation_path }).includes(replacement.candidate_id));
  const duplicate = materialDelta(input); duplicate.domains.push(clone(duplicate.domains[0]));
  assert.throws(() => run(input, duplicate), error => error.message === 'APA_DELTA_TARGET_ORDER_INVALID'
    && error.validation_path === 'report.domains.1');
  const reordered = deltaFor(input);
  reordered.futures = [entity(input.prior.artifact.report.futures[1]), entity(input.prior.artifact.report.futures[0])];
  assert.throws(() => run(input, reordered), /APA_DELTA_TARGET_ORDER_INVALID/u);
});

test('incomplete entities, writable BOS/frozen prose, unknown envelopes and model winners reject', () => {
  const input = setup();
  for (const mutate of [d => { delete d.domains[0].detail; }, d => { d.domains[0].bos_refs = []; },
    d => { d.headline = 'A fabricated headline.'; }, d => { d.move = {}; }, d => { d.status = 'proposed'; },
    d => { d.winner = 'M1'; }, d => { d.contract = 'different'; }]) {
    const delta = materialDelta(input); mutate(delta);
    assert.throws(() => run(input, delta), /APA_DELTA_SCHEMA_INVALID/u);
  }
  const missingSchedule = materialDelta(input);
  missingSchedule.candidates = [entity(input.prior.artifact.report.candidates[0])];
  delete missingSchedule.candidates[0].review_schedule;
  assert.throws(() => run(input, missingSchedule), /APA_DELTA_SCHEMA_INVALID/u);
  const tooMany = deltaFor(input); tooMany.domains = Array(5).fill(entity(input.prior.artifact.report.domains[0]));
  assert.throws(() => run(input, tooMany), /APA_DELTA_SCHEMA_INVALID/u);
});

test('changed entity content requires the new source and cannot discard active or invent references', () => {
  const input = setup();
  const uncited = materialDelta(input); uncited.domains[0].refs.pop();
  assert.throws(() => run(input, uncited), error => error.message === 'APA_DELTA_CHANGE_NOT_SOURCE_BOUND'
    && error.validation_path === 'report.domains.1.gap');
  const dropped = materialDelta(input); dropped.domains[0].refs = dropped.domains[0].refs.filter(id => id !== 'CONFIRM');
  assert.throws(() => run(input, dropped), /APA_DELTA_SOURCE_REFERENCES_CHANGED/u);
  const invented = materialDelta(input); invented.futures[0].refs.push('A-UNAVAILABLE');
  assert.throws(() => run(input, invented), /APA_DELTA_SOURCE_REFERENCES_CHANGED/u);
});

test('gate pass/reason changes require both candidate and gate citations and exact gate structure', () => {
  const input = setup();
  for (const omitted of ['candidate', 'gate']) {
    const delta = materialDelta(input), replacement = entity(input.prior.artifact.report.candidates[0]);
    replacement.gates[0].reason = 'Newly reported timing requires a separate agreement.';
    if (omitted !== 'candidate') replacement.refs.push(sourceId(changeId));
    if (omitted !== 'gate') replacement.gates[0].refs.push(sourceId(changeId));
    delta.candidates.push(replacement);
    assert.throws(() => run(input, delta), error => error.message === 'APA_DELTA_CHANGE_NOT_SOURCE_BOUND'
      && error.validation_path === 'report.candidates.0.gates.0.reason');
  }
  const reordered = materialDelta(input), replacement = entity(input.prior.artifact.report.candidates[0]);
  [replacement.gates[0], replacement.gates[1]] = [replacement.gates[1], replacement.gates[0]];
  reordered.candidates.push(replacement);
  assert.throws(() => run(input, reordered), /APA_DELTA_GATE_STRUCTURE_CHANGED/u);
  const invalid = materialDelta(input), bad = entity(input.prior.artifact.report.candidates[0]);
  bad.selection_signals.constraint_leverage = 'INVENTED'; invalid.candidates.push(bad);
  assert.throws(() => run(input, invalid), /APA_DELTA_SCHEMA_INVALID/u);
  const missingGate = materialDelta(input), incomplete = entity(input.prior.artifact.report.candidates[0]);
  incomplete.gates.pop(); missingGate.candidates.push(incomplete);
  assert.throws(() => run(input, missingGate), /APA_DELTA_SCHEMA_INVALID/u);
});

test('correction dependency omissions reject rather than stripping citations from copied entities', () => {
  const first = setup(), record = publish(first, run(first).candidate).record;
  const correction = setup(nia, { record, messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(changeId)] });
  const delta = materialDelta(correction);
  delta.domains[0].refs = delta.domains[0].refs.filter(id => id !== sourceId(changeId));
  delta.domains[0].gap = 'Thursday is the short passing practice; Tuesday is a rest day.';
  delta.futures = [];
  assert.throws(() => run(correction, delta), error => error.message === 'APA_DELTA_CORRECTION_DEPENDENCY_OMITTED'
    && error.validation_path === 'report.futures.0.refs');
  delta.futures = [entity(correction.prior.artifact.report.futures[0])];
  delta.futures[0].refs = delta.futures[0].refs.filter(id => id !== sourceId(changeId));
  delta.futures[0].refs.push(sourceId(secondChangeId));
  delta.futures[0].conditions = 'If Thursday is the short practice, a concise cue may fit.';
  const result = run(correction, delta), published = publish(correction, result.candidate);
  assert.equal(published.record.version, 2);
  assert.deepEqual(published.receipt.supersedes, [sourceId(changeId)]);
  assert.equal(JSON.stringify(result.candidate.report).includes(sourceId(changeId)), false);
});

test('superseded gate references must be replaced even when other corrected entities are complete', () => {
  const first = setup(), delta = materialDelta(first), candidate = entity(first.prior.artifact.report.candidates[0]);
  candidate.refs.push(sourceId(changeId)); candidate.gates[0].refs.push(sourceId(changeId));
  delta.candidates.push(candidate);
  const record = publish(first, run(first, delta).candidate).record;
  const correction = setup(nia, { record, messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(changeId)] });
  const next = materialDelta(correction);
  for (const item of [...next.domains, ...next.futures]) item.refs = item.refs.filter(id => id !== sourceId(changeId));
  const replacement = entity(correction.prior.artifact.report.candidates[0]);
  replacement.refs = replacement.refs.filter(id => id !== sourceId(changeId));
  next.candidates.push(replacement);
  assert.throws(() => run(correction, next), /APA_DELTA_CORRECTION_DEPENDENCY_OMITTED/u);
});

test('a later delta cannot resurrect a source removed by a prior correction', () => {
  const first = setup(), record = publish(first, run(first).candidate).record;
  const correction = setup(nia, { record, messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(changeId)] });
  const revised = materialDelta(correction);
  revised.domains[0].gap = 'Thursday is the short practice; Tuesday is a rest day.';
  for (const item of [...revised.domains, ...revised.futures]) item.refs = item.refs.filter(id => id !== sourceId(changeId));
  const correctedRecord = publish(correction, run(correction, revised).candidate).record;
  const later = setup(nia, { record: correctedRecord,
    messageId: '55555555-5555-4555-8555-555555555555', changeId: '66666666-6666-4666-8666-666666666666' });
  const delta = deltaFor(later), future = entity(later.prior.artifact.report.futures[0]);
  future.refs.push(sourceId(changeId)); delta.futures.push(future);
  assert.throws(() => run(later, delta), /APA_DELTA_SOURCE_REFERENCES_CHANGED/u);
  const retarget = { ...later.confirmedChange, kind: 'correction', supersedes: [sourceId(changeId)] };
  assert.throws(() => apaDeltaBinding({ ...later, confirmedChange: retarget }), /APA_DELTA_CORRECTION_LINEAGE_INVALID/u);
});

test('immutable coach correction conflicts and invalid correction targets fail before reconstruction', () => {
  assert.throws(() => apaDeltaBinding(setup(nia, { kind: 'correction', supersedes: ['A03'] })),
    /APA_DELTA_COACH_CORRECTION_CONFLICT/u);
  for (const supersedes of [['COACH1'], ['not-present'], ['A06', 'A06']]) {
    assert.throws(() => apaDeltaBinding(setup(nia, { kind: 'correction', supersedes })),
      /APA_DELTA_CORRECTION_LINEAGE_INVALID/u);
  }
});

test('the reconstructed full report retains the existing content and length validators', () => {
  const input = setup();
  const odds = materialDelta(input); odds.domains[0].gap = 'This guarantees success with 90% confidence.';
  assert.throws(() => run(input, odds), /CUSTOMER_LANGUAGE_OR_ODDS_FAILURE/u);
  const script = materialDelta(input); script.futures[0].details = '<script>bad</script>';
  assert.throws(() => run(input, script), /INVALID_CONTENT/u);
  const long = materialDelta(input); long.futures[0].headline = Array(13).fill('word').join(' ');
  assert.throws(() => run(input, long), /FUTURE_HEADLINE_TOO_LONG/u);
});

test('a source-bound narrative-only update reproduces full publication without entity rewrites', () => {
  const input = setup(), delta = deltaFor(input);
  delta.narratives = [{ field: 'headline', value: 'A shorter practice makes your passing choice more deliberate.',
    refs: [sourceId(changeId)] }];
  const before = clone(input), result = run(input, delta);
  assert.equal(result.candidate.report.headline, delta.narratives[0].value);
  assert.deepEqual(result.candidate.narrative_updates, delta.narratives);
  assert.deepEqual(result.candidate.report.domains, input.prior.artifact.report.domains);
  assert.deepEqual(result.receipt.targeted_entities.narratives, ['headline']);
  assert.deepEqual(result.receipt.unchanged_copy.copied_report_fields,
    ['opening', 'connection', 'main_obstacle', 'what_we_dont_know', 'coach_view']);
  const direct = { confirmation: clone(input.prior.artifact.confirmation), report: clone(input.prior.artifact.report),
    narrative_updates: clone(delta.narratives) };
  direct.report.headline = delta.narratives[0].value;
  const full = publish(input, direct), reduced = publish(input, result.candidate);
  assert.equal(reduced.changed, true);
  assert.deepEqual(reduced.record, full.record);
  assert.equal(reduced.record.artifact.artifact_sha256, full.record.artifact.artifact_sha256);
  assert.deepEqual(reduced.receipt.material_paths, full.receipt.material_paths);
  assert.ok(reduced.receipt.material_paths.includes('report.headline'));
  assert.ok(reduced.receipt.material_paths.includes('narrative_provenance.headline'));
  const savedChange = reduced.receipt.narrative_changes.find(item => item.field === 'headline');
  assert.equal(currentApaHash(savedChange.before), currentApaHash(input.prior.artifact.report.headline));
  assert.equal(currentApaHash(savedChange.after), currentApaHash(delta.narratives[0].value));
  assert.equal(savedChange.before_refs, null);
  assert.deepEqual(savedChange.after_refs, [sourceId(changeId)]);
  assert.equal(savedChange.source_id, sourceId(changeId));
  assert.equal(savedChange.source_message_id, messageId);
  assert.equal(savedChange.value_changed, true);
  assert.deepEqual(input, before);
});

test('all five typed narrative values remain hash/source bound and receipt metadata stays content-free', () => {
  const input = setup(), delta = deltaFor(input);
  const values = { headline: 'Your week has changed; your next step can change too.',
    opening: 'Tuesday leaves less room. You can test a shorter cue.',
    connection: 'Your newly reported Tuesday timing connects training and school without changing your four chosen goals.',
    main_obstacle: 'The changed Tuesday timing may make the original practice cue harder to fit.',
    what_we_dont_know: ['Whether a shorter cue fits the newly reported Tuesday practice.'] };
  delta.narratives = APA_NARRATIVE_FIELDS.map(field => ({ field, value: values[field], refs: [sourceId(changeId)] }));
  const result = run(input, delta), published = publish(input, result.candidate);
  assert.deepEqual(result.receipt.unchanged_copy.copied_report_fields, ['coach_view']);
  assert.deepEqual(result.candidate.confirmation, input.prior.artifact.confirmation);
  assert.deepEqual(result.candidate.report.coach_view, input.prior.artifact.report.coach_view);
  assert.deepEqual(published.record.artifact.bos_sources, input.prior.artifact.bos_sources);
  for (const [index, field] of APA_NARRATIVE_FIELDS.entries()) {
    assert.deepEqual(result.candidate.report[field], values[field]);
    const provenance = published.record.artifact.narrative_provenance.fields[index];
    assert.equal(provenance.field, field);
    assert.equal(provenance.status, 'SOURCE_BOUND');
    assert.equal(provenance.source_id, sourceId(changeId));
    assert.equal(provenance.source_message_id, messageId);
    assert.equal(provenance.version, 1);
    assert.deepEqual(provenance.refs, [sourceId(changeId)]);
    const savedChange = published.receipt.narrative_changes.find(item => item.field === field);
    assert.equal(currentApaHash(savedChange.before), currentApaHash(input.prior.artifact.report[field]));
    assert.equal(currentApaHash(savedChange.after), currentApaHash(values[field]));
    assert.deepEqual(savedChange.after_refs, provenance.refs);
    assert.equal(JSON.stringify(result.receipt).includes(JSON.stringify(values[field])), false);
  }
  assert.equal(result.receipt.after_sha256, currentApaHash(result.candidate));
});

test('narrative target/type/order bounds and forbidden metadata fail before candidate delivery', () => {
  const input = setup();
  for (const update of [
    { field: 'headline', value: [], refs: [sourceId(changeId)] },
    { field: 'what_we_dont_know', value: 'A question is not an array.', refs: [sourceId(changeId)] },
  ]) {
    const delta = deltaFor(input); delta.narratives.push(update);
    assert.throws(() => run(input, delta), error => error.message === 'APA_NARRATIVE_UPDATE_INVALID'
      && error.validation_path === 'report');
  }
  for (const updates of [
    [{ field: 'private-unrecognized-narrative', value: 'Not allowed.', refs: [sourceId(changeId)] }],
    [{ field: 'headline', value: 'Not allowed.', refs: [sourceId(changeId)], bos_refs: [] }],
    Array(6).fill({ field: 'headline', value: 'Not allowed.', refs: [sourceId(changeId)] }),
  ]) {
    const delta = deltaFor(input); delta.narratives = updates;
    assert.throws(() => run(input, delta), error => error.message === 'APA_DELTA_SCHEMA_INVALID'
      && error.validation_path === 'delta');
  }
  for (const fields of [['headline', 'headline'], ['opening', 'headline']]) {
    const delta = deltaFor(input);
    delta.narratives = fields.map(field => ({ field, value: clone(input.prior.artifact.report[field]),
      refs: [sourceId(changeId)] }));
    assert.throws(() => run(input, delta), error => error.message === 'APA_DELTA_TARGET_ORDER_INVALID'
      && error.validation_path === 'narrative_updates.1');
  }
});

test('narratives require explicit new-source support and cannot invent evidence', () => {
  const input = setup();
  for (const refs of [[], ['A06'], [sourceId(changeId), 'private-unavailable-source']]) {
    const delta = deltaFor(input);
    delta.narratives = [{ field: 'headline', value: 'The newly reported week needs a different cue.', refs }];
    assert.throws(() => run(input, delta), error => error.message === 'APA_NARRATIVE_SOURCE_INVALID'
      && error.validation_path === 'narrative_updates.0.refs');
  }
});

test('unchanged value with explicit review is a real provenance update, not an automatic summary rewrite', () => {
  const input = setup(), delta = deltaFor(input);
  delta.narratives = [{ field: 'headline', value: input.prior.artifact.report.headline, refs: [sourceId(changeId)] }];
  const published = publish(input, run(input, delta).candidate);
  assert.equal(published.changed, true);
  assert.equal(published.record.artifact.report.headline, input.prior.artifact.report.headline);
  assert.equal(published.receipt.material_paths.includes('report.headline'), false);
  assert.ok(published.receipt.material_paths.includes('narrative_provenance.headline'));
  assert.equal(published.record.artifact.sources.at(-1).id, sourceId(changeId));
});

test('legacy unknown narrative dependencies require explicit correction review without invented old refs', () => {
  const first = setup(), record = publish(first, run(first).candidate).record;
  for (const field of record.artifact.narrative_provenance.fields) {
    assert.equal(field.status, 'BASELINE_UNCITED_AT_FIELD_LEVEL');
    assert.deepEqual(field.refs, []);
    assert.equal(field.source_id, null);
  }
  const correction = setup(nia, { record, messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(changeId)] });
  const complete = materialDelta(correction);
  for (const item of [...complete.domains, ...complete.futures]) item.refs = item.refs.filter(id => id !== sourceId(changeId));
  complete.domains[0].gap = 'Thursday is the shorter practice; Tuesday is now a rest day.';
  const omitted = clone(complete); omitted.narratives = [];
  assert.throws(() => run(correction, omitted), error => error.message === 'APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED'
    && error.validation_path === 'report.headline');
  const result = run(correction, complete), published = publish(correction, result.candidate);
  assert.equal(published.record.version, 2);
  for (const field of published.record.artifact.narrative_provenance.fields) {
    assert.deepEqual(field.refs, [sourceId(secondChangeId)]);
    assert.equal(field.status, 'SOURCE_BOUND');
  }
  assert.deepEqual(record.artifact.narrative_provenance.fields.map(field => field.refs), [[], [], [], [], []]);
});

test('known narrative correction dependencies cannot be omitted and old refs cannot resurrect', () => {
  const first = setup(), firstDelta = deltaFor(first);
  firstDelta.narratives = APA_NARRATIVE_FIELDS.map(field => ({ field,
    value: clone(first.prior.artifact.report[field]), refs: [sourceId(changeId)] }));
  const record = publish(first, run(first, firstDelta).candidate).record;
  const correction = setup(nia, { record, messageId: secondMessageId, changeId: secondChangeId,
    kind: 'correction', supersedes: [sourceId(changeId)] });
  const complete = deltaFor(correction);
  complete.narratives = APA_NARRATIVE_FIELDS.map(field => ({ field,
    value: clone(correction.prior.artifact.report[field]), refs: [sourceId(secondChangeId)] }));
  const omitted = clone(complete); omitted.narratives.shift();
  assert.throws(() => run(correction, omitted), /APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED/u);
  const resurrected = clone(complete); resurrected.narratives[0].refs.push(sourceId(changeId));
  assert.throws(() => run(correction, resurrected), /APA_NARRATIVE_SOURCE_INVALID/u);
  assert.equal(publish(correction, run(correction, complete).candidate).record.version, 2);
});

test('a later narrative update retains every still-active narrative reference', () => {
  const first = setup(), firstDelta = deltaFor(first);
  firstDelta.narratives = [{ field: 'headline', value: 'Your changed week can use a shorter cue.', refs: [sourceId(changeId)] }];
  const record = publish(first, run(first, firstDelta).candidate).record;
  const later = setup(nia, { record, messageId: secondMessageId, changeId: secondChangeId }), delta = deltaFor(later);
  delta.narratives = [{ field: 'headline', value: 'Your shorter cue still needs a suitable practice moment.',
    refs: [sourceId(secondChangeId)] }];
  assert.throws(() => run(later, delta), /APA_NARRATIVE_SOURCE_REFERENCES_CHANGED/u);
  delta.narratives[0].refs.unshift(sourceId(changeId));
  const published = publish(later, run(later, delta).candidate);
  assert.deepEqual(published.record.artifact.narrative_provenance.fields[0].refs,
    [sourceId(changeId), sourceId(secondChangeId)]);
});
