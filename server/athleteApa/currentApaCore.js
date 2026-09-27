import { createHash } from 'node:crypto';
import { CANDIDATE_SCHEMA, REPORT_SCHEMA } from '../athleteAcademyV1/apa/schema.js';
import { validateReport, selectMove } from '../athleteAcademyV1/apa/contract.js';
import { APA_NARRATIVE_FIELDS, APA_REPORT_NARRATIVE_FIELDS, APA_NARRATIVE_CONTRACT,
  getApaNarrativeValue, validateApaNarrativeCandidate,
  verifyApaNarrativeProvenance, verifyApaNarrativeReceipt } from '../athleteConsultingV2/apaNarrative.js';

// This record lives INSIDE the existing scope-, athlete-, BOS- and baseline-APA-
// bound v2 state envelope. It never replaces the approved source artifact.
export const MAX_CURRENT_APA_REVISIONS = 24;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => structuredClone(value);
const ensure = (condition, code, path = null) => {
  if (!condition) {
    const error = new Error(code);
    if (path !== null) error.validation_path = path;
    throw error;
  }
};
const checkedAt = (path, operation) => {
  try { return operation(); }
  catch (error) {
    if (error instanceof Error && !error.validation_path) error.validation_path = path;
    throw error;
  }
};
const normalized = value => typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : value;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export const currentApaHash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const same = (left, right) => left === undefined || right === undefined
  ? left === right : currentApaHash(left) === currentApaHash(right);
export const inactiveCurrentApaSourceIds = (record = null, additionalSupersedes = []) =>
  [...new Set([...(record?.receipts || []).flatMap(receipt => receipt.supersedes || []),
    ...additionalSupersedes])];
export function assertActiveApaReferences(report, inactiveSourceIds = []) {
  const refs = new Set(sourceRefs(report));
  ensure(inactiveSourceIds.every(id => !refs.has(id)), 'CURRENT_APA_SUPERSEDED_SOURCE_STILL_ACTIVE', 'report');
  return true;
}
const validDate = value => {
  if (!DATE.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const validTime = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

function matchesSchema(value, schema) {
  if (schema.anyOf) return schema.anyOf.some(option => matchesSchema(value, option));
  if (schema.type === 'array') return Array.isArray(value) && value.every(item => matchesSchema(item, schema.items));
  // Older approved youth APA artifacts legitimately omit review_schedule.
  if (schema.type === 'object') return object(value)
    && schema.required.every(key => own(value, key) || (schema === CANDIDATE_SCHEMA && key === 'review_schedule'))
    && Object.keys(value).every(key => own(schema.properties, key))
    && Object.entries(schema.properties).every(([key, child]) =>
      (schema === CANDIDATE_SCHEMA && key === 'review_schedule' && !own(value, key))
        || matchesSchema(value[key], child));
  if (schema.type === 'null') return value === null;
  return typeof value === schema.type && (!schema.enum || schema.enum.includes(value));
}

function sourceRefs(value) {
  if (Array.isArray(value)) return value.flatMap(sourceRefs);
  if (!object(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => key === 'refs' && Array.isArray(child)
    ? child : sourceRefs(child));
}


// This is an internal static factory, never selected by request data. Each
// owning lane supplies its exact identity contract while all report, lineage,
// calendar, provenance and publication behavior is shared here.
export function createCurrentApaCore(adapter) {
  ensure(object(adapter) && typeof adapter.contract === 'string'
    && ['binding', 'artifactIdentity', 'verifyArtifactIdentity', 'changeIdentity',
      'messageIdentity', 'sourceId', 'sourceIdentity', 'receiptIdentity',
      'verifyReceiptIdentity'].every(key => typeof adapter[key] === 'function'),
  'CURRENT_APA_AUTHORITY_ADAPTER_REQUIRED');
  const binding = bundle => adapter.binding(bundle);

  function verifyConfirmation(confirmation, baseline) {
    ensure(object(confirmation) && same(Object.keys(confirmation).sort(), Object.keys(baseline.confirmation).sort())
      && object(confirmation.goals) && same(Object.keys(confirmation.goals).sort(), ['mindset', 'school', 'sport', 'training'])
      && Object.values(confirmation.goals).every(value => typeof value === 'string' && value.trim().length > 0)
      && typeof confirmation.priority === 'string' && confirmation.priority.trim().length > 0
      && confirmation.confirmed === true && confirmation.assessment_date === baseline.confirmation.assessment_date
      && ['assessment_date', 'review_date', 'horizon_date'].every(key => validDate(confirmation[key]))
      && confirmation.review_date > confirmation.assessment_date
      && confirmation.horizon_date >= confirmation.review_date, 'CURRENT_APA_CONFIRMATION_INVALID', 'confirmation');
  }

  function assertOriginalApaSurface(bundle) {
    ensure(object(bundle?.apa) && Array.isArray(bundle.apa.sources)
      && Array.isArray(bundle.apa.bos_sources), 'CURRENT_APA_SOURCES_CHANGED');
    verifyConfirmation(bundle.apa.confirmation, bundle.apa);
    ensure(matchesSchema(bundle.apa.report, REPORT_SCHEMA), 'CURRENT_APA_REPORT_SCHEMA_INVALID', 'report');
    validateReport(bundle.apa.report, bundle.apa);
    verifyApaNarrativeProvenance(bundle.apa);
    ensure(same({ status: bundle.apa.status, move: bundle.apa.move, receipt: bundle.apa.receipt },
      selectMove(bundle.apa.report)), 'CURRENT_APA_MOVE_SELECTION_CHANGED');
    return bundle.apa;
  }

  function verifyArtifact(artifact, bundle, version) {
    ensure(object(artifact) && artifact.mm === bundle.person.mm && adapter.verifyArtifactIdentity(artifact, bundle, version)
      && artifact.baseline_artifact_sha256 === bundle.apa.artifact_sha256
      && artifact.bos_sha256 === bundle.bos.artifact_sha256
      && artifact.current_apa_version === version, 'CURRENT_APA_IDENTITY_MISMATCH');
    const { artifact_sha256, ...body } = artifact;
    ensure(artifact_sha256 === currentApaHash(body), 'CURRENT_APA_ARTIFACT_TAMPERED');
    verifyConfirmation(artifact.confirmation, bundle.apa);
    ensure(Array.isArray(artifact.sources) && Array.isArray(artifact.bos_sources)
      && artifact.sources.length >= bundle.apa.sources.length
      && same(artifact.sources.slice(0, bundle.apa.sources.length), bundle.apa.sources)
      && same(artifact.bos_sources, bundle.apa.bos_sources), 'CURRENT_APA_SOURCES_CHANGED');
    ensure(matchesSchema(artifact.report, REPORT_SCHEMA), 'CURRENT_APA_REPORT_SCHEMA_INVALID');
    validateReport(artifact.report, artifact);
    verifyApaNarrativeProvenance(artifact);
    const selected = selectMove(artifact.report);
    ensure(same({ status: artifact.status, move: artifact.move, receipt: artifact.receipt }, selected),
      'CURRENT_APA_MOVE_SELECTION_CHANGED');
    return artifact;
  }

  // Replay only the new companion-governed narrative surface from the sealed
  // baseline. Legacy publications froze these fields, so they have no invented
  // field-level citations. Before-values and provenance must match this replay,
  // not merely a caller-recomputed receipt hash.
  function verifyNarrativeHistory(bundle, record, artifact) {
    const values = Object.fromEntries(APA_NARRATIVE_FIELDS.map(field => [field, clone(getApaNarrativeValue(bundle.apa, field))]));
    const provenance = verifyApaNarrativeProvenance(bundle.apa);
    let previousContentHash = bundle.apa.artifact_sha256;
    let governed = false;
    let wholeApaGoverned = false;
    const inactive = new Set();
    for (const [index, receipt] of record.receipts.entries()) {
      for (const id of receipt.supersedes || []) inactive.add(id);
      const sources = artifact.sources.slice(0, bundle.apa.sources.length + index + 1);
      governed ||= own(receipt, 'narrative_changes');
      wholeApaGoverned ||= receipt.narrative_contract === APA_NARRATIVE_CONTRACT;
      ensure(!wholeApaGoverned || (receipt.narrative_contract === APA_NARRATIVE_CONTRACT
        && own(receipt, 'narrative_changes')),
        'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
      ensure(!governed || own(receipt, 'narrative_changes'),
        'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
      if (governed || own(receipt, 'prior_version') || own(receipt, 'prior_artifact_sha256'))
        ensure(receipt.prior_version === index && receipt.prior_artifact_sha256 === previousContentHash,
          'CURRENT_APA_RECEIPT_TAMPERED');
      verifyApaNarrativeReceipt(receipt, { sources, priorVersion: index,
        priorArtifactSha256: previousContentHash, inactiveSourceIds: [...inactive] });
      if (governed && receipt.supersedes?.length) {
        const reviewed = new Set(receipt.narrative_changes.map(change => change.field));
        for (const [fieldIndex, before] of provenance.fields.entries()) {
          if (!wholeApaGoverned && !APA_REPORT_NARRATIVE_FIELDS.includes(before.field)) continue;
          ensure((before.status !== 'BASELINE_UNCITED_AT_FIELD_LEVEL'
              && !before.refs.some(id => inactive.has(id))) || reviewed.has(before.field),
          'APA_NARRATIVE_PROVENANCE_INVALID', `narrative_provenance.fields.${fieldIndex}`);
        }
      }
      verifyConfirmation({ ...bundle.apa.confirmation,
        priority: values['confirmation.priority'], review_date: values['confirmation.review_date'],
        horizon_date: values['confirmation.horizon_date'] }, bundle.apa);
      for (const change of receipt.narrative_changes || []) {
        const fieldIndex = APA_NARRATIVE_FIELDS.indexOf(change.field), before = provenance.fields[fieldIndex];
        const uncited = before.status === 'BASELINE_UNCITED_AT_FIELD_LEVEL';
        ensure(same(change.before, values[change.field])
          && same(change.before_provenance, uncited ? null : before)
          && same(change.before_refs, uncited ? null : before.refs),
        'APA_NARRATIVE_PROVENANCE_INVALID', `narrative_provenance.fields.${fieldIndex}`);
        values[change.field] = clone(change.after);
        provenance.fields[fieldIndex] = { field: change.field, status: 'SOURCE_BOUND',
          value_sha256: currentApaHash(change.after), refs: clone(change.after_refs),
          source_id: change.source_id, source_message_id: change.source_message_id, version: receipt.version };
      }
      previousContentHash = receipt.content_hash;
    }
    ensure(!artifact.narrative_provenance || governed,
      'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
    ensure(artifact.narrative_provenance?.contract !== APA_NARRATIVE_CONTRACT || wholeApaGoverned,
      'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
    ensure(APA_NARRATIVE_FIELDS.every(field => same(values[field], getApaNarrativeValue(artifact, field)))
      && same(provenance, verifyApaNarrativeProvenance(artifact)),
    'APA_NARRATIVE_PROVENANCE_INVALID', 'narrative_provenance');
  }

  function currentApaView(bundle, record = null) {
    const expected = binding(bundle);
    if (record === null || record === undefined) return {
      artifact: bundle.apa, baseline_hash: bundle.apa.artifact_sha256, version: 0, receipt: null,
    };
    ensure(object(record) && record.contract === adapter.contract && same(record.binding, expected)
      && Number.isSafeInteger(record.version) && record.version >= 1
      && record.version <= MAX_CURRENT_APA_REVISIONS && Array.isArray(record.receipts)
      && record.receipts.length === record.version, 'CURRENT_APA_RECORD_INVALID');
    let priorHash = bundle.apa.artifact_sha256;
    for (const [index, receipt] of record.receipts.entries()) {
      const { receipt_hash, ...unsigned } = receipt;
      ensure(receipt.version === index + 1 && receipt.prior_hash === priorHash
        && receipt_hash === currentApaHash(unsigned) && UUID.test(receipt.change_id || '')
        && UUID.test(receipt.source_message_id || '') && Array.isArray(receipt.material_paths)
        && receipt.material_paths.length > 0 && validTime(receipt.at), 'CURRENT_APA_RECEIPT_TAMPERED');
      priorHash = receipt_hash;
    }
    ensure(record.receipts.at(-1).content_hash === record.artifact?.artifact_sha256,
      'CURRENT_APA_RECEIPT_TAMPERED');
    const artifact = verifyArtifact(record.artifact, bundle, record.version);
    assertActiveApaReferences(artifact.report, inactiveCurrentApaSourceIds(record));
    ensure(artifact.sources.length === bundle.apa.sources.length + record.version,
      'CURRENT_APA_RECEIPT_TAMPERED');
    for (const receipt of record.receipts) {
      const source = artifact.sources.find(item => item.id === receipt.source_id);
      ensure(receipt.source_id === adapter.sourceId({ id: receipt.change_id }, bundle)
        && adapter.verifyReceiptIdentity(receipt, source, bundle)
        && source?.epistemic === 'ATHLETE_CONFIRMED'
        && source.source_message_id === receipt.source_message_id
        && source.at === receipt.at && same(source.supersedes, receipt.supersedes),
      'CURRENT_APA_RECEIPT_TAMPERED');
    }
    verifyNarrativeHistory(bundle, record, artifact);
    return { artifact,
      baseline_hash: bundle.apa.artifact_sha256, version: record.version, receipt: record.receipts.at(-1) };
  }

  function sourceFromChange(change, state, artifact, bundle) {
    ensure(object(change) && UUID.test(change.id || '') && UUID.test(change.source_message_id || '')
      && change.mm === bundle.person.mm && adapter.changeIdentity(change, bundle)
      && change.confirmed === true && change.confirmed_by === 'athlete'
      && ['reality', 'correction'].includes(change.kind) && validTime(change.confirmed_at)
      && typeof change.reason === 'string' && change.reason.trim().length > 0
      && change.reason.length <= 1000 && Array.isArray(change.supersedes), 'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED');
    const message = state?.messages?.find(item => item.id === change.source_message_id);
    ensure(state?.mm === bundle.person.mm && message?.role === 'user' && message.speaker === 'athlete'
      && adapter.messageIdentity(state, message, bundle)
      && !message.capture && typeof message.text === 'string' && message.text.trim().length > 0
      && validTime(message.at) && change.confirmed_at >= message.at,
    'CURRENT_APA_ATHLETE_CONFIRMATION_REQUIRED');
    ensure(change.kind === 'correction' ? change.supersedes.length > 0 : change.supersedes.length === 0,
      'CURRENT_APA_CORRECTION_LINEAGE_INVALID');
    const priorSources = new Map(artifact.sources.map(item => [item.id, item]));
    const priorSourceIds = new Set(priorSources.keys());
    ensure(change.supersedes.every(id => priorSourceIds.has(id)
        && ['Athlete', 'Athlete confirmation', 'Athlete-confirmed coaching update']
          .includes(priorSources.get(id)?.source))
      && new Set(change.supersedes).size === change.supersedes.length,
    'CURRENT_APA_CORRECTION_LINEAGE_INVALID');
    const id = adapter.sourceId(change, bundle);
    ensure(!priorSourceIds.has(id), 'CURRENT_APA_CHANGE_ALREADY_PUBLISHED');
    return { id, source: 'Athlete-confirmed coaching update',
      question: change.kind === 'correction' ? 'Confirmed correction' : 'Confirmed current reality',
      text: message.text.trim(), at: change.confirmed_at, source_message_id: message.id,
      epistemic: 'ATHLETE_CONFIRMED', supersedes: [...change.supersedes],
      ...adapter.sourceIdentity(bundle) };
  }

  function materialDifferences(previous, next, source, inactiveSourceIds) {
    const changed = [];
    const inactive = new Set(inactiveSourceIds);
    const frozen = (before, after, path) => ensure(same(before, after), 'CURRENT_APA_UNCITED_FIELD_CHANGED', path);
    const cited = (path, before, after, refs, additionalRefs = null, diagnosticPath = path) => {
      if (same(normalized(before), normalized(after))) return;
      ensure(Array.isArray(refs) && refs.includes(source.id)
        && (additionalRefs === null || additionalRefs.includes(source.id)),
      'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND', diagnosticPath);
      changed.push({ path });
    };
    const citations = (before, after, path) => {
      ensure(Array.isArray(before) && Array.isArray(after)
        && before.every(id => inactive.has(id) || after.includes(id))
        && after.every(id => before.includes(id) || id === source.id),
      'CURRENT_APA_SOURCE_REFERENCES_CHANGED', path);
    };
    // Whole-APA narrative, priority and follow-up timing are governed separately
    // by the exact operation companion. Assessment identity remains historical.
    for (const [index, domain] of next.report.domains.entries()) {
      const prior = previous.report.domains.find(item => item.id === domain.id);
      ensure(prior, 'CURRENT_APA_STRUCTURE_CHANGED', `report.domains.${index}`);
      citations(prior.refs, domain.refs, `report.domains.${index}.refs`);
      frozen(prior.bos_refs, domain.bos_refs, `report.domains.${index}.bos_refs`);
      cited(`confirmation.goals.${domain.id}`, previous.confirmation.goals[domain.id],
        next.confirmation.goals[domain.id], domain.refs);
      for (const field of ['goal', 'strength', 'gap', 'help', 'detail', 'bos_connection', 'unknowns'])
        cited(`report.domains.${domain.id}.${field}`, prior[field], domain[field], domain.refs,
          null, `report.domains.${index}.${field}`);
    }
    for (const [index, future] of next.report.futures.entries()) {
      const prior = previous.report.futures.find(item => item.role === future.role);
      ensure(prior, 'CURRENT_APA_STRUCTURE_CHANGED', `report.futures.${index}`);
      citations(prior.refs, future.refs, `report.futures.${index}.refs`);
      frozen(prior.bos_refs, future.bos_refs, `report.futures.${index}.bos_refs`);
      for (const field of ['headline', 'what', 'conditions', 'first_sign', 'details', 'sufficient_evidence'])
        cited(`report.futures.${future.role}.${field}`, prior[field], future[field], future.refs,
          null, `report.futures.${index}.${field}`);
    }
    ensure(same(previous.report.candidates.map(item => item.candidate_id),
      next.report.candidates.map(item => item.candidate_id)), 'CURRENT_APA_STRUCTURE_CHANGED', 'report.candidates');
    for (const [index, candidate] of next.report.candidates.entries()) {
      const prior = previous.report.candidates[index];
      citations(prior.refs, candidate.refs, `report.candidates.${index}.refs`);
      frozen(prior.bos_refs, candidate.bos_refs, `report.candidates.${index}.bos_refs`);
      for (const field of ['domain', 'action', 'why', 'when', 'who', 'action_signal', 'progress_signal',
        'review', 'review_schedule', 'stop_or_change', 'bos_fit', 'selection_signals'])
        cited(`report.candidates.${candidate.candidate_id}.${field}`, prior[field], candidate[field], candidate.refs,
          null, `report.candidates.${index}.${field}`);
      ensure(same(prior.gates.map(gate => gate.id), candidate.gates.map(gate => gate.id)),
        'CURRENT_APA_STRUCTURE_CHANGED', `report.candidates.${index}.gates`);
      for (const [gateIndex, gate] of candidate.gates.entries()) {
        const priorGate = prior.gates[gateIndex];
        citations(priorGate.refs, gate.refs, `report.candidates.${index}.gates.${gateIndex}.refs`);
        for (const field of ['pass', 'reason'])
          cited(`report.candidates.${candidate.candidate_id}.gates.${gate.id}.${field}`,
            priorGate[field], gate[field], candidate.refs, gate.refs,
            `report.candidates.${index}.gates.${gateIndex}.${field}`);
      }
    }
    if (!same({ status: previous.status, candidate_id: previous.move?.candidate_id || null },
      { status: next.status, candidate_id: next.move?.candidate_id || null }))
      changed.push({ path: 'move.selection' });
    return changed;
  }


  // Caller MUST invoke this only after its existing athlete actor-capability,
  // CSRF, request-id and state-revision checks, within the fenced store lease.
  // A model output, coach note or mere chat statement is never an approval.
  function assertCurrentApaConfirmedSource({ bundle, record = null, state, confirmedChange, expectedVersion }) {
    const prior = currentApaView(bundle, record);
    ensure(expectedVersion === prior.version, 'CURRENT_APA_STALE_VERSION');
    ensure(prior.version < MAX_CURRENT_APA_REVISIONS, 'CURRENT_APA_REVISION_LIMIT');
    const source = sourceFromChange(confirmedChange, state, prior.artifact, bundle);
    ensure(confirmedChange.supersedes.every(id => !inactiveCurrentApaSourceIds(record).includes(id)),
      'CURRENT_APA_CORRECTION_LINEAGE_INVALID');
    return { prior, source, inactiveSourceIds: inactiveCurrentApaSourceIds(record, confirmedChange.supersedes) };
  }

  function publishCurrentApa({ bundle, record = null, state, confirmedChange, candidate, expectedVersion }) {
    const { prior, source, inactiveSourceIds } = assertCurrentApaConfirmedSource({
      bundle, record, state, confirmedChange, expectedVersion,
    });
    ensure(object(candidate) && object(candidate.confirmation) && object(candidate.report),
      'CURRENT_APA_CANDIDATE_INVALID', 'report');
    const confirmation = clone(candidate.confirmation), report = clone(candidate.report);
    verifyConfirmation(confirmation, bundle.apa);
    ensure(matchesSchema(report, REPORT_SCHEMA), 'CURRENT_APA_REPORT_SCHEMA_INVALID', 'report');
    ensure(same(report.coach_view, prior.artifact.report.coach_view), 'CURRENT_APA_COACH_VIEW_UNVERIFIED', 'report.coach_view');
    const sources = [...clone(prior.artifact.sources), source];
    const packet = { confirmation, sources, bos_sources: bundle.apa.bos_sources };
    checkedAt('report', () => validateReport(report, packet));
    assertActiveApaReferences(report, inactiveSourceIds);
    const selected = checkedAt('report.candidates', () => selectMove(report));
    const nextSurface = { confirmation, report, ...selected };
    const changes = materialDifferences(prior.artifact, nextSurface, source, inactiveSourceIds);
    const version = prior.version + 1;
    const narrative = validateApaNarrativeCandidate({ priorArtifact: prior.artifact, candidate,
      sourceId: source.id, sourceMessageId: source.source_message_id, sourceVersion: version,
      sourceText: source.text,
      inactiveSourceIds, supersedes: confirmedChange.supersedes });
    changes.push(...narrative.material_paths.map(path => ({ path })));
    if (!changes.length) return { record, changed: false, receipt: null };
    const anyNewReference = report.domains.some(item => item.refs.includes(source.id))
      || report.futures.some(item => item.refs.includes(source.id))
      || report.candidates.some(item => item.refs.includes(source.id)) || narrative.changes.length > 0;
    ensure(anyNewReference, 'CURRENT_APA_CHANGE_NOT_SOURCE_BOUND', 'report');
    const body = { version: bundle.apa.version, current_apa_contract: adapter.contract,
      current_apa_version: version, ...adapter.artifactIdentity(bundle),
      identity: clone(bundle.apa.identity), baseline_artifact_sha256: bundle.apa.artifact_sha256,
      bos_sha256: bundle.bos.artifact_sha256, source_sha256: currentApaHash({ confirmation, sources }),
      confirmation, sources, bos_sources: clone(bundle.apa.bos_sources),
      existing_plan: clone(bundle.apa.existing_plan), report,
      narrative_provenance: narrative.provenance, ...selected,
      created_at: confirmedChange.confirmed_at };
    const artifact = { ...body, artifact_sha256: currentApaHash(body) };
    verifyArtifact(artifact, bundle, version);
    const priorHash = prior.receipt?.receipt_hash || bundle.apa.artifact_sha256;
    const receiptBody = { version, prior_hash: priorHash, content_hash: artifact.artifact_sha256,
      prior_version: prior.version, prior_artifact_sha256: prior.artifact.artifact_sha256,
      change_id: confirmedChange.id, source_id: source.id, source_message_id: source.source_message_id,
      kind: confirmedChange.kind, supersedes: [...confirmedChange.supersedes],
      material_paths: [...new Set(changes.map(item => item.path))], narrative_changes: narrative.changes,
      narrative_contract: APA_NARRATIVE_CONTRACT,
      reason: confirmedChange.reason.trim(),
      at: confirmedChange.confirmed_at, ...adapter.receiptIdentity(bundle) };
    const receipt = { ...receiptBody, receipt_hash: currentApaHash(receiptBody) };
    const next = { contract: adapter.contract, binding: binding(bundle), version,
      artifact, receipts: [...clone(record?.receipts || []), receipt] };
    currentApaView(bundle, next);
    return { record: next, changed: true, receipt };
  }

  return Object.freeze({ currentApaView, assertCurrentApaConfirmedSource, publishCurrentApa,
    assertOriginalApaSurface });
}
