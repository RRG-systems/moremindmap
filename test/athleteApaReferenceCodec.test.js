import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { digest as demoDigest } from '../server/athleteConsultingV2/bundles.js';
import { selectMove } from '../server/athleteAcademyV1/apa/contract.js';
import { currentApaView, publishCurrentApa,
  assertCurrentApaConfirmedSource } from '../server/athleteConsultingV2/currentApa.js';
import { APA_DELTA_SCHEMA, APA_REFERENCE_CODEC_CONTRACT, apaDeltaBinding,
  apaReferenceCodecSchema, decodeApaReferenceCodec, apaReferenceCodecSchemaV2,
  decodeApaReferenceCodecV2, reconstructApaDelta } from '../server/athleteConsultingV2/apaDelta.js';
import { APA_NARRATIVE_FIELDS, getApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';
import { createApaComposerCore, DEMO_APA_COMPOSITION_POLICY } from '../server/athleteApa/apaComposerCore.js';
import { APA_LEGACY_COMPOSITION_INSTRUCTIONS, APA_COMPOSITION_INSTRUCTIONS,
  createApaComposer } from '../server/athleteConsultingV2/apaComposer.js';
import { matchesApaSchema, apaDeltaSchemaMetrics } from '../server/athleteApa/apaDeltaCore.js';

const clone = value => structuredClone(value);
const uuid = number => `${String(number).padStart(8, '0')}-1111-4111-8111-111111111111`;
function setup(bundle = nia, { number = 1, record = null, supersedes = [] } = {}) {
  const messageId = uuid(number * 2), changeId = uuid(number * 2 + 1);
  const confirmedChange = { id: changeId, source_message_id: messageId, athlete_slug: bundle.person.slug,
    mm: bundle.person.mm, confirmed: true, confirmed_by: 'athlete',
    kind: supersedes.length ? 'correction' : 'reality', supersedes,
    confirmed_at: '2026-09-27T18:01:00.000Z', reason: 'Explicit fictional review of the saved current reality.' };
  const state = { mm: bundle.person.mm, messages: [{ id: messageId, role: 'user', speaker: 'athlete',
    text: 'Training is shorter on Thursday. My priority is Calm passing decisions. Review October 3, 2026; horizon December 1, 2026.',
    at: '2026-09-27T18:00:00.000Z' }] };
  const prior = currentApaView(bundle, record);
  return { bundle, prior, confirmedChange, state, record, expectedVersion: prior.version,
    confirmedSource: state.messages[0] };
}
const source = input => `APA:CURRENT:${input.confirmedChange.id}`;
const empty = input => ({ contract: APA_REFERENCE_CODEC_CONTRACT, binding: clone(apaDeltaBinding(input)),
  domains: [], futures: [], candidates: [], narratives: [] });
function wireEntity(entity, cite = false) {
  const { bos_refs: _bos, refs: _refs, ...value } = clone(entity);
  value.cite_confirmed_update = cite;
  if (entity.candidate_id && !Object.hasOwn(value, 'review_schedule')) value.review_schedule = null;
  if (entity.gates) value.gates = entity.gates.map(gate => wireEntity(gate, cite));
  return value;
}
function full(input, cite = true) {
  return { ...empty(input),
    ...Object.fromEntries(['domains', 'futures', 'candidates'].map(family =>
      [family, input.prior.artifact.report[family].map(entity => wireEntity(entity, cite))])),
    narratives: APA_NARRATIVE_FIELDS.map(field => ({ field,
      value: clone(getApaNarrativeValue(input.prior.artifact, field)), cite_confirmed_update: true })) };
}
const decode = (input, encodedDelta) => decodeApaReferenceCodec({ ...input, encodedDelta });
function publish(input, candidate) {
  const body = clone(candidate);
  for (const [index, entity] of body.report.candidates.entries()) {
    if (!Object.hasOwn(input.prior.artifact.report.candidates[index], 'review_schedule') && entity.review_schedule === null)
      delete entity.review_schedule;
  }
  return publishCurrentApa({ ...input, candidate: body });
}

test('codec is a frozen strict versioned envelope with exact entity, gate and eight narrative field branches', () => {
  for (const bundle of [nia, sofia]) {
    const input = setup(bundle), schema = apaReferenceCodecSchema(input);
    assert.equal(Object.isFrozen(schema.properties.candidates.items.anyOf), true);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required, ['contract', 'binding', 'domains', 'futures', 'candidates', 'narratives']);
    assert.deepEqual(schema.properties.contract.enum, [APA_REFERENCE_CODEC_CONTRACT]);
    for (const [family, key] of [['domains', 'id'], ['futures', 'role'], ['candidates', 'candidate_id']]) {
      assert.deepEqual([...new Set(schema.properties[family].items.anyOf.map(branch => branch.properties[key].enum[0]))],
        input.prior.artifact.report[family].map(entity => entity[key]));
      for (const branch of schema.properties[family].items.anyOf) {
        assert.equal(branch.additionalProperties, false);
        assert.equal(Object.hasOwn(branch.properties, 'refs'), false);
        assert.equal(Object.hasOwn(branch.properties, 'bos_refs'), false);
        assert.ok(branch.required.includes('cite_confirmed_update'));
      }
    }
    assert.deepEqual(schema.properties.narratives.items.anyOf.map(branch => branch.properties.field.enum[0]), APA_NARRATIVE_FIELDS);
    assert.ok(apaDeltaSchemaMetrics(schema).total_schema_string_chars < 20000);
  }
});

test('provider wire schema keeps complete strict nested anyOf arms within the bounded subset', () => {
  function inspect(node) {
    if (Array.isArray(node)) return node.forEach(inspect);
    if (!node || typeof node !== 'object') return;
    for (const key of ['allOf', 'not', 'if', 'then', 'else', 'dependentRequired', 'dependentSchemas'])
      assert.equal(Object.hasOwn(node, key), false);
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual(node.required, Object.keys(node.properties));
    }
    Object.values(node).forEach(inspect);
  }
  for (const bundle of [nia, sofia]) {
    const schema = apaReferenceCodecSchema(setup(bundle));
    assert.equal(schema.type, 'object');
    assert.equal(Object.hasOwn(schema, 'anyOf'), false);
    inspect(schema);
    const metrics = apaDeltaSchemaMetrics(schema);
    assert.ok(metrics.properties < 5000);
    assert.ok(metrics.max_depth <= 10);
    assert.ok(metrics.enum_values < 1000);
    assert.ok(metrics.total_schema_string_chars < 20000);
  }
});

test('canonical unchanged false and material true decode without changing the legacy reconstruction or publication contract', () => {
  const input = setup(), wire = empty(input);
  wire.domains = [wireEntity(input.prior.artifact.report.domains[1], false)];
  const unchanged = decode(input, wire);
  assert.deepEqual(unchanged.delta.domains[0].refs, input.prior.artifact.report.domains[1].refs);
  assert.equal(publish(input, unchanged.candidate).changed, false);
  wire.domains[0].gap = 'A shorter Thursday practice leaves less time for calm passing choices.';
  wire.domains[0].cite_confirmed_update = true;
  const decoded = decode(input, wire), raw = reconstructApaDelta({ ...input, delta: decoded.delta });
  assert.deepEqual(decoded.candidate, raw.candidate); assert.deepEqual(decoded.receipt, raw.receipt);
  assert.equal(decoded.delta.contract, 'athlete_current_apa_delta_v1');
  assert.deepEqual(decoded.delta.domains[0].refs, [...input.prior.artifact.report.domains[1].refs, source(input)]);
  assert.deepEqual(publish(input, decoded.candidate), publish(input, raw.candidate));
});

test('wire never admits provider references, old or mixed contracts, missing flags or arbitrary IDs', async context => {
  const input = setup(), baseline = empty(input);
  baseline.domains = [wireEntity(input.prior.artifact.report.domains[1], true)];
  for (const [name, mutate] of [
    ['free refs', value => { value.domains[0].refs = ['A01']; }],
    ['rejected ref cannot be rescued', value => { value.domains[0].refs = ['OTHER_ATHLETE']; }],
    ['bos refs', value => { value.domains[0].bos_refs = ['B01']; }],
    ['old contract', value => { value.contract = 'athlete_current_apa_delta_v1'; }],
    ['missing flag', value => { delete value.domains[0].cite_confirmed_update; }],
    ['string flag', value => { value.domains[0].cite_confirmed_update = 'true'; }],
    ['unknown ID', value => { value.domains[0].id = 'unrelated'; }],
    ['foreign binding', value => { value.binding.source_message_id = uuid(999); }],
    ['missing root array', value => { delete value.narratives; }],
  ]) await context.test(name, () => {
    const value = clone(baseline); mutate(value);
    assert.equal(matchesApaSchema(value, apaReferenceCodecSchema(input)), false);
    assert.throws(() => decode(input, value), /APA_DELTA_SCHEMA_INVALID/u);
  });
});

test('same-entity material changes still require their own explicit true citation and canonical target order', () => {
  const input = setup(), wire = empty(input);
  wire.domains = [wireEntity(input.prior.artifact.report.domains[1], false)];
  wire.domains[0].gap = 'The shorter Thursday practice is a newly confirmed constraint.';
  assert.throws(() => decode(input, wire), /APA_DELTA_CHANGE_NOT_SOURCE_BOUND/u);
  wire.domains = [wireEntity(input.prior.artifact.report.domains[1]), wireEntity(input.prior.artifact.report.domains[0])];
  assert.throws(() => decode(input, wire), /APA_DELTA_TARGET_ORDER_INVALID/u);
  wire.domains = [wireEntity(input.prior.artifact.report.domains[1]), wireEntity(input.prior.artifact.report.domains[1])];
  assert.throws(() => decode(input, wire), /APA_DELTA_TARGET_ORDER_INVALID/u);
});

test('gate changes require independent true flags on their exact candidate and gate; no child-to-parent autocitation', async context => {
  const input = setup(), wire = empty(input), schema = apaReferenceCodecSchema(input);
  const candidate = wireEntity(input.prior.artifact.report.candidates[0], false);
  candidate.gates[0].pass = !candidate.gates[0].pass;
  candidate.gates[0].reason = 'The athlete has not agreed to this proposed test under the changed week.';
  wire.candidates = [candidate];
  for (const [parent, child] of [[false, false], [false, true], [true, false]]) await context.test(`${parent}/${child}`, () => {
    const value = clone(wire); value.candidates[0].cite_confirmed_update = parent;
    value.candidates[0].gates[0].cite_confirmed_update = child;
    assert.equal(matchesApaSchema(value, schema), false);
    assert.throws(() => decode(input, value), /APA_DELTA_SCHEMA_INVALID/u);
  });
  candidate.cite_confirmed_update = true; candidate.gates[0].cite_confirmed_update = true;
  assert.equal(matchesApaSchema(wire, schema), true);
  const result = decode(input, wire);
  assert.ok(result.candidate.report.candidates[0].refs.includes(source(input)));
  assert.ok(result.candidate.report.candidates[0].gates[0].refs.includes(source(input)));
  assert.deepEqual(result.candidate.report.candidates[0].gates[1].refs,
    input.prior.artifact.report.candidates[0].gates[1].refs);
  for (const mutate of [value => { value.candidates[0].gates[0].id = 'foreign_gate'; },
    value => { value.candidates[0].gates[0].refs = ['A01']; },
    value => { value.candidates[0].gates.reverse(); }]) {
    const value = clone(wire); mutate(value);
    assert.throws(() => decode(input, value), /APA_DELTA_SCHEMA_INVALID|APA_DELTA_GATE_STRUCTURE_CHANGED/u);
  }
});

test('schema blocks the exact third-gate reason or pass contradiction before reconstruction', () => {
  for (const bundle of [nia, sofia]) {
    const input = setup(bundle), schema = apaReferenceCodecSchema(input);
    const previous = input.prior.artifact.report.candidates[0].gates[2];
    for (const field of ['reason', 'pass']) {
      const candidate = wireEntity(input.prior.artifact.report.candidates[0], false);
      candidate.gates[2][field] = field === 'reason'
        ? 'A new reason would require this athlete-confirmed source.' : !previous.pass;
      const wire = { ...empty(input), candidates: [candidate] };
      for (const [parent, gate] of [[false, false], [false, true], [true, false]]) {
        candidate.cite_confirmed_update = parent;
        candidate.gates[2].cite_confirmed_update = gate;
        assert.equal(matchesApaSchema(wire, schema), false);
      }
      candidate.cite_confirmed_update = true;
      candidate.gates[2].cite_confirmed_update = true;
      assert.equal(matchesApaSchema(wire, schema), true);
    }
  }
});

test('correction removes only verified inactive references and requires all empty prior-reference sites to cite true', () => {
  const input = setup(nia, { supersedes: ['A06'] }), wire = full(input);
  const result = decode(input, wire), inactive = new Set(input.confirmedChange.supersedes);
  for (const family of ['domains', 'futures', 'candidates']) {
    for (const [index, entity] of result.delta[family].entries()) {
      const prior = input.prior.artifact.report[family][index];
      assert.deepEqual(entity.refs, [...prior.refs.filter(id => !inactive.has(id)), source(input)]);
      if (entity.gates) entity.gates.forEach((gate, gateIndex) => assert.deepEqual(gate.refs,
        [...prior.gates[gateIndex].refs.filter(id => !inactive.has(id)), source(input)]));
    }
  }
  assert.equal(JSON.stringify(result.candidate.report).includes('"A06"'), false);
  assert.equal(publish(input, result.candidate).changed, true);
  const knownAthlete = new Set(input.prior.artifact.sources.filter(item =>
    ['Athlete', 'Athlete confirmation', 'Athlete-confirmed coaching update'].includes(item.source)
      && !input.prior.artifact.report.coach_view.refs.includes(item.id)).map(item => item.id));
  const gateSite = input.prior.artifact.report.candidates.flatMap((candidate, ci) =>
    candidate.gates.map((gate, gi) => ({ ci, gi, gate })))
    .find(({ gate }) => gate.refs.length > 0 && gate.refs.length <= 8 && gate.refs.every(id => knownAthlete.has(id)));
  assert.ok(gateSite);
  const emptyPrior = setup(nia, { supersedes: gateSite.gate.refs }), emptyPriorWire = full(emptyPrior);
  emptyPriorWire.candidates[gateSite.ci].gates[gateSite.gi].cite_confirmed_update = false;
  assert.throws(() => decode(emptyPrior, emptyPriorWire), /APA_DELTA_SCHEMA_INVALID/u);
});

test('correction omissions still fail closed; explicit unknown narrative reviews invent no baseline citations', () => {
  const input = setup(nia, { supersedes: ['A06'] }), wire = full(input);
  wire.narratives = [];
  assert.throws(() => decode(input, wire), /APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED/u);
  wire.narratives = full(input).narratives;
  const result = decode(input, wire);
  assert.equal(result.delta.narratives.length, 8);
  result.delta.narratives.forEach(update => assert.deepEqual(update.refs, [source(input)]));
  const affected = input.prior.artifact.report.futures.findIndex(entity => entity.refs.includes('A06'));
  assert.ok(affected >= 0); wire.futures.splice(affected, 1);
  assert.throws(() => decode(input, wire), /APA_DELTA_CORRECTION_DEPENDENCY_OMITTED/u);
});

test('known narrative provenance is retained in order and superseded only by the exact verified correction', () => {
  const first = setup(), firstWire = full(first), published = publish(first, decode(first, firstWire).candidate);
  const next = setup(nia, { number: 2, record: published.record });
  const wire = empty(next); wire.narratives = [{ field: 'opening', value: next.prior.artifact.report.opening,
    cite_confirmed_update: true }];
  assert.deepEqual(decode(next, wire).delta.narratives[0].refs, [source(first), source(next)]);
  const correction = setup(nia, { number: 3, record: published.record, supersedes: [source(first)] });
  const corrected = decode(correction, full(correction));
  corrected.delta.narratives.forEach(update => assert.deepEqual(update.refs, [source(correction)]));
  const missing = full(correction); missing.narratives.pop();
  assert.throws(() => decode(correction, missing), /APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED/u);
});

test('narrative wire rejects free refs, false/missing citation and mismatched field types before provenance reconstruction', async context => {
  const input = setup(), wire = empty(input);
  wire.narratives = [{ field: 'headline', value: input.prior.artifact.report.headline, cite_confirmed_update: true }];
  for (const [name, mutate] of [
    ['extra refs', value => { value.narratives[0].refs = ['A01', source(input)]; }],
    ['false citation', value => { value.narratives[0].cite_confirmed_update = false; }],
    ['missing citation', value => { delete value.narratives[0].cite_confirmed_update; }],
    ['array scalar', value => { value.narratives[0].value = ['Headline']; }],
    ['unknown field', value => { value.narratives[0].field = 'confirmation.assessment_date'; }],
    ['scalar array', value => { value.narratives[0].field = 'what_we_dont_know'; }],
  ]) await context.test(name, () => {
    const value = clone(wire); mutate(value);
    assert.throws(() => decode(input, value), /APA_DELTA_SCHEMA_INVALID/u);
  });
});

test('codec retains exact priority/date source grounding, calendar checks and separate manual publication', () => {
  const input = setup(), wire = empty(input);
  wire.narratives = [
    { field: 'confirmation.priority', value: 'Calm passing decisions', cite_confirmed_update: true },
    { field: 'confirmation.review_date', value: '2026-10-03', cite_confirmed_update: true },
    { field: 'confirmation.horizon_date', value: '2026-12-01', cite_confirmed_update: true },
  ];
  const result = decode(input, wire);
  assert.equal(input.record, null); assert.equal(currentApaView(nia).version, 0);
  const published = publish(input, result.candidate);
  assert.equal(published.record.artifact.confirmation.review_date, '2026-10-03');
  const wrong = clone(wire); wrong.narratives[0].value = 'Invented priority';
  assert.throws(() => decode(input, wrong), /APA_NARRATIVE_SOURCE_TEXT_REQUIRED/u);
  const badDate = clone(wire); badDate.narratives[1].value = '2026-02-30';
  assert.throws(() => decode(input, badDate), /APA_NARRATIVE_SOURCE_TEXT_REQUIRED/u);
});

test('legacy immutable saved requests and responses recover only through exact old schema/hash/instruction matching', async () => {
  const input = setup(), events = [];
  const identity = { selectedAthlete: bundle => ({ slug: bundle.person.slug, mm: bundle.person.mm,
    synthetic: true, bos_sha256: bundle.bos.artifact_sha256 }),
  evidenceIdentity: bundle => ({ athlete_slug: bundle.person.slug }), confirmationIdentity: () => ({}) };
  const legacy = createApaComposerCore({ assertCurrentApaConfirmedSource, publishCurrentApa,
    apaDeltaBinding, reconstructApaDelta, deltaSchema: APA_DELTA_SCHEMA, policy: DEMO_APA_COMPOSITION_POLICY,
    instructions: APA_LEGACY_COMPOSITION_INSTRUCTIONS, schemaName: 'athlete_current_apa_delta',
    packetContract: 'athlete_current_apa_composition_packet_v1', ...identity });
  const wire = empty(input); wire.domains = [wireEntity(input.prior.artifact.report.domains[1], true)];
  wire.domains[0].gap = 'Thursday practice now needs a calm passing cue.';
  const raw = decode(input, wire).delta;
  const original = await legacy.createApaComposer({ env: {}, evidenceSink: event => events.push(event),
    transport: async () => ({ status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify(raw) }) })(input);
  const current = createApaComposerCore({ assertCurrentApaConfirmedSource, publishCurrentApa, apaDeltaBinding,
    reconstructApaDelta, apaReferenceCodecSchema, decodeApaReferenceCodec,
    deltaSchema: APA_DELTA_SCHEMA, policy: DEMO_APA_COMPOSITION_POLICY,
    instructions: APA_COMPOSITION_INSTRUCTIONS, legacyInstructions: APA_LEGACY_COMPOSITION_INSTRUCTIONS,
    schemaName: 'athlete_current_apa_reference_codec_v2', legacySchemaName: 'athlete_current_apa_delta',
    packetContract: 'athlete_current_apa_composition_packet_v1', ...identity });
  const savedRequest = events[0], savedResponse = events[1];
  const recovered = current.recoverApaComposition({ ...input, savedRequest, savedResponse });
  assert.deepEqual(recovered.candidate, original.candidate);
  assert.equal(recovered.receipt.preview_content_hash, original.receipt.preview_content_hash);
  assert.equal(recovered.no_provider_call, undefined); assert.equal(recovered.receipt.no_provider_call, true);
  assert.equal(currentApaView(nia).version, 0);
  const edited = clone(savedRequest); edited.request.instructions += ' A foreign change.';
  edited.basis.request_sha256 = createHash('sha256').update(JSON.stringify(edited.request)).digest('hex');
  assert.throws(() => current.recoverApaComposition({ ...input, savedRequest: edited, savedResponse }),
    /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u);
  const mixed = clone(savedResponse); mixed.response.output_text = JSON.stringify(wire);
  assert.throws(() => current.recoverApaComposition({ ...input, savedRequest, savedResponse: mixed }),
    /APA_COMPOSITION_RESPONSE_INVALID/u);
});

test('immutable codec v2 requests recover under v3 only through their exact old schema and response', async () => {
  const input = setup(), events = [];
  const identity = { selectedAthlete: bundle => ({ slug: bundle.person.slug, mm: bundle.person.mm,
    synthetic: true, bos_sha256: bundle.bos.artifact_sha256 }),
  evidenceIdentity: bundle => ({ athlete_slug: bundle.person.slug }), confirmationIdentity: () => ({}) };
  const base = { assertCurrentApaConfirmedSource, publishCurrentApa, apaDeltaBinding,
    reconstructApaDelta, deltaSchema: APA_DELTA_SCHEMA, policy: DEMO_APA_COMPOSITION_POLICY,
    instructions: APA_COMPOSITION_INSTRUCTIONS, legacyInstructions: APA_LEGACY_COMPOSITION_INSTRUCTIONS,
    legacySchemaName: 'athlete_current_apa_delta',
    packetContract: 'athlete_current_apa_composition_packet_v1', ...identity };
  const previous = createApaComposerCore({ ...base,
    apaReferenceCodecSchema: apaReferenceCodecSchemaV2, decodeApaReferenceCodec: decodeApaReferenceCodecV2,
    schemaName: 'athlete_current_apa_reference_codec_v2' });
  const current = createApaComposerCore({ ...base,
    apaReferenceCodecSchema, decodeApaReferenceCodec,
    previousCodecSchema: apaReferenceCodecSchemaV2, previousCodecDecoder: decodeApaReferenceCodecV2,
    previousCodecSchemaName: 'athlete_current_apa_reference_codec_v2',
    schemaName: 'athlete_current_apa_reference_codec_v3' });
  const wire = empty(input), candidate = wireEntity(input.prior.artifact.report.candidates[0], false);
  const priorReason = candidate.gates[2].reason;
  candidate.gates[2].reason = `  ${priorReason}  `;
  wire.candidates = [candidate];
  // V2 admitted an uncited, whitespace-only gate reason restatement. V3 binds
  // that unchanged gate to its exact prior reason, without invalidating saved V2 evidence.
  assert.notEqual(candidate.gates[2].reason, priorReason);
  assert.equal(matchesApaSchema(wire, apaReferenceCodecSchemaV2(input)), true);
  assert.equal(matchesApaSchema(wire, apaReferenceCodecSchema(input)), false);
  const original = await previous.createApaComposer({ env: {}, evidenceSink: event => events.push(event),
    transport: async () => ({ status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify(wire) }) })(input);
  const [savedRequest, savedResponse] = events;
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'receipt']);
  assert.equal(savedRequest.request.text.format.name, 'athlete_current_apa_reference_codec_v2');
  assert.deepEqual(savedRequest.request.text.format.schema, apaReferenceCodecSchemaV2(input));
  assert.equal(savedRequest.request.instructions, APA_COMPOSITION_INSTRUCTIONS);
  const recovered = current.recoverApaComposition({ ...input, savedRequest, savedResponse });
  assert.deepEqual(recovered.candidate, original.candidate);
  assert.equal(recovered.receipt.preview_content_hash, original.receipt.preview_content_hash);
  assert.equal(recovered.receipt.no_provider_call, true);
  assert.equal(recovered.publication_performed, false);

  for (const mutate of [request => { request.text.format.name = 'athlete_current_apa_reference_codec_v3'; },
    request => { request.instructions += ' Unreviewed instruction.'; }]) {
    const edited = clone(savedRequest); mutate(edited.request);
    edited.basis.request_sha256 = createHash('sha256').update(JSON.stringify(edited.request)).digest('hex');
    assert.throws(() => current.recoverApaComposition({ ...input, savedRequest: edited, savedResponse }),
      /APA_COMPOSITION_RECOVERY_REQUEST_MISMATCH/u);
  }

  const nextEvents = [];
  const next = await current.createApaComposer({ env: {}, evidenceSink: event => nextEvents.push(event),
    transport: async () => ({ status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify(empty(input)) }) })(input);
  assert.equal(nextEvents[0].request.text.format.name, 'athlete_current_apa_reference_codec_v3');
  assert.deepEqual(nextEvents[0].request.text.format.schema, apaReferenceCodecSchema(input));
  assert.equal(nextEvents[0].request.text.format.strict, true);
  assert.equal(next.publication_performed, false);
  assert.equal(currentApaView(nia).version, 0);
});

test('an oversized current v3 schema cannot suppress exact immutable v2 recovery', async () => {
  const bundle = clone(nia);
  const longReason = ' This remains an unchanged synthetic gate reason.'.repeat(70);
  for (const candidate of bundle.apa.report.candidates)
    for (const gate of candidate.gates) gate.reason += longReason;
  Object.assign(bundle.apa, selectMove(bundle.apa.report));
  const { artifact_sha256: _oldHash, ...body } = bundle.apa;
  bundle.apa.artifact_sha256 = demoDigest(body);
  const input = setup(bundle), events = [];
  assert.doesNotThrow(() => apaReferenceCodecSchemaV2(input));
  assert.throws(() => apaReferenceCodecSchema(input), /APA_COMPOSITION_REQUEST_SCHEMA_TOO_LARGE/u);
  const identity = { selectedAthlete: value => ({ slug: value.person.slug, mm: value.person.mm,
    synthetic: true, bos_sha256: value.bos.artifact_sha256 }),
  evidenceIdentity: value => ({ athlete_slug: value.person.slug }), confirmationIdentity: () => ({}) };
  const base = { assertCurrentApaConfirmedSource, publishCurrentApa, apaDeltaBinding,
    reconstructApaDelta, deltaSchema: APA_DELTA_SCHEMA, policy: DEMO_APA_COMPOSITION_POLICY,
    instructions: APA_COMPOSITION_INSTRUCTIONS, legacyInstructions: APA_LEGACY_COMPOSITION_INSTRUCTIONS,
    legacySchemaName: 'athlete_current_apa_delta',
    packetContract: 'athlete_current_apa_composition_packet_v1', ...identity };
  const previous = createApaComposerCore({ ...base,
    apaReferenceCodecSchema: apaReferenceCodecSchemaV2, decodeApaReferenceCodec: decodeApaReferenceCodecV2,
    schemaName: 'athlete_current_apa_reference_codec_v2' });
  const current = createApaComposerCore({ ...base,
    apaReferenceCodecSchema, decodeApaReferenceCodec,
    previousCodecSchema: apaReferenceCodecSchemaV2, previousCodecDecoder: decodeApaReferenceCodecV2,
    previousCodecSchemaName: 'athlete_current_apa_reference_codec_v2',
    schemaName: 'athlete_current_apa_reference_codec_v3' });
  const original = await previous.createApaComposer({ env: {}, evidenceSink: event => events.push(event),
    transport: async () => ({ status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify(empty(input)) }) })(input);
  assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'receipt']);
  const recovered = current.recoverApaComposition({ ...input, savedRequest: events[0], savedResponse: events[1] });
  assert.deepEqual(recovered.candidate, original.candidate);
  assert.equal(recovered.receipt.no_provider_call, true);
  assert.equal(recovered.publication_performed, false);
});

test('new live composition rejects an old raw response and records the failed version boundary without retry', async () => {
  const input = setup(), events = []; let calls = 0;
  const composer = createApaComposer({ env: {}, evidenceSink: event => events.push(event), transport: async () => {
    calls++; return { status: 'completed', model: 'gpt-5.6-sol', output_text: JSON.stringify({
      contract: 'athlete_current_apa_delta_v1', binding: apaDeltaBinding(input),
      domains: [], futures: [], candidates: [], narratives: [] }) };
  } });
  await assert.rejects(composer(input), /APA_COMPOSITION_RESPONSE_INVALID/u);
  assert.equal(calls, 1); assert.deepEqual(events.map(event => event.kind), ['request', 'response', 'failure']);
  assert.equal(events.at(-1).stage, 'delta_schema'); assert.equal(currentApaView(nia).version, 0);
});
