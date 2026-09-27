import { Buffer } from 'node:buffer';
import { currentApaHash } from './currentApaCore.js';
import { APA_NARRATIVE_FIELDS, apaNarrativePath, getApaNarrativeValue } from '../athleteConsultingV2/apaNarrative.js';

export function createSessionMapCore(policy) {
  if (!policy || !Object.isFrozen(policy) || !['binding', 'currentApaView', 'acceptedPlan', 'classification'].every(key => typeof policy[key] === 'function')) throw new TypeError('MAP_CHANGE_POLICY_REQUIRED');
  const SESSION_MAP_START_CONTRACT = policy.startContract;
  const SESSION_MAP_CHANGE_CONTRACT = policy.changeContract;
const MAX_PACKET_BYTES = 256 * 1024;
const DOMAIN_FIELDS = ['goal', 'strength', 'gap', 'help', 'detail', 'bos_connection', 'unknowns'];
const FUTURE_FIELDS = ['headline', 'what', 'conditions', 'first_sign', 'details', 'sufficient_evidence'];
const CANDIDATE_FIELDS = ['domain', 'action', 'why', 'when', 'who', 'action_signal',
  'progress_signal', 'review', 'review_schedule', 'stop_or_change', 'bos_fit', 'selection_signals'];
const REPORT_FIELDS = ['headline', 'opening', 'connection', 'main_obstacle', 'what_we_dont_know'];
const NEW_SUMMARY_FIELDS = ['headline', 'opening'];
const summaryLabel = { headline: 'Your whole-picture heading', opening: 'Your whole picture',
  connection: 'How it connects', main_obstacle: 'Main obstacle', what_we_dont_know: 'What is still unknown',
  'confirmation.priority': 'Your current priority',
  'confirmation.review_date': 'Your agreed review date',
  'confirmation.horizon_date': 'Your planning horizon' };
const domainNames = { sport: 'Sport', training: 'Training', mindset: 'Mindset', school: 'School', coordination: 'Coordination' };
const domainLabels = { goal: 'goal', strength: 'strength', gap: 'current challenge', help: 'help that may fit',
  detail: 'what this means', bos_connection: 'connection to your portrait', unknowns: 'what remains unknown' };
const futureNames = { current_course: 'Your current-course future', emerging_future: 'Your emerging future',
  better_future: 'Your better future', bold_future: 'Your bold future', downside_future: 'What could go wrong' };
const futureLabels = { headline: 'direction', what: 'possibility', conditions: 'conditions', first_sign: 'first sign',
  details: 'what this means', sufficient_evidence: 'evidence support' };
const optionLabels = { domain: 'part of your life', action: 'suggested action', why: 'why it may fit', when: 'timing',
  who: 'who would be involved', action_signal: 'first action', progress_signal: 'what to notice', review: 'review',
  review_schedule: 'check-in timing', stop_or_change: 'when to stop or change', bos_fit: 'fit with your portrait',
  selection_signals: 'comparison evidence', removed: 'removed from the assessment' };
const gateNames = { athlete_agency: 'your choice', real_week: 'fit with your week', qualified_guidance: 'guidance',
  school_and_recovery: 'school and recovery', understandable: 'clarity' };
const signalNames = { constraint_leverage: 'Effect on the current obstacle', causal_reach: 'Reach of the proposed change',
  evidence_support: 'Evidence support', execution_feasibility: 'Feasibility now', time_to_signal: 'Time to notice a signal',
  reversibility_low_regret: 'Reversibility', trajectory_leverage: 'Effect on future paths', dependency_burden: 'Outside dependencies' };
const signalValues = { NONE: 'None', WEAK: 'Weak', MATERIAL: 'Material', DIRECT: 'Direct', SYMPTOM_ONLY: 'Symptom only',
  LOCAL: 'Local', MECHANISM_CHAIN: 'Mechanism chain', SYSTEMIC: 'Systemic', MODERATE: 'Moderate', STRONG: 'Strong',
  INFEASIBLE: 'Infeasible', DIFFICULT: 'Difficult', FEASIBLE: 'Feasible', READY: 'Ready', DISTANT: 'Distant', LONG: 'Long',
  MEDIUM: 'Medium', NEAR: 'Near', HIGH_REGRET: 'High regret', LOCK_IN: 'Lock-in', REVERSIBLE: 'Reversible',
  BOUNDED_TEST: 'Bounded test', INDIRECT: 'Indirect', HIGH: 'High', LOW: 'Low' };
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => a === undefined || b === undefined
  ? a === b : currentApaHash(a) === currentApaHash(b);
const bounded = value => {
  const result = JSON.stringify(value);
  ensure(typeof result === 'string' && Buffer.byteLength(result, 'utf8') <= MAX_PACKET_BYTES,
    'MAP_CHANGE_PACKET_TOO_LARGE');
  return value;
};

function binding(bundle, state) { return policy.binding(bundle, state); }

function materialFields(artifact) {
  const fields = {
    'confirmation.priority': artifact.confirmation.priority,
    'confirmation.review_date': artifact.confirmation.review_date,
    'confirmation.horizon_date': artifact.confirmation.horizon_date,
    'report.connection': artifact.report.connection,
    'report.main_obstacle': artifact.report.main_obstacle,
    'report.what_we_dont_know': clone(artifact.report.what_we_dont_know),
    'move.selection': { status: artifact.status,
      candidate_id: artifact.move?.candidate_id || null },
  };
  for (const id of ['sport', 'training', 'mindset', 'school'])
    fields[`confirmation.goals.${id}`] = artifact.confirmation.goals[id];
  for (const domain of artifact.report.domains)
    for (const field of DOMAIN_FIELDS)
      fields[`report.domains.${domain.id}.${field}`] = clone(domain[field]);
  for (const future of artifact.report.futures)
    for (const field of FUTURE_FIELDS)
      fields[`report.futures.${future.role}.${field}`] = clone(future[field]);
  for (const candidate of artifact.report.candidates)
    for (const field of CANDIDATE_FIELDS)
      if (Object.hasOwn(candidate, field))
        fields[`report.candidates.${candidate.candidate_id}.${field}`] = clone(candidate[field]);
  for (const candidate of artifact.report.candidates)
    for (const gate of candidate.gates)
      for (const field of ['pass', 'reason'])
        fields[`report.candidates.${candidate.candidate_id}.gates.${gate.id}.${field}`] = clone(gate[field]);
  for (const field of REPORT_FIELDS)
    fields[`report.${field}`] = clone(artifact.report[field]);
  for (const field of APA_NARRATIVE_FIELDS) {
    const provenance = artifact.narrative_provenance?.fields?.find(item => item.field === field);
    fields[`narrative_provenance.${field}`] = provenance ? clone(provenance) : {
      field, status: 'BASELINE_UNCITED_AT_FIELD_LEVEL',
      value_sha256: currentApaHash(getApaNarrativeValue(artifact, field)), refs: [],
      source_id: null, source_message_id: null, version: null,
    };
  }
  return { fields, candidate_ids: artifact.report.candidates.map(item => item.candidate_id) };
}

function acceptedPlan(plan, bundle, state) { return policy.acceptedPlan(plan, bundle, state); }

function sourceMap(bundle, state, input) {
  const apa = policy.currentApaView(bundle, state.currentApa || null, input);
  const material = materialFields(apa.artifact);
  return { version: apa.version, artifact_hash: apa.artifact.artifact_sha256,
    receipt_hash: apa.receipt?.receipt_hash || null,
    fields: material.fields, candidate_ids: material.candidate_ids,
    move_copy: apa.artifact.move ? { action: apa.artifact.move.action,
      why: apa.artifact.move.why } : null };
}

function captureSessionStartMap(input) {
  const { bundle, state } = input;
  const base = { contract: SESSION_MAP_START_CONTRACT, binding: binding(bundle, state),
    session_id: state.sessionId, captured_revision: state.revision,
    apa_needs_review: state.apaNeedsReview === true, apa: sourceMap(bundle, state, input),
    plan: acceptedPlan(state.plan, bundle, state) };
  ensure(UUID.test(base.session_id || '')
    && Number.isSafeInteger(base.captured_revision) && base.captured_revision >= 0,
    'MAP_CHANGE_REVISION_INVALID');
  bounded(base);
  return { ...base, snapshot_hash: currentApaHash(base) };
}

function verifyStart(bundle, state, startMap) {
  const { snapshot_hash, ...unsigned } = startMap || {};
  ensure(object(startMap) && startMap.contract === SESSION_MAP_START_CONTRACT
    && snapshot_hash === currentApaHash(unsigned)
    && same(startMap.binding, binding(bundle, state))
    && UUID.test(startMap.session_id || '') && state.sessionId === startMap.session_id
    && Number.isSafeInteger(startMap.captured_revision)
    && startMap.captured_revision >= 0
    && state.revision >= startMap.captured_revision
    && object(startMap.apa) && Number.isSafeInteger(startMap.apa.version)
    && startMap.apa.version >= 0 && typeof startMap.apa_needs_review === 'boolean'
    && object(startMap.apa.fields)
    && Array.isArray(startMap.apa.candidate_ids)
    && (startMap.apa.move_copy === null || (object(startMap.apa.move_copy)
      && typeof startMap.apa.move_copy.action === 'string'
      && typeof startMap.apa.move_copy.why === 'string'))
    && /^[a-f0-9]{64}$/u.test(startMap.apa.artifact_hash || ''),
  'MAP_CHANGE_START_INVALID');
  bounded(startMap);
}

function planLine(plan) {
  return plan ? plan.title : 'No accepted plan';
}

const short = (value, limit = 150) => {
  const text = String(value);
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
};
function comparisonExcerpt(value, other, limit) {
  const chars = Array.from(String(value)), compared = Array.from(String(other));
  if (chars.length <= limit) return chars.join('');
  let difference = 0;
  while (difference < chars.length && difference < compared.length && chars[difference] === compared[difference]) difference++;
  const start = Math.min(Math.max(0, difference - Math.floor(limit / 3)), chars.length - limit + 2);
  const content = chars.slice(start, start + limit - 2).join('');
  return `${start ? '…' : ''}${content}${start + limit - 2 < chars.length ? '…' : ''}`;
}
const shortPair = (before, now, sideLimit = 88) =>
  `${comparisonExcerpt(before, now, sideLimit)} → ${comparisonExcerpt(now, before, sideLimit)}`;

function display(value, present) {
  if (!present) return 'Not present';
  if (value === null) return 'Not recorded';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function label(path, before, now) {
  if (path === 'move.selection') return 'Your One Move';
  const parts = path.split('.');
  if (parts[0] === 'narrative_provenance') return `${summaryLabel[path.slice('narrative_provenance.'.length)]} · evidence`;
  if (Object.hasOwn(summaryLabel, path)) return summaryLabel[path];
  if (parts[0] === 'report' && Object.hasOwn(summaryLabel, parts[1])) return summaryLabel[parts[1]];
  if (parts[0] === 'confirmation' && parts[1] === 'goals')
    return `${domainNames[parts[2]]} goal`;
  if (parts[1] === 'domains') return `${domainNames[parts[2]]} · ${domainLabels[parts[3]]}`;
  if (parts[1] === 'futures') return `${futureNames[parts[2]]} · ${futureLabels[parts[3]]}`;
  if (parts[1] === 'candidates') {
    const selected = [before?.fields['move.selection']?.candidate_id, now?.fields['move.selection']?.candidate_id].includes(parts[2]);
    const prefix = selected ? 'Your suggested One Move' : 'Another assessment option';
    return parts[3] === 'gates' ? `${prefix} · ${gateNames[parts[4]]} check`
      : `${prefix} · ${optionLabels[parts[3]]}`;
  }
  return 'Other saved reading detail';
}

function provenanceDisplay(value, present) {
  if (!present) return 'Field-level evidence was not captured';
  return value?.status === 'SOURCE_BOUND'
    ? `Athlete-reviewed evidence · version ${value.version}`
    : 'Original baseline · no field-level citation';
}

// Old session snapshots did not capture heading/opening or narrative evidence.
// Recover only what exact immutable custody or a verified first change receipt
// proves; otherwise explicitly omit the comparison, never invent a prior value.
function compareSessionMapSummaries(bundle, start, now, receipts) {
  const before = clone(start), current = clone(now), limits = [];
  const baseline = start.version === 0 && start.artifact_hash === bundle.apa.artifact_sha256;
  for (const field of APA_NARRATIVE_FIELDS) {
    const valuePath = apaNarrativePath(field), evidencePath = `narrative_provenance.${field}`;
    const linkedReceipt = receipts.find(receipt => receipt.prior_version === start.version
      && receipt.version === start.version + 1
      && receipt.prior_artifact_sha256 === start.artifact_hash);
    const firstChange = linkedReceipt?.narrative_changes?.find(change => change.field === field);
    if (!Object.hasOwn(before.fields, valuePath)
      && (NEW_SUMMARY_FIELDS.includes(field) || field.startsWith('confirmation.'))) {
      if (baseline) before.fields[valuePath] = clone(getApaNarrativeValue(bundle.apa, field));
      else if (firstChange) before.fields[valuePath] = clone(firstChange.before);
      else { delete current.fields[valuePath]; limits.push(valuePath); }
    }
    if (!Object.hasOwn(before.fields, evidencePath)) {
      if (baseline || firstChange?.prior_provenance === 'BASELINE_FIELD_UNCITED') {
        before.fields[evidencePath] = { field, status: 'BASELINE_UNCITED_AT_FIELD_LEVEL',
          value_sha256: currentApaHash(before.fields[valuePath] ?? getApaNarrativeValue(bundle.apa, field)),
          refs: [], source_id: null, source_message_id: null, version: null };
      } else if (firstChange?.before_provenance) before.fields[evidencePath] = clone(firstChange.before_provenance);
      else { delete current.fields[evidencePath]; limits.push(evidencePath); }
    }
  }
  return { before, now: current, limits };
}

function changedFields(before, now, receipts) {
  const supported = new Map();
  for (const receipt of receipts)
    for (const path of receipt.material_paths)
      supported.set(path, [...(supported.get(path) || []), receipt]);
  const removed = new Set(before.candidate_ids.filter(id => !now.candidate_ids.includes(id)));
  const paths = new Set([...Object.keys(before.fields), ...Object.keys(now.fields)]);
  const entries = [];
  for (const path of [...paths].sort()) {
    const id = path.startsWith('report.candidates.') ? path.split('.')[2] : null;
    if (id && removed.has(id)) continue;
    const beforePresent = Object.hasOwn(before.fields, path);
    const nowPresent = Object.hasOwn(now.fields, path);
    const oldValue = before.fields[path], newValue = now.fields[path];
    if (beforePresent === nowPresent && same(oldValue, newValue)) continue;
    const lineage = supported.get(path);
    ensure(lineage?.length, 'MAP_CHANGE_UNRECEIPTED_FIELD');
    const narrativeField = APA_NARRATIVE_FIELDS.find(field => path === apaNarrativePath(field)
      || path === `narrative_provenance.${field}`);
    const beforeEvidence = narrativeField ? before.fields[`narrative_provenance.${narrativeField}`] : null;
    const afterEvidence = narrativeField ? now.fields[`narrative_provenance.${narrativeField}`] : null;
    entries.push({ path, label: label(path, before, now),
      before: path === 'move.selection' ? before.move_copy?.action || 'No One Move suggestion'
        : path.startsWith('narrative_provenance.') ? provenanceDisplay(oldValue, beforePresent)
        : display(oldValue, beforePresent),
      now: path === 'move.selection' ? now.move_copy?.action || 'No One Move suggestion'
        : path.startsWith('narrative_provenance.') ? provenanceDisplay(newValue, nowPresent)
        : display(newValue, nowPresent),
      ...(narrativeField && afterEvidence ? { narrative_evidence: {
        before_refs: beforeEvidence?.status === 'SOURCE_BOUND' ? clone(beforeEvidence.refs) : null,
        after_refs: clone(afterEvidence.refs),
        prior_provenance: beforeEvidence?.status === 'SOURCE_BOUND' ? 'SOURCE_BOUND'
          : beforeEvidence ? 'BASELINE_FIELD_UNCITED' : 'START_FIELD_EVIDENCE_UNAVAILABLE',
        value_changed: !same(before.fields[apaNarrativePath(narrativeField)], now.fields[apaNarrativePath(narrativeField)]),
        reference_changed: !beforeEvidence || beforeEvidence.status !== afterEvidence.status
          || !same(beforeEvidence.refs, afterEvidence.refs),
        source_id: afterEvidence.source_id, source_message_id: afterEvidence.source_message_id,
      } } : {}),
      ...(path === 'move.selection' ? { before_rationale: before.move_copy?.why || null,
        now_rationale: now.move_copy?.why || null,
        selection: { before: clone(oldValue), now: clone(newValue) } } : {}),
      receipts: lineage.map(receipt => ({
        version: receipt.version, receipt_hash: receipt.receipt_hash,
        source_id: receipt.source_id, source_message_id: receipt.source_message_id,
        reason: receipt.reason, at: receipt.at })) });
  }
  for (const id of [...removed].sort()) {
    const path = `report.candidates.${id}.removed`, lineage = supported.get(path);
    ensure(lineage?.length, 'MAP_CHANGE_UNRECEIPTED_FIELD');
    entries.push({ path, label: label(path, before, now), before: 'Present', now: 'Removed',
      receipts: lineage.map(receipt => ({ version: receipt.version,
        receipt_hash: receipt.receipt_hash, source_id: receipt.source_id,
        source_message_id: receipt.source_message_id, reason: receipt.reason,
        at: receipt.at })) });
  }
  return entries;
}

function changedPlanFields(before, now) {
  const entries = [];
  const add = (path, labelText, prior, current) => {
    if (same(prior, current)) return;
    entries.push({ path, label: labelText, before: display(prior, prior !== undefined),
      now: display(current, current !== undefined) });
  };
  const planLabels = { title: 'Accepted plan title', why: 'Why your plan fits', review: 'Agreed plan review' };
  const stepLabels = { action: 'agreed action', when: 'timing', notice: 'what to notice', owner: 'who owns it' };
  for (const field of ['title', 'why', 'review'])
    add(`plan.${field}`, planLabels[field], before?.[field], now?.[field]);
  const length = Math.max(before?.steps.length || 0, now?.steps.length || 0);
  for (let index = 0; index < length; index++)
    for (const field of ['action', 'when', 'notice', 'owner'])
      add(`plan.steps.${index}.${field}`, `Step ${index + 1} · ${stepLabels[field]}`,
        before?.steps[index]?.[field], now?.steps[index]?.[field]);
  if (before && now && entries.length === 0 && before.hash !== now.hash)
    add('plan.acceptance', 'Plan acceptance',
      'Earlier saved agreement', `Same displayed plan details reaffirmed at ${now.accepted_at}`);
  return entries;
}

function detailValue(path, value, present) {
  if (!present || value === null || typeof value === 'string') return { text: display(value, present) };
  if (Array.isArray(value) && value.every(item => typeof item === 'string'))
    return { text: value.join('\n'), lines: clone(value) };
  if (typeof value === 'boolean') return { text: path.endsWith('.sufficient_evidence')
    ? value ? 'Enough evidence for this path' : 'Not enough evidence for this path'
    : value ? 'Check passed' : 'Check not passed' };
  if (path.endsWith('.selection_signals')) {
    const lines = Object.entries(value).map(([key, level]) => `${signalNames[key]}: ${signalValues[level]}`);
    ensure(lines.every(line => !line.includes('undefined')), 'MAP_CHANGE_PRESENTATION_INVALID');
    return { text: lines.join('\n'), lines };
  }
  if (path.endsWith('.review_schedule')) {
    const lines = [`Setup check: ${value.setup_check}`, `Progress check: ${value.progress_check}`];
    return { text: lines.join('\n'), lines };
  }
  if (path.endsWith('.domain')) return { text: domainNames[value] };
  // No caller-selected object or metadata JSON is dumped into visual copy.
  ensure(false, 'MAP_CHANGE_PRESENTATION_INVALID');
}

function mapDetails(entries, before, now) {
  return entries.map(entry => {
    const evidence = entry.path.startsWith('narrative_provenance.') && entry.narrative_evidence?.value_changed === false;
    const values = entry.path === 'move.selection' || entry.path.endsWith('.removed')
      || entry.path.startsWith('narrative_provenance.')
      ? { before: { text: entry.before }, now: { text: entry.now } }
      : { before: detailValue(entry.path, before.fields[entry.path], Object.hasOwn(before.fields, entry.path)),
        now: detailValue(entry.path, now.fields[entry.path], Object.hasOwn(now.fields, entry.path)) };
    return { path: entry.path, label: entry.label, change_type: evidence ? 'EVIDENCE' : 'CONTENT',
      before: values.before.text, now: values.now.text,
      ...(values.before.lines ? { before_lines: values.before.lines } : {}),
      ...(values.now.lines ? { now_lines: values.now.lines } : {}),
      ...(entry.path === 'move.selection' ? { before_rationale: entry.before_rationale, now_rationale: entry.now_rationale } : {}),
      sourceIds: [...new Set(entry.receipts.map(receipt => `athlete-source-apa-receipt-v${receipt.version}`))],
      evidence_note: `Recorded athlete review: ${entry.receipts.at(-1).reason}` };
  });
}

function highlight(entry, before, now) {
  const detail = mapDetails([entry], before, now)[0];
  const excerpt = Array.from(detail.before).length > 88 || Array.from(detail.now).length > 88;
  return { label: detail.label, value: shortPair(detail.before, detail.now),
    note: entry.path === 'move.selection' && entry.now_rationale
      ? `${short(`Why this fits now: ${entry.now_rationale}`, excerpt ? 153 : 210)}${excerpt ? ' Excerpt; full wording is below.' : ''}`
      : excerpt ? 'Excerpt; full wording and recorded review are below.'
        : 'Saved reading detail changed. Its recorded athlete review is below.' };
}

function representativeEntries(entries, before, now, limit = 8) {
  const selected = [];
  const pick = predicate => {
    const entry = entries.find(item => predicate(item.path) && !selected.includes(item));
    if (entry) selected.push(entry);
  };
  for (const path of ['confirmation.priority', 'confirmation.review_date', 'confirmation.horizon_date']) pick(value => value === path);
  for (const path of ['report.opening', 'report.headline']) pick(value => value === path);
  pick(path => path.startsWith('confirmation.goals.') || path.startsWith('report.domains.'));
  pick(path => path.startsWith('report.futures.') && !path.endsWith('.sufficient_evidence'));
  pick(path => path === 'move.selection');
  const selectedIds = [now.fields['move.selection']?.candidate_id, before.fields['move.selection']?.candidate_id].filter(Boolean);
  for (const id of selectedIds) pick(path => path.startsWith(`report.candidates.${id}.`)
    && !path.includes('.gates.') && !path.endsWith('.selection_signals'));
  for (const entry of entries) {
    if (selected.length >= limit) break;
    // Evidence/selector metadata and unselected options stay in exact details,
    // never become a first-match personal headline.
    if (!selected.includes(entry) && !entry.path.startsWith('narrative_provenance.') && !entry.path.endsWith('.sufficient_evidence')
      && !entry.path.startsWith('report.candidates.')) selected.push(entry);
  }
  return selected.slice(0, limit);
}

function pendingApa(bundle, state, current, input) {
  const draft = state.apaDraft;
  if (!draft) return null;
  const preview = policy.currentApaView(bundle, draft.previewRecord, input);
  ensure(draft.expectedVersion === current.version && preview.version === current.version + 1
    && (!current.receipt || draft.previewRecord.receipts.at(-2)?.receipt_hash === current.receipt.receipt_hash)
    && typeof draft.id === 'string' && draft.id.length <= 160,
  'MAP_CHANGE_PENDING_APA_INVALID');
  return { status: 'PROPOSED_NOT_PUBLISHED', id: draft.id,
    proposed_version: preview.version, artifact_hash: preview.artifact.artifact_sha256,
    receipt_hash: preview.receipt.receipt_hash, source_id: preview.receipt.source_id,
    source_message_id: preview.receipt.source_message_id,
    material_paths: clone(preview.receipt.material_paths), reason: preview.receipt.reason,
    narrative_changes: clone(preview.receipt.narrative_changes || []) };
}

function buildSessionMapChange(input) {
  const { bundle, state, startMap } = input;
  verifyStart(bundle, state, startMap);
  const current = policy.currentApaView(bundle, state.currentApa || null, input);
  const nowApa = sourceMap(bundle, state, input);
  const nowPlan = acceptedPlan(state.plan, bundle, state);
  ensure(current.version >= startMap.apa.version, 'MAP_CHANGE_START_AHEAD');
  if (startMap.apa.version === current.version) {
    ensure(startMap.apa.artifact_hash === nowApa.artifact_hash
      && startMap.apa.receipt_hash === nowApa.receipt_hash, 'MAP_CHANGE_LINEAGE_CHANGED');
  } else if (startMap.apa.version > 0) {
    const ancestor = state.currentApa?.receipts?.[startMap.apa.version - 1];
    ensure(ancestor?.receipt_hash === startMap.apa.receipt_hash
      && ancestor?.content_hash === startMap.apa.artifact_hash,
    'MAP_CHANGE_LINEAGE_CHANGED');
  } else ensure(startMap.apa.artifact_hash === bundle.apa.artifact_sha256,
    'MAP_CHANGE_LINEAGE_CHANGED');
  const newReceipts = (state.currentApa?.receipts || []).slice(startMap.apa.version);
  const comparison = compareSessionMapSummaries(bundle, startMap.apa, nowApa, newReceipts);
  const entries = changedFields(comparison.before, comparison.now, newReceipts);
  const versionAdvanced = current.version > startMap.apa.version;
  const apaChanged = entries.length > 0;
  const wordingChanged = entries.some(entry => !entry.path.startsWith('narrative_provenance.'));
  const planChanged = !same(startMap.plan, nowPlan);
  const planEntries = changedPlanFields(startMap.plan, nowPlan);
  const pending = pendingApa(bundle, state, current, input);
  const needsReview = state.apaNeedsReview === true;
  const sources = [{ id: 'athlete-source-map-start', label: 'Session-start saved map',
    classification: policy.classification('SAVED', bundle), hash: startMap.snapshot_hash },
  { id: 'athlete-source-map-final-apa', label: needsReview
    ? 'Historical APA awaiting athlete review' : 'Final saved APA',
  classification: needsReview ? policy.classification('HISTORICAL', bundle) : policy.classification('SAVED', bundle),
  hash: nowApa.artifact_hash }];
  for (const receipt of newReceipts) sources.push({
    id: `athlete-source-apa-receipt-v${receipt.version}`,
    label: `Published APA version ${receipt.version}`,
    classification: policy.classification('ATHLETE_PUBLISHED', bundle), hash: receipt.receipt_hash });
  if (startMap.plan) sources.push({ id: 'athlete-source-start-plan',
    label: 'Session-start accepted plan', classification: policy.classification('APPROVED', bundle),
    hash: startMap.plan.hash });
  if (nowPlan) sources.push({ id: 'athlete-source-accepted-plan', label: 'Exact accepted plan',
    classification: policy.classification('APPROVED', bundle), hash: nowPlan.hash });
  if (pending) sources.push({ id: 'athlete-source-pending-apa', label: 'Unpublished APA proposal',
    classification: policy.classification('PROPOSED_ONLY', bundle), hash: pending.artifact_hash });
  const statement = needsReview
    ? `An earlier saved APA is historical and awaiting athlete review.${planChanged ? ' The accepted plan changed this session.' : ''}`
    : apaChanged && !wordingChanged ? `Your saved wording is unchanged; its reviewed evidence changed this session.${planChanged ? ' The accepted plan changed.' : ' The accepted plan did not.'}`
    : apaChanged && planChanged ? 'The saved APA and accepted plan changed this session.'
      : apaChanged ? 'The saved APA changed this session; the accepted plan did not.'
        : versionAdvanced ? `Your saved APA was revised this session, but its current map matches where this session began.${planChanged ? ' The accepted plan changed.' : ''}`
        : planChanged ? 'The accepted plan changed this session; the saved APA did not.'
          : 'No saved APA or accepted-plan change this session.';
  const representatives = representativeEntries(entries, comparison.before, comparison.now);
  const planPreview = planEntries.length
    ? `${short(planEntries[0].label, 45)}: ${shortPair(planEntries[0].before, planEntries[0].now, 62)}`
    : shortPair(planLine(startMap.plan), planLine(nowPlan), 88);
  const items = [
    ...representatives.map(entry => highlight(entry, comparison.before, comparison.now)),
    ...(entries.some(entry => entry.path.startsWith('narrative_provenance.')) ? [{ label: 'Reviewed evidence',
      value: entries.some(entry => entry.path.startsWith('narrative_provenance.') && entry.narrative_evidence?.value_changed)
        ? 'Evidence for your saved wording was reviewed.' : 'Same wording, reviewed evidence.',
      note: 'Evidence changes are separate from wording changes. Review the full comparison below.' }] : []),
    { label: 'Saved APA', value: `Version ${startMap.apa.version} → ${nowApa.version}`,
      note: needsReview ? 'The earlier reading is historical and awaiting athlete review.'
        : apaChanged ? 'Only separately published athlete-reviewed versions count.'
          : versionAdvanced ? 'A saved version was updated, but the visible map has no net change.'
          : 'No published APA change this session.' },
    { label: 'Accepted plan', value: planPreview,
      note: planChanged ? `${short(nowPlan?.why || 'The previous accepted plan is no longer saved.', 140)}${planEntries.some(entry => entry.before.length > 62 || entry.now.length > 62) ? ' Excerpt; full plan details are below.' : ''}`
        : 'No accepted-plan change this session.' },
    ...(pending ? [{ label: 'APA proposal', value: `Version ${pending.proposed_version} · not published`,
      note: 'This proposed reading is separate from the saved APA.' }] : []),
    ...(entries.length > representatives.length ? [{ label: 'Complete comparison',
      value: 'Review all saved changes',
      note: 'The full wording and reviewed evidence are below, separate from these highlights.' }] : []),
    ...(comparison.limits.length ? [{ label: 'Earlier comparison limit',
      value: 'Some summary evidence was not captured at session start',
      note: 'No earlier summary value or field citation has been invented.' }] : []),
  ];
  const result = { contract: SESSION_MAP_CHANGE_CONTRACT,
    binding: { ...clone(startMap.binding), session_id: startMap.session_id },
    apa: { status: needsReview ? 'HISTORICAL_AWAITING_ATHLETE_REVIEW'
      : apaChanged ? 'PUBLISHED_CHANGE' : versionAdvanced ? 'PUBLISHED_LINEAGE_NO_NET_CHANGE' : 'UNCHANGED',
    version_advanced: versionAdvanced, net_material_change: apaChanged,
    before: { version: startMap.apa.version, artifact_hash: startMap.apa.artifact_hash,
      needs_review: startMap.apa_needs_review },
    now: { version: nowApa.version, artifact_hash: nowApa.artifact_hash,
      needs_review: needsReview },
    entries, comparison_limits: comparison.limits, receipts: newReceipts.map(receipt => ({ version: receipt.version,
      receipt_hash: receipt.receipt_hash, prior_hash: receipt.prior_hash,
      content_hash: receipt.content_hash, source_id: receipt.source_id,
      source_message_id: receipt.source_message_id, reason: receipt.reason,
      material_paths: clone(receipt.material_paths),
      narrative_changes: clone(receipt.narrative_changes || []), at: receipt.at })) },
    plan: { status: planChanged ? nowPlan ? 'ACCEPTED_CHANGE' : 'REMOVED' : 'UNCHANGED',
      before: clone(startMap.plan), now: clone(nowPlan),
      binding: { before: startMap.plan ? { id: startMap.plan.id, hash: startMap.plan.hash } : null,
        now: nowPlan ? { id: nowPlan.id, hash: nowPlan.hash } : null },
      entries: planEntries, reason: planChanged ? nowPlan?.why || null : null },
    pendingApa: pending,
    unchanged: { saved_apa: !apaChanged, accepted_plan: !planChanged },
    sources,
    object: { id: 'athlete-map-change', kind: 'MAP_CHANGE_REVEAL',
      title: 'This is how your map has changed', statement,
      qualifier: pending ? 'A proposed APA is separate from the saved map.'
        : needsReview ? 'The historical APA is not current coaching truth.' : null,
      items, details: [...mapDetails(entries, comparison.before, comparison.now),
        ...planEntries.map(entry => ({ path: entry.path, label: entry.label, change_type: 'ACCEPTED_PLAN',
          before: entry.before, now: entry.now,
          sourceIds: ['athlete-source-start-plan', 'athlete-source-accepted-plan'].filter(id => sources.some(source => source.id === id)),
          evidence_note: 'A separately accepted plan, not an APA suggestion.' }))],
      sourceIds: sources.map(source => source.id) } };
  return bounded(result);
}

// A session already underway before GU-06 has no trustworthy starting map.
// Show the current saved state at closing, but never manufacture a before map
// or claim that anything did (or did not) change during that session.
function buildLegacySessionMapChange(input) {
  const { bundle, state } = input;
  const sessionBinding = binding(bundle, state);
  ensure(UUID.test(state.sessionId || '') && state.sessionStartMap == null,
    'MAP_CHANGE_LEGACY_SESSION_INVALID');
  const current = policy.currentApaView(bundle, state.currentApa || null, input);
  const apa = sourceMap(bundle, state, input);
  const plan = acceptedPlan(state.plan, bundle, state);
  const needsReview = state.apaNeedsReview === true;
  const pending = pendingApa(bundle, state, current, input);
  const sources = [{ id: 'athlete-source-map-final-apa',
    label: needsReview ? 'Historical APA awaiting athlete review' : 'Current saved APA',
    classification: needsReview ? policy.classification('HISTORICAL', bundle) : policy.classification('SAVED', bundle),
    hash: apa.artifact_hash }];
  if (plan) sources.push({ id: 'athlete-source-accepted-plan',
    label: 'Exact accepted plan', classification: policy.classification('APPROVED', bundle), hash: plan.hash });
  if (pending) sources.push({ id: 'athlete-source-pending-apa',
    label: 'Unpublished APA proposal', classification: policy.classification('PROPOSED_ONLY', bundle),
    hash: pending.artifact_hash });
  const object = { id: 'athlete-map-change', kind: 'MAP_CHANGE_REVEAL',
    title: 'Your map at this closing',
    statement: 'This session began before map-change tracking. Its starting map was not saved, so a before-and-after comparison is unavailable.',
    qualifier: 'Only the current saved state is shown. No change or unchanged claim is made for this session.',
    items: [{ label: 'Saved APA',
      value: needsReview ? `Version ${apa.version} · historical, awaiting review` : `Current saved version ${apa.version}`,
      note: 'The session-start version is unknown.' },
    { label: 'Accepted plan', value: plan?.title || 'No accepted plan currently saved',
      note: 'The session-start plan is unknown.' },
    ...(pending ? [{ label: 'APA proposal', value: `Version ${pending.proposed_version} · not published`,
      note: 'This proposed reading is separate from the saved APA.' }] : [])],
    sourceIds: sources.map(source => source.id) };
  return bounded({ contract: SESSION_MAP_CHANGE_CONTRACT,
    comparison: 'UNAVAILABLE_START_SNAPSHOT',
    binding: { ...sessionBinding, session_id: state.sessionId },
    apa: { status: 'START_UNAVAILABLE', before: null,
      now: { version: apa.version, artifact_hash: apa.artifact_hash, needs_review: needsReview },
      entries: [], receipts: [] },
    plan: { status: 'START_UNAVAILABLE', before: null, now: clone(plan),
      entries: [], reason: null },
    pendingApa: pending,
    unchanged: { saved_apa: null, accepted_plan: null },
    sources, object });
}

  return Object.freeze({ captureSessionStartMap, buildSessionMapChange, buildLegacySessionMapChange, compareSessionMapSummaries });
}
