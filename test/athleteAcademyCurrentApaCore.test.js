import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import { buildCanonicalCoachBundle, hash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { createMainCurrentApaAdapter, MAIN_CURRENT_APA_CONTRACT, MAIN_APA_DELTA_CONTRACT,
  MAIN_APA_DELTA_SCHEMA, MAIN_APA_COMPOSITION_POLICY,
  MAIN_APA_REFERENCE_CODEC_CONTRACT,
  MAIN_APA_LEGACY_COMPOSITION_INSTRUCTIONS, MAIN_APA_COMPOSITION_INSTRUCTIONS } from '../server/athleteAcademyV1/coaching/currentApa.js';
import { currentApaHash } from '../server/athleteApa/currentApaCore.js';
import { APA_NARRATIVE_FIELDS, APA_NARRATIVE_CONTRACT_V1, getApaNarrativeValue,
  verifyApaNarrativeProvenance } from '../server/athleteConsultingV2/apaNarrative.js';
import { currentApaView as demoView, publishCurrentApa as demoPublish } from '../server/athleteConsultingV2/currentApa.js';
import { selectMove } from '../server/athleteAcademyV1/apa/contract.js';
import { createMainAthleteRslAdapter } from '../server/athleteAcademyV1/coaching/rsl.js';

const clone = value => structuredClone(value);
const firstMessage = '11111111-1111-4111-8111-111111111111';
const firstChange = '22222222-2222-4222-8222-222222222222';
const secondMessage = '33333333-3333-4333-8333-333333333333';
const secondChange = '44444444-4444-4444-8444-444444444444';
const at = '2026-09-27T18:01:00.000Z';

// Fictional structural replay only, never a real canonical account or evidence
// of model quality. Independent MM/account identity and recalculated accepted
// artifact hashes exercise the main lane without borrowing a fixture slug.
function canonicalCase(label = 'alpha', synthetic = false) {
  const mm = `MM-FICTIONAL-MAIN-${label.toUpperCase()}`, actorId = `fictional-account-${label}`;
  const replace = value => JSON.parse(JSON.stringify(value)
    .replaceAll(nia.person.mm, mm).replaceAll('Nia', `Mira ${label}`));
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
  return { bundle, principal };
}
function setup(options = {}) {
  const { bundle, principal } = options.account || canonicalCase();
  const source_message_id = options.messageId || firstMessage, id = options.changeId || firstChange;
  const state = { mm: bundle.person.mm, sourceBinding: clone(bundle.binding), revision: 7, status: 'active',
    messages: [{ id: source_message_id, role: 'user', speaker: 'athlete', actorId: principal.actorId,
      text: options.text || 'My priority is Make calm passing choices. Review on October 3, 2026 and plan through December 1, 2026. Tuesday practice is shorter now.',
      at: '2026-09-27T18:00:00.000Z' }] };
  const authority = Object.freeze({ testSnapshot: true });
  const calls = [];
  const adapter = createMainCurrentApaAdapter({ assertFencedAuthority(context) {
    calls.push(context.operation);
    return context.authority === authority && context.principal === principal
      && context.state === state && context.state.revision === 7;
  } });
  const confirmedChange = { actorId: principal.actorId, mm: bundle.person.mm, id, source_message_id,
    confirmed: true, confirmed_by: 'athlete', kind: options.kind || 'reality',
    supersedes: options.supersedes || [], reason: 'The fictional athlete explicitly reviewed this saved message.',
    confirmed_at: at };
  const record = options.record || null;
  const input = { bundle, principal, state, authority, confirmedChange, record,
    expectedVersion: options.expectedVersion ?? (record?.version || 0) };
  return { ...input, adapter, calls };
}
const sourceId = input => `APA:ACADEMY:${input.bundle.binding.actorId}:${input.confirmedChange.id}`;
const candidateFor = input => {
  const prior = input.adapter.currentApaView(input);
  return { confirmation: clone(prior.artifact.confirmation), report: clone(prior.artifact.report), narrative_updates: [] };
};
function material(input) {
  const candidate = candidateFor(input), source = sourceId(input);
  candidate.report.domains[1].gap = 'Tuesday practice is shorter, with less time for a calm passing cue.';
  candidate.report.domains[1].refs.push(source);
  candidate.report.futures[0].conditions = 'If the shorter Tuesday practice continues, a concise passing cue may fit.';
  candidate.report.futures[0].refs.push(source);
  return candidate;
}
function timing(input) {
  const candidate = candidateFor(input), source = sourceId(input);
  candidate.confirmation.priority = 'Make calm passing choices';
  candidate.confirmation.review_date = '2026-10-03';
  candidate.confirmation.horizon_date = '2026-12-01';
  candidate.narrative_updates = ['confirmation.priority', 'confirmation.review_date', 'confirmation.horizon_date']
    .map(field => ({ field, value: getApaNarrativeValue(candidate, field), refs: [source] }));
  return candidate;
}
function deltaFor(input) {
  return { contract: MAIN_APA_DELTA_CONTRACT, binding: clone(input.adapter.apaDeltaBinding(input)),
    domains: [], futures: [], candidates: [], narratives: [] };
}
function restoreLegacy(candidate, artifact) {
  const restored = clone(candidate);
  for (const [index, entity] of restored.report.candidates.entries()) {
    if (!Object.hasOwn(artifact.report.candidates[index], 'review_schedule') && entity.review_schedule === null)
      delete entity.review_schedule;
  }
  return restored;
}
function rehashRecord(record) {
  const artifact = record.artifact;
  const { artifact_sha256: _old, ...body } = artifact;
  artifact.artifact_sha256 = currentApaHash(body);
  let priorHash = record.binding.apa;
  for (const receipt of record.receipts) {
    receipt.prior_hash = priorHash;
    if (receipt === record.receipts.at(-1)) receipt.content_hash = artifact.artifact_sha256;
    const { receipt_hash: _receipt, ...unsigned } = receipt;
    receipt.receipt_hash = currentApaHash(unsigned); priorHash = receipt.receipt_hash;
  }
}
function resealBaseline(bundle) {
  const { artifact_sha256: _old, ...body } = bundle.apa;
  bundle.apa.artifact_sha256 = hash(body);
  bundle.binding.apa = bundle.apa.artifact_sha256;
  return bundle;
}
async function savedComposition(input, { noChange = false, failReceipt = false } = {}) {
  const events = [], stats = { providerCalls: 0, evidenceWrites: 0 };
  const compose = input.adapter.createApaComposer({ env: {},
    evidenceSink(event) {
      stats.evidenceWrites++;
      if (failReceipt && event.kind === 'receipt') throw new Error('Injected immutable receipt write failure');
      events.push(event);
    }, transport: async request => {
      stats.providerCalls++;
      const packet = JSON.parse(request.input);
      return { id: 'resp_fictional_saved_apa', status: 'completed', model: 'gpt-5.6-sol',
        usage: { total_tokens: 0 }, output_text: JSON.stringify({ contract: MAIN_APA_REFERENCE_CODEC_CONTRACT,
          binding: packet.delta_binding, domains: [], futures: [], candidates: [],
          narratives: noChange ? [] : timing(input).narrative_updates.map(update =>
            ({ field: update.field, value: update.value, cite_confirmed_update: true })),
        }) };
    } });
  let result;
  if (failReceipt) await assert.rejects(compose(input), /APA_COMPOSITION_EVIDENCE_UNAVAILABLE/u);
  else result = await compose(input);
  return { savedRequest: clone(events.find(event => event.kind === 'request')),
    savedResponse: clone(events.find(event => event.kind === 'response')), events, stats, result };
}

// This is a request that the pre-repair codec-v2 implementation could have
// durably written before its response was recovered. The current adapter owns
// both static schemas; the saved event cannot choose a decoder with a flag.
function preRepairCodecRequest(input, savedRequest) {
  const old = clone(savedRequest);
  old.request.text.format.name = 'athlete_academy_current_apa_reference_codec_v2';
  old.request.text.format.schema = input.adapter.apaReferenceCodecSchemaV2(input);
  old.basis.request_sha256 = createHash('sha256').update(JSON.stringify(old.request)).digest('hex');
  return old;
}

test('main factory is default-deny without a synchronous server authority checker', () => {
  assert.throws(() => createMainCurrentApaAdapter(), /MAIN_CURRENT_APA_FENCE_REQUIRED/u);
  const input = setup();
  for (const result of [false, undefined, {}, Promise.resolve(true)]) {
    const adapter = createMainCurrentApaAdapter({ assertFencedAuthority: () => result });
    assert.throws(() => adapter.publishCurrentApa({ ...input, candidate: material(input) }), /MAIN_CURRENT_APA_FENCE_REQUIRED/u);
  }
  assert.throws(() => input.adapter.assertCurrentApaConfirmedSource({ ...input, authority: true }), /MAIN_CURRENT_APA_FENCE_REQUIRED/u);
  assert.throws(() => input.adapter.assertCurrentApaConfirmedSource({ ...input, authority: {} }), /MAIN_CURRENT_APA_FENCE_REQUIRED/u);
});

test('owner-only reads verify the full canonical pair and never require a fixture slug', () => {
  const input = setup(), view = input.adapter.currentApaView(input);
  assert.strictEqual(view.artifact, input.bundle.apa);
  assert.deepEqual(input.bundle.binding, { actorId: input.principal.actorId, mm: input.bundle.person.mm,
    bos: input.bundle.bos.artifact_sha256, apa: input.bundle.apa.artifact_sha256 });
  assert.equal(input.bundle.person.slug, undefined);
  assert.equal(input.calls.length, 0);
  for (const principal of [{ ...input.principal, actorId: 'other' }, { ...input.principal, role: 'coach' },
    { ...input.principal, authenticated: false }, { ...input.principal, grants: { participation: true, coachingRead: true } }])
    assert.throws(() => input.adapter.currentApaView({ ...input, principal }), /COACH_(?:ACTOR_AUTHORITY|PRIVATE_ACCESS|REPORT_ACCESS)_DENIED/u);
  const altered = clone(input.bundle); altered.person.age = 16;
  assert.throws(() => input.adapter.currentApaView({ ...input, bundle: altered }), /COACH_CANONICAL_PAIR_REQUIRED/u);
  const tampered = clone(input.bundle); tampered.apa.report.headline += ' altered';
  assert.throws(() => input.adapter.currentApaView({ ...input, bundle: tampered }), /COACH_REPORT_IDENTITY_OR_INTEGRITY_FAILURE/u);
});

test('main publication keeps canonical account identity, false synthetic metadata and immutable originals', () => {
  const input = setup(), baseline = JSON.stringify(input.bundle), result = input.adapter.publishCurrentApa({ ...input, candidate: material(input) });
  assert.equal(result.record.contract, MAIN_CURRENT_APA_CONTRACT);
  assert.deepEqual(result.record.binding, input.bundle.binding);
  assert.equal(result.record.artifact.actorId, input.principal.actorId);
  assert.equal(result.record.artifact.synthetic, false);
  assert.equal(result.receipt.actorId, input.principal.actorId);
  assert.equal(result.receipt.mm, input.bundle.person.mm);
  assert.deepEqual(result.record.artifact.sources.at(-1), {
    id: sourceId(input), source: 'Athlete-confirmed coaching update', question: 'Confirmed current reality',
    text: input.state.messages[0].text.trim(), at, source_message_id: firstMessage,
    epistemic: 'ATHLETE_CONFIRMED', supersedes: [], actorId: input.principal.actorId, mm: input.bundle.person.mm,
  });
  assert.equal(input.adapter.currentApaView({ ...input, record: clone(result.record) }).version, 1);
  assert.equal(JSON.stringify(input.bundle), baseline);
  assert.deepEqual(result.record.artifact.identity, input.bundle.apa.identity);
  assert.deepEqual(result.record.artifact.bos_sources, input.bundle.apa.bos_sources);
  assert.deepEqual(result.record.artifact.report.coach_view, input.bundle.apa.report.coach_view);
  assert.deepEqual(result.record.artifact.existing_plan, input.bundle.apa.existing_plan);
  assert.deepEqual({ status: result.record.artifact.status, move: result.record.artifact.move,
    receipt: result.record.artifact.receipt }, selectMove(result.record.artifact.report));
  assert.throws(() => demoView(input.bundle, result.record), /CURRENT_APA_SYNTHETIC_ONLY/u);
});

test('main baseline hash alone cannot replace full schema, calendar and deterministic-selection validation', () => {
  const input = setup();
  const unknownField = clone(input.bundle); unknownField.apa.report.unreviewed = 'Extra report field';
  assert.throws(() => input.adapter.currentApaView({ ...input, bundle: resealBaseline(unknownField) }), /CURRENT_APA_REPORT_SCHEMA_INVALID/u);
  const invalidDate = clone(input.bundle); invalidDate.apa.confirmation.review_date = '2026-02-30';
  assert.throws(() => input.adapter.currentApaView({ ...input, bundle: resealBaseline(invalidDate) }), /CURRENT_APA_CONFIRMATION_INVALID/u);
  const wrongMove = clone(input.bundle); wrongMove.apa.move = null;
  assert.throws(() => input.adapter.currentApaView({ ...input, bundle: resealBaseline(wrongMove) }), /CURRENT_APA_MOVE_SELECTION_CHANGED/u);
});

test('main reads legacy five-field provenance honestly and upgrades eight fields without rewriting original hashes', () => {
  const original = canonicalCase(), bundle = clone(original.bundle);
  const oldProvenance = verifyApaNarrativeProvenance(bundle.apa);
  bundle.apa.narrative_provenance = { contract: APA_NARRATIVE_CONTRACT_V1, fields: oldProvenance.fields.slice(0, 5) };
  resealBaseline(bundle);
  const input = setup({ account: { bundle, principal: original.principal } }), before = JSON.stringify(bundle);
  const view = input.adapter.currentApaView(input);
  assert.equal(view.artifact.narrative_provenance.fields.length, 5);
  assert.equal(verifyApaNarrativeProvenance(view.artifact).fields[5].status, 'BASELINE_UNCITED_AT_FIELD_LEVEL');
  const result = input.adapter.publishCurrentApa({ ...input, candidate: timing(input) });
  assert.equal(result.record.artifact.narrative_provenance.fields.length, 8);
  assert.equal(result.record.artifact.narrative_provenance.fields[5].status, 'SOURCE_BOUND');
  assert.equal(result.record.artifact.baseline_artifact_sha256, bundle.apa.artifact_sha256);
  assert.equal(JSON.stringify(bundle), before);
  assert.equal(input.adapter.currentApaView({ ...input, record: clone(result.record) }).version, 1);
});

test('main canonical synthetic metadata is preserved rather than inferred by the shared core', () => {
  const input = setup({ account: canonicalCase('synthetic', true) });
  const result = input.adapter.publishCurrentApa({ ...input, candidate: material(input) });
  assert.equal(result.record.artifact.synthetic, true);
  assert.equal(result.record.artifact.actorId, 'fictional-account-synthetic');
  assert.equal(result.record.binding.slug, undefined);
});

test('main priority and dates require the exact confirmed same-account message and honest typed receipts', () => {
  const input = setup(), result = input.adapter.publishCurrentApa({ ...input, candidate: timing(input) });
  assert.equal(result.changed, true);
  assert.equal(result.record.artifact.confirmation.priority, 'Make calm passing choices');
  assert.equal(result.record.artifact.confirmation.review_date, '2026-10-03');
  assert.equal(result.record.artifact.confirmation.horizon_date, '2026-12-01');
  assert.equal(result.record.artifact.confirmation.assessment_date, input.bundle.apa.confirmation.assessment_date);
  assert.equal(result.receipt.prior_artifact_sha256, input.bundle.apa.artifact_sha256);
  assert.equal(result.receipt.prior_version, 0);
  assert.deepEqual(result.receipt.narrative_changes.map(change => change.field),
    ['confirmation.priority', 'confirmation.review_date', 'confirmation.horizon_date']);
  assert.equal(result.receipt.narrative_changes[0].before_refs, null);
  assert.deepEqual(result.receipt.narrative_changes[0].after_refs, [sourceId(input)]);
  assert.deepEqual(result.record.artifact.sources.find(source => source.id === 'CONFIRM'),
    input.bundle.apa.sources.find(source => source.id === 'CONFIRM'));
});

test('canonical account/source identity rejects coach, capture, cross-account and stale source-pair changes', async context => {
  const mutations = {
    'wrong message actor': input => { input.state.messages[0].actorId = 'other'; },
    'wrong optional message MM': input => { input.state.messages[0].mm = 'other'; },
    'wrong state MM': input => { input.state.mm = 'other'; },
    'wrong source pair': input => { input.state.sourceBinding.apa = 'a'.repeat(64); },
    'missing source pair': input => { delete input.state.sourceBinding; },
    'coach message': input => { input.state.messages[0].speaker = 'coach'; },
    'captured note': input => { input.state.messages[0].capture = { source: 'Coach Alex' }; },
    'wrong confirmation actor': input => { input.confirmedChange.actorId = 'other'; },
    'wrong confirmation MM': input => { input.confirmedChange.mm = 'other'; },
    'fixture identity smuggling': input => { input.confirmedChange.athlete_slug = 'nia'; },
    'missing explicit confirmation': input => { input.confirmedChange.confirmed = false; },
  };
  for (const [name, mutate] of Object.entries(mutations)) await context.test(name, () => {
    const input = setup(), candidate = material(input); mutate(input);
    assert.throws(() => input.adapter.publishCurrentApa({ ...input, candidate }), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
  });
});

test('main date grounding cannot use caller-picked text, relative dates or a current plan approval', () => {
  const input = setup(), candidate = timing(input);
  input.state.messages[0].text = 'Tomorrow sounds fine. I approved a plan, not a new follow-up date.';
  input.state.plan = { accepted_at: at, review: 'October 3, 2026' };
  assert.throws(() => input.adapter.publishCurrentApa({ ...input, candidate,
    confirmedSource: { text: 'Make calm passing choices. October 3, 2026. December 1, 2026.' } }), /APA_NARRATIVE_SOURCE_TEXT_REQUIRED/u);
});

test('main typed delta contract is account/hash/source bound with no synthetic or fixture binding fields', () => {
  const input = setup(), delta = deltaFor(input), candidate = timing(input);
  assert.deepEqual(MAIN_APA_DELTA_SCHEMA.properties.binding.required,
    ['actorId', 'mm', 'bos_sha256', 'baseline_apa_sha256', 'current_apa_sha256', 'current_apa_version', 'source_id', 'source_message_id']);
  assert.equal(MAIN_APA_DELTA_SCHEMA.properties.binding.additionalProperties, false);
  assert.equal(MAIN_APA_DELTA_SCHEMA.properties.narratives.maxItems, 8);
  assert.equal(delta.binding.actorId, input.principal.actorId);
  assert.equal(delta.binding.synthetic, undefined); assert.equal(delta.binding.athlete_slug, undefined);
  delta.narratives = candidate.narrative_updates;
  const reconstructed = input.adapter.reconstructApaDelta({ ...input, delta });
  assert.equal(reconstructed.receipt.contract, 'athlete_academy_current_apa_delta_reconstruction_v1');
  const direct = input.adapter.publishCurrentApa({ ...input, candidate });
  const reduced = input.adapter.publishCurrentApa({ ...input,
    candidate: restoreLegacy(reconstructed.candidate, input.bundle.apa) });
  assert.deepEqual(reduced.record, direct.record);
  assert.equal(JSON.stringify(reconstructed.receipt).includes(input.state.messages[0].text), false);
});

test('main reconstruction rejects forged prior/source, fixture contract and cross-account bindings', () => {
  const input = setup(), delta = deltaFor(input), source = input.adapter.assertCurrentApaConfirmedSource(input).source;
  for (const binding of [{ ...delta.binding, actorId: 'other' }, { ...delta.binding, athlete_slug: 'nia' },
    { ...delta.binding, synthetic: true }])
    assert.throws(() => input.adapter.reconstructApaDelta({ ...input, delta: { ...delta, binding } }), /APA_DELTA_(?:BINDING_MISMATCH|SCHEMA_INVALID)/u);
  assert.throws(() => input.adapter.reconstructApaDelta({ ...input, delta: { ...delta, contract: 'athlete_current_apa_delta_v1' } }), /APA_DELTA_SCHEMA_INVALID/u);
  assert.throws(() => input.adapter.reconstructApaDelta({ ...input, delta,
    confirmedSource: { ...source, text: 'Caller-picked evidence.' } }), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u);
  const prior = input.adapter.currentApaView(input); prior.version = 1;
  assert.throws(() => input.adapter.apaDeltaBinding({ ...input, prior }), /APA_DELTA_PRIOR_INVALID/u);
});

test('main correction requires explicit unknown/affected eight-field review and preserves original evidence', () => {
  const first = setup(), published = first.adapter.publishCurrentApa({ ...first, candidate: timing(first) });
  const second = setup({ record: published.record, messageId: secondMessage, changeId: secondChange,
    kind: 'correction', supersedes: [sourceId(first)],
    text: 'Correction: my priority is Keep practice manageable. Review on October 10, 2026 and plan through December 15, 2026.' });
  const candidate = candidateFor(second);
  candidate.confirmation.priority = 'Keep practice manageable';
  candidate.confirmation.review_date = '2026-10-10'; candidate.confirmation.horizon_date = '2026-12-15';
  assert.throws(() => second.adapter.publishCurrentApa({ ...second, candidate }), /APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED/u);
  candidate.narrative_updates = APA_NARRATIVE_FIELDS.map(field => ({ field,
    value: clone(getApaNarrativeValue(candidate, field)), refs: [sourceId(second)] }));
  const result = second.adapter.publishCurrentApa({ ...second, candidate });
  assert.equal(result.record.version, 2);
  assert.equal(result.receipt.prior_hash, published.receipt.receipt_hash);
  assert.equal(result.receipt.prior_artifact_sha256, published.record.artifact.artifact_sha256);
  assert.deepEqual(result.receipt.supersedes, [sourceId(first)]);
  assert.deepEqual(result.record.artifact.sources.slice(0, second.bundle.apa.sources.length), second.bundle.apa.sources);
  assert.equal(second.adapter.currentApaView({ ...second, record: clone(result.record) }).version, 2);
});

test('main cold read rejects rehashed source/receipt/account/narrative lineage tampering', async context => {
  const input = setup(), published = input.adapter.publishCurrentApa({ ...input, candidate: timing(input) });
  for (const [name, mutate] of [
    ['source actor', record => { record.artifact.sources.at(-1).actorId = 'other'; }],
    ['receipt actor', record => { record.receipts[0].actorId = 'other'; }],
    ['current artifact actor', record => { record.artifact.actorId = 'other'; }],
    ['synthetic flip', record => { record.artifact.synthetic = true; }],
    ['invented before', record => { record.receipts[0].narrative_changes[0].before = 'Invented prior'; }],
    ['missing prior artifact link', record => { delete record.receipts[0].prior_artifact_sha256; }],
  ]) await context.test(name, () => {
    const record = clone(published.record); mutate(record); rehashRecord(record);
    assert.throws(() => input.adapter.currentApaView({ ...input, record }), /CURRENT_APA_|APA_NARRATIVE_PROVENANCE_INVALID/u);
  });
});

test('main record cannot be transplanted to another canonical account even with matching artifact structure', () => {
  const input = setup(), published = input.adapter.publishCurrentApa({ ...input, candidate: material(input) });
  const other = setup({ account: canonicalCase('other') });
  assert.throws(() => other.adapter.currentApaView({ ...other, record: published.record }), /CURRENT_APA_RECORD_INVALID/u);
  assert.throws(() => input.adapter.publishCurrentApa({ ...input, expectedVersion: 1, candidate: material(input) }), /CURRENT_APA_STALE_VERSION/u);
});

test('main preserves frozen assessment, Coach view and BOS refs under the identical youth gates', () => {
  const input = setup();
  const alteredDate = material(input); alteredDate.confirmation.assessment_date = '2026-01-01';
  assert.throws(() => input.adapter.publishCurrentApa({ ...input, candidate: alteredDate }), /CURRENT_APA_CONFIRMATION_INVALID/u);
  const alteredCoach = material(input); alteredCoach.report.coach_view.summary = 'Invented Coach agreement';
  assert.throws(() => input.adapter.publishCurrentApa({ ...input, candidate: alteredCoach }), /CURRENT_APA_COACH_VIEW_UNVERIFIED/u);
  const alteredBos = material(input); alteredBos.report.domains[1].bos_refs = [];
  assert.throws(() => input.adapter.publishCurrentApa({ ...input, candidate: alteredBos }), /UNRESOLVED_SOURCE_REFERENCE/u);
  const candidate = material(input), source = sourceId(input);
  for (const entity of candidate.report.candidates) {
    entity.refs.push(source); entity.gates[0].refs.push(source); entity.gates[0].pass = false;
    entity.gates[0].reason = 'The athlete has not agreed to this proposed test.';
  }
  const result = input.adapter.publishCurrentApa({ ...input, candidate });
  assert.equal(result.record.artifact.move, null); assert.equal(result.record.artifact.status, 'needs_confirmation');
});

test('main injected composer retains complete canonical input, exact provider policy and private staged output', async () => {
  const input = setup(), evidence = [], requests = [], baseline = JSON.stringify(input.bundle);
  const compose = input.adapter.createApaComposer({ env: {}, evidenceSink: event => { evidence.push(event); },
    transport: async request => {
      requests.push(request);
      const packet = JSON.parse(request.input);
      return { status: 'completed', model: 'gpt-5.6-sol', usage: { total_tokens: 0 }, output_text: JSON.stringify({
        contract: MAIN_APA_REFERENCE_CODEC_CONTRACT, binding: packet.delta_binding, domains: [], futures: [], candidates: [],
        narratives: timing(input).narrative_updates.map(update =>
          ({ field: update.field, value: update.value, cite_confirmed_update: true })),
      }) };
    } });
  const result = await compose(input), packet = JSON.parse(requests[0].input);
  assert.deepEqual(evidence.map(event => event.kind), ['request', 'response', 'receipt']);
  assert.equal(requests.length, 1);
  assert.equal(result.changed, true); assert.equal(result.publication_performed, false);
  assert.equal(input.record, null); assert.equal(JSON.stringify(input.bundle), baseline);
  assert.equal(packet.contract, 'athlete_academy_current_apa_composition_packet_v2');
  assert.deepEqual(packet.current_approval_context.approved_learning, []);
  assert.equal(packet.current_approval_context.accepted_plan, null);
  assert.deepEqual(packet.current_approval_context.selected_athlete, packet.selected_athlete);
  assert.equal(evidence[0].basis.approval_context_sha256,
    createHash('sha256').update(JSON.stringify(packet.current_approval_context)).digest('hex'));
  assert.deepEqual(packet.selected_athlete, { actorId: input.principal.actorId, mm: input.bundle.person.mm,
    synthetic: false, bos_sha256: input.bundle.bos.artifact_sha256 });
  assert.equal(packet.selected_athlete.slug, undefined);
  assert.deepEqual(packet.original_apa.report, input.bundle.apa.report);
  assert.deepEqual(packet.original_apa.sources, input.bundle.apa.sources);
  assert.deepEqual(packet.original_apa.bos_sources, input.bundle.apa.bos_sources);
  assert.deepEqual(packet.accepted_bos, { reading: input.bundle.bos.reading, evidence: input.bundle.bos.evidence });
  assert.equal(packet.saved_athlete_confirmation.text, input.state.messages[0].text);
  assert.equal(packet.saved_athlete_confirmation.actorId, input.principal.actorId);
  assert.equal(packet.saved_athlete_confirmation.mm, input.bundle.person.mm);
  assert.deepEqual(packet.current_apa, { artifact_sha256: input.bundle.apa.artifact_sha256,
    same_as_original_apa: true, original_apa_sha256: input.bundle.apa.artifact_sha256 });
  assert.deepEqual(requests[0].text.format.schema, input.adapter.apaReferenceCodecSchema(input));
  assert.equal(Object.isFrozen(requests[0].text.format.schema), true);
  assert.equal(requests[0].model, 'gpt-5.6-sol'); assert.equal(requests[0].reasoning.effort, 'xhigh');
  assert.equal(requests[0].store, false); assert.equal(requests[0].max_output_tokens, 30000);
  assert.equal(MAIN_APA_COMPOSITION_POLICY.max_retries, 0); assert.equal(MAIN_APA_COMPOSITION_POLICY.synthetic_only, undefined);
  assert.equal(evidence[2].receipt.actorId, input.principal.actorId);
  assert.equal(evidence[2].receipt.athlete_slug, undefined);
  assert.equal(evidence[2].receipt.publication_performed, false);
  const published = input.adapter.publishCurrentApa({ ...input, candidate: result.candidate });
  assert.equal(published.record.artifact.artifact_sha256, evidence[2].receipt.preview_content_hash);
});

test('main read-only approval context supplies only the exact owner current memory and private accepted plan', async () => {
  const input = setup(), when = '2026-09-27T18:00:00.000Z';
  const body = { title: 'Existing athlete-only step', why: 'Already reviewed.',
    steps: [{ action: 'Use one cue.', when: 'Friday', notice: 'Whether it helps.', owner: 'athlete' }], review: 'After Friday' };
  input.state.plan = { ...body, id: 'accepted-main-plan', hash: hash(body), accepted_at: when,
    approvals: [{ actorId: input.principal.actorId, hash: hash(body), at: when }], visibility: 'private' };
  input.state.learning = [
    { id: 'owner-preference', text: 'Question first.', approved_at: when, speaker: 'athlete', actorId: input.principal.actorId },
    { id: 'foreign', text: 'Other person.', approved_at: when, speaker: 'athlete', actorId: 'another' },
    { id: 'coach', text: 'Coach opinion.', approved_at: when, speaker: 'coach', actorId: input.principal.actorId },
    { id: 'legacy-unknown', text: 'Unknown actor.', approved_at: when, speaker: 'athlete' },
  ];
  input.state.suggestedLearning = ['Not approved.'];
  input.state.draft = { ...body, title: 'Proposed only' };
  const before = clone(input.state), events = [];
  const compose = input.adapter.createApaComposer({ env: {}, evidenceSink: event => events.push(event), transport: async request => {
    const packet = JSON.parse(request.input), context = packet.current_approval_context;
    assert.deepEqual(context.approved_learning.map(item => item.id), ['owner-preference']);
    assert.equal(context.approved_learning[0].actorId, input.principal.actorId);
    assert.deepEqual(context.accepted_plan.approvals, input.state.plan.approvals);
    assert.equal(context.accepted_plan.hash, hash(body));
    assert.equal(JSON.stringify(context).includes('Proposed only'), false);
    return { status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify({
      contract: MAIN_APA_REFERENCE_CODEC_CONTRACT, binding: packet.delta_binding,
      domains: [], futures: [], candidates: [], narratives: [],
    }) };
  } });
  const result = await compose(input);
  assert.equal(result.changed, false); assert.equal(result.publication_performed, false);
  assert.deepEqual(input.state, before);
  const reader = createMainAthleteRslAdapter({ assertFencedAuthority: () => false });
  input.state.learning = [];
  assert.deepEqual(reader.currentApprovalSnapshot(input).approved_learning, []);
  assert.throws(() => reader.currentApprovalSnapshot({ ...input,
    principal: { ...input.principal, actorId: 'foreign' } }), /COACH_.*DENIED|COACH_.*MISMATCH/u);
});

test('main approval snapshot rejects foreign approvals, shared/coach-owned plans and changed accepted bytes', () => {
  const input = setup(), reader = createMainAthleteRslAdapter({ assertFencedAuthority: () => false });
  const when = '2026-09-27T18:00:00.000Z';
  const body = { title: 'A current step', why: 'Approved.',
    steps: [{ action: 'One cue.', when: 'Friday', notice: 'What happens.', owner: 'athlete' }], review: 'Later' };
  const accepted = { ...body, id: 'plan', hash: hash(body), accepted_at: when,
    approvals: [{ actorId: input.principal.actorId, hash: hash(body), at: when }], visibility: 'private' };
  for (const fault of ['foreign', 'shared', 'coach', 'edited']) {
    input.state.plan = clone(accepted);
    if (fault === 'foreign') input.state.plan.approvals[0].actorId = 'foreign';
    if (fault === 'shared') input.state.plan.visibility = 'shared';
    if (fault === 'coach') input.state.plan.steps[0].owner = 'coach';
    if (fault === 'edited') input.state.plan.steps[0].action = 'Unapproved replacement.';
    assert.throws(() => reader.currentApprovalSnapshot(input), /ATHLETE_RSL_PLAN_NOT_ACCEPTED/u);
  }
});

test('main composer rejects unverified account sources before injected dispatch and rechecks fence afterward', async () => {
  const input = setup(); let calls = 0;
  const compose = input.adapter.createApaComposer({ env: {}, evidenceSink() {}, transport: async () => { calls++; } });
  input.state.messages[0].actorId = 'other';
  await assert.rejects(compose(input), /CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED/u); assert.equal(calls, 0);
  const valid = setup(), authority = valid.authority; let allowed = true;
  const adapter = createMainCurrentApaAdapter({ assertFencedAuthority: context => allowed && context.authority === authority });
  const events = [];
  const guarded = adapter.createApaComposer({ env: {}, evidenceSink: event => { events.push(event); }, transport: async request => {
    calls++; const packet = JSON.parse(request.input); allowed = false;
    return { status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify({
      contract: MAIN_APA_REFERENCE_CODEC_CONTRACT, binding: packet.delta_binding, domains: [], futures: [], candidates: [], narratives: [],
    }) };
  } });
  await assert.rejects(guarded({ ...valid, authority }), /APA_COMPOSITION_CANDIDATE_INVALID/u);
  assert.equal(calls, 1); assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
  assert.equal(valid.record, null);
});

test('demo remains Nia/Sofia pinned and cannot publish the main account source shape', () => {
  const input = setup(), candidate = material(input);
  assert.throws(() => demoPublish({ ...input, candidate }), /CURRENT_APA_SYNTHETIC_ONLY/u);
  assert.equal(demoView(nia).artifact.synthetic, true);
  assert.equal(demoView(nia).version, 0);
});

test('pure saved APA recovery reproduces the exact private candidate and preview with no new call, evidence or publication', async () => {
  const input = setup(), saved = await savedComposition(input), beforeCalls = clone(saved.stats);
  input.state.status = 'unknown'; input.calls.length = 0;
  const before = JSON.stringify({ bundle: input.bundle, state: input.state,
    savedRequest: saved.savedRequest, savedResponse: saved.savedResponse });
  const recovered = input.adapter.recoverApaComposition({ ...input, ...saved });
  assert.deepEqual(recovered.candidate, saved.result.candidate);
  assert.equal(recovered.changed, saved.result.changed);
  assert.equal(recovered.receipt.preview_content_hash, saved.result.receipt.preview_content_hash);
  assert.equal(recovered.previewRecord.artifact.artifact_sha256, recovered.receipt.preview_content_hash);
  assert.equal(recovered.previewRecord.version, 1);
  assert.equal(recovered.receipt.id, saved.savedRequest.id);
  assert.equal(recovered.receipt.original_response_id, saved.savedResponse.id);
  assert.equal(recovered.receipt.provider_response_id, 'resp_fictional_saved_apa');
  assert.equal(recovered.receipt.completed_at, null);
  assert.equal(recovered.receipt.recovery_performed, true); assert.equal(recovered.receipt.no_provider_call, true);
  assert.equal(recovered.publication_performed, false); assert.equal(recovered.receipt.publication_performed, false);
  assert.deepEqual(saved.stats, beforeCalls); assert.equal(input.record, null);
  assert.ok(input.calls.length > 0); assert.deepEqual(new Set(input.calls), new Set(['recovery']));
  assert.equal(JSON.stringify({ bundle: input.bundle, state: input.state,
    savedRequest: saved.savedRequest, savedResponse: saved.savedResponse }), before);
  const duplicate = input.adapter.recoverApaComposition({ ...input, ...saved });
  assert.deepEqual(duplicate, recovered); assert.deepEqual(saved.stats, beforeCalls);
});

test('saved response can recover after final evidence receipt failure without replaying the provider or sink', async () => {
  const input = setup(), saved = await savedComposition(input, { failReceipt: true }), before = clone(saved.stats);
  assert.deepEqual(saved.events.map(event => event.kind), ['request', 'response', 'failure']);
  input.state.status = 'unknown';
  const recovered = input.adapter.recoverApaComposition({ ...input, ...saved });
  assert.equal(recovered.changed, true); assert.equal(recovered.previewRecord.version, 1);
  assert.deepEqual(saved.stats, before); assert.equal(saved.stats.providerCalls, 1);
});

test('saved no-change APA recovery remains honestly unpublished and does not fabricate a preview record', async () => {
  const input = setup(), saved = await savedComposition(input, { noChange: true });
  const recovered = input.adapter.recoverApaComposition({ ...input, ...saved });
  assert.equal(recovered.changed, false); assert.equal(recovered.previewRecord, null);
  assert.equal(recovered.receipt.preview_content_hash, input.bundle.apa.artifact_sha256);
  assert.equal(recovered.receipt.status, 'no_material_change'); assert.deepEqual(recovered.receipt.material_paths, []);
  assert.equal(saved.stats.providerCalls, 1); assert.equal(input.record, null);
});

test('saved APA recovery rejects missing events, mismatched invocation IDs and canonical basis/hash/policy drift', async context => {
  const input = setup(), original = await savedComposition(input), baselineCalls = clone(original.stats);
  for (const [name, mutate] of [
    ['missing request', saved => { saved.savedRequest = null; }],
    ['missing response', saved => { saved.savedResponse = null; }],
    ['wrong event kind', saved => { saved.savedResponse.kind = 'receipt'; }],
    ['response invocation ID', saved => { saved.savedResponse.id = secondMessage; }],
    ['basis invocation ID', saved => { saved.savedRequest.basis.id = secondMessage; }],
    ['invalid event ID', saved => { saved.savedRequest.id = 'not-an-invocation'; }],
    ['basis actor', saved => { saved.savedRequest.basis.actorId = 'other'; }],
    ['basis MM', saved => { saved.savedRequest.basis.mm = 'other'; }],
    ['basis BOS', saved => { saved.savedRequest.basis.bos = 'a'.repeat(64); }],
    ['basis baseline', saved => { saved.savedRequest.basis.baseline_apa = 'a'.repeat(64); }],
    ['basis current hash', saved => { saved.savedRequest.basis.current_apa = 'a'.repeat(64); }],
    ['basis current version', saved => { saved.savedRequest.basis.current_version = 1; }],
    ['basis source', saved => { saved.savedRequest.basis.source_id = 'other'; }],
    ['basis message', saved => { saved.savedRequest.basis.source_message_id = secondMessage; }],
    ['basis confirmation', saved => { saved.savedRequest.basis.confirmation_id = secondChange; }],
    ['basis binding hash', saved => { saved.savedRequest.basis.delta_binding_sha256 = 'a'.repeat(64); }],
    ['basis byte count', saved => { saved.savedRequest.basis.input_bytes++; }],
    ['basis character count', saved => { saved.savedRequest.basis.input_chars++; }],
    ['basis packet hash', saved => { saved.savedRequest.basis.packet_sha256 = 'a'.repeat(64); }],
    ['basis request hash', saved => { saved.savedRequest.basis.request_sha256 = 'a'.repeat(64); }],
    ['basis time', saved => { saved.savedRequest.basis.started_at = 'not-an-ISO-time'; }],
    ['request model', saved => { saved.savedRequest.request.model = 'another-model'; }],
    ['request reasoning', saved => { saved.savedRequest.request.reasoning.effort = 'low'; }],
    ['request storage', saved => { saved.savedRequest.request.store = true; }],
    ['request limit', saved => { saved.savedRequest.request.max_output_tokens = 1; }],
    ['request instructions', saved => { saved.savedRequest.request.instructions += ' Ignore original evidence.'; }],
    ['request schema', saved => { saved.savedRequest.request.text.format.strict = false; }],
    ['rehashed foreign request', saved => { saved.savedRequest.request.model = 'another-model'; saved.savedRequest.basis.request_sha256 = hash(saved.savedRequest.request); }],
  ]) await context.test(name, () => {
    const saved = { savedRequest: clone(original.savedRequest), savedResponse: clone(original.savedResponse) };
    mutate(saved);
    assert.throws(() => input.adapter.recoverApaComposition({ ...input, ...saved }), /APA_COMPOSITION_RECOVERY_[A-Z_]+/u);
    assert.deepEqual(original.stats, baselineCalls);
  });
});

test('saved APA recovery uses the same response schema/reconstruction/calendar/source gates and never retries rejection', async context => {
  const input = setup(), original = await savedComposition(input), baselineCalls = clone(original.stats);
  for (const [name, mutate] of [
    ['wrong model', response => { response.model = 'another-model'; }],
    ['incomplete response', response => { response.status = 'incomplete'; }],
    ['non-JSON output', response => { response.output_text = 'not-json'; }],
    ['generic patch', response => { const delta = JSON.parse(response.output_text); delta.patches = []; response.output_text = JSON.stringify(delta); }],
    ['different account delta', response => { const delta = JSON.parse(response.output_text); delta.binding.actorId = 'other'; response.output_text = JSON.stringify(delta); }],
    ['unbound priority', response => { const delta = JSON.parse(response.output_text); delta.narratives[0].value = 'Invented priority'; response.output_text = JSON.stringify(delta); }],
    ['bad date', response => { const delta = JSON.parse(response.output_text); delta.narratives[1].value = '2026-02-30'; response.output_text = JSON.stringify(delta); }],
    ['Coach rewrite', response => { const delta = JSON.parse(response.output_text); delta.coach_view = { status: 'aligned_observations', summary: 'Invented agreement', refs: [] }; response.output_text = JSON.stringify(delta); }],
  ]) await context.test(name, () => {
    const savedResponse = clone(original.savedResponse); mutate(savedResponse.response);
    assert.throws(() => input.adapter.recoverApaComposition({ ...input,
      savedRequest: original.savedRequest, savedResponse }), /APA_COMPOSITION_(?:RESPONSE_|MODEL_MISMATCH|CANDIDATE_INVALID)/u);
    assert.deepEqual(original.stats, baselineCalls); assert.equal(input.record, null);
  });
});

test('saved APA recovery cannot rebind evidence to edited, Coach or different-account source state', async context => {
  for (const [name, mutate] of [
    ['edited canonical message', input => { input.state.messages[0].text += ' A later change.'; }],
    ['Coach source', input => { input.state.messages[0].speaker = 'coach'; }],
    ['captured source', input => { input.state.messages[0].capture = { source: 'Coach Alex' }; }],
    ['different message owner', input => { input.state.messages[0].actorId = 'other'; }],
    ['other source binding', input => { input.state.sourceBinding.apa = 'a'.repeat(64); }],
    ['stale APA version', input => { input.expectedVersion = 1; }],
  ]) await context.test(name, async () => {
    const input = setup(), saved = await savedComposition(input), before = clone(saved.stats); mutate(input);
    assert.throws(() => input.adapter.recoverApaComposition({ ...input, ...saved }), /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH|CURRENT_APA_(?:ATHLETE_CONFIRMATION_REQUIRED|STALE_VERSION)/u);
    assert.deepEqual(saved.stats, before);
  });
});

test('recovery authority is explicit and synchronous, never a caller-selected live-operation bypass', async () => {
  const input = setup(), saved = await savedComposition(input);
  const operations = [];
  const recoveryOnly = createMainCurrentApaAdapter({ assertFencedAuthority(context) {
    operations.push(context.operation);
    return context.operation === 'recovery' && context.authority === input.authority
      && context.state === input.state && context.state.status === 'unknown';
  } });
  input.state.status = 'unknown';
  const recovered = recoveryOnly.recoverApaComposition({ ...input, ...saved });
  assert.equal(recovered.changed, true); assert.deepEqual(new Set(operations), new Set(['recovery']));
  assert.throws(() => recoveryOnly.publishCurrentApa({ ...input, candidate: recovered.candidate, operation: 'recovery' }), /MAIN_CURRENT_APA_FENCE_REQUIRED/u);
  assert.throws(() => recoveryOnly.recoverApaComposition({ ...input, ...saved, authority: {} }), /MAIN_CURRENT_APA_FENCE_REQUIRED/u);
  const asynchronous = createMainCurrentApaAdapter({ assertFencedAuthority: async () => true });
  assert.throws(() => asynchronous.recoverApaComposition({ ...input, ...saved }), /MAIN_CURRENT_APA_FENCE_REQUIRED/u);
});

test('current approval request recovery ignores status revision only, not changed approved context', async () => {
  const input = setup(), saved = await savedComposition(input), before = clone(saved.stats);
  input.state.status = 'unknown'; input.state.revision++;
  const reader = createMainCurrentApaAdapter({ assertFencedAuthority: context =>
    context.operation === 'recovery' && context.authority === input.authority
    && context.principal === input.principal && context.state === input.state });
  const recovered = reader.recoverApaComposition({ ...input, ...saved });
  assert.equal(recovered.receipt.no_provider_call, true); assert.deepEqual(saved.stats, before);
  input.state.learning = [{ id: 'changed-after-request', text: 'Different approved preference.',
    speaker: 'athlete', actorId: input.principal.actorId, approved_at: at }];
  assert.throws(() => reader.recoverApaComposition({ ...input, ...saved }), /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u);
});

test('recovery rejects never-emitted new approval packet with old raw-reference schema/prompt hybrid', async () => {
  const input = setup(), saved = await savedComposition(input), request = clone(saved.savedRequest);
  const appendix = request.request.instructions.slice(MAIN_APA_COMPOSITION_INSTRUCTIONS.length);
  assert.match(appendix, /CURRENT APPROVAL CONTEXT/u);
  request.request.instructions = MAIN_APA_LEGACY_COMPOSITION_INSTRUCTIONS + appendix;
  request.request.text.format.name = 'athlete_academy_current_apa_delta';
  request.request.text.format.schema = MAIN_APA_DELTA_SCHEMA;
  request.basis.request_sha256 = createHash('sha256').update(JSON.stringify(request.request)).digest('hex');
  input.state.status = 'unknown';
  assert.throws(() => input.adapter.recoverApaComposition({ ...input, ...saved,
    savedRequest: request }), /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u);
});

test('exact old codec request recovery does not reinterpret unverified legacy approval state', async () => {
  const input = setup(), saved = await savedComposition(input), old = clone(saved.savedRequest);
  const packet = JSON.parse(old.request.input);
  packet.contract = 'athlete_academy_current_apa_composition_packet_v1'; delete packet.current_approval_context;
  old.request.input = JSON.stringify(packet); old.request.instructions = MAIN_APA_COMPOSITION_INSTRUCTIONS;
  delete old.basis.approval_context_contract; delete old.basis.approval_context_sha256;
  old.basis.input_chars = old.request.input.length; old.basis.input_bytes = Buffer.byteLength(old.request.input);
  old.basis.packet_sha256 = createHash('sha256').update(old.request.input).digest('hex');
  old.basis.request_sha256 = createHash('sha256').update(JSON.stringify(old.request)).digest('hex');
  input.state.status = 'unknown';
  input.state.plan = { id: 'unverified-old-plan', title: 'Preserved old agreement wording' };
  const reader = createMainAthleteRslAdapter({ assertFencedAuthority: () => false });
  assert.throws(() => reader.currentApprovalSnapshot(input), /ATHLETE_RSL_PLAN_NOT_ACCEPTED/u);
  const before = clone(saved.stats);
  const recovered = input.adapter.recoverApaComposition({ ...input, ...saved, savedRequest: old });
  assert.equal(recovered.receipt.no_provider_call, true);
  assert.deepEqual(recovered.candidate, saved.result.candidate); assert.deepEqual(saved.stats, before);
  assert.equal(input.state.plan.title, 'Preserved old agreement wording');
});

test('main recovery accepts an exact pre-repair codec-v2 request without replaying provider or publication', async () => {
  const input = setup(), saved = await savedComposition(input), before = clone(saved.stats);
  const savedRequest = preRepairCodecRequest(input, saved.savedRequest);
  assert.notDeepEqual(savedRequest.request.text.format.schema, saved.savedRequest.request.text.format.schema);
  assert.equal(savedRequest.request.text.format.name, 'athlete_academy_current_apa_reference_codec_v2');
  input.state.status = 'unknown'; input.calls.length = 0;
  const original = JSON.stringify({ bundle: input.bundle, state: input.state, savedRequest, savedResponse: saved.savedResponse });
  const recovered = input.adapter.recoverApaComposition({ ...input, savedRequest, savedResponse: saved.savedResponse });
  assert.deepEqual(recovered.candidate, saved.result.candidate);
  assert.equal(recovered.receipt.preview_content_hash, saved.result.receipt.preview_content_hash);
  assert.equal(recovered.receipt.no_provider_call, true);
  assert.equal(recovered.publication_performed, false);
  assert.deepEqual(new Set(input.calls), new Set(['recovery']));
  assert.deepEqual(saved.stats, before); assert.equal(input.record, null);
  assert.equal(JSON.stringify({ bundle: input.bundle, state: input.state, savedRequest, savedResponse: saved.savedResponse }), original);

  const edited = clone(savedRequest);
  edited.request.text.format.schema.properties.candidates.maxItems = 4;
  edited.basis.request_sha256 = createHash('sha256').update(JSON.stringify(edited.request)).digest('hex');
  assert.throws(() => input.adapter.recoverApaComposition({ ...input, savedRequest: edited,
    savedResponse: saved.savedResponse }), /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u);
  const mixed = clone(savedRequest);
  mixed.request.text.format.name = saved.savedRequest.request.text.format.name;
  mixed.basis.request_sha256 = createHash('sha256').update(JSON.stringify(mixed.request)).digest('hex');
  assert.throws(() => input.adapter.recoverApaComposition({ ...input, savedRequest: mixed,
    savedResponse: saved.savedResponse }), /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u);
  assert.deepEqual(saved.stats, before);
});

test('main pre-repair codec-v2 recovery preserves a source-normalized gate restatement rejected by v3 wire schema', async () => {
  const input = setup(), saved = await savedComposition(input, { noChange: true }), before = clone(saved.stats);
  const savedRequest = preRepairCodecRequest(input, saved.savedRequest);
  const savedResponse = clone(saved.savedResponse), wire = JSON.parse(savedResponse.response.output_text);
  const prior = input.adapter.currentApaView(input).artifact.report.candidates[0];
  const { refs: _refs, bos_refs: _bos, ...candidate } = clone(prior);
  candidate.cite_confirmed_update = false;
  if (!Object.hasOwn(candidate, 'review_schedule')) candidate.review_schedule = null;
  candidate.gates = candidate.gates.map((gate, index) => {
    const { refs: _gateRefs, ...body } = gate;
    return { ...body, cite_confirmed_update: index === 0 };
  });
  // The old codec admitted this string. The hard validator considers it
  // unchanged after whitespace normalization, so it is not an uncited change.
  candidate.gates[0].reason = ` ${prior.gates[0].reason} `;
  wire.candidates = [candidate];
  savedResponse.response.output_text = JSON.stringify(wire);
  input.state.status = 'unknown'; input.calls.length = 0;
  assert.throws(() => input.adapter.decodeApaReferenceCodec({ ...input, encodedDelta: wire }), /APA_DELTA_SCHEMA_INVALID/u);
  input.calls.length = 0;
  const recovered = input.adapter.recoverApaComposition({ ...input, savedRequest, savedResponse });
  assert.deepEqual(recovered.candidate.report.candidates[0].refs, prior.refs);
  assert.equal(recovered.candidate.report.candidates[0].gates[0].reason, ` ${prior.gates[0].reason} `);
  assert.deepEqual(recovered.candidate.report.candidates[0].gates[0].refs, [...prior.gates[0].refs, sourceId(input)]);
  assert.equal(recovered.receipt.no_provider_call, true); assert.equal(recovered.publication_performed, false);
  assert.deepEqual(new Set(input.calls), new Set(['recovery']));
  assert.deepEqual(saved.stats, before); assert.equal(input.record, null);
});

test('main recovery accepts an exact legacy raw-ref request only through its static recovery fence and refuses mixed versions', async () => {
  // An offline immutable-request fixture rebuilt from the byte-preserved legacy
  // instructions/schema, not a claim that a new provider invocation occurred.
  const input = setup(), saved = await savedComposition(input), before = clone(saved.stats);
  const savedRequest = clone(saved.savedRequest), savedResponse = clone(saved.savedResponse);
  savedRequest.request.instructions = MAIN_APA_LEGACY_COMPOSITION_INSTRUCTIONS;
  savedRequest.request.text.format.name = 'athlete_academy_current_apa_delta';
  savedRequest.request.text.format.schema = MAIN_APA_DELTA_SCHEMA;
  const legacyPacket = JSON.parse(savedRequest.request.input);
  legacyPacket.contract = 'athlete_academy_current_apa_composition_packet_v1';
  delete legacyPacket.current_approval_context;
  savedRequest.request.input = JSON.stringify(legacyPacket);
  delete savedRequest.basis.approval_context_contract;
  delete savedRequest.basis.approval_context_sha256;
  savedRequest.basis.input_chars = savedRequest.request.input.length;
  savedRequest.basis.input_bytes = Buffer.byteLength(savedRequest.request.input);
  savedRequest.basis.packet_sha256 = createHash('sha256').update(savedRequest.request.input).digest('hex');
  savedRequest.basis.request_sha256 = createHash('sha256').update(JSON.stringify(savedRequest.request)).digest('hex');
  savedResponse.response.output_text = JSON.stringify({ contract: MAIN_APA_DELTA_CONTRACT,
    binding: input.adapter.apaDeltaBinding(input), domains: [], futures: [], candidates: [],
    narratives: timing(input).narrative_updates });
  input.state.status = 'unknown'; input.calls.length = 0;
  const recovered = input.adapter.recoverApaComposition({ ...input, savedRequest, savedResponse });
  assert.deepEqual(recovered.candidate, saved.result.candidate);
  assert.equal(recovered.receipt.preview_content_hash, saved.result.receipt.preview_content_hash);
  assert.deepEqual(new Set(input.calls), new Set(['recovery']));
  assert.equal(recovered.receipt.no_provider_call, true); assert.deepEqual(saved.stats, before);
  const mixed = clone(savedResponse); mixed.response.output_text = saved.savedResponse.response.output_text;
  assert.throws(() => input.adapter.recoverApaComposition({ ...input, savedRequest, savedResponse: mixed }),
    /APA_COMPOSITION_RESPONSE_INVALID/u);
  const edited = clone(savedRequest); edited.request.text.format.schema.properties.narratives.maxItems = 9;
  edited.basis.request_sha256 = createHash('sha256').update(JSON.stringify(edited.request)).digest('hex');
  assert.throws(() => input.adapter.recoverApaComposition({ ...input, savedRequest: edited, savedResponse }),
    /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u);
  assert.equal(input.record, null); assert.deepEqual(saved.stats, before);
});
