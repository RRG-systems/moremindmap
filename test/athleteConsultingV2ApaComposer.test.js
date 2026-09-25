import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import test from 'node:test';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { REPORT_SCHEMA } from '../server/athleteAcademyV1/apa/schema.js';
import {
  APA_COMPOSITION_POLICY, APA_COMPOSITION_SCHEMA, createApaComposer,
} from '../server/athleteConsultingV2/apaComposer.js';
import { currentApaView } from '../server/athleteConsultingV2/currentApa.js';

const clone = value => structuredClone(value);
const messageId = '11111111-1111-4111-8111-111111111111';
const changeId = '22222222-2222-4222-8222-222222222222';
const sourceId = `APA:CURRENT:${changeId}`;
function input(bundle = nia) {
  return { bundle, record: null, expectedVersion: 0,
    state: { mm: bundle.person.mm, messages: [
      { id: 'coach-note', role: 'user', speaker: 'coach', text: 'Private coach observation.',
        capture: { role: 'coach' }, at: '2026-09-25T07:00:00.000Z' },
      { id: messageId, role: 'user', speaker: 'athlete',
        text: 'Training now happens on Tuesdays, and my passing decision still feels rushed.',
        at: '2026-09-25T08:00:00.000Z' },
      { id: 'other-athlete-chat', role: 'user', speaker: 'athlete',
        text: 'Another unrelated conversation turn.', at: '2026-09-25T08:00:30.000Z' },
    ] },
    confirmedChange: { id: changeId, source_message_id: messageId,
      athlete_slug: bundle.person.slug, mm: bundle.person.mm,
      kind: 'reality', supersedes: [], confirmed: true, confirmed_by: 'athlete',
      confirmed_at: '2026-09-25T08:01:00.000Z',
      reason: 'The athlete confirmed a material change in current training reality.' } };
}
function candidate(bundle = nia) {
  const value = { confirmation: clone(bundle.apa.confirmation), report: clone(bundle.apa.report) };
  for (const item of value.report.candidates) item.review_schedule = null;
  value.report.domains[1].gap = 'Tuesday practice now leaves less time to rehearse calm passing choices.';
  value.report.domains[1].refs.push(sourceId);
  value.report.futures[0].conditions = 'If Tuesday practice remains crowded, Nia may need a shorter passing-choice cue.';
  value.report.futures[0].refs.push(sourceId);
  return value;
}
function correctionInput() {
  const value = input();
  value.confirmedChange.kind = 'correction';
  value.confirmedChange.supersedes = ['A06'];
  value.state.messages[1].text = 'Correction: Tuesday is a rest day; training is on Thursday.';
  return value;
}
function replaceRef(value, source, replacement) {
  if (Array.isArray(value)) { value.forEach(item => replaceRef(item, source, replacement)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'refs' && Array.isArray(child)) value[key] = [...new Set(child.map(id => id === source ? replacement : id))];
    else replaceRef(child, source, replacement);
  }
}
const response = (body = candidate(), changes = {}) => ({ model: 'gpt-5.6-sol', status: 'completed',
  output_text: JSON.stringify(body), usage: { input_tokens: 10, output_tokens: 20 }, ...changes });

test('composer uses exact Youth APA report schema and stays private with no automatic publication', () => {
  assert.deepEqual(APA_COMPOSITION_SCHEMA.properties.report, REPORT_SCHEMA);
  assert.equal(APA_COMPOSITION_SCHEMA.additionalProperties, false);
  assert.deepEqual(APA_COMPOSITION_SCHEMA.required, ['confirmation', 'report']);
  assert.equal(APA_COMPOSITION_POLICY.store, false);
  assert.equal(APA_COMPOSITION_POLICY.max_retries, 0);
  assert.equal(APA_COMPOSITION_POLICY.automatic_publication, false);
});

test('one synthetic confirmed message composes a source-bound private candidate, with request and response evidence', async () => {
  const submitted = input();
  const beforeState = clone(submitted.state), beforeApa = clone(nia.apa);
  const events = []; let calls = 0;
  const composer = createApaComposer({ env: {},
    evidenceSink: async event => { events.push(event); },
    transport: async (request, options) => {
      calls++;
      assert.deepEqual(events.map(event => event.kind), ['request']);
      assert.equal(request.model, 'gpt-5.6-sol');
      assert.deepEqual(request.reasoning, { effort: 'xhigh' });
      assert.equal(request.store, false);
      assert.equal(request.max_output_tokens, 30000);
      assert.equal(request.text.format.strict, true);
      assert.deepEqual(request.text.format.schema, APA_COMPOSITION_SCHEMA);
      assert.equal(options.maxRetries, 0);
      assert.equal(options.timeout, 180000);
      const packet = JSON.parse(request.input);
      assert.equal(packet.selected_athlete.slug, 'nia');
      assert.equal(packet.original_apa.artifact_sha256, nia.apa.artifact_sha256);
      assert.equal(packet.current_apa.artifact_sha256, nia.apa.artifact_sha256);
      assert.equal(packet.saved_athlete_confirmation.id, sourceId);
      assert.match(packet.saved_athlete_confirmation.text, /Training now happens on Tuesdays/u);
      assert.equal(request.input.includes('Private coach observation'), false);
      assert.equal(request.input.includes('Another unrelated conversation turn'), false);
      assert.equal(Object.hasOwn(packet, 'messages'), false);
      return response();
    },
  });
  const result = await composer(submitted);
  assert.equal(calls, 1);
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'receipt']);
  assert.equal(result.changed, true);
  assert.equal(result.publication_performed, false);
  assert.equal(result.receipt.publication_performed, false);
  assert.ok(result.receipt.material_paths.includes('report.domains.training.gap'));
  assert.ok(result.receipt.material_paths.includes('report.futures.current_course.conditions'));
  assert.deepEqual(result.candidate.report.coach_view, nia.apa.report.coach_view);
  assert.equal(result.candidate.report.candidates.every(item => !Object.hasOwn(item, 'review_schedule')), true);
  assert.equal(events[1].response.output_text.includes('review_schedule'), true);
  assert.deepEqual(submitted.state, beforeState);
  assert.deepEqual(nia.apa, beforeApa);
  assert.equal(currentApaView(nia).version, 0);
});

test('invalid real/cross-athlete/unconfirmed/coach source fails before any provider call', async () => {
  let calls = 0;
  const composer = createApaComposer({ env: {}, evidenceSink: async () => {},
    transport: async () => { calls++; return response(); } });
  const wrong = [
    { ...input(), bundle: { ...nia, person: { ...nia.person, synthetic: false } } },
    { ...input(), confirmedChange: { ...input().confirmedChange, athlete_slug: 'sofia' } },
    { ...input(), confirmedChange: { ...input().confirmedChange, confirmed: false } },
    { ...input(), state: { ...input().state, messages: [{ ...input().state.messages[1], speaker: 'coach' }] } },
    { ...input(), bundle: sofia },
  ];
  for (const value of wrong) await assert.rejects(composer(value),
    /CURRENT_APA_|REPORT_IDENTITY_MISMATCH|UNKNOWN_ATHLETE/u);
  assert.equal(calls, 0);
});

test('invalid coach-view rewrite and missing source citation fail after preserving raw response', async (context) => {
  const changedCoach = candidate();
  changedCoach.report.coach_view.summary = 'Coach now agrees to the plan.';
  const missingRef = candidate();
  missingRef.report.domains[1].refs = missingRef.report.domains[1].refs.filter(id => id !== sourceId);
  for (const [name, body, code] of [
    ['coach view', changedCoach, 'APA_COMPOSITION_COACH_VIEW_CHANGED'],
    ['missing citation', missingRef, 'APA_COMPOSITION_CANDIDATE_INVALID'],
  ]) await context.test(name, async () => {
    const events = []; let calls = 0;
    const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
      transport: async () => { calls++; return response(body); } });
    await assert.rejects(composer(input()), { message: code });
    assert.equal(calls, 1);
    assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
    assert.equal(events[2].code, code);
  });
});

test('honest no-material-change result is a validated receipt, not a failure or publication', async () => {
  const unchanged = { confirmation: clone(nia.apa.confirmation),
    report: { ...clone(nia.apa.report),
      candidates: clone(nia.apa.report.candidates).map(item => ({ ...item, review_schedule: null })) } };
  const events = [];
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => response(unchanged) });
  const result = await composer(input());
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'receipt']);
  assert.equal(result.changed, false);
  assert.equal(result.publication_performed, false);
  assert.equal(result.receipt.status, 'no_material_change');
  assert.equal(result.receipt.changed, false);
  assert.deepEqual(result.receipt.material_paths, []);
  assert.equal(result.receipt.preview_content_hash, nia.apa.artifact_sha256);
  assert.equal(result.candidate.report.candidates.every(item => !Object.hasOwn(item, 'review_schedule')), true);
  assert.equal(currentApaView(nia).version, 0);
});

test('correction of a currently cited athlete source composes only after replacing its references', async () => {
  const confirmed = correctionInput();
  const revised = candidate();
  replaceRef(revised.report, 'A06', sourceId);
  for (const item of revised.report.candidates) {
    if (item.gates.some(gate => gate.refs.includes(sourceId))) {
      item.refs = [...new Set([...item.refs, sourceId])];
    }
  }
  revised.report.domains[1].gap = 'Thursday is the short practice; Tuesday is now a rest day.';
  revised.report.futures[0].conditions = 'If Thursday practice stays short, Nia may need a concise passing-choice cue.';
  const events = []; let calls = 0;
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => { calls++; return response(revised); } });
  const result = await composer(confirmed);
  assert.equal(calls, 1);
  assert.equal(result.changed, true);
  assert.equal(result.publication_performed, false);
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'receipt']);
  assert.equal(JSON.stringify(result.candidate.report).includes('"A06"'), false);
});

test('correction cannot target coach evidence or retain an invalidated cited athlete source', async () => {
  let calls = 0;
  const events = [];
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => { calls++; return response(candidate()); } });
  const coachTarget = correctionInput();
  coachTarget.confirmedChange.supersedes = ['COACH1'];
  await assert.rejects(composer(coachTarget), /CURRENT_APA_CORRECTION_LINEAGE_INVALID/u);
  assert.equal(calls, 0);
  await assert.rejects(composer(correctionInput()), { message: 'APA_COMPOSITION_CANDIDATE_INVALID' });
  assert.equal(calls, 1);
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
});

test('request evidence gates provider; response evidence gates candidate delivery', async () => {
  let releaseRequest, releaseResponse, calls = 0, delivered = false;
  const requestGate = new Promise(resolve => { releaseRequest = resolve; });
  const responseGate = new Promise(resolve => { releaseResponse = resolve; });
  const kinds = [];
  const composer = createApaComposer({ env: {}, evidenceSink: async event => {
    kinds.push(event.kind);
    if (event.kind === 'request') await requestGate;
    if (event.kind === 'response') await responseGate;
  }, transport: async () => { calls++; return response(); } });
  const pending = composer(input()).then(value => { delivered = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 0);
  releaseRequest();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(delivered, false);
  assert.deepEqual(kinds, ['request', 'response']);
  releaseResponse();
  await pending;
  assert.equal(delivered, true);
  assert.deepEqual(kinds, ['request', 'response', 'receipt']);
});

test('provider failure is sanitized, recorded and never retried', async () => {
  const events = []; let calls = 0;
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => { calls++; const error = new Error('private provider detail');
      error.status = 503; error.code = 'service_unavailable'; throw error; } });
  await assert.rejects(composer(input()), { message: 'APA_COMPOSITION_REQUEST_FAILED' });
  assert.equal(calls, 1);
  assert.deepEqual(events.map(event => event.kind), ['request', 'failure']);
  assert.equal(events[1].http_status, 503);
  assert.equal(events[1].provider_code, 'service_unavailable');
  assert.doesNotMatch(JSON.stringify(events), /private provider detail/u);
});

test('strict raw output is required even though legacy null review schedules normalize afterward', async () => {
  const missingStrictField = candidate();
  delete missingStrictField.report.candidates[0].review_schedule;
  const events = [];
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => response(missingStrictField) });
  await assert.rejects(composer(input()), { message: 'APA_COMPOSITION_RESPONSE_INVALID' });
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
});

test('a private evidence failure blocks provider or candidate delivery at each boundary', async (context) => {
  for (const failedKind of ['request', 'response', 'receipt']) await context.test(failedKind, async () => {
    let calls = 0;
    const events = [];
    const composer = createApaComposer({ env: {}, evidenceSink: async event => {
      events.push(event.kind);
      if (event.kind === failedKind) throw new Error('private sink unavailable');
    }, transport: async () => { calls++; return response(); } });
    await assert.rejects(composer(input()), { message: 'APA_COMPOSITION_EVIDENCE_UNAVAILABLE' });
    assert.equal(calls, failedKind === 'request' ? 0 : 1);
    assert.equal(events.at(-1), 'failure');
  });
});
