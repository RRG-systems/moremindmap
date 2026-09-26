import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { setImmediate } from 'node:timers';
import test from 'node:test';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { REPORT_SCHEMA } from '../server/athleteAcademyV1/apa/schema.js';
import {
  APA_COMPOSITION_POLICY, APA_COMPOSITION_SCHEMA, createApaComposer,
  validateApaPublicationDryRun,
} from '../server/athleteConsultingV2/apaComposer.js';
import { currentApaHash, currentApaView, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { APA_DELTA_SCHEMA, apaDeltaBinding } from '../server/athleteConsultingV2/apaDelta.js';
import { APA_NARRATIVE_FIELDS, NARRATIVE_UPDATE_SCHEMA } from '../server/athleteConsultingV2/apaNarrative.js';

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
  const value = { confirmation: clone(bundle.apa.confirmation), report: clone(bundle.apa.report), narrative_updates: [] };
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
function deltaFor(body = candidate(), submitted = input()) {
  const prior = currentApaView(submitted.bundle, submitted.record);
  const typed = (entity, kind) => {
    const copy = clone(entity);
    delete copy.bos_refs;
    if (kind === 'candidates' && !Object.hasOwn(copy, 'review_schedule')) copy.review_schedule = null;
    return copy;
  };
  const affected = kind => body.report[kind].filter((entity, index) =>
    JSON.stringify(typed(entity, kind)) !== JSON.stringify(typed(prior.artifact.report[kind][index], kind)))
    .map(entity => typed(entity, kind));
  return { contract: 'athlete_current_apa_delta_v1',
    binding: clone(apaDeltaBinding({ bundle: submitted.bundle, prior, confirmedChange: submitted.confirmedChange })),
    domains: affected('domains'), futures: affected('futures'), candidates: affected('candidates'),
    narratives: clone(body.narrative_updates || []) };
}
const response = (body = candidate(), changes = {}, submitted = input()) => ({ model: 'gpt-5.6-sol', status: 'completed',
  output_text: JSON.stringify(body.contract ? body : deltaFor(body, submitted)),
  usage: { input_tokens: 10, output_tokens: 20 }, ...changes });

test('composer uses exact Youth APA report schema and stays private with no automatic publication', () => {
  assert.deepEqual(APA_COMPOSITION_SCHEMA.properties.report, REPORT_SCHEMA);
  assert.equal(APA_COMPOSITION_SCHEMA.additionalProperties, false);
  assert.deepEqual(APA_COMPOSITION_SCHEMA.required, ['confirmation', 'report', 'narrative_updates']);
  assert.deepEqual(APA_COMPOSITION_SCHEMA.properties.narrative_updates.items, NARRATIVE_UPDATE_SCHEMA);
  assert.equal(APA_COMPOSITION_POLICY.store, false);
  assert.equal(APA_COMPOSITION_POLICY.max_retries, 0);
  assert.equal(APA_COMPOSITION_POLICY.timeout_ms, 600000);
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
      assert.deepEqual(request.text.format.schema, APA_DELTA_SCHEMA);
      assert.equal(request.text.format.name, 'athlete_current_apa_delta');
      assert.equal(options.maxRetries, 0);
      assert.equal(options.timeout, 600000);
      const packet = JSON.parse(request.input);
      assert.equal(packet.selected_athlete.slug, 'nia');
      assert.equal(packet.original_apa.artifact_sha256, nia.apa.artifact_sha256);
      assert.equal(packet.current_apa.artifact_sha256, nia.apa.artifact_sha256);
      assert.equal(packet.current_apa.same_as_original_apa, true);
      assert.equal(packet.current_apa.original_apa_sha256, nia.apa.artifact_sha256);
      assert.equal(Object.hasOwn(packet.current_apa, 'report'), false);
      assert.deepEqual(packet.original_apa.report, nia.apa.report);
      assert.deepEqual(packet.original_apa.sources, nia.apa.sources);
      assert.deepEqual(packet.accepted_bos, { reading: nia.bos.reading, evidence: nia.bos.evidence });
      assert.equal(packet.saved_athlete_confirmation.id, sourceId);
      assert.deepEqual(packet.delta_binding, deltaFor(candidate(), submitted).binding);
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
  assert.equal(Object.hasOwn(JSON.parse(events[1].response.output_text), 'report'), false);
  assert.deepEqual(result.receipt.delta_receipt.targeted_entities.domains, ['training']);
  assert.deepEqual(result.receipt.delta_receipt.targeted_entities.futures, ['current_course']);
  assert.deepEqual(result.receipt.delta_receipt.targeted_entities.candidates, []);
  assert.equal(result.receipt.input_chars, events[0].request.input.length);
  assert.equal(result.receipt.input_bytes, Buffer.byteLength(events[0].request.input));
  assert.equal(result.receipt.output_chars, events[1].response.output_text.length);
  assert.equal(result.receipt.output_bytes, Buffer.byteLength(events[1].response.output_text));
  assert.equal(result.receipt.delta_sha256, currentApaHash(JSON.parse(events[1].response.output_text)));
  assert.equal(result.receipt.reconstruction_receipt_sha256, currentApaHash(result.receipt.delta_receipt));
  for (const field of ['before_sha256','after_sha256','reconstructed_candidate_sha256','candidate_sha256'])
    assert.match(result.receipt[field], /^[a-f0-9]{64}$/u);
  assert.deepEqual(result.candidate.confirmation, nia.apa.confirmation);
  assert.deepEqual(result.candidate.report.domains[0], nia.apa.report.domains[0]);
  assert.deepEqual(result.candidate.report.candidates, nia.apa.report.candidates);
  const expected = candidate();
  for (const item of expected.report.candidates) delete item.review_schedule;
  assert.deepEqual(result.candidate, expected);
  assert.deepEqual(submitted.state, beforeState);
  assert.deepEqual(nia.apa, beforeApa);
  assert.equal(currentApaView(nia).version, 0);
});

test('a published current APA remains complete and distinct from the retained original baseline', async () => {
  const first = input();
  const firstCandidate = candidate();
  for (const item of firstCandidate.report.candidates) delete item.review_schedule;
  const published = publishCurrentApa({ ...first, candidate: firstCandidate });
  const submitted = input();
  submitted.record = published.record;
  submitted.expectedVersion = 1;
  submitted.state.messages[1].id = '33333333-3333-4333-8333-333333333333';
  submitted.confirmedChange.id = '44444444-4444-4444-8444-444444444444';
  submitted.confirmedChange.source_message_id = submitted.state.messages[1].id;
  const body = { confirmation: clone(published.record.artifact.confirmation),
    report: clone(published.record.artifact.report) };
  for (const item of body.report.candidates) item.review_schedule = null;
  let calls = 0;
  const composer = createApaComposer({ env: {}, evidenceSink: async () => {},
    transport: async request => {
      calls++;
      const packet = JSON.parse(request.input);
      assert.equal(packet.expected_version, 1);
      assert.equal(packet.original_apa.artifact_sha256, nia.apa.artifact_sha256);
      assert.equal(packet.current_apa.artifact_sha256, published.record.artifact.artifact_sha256);
      assert.notEqual(packet.current_apa.artifact_sha256, packet.original_apa.artifact_sha256);
      assert.equal(Object.hasOwn(packet.current_apa, 'same_as_original_apa'), false);
      assert.deepEqual(packet.current_apa.report, published.record.artifact.report);
      assert.deepEqual(packet.current_apa.sources, published.record.artifact.sources);
      assert.deepEqual(packet.current_apa.narrative_provenance, published.record.artifact.narrative_provenance);
      assert.deepEqual(packet.original_apa.report, nia.apa.report);
      assert.deepEqual(packet.accepted_bos, { reading: nia.bos.reading, evidence: nia.bos.evidence });
      return response(body, {}, submitted);
    } });
  const result = await composer(submitted);
  assert.equal(calls, 1);
  assert.equal(result.changed, false);
  assert.equal(result.publication_performed, false);
  assert.equal(currentApaView(nia, published.record).version, 1);
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

test('full-report coach-view rewrite and missing source citation fail after preserving raw response', async (context) => {
  const changedCoach = candidate();
  changedCoach.report.coach_view.summary = 'Coach now agrees to the plan.';
  const missingRef = candidate();
  missingRef.report.domains[1].refs = missingRef.report.domains[1].refs.filter(id => id !== sourceId);
  for (const [name, body, code] of [
    ['coach view', changedCoach, 'APA_COMPOSITION_RESPONSE_INVALID'],
    ['missing citation', missingRef, 'APA_COMPOSITION_CANDIDATE_INVALID'],
  ]) await context.test(name, async () => {
    const events = []; let calls = 0;
    const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
      transport: async () => { calls++; return name === 'coach view'
        ? response(body, { output_text: JSON.stringify(body) }) : response(body); } });
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
  const emitted = JSON.parse(events[1].response.output_text);
  assert.deepEqual([emitted.domains, emitted.futures, emitted.candidates], [[], [], []]);
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
  revised.narrative_updates = APA_NARRATIVE_FIELDS.map(field => ({ field,
    value: clone(revised.report[field]), refs: [sourceId] }));
  const events = []; let calls = 0;
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => { calls++; return response(revised, {}, confirmed); } });
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

test('changed entities require every strict field even though legacy null schedules normalize afterward', async () => {
  const missingStrictField = deltaFor(candidate());
  const item = clone(nia.apa.report.candidates[0]);
  delete item.bos_refs;
  item.action = 'Use one short cue before the Thursday passing drill.';
  item.refs.push(sourceId);
  missingStrictField.candidates.push(item);
  const events = [];
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => response(missingStrictField) });
  await assert.rejects(composer(input()), { message: 'APA_COMPOSITION_RESPONSE_INVALID' });
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
});

test('typed delta rejects binding drift and generic patches without retry or public diagnostic leakage', async (context) => {
  for (const [name, change, stage] of [
    ['other athlete', delta => { delta.binding.athlete_slug = 'sofia'; }, 'reconstruction'],
    ['stale version', delta => { delta.binding.current_apa_version = 1; }, 'reconstruction'],
    ['generic patch', delta => { delta.patches = [{ path: 'report.opening', value: 'Invented' }]; }, 'delta_schema'],
    ['model winner', delta => { delta.move = { selection: 'M1' }; }, 'delta_schema'],
  ]) await context.test(name, async () => {
    const events = []; let calls = 0;
    const delta = deltaFor(); change(delta);
    const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
      transport: async () => { calls++; return response(delta); } });
    await assert.rejects(composer(input()), { message: stage === 'delta_schema'
      ? 'APA_COMPOSITION_RESPONSE_INVALID' : 'APA_COMPOSITION_CANDIDATE_INVALID' });
    assert.equal(calls, 1);
    assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
    assert.equal(events.at(-1).stage, stage);
    assert.ok(Object.hasOwn(events.at(-1), 'validator_code'));
    assert.ok(Object.hasOwn(events.at(-1), 'validator_path'));
  });
});

test('reconstruction rejection retains content-free validator cause while public failure stays generic', async () => {
  const body = candidate();
  body.report.domains[1].help = Array.from({ length: 150 }, () => 'practice').join(' ');
  const events = []; let calls = 0;
  const composer = createApaComposer({ env: {}, evidenceSink: async event => { events.push(event); },
    transport: async () => { calls++; return response(body); } });
  await assert.rejects(composer(input()), { message: 'APA_COMPOSITION_CANDIDATE_INVALID' });
  assert.equal(calls, 1);
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
  const failure = events.at(-1);
  assert.equal(failure.code, 'APA_COMPOSITION_CANDIDATE_INVALID');
  assert.equal(failure.validator_code, 'FIRST_LAYER_TOO_LONG');
  assert.equal(failure.validator_path, 'report');
  assert.equal(failure.stage, 'reconstruction');
  assert.equal(failure.output_chars, events[1].response.output_text.length);
});

test('full publication dry-run wrapper captures exact safe cause without changing generic thrown failure', () => {
  const body = candidate();
  for (const item of body.report.candidates) delete item.review_schedule;
  body.report.domains[1].help = Array.from({ length: 150 }, () => 'practice').join(' ');
  assert.throws(() => validateApaPublicationDryRun({ ...input(), candidate: body }), error => {
    assert.equal(error.message, 'APA_COMPOSITION_CANDIDATE_INVALID');
    assert.deepEqual(error.diagnostic, { validator_code: 'FIRST_LAYER_TOO_LONG',
      validator_path: 'report', stage: 'publication_dry_run' });
    return true;
  });
  assert.equal(currentApaView(nia).version, 0);
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

test('summary-only typed composition is private, source-bound and does not manufacture domain changes', async () => {
  const submitted = input(), prior = currentApaView(nia);
  const delta = { contract: 'athlete_current_apa_delta_v1',
    binding: clone(apaDeltaBinding({ bundle: nia, prior, confirmedChange: submitted.confirmedChange })),
    domains: [], futures: [], candidates: [],
    narratives: [{ field: 'headline', value: 'One calm cue within a shorter Thursday practice', refs: [sourceId] },
      { field: 'what_we_dont_know', value: ['Whether the shorter practice leaves room for the cue.'], refs: [sourceId] }] };
  const events = []; let calls = 0;
  const compose = createApaComposer({ env: {}, evidenceSink: async event => events.push(event),
    transport: async () => { calls++; return response(delta); } });
  const result = await compose(submitted);
  assert.equal(calls, 1); assert.equal(result.changed, true); assert.equal(result.publication_performed, false);
  assert.deepEqual(result.candidate.narrative_updates, delta.narratives);
  assert.deepEqual(result.candidate.report.domains, nia.apa.report.domains);
  assert.deepEqual(result.receipt.delta_receipt.targeted_entities.narratives, ['headline', 'what_we_dont_know']);
  assert.deepEqual(result.receipt.material_paths, ['report.headline', 'narrative_provenance.headline',
    'report.what_we_dont_know', 'narrative_provenance.what_we_dont_know']);
  assert.equal(JSON.stringify(result.receipt.delta_receipt).includes(delta.narratives[0].value), false);
  const published = publishCurrentApa({ ...submitted, candidate: result.candidate });
  assert.equal(published.record.artifact.artifact_sha256, result.receipt.preview_content_hash);
  assert.equal(currentApaView(nia).version, 0);
});

test('latest narrative provenance remains in complete next-composition input without invented baseline refs', async () => {
  const first = input(), firstCandidate = candidate();
  for (const item of firstCandidate.report.candidates) delete item.review_schedule;
  firstCandidate.narrative_updates = [{ field: 'opening', value: nia.apa.report.opening, refs: [sourceId] }];
  const published = publishCurrentApa({ ...first, candidate: firstCandidate });
  const submitted = input(); submitted.record = published.record; submitted.expectedVersion = 1;
  submitted.state.messages[1].id = '33333333-3333-4333-8333-333333333333';
  submitted.confirmedChange.id = '44444444-4444-4444-8444-444444444444';
  submitted.confirmedChange.source_message_id = submitted.state.messages[1].id;
  const unchanged = { confirmation: clone(published.record.artifact.confirmation),
    report: clone(published.record.artifact.report), narrative_updates: [] };
  const compose = createApaComposer({ env: {}, evidenceSink: async () => {}, transport: async request => {
    const packet = JSON.parse(request.input);
    assert.deepEqual(packet.current_apa.narrative_provenance, published.record.artifact.narrative_provenance);
    assert.equal(packet.current_apa.narrative_provenance.fields[1].source_id, sourceId);
    assert.equal(Object.hasOwn(packet.original_apa, 'narrative_provenance'), false);
    assert.deepEqual(packet.original_apa.sources, nia.apa.sources);
    return response(unchanged, {}, submitted);
  } });
  assert.equal((await compose(submitted)).changed, false);
});

test('legacy-unknown correction without explicit whole-summary review fails once with safe diagnostic only', async () => {
  const submitted = correctionInput(), revised = candidate();
  replaceRef(revised.report, 'A06', sourceId);
  for (const item of revised.report.candidates)
    if (item.gates.some(gate => gate.refs.includes(sourceId))) item.refs = [...new Set([...item.refs, sourceId])];
  const events = []; let calls = 0;
  const compose = createApaComposer({ env: {}, evidenceSink: async event => events.push(event),
    transport: async () => { calls++; return response(revised, {}, submitted); } });
  await assert.rejects(compose(submitted), { message: 'APA_COMPOSITION_CANDIDATE_INVALID' });
  assert.equal(calls, 1); assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
  assert.equal(events.at(-1).validator_code, 'APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED');
  assert.equal(events.at(-1).validator_path, 'report.headline');
  assert.equal(events.at(-1).stage, 'reconstruction');
});
