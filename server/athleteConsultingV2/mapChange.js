import { Buffer } from 'node:buffer';
import { validateBundle } from './bundles.js';
import { currentApaHash, currentApaView } from './currentApa.js';
import { validatePlan } from './state.js';

export const SESSION_MAP_START_CONTRACT = 'athlete_session_map_start_v1';
export const SESSION_MAP_CHANGE_CONTRACT = 'athlete_session_map_change_v1';
const MAX_PACKET_BYTES = 256 * 1024;
const DOMAIN_FIELDS = ['goal', 'strength', 'gap', 'help', 'detail', 'bos_connection', 'unknowns'];
const FUTURE_FIELDS = ['headline', 'what', 'conditions', 'first_sign', 'details', 'sufficient_evidence'];
const CANDIDATE_FIELDS = ['domain', 'action', 'why', 'when', 'who', 'action_signal',
  'progress_signal', 'review', 'review_schedule', 'stop_or_change', 'bos_fit', 'selection_signals'];
const REPORT_FIELDS = ['connection', 'main_obstacle', 'what_we_dont_know'];
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu;
const ensure = (condition, code) => { if (!condition) throw new Error(code); };
const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => a === undefined || b === undefined
  ? a === b : currentApaHash(a) === currentApaHash(b);
const iso = value => typeof value === 'string' && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString() === value;
const bounded = value => {
  const result = JSON.stringify(value);
  ensure(typeof result === 'string' && Buffer.byteLength(result, 'utf8') <= MAX_PACKET_BYTES,
    'MAP_CHANGE_PACKET_TOO_LARGE');
  return value;
};

function binding(bundle, state) {
  const slug = bundle?.person?.slug;
  ensure(['nia', 'sofia'].includes(slug), 'MAP_CHANGE_SYNTHETIC_ONLY');
  validateBundle(slug, bundle);
  ensure(state?.mm === bundle.person.mm, 'MAP_CHANGE_ATHLETE_MISMATCH');
  return { slug, mm: bundle.person.mm, bos_hash: bundle.bos.artifact_sha256,
    baseline_apa_hash: bundle.apa.artifact_sha256 };
}

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
  return { fields, candidate_ids: artifact.report.candidates.map(item => item.candidate_id) };
}

function acceptedPlan(plan) {
  if (plan == null) return null;
  validatePlan(plan);
  ensure(typeof plan.id === 'string' && plan.id.length <= 160 && iso(plan.accepted_at)
    && Array.isArray(plan.approvals) && plan.approvals.includes('athlete')
    && plan.steps.every(step => step.owner !== 'coach' || plan.approvals.includes('coach')),
  'MAP_CHANGE_PLAN_NOT_ACCEPTED');
  const copy = clone(plan);
  return { id: copy.id, hash: currentApaHash(copy), accepted_at: copy.accepted_at,
    title: copy.title, why: copy.why, steps: copy.steps, review: copy.review };
}

function sourceMap(bundle, state) {
  const apa = currentApaView(bundle, state.currentApa || null);
  const material = materialFields(apa.artifact);
  return { version: apa.version, artifact_hash: apa.artifact.artifact_sha256,
    receipt_hash: apa.receipt?.receipt_hash || null,
    fields: material.fields, candidate_ids: material.candidate_ids,
    move_copy: apa.artifact.move ? { action: apa.artifact.move.action,
      why: apa.artifact.move.why } : null };
}

export function captureSessionStartMap({ bundle, state }) {
  const base = { contract: SESSION_MAP_START_CONTRACT, binding: binding(bundle, state),
    session_id: state.sessionId, captured_revision: state.revision,
    apa_needs_review: state.apaNeedsReview === true, apa: sourceMap(bundle, state),
    plan: acceptedPlan(state.plan) };
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
const shortPair = (before, now, sideLimit = 88) =>
  `${short(before, sideLimit)} → ${short(now, sideLimit)}`;

function display(value, present) {
  if (!present) return 'Not present';
  if (value === null) return 'Not recorded';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function label(path) {
  if (path === 'move.selection') return 'Your One Move';
  const parts = path.split('.');
  if (parts[0] === 'confirmation' && parts[1] === 'goals')
    return `${parts[2]} goal`;
  if (parts[0] === 'confirmation') return `APA ${parts[1].replaceAll('_', ' ')}`;
  if (parts[1] === 'domains') return `${parts[2]} · ${parts[3].replaceAll('_', ' ')}`;
  if (parts[1] === 'futures') return `${parts[2].replaceAll('_', ' ')} future · ${parts[3].replaceAll('_', ' ')}`;
  if (parts[1] === 'candidates') return `${parts[2]} option · ${parts[3].replaceAll('_', ' ')}`;
  return `APA ${parts.slice(1).join(' ').replaceAll('_', ' ')}`;
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
    entries.push({ path, label: label(path),
      before: path === 'move.selection' ? before.move_copy?.action || 'No One Move suggestion'
        : display(oldValue, beforePresent),
      now: path === 'move.selection' ? now.move_copy?.action || 'No One Move suggestion'
        : display(newValue, nowPresent),
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
    entries.push({ path, label: label(path), before: 'Present', now: 'Removed',
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
  for (const field of ['title', 'why', 'review'])
    add(`plan.${field}`, `Plan ${field}`, before?.[field], now?.[field]);
  const length = Math.max(before?.steps.length || 0, now?.steps.length || 0);
  for (let index = 0; index < length; index++)
    for (const field of ['action', 'when', 'notice', 'owner'])
      add(`plan.steps.${index}.${field}`, `Step ${index + 1} ${field}`,
        before?.steps[index]?.[field], now?.steps[index]?.[field]);
  if (before && now && entries.length === 0 && before.hash !== now.hash)
    add('plan.acceptance', 'Plan acceptance',
      'Earlier saved agreement', `Same displayed plan details reaffirmed at ${now.accepted_at}`);
  return entries;
}

function representativeEntries(entries, limit = 6) {
  const selected = [];
  const pick = predicate => {
    const entry = entries.find(item => predicate(item.path) && !selected.includes(item));
    if (entry) selected.push(entry);
  };
  pick(path => path.startsWith('confirmation.') || path.startsWith('report.domains.')
    || ['report.connection', 'report.main_obstacle', 'report.what_we_dont_know'].includes(path));
  pick(path => path.startsWith('report.futures.'));
  pick(path => path === 'move.selection');
  pick(path => path.startsWith('report.candidates.'));
  for (const entry of entries) {
    if (selected.length >= limit) break;
    if (!selected.includes(entry)) selected.push(entry);
  }
  return selected;
}

function pendingApa(bundle, state, current) {
  const draft = state.apaDraft;
  if (!draft) return null;
  const preview = currentApaView(bundle, draft.previewRecord);
  ensure(draft.expectedVersion === current.version && preview.version === current.version + 1
    && (!current.receipt || draft.previewRecord.receipts.at(-2)?.receipt_hash === current.receipt.receipt_hash)
    && typeof draft.id === 'string' && draft.id.length <= 160,
  'MAP_CHANGE_PENDING_APA_INVALID');
  return { status: 'PROPOSED_NOT_PUBLISHED', id: draft.id,
    proposed_version: preview.version, artifact_hash: preview.artifact.artifact_sha256,
    receipt_hash: preview.receipt.receipt_hash, source_id: preview.receipt.source_id,
    source_message_id: preview.receipt.source_message_id,
    material_paths: clone(preview.receipt.material_paths), reason: preview.receipt.reason };
}

export function buildSessionMapChange({ bundle, state, startMap }) {
  verifyStart(bundle, state, startMap);
  const current = currentApaView(bundle, state.currentApa || null);
  const nowApa = sourceMap(bundle, state);
  const nowPlan = acceptedPlan(state.plan);
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
  const entries = changedFields(startMap.apa, nowApa, newReceipts);
  const versionAdvanced = current.version > startMap.apa.version;
  const apaChanged = entries.length > 0;
  const planChanged = !same(startMap.plan, nowPlan);
  const planEntries = changedPlanFields(startMap.plan, nowPlan);
  const pending = pendingApa(bundle, state, current);
  const needsReview = state.apaNeedsReview === true;
  const sources = [{ id: 'athlete-source-map-start', label: 'Session-start saved map',
    classification: 'SYNTHETIC_SAVED', hash: startMap.snapshot_hash },
  { id: 'athlete-source-map-final-apa', label: needsReview
    ? 'Historical APA awaiting athlete review' : 'Final saved APA',
  classification: needsReview ? 'SYNTHETIC_HISTORICAL' : 'SYNTHETIC_SAVED',
  hash: nowApa.artifact_hash }];
  for (const receipt of newReceipts) sources.push({
    id: `athlete-source-apa-receipt-v${receipt.version}`,
    label: `Published APA version ${receipt.version}`,
    classification: 'SYNTHETIC_ATHLETE_PUBLISHED', hash: receipt.receipt_hash });
  if (startMap.plan) sources.push({ id: 'athlete-source-start-plan',
    label: 'Session-start accepted plan', classification: 'SYNTHETIC_APPROVED',
    hash: startMap.plan.hash });
  if (nowPlan) sources.push({ id: 'athlete-source-accepted-plan', label: 'Exact accepted plan',
    classification: 'SYNTHETIC_APPROVED', hash: nowPlan.hash });
  if (pending) sources.push({ id: 'athlete-source-pending-apa', label: 'Unpublished APA proposal',
    classification: 'SYNTHETIC_PROPOSED_ONLY', hash: pending.artifact_hash });
  const statement = needsReview
    ? `An earlier saved APA is historical and awaiting athlete review.${planChanged ? ' The accepted plan changed this session.' : ''}`
    : apaChanged && planChanged ? 'The saved APA and accepted plan changed this session.'
      : apaChanged ? 'The saved APA changed this session; the accepted plan did not.'
        : versionAdvanced ? `Your saved APA was revised this session, but its current map matches where this session began.${planChanged ? ' The accepted plan changed.' : ''}`
        : planChanged ? 'The accepted plan changed this session; the saved APA did not.'
          : 'No saved APA or accepted-plan change this session.';
  const representatives = representativeEntries(entries);
  const planPreview = planEntries.length
    ? `${short(planEntries[0].label, 45)}: ${shortPair(planEntries[0].before, planEntries[0].now, 62)}`
    : shortPair(planLine(startMap.plan), planLine(nowPlan), 88);
  const items = [
    { label: 'Saved APA', value: `Version ${startMap.apa.version} → ${nowApa.version}`,
      note: needsReview ? 'The earlier reading is historical and awaiting athlete review.'
        : apaChanged ? 'Only separately published athlete-reviewed versions count.'
          : versionAdvanced ? 'A saved version was updated, but the visible map has no net change.'
          : 'No published APA change this session.' },
    ...representatives.map(entry => ({ label: short(entry.label, 90),
      value: shortPair(entry.before, entry.now),
      note: entry.path === 'move.selection' && entry.now_rationale
        ? `${short(`Why it changed: ${entry.receipts.at(-1).reason}`, 99)} · ${short(`Why this fits now: ${entry.now_rationale}`, 106)}`
        : short(`Why: ${entry.receipts.at(-1).reason}`, 210) })),
    { label: 'Accepted plan', value: planPreview,
      note: planChanged ? short(nowPlan?.why || 'The previous accepted plan is no longer saved.', 210)
        : 'No accepted-plan change this session.' },
    ...(pending ? [{ label: 'APA proposal', value: `Version ${pending.proposed_version} · not published`,
      note: 'This proposed reading is separate from the saved APA.' }] : []),
    ...(entries.length > representatives.length ? [{ label: 'More map details',
      value: `${entries.length - representatives.length} other saved details changed`,
      note: 'These are highlights. See Your Sport for the full current report.' }] : []),
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
    entries, receipts: newReceipts.map(receipt => ({ version: receipt.version,
      receipt_hash: receipt.receipt_hash, prior_hash: receipt.prior_hash,
      content_hash: receipt.content_hash, source_id: receipt.source_id,
      source_message_id: receipt.source_message_id, reason: receipt.reason,
      material_paths: clone(receipt.material_paths), at: receipt.at })) },
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
      items, sourceIds: sources.map(source => source.id) } };
  return bounded(result);
}

// A session already underway before GU-06 has no trustworthy starting map.
// Show the current saved state at closing, but never manufacture a before map
// or claim that anything did (or did not) change during that session.
export function buildLegacySessionMapChange({ bundle, state }) {
  const sessionBinding = binding(bundle, state);
  ensure(UUID.test(state.sessionId || '') && state.sessionStartMap == null,
    'MAP_CHANGE_LEGACY_SESSION_INVALID');
  const current = currentApaView(bundle, state.currentApa || null);
  const apa = sourceMap(bundle, state);
  const plan = acceptedPlan(state.plan);
  const needsReview = state.apaNeedsReview === true;
  const pending = pendingApa(bundle, state, current);
  const sources = [{ id: 'athlete-source-map-final-apa',
    label: needsReview ? 'Historical APA awaiting athlete review' : 'Current saved APA',
    classification: needsReview ? 'SYNTHETIC_HISTORICAL' : 'SYNTHETIC_SAVED',
    hash: apa.artifact_hash }];
  if (plan) sources.push({ id: 'athlete-source-accepted-plan',
    label: 'Exact accepted plan', classification: 'SYNTHETIC_APPROVED', hash: plan.hash });
  if (pending) sources.push({ id: 'athlete-source-pending-apa',
    label: 'Unpublished APA proposal', classification: 'SYNTHETIC_PROPOSED_ONLY',
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
