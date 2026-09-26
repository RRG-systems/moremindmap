import { createHash } from 'node:crypto';
import { object, string, strings } from '../athleteAcademyV1/apa/schema.js';

export const APA_NARRATIVE_FIELDS = Object.freeze(['headline', 'opening', 'connection',
  'main_obstacle', 'what_we_dont_know']);
export const NARRATIVE_UPDATE_SCHEMA = Object.freeze(object({
  field: { type: 'string', enum: [...APA_NARRATIVE_FIELDS] },
  value: { anyOf: [string, strings] }, refs: strings,
}));
export const APA_NARRATIVE_UPDATE_SCHEMA = NARRATIVE_UPDATE_SCHEMA;
const CONTRACT = 'athlete_current_apa_narrative_provenance_v1';
const PROVENANCE_KEYS = ['field', 'status', 'value_sha256', 'refs', 'source_id', 'source_message_id', 'version'];
const CHANGE_KEYS = ['field', 'path', 'before', 'after', 'before_refs', 'after_refs', 'value_changed',
  'reference_changed', 'prior_provenance', 'before_provenance', 'source_id', 'source_message_id', 'version'];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const objectLike = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same = (before, after) => hash(before) === hash(after);
const ensure = (condition, code, path) => {
  if (condition) return;
  const error = new Error(code); error.validation_path = path; throw error;
};
const exactKeys = (value, keys) => objectLike(value)
  && keys.every(key => own(value, key)) && Object.keys(value).length === keys.length;
const typedValue = (field, value) => field === 'what_we_dont_know'
  ? Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim())
  : typeof value === 'string' && Boolean(value.trim());
const sourceIds = artifact => new Set((artifact.sources || []).map(source => source.id));
const inactiveIds = artifact => new Set((artifact.sources || []).flatMap(source => source.supersedes || []));
const uniqueStrings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item)
  && new Set(value).size === value.length;

function uncitedRecord(field, value) {
  return { field, status: 'BASELINE_UNCITED_AT_FIELD_LEVEL', value_sha256: hash(value),
    refs: [], source_id: null, source_message_id: null, version: null };
}

// Absence is an honest legacy boundary, never an invented set of citations.
// Any durable new record is exact-value/hash/source/version bound on readback.
export function verifyApaNarrativeProvenance(artifact) {
  ensure(objectLike(artifact?.report) && APA_NARRATIVE_FIELDS.every(field =>
    typedValue(field, artifact.report[field])), 'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
  const provenance = artifact?.narrative_provenance;
  if (provenance === undefined) return { contract: CONTRACT,
    fields: APA_NARRATIVE_FIELDS.map(field => uncitedRecord(field, artifact.report[field])) };
  ensure(exactKeys(provenance, ['contract', 'fields']) && provenance.contract === CONTRACT
    && Array.isArray(provenance.fields) && provenance.fields.length === APA_NARRATIVE_FIELDS.length,
  'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
  const known = sourceIds(artifact), inactive = inactiveIds(artifact);
  const version = artifact.current_apa_version || 0;
  for (const [index, record] of provenance.fields.entries()) {
    const path = `narrative_provenance.fields.${index}`;
    ensure(exactKeys(record, PROVENANCE_KEYS) && record.field === APA_NARRATIVE_FIELDS[index]
      && typedValue(record.field, artifact.report[record.field])
      && record.value_sha256 === hash(artifact.report[record.field]) && uniqueStrings(record.refs),
    'APA_NARRATIVE_PROVENANCE_INVALID', path);
    if (record.status === 'BASELINE_UNCITED_AT_FIELD_LEVEL') {
      ensure(record.refs.length === 0 && record.source_id === null
        && record.source_message_id === null && record.version === null,
      'APA_NARRATIVE_PROVENANCE_INVALID', path);
    } else {
      const source = artifact.sources.find(item => item.id === record.source_id);
      ensure(record.status === 'SOURCE_BOUND' && record.refs.length > 0
        && record.refs.includes(record.source_id)
        && record.refs.every(id => known.has(id) && !inactive.has(id))
        && source?.source === 'Athlete-confirmed coaching update'
        && source.source_message_id === record.source_message_id
        && typeof record.source_message_id === 'string'
        && Number.isSafeInteger(record.version) && record.version >= 1 && record.version <= version,
      'APA_NARRATIVE_PROVENANCE_INVALID', path);
    }
  }
  return clone(provenance);
}

// Shared by typed delta reconstruction and the final pure publication gate.
// A companion is explicit review of THIS operation, not copied old approval.
export function validateApaNarrativeCandidate({ priorArtifact, candidate, sourceId,
  sourceMessageId, sourceVersion, inactiveSourceIds = [], supersedes = [] }) {
  ensure(objectLike(candidate?.report) && APA_NARRATIVE_FIELDS.every(field =>
    typedValue(field, candidate.report[field])), 'APA_NARRATIVE_UPDATE_INVALID', 'report');
  const before = verifyApaNarrativeProvenance(priorArtifact);
  const updates = candidate.narrative_updates === undefined ? [] : candidate.narrative_updates;
  ensure(Array.isArray(updates) && updates.length <= APA_NARRATIVE_FIELDS.length,
    'APA_NARRATIVE_UPDATE_INVALID', 'narrative_updates');
  const known = sourceIds(priorArtifact); known.add(sourceId);
  const inactive = new Set([...inactiveIds(priorArtifact), ...inactiveSourceIds, ...supersedes]);
  const byField = new Map(), updateIndices = new Map(); let previousIndex = -1;
  for (const [index, update] of updates.entries()) {
    const path = `narrative_updates.${index}`;
    const fieldIndex = APA_NARRATIVE_FIELDS.indexOf(update?.field);
    ensure(exactKeys(update, ['field', 'value', 'refs']) && fieldIndex >= 0
      && fieldIndex > previousIndex && typedValue(update.field, update.value),
    'APA_NARRATIVE_UPDATE_INVALID', path);
    previousIndex = fieldIndex;
    ensure(same(update.value, candidate.report[update.field]),
      'APA_NARRATIVE_VALUE_MISMATCH', `${path}.value`);
    ensure(uniqueStrings(update.refs) && update.refs.includes(sourceId)
      && update.refs.every(id => known.has(id) && !inactive.has(id)),
    'APA_NARRATIVE_SOURCE_INVALID', `${path}.refs`);
    const prior = before.fields[fieldIndex];
    ensure(prior.refs.every(id => inactive.has(id) || update.refs.includes(id)),
      'APA_NARRATIVE_SOURCE_REFERENCES_CHANGED', `${path}.refs`);
    byField.set(update.field, update);
    updateIndices.set(update.field, index);
  }
  const fields = [], changes = [], paths = [];
  for (const [index, field] of APA_NARRATIVE_FIELDS.entries()) {
    const prior = before.fields[index], update = byField.get(field);
    const valueChanged = !same(priorArtifact.report[field], candidate.report[field]);
    ensure(!valueChanged || update, 'CURRENT_APA_UNCITED_FIELD_CHANGED', `report.${field}`);
    const unknown = prior.status === 'BASELINE_UNCITED_AT_FIELD_LEVEL';
    const mustReview = supersedes.length > 0 && (unknown || prior.refs.some(id => inactive.has(id)));
    ensure(!mustReview || update, 'APA_NARRATIVE_CORRECTION_REVIEW_REQUIRED', `report.${field}`);
    if (!update) { fields.push(clone(prior)); continue; }
    ensure(Number.isSafeInteger(sourceVersion) && sourceVersion >= 1
      && typeof sourceMessageId === 'string' && sourceMessageId.length > 0,
    'APA_NARRATIVE_SOURCE_INVALID', `narrative_updates.${updateIndices.get(field)}.refs`);
    const next = { field, status: 'SOURCE_BOUND', value_sha256: hash(update.value),
      refs: clone(update.refs), source_id: sourceId, source_message_id: sourceMessageId,
      version: sourceVersion };
    const referenceChanged = unknown || !same(prior.refs, next.refs);
    fields.push(next);
    if (valueChanged) paths.push(`report.${field}`);
    paths.push(`narrative_provenance.${field}`);
    changes.push({ field, path: `report.${field}`, before: clone(priorArtifact.report[field]),
      after: clone(update.value), before_refs: unknown ? null : clone(prior.refs),
      after_refs: clone(next.refs), value_changed: valueChanged,
      reference_changed: referenceChanged,
      prior_provenance: unknown ? 'BASELINE_FIELD_UNCITED' : 'SOURCE_BOUND',
      before_provenance: unknown ? null : clone(prior),
      source_id: sourceId, source_message_id: sourceMessageId, version: sourceVersion });
  }
  return { provenance: { contract: CONTRACT, fields }, changes, material_paths: [...new Set(paths)] };
}

// Historical receipts retain exact typed values, but never turn unknown legacy
// dependencies into invented citations. The owning record supplies the chain.
export function verifyApaNarrativeReceipt(receipt, { sources, priorVersion, priorArtifactSha256,
  inactiveSourceIds = [] }) {
  const changes = receipt.narrative_changes;
  if (changes === undefined) return true;
  ensure(Array.isArray(changes) && changes.length <= APA_NARRATIVE_FIELDS.length,
    'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
  if (!changes.length) return true;
  ensure(receipt.prior_version === priorVersion && receipt.prior_artifact_sha256 === priorArtifactSha256,
    'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
  const known = new Set(sources.map(source => source.id)), inactive = new Set(inactiveSourceIds);
  let previousIndex = -1;
  for (const [index, change] of changes.entries()) {
    const fieldIndex = APA_NARRATIVE_FIELDS.indexOf(change?.field), path = `narrative_provenance.fields.${index}`;
    ensure(exactKeys(change, CHANGE_KEYS) && fieldIndex > previousIndex && fieldIndex >= 0
      && change.path === `report.${change.field}` && typedValue(change.field, change.before)
      && typedValue(change.field, change.after) && uniqueStrings(change.after_refs)
      && change.after_refs.includes(receipt.source_id)
      && change.after_refs.every(id => known.has(id) && !inactive.has(id))
      && change.value_changed === !same(change.before, change.after)
      && change.source_id === receipt.source_id && change.source_message_id === receipt.source_message_id
      && change.version === receipt.version,
    'APA_NARRATIVE_PROVENANCE_INVALID', path);
    previousIndex = fieldIndex;
    const unknown = change.prior_provenance === 'BASELINE_FIELD_UNCITED';
    ensure(unknown ? change.before_refs === null && change.before_provenance === null
      : change.prior_provenance === 'SOURCE_BOUND' && uniqueStrings(change.before_refs)
        && exactKeys(change.before_provenance, PROVENANCE_KEYS)
        && change.before_provenance.status === 'SOURCE_BOUND'
        && change.before_provenance.field === change.field
        && change.before_provenance.value_sha256 === hash(change.before)
        && same(change.before_provenance.refs, change.before_refs)
        && change.before_refs.includes(change.before_provenance.source_id)
        && typeof change.before_provenance.source_message_id === 'string'
        && Number.isSafeInteger(change.before_provenance.version)
        && change.before_provenance.version >= 1 && change.before_provenance.version <= priorVersion,
    'APA_NARRATIVE_PROVENANCE_INVALID', path);
    ensure(change.reference_changed === (unknown || !same(change.before_refs, change.after_refs)),
      'APA_NARRATIVE_PROVENANCE_INVALID', path);
    ensure(unknown || change.before_refs.every(id => inactive.has(id) || change.after_refs.includes(id)),
      'APA_NARRATIVE_PROVENANCE_INVALID', path);
    ensure(receipt.material_paths.includes(`narrative_provenance.${change.field}`)
      && receipt.material_paths.includes(`report.${change.field}`) === change.value_changed,
    'APA_NARRATIVE_PROVENANCE_INVALID', path);
  }
  return true;
}
