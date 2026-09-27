import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { APA_NARRATIVE_FIELDS, apaNarrativePath, getApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';
import { confirmationReadingScope, project, resolveApaReading } from '../src/athleteConsultingV2/approved-apa/projection.js';

// Strip only the JSX portion of this owned component. The tested pure helpers
// are the same helpers used by its UI, without Vite, a native bundler, or server.
const componentSource = readFileSync(new URL('../src/athleteConsultingV2/ApaNarrativeChanges.jsx', import.meta.url), 'utf8');
const pureEnd = componentSource.indexOf('const Value =');
assert.ok(pureEnd > 0);
const pureSource = componentSource.slice(0, pureEnd).replace("import React from 'react';", '')
  + '\nexport { selectApaNarrativeChanges, apaNarrativeChangePresentation };\n';
assert.doesNotMatch(pureSource, /<ul>|<p>|<section>/u);
const { selectApaNarrativeChanges, apaNarrativeChangePresentation } = await import(
  `data:text/javascript;base64,${Buffer.from(pureSource).toString('base64')}`);
const pageSource = readFileSync(new URL('../src/athleteConsultingV2/approved-apa/ReportPage.jsx', import.meta.url), 'utf8');
const clone = value => structuredClone(value);
const values = { priority: 'Keep my passing cue small and protect maths tutoring.',
  review_date: '2026-10-05', horizon_date: '2026-11-30' };
const fields = Object.keys(values).map(key => `confirmation.${key}`);
const uuid = number => `${String(number).padStart(8, '0')}-1111-4111-8111-111111111111`;
const plan = { id: 'separate-agreement', title: 'An independently agreed step',
  why: 'Chosen separately.', steps: [{ action: 'Try the reviewed cue.', when: 'Friday',
    notice: 'What feels useful.', owner: 'athlete' }], review: 'After Friday' };

function publication(record = null, number = 1, selectedFields = fields) {
  const prior = record?.artifact || nia.apa;
  const messageId = uuid(number * 2), changeId = uuid(number * 2 + 1), source = `APA:CURRENT:${changeId}`;
  const state = { mm: nia.person.mm, revision: number + 3, plan: clone(plan), messages: [{
    id: messageId, role: 'user', speaker: 'athlete', at: '2026-09-26T08:00:00.000Z',
    text: `My chosen priority is ${values.priority} My review date is ${values.review_date}. My planning horizon is ${values.horizon_date}.`,
  }] };
  const confirmation = clone(prior.confirmation);
  for (const field of selectedFields) confirmation[field.slice('confirmation.'.length)]
    = values[field.slice('confirmation.'.length)];
  const candidate = { confirmation, report: clone(prior.report), narrative_updates: selectedFields.map(field => ({
    field, value: confirmation[field.slice('confirmation.'.length)],
    refs: [...(prior.narrative_provenance?.fields?.find(item => item.field === field)?.refs || []), source],
  })) };
  const result = publishCurrentApa({ bundle: nia, record, state, expectedVersion: record?.version || 0,
    candidate, confirmedChange: { id: changeId, source_message_id: messageId,
      athlete_slug: 'nia', mm: nia.person.mm, kind: 'reality', supersedes: [],
      confirmed: true, confirmed_by: 'athlete', confirmed_at: '2026-09-26T08:01:00.000Z',
      reason: 'The athlete explicitly reviewed the priority, review date and horizon.' } });
  state.currentApa = result.record;
  return { state, result };
}

function view(state, options = {}) {
  const reading = resolveApaReading(nia, state, options);
  return { reading, model: project(reading.artifact, { version: reading.version,
    receipt: reading.receipt, acceptedPlan: reading.acceptedPlan,
    showOriginal: reading.showOriginal, showPreview: reading.showPreview, needsReview: reading.needsReview }) };
}

test('baseline priority and timing are historical, exact and never rolled from the clock', () => {
  const baseline = clone(nia.apa), scope = confirmationReadingScope(nia.apa);
  assert.deepEqual(scope.statuses, { priority: 'historical', review_date: 'historical', horizon_date: 'historical' });
  assert.match(scope.priorityLabel, /^Historical/u);
  assert.ok(scope.reviewDate.includes(nia.apa.confirmation.review_date));
  assert.ok(scope.horizonDate.includes(nia.apa.confirmation.horizon_date));
  const model = project(nia.apa);
  assert.match(model.presentation.nextStepLabel, /^Historical/u);
  assert.match(model.layer0.cards.find(card => card.id === 'futures').description, /^Historical/u);
  assert.match(model.layer0.cards.find(card => card.id === 'plan').qualifier, /^Historical/u);
  assert.doesNotMatch(JSON.stringify(model.presentation), /Your answers today|sport and life now/u);
  assert.deepEqual(nia.apa, baseline);
});

test('source-bound current fields survive cold readback and display exact chosen values, separate from plan', () => {
  const before = clone(nia), { state } = publication(), cold = JSON.parse(JSON.stringify(state));
  for (const saved of [state, cold]) {
    const { reading, model } = view(saved);
    const scope = confirmationReadingScope(reading.artifact, { version: reading.version });
    assert.deepEqual(scope.statuses, { priority: 'current', review_date: 'current', horizon_date: 'current' });
    assert.equal(model.layer0.nextStep, values.priority);
    assert.equal(model.presentation.nextStepLabel, 'Reviewed current priority');
    assert.ok(model.layer0.cards.find(card => card.id === 'futures').description.includes(values.horizon_date));
    const sections = model.objects.connection.drawer_payload;
    assert.deepEqual(sections.find(section => section.title === scope.priorityLabel).items, [values.priority]);
    assert.ok(sections.find(section => section.title === scope.reviewLabel).items[0].includes(values.review_date));
    assert.equal(model.layer0.cards.find(card => card.id === 'plan').value, plan.title);
    assert.deepEqual(reading.acceptedPlan, plan);
    assert.equal(reading.artifact.confirmation.assessment_date, before.apa.confirmation.assessment_date);
    assert.deepEqual(reading.artifact.bos_sources, before.apa.bos_sources);
  }
  assert.deepEqual(nia, before);
});

test('original selection retains old priority/dates and old CONFIRM even beside a current plan', () => {
  const { state } = publication(), { reading, model } = view(state, { showOriginal: true });
  assert.equal(reading.artifact, nia.apa);
  assert.equal(model.layer0.nextStep, nia.apa.confirmation.priority);
  assert.match(model.presentation.nextStepLabel, /^Historical/u);
  assert.ok(model.layer0.cards.find(card => card.id === 'futures').description.includes(nia.apa.confirmation.horizon_date));
  assert.equal(model.layer0.cards.find(card => card.id === 'plan').value, plan.title);
  assert.deepEqual(reading.acceptedPlan, plan);
});

test('a reviewed priority alone does not promote uncited timing or derive dates from plan consent', () => {
  const { state } = publication(null, 1, ['confirmation.priority']);
  state.plan.review = '2026-12-10';
  const { reading, model } = view(state);
  const scope = confirmationReadingScope(reading.artifact, { version: reading.version });
  assert.deepEqual(scope.statuses, { priority: 'current', review_date: 'historical', horizon_date: 'historical' });
  assert.equal(reading.artifact.confirmation.review_date, nia.apa.confirmation.review_date);
  assert.equal(reading.artifact.confirmation.horizon_date, nia.apa.confirmation.horizon_date);
  assert.match(model.layer0.cards.find(card => card.id === 'futures').description, /^Historical/u);
  assert.ok(!scope.reviewDate.includes(state.plan.review));
});

test('CONFIRM evidence always uses immutable saved source text, never evolving priority/dates/goals', () => {
  const { state } = publication(), artifact = clone(state.currentApa.artifact);
  artifact.confirmation.goals.school = 'A newly changed mutable school goal.';
  const model = project(artifact, { version: 1 });
  const originalWords = nia.apa.sources.find(source => source.id === 'CONFIRM').text;
  const lines = model.objects.sources.drawer_payload[0].items;
  const confirm = lines.find(line => line.startsWith('Athlete confirmation:'));
  assert.equal(confirm, `Athlete confirmation: ${originalWords}`);
  assert.ok(!confirm.includes(values.priority));
  assert.ok(!confirm.includes(values.review_date));
  assert.ok(!confirm.includes(artifact.confirmation.goals.school));
  assert.ok(lines.some(line => line.includes(values.priority) && line.includes('Athlete-confirmed coaching update')));
});

test('prepared draft has exact proposed values/evidence but cannot claim a saved or current priority', () => {
  const { state, result } = publication();
  state.currentApa = null;
  state.apaDraft = { expectedVersion: 0, confirmedChange: { mm: nia.person.mm, athlete_slug: 'nia' },
    previewRecord: result.record };
  const current = view(state), proposed = view(state, { showPreview: true });
  assert.equal(current.model.layer0.nextStep, nia.apa.confirmation.priority);
  assert.equal(proposed.model.layer0.nextStep, values.priority);
  assert.equal(proposed.model.presentation.nextStepLabel, 'Proposed priority · not saved');
  assert.match(proposed.model.layer0.cards.find(card => card.id === 'futures').description, /^Proposed/u);
  assert.match(proposed.model.objects.version.display_payload.title, /not current/u);
  for (const change of selectApaNarrativeChanges(proposed.reading.receipt)) {
    const copy = apaNarrativeChangePresentation(change, { proposed: true });
    assert.equal(copy.afterHeading, 'Proposed · not saved');
    assert.match(copy.afterEvidence, /bound to the proposed athlete-confirmed update/u);
    assert.doesNotMatch(copy.afterEvidence, /bound to the saved/u);
    assert.deepEqual(change.after, values[change.field.slice('confirmation.'.length)]);
  }
  assert.deepEqual(proposed.reading.acceptedPlan, plan);
});

test('exact before/after and explicit unchanged-value reconfirmation remain typed and visible', () => {
  const first = publication(), second = publication(first.result.record, 2, ['confirmation.priority']);
  const changes = selectApaNarrativeChanges(first.result.receipt);
  assert.deepEqual(changes.map(change => change.field), fields);
  for (const change of changes) {
    const key = change.field.slice('confirmation.'.length);
    assert.equal(change.path, change.field);
    assert.equal(change.before, nia.apa.confirmation[key]);
    assert.equal(change.after, values[key]);
    assert.equal(change.before_refs, null);
    assert.equal(change.after_refs.length, 1);
    assert.match(apaNarrativeChangePresentation(change).beforeEvidence, /No earlier citation has been invented/u);
  }
  const [reconfirmed] = selectApaNarrativeChanges(second.result.receipt);
  assert.equal(reconfirmed.field, 'confirmation.priority');
  assert.equal(reconfirmed.value_changed, false);
  assert.equal(reconfirmed.before, reconfirmed.after);
  assert.equal(reconfirmed.reference_changed, true);
  assert.equal(reconfirmed.after_refs.length, 2);
  assert.match(apaNarrativeChangePresentation(reconfirmed).unchangedText, /unchanged.*reviewed again/u);
  assert.match(apaNarrativeChangePresentation(reconfirmed).afterEvidence, /version 2/u);
});

test('reconfirming unchanged dates preserves exact values while exposing new evidence, not a rolled calendar', () => {
  const first = publication(), second = publication(first.result.record, 2);
  const changes = selectApaNarrativeChanges(second.result.receipt);
  for (const field of ['confirmation.review_date', 'confirmation.horizon_date']) {
    const change = changes.find(item => item.field === field);
    assert.equal(change.before, change.after);
    assert.equal(change.after, values[field.slice('confirmation.'.length)]);
    assert.equal(change.value_changed, false);
    assert.equal(change.reference_changed, true);
    assert.match(apaNarrativeChangePresentation(change).unchangedText, /value is unchanged/u);
    assert.match(apaNarrativeChangePresentation(change, { proposed: true }).afterEvidence, /Proposed evidence/u);
  }
});

test('historical, currency-unconfirmed and legacy uncited fields never acquire current labels', () => {
  const { state } = publication(), artifact = state.currentApa.artifact;
  for (const options of [{ showOriginal: true }, { needsReview: true }, { stale: true }]) {
    const scope = confirmationReadingScope(artifact, { version: 1, ...options });
    assert.ok(Object.values(scope.statuses).every(status => status === 'historical'));
    assert.match(project(artifact, { version: 1, ...options }).presentation.nextStepLabel, /^Historical/u);
  }
  const legacy = clone(artifact);
  legacy.narrative_provenance.contract = 'athlete_current_apa_narrative_provenance_v1';
  legacy.narrative_provenance.fields = legacy.narrative_provenance.fields.slice(0, 5);
  assert.ok(Object.values(confirmationReadingScope(legacy, { version: 1 }).statuses)
    .every(status => status === 'historical'));
  const missing = clone(artifact); delete missing.narrative_provenance;
  assert.ok(Object.values(confirmationReadingScope(missing, { version: 1 }).statuses)
    .every(status => status === 'historical'));
});

test('stale currency is first in the version drawer, even for a previous proposal or original selection', () => {
  const { state, result } = publication(), before = clone(state.currentApa.artifact);
  for (const options of [{}, { showPreview: true }, { showOriginal: true }, { needsReview: true }]) {
    const model = project(state.currentApa.artifact, { version: 1, receipt: result.receipt, stale: true, ...options });
    assert.equal(model.objects.version.display_payload.title, 'Last verified APA · currency unconfirmed');
    assert.equal(model.objects.version.epistemic_class, 'Historical last-verified APA · currency unconfirmed');
    const currency = model.objects.version.drawer_payload.find(section => section.title === 'Currency status');
    assert.match(currency.items[0], /last verified APA.*unconfirmed.*Do not treat this reading as current/u);
    assert.doesNotMatch(model.objects.version.display_payload.title, /Current APA|Proposed APA/u);
  }
  assert.match(project(state.currentApa.artifact, { version: 1, receipt: result.receipt })
    .objects.version.display_payload.title, /^Current APA/u);
  assert.deepEqual(state.currentApa.artifact, before);
});

test('unbound, wrong-version, unknown-contract or superseded provenance cannot claim current confirmation', () => {
  const { state } = publication();
  for (const mutate of [
    artifact => { artifact.narrative_provenance.fields.find(field => field.field === fields[0]).refs = []; },
    artifact => { artifact.narrative_provenance.fields.find(field => field.field === fields[0]).version = 2; },
    artifact => { artifact.narrative_provenance.contract = 'invented'; },
    artifact => { artifact.confirmation.priority = 'An uncited replacement value.'; },
    artifact => { artifact.sources.push({ id: 'correction', supersedes: [artifact.narrative_provenance.fields.find(field => field.field === fields[0]).source_id] }); },
  ]) {
    const changed = clone(state.currentApa.artifact); mutate(changed);
    assert.equal(confirmationReadingScope(changed, { version: 1 }).statuses.priority, 'historical');
  }
});

test('receipt selector retains old five report fields and rejects unknown paths/types or protected assessment dates', () => {
  const { result } = publication(), valid = clone(result.receipt.narrative_changes[0]);
  const reportChange = { ...valid, field: 'opening', path: 'report.opening', before: 'Earlier', after: 'Reviewed' };
  assert.equal(selectApaNarrativeChanges({ narrative_changes: [reportChange] }).length, 1);
  for (const invalid of [
    { ...valid, field: 'confirmation.assessment_date', path: 'confirmation.assessment_date' },
    { ...valid, path: 'report.confirmation.priority' },
    { ...valid, field: 'confirmation.review_date', path: 'confirmation.review_date', before: 'yesterday' },
    { ...valid, after: ['Wrong type'] },
  ]) assert.deepEqual(selectApaNarrativeChanges({ narrative_changes: [invalid] }), []);
});

test('all eight closed typed fields can display exact values and evidence without losing the unknowns array', () => {
  const { result } = publication();
  const template = clone(result.receipt.narrative_changes[0]);
  const changes = APA_NARRATIVE_FIELDS.map(field => {
    const before = clone(getApaNarrativeValue(nia.apa, field));
    const after = clone(getApaNarrativeValue(result.record.artifact, field));
    return { ...clone(template), field, path: apaNarrativePath(field), before, after,
      value_changed: JSON.stringify(before) !== JSON.stringify(after) };
  });
  const selected = selectApaNarrativeChanges({ narrative_changes: changes });
  assert.deepEqual(selected.map(change => change.field), APA_NARRATIVE_FIELDS);
  assert.equal(selected.length, 8);
  assert.ok(Array.isArray(selected.find(change => change.field === 'what_we_dont_know').after));
  for (const change of selected) assert.equal(typeof apaNarrativeChangePresentation(change).label, 'string');
});

test('owned report UI consumes the exact scope and typed receipt helpers without unconditional current-date copy', () => {
  assert.match(pageSource, /confirmationReadingScope\(a,\{version,showOriginal,showPreview,needsReview,stale\}\)/u);
  assert.match(pageSource, /confirmationScope\.priorityLabel/u);
  assert.match(pageSource, /confirmationScope\.reviewDate/u);
  assert.match(pageSource, /confirmationScope\.horizonDate/u);
  assert.match(pageSource, /!showOriginal&&version>0&&receipt&&<ApaNarrativeChanges/u);
  assert.match(pageSource, /<h2>\{stale\?'Last verified APA · currency unconfirmed':showPreview\?/u);
  assert.match(pageSource, /<p>\{stale\?'This is the last verified APA\./u);
  assert.match(pageSource, /historical=\{needsReview\|\|stale\}/u);
  assert.match(componentSource, /selectApaNarrativeChanges\(receipt\)/u);
  assert.match(componentSource, /apaNarrativeChangePresentation\(change,\{proposed\}\)/u);
  assert.doesNotMatch(pageSource, /What matters most right now|Now through|dateLabel\(a\.confirmation\.(?:review_date|horizon_date)\)/u);
});
