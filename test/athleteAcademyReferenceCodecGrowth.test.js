import assert from 'node:assert/strict';
import test from 'node:test';
import nia from '../server/athleteConsultingV2/fixtures/nia.json' with { type: 'json' };
import sofia from '../server/athleteConsultingV2/fixtures/sofia.json' with { type: 'json' };
import { buildCanonicalCoachBundle, hash } from '../server/athleteAcademyV1/coaching/bundle.js';
import { selectMove, validateReport } from '../server/athleteAcademyV1/apa/contract.js';
import { createMainCurrentApaAdapter, MAIN_CURRENT_APA_CONTRACT,
  MAIN_APA_REFERENCE_CODEC_CONTRACT } from '../server/athleteAcademyV1/coaching/currentApa.js';
import { MAX_CURRENT_APA_REVISIONS, currentApaHash } from '../server/athleteApa/currentApaCore.js';
import { APA_DELTA_REQUEST_SCHEMA_LIMITS, apaDeltaSchemaMetrics,
  assertApaDeltaSchemaBudget, matchesApaSchema } from '../server/athleteApa/apaDeltaCore.js';
import { APA_NARRATIVE_FIELDS, getApaNarrativeValue,
  verifyApaNarrativeProvenance } from '../server/athleteConsultingV2/apaNarrative.js';

const clone = value => structuredClone(value);
const uuid = (round, prefix = '00000000') => `${prefix}-0000-4000-8000-${String(round).padStart(12, '0')}`;
const families = ['domains', 'futures', 'candidates'];

// OFFLINE STRUCTURAL FIXTURE ONLY: this derives accepted fictional report shape
// from a sealed fixture, then independently binds and rehashes a fictional UUID
// account through the real main-lane adapter. It is not a customer, demo-identity
// substitution, provider/model acceptance, deployed/runtime proof or persistence.
function canonicalFixture(fixture, label, actorId, maximal = false) {
  const mm = `MM-OFFLINE-UUID-CODEC-GROWTH-${label.toUpperCase()}`;
  const name = `Mira Offline ${label}`;
  const replace = value => JSON.parse(JSON.stringify(value)
    .replaceAll(fixture.person.mm, mm).replaceAll(fixture.person.name, name));
  const bos = replace(fixture.bos), apa = replace(fixture.apa), bosInput = replace(fixture.bos_source);
  bos.mm = mm; bos.synthetic = true; bos.subject.age = 18;
  delete bos.artifact_sha256; bos.artifact_sha256 = hash(bos);
  apa.mm = mm; apa.synthetic = true; apa.identity.age = 18;
  apa.identity.reading_sha256 = hash(bos); apa.bos_sha256 = hash(bos);
  if (maximal) {
    // Deliberately constructed fictional permitted five-candidate shape. This
    // is not the unchanged accepted Sofia report or a model-quality assertion.
    // Only the candidate identity changes; known citations/gates stay intact.
    const fifth = clone(apa.report.candidates[0]);
    fifth.candidate_id = 'offline_maximal_candidate_5';
    apa.report.candidates.push(fifth);
    validateReport(apa.report, apa);
    Object.assign(apa, selectMove(apa.report));
  }
  delete apa.artifact_sha256; apa.artifact_sha256 = hash(apa);
  const person = { actorId, mm, name, age: 18, sport: 'Volleyball', synthetic: true };
  bosInput.person = { ...bosInput.person, ...person };
  delete bosInput.person.slug;
  const principal = Object.freeze({ authenticated: true, actorId, subjectActorId: actorId, mm,
    role: 'athlete', grants: Object.freeze({ reportsRead: true, coachingRead: true, participation: true }) });
  return { bundle: buildCanonicalCoachBundle({ person, bos, apa, bosInput }, principal), principal };
}

function completeReconfirmation(prior, binding) {
  const typed = entity => {
    const body = clone(entity);
    delete body.refs; delete body.bos_refs;
    return { ...body, cite_confirmed_update: true };
  };
  const candidates = prior.artifact.report.candidates.map(entity => {
    const body = typed(entity);
    if (!Object.hasOwn(body, 'review_schedule')) body.review_schedule = null;
    body.gates = entity.gates.map(typed);
    return body;
  });
  return {
    contract: MAIN_APA_REFERENCE_CODEC_CONTRACT, binding: clone(binding),
    domains: prior.artifact.report.domains.map(typed),
    futures: prior.artifact.report.futures.map(typed), candidates,
    narratives: APA_NARRATIVE_FIELDS.map(field => ({ field,
      value: clone(getApaNarrativeValue(prior.artifact, field)), cite_confirmed_update: true })),
  };
}

function restoreLegacySchedule(candidate, priorArtifact) {
  const restored = clone(candidate);
  for (const [index, entity] of restored.report.candidates.entries()) {
    if (!Object.hasOwn(priorArtifact.report.candidates[index], 'review_schedule') && entity.review_schedule === null)
      delete entity.review_schedule;
  }
  return restored;
}

function reportRefNodes(report) {
  return families.flatMap(family => report[family].flatMap((entity, index) => [
    { path: `${family}.${index}`, refs: entity.refs },
    ...(family === 'candidates' ? entity.gates.map((gate, gateIndex) => ({
      path: `${family}.${index}.gates.${gateIndex}`, refs: gate.refs,
    })) : []),
  ]));
}

function assertCanonicalRefs(priorArtifact, decoded, sourceId, inactive, round) {
  const beforeNodes = reportRefNodes(priorArtifact.report);
  const deltaNodes = reportRefNodes(decoded.delta);
  const candidateNodes = reportRefNodes(decoded.candidate.report);
  assert.deepEqual(deltaNodes.map(node => node.path), beforeNodes.map(node => node.path));
  const expectedFor = refs => [...refs.filter(id => !inactive.has(id)), sourceId];
  for (const [index, prior] of beforeNodes.entries()) {
    const expected = expectedFor(prior.refs);
    assert.deepEqual(deltaNodes[index].refs, expected, `revision ${round}: ${prior.path} decoded refs`);
    assert.deepEqual(candidateNodes[index].refs, expected, `revision ${round}: ${prior.path} candidate refs`);
    assert.equal(new Set(expected).size, expected.length);
  }
  const provenance = verifyApaNarrativeProvenance(priorArtifact);
  assert.equal(decoded.delta.narratives.length, 8);
  for (const [index, update] of decoded.delta.narratives.entries()) {
    assert.equal(update.field, APA_NARRATIVE_FIELDS[index]);
    assert.deepEqual(update.value, getApaNarrativeValue(priorArtifact, update.field));
    assert.deepEqual(update.refs, expectedFor(provenance.fields[index].refs));
    if (round === 1) assert.deepEqual(update.refs, [sourceId], 'uncited baseline narratives acquire no invented refs');
  }
}

const structuralCases = [
  { fixture: nia, label: 'alpha', actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', expectedRefNodes: 33 },
  { fixture: sofia, label: 'beta', actorId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', expectedRefNodes: 33 },
  { fixture: sofia, label: 'maximal', actorId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', expectedRefNodes: 39, maximal: true },
];
for (const { fixture, label, actorId, expectedRefNodes, maximal = false } of structuralCases) {
test(`offline UUID main-lane ${label} codec stays bounded through all 24 revisions and final correction with verified cold reads`, () => {
  const { bundle, principal } = canonicalFixture(fixture, label, actorId, maximal);
  const sourceIdFor = round => `APA:ACADEMY:${actorId}:${uuid(round)}`;
  const baseline = JSON.stringify(bundle), authority = Object.freeze({ offlineSnapshotCapability: true });
  const fenceCalls = [];
  let currentInput;
  const adapter = createMainCurrentApaAdapter({ assertFencedAuthority(context) {
    fenceCalls.push(context.operation);
    return context.bundle === bundle && context.principal === principal
      && context.authority === authority && context.state === currentInput?.state
      && currentApaHash(context.state.sourceBinding) === currentApaHash(bundle.binding)
      && context.state.revision === currentInput.expectedVersion + 1
      && ['source_preflight', 'delta_binding', 'reconstruction', 'publication'].includes(context.operation);
  } });
  assert.equal(actorId.length, 36);
  assert.equal(sourceIdFor(1).length, 85);
  assert.equal(bundle.person.slug, undefined);
  assert.equal(bundle.bos_source.person.slug, undefined);
  assert.deepEqual(Object.keys(bundle.binding).sort(), ['actorId', 'apa', 'bos', 'mm']);
  assert.equal(MAX_CURRENT_APA_REVISIONS, 24);

  let record = null, firstMetrics, firstNonBindingSchema;
  const schemaHashes = new Set(), allMetrics = [];
  const baselineNarratives = APA_NARRATIVE_FIELDS.map(field => clone(getApaNarrativeValue(bundle.apa, field)));
  const baselineRefNodes = reportRefNodes(bundle.apa.report);
  assert.equal(baselineRefNodes.length, expectedRefNodes, 'every node of the complete baseline report is exercised');
  assert.equal(bundle.apa.report.candidates.length, maximal ? 5 : fixture.apa.report.candidates.length);
  assert.ok(baselineRefNodes.every(node => node.refs.length > 0));
  for (let round = 1; round <= MAX_CURRENT_APA_REVISIONS; round += 1) {
    const correction = round === MAX_CURRENT_APA_REVISIONS;
    const sourceId = sourceIdFor(round), supersedes = correction ? [sourceIdFor(round - 1)] : [];
    const at = new Date(Date.UTC(2026, 8, 27, 18, round, 0)).toISOString();
    const confirmedAt = new Date(Date.UTC(2026, 8, 27, 18, round, 1)).toISOString();
    const state = { mm: bundle.person.mm, sourceBinding: clone(bundle.binding), revision: round, status: 'active',
      messages: [{ id: uuid(round, '10000000'), role: 'user', speaker: 'athlete', actorId,
        text: `Offline reviewed reconfirmation ${round}: I confirm this unchanged full report, priority and dates.`, at }] };
    currentInput = { bundle, principal, authority, state, record, expectedVersion: round - 1,
      confirmedChange: { actorId, mm: bundle.person.mm, id: uuid(round), source_message_id: state.messages[0].id,
        confirmed: true, confirmed_by: 'athlete', kind: correction ? 'correction' : 'reality', supersedes,
        reason: 'The fictional athlete reviewed every complete entity, gate and narrative for this offline proof.',
        confirmed_at: confirmedAt } };
    const stateBefore = JSON.stringify(state), recordBefore = JSON.stringify(record);
    const verified = adapter.assertCurrentApaConfirmedSource(currentInput);
    assert.equal(verified.prior.version, round - 1);
    assert.equal(verified.source.id, sourceId);
    assert.equal(verified.source.actorId, actorId);
    assert.equal(verified.source.source_message_id, state.messages[0].id);
    const binding = adapter.apaDeltaBinding(currentInput);
    const schema = adapter.apaReferenceCodecSchema(currentInput);
    assert.equal(Object.isFrozen(schema), true);
    assert.equal(Object.isFrozen(schema.properties.binding), true);
    const metrics = apaDeltaSchemaMetrics(schema);
    assert.deepEqual(assertApaDeltaSchemaBudget(schema), metrics);
    for (const [key, limit] of Object.entries(APA_DELTA_REQUEST_SCHEMA_LIMITS)) assert.ok(metrics[key] <= limit);
    allMetrics.push(metrics);
    const nonBindingSchema = clone(schema); delete nonBindingSchema.properties.binding;
    if (round === 1) { firstMetrics = clone(metrics); firstNonBindingSchema = nonBindingSchema; }
    else {
      assert.deepEqual(metrics, firstMetrics, `revision ${round}: schema metrics do not grow with refs`);
      assert.deepEqual(nonBindingSchema, firstNonBindingSchema, `revision ${round}: only exact binding changes`);
    }
    schemaHashes.add(currentApaHash(schema));
    const encodedDelta = completeReconfirmation(verified.prior, binding);
    assert.equal(matchesApaSchema(encodedDelta, schema), true);
    const decoded = adapter.decodeApaReferenceCodec({ ...currentInput, encodedDelta });
    const inactive = new Set([...verified.inactiveSourceIds, ...supersedes]);
    assertCanonicalRefs(verified.prior.artifact, decoded, sourceId, inactive, round);
    const candidate = restoreLegacySchedule(decoded.candidate, verified.prior.artifact);
    const result = adapter.publishCurrentApa({ ...currentInput, candidate });
    assert.equal(result.changed, true);
    assert.equal(result.record.contract, MAIN_CURRENT_APA_CONTRACT);
    assert.equal(result.record.version, round);
    assert.deepEqual(result.record.binding, bundle.binding);
    assert.equal(result.record.artifact.actorId, actorId);
    assert.equal(result.record.artifact.synthetic, true);
    assert.equal(result.receipt.source_id, sourceId);
    assert.equal(result.receipt.prior_version, round - 1);
    assert.equal(result.receipt.narrative_changes.length, 8);
    assert.ok(result.receipt.narrative_changes.every(change => change.value_changed === false && change.reference_changed === true));
    assert.equal(result.record.receipts.length, round);
    assert.equal(result.record.artifact.sources.length, bundle.apa.sources.length + round);
    assert.deepEqual(result.record.artifact.sources.slice(0, bundle.apa.sources.length), bundle.apa.sources);
    assert.deepEqual(result.record.artifact.bos_sources, bundle.apa.bos_sources);
    assert.deepEqual(result.record.artifact.report.coach_view, bundle.apa.report.coach_view);
    assert.deepEqual(result.record.artifact.identity, bundle.apa.identity);
    assert.deepEqual(result.record.artifact.existing_plan, bundle.apa.existing_plan);
    assert.deepEqual(APA_NARRATIVE_FIELDS.map(field => getApaNarrativeValue(result.record.artifact, field)), baselineNarratives);
    for (const [index, entity] of result.record.artifact.report.candidates.entries()) {
      assert.equal(Object.hasOwn(entity, 'review_schedule'), Object.hasOwn(bundle.apa.report.candidates[index], 'review_schedule'));
    }
    const coldRecord = JSON.parse(JSON.stringify(result.record));
    const coldAdapter = createMainCurrentApaAdapter({ assertFencedAuthority: () => false });
    const coldView = coldAdapter.currentApaView({ bundle, principal, record: coldRecord });
    assert.equal(coldView.version, round);
    assert.deepEqual(coldView.artifact, result.record.artifact);
    assert.deepEqual(coldView.receipt, result.receipt);
    assert.deepEqual(coldView.artifact.narrative_provenance.fields.map(field => field.refs),
      decoded.delta.narratives.map(update => update.refs));
    assert.equal(JSON.stringify(state), stateBefore);
    assert.equal(JSON.stringify(record), recordBefore);
    assert.equal(JSON.stringify(bundle), baseline);
    record = coldRecord;
  }

  assert.equal(schemaHashes.size, 24, 'each request retains distinct version/source/hash custody');
  assert.equal(allMetrics.length, 24);
  const retired = sourceIdFor(23), replacement = sourceIdFor(24);
  const activeNodes = reportRefNodes(record.artifact.report);
  for (const [index, node] of activeNodes.entries()) {
    assert.deepEqual(node.refs, [...baselineRefNodes[index].refs,
      ...Array.from({ length: 22 }, (_, index) => sourceIdFor(index + 1)), replacement]);
    assert.equal(node.refs.includes(retired), false);
  }
  for (const field of record.artifact.narrative_provenance.fields) {
    assert.deepEqual(field.refs, [...Array.from({ length: 22 }, (_, index) => sourceIdFor(index + 1)), replacement]);
    assert.equal(field.refs.includes(retired), false);
  }
  assert.deepEqual(record.artifact.sources.find(source => source.id === replacement).supersedes, [retired]);
  assert.ok(record.artifact.sources.some(source => source.id === retired), 'immutable historical source is preserved');
  assert.deepEqual(record.receipts.at(-1).supersedes, [retired]);
  for (const operation of ['source_preflight', 'delta_binding', 'reconstruction', 'publication'])
    assert.ok(fenceCalls.filter(value => value === operation).length >= 24, `${operation} stays fenced`);

  currentInput = { ...currentInput, record, expectedVersion: 24,
    state: { ...currentInput.state, revision: 25, messages: [{ ...currentInput.state.messages[0], id: uuid(25, '10000000') }] },
    confirmedChange: { ...currentInput.confirmedChange, id: uuid(25), source_message_id: uuid(25, '10000000'),
      kind: 'reality', supersedes: [] } };
  const finalRecord = JSON.stringify(record);
  assert.throws(() => adapter.apaReferenceCodecSchema(currentInput), /CURRENT_APA_REVISION_LIMIT/u);
  assert.equal(JSON.stringify(record), finalRecord);
  assert.equal(adapter.currentApaView({ bundle, principal, record }).version, 24);
  console.log(JSON.stringify({ proof: 'OFFLINE_UUID_MAIN_CODEC_GROWTH_ONLY', structural_case: label, revisions: 24,
    source_id_chars: 85, exercised_report_ref_nodes: baselineRefNodes.length,
    constructed_maximal_shape: maximal,
    schema_metrics_each_revision: firstMetrics, correction_revision: 24,
    real_provider_calls: 0, runtime_or_customer_acceptance: false }));
});
}
