import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { bundles } from '../server/athleteConsultingV2/bundles.js';
import { currentApaHash, currentApaView, publishCurrentApa } from '../server/athleteConsultingV2/currentApa.js';
import { buildSessionMapChange, buildLegacySessionMapChange, captureSessionStartMap } from '../server/athleteConsultingV2/mapChange.js';
import { APA_NARRATIVE_FIELDS, getApaNarrativeValue, setApaNarrativeValue } from '../server/athleteConsultingV2/apaNarrative.js';
import { resolveSessionMapEntries, SESSION_MAP_DETAIL_REFS_CONTRACT } from '../server/athleteApa/sessionMapCore.js';

const clone = value => structuredClone(value);
const ids = [
  ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
  ['33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444'],
  ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'],
];
function fixture(bundle = bundles.nia) {
  const state = { mm: bundle.person.mm, revision: 0, currentApa: null, plan: null, apaDraft: null,
    apaNeedsReview: false, sessionId: '77777777-7777-4777-8777-777777777777', messages: [] };
  const start = captureSessionStartMap({ bundle, state });
  function publish(edit, { reason = 'The fictional athlete explicitly reviewed this complete update.' } = {}) {
    const prior = currentApaView(bundle, state.currentApa), [messageId, changeId] = ids[prior.version];
    const source = `APA:CURRENT:${changeId}`;
    state.messages.push({ id: messageId, role: 'user', speaker: 'athlete',
      text: 'My priority is Keep school and practice balanced. Review 2026-10-05 and plan through 2026-12-03.',
      at: `2026-09-27T18:0${prior.version * 2}:00.000Z` });
    const candidate = { confirmation: clone(prior.artifact.confirmation), report: clone(prior.artifact.report), narrative_updates: [] };
    edit(candidate, source, prior.artifact);
    const result = publishCurrentApa({ bundle, record: state.currentApa, state, candidate,
      expectedVersion: prior.version, confirmedChange: { id: changeId, source_message_id: messageId,
        mm: bundle.person.mm, athlete_slug: bundle.person.slug, kind: 'reality', supersedes: [],
        confirmed: true, confirmed_by: 'athlete', confirmed_at: `2026-09-27T18:0${prior.version * 2 + 1}:00.000Z`, reason } });
    assert.equal(result.changed, true); state.currentApa = result.record; state.revision++;
    return result;
  }
  const map = () => buildSessionMapChange({ bundle, state, startMap: start });
  return { bundle, state, start, publish, map };
}
const gapChange = (candidate, source) => {
  candidate.report.domains[1].gap = 'The fictional practice week now leaves less time for a first-pass cue.';
  candidate.report.domains[1].refs.push(source);
};

for (const slug of ['nia', 'sofia']) test(`${slug} compact entries preserve exact UI values and resolve canonical receipt/source custody`, () => {
  const f = fixture(bundles[slug]), original = currentApaHash(f.bundle), startHash = currentApaHash(f.start);
  const published = f.publish(gapChange), stateHash = currentApaHash(f.state), map = f.map();
  assert.equal(map.apa.entries_contract, SESSION_MAP_DETAIL_REFS_CONTRACT);
  const resolved = resolveSessionMapEntries(JSON.parse(JSON.stringify(map)));
  const row = resolved.find(entry => entry.path === 'report.domains.training.gap');
  assert.equal(row.detail.before, f.bundle.apa.report.domains[1].gap);
  assert.equal(row.detail.now, published.record.artifact.report.domains[1].gap);
  assert.equal(row.receipts[0].receipt_hash, published.receipt.receipt_hash);
  assert.equal(row.receipts[0].source_id, published.receipt.source_id);
  assert.equal(row.receipts[0].reason, published.receipt.reason);
  for (const entry of map.apa.entries) {
    assert.deepEqual(Object.keys(entry), ['path', 'detail_index', 'detail_sha256', 'receipt_refs']);
    assert.equal(map.object.details[entry.detail_index].path, entry.path);
    assert.equal(entry.detail_sha256, currentApaHash(map.object.details[entry.detail_index]));
    assert.equal(Object.hasOwn(entry, 'before'), false);
  }
  assert.equal(currentApaHash(f.state), stateHash); assert.equal(currentApaHash(f.start), startHash);
  assert.equal(currentApaHash(f.bundle), original);
});

test('complete 0 to 1 to 2 narrative comparison retains net before/after and exact active refs', () => {
  const f = fixture();
  f.publish((candidate, source) => {
    for (const field of APA_NARRATIVE_FIELDS) {
      const value = field === 'confirmation.priority' ? 'Keep school and practice balanced.'
        : field === 'confirmation.review_date' ? '2026-10-05'
          : field === 'confirmation.horizon_date' ? '2026-12-03'
            : field === 'what_we_dont_know' ? ['The exact next practice schedule is still unknown.']
              : `The reviewed fictional ${field} now reflects the changed week.`;
      setApaNarrativeValue(candidate, field, value);
      candidate.narrative_updates.push({ field, value: clone(value), refs: [source] });
    }
  });
  const first = clone(f.state.currentApa);
  f.publish((candidate, source, prior) => {
    candidate.narrative_updates = APA_NARRATIVE_FIELDS.map(field => ({ field,
      value: clone(getApaNarrativeValue(prior, field)),
      refs: [...prior.narrative_provenance.fields.find(item => item.field === field).refs, source] }));
  });
  const map = f.map(), resolved = resolveSessionMapEntries(map);
  for (const field of APA_NARRATIVE_FIELDS) {
    const path = field.startsWith('confirmation.') ? field : `report.${field}`;
    const row = resolved.find(entry => entry.path === path);
    assert(row); assert.equal(row.detail.before, field === 'what_we_dont_know'
      ? getApaNarrativeValue(f.bundle.apa, field).join('\n') : getApaNarrativeValue(f.bundle.apa, field));
    assert.equal(row.detail.now, field === 'what_we_dont_know'
      ? getApaNarrativeValue(first.artifact, field).join('\n') : getApaNarrativeValue(first.artifact, field));
    assert.equal(row.narrative_evidence.before_refs, null);
    assert.deepEqual(row.narrative_evidence.after_refs, ids.slice(0, 2).map(pair => `APA:CURRENT:${pair[1]}`));
    assert.equal(row.narrative_evidence.value_changed, true);
  }
  assert.equal(map.apa.receipts.length, 2);
  assert.deepEqual(map.apa.receipts[1].narrative_changes, f.state.currentApa.receipts[1].narrative_changes);
  for (const mutate of [packet => { packet.apa.receipts[1].prior_hash = '0'.repeat(64); },
    packet => { packet.apa.receipts[1].content_hash = '0'.repeat(64); }]) {
    const bad = clone(map); mutate(bad);
    assert.throws(() => resolveSessionMapEntries(bad), /MAP_CHANGE_DETAIL_REFS_INVALID/u);
  }
});

test('long many-field comparison stores all complete UI rows once without changing the serialized ceiling', t => {
  const f = fixture(), suffix = ` ${'A complete fictional school-and-practice observation. '.repeat(12)}`;
  const expected = new Map();
  const value = (surface, field, path, next) => {
    surface[field] = clone(next);
    expected.set(path, { now: Array.isArray(next) ? next.join('\n') : next,
      ...(Array.isArray(next) ? { now_lines: clone(next) } : {}) });
  };
  f.publish((candidate, source) => {
    for (const domain of candidate.report.domains) {
      // Keep the first layer within its existing native 125-word ceiling;
      // lengthy, complete wording belongs in the deep comparison fields.
      for (const field of ['goal', 'strength', 'gap', 'help'])
        value(domain, field, `report.domains.${domain.id}.${field}`, `A reviewed fictional ${domain.id} ${field} for this week.`);
      for (const field of ['detail', 'bos_connection'])
        value(domain, field, `report.domains.${domain.id}.${field}`, domain[field] + suffix);
      value(domain, 'unknowns', `report.domains.${domain.id}.unknowns`, [...domain.unknowns, suffix]);
      value(candidate.confirmation.goals, domain.id, `confirmation.goals.${domain.id}`, domain.goal);
      domain.refs.push(source);
    }
    for (const future of candidate.report.futures) {
      value(future, 'headline', `report.futures.${future.role}.headline`, `A reviewed ${future.role.replaceAll('_', ' ')} for this week`);
      for (const field of ['what', 'conditions', 'first_sign', 'details'])
        value(future, field, `report.futures.${future.role}.${field}`, future[field] + suffix);
      future.refs.push(source);
    }
    for (const option of candidate.report.candidates) {
      value(option, 'action', `report.candidates.${option.candidate_id}.action`, 'Try a small athlete-owned practice cue.');
      for (const field of ['why', 'when', 'who', 'action_signal', 'progress_signal', 'review', 'stop_or_change', 'bos_fit'])
        value(option, field, `report.candidates.${option.candidate_id}.${field}`, option[field] + suffix);
      option.refs.push(source);
      for (const gate of option.gates) {
        value(gate, 'reason', `report.candidates.${option.candidate_id}.gates.${gate.id}.reason`, gate.reason + suffix);
        gate.refs.push(source);
      }
    }
    for (const field of APA_NARRATIVE_FIELDS) {
      const next = field === 'confirmation.priority' ? 'Keep school and practice balanced.'
        : field === 'confirmation.review_date' ? '2026-10-05'
          : field === 'confirmation.horizon_date' ? '2026-12-03'
            : field === 'what_we_dont_know' ? [`The complete fictional uncertainty remains visible.${suffix}`]
              : `A reviewed fictional ${field} for this week.${suffix}`;
      setApaNarrativeValue(candidate, field, next);
      candidate.narrative_updates.push({ field, value: clone(next), refs: [source] });
      const path = field.startsWith('confirmation.') ? field : `report.${field}`;
      expected.set(path, { now: Array.isArray(next) ? next.join('\n') : next,
        ...(Array.isArray(next) ? { now_lines: clone(next) } : {}) });
      expected.set(`narrative_provenance.${field}`, { now: 'Athlete-reviewed evidence · version 1' });
    }
  });
  const map = f.map(), bytes = Buffer.byteLength(JSON.stringify(map), 'utf8');
  assert(map.apa.entries.length >= 125);
  assert.equal(resolveSessionMapEntries(map).length, map.apa.entries.length);
  assert.equal(map.object.details.length, map.apa.entries.length);
  assert.equal(map.object.details.length, expected.size);
  for (const detail of map.object.details) {
    const complete = expected.get(detail.path); assert(complete, `Expected exact full value for ${detail.path}`);
    assert.equal(detail.now, complete.now);
    if (complete.now_lines) assert.deepEqual(detail.now_lines, complete.now_lines);
  }
  assert(map.object.details.filter(detail => detail.now.includes(suffix)).length >= 80);
  assert(bytes <= 262144); t.diagnostic(`complete_many_field_packet_bytes=${bytes}; ceiling=262144`);
});

test('an irreducibly oversized complete comparison still fails the exact JSON byte guard without mutation', () => {
  const f = fixture();
  f.publish((candidate, source) => {
    candidate.report.domains[1].detail += '界'.repeat(90000); candidate.report.domains[1].refs.push(source);
  });
  const before = currentApaHash(f.state);
  assert.throws(f.map, /MAP_CHANGE_PACKET_TOO_LARGE/u);
  assert.equal(currentApaHash(f.state), before);
});

for (const [name, mutate] of Object.entries({
  'unknown reference field': map => { map.apa.entries[0].body = 'Not an accepted reference'; },
  'missing detail reference': map => { delete map.apa.entries[0].detail_index; },
  'crossed detail index': map => { map.apa.entries[0].detail_index = 1; },
  'missing complete detail': map => { map.object.details.pop(); },
  'duplicate detail path': map => { map.object.details.push(clone(map.object.details[0])); },
  'detail path drift': map => { map.object.details[0].path = 'report.domains.school.gap'; },
  'complete before text drift': map => { map.object.details[0].before += ' Invented prior content.'; },
  'complete now text drift': map => { map.object.details[0].now += ' Invented current content.'; },
  'complete lines drift': map => { map.object.details[0].now_lines = ['Invented omitted content.']; },
  'rationale drift': map => { map.object.details[0].now_rationale = 'Invented fit.'; },
  'missing receipt link': map => { map.apa.entries[0].receipt_refs = []; },
  'receipt hash drift': map => { map.apa.entries[0].receipt_refs[0].receipt_hash = '0'.repeat(64); },
  'crossed receipt version': map => { map.apa.entries[0].receipt_refs[0].version = 2; },
  'duplicate receipt link': map => { map.apa.entries[0].receipt_refs.push(clone(map.apa.entries[0].receipt_refs[0])); },
  'receipt source hash drift': map => { map.sources.find(source => source.id === 'athlete-source-apa-receipt-v1').hash = '0'.repeat(64); },
  'baseline receipt prior hash drift': map => { map.apa.receipts[0].prior_hash = '0'.repeat(64); },
  'final receipt content hash drift': map => { map.apa.receipts[0].content_hash = '0'.repeat(64); },
  'detail source drift': map => { map.object.details[0].sourceIds = ['athlete-source-map-start']; },
  'review attribution drift': map => { map.object.details[0].evidence_note = 'An invented review'; },
})) test(`closed detail resolver rejects ${name}`, () => {
  const f = fixture(); f.publish(gapChange); const map = f.map(); mutate(map);
  assert.throws(() => resolveSessionMapEntries(map), /MAP_CHANGE_DETAIL_REFS_INVALID/u);
});

test('missing or crossed narrative metadata is rejected rather than silently omitted', () => {
  const f = fixture(); f.publish((candidate, source) => {
    candidate.report.opening = 'A reviewed whole-picture description for this fictional week.';
    candidate.narrative_updates = [{ field: 'opening', value: candidate.report.opening, refs: [source] }];
  });
  const map = f.map();
  for (const mutate of [entry => { delete entry.narrative_evidence; },
    entry => { entry.narrative_evidence.after_refs = ['APA:CURRENT:foreign']; },
    entry => { entry.narrative_evidence.source_message_id = ids[1][0]; },
    entry => { entry.narrative_evidence.before_refs = []; }]) {
    const bad = clone(map); mutate(bad.apa.entries.find(entry => entry.path === 'report.opening'));
    assert.throws(() => resolveSessionMapEntries(bad), /MAP_CHANGE_DETAIL_REFS_INVALID/u);
  }
});

test('old nonbaseline start with unavailable field citations preserves exact later value change and honest limit', () => {
  const f = fixture(); f.publish(gapChange);
  const start = captureSessionStartMap({ bundle: f.bundle, state: f.state });
  delete start.apa.fields['narrative_provenance.connection'];
  const { snapshot_hash: _hash, ...body } = start; start.snapshot_hash = currentApaHash(body);
  f.publish((candidate, source) => {
    candidate.report.domains[1].gap = 'A second fictional practice change was separately reviewed.';
    candidate.report.domains[1].refs.push(source);
  });
  f.publish((candidate, source) => {
    candidate.report.connection = 'A third fictional review connects school and practice differently.';
    candidate.narrative_updates = [{ field: 'connection', value: candidate.report.connection, refs: [source] }];
  });
  const map = buildSessionMapChange({ bundle: f.bundle, state: f.state, startMap: start });
  const row = resolveSessionMapEntries(map).find(entry => entry.path === 'report.connection');
  assert.equal(row.detail.before, start.apa.fields['report.connection']);
  assert.equal(row.detail.now, f.state.currentApa.artifact.report.connection);
  assert.equal(row.narrative_evidence, undefined);
  assert.equal(row.narrative_evidence_unavailable, 'START_FIELD_EVIDENCE_UNAVAILABLE');
  assert(map.apa.comparison_limits.includes('narrative_provenance.connection'));
  for (const mutate of [packet => { packet.apa.comparison_limits = []; },
    packet => { delete packet.apa.entries.find(entry => entry.path === 'report.connection').narrative_evidence_unavailable; },
    packet => { packet.apa.entries.find(entry => entry.path === 'report.connection').narrative_evidence_unavailable = 'SOURCE_BOUND'; }]) {
    const bad = clone(map); mutate(bad);
    assert.throws(() => resolveSessionMapEntries(bad), /MAP_CHANGE_DETAIL_REFS_INVALID/u);
  }
});

test('no-net-change, pending-only and legacy projections keep their original truth boundaries', () => {
  const f = fixture(); const proposal = f.publish(gapChange);
  f.publish((candidate, source) => {
    candidate.report.domains[1].gap = f.bundle.apa.report.domains[1].gap; candidate.report.domains[1].refs.push(source);
  });
  const map = f.map(); assert.equal(map.apa.status, 'PUBLISHED_LINEAGE_NO_NET_CHANGE');
  assert.deepEqual(resolveSessionMapEntries(map), []); assert.equal(map.apa.receipts.length, 2);
  f.state.currentApa = null; f.state.apaDraft = { id: 'exact-private-proposal', expectedVersion: 0, previewRecord: proposal.record };
  const pending = f.map(); assert.deepEqual(resolveSessionMapEntries(pending), []);
  assert.equal(pending.pendingApa.status, 'PROPOSED_NOT_PUBLISHED');
  assert.deepEqual(pending.pendingApa.narrative_changes, proposal.receipt.narrative_changes);
  const legacy = buildLegacySessionMapChange({ bundle: f.bundle, state: f.state });
  assert.equal(legacy.comparison, 'UNAVAILABLE_START_SNAPSHOT');
  assert.deepEqual(resolveSessionMapEntries(legacy), []);
  assert.deepEqual(legacy.unchanged, { saved_apa: null, accepted_plan: null });
});
