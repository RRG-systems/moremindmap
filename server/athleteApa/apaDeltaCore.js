import { currentApaHash, MAX_CURRENT_APA_REVISIONS } from './currentApaCore.js';
import { object, list, DOMAIN_SCHEMA, FUTURE_SCHEMA, CANDIDATE_SCHEMA,
  REPORT_SCHEMA } from '../athleteAcademyV1/apa/schema.js';
import { validateReport, selectMove } from '../athleteAcademyV1/apa/contract.js';
import { APA_NARRATIVE_FIELDS, APA_REPORT_NARRATIVE_FIELDS, APA_CONFIRMATION_NARRATIVE_FIELDS,
  NARRATIVE_UPDATE_SCHEMA, setApaNarrativeValue, validateApaNarrativeCandidate,
  verifyApaNarrativeProvenance } from '../athleteConsultingV2/apaNarrative.js';

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);
const same = (before, after) => before === undefined || after === undefined
  ? before === after : currentApaHash(before) === currentApaHash(after);
const normalized = value => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value;
const changed = (before, after) => !same(normalized(before), normalized(after));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function requireThat(condition, code, path) {
  if (condition) return;
  const error = new Error(code);
  error.validation_path = path;
  throw error;
}

function withoutBosRefs(schema) {
  const properties = clone(schema.properties);
  delete properties.bos_refs;
  if (properties.gates) properties.gates = { ...properties.gates, minItems: 5, maxItems: 5 };
  return object(properties);
}

const structuralEqual = (a, b) => {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => structuralEqual(value, b[index]));
  return isObject(a) && isObject(b) && Object.keys(a).length === Object.keys(b).length
    && Object.keys(a).every(key => own(b, key) && structuralEqual(a[key], b[key]));
};

// Enum/const are structural restrictions, including inside anyOf. Dispatching
// first on type would silently ignore whole-value restrictions on arrays/objects.
export function matchesApaSchema(value, schema) {
  if (!isObject(schema)) return false;
  if (schema.enum && !schema.enum.some(option => structuralEqual(value, option))) return false;
  if (own(schema, 'const') && !structuralEqual(value, schema.const)) return false;
  if (schema.anyOf && !schema.anyOf.some(option => matchesApaSchema(value, option))) return false;
  if (!schema.type) return Boolean(schema.anyOf || schema.enum || own(schema, 'const'));
  if (schema.type === 'array') return Array.isArray(value)
    && (schema.minItems === undefined || value.length >= schema.minItems)
    && (schema.maxItems === undefined || value.length <= schema.maxItems)
    && (!schema.items || value.every(item => matchesApaSchema(item, schema.items)));
  if (schema.type === 'object') return isObject(value)
    && (schema.required || []).every(key => own(value, key))
    && (schema.additionalProperties !== false || Object.keys(value).every(key => own(schema.properties || {}, key)))
    && Object.entries(schema.properties || {}).every(([key, child]) =>
      !own(value, key) || matchesApaSchema(value[key], child));
  if (schema.type === 'null') return value === null;
  if (schema.type === 'integer') return Number.isSafeInteger(value)
    && (schema.minimum === undefined || value >= schema.minimum)
    && (schema.maximum === undefined || value <= schema.maximum);
  return typeof value === schema.type;
}

export const APA_DELTA_REQUEST_SCHEMA_LIMITS = freeze({ properties: 5000, max_depth: 10,
  enum_values: 1000, total_schema_string_chars: 120000 });
export function apaDeltaSchemaMetrics(schema) {
  const counts = { properties: 0, max_depth: 0, enum_values: 0,
    enum_string_chars: 0, total_schema_string_chars: 0 };
  const chars = value => typeof value === 'string' ? value.length : Array.isArray(value)
    ? value.reduce((sum, item) => sum + chars(item), 0) : isObject(value)
      ? Object.entries(value).reduce((sum, [key, child]) => sum + key.length + chars(child), 0) : 0;
  function visit(node, depth) {
    if (!isObject(node)) return;
    const next = depth + (node.type === 'object' || node.type === 'array' ? 1 : 0);
    counts.max_depth = Math.max(counts.max_depth, next);
    if (node.enum) {
      counts.enum_values += node.enum.length;
      const size = chars(node.enum);
      counts.enum_string_chars += size; counts.total_schema_string_chars += size;
    }
    if (own(node, 'const')) counts.total_schema_string_chars += chars(node.const);
    if (typeof node.$ref === 'string') counts.total_schema_string_chars += node.$ref.length;
    for (const key of ['properties', '$defs', 'definitions']) {
      if (!isObject(node[key])) continue;
      const entries = Object.entries(node[key]);
      if (key === 'properties') counts.properties += entries.length;
      counts.total_schema_string_chars += entries.reduce((sum, [name]) => sum + name.length, 0);
      entries.forEach(([, child]) => visit(child, next));
    }
    if (node.items) visit(node.items, next);
    for (const key of ['anyOf', 'allOf', 'oneOf']) (node[key] || []).forEach(child => visit(child, next));
  }
  visit(schema, 0);
  return freeze(counts);
}
export function assertApaDeltaSchemaBudget(schema) {
  const metrics = apaDeltaSchemaMetrics(schema);
  requireThat(Object.entries(APA_DELTA_REQUEST_SCHEMA_LIMITS).every(([key, limit]) => metrics[key] <= limit),
    'APA_COMPOSITION_REQUEST_SCHEMA_TOO_LARGE', 'delta');
  return metrics;
}

// Internal, statically instantiated by the demo and canonical-account lanes.
export function createApaDeltaCore(adapter) {
  requireThat(isObject(adapter) && typeof adapter.contract === 'string'
    && typeof adapter.receiptContract === 'string' && isObject(adapter.bindingSchema)
    && ['validateBundle', 'verifyPriorIdentity', 'changeIdentity', 'sourceId',
      'deltaIdentity'].every(key => typeof adapter[key] === 'function'),
  'APA_DELTA_AUTHORITY_ADAPTER_REQUIRED', 'binding');

  // The provider may replace complete existing entities and explicitly reviewed
  // narrative fields only. Immutable identity, assessment date, coach view, accepted BOS
  // references, selection results and consent stay on the server.
  const APA_DELTA_SCHEMA = freeze(object({
    contract: { type: 'string', enum: [adapter.contract] },
    binding: clone(adapter.bindingSchema),
    domains: { ...list(withoutBosRefs(DOMAIN_SCHEMA)), maxItems: 4 },
    futures: { ...list(withoutBosRefs(FUTURE_SCHEMA)), maxItems: 5 },
    candidates: { ...list(withoutBosRefs(CANDIDATE_SCHEMA)), maxItems: 5 },
    narratives: { ...list(NARRATIVE_UPDATE_SCHEMA), maxItems: APA_NARRATIVE_FIELDS.length },
  }));

  const matchesSchema = matchesApaSchema;

  function strictCandidate(artifact) {
    const candidate = { confirmation: clone(artifact.confirmation), report: clone(artifact.report),
      narrative_updates: [] };
    for (const entity of candidate.report.candidates) {
      // Strict provider-compatible full output needs this nullable field. The
      // existing composer restores legacy absence AFTER its full-schema check.
      if (!own(entity, 'review_schedule')) entity.review_schedule = null;
    }
    return candidate;
  }

  const inactiveSources = artifact => [...new Set(artifact.sources.flatMap(source => source.supersedes || []))];
  function firstInactiveReference(value, inactive, path = 'report') {
    if (Array.isArray(value)) {
      for (const [index, child] of value.entries()) {
        const found = firstInactiveReference(child, inactive, `${path}.${index}`);
        if (found) return found;
      }
    } else if (isObject(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (key === 'refs' && Array.isArray(child) && child.some(id => inactive.has(id))) return `${path}.refs`;
        const found = firstInactiveReference(child, inactive, `${path}.${key}`);
        if (found) return found;
      }
    }
    return null;
  }

  function assertPrior(bundle, prior) {
    adapter.validateBundle(bundle);
    requireThat(isObject(prior) && isObject(prior.artifact)
      && Number.isSafeInteger(prior.version) && prior.version >= 0
      && prior.version < MAX_CURRENT_APA_REVISIONS
      && prior.baseline_hash === bundle.apa.artifact_sha256,
    'APA_DELTA_PRIOR_INVALID', 'binding.current_apa_version');
    const artifact = prior.artifact;
    if (prior.version === 0) {
      requireThat(same(artifact, bundle.apa), 'APA_DELTA_PRIOR_INVALID', 'binding.current_apa_sha256');
    } else {
      const { artifact_sha256, ...body } = artifact;
      requireThat(adapter.verifyPriorIdentity(artifact, bundle) && artifact.mm === bundle.person.mm
        && artifact.current_apa_version === prior.version
        && artifact.baseline_artifact_sha256 === bundle.apa.artifact_sha256
        && artifact.bos_sha256 === bundle.bos.artifact_sha256
        && artifact_sha256 === currentApaHash(body), 'APA_DELTA_PRIOR_INVALID', 'binding.current_apa_sha256');
      requireThat(Array.isArray(artifact.sources)
        && same(artifact.sources.slice(0, bundle.apa.sources.length), bundle.apa.sources)
        && same(artifact.bos_sources, bundle.apa.bos_sources), 'APA_DELTA_PRIOR_INVALID', 'prior.sources');
    }
    const full = strictCandidate(artifact);
    requireThat(matchesSchema(full.report, REPORT_SCHEMA), 'APA_DELTA_PRIOR_INVALID', 'prior.report');
    validateReport(full.report, artifact);
    requireThat(same({ status: artifact.status, move: artifact.move, receipt: artifact.receipt }, selectMove(artifact.report)),
      'APA_DELTA_PRIOR_INVALID', 'prior.move');
    requireThat(!firstInactiveReference(full.report, new Set(inactiveSources(artifact))),
      'APA_DELTA_PRIOR_INVALID', 'prior.report.refs');
    return full;
  }

  function assertChange(bundle, prior, change) {
    requireThat(isObject(change) && UUID.test(change.id || '') && UUID.test(change.source_message_id || '')
      && change.mm === bundle.person.mm && adapter.changeIdentity(change, bundle)
      && change.confirmed === true && change.confirmed_by === 'athlete'
      && ['reality', 'correction'].includes(change.kind)
      && typeof change.confirmed_at === 'string' && !Number.isNaN(Date.parse(change.confirmed_at))
      && new Date(change.confirmed_at).toISOString() === change.confirmed_at
      && typeof change.reason === 'string' && change.reason.trim().length > 0 && change.reason.length <= 1000
      && Array.isArray(change.supersedes) && change.supersedes.length <= 8,
    'APA_DELTA_CONFIRMED_SOURCE_INVALID', 'binding.source_id');
    const sourceId = adapter.sourceId(change, bundle);
    const sources = new Map(prior.artifact.sources.map(source => [source.id, source]));
    const inactive = new Set(inactiveSources(prior.artifact));
    requireThat(!sources.has(sourceId), 'APA_DELTA_CONFIRMED_SOURCE_INVALID', 'binding.source_id');
    requireThat(change.kind === 'correction' ? change.supersedes.length > 0 : change.supersedes.length === 0,
      'APA_DELTA_CORRECTION_LINEAGE_INVALID', 'binding.source_id');
    requireThat(new Set(change.supersedes).size === change.supersedes.length
      && change.supersedes.every(id => sources.has(id) && !inactive.has(id)
        && ['Athlete', 'Athlete confirmation', 'Athlete-confirmed coaching update'].includes(sources.get(id).source)),
    'APA_DELTA_CORRECTION_LINEAGE_INVALID', 'binding.source_id');
    requireThat(!prior.artifact.report.coach_view.refs.some(id => change.supersedes.includes(id)),
      'APA_DELTA_COACH_CORRECTION_CONFLICT', 'report.coach_view.refs');
    return sourceId;
  }

  // Source-message authorship and the current record/receipt chain are checked
  // by assertCurrentApaConfirmedSource before this helper. This exact binding is
  // an additional output-custody check, never a replacement authorization gate.
  function apaDeltaBinding({ bundle, prior, confirmedChange }) {
    assertPrior(bundle, prior);
    const sourceId = assertChange(bundle, prior, confirmedChange);
    return freeze({ ...adapter.deltaIdentity(bundle), mm: bundle.person.mm,
      bos_sha256: bundle.bos.artifact_sha256, baseline_apa_sha256: bundle.apa.artifact_sha256,
      current_apa_sha256: prior.artifact.artifact_sha256, current_apa_version: prior.version,
      source_id: sourceId, source_message_id: confirmedChange.source_message_id });
  }

  const APA_REFERENCE_CODEC_CONTRACT = adapter.codecContract;
  function buildApaReferenceCodecSchema(input, previousCodec = false) {
    requireThat(typeof APA_REFERENCE_CODEC_CONTRACT === 'string', 'APA_DELTA_AUTHORITY_ADAPTER_REQUIRED', 'binding');
    const expected = apaDeltaBinding(input);
    const inactive = new Set([...inactiveSources(input.prior.artifact), ...input.confirmedChange.supersedes]);
    const citation = refs => ({ type: 'boolean',
      ...(!refs.some(id => !inactive.has(id)) ? { enum: [true] } : {}) });
    function gateSchema(gate, { unchanged, cite }) {
      return object({ id: { type: 'string', enum: [gate.id] },
        pass: unchanged ? { type: 'boolean', enum: [gate.pass] } : { type: 'boolean' },
        reason: unchanged ? { type: 'string', enum: [gate.reason] } : { type: 'string' },
        cite_confirmed_update: cite ? { type: 'boolean', enum: [true] } : citation(gate.refs) });
    }
    function entitySchema(schema, entity, key, candidateCitation = null) {
      const properties = clone(schema.properties);
      delete properties.bos_refs; delete properties.refs;
      properties[key] = { type: 'string', enum: [entity[key]] };
      properties.cite_confirmed_update = previousCodec || candidateCitation === null
        ? citation(entity.refs) : { type: 'boolean', enum: [candidateCitation] };
      if (properties.gates) properties.gates = previousCodec
        ? { type: 'array', minItems: 5, maxItems: 5,
          items: { anyOf: entity.gates.map(gate => object({ id: { type: 'string', enum: [gate.id] },
            pass: { type: 'boolean' }, reason: { type: 'string' }, cite_confirmed_update: citation(gate.refs) })) } }
        : { type: 'array', minItems: 5, maxItems: 5,
          items: { anyOf: entity.gates.flatMap(gate => candidateCitation === true
            ? [gateSchema(gate, { unchanged: true, cite: false }),
              gateSchema(gate, { unchanged: false, cite: true })]
            : [gateSchema(gate, { unchanged: true, cite: false })]) } };
      return object(properties);
    }
    const families = [['domains', DOMAIN_SCHEMA, 'id', 4], ['futures', FUTURE_SCHEMA, 'role', 5],
      ['candidates', CANDIDATE_SCHEMA, 'candidate_id', 5]];
    const properties = { contract: { type: 'string', enum: [APA_REFERENCE_CODEC_CONTRACT] },
      binding: object(Object.fromEntries(Object.entries(expected).map(([key, value]) =>
        [key, { type: typeof value === 'number' ? 'integer' : typeof value, enum: [value] }]))) };
    for (const [family, schema, key, maxItems] of families) properties[family] = { type: 'array', maxItems,
      items: { anyOf: previousCodec
        ? input.prior.artifact.report[family].map(entity => entitySchema(schema, entity, key))
        : input.prior.artifact.report[family].flatMap(entity => family === 'candidates'
          ? (citation(entity.refs).enum ? [true] : [false, true])
            .map(cite => entitySchema(schema, entity, key, cite))
          : [entitySchema(schema, entity, key)]) } };
    properties.narratives = { type: 'array', maxItems: APA_NARRATIVE_FIELDS.length,
      items: { anyOf: APA_NARRATIVE_FIELDS.map(field => object({ field: { type: 'string', enum: [field] },
        value: field === 'what_we_dont_know' ? { type: 'array', items: { type: 'string' } } : { type: 'string' },
        cite_confirmed_update: { type: 'boolean', enum: [true] } })) } };
    const schema = freeze(object(properties));
    assertApaDeltaSchemaBudget(schema);
    return schema;
  }
  const apaReferenceCodecSchema = input => buildApaReferenceCodecSchema(input);
  // The pre-tightening v2 schema is rebuilt only for exact saved-request recovery.
  // It must remain byte-for-byte stable with immutable request evidence.
  const apaReferenceCodecSchemaV2 = input => buildApaReferenceCodecSchema(input, true);

  // Versioned wire codec, not rejected-ref repair. No provider refs are admitted.
  // Each citation flag refers only to that exact entity/gate; child citations do
  // not imply a parent citation. The old strict reconstruction remains the gate.
  function decodeReferenceCodec({ encodedDelta, ...input }, previousCodec = false) {
    const schema = previousCodec ? apaReferenceCodecSchemaV2(input) : apaReferenceCodecSchema(input);
    requireThat(matchesSchema(encodedDelta, schema), 'APA_DELTA_SCHEMA_INVALID', 'delta');
    const expected = apaDeltaBinding(input);
    const inactive = new Set([...inactiveSources(input.prior.artifact), ...input.confirmedChange.supersedes]);
    const refsFor = (refs, cite) => {
      const active = refs.filter(id => !inactive.has(id));
      requireThat(cite === true || (cite === false && active.length > 0), 'APA_DELTA_SCHEMA_INVALID', 'delta');
      return cite ? [...active, expected.source_id] : [...active];
    };
    const delta = { contract: adapter.contract, binding: clone(encodedDelta.binding) };
    for (const [family, key] of [['domains', 'id'], ['futures', 'role'], ['candidates', 'candidate_id']]) {
      const originals = new Map(input.prior.artifact.report[family].map(entity => [entity[key], entity]));
      delta[family] = encodedDelta[family].map(entity => {
        const { cite_confirmed_update, ...body } = clone(entity), before = originals.get(entity[key]);
        const decoded = { ...body, refs: refsFor(before.refs, cite_confirmed_update) };
        if (family === 'candidates') {
          const gates = new Map(before.gates.map(gate => [gate.id, gate]));
          decoded.gates = body.gates.map(gate => {
            const { cite_confirmed_update: cite, ...gateBody } = gate;
            return { ...gateBody, refs: refsFor(gates.get(gate.id).refs, cite) };
          });
        }
        return decoded;
      });
    }
    const provenance = verifyApaNarrativeProvenance(input.prior.artifact);
    delta.narratives = encodedDelta.narratives.map(update => ({ field: update.field, value: clone(update.value),
      refs: refsFor(provenance.fields.find(field => field.field === update.field).refs, true) }));
    const reconstructed = reconstructApaDelta({ ...input, delta });
    return freeze({ delta, ...reconstructed });
  }
  const decodeApaReferenceCodec = input => decodeReferenceCodec(input);
  const decodeApaReferenceCodecV2 = input => decodeReferenceCodec(input, true);

  function verifyRefs(before, after, sourceId, inactive, path) {
    requireThat(before.every(id => inactive.has(id) || after.includes(id))
      && after.every(id => before.includes(id) || id === sourceId),
    'APA_DELTA_SOURCE_REFERENCES_CHANGED', `${path}.refs`);
  }

  function verifyChanges(before, after, fields, sourceId, path) {
    for (const field of fields) {
      if (changed(before[field], after[field])) requireThat(after.refs.includes(sourceId),
        'APA_DELTA_CHANGE_NOT_SOURCE_BOUND', `${path}.${field}`);
    }
  }

  const DOMAIN_FIELDS = ['goal', 'strength', 'gap', 'help', 'detail', 'bos_connection', 'unknowns'];
  const FUTURE_FIELDS = ['headline', 'what', 'conditions', 'first_sign', 'details', 'sufficient_evidence'];
  const CANDIDATE_FIELDS = ['domain', 'action', 'why', 'when', 'who', 'action_signal', 'progress_signal',
    'review', 'review_schedule', 'stop_or_change', 'bos_fit', 'selection_signals'];

  function applyEntities({ replacements, originals, key, fields, family, candidate, sourceId, inactive }) {
    const indices = new Map(originals.map((entity, index) => [entity[key], index]));
    let previousIndex = -1;
    const targets = [];
    for (const replacement of replacements) {
      const id = replacement[key], index = indices.get(id);
      requireThat(index !== undefined, 'APA_DELTA_TARGET_INVALID', `report.${family}`);
      const path = `report.${family}.${index}`;
      requireThat(index > previousIndex, 'APA_DELTA_TARGET_ORDER_INVALID', path);
      previousIndex = index;
      const before = originals[index];
      verifyRefs(before.refs, replacement.refs, sourceId, inactive, path);
      verifyChanges(before, replacement, fields, sourceId, path);
      if (family === 'candidates') {
        requireThat(same(before.gates.map(gate => gate.id), replacement.gates.map(gate => gate.id)),
          'APA_DELTA_GATE_STRUCTURE_CHANGED', `${path}.gates`);
        for (const [gateIndex, gate] of replacement.gates.entries()) {
          const priorGate = before.gates[gateIndex], gatePath = `${path}.gates.${gateIndex}`;
          verifyRefs(priorGate.refs, gate.refs, sourceId, inactive, gatePath);
          for (const field of ['pass', 'reason']) {
            if (changed(priorGate[field], gate[field])) requireThat(replacement.refs.includes(sourceId)
              && gate.refs.includes(sourceId), 'APA_DELTA_CHANGE_NOT_SOURCE_BOUND', `${gatePath}.${field}`);
          }
        }
      }
      candidate.report[family][index] = { ...clone(replacement), bos_refs: clone(before.bos_refs) };
      if (family === 'domains') candidate.confirmation.goals[id] = replacement.goal;
      targets.push(id);
    }
    return targets;
  }

  function reconstructApaDelta({ delta, bundle, prior, confirmedChange, confirmedSource }) {
    const expected = apaDeltaBinding({ bundle, prior, confirmedChange });
    requireThat(matchesSchema(delta, APA_DELTA_SCHEMA), 'APA_DELTA_SCHEMA_INVALID', 'delta');
    requireThat(same(delta.binding, expected), 'APA_DELTA_BINDING_MISMATCH', 'binding');
    const before = strictCandidate(prior.artifact), candidate = clone(before);
    const inactive = new Set([...inactiveSources(prior.artifact), ...confirmedChange.supersedes]);
    const targeted = {};
    for (const [family, key, fields] of [['domains', 'id', DOMAIN_FIELDS], ['futures', 'role', FUTURE_FIELDS],
      ['candidates', 'candidate_id', CANDIDATE_FIELDS]]) {
      targeted[family] = applyEntities({ replacements: delta[family], originals: before.report[family],
        key, fields, family, candidate, sourceId: expected.source_id, inactive });
    }
    let previousNarrativeIndex = -1;
    for (const [updateIndex, update] of delta.narratives.entries()) {
      const index = APA_NARRATIVE_FIELDS.indexOf(update.field);
      requireThat(index > previousNarrativeIndex, 'APA_DELTA_TARGET_ORDER_INVALID', `narrative_updates.${updateIndex}`);
      previousNarrativeIndex = index;
      setApaNarrativeValue(candidate, update.field, clone(update.value));
    }
    candidate.narrative_updates = clone(delta.narratives);
    targeted.narratives = delta.narratives.map(update => update.field);
    // This shared gate covers correct field/value types, new-source support,
    // known superseded dependencies, and explicit review/reconfirmation when
    // baseline field-level provenance was never recorded. Never strip it away.
    validateApaNarrativeCandidate({ priorArtifact: prior.artifact, candidate,
      sourceId: expected.source_id, sourceMessageId: confirmedChange.source_message_id,
      sourceVersion: prior.version + 1, inactiveSourceIds: [...inactive],
      supersedes: confirmedChange.supersedes, sourceText: confirmedSource?.text });
    const unresolvedPath = firstInactiveReference(candidate.report, inactive);
    requireThat(!unresolvedPath, 'APA_DELTA_CORRECTION_DEPENDENCY_OMITTED', unresolvedPath || 'report.refs');
    requireThat(matchesSchema(candidate.report, REPORT_SCHEMA), 'APA_DELTA_SCHEMA_INVALID', 'report');
    try {
      validateReport(candidate.report, { confirmation: candidate.confirmation,
        sources: [...prior.artifact.sources, { id: expected.source_id, source: 'Athlete-confirmed coaching update' }],
        bos_sources: prior.artifact.bos_sources });
    } catch (error) {
      if (!error.validation_path) error.validation_path = 'report';
      throw error;
    }
    const receipt = { contract: adapter.receiptContract,
      hash_basis: 'STRICT_FULL_COMPOSITION_CANDIDATE', before_sha256: currentApaHash(before),
      after_sha256: currentApaHash(candidate), targeted_entities: targeted,
      unchanged_copy: { frozen_confirmation_fields: ['assessment_date', 'confirmed'],
        copied_confirmation_fields: APA_CONFIRMATION_NARRATIVE_FIELDS.filter(field => !targeted.narratives.includes(field)),
        copied_report_fields: [...APA_REPORT_NARRATIVE_FIELDS.filter(field => !targeted.narratives.includes(field)), 'coach_view'],
        bos_refs: true, untargeted_entities: true },
      legacy_review_schedule_padding: prior.artifact.report.candidates.filter(entity => !own(entity, 'review_schedule')).length };
    return freeze({ candidate, receipt });
  }

  return Object.freeze({ APA_DELTA_SCHEMA, APA_REFERENCE_CODEC_CONTRACT, apaDeltaBinding,
    apaReferenceCodecSchema, decodeApaReferenceCodec, apaReferenceCodecSchemaV2,
    decodeApaReferenceCodecV2, reconstructApaDelta });
}
